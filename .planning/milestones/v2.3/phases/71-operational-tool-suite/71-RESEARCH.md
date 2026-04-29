---
phase: 71
artifact: research
created: 2026-04-29
operator: jack.berrow
authored_by: orchestrator (Opus); code authored by gsd-executor (Sonnet) agentId ab5fae375166eaccb
---

# Phase 71 -- Research

## Pattern source

- Phase 69 (server skeleton + matcher + selfTest scaffolding) -- substrate.
- Phase 70 (`_parseStateFrontmatter`, `_tailJsonl`) -- shared helpers reused.
- Phase 67 warp-doctor `spawnSync` patterns -- subprocess invocation reference.
- Phase 51 `context-bench-runs.jsonl` -- legacy filename source for tool 9 fallback.
- live `.planning/metrics/*` ledgers (this session and prior) -- source data.

## Key design decisions

### D1 -- Reuse Phase 70 shared helpers; no new public APIs

`_parseStateFrontmatter` consumed by tools 6 (agent_roster fallback to current_phase), 12 (cockpit_snapshot composer), 13 (artifact_links milestone fallback). `_tailJsonl` consumed by tools 5, 6, 7, 9. Zero per-tool drift.

### D2 -- Closed-vocab paging sentinel

Tail tools (5, 7, 8) emit `_truncated: true` + `truncated_count` + `next_cursor` (opaque string) when serialized payload exceeds 50KB. v2.3 ships the sentinel; consumer-side cursor logic is forward-referenced for v2.3.x. Mechanism: try full tail → if size exceeded, halve tail_rows → repeat → at tail_rows=1 with overflow, mark truncated.

### D3 -- Codex freshness rule

`mtime > 1h` → `live_state: "stale"`. Matches Phase 29 v1.6 cockpit Codex pane logic ("demotes a stale codex-live.json to idle regardless of file's state field"). Phase 71 mirrors: stale wins over state.

### D4 -- Cockpit snapshot partial-data composition

When a sub-source fails (codex-log missing, gate-value-log absent, etc.), the affected section is wrapped `{ _section_degraded: true, error_code: "..." }` and the snapshot envelope stays `ok: true`. Allows Warp Agent / cockpit to render available data without all-or-nothing failure. 100KB snapshot limit sufficient for current ledger sizes.

### D5 -- Subprocess timeouts via spawnSync timeout option

Tool 10 (git): 5s. Tool 14 (warp-doctor): 10s. `result.error?.code === 'ETIMEDOUT'` → degraded with timeout error code. status === null also indicates timeout. 5s/10s budget calibrated to current repo size + doctor probe count.

### D6 -- Executor accommodation deviations (3 logged)

1. **sgsd_token_spend scope=current handling for ALL-PHASES-CLOSED**: when current_phase === "complete", scope=current expands to milestone-only filter. Reason: cockpit needs data between phases / at milestone close.
2. **sgsd_context_bench_status fallback to legacy filename**: contract specified `context-bench-log.jsonl` but Phase 51 shipped `context-bench-runs.jsonl`. Fallback added.
3. **Tool 14 timeout uses `internal_error_degraded`**: keeps ERROR_CODES len=11 frozen. Phase 72 will alias `subprocess_timeout` to ERROR_CODES.

All three are correctness fixes that match real `.planning/` ledger reality. Logged in 71-VERIFICATION.md.

## Live test data captured

```
sgsd_latest_commits   5 commits returned; first hash ebfaf7c matches git log -1 (verified)
sgsd_warp_doctor      16 probes returned via spawnSync to Phase 67 doctor
sgsd_cockpit_snapshot 7 section keys (current_state/current_phase/watchdog/gate/agent/codex/token); current_state.milestone=v2.2
sgsd_token_spend      totals.total=30,843,200 (lifetime token attribution across project history)
```

The $30.8M total in token-attribution is the cumulative spend across v1.0-v2.2 and represents months of SGSD's data accumulation.

## Forward references

- Phase 72: redaction implementation across tools 5, 7, 8, 9, 10, 11, 12, 13, 14; Warp MCP config snippet; final SGSD-WARP-MCP-SETUP.md docs.
- v2.4 Phase 76: cockpit-state adapter reuses sgsd_cockpit_snapshot.
- v2.7 Phase 89: write-capable contract (separate, not extending these tools).
