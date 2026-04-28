#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/failure-injection/harness.cjs
// Phase 53-01-T1: Gate Failure Injection Harness - skeleton + 10-scenario
// frozen manifest + JSON-Schema validator + bootstrap self-test.
//
// PURPOSE
//   CLI entry for the v2.0 release-gate failure-injection harness. This
//   skeleton freezes the public-API surface (8 stubs), the closed-vocab
//   FAIL_INJ_REASON_CODES + VERDICT_KINDS, and the 11-stream
//   PHASE_53_GUARDED_STREAMS anti-pollution guard set so that downstream
//   tasks (T2 container isolation + spawnSync + canonical fingerprint;
//   T3-T5 per-scenario implementations; T6 aggregator + envelope-v1 JSONL
//   writer + CRIT-BACKLOG; T7 self-test entry + milestone-close gate wire)
//   cannot drift.
//
//   T2 will fill _setupContainer / _teardownContainer / _spawnTool /
//   _fingerprintStream / _fingerprintsEqual / _fingerprintAllStreams.
//   T3-T5 will fill _runScenarioImpl across the 10 scenarios.
//   T6 will fill aggregateResults / appendLogRow / runAll outer loop +
//   verdict decision tree + CRIT-BACKLOG single-writer integration.
//   T7 will consolidate the self-test into a 16-20 assertion suite +
//   wire the milestone-close v2.0 triple-gate.
//
//   The Object.freeze frames + Lock 13 try/catch wrappers MUST remain
//   across all subsequent tasks.
//
// LOCK INVARIANTS (do not violate without a 53-RESEARCH.md update)
//   Lock 4  - No fork or reimplementation of Phase 41-52 tool trees.
//             Target tools (token-attribution, context-packet,
//             dispatch-router, vtp-bridge, memory-governance,
//             context-cache, phase-capsule, route-ledger, edge-guard)
//             are invoked via spawnSync (T2) only; their bodies are NEVER
//             copied or required into the harness body. Phase 51's
//             failure-injectors.cjs is mirrored by pattern (CANONICAL_STREAMS
//             shape, fingerprintStream/fingerprintsEqual W1 fix), NOT
//             imported - context-bench is scope-isolated. Only
//             scripts/lib/crit-backlog.cjs is required by absolute path
//             (T6 will wire the appendRow call).
//   Lock 11 - Scenario selection, reason-code matching, evidence oracle,
//             and verdict-kind classification use ONLY set-membership and
//             byte-equality. No embedding, cosine, levenshtein,
//             regex-fuzzy, or semantic_similarity_only. Scenarios.json is
//             closed-vocab; SCENARIOS.schema.json round-trip enforces it.
//   Lock 13 - Every public API wraps internals in try/catch and returns a
//             degraded-verdict sentinel ({ok:false,reason:...}) on error.
//             No public path throws upward. The orchestrator and the
//             milestone-close gate must never crash because the harness
//             threw. Internal helpers (T2+ _setupContainer, _spawnTool,
//             etc.) follow the same wrap-and-sentinel discipline.
//   ASCII   - No smart quotes, no emoji, no non-ASCII byte anywhere in
//             this file (or scenarios.json or SCENARIOS.schema.json).
//             PowerShell 5.1 cockpit cross-rendering breaks on non-ASCII.
//   No FS writes in body until T6 wires the canonical writer for
//   .planning/metrics/failure-injection-log.jsonl. Skeleton is
//   read-only-by-shape: --self-test must not append, write, or rename
//   anything outside the OS tmpdir.
//
// 4-STEP PROTOCOL (T2-T7 fill bodies; signatures locked here at T1)
//   1. snapshot   capture pre-state fingerprint of PHASE_53_GUARDED_STREAMS
//                 against the LIVE .planning/metrics/ (Lock 11 byte equality)
//   2. inject     mutate a per-scenario tmpdir mirror only - the live
//                 filesystem is NEVER touched
//   3. observe    spawnSync the target tool with cwd=tmpdir; parse
//                 reason codes from stdout/stderr/tmpdir-mirror tail
//   4. restore    rm -rf tmpdir; re-fingerprint live streams; assert
//                 byte-equality with pre-state (anti-pollution invariant)
//
// 9 PUBLIC API NAMES (Lock 13 wrapped; T2-T7 fill bodies)
//   runAll(opts), runScenario(args), selfTest(), aggregateResults(rs),
//   appendLogRow(row, opts), _runScenarioImpl(scenario, tmpdir),
//   _setupContainer(scenarioId), _spawnTool(scenario, tmpdir, extraEnv),
//   _teardownContainer(opts).
//   Each is exported at module.exports top-level AND under _internals
//   (for the helpers _runScenarioImpl/_setupContainer/_spawnTool/
//   _teardownContainer) by identity (same function reference) so callers
//   can use either access pattern. selfTest A4 asserts the dual-export
//   identity to catch export-surface drift.
//
// STOP RULE (T1)
//   `node super-gsd/tools/failure-injection/harness.cjs --self-test` exits
//   0 with the bootstrap 5 assertions PASS. scenarios.json + SCENARIOS.
//   schema.json present, ASCII-clean, and round-trip-validate every entry.
// =============================================================================

'use strict';

// ---------------------------------------------------------------------------
// Dependencies. Lock 4: no Phase 41-52 tool tree imports here. Only Node
// stdlib + crit-backlog.cjs (T6 will wire the appendRow call). T2 will add
// child_process.spawnSync; we keep the require to a comment until T2 to
// avoid an unused dep at T1.
// ---------------------------------------------------------------------------
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Lock 13: import wrapped. A missing crit-backlog module must surface as a
// degraded sentinel at runAll() / appendLogRow() time, never as an
// uncaught require error. T1 stub does not call into the module yet; T6
// wires _appendCritBacklogRow.
let _critBacklog = null;
try {
  _critBacklog = require(path.resolve(__dirname, '..', '..', 'scripts',
                                       'lib', 'crit-backlog.cjs'));
} catch (_e) {
  _critBacklog = null;
}

// ---------------------------------------------------------------------------
// SCENARIOS - load synchronously at module init from scenarios.json.
// Lock 13 fault-tolerant loader: a missing or unparseable manifest yields
// an empty frozen array rather than throwing at require-time. The bootstrap
// self-test asserts length===10 in the happy path so a degraded surface is
// caught loudly. Each entry is recursively frozen (deepFreeze) so mutation
// at any depth is a no-op.
// ---------------------------------------------------------------------------
function _deepFreeze(o) {
  try {
    if (o === null || typeof o !== 'object') return o;
    Object.freeze(o);
    const keys = Object.keys(o);
    for (let i = 0; i < keys.length; i++) {
      const v = o[keys[i]];
      if (v !== null && typeof v === 'object' && !Object.isFrozen(v)) {
        _deepFreeze(v);
      }
    }
    return o;
  } catch (_e) {
    return o;
  }
}

function _loadScenariosSync() {
  try {
    const p = path.join(__dirname, 'scenarios.json');
    if (!fs.existsSync(p)) return Object.freeze([]);
    const txt = fs.readFileSync(p, 'utf8');
    const obj = JSON.parse(txt);
    if (!obj || typeof obj !== 'object') return Object.freeze([]);
    if (obj.schema_version !== 1) return Object.freeze([]);
    const arr = Array.isArray(obj.scenarios) ? obj.scenarios : [];
    const frozen = [];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i];
      if (e && typeof e === 'object') frozen.push(_deepFreeze(e));
    }
    return Object.freeze(frozen);
  } catch (_e) {
    return Object.freeze([]);
  }
}
const SCENARIOS = _loadScenariosSync();

// ---------------------------------------------------------------------------
// PHASE_53_GUARDED_STREAMS - 11-entry anti-pollution guard set. Phase 51
// CANONICAL_STREAMS (5 entries) is extended locally with 6 Phase-53-
// scenario-specific streams. Lock 4: this list does NOT mutate Phase 51's
// CANONICAL_STREAMS - it is an internal Phase 53 superset. T2 will use it
// to fingerprint live .planning/metrics/ pre/post each scenario; T6 will
// assert byte equality across a full --run-all (anti-pollution invariant).
// Source: 53-RESEARCH.md sec 5.2 (line 658-670).
// ---------------------------------------------------------------------------
const PHASE_53_GUARDED_STREAMS = Object.freeze([
  // Phase 51 canonical 5:
  'agent-token-spend.jsonl',
  'context-packet-log.jsonl',
  'context-complaints.jsonl',
  'route-decisions.jsonl',
  'crit-backlog.jsonl',
  // Phase 53 extensions (6):
  'redis-projection-log.jsonl',          // scenario 6
  'edge-guard-log.jsonl',                // scenario 10
  'memory-revocations.jsonl',            // scenario 5
  'memory-promotions.jsonl',             // scenario 5
  'memory-demotions.jsonl',              // scenario 5
  'memory-revalidations.jsonl',          // scenario 5
]);

// ---------------------------------------------------------------------------
// FAIL_INJ_REASON_CODES - closed-vocab reason-code envelope vocabulary
// emitted by the harness when scoring a scenario or aggregating a run.
// >=11 entries required by T1 self-test (the >=11 floor matches the
// 53-RESEARCH.md sec 3 lock at lines 366-378). T6 envelope-v1 writer
// uses these codes only; observed_reason_codes from target tools are a
// SEPARATE vocabulary (each upstream tool's own closed-vocab strings;
// matched by byte-equality per Lock 11).
// ---------------------------------------------------------------------------
const FAIL_INJ_REASON_CODES = Object.freeze([
  // Per-scenario verdicts (7):
  'scenario_pass',
  'scenario_pass_soft_skip',
  'scenario_fail_canonical_drift',
  'scenario_fail_reason_code_missing',
  'scenario_fail_structural_edge_guard_miss',
  'scenario_fail_lock13_violation',
  'scenario_fail_timeout',
  // Aggregate verdicts (4):
  'aggregate_pass_clean',
  'aggregate_pass_with_deferred',
  'aggregate_candidate_with_debt',
  'aggregate_fail',
]);

// ---------------------------------------------------------------------------
// VERDICT_KINDS - exactly 3 entries: null (no failure), 'verifier_fail'
// (default classification), 'edge_guard_miss' (only scenario 10 with
// edge_guard_miss_classified===true and a structural emit gap can produce
// this kind). Mirrors crit-backlog.cjs VALID_KINDS subset; T6 uses this
// when appending a CRIT-BACKLOG row on failure.
//
// DISPATCH CONTRACT (single source of truth across the harness pipeline):
//   * scenarios.json + SCENARIOS.schema.json carry ONE authoritative scenario
//     classifier field: `edge_guard_miss_classified` (boolean). Only scenario
//     10 (edge-guard-missing-emit) has it true; all others false. This is
//     the plan-canonical T1 invariant (PLAN line 261, 578).
//   * `verdict_kind` is the DERIVED 3-value enum on each per-scenario result
//     row, computed by T6's `_classifyVerdictKind(scenario, scenarioVerdict)`
//     per PLAN lines 628-631:
//       - if scenarioVerdict in ('PASS','PASS-WITH-SOFT-SKIP'): null
//       - elif scenario.edge_guard_miss_classified === true: 'edge_guard_miss'
//       - else: 'verifier_fail'
//   * The mapping is set-membership only (Lock 11 byte-equality on the
//     boolean): scenario 10 FAIL -> 'edge_guard_miss'; scenarios 1-9 FAIL
//     -> 'verifier_fail'. The classifier is deterministic and replayable.
//   * Downstream (T6 aggregateResults, T6 _appendCritBacklogRow) consume
//     `verdict_kind` from the per-scenario result row, NOT from the manifest
//     directly. The manifest stays at the boolean source-of-truth; the
//     pipeline carries the derived enum forward to the CRIT-BACKLOG kind
//     field (which is the same closed enum minus null).
// ---------------------------------------------------------------------------
const VERDICT_KINDS = Object.freeze([null, 'verifier_fail', 'edge_guard_miss']);

// ---------------------------------------------------------------------------
// Hand-rolled JSON-Schema draft-07 subset validator. Lock 4: no Ajv dep
// (the harness keeps a zero-runtime-dep surface; mirror of Phase 51's
// _validateScenario in context-bench/harness.cjs:577-760). Walks the
// closed enums and required fields the schema pins. Returns
// { ok: boolean, errors: string[] }. The schema file is read at validation
// time (not at module init) so a missing file degrades to a typed error
// rather than a require-time throw.
// ---------------------------------------------------------------------------
const _SCHEMA_ID_ENUM = [
  'token-attribution-poisoned-row',
  'context-packet-missing-capsule',
  'dispatch-router-vtp-whitelist-violation',
  'vtp-bridge-unavailable',
  'memory-governance-revocation-replay',
  'redis-adapter-flushdb-recovery',
  'sqlite-context-index-deleted-db',
  'phase-capsule-corrupted-json',
  'route-ledger-truncated-stream',
  'edge-guard-missing-emit',
];
const _SCHEMA_STREAMS_ENUM = [
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
];
const _SCHEMA_SOFT_SKIP_ENUM = [
  'phase_49_writer_unwired',
  'redis_not_available_soft_skip',
];
const _SCHEMA_ENTRY_KEYS = [
  'id', 'label', 'target_tool', 'inject_mechanism', 'tool_invocation_argv',
  'expected_reason_codes', 'canonical_streams_guarded', 'soft_skip_when',
  'edge_guard_miss_classified',
];
const _TARGET_TOOL_RE = /^super-gsd\/(tools|scripts)\/[A-Za-z0-9._/-]+\.cjs$/;
const _INJECT_MECH_RE = /^[a-z][a-z0-9_]*$/;

function _checkClosedKeys(obj, allowed, label, errs) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    errs.push(label + ': not an object');
    return;
  }
  const ks = Object.keys(obj);
  for (let i = 0; i < ks.length; i++) {
    if (allowed.indexOf(ks[i]) === -1) {
      errs.push(label + ': unexpected key ' + JSON.stringify(ks[i]));
    }
  }
  for (let j = 0; j < allowed.length; j++) {
    if (!Object.prototype.hasOwnProperty.call(obj, allowed[j])) {
      errs.push(label + ': missing required ' + JSON.stringify(allowed[j]));
    }
  }
}

function _validateScenarioEntry(s, idx) {
  const errs = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    return ['scenarios[' + idx + ']: not an object'];
  }
  _checkClosedKeys(s, _SCHEMA_ENTRY_KEYS, 'scenarios[' + idx + ']', errs);
  if (typeof s.id !== 'string' || _SCHEMA_ID_ENUM.indexOf(s.id) === -1) {
    errs.push('scenarios[' + idx + '].id: not in closed enum: '
              + JSON.stringify(s.id));
  }
  if (typeof s.label !== 'string' || s.label.length < 1) {
    errs.push('scenarios[' + idx + '].label: must be non-empty string');
  }
  if (typeof s.target_tool !== 'string' ||
      !_TARGET_TOOL_RE.test(s.target_tool)) {
    errs.push('scenarios[' + idx + '].target_tool: pattern violation');
  }
  if (typeof s.inject_mechanism !== 'string' ||
      !_INJECT_MECH_RE.test(s.inject_mechanism)) {
    errs.push('scenarios[' + idx + '].inject_mechanism: pattern violation');
  }
  if (!Array.isArray(s.tool_invocation_argv) ||
      s.tool_invocation_argv.length < 2) {
    errs.push('scenarios[' + idx + '].tool_invocation_argv: array, minItems 2');
  } else {
    for (let i = 0; i < s.tool_invocation_argv.length; i++) {
      if (typeof s.tool_invocation_argv[i] !== 'string' ||
          s.tool_invocation_argv[i].length < 1) {
        errs.push('scenarios[' + idx + '].tool_invocation_argv[' + i + ']: '
                  + 'non-empty string');
      }
    }
  }
  if (!Array.isArray(s.expected_reason_codes) ||
      s.expected_reason_codes.length < 1) {
    errs.push('scenarios[' + idx + '].expected_reason_codes: array, minItems 1');
  } else {
    for (let i = 0; i < s.expected_reason_codes.length; i++) {
      if (typeof s.expected_reason_codes[i] !== 'string' ||
          s.expected_reason_codes[i].length < 1) {
        errs.push('scenarios[' + idx + '].expected_reason_codes[' + i + ']: '
                  + 'non-empty string');
      }
    }
  }
  if (!Array.isArray(s.canonical_streams_guarded) ||
      s.canonical_streams_guarded.length < 1) {
    errs.push('scenarios[' + idx + '].canonical_streams_guarded: minItems 1');
  } else {
    for (let i = 0; i < s.canonical_streams_guarded.length; i++) {
      if (_SCHEMA_STREAMS_ENUM.indexOf(s.canonical_streams_guarded[i]) === -1) {
        errs.push('scenarios[' + idx + '].canonical_streams_guarded['
                  + i + ']: not in 11-stream enum: '
                  + JSON.stringify(s.canonical_streams_guarded[i]));
      }
    }
  }
  if (!(s.soft_skip_when === null ||
        (typeof s.soft_skip_when === 'string' &&
         _SCHEMA_SOFT_SKIP_ENUM.indexOf(s.soft_skip_when) !== -1))) {
    errs.push('scenarios[' + idx + '].soft_skip_when: must be null or one of '
              + JSON.stringify(_SCHEMA_SOFT_SKIP_ENUM));
  }
  if (typeof s.edge_guard_miss_classified !== 'boolean') {
    errs.push('scenarios[' + idx + '].edge_guard_miss_classified: boolean');
  }
  return errs;
}

function _validateManifest(manifest) {
  const errs = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return { ok: false, errors: ['manifest: not an object'] };
  }
  _checkClosedKeys(manifest, ['schema_version', 'scenarios'], 'top', errs);
  if (manifest.schema_version !== 1) {
    errs.push('schema_version !== 1');
  }
  if (!Array.isArray(manifest.scenarios)) {
    errs.push('scenarios: not an array');
  } else {
    if (manifest.scenarios.length !== 10) {
      errs.push('scenarios: length === 10 required, got '
                + manifest.scenarios.length);
    }
    for (let i = 0; i < manifest.scenarios.length; i++) {
      const sErrs = _validateScenarioEntry(manifest.scenarios[i], i);
      for (let j = 0; j < sErrs.length; j++) errs.push(sErrs[j]);
    }
  }
  return { ok: errs.length === 0, errors: errs };
}

// ---------------------------------------------------------------------------
// Public API - 9 stubs. Each wraps internals in try/catch (Lock 13). T2-T7
// replace bodies; the wrappers and signatures stay. Stub bodies return
// {ok:true, stub:true} (or a documented degraded sentinel) so the bootstrap
// self-test can verify wiring without spawning subprocesses or writing FS.
// _teardownContainer is named here (T2 deliverable per header doc) so the
// public surface is frozen at T1; T2 fills the body inside
// _teardownContainerImpl without expanding the surface.
// ---------------------------------------------------------------------------

// runAll: top-level driver. Iterates SCENARIOS, dispatches each through
// runScenario, accumulates results, calls aggregateResults, writes
// envelope-v1 JSONL rows, optionally appends CRIT-BACKLOG entries on
// failure. T6 fills the body.
function runAll(opts) {
  try {
    return _runAllImpl(opts || {});
  } catch (_e) {
    return {
      ok: false,
      reason: 'scenario_fail_lock13_violation',
      pass_count: 0,
      total: 0,
      verdict: 'FAIL',
      results: [],
      source: 'runAll_catch',
    };
  }
}

// runScenario: drive one scenario through the 4-step protocol
// (snapshot/inject/observe/restore). Returns the per-scenario result row.
// T3-T5 fill the body via _runScenarioImpl.
function runScenario(args) {
  try {
    return _runScenarioImpl((args && args.scenario) || null,
                            (args && args.tmpdir) || null);
  } catch (_e) {
    return {
      ok: false,
      reason: 'scenario_fail_lock13_violation',
      scenario_id: (args && args.scenario && args.scenario.id) || null,
      applied: false,
      observed_reason_codes: [],
      canonical_state_preserved: null,
      verdict: 'FAIL',
      verdict_kind: 'verifier_fail',
      source: 'runScenario_catch',
    };
  }
}

// selfTest: run the bootstrap (T1) + T2-T6 assertion suite. Exits 0 on
// all-PASS, 1 on first FAIL. Operator-runnable via the CLI dispatch
// below. T7 will consolidate the suite to 16-20 list-locked assertions.
function selfTest() {
  try {
    return _selfTestImpl();
  } catch (_e) {
    return {
      ok: false,
      reason: 'gate_internal_error',
      results: [],
      source: 'selfTest_catch',
    };
  }
}

// aggregateResults: cross-scenario verdict aggregator. Walks per-scenario
// rows, applies the 4-state verdict tree (PASS / PASS-WITH-DEFERRED-N /
// CANDIDATE-WITH-DEBT / FAIL), and returns the run-level summary. T6
// fills the body.
function aggregateResults(rs) {
  try {
    return _aggregateResultsImpl(Array.isArray(rs) ? rs : []);
  } catch (_e) {
    return {
      ok: false,
      reason: 'aggregate_fail',
      pass: 0,
      total: 0,
      verdict: 'FAIL',
      deferred_count: 0,
      edge_guard_miss_count: 0,
      source: 'aggregateResults_catch',
    };
  }
}

// appendLogRow: envelope-v1 JSONL writer for
// .planning/metrics/failure-injection-log.jsonl. T6 wires the actual
// fs.appendFileSync; T1 stub is a no-op so the bootstrap self-test can
// confirm Lock 13 wrapping without writing FS.
function appendLogRow(row, opts) {
  try {
    return _appendLogRowImpl(row || null, opts || {});
  } catch (_e) {
    return {
      ok: false,
      reason: 'gate_internal_error',
      written: false,
      source: 'appendLogRow_catch',
    };
  }
}

// _runScenarioImpl: per-scenario implementation. T3-T5 fill across the 10
// scenarios. T1 stub returns the documented degraded sentinel so callers
// see {ok:true, stub:true} during bootstrap.
function _runScenarioImpl(scenario, tmpdir) {
  try {
    if (!scenario || typeof scenario !== 'object') {
      return {
        ok: false,
        reason: 'scenario_fail_reason_code_missing',
        scenario_id: null,
        stub: true,
        applied: false,
        observed_reason_codes: [],
        canonical_state_preserved: null,
        verdict: 'FAIL',
        verdict_kind: 'verifier_fail',
        source: '_runScenarioImpl_t1_stub',
      };
    }
    return {
      ok: true,
      stub: true,
      scenario_id: scenario.id,
      applied: false,
      observed_reason_codes: [],
      canonical_state_preserved: null,
      verdict: null,
      verdict_kind: null,
      tmpdir: tmpdir || null,
      source: '_runScenarioImpl_t1_stub',
    };
  } catch (_e) {
    return {
      ok: false,
      reason: 'scenario_fail_lock13_violation',
      scenario_id: (scenario && scenario.id) || null,
      stub: true,
      source: '_runScenarioImpl_catch',
    };
  }
}

// _setupContainer: tmpdir mirror creator. T2 fills with fs.mkdtempSync +
// .planning subdir scaffolding. T1 stub returns a typed shape so wiring
// tests can compile.
function _setupContainer(scenarioId) {
  try {
    return {
      ok: true,
      stub: true,
      tmpdir: null,
      planningDir: null,
      scenario_id: typeof scenarioId === 'string' ? scenarioId : null,
      source: '_setupContainer_t1_stub',
    };
  } catch (_e) {
    return {
      ok: false,
      reason: 'gate_internal_error',
      stub: true,
      source: '_setupContainer_catch',
    };
  }
}

// _spawnTool: real-process boundary. T2 fills with child_process.spawnSync
// pattern mirrored from sgsd-blind-live-controller.mjs:104-138. T1 stub
// returns a typed shape so wiring tests can compile.
function _spawnTool(scenario, tmpdir, extraEnv) {
  try {
    return {
      ok: true,
      stub: true,
      argv: (scenario && scenario.tool_invocation_argv) || [],
      cwd: tmpdir || null,
      env_overrides: extraEnv || {},
      exit_code: null,
      signal: null,
      stdout: '',
      stderr: '',
      stdout_digest: 'sha256:',
      stderr_digest: 'sha256:',
      duration_ms: 0,
      source: '_spawnTool_t1_stub',
    };
  } catch (_e) {
    return {
      ok: false,
      reason: 'scenario_fail_lock13_violation',
      stub: true,
      source: '_spawnTool_catch',
    };
  }
}

// _teardownContainer: tmpdir teardown. T2 fills with fs.rmSync({recursive:
// true, force:true}) per the 4-step protocol step 4 (restore). T1 stub
// freezes the API surface so downstream tasks (T2-T7) cannot expand it -
// header doc names this as a T2 deliverable, but the surface must be
// frozen NOW so T2 fills the body without growing the public/internal
// names. Lock 13 wrap: never throws upward.
function _teardownContainer(opts) {
  try {
    return _teardownContainerImpl(opts || {});
  } catch (_e) {
    return {
      ok: false,
      reason: 'gate_internal_error',
      stub: true,
      source: '_teardownContainer_catch',
    };
  }
}

// ---------------------------------------------------------------------------
// Internal stubs. T2-T7 replace bodies; signatures stay file-local. None
// of these write FS or spawn subprocesses at T1.
// ---------------------------------------------------------------------------

function _runAllImpl(_opts) {
  // T6: outer loop over SCENARIOS -> runScenario -> appendLogRow ->
  // aggregateResults -> CRIT-BACKLOG single-writer pass. T1 stub returns
  // an empty PASS-clean envelope so the wiring test can read shape.
  return {
    ok: true,
    stub: true,
    pass_count: 0,
    total: SCENARIOS.length,
    verdict: 'PASS',
    results: [],
    source: '_runAllImpl_t1_stub',
  };
}

function _selfTestImpl() {
  // ---------------------------------------------------------------------
  // T1 BOOTSTRAP: 5 assertions covering Object.freeze + schema round-trip
  // + public-API surface + Lock 13 wrapping + ASCII discipline. T2 will
  // append 3-4 (running 7-9), T3+T4+T5 each append per-scenario shape
  // assertions, T6 appends 4-6 aggregator/JSONL/CRIT-BACKLOG assertions.
  // T7 list-locks the 16-20 semantic floor (running 19-21 acceptable).
  // ---------------------------------------------------------------------
  const results = [];
  function check(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  // 1: SCENARIOS Object.frozen, length===10, mutation no-op. Outside
  // strict mode push() is silently ignored on a frozen array; the length
  // anchor is the contract we measure.
  let scenariosOk = false;
  let scenariosDetail = '';
  try {
    const lenBefore = Array.isArray(SCENARIOS) ? SCENARIOS.length : -1;
    let mutationThrew = false;
    try {
      SCENARIOS.push({ injected: 'attempt' });
    } catch (_em) {
      mutationThrew = true;
    }
    const lenAfter = Array.isArray(SCENARIOS) ? SCENARIOS.length : -2;
    scenariosOk = Object.isFrozen(SCENARIOS) &&
                  Array.isArray(SCENARIOS) &&
                  SCENARIOS.length === 10 &&
                  lenBefore === 10 &&
                  lenAfter === 10;
    scenariosDetail = 'len=' + lenAfter
                      + ' frozen=' + Object.isFrozen(SCENARIOS)
                      + ' mutation_threw=' + mutationThrew;
  } catch (e) {
    scenariosDetail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('SCENARIOS_frozen_10_entry_mutation_noop', scenariosOk,
        scenariosDetail);

  // 2: SCENARIOS round-trips SCENARIOS.schema.json validation - all 10
  // entries valid; 0 errors. Read the manifest from disk fresh (not the
  // already-frozen SCENARIOS) so we anchor the on-disk file equally.
  let schemaOk = false;
  let schemaDetail = '';
  try {
    const p = path.join(__dirname, 'scenarios.json');
    const txt = fs.readFileSync(p, 'utf8');
    const manifest = JSON.parse(txt);
    const v = _validateManifest(manifest);
    schemaOk = !!v.ok;
    schemaDetail = v.ok
      ? 'manifest valid; 10/10 entries pass schema'
      : 'errors=' + v.errors.length + ' first=' + (v.errors[0] || '');
  } catch (e) {
    schemaDetail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('schema_round_trip_all_10_entries', schemaOk, schemaDetail);

  // 3: FAIL_INJ_REASON_CODES Object.frozen, >=11 entries.
  check('FAIL_INJ_REASON_CODES_frozen_ge11',
        Object.isFrozen(FAIL_INJ_REASON_CODES) &&
          Array.isArray(FAIL_INJ_REASON_CODES) &&
          FAIL_INJ_REASON_CODES.length >= 11,
        'len=' + (Array.isArray(FAIL_INJ_REASON_CODES)
                   ? FAIL_INJ_REASON_CODES.length : 'n/a')
          + ' frozen=' + Object.isFrozen(FAIL_INJ_REASON_CODES));

  // 4: All 9 public-API names exist as functions in local scope AND are
  // exported on module.exports at the top-level with byte-identical
  // identity (catches export-surface drift where _internals-only exposure
  // would leave callers using `require(harness)._runScenarioImpl` getting
  // undefined). 9 APIs = 8 from T1 frozen surface + _teardownContainer
  // stub (header doc T2 deliverable; surface frozen now so T2 fills body
  // without expanding names).
  const apis = {
    runAll: runAll,
    runScenario: runScenario,
    selfTest: selfTest,
    aggregateResults: aggregateResults,
    appendLogRow: appendLogRow,
    _runScenarioImpl: _runScenarioImpl,
    _setupContainer: _setupContainer,
    _spawnTool: _spawnTool,
    _teardownContainer: _teardownContainer,
  };
  const apiNames = Object.keys(apis);
  let allFns = true;
  let missingApi = '';
  for (let i = 0; i < apiNames.length; i++) {
    if (typeof apis[apiNames[i]] !== 'function') {
      allFns = false;
      missingApi = apiNames[i];
      break;
    }
  }
  // 4b: module.exports shape - each public-API name MUST be present at
  // the top-level of module.exports as the SAME function reference. This
  // catches WARN2-class drift where an API is defined in local scope but
  // accidentally only exposed under `_internals` (callers that do
  // `require(harness)._runScenarioImpl` would silently get undefined).
  let exportsOk = true;
  let missingExport = '';
  try {
    const me = module.exports;
    if (!me || typeof me !== 'object') {
      exportsOk = false;
      missingExport = 'module.exports not an object';
    } else {
      for (let i = 0; i < apiNames.length; i++) {
        if (me[apiNames[i]] !== apis[apiNames[i]]) {
          exportsOk = false;
          missingExport = apiNames[i]
            + ' (typeof export=' + typeof me[apiNames[i]]
            + ', identity_match=' + (me[apiNames[i]] === apis[apiNames[i]]) + ')';
          break;
        }
      }
    }
  } catch (e) {
    exportsOk = false;
    missingExport = 'module.exports check threw: '
      + (e && e.message ? e.message : 'unknown');
  }
  check('public_api_9_stubs_present',
        allFns && apiNames.length === 9 && exportsOk,
        allFns && exportsOk
          ? 'all 9 public APIs are functions and top-level exports: '
            + apiNames.join(',')
          : (allFns
              ? 'export drift: ' + missingExport
              : 'missing or non-function: ' + missingApi));

  // 5: Lock 13 wrapper + ASCII discipline. Two sub-checks rolled into
  // one assertion so the bootstrap stays at exactly 5 (T1 contract).
  //   5a: Calling each public API with malformed input returns an
  //       object (degraded sentinel), never throws. Use a bag of bad
  //       inputs (null, undefined, {}, [], string) - none escape.
  //   5b: harness.cjs source is ASCII-only (no byte > 0x7F).
  let lock13Ok = true;
  let lock13Detail = '';
  const badInputs = [null, undefined, {}, [], 'bad', 0, false];
  try {
    for (let ai = 0; ai < apiNames.length; ai++) {
      // Avoid the selfTest infinite-recursion trap: skip selfTest in this
      // bad-input probe. Lock 13 wrapping on selfTest is verified by the
      // FACT that we are running INSIDE selfTest right now (this very
      // function call) without throwing - the wrapper is in effect.
      if (apiNames[ai] === 'selfTest') continue;
      for (let bi = 0; bi < badInputs.length; bi++) {
        const fn = apis[apiNames[ai]];
        let r;
        try {
          r = fn(badInputs[bi]);
        } catch (e) {
          lock13Ok = false;
          lock13Detail = 'api ' + apiNames[ai]
            + ' threw on input ' + JSON.stringify(badInputs[bi])
            + ': ' + (e && e.message ? e.message : 'unknown');
          break;
        }
        if (typeof r !== 'object' || r === null) {
          lock13Ok = false;
          lock13Detail = 'api ' + apiNames[ai]
            + ' returned non-object on input '
            + JSON.stringify(badInputs[bi]);
          break;
        }
      }
      if (!lock13Ok) break;
    }
    if (lock13Ok) {
      // 5b: ASCII-only check on the harness source.
      const src = fs.readFileSync(__filename);
      for (let bi = 0; bi < src.length; bi++) {
        if (src[bi] > 0x7F) {
          lock13Ok = false;
          lock13Detail = 'non-ASCII byte 0x' + src[bi].toString(16)
            + ' at offset ' + bi;
          break;
        }
      }
      if (lock13Ok) lock13Detail = 'all 9 APIs Lock-13-wrapped + ASCII clean';
    }
  } catch (e) {
    lock13Ok = false;
    lock13Detail = 'check threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('lock13_wrapper_present_and_ascii_clean', lock13Ok, lock13Detail);

  // ---------------------------------------------------------------------
  // Render + return.
  // ---------------------------------------------------------------------
  const passCount = results.filter(function (r) { return r.ok; }).length;
  const total = results.length;
  const allPass = passCount === total;
  return {
    ok: allPass,
    reason: allPass ? 'self_test_pass' : 'self_test_fail',
    results: results,
    pass_count: passCount,
    total: total,
    source: '_selfTestImpl_t1',
  };
}

function _aggregateResultsImpl(rs) {
  // T6: full verdict tree per RESEARCH sec 2.3 (line 211-217). T1 stub
  // returns an empty-clean shape so wiring callers can read the contract.
  // TODO(T6): the empty-results path below currently returns 'PASS' when
  // total===0 only because nothing has FAILed; the post-T6 contract is
  // PLAN line 619-626's full tree (pass===10 -> PASS; ===9+verifier_fail
  // -> PASS-WITH-DEFERRED-1; any edge_guard_miss -> CANDIDATE-WITH-DEBT;
  // else FAIL). T6 will replace this entire body with the decision tree
  // above; the cosmetic empty-input verdict here is INFO-only at T1.
  const total = rs.length;
  const passes = rs.filter(function (r) { return r && r.verdict === 'PASS'; });
  const edgeMisses = rs.filter(function (r) {
    return r && r.verdict_kind === 'edge_guard_miss';
  });
  return {
    ok: true,
    stub: true,
    pass: passes.length,
    total: total,
    verdict: total === 0 ? 'PASS' : 'FAIL',
    deferred_count: 0,
    edge_guard_miss_count: edgeMisses.length,
    source: '_aggregateResultsImpl_t1_stub',
  };
}

function _teardownContainerImpl(_opts) {
  // T2: fs.rmSync({recursive:true, force:true}) on the per-scenario
  // tmpdir; idempotent on repeated calls. T1 stub: no FS writes (Lock 4
  // skeleton is read-only-by-shape) - returns a typed shape so wiring
  // callers can read the contract.
  return {
    ok: true,
    stub: true,
    removed: false,
    source: '_teardownContainerImpl_t1_stub',
  };
}

function _appendLogRowImpl(row, opts) {
  // T6: fs.appendFileSync to .planning/metrics/failure-injection-log.jsonl
  // with envelope-v1 conformance. T1 stub: no FS writes (Lock 4 skeleton
  // is read-only-by-shape).
  return {
    ok: true,
    stub: true,
    written: false,
    rowKeys: row && typeof row === 'object'
      ? Object.keys(row)
      : [],
    optsSeen: opts && typeof opts === 'object'
      ? Object.keys(opts)
      : [],
    source: '_appendLogRowImpl_t1_stub',
  };
}

// Internal helper exposed for cross-task self-test composition.
function _sha256OfBytes(buf) {
  try {
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (_e) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch. Thin shell - no FS writes, no subprocess spawns at T1.
// Operator usage:
//   node super-gsd/tools/failure-injection/harness.cjs --self-test
//   node super-gsd/tools/failure-injection/harness.cjs --run-all   (T6+)
//   node super-gsd/tools/failure-injection/harness.cjs --help
// ---------------------------------------------------------------------------
function _printHelp() {
  const lines = [
    'super-gsd/tools/failure-injection/harness.cjs',
    'Phase 53-01: 10-scenario gate failure-injection harness.',
    '',
    'Usage:',
    '  node harness.cjs --self-test',
    '    Run the bootstrap (T1) + T2-T6 assertion suite. Exit 0 on all',
    '    PASS, exit 1 on first FAIL. Read-only-by-shape at T1.',
    '',
    '  node harness.cjs --run-all                           (wired T6+)',
    '    Run all 10 scenarios end-to-end against the live tools in',
    '    per-scenario tmpdirs; write envelope-v1 rows to',
    '    .planning/metrics/failure-injection-log.jsonl; aggregate verdict.',
    '',
    '  node harness.cjs --help',
    '    Print this usage block.',
  ];
  return lines.join('\n');
}

function _main(argv) {
  try {
    const args = (argv || []).slice(2);
    if (args.indexOf('--help') !== -1 || args.length === 0) {
      process.stdout.write(_printHelp() + '\n');
      process.exit(0);
      return;
    }
    if (args.indexOf('--self-test') !== -1) {
      const out = selfTest();
      const rs = (out && Array.isArray(out.results)) ? out.results : [];
      let firstFail = -1;
      for (let i = 0; i < rs.length; i++) {
        const tag = rs[i].ok ? 'PASS' : 'FAIL';
        process.stdout.write(
          '[' + tag + '] ' + rs[i].name +
          (rs[i].detail ? ' :: ' + rs[i].detail : '') + '\n'
        );
        if (!rs[i].ok && firstFail === -1) firstFail = i;
      }
      const passCount = rs.filter(function (r) { return r.ok; }).length;
      process.stdout.write(
        'self-test: ' + passCount + '/' + rs.length + ' PASS' +
        (out && out.ok ? ' (green)' : ' (red)') + '\n'
      );
      process.exit(out && out.ok ? 0 : 1);
      return;
    }
    if (args.indexOf('--run-all') !== -1) {
      // T6 wires the real driver. T1 stub: emit a typed warning + exit
      // non-zero so an accidental milestone-close gate run does not
      // silently advance.
      process.stderr.write(
        '[failure-injection harness] --run-all is not wired at T1; ' +
        'returns scenario_fail_lock13_violation sentinel until T6.\n'
      );
      process.exit(1);
      return;
    }
    // Unknown flag.
    process.stderr.write('unknown args: ' + args.join(' ') + '\n');
    process.stderr.write(_printHelp() + '\n');
    process.exit(2);
  } catch (e) {
    // Lock 13: never throw upward from CLI.
    process.stderr.write(
      'harness.cjs CLI internal error: ' +
      (e && e.message ? e.message : 'unknown') + '\n'
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Module exports. Frozen surface + 9 public APIs + (per RESEARCH sec 3
// line 389-399) the same names downstream tasks consume. _internals
// bag exposes T2-T5 helpers under a single property so Lock 4 reviewers
// can audit at a glance; top-level dual-exports of _runScenarioImpl /
// _setupContainer / _spawnTool / _teardownContainer let downstream
// callers using `require(harness)._runScenarioImpl` see the same
// function reference (identity-equal). selfTest A4 asserts this.
//
// IMPORTANT: this assignment MUST happen BEFORE _main(process.argv)
// runs - selfTest A4 reads module.exports and would see {} if the CLI
// dispatch fired first. Tested by running the CLI --self-test entry.
// ---------------------------------------------------------------------------
module.exports = {
  // Frozen surface:
  SCENARIOS: SCENARIOS,
  PHASE_53_GUARDED_STREAMS: PHASE_53_GUARDED_STREAMS,
  FAIL_INJ_REASON_CODES: FAIL_INJ_REASON_CODES,
  VERDICT_KINDS: VERDICT_KINDS,
  // Public API (Lock 13 wrappers; T2-T7 fill internals):
  runAll: runAll,
  runScenario: runScenario,
  selfTest: selfTest,
  aggregateResults: aggregateResults,
  appendLogRow: appendLogRow,
  // Dual-exposed internal helpers - top-level for downstream callers
  // (T2-T7) using `require(harness)._runScenarioImpl` etc. AND under
  // _internals (below) for Lock 4 audit-at-a-glance grouping. The two
  // names are identity-equal (same function reference); selfTest A4
  // asserts this.
  _runScenarioImpl: _runScenarioImpl,
  _setupContainer: _setupContainer,
  _spawnTool: _spawnTool,
  _teardownContainer: _teardownContainer,
  // Internal helpers exposed for cross-task self-test composition:
  _internals: {
    _runScenarioImpl: _runScenarioImpl,
    _setupContainer: _setupContainer,
    _spawnTool: _spawnTool,
    _teardownContainer: _teardownContainer,
    _validateManifest: _validateManifest,
    _validateScenarioEntry: _validateScenarioEntry,
    _sha256OfBytes: _sha256OfBytes,
  },
};

if (require.main === module) {
  _main(process.argv);
}
