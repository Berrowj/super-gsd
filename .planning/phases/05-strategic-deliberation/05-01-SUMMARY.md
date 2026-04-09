---
phase: "05"
plan: "01"
name: termination-and-gate
subsystem: strategic-deliberation
tags: [deliberation, gate, termination, haiku, ceo]
dependency_graph:
  requires: []
  provides: [deliberation-gate, termination-cap, brief-termination-fields]
  affects: [gsd-deliberate-skill, gsd-ceo-agent, brief-template]
tech_stack:
  added: []
  patterns: [haiku-gate-pattern, hard-cap-termination, no-movement-detection]
key_files:
  created: []
  modified:
    - super-gsd/templates/brief-template.md
    - super-gsd/agents/gsd-ceo.md
    - super-gsd/skills/gsd-deliberate/SKILL.md
decisions:
  - "3-round hard cap enforced in CEO agent, not in SKILL.md — CEO owns round management"
  - "Gate is mandatory even when brief path passed directly — prevents gate bypass"
  - "No-movement detection added to CEO: if all 4 positions unchanged, skip to synthesis"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-08"
  tasks_completed: 3
  files_modified: 3
---

# Phase 5 Plan 01: Termination Conditions and Haiku Gate Summary

## One-liner

3-round hard cap + no-movement detection in CEO agent, Haiku phase-impact gate (phases_affected >= 3) wired as mandatory Step 0 in gsd-deliberate skill.

## What Was Built

**Task 1 — Brief template termination section**
Added `## Termination` section to `super-gsd/templates/brief-template.md` with three fields: `phases_affected`, `max_rounds` (default 3), `gate_score`. HTML comment explains each field's purpose and consumer.

**Task 2 — CEO termination rules**
Added `<termination_rules>` block to `super-gsd/agents/gsd-ceo.md` specifying:
- Hard 3-round cap (never exceeded)
- Round 3 triggers only on direct Architect/Pragmatist contradiction with zero position movement
- No-movement detection: if all 4 positions unchanged between rounds, synthesize immediately
- Brief `max_rounds` field can lower (but not raise) the cap

Added workflow step 7.5 between Round 2 and synthesis: checks max_rounds reached OR no position movement → proceed to synthesis.

**Task 3 — Haiku gate in gsd-deliberate**
Inserted `<step_0_gate>` before `<step_1_brief>` in `super-gsd/skills/gsd-deliberate/SKILL.md`:
- Reads `phases_affected` from brief Termination section (if brief path provided)
- Prompts user if value absent
- phases_affected < 3 → skip with exact message, STOP
- phases_affected >= 3 → proceed
- Gate is mandatory, cannot be bypassed

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. No data flows to UI. Gate outputs a static message; no rendering required.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check

Files modified:
- super-gsd/templates/brief-template.md — Termination section present
- super-gsd/agents/gsd-ceo.md — termination_rules block + workflow step 7.5 present
- super-gsd/skills/gsd-deliberate/SKILL.md — step_0_gate block present before step_1_brief

## Self-Check: PASSED
