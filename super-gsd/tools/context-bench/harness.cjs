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
// Frozen placeholders. T3 + T4 fill these. Do not unfreeze.
// ---------------------------------------------------------------------------

// SCENARIOS - filled by T3 with 6 scenario fixtures (S1..S6) loaded from
// super-gsd/tools/context-bench/scenarios/*.json. Until then, frozen empty.
const SCENARIOS = Object.freeze([]);

// INJECTION_FIXTURES - filled by T4 with the closed-vocab failure injectors
// (e.g. capsule_decision missing, bypass_ref redaction, atc_finding stub,
// verifier_verdict mismatch, validated_thought absent, downstream_constraint
// dropped). Until then, frozen empty.
const INJECTION_FIXTURES = Object.freeze([]);

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

  // 1: SCENARIOS frozen (T3 will fill while keeping it frozen).
  check('SCENARIOS_frozen', _isFrozen(SCENARIOS) && Array.isArray(SCENARIOS),
        'Object.isFrozen + Array.isArray');

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
};
