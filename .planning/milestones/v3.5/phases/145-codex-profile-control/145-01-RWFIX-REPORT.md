STATUS: DONE_WITH_CONCERNS

FILES_CHANGED: `super-gsd/scripts/codex-exec.sh` (modified)

VERIFICATION:
`git diff --check` → exit 0 ✓  
`bash -n super-gsd/scripts/codex-exec.sh` → exit 1 ✗ Git Bash startup failed: `CreateFileMapping ... Win32 error 5`  
`bash super-gsd/scripts/codex-exec.sh --self-test --skip-network` → exit 1 ✗ same Bash startup failure  
`bash super-gsd/scripts/codex-executor.sh --self-test` → exit 1 ✗ same Bash startup failure

DEVIATIONS: none in code scope; required Bash verification could not execute due blocker below

BLOCKERS: The sandbox denies Git Bash/WSL process startup, so I could not observe RED/GREEN or the required self-tests.

SCRIPTS_CREATED: none

ONE_LINER: Added deterministic report-write failure handling so valid Codex output exits 9, logs host-side failure, avoids `OK`, and does not count against provider circuit.
