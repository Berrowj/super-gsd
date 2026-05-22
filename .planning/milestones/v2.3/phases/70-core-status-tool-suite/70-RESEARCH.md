---
phase: 70
artifact: research
created: 2026-04-29
operator: user
authored_by: orchestrator (Opus); code authored by gsd-executor (Sonnet) agentId a98f98d2cb60b457f
---

# Phase 70 -- Research

## Pattern source

- Phase 69 server.cjs (stubs + dispatcher) -- the substrate.
- Phase 67 warp-doctor _findPowerShellProfile / _readWarpWorkflowsList helpers -- pattern for read-only `.planning/` source readers.
- STATE.md frontmatter shape (this very session, after my edits) -- source of truth for the parser.

## Key design decisions

### D1 -- Single shared `_parseStateFrontmatter` helper

5 of the 5 implemented tools read STATE.md. Without a shared parser
each tool would re-implement the YAML-like frontmatter walk, leading
to drift. The shared helper is internal-only (not exported); takes a
`planningDir` arg so fixtures can synthesise alternate roots.

### D2 -- Shared `_tailJsonl(path, n)` helper

Pulse log + watchdog + future Phase 71 ledger tail tools all need
last-N-rows JSONL reads with parse-error tolerance. Shared helper
prevents per-tool drift.

### D3 -- Fixture synthesis via `_synthetic_planning_*` directories

Phase 68 fixtures README anticipated this: `fixture_planning_dir`
arg overrides the actual `.planning/` root. Executor shipped synthetic
trees alongside fixture pairs so the matcher can exercise tools
end-to-end without polluting live state. Fixture loader correctly
skips these dirs (only `*.input.json` triggers pair detection).

### D4 -- selfTest A6 scope narrowed (Phase 69 -> Phase 70)

A6 originally asserted ALL 14 stubs return Phase-70/71 degraded
envelope. Phase 70 implements 5 of them, so A6 must narrow to the
remaining 9 unimplemented stubs. Executor retargeted A15 similarly.
This is a correctness fix, not scope expansion. Phase 71 will narrow
A6 again to 0 stubs (all tools real).

### D5 -- Roadmap-complete state handling

When `current_phase: complete` is in STATE.md (the v1.6-v2.1 case
preserved historically + the v2.2 ALL-PHASES-CLOSED case live now),
tools 1 + 2 must NOT return a false phase number. Verified A17 +
fixture roadmap-complete. Tool 11 falls back to STATE.md milestone_status
text when no checkpoint exists.

## Live test data captured

```
sgsd_current_state         milestone=v2.2 current_phase=complete current_phase_status=ALL-PHASES-CLOSED
sgsd_milestone_status v2.2 total=5 completed=5 percent=100 phase_summary len=5 (63/64/65/66/67)
sgsd_watchdog_status       watchdog_state=alive recent_pulses len=10 last_pulse_age_seconds=627
sgsd_recovery_packet       next_unlock.from=state resume_command=/sgsd-orchestrate go
```

The `watchdog_state=alive` (vs the contract's "absent" expectation
on this checkout) means autopilot-watchdog.json IS present (operator
has a parallel cockpit running). `last_pulse_age_seconds=627` is the
gap since I last appended a pulse row at iteration 5 entry — rough
timestamp consistency.

## Deviations note

Both executor deviations (A6 scope + synthetic planning dirs) are
correctness fixes within the task's bounds. Not scope expansion. PASS
verdict on Phase 70.
