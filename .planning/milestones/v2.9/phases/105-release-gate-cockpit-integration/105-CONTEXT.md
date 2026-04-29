---
phase: 105
phase_name: Release Gate And Cockpit Integration
milestone: v2.9
created: 2026-04-30
status: queued
source: AHE governance and operator visibility
---

# Phase 105 - Context

Make harness evolution governable and visible.

The operator should not need to inspect every JSONL row to know whether SGSD's harness is improving. Cockpit and MCP should show the current candidate, evidence, predicted fixes, regression risk, attribution verdict, and whether clean release is blocked.

## Goal

Wire v2.9 into milestone close, MCP, cockpit, and operator docs.

## Required Outputs

- `super-gsd/scripts/sgsd-complete-milestone.cjs` v2.9 gate
- `super-gsd/tools/warp-mcp/server.cjs` harness evolution status tool or field
- `super-gsd/tools/cockpit-state/adapter.cjs` harness evolution section
- `super-gsd/docs/SGSD-HARNESS-EVOLUTION.md`
- v2.9 `SUMMARY.md`

## Clean-Close Blockers

- open harness candidate without attribution verdict
- missing regression predictions
- protected-surface edit without operator override
- transfer evaluation missing
- deterministic benchmark red
- live/held-out benchmark unrun and not explicitly accepted as environmental

## Acceptance

1. `sgsd-complete-milestone --milestone v2.9` blocks clean close on missing attribution.
2. MCP exposes harness evolution summary.
3. Cockpit shows harness candidate state without raw-log overload.
4. Operator docs explain how to run dry-run, proposal-only, apply-candidate, and attribute-only modes.
5. v2.9 summary includes paper evidence, local SGSD evidence, measured deltas, and reverted changes.
