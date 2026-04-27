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

/**
 * WARNING — module-level cache is a PROCESS SINGLETON.
 * Tests MUST call resetCache() in afterEach() to avoid pollution.
 * Long-running processes that hot-swap gates.yaml MUST call resetCache()
 * after the file mtime changes (or after a SIGHUP equivalent).
 */
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

  // REPAIR-01 (Phase 33): instruction-presence soft-warn FIRST so it always
  // runs even if the 4-AND check below throws (poisoned configs and missing
  // instructions are independent classes of bad state; both deserve surfaced
  // visibility on a single load attempt). Phase 33 ATC W3 ordering fix.
  const repairChecker = require('./repair-command-checker.cjs');
  const presence = repairChecker.assertEveryBlockingGateHasInstruction({ gates: all });
  if (!presence.ok) {
    console.warn(`[SGSD] gates.yaml: missing repair_instruction on blocking gate(s): ${presence.missing.join(', ')}`);
  }

  // REPAIR-03 (Phase 33): validate every repair_command at LOAD time.
  // On 4-AND violation, throw -- gates.yaml is malformed and the
  // orchestrator must NEVER start with a poisoned registry.
  const result = repairChecker.validateRepairCommands({ gates: all });
  if (!result.ok) {
    const detail = result.violations.map((v) => v.message).join('; ');
    _cache = null; // invalidate so a fix + reload is not blocked by stale cache
    throw new Error(`gates.yaml repair_command 4-AND violations: ${detail}`);
  }

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
