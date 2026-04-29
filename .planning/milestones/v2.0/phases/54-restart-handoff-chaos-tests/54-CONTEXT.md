---
phase: 54
name: Restart + Handoff Chaos Tests
milestone: v2.0
depends_on: [53]
unblocks: [55, 56, 57]
synthesized_at: 2026-04-28
synthesis_rule: "auto per corrected dispatch rule #1"
---

# Phase 54 Context — Restart + Handoff Chaos Tests

## Goal (verbatim ROADMAP-AGENT.md:655)

Mid-phase kill simulation at 5 named points + manifest-shape tests on ORCHESTRATOR-CHECKPOINT.md.

## Locked Decision: 54=C (real subprocess kill + manifest validator)

## Required Outputs

- `super-gsd/tools/chaos-restart/harness.cjs` (5 kill-point fixtures + manifest validator)
- `super-gsd/tools/chaos-restart/manifest-validator.cjs` (rejects checkpoint with missing required fields)
- `super-gsd/tools/chaos-restart/run-self-test.cjs` (thin shell)
- `.planning/metrics/chaos-restart-log.jsonl` (envelope-v1)
- 54-* artifacts

## 5 Named Kill Points (from acceptance)

1. **mid-research** — kill researcher subprocess after RESEARCH.md partial write; resume must complete
2. **mid-plan** — kill planner subprocess after PLAN.md partial write; resume must complete
3. **mid-execute** — kill executor subprocess after partial commit; resume must complete or rollback cleanly
4. **mid-verify** — kill verifier after VERIFICATION.md partial write; resume must complete
5. **mid-close** — kill close commit after STATE.md edit but before commit; resume must finalize

## Manifest Validator (ORCHESTRATOR-CHECKPOINT.md)

Required fields: `next_unit`, `controlling_principle`, `mode`, `emergency_halt`. Validator rejects on missing field; harness creates fixture checkpoints with deliberate gaps.

## Acceptance

- Each of 5 kill points: subprocess killed mid-execution; harness verifies checkpoint state allows resume; resume reaches phase close
- Manifest validator: 5 missing-field fixtures all rejected with clear reason

## Lock Invariants

- Lock 4: Phase 41-53 byte-untouched
- Lock 11: byte-equality only on manifest field validation
- Lock 13: harness never throws; subprocess kills caught
- ASCII-only

## Hand-off

Researcher confirms 5 kill points + writes 54-RESEARCH.md (target 400-700L). Planner produces 54-01-PLAN.md with 4-5 tasks (T1 skeleton+validator, T2 5 kill-point fixtures, T3 5 self-tests, T4 milestone-close wire).
