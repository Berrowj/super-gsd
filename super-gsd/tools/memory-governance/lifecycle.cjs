// ----------------------------------------------------------------------------
// Phase 49 Memory Governance Lifecycle (GOV-01..08; LOCK 2/6/11/13)
//
// Single deterministic kernel that governs every durable memory write in
// SGSD. Six public APIs (admitMemoryWrite, promote, demote, revoke,
// revalidate, processComplaints) plus the Phase 45 step-6 wire
// (loadIndexSnippets), the one-shot lifecycle migration
// (backfillLifecycleFields), and the Phase 50 forward-contract helper
// (getMemoryGovernanceSnapshot).
//
// Every public API is wrapped in try/catch and returns a sentinel on
// internal error (Lock 13 binding from REQUIREMENTS.md:67-68). On internal
// error the wrapper appends a row to .planning/metrics/context-complaints.jsonl
// (envelope-v1) so the orchestrator can surface the failure on the next
// processComplaints sweep without halting phase advance.
//
// Promotion thresholds are STRUCTURAL ONLY (Lock 11). No
// embedding/cosine/fuzzy similarity. Counted evidence rows + counted
// distinct citing phases + closed-enum confidence vocab.
//
// Revocation is tombstone-only (Lock 2). PHASE-CAPSULE.json files are
// never hard-deleted; revoked_at + revoked_reason are written as additive
// edits. The .planning JSONL canonical streams + git remain the single
// source of truth.
//
// ASCII-only on this file (no smart quotes, em-dashes, or Unicode arrows).
// ----------------------------------------------------------------------------

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ----------------------------------------------------------------------------
// PHASE 41-48 IMPORTS BY REFERENCE (lazy require where needed; circular-dep
// safe via module.exports partial-population semantics).
// ----------------------------------------------------------------------------

let _phase43 = null;
function _getPhase43() {
  if (_phase43) return _phase43;
  try { _phase43 = require('../phase-capsule/write.cjs'); } catch (_e) { _phase43 = null; }
  return _phase43;
}

let _phase44 = null;
function _getPhase44() {
  if (_phase44) return _phase44;
  try { _phase44 = require('../context-registry/check.cjs'); } catch (_e) { _phase44 = null; }
  return _phase44;
}

let _phase45 = null;
function _getPhase45() {
  if (_phase45) return _phase45;
  try { _phase45 = require('../context-packet/build.cjs'); } catch (_e) { _phase45 = null; }
  return _phase45;
}

let _phase46 = null;
function _getPhase46() {
  if (_phase46) return _phase46;
  try { _phase46 = require('../context-cache/query.cjs'); } catch (_e) { _phase46 = null; }
  return _phase46;
}

// Test-only injection point for phase46.query (see F14 fixture).
let _phase46QueryShim = null;
function _injectPhase46QueryShim(fn) { _phase46QueryShim = (typeof fn === 'function') ? fn : null; }

// ----------------------------------------------------------------------------
// FROZEN CLOSED ENUMS (Object.freeze; mutation no-op)
// ----------------------------------------------------------------------------

// COMPRESSION_LEVELS imported BY REFERENCE from Phase 45 build.cjs:104.
// Falls back to local copy if Phase 45 unavailable (e.g. during isolated
// self-test). The fallback list MUST stay in sync with Phase 45.
function _resolveCompressionLevels() {
  const p45 = _getPhase45();
  if (p45 && Array.isArray(p45.COMPRESSION_LEVELS) && p45.COMPRESSION_LEVELS.length === 5) {
    return p45.COMPRESSION_LEVELS;
  }
  return Object.freeze([
    'raw_evidence',
    'phase_capsule',
    'validated_thought',
    'reusable_rule',
    'guardrail',
  ]);
}

const COMPRESSION_LEVELS = _resolveCompressionLevels();

const PROMOTION_REASONS = Object.freeze([
  'evidence_threshold_met',
  'reuse_threshold_met',
  'manual_promote_with_provenance',
]);

const DEMOTION_REASONS = Object.freeze([
  'abstraction_failed',
  'source_drifted',
  'complaint_threshold_exceeded',
  'superseded_by_new_evidence',
]);

const REVOKE_REASONS = Object.freeze([
  'stale',
  'poisoned',
  'contradicted',
  'source_lost',
  'superseded_by_revoked_chain',
]);

const CONFIDENCE_VOCAB = Object.freeze(['low', 'medium', 'high']);

// 10-entry per Open Q1: 9 base codes + memory_admission_source_revoked.
const ADMISSION_REJECT_CODES = Object.freeze([
  'memory_admission_artifact_missing',
  'memory_admission_provenance_missing',
  'memory_admission_confidence_invalid',
  'memory_admission_consumers_missing',
  'memory_admission_revocation_path_missing',
  'memory_admission_compression_level_invalid',
  'memory_admission_bypass_refs_block_promotion',
  'memory_admission_debt_blocks_promotion',
  'memory_admission_internal_error',
  'memory_admission_source_revoked',
]);

const REVALIDATION_KINDS = Object.freeze([
  'source_hash_drift',
  'source_file_missing',
]);

const COMMAND_NAMES = Object.freeze({
  admit:       'memoryAdmit',
  promote:     'memoryPromote',
  demote:      'memoryDemote',
  revoke:      'memoryRevoke',
  revalidate:  'memoryRevalidate',
  process:     'memoryProcessComplaints',
  backfill:    'memoryBackfill',
});

const ENVELOPE_VERSION = 1;
const MAX_REPAIRS_PER_INVOCATION = 50;
const REPLACED_BY_CHAIN_DEPTH_CAP = 5;
const ROW_BYTE_BUDGET = 4000;

// LIFECYCLE_FIELD_KEYS: 10 lifecycle-field names that the backfill walker
// populates and Phase 43 schema validates.
const LIFECYCLE_FIELD_KEYS = Object.freeze([
  'compression_level',
  'promoted_at',
  'demoted_at',
  'revoked_at',
  'revoked_reason',
  'allowed_consumers',
  'revalidation_due',
  'supersedes_id',
  'superseded_by_id',
  'revocation_path',
]);

// ----------------------------------------------------------------------------
// PATH RESOLVERS (mirror Phase 45 _planningDir at build.cjs:154)
// ----------------------------------------------------------------------------

function _planningDir(opts) {
  if (opts && typeof opts.planningDir === 'string' && opts.planningDir.length > 0) {
    return opts.planningDir;
  }
  return path.resolve(process.cwd(), '.planning');
}

function _metricsPath(planningDir, name) {
  return path.join(planningDir, 'metrics', name);
}

function _cacheDir(planningDir, name) {
  return path.join(planningDir, 'cache', name);
}

const _metricFiles = {
  promotions:    'memory-promotions.jsonl',
  demotions:     'memory-demotions.jsonl',
  revocations:   'memory-revocations.jsonl',
  revalidations: 'memory-revalidations.jsonl',
  cursor:        'memory-process-cursor.json',
  repairQueue:   'repair-queue.jsonl',
  complaints:    'context-complaints.jsonl',
};

// ----------------------------------------------------------------------------
// HELPERS (private; never throw upward)
// ----------------------------------------------------------------------------

function _isoNow() {
  return new Date().toISOString();
}

function _isIsoTs(s) {
  return typeof s === 'string' && /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/.test(s);
}

function _ensureDir(p) {
  try { if (p && !fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); } catch (_e) { /* ignore */ }
}

function _safeReadFile(p) {
  try { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; } catch (_e) { return null; }
}

function _safeReadJson(p) {
  try {
    const raw = _safeReadFile(p);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch (_e) { return null; }
}

function _sha256OfBuffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// ASCII-only assertion (Pitfall: Phase 49 self-bytes guard mirrors Phase 48).
// Allowed: 0x09 (tab), 0x0A (LF), 0x0D (CR), 0x20-0x7E (printable ASCII).
function _assertAsciiOnly(buf) {
  if (!buf || typeof buf.length !== 'number') return;
  for (let i = 0; i < buf.length; i++) {
    const b = (typeof buf === 'string') ? buf.charCodeAt(i) : buf[i];
    if (b === 0x09 || b === 0x0A || b === 0x0D) continue;
    if (b < 0x20 || b > 0x7E) {
      throw new Error('non-ascii byte 0x' + b.toString(16) + ' at offset ' + i);
    }
  }
}

// JSON serializer that escapes any code-point > 127 as \uXXXX (mirror Phase 43
// _jsonStringifyAscii). Keeps emitted JSONL ASCII-clean. Optional indent
// argument matches Phase 43's _jsonStringifyAscii signature so PHASE-CAPSULE.json
// edits preserve the 2-space pretty-printed format on disk (lifecycle-only edits
// must NOT collapse the canonical Phase 43 capsule layout).
function _jsonStringifyAscii(value, indent) {
  const raw = (indent != null) ? JSON.stringify(value, null, indent) : JSON.stringify(value);
  if (raw == null) return raw;
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code > 127) {
      out += '\\u' + ('0000' + code.toString(16)).slice(-4);
    } else {
      out += raw.charAt(i);
    }
  }
  return out;
}

// _writeAtomicJSON: tmp+rename atomic write (mirror Phase 43 _writeCapsuleInternal).
function _writeAtomicJSON(filePath, obj) {
  try {
    const dir = path.dirname(filePath);
    _ensureDir(dir);
    const tmp = filePath + '.tmp.' + process.pid + '.' + crypto.randomBytes(2).toString('hex');
    const json = _jsonStringifyAscii(obj) + '\n';
    fs.writeFileSync(tmp, json, { encoding: 'utf8' });
    fs.renameSync(tmp, filePath);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'atomic_write_failed: ' + (e && e.message) };
  }
}

// _truncateRowDetails: keep the JSON.stringify length below ROW_BYTE_BUDGET
// (Pitfall 4). Truncates row.details if oversized.
function _truncateRowDetails(row) {
  try {
    const serialized = JSON.stringify(row);
    if (!serialized || serialized.length <= ROW_BYTE_BUDGET) return row;
    const trimmed = Object.assign({}, row);
    trimmed.details = { _truncated: true, _original_byte_estimate: serialized.length };
    return trimmed;
  } catch (_e) {
    return { envelope_version: ENVELOPE_VERSION, ts: _isoNow(), command: row && row.command, status: 'warn',
             reason_codes: ['row_truncate_internal_error'], details: {} };
  }
}

// _appendLedgerRow: POSIX append envelope-v1 row to a JSONL stream.
function _appendLedgerRow(filePath, row) {
  try {
    if (!row || typeof row !== 'object') return { ok: false, reason: 'row_invalid' };
    const enriched = Object.assign({}, row);
    if (enriched.envelope_version == null) enriched.envelope_version = ENVELOPE_VERSION;
    if (!enriched.ts) enriched.ts = _isoNow();
    const final = _truncateRowDetails(enriched);
    const dir = path.dirname(filePath);
    _ensureDir(dir);
    fs.appendFileSync(filePath, _jsonStringifyAscii(final) + '\n', 'utf8');
    return { ok: true, row: final };
  } catch (e) {
    return { ok: false, reason: 'append_failed: ' + (e && e.message) };
  }
}

function _emitInternalErrorComplaint(api_name, err, planningDir) {
  try {
    const cmpPath = _metricsPath(planningDir, _metricFiles.complaints);
    _appendLedgerRow(cmpPath, {
      envelope_version: ENVELOPE_VERSION,
      ts: _isoNow(),
      command: 'memoryGovernanceComplaint',
      status: 'fail',
      reason_codes: [api_name + '_internal_error'],
      details: { api: api_name, message: err && err.message ? String(err.message).slice(0, 500) : 'unknown' },
    });
  } catch (_e) { /* swallow -- Lock 13 sentinel last-line */ }
}

function _readJsonlSince(filePath, sinceTs, maxRows) {
  const out = [];
  try {
    if (!fs.existsSync(filePath)) return out;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw) return out;
    const lines = raw.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      let obj = null;
      try { obj = JSON.parse(line); } catch (_e) { continue; }
      if (!obj || typeof obj !== 'object') continue;
      if (sinceTs && obj.ts && String(obj.ts) <= String(sinceTs)) continue;
      out.push(obj);
      if (maxRows && out.length >= maxRows) break;
    }
  } catch (_e) { /* swallow -- return whatever we have */ }
  return out;
}

// _resolveCapsule: parse artifact_id 'milestone/phase#hash[0:8]' and read
// the underlying capsule via Phase 43 readCapsule.
function _resolveCapsule(artifact_id, planningDir) {
  try {
    if (!artifact_id || typeof artifact_id !== 'string') return null;
    const m = /^([^/]+)\/([^#]+)(?:#.*)?$/.exec(artifact_id);
    if (!m) return null;
    const milestone = m[1];
    const phase = m[2];
    const p43 = _getPhase43();
    if (!p43 || typeof p43.readCapsule !== 'function') return null;
    const cap = p43.readCapsule(planningDir, milestone, phase);
    if (!cap) return null;
    return { capsule: cap, milestone: milestone, phase: phase };
  } catch (_e) { return null; }
}

function _capsulePath(planningDir, milestone, phase) {
  const p43 = _getPhase43();
  if (p43 && typeof p43.capsulePath === 'function') {
    try { return p43.capsulePath(planningDir, milestone, phase); } catch (_e) { /* fallthrough */ }
  }
  // Fallback: walk milestones/<m>/phases/* for matching prefix.
  try {
    const phasesDir = path.join(planningDir, 'milestones', milestone, 'phases');
    if (!fs.existsSync(phasesDir)) return '';
    const entries = fs.readdirSync(phasesDir);
    for (const e of entries) {
      const mm = /^(\d+(?:\.\d+)?)-/.exec(e);
      if (mm && mm[1] === String(phase)) {
        return path.join(phasesDir, e, 'PHASE-CAPSULE.json');
      }
    }
  } catch (_e) { /* ignore */ }
  return '';
}

// _capsuleArtifactId: build deterministic artifact_id for a capsule.
function _capsuleArtifactId(capsule) {
  try {
    if (!capsule || typeof capsule !== 'object') return '';
    const ms = String(capsule.milestone || '');
    const ph = String(capsule.phase || '');
    let hashSlice = '';
    const p43 = _getPhase43();
    if (p43 && typeof p43._capsuleContentHash === 'function') {
      try { hashSlice = String(p43._capsuleContentHash(capsule) || '').slice(0, 8); } catch (_e) { hashSlice = ''; }
    }
    if (!hashSlice) {
      try {
        const canonical = JSON.stringify({ m: ms, p: ph, c: capsule.created_at || '', g: capsule.goal || '' });
        hashSlice = _sha256OfBuffer(Buffer.from(canonical, 'utf8')).slice(0, 8);
      } catch (_e) { hashSlice = '00000000'; }
    }
    return ms + '/' + ph + '#' + hashSlice;
  } catch (_e) { return ''; }
}

// _editCapsuleLifecycleFields: read capsule JSON, mutate lifecycle fields,
// re-validate via Phase 43 _assertCapsuleSchema (when exported), atomic write.
// Routes through Phase 43 logic where available; otherwise direct atomic write.
function _editCapsuleLifecycleFields(milestone, phase, edits, planningDir) {
  try {
    const capPath = _capsulePath(planningDir, milestone, phase);
    if (!capPath || !fs.existsSync(capPath)) {
      return { ok: false, reason: 'capsule_not_found' };
    }
    const raw = fs.readFileSync(capPath, 'utf8');
    let cap = null;
    try { cap = JSON.parse(raw); } catch (_e) {
      return { ok: false, reason: 'capsule_unparseable' };
    }
    if (!cap || typeof cap !== 'object') {
      return { ok: false, reason: 'capsule_not_object' };
    }
    // Apply edits ONLY for known lifecycle fields (defense-in-depth: never
    // accidentally mutate other top-level keys via a stray edit object).
    if (edits && typeof edits === 'object') {
      for (const k of LIFECYCLE_FIELD_KEYS) {
        if (k in edits) cap[k] = edits[k];
      }
    }
    // Validate via Phase 43 _assertCapsuleSchema if exported.
    const p43 = _getPhase43();
    if (p43 && typeof p43._assertCapsuleSchema === 'function') {
      try { p43._assertCapsuleSchema(cap); } catch (e) {
        return { ok: false, reason: 'schema_invalid: ' + (e && e.message) };
      }
    }
    // Atomic tmp+rename write. Preserve Phase 43 pretty-print (2-space indent)
    // so PHASE-CAPSULE.json files keep their canonical layout after lifecycle
    // edits (Trap 6 + Pitfall 7: lifecycle backfill is additive, not reformatting).
    const tmp = capPath + '.tmp.' + process.pid + '.' + crypto.randomBytes(2).toString('hex');
    const json = _jsonStringifyAscii(cap, 2) + '\n';
    fs.writeFileSync(tmp, json, { encoding: 'utf8' });
    fs.renameSync(tmp, capPath);
    return { ok: true, capsule: cap, path: capPath };
  } catch (e) {
    return { ok: false, reason: 'edit_failed: ' + (e && e.message) };
  }
}

// _checkSourceHashDrift: re-hash each source_refs[i] against root_source_hashes[i].
// Returns boolean drift flag and emits a memory-revalidations.jsonl row on
// drift. Sets artifact.revalidation_due=true if mutable.
function _checkSourceHashDrift(artifact, planningDir) {
  try {
    if (!artifact || typeof artifact !== 'object') return false;
    const refs = Array.isArray(artifact.source_refs) ? artifact.source_refs : [];
    const hashes = Array.isArray(artifact.root_source_hashes) ? artifact.root_source_hashes : [];
    if (refs.length === 0 || hashes.length === 0) return false;
    const repoRoot = path.resolve(planningDir, '..');
    let drift = false;
    let driftKind = null;
    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const expected = hashes[i] || null;
      if (!ref) continue;
      const abs = path.isAbsolute(ref) ? ref : path.resolve(repoRoot, ref);
      if (!fs.existsSync(abs)) {
        drift = true;
        driftKind = 'source_file_missing';
        break;
      }
      try {
        const buf = fs.readFileSync(abs);
        const got = _sha256OfBuffer(buf);
        if (expected && got !== expected) {
          drift = true;
          driftKind = 'source_hash_drift';
          break;
        }
      } catch (_e) {
        drift = true;
        driftKind = 'source_file_missing';
        break;
      }
    }
    if (drift) {
      try { artifact.revalidation_due = true; } catch (_e) { /* immutable input ok */ }
      const row = {
        envelope_version: ENVELOPE_VERSION,
        ts: _isoNow(),
        command: COMMAND_NAMES.revalidate,
        status: 'warn',
        reason_codes: [driftKind || 'source_hash_drift'],
        artifact_id: artifact.id || artifact.artifact_id || _capsuleArtifactId(artifact) || '',
        details: { drift_kind: driftKind, refs_checked: refs.length },
      };
      _appendLedgerRow(_metricsPath(planningDir, _metricFiles.revalidations), row);
    }
    return drift;
  } catch (_e) { return false; }
}

// _readProcessCursor / _writeProcessCursor: monotonic since_ts cursor.
function _readProcessCursor(planningDir) {
  const def = {
    schema_version: 1,
    since_ts: '1970-01-01T00:00:00.000Z',
    last_invocation_ts: null,
    last_repairs_attempted: 0,
    last_repairs_succeeded: 0,
  };
  try {
    const p = _metricsPath(planningDir, _metricFiles.cursor);
    const obj = _safeReadJson(p);
    if (!obj || typeof obj !== 'object') return def;
    return Object.assign({}, def, obj);
  } catch (_e) { return def; }
}

function _writeProcessCursor(planningDir, cursor) {
  const p = _metricsPath(planningDir, _metricFiles.cursor);
  return _writeAtomicJSON(p, cursor);
}

// _resolveSupersededChain: walk superseded_by_id with depth-cap.
function _resolveSupersededChain(artifact_id, planningDir, depth) {
  try {
    const d = depth || 0;
    if (d >= REPLACED_BY_CHAIN_DEPTH_CAP) {
      return { ok: false, reason: 'revoked_chain_too_deep', depth: d };
    }
    if (!artifact_id) return { ok: true, depth: d };
    const resolved = _resolveCapsule(artifact_id, planningDir);
    if (!resolved || !resolved.capsule) return { ok: true, depth: d };
    const next = resolved.capsule.superseded_by_id;
    if (!next) return { ok: true, depth: d };
    return _resolveSupersededChain(next, planningDir, d + 1);
  } catch (_e) { return { ok: true, depth: depth || 0 }; }
}

// _normalize: input coercion (mirror Phase 36/41-48 pattern).
function _normalize(input) {
  if (!input || typeof input !== 'object') return null;
  const out = Object.assign({}, input);
  if (typeof out.confidence === 'string') out.confidence = out.confidence.trim().toLowerCase();
  if (out.source_refs && !Array.isArray(out.source_refs)) out.source_refs = [];
  if (out.root_source_hashes && !Array.isArray(out.root_source_hashes)) out.root_source_hashes = [];
  if (out.allowed_consumers && !Array.isArray(out.allowed_consumers)) out.allowed_consumers = [];
  if (out.bypass_refs && !Array.isArray(out.bypass_refs)) out.bypass_refs = [];
  return out;
}

// _assertLifecycleFieldSchema: validate runtime artifact (NOT PHASE-CAPSULE.json).
function _assertLifecycleFieldSchema(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    throw new Error('artifact must be object');
  }
  if (artifact.compression_level != null
      && COMPRESSION_LEVELS.indexOf(artifact.compression_level) < 0) {
    throw new Error('compression_level invalid');
  }
  if (artifact.confidence != null
      && CONFIDENCE_VOCAB.indexOf(artifact.confidence) < 0) {
    throw new Error('confidence invalid');
  }
}

// ----------------------------------------------------------------------------
// PUBLIC API: admitMemoryWrite
// ----------------------------------------------------------------------------

function admitMemoryWrite(artifact, opts) {
  try {
    return _admitMemoryWriteInternal(artifact, opts);
  } catch (e) {
    _emitInternalErrorComplaint('memory_admission', e, _planningDir(opts));
    return { ok: false, reason: 'memory_admission_internal_error' };
  }
}

function _admitMemoryWriteInternal(artifact, opts) {
  if (!artifact || typeof artifact !== 'object') {
    return { ok: false, reason: 'memory_admission_artifact_missing' };
  }
  const a = _normalize(artifact);

  // 1. source_refs.
  if (!Array.isArray(a.source_refs) || a.source_refs.length === 0) {
    return { ok: false, reason: 'memory_admission_provenance_missing' };
  }
  // 2. root_source_hashes.
  if (!Array.isArray(a.root_source_hashes) || a.root_source_hashes.length === 0) {
    return { ok: false, reason: 'memory_admission_provenance_missing' };
  }
  if (a.root_source_hashes.length !== a.source_refs.length) {
    return { ok: false, reason: 'memory_admission_provenance_missing' };
  }
  // 3. confidence vocab.
  if (CONFIDENCE_VOCAB.indexOf(a.confidence) < 0) {
    return { ok: false, reason: 'memory_admission_confidence_invalid' };
  }
  // 4. allowed_consumers.
  if (!Array.isArray(a.allowed_consumers) || a.allowed_consumers.length === 0) {
    return { ok: false, reason: 'memory_admission_consumers_missing' };
  }
  // 5. revocation_path.
  if (typeof a.revocation_path !== 'string' || a.revocation_path.length === 0) {
    return { ok: false, reason: 'memory_admission_revocation_path_missing' };
  }
  // 6. compression_level vocab.
  if (COMPRESSION_LEVELS.indexOf(a.compression_level) < 0) {
    return { ok: false, reason: 'memory_admission_compression_level_invalid' };
  }
  const levelIdx = COMPRESSION_LEVELS.indexOf(a.compression_level);
  const phaseCapsuleIdx = COMPRESSION_LEVELS.indexOf('phase_capsule');
  const aboveCapsule = levelIdx > phaseCapsuleIdx;

  // 7. LOCK 6 carve-out: bypass_refs[].length > 0 + above-capsule -> reject.
  if (aboveCapsule && Array.isArray(a.bypass_refs) && a.bypass_refs.length > 0) {
    return { ok: false, reason: 'memory_admission_bypass_refs_block_promotion' };
  }
  // 8. Pitfall 5: debt.critical_added > 0 + above-capsule -> reject.
  if (aboveCapsule && a.debt && typeof a.debt === 'object'
      && Number(a.debt.critical_added) > 0) {
    return { ok: false, reason: 'memory_admission_debt_blocks_promotion' };
  }
  // 9. Open Q1: source_refs reference revoked artifact -> reject.
  // Best-effort: only check if planningDir resolvable + ref looks like an artifact_id.
  try {
    const planningDir = _planningDir(opts);
    for (let i = 0; i < a.source_refs.length; i++) {
      const ref = a.source_refs[i];
      if (typeof ref !== 'string') continue;
      // Treat 'milestone/phase#hash' shaped refs as artifact ids.
      if (/^[^/]+\/[^#]+#/.test(ref)) {
        const resolved = _resolveCapsule(ref, planningDir);
        if (resolved && resolved.capsule && resolved.capsule.revoked_at) {
          return { ok: false, reason: 'memory_admission_source_revoked' };
        }
      }
    }
  } catch (_e) { /* tolerate -- best-effort gate */ }

  // 10. validated_thought additional gate via Phase 45.
  if (a.compression_level === 'validated_thought') {
    const p45 = _getPhase45();
    if (p45 && typeof p45._assertValidatedThoughtProvenance === 'function') {
      try {
        const r = p45._assertValidatedThoughtProvenance({
          source_refs: a.source_refs, root_source_hashes: a.root_source_hashes,
        });
        if (r && r.ok === false) {
          return { ok: false, reason: 'memory_admission_provenance_missing' };
        }
      } catch (_e) {
        return { ok: false, reason: 'memory_admission_provenance_missing' };
      }
    }
  }

  return { ok: true };
}

// ----------------------------------------------------------------------------
// PUBLIC API: promote
// ----------------------------------------------------------------------------

function promote(input, opts) {
  try {
    return _promoteInternal(input, opts);
  } catch (e) {
    _emitInternalErrorComplaint('memory_promote', e, _planningDir(opts));
    return { ok: false, reason: 'memory_promote_internal_error' };
  }
}

function _promoteInternal(input, opts) {
  if (!input || typeof input !== 'object') {
    return { ok: false, reason: 'invalid_input' };
  }
  const planningDir = _planningDir(opts);
  const fromLevel = input.from_level;
  const toLevel = input.to_level;
  const fromIdx = COMPRESSION_LEVELS.indexOf(fromLevel);
  const toIdx = COMPRESSION_LEVELS.indexOf(toLevel);
  if (fromIdx < 0 || toIdx < 0) {
    return { ok: false, reason: 'invalid_compression_level' };
  }
  if (toIdx !== fromIdx + 1) {
    return { ok: false, reason: 'non_adjacent_promotion' };
  }

  // Defense-in-depth: re-run admission gate on the artifact.
  const artifact = input.artifact || input;
  const admitted = admitMemoryWrite(Object.assign({}, artifact, { compression_level: toLevel }), { planningDir: planningDir });
  if (!admitted || admitted.ok !== true) {
    return { ok: false, reason: admitted && admitted.reason ? admitted.reason : 'admission_failed' };
  }

  // Per-pair structural threshold checks.
  let reasonCode = 'evidence_threshold_met';
  if (toLevel === 'validated_thought') {
    const t = artifact.thought || '';
    const usedFor = artifact.used_for || [];
    if (typeof t !== 'string' || t.length === 0) {
      return { ok: false, reason: 'thought_empty' };
    }
    if (!Array.isArray(usedFor) || usedFor.length === 0) {
      return { ok: false, reason: 'used_for_empty' };
    }
    if (Array.isArray(artifact.bypass_refs) && artifact.bypass_refs.length > 0) {
      return { ok: false, reason: 'bypass_refs_block_promotion' };
    }
    if (artifact.debt && Number(artifact.debt.critical_added) > 0) {
      return { ok: false, reason: 'debt_blocks_promotion' };
    }
    reasonCode = 'evidence_threshold_met';
  } else if (toLevel === 'reusable_rule') {
    const cited = Array.isArray(artifact.cited_phases) ? artifact.cited_phases : [];
    const distinct = new Set();
    for (const c of cited) if (typeof c === 'string' && c) distinct.add(c);
    if (distinct.size < 3) {
      return { ok: false, reason: 'reuse_threshold_not_met' };
    }
    if (artifact.confidence !== 'medium' && artifact.confidence !== 'high') {
      return { ok: false, reason: 'low_confidence_blocks_rule_promotion' };
    }
    reasonCode = 'reuse_threshold_met';
  } else if (toLevel === 'guardrail') {
    const rc = (input.evidence && Array.isArray(input.evidence.reason_codes)) ? input.evidence.reason_codes : [];
    if (rc.indexOf('manual_promote_with_provenance') < 0) {
      return { ok: false, reason: 'manual_promote_required_for_guardrail' };
    }
    const eff = (artifact.effect != null) ? String(artifact.effect) : '';
    if (!(eff.indexOf('never ') === 0 || eff.indexOf('MUST not ') === 0)) {
      return { ok: false, reason: 'guardrail_effect_pattern_invalid' };
    }
    reasonCode = 'manual_promote_with_provenance';
  } else if (toLevel === 'phase_capsule') {
    // Delegated to Phase 43; Phase 49 only emits the ledger row.
    reasonCode = 'evidence_threshold_met';
  }

  // Write artifact to .planning/cache/<level>s/<id>.json for thought/rule/guardrail.
  let newId = artifact.id || (toLevel + '-' + crypto.randomBytes(4).toString('hex'));
  if (toLevel === 'validated_thought' || toLevel === 'reusable_rule' || toLevel === 'guardrail') {
    const dirName = toLevel === 'validated_thought' ? 'validated-thoughts'
                  : toLevel === 'reusable_rule' ? 'reusable-rules'
                  : 'guardrails';
    const targetDir = _cacheDir(planningDir, dirName);
    _ensureDir(targetDir);
    const targetPath = path.join(targetDir, newId + '.json');
    const stored = Object.assign({}, artifact, {
      id: newId,
      compression_level: toLevel,
      promoted_at: _isoNow(),
    });
    const w = _writeAtomicJSON(targetPath, stored);
    if (!w.ok) {
      return { ok: false, reason: w.reason };
    }
  }

  // Append envelope-v1 row to memory-promotions.jsonl.
  const row = {
    envelope_version: ENVELOPE_VERSION,
    ts: _isoNow(),
    command: COMMAND_NAMES.promote,
    status: 'ok',
    reason_codes: [reasonCode],
    artifact_id: input.artifact_id || newId,
    details: {
      from_level: fromLevel,
      to_level: toLevel,
      new_id: newId,
      evidence_count: Array.isArray(input.evidence) ? input.evidence.length
                    : (input.evidence && Array.isArray(input.evidence.rows) ? input.evidence.rows.length : 0),
    },
  };
  const ledgerRes = _appendLedgerRow(_metricsPath(planningDir, _metricFiles.promotions), row);
  if (artifact && typeof artifact === 'object') {
    try { artifact.compression_level = toLevel; } catch (_e) { /* immutable input ok */ }
  }
  return { ok: true, new_id: newId, ledger_row: ledgerRes && ledgerRes.row };
}

// ----------------------------------------------------------------------------
// PUBLIC API: demote
// ----------------------------------------------------------------------------

function demote(artifact_id, reason, opts) {
  try {
    return _demoteInternal(artifact_id, reason, opts);
  } catch (e) {
    _emitInternalErrorComplaint('memory_demote', e, _planningDir(opts));
    return { ok: false, reason: 'memory_demote_internal_error' };
  }
}

function _demoteInternal(artifact_id, reason, opts) {
  if (!artifact_id || typeof artifact_id !== 'string') {
    return { ok: false, reason: 'invalid_artifact_id' };
  }
  if (DEMOTION_REASONS.indexOf(reason) < 0) {
    return { ok: false, reason: 'invalid_demotion_reason' };
  }
  const planningDir = _planningDir(opts);
  const resolved = _resolveCapsule(artifact_id, planningDir);
  if (!resolved || !resolved.capsule) {
    return { ok: false, reason: 'capsule_not_found' };
  }
  const cap = resolved.capsule;
  const currentLevel = cap.compression_level || 'phase_capsule';
  const curIdx = COMPRESSION_LEVELS.indexOf(currentLevel);
  if (curIdx <= 0) {
    return { ok: false, reason: 'cannot_demote_below_raw_evidence' };
  }
  const newLevel = COMPRESSION_LEVELS[curIdx - 1];
  const ts = _isoNow();
  const editRes = _editCapsuleLifecycleFields(resolved.milestone, resolved.phase, {
    demoted_at: ts,
    compression_level: newLevel,
  }, planningDir);
  if (!editRes || editRes.ok !== true) {
    return { ok: false, reason: editRes && editRes.reason ? editRes.reason : 'edit_failed' };
  }
  const row = {
    envelope_version: ENVELOPE_VERSION,
    ts: ts,
    command: COMMAND_NAMES.demote,
    status: 'ok',
    reason_codes: [reason],
    artifact_id: artifact_id,
    details: { from_level: currentLevel, to_level: newLevel },
  };
  const ledgerRes = _appendLedgerRow(_metricsPath(planningDir, _metricFiles.demotions), row);
  return { ok: true, ledger_row: ledgerRes && ledgerRes.row };
}

// ----------------------------------------------------------------------------
// PUBLIC API: revoke
// ----------------------------------------------------------------------------

function revoke(artifact_id, reason, replaced_by_id, opts) {
  try {
    return _revokeInternal(artifact_id, reason, replaced_by_id, opts);
  } catch (e) {
    _emitInternalErrorComplaint('memory_revoke', e, _planningDir(opts));
    return { ok: false, reason: 'memory_revoke_internal_error' };
  }
}

function _revokeInternal(artifact_id, reason, replaced_by_id, opts) {
  if (!artifact_id || typeof artifact_id !== 'string') {
    return { ok: false, reason: 'invalid_artifact_id' };
  }
  if (REVOKE_REASONS.indexOf(reason) < 0) {
    return { ok: false, reason: 'invalid_revoke_reason' };
  }
  const planningDir = _planningDir(opts);
  // Depth-cap walk on replaced_by chain.
  if (replaced_by_id) {
    const chain = _resolveSupersededChain(replaced_by_id, planningDir, 1);
    if (chain && chain.ok === false) {
      return { ok: false, reason: 'revoked_chain_too_deep' };
    }
  }
  const resolved = _resolveCapsule(artifact_id, planningDir);
  if (!resolved || !resolved.capsule) {
    return { ok: false, reason: 'capsule_not_found' };
  }
  const ts = _isoNow();
  const editRes = _editCapsuleLifecycleFields(resolved.milestone, resolved.phase, {
    revoked_at: ts,
    revoked_reason: reason,
    superseded_by_id: replaced_by_id || null,
  }, planningDir);
  if (!editRes || editRes.ok !== true) {
    return { ok: false, reason: editRes && editRes.reason ? editRes.reason : 'edit_failed' };
  }
  const row = {
    envelope_version: ENVELOPE_VERSION,
    ts: ts,
    command: COMMAND_NAMES.revoke,
    status: 'ok',
    reason_codes: [reason],
    artifact_id: artifact_id,
    details: { revoked_reason: reason, replaced_by_id: replaced_by_id || null },
  };
  const ledgerRes = _appendLedgerRow(_metricsPath(planningDir, _metricFiles.revocations), row);
  return { ok: true, ledger_row: ledgerRes && ledgerRes.row };
}

// ----------------------------------------------------------------------------
// PUBLIC API: revalidate
// ----------------------------------------------------------------------------

function revalidate(artifact_id, opts) {
  try {
    return _revalidateInternal(artifact_id, opts);
  } catch (e) {
    _emitInternalErrorComplaint('memory_revalidate', e, _planningDir(opts));
    return { ok: false, reason: 'memory_revalidate_internal_error', drift_detected: false };
  }
}

function _revalidateInternal(artifact_id, opts) {
  if (!artifact_id || typeof artifact_id !== 'string') {
    return { ok: false, reason: 'invalid_artifact_id', drift_detected: false };
  }
  const planningDir = _planningDir(opts);
  const resolved = _resolveCapsule(artifact_id, planningDir);
  if (!resolved || !resolved.capsule) {
    return { ok: false, reason: 'capsule_not_found', drift_detected: false };
  }
  const cap = resolved.capsule;
  // Build a synthetic artifact from capsule.source_hashes for drift check.
  // Walk source_hashes: each non-null HashedFile contributes (path, sha256).
  const refs = [];
  const hashes = [];
  try {
    const sh = cap.source_hashes || {};
    if (sh.context && sh.context.path && sh.context.sha256) { refs.push(sh.context.path); hashes.push(sh.context.sha256); }
    if (sh.research && sh.research.path && sh.research.sha256) { refs.push(sh.research.path); hashes.push(sh.research.sha256); }
    if (Array.isArray(sh.plan)) {
      for (const p of sh.plan) {
        if (p && p.path && p.sha256) { refs.push(p.path); hashes.push(p.sha256); }
      }
    }
    if (sh.verification && sh.verification.path && sh.verification.sha256) { refs.push(sh.verification.path); hashes.push(sh.verification.sha256); }
    if (sh.atc_review && sh.atc_review.path && sh.atc_review.sha256) { refs.push(sh.atc_review.path); hashes.push(sh.atc_review.sha256); }
  } catch (_e) { /* ignore -- empty refs => no drift */ }

  if (refs.length === 0) {
    return { ok: true, drift_detected: false };
  }
  const synth = {
    id: artifact_id,
    artifact_id: artifact_id,
    source_refs: refs,
    root_source_hashes: hashes,
  };
  const drift = _checkSourceHashDrift(synth, planningDir);
  if (drift) {
    // Set revalidation_due=true on capsule (NEVER auto-revoke).
    const editRes = _editCapsuleLifecycleFields(resolved.milestone, resolved.phase, {
      revalidation_due: true,
    }, planningDir);
    if (!editRes || editRes.ok !== true) {
      // Drift detected but lifecycle edit failed; still return drift signal.
      return { ok: true, drift_detected: true, edit_failed: true };
    }
  }
  return { ok: true, drift_detected: drift };
}

// ----------------------------------------------------------------------------
// PUBLIC API: processComplaints
// ----------------------------------------------------------------------------

function processComplaints(input, opts) {
  try {
    return _processComplaintsInternal(input, opts);
  } catch (e) {
    _emitInternalErrorComplaint('memory_process_complaints', e, _planningDir(opts || input));
    return { ok: false, reason: 'memory_process_complaints_internal_error',
             repairs_attempted: 0, repairs_succeeded: 0, ledger_rows: [] };
  }
}

function _processComplaintsInternal(input, opts) {
  // Accept input as { since_ts, max_repairs } or split args.
  const cfg = (input && typeof input === 'object') ? input : {};
  const planningDir = _planningDir(opts || cfg);
  const cursor = _readProcessCursor(planningDir);
  let effSince = cfg.since_ts;
  if (effSince == null) effSince = cursor.since_ts;
  // Numeric 0 / epoch / undefined acceptable -- treat falsy as epoch.
  if (effSince === 0 || effSince === '0' || effSince === false) {
    effSince = '1970-01-01T00:00:00.000Z';
  }
  const maxArg = (typeof cfg.max_repairs === 'number') ? cfg.max_repairs : MAX_REPAIRS_PER_INVOCATION;
  const effMax = Math.min(maxArg, MAX_REPAIRS_PER_INVOCATION);

  const complaintsPath = _metricsPath(planningDir, _metricFiles.complaints);
  const rows = _readJsonlSince(complaintsPath, effSince, effMax);
  let attempted = 0;
  let succeeded = 0;
  const emittedRows = [];
  let maxTs = effSince;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const ts = String(row.ts || '');
    if (ts && ts > String(maxTs)) maxTs = ts;
    attempted++;
    const code = (Array.isArray(row.reason_codes) && row.reason_codes.length > 0)
                  ? String(row.reason_codes[0]) : '';
    let repairKind = null;
    let target = (row.details && typeof row.details === 'object') ? row.details : {};

    switch (code) {
      case 'broad_raw_fallback':
        repairKind = 'packet_rebuild';
        break;
      case 'validated_thought_missing_provenance':
        repairKind = 'thought_demote';
        break;
      case 'packet_capsule_unavailable_raw_fallback':
        repairKind = 'capsule_rebuild';
        break;
      case 'packet_invalid_references_filtered':
        repairKind = 'note';
        break;
      case 'phase_capsule_backfill_milestone_missing':
      case 'phase_capsule_backfill_index_unreadable':
        repairKind = 'skip';
        break;
      case 'packet_built_with_omitted_material':
        repairKind = 'note';
        break;
      default:
        repairKind = 'unknown';
    }

    if (repairKind === 'skip') {
      succeeded++;
      continue;
    }

    if (repairKind === 'thought_demote') {
      const aid = target.artifact_id || target.id || '';
      // Open Q2: artifact may already be revoked -- catch demote failure.
      let demRes = null;
      if (aid) demRes = demote(aid, 'abstraction_failed', { planningDir: planningDir });
      if (demRes && demRes.ok === true) {
        succeeded++;
      } else {
        // noop_already_revoked or unresolvable -- log informational row.
        const noop = {
          envelope_version: ENVELOPE_VERSION,
          ts: _isoNow(),
          command: COMMAND_NAMES.demote,
          status: 'ok',
          reason_codes: ['noop_already_revoked'],
          artifact_id: aid,
          details: { triggered_by_complaint_ts: ts, triggered_by_reason_code: code,
                     demote_result: demRes },
        };
        const r = _appendLedgerRow(_metricsPath(planningDir, _metricFiles.demotions), noop);
        if (r && r.ok) succeeded++;
        emittedRows.push(noop);
      }
      continue;
    }

    if (repairKind === 'unknown') {
      const warn = {
        envelope_version: ENVELOPE_VERSION,
        ts: _isoNow(),
        command: COMMAND_NAMES.process,
        status: 'warn',
        reason_codes: ['unknown_complaint_reason_code'],
        details: { original_code: code, triggered_by_complaint_ts: ts },
      };
      const r = _appendLedgerRow(_metricsPath(planningDir, _metricFiles.demotions), warn);
      if (r && r.ok) succeeded++;
      emittedRows.push(warn);
      continue;
    }

    // packet_rebuild / capsule_rebuild / note -> schedule via repair-queue.jsonl.
    const queueRow = {
      envelope_version: ENVELOPE_VERSION,
      ts: _isoNow(),
      command: COMMAND_NAMES.process,
      status: 'ok',
      reason_codes: ['repair_scheduled'],
      details: {
        repair_kind: repairKind,
        target: {
          milestone: target.milestone || null,
          phase: target.phase || null,
          intent_id: target.intent_id || null,
          artifact_id: target.artifact_id || null,
        },
        triggered_by_complaint_ts: ts,
        triggered_by_reason_code: code,
      },
    };
    const r = _appendLedgerRow(_metricsPath(planningDir, _metricFiles.repairQueue), queueRow);
    if (r && r.ok) succeeded++;
    emittedRows.push(queueRow);
  }

  // Advance cursor monotonically.
  const newCursor = {
    schema_version: 1,
    since_ts: maxTs,
    last_invocation_ts: _isoNow(),
    last_repairs_attempted: attempted,
    last_repairs_succeeded: succeeded,
  };
  _writeProcessCursor(planningDir, newCursor);

  return { ok: true, repairs_attempted: attempted, repairs_succeeded: succeeded, ledger_rows: emittedRows };
}

// ----------------------------------------------------------------------------
// PUBLIC API: loadIndexSnippets (Phase 45 step-6 wire)
// ----------------------------------------------------------------------------

function loadIndexSnippets(query, opts) {
  try {
    return _loadIndexSnippetsInternal(query, opts);
  } catch (e) {
    _emitInternalErrorComplaint('memory_load_index_snippets', e, _planningDir(opts));
    return [];
  }
}

function _loadIndexSnippetsInternal(query, opts) {
  const o = opts || {};
  const planningDir = _planningDir(o);
  const limit = (typeof o.limit === 'number') ? o.limit : 5;

  let queryFn = null;
  if (typeof _phase46QueryShim === 'function') {
    queryFn = _phase46QueryShim;
  } else {
    const p46 = _getPhase46();
    if (p46 && typeof p46.query === 'function') queryFn = p46.query;
  }
  if (!queryFn) return [];

  // Phase 46 query resolves dbPath via opts.dbPath OR a __dirname-anchored
  // fallback that points to the real .planning/cache/context-index.sqlite.
  // To honor caller-supplied planningDir (Phase 45 self-test passes a tmpdir),
  // we translate planningDir -> dbPath before calling Phase 46.
  let dbPath = null;
  try {
    if (o.dbPath) dbPath = o.dbPath;
    else if (planningDir) dbPath = path.join(planningDir, 'cache', 'context-index.sqlite');
  } catch (_e) { dbPath = null; }

  let rows = [];
  try {
    const queryOpts = {
      milestone: o.milestone, phase: o.phase, limit: limit,
      kinds: ['capsule', 'decision', 'gate_definition', 'file_summary'],
      filter_invalid: true,
    };
    if (dbPath) queryOpts.dbPath = dbPath;
    rows = queryFn(String(query || ''), queryOpts);
    if (!Array.isArray(rows)) rows = [];
  } catch (_e) { rows = []; }

  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r || typeof r !== 'object') continue;
    let elide = false;
    let revalDue = false;
    if (r.kind === 'capsule' && r.milestone && r.phase) {
      const resolved = _resolveCapsule(r.milestone + '/' + r.phase, planningDir);
      if (resolved && resolved.capsule) {
        if (resolved.capsule.revoked_at) { elide = true; }
        if (!elide && resolved.capsule.revalidation_due === true) { revalDue = true; }
      }
    }
    if (elide) continue;
    const annotated = Object.assign({}, r);
    if (revalDue) annotated.revalidation_due = true;
    if (o.strict_revalidation === true && annotated.revalidation_due === true) continue;
    out.push(annotated);
  }
  return out;
}

// ----------------------------------------------------------------------------
// PUBLIC API: backfillLifecycleFields (one-shot, idempotent)
// ----------------------------------------------------------------------------

function backfillLifecycleFields(planningDirArg, opts) {
  try {
    return _backfillLifecycleFieldsInternal(planningDirArg, opts);
  } catch (e) {
    _emitInternalErrorComplaint('memory_backfill', e, _planningDir({ planningDir: planningDirArg }));
    return { ok: false, reason: 'memory_backfill_internal_error',
             updated: 0, skipped: 0, errors: [String(e && e.message)] };
  }
}

function _backfillLifecycleFieldsInternal(planningDirArg, opts) {
  const planningDir = (typeof planningDirArg === 'string' && planningDirArg.length > 0)
    ? planningDirArg
    : _planningDir(opts);
  let updated = 0;
  let skipped = 0;
  const errors = [];

  const milestonesRoot = path.join(planningDir, 'milestones');
  if (!fs.existsSync(milestonesRoot)) {
    return { ok: true, updated: 0, skipped: 0, errors: [] };
  }
  let mEntries = [];
  try { mEntries = fs.readdirSync(milestonesRoot); } catch (_e) { mEntries = []; }
  // Sort for deterministic order.
  mEntries.sort();
  for (const ms of mEntries) {
    if (!/^v[0-9]/.test(ms)) continue; // Open Q3: skip archive/ etc.
    const phasesDir = path.join(milestonesRoot, ms, 'phases');
    if (!fs.existsSync(phasesDir)) continue;
    let pEntries = [];
    try { pEntries = fs.readdirSync(phasesDir); } catch (_e) { pEntries = []; }
    pEntries.sort();
    for (const ph of pEntries) {
      const phaseDir = path.join(phasesDir, ph);
      let isDir = false;
      try { isDir = fs.statSync(phaseDir).isDirectory(); } catch (_e) { isDir = false; }
      if (!isDir) continue;
      const capPath = path.join(phaseDir, 'PHASE-CAPSULE.json');
      if (!fs.existsSync(capPath)) continue;
      let cap = null;
      try {
        cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
      } catch (e) {
        errors.push({ path: capPath, message: String(e && e.message) });
        continue;
      }
      if (!cap || typeof cap !== 'object') {
        errors.push({ path: capPath, message: 'capsule not object' });
        continue;
      }
      // Idempotency (Pitfall 2): skip if compression_level already set.
      if (cap.compression_level != null) { skipped++; continue; }
      const phaseNumMatch = /^(\d+(?:\.\d+)?)-/.exec(ph);
      const phaseNum = phaseNumMatch ? phaseNumMatch[1] : (cap.phase || '');
      const edits = {
        compression_level: 'phase_capsule',
        promoted_at: cap.created_at || _isoNow(),
        demoted_at: null,
        revoked_at: null,
        revoked_reason: null,
        allowed_consumers: ['*'],
        revalidation_due: null,
        supersedes_id: null,
        superseded_by_id: null,
        revocation_path: 'super-gsd/tools/memory-governance/lifecycle.cjs#revoke',
      };
      const editRes = _editCapsuleLifecycleFields(ms, phaseNum, edits, planningDir);
      if (editRes && editRes.ok === true) {
        updated++;
      } else {
        errors.push({ path: capPath, message: editRes && editRes.reason ? editRes.reason : 'edit_failed' });
      }
    }
  }
  return { ok: true, updated: updated, skipped: skipped, errors: errors };
}

// ----------------------------------------------------------------------------
// PUBLIC API: getMemoryGovernanceSnapshot (Phase 50 forward contract)
// ----------------------------------------------------------------------------

function getMemoryGovernanceSnapshot(planningDirArg, opts) {
  try {
    return _getMemoryGovernanceSnapshotInternal(planningDirArg, opts);
  } catch (e) {
    _emitInternalErrorComplaint('memory_governance_snapshot', e, _planningDir({ planningDir: planningDirArg }));
    return {
      ok: false, reason: 'memory_governance_snapshot_internal_error',
      total_artifacts: 0, by_compression_level: {},
      recently_revoked: [], recently_revalidated: [],
      complaints_pending: 0, last_process_complaints_ts: null,
    };
  }
}

function _getMemoryGovernanceSnapshotInternal(planningDirArg, opts) {
  const planningDir = (typeof planningDirArg === 'string' && planningDirArg.length > 0)
    ? planningDirArg
    : _planningDir(opts);
  const out = {
    ok: true,
    total_artifacts: 0,
    by_compression_level: {},
    recently_revoked: [],
    recently_revalidated: [],
    complaints_pending: 0,
    last_process_complaints_ts: null,
  };
  for (const lvl of COMPRESSION_LEVELS) out.by_compression_level[lvl] = 0;

  // Walk milestones and tally lifecycle counts.
  try {
    const root = path.join(planningDir, 'milestones');
    if (fs.existsSync(root)) {
      const mEntries = fs.readdirSync(root);
      for (const ms of mEntries) {
        if (!/^v[0-9]/.test(ms)) continue;
        const phasesDir = path.join(root, ms, 'phases');
        if (!fs.existsSync(phasesDir)) continue;
        const pEntries = fs.readdirSync(phasesDir);
        for (const ph of pEntries) {
          const capPath = path.join(phasesDir, ph, 'PHASE-CAPSULE.json');
          if (!fs.existsSync(capPath)) continue;
          let cap = null;
          try { cap = JSON.parse(fs.readFileSync(capPath, 'utf8')); } catch (_e) { cap = null; }
          if (!cap || typeof cap !== 'object') continue;
          if (cap.compression_level && out.by_compression_level[cap.compression_level] != null) {
            out.by_compression_level[cap.compression_level]++;
            out.total_artifacts++;
          }
        }
      }
    }
  } catch (_e) { /* tolerate */ }

  // Recent revocations / revalidations: tail 10 rows.
  try {
    out.recently_revoked = _tailJsonlRows(_metricsPath(planningDir, _metricFiles.revocations), 10);
  } catch (_e) { out.recently_revoked = []; }
  try {
    out.recently_revalidated = _tailJsonlRows(_metricsPath(planningDir, _metricFiles.revalidations), 10);
  } catch (_e) { out.recently_revalidated = []; }

  // Complaints pending: count rows in context-complaints.jsonl with ts > cursor.since_ts.
  try {
    const cursor = _readProcessCursor(planningDir);
    const cmpPath = _metricsPath(planningDir, _metricFiles.complaints);
    out.complaints_pending = _readJsonlSince(cmpPath, cursor.since_ts, 10000).length;
    out.last_process_complaints_ts = cursor.last_invocation_ts;
  } catch (_e) { /* tolerate */ }

  return out;
}

function _tailJsonlRows(filePath, n) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw) return [];
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const tail = lines.slice(Math.max(0, lines.length - n));
    const out = [];
    for (const ln of tail) {
      try { out.push(JSON.parse(ln)); } catch (_e) { /* skip malformed */ }
    }
    return out;
  } catch (_e) { return []; }
}

// ----------------------------------------------------------------------------
// SELF-TEST (F1-F14 + sub-fixtures = 22 fixtures, 14 logical assertions)
// ----------------------------------------------------------------------------

function _runSelfTest() {
  const assert = require('assert');
  let pass = 0;
  let fail = 0;
  const fails = [];
  function rec(label, ok, detail) {
    if (ok) { pass++; }
    else { fail++; fails.push({ label: label, detail: detail }); }
  }

  // Fingerprint capture for read-only invariant (F10).
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const planningRoot = path.resolve(repoRoot, '.planning');
  const guardPaths = [
    path.join(planningRoot, 'metrics', 'token-attribution.jsonl'),
    path.join(planningRoot, 'metrics', 'codex-log.jsonl'),
    path.join(planningRoot, 'metrics', 'agent-token-spend.jsonl'),
    path.join(planningRoot, 'metrics', 'activity-log.jsonl'),
    path.join(planningRoot, 'metrics', 'token-log.jsonl'),
    path.join(planningRoot, 'metrics', 'token-waste-status.jsonl'),
    path.join(planningRoot, 'metrics', 'crit-backlog.jsonl'),
    path.join(planningRoot, 'metrics', 'route-decisions.jsonl'),
    path.join(planningRoot, 'metrics', 'vtp-bridge-failures.jsonl'),
    // Phase 41-48 source files (read-only).
    path.join(repoRoot, 'super-gsd', 'tools', 'token-attribution', 'report.cjs'),
    path.join(repoRoot, 'super-gsd', 'tools', 'token-waste', 'check.cjs'),
    path.join(repoRoot, 'super-gsd', 'tools', 'context-registry', 'check.cjs'),
    path.join(repoRoot, 'super-gsd', 'tools', 'intent-map', 'build.cjs'),
    path.join(repoRoot, 'super-gsd', 'tools', 'context-cache', 'query.cjs'),
    path.join(repoRoot, 'super-gsd', 'tools', 'dispatch-router', 'route.cjs'),
    path.join(repoRoot, 'super-gsd', 'tools', 'vtp-bridge', 'classify.cjs'),
    // Sample canonical phase folder content.
    path.join(planningRoot, 'milestones', 'v1.6', 'phases', '26-cockpit-question-contract'),
    path.join(planningRoot, 'milestones', 'v1.8', 'phases', '40-phase-folder-audit'),
    path.join(planningRoot, 'milestones', 'v1.9', 'phases', '41-baseline-token-attribution'),
    path.join(planningRoot, 'milestones', 'v1.9', 'phases', '42-token-budget-admission'),
    path.join(planningRoot, 'milestones', 'v1.9', 'phases', '44-context-registry'),
    path.join(planningRoot, 'milestones', 'v1.9', 'phases', '45-context-packet-builder'),
    path.join(planningRoot, 'milestones', 'v1.9', 'phases', '46-vector-knowledge-store'),
    path.join(planningRoot, 'milestones', 'v1.9', 'phases', '47-uncertainty-driven-dispatch'),
    path.join(planningRoot, 'milestones', 'v1.9', 'phases', '48-vtp-knowledge-bridge'),
  ];

  function fp(p) {
    try { const s = fs.statSync(p); return s.size + ':' + Math.round(s.mtimeMs); }
    catch (_e) { return 'absent'; }
  }
  const fpBefore = guardPaths.map(fp);

  // ASCII-only on this file's bytes.
  try {
    const selfBuf = fs.readFileSync(__filename);
    _assertAsciiOnly(selfBuf);
    rec('ASCII_only_self_bytes', true);
  } catch (e) { rec('ASCII_only_self_bytes', false, e.message); }

  // Parity with Phase 45 COMPRESSION_LEVELS (when available).
  try {
    const p45 = _getPhase45();
    let parity = true;
    if (p45 && Array.isArray(p45.COMPRESSION_LEVELS)) {
      parity = p45.COMPRESSION_LEVELS.length === COMPRESSION_LEVELS.length;
      if (parity) {
        for (let i = 0; i < COMPRESSION_LEVELS.length; i++) {
          if (p45.COMPRESSION_LEVELS[i] !== COMPRESSION_LEVELS[i]) { parity = false; break; }
        }
      }
    }
    rec('F1_parity_compression_levels', parity);
  } catch (e) { rec('F1_parity_compression_levels', false, e.message); }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-st-'));
  const tmpPlanning = path.join(tmpRoot, '.planning');
  fs.mkdirSync(path.join(tmpPlanning, 'metrics'), { recursive: true });

  // F1: admitMemoryWrite happy path.
  try {
    const r = admitMemoryWrite({
      source_refs: ['super-gsd/tools/memory-governance/lifecycle.cjs'],
      root_source_hashes: ['a'.repeat(64)],
      confidence: 'high',
      allowed_consumers: ['*'],
      revocation_path: 'super-gsd/tools/memory-governance/lifecycle.cjs#revoke',
      compression_level: 'phase_capsule',
      bypass_refs: [],
      debt: { critical_added: 0 },
    }, { planningDir: tmpPlanning });
    rec('F1_admit_happy', r && r.ok === true, JSON.stringify(r));
  } catch (e) { rec('F1_admit_happy', false, e.message); }

  // F2: missing source_refs.
  try {
    const r = admitMemoryWrite({
      source_refs: [], root_source_hashes: [],
      confidence: 'high', allowed_consumers: ['*'],
      revocation_path: 'p49#revoke', compression_level: 'phase_capsule',
    }, { planningDir: tmpPlanning });
    rec('F2_admit_reject_no_source_refs',
      r && r.ok === false && r.reason === 'memory_admission_provenance_missing', JSON.stringify(r));
  } catch (e) { rec('F2_admit_reject_no_source_refs', false, e.message); }

  // F2b: missing root_source_hashes.
  try {
    const r = admitMemoryWrite({
      source_refs: ['x'], root_source_hashes: [],
      confidence: 'high', allowed_consumers: ['*'],
      revocation_path: 'p49#revoke', compression_level: 'phase_capsule',
    }, { planningDir: tmpPlanning });
    rec('F2b_admit_reject_no_root_hashes',
      r && r.ok === false && r.reason === 'memory_admission_provenance_missing', JSON.stringify(r));
  } catch (e) { rec('F2b_admit_reject_no_root_hashes', false, e.message); }

  // F2c: confidence='maybe'.
  try {
    const r = admitMemoryWrite({
      source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
      confidence: 'maybe', allowed_consumers: ['*'],
      revocation_path: 'p49#revoke', compression_level: 'phase_capsule',
    }, { planningDir: tmpPlanning });
    rec('F2c_admit_reject_confidence',
      r && r.ok === false && r.reason === 'memory_admission_confidence_invalid', JSON.stringify(r));
  } catch (e) { rec('F2c_admit_reject_confidence', false, e.message); }

  // F2d: bypass_refs[]>0 + above-capsule -> reject (LOCK 6).
  try {
    const r = admitMemoryWrite({
      source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
      confidence: 'high', allowed_consumers: ['*'],
      revocation_path: 'p49#revoke', compression_level: 'validated_thought',
      bypass_refs: [{ stream: 'crit-backlog', id: 'x', kind: 'CRIT',
                      summary_passthrough: '...', evidence_path: null }],
    }, { planningDir: tmpPlanning });
    rec('F2d_admit_reject_bypass_blocks_promotion',
      r && r.ok === false && r.reason === 'memory_admission_bypass_refs_block_promotion', JSON.stringify(r));
  } catch (e) { rec('F2d_admit_reject_bypass_blocks_promotion', false, e.message); }

  // F2e: debt.critical_added>0 + above-capsule.
  try {
    const r = admitMemoryWrite({
      source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
      confidence: 'high', allowed_consumers: ['*'],
      revocation_path: 'p49#revoke', compression_level: 'validated_thought',
      bypass_refs: [], debt: { critical_added: 2 },
    }, { planningDir: tmpPlanning });
    rec('F2e_admit_reject_debt_blocks_promotion',
      r && r.ok === false && r.reason === 'memory_admission_debt_blocks_promotion', JSON.stringify(r));
  } catch (e) { rec('F2e_admit_reject_debt_blocks_promotion', false, e.message); }

  // F2f: missing allowed_consumers.
  try {
    const r = admitMemoryWrite({
      source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
      confidence: 'high', allowed_consumers: [],
      revocation_path: 'p49#revoke', compression_level: 'phase_capsule',
    }, { planningDir: tmpPlanning });
    rec('F2f_admit_reject_no_consumers',
      r && r.ok === false && r.reason === 'memory_admission_consumers_missing', JSON.stringify(r));
  } catch (e) { rec('F2f_admit_reject_no_consumers', false, e.message); }

  // F2g: missing revocation_path.
  try {
    const r = admitMemoryWrite({
      source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
      confidence: 'high', allowed_consumers: ['*'],
      revocation_path: '', compression_level: 'phase_capsule',
    }, { planningDir: tmpPlanning });
    rec('F2g_admit_reject_no_revocation_path',
      r && r.ok === false && r.reason === 'memory_admission_revocation_path_missing', JSON.stringify(r));
  } catch (e) { rec('F2g_admit_reject_no_revocation_path', false, e.message); }

  // F2h: invalid compression_level.
  try {
    const r = admitMemoryWrite({
      source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
      confidence: 'high', allowed_consumers: ['*'],
      revocation_path: 'p49#revoke', compression_level: 'trusted',
    }, { planningDir: tmpPlanning });
    rec('F2h_admit_reject_invalid_compression_level',
      r && r.ok === false && r.reason === 'memory_admission_compression_level_invalid', JSON.stringify(r));
  } catch (e) { rec('F2h_admit_reject_invalid_compression_level', false, e.message); }

  // F3: promote raw_evidence -> phase_capsule (ledger emission).
  try {
    const r = promote({
      from_level: 'raw_evidence',
      to_level: 'phase_capsule',
      artifact_id: 'v1.test/99#abcd1234',
      artifact: {
        source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
        confidence: 'high', allowed_consumers: ['*'],
        revocation_path: 'p49#revoke', compression_level: 'phase_capsule',
      },
      evidence: { rows: [1, 2, 3] },
    }, { planningDir: tmpPlanning });
    const promFile = _metricsPath(tmpPlanning, _metricFiles.promotions);
    const promExists = fs.existsSync(promFile);
    rec('F3_promote_raw_to_capsule', r && r.ok === true && promExists, JSON.stringify(r));
  } catch (e) { rec('F3_promote_raw_to_capsule', false, e.message); }

  // F4: promote phase_capsule -> validated_thought.
  try {
    const r = promote({
      from_level: 'phase_capsule',
      to_level: 'validated_thought',
      artifact: {
        source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
        confidence: 'high', allowed_consumers: ['*'],
        revocation_path: 'p49#revoke', compression_level: 'validated_thought',
        thought: 'F4 fixture thought body',
        used_for: ['planner', 'researcher'],
        bypass_refs: [], debt: { critical_added: 0 },
      },
      evidence: [{ row: 1 }, { row: 2 }, { row: 3 }],
    }, { planningDir: tmpPlanning });
    const targetDir = _cacheDir(tmpPlanning, 'validated-thoughts');
    let written = false;
    try {
      const ents = fs.existsSync(targetDir) ? fs.readdirSync(targetDir) : [];
      written = ents.length >= 1;
    } catch (_e) { written = false; }
    rec('F4_promote_capsule_to_thought', r && r.ok === true && written, JSON.stringify(r));
  } catch (e) { rec('F4_promote_capsule_to_thought', false, e.message); }

  // F5: promote validated_thought -> reusable_rule (>=3 distinct phases).
  try {
    const r = promote({
      from_level: 'validated_thought',
      to_level: 'reusable_rule',
      artifact: {
        source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
        confidence: 'high', allowed_consumers: ['*'],
        revocation_path: 'p49#revoke', compression_level: 'reusable_rule',
        cited_phases: ['v1.6/26', 'v1.6/27', 'v1.7/31'],
        bypass_refs: [], debt: { critical_added: 0 },
      },
      evidence: [{ row: 1 }],
    }, { planningDir: tmpPlanning });
    rec('F5_promote_thought_to_rule_3_phases', r && r.ok === true, JSON.stringify(r));
  } catch (e) { rec('F5_promote_thought_to_rule_3_phases', false, e.message); }

  // F5b: <3 cited_phases -> reject.
  try {
    const r = promote({
      from_level: 'validated_thought', to_level: 'reusable_rule',
      artifact: {
        source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
        confidence: 'high', allowed_consumers: ['*'],
        revocation_path: 'p49#revoke', compression_level: 'reusable_rule',
        cited_phases: ['v1.6/26', 'v1.6/27'],
        bypass_refs: [], debt: { critical_added: 0 },
      },
    }, { planningDir: tmpPlanning });
    rec('F5b_promote_rule_reject_2_phases',
      r && r.ok === false && r.reason === 'reuse_threshold_not_met', JSON.stringify(r));
  } catch (e) { rec('F5b_promote_rule_reject_2_phases', false, e.message); }

  // F5c: confidence='low' -> reject.
  try {
    const r = promote({
      from_level: 'validated_thought', to_level: 'reusable_rule',
      artifact: {
        source_refs: ['x'], root_source_hashes: ['a'.repeat(64)],
        confidence: 'low', allowed_consumers: ['*'],
        revocation_path: 'p49#revoke', compression_level: 'reusable_rule',
        cited_phases: ['v1.6/26', 'v1.6/27', 'v1.7/31'],
        bypass_refs: [], debt: { critical_added: 0 },
      },
    }, { planningDir: tmpPlanning });
    rec('F5c_promote_rule_reject_low_confidence',
      r && r.ok === false && r.reason === 'low_confidence_blocks_rule_promotion', JSON.stringify(r));
  } catch (e) { rec('F5c_promote_rule_reject_low_confidence', false, e.message); }

  // F6: demote validated_thought -> phase_capsule.
  // Setup synthetic capsule.
  try {
    const tmp6 = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f6-'));
    const planningDir6 = path.join(tmp6, '.planning');
    const phaseDir6 = path.join(planningDir6, 'milestones', 'v1.test', 'phases', '99-fixture');
    fs.mkdirSync(phaseDir6, { recursive: true });
    fs.mkdirSync(path.join(planningDir6, 'metrics'), { recursive: true });
    const capObj = _buildSyntheticCapsule({
      milestone: 'v1.test', phase: '99', compressionLevel: 'validated_thought',
    });
    fs.writeFileSync(path.join(phaseDir6, 'PHASE-CAPSULE.json'),
      _jsonStringifyAscii(capObj) + '\n', 'utf8');
    const aid = capObj.milestone + '/' + capObj.phase + '#abcd1234';
    const r = demote(aid, 'abstraction_failed', { planningDir: planningDir6 });
    let ok = r && r.ok === true;
    if (ok) {
      const cap = JSON.parse(fs.readFileSync(path.join(phaseDir6, 'PHASE-CAPSULE.json'), 'utf8'));
      ok = cap.compression_level === 'phase_capsule' && cap.demoted_at != null;
    }
    rec('F6_demote_thought_to_capsule', ok, JSON.stringify(r));
  } catch (e) { rec('F6_demote_thought_to_capsule', false, e.message); }

  // F7: revoke validated_thought.
  try {
    const tmp7 = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f7-'));
    const planningDir7 = path.join(tmp7, '.planning');
    const phaseDir7 = path.join(planningDir7, 'milestones', 'v1.test', 'phases', '99-fixture');
    fs.mkdirSync(phaseDir7, { recursive: true });
    fs.mkdirSync(path.join(planningDir7, 'metrics'), { recursive: true });
    const capObj = _buildSyntheticCapsule({
      milestone: 'v1.test', phase: '99', compressionLevel: 'validated_thought',
    });
    fs.writeFileSync(path.join(phaseDir7, 'PHASE-CAPSULE.json'),
      _jsonStringifyAscii(capObj) + '\n', 'utf8');
    const aid = capObj.milestone + '/' + capObj.phase + '#abcd1234';
    const r = revoke(aid, 'stale', null, { planningDir: planningDir7 });
    let ok = r && r.ok === true;
    if (ok) {
      const cap = JSON.parse(fs.readFileSync(path.join(phaseDir7, 'PHASE-CAPSULE.json'), 'utf8'));
      ok = cap.revoked_at != null && cap.revoked_reason === 'stale';
    }
    rec('F7_revoke_thought', ok, JSON.stringify(r));
  } catch (e) { rec('F7_revoke_thought', false, e.message); }

  // F7b: revoke chain too deep.
  try {
    const tmp7b = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f7b-'));
    const planningDir7b = path.join(tmp7b, '.planning');
    fs.mkdirSync(path.join(planningDir7b, 'metrics'), { recursive: true });
    // Build a 6-deep chain: A->B->C->D->E->F where F is the outermost.
    // We are revoking A with replaced_by_id=B; B already has superseded_by_id=C; etc.
    const chain = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (let i = 0; i < chain.length; i++) {
      const ms = 'v1.test';
      const ph = '90' + i;
      const dir = path.join(planningDir7b, 'milestones', ms, 'phases', ph + '-' + chain[i]);
      fs.mkdirSync(dir, { recursive: true });
      const cap = _buildSyntheticCapsule({ milestone: ms, phase: ph, compressionLevel: 'phase_capsule' });
      if (i < chain.length - 1) {
        cap.superseded_by_id = ms + '/' + ('90' + (i + 1)) + '#abcd1234';
      }
      fs.writeFileSync(path.join(dir, 'PHASE-CAPSULE.json'), _jsonStringifyAscii(cap) + '\n', 'utf8');
    }
    // Now attempt to revoke '900' -> replaced_by_id='901#...' which has chain to 905.
    const r = revoke('v1.test/900#abcd1234', 'stale', 'v1.test/901#abcd1234',
      { planningDir: planningDir7b });
    rec('F7b_revoke_chain_too_deep',
      r && r.ok === false && r.reason === 'revoked_chain_too_deep', JSON.stringify(r));
  } catch (e) { rec('F7b_revoke_chain_too_deep', false, e.message); }

  // F8: revalidate source-hash drift.
  try {
    const tmp8 = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f8-'));
    const planningDir8 = path.join(tmp8, '.planning');
    const phaseDir8 = path.join(planningDir8, 'milestones', 'v1.test', 'phases', '99-fixture');
    fs.mkdirSync(phaseDir8, { recursive: true });
    fs.mkdirSync(path.join(planningDir8, 'metrics'), { recursive: true });
    // Write source file.
    const srcRel = '.planning/milestones/v1.test/phases/99-fixture/99-CONTEXT.md';
    const srcAbs = path.join(tmp8, srcRel);
    fs.mkdirSync(path.dirname(srcAbs), { recursive: true });
    const original = 'F8 original';
    fs.writeFileSync(srcAbs, original, 'utf8');
    const H1 = _sha256OfBuffer(Buffer.from(original, 'utf8'));
    const cap = _buildSyntheticCapsule({
      milestone: 'v1.test', phase: '99', compressionLevel: 'phase_capsule',
    });
    cap.source_hashes = {
      context: { path: srcRel, sha256: H1 },
      research: null, plan: [], verification: null, atc_review: null,
    };
    fs.writeFileSync(path.join(phaseDir8, 'PHASE-CAPSULE.json'),
      _jsonStringifyAscii(cap) + '\n', 'utf8');
    // Modify source.
    fs.writeFileSync(srcAbs, 'F8 modified', 'utf8');
    const r = revalidate('v1.test/99#abcd1234', { planningDir: planningDir8 });
    let ok = r && r.ok === true && r.drift_detected === true;
    if (ok) {
      const cap2 = JSON.parse(fs.readFileSync(path.join(phaseDir8, 'PHASE-CAPSULE.json'), 'utf8'));
      ok = cap2.revalidation_due === true && cap2.revoked_at == null;
    }
    rec('F8_revalidate_drift_detected', ok, JSON.stringify(r));
  } catch (e) { rec('F8_revalidate_drift_detected', false, e.message); }

  // F8b: revalidate source file deleted.
  try {
    const tmp8b = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f8b-'));
    const planningDir8b = path.join(tmp8b, '.planning');
    const phaseDir8b = path.join(planningDir8b, 'milestones', 'v1.test', 'phases', '99-fixture');
    fs.mkdirSync(phaseDir8b, { recursive: true });
    fs.mkdirSync(path.join(planningDir8b, 'metrics'), { recursive: true });
    const cap = _buildSyntheticCapsule({
      milestone: 'v1.test', phase: '99', compressionLevel: 'phase_capsule',
    });
    cap.source_hashes = {
      context: { path: '.planning/missing/file.md', sha256: 'a'.repeat(64) },
      research: null, plan: [], verification: null, atc_review: null,
    };
    fs.writeFileSync(path.join(phaseDir8b, 'PHASE-CAPSULE.json'),
      _jsonStringifyAscii(cap) + '\n', 'utf8');
    const r = revalidate('v1.test/99#abcd1234', { planningDir: planningDir8b });
    rec('F8b_revalidate_source_missing',
      r && r.ok === true && r.drift_detected === true, JSON.stringify(r));
  } catch (e) { rec('F8b_revalidate_source_missing', false, e.message); }

  // F9: processComplaints broad_raw_fallback -> packet_rebuild scheduled.
  try {
    const tmp9 = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f9-'));
    const planningDir9 = path.join(tmp9, '.planning');
    fs.mkdirSync(path.join(planningDir9, 'metrics'), { recursive: true });
    const t0 = '2026-04-27T22:00:00.000Z';
    const row = JSON.stringify({
      envelope_version: 1, ts: t0, command: 'contextPacketComplaint',
      status: 'warn', reason_codes: ['broad_raw_fallback'],
      details: { intent_id: 'X', milestone: 'v1.test', phase: '99' },
    });
    fs.writeFileSync(_metricsPath(planningDir9, _metricFiles.complaints), row + '\n', 'utf8');
    const r = processComplaints({ since_ts: '1970-01-01T00:00:00.000Z', max_repairs: 50 },
                                  { planningDir: planningDir9 });
    let ok = r && r.repairs_attempted === 1 && r.repairs_succeeded === 1;
    if (ok) {
      const queue = fs.readFileSync(_metricsPath(planningDir9, _metricFiles.repairQueue), 'utf8');
      ok = queue.indexOf('packet_rebuild') >= 0;
      const cur = JSON.parse(fs.readFileSync(_metricsPath(planningDir9, _metricFiles.cursor), 'utf8'));
      ok = ok && cur.since_ts === t0;
    }
    rec('F9_process_complaints_broad_raw', ok, JSON.stringify(r));
  } catch (e) { rec('F9_process_complaints_broad_raw', false, e.message); }

  // F9b: processComplaints already-revoked artifact race.
  try {
    const tmp9b = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f9b-'));
    const planningDir9b = path.join(tmp9b, '.planning');
    fs.mkdirSync(path.join(planningDir9b, 'metrics'), { recursive: true });
    const row = JSON.stringify({
      envelope_version: 1, ts: '2026-04-27T22:00:00.000Z',
      command: 'contextPacketComplaint', status: 'warn',
      reason_codes: ['validated_thought_missing_provenance'],
      details: { artifact_id: 'v1.gone/999#deadbeef' },
    });
    fs.writeFileSync(_metricsPath(planningDir9b, _metricFiles.complaints), row + '\n', 'utf8');
    const r = processComplaints({ since_ts: '1970-01-01T00:00:00.000Z', max_repairs: 50 },
                                  { planningDir: planningDir9b });
    // The artifact does not resolve -> demote returns ok:false; we log noop_already_revoked.
    let ok = r && r.repairs_attempted === 1;
    if (ok) {
      const dem = _safeReadFile(_metricsPath(planningDir9b, _metricFiles.demotions));
      ok = dem != null && dem.indexOf('noop_already_revoked') >= 0;
    }
    rec('F9b_process_already_revoked_noop', ok, JSON.stringify(r));
  } catch (e) { rec('F9b_process_already_revoked_noop', false, e.message); }

  // F9c: processComplaints max_repairs cap.
  try {
    const tmp9c = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f9c-'));
    const planningDir9c = path.join(tmp9c, '.planning');
    fs.mkdirSync(path.join(planningDir9c, 'metrics'), { recursive: true });
    const cmpPath = _metricsPath(planningDir9c, _metricFiles.complaints);
    const lines = [];
    for (let i = 0; i < 100; i++) {
      const ts = '2026-04-27T22:' + ('00' + (i % 60)).slice(-2)
              + ':' + ('00' + Math.floor(i / 60)).slice(-2) + '.000Z';
      lines.push(JSON.stringify({
        envelope_version: 1, ts: ts, command: 'contextPacketComplaint',
        status: 'warn', reason_codes: ['broad_raw_fallback'],
        details: { intent_id: 'X' + i },
      }));
    }
    fs.writeFileSync(cmpPath, lines.join('\n') + '\n', 'utf8');
    const r = processComplaints({ since_ts: '1970-01-01T00:00:00.000Z', max_repairs: 50 },
                                  { planningDir: planningDir9c });
    rec('F9c_process_max_repairs_cap',
      r && r.repairs_attempted === 50, JSON.stringify(r));
  } catch (e) { rec('F9c_process_max_repairs_cap', false, e.message); }

  // F11: backfill idempotency.
  try {
    const tmp11 = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f11-'));
    const planningDir11 = path.join(tmp11, '.planning');
    fs.mkdirSync(path.join(planningDir11, 'metrics'), { recursive: true });
    for (let i = 0; i < 3; i++) {
      const dir = path.join(planningDir11, 'milestones', 'v1.test', 'phases', '9' + i + '-fixture');
      fs.mkdirSync(dir, { recursive: true });
      const cap = _buildSyntheticCapsule({
        milestone: 'v1.test', phase: '9' + i, compressionLevel: null,
      });
      delete cap.compression_level;
      fs.writeFileSync(path.join(dir, 'PHASE-CAPSULE.json'),
        _jsonStringifyAscii(cap) + '\n', 'utf8');
    }
    const r1 = backfillLifecycleFields(planningDir11);
    const r2 = backfillLifecycleFields(planningDir11);
    let ok = r1 && r1.updated === 3 && r1.skipped === 0
          && r2 && r2.updated === 0 && r2.skipped === 3;
    if (ok) {
      // promoted_at preserved across runs.
      const cap = JSON.parse(fs.readFileSync(
        path.join(planningDir11, 'milestones', 'v1.test', 'phases', '90-fixture', 'PHASE-CAPSULE.json'),
        'utf8'));
      ok = cap.compression_level === 'phase_capsule' && cap.allowed_consumers
           && cap.allowed_consumers[0] === '*';
    }
    rec('F11_backfill_idempotent', ok, JSON.stringify({ r1: r1, r2: r2 }));
  } catch (e) { rec('F11_backfill_idempotent', false, e.message); }

  // F12: envelope-v1 row coverage on 4 NEW canonical streams.
  try {
    const promFile = _metricsPath(tmpPlanning, _metricFiles.promotions);
    const exists = fs.existsSync(promFile);
    if (exists) {
      const raw = fs.readFileSync(promFile, 'utf8');
      const ok = raw.indexOf('"envelope_version":1') >= 0 || raw.indexOf('"envelope_version": 1') >= 0;
      rec('F12_envelope_v1_promotions', ok, raw.slice(0, 200));
    } else {
      rec('F12_envelope_v1_promotions', false, 'promotions file missing');
    }
  } catch (e) { rec('F12_envelope_v1_promotions', false, e.message); }

  // F13: Lock 13 -- every public API survives null/undefined/garbage.
  // Redirect all calls to a tmp planningDir so the read-only invariant on
  // real .planning/metrics holds even on garbage-input internal-error paths.
  try {
    const tmp13 = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f13-'));
    const planningDir13 = path.join(tmp13, '.planning');
    fs.mkdirSync(path.join(planningDir13, 'metrics'), { recursive: true });
    const apis = [admitMemoryWrite, promote, demote, revoke, revalidate,
                  processComplaints, loadIndexSnippets, backfillLifecycleFields];
    let ok = true;
    for (const fn of apis) {
      // First arg variants; second arg always supplies planningDir to keep
      // any internal-error complaint emission scoped to tmpdir.
      const inputs = [null, undefined, {}, { garbage: 1 }];
      for (const inp of inputs) {
        try { fn(inp, { planningDir: planningDir13 }); }
        catch (_e) { ok = false; }
      }
      // No-arg variant intentionally NOT exercised here -- the public APIs
      // accept a planningDir override via opts; calling without opts would
      // resolve to process.cwd()/.planning and pollute the canonical streams
      // even though the API never throws. The Lock 13 contract is satisfied
      // by the {garbage:1}, undefined, null, {} inputs above (each exercises
      // a different internal-error path). Real callers always pass opts.

    }
    // Assert ledger row size cap.
    const promFile = _metricsPath(tmpPlanning, _metricFiles.promotions);
    if (fs.existsSync(promFile)) {
      const raw = fs.readFileSync(promFile, 'utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const ln of lines) if (ln.length > ROW_BYTE_BUDGET) { ok = false; break; }
    }
    rec('F13_lock13_never_throws', ok);
  } catch (e) { rec('F13_lock13_never_throws', false, e.message); }

  // F14: Phase 45 wire -- loadIndexSnippets via shim.
  try {
    const tmp14 = fs.mkdtempSync(path.join(os.tmpdir(), 'p49-f14-'));
    const planningDir14 = path.join(tmp14, '.planning');
    const phaseDir14 = path.join(planningDir14, 'milestones', 'v1.6', 'phases', '26-cockpit');
    fs.mkdirSync(phaseDir14, { recursive: true });
    fs.mkdirSync(path.join(planningDir14, 'metrics'), { recursive: true });
    const cap = _buildSyntheticCapsule({
      milestone: 'v1.6', phase: '26', compressionLevel: 'phase_capsule',
    });
    fs.writeFileSync(path.join(phaseDir14, 'PHASE-CAPSULE.json'),
      _jsonStringifyAscii(cap) + '\n', 'utf8');
    const fakeRows = [{ kind: 'capsule', key: 'v1.6/26', snippet: '...',
                        score: 0.95, milestone: 'v1.6', phase: '26' }];
    _injectPhase46QueryShim(function (_q, _o) { return fakeRows; });
    const out = loadIndexSnippets('test query', {
      planningDir: planningDir14, milestone: 'v1.6', phase: '26',
      limit: 5, strict_revalidation: false,
    });
    _injectPhase46QueryShim(null);
    rec('F14_phase45_wire_loadIndexSnippets',
      Array.isArray(out) && out.length === 1, JSON.stringify(out));
  } catch (e) { rec('F14_phase45_wire_loadIndexSnippets', false, e.message); }

  // F10: read-only invariant fingerprint diff.
  try {
    const fpAfter = guardPaths.map(fp);
    const ok = JSON.stringify(fpBefore) === JSON.stringify(fpAfter);
    rec('F10_read_only_invariant', ok, ok ? '' : 'fingerprint drift detected');
  } catch (e) { rec('F10_read_only_invariant', false, e.message); }

  // Cleanup.
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_e) {}

  console.log('memory-governance/lifecycle self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fails.length) {
    for (const f of fails) console.error('  FAIL', f.label, f.detail || '');
  }
  return fail === 0 ? 0 : 1;
}

// Helper: build a synthetic but schema-valid capsule for self-test fixtures.
// Mirrors Phase 43 schema requirements; lifecycle fields configurable.
function _buildSyntheticCapsule(opts) {
  const o = opts || {};
  return {
    schema_version: 1,
    milestone: o.milestone || 'v1.test',
    phase: o.phase || '99',
    phase_name: 'Synthetic Fixture',
    status: 'PASS',
    goal: 'Self-test fixture capsule',
    outputs: [],
    files: [],
    decisions: [],
    debt: { critical_added: 0, warnings_added: 0, edge_guard_miss_added: 0,
            deferred_added: 0, carried_forward_total: 0 },
    downstream_contract: { consumers: [], constraints: [], extension_points: [] },
    bypass_refs: [],
    source_commits: [],
    source_hashes: { context: null, research: null, plan: [], verification: null, atc_review: null },
    gates: { verifier: null, atc_review: null, phase_level_atc_runs: [], codex_runs: [], review_verdict: null },
    token_cost: null,
    created_at: '2026-04-27T22:00:00.000Z',
    created_by: 'super-gsd/tools/memory-governance/lifecycle.cjs@selftest',
    compression_level: o.compressionLevel || null,
    promoted_at: o.compressionLevel ? '2026-04-27T22:00:00.000Z' : null,
    demoted_at: null,
    revoked_at: null,
    revoked_reason: null,
    allowed_consumers: o.compressionLevel ? ['*'] : null,
    revalidation_due: null,
    supersedes_id: null,
    superseded_by_id: null,
    revocation_path: o.compressionLevel ? 'super-gsd/tools/memory-governance/lifecycle.cjs#revoke' : null,
  };
}

// ----------------------------------------------------------------------------
// CLI ENTRY POINT (mirror Phase 47/48 verb dispatch)
// ----------------------------------------------------------------------------

function _usage() {
  console.log('Usage:');
  console.log('  node super-gsd/tools/memory-governance/lifecycle.cjs --self-test');
  console.log('  node super-gsd/tools/memory-governance/lifecycle.cjs --backfill');
  console.log('  node super-gsd/tools/memory-governance/lifecycle.cjs --snapshot');
  console.log('  node super-gsd/tools/memory-governance/lifecycle.cjs --process-complaints [--since <iso>] [--max-repairs N]');
  console.log('  node super-gsd/tools/memory-governance/lifecycle.cjs --revalidate --artifact-id <id>');
  console.log('  node super-gsd/tools/memory-governance/lifecycle.cjs --revoke --artifact-id <id> --reason <r> [--replaced-by-id <id>]');
  console.log('  node super-gsd/tools/memory-governance/lifecycle.cjs --demote --artifact-id <id> --reason <r>');
  console.log('  node super-gsd/tools/memory-governance/lifecycle.cjs --admit --artifact-file <path>');
  console.log('  node super-gsd/tools/memory-governance/lifecycle.cjs --promote --from <l> --to <l> --artifact-id <id> [--evidence-file <path>]');
}

function _parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.indexOf('--') === 0) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next != null && next.indexOf('--') !== 0) { out[key] = next; i++; }
      else { out[key] = true; }
    } else { out._.push(a); }
  }
  return out;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const args = _parseArgs(argv);
  if (args['self-test']) { process.exit(_runSelfTest()); }
  if (args.backfill) {
    const planningDir = args['planning-dir'] || _planningDir({});
    const r = backfillLifecycleFields(planningDir);
    console.log(JSON.stringify(r));
    process.exit(r && r.errors && r.errors.length === 0 ? 0 : 1);
  }
  if (args.snapshot) {
    console.log(JSON.stringify(getMemoryGovernanceSnapshot(_planningDir({})), null, 2));
    process.exit(0);
  }
  if (args['process-complaints']) {
    const r = processComplaints({
      since_ts: args.since || undefined,
      max_repairs: args['max-repairs'] ? Number(args['max-repairs']) : undefined,
    });
    console.log(JSON.stringify(r));
    process.exit(0);
  }
  if (args.revalidate) {
    const r = revalidate(args['artifact-id']);
    console.log(JSON.stringify(r)); process.exit(r && r.ok ? 0 : 1);
  }
  if (args.revoke) {
    const r = revoke(args['artifact-id'], args.reason, args['replaced-by-id'] || null);
    console.log(JSON.stringify(r)); process.exit(r && r.ok ? 0 : 1);
  }
  if (args.demote) {
    const r = demote(args['artifact-id'], args.reason);
    console.log(JSON.stringify(r)); process.exit(r && r.ok ? 0 : 1);
  }
  if (args.admit) {
    let artifact = null;
    if (args['artifact-file']) artifact = _safeReadJson(args['artifact-file']);
    const r = admitMemoryWrite(artifact);
    console.log(JSON.stringify(r)); process.exit(r && r.ok ? 0 : 1);
  }
  if (args.promote) {
    let artifact = null, evidence = null;
    if (args['artifact-file']) artifact = _safeReadJson(args['artifact-file']);
    if (args['evidence-file']) evidence = _safeReadJson(args['evidence-file']);
    const r = promote({ from_level: args.from, to_level: args.to,
                        artifact_id: args['artifact-id'], artifact: artifact, evidence: evidence });
    console.log(JSON.stringify(r)); process.exit(r && r.ok ? 0 : 1);
  }
  _usage();
  process.exit(2);
}

// ----------------------------------------------------------------------------
// MODULE EXPORTS
// ----------------------------------------------------------------------------

module.exports = {
  // Public APIs
  admitMemoryWrite: admitMemoryWrite,
  promote: promote,
  demote: demote,
  revoke: revoke,
  revalidate: revalidate,
  processComplaints: processComplaints,
  loadIndexSnippets: loadIndexSnippets,
  backfillLifecycleFields: backfillLifecycleFields,
  getMemoryGovernanceSnapshot: getMemoryGovernanceSnapshot,
  // Frozen consts
  COMPRESSION_LEVELS: COMPRESSION_LEVELS,
  PROMOTION_REASONS: PROMOTION_REASONS,
  DEMOTION_REASONS: DEMOTION_REASONS,
  REVOKE_REASONS: REVOKE_REASONS,
  CONFIDENCE_VOCAB: CONFIDENCE_VOCAB,
  ADMISSION_REJECT_CODES: ADMISSION_REJECT_CODES,
  REVALIDATION_KINDS: REVALIDATION_KINDS,
  COMMAND_NAMES: COMMAND_NAMES,
  ENVELOPE_VERSION: ENVELOPE_VERSION,
  MAX_REPAIRS_PER_INVOCATION: MAX_REPAIRS_PER_INVOCATION,
  REPLACED_BY_CHAIN_DEPTH_CAP: REPLACED_BY_CHAIN_DEPTH_CAP,
  LIFECYCLE_FIELD_KEYS: LIFECYCLE_FIELD_KEYS,
  // Internal helpers (exported for orchestrator skill wires + Phase 50 cockpit)
  _capsuleArtifactId: _capsuleArtifactId,
  _resolveCapsule: _resolveCapsule,
  _editCapsuleLifecycleFields: _editCapsuleLifecycleFields,
  _checkSourceHashDrift: _checkSourceHashDrift,
  _injectPhase46QueryShim: _injectPhase46QueryShim,
  _runSelfTest: _runSelfTest,
};
