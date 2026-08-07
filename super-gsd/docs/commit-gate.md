# SGSD Commit Gate

The commit gate is a Git `pre-commit` layer for SGSD repositories. The installer writes a POSIX `#!/bin/sh` trampoline at the hook path returned by Git itself:

```sh
git rev-parse --git-path hooks/pre-commit
```

The installer honors an existing `core.hooksPath` because Git resolves that path. It does not set `core.hooksPath`.

## Lifecycle

Default mode is warn. A source-touching staged change without active SGSD plan and assurance evidence prints a warning, allows the commit, and appends a shadow row to `.planning/metrics/commit-gate-shadow.jsonl` with per-path evidence and reason codes.

Block mode is earned, not assumed. The mechanical falsifier is the shadow report produced by the hook runtime:

```sh
node super-gsd/hooks/sgsd-commit-gate.cjs --shadow-report
```

Activation uses the same runtime:

```sh
node super-gsd/hooks/sgsd-commit-gate.cjs --activate-block
```

Activation refuses unless the report falsifier passes and artifact conventions are known. In block mode, an earned block exits from the hook runtime as 10; the trampoline maps that to Git exit 1 so the commit is blocked and staged files remain staged.

## Sentinel

Creating `.sgsd-gate-off` at the repo root waives this one governance layer while the file is present. The hook still appends a shadow row with status `skipped`, reason code `sentinel_waived_block`, and `waived_paths` listing the staged paths covered by the waiver.

## Bootstrap Degradation

The trampoline looks for `node` on `PATH` first. If Node is missing, the hook script is missing, or another bootstrap failure occurs, the trampoline prints a loud `bootstrap_*` reason to stderr and allows the commit. When Node and the SGSD shadow-log library are available, it also appends a degraded shadow row via `appendShadowRow`.

## Linked Worktrees

In linked worktrees, Git can resolve `hooks/pre-commit` to the common Git directory, not the current worktree. That hook is shared by every linked worktree for the repository. The installer warns with `linked_worktree_shared_hook_path` when it detects that the resolved hook path is shared.

## Rollback

Rollback must not go through the gate. Use the installer or remove only the SGSD-marked hook file directly:

```sh
bash super-gsd/install.sh --uninstall-commit-gate
```

Dry-run is available:

```sh
bash super-gsd/install.sh --uninstall-commit-gate --dry-run
```

The uninstaller removes only a hook containing the `SGSD-COMMIT-GATE-HOOK` marker. It refuses unmarked hooks and does not create backups or replace operator hooks.

## One-Layer Honesty

`--no-verify` and some GUI clients bypass pre-commit hooks. This gate is a governance layer, not a guarantee. Treat its shadow ledger as evidence from the layer when it ran, not proof that every commit path is covered.