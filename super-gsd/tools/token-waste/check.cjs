// ============================================================================
// SGSD - TOKEN-WASTE ADMISSION CHECK (Phase 42 -- BUDGET-01..05)
// ============================================================================
// Source of truth: read-only verdict producer over Phase 41
// .planning/metrics/agent-token-spend.jsonl ledger; admission gate that
// makes bloat visible without halting autonomy.
//
// Sources:
//   42-RESEARCH.md sec 4 (verdict matrix), sec 5 (cross-phase contract),
//   sec 6 (budget table), sec 7 (self-test design),
//   sec 8 (hard-stop separation), sec 9 (read-only invariant),
//   sec 11 (single plan recommendation).
//   .planning/milestones/v1.9/REQUIREMENTS.md:67-68 (design lock 13 verbatim)
//   .planning/milestones/v1.9/REQUIREMENTS.md:100-109 (BUDGET-01..05 verbatim)
//
// Architectural mirrors:
//   super-gsd/tools/token-attribution/report.cjs (Phase 41 upstream;
//     IMPORTS summarize, BLOAT_THRESHOLDS, ROLES, STATUSES, PROVIDERS,
//     ledgerPath BY REFERENCE -- never redefined).
//   super-gsd/tools/gate-keep-kill/rubric.cjs (Phase 39; read-only check
//     + closed-enum verdict + renderTable shape).
//   super-gsd/scripts/lib/gate-value-log.cjs (Phase 36; envelope-v1 writer
//     + _normalize + _assertEnvelopeV1 + never-throws-upward + RUN_ID_REGEX).
//   super-gsd/skills/sgsd-complete-milestone/SKILL.md:96-172 (Step 4.5/4.6
//     wire-in template that Step 4.7 mirrors).
//
// Controlling correctness rule (REQUIREMENTS.md:67-68 design lock 13):
//   "Autonomy continues; evidence tells the truth. Budget breaches
//    degrade or reroute by policy. They do not become silent overrun."
//
// Mechanical embodiment of lock 13:
//   - VERDICTS = {ok, warn, degraded, false_positive}; NO 'blocked'.
//   - degraded verdict -> envelope.status='warn' (NEVER 'blocked').
//   - CLI --check exits 0 regardless of verdict; only bad invocation
//     exits 2 (closed-flag parser, see CLI section).
//   - Self-test fixture F3 binds the regression: a researcher row with
//     input_total=30000, cache=99%, findings=5 produces verdict='degraded'
//     AND envelope.status='warn' AND route_hint.reason=
//     'researcher_local_script_candidate'.
//
// Failure contract (mirrored from rubric.cjs:10-13 + gate-value-log.cjs:51-55):
//   "this script NEVER throws upward at the orchestrator boundary"
//   All public APIs (runCheck, renderTable, appendCheckRun) wrap internals
//   in try/catch; on error stderr-warn + return falsey sentinel.
//
// Read-only invariant (LOCK 4 / dead-end #4):
//   Phase 42 NEVER writes to:
//     .planning/metrics/agent-token-spend.jsonl    (Phase 41 owner)
//     .planning/metrics/token-attribution.jsonl    (collect.cjs owner)
//     .planning/metrics/codex-log.jsonl            (codex-exec.sh owner)
//     .planning/metrics/token-log.jsonl            (legacy SGSD owner)
//     .planning/metrics/activity-log.jsonl         (runtime activity owner)
//     super-gsd/tools/token-waste/budgets.yaml     (config; never written)
//   Owned writes:
//     .planning/metrics/token-waste-status.jsonl   (append-only envelope-v1)
//     .planning/milestones/{id}/token-waste.md     (overwrite per close run)
//
// Acceptance bindings:
//   BUDGET-01: tool path super-gsd/tools/token-waste/check.cjs exists.
//   BUDGET-02: 8 per-role budgets in budgets.yaml + compiled BUDGETS const.
//   BUDGET-03: bloat-signature inherits Phase 41 BLOAT_THRESHOLDS by reference
//              (cache_read_ratio_high=0.90, useful_findings_low=15).
//   BUDGET-04: SKILL.md Step 4.7 wire-in present; soft-warn / degrade only;
//              never halts close.
//   BUDGET-05: token-waste-status.jsonl envelope-v1 rows + token-waste.md
//              renders for cockpit/report consumption.
//
// No external dependencies beyond the pinned js-yaml at
// super-gsd/tools/plan-schema/node_modules/js-yaml (loaded inside
// _loadBudgets via the gates-registry.cjs:38-44 pattern; never throws
// upward on poisoned config).
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ----------------------------------------------------------------------------
// PHASE 41 UPSTREAM IMPORTS (RESEARCH sec 5.1) -- BY REFERENCE; never redefined
// ----------------------------------------------------------------------------
const {
  summarize,
  BLOAT_THRESHOLDS,
  ROLES,
  STATUSES,
  PROVIDERS,
  ledgerPath,
} = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));

// ----------------------------------------------------------------------------
// FROZEN CONSTANTS (RESEARCH sec 6.2)
// ----------------------------------------------------------------------------

// VERDICTS: 4-state ladder + 'error' sentinel for runCheck try/catch boundary.
// Frozen. NO 'blocked' (lock 13 + dead-end #2). Phase 50 cockpit consumers
// import this for exhaustive validation; 'error' MUST be in the enum so
// catch-path returns don't misclassify against a 4-entry contract.
const VERDICTS = Object.freeze(['ok', 'warn', 'degraded', 'false_positive', 'error']);

// ROUTE_REASONS: Phase 41 R1..R5 verbatim. Frozen.
const ROUTE_REASONS = Object.freeze({
  R1: 'researcher_local_script_candidate',
  R2: 'codex_reviewer_fallback_candidate',
  R3: 'executor_context_packet_candidate',
  R4: 'verifier_goal_backward_candidate',
  R5: 'orchestrator_turn_trim_candidate',
});

// BUDGETS: per-role compiled fallback. Frozen. RESEARCH sec 6.3 LOCKED.
// 5/8 verbatim from BUDGET-02; 3/8 derived from live ledger P75/P90/P95.
const BUDGETS = Object.freeze({
  researcher:   Object.freeze({ warn_input: 25000,  degrade_input: 25000 }),
  planner:      Object.freeze({ warn_input: 30000,  degrade_input: 30000 }),
  executor:     Object.freeze({ warn_input: 40000,  degrade_input: 40000 }),
  verifier:     Object.freeze({ warn_input: 20000,  degrade_input: 20000 }),
  reviewer:     Object.freeze({ warn_input: 20000,  degrade_input: 20000 }),
  orchestrator: Object.freeze({ warn_input: 200000, degrade_input: 750000 }),
  classifier:   Object.freeze({ warn_input: 15000,  degrade_input: 15000 }),
  other:        Object.freeze({ warn_input: 25000,  degrade_input: 50000 }),
});

const COMMAND_NAME     = 'checkTokenWaste';
const ENVELOPE_VERSION = 1;
const LEDGER_REL       = path.join('metrics', 'token-waste-status.jsonl');

// run_id pattern. Mirrors gate-value-log.cjs:111 + report.cjs:103-104.
const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

// Default budgets.yaml path (sibling of check.cjs).
const DEFAULT_BUDGETS_YAML = path.join(__dirname, 'budgets.yaml');

// ----------------------------------------------------------------------------
// HELPERS
// ----------------------------------------------------------------------------

function statusLedgerPath(planningDir) {
  return path.join(planningDir, LEDGER_REL);
}

function generateRunId() {
  const ts = new Date().toISOString();
  const rand = crypto.randomBytes(2).toString('hex');
  return `${ts}-${rand}`;
}

// ----------------------------------------------------------------------------
// PRIVATE: _loadBudgets (BEHAVIOR 2)
// ----------------------------------------------------------------------------
// Returns { roles, bloat_signature, overrides, source }.
// NEVER throws upward. Fallback chain:
//   absent / parse-fail / schema-invalid / drift -> compiled BUDGETS +
//   Phase 41 BLOAT_THRESHOLDS; source tag distinguishes case.
function _loadBudgets(opts) {
  const o = opts || {};
  const yamlPath = o.budgetsYamlPath || DEFAULT_BUDGETS_YAML;

  const fallback = (sourceTag) => ({
    roles: BUDGETS,
    bloat_signature: {
      cache_read_ratio_high: BLOAT_THRESHOLDS.cache_read_ratio_high,
      useful_findings_low:   BLOAT_THRESHOLDS.useful_findings_low,
    },
    overrides: [],
    source: sourceTag,
  });

  try {
    if (!fs.existsSync(yamlPath)) {
      console.warn('[SGSD] token-waste: budgets.yaml absent at ' + yamlPath + '; using compiled defaults');
      return fallback('compiled_yaml_absent');
    }

    // Pinned js-yaml load pattern (mirrors gates-registry.cjs:38-44).
    const yamlLibPath = path.resolve(
      __dirname, '..', '..', 'tools', 'plan-schema', 'node_modules', 'js-yaml'
    );
    const yaml = require(yamlLibPath);
    const raw = fs.readFileSync(yamlPath, 'utf8');

    let parsed;
    try {
      parsed = yaml.load(raw);
    } catch (parseErr) {
      console.warn('[SGSD] token-waste: budgets.yaml parse failed: ' + parseErr.message);
      return fallback('compiled_yaml_parse_error');
    }

    if (!parsed || typeof parsed !== 'object' || !parsed.roles
        || typeof parsed.roles !== 'object') {
      console.warn('[SGSD] token-waste: budgets.yaml schema invalid (no roles); using compiled defaults');
      return fallback('compiled_yaml_schema_invalid');
    }

    // Validate every ROLES enum entry has positive numeric warn/degrade.
    for (const role of ROLES) {
      const r = parsed.roles[role];
      if (!r || typeof r !== 'object'
          || typeof r.warn_input !== 'number'    || r.warn_input <= 0
          || typeof r.degrade_input !== 'number' || r.degrade_input <= 0) {
        console.warn('[SGSD] token-waste: budgets.yaml missing/invalid role ' + role + '; using compiled defaults');
        return fallback('compiled_yaml_schema_invalid');
      }
    }

    // bloat_signature drift check (assertion 7 binding).
    const bs = parsed.bloat_signature || {};
    if (bs.cache_read_ratio_high !== BLOAT_THRESHOLDS.cache_read_ratio_high
        || bs.useful_findings_low !== BLOAT_THRESHOLDS.useful_findings_low) {
      console.warn('[SGSD] token-waste: budgets.yaml bloat_signature drift from Phase 41 BLOAT_THRESHOLDS; using compiled defaults');
      return fallback('compiled_yaml_schema_invalid');
    }

    const overrides = Array.isArray(parsed.overrides) ? parsed.overrides.slice() : [];

    return {
      roles: parsed.roles,
      bloat_signature: {
        cache_read_ratio_high: bs.cache_read_ratio_high,
        useful_findings_low:   bs.useful_findings_low,
      },
      overrides,
      source: 'yaml',
    };
  } catch (e) {
    console.warn('[SGSD] token-waste _loadBudgets failed: ' + e.message);
    return fallback('compiled_yaml_parse_error');
  }
}

// ----------------------------------------------------------------------------
// PRIVATE: _readSpendRows (mirror Phase 41 _readRows verbatim)
// ----------------------------------------------------------------------------
function _readSpendRows(planningDir, opts) {
  try {
    if (!planningDir) return [];
    const o = opts || {};
    const p = ledgerPath(planningDir); // Phase 41 ledgerPath = agent-token-spend.jsonl
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf8');
    if (!text.trim()) return [];
    let rows = text.split(/\r?\n/).filter(Boolean)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
    if (o.role)      rows = rows.filter((r) => r.role === o.role);
    if (o.provider)  rows = rows.filter((r) => r.provider === o.provider);
    if (o.milestone) rows = rows.filter((r) => r.milestone === o.milestone);
    if (o.phase)     rows = rows.filter((r) => String(r.phase) === String(o.phase));
    return rows;
  } catch (e) {
    console.warn('[SGSD] token-waste _readSpendRows failed: ' + e.message);
    return [];
  }
}

// ----------------------------------------------------------------------------
// PRIVATE: _matchOverride (BEHAVIOR 4)
// ----------------------------------------------------------------------------
// Specificity: role+milestone+phase > role+milestone > role.
// Returns matched override or null.
function _matchOverride(row, overrides) {
  if (!Array.isArray(overrides) || overrides.length === 0) return null;
  // Sort: 3-key matches first, then 2-key, then 1-key.
  const scored = overrides.map((o) => {
    let score = 0;
    if (o.role) score += 1;
    if (o.milestone) score += 1;
    if (o.phase) score += 1;
    return { o, score };
  }).sort((a, b) => b.score - a.score);

  for (const { o } of scored) {
    if (o.role && o.role !== row.role) continue;
    if (o.milestone && o.milestone !== row.milestone) continue;
    if (o.phase && String(o.phase) !== String(row.phase)) continue;
    return o;
  }
  return null;
}

// ----------------------------------------------------------------------------
// PRIVATE: _classifyRow (BEHAVIOR 3)
// ----------------------------------------------------------------------------
// Returns { verdict, reasons, rules_tripped, route_hint? }.
// Pure function. NEVER throws.
function _classifyRow(row, budgets) {
  const tb = (row && row.token_breakdown) || {};
  const role = (row && row.role) || 'other';
  const provider = (row && row.provider) || 'claude';
  // input_total = input + cache_read + cache_creation (full prompt-side).
  // Source rows from Phase 41 may use either *_input_tokens (raw schema)
  // or *_tokens (normalized). Read both, prefer raw.
  const input  = Number(tb.input_tokens) || 0;
  const cache  = Number(tb.cache_read_input_tokens) || Number(tb.cache_read_tokens) || 0;
  const create = Number(tb.cache_creation_input_tokens) || Number(tb.cache_creation_tokens) || 0;
  const inputTotal = input + cache + create;
  const cacheRatio = inputTotal > 0 ? (cache / inputTotal) : 0;
  const findings   = Number(tb.useful_findings) || 0;

  const roleBudget = budgets.roles[role] || budgets.roles.other || BUDGETS.other;

  // -- false_positive override path (short-circuit) --
  const matched = _matchOverride(
    { role, milestone: row && row.milestone, phase: row && row.phase },
    budgets.overrides || []
  );
  const carveOuts = ['vtp_research_route', 'high_risk_code_phase', 'full_review_tier'];
  const rowReasons = Array.isArray(row && row.reason_codes) ? row.reason_codes : [];
  const rowCarveOut = rowReasons.find((rc) => carveOuts.includes(rc));

  if (matched || rowCarveOut) {
    const tag = (matched && matched.exempt_via) || rowCarveOut || 'budget_check_false_positive';
    return {
      verdict: 'false_positive',
      reasons: ['budget_check_false_positive', tag],
      rules_tripped: [],
      route_hint: undefined,
    };
  }

  // -- verdict matrix (RESEARCH sec 4.4) --
  // Single-threshold roles (warn_input == degrade_input) have NO separate
  // hard ceiling -- BUDGET-02 verbatim budgets are admission lines, and the
  // only way to escalate to 'degraded' for these roles is the BUDGET-03
  // bloat signature trip (overWarn AND cacheHigh AND findingsLow).
  // Graduated roles (degrade_input > warn_input) DO have a hard ceiling;
  // the orchestrator/other distinction is bound here.
  const overWarn    = inputTotal >= roleBudget.warn_input;
  const isGraduated = roleBudget.degrade_input > roleBudget.warn_input;
  const overDegrade = isGraduated && inputTotal >= roleBudget.degrade_input;
  const cacheHigh   = cacheRatio > budgets.bloat_signature.cache_read_ratio_high;
  const findingsLow = findings   < budgets.bloat_signature.useful_findings_low;

  let verdict = 'ok';
  if (overDegrade) {
    verdict = 'degraded'; // hard ceiling (graduated roles only)
  } else if (overWarn && cacheHigh && findingsLow) {
    verdict = 'degraded'; // BUDGET-03 trip
  } else if (overWarn) {
    verdict = 'warn';
  } else if (cacheHigh && findingsLow) {
    verdict = 'warn'; // low-yield small call
  }

  const reasons = [];
  const overWarnOnly = overWarn && !overDegrade;
  // Reason codes per <reason_codes> closed vocab.
  if (overDegrade) {
    if (role === 'orchestrator' || role === 'other') {
      reasons.push(role + '_input_over_degrade');
    } else {
      reasons.push(role + '_input_over_budget');
    }
  } else if (overWarnOnly) {
    if (role === 'orchestrator' || role === 'other') {
      reasons.push(role + '_input_over_warn');
    } else {
      reasons.push(role + '_input_over_budget');
    }
  }
  if (cacheHigh)   reasons.push('cache_read_high');
  if (findingsLow) reasons.push('useful_findings_low');
  if (overWarn && cacheHigh && findingsLow) reasons.push('bloat_signature_tripped');

  // -- rules_tripped + route_hint (Phase 41 R1..R5) --
  const rules = [];
  let routeHint;

  if (verdict === 'warn' || verdict === 'degraded') {
    // Per-role primary input-budget rule.
    if (overWarn || overDegrade) {
      if (role === 'orchestrator' && verdict === 'degraded') {
        rules.push('orchestrator_turn_trim');
      } else if (role === 'orchestrator') {
        rules.push('orchestrator_turn_trim');
      } else {
        rules.push(role + '_input_over_budget');
      }
    }

    // R1..R5 priority order (RESEARCH sec 6.2): R1 > R2 > R3 > R4 > R5.
    const evidenceId = (tb && tb.source_event_id) || null;
    const buildHint = (toCandidates, reasonKey) => ({
      from_role: role,
      from_provider: provider,
      to_provider_candidates: toCandidates,
      reason: ROUTE_REASONS[reasonKey],
      evidence_event_id: evidenceId,
    });

    // R1: researcher local-script candidate.
    if (role === 'researcher' && cacheHigh && findingsLow) {
      rules.push('researcher_local_script');
      if (!routeHint) routeHint = buildHint(['local-script', 'codex', 'vtp'], 'R1');
    }
    // R2: codex reviewer fallback.
    if (role === 'reviewer') {
      rules.push('codex_reviewer_fallback');
      if (!routeHint) routeHint = buildHint(['codex'], 'R2');
    }
    // R3: executor context-packet (cache_high required).
    if (role === 'executor' && cacheHigh) {
      rules.push('executor_context_packet');
      if (!routeHint) routeHint = buildHint(['claude', 'local-script'], 'R3');
    }
    // R4: verifier goal-backward.
    if (role === 'verifier') {
      rules.push('verifier_goal_backward');
      if (!routeHint) routeHint = buildHint(['claude', 'local-script'], 'R4');
    }
    // R5: orchestrator turn-trim.
    if (role === 'orchestrator') {
      if (!routeHint) routeHint = buildHint(['claude'], 'R5');
    }

    // Hard-ceiling fallback: degraded over_degrade without bloat sig.
    // Provide role-specific default route_hint when no R1-R5 fired.
    if (!routeHint && verdict === 'degraded') {
      if (role === 'researcher')  routeHint = buildHint(['local-script', 'codex', 'vtp'], 'R1');
      else if (role === 'reviewer')  routeHint = buildHint(['codex'], 'R2');
      else if (role === 'executor')  routeHint = buildHint(['claude', 'local-script'], 'R3');
      else if (role === 'verifier')  routeHint = buildHint(['claude', 'local-script'], 'R4');
      else if (role === 'orchestrator') routeHint = buildHint(['claude'], 'R5');
    }
  }

  return {
    verdict,
    reasons,
    rules_tripped: rules,
    route_hint: routeHint,
  };
}

// ----------------------------------------------------------------------------
// PUBLIC: runCheck (BEHAVIOR 5)
// ----------------------------------------------------------------------------
function runCheck(planningDir, opts) {
  try {
    const o = opts || {};
    const scope = {
      milestone: o.milestone || null,
      phase: o.phase != null ? String(o.phase) : null,
      role: o.role || null,
    };
    const filters = {};
    if (scope.milestone) filters.milestone = scope.milestone;
    if (scope.phase)     filters.phase = scope.phase;
    if (scope.role)      filters.role = scope.role;

    const budgets = _loadBudgets({ budgetsYamlPath: o.budgetsYamlPath });

    const rows = _readSpendRows(planningDir, filters);

    if (rows.length === 0) {
      return {
        scope,
        verdict: 'ok',
        totals: { rows_evaluated: 0, ok: 0, warn: 0, degraded: 0, false_positive: 0 },
        rules_tripped: {},
        route_hints: [],
        top_offenders: [],
        budgets_source: budgets.source,
        empty_ledger: true,
      };
    }

    const totals = { rows_evaluated: rows.length, ok: 0, warn: 0, degraded: 0, false_positive: 0 };
    const rulesAcc = {};
    const hintAcc = new Map(); // key=from_role|reason -> { from_role, reason, count }
    const offenderRows = [];

    for (const r of rows) {
      const c = _classifyRow(r, budgets);
      if (totals[c.verdict] !== undefined) totals[c.verdict]++;
      for (const rule of c.rules_tripped) {
        rulesAcc[rule] = (rulesAcc[rule] || 0) + 1;
      }
      if (c.route_hint) {
        const key = c.route_hint.from_role + '|' + c.route_hint.reason;
        if (!hintAcc.has(key)) {
          hintAcc.set(key, {
            from_role: c.route_hint.from_role,
            reason: c.route_hint.reason,
            count: 0,
          });
        }
        hintAcc.get(key).count++;
      }
      if (c.verdict !== 'ok' && c.verdict !== 'false_positive') {
        const tb = r.token_breakdown || {};
        const inT = (Number(tb.input_tokens) || 0)
                  + (Number(tb.cache_read_input_tokens) || Number(tb.cache_read_tokens) || 0)
                  + (Number(tb.cache_creation_input_tokens) || Number(tb.cache_creation_tokens) || 0);
        offenderRows.push({
          role: r.role,
          phase: r.phase,
          milestone: r.milestone,
          input_total: inT,
          cache_ratio: inT > 0
            ? ((Number(tb.cache_read_input_tokens) || Number(tb.cache_read_tokens) || 0) / inT)
            : 0,
          findings: Number(tb.useful_findings) || 0,
          verdict: c.verdict,
          source_event_id: tb.source_event_id || null,
        });
      }
    }

    offenderRows.sort((a, b) => b.input_total - a.input_total);
    const topOffenders = offenderRows.slice(0, 10);

    const hints = Array.from(hintAcc.values()).sort((a, b) => b.count - a.count);

    let verdict = 'ok';
    if (totals.degraded > 0)      verdict = 'degraded';
    else if (totals.warn > 0)     verdict = 'warn';
    // Edge case: only false_positive rows -> aggregate verdict still 'ok'
    // for status mapping; the totals carry the false_positive count.

    return {
      scope,
      verdict,
      totals,
      rules_tripped: rulesAcc,
      route_hints: hints,
      top_offenders: topOffenders,
      budgets_source: budgets.source,
      empty_ledger: false,
    };
  } catch (e) {
    console.warn('[SGSD] token-waste runCheck failed: ' + e.message);
    return {
      scope: { milestone: null, phase: null, role: null },
      verdict: 'error',
      totals: { rows_evaluated: 0, ok: 0, warn: 0, degraded: 0, false_positive: 0 },
      rules_tripped: {},
      route_hints: [],
      top_offenders: [],
      budgets_source: 'compiled_error',
      error: e.message,
    };
  }
}

// ----------------------------------------------------------------------------
// PRIVATE: _normalize + _assertEnvelopeV1 (BEHAVIOR 6 helper)
// Mirrors gate-value-log.cjs:149-255 for envelope-v1 conformance.
// ----------------------------------------------------------------------------
function _normalize(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('token-waste: row must be an object');
  }
  if (!row.status || !STATUSES.includes(row.status)) {
    throw new Error(
      'token-waste: status must be one of ' + STATUSES.join(', ') + '; got ' + row.status
    );
  }
  if (row.reason_codes !== undefined && !Array.isArray(row.reason_codes)) {
    throw new Error('token-waste: reason_codes must be an array (or omitted)');
  }
  if (row.artifacts !== undefined && !Array.isArray(row.artifacts)) {
    throw new Error('token-waste: artifacts must be an array (or omitted)');
  }
  if (row.evidence !== undefined && !Array.isArray(row.evidence)) {
    throw new Error('token-waste: evidence must be an array (or omitted)');
  }

  return {
    envelope_version: ENVELOPE_VERSION,
    ts:               row.ts || new Date().toISOString(),
    command:          COMMAND_NAME,
    status:           row.status,
    reason_codes:     Array.isArray(row.reason_codes) ? row.reason_codes.slice() : [],
    artifacts:        Array.isArray(row.artifacts) ? row.artifacts.slice() : [],
    evidence:         Array.isArray(row.evidence)  ? row.evidence.slice()  : [],
    next_action:      row.next_action != null ? row.next_action : null,
    risk:             row.risk != null ? row.risk : null,
    duration_ms:      typeof row.duration_ms === 'number' ? row.duration_ms : null,
    run_id:           row.run_id || generateRunId(),
    phase:            row.phase != null ? row.phase : null,
    milestone:        row.milestone != null ? row.milestone : null,
    // Phase 42 extension fields (envelope-v1 additionalProperties:true):
    scope:            row.scope || { milestone: null, phase: null, role: null },
    verdict:          row.verdict || 'ok',
    totals:           row.totals || {},
    rules_tripped:    row.rules_tripped || {},
    route_hints:      Array.isArray(row.route_hints) ? row.route_hints.slice() : [],
  };
}

function _assertEnvelopeV1(row) {
  const required = ['envelope_version', 'ts', 'command', 'status', 'reason_codes',
    'artifacts', 'evidence', 'next_action', 'risk', 'duration_ms', 'run_id', 'phase', 'milestone'];
  for (const k of required) {
    if (!(k in row)) throw new Error('token-waste: emitted row missing required envelope-v1 field ' + k);
  }
  if (row.envelope_version !== 1) {
    throw new Error('token-waste: envelope_version must be 1 (got ' + row.envelope_version + ')');
  }
  if (!RUN_ID_REGEX.test(row.run_id)) {
    throw new Error('token-waste: run_id violates envelope-v1 pattern (got ' + row.run_id + ')');
  }
  if (!STATUSES.includes(row.status)) {
    throw new Error('token-waste: status must be one of ' + STATUSES.join(', ') + ' (got ' + row.status + ')');
  }
  if (row.duration_ms !== null && (!Number.isInteger(row.duration_ms) || row.duration_ms < 0)) {
    throw new Error('token-waste: duration_ms must be non-negative integer or null (got ' + row.duration_ms + ')');
  }
  for (const e of row.evidence) {
    if (!e || typeof e.kind !== 'string' || !e.kind || typeof e.ref !== 'string' || !e.ref) {
      throw new Error('token-waste: evidence item must be {kind, ref}');
    }
  }
  for (const a of row.artifacts) {
    if (!a || typeof a.kind !== 'string' || !a.kind || typeof a.path !== 'string' || !a.path) {
      throw new Error('token-waste: artifacts item must be {kind, path}');
    }
  }
}

function _appendRowInternal(planningDir, row) {
  if (!planningDir) throw new Error('token-waste: planningDir required');
  const enriched = _normalize(row);
  _assertEnvelopeV1(enriched);
  const p = statusLedgerPath(planningDir);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
  return enriched;
}

// ----------------------------------------------------------------------------
// PUBLIC: appendCheckRun (BEHAVIOR 6)
// ----------------------------------------------------------------------------
// LOCK 13 BINDING: degraded -> envelope.status='warn' (NEVER 'blocked').
function appendCheckRun(planningDir, result, opts) {
  try {
    if (!result || typeof result !== 'object') return false;
    const o = opts || {};

    // Status mapping per LOCK 13.
    let status;
    switch (result.verdict) {
      case 'ok':             status = 'ok'; break;
      case 'warn':           status = 'warn'; break;
      case 'degraded':       status = 'warn'; break; // LOCK 13: NEVER 'blocked'
      case 'false_positive': status = 'skipped'; break;
      case 'error':          status = 'fail'; break;
      default:               status = 'ok';
    }

    const reasonCodes = [];
    if (result.verdict === 'ok')        reasonCodes.push('token_waste_check_passed');
    if (result.verdict === 'warn')      reasonCodes.push('token_waste_warn_present');
    if (result.verdict === 'degraded')  reasonCodes.push('token_waste_degraded_present');
    if (result.budgets_source && result.budgets_source !== 'yaml') {
      reasonCodes.push('budgets_yaml_fallback');
    }
    if (result.empty_ledger || (result.totals && result.totals.rows_evaluated === 0)) {
      reasonCodes.push('empty_ledger');
    }
    if (Array.isArray(o.extraReasonCodes)) {
      for (const c of o.extraReasonCodes) reasonCodes.push(c);
    }

    let nextAction = null;
    if (result.verdict === 'warn')     nextAction = 'Review top offenders in token-waste.md';
    if (result.verdict === 'degraded') nextAction = 'Consider local-script substitution; see route_hints';
    if (result.verdict === 'error')    nextAction = 'Inspect token-waste-status.jsonl error reason';

    let risk = null;
    if (result.verdict === 'warn')     risk = 'medium';
    if (result.verdict === 'degraded') risk = 'high';
    if (result.verdict === 'error')    risk = 'medium';

    const evidence = [];
    const offenders = Array.isArray(result.top_offenders) ? result.top_offenders.slice(0, 3) : [];
    for (const off of offenders) {
      if (off.source_event_id) {
        evidence.push({ kind: 'agent_token_spend_row', ref: 'attribution:' + off.source_event_id });
      }
    }
    // envelope-v1 _assertEnvelopeV1 requires inner items to be valid; only push
    // when both kind+ref present. If no offender has source_event_id, evidence
    // stays empty (envelope-v1 allows empty arrays).

    const artifacts = [];
    const milestone = result.scope && result.scope.milestone;
    if (milestone) {
      artifacts.push({
        kind: 'verdict_md',
        path: '.planning/milestones/' + milestone + '/token-waste.md',
      });
    }

    const row = {
      ts: new Date().toISOString(),
      status,
      reason_codes: reasonCodes,
      artifacts,
      evidence,
      next_action: nextAction,
      risk,
      duration_ms: typeof o.durationMs === 'number' ? o.durationMs : 0,
      run_id: generateRunId(),
      phase: result.scope && result.scope.phase ? String(result.scope.phase) : null,
      milestone: milestone || null,
      scope: result.scope || { milestone: null, phase: null, role: null },
      verdict: result.verdict || 'ok',
      totals: result.totals || {},
      rules_tripped: result.rules_tripped || {},
      route_hints: Array.isArray(result.route_hints) ? result.route_hints : [],
    };

    return _appendRowInternal(planningDir, row);
  } catch (e) {
    console.warn('[SGSD] token-waste appendCheckRun failed: ' + e.message);
    return false;
  }
}

// ----------------------------------------------------------------------------
// PUBLIC: renderTable (BEHAVIOR 7)
// ----------------------------------------------------------------------------
function renderTable(result) {
  try {
    if (!result || typeof result !== 'object') return '(token-waste render error)';
    if (result.verdict === 'error') return '(token-waste render error)';

    const lines = [];
    const scope = result.scope || {};
    const ms = scope.milestone || 'all';
    const phaseScope = scope.phase ? ('phase ' + scope.phase) : 'all phases';
    lines.push('## Token Waste (milestone ' + ms + ', scope ' + phaseScope + ')');
    lines.push('');

    const totals = result.totals || {};
    const rowsEval = Number(totals.rows_evaluated) || 0;

    if (rowsEval === 0) {
      lines.push('(no rows evaluated; agent-token-spend.jsonl absent or empty)');
      lines.push('');
      lines.push('> Per design lock 13: degraded continues; halt reserved for SGSD-HANDOVER hard stops.');
      return lines.join('\n') + '\n';
    }

    // Section 1: Verdict Counts
    lines.push('### Verdict Counts');
    lines.push('| Verdict | Count | % |');
    lines.push('|---------|------:|--:|');
    const fmtPct = (n) => rowsEval > 0 ? ((n / rowsEval) * 100).toFixed(1) + '%' : '0.0%';
    for (const v of ['ok', 'warn', 'degraded', 'false_positive']) {
      const c = Number(totals[v]) || 0;
      lines.push('| ' + v + ' | ' + c + ' | ' + fmtPct(c) + ' |');
    }
    lines.push('');

    // Section 2: Rules Tripped
    lines.push('### Rules Tripped');
    const rules = result.rules_tripped || {};
    const ruleEntries = Object.keys(rules).map((k) => ({ name: k, count: rules[k] }))
      .sort((a, b) => b.count - a.count);
    if (ruleEntries.length === 0) {
      lines.push('(none)');
    } else {
      lines.push('| Rule | Count |');
      lines.push('|------|------:|');
      for (const e of ruleEntries) lines.push('| ' + e.name + ' | ' + e.count + ' |');
    }
    lines.push('');

    // Section 3: Route Hints
    lines.push('### Route Hints');
    const hints = Array.isArray(result.route_hints) ? result.route_hints : [];
    if (hints.length === 0) {
      lines.push('(none)');
    } else {
      lines.push('| from_role | reason | count |');
      lines.push('|-----------|--------|------:|');
      for (const h of hints) {
        lines.push('| ' + h.from_role + ' | ' + h.reason + ' | ' + h.count + ' |');
      }
    }
    lines.push('');

    // Section 4: Top Offenders
    lines.push('### Top Offenders');
    const offenders = Array.isArray(result.top_offenders) ? result.top_offenders.slice(0, 10) : [];
    if (offenders.length === 0) {
      lines.push('(none)');
    } else {
      lines.push('| role | phase | total | cache % | findings | verdict |');
      lines.push('|------|-------|------:|--------:|---------:|---------|');
      for (const off of offenders) {
        const totalStr = (Number(off.input_total) || 0).toLocaleString('en-US');
        const cacheStr = ((Number(off.cache_ratio) || 0) * 100).toFixed(1) + '%';
        lines.push('| ' + (off.role || '-')
          + ' | ' + (off.phase != null ? off.phase : '-')
          + ' | ' + totalStr
          + ' | ' + cacheStr
          + ' | ' + (Number(off.findings) || 0)
          + ' | ' + off.verdict + ' |');
      }
    }
    lines.push('');

    lines.push('> Per design lock 13: degraded continues; halt reserved for SGSD-HANDOVER hard stops.');
    return lines.join('\n') + '\n';
  } catch (e) {
    console.warn('[SGSD] token-waste renderTable failed: ' + e.message);
    return '(token-waste render error)';
  }
}

// ----------------------------------------------------------------------------
// SELF-TEST (RESEARCH sec 7) -- 15 assertions: 4 fixtures + 11 secondary
// ----------------------------------------------------------------------------
function _selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // __dirname-anchored fingerprint guard (RESEARCH sec 9 / BEHAVIOR 9).
  // 5 canonical token streams + budgets.yaml + token-waste-status.jsonl.
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  const realInputs = [
    path.join(repoRoot, '.planning', 'metrics', 'agent-token-spend.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'token-attribution.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'codex-log.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'token-log.jsonl'),
    path.join(repoRoot, '.planning', 'metrics', 'activity-log.jsonl'),
    path.join(__dirname, 'budgets.yaml'),
  ];
  const realOwned = path.join(repoRoot, '.planning', 'metrics', 'token-waste-status.jsonl');

  const fp = (p) => fs.existsSync(p)
    ? { exists: true, mtime: fs.statSync(p).mtimeMs, size: fs.statSync(p).size }
    : { exists: false, mtime: 0, size: 0 };

  const beforeInputs = realInputs.map(fp);
  const beforeOwned = fp(realOwned);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-'));
  try {
    // ---- FIXTURE BUILDERS ----
    const buildRow = (overrides) => Object.assign({
      envelope_version: 1,
      ts: '2026-04-27T19:00:00.000Z',
      command: 'logTokenSpend',
      status: 'ok',
      reason_codes: [],
      artifacts: [],
      evidence: [],
      next_action: null,
      risk: null,
      duration_ms: 100,
      run_id: '2026-04-27T19:00:00.000Z-aaaa',
      phase: '36',
      milestone: 'v1.8',
      role: 'researcher',
      provider: 'claude',
      token_breakdown: {
        input_tokens: 0,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
        total_tokens: 0,
        useful_findings: 0,
        source_event_id: null,
      },
    }, overrides);

    // F1: input_total=20000 (4000 input + 16000 cache_read), 80% cache, 50 findings.
    // researcher warn=25000 -> NOT over_warn. cache 0.80 <= 0.90. -> 'ok'.
    const f1 = buildRow({
      token_breakdown: {
        input_tokens: 4000,
        cache_read_input_tokens: 16000,
        cache_creation_input_tokens: 0,
        useful_findings: 50,
        source_event_id: 'agent:f1:test',
      },
    });

    // F2: input_total=28000 (4480 + 23520), 84% cache, 50 findings.
    // researcher warn=25000 -> over_warn. cache 0.84 <= 0.90. -> 'warn'.
    const f2 = buildRow({
      token_breakdown: {
        input_tokens: 4480,
        cache_read_input_tokens: 23520,
        cache_creation_input_tokens: 0,
        useful_findings: 50,
        source_event_id: 'agent:f2:test',
      },
    });

    // F3 BINDING: input_total=30000 (300 + 29700), 99% cache, 5 findings.
    // researcher warn=25000 -> over_warn. cache 0.99 > 0.90. findings 5 < 15.
    // -> 'degraded' (BUDGET-03 trip).
    const f3 = buildRow({
      token_breakdown: {
        input_tokens: 300,
        cache_read_input_tokens: 29700,
        cache_creation_input_tokens: 0,
        useful_findings: 5,
        source_event_id: 'agent:54c3e039-test:a4b4b87c19222f2aa',
      },
    });

    // F4: input_total=60000, 86% cache, 100 findings, milestone=v1.9 phase=51,
    // reason_codes includes vtp_research_route. Override matches.
    // -> 'false_positive'.
    const f4 = buildRow({
      milestone: 'v1.9',
      phase: '51',
      reason_codes: ['vtp_research_route'],
      provider: 'vtp',
      token_breakdown: {
        input_tokens: 1000,
        cache_read_input_tokens: 51600,
        cache_creation_input_tokens: 7400,
        useful_findings: 100,
        source_event_id: 'agent:f4:test',
      },
    });

    // ---- 4-row tmp ledger for fixture-based runCheck ----
    const tmp4 = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-4-'));
    try {
      const ledger4 = path.join(tmp4, 'metrics', 'agent-token-spend.jsonl');
      fs.mkdirSync(path.dirname(ledger4), { recursive: true });
      fs.writeFileSync(ledger4,
        JSON.stringify(f1) + '\n' +
        JSON.stringify(f2) + '\n' +
        JSON.stringify(f3) + '\n' +
        JSON.stringify(f4) + '\n', 'utf8');

      // Per-row classification via runCheck on filtered tmp tmpdir.
      const f1Result = runCheck(tmp4, { milestone: 'v1.8', phase: '36' });
      // F1 + F2 + F3 all milestone=v1.8 phase=36; runCheck filters them together.
      // Use direct _classifyRow for fixture-grain assertions:
      const budgets = _loadBudgets({});

      const c1 = _classifyRow(f1, budgets);
      const c2 = _classifyRow(f2, budgets);
      const c3 = _classifyRow(f3, budgets);
      const c4 = _classifyRow(f4, budgets);

      // 1. F1 normal -> 'ok'.
      assert('1. F1 normal -> ok',
        c1.verdict === 'ok' && c1.rules_tripped.length === 0 && !c1.route_hint);

      // 2. F2 warning -> 'warn' + researcher_input_over_budget; no route_hint.
      assert('2. F2 warning -> warn (researcher_input_over_budget; no route_hint)',
        c2.verdict === 'warn'
        && c2.reasons.includes('researcher_input_over_budget')
        && c2.rules_tripped.includes('researcher_input_over_budget')
        && !c2.route_hint,
        'verdict=' + c2.verdict + ' reasons=' + JSON.stringify(c2.reasons));

      // 3. F3 BINDING degraded -> 'degraded' + bloat_signature_tripped + R1 hint.
      const f3OK = c3.verdict === 'degraded'
        && c3.reasons.includes('researcher_input_over_budget')
        && c3.reasons.includes('cache_read_high')
        && c3.reasons.includes('useful_findings_low')
        && c3.reasons.includes('bloat_signature_tripped')
        && c3.rules_tripped.includes('researcher_local_script')
        && c3.route_hint
        && c3.route_hint.reason === 'researcher_local_script_candidate'
        && c3.route_hint.evidence_event_id === 'agent:54c3e039-test:a4b4b87c19222f2aa';
      assert('3. F3 BINDING degraded -> route_hint researcher_local_script_candidate',
        f3OK,
        'verdict=' + c3.verdict + ' route=' + JSON.stringify(c3.route_hint));

      // 4. F4 false_positive override (researcher+v1.9+phase 51+vtp_research_route).
      assert('4. F4 false_positive -> override matched',
        c4.verdict === 'false_positive'
        && c4.reasons.includes('budget_check_false_positive')
        && c4.reasons.includes('vtp_research_route')
        && c4.rules_tripped.length === 0
        && !c4.route_hint);

      // 5. VERDICTS frozen 5-entry (4 ladder + 'error' sentinel); NO 'blocked'.
      let v5 = false;
      try { VERDICTS.push('blocked'); } catch (e) { v5 = true; }
      assert('5. VERDICTS frozen 5-entry (4 ladder + error sentinel; no blocked)',
        Array.isArray(VERDICTS) && VERDICTS.length === 5
        && VERDICTS.includes('ok') && VERDICTS.includes('warn')
        && VERDICTS.includes('degraded') && VERDICTS.includes('false_positive')
        && VERDICTS.includes('error')
        && !VERDICTS.includes('blocked')
        && (v5 || VERDICTS.length === 5));

      // 6. ROUTE_REASONS frozen 5-entry verbatim Phase 41 R1..R5.
      assert('6. ROUTE_REASONS frozen 5-entry verbatim',
        Object.isFrozen(ROUTE_REASONS)
        && ROUTE_REASONS.R1 === 'researcher_local_script_candidate'
        && ROUTE_REASONS.R2 === 'codex_reviewer_fallback_candidate'
        && ROUTE_REASONS.R3 === 'executor_context_packet_candidate'
        && ROUTE_REASONS.R4 === 'verifier_goal_backward_candidate'
        && ROUTE_REASONS.R5 === 'orchestrator_turn_trim_candidate'
        && Object.keys(ROUTE_REASONS).length === 5);

      // 7. budgets.bloat_signature == Phase 41 BLOAT_THRESHOLDS (by reference).
      assert('7. bloat_signature inherits Phase 41 BLOAT_THRESHOLDS',
        budgets.bloat_signature.cache_read_ratio_high === BLOAT_THRESHOLDS.cache_read_ratio_high
        && budgets.bloat_signature.cache_read_ratio_high === 0.90
        && budgets.bloat_signature.useful_findings_low === BLOAT_THRESHOLDS.useful_findings_low
        && budgets.bloat_signature.useful_findings_low === 15);

      // 8. Empty ledger -> verdict ok, rows_evaluated=0, no rows written.
      const tmp8 = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-8-'));
      try {
        const r8 = runCheck(tmp8, {});
        assert('8. empty ledger -> ok + rows_evaluated=0; no failure',
          r8.verdict === 'ok' && r8.totals.rows_evaluated === 0
          && r8.empty_ledger === true);
      } finally { fs.rmSync(tmp8, { recursive: true, force: true }); }

      // 9. Malformed budgets.yaml -> graceful fallback; reason_code present.
      const tmp9 = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-9-'));
      try {
        const badYaml = path.join(tmp9, 'budgets-bad.yaml');
        fs.writeFileSync(badYaml, '{not yaml: } ::]] [[[\n', 'utf8');
        const ledger9 = path.join(tmp9, 'metrics', 'agent-token-spend.jsonl');
        fs.mkdirSync(path.dirname(ledger9), { recursive: true });
        fs.writeFileSync(ledger9, JSON.stringify(f1) + '\n', 'utf8');
        const r9 = runCheck(tmp9, { budgetsYamlPath: badYaml });
        const env9 = appendCheckRun(tmp9, r9);
        const yamlFallbackOK = (r9.budgets_source === 'compiled_yaml_parse_error'
                               || r9.budgets_source === 'compiled_yaml_schema_invalid')
          && env9 && Array.isArray(env9.reason_codes)
          && env9.reason_codes.includes('budgets_yaml_fallback');
        assert('9. malformed budgets.yaml -> fallback + budgets_yaml_fallback reason_code',
          yamlFallbackOK,
          'budgets_source=' + r9.budgets_source);
      } finally { fs.rmSync(tmp9, { recursive: true, force: true }); }

      // 10. Override match priority: 3-key > 2-key > 1-key.
      const overrides10 = [
        { role: 'researcher', exempt_via: 'role_only_match' },
        { role: 'researcher', milestone: 'v1.9', exempt_via: 'role_milestone_match' },
        { role: 'researcher', milestone: 'v1.9', phase: '51', exempt_via: 'role_milestone_phase_match' },
      ];
      const m10 = _matchOverride(
        { role: 'researcher', milestone: 'v1.9', phase: '51' },
        overrides10
      );
      const m10b = _matchOverride(
        { role: 'researcher', milestone: 'v1.9', phase: '40' },
        overrides10
      );
      const m10c = _matchOverride(
        { role: 'researcher', milestone: 'v1.7', phase: '01' },
        overrides10
      );
      assert('10. override priority: 3-key > 2-key > 1-key (all 3 sub-cases)',
        m10 && m10.exempt_via === 'role_milestone_phase_match'
        && m10b && m10b.exempt_via === 'role_milestone_match'
        && m10c && m10c.exempt_via === 'role_only_match');

      // 11. Canonical-stream fingerprint guard (deferred to end of self-test).
      // Captured up-top; checked in finally block after all writes complete.

      // 12. 1000-row synthetic ledger -> deterministic verdict counts.
      const tmp12 = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-12-'));
      try {
        const ledger12 = path.join(tmp12, 'metrics', 'agent-token-spend.jsonl');
        fs.mkdirSync(path.dirname(ledger12), { recursive: true });
        const lines12 = [];
        // 500 ok researcher rows (input_total=10000, low cache, high findings).
        for (let i = 0; i < 500; i++) {
          lines12.push(JSON.stringify(buildRow({
            token_breakdown: {
              input_tokens: 8000,
              cache_read_input_tokens: 2000,
              cache_creation_input_tokens: 0,
              useful_findings: 100,
              source_event_id: 'agent:ok:' + i,
            },
          })));
        }
        // 300 warn researcher rows (input_total=27000, 80% cache, 50 findings).
        for (let i = 0; i < 300; i++) {
          lines12.push(JSON.stringify(buildRow({
            token_breakdown: {
              input_tokens: 5400,
              cache_read_input_tokens: 21600,
              cache_creation_input_tokens: 0,
              useful_findings: 50,
              source_event_id: 'agent:warn:' + i,
            },
          })));
        }
        // 195 degraded researcher rows (input_total=30000, 99% cache, 5 findings).
        for (let i = 0; i < 195; i++) {
          lines12.push(JSON.stringify(buildRow({
            token_breakdown: {
              input_tokens: 300,
              cache_read_input_tokens: 29700,
              cache_creation_input_tokens: 0,
              useful_findings: 5,
              source_event_id: 'agent:deg:' + i,
            },
          })));
        }
        // 5 false_positive rows (vtp_research_route in reason_codes).
        for (let i = 0; i < 5; i++) {
          lines12.push(JSON.stringify(buildRow({
            milestone: 'v1.9',
            phase: '60',
            reason_codes: ['vtp_research_route'],
            token_breakdown: {
              input_tokens: 5000,
              cache_read_input_tokens: 50000,
              cache_creation_input_tokens: 0,
              useful_findings: 100,
              source_event_id: 'agent:fp:' + i,
            },
          })));
        }
        fs.writeFileSync(ledger12, lines12.join('\n') + '\n', 'utf8');
        const r12 = runCheck(tmp12, {});
        assert('12. 1000-row synthetic -> deterministic verdict counts',
          r12.totals.rows_evaluated === 1000
          && r12.totals.ok === 500
          && r12.totals.warn === 300
          && r12.totals.degraded === 195
          && r12.totals.false_positive === 5,
          'totals=' + JSON.stringify(r12.totals));
      } finally { fs.rmSync(tmp12, { recursive: true, force: true }); }

      // 13. envelope-v1 schema check on emitted status row.
      const tmp13 = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-13-'));
      try {
        const ledger13 = path.join(tmp13, 'metrics', 'agent-token-spend.jsonl');
        fs.mkdirSync(path.dirname(ledger13), { recursive: true });
        fs.writeFileSync(ledger13, JSON.stringify(f3) + '\n', 'utf8');
        const r13 = runCheck(tmp13, { milestone: 'v1.8' });
        const env13 = appendCheckRun(tmp13, r13);
        const required13 = ['envelope_version', 'ts', 'command', 'status', 'reason_codes',
          'artifacts', 'evidence', 'next_action', 'risk', 'duration_ms', 'run_id', 'phase', 'milestone'];
        const ext13 = ['scope', 'verdict', 'totals', 'rules_tripped', 'route_hints'];
        const allRequired = required13.every((k) => k in env13);
        const allExt = ext13.every((k) => k in env13);
        const lock13OK = env13.verdict === 'degraded' && env13.status === 'warn';
        const noBlocked = env13.status !== 'blocked';
        const runIdOK = RUN_ID_REGEX.test(env13.run_id);
        assert('13. envelope-v1 + 5 ext + lock-13 (verdict=degraded -> status=warn NEVER blocked)',
          env13 && allRequired && allExt && lock13OK && noBlocked && runIdOK,
          'status=' + (env13 && env13.status) + ' verdict=' + (env13 && env13.verdict));
      } finally { fs.rmSync(tmp13, { recursive: true, force: true }); }

      // 14. CLI exit codes -- spawned via fork is heavy; we test the
      // pure functional invariants here (the CLI simply forwards):
      //   --self-test pass -> 0 (this very function's return code).
      //   runCheck verdict='degraded' -> envelope.status='warn'; CLI MUST exit 0.
      //   bad invocation -> exit 2 (asserted in T3 verification block).
      // Functional binding: appendCheckRun returns truthy on degraded.
      const cli14a = appendCheckRun(tmp4, { verdict: 'ok', scope: { milestone: null, phase: null, role: null }, totals: { rows_evaluated: 0 } });
      const cli14b = appendCheckRun(tmp4, { verdict: 'degraded', scope: { milestone: null, phase: null, role: null }, totals: { rows_evaluated: 1, ok: 0, warn: 0, degraded: 1, false_positive: 0 } });
      assert('14. CLI exit-0 contract: ok + degraded both yield non-blocked envelope rows',
        cli14a && cli14a.status === 'ok'
        && cli14b && cli14b.status === 'warn' && cli14b.status !== 'blocked');

      // 15. runCheck never throws upward (poison _readSpendRows).
      // Trick: pass a planningDir whose ledgerPath is a directory (read fails).
      const tmp15 = fs.mkdtempSync(path.join(os.tmpdir(), 'tw-15-'));
      try {
        const lp = ledgerPath(tmp15);
        fs.mkdirSync(path.dirname(lp), { recursive: true });
        // Make the ledger path a directory -> readFileSync throws EISDIR.
        fs.mkdirSync(lp, { recursive: true });
        let threw15 = false;
        let r15;
        try { r15 = runCheck(tmp15, {}); } catch (e) { threw15 = true; }
        // _readSpendRows catches and returns []; runCheck returns ok with 0 rows.
        // renderTable on empty result returns the placeholder string (NOT error).
        const rt15 = renderTable(r15);
        const ar15 = appendCheckRun('/non/existent/path/that/cannot/be/created', r15);
        assert('15. runCheck/renderTable/appendCheckRun never throw upward',
          !threw15 && r15 && r15.verdict === 'ok'
          && typeof rt15 === 'string'
          && (ar15 === false || (ar15 && ar15.envelope_version === 1)));
      } finally {
        // Cleanup: remove the directory we created at ledger path.
        try { fs.rmSync(tmp15, { recursive: true, force: true }); } catch {}
      }
    } finally {
      fs.rmSync(tmp4, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  // ---- 11. Canonical-stream fingerprint guard (final check) ----
  const afterInputs = realInputs.map(fp);
  const afterOwned = fp(realOwned);
  let fingerprintOK = true;
  let fingerprintDetail = '';
  for (let i = 0; i < realInputs.length; i++) {
    if (beforeInputs[i].exists !== afterInputs[i].exists
        || beforeInputs[i].mtime !== afterInputs[i].mtime
        || beforeInputs[i].size !== afterInputs[i].size) {
      fingerprintOK = false;
      fingerprintDetail = 'input[' + i + ']=' + realInputs[i] + ' changed';
      break;
    }
  }
  if (fingerprintOK) {
    if (beforeOwned.exists !== afterOwned.exists
        || beforeOwned.mtime !== afterOwned.mtime
        || beforeOwned.size !== afterOwned.size) {
      fingerprintOK = false;
      fingerprintDetail = 'owned=' + realOwned + ' changed';
    }
  }
  assert('11. canonical 6-input + 1-owned fingerprint untouched by self-test',
    fingerprintOK, fingerprintDetail);

  console.log('token-waste self-test: ' + pass + ' pass, ' + fail + ' fail');
  if (fail > 0) {
    for (const f of failures) {
      console.error('  FAIL: ' + f.name + (f.detail ? ' -- ' + f.detail : ''));
    }
    return 1;
  }
  return 0;
}

// ----------------------------------------------------------------------------
// CLI MAIN (BEHAVIOR 8)
// ----------------------------------------------------------------------------
function _parseArgv(argv) {
  // Closed-flag parser. Unknown flag -> { error: 'bad_invocation', flag }.
  const known = new Set([
    '--self-test', '--check',
    '--milestone', '--phase', '--role',
    '--budgets-yaml', '--planning-dir',
    '--json', '--help',
  ]);
  const out = { mode: null, milestone: null, phase: null, role: null,
    budgetsYaml: null, planningDir: null, json: false, help: false };
  let i = 2; // skip node + script
  while (i < argv.length) {
    const a = argv[i];
    if (!known.has(a)) return { error: 'bad_invocation', flag: a };
    if (a === '--self-test') { out.mode = 'self-test'; i++; continue; }
    if (a === '--check')     { out.mode = 'check'; i++; continue; }
    if (a === '--json')      { out.json = true; i++; continue; }
    if (a === '--help')      { out.help = true; i++; continue; }
    // value flags
    if (a === '--milestone')    { out.milestone = argv[i + 1]; i += 2; continue; }
    if (a === '--phase')        { out.phase = argv[i + 1]; i += 2; continue; }
    if (a === '--role')         { out.role = argv[i + 1]; i += 2; continue; }
    if (a === '--budgets-yaml') { out.budgetsYaml = argv[i + 1]; i += 2; continue; }
    if (a === '--planning-dir') { out.planningDir = argv[i + 1]; i += 2; continue; }
    i++;
  }
  // Conflicts.
  if (out.mode === 'self-test' && (out.milestone || out.phase || out.role)) {
    // Allowed; self-test ignores scope. Not bad invocation.
  }
  return out;
}

function _usage() {
  console.log('Usage:');
  console.log('  node super-gsd/tools/token-waste/check.cjs --self-test');
  console.log('  node super-gsd/tools/token-waste/check.cjs --check [--milestone v1.9] [--phase N] [--role researcher] [--budgets-yaml <path>] [--planning-dir <path>] [--json]');
  console.log('  node super-gsd/tools/token-waste/check.cjs --help');
  console.log('Verdicts: ok | warn | degraded | false_positive');
  console.log('CLI exits 0 on degraded (LOCK 13). Only bad invocation exits 2.');
}

if (require.main === module) {
  const parsed = _parseArgv(process.argv);

  if (parsed.error === 'bad_invocation') {
    console.error('token-waste: bad invocation (unknown flag: ' + parsed.flag + ')');
    _usage();
    process.exit(2);
  }

  if (parsed.help) { _usage(); process.exit(0); }

  if (parsed.mode === 'self-test') {
    process.exit(_selfTest());
  }

  if (parsed.mode === 'check') {
    const planningDir = parsed.planningDir
      ? path.resolve(parsed.planningDir)
      : path.resolve(__dirname, '..', '..', '..', '.planning');

    const opts = {};
    if (parsed.milestone) opts.milestone = parsed.milestone;
    if (parsed.phase)     opts.phase = parsed.phase;
    if (parsed.role)      opts.role = parsed.role;
    if (parsed.budgetsYaml) opts.budgetsYamlPath = parsed.budgetsYaml;

    const result = runCheck(planningDir, opts);

    // Render markdown to milestones/{ms}/token-waste.md when scope is milestone-level.
    if (opts.milestone && !opts.phase && !opts.role) {
      try {
        const mdDir = path.join(planningDir, 'milestones', opts.milestone);
        if (!fs.existsSync(mdDir)) fs.mkdirSync(mdDir, { recursive: true });
        const md = renderTable(result);
        fs.writeFileSync(
          path.join(mdDir, 'token-waste.md'),
          '# Token Waste (milestone ' + opts.milestone + ')\n\n' +
          '> Soft-warn / degraded only. Per design lock 13:\n' +
          '> "Autonomy continues; evidence tells the truth."\n' +
          '> Halt remains reserved for SGSD-HANDOVER.md:79-86 hard stops.\n\n' +
          md + '\n', 'utf8');
      } catch (e) {
        console.warn('[SGSD] token-waste: token-waste.md write failed: ' + e.message);
      }
    }

    // Append envelope-v1 row to token-waste-status.jsonl.
    appendCheckRun(planningDir, result);

    if (parsed.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('token-waste check complete (verdict='
        + result.verdict + ', rows=' + (result.totals.rows_evaluated || 0) + ')');
    }
    // LOCK 13: exit 0 regardless of verdict.
    process.exit(0);
  }

  // No mode specified -> usage + exit 0 (informational, not bad invocation).
  _usage();
  process.exit(0);
}

// ----------------------------------------------------------------------------
// MODULE EXPORTS
// ----------------------------------------------------------------------------
module.exports = {
  // 3 public APIs:
  runCheck,
  renderTable,
  appendCheckRun,
  // 5 frozen consts:
  VERDICTS,
  ROUTE_REASONS,
  BUDGETS,
  COMMAND_NAME,
  ENVELOPE_VERSION,
};
