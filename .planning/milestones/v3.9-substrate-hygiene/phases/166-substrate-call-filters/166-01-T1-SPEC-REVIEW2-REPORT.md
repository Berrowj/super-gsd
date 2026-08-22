FINDINGS: 1
CRITICAL: 1
WARNINGS: 0
PASS_RATE: 10/11
ONE_LINER: Coverage is closed, but prompt-record acceptance remains fail-open for recordless API-error results.
VERDICT: FAIL
REQUIRED_CHANGES:

1. Require production-verified evidence for `ok:false` results, or a
   mechanically verified no-transport state; test the wholly absent record
   branch.

CRITICAL 1 remains. In vtp-enrichment-gate.cjs around line 418, `{ok:false}`
with no `substrate_call_record` bypasses both checks and is accepted as
`api_error`, writing an artifact. A live in-memory production-path probe
confirmed this. The acceptance test covers missing records only on `ok:true`,
so it passes without exercising this downgrade.

CRITICAL 2 is closed. Rules use exact text or anchored patterns,
branch-sensitive duplicates are bounded, and classifications are single-use.
Fresh adversarial probes confirmed both a rogue known-file occurrence and a
duplicated legitimate caller line fail closed.

<!-- Reviewed commit d63a6e6. VERDICT/REQUIRED_CHANGES/body salvaged from
     codex-live-output.txt after report truncation. 127,454 tokens. -->
