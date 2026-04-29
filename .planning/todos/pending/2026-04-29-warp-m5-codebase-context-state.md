---
created: 2026-04-29T19:00:00Z
title: M5 — Verify Warp Codebase Context is indexing this repo
area: planning
phase: 63
milestone: v2.2
manual_check_id: M5
covers_smoke_row: Q10
files:
  - .planning/milestones/v2.2/WARP-SMOKE.md (row Q10)
  - .planning/milestones/v2.2/MANUAL-CHECKS.md (M5 full steps)
  - WARP.md
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
informs_phase: 65 (rules + .warpindexingignore), 66 (operator guide)
related_finding: .warpindexingignore is MISSING — Warp will index entire repo by default including .planning/metrics/*.jsonl. Forwarded to Phase 65 or new ignore-pack phase.
---

## Problem

Codebase Context dramatically improves Warp Agent's ability to answer SGSD questions without long context dumps. It's a prerequisite for Phase 65 rules and Phase 66 operator guide working as designed. If indexing is disabled or stale, Warp Agent will hallucinate paths and give wrong answers about SGSD state.

Phase 63 confirmed Codebase Context state is NOT exposed to terminal — must verify in UI. Per Warp docs, Codebase Context is disabled in WSL/SSH sessions; SGSD on this machine runs in native Windows PowerShell so it should apply.

## Solution

Steps (full version in `.planning/milestones/v2.2/MANUAL-CHECKS.md` § M5):

1. Open Warp Agent in this repo (`Ctrl+\` or the agent input toggle).
2. Ask: `What is in WARP.md?` or `Summarize the SGSD orchestrator skill.`
3. Observe Warp Agent's response:
   - Does it cite specific file paths under `super-gsd/` or `.planning/`?
   - Does it find `WARP.md` and quote from it?
   - Does the agent surface a "codebase context" indicator / chip?
4. (Optional) Open Warp Agent context settings. Confirm Codebase Context is enabled and the indexing status for this repo shows "ready" or equivalent.

**Record result** in `WARP-SMOKE.md` row Q10.

**Side action** (independent of M5 verdict): once confirmed working, the next implementation phase (Phase 65 or new ignore-pack phase) should add `.warpindexingignore` at repo root to focus indexing on high-value docs and exclude `.planning/metrics/*.jsonl`, `.planning/archive/superseded/*`, `docs/reports/*.html`, and other large generated artifacts. This finding is recorded in Phase 63 RESEARCH Section E.1.
