FILES_CHANGED: `decision-state.cjs`, repo hook, orchestrator skill, `install.sh`, consumer test.

VERIFICATION: Direct CLI, Node syntax, resolver self-test (14/14), and `git diff --check` pass. Required suite: 11 pass, 17 derivative failures because five nested Node/Bash launches returned `status=null, EPERM`.

DEVIATIONS: None. No commit created.

BLOCKERS: Unsandboxed orchestrator rerun required to prove real installer/hook execution.

ONE_LINER: Wired both decision paths through one resolver-backed renderer with loud stale/conflict evidence.
