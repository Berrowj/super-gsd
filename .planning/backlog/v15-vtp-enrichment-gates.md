# v1.5 seed — VTP enrichment gates for research + audit workflows

**Captured:** 2026-04-24 (post-v1.4 milestone close)
**Source:** operator directive during v1.5 scoping conversation
**Status:** backlog — awaiting proper v1.5 scoping session to split into REQ-IDs + phases

## Intent

Operator has invested heavily in curating the VTP knowledge library (books, academic papers, prior research). Today the orchestrator reads VTP only during dispatch (per `feedback_vtp_enriched_dispatch` memory + Phase 16 VTP substrate), but there is no **gate-level** enforcement that forces library consultation at decision-making points.

v1.5 should wire VTP MCP as a first-class enrichment gate at two surface points:

### Surface A — Research → Planning boundary

New gate `sgsd-vtp-enrichment` fires after `gsd-phase-researcher` produces `RESEARCH.md`, before `gsd-planner` dispatches.

**Inputs:** RESEARCH.md + CONTEXT.md + phase REQ-IDs
**VTP queries:**
- `vtp_search` — keyword + semantic across books/papers
- `vtp_search_substrate` — content-layer search (the books themselves, not wiki/entities)
- `vtp_search_research` — prior research in VTP library
- `vtp_route_and_retrieve` — end-to-end routing for domain queries
- `vtp_advise_service_enrichment` — conservative proposal-grounding
**Output:** `{NN}-VTP-ENRICHMENT.md` with
- Relevant library hits + citations
- Gaps/contradictions the library surfaces
- Alternative framings the library proposes
- Explicit "planner MUST consume" directive

### Surface B — Audit workflows

All audit surfaces gain a "Library Cross-Reference" section:
- `sgsd-audit` — evidence-gated audit
- `sgsd-muda-audit` — waste probe findings cross-ref to antipatterns corpus
- `gsd-audit-milestone` — milestone-complete audit vs industry-precedent patterns
- `sgsd-complete-milestone` — close-out audit with library-backed "industry-standard gaps we didn't think of"

**Output structure per finding:** Finding + Library citations + Counterpoint (if library disagrees) + Confidence.

## Design questions (UNRESOLVED — lock during v1.5 scoping session)

1. **Enrichment vs challenger mode** — does the gate just ADD context, or CHALLENGE Claude's default plan with library-backed alternatives? Challenger mode higher-value but risks paralysis if library is rich.
2. **Hard-required vs advisory** — no library hits → gate PASS silently (pragmatic) or force "library unenriched for this topic" acknowledgment (discipline)?
3. **Audit query granularity** — per-finding (rich, ~5-10 queries) vs end-of-audit-once (cheap, batched). Tier-based compromise: CRITICAL → deep per-finding, WARN → batched, PASS → no VTP call.

## Token budget sketch

Per research-phase enrichment gate: ~60s wall-clock, ~2,000 tokens (5 VTP queries + synthesis). Across a 4-phase milestone: +~8k tokens for research enrichment.

Per audit cross-reference: variable by findings count. Estimate ~15-25k tokens per milestone for full audit VTP coverage. Offset by Codex offload savings (v1.4 saved ~32k Claude tokens via cross-vendor review).

Net: VTP enrichment is cheap compared to the existing Codex dogfood. Cost is well within v1.4's proven envelope.

## Dependencies

- **Phase 16 VTP substrate** (v1.3 shipped) — already operational; this builds on it
- `feedback_vtp_enriched_dispatch` memory — existing expectation of VTP-consuming dispatch; this formalizes as gate
- `sgsd-vtp-advise` skill — standalone VTP advisor; pattern precedent for this gate
- `mcp__vtp-kb__*` tools — all already available per session tool list

## Success criteria (proposed, refine during scoping)

- Every `gsd-phase-researcher` dispatch is followed by a `sgsd-vtp-enrichment` gate dispatch
- Every phase's artifact set includes `{NN}-VTP-ENRICHMENT.md`
- Every `gsd-planner` dispatch explicitly injects VTP-ENRICHMENT.md alongside RESEARCH.md
- Every audit artifact has a "Library Cross-Reference" section (empty is OK; silent absence is not)
- Operator can grep `grep -r "VTP citation" .planning/milestones/v1.5/` and find library references on every phase's decisions

## Relationship to Phase 21 seeds already captured

v1.4 SUMMARY.md already lists Phase 21 candidates (security hardening, MUDA calibration, richer-output contract, etc.). **VTP enrichment gates are v1.5 scope, NOT Phase 21.** Likely organized as a dedicated "VTP-ENRICH" category in v1.5 REQUIREMENTS.md.

## Next step

Proper v1.5 scoping session should:
1. Lock the 3 design questions above
2. Split this into discrete REQ-IDs (e.g. VTPE-01 research-boundary gate, VTPE-02 audit cross-ref, VTPE-03 challenger mode, VTPE-04 granularity policy)
3. Assign REQ-IDs to phases in v1.5 ROADMAP
4. Sequence against the other v1.5 candidates
