---
phase: 30
title: Startup Verification + Cockpit Acceptance
type: verification
created: 2026-04-27
discuss_decisions: [30.1]
unblocks: []
mode: gsd-discuss-phase --auto
---

# Phase 30 — Startup + Cockpit Acceptance (CONTEXT)

## Goal

Verify v1.6 cockpit + boot delivers what Phases 26-29 contracted. Final
v1.6 phase. Acceptance evidence package backs the milestone close.

## What's locked (DISCUSS 30.1)

All 8 scenarios mandatory. Fixture-based verification permitted for the 3
hard scenarios (codex-timeout, forced-restart, codex-warned). No
"live-only deferral" — every scenario produces evidence (live or fixture).

## What the planner must produce

ONE plan: `30-01-startup-and-cockpit-acceptance-PLAN.md` with deliverables:

1. **Acceptance scenario matrix execution** — 8 scenarios verified (live or fixture). Reuses Phase 29 F1/F4/F5/F6 where applicable; 4 new fixtures (A1/A2/A7/A8) for live-runnable; 2 fixture-only (codex-timeout, forced-restart).
2. **Boot flag matrix verification** — 7 documented `sg`/`sgsd` flag invocations resolved to `Install-SgsdShortcut.ps1` definitions (static read where Claude-spawning).
3. **Boot timing capture** — `sgsd-boot.ps1 -NoOpen` wall-time via `Measure-Command`.
4. **Dashboard host failure pane verification** — static read of `sgsd-dashboard-host.ps1` Write-DashboardFailure + Hold-Pane.
5. **README + startup guide audit** — surface BOOT-03 gap (the `sg` quick-start block was added to README in run #1, was reset; needs re-adding OR deferred to v1.7 docs phase).
6. **Acceptance evidence file** — `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` with 8 scenarios × evidence pointers.

## Open derivation calls (locked)

1. **README BOOT-03 (Quick Start `sg` block) handling**: per RESEARCH "no
   source edits" rule for verification phase, defer the README edit to
   v1.7 (or explicitly add to BOOT-03 backlog). **Recommendation: defer to
   v1.7 docs work** — Phase 30 records the gap, doesn't fix.
2. **Codex-warned scenario fixture**: Phase 29 has F4 (timed-out) but no
   `warned` (state with non-zero warnings). New A2 fixture creates
   codex-live.json with `state: ready, warning_count: 2`.
3. **Forced-restart fixture**: simulate via STATE.md frontmatter showing
   `roadmap_run.checkpoint_path`; cockpit must surface "resumed at
   checkpoint" via Q8.

## Workflow deviations

- Step 1 (pattern-mapper): SKIPPED (verification phase; no new code patterns)
- Step 6 (executor): produces docs (acceptance evidence + new fixtures)
- Step 7 (MUDA): may fire if fixture file count exceeds threshold; handle
- Step 9 (phase-level ATC): runs (Codex unavail per readiness)

## Status taxonomy at close (anticipated)

`PASS-WITH-DEFERRED-N` where N includes:
- 1 phase-level Codex unavail (per pattern)
- 1 BOOT-03 README deferral (if not fixed in-loop)
- Possibly 1 MUDA WARN if fixture count fires overproduction

## Kill / defer conditions

- Defer if any of the 8 scenarios cannot produce evidence (live or fixture) → escalate
- Defer if boot timing measurement reveals regression (cockpit slower than v1.5) → flag
- Hard stop only if a boot script regression is found that wasn't introduced by Phase 28 (Phase 28 only touched the activity-logger hook, not boot.ps1)
