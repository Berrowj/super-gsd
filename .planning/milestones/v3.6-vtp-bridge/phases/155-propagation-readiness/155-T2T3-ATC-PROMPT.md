# P155-T2-T3 per-dispatch ATC (GATE tier, SDD reviewer stage 2)

Read only. Spec compliance findings are closed (verified mechanically: zero residual
private phase-name regexes in resolve.cjs, resolver present in the matrix, distill
globs and empty-corpus assertion fixed). Do not re-check plan conformance.

Quality review of the final diff: `git diff -- super-gsd/` or `155-T2T3-DIFF.txt`.
Focus files: scripts/lib/phase-name.cjs (new, the load-bearing parser),
tests/propagation-readiness/assert-install-layout.cjs, assert-dual-root-resolvers.cjs,
and the consumer/installer edits.

Known and accepted, do not flag: 23 of 420 matrix cases fail on state-resolver
evidence-tier behaviour (activity/git markers, absent-root exit codes) — that is T4b
scope by design and those cases are T4b's acceptance surface.

Apply the ATC 10-point anti-slop checklist. Specifically:
- phase-name.cjs: is the comparator total and stable across mixed schemes? Any
  ambiguity between "14" the legacy phase and "14" inside v-tokens? realpath dedup on
  Windows paths (case, separators)?
- Shell consumers calling the JSON CLI: quoting, non-zero-exit handling, no
  swallowed errors (exit-code masking is this repo's most-recorded defect class).
- Any duplication between the two new test files and existing assertion owners.

Output, contract lines first, then max 150 words:
```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
FINDINGS_DETAIL: [severity] [dimension] <description>   (per CRITICAL/WARNING, omit if none)
```
