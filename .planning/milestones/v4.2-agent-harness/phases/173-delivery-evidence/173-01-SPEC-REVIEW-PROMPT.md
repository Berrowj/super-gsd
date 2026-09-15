# Independent Spec review: full Phase 173 candidate

Read only these exact candidate paths: `super-gsd/tools/codex-worker/rpc.cjs`,
`super-gsd/tools/codex-worker/rpc.test.cjs`, and
`super-gsd/tests/codex-worker/install.test.cjs`; and these evidence paths:
`173-01-RPC-FRAMING-PLAN.md`, `173-01-PREREQUISITE-PLAN-AMENDMENT.md`,
`173-01-PREREQUISITE-LOCAL-EVIDENCE.md`, and the plan-check report.

Assess the whole exact patch against its bounded requirements. Confirm the
parser drains complete newline frames before capping only the retained partial
tail, keeps finite 4 MiB inbound and 1 MiB outbound limits, measures bytes,
and preserves invalid-JSON/error/auth/deadline/pending/cleanup/privacy
behavior. Confirm the install test retains real closure/source-isolation and
failure-atomicity coverage while its 31-route and canonical lock fixture
checks are history-supported and non-tautological. Do not edit anything.

Return exactly five physical lines, no Markdown/fences/prose before or after:

FINDINGS: <integer>
CRITICAL: <integer>
WARNINGS: <integer>
PASS_RATE: <integer>/<integer>
ONE_LINER: <concise verdict>
