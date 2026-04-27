---
phase: 28
title: Mission Control 2.0 Layout
type: code
created: 2026-04-26
discuss_decisions: [28.1, 28.2, 27.2 implementation]
unblocks: [29, 30]
mode: gsd-discuss-phase --auto
---

# Phase 28 — Mission Control 2.0 Layout (CONTEXT)

## Goal

Land 3 code touchpoints:
1. NEW lib `super-gsd/scripts/lib/sgsd-mission-strip.ps1` (Q1-Q8 6-line strip renderer)
2. EDIT `super-gsd/scripts/sgsd-mission-control.ps1` (~15 lines: soft-load + render call at top, replace 1-line header per 28.1)
3. EDIT `super-gsd/hooks/sgsd-activity-logger.js` (apply Phase 27 stamper spec verbatim — env-var primary → anchored YAML → null)

## What's locked

- **28.1** Strip at top, replaces existing 1-line header
- **28.2** 6 lines: header / objective+unlock / model / blocker / codex+agents / next
- **27.2 implementation** stamper fix per `27-01-PLAN.md §Stamping Spec`
- **26.1-26.3** vocabulary/freshness/repair (cite, don't redefine)
- **PS 5.1 mojibake guard**: ASCII-only string literals in the new .ps1 file

## What the planner must produce

ONE plan: `28-01-mission-control-layout-PLAN.md` with 3 code tasks:
- T1 (sgsd-exec-ui): write `sgsd-mission-strip.ps1` with `Get-MissionStripState` (hashtable) + `Render-MissionStrip` (6 lines). Soft-load semantics matching `sgsd-substrate-status.ps1` pattern.
- T2 (sgsd-exec-ui): edit `sgsd-mission-control.ps1` to soft-load lib + call `Render-MissionStrip` before existing 1-line header. ~15 lines max.
- T3 (sgsd-exec-backend): replace stamper logic in `sgsd-activity-logger.js` lines 144-149 with env-var-primary + anchored-frontmatter readActivePhase impl from 27-01-PLAN.

Each task = one git commit. Per-dispatch ATC fires on each (Codex side will FAIL → backlog row each).

## Open derivation calls (locked)

1. **Strip line content per 28.2 6-line breakdown** (lock from RESEARCH §2 — 6 lines exactly):
   - Line 1: `[ MISSION ] {milestone} {milestone_name}`
   - Line 2: `> objective {phase} {goal}  > unlock {next}`
   - Line 3: `> model {state} {tool : target}`
   - Line 4: `> blocker {state} {detail}`
   - Line 5: `> codex {state}  > agents {list-truncated-60c}`
   - Line 6: `> next {action}`
2. **Soft-load semantics** — `if (Test-Path lib) { . lib }` then check `Get-Command Render-MissionStrip` before invoking. Missing lib = silent skip = no break to legacy cockpit.
3. **Atomic stamper write** — preserve existing `appendFileSync` semantics; do not change error handling.

## Standard workflow (no deviations)

All 10 steps run. Per-dispatch ATC fires on every commit. MUDA likely fires
(diff_lines + code_files_changed). Phase-level ATC at close.

## Status taxonomy (anticipated)

`PASS-WITH-DEFERRED-N` where N = commits with Codex side failed (likely
3) + phase-level ATC Codex failed (1) = **likely 4 backlog rows**.

## Kill / defer conditions

- **Defer** if PowerShell parse fails after 3 fix attempts on `sgsd-mission-strip.ps1` → backlog with attempts=3
- **Defer** if stamper fix breaks existing activity-log writes (regression) → backlog
- **Hard stop** none foreseen — PS 5.1 mojibake is the known sharpest edge; ASCII-only mitigates
