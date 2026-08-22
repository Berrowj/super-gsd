FILES_CHANGED: super-gsd/tools/vtp-bridge/classify.cjs (modified); super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs (modified)
LINES_REMOVED: 21
VERIFICATION:
`node --check super-gsd/tools/vtp-bridge/classify.cjs` -> exit 0
`node --check super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` -> exit 0
`node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case cap-shapes` -> exit 0
`node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case megachunk-degraded-artifact` -> exit 0
`node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage` -> exit 0
`node super-gsd/tools/vtp-bridge/classify.cjs --self-test` -> exit 0
`node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` -> exit 0
`node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test` -> exit 0
`node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case substrate-policy-required` -> exit 0
`node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case emitted-args` -> exit 0
`node super-gsd/tests/triage-runtime/assert-mcp-arg-contract.cjs --case real-evidence --evidence-file .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json` -> exit 0
`node super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs --scenario vtp-fallback-contained-degradation` -> exit 0
`node super-gsd/tests/kb-triage-shadow/assert-shadow.cjs` -> exit 0
`git diff --check -- super-gsd/tools/vtp-bridge/classify.cjs super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` -> exit 0
DEVIATIONS: none
BLOCKERS: none
ONE_LINER: Notes are attached and costed before cap enforcement, with exact-cap and cap-minus-one coverage; packet elision preserved indexed objects, but book filtering lost raw positions, so hits are now indexed before filtering and the identity/doc/path/chunk fallbacks are removed.
