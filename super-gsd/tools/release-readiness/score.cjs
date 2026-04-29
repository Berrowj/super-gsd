#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/release-readiness/score.cjs
// Phase 57-01: Release Readiness Score (8-bucket composite, 0-100).
//
// PURPOSE
//   Collapse v2.0 multi-bucket evidence into one operator-facing 0-100
//   score plus a RED/AMBER/GREEN classifier. Hard precondition: any
//   `edge_guard_miss` row in .planning/metrics/crit-backlog.jsonl forces
//   color RED + score 0 regardless of bucket totals.
//
// 6 PUBLIC APIs (Lock-13 wrapped, mirrors Phase 55 surface conventions)
//   - computeScore({planningDir?, milestone?})
//       -> {ok, score, color, reason, buckets, exit_code}
//   - getBucketScore({bucket, planningDir?, milestone?})
//       -> {ok, bucket, points, max, source, reason}
//   - hasEdgeGuardMiss({planningDir?})
//       -> {ok, present, count, source}
//   - getColor(score)
//       -> 'GREEN' | 'AMBER' | 'RED'
//   - selfTest()
//       -> {ok, results: [...]} (12-15 assertions)
//   - _internals  (bag of helpers for cross-task composition)
//
// FROZEN SURFACES
//   - BUCKET_NAMES: 8-entry ordered array. Length checked in selfTest.
//   - MAX_POINTS:   8-key map; values sum to exactly 100.
//   - REASON_CODES: closed-vocab reason vocabulary.
//   - COLORS:       3-entry ordered array.
//
// BUCKET ALLOCATION (sums to 100)
//   scenarios          15  (failure-injection-log.jsonl PASS rate)
//   chaos_restart      10  (chaos-restart-log.jsonl PASS rate)
//   provider_circuit   10  (provider-circuit.json fallback_active state)
//   scenario_suite     15  (scenario-suite-log.jsonl PASS rate)
//   token_governance   15  (budgets.yaml + token-waste/check.cjs presence)
//   memory_governance  10  (memory-governance/lifecycle.cjs presence)
//   routing_quality    10  (dispatch-router/route.cjs presence)
//   lock_invariants    15  (own ASCII + selfTest internal probe)
//
// COLOR THRESHOLDS
//   GREEN: score >= 70  (exit 0)
//   AMBER: 50 <= score < 70  (exit 1)
//   RED:   score < 50 OR edge_guard_miss present  (exit 1)
//
// LOCK INVARIANTS
//   - Lock 4: Phase 41-56 byte-untouched. We never require() into Phase
//     41-56 trees; the token_governance / memory_governance / routing_quality
//     buckets use require() for module-presence probes, but each is wrapped
//     in try/catch and never invokes any non-trivial side-effecting API on
//     the imported module.
//   - Lock 11: bucket reads use byte-equality on closed-vocab status fields
//     (verdict === 'PASS', kind === 'edge_guard_miss'). No regex, no fuzzy.
//   - Lock 13: every public API wraps internals in try/catch; never throws
//     upward. Missing data file -> bucket score = 0 (degraded-OK).
//   - ASCII-only: no smart quotes, no emoji, no non-ASCII literals anywhere.
//
// REASON CODES (closed-vocab)
//   - score_computed_ok
//   - score_red_edge_guard_miss
//   - score_amber_below_green_threshold
//   - score_red_below_amber_threshold
//   - bucket_source_missing_degraded
//   - bucket_source_unparseable_degraded
//   - bucket_module_unavailable_degraded
//   - bucket_module_partial_degraded
//   - bucket_computed_ok
//   - score_internal_error
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// FROZEN SURFACES
// ---------------------------------------------------------------------------
const BUCKET_NAMES = Object.freeze([
  'scenarios',
  'chaos_restart',
  'provider_circuit',
  'scenario_suite',
  'token_governance',
  'memory_governance',
  'routing_quality',
  'lock_invariants',
]);

const MAX_POINTS = Object.freeze({
  scenarios: 15,
  chaos_restart: 10,
  provider_circuit: 10,
  scenario_suite: 15,
  token_governance: 15,
  memory_governance: 10,
  routing_quality: 10,
  lock_invariants: 15,
});

const COLORS = Object.freeze(['GREEN', 'AMBER', 'RED']);

const REASON_CODES = Object.freeze([
  'score_computed_ok',
  'score_red_edge_guard_miss',
  'score_amber_below_green_threshold',
  'score_red_below_amber_threshold',
  'bucket_source_missing_degraded',
  'bucket_source_unparseable_degraded',
  'bucket_module_unavailable_degraded',
  'bucket_module_partial_degraded',
  'bucket_computed_ok',
  'score_internal_error',
]);

const SCHEMA_VERSION = 1;
const GREEN_THRESHOLD = 70;
const AMBER_THRESHOLD = 50;
const TOTAL_POINTS = 100;

// ---------------------------------------------------------------------------
// Project root resolution. Walks up from __dirname looking for .planning/.
// Defensive: never throws.
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

function _resolvePlanningDir(planningDir) {
  if (typeof planningDir === 'string' && planningDir.length > 0) {
    if (path.isAbsolute(planningDir)) return planningDir;
    return path.resolve(_resolveProjectRoot(), planningDir);
  }
  return path.join(_resolveProjectRoot(), '.planning');
}

// ---------------------------------------------------------------------------
// JSONL line iterator. Per-line try/catch; bad lines skipped silently.
// Returns { rows: [...], parsed: N, skipped: M }.
// ---------------------------------------------------------------------------
function _readJsonl(filePath) {
  var out = { rows: [], parsed: 0, skipped: 0, missing: false };
  try {
    if (!fs.existsSync(filePath)) {
      out.missing = true;
      return out;
    }
    var txt = fs.readFileSync(filePath, 'utf8');
    var lines = txt.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var raw = lines[i];
      if (!raw || raw.length === 0) continue;
      try {
        var obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          out.rows.push(obj);
          out.parsed++;
        } else {
          out.skipped++;
        }
      } catch (_e) {
        out.skipped++;
      }
    }
  } catch (_e) {
    out.missing = true;
  }
  return out;
}

// ---------------------------------------------------------------------------
// hasEdgeGuardMiss - hard precondition probe.
// ---------------------------------------------------------------------------
function _hasEdgeGuardMissImpl(opts) {
  var planningDir = _resolvePlanningDir(opts && opts.planningDir);
  var critPath = path.join(planningDir, 'metrics', 'crit-backlog.jsonl');
  var read = _readJsonl(critPath);
  if (read.missing) {
    return {
      ok: true,
      present: false,
      count: 0,
      source: 'missing_file_degraded',
    };
  }
  var count = 0;
  for (var i = 0; i < read.rows.length; i++) {
    var r = read.rows[i];
    if (r && r.kind === 'edge_guard_miss' && (r.resolved_at == null)) {
      count++;
    }
  }
  return {
    ok: true,
    present: count > 0,
    count: count,
    source: 'crit_backlog_jsonl',
  };
}

function hasEdgeGuardMiss(opts) {
  try {
    return _hasEdgeGuardMissImpl(opts || {});
  } catch (_e) {
    return {
      ok: false,
      present: false,
      count: 0,
      source: 'edge_guard_miss_internal_error',
    };
  }
}

// ---------------------------------------------------------------------------
// Bucket impls. Each returns { points, max, source, reason }.
// All wrapped by getBucketScore which adds Lock-13 try/catch.
// ---------------------------------------------------------------------------

function _passSetForFailureInjection() {
  // Set-membership only (Lock 11). PASS-WITH-DEFERRED-N matches via prefix
  // check using exact-string '.startsWith(...)' equivalent: closed-vocab
  // check on the small known set.
  return {
    'PASS': true,
    'PASS-WITH-SOFT-SKIP': true,
    'PASS-WITH-DEFERRED-1': true,
    'PASS-WITH-DEFERRED-2': true,
    'PASS-WITH-DEFERRED-3': true,
    'PASS-WITH-DEFERRED-4': true,
    'PASS-WITH-DEFERRED-5': true,
  };
}

function _isPassFailureInjection(verdict) {
  if (typeof verdict !== 'string') return false;
  var set = _passSetForFailureInjection();
  return set[verdict] === true;
}

function _bucketScenariosImpl(opts) {
  var planningDir = _resolvePlanningDir(opts && opts.planningDir);
  var milestone = (opts && opts.milestone) ? opts.milestone : null;
  var p = path.join(planningDir, 'metrics', 'failure-injection-log.jsonl');
  var read = _readJsonl(p);
  if (read.missing) {
    return {
      points: 0,
      max: MAX_POINTS.scenarios,
      source: p,
      reason: 'bucket_source_missing_degraded',
    };
  }
  var pass = 0;
  var total = 0;
  for (var i = 0; i < read.rows.length; i++) {
    var r = read.rows[i];
    if (!r) continue;
    if (milestone && r.milestone !== milestone) continue;
    total++;
    if (_isPassFailureInjection(r.verdict)) pass++;
  }
  if (total === 0) {
    return {
      points: 0,
      max: MAX_POINTS.scenarios,
      source: p,
      reason: 'bucket_source_missing_degraded',
    };
  }
  var pts = Math.floor((pass / total) * MAX_POINTS.scenarios);
  return {
    points: pts,
    max: MAX_POINTS.scenarios,
    source: p,
    reason: 'bucket_computed_ok',
    pass: pass,
    total: total,
  };
}

function _bucketChaosRestartImpl(opts) {
  var planningDir = _resolvePlanningDir(opts && opts.planningDir);
  var p = path.join(planningDir, 'metrics', 'chaos-restart-log.jsonl');
  var read = _readJsonl(p);
  if (read.missing || read.rows.length === 0) {
    return {
      points: 0,
      max: MAX_POINTS.chaos_restart,
      source: p,
      reason: 'bucket_source_missing_degraded',
    };
  }
  // Each top-level row is one --run-all aggregate. We sum per-scenario PASS
  // across all runs (byte-equality on verdict==='PASS').
  var pass = 0;
  var total = 0;
  for (var i = 0; i < read.rows.length; i++) {
    var r = read.rows[i];
    if (!r) continue;
    if (Array.isArray(r.per_scenario)) {
      for (var j = 0; j < r.per_scenario.length; j++) {
        var s = r.per_scenario[j];
        total++;
        if (s && s.verdict === 'PASS') pass++;
      }
    } else if (typeof r.pass_count === 'number' &&
               typeof r.total === 'number') {
      pass += r.pass_count;
      total += r.total;
    }
  }
  if (total === 0) {
    return {
      points: 0,
      max: MAX_POINTS.chaos_restart,
      source: p,
      reason: 'bucket_source_missing_degraded',
    };
  }
  var pts = Math.floor((pass / total) * MAX_POINTS.chaos_restart);
  return {
    points: pts,
    max: MAX_POINTS.chaos_restart,
    source: p,
    reason: 'bucket_computed_ok',
    pass: pass,
    total: total,
  };
}

function _bucketProviderCircuitImpl(opts) {
  var planningDir = _resolvePlanningDir(opts && opts.planningDir);
  var milestone = (opts && opts.milestone) ? opts.milestone : null;
  var p = path.join(planningDir, 'metrics', 'provider-circuit.json');
  if (!fs.existsSync(p)) {
    // Missing file = no fallback ever active for this milestone = full pts.
    return {
      points: MAX_POINTS.provider_circuit,
      max: MAX_POINTS.provider_circuit,
      source: p,
      reason: 'bucket_computed_ok',
      detail: 'no_state_file_no_fallback',
    };
  }
  var raw = '';
  try {
    raw = fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return {
      points: 0,
      max: MAX_POINTS.provider_circuit,
      source: p,
      reason: 'bucket_source_unparseable_degraded',
    };
  }
  var obj = null;
  try {
    obj = JSON.parse(raw);
  } catch (_e) {
    return {
      points: 0,
      max: MAX_POINTS.provider_circuit,
      source: p,
      reason: 'bucket_source_unparseable_degraded',
    };
  }
  // Look for fallback_active under any milestone (or specific milestone).
  var milestonesMap = (obj && obj.milestones) ? obj.milestones : {};
  var anyFallback = false;
  if (milestone) {
    var entry = milestonesMap[milestone];
    if (entry && typeof entry === 'object') {
      var keys = Object.keys(entry);
      for (var k = 0; k < keys.length; k++) {
        var prov = entry[keys[k]];
        if (prov && prov.fallback_active === true) {
          anyFallback = true;
          break;
        }
      }
    }
  } else {
    var mkeys = Object.keys(milestonesMap);
    for (var m = 0; m < mkeys.length; m++) {
      var mEntry = milestonesMap[mkeys[m]];
      if (!mEntry) continue;
      var pkeys = Object.keys(mEntry);
      for (var pk = 0; pk < pkeys.length; pk++) {
        var pEntry = mEntry[pkeys[pk]];
        if (pEntry && pEntry.fallback_active === true) {
          anyFallback = true;
          break;
        }
      }
      if (anyFallback) break;
    }
  }
  return {
    points: anyFallback ? 5 : MAX_POINTS.provider_circuit,
    max: MAX_POINTS.provider_circuit,
    source: p,
    reason: 'bucket_computed_ok',
    fallback_active: anyFallback,
  };
}

function _bucketScenarioSuiteImpl(opts) {
  var planningDir = _resolvePlanningDir(opts && opts.planningDir);
  var p = path.join(planningDir, 'metrics', 'scenario-suite-log.jsonl');
  var read = _readJsonl(p);
  if (read.missing || read.rows.length === 0) {
    return {
      points: 0,
      max: MAX_POINTS.scenario_suite,
      source: p,
      reason: 'bucket_source_missing_degraded',
    };
  }
  var pass = 0;
  var total = 0;
  for (var i = 0; i < read.rows.length; i++) {
    var r = read.rows[i];
    if (!r) continue;
    total++;
    // Lock 11 byte-equality on verdict closed-vocab.
    if (r.verdict === 'PASS') pass++;
  }
  if (total === 0) {
    return {
      points: 0,
      max: MAX_POINTS.scenario_suite,
      source: p,
      reason: 'bucket_source_missing_degraded',
    };
  }
  var pts = Math.floor((pass / total) * MAX_POINTS.scenario_suite);
  return {
    points: pts,
    max: MAX_POINTS.scenario_suite,
    source: p,
    reason: 'bucket_computed_ok',
    pass: pass,
    total: total,
  };
}

function _probeModule(modPath, requiredExports) {
  try {
    if (!fs.existsSync(modPath)) {
      return { ok: false, level: 'missing' };
    }
    var mod = require(modPath);
    if (!mod || typeof mod !== 'object') {
      return { ok: false, level: 'partial' };
    }
    if (Array.isArray(requiredExports)) {
      for (var i = 0; i < requiredExports.length; i++) {
        if (typeof mod[requiredExports[i]] !== 'function') {
          return { ok: false, level: 'partial' };
        }
      }
    }
    return { ok: true, level: 'full' };
  } catch (_e) {
    return { ok: false, level: 'missing' };
  }
}

function _bucketTokenGovernanceImpl() {
  var root = _resolveProjectRoot();
  var budgetsPath = path.join(root, 'super-gsd', 'tools', 'token-waste',
                               'budgets.yaml');
  var checkPath = path.join(root, 'super-gsd', 'tools', 'token-waste',
                             'check.cjs');
  var hasBudgets = fs.existsSync(budgetsPath);
  var probe = _probeModule(checkPath, []);
  if (hasBudgets && probe.ok) {
    return {
      points: MAX_POINTS.token_governance,
      max: MAX_POINTS.token_governance,
      source: checkPath,
      reason: 'bucket_computed_ok',
    };
  }
  if (hasBudgets) {
    return {
      points: 7,
      max: MAX_POINTS.token_governance,
      source: budgetsPath,
      reason: 'bucket_module_partial_degraded',
    };
  }
  return {
    points: 0,
    max: MAX_POINTS.token_governance,
    source: budgetsPath,
    reason: 'bucket_module_unavailable_degraded',
  };
}

function _bucketMemoryGovernanceImpl() {
  var root = _resolveProjectRoot();
  var modPath = path.join(root, 'super-gsd', 'tools', 'memory-governance',
                           'lifecycle.cjs');
  var probe = _probeModule(modPath, []);
  if (probe.ok) {
    return {
      points: MAX_POINTS.memory_governance,
      max: MAX_POINTS.memory_governance,
      source: modPath,
      reason: 'bucket_computed_ok',
    };
  }
  if (probe.level === 'partial') {
    return {
      points: 5,
      max: MAX_POINTS.memory_governance,
      source: modPath,
      reason: 'bucket_module_partial_degraded',
    };
  }
  return {
    points: 0,
    max: MAX_POINTS.memory_governance,
    source: modPath,
    reason: 'bucket_module_unavailable_degraded',
  };
}

function _bucketRoutingQualityImpl() {
  var root = _resolveProjectRoot();
  var modPath = path.join(root, 'super-gsd', 'tools', 'dispatch-router',
                           'route.cjs');
  var probe = _probeModule(modPath, []);
  if (probe.ok) {
    return {
      points: MAX_POINTS.routing_quality,
      max: MAX_POINTS.routing_quality,
      source: modPath,
      reason: 'bucket_computed_ok',
    };
  }
  if (probe.level === 'partial') {
    return {
      points: 5,
      max: MAX_POINTS.routing_quality,
      source: modPath,
      reason: 'bucket_module_partial_degraded',
    };
  }
  return {
    points: 0,
    max: MAX_POINTS.routing_quality,
    source: modPath,
    reason: 'bucket_module_unavailable_degraded',
  };
}

function _firstNonAsciiIdx(s) {
  if (typeof s !== 'string') return -1;
  for (var i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 127) return i;
  }
  return -1;
}

function _bucketLockInvariantsImpl() {
  var root = _resolveProjectRoot();
  var selfPath = path.join(root, 'super-gsd', 'tools', 'release-readiness',
                            'score.cjs');
  // ASCII probe on the score.cjs source itself (own integrity).
  var asciiOk = false;
  try {
    var src = fs.readFileSync(selfPath, 'utf8');
    asciiOk = (_firstNonAsciiIdx(src) === -1);
  } catch (_e) {
    asciiOk = false;
  }
  // Lock-13 probe: every public API must be a function.
  var lock13Ok = (typeof computeScore === 'function' &&
                  typeof getBucketScore === 'function' &&
                  typeof hasEdgeGuardMiss === 'function' &&
                  typeof getColor === 'function' &&
                  typeof selfTest === 'function');
  if (asciiOk && lock13Ok) {
    return {
      points: MAX_POINTS.lock_invariants,
      max: MAX_POINTS.lock_invariants,
      source: 'self_check',
      reason: 'bucket_computed_ok',
    };
  }
  return {
    points: 0,
    max: MAX_POINTS.lock_invariants,
    source: 'self_check',
    reason: 'bucket_module_partial_degraded',
    ascii_ok: asciiOk,
    lock13_ok: lock13Ok,
  };
}

// ---------------------------------------------------------------------------
// getBucketScore - dispatcher with Lock-13 wrap.
// ---------------------------------------------------------------------------
function _getBucketScoreImpl(opts) {
  var bucket = opts && opts.bucket;
  if (typeof bucket !== 'string' ||
      !Object.prototype.hasOwnProperty.call(MAX_POINTS, bucket)) {
    return {
      ok: false,
      bucket: bucket || null,
      points: 0,
      max: 0,
      source: null,
      reason: 'score_internal_error',
      detail: 'unknown_bucket',
    };
  }
  var r = null;
  if (bucket === 'scenarios') r = _bucketScenariosImpl(opts || {});
  else if (bucket === 'chaos_restart') r = _bucketChaosRestartImpl(opts || {});
  else if (bucket === 'provider_circuit') r = _bucketProviderCircuitImpl(opts || {});
  else if (bucket === 'scenario_suite') r = _bucketScenarioSuiteImpl(opts || {});
  else if (bucket === 'token_governance') r = _bucketTokenGovernanceImpl();
  else if (bucket === 'memory_governance') r = _bucketMemoryGovernanceImpl();
  else if (bucket === 'routing_quality') r = _bucketRoutingQualityImpl();
  else if (bucket === 'lock_invariants') r = _bucketLockInvariantsImpl();
  if (!r) {
    return {
      ok: false,
      bucket: bucket,
      points: 0,
      max: MAX_POINTS[bucket] || 0,
      source: null,
      reason: 'score_internal_error',
    };
  }
  return {
    ok: true,
    bucket: bucket,
    points: r.points,
    max: r.max,
    source: r.source,
    reason: r.reason,
    detail: r,
  };
}

function getBucketScore(opts) {
  try {
    return _getBucketScoreImpl(opts || {});
  } catch (_e) {
    var b = opts && opts.bucket;
    return {
      ok: false,
      bucket: b || null,
      points: 0,
      max: (b && MAX_POINTS[b]) || 0,
      source: null,
      reason: 'score_internal_error',
    };
  }
}

// ---------------------------------------------------------------------------
// getColor - byte-equality threshold check.
// ---------------------------------------------------------------------------
function getColor(score) {
  try {
    var n = (typeof score === 'number' && Number.isFinite(score))
      ? Math.floor(score) : 0;
    if (n >= GREEN_THRESHOLD) return 'GREEN';
    if (n >= AMBER_THRESHOLD) return 'AMBER';
    return 'RED';
  } catch (_e) {
    return 'RED';
  }
}

// ---------------------------------------------------------------------------
// computeScore - top-level composite. Lock-13 wrapped.
// ---------------------------------------------------------------------------
function _computeScoreImpl(opts) {
  var buckets = {};
  var total = 0;
  for (var i = 0; i < BUCKET_NAMES.length; i++) {
    var name = BUCKET_NAMES[i];
    var br = getBucketScore({
      bucket: name,
      planningDir: opts && opts.planningDir,
      milestone: opts && opts.milestone,
    });
    buckets[name] = br;
    if (br && typeof br.points === 'number') total += br.points;
  }

  var edge = hasEdgeGuardMiss({
    planningDir: opts && opts.planningDir,
  });

  if (edge && edge.present === true) {
    return {
      ok: true,
      score: 0,
      color: 'RED',
      reason: 'score_red_edge_guard_miss',
      edge_guard_miss_count: edge.count,
      buckets: buckets,
      computed_total: total,
      exit_code: 1,
    };
  }

  var color = getColor(total);
  var reason = 'score_computed_ok';
  var exitCode = 0;
  if (color === 'GREEN') {
    reason = 'score_computed_ok';
    exitCode = 0;
  } else if (color === 'AMBER') {
    reason = 'score_amber_below_green_threshold';
    exitCode = 1;
  } else {
    reason = 'score_red_below_amber_threshold';
    exitCode = 1;
  }

  return {
    ok: true,
    score: total,
    color: color,
    reason: reason,
    edge_guard_miss_count: 0,
    buckets: buckets,
    exit_code: exitCode,
  };
}

function computeScore(opts) {
  try {
    return _computeScoreImpl(opts || {});
  } catch (_e) {
    return {
      ok: false,
      score: 0,
      color: 'RED',
      reason: 'score_internal_error',
      buckets: {},
      exit_code: 1,
    };
  }
}

// ---------------------------------------------------------------------------
// selfTest - 12-15 assertions. Builds a temp planningDir for fixture probes.
// ---------------------------------------------------------------------------
function _mkTmpDir(label) {
  var os = require('os');
  var base = os.tmpdir();
  var name = 'sgsd-rr-' + label + '-' + Date.now() + '-' +
             Math.random().toString(36).slice(2, 8);
  var p = path.join(base, name);
  fs.mkdirSync(p, { recursive: true });
  return p;
}

function _writeFile(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
}

function _selfTestImpl() {
  var results = [];

  // 1: BUCKET_NAMES length === 8
  results.push({
    name: 'bucket_names_length_8',
    ok: BUCKET_NAMES.length === 8,
    detail: 'len=' + BUCKET_NAMES.length,
  });

  // 2: MAX_POINTS sum === 100
  var sum = 0;
  for (var i = 0; i < BUCKET_NAMES.length; i++) {
    sum += MAX_POINTS[BUCKET_NAMES[i]];
  }
  results.push({
    name: 'max_points_sum_100',
    ok: sum === TOTAL_POINTS,
    detail: 'sum=' + sum,
  });

  // 3: All BUCKET_NAMES keys present in MAX_POINTS
  var allPresent = true;
  for (var b = 0; b < BUCKET_NAMES.length; b++) {
    if (!Object.prototype.hasOwnProperty.call(MAX_POINTS, BUCKET_NAMES[b])) {
      allPresent = false;
      break;
    }
  }
  results.push({
    name: 'max_points_keys_match_bucket_names',
    ok: allPresent,
    detail: allPresent ? 'all_present' : 'missing_key',
  });

  // 4: getColor thresholds
  var c70 = getColor(70);
  var c69 = getColor(69);
  var c50 = getColor(50);
  var c49 = getColor(49);
  var c100 = getColor(100);
  var c0 = getColor(0);
  var colorsOk = (c70 === 'GREEN' && c69 === 'AMBER' && c50 === 'AMBER' &&
                  c49 === 'RED' && c100 === 'GREEN' && c0 === 'RED');
  results.push({
    name: 'get_color_thresholds',
    ok: colorsOk,
    detail: '70=' + c70 + ' 69=' + c69 + ' 50=' + c50 +
            ' 49=' + c49 + ' 100=' + c100 + ' 0=' + c0,
  });

  // 5: edge_guard_miss override produces RED + score 0
  var tmp1 = _mkTmpDir('selftest1');
  try {
    _writeFile(path.join(tmp1, 'metrics', 'crit-backlog.jsonl'),
      JSON.stringify({
        id: 'fixture-egm',
        kind: 'edge_guard_miss',
        phase: '99',
        plan: 'phase-level',
        milestone: 'v2.0',
        attempts_made: 1,
        summary: 'fixture',
        evidence_path: null,
        last_diff_sha: null,
        tagged_for_milestone: null,
        added_at: '2026-04-29T00:00:00.000Z',
        resolved_at: null,
      }) + '\n');
    var r5 = computeScore({ planningDir: tmp1, milestone: 'v2.0' });
    results.push({
      name: 'edge_guard_miss_overrides_to_red',
      ok: (r5 && r5.color === 'RED' && r5.score === 0 &&
           r5.reason === 'score_red_edge_guard_miss' &&
           r5.exit_code === 1),
      detail: 'color=' + (r5 && r5.color) + ' score=' + (r5 && r5.score) +
              ' reason=' + (r5 && r5.reason) + ' exit=' + (r5 && r5.exit_code),
    });
  } catch (e) {
    results.push({
      name: 'edge_guard_miss_overrides_to_red',
      ok: false,
      detail: 'threw: ' + (e && e.message),
    });
  }

  // 6: hasEdgeGuardMiss missing-file degrades to present:false
  var tmp2 = _mkTmpDir('selftest2');
  try {
    var r6 = hasEdgeGuardMiss({ planningDir: tmp2 });
    results.push({
      name: 'edge_guard_miss_missing_file_degraded',
      ok: (r6 && r6.present === false && r6.count === 0 && r6.ok === true),
      detail: 'present=' + (r6 && r6.present) + ' count=' + (r6 && r6.count),
    });
  } catch (e) {
    results.push({
      name: 'edge_guard_miss_missing_file_degraded',
      ok: false,
      detail: 'threw: ' + (e && e.message),
    });
  }

  // 7: hasEdgeGuardMiss treats resolved row as not-present
  var tmp3 = _mkTmpDir('selftest3');
  try {
    _writeFile(path.join(tmp3, 'metrics', 'crit-backlog.jsonl'),
      JSON.stringify({
        id: 'fixture-resolved',
        kind: 'edge_guard_miss',
        resolved_at: '2026-04-29T00:00:00.000Z',
      }) + '\n');
    var r7 = hasEdgeGuardMiss({ planningDir: tmp3 });
    results.push({
      name: 'edge_guard_miss_resolved_row_ignored',
      ok: (r7 && r7.present === false && r7.count === 0),
      detail: 'present=' + (r7 && r7.present) + ' count=' + (r7 && r7.count),
    });
  } catch (e) {
    results.push({
      name: 'edge_guard_miss_resolved_row_ignored',
      ok: false,
      detail: 'threw: ' + (e && e.message),
    });
  }

  // 8: Synthetic clean GREEN (score>=70) on real project root - exercises
  // the live-canonical path. We assert color is one of the 3 colors and
  // score is in 0..100 range. (The actual GREEN assertion is the live
  // verification step; here we only assert the API shape.)
  try {
    var live = computeScore({ milestone: 'v2.0' });
    var shapeOk = (live && typeof live.score === 'number' &&
                   live.score >= 0 && live.score <= TOTAL_POINTS &&
                   COLORS.indexOf(live.color) !== -1 &&
                   typeof live.exit_code === 'number');
    results.push({
      name: 'live_compute_shape_ok',
      ok: shapeOk,
      detail: 'score=' + (live && live.score) + ' color=' + (live && live.color),
    });
  } catch (e) {
    results.push({
      name: 'live_compute_shape_ok',
      ok: false,
      detail: 'threw: ' + (e && e.message),
    });
  }

  // 9: getBucketScore unknown bucket returns ok:false
  try {
    var rb9 = getBucketScore({ bucket: 'not_a_real_bucket' });
    results.push({
      name: 'get_bucket_score_unknown_bucket',
      ok: (rb9 && rb9.ok === false &&
           rb9.reason === 'score_internal_error'),
      detail: 'ok=' + (rb9 && rb9.ok) + ' reason=' + (rb9 && rb9.reason),
    });
  } catch (e) {
    results.push({
      name: 'get_bucket_score_unknown_bucket',
      ok: false,
      detail: 'threw: ' + (e && e.message),
    });
  }

  // 10: provider_circuit missing-state-file -> full points
  var tmp4 = _mkTmpDir('selftest4');
  try {
    var rb10 = getBucketScore({
      bucket: 'provider_circuit',
      planningDir: tmp4,
      milestone: 'v2.0',
    });
    results.push({
      name: 'provider_circuit_missing_full_points',
      ok: (rb10 && rb10.ok === true &&
           rb10.points === MAX_POINTS.provider_circuit),
      detail: 'points=' + (rb10 && rb10.points),
    });
  } catch (e) {
    results.push({
      name: 'provider_circuit_missing_full_points',
      ok: false,
      detail: 'threw: ' + (e && e.message),
    });
  }

  // 11: scenarios with synthetic 100% PASS jsonl gives 15 pts
  var tmp5 = _mkTmpDir('selftest5');
  try {
    var rows = [];
    for (var s5 = 0; s5 < 5; s5++) {
      rows.push(JSON.stringify({
        envelope_version: 1,
        verdict: 'PASS',
        milestone: 'v2.0',
        scenario_id: 'fixture-' + s5,
      }));
    }
    _writeFile(path.join(tmp5, 'metrics', 'failure-injection-log.jsonl'),
               rows.join('\n') + '\n');
    var rb11 = getBucketScore({
      bucket: 'scenarios',
      planningDir: tmp5,
      milestone: 'v2.0',
    });
    results.push({
      name: 'scenarios_full_pass_full_points',
      ok: (rb11 && rb11.ok === true &&
           rb11.points === MAX_POINTS.scenarios),
      detail: 'points=' + (rb11 && rb11.points),
    });
  } catch (e) {
    results.push({
      name: 'scenarios_full_pass_full_points',
      ok: false,
      detail: 'threw: ' + (e && e.message),
    });
  }

  // 12: scenarios with 50% PASS gives floor(7.5) === 7 pts
  var tmp6 = _mkTmpDir('selftest6');
  try {
    var rows6 = [];
    for (var s6 = 0; s6 < 4; s6++) {
      rows6.push(JSON.stringify({
        envelope_version: 1,
        verdict: s6 < 2 ? 'PASS' : 'FAIL',
        milestone: 'v2.0',
        scenario_id: 'fixture-' + s6,
      }));
    }
    _writeFile(path.join(tmp6, 'metrics', 'failure-injection-log.jsonl'),
               rows6.join('\n') + '\n');
    var rb12 = getBucketScore({
      bucket: 'scenarios',
      planningDir: tmp6,
      milestone: 'v2.0',
    });
    results.push({
      name: 'scenarios_half_pass_floor_seven',
      ok: (rb12 && rb12.ok === true && rb12.points === 7),
      detail: 'points=' + (rb12 && rb12.points),
    });
  } catch (e) {
    results.push({
      name: 'scenarios_half_pass_floor_seven',
      ok: false,
      detail: 'threw: ' + (e && e.message),
    });
  }

  // 13: ASCII-only on score.cjs source file
  try {
    var selfPath = path.join(__dirname, 'score.cjs');
    var src = fs.readFileSync(selfPath, 'utf8');
    var nonAscii = _firstNonAsciiIdx(src);
    results.push({
      name: 'ascii_only_score_cjs',
      ok: nonAscii === -1,
      detail: 'first_nonascii_idx=' + nonAscii,
    });
  } catch (e) {
    results.push({
      name: 'ascii_only_score_cjs',
      ok: false,
      detail: 'threw: ' + (e && e.message),
    });
  }

  // 14: Lock 13 - all public APIs are functions
  var apisOk = (typeof computeScore === 'function' &&
                typeof getBucketScore === 'function' &&
                typeof hasEdgeGuardMiss === 'function' &&
                typeof getColor === 'function' &&
                typeof selfTest === 'function');
  results.push({
    name: 'lock13_public_apis_are_functions',
    ok: apisOk,
    detail: 'apis_ok=' + apisOk,
  });

  // 15: REASON_CODES is frozen 10-entry vocabulary
  results.push({
    name: 'reason_codes_frozen_vocab',
    ok: (Object.isFrozen(REASON_CODES) && REASON_CODES.length === 10),
    detail: 'frozen=' + Object.isFrozen(REASON_CODES) +
            ' len=' + REASON_CODES.length,
  });

  var allOk = true;
  for (var ri = 0; ri < results.length; ri++) {
    if (!results[ri].ok) { allOk = false; break; }
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
      reason: 'score_internal_error',
      source: 'selfTest_catch',
    };
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch.
// ---------------------------------------------------------------------------
function _argValue(args, key) {
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === key && i + 1 < args.length) return args[i + 1];
    var prefix = key + '=';
    if (a.indexOf(prefix) === 0) return a.slice(prefix.length);
  }
  return null;
}

function _printHelp() {
  return [
    'super-gsd/tools/release-readiness/score.cjs',
    'Phase 57-01: Release Readiness Score (8-bucket composite, 0-100).',
    '',
    'Usage:',
    '  node score.cjs --self-test',
    '    Run the bootstrap suite (12-15 assertions). Exit 0 on all-PASS, 1 otherwise.',
    '',
    '  node score.cjs --milestone <v2.0|...>',
    '    Compute the 8-bucket score against canonical streams. Exit 0 if',
    '    score>=70 AND no edge_guard_miss row, 1 otherwise.',
    '',
    '  node score.cjs --milestone <v...> --planning-dir <abs-or-rel-path>',
    '    Override the planning directory root (test-only).',
    '',
    '  node score.cjs --help',
    '    Print this usage block.',
  ].join('\n');
}

function _printScoreReport(out) {
  process.stdout.write('release_readiness_score:\n');
  process.stdout.write('  score: ' + out.score + ' / ' + TOTAL_POINTS + '\n');
  process.stdout.write('  color: ' + out.color + '\n');
  process.stdout.write('  reason: ' + out.reason + '\n');
  if (typeof out.edge_guard_miss_count === 'number') {
    process.stdout.write('  edge_guard_miss_count: ' +
      out.edge_guard_miss_count + '\n');
  }
  process.stdout.write('  exit_code: ' + out.exit_code + '\n');
  process.stdout.write('  buckets:\n');
  for (var i = 0; i < BUCKET_NAMES.length; i++) {
    var n = BUCKET_NAMES[i];
    var b = out.buckets && out.buckets[n];
    if (!b) continue;
    process.stdout.write('    ' + n + ': ' + b.points + ' / ' + b.max +
      ' (' + b.reason + ')\n');
  }
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
      var st = selfTest();
      var rs = (st && Array.isArray(st.results)) ? st.results : [];
      for (var i = 0; i < rs.length; i++) {
        var tag = rs[i].ok ? 'PASS' : 'FAIL';
        process.stdout.write('[' + tag + '] ' + rs[i].name +
          (rs[i].detail ? ' :: ' + rs[i].detail : '') + '\n');
      }
      var passCount = 0;
      for (var pi = 0; pi < rs.length; pi++) if (rs[pi].ok) passCount++;
      process.stdout.write('self-test: ' + passCount + '/' + rs.length +
        ' PASS' + (st && st.ok ? ' (green)' : ' (red)') + '\n');
      process.exit(st && st.ok ? 0 : 1);
      return;
    }
    var milestone = _argValue(args, '--milestone');
    if (!milestone) {
      process.stderr.write('release_readiness:missing_milestone_arg\n');
      process.stderr.write(_printHelp() + '\n');
      process.exit(1);
      return;
    }
    var planningDir = _argValue(args, '--planning-dir');
    var out = computeScore({
      planningDir: planningDir || undefined,
      milestone: milestone,
    });
    _printScoreReport(out);
    process.exit(out && typeof out.exit_code === 'number' ? out.exit_code : 1);
  } catch (e) {
    process.stderr.write('score.cjs CLI internal error: ' +
      (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// module.exports
// ---------------------------------------------------------------------------
module.exports = {
  // Frozen surfaces:
  BUCKET_NAMES: BUCKET_NAMES,
  MAX_POINTS: MAX_POINTS,
  COLORS: COLORS,
  REASON_CODES: REASON_CODES,
  SCHEMA_VERSION: SCHEMA_VERSION,
  GREEN_THRESHOLD: GREEN_THRESHOLD,
  AMBER_THRESHOLD: AMBER_THRESHOLD,
  TOTAL_POINTS: TOTAL_POINTS,
  // 6 Public APIs (Lock-13 wrapped):
  computeScore: computeScore,
  getBucketScore: getBucketScore,
  hasEdgeGuardMiss: hasEdgeGuardMiss,
  getColor: getColor,
  selfTest: selfTest,
  // Dual-exposed internal helpers:
  _internals: {
    _resolveProjectRoot: _resolveProjectRoot,
    _resolvePlanningDir: _resolvePlanningDir,
    _readJsonl: _readJsonl,
    _firstNonAsciiIdx: _firstNonAsciiIdx,
    _bucketScenariosImpl: _bucketScenariosImpl,
    _bucketChaosRestartImpl: _bucketChaosRestartImpl,
    _bucketProviderCircuitImpl: _bucketProviderCircuitImpl,
    _bucketScenarioSuiteImpl: _bucketScenarioSuiteImpl,
    _bucketTokenGovernanceImpl: _bucketTokenGovernanceImpl,
    _bucketMemoryGovernanceImpl: _bucketMemoryGovernanceImpl,
    _bucketRoutingQualityImpl: _bucketRoutingQualityImpl,
    _bucketLockInvariantsImpl: _bucketLockInvariantsImpl,
    _isPassFailureInjection: _isPassFailureInjection,
    _argValue: _argValue,
  },
};

if (require.main === module) {
  _main(process.argv);
}
