FILES_CHANGED: `super-gsd/scripts/sgsd-stop-handoff.sh` (modified); `super-gsd/tools/autopilot-watchdog/check.cjs` (modified)

VERIFICATION:  
`bash -n super-gsd/scripts/sgsd-stop-handoff.sh` → exit 1 ✗ Git Bash sandbox `CreateFileMapping ... Win32 error 5`  
`node --check super-gsd/tools/autopilot-watchdog/check.cjs` → exit 0 ✓  
`node super-gsd/tools/autopilot-watchdog/check.cjs --self-test-phase-resolution` → exit 0 ✓  
`node - <handoff CRIT+regression fixture>` → exit 0 ✓  
`powershell <watchdog no-.planning --write fixture>` → exit 0 ✓  
`powershell <watchdog real SGSD --write fixture>` → exit 0 ✓  

DEVIATIONS: none

BLOCKERS: Git Bash and WSL are blocked by sandbox policy, so Bash syntax validation could not run.

SCRIPTS_CREATED: none expected

ONE_LINER: Handoff depth/runtime now count all session-spawning rows via one predicate, and watchdog `--write` now refuses non-SGSD targets without creating directories or files.
