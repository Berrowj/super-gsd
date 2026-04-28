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
    path.join(planningDir, 'metrics', 'intent-map.jsonl')
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
    && Object.prototype.hasOwnProperty.call(snap, 'panel_kinds')
    && Object.prototype.hasOwnProperty.call(snap, 'context_source_mix_keys')
    && Object.prototype.hasOwnProperty.call(snap, 'activity_window_sec')
    && Object.prototype.hasOwnProperty.call(snap, 'meta')
    && typeof snap.meta.generated_at === 'string'
    && /^\d{4}-\d{2}-\d{2}T/.test(snap.meta.generated_at));
  check('buildSnapshot returns 8 top-level keys + ISO meta.generated_at', sevenKeysOK);

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
