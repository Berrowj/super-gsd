#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/warp-mcp/run-self-test.cjs
// Phase 69-01 self-test entry. Operator-friendly shell that delegates to
// server.cjs --self-test via spawnSync.
//
// THIS FILE IS A THIN SHELL.
//   - It spawns `node server.cjs --self-test` via child_process.spawnSync,
//     streams stdout/stderr through, and propagates the exit code.
//   - It introduces NO new aggregator, NO new oracle, NO new assertion
//     beyond what server.cjs ships.
//
// EXIT CODE
//   - 0 -> server.cjs --self-test all-PASS (12+/12+ green).
//   - 1 -> any FAIL in the self-test bootstrap suite.
//   - any other non-zero -> propagated verbatim.
//
// ASCII-ONLY.
// =============================================================================

'use strict';

var child_process = require('child_process');
var path = require('path');

var checkPath = path.join(__dirname, 'server.cjs');

var result = child_process.spawnSync(
  process.execPath,
  [checkPath, '--self-test'],
  { stdio: 'inherit' }
);

if (result.error) {
  process.stderr.write('run-self-test:self_test_spawn_failed message='
    + (result.error.message || 'unknown') + '\n');
  process.exit(1);
}

var code = (typeof result.status === 'number') ? result.status : 1;
process.exit(code);
