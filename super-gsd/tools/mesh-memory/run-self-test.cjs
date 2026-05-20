#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { validateCmb, ROOT_DIR } = require('./cmb-validate.cjs');

const NODE = process.execPath;
const TOOL_DIR = __dirname;
const LEDGER_PATH = path.resolve(ROOT_DIR, '.planning', 'mesh', 'memory', 'cmbs.jsonl');

const checks = [];

function tool(name) {
  return path.join(TOOL_DIR, name);
}

function fixture(name) {
  return path.join(TOOL_DIR, 'fixtures', name);
}

function runNode(args) {
  return spawnSync(NODE, args, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });
}

function check(name, fn) {
  checks.push({ name, fn });
}

function summarize(result) {
  return [
    `status=${result.status}`,
    `stdout=${JSON.stringify((result.stdout || '').trim())}`,
    `stderr=${JSON.stringify((result.stderr || '').trim())}`,
  ].join(' ');
}

check('cmb-validate.cjs --help exits 0', () => {
  const result = runNode([tool('cmb-validate.cjs'), '--help']);
  return result.status === 0 || summarize(result);
});

check('cmb-hash.cjs --help exits 0', () => {
  const result = runNode([tool('cmb-hash.cjs'), '--help']);
  return result.status === 0 || summarize(result);
});

[
  'good-execution-receipt.json',
  'good-review-finding.json',
  'good-evidence-verdict.json',
  'good-decision-recommendation.json',
  'good-operator-precedent.json',
  'good-context-anchor.json',
  'good-promotion-decision.json',
].forEach((name) => {
  check(`cmb-validate.cjs validates ${name}`, () => {
    const result = runNode([tool('cmb-validate.cjs'), fixture(name)]);
    return result.status === 0 || summarize(result);
  });
});

check('cmb-validate.cjs rejects bad-claim-as-observation.json', () => {
  const result = runNode([tool('cmb-validate.cjs'), fixture('bad-claim-as-observation.json')]);
  return result.status !== 0 || summarize(result);
});

check('cmb-validate.cjs rejects bad-execution-receipt-created-by-agent.json with SCHEMA-MML-02', () => {
  const result = runNode([tool('cmb-validate.cjs'), fixture('bad-execution-receipt-created-by-agent.json')]);
  return (result.status !== 0 && result.stderr.includes('SCHEMA-MML-02')) || summarize(result);
});

check('cmb-validate.cjs rejects bad-cmb-missing-cat7.json with SCHEMA-MML-03', () => {
  const result = runNode([tool('cmb-validate.cjs'), fixture('bad-cmb-missing-cat7.json')]);
  return (result.status !== 0 && result.stderr.includes('SCHEMA-MML-03')) || summarize(result);
});

[
  'bad-context-anchor-without-source.json',
  'bad-review-finding-without-lineage.json',
  'bad-cmb-missing-type.json',
].forEach((name) => {
  check(`cmb-validate.cjs rejects ${name}`, () => {
    const result = runNode([tool('cmb-validate.cjs'), fixture(name)]);
    return result.status !== 0 || summarize(result);
  });
});

check('cmb-hash.cjs compare ignores created_at changes', () => {
  const result = runNode([
    tool('cmb-hash.cjs'),
    '--compare',
    fixture('hash-a.json'),
    fixture('hash-a-created-at-changed.json'),
  ]);
  return (result.status === 0 && result.stdout.trim() === 'same') || summarize(result);
});

check('cmb-hash.cjs compare detects body changes', () => {
  const result = runNode([
    tool('cmb-hash.cjs'),
    '--compare',
    fixture('hash-a.json'),
    fixture('hash-a-body-changed.json'),
  ]);
  return (result.status === 0 && result.stdout.trim() === 'different') || summarize(result);
});

check('execution-receipt.cjs --self-test exits 0', () => {
  const result = runNode([tool('execution-receipt.cjs'), '--self-test']);
  return result.status === 0 || summarize(result);
});

check('review-finding-writer.cjs --self-test exits 0', () => {
  const result = runNode([tool('review-finding-writer.cjs'), '--self-test']);
  return result.status === 0 || summarize(result);
});

check('ledger exists and contains at least 2 valid CMB rows', () => {
  if (!fs.existsSync(LEDGER_PATH)) {
    return `${LEDGER_PATH} does not exist`;
  }
  const rows = fs
    .readFileSync(LEDGER_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const validRows = rows.filter((row) => validateCmb(row).valid);
  return validRows.length >= 2 || `validRows=${validRows.length} totalRows=${rows.length}`;
});

function main() {
  let passed = 0;
  const failures = [];

  for (const item of checks) {
    try {
      const result = item.fn();
      if (result === true) {
        passed += 1;
      } else {
        failures.push(`${item.name}: ${result}`);
      }
    } catch (error) {
      failures.push(`${item.name}: ${error.stack || error.message}`);
    }
  }

  if (failures.length > 0) {
    console.error(`[run-self-test] ${passed}/${checks.length} passed`);
    failures.forEach((failure) => console.error(`[run-self-test] FAIL ${failure}`));
    return 1;
  }

  console.error(`[run-self-test] ${passed}/${checks.length} passed`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}
