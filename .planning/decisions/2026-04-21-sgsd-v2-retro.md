---
type: decision-note
date: 2026-04-21
kind: floor-gated
brief: .planning/briefs/2026-04-21-sgsd-v2-retro-and-forward.md
parent_brief: .planning/briefs/2026-04-21-orchestrator-contract.md
scope: "RQ1-RQ4 — retro on Phase A-E + v1.2 sequencing"
operator: user
reviewer: none (FLOOR below-threshold, revertable)
revertable: true
gate_score: below-floor-shipped
---

# Decision Note: SGSD v2 Retro + Forward (Below-FLOOR Ship)

## Context

Phase A-E of SGSD v2 landed 2026-04-21 12:30–15:00 UTC (commits `d1ba19e..9fa44ac`) outside the phase state machine. The child brief `2026-04-21-sgsd-v2-retro-and-forward.md` asks 4 questions — three retro (RQ1-RQ3), one forward (RQ4). Brief trips `DELIBERATION-FLOOR.md` on revertability only (`q1_impl_hours: 0, q1_revertable: true`). FLOOR gate verdict: *ship directly, file one-paragraph decision note, retrospect at milestone close.* This note discharges that prescription.

## Verdicts

**RQ1 — 8-executor partition.** KEEP pending dispatch data. Re-evaluate at v1.2 close using two signals: (a) per-executor dispatch-log share from `.planning/metrics/activity-log.jsonl`, (b) expertise-file cosine overlap between neighbouring executors. Auto-merge trigger: any executor <10% share AND >60% expertise overlap with a peer for two consecutive milestones.

**RQ2 — 8 registries vs brief's 3.** ACCEPT as principled scope expansion under AGP-P-02 ("all system components as first-class versioned resources"). Parent brief's R-Q5 named `hooks/decisions/gates` as illustrative, not a ceiling. `board-members.yaml` and `agents.yaml` are legitimate registered resources; `handover-contract-v2.yaml` stays in `registry/` because AGP-P-07 lifecycle treats contracts as resources. No demotion.

**RQ3 — FLOOR inheritance rule.** Precedent set: **FLOOR operates per-brief; cascade does not trigger re-inheritance.** The gate reads only the current brief's frontmatter. If a parent brief trips FLOOR but a child brief does not, the child ships below-floor on its own score — even when addressing questions the parent bundles. RQ3c (structural repair — amend `DELIBERATION-FLOOR.md` to add brief-level override) is rejected: would force every trivial visibility change to inherit parent governance cost and would empty the FLOOR of meaning. Trade-off accepted: some Q1/Q4/Q5/Q8 cascade lands unreviewed; in exchange, governance surface stays proportional to per-decision risk.

**RQ4 — v1.2 sequencing.** ADOPT **v1.2-B (Evidence-first)**: Phase 147 retroactive ATC → Q2 gate policy → Q3 plan schema v2 → Q6a-d orchestrator sharpenings → Q7a-g deliberate-skill sharpenings. Rationale: Q2 is the only parent question blocked on external evidence; pulling it forward unblocks Q3 (which declares `expected_ATC_tier` and needs Q2's keep/kill matrix stable first). Q6/Q7 mechanical gains compound atop a stable schema, so they come last. Does not force re-do of Phase A/C/D/E registries — v1.2-B respects what already shipped.

## Precedent Set

1. **FLOOR gate is per-brief, not per-question-tree.** Child briefs of FLOOR-tripping parents ship below-floor on their own scores.
2. **AGP-P-02 resource protocol scope is a floor, not a ceiling.** Additional registries don't require re-brief unless they change `gates.yaml` or `decisions.yaml` contents (those drive enforcement).
3. **Lightweight decision-note format** lives at `.planning/decisions/{YYYY-MM-DD}-{slug}.md` *without* `DLB-` prefix. `DLB-NN` is reserved for full board-deliberated memos. This note establishes the template.

## Next Actions

- [ ] Verify Phase 147 retroactive ATC status in `project-clarity-erp`. If not complete, pull forward — blocks Q2.
- [ ] Archive v1.1 via `/gsd-complete-milestone` (eligible since 2026-04-19 per STATE.md).
- [ ] Scope v1.2 via `/gsd-new-milestone v1.2` with phase order: ATC-147-evidence → Q2-gate-policy → Q3-plan-schema → Q6-machinery → Q7-governance.
- [ ] Stale checkpoint `.planning/ORCHESTRATOR-CHECKPOINT.md` (dated 2026-04-19, points at DLB-04) — delete or refresh on resume.
- [ ] At v1.2 close: re-evaluate RQ1 (dispatch data + expertise overlap) and this whole note. FLOOR retrospect-at-milestone-close.

## Reopen Clause

If at v1.2 close retrospective any of:
- RQ1 dispatch data shows merge/split needed
- RQ2 registry churn > 3 adds/removes (scope wasn't AGP-principled after all)
- RQ3 precedent causes observable governance drift in two or more subsequent briefs
- RQ4 sequencing hits a blocker that a different order would have avoided

...file a formal brief + full `/sgsd-deliberate` pass. That's the FLOOR reopen contract.

## Revertability Ledger

| Verdict | Revert cost | Method |
|---------|-------------|--------|
| RQ1 keep-8 | ~15 min | Edit `registry/agents.yaml`, remove 2-3 agent MD files |
| RQ2 accept-8 | ~20 min | Demote 2 registries to `super-gsd/templates/` |
| RQ3 precedent | ~5 min | Amend `DELIBERATION-FLOOR.md` adding §4 override rule |
| RQ4 v1.2 order | ~0 min | Re-scope before first phase dispatched |

All four under 2h revert cost. FLOOR clause satisfied.
