---
created: 2026-04-29T19:00:00Z
title: M1 — Verify SGSD workflow pack discoverable in Warp Command Search
area: planning
phase: 63
milestone: v2.2
manual_check_id: M1
covers_smoke_row: Q1
files:
  - .planning/milestones/v2.2/WARP-SMOKE.md (row Q1)
  - .planning/milestones/v2.2/MANUAL-CHECKS.md (M1 full steps)
  - .warp/workflows/sgsd-auto.yaml
  - .warp/workflows/sgsd-cockpit.yaml
  - .warp/workflows/sgsd-preflight.yaml
  - .warp/workflows/sgsd-start.yaml
  - .warp/workflows/sgsd-token-current.yaml
blocks_phase: 64 (Workflow Pack Completion)
blocks_phase_secondary: 66 (SGSD Warp Operator Guide)
---

## Problem

Phase 63 audit confirmed all 5 workflow YAMLs exist at `.warp/workflows/` and 4/5 lint clean (`sgsd-token-current.yaml` is missing the `arguments:` block — Phase 64 input). But whether Warp's Command Search / Workflow Search actually surfaces them is a UI fact that the audit could not prove from terminal. Phase 64 (Workflow Pack Completion) and Phase 66 (Operator Guide) both assume the answer is YES; if it's NO, both phases redesign.

## Solution

Steps (full version in `.planning/milestones/v2.2/MANUAL-CHECKS.md` § M1):

1. Open Warp in `C:\Users\jack.berrow\GSDedits`.
2. Open Command Palette (`Ctrl+Shift+P` on Windows; `Ctrl+P` is paste-last).
3. Type `SGSD:` (with the colon).
4. Confirm all 5 workflows appear:
   - `SGSD: Auto Mode`
   - `SGSD: Cockpit Only`
   - `SGSD: Full Preflight`
   - `SGSD: Start`
   - `SGSD: Token Summary`
5. (Optional) Type partial fragments — `auto`, `cockpit`, `preflight`, `start`, `token` — confirm fuzzy matching works.

**Record result** in `.planning/milestones/v2.2/WARP-SMOKE.md` row Q1: change verdict from `MANUAL-CHECK-REQUIRED` to `PASS` / `FAIL` / `PARTIAL` and add a one-line evidence note. Then commit with `docs(p63): record manual check M1`.

If FAIL: file an issue at `https://github.com/warpdotdev/warp` (forwarded to Phase 96 upstream tracking) and forward to Phase 64 as a design constraint.
