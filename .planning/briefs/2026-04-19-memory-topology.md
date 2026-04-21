# Brief: SGSD memory topology — BRV replacement + cross-project tier

## Situation

Every `brv-query` / `brv-curate` call in CLAUDE.md, agent specs, and skills is currently a no-op. Evidence: the `brv` binary is not on PATH; `mcp__brv__*` tools do not surface at session start; the declared MCP server in `.mcp.json` points to a command that doesn't exist. Meanwhile `.brv/context-tree/` holds 12 curated .md files of real orchestrator wisdom (patterns, anti-patterns, decisions, expertise, token-efficiency guidance) — a knowledge graveyard with no circulatory system. Separately, clarity-erp's just-shipped `clarity-memory` MCP (428 entries, 7 tools: query/get/list/save/update/stats/reindex, FastMCP stdio, Mongo-backed with file-scan fallback for Windows-local sources) works — but is scoped to clarity's infra, invisible from GSDedits or any other project. The upcoming MUDA + intent programs both depend on a working memory tier; this brief decides what that tier looks like.

## Stakes

Everything downstream rides on this. If memory retrieval stays broken, MUDA audits have nowhere to write findings that anyone reads, the classifier can't consult lessons, and intent continuity can't persist across phases. If the wrong topology is chosen, clarity-specific quirks (SAP schema peculiarities, UDF dictionaries) leak into other projects' orchestrators, OR orchestrator patterns get trapped in clarity's Mongo and never reach other projects. The cost of re-architecting after MUDA/intent are built on top is higher than deciding right now.

## Constraints

- Reuse the clarity-memory pattern (FastMCP + Mongo + file-scan fallback). It took real engineering; don't duplicate.
- No external paid infra — Pinecone / MongoDB Atlas / OpenAI embeddings all off-limits. Local Mongo or plain filesystem only.
- Two-tier scope is non-negotiable: PROJECT-local knowledge (SAP quirks, domain) stays isolated; ORCHESTRATOR-global patterns (dispatch rules, waste lessons, anti-patterns) must be queryable from any project.
- Retrieval must be callable from both Claude Code sessions (via MCP tools) and from SGSD sub-agents dispatched during a loop (via whatever interface the orchestrator composes into their prompts).
- GSDedits and clarity-erp are today's project set, but architecture must not assume count.

## Key Questions

1. **Topology.** Pick one of:
   (a) **Extend clarity-memory cross-project** — add a `source: sgsd-orchestrator` namespace, point GSDedits's `.mcp.json` at the same server. Pros: one moving part, reuses existing Mongo. Cons: clarity's devcp becomes a dependency for every SGSD session everywhere; clarity-local knowledge leaks into cross-project queries unless filtered carefully.
   (b) **Clone to a second `sgsd-memory` MCP** in GSDedits, backed by `.brv/context-tree/` and its own Mongo (or no Mongo — file-scan only). Two servers, two namespaces, clean separation. Pros: full isolation, simple tag logic. Cons: two servers to maintain, two indices to keep warm.
   (c) **Filesystem-only for orchestrator tier** — no MCP for SGSD-global. Agents Grep `.brv/context-tree/` directly; curate = `Write` a new .md. Zero infra. Cons: no Mongo text index, no ranking, retrieval quality lower than BM25.

2. **Migration of the 12 existing `.brv/context-tree/` files.** Once topology is chosen, do we (a) leave them in place and have agents find them via whatever the chosen tier offers, (b) import them into clarity-memory (if topology = a), or (c) treat them as authoritative and build retrieval around them?

3. **Retrieval interface at the dispatch layer.** SGSD's orchestrator composes agent prompts. Should memory retrieval be (a) invoked by the orchestrator (Opus) during prompt composition and injected as plain text into each sub-agent prompt, or (b) exposed as an MCP tool each sub-agent can call itself during execution? (a) keeps sub-agent prompts tight; (b) lets sub-agents explore when their initial context misses the right angle.

## Additional Context

- clarity-memory ships: `49af0c25`..`afe14454` inside clarity-erp.
- `.brv/context-tree/` actually has real content — not a blank slate. Any topology decision must preserve it or migrate it deliberately.
- Brief 1 (MUDA) and the yet-undrafted intent-continuity brief both block on this decision.

## Termination

phases_affected: 8
max_rounds: 2
gate_score: pending

<!-- 8 = every skill that today references brv-query/brv-curate (CLAUDE-OVERLAY, sgsd-orchestrate,
     sgsd-context-selector, sgsd-milestone-readiness, sgsd-token-audit, sgsd-deliberate,
     sgsd-resume, sgsd-transition). Every future skill too. -->
