#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/installer-audit/run-self-test.cjs
// Phase 58-01 self-test entry. Operator-friendly shell that delegates to
// audit.cjs --self-test via spawnSync.
//
// THIS FILE IS A THIN SHELL.
//   - It spawns `node audit.cjs --self-test` via child_process.spawnSync,
//     streams stdout/stderr through, and propagates the exit code.
//   - It introduces NO new aggregator, NO new oracle, NO new assertion
//     beyond what audit.cjs ships.
//
// EXIT CODE
//   - 0 -> audit.cjs --self-test all-PASS (8-12/8-12 green).
//   - 1 -> any FAIL in the self-test bootstrap suite.
//   - any other non-zero -> propagated verbatim.
//
// ASCII-ONLY.
// =============================================================================

'use strict';

var child_process = require('child_process');
var path = require('path');

var auditPath = path.join(__dirname, 'audit.cjs');

var result = child_process.spawnSync(
  process.execPath,
  [auditPath, '--self-test'],
  { stdio: 'inherit' }
);

if (result.error) {
  process.stderr.write('run-self-test:self_test_spawn_failed message='
    + (result.error.message || 'unknown') + '\n');
  process.exit(1);
}

var code = (typeof result.status === 'number') ? result.status : 1;
process.exit(code);
