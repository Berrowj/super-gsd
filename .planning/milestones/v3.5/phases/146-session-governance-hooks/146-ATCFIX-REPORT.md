STATUS: DONE (report reconstructed by orchestrator)

NOTE: codex-executor.sh exited 5 (timeout after 1200s) with a 0-byte report;
the implementation had already landed on disk. Fields below are reconstructed
from the raw diff and orchestrator host runs, not from an executor summary.

FILES_CHANGED:
`super-gsd/scripts/lib/sgsd-state.cjs` (modified, +113: `_realpath` +
  `resolveContainedPath(root, relativeSubpath)` — the single containment contract)
`super-gsd/scripts/lib/gate-evidence-log.cjs` (modified, +84: destination via
  the shared helper; skipped-line accounting)
`super-gsd/hooks/sgsd-intent-classifier.cjs` (modified, +109: route-shape
  validation, `registry_routes_invalid` degraded row)
`super-gsd/hooks/sgsd-quality-gate.js` (modified, +2: milestone-scoped
  PLAN-LOCKED lookup)
`super-gsd/tools/cockpit-state/adapter.cjs` (modified, +30: skipped-line count
  surfaced as degraded)

VERIFICATION (orchestrator host runs — 18/18 + adapter self-test):
`node --check` all five files → exit 0 ✓
CRIT-1 junctioned `.planning/metrics` → exit 0, no stack, ZERO files at the
  escape destination ✓ (real NTFS junction, not skipped)
CRIT-3 registry with present-but-structurally-invalid routes → degraded row
  emitted, exit 0, no stack ✓
WARN-1 ledger with corrupt lines appended → adapter surfaces degraded state,
  not a clean bill of health ✓
WARN-2 stale same-numbered PLAN-LOCKED in a NON-active milestone no longer
  suppresses missing_plan ✓; a plan in the ACTIVE milestone still suppresses ✓
PRESERVE: recall 13/13, precision 11/11, gate emits/withholds correctly,
  non-SGSD silent + zero files (both hooks), bench p95<1000 iterations 200,
  adapter surfaces a real row, no MultiEdit anywhere ✓
`node super-gsd/tools/cockpit-state/adapter.cjs --self-test` → 19/19 ✓
`super-gsd/registry/session-governance-hooks.yaml` → unmodified ✓

DEVIATIONS:
[ATCFIX-D1] Executor timed out with an empty report; work was complete. Same
  salvage path as T146-02 and the earlier gap fix.

BLOCKERS: none

SCRIPTS_CREATED: none (new exported helper `resolveContainedPath` in sgsd-state.cjs)

ONE_LINER: Root/write containment is now ONE contract every writer routes
through (realpath + symlink refusal), registry degradation is validated at
route level, ledger line-skips surface as degraded, and PLAN-LOCKED lookup is
milestone-scoped.
