#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/chaos-restart/run-self-test.cjs
// Phase 54 self-test entry. Idempotent: 18-assertion run + 5-scenario --run-all
// check via separate spawn. Operator runs
//   node super-gsd/tools/chaos-restart/run-self-test.cjs
// for fast green.
//
// THIS FILE IS A THIN SHELL.
//   - It spawns `node harness.cjs --self-test` via child_process.spawnSync,
//     streams stdout/stderr through, propagates the exit code, then (when
//     --self-test green) spawns a SECOND child for `node harness.cjs --run-all`
//     and reports dual-pass status.
//   - It introduces NO new aggregator, NO new oracle, NO new assertion.
//
// TWO-PHASE EXECUTION
//   Phase 1: --self-test  -> 18 assertions; sub-30s; READ-ONLY (uses --no-log
//                            inside the run-all-during-self-test path).
//   Phase 2: --run-all    -> 5 scenarios end-to-end; appends one envelope-v1
//                            witness row to chaos-restart-log.jsonl;
//                            PASS verdict required.
//
// INTEGRATION
//   The Phase 54 self-test stands on its own. The wrapper
//     node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0
//   runs the Phase 51 context-bench (33/33), Phase 52 redis-adapter (26/26),
//   Phase 53 failure-injection self-test (24/24) + --run-all (10/10), AND
//   Phase 54 chaos-restart self-test (18/18) as a quad-gate before allowing
//   v2.0 milestone close.
//
// EXIT CODE
//   - 0 -> harness self-test 18/18 PASS AND --run-all 5/5 PASS (dual green).
//   - 1 -> harness self-test reports any FAIL (--run-all skipped).
//   - 1 -> --run-all exits non-zero after self-test green.
//
// ASCII-ONLY.
// =============================================================================

'use strict';

const child_process = require('child_process');
const path = require('path');

const harness = path.join(__dirname, 'harness.cjs');

// ----------------------------------------------------------------------------
// Phase 1: --self-test (18 assertions).
// ----------------------------------------------------------------------------
const selfTestResult = child_process.spawnSync(
  process.execPath,
  [harness, '--self-test'],
  { stdio: 'inherit' }
);

if (selfTestResult.error) {
  process.stderr.write('run-self-test:self_test_spawn_failed message=' +
    (selfTestResult.error.message || 'unknown') + '\n');
  process.exit(1);
}

const selfTestCode = (typeof selfTestResult.status === 'number')
  ? selfTestResult.status : 1;

if (selfTestCode !== 0) {
  process.stderr.write('run-self-test: bootstrap --self-test failed (exit=' +
    selfTestCode + '); skipping --run-all\n');
  process.exit(selfTestCode);
}

// ----------------------------------------------------------------------------
// Phase 2: --run-all (5 scenarios). Bootstrap green, exercise full driver.
// ----------------------------------------------------------------------------
const runAllResult = child_process.spawnSync(
  process.execPath,
  [harness, '--run-all'],
  { stdio: 'inherit' }
);

if (runAllResult.error) {
  process.stderr.write('run-self-test:run_all_spawn_failed message=' +
    (runAllResult.error.message || 'unknown') + '\n');
  process.exit(1);
}

const runAllCode = (typeof runAllResult.status === 'number')
  ? runAllResult.status : 1;

if (runAllCode === 0) {
  process.stdout.write('run-self-test: dual-pass green ' +
    '(--self-test 18/18 + --run-all 5/5)\n');
} else {
  process.stderr.write('run-self-test: --run-all failed (exit=' +
    runAllCode + ') after --self-test green\n');
}

process.exit(runAllCode);
