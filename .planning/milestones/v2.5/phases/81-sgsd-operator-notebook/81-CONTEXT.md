---
phase: 81
phase_name: SGSD Operator Notebook Source
milestone: v2.5
created: 2026-04-29
status: in-progress
deviation_from_standard: docs phase
---

# Phase 81 -- CONTEXT

Author `super-gsd/docs/SGSD-WARP-NOTEBOOK.md` with runnable command blocks
operators can import into Warp Drive Notebooks.

## Locked Scope

- D81.1: 9+ runnable PowerShell blocks covering: daily start / auto mode /
  status / token summary / gate status / recovery / remote monitor /
  warp-doctor / mcp self-test / cockpit render.
- D81.2: Each block uses LITERAL paths (`C:\Users\user\GSDedits`),
  not placeholders. Operator brief Rule 13.
- D81.3: Import-to-Warp-Drive instructions + export-back instructions.
- D81.4: Cross-references to OPERATOR-GUIDE / WORKFLOWS / MCP-SETUP /
  MCP-CONTRACT / AGENTS.md.

## Outputs
- super-gsd/docs/SGSD-WARP-NOTEBOOK.md
- 5 Phase 81 artifacts

## Acceptance
1. 9+ runnable blocks present.
2. Each block tested copy-paste-runnable from this machine.
3. Import/export instructions for Warp Drive.
4. Cross-references resolve.
