#!/usr/bin/env node
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const writer = require('./context-anchor-writer.cjs');
const composer = require('./context-composer.cjs');

const TOOL_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..', '..');
const TEMPLATE_DIR = path.join(REPO_ROOT, 'super-gsd', 'templates');
const CONTEXT_DIR = path.join(REPO_ROOT, '.planning', 'milestones', 'v3.0', 'context');
const LEDGER_PATH = path.join(REPO_ROOT, '.planning', 'mesh', 'memory', 'cmbs.jsonl');

const TEMPLATE_FILES = [
  'MILESTONE-CONTEXT.template.yaml',
  'PERSONA-MATRIX.template.yaml',
  'DOMAIN-ONTOLOGY.template.yaml',
  'LEXICON.template.yaml',
  'SOURCE-OF-TRUTH.template.yaml',
  'NON-GOALS.template.yaml'
];

const CAPSULE_FILES = [
  'MILESTONE-CONTEXT.yaml',
  'PERSONA-MATRIX.yaml',
  'DOMAIN-ONTOLOGY.yaml',
  'LEXICON.yaml',
  'SOURCE-OF-TRUTH.yaml',
  'NON-GOALS.yaml'
];

const TESTS = [];

function test(name, fn) {
  TESTS.push({ name, fn });
}

function requireDependency(name) {
  return writer.requireDependency(name);
}

function parseYaml(filePath) {
  const yaml = requireDependency('js-yaml');
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertTopLevelKeys(fileName, keys) {
  const parsed = parseYaml(path.join(TEMPLATE_DIR, fileName));
  for (const key of keys) {
    assert(Object.prototype.hasOwnProperty.call(parsed || {}, key), `${fileName} missing ${key}`);
  }
}

function runNode(args) {
  return childProcess.spawnSync(process.execPath, args, {
    cwd: REPO_ROOT,
    encoding: 'utf8'
  });
}

function countContextAnchors() {
  if (!fs.existsSync(LEDGER_PATH)) return 0;
  return fs.readFileSync(LEDGER_PATH, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .reduce((count, line) => {
      try {
        const parsed = JSON.parse(line);
        return parsed && parsed.type === 'context_anchor' ? count + 1 : count;
      } catch (_error) {
        return count;
      }
    }, 0);
}

test('all 6 templates exist', () => {
  for (const fileName of TEMPLATE_FILES) {
    assert(fs.existsSync(path.join(TEMPLATE_DIR, fileName)), `${fileName} missing`);
  }
});

test('all 6 templates parse as YAML', () => {
  for (const fileName of TEMPLATE_FILES) parseYaml(path.join(TEMPLATE_DIR, fileName));
});

test('MILESTONE-CONTEXT.template top-level keys', () => {
  assertTopLevelKeys('MILESTONE-CONTEXT.template.yaml', [
    'milestone_id',
    'title',
    'business_why',
    'primary_user_outcome',
    'entry_criteria',
    'exit_criteria',
    'personas',
    'source_of_truth',
    'non_goals',
    'operator_preferences'
  ]);
});

test('PERSONA-MATRIX.template has personas', () => {
  assertTopLevelKeys('PERSONA-MATRIX.template.yaml', ['personas']);
});

test('DOMAIN-ONTOLOGY.template has entities', () => {
  assertTopLevelKeys('DOMAIN-ONTOLOGY.template.yaml', ['entities']);
});

test('LEXICON.template has terms', () => {
  assertTopLevelKeys('LEXICON.template.yaml', ['terms']);
});

test('SOURCE-OF-TRUTH.template has data_classes', () => {
  assertTopLevelKeys('SOURCE-OF-TRUTH.template.yaml', ['data_classes']);
});

test('NON-GOALS.template has non_goals', () => {
  assertTopLevelKeys('NON-GOALS.template.yaml', ['non_goals']);
});

test('context-anchor-writer --help exits 0', () => {
  const result = runNode(['super-gsd/tools/context-authority/context-anchor-writer.cjs', '--help']);
  assert(result.status === 0, result.stderr || result.stdout);
});

test('context-composer --help exits 0', () => {
  const result = runNode(['super-gsd/tools/context-authority/context-composer.cjs', '--help']);
  assert(result.status === 0, result.stderr || result.stdout);
});

test('context-anchor-writer --self-test exits 0', () => {
  const result = runNode(['super-gsd/tools/context-authority/context-anchor-writer.cjs', '--self-test']);
  assert(result.status === 0, result.stderr || result.stdout);
});

test('context-anchor-writer --self-test-stale exits 0', () => {
  const result = runNode(['super-gsd/tools/context-authority/context-anchor-writer.cjs', '--self-test-stale']);
  assert(result.status === 0, result.stderr || result.stdout);
});

test('all 6 v3.0 capsule instances exist', () => {
  for (const fileName of CAPSULE_FILES) {
    assert(fs.existsSync(path.join(CONTEXT_DIR, fileName)), `${fileName} missing`);
  }
});

test('all 6 v3.0 capsule instances parse as YAML', () => {
  for (const fileName of CAPSULE_FILES) parseYaml(path.join(CONTEXT_DIR, fileName));
});

test('v3.0 milestone context has entry and exit criteria', () => {
  const parsed = parseYaml(path.join(CONTEXT_DIR, 'MILESTONE-CONTEXT.yaml'));
  for (const key of ['entry_criteria', 'exit_criteria']) {
    assert(Array.isArray(parsed[key]) && parsed[key].length > 0,
      `MILESTONE-CONTEXT.yaml missing non-empty ${key}`
    );
  }
});

test('context-composer --self-test emits 6 anchors', () => {
  const result = runNode(['super-gsd/tools/context-authority/context-composer.cjs', '--self-test']);
  assert(result.status === 0, result.stderr || result.stdout);
  assert(result.stderr.includes('emitted=6'), result.stderr || result.stdout);
});

test('mesh ledger has at least 6 context_anchor CMBs', () => {
  assert(countContextAnchors() >= 6, 'mesh ledger has fewer than 6 context_anchor CMBs');
});

function main() {
  let passed = 0;
  const failures = [];

  for (const item of TESTS) {
    try {
      item.fn();
      passed += 1;
    } catch (error) {
      failures.push(`${item.name}: ${error.message}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) console.error(`[context-authority self-test] FAIL ${failure}`);
    console.error(`[context-authority self-test] ${passed}/${TESTS.length} passed`);
    process.exitCode = 1;
    return;
  }

  console.log(`[context-authority self-test] ${passed}/${TESTS.length} passed`);
}

main();
