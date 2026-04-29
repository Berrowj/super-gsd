---
phase: 79
artifact: research
created: 2026-04-29
authored_by: orchestrator (Opus)
---

# Phase 79 -- Research

## Sources

- v2.5 Phase 79 roadmap task list (7 skills enumerated)
- Phase 68 SGSD-WARP-MCP-CONTRACT (14 tools each skill references)
- Phase 64 SGSD-WARP-WORKFLOWS (13 workflows each skill cites)
- AGENTS.md hard rules (1-5)

## Key decisions

### D1 -- One purpose per skill

Each skill has ONE purpose: status / triage / planning / review / release-check. No multi-purpose skills. Operator picks the right tool.

### D2 -- Read-only by design

All 7 skills are read-only. None mutate STATE.md, run sgsd-complete-milestone, or commit. AGENTS.md hard rule 5 (no source mutations) projected onto skill contracts.

### D3 -- Cross-reference MCP tools

Each skill calls 1-3 MCP tools from Phase 68 contract. Validates the v2.3 ship — skills are the first downstream consumer surface.

### D4 -- Hard rule citations

Each skill that touches a gate / state / mutation explicitly cites the AGENTS.md hard rule it respects. Prevents drift.

## Forward references

- Phase 80 (Warp Plan to SGSD Phase Scaffold) — formal Plan converter that sgsd-roadmap-planner cites.
- Phase 83 (Workflow/Skill/Prompt Cross-Index) — indexes these 7 skills.
- Operators: invoke skills via Warp Agent prompt ("use the sgsd-warp-operator skill to ...").
