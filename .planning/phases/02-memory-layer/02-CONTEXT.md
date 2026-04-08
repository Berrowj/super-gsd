# Phase 2: Memory Layer - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — autonomous mode)

<domain>
## Phase Boundary

Orchestrator can query local context before dispatching agents and curate new knowledge after, with zero API keys. ByteRover context tree with BM25 local search replaces flat memory file loading.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Use ROADMAP phase goal, success criteria, and codebase conventions to guide decisions.

### Locked from Prior Phases
- D006: No external API keys — local query engine only (brv-query-local.js)
- D005: Frontmatter-only reads + brv-query replaces full file loads
- brv-query-local.js already exists and works (tested: returns ranked results)
- 9 seed files already in .brv/context-tree/ (patterns/, anti-patterns/, expertise/)
- Context tree uses YAML frontmatter: title, tags, keywords, importance, maturity

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- super-gsd/overwatcher/brv-query-local.js — BM25 search, installed at ~/.claude/hooks/
- super-gsd/templates/executor-brv-overlay.xml — template for injecting context into executor prompts
- super-gsd/templates/planner-brv-overlay.xml — template for injecting context into planner prompts
- super-gsd/templates/verifier-brv-overlay.xml — template for injecting context into verifier prompts

### Established Patterns
- Context tree files: .brv/context-tree/{domain}/{topic}.md with YAML frontmatter
- Query: node brv-query-local.js "search terms" --max N --format json
- Curate: write .md file directly to .brv/context-tree/{domain}/

### Integration Points
- Orchestrate loop Step 5 (QUERY BYTEROVER) — needs to call brv-query-local.js
- Orchestrate loop Step 10 (CURATE LEARNINGS) — needs to write files to context tree
- Agent prompt composition — overlay templates inject brv results into agent prompts

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. The query engine and seed files already exist. This phase wires them into the orchestrator loop and adds the curation pipeline.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
