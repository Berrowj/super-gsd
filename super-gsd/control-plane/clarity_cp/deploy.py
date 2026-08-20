"""Commit-pinned deploy preflight. This module never deploys."""

from __future__ import annotations

import getpass
import json
from pathlib import Path

from . import ControlPlaneError
from .config import Config, load_config
from . import gitutil, jobs
from .registry import Registry

DEFAULT_SERVICES = ["clarity-python-api", "clarity-api-background", "frontend"]


def _last_passing_sha(log_path: Path) -> str | None:
    latest = None
    try:
        with log_path.open("r", encoding="utf-8") as handle:
            for line in handle:
                try:
                    row = json.loads(line)
                except (ValueError, TypeError):
                    continue
                if isinstance(row, dict) and row.get("result") == "pass" and row.get("sha"):
                    latest = str(row["sha"]).strip()
    except OSError:
        return None
    return latest


def _same_commit(repo: Path, left: str, right: str) -> bool:
    if left == right:
        return True
    left_result = gitutil.run_git(repo, ("rev-parse", "--verify", f"{left}^{{commit}}"), check=False)
    right_result = gitutil.run_git(repo, ("rev-parse", "--verify", f"{right}^{{commit}}"), check=False)
    return (
        left_result.returncode == 0
        and right_result.returncode == 0
        and left_result.stdout.strip() == right_result.stdout.strip()
    )


def preflight(
    expected_sha: str,
    services: list[str] | None = None,
    allow_interrupt: bool = False,
    config: Config | None = None,
) -> dict[str, object]:
    current = config or load_config()
    targets = services or list(DEFAULT_SERVICES)

    resolved = gitutil.run_git(
        current.canonical_repo,
        ("rev-parse", "--verify", f"{expected_sha}^{{commit}}"),
        check=False,
    )
    if resolved.returncode != 0:
        raise ControlPlaneError(
            f"unknown commit: {expected_sha}",
            exit_code=2,
            detail={"ok": False, "stage": "sha_resolves", "expected_sha": expected_sha},
        )
    full_sha = resolved.stdout.strip()

    fetch = gitutil.run_git(
        current.canonical_repo,
        ("fetch", current.trusted_remote, current.trusted_branch),
        check=False,
    )
    if fetch.returncode != 0:
        stderr_lines = [line.strip() for line in fetch.stderr.splitlines() if line.strip()]
        fetch_stderr = " | ".join(stderr_lines[:2]) or "(no stderr output)"
        message = (
            "indeterminate: provenance could not be determined because the fetch from trusted "
            f"remote {current.trusted_remote} branch {current.trusted_branch} failed; "
            f"git stderr: {fetch_stderr}. This is not evidence that {full_sha} is missing "
            "from the remote"
        )
        raise ControlPlaneError(
            message,
            exit_code=6,
            detail={
                "ok": False,
                "stage": "trusted_remote_unreachable",
                "expected_sha": full_sha,
                "remote": current.trusted_remote,
                "branch": current.trusted_branch,
                "stderr": fetch_stderr,
                "message": message,
            },
        )

    trusted_ref = f"{current.trusted_remote}/{current.trusted_branch}"
    ancestor = gitutil.run_git(
        current.canonical_repo,
        ("merge-base", "--is-ancestor", full_sha, trusted_ref),
        check=False,
    )
    if ancestor.returncode != 0:
        message = (
            f"refused: {full_sha} exists only locally or is not reachable from {trusted_ref}; "
            "a fresh clone would not receive it"
        )
        raise ControlPlaneError(
            message,
            exit_code=3,
            detail={
                "ok": False,
                "stage": "trusted_remote",
                "expected_sha": full_sha,
                "trusted_ref": trusted_ref,
                "message": message,
            },
        )

    deploy_log = current.deploy_checkout / ".planning/metrics/deploy-log.jsonl"
    last_sha = _last_passing_sha(deploy_log)
    no_op = bool(last_sha and _same_commit(current.canonical_repo, full_sha, last_sha))
    warnings = []
    if no_op:
        warnings.append(f"NO-OP: {full_sha} is already the last successfully deployed commit")

    impacted = jobs.running_for_services(targets, current)
    if impacted and not allow_interrupt:
        message = f"refused: {len(impacted)} running job(s) would be destroyed"
        raise ControlPlaneError(
            message,
            exit_code=4,
            detail={
                "ok": False,
                "stage": "blast_radius",
                "expected_sha": full_sha,
                "services": targets,
                "message": message,
                "jobs": impacted,
                "warnings": warnings,
            },
        )

    with Registry(current) as registry:
        intent_id = registry.plan_deploy(
            expected_sha=full_sha,
            services=targets,
            requested_by=getpass.getuser(),
            interrupted_jobs=impacted if allow_interrupt else [],
        )
    return {
        "ok": True,
        "expected_sha": full_sha,
        "trusted_ref": trusted_ref,
        "services": targets,
        "no_op": no_op,
        "warnings": warnings,
        "interrupted_jobs": impacted if allow_interrupt else [],
        "intent_id": intent_id,
        "state": "planned",
    }
