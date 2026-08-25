FILES_CHANGED:
- `super-gsd/install.sh` (modified; allowlist’s `scripts/install.sh` does not exist)
- `super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs` (modified)

VERIFICATION:
Guard command `node … --case <name>`:
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
- `node --check …assert-installer-registration-guard.cjs`: exit 0
- `bash -n super-gsd/install.sh`: exit 256 DENIED (`CreateFileMapping`, access denied)

DEVIATIONS: Hook untouched. Existing SHA-256 pins match `5640a8ed92467cde81c80b95b747f3dd55285c2bdc338e26dc1c353db1fc1642`.

BLOCKERS: Eight spawn-bound guards and shell syntax require unsandboxed rerun.

ONE_LINER: Guard now joins smoke calls by path+event; production defers masked Codex refusal and emits plain audit detail; fixture deduplicates witness removal and restores it in the repaired seed.
