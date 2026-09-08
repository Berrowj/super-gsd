'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadRouting, resolveModel } = require('../../scripts/lib/model-routing.cjs');

test('distributed routing config and fresh-project overlay keep Fable and Astral switches without replacing operator choices', () => {
  const distributed = loadRouting(path.resolve(__dirname, '../../config/model-routing.json'));
  const projectDefaults = loadRouting(path.resolve(__dirname, '../../config/planning-config-overlay.json'));
  const operatorConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../.planning/config.json'), 'utf8'));
  assert.equal(resolveModel({ config: distributed, role: 'orchestrator' }).id, 'fable');
  assert.equal(resolveModel({ config: projectDefaults, role: 'orchestrator' }).id, 'fable');
  assert.equal(resolveModel({ config: projectDefaults, role: 'execution.executor', override: 'astral' }).id, 'astral');
  assert.equal(operatorConfig.workflow.mode, 'yolo');
  assert.equal(operatorConfig.model_routing.orchestrator, 'opus');
  assert.ok(fs.existsSync(path.resolve(__dirname, '../../config/model-routing.json')));
});
