FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
DELETABLE_LINES: 0
DELTA_COMPLEXITY: zero for the fix itself; the T2 unit remains positive overall, justified by the four earned boundaries.
PASS_RATE: 10/10
ONE_LINER: Raw hit indexing now survives book filtering and cap elision, preventing cross-attachment.
VERDICT: PASS
REQUIRED_CHANGES: none

Confirmed root cause: filtering previously changed raw positions before
`_buildEvidencePacket`; indexing now occurs first, notes attach solely by
`hit_index` before cap enforcement, and retained objects preserve annotations
through sanitization.

Red/green replay showed distinct regressions: `dc8e40e` undercounted the
annotated result and retained it below the ceiling; separately, the shared-doc
book case attached all three notes. Live code reports six tokens, elides at
five, and retains only note index 2.

No dead helper, speculative parameter, or production-tree test copy. The
affected live files match `2e40c95`. The standard runner was sandbox-blocked
creating temp space; syntax/diff checks and the equivalent read-only replay
passed.

<!-- Reviewed commit 2e40c95. Salvaged from codex-live-output.txt. 92,067 tokens. -->
