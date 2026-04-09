---
phase: 04-atc-quality-gates
status: ready-for-planning
mode: auto-generated (infrastructure phase — autonomous mode)
---

# Phase 4: ATC Quality Gates — Context

## Phase Boundary

Every commit is automatically classified (skip/lite/full/gate) by Haiku before it lands. Tiered review runs at the appropriate depth. Stuck agents detected after 3 repeated tool calls on the same file.

## Decisions

### Locked from Prior Phases
- D001: Haiku classifies (not Sonnet — cost efficiency)
- D002: Compressed XML plans (~800 tokens)
- D007: LITE = delete+simplify only (~200 tokens), FULL = 7-step+checklist (~500 tokens)

### Claude's Discretion
- Classifier JSON schema design
- Where stuck-detector hook lives (post-tool-use hook or pre-commit hook)
- Threshold tuning for files_changed > 3 OR diff_lines > 100 escalation

## Code Context

### Integration Points
- super-gsd/workflows/atc-gate.md — existing ATC gate workflow (needs wiring)
- super-gsd/agents/gsd-classifier.md — Haiku classifier agent
- .planning/config.json atc section: classify_model, skip_threshold_lines, lite_threshold_lines, lite_threshold_files
- Hooks: post-tool-use (stuck detector), pre-commit (classification trigger)
