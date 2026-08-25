FILES_CHANGED:
- `super-gsd/install.sh`
- `super-gsd/tools/feature-propagation/audit.cjs`
- `super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs`

VERIFICATION:
- preflight-static: exit 0 PASS
- smoke-static: exit 0 PASS
- bundled-overlay-static: exit 0 PASS
- bundled-overlay-current: exit 1 DENIED (`spawnSync bash EPERM`)
- vendored-nine-hook: exit 1 DENIED (`spawnSync bash EPERM`)
- node-check-both-sites: exit 1 DENIED (`spawnSync bash EPERM`)
- deployed-hook-smoke: exit 1 DENIED (`spawnSync bash EPERM`)
- hook-distribution-all-types: exit 1 DENIED (`spawnSync bash EPERM`)
- hook-manifest-completeness: exit 0 PASS
- brokered-substrate-capability: exit 1 DENIED (`spawnSync bash EPERM`)
- sgsd-update-clarity-shape: exit 1 DENIED (`spawnSync git EPERM`)
- sgsd-update-clarity-recovery: exit 1 DENIED (`spawnSync git EPERM`)
- `assert-hook-contract.cjs`: exit 0, 38/38
- `assert-prompt-contracts.cjs`: exit 0, 4/4
- `audit.cjs --self-test`: exit 0, 15/15
- `node --check audit.cjs`: exit 0
- `node --check assert-installer-registration-guard.cjs`: exit 0
- `bash -n super-gsd/install.sh`: exit 256 DENIED (`CreateFileMapping`, Win32 error 5)

DEVIATIONS:
Hook untouched. Both pins remain `5640a8ed92467cde81c80b95b747f3dd55285c2bdc338e26dc1c353db1fc1642`.

BLOCKERS:
Eight spawn-bound guards and Bash syntax require unsandboxed rerun.

ONE_LINER: No mutating call can now execute between the refusal being known and the process exiting.
