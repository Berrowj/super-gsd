FILES_CHANGED  
[assert-vtp-readiness.cjs](C:/Users/jack.berrow/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs) — added `session-start-depth` case only.

VERIFICATION (RED preserved)  
`node super-gsd/tests/vtp-readiness/assert-vtp-readiness.cjs --case session-start-depth` → exit 1; installer spawn failed loud with `EPERM`; merged VTP registrations remained `0`. This is not a valid contractual red because the real installer never executed. `node --check` and `git diff --check` passed.

DEVIATIONS  
Production hook and overlay registration were not written because that would violate red-before-green ordering.

BLOCKERS  
Sandbox denied nested Bash spawn (`error=EPERM`). Orchestrator must rerun unsandboxed.

SCRIPTS_CREATED  
None.

ONE_LINER  
Test case prepared; implementation paused at the fail-loud sandbox boundary.
