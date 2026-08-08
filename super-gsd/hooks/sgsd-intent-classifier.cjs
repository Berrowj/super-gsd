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
const {
  compiledFallbackRegistry,
  DEFAULT_REGISTRY_PATH,
  loadSkillRoutingRegistry,
  toPromptGovernanceRoutes,
  VALID_MODES,
} = require('../scripts/lib/skill-routing-registry.cjs');

const SESSION_GOVERNANCE_REGISTRY_PATH = path.resolve(__dirname, '..', 'registry', 'session-governance-hooks.yaml');
const REGISTRY_SOURCE_PATH = SESSION_GOVERNANCE_REGISTRY_PATH;
const SKILL_ROUTING_REGISTRY_PATH = DEFAULT_REGISTRY_PATH;
const MALFORMED_SKILL_ROUTING_FIXTURE = path.resolve(
  __dirname,
  '..',
  'tools',
  'self-test',
  'fixtures',
  'skill-routing-malformed.yaml',
);
const BENCH_SIGNAL = 'intent_classifier_bench';
const DEGRADED_SIGNAL = 'intent_classifier_degraded';
const ROUTING_DECISION_SIGNAL = 'intent_routing_decision';
const CLASSIFIER_ENFORCEMENT_KINDS = Object.freeze(['directive', 'suggestion']);
const REPORT_ONLY_SIGNALS = Object.freeze(['missing_plan']);

function safeWarn(reason) {
  try {
    process.stderr.write(`[SGSD] sgsd-intent-classifier ${String(reason || 'degraded')}\n`);
  } catch {
    // Error reporting must never become the error path.
  }
}

function appendFailureRow(root, reason, payload, extra) {
  safeWarn(reason);
  try {
    if (!root) return false;
    const state = readState(root) || {};
    return Boolean(logGateEvidence(root, {
      signal: DEGRADED_SIGNAL,
      status: 'fail',
      reason_codes: [String(reason || 'degraded')],
      artifacts: [{ kind: 'registry', path: REGISTRY_SOURCE_PATH }],
      evidence: [],
      next_action: 'Inspect the SGSD intent classifier hook degraded path.',
      risk: 'medium',
      duration_ms: null,
      phase: state.phase || null,
      milestone: state.milestone || null,
      hook_event_name: payload && payload.hook_event_name || null,
      session_id: payload && payload.session_id || null,
      ...(extra && typeof extra === 'object' ? extra : {}),
    }));
  } catch {
    return false;
  }
}

function safeStdout(root, payload, line) {
  try {
    if (line) process.stdout.write(line.endsWith('\n') ? line : `${line}\n`);
  } catch {
    appendFailureRow(root, 'stdout_write_failed', payload);
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

function registryPath() {
  return SKILL_ROUTING_REGISTRY_PATH;
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
    if (route) routes.push(route);
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

function nonEmptyStrings(value) {
  return list(value).map((item) => item.trim()).filter(Boolean);
}

function validRegexStrings(value) {
  const out = [];
  for (const pattern of nonEmptyStrings(value)) {
    try {
      new RegExp(pattern, 'i');
      out.push(pattern);
    } catch {
      // Invalid regexes do not count as usable triggers at parse time.
    }
  }
  return out;
}

function validateRouteShape(route) {
  const reasons = [];
  const id = route && typeof route.id === 'string' ? route.id.trim() : '';
  if (!id) reasons.push('id_missing');

  const trigger = route && route.trigger && typeof route.trigger === 'object' ? route.trigger : {};
  const enforcement = route && route.enforcement && typeof route.enforcement === 'object' ? route.enforcement : {};
  const kind = typeof enforcement.kind === 'string' ? enforcement.kind.trim() : '';

  if (CLASSIFIER_ENFORCEMENT_KINDS.includes(kind)) {
    const triggerCount = nonEmptyStrings(trigger.phrases).length + validRegexStrings(trigger.regexes).length;
    const directive = typeof enforcement.directive === 'string' ? enforcement.directive.trim() : '';
    if (triggerCount === 0) reasons.push('trigger_missing');
    if (!directive || !directive.startsWith('/sgsd-')) reasons.push('directive_invalid');
    return {
      route,
      id: id || null,
      usable: reasons.length === 0,
      classifierUsable: reasons.length === 0,
      reason_codes: reasons,
    };
  }

  if (kind === 'report_only') {
    const hookEvent = typeof trigger.hook_event_name === 'string' ? trigger.hook_event_name.trim() : '';
    const toolNames = nonEmptyStrings(trigger.tool_names);
    const signal = typeof enforcement.signal === 'string' ? enforcement.signal.trim() : '';
    if (!hookEvent && toolNames.length === 0) reasons.push('report_trigger_missing');
    if (!REPORT_ONLY_SIGNALS.includes(signal)) reasons.push('report_signal_invalid');
    return {
      route,
      id: id || null,
      usable: reasons.length === 0,
      classifierUsable: false,
      reason_codes: reasons,
    };
  }

  reasons.push('enforcement_kind_unknown');
  return { route, id: id || null, usable: false, classifierUsable: false, reason_codes: reasons };
}

function validateRegistryRoutes(routes) {
  const input = Array.isArray(routes) ? routes : [];
  const usableRoutes = [];
  const classifierRoutes = [];
  const invalidRoutes = [];
  for (const route of input) {
    const result = validateRouteShape(route);
    if (result.usable) {
      usableRoutes.push(route);
      if (result.classifierUsable) classifierRoutes.push(route);
    } else {
      invalidRoutes.push({ id: result.id, reason_codes: result.reason_codes.slice() });
    }
  }
  return {
    total_routes: input.length,
    usable_routes: usableRoutes,
    classifier_usable_routes: classifierRoutes,
    invalid_routes: invalidRoutes,
  };
}

function readCompatibilityRegistry(root, payload) {
  try {
    const file = SESSION_GOVERNANCE_REGISTRY_PATH;
    const text = fs.readFileSync(file, 'utf8');
    const registry = parseRegistryYaml(text);
    const routes = registry && Array.isArray(registry.routes) ? registry.routes : [];
    if (routes.length === 0) {
      const bytes = Buffer.byteLength(String(text || ''), 'utf8');
      appendFailureRow(root, bytes > 0 ? 'registry_unparsed' : 'registry_empty', payload, {
        registry_bytes: bytes,
      });
      return registry;
    }

    const validation = validateRegistryRoutes(routes);
    if (validation.invalid_routes.length > 0 || validation.classifier_usable_routes.length === 0) {
      appendFailureRow(root, 'registry_routes_invalid', payload, {
        registry_total_routes: validation.total_routes,
        registry_usable_routes: validation.classifier_usable_routes.length,
        registry_valid_routes: validation.usable_routes.length,
        registry_invalid_routes: validation.invalid_routes.length,
        registry_invalid_route_ids: validation.invalid_routes.map((route) => route.id).filter(Boolean),
      });
    }
    const enforcementRoutes = validation.classifier_usable_routes
      .filter((route) => route.enforcement && route.enforcement.kind === 'directive');

    return {
      ...registry,
      routes: enforcementRoutes
        .map((route) => ({ ...route, registry_path: file })),
      route_validation: {
        total_routes: validation.total_routes,
        usable_routes: enforcementRoutes.length,
        valid_routes: validation.usable_routes.length,
        invalid_routes: validation.invalid_routes.length,
      },
    };
  } catch {
    appendFailureRow(root, 'registry_unavailable', payload);
    return { routes: [] };
  }
}

function classifierMode(payload, options) {
  const requested = options && options.mode !== undefined
    ? options.mode
    : payload && payload.mode;
  return VALID_MODES.includes(requested) ? requested : 'manual';
}

function adaptPromptRoutes(root, payload, options) {
  const opts = options || {};
  const mode = classifierMode(payload, opts);
  const requestedPath = opts.registryPath || SKILL_ROUTING_REGISTRY_PATH;
  try {
    const registry = loadSkillRoutingRegistry({
      registryPath: requestedPath,
      runtime: true,
      root,
      moment: 'prompt-time',
      mode,
      logDegradation: opts.logDegradation,
      noCache: opts.noCache,
      runtimeContext: { moment: 'prompt-time', mode },
    });
    const sourcePath = registry.registry_path || requestedPath;
    return {
      routes: toPromptGovernanceRoutes(registry, { mode })
        .map((route) => ({ ...route, registry_path: sourcePath })),
      source: registry.source,
      degraded: Boolean(registry.degraded),
      degradation_reason: registry.degradation_reason || null,
      registry_path: sourcePath,
    };
  } catch (error) {
    appendFailureRow(root, 'skill_routing_adapter_failed', payload, {
      registry_path: path.resolve(String(requestedPath)),
      error_message: error && error.message ? error.message : String(error),
    });
    const registry = compiledFallbackRegistry();
    return {
      routes: toPromptGovernanceRoutes(registry, { mode })
        .map((route) => ({ ...route, registry_path: registry.registry_path })),
      source: registry.source,
      degraded: true,
      degradation_reason: 'skill_routing_adapter_failed',
      registry_path: registry.registry_path,
    };
  }
}

function readRegistry(root, payload, options) {
  const compatibility = readCompatibilityRegistry(root, payload);
  const promptRoutes = adaptPromptRoutes(root, payload, options);
  const compatibilityRoutes = Array.isArray(compatibility.routes) ? compatibility.routes : [];
  return {
    routes: compatibilityRoutes.concat(promptRoutes.routes),
    compatibility_route_validation: compatibility.route_validation || null,
    prompt_registry_source: promptRoutes.source,
    prompt_registry_degraded: promptRoutes.degraded,
    prompt_registry_degradation_reason: promptRoutes.degradation_reason,
    prompt_registry_path: promptRoutes.registry_path,
  };
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

function regexHit(prompt, regexes, root, payload) {
  for (const pattern of list(regexes)) {
    try {
      if (new RegExp(pattern, 'i').test(prompt)) return true;
    } catch {
      appendFailureRow(root, 'registry_regex_invalid', payload, { regex_pattern: pattern });
    }
  }
  return false;
}

function matchesRoute(route, prompt, root, payload) {
  if (!route || !prompt.trim()) return false;
  // Normalize the common noun/verb variant before applying table-owned signatures.
  const normalizedPrompt = prompt.replace(/\badvice\b/g, 'advise');
  const trigger = route.trigger || {};
  const predicate = route.predicate || {};

  if (phraseHit(normalizedPrompt, predicate.exclude_phrases)) return false;
  if (regexHit(normalizedPrompt, predicate.exclude_regexes, root, payload)) return false;

  return phraseHit(normalizedPrompt, trigger.phrases)
    || regexHit(normalizedPrompt, trigger.regexes, root, payload);
}

function matchingRoutes(registry, prompt, root, payload) {
  const routes = registry && Array.isArray(registry.routes) ? registry.routes : [];
  return routes.filter((route) => matchesRoute(route, prompt, root, payload));
}

function routeDirectives(routes, kind) {
  const seen = new Set();
  const out = [];
  for (const route of routes) {
    const enforcement = route.enforcement || {};
    if (enforcement.kind !== kind || typeof enforcement.directive !== 'string') continue;
    if (!enforcement.directive.startsWith('/sgsd-')) continue;
    if (seen.has(enforcement.directive)) continue;
    seen.add(enforcement.directive);
    out.push(enforcement.directive);
  }
  return out;
}

function directiveLines(routes, kind) {
  const prefix = kind === 'suggestion' ? 'SGSD skill suggestion' : 'SGSD directive';
  return routeDirectives(routes, kind).map((directive) => `${prefix}: ${directive}`);
}

function appendRoutingDecision(root, payload, routes, mandatory, suggestions, duration) {
  if (!Array.isArray(routes) || routes.length === 0) return;
  try {
    const state = readState(root) || {};
    const registryPaths = Array.from(new Set(
      routes.map((route) => route && route.registry_path).filter(Boolean),
    ));
    const row = logGateEvidence(root, {
      signal: ROUTING_DECISION_SIGNAL,
      status: 'ok',
      reason_codes: [],
      artifacts: (registryPaths.length > 0 ? registryPaths : [registryPath()])
        .map((registryPathValue) => ({ kind: 'registry', path: registryPathValue })),
      evidence: [],
      next_action: null,
      risk: 'low',
      duration_ms: Math.max(0, Math.round(duration || 0)),
      phase: state.phase || null,
      milestone: state.milestone || null,
      route_ids: routes.map((route) => route.id).filter(Boolean),
      directives: Array.isArray(mandatory) ? mandatory.slice() : [],
      suggestions: Array.isArray(suggestions) ? suggestions.slice() : [],
      hook_event_name: payload && payload.hook_event_name || null,
      session_id: payload && payload.session_id || null,
    });
    if (!row) {
      appendFailureRow(root, 'evidence_append_failed', payload, {
        failed_signal: ROUTING_DECISION_SIGNAL,
      });
    }
  } catch {
    appendFailureRow(root, 'evidence_append_failed', payload, {
      failed_signal: ROUTING_DECISION_SIGNAL,
    });
  }
}

function emitClassification(root, payload, options) {
  const opts = options || {};
  const started = performance.now();
  const prompt = promptText(payload);
  if (!prompt.trim()) return { routes: [], mandatory: [], suggestions: [] };

  const registry = readRegistry(root, payload, opts);
  const routes = matchingRoutes(registry, prompt, root, payload);
  const mandatory = routeDirectives(routes, 'directive');
  if (mandatory.length > 0) {
    safeStdout(root, payload, mandatory.map((directive) => `SGSD directive: ${directive}`).join('\n'));
  }

  const suggestions = routeDirectives(routes, 'suggestion');
  try {
    if (suggestions.length > 0) {
      safeStdout(root, payload, suggestions.map((directive) => `SGSD skill suggestion: ${directive}`).join('\n'));
    }
    if (opts.recordEvidence !== false) {
      appendRoutingDecision(root, payload, routes, mandatory, suggestions, performance.now() - started);
    }
  } catch {
    appendFailureRow(root, 'optional_suggestions_failed', payload);
  }
  return { routes, mandatory, suggestions };
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
  const payload = { cwd: process.cwd(), prompt: String(args.prompt || ''), mode: args.mode || 'manual' };
  const root = rootFromPayload(payload);
  if (!root) return;
  if (!recordTargetIsCanonical(root, args.record)) return;

  const iterations = Math.max(1, Number.parseInt(String(args.iterations || '200'), 10) || 200);
  const registry = readRegistry(root, payload, { mode: payload.mode, registryPath: args.registry });
  const samples = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    matchingRoutes(registry, promptText(payload), root, payload);
    samples.push(performance.now() - started);
  }

  const state = readState(root) || {};
  const row = logGateEvidence(root, {
    signal: BENCH_SIGNAL,
    status: 'ok',
    reason_codes: [],
    artifacts: [{ kind: 'registry', path: registryPath() }],
    evidence: [],
    next_action: null,
    risk: 'low',
    duration_ms: Math.max(0, Math.round(samples.reduce((sum, n) => sum + n, 0))),
    phase: state.phase || null,
    milestone: state.milestone || null,
    iterations,
    p95_ms: Number(percentile95(samples).toFixed(3)),
  });
  if (!row) {
    appendFailureRow(root, 'evidence_append_failed', payload, {
      failed_signal: BENCH_SIGNAL,
    });
  }
}

function selfTest() {
  let pass = 0;
  let fail = 0;
  const failures = [];
  const assert = (name, condition, detail) => {
    if (condition) pass += 1;
    else {
      fail += 1;
      failures.push({ name, detail: detail || '' });
    }
  };

  const compatibilityRegistry = parseRegistryYaml(fs.readFileSync(REGISTRY_SOURCE_PATH, 'utf8'));
  const compatibilityRoutes = compatibilityRegistry.routes || [];
  assert('1. planning directive remains in compatibility registry',
    routeDirectives(compatibilityRoutes, 'directive').includes('/sgsd-triage'));
  assert('2. quality route remains in compatibility registry',
    compatibilityRoutes.some((route) => route.id === 'quality-gate-missing-plan'
      && route.enforcement && route.enforcement.kind === 'report_only'));
  assert('3. compatibility registry no longer maintains suggestion routes',
    routeDirectives(compatibilityRoutes, 'suggestion').length === 0);

  const payload = { cwd: process.cwd(), hook_event_name: 'UserPromptSubmit' };
  const registry = readRegistry(null, payload, {
    mode: 'manual',
    registryPath: SKILL_ROUTING_REGISTRY_PATH,
    logDegradation: false,
  });
  const suggestionFor = (prompt) => routeDirectives(
    matchingRoutes(registry, prompt.toLowerCase(), null, payload),
    'suggestion',
  );
  assert('4. token-audit suggestion is table sourced',
    suggestionFor('please run a token waste audit before this closes').includes('/sgsd-token-audit')
      && registry.routes.some((route) => route.skill === 'sgsd-token-audit' && route.source === 'yaml'));
  assert('5. MUDA suggestion is table sourced',
    suggestionFor('this looks like MUDA and needs a waste audit').includes('/sgsd-muda-audit')
      && registry.routes.some((route) => route.skill === 'sgsd-muda-audit' && route.source === 'yaml'));
  assert('6. VTP suggestion is table sourced',
    suggestionFor('use VTP advice for this architecture proposal').includes('/sgsd-vtp-advise')
      && registry.routes.some((route) => route.skill === 'sgsd-vtp-advise' && route.source === 'yaml'));

  const fallbackRegistry = readRegistry(null, payload, {
    mode: 'manual',
    registryPath: MALFORMED_SKILL_ROUTING_FIXTURE,
    logDegradation: false,
  });
  const fallbackSuggestions = routeDirectives(
    matchingRoutes(fallbackRegistry, 'please run a token waste audit before this closes', null, payload),
    'suggestion',
  );
  assert('7. malformed table uses compiled fallback routes',
    fallbackRegistry.routes.some((route) => route.source === 'compiled_fallback'));
  assert('8. malformed-table fallback preserves token-audit suggestion',
    fallbackSuggestions.includes('/sgsd-token-audit'));

  console.log(`intent-classifier self-test: ${pass} pass, ${fail} fail`);
  for (const item of failures) {
    console.error(`  FAIL: ${item.name}${item.detail ? ` -- ${item.detail}` : ''}`);
  }
  return fail === 0 ? 0 : 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args['self-test']) {
    try {
      process.exit(selfTest());
    } catch (error) {
      console.error(`intent-classifier self-test: unexpected error -- ${error && error.message ? error.message : String(error)}`);
      process.exit(1);
    }
  }
  if (args.bench) {
    try {
      runBench(args);
    } catch {
      const root = rootFromPayload({ cwd: process.cwd() });
      appendFailureRow(root, 'classifier_unexpected_error', null);
    }
    return;
  }

  if (args.prompt !== undefined) {
    let payload = {};
    let root = null;
    try {
      payload = {
        cwd: process.cwd(),
        hook_event_name: 'ManualPromptProbe',
        mode: classifierMode(null, { mode: args.mode }),
        prompt: String(args.prompt || ''),
      };
      root = rootFromPayload(payload);
      if (!root) return;
      emitClassification(root, payload, {
        mode: payload.mode,
        registryPath: args.registry,
        recordEvidence: false,
      });
    } catch {
      appendFailureRow(root, 'classifier_unexpected_error', payload);
    }
    return;
  }

  let payload = {};
  let root = null;
  try {
    payload = parsePayload(readStdin());
    root = rootFromPayload(payload);
    if (!root) return;
    emitClassification(root, payload);
  } catch {
    appendFailureRow(root, 'classifier_unexpected_error', payload);
  }
}

if (require.main === module) main();

module.exports = {
  BENCH_SIGNAL,
  DEGRADED_SIGNAL,
  ROUTING_DECISION_SIGNAL,
  REGISTRY_SOURCE_PATH,
  SESSION_GOVERNANCE_REGISTRY_PATH,
  SKILL_ROUTING_REGISTRY_PATH,
  parseRegistryYaml,
  routeDirectives,
  directiveLines,
  matchingRoutes,
  readRegistry,
  emitClassification,
  selfTest,
};
