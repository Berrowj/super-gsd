FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 7/7
ONE_LINER: Correlation is runtime/store-derived, consumption-backed, project-bound, replay-safe, and preserves P166/T1.
VERDICT: PASS
REQUIRED_CHANGES: none

Project and session come from runtime CWD and environment; payload selection is
recomputed from the separately validated prepared envelope, while the hook row
derives its digest from actual `tool_input`. The supplied record contributes no
witness-selection field. Production call sites do not pass the test-only context
override.

The different-project test injects context and does not exercise fallback.
However, fallback is exercised by state-less gate fixtures. It binds the spool to
the real CWD's project digest; mismatched roots fail closed and cannot consume
another project's row.

Replay is enforced by atomic row claim and state transition: two rows support two
acceptances, then consumed rows produce replay refusal. All forged-record checks
precede consumption, and the surviving row is subsequently accepted.

The fix diagnosis is correct: without its own `STATE.md`, the nested fixture
resolved to the outer repository, making its relative files invalid there. Adding
the marker corrected the fixture; containment definitions remained unchanged.

The commit changes exactly three files. T1 and frozen-file hashes match
`f939314`; P166 gateway and order, eight-site inventory, cap, and rejection logic
remain intact. Fresh syntax, diff, scope, and hash checks passed. Added wording
makes no same-user protection overclaim.

<!-- Reviewed commit 5ec8f1c. Salvaged from codex-live-output.txt after report
     truncation to 171 B. 211,716 tokens. -->
