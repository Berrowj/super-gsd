---
phase: 99
tier: full
codex_review: SKIPPED (route veto: private_knowledge_required)
---

# Phase 99 -- ATC FULL

## 1. First Principles
The distiller is what makes harness evolution tractable. Without it, every
proposed edit forces an agent to read raw multi-MB JSONL. With it, agents
read a 4KB overview and drill down only where needed. Justified.

## 2. Delete
Reviewed: distill.cjs ~330 lines (rule-based classifier, JSONL reader,
group-by-phase-plan, OVERVIEW + INDEX + tasks emitter). Self-test ~250
lines (18 assertions, no duplication). Doc append ~95 lines. Total well
within budget. No phantom code.

## 3. Simplify
- 11-label closed vocab frozen via Object.freeze. Drift is hard error.
- Lock-13 envelope: { ok, run_id, overview_path, index_path, task_paths,
  errors, overview_size_bytes }. Single shape, never throws.
- Classifier is 10 string/regex tests + unknown fallback. Deterministic.
- groupByPhasePlan is one O(n) pass.
- OVERVIEW caps the listed groups at 20 + summary line.

ΔComplexity: ~0 net (3 new files; doc supplement; gitignore + 1 line).

## 4. Accelerate
- One sync read per JSONL source (7 files), one sync write per output.
- Per-task report list is bounded by unique phase:plan keys.
- No external deps. No subprocess spawn.

## 5. Automate
- Self-test runs all 18 assertions in one invocation.
- CLI emits human or JSON output (--json flag).
- Default outDir under .planning/harness-evolution/runs/ is gitignored.

## 6. Validate
- 18/18 self-test passes.
- node --check passes on both files.
- Live run against ahe-paper-smoke: ok=true, 1999-byte overview, 1265
  historical groups (operator should --since-window for production use).
- Route ledger row written (chosen=claude, reason=private_knowledge_required).

## 7. Anti-Slop Checklist
1. Functions all called: distillRun/classifyEvent/groupByPhasePlan all
   exercised by self-test + CLI. ✓
2. Imports used: fs/path/os referenced; no dead imports. ✓
3. Parameters read: opts fields all consulted. ✓
4. Less code possible? YAML/JSONL parsing is the bulk; can't shrink
   without external dep (forbidden). ✓
5. Abstractions justified? 11-label vocab + 7-source frozen list are the
   contract, not premature. ✓
6. Existing 80%? No prior distiller. New surface. ✓
7. Mass-delete? No -- every fn is on the read or write path. ✓
8. ΔComplexity ≤ 0? Adds new tool dir but no edit to existing code. ✓
9. "Just in case" additions? --since/--until/--benchmark flags are all
   named in CONTEXT acceptance. Keep. ✓
10. One thing? Yes -- "distill JSONL+benchmark into layered corpus." ✓

## Cross-Phase Sanity
- Phase 98 catalog.cjs not touched (forbidden_files honored).
- Phase 100 manifest tooling will require() this distiller's classifier.
- Phase 101 attribution will compare distilled labels with manifest predictions.
- Phase 105 release gate will run distiller as part of E2E flow.
- 1265-group historical scan flags v2.9 operator UX risk: must ALWAYS
  use --since for post-run distillation. Documented in HARNESS-EVOLUTION.md.

## Verdict: PASS
