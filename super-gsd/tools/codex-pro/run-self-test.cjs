#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

function requireDependency(name) {
  const candidates = [
    path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
    path.resolve(__dirname, 'node_modules', name),
    name,
  ];

  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }

  throw new Error(`Unable to require ${name}. Tried:\n${failures.join('\n')}`);
}

const yaml = requireDependency('js-yaml');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PROFILE_RESOLVER = path.resolve(__dirname, 'profile-resolver.cjs');
const STOPLIGHT = path.resolve(__dirname, 'stoplight.cjs');
const NATIVE_REVIEW_RUNNER = path.resolve(__dirname, 'native-review-runner.cjs');
const REGISTRY_PATH = path.resolve(__dirname, '..', '..', 'registry', 'codex-profiles.yaml');
const STOPLIGHT_LEDGER = path.resolve(REPO_ROOT, '.planning', 'metrics', 'pro-mode-stoplight.jsonl');
const CMB_LEDGER = path.resolve(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');

const REQUIRED_PROFILE_FIELDS = [
  'model',
  'reasoning',
  'sandbox',
  'approval',
  'requires_worktree',
  'requires_locked_plan',
  'hooks_required',
  'native_review_required',
  'allowed_write_roots',
  'max_changed_files',
];

function runNode(script, args) {
  return childProcess.spawnSync(process.execPath, [script, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function countJsonlRows(filePath, predicate) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (_error) {
        return null;
      }
    })
    .filter((row) => row && (!predicate || predicate(row)))
    .length;
}

function loadProfiles() {
  const parsed = yaml.load(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  if (!parsed || !parsed.profiles) {
    throw new Error('codex-profiles.yaml missing profiles root');
  }
  return parsed.profiles;
}

function main() {
  const assertions = [];
  const pass = (name, fn) => assertions.push({ name, fn });

  pass('profile-resolver --help exit 0', () => runNode(PROFILE_RESOLVER, ['--help']).status === 0);
  pass('stoplight --help exit 0', () => runNode(STOPLIGHT, ['--help']).status === 0);
  pass('native-review-runner --help exit 0', () => runNode(NATIVE_REVIEW_RUNNER, ['--help']).status === 0);
  pass('profile-resolver --self-test-plan exit 0', () => runNode(PROFILE_RESOLVER, ['--self-test-plan']).status === 0);
  pass('profile-resolver --self-test-bounded exit 0', () => runNode(PROFILE_RESOLVER, ['--self-test-bounded']).status === 0);
  pass('profile-resolver --self-test-audit exit 0', () => runNode(PROFILE_RESOLVER, ['--self-test-audit']).status === 0);
  pass('profile-resolver --list outputs at least 10 profile names', () => {
    const result = runNode(PROFILE_RESOLVER, ['--list']);
    return result.status === 0 && result.stdout.split(/\r?\n/).filter((line) => line.trim()).length >= 10;
  });
  pass('codex-profiles.yaml parses and contains exactly 10 profiles', () => Object.keys(loadProfiles()).length === 10);
  pass('every profile has required fields', () => {
    const profiles = loadProfiles();
    return Object.values(profiles).every((profile) => REQUIRED_PROFILE_FIELDS.every((field) => Object.prototype.hasOwnProperty.call(profile, field)));
  });
  pass('stoplight --self-test-green exit 0', () => runNode(STOPLIGHT, ['--self-test-green']).status === 0);
  pass('stoplight --self-test-red exit 0', () => runNode(STOPLIGHT, ['--self-test-red']).status === 0);
  pass('stoplight --self-test-amber exit 0', () => runNode(STOPLIGHT, ['--self-test-amber']).status === 0);
  pass('stoplight JSONL ledger exists with at least 3 rows', () => fs.existsSync(STOPLIGHT_LEDGER) && countJsonlRows(STOPLIGHT_LEDGER) >= 3);
  pass('native-review-runner --self-test exit 0', () => runNode(NATIVE_REVIEW_RUNNER, ['--self-test', '--phase', '110', '--executor-receipt', 'cmb-fixture-execution-receipt']).status === 0);
  pass('mesh-memory ledger has at least 2 Codex native review findings', () => countJsonlRows(CMB_LEDGER, (row) => (
    row.type === 'review_finding'
    && row.role === 'reviewer'
    && typeof row.created_by === 'string'
    && row.created_by.includes('codex-review-native')
  )) >= 2);

  let passed = 0;
  const failures = [];

  for (const assertion of assertions) {
    try {
      if (assertion.fn()) {
        passed += 1;
      } else {
        failures.push(assertion.name);
      }
    } catch (error) {
      failures.push(`${assertion.name}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`[codex-pro self-test] ${passed}/${assertions.length} passed\n`);
    for (const failure of failures) {
      process.stderr.write(`FAIL: ${failure}\n`);
    }
    return 1;
  }

  process.stdout.write(`[codex-pro self-test] ${passed}/${assertions.length} passed\n`);
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}
