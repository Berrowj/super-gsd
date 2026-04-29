---
phase: 79
phase_name: SGSD Warp Skills Pack
milestone: v2.5
created: 2026-04-29
status: in-progress
deviation_from_standard: docs phase (skill markdown files; orchestrator-authored)
---

# Phase 79 -- CONTEXT

7 Warp skills under `.agents/skills/` per Phase 79 roadmap acceptance.
Each skill: frontmatter + procedure + hard rules + related. Skills call
existing MCP tools / workflows; never mutate state.

## 7 skills

1. `sgsd-warp-operator` — daily SGSD operations safely from Warp
2. `sgsd-status-brief` — 5-line operator status composition
3. `sgsd-gate-triage` — explain gate failures, suggest repair (no bypass)
4. `sgsd-token-triage` — investigate token spend vs budgets
5. `sgsd-roadmap-planner` — draft phase candidates (operator approves)
6. `sgsd-cockpit-review` — verify cockpit snapshot completeness
7. `sgsd-release-check` — pre-flight milestone close

## Acceptance

- 7 SKILL.md files under `.agents/skills/<name>/SKILL.md`
- Each has frontmatter (name + description)
- Each has one clear purpose
- Read-only (no mutation skills)
- Cross-references to MCP tools / workflows / docs verified
