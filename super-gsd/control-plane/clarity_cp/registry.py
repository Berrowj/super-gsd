"""SQLite registry for leases, jobs, deploy intents, and audit events."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Sequence

from . import ControlPlaneError, iso_utc
from .config import Config, load_config

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE schema_version (version INTEGER NOT NULL);

CREATE TABLE worktree_lease (
  worktree_path  TEXT PRIMARY KEY,
  branch         TEXT NOT NULL,
  git_common_dir TEXT NOT NULL,
  owner_session  TEXT NOT NULL,
  owner_actor    TEXT NOT NULL,
  owner_pid      INTEGER,
  host           TEXT NOT NULL,
  lease_token    TEXT NOT NULL,
  claimed_at     TEXT NOT NULL,
  heartbeat_at   TEXT NOT NULL,
  expires_at     TEXT NOT NULL
);

CREATE TABLE job (
  job_id        TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,
  service       TEXT,
  owner_session TEXT,
  pid           INTEGER,
  started_at    TEXT NOT NULL,
  heartbeat_at  TEXT NOT NULL,
  resumable     INTEGER NOT NULL DEFAULT 0,
  checkpoint    TEXT,
  interrupt_cost TEXT,
  state         TEXT NOT NULL DEFAULT 'running'
);

CREATE TABLE deploy_intent (
  intent_id    TEXT PRIMARY KEY,
  expected_sha TEXT NOT NULL,
  services     TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  state        TEXT NOT NULL
);

CREATE TABLE event (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        TEXT NOT NULL,
  kind      TEXT NOT NULL,
  session   TEXT,
  actor     TEXT,
  worktree  TEXT,
  branch    TEXT,
  pid       INTEGER,
  detail    TEXT
);
"""


class Registry:
    """A WAL-backed registry. Read-only opens never create state."""

    def __init__(
        self,
        config: Config | None = None,
        *,
        create: bool = True,
        read_only: bool = False,
    ) -> None:
        self.config = config or load_config()
        self.create = create
        self.read_only = read_only
        self.path = self.config.database_path
        self.connection: sqlite3.Connection | None = None

    def __enter__(self) -> "Registry":
        if self.create:
            self.config.state_dir.mkdir(parents=True, exist_ok=True)
        elif not self.path.is_file():
            raise ControlPlaneError("registry is not initialized", exit_code=2)

        if self.read_only:
            connection = sqlite3.connect(
                f"{self.path.resolve().as_uri()}?mode=ro",
                timeout=5.0,
                isolation_level=None,
                uri=True,
            )
        else:
            connection = sqlite3.connect(
                str(self.path), timeout=5.0, isolation_level=None
            )
        try:
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA busy_timeout=5000")
            connection.execute("PRAGMA foreign_keys=ON")
            mode = connection.execute("PRAGMA journal_mode=WAL").fetchone()[0]
            if str(mode).lower() != "wal":
                raise ControlPlaneError(f"registry could not enable WAL mode (got {mode})")
            self.connection = connection
            if self.create:
                self._migrate()
            else:
                self._validate_schema()
        except Exception:
            connection.close()
            self.connection = None
            raise
        return self

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        if self.connection is not None:
            self.connection.close()
            self.connection = None

    @property
    def db(self) -> sqlite3.Connection:
        if self.connection is None:
            raise RuntimeError("registry is not open")
        return self.connection

    def _table_exists(self, table: str) -> bool:
        row = self.db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table,)
        ).fetchone()
        return row is not None

    def _migrate(self) -> None:
        if not self._table_exists("schema_version"):
            with self.transaction():
                for statement in SCHEMA.split(";"):
                    if statement.strip():
                        self.db.execute(statement)
                self.db.execute(
                    "INSERT INTO schema_version(version) VALUES (?)", (SCHEMA_VERSION,)
                )
        self._validate_schema()

    def _validate_schema(self) -> None:
        if not self._table_exists("schema_version"):
            raise ControlPlaneError("registry schema is missing", exit_code=2)
        row = self.db.execute("SELECT version FROM schema_version").fetchone()
        version = int(row[0]) if row else -1
        if version != SCHEMA_VERSION:
            raise ControlPlaneError(
                f"registry schema version {version} does not match {SCHEMA_VERSION}",
                exit_code=2,
            )

    @property
    def schema_version(self) -> int:
        row = self.db.execute("SELECT version FROM schema_version").fetchone()
        return int(row[0])

    @contextmanager
    def transaction(self) -> Iterator[sqlite3.Connection]:
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield self.db
        except Exception:
            self.db.execute("ROLLBACK")
            raise
        else:
            self.db.execute("COMMIT")

    @staticmethod
    def _detail(value: object) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            return value
        return json.dumps(value, sort_keys=True, separators=(",", ":"))

    def insert_event(
        self,
        db: sqlite3.Connection,
        *,
        kind: str,
        session: str | None = None,
        actor: str | None = None,
        worktree: str | None = None,
        branch: str | None = None,
        pid: int | None = None,
        detail: object = None,
    ) -> None:
        db.execute(
            """INSERT INTO event(ts, kind, session, actor, worktree, branch, pid, detail)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                iso_utc(),
                kind,
                session,
                actor,
                worktree,
                branch,
                pid,
                self._detail(detail),
            ),
        )

    def lease(self, worktree_path: str) -> sqlite3.Row | None:
        return self.db.execute(
            "SELECT * FROM worktree_lease WHERE worktree_path=?", (worktree_path,)
        ).fetchone()

    def leases(self) -> list[sqlite3.Row]:
        return list(self.db.execute("SELECT * FROM worktree_lease ORDER BY worktree_path"))

    def jobs(self, *, state: str | None = None) -> list[sqlite3.Row]:
        if state is None:
            query, params = "SELECT * FROM job ORDER BY started_at, job_id", ()
        else:
            query, params = (
                "SELECT * FROM job WHERE state=? ORDER BY started_at, job_id",
                (state,),
            )
        return list(self.db.execute(query, params))

    def register_job(
        self,
        *,
        job_id: str,
        kind: str,
        service: str | None,
        session: str | None,
        pid: int | None,
        resumable: bool,
        checkpoint: str | None,
        interrupt_cost: str | None,
    ) -> dict[str, object]:
        now = iso_utc()
        try:
            with self.transaction() as db:
                db.execute(
                    """INSERT INTO job(
                         job_id, kind, service, owner_session, pid, started_at,
                         heartbeat_at, resumable, checkpoint, interrupt_cost, state
                       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'running')""",
                    (
                        job_id,
                        kind,
                        service,
                        session,
                        pid,
                        now,
                        now,
                        int(resumable),
                        checkpoint,
                        interrupt_cost,
                    ),
                )
                self.insert_event(
                    db,
                    kind="job_registered",
                    session=session,
                    pid=pid,
                    detail={"job_id": job_id, "kind": kind, "service": service},
                )
        except sqlite3.IntegrityError as exc:
            raise ControlPlaneError(f"job {job_id} already exists", exit_code=3) from exc
        return dict(self.db.execute("SELECT * FROM job WHERE job_id=?", (job_id,)).fetchone())

    def finish_job(self, job_id: str, state: str) -> dict[str, object]:
        current = self.db.execute("SELECT * FROM job WHERE job_id=?", (job_id,)).fetchone()
        if current is None:
            raise ControlPlaneError(f"unknown job: {job_id}", exit_code=2)
        with self.transaction() as db:
            db.execute("UPDATE job SET state=?, heartbeat_at=? WHERE job_id=?", (state, iso_utc(), job_id))
            self.insert_event(
                db,
                kind="job_finished",
                session=current["owner_session"],
                pid=current["pid"],
                detail={"job_id": job_id, "previous_state": current["state"], "state": state},
            )
        return dict(self.db.execute("SELECT * FROM job WHERE job_id=?", (job_id,)).fetchone())

    def plan_deploy(
        self,
        *,
        expected_sha: str,
        services: Sequence[str],
        requested_by: str,
        interrupted_jobs: Sequence[dict[str, object]],
    ) -> str:
        intent_id = str(uuid.uuid4())
        event_kind = "deploy_preflight_interrupt_allowed" if interrupted_jobs else "deploy_preflight_planned"
        detail = {
            "intent_id": intent_id,
            "expected_sha": expected_sha,
            "services": list(services),
            "interrupted_jobs": [job["job_id"] for job in interrupted_jobs],
        }
        with self.transaction() as db:
            db.execute(
                """INSERT INTO deploy_intent(
                     intent_id, expected_sha, services, requested_by, created_at, state
                   ) VALUES (?, ?, ?, ?, ?, 'planned')""",
                (
                    intent_id,
                    expected_sha,
                    json.dumps(list(services), separators=(",", ":")),
                    requested_by,
                    iso_utc(),
                ),
            )
            self.insert_event(db, kind=event_kind, actor=requested_by, detail=detail)
        return intent_id

    def events(self, *, kind: str | None = None) -> list[sqlite3.Row]:
        if kind is None:
            return list(self.db.execute("SELECT * FROM event ORDER BY id"))
        return list(self.db.execute("SELECT * FROM event WHERE kind=? ORDER BY id", (kind,)))
