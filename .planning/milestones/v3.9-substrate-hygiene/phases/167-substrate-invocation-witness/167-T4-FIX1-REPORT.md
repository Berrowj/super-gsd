FILES_CHANGED:
- super-gsd/config/hook-manifest.json (modified)
- super-gsd/config/repo-settings-overlay.json (modified)
- super-gsd/install.sh (modified)
- super-gsd/scripts/merge-settings.js (modified)
- super-gsd/tools/feature-propagation/audit.cjs (modified)
- super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs (modified)
- super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs (modified)

VERIFICATION:
- `node -e "require('./super-gsd/scripts/merge-settings.js')"` -> exit 0
- `node super-gsd/tools/feature-propagation/audit.cjs --self-test` -> exit 0, 15/15 PASS
- `node --check` on all four JavaScript files -> exit 0
- JSON parse of both configuration files -> exit 0
- ESLint `no-undef` across all four JavaScript files -> exit 0, zero errors
- P166 static `auditCallerCoverage` probe -> exit 0, 31 occurrences, zero unknown, missing, or missing-occurrence rows
- `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs` -> child exit 64, expected usage dispatch
- `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-manifest-completeness` -> exit 0
- `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current` -> exit 1, `spawnSync bash EPERM`
- `bash -n super-gsd/install.sh` -> exit 256, sandbox `CreateFileMapping` access denied
- `git diff --check -- <seven T4 files>` -> exit 0
- `git diff --exit-code -- <two frozen files>` -> exit 0

DEVIATIONS: none

BLOCKERS: Fixture-backed cases cannot run in this sandbox because nested Bash/process execution returns EPERM. The orchestrator must rerun them.

ONE_LINER: `reconcileRepoLocalManagedIds` was declared inside `mergeSettingsFiles` but exported from module scope; it is now module-scoped, with no other undefined exports found. T4’s registration-guard commands are `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-manifest-completeness`; `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current`; `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-distribution-all-types`; `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case brokered-substrate-capability`. Only `brokered-substrate-capability` is a newly added dispatcher case.

P166 inventory was not loosened. `audit.cjs` contained five literal substrate occurrences before T4 and still contains five, all exactly consumed by the existing inventory. No commit was created.
