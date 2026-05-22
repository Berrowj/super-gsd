---
phase: 63
phase_name: Warp Capability Smoke Test
milestone: v2.2
roadmap: warp-integration
created: 2026-04-29
operator: user
status: in-progress
deviation_from_standard: docs-only / evidence-only phase (no per-dispatch ATC, no MUDA trigger)
---

# Phase 63 — Warp Capability Smoke Test (CONTEXT)

## Why This Phase Comes First

The previous SGSD Warp layout spec (2026-04-11) assumed Windows Warp could not
script pane control and recommended WSL+tmux. Warp went open source on
2026-04-28 and the public roadmap now lists future Warp CLI / tmux control
mode / wrapper-command detection. Before the v2.2-v2.8 roadmap commits to any
implementation it must prove **what current Warp on this machine actually
does**, not what historical docs say it should do.

## Goal

Produce direct, terminal-derivable evidence for as many Warp behaviors as
possible. Where a fact is UI-bound and not provable from terminal, record it
explicitly as MANUAL-CHECK-REQUIRED rather than speculating PASS.

## Locked Scope

- Pure evidence collection. No implementation.
- No edits to `WARP.md`, `.warp/workflows/*`, `super-gsd/scripts/*`, or any
  other production file inside this phase.
- No new code created here — fixes go in Phase 64+.
- Findings feed Phase 64 (workflow pack completion), Phase 67 (warp-doctor),
  and Phase 68+ (read-only MCP contract).

## Inputs Consumed

- `.planning/milestones/warp-integration/CLAUDE-HANDOVER.md`
- `.planning/milestones/warp-integration/ROADMAP.md`
- `.planning/analyses/2026-04-29-warp-ecosystem-atlas.md`
- `.planning/analyses/2026-04-29-sgsd-warp-convergence-audit.md`
- `.planning/analyses/2026-04-29-sgsd-warp-native-research-plan.md`
- `.planning/analyses/2026-04-29-sgsd-warp-incorporation-plan.md`
- `WARP.md`
- `docs/superpowers/specs/2026-04-11-sgsd-warp-layout-design.md`
- `.planning/STATE.md` (post-v2.1 ROADMAP COMPLETE)
- Operator GitHub reference: `https://github.com/warpdotdev/warp` (saved for
  Phase 96 upstream issue/spec sourcing; not consumed in this phase)

## Outputs Required

- `.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-CONTEXT.md` (this file)
- `.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-RESEARCH.md`
- `.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-01-warp-capability-evidence-PLAN.md`
- `.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-VERIFICATION.md`
- `.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-ATC-REVIEW.md`
- `.planning/milestones/v2.2/WARP-SMOKE.md` (operator-facing evidence matrix)
- `.planning/milestones/v2.2/MANUAL-CHECKS.md` (UI-bound items that need operator confirmation)

## Acceptance

1. Evidence matrix in `WARP-SMOKE.md` records direct terminal evidence per row
   OR explicitly marks the row MANUAL-CHECK-REQUIRED. No silent passes.
2. Every UI-bound check the operator must perform appears in `MANUAL-CHECKS.md`
   with concrete steps (not "open Warp and look").
3. The phase commits no source-code mutations to `super-gsd/`, `.warp/`, or
   `WARP.md`. Discoveries that imply edits become Phase 64+ tickets here.
4. `git diff --stat` after this phase shows additions only under
   `.planning/milestones/v2.2/`.

## Hard Boundaries (from operator brief)

- Rule 14: If a Warp UI fact cannot be proven from terminal, record it as
  MANUAL-CHECK-REQUIRED rather than pretending it passed.
- Rule 8: Do not patch Warp source until local integration proves an upstream
  need. (No upstream contribution proposed in this phase.)
- Rule 3: Preserve existing `sg` behavior — empirically verified TRUE in
  Phase 63 (this very Claude session is `sg`-launched and stays in the
  invoking PowerShell).
- Rule 6: VTP/private KB optionality — out of scope here; Phase 63 makes no
  VTP probes.

## Decisions Locked At Phase Open

- D63.1: Use the live Claude/Warp session this Phase 63 work is running in
  as direct evidence for the `sg`-launched-Claude topology.
- D63.2: Record `sgsd-token-current.yaml` workflow shape divergence as a
  Phase 64 input, not a Phase 63 fix.
- D63.3: Defer Codebase Context "is it indexing?" UI verification to
  `MANUAL-CHECKS.md` — Warp does not expose indexing state via env or
  filesystem.
- D63.4: Defer launch-config-into-active-window check to `MANUAL-CHECKS.md` —
  the launch_configurations directory is empty and the operator must place
  a fixture YAML to test it.
- D63.5: WSL/tmux Codebase Context implications taken from official Warp
  docs (Codebase Context disabled in WSL/SSH sessions); local probe
  not needed because we already prefer native Windows PowerShell on this
  machine.
