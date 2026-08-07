**FILES_CHANGED**
- [sgsd-artifact-conventions.cjs](</c/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/scripts/lib/sgsd-artifact-conventions.cjs>): source predicate, invalid-path records, uniform case-insensitive allowed-file matching.
- [assert-real-commit-gate.cjs](</c/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/cholla-racer/super-gsd/tests/commit-gate/assert-real-commit-gate.cjs>): fixture Set/realpath cleanup guard and regressions.

**VERIFICATION**
- `node --check` artifact conventions: exit `0`
- `node --check` commit-gate test runner: exit `0`
- CRIT-1 direct probe: exit `0`, outside refused `fixture_not_registered`, real fixture cleaned `fixture_removed`
- CRIT-2 direct probe: exit `0`; `.env`, `.npmrc`, `Dockerfile` true; `.planning/STATE.md`, `docs/x.md`, `README.md` false
- WARN-1 direct probe: exit `0`; `../traversal` => `invalid_path/path_traversal`, `null` => `invalid_path/path_not_string`
- WARN-2 direct probe: exit `0`; exact, `/**`, and wildcard all `backed` under uniform case-insensitive policy
- Scenarios: `source-predicate` exit `0`; `gsdedits-backed`, `false-plan-audit-missing`, `convention-unknown`, `per-path-granularity`, `artifact-conventions-source-predicate` exit `1` due `spawnSync git EPERM`

**DEVIATIONS**
None in changed-line scope. `.gitignore` is source-touching; final config list includes `.env*`, `.npmrc`, `.gitattributes`, `.gitignore`, `Dockerfile`, `Dockerfile.*`, `docker-compose*`, `Makefile`, `*.toml`, `*.ini`.

**BLOCKERS**
Sandbox blocks real Git fixture spawn: `git init failed with null: spawnSync git EPERM`.

**SCRIPTS_CREATED**
None.

**ONE_LINER**
Fixed destructive cleanup containment, root config source detection, invalid staged path observability, and case-policy inconsistency.
