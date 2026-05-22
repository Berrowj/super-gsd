---
phase: 69
artifact: research
created: 2026-04-29
operator: user
authored_by: orchestrator (Opus) — code authored by gsd-executor (Sonnet) per dispatch policy rebalance for v2.3 code-heavy phases
---

# Phase 69 -- Research

## Pattern source

`super-gsd/tools/upgrade-drift/check.cjs` (Phase 62) -- canonical Lock-13
+ READ-ONLY + ASCII-only + frozen-vocab + selfTest pattern. Phase 69
mirrors structure for the dispatcher; the JSON-RPC 2.0 stdio loop is
new but the surrounding scaffolding follows verbatim.

`super-gsd/tools/warp-doctor/check.cjs` (Phase 67) -- pattern source
for the banned-token-via-string-concat trick (selfTest A10) and the
matcher closed-vocab approach.

## Key design decisions

### D1 -- No MCP SDK dependency

Confirmed via package.json read: zero MCP packages installed. Phase 69
implements raw JSON-RPC 2.0 over stdin/stdout newline-delimited.
Justified: keeps SGSD dependency-light, matches operator brief Rule 4
("plain PowerShell fallback"), and JSON-RPC 2.0 is simple enough
(~50 lines of dispatcher logic) that adding a dep would be net-negative.

### D2 -- Cross-vendor dispatch policy fired

Phase 69 dispatched gsd-executor (Sonnet) per the rebalance plan. The
v2.2 phases were orchestrator-authored at Opus because docs/config/small-tool
work fit Opus's pattern-matching strength. v2.3 Phase 69-71 ships
substantial code (~600+ lines per phase) that fits Sonnet's verbosity
tolerance and unit-test rigour better. Phase 69 is the first dispatch
of this rebalance and validated the approach: 15/15 self-test PASS in
one round.

### D3 -- 14 tool stubs return uniform NOT_YET_IMPLEMENTED degraded envelope

Stubs prevent partial-tool-shipping. Phase 70/71 replace stubs one by
one; until then, every tool call gets a clean degraded envelope with
`error_code: 'internal_error_degraded'` and `error_message` mentioning
Phase 70/71. Warp Agent / cockpit consumers can confidently call any
tool name without crashing.

### D4 -- Matcher engine ships in skeleton (Phase 69) not Phase 70

Locked into Phase 69 because Phase 70/71 fixture tests REQUIRE the
matcher engine. Pulling it forward avoids a Phase 70/71 dependency
hairball. Matcher supports: literal / `<contains>` / `<regex>` /
`<exists>true</exists>`. selfTest A12 verifies all 4.

## Self-test output captured

```
15/15 PASS:
  A1 TOOL_NAMES frozen len=14
  A2 ERROR_CODES frozen len=11
  A3 MATCHER_TYPES frozen len=4
  A4 unknown_tool_name
  A5 invalid_input_schema
  A6 every stub returns NOT_YET_IMPLEMENTED degraded
  A7 tools/list returns 14
  A8 schema_version returns 1
  A9 malformed JSON returns JSON-RPC error
  A10 READ-ONLY invariant (banned tokens via concat; zero hits)
  A11 ASCII-only (first_nonascii_idx=-1)
  A12 matcher engine (literal/contains/regex/exists)
  A13 14 tool names verbatim from contract (additive — DEVIATION)
  A14 loadFixtures missing dir → empty array Lock-13 (additive)
  A15 degraded envelope shape conformance (additive)
```

## Live stdio tests

```
echo {tools/list} | node server.cjs           → 14 tools listed ✓
echo {tools/call sgsd_current_state} | node    → degraded NOT_YET_IMPLEMENTED ✓
echo {schema_version} | node                   → schema_version=1 ✓
git status before/after                        → byte-identical ✓
```

## Forward references

- Phase 70: implement 5 status tools (1, 2, 3, 4, 11) replacing stubs.
- Phase 71: implement 9 operational tools + paging.
- Phase 72: redaction implementation + Warp MCP config snippet.
