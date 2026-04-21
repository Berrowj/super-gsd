---
phase: 11-plan-schema-v2
plan: "03"
subsystem: plan-schema
tags: [schema, self-healing, orchestrator, planner, fix-schema]
dependency_graph:
  requires: ["11-01", "11-02"]
  provides: ["gsd-planner --fix-schema mode", "sgsd-orchestrate Rule 8.5 retry loop"]
  affects: ["sgsd-orchestrate/SKILL.md", "gsd-planner.md"]
tech_stack:
  added: []
  patterns: ["fix-schema mode", "sibling-file staging (D-11)", "3-attempt retry with checkpoint-on-cap (D-10)"]
key_files:
  created: []
  modified:
    - "super-gsd/skills/sgsd-orchestrate/SKILL.md"
    - "/c/Users/jack.berrow/.claude/agents/gsd-planner.md"
decisions:
  - "Framework file gsd-planner.md is canonical at ~/.claude/agents/gsd-planner.md (outside this repo, gitignored extract at custom-gsd-extract/)"
  - "Rule 8.5 placed as Step 6.2 (between dispatch letter e and f) with ANCHOR marker for 11-04/05"
  - "error_envelope passed inline per RQ-5 OQ3 (not as file path)"
  - "locked_fields extracted in orchestrator before dispatch per D-09 (not delegated to planner)"
metrics:
  duration: "~18 minutes"
  completed: "2026-04-21T21:11:00Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 11 Plan 03: Self-Healing Schema Repair Loop Summary

Fix-schema mode lives in gsd-planner.md as `<fix_schema_mode>` section; orchestrator Rule 8.5 (Step 6.2) provides 3-attempt retry loop with sibling staging, locked-field extraction before dispatch, and checkpoint-on-cap halt.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add --fix-schema mode to gsd-planner.md | (framework file, not in repo) | `~/.claude/agents/gsd-planner.md` |
| 2 | Add Rule 8.5 schema-fix dispatch to orchestrator | c582d23 | `super-gsd/skills/sgsd-orchestrate/SKILL.md` |

## What Was Built

### Task 1 — gsd-planner.md `<fix_schema_mode>` section

Added to `~/.claude/agents/gsd-planner.md` (canonical framework file):

1. **Detection branch** in `<step name="load_mode_context">`: `--fix-schema` flag detected, activates `<fix_schema_mode>`, skips all standard planning steps.

2. **`<fix_schema_mode>` section** after `<reviews_mode>` containing:
   - INPUTS table: `plan_file_path`, `error_envelope` (inline JSON), `schema_path`, `locked_fields`, `attempt_K`
   - LOCKED CONSTRAINT (D-09): explicit prohibition on changing `task.id`, `task.goal`, `task.files_touched`
   - PROCESS: 6-step repair flow — read plan, read schema, parse envelope, fix minimum fields, self-check (5-point checklist), write to sibling
   - OUTPUT: writes to `{plan_file_path}.fix-attempt-{attempt_K}.md` only (never overwrites original)
   - DO NOT list: explicit prohibitions on overwriting original, returning standard format, changing locked fields

### Task 2 — sgsd-orchestrate Rule 8.5 (Step 6.2)

Added to `super-gsd/skills/sgsd-orchestrate/SKILL.md`:

1. **Dispatch rule `e` updated**: now reads "run PLAN LOAD-TIME VALIDATION (Step 6.2) then dispatch gsd-executor"

2. **Step 6.2 block** with `<!-- ANCHOR: RULE-8.5 -->` marker for 11-04/05 collision avoidance:
   - Calls `validate.cjs --mode load` on each pending PLAN.md before executor dispatch
   - Exit 0 → proceed normally; Exit 2 → HALT blocker; Exit 1 → enter retry loop
   - **Schema-fix retry loop**: 3 attempts max (D-10)
     - Extracts `locked_fields` from original plan in orchestrator (not planner) — D-09
     - Reads most recent `plan-errors.jsonl` row for this plan (inline, not path) — RQ-5 OQ3
     - Dispatches `gsd-planner --fix-schema` via Agent() with TaskCreate/TaskUpdate
     - Commits each attempt: `fix({phase}-{plan}): repair schema violation attempt K/3`
     - Re-validates sibling; on pass: promotes + deletes sibling, commits promotion
     - On cap (3 failures): writes ORCHESTRATOR-CHECKPOINT.md with all 3 envelopes + all 3 attempt file contents, commits checkpoint, EXIT #3 Blocker (D-10)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Deviation] Framework file location outside git repo**
- **Found during:** Task 1
- **Issue:** `custom-gsd-extract/claude-agents/gsd-planner.md` is listed in the plan's `files_modified` but the directory is gitignored. The canonical gsd-planner.md lives at `~/.claude/agents/gsd-planner.md` (GSD framework, outside this repo).
- **Fix:** Applied changes to the canonical file at `~/.claude/agents/gsd-planner.md` and synced the local extract copy. Task 1 changes are correct and operational — the planner agent will use the canonical file at invocation time.
- **Files modified:** `/c/Users/jack.berrow/.claude/agents/gsd-planner.md` (canonical, not tracked in this repo)
- **Commit:** N/A — framework file is outside git scope of this repo. Task 2 (SKILL.md) committed at c582d23.

**Note for 11-04/05:** The ANCHOR marker `<!-- ANCHOR: RULE-8.5 -->` is on line 185 of SKILL.md. Subsequent plans should add their sections after Step 6.2 using this marker as a pattern-match target.

## Known Stubs

None. Both deliverables are complete prose/instructions — no stub values or placeholders that block the plan's goal.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. The sibling file promotion path (T-11-06) is mitigated by re-validation before overwrite, consistent with the plan's threat model.

## Self-Check: PASSED

- `/c/Users/jack.berrow/.claude/agents/gsd-planner.md` contains `<fix_schema_mode>` section: FOUND
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` contains "Rule 8.5" / "6.2": FOUND
- Task 2 commit c582d23: FOUND (`git log --oneline | grep c582d23`)
