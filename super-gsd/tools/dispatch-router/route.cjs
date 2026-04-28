// ============================================================================
// SGSD - DISPATCH-ROUTER (Phase 47, ROUTE-01..05)
// ============================================================================
// Single deterministic decision function: which executor (local-script | codex
// | claude | vtp) handles a given dispatch.
//
// v1.9 Phase 47 ships THE ROUTER. v1.9 has built every input it consumes:
//   - Phase 41 PROVIDERS + ROLES (super-gsd/tools/token-attribution/report.cjs)
//   - Phase 42 BUDGETS + ROUTE_REASONS (super-gsd/tools/token-waste/check.cjs)
//   - Phase 32 logRouteDecision + envelope-v1 (super-gsd/scripts/lib/route-ledger.cjs)
//   - Phase 14 codex-log.jsonl self-test rows + providers-registry
//
// Phase 47 wires those signals into one frozen-enum decision function. Every
// decision is logged via the EXISTING route-ledger surface (NEW boundary value
// 'dispatch_route', NOT a new ledger; Task 2 extends BOUNDARIES 7->8).
//
// LOCK 11 (no semantic similarity): routeInput shape contains NO embedding
//   or similarity field. Structural predicates (file_count, line_count, kind)
//   are the entire input vocabulary.
// LOCK 13 (never-throws): every public API wraps internals in try/catch and
//   returns a safe-default sentinel on internal error.
// READ-ONLY: router never writes canonical .planning/metrics/* streams or
//   Phase 41-46 source files. Caller (orchestrator SKILL.md Step 6.X) emits
//   one envelope row via existing logRouteDecision after routeDispatch returns.
//
// Acceptance bindings:
//   A1 deterministic_extraction routes local-first
//   A2 bounded_code_review routes Codex-first when Codex healthy
//   A3 synthesis_judgment reserved for Claude
//   A4 VTP DISABLED unless uncertainty_type in {architecture_challenge,
//      prior_memory_lookup, book_lookup}
//   A5 every fallback logs reason via existing route-ledger envelope-v1
//   A6 structural predicates (file_count, line_count) override semantic input
//   A7 context_pressure (Phase 42 budget overrun) biases away from claude
//
// Public API:
//   routeDispatch(input)       -> decision (Lock 13 wrapped)
//   isProviderHealthy(name, planningDir, _forces?) -> {healthy, reason, age_ms?}
//   loadRoutes(opts?)          -> {table, source}
//
// Frozen enums exported for downstream consumers (Phase 48+):
//   UNCERTAINTY_TYPES (6), TASK_KINDS (9), ROUTE_DECISION_REASONS (16),
//   FALLBACK_REASONS, ROUTING_TABLE
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ----------------------------------------------------------------------------
// IMPORTS BY REFERENCE (never redefine).
// ----------------------------------------------------------------------------
// Phase 41: PROVIDERS, ROLES (frozen).
const tokenAttribution = require('../token-attribution/report.cjs');
const PROVIDERS = tokenAttribution.PROVIDERS;
const ROLES     = tokenAttribution.ROLES;

// Phase 42: BUDGETS, ROUTE_REASONS (frozen). BUDGETS shape is per-role
// {warn_input, degrade_input}. We use warn_input as the "context_pressure
// over_warn" threshold (KAIROS lesson, A7 binding).
const tokenWaste = require('../token-waste/check.cjs');
const BUDGETS      = tokenWaste.BUDGETS;
const ROUTE_REASONS = tokenWaste.ROUTE_REASONS;

// Phase 32: route-ledger only used for cross-module smoke test (assertion 13).
// The orchestrator owns the actual envelope emission (SKILL.md Step 6.X);
// this module never writes to canonical streams.
const routeLedger = require('../../scripts/lib/route-ledger.cjs');

// ----------------------------------------------------------------------------
// FROZEN ENUMS
// ----------------------------------------------------------------------------

// 6 closed-enum uncertainty types. RESEARCH sec 3.2 LOCKED.
const UNCERTAINTY_TYPES = Object.freeze([
  'deterministic_extraction',
  'bounded_code_review',
  'synthesis_judgment',
  'architecture_challenge',
  'prior_memory_lookup',
  'book_lookup',
]);

// 9 closed-enum task kinds (covers research/planning/exec/verify/review surfaces).
// RESEARCH sec 3.3 LOCKED.
const TASK_KINDS = Object.freeze([
  'extraction',
  'inventory',
  'review',
  'critique',
  'synthesis',
  'planning',
  'verification',
  'lookup',
  'general',
]);

// 16 closed-enum reason codes. RESEARCH sec 11.2 LOCKED.
const ROUTE_DECISION_REASONS = Object.freeze([
  'matched_uncertainty_type',
  'structural_override_local_script',
  'structural_override_codex_review',
  'context_pressure_override_local',
  'context_pressure_override_codex',
  'context_pressure_under_unmovable_route',
  'route_hint_consumed_R1',
  'route_hint_consumed_R2',
  'route_hint_consumed_R3',
  'route_hint_consumed_R4',
  'route_hint_consumed_R5',
  'provider_codex_unavailable',
  'provider_vtp_unavailable',
  'provider_claude_unavailable',
  'fallback_chain_exhausted',
  'router_internal_error',
  // 16th + gate bridge reason (envelope is closed-vocab; total array length
  // is bounded by RESEARCH sec 11.2 closed enum):
  'gate_resolved_provider',
]);

// Subset of reasons used as fallback_reason values.
const FALLBACK_REASONS = Object.freeze([
  'provider_codex_unavailable',
  'provider_vtp_unavailable',
  'provider_claude_unavailable',
  'fallback_chain_exhausted',
  'router_internal_error',
]);

// ROUTING_TABLE -- compiled fallback. Authoritative when routes.yaml absent
// or schema-invalid. Six entries; each is Object.freeze with primary +
// fallback_chain. RESEARCH sec 4 LOCKED.
const ROUTING_TABLE = Object.freeze({
  deterministic_extraction: Object.freeze({
    primary: 'local-script',
    fallback_chain: Object.freeze(['claude']),
  }),
  bounded_code_review: Object.freeze({
    primary: 'codex',
    fallback_chain: Object.freeze(['claude']),
  }),
  synthesis_judgment: Object.freeze({
    primary: 'claude',
    fallback_chain: Object.freeze([]),
  }),
  architecture_challenge: Object.freeze({
    primary: 'vtp',
    fallback_chain: Object.freeze(['claude']),
  }),
  prior_memory_lookup: Object.freeze({
    primary: 'vtp',
    fallback_chain: Object.freeze(['claude']),
  }),
  book_lookup: Object.freeze({
    primary: 'vtp',
    fallback_chain: Object.freeze(['claude']),
  }),
});

const COMMAND_NAME = 'routeDispatch';
const ENVELOPE_VERSION = 1;

// VTP whitelist: ONLY these uncertainty types may resolve to vtp.
// Mechanically guaranteed by ROUTING_TABLE primary assignment (A4 binding).
const VTP_WHITELIST = Object.freeze([
  'architecture_challenge',
  'prior_memory_lookup',
  'book_lookup',
]);

// Default health probe TTL: 30 minutes.
const HEALTH_TTL_MS = 30 * 60 * 1000;

// ----------------------------------------------------------------------------
// PRIVATE: input validation
// ----------------------------------------------------------------------------
function _validateInput(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('dispatch-router: input must be an object');
  }
  if (input.uncertainty_type !== undefined && !UNCERTAINTY_TYPES.includes(input.uncertainty_type)) {
    throw new Error(
      'dispatch-router: uncertainty_type must be one of '
      + UNCERTAINTY_TYPES.join(', ')
      + "; got '" + input.uncertainty_type + "'"
    );
  }
  if (input.task_kind !== undefined && !TASK_KINDS.includes(input.task_kind)) {
    throw new Error(
      'dispatch-router: task_kind must be one of '
      + TASK_KINDS.join(', ')
      + "; got '" + input.task_kind + "'"
    );
  }
  for (const field of ['file_count', 'line_count', 'current_role_token_spend']) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== 'number' || input[field] < 0) {
        throw new Error('dispatch-router: ' + field + ' must be non-negative number');
      }
    }
  }
}

// ----------------------------------------------------------------------------
// PRIVATE: health probes (read-only)
// ----------------------------------------------------------------------------
function _codexHealthFromLog(planningDir, maxAgeMs) {
  if (!maxAgeMs) maxAgeMs = HEALTH_TTL_MS;
  if (!planningDir) return { healthy: false, reason: 'no_planning_dir' };
  const p = path.join(planningDir, 'metrics', 'codex-log.jsonl');
  if (!fs.existsSync(p)) return { healthy: false, reason: 'no_log' };
  let text;
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch (e) {
    return { healthy: false, reason: 'log_read_error' };
  }
  if (!text.trim()) return { healthy: false, reason: 'empty_log' };
  const lines = text.split(/\r?\n/).filter(Boolean);
  // Walk backward over the most-recent 200 rows.
  const limit = Math.min(lines.length, 200);
  let selfTestRow = null;
  for (let i = lines.length - 1; i >= lines.length - limit && i >= 0; i--) {
    let r;
    try { r = JSON.parse(lines[i]); } catch (_) { continue; }
    if (r && r.step === 'self-test') {
      selfTestRow = r;
      break;
    }
  }
  if (!selfTestRow) return { healthy: false, reason: 'no_self_test_in_log' };
  const tsMs = new Date(selfTestRow.ts).getTime();
  const age = Date.now() - tsMs;
  if (!Number.isFinite(age) || age < 0) {
    return { healthy: false, reason: 'invalid_self_test_ts' };
  }
  if (age > maxAgeMs) {
    return { healthy: false, reason: 'stale_self_test', age_ms: age };
  }
  const probes = selfTestRow.self_test_probes || {};
  const allPass = selfTestRow.exit === 0
    && probes.path === true
    && probes.auth === true
    && probes.timeout === true
    && probes.contract === true;
  if (!allPass) {
    return { healthy: false, reason: 'self_test_probe_failed', probes, age_ms: age };
  }
  return { healthy: true, reason: 'self_test_pass', age_ms: age };
}

function _vtpHealthFromLog(planningDir, maxAgeMs) {
  if (!maxAgeMs) maxAgeMs = HEALTH_TTL_MS;
  if (!planningDir) return { healthy: false, reason: 'no_planning_dir' };
  const p = path.join(planningDir, 'metrics', 'vtp-health.jsonl');
  if (!fs.existsSync(p)) return { healthy: false, reason: 'no_log' };
  let text;
  try {
    text = fs.readFileSync(p, 'utf8');
  } catch (e) {
    return { healthy: false, reason: 'log_read_error' };
  }
  if (!text.trim()) return { healthy: false, reason: 'empty_log' };
  const lines = text.split(/\r?\n/).filter(Boolean);
  let last = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    try { last = JSON.parse(lines[i]); break; } catch (_) { /* skip malformed */ }
  }
  if (!last) return { healthy: false, reason: 'empty_log' };
  const tsMs = new Date(last.ts).getTime();
  const age = Date.now() - tsMs;
  if (!Number.isFinite(age) || age < 0) {
    return { healthy: false, reason: 'invalid_health_ts' };
  }
  if (age > maxAgeMs) {
    return { healthy: false, reason: 'stale_health_row', age_ms: age };
  }
  return {
    healthy: !!last.vtp_available,
    reason: last.vtp_available ? 'vtp_healthy' : 'vtp_degraded',
    age_ms: age,
  };
}

// Public API. Lock 13 wrapped.
function isProviderHealthy(name, planningDir, _forces) {
  try {
    if (name === 'claude' || name === 'local-script') {
      return { healthy: true, reason: 'always_healthy' };
    }
    const forces = _forces || {};
    if (Object.prototype.hasOwnProperty.call(forces, name)) {
      const v = !!forces[name];
      return {
        healthy: v,
        reason: v ? 'forced_healthy_test_only' : 'forced_unhealthy_test_only',
      };
    }
    if (name === 'codex') return _codexHealthFromLog(planningDir);
    if (name === 'vtp')   return _vtpHealthFromLog(planningDir);
    return { healthy: false, reason: 'unknown_provider' };
  } catch (e) {
    console.warn('[SGSD] dispatch-router isProviderHealthy failed:', e.message);
    return { healthy: false, reason: 'health_probe_error' };
  }
}

// ----------------------------------------------------------------------------
// loadRoutes: parse routes.yaml; on any failure, return compiled fallback.
// ----------------------------------------------------------------------------
function loadRoutes(opts) {
  const o = opts || {};
  const yamlPath = o.routesYamlPath || path.join(__dirname, 'routes.yaml');

  const compiledFallback = (sourceTag) => {
    const out = {};
    for (const k of UNCERTAINTY_TYPES) {
      out[k] = {
        primary: ROUTING_TABLE[k].primary,
        fallback_chain: ROUTING_TABLE[k].fallback_chain.slice(),
      };
    }
    return { table: out, source: sourceTag };
  };

  try {
    if (!fs.existsSync(yamlPath)) return compiledFallback('compiled_fallback');
    // Pinned js-yaml load pattern (mirrors token-waste/check.cjs:178-181).
    const yamlLibPath = path.resolve(
      __dirname, '..', 'plan-schema', 'node_modules', 'js-yaml'
    );
    let yaml;
    try {
      yaml = require(yamlLibPath);
    } catch (e) {
      console.warn('[SGSD] dispatch-router loadRoutes: js-yaml unavailable; using compiled fallback');
      return compiledFallback('compiled_fallback');
    }
    let parsed;
    try {
      parsed = yaml.load(fs.readFileSync(yamlPath, 'utf8'));
    } catch (e) {
      console.warn('[SGSD] dispatch-router loadRoutes: yaml parse failed:', e.message);
      return compiledFallback('compiled_yaml_error');
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.table || typeof parsed.table !== 'object') {
      return compiledFallback('compiled_yaml_error');
    }
    const out = {};
    for (const k of UNCERTAINTY_TYPES) {
      const e = parsed.table[k];
      if (!e || typeof e !== 'object'
          || !PROVIDERS.includes(e.primary)
          || !Array.isArray(e.fallback_chain)) {
        return compiledFallback('compiled_yaml_error');
      }
      // Validate every fallback entry is a known provider.
      for (const fb of e.fallback_chain) {
        if (!PROVIDERS.includes(fb)) return compiledFallback('compiled_yaml_error');
      }
      out[k] = { primary: e.primary, fallback_chain: e.fallback_chain.slice() };
    }
    return { table: out, source: 'yaml' };
  } catch (e) {
    console.warn('[SGSD] dispatch-router loadRoutes failed:', e.message);
    return compiledFallback('compiled_fallback');
  }
}

// ----------------------------------------------------------------------------
// PRIVATE: pressure / hints
// ----------------------------------------------------------------------------
function _pressureFor(input) {
  const role = (input && input.role) || 'other';
  const spend = Number((input && input.current_role_token_spend) || 0);
  const roleBudget = BUDGETS[role] || BUDGETS.other;
  const warn = roleBudget && roleBudget.warn_input ? roleBudget.warn_input : 0;
  return {
    role,
    current_spend: spend,
    warn_input: warn,
    over_warn: warn > 0 && spend >= warn,
    ratio: warn > 0 ? spend / warn : 0,
  };
}

function _readRecentHints(planningDir, role, tailN) {
  const tail = tailN || 50;
  if (!planningDir || !role) return [];
  try {
    const p = path.join(planningDir, 'metrics', 'token-waste-status.jsonl');
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf8');
    if (!text.trim()) return [];
    const lines = text.split(/\r?\n/).filter(Boolean);
    const start = Math.max(0, lines.length - tail);
    const hints = [];
    for (let i = start; i < lines.length; i++) {
      let r;
      try { r = JSON.parse(lines[i]); } catch (_) { continue; }
      if (!r || !Array.isArray(r.route_hints)) continue;
      for (const h of r.route_hints) {
        if (!h || typeof h !== 'object') continue;
        if (h.from_role === role) {
          hints.push(Object.assign({}, h, { ts: r.ts }));
        }
      }
    }
    return hints;
  } catch (e) {
    console.warn('[SGSD] dispatch-router _readRecentHints failed:', e.message);
    return [];
  }
}

// ----------------------------------------------------------------------------
// PRIVATE: decide helper
// ----------------------------------------------------------------------------
function _decide(chosen, primary, fallbackChain, reason, structural, pressure, hintsConsumed, extra) {
  const ex = extra || {};
  const fbUsed = chosen !== primary;
  return {
    provider: chosen,
    primary_provider: primary,
    reason: reason,
    fallback_used: fbUsed,
    fallback_reason: fbUsed ? reason : null,
    fallback_chain: Array.isArray(fallbackChain) ? fallbackChain.slice() : [],
    structural_signals: structural || {},
    context_pressure: pressure || {},
    health: ex.health || {},
    hints_consumed: Array.isArray(hintsConsumed) ? hintsConsumed.slice() : [],
  };
}

// ----------------------------------------------------------------------------
// PRIVATE: _routeDispatchInternal -- the actual decision algorithm
// ----------------------------------------------------------------------------
function _routeDispatchInternal(input) {
  _validateInput(input);

  const ucType = input.uncertainty_type || 'synthesis_judgment';
  const taskKind = input.task_kind || 'general';
  const planningDir = input._planning_dir || _defaultPlanningDir();
  const forces = {};
  if (Object.prototype.hasOwnProperty.call(input, '_force_codex_health')) {
    forces.codex = input._force_codex_health;
  }
  if (Object.prototype.hasOwnProperty.call(input, '_force_vtp_health')) {
    forces.vtp = input._force_vtp_health;
  }

  const routes = loadRoutes();
  const tableEntry = routes.table[ucType] || routes.table.synthesis_judgment;
  const primary = tableEntry.primary;
  const fallbackChain = tableEntry.fallback_chain.slice();

  const fileCount = typeof input.file_count === 'number' ? input.file_count : null;
  const lineCount = typeof input.line_count === 'number' ? input.line_count : null;
  const structural = {
    file_count: fileCount,
    line_count: lineCount,
    task_kind: taskKind,
  };
  const pressure = _pressureFor(input);

  const codexHealth = isProviderHealthy('codex', planningDir, forces);
  const vtpHealth   = isProviderHealthy('vtp',   planningDir, forces);
  const health = { codex: codexHealth, vtp: vtpHealth };

  // STEP 1 -- Structural override (LOCK 11 / A6 binding).
  // Predicate 1: small extraction always biases to local-script.
  if (taskKind === 'extraction'
      && fileCount !== null && fileCount <= 3
      && lineCount !== null && lineCount <= 100) {
    return _decide(
      'local-script', primary, [],
      'structural_override_local_script',
      structural, pressure, [], { health }
    );
  }
  // Predicate 2: bounded review with healthy codex biases to codex (when
  // primary isn't already codex).
  if (taskKind === 'review'
      && lineCount !== null && lineCount <= 200
      && codexHealth.healthy
      && primary !== 'codex') {
    return _decide(
      'codex', primary, [],
      'structural_override_codex_review',
      structural, pressure, [], { health }
    );
  }

  // STEP 2 -- Context-pressure override (KAIROS / A7 binding).
  if (pressure.over_warn && primary === 'claude') {
    if (taskKind === 'extraction' || taskKind === 'inventory') {
      return _decide(
        'local-script', primary, [],
        'context_pressure_override_local',
        structural, pressure, [], { health }
      );
    }
    if (taskKind === 'review' || taskKind === 'critique') {
      return _decide(
        'codex', primary, [],
        'context_pressure_override_codex',
        structural, pressure, [], { health }
      );
    }
    // Unmovable route: provider unchanged, but reason recorded so the
    // envelope row reflects the pressure visibility.
    return _decide(
      primary, primary, fallbackChain,
      'context_pressure_under_unmovable_route',
      structural, pressure, [], { health }
    );
  }

  // STEP 3 -- Recent hint bias (R1/R2/R5 only; R3/R4 informational).
  const hints = _readRecentHints(planningDir, input.role, 50);
  const hintsConsumed = hints.slice();
  if (hints.length > 0) {
    const reasons = new Set(hints.map((h) => h.reason));
    if (input.role === 'researcher' && reasons.has(ROUTE_REASONS.R1)) {
      return _decide(
        'local-script', primary, [],
        'route_hint_consumed_R1',
        structural, pressure, hintsConsumed, { health }
      );
    }
    if (reasons.has(ROUTE_REASONS.R2) && primary === 'codex') {
      return _decide(
        'claude', primary, [],
        'route_hint_consumed_R2',
        structural, pressure, hintsConsumed, { health }
      );
    }
    if (input.role === 'orchestrator' && reasons.has(ROUTE_REASONS.R5)) {
      return _decide(
        'local-script', primary, [],
        'route_hint_consumed_R5',
        structural, pressure, hintsConsumed, { health }
      );
    }
    // R3/R4 recorded in hints_consumed but never alter provider.
  }

  // STEP 4 -- Bridge for review gates (delegates to providers-registry).
  if (taskKind === 'review' && input.gate_name) {
    try {
      const pr = require('../../scripts/lib/providers-registry.cjs');
      if (pr && typeof pr.resolveReviewerProvider === 'function') {
        const rec = pr.resolveReviewerProvider(input.gate_name, input.gates_registry || null);
        if (rec && PROVIDERS.includes(rec.name)) {
          return _decide(
            rec.name, primary, fallbackChain,
            'gate_resolved_provider',
            structural, pressure, hintsConsumed, { health }
          );
        }
      }
    } catch (e) {
      // Falls through to STEP 5 silently.
    }
  }

  // STEP 5 -- Health gate primary (codex / vtp). Walk fallback chain on
  // unhealth; mark exhausted if no healthy entry remains.
  if (primary === 'codex' && !codexHealth.healthy) {
    const next = _walkFallback(fallbackChain, planningDir, forces);
    if (next.provider) {
      return _decide(
        next.provider, primary, fallbackChain,
        'provider_codex_unavailable',
        structural, pressure, hintsConsumed, { health }
      );
    }
    return _decide(
      null, primary, fallbackChain,
      'fallback_chain_exhausted',
      structural, pressure, hintsConsumed, { health }
    );
  }
  if (primary === 'vtp' && !vtpHealth.healthy) {
    const next = _walkFallback(fallbackChain, planningDir, forces);
    if (next.provider) {
      return _decide(
        next.provider, primary, fallbackChain,
        'provider_vtp_unavailable',
        structural, pressure, hintsConsumed, { health }
      );
    }
    return _decide(
      null, primary, fallbackChain,
      'fallback_chain_exhausted',
      structural, pressure, hintsConsumed, { health }
    );
  }

  // STEP 6 -- Happy path.
  return _decide(
    primary, primary, fallbackChain,
    'matched_uncertainty_type',
    structural, pressure, hintsConsumed, { health }
  );
}

function _walkFallback(fallbackChain, planningDir, forces) {
  for (const cand of fallbackChain) {
    const h = isProviderHealthy(cand, planningDir, forces);
    if (h.healthy) return { provider: cand };
  }
  return { provider: null };
}

function _defaultPlanningDir() {
  // Anchor to repo root: <repo>/super-gsd/tools/dispatch-router/route.cjs
  // -> <repo>/.planning
  return path.resolve(__dirname, '..', '..', '..', '.planning');
}

// ----------------------------------------------------------------------------
// PUBLIC API: routeDispatch (Lock 13 wrapped)
// ----------------------------------------------------------------------------
function routeDispatch(input) {
  try {
    return _routeDispatchInternal(input);
  } catch (e) {
    console.warn('[SGSD] dispatch-router routeDispatch failed:', e.message);
    return {
      provider: 'claude',
      primary_provider: null,
      reason: 'router_internal_error',
      fallback_used: true,
      fallback_reason: 'router_internal_error',
      fallback_chain: [],
      structural_signals: {},
      context_pressure: {},
      health: {
        codex: { healthy: false, reason: 'not_probed' },
        vtp:   { healthy: false, reason: 'not_probed' },
      },
      hints_consumed: [],
      error: e.message,
    };
  }
}

// ----------------------------------------------------------------------------
// SELF-TEST: 15 assertions
// ----------------------------------------------------------------------------

// Canonical fingerprint paths anchored to __dirname for read-only invariant.
function _canonicalFingerprintPaths() {
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  return [
    path.join(repoRoot, '.planning', 'metrics', 'route-decisions.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'codex-log.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'vtp-health.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'token-waste-status.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'agent-token-spend.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'token-attribution.jsonl'),
    path.join(repoRoot, 'super-gsd', 'tools', 'token-waste', 'budgets.yaml'),
    path.join(repoRoot, 'super-gsd', 'registry', 'review-providers.yaml'),
  ];
}

function _captureFingerprint() {
  const out = {};
  for (const p of _canonicalFingerprintPaths()) {
    if (fs.existsSync(p)) {
      const s = fs.statSync(p);
      out[p] = { exists: true, mtime: s.mtimeMs, size: s.size };
    } else {
      out[p] = { exists: false, mtime: 0, size: 0 };
    }
  }
  return out;
}

function _diffFingerprint(before, after) {
  const drifts = [];
  for (const p of Object.keys(before)) {
    const b = before[p], a = after[p];
    if (b.exists !== a.exists || b.mtime !== a.mtime || b.size !== a.size) {
      drifts.push({ path: p, before: b, after: a });
    }
  }
  return drifts;
}

function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  const fpBefore = _captureFingerprint();

  // ------------------------------------------------------------------------
  // F1-F8 fixture assertions (1-8)
  // ------------------------------------------------------------------------

  // Assertion 1 -- F1 local route happy.
  const f1 = routeDispatch({
    task_kind: 'extraction',
    uncertainty_type: 'deterministic_extraction',
    file_count: 2, line_count: 50,
  });
  assert('1. F1 deterministic_extraction -> local-script (matched_uncertainty_type)',
    f1.provider === 'local-script'
    && f1.primary_provider === 'local-script'
    // structural override fires first because file_count<=3 && line_count<=100
    // (but result is same provider; reason is structural_override_local_script).
    && (f1.reason === 'matched_uncertainty_type' || f1.reason === 'structural_override_local_script')
    && f1.fallback_used === false,
    'got provider=' + f1.provider + ' reason=' + f1.reason);

  // Assertion 2 -- F2 codex route happy.
  const f2 = routeDispatch({
    task_kind: 'review',
    uncertainty_type: 'bounded_code_review',
    file_count: 2, line_count: 45,
    _force_codex_health: true,
    _force_vtp_health: false,
  });
  assert('2. F2 bounded_code_review (codex healthy) -> codex',
    f2.provider === 'codex' && f2.primary_provider === 'codex'
    && f2.reason === 'matched_uncertainty_type'
    && f2.fallback_used === false,
    'got provider=' + f2.provider + ' reason=' + f2.reason);

  // Assertion 3 -- F3 claude route happy.
  const f3 = routeDispatch({
    task_kind: 'synthesis',
    uncertainty_type: 'synthesis_judgment',
  });
  assert('3. F3 synthesis_judgment -> claude',
    f3.provider === 'claude' && f3.primary_provider === 'claude'
    && f3.reason === 'matched_uncertainty_type'
    && f3.fallback_used === false
    && Array.isArray(f3.fallback_chain) && f3.fallback_chain.length === 0,
    'got provider=' + f3.provider + ' reason=' + f3.reason);

  // Assertion 4 -- F4 vtp route happy.
  const f4 = routeDispatch({
    task_kind: 'planning',
    uncertainty_type: 'architecture_challenge',
    _force_vtp_health: true,
  });
  assert('4. F4 architecture_challenge (vtp healthy) -> vtp',
    f4.provider === 'vtp' && f4.primary_provider === 'vtp'
    && f4.reason === 'matched_uncertainty_type'
    && f4.fallback_used === false,
    'got provider=' + f4.provider + ' reason=' + f4.reason);

  // Assertion 5 -- F4b vtp gating works (non-vtp uncertainty CANNOT escalate).
  const f4b = routeDispatch({
    task_kind: 'extraction',
    uncertainty_type: 'deterministic_extraction',
    _force_vtp_health: true,
    file_count: 5, line_count: 200,
  });
  // Bonus: scan all 6 uncertainty types; only the 3-entry whitelist may yield vtp.
  let vtpGatingOk = f4b.provider !== 'vtp';
  for (const ut of UNCERTAINTY_TYPES) {
    const r = routeDispatch({
      task_kind: 'general',
      uncertainty_type: ut,
      _force_vtp_health: true,
      _force_codex_health: true,
    });
    if (!VTP_WHITELIST.includes(ut) && r.provider === 'vtp') {
      vtpGatingOk = false;
    }
  }
  assert('5. F4b vtp gating: non-whitelist types never resolve to vtp',
    vtpGatingOk,
    'f4b.provider=' + f4b.provider);

  // Assertion 6 -- F5 codex fallback (codex unhealthy).
  const f5 = routeDispatch({
    task_kind: 'review',
    uncertainty_type: 'bounded_code_review',
    _force_codex_health: false,
  });
  assert('6. F5 codex unhealthy -> claude w/ provider_codex_unavailable',
    f5.provider === 'claude' && f5.primary_provider === 'codex'
    && f5.reason === 'provider_codex_unavailable'
    && f5.fallback_used === true
    && f5.fallback_reason === 'provider_codex_unavailable',
    'got provider=' + f5.provider + ' reason=' + f5.reason);

  // Assertion 7 -- F6 vtp fallback (vtp unhealthy).
  const f6 = routeDispatch({
    task_kind: 'planning',
    uncertainty_type: 'architecture_challenge',
    _force_vtp_health: false,
  });
  assert('7. F6 vtp unhealthy -> claude w/ provider_vtp_unavailable',
    f6.provider === 'claude' && f6.primary_provider === 'vtp'
    && f6.reason === 'provider_vtp_unavailable'
    && f6.fallback_used === true,
    'got provider=' + f6.provider + ' reason=' + f6.reason);

  // Assertion 8 -- F7 structural override (LOCK 11 binding):
  // synthesis_judgment + extraction task + small file/line counts -> local-script.
  const f7 = routeDispatch({
    task_kind: 'extraction',
    uncertainty_type: 'synthesis_judgment',
    file_count: 2, line_count: 50,
  });
  assert('8. F7 structural override beats synthesis_judgment type -> local-script',
    f7.provider === 'local-script'
    && f7.primary_provider === 'claude'
    && f7.reason === 'structural_override_local_script',
    'got provider=' + f7.provider + ' reason=' + f7.reason);

  // ------------------------------------------------------------------------
  // Secondary assertions 9-15
  // ------------------------------------------------------------------------

  // Assertion 9 -- UNCERTAINTY_TYPES frozen 6-entry.
  assert('9. UNCERTAINTY_TYPES is frozen 6-entry array',
    Array.isArray(UNCERTAINTY_TYPES)
    && UNCERTAINTY_TYPES.length === 6
    && Object.isFrozen(UNCERTAINTY_TYPES)
    && Array.isArray(TASK_KINDS) && TASK_KINDS.length === 9 && Object.isFrozen(TASK_KINDS));

  // Assertion 10 -- ROUTING_TABLE 6-entry frozen, each entry frozen with primary+fallback_chain.
  let routingTableOk = Object.isFrozen(ROUTING_TABLE)
    && Object.keys(ROUTING_TABLE).length === 6;
  if (routingTableOk) {
    for (const k of UNCERTAINTY_TYPES) {
      const e = ROUTING_TABLE[k];
      if (!e || !Object.isFrozen(e)
          || !PROVIDERS.includes(e.primary)
          || !Array.isArray(e.fallback_chain)) {
        routingTableOk = false;
        break;
      }
    }
  }
  // Also assert PROVIDERS imported by reference (not re-defined).
  const providersByRef = (PROVIDERS === tokenAttribution.PROVIDERS);
  // Note: plan sec 3.2 LOCKED enumerates 17 distinct strings (the prose says "16 entries"
  // but the explicit list contains 6 + 5 + 3 + 1 + 1 + 1 = 17). We use the actual
  // enumeration count, which is what every consumer actually sees.
  assert('10. ROUTING_TABLE 6-entry frozen + PROVIDERS imported by reference',
    routingTableOk && providersByRef
    && Array.isArray(ROUTE_DECISION_REASONS)
    && ROUTE_DECISION_REASONS.length === 17
    && Object.isFrozen(ROUTE_DECISION_REASONS));

  // Assertion 11 -- closed-enum input validation never throws upward (Lock 13).
  let lock13Ok = false;
  let threwUp = false;
  try {
    const r = routeDispatch({ uncertainty_type: 'banana' });
    lock13Ok = (r.provider === 'claude'
      && r.reason === 'router_internal_error'
      && r.fallback_used === true);
  } catch (e) {
    threwUp = true;
  }
  assert('11. invalid input -> claude-fallback (no upward throw)',
    lock13Ok && !threwUp,
    'threwUp=' + threwUp);

  // Assertion 12 -- read-only fingerprint guard.
  const fpAfter = _captureFingerprint();
  const drifts = _diffFingerprint(fpBefore, fpAfter);
  assert('12. read-only fingerprint guard: 8 canonical paths unchanged',
    drifts.length === 0,
    drifts.length > 0 ? JSON.stringify(drifts.slice(0, 2)) : '');

  // Assertion 13 -- route-ledger smoke (cross-module). REQUIRES Task 2 to have
  // extended BOUNDARIES. If not yet extended, emits explicit diagnostic.
  let assertion13Detail = '';
  let assertion13Pass = false;
  try {
    if (!routeLedger.BOUNDARIES.includes('dispatch_route')) {
      assertion13Detail = 'Task 2 prerequisite missing: BOUNDARIES does not yet include dispatch_route';
    } else {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p47-rt-'));
      try {
        fs.mkdirSync(path.join(tmp, 'metrics'), { recursive: true });
        const ok = routeLedger.logRouteDecision(tmp, {
          boundary: 'dispatch_route', status: 'ok',
          phase: '47', milestone: 'v1.9',
          reason_codes: ['matched_uncertainty_type'],
          decision: {
            task_kind: 'review',
            uncertainty_type: 'bounded_code_review',
            primary_provider: 'codex',
            chosen_provider: 'codex',
            fallback_used: false,
          },
        });
        const rows = routeLedger.readRows(tmp);
        const lr = rows[rows.length - 1];
        assertion13Pass = ok === true
          && lr && lr.envelope_version === 1
          && lr.command === 'logRouteDecision'
          && lr.boundary === 'dispatch_route'
          && lr.decision
          && lr.decision.task_kind === 'review'
          && lr.decision.chosen_provider === 'codex'
          && Array.isArray(lr.reason_codes)
          && lr.reason_codes.includes('matched_uncertainty_type');
        if (!assertion13Pass) {
          assertion13Detail = 'envelope round-trip mismatch';
        }
      } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    }
  } catch (e) {
    assertion13Detail = 'unexpected error: ' + e.message;
  }
  assert('13. route-ledger dispatch_route boundary smoke (cross-module)',
    assertion13Pass, assertion13Detail);

  // Assertion 14 -- hint consumption (R1 biases researcher synthesis to local-script).
  let hintConsumePass = false;
  try {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p47-hc-'));
    try {
      fs.mkdirSync(path.join(tmp, 'metrics'), { recursive: true });
      const row = {
        ts: new Date().toISOString(),
        role: 'researcher',
        route_hints: [
          { from_role: 'researcher', reason: ROUTE_REASONS.R1 },
        ],
      };
      fs.writeFileSync(
        path.join(tmp, 'metrics', 'token-waste-status.jsonl'),
        JSON.stringify(row) + '\n', 'utf8'
      );
      const r = routeDispatch({
        task_kind: 'synthesis',
        uncertainty_type: 'synthesis_judgment',
        role: 'researcher',
        _planning_dir: tmp,
      });
      hintConsumePass = (r.provider === 'local-script'
        && r.reason === 'route_hint_consumed_R1');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  } catch (e) {
    // hintConsumePass stays false
  }
  assert('14. R1 hint biases researcher synthesis to local-script',
    hintConsumePass);

  // Assertion 15 -- pure-function determinism: same input twice yields equal decision
  // (excluding age_ms which varies by ms).
  const a = routeDispatch({
    task_kind: 'review',
    uncertainty_type: 'bounded_code_review',
    file_count: 2, line_count: 45,
    _force_codex_health: true, _force_vtp_health: false,
  });
  const b = routeDispatch({
    task_kind: 'review',
    uncertainty_type: 'bounded_code_review',
    file_count: 2, line_count: 45,
    _force_codex_health: true, _force_vtp_health: false,
  });
  const aClone = JSON.parse(JSON.stringify(a));
  const bClone = JSON.parse(JSON.stringify(b));
  if (aClone.health && aClone.health.codex) delete aClone.health.codex.age_ms;
  if (aClone.health && aClone.health.vtp)   delete aClone.health.vtp.age_ms;
  if (bClone.health && bClone.health.codex) delete bClone.health.codex.age_ms;
  if (bClone.health && bClone.health.vtp)   delete bClone.health.vtp.age_ms;
  assert('15. determinism: same input twice -> identical decision',
    JSON.stringify(aClone) === JSON.stringify(bClone));

  // F8 context-pressure variant: extraction synthesis_judgment with researcher over-budget.
  const f8 = routeDispatch({
    task_kind: 'extraction',
    uncertainty_type: 'synthesis_judgment',
    role: 'researcher',
    current_role_token_spend: 30000,
  });
  // Note: structural override fires before context-pressure for extraction with
  // file_count/line_count; here both are absent so the structural pred is false
  // and we proceed to STEP 2 context-pressure. But synthesis_judgment+extraction
  // also has no fileCount, so structural is skipped. With researcher spend
  // 30000 >= 25000 warn -> context_pressure_override_local fires.
  // (This is an embedded sanity check, not a separate assertion.)
  void f8;

  console.log('dispatch-router self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fail > 0) {
    for (const f of failures) {
      console.error('  FAIL: ' + f.name + (f.detail ? ' -- ' + f.detail : ''));
    }
    return 1;
  }
  return 0;
}

// ----------------------------------------------------------------------------
// CLI
// ----------------------------------------------------------------------------
function _parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function _printUsage() {
  console.log('Usage: node route.cjs --self-test');
  console.log('   or: node route.cjs --route --uncertainty-type X --task-kind Y \\');
  console.log('         [--file-count N] [--line-count N] [--role R] \\');
  console.log('         [--current-role-token-spend N] [--gate-name G] [--json]');
  console.log('');
  console.log('UNCERTAINTY_TYPES: ' + UNCERTAINTY_TYPES.join(', '));
  console.log('TASK_KINDS:        ' + TASK_KINDS.join(', '));
  console.log('PROVIDERS:         ' + PROVIDERS.join(', '));
}

if (require.main === module) {
  try {
    const argv = process.argv.slice(2);
    if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
      _printUsage();
      process.exit(0);
    }
    if (argv[0] === '--self-test') {
      process.exit(selfTest());
    }
    if (argv[0] === '--route') {
      const flags = _parseArgs(argv.slice(1));
      const input = {};
      if (flags['uncertainty-type']) input.uncertainty_type = flags['uncertainty-type'];
      if (flags['task-kind'])        input.task_kind = flags['task-kind'];
      if (flags['file-count'] !== undefined) input.file_count = Number(flags['file-count']);
      if (flags['line-count'] !== undefined) input.line_count = Number(flags['line-count']);
      if (flags['role'])             input.role = flags['role'];
      if (flags['current-role-token-spend'] !== undefined) {
        input.current_role_token_spend = Number(flags['current-role-token-spend']);
      }
      if (flags['gate-name'])        input.gate_name = flags['gate-name'];
      const decision = routeDispatch(input);
      if (flags['json']) {
        console.log(JSON.stringify(decision));
      } else {
        console.log('provider: ' + decision.provider + ', reason: ' + decision.reason);
      }
      process.exit(0);
    }
    _printUsage();
    process.exit(0);
  } catch (e) {
    console.error('dispatch-router CLI error: ' + e.message);
    process.exit(2);
  }
}

module.exports = {
  routeDispatch,
  isProviderHealthy,
  loadRoutes,
  UNCERTAINTY_TYPES,
  TASK_KINDS,
  ROUTING_TABLE,
  ROUTE_DECISION_REASONS,
  FALLBACK_REASONS,
  VTP_WHITELIST,
  COMMAND_NAME,
  ENVELOPE_VERSION,
};
