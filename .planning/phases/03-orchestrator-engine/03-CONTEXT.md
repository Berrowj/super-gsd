# Phase 3: Orchestrator Engine - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — autonomous mode)

<domain>
## Phase Boundary

The autonomous dispatch loop runs end-to-end: reads state, selects model, dispatches agent, processes report, commits atomically, and survives context exhaustion via checkpoint protocol.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. The orchestrate-loop.md workflow already defines the 13-step loop. This phase wires it to actually work with gsd-tools.cjs and real agent dispatches.

### Locked from Prior Phases
- D001: Opus orchestrates, Sonnet executes, Haiku classifies
- D002: Compressed XML plans (~800 tokens)
- D003: Structured 300-word agent reports
- D005: Frontmatter-only reads + brv-query
- Phase 1 delivered: token logging, path normalization, atomic writes, SUPER-GSD patches
- Phase 2 delivered: brv-query-local, brv-curate-local, orchestrate-loop Steps 4+9 wired

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- super-gsd/skills/gsd-orchestrate/SKILL.md — the skill definition (already has loop spec + @file: guard)
- super-gsd/workflows/orchestrate-loop.md — full 13-step loop workflow with Steps 4+9 wired
- super-gsd/workflows/dispatch-table.md — 12-rule first-match dispatch reference
- super-gsd/templates/efficiency-header.xml — 80-token agent rules header
- super-gsd/templates/executor-brv-overlay.xml — overlay with EXISTING: injection
- super-gsd/CLAUDE-OVERLAY.md — teaches Claude Code the loop

### Integration Points
- gsd-tools.cjs: init phase-op, state advance-plan, state update-progress, roadmap update-plan-progress, commit
- Agent tool: model parameter, prompt parameter, subagent_type parameter
- .planning/STATE.md: frontmatter read (offset 0, limit 30)
- .planning/ORCHESTRATOR-CHECKPOINT.md: write on exit, read on resume

</code_context>

<specifics>
## Specific Ideas

The orchestrate skill and workflow already exist in detail. This phase needs to:
1. Validate the loop actually runs — dispatch a real agent, process the report, commit
2. Validate checkpoint write/read cycle works
3. Validate model routing actually passes the right model to Agent calls
4. Enforce SAFE-04 (context cap: max 5 reports) and SAFE-05 (report format enforcement)
5. Wire the dispatch table to actually call gsd-tools init phase-op for condition checks

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>
