# devcp non-destructive reconciliation decision

## Historical fork quarantine

The 883-commit `~/GSDedits` fork is historical evidence. Never rewrite or push
it, and preserve `devcp-fork-backup-2026-08-05`. It is not the installation
source. Valuable fork-only capabilities move forward only as reviewed patches
on a clean origin/master-based branch with generic operator identity. Always
validate canonical source origin before fetch, patch, merge, or installation.

The observed 43-file installed drift is also evidence. The decision is
non-deleting: preserve and classify it rather than replace the directory.
Review dependencies for `board-runner.cjs`, `execution-authority.sh`,
`concurrency-policy.cjs`, and `decision-registry.cjs` before extracting any
capability.

## Complete recovery boundary

Snapshot the complete global mutation boundary before bootstrap or
`/sgsd-update`, not only scripts. Each manifest records every file, directory,
symlink, mode, link target, and SHA.

The pre-install path set must be a subset of the post-install path set. Compute
the pre-install extra-file set relative to the canonical scripts tree, then
prove every extra remains byte-identical after bootstrap and `/sgsd-update`.
A mismatch stops the candidate; rollback retains the archive, quarantines the
failed candidate, and restores prior targets including their absent state.

## Shadow deployment decision

Use a VTP shadow deployment: coordinate sessions, validate origin and clean
state, capture the intended SHA, perform a guarded fast-forward, snapshot,
install without switching processes, and verify SHA, smoke, hooks, model pin,
and manifest evidence. Verify the 43-file preservation result before switching
tmux, cockpit, and MCP with before/after identities.

Failure before the switch leaves current processes untouched and triggers the
non-deleting rollback. Failure after the switch freezes further propagation and
is repaired by a reviewed forward change.

## Clarity boundary

The path `/opt/clarity/project-clarity-erp/super-gsd` remains
outside framework propagation. It is application-owned vendored content, not canonical framework
evidence. Runtime authority comes from `~/.claude/super-gsd/source`,
`~/.claude/super-gsd/scripts`, and `~/.claude/agents`; candidate acceptance
requires tmux, cockpit, and MCP to resolve through those canonical locations.
