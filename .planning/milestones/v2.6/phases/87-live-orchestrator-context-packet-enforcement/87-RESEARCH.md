---
phase: 87
artifact: research
authored_by: orchestrator (Opus); code by gsd-executor (Sonnet) agentId abe424dffcb881746
operator_override: 2026-04-29T21:35Z (item 4 — auto-create + ship the wire-in)
---

# Phase 87 -- Research

## Sources

- Phase 86 detection layer (substrate)
- Phase 42 token-waste/check.cjs (CLI verified — has --milestone flag)
- Phase 45 context-packet/build.cjs (LIBRARY-only, no CLI — wired via require())
- Phase 74 ORCHESTRATOR-LIVE.jsonl writer (token_threshold_crossed event sink)
- super-gsd/skills/sgsd-orchestrate/SKILL.md (orchestrator skill — wire-in target)

## Key decisions

### D1 -- orchestrator-hooks.cjs as the dispatch surface

The orchestrator runs as a Claude Code skill (markdown-driven, not Node-driven). The wire-in is a Bash CLI that the orchestrator (Claude Code) invokes between dispatch steps. orchestrator-hooks.cjs exposes 2 commands (`--token-waste-check` / `--context-packet-build`) that wrap the Phase 42/45 tools, emit ORCHESTRATOR-LIVE events, and Lock-13 over subprocess failures.

### D2 -- Phase 45 require() vs spawnSync

Phase 45 build.cjs has no build CLI (only --self-test). orchestrator-hooks.cjs uses require()-based dispatch instead, matching SKILL.md Step 7.5 inline pattern. Documented in hook header.

### D3 -- v2.6 close gate freshness assertion

Phase 86 added the v2_6_debt-row gate. Phase 87 added the freshness assertion: at v2.6 close, spawn warp-doctor and assert context_packet_builder_freshness === PASS (or NOT-APPLICABLE / DEGRADED). MISSING blocks. Verified by self-test legs 7+8.

### D4 -- Crit-backlog row resolutions

After live wire-in shipped:
- `context_packet_builder_dormant` row: open → `accepted-with-debt` (resolved_by: phase_87_01_live_wire_in). Wire-in shipped; freshness probe PASSes; row complaint addressed.
- `context_bench_full_mode_unproven` row: open → `accepted-environmental` (resolved_by: phase_87_01_d87_4). Claude CLI environmentally available but full-mode rerun held to keep Phase 87 commit atomic. Operator may invoke bench as follow-up to flip to `proven`.
- `codex_unavailable` row (codex_unavailable v2_6_debt): remains open. Phase 87 doesn't fix Codex auth. Operator-environmental.

### D5 -- v2.6 close gate live result

Post-Phase-87:
```
milestone_close_gate: v2.6 close gate green (no open v2_6_debt rows match
context_packet_builder_dormant or context_bench_full_mode_unproven;
context_packet_builder_freshness PASS or NOT-APPLICABLE)
EXIT=0
```

v2.6 milestone is NOW eligible for SHIPPED-clean (or SHIPPED-WITH-DEBT-1 reflecting the still-open Codex unavailability row).

## Live smoke results

```
orchestrator-hooks self-test         9/9 PASS (A1-A9)
context-packet-build smoke           ok:true, packet_id=0f051330ad5c68a2
context-packet-log.jsonl mtime       2026-04-28 18:24 -> 2026-04-29 23:19 (delta 28+ hours)
warp-doctor freshness probe          PASS (was MISSING)
token-waste-check smoke              ok:true, verdict=ok, totals 0/0/0/0
sgsd-complete-milestone-self-test    8/8 PASS (was 6; +legs 7+8)
warp-mcp regression                  47/47 PASS
warp-doctor regression               17/17 PASS
cockpit-state regression             19/19 PASS
v2.6 close gate                      exit 0 green
```

## Forward references

- Phase 88 (End-to-End Warp Operator Drill) is now unblocked.
- v2.6 milestone close: ready for `node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.6` (currently exits 0 green).
- v2.7 controlled-actions (Phase 89+): can extend orchestrator-hooks.cjs with write-capable hooks behind operator confirmation gates.
- v1.9 context-bench full-mode rerun: operator-led follow-up to flip `accepted-environmental` to `proven`.
