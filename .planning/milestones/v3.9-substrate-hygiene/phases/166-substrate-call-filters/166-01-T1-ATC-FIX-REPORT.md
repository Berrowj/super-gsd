FILES_CHANGED: super-gsd/agents/sgsd-vtp-enrichment.md (modified)  
FILES_CHANGED: super-gsd/scripts/sgsd-triage-runtime.cjs (modified)  
FILES_CHANGED: super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs (modified)  
LINES_REMOVED: 32  
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage` -> exit 0  
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case prompt-record-acceptance` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case substrate-policy-required` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-null-reflection-fallback` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario vtp-fallback-contained-degradation` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-oversized-response` -> exit 0  
VERIFICATION: `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` -> exit 0  
VERIFICATION: `node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test` -> exit 0  
VERIFICATION: `node super-gsd/tools/vtp-bridge/classify.cjs --self-test` -> exit 0, 11/11  
VERIFICATION: `node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` -> exit 0  
VERIFICATION: `node --check` on modified CJS files and audit.cjs -> exit 0  
VERIFICATION: prompt JS/YAML structure parser -> exit 0  
VERIFICATION: residue-absence assertion -> exit 0  
VERIFICATION: `git diff --check` -> exit 0  
VERIFICATION: frozen-file `git diff --exit-code` -> exit 0  
DEVIATIONS: Kept the explicit missing-record gate guard. Removing it changed the established both-missing path from `substrate_call_record_missing` to `prepared_call_missing_or_invalid` and failed prompt-record-acceptance.  
BLOCKERS: `executable-emitters` not run because its `spawnSync` path is sandbox-blocked; orchestrator verification required.  
ONE_LINER: Fixed the malformed literal, removed dead payload/fallback/shaping/copy residue and the duplicate prompt assertion, replaced full copies with a node_modules-excluding production scan plus both fail-closed fixtures, kept the missing-record guard to preserve its tested path, and left everything uncommitted.
