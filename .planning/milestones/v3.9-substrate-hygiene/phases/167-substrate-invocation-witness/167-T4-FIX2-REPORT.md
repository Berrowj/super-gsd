FILES_CHANGED: super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs (modified)

VERIFICATION: `node ... --case hook-distribution-all-types` -> exit 1; ordering assertion passes, then sandbox blocks `spawnSync bash` with `EPERM`  
VERIFICATION: `node ... --case hook-manifest-completeness` -> exit 0  
VERIFICATION: `node ... --case bundled-overlay-current` -> exit 1; sandbox `EPERM`  
VERIFICATION: `node ... --case brokered-substrate-capability` -> exit 1; sandbox `EPERM`  
VERIFICATION: `node --check super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs` -> exit 0  
VERIFICATION: `git diff --check -- super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs` -> exit 0

DEVIATIONS: none  
BLOCKERS: orchestrator must run the three spawn-dependent cases because nested `bash` spawning is denied here  
ONE_LINER: one copy of the locked list was misordered and corrected
