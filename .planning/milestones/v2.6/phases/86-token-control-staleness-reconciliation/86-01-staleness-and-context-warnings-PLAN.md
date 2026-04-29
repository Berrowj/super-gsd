---
plan_id: 86-01
phase: 86
title: Staleness reconciliation + context-size warnings + v2.6 debt records
type: code+config (FULL tier)
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/warp-mcp/server.cjs
  - super-gsd/tools/warp-doctor/check.cjs
  - super-gsd/tools/cockpit-state/adapter.cjs
  - super-gsd/scripts/lib/render-cockpit-snapshot.ps1
  - .planning/metrics/crit-backlog.jsonl
---

# Plan 86-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Recovery packet `_state_staleness` field | live test shows current STATE.md staleness; drift_minutes calculated correctly |
| 2 | warp-doctor probe `state_md_freshness` | PASS if drift <= 30 min, MISSING otherwise |
| 3 | warp-doctor probe `context_packet_builder_freshness` | PASS if log mtime <= 24h, MISSING otherwise |
| 4 | warp-doctor PROBE_NAMES len 16 → 18 | A1 self-test asserts 18 |
| 5 | Cockpit adapter `staleness` section | 11th section; both stale/fresh fixtures |
| 6 | Render-cockpit-snapshot.ps1 includes staleness | new section rendered |
| 7 | New `sgsd_context_size` MCP tool OR extend token_spend | warning_level enum {ok, soft_200k, hard_500k} |
| 8 | Recovery packet appends fresh-session recommendation when warning_level >= soft_200k | live verification |
| 9 | CRIT-BACKLOG.jsonl gains 3 v2.6 debt rows | codex_unavailable / context_packet_builder_dormant / context_bench_full_mode_unproven |
| 10 | All self-tests still PASS | warp-mcp 44+ / warp-doctor 17+ / cockpit-state 19+ |
| 11 | Atomic commit | feat(p86-01) |

## Self-test floor

```
node super-gsd/tools/warp-mcp/run-self-test.cjs                          # 45+/45+ PASS
node super-gsd/tools/warp-doctor/run-self-test.cjs                       # 17+/17+ PASS  
node super-gsd/tools/cockpit-state/run-self-test.cjs                     # 19+/19+ PASS
node super-gsd/tools/warp-mcp/server.cjs ... sgsd_recovery_packet ...    # has _state_staleness
node super-gsd/tools/warp-doctor/check.cjs --json ...                    # PROBE_NAMES len=18
```

## Out of scope (forwarded to Phase 87 or v2.6 patch)

- Wiring token-waste/check into orchestrator dispatch loop (substantial integration).
- Wiring context-packet/build into orchestrator dispatch loop (substantial integration).
- Adding a milestone-close gate that blocks v2.6 SHIPPED on these.
- CONTEXT-BENCH full-mode rerun.

These are CRIT-BACKLOG rows in this phase, not Phase 86 deliverables.
