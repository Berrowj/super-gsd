FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 12/12
ONE_LINER: Notes are budgeted exactly before enforcement; raw-index preservation changes annotation only, not book-hit admission.
VERDICT: PASS
REQUIRED_CHANGES: none

A no-write probe confirmed cap 6 retains the unchanged note with
`body_token_estimate: 6`; cap 5 elides exactly one result and emits
`evidence_packet_size_capped`. Book admission remained identical while note
indices preserved raw positions. Fix scope is limited to `classify.cjs` and its
policy test; frozen P154 evidence and v1 schema hashes are unchanged.
Temp-writing suites were sandbox-blocked, but their assertions and the supplied
17/17 unsandboxed evidence were audited.

<!-- Reviewed commit 2e40c95. Salvaged from codex-live-output.txt. 139,637 tokens. -->
