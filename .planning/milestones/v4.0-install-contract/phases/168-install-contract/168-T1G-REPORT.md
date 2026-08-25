STATUS: IMPLEMENTED — UNSANDBOXED VERIFICATION REQUIRED

FILES_MODIFIED:
- [audit.cjs](<HOME>\AppData\Roaming\warp\Warp\data\worktrees\GSDedits\luminaria-hogback\super-gsd\tools\feature-propagation\audit.cjs:1769)

ROOT_CAUSE:
T1’s `main()` caller for `--repair-substrate-capability` passed `repairProjectHooks: true` unconditionally. T1 reused that flag for full project module publication, accidentally selecting `managedHookIds: undefined` and merging every overlay hook.

FIX:
Restored `repairProjectHooks` to `--init-local || --update`. Substrate-only repair now manages only the P167 Pre/Post witness IDs. Full installs retain complete overlay/module delivery because `install.sh` forwards those mode flags.

FLAKE_INVESTIGATION:
No collision reproduced. Hook contract passed once immediately after the brokered attempt and twice standalone; successful runs left no new fixtures. Both suites already use uniquely suffixed `mkdtempSync` directories and `finally` teardown. Brokered execution was DENIED by sandbox `spawnSync bash EPERM`; no speculative changes made.

VERIFICATION:
- Node checks: PASS 5/5 modified JS/CJS files
- Feature-propagation self-test: PASS 15/15
- Hook contract: PASS 38/38
- `git diff --check`: PASS
- Propagation: DENIED (`spawnSync node EPERM`)
- Installer guard: DENIED after 3 static PASS (`spawnSync bash EPERM`)
- Install contract: DENIED after generated case PASS (`spawnSync bash EPERM`)
