FILES_CHANGED:
- `super-gsd/scripts/lib/vtp-enrichment-gate.cjs` (modified)
- `super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` (modified)

VERIFICATION:
- `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case prompt-record-acceptance` -> exit 1 (expected RED before fix)
- `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case prompt-record-acceptance` -> exit 0
- `node super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs --case caller-coverage` -> exit 0
- `node super-gsd/scripts/lib/vtp-enrichment-gate.cjs --self-test` -> exit 0
- `node super-gsd/scripts/lib/vtp-context-composer.cjs --self-test` -> exit 0
- `git diff --check -- super-gsd/scripts/lib/vtp-enrichment-gate.cjs super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` -> exit 0
- `git diff --exit-code d63a6e6 -- super-gsd/schemas/vtp-mcp-input-schemas.v1.json .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json` -> exit 0

DEVIATIONS: none

BLOCKERS: `executable-emitters` was not run because this sandbox returns `spawnSync EPERM`; orchestrator verification remains required.

ONE_LINER: Chose mandatory gateway evidence for every `ok:false` result; the gate now accepts an error only when its record matches the orchestrator-supplied prepared envelope by schema, intent, digest, tool, and payload, so `{ok:false}` alone cannot falsely claim the exception path, while genuine pre-emission failures can report the already-prepared record and remain `api_error`.
