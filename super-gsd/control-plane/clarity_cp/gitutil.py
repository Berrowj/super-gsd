"""Small, explicit subprocess wrappers around Git."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Iterable

from . import ControlPlaneError


def run_git(
    path: str | Path,
    args: Iterable[str],
    *,
    check: bool = True,
) -> subprocess.CompletedProcess[str]:
    command = ["git", "-C", str(path), *[str(item) for item in args]]
    try:
        result = subprocess.run(
            command,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=False,
        )
    except OSError as exc:
        raise ControlPlaneError(f"could not run git: {exc}") from exc
    if check and result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or "git command failed"
        raise ControlPlaneError(detail)
    return result


def output(path: str | Path, *args: str) -> str:
    return run_git(path, args).stdout.strip()


def resolve_git_path(worktree: str | Path, value: str) -> Path:
    candidate = Path(value)
    if not candidate.is_absolute():
        candidate = Path(worktree) / candidate
    return candidate.resolve()


def common_dir(path: str | Path) -> Path:
    return resolve_git_path(path, output(path, "rev-parse", "--git-common-dir"))


def admin_dir(path: str | Path) -> Path:
    return resolve_git_path(path, output(path, "rev-parse", "--git-dir"))


def top_level(path: str | Path) -> Path:
    return Path(output(path, "rev-parse", "--show-toplevel")).resolve()


def branch(path: str | Path) -> str | None:
    result = run_git(path, ("symbolic-ref", "--quiet", "--short", "HEAD"), check=False)
    if result.returncode != 0:
        return None
    return result.stdout.strip() or None
