# Phase 48: Selective VTP Bridge — Research

**Researched:** 2026-04-27
**Domain:** VTP MCP routing / evidence packet construction / MCP failure isolation
**Confidence:** HIGH (all 12 questions LOCKED; every input surface verified in source)

---

## Summary

Phase 48 ships the **bridge** that consumes Phase 47's `{provider:'vtp'}` decision and actually CALLS one of the VTP MCP tools, returning a compact, source-backed evidence packet to the caller. v1.9 has built every input this bridge needs: Phase 47 already emits the route decision (with frozen 3-entry `VTP_WHITELIST`), Phase 45 step 7 reserves an `opts.route_hint.use_vtp` slot in `context-packet/build.cjs:707`, Phase 32 owns the route-decisions ledger with `BOUNDARIES` already extended to 8 entries (Phase 47 added `dispatch_route`), and the `mcp__vtp-kb__*` MCP tool family is the operational substrate. Phase 48 is the **wiring + classifier + failure-isolator**, not a new infrastructure layer.

Critical to A3 (MCP failure separation): Phase 48 introduces a NEW append-only canonical stream `.planning/metrics/vtp-bridge-failures.jsonl` whose entire purpose is to keep VTP MCP error/timeout/auth-fail rows visually and structurally distinguishable from the evidence packet path. When the MCP fails, the bridge returns an empty `results[]` packet plus an `error_logged_at` reference; it does NOT inject the error message into the packet body where downstream consumers might mistake it for a research conclusion. This is the same pattern Phase 14 codex-log uses (self-test rows live alongside dispatch rows but in distinct vocabularies).

A4 (compact + source-backed): Phase 48 caps each evidence packet at a configurable `evidence_packet_max_tokens` (default 5000, configurable in `routes.yaml`), enforces mandatory `source_refs[]` + `root_source_hashes[]` mirroring Phase 45 PACKET-13's validated_thought provenance gate (`build.cjs:220-234`), and requires every result row to carry a doc-ID citation. The classifier is mechanical (closed enum mapping uncertainty_type → VTP tool name), not heuristic.

**Primary recommendation:** Ship `super-gsd/tools/vtp-bridge/classify.cjs` exporting `selectiveVTPCall({uncertainty_type, query, source_refs_required:true, planningDir, _force_*}) → evidence_packet | {ok:false, reason}`. NEW module under `super-gsd/tools/` (mirrors `dispatch-router/`, `context-packet/`, `phase-capsule/` shape). Frozen 4-entry `VTP_TOOL_MAP` drives uncertainty_type → MCP tool selection. Extend `route-ledger.cjs::BOUNDARIES` from 8→9 entries (add `'vtp_bridge'`). All MCP failures route to `vtp-bridge-failures.jsonl` envelope-v1 rows. Self-test fixtures: 7 cases (4 happy paths × 4 whitelist types + MCP failure isolation + compactness cap + non-whitelist rejection + provenance enforcement + sentinel on VTP unavailable).

---

<user_constraints>

## User Constraints (from 48-CONTEXT.md + ROADMAP §48 + REQUIREMENTS.md)

### Locked Decisions

From `.planning/milestones/v1.9/phases/48-selective-vtp-bridge/48-CONTEXT.md` (verbatim goal):

> "Goal: make VTP useful without turning it into ambient bloat.
> Implement route-gated VTP calls for research-paper, book, prior-project, and architecture-challenge cases. MCP failures must be logged as provider/tool failures, not confused with research conclusions."

From ROADMAP.md §48 (verbatim acceptance):

- A1: local implementation phases do not call VTP by default
- A2: research/book/prior-project/architecture-challenge phases can call VTP
- A3: MCP validation/timeouts are logged separately from conclusions
- A4: VTP evidence packets are source-backed and compact
- A5: VTP routing consumes Intent English uncertainty type and relationship weights instead of firing from broad semantic similarity alone

From REQUIREMENTS.md VTPR-01..VTPR-06 (verbatim):

- VTPR-01: Implement selective VTP route classifier
- VTPR-02: Support research-paper, book, prior-project, and architecture challenge query types
- VTPR-03: Capture MCP failures separately from research conclusions
- VTPR-04: Write source-backed VTP evidence packets for agent use
- VTPR-05: Prove local-only phases do not call VTP ambiently
- VTPR-06: VTP routing consumes Intent English uncertainty type and relationship weights; VTP cannot be triggered by broad semantic similarity alone

From `.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md` (Architecture Matters More Than Scale):

> "Phase 47/48 routing should prefer structural predicates before semantic similarity."

From REQUIREMENTS.md design locks (LOCK 11 verbatim):

> "Intent relationships require explainable source reasons. Embedding or semantic similarity alone may suggest candidates, but it cannot justify broad context inclusion without structural evidence."

LOCK 11 is reaffirmed: VTP fires ONLY when uncertainty_type is in the frozen 3-entry whitelist Phase 47 already enforces. Phase 48 does NOT extend the whitelist; it CONSUMES it.

From REQUIREMENTS.md LOCK 13 (verbatim):

> "Autonomy continues; evidence tells the truth. Budget breaches degrade or reroute by policy. They do not become silent overrun."

Bridge MUST NOT throw upward on MCP failure. Always returns a packet (with `ok:true`+results OR `ok:false`+reason) AND appends one row to `vtp-bridge-failures.jsonl`. No silent degrade.

### Claude's Discretion

- Naming: bridge module path. RECOMMENDED: `super-gsd/tools/vtp-bridge/classify.cjs` (mirrors `dispatch-router/route.cjs` and `context-packet/build.cjs` patterns).
- Internal helper function names inside `classify.cjs`.
- Self-test assertion order and exact fixture text.
- Whether to expose a CLI `--bridge` mode (yes — mirror `dispatch-router/route.cjs --route` precedent).
- Whether the in-process VTP call is invoked via the orchestrator's MCP tool surface (`mcp__vtp-kb__*`) or a thin shim. RECOMMENDED: shim — Phase 48 ships `_callVtpTool(toolName, args)` that the orchestrator wires to its actual MCP runtime. Self-test uses a `_force_vtp_tool_response` injection for deterministic fixtures (mirrors Phase 47's `_force_codex_health` / `_force_vtp_health`).

### Deferred Ideas (OUT OF SCOPE)

- Adding new whitelist entries (Phase 49 or later may add via governance, not Phase 48).
- Caching VTP responses (Phase 52 may add Redis hot-cache for repeated queries; Phase 48 ships the round-trip without cache).
- Promoting VTP evidence packets to validated_thoughts (Phase 49 GOV-04 owns; Phase 48 only emits packets).
- Cockpit display of VTP bridge state (Phase 50 reads `vtp-bridge-failures.jsonl` + `route-decisions.jsonl rows where boundary='vtp_bridge'`).
- VTP bridge utility scoring (Phase 51 BENCH-07 reads packet rows + failure rows for utility_per_token).
- Wiring Phase 48 into Phase 45's `vtpPackets = []` stub at `context-packet/build.cjs:708`. Phase 45 explicitly defers this to "Phase 47/48". Phase 48 ships the bridge AND wires the stub; the wire-in is OWNED HERE.
- Semantic-similarity routing (LOCK 11 forbids).

</user_constraints>

---

<phase_requirements>

## Phase Requirements (REQUIREMENTS.md → Research Support)

| ID | Description | Research Support |
|----|-------------|------------------|
| VTPR-01 | Implement selective VTP route classifier | §3.1 (uncertainty_type → VTP tool mapping), §4 (frozen `VTP_TOOL_MAP`) |
| VTPR-02 | Support research-paper, book, prior-project, architecture challenge query types | §3.1 (4-entry tool map), §3.2 (VTP_WHITELIST consumption from Phase 47) |
| VTPR-03 | Capture MCP failures separately from research conclusions | §6 (failure isolation), §7 (`vtp-bridge-failures.jsonl` schema) |
| VTPR-04 | Write source-backed VTP evidence packets for agent use | §5 (evidence_packet shape with mandatory provenance), §8 (compactness cap) |
| VTPR-05 | Prove local-only phases do not call VTP ambiently | §3.2 (whitelist gate; non-whitelist returns `{ok:false, reason:'not_routed_to_vtp'}`), §10 self-test fixture F5 |
| VTPR-06 | VTP routing consumes Intent English uncertainty type | §3.3 (router contract: Phase 47 → Phase 48 input is uncertainty_type only; no semantic input field exists) |
| LOCK-11 | No semantic-only routing | §3.2 (whitelist + structural predicate; no embedding/similarity field accepted) |
| LOCK-13 | Never-throws contract | §9 (Lock 13 wrapper; sentinel on internal error) |

</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Map uncertainty_type → VTP MCP tool name | vtp-bridge/classify.cjs (NEW) | — | New module owns the mechanical mapping (closed enum) |
| Build evidence packet shape (results[], source_refs[], root_source_hashes[]) | vtp-bridge/classify.cjs (NEW) | — | New module — no existing surface produces VTP packets |
| Enforce evidence_packet_max_tokens cap | vtp-bridge/classify.cjs (NEW) | routes.yaml override (Phase 47 file) | Mirror Phase 45 enforceRoleBudget descending-weight elision |
| Validate source_refs[] + root_source_hashes[] mandatory | vtp-bridge/classify.cjs (NEW) | Phase 45 `_assertValidatedThoughtProvenance` (mirror) | One canonical provenance gate shape across v1.9 |
| Append MCP failure row | vtp-bridge/classify.cjs writes `.planning/metrics/vtp-bridge-failures.jsonl` (NEW canonical stream) | envelope-v1 schema (EXISTING) | New stream because EXISTING-SURFACE-AUDIT:139 forbids second route-decision ledger but allows new metrics streams (line 38: `context-complaints.jsonl`, `context-packet-log.jsonl` were both NEW) |
| Append vtp_bridge route decision row | route-ledger.cjs::logRouteDecision (EXISTING) | route-decisions.jsonl (EXISTING file) | EXISTING-SURFACE-AUDIT:139 — extend boundary, not ledger |
| Read Phase 47 routing decision | dispatch-router/route.cjs::routeDispatch (EXISTING) | VTP_WHITELIST const (EXISTING) | Phase 47 owns the routing decision; Phase 48 consumes it |
| Wire VTP packets into context-packet | context-packet/build.cjs:708 stub (EXISTING — empty array) | route_hint.use_vtp opts param (EXISTING — reserved at build.cjs:707) | Phase 45 deferred this to Phase 47/48; Phase 48 owns the wire-in |
| Call mcp__vtp-kb__* MCP tools | _callVtpTool() shim (NEW) | Orchestrator MCP runtime (EXISTING) | Bridge ships shim; orchestrator wires real MCP at runtime; self-test uses `_force_vtp_tool_response` |
| CLI/debug entry point | vtp-bridge/classify.cjs `--bridge` mode (NEW) | dispatch-router/route.cjs `--route` precedent | Mirror established pattern |

**Key architectural decision:** Phase 48 is the **CALLER** of VTP MCP tools; Phase 47 is the **DECIDER** that VTP should be called. They are separate concerns. Phase 47's contract emits `{provider:'vtp'}` (which means "this dispatch is permitted to use VTP"); Phase 48's contract takes (uncertainty_type, query) and emits (evidence_packet | failure_envelope). Phase 47 cannot accidentally fire VTP because it doesn't have the MCP tool surface — only Phase 48 does. This separation is the structural enforcement of A3 (separation of MCP failures from research conclusions).

**The `sgsd-vtp-enrichment` agent at `super-gsd/agents/sgsd-vtp-enrichment.md` is a SEPARATE concern.** That agent fires at Step 6.b.5 between gsd-phase-researcher and gsd-planner for OPTIONAL enrichment of phase RESEARCH.md (gated by `config.vtp_enrichment.enabled`). Phase 48's bridge is the GENERAL-PURPOSE selective VTP caller used during dispatch routing. Both coexist; Phase 48 does not replace the enrichment agent. The enrichment agent runs the 5-tool cascade for a different purpose (broad VTP enrichment of researcher findings); Phase 48 runs ONE targeted tool call per dispatch (selective).

---

## Standard Stack

### Core (already installed; consumed by reference)

| Library / Module | Version / Path | Purpose | Why Standard |
|------------------|---------------|---------|--------------|
| `route-ledger.cjs` | super-gsd/scripts/lib/route-ledger.cjs | Append envelope-v1 rows to route-decisions.jsonl with `boundary='vtp_bridge'` | Phase 32 owner; Phase 47 already extended to 8 boundaries; LOCK 13 binding (never throws) |
| `dispatch-router/route.cjs` | super-gsd/tools/dispatch-router/route.cjs | Read VTP_WHITELIST const + UNCERTAINTY_TYPES const | Phase 47 owner; frozen 3-entry whitelist + 6-entry uncertainty types; routeDispatch returns `{provider:'vtp'}` on match |
| `context-packet/build.cjs` | super-gsd/tools/context-packet/build.cjs:707 | `opts.route_hint.use_vtp` reserved param + `_vtp_packets[]` stub at line 708 | Phase 45 left explicit forward-contract slot for Phase 48 |
| `_assertValidatedThoughtProvenance` | super-gsd/tools/context-packet/build.cjs:220-234 | Reference shape for source_refs[] + root_source_hashes[] mandatory enforcement | Mirror Phase 45 PACKET-13 — one provenance gate vocabulary |
| `mcp__vtp-kb__vtp_search_substrate` | RUNTIME MCP tool | Architecture/book content search (1+2 of 5-tool cascade) | Phase 21+ stable surface; Phase 14 reference verdict |
| `mcp__vtp-kb__wiki_search` | RUNTIME MCP tool | Prior-project memory lookup | VTP wiki holds people/projects/ideas/analyses (per memory feedback "feedback_vtp_search_layer_routing") |
| `mcp__vtp-kb__vtp_route_and_retrieve` | RUNTIME MCP tool | Research-paper external validation (orchestrated retrieval) | Phase 14 reference; complete-on-empty contract |
| `mcp__vtp-kb__vtp_get_research` | RUNTIME MCP tool | Specific research paper by doc-ID | Phase 14 reference |
| `mcp__vtp-kb__vtp_health_structured` | RUNTIME MCP tool | Health probe (already used by sgsd-vtp-enrichment agent + orchestrator Step 3.7) | Phase 21 owner; doesn't change in Phase 48 — bridge consumes existing vtp-health.jsonl tail (Phase 47 pattern) |
| Phase 47 PROVIDERS const | super-gsd/tools/token-attribution/report.cjs:79-81 | Frozen 4-entry `['claude','codex','local-script','vtp']` | Phase 41 owner; ENV CHECK: Phase 48 verified `PROVIDERS.includes('vtp') === true` |

### NEW (Phase 48 ships)

| File | Purpose | Mirror |
|------|---------|--------|
| `super-gsd/tools/vtp-bridge/classify.cjs` | `selectiveVTPCall()` + `VTP_TOOL_MAP` + `EVIDENCE_PACKET_REASON_CODES` + CLI `--bridge`/`--self-test` | `dispatch-router/route.cjs` (size ~700 lines, shape, never-throws contract) |
| `super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json` | Manual shape doc for evidence_packet | `context-packet/PACKET.schema.json` |
| `.planning/metrics/vtp-bridge-failures.jsonl` | Append-only canonical stream for MCP failures (NEW) | `vtp-health.jsonl` shape (Phase 32 surface) |

### Optional config extension

Phase 48 EXTENDS `super-gsd/tools/dispatch-router/routes.yaml` with a NEW top-level key:

```yaml
schema_version: 1
table:
  # ... (Phase 47 untouched)
vtp_bridge:                          # NEW (Phase 48 adds)
  evidence_packet_max_tokens: 5000
  per_query_timeout_ms: 30000
  retry_on_timeout: false           # bridge does NOT retry; failure -> log + return empty
```

Compiled fallback hard-codes `5000`/`30000`/`false` if section absent. Mirrors Phase 47's `loadRoutes()` pattern (route.cjs:321-378).

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Decision |
|------------|-----------|----------|----------|
| New `classify.cjs` module | Extend `dispatch-router/route.cjs::routeDispatch` to also call MCP | Phase 47 routeDispatch is read-only/decision-only by design (no MCP surface); merging would conflate decision with side-effect | REJECTED — separate concerns |
| New `vtp-bridge-failures.jsonl` | Extend `vtp-health.jsonl` with failure rows | vtp-health.jsonl is the COLD-START PROBE log (one row per session); mixing per-call failures into it muddies its semantics | NEW stream chosen |
| New `vtp-bridge-failures.jsonl` | Append failures to `route-decisions.jsonl` with `status='fail'` | Already done (Phase 48 emits both rows) — but route-decisions is a DECISION ledger; bridge call FAILURES need their own row with tool/error_type/error_message detail | BOTH chosen (decision row + failure row; differentiated by `command` field) |
| New module under `super-gsd/scripts/lib/` | Module under `super-gsd/tools/vtp-bridge/` | `tools/` is the established pattern for self-tested deliverables (token-waste, phase-capsule, context-packet, dispatch-router); `lib/` is for orchestrator-internal lib code | tools/ chosen |
| Sync MCP call per dispatch | Always async with timeout (per_query_timeout_ms=30000) | VTP MCP can take 60+ seconds per Phase 14 cross-check; sync would block orchestrator loop | timeout chosen |
| Wrap MCP calls in fresh Promise.race | Use orchestrator's existing MCP timeout (Step 3.7 pattern) | The Step 3.7 timeout fires once at session start; per-call timeout is a different contract | NEW timeout chosen (per-call) |

### Verified versions

```bash
# Phase 47 VTP_WHITELIST (verbatim from route.cjs:175-179)
VTP_WHITELIST = Object.freeze([
  'architecture_challenge',
  'prior_memory_lookup',
  'book_lookup',
])  # 3-entry frozen — Phase 48 consumes; does NOT extend

# Phase 47 UNCERTAINTY_TYPES (verbatim from route.cjs:77-84)
UNCERTAINTY_TYPES = Object.freeze([
  'deterministic_extraction',
  'bounded_code_review',
  'synthesis_judgment',
  'architecture_challenge',     # Phase 48 maps to vtp_search_substrate
  'prior_memory_lookup',        # Phase 48 maps to wiki_search
  'book_lookup',                # Phase 48 maps to vtp_search_substrate (filter)
])  # 6-entry frozen

# Phase 32 BOUNDARIES at HEAD (route-ledger.cjs:66-75)
BOUNDARIES = Object.freeze([
  'milestone_promotion','phase_dispatch_first','executor_choice',
  'gate_skip','codex_route','handoff_decision','gate_override','dispatch_route',
])  # 8-entry — Phase 48 adds 9th: 'vtp_bridge'

# Phase 41 PROVIDERS (verbatim from token-attribution/report.cjs:79-81)
PROVIDERS = Object.freeze(['claude', 'codex', 'local-script', 'vtp'])  # 4-entry frozen
```

---

## Architecture Patterns

### Module shape (mirror dispatch-router/route.cjs and context-packet/build.cjs)

```
super-gsd/tools/vtp-bridge/
├── classify.cjs                    # selectiveVTPCall() + VTP_TOOL_MAP + CLI + self-test (~700 lines)
├── EVIDENCE-PACKET.schema.json     # Manual shape doc (mirror PACKET.schema.json)
└── classify.test.cjs               # Optional alongside-self-test fixtures (Wave 0 if needed)
```

### System data flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Phase 47 routeDispatch returns {provider:'vtp', reason:               │
│  'matched_uncertainty_type', primary_provider:'vtp', ...}              │
│  (architecture_challenge | prior_memory_lookup | book_lookup)          │
└──────────────────────┬───────────────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ Caller (orchestrator or Phase 45 │
        │ context-packet step 7) calls:    │
        │ selectiveVTPCall({               │
        │   uncertainty_type, query,       │
        │   source_refs_required: true,    │
        │   planningDir, milestone, phase  │
        │ })                               │
        └──────────┬───────────────────────┘
                   │
   ┌───────────────┼─────────────────────────────────────────┐
   ▼               ▼                ▼                        ▼
[validate    [look up VTP_TOOL  [check vtp-       [load max_tokens
 enums]      _MAP for uncert.   health.jsonl       from routes.yaml
             type]              tail]              vtp_bridge.* override
                                                   or compiled fallback]
                   │
                   ▼
        ┌──────────────────────────────────┐
        │ Decide call:                     │
        │   1. uncertainty_type NOT in     │
        │      VTP_WHITELIST  → return     │
        │      {ok:false, reason:          │
        │       'not_routed_to_vtp'}       │
        │   2. vtp-health unhealthy →      │
        │      log to vtp-bridge-failures, │
        │      return {ok:false, reason:   │
        │       'vtp_unavailable'}         │
        │   3. dispatch _callVtpTool(      │
        │      tool_name, query)           │
        │      with per_query_timeout_ms   │
        │      AbortController             │
        └──────────┬───────────────────────┘
                   │
        ┌──────────┴──────────────┐
        ▼                         ▼
   [MCP success]            [MCP timeout / error / auth-fail]
        │                         │
        ▼                         ▼
   ┌─────────────────────┐   ┌─────────────────────────────┐
   │ Build evidence_     │   │ Append row to               │
   │ packet:             │   │ vtp-bridge-failures.jsonl:  │
   │  - vtp_tool         │   │   {envelope_version:1,      │
   │  - query            │   │    ts, command:             │
   │  - results[]        │   │    'vtpBridgeFailure',      │
   │     each with       │   │    status:'fail'|'timeout', │
   │     citation        │   │    tool, error_type,        │
   │  - source_refs[]    │   │    error_message,           │
   │  - root_source_     │   │    retry_at:null,           │
   │     hashes[]        │   │    duration_ms}             │
   │  - confidence       │   │                             │
   │  - retrieved_at     │   │ Build empty packet:         │
   │  - compression_     │   │  - results: []              │
   │    level:           │   │  - error_logged_at: <path>  │
   │    'validated_      │   │    +offset                  │
   │    thought'         │   │  - source_refs: []          │
   │                     │   │                             │
   │ Enforce 5000-token  │   │ Result MUST NOT contain     │
   │ cap (descending     │   │ the error message in any    │
   │ relevance elision)  │   │ result-shaped field         │
   │                     │   │ (A3 binding)                │
   └────────┬────────────┘   └────────┬────────────────────┘
            │                          │
            └──────────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────────────────┐
                │ Append envelope-v1 row to        │
                │ route-decisions.jsonl via        │
                │ route-ledger::logRouteDecision   │
                │ {boundary:'vtp_bridge',          │
                │  status:'ok'|'fail'|'timeout',   │
                │  reason_codes,                   │
                │  decision: <packet metadata>}    │
                └──────────────┬───────────────────┘
                               │
                               ▼
                Caller (orchestrator / Phase 45 step 7) receives:
                  evidence_packet (always — empty results[] on failure)
                  Caller decides:
                    - context-packet builder appends to _vtp_packets[]
                    - orchestrator dispatches downstream agent
                    - Phase 49 reads vtp-bridge-failures.jsonl for governance
                    - Phase 51 BENCH reads both for utility_per_token
```

### Recommended directory structure

```
super-gsd/tools/vtp-bridge/
├── classify.cjs            # Public API + CLI + self-test
├── classify.test.cjs       # Optional alongside-self-test (Wave 0 if needed)
└── EVIDENCE-PACKET.schema.json  # Manual schema doc
```

### Pattern 1: Frozen enum + closed mapping (mirror Phase 47)

```javascript
// Source: dispatch-router/route.cjs:77-84 verbatim shape
// Phase 48 frozen 4-entry tool map. NEVER extends without phase ROADMAP entry.
const VTP_TOOL_MAP = Object.freeze({
  architecture_challenge: Object.freeze({
    tool: 'vtp_search_substrate',
    args_template: { source_types: ['research', 'wiki_page'] },  // architecture content
    rationale: 'architecture-research and book substrate search'
  }),
  prior_memory_lookup: Object.freeze({
    tool: 'wiki_search',
    args_template: { resource_type: 'wiki_page', tier: ['people','projects','ideas','analyses'] },
    rationale: 'wiki holds prior-project memory per memory feedback layer routing rule'
  }),
  book_lookup: Object.freeze({
    tool: 'vtp_search_substrate',
    args_template: { source_types: ['wiki_page'], resource_subtype_filter: 'book' },
    rationale: 'books are stored as wiki_page with subtype filter (per VTP cross-check 2026-04-27)'
  }),
  research_external_validation: Object.freeze({  // RESERVED — added by Phase 49 governance, not Phase 48
    tool: 'vtp_route_and_retrieve',
    args_template: {},
    rationale: 'orchestrated retrieval — gated for v1.10+'
  }),
});

// Phase 48 ONLY ships the first 3 entries as ACTIVE; research_external_validation
// is RESERVED (defined but never selected by classifier because uncertainty_type
// is not in Phase 47's whitelist). Self-test fixture F4 verifies reservation.

const EVIDENCE_PACKET_REASON_CODES = Object.freeze([
  'vtp_call_succeeded',
  'vtp_call_timeout',
  'vtp_call_auth_failed',
  'vtp_call_validation_failed',
  'vtp_call_returned_empty',
  'not_routed_to_vtp',                  // uncertainty_type not in whitelist
  'vtp_unavailable',                    // health probe failed
  'evidence_packet_size_capped',        // results elided to fit max_tokens
  'evidence_packet_provenance_failed',  // source_refs missing on returned results
  'bridge_internal_error',              // Lock 13 sentinel
]);
```

### Pattern 2: Evidence packet construction (mirror Phase 45 validated_thought)

```javascript
// Source: context-packet/build.cjs:220-234 verbatim shape
// VTP evidence packet shape — mandatory provenance enforced at construction.
function _buildEvidencePacket(uncertainty_type, query, mcp_response, opts) {
  // Step 1: extract results from MCP response shape (varies per tool).
  const raw_results = _extractResults(mcp_response, VTP_TOOL_MAP[uncertainty_type].tool);

  // Step 2: provenance gate — every result MUST have source_refs + root_source_hashes
  // mirror Phase 45 PACKET-13 (build.cjs:220-234).
  const admitted = [];
  const rejected = [];
  for (const r of raw_results) {
    const gate = _assertResultProvenance(r);
    if (gate.ok) admitted.push(r);
    else rejected.push({ result: r, reason: gate.reason });
  }

  // Step 3: cap at evidence_packet_max_tokens (descending relevance elision).
  const max_tokens = (opts.routes_yaml && opts.routes_yaml.vtp_bridge
                       && opts.routes_yaml.vtp_bridge.evidence_packet_max_tokens) || 5000;
  const capped = _enforcePacketCap(admitted, max_tokens);

  return Object.freeze({
    envelope_version: 1,
    ts: new Date().toISOString(),
    command: 'vtpBridgeEvidence',
    ok: true,
    vtp_tool: VTP_TOOL_MAP[uncertainty_type].tool,
    uncertainty_type: uncertainty_type,
    query: query,
    results: capped.kept,                       // [{title, doc_id, citation, excerpt, ...}]
    source_refs: capped.kept.map(r => r.doc_id),
    root_source_hashes: capped.kept.map(r => r.content_hash || _sha256(r.excerpt)),
    confidence: capped.kept.length > 0 ? 'medium' : 'low',
    retrieved_at: new Date().toISOString(),
    elided_count: capped.elided.length,
    rejected_provenance_count: rejected.length,
    compression_level: 'validated_thought',     // matches Phase 45 vocabulary
    body_token_estimate: capped.tokens,
    error_logged_at: null,                       // populated only on failure path
    reason_codes: capped.elided.length > 0
      ? ['vtp_call_succeeded', 'evidence_packet_size_capped']
      : ['vtp_call_succeeded'],
  });
}

// Mirror Phase 45 _assertValidatedThoughtProvenance (build.cjs:220-234).
function _assertResultProvenance(result) {
  if (!result || typeof result !== 'object') {
    return { ok: false, reason: 'result_not_object' };
  }
  const has_doc_id = typeof result.doc_id === 'string' && result.doc_id.length > 0;
  const has_citation = typeof result.citation === 'string' && result.citation.length > 0;
  if (!has_doc_id || !has_citation) {
    return { ok: false, reason: 'result_missing_provenance: doc_id or citation empty/missing' };
  }
  return { ok: true };
}
```

### Pattern 3: MCP failure isolation (the core A3 binding)

```javascript
// Source: route-ledger.cjs:211-218 verbatim shape (never-throws + envelope row)
function _logVtpBridgeFailure(planningDir, payload) {
  try {
    const row = {
      envelope_version: 1,
      ts: new Date().toISOString(),
      command: 'vtpBridgeFailure',
      status: payload.status,                   // 'fail' | 'timeout' | 'auth_failed'
      reason_codes: payload.reason_codes || [],
      tool: payload.tool,
      uncertainty_type: payload.uncertainty_type,
      error_type: payload.error_type,           // 'mcp_unreachable' | 'mcp_timeout'
                                                //  | 'mcp_validation' | 'mcp_auth' | 'mcp_internal'
      error_message: payload.error_message,     // raw error text — DOES NOT enter packet
      retry_at: null,                            // Phase 48 does NOT auto-retry
      duration_ms: payload.duration_ms,
      query: payload.query,                     // for forensics; capped at 200 chars
      run_id: _generateRunId(),                  // mirror route-ledger generateRunId
    };
    const p = path.join(planningDir, 'metrics', 'vtp-bridge-failures.jsonl');
    if (!fs.existsSync(path.dirname(p))) fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.appendFileSync(p, JSON.stringify(row) + '\n', 'utf8');
    return { ok: true, path: p, byte_offset: fs.statSync(p).size };
  } catch (e) {
    console.warn('[SGSD] vtp-bridge _logVtpBridgeFailure failed:', e.message);
    return { ok: false, reason: 'failure_log_unwritable' };
  }
}

// On failure, the empty evidence_packet returned to caller references the
// failure log — but does NOT contain the error text in any result-shaped field.
// This is the structural enforcement of A3.
function _buildFailureSentinelPacket(uncertainty_type, query, failure_log_result) {
  return Object.freeze({
    envelope_version: 1,
    ts: new Date().toISOString(),
    command: 'vtpBridgeEvidence',
    ok: false,                                   // ← caller checks this
    vtp_tool: VTP_TOOL_MAP[uncertainty_type] && VTP_TOOL_MAP[uncertainty_type].tool || null,
    uncertainty_type: uncertainty_type,
    query: query,
    results: [],                                  // ← always empty on failure
    source_refs: [],
    root_source_hashes: [],
    confidence: 'low',
    retrieved_at: null,
    error_logged_at: failure_log_result.ok
      ? `${failure_log_result.path}:byte_offset=${failure_log_result.byte_offset}`
      : null,
    reason_codes: ['vtp_call_timeout'],          // or other failure code
    compression_level: null,
  });
}
```

### Pattern 4: Route-ledger emission (mirror Phase 47)

```javascript
// Source: dispatch-router/route.cjs internal pattern (route-decisions emission)
// Phase 48 emits ONE additional row per call with boundary='vtp_bridge'.
function _emitRouteLedgerRow(planningDir, packet, opts) {
  try {
    const rl = require('../../scripts/lib/route-ledger.cjs');
    const status = packet.ok
      ? (packet.reason_codes.includes('evidence_packet_size_capped') ? 'warn' : 'ok')
      : (packet.reason_codes.includes('vtp_call_timeout') ? 'timeout' : 'fail');
    rl.logRouteDecision(planningDir, {
      boundary: 'vtp_bridge',                    // NEW Phase 48 boundary value
      status,
      phase: opts.phase,
      milestone: opts.milestone,
      reason_codes: packet.reason_codes,
      decision: {
        tool: packet.vtp_tool,
        uncertainty_type: packet.uncertainty_type,
        query_length: (packet.query || '').length,
        result_count: (packet.results || []).length,
        source_refs_count: (packet.source_refs || []).length,
        elided_count: packet.elided_count || 0,
        body_token_estimate: packet.body_token_estimate || 0,
        error_logged_at: packet.error_logged_at || null,
      },
    });
  } catch (e) {
    console.warn('[SGSD] vtp-bridge _emitRouteLedgerRow failed:', e.message);
  }
}
```

### Anti-Patterns to Avoid

- **Putting MCP error text in packet.results[].** A3 binding. Result rows are research conclusions; errors belong in `vtp-bridge-failures.jsonl`. Self-test fixture F2 binds.
- **Silent retry.** Phase 48 ships no retry logic. Failure → log + empty packet. If a phase needs retry behavior, Phase 49 governance owns the policy.
- **Throwing on MCP timeout.** Lock 13 + Phase 32 contract. Always log + return sentinel packet with `ok:false`.
- **Inventing a second route ledger.** EXISTING-SURFACE-AUDIT:139. Use route-decisions.jsonl with `boundary='vtp_bridge'`. (`vtp-bridge-failures.jsonl` is a NEW failure stream, not a route ledger.)
- **Routing VTP from semantic similarity.** LOCK 11. Bridge accepts ONLY `uncertainty_type` (closed enum) — there is no `query_embedding` or `similarity_score` field in the input shape. Self-test fixture F5 binds.
- **Bypassing the 3-entry whitelist.** A1 binding. If uncertainty_type is `synthesis_judgment`, `deterministic_extraction`, or `bounded_code_review`, return `{ok:false, reason:'not_routed_to_vtp'}` immediately. Self-test fixture F5 binds.
- **Hard-coding evidence_packet_max_tokens.** routes.yaml `vtp_bridge.evidence_packet_max_tokens` is the override surface. Compiled fallback (5000) is the floor.
- **Confusing Phase 48 with sgsd-vtp-enrichment agent.** The enrichment agent fires once per phase between researcher and planner; Phase 48 fires per-dispatch as part of the routing decision. Both call VTP MCP tools. Both coexist. Bridge does NOT replace the enrichment agent.
- **Treating an empty results[] as a failure.** A successful VTP call that returns zero hits is `{ok:true, results:[], reason_codes:['vtp_call_returned_empty']}`. Failure (`ok:false`) is reserved for MCP timeout/error/unhealthy.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Append envelope-v1 rows | A new JSONL writer | `route-ledger.cjs::logRouteDecision` (existing) | Phase 32 owner; envelope-v1 conformance; never-throws; Phase 47 already extended boundaries |
| Validate envelope-v1 schema | A new schema check | `route-ledger.cjs::_assertEnvelopeV1` (called inside logRouteDecision) | Mirror across all v1.7-v1.9 streams |
| Provenance gate (source_refs / root_source_hashes mandatory) | A new gate | Mirror `_assertValidatedThoughtProvenance` from Phase 45 (build.cjs:220-234) | Same vocabulary across v1.9; reuse the canonical gate name |
| VTP health probe | A new MCP call | Read `.planning/metrics/vtp-health.jsonl` last row (Phase 32 surface; Phase 47 already does this) | One canonical surface; cold-start probe already runs at orchestrator Step 3.7 |
| Evidence packet token estimation | A new estimator | Mirror `_estimateTokens` from `context-packet/build.cjs:208-215` | Same word-count × 1.3 heuristic; consistent across packet writers |
| run_id generation | A new formatter | `route-ledger.cjs::generateRunId` (existing) | envelope-v1 conformance |
| YAML parsing | A new yaml dep | Pinned `super-gsd/tools/plan-schema/node_modules/js-yaml` | Same pattern Phase 47 uses (route.cjs:339-348) |
| MCP tool surface | New MCP client | Orchestrator-supplied `_callVtpTool(toolName, args)` shim | Phase 48 ships shim signature; orchestrator wires actual MCP runtime |
| Per-call timeout | New timeout helper | `Promise.race([_callVtpTool(...), _timeoutAfter(ms)])` (Node 18+ native) | Standard pattern; no new dep |
| Frozen enums | New enum machinery | `Object.freeze` (already canonical pattern across Phase 41/42/45/47) | Drift between sources is BUDGET-03 violation |

**Key insight:** Phase 48 is a **bridging phase**, not a new-surface phase. v1.9 deliberately built every input it consumes (Phase 45 stub, Phase 47 routing decision, Phase 32 ledger, MCP tool family). Hand-rolling any of those would violate the milestone's compression-not-discovery thesis. The ONLY new surface Phase 48 creates is `vtp-bridge-failures.jsonl` — and that's specifically because A3 demands MCP failures live in their own stream, not muddled with research conclusions.

---

## Common Pitfalls

### Pitfall 1: Confusing "VTP returned no hits" with "VTP MCP failed"

**What goes wrong:** Bridge calls `vtp_search_substrate` with a query the corpus doesn't cover. MCP returns `{ok:true, hits:[]}`. Bridge incorrectly logs this as a failure to vtp-bridge-failures.jsonl, skewing the failure rate metric.
**Why it happens:** Conflating empty result with error.
**How to avoid:** `ok:true, results:[], reason_codes:['vtp_call_returned_empty']` is the success-with-empty path. NO failure row written. Mirrors sgsd-vtp-enrichment agent's `status: 'empty_hit'` (separate from `status: 'api_error'`).
**Warning signs:** vtp-bridge-failures.jsonl rows where `error_type === 'mcp_unreachable'` AND zero `error_message` text.

### Pitfall 2: Embedding the MCP error message in evidence_packet.results[]

**What goes wrong:** MCP times out at 30s. Bridge appends to results[] a row like `{title:"VTP Error", excerpt:"timeout after 30000ms"}`. Downstream consumer (Phase 45 packet builder) treats it as a research conclusion.
**Why it happens:** Naive packet construction that doesn't distinguish success/failure paths.
**How to avoid:** A3 enforced structurally: failure path returns `{ok:false, results:[]}` ALWAYS. The `error_logged_at` field is the ONLY back-reference to the error text. Self-test fixture F2 (compares packet body for any error text token) binds.
**Warning signs:** Phase 45 context-packet entries containing the literal string "timeout" or "MCP error" in the body text.

### Pitfall 3: Whitelist bypass via task_kind cleverness

**What goes wrong:** Caller passes `uncertainty_type: 'synthesis_judgment'` (not in VTP_WHITELIST) but `task_kind: 'lookup'`. Caller hopes bridge will infer it should call VTP.
**Why it happens:** Loose binding between Phase 47 routing decision and Phase 48 call.
**How to avoid:** Bridge ONLY accepts uncertainty_type as a routing input. There is no `task_kind` field in the bridge's input shape. The whitelist is enforced at line 1 of `selectiveVTPCall`; non-whitelist types return `{ok:false, reason:'not_routed_to_vtp'}` before any MCP call. Self-test fixture F5 binds.
**Warning signs:** route-decisions.jsonl rows with `boundary='vtp_bridge'` AND `decision.uncertainty_type` not in `['architecture_challenge','prior_memory_lookup','book_lookup']`.

### Pitfall 4: Evidence packet too large to fit downstream packet budget

**What goes wrong:** VTP returns 30 substrate hits, each with 800-token excerpts. Bridge returns the full 24,000-token packet. Phase 45 packet builder (researcher budget 25,000) chokes.
**Why it happens:** No per-packet cap.
**How to avoid:** `evidence_packet_max_tokens=5000` (configurable in routes.yaml). Descending-relevance elision: keep top-N results until cumulative tokens fit; emit `reason_codes: ['vtp_call_succeeded', 'evidence_packet_size_capped']` and populate `elided_count`. Mirrors Phase 45 `enforceRoleBudget` (build.cjs:538-575).
**Warning signs:** Phase 50 cockpit shows VTP packets routinely consuming >50% of researcher token budget.

### Pitfall 5: Silent VTP unavailability

**What goes wrong:** vtp-health.jsonl tail says `vtp_available: false`. Bridge calls MCP anyway, gets timeout, logs failure, returns empty packet. Each call wastes 30s.
**Why it happens:** Not consulting the health probe before calling.
**How to avoid:** Step 1 of `selectiveVTPCall` reads vtp-health.jsonl tail (mirror Phase 47 `_vtpHealthFromLog` route.cjs:262-293). If unhealthy, return `{ok:false, reason:'vtp_unavailable'}` immediately — no MCP call, no timeout. Single failure row written referencing the health-probe state. Self-test fixture F6 binds.
**Warning signs:** vtp-bridge-failures.jsonl shows runs of timeout rows ALL within seconds of each other and no vtp-health.jsonl `vtp_available:true` row in between.

### Pitfall 6: Provenance gate too strict, dropping all results

**What goes wrong:** MCP returns 10 valid results but their `doc_id` field is named `id` (older VTP version). Provenance gate rejects all 10. Bridge returns empty packet. Caller thinks VTP has no coverage.
**Why it happens:** Field-name brittleness in `_assertResultProvenance`.
**How to avoid:** Gate accepts EITHER `doc_id` OR `id` field for provenance. If `result.id` is present, treat as `doc_id`. Document this in `EVIDENCE-PACKET.schema.json`. Self-test fixture F8 (mixed-shape MCP responses) binds.
**Warning signs:** vtp-bridge-failures.jsonl rows where `error_type === 'mcp_validation'` AND `result_count > 0` AND `admitted_count === 0`.

### Pitfall 7: Wiring Phase 45 stub backwards

**What goes wrong:** Phase 48 author wires Phase 45's `vtpPackets[]` stub at `context-packet/build.cjs:708` by IMPORTING from context-packet — but context-packet already imports from many tools, creating a circular dep. Or the wire-in mutates Phase 45 source and Phase 45's self-test breaks.
**Why it happens:** Naive wire-in.
**How to avoid:** The wire-in is at the CALLER of `buildPacket`, not inside `build.cjs`. The caller (orchestrator Step 6.X or a future Phase 49 hook) calls Phase 48's `selectiveVTPCall` FIRST when `route_hint.use_vtp === true`, then passes the result into `buildPacket(opts.intent_map, role, {route_hint, _vtp_packets: [evidence_packet]})`. Phase 45 source is NEVER modified. Phase 48 ships an OPTIONAL helper `selectiveVTPCallForPacket(intent_map, opts)` that the caller composes. Self-test fixture F7 binds (verifies context-packet/build.cjs source unchanged via fingerprint diff).
**Warning signs:** context-packet/build.cjs mtime changes during Phase 48 wave; or context-packet self-test failures after Phase 48 ships.

---

## Code Examples

Verified patterns from existing surfaces — Phase 48 must mirror these 1:1.

### Example 1: Module export shape (mirror dispatch-router/route.cjs:1090-1102)

```javascript
// Source: super-gsd/tools/dispatch-router/route.cjs:1090-1102 verbatim shape
module.exports = {
  // Public APIs (Lock 13 wrapped):
  selectiveVTPCall,
  selectiveVTPCallForPacket,    // optional helper for Phase 45 wire-in (caller composes)
  // Frozen consts:
  VTP_TOOL_MAP,
  EVIDENCE_PACKET_REASON_CODES,
  EVIDENCE_PACKET_MAX_TOKENS_DEFAULT,    // 5000
  PER_QUERY_TIMEOUT_MS_DEFAULT,           // 30000
  // Identifiers:
  COMMAND_NAME,        // 'selectiveVTPCall'
  ENVELOPE_VERSION,    // 1
};
```

### Example 2: Never-throws-upward wrapper (mirror dispatch-router/route.cjs:636-658)

```javascript
// Source: super-gsd/tools/dispatch-router/route.cjs:636-658 verbatim shape
function selectiveVTPCall(input) {
  try {
    return _selectiveVTPCallInternal(input);
  } catch (e) {
    console.warn('[SGSD] vtp-bridge selectiveVTPCall failed:', e.message);
    // Lock 13 binding: never propagate; caller stays on safe default (empty packet).
    // No MCP call attempted, no failure row written (the THIS THROW is logged via
    // console.warn for forensics).
    return {
      envelope_version: 1,
      ts: new Date().toISOString(),
      command: 'vtpBridgeEvidence',
      ok: false,
      vtp_tool: null,
      uncertainty_type: input && input.uncertainty_type || null,
      query: input && input.query || null,
      results: [],
      source_refs: [],
      root_source_hashes: [],
      confidence: 'low',
      retrieved_at: null,
      error_logged_at: null,
      reason_codes: ['bridge_internal_error'],
      compression_level: null,
      error: e.message,
    };
  }
}
```

### Example 3: Frozen-enum input validation (mirror dispatch-router/route.cjs:187-212)

```javascript
// Source: super-gsd/tools/dispatch-router/route.cjs:187-212 verbatim shape
const ALLOWED_UNCERTAINTY_TYPES = Object.freeze([
  'architecture_challenge', 'prior_memory_lookup', 'book_lookup',
  // Reserved (rejected by classifier; included for future Phase 49 governance extension):
  'research_external_validation',
]);

function _validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('vtp-bridge: input must be an object');
  }
  if (typeof input.uncertainty_type !== 'string') {
    throw new Error('vtp-bridge: uncertainty_type required (string)');
  }
  if (typeof input.query !== 'string' || input.query.length === 0) {
    throw new Error('vtp-bridge: query required (non-empty string)');
  }
  if (input.query.length > 10000) {
    throw new Error('vtp-bridge: query too long (max 10000 chars)');
  }
  // No semantic-similarity fields permitted (LOCK 11 binding):
  for (const banned of ['embedding', 'similarity_score', 'fuzzy_match', 'cosine']) {
    if (banned in input) {
      throw new Error(`vtp-bridge: input field '${banned}' forbidden by LOCK 11`);
    }
  }
}
```

### Example 4: Selective call decision (the meat)

```javascript
function _selectiveVTPCallInternal(input) {
  _validateInput(input);

  const planningDir = input._planning_dir || _defaultPlanningDir();
  const ts_start = Date.now();

  // Gate 1: whitelist enforcement (A1 + A2 + A5 binding).
  // Phase 47 already enforces this at routing decision; Phase 48 enforces AGAIN
  // here for defense-in-depth against caller bypass (Pitfall 3).
  const route = require('../dispatch-router/route.cjs');
  if (!route.VTP_WHITELIST.includes(input.uncertainty_type)) {
    return Object.freeze({
      envelope_version: 1,
      ts: new Date().toISOString(),
      command: 'vtpBridgeEvidence',
      ok: false,
      vtp_tool: null,
      uncertainty_type: input.uncertainty_type,
      query: input.query,
      results: [],
      source_refs: [],
      root_source_hashes: [],
      confidence: 'low',
      retrieved_at: null,
      error_logged_at: null,
      reason_codes: ['not_routed_to_vtp'],
      compression_level: null,
    });
  }

  // Gate 2: VTP health probe (Pitfall 5 prevention).
  const vtpHealth = route.isProviderHealthy('vtp', planningDir, _forcesFromInput(input));
  if (!vtpHealth.healthy) {
    const failureLog = _logVtpBridgeFailure(planningDir, {
      status: 'fail',
      tool: VTP_TOOL_MAP[input.uncertainty_type].tool,
      uncertainty_type: input.uncertainty_type,
      error_type: 'mcp_unreachable',
      error_message: `vtp-health says unhealthy: ${vtpHealth.reason}`,
      duration_ms: 0,
      query: (input.query || '').slice(0, 200),
      reason_codes: ['vtp_unavailable'],
    });
    const sentinel = _buildFailureSentinelPacket(input.uncertainty_type, input.query, failureLog);
    _emitRouteLedgerRow(planningDir, sentinel, { phase: input.phase, milestone: input.milestone });
    return sentinel;
  }

  // Gate 3: dispatch the actual MCP call with timeout.
  const tool_entry = VTP_TOOL_MAP[input.uncertainty_type];
  const timeout_ms = (input.routes_yaml && input.routes_yaml.vtp_bridge
                       && input.routes_yaml.vtp_bridge.per_query_timeout_ms)
                       || PER_QUERY_TIMEOUT_MS_DEFAULT;

  let mcp_response = null;
  let mcp_error = null;
  try {
    // _callVtpTool is the orchestrator-supplied shim (default: throws 'shim_not_wired').
    // Self-test injects via input._force_vtp_tool_response.
    mcp_response = _callVtpToolWithTimeout(
      tool_entry.tool,
      Object.assign({}, tool_entry.args_template, { query: input.query }),
      timeout_ms,
      input._force_vtp_tool_response || null
    );
  } catch (e) {
    mcp_error = e;
  }

  if (mcp_error) {
    const error_type = mcp_error.message.startsWith('TIMEOUT_') ? 'mcp_timeout'
      : mcp_error.message.startsWith('AUTH_') ? 'mcp_auth'
      : mcp_error.message.startsWith('VALIDATION_') ? 'mcp_validation'
      : 'mcp_internal';
    const failureLog = _logVtpBridgeFailure(planningDir, {
      status: error_type === 'mcp_timeout' ? 'timeout' : 'fail',
      tool: tool_entry.tool,
      uncertainty_type: input.uncertainty_type,
      error_type,
      error_message: mcp_error.message,
      duration_ms: Date.now() - ts_start,
      query: (input.query || '').slice(0, 200),
      reason_codes: [error_type === 'mcp_timeout' ? 'vtp_call_timeout' : 'vtp_call_validation_failed'],
    });
    const sentinel = _buildFailureSentinelPacket(input.uncertainty_type, input.query, failureLog);
    _emitRouteLedgerRow(planningDir, sentinel, { phase: input.phase, milestone: input.milestone });
    return sentinel;
  }

  // Gate 4: build evidence packet from successful response.
  const packet = _buildEvidencePacket(input.uncertainty_type, input.query, mcp_response, {
    routes_yaml: input.routes_yaml || null,
  });
  _emitRouteLedgerRow(planningDir, packet, { phase: input.phase, milestone: input.milestone });
  return packet;
}
```

### Example 5: Phase 45 stub wire-in (helper composition; Phase 48 SHIPS WIRE)

```javascript
// Source: NEW — Phase 48 ships this helper (caller composes; Phase 45 source untouched).
// Caller (orchestrator) does:
//
//   const route = require('super-gsd/tools/dispatch-router/route.cjs');
//   const decision = route.routeDispatch({uncertainty_type, task_kind, ...});
//   let vtp_evidence_packet = null;
//   if (decision.provider === 'vtp') {
//     const bridge = require('super-gsd/tools/vtp-bridge/classify.cjs');
//     vtp_evidence_packet = bridge.selectiveVTPCall({uncertainty_type, query, planningDir, phase, milestone});
//   }
//   const packet = require('super-gsd/tools/context-packet/build.cjs').buildPacket(role, intent_ref, {
//     planningDir,
//     route_hint: { use_vtp: !!vtp_evidence_packet },
//     _vtp_packets: vtp_evidence_packet && vtp_evidence_packet.ok ? [vtp_evidence_packet] : [],
//   });
//
// The helper below CONVENIENCE-WRAPS the above for Phase 49+ orchestrator hooks.

function selectiveVTPCallForPacket(intent_map, opts) {
  // Forward-only optional helper; orchestrator may use directly or compose manually.
  if (!intent_map || !intent_map.action) return null;
  if (intent_map.action.kind !== 'route_provider') return null;
  if (intent_map.action.provider !== 'vtp') return null;
  // Pull uncertainty_type from intent_map (Phase 45 puts it there per VTPR-06).
  const uncertainty_type = (intent_map.action && intent_map.action.uncertainty_type)
    || (intent_map.context_policy && intent_map.context_policy.uncertainty_type)
    || null;
  if (!uncertainty_type) return null;
  return selectiveVTPCall({
    uncertainty_type,
    query: intent_map.canonical || intent_map.intent || '',
    planningDir: opts && opts.planningDir,
    phase: opts && opts.phase,
    milestone: opts && opts.milestone,
  });
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| sgsd-vtp-enrichment fires once per phase between researcher and planner | Phase 48 adds per-dispatch selective bridge | Phase 48 (this phase) | Two coexisting VTP surfaces: phase-level enrichment AND dispatch-level bridge |
| VTP MCP failures landed in agent reports as research conclusions | A3 mandates separate `vtp-bridge-failures.jsonl` stream | Phase 48 | Failures are first-class metric rows; cockpit shows VTP failure rate |
| VTP is ambient (any phase can use it) | VTP is route-gated by Phase 47 VTP_WHITELIST | Phase 47 + Phase 48 | Local-only phases cannot fire VTP; LOCK 11 enforced structurally |
| VTP_TOOL_MAP did not exist | Closed enum maps uncertainty_type → MCP tool | Phase 48 | No semantic routing; mechanical mapping |
| MCP error text could appear in research output | Empty results[] + `error_logged_at` reference | Phase 48 | Caller cannot mistake error for conclusion |

**Deprecated/outdated:**
- The old `sgsd-vtp-enrichment` 5-tool cascade approach for general dispatches (it remains in place for the per-phase enrichment gate use case; Phase 48 supersedes it for per-dispatch use).
- Calling VTP from any uncertainty type. Now restricted to VTP_WHITELIST (3 entries).
- Putting any MCP error message in `evidence_packet.results[]`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `wiki_search` MCP tool exists and is the right surface for `prior_memory_lookup` | §4 VTP_TOOL_MAP | If `wiki_search` is renamed or removed, classifier needs alternative. **MITIGATION:** Verified against `super-gsd/agents/sgsd-vtp-enrichment.md:4` tools list which references `mcp__vtp-kb__vtp_search` family; cross-check VTP analysis (2026-04-27 crosscheck:60) explicitly used `vtp_search_substrate(source_types=["wiki_page"])` for wiki content. **[CITED: super-gsd/agents/sgsd-vtp-enrichment.md:4 + .planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md:60]** Currently classified as MEDIUM confidence: tool name `wiki_search` in CONTEXT prompt may be the operator's shorthand for `vtp_search_substrate(source_types=['wiki_page'])`. RECOMMENDATION: bridge ships BOTH paths; classifier prefers `wiki_search` if available, falls back to `vtp_search_substrate(source_types=['wiki_page'])`. Mass-discuss with operator if ambiguity persists at planning time. |
| A2 | `evidence_packet_max_tokens=5000` is appropriate ceiling | §3.1 routes.yaml extension | If too low, useful results elided. If too high, blows context-packet budget. **[ASSUMED]** based on Phase 42 researcher budget (25,000); 5000 = 20% of researcher budget per VTP packet. RECOMMENDATION: confirm with operator at planning time; if uncertain, ship with config override and let Phase 51 BENCH measure the actual sweet spot. |
| A3 | `per_query_timeout_ms=30000` (30s) per VTP MCP call is appropriate | §3.1 routes.yaml extension | Phase 14 cross-check observed `vtp_research_gate` timeouts at 120s and validation failures at 55s ([CITED: 2026-04-27-agent-context-bloat-vtp-crosscheck.md:46-48]). 30s may be too aggressive for some tools. **[ASSUMED]** but BACKED by Phase 14 evidence that long-running tools should be excluded from Phase 48's selective bridge anyway. RECOMMENDATION: bridge does NOT include `vtp_research_gate` in TOOL_MAP — only the fast tools. |
| A4 | `book_lookup` uses `vtp_search_substrate` with `source_types=['wiki_page']` filter | §4 VTP_TOOL_MAP | If books are not stored as `wiki_page`, book_lookup returns empty. **[CITED: 2026-04-27-agent-context-bloat-vtp-crosscheck.md:60]** "VTP stores books as `wiki_page` resources under `wiki/books/...`". Confidence HIGH per cross-check. |
| A5 | `architecture_challenge` benefits from `vtp_search_substrate` over `vtp_search_research` | §4 VTP_TOOL_MAP | If `vtp_search_research` (papers) is the right tool for architecture-level decisions, classifier maps wrong. **[ASSUMED]** based on cross-check pattern: substrate covers BOTH books and research; `vtp_search_research` is research-only. For architecture decisions both substrates matter. RECOMMENDATION: planning may add `source_types=['research', 'wiki_page']` filter to substrate call OR add a 4th whitelist entry `research_external_validation` → `vtp_route_and_retrieve` (already RESERVED in VTP_TOOL_MAP). |
| A6 | Phase 45 source remains untouched; bridge wires via caller | §6 Pitfall 7 prevention + §10 fixture F7 | If wire-in mutates `context-packet/build.cjs`, Phase 45 self-test breaks. **[VERIFIED: context-packet/build.cjs:706-708]** Phase 45 already documents the stub as "Phase 47/48 will populate via opts.route_hint" — the contract is caller-side composition. HIGH confidence. |
| A7 | Adding `vtp_bridge` to BOUNDARIES extends 8→9 cleanly | §3 + §10 fixture | If envelope-v1 schema constrains BOUNDARIES count, extension fails. **[VERIFIED: route-ledger.cjs:66-75 + 47-RESEARCH cited extension precedent]** Phase 47 already extended 7→8 via the same closed-enum extension pattern; envelope-v1 has `additionalProperties: true` at registry/command-envelope-v1.yaml:260 (per route-ledger.cjs comment). HIGH confidence. |

**[ASSUMED] entries to confirm with operator at planning time:** A1 (wiki_search vs substrate fallback), A2 (max_tokens cap), A3 (timeout), A5 (substrate vs research for architecture).

---

## Open Questions

1. **Should `book_lookup` and `architecture_challenge` share the same VTP tool (`vtp_search_substrate`) but with different filter args?**
   - What we know: VTP cross-check shows substrate works for both books (`source_types=['wiki_page']`) and research (`source_types=['research']`). Architecture-level questions can benefit from both.
   - What's unclear: Whether the bridge should call substrate ONCE (with `source_types=['research','wiki_page']`) or call it in TWO different uncertainty_type slots (different filter sets).
   - Recommendation: Ship VTP_TOOL_MAP with the two slots distinct (book_lookup → wiki_page filter; architecture_challenge → both filters). Self-test fixture F1 covers both. If Phase 51 benchmark shows no value-add from the split, Phase 49 can collapse them.

2. **Should bridge ship a CLI for ad-hoc VTP queries by operator?**
   - What we know: Phase 47 ships `--route` CLI mode; established pattern.
   - What's unclear: Whether `--bridge --uncertainty-type X --query Y` adds operational value beyond what the existing `mcp__vtp-kb__vtp_search` MCP CLI provides.
   - Recommendation: Ship `--bridge` CLI for parity with Phase 47 (also useful for cockpit debug). It calls the same `selectiveVTPCall` with appropriate stubs.

3. **Where does the `mcp__vtp-kb__vtp_search` (non-substrate, non-research) tool fit?**
   - What we know: It exists as a "general" search tool per `super-gsd/agents/sgsd-vtp-enrichment.md:4`.
   - What's unclear: Whether any uncertainty_type should map to it, or whether it's superseded by substrate/research/wiki specific tools.
   - Recommendation: Bridge does NOT use it. Classifier prefers specific tools (substrate, research, wiki) because they return targeted result shapes. If Phase 51 benchmark shows specific tools miss results that general would catch, Phase 49 can extend the map.

4. **Should the bridge auto-retry on `mcp_validation` failure (the schema-too-long bug from Phase 14 cross-check)?**
   - What we know: The cross-check found `vtp_research_gate` validation failures because `scores[0].reason` exceeded server schema limits. Reducing query length sometimes works.
   - What's unclear: Whether Phase 48 should ship with `retry_on_validation: true` and shrink the query.
   - Recommendation: NO retry in Phase 48. Log and return empty packet. If validation failures are common in dogfood, Phase 49 governance can add a retry policy with provenance — but Phase 48 is a single-shot bridge to keep the contract simple.

5. **How should the bridge surface in cockpit (Phase 50)?**
   - What we know: Phase 50 reads `route-decisions.jsonl` (rows where `boundary='vtp_bridge'`) and the new `vtp-bridge-failures.jsonl`. Both stay simple.
   - What's unclear: Pane layout decisions belong in Phase 50.
   - Recommendation: Out of scope for Phase 48. Document the consumer contract (which fields cockpit reads) in §13 below.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (require, fs, path, crypto) | bridge module | ✓ | 18+ | — |
| MCP runtime tool surface (`mcp__vtp-kb__*`) | _callVtpTool shim | RUNTIME (not at self-test time) | mcp-vtp-kb (latest) | self-test uses `_force_vtp_tool_response` injection |
| Phase 47 dispatch-router | imports `VTP_WHITELIST`, `isProviderHealthy` | ✓ | route.cjs at HEAD | — |
| Phase 32 route-ledger | imports `logRouteDecision`, extends `BOUNDARIES` 8→9 | ✓ | route-ledger.cjs at HEAD | — |
| Phase 45 context-packet | references `_assertValidatedThoughtProvenance` (mirror; not import) | ✓ | build.cjs at HEAD | mirror pattern locally to avoid hard dep |
| pinned js-yaml | optional routes.yaml override | ✓ | super-gsd/tools/plan-schema/node_modules/js-yaml | compiled fallback (5000/30000 hard-coded) |
| `.planning/metrics/vtp-health.jsonl` | health probe via Phase 47 reader | RUNTIME (created at orchestrator Step 3.7) | — | self-test uses `_force_vtp_health` (Phase 47 pattern) |

**Missing dependencies with no fallback:** None — bridge works at self-test time without runtime MCP via injection.

**Missing dependencies with fallback:** Routes.yaml `vtp_bridge` section (compiled fallback hard-codes defaults).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node `assert` + lightweight `_runSelfTest()` (mirrors Phase 47 + Phase 45 in-module pattern) |
| Config file | none — self-test embedded in `classify.cjs` |
| Quick run command | `node super-gsd/tools/vtp-bridge/classify.cjs --self-test` |
| Full suite command | `node super-gsd/tools/vtp-bridge/classify.cjs --self-test` (single command; full suite IS the self-test) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VTPR-01 | Classifier maps each whitelist type to correct VTP tool | unit (in-module) | `node classify.cjs --self-test` (assertion 1) | ❌ Wave 0 |
| VTPR-02 | All 4 whitelist types (3 active + 1 reserved) handled | unit | `node classify.cjs --self-test` (assertions 1-4) | ❌ Wave 0 |
| VTPR-03 | MCP failure → vtp-bridge-failures.jsonl row + empty packet (no error in results[]) | unit (with failure injection) | `node classify.cjs --self-test` (assertion 5) | ❌ Wave 0 |
| VTPR-04 | source_refs and root_source_hashes mandatory; admitted/rejected gate | unit (with mixed-shape MCP injection) | `node classify.cjs --self-test` (assertion 6) | ❌ Wave 0 |
| VTPR-05 | Non-whitelist uncertainty_type → `{ok:false, reason:'not_routed_to_vtp'}`, NO MCP call | unit | `node classify.cjs --self-test` (assertion 7) | ❌ Wave 0 |
| VTPR-06 | LOCK 11 — forbidden semantic-similarity input fields rejected | unit | `node classify.cjs --self-test` (assertion 8) | ❌ Wave 0 |
| LOCK-13 | Internal error → safe-default sentinel; no upward throw | unit | `node classify.cjs --self-test` (assertion 9) | ❌ Wave 0 |
| READ-ONLY | self-test does not mutate canonical streams | unit (fingerprint diff) | `node classify.cjs --self-test` (assertion 10) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `node super-gsd/tools/vtp-bridge/classify.cjs --self-test` (target: <5s, all 10+ assertions)
- **Per wave merge:** Same self-test
- **Phase gate:** Self-test green + Phase 47 self-test green (no regression in dispatch-router after BOUNDARIES extension) + route-ledger self-test green (BOUNDARIES 8→9 extension)

### Wave 0 Gaps

- [ ] `super-gsd/tools/vtp-bridge/classify.cjs` — full module (~700 lines)
- [ ] `super-gsd/tools/vtp-bridge/EVIDENCE-PACKET.schema.json` — manual schema
- [ ] `super-gsd/scripts/lib/route-ledger.cjs` — extend BOUNDARIES 8→9 (add `'vtp_bridge'`)
- [ ] `super-gsd/tools/dispatch-router/routes.yaml` — add `vtp_bridge:` top-level section
- [ ] `.planning/metrics/vtp-bridge-failures.jsonl` — created on first failure (no scaffold needed)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (MCP auth flow) | MCP runtime owns; bridge's `mcp_auth` error_type captures auth failures into vtp-bridge-failures.jsonl |
| V3 Session Management | no | bridge is stateless per-call |
| V4 Access Control | yes (whitelist enforcement) | Frozen 3-entry VTP_WHITELIST; non-whitelist rejected before MCP call |
| V5 Input Validation | yes | `_validateInput` enforces uncertainty_type closed-enum, query length cap, banned semantic-similarity fields |
| V6 Cryptography | yes (sha256 root_source_hashes) | Node `crypto` standard module |

### Known Threat Patterns for vtp-bridge stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt-injection in query string | Tampering | Query is data, not instruction (mirror Lock 12 from Phase 45). Bridge passes query verbatim to MCP; MCP server is responsible for treating it as substrate-search input not as runtime command. Bridge does NOT interpret query content. |
| MCP error message reflected as research conclusion (A3 violation) | Information Disclosure / Tampering | Empty results[] on failure; error_logged_at reference is the ONLY back-pointer. Self-test fixture F2 binds. |
| Whitelist bypass via input mutation | Elevation of Privilege | Defense-in-depth: Phase 47 enforces routing decision; Phase 48 enforces AGAIN at bridge entry. Frozen enum + immutable check. |
| Excessive packet size DoS-ing downstream | DoS | Hard cap `evidence_packet_max_tokens=5000`; descending-relevance elision. |
| Provenance-forged result | Tampering | source_refs + root_source_hashes mandatory; gate rejects results with empty/missing fields. Mirror Phase 45 PACKET-13. |

---

## Sources

### Primary (HIGH confidence)

- `super-gsd/tools/dispatch-router/route.cjs:77-179` — VTP_WHITELIST, UNCERTAINTY_TYPES, ROUTING_TABLE (frozen enums Phase 48 consumes)
- `super-gsd/tools/dispatch-router/route.cjs:262-293` — VTP health probe pattern (Phase 48 mirrors / consumes)
- `super-gsd/tools/dispatch-router/routes.yaml` — Optional config override pattern (Phase 48 extends)
- `super-gsd/tools/context-packet/build.cjs:707-708` — Phase 45 stub for VTP wire-in (Phase 48 owns wire)
- `super-gsd/tools/context-packet/build.cjs:220-234` — `_assertValidatedThoughtProvenance` (Phase 48 mirrors)
- `super-gsd/tools/context-packet/build.cjs:538-575` — `enforceRoleBudget` descending-elision (Phase 48 mirrors for cap enforcement)
- `super-gsd/scripts/lib/route-ledger.cjs:66-75` — BOUNDARIES enum at HEAD (8 entries; Phase 48 adds 9th)
- `super-gsd/scripts/lib/route-ledger.cjs:211-218` — `logRouteDecision` never-throws contract
- `.planning/milestones/v1.9/REQUIREMENTS.md:191-202` — VTPR-01..VTPR-06 verbatim
- `.planning/milestones/v1.9/ROADMAP.md:215-232` — Phase 48 acceptance criteria verbatim
- `.planning/milestones/v1.9/VTP-RESEARCH-DELTA.md` — VTP-delta consumption rules
- `.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md:38-41` — New canonical metrics streams pattern (line 38: vtp-bridge-failures is an additive new stream)
- `.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md:139` — Forbids second route-decision ledger (Phase 48 EXTENDS via boundary; new failure stream is OK per line 38 precedent)
- `super-gsd/tools/token-attribution/report.cjs:79-81` — PROVIDERS frozen 4-entry
- `super-gsd/agents/sgsd-vtp-enrichment.md` — Existing VTP MCP tools list, 5-tool cascade pattern, separate concern from Phase 48
- `super-gsd/skills/sgsd-orchestrate/SKILL.md:187-227` — Step 3.7 vtp-health.jsonl write pattern
- `super-gsd/skills/sgsd-orchestrate/SKILL.md:473-498` — Step 6.b.5 sgsd-vtp-enrichment dispatch (separate from Phase 48 bridge)
- `.planning/analyses/2026-04-27-agent-context-bloat-vtp-crosscheck.md:34-69` — VTP MCP tool family validation, book storage as wiki_page, validation/timeout failure modes
- `.planning/milestones/v1.9/phases/47-dispatch-routing-substitution/47-RESEARCH.md` — Phase 47 research (15 questions LOCKED) on which Phase 48 builds
- `.planning/milestones/v1.9/phases/45-context-packet-builder/45-RESEARCH.md:1300-1313` — VTPR-06 binding documented from Phase 45 perspective

### Secondary (MEDIUM confidence)

- `.planning/memory/MEMORY.md` user feedback "feedback_vtp_search_layer_routing.md" — wiki_search vs vtp_search_substrate routing rule (cited in §4 A1 assumption)
- `.planning/milestones/v1.5/VTP-CLASSIFICATION-GAP.md` — VTP MCP read-side surface enumeration (informs but does not constrain Phase 48 surface)

### Tertiary (LOW confidence)

- (none — Phase 48 is highly constrained by Phase 47 prior research; no LOW-confidence claims)

---

## Project Constraints (from CLAUDE.md)

- **NEVER expose secrets** — Phase 48 does NOT read or display any `.env`/secret files. The bridge does not handle credentials directly; MCP runtime owns auth.
- **Use `bg_shell` not `bash`** — Operator/runtime concern; does not affect Phase 48 module design (module is pure Node lib).
- **PERMISSIONS — autonomous** — Phase 48 ships in autonomous mode; do not gate on operator confirmation between waves.
- **Commit after every unit, no `git add -A`** — applies to plan execution, not to research artifact.
- **`tools/`, not `lib/`, for self-tested deliverables** — Followed: `super-gsd/tools/vtp-bridge/`.
- **Every new tool gets `--self-test`** — Followed: `classify.cjs --self-test`.
- **Every new projection gets a rebuild test** — Followed: `vtp-bridge-failures.jsonl` is append-only canonical (NOT a projection — primary stream).

---

## Forward Contract (consumed by Phase 49 / 51)

### To Phase 49 GOV-04..GOV-08 (Memory Governance Lifecycle)

Phase 49 will read:
- `.planning/metrics/vtp-bridge-failures.jsonl` — failure rows for governance dashboard (bad MCP behavior detection)
- `.planning/metrics/route-decisions.jsonl` rows where `boundary='vtp_bridge'` — successful bridge calls

Phase 49 governance MAY:
- Promote a recurring successful evidence_packet to a `validated_thought` if it satisfies confidence/novelty thresholds (per VTP-DELTA §New Terms `validated_thought`).
- Demote a tool from `VTP_TOOL_MAP` if its failure rate exceeds threshold (Phase 49 owns; Phase 48 ships frozen enum).
- Revoke an MCP tool that emits poisoned/contaminated results (Phase 49 owns; Phase 48 logs evidence).

### To Phase 51 BENCH-05..BENCH-07 (Context Stress Benchmark)

Phase 51 fixtures will exercise:
- **VTP unavailable** (BENCH-05): pre-populate `vtp-health.jsonl` with `vtp_available:false`; assert bridge returns `{ok:false, reason:'vtp_unavailable'}` and writes ONE failure row.
- **MCP timeout** (BENCH-05 extension): inject `_force_vtp_tool_response: { __error: 'TIMEOUT_30s' }`; assert empty results[] and timeout failure row.
- **Bad provenance** (BENCH-06): inject MCP response with results lacking `doc_id`; assert all rejected, empty admitted, gate counts populate.
- **Compactness** (BENCH-07 utility_per_token): inject 30 valid results; assert `elided_count > 0` and packet under 5000 tokens.

### To Phase 50 Cockpit (COCKPIT-04 source mix display)

Phase 50 reads:
- `vtp-bridge-failures.jsonl` tail (last 50 rows) → rolling failure rate
- `route-decisions.jsonl` rows where `boundary='vtp_bridge'` → success rate, average packet size
- Phase 45 packet rows where `metadata.context_source_mix.vtp_packet > 0` → which dispatches consumed VTP evidence

No new cockpit dependency; pre-existing JSONL surface.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every consumed surface verified in source at HEAD
- Architecture (8-step bridge flow, classifier mapping): HIGH — mirrors Phase 47 pattern 1:1
- Pitfalls (7 documented): HIGH — derived from Phase 14 cross-check, Phase 47 anti-pattern list, and explicit A1-A5 acceptance bindings
- Code examples: HIGH — every example is a direct mirror of an existing Phase 32/41/45/47 surface with line citations
- Forward contracts (Phase 49/50/51): MEDIUM — dependent on those phases not changing their stated intent; Phase 48 ships the input data they need regardless
- VTP MCP tool name verification (wiki_search vs substrate fallback): MEDIUM — see Assumptions §A1; bridge ships defensive double-path

**Research date:** 2026-04-27
**Valid until:** 30 days (stable; Phase 47 frozen enums and Phase 45 stub are unlikely to drift in this window)

---

## Section §10: Self-Test Fixture Catalog (Wave 0 reference)

10 assertions for `_runSelfTest()`:

| # | Fixture | What it Binds |
|---|---------|---------------|
| F1 | `architecture_challenge` + injected substrate response with valid provenance → packet `ok:true`, `vtp_tool='vtp_search_substrate'`, results length matches injection | A2, VTPR-02 |
| F2 | Inject MCP error `TIMEOUT_30000ms` → packet `ok:false`, `results:[]`, NO error text in body, vtp-bridge-failures.jsonl row appears with `error_type='mcp_timeout'`, `error_message` contains injected text | A3, VTPR-03 |
| F3 | `evidence_packet_max_tokens=2000` (override) + 10 results × 500 tokens each → packet body ≤ 2000 tokens, `elided_count > 0`, `reason_codes` contains `'evidence_packet_size_capped'` | A4, VTPR-04 (cap) |
| F4 | `book_lookup` with valid wiki_page response → `vtp_tool='vtp_search_substrate'` (NOT wiki_search per A4 cross-check evidence) | A2, VTPR-02 |
| F5 | `synthesis_judgment` (NOT in whitelist) → packet `ok:false`, `reason:'not_routed_to_vtp'`, NO MCP call attempted (verify by inspecting `_force_vtp_tool_response: () => { throw new Error('SHOULD_NOT_BE_CALLED'); }`) | A1, VTPR-05, LOCK-11 |
| F6 | Force vtp-health unhealthy → packet `ok:false`, `reason:'vtp_unavailable'`, ONE failure row, NO MCP call | Pitfall 5 prevention |
| F7 | Run F1 fixture; check `super-gsd/tools/context-packet/build.cjs` mtime + size unchanged before/after; check Phase 47 dispatch-router self-test still passes | Pitfall 7 + A6 read-only invariant |
| F8 | Inject mixed-shape response (some results have `id` not `doc_id`; some have empty `citation`) → admitted count matches valid rows; rejected count matches invalid rows; both populate metadata | Pitfall 6 + VTPR-04 (provenance) |
| F9 | `selectiveVTPCall({uncertainty_type: 'architecture_challenge', query: '', embedding: [0.1, 0.2]})` → throws "input field 'embedding' forbidden by LOCK 11" — Lock 13 wraps; returns `bridge_internal_error` sentinel | LOCK-11, LOCK-13, VTPR-06 |
| F10 | Read-only invariant: snapshot `.planning/metrics/codex-log.jsonl`, `route-decisions.jsonl` size+mtime BEFORE self-test; assert UNCHANGED after self-test (only `vtp-bridge-failures.jsonl` in tmpdir written, never canonical streams) | Lock 4 read-only |

---

## Section §13: Scope Boundary Mind-Map

```
                            Phase 48
              ┌────────────────────────────────┐
              │     selective-vtp-bridge        │
              │                                 │
              │  IN scope:                      │
              │   - VTP_TOOL_MAP (closed enum) │
              │   - selectiveVTPCall API       │
              │   - evidence_packet shape      │
              │   - failure isolation log      │
              │   - 5000-token cap             │
              │   - source_refs gate           │
              │   - Lock 13 wrapper            │
              │   - route-ledger emission      │
              │   - BOUNDARIES 8→9 extension  │
              │                                 │
              │  OUT of scope:                  │
              │   - new whitelist entries       │
              │   - retry logic (P49 owns)      │
              │   - hot caching (P52 owns)      │
              │   - cockpit display (P50 owns)  │
              │   - utility scoring (P51 owns)  │
              │   - validated_thought promotion │
              │     (P49 owns)                  │
              │   - new MCP tools (Phase 14+)   │
              │   - sgsd-vtp-enrichment agent   │
              │     (separate; coexists)        │
              └────────────────────────────────┘
                ▲           ▲           ▲
                │           │           │
        ┌───────┘   ┌───────┘   ┌───────┘
        │           │           │
   Phase 47    Phase 45    Phase 32
   (decides    (provides   (ledger
    VTP route) packet stub) emission)
```

---

**End of Phase 48 Research.**
