DONE_WITH_CONCERNS

FILES_CHANGED
- [commit-gate-shadow-log.cjs]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/scripts/lib/commit-gate-shadow-log.cjs): created never-throw writer/reader.
- [assert-real-commit-gate.cjs]($HOME/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/tests/commit-gate/assert-real-commit-gate.cjs): added `shadow-ledger-contained-writer` scenario.

VERIFICATION
- `node --check super-gsd\scripts\lib\commit-gate-shadow-log.cjs` exit `0`
- `node --check super-gsd\tests\commit-gate\assert-real-commit-gate.cjs` exit `0`
- `node ... --scenario shadow-ledger-contained-writer` exit `0`
- `git diff --check ...` exit `0` with autocrlf warning only
- T147-01 rerun: `source-predicate` exit `0`
- T147-01 git-backed scenarios exit `1`: `gsdedits-backed`, `false-plan-audit-missing`, `convention-unknown`, `per-path-granularity`, `artifact-conventions-source-predicate`; all fail at `spawnSync git EPERM`.

DEVIATIONS
- None in implementation scope. T147-02 fixtures use temp SGSD roots and did not create repo `.planning/metrics/commit-gate-shadow.jsonl`.

BLOCKERS
- Sandbox blocks real Git fixture creation via `spawnSync git EPERM`; host-side rerun needed for those T147-01 scenarios.

SCRIPTS_CREATED
- `super-gsd/scripts/lib/commit-gate-shadow-log.cjs`

ONE_LINER
- Added the contained commit-gate shadow ledger API with per-path evidence, hash-only diff discipline, reason-coded degradation, and bounded tail reads.
