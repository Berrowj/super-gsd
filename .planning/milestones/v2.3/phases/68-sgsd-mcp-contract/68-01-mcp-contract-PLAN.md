---
plan_id: 68-01
phase: 68
title: SGSD MCP Contract authoring
type: docs-only design
created: 2026-04-29
status: ready-for-execution
schema_version: 1
expected_ATC_tier: lite
model: opus (orchestrator-authored — design doc)
files_touched:
  - super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md
  - super-gsd/tools/warp-mcp/fixtures/README.md
---

# Plan 68-01 — SGSD MCP Contract authoring

## Tasks

| # | Task | Acceptance |
|--:|---|---|
| 1 | Author SGSD-WARP-MCP-CONTRACT.md | All 14 tools documented; schema_version stamp; redaction rules; degraded behavior; max output sizes; fixture pointer |
| 2 | Author warp-mcp/fixtures/README.md | Defines `{tool}.input.json` + `{tool}.expected.json` pair shape; documents how Phase 70/71 will consume |
| 3 | Verify all 14 tools have full envelope | grep tool names in contract → each has Inputs / Outputs / Failure Modes / Source Files / Max Output Size sections |
| 4 | Verify redaction vocab is closed | redaction rules listed once at contract level; >= 5 categories |
| 5 | Verify no write-capable tool | grep for "write" / "mutate" / "set_" / "update_" — zero hits in tool list |
| 6 | Verify cross-references resolve | all `.planning/...` paths cited exist on disk |

## 14 Tools (Phase 68 lockdown)

| # | Tool | Reads | Purpose |
|--:|---|---|---|
| 1 | sgsd_current_state | STATE.md frontmatter | active milestone/phase/last_activity/status |
| 2 | sgsd_current_phase | STATE.md + active phase folder | current phase status, plan progress, deferred count |
| 3 | sgsd_milestone_status | STATE.md progress block + per-milestone _complete blocks | milestone-level summary |
| 4 | sgsd_watchdog_status | autopilot-watchdog.json + orchestrator-pulse.jsonl tail | autopilot state, last pulse age |
| 5 | sgsd_gate_status | gate-value-log.jsonl + review-ledger.jsonl tail | latest gate verdicts (per gate, last N) |
| 6 | sgsd_agent_roster | activity-log.jsonl filtered by current_phase | agents dispatched in active phase |
| 7 | sgsd_codex_status | codex-live.json + codex-log.jsonl tail | active codex run, freshness, last verdict |
| 8 | sgsd_token_spend | token-attribution.jsonl + agent-token-spend.jsonl | summary by role/phase/provider; --current flag |
| 9 | sgsd_context_bench_status | benchmark logs (Phase 51 product) | latest context-bench run summary |
| 10 | sgsd_latest_commits | git log via spawnSync | last N commits with message + hash + files |
| 11 | sgsd_recovery_packet | ORCHESTRATOR-CHECKPOINT.md or STATE.md frontmatter fallback | 4-block packet matching the workflow |
| 12 | sgsd_cockpit_snapshot | cockpit state adapter (composes 1+2+4+5+6+7+8) | one-shot snapshot for Warp Agent |
| 13 | sgsd_artifact_links | per-phase folder enumeration | latest ATC-REVIEW + VERIFICATION + WASTE per phase |
| 14 | sgsd_warp_doctor | shells out to warp-doctor check.cjs --json | doctor envelope inline |

## Surgical Constraint

Contract doc must be implementation-ready (Phase 69-71 reads it once, builds
against it without re-design). Each tool's envelope must be complete enough
that Sonnet executor in Phase 69-71 can ship without the orchestrator
clarifying. Spec drift = Phase 69-71 rework cost.

## Acceptance (Plan-Level)

- All 6 tasks complete.
- 14 tools fully documented.
- Fixture shape defined.
- No write-capable tool.
- All cross-references verified.

## Out Of Scope

- MCP server implementation (Phase 69-71).
- Warp config snippet (Phase 72).
