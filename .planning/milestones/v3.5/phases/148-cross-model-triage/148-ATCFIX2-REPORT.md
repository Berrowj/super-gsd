FILES_CHANGED: super-gsd/scripts/sgsd-triage-runtime.cjs (modified); super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs (modified); super-gsd/skills/sgsd-triage/SKILL.md (modified)

VERIFICATION: `node --check super-gsd/scripts/sgsd-triage-runtime.cjs` -> exit 0; `node --check super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs` -> exit 0; `git diff --check -- ...` -> exit 0; direct staged replay smoke -> exit 0; `node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario all` -> exit 1 (sandbox `spawnSync bash EPERM`); `grep -c 'vtp-plan\|vtp-consume\|vtp-finalize' super-gsd/skills/sgsd-triage/SKILL.md` -> exit 1 (Git grep Win32 CreateFileMapping error 5); PowerShell equivalent count -> exit 0, output `5`

DEVIATIONS: [Verification] requested full suite/grep blocked by sandbox/runtime tool errors, not test assertions

BLOCKERS: sandbox blocks nested `bash` spawn in full suite and GNU `grep` startup

SCRIPTS_CREATED: none

ONE_LINER: wired production SKILL to staged MCP transport, changed staged skip output to `reason`, and added idempotent guards/tests for staged consume/finalize replay appends

STATUS: DONE_WITH_CONCERNS
