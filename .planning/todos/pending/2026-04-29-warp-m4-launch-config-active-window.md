---
created: 2026-04-29T19:00:00Z
title: M4 — Verify Warp launch config opens active-window vs new-window on Windows
area: planning
phase: 63
milestone: v2.2
manual_check_id: M4
covers_smoke_row: Q9
files:
  - .planning/milestones/v2.2/WARP-SMOKE.md (row Q9)
  - .planning/milestones/v2.2/MANUAL-CHECKS.md (M4 full steps)
  - C:\Users\user\.warp\launch_configurations\ (currently empty)
informs_phase: 78 (Launch Configuration Templates)
---

## Problem

Phase 63 confirmed `~/.warp/launch_configurations/` exists but is **empty** (the trial `gsdedits-workspace.yaml` from the 2026-04-11 spec is gone). The 2026-04-11 spec recorded that on Windows Warp the "open in current window" behavior was unreliable — but Warp went open source 2026-04-28 and roadmap issue #9233 lists future Warp CLI control. Phase 78 design hinges on whether saved layouts open in the active window or only new windows on this Windows install today.

## Solution

Steps (full version in `.planning/milestones/v2.2/MANUAL-CHECKS.md` § M4):

1. Place this minimal fixture at `C:\Users\user\.warp\launch_configurations\smoke-test.yaml`:
   ```yaml
   ---
   name: SMOKE Test
   windows:
     - tabs:
         - layout:
             cwd: C:\Users\user\GSDedits
             commands:
               - exec: pwd
   ```
2. From an active Warp window, open Command Palette (`Ctrl+Shift+P`).
3. Search for "Launch Configuration" or "SMOKE Test".
4. Click to open. Observe:
   - Did it open in the **current** Warp window (replacing or adding to active tabs/panes)?
   - Or did it spawn a **new** Warp window?
5. Try the same from a fresh Warp window with no current tabs, then from a Warp window with multiple tabs.
6. Delete `smoke-test.yaml` after testing.

**Record result** in `WARP-SMOKE.md` row Q9. Result determines whether Phase 78 templates can promise active-window behavior or must document that they spawn new windows.
