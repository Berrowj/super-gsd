#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/context-bench/run-self-test.cjs
// Phase 51 self-test entry. Idempotent: each run snapshots+restores canonical
// streams (T4 anti-pollution). Operator runs
//   node super-gsd/tools/context-bench/run-self-test.cjs
// for a fast 33-assertion green (18 RESEARCH-locked semantic assertions
// covered).
//
// THIS FILE IS A THIN SHELL.
//   - It spawns `node harness.cjs --self-test` via child_process.spawnSync,
//     streams stdout/stderr through, and propagates the exit code.
//   - It introduces NO new aggregator, NO new oracle, NO new assertion. The
//     falsifier in the plan rejects any addition. The single allowed job is
//     to give operators a one-line invocation that is shorter than the
//     full harness path.
//
// EXIT CODE
//   - 0 -> harness self-test green (33/33 PASS).
//   - 1 -> harness self-test reports any FAIL.
//   - any non-zero -> propagated verbatim from the harness child.
//
// ASCII-ONLY.
// =============================================================================

'use strict';

const child_process = require('child_process');
const path = require('path');

const harness = path.join(__dirname, 'harness.cjs');

const result = child_process.spawnSync(
  process.execPath,
  [harness, '--self-test'],
  { stdio: 'inherit' }
);

if (result.error) {
  // Lock 13: never throw upward. The operator entry must surface the
  // failure as a stderr line + non-zero exit so milestone-close gates
  // and CI pipelines see a clean signal.
  process.stderr.write('run-self-test:spawn_failed message='
    + (result.error.message || 'unknown') + '\n');
  process.exit(1);
}

// Propagate the harness exit code verbatim (0 green, 1 fail, 2 unknown
// args, 3 gate_internal_error). spawnSync may yield null on signal; map
// that to 1 so we never accidentally exit 0 on a killed child.
const code = (typeof result.status === 'number') ? result.status : 1;
process.exit(code);
