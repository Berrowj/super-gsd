FILES_CHANGED / `resolve.cjs`, `assert-state-resolver.cjs`; no T4 files or commit.

VERIFICATION / SEDIMENT 8/8; self-test 14/14; full suite 68 pass, 4 sandbox EPERM; diff check clean.

DEVIATIONS / Live resolution is now truthful `v3.6-vtp-bridge/153`, not operator-known 155. No active v3.6 ROADMAP exists; inferring 155 would exceed parser scope and violate ROADMAP-only ordering.

BLOCKERS / Sandbox blocks four `git init` fixture spawns.

ONE_LINER / First-block, indentation-scoped parsing prevents legacy sediment and invalid `roadmap_run` bundles from hijacking state or conflicts.
