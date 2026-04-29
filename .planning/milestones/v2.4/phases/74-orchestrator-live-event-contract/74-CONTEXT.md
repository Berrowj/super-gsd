---
phase: 74
phase_name: Orchestrator Live Event Contract
milestone: v2.4
created: 2026-04-29
status: in-progress
deviation_from_standard: code+docs (small writer helper + design doc; orchestrator-authored)
---

# Phase 74 -- Orchestrator Live Event Contract (CONTEXT)

## Goal

Define `.planning/ORCHESTRATOR-LIVE.jsonl` schema with 16 frozen event
types per Phase 73 question model. Ship a Lock-13-wrapped writer
helper (`super-gsd/scripts/lib/orchestrator-live-writer.cjs`) that
emits events without crashing SGSD on write failure.

## Locked Scope

- D74.1: 16 EVENT_TYPES per Phase 73 OPERATOR-QUESTION-MODEL.md.
- D74.2: Universal envelope `{schema_version, ts, type, milestone, phase, plan, data}`.
- D74.3: Writer Lock-13 wrapped; bad input returns `{ok:false}`; write failure also `{ok:false}` (never throws).
- D74.4: Schema version 1 stamped; bumping requires successor phase.
- D74.5: Backward compat — legacy ledgers (`activity-log.jsonl`, `agent-token-spend.jsonl`, etc.) remain canonical; live stream is additive.

## Outputs

- `super-gsd/docs/ORCHESTRATOR-LIVE-EVENTS.md` (NEW)
- `super-gsd/scripts/lib/orchestrator-live-writer.cjs` (NEW; 3 public APIs + 9-assertion selfTest)
- 5 Phase 74 standard artifacts

## Acceptance

1. Doc + writer ship.
2. Writer self-test 9/9 PASS.
3. Lock-13 verified via A3-A5 (bad input cases).
4. ASCII-only.
5. Real-write succeeds via temp dir A6/A7.
