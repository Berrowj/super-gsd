---
phase: 29
title: Agent + Codex Visibility Lanes (audit + tightening)
type: code (small)
created: 2026-04-26
discuss_decisions: [29.1, 29.2]
unblocks: [30]
mode: gsd-discuss-phase --auto
---

# Phase 29 — Agent + Codex Visibility Lanes (CONTEXT)

## Goal

Verify the Phase 28 lib already honors DISCUSS 29.1 (Codex 1h staleness)
and 29.2 (current-phase scoping) for Q5/Q6 lanes. Apply 3 surgical
hardening edits per RESEARCH. Add fixture-based tests.

This is **not a rewrite**. Phase 28 already shipped the structural lib.
Phase 29 audits + hardens.

## What's locked

- **29.1** Codex stale at 1h mtime (codex-live.json mtime > 3600s → demote to idle/stale)
- **29.2** Agents pane = current phase only (filter activity-log by phase field)
- **26.1-26.3 carry** vocabulary/freshness/repair (cite, don't redefine)

## What the planner must produce

ONE plan with 1-3 small tasks:
- **T1 (sgsd-exec-ui)**: Apply RESEARCH-identified surgical hardening to `sgsd-mission-strip.ps1`. Limit ~30 lines diff total.
- **T2 (sgsd-exec-test)**: Write fixture-based test scenarios for Q5/Q6 lanes (multiple codex-live.json states, multiple activity-log phase scenarios).

## Open derivation calls (locked)

1. **Live Q5 verification gated on deployed-hook re-install** — RESEARCH notes
   the deployed hook hasn't been re-installed (Phase 28 NIT). Fixture-based
   verification is unblocked; live verification deferred.
2. **No rewrite of `sgsd-codex-monitor.ps1`** — DISCUSS 29.x doesn't change
   the deep-detail Codex pane. Strip provides 1-line summary; monitor remains
   authoritative for full report.
3. **Pane-vs-strip split** — confirmed no duplication per RESEARCH §4.

## Workflow deviations

Standard 10-step workflow. Per-dispatch ATC fires on lib edits.

## Status taxonomy at close (anticipated)

`PASS-WITH-DEFERRED-N` — same Codex unavail pattern as Phase 26-28.

## Kill / defer conditions

- Defer if RESEARCH gap inventory grows during planning to >5 edits
  (would expand scope beyond "audit + tightening")
- Defer if test fixtures expose a structural bug in the Phase 28 lib
  requiring a rewrite (escalate to operator)
- Hard stop only if a Q5/Q6 contract obligation cannot be honored (none expected)
