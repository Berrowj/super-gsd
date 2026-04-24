# Phase 21: VTP Enrichment Gates — Context

**Gathered:** 2026-04-24 (discuss-phase via /gsd-discuss-phase 21 — operator accepted `defaults` across 7 gray areas)
**Status:** Ready for research
**Milestone:** v1.5 — VTP Knowledge Primacy + Post-v1.4 Hardening

<domain>
## Phase Boundary

Elevate VTP from passive MCP server into active enrichment gate on the research→planning boundary + audit surfaces + deliberation rounds. Formalizes a pattern `feedback_vtp_enriched_dispatch` memory described as aspirational (zero `VTP-EVIDENCE.md` files exist in repo today despite memory) into MANDATORY gate enforcement.

**6 items in scope (VTPE-01..06 per REQUIREMENTS.md):**
- VTPE-01: Research→Planning boundary enrichment gate (new `sgsd-vtp-enrichment` gate between `gsd-phase-researcher` and `gsd-planner`)
- VTPE-02: Audit workflow cross-reference (sgsd-audit + sgsd-muda-audit + gsd-audit-milestone — Library Cross-Reference section)
- VTPE-03: Milestone-close library cross-reference (sgsd-complete-milestone Step 6 SUMMARY generation gains Connections subsection)
- VTPE-04: Design-policy config locks (`config.json.vtp_enrichment` block with challenger_mode=false, granularity=tier-based, empty_hit_policy=continue)
- VTPE-05: Empty-hit artifact discipline (gate MUST write VTP-ENRICHMENT.md even on zero hits with explicit zero-hits rationale)
- VTPE-06: sgsd-board-researcher — 5th deliberation voice querying VTP library during CEO/Board rounds

**Leverage from Phase 16 (v1.3 shipped):**
- `super-gsd/scripts/lib/vtp-context-composer.cjs` — existing VTP composer used by sgsd-triage + sgsd-complete-milestone Step 7. Phase 21 extends/reuses.
- `mcp__vtp-kb__*` tools — all 37 tools available per session tool list
- 4-member board scaffold (sgsd-board-architect/pragmatist/contrarian/moonshot agents) — identical structure, researcher = clean copy+adapt

**Non-goals:**
- Challenger mode (Q2=B locked — revisit in v1.6 if enrich-only proves insufficient)
- Write-side VTP publish (tier-3 gap persists — awaits VTP API extension)
- Net-new VTP tools — consume existing MCP surface only
- Multi-source library (only VTP — no alt MCP servers this phase)

</domain>

<decisions>
## Implementation Decisions (7 locked via discuss-phase defaults)

### D-01: VTP tool selection — 5-tool priority cascade
Every enrichment gate runs all 5 in priority order, SHORT-CIRCUITING if earlier calls return zero hits for same query seed:

1. `mcp__vtp-kb__vtp_search` — keyword + semantic search across all layers
2. `mcp__vtp-kb__vtp_search_substrate` — content-layer (books/papers themselves, NOT wiki entities) — scoped per `feedback_vtp_search_layer_routing` memory
3. `mcp__vtp-kb__vtp_search_research` — prior research artifacts
4. `mcp__vtp-kb__vtp_route_and_retrieve` — end-to-end routing for domain queries
5. `mcp__vtp-kb__vtp_advise_service_enrichment` — conservative proposal-grounding (borrow pattern from sgsd-vtp-advise)

Tool 1+2 always run (cheap keyword+content sweep). Tools 3+4+5 run ONLY if 1+2 returned non-zero hits (avoids wasted spend when library doesn't cover topic).

### D-02: Query seed = 3-source concatenation
Each enrichment gate builds its query seed by concatenating:
1. Phase CONTEXT.md scope section (the `<domain>` block)
2. REQ-IDs' acceptance criteria (from REQUIREMENTS.md)
3. RESEARCH.md findings (phase-level; gate runs AFTER researcher)

Formed into a single natural-language query, truncated to 800 tokens max. Avoids narrow-keyword bias and matches the content operator curated into the library.

### D-03: Max 5 queries per enrichment gate (token cap)
Each VTP tool call counts as ONE query. Cap = 5 → one per tool in the D-01 cascade. Under 800-token-seed × 5 queries → ~2k total input + ~3k synthesis output = ~5k tokens per gate. Conservative enough to fire every phase.

### D-04: VTP-ENRICHMENT.md artifact structure
Downstream agents (planner, audit rerun) consume this shape:

```markdown
---
phase: {NN}
query_count: {1..5}
total_hits: {N}
duration_ms: {N}
empty_hit: {true|false}
generated_at: {ISO}
---

# VTP Library Enrichment — Phase {NN}

## Library Hits
| Source | Title | Section | Relevance | Citation |
|---|---|---|---|---|
...

## Gaps the library surfaces
- <bullet>

## Alternative framings from library
- <bullet>

## Empty-Hit Rationale (ONLY present if total_hits == 0)
Topic: "{seed summary}"
Reasoning: "{why library has no coverage — domain out of scope, too new, etc.}"
```

Mirrors existing RESEARCH.md shape. Planner already consumes that format.

### D-05: Audit cross-ref tier-based batching
Per Q4=C tier-based policy:

| Finding tier | VTP behavior | Query shape |
|---|---|---|
| **CRITICAL** | Per-finding deep query | Query seed = finding text + file:line context |
| **WARN** | Batched end-of-audit | Query seed = all WARN findings concatenated, single VTP call |
| **PASS** | No VTP call | Skip entirely — PASS items need no library precedent |

CRITICAL+WARN mixed findings → the CRITICAL component triggers per-finding query; remaining WARN components roll into batched query.

### D-06: sgsd-board-researcher model = sonnet
Consistency with existing 4 board agents (all sonnet per their frontmatter). Library queries + synthesis are sonnet-class complexity. Model routing override goes via config.model_routing if needed.

### D-07: config.json backward-compat = DISABLED default
`config.json.vtp_enrichment` block absent → all gates DISABLED (no VTP-ENRICHMENT.md required, no Library Cross-Reference sections, no researcher board voice). Existing pre-Phase-21 projects get zero behavioral drift.

Opt-in shape:
```json
{
  "vtp_enrichment": {
    "enabled": true,
    "challenger_mode": false,
    "granularity": "tier-based",
    "empty_hit_policy": "continue",
    "max_queries_per_gate": 5,
    "query_seed_max_tokens": 800,
    "audit_tier_batching": {
      "critical": "per-finding",
      "warn": "batched",
      "pass": "skip"
    }
  }
}
```

Matches `handoff.enabled=false` precedent from v1.4.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §VTPE-01..06 — AC verbatim
- `.planning/ROADMAP.md` §"Phase 21" — phase structure + dependencies
- `.planning/backlog/v15-vtp-enrichment-gates.md` — original seed with operator-directive quotes

### Phase 16 VTP substrate (reuse foundation)
- `super-gsd/scripts/lib/vtp-context-composer.cjs` — VTP composer primitive
- `super-gsd/skills/sgsd-vtp-advise/SKILL.md` — standalone advisor skill (pattern precedent for gate)
- `.planning/milestones/v1.3/phases/16-vtp-enrichment/16-CONTEXT.md` — Phase 16 locked decisions
- `.planning/milestones/v1.3/phases/16-vtp-enrichment/16-SUMMARY.md` — what actually shipped

### Board agent scaffold (for VTPE-06)
- `super-gsd/agents/sgsd-board-architect.md` — template structure (role / temperament / reasoning / heuristics)
- `super-gsd/agents/sgsd-board-pragmatist.md` — model/frontmatter pattern
- `super-gsd/agents/sgsd-board-contrarian.md` — adversarial voice pattern (closest to researcher's "propose alternative framings" spirit)
- `super-gsd/agents/sgsd-board-moonshot.md` — ambitious voice pattern
- `super-gsd/agents/sgsd-ceo.md` — orchestrator that dispatches board members (will need round-robin update to include 5th voice)

### Existing VTP consumers (don't duplicate)
- `super-gsd/skills/sgsd-triage/SKILL.md` — consumes VTP during triage
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` Step 7 — VTP bidirectional
- `super-gsd/skills/sgsd-vtp-advise/SKILL.md` — ad-hoc VTP advisor

### SKILL.md dispatch path (for VTPE-01 integration)
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — contains Step 6.b (research dispatch) + Step 6.c (planner dispatch). VTPE-01 inserts new gate BETWEEN them as Step 6.b.5 or similar.

### Orchestrator gate lookup
- `super-gsd/registry/gates.yaml` — gate declarations (per-dispatch-ATC, phase-level-ATC, etc.). Phase 21 adds `vtp-enrichment` gate row.
- `super-gsd/scripts/lib/gates-registry.cjs` — gate predicate evaluator. VTPE-01 uses this to `shouldFire()` based on dispatch context.

### Memory references (existing aspirational pattern)
- `.planning/memory/workflow/feedback/feedback_vtp_enriched_dispatch.md` — aspirational VTP-EVIDENCE.md pattern. Phase 21 REPLACES this with actual mechanical gate + VTP-ENRICHMENT.md artifact.
- `.planning/memory/workflow/feedback/feedback_vtp_search_layer_routing.md` — VTP tool routing (substrate vs wiki) — honored in D-01.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `vtp-context-composer.cjs` primitive — wraps VTP tool calls, returns composed context. Phase 21 Plan 21-01 extends this with `sgsd-vtp-enrichment.cjs` sibling OR a `composeEnrichment()` function on the existing module.
- Board agent scaffold — 5-file pattern (role/temperament/reasoning/heuristics/output_format). VTPE-06 = copy sgsd-board-architect.md, swap role paragraph for Researcher, swap tools list to include VTP MCP tools.
- gates.yaml row pattern — `per-dispatch-ATC` and `phase-level-ATC` show how to declare a gate with trigger predicate + evidence_emitted list + escalation policy. VTPE-01 gate adds `vtp-enrichment` row with `trigger: research_phase_complete && vtp_enrichment.enabled`, `evidence_emitted: [VTP-ENRICHMENT.md]`, `escalation: block on vtp_api_error`.
- sgsd-orchestrate SKILL.md insertion pattern — multiple gates already wired between research and executor (see Step 6.b → 6.c). Adding VTPE-01 is a 20-line addition between them.

### Established Patterns
- Atomic commit per task: `feat(21-NN/TX): VTPE-NN <action>`
- Node read-mutate-write for config (never cat/head/echo per `feedback_never_head_settings`)
- ASCII-only shell strings (Phase 17 UTF-8 lesson)
- v2 plan schema with tasks[] array (Phase 11 established; caught by plan-check in Phase 19)
- Dry-run safety flags for new gates (v1.4 handoff precedent)

### Integration Points
- **SKILL.md orchestrator** — insert VTPE-01 dispatch between research and planner steps. Check `config.vtp_enrichment.enabled` before running.
- **sgsd-complete-milestone Step 7** — already has VTP bidirectional; VTPE-03 EXTENDS Step 7 to also write cross-reference citations into the milestone SUMMARY.md Connections section. Don't duplicate — extend.
- **sgsd-audit + sgsd-muda-audit + gsd-audit-milestone** — three separate skill files. VTPE-02 pattern: add a `vtp_cross_reference(finding)` helper function callable from each; OR add a common trailing step across all 3 skills. Helper function approach is cleaner (DRY).
- **sgsd-ceo + board dispatch** — VTPE-06 adds new agent file. sgsd-ceo workflow has round-robin dispatch logic that must be updated to include 5th voice. Check config.deliberation.board array — append "researcher".

</code_context>

<specifics>
## Specific Ideas

- **Aspirational-vs-actual pattern gap**: `feedback_vtp_enriched_dispatch` memory claims every dispatch consumes VTP, but ZERO `VTP-EVIDENCE.md` files exist in repo. Phase 21 is about closing this gap mechanically — gate writes the artifact, orchestrator enforces its existence before advancing.
- **Empty-hit is NOT failure**: if VTP returns zero hits for a topic, that IS the correct answer for domains the library doesn't cover (e.g., very new tech). VTPE-05 artifact discipline requires the gate write an empty-hit artifact with explicit "topic X not covered" rationale. Operator over time will see which topics repeatedly go unenriched → informs what books/papers to add to library.
- **VTP errors ≠ empty hits**: VTP API error (MCP server down, timeout, auth fail) → HARD BLOCK (operator intervention). Zero hits → AUTONOMOUS continue with empty-hit artifact. The distinction matters for Q3=A discipline.
- **Researcher voice in deliberation is additive, not replacing**: the 4 existing board members stay. Researcher joins as 5th round-robin voice. Expected +3-5k tokens per deliberation round — cheap relative to overall deliberation cost (~20-40k tokens for full 2-round CEO/Board).
- **Phase 21 itself will exercise VTP enrichment on itself once shipped** — meta-dogfood: the moment VTPE-01 is live, subsequent phases (22, 23, 24, 25) each get VTP-ENRICHMENT.md artifacts. Natural proving ground.

</specifics>

<deferred>
## Deferred Ideas

- **Challenger mode** — Q2=B locked; revisit in v1.6 if enrich-only proves insufficient (e.g., Codex-like "WARN you should consider library alternative X" pressure)
- **Multi-library sources** — only VTP this phase; ByteRover / other MCP servers deferred
- **Per-citation confidence scoring** — current design has flat "relevance" column; ML-ranked confidence deferred
- **Write-side VTP publish** — tier-3 gap persists; awaits VTP API extension
- **Cross-phase library diff** — tracking which hits repeat across phases → quality signal. Deferred.
- **VTP query caching** — repeated phase terms could reuse recent query results. Performance optimization; not needed until proven slow.
- **Configurable per-gate tool subset** — currently all 5 VTP tools run for every gate. Future: config flag to enable subset per gate type. Deferred until usage patterns emerge.

</deferred>

---

*Phase: 21-vtp-enrichment-gates*
*Milestone: v1.5 VTP Knowledge Primacy + Post-v1.4 Hardening*
*Context gathered: 2026-04-24 via /gsd-discuss-phase 21 (operator accepted defaults)*
