'use strict';

/**
 * Providers registry singleton — loads review-providers.yaml AND the
 * .planning/config.json `review_providers` block once, caches both.
 *
 * Sibling to gates-registry.cjs (NOT an extension — P1 deviation per
 * Plan 14-02 / RESEARCH §3 R-3). Separation of concerns: gates-registry
 * is scoped to gates.yaml; this module owns review-providers.yaml plus
 * the config-level review_providers block.
 *
 * Exports:
 *   loadProviders(yamlPath)              — parse + cache; O(1) on subsequent calls
 *   getProvider(name, yamlPath)          — O(1) lookup; hard-error on unknown (D-06a)
 *   loadReviewProvidersConfig(cfgPath)   — reads .planning/config.json review_providers
 *   resolveReviewerProvider(gateName, gatesRegistry, yamlPaths)
 *     — bridge: resolves a gate's reviewer_provider field via gates-registry,
 *       falls back to config.default_provider, returns provider record or null
 *       if the gate is not reviewer-shaped (no reviewer_provider field).
 *   resetCache()                         — test-only: clear both caches
 *
 * js-yaml is loaded via the pinned install at
 * super-gsd/tools/plan-schema/node_modules/js-yaml (same pattern as
 * gates-registry.cjs:41-44 — do NOT install a second copy).
 */

const fs   = require('fs');
const path = require('path');

/**
 * WARNING — module-level caches are PROCESS SINGLETONS.
 * Tests MUST call resetCache() in afterEach() to avoid pollution.
 * Long-running processes that hot-swap review-providers.yaml or
 * .planning/config.json MUST call resetCache() after the file mtime
 * changes (or after a SIGHUP equivalent).
 */
let _cache = null;        // { all: Provider[], byName: Record<string,Provider> }
let _configCache = null;  // review_providers block object (or defaults)

const DEFAULT_YAML_PATH = path.resolve(
  __dirname, '..', '..', 'registry', 'review-providers.yaml'
);
const DEFAULT_CONFIG_PATH = path.resolve(
  __dirname, '..', '..', '..', '.planning', 'config.json'
);

const DEFAULT_CONFIG = {
  default_provider: 'codex-cli-reviewer',
  codex_enabled: true,
  codex_cli_path: 'auto-detect',
  codex_timeout_seconds: 30,
  fallback_on_error: false,
  fallback_max_retries: 0,
};

function _requireYaml() {
  const yamlLibPath = path.resolve(
    __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
  );
  return require(yamlLibPath);
}

/**
 * Load and cache the providers registry from the given YAML file.
 * Returns the cached object on subsequent calls (cache-once).
 *
 * @param {string} [yamlPath] - absolute or relative path to review-providers.yaml
 * @returns {{ all: Object[], byName: Record<string,Object> }}
 */
function loadProviders(yamlPath = DEFAULT_YAML_PATH) {
  if (_cache) return _cache;

  const yaml = _requireYaml();
  const raw = fs.readFileSync(yamlPath, 'utf8');
  const parsed = yaml.load(raw);

  const all = (parsed && Array.isArray(parsed.providers)) ? parsed.providers : [];
  const byName = {};
  for (const p of all) byName[p.name] = p;

  _cache = { all, byName };
  return _cache;
}

/**
 * Retrieve a single provider row by name.
 * Throws if the name is not present in the registry (D-06a: cold-start
 * typo-catch; unknown provider is a hard error).
 *
 * @param {string} name
 * @param {string} [yamlPath]
 * @returns {Object}
 */
function getProvider(name, yamlPath = DEFAULT_YAML_PATH) {
  const reg = loadProviders(yamlPath);
  const p = reg.byName[name];
  if (!p) throw new Error(`unknown provider '${name}' not in review-providers registry`);
  return p;
}

/**
 * Load the review_providers block from .planning/config.json.
 * Caches the parsed block on first call. If the block is missing or the
 * config file is unreadable, warns to stderr and returns DEFAULT_CONFIG —
 * Phase 14 must ship functional even if the config patch hasn't landed.
 *
 * @param {string} [configPath]
 * @returns {Object}
 */
function loadReviewProvidersConfig(configPath = DEFAULT_CONFIG_PATH) {
  if (_configCache) return _configCache;

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.review_providers === 'object' && parsed.review_providers !== null) {
      _configCache = Object.assign({}, DEFAULT_CONFIG, parsed.review_providers);
      return _configCache;
    }
    process.stderr.write(
      `[providers-registry] warning: config.review_providers block missing at ${configPath}; using defaults\n`
    );
  } catch (e) {
    process.stderr.write(
      `[providers-registry] warning: cannot read ${configPath} (${e.code || e.message}); using defaults\n`
    );
  }

  _configCache = Object.assign({}, DEFAULT_CONFIG);
  return _configCache;
}

/**
 * Resolve the reviewer provider for a gate.
 *
 * 1. Look up the gate row via gatesRegistry.getGate(gateName).
 * 2. If the gate has no `reviewer_provider` field at all, return null
 *    (gate is not reviewer-shaped — e.g. process-hygiene gates).
 * 3. If the gate declares `reviewer_provider: <name>`, resolve that.
 * 4. Otherwise fall back to config.review_providers.default_provider.
 *
 * Unknown provider names bubble up as hard errors from getProvider().
 *
 * @param {string} gateName
 * @param {Object} gatesRegistry - module or object exposing getGate(name, path)
 * @param {{ yamlPath?: string, configPath?: string, gatesYamlPath?: string }} [opts]
 * @returns {Object|null}
 */
function resolveReviewerProvider(gateName, gatesRegistry, opts = {}) {
  const gate = gatesRegistry.getGate(gateName, opts.gatesYamlPath);
  // Narrowed predicate: gate is reviewer-shaped only if it explicitly declares
  // reviewer_provider. Fixes 14-ATC-REVIEW W-1 — haiku-agent gates lack
  // reviewer_provider and are NOT code-reviewer-shaped.
  // VTP: AGP-P-08 — shape detection belongs to the registry, not the caller.
  if (!gate || !gate.reviewer_provider) return null;

  const name = gate.reviewer_provider;
  return getProvider(name, opts.yamlPath);
}

/**
 * Clear both in-memory caches. Test-only helper.
 */
function resetCache() {
  _cache = null;
  _configCache = null;
}

module.exports = {
  loadProviders,
  getProvider,
  loadReviewProvidersConfig,
  resolveReviewerProvider,
  resetCache,
};
