---
name: sgsd-triage-first
description: Call vtp_triage (advisory) before every research/planning/blocker dispatch that formulates a KB question; follow or override the compiled route and ALWAYS record the decision via vtp_triage_feedback + a route-decisions row. Phase 0 demand instrumentation for the cross-pollination engine — SGSD's query volume IS the organic demand evidence.
---

# sgsd-triage-first — advisory triage before KB-facing dispatches

## When this fires
Before ANY orchestrator step that formulates a question against the VTP KB:
research dispatches (Step 6.b), planning enrichment (Step 6.b.5), and blocker-recovery
briefs. This EXTENDS the existing enrichment gate's question formulation — it is NOT a
parallel gate and never blocks the loop (advisory-only; classifier-only authority).

## Protocol
1. Compose the question you were about to run against the KB.
2. Call `mcp__vtp-kb__vtp_triage` with `{ question, context: <one-line phase/task context> }`.
   The reply is a compiled ADVISORY route: archetype, tool plan, BLOCKING_AMBIGUITY first,
   `execution.performed=false`, zero writes.
3. Decide: FOLLOW the route (use its tool plan for the retrieval) or OVERRIDE it (run your
   own plan). Any BLOCKING_AMBIGUITY listed should be resolved or consciously waived.
4. ALWAYS record the decision — this is the entire point (demand evidence):
   - `mcp__vtp-kb__vtp_triage_feedback` with `{ triage_id, decision: accepted|modified|rejected,
     override_reason_code (REQUIRED for modified/rejected), reason_detail (REQUIRED for OTHER) }`.
   - One route-decisions row via `super-gsd/scripts/lib/route-ledger.cjs::logRouteDecision(
     planningDir, { boundary: 'vtp_triage_advisory', status: 'ok', phase, milestone,
     reason_codes: [<decision>], decision: { triage_id, archetype, followed: <bool> } })`.
5. If the vtp-kb MCP is unavailable in the current tool scope: skip silently but log the
   route-decisions row with status 'skipped' and reason_codes ['mcp_unavailable'] — degraded
   visibility, never a stall (matches the enrichment gate's D-08 degraded mode).

## Hard constraints
- Advisory only. The caller decides; never treat the route as binding.
- Never skip the feedback call after a triage call — an unrecorded decision is wasted demand
  evidence (the contrarian falsifier needs 20+ recorded inadequate-path queries).
- Do not add a second triage call per dispatch; one question → one triage → one feedback.

## Why (board-recorded)
The cross-pollination Phase 0 gate requires ORGANIC demand evidence. SGSD's dozens of daily
dispatch questions are that stream: the loop gets better-routed retrieval, VTP gets real
accept/modify/reject decisions with reason codes accumulating in the advisory feedback ledger
(.planning/metrics/triage-advisory/).
