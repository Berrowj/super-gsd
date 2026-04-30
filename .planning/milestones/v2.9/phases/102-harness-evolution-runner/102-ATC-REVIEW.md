---
phase: 102
tier: full
codex_review: SKIPPED (route veto: high_risk_requires_judgment + private_knowledge_required)
---

# Phase 102 -- ATC FULL

## 1. First Principles
The runner IS the AHE outer loop. Phase 98-101 substrates are inert
without a binding driver. This is justified, but only if the runner stays
conservative -- which it does (no `--commit`, no LLM, no oracle reads).

## 2. Delete
run.cjs ~280 lines (4 modes + protected guard + spec parser). Self-test
~280 lines (17 assertions). README ~155 lines. Total within budget.

## 3. Simplify
- Each mode is a single Lock-13 function with a clear envelope.
- protectedSurfaceCheck is shared across modes; one source of truth.
- Spec -> manifest mapping is explicit (specToManifestEntry).
- No flag-soup; --commit deferred to Phase 103.

ΔComplexity: ~+0 net to existing flows. New tools dir only.

## 4. Accelerate
- Sync IO; no spawned processes in self-test.
- Catalog read once per check.

## 5. Automate
- 17-assertion self-test runs in <1s.
- Each public function has at least one fixture-driven assertion.
- Evolution-log JSONL appends visible after each mode (auditable).

## 6. Validate
- 17/17 self-test PASS.
- node --check passes.
- No regression in upstream modules: forbidden_files honored, no edits to
  catalog/manifest/attribution/distill/double-agent-executor.
- Route ledger row written.

## 7. Anti-Slop Checklist
1. Functions all called: 4 modes + protectedSurfaceCheck +
   specToManifestEntry + appendEvolutionEvent + logPath all exercised
   by self-test. ✓
2. Imports used: fs / path only; no dead imports. ✓
3. Parameters read: opts.specPath, opts.projectDir, opts.mockProvider
   all consulted. ✓
4. Less code possible? Could fold dry-run + proposal-only into one fn
   with a flag, but explicit modes read better. Keep. ✓
5. Abstractions justified? Lock-13 envelope across 4 modes is the AHE
   contract. ✓
6. Existing 80%? No prior runner. New surface. ✓
7. Mass-delete? No. ✓
8. ΔComplexity ≤ 0? Adds new module + README; no edits to existing. ✓
9. "Just in case" additions? Apply-candidate is route-only stub now;
   --commit is explicit Phase 103 work, not speculative. Keep. ✓
10. One thing? Yes -- "wire AHE substrates into a safe outer loop." ✓

## Cross-Phase Sanity
- Phase 98 catalog.cjs not touched (forbidden_files honored).
- Phase 99 distill.cjs not touched.
- Phase 100 manifest.cjs not touched.
- Phase 101 attribute.cjs not touched.
- Phase 100 schema cross-link (harness_change_id on capsule) is the
  bridge for Phase 103+ apply path -- nothing speculative wired today.
- Phase 105 will add MCP/cockpit surface; this phase does not.

## Verdict: PASS
