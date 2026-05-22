---
plan_id: 87-01
phase: 87
title: Live orchestrator wire-in (token-waste + context-packet) + v2.6 close gate
type: code+integration (FULL tier; multi-file)
created: 2026-04-29
status: queued
expected_ATC_tier: full
files_touched:
  - super-gsd/tools/state-resolver/resolve.cjs
  - super-gsd/tools/warp-mcp/server.cjs
  - super-gsd/tools/cockpit-state/adapter.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/scripts/sgsd-complete-milestone.cjs
  - (optional) super-gsd/scripts/sgsd-state-sync.cjs
  - (optional) super-gsd/tools/context-packet/build.cjs
  - (new) super-gsd/scripts/lib/orchestrator-hooks.cjs (small helper for hook points)
---

# Plan 87-01 — Live wire-in

## Tasks

| # | Task | Acceptance |
|--:|---|---|
| 0 | Effective-state resolver | `node super-gsd/tools/state-resolver/resolve.cjs --json` returns v2.6 / Phase 87 on the live repo even if `STATE.md roadmap_run` still says v2.2 complete |
| 1 | MCP status tools use resolver | `sgsd_current_phase`, `sgsd_current_state`, and recovery packet report effective state plus stale/conflict metadata |
| 2 | Cockpit adapter uses resolver | cockpit objective/artifact panes cannot be driven to "roadmap complete" by stale `STATE.md roadmap_run` when live evidence shows active work |
| 3 | SKILL.md token-waste hook at Step 11 | grep finds invocation; orchestrator commits trigger token-waste/check via Bash |
| 4 | SKILL.md context-packet hook at Step 6 | grep finds invocation; sub-agent prompt composition includes context-packet/build call |
| 5 | sgsd-complete-milestone.cjs v2.6 enforcement gate | refuses SHIPPED-clean while open `v2_6_debt` rows with summary matching `context_packet_builder_dormant` OR `context_bench_full_mode_unproven` |
| 6 | warp-doctor probe `context_packet_builder_freshness` PASS post-dispatch | live verification: invoke `/sgsd-orchestrate go` (or simulated run), confirm context-packet-log.jsonl mtime updates, re-run probe |
| 7 | Self-test for enforcement gate | synthetic crit-backlog with the 2 trigger rows; sgsd-complete-milestone.cjs exit non-zero |
| 8 | CONTEXT-BENCH status flip | proven (full-mode rerun) OR accepted-environmental |
| 9 | Atomic commit | feat(p87-01) |

## Surgical Constraint

Wire-in must NOT change orchestrator behavior on the success path. The
state resolver is read-only; token-waste/check is read-only;
context-packet/build appends to its own log. Failure modes degrade
gracefully (Lock-13 across hook boundary), but stale-state detection must
be visible to MCP/cockpit/recovery instead of silently trusting
`STATE.md roadmap_run`.

## Out of scope (forwarded to v2.7+)

- Per-sub-agent context-packet pruning (current Phase 45 builder
  produces packets; per-dispatch consumption is a v2.7 controlled-action
  concern).
- Token-budget hard-stop at orchestrator-loop level (current is
  per-commit warning; hard-stop requires v2.7 controlled-action contract).

## Self-test floor

```bash
# After Phase 87 ships, simulate v2.6 close with debt:
echo '{"ts":"2026-04-29T22:00:00Z","kind":"v2_6_debt","phase":86,"summary":"context_packet_builder_dormant","resolution":"open"}' >> .planning/metrics/crit-backlog.jsonl
node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.6
# Expected: exit non-zero with SHIPPED-WITH-CRIT-DEBT status

# Cleanup the synthetic row before real testing:
# (handle via temp-dir test; don't pollute live crit-backlog)
```

## Hard rule

DO NOT advance Phase 88 (End-to-End Warp Operator Drill) until Phase 87
closes. Phase 87 cannot close while `sgsd_current_phase` returns stale
v2.2 / complete on this live repo. Phase 88 acceptance REQUIRES Phase
87's enforcement to be live.
