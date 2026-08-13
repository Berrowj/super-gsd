#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const classifier = require('../../hooks/sgsd-intent-classifier.cjs');

const registry = classifier.parseRegistryYaml(
  fs.readFileSync(classifier.REGISTRY_SOURCE_PATH, 'utf8'),
);
const route = registry.routes.find((candidate) => candidate.id === 'kb-lookup-triage');
assert.ok(route, 'kb-lookup-triage shadow route must exist');

const payload = { hook_event_name: 'UserPromptSubmit', mode: 'manual' };
assert.strictEqual(
  classifier.matchesShadowRoute(
    route,
    'what did ada say about fixing the customs flow',
    null,
    payload,
  ),
  true,
  'strong KB positive must match even when the prompt mentions fixing work',
);
assert.strictEqual(
  classifier.matchesShadowRoute(
    route,
    'fix - what did ada say about the last meeting',
    null,
    payload,
  ),
  true,
  'a strong KB positive must override a start-anchored verb exclusion',
);
assert.strictEqual(
  classifier.matchesShadowRoute(route, 'fix the meeting notes', null, payload),
  false,
  'a start-anchored verb must suppress a weak KB positive',
);
assert.strictEqual(
  classifier.matchesShadowRoute(route, 'fix the failing test', null, payload),
  false,
  'a start-verb exclusion without a KB positive must not match',
);
assert.strictEqual(
  classifier.matchesShadowRoute(route, 'last meeting with Ada Lovelace', null, payload),
  true,
  'a strong KB phrase must match',
);
assert.strictEqual(
  classifier.matchesShadowRoute(route, 'build the auth module', null, payload),
  false,
  'a pure build imperative must not match',
);
assert.strictEqual(
  classifier.matchesShadowRoute(route, 'import the last meeting i had with ada', null, payload),
  true,
  'a strong import signature must match',
);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-kb-triage-shadow-'));
fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
const prompt = 'what did ada say about fixing the customs flow';
const serializationDelayMs = 30;
let stdout = '';
const originalWrite = process.stdout.write;
const originalReadFileSync = fs.readFileSync;
const originalStringify = JSON.stringify;
let governanceReads = 0;
try {
  process.stdout.write = (chunk) => {
    stdout += String(chunk);
    return true;
  };
  fs.readFileSync = (...args) => {
    if (path.resolve(String(args[0])) === path.resolve(classifier.REGISTRY_SOURCE_PATH)) {
      governanceReads += 1;
    }
    return Reflect.apply(originalReadFileSync, fs, args);
  };
  JSON.stringify = (...args) => {
    const value = args[0];
    if (value && value.matcher_version === classifier.KB_TRIAGE_MATCHER_VERSION) {
      const until = Date.now() + serializationDelayMs;
      while (Date.now() < until) {
        // Make serialization cost measurable so latency coverage is deterministic.
      }
    }
    return Reflect.apply(originalStringify, JSON, args);
  };
  classifier.emitClassification(root, { ...payload, cwd: root, prompt }, {
    recordEvidence: false,
    logDegradation: false,
  });
} finally {
  process.stdout.write = originalWrite;
  fs.readFileSync = originalReadFileSync;
  JSON.stringify = originalStringify;
}

assert.strictEqual(Buffer.byteLength(stdout, 'utf8'), 0, 'shadow evaluation must emit zero stdout bytes');
assert.strictEqual(
  governanceReads,
  1,
  'one prompt must read and parse the governance registry at most once',
);
const ledgerPath = classifier.kbTriageShadowLedgerPath(root);
assert.ok(fs.existsSync(ledgerPath), 'shadow evaluation must append a ledger row');
const rows = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).map((line) => JSON.parse(line));
assert.strictEqual(rows.length, 1, 'one matched prompt must append exactly one row');

const row = rows[0];
const expectedKeys = [
  'decision_id',
  'latency_ms',
  'matched_signature_ids',
  'matcher_version',
  'operator_label',
  'soft_path_action',
  'ts',
];
assert.deepStrictEqual(Object.keys(row).sort(), expectedKeys, 'ledger row must contain only allowed keys');
assert.strictEqual(row.operator_label, null, 'operator_label must start null');
assert.strictEqual(row.matcher_version, classifier.KB_TRIAGE_MATCHER_VERSION);
assert.deepStrictEqual(row.matched_signature_ids, ['kb-lookup-triage']);
assert.ok(
  row.latency_ms >= serializationDelayMs - 2,
  'latency_ms must include JSON serialization before the append syscall',
);

const serialized = JSON.stringify(row).toLowerCase();
assert.ok(!serialized.includes(prompt), 'ledger row must not contain the prompt');
for (const forbidden of ['ada', 'customs', 'flow']) {
  assert.ok(!serialized.includes(forbidden), `ledger row must not contain entity text: ${forbidden}`);
}

console.log('kb-triage-shadow self-test: pass');
