---
plan_id: 79-01
phase: 79
title: 7 SGSD Warp skills under .agents/skills/
type: docs
expected_ATC_tier: lite
files_touched:
  - .agents/skills/sgsd-{warp-operator,status-brief,gate-triage,token-triage,roadmap-planner,cockpit-review,release-check}/SKILL.md
---

# Plan 79-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Author 7 SKILL.md files | Each has frontmatter + procedure + hard rules + related |
| 2 | Cross-reference MCP tools / workflows / docs | Each skill cites at least 2 related artifacts |
| 3 | Read-only contract | No skill mutates state; AGENTS.md hard rules cited where relevant |
| 4 | Atomic commit | feat(p79-01) |
