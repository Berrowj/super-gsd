---
created: 2026-04-29T19:00:00Z
title: M2 — Verify Warp detects direct claude CLI as third-party agent
area: planning
phase: 63
milestone: v2.2
manual_check_id: M2
covers_smoke_row: Q5
files:
  - .planning/milestones/v2.2/WARP-SMOKE.md (row Q5)
  - .planning/milestones/v2.2/MANUAL-CHECKS.md (M2 full steps)
  - C:\Users\jack.berrow\AppData\Roaming\npm\claude.ps1
informs_phase: 65 (rules), 66 (operator guide), 78 (launch configs)
---

## Problem

Phase 63 confirmed `claude` is `ExternalScript` at `~/AppData/Roaming/npm/claude.ps1` and that direct invocation sets the `CLAUDECODE` and related env vars in the child process — Warp's documented detection criteria appear satisfied. But whether Warp's UI actually shows the third-party CLI agent utility bar (voice / image / file / diff controls) when claude runs directly is UI-bound. Phase 65 / 66 / 78 all assume YES.

Pair this with M3 — comparing direct-launch vs `sg`-wrapper detection.

## Solution

Steps (full version in `.planning/milestones/v2.2/MANUAL-CHECKS.md` § M2):

1. Open a fresh Warp PowerShell tab (no `sg`, no `sgsd`).
2. Run:
   ```powershell
   cd C:\Users\jack.berrow\GSDedits
   claude --dangerously-skip-permissions
   ```
3. Observe:
   - Does the third-party CLI agent **utility bar** appear (voice / image / file / diff controls)?
   - Does the input mode indicator show that Warp recognizes the active agent?
4. Type `/exit` or Ctrl-C. Utility bar should disappear.

**Record result** in `WARP-SMOKE.md` row Q5. If FAIL, this is upstream Warp territory — Phase 96 candidate at `https://github.com/warpdotdev/warp`.
