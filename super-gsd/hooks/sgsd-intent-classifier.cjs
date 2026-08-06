#!/usr/bin/env node
'use strict';

// ============================================================================
// SGSD UserPromptSubmit intent classifier
// ============================================================================
// Local lexical router only: no LLM, no network, no prompt blocking.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { findSgsdRoot, readState } = require('../scripts/lib/sgsd-state.cjs');
const {
  ledgerPath,
  logGateEvidence,
} = require('../scripts/lib/gate-evidence-log.cjs');

const REGISTRY_SOURCE_PATH = path.resolve(__dirname, '..', 'registry', 'session-governance-hooks.yaml');
const BENCH_SIGNAL = 'intent_classifier_bench';

function safeWarn(reason) {
  try {
    process.stderr.write(`[SGSD] sgsd-intent-classifier ${String(reason || 'degraded')}\n`);
  } catch {
    // Error reporting must never become the error path.
  }
}

function safeStdout(line) {
  try {
    if (line) process.stdout.write(line.endsWith('\n') ? line : `${line}\n`);
  } catch {
    safeWarn('stdout_write_failed');
  }
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parsePayload(raw) {
  try {
    if (!raw || !String(raw).trim()) return {};
    const parsed = JSON.parse(String(raw));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    return {};
  }
}

function rootFromPayload(payload) {
  const cwd = payload && typeof payload.cwd === 'string' && payload.cwd.trim()
    ? payload.cwd
    : process.cwd();
  return findSgsdRoot(cwd);
}

function registryPath(root) {
  try {
    if (fs.existsSync(REGISTRY_SOURCE_PATH)) return REGISTRY_SOURCE_PATH;
    if (root) {
      const local = path.resolve(root, 'super-gsd', 'registry', path.basename(REGISTRY_SOURCE_PATH));
      if (fs.existsSync(local)) return local;
    }
  } catch {
    // readRegistry reports the degraded path.
  }
  return REGISTRY_SOURCE_PATH;
}

function unquote(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    try {
      return JSON.parse(raw);
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw === 'none') return 'none';
  return raw;
}

function stripInlineComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const prev = i > 0 ? line[i - 1] : '';
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    if (ch === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    if (ch === '#' && !inSingle && !inDouble && (i === 0 || /\s/.test(prev))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseRegistryYaml(text) {
  const routes = [];
  let route = null;
  let section = null;
  let listKey = null;

  function finishRoute() {
    if (route && route.id) routes.push(route);
  }

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const withoutComment = stripInlineComment(rawLine);
    if (!withoutComment.trim()) continue;

    const indent = withoutComment.match(/^ */)[0].length;
    const line = withoutComment.trim();

    if (indent === 2 && line.startsWith('- id:')) {
      finishRoute();
      route = { id: unquote(line.slice(5)), trigger: {}, predicate: {}, enforcement: {} };
      section = null;
      listKey = null;
      continue;
    }
    if (!route) continue;

    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (kv) {
      const key = kv[1];
      const value = kv[2];
      if (indent === 4 && value === '') {
        section = key;
        if (!route[section] || typeof route[section] !== 'object') route[section] = {};
        listKey = null;
      } else if (indent === 4) {
        route[key] = unquote(value);
        section = null;
        listKey = null;
      } else if (indent === 6 && section) {
        if (value === '') {
          route[section][key] = [];
          listKey = key;
        } else {
          route[section][key] = unquote(value);
          listKey = null;
        }
      }
      continue;
    }

    if (line.startsWith('- ') && section && listKey && Array.isArray(route[section][listKey])) {
      route[section][listKey].push(unquote(line.slice(2)));
    }
  }

  finishRoute();
  return { routes };
}

function readRegistry(root) {
  try {
    const file = registryPath(root);
    return parseRegistryYaml(fs.readFileSync(file, 'utf8'));
  } catch {
    safeWarn('registry_unavailable');
    return { routes: [] };
  }
}

function promptText(payload) {
  const raw = payload ? payload.prompt : '';
  if (raw === null || raw === undefined) return '';
  return String(raw).toLowerCase();
}

function list(value) {
  return Array.isArray(value) ? value.filter((v) => typeof v === 'string' && v) : [];
}

function phraseHit(prompt, phrases) {
  return list(phrases).some((phrase) => prompt.includes(phrase.toLowerCase()));
}

function regexHit(prompt, regexes) {
  for (const pattern of list(regexes)) {
    try {
      if (new RegExp(pattern, 'i').test(prompt)) return true;
    } catch {
      safeWarn('registry_regex_invalid');
    }
  }
  return false;
}

function matchesRoute(route, prompt) {
  if (!route || !prompt.trim()) return false;
  const trigger = route.trigger || {};
  const predicate = route.predicate || {};

  if (phraseHit(prompt, predicate.exclude_phrases)) return false;
  if (regexHit(prompt, predicate.exclude_regexes)) return false;

  return phraseHit(prompt, trigger.phrases) || regexHit(prompt, trigger.regexes);
}

function matchingRoutes(registry, prompt) {
  const routes = registry && Array.isArray(registry.routes) ? registry.routes : [];
  return routes.filter((route) => matchesRoute(route, prompt));
}

function directiveLines(routes, kind) {
  const seen = new Set();
  const out = [];
  for (const route of routes) {
    const enforcement = route.enforcement || {};
    if (enforcement.kind !== kind || typeof enforcement.directive !== 'string') continue;
    if (!enforcement.directive.startsWith('/sgsd-')) continue;
    if (seen.has(enforcement.directive)) continue;
    seen.add(enforcement.directive);
    out.push(kind === 'suggestion'
      ? `SGSD skill suggestion: ${enforcement.directive}`
      : `SGSD directive: ${enforcement.directive}`);
  }
  return out;
}

function emitClassification(root, payload) {
  const prompt = promptText(payload);
  if (!prompt.trim()) return;

  const registry = readRegistry(root);
  const routes = matchingRoutes(registry, prompt);
  const mandatory = directiveLines(routes, 'directive');
  if (mandatory.length > 0) safeStdout(mandatory.join('\n'));

  try {
    const suggestions = directiveLines(routes, 'suggestion');
    if (suggestions.length > 0) safeStdout(suggestions.join('\n'));
  } catch {
    safeWarn('optional_suggestions_failed');
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (item === '--bench') {
      args.bench = true;
    } else if (item.startsWith('--')) {
      const key = item.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

function percentile95(samples) {
  if (!samples.length) return 0;
  const sorted = samples.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[idx];
}

function samePath(a, b) {
  if (!a || !b) return false;
  const left = path.normalize(a);
  const right = path.normalize(b);
  return process.platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

function recordTargetIsCanonical(root, recordArg) {
  try {
    if (!recordArg || typeof recordArg !== 'string') return false;
    const canonical = ledgerPath(root);
    if (!canonical) return false;
    const requested = path.resolve(root, recordArg);
    return samePath(requested, canonical);
  } catch {
    return false;
  }
}

function runBench(args) {
  const payload = { cwd: process.cwd(), prompt: String(args.prompt || '') };
  const root = rootFromPayload(payload);
  if (!root) return;
  if (!recordTargetIsCanonical(root, args.record)) return;

  const iterations = Math.max(1, Number.parseInt(String(args.iterations || '200'), 10) || 200);
  const registry = readRegistry(root);
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    matchingRoutes(registry, promptText(payload));
    samples.push(performance.now() - started);
  }

  const state = readState(root) || {};
  logGateEvidence(root, {
    signal: BENCH_SIGNAL,
    status: 'ok',
    reason_codes: [],
    artifacts: [{ kind: 'registry', path: registryPath(root) }],
    evidence: [],
    next_action: null,
    risk: 'low',
    duration_ms: Math.max(0, Math.round(samples.reduce((sum, n) => sum + n, 0))),
    phase: state.phase || null,
    milestone: state.milestone || null,
    iterations,
    p95_ms: Number(percentile95(samples).toFixed(3)),
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.bench) {
    runBench(args);
    return;
  }

  try {
    const payload = parsePayload(readStdin());
    const root = rootFromPayload(payload);
    if (!root) return;
    emitClassification(root, payload);
  } catch {
    safeWarn('unexpected_degraded');
  }
}

if (require.main === module) main();

module.exports = {
  BENCH_SIGNAL,
  REGISTRY_SOURCE_PATH,
  parseRegistryYaml,
  matchingRoutes,
};