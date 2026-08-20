"""Worktree ownership leases and git-admin ownership manifests."""

from __future__ import annotations

import getpass
import json
import os
import socket
import uuid
from datetime import timedelta
from pathlib import Path

from . import ControlPlaneError, iso_utc, parse_utc, utc_now
from .config import Config, load_config
from . import gitutil
from .registry import Registry


def resolve_worktree(path: str | Path) -> Path:
    candidate = Path(path).expanduser()
    if not candidate.exists():
        raise ControlPlaneError(f"unknown worktree: {candidate}", exit_code=2)
    try:
        return gitutil.top_level(candidate)
    except ControlPlaneError as exc:
        raise ControlPlaneError(f"unknown worktree: {candidate}", exit_code=2) from exc


def manifest_path(worktree: str | Path) -> Path:
    try:
        return gitutil.admin_dir(worktree) / "clarity-owner.json"
    except ControlPlaneError as exc:
        raise ControlPlaneError(f"unknown worktree: {worktree}", exit_code=2) from exc


def _write_manifest(path: Path, payload: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        temporary.write_text(
            json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        os.replace(temporary, path)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


def is_live(row: object, now=None) -> bool:
    current = now or utc_now()
    try:
        return parse_utc(row["expires_at"]) > current  # type: ignore[index]
    except (KeyError, TypeError, ValueError):
        return False


def claim(
    worktree: str | Path,
    *,
    session: str,
    ttl: int = 3600,
    takeover: bool = False,
    actor: str | None = None,
    config: Config | None = None,
    pid: int | None = None,
) -> dict[str, object]:
    if ttl <= 0:
        raise ControlPlaneError("ttl must be greater than zero")
    current = config or load_config()
    root = resolve_worktree(worktree)
    root_text = str(root)
    branch = gitutil.branch(root)
    if not branch:
        raise ControlPlaneError(f"worktree has detached HEAD: {root}", exit_code=2)
    common = str(gitutil.common_dir(root))
    actor_name = actor or getpass.getuser()
    owner_pid = os.getpid() if pid is None else pid
    host = socket.gethostname()
    now = utc_now()
    now_text = iso_utc(now)
    expires = iso_utc(now + timedelta(seconds=ttl))

    with Registry(current) as registry:
        with registry.transaction() as db:
            previous = db.execute(
                "SELECT * FROM worktree_lease WHERE worktree_path=?", (root_text,)
            ).fetchone()
            previous_live = previous is not None and is_live(previous, now)
            if previous_live and previous["owner_session"] != session and not takeover:
                raise ControlPlaneError(
                    f"worktree is owned by session {previous['owner_session']} "
                    f"(actor {previous['owner_actor']}, pid {previous['owner_pid']})",
                    exit_code=3,
                    detail={"owner_session": previous["owner_session"], "worktree": root_text},
                )

            if takeover:
                lease_token = str(uuid.uuid4())
                claimed_at = now_text
            elif previous_live and previous["owner_session"] == session:
                lease_token = previous["lease_token"]
                claimed_at = previous["claimed_at"]
            else:
                lease_token = str(uuid.uuid4())
                claimed_at = now_text

            payload: dict[str, object] = {
                "worktree": root_text,
                "branch": branch,
                "git_common_dir": common,
                "session": session,
                "actor": actor_name,
                "pid": owner_pid,
                "host": host,
                "lease_token": lease_token,
                "claimed_at": claimed_at,
                "expires_at": expires,
            }
            db.execute(
                """INSERT INTO worktree_lease(
                     worktree_path, branch, git_common_dir, owner_session, owner_actor,
                     owner_pid, host, lease_token, claimed_at, heartbeat_at, expires_at
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(worktree_path) DO UPDATE SET
                     branch=excluded.branch,
                     git_common_dir=excluded.git_common_dir,
                     owner_session=excluded.owner_session,
                     owner_actor=excluded.owner_actor,
                     owner_pid=excluded.owner_pid,
                     host=excluded.host,
                     lease_token=excluded.lease_token,
                     claimed_at=excluded.claimed_at,
                     heartbeat_at=excluded.heartbeat_at,
                     expires_at=excluded.expires_at""",
                (
                    root_text,
                    branch,
                    common,
                    session,
                    actor_name,
                    owner_pid,
                    host,
                    lease_token,
                    claimed_at,
                    now_text,
                    expires,
                ),
            )
            _write_manifest(manifest_path(root), payload)

            if takeover and previous is not None:
                kind = "lease_takeover"
                detail = {
                    "previous_owner": previous["owner_session"],
                    "previous_actor": previous["owner_actor"],
                    "previous_pid": previous["owner_pid"],
                    "new_owner": session,
                    "new_actor": actor_name,
                    "new_pid": owner_pid,
                }
            else:
                kind = "lease_claimed"
                detail = {"ttl": ttl, "replaced_stale": previous is not None and not previous_live}
            registry.insert_event(
                db,
                kind=kind,
                session=session,
                actor=actor_name,
                worktree=root_text,
                branch=branch,
                pid=owner_pid,
                detail=detail,
            )
    return payload


def release(
    worktree: str | Path,
    *,
    session: str,
    config: Config | None = None,
) -> dict[str, object]:
    current = config or load_config()
    root = resolve_worktree(worktree)
    root_text = str(root)
    try:
        registry_context = Registry(current, create=False)
        with registry_context as registry:
            with registry.transaction() as db:
                row = db.execute(
                    "SELECT * FROM worktree_lease WHERE worktree_path=?", (root_text,)
                ).fetchone()
                if row is None:
                    raise ControlPlaneError(f"worktree has no lease: {root}", exit_code=2)
                if row["owner_session"] != session:
                    raise ControlPlaneError(
                        f"worktree is owned by session {row['owner_session']}", exit_code=3
                    )
                try:
                    manifest_path(root).unlink()
                except FileNotFoundError:
                    pass
                db.execute("DELETE FROM worktree_lease WHERE worktree_path=?", (root_text,))
                registry.insert_event(
                    db,
                    kind="lease_released",
                    session=session,
                    actor=row["owner_actor"],
                    worktree=root_text,
                    branch=row["branch"],
                    pid=row["owner_pid"],
                    detail={"lease_token": row["lease_token"]},
                )
    except ControlPlaneError:
        raise
    return {"worktree": root_text, "session": session, "released": True}


def heartbeat(
    worktree: str | Path,
    *,
    session: str,
    ttl: int = 3600,
    config: Config | None = None,
) -> dict[str, object]:
    if ttl <= 0:
        raise ControlPlaneError("ttl must be greater than zero")
    current = config or load_config()
    root = resolve_worktree(worktree)
    root_text = str(root)
    now = utc_now()
    heartbeat_at = iso_utc(now)
    expires_at = iso_utc(now + timedelta(seconds=ttl))
    with Registry(current, create=False) as registry:
        with registry.transaction() as db:
            row = db.execute(
                "SELECT * FROM worktree_lease WHERE worktree_path=?", (root_text,)
            ).fetchone()
            if row is None:
                raise ControlPlaneError(f"worktree has no lease: {root}", exit_code=2)
            if row["owner_session"] != session:
                raise ControlPlaneError(
                    f"worktree is owned by session {row['owner_session']}", exit_code=3
                )
            if not is_live(row, now):
                raise ControlPlaneError("lease is stale; claim the worktree again", exit_code=3)
            db.execute(
                "UPDATE worktree_lease SET heartbeat_at=?, expires_at=? WHERE worktree_path=?",
                (heartbeat_at, expires_at, root_text),
            )
            payload = {
                "worktree": root_text,
                "branch": row["branch"],
                "git_common_dir": row["git_common_dir"],
                "session": row["owner_session"],
                "actor": row["owner_actor"],
                "pid": row["owner_pid"],
                "host": row["host"],
                "lease_token": row["lease_token"],
                "claimed_at": row["claimed_at"],
                "expires_at": expires_at,
            }
            _write_manifest(manifest_path(root), payload)
            registry.insert_event(
                db,
                kind="lease_heartbeat",
                session=session,
                actor=row["owner_actor"],
                worktree=root_text,
                branch=row["branch"],
                pid=row["owner_pid"],
                detail={"ttl": ttl, "expires_at": expires_at},
            )
    return payload


def guard(
    worktree: str | Path,
    *,
    session: str,
    mode: str = "write",
    config: Config | None = None,
) -> dict[str, object]:
    current = config or load_config()
    root = resolve_worktree(worktree)
    if mode == "read":
        return {"worktree": str(root), "session": session, "mode": mode, "allowed": True}
    try:
        with Registry(current, create=False, read_only=True) as registry:
            row = registry.lease(str(root))
    except ControlPlaneError as exc:
        if exc.exit_code == 2:
            raise ControlPlaneError("write refused: worktree has no live owner", exit_code=3) from exc
        raise
    if row is None or not is_live(row):
        raise ControlPlaneError("write refused: worktree has no live owner", exit_code=3)
    if row["owner_session"] != session:
        raise ControlPlaneError(
            f"write refused: worktree is owned by session {row['owner_session']}",
            exit_code=3,
        )
    return {"worktree": str(root), "session": session, "mode": mode, "allowed": True}


def status(config: Config | None = None) -> dict[str, object]:
    current = config or load_config()
    if not current.database_path.is_file():
        return {"leases": [], "live_count": 0, "stale_count": 0}
    with Registry(current, create=False, read_only=True) as registry:
        rows = []
        for record in registry.leases():
            row = dict(record)
            row["status"] = "live" if is_live(record) else "stale"
            rows.append(row)
    return {
        "leases": rows,
        "live_count": sum(row["status"] == "live" for row in rows),
        "stale_count": sum(row["status"] == "stale" for row in rows),
    }


def manifest_divergences(config: Config | None = None) -> list[dict[str, object]]:
    current = config or load_config()
    if not current.database_path.is_file():
        return []
    divergences: list[dict[str, object]] = []
    with Registry(current, create=False, read_only=True) as registry:
        for row in registry.leases():
            expected = {
                "worktree": row["worktree_path"],
                "branch": row["branch"],
                "git_common_dir": row["git_common_dir"],
                "session": row["owner_session"],
                "actor": row["owner_actor"],
                "pid": row["owner_pid"],
                "host": row["host"],
                "lease_token": row["lease_token"],
                "claimed_at": row["claimed_at"],
                "expires_at": row["expires_at"],
            }
            try:
                actual = json.loads(manifest_path(row["worktree_path"]).read_text(encoding="utf-8"))
            except (OSError, ValueError, ControlPlaneError) as exc:
                divergences.append({"worktree": row["worktree_path"], "error": str(exc)})
                continue
            mismatches = sorted(key for key, value in expected.items() if actual.get(key) != value)
            if mismatches:
                divergences.append({"worktree": row["worktree_path"], "mismatched_fields": mismatches})
    return divergences
