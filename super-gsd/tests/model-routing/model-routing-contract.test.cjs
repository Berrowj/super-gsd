'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadRouting, validateRouting } = require('../../scripts/lib/model-routing.cjs');

const file = path.resolve(__dirname, '../../config/model-routing.json');

test('routing catalog includes Fable, Astral, Opus, and Codex', () => {
  const config = require(file);
  validateRouting(config);
  assert.deepEqual(Object.keys(config.models).sort(), ['astral', 'codex', 'fable', 'opus']);
  assert.equal(config.model_routing.orchestrator.default, 'fable');
});

test('every declared role has an independently switchable allowlist', () => {
  const routing = loadRouting(file);
  const roles = routing.model_routing;
  function visit(node, prefix = '') {
    for (const [role, cfg] of Object.entries(node)) {
      if (role === 'schema_version' || role === 'models') continue;
      const name = prefix ? `${prefix}.${role}` : role;
      if (cfg && typeof cfg === 'object' && !cfg.default && !cfg.allowed && !Array.isArray(cfg)) visit(cfg, name);
      else {
        assert.ok(cfg.default, `${name} default missing`);
        assert.ok(cfg.allowed.includes('astral'), `${name} Astral switch missing`);
      }
    }
  }
  visit(roles);
});

test('invalid defaults and allowlists are rejected', () => {
  assert.throws(() => validateRouting({ models: { fable: {} }, model_routing: { orchestrator: { default: 'nope', allowed: ['fable'] } } }), /not in model catalog/);
  assert.throws(() => validateRouting({ models: { fable: {} }, model_routing: { orchestrator: { default: 'fable', allowed: ['astral'] } } }), /not in model catalog/);
});
