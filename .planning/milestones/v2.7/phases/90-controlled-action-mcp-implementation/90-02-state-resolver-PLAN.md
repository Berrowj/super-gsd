---
plan_id: 90-02
phase: 90
title: State-resolver + read-side integration (D90.0 + D90.6 per operator override)
type: code+integration (FULL tier)
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/state-resolver/resolve.cjs
  - super-gsd/tools/warp-mcp/server.cjs
  - super-gsd/tools/cockpit-state/adapter.cjs
---

# Plan 90-02

Operator added D90.0 + D90.6 retroactively to Phase 90 CONTEXT. The
controlled-action server (Plan 90-01) shipped at dae0550, but cannot
be considered "complete" until the read-side is also correct.

| # | Task | Acceptance |
|--:|---|---|
| 1 | resolve.cjs priority-ordered effective state | checkpoint > pulse > activity-log > phase folders > git > STATE.md legacy |
| 2 | resolveEffectiveState envelope | milestone, phase, phase_name, status, confidence, source, projection_stale, stale_sources, conflicts, recommended_repair |
| 3 | Wire into sgsd_current_state | data.milestone uses resolved; state_md_milestone shows legacy |
| 4 | Wire into sgsd_current_phase | data.phase uses resolved (NOT raw STATE.md) |
| 5 | Wire into sgsd_recovery_packet | current_position uses resolved; next_unlock.from gets new 'resolver_repair' value |
| 6 | Wire into cockpit-state adapter objective + staleness | objective.milestone/phase/source = resolver |
| 7 | self-test 12+/12+ PASS | priority order verified; READ-ONLY; ASCII-only |
| 8 | Live: v2.7 P90 NOT v2.6 P86 | confirmed via stdio |
| 9 | All adjacent self-tests still green | warp-mcp 47/47, warp-doctor 17/17, cockpit-state 19/19, warp-mcp-actions 21/21 |
| 10 | Atomic commit | feat(p90-02) at 55b25d8 |

Status: SHIPPED at 55b25d8.
