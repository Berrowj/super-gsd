FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 2/2
ONE_LINER: Both round-1 changes are now mechanical, fail-closed, and fully enumerated.
VERDICT: GO
REQUIRED_CHANGES: none

Revision 2 requires `callVtp` to verify evidence, digest, and the exact v2 payload immediately before `mcpInvoke`; substrate `args.payload` bypasses and malformed envelopes are rejected before transport. Raw markdown-agent calls require matching composer evidence, with negative conformance cases for direct, missing-evidence, digest-mismatched, and unfiltered records.

SAC 1 names all eight verified production classifications. Caller coverage greps all production surfaces at test time and rejects every non-classified occurrence unless it exactly matches the declaration/observation allowlist. The explicit requirement that added or moved occurrences fail prevents the allowlist from absorbing a new caller. No accepted round-1 area regressed.

<!-- Contract lines VERDICT/REQUIRED_CHANGES and body salvaged from
     .planning/metrics/codex-live-output.txt after codex-exec truncated the
     written report to 138 B (known wrapper report-truncation behaviour).
     codex-review exit=0 duration=250s, 85,660 tokens. -->
