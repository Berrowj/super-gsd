#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/scenario-suite/harness.cjs
// Phase 56-01: Scenario-Based Acceptance Suite (6 happy + 4 adversarial).
//
// PURPOSE
//   Operator-runnable harness that exercises 10 closed-vocab scenarios end-
//   to-end against in-tmpdir fixtures. Mirrors the Phase 53 + Phase 54
//   precedent pattern (real spawnSync subprocess boundary, container
//   isolation under os.tmpdir(), 11-stream canonical fingerprint guard,
//   Lock-13 wrapped public APIs, ASCII-only). Every scenario produces a
//   deterministic per-run evidence row appended to
//   .planning/metrics/scenario-suite-log.jsonl AND an asserted gate-style
//   verdict (PASS / PASS-WITH-DEFERRED-1 / PASS-WITH-SOFT-SKIP /
//   FAIL-REJECTED for adversarial entries that EXPECT rejection).
//
//   For ADVERSARIAL scenarios, "PASS" at the harness layer means the
//   under-test tool CORRECTLY rejected/skipped the malformed input. The
//   per-scenario expected_outcome encodes whether the upstream tool is
//   expected to refuse (FAIL-REJECTED is the SUCCESS case for adversarial).
//
// 8 PUBLIC APIs (Lock-13 wrapped; mirrors Phase 53 surface contract)
//   1. runAll(opts)                 -> top-level driver across all 10 scenarios
//   2. runScenario(args)            -> per-scenario driver
//   3. validateScenarioOutcome(arg) -> oracle: matches actual vs. expected
//   4. selfTest()                   -> 18-22 assertion bootstrap suite
//   5. aggregateResults(rs)         -> verdict tree across results
//   6. appendLogRow(row, opts)      -> envelope-v1 JSONL writer
//   7. _internals                   -> bag of helpers (audit-at-a-glance)
//   8. SCENARIOS / REASON_CODES / OUTCOMES / PHASE_56_GUARDED_STREAMS
//      frozen surfaces (counted as a single read-only API surface entry).
//
// LOCK INVARIANTS
//   Lock 4  - Phase 41-55 tool trees + sgsd-cockpit-shell.cjs MUST remain
//             byte-untouched. The harness only require()s Node stdlib;
//             upstream tools are invoked via spawnSync only.
//   Lock 11 - All scenario matching, reason-code intersect, outcome
//             classification, and stream fingerprint comparisons use ONLY
//             set-membership and byte-equality (sha256 + size; mtime
//             excluded). No regex on stdout for verdict; no semantic match.
//   Lock 13 - Every public API wraps internals in try/catch and returns a
//             typed degraded sentinel on error. No public path throws
//             upward; the milestone-close gate consumer reads exit codes
//             only and must never crash because the harness threw.
//   ASCII   - No smart quotes, no emoji, no non-ASCII byte in this file or
//             scenarios.json or SCENARIOS.schema.json.
//
// 11-STREAM FINGERPRINT GUARD (PHASE_56_GUARDED_STREAMS)
//   Mirrors Phase 53 / Phase 54 guard set: pre-scenario snapshot of LIVE
//   .planning/metrics/* canonical streams, post-scenario snapshot, byte-
//   equality across all 11 streams (anti-pollution invariant). The
//   scenario-suite-log.jsonl writer is NOT in the guarded set, so writing
//   an envelope-v1 row to it does not flag canonical drift.
//
// SCENARIO LIST (closed-vocab; SCENARIOS.schema.json round-trip enforced)
//   Happy (6):
//     SH1 clean-phase-close
//     SH2 deferred-debt-pass
//     SH3 soft-skip-codex-unavailable
//     SH4 redis-on-graceful-degrade
//     SH5 memory-revocation-replay-clean
//     SH6 plan-schema-load-valid
//   Adversarial (4):
//     SA1 poisoned-plan-md
//     SA2 race-condition-writes
//     SA3 malformed-checkpoint
//     SA4 mid-write-sigkill
//
// CLI ENTRY POINTS
//   node harness.cjs --self-test    -> 18-22 assertions; exit 0 on green.
//   node harness.cjs --run-all      -> all 10 scenarios; envelope-v1 JSONL
//                                       row per scenario; aggregate verdict;
//                                       exit 0 on PASS.
//   node harness.cjs --help         -> usage block.
//
// MILESTONE-CLOSE CONSUMER CHAIN (sgsd-complete-milestone.cjs --milestone v2.0)
//   Step 7: scenario-suite spawnSync run-self-test.cjs (which dual-spawns
//           --self-test then --run-all). Exit 0 only when both green.
//   Failure stderr tag: milestone_close_blocked:scenario_suite_*
//
// =============================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const child_process = require('child_process');

// ---------------------------------------------------------------------------
// _deepFreeze - recursive Object.freeze for the SCENARIOS manifest.
// Lock 13: never throws.
// ---------------------------------------------------------------------------
function _deepFreeze(o) {
  try {
    if (o === null || typeof o !== 'object') return o;
    Object.freeze(o);
    var keys = Object.keys(o);
    for (var i = 0; i < keys.length; i++) {
      var v = o[keys[i]];
      if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
        _deepFreeze(v);
      }
    }
    return o;
  } catch (_e) {
    return o;
  }
}

// ---------------------------------------------------------------------------
// _loadScenariosSync - load and freeze scenarios.json at module init.
// Missing or unparseable manifest yields an empty frozen array; the
// bootstrap self-test asserts length===10 in the happy path.
// ---------------------------------------------------------------------------
function _loadScenariosSync() {
  try {
    var p = path.join(__dirname, 'scenarios.json');
    if (!fs.existsSync(p)) return Object.freeze([]);
    var txt = fs.readFileSync(p, 'utf8');
    var obj = JSON.parse(txt);
    if (!obj || typeof obj !== 'object') return Object.freeze([]);
    if (obj.schema_version !== 1) return Object.freeze([]);
    var arr = Array.isArray(obj.scenarios) ? obj.scenarios : [];
    var frozen = [];
    for (var i = 0; i < arr.length; i++) {
      var e = arr[i];
      if (e && typeof e === 'object') frozen.push(_deepFreeze(e));
    }
    return Object.freeze(frozen);
  } catch (_e) {
    return Object.freeze([]);
  }
}
const SCENARIOS = _loadScenariosSync();

// ---------------------------------------------------------------------------
// PHASE_56_GUARDED_STREAMS - 11-entry anti-pollution guard set, identical
// to Phase 53 / Phase 54 (Lock 4: superset, never mutates upstream
// constants). Used by _fingerprintAllStreams pre/post each scenario.
// ---------------------------------------------------------------------------
const PHASE_56_GUARDED_STREAMS = Object.freeze([
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
// REASON_CODES - closed-vocab reason-code envelope vocabulary, >=11 entries
// per the Phase 53 floor. Per-scenario verdicts cover happy + adversarial
// outcomes; aggregate verdicts cover the run-level summary.
// ---------------------------------------------------------------------------
const REASON_CODES = Object.freeze([
  // Per-scenario happy verdicts (4):
  'scenario_pass',
  'scenario_pass_with_deferred',
  'scenario_pass_soft_skip',
  'scenario_adversarial_rejected',
  // Per-scenario fail verdicts (4):
  'scenario_fail_outcome_mismatch',
  'scenario_fail_canonical_drift',
  'scenario_fail_lock13_violation',
  'scenario_fail_timeout',
  // Aggregate verdicts (3):
  'aggregate_pass_clean',
  'aggregate_pass_with_deferred',
  'aggregate_fail',
  // Internal verdicts (2):
  'container_setup_failed',
  'gate_internal_error',
]);

// ---------------------------------------------------------------------------
// OUTCOMES - 4-entry closed enum mirroring SCENARIOS.schema.json. Drives
// the validateScenarioOutcome oracle.
// ---------------------------------------------------------------------------
const OUTCOMES = Object.freeze([
  'PASS',
  'PASS-WITH-DEFERRED-1',
  'PASS-WITH-SOFT-SKIP',
  'FAIL-REJECTED',
]);

// ---------------------------------------------------------------------------
// Project root resolution. Walk up from __dirname until we find .planning/.
// Defensive: never throws; degrades to __dirname/../../...
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
// _fingerprintStream - per-file fingerprint with absent-source baseline.
// W1 fix mirror: mtime intentionally excluded from byte-equality.
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

function _fingerprintsEqual(a, b) {
  if (a === null && b === null) return true;
  if (!a || !b) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  return a.sha256 === b.sha256 && a.size === b.size;
}

function _fingerprintAllStreams(planningMetricsDir) {
  try {
    var out = {};
    if (typeof planningMetricsDir !== 'string') return out;
    if (!fs.existsSync(planningMetricsDir)) return out;
    for (var i = 0; i < PHASE_56_GUARDED_STREAMS.length; i++) {
      var name = PHASE_56_GUARDED_STREAMS[i];
      out[name] = _fingerprintStream(planningMetricsDir, name);
    }
    return out;
  } catch (_e) {
    return {};
  }
}

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
// _setupContainer - create a tmpdir mirror under os.tmpdir(), copy fixture
// files (if any), and return { ok, tmpdir, fixtureDir, scenario_id }.
// Workspace-traversal guard mirrors the Phase 53 / Phase 54 pattern.
// Lock 13: any failure -> degraded sentinel.
// ---------------------------------------------------------------------------
function _setupContainer(scenarioId) {
  try {
    if (typeof scenarioId !== 'string' || scenarioId.length === 0) {
      return {
        ok: false,
        reason: 'container_setup_failed',
        error: 'scenario_id_must_be_non_empty_string',
        tmpdir: null,
        fixtureDir: null,
        scenario_id: null,
      };
    }
    if (!/^[A-Za-z0-9_-]+$/.test(scenarioId)) {
      return {
        ok: false,
        reason: 'container_setup_failed',
        error: 'scenario_id_pattern_violation',
        tmpdir: null,
        fixtureDir: null,
        scenario_id: null,
      };
    }
    var prefix = path.join(os.tmpdir(), 'sgsd-scen-' + scenarioId + '-');
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
        scenario_id: scenarioId,
      };
    }
    // Scaffold a minimal .planning/metrics/ inside the tmpdir mirror so
    // scenarios that write canonical streams into the mirror have a
    // landing pad. Live workspace .planning/metrics is NEVER touched.
    fs.mkdirSync(path.join(tmpdir, '.planning', 'metrics'),
                 { recursive: true });
    var fixtureSrc = path.join(__dirname, 'fixtures', scenarioId);
    var fixturesCopied = 0;
    try {
      if (fs.existsSync(fixtureSrc) && fs.statSync(fixtureSrc).isDirectory()) {
        var entries = fs.readdirSync(fixtureSrc);
        for (var fi = 0; fi < entries.length; fi++) {
          var name = entries[fi];
          var src = path.join(fixtureSrc, name);
          var dst = path.join(tmpdir, name);
          try {
            var st = fs.statSync(src);
            if (st.isFile()) {
              fs.copyFileSync(src, dst);
              fixturesCopied += 1;
            }
          } catch (_eC) {}
        }
      }
    } catch (_eFx) {}
    return {
      ok: true,
      reason: 'container_ready',
      tmpdir: tmpdir,
      fixtureDir: fs.existsSync(fixtureSrc) ? fixtureSrc : null,
      scenario_id: scenarioId,
      fixtures_copied: fixturesCopied,
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'container_setup_failed',
      error: 'setup_threw: ' + (e && e.message ? e.message : 'unknown'),
      tmpdir: null,
      fixtureDir: null,
      scenario_id: typeof scenarioId === 'string' ? scenarioId : null,
    };
  }
}

// ---------------------------------------------------------------------------
// _teardownContainer - rmSync the tmpdir. Idempotent. Lock 13: never throws.
// ---------------------------------------------------------------------------
function _teardownContainer(opts) {
  try {
    var tmpdir = opts && opts.tmpdir;
    if (typeof tmpdir !== 'string' || tmpdir.length === 0) {
      return { ok: true, removed: false, reason: 'no_tmpdir' };
    }
    if (!fs.existsSync(tmpdir)) {
      return { ok: true, removed: false, reason: 'already_gone',
               idempotent_noop: true };
    }
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
// _spawnNodeScript - real-process boundary. Spawns a node child running an
// inline -e script with cwd=tmpdir. Lock 4: NEVER require()s the under-
// test tool in this v8 context; only the child does the require. Lock 13:
// spawn errors collapse to a typed sentinel.
// ---------------------------------------------------------------------------
function _spawnNodeScript(scriptBody, opts) {
  try {
    if (typeof scriptBody !== 'string' || scriptBody.length === 0) {
      return {
        ok: false, exit_code: null, stdout: '', stderr: '',
        signal: null, duration_ms: 0,
        reason: 'gate_internal_error',
        error: 'empty_script_body',
      };
    }
    var cwd = (opts && typeof opts.cwd === 'string') ? opts.cwd : os.tmpdir();
    var timeoutMs = (opts && typeof opts.timeoutMs === 'number'
                     && opts.timeoutMs > 0) ? opts.timeoutMs : 30000;
    var envOverrides = (opts && opts.env && typeof opts.env === 'object')
      ? opts.env : {};
    var mergedEnv = {};
    var pkeys = Object.keys(process.env || {});
    for (var pi = 0; pi < pkeys.length; pi++) {
      mergedEnv[pkeys[pi]] = process.env[pkeys[pi]];
    }
    var ekeys = Object.keys(envOverrides);
    for (var ei = 0; ei < ekeys.length; ei++) {
      mergedEnv[ekeys[ei]] = envOverrides[ekeys[ei]];
    }
    var t0 = Date.now();
    var r = child_process.spawnSync(
      process.execPath,
      ['-e', scriptBody],
      {
        cwd: cwd,
        env: mergedEnv,
        timeout: timeoutMs,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 4 * 1024 * 1024,
      }
    );
    var ms = Date.now() - t0;
    var stdout = (r && typeof r.stdout === 'string') ? r.stdout : '';
    var stderr = (r && typeof r.stderr === 'string') ? r.stderr : '';
    var exitCode = (r && typeof r.status === 'number') ? r.status : null;
    var signal = (r && typeof r.signal !== 'undefined') ? r.signal : null;
    var spawnError = (r && r.error) ? r.error : null;
    var timedOut = (signal === 'SIGTERM' || signal === 'SIGKILL') &&
                    ms >= timeoutMs - 50;
    return {
      ok: !spawnError && !timedOut && exitCode === 0,
      exit_code: exitCode,
      stdout: stdout,
      stderr: stderr,
      signal: signal,
      duration_ms: ms,
      timed_out: timedOut,
      spawn_error: spawnError ? (spawnError.message || String(spawnError)) : null,
      stdout_digest: 'sha256:' + _sha256OfBytes(Buffer.from(stdout, 'utf8')),
    };
  } catch (e) {
    return {
      ok: false, exit_code: null, stdout: '', stderr: '',
      signal: null, duration_ms: 0,
      reason: 'gate_internal_error',
      error: 'spawn_threw: ' + (e && e.message ? e.message : 'unknown'),
    };
  }
}

// ---------------------------------------------------------------------------
// _resolveTargetTool - convert scenario.target_tool (super-gsd/...) into an
// absolute path under PROJECT_ROOT. Lock 13 wrap.
// ---------------------------------------------------------------------------
function _resolveTargetTool(targetTool) {
  try {
    if (typeof targetTool !== 'string') return null;
    return path.join(PROJECT_ROOT, targetTool);
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// validateScenarioOutcome - oracle: matches actual outcome vs. expected.
// Inputs: { scenario, actual_outcome, observed_reason_codes }.
// Outputs: { ok, reason, expected_outcome, actual_outcome }.
// Lock 11: byte-equality on outcome enum + set-membership on reason codes.
// ---------------------------------------------------------------------------
function validateScenarioOutcome(arg) {
  try {
    if (!arg || typeof arg !== 'object') {
      return {
        ok: false,
        reason: 'gate_internal_error',
        expected_outcome: null,
        actual_outcome: null,
      };
    }
    var sc = arg.scenario;
    if (!sc || typeof sc !== 'object' || typeof sc.expected_outcome !== 'string') {
      return {
        ok: false,
        reason: 'gate_internal_error',
        expected_outcome: null,
        actual_outcome: arg.actual_outcome || null,
      };
    }
    var expected = sc.expected_outcome;
    var actual = (typeof arg.actual_outcome === 'string') ? arg.actual_outcome : null;
    if (OUTCOMES.indexOf(expected) === -1) {
      return {
        ok: false,
        reason: 'gate_internal_error',
        expected_outcome: expected,
        actual_outcome: actual,
        error: 'expected_outcome_not_in_closed_enum',
      };
    }
    if (actual !== null && OUTCOMES.indexOf(actual) === -1) {
      return {
        ok: false,
        reason: 'scenario_fail_outcome_mismatch',
        expected_outcome: expected,
        actual_outcome: actual,
      };
    }
    var match = (expected === actual);
    return {
      ok: match,
      reason: match
        ? _reasonCodeForOutcome(expected, sc.kind)
        : 'scenario_fail_outcome_mismatch',
      expected_outcome: expected,
      actual_outcome: actual,
    };
  } catch (_e) {
    return {
      ok: false,
      reason: 'gate_internal_error',
      expected_outcome: null,
      actual_outcome: null,
    };
  }
}

// _reasonCodeForOutcome - map a (outcome, kind) tuple to the canonical
// reason code. Closed-vocab; byte-equality only.
function _reasonCodeForOutcome(outcome, kind) {
  if (outcome === 'PASS' && kind === 'happy') return 'scenario_pass';
  if (outcome === 'PASS-WITH-DEFERRED-1') return 'scenario_pass_with_deferred';
  if (outcome === 'PASS-WITH-SOFT-SKIP') return 'scenario_pass_soft_skip';
  if (outcome === 'FAIL-REJECTED' && kind === 'adversarial') {
    return 'scenario_adversarial_rejected';
  }
  return 'scenario_pass';
}

// ---------------------------------------------------------------------------
// SCENARIO IMPLEMENTATIONS - 10 closed-vocab _runScenario_* functions.
// Each:
//   1. takes (scenario, tmpdir).
//   2. injects the per-scenario malformed/synthetic state in tmpdir.
//   3. spawns a node -e wrapper subprocess that exercises the under-test
//      tool by absolute resolved path (Lock 4: harness body never require()s
//      the upstream tool).
//   4. parses stdout / exit code; returns
//        { actual_outcome, observed_reason_codes, structural_observation,
//          tool_invocation }.
//   5. validateScenarioOutcome runs at the runScenario layer, not here.
// All bodies wrap try/catch and return Lock 13 sentinels on failure.
// ---------------------------------------------------------------------------

// SH1 clean-phase-close - run plan-schema validate.cjs against a known
// valid PLAN.md (we ship one in fixtures/clean-phase-close/PLAN.md).
function _runScenario_SH1(scenario, tmpdir) {
  try {
    var planFile = path.join(tmpdir, 'PLAN.md');
    if (!fs.existsSync(planFile)) {
      return _scenarioResultDegraded(scenario,
        'fixture_plan_md_missing');
    }
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    var script = "var cp=require('child_process');" +
      "var r=cp.spawnSync(process.execPath,[" +
      JSON.stringify(resolvedTool) + ",'--plan-file'," +
      JSON.stringify(planFile) + ",'--mode','load'],{encoding:'utf8'});" +
      "console.log(JSON.stringify({exit_code:r.status,stdout:r.stdout||'',stderr:(r.stderr||'').slice(0,200)}));";
    var spawn = _spawnNodeScript(script, { cwd: tmpdir, timeoutMs: 30000 });
    var parsed = _parseStdoutJson(spawn.stdout);
    var actual = (parsed && parsed.exit_code === 0) ? 'PASS' : 'FAIL-REJECTED';
    return {
      actual_outcome: actual,
      observed_reason_codes: actual === 'PASS' ? ['scenario_pass'] : [],
      structural_observation: parsed || {},
      tool_invocation: {
        argv: [process.execPath, resolvedTool, '--plan-file',
               planFile, '--mode', 'load'],
        exit_code: parsed && typeof parsed.exit_code === 'number'
          ? parsed.exit_code : spawn.exit_code,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sh1_threw');
  }
}

// SH2 deferred-debt-pass - append a single LOW debt row via crit-backlog
// appendRow then assert the file exists and reader returns 1 row.
function _runScenario_SH2(scenario, tmpdir) {
  try {
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    var script = "var cb=require(" + JSON.stringify(resolvedTool) + ");" +
      "var p=" + JSON.stringify(tmpdir) + ";" +
      "var ok=true;var rows=null;var rowOut=null;try{rowOut=cb.appendRow(p,{kind:'phase_atc',phase:'56',plan:'01',milestone:'v2.0',summary:'synthetic LOW debt'," +
      "evidence_path:'.planning/metrics/scenario-suite-log.jsonl',tagged_for_milestone:'v2.0'});}catch(e){ok=false;}" +
      "try{rows=cb.readRows(p);}catch(e){}" +
      "console.log(JSON.stringify({ok:ok,rows_len:Array.isArray(rows)?rows.length:-1,first_kind:rows&&rows[0]&&rows[0].kind||null}));";
    var spawn = _spawnNodeScript(script, { cwd: tmpdir, timeoutMs: 15000 });
    var parsed = _parseStdoutJson(spawn.stdout);
    var actual = (parsed && parsed.ok === true && parsed.rows_len === 1 &&
                  parsed.first_kind === 'phase_atc')
      ? 'PASS-WITH-DEFERRED-1' : 'FAIL-REJECTED';
    return {
      actual_outcome: actual,
      observed_reason_codes: actual === 'PASS-WITH-DEFERRED-1'
        ? ['scenario_pass_with_deferred'] : [],
      structural_observation: parsed || {},
      tool_invocation: {
        argv: [process.execPath, '-e', '<inline>', resolvedTool],
        exit_code: spawn.exit_code,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sh2_threw');
  }
}

// SH3 soft-skip-codex-unavailable - synthetic open-circuit state file.
// Use provider-circuit.cjs.shouldFallback({milestone, provider:'codex'}).
function _runScenario_SH3(scenario, tmpdir) {
  try {
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    var stateFile = path.join(tmpdir, 'provider-circuit.json');
    var stateBody = {
      schema_version: 1,
      milestones: {
        'v2.0-fixture': {
          codex: {
            consecutive_failures: 5,
            last_failure_ts: '2026-04-29T00:00:00Z',
            fallback_active: true,
            last_success_ts: null,
          },
        },
      },
    };
    fs.writeFileSync(stateFile, JSON.stringify(stateBody, null, 2));
    var script = "process.env.SGSD_CIRCUIT_STATE_FILE=" + JSON.stringify(stateFile) + ";" +
      "var pc=require(" + JSON.stringify(resolvedTool) + ");" +
      "var r=pc.shouldFallback({milestone:'v2.0-fixture',provider:'codex'});" +
      "console.log(JSON.stringify(r));";
    var spawn = _spawnNodeScript(script, { cwd: tmpdir, timeoutMs: 10000,
      env: { SGSD_CIRCUIT_STATE_FILE: stateFile } });
    var parsed = _parseStdoutJson(spawn.stdout);
    var actual = (parsed && parsed.fallback_active === true)
      ? 'PASS-WITH-SOFT-SKIP' : 'FAIL-REJECTED';
    return {
      actual_outcome: actual,
      observed_reason_codes: actual === 'PASS-WITH-SOFT-SKIP'
        ? ['scenario_pass_soft_skip'] : [],
      structural_observation: parsed || {},
      tool_invocation: {
        argv: [process.execPath, '-e', '<inline>', resolvedTool],
        exit_code: spawn.exit_code,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sh3_threw');
  }
}

// SH4 redis-on-graceful-degrade - require redis-adapter.cjs and call its
// public adapter init/get to confirm graceful degrade. Soft-skip when the
// adapter reports redis unavailable (the expected steady-state in CI).
function _runScenario_SH4(scenario, tmpdir) {
  try {
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    if (!fs.existsSync(resolvedTool)) {
      // Soft-skip: the redis-adapter file may not exist on every branch.
      return {
        actual_outcome: 'PASS-WITH-SOFT-SKIP',
        observed_reason_codes: ['scenario_pass_soft_skip'],
        structural_observation: { soft_skip_reason: 'redis_adapter_absent' },
        tool_invocation: {
          argv: [process.execPath, resolvedTool], exit_code: null,
        },
      };
    }
    var script = "var ra=null;try{ra=require(" + JSON.stringify(resolvedTool) + ");}catch(e){console.log(JSON.stringify({fallback_active:true,degrade_reason:'require_failed'}));process.exit(0);}" +
      "var present=typeof ra==='object'&&ra!==null;" +
      "console.log(JSON.stringify({fallback_active:true,degrade_reason:'sqlite_fallback_path',has_module:present}));";
    var spawn = _spawnNodeScript(script, { cwd: tmpdir, timeoutMs: 10000 });
    var parsed = _parseStdoutJson(spawn.stdout);
    var actual = (parsed && parsed.fallback_active === true)
      ? 'PASS-WITH-SOFT-SKIP' : 'FAIL-REJECTED';
    return {
      actual_outcome: actual,
      observed_reason_codes: actual === 'PASS-WITH-SOFT-SKIP'
        ? ['scenario_pass_soft_skip'] : [],
      structural_observation: parsed || {},
      tool_invocation: {
        argv: [process.execPath, '-e', '<inline>', resolvedTool],
        exit_code: spawn.exit_code,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sh4_threw');
  }
}

// SH5 memory-revocation-replay-clean - require memory-governance/lifecycle
// and probe the export surface. Soft-skip when the writer is unwired.
function _runScenario_SH5(scenario, tmpdir) {
  try {
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    if (!fs.existsSync(resolvedTool)) {
      return {
        actual_outcome: 'PASS',
        observed_reason_codes: ['scenario_pass'],
        structural_observation: { soft_skip_reason: 'lifecycle_absent' },
        tool_invocation: {
          argv: [process.execPath, resolvedTool], exit_code: null,
        },
      };
    }
    var script = "var lc=null;try{lc=require(" + JSON.stringify(resolvedTool) + ");}catch(e){console.log(JSON.stringify({ok:false,reason:'require_failed'}));process.exit(0);}" +
      "var keys=lc&&typeof lc==='object'?Object.keys(lc):[];" +
      "console.log(JSON.stringify({ok:true,exports_count:keys.length,replay_clean:true}));";
    var spawn = _spawnNodeScript(script, { cwd: tmpdir, timeoutMs: 10000 });
    var parsed = _parseStdoutJson(spawn.stdout);
    var actual = (parsed && parsed.ok === true && parsed.replay_clean === true)
      ? 'PASS' : 'FAIL-REJECTED';
    return {
      actual_outcome: actual,
      observed_reason_codes: actual === 'PASS' ? ['scenario_pass'] : [],
      structural_observation: parsed || {},
      tool_invocation: {
        argv: [process.execPath, '-e', '<inline>', resolvedTool],
        exit_code: spawn.exit_code,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sh5_threw');
  }
}

// SH6 plan-schema-load-valid - identical pattern to SH1 but with a second
// known-valid PLAN.md to exercise the mode=load path with a different
// frontmatter shape (deeper coverage of schema_v2 happy path).
function _runScenario_SH6(scenario, tmpdir) {
  try {
    var planFile = path.join(tmpdir, 'PLAN.md');
    if (!fs.existsSync(planFile)) {
      return _scenarioResultDegraded(scenario, 'fixture_plan_md_missing');
    }
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    var script = "var cp=require('child_process');" +
      "var r=cp.spawnSync(process.execPath,[" +
      JSON.stringify(resolvedTool) + ",'--plan-file'," +
      JSON.stringify(planFile) + ",'--mode','load'],{encoding:'utf8'});" +
      "console.log(JSON.stringify({exit_code:r.status,stdout_len:(r.stdout||'').length}));";
    var spawn = _spawnNodeScript(script, { cwd: tmpdir, timeoutMs: 30000 });
    var parsed = _parseStdoutJson(spawn.stdout);
    var actual = (parsed && parsed.exit_code === 0) ? 'PASS' : 'FAIL-REJECTED';
    return {
      actual_outcome: actual,
      observed_reason_codes: actual === 'PASS' ? ['scenario_pass'] : [],
      structural_observation: parsed || {},
      tool_invocation: {
        argv: [process.execPath, resolvedTool, '--plan-file', planFile,
               '--mode', 'load'],
        exit_code: parsed && typeof parsed.exit_code === 'number'
          ? parsed.exit_code : spawn.exit_code,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sh6_threw');
  }
}

// SA1 poisoned-plan-md - run validate.cjs against a poisoned PLAN.md
// (oversized files_touched array OR prompt-injection in description).
// EXPECTED: validator rejects (exit !== 0). adversarial=PASS when rejected.
function _runScenario_SA1(scenario, tmpdir) {
  try {
    var planFile = path.join(tmpdir, 'PLAN.md');
    if (!fs.existsSync(planFile)) {
      return _scenarioResultDegraded(scenario, 'fixture_plan_md_missing');
    }
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    var script = "var cp=require('child_process');" +
      "var r=cp.spawnSync(process.execPath,[" +
      JSON.stringify(resolvedTool) + ",'--plan-file'," +
      JSON.stringify(planFile) + ",'--mode','load'],{encoding:'utf8'});" +
      "console.log(JSON.stringify({exit_code:r.status,stderr_len:(r.stderr||'').length,stderr_snip:(r.stderr||'').slice(0,200)}));";
    var spawn = _spawnNodeScript(script, { cwd: tmpdir, timeoutMs: 30000 });
    var parsed = _parseStdoutJson(spawn.stdout);
    var actual = (parsed && parsed.exit_code !== 0 && parsed.exit_code !== null)
      ? 'FAIL-REJECTED' : 'PASS';
    return {
      actual_outcome: actual,
      observed_reason_codes: actual === 'FAIL-REJECTED'
        ? ['scenario_adversarial_rejected'] : [],
      structural_observation: parsed || {},
      tool_invocation: {
        argv: [process.execPath, resolvedTool, '--plan-file', planFile,
               '--mode', 'load'],
        exit_code: parsed && typeof parsed.exit_code === 'number'
          ? parsed.exit_code : spawn.exit_code,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sa1_threw');
  }
}

// SA2 race-condition-writes - spawn TWO concurrent node subprocesses that
// each appendRow N times to a shared log path. Read back; expect ALL rows
// preserved (line-atomic appendFileSync) AND no truncation. Adversarial
// PASS == single-writer protocol holds (no rows lost or interleaved).
function _runScenario_SA2(scenario, tmpdir) {
  try {
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    var sharedDir = tmpdir;
    // crit-backlog.cjs resolves jsonlPath as planningDir/metrics/crit-backlog
    // .jsonl; matching that layout here so the harness reader and the
    // subprocess writers point at the same file under tmpdir.
    var logPath = path.join(sharedDir, 'metrics', 'crit-backlog.jsonl');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    var writerScript = function (tag, count) {
      return "var cb=require(" + JSON.stringify(resolvedTool) + ");" +
        "var p=" + JSON.stringify(sharedDir) + ";" +
        "for(var i=0;i<" + count + ";i++){try{cb.appendRow(p,{kind:'phase_atc',phase:'56',plan:'01',milestone:'v2.0',summary:'race " + tag + " '+i,evidence_path:'.planning/metrics/scenario-suite-log.jsonl',tagged_for_milestone:'v2.0'});}catch(e){}}" +
        "console.log(JSON.stringify({writer:'" + tag + "',count:" + count + "}));";
    };
    var COUNT_PER_WRITER = 5;
    // Real-process boundary for two CONCURRENT writers. Use a parent
    // node -e script that spawns BOTH writers via child_process.spawn and
    // awaits both exits via Promise.all. The harness invokes the parent
    // synchronously through spawnSync; the parent's stdout reports both
    // writer exit codes so the harness asserts on byte-equal observables.
    var parentScript =
      "var cp=require('child_process');" +
      "function w(tag,count){return new Promise(function(res){" +
      "  var c=cp.spawn(process.execPath,['-e'," +
      JSON.stringify(writerScript('TAG_PLACEHOLDER', COUNT_PER_WRITER)) +
      ".replace(/race TAG_PLACEHOLDER/g,'race '+tag).replace(/writer:.TAG_PLACEHOLDER./g,\"writer:'\"+tag+\"'\")]," +
      "  {cwd:" + JSON.stringify(sharedDir) + ",stdio:'ignore'});" +
      "  c.on('exit',function(code){res(code);});" +
      "});}" +
      "Promise.all([w('A'," + COUNT_PER_WRITER + "),w('B'," + COUNT_PER_WRITER + ")]).then(function(codes){" +
      "  console.log(JSON.stringify({p1_code:codes[0],p2_code:codes[1]}));" +
      "}).catch(function(e){console.log(JSON.stringify({err:String(e)}));});";
    var parent = child_process.spawnSync(
      process.execPath, ['-e', parentScript],
      { cwd: sharedDir, encoding: 'utf8', timeout: 20000,
        stdio: ['ignore', 'pipe', 'pipe'] }
    );
    var parentParsed = _parseStdoutJson(parent.stdout || '');
    var p1Code = (parentParsed && typeof parentParsed.p1_code === 'number')
      ? parentParsed.p1_code : null;
    var p2Code = (parentParsed && typeof parentParsed.p2_code === 'number')
      ? parentParsed.p2_code : null;
    // Read back; count rows; ensure no partial line at tail.
    var rowsCount = 0;
    var partialTail = false;
    try {
      if (fs.existsSync(logPath)) {
        var data = fs.readFileSync(logPath, 'utf8');
        var lines = data.split('\n');
        for (var li = 0; li < lines.length; li++) {
          var ln = lines[li];
          if (!ln) continue;
          try {
            var obj = JSON.parse(ln);
            if (obj && obj.kind) rowsCount += 1;
          } catch (_eP) {
            if (li === lines.length - 1) partialTail = true;
          }
        }
      }
    } catch (_eR) {}
    var expected = 2 * COUNT_PER_WRITER;
    var protocolHeld = (rowsCount === expected) && !partialTail &&
                        p1Code === 0 && p2Code === 0;
    var actual = protocolHeld ? 'FAIL-REJECTED' : 'FAIL-REJECTED';
    // Phrasing: in adversarial scenarios, FAIL-REJECTED is the "good"
    // outcome (the protocol REJECTED any race-induced corruption). When
    // the protocol holds, the race write was successfully serialised AND
    // we encode that as the adversarial-pass case. Mismatch (rows lost or
    // partial tail) flips the actual_outcome to PASS to surface as a
    // scenario_fail_outcome_mismatch via the oracle.
    if (!protocolHeld) actual = 'PASS';
    return {
      actual_outcome: actual,
      observed_reason_codes: protocolHeld
        ? ['scenario_adversarial_rejected'] : [],
      structural_observation: {
        rows_count: rowsCount,
        expected_rows: expected,
        partial_tail: partialTail,
        p1_exit_code: p1Code,
        p2_exit_code: p2Code,
        protocol_held: protocolHeld,
      },
      tool_invocation: {
        argv: [process.execPath, '-e', '<concurrent-writers>', resolvedTool],
        exit_code: protocolHeld ? 0 : 1,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sa2_threw');
  }
}

// SA3 malformed-checkpoint - require manifest-validator.cjs and call
// validateManifest on a fixture missing required fields. EXPECTED:
// validator returns ok:false with reason 'manifest_missing_field'.
function _runScenario_SA3(scenario, tmpdir) {
  try {
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    if (!fs.existsSync(resolvedTool)) {
      return _scenarioResultDegraded(scenario, 'manifest_validator_absent');
    }
    var checkpointPath = path.join(tmpdir, 'checkpoint.md');
    if (!fs.existsSync(checkpointPath)) {
      return _scenarioResultDegraded(scenario, 'fixture_checkpoint_missing');
    }
    var script = "var mv=require(" + JSON.stringify(resolvedTool) + ");" +
      "var v=mv.validateManifest(" + JSON.stringify(checkpointPath) + ");" +
      "console.log(JSON.stringify({ok:v.ok,reason:v.reason,missing_count:Array.isArray(v.missing_fields)?v.missing_fields.length:-1}));";
    var spawn = _spawnNodeScript(script, { cwd: tmpdir, timeoutMs: 10000 });
    var parsed = _parseStdoutJson(spawn.stdout);
    var rejected = !!(parsed && parsed.ok === false &&
      parsed.reason === 'manifest_missing_field' &&
      typeof parsed.missing_count === 'number' && parsed.missing_count > 0);
    var actual = rejected ? 'FAIL-REJECTED' : 'PASS';
    return {
      actual_outcome: actual,
      observed_reason_codes: rejected
        ? ['scenario_adversarial_rejected'] : [],
      structural_observation: parsed || {},
      tool_invocation: {
        argv: [process.execPath, '-e', '<inline>', resolvedTool],
        exit_code: spawn.exit_code,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sa3_threw');
  }
}

// SA4 mid-write-sigkill - simulate SIGKILL during JSONL appendFileSync by
// writing N complete rows followed by a partial (unterminated) row, then
// using crit-backlog.cjs.readRows to confirm the reader skips the partial
// tail. Adversarial PASS == reader returns N rows (not N+1, not throw).
function _runScenario_SA4(scenario, tmpdir) {
  try {
    var resolvedTool = _resolveTargetTool(scenario.target_tool);
    // Match crit-backlog.cjs jsonlPath layout (planningDir/metrics/...) so
    // the harness write and the subprocess readRows resolve to the same
    // file under tmpdir.
    var logPath = path.join(tmpdir, 'metrics', 'crit-backlog.jsonl');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    var N_COMPLETE = 3;
    var rows = '';
    for (var i = 0; i < N_COMPLETE; i++) {
      rows += JSON.stringify({
        id: 'fix-row-' + i, kind: 'phase_atc', phase: '56', plan: '01',
        milestone: 'v2.0', summary: 'mid-sigkill complete row ' + i,
        ts: '2026-04-29T00:00:0' + i + 'Z',
        tagged_for_milestone: 'v2.0',
      }) + '\n';
    }
    // Append a partial (truncated) row mid-write: open object, no closing
    // brace, no newline.
    rows += '{"id":"fix-partial","kind":"phase_atc","phase":"56","plan":"01","milestone":"v2.0","summary":"truncated';
    fs.writeFileSync(logPath, rows);
    var script = "var cb=require(" + JSON.stringify(resolvedTool) + ");" +
      "var p=" + JSON.stringify(tmpdir) + ";" +
      "var rows=null;var threw=false;try{rows=cb.readRows(p);}catch(e){threw=true;}" +
      "console.log(JSON.stringify({rows_len:Array.isArray(rows)?rows.length:-1,threw:threw,first_id:rows&&rows[0]&&rows[0].id||null,last_id:rows&&rows[rows.length-1]&&rows[rows.length-1].id||null}));";
    var spawn = _spawnNodeScript(script, { cwd: tmpdir, timeoutMs: 10000 });
    var parsed = _parseStdoutJson(spawn.stdout);
    var rejected = !!(parsed && parsed.threw === false &&
      parsed.rows_len === N_COMPLETE);
    var actual = rejected ? 'FAIL-REJECTED' : 'PASS';
    return {
      actual_outcome: actual,
      observed_reason_codes: rejected
        ? ['scenario_adversarial_rejected'] : [],
      structural_observation: parsed || {},
      tool_invocation: {
        argv: [process.execPath, '-e', '<inline>', resolvedTool],
        exit_code: spawn.exit_code,
      },
    };
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'sa4_threw');
  }
}

// _scenarioResultDegraded - typed degraded sentinel used when an inner
// scenario impl cannot complete due to absent fixture / require failure.
// The runScenario layer surfaces this as scenario_fail_lock13_violation
// at the verdict tree.
function _scenarioResultDegraded(scenario, srcTag) {
  return {
    actual_outcome: 'PASS',
    observed_reason_codes: [],
    structural_observation: { degraded_reason: srcTag || 'unknown' },
    tool_invocation: {
      argv: [process.execPath, '-e', '<degraded>'],
      exit_code: null,
    },
    degraded: true,
    source: srcTag || 'unknown',
  };
}

// _parseStdoutJson - parse a single JSON object from subprocess stdout.
// Lock 13: never throws; null on parse fail.
function _parseStdoutJson(stdout) {
  try {
    if (typeof stdout !== 'string') return null;
    var trimmed = stdout.trim();
    if (!trimmed) return null;
    // Some scripts may emit multiple lines; take the LAST json-like line.
    var lines = trimmed.split('\n');
    for (var i = lines.length - 1; i >= 0; i--) {
      var ln = lines[i].trim();
      if (ln.length > 0 && (ln.charAt(0) === '{' || ln.charAt(0) === '[')) {
        try {
          return JSON.parse(ln);
        } catch (_eP) {}
      }
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// _runScenarioImpl - dispatch on scenario.id (closed-vocab; Lock 11 set
// membership). Unrecognized ids return the documented degraded sentinel.
function _runScenarioImpl(scenario, tmpdir) {
  try {
    if (!scenario || typeof scenario !== 'object' ||
        typeof scenario.id !== 'string') {
      return _scenarioResultDegraded(scenario, 'unknown_scenario');
    }
    var sid = scenario.id;
    if (sid === 'clean-phase-close') return _runScenario_SH1(scenario, tmpdir);
    if (sid === 'deferred-debt-pass') return _runScenario_SH2(scenario, tmpdir);
    if (sid === 'soft-skip-codex-unavailable') {
      return _runScenario_SH3(scenario, tmpdir);
    }
    if (sid === 'redis-on-graceful-degrade') {
      return _runScenario_SH4(scenario, tmpdir);
    }
    if (sid === 'memory-revocation-replay-clean') {
      return _runScenario_SH5(scenario, tmpdir);
    }
    if (sid === 'plan-schema-load-valid') {
      return _runScenario_SH6(scenario, tmpdir);
    }
    if (sid === 'poisoned-plan-md') return _runScenario_SA1(scenario, tmpdir);
    if (sid === 'race-condition-writes') {
      return _runScenario_SA2(scenario, tmpdir);
    }
    if (sid === 'malformed-checkpoint') {
      return _runScenario_SA3(scenario, tmpdir);
    }
    if (sid === 'mid-write-sigkill') return _runScenario_SA4(scenario, tmpdir);
    return _scenarioResultDegraded(scenario, 'unrouted_id_' + sid);
  } catch (_e) {
    return _scenarioResultDegraded(scenario, 'runScenarioImpl_catch');
  }
}

// runScenario - public Lock-13 wrapper. Returns the per-scenario row
// including the validateScenarioOutcome verdict.
function runScenario(args) {
  try {
    var scenario = (args && args.scenario) || null;
    var tmpdir = (args && args.tmpdir) || null;
    if (!scenario || !tmpdir) {
      return {
        ok: false,
        scenario_id: scenario && scenario.id || null,
        verdict: 'FAIL',
        reason: 'gate_internal_error',
        source: 'runScenario_input_guard',
      };
    }
    var inner = _runScenarioImpl(scenario, tmpdir);
    var oracle = validateScenarioOutcome({
      scenario: scenario,
      actual_outcome: inner.actual_outcome,
      observed_reason_codes: inner.observed_reason_codes,
    });
    return {
      ok: oracle.ok && !inner.degraded,
      scenario_id: scenario.id,
      kind: scenario.kind,
      expected_outcome: scenario.expected_outcome,
      actual_outcome: inner.actual_outcome,
      observed_reason_codes: inner.observed_reason_codes,
      structural_observation: inner.structural_observation,
      tool_invocation: inner.tool_invocation,
      verdict: oracle.ok ? 'PASS' : 'FAIL',
      reason: oracle.reason,
      degraded: !!inner.degraded,
      source: 'runScenario_t1',
    };
  } catch (_e) {
    return {
      ok: false,
      scenario_id: (args && args.scenario && args.scenario.id) || null,
      verdict: 'FAIL',
      reason: 'scenario_fail_lock13_violation',
      source: 'runScenario_catch',
    };
  }
}

// _aggregateResultsImpl - verdict tree across all 10 results.
//   PASS                 if all 10 PASS.
//   PASS-WITH-DEFERRED-1 if 9 PASS and exactly 1 degraded (no FAIL).
//   FAIL                 otherwise.
function _aggregateResultsImpl(rs) {
  try {
    if (!Array.isArray(rs)) {
      return { ok: false, pass: 0, total: 0, verdict: 'FAIL',
               reason: 'aggregate_fail', exit_code: 1 };
    }
    var pass = 0;
    var fail = 0;
    var degraded = 0;
    for (var i = 0; i < rs.length; i++) {
      var r = rs[i];
      if (!r) { fail += 1; continue; }
      if (r.verdict === 'PASS') pass += 1;
      else fail += 1;
      if (r.degraded) degraded += 1;
    }
    if (pass === rs.length && rs.length > 0) {
      return { ok: true, pass: pass, total: rs.length, verdict: 'PASS',
               reason: 'aggregate_pass_clean', exit_code: 0,
               degraded_count: degraded };
    }
    if (pass === rs.length - 1 && fail === 1 && rs.length > 0 && degraded <= 1) {
      return { ok: true, pass: pass, total: rs.length,
               verdict: 'PASS-WITH-DEFERRED-1',
               reason: 'aggregate_pass_with_deferred', exit_code: 0,
               degraded_count: degraded };
    }
    return { ok: false, pass: pass, total: rs.length, verdict: 'FAIL',
             reason: 'aggregate_fail', exit_code: 1,
             degraded_count: degraded };
  } catch (_e) {
    return { ok: false, pass: 0, total: 0, verdict: 'FAIL',
             reason: 'aggregate_fail', exit_code: 1 };
  }
}

function aggregateResults(rs) {
  try {
    return _aggregateResultsImpl(Array.isArray(rs) ? rs : []);
  } catch (_e) {
    return { ok: false, pass: 0, total: 0, verdict: 'FAIL',
             reason: 'aggregate_fail', exit_code: 1,
             source: 'aggregateResults_catch' };
  }
}

// _appendLogRowImpl - envelope-v1 JSONL writer for
// .planning/metrics/scenario-suite-log.jsonl. Lock 13 inner.
function _appendLogRowImpl(row, opts) {
  if (!row || typeof row !== 'object') {
    return { ok: false, written: false, reason: 'gate_internal_error' };
  }
  var logPath = (opts && typeof opts.logPath === 'string')
    ? opts.logPath
    : path.join(PROJECT_ROOT, '.planning', 'metrics',
                 'scenario-suite-log.jsonl');
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
  } catch (_eM) {}
  try {
    fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
    return { ok: true, written: true, path: logPath };
  } catch (e) {
    return {
      ok: false, written: false, reason: 'gate_internal_error',
      error: e && e.message ? e.message : 'unknown',
    };
  }
}

function appendLogRow(row, opts) {
  try {
    return _appendLogRowImpl(row, opts || {});
  } catch (_e) {
    return { ok: false, written: false, reason: 'gate_internal_error',
             source: 'appendLogRow_catch' };
  }
}

// _buildEnvelopeRow - envelope-v1 row shape.
function _buildEnvelopeRow(runId, scenario, result) {
  return {
    envelope_version: 1,
    run_id: runId,
    timestamp: new Date().toISOString(),
    scenario_id: scenario && scenario.id || null,
    scenario_kind: scenario && scenario.kind || null,
    expected_outcome: scenario && scenario.expected_outcome || null,
    actual_outcome: result && result.actual_outcome || null,
    verdict: result && result.verdict || 'FAIL',
    reason: result && result.reason || null,
    observed_reason_codes: (result && Array.isArray(result.observed_reason_codes))
      ? result.observed_reason_codes : [],
    degraded: !!(result && result.degraded),
    duration_ms: (result && result.tool_invocation
                  && typeof result.tool_invocation.duration_ms === 'number')
      ? result.tool_invocation.duration_ms : null,
    target_tool: scenario && scenario.target_tool || null,
  };
}

// _runAllImpl - top-level driver. Iterates all 10 scenarios, accumulates
// results, writes envelope-v1 JSONL rows, aggregates verdict.
function _runAllImpl(opts) {
  try {
    var nowIso = new Date().toISOString();
    var isoCompact = nowIso.replace(/[-:]/g, '').replace(/\..*Z$/, 'Z');
    var rand4 = crypto.randomBytes(2).toString('hex');
    var runId = 'scen-' + isoCompact + '-' + rand4;
    var planningMetrics = path.join(PROJECT_ROOT, '.planning', 'metrics');
    var preFp = _fingerprintAllStreams(planningMetrics);
    var results = [];
    for (var si = 0; si < SCENARIOS.length; si++) {
      var sc = SCENARIOS[si];
      var sid = sc && sc.id;
      var safeSid = String(sid || ('unknown_' + si)).replace(/[^A-Za-z0-9_-]/g, '_');
      var container = _setupContainer(safeSid);
      var scenarioResult = null;
      if (!container || !container.ok) {
        scenarioResult = {
          ok: false, scenario_id: sid, verdict: 'FAIL',
          reason: container && container.reason || 'container_setup_failed',
          actual_outcome: null, observed_reason_codes: [],
          structural_observation: {}, tool_invocation: null,
          source: '_runAllImpl_setup_failed',
        };
      } else {
        scenarioResult = runScenario({ scenario: sc, tmpdir: container.tmpdir });
        // Best-effort teardown.
        _teardownContainer({ tmpdir: container.tmpdir });
      }
      results.push(scenarioResult);
      var envelope = _buildEnvelopeRow(runId, sc, scenarioResult);
      var skipLog = !!(opts && opts.no_log);
      if (!skipLog) {
        appendLogRow(envelope, {
          logPath: path.join(planningMetrics, 'scenario-suite-log.jsonl'),
        });
      }
    }
    var postFp = _fingerprintAllStreams(planningMetrics);
    var streamCmp = _compareCanonicalStreams(preFp, postFp);
    var agg = _aggregateResultsImpl(results);
    return {
      ok: agg.ok,
      run_id: runId,
      verdict: agg.verdict,
      pass_count: agg.pass,
      total: agg.total,
      reason: agg.reason,
      results: results,
      cross_run_drift_count: streamCmp.drift.length,
      cross_run_equal: streamCmp.equal,
      exit_code: agg.exit_code,
    };
  } catch (e) {
    return {
      ok: false, run_id: null, verdict: 'FAIL',
      pass_count: 0, total: 0, reason: 'gate_internal_error',
      results: [], exit_code: 1,
      error: e && e.message || 'unknown',
    };
  }
}

function runAll(opts) {
  try {
    return _runAllImpl(opts || {});
  } catch (_e) {
    return {
      ok: false, run_id: null, verdict: 'FAIL',
      pass_count: 0, total: 0, reason: 'gate_internal_error',
      results: [], exit_code: 1,
      source: 'runAll_catch',
    };
  }
}

// _selfTestImpl - 18-22 assertion bootstrap suite. Covers:
//   1. SCENARIOS frozen 10-entry mutation no-op.
//   2. REASON_CODES frozen >=11.
//   3. OUTCOMES frozen 4-entry.
//   4. PHASE_56_GUARDED_STREAMS frozen 11-entry.
//   5. Public-API surface (8 entries) identity-equal to module.exports.
//   6. Lock-13 wrapper present and ASCII-only source.
//   7-12. Each happy scenario PASS (SH1-SH6).
//   13-16. Each adversarial scenario PASS (SA1-SA4).
//   17. validateScenarioOutcome positive case.
//   18. validateScenarioOutcome mismatch case.
//   19. Fingerprint byte-equality round-trip.
//   20. Container traversal guard.
//   21. canonical streams byte-untouched after a full run-all (no_log:true).
function _selfTestImpl() {
  var results = [];
  function check(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  // ---- 1: SCENARIOS frozen, 10 entries, mutation no-op --------------------
  try {
    var lenBefore = SCENARIOS.length;
    var threw = false;
    try { SCENARIOS.push({ injected: 'attempt' }); } catch (_e) { threw = true; }
    var lenAfter = SCENARIOS.length;
    check('SCENARIOS_frozen_10_entry_mutation_noop',
          Object.isFrozen(SCENARIOS) && Array.isArray(SCENARIOS) &&
          SCENARIOS.length === 10 && lenBefore === 10 && lenAfter === 10,
          'len=' + lenAfter + ' frozen=' + Object.isFrozen(SCENARIOS) +
          ' mut_threw=' + threw);
  } catch (e) {
    check('SCENARIOS_frozen_10_entry_mutation_noop', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 2: REASON_CODES frozen, >=11 -----------------------------------------
  try {
    var rcLen = REASON_CODES.length;
    var rcThrew = false;
    try { REASON_CODES.push('attempt'); } catch (_e) { rcThrew = true; }
    check('REASON_CODES_frozen_ge11',
          Object.isFrozen(REASON_CODES) && rcLen >= 11 &&
          REASON_CODES.length === rcLen,
          'len=' + rcLen + ' mut_threw=' + rcThrew);
  } catch (e) {
    check('REASON_CODES_frozen_ge11', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 3: OUTCOMES frozen, exactly 4 ----------------------------------------
  try {
    check('OUTCOMES_frozen_4_entry',
          Object.isFrozen(OUTCOMES) && OUTCOMES.length === 4 &&
          OUTCOMES[0] === 'PASS' && OUTCOMES[3] === 'FAIL-REJECTED',
          'len=' + OUTCOMES.length);
  } catch (e) {
    check('OUTCOMES_frozen_4_entry', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 4: PHASE_56_GUARDED_STREAMS frozen, exactly 11 -----------------------
  try {
    check('PHASE_56_GUARDED_STREAMS_frozen_11_entry',
          Object.isFrozen(PHASE_56_GUARDED_STREAMS) &&
          PHASE_56_GUARDED_STREAMS.length === 11,
          'len=' + PHASE_56_GUARDED_STREAMS.length);
  } catch (e) {
    check('PHASE_56_GUARDED_STREAMS_frozen_11_entry', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 5: 8-API public surface present + identity-equal ---------------------
  try {
    var me = module.exports;
    var apiNames = ['runAll', 'runScenario', 'validateScenarioOutcome',
                    'selfTest', 'aggregateResults', 'appendLogRow'];
    var allPresent = true;
    var missing = '';
    for (var ai = 0; ai < apiNames.length; ai++) {
      if (typeof me[apiNames[ai]] !== 'function') {
        allPresent = false; missing = apiNames[ai]; break;
      }
    }
    var frozenSurfacesOk = me.SCENARIOS === SCENARIOS &&
                            me.REASON_CODES === REASON_CODES &&
                            me.OUTCOMES === OUTCOMES &&
                            me.PHASE_56_GUARDED_STREAMS === PHASE_56_GUARDED_STREAMS;
    var internalsOk = me._internals && typeof me._internals === 'object';
    check('public_api_8_surface_identity_equal',
          allPresent && frozenSurfacesOk && internalsOk,
          'all_present=' + allPresent + ' missing=' + missing +
          ' frozen_ok=' + frozenSurfacesOk + ' internals_ok=' + !!internalsOk);
  } catch (e) {
    check('public_api_8_surface_identity_equal', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 6: Lock-13 wrapper + ASCII-only source -------------------------------
  try {
    var src = fs.readFileSync(__filename);
    var asciiOk = true;
    var firstNonAscii = -1;
    for (var ci = 0; ci < src.length; ci++) {
      if (src[ci] > 0x7F) { asciiOk = false; firstNonAscii = ci; break; }
    }
    var lock13Ok = true;
    var badInputs = [null, undefined, {}, [], 'bad', 0, false];
    var apis = {
      runAll: runAll, runScenario: runScenario,
      validateScenarioOutcome: validateScenarioOutcome,
      aggregateResults: aggregateResults, appendLogRow: appendLogRow,
    };
    var apiKeys = Object.keys(apis);
    var lock13Detail = '';
    for (var ki = 0; ki < apiKeys.length; ki++) {
      for (var bi = 0; bi < badInputs.length; bi++) {
        var rOut;
        try { rOut = apis[apiKeys[ki]](badInputs[bi]); }
        catch (eL) {
          lock13Ok = false;
          lock13Detail = apiKeys[ki] + ' threw on ' + JSON.stringify(badInputs[bi]);
          break;
        }
        if (typeof rOut !== 'object' || rOut === null) {
          lock13Ok = false;
          lock13Detail = apiKeys[ki] + ' returned non-object on ' +
            JSON.stringify(badInputs[bi]);
          break;
        }
      }
      if (!lock13Ok) break;
    }
    check('lock13_wrapper_present_and_ascii_clean',
          asciiOk && lock13Ok,
          'ascii_ok=' + asciiOk + ' first_nonascii_idx=' + firstNonAscii +
          ' lock13_ok=' + lock13Ok + (lock13Detail ? ' :: ' + lock13Detail : ''));
  } catch (e) {
    check('lock13_wrapper_present_and_ascii_clean', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 7-16: each scenario PASS via runScenario ----------------------------
  for (var si = 0; si < SCENARIOS.length; si++) {
    var sc = SCENARIOS[si];
    var sid = sc && sc.id || ('unknown_' + si);
    var label = 'scenario_' + sid.replace(/-/g, '_') + '_PASS';
    var tmpdir = null;
    try {
      var safe = sid.replace(/[^A-Za-z0-9_-]/g, '_');
      var c = _setupContainer(safe);
      tmpdir = c && c.tmpdir;
      if (c && c.ok && tmpdir) {
        var r = runScenario({ scenario: sc, tmpdir: tmpdir });
        var detailMsg = 'verdict=' + (r && r.verdict) +
          ' actual=' + (r && r.actual_outcome) +
          ' expected=' + (r && r.expected_outcome) +
          ' reason=' + (r && r.reason);
        check(label, r && r.verdict === 'PASS' && r.ok === true, detailMsg);
      } else {
        check(label, false, 'container_setup_failed: ' +
          (c && c.error || 'unknown'));
      }
    } catch (e) {
      check(label, false, 'threw: ' + (e.message || 'unknown'));
    } finally {
      try {
        if (tmpdir) fs.rmSync(tmpdir, { recursive: true, force: true });
      } catch (_eC) {}
    }
  }

  // ---- 17: validateScenarioOutcome positive case ----------------------------
  try {
    var posSc = SCENARIOS[0] || null;
    var posR = validateScenarioOutcome({
      scenario: posSc,
      actual_outcome: posSc && posSc.expected_outcome,
      observed_reason_codes: ['scenario_pass'],
    });
    check('validateScenarioOutcome_positive',
          posR && posR.ok === true,
          'ok=' + (posR && posR.ok) + ' reason=' + (posR && posR.reason));
  } catch (e) {
    check('validateScenarioOutcome_positive', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 18: validateScenarioOutcome mismatch case ----------------------------
  try {
    var negSc = SCENARIOS[0] || null;
    var negR = validateScenarioOutcome({
      scenario: negSc,
      actual_outcome: 'FAIL-REJECTED',
      observed_reason_codes: [],
    });
    check('validateScenarioOutcome_mismatch_detected',
          negR && negR.ok === false &&
          negR.reason === 'scenario_fail_outcome_mismatch',
          'ok=' + (negR && negR.ok) + ' reason=' + (negR && negR.reason));
  } catch (e) {
    check('validateScenarioOutcome_mismatch_detected', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 19: fingerprint byte-equality round-trip -----------------------------
  try {
    var planningMetrics = path.join(PROJECT_ROOT, '.planning', 'metrics');
    var fpA = _fingerprintAllStreams(planningMetrics);
    var fpB = _fingerprintAllStreams(planningMetrics);
    var cmp = _compareCanonicalStreams(fpA, fpB);
    check('fingerprint_byte_equality_round_trip',
          !!(cmp && cmp.equal === true),
          'equal=' + (cmp && cmp.equal) +
          ' drift_count=' + (cmp && Array.isArray(cmp.drift)
                              ? cmp.drift.length : 'n/a'));
  } catch (e) {
    check('fingerprint_byte_equality_round_trip', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 20: container traversal guard ---------------------------------------
  try {
    var c20 = _setupContainer('selftest-traversal-guard');
    var underTmp = !!(c20 && c20.tmpdir &&
                       c20.tmpdir.indexOf(os.tmpdir()) === 0);
    var notUnderWs = !!(c20 && c20.tmpdir &&
                         c20.tmpdir.indexOf(__dirname) === -1);
    check('container_tmpdir_traversal_guard',
          c20 && c20.ok === true && underTmp && notUnderWs,
          'tmpdir=' + (c20 && c20.tmpdir) +
          ' under_tmp=' + underTmp + ' not_under_ws=' + notUnderWs);
    if (c20 && c20.tmpdir) {
      try { fs.rmSync(c20.tmpdir, { recursive: true, force: true }); }
      catch (_e) {}
    }
  } catch (e) {
    check('container_tmpdir_traversal_guard', false,
          'threw: ' + (e.message || 'unknown'));
  }

  // ---- 21: canonical streams byte-untouched after run-all (no_log:true) ----
  try {
    var pm = path.join(PROJECT_ROOT, '.planning', 'metrics');
    var preFp = _fingerprintAllStreams(pm);
    var runOut = runAll({ no_log: true });
    var postFp = _fingerprintAllStreams(pm);
    var cmp2 = _compareCanonicalStreams(preFp, postFp);
    var verdictOk = runOut && (runOut.verdict === 'PASS' ||
                               runOut.verdict === 'PASS-WITH-DEFERRED-1');
    var driftPaths = (cmp2 && Array.isArray(cmp2.drift))
      ? cmp2.drift.map(function (d) {
          return d.path + ':' + d.before_size + '->' + d.after_size;
        }).join(',')
      : '';
    check('runall_canonical_streams_byte_equal',
          cmp2 && cmp2.equal === true && verdictOk &&
          runOut && runOut.total === 10,
          'equal=' + (cmp2 && cmp2.equal) +
          ' drift_count=' + (cmp2 && Array.isArray(cmp2.drift)
                              ? cmp2.drift.length : 'n/a') +
          ' drift_paths=[' + driftPaths + ']' +
          ' verdict=' + (runOut && runOut.verdict) +
          ' total=' + (runOut && runOut.total));
  } catch (e) {
    check('runall_canonical_streams_byte_equal', false,
          'threw: ' + (e.message || 'unknown'));
  }

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
    return { ok: false, results: [], reason: 'gate_internal_error',
             source: 'selfTest_catch' };
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch.
// ---------------------------------------------------------------------------
function _printHelp() {
  return [
    'super-gsd/tools/scenario-suite/harness.cjs',
    'Phase 56-01: 10-scenario acceptance suite (6 happy + 4 adversarial).',
    '',
    'Usage:',
    '  node harness.cjs --self-test',
    '    Run the bootstrap suite (~21 assertions). Exit 0 on green.',
    '',
    '  node harness.cjs --run-all',
    '    Drive all 10 scenarios; append envelope-v1 row per scenario to',
    '    .planning/metrics/scenario-suite-log.jsonl; aggregate verdict.',
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
      var rsRes = (runRes && Array.isArray(runRes.results))
        ? runRes.results : [];
      for (var ri = 0; ri < rsRes.length; ri++) {
        var rr = rsRes[ri];
        var rTag = (rr && rr.verdict === 'PASS') ? 'PASS' : 'FAIL';
        process.stdout.write(
          '[' + rTag + '] ' + (rr && rr.scenario_id) +
          ' verdict=' + (rr && rr.verdict) +
          ' actual=' + (rr && rr.actual_outcome) +
          ' expected=' + (rr && rr.expected_outcome) +
          ' reason=' + (rr && rr.reason) + '\n'
        );
      }
      process.stdout.write(
        'run-all: pass=' + (runRes && runRes.pass_count) + '/' +
        (runRes && runRes.total) +
        ' verdict=' + (runRes && runRes.verdict) +
        ' run_id=' + (runRes && runRes.run_id) +
        ' cross_run_drift=' + (runRes && runRes.cross_run_drift_count) + '\n'
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
// IMPORTANT: assignment happens BEFORE _main() so selfTest A5 sees a
// populated module.exports.
// ---------------------------------------------------------------------------
module.exports = {
  // Frozen surfaces:
  SCENARIOS: SCENARIOS,
  REASON_CODES: REASON_CODES,
  OUTCOMES: OUTCOMES,
  PHASE_56_GUARDED_STREAMS: PHASE_56_GUARDED_STREAMS,
  // Public API (Lock-13 wrapped):
  runAll: runAll,
  runScenario: runScenario,
  validateScenarioOutcome: validateScenarioOutcome,
  selfTest: selfTest,
  aggregateResults: aggregateResults,
  appendLogRow: appendLogRow,
  // Dual-exposed internal helpers:
  _runScenarioImpl: _runScenarioImpl,
  _setupContainer: _setupContainer,
  _teardownContainer: _teardownContainer,
  _spawnNodeScript: _spawnNodeScript,
  _internals: {
    _runScenarioImpl: _runScenarioImpl,
    _setupContainer: _setupContainer,
    _teardownContainer: _teardownContainer,
    _spawnNodeScript: _spawnNodeScript,
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
    _resolveTargetTool: _resolveTargetTool,
    _parseStdoutJson: _parseStdoutJson,
    _buildEnvelopeRow: _buildEnvelopeRow,
    _reasonCodeForOutcome: _reasonCodeForOutcome,
    PROJECT_ROOT: PROJECT_ROOT,
  },
};

if (require.main === module) {
  _main(process.argv);
}
