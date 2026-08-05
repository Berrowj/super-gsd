STATUS: DONE_WITH_CONCERNS

FILES_CHANGED: `super-gsd/tools/codex-pro/profile-resolver.cjs` (modified); `super-gsd/scripts/sgsd-codex-control.sh` (modified)

VERIFICATION: `node super-gsd/tools/codex-pro/run-self-test.cjs` → exit 0 ✓ `21/21 passed`; `bash super-gsd/scripts/sgsd-codex-control.sh --self-test` → exit 1 ✗ Git Bash dies before script execution with `CreateFileMapping ... Win32 error 5`; `SGSD_CODEX_CONTROL_TTY_OK=1 node ... --set-cli triage sandbox danger-full-access ...` → raw Node exit 1 ✓ refusal emitted and temp registry unchanged; `node --check super-gsd/tools/codex-pro/profile-resolver.cjs` → exit 0 ✓; `git diff --check` → exit 0 ✓

DEVIATIONS: none

BLOCKERS: Bash is blocked in this sandbox before project code runs. `bash --version`, Git `bin/bash.exe`, `sh.exe`, and WSL Bash all fail with access denied/runtime initialization errors.

SCRIPTS_CREATED: none

ONE_LINER: Removed the env-var/`ttyOk` bypass so dangerous CLI profile mutations now require the exact confirmation phrase plus real stdin/stdout TTY, and added a regression proving the env var no longer bypasses non-interactive refusal.
