---
phase: 103
tier: full
codex_review: SKIPPED (route veto: high_risk_requires_judgment + private_knowledge_required)
---

# Phase 103 -- ATC FULL

## 1. First Principles
AHE-P-08/09 (locate gains by swapping; expect interference) requires the
ability to disable one component at a time and measure cost+correctness.
Without this, "we should keep this gate because it sounds right" wins.
Justified.

## 2. Delete
ablate.cjs ~265 lines (5 public fns + 3 interference rules). Self-test
~310 lines (18 assertions). No phantom code.

## 3. Simplify
- Lock-13 envelopes everywhere: { ok, errors, ... }.
- Workspace isolation uses copy + rename; no in-place modification.
- Interference rules are 3 frozen named contracts.
- No external deps; fs + path + os only.
- Restore refuses paths outside os.tmpdir() (defense-in-depth).

ΔComplexity: ~+0 net to existing flows. New tools dir.

## 4. Accelerate
- Sync IO with shallow copy (only target paths).
- Self-test runs in <2s.

## 5. Automate
- 18-assertion self-test in one node invocation.
- recordAblation auto-creates parent dirs.

## 6. Validate
- 18/18 self-test PASS.
- node --check passes.
- Forbidden file honored: sgsd-harness-benchmark.mjs unchanged
  (protected_oracle classification preserved).
- Route ledger row written.

## 7. Anti-Slop Checklist
1. Functions all called: planAblation / isolateWorkspace /
   restoreWorkspace / recordAblation / detectInterference /
   validateAblationSpec exercised. ✓
2. Imports used: fs / path / os only. ✓
3. Parameters read: opts.projectDir, ablation_id, target_files
   consulted. ✓
4. Less code? Could fold validate into plan, but separating gives a
   testable validator. Keep. ✓
5. Abstractions justified? Lock-13 + INTERFERENCE_RULES + protected
   guard match Phase 98 contract. ✓
6. Existing 80%? No prior ablation runner. New surface. ✓
7. Mass-delete? No. ✓
8. ΔComplexity ≤ 0? Adds new module; no existing edits. ✓
9. "Just in case"? restoreWorkspace's tmpdir-only guard is safety
   not speculation. Keep. ✓
10. One thing? Yes -- "ablate components in isolation; surface
    interference signals." ✓

## Cross-Phase Sanity
- Phase 98 catalog: protected_oracle classification respected
  (sgsd-harness-benchmark.mjs untouched).
- Phase 99 distill: not touched.
- Phase 100 manifest: not touched.
- Phase 101 attribute: not touched.
- Phase 102 runner: not touched.
- Phase 104 transfer eval will consume requires_transfer_eval flag from
  every plan record.

## Verdict: PASS
