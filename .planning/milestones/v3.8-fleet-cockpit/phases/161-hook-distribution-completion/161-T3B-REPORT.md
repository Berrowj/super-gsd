FILES_CHANGED: `super-gsd/scripts/lib/hook-registration-preflight.cjs`

VERIFICATION (static): Node syntax checks PASS; conditional coverage assertions 6/6 PASS; `git diff --check` PASS.

DEVIATIONS: None; installer and guard assertion unchanged.

BLOCKERS: None. Spawn-bound case remains for orchestrator rerun.

ONE_LINER: WARN now requires a live global registration matching event, interpreter, and script; otherwise preflight REFUSES.
