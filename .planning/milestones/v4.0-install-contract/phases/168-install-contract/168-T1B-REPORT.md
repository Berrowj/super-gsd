STATUS: FIXED — end-to-end verification sandbox-denied.

CHANGES:
- Smoke now treats bracketed `blocked`, `denied`, or `refused` output from a normal non-zero exit as a successful load.
- Module-resolution signatures still fail.
- Unrecognized failures retain their bounded real output in `message`.
- Added focused regressions; no tests weakened or deleted.
- Dependency-closure computation untouched.

FILES:
- [hook-registration-preflight.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/scripts/lib/hook-registration-preflight.cjs:56)
- [assert-installer-registration-guard.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs:1407)

VERIFY:
- `node --check super-gsd/scripts/lib/hook-registration-preflight.cjs`  
  `EXIT_CODE=0`
- `node --check super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs`  
  `EXIT_CODE=0`
- Focused `smoke-static` regression:  
  `EXIT_CODE=0`
- `node super-gsd/tests/install-contract/assert-install-contract.cjs`  
  `generated-transitive-manifest PASS`  
  `EXIT_CODE=1` — **DENIED:** `spawnSync bash EPERM` during `empty-module-tree-real-install`. The sandbox prevented the Bash subprocess; the orchestrator must rerun unsandboxed.
