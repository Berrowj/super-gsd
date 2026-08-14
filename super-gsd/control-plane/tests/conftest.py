from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

CONTROL_PLANE = Path(__file__).resolve().parents[1]
if str(CONTROL_PLANE) not in sys.path:
    sys.path.insert(0, str(CONTROL_PLANE))


def run_git(
    path: Path,
    *args: str,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", "-C", str(path), *args],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        env=env,
    )
    if check and result.returncode != 0:
        raise AssertionError(
            f"git {' '.join(args)} failed in {path}:\nstdout={result.stdout}\nstderr={result.stderr}"
        )
    return result


def make_repo(path: Path, *, filename: str = "README.md", content: str = "base\n") -> str:
    path.mkdir(parents=True)
    subprocess.run(
        ["git", "init", "-b", "main", str(path)],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    run_git(path, "config", "user.name", "Clarity Test")
    run_git(path, "config", "user.email", "clarity@example.invalid")
    (path / filename).write_text(content, encoding="utf-8")
    run_git(path, "add", filename)
    run_git(path, "commit", "-m", "initial")
    return run_git(path, "rev-parse", "HEAD").stdout.strip()


def add_commit(path: Path, filename: str, content: str, message: str = "change") -> str:
    (path / filename).write_text(content, encoding="utf-8")
    run_git(path, "add", filename)
    run_git(path, "commit", "-m", message)
    return run_git(path, "rev-parse", "HEAD").stdout.strip()


def add_trusted_remote(repo: Path, bare: Path) -> str:
    subprocess.run(
        ["git", "init", "--bare", str(bare)],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    run_git(repo, "remote", "add", "github", str(bare))
    run_git(repo, "push", "-u", "github", "main")
    run_git(repo, "fetch", "github", "main")
    return run_git(repo, "rev-parse", "HEAD").stdout.strip()


@pytest.fixture(autouse=True)
def isolated_clarity_config(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    paths = {
        "canonical": tmp_path / "canonical",
        "deploy": tmp_path / "deploy",
        "worktrees": tmp_path / "worktrees",
        "state": tmp_path / "state",
        "sgsd": tmp_path / "sgsd-deployed",
    }
    values = {
        "CLARITY_CP_CANONICAL_REPO": paths["canonical"],
        "CLARITY_CP_DEPLOY_CHECKOUT": paths["deploy"],
        "CLARITY_CP_WORKTREE_BASE": paths["worktrees"],
        "CLARITY_CP_TRUSTED_REMOTE": "github",
        "CLARITY_CP_TRUSTED_BRANCH": "main",
        "CLARITY_CP_STATE_DIR": paths["state"],
        "CLARITY_CP_SGSD_DEPLOYED": paths["sgsd"],
    }
    for name, value in values.items():
        monkeypatch.setenv(name, str(value))
    yield paths
