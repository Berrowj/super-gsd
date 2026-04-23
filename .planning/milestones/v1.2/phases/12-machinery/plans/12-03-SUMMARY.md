---
phase: 12-machinery
plan: "03"
subsystem: orchestrator-checkpoint
tags: [checkpoint, schema, hard-cap, context-gauge, MACH-03]
dependency_graph:
  requires: [12-02]
  provides: [checkpoint-schema-v2, context-gauge, SKILL.md-D10-D11]
  affects: [super-gsd/templates/checkpoint.md, super-gsd/skills/sgsd-orchestrate/SKILL.md]
tech_stack:
  added: [context-gauge.cjs]
  patterns: [pure-arithmetic-module, grep-invariant]
key_files:
  created:
    - super-gsd/scripts/lib/context-gauge.cjs
    - .planning/phases/12-machinery/plans/12-03-SUMMARY.md
  modified:
    - super-gsd/templates/checkpoint.md
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
    - .planning/phases/12-machinery/verify.mjs
decisions:
  - "Risk 1: Option A (self-report) is the primary 85% trigger; Option B (context-gauge.cjs) ships as opt-in mechanical fallback alongside"
  - "D-10: checkpoint trigger narrowed from 'context >70% anywhere' to boundary-AND-70% OR 85% emergency"
  - "D-11: emergency_halt field added to checkpoint template as mechanical marker for post-milestone D-11a analysis"
metrics:
  duration_minutes: ~15
  completed_date: "2026-04-22"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 5
---

# Phase 12 Plan 03: Checkpoint Schema + 85% Hard Cap (MACH-03) Summary

Expanded checkpoint frontmatter with 4 new D-09/D-11 fields, updated SKILL.md checkpoint_protocol to D-10 boundary trigger + D-11 emergency halt path, and shipped `context-gauge.cjs` as the opt-in mechanical fallback for Risk 1 (Option B). Self-report at 85% (Option A) remains the primary runtime trigger.

## Risk 1 Decision

**Risk 1 (MEDIUM):** The 85% emergency-halt oracle mechanism had two legitimate options:

- **Option A (self-report):** Same convention as the existing 70% trigger — orchestrator self-reports context usage; >=85% fires the emergency checkpoint. Zero new code on the hot path.
- **Option B (mechanical):** `context-gauge.cjs` sums token-log.jsonl for the current session and exposes `isEmergency(total, maxContext) → bool` with a 0.85 threshold.

**Decision: Option A primary + Option B opt-in helper shipped alongside.**

Rationale: The SKILL.md self-report convention is already proven for the 70% trigger (grep confirms 4 existing references). Extending it to 85% is consistent and carries no new failure modes. Option B (`context-gauge.cjs`) ships as a zero-cost opt-in: future orchestrator versions that want mechanical token tracking can consume it without any runtime change to the current self-report path. SKILL.md does NOT require context-gauge at runtime — it is available as a library.

## Artifacts

| Artifact | Change | D-ref |
|---|---|---|
| `super-gsd/templates/checkpoint.md` | +4 new frontmatter fields: `emergency_halt`, `approaches_tried_and_abandoned`, `rules_learned_this_session`, `dispatches_summary` (nested with `by_agent` + `by_outcome`) | D-09, D-11 |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` | checkpoint_protocol trigger updated to D-10 shape; Emergency halt path subsection added; Step 1 self-assess instruction referencing 85% and 70% thresholds | D-10, D-11 |
| `super-gsd/scripts/lib/context-gauge.cjs` | New ~50 LOC pure-arithmetic module: `isEmergency`, `isWarning`, `computeFraction`; zero deps; opt-in Risk 1 Option B | Risk 1 |
| `.planning/phases/12-machinery/verify.mjs` | Invariant 6 (template has 3 D-09 field names) + Invariant 7 (SKILL.md has `85%` marker); exit 0 confirmed | D-24 |

## Commit SHAs

| Task | Commit | Description |
|---|---|---|
| 12-03-01 | `f3674e8` | extend checkpoint.md schema + verify Invariant 6 |
| 12-03-02 | `00b6848` | SKILL.md checkpoint_protocol D-10 + D-11 + Invariant 7 |
| 12-03-03 | `63e3abc` | context-gauge.cjs + SUMMARY |

## Verification Gates — All Green

1. `grep -cE '(approaches_tried_and_abandoned|rules_learned_this_session|dispatches_summary)' super-gsd/templates/checkpoint.md` → 3 ✓
2. `grep -q "emergency_halt" super-gsd/templates/checkpoint.md` → exit 0 ✓
3. `grep -q "by_agent:" super-gsd/templates/checkpoint.md` → exit 0 ✓
4. `grep -q "85%" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0 ✓
5. `grep -q "CHECKPOINT_EMERGENCY" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0 ✓
6. `grep -q "emergency_halt" super-gsd/skills/sgsd-orchestrate/SKILL.md` → exit 0 ✓
7. context-gauge smoke: `isEmergency(170000,200000)===true`, `isEmergency(100000,200000)===false`, `isWarning(140000,200000)===true`, `computeFraction(0,200000)===0` → PASS ✓
8. `test $(grep -cE 'Invariant [67]\b' verify.mjs) -ge 2` → exit 0 ✓
9. `node .planning/phases/12-machinery/verify.mjs` → exit 0 (invariants 1-7 green) ✓

## Next

Handoff to **plan 12-04** (Wave 4: adversarial verifier sampling — MACH-04). Note: MACH-04's `PASS-WITH-GAPS` verdict will increment `dispatches_summary.by_outcome.warn`, demonstrating the schema shipped in this plan is exercised in the next wave.
