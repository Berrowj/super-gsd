---
phase: 101
tier: full
codex_review: SKIPPED (route veto: high_risk_requires_judgment + private_knowledge_required)
---

# Phase 101 -- ATC FULL

## 1. First Principles
Without an attribution scorer, manifests are aspirational. AHE-P-10 says
regression prediction is first-class -- the scorer enforces that by
computing precision/recall on regressions independently of fixes.
The milestone gate enforces AHE-GOV-04: no clean ship with unattributed
candidate edits. Justified.

## 2. Delete
attribute.cjs ~245 lines (scorer + appender + reader + unattributed
scanner). Self-test ~290 lines (18 assertions). Gate branch ~85 lines
in sgsd-complete-milestone.cjs (independent return path). No phantom code.

## 3. Simplify
- Decision tree (RESEARCH D5) is 5 explicit branches + default. Verdicts
  are one of 6 frozen labels.
- Fix vs regression metrics are computed by separate functions; cannot
  contaminate.
- Surprises (FN regressions) surface via the `surprises[]` array on the
  regression_metrics object -- no nested verdict logic.
- Rollback emits a structured object (action / files / change_id /
  manual_command), never executes git.

ΔComplexity: ~+0 net to existing flows. New tools dir + additive branch.

## 4. Accelerate
- Sync IO. No external deps.
- Set lookups for label membership.
- Verdict logic is O(1) once metrics are computed.

## 5. Automate
- 18-assertion self-test in one node invocation.
- Cross-tool regression covered by complete-milestone-self-test 8/8.
- v2.9 gate is wired into the milestone-close pipeline.

## 6. Validate
- 18/18 attribution self-test PASS.
- 8/8 sgsd-complete-milestone self-test PASS (no regression on additive
  v2.9 branch).
- Live v2.9 gate run: "v2.9 close gate green (0 unattributed...)".
- Route ledger row written.

## 7. Anti-Slop Checklist
1. Functions all called: attribute / appendAttribution / readAttributions /
   findUnattributedManifests / computeFixMetrics / computeRegressionMetrics /
   pickVerdict all exercised. ✓
2. Imports used: fs / path only; no dead imports. ✓
3. Parameters read: opts.projectDir, repeated_same_class_failure
   consulted. ✓
4. Less code possible? Decision tree could be table-driven, but explicit
   reads better. Keep. ✓
5. Abstractions justified? Verdict vocab + fix/regression separation are
   the AHE contract. ✓
6. Existing 80%? No prior attribution. New surface. ✓
7. Mass-delete? No. ✓
8. ΔComplexity ≤ 0? Adds new module + additive gate branch. ✓
9. "Just in case" additions? findUnattributedManifests is required by
   the gate. computeFixMetrics is exposed for Phase 102 runner. Keep. ✓
10. One thing? Yes -- "score predictions; recommend keep/revert/pivot." ✓

## Cross-Phase Sanity
- Phase 100 manifest.cjs not touched (forbidden_files honored).
- Phase 99 distill.cjs not touched.
- Phase 98 catalog.cjs not touched.
- Phase 100 manifest schema is what produces the rows scanned by
  findUnattributedManifests; closed-vocab match preserved.
- Phase 102 runner will require() this module (per RESEARCH D7).
- Existing v2.6 gate untouched; v2.9 branch returns independently.

## Verdict: PASS
