FILES_CHANGED: `super-gsd/hooks/sgsd-substrate-invocation-witness.cjs` (modified); `super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` (modified)

VERIFICATION: pre-fix installed-path assertion -> exit 1, expected RED; `node --check super-gsd/hooks/sgsd-substrate-invocation-witness.cjs` -> exit 0; `node --check super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0; installed Pre/Post non-substrate probes -> exit 0; `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0, 34/34; `git diff --check -- super-gsd/hooks/sgsd-substrate-invocation-witness.cjs super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0; frozen-file `git diff --exit-code` -> exit 0

DEVIATIONS: none

BLOCKERS: Twelve P166 regressions were not run here; orchestrator-owned verification remains

ONE_LINER: Non-substrate events now return `null` even with installed-CLI `expectedEvent`; 18 other generated cases omit `expectedEvent`, but still prove their named canonical-substrate behavior because their tool and event match the production path.
