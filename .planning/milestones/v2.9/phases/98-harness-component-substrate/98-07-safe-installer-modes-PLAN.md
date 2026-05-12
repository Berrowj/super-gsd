# 98-07 Safe Installer Modes Plan

## Goal

Make `super-gsd/install.sh` safe for deadline-sensitive machines by splitting read-only checks, local project setup, global Claude installation, and global auto-approve into explicit modes.

## Scope

1. Change `super-gsd/install.sh` so no-arg invocation is read-only doctor output plus usage.
2. Keep `--init-project` as a backward-compatible alias for local-only project scaffolding; add clearer `--init-local`.
3. Require `--install-global` before writing to `~/.claude`, installing global scripts, or installing global npm packages.
4. Require `--enable-autoapprove` before running `claude config set --global autoApprove ...`.
5. Remove BRV/ByteRover from the current installer path. Keep `--skip-brv` as a legacy no-op and make `--with-brv` fail with guidance to use `.planning/memory` / `sgsd-memory-migrate`.
6. Update README and friend setup docs so deadline-safe users do not run invasive global install accidentally and so current memory is documented as `.planning/memory`.
7. Verify with shell syntax, dry-run mode checks, temp local-init smoke, and existing SGSD self-tests.

## Non-Goals

- Do not change PowerShell `sg`, `sgsd`, or cockpit boot topology.
- Do not delete legacy BRV migration assets; only remove them from the default/current installer path.
- Do not touch unrelated `.planning/metrics` runtime files.

## Acceptance

- `bash super-gsd/install.sh` performs no writes and exits 0.
- `bash super-gsd/install.sh --doctor` performs no writes and exits 0.
- `bash super-gsd/install.sh --init-project --dry-run` does not mention global Claude writes or auto-approve changes.
- `bash super-gsd/install.sh --init-project --skip-brv` treats `--skip-brv` as a no-op.
- `bash super-gsd/install.sh --install-global --dry-run` shows global Claude writes but not auto-approve.
- `bash super-gsd/install.sh --enable-autoapprove --dry-run` is the only dry-run path that mentions setting `autoApprove`.
- A temp `--init-project --skip-brv` run creates local `.planning/config.json`, `.planning/memory/MEMORY.md`, and `CLAUDE.md` only under the temp project.
