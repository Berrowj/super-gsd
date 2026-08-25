Bounded failure is restored, strict rewrite-only acceptance remains, T3 wording is unchanged, and both overlay pins were refreshed to `5640a8ed92467cde81c80b95b747f3dd55285c2bdc338e26dc1c353db1fc1642`. No commit or live capture was performed.

FILES_CHANGED: `.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md` (modified)  
FILES_CHANGED: `.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REVERT-PROOF.md` (added)  
FILES_CHANGED: `.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-T1-DIFF.patch` (deleted)  
FILES_CHANGED: `super-gsd/config/repo-settings-overlay.json` (modified)  
FILES_CHANGED: `super-gsd/hooks/sgsd-substrate-invocation-witness.cjs` (modified)  
FILES_CHANGED: `super-gsd/scripts/lib/substrate-invocation-witness-store.cjs` (modified)  
FILES_CHANGED: `super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` (modified)  
FILES_CHANGED: `super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` (modified)  
FILES_CHANGED: `super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` (modified)  
FILES_CHANGED: `super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` (modified)  
FILES_CHANGED: `super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs` (modified)  
FILES_CHANGED: `super-gsd/tools/feature-propagation/audit.cjs` (modified)  
LINES_REMOVED: 2467  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0, 38/38  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0, 4/4  
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage` -> exit 0  
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case cap-shapes` -> exit 0  
VERIFICATION: `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` -> exit 0  
VERIFICATION: `node super-gsd/tools/feature-propagation/audit.cjs --self-test` -> exit 0  
VERIFICATION: `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-manifest-completeness` -> exit 0  
VERIFICATION: `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current` -> exit 1, managed sandbox `spawnSync bash EPERM`  
VERIFICATION: `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-distribution-all-types` -> exit 1, managed sandbox `spawnSync bash EPERM`  
VERIFICATION: `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case brokered-substrate-capability` -> exit 1, managed sandbox `spawnSync bash EPERM`  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 1, bounded-failure case passed before managed sandbox `spawnSync EPERM`  
VERIFICATION: `git diff --check` -> exit 0  
VERIFICATION: `Get-FileHash` plus both overlay-pin comparisons -> exit 0  
VERIFICATION: isolated `git revert --no-commit` proof for T5, T4, T3, T2, and T1 ranges -> exit 0  
DEVIATIONS: none  
BLOCKERS: none  
ONE_LINER: A malformed response now returns a small `isError` result containing `{"ok":false,"reason":"substrate_witness_rewrite_failed:malformed_response"}`, and the revert contract records the five real task commit sets while explicitly excluding unrelated privacy scrub `1339eab`.
