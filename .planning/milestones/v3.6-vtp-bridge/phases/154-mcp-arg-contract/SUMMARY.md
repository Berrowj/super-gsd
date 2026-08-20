---
phase: "154"
slug: mcp-arg-contract
milestone: v3.6-vtp-bridge
status: PASS
closed: 2026-08-20
commits: [0026f34, 5ed7002, f8a4b72, "35a1124", 81e7210]
gates: {plan_review: "GO 5/5", spec_review: "PASS after AMENDMENT-1", close_review: "1 CRIT found, fixed and re-verified", muda: "1 WARN (nine shaper call-sites)", verifier: "emitted-args PASS + real-evidence PASS, both exit 0"}
---

# P154 Summary — MCP Arg Contract

## What shipped

1. `f8a4b72` T1 — declared input schemas for the two VTP MCP tools in
   `super-gsd/schemas/vtp-mcp-input-schemas.v1.json` (mirrors the live vtp-kb
   descriptors, reproduced 2026-08-18); per-tool arg shaper at the final emission
   boundary in `sgsd-triage-runtime.cjs` (recent_turns strings become {text} objects
   for route_and_retrieve; substrate emission reduced to `query` + typed filters);
   Ajv-backed conformance test `assert-mcp-arg-contract.cjs` with a preserved
   contractual RED run naming both defects before the fix.
2. `5ed7002` AMENDMENT-1 — the legacy regression test asserted the defective shape
   at assert-real-triage-runtime.cjs:1436-1438; added to the T1 allowlist and
   corrected rather than silently weakened.
3. `35a1124` + `81e7210` T2 — real MCP acceptance evidence. Orchestrator performed
   both live calls (executor sandbox cannot reach MCP; division of labour declared
   in the plan). Close review caught a CRITICAL: first capture predated the T1
   commit and stored `_elided` summaries. Fix round re-emitted packets post-commit
   via the verifier's own fixture, re-performed both calls with those args verbatim,
   and stored substantively full raw results (single disclosed elision: call-1
   full-book headings index). `--case real-evidence` PASS, exit 0.

## Deferred (recorded, not relitigated)

- ATC WARN: assert-real-triage-runtime.cjs EPERM Worker bridge is broader than
  AMENDMENT-1 scope; carried.
- ATC WARN: the shaper is invoked at nine call-sites; centralising is a later
  refactor, not a P154 contract item.
- MUDA: 1 WARN, same nine-site observation; no CRIT.

## Downstream contract

Every runtime MCP emission now validates against a versioned declared schema; the
staged "runtime decides, Claude transports" protocol is executable verbatim. P159 T4
(VTP tool-family triage) builds on these declared schemas.
