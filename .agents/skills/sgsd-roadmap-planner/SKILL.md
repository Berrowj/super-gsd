---
name: sgsd-roadmap-planner
description: |
  Convert a high-level goal into draft SGSD phase candidates. Read-only —
  produces draft scaffolding under .planning/analyses/, never modifies STATE.md
  or active milestone. Operator approves before any phase activates.
---

# Skill: SGSD Roadmap Planner

Help the operator design new SGSD phases for a goal. Read-only design
work; outputs go to `.planning/analyses/{date}-{slug}.md` for operator
review before any phase activates.

## Procedure

1. Read MCP `sgsd_current_state` — confirm active milestone + understand
   what's already shipping.
2. Read MCP `sgsd_milestone_status` for the active milestone — confirm
   gap.
3. Read existing roadmap at
   `.planning/milestones/{milestone}/ROADMAP.md` to understand phase
   numbering convention.
4. Decompose the goal:
   - 1-3 phases per logical chunk
   - Each phase has CONTEXT / PLAN / RESEARCH / VERIFICATION /
     ATC-REVIEW per SGSD standard
   - Code phases dispatch gsd-executor; design phases orchestrator-author
5. Write draft to `.planning/analyses/{ISO-date}-{slug}-draft-roadmap.md`:

```markdown
---
created: <ISO>
goal: <text>
status: draft (operator review required)
---

## Goal
<text>

## Proposed phases

### Phase X — <name>
- Type: code|docs|integration
- Inputs: <files>
- Outputs: <files>
- Acceptance: <bullets>
- Dispatch: orchestrator|executor

### Phase Y — ...
```

6. Tell operator: "Draft at `.planning/analyses/<file>`. Approve to
   activate by adding to ROADMAP.md."

## Hard rule (AGENTS.md hard rule 5)

DO NOT add phases directly to ROADMAP.md. DO NOT modify STATE.md.
DO NOT activate any phase. Operator review before activation is
non-negotiable.

## Related

- AGENTS.md hard rule 5 (no source mutations without a Plan).
- ROADMAP.md activation flow.
- v2.5 Phase 80 — Warp Plan to SGSD Phase Scaffold (formal converter when Warp Plans exist).
