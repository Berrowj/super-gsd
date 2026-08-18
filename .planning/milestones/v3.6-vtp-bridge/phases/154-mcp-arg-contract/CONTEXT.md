---
phase: "154"
slug: mcp-arg-contract
milestone: v3.6-vtp-bridge
status: PENDING
depends_on: []
split_from: "153"
split_reason: "Codex plan review 2026-08-18 flagged this as MUDA overproduction bundled into P153 — it is an MCP-contract defect, not hook transport."
---

# P154 Context — Triage Runtime MCP Arg Contract

## Goal
`super-gsd/scripts/sgsd-triage-runtime.cjs` emits MCP call args that the target
MCP tools reject, so the staged "runtime decides, Claude transports" protocol
built in P148 cannot be executed verbatim as its own skill specifies. Every
`/sgsd-triage` run therefore degrades silently.

## Verified evidence (reproduced 2026-08-18 while running /sgsd-triage)

1. **`vtp_route_and_retrieve`** — the runtime emits `context.recent_turns` as an
   array of bare strings. The tool schema requires an array of objects each
   carrying a `text` string. Executing the emitted call verbatim returns a hard
   `MCP error -32602: Input validation error ... expected object, received string`.
2. **`vtp_search_substrate`** — the runtime emits `raw_query`, `context` and
   `fallback_reason`. That tool's schema accepts only `query` plus optional typed
   filters (`limit`, `source_types`, `entity_types`, `project_ids`,
   `speaker_ids`, `topics`, `meeting_ids`).

Consequence: the skill instructs "execute the emitted MCP call VERBATIM ... No
interpretation", but verbatim execution fails. The operator-facing effect is that
triage silently falls back or degrades rather than enriching.

This is seam instance **#8** of `harness-production-seam-four-layers` — and it sits
inside the mechanism P148 built to fix seam bugs.

## Scope
Per-tool arg-shaper at the emission seam so every emitted call is schema-valid for
its target tool, plus a conformance test that validates emitted args against each
tool's authoritative schema.

Do NOT change routing logic, predicate evaluation, or which tool is selected. Only
the shape of the emitted args changes.

## Acceptance shape (for the planner)
- Validate against the **authoritative** tool schemas, not a hand-copied local
  duplicate that can drift. Codex plan review called this out explicitly against
  P153 rev 1.
- The conformance test MUST fail against the pre-fix runtime. A test that passes
  both before and after does not exercise the defect.
- Cover both the `vtp-plan` stage and the `vtp-consume` fallback stage.

## Boundary
- No change to route selection, predicates, or degradation policy.
- No new MCP tools wired.
- Does not depend on P153 and does not block it.

## Provenance
Split out of P153 at plan review (rev 1 NOGO, 2026-08-18). P153 rev 2 carries the
hook-transport work only.
