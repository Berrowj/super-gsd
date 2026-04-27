---
milestone: v1.9
handover: VTP Research Delta
created: 2026-04-27
intended_consumer: Claude / SGSD orchestrator
start_condition: Phase 44 closed, Phase 45 not yet started or about to start
---

# Claude Handover - Apply v1.9 VTP Research Delta

## Mission

Apply the VTP research learning as a forward-only addendum to v1.9
SGSD-Research.

Do **not** reopen Phases 41-44. Phase 44 is closed. The addendum affects
remaining phases only: 45, 49, 51, and 52.

## Required Reading

Read these files in order:

1. `.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md`
2. `.planning/milestones/v1.9/ROADMAP.md`
3. `.planning/milestones/v1.9/REQUIREMENTS.md`
4. `.planning/milestones/v1.9/phases/44-legal-context-registry/44-VERIFICATION.md`
5. `.planning/STATE.md`

## Operating Rule

Autonomy continues; evidence tells the truth.

This delta must not become scope bloat. Apply it only where it tightens the
already-planned v1.9 work:

- Phase 45: context packets include source-backed `validated_thoughts`.
- Phase 49: memory governance supports promote, demote, revoke, revalidate,
  and complaint repair.
- Phase 51: benchmark measures `utility_per_token` and `evidence_retention`.
- Phase 52: Redis caches hot projections only and remains disposable.

## Do Not Do

- Do not reopen or rewrite completed Phases 41, 42, 43, or 44.
- Do not renumber phases.
- Do not turn Redis into source of truth.
- Do not store unsourced thoughts as memory.
- Do not summarize critical bypass records away.
- Do not use semantic similarity alone as a reason to include broad context.

## Phase 45 Dispatch Instruction

Before dispatching the Phase 45 researcher, include this in the researcher
packet:

```text
The VTP research delta is now controlling for Phase 45.

Read .planning/milestones/v1.9/VTP-RESEARCH-DELTA.md.

Phase 45 must implement Context Packet Builder with:
- Intent English fields already planned in v1.9;
- legal registry validation from Phase 44;
- role-specific packets;
- context_source_mix metadata;
- optional validated_thoughts with source_refs, root_source_hashes, confidence,
  created_from_phase, used_for, novelty_basis, and compression_level;
- source order: legal registry, current phase/plan, critical bypass raw records,
  phase capsules, validated thoughts, local index snippets, VTP evidence packet,
  raw files only as fallback;
- context complaints when broad raw files are needed.

Do not reopen Phases 41-44. Treat this as forward-only Phase 45 refinement.
```

## Phase 49 Dispatch Instruction

When Phase 49 starts, include:

```text
Apply the VTP research delta memory-governance lifecycle:
raw_evidence -> phase_capsule -> validated_thought -> reusable_rule/guardrail,
with demotion and revocation when abstraction fails.

Every durable memory write is a privileged state transition requiring
provenance, confidence, source hashes, allowed consumers, and revocation path.
Read-time reconsolidation is a write risk if it changes future packet inputs.
```

## Phase 51 Dispatch Instruction

When Phase 51 starts, include:

```text
The context stress benchmark must measure evidence retention and utility per
token, not token reduction alone. Add fixtures for bad/poisoned validated
thought, semantic-only false relationship, stale abstraction, missing
provenance, critical bypass incorrectly compressed, and Redis hot packet stale
against changed canonical source.
```

## Phase 52 Dispatch Instruction

When Phase 52 starts, include:

```text
Redis is optional disposable projection only. It may cache live cockpit state,
active markers, provider health, short-lived counters, hot packet previews, and
hot validated-thought projections with source hashes. FLUSHDB must lose no
canonical decisions, debt, phase evidence, capsules, validated thoughts, memory
governance rows, or benchmark results.
```

## Commit Guidance

If you update roadmap/requirements before Phase 45, make one small commit:

```text
docs(v1.9): apply VTP research delta to remaining phases
```

If Phase 45 implementation consumes the delta, use normal phase commit naming.

## Copy-Paste Operator Prompt

```text
Read .planning/milestones/v1.9/VTP-DELTA-HANDOVER.md and
.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md.

Apply the VTP research delta forward-only to v1.9. Do not reopen Phases 41-44.
Proceed into Phase 45 with the delta active:
- context packets may include source-backed validated_thoughts;
- packet metadata must report context_source_mix;
- legal registry validation remains the admission boundary;
- critical bypass records remain raw-linked;
- broad raw-file fallback logs a context complaint.

When later phases are reached, carry the delta into Phase 49 governance,
Phase 51 benchmark scoring, and Phase 52 Redis safety. Keep Redis optional and
disposable. Autonomy continues; evidence tells the truth.
```
