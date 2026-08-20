"""Configuration resolution without filesystem side effects."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path


DEFAULTS = {
    "canonical_repo": "/opt/clarity/project-clarity-erp",
    "deploy_checkout": "/home/jackberrow/clarity-deploy",
    "worktree_base": "/home/jackberrow/.config/superpowers/worktrees/project-clarity-erp",
    "trusted_remote": "github",
    "trusted_branch": "main",
    "state_dir": str(Path.home() / ".local/state/clarity-control-plane"),
    "sgsd_deployed": "/opt/clarity/super-gsd",
}

ENV_VARS = {
    "canonical_repo": "CLARITY_CP_CANONICAL_REPO",
    "deploy_checkout": "CLARITY_CP_DEPLOY_CHECKOUT",
    "worktree_base": "CLARITY_CP_WORKTREE_BASE",
    "trusted_remote": "CLARITY_CP_TRUSTED_REMOTE",
    "trusted_branch": "CLARITY_CP_TRUSTED_BRANCH",
    "state_dir": "CLARITY_CP_STATE_DIR",
    "sgsd_deployed": "CLARITY_CP_SGSD_DEPLOYED",
}


@dataclass(frozen=True)
class Config:
    canonical_repo: Path
    deploy_checkout: Path
    worktree_base: Path
    trusted_remote: str
    trusted_branch: str
    state_dir: Path
    sgsd_deployed: Path

    @property
    def database_path(self) -> Path:
        return self.state_dir / "state.db"

    @property
    def source_root(self) -> Path:
        return Path(__file__).resolve().parents[2]


def _read_overrides(state_dir: Path) -> dict[str, object]:
    config_path = state_dir / "config.json"
    try:
        data = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return {}
    return data if isinstance(data, dict) else {}


def load_config() -> Config:
    """Resolve environment, optional JSON, then defaults, in that order."""

    initial_state = Path(
        os.environ.get(ENV_VARS["state_dir"], DEFAULTS["state_dir"])
    ).expanduser()
    overrides = _read_overrides(initial_state)

    values: dict[str, str] = {}
    for key, default in DEFAULTS.items():
        env_value = os.environ.get(ENV_VARS[key])
        file_value = overrides.get(key)
        if env_value is not None:
            values[key] = env_value
        elif isinstance(file_value, (str, int)):
            values[key] = str(file_value)
        else:
            values[key] = default

    return Config(
        canonical_repo=Path(values["canonical_repo"]).expanduser(),
        deploy_checkout=Path(values["deploy_checkout"]).expanduser(),
        worktree_base=Path(values["worktree_base"]).expanduser(),
        trusted_remote=values["trusted_remote"],
        trusted_branch=values["trusted_branch"],
        state_dir=Path(values["state_dir"]).expanduser(),
        sgsd_deployed=Path(values["sgsd_deployed"]).expanduser(),
    )
