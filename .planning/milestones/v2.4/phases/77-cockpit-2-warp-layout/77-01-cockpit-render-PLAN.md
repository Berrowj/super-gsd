---
plan_id: 77-01
phase: 77
title: Cockpit 2.0 Warp render helper
type: code+docs
expected_ATC_tier: lite
files_touched:
  - super-gsd/scripts/lib/render-cockpit-snapshot.ps1
---

# Plan 77-01

| # | Task | Acceptance |
|--:|---|---|
| 1 | Author render-cockpit-snapshot.ps1 | ~150 lines; CmdletBinding; -ProjectDir / -Section / -Json / -Help |
| 2 | PowerShell parser check | 0 errors via PSParser::Tokenize |
| 3 | Live render -ProjectDir | 10 sections rendered; ok:true |
| 4 | Live render -Section objective | objective section only |
| 5 | Live render -Json | raw adapter envelope |
| 6 | Live render -Help | usage + sections + exit codes |
| 7 | Existing 3 cockpit panes UNTOUCHED | git diff confirms |
| 8 | Atomic commit | feat(p77-01) |

## Out of scope

- Modifying sgsd-mission-control.ps1 / sgsd-narrative.ps1 / sgsd-codex-monitor.ps1 (operator parallel work in flight; defer to v2.4.x or operator-led migration).
- Adding workflow YAML for the new helper (Phase 64 owned 13 workflows; this is a library not a workflow).
