---
phase: 16-vtp-enrichment
plan: 02
type: execute
wave: B
depends_on:
  - 16-01
files_modified:
  - C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-phase-researcher.md
  - C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-planner.md
  - C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-codebase-mapper.md
  - C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-assumptions-analyzer.md
autonomous: true
requirements:
  - VTP-02
  - VTP-03
  - VTP-06
  - VTP-07
tags:
  - vtp
  - agents
  - frontmatter
must_haves:
  truths:
    - "gsd-phase-researcher agent can call vtp_search_research / vtp_get_research / gated vtp_research_gate / vtp_route_and_retrieve"
    - "gsd-planner agent can call vtp_route_and_retrieve / vtp_search_substrate / vtp_get_evidence_bundle"
    - "gsd-codebase-mapper agent can call vtp_search_substrate with source_types + topics filters (VTP-06 per E-01)"
    - "gsd-assumptions-analyzer agent can call wiki_find_contradictions / wiki_search for assumption-stressing"
    - "Every patched agent body has a WHEN-to-call-VTP paragraph citing the composer contract (callVtp, no direct MCP)"
    - "Every agent's tools: line is a single comma-separated string (schema convention — not a YAML list)"
    - "Every VTP call-site in agent bodies reads VTP-EVIDENCE.md if present before making its own tier-specific VTP call"
    - "Validation Architecture Dimension 4 (agent-tier VTP-call instrumentation) coverage: post-execution manual smoke runbook section added to super-gsd/docs/vtp-enrichment-smoke.md — dispatches gsd-phase-researcher on a stub phase with pre-populated VTP-EVIDENCE.md, asserts a new routing-log row with tier:'research' appears AND agent output cites ≥1 VTP doc-ID. This dimension is NOT automated in Wave B — behavioral verification sits in the smoke runbook (covered by 16-01-T3)."
  artifacts:
    - path: "custom-gsd-extract/claude-agents/gsd-phase-researcher.md"
      provides: "VTP research-tier tool access + WHEN-to-call-VTP paragraph"
      contains: "mcp__vtp-kb__vtp_search_research"
    - path: "custom-gsd-extract/claude-agents/gsd-planner.md"
      provides: "VTP plan-tier tool access + WHEN-to-call-VTP paragraph"
      contains: "mcp__vtp-kb__vtp_route_and_retrieve"
    - path: "custom-gsd-extract/claude-agents/gsd-codebase-mapper.md"
      provides: "VTP substrate-filter tool access + WHEN-to-call-VTP paragraph"
      contains: "mcp__vtp-kb__vtp_search_substrate"
    - path: "custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md"
      provides: "VTP wiki-contradiction tool access + WHEN-to-call-VTP paragraph"
      contains: "mcp__vtp-kb__wiki_find_contradictions"
  key_links:
    - from: "gsd-phase-researcher.md#body"
      to: ".planning/phases/{N}/VTP-EVIDENCE.md"
      via: "Read tool — agent reads framing prelude if file present before calling VTP"
      pattern: "VTP-EVIDENCE.md"
    - from: "gsd-planner.md#body"
      to: "super-gsd/scripts/lib/vtp-context-composer.cjs"
      via: "Bash-invoked Node one-liner via callVtp wrapper"
      pattern: "vtp-context-composer"
    - from: "gsd-codebase-mapper.md#body"
      to: "mcp__vtp-kb__vtp_search_substrate"
      via: "composer.callVtp('vtp_search_substrate', {source_types, topics})"
      pattern: "source_types.*topics"
    - from: "gsd-assumptions-analyzer.md#body"
      to: "mcp__vtp-kb__wiki_find_contradictions"
      via: "composer.callVtp('wiki_find_contradictions', ...)"
      pattern: "wiki_find_contradictions"
---

<objective>
Wave B consumes the Wave A primitive across the core GSD agent stack. Patch 4 agents in `custom-gsd-extract/claude-agents/` (per D-03 in-place patching, no `sgsd-*` promotion) with VTP tool access + a WHEN-to-call-VTP paragraph citing the composer contract. Each agent gains tier-specific VTP tools mapped to its role.

Per E-01 research erratum: VTP-06 targets `gsd-codebase-mapper.md`, NOT the missing `gsd-pattern-mapper.md`.

Purpose: satisfies D-03 (in-place vendored patches, no promotion), E-01 (VTP-06 re-targeting), and requirements VTP-02/03/06/07.

Output: 4 patched agent files. Each patch adds VTP tool access to the `tools:` comma-string frontmatter and a 1-paragraph body insertion describing WHEN + HOW to invoke VTP via the composer.

**Wave B plans are mechanically parallelizable within the wave** (independent file ownership across 4 different agent files). However, because this plan owns all 4 files, it serializes the task ordering as a single plan. Tasks touch distinct files → safe to execute sequentially with atomic commits per task.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:\Users\user\GSDedits\.planning\STATE.md
@C:\Users\user\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-CONTEXT.md
@C:\Users\user\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-RESEARCH.md
@C:\Users\user\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md
@C:\Users\user\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-01-SUMMARY.md

<interfaces>
<!-- Key contracts extracted from RESEARCH.md + PATTERNS.md — executor uses these verbatim -->

**Agent frontmatter schema (verbatim from gsd-phase-researcher.md:4 — RESEARCH.md §SGSD Precedent Patterns point 2):**
- Agents use `tools:` comma-separated single-line string. NOT `allowed-tools:` YAML list.
- Wildcards (`mcp__vtp-kb__*`) are legal but not recommended for Phase 16 — we want explicit tool names for auditability.

**Current `tools:` strings (verified 2026-04-23):**

gsd-phase-researcher.md:4:
```
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*
```

gsd-planner.md:4:
```
tools: Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*
```

gsd-codebase-mapper.md:4:
```
tools: Read, Bash, Grep, Glob, Write
```

gsd-assumptions-analyzer.md:4:
```
tools: Read, Bash, Grep, Glob
```

**Target tool appends (verbatim from PATTERNS.md per-agent sections):**

gsd-phase-researcher (VTP-02): append `, mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_get_research, mcp__vtp-kb__vtp_research_gate, mcp__vtp-kb__vtp_route_and_retrieve`

gsd-planner (VTP-03): append `, mcp__vtp-kb__vtp_route_and_retrieve, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_get_evidence_bundle`

gsd-codebase-mapper (VTP-06 per E-01): append `, mcp__vtp-kb__vtp_search_substrate`

gsd-assumptions-analyzer (VTP-07): append `, mcp__vtp-kb__wiki_find_contradictions, mcp__vtp-kb__wiki_search`

**In-body invocation pattern (verbatim from sgsd-complete-milestone/SKILL.md:93 + PATTERNS.md §Shared Patterns):**
```
Query `mcp__vtp-kb__vtp_search` for prior milestone-like artifacts and adjacent governance research.
```

Invoke by canonical name with the `mcp__vtp-kb__` prefix inside backticks. This is how tool-gating actually works. BUT — per D-05/D-07 contract — agents call VTP through the composer's `callVtp(...)` helper, never direct MCP. The canonical-name string appears in body prose + frontmatter; the actual dispatch goes through `super-gsd/scripts/lib/vtp-context-composer.cjs`.

**VTP-EVIDENCE.md read pattern for agents (from PATTERNS.md §sgsd-orchestrate patch):**
```
Before making a VTP call, read `.planning/phases/{active_phase}/VTP-EVIDENCE.md` if present. Its framing (selected_query, retrieval_mode, reflection_verdict, top-3 doc-IDs) serves as a prelude — seed your tier-specific VTP call with those doc-IDs rather than starting from cold.
```

**Cost-sensitivity for VTP-02 `vtp_research_gate` (RESEARCH.md §VTP MCP Tool Surface row 4):**
`vtp_research_gate` is expensive. Operator-guide anti-pattern #2: defaulting to research_gate is explicitly discouraged. Agent body must gate:
- Only fire when `raw_query` mentions research/paper/principle keywords (regex: `/(research|paper|principle|experiment|literature)/i`)
- AND agent's internal research-depth heuristic indicates "deep mode" (first VTP call in a research-tier pass returned `reflection_verdict: too_generic` OR the phase-researcher's task vector explicitly requests a principle lookup).

**VTP-06 re-targeting note (E-01):**
The CONTEXT.md §canonical_refs originally listed VTP-06 targeting `gsd-pattern-mapper.md`. That file does NOT exist in `custom-gsd-extract/claude-agents/` (24 files scanned — only the global at `~/.claude/agents/gsd-pattern-mapper.md` exists, which is out of scope per D-03). VTP-06 is re-targeted to `gsd-codebase-mapper.md`. The runtime `gsd-pattern-mapper` subagent still fires in `/gsd-plan-phase`; Phase 16 just doesn't patch it.

**Risk 3 reconciliation (current_focus vs current_task):**
CONTEXT.md D-07 references `current_focus` but VTP's ContextInput uses `current_task`. Agent WHEN-paragraphs MUST reference `current_task` when citing the composer contract — not `current_focus`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Patch gsd-phase-researcher (VTP-02) + gsd-planner (VTP-03)</name>
  <files>
    C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-phase-researcher.md
    C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-planner.md
  </files>
  <read_first>
    - C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-phase-researcher.md (full file — tools: line + first role block)
    - C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-planner.md (full file — tools: line + first role block)
    - C:\Users\user\GSDedits\super-gsd\skills\sgsd-complete-milestone\SKILL.md (lines 90-115 — in-body canonical-name invocation prose style)
    - C:\Users\user\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md (§gsd-phase-researcher.md + §gsd-planner.md sections)
  </read_first>
  <action>
**File 1: `custom-gsd-extract/claude-agents/gsd-phase-researcher.md` — VTP-02**

**Step A (frontmatter patch):** On line 4, replace:
```
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*
```
with:
```
tools: Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp__context7__*, mcp__firecrawl__*, mcp__exa__*, mcp__vtp-kb__vtp_search_research, mcp__vtp-kb__vtp_get_research, mcp__vtp-kb__vtp_research_gate, mcp__vtp-kb__vtp_route_and_retrieve
```

**Step B (in-body patch):** Find the `<role>` block opening (search `<role>` in the file). Immediately AFTER the `</role>` closing tag, insert this paragraph block:

```markdown

<vtp_integration>
## VTP Evidence Grounding (Phase 16 — VTP-02)

Before drafting RESEARCH.md, ground your research against VTP's substrate + research corpus. Never call `mcp__vtp-kb__*` tools directly — always invoke via the composer wrapper at `super-gsd/scripts/lib/vtp-context-composer.cjs#callVtp` so every call logs `elapsed_ms` to `.planning/metrics/vtp-routing-log.jsonl` per the E-03 contract.

**Read VTP-EVIDENCE.md first.** If `.planning/phases/{active_phase}/VTP-EVIDENCE.md` exists (written by `sgsd-triage` Step 0), read it. Its framing (`selected_query`, `retrieval_mode`, `reflection_verdict`, top-3 doc-IDs) is your research-tier prelude — seed your tier-specific VTP call with those doc-IDs rather than starting cold.

**Tool selection:**

- **`mcp__vtp-kb__vtp_search_research`** — PRIMARY. Use for "what do papers say about X" framing. Returns paper slugs + principle abstracts + retrieval scores.
- **`mcp__vtp-kb__vtp_get_research`** — FOLLOW-UP. Fetch canonical paper when `vtp_search_research` returns a relevant slug.
- **`mcp__vtp-kb__vtp_research_gate`** — GATED (cost-sensitive). Only fire when BOTH: (a) the raw query mentions research/paper/principle keywords (regex: `/(research|paper|principle|experiment|literature)/i`), AND (b) a prior `vtp_search_research` call returned `reflection_verdict: too_generic` OR the task vector explicitly requests a principle lookup. Never default to this tool — the operator-guide classifies over-use as an anti-pattern.
- **`mcp__vtp-kb__vtp_route_and_retrieve`** — FALLBACK. Use when the research-vs-substrate choice is ambiguous; let VTP's routing layer decide.

**Cite VTP evidence inline in RESEARCH.md.** Use explicit doc-ID / paper-slug / principle-ID references (planner's discretion on exact citation format per CONTEXT.md §decisions). Evidence rows in RESEARCH.md's Sources section MUST cite the `doc_id` of each VTP hit that informed the claim — enables downstream plan-checker cross-reference.

**Graceful-fail:** if `callVtp` returns `{ok:false}`, log the reason to the routing-log (the composer does this automatically) and proceed with non-VTP research sources (WebSearch, WebFetch, Grep of local patterns). Never block on VTP unavailability.
</vtp_integration>
```

**File 2: `custom-gsd-extract/claude-agents/gsd-planner.md` — VTP-03**

**Step A (frontmatter patch):** On line 4, replace:
```
tools: Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*
```
with:
```
tools: Read, Write, Bash, Glob, Grep, WebFetch, mcp__context7__*, mcp__vtp-kb__vtp_route_and_retrieve, mcp__vtp-kb__vtp_search_substrate, mcp__vtp-kb__vtp_get_evidence_bundle
```

**Step B (in-body patch):** Find the `<role>` block opening. Immediately AFTER the `</role>` closing tag, insert this paragraph block:

```markdown

<vtp_integration>
## VTP Architecture Grounding (Phase 16 — VTP-03)

When drafting PLAN.md for non-trivial plans, ground your architecture decisions against VTP's substrate corpus. Never call `mcp__vtp-kb__*` tools directly — always invoke via the composer wrapper at `super-gsd/scripts/lib/vtp-context-composer.cjs#callVtp` so every call logs `elapsed_ms` to `.planning/metrics/vtp-routing-log.jsonl` per the E-03 contract.

**Read VTP-EVIDENCE.md first.** If `.planning/phases/{active_phase}/VTP-EVIDENCE.md` exists (written by `sgsd-triage` Step 0), read it. Seed your plan-tier VTP call with its top-3 doc-IDs rather than starting cold.

**Tool selection:**

- **`mcp__vtp-kb__vtp_route_and_retrieve`** — PRIMARY. Architecture-mode framing. Pass the phase goal + plan scope as `raw_query`; VTP's routing layer picks the right retrieval mode. Returns `retrieval_plan` + `evidence.documents` + `reflection.verdict`.
- **`mcp__vtp-kb__vtp_search_substrate`** — SECONDARY. Use directly when plan needs filterable lookup (e.g., `source_types: ['architecture', 'pattern']` + `topics: [phase_domain_keyword]`). Bypasses routing overhead — also the fast-path target per D-07.
- **`mcp__vtp-kb__vtp_get_evidence_bundle`** — BREADTH HELPER. Use when a task action needs ranked evidence + canonical docs + linked entities in one call (e.g., cross-referencing multiple patterns before committing to a task's file list).

**Cite VTP evidence inline in PLAN.md.** When a task's `<action>` or `<read_first>` references a pattern or architectural decision, cite the VTP `doc_id` or `rel_path` so the executor can re-query for the canonical content at execute time (per the re-query contract in VTP-EVIDENCE.md).

**Graceful-fail:** if `callVtp` returns `{ok:false}`, proceed with non-VTP planning sources (codebase Grep, existing PATTERNS.md, Context7 for external docs). Never block on VTP unavailability.
</vtp_integration>
```

**Commits:** 
- `feat(16-02): add VTP research-tier tools + WHEN paragraph to gsd-phase-researcher`
- `feat(16-02): add VTP plan-tier tools + WHEN paragraph to gsd-planner`
  </action>
  <verify>
    <automated>grep -q "mcp__vtp-kb__vtp_search_research" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-phase-researcher.md" &amp;&amp; grep -q "mcp__vtp-kb__vtp_get_research" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-phase-researcher.md" &amp;&amp; grep -q "mcp__vtp-kb__vtp_research_gate" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-phase-researcher.md" &amp;&amp; grep -q "vtp-context-composer" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-phase-researcher.md" &amp;&amp; grep -q "mcp__vtp-kb__vtp_route_and_retrieve" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-planner.md" &amp;&amp; grep -q "mcp__vtp-kb__vtp_search_substrate" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-planner.md" &amp;&amp; grep -q "vtp-context-composer" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-planner.md"</automated>
  </verify>
  <acceptance_criteria>
    - gsd-phase-researcher.md `tools:` line contains all 4 new tools (`vtp_search_research`, `vtp_get_research`, `vtp_research_gate`, `vtp_route_and_retrieve`).
    - gsd-phase-researcher.md body contains `<vtp_integration>` block with the phrase "Never call `mcp__vtp-kb__*` tools directly" and "composer wrapper" and "VTP-EVIDENCE.md".
    - gsd-planner.md `tools:` line contains all 3 new tools (`vtp_route_and_retrieve`, `vtp_search_substrate`, `vtp_get_evidence_bundle`).
    - gsd-planner.md body contains `<vtp_integration>` block with composer-wrapper assertion.
    - `tools:` lines remain single-line comma-separated strings (NOT converted to YAML lists) — verify with `grep -c "^tools: " file` returns 1.
    - YAML frontmatter still parses (no broken frontmatter closure `---`).
  </acceptance_criteria>
  <done>Both agent files have VTP tools in `tools:` string + body WHEN-paragraph referencing composer + VTP-EVIDENCE.md + graceful-fail.</done>
</task>

<task type="auto">
  <name>Task 2: Patch gsd-codebase-mapper (VTP-06 per E-01) + gsd-assumptions-analyzer (VTP-07)</name>
  <files>
    C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-codebase-mapper.md
    C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-assumptions-analyzer.md
  </files>
  <read_first>
    - C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-codebase-mapper.md (full file — tools: line + first role block)
    - C:\Users\user\GSDedits\custom-gsd-extract\claude-agents\gsd-assumptions-analyzer.md (full file — tools: line + first role block)
    - C:\Users\user\GSDedits\.planning\milestones\v1.3\phases\16-vtp-enrichment\16-PATTERNS.md (§gsd-codebase-mapper.md + §gsd-assumptions-analyzer.md sections)
  </read_first>
  <action>
**File 1: `custom-gsd-extract/claude-agents/gsd-codebase-mapper.md` — VTP-06 (per E-01)**

**Step A (frontmatter patch):** On line 4, replace:
```
tools: Read, Bash, Grep, Glob, Write
```
with:
```
tools: Read, Bash, Grep, Glob, Write, mcp__vtp-kb__vtp_search_substrate
```

**Step B (in-body patch):** Find the `<role>` closing tag. Immediately AFTER `</role>`, insert this paragraph block:

```markdown

<vtp_integration>
## VTP Substrate-Filter Lookup (Phase 16 — VTP-06 per E-01)

When mapping codebase patterns, supplement in-repo Grep with VTP substrate lookups so cross-project patterns surface alongside local ones. Never call `mcp__vtp-kb__*` tools directly — always invoke via the composer wrapper at `super-gsd/scripts/lib/vtp-context-composer.cjs#callVtp` so every call logs `elapsed_ms` to `.planning/metrics/vtp-routing-log.jsonl` per the E-03 contract.

**Read VTP-EVIDENCE.md first.** If `.planning/phases/{active_phase}/VTP-EVIDENCE.md` exists, read its top-3 doc-IDs and seed your substrate call with them as context.

**Tool selection:**

- **`mcp__vtp-kb__vtp_search_substrate`** — PRIMARY. Pass `source_types: ['architecture', 'pattern', 'code']` and `topics: [domain_keyword_from_phase_scope]` to retrieve analog code/doc references alongside your in-repo Grep results. Returns `hits[]` with `chunk_id`, `doc_id`, `rel_path`, `section_title`, `source_type`, `entity_types[]`, `score`, `text`.

**Integration pattern:** run VTP substrate lookup AND in-repo Grep in parallel; present both in your PATTERNS.md output. In-repo patterns get precedence when they conflict (the local codebase is ground truth for its own conventions), but VTP hits surface analog patterns worth knowing about.

**Note (E-01):** This agent (`gsd-codebase-mapper`) is the replacement target for the originally planned `gsd-pattern-mapper.md`, which does not exist in this vendored extract. The runtime `gsd-pattern-mapper` subagent at the global Claude agents path still fires during `/gsd-plan-phase` — Phase 16 simply doesn't patch that one (out of scope per D-03).

**Graceful-fail:** if `callVtp` returns `{ok:false}`, proceed with Grep-only pattern discovery. Never block on VTP unavailability.
</vtp_integration>
```

**File 2: `custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md` — VTP-07**

**Step A (frontmatter patch):** On line 4, replace:
```
tools: Read, Bash, Grep, Glob
```
with:
```
tools: Read, Bash, Grep, Glob, mcp__vtp-kb__wiki_find_contradictions, mcp__vtp-kb__wiki_search
```

**Step B (in-body patch):** Find the `<role>` closing tag. Immediately AFTER `</role>`, insert this paragraph block:

```markdown

<vtp_integration>
## VTP Wiki-Contradiction Stressing (Phase 16 — VTP-07)

When analyzing assumptions, stress them against VTP's wiki narrative corpus for contradictions. Never call `mcp__vtp-kb__*` tools directly — always invoke via the composer wrapper at `super-gsd/scripts/lib/vtp-context-composer.cjs#callVtp` so every call logs `elapsed_ms` to `.planning/metrics/vtp-routing-log.jsonl` per the E-03 contract.

**Read VTP-EVIDENCE.md first.** If `.planning/phases/{active_phase}/VTP-EVIDENCE.md` exists, read its top-3 doc-IDs as context.

**Tool selection:**

- **`mcp__vtp-kb__wiki_find_contradictions`** — PRIMARY. Standalone entry point (no search-first needed per the tool's schema). For each high-confidence assumption in your analysis, call `wiki_find_contradictions` with the assumption text as query. Returns contradiction listings from VTP's wiki corpus — each contradiction lowers the assumption's confidence rating in your output artifact.
- **`mcp__vtp-kb__wiki_search`** — SECONDARY. When `wiki_find_contradictions` surfaces a relevant page, follow up with `wiki_search` to fetch the full narrative context before adjusting the assumption's confidence.

**Integration pattern:** for each assumption with `confidence: high`, call `wiki_find_contradictions`. If contradictions return, downgrade confidence to `medium` or `low` in your output and cite the contradicting doc_id. If no contradictions return, retain the confidence rating and annotate `vtp_stress_test: passed`.

**Graceful-fail:** if `callVtp` returns `{ok:false}`, proceed with local Grep-based assumption validation and annotate each assumption's `vtp_stress_test: unavailable` so downstream plan-checker knows the stress-test didn't run.
</vtp_integration>
```

**Commits:**
- `feat(16-02): add VTP substrate-filter tool to gsd-codebase-mapper (VTP-06 per E-01)`
- `feat(16-02): add VTP wiki-contradiction tools to gsd-assumptions-analyzer`
  </action>
  <verify>
    <automated>grep -q "mcp__vtp-kb__vtp_search_substrate" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-codebase-mapper.md" &amp;&amp; grep -q "vtp-context-composer" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-codebase-mapper.md" &amp;&amp; grep -q "per E-01" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-codebase-mapper.md" &amp;&amp; grep -q "mcp__vtp-kb__wiki_find_contradictions" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md" &amp;&amp; grep -q "mcp__vtp-kb__wiki_search" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md" &amp;&amp; grep -q "vtp-context-composer" "C:/Users/user/GSDedits/custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md"</automated>
  </verify>
  <acceptance_criteria>
    - gsd-codebase-mapper.md `tools:` line contains `mcp__vtp-kb__vtp_search_substrate`.
    - gsd-codebase-mapper.md body contains `<vtp_integration>` block + composer-wrapper assertion + E-01 re-targeting note.
    - gsd-assumptions-analyzer.md `tools:` line contains both `wiki_find_contradictions` AND `wiki_search`.
    - gsd-assumptions-analyzer.md body contains `<vtp_integration>` block + wiki-contradiction primary + stress-test annotation pattern.
    - `tools:` lines in both files remain single-line comma-separated strings.
    - YAML frontmatter still parses in both files.
  </acceptance_criteria>
  <done>Both agent files have VTP tools in `tools:` string + body WHEN-paragraph with integration pattern + graceful-fail.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Agent body prose ↔ YAML frontmatter | Malformed insertion could break frontmatter closure `---` causing agent-load failure. |
| Agent ↔ Composer | Agent code invokes composer via Bash one-liner — command-injection risk if agent's raw_query is shell-interpolated naively. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-09 | Tampering | Agent frontmatter `tools:` string (malformed append breaks YAML) | mitigate | After patching, verify with `grep -c "^---$" file` returns 2 (frontmatter open+close still bounded) AND `tools:` line count is exactly 1. |
| T-16-10 | Tampering | Agent body `<vtp_integration>` block could interpolate `raw_query` unsafely when Bash-invoking composer | mitigate | Agents pass `raw_query` to composer via `process.argv` JSON — never via shell string interpolation. Composer's `callVtp` already treats args as structured data. Document this in the WHEN-paragraph: "invoke the composer via `node -e` with JSON-stringified args, not shell-interpolated strings." |
| T-16-11 | Info-disclosure | Agent's VTP calls might log operator prose containing secrets | accept | Same trust level as existing `activity-log.jsonl`. Composer's `recent_commands` sanitizer (Plan 01 T-16-03) is the enforcement point. Agents inherit the protection via composer. |
| T-16-12 | DoS | Agent's research-gate call is expensive — unbounded calls exhaust VTP quota | mitigate | Cost-gate in gsd-phase-researcher WHEN-paragraph: `vtp_research_gate` only fires on keyword-match AND prior-call `too_generic` verdict. Documented explicitly. |
| T-16-13 | Spoofing | VTP response could claim contradictions where none exist, manipulating assumption confidence | accept | Contradiction findings are advisory, not access-control. Assumptions-analyzer still produces operator-reviewable output with cited `doc_id` — operator can verify the contradiction claim by reading the cited source. |
</threat_model>

<verification>
End-of-wave gate:

```bash
# All 4 agents have VTP tools in frontmatter
for agent in gsd-phase-researcher gsd-planner gsd-codebase-mapper gsd-assumptions-analyzer; do
  grep -E "^tools:.*mcp__vtp-kb__" "custom-gsd-extract/claude-agents/${agent}.md" || { echo "MISSING: ${agent}"; exit 1; }
done

# All 4 agents reference composer in body
for agent in gsd-phase-researcher gsd-planner gsd-codebase-mapper gsd-assumptions-analyzer; do
  grep -q "vtp-context-composer" "custom-gsd-extract/claude-agents/${agent}.md" || { echo "NO COMPOSER REF: ${agent}"; exit 1; }
done

# All 4 agents have graceful-fail wording
for agent in gsd-phase-researcher gsd-planner gsd-codebase-mapper gsd-assumptions-analyzer; do
  grep -q "Graceful-fail\|graceful-fail" "custom-gsd-extract/claude-agents/${agent}.md" || { echo "NO GRACEFUL-FAIL: ${agent}"; exit 1; }
done

# Frontmatter structure intact
for agent in gsd-phase-researcher gsd-planner gsd-codebase-mapper gsd-assumptions-analyzer; do
  [[ $(grep -c "^---$" "custom-gsd-extract/claude-agents/${agent}.md") -eq 2 ]] || { echo "FRONTMATTER BROKEN: ${agent}"; exit 1; }
  [[ $(grep -c "^tools: " "custom-gsd-extract/claude-agents/${agent}.md") -eq 1 ]] || { echo "TOOLS LINE DUPLICATED: ${agent}"; exit 1; }
done
```
</verification>

<success_criteria>
Wave B is complete when:
1. All 4 agents (`gsd-phase-researcher`, `gsd-planner`, `gsd-codebase-mapper`, `gsd-assumptions-analyzer`) have VTP tools appended to their `tools:` comma-string frontmatter lines.
2. All 4 agents have a `<vtp_integration>` body block inserted after `</role>` with:
   - "Never call `mcp__vtp-kb__*` tools directly" assertion
   - "composer wrapper" reference to `super-gsd/scripts/lib/vtp-context-composer.cjs`
   - "Read VTP-EVIDENCE.md first" directive
   - Tier-appropriate tool selection table
   - "Graceful-fail" paragraph
3. gsd-codebase-mapper.md body contains the E-01 re-targeting note ("replacement target for the originally planned `gsd-pattern-mapper.md`").
4. gsd-phase-researcher.md body contains the `vtp_research_gate` cost-gate (keyword regex + prior `too_generic` precondition).
5. 4 atomic commits, one per agent, using `feat(16-02): ...` prefix.
6. No frontmatter corruption: every agent file has exactly 2 `---` lines and exactly 1 `tools:` line.
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.3/phases/16-vtp-enrichment/16-02-SUMMARY.md` capturing:
- files_changed list
- verification commands and their outputs
- any deviations from plan
- one-liner summary for the orchestrator
</output>
