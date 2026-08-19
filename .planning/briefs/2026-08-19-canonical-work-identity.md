---
title: Canonical work identity across the GSD to SGSD transition
date: 2026-08-19
status: DRAFT
phases_affected: 63
q1_impl_hours: 16
q1_revertable: false
routed_from: sgsd-triage
vtp_mode: fallback
---

# Situation

Two coupled asks from the operator, both cross-instance.

ASK 1. Historical milestone and phase numbering is inconsistent across the GSD to SGSD
transition, and canonicalisation should become a skill.

Measured in luminaria-hogback, not assumed:
- Dual layout. Legacy `.planning/phases/` holds `01-token-foundation` through
  `08-sgsd-self-audit`, plus bare directories `14` and `15`. The SGSD layout
  `.planning/milestones/{vX.Y}/phases/` holds 09 onwards.
- Collision. Phase numbers 14 and 15 exist in BOTH trees simultaneously.
- 24 milestone directories v1.1 to v3.6-vtp-bridge, but 16 loose `.md` files sit at
  `.planning/milestones/` root where directories are expected.
- Phase IDs run 09 to 153 with one decimal insert (97.5).
- A second instance uses an entirely different scheme: `M038` milestone IDs and
  `v30-06.8` phase IDs. At least three schemes must reconcile.

ASK 2. Every unit of work, from a one-line fix to a full milestone, should be routed by
triage to an appointed planner and land in its own reference folder with its own PLAN.md,
so the historical tree is walkable segment by segment.

# Stakes

Identity is load-bearing here in a way that ordinary refactors are not. Phase IDs appear in
commit messages, PHASE-CAPSULE.json fields (`source_commits`, `supersedes_id`,
`superseded_by_id`), memory entries, gate ledgers, and 63 consumer files. A naive rename
destroys provenance rather than correcting it.

# Constraints

- Preserve an old-to-canonical mapping. Never destroy a historical identifier.
- Claude orchestrates; Codex gpt-5.6-sol authors all source.
- P153 is held OPEN under GATE_AUTO_HALT and P154 is seeded. This work must not silently
  jump that queue.

# Prior art that must be consumed, not rebuilt

Verified this session:
- `super-gsd/tools/state-resolver/resolve.cjs` already treats STATE.md as a legacy
  projection and resolves effective milestone and phase from 7 priority-ordered evidence
  tiers with a confidence score and a `projection_stale` flag. Only 3 of 63 consumers call
  it, and the orchestrator is not one of them.
- `super-gsd/tools/phase-capsule/write.cjs` already derives per-phase handover. 83
  PHASE-CAPSULE.json files span v1.9 to v3.6, carrying `downstream_contract`.

The derived-truth machinery largely exists and is unwired. That is the ninth recorded
instance of the harness-production-seam anti-pattern in this repo.

# Evidence from the library (VTP, degraded mode, 5 hits)

MSOV-P-08, "Deletion is a protocol, not an operation": removing a row is not forgetting if
the content survives in summaries, indices and derived lessons; verified forgetting needs
propagation semantics plus a post-deletion check that fails loudly. Read for this brief:
renaming a phase ID is not renaming if the old ID survives in commits, capsules, ledgers
and memory. Canonicalisation is a protocol, not a rename.

MSOV-P-05, "Provenance is infrastructure, not metadata": the old-to-canonical mapping is
structural, not a nice-to-have.

`wiki/meetings/langchain-vs-langgraph.md`, Idea 0, verdict MODIFY, dumb_score 15: a prior
deliberation already ruled against restructuring sequential phase execution, concluding the
graph model is a mental model rather than a code rewrite, and that decimal phases already
serve revisits. Adjacent precedent that argues for the lightest possible canonicalisation.

`wiki/meetings/multi-agent-framework.md`, Idea 3, verdict MODIFY, dumb_score 10:
"always-on X is counterproductive; milestone-gated activation makes this practical." Direct
precedent for tiering ASK 2 rather than applying it blanket.

`wiki/books/agile-software-development.md`: the Role-Deliverable-Milestone wall chart that
"put people to sleep", and the observation that even a tiny methodology with four roles,
four work products per role and three milestones has 68 interlocking parts. This is the
strongest available argument against ASK 2 in its blanket form, and it comes from the
operator's own library rather than from the orchestrator's opinion.

# Key questions for the board

1. Canonicalisation: mapping-only, or physical rename? A mapping table plus a resolver that
   accepts any historical scheme preserves provenance and needs no rewrite of 63 consumers.
   A physical rename is cleaner to read and destroys provenance unless every substrate is
   propagated and checked.
2. Does ASK 2 invert DELIBERATION-FLOOR (DLB-06) deliberately? The floor exists to skip
   ceremony under 2h and revertable. Blanket per-fix folders reverse it.
3. If tiered, what are the tiers and who assigns them? Candidate: micro gets a ledger row,
   small gets a lightweight record, phase and milestone keep the existing artifact set, with
   one canonical index spanning all tiers.
4. Should canonicalisation consume the state-resolver and capsules, or should the resolver
   first be rewired to its 60 missing consumers? Sequencing matters: canonicalising on top
   of an untrusted read path repeats the original mistake.
5. Does this jump P153 and P154, or queue behind them?
