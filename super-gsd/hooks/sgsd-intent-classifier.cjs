#!/usr/bin/env node
'use strict';

// ============================================================================
// SGSD UserPromptSubmit intent classifier
// ============================================================================
// Local lexical router only: no LLM, no network, no prompt blocking.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { createHash, randomUUID } = require('crypto');
const { performance } = require('perf_hooks');

const { findSgsdRoot, readState } = require('../scripts/lib/sgsd-state.cjs');
const {
  ledgerPath,
  logGateEvidence,
} = require('../scripts/lib/gate-evidence-log.cjs');
const {
  compiledFallbackRegistry,
  DEFAULT_REGISTRY_PATH,
  isSafeSkillTarget,
  loadSkillRoutingRegistry,
  resolveSkillTarget,
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
const SKILL_UNAVAILABLE_REASON_CODE = 'skill_entrypoint_not_found';
const MCP_SERVER_UNREGISTERED_REASON_CODE = 'mcp_server_unregistered';
const AUTOMATED_TURN_REASON_CODE = 'automated_task_notification_origin';
const AUTOMATED_ENVELOPE_MARKERS = Object.freeze([
  Object.freeze(['<task-notification>', '</task-notification>']),
  Object.freeze(['<system-reminder>', '</system-reminder>']),
]);
const CLASSIFIER_ENFORCEMENT_KINDS = Object.freeze(['directive', 'suggestion']);
const KB_TRIAGE_SHADOW_SIGNAL = 'kb_triage_shadow';
const KB_TRIAGE_MATCHER_VERSION = 'kb-shadow-v1';
const T4_MCP_AVAILABILITY = 'mcp-server-registered';
const T4_SURFACES = Object.freeze([
  'vtp_search_substrate', 'wiki_search', 'vtp_route_and_retrieve', 'vtp_triage',
]);
const REPORT_ONLY_SIGNALS = Object.freeze(['missing_plan']);

let _govRegistryCache = null; // { key, parsed, bytes }

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

function isAutomatedTurnPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
  if (payload.hook_event_name !== 'UserPromptSubmit') return false;
  if (!payload.origin || payload.origin.kind !== 'task-notification') return false;
  if (payload.promptSource !== 'system' || typeof payload.prompt !== 'string') return false;

  const envelope = payload.prompt.trim();
  return AUTOMATED_ENVELOPE_MARKERS.some(([opening, closing]) => (
    envelope.startsWith(opening) && envelope.endsWith(closing)
  ));
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

function readGovernanceRegistryCached() {
  const registryPathValue = REGISTRY_SOURCE_PATH;
  let key;
  try {
    key = registryPathValue + ':' + fs.statSync(registryPathValue).mtimeMs;
  } catch {
    key = registryPathValue + ':nostat';
  }
  if (_govRegistryCache && _govRegistryCache.key === key) {
    return _govRegistryCache.parsed;
  }

  const text = fs.readFileSync(registryPathValue, 'utf8');
  const parsed = parseRegistryYaml(text);
  _govRegistryCache = {
    key,
    parsed,
    bytes: Buffer.byteLength(String(text || ''), 'utf8'),
  };
  return parsed;
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
    if (!isSafeSkillTarget(directive)) {
      reasons.push('directive_invalid');
    }
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

  if (kind === 'shadow') {
    const genericStrongCount = nonEmptyStrings(trigger.strong_phrases).length
      + validRegexStrings(trigger.strong_regexes).length;
    const triggerCount = nonEmptyStrings(trigger.phrases).length
      + validRegexStrings(trigger.regexes).length
      + nonEmptyStrings(trigger.strong_kb_phrases).length
      + validRegexStrings(trigger.strong_kb_regexes).length
      + genericStrongCount;
    const signal = typeof enforcement.signal === 'string' ? enforcement.signal.trim() : '';
    const directive = typeof enforcement.directive === 'string' ? enforcement.directive.trim() : '';
    const targetSkill = typeof enforcement.target_skill === 'string'
      ? enforcement.target_skill.trim()
      : '';
    const softPathAction = typeof enforcement.soft_path_action === 'string'
      ? enforcement.soft_path_action.trim()
      : '';
    const surfaceId = typeof enforcement.surface_id === 'string'
      ? enforcement.surface_id.trim()
      : '';
    if (triggerCount === 0) reasons.push('shadow_trigger_missing');
    if (signal !== KB_TRIAGE_SHADOW_SIGNAL) reasons.push('shadow_signal_invalid');
    if (directive) reasons.push('shadow_directive_forbidden');
    if (genericStrongCount > 0) {
      if (!/^would_route_[a-z0-9_]+$/.test(softPathAction)) {
        reasons.push('shadow_soft_path_action_invalid');
      }
      if (surfaceId) {
        if (!T4_SURFACES.includes(surfaceId)) reasons.push('shadow_surface_invalid');
        if (route.availability !== T4_MCP_AVAILABILITY) {
          reasons.push('shadow_mcp_availability_invalid');
        }
      } else {
        if (!isSafeSkillTarget('/' + targetSkill)) reasons.push('shadow_target_skill_invalid');
        if (route.availability !== 'external-if-installed') {
          reasons.push('shadow_availability_invalid');
        }
      }
    }
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
    const registry = readGovernanceRegistryCached();
    const routes = registry && Array.isArray(registry.routes) ? registry.routes : [];
    if (routes.length === 0) {
      const bytes = _govRegistryCache ? _govRegistryCache.bytes : 0;
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
      routes: toPromptGovernanceRoutes(registry, { mode, root, deferAvailability: true })
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
      routes: toPromptGovernanceRoutes(registry, { mode, root, deferAvailability: true })
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

function routeSurfaceId(route) {
  const enforcement = route && route.enforcement || {};
  const raw = route && route.mcp_surface || enforcement.surface_id;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

function vtpMcpServerRegistered(root) {
  try {
    const { loadRegistry: loadVtpRegistry } = require('../tools/vtp-readiness/registry.cjs');
    const canonical = loadVtpRegistry().servers.canonical;
    const source = fs.readFileSync(path.join(root, '.mcp.json'), 'utf8');
    const parsed = JSON.parse(source);
    const servers = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed.mcpServers : null;
    return Boolean(servers && typeof servers === 'object' && !Array.isArray(servers)
      && Object.hasOwn(servers, canonical));
  } catch {
    return false;
  }
}

function recordT4RoutedDemand(root, input) {
  const { recordRoutedDemand } = require('../scripts/lib/demand-baseline-ledger.cjs');
  return recordRoutedDemand(path.join(root, '.planning'), input);
}

function t4DecisionId(route, payload, prompt) {
  const session = payload && typeof payload.session_id === 'string' ? payload.session_id : '';
  return 'p159-' + createHash('sha256')
    .update([route && route.id || '', session, prompt].join('\0'))
    .digest('hex');
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

function startAnchoredVerbHit(prompt, verbs) {
  const vs = nonEmptyStrings(verbs);
  if (vs.length === 0) return false;
  const re = new RegExp('^\\s*(?:' + vs.map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'i');
  return re.test(prompt);
}

function matchesShadowRoute(route, prompt, root, payload) {
  if (!route || !prompt.trim()) return false;
  const trigger = route.trigger || {};
  const predicate = route.predicate || {};
  if (phraseHit(prompt, predicate.exclude_phrases)) return false;
  if (regexHit(prompt, predicate.exclude_regexes, root, payload)) return false;
  const strong = phraseHit(prompt, trigger.strong_phrases)
    || regexHit(prompt, trigger.strong_regexes, root, payload)
    || phraseHit(prompt, trigger.strong_kb_phrases)
    || regexHit(prompt, trigger.strong_kb_regexes, root, payload);
  if (strong) return true;
  const weak = phraseHit(prompt, trigger.phrases)
    || regexHit(prompt, trigger.regexes, root, payload);
  if (!weak) return false;
  if (startAnchoredVerbHit(prompt, predicate.exclude_start_verbs)) return false;
  return true;
}

function kbTriageShadowLedgerPath(root) {
  return path.resolve(root, '.planning', 'metrics', 'kb-triage-shadow.jsonl');
}

function evaluateShadowRoutes(root, payload, prompt) {
  try {
    const started = performance.now();
    const registry = readGovernanceRegistryCached();
    const all = Array.isArray(registry.routes) ? registry.routes : [];
    const shadowRoutes = all.filter((route) => {
      const validation = validateRouteShape(route);
      return validation.usable
        && route.enforcement
        && route.enforcement.kind === 'shadow';
    });
    const lexicalMatches = shadowRoutes
      .filter((route) => matchesShadowRoute(route, prompt, root, payload));
    const t4LexicalMatches = lexicalMatches.filter((route) => routeSurfaceId(route));
    const selectedT4Route = t4LexicalMatches.length > 0 ? t4LexicalMatches[0] : null;
    const selectedMatches = lexicalMatches.filter((route) => (
      !routeSurfaceId(route) || route === selectedT4Route
    ));
    const matched = [];
    const t4EvaluationCount = selectedT4Route ? 1 : 0;
    if (selectedT4Route && !vtpMcpServerRegistered(root)) {
      appendRoutingDecision(root, payload, [selectedT4Route], [], [], performance.now() - started, {
        decision: 'mcp_server_unregistered',
        route_id: selectedT4Route.id,
        surface_id: routeSurfaceId(selectedT4Route),
      });
      return { t4_evaluation_count: t4EvaluationCount };
    }
    for (const route of selectedMatches) {
      const enforcement = route.enforcement || {};
      const surfaceId = routeSurfaceId(route);
      const targetSkill = typeof enforcement.target_skill === 'string'
        ? enforcement.target_skill.trim() : '';
      if (targetSkill && !resolveSkillTarget('/' + targetSkill, { root }).available) continue;
      matched.push(route);
    }
    if (matched.length === 0) return { t4_evaluation_count: t4EvaluationCount };
    const ledgerPathValue = kbTriageShadowLedgerPath(root);
    for (const route of matched) {
      const enforcement = route.enforcement || {};
      const surfaceId = routeSurfaceId(route);
      const decisionId = surfaceId ? t4DecisionId(route, payload, prompt) : randomUUID();
      const softPathAction = typeof enforcement.soft_path_action === 'string'
        ? enforcement.soft_path_action
        : 'would_route_vtp_query_triage';
      const line = JSON.stringify({
        ts: new Date().toISOString(),
        decision_id: decisionId,
        matcher_version: KB_TRIAGE_MATCHER_VERSION,
        matched_signature_ids: [route.id].filter(Boolean),
        soft_path_action: softPathAction,
        latency_ms: null,
        operator_label: null,
        ...(surfaceId ? { surface_id: surfaceId } : {}),
      }) + '\n';
      const latency_ms = Number((performance.now() - started).toFixed(3));
      fs.appendFileSync(
        ledgerPathValue,
        line.replace('"latency_ms":null', '"latency_ms":' + latency_ms),
      );
      if (surfaceId) {
        appendRoutingDecision(root, payload, [route], [], [], latency_ms, {
          t4_fired: true,
          decision_id: decisionId,
          surface_id: surfaceId,
        });
        recordT4RoutedDemand(root, {
          decision_id: decisionId,
          surface: surfaceId,
          latency_ms,
        });
      }
    }
    return { t4_evaluation_count: t4EvaluationCount };
  } catch {
    // Fire-and-forget: shadow evaluation must never throw or affect injection.
    return { t4_evaluation_count: 0 };
  }
}

function matchingRoutes(registry, prompt, root, payload) {
  const routes = registry && Array.isArray(registry.routes) ? registry.routes : [];
  return routes.filter((route) => matchesRoute(route, prompt, root, payload));
}

function partitionMatchedRoutesByMcpRegistration(root, routes) {
  const available = [];
  const unavailable = [];
  let registered = null;
  for (const route of Array.isArray(routes) ? routes : []) {
    if (!route || !route.mcp_surface) {
      available.push(route);
      continue;
    }
    if (registered === null) registered = vtpMcpServerRegistered(root);
    if (registered) available.push(route);
    else unavailable.push({ route, surface_id: route.mcp_surface });
  }
  return { available, unavailable };
}

function partitionMatchedRoutesByAvailability(root, routes) {
  const available = [];
  const unavailable = [];
  const seenUnavailableTargets = new Set();
  for (const route of Array.isArray(routes) ? routes : []) {
    const enforcement = route && route.enforcement || {};
    const resolution = resolveSkillTarget(enforcement.directive, { root });
    if (resolution.available) {
      available.push(route);
      continue;
    }
    if (!resolution.target || seenUnavailableTargets.has(resolution.target)) continue;
    seenUnavailableTargets.add(resolution.target);
    unavailable.push({ route, target: resolution.target });
  }
  return { available, unavailable };
}

function routeDirectives(routes, kind) {
  const seen = new Set();
  const out = [];
  for (const route of routes) {
    const enforcement = route.enforcement || {};
    if (enforcement.kind !== kind || typeof enforcement.directive !== 'string') continue;
    if (!isSafeSkillTarget(enforcement.directive)) continue;
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

function appendRoutingDecision(root, payload, routes, mandatory, suggestions, duration, details) {
  if (!Array.isArray(routes)) return;
  try {
    const automatedTurnSkip = details
      && details.decision === 'automated_turn_skip';
    const skillUnavailable = details
      && details.decision === 'skill_unavailable';
    const mcpUnregistered = details
      && details.decision === 'mcp_server_unregistered';
    const t4Fired = details && details.t4_fired === true;
    const state = readState(root) || {};
    const registryPaths = Array.from(new Set(
      routes.map((route) => route && route.registry_path).filter(Boolean),
    ));
    const row = logGateEvidence(root, {
      signal: ROUTING_DECISION_SIGNAL,
      status: 'ok',
      decision: automatedTurnSkip || skillUnavailable || mcpUnregistered
        ? details.decision
        : (routes.length > 0 ? 'matched' : 'no_match'),
      reason_codes: automatedTurnSkip
        ? [AUTOMATED_TURN_REASON_CODE]
        : (skillUnavailable ? [SKILL_UNAVAILABLE_REASON_CODE]
          : (mcpUnregistered ? [MCP_SERVER_UNREGISTERED_REASON_CODE] : [])),
      artifacts: automatedTurnSkip || skillUnavailable || mcpUnregistered || t4Fired
        ? []
        : (registryPaths.length > 0 ? registryPaths : [registryPath()])
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
      ...(!skillUnavailable && !mcpUnregistered && !t4Fired ? {
        hook_event_name: payload && payload.hook_event_name || null,
        session_id: payload && payload.session_id || null,
      } : {}),
      ...(automatedTurnSkip ? {
        origin_kind: 'task-notification',
        prompt_source: 'system',
        route_evaluation_count: 0,
        shadow_evaluation_count: 0,
      } : {}),
      ...(skillUnavailable ? {
        route_id: details.route_id,
        target_skill: details.target_skill,
        route_evaluation_count: 1,
        availability_check_count: 1,
      } : {}),
      ...(mcpUnregistered ? {
        route_id: details.route_id,
        surface_id: details.surface_id,
        mcp_server_id: 'canonical',
        route_evaluation_count: 1,
        mcp_registration_check_count: 1,
      } : {}),
      ...(t4Fired ? {
        decision_id: details.decision_id,
        surface_id: details.surface_id,
      } : {}),
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
  if (isAutomatedTurnPayload(payload)) {
    const empty = [];
    if (opts.recordEvidence !== false) {
      appendRoutingDecision(root, payload, empty, empty, empty, performance.now() - started, {
        decision: 'automated_turn_skip',
      });
    }
    return { routes: empty, mandatory: empty, suggestions: empty };
  }

  const prompt = promptText(payload);
  if (!prompt.trim()) return { routes: [], mandatory: [], suggestions: [] };

  const registry = readRegistry(root, payload, opts);
  const matchedRoutes = matchingRoutes(registry, prompt, root, payload);
  const mcpPartitioned = partitionMatchedRoutesByMcpRegistration(root, matchedRoutes);
  const partitioned = partitionMatchedRoutesByAvailability(root, mcpPartitioned.available);
  const routes = partitioned.available;
  if (opts.recordEvidence !== false) {
    for (const item of mcpPartitioned.unavailable) {
      appendRoutingDecision(root, payload, [item.route], [], [], performance.now() - started, {
        decision: 'mcp_server_unregistered',
        route_id: item.route && item.route.id || null,
        surface_id: item.surface_id,
      });
    }
    for (const item of partitioned.unavailable) {
      appendRoutingDecision(root, payload, [item.route], [], [], performance.now() - started, {
        decision: 'skill_unavailable',
        route_id: item.route && item.route.id || null,
        target_skill: item.target,
      });
    }
  }
  const shadowResult = mcpPartitioned.unavailable.length > 0
    ? { t4_evaluation_count: 0 }
    : evaluateShadowRoutes(root, payload, prompt);
  const mandatory = routeDirectives(routes, 'directive');
  if (mandatory.length > 0) {
    safeStdout(root, payload, mandatory.map((directive) => `SGSD directive: ${directive}`).join('\n'));
  }

  const suggestions = routeDirectives(routes, 'suggestion');
  const t4PromptRoute = routes.find((route) => Boolean(route && route.mcp_surface));
  const t4PromptDecisionId = t4PromptRoute
    ? t4DecisionId(t4PromptRoute, payload, prompt) : null;
  try {
    if (suggestions.length > 0) {
      safeStdout(root, payload, suggestions.map((directive) => `SGSD skill suggestion: ${directive}`).join('\n'));
    }
    if (opts.recordEvidence !== false
        && (routes.length > 0 || (
          partitioned.unavailable.length === 0
          && mcpPartitioned.unavailable.length === 0
          && (!shadowResult || shadowResult.t4_evaluation_count === 0)
        ))) {
      appendRoutingDecision(
        root, payload, routes, mandatory, suggestions, performance.now() - started,
        t4PromptRoute ? {
          t4_fired: true,
          decision_id: t4PromptDecisionId,
          surface_id: t4PromptRoute.mcp_surface,
        } : null,
      );
    }
    if (t4PromptRoute) {
      recordT4RoutedDemand(root, {
        decision_id: t4PromptDecisionId,
        surface: t4PromptRoute.mcp_surface,
        latency_ms: Number((performance.now() - started).toFixed(3)),
      });
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
  const os = require('os');
  const { spawnSync } = require('child_process');
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

  const shadowRoute = compatibilityRoutes.find((route) => route.id === 'kb-lookup-triage');
  const shadowValidation = validateRouteShape(shadowRoute);
  assert('9. KB triage route is usable shadow-only metadata',
    shadowRoute
      && shadowRoute.enforcement
      && shadowRoute.enforcement.kind === 'shadow'
      && shadowValidation.usable
      && shadowValidation.classifierUsable === false);
  assert('10. pure fix imperative does not match KB triage shadow route',
    !matchesShadowRoute(shadowRoute, 'fix the failing test', null, payload));

  const notificationSentinels = Object.freeze([
    'opaque-tn-a7f31',
    'opaque-tu-c9d42',
    'opaque-of-e2b53',
    'opaque-st-f4a64',
    'opaque-su-b6c75',
    'opaque-re-d8e86',
  ]);
  const notificationEnvelope = [
    '<task-notification>',
    `  <task-id>${notificationSentinels[0]}</task-id>`,
    `  <tool-use-id>${notificationSentinels[1]}</tool-use-id>`,
    `  <output-file>${notificationSentinels[2]}</output-file>`,
    `  <status>${notificationSentinels[3]}</status>`,
    `  <summary>${notificationSentinels[4]} multiple valid approaches token waste knowledge base</summary>`,
    `  <result>${notificationSentinels[5]}</result>`,
    '</task-notification>',
  ].join('\n');

  function readJsonl(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  function runStdinFixture(fixturePayload) {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-intent-origin-'));
    try {
      const planningDir = path.join(fixtureRoot, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(
        path.join(planningDir, 'STATE.md'),
        '---\nmilestone: fixture\ncurrent_phase: 158\n---\n',
        'utf8',
      );
      const child = spawnSync(process.execPath, [__filename], {
        cwd: fixtureRoot,
        input: JSON.stringify({ ...fixturePayload, cwd: fixtureRoot }),
        encoding: 'utf8',
        timeout: 10000,
      });
      if (child.error) throw child.error;
      const evidenceFile = path.join(planningDir, 'metrics', 'gate-evidence.jsonl');
      const shadowFile = path.join(planningDir, 'metrics', 'kb-triage-shadow.jsonl');
      return {
        status: child.status,
        error: child.error || null,
        stdout: child.stdout || '',
        stderr: child.stderr || '',
        evidence: readJsonl(evidenceFile),
        evidenceText: fs.existsSync(evidenceFile) ? fs.readFileSync(evidenceFile, 'utf8') : '',
        shadow: readJsonl(shadowFile),
      };
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }

  const humanResult = runStdinFixture({
    hook_event_name: 'UserPromptSubmit',
    origin: { kind: 'human' },
    promptSource: 'typed',
    prompt: 'Let\'s plan the next phase',
  });
  const humanRows = humanResult.evidence.filter((row) => row.signal === ROUTING_DECISION_SIGNAL);
  assert('11. human/typed production-stdin fixture exits zero',
    humanResult.status === 0 && !humanResult.error,
    'status=' + humanResult.status);
  assert('12. human/typed planning input emits the established directive',
    humanResult.stdout.includes('SGSD directive: /sgsd-triage'));
  assert('13. human/typed planning input writes matched planning-triage evidence',
    humanRows.length === 1
      && humanRows[0].decision === 'matched'
      && humanRows[0].route_ids.includes('planning-triage'));
  assert('14. human/typed planning input is never recorded as an automated skip',
    humanRows.every((row) => row.decision !== 'automated_turn_skip'));

  const automatedResult = runStdinFixture({
    hook_event_name: 'UserPromptSubmit',
    origin: { kind: 'task-notification' },
    promptSource: 'system',
    prompt: notificationEnvelope,
  });
  const automatedRows = automatedResult.evidence
    .filter((row) => row.signal === ROUTING_DECISION_SIGNAL);
  const skipRows = automatedRows.filter((row) => row.decision === 'automated_turn_skip');
  const forbiddenEvidenceKeys = [
    'prompt', 'text', 'excerpt', 'inner', 'task_id', 'task-id', 'tool_use_id',
    'tool-use-id', 'output_path', 'output-file', 'summary', 'result', 'entities', 'query',
  ];
  assert('15. automated production-stdin fixture exits zero',
    automatedResult.status === 0 && !automatedResult.error,
    'status=' + automatedResult.status);
  assert('16. automated turn emits no stdout', automatedResult.stdout === '');
  assert('17. automated turn writes exactly one automated_turn_skip row',
    automatedRows.length === 1 && skipRows.length === 1);
  assert('18. automated skip has no degraded, matched, or no_match companion row',
    automatedResult.evidence.length === 1
      && !automatedResult.evidence.some((row) => row.signal === DEGRADED_SIGNAL)
      && automatedRows.every((row) => row.decision === 'automated_turn_skip'));
  assert('19. automated skip row is structurally attributed with zero evaluations',
    skipRows.length === 1
      && skipRows[0].origin_kind === 'task-notification'
      && skipRows[0].prompt_source === 'system'
      && skipRows[0].route_evaluation_count === 0
      && skipRows[0].shadow_evaluation_count === 0
      && skipRows[0].route_ids.length === 0
      && skipRows[0].directives.length === 0
      && skipRows[0].suggestions.length === 0);
  assert('20. automated turn writes no KB-shadow row', automatedResult.shadow.length === 0);
  assert('21. automated evidence contains no inner sentinel or forbidden text-bearing key',
    notificationSentinels.every((sentinel) => !automatedResult.evidenceText.includes(sentinel))
      && forbiddenEvidenceKeys.every((key) => !new RegExp(
        String.fromCharCode(34) + key + String.fromCharCode(34) + '\\s*:',
        'i',
      ).test(automatedResult.evidenceText)));

  const quotedResult = runStdinFixture({
    hook_event_name: 'UserPromptSubmit',
    origin: { kind: 'human' },
    promptSource: 'typed',
    prompt: 'Let\'s plan the next phase while quoting this payload:\n' + notificationEnvelope,
  });
  const quotedRows = quotedResult.evidence.filter((row) => row.signal === ROUTING_DECISION_SIGNAL);
  assert('22. human quote production-stdin fixture exits zero',
    quotedResult.status === 0 && !quotedResult.error,
    'status=' + quotedResult.status);
  assert('23. human/typed quote still emits the planning directive',
    quotedResult.stdout.includes('SGSD directive: /sgsd-triage'));
  assert('24. human/typed quote writes matched planning-triage evidence',
    quotedRows.length === 1
      && quotedRows[0].decision === 'matched'
      && quotedRows[0].route_ids.includes('planning-triage'));
  assert('25. human/typed quote is never recorded as an automated skip',
    quotedRows.every((row) => row.decision !== 'automated_turn_skip'));

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
  KB_TRIAGE_MATCHER_VERSION,
  parseRegistryYaml,
  routeDirectives,
  directiveLines,
  matchingRoutes,
  matchesShadowRoute,
  routeSurfaceId,
  vtpMcpServerRegistered,
  partitionMatchedRoutesByMcpRegistration,
  evaluateShadowRoutes,
  kbTriageShadowLedgerPath,
  readRegistry,
  emitClassification,
  selfTest,
};
