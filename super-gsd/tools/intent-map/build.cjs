// ============================================================================
// SGSD - INTENT-MAP compiler (Phase 45 -- PACKET-00 + PACKET-07 + PACKET-09)
// ============================================================================
// Compiles one operator turn (raw English) into a 10-field structured Intent
// English record per RESEARCH 4.1. Lock 10 binding: operator command MUST flow
// through this compiler BEFORE context packet construction.
//
// Lock 11 binding: REASON_VOCAB closed 13-entry enum; semantic-similarity-only
// candidates surface in ambiguities[] not relationships[].
//
// Lock 12 binding: source-file body text NEVER populates RAW/INTENT/MEANING/
// CANONICAL/ASSUMPTIONS fields. Operator-intent fields read ONLY from operator
// turn + structured prior decisions.
//
// Lock 13 binding: every public API wraps internals in try/catch and NEVER
// throws upward. CLI exits 0 on degraded; only bad-invocation exits 2.
//
// Wave-1 deliverable: frozen-const stubs + module.exports skeleton. Public APIs
// return {ok:false, reason:'wave_1_stub'} sentinel until Wave 2 lands.
//
// No external deps. Manual JSON validation per Phase 43 _assertCapsuleSchema.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// ----------------------------------------------------------------------------
// PHASE 41/42/43/44 UPSTREAM IMPORTS BY REFERENCE (Lock 13: defensive)
// ----------------------------------------------------------------------------
let _phase41 = null;
let _phase42 = null;
let _phase43 = null;
let _phase44 = null;

try { _phase41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs')); } catch (_e) { _phase41 = null; }
try { _phase42 = require(path.join(__dirname, '..', 'token-waste', 'check.cjs')); } catch (_e) { _phase42 = null; }
try { _phase43 = require(path.join(__dirname, '..', 'phase-capsule', 'write.cjs')); } catch (_e) { _phase43 = null; }
try { _phase44 = require(path.join(__dirname, '..', 'context-registry', 'check.cjs')); } catch (_e) { _phase44 = null; }

// ----------------------------------------------------------------------------
// FROZEN CONSTANTS (RESEARCH 4.2 + 12.0)
// ----------------------------------------------------------------------------

const ENVELOPE_VERSION = 1;
const COMMAND_NAME = 'compileIntentMap';

// 13-entry closed REASON_VOCAB per RESEARCH 12.0 (Tier 1 through Tier 5).
// LOCK 11 binding: 'semantic_similarity_only' is BANNED from this list.
const REASON_VOCAB = Object.freeze([
  'current_active_phase',                  // Tier 1
  'current_milestone_goal',                // Tier 1
  'explicit_artifact_mention',             // Tier 1
  'repeated_operator_complaint',           // Tier 1
  'same_failure_pattern',                  // Tier 2
  'phase_dependency_edge',                 // Tier 2
  'phase_close_pattern_recurrence',        // Tier 2
  'shared_gate_or_provider',               // Tier 3
  'recent_phase_same_milestone',           // Tier 3
  'audit_evidence_cite',                   // Tier 4
  'codex_finding_cite',                    // Tier 4
  'vtp_evidence_cite',                     // Tier 4
  'archived_milestone_explicit_reference', // Tier 5
]);

// TIER_WEIGHT keys MUST match REASON_VOCAB 1:1 (13 keys).
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

// 8-entry intent-map reason codes (RESEARCH 10.1).
const INTENT_MAP_REASON_CODES = Object.freeze([
  'intent_compiled_clean',
  'intent_ambiguity_blocking',
  'intent_ambiguity_proceed',
  'intent_prompt_injection_filtered',
  'intent_relationship_semantic_only_demoted',
  'intent_clarify_resolved_by_prior_context',
  'intent_speech_fields_included',
  'intent_compile_fallback_used',
]);

// 4-entry assumption source kinds (PACKET-07).
const ASSUMPTION_SOURCE_KINDS = Object.freeze([
  'operator_phrasing',
  'prior_decision',
  'phase_default',
  'role_default',
]);

// 11-entry relationship target kinds (PACKET-08).
const RELATIONSHIP_TARGET_KINDS = Object.freeze([
  'phase',
  'gate',
  'agent',
  'artifact',
  'provider',
  'decision',
  'complaint',
  'codex_finding',
  'vtp_evidence',
  'operator_feedback',
  'capsule',
]);

// 8-entry context_policy.include vocabulary.
const CONTEXT_POLICY_INCLUDE = Object.freeze([
  'capsules',
  'registry',
  'active_debt',
  'bypass_refs',
  'intent_history',
  'phase_index',
  'token_spend_summary',
  'budget_status',
]);

// 5-entry context_policy.exclude vocabulary.
const CONTEXT_POLICY_EXCLUDE = Object.freeze([
  'archived_milestones',
  'unrelated_phase_folders',
  'transcripts_full',
  'roadmap_archive',
  'superseded_decisions',
]);

// 5-entry context_policy.compress vocabulary.
const CONTEXT_POLICY_COMPRESS = Object.freeze([
  'roadmap_prose',
  'requirements_prose',
  'mass_discuss_prose',
  'old_research_md',
  'old_plan_md',
]);

// 8-entry context_policy.preserve_raw vocabulary (LOCK 6 binding).
const CONTEXT_POLICY_PRESERVE_RAW = Object.freeze([
  'critical_bypass',
  'security_finding',
  'stack_trace',
  'failed_test',
  'destructive_op_warning',
  'verifier_fail',
  'edge_guard_miss',
  'provider_outage',
]);

// 6-entry action kinds.
const ACTION_KINDS = Object.freeze([
  'dispatch_role',
  'route_provider',
  'human_clarify',
  'no_op',
  'meta_self',
  'index_query',
]);

// 10-entry action reasons.
const ACTION_REASONS = Object.freeze([
  'phase_default_dispatch',
  'route_to_codex',
  'route_to_local_script',
  'route_to_vtp',
  'ambiguity_blocking',
  'ambiguity_proceed_with_assumption',
  'capsule_satisfies_request',
  'no_change_needed',
  'phase_45_self_request',
  'phase_46_index_query',
]);

// 4-entry tone vocabulary (PACKET-10).
const TONE_VOCAB = Object.freeze([
  'neutral',
  'urgent',
  'pedagogical',
  'celebratory',
]);

// ROLE_MODES re-exported for cross-module convenience.
const ROLE_MODES = Object.freeze([
  'researcher', 'planner', 'executor', 'verifier', 'reviewer', 'cockpit',
]);

// ----------------------------------------------------------------------------
// PATHS
// ----------------------------------------------------------------------------
const SCHEMA_PATH = path.join(__dirname, 'intent-map.schema.json');
const REL_LEDGER = path.join('metrics', 'intent-map.jsonl');
const REL_CACHE = path.join('cache', 'intent-map');
const REL_COMPLAINTS = path.join('metrics', 'context-complaints.jsonl');

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------
function _safeReadFile(p) {
  try {
    if (!p || !fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf8');
  } catch (_e) { return null; }
}

function _safeReadJson(p) {
  try {
    const s = _safeReadFile(p);
    if (!s) return null;
    return JSON.parse(s);
  } catch (_e) { return null; }
}

function _ensureDir(p) {
  try { fs.mkdirSync(p, { recursive: true }); return true; } catch (_e) { return false; }
}

function _isoNow() { return new Date().toISOString(); }

function _intentIdHash(rawOperatorPhrase, ts) {
  try {
    const tsWindow = Math.floor(new Date(ts || _isoNow()).getTime() / 60000) * 60000;
    return crypto.createHash('sha256')
      .update(String(rawOperatorPhrase || '') + ':' + String(tsWindow))
      .digest('hex')
      .slice(0, 16);
  } catch (_e) {
    return '0000000000000000';
  }
}

function _planningDir(opts) {
  if (opts && opts.planningDir) return opts.planningDir;
  return path.join(process.cwd(), '.planning');
}

function _ledgerPath(opts) { return path.join(_planningDir(opts), REL_LEDGER); }
function _cacheDir(opts)   { return path.join(_planningDir(opts), REL_CACHE); }
function _complaintsPath(opts) { return path.join(_planningDir(opts), REL_COMPLAINTS); }

// Defensive line-by-line ledger reader (Phase 41 _readRows mirror).
function _readRows(p) {
  const out = [];
  const txt = _safeReadFile(p);
  if (!txt) return out;
  const lines = txt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l) continue;
    try {
      const r = JSON.parse(l);
      if (r && typeof r === 'object') out.push(r);
    } catch (_e) { /* skip malformed */ }
  }
  return out;
}

function _appendRow(p, row) {
  try {
    _ensureDir(path.dirname(p));
    fs.appendFileSync(p, JSON.stringify(row) + '\n', 'utf8');
    return true;
  } catch (_e) { return false; }
}

function _atomicWriteJson(p, obj) {
  try {
    _ensureDir(path.dirname(p));
    const tmp = p + '.tmp.' + process.pid + '.' + Date.now();
    fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
    fs.renameSync(tmp, p);
    return true;
  } catch (_e) { return false; }
}

// ----------------------------------------------------------------------------
// SCHEMA VALIDATION (manual, no ajv)
// ----------------------------------------------------------------------------
function _assertIntentMapSchema(intent_map) {
  // Returns null if valid; throws Error on closed-enum violation.
  if (!intent_map || typeof intent_map !== 'object') {
    throw new Error('intent_map_not_object');
  }
  const required = ['envelope_version', 'ts', 'command', 'status', 'intent_id', 'raw',
    'intent', 'meaning', 'assumptions', 'ambiguities', 'clarify', 'canonical',
    'relationships', 'context_policy', 'action'];
  for (let i = 0; i < required.length; i++) {
    if (!(required[i] in intent_map)) {
      throw new Error('intent_map_missing_field:' + required[i]);
    }
  }
  if (intent_map.envelope_version !== ENVELOPE_VERSION) {
    throw new Error('intent_map_bad_envelope_version');
  }
  if (intent_map.command !== COMMAND_NAME) {
    throw new Error('intent_map_bad_command');
  }
  if (!Array.isArray(intent_map.assumptions)) throw new Error('assumptions_not_array');
  if (!Array.isArray(intent_map.ambiguities)) throw new Error('ambiguities_not_array');
  if (!Array.isArray(intent_map.relationships)) throw new Error('relationships_not_array');
  // Closed-enum check on relationships[].reason (LOCK 11 binding).
  for (let i = 0; i < intent_map.relationships.length; i++) {
    const r = intent_map.relationships[i];
    if (!r || REASON_VOCAB.indexOf(r.reason) === -1) {
      throw new Error('relationship_reason_not_in_vocab:' + (r && r.reason));
    }
  }
  if (!intent_map.action || ACTION_KINDS.indexOf(intent_map.action.kind) === -1) {
    throw new Error('action_kind_not_in_vocab');
  }
  if (ACTION_REASONS.indexOf(intent_map.action.reason) === -1) {
    throw new Error('action_reason_not_in_vocab');
  }
  return null;
}

function _normalize(im) {
  if (!im || typeof im !== 'object') return null;
  const out = Object.assign({}, im);
  if (typeof out.envelope_version !== 'number') out.envelope_version = ENVELOPE_VERSION;
  if (typeof out.command !== 'string') out.command = COMMAND_NAME;
  if (typeof out.status !== 'string') out.status = 'ok';
  if (!Array.isArray(out.reason_codes)) out.reason_codes = [];
  if (typeof out.raw !== 'string') out.raw = String(out.raw || '');
  if (typeof out.intent !== 'string') out.intent = '';
  if (typeof out.meaning !== 'string') out.meaning = '';
  if (typeof out.canonical !== 'string') out.canonical = '';
  if (!Array.isArray(out.assumptions)) out.assumptions = [];
  if (!Array.isArray(out.ambiguities)) out.ambiguities = [];
  if (!Array.isArray(out.relationships)) out.relationships = [];
  if (out.clarify === undefined) out.clarify = null;
  if (!out.context_policy || typeof out.context_policy !== 'object') {
    out.context_policy = { include: [], exclude: [], compress: [], preserve_raw: [] };
  }
  if (!out.action || typeof out.action !== 'object') {
    out.action = { kind: 'no_op', reason: 'no_change_needed' };
  }
  if (typeof out.intent_id !== 'string' || !/^[0-9a-f]{16}$/.test(out.intent_id)) {
    out.intent_id = _intentIdHash(out.raw, out.ts);
  }
  if (typeof out.ts !== 'string') out.ts = _isoNow();
  return out;
}

// ----------------------------------------------------------------------------
// PUBLIC APIs (Lock 13: never throw upward; return falsey sentinel on error)
// ----------------------------------------------------------------------------
function compileIntentMap(rawOperatorPhrase, opts) {
  try {
    return _compileIntentMapInternal(rawOperatorPhrase, opts || {});
  } catch (e) {
    try {
      _emitIntentMapComplaint({
        reason_codes: ['intent_compile_fallback_used'],
        details: { error: String(e && e.message || e) },
      }, opts || {});
    } catch (_e2) { /* never throw */ }
    return { ok: false, reason: 'wave_1_stub_or_compile_error', error: String(e && e.message || e) };
  }
}

// Wave-1 stub: returns minimal valid intent_map sentinel; full implementation in Wave 2.
function _compileIntentMapInternal(rawOperatorPhrase, opts) {
  // Wave 1 is a stub. Sentinel pattern returns false-ish so callers know to
  // fall back. Wave 2 replaces this entirely.
  return { ok: false, reason: 'wave_1_stub' };
}

function readIntentMap(intent_id, opts) {
  try {
    if (!intent_id || typeof intent_id !== 'string') return null;
    const cacheFile = path.join(_cacheDir(opts || {}), intent_id + '.json');
    return _safeReadJson(cacheFile);
  } catch (_e) { return null; }
}

function listIntentMaps(opts) {
  try { return _readRows(_ledgerPath(opts || {})); }
  catch (_e) { return []; }
}

function appendIntentMapRow(envelope, opts) {
  try {
    if (!envelope || typeof envelope !== 'object') return false;
    return _appendRow(_ledgerPath(opts || {}), envelope);
  } catch (_e) { return false; }
}

function validate(intent_map) {
  try {
    _assertIntentMapSchema(intent_map);
    return { valid: true, errors: [] };
  } catch (e) {
    return { valid: false, errors: [String(e && e.message || e)] };
  }
}

function _emitIntentMapComplaint(payload, opts) {
  try {
    const row = {
      envelope_version: ENVELOPE_VERSION,
      ts: _isoNow(),
      command: 'intentMapComplaint',
      status: 'warn',
      reason_codes: payload && payload.reason_codes || [],
      details: payload && payload.details || {},
      evidence: payload && payload.evidence || [],
    };
    return _appendRow(_complaintsPath(opts || {}), row);
  } catch (_e) { return false; }
}

// ----------------------------------------------------------------------------
// SELF-TEST (Wave 1: 8 assertions)
// ----------------------------------------------------------------------------
function _runSelfTest() {
  let pass = 0, fail = 0;
  const fails = [];
  function assert(name, cond) {
    if (cond) { pass++; }
    else { fail++; fails.push(name); }
  }

  // 1. REASON_VOCAB frozen 13 entries; no 'semantic_similarity_only'.
  assert('reason_vocab_frozen_13',
    Object.isFrozen(REASON_VOCAB) && REASON_VOCAB.length === 13 &&
    REASON_VOCAB.indexOf('semantic_similarity_only') === -1);

  // 2. INTENT_MAP_REASON_CODES frozen 8 entries.
  assert('intent_map_reason_codes_8',
    Object.isFrozen(INTENT_MAP_REASON_CODES) && INTENT_MAP_REASON_CODES.length === 8);

  // 3. ASSUMPTION_SOURCE_KINDS frozen 4; RELATIONSHIP_TARGET_KINDS 11.
  assert('assumption_relationship_kinds',
    Object.isFrozen(ASSUMPTION_SOURCE_KINDS) && ASSUMPTION_SOURCE_KINDS.length === 4 &&
    Object.isFrozen(RELATIONSHIP_TARGET_KINDS) && RELATIONSHIP_TARGET_KINDS.length === 11);

  // 4. ACTION + TONE vocabularies and CONTEXT_POLICY_PRESERVE_RAW with critical_bypass.
  assert('action_tone_preserve_raw',
    Object.isFrozen(ACTION_KINDS) && ACTION_KINDS.length === 6 &&
    Object.isFrozen(ACTION_REASONS) && ACTION_REASONS.length === 10 &&
    Object.isFrozen(TONE_VOCAB) && TONE_VOCAB.length === 4 &&
    Object.isFrozen(CONTEXT_POLICY_PRESERVE_RAW) &&
    CONTEXT_POLICY_PRESERVE_RAW.length === 8 &&
    CONTEXT_POLICY_PRESERVE_RAW.indexOf('critical_bypass') !== -1);

  // 5. Schema file exists and parses as valid JSON.
  let schemaParsed = false;
  try { schemaParsed = !!JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')); } catch (_e) {}
  assert('schema_file_parses', schemaParsed);

  // 6. Phase 41-44 imports round-trip (or graceful fallback).
  assert('phase_41_42_43_44_imports',
    (_phase41 === null || typeof _phase41.summarize === 'function') &&
    (_phase42 === null || _phase42.BUDGETS && typeof _phase42.BUDGETS === 'object') &&
    (_phase43 === null || typeof _phase43.readCapsule === 'function') &&
    (_phase44 === null || typeof _phase44.validateReferences === 'function'));

  // 7. Stub public API returns sentinel never throws.
  let stubOk = true;
  try {
    const r1 = compileIntentMap(null, {});
    const r2 = compileIntentMap('', {});
    const r3 = compileIntentMap('test', { planningDir: os.tmpdir() });
    if (r1 === undefined || r2 === undefined || r3 === undefined) stubOk = false;
  } catch (_e) { stubOk = false; }
  assert('stub_never_throws', stubOk);

  // 8. ASCII-only on this source file.
  let asciiOk = true;
  try {
    const buf = fs.readFileSync(__filename);
    for (let i = 0; i < buf.length; i++) { if (buf[i] > 127) { asciiOk = false; break; } }
  } catch (_e) { asciiOk = false; }
  assert('ascii_only_source', asciiOk);

  console.log('intent-map self-test: ' + pass + ' pass, ' + fail + ' fail');
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
    process.exit(args.length === 0 ? 0 : 0);
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
  compileIntentMap,
  readIntentMap,
  listIntentMaps,
  appendIntentMapRow,
  validate,
  // Frozen consts
  REASON_VOCAB,
  TIER_WEIGHT,
  INTENT_MAP_REASON_CODES,
  ASSUMPTION_SOURCE_KINDS,
  RELATIONSHIP_TARGET_KINDS,
  CONTEXT_POLICY_INCLUDE,
  CONTEXT_POLICY_EXCLUDE,
  CONTEXT_POLICY_COMPRESS,
  CONTEXT_POLICY_PRESERVE_RAW,
  ACTION_KINDS,
  ACTION_REASONS,
  TONE_VOCAB,
  ROLE_MODES,
  ENVELOPE_VERSION,
  COMMAND_NAME,
  // Internals (for cross-module reuse + Wave-2/3 expansion)
  _normalize,
  _assertIntentMapSchema,
  _intentIdHash,
  _readRows,
  _safeReadFile,
  _safeReadJson,
  _emitIntentMapComplaint,
  _runSelfTest,
};
