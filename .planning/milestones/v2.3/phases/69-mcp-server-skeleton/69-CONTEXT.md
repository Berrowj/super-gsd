---
phase: 69
phase_name: MCP Server Skeleton
milestone: v2.3
roadmap: warp-integration
created: 2026-04-29
operator: user
status: in-progress
deviation_from_standard: standard 10-step (code phase, FULL tier ATC)
---

# Phase 69 -- MCP Server Skeleton (CONTEXT)

## Goal

Implement the MCP stdio server shell at `super-gsd/tools/warp-mcp/server.cjs`
against the Phase 68 contract. 14 tool stubs return `NOT_YET_IMPLEMENTED`
degraded envelope; Phase 70/71 fill in real logic. Phase 69 ships:

- Raw JSON-RPC 2.0 over stdin/stdout (no @modelcontextprotocol/sdk dep).
- Tool registration + dispatch loop.
- Universal envelope per Phase 68 contract.
- Fixture loader + matcher engine.
- `--self-test` CLI flag delegating via `run-self-test.cjs` thin shell.
- Lock-13 try/catch never throws across stdio boundary.
- READ-ONLY + ASCII-only invariants per upgrade-drift / warp-doctor pattern.

## Locked Scope

- 14 tool names match Phase 68 contract verbatim (frozen TOOL_NAMES array len=14).
- ERROR_CODES frozen len=11 per Phase 68.
- Schema version 1 stamped at envelope level + exposed via `schema_version` request.
- Stubs return `{ok: false, _degraded: true, error_code: "internal_error_degraded", error_message: "Phase 70/71 implements"}` until filled in.
- Self-test must verify: 14 frozen tool names; 11 frozen error codes; bad-tool-name returns `unknown_tool_name`; bad input shape returns `invalid_input_schema`; READ-ONLY scan zero hits; ASCII-only.
- Fixture loader walks `super-gsd/tools/warp-mcp/fixtures/*/{scenario}.input.json` and returns matching `.expected.json` pairs.

## Inputs Consumed

- `super-gsd/docs/SGSD-WARP-MCP-CONTRACT.md` (Phase 68; locked)
- `super-gsd/tools/warp-mcp/fixtures/README.md` (Phase 68; fixture shape)
- `super-gsd/tools/warp-doctor/check.cjs` (Phase 67 pattern source)
- `super-gsd/tools/upgrade-drift/check.cjs` (Phase 62 pattern source)
- `super-gsd/tools/upgrade-drift/run-self-test.cjs` (thin shell pattern)

## Outputs

- `super-gsd/tools/warp-mcp/server.cjs` (NEW)
- `super-gsd/tools/warp-mcp/run-self-test.cjs` (NEW; thin shell)
- 5 Phase 69 standard artifacts

## Acceptance

1. `node super-gsd/tools/warp-mcp/run-self-test.cjs` exits 0.
2. Server starts over stdio (verify: `echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node server.cjs` returns 14 tools).
3. Bad inputs return degraded envelope (no throws).
4. READ-ONLY invariant: zero fs-write tokens (built via concat to avoid self-match).
5. ASCII-only.
6. 14 tool stubs each return `NOT_YET_IMPLEMENTED` envelope.
7. `git diff --stat` after Phase 69 close shows additions only under
   `super-gsd/tools/warp-mcp/` + Phase 69 artifacts.
