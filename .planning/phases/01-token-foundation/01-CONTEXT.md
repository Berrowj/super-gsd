---
phase: 01-token-foundation
created: "2026-04-08"
decisions_locked: true
---

# Phase 1: Token Foundation

## Goal

Establish the token efficiency layer that everything else depends on. Model routing, compressed plan format, structured agent reports, and token logging.

## Locked Decisions

<decisions>

<decision id="D001" topic="model-routing">
**Opus for orchestration, Sonnet for execution, Haiku for classification.**
The orchestrator (main loop) always runs on Opus — it makes judgment calls about dispatch, synthesis, and strategic decisions. All execution agents (researcher, planner, executor, verifier, code reviewer) run on Sonnet — detailed plans reduce the need for Opus-level reasoning. Classification, tagging, and context selection run on Haiku at 0.05x cost.
</decision>

<decision id="D002" topic="plan-format">
**Compressed XML plans, target ~800 tokens per plan.**
Plans use XML structure: `<plan>`, `<goal>`, `<files>`, `<steps>`, `<verify>`, `<context>`, `<rules>`. Each `<s>` step is one atomic instruction in imperative voice. No prose. No explanations. Plans are prompts — they tell the executor exactly what to do. Template exists at `templates/compressed-plan.xml`.
</decision>

<decision id="D003" topic="report-format">
**Structured 300-word max reports from all sub-agents.**
Every agent returns: FILES_CHANGED, VERIFICATION, DEVIATIONS, BLOCKERS, SCRIPTS_CREATED, ONE_LINER. No intro, no recap, no preamble. Template exists at `templates/agent-report-format.md`. The 80-token efficiency header (`templates/efficiency-header.xml`) is injected into every agent prompt.
</decision>

<decision id="D004" topic="token-logging">
**JSONL append-only log at `.planning/metrics/token-log.jsonl`.**
Each entry: timestamp, phase, plan, model, role, estimated input/output tokens, total, classifier model, context tokens, scripts reused/created. Estimation: word count * 1.3. The `gsd-token-logger.js` hook fires on every Agent tool call.
</decision>

<decision id="D005" topic="context-loading">
**Frontmatter-only reads + ByteRover queries replace full file loads.**
STATE.md: read offset 0, limit 30 (frontmatter only). ROADMAP.md: read on cold start only, not every loop. Context injection via `brv-query-local.js` returns ~200 tokens per query vs ~2,000 for loading a full file. Max 3 queries per dispatch, target <1,000 context tokens injected.
</decision>

<decision id="D006" topic="api-keys">
**No external API keys. Everything via Claude Code Max plan OAuth.**
ByteRover uses local query engine (`brv-query-local.js`) — BM25 text search, no LLM call. All agent dispatches go through Claude Code's Agent tool which uses the Max plan. No `brv curate` API calls — write .md files directly to `.brv/context-tree/`.
</decision>

</decisions>

## What Already Exists

- `config/model-routing.json` — routing table with models and budgets per role
- `templates/compressed-plan.xml` — XML plan format template
- `templates/agent-report-format.md` — 300-word report spec
- `templates/efficiency-header.xml` — 80-token rules header
- `hooks/gsd-token-logger.js` — PostToolUse hook for token estimation
- `overwatcher/brv-query-local.js` — local BM25 query engine
- `.planning/config.json` — full config with model routing, token efficiency, ByteRover settings

## What Phase 1 Needs To Build

The files above are templates and specs. Phase 1 needs to:

1. **Wire model routing into the orchestrate loop** — the `/gsd-orchestrate` skill references `config.json` model_routing but doesn't actually read it and pass `model:` to Agent calls yet. Need to make the dispatch step actually use the routing table.

2. **Wire the token logger hook into settings.json** — the hook file exists but needs to be registered in the user's `~/.claude/settings.json`. The `settings-overlay.json` has the config but it needs to be merged.

3. **Wire brv-query-local into the orchestrate loop** — Step 5 of the loop says "query ByteRover" but the actual orchestrate skill doesn't call the local query engine yet. Need to add `Bash: node ~/.claude/hooks/brv-query-local.js "{query}"` calls.

4. **Validate the compressed plan format works** — create a sample plan in compressed XML, dispatch a Sonnet executor with it, verify the executor follows it correctly and returns the right report format.

5. **Validate the report format enforcement** — verify that the efficiency header actually constrains agent output to <300 words structured format.

## Deferred

- ByteRover MCP tools (`brv-query`, `brv-curate`) — blocked until ByteRover supports OAuth. Using local file query for now.
- Dynamic model routing per task complexity — Phase 1 uses static routing from config. Dynamic Haiku-based classification comes in Phase 3 integration.
