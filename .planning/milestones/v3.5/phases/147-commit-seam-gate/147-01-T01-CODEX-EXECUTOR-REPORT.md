DONE_WITH_CONCERNS

FILES_CHANGED:
`super-gsd/scripts/lib/sgsd-artifact-conventions.cjs` (created)  
`super-gsd/tests/commit-gate/assert-real-commit-gate.cjs` (created)

VERIFICATION:
`node --check super-gsd\scripts\lib\sgsd-artifact-conventions.cjs` → exit 0 ✓  
`node --check super-gsd\tests\commit-gate\assert-real-commit-gate.cjs` → exit 0 ✓  
`node super-gsd\tests\commit-gate\assert-real-commit-gate.cjs --scenario source-predicate` → exit 0 ✓  
`node super-gsd\tests\commit-gate\assert-real-commit-gate.cjs --scenario gsdedits-backed` → exit 1 ✗ `spawnSync git EPERM`  
`node super-gsd\tests\commit-gate\assert-real-commit-gate.cjs --scenario false-plan-audit-missing` → exit 1 ✗ `spawnSync git EPERM`  
`node super-gsd\tests\commit-gate\assert-real-commit-gate.cjs --scenario convention-unknown` → exit 1 ✗ `spawnSync git EPERM`  
`node super-gsd\tests\commit-gate\assert-real-commit-gate.cjs --scenario per-path-granularity` → exit 1 ✗ `spawnSync git EPERM`  
`node super-gsd\tests\commit-gate\assert-real-commit-gate.cjs --scenario artifact-conventions-source-predicate` → exit 1 ✗ `spawnSync git EPERM`  
Supplemental pure probes for per-path, unknown convention, and false `PLAN.md`/`AUDIT.md` → exit 0 ✓

DEVIATIONS: none

BLOCKERS: This sandbox blocks Node `child_process` from spawning Git (`spawnSync git EPERM`). PowerShell can run `git`, but the real-git runner cannot complete here.

SCRIPTS_CREATED:
`sgsd-artifact-conventions.cjs` | pure convention/source evaluator | exports `discoverConvention`, `evaluatePaths`, `isSourceTouching`  
`assert-real-commit-gate.cjs` | temp real-git fixture runner | exports fixture helpers + `--scenario`

ONE_LINER: Added per-path artifact evaluation with observable `convention_unknown` and a reusable contained temp-git runner; real-git verification is host-blocked here.
