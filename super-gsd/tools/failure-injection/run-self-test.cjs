#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/failure-injection/run-self-test.cjs
// Phase 53 self-test entry. Idempotent: 24-assertion run + 10-scenario --run-all
// check via separate spawn. Operator runs
//   node super-gsd/tools/failure-injection/run-self-test.cjs
// for fast green.
//
// THIS FILE IS A THIN SHELL.
//   - It spawns `node harness.cjs --self-test` via child_process.spawnSync,
//     streams stdout/stderr through, propagates the exit code, then (when
//     --self-test green) spawns a SECOND child for `node harness.cjs --run-all`
//     and reports dual-pass status.
//   - It introduces NO new aggregator, NO new oracle, NO new assertion. The
//     T7 falsifier in 53-RESEARCH.md rejects any addition. The single allowed
//     job is to give operators a one-line invocation that exercises both the
//     bootstrap suite (--self-test, 24/24) AND the full driver path
//     (--run-all, 10/10) in a single run.
//
// TWO-PHASE EXECUTION
//   Phase 1: --self-test  -> 24 assertions; sub-60s; READ-ONLY (does not
//                            touch live .planning/metrics/* canonical streams).
//   Phase 2: --run-all    -> 10 scenarios end-to-end; appends one envelope-v1
//                            witness row to failure-injection-log.jsonl per
//                            scenario; PASS verdict required. Skipped if
//                            phase 1 failed (fail-fast preserves exit-code
//                            signal clarity for milestone-close gates).
//
// INTEGRATION
//   The Phase 53 self-test stands on its own. The wrapper
//     node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0
//   runs the Phase 51 context-bench self-test (33/33), the Phase 52
//   redis-adapter self-test (26/26), AND THIS Phase 53 failure-injection
//   harness self-test (24/24) plus its --run-all green (10/10) as a
//   triple-gate (four-spawn) before allowing v2.0 milestone close. Operator
//   may also invoke this entry directly for narrow verification.
//
// EXIT CODE
//   - 0 -> harness self-test 24/24 PASS AND --run-all 10/10 PASS (dual green).
//   - 1 -> harness self-test reports any FAIL (--run-all skipped).
//   - 1 -> --run-all exits non-zero after self-test green (rare; means a
//          live-tool path drifted without the bootstrap noticing).
//   - any other non-zero -> propagated verbatim from whichever harness
//                            child raised it.
//
// ASCII-ONLY.
// =============================================================================

'use strict';

const child_process = require('child_process');
const path = require('path');

const harness = path.join(__dirname, 'harness.cjs');

// ----------------------------------------------------------------------------
// Phase 1: --self-test (24 assertions). Streams stdout/stderr through; the
// child's CLI dispatch already prints per-assertion PASS/FAIL lines and a
// trailing summary. spawnSync may yield null on signal -> map to 1 so we
// never accidentally exit 0 on a killed child. Lock 13: any spawn error
// surfaces as a stderr tag + non-zero exit; we never throw upward.
// ----------------------------------------------------------------------------

const selfTestResult = child_process.spawnSync(
  process.execPath,
  [harness, '--self-test'],
  { stdio: 'inherit' }
);

if (selfTestResult.error) {
  process.stderr.write('run-self-test:self_test_spawn_failed message='
    + (selfTestResult.error.message || 'unknown') + '\n');
  process.exit(1);
}

const selfTestCode = (typeof selfTestResult.status === 'number')
  ? selfTestResult.status : 1;

if (selfTestCode !== 0) {
  // Fail-fast: do NOT run --run-all if the bootstrap suite is red. The
  // milestone-close gate consumer reads only the exit code; preserving the
  // single-failure signal keeps stderr triage clean.
  process.stderr.write('run-self-test: bootstrap --self-test failed (exit='
    + selfTestCode + '); skipping --run-all\n');
  process.exit(selfTestCode);
}

// ----------------------------------------------------------------------------
// Phase 2: --run-all (10 scenarios). Bootstrap green, so we now exercise the
// full driver path. The child appends envelope-v1 rows to
// .planning/metrics/failure-injection-log.jsonl (one per scenario), runs the
// aggregator, and exits 0 only when verdict in {PASS, PASS-WITH-DEFERRED-1}.
// We propagate that exit code verbatim.
// ----------------------------------------------------------------------------

const runAllResult = child_process.spawnSync(
  process.execPath,
  [harness, '--run-all'],
  { stdio: 'inherit' }
);

if (runAllResult.error) {
  process.stderr.write('run-self-test:run_all_spawn_failed message='
    + (runAllResult.error.message || 'unknown') + '\n');
  process.exit(1);
}

const runAllCode = (typeof runAllResult.status === 'number')
  ? runAllResult.status : 1;

if (runAllCode === 0) {
  process.stdout.write('run-self-test: dual-pass green '
    + '(--self-test 24/24 + --run-all 10/10)\n');
} else {
  process.stderr.write('run-self-test: --run-all failed (exit='
    + runAllCode + ') after --self-test green\n');
}

process.exit(runAllCode);
