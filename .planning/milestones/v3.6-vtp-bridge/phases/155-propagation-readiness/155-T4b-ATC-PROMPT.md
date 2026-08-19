# P155-T4b per-dispatch ATC (GATE tier, final diff after revert pass)

Read only. Spec drift findings are closed (verified: roadmap_run precedence restored,
legacy closed-status vocab restored, sample sidecar out of the diff). Quality review of
the settled diff only: `155-T4b-DIFF.txt` in the phase dir (357 insertions, 211
deletions in resolve.cjs) plus assert-state-resolver.cjs against the working tree.

Apply the 10-point anti-slop checklist. Specifically for this diff:
- ROADMAP-table ordering: does the parser tolerate roadmap format drift (missing table,
  reordered columns, phases absent from the table) by abstaining rather than throwing?
- Abstention paths: does every abstain fall through to the NEXT tier rather than
  terminating resolution? Any swallowed errors on the new paths?
- The devcp fixture in assert-state-resolver.cjs: does it assert on outcomes (winner,
  no backwards re-sync) rather than implementation details that would make future
  legitimate refactors fail?
- Dead code left from the revert (unused helpers from the reverted precedence path).

Output, contract lines first, then max 150 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>   (per CRITICAL/WARNING, omit if none)
```
