---
phase: 77
artifact: research
created: 2026-04-29
authored_by: orchestrator (Opus)
---

# Phase 77 -- Research

## Pattern source

- Phase 76 adapter --json output (10 sections)
- Existing cockpit .ps1 scripts (sizes: mission-control 2378 lines, narrative 1163, codex-monitor 1524)
- operator-parallel-work modifications in flight on all 3 cockpit panes + cockpit-shell.cjs

## Key decisions

### D1 — Tight scope: NEW helper, no PS1 cockpit refactor

Phase 77 ships only `render-cockpit-snapshot.ps1` as a fresh consumer of the adapter. Existing 3 cockpit panes (5400+ lines combined) carry uncommitted operator parallel work. Touching them would either lose that work or create messy merge surface. The right cadence: operators wire the helper into the panes at their pace; Phase 77 just provides the consumable.

### D2 — JSON pipe via Get-Snapshot helper

`Get-Snapshot` calls `node adapter.cjs --json --project <dir>` via PowerShell `&` operator, captures stdout, ConvertFrom-Json. Returns null on any failure (Lock-13 equivalent for PowerShell — degrades silently rather than throwing).

### D3 — 4 modes via switch params

`-Section <name>` filters; `-Json` raw output; `-Help` usage; default = render all 10 sections with empty-state handling. CmdletBinding wraps standard PowerShell flag parsing.

## Live test data captured

```
PSParser::Tokenize         tokens=779, errors=0
render -Section objective  10 fields rendered (milestone=v2.2, phase=complete, etc.)
```

## Forward references

- Operators: wire `render-cockpit-snapshot.ps1` into existing cockpit panes when ready (out of scope for v2.4 ship; future v2.4.x patch phase).
- Phase 78: launch config templates can reference this helper for cockpit pane content.
- v2.5 Phase 79+: Warp skills can pipe `-Json` output into Warp Agent prompts.
