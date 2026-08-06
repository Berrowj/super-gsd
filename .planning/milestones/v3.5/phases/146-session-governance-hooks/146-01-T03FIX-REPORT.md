FILES_CHANGED: `super-gsd/hooks/sgsd-session-start.js` (modified)

VERIFICATION:
`node --check super-gsd/hooks/sgsd-session-start.js` → exit 0 ✓  
Preserve matrix → exit 0 ✓: fixture v9.9/873, non-SGSD cwd, missing phase one row, empty/garbage/null stdin, nonexistent cwd, no block fields, no home settings/env refs, handoff pairing  
Regression matrix → exit 0 ✓: optional enrichment failure still emits contract, writer failure inside catch has no stack, handoff failure uses distinct row, injected resolver throw fail-opens  
`git diff --check -- super-gsd/hooks/sgsd-session-start.js` → exit 0 ✓

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none

ONE_LINER: Hardened SessionStart so mandatory governance emits first, all error/evidence paths fail open, and handoff/governance failures no longer masquerade as `state_phase_missing`.
