'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadRouting, resolveModel } = require('../../scripts/lib/model-routing.cjs');

const config = loadRouting(path.resolve(__dirname, '../../config/model-routing.json'));

test('orchestrator defaults to Fable', () => {
  const result = resolveModel({ config, role: 'orchestrator' });
  assert.equal(result.id, 'fable');
  assert.equal(result.source, 'default');
});

test('explicit role override can select Astral', () => {
  const result = resolveModel({ config, role: 'execution.executor', override: 'astral' });
  assert.equal(result.id, 'astral');
  assert.equal(result.provider, 'openai');
});

test('classifier output takes precedence when allowed', () => {
  const result = resolveModel({ config, role: 'execution.executor', classifierModel: 'astral' });
  assert.equal(result.id, 'astral');
  assert.equal(result.source, 'classifier');
});

test('unknown or disallowed models fail closed', () => {
  assert.throws(() => resolveModel({ config, role: 'execution.executor', override: 'unknown' }), /not allowed/);
  assert.throws(() => resolveModel({ config, role: 'execution.executor', override: 'nope' }), /not allowed/);
});
