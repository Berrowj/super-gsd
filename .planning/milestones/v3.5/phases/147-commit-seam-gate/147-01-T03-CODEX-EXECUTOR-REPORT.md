DONE_WITH_CONCERNS

FILES_CHANGED
- `super-gsd/hooks/sgsd-commit-gate.cjs` created.
- `super-gsd/tests/commit-gate/assert-real-commit-gate.cjs` extended with hook warn/docs/sentinel/fail-open/non-SGSD scenarios.

VERIFICATION
- `node --check super-gsd\hooks\sgsd-commit-gate.cjs` exit `0`
- `node --check super-gsd\tests\commit-gate\assert-real-commit-gate.cjs` exit `0`
- `hook-warn-unbacked` exit `1`: sandbox `spawnSync git EPERM`
- `hook-docs-only` exit `1`: sandbox `spawnSync git EPERM`; intended behavior is one `ok` not-source row, not a warn row.
- `hook-sentinel-skip` exit `1`: sandbox `spawnSync git EPERM`
- `hook-warn-sentinel-failopen` exit `1`: sandbox `spawnSync git EPERM`
- Direct SGSD temp/no-git hook smoke exit `0`; appended one degraded row with `git_spawn_failed`, `staged_paths_missing`, `diff_sha256_missing`, no stack.
- Direct non-SGSD Git temp hook smoke exit `0`; no `.planning` or ledger created.
- Existing scenarios: `source-predicate` exit `0`, `shadow-ledger-contained-writer` exit `0`; temp-Git scenarios exit `1` with `spawnSync git EPERM`.

DEVIATIONS
- Real staged source/docs/sentinel hash assertions are implemented in the fixture runner but could not execute in this sandbox. Host-side orchestrator rerun required.
- `apply_patch` was unavailable in this Windows sandbox, so guarded PowerShell transformations were used.

BLOCKERS
- Sandbox blocks Node fixture runner child-process Git/Node spawns from temp roots (`EPERM`).

SCRIPTS_CREATED
- `super-gsd/hooks/sgsd-commit-gate.cjs`

ONE_LINER
- Warn-mode hook is implemented fail-open with sentinel handling, staged diff hashing, per-path evaluation, and shadow-row evidence; full real-Git verification needs host-side rerun.
