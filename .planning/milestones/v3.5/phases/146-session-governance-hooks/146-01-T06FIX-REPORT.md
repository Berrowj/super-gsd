FILES_CHANGED: `super-gsd/tools/cockpit-state/adapter.cjs` (modified)

VERIFICATION:  
`node --check super-gsd\tools\cockpit-state\adapter.cjs` → exit 0 ✓  
`inline preserve+new governance probe` → exit 0 ✓  
`non-SGSD CLI JSON/no-stack probe` → exit 0 ✓  
`live ledger read-only hash probe` → exit 0 ✓  
`git diff --check -- super-gsd\tools\cockpit-state\adapter.cjs` → exit 0 ✓  
`node super-gsd\tools\cockpit-state\adapter.cjs --self-test` → exit 1 ✗, unrelated existing fixture failures: `A7_now_uses_live_progress`, `A10_agents_roster_populated`

DEVIATIONS: none

BLOCKERS: adapter self-test has the unrelated non-governance failures above; requested preserve/new governance probes pass.

SCRIPTS_CREATED: none

ONE_LINER: Governance now reports `ok`/`empty`/`unavailable`, probes blind ledgers, clamps reader output, scopes to active STATE phase, dedupes by phase/file, and retracts rows when the shared PLAN-LOCKED helper finds a current plan.
