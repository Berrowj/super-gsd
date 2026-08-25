BLOCKED — genuine dependency found; no files modified.

The required order fails on an empty project:

- [audit.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/feature-propagation/audit.cjs:748) invokes `smokeRepoHookOverlay` when hooks are stale. That smoke executes project-target paths before publication; `repoHookSourcePath` does not redirect this spawn.
- [audit.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/feature-propagation/audit.cjs:1515) requires `auditClaudeSubstrateWitness(...).ready` before capability repair. The P167 readiness contract reports `source_missing` when the unpublished witness is absent.
- [audit.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tools/feature-propagation/audit.cjs:858) hashes the unpublished project witness. It records `null`; after publication, validation at line 523 detects drift.

Implementing the reorder would therefore require changing repair/readiness semantics or prospective digest sourcing, beyond a pure reorder. Per your stop condition, I did not invent that machinery, alter P167, modify tests, or delete either patch.

Sandbox denials: none.
