Fixed without reverting bare-array parsing or weakening acceptance. Both overlay pins now use hook hash `230e7b93881f2528fd6af2bd10d11c4461acd81bc2fc18734b8bf91eed473b20`.

```text
FILES_CHANGED: super-gsd/hooks/sgsd-substrate-invocation-witness.cjs (modified)
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs (modified)
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs (modified)
FILES_CHANGED: super-gsd/config/repo-settings-overlay.json (modified)
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 1 (expected RED: substrate_witness_not_rewritten)
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0 (37/37)
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0 (4/4)
VERIFICATION: PowerShell direct T2 CLI acceptance -> exit 0
VERIFICATION: PowerShell direct T2 replay check -> exit 0 (inner CLI exit 1: substrate_witness_replayed)
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case prompt-record-acceptance` -> exit 0
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage` -> exit 0
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case cap-shapes` -> exit 0
VERIFICATION: `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` -> exit 0
VERIFICATION: `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case hook-manifest-completeness` -> exit 0
VERIFICATION: scoped `node --check`, JSON parse, frozen-artifact, diff, and final hash-pin checks -> exit 0
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 1 (nested process status null in sandbox)
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 1 (spawnSync node.exe EPERM)
VERIFICATION: `node super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs --case bundled-overlay-current` -> exit 1 (spawnSync bash EPERM)
DEVIATIONS: none
BLOCKERS: Full nested-spawn T2/T4/installer and live-capture verification remains orchestrator-required because this sandbox returns EPERM.
ONE_LINER: The malformed-response unchanged-passthrough path skipped the transition; `rewritten` now means authenticated PostToolUse processing completed, while the separate post-condition row records that delivery was unchanged.
```
