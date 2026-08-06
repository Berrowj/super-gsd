FILES_CHANGED: `super-gsd/registry/session-governance-hooks.yaml` (modified)

VERIFICATION:  
`node --check super-gsd/hooks/sgsd-intent-classifier.cjs` → exit 0 ✓  
`PowerShell corpus harness using JSON.stringify payloads` → exit 0 ✓; misses `[]`, falseRoutes `[]`  
`temp plan fixture, only .planning/STATE.md, no super-gsd` → exit 0 ✓  
`non-SGSD temp dir stdout/write check` → exit 0 ✓  
`bench canonical + non-canonical --record check` → exit 0 ✓; `iterations=200`, `p95_ms=0.021`  
`empty/garbage/null stdin check` → exit 0 ✓  
`mandatory-before-suggestion/no decision/no continue:false/static no-network check` → exit 0 ✓  
`10k adversarial matchingRoutes timing` → exit 0 ✓; worst `4.881 ms`

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

FIELD SURFACE: deleted `schema_version`, `registry_version`, `owner_phase`, route `intent`, `predicate.match`, and all `kind: none` routes because the classifier does not consume them. Kept only enforced directive/suggestion routes plus consumed exclusions.

ONE_LINER: tightened planning triage to intent-plus-planning-object patterns, added the missing approach/scope/roadmap/options/decide/tradeoff families, and removed broad `design`/`architect`/`evaluate` false routes.
