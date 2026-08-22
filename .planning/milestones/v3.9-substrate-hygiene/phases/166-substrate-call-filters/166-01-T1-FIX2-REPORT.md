FILES_CHANGED:
- super-gsd/agents/sgsd-board-researcher.md (modified)
- super-gsd/agents/sgsd-vtp-enrichment.md (modified)
- super-gsd/scripts/lib/vtp-context-composer.cjs (modified)
- super-gsd/scripts/lib/vtp-enrichment-gate.cjs (modified)
- super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs (modified)
- super-gsd/tools/feature-propagation/audit.cjs (modified)

VERIFICATION:
- `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case prompt-record-acceptance` -> exit 0
- `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage` -> exit 0
- `node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case substrate-policy-required` -> exit 0
- `node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args` -> exit 0
- `node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json` -> exit 0
- `node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-null-reflection-fallback` -> exit 0
- `node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario vtp-fallback-contained-degradation` -> exit 0
- `node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario staged-vtp-oversized-response` -> exit 0
- `node super-gsd/tools/vtp-bridge/classify.cjs --self-test` -> exit 0
- `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` -> exit 0
- `node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test` -> exit 0
- `node super-gsd/tools/feature-propagation/audit.cjs --self-test` -> exit 0
- `node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` -> exit 0
- `git diff --check 11cea52 -- super-gsd` -> exit 0
- `git diff --exit-code 11cea52 -- super-gsd/schemas/vtp-mcp-input-schemas.v1.json .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json` -> exit 0

DEVIATIONS: none. `executable-emitters` was not run, as instructed, because the sandbox blocks its nested Node process with `spawnSync EPERM`. No commit was created.

BLOCKERS: none

ONE_LINER: CRITICAL 1 now hard-fails invalid prompt records through production acceptance and the real enrichment gate path; CRITICAL 2 now consumes exact occurrences or bounded branches once and proves rogue calls fail in both known and new files.
