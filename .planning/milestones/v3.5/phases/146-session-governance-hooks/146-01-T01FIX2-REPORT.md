FILES_CHANGED: `super-gsd/scripts/lib/gate-evidence-log.cjs` (modified)

VERIFICATION:
`node --check super-gsd/scripts/lib/gate-evidence-log.cjs` → exit 0 ✓  
`node -e <no-state .planning direct + parent no-op probe>` → exit 0 ✓  
`node -e <STATE.md present append + envelope-v1 parse probe>` → exit 0 ✓  
`node -e <real repo STATE.md temp-copy append probe>` → exit 0 ✓  
`node -e <bounded read limit probe>` → exit 0 ✓  
`node -e <garbage input never-throw probe>` → exit 0 ✓

DEVIATIONS: none

BLOCKERS: none

SCRIPTS_CREATED: none expected

ONE_LINER: `_planningDir()` now requires `.planning/STATE.md` for every accepted resolution path, so stray `.planning` directories no-op without writes.
