---
phase: 77
phase_name: Cockpit 2.0 Warp Layout
milestone: v2.4
created: 2026-04-29
status: in-progress
deviation_from_standard: code+docs (tight scope to avoid touching operator parallel work in 3 .ps1 panes)
---

# Phase 77 -- Cockpit 2.0 Warp Layout (CONTEXT)

## Goal

Ship a NEW PowerShell helper that renders the Phase 76 adapter's
10-section snapshot in a Warp-friendly table. Existing 3 cockpit panes
(sgsd-mission-control.ps1, sgsd-narrative.ps1, sgsd-codex-monitor.ps1)
have substantial operator-parallel-work modifications in flight; Phase
77 does NOT modify them. Operators wire the new helper in at their pace.

## Locked Scope (D77.1-D77.4)

- D77.1: New file: `super-gsd/scripts/lib/render-cockpit-snapshot.ps1`.
  ~150 lines. Calls `node super-gsd/tools/cockpit-state/adapter.cjs --json`,
  parses the envelope, renders 10 sections to console with empty-state
  handling.
- D77.2: PowerShell parser check (`PSParser::Tokenize`) returns 0 errors.
  Verified at phase close.
- D77.3: Existing 3 cockpit .ps1 scripts UNTOUCHED. Operator-parallel-work
  (uncommitted modifications to mission-control + narrative + codex-monitor
  + cockpit-shell.cjs) preserved verbatim.
- D77.4: Helper supports `-ProjectDir`, `-Section <name>` (filter to one
  section), `-Json` (pass-through raw JSON for piping), `-Help`.

## Inputs

- super-gsd/tools/cockpit-state/adapter.cjs (Phase 76)
- super-gsd/docs/OPERATOR-QUESTION-MODEL.md (Phase 73 — 12 questions / 10 sections)

## Outputs

- super-gsd/scripts/lib/render-cockpit-snapshot.ps1 (NEW)
- 5 Phase 77 standard artifacts

## Acceptance

1. PowerShell parser check passes (0 errors).
2. `powershell -NoProfile -Command "& super-gsd/scripts/lib/render-cockpit-snapshot.ps1 -ProjectDir 'C:/Users/user/GSDedits'"` exits 0 with 10 sections rendered.
3. `-Section blockers` filters to one section.
4. `-Json` returns raw adapter output.
5. Empty section data shows empty-state placeholder, not crash.
6. No modifications to existing 3 cockpit .ps1 scripts (git diff confirms).
