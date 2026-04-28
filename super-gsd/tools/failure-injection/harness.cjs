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
// stdlib + crit-backlog.cjs (T6 will wire the appendRow call). T2 wires
// child_process.spawnSync for the real-process boundary inside _spawnTool.
// Lock 4 hard rule: harness body MUST NOT require() any target tool; the
// only legal way to invoke a target tool is spawnSync(command, argv, ...)
// with command resolved as an absolute file path.
// ---------------------------------------------------------------------------
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const child_process = require('child_process');

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
  // _spawnTool internal verdicts (2 - T2 ATC W1 fix):
  'tool_nonzero_exit',
  'container_setup_failed',
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

// _setupContainer: tmpdir mirror creator. T2 body: mkdtempSync under
// os.tmpdir() (NEVER under workspace), scaffold .planning/{metrics,
// milestones,cache} subdirs, optionally pre-populate fixture files for the
// given scenario id (best-effort; T3-T5 author the fixture content), and
// snapshot the LIVE planning streams pre-scenario via _fingerprintAllStreams.
// Returns { ok, tmpdir, planningDir, scenario_id, snapshot_fingerprint }.
// Lock 13: any failure -> degraded sentinel; never throws upward.
//
// Workspace-traversal guard (Pitfall 2 / Lock 4): asserts that the chosen
// tmpdir.startsWith(os.tmpdir()) AND does NOT include __dirname (the
// failure-injection tool dir under the project workspace). A regression
// where tmpdir resolves under the workspace would cause subprocess cwd to
// resolve .planning/ to the LIVE workspace - the entire anti-pollution
// invariant collapses.
function _setupContainer(scenarioId) {
  try {
    // Strict input contract: scenarioId MUST be a non-empty ASCII string
    // matching the SCENARIOS schema id pattern. Non-string / empty input
    // returns the degraded sentinel WITHOUT mkdtemp side-effects (this
    // also makes the Test 5 Lock 13 bad-input probe FS-clean: passing
    // null/{}/[]/0/false/'' returns a sentinel and creates no tmpdir).
    if (typeof scenarioId !== 'string' || scenarioId.length === 0) {
      return {
        ok: false,
        reason: 'container_setup_failed',
        error: 'scenario_id_must_be_non_empty_string',
        tmpdir: null,
        planningDir: null,
        scenario_id: null,
        snapshot_fingerprint: null,
        source: '_setupContainer_input_guard',
      };
    }
    // Sanitize scenario id for use as a directory-name suffix - only
    // allow [A-Za-z0-9-_] to avoid path traversal injection (T-53-02).
    if (!/^[A-Za-z0-9_-]+$/.test(scenarioId)) {
      return {
        ok: false,
        reason: 'container_setup_failed',
        error: 'scenario_id_pattern_violation',
        tmpdir: null,
        planningDir: null,
        scenario_id: null,
        snapshot_fingerprint: null,
        source: '_setupContainer_pattern_guard',
      };
    }
    var sid = scenarioId;
    var prefix = path.join(os.tmpdir(), 'sgsd-fail-inj-' + sid + '-');
    var tmpdir = fs.mkdtempSync(prefix);
    // Defense-in-depth guard: tmpdir MUST be under os.tmpdir() AND MUST NOT
    // be under __dirname. If either invariant breaks, abort: rmSync the
    // partial dir + return degraded sentinel.
    var safeUnderTmp = tmpdir.indexOf(os.tmpdir()) === 0;
    var notUnderWorkspace = tmpdir.indexOf(__dirname) === -1;
    if (!safeUnderTmp || !notUnderWorkspace) {
      try { fs.rmSync(tmpdir, { recursive: true, force: true }); } catch (_e) {}
      return {
        ok: false,
        reason: 'container_setup_failed',
        error: 'workspace_traversal_guard_violated',
        tmpdir: null,
        planningDir: null,
        scenario_id: sid,
        snapshot_fingerprint: null,
        source: '_setupContainer_traversal_guard',
      };
    }
    // Scaffold planning subdirs. Recursive mkdirSync is idempotent on
    // existing paths and never throws on EEXIST when recursive:true.
    var planningDir = path.join(tmpdir, '.planning');
    fs.mkdirSync(path.join(planningDir, 'metrics'), { recursive: true });
    fs.mkdirSync(path.join(planningDir, 'milestones'), { recursive: true });
    fs.mkdirSync(path.join(planningDir, 'cache'), { recursive: true });
    // Pre-populate fixture files (best-effort): T3-T5 will author the
    // actual fixture content under super-gsd/tools/failure-injection/
    // fixtures/<scenarioId>/. T2 only wires the copy mechanism so the
    // fixture-dir absent path is the documented degraded shape. Files are
    // copied into the tmpdir root (NOT planningDir/metrics) so per-scenario
    // _runScenarioImpl bodies (T3-T5) can resolve them as
    // path.join(tmpdir, '<basename>') and decide where to inject.
    var fixturesCopied = 0;
    try {
      var fixSrc = path.join(__dirname, 'fixtures', sid);
      if (fs.existsSync(fixSrc) && fs.statSync(fixSrc).isDirectory()) {
        var entries = fs.readdirSync(fixSrc);
        for (var fi = 0; fi < entries.length; fi++) {
          var name = entries[fi];
          var src = path.join(fixSrc, name);
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
    } catch (_eFx) {
      // Lock 13: fixtures absent -> 0 copied; not a setup failure.
    }
    // Snapshot LIVE canonical streams (Lock 4: snapshot the live workspace
    // .planning/metrics, NOT the tmpdir mirror). This is the pre-scenario
    // anchor that _teardownContainer compares against to enforce the
    // anti-pollution invariant. We default the live planning dir to the
    // project workspace under the harness file (super-gsd/.. -> two parents
    // up from super-gsd/tools/failure-injection/).
    var liveProjectRoot = path.resolve(__dirname, '..', '..', '..');
    var livePlanningDir = path.join(liveProjectRoot, '.planning');
    var snapshot = _fingerprintAllStreams(livePlanningDir);
    return {
      ok: true,
      tmpdir: tmpdir,
      planningDir: planningDir,
      scenario_id: sid,
      snapshot_fingerprint: snapshot,
      live_planning_dir: livePlanningDir,
      fixtures_copied: fixturesCopied,
      source: '_setupContainer_t2',
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'container_setup_failed',
      error: (e && e.message) ? e.message : 'unknown',
      tmpdir: null,
      planningDir: null,
      scenario_id: typeof scenarioId === 'string' ? scenarioId : null,
      snapshot_fingerprint: null,
      source: '_setupContainer_catch',
    };
  }
}

// _spawnTool: real-process boundary. T2 body: spawnSync pattern mirrored
// from sgsd-blind-live-controller.mjs:104-138 + spawnSyncNode helper at
// :939-946. Mock-predicate forbiddance enforcement (CONTEXT.md:81 +
// Pitfall 1): the harness MUST invoke target tools as separate processes
// via spawnSync. NO require() of the target tool internally - that would
// share v8 context and let injected env / module cache poison cross
// scenarios.
//
// Two call shapes are supported:
//   (A) Plan-style: _spawnTool(scenario, tmpdir, extraEnv) - reads
//       scenario.tool_invocation_argv, resolves <tmpdir> + <resolved>
//       placeholders, spawns with cwd=tmpdir + env merged.
//   (B) Direct-style: _spawnTool({command, args, cwd, env, timeoutMs}) -
//       passthrough for self-test 9 (real-process smoke) and any future
//       caller that already has a resolved argv.
// Returns a typed shape per PLAN line 320 + per-task spec:
//   { ok, argv, cwd, env_overrides, exit_code, signal, stdout, stderr,
//     stdout_digest, stderr_digest, duration_ms, command_invoked,
//     timed_out, reason }
// Lock 13: spawnSync errors (ENOENT, EACCES) -> degraded sentinel; never
// throws. Timeout -> ok:false, reason:'scenario_fail_timeout', signal!==null.
// Non-zero exit -> ok:false, reason:'tool_nonzero_exit', exit_code preserved.
function _spawnTool(scenario, tmpdir, extraEnv) {
  try {
    // Branch A vs B detection: branch B if first arg is a plain object
    // with a `command` string field and no `tool_invocation_argv`.
    var command = null;
    var args = [];
    var cwd = null;
    var envOverrides = {};
    var timeoutMs = 30000;
    var srcTag = '_spawnTool_t2_branch_a';
    if (scenario && typeof scenario === 'object' &&
        typeof scenario.command === 'string' &&
        !Array.isArray(scenario.tool_invocation_argv)) {
      command = scenario.command;
      args = Array.isArray(scenario.args) ? scenario.args.slice() : [];
      cwd = typeof scenario.cwd === 'string' ? scenario.cwd : process.cwd();
      envOverrides = (scenario.env && typeof scenario.env === 'object')
        ? scenario.env : {};
      timeoutMs = typeof scenario.timeoutMs === 'number' && scenario.timeoutMs > 0
        ? scenario.timeoutMs : 30000;
      srcTag = '_spawnTool_t2_branch_b_direct';
    } else {
      // Branch A: scenario manifest entry shape.
      if (!scenario || typeof scenario !== 'object' ||
          !Array.isArray(scenario.tool_invocation_argv) ||
          scenario.tool_invocation_argv.length < 2) {
        return {
          ok: false,
          reason: 'scenario_fail_reason_code_missing',
          error: 'missing_or_malformed_tool_invocation_argv',
          argv: [],
          cwd: tmpdir || null,
          env_overrides: extraEnv || {},
          exit_code: null,
          signal: null,
          stdout: '',
          stderr: '',
          stdout_digest: 'sha256:',
          stderr_digest: 'sha256:',
          duration_ms: 0,
          command_invoked: '',
          timed_out: false,
          source: '_spawnTool_t2_argv_guard',
        };
      }
      // Resolve placeholders in argv: <tmpdir> -> tmpdir abs path;
      // <resolved> -> path.resolve(__dirname, '..', '..', '..', target_tool)
      // (the target tool path is closed-vocab schema-validated to start
      // with super-gsd/, so this resolves to the project tool file).
      var liveProjectRoot = path.resolve(__dirname, '..', '..', '..');
      var resolvedTarget = '';
      try {
        if (typeof scenario.target_tool === 'string') {
          resolvedTarget = path.join(liveProjectRoot, scenario.target_tool);
        }
      } catch (_eR) { resolvedTarget = ''; }
      var rawArgv = scenario.tool_invocation_argv;
      var resolvedArgv = [];
      for (var ai = 0; ai < rawArgv.length; ai++) {
        var tok = String(rawArgv[ai]);
        if (tok === '<tmpdir>') {
          tok = tmpdir || '';
        } else if (tok === '<resolved>') {
          tok = resolvedTarget;
        } else if (tok.indexOf('<tmpdir>') !== -1) {
          tok = tok.split('<tmpdir>').join(tmpdir || '');
        } else if (tok.indexOf('<resolved>') !== -1) {
          tok = tok.split('<resolved>').join(resolvedTarget);
        }
        resolvedArgv.push(tok);
      }
      command = resolvedArgv[0];
      args = resolvedArgv.slice(1);
      cwd = tmpdir || process.cwd();
      envOverrides = (scenario.env_overrides &&
                      typeof scenario.env_overrides === 'object')
        ? scenario.env_overrides : {};
      if (extraEnv && typeof extraEnv === 'object') {
        var keysE = Object.keys(extraEnv);
        for (var ek = 0; ek < keysE.length; ek++) {
          envOverrides[keysE[ek]] = extraEnv[keysE[ek]];
        }
      }
    }
    // Mock-predicate forbiddance enforcement (best-effort): command MUST
    // be a non-empty string. Any path that resolves to '' would mean a
    // <resolved> token slipped through with no target_tool.
    if (typeof command !== 'string' || command.length === 0) {
      return {
        ok: false,
        reason: 'scenario_fail_reason_code_missing',
        error: 'empty_command_after_resolution',
        argv: [],
        cwd: cwd,
        env_overrides: envOverrides,
        exit_code: null,
        signal: null,
        stdout: '',
        stderr: '',
        stdout_digest: 'sha256:',
        stderr_digest: 'sha256:',
        duration_ms: 0,
        command_invoked: '',
        timed_out: false,
        source: '_spawnTool_t2_command_guard',
      };
    }
    // Real spawnSync invocation. Mirrors sgsd-blind-live-controller.mjs
    // :939-946 (spawnSyncNode helper) shape: cwd, encoding utf8, timeout,
    // pipe stdout/stderr. env merges process.env + envOverrides so the
    // target tool inherits PATH/HOME but the harness can layer per-scenario
    // SGSD_* env knobs (e.g. SGSD_VTP_FORCE_OFFLINE=1 for scenario 4).
    var mergedEnv = {};
    var pkeys = Object.keys(process.env || {});
    for (var pi = 0; pi < pkeys.length; pi++) {
      mergedEnv[pkeys[pi]] = process.env[pkeys[pi]];
    }
    var ekeys = Object.keys(envOverrides || {});
    for (var ei = 0; ei < ekeys.length; ei++) {
      mergedEnv[ekeys[ei]] = envOverrides[ekeys[ei]];
    }
    var startedAt = Date.now();
    var result = child_process.spawnSync(command, args, {
      cwd: cwd,
      env: mergedEnv,
      timeout: timeoutMs,
      encoding: 'utf8',
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    var elapsed = Date.now() - startedAt;
    var stdout = (result && typeof result.stdout === 'string')
      ? result.stdout : '';
    var stderr = (result && typeof result.stderr === 'string')
      ? result.stderr : '';
    var exitCode = (result && typeof result.status === 'number')
      ? result.status : null;
    var signal = (result && typeof result.signal !== 'undefined')
      ? result.signal : null;
    var spawnError = (result && result.error) ? result.error : null;
    var timedOut = (signal === 'SIGTERM' || signal === 'SIGKILL') &&
                    elapsed >= timeoutMs - 50;
    // Decision tree per spec:
    //   timeout -> ok:false, reason:'scenario_fail_timeout'
    //   spawn error (ENOENT etc) -> ok:false, reason:'scenario_fail_lock13_violation'
    //   non-zero exit -> ok:false, reason:'tool_nonzero_exit'
    //   exit 0 + no signal -> ok:true
    var ok = false;
    var reason = '';
    if (spawnError) {
      ok = false;
      reason = 'scenario_fail_lock13_violation';
    } else if (timedOut) {
      ok = false;
      reason = 'scenario_fail_timeout';
    } else if (exitCode !== 0) {
      ok = false;
      reason = 'tool_nonzero_exit';
    } else {
      ok = true;
      reason = '';
    }
    var commandInvoked = command + (args.length > 0 ? ' ' + args.join(' ') : '');
    return {
      ok: ok,
      reason: reason,
      argv: [command].concat(args),
      cwd: cwd,
      env_overrides: envOverrides,
      exit_code: exitCode,
      signal: signal,
      stdout: stdout,
      stderr: stderr,
      stdout_digest: 'sha256:' + _sha256OfBytes(Buffer.from(stdout, 'utf8')),
      stderr_digest: 'sha256:' + _sha256OfBytes(Buffer.from(stderr, 'utf8')),
      duration_ms: elapsed,
      command_invoked: commandInvoked,
      timed_out: timedOut,
      spawn_error: spawnError ? (spawnError.message || String(spawnError)) : null,
      source: srcTag,
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'scenario_fail_lock13_violation',
      error: (e && e.message) ? e.message : 'unknown',
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
      command_invoked: '',
      timed_out: false,
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
  // Track any tmpdirs that the bad-input probe accidentally creates
  // (e.g. _setupContainer('bad') is a valid string and will mkdtemp). The
  // probe itself does not check the FS contract - it only checks Lock 13
  // (no throw + object return). Anything created here is cleaned up
  // before we leave Test 5 so the probe is FS-clean across repeated runs.
  const lock13TmpdirsToClean = [];
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
        // FS-cleanup: if the API created a tmpdir as a side effect (only
        // _setupContainer can; only on string inputs that pass the
        // pattern guard), record it for teardown after the loop.
        if (apiNames[ai] === '_setupContainer' &&
            r.ok === true && typeof r.tmpdir === 'string' &&
            r.tmpdir.indexOf(os.tmpdir()) === 0) {
          lock13TmpdirsToClean.push(r.tmpdir);
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
  } finally {
    // Clean up any tmpdirs the bad-input probe created. force:true
    // silently swallows ENOENT so this is idempotent.
    for (let ci = 0; ci < lock13TmpdirsToClean.length; ci++) {
      try {
        fs.rmSync(lock13TmpdirsToClean[ci],
                  { recursive: true, force: true });
      } catch (_eC) {}
    }
  }
  check('lock13_wrapper_present_and_ascii_clean', lock13Ok, lock13Detail);

  // ---------------------------------------------------------------------
  // T2 ASSERTIONS - tests 6-10. Container isolation + spawnSync real-
  // process boundary + canonical-stream fingerprint guard. Each test sets
  // up a tmpdir, exercises the helper, and tears down. Lock 13: any throw
  // collapses the test to FAIL (not propagated upward).
  // ---------------------------------------------------------------------

  // Test 6 (B1 - tmpdir_traversal_guard): _setupContainer returns a
  // tmpdir under os.tmpdir(); never resolves to __dirname or any path
  // under the project workspace. Verifies Pitfall 2 fix: subprocess cwd
  // would otherwise resolve .planning/ to the LIVE workspace.
  let b1Ok = false;
  let b1Detail = '';
  let b1Tmpdir = null;
  try {
    const c = _setupContainer('S99-self-test-traversal');
    b1Tmpdir = c && c.tmpdir;
    const underTmp = !!(b1Tmpdir && typeof b1Tmpdir === 'string' &&
                         b1Tmpdir.indexOf(os.tmpdir()) === 0);
    const notUnderDir = !!(b1Tmpdir && typeof b1Tmpdir === 'string' &&
                            b1Tmpdir.indexOf(__dirname) === -1);
    const planningExists = !!(c && c.planningDir &&
                               fs.existsSync(c.planningDir));
    b1Ok = c && c.ok === true && underTmp && notUnderDir && planningExists;
    b1Detail = 'tmpdir=' + (b1Tmpdir || 'null')
      + ' under_tmpdir=' + underTmp
      + ' not_under_workspace=' + notUnderDir
      + ' planning_dir_exists=' + planningExists;
  } catch (e) {
    b1Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  } finally {
    try {
      if (b1Tmpdir) fs.rmSync(b1Tmpdir, { recursive: true, force: true });
    } catch (_eC) {}
  }
  check('tmpdir_traversal_guard', b1Ok, b1Detail);

  // Test 7 (B2 - teardown_idempotent): _teardownContainer called twice on
  // the same path returns ok:true both times. fs.rmSync force:true makes
  // the second call a no-op (Pitfall 4 fix - rm-rf must be idempotent).
  let b2Ok = false;
  let b2Detail = '';
  try {
    const c2 = _setupContainer('S99-self-test-idempotent');
    if (c2 && c2.ok && c2.tmpdir) {
      const r1 = _teardownContainer({ tmpdir: c2.tmpdir });
      const r2 = _teardownContainer({ tmpdir: c2.tmpdir });
      b2Ok = !!(r1 && r1.ok === true) && !!(r2 && r2.ok === true);
      b2Detail = 'first=' + (r1 && r1.ok ? 'ok' : 'fail')
        + ' (removed=' + (r1 && r1.removed) + ')'
        + ' second=' + (r2 && r2.ok ? 'ok' : 'fail')
        + ' (removed=' + (r2 && r2.removed)
        + ', idempotent_noop=' + (r2 && r2.idempotent_noop) + ')';
    } else {
      b2Detail = 'setup failed: ' + JSON.stringify(c2);
    }
  } catch (e) {
    b2Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('teardown_idempotent', b2Ok, b2Detail);

  // Test 8 (B3 - spawn_real_invocation): _spawnTool invoked with a real
  // node argv returns ok:true + stdout matches the printed string. Proves
  // the spawnSync boundary is the real-process boundary (NO require() of
  // target tool internally - mock-predicate forbiddance per CONTEXT.md:81).
  let b3Ok = false;
  let b3Detail = '';
  try {
    const r3 = _spawnTool({
      command: process.execPath,
      args: ['-e', "process.stdout.write('spawn_real_invocation_marker')"],
      cwd: os.tmpdir(),
      env: {},
      timeoutMs: 30000,
    });
    const stdoutMatch = !!(r3 && r3.stdout &&
                            r3.stdout.indexOf('spawn_real_invocation_marker') !== -1);
    b3Ok = !!(r3 && r3.ok === true && r3.exit_code === 0 && stdoutMatch);
    b3Detail = 'ok=' + (r3 && r3.ok)
      + ' exit_code=' + (r3 && r3.exit_code)
      + ' stdout_match=' + stdoutMatch
      + ' duration_ms=' + (r3 && r3.duration_ms);
  } catch (e) {
    b3Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('spawn_real_invocation', b3Ok, b3Detail);

  // Test 9 (B4 - fingerprint_byte_equality): _fingerprintAllStreams +
  // _compareCanonicalStreams round-trip on unchanged streams returns
  // equal:true. Anchor: fingerprint the LIVE planning dir twice in
  // immediate succession; nothing changes between calls so equal MUST
  // be true (W1 fix: mtime excluded from equality).
  let b4Ok = false;
  let b4Detail = '';
  try {
    const liveProjectRoot = path.resolve(__dirname, '..', '..', '..');
    const livePlanningDir = path.join(liveProjectRoot, '.planning');
    const fpA = _fingerprintAllStreams(livePlanningDir);
    const fpB = _fingerprintAllStreams(livePlanningDir);
    const cmp = _compareCanonicalStreams(fpA, fpB);
    const lenOk = Array.isArray(fpA.streams) && fpA.streams.length === 11;
    b4Ok = !!(cmp && cmp.equal === true) && lenOk;
    b4Detail = 'equal=' + (cmp && cmp.equal)
      + ' drift_count=' + (cmp && Array.isArray(cmp.drift) ? cmp.drift.length : 'n/a')
      + ' streams_count=' + (Array.isArray(fpA.streams) ? fpA.streams.length : 'n/a');
  } catch (e) {
    b4Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('fingerprint_byte_equality', b4Ok, b4Detail);

  // Test 10 (B5 - container_+_teardown_no_drift): _setupContainer +
  // immediate _teardownContainer leaves canonical streams byte-untouched.
  // This is the per-scenario anti-pollution invariant: at no point in the
  // protocol does the harness write to LIVE .planning/metrics/.
  let b5Ok = false;
  let b5Detail = '';
  let b5Tmpdir = null;
  try {
    const c5 = _setupContainer('S99-self-test-no-drift');
    b5Tmpdir = c5 && c5.tmpdir;
    if (c5 && c5.ok && c5.snapshot_fingerprint) {
      const t5 = _teardownContainer({
        tmpdir: c5.tmpdir,
        snapshot_fingerprint: c5.snapshot_fingerprint,
        live_planning_dir: c5.live_planning_dir,
      });
      b5Ok = !!(t5 && t5.ok === true &&
                 t5.canonical_state_preserved === true &&
                 Array.isArray(t5.drift_detected) &&
                 t5.drift_detected.length === 0);
      b5Detail = 'teardown_ok=' + (t5 && t5.ok)
        + ' canonical_state_preserved=' + (t5 && t5.canonical_state_preserved)
        + ' drift_count=' + (t5 && Array.isArray(t5.drift_detected)
                              ? t5.drift_detected.length : 'n/a');
    } else {
      b5Detail = 'setup_failed: ok=' + (c5 && c5.ok)
        + ' has_snapshot=' + !!(c5 && c5.snapshot_fingerprint);
    }
  } catch (e) {
    b5Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  } finally {
    try {
      if (b5Tmpdir) fs.rmSync(b5Tmpdir, { recursive: true, force: true });
    } catch (_eC) {}
  }
  check('container_plus_teardown_no_drift', b5Ok, b5Detail);

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

function _teardownContainerImpl(opts) {
  // T2 body: 4-step protocol step 4 (restore). Three responsibilities:
  //   1. Verify the tmpdir IS under os.tmpdir() (defense-in-depth; if a
  //      caller passed a path under workspace by mistake, refuse to rm-rf).
  //   2. fs.rmSync(tmpdir, {recursive:true, force:true}) - idempotent
  //      because force:true silently swallows ENOENT, so calling twice
  //      returns ok:true the second time.
  //   3. If snapshot_fingerprint was supplied (per-scenario anti-pollution
  //      anchor), re-fingerprint the LIVE planning streams and compare for
  //      drift. drift_detected is the array of stream names that differ -
  //      empty array means anti-pollution invariant held.
  // Lock 13: never throws upward; rm errors -> { ok:false, reason }.
  //
  // Two call shapes (back-compat with T1 stub):
  //   _teardownContainer(tmpdirString)  -> rm-rf only, no fingerprint check
  //   _teardownContainer({tmpdir, snapshot_fingerprint, live_planning_dir})
  //     -> full rm-rf + fingerprint compare
  try {
    var tmpdir = null;
    var snapshot = null;
    var livePlanningDir = null;
    if (typeof opts === 'string') {
      tmpdir = opts;
    } else if (opts && typeof opts === 'object') {
      tmpdir = typeof opts.tmpdir === 'string' ? opts.tmpdir : null;
      snapshot = (opts.snapshot_fingerprint &&
                   typeof opts.snapshot_fingerprint === 'object')
        ? opts.snapshot_fingerprint : null;
      livePlanningDir = typeof opts.live_planning_dir === 'string'
        ? opts.live_planning_dir : null;
    }
    if (!tmpdir || typeof tmpdir !== 'string') {
      // No tmpdir supplied - idempotent no-op (e.g. setup failed earlier
      // and we are still calling teardown in a finally block).
      return {
        ok: true,
        removed: false,
        idempotent_noop: true,
        canonical_state_preserved: null,
        drift_detected: [],
        source: '_teardownContainerImpl_t2_no_tmpdir',
      };
    }
    // Defense-in-depth guard: refuse to rm-rf any path that is NOT under
    // os.tmpdir(). This is a Lock 4 mechanical guarantee that the harness
    // cannot accidentally delete project files even if upstream callers
    // construct a malformed opts.
    if (tmpdir.indexOf(os.tmpdir()) !== 0) {
      return {
        ok: false,
        reason: 'gate_internal_error',
        error: 'tmpdir_not_under_os_tmpdir',
        removed: false,
        canonical_state_preserved: null,
        drift_detected: [],
        source: '_teardownContainerImpl_t2_guard',
      };
    }
    var existedBefore = false;
    try { existedBefore = fs.existsSync(tmpdir); } catch (_eX) {}
    // rmSync with force:true is idempotent: calling on a missing path is a
    // no-op (does not throw). This is the documented Pitfall 4 fix.
    try {
      fs.rmSync(tmpdir, { recursive: true, force: true });
    } catch (eR) {
      return {
        ok: false,
        reason: 'gate_internal_error',
        error: (eR && eR.message) ? eR.message : 'rmSync_failed',
        removed: false,
        canonical_state_preserved: null,
        drift_detected: [],
        source: '_teardownContainerImpl_t2_rm_err',
      };
    }
    // Fingerprint compare: if snapshot was supplied, re-fingerprint the
    // LIVE planning streams and assert byte-equality. drift_detected is
    // empty when canonical state is preserved.
    var canonicalStatePreserved = null;
    var drift = [];
    if (snapshot && livePlanningDir) {
      try {
        var afterFp = _fingerprintAllStreams(livePlanningDir);
        var cmp = _compareCanonicalStreams(snapshot, afterFp);
        canonicalStatePreserved = !!cmp.equal;
        drift = Array.isArray(cmp.drift) ? cmp.drift : [];
      } catch (_eF) {
        canonicalStatePreserved = null;
        drift = [];
      }
    }
    return {
      ok: true,
      removed: existedBefore,
      idempotent_noop: !existedBefore,
      canonical_state_preserved: canonicalStatePreserved,
      drift_detected: drift,
      tmpdir: tmpdir,
      source: '_teardownContainerImpl_t2',
    };
  } catch (e) {
    return {
      ok: false,
      reason: 'gate_internal_error',
      error: (e && e.message) ? e.message : 'unknown',
      removed: false,
      canonical_state_preserved: null,
      drift_detected: [],
      source: '_teardownContainerImpl_t2_catch',
    };
  }
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
// Fingerprint helpers (T2 deliverables 4 + 5).
//
// _fingerprintStream(filePath) - per-file fingerprint with 'absent-source
//   baseline' shape. Mirrors context-bench/failure-injectors.cjs:319-356
//   verbatim (W1+W3 fixes already applied):
//     - file absent      -> { exists:false, sha256:null, size:0, mtime:0 }
//     - file present     -> { exists:true,  sha256:hex, size:N, mtime:ms }
//     - file unreadable  -> { exists:true,  sha256:'', size:-1, mtime:-1 }
//   Conservative absent shape ensures that a missing canonical stream does
//   NOT silently equal a non-empty stream that drifts to the same hash.
//
// _fingerprintsEqual(a, b) - W1 fix (Phase 51 T4 ATC): equality is sha256
//   + size only, NOT mtime. mtime drifts on read on some filesystems
//   (atime->mtime promotion), and copy-then-restore can produce false
//   positives. mtime is recorded for diagnostic logging but excluded from
//   the byte-equality contract. Absent-vs-absent === true; absent-vs-
//   present === false (W3 anti-collapse).
//
// _fingerprintAllStreams(planningDir) - returns
//   { streams: [{ path, exists, sha256, size, mtime }, ...] } over the
//   PHASE_53_GUARDED_STREAMS 11-entry set, each resolved as
//   path.join(planningDir, 'metrics', name). Used by _setupContainer
//   (snapshot pre-scenario) and _teardownContainer (compare post-scenario).
//   Lock 13: any throw -> typed degraded shape with empty streams array.
//
// _compareCanonicalStreams(before, after) - byte-equality across all 11
//   streams (sha256 + size only; mtime excluded). Returns
//   { equal:bool, drift:[{path, before_sha256, after_sha256, before_size,
//   after_size}, ...] }. drift array is empty when equal===true.
// ---------------------------------------------------------------------------
function _fingerprintStream(filePath) {
  try {
    if (!filePath || typeof filePath !== 'string') {
      return { exists: false, sha256: null, size: 0, mtime: 0 };
    }
    if (!fs.existsSync(filePath)) {
      return { exists: false, sha256: null, size: 0, mtime: 0 };
    }
    var buf = null;
    try { buf = fs.readFileSync(filePath); }
    catch (_eR) {
      return { exists: true, sha256: '', size: -1, mtime: -1 };
    }
    var st = null;
    try { st = fs.statSync(filePath); } catch (_eS) { st = null; }
    return {
      exists: true,
      sha256: _sha256OfBytes(buf),
      size: st ? st.size : buf.length,
      mtime: st ? Math.floor(st.mtimeMs || 0) : 0,
    };
  } catch (_e) {
    return { exists: false, sha256: null, size: 0, mtime: 0 };
  }
}

function _fingerprintsEqual(a, b) {
  try {
    if (!a || !b) return false;
    if (a.exists === false && b.exists === false) return true;
    if (a.exists !== b.exists) return false;
    // W1 fix: sha256 + size only; mtime excluded from byte-equality.
    return a.sha256 === b.sha256 && a.size === b.size;
  } catch (_e) {
    return false;
  }
}

function _fingerprintAllStreams(planningDir) {
  try {
    if (!planningDir || typeof planningDir !== 'string') {
      return { streams: [] };
    }
    var dir = path.join(planningDir, 'metrics');
    var streams = [];
    for (var i = 0; i < PHASE_53_GUARDED_STREAMS.length; i++) {
      var name = PHASE_53_GUARDED_STREAMS[i];
      var fp = _fingerprintStream(path.join(dir, name));
      streams.push({
        path: name,
        exists: fp.exists,
        sha256: fp.sha256,
        size: fp.size,
        mtime: fp.mtime,
      });
    }
    return { streams: streams };
  } catch (_e) {
    return { streams: [] };
  }
}

function _compareCanonicalStreams(before, after) {
  try {
    if (!before || !after ||
        !Array.isArray(before.streams) || !Array.isArray(after.streams)) {
      return { equal: false, drift: [] };
    }
    // Build before/after maps keyed by stream path so we can compare
    // entries even if order differs.
    var bMap = Object.create(null);
    var aMap = Object.create(null);
    for (var i = 0; i < before.streams.length; i++) {
      bMap[before.streams[i].path] = before.streams[i];
    }
    for (var j = 0; j < after.streams.length; j++) {
      aMap[after.streams[j].path] = after.streams[j];
    }
    var drift = [];
    for (var k = 0; k < PHASE_53_GUARDED_STREAMS.length; k++) {
      var name = PHASE_53_GUARDED_STREAMS[k];
      var bEntry = bMap[name] || null;
      var aEntry = aMap[name] || null;
      if (!_fingerprintsEqual(bEntry, aEntry)) {
        drift.push({
          path: name,
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
    // T2 fingerprint helpers (used by T3-T5 _runScenarioImpl bodies and
    // the T2 self-test). Identity-equal to the local-scope refs.
    _fingerprintStream: _fingerprintStream,
    _fingerprintsEqual: _fingerprintsEqual,
    _fingerprintAllStreams: _fingerprintAllStreams,
    _compareCanonicalStreams: _compareCanonicalStreams,
  },
};

if (require.main === module) {
  _main(process.argv);
}
