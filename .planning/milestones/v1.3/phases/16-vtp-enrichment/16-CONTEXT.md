# Phase 16: VTP Enrichment as Cross-Phase Primitive — Context

**Gathered:** 2026-04-23
**Status:** SEED — ready for `/sgsd-discuss-phase 16`
**Scope note:** Lifts the deferred item from `.planning/milestones/v1.2/phases/13-governance/13-CONTEXT.md §deferred:237` ("VTP integration for intra-phase research briefs — not just milestone-close. Could ingest VTP context at phase discuss-time too.") into first-class v1.3 work. Extends the Phase-13 `sgsd-complete-milestone` precedent (milestone-close VTP integration) into every SGSD planning/research surface.

<domain>
## Phase Boundary

First phase of v1.3. Makes VTP evidence a first-class input to every planning, research, and triage surface in SGSD — so the system stops issuing ungrounded suggestions and starts answering against routed evidence by default.

**Operator directive (2026-04-23):**
> "I want triage to pick the right VTP MCP when it hooks a problem, or idea, or something could do with enriching. Each time I ask a question I want the VTP retrieval layer to do its job and enrich the question to make sure we get looking in the right places. If we are going to enrich things, then the GSD planning phase needs to call on that VTP enrichment as part of the planning / research phase."

Scope spans four tiers:

1. **Triage tier** — `sgsd-triage` Step 0 fires a VTP enrichment pass before brainstorm/plan/classify.
2. **Discuss/spec tier** — `sgsd-write-plan` + any discuss-phase wrapper consumes evidence before question-formulation.
3. **Research tier** — `gsd-phase-researcher`, `gsd-project-researcher`, `gsd-pattern-mapper`, `gsd-assumptions-analyzer` use substrate/research/wiki tools to ground their artifacts.
4. **Plan tier** — `gsd-planner` + `gsd-plan-checker` use `vtp_route_and_retrieve` for architecture grounding of PLAN.md.

The routing primitive is Phase-32's `vtp_route_and_retrieve`; the mode-selector routes to `vtp_search_research`, `vtp_advise_service_enrichment`, `wiki_search`, or `vtp_search_substrate` when the task shape warrants it.

**Not in scope:**
- No new VTP-side tools (we consume what VTP exposes today).
- No auto-fire of `vtp_update_routing_weights` during user-facing flow — "deliberate, batched" per VTP operator guide.
- No broad persistent-memory substrate (explicitly `avoid` per the service-enrichment advisor test payload).
- No full autonomous planner layer (same — `avoid`).
- No retroactive re-running of VTP enrichment against v1.0/v1.1/v1.2 artifacts.
- No VTP-side schema changes.
- No new agents — this phase patches existing skills and agents.
</domain>

<canonical_refs>
## Canonical References

### VTP source-of-truth reports (read-only; these are the contract)
- `C:\Users\jack.berrow\Voice-Text-Plan\reports\sgsd-triage-vtp-routing-handoff.md` — architecture overview, 5-tier data model, SGSD integration guidance.
- `C:\Users\jack.berrow\Voice-Text-Plan\reports\sgsd-triage-vtp-operator-guide.md` — operating rules, decision logic, context-object shape, anti-patterns.
- `C:\Users\jack.berrow\Voice-Text-Plan\reports\sgsd-triage-vtp-mcp-payloads.md` — exact MCP payload examples + response fields for every tool.
- `C:\Users\jack.berrow\Voice-Text-Plan\src\mcp\tools\service-enrichment.ts` — `vtp_advise_service_enrichment` tool definition + output schema.
- `C:\Users\jack.berrow\Voice-Text-Plan\src\service-enrichment\advisor.ts` — scoring logic, AREA_PROFILES, bloat-risk adjustment.
- `C:\Users\jack.berrow\Voice-Text-Plan\scripts\test-mcp-service-enrichment-tool.ts` — canonical test payload using SGSD-triage as the subject service.

### Existing SGSD VTP-integration precedent
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — proven pattern: VTP tools declared in `allowed-tools:` frontmatter (`mcp__vtp-kb__vtp_search`, `vtp_list_research`, `vtp_ingest_research`). Phase 16 extends this pattern across many more surfaces.
- `.planning/milestones/v1.2/phases/13-governance/13-CONTEXT.md §deferred:237` — the deferred item this phase lifts.

### Super-GSD skills — patch surfaces
- `super-gsd/skills/sgsd-triage/SKILL.md` — add Step 0 VTP-enrichment router before existing Step 1 (brainstorming).
- `super-gsd/skills/sgsd-write-plan/SKILL.md` — pull VTP evidence before plan drafting.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — dispatched-agent prompts should include VTP evidence (if phase-level enrichment is cached).
- `super-gsd/skills/sgsd-deliberate/SKILL.md` — optional: briefs consume VTP evidence when drafting Key Questions.
- `super-gsd/skills/sgsd-sepl/SKILL.md` — Wave C candidate: use `vtp_advise_service_enrichment` as a proposal-grounding source.

### Core GSD agents — patch surfaces
- `custom-gsd-extract/claude-agents/gsd-planner.md` — add `vtp_route_and_retrieve` + `vtp_search_substrate` for architecture grounding.
- `custom-gsd-extract/claude-agents/gsd-phase-researcher.md` — add `vtp_search_research` + `vtp_get_research` + gated `vtp_research_gate`.
- `custom-gsd-extract/claude-agents/gsd-project-researcher.md` — broader VTP pull for milestone-scope research.
- `custom-gsd-extract/claude-agents/gsd-pattern-mapper.md` — `vtp_search_substrate` with filters for pattern lookups.
- `custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md` — `wiki_find_contradictions` for assumption-stressing.
- `custom-gsd-extract/claude-agents/gsd-plan-checker.md` — VTP evidence cross-check on plan claims.
- `custom-gsd-extract/claude-agents/gsd-codebase-mapper.md` — VTP architecture evidence cross-check (optional; lower priority).

### VTP MCP tools consumed (read-only from VTP side)
- `mcp__vtp-kb__vtp_route_and_retrieve` — DEFAULT entry point for triage + plan tier.
- `mcp__vtp-kb__vtp_search_research` — research tier primary.
- `mcp__vtp-kb__vtp_get_research` — research follow-up.
- `mcp__vtp-kb__vtp_research_gate` — research synthesis (gated — costly; research-only questions).
- `mcp__vtp-kb__vtp_search_substrate` — pattern tier + clear-shape retrieval.
- `mcp__vtp-kb__vtp_get_evidence_bundle` — plan/research tier follow-up.
- `mcp__vtp-kb__vtp_get_document` — canonical fetch.
- `mcp__vtp-kb__wiki_search` + `mcp__vtp-kb__wiki_get_*` — narrative-page lookups.
- `mcp__vtp-kb__wiki_find_contradictions` — assumption-analyzer primary.
- `mcp__vtp-kb__vtp_advise_service_enrichment` — **NEW; pending VTP-rebuild restart to appear in session tool surface.** Wave C.
- `mcp__vtp-kb__vtp_reflect_on_results` — quality logging.

### New artifact surfaces (created by this phase)
- `.planning/metrics/vtp-routing-log.jsonl` — per-call outcome log: `{ts, tier, skill_or_agent, raw_query, selected_query, retrieval_mode, reflection_verdict, evidence_hit_count, top_doc_id}`.
- `super-gsd/scripts/lib/vtp-context-composer.cjs` — shared helper that assembles the bounded `context` object VTP expects (from STATE.md, git HEAD, recent turns/commands/errors, explicit constraints). Called by triage Step 0 and by any agent pattern that pulls VTP directly.
- `.planning/phases/{N}/VTP-EVIDENCE.md` (conditional; see Open Question #1) — phase-scoped evidence cache if the discussion decides to serialize triage's enrichment pass.
</canonical_refs>

<plan-seed>
## Plan Seed (from 2026-04-23 operator conversation)

**Core architectural commit:** every non-trivial SGSD planning/research surface runs a Phase-32 VTP enrichment pass before it acts. The raw operator query (or agent-internal task description) is framed by `vtp_route_and_retrieve` (or a mode-appropriate alternate), evidence is extracted, reflection is logged, and the downstream step (brainstorm / adaptive questioning / research drafting / plan drafting) consumes the framed output.

### The 5-mode VTP router (applies at triage tier and any agent wrapper)

| Task shape | VTP tool | Rationale |
|---|---|---|
| Default planning/evidence question | `vtp_route_and_retrieve` | Phase-32 routing is designed for this exact case |
| "How should we evolve X?" / service-improvement | `vtp_advise_service_enrichment` | Conservative, bloat-flagging, evidence-grounded (Wave C) |
| Research-grounded ("what do papers say") | `vtp_search_research` → `vtp_get_research` | Research-only questions |
| Narrative page request | `wiki_search` → `wiki_get_*` | Institutional-memory surfaces |
| Clear filterable lookup | `vtp_search_substrate` directly | Skip routing overhead when shape is known |

Context-object composition: VTP operator guide §"How To Fill The `context` Object" defines the contract. `vtp-context-composer.cjs` implements it.

### Proposed requirements (VTP-NN — subject to `/sgsd-discuss-phase` revision)

- **VTP-01** — `sgsd-triage` fires VTP enrichment as Step 0 on auto-invocation (Path D trivial-inline exempt). Composer builds the context object; response parsed into `retrieval_plan.selected_query` + evidence + reflection; feeds Step 1 brainstorming.
- **VTP-02** — `gsd-phase-researcher` agent uses `vtp_search_research` + `vtp_get_research` (+ gated `vtp_research_gate`) when producing RESEARCH.md; evidence cited in-line with VTP doc IDs / paper slugs / principle IDs.
- **VTP-03** — `gsd-planner` agent uses `vtp_route_and_retrieve` (architecture mode) when drafting PLAN.md for non-trivial plans; evidence cited in-line.
- **VTP-04** — Shared `super-gsd/scripts/lib/vtp-context-composer.cjs` helper exists and is consumed by triage + write-plan. Pure function: `compose(sgsd_state) → context_object`.
- **VTP-05** — Every VTP call logs a row to `.planning/metrics/vtp-routing-log.jsonl`. No per-call operator prompting.
- **VTP-06** — `gsd-pattern-mapper` agent uses `vtp_search_substrate` with `source_types` + `topics` filters when producing PATTERNS.md.
- **VTP-07** — `gsd-assumptions-analyzer` agent uses `wiki_find_contradictions` for assumption-stressing.
- **VTP-08** — `vtp_advise_service_enrichment` callable in-session (blocked on VTP-build restart confirmation); if green, wire into `/sgsd-sepl` as proposal-grounding source OR into `/sgsd-complete-milestone` as retrospective pass. Single integration target per discuss-phase resolution.

### Proposed waves (for `/gsd-plan-phase 16` to shape)

- **Wave A (MVP — establishes primitive)** — VTP-04 (composer helper) + VTP-01 (triage Step 0) + VTP-05 (routing-log jsonl). Proves the pattern; one surface fully wired.
- **Wave B (stack consumption)** — VTP-02 (phase-researcher) + VTP-03 (planner) + VTP-06 (pattern-mapper) + VTP-07 (assumptions-analyzer). Four agent patches using the composer from Wave A.
- **Wave C (service-enrichment integration — blocked)** — VTP-08. Requires operator restart of Claude Code so the new VTP build's tool surface includes `vtp_advise_service_enrichment`. Cannot start until that's confirmed.
</plan-seed>

<open_questions>
## Open Questions for `/sgsd-discuss-phase 16`

1. **Evidence caching vs re-query.** Does triage's VTP enrichment get serialized to `.planning/phases/{N}/VTP-EVIDENCE.md` so later agents don't re-query, or does each agent run its own narrower VTP call? Tradeoff: shared artifact reduces redundant calls but can go stale mid-phase; per-agent calls always fresh but cost more local-stdio round-trips.

2. **Context-composer scope.** Does the helper compose ONE context object shared across all tiers, or does each tier get a narrow tier-specific context? Example: researcher tier probably doesn't need `recent_errors`; plan tier probably doesn't need `recent_turns`. Leaning: one composer, tier-specific projection helpers.

3. **`vtp_advise_service_enrichment` placement.** Once in-session, where does it plug in — new `/sgsd-vtp-advise` skill? Mode inside `/sgsd-sepl` (proposal-grounding)? Mandatory checkpoint in `/sgsd-complete-milestone` (retrospective)? Multiple? Picking more than one risks scope creep.

4. **Reflection log → adaptive updates.** `vtp_update_routing_weights` is "bounded, intentional, not per-request." When and how does SGSD trigger it? (A) manual operator skill `/sgsd-vtp-tune`; (B) auto-fire at milestone close once the routing-log has ≥N rows; (C) never automate — document that operator runs it by hand using the reflection-log as evidence.

5. **Core GSD agents vs super-gsd overrides.** Do we patch `custom-gsd-extract/claude-agents/gsd-*.md` directly (the way Phase 13 patched `super-gsd/agents/sgsd-board-*.md`)? Or create `super-gsd/agents/sgsd-*.md` wrappers that override the core agents? Precedent suggests super-gsd wrappers for SGSD-native agents, but core-GSD agents are a different surface. First time this override pattern gets tested.

6. **Triage Step 0 kill-switch.** Should there be an explicit opt-out for fast/trivial questions (e.g., `/sgsd-triage --no-vtp`), or does Path D (<5 min inline; no-skill-chain) cover the need? VTP call is local stdio — likely <2s — but non-zero.

7. **Phase 14/15 dependency ordering.** Codex CLI phases (14/15) draft reviewer contexts. Does Phase 16 block 14/15 (so Codex reviewers have VTP-grounded context from day one)? Run in parallel (two independent tracks)? Run after (retrofit Codex later)? Operator framing suggests 16 ahead of 14/15; needs confirmation.

8. **Latency + cost budget.** `vtp_route_and_retrieve` runs the full 12-step Phase-32 chain (project intent → frame → matrix → expand → plan → retrieve → reflect). Local stdio but not free. What's the acceptable triage-invocation latency? Is there a fast-path short-circuit for evidence-rich sessions where STATE.md already has strong context?

9. **Installed-skill overlay drift.** The installed `sgsd-triage` SKILL.md at `C:/Users/jack.berrow/.claude/commands/sgsd-triage/SKILL.md` already differs from the source at `super-gsd/skills/sgsd-triage/SKILL.md` (diff detected 2026-04-23). Does Phase 16 take the live installed version as the patch baseline, or re-sync via `/sgsd-overlay-refresh` first and patch the clean source? Safer to resync first.
</open_questions>

<prior_art>
## Prior Art

- **Phase 13 / `sgsd-complete-milestone`** — established the `allowed-tools: mcp__vtp-kb__*` frontmatter pattern + tiered VTP fallback. Phase 16 extends this pattern to many more surfaces using the same declaration shape.
- **Phase 13 §deferred:237** — "VTP integration for intra-phase research briefs — not just milestone-close. Could ingest VTP context at phase discuss-time too. Deferred; measure utility of milestone-close first." Phase 16 lifts this.
- **VTP Phase 31 (substrate)** — landed MCP-native substrate tools + resources this phase consumes.
- **VTP Phase 32 (intent routing)** — landed the routing-and-retrieval orchestrator this phase treats as primary entry point.
- **VTP `vtp_advise_service_enrichment`** — designed with SGSD-triage as the canonical example (see test-harness payload). Phase 16 is partly VTP dogfooding.
</prior_art>

<readiness>
## Readiness Check

- ✅ VTP source-of-truth reports read and pinned (operator-guide, routing-handoff, payloads).
- ✅ VTP MCP server wired in this repo's `.mcp.json` (`vtp-kb` stdio, `node dist/cli.js mcp`).
- ✅ Existing VTP-integration pattern proven in `sgsd-complete-milestone` (frontmatter + stdio calls).
- ✅ v1.3 phase-numbering: Phase 16 confirmed by operator 2026-04-23.
- ⚠️ **VTP rebuilt 2026-04-23** (per operator), but `vtp_advise_service_enrichment` does NOT appear in the currently-loaded MCP tool list for this Claude Code session. Wave C blocker. Pre-execution prereq: operator restarts Claude Code so the new VTP build's tool surface is visible.
- ⚠️ Installed `sgsd-triage` SKILL.md diverges from source — see Open Question #9.
- ⚠️ v1.3 milestone directory didn't exist before this phase was seeded; Phase 14/15 still have no CONTEXT.md. Roadmap staging list needs Phase 16 entry added.
</readiness>

<next_steps>
## Next Steps

1. **Operator:** restart Claude Code (or confirm the running vtp-kb MCP is the rebuilt one) so `vtp_advise_service_enrichment` appears in the tool surface. Unblocks Wave C.
2. **Operator / orchestrator:** decide Phase 16 vs 14/15 ordering (Open Question #7). Leaning Phase 16 first.
3. **Run `/sgsd-discuss-phase 16`** — resolve Open Questions 1-9 into D-NN decisions.
4. **Run `/gsd-plan-phase 16`** — generates Wave A + B plans per the seed (Wave C drafted but held).
5. **Run `/sgsd-orchestrate go`** — execute.
</next_steps>
