"""Canonical Git anchor reporting and split-brain detection."""

from __future__ import annotations

from pathlib import Path

from . import ControlPlaneError
from .config import Config, load_config
from . import gitutil


def git_common_dir(path: str | Path) -> str:
    """Return the absolute, resolved common directory for one worktree."""

    return str(gitutil.common_dir(path))


def canonical_common_dir(config: Config | None = None) -> str:
    current = config or load_config()
    return git_common_dir(current.canonical_repo)


def scan(config: Config | None = None) -> list[dict[str, object]]:
    """Inspect each immediate worktree-shaped child independently."""

    current = config or load_config()
    try:
        canonical = canonical_common_dir(current)
    except ControlPlaneError:
        canonical = None

    try:
        entries = sorted(current.worktree_base.iterdir(), key=lambda item: item.name)
    except OSError:
        return []

    rows: list[dict[str, object]] = []
    for entry in entries:
        if not entry.is_dir() or not (entry / ".git").exists():
            continue
        row: dict[str, object] = {
            "path": str(entry.resolve()),
            "branch": None,
            "common_dir": None,
            "anchored_canonically": False,
        }
        try:
            row["common_dir"] = git_common_dir(entry)
            row["branch"] = gitutil.branch(entry)
            row["anchored_canonically"] = canonical is not None and row["common_dir"] == canonical
        except (ControlPlaneError, OSError) as exc:
            row["error"] = str(exc)
        rows.append(row)
    return rows


def report(config: Config | None = None) -> dict[str, object]:
    current = config or load_config()
    try:
        canonical = canonical_common_dir(current)
        canonical_error = None
    except ControlPlaneError as exc:
        canonical = None
        canonical_error = exc.message
    worktrees = scan(current)
    split = [row for row in worktrees if row.get("common_dir") and not row["anchored_canonically"]]
    broken = [row for row in worktrees if row.get("error")]
    result: dict[str, object] = {
        "canonical_repo": str(current.canonical_repo),
        "canonical_common_dir": canonical,
        "worktree_base": str(current.worktree_base),
        "split_brain_count": len(split),
        "broken_count": len(broken),
        "worktrees": worktrees,
    }
    if canonical_error:
        result["error"] = canonical_error
    return result
