---
plan_id: 71-01
phase: 71
title: Operational Tool Suite (9 tools)
type: code (FULL tier; bigger scope)
created: 2026-04-29
status: ready-for-execution
schema_version: 1
expected_ATC_tier: full
model: sonnet
files_touched:
  - super-gsd/tools/warp-mcp/server.cjs
  - super-gsd/tools/warp-mcp/fixtures/sgsd_gate_status/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_agent_roster/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_codex_status/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_token_spend/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_context_bench_status/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_latest_commits/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_cockpit_snapshot/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_artifact_links/
  - super-gsd/tools/warp-mcp/fixtures/sgsd_warp_doctor/
---

# Plan 71-01 -- Operational Tool Suite

## Tasks

| # | Task | Tool | Acceptance |
|--:|---|---|---|
| 1 | Implement `sgsd_gate_status` | 5 | tail_rows arg (default 10 max 25); reads gate-value-log.jsonl + review-ledger.jsonl; latest_per_gate map; missing both -> degraded with empty array ok:true |
| 2 | Implement `sgsd_agent_roster` | 6 | reads activity-log.jsonl filtered by phase from STATE.md current_phase OR args.phase override; by_agent histogram |
| 3 | Implement `sgsd_codex_status` | 7 | live_state in {absent, stale, running, idle, complete}; mtime > 1h => stale; codex-live.json + codex-log.jsonl tail |
| 4 | Implement `sgsd_token_spend` | 8 | scope arg (current/milestone/all); group_by arg (role/phase/provider); paging on >50KB |
| 5 | Implement `sgsd_context_bench_status` | 9 | reads context-bench-log.jsonl latest run; scenario filter |
| 6 | Implement `sgsd_latest_commits` | 10 | spawnSync git log; count arg (default 10 max 50); 5s timeout |
| 7 | Implement `sgsd_cockpit_snapshot` | 12 | composes 1+2+4+5+6+7+8 sections; partial-data OK; 100KB max |
| 8 | Implement `sgsd_artifact_links` | 13 | filesystem enumeration of phase folders; per-phase file presence map |
| 9 | Implement `sgsd_warp_doctor` | 14 | spawnSync node warp-doctor/check.cjs --json; 10s timeout |
| 10 | Ship 18+ fixture pairs (>=2 per tool) | -- | happy + at least 1 degraded variant per tool |
| 11 | Add selfTest A22-A30 (one per tool live happy-path) | -- | each tool returns ok:true on this checkout |
| 12 | Narrow selfTest A6: stubs remaining now 0 | -- | all 14 tools real |
| 13 | Run live stdio tests for all 9 tools | -- | each returns ok:true with realistic data |
| 14 | Verify READ-ONLY invariant via git status before/after | -- | byte-identical |
| 15 | Atomic commit | -- | feat(p71-01): implement 9 operational tools |

## Critical implementation notes

### Paging contract (tools 5, 7, 8)

Tail-style tools may exceed 50KB if they dump full ledgers. Implement:

```
1. Read full tail rows.
2. Build envelope.
3. JSON.stringify; if length > 50000:
   - Reduce tail_rows to half; rebuild.
   - If still > 50000 with tail_rows=1, set _truncated:true; emit truncated_count; emit next_cursor token (any opaque string; Phase 72+ may extend).
   - Else mark _truncated:false.
```

`next_cursor` is a forward-reference for v2.3.x — Phase 71 ships the
sentinel; consumers (cockpit / Warp Agent) can paginate later.

### Codex freshness

```
if codex-live.json missing: live_state = "absent"
elif mtime > 1h ago: live_state = "stale"
elif state field === "running": live_state = "running"
elif state field === "complete": live_state = "complete"
else: live_state = "idle"
```

### `sgsd_cockpit_snapshot` partial-data

```
const sections = {};
for each subkey [current_state, current_phase, watchdog, gate, agent, codex, token]:
  try {
    const sub = dispatchTool(subkey, {});
    if (sub.ok) sections[subkey] = sub.data;
    else sections[subkey] = { _section_degraded: true, error_code: sub.error_code };
  } catch (e) {
    sections[subkey] = { _section_degraded: true, error_code: "internal_error_degraded" };
  }
return _makeEnvelope("sgsd_cockpit_snapshot", { sections });
```

Snapshot envelope ok:true even if some sub-sections are degraded.
Allows Warp Agent to render a partial cockpit when one ledger is
missing.

### `sgsd_warp_doctor` subprocess

```
const result = spawnSync('node', [
  path.join(projectDir, 'super-gsd', 'tools', 'warp-doctor', 'check.cjs'),
  '--project', projectDir,
  '--json'
], { timeout: 10000, encoding: 'utf8' });
if (result.error) -> degraded subprocess_failed
if (result.status === null) -> degraded subprocess_timeout
parse stdout JSON -> data field
```

### `sgsd_latest_commits` subprocess

```
const result = spawnSync('git', [
  '-C', projectDir,
  'log',
  '--pretty=format:%H%x09%aI%x09%an%x09%s%x09%(diff-tree:r-files-changed)' or simpler,
  `-${count}`,
  '--name-status'
], { timeout: 5000, encoding: 'utf8' });
parse pipe-delimited rows; group by commit; count files_changed;
return commits array.
```

Use NUL-delimited or tab-delimited format string to avoid quote escaping issues.

## Surgical Constraint

Touch only the 9 stub functions + any new shared internal helpers. Don't
refactor selfTest scaffolding or matcher engine. Don't introduce YAML
parser dep. Don't add new public API surfaces beyond the 6 from Phase 69.

## Out of scope

- Redaction (Phase 72).
- Warp MCP config snippet (Phase 72).
- Pagination next_cursor consumer logic (forward to v2.3.x).
