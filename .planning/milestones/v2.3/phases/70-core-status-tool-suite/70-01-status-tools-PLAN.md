---
plan_id: 70-01
phase: 70
title: Core Status Tool Suite (5 tools)
type: code (FULL tier)
created: 2026-04-29
status: ready-for-execution
schema_version: 1
expected_ATC_tier: full
model: sonnet
files_touched:
  - super-gsd/tools/warp-mcp/server.cjs
  - super-gsd/tools/warp-mcp/fixtures/sgsd_current_state/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_current_phase/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_milestone_status/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_watchdog_status/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_recovery_packet/
---

# Plan 70-01 -- Core Status Tool Suite

## Tasks

| # | Task | Acceptance |
|--:|---|---|
| 1 | Implement `sgsd_current_state` -- STATE.md frontmatter parser | Returns milestone, milestone_name, milestone_status, status, last_updated, last_activity, current_phase, current_phase_status. Live test on this checkout returns `milestone: "v2.2"` |
| 2 | Implement `sgsd_current_phase` -- STATE.md + phase folder enumeration | Returns phase, phase_name, milestone, status, close_commit, plans[], deferred_count, deferred_summary. Handles roadmap-complete state with `current_phase: "complete"` not false active phase |
| 3 | Implement `sgsd_milestone_status` -- progress block parser | Returns milestone, total_phases, completed_phases, percent, phase_summary[], shipped_status. Handles unknown milestone -> degraded with helpful error |
| 4 | Implement `sgsd_watchdog_status` -- pulse + watchdog reader | Returns watchdog_state, last_pulse_ts, last_pulse_age_seconds, recent_pulses[]. Both files missing -> watchdog_state="absent" ok:true |
| 5 | Implement `sgsd_recovery_packet` -- 4-block packet | Returns current_position, watchdog_state, next_unlock {from: "checkpoint" or "state", text}, resume_command. Checkpoint absent -> falls back to STATE.md frontmatter |
| 6 | Ship fixture pairs per tool | 2-3 scenarios per tool: happy + degraded variants |
| 7 | Add selfTest assertions A16-A20 (one per tool: live happy-path, fixture-pair pass) | 20+/20+ PASS |
| 8 | Run live stdio tests on this checkout for each tool | All 5 return ok:true with realistic data |
| 9 | Verify READ-ONLY invariant via git status before/after | byte-identical |
| 10 | Atomic commit | `feat(p70-01): implement 5 core status tools (1, 2, 3, 4, 11)` |

## Frontmatter parser

The 5 status tools all read `.planning/STATE.md` frontmatter (between
the two `---` lines at top of file). Implement a single shared
internal helper `_parseStateFrontmatter(planningDir)` that:

1. Reads STATE.md if present.
2. Extracts content between `---\n` and `\n---\n` at file head.
3. Parses lines as `key: value` (handle quoted values; multi-line
   values like `current_phase_name:` followed by indented text;
   nested `progress:`/`roadmap_run:` blocks via simple indent tracker).
4. Returns flat object + nested objects for `progress` and `roadmap_run`.
5. Lock-13 wrapped: missing/unparseable -> returns null.

This avoids 5 tools each parsing the same file 5 different ways.

## Pulse JSONL tail reader

`sgsd_watchdog_status` reads `orchestrator-pulse.jsonl` (potentially
large; just-appended this very session). Implement
`_tailJsonl(path, n)` that:

1. Reads file if present.
2. Splits by lines, takes last `n`, JSON.parse each.
3. Skips parse errors (silently — don't fail the whole tool).
4. Returns array.
5. Lock-13 wrapped.

## Surgical Constraint

Touch only the 5 stub functions (`_tool_sgsd_current_state` etc.) and
the shared internal helpers. Don't refactor Phase 69 dispatcher /
matcher / selfTest scaffolding. Don't add new public API surfaces.
Don't introduce a YAML parser dep.

## Out of scope

- Other 9 tools (Phase 71).
- Redaction (Phase 72).
- Paging / cursor (Phase 71).
