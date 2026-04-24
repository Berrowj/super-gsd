---
name: After Phase 16 ships, every research / planning / pattern / assumptions dispatch must consume VTP
description: Post-v1.3-Phase-16 enforcement — orchestrator writes VTP-EVIDENCE.md before agent dispatch, agents explicitly instructed to use their VTP tools with doc-ID citations. Phase 16 agent-patches gave gsd-phase-researcher / gsd-planner / gsd-codebase-mapper / gsd-assumptions-analyzer VTP tool access; the orchestrator must actually USE them.
type: feedback
originSessionId: 3c216c4a-6bf4-442c-9d85-ea9a3f851aae
---
**Rule:** After Phase 16 (v1.3) ships the VTP primitive, every /gsd-plan-phase / /gsd-research-phase / /gsd-pattern-mapper / /gsd-assumptions-analyzer dispatch in this repo MUST:

1. Ensure `.planning/phases/{N}/VTP-EVIDENCE.md` (or milestone-nested equivalent) EXISTS at the phase dir before the first agent is dispatched. If missing, the orchestrator must call `mcp__vtp-kb__vtp_route_and_retrieve` with a well-framed phase-level `raw_query`, persist the framing (`selected_query`, `retrieval_mode`, `reflection.verdict`, top-3 evidence `doc_id`s) to VTP-EVIDENCE.md per D-04's framing-only contract.

2. Include the phase's `VTP-EVIDENCE.md` in every dispatched agent's `<files_to_read>` list — this is the phase-level framing prelude.

3. **Explicitly instruct** each agent to use its VTP tools (the ones added to `tools:` in Phase 16 Wave B):
   - `gsd-phase-researcher` → `mcp__vtp-kb__vtp_search_research` + `vtp_get_research` + gated `vtp_research_gate` for paper / principle lookups
   - `gsd-planner` → `mcp__vtp-kb__vtp_route_and_retrieve` (architecture mode) + `vtp_search_substrate` for plan-tier evidence
   - `gsd-codebase-mapper` → `mcp__vtp-kb__vtp_search_substrate` with `source_types` + `topics` filters
   - `gsd-assumptions-analyzer` → `mcp__vtp-kb__wiki_find_contradictions` for assumption stressing
   Every agent's output artifact (RESEARCH.md, PLAN.md, PATTERNS.md) should cite VTP `doc_id`s inline where evidence was used.

**Why:** Phase 16's domain statement was explicit: "so the system stops issuing ungrounded suggestions and starts answering against routed evidence by default." Shipping the primitive and then dispatching the next phase's research without using it defeats the entire thesis. Silent bypass is the worst failure mode — it lets the system regress while the commit history says it didn't.

**How to apply:**

**Post-Phase-16, before any Agent dispatch for research/planning/pattern/assumptions:**
- Check if `{phase_dir}/VTP-EVIDENCE.md` exists.
- If not, call `mcp__vtp-kb__vtp_route_and_retrieve` with:
  - `raw_query` = one-paragraph phase framing derived from ROADMAP + CONTEXT
  - `context` = current SGSD state (project_intent, current_task, explicit_constraints) — compose manually if composer CJS isn't reachable from the orchestrator session
- Format response → VTP-EVIDENCE.md per D-04 (framing-only, ≤300 lines).
- Commit: `docs({padded}): seed VTP-EVIDENCE.md for phase {N}`.
- THEN dispatch the agent with VTP-EVIDENCE.md in `<files_to_read>` and VTP-tool instructions in the prompt body.

**Exceptions:**
- Phases that are purely doc / non-research (e.g., milestone close, STATE bump) don't need VTP evidence.
- If `workflow.triage_vtp_enrichment: false` in config (the Phase-16 D-06 kill-switch), skip — operator explicitly disabled.
- If `vtp-kb` MCP is unavailable, log the skip in the agent prompt (agents still can be dispatched, just without VTP grounding — graceful-fail per D-07 contract).

**Durable signal for future sessions:** If you're about to `Agent(subagent_type="gsd-phase-researcher"|"gsd-planner"|"gsd-codebase-mapper"|"gsd-assumptions-analyzer")` and your prompt doesn't mention VTP-EVIDENCE.md or `mcp__vtp-kb__*` tools, STOP — you're about to regress Phase 16's primitive.

**Meta:** the plan-phase workflow file at `~/.claude/get-shit-done/workflows/plan-phase.md` doesn't yet include a "Step 5.5 — seed VTP-EVIDENCE.md" block. That's a framework-level gap to close in a future phase (post-Phase-17 maybe — "update GSD workflows to call the VTP primitive"). Until then, the orchestrator does this manually.
