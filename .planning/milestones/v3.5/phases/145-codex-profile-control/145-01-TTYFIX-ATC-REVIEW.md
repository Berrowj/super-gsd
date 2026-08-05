FINDINGS: 1
CRITICAL: 0
WARNINGS: 1
PASS_RATE: 5/6
ONE_LINER: Guard logic is minimal and closes the env/ttyOk bypass; only the regression self-test needs tightening.
FINDINGS_DETAIL: [WARNING] [logic] `selfTestCliGuard` assumes the test process is non-TTY, so the env-bypass probe can fail under a real interactive TTY where `--confirm` + `hasTty` should legitimately pass; it also deletes any pre-existing `SGSD_CODEX_CONTROL_TTY_OK` instead of restoring it. Force the bypass probe through a non-TTY child/stub and restore the previous env value in `finally`.
