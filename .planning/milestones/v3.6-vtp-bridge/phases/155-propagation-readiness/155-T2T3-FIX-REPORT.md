FILES_CHANGED: `resolve.cjs`, `assert-dual-root-resolvers.cjs`, `sgsd-distill-milestone.sh`

VERIFICATION: PASS — resolver self-test 14/14; audit self-test 13/13; audit matrix 49/49; direct resolver evidence 36/36; syntax and `git diff --check`.

DEVIATIONS: None. No commit; unrelated dirty files untouched.

BLOCKERS: Full matrix and installer harness require orchestrator rerun. Sandbox blocked child processes (`status=null`; Git Bash Win32 error 5). Observed totals: matrix 202 pass/184 launch-blocked; installer 3 pass/8 launch-blocked.

ONE_LINER: Routed all three evidence parsers through `phase-name.cjs`, added state-resolver JSON matrix coverage, and made empty distill corpora fail.
