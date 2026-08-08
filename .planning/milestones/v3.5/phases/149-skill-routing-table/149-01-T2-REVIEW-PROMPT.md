# P149-T2 SPEC + PER-DISPATCH ATC REVIEW

Review the new loader + fixture against the T2 contract below. (1) Spec: strict validation in self-test, adapter for P146 routes[] shape, loud compiled fallback at runtime (never fail-fast), gate-evidence degradation rows. (2) ATC 10-point anti-slop. (3) Security: regex compilation from YAML (ReDoS/injection), path handling. Host verification: --self-test 8/8 pass.

Emit ALL these exact lines: FINDINGS/CRITICAL/WARNINGS/PASS_RATE/ONE_LINER/SPEC_VERDICT, then FINDINGS_DETAIL per CRITICAL/WARNING.

## T2 contract
  - id: "P149-T2"
    type: "loader-schema-fallback"
    agent: codex
    model: codex
    files_touched:
      - "super-gsd/scripts/lib/skill-routing-registry.cjs"
      - "super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml"
    input_contract: >
      Implement only the js-yaml loader/helper module and malformed fixture. Reuse `js-yaml`; do not wire classifier or orchestrator callers in this task.
    output_contract: >
      The helper exports normalized loading, prompt adapter, scheduled-route query, compiled fallback, and CLI probes; malformed self-test fails while runtime probe falls back and logs degradation.
    hypothesis: "A js-yaml loader can validate the runtime table in self-test, adapt it for callers, and fall back loudly at runtime when malformed."
    falsifier: >
      Malformed registry self-test exits zero, runtime probe throws upward, fallback routes are unavailable, or registry degradation is not written to gate evidence.
    stop_rule: >
      Stop after the loader self-test, malformed self-test, and malformed runtime probe commands demonstrate the expected self-test failure and runtime fallback behavior.
    verification:
      commands:
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test"
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test --registry super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml"
        - "node super-gsd/scripts/lib/skill-routing-registry.cjs --runtime-probe --registry super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml --moment prompt-time --mode manual"

## Diff
```

--- untracked files content ---
'use strict';

// ============================================================================
// SGSD - skill-routing registry loader (P149-T2)
// ============================================================================
// Owns js-yaml loading, schema validation, prompt-time adaptation, scheduled
// route lookup, compiled fallback, runtime degradation logging, and CLI probes.
// Runtime catches malformed registries and falls back; self-test is strict.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

const { logGateEvidence } = require('./gate-evidence-log.cjs');
const { findSgsdRoot, readState } = require('./sgsd-state.cjs');

const DEFAULT_REGISTRY_PATH = path.resolve(__dirname, '..', '..', 'registry', 'skill-routing.yaml');
const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const YAML_LIB_PATH = path.resolve(__dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml');

const VALID_MOMENTS = Object.freeze(['prompt-time', 'phase-close', 'milestone-close', 'weekly', 'on-demand']);
const VALID_MODES = Object.freeze(['manual', 'semi', 'auto']);
const VALID_AVAILABILITY = Object.freeze([
  'canonical',
  'alias',
  'manual-only',
  'external-if-installed',
  'omitted',
]);

const DEGRADED_SIGNAL = 'skill_routing_registry_degraded';
const SKILL_ROUTING_EVENT = 'skill-routing';
const FALLBACK_SOURCE = 'compiled_fallback';

let _cache = new Map();

function fb(skill, moment, modes, signatures, extra) {
  return Object.assign({ skill, signatures, moment, modes }, extra || {});
}

const COMPILED_FALLBACK_ROWS = Object.freeze([
  fb('sgsd-muda-audit', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['muda', 'waste', 'retrospective', 'retro', 'what went wrong', 'conformance drift'],
    regexes: ['\\b(?:muda|waste|wasted|wasting)\\b', '\\b(?:retrospective|retro)\\b.{0,160}\\b(?:waste|drift|missed|wrong)\\b'],
  }, { availability: 'canonical' }),
  fb('sgsd-muda-audit', 'phase-close', ['semi', 'auto'], {
    event_names: ['phase-close'],
  }, { availability: 'canonical', gate_ref: 'MUDA-waste-audit', cooldown: { policy: 'gate-controlled', scope: 'phase' } }),
  fb('sgsd-token-audit', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['token spend', 'token budget', 'token burn', 'context cost', 'token waste'],
    regexes: ['\\btokens?\\b.{0,160}\\b(?:spend|spent|burn|budget|cost|waste)\\b', '\\b(?:spend|spent|burn|budget|cost|waste)\\b.{0,160}\\btokens?\\b'],
  }, { availability: 'canonical' }),
  fb('sgsd-token-audit', 'milestone-close', ['semi', 'auto'], {
    event_names: ['milestone-close'],
  }, { availability: 'canonical', cooldown: { policy: 'sgsd-complete-milestone-owned', scope: 'milestone' } }),
  fb('sgsd-distill', 'milestone-close', ['semi', 'auto'], {
    event_names: ['milestone-close'],
    phrases: ['distill milestone', 'trajectory distill', 'summarize learnings'],
  }, { availability: 'canonical', cooldown: { policy: 'once-per-milestone', scope: 'milestone' } }),
  fb('sgsd-sepl', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['major proposal', 'architecture tradeoff', 'architecture trade-off', 'strategic tradeoff', 'strategic trade-off', 'sets precedent'],
    regexes: ['\\b(?:architecture|system|governance)\\b.{0,120}\\b(?:tradeoffs?|trade-offs?|decision|proposal)\\b', '\\bshould\\s+we\\b.{0,160}\\b(?:choose|adopt|standardize|centralize|decentralize|replace)\\b'],
  }, { availability: 'canonical' }),
  fb('sgsd-sepl', 'on-demand', ['manual', 'semi', 'auto'], {
    phrases: ['sgsd-sepl', 'sepl', 'deliberate', 'deliberate decision'],
  }, { availability: 'canonical' }),
  fb('sgsd-overwatcher', 'phase-close', ['auto'], {
    event_names: ['phase-close'],
  }, { availability: 'canonical', cooldown: { policy: 'once-per-phase', scope: 'phase' } }),
  fb('sgsd-readiness', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['readiness', 'release readiness', 'health check', 'sgsd-health', 'gsd-health'],
    regexes: ['\\b(?:ready|readiness|health)\\b.{0,120}\\b(?:ship|release|close|phase|milestone)\\b'],
  }, { aliases: ['sgsd-health', 'gsd-health'], availability: 'canonical' }),
  fb('sgsd-readiness', 'phase-close', ['auto'], {
    event_names: ['phase-close', 'auto-mode-readiness'],
  }, { availability: 'canonical', cooldown: { policy: 'route-policy', scope: 'phase' } }),
  fb('sgsd-audit', 'phase-close', ['semi', 'auto'], {
    event_names: ['phase-close'],
  }, { availability: 'canonical', gate_ref: 'phase-level-ATC' }),
  fb('sgsd-audit', 'milestone-close', ['semi', 'auto'], {
    event_names: ['milestone-close'],
  }, { availability: 'canonical', cooldown: { policy: 'sgsd-complete-milestone-owned', scope: 'milestone' } }),
  fb('sgsd-memory-hygiene', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['sgsd-memory', 'sgsd-memory-hygiene', 'sgsd-recall', 'recall memory', 'memory recall'],
    regexes: ['\\b(?:recall|remember|memory)\\b.{0,120}\\b(?:context|decision|precedent|learning)\\b'],
  }, { aliases: ['sgsd-recall'], availability: 'canonical', gate_ref: 'sgsd-recall-queries' }),
  fb('sgsd-memory-hygiene', 'phase-close', ['semi', 'auto'], {
    event_names: ['phase-close'],
    phrases: ['sgsd-curate', 'curate memory', 'curate learnings', 'memory hygiene'],
  }, { aliases: ['sgsd-curate'], availability: 'canonical', gate_ref: 'sgsd-curate-learnings', cooldown: { policy: 'gate-controlled', scope: 'phase' } }),
  fb('sgsd-vtp-advise', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['vtp advise', 'vtp context', 'vtp enrichment', 'private kb', 'knowledge bank'],
    regexes: ['\\bvtp\\b.{0,120}\\b(?:advise|context|enrich|knowledge|kb)\\b', '\\b(?:private\\s+kb|knowledge\\s+bank)\\b'],
  }, { availability: 'canonical' }),
  fb('sgsd-vtp-advise', 'on-demand', ['manual', 'semi', 'auto'], {
    phrases: ['sgsd-vtp-advise', 'vtp advise', 'advise from vtp', 'check vtp'],
  }, { availability: 'canonical' }),
  fb('gsd-cleanup', 'on-demand', ['manual'], {
    phrases: ['gsd-cleanup', 'cleanup gsd', 'clean up gsd', 'cleanup workspace'],
  }, { availability: 'omitted', skip_reason: 'legacy_unregistered' }),
  fb('gsd-code-review', 'prompt-time', ['manual', 'semi'], {
    phrases: ['gsd-code-review', 'code review', 'review my code', 'review this change'],
    regexes: ['\\bcode\\s+review\\b', '\\breview\\b.{0,120}\\b(?:diff|change|commit|code)\\b'],
  }, { availability: 'external-if-installed' }),
  fb('gsd-code-review', 'on-demand', ['manual', 'semi'], {
    phrases: ['gsd-code-review', 'run code review', 'external code review'],
  }, { availability: 'external-if-installed' }),
  fb('gsd-code-review-fix', 'prompt-time', ['manual'], {
    phrases: ['gsd-code-review-fix', 'fix review findings', 'apply code review fixes', 'address review comments'],
    regexes: ['\\bfix\\b.{0,120}\\b(?:review|findings|comments)\\b'],
  }, { availability: 'manual-only' }),
  fb('sgsd-audit', 'prompt-time', ['manual', 'semi', 'auto'], {
    phrases: ['gsd-verify-work', 'verify work', 'verify this work', 'run verification', 'atc flow'],
    regexes: ['\\bverify\\b.{0,120}\\b(?:work|change|phase|implementation)\\b'],
  }, { aliases: ['gsd-verify-work'], availability: 'alias', gate_ref: 'phase-level-ATC' }),
  fb('sgsd-audit', 'on-demand', ['manual'], {
    phrases: ['gsd-secure-phase', 'secure phase', 'security phase', 'phase security review'],
  }, { aliases: ['gsd-secure-phase'], availability: 'alias' }),
]);

function _clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function _safeWarn(message) {
  try {
    process.stderr.write('[SGSD] skill-routing-registry ' + String(message || 'degraded') + '\n');
  } catch {
    // Stderr must never become the failure path.
  }
}

function _yaml() {
  return require(YAML_LIB_PATH);
}

function _registryPathFromOpts(opts) {
  const o = opts || {};
  return path.resolve(String(o.registryPath || o.registry || DEFAULT_REGISTRY_PATH));
}

function _repoRootFromOpts(opts) {
  const o = opts || {};
  const start = o.planningDir || o.root || process.cwd();
  return findSgsdRoot(start) || DEFAULT_REPO_ROOT;
}

function _displayPath(root, filePath) {
  try {
    const abs = path.resolve(String(filePath));
    const rel = path.relative(path.resolve(root), abs);
    if (rel && !rel.startsWith('..') && !path.isAbsolute(rel)) return rel.replace(/\\/g, '/');
    return abs.replace(/\\/g, '/');
  } catch {
    return String(filePath || '').replace(/\\/g, '/');
  }
}

function _stringList(value, label, issues) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    issues.push(label + ' must be an array of strings');
    return [];
  }
  const out = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item !== 'string' || !item.trim()) {
      issues.push(label + '[' + i + '] must be a non-empty string');
    } else if (!out.includes(item.trim())) {
      out.push(item.trim());
    }
  }
  return out;
}

function _optionalString(value, label, issues) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(label + ' must be a non-empty string when present');
    return null;
  }
  return value.trim();
}

function _validateRegexes(regexes, label, issues) {
  for (const pattern of regexes) {
    try {
      new RegExp(pattern, 'i');
    } catch (e) {
      issues.push(label + ' regex invalid: ' + pattern + ' (' + e.message + ')');
    }
  }
}

function _normalizeSignatures(value, label, issues) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    issues.push(label + '.signatures must be an object');
    return { phrases: [], regexes: [], event_names: [] };
  }
  const phrases = _stringList(value.phrases, label + '.signatures.phrases', issues);
  const regexes = _stringList(value.regexes, label + '.signatures.regexes', issues);
  const eventNames = _stringList(value.event_names, label + '.signatures.event_names', issues);
  _validateRegexes(regexes, label + '.signatures', issues);
  if (phrases.length + regexes.length + eventNames.length === 0) {
    issues.push(label + '.signatures must include phrases, regexes, or event_names');
  }
  return { phrases, regexes, event_names: eventNames };
}

function _normalizeModes(value, label, issues) {
  const modes = _stringList(value, label + '.modes', issues);
  const out = [];
  for (const mode of modes) {
    if (!VALID_MODES.includes(mode)) issues.push(label + '.modes contains invalid mode: ' + mode);
    else if (!out.includes(mode)) out.push(mode);
  }
  if (out.length === 0) issues.push(label + '.modes must include at least one of ' + VALID_MODES.join(', '));
  return out;
}

function _normalizeCooldown(value, label, issues) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    issues.push(label + '.cooldown must be an object when present');
    return null;
  }
  if (Object.prototype.hasOwnProperty.call(value, 'predicate')) {
    issues.push(label + '.cooldown.predicate is forbidden; use gate_ref or a named route policy');
  }
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    if (typeof item !== 'string' && typeof item !== 'number' && typeof item !== 'boolean' && item !== null) {
      issues.push(label + '.cooldown.' + key + ' must be scalar');
    } else {
      out[key] = item;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function _normalizeRoute(row, index, sourceTag) {
  const issues = [];
  const label = 'routes[' + index + ']';
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    return { route: null, issues: [label + ' must be an object'] };
  }

  const skill = _optionalString(row.skill, label + '.skill', issues);
  const signatures = _normalizeSignatures(row.signatures, label, issues);
  const moment = _optionalString(row.moment, label + '.moment', issues);
  if (moment && !VALID_MOMENTS.includes(moment)) issues.push(label + '.moment invalid: ' + moment);
  const modes = _normalizeModes(row.modes, label, issues);
  const aliases = _stringList(row.aliases, label + '.aliases', issues);
  const availability = row.availability === undefined || row.availability === null
    ? 'canonical'
    : _optionalString(row.availability, label + '.availability', issues);
  if (availability && !VALID_AVAILABILITY.includes(availability)) {
    issues.push(label + '.availability invalid: ' + availability);
  }
  const gateRef = _optionalString(row.gate_ref, label + '.gate_ref', issues);
  const skipReason = _optionalString(row.skip_reason, label + '.skip_reason', issues);
  const notes = _optionalString(row.notes, label + '.notes', issues);
  const cooldown = _normalizeCooldown(row.cooldown, label, issues);
  const explicitId = _optionalString(row.id, label + '.id', issues);

  if (availability === 'omitted' && !skipReason) {
    issues.push(label + '.skip_reason required when availability is omitted');
  }

  if (issues.length > 0) return { route: null, issues };
  const id = explicitId || skill + ':' + moment + ':' + String(index + 1).padStart(2, '0');
  return {
    route: {
      id,
      skill,
      aliases,
      signatures,
      moment,
      modes,
      availability,
      gate_ref: gateRef,
      cooldown,
      skip_reason: skipReason,
      notes,
      source: sourceTag,
      index,
    },
    issues: [],
  };
}

function _schemaError(issues) {
  const err = new Error('skill-routing-registry schema invalid: ' + issues.slice(0, 12).join('; '));
  err.code = 'SKILL_ROUTING_SCHEMA_INVALID';
  err.reasonCode = 'skill_routing_registry_malformed';
  err.issues = issues.slice();
  return err;
}

function _normalizeDocument(doc, sourceTag, registryPath) {
  const issues = [];
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    issues.push('registry document must be an object with top-level routes array');
  }
  const rows = doc && Array.isArray(doc.routes) ? doc.routes : null;
  if (!rows) issues.push('top-level routes array missing');
  if (rows && rows.length === 0) issues.push('top-level routes array must not be empty');

  const routes = [];
  if (rows) {
    for (let i = 0; i < rows.length; i += 1) {
      const result = _normalizeRoute(rows[i], i, sourceTag);
      if (result.issues.length > 0) issues.push(...result.issues);
      if (result.route) routes.push(result.route);
    }
  }

  if (issues.length > 0) throw _schemaError(issues);

  const bySkill = {};
  for (const route of routes) {
    if (!bySkill[route.skill]) bySkill[route.skill] = [];
    bySkill[route.skill].push(route);
  }

  return {
    source: sourceTag,
    registry_path: registryPath || null,
    degraded: sourceTag === FALLBACK_SOURCE,
    degradation_reason: null,
    degradation_logged: false,
    routes,
    bySkill,
    validation: {
      route_count: routes.length,
      prompt_time_count: routes.filter((r) => r.moment === 'prompt-time').length,
      scheduled_count: routes.filter((r) => r.moment !== 'prompt-time' && r.moment !== 'on-demand').length,
    },
  };
}

function compiledFallbackRegistry() {
  return _normalizeDocument({ routes: _clone(COMPILED_FALLBACK_ROWS) }, FALLBACK_SOURCE, 'compiled:fallback');
}

function _errorReasonCode(error) {
  if (!error) return 'skill_routing_registry_unavailable';
  if (error.code === 'ENOENT') return 'skill_routing_registry_missing';
  if (error.code === 'SKILL_ROUTING_SCHEMA_INVALID') return 'skill_routing_registry_malformed';
  if (error.name === 'YAMLException') return 'skill_routing_registry_yaml_parse_failed';
  return 'skill_routing_registry_unavailable';
}

function _runtimeDegradationMessage(error) {
  const message = error && error.message ? error.message : String(error || 'unknown error');
  return message.length > 500 ? message.slice(0, 497) + '...' : message;
}

function _logRuntimeDegradation(error, opts, registryPath, durationMs) {
  const o = opts || {};
  if (o.logDegradation === false) return false;
  const root = _repoRootFromOpts(o);
  const state = readState(root) || {};
  const reasonCode = _errorReasonCode(error);
  const row = logGateEvidence(root, {
    signal: DEGRADED_SIGNAL,
    status: 'warn',
    reason_codes: [reasonCode],
    artifacts: [{ kind: 'registry', path: _displayPath(root, registryPath) }],
    evidence: [],
    next_action: 'Inspect skill-routing.yaml; runtime used compiled fallback routes.',
    risk: 'medium',
    duration_ms: Math.max(0, Math.round(durationMs || 0)),
    phase: state.phase || null,
    milestone: state.milestone || null,
    event: SKILL_ROUTING_EVENT,
    decision: 'fallback',
    source: FALLBACK_SOURCE,
    requested_moment: o.moment || (o.runtimeContext && o.runtimeContext.moment) || null,
    requested_mode: o.mode || (o.runtimeContext && o.runtimeContext.mode) || null,
    registry_path: _displayPath(root, registryPath),
    error_message: _runtimeDegradationMessage(error),
  });
  if (!row) _safeWarn('degradation_evidence_append_failed');
  return Boolean(row);
}

function _loadStrict(registryPath) {
  const yaml = _yaml();
  const parsed = yaml.load(fs.readFileSync(registryPath, 'utf8'));
  return _normalizeDocument(parsed, 'yaml', registryPath);
}

function loadSkillRoutingRegistry(opts) {
  const o = opts || {};
  const registryPath = _registryPathFromOpts(o);
  const started = performance.now();
  const cacheKey = registryPath;

  try {
    if (!o.noCache && _cache.has(cacheKey)) return _clone(_cache.get(cacheKey));
    const registry = _loadStrict(registryPath);
    if (!o.noCache) _cache.set(cacheKey, _clone(registry));
    return registry;
  } catch (error) {
    if (!o.runtime) throw error;
    _safeWarn(_errorReasonCode(error) + ': using compiled fallback');
    const fallback = compiledFallbackRegistry();
    fallback.degraded = true;
    fallback.degradation_reason = _errorReasonCode(error);
    fallback.degradation_message = _runtimeDegradationMessage(error);
    fallback.registry_path = registryPath;
    fallback.degradation_logged = _logRuntimeDegradation(error, o, registryPath, performance.now() - started);
    return fallback;
  }
}

function _registryFromInput(input, opts) {
  if (input && Array.isArray(input.routes)) return input;
  if (Array.isArray(input)) return { routes: input };
  return loadSkillRoutingRegistry(opts || {});
}

function _modeMatches(route, mode) {
  return !mode || route.modes.includes(mode);
}

function _routeAvailable(route) {
  return route && route.availability !== 'omitted';
}

function _directiveFor(route) {
  return '/' + route.skill;
}

function toPromptGovernanceRoutes(input, opts) {
  const o = opts || {};
  const registry = _registryFromInput(input, o);
  const mode = o.mode || null;
  const rows = Array.isArray(registry.routes) ? registry.routes : [];
  return rows
    .filter((route) => route.moment === 'prompt-time' && _modeMatches(route, mode) && _routeAvailable(route))
    .filter((route) => route.signatures.phrases.length + route.signatures.regexes.length > 0)
    .map((route) => ({
      id: route.id,
      trigger: {
        phrases: route.signatures.phrases.slice(),
        regexes: route.signatures.regexes.slice(),
      },
      predicate: {},
      enforcement: {
        kind: 'suggestion',
        directive: _directiveFor(route),
      },
      skill: route.skill,
      aliases: route.aliases.slice(),
      availability: route.availability,
      gate_ref: route.gate_ref,
      source: route.source,
    }));
}

function getScheduledRoutes(moment, mode, opts) {
  const registry = opts && opts.registry ? opts.registry : loadSkillRoutingRegistry(opts || {});
  const requestedMoment = moment || (opts && opts.moment) || null;
  const requestedMode = mode || (opts && opts.mode) || null;
  const rows = Array.isArray(registry.routes) ? registry.routes : [];
  return rows
    .filter((route) => (!requestedMoment || route.moment === requestedMoment) && _modeMatches(route, requestedMode) && _routeAvailable(route))
    .map((route) => _clone(route));
}

function resetCache() {
  _cache = new Map();
}

function _fingerprint(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return { exists: true, mtime: stat.mtimeMs, size: stat.size };
  } catch {
    return { exists: false, mtime: 0, size: 0 };
  }
}

function _sameFingerprint(a, b) {
  return a.exists === b.exists && a.mtime === b.mtime && a.size === b.size;
}

function selfTest(opts) {
  const o = opts || {};
  const registryPath = _registryPathFromOpts(o);
  const root = _repoRootFromOpts(o);
  const gateEvidencePath = path.join(root, '.planning', 'metrics', 'gate-evidence.jsonl');
  const before = _fingerprint(gateEvidencePath);
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

  let registry = null;
  try {
    resetCache();
    registry = loadSkillRoutingRegistry({ registryPath, noCache: true });
  } catch (error) {
    console.error('skill-routing-registry self-test: 0 pass, 1 fail');
    console.error('  FAIL: registry schema validation -- ' + error.message);
    return 1;
  }

  assert('1. registry loads from yaml source', registry.source === 'yaml' && registry.degraded === false);
  assert('2. registry has normalized routes', Array.isArray(registry.routes) && registry.routes.length >= 20,
    'route_count=' + (registry.routes && registry.routes.length));
  assert('3. every route has required normalized fields', registry.routes.every((route) => (
    route.id && route.skill && route.signatures && route.moment && route.modes && route.availability
  )));
  assert('4. prompt adapter emits P146-compatible trigger/predicate/enforcement rows', (() => {
    const routes = toPromptGovernanceRoutes(registry, { mode: 'manual' });
    return routes.length > 0
      && routes.every((route) => route.trigger && route.predicate && route.enforcement && route.enforcement.kind === 'suggestion')
      && routes.some((route) => route.enforcement.directive === '/sgsd-token-audit');
  })());
  assert('5. scheduled query filters moment+mode', (() => {
    const phaseAuto = getScheduledRoutes('phase-close', 'auto', { registry });
    const phaseManual = getScheduledRoutes('phase-close', 'manual', { registry });
    return phaseAuto.some((route) => route.skill === 'sgsd-overwatcher')
      && phaseAuto.some((route) => route.skill === 'sgsd-audit')
      && !phaseManual.some((route) => route.skill === 'sgsd-overwatcher');
  })());
  assert('6. compiled fallback preserves prompt token route', (() => {
    const fallback = compiledFallbackRegistry();
    return fallback.source === FALLBACK_SOURCE
      && toPromptGovernanceRoutes(fallback, { mode: 'manual' }).some((route) => route.enforcement.directive === '/sgsd-token-audit');
  })());
  assert('7. compiled fallback preserves phase-close scheduled routes', (() => {
    const fallback = compiledFallbackRegistry();
    const routes = getScheduledRoutes('phase-close', 'auto', { registry: fallback });
    return routes.some((route) => route.skill === 'sgsd-audit') && routes.some((route) => route.skill === 'sgsd-overwatcher');
  })());
  assert('8. schema validation does not modify gate-evidence ledger', _sameFingerprint(before, _fingerprint(gateEvidencePath)));

  console.log('skill-routing-registry self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fail > 0) {
    for (const item of failures) {
      console.error('  FAIL: ' + item.name + (item.detail ? ' -- ' + item.detail : ''));
    }
    return 1;
  }
  return 0;
}

function _parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function _printUsage() {
  console.log('Usage:');
  console.log('  node skill-routing-registry.cjs --self-test [--registry <path>]');
  console.log('  node skill-routing-registry.cjs --runtime-probe --registry <path> --moment <moment> --mode <mode>');
  console.log('');
  console.log('MOMENTS: ' + VALID_MOMENTS.join(', '));
  console.log('MODES:   ' + VALID_MODES.join(', '));
}

function runtimeProbe(args) {
  const moment = args.moment || 'prompt-time';
  const mode = args.mode || 'manual';
  const registryPath = args.registry || DEFAULT_REGISTRY_PATH;
  const registry = loadSkillRoutingRegistry({
    registryPath,
    runtime: true,
    moment,
    mode,
    runtimeContext: { moment, mode },
  });
  const promptRoutes = toPromptGovernanceRoutes(registry, { mode });
  const matchingRows = moment === 'prompt-time'
    ? registry.routes.filter((route) => route.moment === 'prompt-time' && _modeMatches(route, mode) && _routeAvailable(route))
    : getScheduledRoutes(moment, mode, { registry });
  const result = {
    ok: true,
    source: registry.source,
    degraded: Boolean(registry.degraded),
    degradation_reason: registry.degradation_reason || null,
    degradation_logged: Boolean(registry.degradation_logged),
    moment,
    mode,
    route_count: registry.routes.length,
    matching_route_count: matchingRows.length,
    prompt_route_count: promptRoutes.length,
    skills: matchingRows.map((route) => route.skill),
    directives: promptRoutes.map((route) => route.enforcement.directive),
  };
  console.log(JSON.stringify(result, null, 2));
  return 0;
}

if (require.main === module) {
  try {
    const args = _parseArgs(process.argv.slice(2));
    if (args['self-test']) {
      process.exit(selfTest({ registryPath: args.registry }));
    }
    if (args['runtime-probe']) {
      process.exit(runtimeProbe(args));
    }
    _printUsage();
    process.exit(0);
  } catch (error) {
    console.error('skill-routing-registry CLI error: ' + (error && error.message ? error.message : String(error)));
    process.exit(2);
  }
}

module.exports = {
  loadSkillRoutingRegistry,
  toPromptGovernanceRoutes,
  getScheduledRoutes,
  compiledFallbackRegistry,
  resetCache,
  selfTest,
  runtimeProbe,
  DEFAULT_REGISTRY_PATH,
  VALID_MOMENTS,
  VALID_MODES,
  VALID_AVAILABILITY,
  DEGRADED_SIGNAL,
  SKILL_ROUTING_EVENT,
  FALLBACK_SOURCE,
};--- fixture ---
﻿routes:
  - skill: ""
    signatures:
      phrases:
        - token waste
    moment: prompt-time
    modes:
      - manual
    availability: canonical
  - skill: sgsd-token-audit
    signatures:
      regexes:
        - "[unterminated"
    moment: prompt-time
    modes:
      - manual
    availability: canonical```
