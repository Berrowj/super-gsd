---
phase: 71
phase_name: Operational Tool Suite
milestone: v2.3
roadmap: warp-integration
created: 2026-04-29
operator: user
status: in-progress
deviation_from_standard: standard 10-step (code phase, FULL tier ATC; bigger scope -- 9 tools)
---

# Phase 71 -- Operational Tool Suite (CONTEXT)

## Goal

Implement the remaining 9 stubs in `super-gsd/tools/warp-mcp/server.cjs`,
replacing them with real implementations that read from `.planning/metrics/`
ledgers + git + filesystem enumeration:

5. `sgsd_gate_status` -- gate-value-log + review-ledger tail
6. `sgsd_agent_roster` -- activity-log filtered by current phase
7. `sgsd_codex_status` -- codex-live.json + codex-log tail; freshness rule
8. `sgsd_token_spend` -- token-attribution + agent-token-spend with grouping + paging
9. `sgsd_context_bench_status` -- benchmark log latest-run summary
10. `sgsd_latest_commits` -- git log via spawnSync
12. `sgsd_cockpit_snapshot` -- composes 1+2+4+5+6+7+8 outputs
13. `sgsd_artifact_links` -- per-phase folder enumeration
14. `sgsd_warp_doctor` -- shells out to Phase 67 warp-doctor inline

After Phase 71 close: all 14 tools live; Phase 72 wires redaction +
Warp config + final docs.

## Locked Scope

- Replace 9 stubs only. Keep Phase 69 dispatcher / matcher / selfTest
  scaffolding + Phase 70 shared parsers (`_parseStateFrontmatter`,
  `_tailJsonl`) intact.
- Each tool tolerates missing/unparseable source files -> degraded
  envelope (per Phase 68 contract).
- Tail tools (5, 7, 8) implement `tail_rows` arg with default 10 max 25;
  output paging via `_truncated: true` + `next_cursor` token if
  serialized payload would exceed 50 KB (default per-tool max).
- Codex status freshness: `live_state: "stale"` if codex-live.json
  mtime > 1h; `"absent"` if file missing; `"running"`/`"idle"` from
  state field otherwise.
- `sgsd_cockpit_snapshot` 100KB allowed; partial-data OK
  (`_degraded` per-section if a sub-source fails).
- `sgsd_latest_commits` git timeout 5s; `git_subprocess_failed` /
  `git_subprocess_timeout` error codes per contract.
- `sgsd_warp_doctor` shells out to
  `node super-gsd/tools/warp-doctor/check.cjs --project <dir> --json`;
  10s timeout; rename contract's `git_subprocess_*` to
  `subprocess_failed`/`subprocess_timeout` for the doctor invocation
  (contract footnote in Phase 72).
- Each tool ships >=2 fixture pairs (happy + 1 degraded variant).
- selfTest gains 9 assertions A22-A30 (one per tool).
- selfTest A6 narrows to zero remaining stubs after Phase 71 close
  (Phase 70 narrowed it to 9; Phase 71 narrows to 0).

## Inputs Consumed

- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` -- 9 tool envelope specs
- `super-gsd/tools/warp-mcp/server.cjs` -- Phase 70 substrate
- `super-gsd/tools/warp-mcp/fixtures/README.md` -- fixture shape
- `super-gsd/tools/warp-doctor/check.cjs` -- Phase 67 doctor (tool 14 invokes)
- `.planning/metrics/*.jsonl` -- live sources for tools 5, 6, 7, 8, 9
- git binary on PATH -- spawnSync source for tool 10

## Outputs

- `super-gsd/tools/warp-mcp/server.cjs` (UPDATED -- 9 stubs replaced; A22-A30 added)
- `super-gsd/tools/warp-mcp/fixtures/sgsd_{gate_status,agent_roster,codex_status,token_spend,context_bench_status,latest_commits,cockpit_snapshot,artifact_links,warp_doctor}/...` (NEW; 18+ pairs)
- 5 Phase 71 standard artifacts

## Acceptance

1. `node run-self-test.cjs` exits 0 with 30+ assertions PASS (21 from Phase 69-70 + 9 new).
2. selfTest A6 narrows to zero remaining stubs (or is removed; all tools real now).
3. Live stdio call against this checkout for each of the 9 tools returns realistic data.
4. Token tools do not dump huge ledgers: paging triggers on >50KB output.
5. Codex status correctly reports `absent` / `stale` / `running` / `idle` / `complete` per source state.
6. Agent roster filters by current phase if phase data exists.
7. READ-ONLY invariant preserved.
8. ASCII-only.
9. All 18+ fixture pairs PASS via matcher engine.
