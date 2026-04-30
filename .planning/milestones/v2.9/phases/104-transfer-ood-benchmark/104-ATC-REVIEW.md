---
phase: 104
tier: full
codex_review: SKIPPED (route veto: high_risk_requires_judgment + private_knowledge_required)
---

# Phase 104 -- ATC FULL

## 1. First Principles
AHE-P-07 makes transfer the overfit test. Without it, any harness change
that shows up well on the deterministic deck looks like a win even when
it generalizes poorly. The frozen-before-run rule is the integrity
guard. Justified.

## 2. Delete
evaluate.cjs ~245 lines (validation + freeze rule + 3 critical rules +
report writer + ledger). Self-test ~280 lines (18 assertions). No
phantom code.

## 3. Simplify
- Lock-13 envelopes everywhere.
- 3 frozen vocabs: decks (3) + env axes (5) + critical rules (3).
- Frozen-before-run rule is one Date.parse comparison.
- Report writer outputs flat markdown table; no template engine.

ΔComplexity: ~+0 net to existing flows.

## 4. Accelerate
- Sync IO + Date.parse; O(n) record validation.
- Self-test runs in <1s.

## 5. Automate
- 18-assertion self-test in one node invocation.
- recordTransfer auto-creates parent dirs.
- writeTransferReport produces operator-readable comparison table.

## 6. Validate
- 18/18 self-test PASS.
- node --check passes.
- Forbidden file honored: sgsd-blind-live-controller.mjs unchanged.
- Route ledger row written.

## 7. Anti-Slop Checklist
1. Functions all called: evaluateTransfer / recordTransfer /
   readTransfers / writeTransferReport / detectCriticalRegression /
   isFrozenBeforeRun / validateRecord all exercised. ✓
2. Imports used: fs / path only; no dead. ✓
3. Parameters read: opts.record, opts.baseline, opts.outPath consulted. ✓
4. Less code? validateRecord could share more with manifest.cjs but
   schema differs (different field set). Keep separate. ✓
5. Abstractions justified? Frozen-before-run + critical-regression
   detector are AHE contracts. ✓
6. Existing 80%? No prior transfer evaluator. ✓
7. Mass-delete? No. ✓
8. ΔComplexity ≤ 0? Adds new module; no existing edits. ✓
9. "Just in case"? readTransfers + writeTransferReport are needed by
   Phase 105 release-gate report. Keep. ✓
10. One thing? Yes -- "evaluate transfer; refuse claims that weren't
    frozen first." ✓

## Cross-Phase Sanity
- Phase 98 catalog: protected_oracle (sgsd-harness-benchmark.mjs) untouched.
- Phase 99 distill: not touched.
- Phase 100 manifest: not touched.
- Phase 101 attribute: not touched.
- Phase 102 runner: not touched.
- Phase 103 ablation: not touched.
- Phase 105 release gate will iterate readTransfers() rows for
  critical_regression filtering.

## Verdict: PASS
