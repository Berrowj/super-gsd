#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/context-bench/harness.cjs
// Phase 51-01-T1: Context Stress Benchmark - skeleton + scenario schema +
// bootstrap self-test.
//
// PURPOSE
//   CLI entry for the context-stress benchmark. This skeleton freezes the
//   public-API surface (5 stubs) and the closed-vocab BENCH_REASON_CODES so
//   that downstream tasks (T2 ledger reader, T3 fixture authoring, T4
//   injectors, T5 replay, T6 reporter, T7 self-test+gate) cannot drift.
//
//   T3 will fill SCENARIOS (currently Object.freeze([])).
//   T4 will fill INJECTION_FIXTURES (currently Object.freeze([])).
//   T5+ will replace the public-API stubs with real implementations; the
//   Object.freeze frames + Lock 13 try/catch wrappers MUST remain.
//
// LOCK INVARIANTS (do not violate without a 51-RESEARCH.md update)
//   Lock 4  - No fork or reimplementation of Phase 41-50 tools. The token
//             attribution summarize(), the context-packet REASON_VOCAB, the
//             dispatch-router UNCERTAINTY_TYPES enum, and any other shipped
//             aggregator are imported by absolute path only. Copying their
//             bodies into this tree is a Lock 4 violation.
//   Lock 11 - Scenario selection, evidence oracle, and relationship
//             validation use ONLY set-membership and byte-equality. No
//             embedding, cosine, levenshtein, regex-fuzzy, or
//             semantic_similarity_only. Bench uses closed-vocab matches
//             against frozen enums.
//   Lock 13 - Every public API wraps internals in try/catch and returns a
//             falsey or degraded-verdict sentinel on error. No public path
//             throws upward. The orchestrator and milestone-close gate must
//             never crash because the bench harness threw.
//   ASCII   - No smart quotes, no emoji, no non-ASCII literals anywhere in
//             this file. PowerShell 5.1 cockpit cross-rendering breaks on
//             non-ASCII input.
//   No FS writes in body until T7 wires the canonical writer for
//   .planning/metrics/context-bench-runs.jsonl. Skeleton is read-only by
//   shape: --self-test must not append, write, or rename anything.
//
// STOP RULE (T1)
//   `node super-gsd/tools/context-bench/harness.cjs --self-test` exits 0
//   with the bootstrap 3-5 assertions PASS.
// =============================================================================

'use strict';

// ---------------------------------------------------------------------------
// T2: Lock 4 import-by-reference. Phase 41 token-attribution `summarize` is
// the live aggregator the bench reuses for both baseline and post-replay
// numbers. T2's replay.cjs requires it relatively from the context-bench
// tree; the self-test below asserts the import is the live function so
// drift (a stub or a fork) is caught before T3 fixtures land.
// ---------------------------------------------------------------------------
const tokenAttr = require('../token-attribution/report.cjs');
const replay = require('./replay.cjs');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ---------------------------------------------------------------------------
// Frozen placeholders. T3 + T4 fill these. Do not unfreeze.
// ---------------------------------------------------------------------------

// SCENARIOS - 6 scenario fixtures (S1..S6) loaded synchronously at module
// init from super-gsd/tools/context-bench/scenarios/*.json. The loader
// (Lock 13) is fault-tolerant: a missing or unparseable fixture is dropped
// rather than thrown so the harness keeps the degraded sentinel surface
// downstream tasks rely on. T3 self-test 11 asserts len === 6 in the
// happy path.
function _loadScenariosSync() {
  const out = [];
  const dir = path.join(__dirname, 'scenarios');
  // Lock 11: fixture set is closed-vocab. The 6 filenames are pinned by
  // RESEARCH sec 1.3; we do NOT glob the directory so a stray *.json
  // cannot inject a 7th scenario.
  const PINNED = [
    'S1-v17-P32.json',
    'S2-v18-P36.json',
    'S3-v18-P40.json',
    'S4-v16-P26.json',
    'S5-v17-P34.json',
    'S6-v15-P21.json',
  ];
  for (let i = 0; i < PINNED.length; i++) {
    const p = path.join(dir, PINNED[i]);
    try {
      if (!fs.existsSync(p)) continue;
      const txt = fs.readFileSync(p, 'utf8');
      const obj = JSON.parse(txt);
      if (obj && typeof obj === 'object') out.push(Object.freeze(obj));
    } catch (_e) {
      // Lock 13: drop and continue. Self-test detects len mismatch.
    }
  }
  return Object.freeze(out);
}
const SCENARIOS = _loadScenariosSync();

// INJECTION_FIXTURES - 16-entry F1..F16 closed-vocab failure-injection
// catalog plus F17 contract-only stub (Phase 52 cross-binding). The
// catalog is loaded from failure-injectors.cjs (T4) by reference; the
// outer Object.freeze on the imported array is preserved so mutation is
// a no-op and the array length stays at 16.
const _injectors = require('./failure-injectors.cjs');
const INJECTION_FIXTURES = _injectors.INJECTION_FIXTURES;

// BENCH_REASON_CODES - closed-vocab reason codes emitted by the bench when
// scoring a scenario or recording a route/replay/inject decision. >=10
// entries required by T1 self-test. Mirrors the discipline used by
// context-packet REASON_VOCAB and dispatch-router ROUTE_DECISION_REASONS.
const BENCH_REASON_CODES = Object.freeze([
  // Scenario lifecycle (8):
  'scenario_loaded',
  'scenario_skipped_unknown_id',
  'scenario_skipped_schema_mismatch',
  'scenario_replay_started',
  'scenario_replay_completed',
  'scenario_replay_degraded_ledger_only',
  'scenario_replay_aborted_workspace_dirty',
  'scenario_replay_aborted_anti_cheat_hit',
  // Evidence oracle (5):
  'evidence_present_capsule_decision',
  'evidence_present_bypass_ref',
  'evidence_present_atc_finding',
  'evidence_present_verifier_verdict',
  'evidence_missing',
  // Routing assertion (3):
  'route_match_primary',
  'route_match_fallback',
  'route_mismatch',
  // Score verdicts (4):
  'score_pass',
  'score_partial',
  'score_fail',
  'score_inconclusive',
  // Reporter / gate (3):
  'report_rendered',
  'report_render_failed',
  'gate_internal_error',
]);

// ---------------------------------------------------------------------------
// Public API - 5 stubs. Each wraps internals in try/catch (Lock 13). T5+
// replace bodies; the wrappers and signatures stay.
// ---------------------------------------------------------------------------

// runBench: top-level driver. Iterates SCENARIOS, dispatches replay +
// inject + score, accumulates report. T5/T6 fill.
function runBench(opts) {
  try {
    return _runBenchImpl(opts || {});
  } catch (_e) {
    return { ok: false, reason: 'gate_internal_error', results: [] };
  }
}

// replayScenario: replay one scenario via Phase 41 ledger (default) or
// full Sonnet path (T5). Returns degraded-verdict sentinel on error.
function replayScenario(opts) {
  try {
    return _replayScenarioImpl(opts || {});
  } catch (_e) {
    return { ok: false, reason: 'gate_internal_error', tokens_after: null,
             post_artifacts: [], scenario_run_id: null,
             mode_used: 'ledger-only' };
  }
}

// injectFailure: apply a closed-vocab INJECTION_FIXTURES entry against a
// scenario in a sandboxed workspace. T4 fills.
function injectFailure(opts) {
  try {
    return _injectFailureImpl(opts || {});
  } catch (_e) {
    return { ok: false, reason: 'gate_internal_error', applied: false };
  }
}

// scoreScenario: closed-vocab oracle. Compares post-replay artifacts
// against scenario.expected_evidence[] and scenario.expected_route. Lock
// 11: set-membership + byte-equality only. T6 fills.
function scoreScenario(opts) {
  try {
    return _scoreScenarioImpl(opts || {});
  } catch (_e) {
    return { ok: false, reason: 'gate_internal_error',
             verdict: 'score_inconclusive', findings: [] };
  }
}

// renderReport: emit the bench report (markdown + jsonl envelope). T6/T7
// wire the canonical writer; this stub returns the in-memory shape only.
function renderReport(opts) {
  try {
    return _renderReportImpl(opts || {});
  } catch (_e) {
    return { ok: false, reason: 'report_render_failed', markdown: '',
             rows: [] };
  }
}

// ---------------------------------------------------------------------------
// Internals (stubs). T2..T7 replace bodies. They MUST stay file-local.
// ---------------------------------------------------------------------------

function _runBenchImpl(_opts) {
  return { ok: false, reason: 'scenario_skipped_schema_mismatch',
           results: [], note: 'T1 skeleton; T5/T6 wire runBench' };
}

function _replayScenarioImpl(opts) {
  // T2 introduces the real ledger reader; until then return the
  // documented stub so downstream tasks have a stable shape.
  const claudeBinary = (opts && opts.claudeBinary) || null;
  const mode_used = claudeBinary ? 'full-stub' : 'ledger-only';
  return { ok: true, reason: 'scenario_replay_degraded_ledger_only',
           tokens_after: null, post_artifacts: [],
           scenario_run_id: null, mode_used };
}

function _injectFailureImpl(_opts) {
  return { ok: false, reason: 'scenario_skipped_schema_mismatch',
           applied: false, note: 'T1 skeleton; T4 wires injectors' };
}

function _scoreScenarioImpl(_opts) {
  return { ok: false, reason: 'evidence_missing',
           verdict: 'score_inconclusive', findings: [],
           note: 'T1 skeleton; T6 wires oracle' };
}

function _renderReportImpl(_opts) {
  return { ok: true, reason: 'report_rendered', markdown: '',
           rows: [], note: 'T1 skeleton; T6/T7 wire writer' };
}

// ---------------------------------------------------------------------------
// Bootstrap self-test (T1: 3-5 assertions). T2..T7 append more assertions.
// ---------------------------------------------------------------------------

function _isFrozen(v) {
  return Object.isFrozen(v);
}

// ---------------------------------------------------------------------------
// T3 hand-rolled SCENARIO.schema.json validator (draft-07 subset). We do
// NOT pull Ajv into this tree to keep the harness dependency surface zero
// (Lock 4: no new deps for what set-membership checks already cover). The
// validator walks the closed enums and required fields the schema pins:
//   - schema_version === 1
//   - scenario_id matches /^S[1-6]-v[0-9]+(\.[0-9]+)?-P[0-9]+$/
//   - drawn_from.role in 8-entry ROLES enum
//   - expected_evidence[].kind in 6-entry KIND enum
//   - expected_evidence[].must_appear_in in 4-entry MUST_APPEAR_IN enum
//   - expected_route.uncertainty_type in 6-entry UNCERTAINTY_TYPES enum
//   - expected_route.primary in {claude,codex,vtp_bridge}
//   - expected_route.fallback_chain[i] in same provider enum
//   - additionalProperties:false at every closed object level
// Returns { ok: boolean, errors: string[] }.
// ---------------------------------------------------------------------------
const _SCHEMA_ROLES = ['researcher', 'planner', 'executor', 'verifier',
                       'reviewer', 'orchestrator', 'classifier', 'other'];
const _SCHEMA_KIND = ['capsule_decision', 'bypass_ref', 'atc_finding',
                      'verifier_verdict', 'validated_thought',
                      'downstream_constraint'];
const _SCHEMA_MUST_APPEAR_IN = ['packet_body', 'route_decision',
                                'context_complaint',
                                'context_complaint_or_packet'];
const _SCHEMA_UNCERTAINTY_TYPES = ['deterministic_extraction',
                                   'bounded_code_review',
                                   'synthesis_judgment',
                                   'architecture_challenge',
                                   'prior_memory_lookup',
                                   'book_lookup'];
const _SCHEMA_PROVIDERS = ['claude', 'codex', 'vtp_bridge'];

const _TOP_KEYS = ['schema_version', 'scenario_id', 'drawn_from', 'intent',
                   'baseline_signature', 'expected_evidence',
                   'anti_cheat_signal', 'expected_route'];
const _DRAWN_FROM_KEYS = ['milestone', 'phase', 'phase_name', 'role',
                          'agent_type'];
const _INTENT_KEYS = ['goal', 'files_touched', 'depends_on_phase_capsules'];
const _BASELINE_KEYS = ['actual_tokens_total', 'actual_cache_read_tokens',
                        'source_event_id'];
const _EVIDENCE_KEYS = ['kind', 'ref', 'must_appear_in'];
const _ANTI_CHEAT_KEYS = ['must_not_contain_in_packet',
                          'must_not_set_role_to'];
const _ROUTE_KEYS = ['uncertainty_type', 'primary', 'fallback_chain'];

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

function _validateScenario(s) {
  const errs = [];
  if (!s || typeof s !== 'object' || Array.isArray(s)) {
    return { ok: false, errors: ['scenario: not an object'] };
  }
  _checkClosedKeys(s, _TOP_KEYS, 'scenario', errs);
  if (s.schema_version !== 1) {
    errs.push('schema_version !== 1');
  }
  if (typeof s.scenario_id !== 'string' ||
      !/^S[1-6]-v[0-9]+(\.[0-9]+)?-P[0-9]+$/.test(s.scenario_id)) {
    errs.push('scenario_id: pattern violation: '
              + JSON.stringify(s.scenario_id));
  }
  // drawn_from
  _checkClosedKeys(s.drawn_from, _DRAWN_FROM_KEYS, 'drawn_from', errs);
  if (s.drawn_from && typeof s.drawn_from === 'object') {
    if (typeof s.drawn_from.milestone !== 'string' ||
        !/^v[0-9]+(\.[0-9]+)?$/.test(s.drawn_from.milestone)) {
      errs.push('drawn_from.milestone: pattern violation');
    }
    if (typeof s.drawn_from.phase !== 'number' ||
        s.drawn_from.phase < 1 ||
        Math.floor(s.drawn_from.phase) !== s.drawn_from.phase) {
      errs.push('drawn_from.phase: must be integer >=1');
    }
    if (typeof s.drawn_from.phase_name !== 'string' ||
        s.drawn_from.phase_name.length < 1) {
      errs.push('drawn_from.phase_name: must be non-empty string');
    }
    if (_SCHEMA_ROLES.indexOf(s.drawn_from.role) === -1) {
      errs.push('drawn_from.role: not in ROLES enum');
    }
    if (typeof s.drawn_from.agent_type !== 'string' ||
        s.drawn_from.agent_type.length < 1) {
      errs.push('drawn_from.agent_type: must be non-empty string');
    }
  }
  // intent
  _checkClosedKeys(s.intent, _INTENT_KEYS, 'intent', errs);
  if (s.intent && typeof s.intent === 'object') {
    if (typeof s.intent.goal !== 'string' || s.intent.goal.length < 1) {
      errs.push('intent.goal: must be non-empty string');
    }
    if (!Array.isArray(s.intent.files_touched) ||
        s.intent.files_touched.length < 2) {
      errs.push('intent.files_touched: must have >=2 entries');
    } else {
      for (let i = 0; i < s.intent.files_touched.length; i++) {
        if (typeof s.intent.files_touched[i] !== 'string' ||
            s.intent.files_touched[i].length < 1) {
          errs.push('intent.files_touched[' + i + ']: not non-empty string');
        }
      }
    }
    if (!Array.isArray(s.intent.depends_on_phase_capsules)) {
      errs.push('intent.depends_on_phase_capsules: must be array');
    }
  }
  // baseline_signature
  _checkClosedKeys(s.baseline_signature, _BASELINE_KEYS,
                   'baseline_signature', errs);
  if (s.baseline_signature && typeof s.baseline_signature === 'object') {
    const bs = s.baseline_signature;
    if (typeof bs.actual_tokens_total !== 'number' ||
        bs.actual_tokens_total < 0 ||
        Math.floor(bs.actual_tokens_total) !== bs.actual_tokens_total) {
      errs.push('baseline_signature.actual_tokens_total: integer >=0');
    }
    if (typeof bs.actual_cache_read_tokens !== 'number' ||
        bs.actual_cache_read_tokens < 0 ||
        Math.floor(bs.actual_cache_read_tokens) !==
          bs.actual_cache_read_tokens) {
      errs.push('baseline_signature.actual_cache_read_tokens: integer >=0');
    }
    if (typeof bs.source_event_id !== 'string' ||
        bs.source_event_id.length < 1) {
      errs.push('baseline_signature.source_event_id: non-empty string');
    }
  }
  // expected_evidence
  if (!Array.isArray(s.expected_evidence) ||
      s.expected_evidence.length < 3) {
    errs.push('expected_evidence: must have >=3 entries');
  } else {
    for (let i = 0; i < s.expected_evidence.length; i++) {
      const ev = s.expected_evidence[i];
      const lbl = 'expected_evidence[' + i + ']';
      _checkClosedKeys(ev, _EVIDENCE_KEYS, lbl, errs);
      if (ev && typeof ev === 'object') {
        if (_SCHEMA_KIND.indexOf(ev.kind) === -1) {
          errs.push(lbl + '.kind: not in KIND enum');
        }
        if (typeof ev.ref !== 'string' || ev.ref.length < 1) {
          errs.push(lbl + '.ref: non-empty string');
        }
        if (_SCHEMA_MUST_APPEAR_IN.indexOf(ev.must_appear_in) === -1) {
          errs.push(lbl + '.must_appear_in: not in enum');
        }
      }
    }
  }
  // anti_cheat_signal
  _checkClosedKeys(s.anti_cheat_signal, _ANTI_CHEAT_KEYS,
                   'anti_cheat_signal', errs);
  if (s.anti_cheat_signal && typeof s.anti_cheat_signal === 'object') {
    const ac = s.anti_cheat_signal;
    if (!Array.isArray(ac.must_not_contain_in_packet) ||
        ac.must_not_contain_in_packet.length < 1) {
      errs.push('anti_cheat_signal.must_not_contain_in_packet: >=1 entry');
    }
    if (!Array.isArray(ac.must_not_set_role_to) ||
        ac.must_not_set_role_to.length < 1) {
      errs.push('anti_cheat_signal.must_not_set_role_to: >=1 entry');
    }
  }
  // expected_route
  _checkClosedKeys(s.expected_route, _ROUTE_KEYS, 'expected_route', errs);
  if (s.expected_route && typeof s.expected_route === 'object') {
    const er = s.expected_route;
    if (_SCHEMA_UNCERTAINTY_TYPES.indexOf(er.uncertainty_type) === -1) {
      errs.push('expected_route.uncertainty_type: not in enum');
    }
    if (_SCHEMA_PROVIDERS.indexOf(er.primary) === -1) {
      errs.push('expected_route.primary: not in {claude,codex,vtp_bridge}');
    }
    if (!Array.isArray(er.fallback_chain)) {
      errs.push('expected_route.fallback_chain: must be array');
    } else {
      for (let i = 0; i < er.fallback_chain.length; i++) {
        if (_SCHEMA_PROVIDERS.indexOf(er.fallback_chain[i]) === -1) {
          errs.push('expected_route.fallback_chain[' + i + ']: not in enum');
        }
      }
    }
  }
  return { ok: errs.length === 0, errors: errs };
}

function _hasLock13Wrapper(fn) {
  // Heuristic: function source must contain a top-level try/catch. We do
  // not parse AST; a substring check on the function source is sufficient
  // because the skeleton wrappers are tiny.
  try {
    const src = Function.prototype.toString.call(fn);
    return src.indexOf('try') !== -1 && src.indexOf('catch') !== -1;
  } catch (_e) {
    return false;
  }
}

function _selfTest() {
  const results = [];
  function check(name, ok, detail) {
    results.push({ name, ok: !!ok, detail: detail || '' });
  }

  // 1: SCENARIOS frozen 6-entry array (T3 fills with S1..S6). Mutation
  // attempts must be no-ops (Object.freeze enforces that natively in
  // strict mode this throws; outside strict it silently fails -- we
  // verify the array length is unchanged after a push attempt).
  let scenariosFrozenOk = false;
  let scenariosFrozenDetail = '';
  try {
    const lenBefore = Array.isArray(SCENARIOS) ? SCENARIOS.length : -1;
    let mutationThrew = false;
    try {
      // Outside strict mode this is a silent no-op; inside strict it
      // throws. Either outcome is acceptable as long as the length
      // does not change.
      SCENARIOS.push({ injected: 'attempt' });
    } catch (_em) {
      mutationThrew = true;
    }
    const lenAfter = Array.isArray(SCENARIOS) ? SCENARIOS.length : -2;
    scenariosFrozenOk = _isFrozen(SCENARIOS) &&
                       Array.isArray(SCENARIOS) &&
                       SCENARIOS.length === 6 &&
                       lenBefore === 6 &&
                       lenAfter === 6;
    scenariosFrozenDetail = 'len=' + lenAfter
                            + ' frozen=' + _isFrozen(SCENARIOS)
                            + ' mutation_threw=' + mutationThrew;
  } catch (e) {
    scenariosFrozenDetail = 'threw: '
      + (e && e.message ? e.message : 'unknown');
  }
  check('SCENARIOS_frozen_6_entry_mutation_noop',
        scenariosFrozenOk, scenariosFrozenDetail);

  // 2: INJECTION_FIXTURES frozen (T4 will fill while keeping it frozen).
  check('INJECTION_FIXTURES_frozen',
        _isFrozen(INJECTION_FIXTURES) && Array.isArray(INJECTION_FIXTURES),
        'Object.isFrozen + Array.isArray');

  // 3: BENCH_REASON_CODES frozen and >=10 entries.
  check('BENCH_REASON_CODES_frozen_ge10',
        _isFrozen(BENCH_REASON_CODES) &&
          Array.isArray(BENCH_REASON_CODES) &&
          BENCH_REASON_CODES.length >= 10,
        'len=' + (Array.isArray(BENCH_REASON_CODES)
                   ? BENCH_REASON_CODES.length : 'n/a'));

  // 4: All 5 public-API names exist as functions.
  const apis = { runBench, replayScenario, injectFailure, scoreScenario,
                 renderReport };
  const apiOk = Object.keys(apis).every(function (k) {
    return typeof apis[k] === 'function';
  });
  check('public_api_5_stubs_present', apiOk,
        'runBench/replayScenario/injectFailure/scoreScenario/renderReport');

  // 5: Lock 13 wrapper present on every public API.
  const lock13Ok = Object.keys(apis).every(function (k) {
    return _hasLock13Wrapper(apis[k]);
  });
  check('lock13_wrapper_present', lock13Ok,
        'try/catch detected in each public API source');

  // -------------------------------------------------------------------
  // T2 assertions (5). See plan 51-01 lines 272-277 for the contract.
  // -------------------------------------------------------------------

  // T2.1: Phase 41 `summarize` import is the LIVE function (Lock 4).
  // typeof must be 'function' AND arity must be >= 2 (planningDir, opts).
  const sumIsFn = typeof tokenAttr.summarize === 'function';
  const sumArity = sumIsFn ? tokenAttr.summarize.length : -1;
  check('t2_summarize_is_live_function',
        sumIsFn && sumArity >= 2,
        'typeof=' + typeof tokenAttr.summarize + ' arity=' + sumArity);

  // T2.2: readBaselineFromLedger is callable and returns the contracted
  // shape when given a synthesized scenario object. The actual S2 row-
  // count anchor (>=150,000 tokens for v1.8/P36/researcher) lands in T3
  // self-test 9 (when real fixtures with scenario_id ship). For T2 we
  // only assert the shape: keys present, ok+reason set, source_event_ids
  // is an array. Pointed at the real ledger so a missing role still
  // returns the documented degraded sentinel rather than throwing.
  let baselineShapeOk = false;
  let baselineShapeDetail = '';
  try {
    const b = replay.readBaselineFromLedger({
      scenario: {
        scenario_id: 'T2-shape-probe',
        drawn_from: { milestone: 'v1.8', role: 'researcher', phase: '36' },
      },
      planningDir: path.resolve(__dirname, '../../../.planning'),
    });
    const shapeKeys = ['ok', 'reason', 'tokens', 'cache_read_ratio',
                       'useful_findings_per_100k', 'source_event_ids'];
    const allKeysPresent = shapeKeys.every(function (k) {
      return Object.prototype.hasOwnProperty.call(b, k);
    });
    baselineShapeOk = allKeysPresent
      && Array.isArray(b.source_event_ids)
      && typeof b.reason === 'string'
      && typeof b.ok === 'boolean';
    baselineShapeDetail = 'reason=' + b.reason
      + ' tokens=' + b.tokens
      + ' src_ids=' + b.source_event_ids.length;
  } catch (e) {
    baselineShapeDetail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t2_baseline_reader_callable_and_shape',
        baselineShapeOk, baselineShapeDetail);

  // T2.3: assertWorkspaceClean rejects every forbidden anti-cheat
  // string. Parametric: build a tmpdir, drop a file containing one
  // forbidden token, expect the call to throw; repeat for all 6.
  let antiCheatOk = true;
  let antiCheatDetail = '';
  let tmpRoot = null;
  try {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p51-t2-anticheat-'));
    const forbidden = (replay.FORBIDDEN_STRINGS || []);
    if (forbidden.length !== 6) {
      antiCheatOk = false;
      antiCheatDetail = 'FORBIDDEN_STRINGS len=' + forbidden.length
                        + ' (expected 6)';
    } else {
      for (let fi = 0; fi < forbidden.length; fi++) {
        const tok = forbidden[fi];
        const dir = fs.mkdtempSync(path.join(tmpRoot, 'case-' + fi + '-'));
        const file = path.join(dir, 'fixture.txt');
        fs.writeFileSync(file, 'pre ' + tok + ' post', 'utf8');
        let threw = false;
        try {
          replay.assertWorkspaceClean(dir);
        } catch (_eAC) {
          threw = true;
        }
        if (!threw) {
          antiCheatOk = false;
          antiCheatDetail = 'failed_to_reject_' + tok;
          break;
        }
      }
      if (antiCheatOk) {
        antiCheatDetail = 'all 6 forbidden strings rejected';
      }
    }
  } catch (e) {
    antiCheatOk = false;
    antiCheatDetail = 'setup_threw: '
      + (e && e.message ? e.message : 'unknown');
  } finally {
    if (tmpRoot) {
      try { fs.rmSync(tmpRoot, { recursive: true, force: true }); }
      catch (_eR) { /* best effort */ }
    }
  }
  check('t2_assert_workspace_clean_rejects_6', antiCheatOk, antiCheatDetail);

  // T2.4 (post-T3 evolution): mapPhasesToBaseline now resolves all 6
  // SCENARIOS to baseline rows. Per the T2 comment that anticipated this
  // transition ("T3 self-test 9 will assert len=6 once SCENARIOS is
  // filled"), the assertion flips from "empty -> {}" to "len=6 with each
  // value carrying the contracted baseline_read_ok shape". Set-membership
  // + structural equality only (Lock 11). Also probes empty input
  // separately to keep the empty-safe contract anchored.
  let mapOk = false;
  let mapDetail = '';
  try {
    // Empty-input branch (degraded contract still holds).
    const mEmpty = replay.mapPhasesToBaseline([],
      path.resolve(__dirname, '../../../.planning'));
    const emptyOk = mEmpty && typeof mEmpty === 'object'
                    && !Array.isArray(mEmpty)
                    && Object.keys(mEmpty).length === 0;
    // Real-input branch: 6 fixtures -> 6 keys, each an object with the
    // contracted baseline keys.
    const mFull = replay.mapPhasesToBaseline(SCENARIOS,
      path.resolve(__dirname, '../../../.planning'));
    const baselineKeys = ['ok', 'reason', 'tokens', 'cache_read_ratio',
                          'useful_findings_per_100k', 'source_event_ids'];
    const fullKeys = Object.keys(mFull || {});
    let shapesOk = fullKeys.length === 6;
    if (shapesOk) {
      for (let i = 0; i < SCENARIOS.length; i++) {
        const sid = SCENARIOS[i].scenario_id;
        const row = mFull[sid];
        if (!row) { shapesOk = false; break; }
        for (let j = 0; j < baselineKeys.length; j++) {
          if (!Object.prototype.hasOwnProperty.call(row, baselineKeys[j])) {
            shapesOk = false; break;
          }
        }
        if (!shapesOk) break;
      }
    }
    mapOk = emptyOk && shapesOk;
    mapDetail = 'empty_map_keys=' + Object.keys(mEmpty || {}).length
                + ' full_map_keys=' + fullKeys.length
                + ' shapes_ok=' + shapesOk;
  } catch (e) {
    mapDetail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t2_map_phases_to_baseline_empty_and_full',
        mapOk, mapDetail);

  // T2.5: replayScenario stub returns mode_used='ledger-only' when
  // claudeBinary is null. This is the falsifier's explicit anchor:
  // "claudeBinary=null path throws instead of returning
  //  mode_used='ledger-only' (Lock 13 violation)" -> we assert no throw
  // AND the literal label match.
  let replayStubOk = false;
  let replayStubDetail = '';
  try {
    const rs = replay.replayScenario({
      scenario: { scenario_id: 'T2-replay-probe' },
      mode: 'ledger-only',
      claudeBinary: null,
    });
    replayStubOk = rs && rs.mode_used === 'ledger-only'
                   && rs.tokens_after === null
                   && Array.isArray(rs.post_artifacts)
                   && rs.scenario_run_id === null;
    replayStubDetail = 'mode_used=' + (rs && rs.mode_used)
                       + ' tokens_after=' + (rs && rs.tokens_after);
  } catch (e) {
    replayStubDetail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t2_replay_stub_ledger_only_when_no_binary',
        replayStubOk, replayStubDetail);

  // -------------------------------------------------------------------
  // T3 assertions (5). Plan 51-01 lines 322-325 + falsifier:
  //   - SCENARIO.schema.json validates every shipped fixture
  //   - every baseline_signature.source_event_id resolves to a real
  //     ledger row
  //   - expected_route.primary is in closed enum {claude,codex,vtp_bridge}
  //   - S2 baseline read (via T2 reader, real scenario_id) returns
  //     >=150,000 tokens (audit:142 anchor)
  //   - SCENARIOS frozen 6-entry mutation no-op covered by self-test #1.
  // The new T3 assertions are 11..15 (10 prior PASS + 5 new = 15).
  // -------------------------------------------------------------------

  // T3.1: schema round-trip every fixture.
  let allValid = true;
  let validDetail = '';
  const validErrs = [];
  for (let i = 0; i < SCENARIOS.length; i++) {
    const v = _validateScenario(SCENARIOS[i]);
    if (!v.ok) {
      allValid = false;
      validErrs.push(SCENARIOS[i].scenario_id + ':'
                     + v.errors.slice(0, 2).join(';'));
    }
  }
  validDetail = allValid
    ? 'all ' + SCENARIOS.length + ' fixtures schema-valid'
    : 'errors=' + validErrs.join(' | ');
  check('t3_schema_validates_all_fixtures', allValid, validDetail);

  // T3.2: every fixture's baseline_signature.source_event_id resolves to
  // a real ledger row. Read the JSONL once, build a Set, then probe.
  let allResolve = true;
  let resolveDetail = '';
  const resolveMisses = [];
  try {
    const ledgerP = path.resolve(__dirname,
      '../../../.planning/metrics/agent-token-spend.jsonl');
    if (!fs.existsSync(ledgerP)) {
      allResolve = false;
      resolveDetail = 'ledger_missing: ' + ledgerP;
    } else {
      const idSet = Object.create(null);
      const text = fs.readFileSync(ledgerP, 'utf8');
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (!ln) continue;
        let r;
        try { r = JSON.parse(ln); } catch (_e) { continue; }
        const tb = r && r.token_breakdown;
        if (tb && tb.source_event_id) idSet[tb.source_event_id] = true;
      }
      for (let j = 0; j < SCENARIOS.length; j++) {
        const sid = SCENARIOS[j].baseline_signature
                    && SCENARIOS[j].baseline_signature.source_event_id;
        if (!sid || !idSet[sid]) {
          allResolve = false;
          resolveMisses.push(SCENARIOS[j].scenario_id + '->' + sid);
        }
      }
      resolveDetail = allResolve
        ? 'all 6 source_event_ids resolved'
        : 'misses=' + resolveMisses.join(' | ');
    }
  } catch (e) {
    allResolve = false;
    resolveDetail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t3_source_event_ids_resolve_in_ledger',
        allResolve, resolveDetail);

  // T3.3: expected_route.primary closed-enum check (set-membership).
  // Belt-and-braces vs T3.1 (which already enforces this) so the
  // assertion is named in the test report and a Lock 11 violation
  // surfaces with the offending fixture id.
  let allRouteOk = true;
  const routeMisses = [];
  const PROVIDER_ENUM = ['claude', 'codex', 'vtp_bridge'];
  for (let i = 0; i < SCENARIOS.length; i++) {
    const er = SCENARIOS[i].expected_route || {};
    if (PROVIDER_ENUM.indexOf(er.primary) === -1) {
      allRouteOk = false;
      routeMisses.push(SCENARIOS[i].scenario_id + '->' + er.primary);
    }
  }
  check('t3_expected_route_primary_in_closed_enum',
        allRouteOk,
        allRouteOk
          ? 'all 6 primaries in {claude,codex,vtp_bridge}'
          : 'misses=' + routeMisses.join(' | '));

  // T3.4: S2 baseline read >=150,000 tokens. Real scenario_id ships in
  // T3 so we can run the full end-to-end ledger reader against it.
  let s2Ok = false;
  let s2Detail = '';
  try {
    const s2 = SCENARIOS.find(function (s) {
      return s && s.scenario_id === 'S2-v18-P36';
    }) || null;
    if (!s2) {
      s2Detail = 'S2-v18-P36 not in SCENARIOS';
    } else {
      const b = replay.readBaselineFromLedger({
        scenario: s2,
        planningDir: path.resolve(__dirname, '../../../.planning'),
      });
      const tokens = (b && typeof b.tokens === 'number') ? b.tokens : -1;
      s2Ok = b && b.ok === true && tokens >= 150000;
      s2Detail = 'reason=' + (b && b.reason)
                 + ' tokens=' + tokens
                 + ' (audit:142 anchor: 171,175)';
    }
  } catch (e) {
    s2Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t3_s2_baseline_ge_150k_tokens', s2Ok, s2Detail);

  // T3.5: S1-S4 primary='claude'; S5 primary='codex'; S6 primary='vtp_bridge'.
  // This pins the per-scenario provider matrix the falsifier locks
  // (RESEARCH 1.3 + plan output_contract). Set-membership only.
  const PROVIDER_BY_ID = {
    'S1-v17-P32': 'claude',
    'S2-v18-P36': 'claude',
    'S3-v18-P40': 'claude',
    'S4-v16-P26': 'claude',
    'S5-v17-P34': 'codex',
    'S6-v15-P21': 'vtp_bridge',
  };
  let matrixOk = true;
  const matrixMisses = [];
  for (let i = 0; i < SCENARIOS.length; i++) {
    const sid = SCENARIOS[i].scenario_id;
    const want = PROVIDER_BY_ID[sid];
    const got = (SCENARIOS[i].expected_route || {}).primary;
    if (!want || want !== got) {
      matrixOk = false;
      matrixMisses.push(sid + ' want=' + want + ' got=' + got);
    }
  }
  check('t3_provider_matrix_S1S4_claude_S5_codex_S6_vtp',
        matrixOk,
        matrixOk
          ? 'all 6 fixtures match the locked S1-S4=claude/S5=codex/S6=vtp_bridge matrix'
          : 'misses=' + matrixMisses.join(' | '));

  // -------------------------------------------------------------------
  // T4 assertions (5-8). Plan 51-01 lines 380-388:
  //   - INJECTION_FIXTURES frozen 16-entry; mutation no-op
  //   - canonical fingerprint guard: 4 streams unchanged after F1-F16
  //     snapshot+inject+restore round-trip (anti-pollution self-test)
  //   - F1 (missing capsule) yields packet_capsule_unavailable_raw_fallback
  //   - F8 (critical bypass) preserves byte-verbatim CRIT text
  //   - F10 (prompt injection) wraps in fenced code AND intent-map
  //     flagged with prompt_injection_pattern_treated_as_data;
  //     SECRET_PLACEHOLDER_X literal, no real key prefix
  //   - F11 (semantic-only) is REJECTED; v1.6/P26 absent from S2 packet
  //   - canonical fingerprint guard: 4 source streams unchanged across
  //     the entire self-test run
  // -------------------------------------------------------------------

  const planningDir = path.resolve(__dirname, '../../../.planning');

  // Full-run anti-pollution: snapshot the 4 canonical streams BEFORE any
  // T4 injector touches anything. We compare again at the end (T4.7).
  const _t4_initialFp = _injectors.snapshotCanonicalStreams(planningDir);

  // T4.1: INJECTION_FIXTURES frozen 16-entry; mutation no-op.
  let injFrozenOk = false;
  let injFrozenDetail = '';
  try {
    const lenBefore = Array.isArray(INJECTION_FIXTURES)
                      ? INJECTION_FIXTURES.length : -1;
    let mutationThrew = false;
    try {
      INJECTION_FIXTURES.push({ injected: 'attempt' });
    } catch (_em) { mutationThrew = true; }
    const lenAfter = Array.isArray(INJECTION_FIXTURES)
                     ? INJECTION_FIXTURES.length : -2;
    injFrozenOk = _isFrozen(INJECTION_FIXTURES)
      && Array.isArray(INJECTION_FIXTURES)
      && INJECTION_FIXTURES.length === 16
      && lenBefore === 16
      && lenAfter === 16;
    injFrozenDetail = 'len=' + lenAfter
      + ' frozen=' + _isFrozen(INJECTION_FIXTURES)
      + ' mutation_threw=' + mutationThrew;
  } catch (e) {
    injFrozenDetail = 'threw: '
      + (e && e.message ? e.message : 'unknown');
  }
  check('t4_INJECTION_FIXTURES_frozen_16_entry_mutation_noop',
        injFrozenOk, injFrozenDetail);

  // T4.2: anti-pollution canonical fingerprint round-trip across F1..F16.
  // Snapshot fp_before, run snapshot+inject+restore for each fixture,
  // snapshot fp_after, assert deep equality. Includes the absent-stream
  // baseline contract (route-decisions.jsonl on this snapshot is absent;
  // sha256(empty)+mtime=0+size=0 must round-trip unchanged).
  let antiPollutionOk = false;
  let antiPollutionDetail = '';
  try {
    const fpBefore = _injectors.snapshotCanonicalStreams(planningDir);
    const fixtureIds = INJECTION_FIXTURES.map(function (f) { return f.id; });
    let allRoundTripsOk = true;
    const failedRoundTrips = [];
    for (let i = 0; i < fixtureIds.length; i++) {
      const id = fixtureIds[i];
      const handle = _injectors.injectFailure(id, {
        planningDir: planningDir,
        milestone: 'v1.8',
        phase: 36,
      });
      try {
        const sOk = handle.snapshot();
        const iOk = handle.inject();
        const oOk = handle.observe();
        const rOk = handle.restore();
        if (!(sOk && iOk && oOk && rOk)) {
          // SOFT-SKIP fixtures still return true for all 4 steps.
          if (!handle.skipped) {
            allRoundTripsOk = false;
            failedRoundTrips.push(id + '(steps_failed)');
          }
        }
      } catch (_e) {
        allRoundTripsOk = false;
        failedRoundTrips.push(id + '(threw)');
      }
    }
    const fpAfter = _injectors.snapshotCanonicalStreams(planningDir);
    const cmp = _injectors.compareCanonicalStreams(fpBefore, fpAfter);
    antiPollutionOk = allRoundTripsOk && cmp.ok;
    antiPollutionDetail = 'fixtures_run=' + fixtureIds.length
      + ' round_trips_ok=' + allRoundTripsOk
      + ' streams_drift=' + (cmp.drift.length === 0
                              ? 'none' : cmp.drift.join(','))
      + (failedRoundTrips.length
          ? ' failed=' + failedRoundTrips.join('|') : '');
  } catch (e) {
    antiPollutionDetail = 'threw: '
      + (e && e.message ? e.message : 'unknown');
  }
  check('t4_anti_pollution_fingerprint_round_trip', antiPollutionOk,
        antiPollutionDetail);

  // T4.3: F1 (missing capsule) declares the
  // packet_capsule_unavailable_raw_fallback reason in its expected set.
  // The harness asserts the catalog entry exposes the right reason code
  // (the T5 replay path will verify the reason is observed at runtime;
  // T4 verifies the contract).
  let f1Ok = false;
  let f1Detail = '';
  try {
    const f1 = INJECTION_FIXTURES.find(function (f) { return f.id === 'F1'; });
    f1Ok = !!f1
      && Array.isArray(f1.expected_reason_codes)
      && f1.expected_reason_codes.indexOf(
           'packet_capsule_unavailable_raw_fallback') !== -1;
    // Also exercise the inject+observe round-trip end-to-end and
    // confirm the handle returns the inject_applied reason.
    const handle = _injectors.injectFailure('F1', {
      planningDir: planningDir,
      milestone: 'v1.8', phase: 36,
    });
    const ok1 = handle.snapshot();
    const ok2 = handle.inject();
    const ok3 = handle.observe();
    const ok4 = handle.restore();
    f1Ok = f1Ok && handle.reason === 'inject_applied'
      && ok1 && ok2 && ok3 && ok4;
    f1Detail = 'expected_reason=packet_capsule_unavailable_raw_fallback'
      + ' handle_reason=' + handle.reason;
  } catch (e) {
    f1Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t4_F1_missing_capsule_reason_code', f1Ok, f1Detail);

  // T4.4: F8 (critical bypass) preserves byte-verbatim CRIT text. The
  // synthetic CRIT row is captured in the handle's _payload; the mirror
  // file on disk is asserted byte-equal to JSON.stringify(payload)+'\n'
  // both before and after inject() (Lock 6: no compression, no rewrite).
  let f8Ok = false;
  let f8Detail = '';
  try {
    const handle = _injectors.injectFailure('F8', {
      planningDir: planningDir,
      milestone: 'v1.8', phase: 36,
    });
    const sOk = handle.snapshot();
    const iOk = handle.inject();
    const payload = handle._payload ? handle._payload() : null;
    const mirrorPath = handle._mirrorPath ? handle._mirrorPath() : null;
    let bytesMatch = false;
    if (payload && mirrorPath && fs.existsSync(mirrorPath)) {
      const onDisk = fs.readFileSync(mirrorPath, 'utf8');
      const expected = JSON.stringify(payload) + '\n';
      bytesMatch = (onDisk === expected);
    }
    const oOk = handle.observe();
    const rOk = handle.restore();
    f8Ok = sOk && iOk && oOk && rOk && bytesMatch
      && payload && payload.severity === 'CRITICAL'
      && payload.text && payload.text.indexOf('verbatim only') !== -1;
    f8Detail = 'snapshot=' + sOk + ' inject=' + iOk
      + ' bytes_match=' + bytesMatch
      + ' severity=' + (payload && payload.severity);
  } catch (e) {
    f8Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t4_F8_critical_bypass_byte_verbatim', f8Ok, f8Detail);

  // T4.5: F10 (prompt injection) wraps in fenced code AND intent-map
  // row flagged with prompt_injection_pattern_treated_as_data;
  // SECRET_PLACEHOLDER_X literal present (no AKIA/sk-/ghp_ prefix).
  let f10Ok = false;
  let f10Detail = '';
  try {
    const handle = _injectors.injectFailure('F10', {});
    const sOk = handle.snapshot();
    const iOk = handle.inject();
    const payload = handle._payload ? handle._payload() : null;
    const oOk = handle.observe();
    const rOk = handle.restore();
    let fencedWrapOk = false;
    let flagOk = false;
    let placeholderLiteralOk = false;
    let noRealSecretOk = false;
    if (payload) {
      fencedWrapOk = typeof payload.expected_wrap === 'string'
        && payload.expected_wrap.indexOf('```') === 0
        && payload.expected_wrap.lastIndexOf('```')
             > payload.expected_wrap.indexOf('```');
      flagOk = payload.expected_intent_map_flag
        === 'prompt_injection_pattern_treated_as_data';
      placeholderLiteralOk = payload.placeholder
        === '{SECRET_PLACEHOLDER_X}'
        && payload.raw_markdown
        && payload.raw_markdown.indexOf('{SECRET_PLACEHOLDER_X}') !== -1;
      // CLAUDE.md absolute: no AKIA/sk-/ghp_ prefix anywhere in payload.
      const allText = JSON.stringify(payload);
      noRealSecretOk = allText.indexOf('AKIA') === -1
        && allText.indexOf('sk-') === -1
        && allText.indexOf('ghp_') === -1;
    }
    f10Ok = sOk && iOk && oOk && rOk
      && fencedWrapOk && flagOk
      && placeholderLiteralOk && noRealSecretOk;
    f10Detail = 'fenced=' + fencedWrapOk
      + ' flag=' + flagOk
      + ' placeholder=' + placeholderLiteralOk
      + ' no_real_secret=' + noRealSecretOk;
  } catch (e) {
    f10Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t4_F10_prompt_injection_fenced_and_flagged', f10Ok, f10Detail);

  // T4.6: F11 (semantic-only) is REJECTED; v1.6/P26 absent from S2
  // packet body. The fixture catalog declares
  // intent_relationship_semantic_only_demoted as the reason; we assert
  // the synthetic payload's structural_reason is null AND the v1.6/P26
  // tuple is NOT in the S2 fixture's intent.depends_on_phase_capsules
  // (set-membership only; Lock 11).
  let f11Ok = false;
  let f11Detail = '';
  try {
    const handle = _injectors.injectFailure('F11', {});
    const sOk = handle.snapshot();
    const iOk = handle.inject();
    const payload = handle._payload ? handle._payload() : null;
    const oOk = handle.observe();
    const rOk = handle.restore();
    const s2 = SCENARIOS.find(function (s) {
      return s && s.scenario_id === 'S2-v18-P36';
    }) || null;
    let s2HasV16P26 = false;
    if (s2 && s2.intent && Array.isArray(s2.intent.depends_on_phase_capsules)) {
      const list = s2.intent.depends_on_phase_capsules;
      for (let i = 0; i < list.length; i++) {
        const ent = list[i];
        if (typeof ent === 'string') {
          if (ent.indexOf('v1.6') !== -1 && ent.indexOf('P26') !== -1) {
            s2HasV16P26 = true; break;
          }
        } else if (ent && typeof ent === 'object') {
          if (ent.milestone === 'v1.6'
              && (ent.phase === 26 || ent.phase === '26')) {
            s2HasV16P26 = true; break;
          }
        }
      }
    }
    const structuralReasonNull = payload
      && payload.structural_reason === null
      && payload.claimed_reason === 'semantic_similarity_only';
    f11Ok = sOk && iOk && oOk && rOk
      && structuralReasonNull
      && !s2HasV16P26;
    f11Detail = 'structural_reason_null=' + structuralReasonNull
      + ' s2_has_v16_p26=' + s2HasV16P26 + ' (must be false)';
  } catch (e) {
    f11Detail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t4_F11_semantic_only_rejected_v16_p26_absent_from_S2',
        f11Ok, f11Detail);

  // T4.7: canonical fingerprint guard - 4 source streams unchanged
  // across the entire T4 self-test run. Compares fp_initial (taken
  // before T4.1) against a fresh snapshot here.
  let finalFpOk = false;
  let finalFpDetail = '';
  try {
    const fpFinal = _injectors.snapshotCanonicalStreams(planningDir);
    const cmp = _injectors.compareCanonicalStreams(_t4_initialFp, fpFinal);
    finalFpOk = cmp.ok;
    finalFpDetail = cmp.ok
      ? '4 canonical streams unchanged across full T4 run'
      : 'drift=' + cmp.drift.join(',');
  } catch (e) {
    finalFpDetail = 'threw: ' + (e && e.message ? e.message : 'unknown');
  }
  check('t4_canonical_fingerprint_guard_full_run',
        finalFpOk, finalFpDetail);

  return results;
}

function _printSelfTest(results) {
  let pass = 0;
  for (const r of results) {
    const tag = r.ok ? 'PASS' : 'FAIL';
    // ASCII-only logging.
    process.stdout.write(tag + ' ' + r.name + ' ' + r.detail + '\n');
    if (r.ok) pass++;
  }
  process.stdout.write('---\n');
  process.stdout.write('self-test: ' + pass + '/' + results.length +
                       ' assertions passed\n');
  return pass === results.length;
}

// ---------------------------------------------------------------------------
// CLI entry. Lock 13: the CLI surface itself must never throw upward.
// ---------------------------------------------------------------------------

function _main(argv) {
  try {
    const args = argv.slice(2);
    if (args.indexOf('--self-test') !== -1) {
      const results = _selfTest();
      const ok = _printSelfTest(results);
      process.exit(ok ? 0 : 1);
      return;
    }
    if (args.indexOf('--help') !== -1 || args.length === 0) {
      process.stdout.write(
        'context-bench harness (Phase 51 skeleton)\n' +
        'usage:\n' +
        '  node super-gsd/tools/context-bench/harness.cjs --self-test\n' +
        '  node super-gsd/tools/context-bench/harness.cjs --help\n' +
        'note: T5/T6/T7 add --run, --report, --gate flags.\n');
      process.exit(0);
      return;
    }
    // Unknown args in skeleton: degraded exit (Lock 13: never throw).
    process.stdout.write('unknown args; try --help or --self-test\n');
    process.exit(2);
  } catch (_e) {
    process.stdout.write('gate_internal_error\n');
    process.exit(3);
  }
}

if (require.main === module) {
  _main(process.argv);
}

module.exports = {
  // Frozen surface (placeholders T3/T4 fill).
  SCENARIOS,
  INJECTION_FIXTURES,
  BENCH_REASON_CODES,
  // Public API stubs (Lock 13 wrappers; T5..T7 fill internals).
  runBench,
  replayScenario,
  injectFailure,
  scoreScenario,
  renderReport,
  // Test helpers (exported so T2..T7 self-test additions can compose).
  _selfTest,
  selfTest: _selfTest,
};
