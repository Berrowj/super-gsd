FINDINGS: 1
CRITICAL: 1
WARNINGS: 0
PASS_RATE: 6/7
ONE_LINER: Active hooks enforce denial/rewrite, but total hook deletion still exposes raw output before the only mechanical refusal.
VERDICT: NOGO
REQUIRED_CHANGES:

1. Mechanically disable the raw tool when both hooks or their source are absent,
   via protected/managed policy or an independent boundary, and add an SAC
   deleting both registrations and source, proving no server invocation or raw
   transcript delivery.

ATC: The active path is sound. T1 requires `permissionDecision: deny` and
`updatedMCPToolOutput`; SAC 1 would catch logging-only behaviour through the
server log, 16,000-character transcript, and discarded marker.

The critical gap is absence. SAC 3 removes only PostToolUse, leaving PreToolUse
able to deny. If both registrations, or the hook source, are deleted, neither
boundary fires. Audit exits 2 and `acceptPromptSubstrateCallRecord` refuses, but
acceptance occurs after raw output has entered model context. T3's preflight is
prompt instruction, and the plan itself says at line 392 that it is not
enforcement.

The remaining checks pass: session plus hook-computed digest; modest
`local_hmac` claims; real Claude/runtime boundary with a fixture MCP server;
explicit P166 regressions. MUDA is proportionate; only the redacted metrics
mirror is plausibly optional.

<!-- Reviewed 167-01-PLAN-LOCKED.md revision 1. Salvaged from
     codex-live-output.txt after report truncation. 81,145 tokens. -->
