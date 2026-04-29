---
created: 2026-04-29T19:00:00Z
title: M3 — Verify Warp detects sg-launched Claude (wrapper-command detection)
area: planning
phase: 63
milestone: v2.2
manual_check_id: M3
covers_smoke_row: Q6
pair_with: M2
files:
  - .planning/milestones/v2.2/WARP-SMOKE.md (row Q6)
  - .planning/milestones/v2.2/MANUAL-CHECKS.md (M3 full steps)
  - PowerShell profile sg() function (lines 86-122)
informs_phase: 65, 66, 96 (upstream wrapper-detection candidate)
---

## Problem

Daily operator flow is `sg`, not `claude` direct. Phase 63 verified empirically (this very Claude session is the in-process witness) that `sg` invokes `& claude --dangerously-skip-permissions` synchronously in the same PowerShell — the env vars `CLAUDECODE` and `TERM_PROGRAM=WarpTerminal` are both set in the wrapped Claude process. Warp's documented detection criteria appear satisfied. But if Warp's third-party CLI agent detector special-cases the parent process name (e.g., expects parent==`claude.exe` rather than walking the env vars), the utility bar may NOT appear under `sg`. That would be a real ship-blocker for the cockpit operator UX and a strong Phase 96 upstream-contribution case.

Must be paired with M2: if M2 PASS and M3 FAIL, the wrapper-command (`sg`) is breaking detection.

## Solution

Steps (full version in `.planning/milestones/v2.2/MANUAL-CHECKS.md` § M3):

1. Open a fresh Warp PowerShell tab.
2. Run:
   ```powershell
   sg
   ```
3. While Claude is running (you'll see the SGSD boot greeting), observe Warp UI:
   - Does the third-party CLI utility bar appear?
   - Does Warp's status chip / agent indicator show "Claude Code" or similar?
4. Compare to M2 result.

**Record result** in `WARP-SMOKE.md` row Q6. If M2=PASS and M3=FAIL → file upstream issue at `https://github.com/warpdotdev/warp` requesting wrapper-command detection (Phase 96).
