---
phase: 82
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 82 -- Research

## Sources

- v2.5 Phase 82 roadmap (7 prompts enumerated)
- Phase 79 skills pack (skills-vs-prompts division)
- Phase 68 MCP contract (tools cited)

## Key decisions

### D1 — Skills vs prompts division

Skills (Phase 79) are agent-discoverable abstractions that fire on operator request via Warp Agent's skill system. Prompts (Phase 82) are templated text operators copy-paste. Both are read-only; prompts have lower entry barrier (no skill-discovery layer); skills auto-load context.

### D2 — Mode declared on every prompt

Operator brief explicitly: "Each says whether it is read-only or may suggest edits." Phase 82 honors via per-prompt frontmatter `**Mode**: ` line. None auto-modify.

### D3 — Operator file attachment for P4

P4 (Phase Plan Critic) is the one prompt that requires user-attached file context. Documented in the prompt instructions ("I'll attach a {NN}-01-...-PLAN.md file"). Other prompts use MCP tool calls only.

### D4 — Cross-link to skills + workflows + notebook

Prompts pack bottom section cross-references all 4 v2.5 surfaces (skills / prompts / notebook / converter) so operators can pick the right tool.
