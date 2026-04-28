---
schema_version: 2
phase: 48
plan: 01
name: Selective VTP Bridge
milestone: v1.9
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/tools/vtp-bridge/classify.cjs
  - super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json
  - super-gsd/tools/dispatch-router/routes.yaml
  - super-gsd/scripts/lib/route-ledger.cjs
  - super-gsd/skills/sgsd-orchestrate/SKILL.md
autonomous: true
requirements:
  - VTPR-01
  - VTPR-02
  - VTPR-03
  - VTPR-04
  - VTPR-05
  - VTPR-06
  - LOCK-11
  - LOCK-13
tags:
  - vtp
  - bridge
  - mcp
  - evidence-packet
  - failure-isolation
  - v1.9
  - phase-48
user_setup: []

must_haves:
  truths:
    - "local implementation phases do NOT call VTP by default; non-whitelist uncertainty_type returns {ok:false, reason:'not_routed_to_vtp'} with no MCP call (A1, VTPR-05)"
    - "research-paper, book, prior-project, and architecture-challenge dispatches CAN call VTP via the 4-entry frozen VTP_TOOL_MAP (3 active + 1 reserved 'research_external_validation') (A2, VTPR-02)"
    - "MCP failures (timeout, auth, validation, unreachable, internal) append a row to .planning/metrics/vtp-bridge-failures.jsonl and NEVER appear inside evidence_packet.results[] (A3, VTPR-03)"
    - "evidence_packet is source-backed (every result has doc_id + citation; provenance gate mirrors Phase 45 PACKET-13) AND compact (default 5000-token cap, descending-relevance elision) (A4, VTPR-04)"
    - "VTP routing is gated ONLY by uncertainty_type closed-enum + structural Phase 47 VTP_WHITELIST; no embedding/similarity_score/fuzzy_match/cosine input field is accepted (A5, LOCK-11, VTPR-06)"
    - "every bridge call also emits ONE envelope-v1 row to route-decisions.jsonl with boundary='vtp_bridge' via Phase 32 logRouteDecision (no new ledger; EXISTING-SURFACE-AUDIT:139)"
    - "Phase 32 BOUNDARIES enum extends 8->9 by adding 'vtp_bridge' (closed-enum extension; mirrors Phase 47 7->8 'dispatch_route' precedent)"
    - "selectiveVTPCall, classify helpers, and _callVtpTool NEVER throw upward; Lock 13 wrapper returns {ok:false, reason_codes:['bridge_internal_error']} sentinel on any internal error"
    - "Phase 45 source (super-gsd/tools/context-packet/build.cjs) is NOT mutated; wire-in is caller-side composition via selectiveVTPCallForPacket helper or orchestrator-side composition"
    - "Phase 47 VTP_WHITELIST is imported BY REFERENCE for defense-in-depth re-check; bridge does NOT redefine the whitelist"
    - "self-test passes 10/10 assertions in <5s with no canonical-stream mutation (read-only invariant; F10 fingerprint diff)"
    - "Phase 32 route-ledger self-test grows 14->15 to cover new 'vtp_bridge' boundary"
  artifacts:
    - path: "super-gsd/tools/vtp-bridge/classify.cjs"
      provides: "selectiveVTPCall + selectiveVTPCallForPacket + frozen VTP_TOOL_MAP (4 entries; 3 active + 1 reserved) + EVIDENCE_PACKET_REASON_CODES + FAILURE_KINDS + Lock-13 wrapper + _validateInput + _buildEvidencePacket + _assertResultProvenance + _logVtpBridgeFailure + _emitRouteLedgerRow + 10-assertion _runSelfTest + CLI (--bridge / --self-test)"
      min_lines: 600
      contains: "Object.freeze"
      exports:
        - "selectiveVTPCall"
        - "selectiveVTPCallForPacket"
        - "VTP_TOOL_MAP"
        - "VTP_BRIDGE_REASONS"
        - "FAILURE_KINDS"
        - "EVIDENCE_PACKET_MAX_TOKENS_DEFAULT"
        - "PER_QUERY_TIMEOUT_MS_DEFAULT"
        - "COMMAND_NAME"
        - "ENVELOPE_VERSION"
    - path: "super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json"
      provides: "Manual JSON-shape doc for evidence_packet (envelope_version, ts, command, ok, vtp_tool, uncertainty_type, query, results[], source_refs[], root_source_hashes[], confidence, retrieved_at, elided_count, rejected_provenance_count, compression_level, body_token_estimate, error_logged_at, reason_codes)"
      min_lines: 60
      contains: "evidence_packet"
    - path: "super-gsd/tools/dispatch-router/routes.yaml"
      provides: "NEW top-level vtp_bridge: section with evidence_packet_max_tokens (5000 default), per_query_timeout_ms (30000 default), retry_on_timeout (false). Phase 47 'table:' section UNTOUCHED."
      contains: "vtp_bridge"
    - path: "super-gsd/scripts/lib/route-ledger.cjs"
      provides: "BOUNDARIES enum extended 8->9 by adding 'vtp_bridge' (closed-enum extension; envelope-v1 additionalProperties:true preserves contract). Self-test grows 14->15 with new assertion verifying 'vtp_bridge' acceptance."
      contains: "'vtp_bridge'"
    - path: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      provides: "Orchestrator wire: when routeDispatch returns {provider:'vtp'}, orchestrator calls vtp-bridge.selectiveVTPCall BEFORE Agent dispatch; result passed into context-packet build via opts.route_hint.use_vtp + opts._vtp_packets[]. Step 6.X (post-router pre-dispatch) consumer composition. Phase 45 build.cjs source remains untouched."
      contains: "selectiveVTPCall"
  key_links:
    - from: "super-gsd/tools/vtp-bridge/classify.cjs"
      to: "super-gsd/tools/dispatch-router/route.cjs"
      via: "require('../dispatch-router/route.cjs') -> { VTP_WHITELIST, isProviderHealthy } imported BY REFERENCE for defense-in-depth"
      pattern: "require\\(.*dispatch-router/route\\.cjs.*\\)"
    - from: "super-gsd/tools/vtp-bridge/classify.cjs"
      to: "super-gsd/scripts/lib/route-ledger.cjs"
      via: "require('../../scripts/lib/route-ledger.cjs') -> logRouteDecision({boundary:'vtp_bridge', ...}); EXTENDS BOUNDARIES, does NOT add a new ledger"
      pattern: "boundary:\\s*'vtp_bridge'"
    - from: "super-gsd/tools/vtp-bridge/classify.cjs"
      to: ".planning/metrics/vtp-bridge-failures.jsonl"
      via: "fs.appendFileSync envelope-v1 row on every MCP failure (timeout/auth/validation/unreachable/internal). Stream is NEW canonical (additive per EXISTING-SURFACE-AUDIT:38)."
      pattern: "vtp-bridge-failures\\.jsonl"
    - from: "super-gsd/tools/vtp-bridge/classify.cjs"
      to: ".planning/metrics/vtp-health.jsonl"
      via: "Phase 47 isProviderHealthy('vtp') reads tail of vtp-health.jsonl (Step 3.7 cold-start probe). Bridge consumes; does not re-probe."
      pattern: "isProviderHealthy"
    - from: "super-gsd/tools/vtp-bridge/classify.cjs"
      to: "super-gsd/tools/context-packet/build.cjs"
      via: "MIRROR-ONLY (no require). Bridge mirrors _assertValidatedThoughtProvenance shape (build.cjs:220-234) and _estimateTokens shape (build.cjs:208-215) and enforceRoleBudget descending-elision shape (build.cjs:538-575) without importing. Phase 45 source UNTOUCHED."
      pattern: "_assertResultProvenance|_estimateTokens|_enforcePacketCap"
    - from: "super-gsd/skills/sgsd-orchestrate/SKILL.md"
      to: "super-gsd/tools/vtp-bridge/classify.cjs"
      via: "Step 6.X: when routeDispatch returns {provider:'vtp'}, orchestrator calls bridge.selectiveVTPCall({uncertainty_type, query, planningDir, phase, milestone}) before Agent dispatch."
      pattern: "selectiveVTPCall"
    - from: "super-gsd/scripts/lib/route-ledger.cjs"
      to: "super-gsd/scripts/lib/route-ledger.cjs"
      via: "BOUNDARIES Object.freeze 8->9 closed-enum extension; new entry 'vtp_bridge' appended at end. envelope-v1 additionalProperties:true preserves contract."
      pattern: "'vtp_bridge'"
---

<objective>
Phase 48 ships THE BRIDGE: a single deterministic function `selectiveVTPCall` that
takes a Phase 47 routing decision (`{provider:'vtp', uncertainty_type, query}`) and
returns either (a) a compact source-backed evidence packet by calling exactly one
`mcp__vtp-kb__*` tool through an orchestrator-supplied shim, or (b) a sentinel
`{ok:false}` packet plus an isolated failure-log row. The bridge enforces the
3-entry frozen VTP_WHITELIST (defense-in-depth re-check after Phase 47 already
gated the route), enforces a 5000-token packet cap with descending-relevance
elision (mirror Phase 45), enforces mandatory `source_refs[]` + `root_source_hashes[]`
provenance (mirror Phase 45 PACKET-13), and structurally separates MCP failures
from research conclusions by writing to a NEW canonical stream
`.planning/metrics/vtp-bridge-failures.jsonl` while keeping `evidence_packet.results[]`
empty on failure.

Purpose: make VTP useful without turning it into ambient bloat. Local implementation
phases must not be able to fire VTP. Research / book / prior-project /
architecture-challenge phases get a structural, mechanical, single-shot path to
high-confidence corpus evidence. MCP timeouts and auth failures must be first-class
metric rows, not silently injected as research findings into agent prompts.

Output: New module `super-gsd/tools/vtp-bridge/classify.cjs` (~600-700 lines)
with public APIs, frozen consts, in-module 10-assertion self-test, and
`--bridge`/`--self-test` CLI parity with Phase 47. New manual schema
`EVIDENCE-PACKET.schema.json`. Phase 32 BOUNDARIES enum extends 8->9 with
`'vtp_bridge'`. Phase 47 `routes.yaml` extends with NEW top-level `vtp_bridge:`
section. Phase 45 `context-packet/build.cjs` source is NOT mutated; the wire-in
is caller-side composition driven from the orchestrator skill (Step 6.X).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v1.9/REQUIREMENTS.md
@.planning/milestones/v1.9/ROADMAP.md
@.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md
@.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md
@.planning/milestones/v1.9/phases/48-selective-vtp-bridge/48-CONTEXT.md
@.planning/milestones/v1.9/phases/48-selective-vtp-bridge/48-RESEARCH.md
@super-gsd/tools/dispatch-router/route.cjs
@super-gsd/tools/dispatch-router/routes.yaml
@super-gsd/scripts/lib/route-ledger.cjs
@super-gsd/tools/context-packet/build.cjs
@super-gsd/tools/token-attribution/report.cjs
@super-gsd/agents/sgsd-vtp-enrichment.md
@super-gsd/skills/sgsd-orchestrate/SKILL.md

<interfaces>
<!-- Contracts the executor MUST consume by reference. No exploration needed. -->

# Phase 47 dispatch-router/route.cjs (HEAD) -- IMPORT BY REFERENCE

```javascript
// route.cjs:175-179 -- frozen 3-entry whitelist; Phase 48 imports by reference for
// defense-in-depth re-check. DO NOT REDEFINE.
const VTP_WHITELIST = Object.freeze([
  'architecture_challenge',
  'prior_memory_lookup',
  'book_lookup',
]);

// route.cjs:77-84 -- frozen 6-entry uncertainty_type closed enum.
const UNCERTAINTY_TYPES = Object.freeze([
  'deterministic_extraction',
  'bounded_code_review',
  'synthesis_judgment',
  'architecture_challenge',
  'prior_memory_lookup',
  'book_lookup',
]);

// route.cjs:296-313 -- health probe; Phase 48 calls isProviderHealthy('vtp', planningDir, _forces)
// before any MCP call. _forces.vtp accepts boolean for self-test injection (mirror
// Phase 47 _force_vtp_health pattern at route.cjs:459-463).
function isProviderHealthy(name, planningDir, _forces) -> { healthy, reason, age_ms? }

// route.cjs:319-378 -- loadRoutes() returns {table, source}. Phase 48 reads
// routes.yaml.vtp_bridge section the same way; on miss returns compiled fallback
// {evidence_packet_max_tokens:5000, per_query_timeout_ms:30000, retry_on_timeout:false}.
```

# Phase 32 scripts/lib/route-ledger.cjs (HEAD) -- EXTEND BOUNDARIES enum

```javascript
// route-ledger.cjs:66-75 -- BOUNDARIES at HEAD (8 entries; Phase 47 added 'dispatch_route').
// Phase 48 extends 8->9 by APPENDING 'vtp_bridge'. envelope-v1 contract unchanged
// (additionalProperties:true at registry/command-envelope-v1.yaml:260 per inline comment).
const BOUNDARIES = Object.freeze([
  'milestone_promotion','phase_dispatch_first','executor_choice',
  'gate_skip','codex_route','handoff_decision','gate_override','dispatch_route',
  // PHASE 48: append 'vtp_bridge' here (9th entry).
]);

// route-ledger.cjs:211-218 -- logRouteDecision API (Lock 13; never throws upward).
function logRouteDecision(planningDir, row) -> { ok, path?, byte_offset? } | { ok:false, reason }
// row required fields: { boundary, status, reason_codes?, phase?, milestone?, decision? }
// Phase 48 calls with boundary:'vtp_bridge', status one of:
//   'ok'   -- successful evidence packet
//   'warn' -- ok but elided ('evidence_packet_size_capped')
//   'fail' -- MCP failure (auth/validation/unreachable/internal)
//   'timeout' -- MCP timeout
```

# Phase 45 context-packet/build.cjs (HEAD) -- MIRROR ONLY (do NOT import; do NOT mutate)

```javascript
// build.cjs:707-708 -- Phase 45 stub Phase 48 will WIRE FROM CALLER (not by mutation).
// const _vtp_packets = (opts && Array.isArray(opts._vtp_packets)) ? opts._vtp_packets : [];
// const useVtp = !!(opts && opts.route_hint && opts.route_hint.use_vtp);

// build.cjs:220-234 -- _assertValidatedThoughtProvenance shape; Phase 48 mirrors
// the gate locally as _assertResultProvenance to avoid hard dep:
//   accepts EITHER doc_id OR id (older VTP versions); requires non-empty citation.

// build.cjs:208-215 -- _estimateTokens (word-count x 1.3); Phase 48 mirrors locally.

// build.cjs:538-575 -- enforceRoleBudget descending-relevance elision; Phase 48
// mirrors as _enforcePacketCap (descending by relevance/score; cumulative under cap).
```

# Phase 41 token-attribution/report.cjs -- PROVIDERS frozen 4-entry

```javascript
// report.cjs:79-81 -- Phase 48 verifies PROVIDERS.includes('vtp') === true at startup.
// Imported BY REFERENCE if needed for sanity assertion.
const PROVIDERS = Object.freeze(['claude', 'codex', 'local-script', 'vtp']);
```

# Phase 21+ MCP tool surface (RUNTIME; injected by orchestrator)

```javascript
// _callVtpTool(toolName, args) shim signature (Phase 48 ships; orchestrator wires).
// toolName one of: 'vtp_search_substrate' | 'wiki_search' | 'vtp_route_and_retrieve' | 'vtp_get_research'
// args:    { query, source_types?, resource_type?, tier?, resource_subtype_filter?, ... }
// returns: arbitrary MCP shape; Phase 48 _extractResults normalizes to results[].
//
// Self-test injection: input._force_vtp_tool_response replaces the shim (or throws
// to simulate failures). Mirrors Phase 47 _force_codex_health / _force_vtp_health.
```
</interfaces>

<source_audit>

## Multi-Source Coverage Audit

| Source Item | Source | Plan Coverage | Tasks |
|-------------|--------|---------------|-------|
| GOAL: "make VTP useful without turning it into ambient bloat" | 48-CONTEXT.md L11 | classify.cjs whitelist gate + 5000-token cap + provenance gate | T1, T3 |
| GOAL: "Implement route-gated VTP calls for research-paper, book, prior-project, and architecture-challenge cases" | 48-CONTEXT.md L13-14 | VTP_TOOL_MAP 4-entry frozen (3 active + 1 reserved) | T1 |
| GOAL: "MCP failures must be logged as provider/tool failures, not confused with research conclusions" | 48-CONTEXT.md L14-15 | vtp-bridge-failures.jsonl writer + empty-results sentinel packet | T1 |
| REQ VTPR-01: selective VTP route classifier | REQUIREMENTS.md | classify.cjs selectiveVTPCall API + VTP_TOOL_MAP | T1 |
| REQ VTPR-02: research-paper, book, prior-project, architecture challenge query types | REQUIREMENTS.md | VTP_TOOL_MAP frozen 4-entry; F1+F4 self-test | T1 |
| REQ VTPR-03: capture MCP failures separately from research conclusions | REQUIREMENTS.md | _logVtpBridgeFailure + _buildFailureSentinelPacket; F2 self-test | T1 |
| REQ VTPR-04: source-backed VTP evidence packets | REQUIREMENTS.md | _assertResultProvenance + 5000-token cap + EVIDENCE-PACKET.schema.json; F3+F8 | T1 |
| REQ VTPR-05: prove local-only phases do not call VTP ambiently | REQUIREMENTS.md | whitelist gate at line 1 of selectiveVTPCall; F5 self-test | T1 |
| REQ VTPR-06: VTP routing consumes uncertainty type, not semantic similarity | REQUIREMENTS.md | _validateInput rejects embedding/similarity_score/fuzzy_match/cosine; F9 self-test | T1 |
| LOCK-11 (no semantic-only routing) | REQUIREMENTS.md | _validateInput banned-fields list + frozen whitelist enum | T1 |
| LOCK-13 (never throws upward) | REQUIREMENTS.md | selectiveVTPCall try/catch wrapper around _selectiveVTPCallInternal; sentinel return | T1 |
| RESEARCH Section 3 -- VTP_TOOL_MAP closed enum (4 entries) | 48-RESEARCH.md L329-358 | T1 implements verbatim | T1 |
| RESEARCH Section 5 -- evidence_packet shape with 18 fields | 48-RESEARCH.md L378-419 | T1 implements + EVIDENCE-PACKET.schema.json documents | T1 |
| RESEARCH Section 6 -- vtp-bridge-failures.jsonl envelope-v1 row shape | 48-RESEARCH.md L437-465 | T1 implements _logVtpBridgeFailure | T1 |
| RESEARCH Section 3 -- Phase 32 BOUNDARIES 8->9 extension | 48-RESEARCH.md L199-203 | T2 extends route-ledger.cjs + grows self-test 14->15 | T2 |
| RESEARCH Section 3.1 -- routes.yaml `vtp_bridge:` section | 48-RESEARCH.md L154-166 | T2 adds top-level section | T2 |
| RESEARCH Section 3.7 / Pitfall 7 -- Phase 45 source NOT mutated; caller composes | 48-RESEARCH.md L604-609 | T3 wires from SKILL.md only | T3 |
| RESEARCH Section 10 -- 10 self-test fixtures (F1-F10) | 48-RESEARCH.md L1085-1100 | T1 implements all 10 in _runSelfTest | T1 |
| RESEARCH Section 13 -- IN scope / OUT scope mind-map | 48-RESEARCH.md L1104-1141 | All 9 IN-scope items planned; all 8 OUT-of-scope items NOT planned | T1, T2, T3 |
| CONTEXT D-implicit (Goal verbatim quote) | 48-CONTEXT.md L11-15 | Implemented across T1-T3 | T1, T2, T3 |
| CONTEXT D-implicit (depends_on:[45,47], unblocks:[49,51]) | 48-CONTEXT.md L5-6 | T1 imports Phase 47 by reference; T3 wires forward-only contracts to 49/51 (failure-log + route-decisions consumer) | T1, T3 |
| Forward contract -- Phase 49 reads vtp-bridge-failures.jsonl + route-decisions.jsonl boundary='vtp_bridge' | 48-RESEARCH.md L1042-1050 | T1 produces both streams; no Phase 49 coupling beyond shape | T1 |
| Forward contract -- Phase 51 BENCH fixtures (vtp_unavailable, mcp_timeout, bad_provenance, compactness) | 48-RESEARCH.md L1052-1057 | T1 self-test F1/F2/F3/F6/F8 cover same shapes; Phase 51 reuses fixtures | T1 |
| Forward contract -- Phase 50 cockpit reads tail of both streams | 48-RESEARCH.md L1059-1066 | T1 produces; no cockpit coupling | T1 |
| Mirror-constraint -- frozen consts: VTP_TOOL_MAP, VTP_BRIDGE_REASONS, FAILURE_KINDS Object.freeze | RESEARCH Section 3 + plan brief | T1 implements with Object.freeze on every const | T1 |
| Mirror-constraint -- _normalize + _assertEvidencePacketSchema trio per Phase 36/41-47 pattern | plan brief | T1 implements both helpers (mirror Phase 36/47 normalize+schema-assert pair) | T1 |
| Mirror-constraint -- read-only invariant; only writes vtp-bridge-failures.jsonl + via Phase 32 logRouteDecision | plan brief | T1 self-test F10 fingerprint-asserts canonical streams unchanged | T1 |
| Mirror-constraint -- __dirname-anchored fingerprint guard | plan brief | T1 self-test loads fingerprint relative to __dirname (mirror Phase 36 pattern) | T1 |
| Mirror-constraint -- ASCII-only | plan brief | All 3 commits ASCII-only by convention | T1, T2, T3 |
| Trap 1 -- do NOT mutate Phase 45 build.cjs | plan brief | T3 wires only via SKILL.md; F7 fingerprint diff in T1 self-test asserts unchanged | T1, T3 |
| Trap 2 -- do NOT redefine VTP_WHITELIST | plan brief | T1 imports Phase 47 by reference; lint check via assertion 11 | T1 |
| Trap 3 -- do NOT throw upward (Lock 13) | plan brief | T1 selectiveVTPCall + _callVtpTool + classify wrapped in try/catch with sentinel return | T1 |
| Trap 4 -- MCP errors NOT in evidence_packet.results[] | plan brief | T1 _buildFailureSentinelPacket returns results:[]; F2 self-test scans body for any error token | T1 |
| Trap 5 -- 5000-token cap on evidence packet | plan brief | T1 _enforcePacketCap; F3 self-test enforces with override 2000 | T1 |
| Trap 6 -- mandatory source_refs validation | plan brief | T1 _assertResultProvenance + admit/reject counts; F8 self-test mixed-shape | T1 |
| Trap 7 -- no coupling to Phase 49/50/51; forward contracts via shape only | plan brief | T1 produces canonical streams; no requires of unwritten code | T1 |
| Trap 8 -- no semantic-similarity routing inside classify.cjs (LOCK 11 reaffirmed) | plan brief | T1 _validateInput banned fields + no embedding/similarity branching anywhere | T1 |
| Out-of-scope -- adding new whitelist entries | 48-RESEARCH.md L75 | NOT planned (Phase 49 governance owns) | -- |
| Out-of-scope -- caching VTP responses | 48-RESEARCH.md L76 | NOT planned (Phase 52 owns) | -- |
| Out-of-scope -- promoting evidence_packets to validated_thoughts | 48-RESEARCH.md L77 | NOT planned (Phase 49 GOV-04 owns) | -- |
| Out-of-scope -- cockpit display | 48-RESEARCH.md L78 | NOT planned (Phase 50 owns) | -- |
| Out-of-scope -- bridge utility scoring | 48-RESEARCH.md L79 | NOT planned (Phase 51 BENCH-07 owns) | -- |
| Out-of-scope -- semantic-similarity routing | 48-RESEARCH.md L82 | NOT planned (LOCK 11 forbids; reaffirmed) | -- |

**Audit verdict:** ALL in-scope items COVERED across 3 atomic commits (T1, T2, T3). All out-of-scope items DEFERRED to correct downstream owners per RESEARCH Section 13. Zero unplanned items. No phase split required.

</source_audit>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship vtp-bridge/classify.cjs + EVIDENCE-PACKET.schema.json + 10-assertion self-test</name>
  <files>
    super-gsd/tools/vtp-bridge/classify.cjs,
    super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json
  </files>
  <behavior>
    The 10 in-module assertions in `_runSelfTest()` (mirror Phase 47 self-test pattern at route.cjs:768+).
    Every assertion uses Node `assert` and a fixture-scoped tmpdir for any failure-stream writes. Order MUST be:

    Assertion 1 (F1 in RESEARCH Section 10): selectiveVTPCall({uncertainty_type:'architecture_challenge', query:'event sourcing tradeoffs', _force_vtp_tool_response: <substrate_hits with 3 valid results each having doc_id+citation+excerpt>})
      -> packet.ok === true
      -> packet.vtp_tool === 'vtp_search_substrate'
      -> packet.results.length === 3
      -> packet.source_refs.length === 3
      -> packet.root_source_hashes.length === 3
      -> packet.reason_codes includes 'vtp_call_succeeded'
      -> packet.compression_level === 'validated_thought'

    Assertion 2 (F2 -- A3 binding): selectiveVTPCall({uncertainty_type:'architecture_challenge', query:'X', _force_vtp_tool_response: () => { const e=new Error('TIMEOUT_30000ms'); throw e; }})
      -> packet.ok === false
      -> packet.results.length === 0
      -> packet.reason_codes includes 'vtp_call_timeout'
      -> packet.error_logged_at !== null
      -> JSON.stringify(packet) does NOT contain the substrings 'TIMEOUT' or 'timeout after'
      -> tail row in vtp-bridge-failures.jsonl has command:'vtpBridgeFailure', error_type:'mcp_timeout', error_message contains 'TIMEOUT_30000ms'

    Assertion 3 (F3 -- A4 cap binding): selectiveVTPCall({uncertainty_type:'book_lookup', query:'X', routes_yaml:{vtp_bridge:{evidence_packet_max_tokens:2000}}, _force_vtp_tool_response: <10 results x ~500 tokens each>})
      -> packet.body_token_estimate <= 2000
      -> packet.elided_count > 0
      -> packet.reason_codes includes 'evidence_packet_size_capped'
      -> packet.results length < 10

    Assertion 4 (F4 -- book_lookup tool mapping): selectiveVTPCall({uncertainty_type:'book_lookup', ...})
      -> packet.vtp_tool === 'vtp_search_substrate' (NOT 'wiki_search'; per A4 cross-check evidence)
      -> args sent to shim include resource_subtype_filter:'book' (verify via _force_vtp_tool_response inspection capture)

    Assertion 5 (F5 -- A1 + LOCK-11 + VTPR-05 binding): selectiveVTPCall({uncertainty_type:'synthesis_judgment', query:'X', _force_vtp_tool_response: () => { throw new Error('SHOULD_NOT_BE_CALLED'); }})
      -> packet.ok === false
      -> packet.reason_codes includes 'not_routed_to_vtp'
      -> NO row appended to vtp-bridge-failures.jsonl
      -> shim NEVER invoked (would throw 'SHOULD_NOT_BE_CALLED' if hit)

    Assertion 6 (F6 -- vtp-health unhealthy gate): selectiveVTPCall({uncertainty_type:'architecture_challenge', query:'X', _force_vtp_health:false, _force_vtp_tool_response: () => { throw new Error('SHOULD_NOT_BE_CALLED'); }})
      -> packet.ok === false
      -> packet.reason_codes includes 'vtp_unavailable'
      -> ONE row in vtp-bridge-failures.jsonl with error_type:'mcp_unreachable'
      -> shim NEVER invoked

    Assertion 7 (F7 -- Pitfall 7 + A6 read-only invariant): snapshot `super-gsd/tools/context-packet/build.cjs` size+mtime BEFORE running F1; run F1; assert size+mtime UNCHANGED. Same for `super-gsd/tools/dispatch-router/route.cjs` and `super-gsd/scripts/lib/route-ledger.cjs`.

    Assertion 8 (F8 -- provenance gate mixed-shape): selectiveVTPCall({uncertainty_type:'architecture_challenge', _force_vtp_tool_response: <5 results: 2 with doc_id+citation, 1 with id+citation (legacy shape; should ADMIT), 1 with empty citation (REJECT), 1 missing both (REJECT)>})
      -> packet.results.length === 3 (admitted: 2 with doc_id + 1 with id)
      -> packet.rejected_provenance_count === 2

    Assertion 9 (F9 -- LOCK-11 + LOCK-13 + VTPR-06 binding): selectiveVTPCall({uncertainty_type:'architecture_challenge', query:'X', embedding:[0.1, 0.2]})
      -> packet.ok === false
      -> packet.reason_codes includes 'bridge_internal_error'
      -> packet.error contains the literal string "embedding" (validation error from _validateInput; Lock 13 wraps and surfaces the message in packet.error)
      -> NO upward throw

    Assertion 10 (F10 -- read-only canonical streams invariant): snapshot size+mtime of `.planning/metrics/codex-log.jsonl`, `.planning/metrics/route-decisions.jsonl`, `.planning/metrics/vtp-health.jsonl` BEFORE self-test; run self-test (which uses fixture-scoped tmpdir for vtp-bridge-failures.jsonl); assert all three canonical streams UNCHANGED.

    Assertion 11 (defense-in-depth): require Phase 47 dispatch-router/route.cjs and assert VTP_WHITELIST is the SAME object reference used inside classify.cjs whitelist gate (no copy; no redefinition).
  </behavior>
  <action>
1. Create directory `super-gsd/tools/vtp-bridge/`.

2. Write `super-gsd/tools/vtp-bridge/classify.cjs` (~600-700 lines, ASCII-only) with the
   following structure (mirror dispatch-router/route.cjs at ~700+ lines):

   Header comment block (mirror Phase 47):
     - Module purpose: Phase 48 bridge between routing decision and MCP tool surface.
     - Closed-enum extension philosophy.
     - Lock 11, Lock 13, A1-A5 acceptance bindings.
     - Source citations: route.cjs:175-179, route-ledger.cjs:66-75, build.cjs:220-234,
       build.cjs:208-215, build.cjs:538-575.

   Imports (require by reference):
     - Node: fs, path, crypto.
     - Phase 47: const route = require('../dispatch-router/route.cjs')  // -> VTP_WHITELIST,
       isProviderHealthy, loadRoutes (for routes.yaml.vtp_bridge section read).
     - Phase 32: const ledger = require('../../scripts/lib/route-ledger.cjs')  // -> logRouteDecision.
     - Phase 41 (sanity assert at module load): const tokAttr = require('../token-attribution/report.cjs');
       assert(tokAttr.PROVIDERS.includes('vtp')).
     - DO NOT import context-packet/build.cjs (mirror only).

   Frozen consts (Object.freeze on EVERY one; ASCII-only):
     - COMMAND_NAME = 'selectiveVTPCall'
     - ENVELOPE_VERSION = 1
     - EVIDENCE_PACKET_MAX_TOKENS_DEFAULT = 5000
     - PER_QUERY_TIMEOUT_MS_DEFAULT = 30000
     - VTP_TOOL_MAP -- 4 entries (3 active + 1 reserved):
         architecture_challenge -> { tool:'vtp_search_substrate', args_template:{source_types:['research','wiki_page']}, rationale:'...' }
         prior_memory_lookup    -> { tool:'wiki_search',            args_template:{resource_type:'wiki_page', tier:['people','projects','ideas','analyses']}, rationale:'...' }
         book_lookup            -> { tool:'vtp_search_substrate', args_template:{source_types:['wiki_page'], resource_subtype_filter:'book'}, rationale:'...' }
         research_external_validation -> { tool:'vtp_route_and_retrieve', args_template:{}, rationale:'RESERVED -- Phase 49 governance gate; Phase 48 never selects' }
       (each inner object also Object.freeze; nested args_template also Object.freeze)
     - VTP_BRIDGE_REASONS -- closed-enum array of all reason_codes used in
       evidence_packet.reason_codes and route-decisions decision.reason_codes:
         'vtp_call_succeeded',
         'vtp_call_timeout',
         'vtp_call_auth_failed',
         'vtp_call_validation_failed',
         'vtp_call_returned_empty',
         'not_routed_to_vtp',
         'vtp_unavailable',
         'evidence_packet_size_capped',
         'evidence_packet_provenance_failed',
         'bridge_internal_error',
     - FAILURE_KINDS -- closed-enum array used in vtp-bridge-failures.jsonl error_type:
         'mcp_timeout',
         'mcp_auth',
         'mcp_validation',
         'mcp_unreachable',
         'mcp_internal',

   Public API:
     - selectiveVTPCall(input)               // Lock 13 wrapped
     - selectiveVTPCallForPacket(intent_map, opts)   // optional caller-side helper
     - module.exports = { selectiveVTPCall, selectiveVTPCallForPacket, VTP_TOOL_MAP,
       VTP_BRIDGE_REASONS, FAILURE_KINDS, EVIDENCE_PACKET_MAX_TOKENS_DEFAULT,
       PER_QUERY_TIMEOUT_MS_DEFAULT, COMMAND_NAME, ENVELOPE_VERSION }

   Internal helpers (all ASCII-only, all never-throw-upward where called from public API):
     - _validateInput(input)                 // throws on bad input; reject embedding/similarity_score/fuzzy_match/cosine
     - _defaultPlanningDir()                 // resolve from process.cwd() walk-up to `.planning`; mirror Phase 47 helper
     - _forcesFromInput(input)               // extract _force_vtp_health -> forces.vtp (mirror route.cjs:459-463)
     - _callVtpToolWithTimeout(toolName, args, timeoutMs, _force_response)
                                              // when _force_response present, use it; else throws 'shim_not_wired'
                                              // wraps actual call in Promise.race timeout helper
     - _extractResults(mcp_response, toolName)  // normalize MCP shape per tool
     - _assertResultProvenance(result)       // mirror build.cjs:220-234; accepts doc_id OR id; non-empty citation
     - _estimateTokens(text)                 // mirror build.cjs:208-215; word-count x 1.3
     - _enforcePacketCap(admitted, max_tokens) -> { kept, elided, tokens }
                                              // mirror build.cjs:538-575; descending-relevance elision
     - _buildEvidencePacket(uncertainty_type, query, mcp_response, opts)  -> Object.freeze packet
     - _buildFailureSentinelPacket(uncertainty_type, query, failure_log_result, reason_codes) -> Object.freeze packet
     - _logVtpBridgeFailure(planningDir, payload) -> { ok, path?, byte_offset? }
                                              // appends envelope-v1 row to vtp-bridge-failures.jsonl
                                              // creates dir if missing; never throws
     - _emitRouteLedgerRow(planningDir, packet, opts)  // calls ledger.logRouteDecision
     - _normalize(rawPacket)                 // mirror Phase 36/47 normalize trio; ensure shape conformance
     - _assertEvidencePacketSchema(packet)   // mirror Phase 36/47 schema-assert trio; throws on shape violation
     - _selectiveVTPCallInternal(input)      // the meat: 4-gate decision flow
     - __dirnameFingerprint()                // returns sha256 of __dirname-anchored classify.cjs file size+mtime;
                                              // used in self-test F7+F10 read-only verification
     - _runSelfTest(opts)                    // 11 assertions (10 from RESEARCH Section 10 + assertion 11 defense-in-depth)
     - CLI: if (require.main === module) -> parse --self-test | --bridge args.

   Decision flow inside _selectiveVTPCallInternal (mirror RESEARCH Example 4):
     Gate 1: validate input (throw on banned fields; Lock 13 wrapper catches).
     Gate 2: whitelist gate. If !route.VTP_WHITELIST.includes(input.uncertainty_type)
             -> return frozen sentinel packet with reason_codes:['not_routed_to_vtp'];
             NO ledger row written (matches RESEARCH expectation; A1 binding --
             non-whitelist is a refused call, not an outcome). Self-test F5 binds.
     Gate 3: vtp-health probe via route.isProviderHealthy('vtp', planningDir, _forces).
             If !healthy -> _logVtpBridgeFailure({error_type:'mcp_unreachable'})
             + _buildFailureSentinelPacket(reason_codes:['vtp_unavailable'])
             + _emitRouteLedgerRow(status:'fail') + return.
     Gate 4: dispatch _callVtpToolWithTimeout. On any thrown error, classify by
             message prefix (TIMEOUT_/AUTH_/VALIDATION_/_/default) -> error_type
             in FAILURE_KINDS -> _logVtpBridgeFailure + sentinel packet
             + _emitRouteLedgerRow + return.
     Gate 5: success path -> _buildEvidencePacket -> _emitRouteLedgerRow
             (status:'ok' or 'warn' if size_capped) -> return frozen packet.

   Lock 13 wrapper for selectiveVTPCall:
     try { return _selectiveVTPCallInternal(input); }
     catch (e) {
       console.warn('[SGSD] vtp-bridge selectiveVTPCall failed:', e.message);
       return Object.freeze({
         envelope_version: 1, ts: new Date().toISOString(),
         command: 'vtpBridgeEvidence', ok: false,
         vtp_tool: null,
         uncertainty_type: input && input.uncertainty_type || null,
         query: input && input.query || null,
         results: [], source_refs: [], root_source_hashes: [],
         confidence: 'low', retrieved_at: null, error_logged_at: null,
         reason_codes: ['bridge_internal_error'], compression_level: null,
         error: e.message,
       });
     }

3. Self-test implementation `_runSelfTest({_isolatedTmpDir})`:
     - All 11 assertions per <behavior> block above.
     - Use a fixture-scoped tmpdir (created via fs.mkdtempSync in os.tmpdir()) for
       any vtp-bridge-failures.jsonl writes (DO NOT touch real .planning/metrics).
     - Use input._force_vtp_tool_response and input._force_vtp_health to inject
       deterministic shim/health responses (mirror Phase 47 _force_codex_health
       at route.cjs:768+).
     - For F7 + F10: read size+mtime of canonical files BEFORE assertions, re-read
       AFTER, assert equal. F10 covers `.planning/metrics/codex-log.jsonl`,
       `.planning/metrics/route-decisions.jsonl`, `.planning/metrics/vtp-health.jsonl`.
       F7 covers `super-gsd/tools/context-packet/build.cjs`,
       `super-gsd/tools/dispatch-router/route.cjs`,
       `super-gsd/scripts/lib/route-ledger.cjs`.
     - Use `__dirname`-anchored absolute paths (NOT cwd-relative) for those reads
       (mirror Phase 36 fingerprint guard pattern; the bridge module lives at
       super-gsd/tools/vtp-bridge/classify.cjs so build.cjs is at
       path.join(__dirname, '..', 'context-packet', 'build.cjs') etc.).
     - Print per-assertion status: `[ok] N. {description}` or
       `[FAIL] N. {description}: {reason}` (mirror Phase 47).
     - Aggregate: `Self-test: 11/11 passed (X ms)` on success; exit 0.
       On any failure: print all failures, exit 1.

4. CLI:
     --self-test  -> _runSelfTest(); exit code reflects pass/fail.
     --bridge --uncertainty-type X --query Y [--phase N] [--milestone V]
              -> selectiveVTPCall(...) and JSON.stringify(packet, null, 2) to stdout.
     (default; no args) -> print usage to stderr; exit 1.

5. Write `super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json`
   (mirror super-gsd/tools/context-packet/PACKET.schema.json; ~60-100 lines):
     - JSON object with top-level: $schema, title, description, type, properties
       (envelope_version int=1, ts ISO-8601, command='vtpBridgeEvidence',
       ok bool, vtp_tool enum (4-entry), uncertainty_type enum (4-entry from VTP_TOOL_MAP keys),
       query string, results array of {title,doc_id,citation,excerpt,score?,...},
       source_refs array of strings (doc_ids), root_source_hashes array of sha256 hex strings,
       confidence enum ['low','medium','high'], retrieved_at ISO-8601 or null,
       elided_count int>=0, rejected_provenance_count int>=0,
       compression_level enum ['validated_thought',null], body_token_estimate int>=0,
       error_logged_at string or null, reason_codes array of VTP_BRIDGE_REASONS members),
       required: [envelope_version, ts, command, ok, uncertainty_type, query, results,
                  source_refs, root_source_hashes, reason_codes],
       additionalProperties: false.

6. Run self-test:
     node super-gsd/tools/vtp-bridge/classify.cjs --self-test
   MUST exit 0 with `Self-test: 11/11 passed`.

7. Verify Phase 47 dispatch-router self-test still passes (no regression from import):
     node super-gsd/tools/dispatch-router/route.cjs --self-test
   MUST exit 0 with `Self-test: 15/15 passed` (unchanged from Phase 47 baseline).

8. Verify Phase 32 route-ledger self-test still passes (T2 hasn't shipped yet so
   self-test count is still 14/14 here; T2 will grow it to 15/15):
     node super-gsd/scripts/lib/route-ledger.cjs --self-test
   MUST exit 0 with `Self-test: 14/14 passed` (unchanged baseline).

9. ASCII-only check: rg -n '[^\x00-\x7f]' super-gsd/tools/vtp-bridge/   -> no matches.

10. Read-only invariant snapshot check:
     - Confirm context-packet/build.cjs unchanged (`git status -- super-gsd/tools/context-packet/`).
     - Confirm dispatch-router/route.cjs unchanged.
     - Confirm route-ledger.cjs unchanged (T2 will modify it next).
     - Confirm `.planning/metrics/codex-log.jsonl`, `route-decisions.jsonl`,
       `vtp-health.jsonl` all unchanged (`git status -- .planning/metrics/`).

11. Stage and commit (NEVER `git add -A`):
     git add super-gsd/tools/vtp-bridge/classify.cjs super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json
     git commit -m "feat(48-01): vtp-bridge/classify.cjs + VTP_TOOL_MAP + 10-assertion self-test"
  </action>
  <verify>
    <automated>node super-gsd/tools/vtp-bridge/classify.cjs --self-test &amp;&amp; node super-gsd/tools/dispatch-router/route.cjs --self-test &amp;&amp; node super-gsd/scripts/lib/route-ledger.cjs --self-test</automated>
  </verify>
  <done>
    - super-gsd/tools/vtp-bridge/classify.cjs exists, is ASCII-only, exports the 9-key public surface, contains Object.freeze on every const (VTP_TOOL_MAP + 4 inner entries + VTP_BRIDGE_REASONS + FAILURE_KINDS), and exits 0 on `--self-test` with 11/11 assertions passing in <5s.
    - super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json exists, parses as JSON, declares additionalProperties:false, requires the 10-field minimum set.
    - Phase 47 dispatch-router self-test still 15/15 (no regression from new requirer).
    - Phase 32 route-ledger self-test still 14/14 (unchanged at this commit; T2 grows to 15).
    - context-packet/build.cjs untouched (git diff empty).
    - vtp-bridge-failures.jsonl created ONLY in self-test tmpdir; canonical .planning/metrics streams unchanged.
    - Atomic commit: `feat(48-01): vtp-bridge/classify.cjs + VTP_TOOL_MAP + 10-assertion self-test`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend Phase 32 route-ledger BOUNDARIES 8 to 9 with 'vtp_bridge' + extend Phase 47 routes.yaml with vtp_bridge: section</name>
  <files>
    super-gsd/scripts/lib/route-ledger.cjs,
    super-gsd/tools/dispatch-router/routes.yaml
  </files>
  <behavior>
    Phase 32 `route-ledger.cjs` `BOUNDARIES` Object.freeze enum grows from 8 entries
    to 9 by appending `'vtp_bridge'`. Self-test `_runSelfTest()` grows by exactly 1
    assertion (14 -> 15) named "15. logRouteDecision accepts boundary='vtp_bridge'
    smoke" that round-trips one row with boundary:'vtp_bridge', status:'ok',
    decision:{tool:'vtp_search_substrate', uncertainty_type:'architecture_challenge'}
    and asserts the row JSON-parses with envelope-v1 conformance and contains
    boundary === 'vtp_bridge'. Self-test must still write to a tmpdir-scoped
    `metrics/route-decisions.jsonl` (already its pattern); canonical .planning
    streams remain untouched.

    `routes.yaml` grows by a NEW top-level `vtp_bridge:` block (adjacent to existing
    `table:`). Phase 47 `loadRoutes()` shape MUST still parse the same way; Phase 48
    bridge reads `vtp_bridge.evidence_packet_max_tokens`, `vtp_bridge.per_query_timeout_ms`,
    `vtp_bridge.retry_on_timeout` via the same `loadRoutes()` helper Phase 47 uses
    (compiled fallback if section absent: 5000 / 30000 / false).
  </behavior>
  <action>
1. Edit `super-gsd/scripts/lib/route-ledger.cjs`:
   a. In the `BOUNDARIES = Object.freeze([...])` block at lines ~66-75, APPEND
      `'vtp_bridge',` as the 9th entry (after `'dispatch_route'`). Update the
      header comment block immediately above to add a Phase 48 line:
        // Phase 48 (VTPR-01..06): added 'vtp_bridge' for selective VTP MCP
        // bridge calls (uncertainty_type -> MCP tool dispatch). Same closed-enum
        // extension pattern as Phase 47 'dispatch_route'. envelope-v1 contract
        // unchanged (additionalProperties:true at registry/command-envelope-v1.yaml:260).
   b. In `_runSelfTest()` (existing 14 assertions; locate the assertion-15 site
      at the end of the test list, just before the aggregate `passed/total` print):
      append a 15th assertion:
        // Assertion 15 -- vtp_bridge boundary smoke (Phase 48 binding)
        try {
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-vtp-bridge-'));
          const result = logRouteDecision(tmpDir, {
            boundary: 'vtp_bridge',
            status: 'ok',
            phase: 48,
            milestone: 'v1.9',
            reason_codes: ['vtp_call_succeeded'],
            decision: { tool: 'vtp_search_substrate', uncertainty_type: 'architecture_challenge', result_count: 3 },
          });
          assert(result.ok === true, `expected ok=true; got ${JSON.stringify(result)}`);
          const lines = fs.readFileSync(path.join(tmpDir, 'metrics', 'route-decisions.jsonl'), 'utf8').trim().split('\n');
          assert(lines.length === 1, `expected 1 row; got ${lines.length}`);
          const row = JSON.parse(lines[0]);
          assert(row.boundary === 'vtp_bridge', `expected boundary=vtp_bridge; got ${row.boundary}`);
          assert(row.status === 'ok');
          assert(row.envelope_version === 1);
          assert(row.command === 'logRouteDecision');
          assert(row.decision.tool === 'vtp_search_substrate');
          fs.rmSync(tmpDir, { recursive: true, force: true });
          ok('15. logRouteDecision accepts boundary=vtp_bridge smoke');
        } catch (e) { fail('15. logRouteDecision accepts boundary=vtp_bridge smoke', e.message); }
   c. Update the aggregate print line at the end from `Self-test: ${passed}/14` to
      `Self-test: ${passed}/${total}` if not already templated. (Most likely
      already templated; verify by grepping `/14` in the file and converting to
      a `total` variable if hard-coded.)
   d. Update assertion 1 (BOUNDARIES count) -- locate the assertion that asserts
      `BOUNDARIES.length === 8` and update to `=== 9` (mirror Phase 47 7->8 fix).
   e. NO other changes. logRouteDecision API surface untouched. _normalize
      validation logic untouched (already enum-driven via BOUNDARIES.includes).

2. Edit `super-gsd/tools/dispatch-router/routes.yaml`:
   a. After the existing `table:` block (or at top-level adjacent), append:
      ```yaml

      # ----------------------------------------------------------------
      # Phase 48 (VTPR-01..06): Selective VTP Bridge configuration.
      # Read by super-gsd/tools/vtp-bridge/classify.cjs via the same
      # loadRoutes() helper Phase 47 uses. Compiled fallback inside
      # classify.cjs hard-codes 5000/30000/false if this section is absent.
      # ----------------------------------------------------------------
      vtp_bridge:
        # Maximum body_token_estimate for an evidence_packet returned by
        # selectiveVTPCall. When MCP returns more, results are elided
        # descending-relevance until cumulative tokens fit; reason_codes
        # gains 'evidence_packet_size_capped'.
        evidence_packet_max_tokens: 5000
        # Per-call MCP timeout. Bridge does NOT retry on timeout; failure
        # row appended to .planning/metrics/vtp-bridge-failures.jsonl
        # and an empty packet returned (Lock 13 + A3 binding).
        per_query_timeout_ms: 30000
        # Phase 48 explicitly does NOT retry. Phase 49 governance may add
        # a retry policy in a future revision.
        retry_on_timeout: false
      ```

3. Run regressions:
   a. Phase 32 route-ledger self-test grows to 15:
      node super-gsd/scripts/lib/route-ledger.cjs --self-test
      MUST exit 0 with `Self-test: 15/15 passed`.
   b. Phase 48 vtp-bridge self-test still 11/11 (unchanged):
      node super-gsd/tools/vtp-bridge/classify.cjs --self-test
   c. Phase 47 dispatch-router self-test still 15/15:
      node super-gsd/tools/dispatch-router/route.cjs --self-test

4. ASCII-only check:
   rg -n '[^\x00-\x7f]' super-gsd/scripts/lib/route-ledger.cjs super-gsd/tools/dispatch-router/routes.yaml
   -> no matches.

5. Stage and commit (NEVER `git add -A`):
   git add super-gsd/scripts/lib/route-ledger.cjs super-gsd/tools/dispatch-router/routes.yaml
   git commit -m "feat(48-01): extend route-ledger BOUNDARIES 8->9 with 'vtp_bridge'"
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/route-ledger.cjs --self-test &amp;&amp; node super-gsd/tools/vtp-bridge/classify.cjs --self-test &amp;&amp; node super-gsd/tools/dispatch-router/route.cjs --self-test</automated>
  </verify>
  <done>
    - route-ledger.cjs `BOUNDARIES` length === 9 with `'vtp_bridge'` as the 9th entry; self-test prints `Self-test: 15/15 passed` in <5s.
    - routes.yaml has a new top-level `vtp_bridge:` section with the three default keys; existing `table:` section bytes unchanged.
    - Phase 48 vtp-bridge self-test still 11/11 (no regression).
    - Phase 47 dispatch-router self-test still 15/15 (no regression).
    - Atomic commit: `feat(48-01): extend route-ledger BOUNDARIES 8->9 with 'vtp_bridge'`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire selectiveVTPCall consumer into orchestrator skill (Step 6.X) -- Phase 45 source untouched</name>
  <files>
    super-gsd/skills/sgsd-orchestrate/SKILL.md
  </files>
  <behavior>
    Add a Step 6.X (between existing Step 6 dispatch decision and the actual Agent
    dispatch call) that documents the orchestrator-side composition: when
    `routeDispatch()` from Phase 47 returns `{provider:'vtp'}`, the orchestrator
    calls `vtp-bridge.selectiveVTPCall(...)` BEFORE calling `Agent(...)`, then
    passes the resulting evidence_packet (if `ok:true`) to the context-packet
    builder via `opts.route_hint.use_vtp = true` and `opts._vtp_packets = [packet]`.

    The wire is documentary in SKILL.md (the skill is the orchestrator's behavior
    contract); Phase 45 `context-packet/build.cjs` source remains UNTOUCHED. The
    new Step 6.X must reference the existing Phase 45 stub at
    `context-packet/build.cjs:707-708` (caller-side composition), the Phase 47
    routing decision shape (`{provider:'vtp', uncertainty_type, query}`), and the
    Phase 32 ledger row that vtp-bridge already emits (boundary='vtp_bridge').

    Step 6.X documents the failure path explicitly: when packet.ok===false, the
    orchestrator does NOT abort the dispatch -- it proceeds with `_vtp_packets:[]`
    and surfaces the `error_logged_at` reference in the Agent prompt's evidence
    section (so Agent can mention "VTP attempted; failed; see vtp-bridge-failures.jsonl"
    rather than treating the failure as a research finding).
  </behavior>
  <action>
1. Open `super-gsd/skills/sgsd-orchestrate/SKILL.md`. Locate the existing Step 6
   block (where routeDispatch is consulted; likely near the existing
   `super-gsd/tools/dispatch-router/route.cjs` mention added by Phase 47).

2. Insert a new Step 6.X block AFTER the routeDispatch consultation block and
   BEFORE the Agent dispatch call. Format (mirror existing Step 6.b.5
   sgsd-vtp-enrichment block at SKILL.md:473-498 for tone and structure):

   ```markdown
   ### Step 6.X -- Selective VTP Bridge call (Phase 48)

   When `routeDispatch()` returns `{provider:'vtp', uncertainty_type, ...}` for
   the dispatch under consideration, call the Phase 48 bridge BEFORE Agent
   dispatch:

   ```javascript
   const route = require('super-gsd/tools/dispatch-router/route.cjs');
   const bridge = require('super-gsd/tools/vtp-bridge/classify.cjs');

   const decision = route.routeDispatch({uncertainty_type, task_kind, ...});

   let vtp_evidence_packet = null;
   if (decision.provider === 'vtp') {
     vtp_evidence_packet = bridge.selectiveVTPCall({
       uncertainty_type,
       query: canonical_intent_or_dispatch_query,
       planningDir,
       phase,
       milestone,
     });
     // Lock 13: bridge NEVER throws upward. Always returns a packet.
   }
   ```

   Pass the result into the Phase 45 context-packet builder via the EXISTING
   reserved opts slot at `super-gsd/tools/context-packet/build.cjs:707-708`
   (Phase 45 source remains UNTOUCHED -- the wire is caller-side composition):

   ```javascript
   const packet = require('super-gsd/tools/context-packet/build.cjs').buildPacket(
     role, intent_ref, {
       planningDir,
       route_hint: { use_vtp: !!(vtp_evidence_packet && vtp_evidence_packet.ok) },
       _vtp_packets: (vtp_evidence_packet && vtp_evidence_packet.ok) ? [vtp_evidence_packet] : [],
     }
   );
   ```

   **Failure path (A3 binding).** When `vtp_evidence_packet.ok === false`,
   the orchestrator MUST NOT inject the failure into the Agent prompt as if
   it were research evidence. Instead:
   - Pass `_vtp_packets: []` (empty) into the context-packet builder.
   - Surface `vtp_evidence_packet.error_logged_at` in the dispatch summary
     line of the Agent prompt as: `"VTP bridge attempted (uncertainty_type=X);
     failed; see {error_logged_at}"`. The Agent then treats this as a
     bridge-status note, NOT a research conclusion.
   - The bridge has ALREADY appended one row to
     `.planning/metrics/vtp-bridge-failures.jsonl` and one row to
     `.planning/metrics/route-decisions.jsonl` (boundary='vtp_bridge',
     status='fail'|'timeout'). No additional logging required from the
     orchestrator.

   **Whitelist behavior.** When `decision.provider !== 'vtp'`, do NOT call the
   bridge. Phase 47 already gated routing; defense-in-depth re-check inside
   `selectiveVTPCall` rejects non-whitelist uncertainty_types with
   `{ok:false, reason:'not_routed_to_vtp'}` if accidentally invoked.

   **Coexistence with `sgsd-vtp-enrichment` agent (Step 6.b.5).** The two are
   distinct:
   - Step 6.b.5 (sgsd-vtp-enrichment): per-PHASE enrichment between researcher
     and planner; runs the 5-tool VTP cascade for broad enrichment of
     RESEARCH.md.
   - Step 6.X (Phase 48 bridge): per-DISPATCH selective single-shot call;
     fires on routing decision, returns evidence_packet for context-packet
     builder.
   Both call the same MCP tool family; both coexist; Phase 48 does NOT
   replace the enrichment agent.

   **Forward contracts.**
   - Phase 49 governance (GOV-04..GOV-08) reads the failure-log + ledger rows
     and may promote recurring successful packets to `validated_thoughts`
     and demote tools whose failure rate exceeds threshold. Phase 48 ships
     the data; Phase 49 owns the promotion logic.
   - Phase 50 cockpit (COCKPIT-04) reads tail of both streams for the source
     mix display.
   - Phase 51 BENCH (BENCH-05..BENCH-07) reuses the Phase 48 self-test
     fixtures (vtp_unavailable, mcp_timeout, bad_provenance, compactness)
     for utility-per-token measurement.
   ```

3. ASCII-only check:
   rg -n '[^\x00-\x7f]' super-gsd/skills/sgsd-orchestrate/SKILL.md
   -> no matches in the new Step 6.X block (existing file may have non-ASCII
   already; only newly added bytes must be ASCII).

4. Read-only invariant check (Phase 45 source untouched):
   git diff --stat super-gsd/tools/context-packet/
   -> empty (no changes).

5. Re-run all three self-tests to confirm zero regression:
   node super-gsd/tools/vtp-bridge/classify.cjs --self-test     # 11/11
   node super-gsd/scripts/lib/route-ledger.cjs --self-test      # 15/15
   node super-gsd/tools/dispatch-router/route.cjs --self-test   # 15/15

6. Confirm the SKILL.md Step 6.X block grep-matches the must_haves key_link pattern:
   rg -n 'selectiveVTPCall' super-gsd/skills/sgsd-orchestrate/SKILL.md
   -> at least one match in the new block.

7. Stage and commit (NEVER `git add -A`):
   git add super-gsd/skills/sgsd-orchestrate/SKILL.md
   git commit -m "feat(48-01): wire selectiveVTPCall consumer into orchestrator Step 6.X"
  </action>
  <verify>
    <automated>node super-gsd/tools/vtp-bridge/classify.cjs --self-test &amp;&amp; node super-gsd/scripts/lib/route-ledger.cjs --self-test &amp;&amp; node super-gsd/tools/dispatch-router/route.cjs --self-test</automated>
  </verify>
  <done>
    - SKILL.md contains a Step 6.X block referencing `selectiveVTPCall`, the Phase 45 stub at build.cjs:707-708, the failure path with `error_logged_at` surfacing rule, and the coexistence note with sgsd-vtp-enrichment.
    - super-gsd/tools/context-packet/build.cjs UNCHANGED (git diff empty).
    - All three self-tests still green (11/11, 15/15, 15/15).
    - Atomic commit: `feat(48-01): wire selectiveVTPCall consumer into orchestrator Step 6.X`.
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| caller -> selectiveVTPCall input | Untrusted: caller may attempt to bypass whitelist via crafted uncertainty_type, inject semantic-similarity fields, or exceed query length |
| selectiveVTPCall -> _callVtpTool shim -> MCP runtime | Semi-trusted: MCP server may return malformed payloads, time out, throw auth/validation/internal errors, or return prompt-injected content |
| selectiveVTPCall -> .planning/metrics/vtp-bridge-failures.jsonl | Append-only canonical stream; no read-back execution path; row content includes raw error_message but NEVER injected back into evidence_packet.results[] |
| selectiveVTPCall -> Phase 32 logRouteDecision -> route-decisions.jsonl | Append-only via existing trusted ledger surface; envelope-v1 schema enforced; closed-enum boundary |
| evidence_packet -> downstream Agent prompt (via Phase 45 context-packet) | Semi-trusted: evidence_packet body MAY contain prompt-injection in result excerpts; treated as data-not-instruction (mirror Phase 45 Lock 12) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-48-01 | Spoofing | selectiveVTPCall caller passing fake `uncertainty_type:'architecture_challenge'` from a phase whose Phase 47 decision was actually `claude` | mitigate | Defense-in-depth re-check at Gate 2 of `_selectiveVTPCallInternal`: import `route.VTP_WHITELIST` BY REFERENCE from Phase 47 and reject any uncertainty_type not in the frozen 3-entry list. Caller cannot mutate the whitelist (Object.freeze). Self-test F5 binds. |
| T-48-02 | Tampering | Caller injects `embedding`, `similarity_score`, `fuzzy_match`, or `cosine` field hoping bridge will route via semantic similarity (LOCK 11 violation) | mitigate | `_validateInput` enumerates banned fields and throws on presence. Lock 13 wrapper catches and returns `bridge_internal_error` sentinel with the validation message in `packet.error`. Self-test F9 binds. |
| T-48-03 | Tampering | MCP server returns prompt-injected content in result.excerpt that downstream Agent treats as instruction | accept | Bridge passes excerpt verbatim (data-not-instruction principle; mirror Phase 45 Lock 12). MCP server is the threat vector for this category; Phase 48 is not the right layer to mitigate. Phase 49 governance may add content-class quarantine in a future revision. |
| T-48-04 | Repudiation | Bridge call succeeds but no record of evidence provenance for later audit | mitigate | Every success/failure call emits TWO canonical rows: (a) `vtp-bridge-failures.jsonl` row on failure ONLY, (b) `route-decisions.jsonl` envelope-v1 row on EVERY call (success and failure). Both include `run_id`, `ts`, `phase`, `milestone`, `decision.{tool, uncertainty_type, result_count, body_token_estimate, error_logged_at}`. |
| T-48-05 | Information Disclosure | MCP error message leaks server-side state (file paths, internal IDs) into evidence_packet.results[] where Agent reflects it back to user | mitigate | Structural separation (A3 binding): failure path returns `results:[]` ALWAYS. Error text lives ONLY in `vtp-bridge-failures.jsonl`. Self-test F2 scans `JSON.stringify(packet)` for any error-token substrings (e.g. 'TIMEOUT', 'timeout after') and asserts NONE present. |
| T-48-06 | Denial of Service | Caller sends a 100KB query string causing MCP to OOM or block bridge for 30s with no caller-side cap | mitigate | `_validateInput` enforces `query.length <= 10000` (rejects with descriptive message). Per-call timeout `per_query_timeout_ms = 30000` (configurable in routes.yaml) bounded by `Promise.race` with AbortController. Bridge does NOT retry; one failed attempt = one failure row + empty packet. |
| T-48-07 | Denial of Service | MCP returns 30 results x 800 tokens each, blowing context-packet builder's 25000-token researcher budget | mitigate | Hard cap `evidence_packet_max_tokens = 5000` (configurable). Descending-relevance elision keeps top-N until cumulative tokens fit. `reason_codes` gains `'evidence_packet_size_capped'`. Self-test F3 binds. |
| T-48-08 | Elevation of Privilege | Local-implementation phase tries to fire VTP by passing `provider:'vtp'` directly to bridge, bypassing Phase 47's routing decision | mitigate | Bridge does NOT accept `provider` as input. Bridge accepts `uncertainty_type` ONLY. The closed-enum + frozen whitelist gate at Gate 2 rejects any non-whitelist value. Phase 47 routeDispatch is the single-source-of-truth for routing decisions; bridge re-checks the whitelist (defense in depth). Self-test F5 + F9 bind. |
| T-48-09 | Tampering | Forged provenance: MCP returns results with empty `doc_id` or `citation`, but the result body looks plausible and Agent treats it as cited research | mitigate | `_assertResultProvenance` rejects results with empty/missing doc_id (or `id` legacy field) AND empty citation. Rejected results count populates `rejected_provenance_count` in packet metadata. Self-test F8 binds (mixed-shape MCP responses). |
| T-48-10 | Information Disclosure | Self-test inadvertently writes to canonical `.planning/metrics/route-decisions.jsonl` or `vtp-bridge-failures.jsonl` during CI runs, polluting production telemetry | mitigate | All self-test writes use `fs.mkdtempSync(os.tmpdir(), 'vtp-bridge-')` for isolated tmpdir. Self-test F10 fingerprints (size+mtime) of `.planning/metrics/codex-log.jsonl`, `route-decisions.jsonl`, `vtp-health.jsonl` BEFORE and AFTER self-test and asserts UNCHANGED. F7 does the same for `super-gsd/tools/context-packet/build.cjs`, `super-gsd/tools/dispatch-router/route.cjs`, `super-gsd/scripts/lib/route-ledger.cjs`. |
| T-48-11 | Tampering | Caller mutates `VTP_TOOL_MAP` at runtime via `delete VTP_TOOL_MAP.book_lookup` to disable book lookups | mitigate | `VTP_TOOL_MAP` is `Object.freeze`'d at module-load (top-level + every inner entry + every `args_template`). Module-load assertion checks `Object.isFrozen(VTP_TOOL_MAP) && Object.keys(VTP_TOOL_MAP).length === 4`. |
| T-48-12 | Repudiation | Phase 32 ledger fails to record a vtp_bridge row (silent ledger drop) leaving no audit trail | mitigate | Phase 32 `logRouteDecision` is Lock-13 wrapped; on failure it returns `{ok:false, reason}` (does not throw). Phase 48 `_emitRouteLedgerRow` checks the result; on `ok:false` emits `console.warn` with the reason but does NOT block the bridge return path (Lock 13 + A3). Forensic operator-side detection: ledger row count vs vtp-bridge-failures.jsonl row count delta indicates ledger drops. Phase 50 cockpit may surface this delta. |

</threat_model>

<verification>

## Phase-Wide Verification

Run all three module self-tests sequentially. Every command MUST exit 0.

```bash
node super-gsd/tools/vtp-bridge/classify.cjs --self-test
# Expected: "Self-test: 11/11 passed (X ms)" -- F1-F10 + assertion 11 (defense-in-depth)

node super-gsd/scripts/lib/route-ledger.cjs --self-test
# Expected: "Self-test: 15/15 passed (X ms)" -- was 14; assertion 15 = vtp_bridge boundary smoke

node super-gsd/tools/dispatch-router/route.cjs --self-test
# Expected: "Self-test: 15/15 passed (X ms)" -- unchanged; no regression from new requirer

# Verify all 10 RESEARCH Section 10 fixture bindings as part of vtp-bridge self-test:
# F1 architecture_challenge -> vtp_search_substrate (assertion 1)
# F2 mcp_timeout -> failure-log + empty packet (assertion 2; A3 binding)
# F3 evidence_packet_size_capped (assertion 3; A4 binding)
# F4 book_lookup -> vtp_search_substrate with resource_subtype_filter:'book' (assertion 4)
# F5 synthesis_judgment -> not_routed_to_vtp + no MCP call (assertion 5; A1 + LOCK-11)
# F6 vtp-health unhealthy -> vtp_unavailable + no MCP call (assertion 6)
# F7 read-only invariant on Phase 45/47/32 source (assertion 7)
# F8 mixed-shape provenance gate (assertion 8)
# F9 LOCK-11 banned semantic fields (assertion 9)
# F10 read-only invariant on canonical .planning/metrics streams (assertion 10)

# Read-only invariant on Phase 45 source (mandatory):
git diff --stat super-gsd/tools/context-packet/
# Expected: empty (zero changes)

# Read-only invariant on canonical metrics streams (mandatory):
git diff --stat .planning/metrics/
# Expected: empty (zero changes; vtp-bridge-failures.jsonl writes only happen in self-test tmpdirs)

# ASCII-only invariant:
rg -n '[^\x00-\x7f]' super-gsd/tools/vtp-bridge/ super-gsd/tools/dispatch-router/routes.yaml
# Expected: no matches
# (route-ledger.cjs and SKILL.md may have pre-existing non-ASCII bytes; only NEW bytes from this phase must be ASCII)

# Forward-contract surface check:
ls super-gsd/tools/vtp-bridge/
# Expected: classify.cjs, EVIDENCE-PACKET.schema.json (and optionally classify.test.cjs if Wave 0 helper used)

# Defense-in-depth: Phase 47 VTP_WHITELIST identity check (single source of truth):
node -e "const r=require('./super-gsd/tools/dispatch-router/route.cjs'); const b=require('./super-gsd/tools/vtp-bridge/classify.cjs'); console.log('whitelist length:', r.VTP_WHITELIST.length, 'tool_map keys:', Object.keys(b.VTP_TOOL_MAP).length); process.exit(r.VTP_WHITELIST.length===3 && Object.keys(b.VTP_TOOL_MAP).length===4 ? 0 : 1);"
# Expected: "whitelist length: 3 tool_map keys: 4" exit 0
```

## Phase Acceptance Mapping

| Acceptance | Verification |
|------------|--------------|
| A1 (local phases do not call VTP by default) | F5 self-test fixture: synthesis_judgment -> {ok:false, reason:'not_routed_to_vtp'} + no MCP call attempted (shim throws SHOULD_NOT_BE_CALLED if hit) |
| A2 (research/book/prior-project/architecture-challenge can call VTP) | F1 + F4 self-test fixtures: architecture_challenge and book_lookup both round-trip to vtp_search_substrate with valid evidence packets |
| A3 (MCP failures logged separately) | F2 self-test fixture: TIMEOUT injection produces failure-log row AND empty results[]; JSON.stringify(packet) contains no error-token substrings |
| A4 (evidence packets source-backed AND compact) | F3 self-test fixture (5000-token cap with descending elision) + F8 self-test fixture (provenance gate admits/rejects mixed-shape responses) |
| A5 / LOCK-11 (no semantic-only routing) | F9 self-test fixture: embedding field rejected with LOCK-11 message; no semantic-similarity branching anywhere in classify.cjs (grep verifies) |
| LOCK-13 (never throws upward) | F9 self-test fixture: validation throw inside _selectiveVTPCallInternal caught by Lock 13 wrapper; bridge_internal_error sentinel returned |
| Phase 32 BOUNDARIES extension | route-ledger self-test grows 14->15 with vtp_bridge boundary smoke (assertion 15) |
| Phase 47 dispatch-router unchanged | self-test still 15/15 after Phase 48 ships |
| Phase 45 context-packet/build.cjs untouched | F7 fingerprint diff in vtp-bridge self-test + git diff --stat shows zero changes |

</verification>

<success_criteria>

Phase 48 is complete when ALL of the following hold:

1. `super-gsd/tools/vtp-bridge/classify.cjs` exists, is ASCII-only, exports the
   9-key public surface (`selectiveVTPCall`, `selectiveVTPCallForPacket`,
   `VTP_TOOL_MAP`, `VTP_BRIDGE_REASONS`, `FAILURE_KINDS`,
   `EVIDENCE_PACKET_MAX_TOKENS_DEFAULT`, `PER_QUERY_TIMEOUT_MS_DEFAULT`,
   `COMMAND_NAME`, `ENVELOPE_VERSION`), and `--self-test` exits 0 with `11/11
   passed` in <5s.

2. `super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json` exists, parses as
   valid JSON, declares `additionalProperties:false`, and lists the 10-field
   minimum required set.

3. `super-gsd/scripts/lib/route-ledger.cjs` `BOUNDARIES` length === 9 with
   `'vtp_bridge'` as the 9th entry; self-test exits 0 with `15/15 passed`.

4. `super-gsd/tools/dispatch-router/routes.yaml` has a new top-level
   `vtp_bridge:` section with `evidence_packet_max_tokens: 5000`,
   `per_query_timeout_ms: 30000`, `retry_on_timeout: false`. Existing `table:`
   block byte-unchanged.

5. `super-gsd/skills/sgsd-orchestrate/SKILL.md` has a new Step 6.X block
   referencing `selectiveVTPCall`, the Phase 45 build.cjs:707-708 stub, the
   failure path's `error_logged_at` surfacing rule, and the coexistence note
   with `sgsd-vtp-enrichment`.

6. Phase 47 `dispatch-router/route.cjs` self-test still exits 0 with `15/15
   passed` (no regression from new requirer).

7. Phase 45 `context-packet/build.cjs` source UNCHANGED (`git diff --stat` empty).

8. Canonical `.planning/metrics/{codex-log,route-decisions,vtp-health}.jsonl`
   streams UNCHANGED (`git diff --stat .planning/metrics/` empty;
   `vtp-bridge-failures.jsonl` is created by self-test only in fixture-scoped
   tmpdir, never in the canonical location during the planning/execute pass).

9. Three atomic commits in this exact order:
   - `feat(48-01): vtp-bridge/classify.cjs + VTP_TOOL_MAP + 10-assertion self-test`
   - `feat(48-01): extend route-ledger BOUNDARIES 8->9 with 'vtp_bridge'`
   - `feat(48-01): wire selectiveVTPCall consumer into orchestrator Step 6.X`

10. All 10 RESEARCH Section 10 self-test fixtures (F1-F10) present and passing inside
    `classify.cjs::_runSelfTest`, plus assertion 11 (defense-in-depth: Phase 47
    VTP_WHITELIST imported by reference, identity-checked at module load).

11. `Object.freeze` applied to: `VTP_TOOL_MAP`, every inner entry, every
    `args_template`, `VTP_BRIDGE_REASONS`, `FAILURE_KINDS`. Module-load assertion
    verifies `Object.isFrozen(VTP_TOOL_MAP) && Object.keys(VTP_TOOL_MAP).length === 4`.

12. No upward throw from any public API: `selectiveVTPCall` and
    `selectiveVTPCallForPacket` are Lock-13 wrapped (try/catch around
    `_selectiveVTPCallInternal` with sentinel return on any internal error).

13. No semantic-similarity routing anywhere: `_validateInput` enumerates banned
    fields `['embedding','similarity_score','fuzzy_match','cosine']` and rejects
    any of them (LOCK 11 reaffirmed); no codepath in `classify.cjs` branches
    on similarity scores or embeddings.

14. Defense-in-depth: `classify.cjs` imports `route.VTP_WHITELIST` BY REFERENCE
    from Phase 47 (verified by identity check in assertion 11) and re-checks
    membership at Gate 2 of `_selectiveVTPCallInternal`. The 4th `VTP_TOOL_MAP`
    entry (`research_external_validation`) is RESERVED -- defined but never
    selected because its key is NOT in Phase 47's whitelist.

15. Phase 49/50/51 forward contracts via SHAPE only (not by import). Phase 48
    produces canonical streams (`vtp-bridge-failures.jsonl` and
    `route-decisions.jsonl` rows where `boundary='vtp_bridge'`); no `require()`
    of any not-yet-shipped Phase 49/50/51 code.

</success_criteria>

<output>
After completion, create `.planning/milestones/v1.9/phases/48-selective-vtp-bridge/48-01-SUMMARY.md`
documenting:
- Files created/modified across the 3 atomic commits.
- Self-test counts (11/11, 15/15, 15/15) and one-line per-fixture binding rationale.
- Frozen consts shipped (4-entry VTP_TOOL_MAP, 10-entry VTP_BRIDGE_REASONS, 5-entry FAILURE_KINDS).
- Forward-contract surfaces produced (vtp-bridge-failures.jsonl shape;
  route-decisions.jsonl boundary='vtp_bridge' decision shape).
- Defense-in-depth invariant: Phase 47 VTP_WHITELIST imported by reference
  (identity check); Phase 45 source untouched (fingerprint diff).
- Lock-13 + A1-A5 + LOCK-11 binding evidence by self-test fixture ID.
- Out-of-scope items NOT shipped (per RESEARCH Section 13): new whitelist entries,
  retry policy, hot caching, cockpit display, utility scoring,
  validated_thought promotion, semantic-similarity routing.
</output>
