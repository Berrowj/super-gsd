DONE

FILES_CHANGED: `super-gsd/hooks/sgsd-quality-gate.js` (created); `super-gsd/registry/session-governance-hooks.yaml` (modified)

VERIFICATION: `node --check super-gsd/hooks/sgsd-quality-gate.js` → exit 0 ✓  
VERIFICATION: `T146-05 behavior matrix harness` → exit 0 ✓ (`Edit`, unknown tool, plan-present, `Write`, `NotebookEdit`, non-SGSD, no-phase, empty/garbage/null stdin all exit 0)  
VERIFICATION: `rg MultiEdit ...; no-match check` → exit 0 ✓  
VERIFICATION: `T146-04 classifier planning/execution pair` → exit 0 ✓

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: `super-gsd/hooks/sgsd-quality-gate.js` | report-only missing-plan producer | stdin PostToolUse JSON payload

ONE_LINER: Added a PostToolUse observer that only matches `Edit`, `Write`, and `NotebookEdit`, derives the ledger from `payload.cwd`, appends one `missing_plan` row when no active `{NN}-*-PLAN-LOCKED.md` exists, and emits no row for missing STATE phase.
