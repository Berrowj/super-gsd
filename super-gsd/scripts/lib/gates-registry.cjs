'use strict';

/**
 * Gates registry singleton — loads gates.yaml once and caches it.
 *
 * Exports: { loadGates, getGate, shouldFire, resetCache }
 *
 * loadGates(yamlPath)         — parse + cache; O(1) on subsequent calls
 * getGate(name, yamlPath)     — return row; throw if absent
 * shouldFire(name, ctx, path) — false when enforcement_mode==='disabled';
 *                               otherwise delegates to evalPredicate(trigger||[], ctx)
 * resetCache()                — test-only: clear the in-memory cache
 *
 * js-yaml is loaded via the pinned install at
 * super-gsd/tools/plan-schema/node_modules/js-yaml (same pattern as
 * validate.cjs:133-151 and 09-verify.mjs:12).
 */

const fs   = require('fs');
const path = require('path');
const { evalPredicate } = require('./predicate-eval.cjs');

let _cache = null; // { all: Gate[], byName: Record<string,Gate> }

/**
 * Load and cache the gates registry from the given YAML file.
 * Returns the cached object on subsequent calls (cache-once).
 *
 * @param {string} gatesYamlPath - absolute or relative path to gates.yaml
 * @returns {{ all: Object[], byName: Record<string,Object> }}
 */
function loadGates(gatesYamlPath) {
  if (_cache) return _cache;

  const yamlLibPath = path.resolve(
    __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
  );
  const yaml = require(yamlLibPath);

  const raw = fs.readFileSync(gatesYamlPath, 'utf8');
  const parsed = yaml.load(raw);

  const all = (parsed && Array.isArray(parsed.gates)) ? parsed.gates : [];
  const byName = {};
  for (const g of all) byName[g.name] = g;

  _cache = { all, byName };
  return _cache;
}

/**
 * Retrieve a single gate row by name.
 * Throws if the name is not present in the registry.
 *
 * @param {string} name
 * @param {string} gatesYamlPath
 * @returns {Object}
 */
function getGate(name, gatesYamlPath) {
  const reg = loadGates(gatesYamlPath);
  const g = reg.byName[name];
  if (!g) throw new Error(`gate '${name}' not in registry`);
  return g;
}

/**
 * Determine whether a gate should fire for the given dispatch context.
 *
 * Returns false when enforcement_mode === 'disabled' (kill-switch).
 * Otherwise delegates to evalPredicate(gate.trigger||[], ctx).
 *
 * @param {string} name
 * @param {Object} ctx - dispatch context (see predicate-eval.cjs JSDoc for fields)
 * @param {string} gatesYamlPath
 * @returns {boolean}
 */
function shouldFire(name, ctx, gatesYamlPath) {
  const g = getGate(name, gatesYamlPath);
  if (g.enforcement_mode === 'disabled') return false;
  return evalPredicate(g.trigger || [], ctx);
}

/**
 * Clear the in-memory cache. Test-only helper.
 */
function resetCache() {
  _cache = null;
}

module.exports = { loadGates, getGate, shouldFire, resetCache };
