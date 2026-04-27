// ============================================================================
// SGSD - CONTEXT-PACKET builder (Phase 45 -- PACKET-01..05 + VTP-delta 11..13)
// ============================================================================
// 6-role packet builder. Replaces raw inherited context with role-specific
// packets pulling from capsules/registry/index BEFORE raw files.
//
// Lock 4: packets are the only legal dispatch surface.
// Lock 6: bypass_refs[] byte-verbatim from Phase 43 capsule.bypass_refs[].
// Lock 11: REASON_VOCAB closed enum (no 'semantic_similarity_only').
// Lock 12: source-file body text never populates operator-intent fields.
// Lock 13: never throws upward; falsey sentinel on error.
//
// Wave-1 deliverable: frozen consts + module.exports skeleton. Public APIs
// return {ok:false, reason:'wave_1_stub'} sentinel until Wave 3 lands.
//
// No external deps. Manual JSON validation per Phase 43 _assertCapsuleSchema.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ----------------------------------------------------------------------------
// PHASE 41/42/43/44 IMPORTS BY REFERENCE
// ----------------------------------------------------------------------------
let _phase41 = null;
let _phase42 = null;
let _phase43 = null;
let _phase44 = null;
let _intentMap = null;

try { _phase41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs')); } catch (_e) {}
try { _phase42 = require(path.join(__dirname, '..', 'token-waste', 'check.cjs')); } catch (_e) {}
try { _phase43 = require(path.join(__dirname, '..', 'phase-capsule', 'write.cjs')); } catch (_e) {}
try { _phase44 = require(path.join(__dirname, '..', 'context-registry', 'check.cjs')); } catch (_e) {}
try { _intentMap = require(path.join(__dirname, '..', 'intent-map', 'build.cjs')); } catch (_e) {}

// ----------------------------------------------------------------------------
// FROZEN CONSTANTS
// ----------------------------------------------------------------------------
const ENVELOPE_VERSION = 1;
const COMMAND_NAME = 'buildContextPacket';

// 6-entry ROLE_MODES (PACKET-02).
const ROLE_MODES = Object.freeze([
  'researcher', 'planner', 'executor', 'verifier', 'reviewer', 'cockpit',
]);

// 13-entry REASON_VOCAB shared with intent-map (LOCK 11).
const REASON_VOCAB = Object.freeze([
  'current_active_phase',
  'current_milestone_goal',
  'explicit_artifact_mention',
  'repeated_operator_complaint',
  'same_failure_pattern',
  'phase_dependency_edge',
  'phase_close_pattern_recurrence',
  'shared_gate_or_provider',
  'recent_phase_same_milestone',
  'audit_evidence_cite',
  'codex_finding_cite',
  'vtp_evidence_cite',
  'archived_milestone_explicit_reference',
]);

// TIER_WEIGHT keyed 1:1 with REASON_VOCAB.
const TIER_WEIGHT = Object.freeze({
  current_active_phase: 0.95,
  current_milestone_goal: 0.90,
  explicit_artifact_mention: 0.92,
  repeated_operator_complaint: 0.85,
  same_failure_pattern: 0.80,
  phase_dependency_edge: 0.75,
  phase_close_pattern_recurrence: 0.70,
  shared_gate_or_provider: 0.55,
  recent_phase_same_milestone: 0.45,
  audit_evidence_cite: 0.85,
  codex_finding_cite: 0.78,
  vtp_evidence_cite: 0.78,
  archived_milestone_explicit_reference: 0.40,
});

// 9-entry packet reason codes.
const PACKET_REASON_CODES = Object.freeze([
  'packet_built_clean',
  'packet_built_with_omitted_material',
  'packet_over_budget_degraded',
  'packet_invalid_references_filtered',
  'packet_intent_map_missing',
  'packet_capsule_unavailable_raw_fallback',
  'packet_bypass_refs_preserved_verbatim',
  'packet_p41_bloat_avoided',
  'packet_self_request',
]);

// 5-entry COMPRESSION_LEVELS (VTP-RESEARCH-DELTA).
const COMPRESSION_LEVELS = Object.freeze([
  'raw_evidence',
  'phase_capsule',
  'validated_thought',
  'reusable_rule',
  'guardrail',
]);

// 7-entry context_source_mix keys (VTP-delta A10).
const CONTEXT_SOURCE_MIX_KEYS = Object.freeze([
  'raw_evidence',
  'phase_capsule',
  'validated_thought',
  'reusable_rule',
  'guardrail',
  'index_snippet',
  'vtp_packet',
]);

// PACKET_BUDGETS extends Phase 42 BUDGETS in-module with cockpit:30k.
// NEVER writes back to budgets.yaml. Filesystem mtime+size invariant.
const _baseBudgets = (_phase42 && _phase42.BUDGETS) || Object.freeze({
  researcher: Object.freeze({ warn_input: 25000, degrade_input: 25000 }),
  planner:    Object.freeze({ warn_input: 30000, degrade_input: 30000 }),
  executor:   Object.freeze({ warn_input: 40000, degrade_input: 40000 }),
  verifier:   Object.freeze({ warn_input: 20000, degrade_input: 20000 }),
  reviewer:   Object.freeze({ warn_input: 20000, degrade_input: 20000 }),
});
const PACKET_BUDGETS = Object.freeze(Object.assign({}, _baseBudgets, {
  cockpit: Object.freeze({ warn_input: 30000, degrade_input: 30000 }),
}));

// Re-export of intent-map enums for cross-module checks.
const INTENT_MAP_REASON_CODES = (_intentMap && _intentMap.INTENT_MAP_REASON_CODES) || Object.freeze([
  'intent_compiled_clean',
  'intent_ambiguity_blocking',
  'intent_ambiguity_proceed',
  'intent_prompt_injection_filtered',
  'intent_relationship_semantic_only_demoted',
  'intent_clarify_resolved_by_prior_context',
  'intent_speech_fields_included',
  'intent_compile_fallback_used',
]);

// ----------------------------------------------------------------------------
// PATHS
// ----------------------------------------------------------------------------
const SCHEMA_PATH = path.join(__dirname, 'PACKET.schema.json');
const REL_LEDGER = path.join('metrics', 'context-packet-log.jsonl');
const REL_COMPLAINTS = path.join('metrics', 'context-complaints.jsonl');

function _planningDir(opts) {
  if (opts && opts.planningDir) return opts.planningDir;
  return path.join(process.cwd(), '.planning');
}
function _ledgerPath(opts) { return path.join(_planningDir(opts), REL_LEDGER); }
function _complaintsPath(opts) { return path.join(_planningDir(opts), REL_COMPLAINTS); }

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------
function _isoNow() { return new Date().toISOString(); }

function _safeReadFile(p) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf8');
  } catch (_e) { return null; }
}
function _safeReadFileBuffer(p) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    return fs.readFileSync(p);
  } catch (_e) { return null; }
}
function _safeReadJson(p) {
  try { const s = _safeReadFile(p); if (!s) return null; return JSON.parse(s); }
  catch (_e) { return null; }
}
function _ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); return true; } catch (_e) { return false; }
}
function _appendRow(p, row) {
  try {
    _ensureDir(path.dirname(p));
    fs.appendFileSync(p, JSON.stringify(row) + '\n', 'utf8');
    return true;
  } catch (_e) { return false; }
}
function _readRows(p) {
  const out = [];
  const txt = _safeReadFile(p);
  if (!txt) return out;
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    try { const r = JSON.parse(l); if (r && typeof r === 'object') out.push(r); }
    catch (_e) {}
  }
  return out;
}
function _packetIdHash(intent_ref, role, body_hash) {
  try {
    return crypto.createHash('sha256')
      .update(String(intent_ref || '') + ':' + String(role || '') + ':' + String(body_hash || ''))
      .digest('hex').slice(0, 16);
  } catch (_e) { return '0000000000000000'; }
}
function _estimateTokens(text) {
  try {
    const s = String(text || '');
    if (!s) return 0;
    const words = s.split(/\s+/).filter(Boolean).length;
    return Math.ceil(words * 1.3);
  } catch (_e) { return 0; }
}

// VTP-delta: validated_thought provenance gate.
function _assertValidatedThoughtProvenance(t) {
  try {
    if (!t || typeof t !== 'object') {
      return { ok: false, reason: 'validated_thought_missing_provenance: source_refs or root_source_hashes empty/missing' };
    }
    const hasSourceRefs = Array.isArray(t.source_refs) && t.source_refs.length > 0;
    const hasRootHashes = Array.isArray(t.root_source_hashes) && t.root_source_hashes.length > 0;
    if (!hasSourceRefs || !hasRootHashes) {
      return { ok: false, reason: 'validated_thought_missing_provenance: source_refs or root_source_hashes empty/missing' };
    }
    return { ok: true };
  } catch (_e) {
    return { ok: false, reason: 'validated_thought_missing_provenance: source_refs or root_source_hashes empty/missing' };
  }
}

function _buildContextSourceMix(packet_draft) {
  try {
    const mix = {
      raw_evidence: 0, phase_capsule: 0, validated_thought: 0,
      reusable_rule: 0, guardrail: 0, index_snippet: 0, vtp_packet: 0,
    };
    if (packet_draft) {
      if (Array.isArray(packet_draft.capsule_refs)) mix.phase_capsule = packet_draft.capsule_refs.length;
      if (Array.isArray(packet_draft.validated_thoughts)) mix.validated_thought = packet_draft.validated_thoughts.length;
      if (packet_draft.source_mix && typeof packet_draft.source_mix.raw_evidence === 'number') {
        mix.raw_evidence = packet_draft.source_mix.raw_evidence;
      } else if (packet_draft.source_mix && typeof packet_draft.source_mix.raw_file_fallback_count === 'number') {
        mix.raw_evidence = packet_draft.source_mix.raw_file_fallback_count;
      }
    }
    return Object.freeze(mix);
  } catch (_e) {
    return Object.freeze({
      raw_evidence: 0, phase_capsule: 0, validated_thought: 0,
      reusable_rule: 0, guardrail: 0, index_snippet: 0, vtp_packet: 0,
    });
  }
}

function _emitContextPacketComplaint(payload, opts) {
  try {
    const row = {
      envelope_version: ENVELOPE_VERSION,
      ts: _isoNow(),
      command: 'contextPacketComplaint',
      status: (payload && payload.status) || 'warn',
      reason_codes: (payload && payload.reason_codes) || [],
      reason: (payload && payload.reason) || null,
      details: (payload && payload.details) || {},
      evidence: (payload && payload.evidence) || [],
    };
    return _appendRow(_complaintsPath(opts || {}), row);
  } catch (_e) { return false; }
}

function _emitBroadRawFallbackComplaint(packet_draft, opts) {
  return _emitContextPacketComplaint({
    status: 'warn',
    reason: 'broad_raw_fallback',
    reason_codes: ['packet_capsule_unavailable_raw_fallback'],
    details: {
      packet_id: packet_draft && packet_draft.packet_id || null,
      role: packet_draft && packet_draft.role || null,
      raw_file_fallback_count: packet_draft && packet_draft.source_mix && packet_draft.source_mix.raw_file_fallback_count || 0,
      broad_raw_fallback_paths: packet_draft && packet_draft._broad_raw_paths || [],
    },
  }, opts);
}

// ----------------------------------------------------------------------------
// SCHEMA VALIDATION (manual)
// ----------------------------------------------------------------------------
function _assertPacketSchema(packet) {
  if (!packet || typeof packet !== 'object') throw new Error('packet_not_object');
  const required = ['envelope_version', 'ts', 'command', 'status', 'packet_id',
    'role', 'intent_ref', 'capsule_refs', 'registry_validation', 'budget_status',
    'bypass_refs', 'omitted_material', 'source_mix', 'packet_body',
    'body_token_estimate', 'metadata', 'validated_thoughts'];
  for (let i = 0; i < required.length; i++) {
    if (!(required[i] in packet)) throw new Error('packet_missing_field:' + required[i]);
  }
  if (packet.envelope_version !== ENVELOPE_VERSION) throw new Error('packet_bad_envelope_version');
  if (packet.command !== COMMAND_NAME) throw new Error('packet_bad_command');
  if (ROLE_MODES.indexOf(packet.role) === -1) throw new Error('packet_role_not_in_vocab:' + packet.role);
  if (!packet.metadata || !packet.metadata.context_source_mix) {
    throw new Error('packet_missing_context_source_mix');
  }
  for (let k = 0; k < CONTEXT_SOURCE_MIX_KEYS.length; k++) {
    if (!(CONTEXT_SOURCE_MIX_KEYS[k] in packet.metadata.context_source_mix)) {
      throw new Error('packet_source_mix_missing_key:' + CONTEXT_SOURCE_MIX_KEYS[k]);
    }
  }
  return null;
}

function _normalize(p) {
  if (!p || typeof p !== 'object') return null;
  const out = Object.assign({}, p);
  if (typeof out.envelope_version !== 'number') out.envelope_version = ENVELOPE_VERSION;
  if (typeof out.command !== 'string') out.command = COMMAND_NAME;
  if (typeof out.status !== 'string') out.status = 'ok';
  if (!Array.isArray(out.reason_codes)) out.reason_codes = [];
  if (!Array.isArray(out.capsule_refs)) out.capsule_refs = [];
  if (!Array.isArray(out.bypass_refs)) out.bypass_refs = [];
  if (!Array.isArray(out.omitted_material)) out.omitted_material = [];
  if (!Array.isArray(out.validated_thoughts)) out.validated_thoughts = [];
  if (!out.registry_validation) out.registry_validation = { valid: true, invalid_keys: [], checked_count: 0 };
  if (!out.budget_status) out.budget_status = { verdict: 'ok' };
  if (!out.source_mix) out.source_mix = { capsule_count: 0, registry_count: 0, raw_file_fallback_count: 0, bypass_count: 0 };
  if (typeof out.packet_body !== 'string') out.packet_body = '';
  if (typeof out.body_token_estimate !== 'number') out.body_token_estimate = 0;
  if (!out.metadata) out.metadata = {};
  if (!out.metadata.context_source_mix) out.metadata.context_source_mix = _buildContextSourceMix(out);
  if (typeof out.ts !== 'string') out.ts = _isoNow();
  return out;
}

// ----------------------------------------------------------------------------
// PUBLIC APIs (Lock 13: never throw upward)
// ----------------------------------------------------------------------------
function buildPacket(role, intent_ref, opts) {
  try {
    return _buildPacketInternal(role, intent_ref, opts || {});
  } catch (e) {
    try {
      _emitContextPacketComplaint({
        status: 'fail',
        reason_codes: ['packet_intent_map_missing'],
        details: { error: String(e && e.message || e) },
      }, opts || {});
    } catch (_e2) {}
    return { ok: false, reason: 'wave_1_stub_or_build_error', error: String(e && e.message || e) };
  }
}

function _buildPacketInternal(role, intent_ref, opts) {
  // Wave 1 stub: returns sentinel. Wave 3 replaces with full 8-step builder.
  if (!role || ROLE_MODES.indexOf(role) === -1) {
    return { ok: false, reason: 'invalid_role', reason_codes: ['packet_intent_map_missing'] };
  }
  if (!intent_ref || typeof intent_ref !== 'string') {
    return { ok: false, reason: 'packet_intent_map_missing', reason_codes: ['packet_intent_map_missing'] };
  }
  return { ok: false, reason: 'wave_1_stub' };
}

function readPacket(packet_id, opts) {
  try {
    if (!packet_id) return null;
    const rows = _readRows(_ledgerPath(opts || {}));
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i] && rows[i].packet_id === packet_id) return rows[i];
    }
    return null;
  } catch (_e) { return null; }
}

function listPackets(opts) {
  try { return _readRows(_ledgerPath(opts || {})); }
  catch (_e) { return []; }
}

function appendPacketLogRow(envelope, opts) {
  try {
    if (!envelope || typeof envelope !== 'object') return false;
    return _appendRow(_ledgerPath(opts || {}), envelope);
  } catch (_e) { return false; }
}

function validate(packet) {
  try { _assertPacketSchema(packet); return { valid: true, errors: [] }; }
  catch (e) { return { valid: false, errors: [String(e && e.message || e)] }; }
}

// ----------------------------------------------------------------------------
// SELF-TEST (Wave 1: 8 assertions)
// ----------------------------------------------------------------------------
function _runSelfTest() {
  let pass = 0, fail = 0;
  const fails = [];
  function assert(name, cond) { if (cond) pass++; else { fail++; fails.push(name); } }

  // 1. ROLE_MODES frozen 6 entries.
  assert('role_modes_frozen_6',
    Object.isFrozen(ROLE_MODES) && ROLE_MODES.length === 6 &&
    JSON.stringify(ROLE_MODES) === JSON.stringify(['researcher','planner','executor','verifier','reviewer','cockpit']));

  // 2. PACKET_REASON_CODES frozen 9 entries.
  assert('packet_reason_codes_9',
    Object.isFrozen(PACKET_REASON_CODES) && PACKET_REASON_CODES.length === 9);

  // 3. TIER_WEIGHT keys match REASON_VOCAB 1:1.
  let tw1to1 = (Object.keys(TIER_WEIGHT).length === REASON_VOCAB.length);
  for (let i = 0; tw1to1 && i < REASON_VOCAB.length; i++) {
    if (!(REASON_VOCAB[i] in TIER_WEIGHT)) tw1to1 = false;
  }
  assert('tier_weight_1to1_reason_vocab', tw1to1);

  // 4. PACKET.schema.json parses.
  let schemaOk = false;
  try { schemaOk = !!JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')); } catch (_e) {}
  assert('packet_schema_parses', schemaOk);

  // 5. Phase 41-44 imports round-trip.
  assert('phase_41_42_43_44_imports',
    (_phase41 === null || typeof _phase41.summarize === 'function') &&
    (_phase42 === null || _phase42.BUDGETS && typeof _phase42.BUDGETS === 'object') &&
    (_phase43 === null || typeof _phase43.readCapsule === 'function') &&
    (_phase44 === null || typeof _phase44.validateReferences === 'function'));

  // 6. Stub buildPacket never throws on null/undefined/'' / {} / valid role.
  let stubOk = true;
  try {
    buildPacket(null, null, {});
    buildPacket(undefined, undefined, {});
    buildPacket('researcher', '', {});
    buildPacket('researcher', 'fake', { planningDir: os.tmpdir() });
    buildPacket('cockpit', 'fake', { planningDir: os.tmpdir() });
  } catch (_e) { stubOk = false; }
  assert('stub_never_throws', stubOk);

  // 7. ASCII-only on this source file + schema.
  let asciiOk = true;
  try {
    const buf = fs.readFileSync(__filename);
    for (let i = 0; i < buf.length; i++) if (buf[i] > 127) { asciiOk = false; break; }
    if (asciiOk) {
      const sbuf = fs.readFileSync(SCHEMA_PATH);
      for (let i = 0; i < sbuf.length; i++) if (sbuf[i] > 127) { asciiOk = false; break; }
    }
  } catch (_e) { asciiOk = false; }
  assert('ascii_only_source', asciiOk);

  // 8. COMPRESSION_LEVELS frozen 5; PACKET_BUDGETS cockpit:30k.
  assert('compression_levels_and_budgets',
    Object.isFrozen(COMPRESSION_LEVELS) && COMPRESSION_LEVELS.length === 5 &&
    PACKET_BUDGETS && PACKET_BUDGETS.cockpit && PACKET_BUDGETS.cockpit.warn_input === 30000);

  console.log('context-packet self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fails.length) console.error('FAILED: ' + fails.join(', '));
  return fail === 0 ? 0 : 1;
}

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.indexOf('--self-test') !== -1) {
    process.exit(_runSelfTest());
  } else if (args.indexOf('--help') !== -1 || args.length === 0) {
    console.log('Usage: node build.cjs --self-test');
    console.log('       node build.cjs --help');
    process.exit(0);
  } else {
    console.error('Unknown invocation. Use --self-test or --help.');
    process.exit(2);
  }
}

// ----------------------------------------------------------------------------
// EXPORTS
// ----------------------------------------------------------------------------
module.exports = {
  // Public APIs
  buildPacket,
  readPacket,
  listPackets,
  appendPacketLogRow,
  validate,
  // Frozen consts
  ROLE_MODES,
  REASON_VOCAB,
  TIER_WEIGHT,
  PACKET_REASON_CODES,
  COMPRESSION_LEVELS,
  CONTEXT_SOURCE_MIX_KEYS,
  PACKET_BUDGETS,
  INTENT_MAP_REASON_CODES,
  ENVELOPE_VERSION,
  COMMAND_NAME,
  // Internals (for cross-module reuse + Wave-3 expansion)
  _normalize,
  _assertPacketSchema,
  _packetIdHash,
  _estimateTokens,
  _readRows,
  _safeReadFile,
  _safeReadFileBuffer,
  _safeReadJson,
  _emitContextPacketComplaint,
  _emitBroadRawFallbackComplaint,
  _assertValidatedThoughtProvenance,
  _buildContextSourceMix,
  _runSelfTest,
};
