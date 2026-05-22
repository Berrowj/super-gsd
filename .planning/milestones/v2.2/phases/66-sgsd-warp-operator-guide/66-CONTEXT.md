---
phase: 66
phase_name: SGSD Warp Operator Guide
milestone: v2.2
roadmap: warp-integration
created: 2026-04-29
operator: user
status: in-progress
deviation_from_standard: docs-only (no pattern-mapper, no MUDA, ATC docs-only LITE)
unblocked: dispatched per Rule 15 ("continue with non-blocked work where possible") -- guide ships authored content; M1 verifies UI behaviour the guide describes (post-ship validation)
---

# Phase 66 -- SGSD Warp Operator Guide (CONTEXT)

## Goal

Author the practical user guide for using SGSD in Warp on Windows.
End-to-end coverage from blank Warp session through autonomous run
through safe off-machine monitoring. Separates Warp UX (operator
surface) from SGSD execution truth (`.planning/`).

## Locked Scope (D66.1-D66.5)

- **D66.1**: Output is `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md`
  authored as a single coherent doc. Roadmap-required sections: What
  Warp adds over PowerShell / Daily start / Full auto run / Recovery /
  Gate triage / Code review / Remote monitoring / Safe sharing /
  VTP/private KB optionality / Plain PowerShell fallback / What to
  ask Warp Agent / What not to ask Warp Agent to override.
- **D66.2**: Concrete Windows paths from this machine -- not
  `<PROJECT_DIR>` placeholders. The guide must be runnable verbatim by
  the operator on this checkout. Other-install adaptation lives in
  README.md (Phase 61 work).
- **D66.3**: VTP/private KB optionality is a first-class section
  (operator brief Rule 6). Guide must acknowledge non-operator installs
  and reference the Phase 48 selective-bridge contract.
- **D66.4**: Daily-routine TL;DR at the bottom. Operator should be
  able to read just the TL;DR section and execute the full daily loop.
  The rest is reference + edge-case material.
- **D66.5**: Cross-link to all Phase 63-67 deliverables: WARP-SMOKE.md,
  MANUAL-CHECKS.md, AGENTS.md, SGSD-WARP-WORKFLOWS.md, warp-doctor,
  warp-workflow-lint. The guide is the operator's entry point that
  routes to specific tools.

## Inputs Consumed

- `.planning/milestones/warp-integration/ROADMAP.md` Phase 66 task list
- `.planning/analyses/2026-04-29-warp-ecosystem-atlas.md` (Layer 3 / Layer 4)
- `.planning/analyses/2026-04-29-sgsd-warp-convergence-audit.md` (Operator Scenarios A-E)
- `.planning/milestones/v2.2/WARP-SMOKE.md` (cross-linked from guide)
- `.planning/milestones/v2.2/MANUAL-CHECKS.md` (cross-linked from guide)
- `WARP.md` + `AGENTS.md` (cross-linked from guide)
- `super-gsd/docs/SGSD-WARP-WORKFLOWS.md` (Phase 64 -- guide cites
  the workflow names)
- `super-gsd/tools/warp-doctor/check.cjs` (Phase 67 -- guide tells
  operator how to invoke)
- README.md (referenced; Phase 61 ships the user-facing What This
  Repo Is For section)

## Outputs

- `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` (NEW)
- Phase 66 standard artifacts: 66-CONTEXT.md (this), 66-01-...-PLAN.md,
  66-RESEARCH.md, 66-VERIFICATION.md, 66-ATC-REVIEW.md

## Acceptance

1. `super-gsd/docs/SGSD-WARP-OPERATOR-GUIDE.md` exists at the
   documented path.
2. All 12 roadmap-required sections present:
   - What Warp Adds Over Plain PowerShell
   - Daily Start
   - Full Auto Run
   - Recovery
   - Gate Triage
   - Code Review
   - Remote Monitoring
   - Safe Sharing Checklist
   - VTP / Private KB Optionality
   - Plain PowerShell Fallback
   - What To Ask Warp Agent
   - What NOT To Ask Warp Agent To Override
3. Concrete Windows paths in Reference Paths On This Machine table
   (>= 10 paths).
4. TL;DR Operator Routine section at end (5-section daily loop).
5. Cross-references to Phase 63-67 deliverables verifiable via grep.
6. New user can follow it from blank Warp session to SGSD status
   (manual check -- documented as part of M1+M2+M3 coverage; the
   guide itself is the artifact).

## Hard Boundaries

- AGENTS.md hard rule 5 (no source mutations outside an active plan):
  Phase 66 IS the active plan; touches `super-gsd/docs/` + own Phase
  66 artifacts only.
- Operator brief Rule 13 (docs phases include concrete file paths and
  acceptance checks): guide includes >= 10 concrete paths + each
  workflow / tool referenced by exact path.
- Operator brief Rule 6 (VTP optional): explicit section in guide.
- Operator brief Rule 14 (UI-bound facts cannot be silently passed):
  guide tells operators where to find M1-M5 manual checks and the
  Phase 63 evidence matrix.

## Out Of Scope

- Modifying README.md (Phase 61 owns the user-facing content; this
  guide is operator-facing, not user-facing).
- Modifying WARP.md / AGENTS.md (cross-references are sufficient).
- Authoring `.warpindexingignore` (separate phase).
- Building MCP server documentation (v2.3+).

## Decisions Locked At Phase Open

- D66.6: Phase 66 dispatched per operator Rule 15 despite original
  "partially blocked on M1" tag. Same rationale as Phase 64 D64.6 --
  the guide ships authored content; M1's UI verification confirms
  what the guide describes (Daily Start section's utility-bar claim,
  Workflow Search discoverability section). If M1 fails, guide has a
  pointer at MANUAL-CHECKS.md M5 / WARP-SMOKE.md row Q1, and Phase 96
  takes over.
- D66.7: Implementation strategy = orchestrator-authored at Opus.
  Cumulative deviation count this auto-run: 4 (Phase 65 + 67 + 64 + 66).
  Per 67-CONTEXT.md D67.9, the 3-deviation threshold was already
  triggered for operator review at next session. Phase 66 continues
  the pattern; auto-run halts after this commit so operator's review
  point is the next session's first message.
- D66.8: Guide is closing artifact for v2.2. After Phase 66 close, all
  5 v2.2 phases (63 + 64 + 65 + 66 + 67) are PASS. Per orchestrate
  Step 6.7 milestone-complete-auto-trigger fires; auto-run advances
  to dispatch sgsd-complete-milestone OR halts with checkpoint
  pointing at v2.3 Phase 68 + M1-M5. Operator review at next session
  decides which.
