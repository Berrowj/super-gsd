# Phase 16: VTP Enrichment as Cross-Phase Primitive — Context

**Gathered:** 2026-04-23 (seed) · 2026-04-23 (discussion) · 2026-04-23 (research errata applied)
**Status:** Ready for planning

**Research errata (from 16-RESEARCH.md, applied inline below):**
- **E-01** — VTP-06 originally targeted `gsd-pattern-mapper.md`. That file does **not** exist in `custom-gsd-extract/claude-agents/` (it lives only at `C:\Users\user\.claude\agents\gsd-pattern-mapper.md` as a global). Per D-03 (patch vendored in-place, no new agents), VTP-06 is re-targeted to `gsd-codebase-mapper.md` (verified exists). The `gsd-pattern-mapper` agent type remains available for runtime dispatch (pattern-mapping step in /gsd-plan-phase still works); Phase 16 simply doesn't patch it.
- **E-02** — VTP context-object field is `current_task` (not `current_focus` as D-07 wrote). D-07's fast-path predicate updated inline.
- **E-03** — `vtp_route_and_retrieve` has **no native `elapsed_ms`** in its response. Composer must wrap every MCP call with `Date.now()` brackets and emit elapsed_ms itself. New composer-consumer contract: "no direct MCP calls — always via composer helpers." VTP-04 updated inline.
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
- No auto-fire of `vtp_update_routing_weights` during user-facing flow — operator-manual per D-08.
- No broad persistent-memory substrate (explicitly `avoid` per the service-enrichment advisor test payload).
- No full autonomous planner layer (same — `avoid`).
- No retroactive re-running of VTP enrichment against v1.0/v1.1/v1.2 artifacts.
- No VTP-side schema changes.
- No new agents — this phase patches existing skills and agents (per D-03).
</domain>

<decisions>
## Implementation Decisions

Derived from `/sgsd-discuss-phase 16` on 2026-04-23. Full audit trail in `16-DISCUSSION-LOG.md`.

### Scope & Sequencing

- **D-01:** Phase 16 runs **first** in v1.3, before Codex CLI Phases 14 and 15. Rationale: Codex reviewers in 14/15 inherit VTP-grounded context from day one, and Phase 15's qualitative MUDA probe measures overproduction signal against grounded reviewers, not vendor-diff noise against un-grounded ones. The ROADMAP staging order already reflects this (Phase 16 listed before 14/15).

### Patch Surface Strategy

- **D-02:** The installed `sgsd-triage` SKILL.md at `C:\Users\user\.claude\commands\sgsd-triage\SKILL.md` differs from source **at the line-ending level only** (CRLF vs LF). MD5 matches byte-for-byte after CRLF-normalization. The drift flag in the seed was a false positive. Patch the source `super-gsd/skills/sgsd-triage/SKILL.md` directly. No `/sgsd-overlay-refresh` required before this phase. Install-time CRLF conversion is expected harness behaviour.

- **D-03:** Patch all 7 core GSD agents in-place at `custom-gsd-extract/claude-agents/` (vendored local fork, not a submodule). No `sgsd-*` promotion in this phase. The enrichment is `allowed-tools:` frontmatter addition + one paragraph on WHEN to call VTP — that is tool-access, not new capability. The binding memory rule (`feedback_sgsd_rename_rule.md`) requires `sgsd-*` prefix only when we've enriched with a v2 handover contract or research-paper principles, which we are not. **Future trigger for promotion:** if a subsequent phase adds >50 lines of new reasoning, expertise-file scaffolding, or a changed output contract to `gsd-phase-researcher` or `gsd-planner`, promote then — recorded in `<deferred>`.

### Artifact Design

- **D-04:** Each phase gets a lightweight `VTP-EVIDENCE.md` that holds **framing only** — `selected_query`, `retrieval_mode`, `reflection` verdict, and top-3 evidence **doc-ID references** (not full document content). Each downstream agent re-queries VTP for its own tier-specific evidence at call time. This splits Phase 32's route-and-retrieve output along its natural seam: framing is shared across tiers, evidence is tier-specific. Keeps the audit artifact ≤300 lines and always-fresh-at-use.

- **D-05:** One shared `super-gsd/scripts/lib/vtp-context-composer.cjs` with two exposed functions:
  - `compose(sgsd_state) → full_context_object` — expensive reads (STATE.md, git log, error buffer) happen once.
  - `project(ctx, tier)` → tier-specific slice — zero-cost projections for `triage | research | plan | pattern | assumptions`.
  Tier projections live as declarative constants in the same file. This becomes the canonical documentation of "what SGSD sends to VTP."

### UX & Controls

- **D-06:** **No per-call `--no-vtp` kill-switch.** The `sgsd-triage` trigger section already excludes trivial questions (factual lookups, mid-build fixes, direct execution requests), so Step 0 never fires on Path-D-style queries. Ship one config toggle `workflow.triage_vtp_enrichment: true` (default `true`) at project scope, consumed by the composer, for system-wide disable when VTP is offline or under debugging. No operator-facing flag.

### Performance

- **D-07:** Performance budget: **3s P95** for a full `vtp_route_and_retrieve` call. Fast-path short-circuit in the composer: when `current_task` (per E-02 schema fix) resolves to a known active phase AND `explicit_constraints` is non-empty, bypass the 12-step Phase-32 chain and call `vtp_search_substrate` directly with phase-scoped filters. Every VTP call logs `elapsed_ms` into `.planning/metrics/vtp-routing-log.jsonl` — the composer wraps each MCP call with `Date.now()` brackets and emits elapsed_ms itself (per E-03; the VTP tools do not return it natively). Contract: "no direct MCP calls from skills or agents — always via composer helpers."

### Policy

- **D-08:** `vtp_update_routing_weights` is **operator-manual** — the reflection-log drives operator judgment, operator runs the update by hand when warranted. Phase 16 ships the reflection logging surface (VTP-05) but not automatic calibration. Auto-firing at milestone close introduces new failure modes and empirically we have zero routing-log rows yet — calibration belongs in a later phase once there's signal to calibrate against. Deferred to `<deferred>`.

### Wave C Deliverable

- **D-09:** `vtp_advise_service_enrichment` ships as **two** integration surfaces:
  - **VTP-08a** — standalone `/sgsd-vtp-advise` skill. Operator-invoked ad-hoc for conservative proposal-grounding ("should we evolve X?"). Default path.
  - **VTP-08b** — conditional integration into `/sgsd-sepl`. Auto-calls advise **only when a proposal is "major"** and appends grounding findings to the proposal file. Minor proposals skip advise to avoid noise.

  **"Major" is falsifiable** — proposal qualifies if it touches ANY of: orchestrator loop (sgsd-orchestrate, ORCHESTRATOR-CHECKPOINT), dispatch rules (CLAUDE-OVERLAY routing table), skill surface (new skill file, new slash command), agent surface (new agent file or agent frontmatter change), new hook, new config key under `workflow.*` or `preferences.*`, or cross-phase pattern (affects ≥2 phases). Detection is a file-pattern + frontmatter scan inside sepl, not a judgment call.

### Claude's Discretion

- Exact Node API of `vtp-context-composer.cjs` (function signatures, options object shape) — picked at plan time from the decisions above.
- Exact YAML/JSON shape of `.planning/metrics/vtp-routing-log.jsonl` rows — pattern matches existing `.planning/metrics/*.jsonl` conventions.
- Wording of VTP-call instructional paragraphs added to each agent frontmatter — pattern from `sgsd-complete-milestone` precedent.
- Exact "major" heuristic implementation in sepl (regex vs frontmatter flag vs hybrid) — plan-time.
- Specific VTP doc-ID citation format in RESEARCH.md / PLAN.md (bracket style, inline vs footnote) — planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### VTP source-of-truth reports (read-only; these are the contract)
- `C:\Users\user\Voice-Text-Plan\reports\sgsd-triage-vtp-routing-handoff.md` — architecture overview, 5-tier data model, SGSD integration guidance.
- `C:\Users\user\Voice-Text-Plan\reports\sgsd-triage-vtp-operator-guide.md` — operating rules, decision logic, context-object shape, anti-patterns.
- `C:\Users\user\Voice-Text-Plan\reports\sgsd-triage-vtp-mcp-payloads.md` — exact MCP payload examples + response fields for every tool.
- `C:\Users\user\Voice-Text-Plan\src\mcp\tools\service-enrichment.ts` — `vtp_advise_service_enrichment` tool definition + output schema.
- `C:\Users\user\Voice-Text-Plan\src\service-enrichment\advisor.ts` — scoring logic, AREA_PROFILES, bloat-risk adjustment.
- `C:\Users\user\Voice-Text-Plan\scripts\test-mcp-service-enrichment-tool.ts` — canonical test payload using SGSD-triage as the subject service.

### Existing SGSD VTP-integration precedent
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — proven pattern: VTP tools declared in `allowed-tools:` frontmatter (`mcp__vtp-kb__vtp_search`, `vtp_list_research`, `vtp_ingest_research`). Phase 16 extends this pattern across more surfaces.
- `.planning/milestones/v1.2/phases/13-governance/13-CONTEXT.md §deferred:237` — the deferred item this phase lifts.
- `C:\Users\user\.claude\projects\C--Users-user-GSDedits\memory\workflow\feedback\feedback_sgsd_rename_rule.md` — binding rule on when to use `sgsd-*` prefix (relevant to D-03).

### Super-GSD skills — patch surfaces (Wave A/C)
- `super-gsd/skills/sgsd-triage/SKILL.md` — add Step 0 VTP-enrichment call before existing Step 1 (brainstorming). Composer builds context; VTP response parsed into `selected_query` + reflection + top-3 doc-IDs; feeds brainstorming. (VTP-01)
- `super-gsd/skills/sgsd-write-plan/SKILL.md` — pull VTP evidence (or read VTP-EVIDENCE.md if written by triage) before plan drafting.
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` — dispatched-agent prompts include VTP-EVIDENCE.md contents (framing prelude) if present at phase level.
- `super-gsd/skills/sgsd-sepl/SKILL.md` — Wave C: major-proposal branch auto-calls advise. (VTP-08b)
- `super-gsd/skills/sgsd-vtp-advise/SKILL.md` — Wave C: **new skill file** for standalone advise invocation. (VTP-08a)

### Core GSD agents — patch surfaces (Wave B)
All patched in-place per D-03.
- `custom-gsd-extract/claude-agents/gsd-planner.md` — add `vtp_route_and_retrieve` + `vtp_search_substrate` for architecture grounding. (VTP-03)
- `custom-gsd-extract/claude-agents/gsd-phase-researcher.md` — add `vtp_search_research` + `vtp_get_research` + gated `vtp_research_gate`. (VTP-02)
- `custom-gsd-extract/claude-agents/gsd-project-researcher.md` — broader VTP pull for milestone-scope research.
- `custom-gsd-extract/claude-agents/gsd-codebase-mapper.md` — `vtp_search_substrate` with filters for pattern lookups (VTP-06, re-targeted per E-01).
- `custom-gsd-extract/claude-agents/gsd-assumptions-analyzer.md` — `wiki_find_contradictions` for assumption-stressing. (VTP-07)
- `custom-gsd-extract/claude-agents/gsd-plan-checker.md` — VTP evidence cross-check on plan claims.

### VTP MCP tools consumed (read-only from VTP side)
- `mcp__vtp-kb__vtp_route_and_retrieve` — DEFAULT entry point for triage + plan tier.
- `mcp__vtp-kb__vtp_search_research` — research tier primary.
- `mcp__vtp-kb__vtp_get_research` — research follow-up.
- `mcp__vtp-kb__vtp_research_gate` — research synthesis (gated — costly; research-only questions).
- `mcp__vtp-kb__vtp_search_substrate` — pattern tier + clear-shape retrieval + composer fast-path (D-07).
- `mcp__vtp-kb__vtp_get_evidence_bundle` — plan/research tier follow-up.
- `mcp__vtp-kb__vtp_get_document` — canonical fetch.
- `mcp__vtp-kb__wiki_search` + `mcp__vtp-kb__wiki_get_*` — narrative-page lookups.
- `mcp__vtp-kb__wiki_find_contradictions` — assumption-analyzer primary.
- `mcp__vtp-kb__vtp_advise_service_enrichment` — **LIVE in-session (verified via ToolSearch 2026-04-23).** Wave C unblocker resolved.
- `mcp__vtp-kb__vtp_reflect_on_results` — quality logging.

### New artifact surfaces (created by this phase)
- `.planning/metrics/vtp-routing-log.jsonl` — per-call outcome log: `{ts, tier, skill_or_agent, raw_query, selected_query, retrieval_mode, reflection_verdict, evidence_hit_count, top_doc_id, elapsed_ms}`. (VTP-05)
- `super-gsd/scripts/lib/vtp-context-composer.cjs` — shared composer with `compose()` + `project(ctx, tier)`. (VTP-04)
- `.planning/phases/{N}/VTP-EVIDENCE.md` — per-phase framing artifact (written by triage Step 0, read by downstream agents). Framing-only per D-04. (VTP-09)
- Config key `workflow.triage_vtp_enrichment` (boolean, default `true`) in project config. (VTP-10)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `super-gsd/skills/sgsd-complete-milestone/SKILL.md` — canonical `allowed-tools: mcp__vtp-kb__*` pattern. Reuse as template for every Phase 16 skill/agent patch.
- `.mcp.json` in project root — VTP-kb server already wired as `vtp-kb` stdio transport. No MCP-config changes needed.
- `.planning/metrics/*.jsonl` — existing append-log pattern (`activity-log.jsonl`, `muda-log.jsonl`, `plan-errors.jsonl`, `readiness-log.jsonl`). `vtp-routing-log.jsonl` follows the same shape.

### Established patterns
- **In-place patching of vendored core-GSD agents** — `custom-gsd-extract/` is a 2026-04-08 extract; patches live in-repo without upstream contention.
- **Slash-command skill file convention** — `super-gsd/skills/{name}/SKILL.md` with YAML frontmatter (`name`, `description`, `allowed-tools`). New skill `sgsd-vtp-advise` follows this.
- **Append-only JSONL telemetry** — routing log is write-forward, never mutated. Readers treat it as event stream.

### Integration points
- `sgsd-triage` Step 0 → composer → VTP call → write VTP-EVIDENCE.md + append routing log.
- `sgsd-orchestrate` dispatch loop → reads VTP-EVIDENCE.md from active phase dir → injects framing prelude into agent prompts.
- Each core-GSD agent → reads VTP-EVIDENCE.md IF present → makes own tier-specific VTP call for evidence → cites doc-IDs in its output artifact.
- `sgsd-sepl` proposal-writer → major-heuristic scan → conditional advise call → append findings to proposal file.
- `sgsd-vtp-advise` skill → composer → advise call → write report to `.planning/advise/{YYYY-MM-DD}-{slug}.md`.

</code_context>

<plan-seed>
## Plan Seed — Revised Against Discussion

**Core architectural commit:** every non-trivial SGSD planning/research surface runs a Phase-32 VTP enrichment pass before it acts. The raw operator query (or agent-internal task description) is framed by `vtp_route_and_retrieve` (or a mode-appropriate alternate per the router table below), framing persisted to `VTP-EVIDENCE.md`, evidence re-fetched per-tier at call time, reflection logged, and the downstream step (brainstorm / adaptive questioning / research drafting / plan drafting) consumes the framed output.

### The 5-mode VTP router (applies at triage tier and any agent wrapper)

| Task shape | VTP tool | Rationale |
|---|---|---|
| Default planning/evidence question | `vtp_route_and_retrieve` | Phase-32 routing is designed for this exact case |
| "How should we evolve X?" / service-improvement | `vtp_advise_service_enrichment` | Conservative, bloat-flagging, evidence-grounded (Wave C) |
| Research-grounded ("what do papers say") | `vtp_search_research` → `vtp_get_research` | Research-only questions |
| Narrative page request | `wiki_search` → `wiki_get_*` | Institutional-memory surfaces |
| Clear filterable lookup | `vtp_search_substrate` directly | Skip routing overhead when shape is known (fast-path per D-07) |

### Revised requirements (VTP-NN)

- **VTP-01** — `sgsd-triage` fires VTP enrichment as Step 0 on auto-invocation. Composer builds the context object (per D-05); response parsed into `selected_query` + reflection + top-3 doc-IDs; feeds Step 1 brainstorming. Trigger exclusions already cover Path D (per D-06).
- **VTP-02** — `gsd-phase-researcher` uses `vtp_search_research` + `vtp_get_research` (+ gated `vtp_research_gate`) when producing RESEARCH.md; evidence cited in-line with VTP doc IDs / paper slugs / principle IDs.
- **VTP-03** — `gsd-planner` uses `vtp_route_and_retrieve` (architecture mode) when drafting PLAN.md for non-trivial plans; evidence cited in-line.
- **VTP-04** — Shared `super-gsd/scripts/lib/vtp-context-composer.cjs` helper with `compose()` + tier-specific `project()` projections (per D-05). Pure function: `compose(sgsd_state) → full_context_object`; `project(ctx, tier) → tier_slice`. Fast-path short-circuit to `vtp_search_substrate` when fast-path predicate holds (per D-07). **MCP-call wrapper (per E-03):** composer exposes a `callVtp(tool, args)` helper that brackets every MCP invocation with `Date.now()` and returns `{response, elapsed_ms}`. Skills and agents call VTP through this wrapper — never directly. Enforced by the contract "no direct `mcp__vtp-kb__*` calls in VTP-enriched surfaces; always via composer helpers."
- **VTP-05** — Every VTP call logs a row to `.planning/metrics/vtp-routing-log.jsonl`, including `elapsed_ms` (per D-07). No per-call operator prompting.
- **VTP-06** — `gsd-codebase-mapper` uses `vtp_search_substrate` with `source_types` + `topics` filters (re-targeted from `gsd-pattern-mapper` per E-01 — the latter is not in the vendored extract). The runtime `gsd-pattern-mapper` subagent still fires in /gsd-plan-phase; Phase 16 just doesn't patch it.
- **VTP-07** — `gsd-assumptions-analyzer` uses `wiki_find_contradictions` for assumption-stressing.
- **VTP-08a** — Standalone `/sgsd-vtp-advise` skill at `super-gsd/skills/sgsd-vtp-advise/SKILL.md`. Operator-invoked. Calls `vtp_advise_service_enrichment` with composer-built context, writes report to `.planning/advise/{YYYY-MM-DD}-{slug}.md`. (Wave C)
- **VTP-08b** — `/sgsd-sepl` detects "major" proposals via file-pattern + frontmatter scan and auto-calls advise, appending findings to the proposal file. Minor proposals skip advise. Heuristic defined in D-09. (Wave C)
- **VTP-09** — Per-phase `.planning/phases/{N}/VTP-EVIDENCE.md` holds framing only (per D-04). Written by triage Step 0, read by downstream agents as a prelude. ≤300 lines target.
- **VTP-10** — Config key `workflow.triage_vtp_enrichment: boolean` (default `true`). Consumed by composer as a circuit-breaker for the triage Step 0 call (per D-06).

### Revised waves

- **Wave A (MVP — establishes primitive)** — VTP-04 (composer + projections), VTP-01 (triage Step 0), VTP-05 (routing log), VTP-09 (framing artifact), VTP-10 (config toggle). Proves the pattern; one surface fully wired.
- **Wave B (stack consumption)** — VTP-02 (phase-researcher), VTP-03 (planner), VTP-06 (pattern-mapper), VTP-07 (assumptions-analyzer). Four agent patches using the Wave A composer.
- **Wave C (service-enrichment integration — unblocked 2026-04-23)** — VTP-08a (standalone advise skill), VTP-08b (conditional sepl integration). Tool is live in the current session's MCP surface.

</plan-seed>

<specifics>
## Specific Ideas From Discussion

### Operator verbatim (D-06 anchor)
> "Each time I ask a question I want the VTP retrieval layer to do its job and enrich the question to make sure we get looking in the right places."

This is why the kill-switch is structural (trigger exclusion + config toggle), not ergonomic (per-call flag). Operator intent is *always-on for non-trivial*.

### Wave C operator framing (D-09 anchor)
> "Let's do A and if there is a major proposal let's do B too but only if it's major."

This is why VTP-08b is conditional, not always-on — and why "major" needed to be made falsifiable (file-pattern + frontmatter scan, not judgment).

### Evidence-first check fired mid-discussion (D-02 anchor)
Seed's Open Question #9 flagged installed-skill drift as "safer to resync first." An evidence check (`diff` + MD5 with CRLF stripped) showed byte-identical content — no drift. This is the Karpathy / sgsd-audit discipline: don't chase detector false positives, verify before deciding.

</specifics>

<prior_art>
## Prior Art

- **Phase 13 / `sgsd-complete-milestone`** — established the `allowed-tools: mcp__vtp-kb__*` frontmatter pattern + tiered VTP fallback. Phase 16 extends this pattern to many more surfaces using the same declaration shape.
- **Phase 13 §deferred:237** — "VTP integration for intra-phase research briefs — not just milestone-close. Could ingest VTP context at phase discuss-time too. Deferred; measure utility of milestone-close first." Phase 16 lifts this.
- **VTP Phase 31 (substrate)** — landed MCP-native substrate tools + resources this phase consumes.
- **VTP Phase 32 (intent routing)** — landed the routing-and-retrieval orchestrator this phase treats as primary entry point.
- **VTP `vtp_advise_service_enrichment`** — designed with SGSD-triage as the canonical example (see test-harness payload). Phase 16 is partly VTP dogfooding.
- **Memory rule `feedback_sgsd_rename_rule.md`** — binding constraint on D-03. Blanket renaming prohibited; promotion requires genuine enrichment.

</prior_art>

<readiness>
## Readiness Check

- ✅ VTP source-of-truth reports read and pinned (operator-guide, routing-handoff, payloads).
- ✅ VTP MCP server wired in this repo's `.mcp.json` (`vtp-kb` stdio, `node dist/cli.js mcp`).
- ✅ Existing VTP-integration pattern proven in `sgsd-complete-milestone` (frontmatter + stdio calls).
- ✅ v1.3 phase-numbering: Phase 16 confirmed by operator 2026-04-23.
- ✅ **Wave C unblocker resolved** — `mcp__vtp-kb__vtp_advise_service_enrichment` verified LIVE in current session's MCP tool surface via ToolSearch 2026-04-23. No operator restart needed.
- ✅ **Q9 drift false positive cleared** — installed/source `sgsd-triage` SKILL.md is byte-identical after CRLF-normalization. Patch source directly.
- ✅ ROADMAP.md staging entry landed (commit `0191168`). CONTEXT.md seed landed (commit `e74a763`). This revision follows.

### Open items going into planning
- `gsd-plan-phase 16` must verify MCP tool surface at plan-time and confirm each VTP tool in the router table returns schemas as expected.
- Plan should surface the exact "major" heuristic implementation approach (regex vs frontmatter flag vs hybrid) — D-09 specifies the detection criteria but not the parser.

</readiness>

<deferred>
## Deferred Ideas

- **Automatic routing-weights calibration.** `vtp_update_routing_weights` auto-fire at milestone close once routing-log has ≥N rows. Deferred per D-08 — Phase 16 ships the logging surface only. Revisit after one full milestone of VTP routing data exists.
- **`sgsd-*` promotion of `gsd-phase-researcher` / `gsd-planner`.** Trigger: when a future phase adds >50 lines of new reasoning, expertise-file scaffolding, or a changed output contract. Per D-03.
- **Retroactive VTP enrichment of v1.0/v1.1/v1.2 artifacts.** Out of scope — this phase is forward-looking.
- **Drift detector CRLF-normalization fix.** The detector that flagged Q9's false positive should strip CRLF before comparing. Small tooling improvement; not blocking.
- **`gsd-plan-checker` VTP evidence cross-check.** Listed in canonical_refs as a Wave B patch surface with no VTP-NN requirement assigned. Planner declined to include in Phase 16 to keep Wave B atomic at 4 agents. Trigger to revisit: if plan-checker begins citing VTP doc-IDs materially during `/gsd-plan-phase` verification loops, promote to a VTP-NN requirement in 16.1. Note: `gsd-codebase-mapper` was originally listed here too, but was promoted to VTP-06 via E-01 research erratum and is no longer deferred.
- **`gsd-project-researcher` VTP broad-pull patch.** Listed in canonical_refs as a Wave B patch surface with no VTP-NN requirement assigned (same pattern as VTP-02 for phase-researcher, but at milestone scope). Plan-checker review flagged as silent omission. Deferred rather than added mid-review to avoid expanding Wave B atomic scope. Trigger to revisit: when the next `/gsd-new-milestone` requires substantial upstream research, promote to a VTP-NN requirement. Patch is mechanically identical to VTP-02 (tools: append + WHEN paragraph).
- **Full autonomous planner layer.** Per VTP test-harness `avoid` list — explicitly not in scope.
- **Broad persistent-memory substrate.** Per VTP test-harness `avoid` list — explicitly not in scope.

</deferred>

<next_steps>
## Next Steps

1. `/gsd-plan-phase 16` — generates Wave A + B + C plans per the revised VTP-NN requirements and 3-wave decomposition. Plan-phase should confirm MCP tool availability and settle Claude-discretion items.
2. `/sgsd-orchestrate go` — executes.

</next_steps>

---

*Phase: 16-vtp-enrichment*
*Seed landed: 2026-04-23*
*Discussion resolved: 2026-04-23*
