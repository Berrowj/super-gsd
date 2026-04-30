---
phase: 105
artifact: research
authored_by: orchestrator (Opus)
---

# Phase 105 -- Research

## Sources
- Acceptance #1-5 in CONTEXT.md
- Phase 101 v2.9 close gate (already ships unattributed-manifest check)
- Phase 104 transfer evaluator (provides critical_regression field)
- Phase 98 catalog (protected-surface contract)
- Phase 76 cockpit-state adapter (SECTION_KEYS pinned at 11)
- Phase 69-72 warp-mcp server (TOOL_NAMES frozen at 14, 47/47 self-test)

## Key decisions

### D1 -- Extend v2.9 close gate with transfer + critical regression
sgsd-complete-milestone.cjs already has v2.9 branch (Phase 101). Extend:
- AHE-EVAL-03: any keep-verdict change must have a transfer record.
- AHE-EVAL-05: critical regressions in transfer block clean ship; close
  must explicitly record SHIPPED-WITH-UNPROVEN-HARNESS-EVOLUTION if
  bypassed.
- The gate reads harness-transfer.jsonl and surfaces blockers.

### D2 -- v2.9 SUMMARY.md scope
- Paper evidence: AHE-P-01..10 with SGSD interpretation.
- Local SGSD evidence: 7 self-test totals (98-104).
- Phase 98-105 deliverables list.
- Measured deltas placeholder (operator runs benchmark + populates).
- Deferred items honestly named.
- Critical-gap operator handoff list.

### D3 -- SGSD-HARNESS-EVOLUTION.md appends
Append sections for Phase 100-105 to existing doc:
- Phase 100: change manifest schema + ledger
- Phase 101: attribution scorer + 6-verdict vocab + close gate
- Phase 102: 4-mode runner
- Phase 103: ablation runner + 3 interference rules
- Phase 104: transfer evaluator + frozen-before-run rule
- Phase 105: release gate (this phase)

### D4 -- Honest deferral on MCP + cockpit integration
Plan 105-01 lists modifications to:
- super-gsd/tools/warp-mcp/server.cjs (frozen TOOL_NAMES + 47/47)
- super-gsd/tools/cockpit-state/adapter.cjs (frozen SECTION_KEYS + 19/19)

Both have count-pinned self-test assertions across many test legs.
Adding a 15th MCP tool / 12th cockpit section requires lockstep updates
to the test code. Risk of regression on `sgsd-complete-milestone` self-test
(8/8) and 47/47 + 19/19 is non-trivial.

Per Phase 95 SKIPPED precedent and operator's honest-deferral stance,
this phase records the integration as DEFERRED with clear paths:
- DEFERRED-1: warp-mcp `sgsd_harness_evolution_status` tool addition.
- DEFERRED-2: cockpit-state `harness_evolution` 12th section.

These deferrals preserve correctness (the AHE loop works; data is
accessible via JSONL files and runner CLIs) while explicitly not
overclaiming "MCP exposes harness evolution." Future v2.10 phase or
operator-driven follow-up can absorb the lockstep edits.

### D5 -- Phase 105 final scope
- Extend v2.9 close gate (additive to existing P101 v2.9 branch).
- Author SUMMARY.md.
- Append phase sections to SGSD-HARNESS-EVOLUTION.md.
- Mark MCP + cockpit as DEFERRED-2.
- Phase status: PASS-WITH-DEFERRED-2.

### D6 -- Acceptance mapping
- #1 close gate blocks: YES (extended)
- #2 MCP exposes status: DEFERRED-1
- #3 Cockpit shows state: DEFERRED-2
- #4 Operator docs: YES (HARNESS-EVOLUTION.md)
- #5 SUMMARY.md: YES

3/5 acceptance met cleanly + 2 honest deferrals.

## Risks
- R1: MCP/cockpit deferral leaves operator-visible surface incomplete.
  Mitigation: SUMMARY.md and HARNESS-EVOLUTION.md both name the
  deferral explicitly + provide CLI commands for direct access.
- R2: Future MCP/cockpit edits may collide with v2.10 work.
  Mitigation: deferral records the exact lockstep edits required.
