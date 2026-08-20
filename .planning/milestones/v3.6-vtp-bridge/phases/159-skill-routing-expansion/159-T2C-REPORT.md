FILES_CHANGED  
`skill-routing.yaml`; `session-governance-hooks.yaml`; `skill-routing-registry.cjs`; `sgsd-intent-classifier.cjs`; `assert-skill-routing-expansion.cjs`.

VERIFICATION  
`node --check` passed for all three edited CJS files. Strict repo `js-yaml` parsing passed for both registries. Registry/fallback loaded 29/29 rows. Loader self-test passed 18/18. Static family matrix passed: positives, negatives, shadow tiering, internal red fixture, deep fallback parity, lexical-only scan. `git diff --check` passed.

DEVIATIONS  
None. Spawn-bound suites intentionally not run per dispatch.

BLOCKERS  
None.

ONE_LINER  
P159-T2 edits are written and statically verified; ready for orchestrator-run unsandboxed suites.
