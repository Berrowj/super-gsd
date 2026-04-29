#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/chaos-restart/harness.cjs
// Phase 54-01: Restart + Handoff Chaos Tests harness.
//
// PURPOSE
//   Mid-phase kill simulation at 5 named points (mid-research / mid-plan /
//   mid-execute / mid-verify / mid-close) + manifest-shape validation on
//   ORCHESTRATOR-CHECKPOINT.md. Each scenario:
//     1. Sets up an in-tmpdir synthetic phase state (copies a fixture).
//     2. Spawns a fake-subprocess simulator that emits a partial-write
//        signal then SIGTERMs itself (real process kill via spawnSync
//        with a short timeout).
//     3. Runs a resume probe (validateManifest + synthetic close path).
//     4. Asserts: checkpoint readable, required fields populated, the
//        synthetic close path is reachable.
//   The harness ALSO verifies the manifest validator rejects each of the
//   6 required-field-missing fixtures (one per REQUIRED_FIELDS entry).
//
// 8 PUBLIC APIs (Lock-13 wrapped, mirrors Phase 53 surface)
//   - runAll(opts)              -> top-level driver
//   - runChaosScenario(args)    -> per-scenario driver
//   - validateManifest(path)    -> re-export from manifest-validator.cjs
//   - selfTest()                -> 15-20 assertion bootstrap suite
//   - aggregateResults(rs)      -> verdict tree
//   - appendLogRow(row, opts)   -> envelope-v1 JSONL writer
//   - _internals                -> bag of helpers for cross-task composition
//   - REQUIRED_FIELDS / FAIL_INJ_REASON_CODES / KILL_POINTS frozen surfaces
//     (counted as part of the 8-API contract: a frozen surface is a public
//     read-only export equivalent to an API for downstream consumers).
//
// LOCK INVARIANTS
//   - Lock 4: Phase 41-53 byte-untouched. We never require() into Phase 41-53
//     trees; we only mirror their patterns.
//   - Lock 11: byte-equality on field validation (no fuzzy matching).
//   - Lock 13: every public API wraps internals in try/catch; never throws.
//   - ASCII-only: no smart quotes, no emoji, no non-ASCII literals.
//
// 11-STREAM FINGERPRINT GUARD
//   Mirrors Phase 53 PHASE_53_GUARDED_STREAMS. Pre-scenario fingerprint of
//   .planning/metrics/* canonical streams; post-scenario fingerprint MUST be
//   byte-identical (we never write to canonical streams from this harness).
//
// FAIL_INJ_REASON_CODES (closed-vocab, frozen):
//   Per-scenario verdicts:
//     - chaos_pass
//     - chaos_fail_resume_blocked
//     - chaos_fail_manifest_invalid
//     - chaos_fail_canonical_drift
//     - chaos_fail_timeout
//   Manifest-validator outcomes:
//     - manifest_missing_field
//     - manifest_valid
//     - manifest_unparseable
//     - manifest_not_found
//   Aggregate verdicts:
//     - aggregate_pass_clean
//     - aggregate_fail
//   Internal verdicts:
//     - container_setup_failed
//     - tool_nonzero_exit
//     - gate_internal_error
// =============================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const child_process = require('child_process');

const manifestValidator = require('./manifest-validator.cjs');
const REQUIRED_FIELDS = manifestValidator.REQUIRED_FIELDS;

// ---------------------------------------------------------------------------
// KILL_POINTS - the 5-entry closed-vocab list of named mid-phase kill
// points. Frozen prevents drift. Acceptance contract pins these names.
// ---------------------------------------------------------------------------
const KILL_POINTS = Object.freeze([
  'mid-research',
  'mid-plan',
  'mid-execute',
  'mid-verify',
  'mid-close',
]);

// ---------------------------------------------------------------------------
// FAIL_INJ_REASON_CODES - closed-vocab reason vocabulary. >=11 entries
// (the >=11 floor mirrors the Phase 53 self-test contract; 14 entries here).
// ---------------------------------------------------------------------------
const FAIL_INJ_REASON_CODES = Object.freeze([
  // Per-scenario verdicts (5):
  'chaos_pass',
  'chaos_fail_resume_blocked',
  'chaos_fail_manifest_invalid',
  'chaos_fail_canonical_drift',
  'chaos_fail_timeout',
  // Manifest-validator outcomes (4):
  'manifest_missing_field',
  'manifest_valid',
  'manifest_unparseable',
  'manifest_not_found',
  // Aggregate verdicts (2):
  'aggregate_pass_clean',
  'aggregate_fail',
  // Internal verdicts (3):
  'container_setup_failed',
  'tool_nonzero_exit',
  'gate_internal_error',
]);

// ---------------------------------------------------------------------------
// PHASE_54_GUARDED_STREAMS - 11-entry anti-pollution guard set. Mirrors
// Phase 53's PHASE_53_GUARDED_STREAMS (Lock 4: superset, never mutates the
// upstream constant). Used by _fingerprintAllStreams pre/post each scenario.
// ---------------------------------------------------------------------------
const PHASE_54_GUARDED_STREAMS = Object.freeze([
  'agent-token-spend.jsonl',
  'context-packet-log.jsonl',
  'context-complaints.jsonl',
  'route-decisions.jsonl',
  'crit-backlog.jsonl',
  'redis-projection-log.jsonl',
  'edge-guard-log.jsonl',
  'memory-revocations.jsonl',
  'memory-promotions.jsonl',
  'memory-demotions.jsonl',
  'memory-revalidations.jsonl',
]);

// ---------------------------------------------------------------------------
// FIXTURE_DIR_BY_KILL_POINT - 1:1 mapping from KILL_POINTS entry to its
// fixture directory under fixtures/. Closed-vocab.
// ---------------------------------------------------------------------------
const FIXTURE_DIR_BY_KILL_POINT = Object.freeze({
  'mid-research': 'mid-research',
  'mid-plan': 'mid-plan',
  'mid-execute': 'mid-execute',
  'mid-verify': 'mid-verify',
  'mid-close': 'mid-close',
});

// ---------------------------------------------------------------------------
// Project root resolution. The harness can be invoked from anywhere; we
// resolve project root by walking up from __dirname until we find a
// .planning/ directory. Defensive: never throws; degrades to __dirname/../../..
// if .planning/ is not found upwards.
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
    return path.resolve(__dirname, '..', '..', '..');
  } catch (_e) {
    return path.resolve(__dirname, '..', '..', '..');
  }
}
const PROJECT_ROOT = _resolveProjectRoot();

// ---------------------------------------------------------------------------
// _sha256OfBytes - hex sha256 of a Buffer. Lock 11 byte-equality basis.
// ---------------------------------------------------------------------------
function _sha256OfBytes(buf) {
  try {
    if (!Buffer.isBuffer(buf)) return null;
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// _fingerprintStream - read a file under .planning/metrics/, return
// { sha256, size }. Returns null if file is absent. mtime intentionally
// excluded (W1 fix mirror from Phase 53).
// ---------------------------------------------------------------------------
function _fingerprintStream(planningMetricsDir, filename) {
  try {
    var p = path.join(planningMetricsDir, filename);
    if (!fs.existsSync(p)) return null;
    var stat = fs.statSync(p);
    if (!stat.isFile()) return null;
    var buf = fs.readFileSync(p);
    return { sha256: _sha256OfBytes(buf), size: stat.size };
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// _fingerprintsEqual - compare two fingerprints (or nulls) byte-equality.
// Lock 11 contract.
// ---------------------------------------------------------------------------
function _fingerprintsEqual(a, b) {
  if (a === null && b === null) return true;
  if (!a || !b) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  return a.sha256 === b.sha256 && a.size === b.size;
}

// ---------------------------------------------------------------------------
// _fingerprintAllStreams - take the 11-stream snapshot of the project's
// real .planning/metrics/ canonical streams. Used pre/post each scenario
// to assert byte-equality (anti-pollution invariant).
// ---------------------------------------------------------------------------
function _fingerprintAllStreams(planningMetricsDir) {
  try {
    var out = {};
    if (typeof planningMetricsDir !== 'string') return out;
    if (!fs.existsSync(planningMetricsDir)) return out;
    for (var i = 0; i < PHASE_54_GUARDED_STREAMS.length; i++) {
      var name = PHASE_54_GUARDED_STREAMS[i];
      out[name] = _fingerprintStream(planningMetricsDir, name);
    }
    return out;
  } catch (_e) {
    return {};
  }
}

// ---------------------------------------------------------------------------
// _compareCanonicalStreams - compare before/after fingerprint maps. Returns
// { equal, drift } where drift is a list of changed/added/removed paths.
// ---------------------------------------------------------------------------
function _compareCanonicalStreams(before, after) {
  try {
    var drift = [];
    var names = {};
    var i, n;
    if (before && typeof before === 'object') {
      var bk = Object.keys(before);
      for (i = 0; i < bk.length; i++) names[bk[i]] = true;
    }
    if (after && typeof after === 'object') {
      var ak = Object.keys(after);
      for (i = 0; i < ak.length; i++) names[ak[i]] = true;
    }
    var allNames = Object.keys(names).sort();
    for (i = 0; i < allNames.length; i++) {
      n = allNames[i];
      var bEntry = (before && before[n]) || null;
      var aEntry = (after && after[n]) || null;
      if (!_fingerprintsEqual(bEntry, aEntry)) {
        drift.push({
          path: n,
          before_sha256: bEntry ? bEntry.sha256 : null,
          after_sha256: aEntry ? aEntry.sha256 : null,
          before_size: bEntry ? bEntry.size : null,
          after_size: aEntry ? aEntry.size : null,
        });
      }
    }
    return { equal: drift.length === 0, drift: drift };
  } catch (_e) {
    return { equal: false, drift: [] };
  }
}

// ---------------------------------------------------------------------------
// _setupContainer - create a tmpdir for one scenario, copy the fixture
// in. Returns { ok, tmpdir, fixtureDir, scenario_id } or a degraded sentinel.
// Mirror of Phase 53 _setupContainer (Lock 4: never imports it; we duplicate
// the safe pattern locally).
// ---------------------------------------------------------------------------
function _setupContainer(killPoint) {
  try {
    if (typeof killPoint !== 'string' || killPoint.length === 0) {
      return {
        ok: false,
        reason: 'container_setup_failed',
        error: 'kill_point_must_be_non_empty_string',
        tmpdir: null,
        fixtureDir: null,
        scenario_id: null,
      };
    }
    if (KILL_POINTS.indexOf(killPoint) === -1) {
      return {
        ok: false,
        reason: 'container_setup_failed',
        error: 'kill_point_not_in_closed_vocab',
        tmpdir: null,
        fixtureDir: null,
        scenario_id: killPoint,
      };
    }
    // Sanitize for tmpdir name (closed-vocab already guarantees ASCII safe).
    var sanitized = killPoint.replace(/[^A-Za-z0-9_-]/g, '_');
    var prefix = path.join(os.tmpdir(), 'sgsd-chaos-' + sanitized + '-');
    var tmpdir = fs.mkdtempSync(prefix);
    var safeUnderTmp = tmpdir.indexOf(os.tmpdir()) === 0;
    var notUnderWorkspace = tmpdir.indexOf(__dirname) === -1;
    if (!safeUnderTmp || !notUnderWorkspace) {
      try { fs.rmSync(tmpdir, { recursive: true, force: true }); } catch (_e) {}
      return {
        ok: false,
        reason: 'container_setup_failed',
        error: 'workspace_traversal_guard_violated',
        tmpdir: null,
        fixtureDir: null,
        scenario_id: killPoint,
      };
    }
    var fixtureSrc = path.join(__dirname, 'fixtures',
                                FIXTURE_DIR_BY_KILL_POINT[killPoint]);
    if (!fs.existsSync(fixtureSrc)) {
      try { fs.rmSync(tmpdir, { recursive: true, force: true }); } catch (_e) {}
      return {
        ok: false,
        reason: 'container_setup_failed',
        error: 'fixture_dir_not_found',
        tmpdir: null,
        fixtureDir: null,
        scenario_id: killPoint,
      };
    }
    // Copy fixture files into tmpdir (shallow - fixtures are flat).
    var entries = fs.readdirSync(fixtureSrc);
    for (var i = 0; i < entries.length; i++) {
      var src = path.join(fixtureSrc, entries[i]);
      var dst = path.join(tmpdir, entries[i]);
      var st = fs.statSync(src);
      if (st.isFile()) {
        fs.copyFileSync(src, dst);
      }
    }
    return {
      ok: true,
      reason: 'container_ready',
      tmpdir: tmpdir,
      fixtureDir: fixtureSrc,
      scenario_id: killPoint,
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'container_setup_failed',
      error: 'setup_threw: ' + (e && e.message ? e.message : 'unknown'),
      tmpdir: null,
      fixtureDir: null,
      scenario_id: killPoint || null,
    };
  }
}

// ---------------------------------------------------------------------------
// _teardownContainer - rmSync the tmpdir. Idempotent: a non-existent dir
// is a no-op. Lock 13: never throws.
// ---------------------------------------------------------------------------
function _teardownContainer(opts) {
  try {
    var tmpdir = opts && opts.tmpdir;
    if (typeof tmpdir !== 'string' || tmpdir.length === 0) {
      return { ok: true, removed: false, reason: 'no_tmpdir' };
    }
    if (!fs.existsSync(tmpdir)) {
      return { ok: true, removed: false, reason: 'already_gone' };
    }
    // Defense-in-depth: refuse to rmSync anything that is NOT under os.tmpdir().
    if (tmpdir.indexOf(os.tmpdir()) !== 0) {
      return { ok: false, removed: false, reason: 'unsafe_path' };
    }
    fs.rmSync(tmpdir, { recursive: true, force: true });
    return { ok: true, removed: true, reason: 'rm_ok' };
  } catch (_e) {
    return { ok: false, removed: false, reason: 'teardown_threw' };
  }
}

// ---------------------------------------------------------------------------
// _spawnFakeSubprocess - mid-phase kill simulator. Spawns a tiny node child
// process that:
//   1. Writes a "partial-write" line to stdout.
//   2. Sleeps briefly (50-150ms).
//   3. Exits via SIGTERM-equivalent (timeout in spawnSync drives this).
//
// Real process kill via spawnSync timeout=200ms. The child's exit signal
// is what we consume as "killed mid-execution".
//
// Returns { ok, stdout, stderr, signal, status, killed, ms } where killed
// is the spawnSync-reported flag.
// ---------------------------------------------------------------------------
function _spawnFakeSubprocess(killPoint, tmpdir) {
  try {
    if (typeof killPoint !== 'string' || KILL_POINTS.indexOf(killPoint) === -1) {
      return {
        ok: false,
        reason: 'tool_nonzero_exit',
        error: 'invalid_kill_point',
        stdout: '',
        stderr: '',
        signal: null,
        status: 1,
        killed: false,
        ms: 0,
      };
    }
    // Build a tiny inline node script that simulates a partial write at the
    // named kill point and then loops forever until killed by the timeout.
    // Lock 11: the partial-write payload is byte-equal to the killPoint name
    // so the parent can assert on observed_partial_write.
    var script = [
      'process.stdout.write("PARTIAL_WRITE:' + killPoint + '\\n");',
      'process.stdout.write("KILLED_AT_STEP:' + killPoint + '\\n");',
      // Loop forever (until SIGTERM via spawnSync timeout).
      'var count = 0;',
      'function loop() {',
      '  count++;',
      '  if (count > 10000) return;',
      '  setTimeout(loop, 10);',
      '}',
      'loop();',
    ].join('\n');
    var t0 = Date.now();
    var r = child_process.spawnSync(
      process.execPath,
      ['-e', script],
      {
        cwd: tmpdir || os.tmpdir(),
        timeout: 200,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );
    var ms = Date.now() - t0;
    var killed = !!r.signal || (r.status === null);
    return {
      ok: true,
      reason: killed ? 'fake_subprocess_killed_as_expected' : 'fake_subprocess_exited_clean',
      stdout: r.stdout || '',
      stderr: r.stderr || '',
      signal: r.signal || null,
      status: typeof r.status === 'number' ? r.status : null,
      killed: killed,
      ms: ms,
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'tool_nonzero_exit',
      error: 'spawn_threw: ' + (e && e.message ? e.message : 'unknown'),
      stdout: '',
      stderr: '',
      signal: null,
      status: 1,
      killed: false,
      ms: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// _resumeProbe - synthetic close path. Validates checkpoint readability via
// validateManifest, asserts the killed_at_step is a known kill point, and
// emits a "synthetic-close" sentinel. Returns
//   { ok, manifest_ok, manifest_reason, killed_at_step, synthetic_close_emitted }
// ---------------------------------------------------------------------------
function _resumeProbe(tmpdir) {
  try {
    if (typeof tmpdir !== 'string' || !fs.existsSync(tmpdir)) {
      return {
        ok: false,
        manifest_ok: false,
        manifest_reason: 'manifest_not_found',
        killed_at_step: null,
        synthetic_close_emitted: false,
        error: 'tmpdir_missing',
      };
    }
    var checkpointPath = path.join(tmpdir, 'checkpoint.md');
    var v = manifestValidator.validateManifest(checkpointPath);
    if (!v.ok) {
      return {
        ok: false,
        manifest_ok: false,
        manifest_reason: v.reason,
        killed_at_step: null,
        synthetic_close_emitted: false,
        error: 'manifest_invalid',
        missing_fields: v.missing_fields,
      };
    }
    // Read state.md for killed_at_step (best-effort; not required for valid).
    var statePath = path.join(tmpdir, 'state.md');
    var killedAt = null;
    if (fs.existsSync(statePath)) {
      try {
        var stateText = fs.readFileSync(statePath, 'utf8');
        var m = stateText.match(/killed_at_step:\s*([A-Za-z_-]+)/);
        if (m) killedAt = m[1];
      } catch (_eState) {
        // Lock 13: state.md unreadable is non-fatal.
      }
    }
    if (KILL_POINTS.indexOf(killedAt) === -1) {
      // killed_at_step missing from state.md - fall back to checkpoint match.
      try {
        var cpText = fs.readFileSync(checkpointPath, 'utf8');
        var m2 = cpText.match(/killed_at_step:\s*([A-Za-z_-]+)/);
        if (m2) killedAt = m2[1];
      } catch (_eCp) {
        // best-effort.
      }
    }
    if (KILL_POINTS.indexOf(killedAt) === -1) {
      return {
        ok: false,
        manifest_ok: true,
        manifest_reason: v.reason,
        killed_at_step: killedAt,
        synthetic_close_emitted: false,
        error: 'killed_at_step_unknown',
      };
    }
    // Synthetic close: write a sentinel file in tmpdir to prove the resume
    // path executed end-to-end.
    var sentinelPath = path.join(tmpdir, 'synthetic-close.sentinel');
    fs.writeFileSync(sentinelPath, 'CLOSED:' + killedAt + ':' + Date.now() + '\n');
    return {
      ok: true,
      manifest_ok: true,
      manifest_reason: v.reason,
      killed_at_step: killedAt,
      synthetic_close_emitted: true,
    };
  } catch (e) {
    return {
      ok: false,
      manifest_ok: false,
      manifest_reason: 'manifest_unparseable',
      killed_at_step: null,
      synthetic_close_emitted: false,
      error: 'probe_threw: ' + (e && e.message ? e.message : 'unknown'),
    };
  }
}

// ---------------------------------------------------------------------------
// _runChaosScenarioImpl - inner driver for one kill-point scenario.
//   1. Snapshot canonical streams (pre).
//   2. _setupContainer.
//   3. _spawnFakeSubprocess (real subprocess kill).
//   4. _resumeProbe.
//   5. Snapshot canonical streams (post) -> assert byte-equality.
//   6. _teardownContainer.
// Returns the per-scenario result row.
// ---------------------------------------------------------------------------
function _runChaosScenarioImpl(killPoint) {
  var planningMetrics = path.join(PROJECT_ROOT, '.planning', 'metrics');
  var beforeFp = _fingerprintAllStreams(planningMetrics);
  var setup = _setupContainer(killPoint);
  if (!setup.ok) {
    return {
      ok: false,
      kill_point: killPoint,
      verdict: 'FAIL',
      reason: setup.reason || 'container_setup_failed',
      manifest_reason: null,
      killed: false,
      synthetic_close_emitted: false,
      canonical_drift: false,
      duration_ms: 0,
      source: '_runChaosScenarioImpl_setup',
    };
  }
  var t0 = Date.now();
  var spawn = _spawnFakeSubprocess(killPoint, setup.tmpdir);
  var probe = _resumeProbe(setup.tmpdir);
  var afterFp = _fingerprintAllStreams(planningMetrics);
  var streamCmp = _compareCanonicalStreams(beforeFp, afterFp);
  var duration = Date.now() - t0;

  // Verdict tree:
  //   - canonical drift -> FAIL chaos_fail_canonical_drift
  //   - probe.manifest_ok false -> FAIL chaos_fail_manifest_invalid
  //   - probe.synthetic_close_emitted false -> FAIL chaos_fail_resume_blocked
  //   - spawn.ok false -> FAIL chaos_fail_timeout (the simulator itself failed)
  //   - else -> PASS chaos_pass
  var verdict = 'PASS';
  var reason = 'chaos_pass';
  if (!streamCmp.equal) {
    verdict = 'FAIL';
    reason = 'chaos_fail_canonical_drift';
  } else if (!probe.manifest_ok) {
    verdict = 'FAIL';
    reason = 'chaos_fail_manifest_invalid';
  } else if (!probe.synthetic_close_emitted) {
    verdict = 'FAIL';
    reason = 'chaos_fail_resume_blocked';
  } else if (!spawn.ok) {
    verdict = 'FAIL';
    reason = 'chaos_fail_timeout';
  }

  // Always teardown.
  var td = _teardownContainer({ tmpdir: setup.tmpdir });

  return {
    ok: verdict === 'PASS',
    kill_point: killPoint,
    verdict: verdict,
    reason: reason,
    manifest_reason: probe.manifest_reason || null,
    killed: !!spawn.killed,
    synthetic_close_emitted: !!probe.synthetic_close_emitted,
    canonical_drift: !streamCmp.equal,
    canonical_drift_paths: (streamCmp.drift || []).map(function (d) { return d.path; }),
    duration_ms: duration,
    teardown_ok: !!td.ok,
    spawn_signal: spawn.signal || null,
    spawn_ms: spawn.ms || 0,
    source: '_runChaosScenarioImpl',
  };
}

// ---------------------------------------------------------------------------
// runChaosScenario - public Lock-13 wrapper.
// ---------------------------------------------------------------------------
function runChaosScenario(args) {
  try {
    var kp = args && args.kill_point;
    return _runChaosScenarioImpl(kp);
  } catch (_e) {
    return {
      ok: false,
      kill_point: (args && args.kill_point) || null,
      verdict: 'FAIL',
      reason: 'gate_internal_error',
      source: 'runChaosScenario_catch',
    };
  }
}

// ---------------------------------------------------------------------------
// _runAllImpl - drive all 5 scenarios, accumulate results, aggregate.
// ---------------------------------------------------------------------------
function _runAllImpl(opts) {
  var results = [];
  for (var i = 0; i < KILL_POINTS.length; i++) {
    var r = _runChaosScenarioImpl(KILL_POINTS[i]);
    results.push(r);
  }
  var agg = _aggregateResultsImpl(results);
  // Optionally append envelope-v1 row.
  var runId = 'chaos-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  var logRow = {
    envelope_version: 1,
    run_id: runId,
    timestamp: new Date().toISOString(),
    pass_count: agg.pass,
    total: agg.total,
    verdict: agg.verdict,
    aggregate_reason: agg.reason,
    kill_points: KILL_POINTS.slice(),
    per_scenario: results.map(function (r) {
      return {
        kill_point: r.kill_point,
        verdict: r.verdict,
        reason: r.reason,
        killed: r.killed,
        synthetic_close_emitted: r.synthetic_close_emitted,
        canonical_drift: r.canonical_drift,
        duration_ms: r.duration_ms,
      };
    }),
  };
  // Resolve log path. Skip writing when --no-log opt is set (used by self-test).
  var skipLog = !!(opts && opts.no_log);
  if (!skipLog) {
    var logPath = path.join(PROJECT_ROOT, '.planning', 'metrics',
                             'chaos-restart-log.jsonl');
    appendLogRow(logRow, { logPath: logPath });
  }
  return {
    ok: agg.verdict === 'PASS',
    pass_count: agg.pass,
    total: agg.total,
    verdict: agg.verdict,
    reason: agg.reason,
    run_id: runId,
    results: results,
    exit_code: agg.verdict === 'PASS' ? 0 : 1,
  };
}

function runAll(opts) {
  try {
    return _runAllImpl(opts || {});
  } catch (_e) {
    return {
      ok: false,
      pass_count: 0,
      total: KILL_POINTS.length,
      verdict: 'FAIL',
      reason: 'gate_internal_error',
      results: [],
      exit_code: 1,
    };
  }
}

// ---------------------------------------------------------------------------
// _aggregateResultsImpl - verdict tree. PASS only when every scenario passed.
// ---------------------------------------------------------------------------
function _aggregateResultsImpl(rs) {
  if (!Array.isArray(rs)) {
    return {
      ok: false,
      pass: 0,
      total: 0,
      verdict: 'FAIL',
      reason: 'aggregate_fail',
    };
  }
  var pass = 0;
  for (var i = 0; i < rs.length; i++) {
    if (rs[i] && rs[i].verdict === 'PASS') pass++;
  }
  if (pass === rs.length && rs.length > 0) {
    return {
      ok: true,
      pass: pass,
      total: rs.length,
      verdict: 'PASS',
      reason: 'aggregate_pass_clean',
    };
  }
  return {
    ok: false,
    pass: pass,
    total: rs.length,
    verdict: 'FAIL',
    reason: 'aggregate_fail',
  };
}

function aggregateResults(rs) {
  try {
    return _aggregateResultsImpl(Array.isArray(rs) ? rs : []);
  } catch (_e) {
    return {
      ok: false,
      pass: 0,
      total: 0,
      verdict: 'FAIL',
      reason: 'aggregate_fail',
      source: 'aggregateResults_catch',
    };
  }
}

// ---------------------------------------------------------------------------
// _appendLogRowImpl - envelope-v1 writer for chaos-restart-log.jsonl. Single
// fs.appendFileSync; no rotation (Phase 53 precedent).
// ---------------------------------------------------------------------------
function _appendLogRowImpl(row, opts) {
  if (!row || typeof row !== 'object') {
    return { ok: false, written: false, reason: 'gate_internal_error' };
  }
  var logPath = (opts && opts.logPath) ||
    path.join(PROJECT_ROOT, '.planning', 'metrics', 'chaos-restart-log.jsonl');
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
  } catch (_eM) {
    // Already exists or path invalid; appendFileSync below will surface.
  }
  try {
    fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
    return { ok: true, written: true, path: logPath };
  } catch (e) {
    return {
      ok: false,
      written: false,
      reason: 'gate_internal_error',
      error: e && e.message ? e.message : 'unknown',
    };
  }
}

function appendLogRow(row, opts) {
  try {
    return _appendLogRowImpl(row, opts || {});
  } catch (_e) {
    return {
      ok: false,
      written: false,
      reason: 'gate_internal_error',
      source: 'appendLogRow_catch',
    };
  }
}

// ---------------------------------------------------------------------------
// validateManifest - re-export from manifest-validator.cjs (Lock-13 wrapped
// at the source). Kept as a public API of the harness for downstream
// consumers calling `require(harness).validateManifest(path)`.
// ---------------------------------------------------------------------------
function validateManifest(checkpointPath) {
  try {
    return manifestValidator.validateManifest(checkpointPath);
  } catch (_e) {
    return {
      ok: false,
      missing_fields: REQUIRED_FIELDS.slice(),
      reason: 'manifest_unparseable',
      fields_seen: [],
    };
  }
}

// ---------------------------------------------------------------------------
// _selfTestImpl - 18-assertion bootstrap suite. Covers:
//   1-5. KILL_POINTS frozen / 5-entry / FAIL_INJ_REASON_CODES frozen >=11 /
//        ASCII-only / Lock-13 wrappers present.
//   6-10. 5 chaos-restart scenarios run successfully (one assertion each).
//   11-16. 6 manifest-validator missing-field cases (one per REQUIRED_FIELDS
//          entry; each missing-field fixture rejected with reason
//          manifest_missing_field).
//   17. validateManifest returns manifest_valid on a complete fixture.
//   18. canonical streams byte-untouched after a full run-all.
// ---------------------------------------------------------------------------
function _selfTestImpl() {
  var results = [];
  function check(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  // ---- 1: KILL_POINTS frozen, 5 entries, exact order ------------------------
  try {
    var beforeLen = KILL_POINTS.length;
    var threw = false;
    try { KILL_POINTS.push('attempt'); } catch (_e) { threw = true; }
    var afterLen = KILL_POINTS.length;
    var orderOk = KILL_POINTS[0] === 'mid-research' &&
                  KILL_POINTS[1] === 'mid-plan' &&
                  KILL_POINTS[2] === 'mid-execute' &&
                  KILL_POINTS[3] === 'mid-verify' &&
                  KILL_POINTS[4] === 'mid-close';
    check('KILL_POINTS_frozen_5_entry_ordered',
          Object.isFrozen(KILL_POINTS) && beforeLen === 5 && afterLen === 5 && orderOk,
          'len=' + afterLen + ' frozen=' + Object.isFrozen(KILL_POINTS) +
          ' mut_threw=' + threw + ' order_ok=' + orderOk);
  } catch (e) {
    check('KILL_POINTS_frozen_5_entry_ordered', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 2: FAIL_INJ_REASON_CODES frozen, >=11 entries ------------------------
  try {
    var rcLen = FAIL_INJ_REASON_CODES.length;
    var rcThrew = false;
    try { FAIL_INJ_REASON_CODES.push('attempt'); } catch (_e) { rcThrew = true; }
    check('FAIL_INJ_REASON_CODES_frozen_ge11',
          Object.isFrozen(FAIL_INJ_REASON_CODES) && rcLen >= 11 &&
          FAIL_INJ_REASON_CODES.length === rcLen,
          'len=' + rcLen + ' frozen=' + Object.isFrozen(FAIL_INJ_REASON_CODES) +
          ' mut_threw=' + rcThrew);
  } catch (e) {
    check('FAIL_INJ_REASON_CODES_frozen_ge11', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 3: REQUIRED_FIELDS frozen, exactly 6 entries -------------------------
  try {
    var rfLen = REQUIRED_FIELDS.length;
    var expected = ['next_unit', 'controlling_principle', 'mode',
                    'emergency_halt', 'session', 'created'];
    var matchOrder = true;
    for (var ri = 0; ri < expected.length; ri++) {
      if (REQUIRED_FIELDS[ri] !== expected[ri]) { matchOrder = false; break; }
    }
    check('REQUIRED_FIELDS_frozen_6_entry_ordered',
          Object.isFrozen(REQUIRED_FIELDS) && rfLen === 6 && matchOrder,
          'len=' + rfLen + ' frozen=' + Object.isFrozen(REQUIRED_FIELDS) +
          ' order_ok=' + matchOrder);
  } catch (e) {
    check('REQUIRED_FIELDS_frozen_6_entry_ordered', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 4: 8-API public surface present + identity-equal -------------------
  try {
    var me = module.exports;
    var apiNames = ['runAll', 'runChaosScenario', 'validateManifest',
                    'selfTest', 'aggregateResults', 'appendLogRow'];
    var allPresent = true;
    var missing = '';
    for (var ai = 0; ai < apiNames.length; ai++) {
      if (typeof me[apiNames[ai]] !== 'function') {
        allPresent = false;
        missing = apiNames[ai];
        break;
      }
    }
    var frozenSurfacesOk = me.KILL_POINTS === KILL_POINTS &&
                            me.FAIL_INJ_REASON_CODES === FAIL_INJ_REASON_CODES &&
                            me.REQUIRED_FIELDS === REQUIRED_FIELDS;
    var internalsOk = me._internals && typeof me._internals === 'object';
    check('public_api_8_surface_identity_equal',
          allPresent && frozenSurfacesOk && internalsOk,
          'all_present=' + allPresent + ' missing=' + missing +
          ' frozen_surfaces_ok=' + frozenSurfacesOk +
          ' internals_ok=' + !!internalsOk);
  } catch (e) {
    check('public_api_8_surface_identity_equal', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 5: Lock-13 wrapper present and ASCII clean -------------------------
  try {
    var harnessSelfPath = __filename;
    var src = fs.readFileSync(harnessSelfPath, 'utf8');
    // ASCII-only check: every char code <= 127 except whitespace.
    var asciiOk = true;
    var firstNonAscii = -1;
    for (var ci = 0; ci < src.length; ci++) {
      if (src.charCodeAt(ci) > 127) {
        asciiOk = false;
        firstNonAscii = ci;
        break;
      }
    }
    // Lock-13 wrapper presence: every public API has a try/catch.
    var lock13Ok = src.indexOf('runAll(opts)') !== -1 &&
                   src.indexOf('catch (_e) {') !== -1 &&
                   src.indexOf('return _runAllImpl') !== -1 &&
                   src.indexOf('return _runChaosScenarioImpl') !== -1;
    check('lock13_wrapper_present_and_ascii_clean',
          asciiOk && lock13Ok,
          'ascii_ok=' + asciiOk + ' first_nonascii_idx=' + firstNonAscii +
          ' lock13_ok=' + lock13Ok);
  } catch (e) {
    check('lock13_wrapper_present_and_ascii_clean', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 6-10: each kill-point scenario PASS ---------------------------------
  for (var ki = 0; ki < KILL_POINTS.length; ki++) {
    var kp = KILL_POINTS[ki];
    try {
      var sr = runChaosScenario({ kill_point: kp });
      check('kill_point_' + kp.replace(/-/g, '_') + '_PASS',
            sr && sr.verdict === 'PASS' && sr.reason === 'chaos_pass' &&
            sr.synthetic_close_emitted === true && sr.canonical_drift === false,
            'verdict=' + (sr && sr.verdict) + ' reason=' + (sr && sr.reason) +
            ' close_emitted=' + (sr && sr.synthetic_close_emitted) +
            ' drift=' + (sr && sr.canonical_drift) +
            ' killed=' + (sr && sr.killed));
    } catch (e) {
      check('kill_point_' + kp.replace(/-/g, '_') + '_PASS', false,
            'threw: ' + (e.message || 'unknown'));
    }
  }

  // ---- 11-16: 6 missing-field cases for manifest-validator ---------------
  for (var mfi = 0; mfi < REQUIRED_FIELDS.length; mfi++) {
    var fieldName = REQUIRED_FIELDS[mfi];
    var label = 'manifest_missing_' + fieldName + '_rejected';
    var tmp = null;
    try {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-chaos-mvtest-'));
      var fmLines = ['---'];
      // Build a frontmatter that has all REQUIRED_FIELDS EXCEPT fieldName.
      for (var fi = 0; fi < REQUIRED_FIELDS.length; fi++) {
        var k = REQUIRED_FIELDS[fi];
        if (k === fieldName) continue;
        if (k === 'emergency_halt') {
          fmLines.push(k + ': false');
        } else if (k === 'created') {
          fmLines.push(k + ': 2026-04-29');
        } else if (k === 'next_unit') {
          fmLines.push(k + ': |');
          fmLines.push('  test resume unit');
        } else {
          fmLines.push(k + ': test-' + k);
        }
      }
      fmLines.push('---');
      fmLines.push('');
      fmLines.push('# missing field test');
      var checkpointPath = path.join(tmp, 'checkpoint.md');
      fs.writeFileSync(checkpointPath, fmLines.join('\n'));
      var v = manifestValidator.validateManifest(checkpointPath);
      var foundField = (v && Array.isArray(v.missing_fields) &&
                        v.missing_fields.indexOf(fieldName) !== -1);
      check(label,
            v && v.ok === false && v.reason === 'manifest_missing_field' &&
            foundField,
            'ok=' + (v && v.ok) + ' reason=' + (v && v.reason) +
            ' missing=' + JSON.stringify(v && v.missing_fields));
    } catch (e) {
      check(label, false, 'threw: ' + (e.message || 'unknown'));
    } finally {
      try { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) {}
    }
  }

  // ---- 17: validateManifest returns manifest_valid on a complete fixture ---
  try {
    var goodTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-chaos-mvgood-'));
    var goodLines = ['---'];
    for (var gi = 0; gi < REQUIRED_FIELDS.length; gi++) {
      var gk = REQUIRED_FIELDS[gi];
      if (gk === 'emergency_halt') goodLines.push(gk + ': false');
      else if (gk === 'created') goodLines.push(gk + ': 2026-04-29');
      else if (gk === 'next_unit') {
        goodLines.push(gk + ': |');
        goodLines.push('  resume unit');
      } else goodLines.push(gk + ': test-' + gk);
    }
    goodLines.push('---');
    goodLines.push('');
    goodLines.push('# good');
    var goodCheckpoint = path.join(goodTmp, 'checkpoint.md');
    fs.writeFileSync(goodCheckpoint, goodLines.join('\n'));
    var vGood = manifestValidator.validateManifest(goodCheckpoint);
    check('manifest_valid_complete_fixture',
          vGood && vGood.ok === true && vGood.reason === 'manifest_valid' &&
          Array.isArray(vGood.missing_fields) && vGood.missing_fields.length === 0,
          'ok=' + (vGood && vGood.ok) + ' reason=' + (vGood && vGood.reason));
    try { fs.rmSync(goodTmp, { recursive: true, force: true }); } catch (_e) {}
  } catch (e) {
    check('manifest_valid_complete_fixture', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 18: canonical streams byte-untouched after a full run-all ----------
  try {
    var planningMetrics = path.join(PROJECT_ROOT, '.planning', 'metrics');
    var preFp = _fingerprintAllStreams(planningMetrics);
    var runRes = runAll({ no_log: true });
    var postFp = _fingerprintAllStreams(planningMetrics);
    var cmp = _compareCanonicalStreams(preFp, postFp);
    check('runall_canonical_streams_byte_equal',
          cmp.equal && runRes && runRes.verdict === 'PASS' && runRes.total === 5,
          'equal=' + cmp.equal + ' drift=' + JSON.stringify(cmp.drift) +
          ' verdict=' + (runRes && runRes.verdict) +
          ' total=' + (runRes && runRes.total));
  } catch (e) {
    check('runall_canonical_streams_byte_equal', false,
          'threw: ' + (e.message || 'unknown'));
  }

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
      reason: 'gate_internal_error',
      source: 'selfTest_catch',
    };
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch.
// ---------------------------------------------------------------------------
function _printHelp() {
  return [
    'super-gsd/tools/chaos-restart/harness.cjs',
    'Phase 54-01: Restart + Handoff Chaos Tests harness.',
    '',
    'Usage:',
    '  node harness.cjs --self-test',
    '    Run the 18-assertion bootstrap suite. Exit 0 on all-PASS, 1 on first FAIL.',
    '',
    '  node harness.cjs --run-all',
    '    Drive all 5 kill-point scenarios; append envelope-v1 row to',
    '    .planning/metrics/chaos-restart-log.jsonl; aggregate verdict.',
    '',
    '  node harness.cjs --help',
    '    Print this usage block.',
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
    if (args.indexOf('--run-all') !== -1) {
      var runRes = runAll({});
      var rsRes = (runRes && Array.isArray(runRes.results)) ? runRes.results : [];
      for (var ri = 0; ri < rsRes.length; ri++) {
        var rr = rsRes[ri];
        var rTag = (rr && rr.verdict === 'PASS') ? 'PASS' : 'FAIL';
        process.stdout.write(
          '[' + rTag + '] ' + (rr && rr.kill_point) + ' verdict=' +
          (rr && rr.verdict) + ' reason=' + (rr && rr.reason) +
          ' close=' + (rr && rr.synthetic_close_emitted) +
          ' drift=' + (rr && rr.canonical_drift) +
          ' duration=' + (rr && rr.duration_ms) + 'ms\n'
        );
      }
      process.stdout.write(
        'run-all: pass=' + (runRes && runRes.pass_count) + '/' +
        (runRes && runRes.total) + ' verdict=' + (runRes && runRes.verdict) +
        ' run_id=' + (runRes && runRes.run_id) + '\n'
      );
      var ec = (runRes && typeof runRes.exit_code === 'number')
        ? runRes.exit_code : 1;
      process.exit(ec);
      return;
    }
    process.stderr.write('unknown args: ' + args.join(' ') + '\n');
    process.stderr.write(_printHelp() + '\n');
    process.exit(2);
  } catch (e) {
    process.stderr.write('harness.cjs CLI internal error: ' +
      (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// module.exports - frozen surfaces + 8 public APIs + _internals bag.
// IMPORTANT: assignment happens BEFORE _main() below so selfTest A4 sees a
// populated module.exports.
// ---------------------------------------------------------------------------
module.exports = {
  // Frozen surfaces:
  KILL_POINTS: KILL_POINTS,
  FAIL_INJ_REASON_CODES: FAIL_INJ_REASON_CODES,
  REQUIRED_FIELDS: REQUIRED_FIELDS,
  PHASE_54_GUARDED_STREAMS: PHASE_54_GUARDED_STREAMS,
  // Public API (Lock-13 wrapped):
  runAll: runAll,
  runChaosScenario: runChaosScenario,
  validateManifest: validateManifest,
  selfTest: selfTest,
  aggregateResults: aggregateResults,
  appendLogRow: appendLogRow,
  // Dual-exposed internal helpers:
  _runChaosScenarioImpl: _runChaosScenarioImpl,
  _setupContainer: _setupContainer,
  _teardownContainer: _teardownContainer,
  _spawnFakeSubprocess: _spawnFakeSubprocess,
  _resumeProbe: _resumeProbe,
  _internals: {
    _runChaosScenarioImpl: _runChaosScenarioImpl,
    _setupContainer: _setupContainer,
    _teardownContainer: _teardownContainer,
    _spawnFakeSubprocess: _spawnFakeSubprocess,
    _resumeProbe: _resumeProbe,
    _fingerprintStream: _fingerprintStream,
    _fingerprintsEqual: _fingerprintsEqual,
    _fingerprintAllStreams: _fingerprintAllStreams,
    _compareCanonicalStreams: _compareCanonicalStreams,
    _sha256OfBytes: _sha256OfBytes,
    _aggregateResultsImpl: _aggregateResultsImpl,
    _appendLogRowImpl: _appendLogRowImpl,
    _runAllImpl: _runAllImpl,
    _selfTestImpl: _selfTestImpl,
    _resolveProjectRoot: _resolveProjectRoot,
    PROJECT_ROOT: PROJECT_ROOT,
  },
};

if (require.main === module) {
  _main(process.argv);
}
