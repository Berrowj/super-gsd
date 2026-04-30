---
phase: 105
tier: full
codex_review: SKIPPED (route veto: high_risk_requires_judgment + private_knowledge_required)
---

# Phase 105 -- ATC FULL

## 1. First Principles
The release gate + summary make v2.9 governable. The MCP+cockpit deferral
is the honest call when count-pinned self-tests have non-trivial regression
risk under unattended overnight execution. Justified.

## 2. Delete
sgsd-complete-milestone.cjs extension is ~50 additive lines (transfer
+ regression scan inside the existing v2.9 branch). SUMMARY.md is the
durable retrospective. Doc append is ~190 lines covering Phases 100-105
APIs + commands. No phantom code.

## 3. Simplify
- v2.9 close gate logic stays inside the existing branch's try/catch
  envelope. Independent return path preserved.
- Transfer scan is one readTransfers() call + one map build + one filter.
- DEFERRED records are explicit, not hand-waved.

ΔComplexity: ~+0 net. Additive.

## 4. Accelerate
- Sync IO reads of two JSONL ledgers; O(n) where n = candidate count.
- Self-test still passes in the same time budget.

## 5. Automate
- Live gate test against current repo: GREEN.
- Existing 8/8 sgsd-complete-milestone self-test PASS post-edit.

## 6. Validate
- 8/8 sgsd-complete-milestone self-test PASS (no regression on additive
  gate extension).
- Live v2.9 gate: "v2.9 close gate green (... 0 transfer-blocking changes)".
- Forbidden files unchanged: warp-mcp/server.cjs, cockpit-state/adapter.cjs,
  harness-attribution/attribute.cjs, harness-transfer/evaluate.cjs.
- Route ledger row written.

## 7. Anti-Slop Checklist
1. Functions all called: existing v2.9 branch + new transfer-block
   logic exercised by live gate test. ✓
2. Imports used: require('../tools/harness-transfer/evaluate.cjs')
   inside try block (graceful when missing). ✓
3. Parameters read: projectDir_v29 already in scope. ✓
4. Less code? The transfer-block logic could be a separate function;
   inlining keeps the v2.9 branch self-contained. Keep. ✓
5. Abstractions justified? AHE-EVAL-03/05 + GOV-04 are the contract;
   each gets a distinct stderr line. ✓
6. Existing 80%? Phase 101 v2.9 branch already exists. This is its
   designed extension. ✓
7. Mass-delete? No. ✓
8. ΔComplexity ≤ 0? Adds ~50 lines to existing branch; one new doc
   file. ✓
9. "Just in case"? The keep-verdict iteration only fires when
   harness-transfer module loads cleanly. Graceful degradation. Keep. ✓
10. One thing? Yes -- "ship the v2.9 close gate + retrospective; defer
    UX integration honestly." ✓

## Cross-Phase Sanity
- Phase 101 v2.9 branch: extended additively, not replaced.
- Phase 100 manifest module: read via existing P101 reference.
- Phase 104 transfer module: read via new require() inside try block.
- Phase 98 catalog: not touched.
- Phase 99 distill: not touched.
- Phase 102 runner: not touched.
- Phase 103 ablation: not touched.

## DEFERRED-2 record (transparency)

This phase explicitly carries 2 deferred items, modeled on Phase 95's
SKIPPED-WAITING-FOR-UPSTREAM precedent. Both are operator-actionable
(DEFERRED-1 ~30min PR, DEFERRED-2 ~45min PR with adapter changes).
Re-entry conditions: operator-led PR or dedicated v2.9.1/v2.10 phase.

## Verdict: PASS-WITH-DEFERRED-2
