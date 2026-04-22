---
milestone: v1.2
why: >-
  Phase 147 of project-clarity-erp ran autonomously overnight and silently skipped ~9
  CLAUDE-OVERLAY gates without audit. v1.2 Evidence-First Sharpening closes that gap:
  measure first (Phase 9 retroactive ATC), keep/kill each gate (Phase 10), then sharpen
  the plan-schema, orchestrator, and deliberate contracts (Phases 11-13) around that evidence.
outcome_delivered: >-
  Operators run autonomous phases with empirically-gated ATC gates and v2-schema plans.
parent_project: Super GSD Framework
created_at: 2026-04-22
closed_at: null
entry_criteria:
  - Phase 11 Plan Schema v2 shipped (done 2026-04-21)
  - External project-clarity-erp Phase 147 retroactive ATC landed (commits ca5be16b..c41634c4)
exit_criteria:
  - All 5 phases (9, 10, 11, 12, 13) closed with green verifiers
  - gates.yaml + board-members.yaml registries populated
open_questions:
  - Will Phase 10 adopt the 4-bucket threshold bracket Phase 9 produced (>=3 keep/kill pivot)?
---

# v1.2 Evidence-First Sharpening — INTENT

## Why (strategic rationale)

Phase 147 of project-clarity-erp ran autonomously overnight and silently skipped approximately
9 CLAUDE-OVERLAY gates without audit. The retroactive ATC review (commits ca5be16b..c41634c4)
surfaced 4 headline findings (2 real-bloat + 2 integration-gap) and quantified the gate-bypass
cost at 9,340–18,940 tokens across 16 T-commit dispatches.

v1.2 Evidence-First Sharpening exists to prevent recurrence. The sequencing is deliberate:
evidence first (Phase 9), policy second (Phase 10), then schema and machinery sharpenings
(Phases 11-13) grounded in that measured evidence rather than opinion.

## Outcome (Jobs-To-Be-Done)

Operators can run autonomous phases with empirically-gated ATC/MUDA/curate gates and
v2-schema plans. Each gate has an explicit keep/kill/conditional verdict backed by Phase 9's
empirical finding count, not a prior assumption. Silent gate-skip no longer passes undetected.

## How we'll know

- Phase 9: `verify.mjs` exits 0 (all 7 invariants on classification + bypass audit + registry doc)
- Phase 10: `super-gsd/registry/gates.yaml` populated; edge-guard-log.jsonl emits on every step
- Phase 11: Plan schema v2 enforces required frontmatter fields; v1 classifier fallback tested
- Phase 12: Orchestrator skip-rule predicates live in config, not ad-hoc prose decisions
- Phase 13: Deliberate skill sharpenings shipped (confidence-weighted votes, falsifier memos)
- All 5 phases closed with green verifiers and 0 open ATC warnings

## Open questions

- Will Phase 10 adopt the 4-bucket threshold bracket Phase 9 produced (>=3 real-bloat+integration-gap = hard-halt)?
- Does context-selection (Step 4 gate) add signal on homogeneous-task phases, or only mixed-concern phases?
- Is the per-dispatch ATC bypass defensible for TDD-linear phases where all dispatches are same-type?
