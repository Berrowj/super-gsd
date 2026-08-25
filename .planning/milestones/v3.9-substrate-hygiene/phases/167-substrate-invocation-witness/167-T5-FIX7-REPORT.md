FILES_CHANGED: `super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs` (modified)

VERIFICATION: focused redactor TDD RED checks -> exit 1 as expected  
VERIFICATION: focused redactor assertions -> exit 0  
VERIFICATION: `node --check` on capture and fixture -> exit 0  
VERIFICATION: `git diff --check -- <scoped files>` -> exit 0  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0 (34/34)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0 (4/4)  
VERIFICATION: PowerShell assertion for all four diagnostic groups and unchanged hard assertion -> exit 0

DEVIATIONS: Reading classification remains pending because source inspection cannot replace the requested live evidence.

BLOCKERS: A fresh PowerShell capture must be run by the orchestrator. It launches Claude, which this dispatch explicitly prohibited me from invoking. No prior disposable capture log survived. No evidence file was created.

ONE_LINER: None of the three readings is proven yet; the unchanged assertion now emits the redacted full valid result, denial response, fixture rows, and PostToolUse response needed to decide on the next live run.
