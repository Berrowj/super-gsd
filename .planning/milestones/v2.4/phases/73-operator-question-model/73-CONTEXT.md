---
phase: 73
phase_name: Operator Question Model Refresh
milestone: v2.4
roadmap: warp-integration
created: 2026-04-29
operator: jack.berrow
status: in-progress
deviation_from_standard: docs-only design phase (orchestrator-authored — small, well-defined synthesis)
---

# Phase 73 -- Operator Question Model Refresh (CONTEXT)

## Goal

Lock the cockpit 2.0 question model specifically for Warp. Map each of
the 12 canonical operator questions to a data source: `.planning/`
file, MCP tool (just shipped in v2.3), or both. Identify missing event
fields that Phase 74 must add to the live event contract.

## The 12 Questions (from operator brief)

1. What is the model doing?
2. What are we trying to complete?
3. What does this unlock?
4. What is blocked?
5. What agents were used?
6. What did each agent do?
7. What is Codex doing?
8. What gates ran?
9. What failed or warned?
10. Where are tokens going?
11. What should I read?
12. What command resumes safely?

## Locked Scope (D73.1-D73.4)

- D73.1: For each question, map to a primary source (MCP tool name + STATE/metrics path) and a secondary fallback. Format: per-question table.
- D73.2: Identify gaps where the answer requires fields not yet in any source. These become Phase 74 ORCHESTRATOR-LIVE.jsonl event fields.
- D73.3: Distinguish "MCP only" from "cockpit pane only" from "both" -- the cockpit-state adapter (Phase 76) will compose where both are needed.
- D73.4: Output `73-OPERATOR-QUESTION-MODEL.md` lockable by Phase 74 / 75 / 76 / 77 as the contract for what they must surface.

## Inputs Consumed

- operator brief (this session) -- the 12 questions verbatim
- v1.6 Phase 26 (Operator Question Contract) -- 8-question precursor
- Phase 50 (Cockpit Research Dashboard) -- redesigned cockpit projection
- Phase 68 SGSD-WARP-MCP-CONTRACT.md -- 14 tools shipped in v2.3
- existing `.planning/metrics/*.jsonl` ledgers -- source files

## Outputs

- `super-gsd/docs/OPERATOR-QUESTION-MODEL.md` (NEW)
- 5 Phase 73 standard artifacts

## Acceptance

1. All 12 questions mapped to specific MCP tool + source file.
2. Missing event fields enumerated for Phase 74.
3. Composition decisions (MCP / cockpit / both) explicit per question.
