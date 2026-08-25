FILES_CHANGED: [super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs) (modified)

VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: semantic comparison regression probe -> exit 0  
VERIFICATION: module load probe -> exit 0  
VERIFICATION: no-argument CLI -> exit 1, synchronous progress plus `choose_exactly_one_mode`  
VERIFICATION: missing-evidence verify CLI -> exit 1  
VERIFICATION: forced exit-0 with absent evidence -> exit 1  
VERIFICATION: forced exit-0 with invalid evidence -> exit 1  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0, 34/34  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0, 4/4  
VERIFICATION: `git diff --check -- super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` -> exit 0  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 1 after 11 passes because nested `spawnSync` returned sandbox `EPERM`

DEVIATIONS: Live capture was not run because invoking Claude was explicitly forbidden. Fixture unchanged. No evidence file created. Independent review added verifiable raw/canonical comparison hashes and full evidence validation at process exit.

BLOCKERS: The prior transcript was cleaned, so the actual model payload cannot be recovered. The next orchestrator live run must show `PROGRESS: harness_entry START`, followed on mismatch by prepared JSON, actual JSON, key orders, types, and semantic verdict. Exit 0 must include evidence that parses and passes `verifyEvidence`. If output remains entirely absent, the patched file was not executed or an external wrapper misreported the child status.

ONE_LINER: The CLI’s default-zero, pre-settlement silence window is now closed before project imports with synchronous output and fail-closed evidence verification; the mismatch was an order-sensitive serialization assertion, with composer order `query, source_types, limit` versus schema order `query, limit, source_types`, while the exact live model order awaits the emitted dump.
