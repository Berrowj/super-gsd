---
plan_id: 69-01
phase: 69
title: MCP server skeleton + 14 tool stubs + self-test
type: code (FULL tier)
created: 2026-04-29
status: ready-for-execution
schema_version: 1
expected_ATC_tier: full
model: sonnet
files_touched:
  - super-gsd/tools/warp-mcp/server.cjs
  - super-gsd/tools/warp-mcp/run-self-test.cjs
---

# Plan 69-01 -- MCP server skeleton + 14 tool stubs

## Task list

| # | Task | Acceptance |
|--:|---|---|
| 1 | Author server.cjs with frozen TOOL_NAMES len=14 + ERROR_CODES len=11 | Both arrays match Phase 68 contract verbatim; both Object.freeze'd |
| 2 | Implement JSON-RPC 2.0 stdio loop (read stdin lines as JSON, dispatch by method, write JSON response) | `tools/list` returns 14 tool names; `tools/call` with name + args dispatches stub; bad JSON returns proper error |
| 3 | Implement universal envelope helper (`_makeEnvelope` / `_makeDegraded`) | Lock-13 wraps; never throws upward |
| 4 | Implement 14 tool stubs each returning NOT_YET_IMPLEMENTED degraded envelope | Stubs registered in TOOL_REGISTRY; selfTest verifies each callable |
| 5 | Implement fixture loader walking fixtures/{tool}/{scenario}.{input,expected}.json | Loads pairs; returns array; missing dir = empty result not throw |
| 6 | Implement matcher engine (literal / `<contains>` / `<regex>` / `<exists>true</exists>`) | Self-test fixture exercises all 4 matchers |
| 7 | Implement `selfTest()` -- 12+ assertions | A1 TOOL_NAMES frozen len=14; A2 ERROR_CODES frozen len=11; A3-A4 bad inputs degrade; A5 each stub returns degraded; A6 READ-ONLY scan zero hits; A7 ASCII-only; A8-A11 matcher engine behaviour |
| 8 | Implement run-self-test.cjs thin spawnSync shell | Delegates `--self-test` to server.cjs |
| 9 | Run `node run-self-test.cjs` -- verify exit 0 + all assertions PASS | green |
| 10 | Run `echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node server.cjs` -- verify 14 tools returned | live stdio test |
| 11 | Verify READ-ONLY invariant via `git status` before/after live stdio test | byte-identical |

## Banned-token list (built via concatenation to avoid self-match)

Same trick as warp-doctor selfTest A8: `'fs.' + 'write' + 'FileSync'` etc.

## JSON-RPC 2.0 minimum protocol

Server reads stdin newline-delimited; each line is a JSON-RPC request:
```
{"jsonrpc":"2.0","method":"tools/list","id":1}
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"sgsd_current_state","arguments":{}},"id":2}
{"jsonrpc":"2.0","method":"schema_version","id":3}
```

Server writes one JSON-RPC response per request to stdout. Errors go in
the `error` field per JSON-RPC spec; tool degraded envelopes go in
`result.data` with `_degraded: true`.

## Surgical Constraint

Mirror warp-doctor structure verbatim where applicable. Departures must
be justified in 69-RESEARCH.md. Tool registry uses a Map<string, fn>
keyed by frozen TOOL_NAMES — Lock 11 enforced via `TOOL_NAMES.indexOf`.

## Out of scope

- Real per-tool implementations (Phase 70/71).
- Redaction (Phase 72).
- Warp MCP config (Phase 72).
- Paging / cursor logic for tail tools (Phase 71).

## Self-test

```
node super-gsd/tools/warp-mcp/run-self-test.cjs
# Expected: 12+ assertions PASS, exit 0

echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node super-gsd/tools/warp-mcp/server.cjs
# Expected: JSON-RPC response with result.tools = [14 tool names]

echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"sgsd_current_state","arguments":{}},"id":2}' | node super-gsd/tools/warp-mcp/server.cjs
# Expected: degraded envelope with error_code=internal_error_degraded, error_message mentioning Phase 70/71
```
