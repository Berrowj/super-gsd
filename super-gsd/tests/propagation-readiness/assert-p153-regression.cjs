#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const CHECKS = Object.freeze([
  {
    name: 'registration',
    script: 'super-gsd/tests/hook-transport/assert-registration.cjs',
    args: [],
  },
  {
    name: 'block-guard-secret',
    script: 'super-gsd/tests/hook-transport/assert-block-guard.cjs',
    args: ['--case', 'secret'],
  },
  {
    name: 'block-guard-benign',
    script: 'super-gsd/tests/hook-transport/assert-block-guard.cjs',
    args: ['--case', 'benign'],
  },
  {
    name: 'block-guard-dual-surface-shared',
    script: 'super-gsd/tests/hook-transport/assert-block-guard.cjs',
    args: ['--case', 'dual-surface-shared'],
  },
  {
    name: 'kb-triage-shadow',
    script: 'super-gsd/tests/kb-triage-shadow/assert-shadow.cjs',
    args: [],
  },
]);

function runCheck(check) {
  const scriptPath = path.join(ROOT, check.script);
  const run = spawnSync(process.execPath, [scriptPath, ...check.args], {
    cwd: ROOT,
    stdio: 'inherit',
    windowsHide: true,
  });
  assert.ifError(run.error);
  assert.strictEqual(run.status, 0, `${check.name} exited ${run.status}`);
}

function main() {
  const argv = process.argv.slice(2);
  assert.deepStrictEqual(argv, ['--mode', 'executor'],
    'usage: assert-p153-regression.cjs --mode executor');
  for (const check of CHECKS) runCheck(check);
  console.log(`P153 executor regression PASS checks=${CHECKS.length}`);
}

try {
  main();
} catch (error) {
  console.error(`P153 executor regression FAIL: ${error.message}`);
  process.exitCode = 1;
}
