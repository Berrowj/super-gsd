"""Command-line interface for the Clarity Control Plane."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

from . import ControlPlaneError
from . import anchors, deploy, gitutil, guard, jobs
from .config import Config, load_config
from .registry import Registry, SCHEMA_VERSION


class Parser(argparse.ArgumentParser):
    def error(self, message: str) -> None:
        self.print_usage(sys.stderr)
        self.exit(1, f"{self.prog}: error: {message}\n")


def build_parser() -> argparse.ArgumentParser:
    parser = Parser(prog="clarity-cp", description="Clarity Control Plane")
    commands = parser.add_subparsers(dest="command", required=True, parser_class=Parser)

    doctor_parser = commands.add_parser("doctor", help="run host safety checks")
    doctor_parser.add_argument("--json", action="store_true")

    anchors_parser = commands.add_parser("anchors", help="report worktree anchors")
    anchors_parser.add_argument("--json", action="store_true")

    status_parser = commands.add_parser("status", help="report worktree ownership leases")
    status_parser.add_argument("--json", action="store_true")

    claim_parser = commands.add_parser("claim", help="claim a worktree")
    claim_parser.add_argument("worktree")
    claim_parser.add_argument("--session", required=True)
    claim_parser.add_argument("--ttl", type=int, default=3600)
    claim_parser.add_argument("--takeover", action="store_true")
    claim_parser.add_argument("--actor")

    release_parser = commands.add_parser("release", help="release a worktree")
    release_parser.add_argument("worktree")
    release_parser.add_argument("--session", required=True)

    heartbeat_parser = commands.add_parser("heartbeat", help="renew a worktree lease")
    heartbeat_parser.add_argument("worktree")
    heartbeat_parser.add_argument("--session", required=True)
    heartbeat_parser.add_argument("--ttl", type=int, default=3600)

    guard_parser = commands.add_parser("guard", help="authorize worktree access")
    guard_parser.add_argument("worktree")
    guard_parser.add_argument("--session", required=True)
    guard_parser.add_argument("--mode", choices=("read", "write"), default="write")

    jobs_parser = commands.add_parser("jobs", help="manage long-running jobs")
    jobs_commands = jobs_parser.add_subparsers(dest="jobs_command", required=True, parser_class=Parser)
    register_parser = jobs_commands.add_parser("register")
    register_parser.add_argument("--id", required=True)
    register_parser.add_argument("--kind", required=True)
    register_parser.add_argument("--service")
    register_parser.add_argument("--pid", type=int)
    register_parser.add_argument("--resumable", action="store_true")
    register_parser.add_argument("--checkpoint")
    register_parser.add_argument("--interrupt-cost")
    register_parser.add_argument("--session")
    list_parser = jobs_commands.add_parser("list")
    list_parser.add_argument("--json", action="store_true")
    finish_parser = jobs_commands.add_parser("finish")
    finish_parser.add_argument("--id", required=True)
    finish_parser.add_argument("--state", choices=("done", "failed"), default="done")

    deploy_parser = commands.add_parser("deploy", help="deploy safety operations")
    deploy_commands = deploy_parser.add_subparsers(
        dest="deploy_command", required=True, parser_class=Parser
    )
    preflight_parser = deploy_commands.add_parser("preflight")
    preflight_parser.add_argument("--expected-sha", required=True)
    preflight_parser.add_argument("--services", default=" ".join(deploy.DEFAULT_SERVICES))
    preflight_parser.add_argument("--allow-interrupt", action="store_true")
    preflight_parser.add_argument("--json", action="store_true")
    return parser


def _check(name: str, status: str, message: str, **details: object) -> dict[str, object]:
    item: dict[str, object] = {"name": name, "status": status, "message": message}
    if details:
        item["details"] = details
    return item


def _allowed_untracked(path: str) -> bool:
    if path in {".nightly.env", ".env", ".deploy.lock", "scripts/mobile-browser-check.mjs"}:
        return True
    if path.startswith("reports/") or path.startswith("logs/"):
        return True
    return bool(re.fullmatch(r"run-[a-z-]+\.sh|deploy_[a-z]+\.sh", path))


def _deploy_dirty_entries(config: Config) -> list[str]:
    result = gitutil.run_git(config.deploy_checkout, ("status", "--porcelain"), check=False)
    if result.returncode != 0:
        raise ControlPlaneError(result.stderr.strip() or "git status failed")
    dirty = []
    for line in result.stdout.splitlines():
        if line.startswith("?? ") and _allowed_untracked(line[3:]):
            continue
        if line:
            dirty.append(line)
    return dirty


def _is_local_remote(url: str) -> bool:
    expanded = os.path.expanduser(url)
    if url.startswith(("/", "./", "../", "~/", "file://")):
        return True
    if re.match(r"^[A-Za-z]:[\\/]", url):
        return True
    return Path(expanded).exists() and "://" not in url and not re.match(r"^[^/]+@[^:]+:", url)


def _nearest_existing(path: Path) -> Path:
    current = path
    while not current.exists() and current != current.parent:
        current = current.parent
    return current


def _script_drift(left: Path, right: Path) -> tuple[int, list[str]]:
    def files(root: Path) -> dict[str, Path]:
        if not root.is_dir():
            return {}
        return {
            str(path.relative_to(root)): path
            for path in root.rglob("*")
            if path.is_file()
        }

    left_files = files(left)
    right_files = files(right)
    changed = []
    for relative in sorted(set(left_files) | set(right_files)):
        if relative not in left_files or relative not in right_files:
            changed.append(relative)
            continue
        try:
            if left_files[relative].read_bytes() != right_files[relative].read_bytes():
                changed.append(relative)
        except OSError:
            changed.append(relative)
    return len(changed), changed


def doctor_report(config: Config | None = None) -> tuple[dict[str, object], int]:
    current = config or load_config()
    checks: list[dict[str, object]] = []

    try:
        canonical_common = anchors.canonical_common_dir(current)
        checks.append(
            _check(
                "canonical_repo",
                "ok",
                f"canonical repo resolves to git common dir {canonical_common}",
                common_dir=canonical_common,
            )
        )
    except (ControlPlaneError, OSError) as exc:
        canonical_common = None
        checks.append(_check("canonical_repo", "error", f"canonical repo is unavailable: {exc}"))

    anchor_rows = anchors.scan(current)
    foreign = [row for row in anchor_rows if row.get("common_dir") and not row["anchored_canonically"]]
    broken = [row for row in anchor_rows if row.get("error")]
    if foreign or broken:
        parts = []
        if foreign:
            parts.append(f"{len(foreign)} foreign-anchored worktree(s)")
        if broken:
            parts.append(f"{len(broken)} broken worktree entry(s)")
        checks.append(
            _check(
                "split_brain",
                "warn",
                "; ".join(parts),
                foreign=foreign,
                broken=broken,
            )
        )
    else:
        checks.append(_check("split_brain", "ok", "all discovered worktrees use the canonical anchor"))

    try:
        deploy_branch = gitutil.branch(current.deploy_checkout)
        dirty = _deploy_dirty_entries(current)
        problems = []
        if deploy_branch != current.trusted_branch:
            problems.append(f"branch is {deploy_branch or 'detached'}, expected {current.trusted_branch}")
        if dirty:
            problems.append(f"{len(dirty)} non-allowlisted dirty entr{'y' if len(dirty) == 1 else 'ies'}")
        if problems:
            checks.append(
                _check(
                    "deploy_checkout",
                    "error",
                    "; ".join(problems),
                    branch=deploy_branch,
                    dirty=dirty,
                )
            )
        else:
            checks.append(
                _check(
                    "deploy_checkout",
                    "ok",
                    f"deploy checkout is clean on {current.trusted_branch}",
                )
            )
    except (ControlPlaneError, OSError) as exc:
        checks.append(_check("deploy_checkout", "error", f"deploy checkout is unavailable: {exc}"))

    hook_dir = current.deploy_checkout / ".git/hooks"
    hook_state = {}
    missing_hooks = []
    for hook_name in ("pre-commit", "pre-merge-commit"):
        hook_path = hook_dir / hook_name
        installed = hook_path.is_file() and os.access(hook_path, os.X_OK)
        hook_state[hook_name] = {"path": str(hook_path), "installed_executable": installed}
        if not installed:
            missing_hooks.append(hook_name)
    if missing_hooks:
        checks.append(
            _check(
                "deploy_hooks",
                "error",
                f"missing or non-executable hook(s): {', '.join(missing_hooks)}",
                hooks=hook_state,
            )
        )
    else:
        checks.append(_check("deploy_hooks", "ok", "pre-commit and pre-merge-commit are executable"))

    local_remotes = []
    remotes_result = gitutil.run_git(current.deploy_checkout, ("remote",), check=False)
    if remotes_result.returncode == 0:
        for remote in remotes_result.stdout.split():
            urls = gitutil.run_git(
                current.deploy_checkout, ("remote", "get-url", "--all", remote), check=False
            )
            for url in urls.stdout.splitlines():
                if _is_local_remote(url.strip()):
                    local_remotes.append({"remote": remote, "url": url.strip()})
    if local_remotes:
        rendered = ", ".join(f"{item['remote']} -> {item['url']}" for item in local_remotes)
        checks.append(
            _check(
                "deploy_remotes",
                "warn",
                f"local filesystem remote(s): {rendered}",
                remotes=local_remotes,
            )
        )
    elif remotes_result.returncode != 0:
        checks.append(_check("deploy_remotes", "error", "could not inspect deploy checkout remotes"))
    else:
        checks.append(_check("deploy_remotes", "ok", "deploy checkout has no local filesystem remotes"))

    trusted_ref = f"{current.trusted_remote}/{current.trusted_branch}"
    reachable = gitutil.run_git(
        current.deploy_checkout, ("merge-base", "--is-ancestor", "HEAD", trusted_ref), check=False
    )
    if reachable.returncode == 0:
        checks.append(_check("deploy_head_remote", "ok", f"deploy HEAD is reachable from {trusted_ref}"))
    else:
        checks.append(
            _check(
                "deploy_head_remote",
                "error",
                f"deploy HEAD is not reachable from {trusted_ref}; live may be ahead of every remote",
            )
        )

    if current.database_path.is_file():
        try:
            with Registry(current, create=False, read_only=True) as registry:
                version = registry.schema_version
            writable = os.access(current.state_dir, os.W_OK)
            if writable:
                checks.append(
                    _check(
                        "registry",
                        "ok",
                        f"registry schema version {version} is current and state dir is writable",
                    )
                )
            else:
                checks.append(_check("registry", "error", "registry state dir is not writable"))
        except (ControlPlaneError, OSError) as exc:
            checks.append(_check("registry", "error", f"registry check failed: {exc}"))
    else:
        parent = _nearest_existing(current.state_dir)
        if current.state_dir.exists() and not current.state_dir.is_dir():
            checks.append(
                _check("registry", "error", f"state dir path is not a directory: {current.state_dir}")
            )
        elif os.access(parent, os.W_OK):
            checks.append(
                _check(
                    "registry",
                    "ok",
                    f"registry is not initialized; schema {SCHEMA_VERSION} will be created lazily",
                )
            )
        else:
            checks.append(_check("registry", "error", f"state dir parent is not writable: {parent}"))

    try:
        lease_status = guard.status(current)
        divergences = guard.manifest_divergences(current)
        stale_leases = int(lease_status["stale_count"])
        if stale_leases or divergences:
            message = f"{stale_leases} stale lease(s), {len(divergences)} registry/manifest divergence(s)"
            checks.append(
                _check(
                    "leases",
                    "warn",
                    message,
                    stale_count=stale_leases,
                    manifest_divergences=divergences,
                )
            )
        else:
            checks.append(_check("leases", "ok", "no stale leases or manifest divergence"))
    except (ControlPlaneError, OSError) as exc:
        checks.append(_check("leases", "error", f"lease check failed: {exc}"))

    try:
        job_status = jobs.list_jobs(current)
        stale_jobs = int(job_status["stale_count"])
        if stale_jobs:
            checks.append(_check("jobs", "warn", f"{stale_jobs} running job(s) have stale heartbeats"))
        else:
            checks.append(_check("jobs", "ok", "no stale running jobs"))
    except (ControlPlaneError, OSError) as exc:
        checks.append(_check("jobs", "error", f"job check failed: {exc}"))

    drift_count, drift_files = _script_drift(
        current.source_root / "scripts", current.sgsd_deployed / "scripts"
    )
    if drift_count:
        checks.append(
            _check(
                "sgsd_drift",
                "warn",
                f"{drift_count} script file(s) differ or exist on only one side",
                files=drift_files,
            )
        )
    else:
        checks.append(_check("sgsd_drift", "ok", "deployed SGSD scripts match this repository"))

    error_count = sum(check["status"] == "error" for check in checks)
    warning_count = sum(check["status"] == "warn" for check in checks)
    exit_code = 2 if error_count else (5 if warning_count else 0)
    result = {
        "ok": exit_code == 0,
        "status": "error" if error_count else ("warn" if warning_count else "ok"),
        "exit_code": exit_code,
        "summary": {"ok": len(checks) - error_count - warning_count, "warn": warning_count, "error": error_count},
        "checks": checks,
    }
    return result, exit_code


def _print_json(value: object) -> None:
    print(json.dumps(value, sort_keys=True, separators=(",", ":")))


def _print_table(rows: list[list[object]], headers: list[str]) -> None:
    widths = [len(header) for header in headers]
    rendered = [["" if value is None else str(value) for value in row] for row in rows]
    for row in rendered:
        for index, value in enumerate(row):
            widths[index] = max(widths[index], len(value))
    print("  ".join(header.ljust(widths[index]) for index, header in enumerate(headers)))
    print("  ".join("-" * width for width in widths))
    for row in rendered:
        print("  ".join(value.ljust(widths[index]) for index, value in enumerate(row)))


def _print_doctor(result: dict[str, object]) -> None:
    print("Clarity Control Plane doctor")
    for check in result["checks"]:  # type: ignore[index]
        marker = {"ok": "OK", "warn": "WARN", "error": "ERROR"}[check["status"]]
        print(f"[{marker}] {check['name']}: {check['message']}")
        details = check.get("details", {})
        if check["name"] == "split_brain":
            for row in details.get("foreign", []):
                print(f"       {row['path']} ({row.get('branch') or 'detached'}) -> {row['common_dir']}")
        if check["name"] == "leases":
            for row in details.get("manifest_divergences", []):
                print(f"       manifest divergence: {row['worktree']}")
    summary = result["summary"]
    print(f"Overall: {str(result['status']).upper()} ({summary['error']} error, {summary['warn']} warning)")


def _print_jobs_table(rows: list[dict[str, object]]) -> None:
    _print_table(
        [
            [
                row["job_id"],
                row["kind"],
                row.get("service"),
                row["age"],
                "yes" if row["resumable"] else "no",
                row.get("checkpoint"),
                row.get("interrupt_cost"),
            ]
            for row in rows
        ],
        ["JOB ID", "KIND", "SERVICE", "AGE", "RESUMABLE", "CHECKPOINT", "INTERRUPT COST"],
    )


def dispatch(args: argparse.Namespace) -> int:
    config = load_config()
    if args.command == "doctor":
        result, exit_code = doctor_report(config)
        _print_json(result) if args.json else _print_doctor(result)
        return exit_code
    if args.command == "anchors":
        result = anchors.report(config)
        if args.json:
            _print_json(result)
        else:
            print(f"Canonical common dir: {result['canonical_common_dir'] or 'UNRESOLVED'}")
            rows = [
                [row["path"], row.get("branch"), row.get("common_dir"), "yes" if row["anchored_canonically"] else "no"]
                for row in result["worktrees"]
            ]
            _print_table(rows, ["WORKTREE", "BRANCH", "COMMON DIR", "CANONICAL"])
            print(f"Split-brain worktrees: {result['split_brain_count']}")
        return 2 if result.get("error") else 0
    if args.command == "status":
        result = guard.status(config)
        if args.json:
            _print_json(result)
        else:
            rows = [
                [row["worktree_path"], row["branch"], row["owner_session"], row["owner_actor"], row["expires_at"], row["status"]]
                for row in result["leases"]
            ]
            _print_table(rows, ["WORKTREE", "BRANCH", "SESSION", "ACTOR", "EXPIRES", "STATUS"])
            print(f"Leases: {result['live_count']} live, {result['stale_count']} stale")
        return 0
    if args.command == "claim":
        result = guard.claim(
            args.worktree,
            session=args.session,
            ttl=args.ttl,
            takeover=args.takeover,
            actor=args.actor,
            config=config,
        )
        print(f"CLAIMED {result['worktree']} for {result['session']} until {result['expires_at']}")
        print(f"lease_token={result['lease_token']}")
        return 0
    if args.command == "release":
        result = guard.release(args.worktree, session=args.session, config=config)
        print(f"RELEASED {result['worktree']} from {result['session']}")
        return 0
    if args.command == "heartbeat":
        result = guard.heartbeat(args.worktree, session=args.session, ttl=args.ttl, config=config)
        print(f"HEARTBEAT {result['worktree']} for {result['session']} until {result['expires_at']}")
        return 0
    if args.command == "guard":
        result = guard.guard(args.worktree, session=args.session, mode=args.mode, config=config)
        print(f"ALLOW {result['mode']} {result['worktree']} session={result['session']}")
        return 0
    if args.command == "jobs" and args.jobs_command == "register":
        result = jobs.register(
            job_id=args.id,
            kind=args.kind,
            service=args.service,
            session=args.session,
            pid=args.pid,
            resumable=args.resumable,
            checkpoint=args.checkpoint,
            interrupt_cost=args.interrupt_cost,
            config=config,
        )
        print(f"REGISTERED job {result['job_id']} ({result['kind']}) state={result['state']}")
        return 0
    if args.command == "jobs" and args.jobs_command == "list":
        result = jobs.list_jobs(config)
        if args.json:
            _print_json(result)
        else:
            _print_jobs_table(result["jobs"])
            print(f"Jobs: {result['running_count']} running, {result['stale_count']} stale")
        return 0
    if args.command == "jobs" and args.jobs_command == "finish":
        result = jobs.finish(args.id, args.state, config)
        print(f"FINISHED job {result['job_id']} state={result['state']}")
        return 0
    if args.command == "deploy" and args.deploy_command == "preflight":
        targets = args.services.split()
        if not targets:
            raise ControlPlaneError("services must contain at least one service")
        result = deploy.preflight(args.expected_sha, targets, args.allow_interrupt, config)
        if args.json:
            _print_json(result)
        else:
            for warning in result["warnings"]:
                print(warning)
            if result["interrupted_jobs"]:
                print("ALLOW-INTERRUPT: the following running jobs are deliberately at risk")
                _print_jobs_table(result["interrupted_jobs"])
            print(f"PREFLIGHT PASS: {result['expected_sha']} is reachable from {result['trusted_ref']}")
            print(f"intent_id={result['intent_id']} state=planned")
        return 0
    raise ControlPlaneError("unsupported command")


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    try:
        args = parser.parse_args(argv)
        return dispatch(args)
    except ControlPlaneError as exc:
        wants_json = bool("args" in locals() and getattr(args, "json", False))
        if wants_json:
            if isinstance(exc.detail, dict):
                payload = dict(exc.detail)
                payload.setdefault("message", exc.message)
                payload["exit_code"] = exc.exit_code
            else:
                payload = {"ok": False, "exit_code": exc.exit_code, "message": exc.message}
            _print_json(payload)
        else:
            if isinstance(exc.detail, dict):
                for warning in exc.detail.get("warnings", []):
                    print(warning)
                impacted = exc.detail.get("jobs", [])
                if impacted:
                    print("The following running jobs would be destroyed:")
                    _print_jobs_table(impacted)
            print(f"ERROR: {exc.message}")
        return exc.exit_code
    except Exception as exc:  # stable CLI boundary; tests exercise expected paths above
        wants_json = bool("args" in locals() and getattr(args, "json", False))
        if wants_json:
            _print_json({"ok": False, "exit_code": 1, "message": str(exc)})
        else:
            print(f"ERROR: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
