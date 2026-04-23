---
milestone: v1.2
milestone_name: Evidence-First Sharpening
status: complete
opened_at: 2026-04-19
closed_at: 2026-04-22
shipped_phases: 5
total_plans: 25
vtp_classification_used: gap-tier-3
vtp_research_id: null
---

# Milestone v1.2: Evidence-First Sharpening — Summary

**One-liner:** Empirically-gated ATC gates, v2-schema plans, confidence-weighted board votes, and an auto-closing milestone loop with staged v1.3 Codex substrate handoff.

## Outcome Delivered

Operators can now run autonomous phases where every CLAUDE-OVERLAY gate has an explicit
keep/kill/conditional verdict backed by Phase 9's empirical ATC finding count. Silent
gate-skip no longer passes undetected. Milestone close produces a reusable transition
artifact for v1.3.

## Shipped Phases

| Phase | Name | Plans | Commits | Verifier |
|-------|------|-------|---------|---------|
| 9 | ATC-147-Evidence | 3 | 12 | PASS 9/9 |
| 10 | Gate Policy | 3 | 12 | PASS 8/8 |
| 11 | Plan Schema v2 | 6 | 18 | PASS (WR-01..05 + IN-01) |
| 12 | Machinery | 6 | ~24 | PASS 13/14 hard + 1 soft-warn |
| 13 | Governance | 7 | ~21 | PASS 16/16 |

Total: 25 plans, ~87 commits across 5 phases.

## Evidence Produced This Milestone

- 09-classification.yaml: 10 findings classified (2 real-bloat + 2 integration-gap + 6 nit)
- 09-gate-bypass.yaml: 9-gate bypass audit (18,940 upper / 9,340 lower token bounds)
- registry/gates.yaml: 11-row per-gate enforcement matrix
- edge-guard.cjs: transition wrapper emitting edge-guard-log.jsonl
- plan-schema-v2.json: canonical v2 YAML-frontmatter contract
- classifier-cache.cjs + dispatch-planner.cjs + context-gauge.cjs: machinery sharpenings
- board-members.yaml + vote-synthesis.cjs: confidence-weighted governance
- decision-memo.md extended: Falsifier + Dead Ends + Post-Synthesis Reflection sections
- sgsd-complete-milestone/SKILL.md: idempotent milestone-close skill

## Rules Learned

1. Evidence-before-policy: Phase 9 finding count validated HARD-HALT on per-dispatch-ATC gate.
2. Gate registry beats prose: shouldFire at dispatch time is safer than CLAUDE.md prose rules.
3. Schema coexistence is essential: v1 fallback kept 146 existing plans running without migration.
4. Confidence-weighted votes surface dissent better than raw counts.
5. DELIBERATION-FLOOR.md reduces governance overhead for sub-2h reversible decisions.
6. Edge-guard cold-start: first milestone shipping monitoring will always have an empty log.

## Governance Findings (GOV-05)

All 6 DLBs rescored under signed-sum: 0 diverged from original decision.
DLB-05 confidence sum (8) signals Contrarian's activation concern remains open risk.

## Cross-Phase Integration

All 4 phase verifiers: PASS at milestone close (09: 9/9, 10: 8/8, 12: 13/14+warn, 13: 16/16).

## MUDA Recurrence

5 audits run. waiting class: 2 fails in Phase 08 only (pre-v1.2). Kill condition not triggered.

## VTP Publication

Tier: gap-tier-3. Write-side publication fell back to gap memo. vtp-research-id.txt reserved.

## Next-Milestone Seed (v1.3)

v1.3 Codex Integration: Phase 14 dark-launches reviewer-provider substrate (codex-exec.sh +
review-providers.yaml + contract harness + config kill-switch); Phase 15 flips review-shaped
gates to Codex, adds cross-vendor adversarial challenger and qualitative MUDA probe.

Kill checks at v1.3 close: Gate 3 novelty rating, Q4 continuous distillation promotions,
Codex quality-lift + quota-offload vs baseline.
