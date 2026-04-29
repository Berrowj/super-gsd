---
plan_id: 76-01
phase: 76
title: Cockpit-state adapter (10 sections + 4 fixtures + MCP tool 12 unification)
type: code (FULL tier)
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/cockpit-state/adapter.cjs
  - super-gsd/tools/cockpit-state/run-self-test.cjs
  - super-gsd/tools/cockpit-state/fixtures/{active,blocked,warning,complete}/
  - super-gsd/tools/warp-mcp/server.cjs
---

# Plan 76-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Implement adapter.cjs with 10-section snapshot composer | Sections: now/objective/unlock/blockers/agents/codex/gates/tokens/artifacts/resume_command |
| 2 | Live events take precedence over legacy ledgers | gateEvents merged with gate-value-log, sorted by ts |
| 3 | 4 fixtures (active/blocked/warning/complete) | Each = synthetic _pseudo_root/.planning/ tree + expected.json |
| 4 | Update MCP tool 12 to delegate to adapter | warp-mcp 42/42 self-test still PASS (regression guard) |
| 5 | Lock-13 + READ-ONLY + ASCII-only invariants | Standard pattern from Phase 67/69/72 |
| 6 | Atomic commit | feat(p76-01) |
