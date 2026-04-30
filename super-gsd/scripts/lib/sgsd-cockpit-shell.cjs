// ============================================================================
// Phase 50 read-only Node bridge.
// Imports Phase 41/42/49 BY REFERENCE (require by absolute __dirname-anchored
// path). Lock 13: never throws upward. Read-only invariant: never writes any
// file under .planning/ or super-gsd/tools/.
//
// Consumed by super-gsd/scripts/sgsd-mission-control.ps1 once per render frame.
// stdout is JSON-only; stderr suppressed by caller.
// ASCII-only literals (PS5.1 mojibake guard applies even to JSON the cockpit
// consumes).
// ============================================================================

'use strict';

const path = require('path');
const fs   = require('fs');

// super-gsd/scripts/lib  -> repo root
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');

// -- Phase 41/42/49 require() BY REFERENCE -----------------------------------
let tokenAttr   = null;
let tokenAttrErr = null;
try {
  tokenAttr = require(path.join(REPO_ROOT, 'super-gsd', 'tools', 'token-attribution', 'report.cjs'));
} catch (e) {
  tokenAttrErr = (e && e.message) ? e.message : 'token-attribution-missing';
}

let tokenWaste   = null;
let tokenWasteErr = null;
try {
  tokenWaste = require(path.join(REPO_ROOT, 'super-gsd', 'tools', 'token-waste', 'check.cjs'));
} catch (e) {
  tokenWasteErr = (e && e.message) ? e.message : 'token-waste-missing';
}

let memGov   = null;
let memGovErr = null;
try {
  memGov = require(path.join(REPO_ROOT, 'super-gsd', 'tools', 'memory-governance', 'lifecycle.cjs'));
} catch (e) {
  memGovErr = (e && e.message) ? e.message : 'memory-governance-missing';
}

// -- Frozen consts (Mirror constraint; mirrors Phase 45 build.cjs:239-268) ---
const PANEL_KINDS = Object.freeze([
  'token',
  'source_mix',
  'active_agent',
  'codex',
  'intent',
  'governance',
  'budget'
]);

const ACTIVITY_WINDOW_SEC = Object.freeze({
  active: 60,
  recent: 300
});

const CONTEXT_SOURCE_MIX_KEYS = Object.freeze([
  'raw_evidence',
  'phase_capsule',
  'validated_thought',
  'reusable_rule',
  'guardrail',
  'index_snippet',
  'vtp_packet'
]);

const EXECUTION_REASON_TEXT = Object.freeze({
  codex_primary_bounded_task: 'Codex fits: bounded edit, allowed files, tests available',
  codex_primary_review: 'Codex fits: independent review task',
  local_script_primary_weighted: 'Local script fits: deterministic command, no judgement needed',
  local_script_primary_deterministic: 'Local script fits: deterministic command, no judgement needed',
  local_script_vetoed_fallback_claude: 'Claude fallback: local command was missing or unsafe',
  claude_primary_weighted: 'Claude fits: highest safe score after routing matrix',
  claude_primary_safety_veto: 'Claude fits: Codex was vetoed by risk, ambiguity, scope, or private context',
  claude_primary_judgment_required: 'Claude fits: ambiguity, private context, or planning judgement',
  claude_primary_unbounded_or_no_tests: 'Claude fits: unbounded task or no safe test contract',
  codex_unhealthy_fallback_claude: 'Claude fallback: Codex health check failed',
  codex_vetoed_fallback_claude: 'Claude fallback: Codex was vetoed by the execution contract',
  local_script_failed_fallback_codex: 'Codex fallback: local deterministic path failed',
  private_context_not_compiled: 'Claude fits: private SGSD context has not been compiled for Codex',
  compiled_private_context_available: 'Codex fits: Claude compiled the needed SGSD context into the capsule',
  execution_accepted: 'accepted by execution acceptance checks',
  execution_not_accepted: 'not accepted by execution acceptance checks',
  execution_timeout: 'timed out before acceptance',
  claude_handoff_required: 'Claude handoff required by route'
});

// -- Snapshot builder --------------------------------------------------------
function _safeCall(fn, label) {
  try {
    if (typeof fn !== 'function') {
      return { unavailable: true, reason: label + '-not-a-function' };
    }
    return fn();
  } catch (e) {
    return { unavailable: true, reason: (e && e.message) ? e.message : (label + '-error') };
  }
}

function _readJsonl(p) {
  try {
    if (!fs.existsSync(p)) return [];
    const text = fs.readFileSync(p, 'utf8');
    if (!text.trim()) return [];
    return text
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function _providerLabel(provider) {
  if (provider === 'codex') return 'Codex';
  if (provider === 'claude') return 'Claude';
  if (provider === 'local-script') return 'Local script';
  return provider || 'unknown';
}

function _routeWhy(row) {
  const d = row.decision || {};
  if (d.fallback_used && d.fallback_reason) {
    return 'Fallback: ' + String(d.fallback_reason);
  }
  const reasons = Array.isArray(row.reason_codes) ? row.reason_codes : [];
  for (const r of reasons) {
    if (EXECUTION_REASON_TEXT[r]) return EXECUTION_REASON_TEXT[r];
  }
  if (d.route_class && EXECUTION_REASON_TEXT[d.route_class]) {
    return EXECUTION_REASON_TEXT[d.route_class];
  }
  if (d.winning_reason) return 'Scored route: ' + String(d.winning_reason).replace(/_/g, ' ');
  if (d.route_class) return String(d.route_class).replace(/_/g, ' ');
  return 'route decision recorded without a human-readable reason';
}

function _routeWhat(row) {
  const d = row.decision || {};
  if (d.task_id && d.task_kind) return `${d.task_id} (${d.task_kind})`;
  if (d.task_id) return String(d.task_id);
  if (d.task_kind) return String(d.task_kind);
  if (d.role) return String(d.role);
  return 'execution task';
}

function _executionRouteSnapshot(planningDir, phase) {
  try {
    const rows = _readJsonl(path.join(planningDir, 'metrics', 'route-decisions.jsonl'))
      .filter((r) => r && r.boundary === 'execution_route');

    if (!rows.length) {
      return {
        has_rows: false,
        current_phase_match: false,
        provider: 'claude',
        provider_label: 'Claude',
        status: 'direct',
        what: 'direct SGSD agent execution',
        why: 'No double-agent execution route has been logged for this phase yet'
      };
    }

    const phaseText = (phase === undefined || phase === null) ? null : String(phase);
    const currentRows = phaseText
      ? rows.filter((r) => String(r.phase || '') === phaseText)
      : [];
    if (phaseText && !currentRows.length) {
      const old = rows[rows.length - 1];
      const oldDecision = old.decision || {};
      const oldProvider = oldDecision.chosen_provider || oldDecision.primary_provider || 'unknown';
      const oldPhase = old.phase || '?';
      return {
        has_rows: true,
        current_phase_match: false,
        latest_phase: old.phase || null,
        latest_milestone: old.milestone || null,
        ts: old.ts || null,
        status: 'direct',
        provider: 'claude',
        provider_label: 'Claude',
        old_provider: oldProvider,
        old_provider_label: _providerLabel(oldProvider),
        what: 'direct SGSD agent execution',
        why: `No execution route for current phase; last route was ${_providerLabel(oldProvider)} on P${oldPhase}`
      };
    }

    const row = (currentRows.length ? currentRows : rows)[(currentRows.length ? currentRows : rows).length - 1];
    const d = row.decision || {};
    const provider = d.chosen_provider || d.primary_provider || 'unknown';
    const tokenEstimate = d.token_estimate && typeof d.token_estimate.total_estimated_tokens === 'number'
      ? d.token_estimate.total_estimated_tokens
      : null;

    return {
      has_rows: true,
      current_phase_match: currentRows.length > 0,
      latest_phase: row.phase || null,
      latest_milestone: row.milestone || null,
      ts: row.ts || null,
      status: row.status || null,
      provider: provider,
      provider_label: _providerLabel(provider),
      primary_provider: d.primary_provider || null,
      route_class: d.route_class || null,
      task_id: d.task_id || null,
      task_kind: d.task_kind || null,
      role: d.role || null,
      what: _routeWhat(row),
      why: _routeWhy(row),
      fallback_used: !!d.fallback_used,
      fallback_reason: d.fallback_reason || null,
      tests_passed: !!d.tests_passed,
      accepted: !!d.accepted,
      applied: !!d.applied,
      changed_files_count: Array.isArray(d.changed_files) ? d.changed_files.length : 0,
      out_of_scope_count: Array.isArray(d.out_of_scope_files) ? d.out_of_scope_files.length : 0,
      estimated_tokens: tokenEstimate
    };
  } catch (e) {
    return {
      unavailable: true,
      reason: (e && e.message) ? e.message : 'execution-route-error'
    };
  }
}

function buildSnapshot(planningDir, phase) {
  const meta = {
    generated_at: new Date().toISOString(),
    planning_dir: planningDir || null,
    phase: phase || null
  };

  const out = {
    byRolePhase: null,
    budget: null,
    governance: null,
    budgets: null,
    executionRoute: null,
    panel_kinds: PANEL_KINDS,
    context_source_mix_keys: CONTEXT_SOURCE_MIX_KEYS,
    activity_window_sec: ACTIVITY_WINDOW_SEC,
    meta: meta
  };

  // byRolePhase
  if (!tokenAttr) {
    out.byRolePhase = { unavailable: true, reason: tokenAttrErr || 'token-attribution-missing' };
  } else {
    out.byRolePhase = _safeCall(
      function () { return tokenAttr.summarize(planningDir, { groupBy: 'role+phase' }); },
      'summarize'
    );
  }

  // budget verdict
  if (!tokenWaste) {
    out.budget = { unavailable: true, reason: tokenWasteErr || 'token-waste-missing' };
  } else {
    out.budget = _safeCall(
      function () { return tokenWaste.runCheck(planningDir, { phase: phase || null }); },
      'runCheck'
    );
  }

  // governance snapshot
  if (!memGov) {
    out.governance = { unavailable: true, reason: memGovErr || 'memory-governance-missing' };
  } else {
    out.governance = _safeCall(
      function () { return memGov.getMemoryGovernanceSnapshot(planningDir); },
      'getMemoryGovernanceSnapshot'
    );
  }

  // budgets thresholds (display-only mirror)
  try {
    out.budgets = (tokenAttr && tokenAttr.BLOAT_THRESHOLDS) ? tokenAttr.BLOAT_THRESHOLDS : null;
  } catch (e) {
    out.budgets = { unavailable: true, reason: (e && e.message) ? e.message : 'budgets-error' };
  }

  out.executionRoute = _executionRouteSnapshot(planningDir, phase || null);

  return out;
}

// -- Self-test ---------------------------------------------------------------
function _fingerprint(p) {
  try {
    const st = fs.statSync(p);
    return { path: p, mtimeMs: st.mtimeMs, size: st.size };
  } catch (e) {
    return { path: p, mtimeMs: null, size: null, missing: true };
  }
}

function selfTest() {
  let pass = 0;
  let fail = 0;
  const results = [];

  function check(name, ok) {
    if (ok) {
      pass++;
      results.push('PASS  ' + name);
    } else {
      fail++;
      results.push('FAIL  ' + name);
    }
  }

  // Test 1
  check('PANEL_KINDS.length === 7', PANEL_KINDS.length === 7);
  // Test 2
  check('Object.isFrozen(PANEL_KINDS)', Object.isFrozen(PANEL_KINDS) === true);
  // Test 3
  check('CONTEXT_SOURCE_MIX_KEYS.length === 7 && frozen',
    Object.isFrozen(CONTEXT_SOURCE_MIX_KEYS) === true && CONTEXT_SOURCE_MIX_KEYS.length === 7);
  // Test 4
  check('tokenAttr.summarize is function or unavailable',
    (tokenAttr && typeof tokenAttr.summarize === 'function') || tokenAttrErr !== null);
  // Test 5
  check('tokenWaste.runCheck is function or unavailable',
    (tokenWaste && typeof tokenWaste.runCheck === 'function') || tokenWasteErr !== null);
  // Test 6
  check('memGov.getMemoryGovernanceSnapshot is function or unavailable',
    (memGov && typeof memGov.getMemoryGovernanceSnapshot === 'function') || memGovErr !== null);

  // Test 7 + 8: build a snapshot against repo's own .planning, fingerprint
  // canonical streams pre/post and assert no drift.
  const planningDir = path.resolve(REPO_ROOT, '.planning');
  const targets = [
    path.join(planningDir, 'metrics', 'agent-token-spend.jsonl'),
    path.join(planningDir, 'metrics', 'token-waste-status.jsonl'),
    path.join(planningDir, 'metrics', 'context-packet-log.jsonl'),
    path.join(planningDir, 'metrics', 'intent-map.jsonl'),
    path.join(planningDir, 'metrics', 'route-decisions.jsonl')
  ];
  const before = targets.map(_fingerprint);

  let snap = null;
  try {
    snap = buildSnapshot(planningDir, '50');
  } catch (e) {
    // Lock 13: must never throw upward. selfTest treats a throw as failure.
    snap = null;
  }

  const sevenKeysOK = !!(snap
    && Object.prototype.hasOwnProperty.call(snap, 'byRolePhase')
    && Object.prototype.hasOwnProperty.call(snap, 'budget')
    && Object.prototype.hasOwnProperty.call(snap, 'governance')
    && Object.prototype.hasOwnProperty.call(snap, 'budgets')
    && Object.prototype.hasOwnProperty.call(snap, 'executionRoute')
    && Object.prototype.hasOwnProperty.call(snap, 'panel_kinds')
    && Object.prototype.hasOwnProperty.call(snap, 'context_source_mix_keys')
    && Object.prototype.hasOwnProperty.call(snap, 'activity_window_sec')
    && Object.prototype.hasOwnProperty.call(snap, 'meta')
    && typeof snap.meta.generated_at === 'string'
    && /^\d{4}-\d{2}-\d{2}T/.test(snap.meta.generated_at));
  check('buildSnapshot returns executionRoute + ISO meta.generated_at', sevenKeysOK);

  const after = targets.map(_fingerprint);
  let driftCount = 0;
  let driftPath = null;
  for (let i = 0; i < before.length; i++) {
    const b = before[i];
    const a = after[i];
    if (b.missing && a.missing) continue;
    if (b.missing !== a.missing) { driftCount++; driftPath = b.path; break; }
    if (b.mtimeMs !== a.mtimeMs || b.size !== a.size) { driftCount++; driftPath = b.path; break; }
  }
  check('canonical-stream fingerprint unchanged after buildSnapshot' + (driftPath ? ' (drift: ' + driftPath + ')' : ''),
    driftCount === 0);

  for (let i = 0; i < results.length; i++) {
    process.stdout.write(results[i] + '\n');
  }
  process.stdout.write('selfTest: ' + pass + '/' + (pass + fail) + ' pass\n');
  return fail === 0;
}

// -- CLI entry ---------------------------------------------------------------
if (require.main === module) {
  const arg = process.argv[2];
  if (arg === '--self-test') {
    process.exit(selfTest() ? 0 : 1);
  } else {
    const planningDir = arg || path.resolve(REPO_ROOT, '.planning');
    const phase = process.argv[3] || null;
    let snap;
    try {
      snap = buildSnapshot(planningDir, phase);
    } catch (e) {
      snap = {
        byRolePhase: { unavailable: true, reason: 'bridge-error' },
        budget: { unavailable: true, reason: 'bridge-error' },
        governance: { unavailable: true, reason: 'bridge-error' },
        budgets: null,
        executionRoute: { unavailable: true, reason: 'bridge-error' },
        panel_kinds: PANEL_KINDS,
        context_source_mix_keys: CONTEXT_SOURCE_MIX_KEYS,
        activity_window_sec: ACTIVITY_WINDOW_SEC,
        meta: {
          generated_at: new Date().toISOString(),
          planning_dir: planningDir,
          phase: phase,
          error: (e && e.message) ? e.message : 'unknown'
        }
      };
    }
    process.stdout.write(JSON.stringify(snap));
  }
}

module.exports = {
  buildSnapshot: buildSnapshot,
  selfTest: selfTest,
  PANEL_KINDS: PANEL_KINDS,
  ACTIVITY_WINDOW_SEC: ACTIVITY_WINDOW_SEC,
  CONTEXT_SOURCE_MIX_KEYS: CONTEXT_SOURCE_MIX_KEYS
};
