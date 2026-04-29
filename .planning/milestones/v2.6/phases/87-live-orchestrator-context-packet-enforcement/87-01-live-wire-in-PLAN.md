---
plan_id: 87-01
phase: 87
title: Live orchestrator wire-in (token-waste + context-packet) + v2.6 close gate
type: code+integration (FULL tier; multi-file)
created: 2026-04-29
status: queued
expected_ATC_tier: full
files_touched:
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
  - super-gsd/scripts/sgsd-complete-milestone.cjs
  - (optional) super-gsd/tools/context-packet/build.cjs
  - (new) super-gsd/scripts/lib/orchestrator-hooks.cjs (small helper for hook points)
---

# Plan 87-01 — Live wire-in

## Tasks

| # | Task | Acceptance |
|--:|---|---|
| 1 | SKILL.md token-waste hook at Step 11 | grep finds invocation; orchestrator commits trigger token-waste/check via Bash |
| 2 | SKILL.md context-packet hook at Step 6 | grep finds invocation; sub-agent prompt composition includes context-packet/build call |
| 3 | sgsd-complete-milestone.cjs v2.6 enforcement gate | refuses SHIPPED-clean while open `v2_6_debt` rows with summary matching `context_packet_builder_dormant` OR `context_bench_full_mode_unproven` |
| 4 | warp-doctor probe `context_packet_builder_freshness` PASS post-dispatch | live verification: invoke `/sgsd-orchestrate go` (or simulated run), confirm context-packet-log.jsonl mtime updates, re-run probe |
| 5 | Self-test for enforcement gate | synthetic crit-backlog with the 2 trigger rows; sgsd-complete-milestone.cjs exit non-zero |
| 6 | CONTEXT-BENCH status flip | proven (full-mode rerun) OR accepted-environmental |
| 7 | Atomic commit | feat(p87-01) |

## Surgical Constraint

Wire-in must NOT change orchestrator behavior on the success path. Both
hooks are lightweight: token-waste/check is read-only; context-packet/build
appends to its own log. Failure modes degrade gracefully (Lock-13 across
hook boundary).

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

DO NOT advance Phase 88 (End-to-End Warp Operator Drill) until Phase 87 closes. Phase 88 acceptance REQUIRES Phase 87's enforcement to be live.
