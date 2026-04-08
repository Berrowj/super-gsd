---
title: Cold Start Runbook
tags: [cold-start, resume, checkpoint, session]
keywords: [cold start, restore, continue, resume, checkpoint, new session]
related:
  - "patterns/orchestrator-patterns"
importance: 85
maturity: core
---

## Raw Concept

Step-by-step restoration when starting a new session or after context reset.
Two paths: cold start (no checkpoint) and warm resume (checkpoint exists).

## Narrative

### Cold Start (no checkpoint)
1. Read .planning/STATE.md frontmatter only (offset 0, limit 30)
2. Read .planning/ROADMAP.md — find next incomplete phase
3. Read .planning/config.json — get model routing
4. Determine position: which phase, plan, state
5. Enter loop

### Warm Resume (checkpoint exists)
1. Read .planning/ORCHESTRATOR-CHECKPOINT.md
2. Extract: active_phase, last_completed, next_unit
3. Enter loop at next_unit — skip all cold start reads

### Dispatch Table (Quick Reference)
| State | Action |
|-------|--------|
| No CONTEXT.md | /gsd-discuss-phase |
| No RESEARCH.md | Dispatch researcher |
| No PLAN.md | Dispatch planner |
| Plans unchecked | Dispatch plan-checker |
| Pending tasks | Dispatch executor |
| All tasks done | Dispatch verifier |
| Verified | Mark complete, advance |

## Facts

- category: convention
  statement: Always check for checkpoint before doing full cold start
- category: convention
  statement: Cold start reads STATE.md frontmatter only, never full file
- category: preference
  statement: User says "continue" or "go" to trigger cold start sequence
