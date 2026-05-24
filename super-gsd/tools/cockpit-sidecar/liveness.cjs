'use strict';

const fs = require('fs');
const path = require('path');

const YAML_MODULE_PATH = path.join(
  __dirname,
  '..',
  'plan-schema',
  'node_modules',
  'js-yaml',
);

function loadRegistry(registryPath) {
  const target = registryPath || path.join(__dirname, '..', '..', 'registry', 'cockpit-sources.yaml');
  const text = fs.readFileSync(target, 'utf8');
  const yaml = require(YAML_MODULE_PATH);
  return yaml.load(text);
}

function readStateFrontmatter(statePath) {
  try {
    const text = fs.readFileSync(statePath, 'utf8');
    if (!text.startsWith('---')) return {};
    const end = text.indexOf('\n---', 3);
    if (end === -1) return {};
    const block = text.slice(3, end);
    const out = {};
    for (const line of block.split(/\r?\n/)) {
      const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*"?([^"]*)"?$/);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch (_e) {
    return {};
  }
}

function expandPath(template, ctx) {
  return template.replace(/\{(\w+)\}/g, (_match, key) => ctx[key] || `__missing_${key}__`);
}

function statNewest(target, statFn) {
  try {
    const st = statFn(target);
    if (st.isDirectory && st.isDirectory()) {
      const entries = fs.readdirSync(target);
      let newest = 0;
      for (const entry of entries) {
        try {
          const s = statFn(path.join(target, entry));
          if (s.mtimeMs > newest) newest = s.mtimeMs;
        } catch (_e) { /* skip */ }
      }
      return newest > 0 ? newest : null;
    }
    return st.mtimeMs;
  } catch (_e) {
    return null;
  }
}

function tierFor(ageMs, source) {
  if (ageMs == null) return 'dead';
  if (ageMs <= source.cadence_ms) return 'fresh';
  if (ageMs <= source.stale_after_ms) return 'degraded';
  if (ageMs <= source.dead_after_ms) return 'stale';
  return 'dead';
}

function computeLiveness(opts) {
  const options = opts || {};
  const registry = options.registry || loadRegistry(options.registry_path);
  const now = options.now || Date.now();
  const statFn = options.statFn || fs.statSync;
  const projectRoot = options.project_root || path.join(__dirname, '..', '..', '..');
  const stateCtx = options.state || readStateFrontmatter(path.join(projectRoot, '.planning', 'STATE.md'));

  const out = {};
  for (const source of registry.sources) {
    if (source.derived) {
      out[source.id] = { tier: 'fresh', age_ms: 0, last_seen: now, excused: true };
      continue;
    }
    if (!source.write_path) {
      out[source.id] = { tier: 'dead', age_ms: null, last_seen: null, excused: false };
      continue;
    }
    const expanded = expandPath(source.write_path, stateCtx);
    if (expanded.includes('__missing_')) {
      out[source.id] = { tier: 'dead', age_ms: null, last_seen: null, excused: false };
      continue;
    }
    const target = path.isAbsolute(expanded) ? expanded : path.join(projectRoot, expanded);
    const mtimeMs = statNewest(target, statFn);
    if (mtimeMs == null) {
      out[source.id] = { tier: 'dead', age_ms: null, last_seen: null, excused: false };
      continue;
    }
    const ageMs = now - mtimeMs;
    out[source.id] = {
      tier: tierFor(ageMs, source),
      age_ms: ageMs,
      last_seen: mtimeMs,
      excused: false,
    };
  }
  return out;
}

module.exports = {
  computeLiveness,
  loadRegistry,
  tierFor,
  expandPath,
};
