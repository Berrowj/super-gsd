#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/release-readiness/run-self-test.cjs
// Phase 57-01 self-test entry. Operator-friendly shell that delegates to
// score.cjs --self-test via spawnSync.
//
// THIS FILE IS A THIN SHELL.
//   - It spawns `node score.cjs --self-test` via child_process.spawnSync,
//     streams stdout/stderr through, and propagates the exit code.
//   - It introduces NO new aggregator, NO new oracle, NO new assertion
//     beyond what score.cjs ships.
//
// EXIT CODE
//   - 0 -> score.cjs --self-test all-PASS (12-15/12-15 green).
//   - 1 -> any FAIL in the self-test bootstrap suite.
//   - any other non-zero -> propagated verbatim.
//
// ASCII-ONLY.
// =============================================================================

'use strict';

const child_process = require('child_process');
const path = require('path');

const score = path.join(__dirname, 'score.cjs');

const result = child_process.spawnSync(
  process.execPath,
  [score, '--self-test'],
  { stdio: 'inherit' }
);

if (result.error) {
  process.stderr.write('run-self-test:self_test_spawn_failed message='
    + (result.error.message || 'unknown') + '\n');
  process.exit(1);
}

const code = (typeof result.status === 'number') ? result.status : 1;
process.exit(code);
