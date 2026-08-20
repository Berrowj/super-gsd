FILES_CHANGED: [156-01-PLAN-LOCKED.md](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/.planning/milestones/v3.6-vtp-bridge/phases/156-state-close-contract/156-01-PLAN-LOCKED.md) only; no source changes.

VERIFICATION: Exact requested validator exited 0: `VALID (no errors)`.

DEVIATIONS: Requested read-side and hook paths were absent. The plan uses actual `scripts/lib/decision-state.cjs` and proposes a tracked `hooks/gsd-phase-boundary.sh` source for the currently installed-only hook.

BLOCKERS: None.

ONE_LINER: Locked two-task P156 plan for atomic resolver-guarded STATE writes and actual-route SUMMARY close enforcement.
