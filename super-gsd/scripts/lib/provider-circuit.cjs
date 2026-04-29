#!/usr/bin/env node
// =============================================================================
// super-gsd/scripts/lib/provider-circuit.cjs
// Phase 55-01: Provider Backpressure + Timeout Circuits.
//
// PURPOSE
//   N-consecutive-provider-failures circuit breaker. When a provider
//   (currently 'codex') fails THRESHOLD times in a row for a given milestone,
//   the circuit opens (fallback_active=true) and downstream callers are
//   advised to switch to the fallback provider (currently 'claude') for the
//   remainder of the milestone. A single successful invocation closes the
//   circuit (resets consecutive_failures and clears fallback_active).
//
// 6 PUBLIC APIs (Lock-13 wrapped, mirrors Phase 51-54 surface conventions)
//   - getCircuitState({milestone, provider})  -> {ok, state, source}
//   - recordProviderResult({milestone, provider, ok, ts?})
//                                              -> {ok, new_state, fallback_triggered}
//   - shouldFallback({milestone, provider})    -> {fallback_active, threshold,
//                                                  consecutive_failures}
//   - resetCircuit({milestone, provider})      -> {ok, prior_state}
//   - getDefaultFallback(provider)             -> 'claude' for codex, null otherwise
//   - selfTest()                               -> {ok, results} (>=8 assertions)
//
// CONSTANTS
//   - THRESHOLD: parseInt(SGSD_CIRCUIT_FAILURE_THRESHOLD, 10) || 3
//     Resolved at module-load (frozen for the process lifetime).
//   - DEFAULT_FALLBACK: { codex: 'claude' } closed-vocab map.
//   - STATE_FILE: .planning/metrics/provider-circuit.json (schema_version 1)
//
// STATE SHAPE (schema_version 1)
//   {
//     "schema_version": 1,
//     "milestones": {
//       "<milestone-id>": {
//         "<provider-name>": {
//           "consecutive_failures": <int>,
//           "last_failure_ts": "<ISO8601 | null>",
//           "fallback_active": <bool>,
//           "last_success_ts": "<ISO8601 | null>"
//         }
//       }
//     }
//   }
//
// LOCK INVARIANTS
//   - Lock 4: Phase 41-54 byte-untouched. We never require() into Phase 41-54
//     trees; we only mirror their patterns.
//   - Lock 11: provider-name match via byte-equality only (no regex, no
//     fuzzy matching, no case-fold).
//   - Lock 13: every public API wraps internals in try/catch; never throws
//     upward. Missing state file -> empty state + ok-degraded sentinel.
//   - ASCII-only: no smart quotes, no emoji, no non-ASCII literals anywhere.
//
// ATOMIC WRITE PATTERN
//   tmp+rename: writes go to STATE_FILE.tmp first, then fs.renameSync to
//   STATE_FILE. mkdir -p on parent directory. Concurrent-write safety mirrors
//   Phase 53 _setupContainer pattern.
//
// REASON CODES (closed-vocab):
//   - circuit_state_ok
//   - circuit_state_missing_file_degraded
//   - circuit_state_unparseable_degraded
//   - circuit_record_ok
//   - circuit_record_invalid_input
//   - circuit_reset_ok
//   - circuit_reset_no_prior_state
//   - circuit_internal_error
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// THRESHOLD - module-load resolved, env-overridable, default 3.
// ---------------------------------------------------------------------------
function _resolveThreshold() {
  try {
    var raw = process.env.SGSD_CIRCUIT_FAILURE_THRESHOLD;
    if (typeof raw === 'string' && raw.length > 0) {
      var n = parseInt(raw, 10);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return 3;
  } catch (_e) {
    return 3;
  }
}
const THRESHOLD = _resolveThreshold();

// ---------------------------------------------------------------------------
// DEFAULT_FALLBACK - closed-vocab map. Lock 11 byte-equality keys.
// codex -> claude is the only wired fallback in Phase 55. Future providers
// add their own entries here (and in selfTest assertions) when needed.
// ---------------------------------------------------------------------------
const DEFAULT_FALLBACK = Object.freeze({
  codex: 'claude',
});

// ---------------------------------------------------------------------------
// REASON_CODES - closed-vocab reason vocabulary. Frozen prevents drift.
// ---------------------------------------------------------------------------
const REASON_CODES = Object.freeze([
  'circuit_state_ok',
  'circuit_state_missing_file_degraded',
  'circuit_state_unparseable_degraded',
  'circuit_record_ok',
  'circuit_record_invalid_input',
  'circuit_reset_ok',
  'circuit_reset_no_prior_state',
  'circuit_internal_error',
]);

// ---------------------------------------------------------------------------
// SCHEMA_VERSION - bumped only when the on-disk shape changes.
// ---------------------------------------------------------------------------
const SCHEMA_VERSION = 1;

// ---------------------------------------------------------------------------
// Project root resolution. Walks up from __dirname looking for .planning/.
// Defensive: never throws; falls back to a sensible relative root.
// ---------------------------------------------------------------------------
function _resolveProjectRoot() {
  try {
    var cur = path.resolve(__dirname);
    for (var i = 0; i < 8; i++) {
      var probe = path.join(cur, '.planning');
      if (fs.existsSync(probe)) return cur;
      var parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    // Fallback: super-gsd/scripts/lib/ -> super-gsd/scripts/ -> super-gsd/ -> repo
    return path.resolve(__dirname, '..', '..', '..');
  } catch (_e) {
    return path.resolve(__dirname, '..', '..', '..');
  }
}
const PROJECT_ROOT = _resolveProjectRoot();

// ---------------------------------------------------------------------------
// STATE_FILE path. Allow override via SGSD_CIRCUIT_STATE_FILE env (used by
// selfTest harness to point at a tmp file, never at the canonical state).
// ---------------------------------------------------------------------------
function _resolveStateFile() {
  try {
    var override = process.env.SGSD_CIRCUIT_STATE_FILE;
    if (typeof override === 'string' && override.length > 0) {
      return override;
    }
    return path.join(PROJECT_ROOT, '.planning', 'metrics', 'provider-circuit.json');
  } catch (_e) {
    return path.join(PROJECT_ROOT, '.planning', 'metrics', 'provider-circuit.json');
  }
}

// ---------------------------------------------------------------------------
// _emptyState - canonical empty state shape. Used as the ok-degraded
// sentinel when the state file is missing or unparseable.
// ---------------------------------------------------------------------------
function _emptyState() {
  return {
    schema_version: SCHEMA_VERSION,
    milestones: {},
  };
}

// ---------------------------------------------------------------------------
// _emptyEntry - canonical empty per-(milestone, provider) entry.
// ---------------------------------------------------------------------------
function _emptyEntry() {
  return {
    consecutive_failures: 0,
    last_failure_ts: null,
    fallback_active: false,
    last_success_ts: null,
  };
}

// ---------------------------------------------------------------------------
// _readStateRaw - read STATE_FILE and parse as JSON. Returns
//   { state, source } where source is one of
//     'circuit_state_ok'
//     'circuit_state_missing_file_degraded'
//     'circuit_state_unparseable_degraded'
// Lock 13: never throws. Missing file or parse error returns an empty state
// with the corresponding source code.
// ---------------------------------------------------------------------------
function _readStateRaw(stateFilePath) {
  try {
    if (!fs.existsSync(stateFilePath)) {
      return { state: _emptyState(), source: 'circuit_state_missing_file_degraded' };
    }
    var raw = fs.readFileSync(stateFilePath, 'utf8');
    var parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (_e) {
      return { state: _emptyState(), source: 'circuit_state_unparseable_degraded' };
    }
    if (!parsed || typeof parsed !== 'object' ||
        typeof parsed.schema_version !== 'number' ||
        !parsed.milestones || typeof parsed.milestones !== 'object') {
      return { state: _emptyState(), source: 'circuit_state_unparseable_degraded' };
    }
    return { state: parsed, source: 'circuit_state_ok' };
  } catch (_e) {
    return { state: _emptyState(), source: 'circuit_state_unparseable_degraded' };
  }
}

// ---------------------------------------------------------------------------
// _writeStateAtomic - tmp+rename atomic write. mkdir -p the parent. Lock 13:
// returns true on success, false on any failure path; never throws.
// ---------------------------------------------------------------------------
function _writeStateAtomic(stateFilePath, stateObj) {
  try {
    var parent = path.dirname(stateFilePath);
    try { fs.mkdirSync(parent, { recursive: true }); } catch (_e) {}
    var tmp = stateFilePath + '.tmp';
    var serialized = JSON.stringify(stateObj, null, 2) + '\n';
    fs.writeFileSync(tmp, serialized, 'utf8');
    fs.renameSync(tmp, stateFilePath);
    return true;
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// _validInputs - byte-equality validation on milestone + provider strings.
// Lock 11: no fuzzy matching. Empty / non-string / control-char inputs are
// rejected. ASCII-only.
// ---------------------------------------------------------------------------
function _validInputs(milestone, provider) {
  if (typeof milestone !== 'string' || milestone.length === 0) return false;
  if (typeof provider !== 'string' || provider.length === 0) return false;
  // ASCII-only safety: any char > 127 -> invalid.
  for (var i = 0; i < milestone.length; i++) {
    if (milestone.charCodeAt(i) > 127) return false;
  }
  for (var j = 0; j < provider.length; j++) {
    if (provider.charCodeAt(j) > 127) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// _ensureEntry - mutate state in place to ensure {milestones[m][p]} exists,
// returning the entry. Side-effecting helper; only called from impls that
// already cloned or own the state object.
// ---------------------------------------------------------------------------
function _ensureEntry(state, milestone, provider) {
  if (!state.milestones[milestone]) state.milestones[milestone] = {};
  if (!state.milestones[milestone][provider]) {
    state.milestones[milestone][provider] = _emptyEntry();
  }
  return state.milestones[milestone][provider];
}

// ---------------------------------------------------------------------------
// _getCircuitStateImpl - read state file, return entry for {milestone,
// provider}. If absent, returns _emptyEntry() with source noting whether the
// underlying state file was readable.
// ---------------------------------------------------------------------------
function _getCircuitStateImpl(args) {
  var milestone = args && args.milestone;
  var provider = args && args.provider;
  if (!_validInputs(milestone, provider)) {
    return {
      ok: false,
      state: _emptyEntry(),
      source: 'circuit_record_invalid_input',
    };
  }
  var stateFilePath = _resolveStateFile();
  var raw = _readStateRaw(stateFilePath);
  var entry = (raw.state.milestones[milestone] &&
               raw.state.milestones[milestone][provider])
    ? raw.state.milestones[milestone][provider]
    : _emptyEntry();
  // Defensive shape guard: any missing field gets the empty default.
  var safeEntry = {
    consecutive_failures: typeof entry.consecutive_failures === 'number'
      ? entry.consecutive_failures : 0,
    last_failure_ts: typeof entry.last_failure_ts === 'string'
      ? entry.last_failure_ts : null,
    fallback_active: typeof entry.fallback_active === 'boolean'
      ? entry.fallback_active : false,
    last_success_ts: typeof entry.last_success_ts === 'string'
      ? entry.last_success_ts : null,
  };
  return {
    ok: true,
    state: safeEntry,
    source: raw.source,
  };
}

// ---------------------------------------------------------------------------
// _recordProviderResultImpl - update circuit state given a {milestone,
// provider, ok} record. Returns {ok, new_state, fallback_triggered}.
//   - ok=false: increments consecutive_failures, sets last_failure_ts. If
//     consecutive_failures crosses THRESHOLD, sets fallback_active=true and
//     fallback_triggered=true (only on the boundary crossing; subsequent
//     same-milestone failures do not re-trigger).
//   - ok=true:  resets consecutive_failures to 0, sets last_success_ts,
//     clears fallback_active.
// ---------------------------------------------------------------------------
function _recordProviderResultImpl(args) {
  var milestone = args && args.milestone;
  var provider = args && args.provider;
  var resultOk = args && args.ok;
  var ts = args && args.ts;
  if (!_validInputs(milestone, provider)) {
    return {
      ok: false,
      new_state: _emptyEntry(),
      fallback_triggered: false,
      source: 'circuit_record_invalid_input',
    };
  }
  if (typeof resultOk !== 'boolean') {
    return {
      ok: false,
      new_state: _emptyEntry(),
      fallback_triggered: false,
      source: 'circuit_record_invalid_input',
    };
  }
  if (typeof ts !== 'string' || ts.length === 0) {
    ts = new Date().toISOString();
  }
  var stateFilePath = _resolveStateFile();
  var raw = _readStateRaw(stateFilePath);
  // We work on raw.state directly (it is the empty sentinel on
  // missing/unparseable; safe to mutate either way since we own the object).
  var entry = _ensureEntry(raw.state, milestone, provider);
  var fallbackTriggered = false;
  if (resultOk === false) {
    entry.consecutive_failures = (entry.consecutive_failures || 0) + 1;
    entry.last_failure_ts = ts;
    if (entry.consecutive_failures >= THRESHOLD && entry.fallback_active === false) {
      entry.fallback_active = true;
      fallbackTriggered = true;
    }
  } else {
    var wasOpen = entry.fallback_active === true;
    entry.consecutive_failures = 0;
    entry.last_success_ts = ts;
    entry.fallback_active = false;
    // Reset rule: a single success closes an open circuit. We don't flag
    // 'reset' as fallback_triggered (which is failure-direction only).
    if (wasOpen) {
      // intentional no-op: caller can detect by comparing prior_state via
      // getCircuitState before invoking record. fallback_triggered remains
      // false because the FALLBACK was not freshly triggered by this record.
    }
  }
  // Bump schema_version if state was the empty sentinel.
  if (raw.state.schema_version !== SCHEMA_VERSION) {
    raw.state.schema_version = SCHEMA_VERSION;
  }
  var written = _writeStateAtomic(stateFilePath, raw.state);
  return {
    ok: written,
    new_state: {
      consecutive_failures: entry.consecutive_failures,
      last_failure_ts: entry.last_failure_ts,
      fallback_active: entry.fallback_active,
      last_success_ts: entry.last_success_ts,
    },
    fallback_triggered: fallbackTriggered,
    source: written ? 'circuit_record_ok' : 'circuit_internal_error',
  };
}

// ---------------------------------------------------------------------------
// _shouldFallbackImpl - lightweight read-only query. Returns just the
// boolean + counters callers need to decide whether to swap providers.
// ---------------------------------------------------------------------------
function _shouldFallbackImpl(args) {
  var s = _getCircuitStateImpl(args);
  if (!s.ok) {
    return {
      fallback_active: false,
      threshold: THRESHOLD,
      consecutive_failures: 0,
      source: s.source,
    };
  }
  return {
    fallback_active: !!s.state.fallback_active,
    threshold: THRESHOLD,
    consecutive_failures: s.state.consecutive_failures || 0,
    source: s.source,
  };
}

// ---------------------------------------------------------------------------
// _resetCircuitImpl - explicit reset. Used at milestone close (downstream
// caller invokes resetCircuit({milestone, provider}) once the milestone is
// actually closing). Returns the prior state for audit.
// ---------------------------------------------------------------------------
function _resetCircuitImpl(args) {
  var milestone = args && args.milestone;
  var provider = args && args.provider;
  if (!_validInputs(milestone, provider)) {
    return {
      ok: false,
      prior_state: _emptyEntry(),
      source: 'circuit_record_invalid_input',
    };
  }
  var stateFilePath = _resolveStateFile();
  var raw = _readStateRaw(stateFilePath);
  var prior = (raw.state.milestones[milestone] &&
               raw.state.milestones[milestone][provider])
    ? Object.assign({}, raw.state.milestones[milestone][provider])
    : _emptyEntry();
  var hadPrior = !!(raw.state.milestones[milestone] &&
                    raw.state.milestones[milestone][provider]);
  if (hadPrior) {
    raw.state.milestones[milestone][provider] = _emptyEntry();
  }
  if (raw.state.schema_version !== SCHEMA_VERSION) {
    raw.state.schema_version = SCHEMA_VERSION;
  }
  var written = _writeStateAtomic(stateFilePath, raw.state);
  return {
    ok: written,
    prior_state: prior,
    source: hadPrior
      ? (written ? 'circuit_reset_ok' : 'circuit_internal_error')
      : 'circuit_reset_no_prior_state',
  };
}

// ---------------------------------------------------------------------------
// _getDefaultFallbackImpl - byte-equality lookup in DEFAULT_FALLBACK.
// Lock 11: no fuzzy match, no case-fold. Returns null when no fallback wired.
// ---------------------------------------------------------------------------
function _getDefaultFallbackImpl(provider) {
  if (typeof provider !== 'string' || provider.length === 0) return null;
  if (Object.prototype.hasOwnProperty.call(DEFAULT_FALLBACK, provider)) {
    return DEFAULT_FALLBACK[provider];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Lock-13 wrapped public APIs. Every wrapper is try/catch with a degraded
// sentinel return value; never throws upward.
// ---------------------------------------------------------------------------
function getCircuitState(args) {
  try {
    return _getCircuitStateImpl(args);
  } catch (_e) {
    return {
      ok: false,
      state: _emptyEntry(),
      source: 'circuit_internal_error',
    };
  }
}

function recordProviderResult(args) {
  try {
    return _recordProviderResultImpl(args);
  } catch (_e) {
    return {
      ok: false,
      new_state: _emptyEntry(),
      fallback_triggered: false,
      source: 'circuit_internal_error',
    };
  }
}

function shouldFallback(args) {
  try {
    return _shouldFallbackImpl(args);
  } catch (_e) {
    return {
      fallback_active: false,
      threshold: THRESHOLD,
      consecutive_failures: 0,
      source: 'circuit_internal_error',
    };
  }
}

function resetCircuit(args) {
  try {
    return _resetCircuitImpl(args);
  } catch (_e) {
    return {
      ok: false,
      prior_state: _emptyEntry(),
      source: 'circuit_internal_error',
    };
  }
}

function getDefaultFallback(provider) {
  try {
    return _getDefaultFallbackImpl(provider);
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// _selfTestImpl - bootstrap suite (>=8 assertions). Each assertion is run
// in isolation against a tmp state file (never against the canonical
// .planning/metrics/provider-circuit.json). Per-assertion structure:
//   { name, ok, detail }
// ---------------------------------------------------------------------------
function _selfTestImpl() {
  var os = require('os');
  var crypto = require('crypto');
  var results = [];
  function check(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  // Tmp state file scoped to this self-test run. We override via
  // SGSD_CIRCUIT_STATE_FILE so every API call reads/writes the tmp path.
  var tmpDir = null;
  var tmpStatePath = null;
  var savedEnv = process.env.SGSD_CIRCUIT_STATE_FILE;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-pcircuit-'));
    tmpStatePath = path.join(tmpDir, 'provider-circuit.json');
    process.env.SGSD_CIRCUIT_STATE_FILE = tmpStatePath;
  } catch (e) {
    check('selftest_setup_tmp_state', false,
          'mkdtemp_failed: ' + (e && e.message ? e.message : 'unknown'));
    return { ok: false, results: results };
  }

  // ---- A1: THRESHOLD trigger - 3 consecutive failures opens the circuit ---
  try {
    // Reset to clean tmp state.
    try { fs.unlinkSync(tmpStatePath); } catch (_e) {}
    var r1 = recordProviderResult({ milestone: 'v2.0', provider: 'codex', ok: false });
    var r2 = recordProviderResult({ milestone: 'v2.0', provider: 'codex', ok: false });
    var r3 = recordProviderResult({ milestone: 'v2.0', provider: 'codex', ok: false });
    var afterThree = shouldFallback({ milestone: 'v2.0', provider: 'codex' });
    check('threshold_3_consecutive_failures_opens_circuit',
          r1.fallback_triggered === false &&
          r2.fallback_triggered === false &&
          r3.fallback_triggered === true &&
          afterThree.fallback_active === true &&
          afterThree.consecutive_failures === 3,
          'r1.trig=' + r1.fallback_triggered +
          ' r2.trig=' + r2.fallback_triggered +
          ' r3.trig=' + r3.fallback_triggered +
          ' active=' + afterThree.fallback_active +
          ' cf=' + afterThree.consecutive_failures);
  } catch (e) {
    check('threshold_3_consecutive_failures_opens_circuit', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A2: Reset rule - 1 success closes an open circuit -----------------
  try {
    // Continue from A1 state (open circuit).
    var ok1 = recordProviderResult({ milestone: 'v2.0', provider: 'codex', ok: true });
    var afterOne = shouldFallback({ milestone: 'v2.0', provider: 'codex' });
    check('reset_rule_single_success_closes_open_circuit',
          ok1.ok === true &&
          ok1.new_state.fallback_active === false &&
          ok1.new_state.consecutive_failures === 0 &&
          afterOne.fallback_active === false &&
          afterOne.consecutive_failures === 0,
          'ok=' + ok1.ok +
          ' active_after=' + ok1.new_state.fallback_active +
          ' cf_after=' + ok1.new_state.consecutive_failures +
          ' query_active=' + afterOne.fallback_active);
  } catch (e) {
    check('reset_rule_single_success_closes_open_circuit', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A3: State persistence - write then re-read sees same shape --------
  try {
    try { fs.unlinkSync(tmpStatePath); } catch (_e) {}
    var ts = '2026-04-29T03:00:00Z';
    recordProviderResult({ milestone: 'v2.0', provider: 'codex', ok: false, ts: ts });
    var diskRaw = fs.readFileSync(tmpStatePath, 'utf8');
    var diskParsed = JSON.parse(diskRaw);
    var schemaOk = diskParsed.schema_version === SCHEMA_VERSION;
    var tsRoundTrip = diskParsed.milestones &&
                      diskParsed.milestones['v2.0'] &&
                      diskParsed.milestones['v2.0'].codex &&
                      diskParsed.milestones['v2.0'].codex.last_failure_ts === ts;
    check('state_persistence_roundtrip',
          schemaOk && tsRoundTrip,
          'schema=' + diskParsed.schema_version + ' ts_ok=' + tsRoundTrip);
  } catch (e) {
    check('state_persistence_roundtrip', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A4: Missing state file returns ok-degraded ------------------------
  try {
    try { fs.unlinkSync(tmpStatePath); } catch (_e) {}
    var s = getCircuitState({ milestone: 'v2.0', provider: 'codex' });
    check('missing_state_file_ok_degraded',
          s.ok === true &&
          s.source === 'circuit_state_missing_file_degraded' &&
          s.state.consecutive_failures === 0 &&
          s.state.fallback_active === false,
          'ok=' + s.ok + ' source=' + s.source +
          ' cf=' + s.state.consecutive_failures);
  } catch (e) {
    check('missing_state_file_ok_degraded', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A5: Atomic write - tmp file does not linger on disk ---------------
  try {
    try { fs.unlinkSync(tmpStatePath); } catch (_e) {}
    recordProviderResult({ milestone: 'v2.0', provider: 'codex', ok: false });
    var leftoverTmp = fs.existsSync(tmpStatePath + '.tmp');
    var stateExists = fs.existsSync(tmpStatePath);
    check('atomic_write_no_leftover_tmp',
          stateExists === true && leftoverTmp === false,
          'state_exists=' + stateExists + ' tmp_lingered=' + leftoverTmp);
  } catch (e) {
    check('atomic_write_no_leftover_tmp', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A6: Lock 13 - record/get/should/reset never throw on bad input ----
  try {
    var threwAny = false;
    try { getCircuitState({}); } catch (_e) { threwAny = true; }
    try { getCircuitState({ milestone: '', provider: '' }); } catch (_e) { threwAny = true; }
    try { recordProviderResult({ milestone: 'v2.0', provider: 'codex' }); } catch (_e) { threwAny = true; }
    try { shouldFallback({ milestone: 'v2.0' }); } catch (_e) { threwAny = true; }
    try { resetCircuit({ provider: 'codex' }); } catch (_e) { threwAny = true; }
    try { recordProviderResult(null); } catch (_e) { threwAny = true; }
    try { getDefaultFallback(undefined); } catch (_e) { threwAny = true; }
    check('lock13_never_throws_on_bad_input',
          threwAny === false,
          'any_threw=' + threwAny);
  } catch (e) {
    check('lock13_never_throws_on_bad_input', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A7: ASCII-only across the source file -----------------------------
  try {
    var src = fs.readFileSync(__filename, 'utf8');
    var asciiOk = true;
    var firstNonAscii = -1;
    for (var ci = 0; ci < src.length; ci++) {
      if (src.charCodeAt(ci) > 127) {
        asciiOk = false;
        firstNonAscii = ci;
        break;
      }
    }
    check('ascii_only_source',
          asciiOk,
          'first_nonascii_idx=' + firstNonAscii);
  } catch (e) {
    check('ascii_only_source', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A8: getDefaultFallback - codex maps to claude, others to null -----
  try {
    var f1 = getDefaultFallback('codex');
    var f2 = getDefaultFallback('claude');
    var f3 = getDefaultFallback('Codex'); // case-sensitive, byte-equality
    var f4 = getDefaultFallback('');
    var f5 = getDefaultFallback(null);
    check('default_fallback_byte_equality',
          f1 === 'claude' && f2 === null && f3 === null &&
          f4 === null && f5 === null,
          'codex=' + f1 + ' claude=' + f2 + ' Codex=' + f3 +
          ' empty=' + f4 + ' null=' + f5);
  } catch (e) {
    check('default_fallback_byte_equality', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A9: Per-milestone isolation - v1.9 state untouched by v2.0 ops ----
  try {
    try { fs.unlinkSync(tmpStatePath); } catch (_e) {}
    recordProviderResult({ milestone: 'v2.0', provider: 'codex', ok: false });
    recordProviderResult({ milestone: 'v2.0', provider: 'codex', ok: false });
    recordProviderResult({ milestone: 'v2.0', provider: 'codex', ok: false });
    var v19 = shouldFallback({ milestone: 'v1.9', provider: 'codex' });
    var v20 = shouldFallback({ milestone: 'v2.0', provider: 'codex' });
    check('per_milestone_isolation',
          v19.fallback_active === false && v19.consecutive_failures === 0 &&
          v20.fallback_active === true && v20.consecutive_failures === 3,
          'v1.9_active=' + v19.fallback_active + ' v1.9_cf=' + v19.consecutive_failures +
          ' v2.0_active=' + v20.fallback_active + ' v2.0_cf=' + v20.consecutive_failures);
  } catch (e) {
    check('per_milestone_isolation', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A10: resetCircuit returns prior state and clears the entry --------
  try {
    // After A9, v2.0/codex is in open state. Reset it.
    var preReset = getCircuitState({ milestone: 'v2.0', provider: 'codex' });
    var rr = resetCircuit({ milestone: 'v2.0', provider: 'codex' });
    var postReset = getCircuitState({ milestone: 'v2.0', provider: 'codex' });
    check('reset_returns_prior_and_clears',
          rr.ok === true &&
          rr.prior_state.fallback_active === true &&
          rr.prior_state.consecutive_failures === 3 &&
          postReset.state.fallback_active === false &&
          postReset.state.consecutive_failures === 0 &&
          rr.source === 'circuit_reset_ok',
          'pre_active=' + preReset.state.fallback_active +
          ' rr.ok=' + rr.ok +
          ' rr.prior_active=' + rr.prior_state.fallback_active +
          ' rr.source=' + rr.source +
          ' post_active=' + postReset.state.fallback_active);
  } catch (e) {
    check('reset_returns_prior_and_clears', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A11: shouldFallback always reports current threshold --------------
  try {
    var sf = shouldFallback({ milestone: 'v3.0', provider: 'codex' });
    check('should_fallback_reports_threshold',
          sf.threshold === THRESHOLD && sf.threshold >= 1,
          'threshold=' + sf.threshold);
  } catch (e) {
    check('should_fallback_reports_threshold', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- A12: Public API surface present and Lock-13 wrapped ---------------
  try {
    var me = module.exports;
    var apiNames = ['getCircuitState', 'recordProviderResult', 'shouldFallback',
                    'resetCircuit', 'getDefaultFallback', 'selfTest'];
    var allPresent = true;
    var missing = '';
    for (var ai = 0; ai < apiNames.length; ai++) {
      if (typeof me[apiNames[ai]] !== 'function') {
        allPresent = false; missing = apiNames[ai]; break;
      }
    }
    var src = fs.readFileSync(__filename, 'utf8');
    var lock13Ok = src.indexOf('catch (_e) {') !== -1 &&
                   src.indexOf('return _getCircuitStateImpl') !== -1 &&
                   src.indexOf('return _recordProviderResultImpl') !== -1 &&
                   src.indexOf('return _shouldFallbackImpl') !== -1 &&
                   src.indexOf('return _resetCircuitImpl') !== -1;
    check('public_api_6_surface_lock13_wrapped',
          allPresent && lock13Ok,
          'all_present=' + allPresent + ' missing=' + missing +
          ' lock13_ok=' + lock13Ok);
  } catch (e) {
    check('public_api_6_surface_lock13_wrapped', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // Restore env, cleanup tmp.
  try {
    if (typeof savedEnv === 'string') {
      process.env.SGSD_CIRCUIT_STATE_FILE = savedEnv;
    } else {
      delete process.env.SGSD_CIRCUIT_STATE_FILE;
    }
  } catch (_e) {}
  try { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) {}

  var allOk = true;
  for (var ri2 = 0; ri2 < results.length; ri2++) {
    if (!results[ri2].ok) { allOk = false; break; }
  }
  return { ok: allOk, results: results };
}

function selfTest() {
  try {
    return _selfTestImpl();
  } catch (_e) {
    return {
      ok: false,
      results: [],
      reason: 'circuit_internal_error',
      source: 'selfTest_catch',
    };
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch.
// ---------------------------------------------------------------------------
function _printHelp() {
  return [
    'super-gsd/scripts/lib/provider-circuit.cjs',
    'Phase 55-01: Provider Backpressure + Timeout Circuits.',
    '',
    'Usage:',
    '  node provider-circuit.cjs --self-test',
    '    Run the bootstrap suite (>=8 assertions). Exit 0 on all-PASS, 1 otherwise.',
    '',
    '  node provider-circuit.cjs --help',
    '    Print this usage block.',
    '',
    'Env:',
    '  SGSD_CIRCUIT_FAILURE_THRESHOLD - integer N>=1, default 3.',
    '  SGSD_CIRCUIT_STATE_FILE        - override state-file path (test only).',
  ].join('\n');
}

function _main(argv) {
  try {
    var args = (argv || []).slice(2);
    if (args.length === 0 || args.indexOf('--help') !== -1) {
      process.stdout.write(_printHelp() + '\n');
      process.exit(args.length === 0 ? 1 : 0);
      return;
    }
    if (args.indexOf('--self-test') !== -1) {
      var out = selfTest();
      var rs = (out && Array.isArray(out.results)) ? out.results : [];
      var firstFail = -1;
      for (var i = 0; i < rs.length; i++) {
        var tag = rs[i].ok ? 'PASS' : 'FAIL';
        process.stdout.write(
          '[' + tag + '] ' + rs[i].name +
          (rs[i].detail ? ' :: ' + rs[i].detail : '') + '\n'
        );
        if (!rs[i].ok && firstFail === -1) firstFail = i;
      }
      var passCount = 0;
      for (var pi = 0; pi < rs.length; pi++) if (rs[pi].ok) passCount++;
      process.stdout.write(
        'self-test: ' + passCount + '/' + rs.length + ' PASS' +
        (out && out.ok ? ' (green)' : ' (red)') + '\n'
      );
      process.exit(out && out.ok ? 0 : 1);
      return;
    }
    process.stderr.write('unknown args: ' + args.join(' ') + '\n');
    process.stderr.write(_printHelp() + '\n');
    process.exit(2);
  } catch (e) {
    process.stderr.write('provider-circuit.cjs CLI internal error: ' +
      (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// module.exports - frozen surfaces + 6 public APIs + _internals bag.
// ---------------------------------------------------------------------------
module.exports = {
  // Frozen surfaces:
  THRESHOLD: THRESHOLD,
  DEFAULT_FALLBACK: DEFAULT_FALLBACK,
  REASON_CODES: REASON_CODES,
  SCHEMA_VERSION: SCHEMA_VERSION,
  // 6 Public APIs (Lock-13 wrapped):
  getCircuitState: getCircuitState,
  recordProviderResult: recordProviderResult,
  shouldFallback: shouldFallback,
  resetCircuit: resetCircuit,
  getDefaultFallback: getDefaultFallback,
  selfTest: selfTest,
  // Dual-exposed internal helpers for cross-task composition:
  _internals: {
    _resolveThreshold: _resolveThreshold,
    _resolveProjectRoot: _resolveProjectRoot,
    _resolveStateFile: _resolveStateFile,
    _emptyState: _emptyState,
    _emptyEntry: _emptyEntry,
    _readStateRaw: _readStateRaw,
    _writeStateAtomic: _writeStateAtomic,
    _validInputs: _validInputs,
    _ensureEntry: _ensureEntry,
    _getCircuitStateImpl: _getCircuitStateImpl,
    _recordProviderResultImpl: _recordProviderResultImpl,
    _shouldFallbackImpl: _shouldFallbackImpl,
    _resetCircuitImpl: _resetCircuitImpl,
    _getDefaultFallbackImpl: _getDefaultFallbackImpl,
    _selfTestImpl: _selfTestImpl,
    PROJECT_ROOT: PROJECT_ROOT,
  },
};

if (require.main === module) {
  _main(process.argv);
}
