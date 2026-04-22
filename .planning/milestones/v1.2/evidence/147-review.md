---
type: milestone-evidence
milestone: v1.2
external_repo_pin:
  repo: project-clarity-erp
  commits: ca5be16b..c41634c4
  reviewed_at: 2026-04-20
  review_path: ../../../../project-clarity-erp/.planning/phases/147-clarity-relay-map-w1/147-ATC-REVIEW.md
phase_source: 09-atc-147-evidence
created_at: 2026-04-22
---

# Phase 147 ATC Evidence — v1.2 Registry Pointer

This document is the stable consumption point for Phase 10+ reading Phase 9's empirical evidence.
The working-draft YAMLs live in `.planning/phases/09-atc-147-evidence/`; this registry doc is canonical.

## Summary

The retroactive ATC review of project-clarity-erp Phase 147 (commits ca5be16b..c41634c4, reviewed 2026-04-20)
surfaced 10 findings across 4 severity buckets. Headline finding count: **4** (real-bloat + integration-gap only;
nits and false-positives are tracked but do not drive Phase 10's hard-halt threshold).
Total gate-bypass cost across 16 T-commit dispatches: **9,340–18,940 tokens** (lower bound assumes
per-dispatch ATC at LITE/SKIP tier; upper bound assumes FULL-tier ATC on all 16 dispatches).
Source: `phase_source: 09-atc-147-evidence`.

## Classification

| ID | Bucket | Title | Justification |
|----|--------|-------|---------------|
| W1 | integration-gap | OwnerLookup / relay_owners ship with zero production consumers (cross-task gap) | Module is orphaned from production data path; tests prove it works, nothing proves it's used. |
| W2 | integration-gap | resolve_target_seconds never called; every event has sla.target_seconds=0 | Cross-task wiring gap between T5/T8/T9/T10; Fixed SLA in scope but wiring is missing. |
| W3 | real-bloat | Two unused imports (Iterator in calendar.py, lru_cache in owners.py) | Textbook dead imports; ATC point 2 fail; delete the two lines. |
| W4 | real-bloat | Canonical YAML path duplicated across three files with inconsistent naming | DRY violation; ATC point 4 (less code); extract to __init__.py. |
| I1 | false-positive | RelayLedger.recompute_sla paused= parameter never non-default | Explicitly justified as Phase-2 hook per spec §6.1; review labels it Acceptable. |
| I2 | false-positive | Pydantic model fields defined with no downstream reader (5 fields across 3 models) | Spec §6 schema expects them; Wave 2 consumers will read them. |
| I3 | nit | model_dump() + post-dump .value overwrite (ledger.py:74) | Idiomatic 1-line simplification; works correctly as-is. |
| I4 | nit | 5-min boundary floor leaves .second residue (relay_integration.py:117) | 1-line fix; overlaps tolerated by $gt semantics; no functional regression. |
| I5 | nit | datetime.utcnow() deprecated in Python 3.12+ (ledger.py:79, 96) | Non-blocking DeprecationWarning; tests run on py3.11; classic deprecation nit. |
| I6 | nit | @flow(infer_gate_events) wrapper not directly tested | Marginal coverage gap on ~8 lines; review labels it marginal. |

## Gate-Bypass Audit

| Step | Gate | Class | Per-Unit (tokens) | × | Total | Retro | Verdict Pointer to Phase 10 |
|------|------|-------|-------------------|---|-------|-------|-----------------------------|
| 2 | Haiku classifier | per-dispatch | 50 | 16 | 800 | | Was the bypass defensible because all 16 T-commits were same-type linear TDD tasks? Phase 10 to decide the skip-rule predicate for homogeneous phases. |
| 4 | Haiku context-selector | per-dispatch | 100 | 16 | 1600 | | Does context-selection add signal on homogeneous-task phases, or only on mixed-concern phases? Phase 10 decides whether to gate-skip on low-novelty phases. |
| 5 | ByteRover query injection | per-dispatch | 600 | 16 | 9600 | | Does ByteRover query injection warrant 600 tokens/dispatch on a fresh-codebase phase with no prior similar patterns to recall? Phase 10 decides entropy-gating. |
| 5.5 | INTENT injection | per-dispatch | 30 | 16 | 480 | | 30 tokens × 16 = 480 is tiny. Argument for kill is friction, not cost. Phase 10 weighs whether INTENT injection friction outweighs its orientation value on repeated-pattern phases. |
| 9.5 | Per-dispatch ATC (Step 9.5) | per-dispatch | 300 | 16 | 4800 | | The ATC review's own §5 says per-dispatch ATC would NOT have caught W1/W2 (cross-task integration gaps); only phase-level review could. Phase 10 decides if per-dispatch ATC keeps value for intra-task issues only. |
| 6 | Phase-level ATC (Step 6.5) | per-phase | 600 | 1 | 600 | ✓ | Phase-level ATC cost was PAID, just at phase+1 boundary. Keep/kill question is about SCHEDULING (inline vs deferred), not existence. |
| 7 | MUDA waste audit (Step 6.55) | per-phase | 100 | 1 | 100 | | 100 tokens is near-free. Argument for kill is redundancy with ATC, not cost. Phase 10 decides whether MUDA provides marginal signal beyond phase-level ATC on a TDD-heavy phase. |
| 10 | sgsd-curate learnings (Step 10) | per-dispatch | 50 | 16 | 800 | | 50 tokens × 16 = 800. On a phase with low novelty (TDD repeated pattern), curate may produce zero new patterns. Phase 10 decides entropy-gating (skip curate when dispatch is a repeat of a prior-task pattern). |
| 11 | Token-log JSONL (Step 11) | per-dispatch | 10 | 16 | 160 | | Near-zero cost (A1 assumption: ~10 tokens). Keep by default; kill only if logging itself causes observable issues. Even at 5× the estimate, gate 11 is <1% of total bypass cost. |

## Revert Clause

This evidence becomes STALE and must be re-opened if ANY of:
- External project-clarity-erp lands Wave 2 or later commits outside the pinned SHA range ca5be16b..c41634c4.
- super-gsd/skills/sgsd-orchestrate/SKILL.md changes the per-gate token budget for any of the 9 audited gates.
- Phase 147 code paths change such that W1 (OwnerLookup orphaning) or W2 (resolve_target_seconds orphaning) are wired to the production data path, reducing the integration-gap count.

Re-opening requires: (a) updating the external_repo_pin.commits SHA range to the new range, (b) re-running plan 09-01 classification against the new review, (c) re-running plan 09-02 bypass audit if SKILL.md budgets changed, (d) updating this registry pointer.
