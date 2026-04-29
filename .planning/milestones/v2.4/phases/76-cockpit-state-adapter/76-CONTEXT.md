---
phase: 76
phase_name: Cockpit State Adapter
milestone: v2.4
created: 2026-04-29
status: in-progress
deviation_from_standard: code phase (FULL tier)
---

# Phase 76 -- Cockpit State Adapter (CONTEXT)

## Goal

Build `super-gsd/tools/cockpit-state/adapter.cjs` — single normalized
snapshot composer that BOTH cockpit panes AND MCP `sgsd_cockpit_snapshot`
read through. Consumes `.planning/ORCHESTRATOR-LIVE.jsonl` (Phase 75
event stream) PLUS legacy ledgers (Phase 70 status sources).

## Locked Scope (D76.1-D76.6)

- D76.1: Adapter returns normalized snapshot with sections: `now`,
  `objective`, `unlock`, `blockers`, `agents`, `codex`, `gates`,
  `tokens`, `artifacts`, `resume_command`. 10 sections aligned with
  the Phase 73 12-question model.
- D76.2: Reads from BOTH live event stream AND legacy ledgers; live
  events take precedence when present (recency wins); legacy ledgers
  fill gaps.
- D76.3: 4 fixtures: `active`, `blocked`, `warning`, `complete`. Each
  fixture = synthetic `.planning/` tree exercising the corresponding
  state class.
- D76.4: MCP `sgsd_cockpit_snapshot` (Phase 71 tool 12) is updated to
  USE the adapter (eliminates duplicate composition logic; single
  source of truth).
- D76.5: Cockpit scripts (sgsd-cockpit-shell.cjs / sgsd-mission-control.ps1)
  can consume adapter output via `node adapter.cjs --json` (no PowerShell
  refactor needed; just provide a stable JSON consumer surface).
- D76.6: Lock-13 + READ-ONLY + ASCII-only per established pattern.

## Inputs

- super-gsd/scripts/lib/orchestrator-live-reader.cjs (Phase 75)
- super-gsd/tools/warp-mcp/server.cjs (Phase 71 — tool 12 needs update)
- super-gsd/docs/OPERATOR-QUESTION-MODEL.md (Phase 73 — 12-question source)
- legacy ledgers under .planning/metrics/

## Outputs

- super-gsd/tools/cockpit-state/adapter.cjs (NEW)
- super-gsd/tools/cockpit-state/run-self-test.cjs (NEW; thin shell)
- super-gsd/tools/cockpit-state/fixtures/{active,blocked,warning,complete}/{state,events,expected}.* (NEW)
- super-gsd/tools/warp-mcp/server.cjs (UPDATED — tool 12 uses adapter)
- 5 Phase 76 standard artifacts

## Acceptance

1. `node super-gsd/tools/cockpit-state/run-self-test.cjs` exits 0 (>=12 assertions).
2. 4 fixtures (active/blocked/warning/complete) all PASS.
3. `node adapter.cjs --json` against this checkout returns 10 sections; all string values redaction-friendly.
4. MCP sgsd_cockpit_snapshot uses adapter; existing 42-assertion warp-mcp self-test still PASS.
5. READ-ONLY + ASCII-only invariants.
6. Adapter never throws; bad input → degraded sentinel.
