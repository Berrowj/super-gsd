FILES_CHANGED: super-gsd/config/repo-settings-overlay.json (modified)  
FILES_CHANGED: super-gsd/hooks/sgsd-substrate-invocation-witness.cjs (modified)  
FILES_CHANGED: super-gsd/scripts/lib/substrate-invocation-witness-store.cjs (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs (modified)  
LINES_REMOVED: 442  
PIN_REFRESHED: Both overlay digests now use `85fb7355fe6b435913373a51ad7422745d4f188b43be7d013f2ded7d04e063a5`  
VERIFICATION: PowerShell `node --check` loop over six relevant files -> exit 0  
VERIFICATION: PowerShell JSON, overlay-pin, diff, and frozen-file audit -> exit 0  
VERIFICATION: PowerShell minimal-runtime-seed isolation probe -> exit 0  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0, 37/37  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 1, nested `spawnSync` blocked by sandbox  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0, 4/4  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 1, `spawnSync node EPERM`  
VERIFICATION: registration guard `hook-manifest-completeness` -> exit 0  
VERIFICATION: registration guards `bundled-overlay-current`, `hook-distribution-all-types`, `brokered-substrate-capability` -> exit 1 each, `spawnSync bash EPERM`  
VERIFICATION: all ten P166 commands -> exit 0  
VERIFICATION: frozen P154 evidence and v1 schema diff check -> exit 0  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --verify --project-dir . --evidence-file .planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-REAL-MCP-HOOK-EVIDENCE.json` -> exit 1, `hook_source_hash_drift`  
VERIFICATION: nested-process sandbox probe -> exit 0, confirmed `status:null,error:EPERM`  
DEVIATIONS: none  
BLOCKERS: Orchestrator-owned live recapture must regenerate T5 evidence against the new source hashes; unsandboxed rerun is required for nested-process suites  
ONE_LINER: Each scenario now copies an isolated 402-file, 933,879-byte fixture/composer/schema/Ajv runtime seed, after which the real installer adds hook, broker, and store; only stable errors, scenario START/FINISH progress, and signed `post_passthrough` survived.

No commit created.
