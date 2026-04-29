#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/scenario-suite/run-self-test.cjs
// Phase 56-01 self-test entry. Idempotent: bootstrap suite + 10-scenario
// --run-all in one operator-friendly invocation.
//
// THIS FILE IS A THIN SHELL.
//   - It spawns `node harness.cjs --self-test` via child_process.spawnSync,
//     streams stdout/stderr through, propagates the exit code, then (when
//     --self-test green) spawns a SECOND child for `node harness.cjs --run-all`
//     and reports dual-pass status.
//   - It introduces NO new aggregator, NO new oracle, NO new assertion
//     beyond what harness.cjs ships. The single allowed job is to give
//     operators a one-line invocation that exercises both the bootstrap
//     suite (--self-test, ~21 assertions) AND the full driver path
//     (--run-all, 10 scenarios) in a single run.
//
// TWO-PHASE EXECUTION
//   Phase 1: --self-test  -> ~21 assertions; sub-30s; READ-ONLY (does not
//                            touch live .planning/metrics/* canonical streams).
//   Phase 2: --run-all    -> 10 scenarios end-to-end; appends one envelope-v1
//                            witness row to scenario-suite-log.jsonl per
//                            scenario; PASS verdict required.
//
// INTEGRATION
//   The Phase 56 self-test stands on its own. The wrapper
//     node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0
//   runs Phase 51-55 self-tests followed by THIS Phase 56 scenario-suite
//   self-test as the v2.0 sext-gate (6th gate).
//
// EXIT CODE
//   - 0 -> harness self-test PASS AND --run-all PASS (dual green).
//   - 1 -> harness self-test reports any FAIL (--run-all skipped).
//   - 1 -> --run-all exits non-zero after self-test green.
//   - any other non-zero -> propagated verbatim.
//
// ASCII-ONLY.
// =============================================================================

'use strict';

const child_process = require('child_process');
const path = require('path');

const harness = path.join(__dirname, 'harness.cjs');

// Phase 1: --self-test. Stream stdout/stderr through.
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
  process.stderr.write('run-self-test: bootstrap --self-test failed (exit='
    + selfTestCode + '); skipping --run-all\n');
  process.exit(selfTestCode);
}

// Phase 2: --run-all.
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
    + '(--self-test + --run-all 10/10)\n');
} else {
  process.stderr.write('run-self-test: --run-all failed (exit='
    + runAllCode + ') after --self-test green\n');
}

process.exit(runAllCode);
