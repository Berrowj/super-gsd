---
phase: 70
phase_name: Core Status Tool Suite
milestone: v2.3
roadmap: warp-integration
created: 2026-04-29
operator: jack.berrow
status: in-progress
deviation_from_standard: standard 10-step (code phase, FULL tier ATC)
---

# Phase 70 -- Core Status Tool Suite (CONTEXT)

## Goal

Replace 5 stubs in `super-gsd/tools/warp-mcp/server.cjs` with real
implementations:

1. `sgsd_current_state` — STATE.md frontmatter parser
2. `sgsd_current_phase` — STATE.md + active phase folder enumeration
3. `sgsd_milestone_status` — STATE.md progress block + `{milestone}_complete:` block parser
4. `sgsd_watchdog_status` — autopilot-watchdog.json + orchestrator-pulse.jsonl tail
11. `sgsd_recovery_packet` — ORCHESTRATOR-CHECKPOINT.md or STATE.md fallback (4-block packet)

Phase 71 implements the remaining 9 (gates / agents / codex / tokens /
context-bench / commits / cockpit-snapshot / artifact-links / warp-doctor).

## Locked Scope

- Replace stubs only. Don't touch the dispatcher / matcher engine /
  selfTest scaffolding from Phase 69.
- Each tool's implementation must:
  - Tolerate missing source files (`fs.existsSync` guards; degraded envelope on miss).
  - Tolerate unparseable source files (try/catch; degraded envelope).
  - Match the contract envelope per Phase 68 SGSD-WARP-MCP-CONTRACT.md.
  - Pass at least 1 happy-path fixture + 1 degraded-path fixture.
- Per-tool fixtures shipped under
  `super-gsd/tools/warp-mcp/fixtures/{tool}/{scenario}.{input,expected}.json`
  per Phase 68 fixture README.
- selfTest gains 5 assertions (one per tool): A16-A20.

## Inputs Consumed

- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` -- tools 1, 2, 3, 4, 11 spec
- `super-gsd/tools/warp-mcp/server.cjs` (Phase 69) -- existing stubs + scaffolding
- `super-gsd/tools/warp-mcp/fixtures/README.md` (Phase 68) -- fixture shape
- `.planning/STATE.md` -- live source for tools 1, 2, 3
- `.planning/metrics/autopilot-watchdog.json` (if present) -- source for tool 4
- `.planning/metrics/orchestrator-pulse.jsonl` -- source for tool 4
- `.planning/ORCHESTRATOR-CHECKPOINT.md` (if present) -- source for tool 11

## Outputs

- `super-gsd/tools/warp-mcp/server.cjs` (UPDATED -- 5 stubs replaced)
- `super-gsd/tools/warp-mcp/fixtures/sgsd_current_state/{happy,state-md-missing}.{input,expected}.json` (NEW)
- `super-gsd/tools/warp-mcp/fixtures/sgsd_current_phase/{active,roadmap-complete,phase-folder-missing}.{input,expected}.json` (NEW)
- `super-gsd/tools/warp-mcp/fixtures/sgsd_milestone_status/{happy,unknown-milestone}.{input,expected}.json` (NEW)
- `super-gsd/tools/warp-mcp/fixtures/sgsd_watchdog_status/{alive,absent}.{input,expected}.json` (NEW)
- `super-gsd/tools/warp-mcp/fixtures/sgsd_recovery_packet/{checkpoint-present,no-checkpoint-state-fallback}.{input,expected}.json` (NEW)
- 5 Phase 70 standard artifacts

## Acceptance

1. `node super-gsd/tools/warp-mcp/run-self-test.cjs` exits 0 with at
   least 20 assertions PASS (15 from Phase 69 + 5 new for tools 1-4, 11).
2. Live stdio call against THIS checkout for each of the 5 tools
   returns `ok: true` with realistic data (e.g.,
   `sgsd_current_state` returns milestone `v2.2`).
3. Each tool's fixture pairs PASS via the matcher engine.
4. READ-ONLY invariant preserved (stdio dispatch byte-identical git status).
5. `roadmap-complete` fixture for `sgsd_current_phase` returns helpful
   answer (`current_phase: "complete"`), not false active phase.
6. Recovery packet includes exact resume command in the `resume_command`
   field when checkpoint is present.
