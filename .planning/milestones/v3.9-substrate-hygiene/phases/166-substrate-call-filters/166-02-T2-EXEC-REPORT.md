FILES_CHANGED: super-gsd/scripts/lib/vtp-context-composer.cjs (modified)  
FILES_CHANGED: super-gsd/scripts/lib/vtp-enrichment-gate.cjs (modified)  
FILES_CHANGED: super-gsd/scripts/sgsd-triage-runtime.cjs (modified)  
FILES_CHANGED: super-gsd/agents/sgsd-vtp-enrichment.md (modified)  
FILES_CHANGED: super-gsd/agents/sgsd-board-researcher.md (modified)  
FILES_CHANGED: super-gsd/tools/feature-propagation/audit.cjs (modified)  
FILES_CHANGED: super-gsd/tools/vtp-bridge/classify.cjs (modified)  
FILES_CHANGED: super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs (modified)  
FILES_CHANGED: super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs (modified)

VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case megachunk-degraded-artifact` -> exit 1 (expected red), then exit 0  
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case cap-shapes` -> exit 0  
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage` -> exit 0  
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case prompt-record-acceptance` -> exit 0  
VERIFICATION: `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case repair-safe-t2` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario vtp-fallback-contained-degradation` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case substrate-policy-required` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args` -> exit 0  
VERIFICATION: `node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json` -> exit 0  
VERIFICATION: `node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` -> exit 0  
VERIFICATION: `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` -> exit 0  
VERIFICATION: `node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test` -> exit 0  
VERIFICATION: `node super-gsd/tools/vtp-bridge/classify.cjs --self-test` -> exit 0 (13/13)  
VERIFICATION: scoped `node --check` loop -> exit 0  
VERIFICATION: scoped `git diff --check` and nine-file scope check -> exit 0  
VERIFICATION: frozen-file byte-change check -> exit 0

DEVIATIONS: [verification ownership] `executable-emitters` and `staged-vtp-oversized-response` were not run locally because they are orchestrator-owned spawn-bound suites; [stop_rule commit] no commit created per executor hard rule.

BLOCKERS: none

ONE_LINER: Added a pure 16,000-character substrate-hit cap with deterministic degradation notes, defensive artifact recapping, successful triage/prompt/bridge propagation, and no discarded-text leakage.
