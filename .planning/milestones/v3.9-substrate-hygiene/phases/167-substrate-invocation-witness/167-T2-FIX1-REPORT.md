FILES_CHANGED: super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs (modified)

VERIFICATION: `node --check super-gsd/scripts/lib/vtp-context-composer.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/substrate-invocation-witness/assert-witness-correlation.cjs` -> exit 0  
VERIFICATION: `node --check super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` -> exit 0  
VERIFICATION: containment contract probe using `findSgsdRoot` and `resolveContainedPath` -> exit 0  
VERIFICATION: `git diff --check -- super-gsd/scripts/lib/vtp-context-composer.cjs super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs` -> exit 0  
VERIFICATION: `git diff --exit-code -- super-gsd/schemas/vtp-mcp-input-schemas.v1.json .planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json` -> exit 0

DEVIATIONS: none

BLOCKERS: Correlation and regression suites remain ORCHESTRATOR_REQUIRED because nested process execution returns EPERM in this sandbox. They were not run here.

ONE_LINER: Cause 1, the test was wrong. The CLI contract uses project-relative `.planning/tmp` files and roots them through `findSgsdRoot`, which requires `.planning/STATE.md`; the T2 fixture omitted that marker and therefore resolved against the outer repository, while the existing P166 CLI fixture includes it. The test fixture now includes `STATE.md`; production containment is unchanged.
