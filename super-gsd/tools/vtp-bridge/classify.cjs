// ============================================================================
// SGSD - VTP-BRIDGE (Phase 48, VTPR-01..06)
// ============================================================================
// Single deterministic function: selectiveVTPCall takes a Phase 47 routing
// decision (uncertainty_type in {architecture_challenge, prior_memory_lookup,
// book_lookup}) and returns either (a) a compact source-backed evidence packet
// from one mcp__vtp-kb__* tool, or (b) a {ok:false} sentinel + a row appended
// to .planning/metrics/vtp-bridge-failures.jsonl.
//
// Lock 11 (no semantic similarity): selectiveVTPCall input contains NO embedding
//   or similarity_score field. Routing is purely uncertainty_type -> VTP_TOOL_MAP
//   lookup, gated by Phase 47 VTP_WHITELIST (imported BY REFERENCE; never copied).
// Lock 13 (never-throws): every public API wraps internals in try/catch and
//   returns a {ok:false, reason_codes:['bridge_internal_error']} sentinel.
// WRITE TOPOLOGY: failures append vtp-bridge-failures.jsonl, decisions append
//   route-decisions.jsonl through Phase 32 logRouteDecision, and mediated
//   substrate calls append vtp-routing-log.jsonl through callVtp. Phase 45
//   source super-gsd/tools/context-packet/build.cjs is never mutated.
//
// Acceptance bindings:
//   A1 local-implementation phases do NOT call VTP by default
//      (whitelist gate at Gate 2; F5 self-test fixture)
//   A2 research-paper / book / prior-project / architecture-challenge CAN call VTP
//      (4-entry frozen VTP_TOOL_MAP; F1 + F4 self-test fixtures)
//   A3 MCP failures logged separately from research conclusions
//      (vtp-bridge-failures.jsonl + empty results[]; F2 self-test fixture)
//   A4 evidence_packet source-backed AND compact
//      (5000-token cap descending elision + mandatory provenance gate; F3 + F8)
//   A5 routing gated ONLY by uncertainty_type closed-enum + Phase 47 whitelist
//      (LOCK-11 reaffirmed; F9 self-test fixture)
//
// Public API:
//   selectiveVTPCall(input)                     -> evidence_packet (Lock 13 wrapped)
//   selectiveVTPCallForPacket(intent_map, opts) -> evidence_packet (helper)
//
// Frozen consts exported:
//   VTP_TOOL_MAP                       (4 entries: 3 active + 1 reserved)
//   VTP_BRIDGE_REASONS                 (10 closed reason_codes)
//   FAILURE_KINDS                      (5 closed error_type codes)
//   EVIDENCE_PACKET_MAX_TOKENS_DEFAULT (5000)
//   PER_QUERY_TIMEOUT_MS_DEFAULT       (30000)
//   COMMAND_NAME                       ('vtpBridgeEvidence')
//   ENVELOPE_VERSION                   (1)
//
// Runtime dependencies and mirrored source contracts:
//   - route.cjs: VTP_WHITELIST and isProviderHealthy by reference
//   - route-ledger.cjs: logRouteDecision by reference
//   - vtp-context-composer.cjs: prepareSubstrateCall and callVtp
//   - build.cjs: provenance, token estimate, and packet-cap logic mirrored locally
//
// CLI:
//   node classify.cjs --self-test  -> run 13 in-module assertions
//   node classify.cjs --bridge --uncertainty-type X --query Y [--phase N] [--milestone V]
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ----------------------------------------------------------------------------
// IMPORTS BY REFERENCE (defense-in-depth; never redefine).
// ----------------------------------------------------------------------------
const route = require('../dispatch-router/route.cjs');
const ledger = require('../../scripts/lib/route-ledger.cjs');
const vtpComposer = require('../../scripts/lib/vtp-context-composer.cjs');

// Phase 41 sanity: PROVIDERS must include 'vtp'.
(function _assertProvidersIncludeVtp() {
  try {
    const tokAttr = require('../token-attribution/report.cjs');
    if (!Array.isArray(tokAttr.PROVIDERS) || tokAttr.PROVIDERS.indexOf('vtp') === -1) {
      console.warn('[SGSD] vtp-bridge: Phase 41 PROVIDERS missing vtp; bridge proceeds (degraded telemetry).');
    }
  } catch (_e) {
    // Phase 41 absent -> degrade silently (Lock 13 spirit).
  }
})();

// ----------------------------------------------------------------------------
// FROZEN CONSTS
// ----------------------------------------------------------------------------

const COMMAND_NAME = 'vtpBridgeEvidence';
const ENVELOPE_VERSION = 1;
const EVIDENCE_PACKET_MAX_TOKENS_DEFAULT = 5000;
const PER_QUERY_TIMEOUT_MS_DEFAULT = 30000;
const QUERY_MAX_LEN = 10000;

// 4-entry VTP_TOOL_MAP. 3 active (architecture_challenge, prior_memory_lookup,
// book_lookup -- mirroring Phase 47 VTP_WHITELIST) + 1 reserved
// (research_external_validation, owned by Phase 49 governance).
// Every inner object + every args_template is Object.freeze (T-48-11 mitigation).
const VTP_TOOL_MAP = Object.freeze({
  architecture_challenge: Object.freeze({
    tool: 'vtp_search_substrate',
    intent_family: 'architecture_challenge',
    args_template: Object.freeze({}),
    rationale: 'architecture-level cross-domain corpus search across research papers + wiki analyses',
  }),
  prior_memory_lookup: Object.freeze({
    tool: 'wiki_search',
    args_template: Object.freeze({
      resource_type: 'wiki_page',
      tier: Object.freeze(['people', 'projects', 'ideas', 'analyses']),
    }),
    rationale: 'prior-project memory: people / projects / ideas / analyses tiers (NOT books/papers)',
  }),
  book_lookup: Object.freeze({
    tool: 'vtp_search_substrate',
    intent_family: 'book_lookup',
    args_template: Object.freeze({}),
    rationale: 'book-content lookup via substrate search with client-side wiki/books path filtering',
  }),
  research_external_validation: Object.freeze({
    tool: 'vtp_route_and_retrieve',
    args_template: Object.freeze({}),
    rationale: 'RESERVED -- Phase 49 governance gate may activate; Phase 48 never selects this entry',
  }),
});

// 10-entry closed-enum reason_codes for evidence_packet.reason_codes and
// route-decisions.jsonl decision.reason_codes.
const VTP_BRIDGE_REASONS = Object.freeze([
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
]);

// 5-entry closed-enum error_type for vtp-bridge-failures.jsonl row.error_type.
const FAILURE_KINDS = Object.freeze([
  'mcp_timeout',
  'mcp_auth',
  'mcp_validation',
  'mcp_unreachable',
  'mcp_internal',
]);

// Module-load assertion: VTP_TOOL_MAP frozen + 4 entries (T-48-11 mitigation).
(function _assertVtpToolMapFrozen() {
  if (!Object.isFrozen(VTP_TOOL_MAP) || Object.keys(VTP_TOOL_MAP).length !== 4) {
    throw new Error('vtp-bridge: VTP_TOOL_MAP must be frozen with exactly 4 entries');
  }
  for (const k of Object.keys(VTP_TOOL_MAP)) {
    if (!Object.isFrozen(VTP_TOOL_MAP[k])) {
      throw new Error('vtp-bridge: VTP_TOOL_MAP[' + k + '] must be frozen');
    }
    if (!Object.isFrozen(VTP_TOOL_MAP[k].args_template)) {
      throw new Error('vtp-bridge: VTP_TOOL_MAP[' + k + '].args_template must be frozen');
    }
  }
})();

// ----------------------------------------------------------------------------
// PRIVATE: helpers
// ----------------------------------------------------------------------------

function _isoNow() {
  return new Date().toISOString();
}

function _defaultPlanningDir() {
  // Walk up from cwd until we find .planning; if not found, use cwd/.planning.
  let cur = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(cur, '.planning'))) return path.join(cur, '.planning');
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return path.join(process.cwd(), '.planning');
}

function _validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('vtp-bridge: input must be an object');
  }
  // Lock 11: no semantic-similarity routing inputs accepted.
  const banned = ['embedding', 'similarity_score', 'fuzzy_match', 'cosine'];
  for (const f of banned) {
    if (Object.prototype.hasOwnProperty.call(input, f)) {
      throw new Error(
        'vtp-bridge: LOCK-11 violation -- input must not contain semantic-similarity field "' + f
        + '". Routing is uncertainty_type-driven; embedding/similarity_score/fuzzy_match/cosine are banned.'
      );
    }
  }
  if (input.uncertainty_type !== undefined && typeof input.uncertainty_type !== 'string') {
    throw new Error('vtp-bridge: uncertainty_type must be a string when provided');
  }
  if (input.query !== undefined && typeof input.query !== 'string') {
    throw new Error('vtp-bridge: query must be a string when provided');
  }
  if (typeof input.query === 'string' && input.query.length > QUERY_MAX_LEN) {
    throw new Error(
      'vtp-bridge: query length ' + input.query.length
      + ' exceeds max ' + QUERY_MAX_LEN + ' (T-48-06 mitigation)'
    );
  }
  return true;
}

function _forcesFromInput(input) {
  const forces = {};
  if (input && Object.prototype.hasOwnProperty.call(input, '_force_vtp_health')) {
    forces.vtp = input._force_vtp_health;
  }
  return forces;
}

function _classifyError(err) {
  // Map error message prefix -> FAILURE_KINDS member.
  const msg = (err && err.message) ? String(err.message) : String(err);
  if (/^TIMEOUT_/.test(msg) || /timeout/i.test(msg)) return 'mcp_timeout';
  if (/^AUTH_/.test(msg) || /unauthorized/i.test(msg) || /forbidden/i.test(msg)) return 'mcp_auth';
  if (/^VALIDATION_/.test(msg) || /invalid/i.test(msg) || /schema/i.test(msg)) return 'mcp_validation';
  if (/^UNREACHABLE_/.test(msg) || /unreachable/i.test(msg) || /econn/i.test(msg)) return 'mcp_unreachable';
  return 'mcp_internal';
}

function _reasonForFailureKind(kind) {
  switch (kind) {
    case 'mcp_timeout':    return 'vtp_call_timeout';
    case 'mcp_auth':       return 'vtp_call_auth_failed';
    case 'mcp_validation': return 'vtp_call_validation_failed';
    case 'mcp_unreachable': return 'vtp_unavailable';
    case 'mcp_internal':   return 'bridge_internal_error';
    default:               return 'bridge_internal_error';
  }
}

// Mirror of build.cjs:208-215 (word-count x 1.3).
function _estimateTokens(text) {
  try {
    const s = String(text || '');
    if (!s) return 0;
    const words = s.split(/\s+/).filter(Boolean).length;
    return Math.ceil(words * 1.3);
  } catch (_e) { return 0; }
}

// Mirror of build.cjs:220-234 (PACKET-13 provenance gate).
// Accepts EITHER doc_id OR id (legacy VTP shape) AND non-empty citation.
function _assertResultProvenance(result) {
  try {
    if (!result || typeof result !== 'object') return false;
    const docId = (typeof result.doc_id === 'string' && result.doc_id.length > 0)
      ? result.doc_id
      : (typeof result.id === 'string' && result.id.length > 0) ? result.id : null;
    if (!docId) return false;
    if (typeof result.citation !== 'string' || result.citation.length === 0) return false;
    return true;
  } catch (_e) { return false; }
}

// Mirror of build.cjs:538-575 enforceRoleBudget descending-relevance elision.
// Sorts by score DESC, accumulates token estimates, stops when over cap.
function _enforcePacketCap(admitted, maxTokens) {
  const cap = (typeof maxTokens === 'number' && maxTokens > 0) ? maxTokens : EVIDENCE_PACKET_MAX_TOKENS_DEFAULT;
  // Stable sort by score DESC; missing score sinks to 0.
  const ranked = admitted.slice().sort((a, b) => {
    const sa = (typeof a.score === 'number') ? a.score : 0;
    const sb = (typeof b.score === 'number') ? b.score : 0;
    return sb - sa;
  });
  const kept = [];
  let cumulative = 0;
  let elided = 0;
  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i];
    const text = String(r.title || '') + ' ' + String(r.excerpt || '') + ' ' + String(r.citation || '');
    const notes = Array.isArray(r.degradation_notes) && r.degradation_notes.length > 0
      ? ' ' + JSON.stringify(r.degradation_notes)
      : '';
    const cost = _estimateTokens(text + notes);
    if (cumulative + cost <= cap) {
      kept.push(r);
      cumulative += cost;
    } else {
      elided++;
    }
  }
  return { kept: kept, elided: elided, tokens: cumulative };
}

// Normalize MCP shape -> array of { doc_id, citation, title?, excerpt?, score? }.
function _extractResults(mcp_response, _toolName) {
  const out = [];
  if (!mcp_response) return out;
  let arr = null;
  if (Array.isArray(mcp_response)) arr = mcp_response;
  else if (Array.isArray(mcp_response.results)) arr = mcp_response.results;
  else if (Array.isArray(mcp_response.hits)) arr = mcp_response.hits;
  else if (Array.isArray(mcp_response.items)) arr = mcp_response.items;
  if (!arr) return out;
  for (let i = 0; i < arr.length; i++) {
    const r = arr[i];
    if (!r || typeof r !== 'object') continue;
    out.push(r);
  }
  return out;
}

function _hashOf(s) {
  try {
    return crypto.createHash('sha256').update(String(s || '')).digest('hex');
  } catch (_e) {
    return '0'.repeat(64);
  }
}

// ----------------------------------------------------------------------------
// PRIVATE: failure-log writer (NEVER throws upward)
// ----------------------------------------------------------------------------
function _logVtpBridgeFailure(planningDir, payload) {
  try {
    const dir = path.join(planningDir, 'metrics');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const logPath = path.join(dir, 'vtp-bridge-failures.jsonl');
    const row = {
      envelope_version: ENVELOPE_VERSION,
      ts: _isoNow(),
      command: 'vtpBridgeFailure',
      tool: payload && payload.tool || null,
      uncertainty_type: payload && payload.uncertainty_type || null,
      error_type: (payload && FAILURE_KINDS.indexOf(payload.error_type) !== -1) ? payload.error_type : 'mcp_internal',
      error_message: payload && typeof payload.error_message === 'string' ? payload.error_message : '',
      retry_at: payload && payload.retry_at || null,
      phase: payload && payload.phase || null,
      milestone: payload && payload.milestone || null,
    };
    fs.appendFileSync(logPath, JSON.stringify(row) + '\n', 'utf8');
    return { ok: true, path: logPath, error_logged_at: row.ts };
  } catch (e) {
    // Lock 13 sentinel logging path: NEVER throws.
    try { console.warn('[SGSD] vtp-bridge _logVtpBridgeFailure failed:', e && e.message); } catch (_) {}
    return { ok: false, reason: e && e.message || 'unknown' };
  }
}

// ----------------------------------------------------------------------------
// PRIVATE: ledger emission (Phase 32 logRouteDecision, NEVER throws upward)
// ----------------------------------------------------------------------------
function _emitRouteLedgerRow(planningDir, packet, opts) {
  try {
    const o = opts || {};
    let status = 'ok';
    if (!packet.ok) {
      // Distinguish timeout vs other failures.
      if (packet.reason_codes.indexOf('vtp_call_timeout') !== -1) status = 'timeout';
      else status = 'fail';
    } else if (packet.reason_codes.indexOf('evidence_packet_size_capped') !== -1) {
      status = 'warn';
    }
    const decision = {
      tool: packet.vtp_tool,
      uncertainty_type: packet.uncertainty_type,
      result_count: Array.isArray(packet.results) ? packet.results.length : 0,
      body_token_estimate: typeof packet.body_token_estimate === 'number' ? packet.body_token_estimate : 0,
      elided_count: typeof packet.elided_count === 'number' ? packet.elided_count : 0,
      rejected_provenance_count: typeof packet.rejected_provenance_count === 'number' ? packet.rejected_provenance_count : 0,
      error_logged_at: packet.error_logged_at || null,
    };
    return ledger.logRouteDecision(planningDir, {
      boundary: 'vtp_bridge',
      status: status,
      phase: o.phase || null,
      milestone: o.milestone || null,
      reason_codes: packet.reason_codes.slice(),
      artifacts: [],
      evidence: [],
      decision: decision,
    });
  } catch (e) {
    try { console.warn('[SGSD] vtp-bridge _emitRouteLedgerRow failed:', e && e.message); } catch (_) {}
    return false;
  }
}

// ----------------------------------------------------------------------------
// PRIVATE: packet builders
// ----------------------------------------------------------------------------
function _buildEvidencePacket(uncertainty_type, query, mcpResponse, opts) {
  const o = opts || {};
  const toolEntry = VTP_TOOL_MAP[uncertainty_type];
  const toolName = toolEntry ? toolEntry.tool : null;
  const reason_codes = [];
  const degradationNotes = Array.isArray(o.degradation_notes) ? o.degradation_notes : [];

  const raw = _extractResults(mcpResponse, toolName);
  let admitted = [];
  let rejectedProvenanceCount = 0;
  for (let rawIndex = 0; rawIndex < raw.length; rawIndex++) {
    const r = raw[rawIndex];
    if (_assertResultProvenance(r)) {
      // Normalize doc_id field (accept legacy 'id').
      const docId = (typeof r.doc_id === 'string' && r.doc_id.length > 0) ? r.doc_id : r.id;
      const substrateHitIndex = Number.isInteger(r._substrate_hit_index)
        ? r._substrate_hit_index
        : rawIndex;
      const resultDegradationNotes = degradationNotes
        .filter((note) => note
          && Number.isInteger(note.hit_index)
          && note.hit_index === substrateHitIndex)
        .map((note) => ({
          reason_code: note.reason_code,
          hit_index: note.hit_index,
          identity: note.identity,
          doc_id: note.doc_id,
          rel_path: note.rel_path,
          chunk_id: note.chunk_id,
          original_chars: note.original_chars,
          retained_chars: note.retained_chars,
        }));
      admitted.push(Object.assign({}, r, {
        doc_id: docId,
        _substrate_hit_index: substrateHitIndex,
        degradation_notes: resultDegradationNotes,
      }));
    } else {
      rejectedProvenanceCount++;
    }
  }

  if (admitted.length === 0 && raw.length === 0) {
    reason_codes.push('vtp_call_returned_empty');
  }

  // Apply cap.
  const capResult = _enforcePacketCap(admitted, o.maxTokens);
  if (capResult.elided > 0) reason_codes.push('evidence_packet_size_capped');
  if (degradationNotes.some((note) => (
    note && note.reason_code === 'vtp_substrate_hit_truncated'
  ))) {
    if (reason_codes.indexOf('evidence_packet_size_capped') === -1) {
      reason_codes.push('evidence_packet_size_capped');
    }
  }
  const kept = capResult.kept;

  // Build provenance arrays.
  const source_refs = [];
  const root_source_hashes = [];
  const sanitizedResults = [];
  for (const r of kept) {
    source_refs.push(String(r.doc_id));
    root_source_hashes.push(_hashOf(String(r.doc_id) + ':' + String(r.citation || '')));
    // Strip any MCP-internal fields; keep only the documented surface.
    const sanitizedResult = {
      doc_id: r.doc_id,
      citation: r.citation,
      title: typeof r.title === 'string' ? r.title : '',
      excerpt: typeof r.excerpt === 'string' ? r.excerpt : '',
      score: typeof r.score === 'number' ? r.score : null,
      source_type: typeof r.source_type === 'string' ? r.source_type : null,
    };
    const resultDegradationNotes = r.degradation_notes;
    if (resultDegradationNotes.length > 0) {
      sanitizedResult.degradation_notes = resultDegradationNotes;
    }
    sanitizedResults.push(sanitizedResult);
  }

  if (rejectedProvenanceCount > 0 && sanitizedResults.length === 0) {
    reason_codes.push('evidence_packet_provenance_failed');
  }
  if (reason_codes.indexOf('vtp_call_returned_empty') === -1
      && reason_codes.indexOf('evidence_packet_provenance_failed') === -1) {
    reason_codes.push('vtp_call_succeeded');
  }

  const packet = {
    envelope_version: ENVELOPE_VERSION,
    ts: _isoNow(),
    command: COMMAND_NAME,
    // ok=true ONLY when sanitized results exist. Empty results (zero source-backed
    // entries after provenance gating) are a non-success outcome — orchestrator
    // guards `if (packet.ok)` must NOT inject null context as evidence.
    ok: sanitizedResults.length > 0,
    vtp_tool: toolName,
    uncertainty_type: uncertainty_type,
    query: typeof query === 'string' ? query : null,
    results: sanitizedResults,
    source_refs: source_refs,
    root_source_hashes: root_source_hashes,
    confidence: sanitizedResults.length >= 3 ? 'high' : sanitizedResults.length >= 1 ? 'medium' : 'low',
    retrieved_at: _isoNow(),
    elided_count: capResult.elided,
    rejected_provenance_count: rejectedProvenanceCount,
    compression_level: sanitizedResults.length > 0 ? 'validated_thought' : null,
    body_token_estimate: capResult.tokens,
    error_logged_at: null,
    reason_codes: reason_codes,
    error: null,
  };
  return Object.freeze(packet);
}

function _buildFailureSentinelPacket(uncertainty_type, query, failureLogResult, reason_codes, toolName) {
  const packet = {
    envelope_version: ENVELOPE_VERSION,
    ts: _isoNow(),
    command: COMMAND_NAME,
    ok: false,
    vtp_tool: toolName || null,
    uncertainty_type: uncertainty_type || null,
    query: typeof query === 'string' ? query : null,
    results: [],
    source_refs: [],
    root_source_hashes: [],
    confidence: 'low',
    retrieved_at: null,
    elided_count: 0,
    rejected_provenance_count: 0,
    compression_level: null,
    body_token_estimate: 0,
    error_logged_at: failureLogResult && failureLogResult.error_logged_at || null,
    reason_codes: Array.isArray(reason_codes) ? reason_codes.slice() : ['bridge_internal_error'],
    error: null,
  };
  return Object.freeze(packet);
}

// ----------------------------------------------------------------------------
// PRIVATE: shim invocation. Synchronous-only by design — bridge module ships
// without MCP transport and the orchestrator is the timeout owner.
// ----------------------------------------------------------------------------
// CONTRACT: timeoutMs is the BUDGET the caller (orchestrator) must enforce
// when wiring the MCP shim via _force_response. This function does NOT race
// promises — it does NOT enforce timeoutMs itself. Routes.yaml carries the
// numeric budget for orchestrator consumption; the bridge accepts it for
// schema completeness but the actual timer lives in the shim wrapper. If a
// future refactor moves to async transports, replace this body with
// Promise.race over (shim, timer) and update the test fixtures accordingly.
function _callVtpToolShim(toolName, args, timeoutMs, _force_response) {
  // Synchronous shim invocation when _force_response is provided.
  // _force_response can be either:
  //   - a function (called with (toolName, args); may throw)
  //   - a value (returned as-is)
  if (typeof _force_response !== 'undefined') {
    if (typeof _force_response === 'function') {
      // Direct sync call; thrown errors classified by caller.
      return _force_response(toolName, args);
    }
    return _force_response;
  }
  // Production path: no shim wired -> throw structural error.
  // (Orchestrator wires the real MCP shim at runtime; bridge module ships
  // without an MCP transport.)
  const e = new Error('UNREACHABLE_shim_not_wired: caller must inject _force_vtp_tool_response or wire global vtp shim');
  throw e;
}

function _filterBookLookupResponse(response) {
  function isBookHit(hit) {
    if (!hit || typeof hit !== 'object') return false;
    const relPath = String(hit.rel_path || '')
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .toLowerCase();
    return relPath.startsWith('wiki/books/');
  }
  if (Array.isArray(response)) return response.filter(isBookHit);
  if (!response || typeof response !== 'object') return response;
  for (const key of ['results', 'hits', 'items']) {
    if (Array.isArray(response[key])) {
      return Object.assign({}, response, { [key]: response[key].filter(isBookHit) });
    }
  }
  return response;
}

function _indexSubstrateResponse(response) {
  function indexHits(hits) {
    return hits.map((hit, hitIndex) => (
      hit && typeof hit === 'object'
        ? Object.assign({}, hit, { _substrate_hit_index: hitIndex })
        : hit
    ));
  }
  if (Array.isArray(response)) return indexHits(response);
  if (!response || typeof response !== 'object') return response;
  for (const key of ['results', 'hits', 'items']) {
    if (Array.isArray(response[key])) {
      return Object.assign({}, response, { [key]: indexHits(response[key]) });
    }
  }
  return response;
}

// ----------------------------------------------------------------------------
// PRIVATE: _selectiveVTPCallInternal -- 5-gate decision flow
// ----------------------------------------------------------------------------
function _selectiveVTPCallInternal(input) {
  // Gate 1: validate input (throws on bad input; Lock 13 wrapper catches).
  _validateInput(input);

  const ucType = input.uncertainty_type;
  const query = input.query;
  const planningDir = input.planningDir || _defaultPlanningDir();
  const phase = input.phase || null;
  const milestone = input.milestone || null;
  const forces = _forcesFromInput(input);
  const opts = { phase: phase, milestone: milestone };

  // Resolve config (routes.yaml.vtp_bridge or compiled fallback).
  let cfg = {
    evidence_packet_max_tokens: EVIDENCE_PACKET_MAX_TOKENS_DEFAULT,
    per_query_timeout_ms: PER_QUERY_TIMEOUT_MS_DEFAULT,
    retry_on_timeout: false,
  };
  if (input.routes_yaml && input.routes_yaml.vtp_bridge && typeof input.routes_yaml.vtp_bridge === 'object') {
    const rb = input.routes_yaml.vtp_bridge;
    if (typeof rb.evidence_packet_max_tokens === 'number') cfg.evidence_packet_max_tokens = rb.evidence_packet_max_tokens;
    if (typeof rb.per_query_timeout_ms === 'number') cfg.per_query_timeout_ms = rb.per_query_timeout_ms;
    if (typeof rb.retry_on_timeout === 'boolean') cfg.retry_on_timeout = rb.retry_on_timeout;
  } else {
    // Try to read routes.yaml via Phase 47 loadRoutes; falls back gracefully.
    try {
      const yamlLibPath = path.resolve(__dirname, '..', 'plan-schema', 'node_modules', 'js-yaml');
      let yaml = null;
      try { yaml = require(yamlLibPath); } catch (_e) { yaml = null; }
      const yamlPath = path.join(__dirname, '..', 'dispatch-router', 'routes.yaml');
      if (yaml && fs.existsSync(yamlPath)) {
        const parsed = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
        if (parsed && parsed.vtp_bridge && typeof parsed.vtp_bridge === 'object') {
          const rb = parsed.vtp_bridge;
          if (typeof rb.evidence_packet_max_tokens === 'number') cfg.evidence_packet_max_tokens = rb.evidence_packet_max_tokens;
          if (typeof rb.per_query_timeout_ms === 'number') cfg.per_query_timeout_ms = rb.per_query_timeout_ms;
          if (typeof rb.retry_on_timeout === 'boolean') cfg.retry_on_timeout = rb.retry_on_timeout;
        }
      }
    } catch (_e) {
      // Compiled fallback already in cfg.
    }
  }

  // Gate 2: whitelist gate (defense-in-depth; Phase 47 already gated).
  // Identity check assertion 11 verifies route.VTP_WHITELIST is the same object.
  if (!route.VTP_WHITELIST.includes(ucType)) {
    // No ledger row, no failure log -- A1 binding (refused call != failure).
    return _buildFailureSentinelPacket(ucType, query, null, ['not_routed_to_vtp'], null);
  }

  const toolEntry = VTP_TOOL_MAP[ucType];
  const toolName = toolEntry ? toolEntry.tool : null;

  // Gate 3: vtp-health probe.
  const health = route.isProviderHealthy('vtp', planningDir, forces);
  if (!health || !health.healthy) {
    const failResult = _logVtpBridgeFailure(planningDir, {
      tool: toolName,
      uncertainty_type: ucType,
      error_type: 'mcp_unreachable',
      error_message: 'vtp_health probe returned unhealthy: ' + (health && health.reason || 'unknown'),
      retry_at: null,
      phase: phase,
      milestone: milestone,
    });
    const packet = _buildFailureSentinelPacket(ucType, query, failResult, ['vtp_unavailable'], toolName);
    _emitRouteLedgerRow(planningDir, packet, opts);
    return packet;
  }

  // Gate 4: dispatch shim with timeout.
  let mcpResponse;
  let substrateDegradationNotes = [];
  try {
    if (toolName === 'vtp_search_substrate') {
      const prepared = input._force_substrate_call
        || vtpComposer.prepareSubstrateCall(toolEntry.intent_family, { query });
      const callResult = vtpComposer.callVtp(toolName, {
        rawQuery: query,
        projectDir: path.dirname(planningDir),
        logRoot: path.dirname(planningDir),
        skillOrAgent: 'vtp-bridge-' + ucType,
        tier: 'research',
        substrateCall: prepared,
        mcpInvoke: function (emittedTool, payload) {
          return _callVtpToolShim(
            emittedTool,
            payload,
            cfg.per_query_timeout_ms,
            input._force_vtp_tool_response
          );
        },
      });
      if (callResult && typeof callResult.then === 'function') {
        throw new Error('VALIDATION_async_substrate_transport_not_supported');
      }
      if (!callResult || callResult.ok !== true) {
        throw new Error('VALIDATION_' + (callResult && callResult.reason || 'substrate_payload_invalid'));
      }
      mcpResponse = _indexSubstrateResponse(callResult.response);
      substrateDegradationNotes = Array.isArray(callResult.degradation_notes)
        ? callResult.degradation_notes
        : [];
      if (ucType === 'book_lookup') mcpResponse = _filterBookLookupResponse(mcpResponse);
    } else {
      const args = Object.assign({ query: typeof query === 'string' ? query : '' }, toolEntry.args_template);
      if (Array.isArray(args.tier)) args.tier = args.tier.slice();
      mcpResponse = _callVtpToolShim(toolName, args, cfg.per_query_timeout_ms, input._force_vtp_tool_response);
    }
  } catch (err) {
    const kind = _classifyError(err);
    const reason = _reasonForFailureKind(kind);
    const failResult = _logVtpBridgeFailure(planningDir, {
      tool: toolName,
      uncertainty_type: ucType,
      error_type: kind,
      error_message: (err && err.message) ? String(err.message) : String(err),
      retry_at: null,
      phase: phase,
      milestone: milestone,
    });
    const packet = _buildFailureSentinelPacket(ucType, query, failResult, [reason], toolName);
    _emitRouteLedgerRow(planningDir, packet, opts);
    return packet;
  }

  // Gate 5: success path -> build evidence packet -> emit ledger row.
  const packet = _buildEvidencePacket(ucType, query, mcpResponse, {
    maxTokens: cfg.evidence_packet_max_tokens,
    degradation_notes: substrateDegradationNotes,
  });
  _emitRouteLedgerRow(planningDir, packet, opts);
  return packet;
}

// ----------------------------------------------------------------------------
// PUBLIC API: Lock 13 wrapped
// ----------------------------------------------------------------------------
function selectiveVTPCall(input) {
  try {
    return _selectiveVTPCallInternal(input);
  } catch (e) {
    try { console.warn('[SGSD] vtp-bridge selectiveVTPCall failed:', e && e.message); } catch (_) {}
    return Object.freeze({
      envelope_version: ENVELOPE_VERSION,
      ts: _isoNow(),
      command: COMMAND_NAME,
      ok: false,
      vtp_tool: null,
      uncertainty_type: input && input.uncertainty_type || null,
      query: input && typeof input.query === 'string' ? input.query : null,
      results: [],
      source_refs: [],
      root_source_hashes: [],
      confidence: 'low',
      retrieved_at: null,
      elided_count: 0,
      rejected_provenance_count: 0,
      compression_level: null,
      body_token_estimate: 0,
      error_logged_at: null,
      reason_codes: ['bridge_internal_error'],
      error: e && e.message ? String(e.message) : 'unknown',
    });
  }
}

function selectiveVTPCallForPacket(intent_map, opts) {
  try {
    const o = opts || {};
    const input = {
      uncertainty_type: o.uncertainty_type || (intent_map && intent_map.uncertainty_type),
      query: o.query || (intent_map && intent_map.query) || (intent_map && intent_map.intent_id) || '',
      planningDir: o.planningDir,
      phase: o.phase || (intent_map && intent_map.phase),
      milestone: o.milestone || (intent_map && intent_map.milestone),
      _force_vtp_tool_response: o._force_vtp_tool_response,
      _force_vtp_health: o._force_vtp_health,
      routes_yaml: o.routes_yaml,
    };
    return selectiveVTPCall(input);
  } catch (e) {
    return selectiveVTPCall({ uncertainty_type: null, query: null });
  }
}

// ----------------------------------------------------------------------------
// SELF-TEST (13 assertions: F1-F10, assertion 11 defense-in-depth, P166 12-13)
// ----------------------------------------------------------------------------
function _runSelfTest() {
  const start = Date.now();
  let pass = 0, fail = 0;
  const failures = [];
  const ok = (name) => { pass++; console.log('[ok] ' + name); };
  const failAssert = (name, reason) => {
    fail++;
    failures.push({ name: name, reason: reason });
    console.error('[FAIL] ' + name + ': ' + reason);
  };

  // Fixture-scoped tmpdir (prevents canonical-stream pollution; T-48-10 mitigation).
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-bridge-'));
  const tmpPlanning = path.join(tmpRoot, '.planning');
  fs.mkdirSync(path.join(tmpPlanning, 'metrics'), { recursive: true });

  // Snapshots for F7 + F10 (read-only invariant).
  const phase45Path = path.resolve(__dirname, '..', 'context-packet', 'build.cjs');
  const phase47Path = path.resolve(__dirname, '..', 'dispatch-router', 'route.cjs');
  const phase32Path = path.resolve(__dirname, '..', '..', 'scripts', 'lib', 'route-ledger.cjs');
  const codexLogPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'codex-log.jsonl');
  const routeDecPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'route-decisions.jsonl');
  const vtpHealthPath = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'vtp-health.jsonl');

  function snap(p) {
    if (!fs.existsSync(p)) return { exists: false, size: 0, mtime: 0 };
    const st = fs.statSync(p);
    return { exists: true, size: st.size, mtime: st.mtimeMs };
  }
  const snapBefore = {
    p45: snap(phase45Path), p47: snap(phase47Path), p32: snap(phase32Path),
    cl:  snap(codexLogPath), rd:  snap(routeDecPath), vh:  snap(vtpHealthPath),
  };

  try {
    // ------------------------------------------------------------------
    // Assertion 1 (F1): architecture_challenge -> vtp_search_substrate, 3 results.
    // ------------------------------------------------------------------
    try {
      let architectureArgs = null;
      const fixture = {
        results: [
          { doc_id: 'paper-001', title: 'Event Sourcing Tradeoffs', citation: 'Vernon 2013 p.42', excerpt: 'Trade-off A', score: 0.9 },
          { doc_id: 'paper-002', title: 'CQRS Patterns',            citation: 'Young 2010 p.7',   excerpt: 'Trade-off B', score: 0.8 },
          { doc_id: 'paper-003', title: 'Reactive Architectures',   citation: 'Boner 2017 p.15',  excerpt: 'Trade-off C', score: 0.7 },
        ],
      };
      const packet = selectiveVTPCall({
        uncertainty_type: 'architecture_challenge',
        query: 'event sourcing tradeoffs',
        planningDir: tmpPlanning,
        phase: 48,
        milestone: 'v1.9',
        _force_vtp_tool_response: function (toolName, args) {
          architectureArgs = { toolName: toolName, args: args };
          return fixture;
        },
        _force_vtp_health: true,
      });
      if (packet.ok !== true) throw new Error('ok=' + packet.ok);
      if (packet.vtp_tool !== 'vtp_search_substrate') throw new Error('vtp_tool=' + packet.vtp_tool);
      if (packet.results.length !== 3) throw new Error('results.length=' + packet.results.length);
      if (packet.source_refs.length !== 3) throw new Error('source_refs.length=' + packet.source_refs.length);
      if (packet.root_source_hashes.length !== 3) throw new Error('root_source_hashes.length=' + packet.root_source_hashes.length);
      if (packet.reason_codes.indexOf('vtp_call_succeeded') === -1) throw new Error('missing reason_codes vtp_call_succeeded');
      if (packet.compression_level !== 'validated_thought') throw new Error('compression_level=' + packet.compression_level);
      if (!architectureArgs) throw new Error('architecture shim not invoked');
      if (architectureArgs.args.limit !== 3) throw new Error('architecture limit=' + architectureArgs.args.limit);
      if (architectureArgs.args.source_types.join(',') !== 'research_paper,wiki_page') {
        throw new Error('architecture source_types=' + architectureArgs.args.source_types.join(','));
      }
      ok('1. F1 architecture_challenge -> vtp_search_substrate (3 results)');
    } catch (e) { failAssert('1. F1 architecture_challenge', e.message); }

    // ------------------------------------------------------------------
    // Assertion 2 (F2 -- A3 binding): TIMEOUT -> failure log + empty packet.
    // ------------------------------------------------------------------
    try {
      const failPlanning = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-f2-')), '.planning');
      fs.mkdirSync(path.join(failPlanning, 'metrics'), { recursive: true });
      const packet = selectiveVTPCall({
        uncertainty_type: 'architecture_challenge',
        query: 'timeout query',
        planningDir: failPlanning,
        _force_vtp_health: true,
        _force_vtp_tool_response: function () { throw new Error('TIMEOUT_30000ms'); },
      });
      if (packet.ok !== false) throw new Error('ok=' + packet.ok);
      if (packet.results.length !== 0) throw new Error('results.length=' + packet.results.length);
      if (packet.reason_codes.indexOf('vtp_call_timeout') === -1) throw new Error('missing reason vtp_call_timeout');
      if (packet.error_logged_at === null) throw new Error('error_logged_at is null');
      // Critical: error text MUST NOT appear in packet body.
      const ser = JSON.stringify(packet);
      if (ser.indexOf('TIMEOUT') !== -1) throw new Error('packet contains "TIMEOUT" substring (A3 violation)');
      if (/timeout after/i.test(ser)) throw new Error('packet contains "timeout after" substring (A3 violation)');
      // Verify failure log row.
      const logPath = path.join(failPlanning, 'metrics', 'vtp-bridge-failures.jsonl');
      if (!fs.existsSync(logPath)) throw new Error('vtp-bridge-failures.jsonl not created');
      const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      if (lines.length !== 1) throw new Error('expected 1 row; got ' + lines.length);
      const row = JSON.parse(lines[0]);
      if (row.command !== 'vtpBridgeFailure') throw new Error('row.command=' + row.command);
      if (row.error_type !== 'mcp_timeout') throw new Error('row.error_type=' + row.error_type);
      if (row.error_message.indexOf('TIMEOUT_30000ms') === -1) throw new Error('row.error_message missing TIMEOUT_30000ms');
      ok('2. F2 MCP timeout -> failures.jsonl + empty results[] (A3)');
    } catch (e) { failAssert('2. F2 MCP failure isolation', e.message); }

    // ------------------------------------------------------------------
    // Assertion 3 (F3 -- A4 cap): 10x500-token results capped at 2000.
    // ------------------------------------------------------------------
    try {
      const big = [];
      const filler = new Array(500).fill('lorem').join(' ');
      for (let i = 0; i < 10; i++) {
        big.push({
          doc_id: 'big-' + i,
          rel_path: 'wiki/books/big-' + i + '.md',
          title: 'B' + i,
          citation: 'cite-' + i,
          excerpt: filler,
          score: 1 - i * 0.05,
        });
      }
      const f3Planning = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-f3-')), '.planning');
      fs.mkdirSync(path.join(f3Planning, 'metrics'), { recursive: true });
      const packet = selectiveVTPCall({
        uncertainty_type: 'book_lookup',
        query: 'book packet cap query',
        planningDir: f3Planning,
        _force_vtp_health: true,
        routes_yaml: { vtp_bridge: { evidence_packet_max_tokens: 2000 } },
        _force_vtp_tool_response: { results: big },
      });
      if (!(packet.body_token_estimate <= 2000)) throw new Error('body_token_estimate=' + packet.body_token_estimate);
      if (!(packet.elided_count > 0)) throw new Error('elided_count=' + packet.elided_count);
      if (packet.reason_codes.indexOf('evidence_packet_size_capped') === -1) throw new Error('missing size_capped reason');
      if (!(packet.results.length < 10)) throw new Error('results.length=' + packet.results.length);
      ok('3. F3 5000-token cap descending elision (A4)');
    } catch (e) { failAssert('3. F3 evidence_packet cap', e.message); }

    // ------------------------------------------------------------------
    // Assertion 4 (F4): book_lookup uses v2 policy and client-side book filtering.
    // ------------------------------------------------------------------
    try {
      let capturedArgs = null;
      const f4Planning = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-f4-')), '.planning');
      fs.mkdirSync(path.join(f4Planning, 'metrics'), { recursive: true });
      const packet = selectiveVTPCall({
        uncertainty_type: 'book_lookup',
        query: 'antifragile principles',
        planningDir: f4Planning,
        _force_vtp_health: true,
        _force_vtp_tool_response: function (toolName, args) {
          capturedArgs = { toolName: toolName, args: args };
          return { results: [
            {
              doc_id: 'b-1',
              rel_path: 'wiki/books/antifragile.md',
              citation: 'Taleb 2012 p.10',
              excerpt: 'note',
            },
            {
              doc_id: 'm-1',
              rel_path: 'wiki/meetings/not-a-book.md',
              citation: 'meeting note',
              excerpt: 'reject',
            },
          ] };
        },
      });
      if (packet.vtp_tool !== 'vtp_search_substrate') throw new Error('vtp_tool=' + packet.vtp_tool);
      if (!capturedArgs) throw new Error('shim not invoked');
      if (capturedArgs.toolName !== 'vtp_search_substrate') throw new Error('toolName=' + capturedArgs.toolName);
      if (capturedArgs.args.limit !== 5) throw new Error('book limit=' + capturedArgs.args.limit);
      if (capturedArgs.args.source_types.join(',') !== 'wiki_page') {
        throw new Error('book source_types=' + capturedArgs.args.source_types.join(','));
      }
      if (Object.prototype.hasOwnProperty.call(capturedArgs.args, 'resource_subtype_filter')) {
        throw new Error('unsupported resource_subtype_filter emitted');
      }
      if (packet.results.length !== 1 || packet.results[0].doc_id !== 'b-1') {
        throw new Error('client-side book filtering failed');
      }
      let invalidShimCalls = 0;
      const validPrepared = vtpComposer.prepareSubstrateCall('book_lookup', {
        query: 'invalid prepared book query',
      });
      const invalidPayload = Object.assign({}, validPrepared.payload, { limit: 6 });
      const invalidPrepared = Object.assign({}, validPrepared, {
        payload: invalidPayload,
        gateway_evidence: Object.assign({}, validPrepared.gateway_evidence, {
          payload_sha256: vtpComposer._internal.substratePayloadDigest(invalidPayload),
        }),
      });
      const invalidPacket = selectiveVTPCall({
        uncertainty_type: 'book_lookup',
        query: 'invalid prepared book query',
        planningDir: f4Planning,
        _force_vtp_health: true,
        _force_substrate_call: invalidPrepared,
        _force_vtp_tool_response: function () {
          invalidShimCalls++;
          return { results: [] };
        },
      });
      if (invalidShimCalls !== 0) throw new Error('invalid prepared payload reached shim');
      if (invalidPacket.reason_codes.indexOf('vtp_call_validation_failed') === -1) {
        throw new Error('invalid prepared payload did not fail validation');
      }
      ok('4. F4 book_lookup v2 policy, client filter, and invalid-payload refusal');
    } catch (e) { failAssert('4. F4 book_lookup tool mapping', e.message); }

    // ------------------------------------------------------------------
    // Assertion 5 (F5 -- A1 + LOCK-11): non-whitelist -> not_routed_to_vtp, no shim, no log.
    // ------------------------------------------------------------------
    try {
      const f5Planning = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-f5-')), '.planning');
      fs.mkdirSync(path.join(f5Planning, 'metrics'), { recursive: true });
      const packet = selectiveVTPCall({
        uncertainty_type: 'synthesis_judgment',
        query: 'provider health query',
        planningDir: f5Planning,
        _force_vtp_health: true,
        _force_vtp_tool_response: function () { throw new Error('SHOULD_NOT_BE_CALLED'); },
      });
      if (packet.ok !== false) throw new Error('ok=' + packet.ok);
      if (packet.reason_codes.indexOf('not_routed_to_vtp') === -1) throw new Error('missing not_routed_to_vtp');
      // No failure log row.
      const logPath = path.join(f5Planning, 'metrics', 'vtp-bridge-failures.jsonl');
      if (fs.existsSync(logPath)) throw new Error('failures.jsonl unexpectedly created');
      ok('5. F5 non-whitelist -> not_routed_to_vtp (no shim, no log)');
    } catch (e) { failAssert('5. F5 whitelist gate', e.message); }

    // ------------------------------------------------------------------
    // Assertion 6 (F6): vtp-health unhealthy -> vtp_unavailable + log row, no shim.
    // ------------------------------------------------------------------
    try {
      const f6Planning = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-f6-')), '.planning');
      fs.mkdirSync(path.join(f6Planning, 'metrics'), { recursive: true });
      const packet = selectiveVTPCall({
        uncertainty_type: 'architecture_challenge',
        query: 'mixed provenance query',
        planningDir: f6Planning,
        _force_vtp_health: false,
        _force_vtp_tool_response: function () { throw new Error('SHOULD_NOT_BE_CALLED'); },
      });
      if (packet.ok !== false) throw new Error('ok=' + packet.ok);
      if (packet.reason_codes.indexOf('vtp_unavailable') === -1) throw new Error('missing vtp_unavailable');
      const logPath = path.join(f6Planning, 'metrics', 'vtp-bridge-failures.jsonl');
      if (!fs.existsSync(logPath)) throw new Error('failures.jsonl not created');
      const rows = fs.readFileSync(logPath, 'utf8').trim().split('\n');
      if (rows.length !== 1) throw new Error('expected 1 row; got ' + rows.length);
      const row = JSON.parse(rows[0]);
      if (row.error_type !== 'mcp_unreachable') throw new Error('error_type=' + row.error_type);
      ok('6. F6 vtp-health unhealthy -> vtp_unavailable + log row');
    } catch (e) { failAssert('6. F6 vtp-health gate', e.message); }

    // ------------------------------------------------------------------
    // Assertion 7 (F7): Phase 45/47/32 source files UNCHANGED.
    // ------------------------------------------------------------------
    try {
      const sa = snap(phase45Path), sb = snap(phase47Path), sc = snap(phase32Path);
      if (snapBefore.p45.size !== sa.size || snapBefore.p45.mtime !== sa.mtime) throw new Error('Phase 45 build.cjs CHANGED');
      if (snapBefore.p47.size !== sb.size || snapBefore.p47.mtime !== sb.mtime) throw new Error('Phase 47 route.cjs CHANGED');
      if (snapBefore.p32.size !== sc.size || snapBefore.p32.mtime !== sc.mtime) throw new Error('Phase 32 route-ledger.cjs CHANGED');
      ok('7. F7 Phase 45/47/32 source files UNCHANGED');
    } catch (e) { failAssert('7. F7 read-only invariant on Phase 45/47/32 sources', e.message); }

    // ------------------------------------------------------------------
    // Assertion 8 (F8): mixed-shape provenance gate.
    // 5 results: 2 doc_id+citation, 1 id+citation (legacy ADMIT), 1 empty citation (REJECT), 1 missing both (REJECT).
    // ------------------------------------------------------------------
    try {
      const fixture = {
        results: [
          { doc_id: 'p-1', citation: 'cite-1', excerpt: 'a', score: 0.9 },
          { doc_id: 'p-2', citation: 'cite-2', excerpt: 'b', score: 0.85 },
          { id: 'p-3',     citation: 'cite-3', excerpt: 'c', score: 0.8 },  // legacy id ADMIT
          { doc_id: 'p-4', citation: '',       excerpt: 'd', score: 0.7 },  // empty citation REJECT
          {                                    excerpt: 'e', score: 0.6 },  // missing both REJECT
        ],
      };
      const f8Planning = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vtp-f8-')), '.planning');
      fs.mkdirSync(path.join(f8Planning, 'metrics'), { recursive: true });
      const packet = selectiveVTPCall({
        uncertainty_type: 'architecture_challenge',
        query: 'mixed provenance query',
        planningDir: f8Planning,
        _force_vtp_health: true,
        _force_vtp_tool_response: fixture,
      });
      if (packet.results.length !== 3) throw new Error('admitted results.length=' + packet.results.length + ' (expected 3)');
      if (packet.rejected_provenance_count !== 2) throw new Error('rejected_provenance_count=' + packet.rejected_provenance_count + ' (expected 2)');
      ok('8. F8 mixed-shape provenance gate (3 admitted, 2 rejected)');
    } catch (e) { failAssert('8. F8 provenance gate', e.message); }

    // ------------------------------------------------------------------
    // Assertion 9 (F9 -- LOCK-11 + LOCK-13): banned semantic field -> bridge_internal_error.
    // ------------------------------------------------------------------
    try {
      const packet = selectiveVTPCall({
        uncertainty_type: 'architecture_challenge',
        query: 'X',
        embedding: [0.1, 0.2],
      });
      if (packet.ok !== false) throw new Error('ok=' + packet.ok);
      if (packet.reason_codes.indexOf('bridge_internal_error') === -1) throw new Error('missing bridge_internal_error');
      if (typeof packet.error !== 'string' || packet.error.indexOf('embedding') === -1) {
        throw new Error('error message does not mention embedding: ' + packet.error);
      }
      ok('9. F9 LOCK-11 banned field -> bridge_internal_error sentinel');
    } catch (e) { failAssert('9. F9 LOCK-11 banned-field rejection', e.message); }

    // ------------------------------------------------------------------
    // Assertion 10 (F10): canonical .planning/metrics streams UNCHANGED.
    // ------------------------------------------------------------------
    try {
      const a = snap(codexLogPath), b = snap(routeDecPath), c = snap(vtpHealthPath);
      if (snapBefore.cl.exists !== a.exists || snapBefore.cl.size !== a.size || snapBefore.cl.mtime !== a.mtime) {
        throw new Error('codex-log.jsonl CHANGED');
      }
      if (snapBefore.rd.exists !== b.exists || snapBefore.rd.size !== b.size || snapBefore.rd.mtime !== b.mtime) {
        throw new Error('route-decisions.jsonl CHANGED');
      }
      if (snapBefore.vh.exists !== c.exists || snapBefore.vh.size !== c.size || snapBefore.vh.mtime !== c.mtime) {
        throw new Error('vtp-health.jsonl CHANGED');
      }
      ok('10. F10 canonical .planning/metrics streams UNCHANGED');
    } catch (e) { failAssert('10. F10 canonical-stream read-only invariant', e.message); }

    // ------------------------------------------------------------------
    // Assertion 11 (defense-in-depth): Phase 47 VTP_WHITELIST imported BY REFERENCE.
    // ------------------------------------------------------------------
    try {
      const route2 = require('../dispatch-router/route.cjs');
      // Same module instance -> same VTP_WHITELIST reference (Node module cache).
      if (route.VTP_WHITELIST !== route2.VTP_WHITELIST) {
        throw new Error('VTP_WHITELIST identity differs between two requires (cache miss?)');
      }
      if (!Object.isFrozen(route.VTP_WHITELIST)) throw new Error('VTP_WHITELIST not frozen');
      if (route.VTP_WHITELIST.length !== 3) throw new Error('VTP_WHITELIST length=' + route.VTP_WHITELIST.length);
      // Verify VTP_TOOL_MAP keys SUPERSET of VTP_WHITELIST (3 active + 1 reserved).
      for (const k of route.VTP_WHITELIST) {
        if (!VTP_TOOL_MAP[k]) throw new Error('VTP_WHITELIST entry ' + k + ' missing from VTP_TOOL_MAP');
      }
      ok('11. defense-in-depth: VTP_WHITELIST imported BY REFERENCE (frozen, length=3)');
    } catch (e) { failAssert('11. defense-in-depth VTP_WHITELIST identity', e.message); }

    // ------------------------------------------------------------------
    // Assertion 12 (P166): raw substrate hit cap is visible in the packet.
    // ------------------------------------------------------------------
    try {
      const discardedMarker = 'P166_BRIDGE_DISCARDED_SUFFIX';
      const p166Planning = path.join(tmpRoot, 'p166', '.planning');
      fs.mkdirSync(path.join(p166Planning, 'metrics'), { recursive: true });
      const packet = selectiveVTPCall({
        uncertainty_type: 'architecture_challenge',
        query: 'P166 bridge oversized substrate hit',
        planningDir: p166Planning,
        _force_vtp_health: true,
        _force_vtp_tool_response: {
          hits: [{
            doc_id: 'doc:lint-report',
            rel_path: 'wiki/LINT-REPORT.md',
            chunk_id: 'chunk:lint-report',
            citation: 'doc:lint-report',
            excerpt: 'bounded packet excerpt',
            text: 'r'.repeat(16000) + discardedMarker,
          }],
        },
      });
      if (packet.ok !== true) throw new Error('packet.ok=' + packet.ok);
      if (packet.reason_codes.indexOf('evidence_packet_size_capped') === -1) {
        throw new Error('missing evidence_packet_size_capped');
      }
      const degradationNotes = packet.results[0] && packet.results[0].degradation_notes;
      if (!Array.isArray(degradationNotes)
          || !degradationNotes[0]
          || degradationNotes[0].reason_code !== 'vtp_substrate_hit_truncated') {
        throw new Error('missing vtp_substrate_hit_truncated note');
      }
      if (JSON.stringify(packet).indexOf(discardedMarker) !== -1) {
        throw new Error('packet contains discarded substrate text');
      }
      ok('12. P166 oversized substrate hit -> bounded packet + named degradation');
    } catch (e) { failAssert('12. P166 bridge substrate hit cap', e.message); }

    // ------------------------------------------------------------------
    // Assertion 13 (P166): legacy id normalization retains the named note.
    // ------------------------------------------------------------------
    try {
      const legacyPlanning = path.join(tmpRoot, 'p166-legacy', '.planning');
      fs.mkdirSync(path.join(legacyPlanning, 'metrics'), { recursive: true });
      const packet = selectiveVTPCall({
        uncertainty_type: 'architecture_challenge',
        query: 'P166 bridge legacy id oversized hit',
        planningDir: legacyPlanning,
        _force_vtp_health: true,
        _force_vtp_tool_response: {
          hits: [{
            id: 'legacy-1',
            citation: 'legacy citation',
            excerpt: 'legacy bounded excerpt',
            text: 'l'.repeat(16001),
          }],
        },
      });
      const note = packet.results[0]
        && Array.isArray(packet.results[0].degradation_notes)
        && packet.results[0].degradation_notes[0];
      if (!note || note.reason_code !== 'vtp_substrate_hit_truncated') {
        throw new Error('legacy id result missing named degradation note');
      }
      if (note.hit_index !== 0 || note.identity !== 'hit-1') {
        throw new Error('legacy id note lost raw hit identity');
      }
      ok('13. P166 legacy id -> normalized doc_id + raw-index degradation note');
    } catch (e) { failAssert('13. P166 bridge legacy-id note attachment', e.message); }
  } finally {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) {}
  }

  const elapsed = Date.now() - start;
  const total = pass + fail;
  console.log('Self-test: ' + pass + '/' + total + ' passed (' + elapsed + ' ms)');
  if (fail > 0) {
    for (const f of failures) console.error('  FAIL: ' + f.name + ' -- ' + f.reason);
    return 1;
  }
  return 0;
}

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------
if (require.main === module) {
  const argv = process.argv.slice(2);
  if (argv[0] === '--self-test') {
    process.exit(_runSelfTest());
  }
  if (argv[0] === '--bridge') {
    let uc = null, q = null, ph = null, ms = null;
    for (let i = 1; i < argv.length; i++) {
      if (argv[i] === '--uncertainty-type') { uc = argv[++i]; continue; }
      if (argv[i] === '--query')             { q = argv[++i]; continue; }
      if (argv[i] === '--phase')             { ph = argv[++i]; continue; }
      if (argv[i] === '--milestone')         { ms = argv[++i]; continue; }
    }
    const packet = selectiveVTPCall({ uncertainty_type: uc, query: q, phase: ph, milestone: ms });
    console.log(JSON.stringify(packet, null, 2));
    process.exit(packet.ok ? 0 : 1);
  }
  console.error('Usage:');
  console.error('  node classify.cjs --self-test');
  console.error('  node classify.cjs --bridge --uncertainty-type X --query Y [--phase N] [--milestone V]');
  process.exit(1);
}

// ----------------------------------------------------------------------------
// EXPORTS
// ----------------------------------------------------------------------------
module.exports = {
  selectiveVTPCall: selectiveVTPCall,
  selectiveVTPCallForPacket: selectiveVTPCallForPacket,
  VTP_TOOL_MAP: VTP_TOOL_MAP,
  VTP_BRIDGE_REASONS: VTP_BRIDGE_REASONS,
  FAILURE_KINDS: FAILURE_KINDS,
  EVIDENCE_PACKET_MAX_TOKENS_DEFAULT: EVIDENCE_PACKET_MAX_TOKENS_DEFAULT,
  PER_QUERY_TIMEOUT_MS_DEFAULT: PER_QUERY_TIMEOUT_MS_DEFAULT,
  COMMAND_NAME: COMMAND_NAME,
  ENVELOPE_VERSION: ENVELOPE_VERSION,
};
