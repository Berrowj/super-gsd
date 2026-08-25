FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs (modified)  
FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/fixture-vtp-mcp-server.cjs (modified)  
VERIFICATION: PowerShell inline diagnostic probe via `node -` -> exit 0 (real messages, expected reasons, redaction, four stack frames, stderr)  
VERIFICATION: PowerShell exact export-surface probe via `node -` -> exit 0 (`buildDomainResult` and `parseArgs` only)  
VERIFICATION: `node --check` on both modified files and `git diff --check` -> exit 0  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-hook-contract.cjs` -> exit 0 (38/38)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-prompt-contracts.cjs` -> exit 0 (4/4)  
VERIFICATION: `node super-gsd/tools/feature-propagation/audit.cjs --self-test` -> exit 0 (15/15)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 1 (12 in-process cases passed, nested CLI status null)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs` -> exit 1 (`spawnSync node.exe EPERM`)  
VERIFICATION: installer guard `hook-manifest-completeness` -> exit 0  
VERIFICATION: installer guards `bundled-overlay-current`, `hook-distribution-all-types`, `brokered-substrate-capability` -> exit 1 each (`spawnSync bash EPERM`)  
VERIFICATION: eleven P166 policy, triage, and frozen-P154 regression commands -> exit 0 each  
VERIFICATION: P166 `executable-emitters` -> exit 1 (nested composer CLI status null)  
VERIFICATION: composer, enrichment, bridge 13/13, and P152 shadow self-tests -> exit 0 each  
VERIFICATION: PowerShell protected-file, hash, and pin audit -> exit 0 (hook `5640a8ed92467cde81c80b95b747f3dd55285c2bdc338e26dc1c353db1fc1642`, two matching pins; hook/store untouched, so no refresh required)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --capture ...` -> exit 1 (`claude_auth_environment_missing`, no Claude launch)  
VERIFICATION: `node super-gsd/tests/substrate-invocation-witness/capture-live-runtime.cjs --verify ...` -> exit 1 (`hook_source_hash_drift`, pending recapture)  
DEVIATIONS: none  
BLOCKERS: Live capture requires the orchestrator environment with inherited Claude authentication. Nested-process suites are blocked by managed-sandbox `EPERM`; independent verification remains stale until recapture.  
ONE_LINER: The reproduced exception was `TypeError: fixture.buildDomainResult is not a function`; restored only `fixture.buildDomainResult` for live capture and `capture.parseArgs` for the orchestrator probe.
