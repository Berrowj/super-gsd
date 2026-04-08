---
phase: 01-token-foundation
plan: 02
subsystem: core-patches
tags: [super-gsd, model-profiles, config, ipc-guard, token-audit, idempotent]
key-files:
  modified:
    - ~/.claude/get-shit-done/bin/lib/model-profiles.cjs
    - ~/.claude/get-shit-done/bin/lib/config.cjs
    - ~/.claude/get-shit-done/references/agent-contracts.md
    - super-gsd/skills/gsd-orchestrate/SKILL.md
decisions:
  - SUPER-GSD patches placed outside GSDedits repo (in ~/.claude/get-shit-done/) — committed via planning summary only; GSD 1.0 files not tracked in project repo
  - config.cjs override inserted inside cmdConfigSetModelProfile (not getAgentToModelMapForProfile) — that is the resolution entry point for model profile commands
  - @file: guard added in cold_start section of SKILL.md as canonical Bash pattern block — covers INIT/RESULT/DIGEST capture points
metrics:
  completed: "2026-04-08"
  tasks: 2
  files: 4
---

# Phase 01 Plan 02: SUPER-GSD Marker Patches + IPC Guard + Token Audit Summary

SUPER-GSD-START/END markers applied idempotently to 3 GSD 1.0 files, @file: IPC guard added to orchestrate skill, token-log.jsonl smoke test confirmed parseable.

## FILES_CHANGED

| File | Change |
|------|--------|
| ~/.claude/get-shit-done/bin/lib/model-profiles.cjs | Added SUPER_GSD_PROFILES block (orchestrate/classifier/context-selector); Object.assign before VALID_PROFILES |
| ~/.claude/get-shit-done/bin/lib/config.cjs | Added model_routing override block inside cmdConfigSetModelProfile |
| ~/.claude/get-shit-done/references/agent-contracts.md | Appended Super GSD completion markers section with HTML comment markers |
| super-gsd/skills/gsd-orchestrate/SKILL.md | Added @file: IPC guard pattern block in cold_start section (5 guard occurrences) |

## VERIFICATION

- `grep -q SUPER-GSD-START model-profiles.cjs`: OK
- `grep -q SUPER-GSD-START config.cjs`: OK
- `grep -q SUPER-GSD-START agent-contracts.md`: OK
- `node -e "require(model-profiles.cjs)"`: syntax ok
- `grep -c @file: SKILL.md`: 5
- `token-log.jsonl` last entry: model=unknown, total=1 — valid JSONL, ORCH-08 confirmed

## DEVIATIONS

**1. [Rule 1 - Adjustment] config.cjs override location**
- Found during: Task 1
- Issue: config.cjs has no standalone `getModelForAgent()` function — model resolution happens inside `cmdConfigSetModelProfile`. Override block inserted there instead of a non-existent function.
- Fix: Inserted SUPER-GSD block at top of `cmdConfigSetModelProfile` body before normalizedProfile assignment.
- Files modified: config.cjs

## BLOCKERS

None.

## SCRIPTS_CREATED

None.

## ONE_LINER

SUPER-GSD marker patches applied to 3 GSD 1.0 core files plus @file: IPC guard wired into orchestrate skill.

## Self-Check: PASSED

- model-profiles.cjs: SUPER-GSD-START present, Node require() passes
- config.cjs: SUPER-GSD-START present
- agent-contracts.md: SUPER-GSD-START present
- SKILL.md: @file: guard present (5 occurrences), committed at f42a30e
- token-log.jsonl: 1 valid JSONL entry, ORCH-08 confirmed
