---
phase: 19
plan: "19-01"
subsystem: mission-control-visibility
tags: [codex, mission-control, statusline, dashboard, PS-5.1]
dependency_graph:
  requires: [phase-17-codex-foundations, phase-18-codex-telemetry]
  provides: [MC-01, MC-02, MC-05]
  affects: [sgsd-mission-control.ps1, sgsd-statusline.ps1, sgsd-dashboard.ps1]
tech_stack:
  added: []
  patterns: [inline-json-read-for-latency, state-normalization-at-render, ascii-safe-glyphs]
key_files:
  modified:
    - super-gsd/scripts/sgsd-mission-control.ps1
    - super-gsd/scripts/sgsd-statusline.ps1
    - super-gsd/scripts/sgsd-dashboard.ps1
decisions:
  - "Normalize ok/not-fired -> idle at every render site consistently (GAP-5)"
  - "ASCII [x] prefix for statusline glyph, not UTF-8 (PS 5.1 ParseFile lesson)"
  - "Statusline reads codex-live.json inline (no helper dot-source) for latency"
  - "Get-CodexStats added to dashboard (separate from Get-TokenStats) to avoid mutating existing function"
metrics:
  duration: "~20min"
  completed: "2026-04-24"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 19 Plan 01: Core Tiles + Statusline Summary

One-liner: Wired 3 MC surfaces to live Codex telemetry — mission-control SGSD-Codex-Tile (3-verdict rows + metrics), statusline [x] cdx:{state} 5-color segment, dashboard MultimodalReview Offload tile (4 D-07 metrics).

## Files Changed

| File | Change |
|------|--------|
| `super-gsd/scripts/sgsd-mission-control.ps1` | Added SGSD-Codex-Tile block after existing CODEX inline section |
| `super-gsd/scripts/sgsd-statusline.ps1` | Appended [x] cdx:{state} segment to $line2Parts |
| `super-gsd/scripts/sgsd-dashboard.ps1` | Added Get-CodexStats function + MultimodalReview Offload tile |

## Commits

| Task | Hash | Message |
|------|------|---------|
| T1 | 78772dd | feat(19-01/T1): MC-01 mission-control Codex tile (3-row RECENT VERDICTS + metrics) |
| T2 | 267d0e1 | feat(19-01/T2): MC-02 statusline Codex state indicator (5 states, ASCII glyph) |
| T3 | 9f1c97e | feat(19-01/T3): MC-05 dashboard Multimodal Review Offload tile (4 D-07 metrics) |

## Verification

- T1: `grep -c 'SGSD-Codex-Tile' sgsd-mission-control.ps1` → 2 (open + close sentinel) ✓ | PS parse: 0 errors ✓
- T2: `grep -c 'cdx:' sgsd-statusline.ps1` → 4 ✓ | 5 switch states present ✓ | PS parse: 0 errors ✓
- T3: `grep -c 'MultimodalReview' sgsd-dashboard.ps1` → 1 ✓ | Get-CodexStats present (2 matches) ✓ | PS parse: 0 errors ✓

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Planner Deviation Notes Applied

**1. [Planner note] ASCII glyph instead of UTF-8**
- D-03 proposed `⚙` glyph; planner deviation note already specified ASCII `[x]` per PS 5.1 Phase 17 lesson.
- Applied: `[x] cdx:{state}` in statusline (not `⚙`).

**2. [Planner note] State normalization applied consistently**
- Both `"ok"` and `"not-fired"` normalized to `"idle"` at all three render sites.
- Decided once per render function, not scattered.

## Known Stubs

None — all 4 D-07 metrics in the dashboard tile are computed from live files (codex-log.jsonl, token-log.jsonl). If those files are absent, metrics display 0 (graceful empty state, not hardcoded placeholder).

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns beyond those declared in the plan threat model. All three scripts read local operator-owned metrics files inside `.planning/metrics/` — same trust boundary as existing reads.

## Self-Check: PASSED

- `super-gsd/scripts/sgsd-mission-control.ps1` — FOUND, contains SGSD-Codex-Tile sentinel
- `super-gsd/scripts/sgsd-statusline.ps1` — FOUND, contains cdx: sentinel
- `super-gsd/scripts/sgsd-dashboard.ps1` — FOUND, contains MultimodalReview + Get-CodexStats
- Commits 78772dd, 267d0e1, 9f1c97e — all present in git log
