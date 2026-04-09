---
phase: 04
plan: 01
name: wire-atc-gate
subsystem: quality-gates
tags: [atc, classification, complexity-floor, orchestrate-loop]
requires: [orchestrate-loop.md, gsd-classifier.md, config.json]
provides: [atc-gate-step-8.5, complexity-floor-logic, tier-prompts]
affects: [super-gsd/workflows/orchestrate-loop.md, super-gsd/agents/gsd-classifier.md, .planning/config.json]
tech-stack:
  added: []
  patterns: [haiku-classification, complexity-floor-escalation, tiered-review]
key-files:
  modified:
    - super-gsd/workflows/orchestrate-loop.md
    - super-gsd/agents/gsd-classifier.md
    - .planning/config.json
decisions:
  - Complexity floor at files>3 OR lines>100 escalates to full regardless of Haiku output (QA-05)
  - LITE check runs on Haiku (~200 tokens), FULL/GATE on Sonnet (~500 tokens) (QA-02)
  - tier_prompts section added to classifier agent so prompts are co-located with classification rules
metrics:
  completed: 2026-04-08
  tasks: 3
  files: 3
---

# Phase 4 Plan 1: Wire ATC Gate Summary

**One-liner:** ATC gate wired into orchestrate-loop Step 8.5 with Haiku classification, complexity floor escalation, and tier-specific review prompts co-located in gsd-classifier.

## What Was Built

**Task 1 — Step 8.5 ATC Gate in orchestrate-loop.md:**
Inserted between Step 8 (Process Result) and Step 9 (Curate Learnings). Gate reads `config.atc.enabled`, applies complexity floor (files>3 OR lines>100 escalates from skip/lite to full), dispatches Haiku classifier (~50 tokens), then runs tier-appropriate checks: LITE via Haiku delete+simplify (~200 tokens), FULL/GATE via Sonnet 7-step+checklist (~500 tokens). Issues append to DEVIATIONS. GATE tier non-auto path emits deliberation suggestion and stops.

**Task 2 — gsd-classifier.md tier_prompts section:**
Added `<tier_prompts>` block with three inline check prompts: `<lite>` (delete+simplify, ~200 tokens), `<full>` (7-step+10-point checklist, ~500 tokens), `<gate>` (full + API/system flags). Also added complexity floor rule to the `<rules>` block. Prompts co-located with classifier so they evolve together.

**Task 3 — config.json atc section:**
Added three missing fields: `full_threshold_files: 4`, `complexity_floor_files: 3`, `complexity_floor_lines: 100`. All 8 atc fields now present.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all wiring is complete. Actual Haiku/Sonnet calls are placeholders in pseudocode (workflow spec, not runtime code), which is the correct layer for orchestrate-loop.md.

## Self-Check: PASSED

- super-gsd/workflows/orchestrate-loop.md contains "Step 8.5: ATC Gate" — confirmed
- Complexity floor logic present (files_changed>FLOOR_FILES OR LINES_EST>FLOOR_LINES) — confirmed
- gsd-classifier.md has tier_prompts section with LITE/FULL/GATE blocks — confirmed
- config.json has all 8 atc fields including complexity_floor_files and complexity_floor_lines — confirmed
