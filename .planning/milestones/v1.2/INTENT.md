---
milestone: v1.2
why: >-
  Phase 147 of project-clarity-erp ran autonomously overnight and silently skipped ~9
  CLAUDE-OVERLAY gates without audit. v1.2 Evidence-First Sharpening closes that gap:
  measure first (Phase 9 retroactive ATC), keep/kill each gate (Phase 10), then sharpen
  the plan-schema, orchestrator, and deliberate contracts (Phases 11-13) around that evidence.
outcome_delivered: >-
  Operators run autonomous phases with empirically-gated ATC gates, v2-schema plans,
  and an auto-closing milestone loop that publishes/ingests milestone knowledge and
  hands off a staged v1.3 multimodal-review packet.
parent_project: Super GSD Framework
created_at: 2026-04-22
closed_at: null
entry_criteria:
  - Phase 11 Plan Schema v2 shipped (done 2026-04-21)
  - External project-clarity-erp Phase 147 retroactive ATC landed (commits ca5be16b..c41634c4)
exit_criteria:
  - All 5 phases (9, 10, 11, 12, 13) closed with green verifiers
  - gates.yaml + board-members.yaml registries populated
  - sgsd-complete-milestone is idempotent and ready to close v1.2 via bidirectional VTP
  - v1.3 staging packet is coherent: BRIEF.md + 14-CONTEXT.md + 15-CONTEXT.md aligned to the final v1.2 governance substrate
open_questions:
  - Does v1.2 close with a clean VTP `Milestone` classification, or does the fallback ladder become the documented bridge into v1.3?
  - Is the staged v1.3 multimodal lane still narrow enough to stay review-shaped, rather than expanding into a full provider rewrite too early?
---

# v1.2 Evidence-First Sharpening — INTENT

## Why (strategic rationale)

Phase 147 of project-clarity-erp ran autonomously overnight and silently skipped approximately
9 CLAUDE-OVERLAY gates without audit. The retroactive ATC review (commits ca5be16b..c41634c4)
surfaced 4 headline findings (2 real-bloat + 2 integration-gap) and quantified the gate-bypass
cost at 9,340–18,940 tokens across 16 T-commit dispatches.

v1.2 Evidence-First Sharpening exists to prevent recurrence. The sequencing is deliberate:
evidence first (Phase 9), policy second (Phase 10), then schema, machinery, and governance
sharpenings (Phases 11-13) grounded in that measured evidence rather than opinion.

Phase 13 is not just the last feature phase. It is the milestone-close proving ground:
the new `sgsd-complete-milestone` path must show that v1.2 can score its own deliberations,
audit recurrence, round-trip milestone knowledge through VTP, and leave behind a cleanly
staged v1.3 handoff packet rather than an implicit next-step guess.

## Outcome (Jobs-To-Be-Done)

Operators can run autonomous phases with empirically-gated ATC/MUDA/curate gates,
v2-schema plans, and a milestone-close path that is explicit rather than ad hoc.
Each gate has an explicit keep/kill/conditional verdict backed by Phase 9's empirical
finding count, not a prior assumption. Silent gate-skip no longer passes undetected, and
milestone close now produces a reusable transition artifact for the next milestone.

## How we'll know

- Phase 9: `verify.mjs` exits 0 (all 7 invariants on classification + bypass audit + registry doc)
- Phase 10: `super-gsd/registry/gates.yaml` populated; edge-guard-log.jsonl emits on every step
- Phase 11: Plan schema v2 enforces required frontmatter fields; v1 classifier fallback tested
- Phase 12: Orchestrator skip-rule predicates live in config, not ad-hoc prose decisions
- Phase 13: Deliberate skill sharpenings shipped (confidence-weighted votes, falsifier memos, auto-triggered milestone close)
- Milestone close: `sgsd-complete-milestone` completes without breaking evidence contracts and leaves the staged v1.3 multimodal-review packet aligned to the shipped governance substrate
- All 5 phases closed with green verifiers and 0 open ATC warnings

## Open questions

- Can the VTP `Milestone` classification be used directly at v1.2 close, or will the fallback ladder remain necessary through early v1.3?
- Are the v1.3 Codex/multi-model review goals still correctly scoped to review-shaped gates, adversarial challenge, and qualitative MUDA rather than a broader provider rewrite?
- Which v1.2 close metrics should become the baseline for the v1.3 kill check: ATC critical delta, Claude quota saved, or both?
