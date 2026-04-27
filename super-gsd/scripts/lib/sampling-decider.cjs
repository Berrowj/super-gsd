// ============================================================================
// SGSD - SAMPLING-DECIDER 3x3 work-risk x gate-tier matrix
// ============================================================================
// Source of truth: pure data + pure functions; no JSONL writer here.
// All persistence happens via existing emitters:
//   - gates-registry.cjs (load-time validation)
//   - route-ledger.cjs   (--force-gates / --skip-gates audit)
//   - gate-value-log.cjs (skip vs sampled-skip discrimination)
//
// Reference: 38-RESEARCH.md
//   sec 2  -> MATRIX (3x3 = 9 cells)
//   sec 3  -> gates.yaml gate_sampling_tier mapping (13 gates)
//   sec 4  -> scoreWorkRisk algorithm (4 primary + 1 secondary; weights 0.25/0.10)
//   sec 6  -> CLI parser for --force-gates / --skip-gates / --override-reason
//   sec 7  -> public API surface (5 exported functions)
//   sec 9  -> self-test scaffold (17 assertions + canonical-fingerprint guard)
//   sec 11 -> LOCKED Q1-Q14 contract decisions (lock IDs 38.1-38.5)
//
// Failure contract: this lib NEVER throws upward at the orchestrator
// boundary. shouldSample wraps decide() in try/catch and returns true (safe
// default fire) on any internal error. Mirrors route-ledger.cjs:200-208 +
// gate-value-log.cjs Public-API never-throws contract.
//
// Wire-in note: 4 in-phase consumers
//   1. gates-registry.cjs::loadGates -> validateGatesYaml at load (SAMPLE-01)
//   2. sgsd-classifier.md output schema gains work_risk field (SAMPLE-02)
//   3. SKILL.md 3 sites (phase-level-ATC, MUDA-waste-audit, per-dispatch-ATC)
//      each call shouldSample after gates.shouldFire (SAMPLE-03)
//   4. SKILL.md cold_start step 3.65 calls parseGateOverrides on argv,
//      logs route-decisions.jsonl with boundary='gate_override' (SAMPLE-04+05)
//
// LOCKED scope (do not extend without DLB):
//   - Math.random() not seeded (LOCKED Q4) -- reproducibility OUT OF SCOPE v1.8.
//     Self-test asserts MATRIX cell verdict ('maybe'), not post-flip outcome.
//   - sgsd-recall-queries NOT wired (LOCKED Q11) -- v1.7 trigger sufficient.
//   - 7 cheap process-hygiene gates use 'always' tier -> no-op matrix.
//   - Missing gate_sampling_tier soft-warns + defaults to 'always' (lock 38.4).
//     Throw applies ONLY to invalid-enum values (poisoned config).
//   - --force-gates / --skip-gates require --override-reason (SAMPLE-05).
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

// Lock 38.1: 3 work-risk tiers. Frozen.
const WORK_RISKS = Object.freeze(['low', 'medium', 'high']);

// Lock 38.4 + sec 3: 3 gate-sampling tiers. Frozen.
const SAMPLING_TIERS = Object.freeze(['always', 'sampled-rate-50', 'low-risk-skip']);

// Sec 2: 3 verdicts. Frozen.
const VERDICTS = Object.freeze(['fire', 'skip', 'maybe']);

// Lock 38.4: default tier for unspecified gates.
const DEFAULT_TIER = 'always';

// Sec 2 verbatim: 3x3 = 9 cells. Outer + every nested level frozen.
const MATRIX = Object.freeze({
  'always':          Object.freeze({ low: 'fire', medium: 'fire', high: 'fire' }),
  'sampled-rate-50': Object.freeze({ low: 'skip', medium: 'maybe', high: 'fire' }),
  'low-risk-skip':   Object.freeze({ low: 'skip', medium: 'fire', high: 'fire' }),
});

// ----------------------------------------------------------------------------
// Public API #1 -- decide({work_risk, gate_sampling_tier}) -> 'fire'|'skip'|'maybe'
// Throws on invalid enum; caller (shouldSample) wraps. Per RESEARCH sec 7.1.
// ----------------------------------------------------------------------------
function decide({ work_risk, gate_sampling_tier }) {
  if (!WORK_RISKS.includes(work_risk)) {
    throw new Error(
      `sampling-decider: work_risk must be one of ${WORK_RISKS.join(', ')}; got '${work_risk}'`
    );
  }
  const tier = gate_sampling_tier || DEFAULT_TIER;
  if (!SAMPLING_TIERS.includes(tier)) {
    throw new Error(
      `sampling-decider: gate_sampling_tier must be one of ${SAMPLING_TIERS.join(', ')}; got '${tier}'`
    );
  }
  return MATRIX[tier][work_risk];
}

// ----------------------------------------------------------------------------
// Public API #2 -- scoreWorkRisk(inputs) -> 'low'|'medium'|'high'
// Per RESEARCH sec 4.2 verbatim; canonical implementation (single source of
// truth; classifier prompt cites this). 4 primary inputs (weight 0.25 each)
// + 1 secondary input (weight 0.10; <= 0.5 * primary per lock 38.2).
// ----------------------------------------------------------------------------
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function scoreWorkRisk({
  diff_lines,
  files_touched_count,
  phase_type,
  phase_includes_security_review,
  gate_fitness_history,
}) {
  const w_primary = 0.25;
  const w_secondary = 0.10;  // <= 0.5 * w_primary (lock 38.2)

  const s_diff = clamp01((diff_lines || 0) / 200);          // 200 lines = 1.0
  const s_files = clamp01((files_touched_count || 0) / 6);  // 6 files  = 1.0
  const s_type = ['docs', 'config'].includes(phase_type) ? 0
               : phase_type === 'refactor' ? 0.3
               : ['feature', 'bugfix'].includes(phase_type) ? 0.7
               : 0.5;
  const s_security = phase_includes_security_review ? 1.0 : 0;

  let total = w_primary * (s_diff + s_files + s_type + s_security);

  if (Array.isArray(gate_fitness_history) && gate_fitness_history.length) {
    const avg_block = gate_fitness_history
      .filter((g) => g.fires > 0)
      .reduce((s, g) => s + (g.block / g.fires), 0)
      / gate_fitness_history.length;
    total += w_secondary * clamp01(avg_block);
  }
  total = Math.min(1.0, total);

  if (total >= 0.6) return 'high';
  if (total >= 0.3) return 'medium';
  return 'low';
}

// ----------------------------------------------------------------------------
// Public API #3 -- shouldSample(ctx) -> boolean
// Per RESEARCH sec 7.2. NEVER throws upward (fire is safe default on error).
// ----------------------------------------------------------------------------
function shouldSample({ gate, work_risk, gates, gatesYamlPath, overrides }) {
  try {
    if (overrides && overrides.force && overrides.force.has(gate)) return true;
    if (overrides && overrides.skip && overrides.skip.has(gate)) return false;
    const row = gates.getGate(gate, gatesYamlPath);
    const tier = (row && row.gate_sampling_tier) || DEFAULT_TIER;
    const verdict = decide({ work_risk, gate_sampling_tier: tier });
    if (verdict === 'fire') return true;
    if (verdict === 'skip') return false;
    return Math.random() < 0.5;  // 'maybe' arm; not seeded (lock Q4)
  } catch (e) {
    console.warn('[SGSD] sampling-decider shouldSample failed (firing as safe default):', e.message);
    return true;
  }
}

// ----------------------------------------------------------------------------
// Public API #4 -- validateGatesYaml({gates}) -> {ok, violations[]}
// Per RESEARCH sec 7.4. Soft-warn for missing field; throw for invalid enum.
// Caller (gates-registry.cjs::loadGates) inspects severity to decide action.
// ----------------------------------------------------------------------------
function validateGatesYaml({ gates }) {
  const violations = [];
  for (const g of gates) {
    if (g.gate_sampling_tier === undefined) {
      violations.push({
        kind: 'missing', gate: g.name, severity: 'soft-warn',
        message: `gate '${g.name}' missing gate_sampling_tier (default '${DEFAULT_TIER}')`
      });
    } else if (!SAMPLING_TIERS.includes(g.gate_sampling_tier)) {
      violations.push({
        kind: 'invalid', gate: g.name, severity: 'throw',
        message: `gate '${g.name}' gate_sampling_tier='${g.gate_sampling_tier}' not in ${SAMPLING_TIERS.join(', ')}`
      });
    }
  }
  return { ok: violations.every((v) => v.severity !== 'throw'), violations };
}

// ----------------------------------------------------------------------------
// Public API #5 -- parseGateOverrides(argv, validateGate?) -> {force, skip, reason}
// Per RESEARCH sec 6.1 verbatim. SAMPLE-05: hard reject if force/skip without
// reason. LOCKED Q14: validate gate names against registry; symmetric-set
// check rejects gate-in-both-sets.
// ----------------------------------------------------------------------------
function parseGateOverrides(argv, validateGate /* optional fn(name) -> bool */) {
  const force = new Set();
  const skip = new Set();
  let reason = null;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--force-gates' && argv[i + 1]) {
      argv[i + 1].split(',').map((g) => force.add(g.trim())); i++;
    } else if (a === '--skip-gates' && argv[i + 1]) {
      argv[i + 1].split(',').map((g) => skip.add(g.trim())); i++;
    } else if (a === '--override-reason' && argv[i + 1]) {
      reason = String(argv[i + 1]).trim(); i++;
    } else if (a.startsWith('--force-gates=')) {
      // Phase 38 ATC CRIT fix (Claude): '--force-gates='.length === 14;
      // pre-fix used slice(15) which silently dropped the first character
      // of the first gate name in equals-syntax. Use string.length-of-prefix
      // (computed inline so no future drift) to make the slice index
      // mathematically derivable rather than a magic number.
      a.slice('--force-gates='.length).split(',').map((g) => force.add(g.trim()));
    } else if (a.startsWith('--skip-gates=')) {
      // Phase 38 ATC CRIT fix (Claude): '--skip-gates='.length === 13;
      // pre-fix used slice(14) which silently dropped the first character.
      // Same prefix-length inline computation.
      a.slice('--skip-gates='.length).split(',').map((g) => skip.add(g.trim()));
    } else if (a.startsWith('--override-reason=')) {
      reason = a.slice('--override-reason='.length).trim();
    }
  }

  // SAMPLE-05 hard rejection.
  if ((force.size > 0 || skip.size > 0) && (!reason || reason.length === 0)) {
    console.error('[SGSD] error: --force-gates/--skip-gates require --override-reason="..."');
    process.exit(1);
  }
  // LOCKED Q14: validate gate names; symmetric-set check.
  if (typeof validateGate === 'function') {
    for (const g of [...force, ...skip]) {
      if (!validateGate(g)) {
        console.error(`[SGSD] error: --force/skip-gates references unknown gate '${g}'`);
        process.exit(1);
      }
    }
  }
  for (const g of force) {
    if (skip.has(g)) {
      console.error(`[SGSD] error: gate '${g}' in both --force-gates and --skip-gates`);
      process.exit(1);
    }
  }
  return { force, skip, reason };
}

// ----------------------------------------------------------------------------
// Self-test (17 assertions per RESEARCH sec 9 verbatim).
// Anchors paths to __dirname (NOT process.cwd()) so canonical file fingerprint
// guard works from any working directory (CI, IDE, manual invocation).
// Mirrors route-ledger.cjs:286-420 selfTest scaffold.
// ----------------------------------------------------------------------------
function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) { pass++; }
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  // Capture canonical fingerprints BEFORE any work. Lib lives at
  // <repo>/super-gsd/scripts/lib/sampling-decider.cjs;
  // canonical gates.yaml at <repo>/super-gsd/registry/gates.yaml (2 dirs up + registry);
  // canonical route-decisions.jsonl at <repo>/.planning/metrics/route-decisions.jsonl
  // (3 dirs up + .planning).
  const gatesYaml = path.resolve(__dirname, '..', '..', 'registry', 'gates.yaml');
  const routeLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'route-decisions.jsonl');
  const gatesExisted = fs.existsSync(gatesYaml);
  const gatesMtimeBefore = gatesExisted ? fs.statSync(gatesYaml).mtimeMs : 0;
  const gatesSizeBefore = gatesExisted ? fs.statSync(gatesYaml).size : 0;
  const ledgerExisted = fs.existsSync(routeLedger);
  const ledgerMtimeBefore = ledgerExisted ? fs.statSync(routeLedger).mtimeMs : 0;
  const ledgerSizeBefore = ledgerExisted ? fs.statSync(routeLedger).size : 0;

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-'));
  try {
    // 1. WORK_RISKS frozen + length 3 + low/medium/high present.
    assert('1. WORK_RISKS frozen with 3 entries low/medium/high',
      Object.isFrozen(WORK_RISKS) && WORK_RISKS.length === 3 &&
      WORK_RISKS.includes('low') && WORK_RISKS.includes('medium') && WORK_RISKS.includes('high'));

    // 2. SAMPLING_TIERS frozen + length 3 + all three tiers present.
    assert('2. SAMPLING_TIERS frozen with 3 entries always/sampled-rate-50/low-risk-skip',
      Object.isFrozen(SAMPLING_TIERS) && SAMPLING_TIERS.length === 3 &&
      SAMPLING_TIERS.includes('always') &&
      SAMPLING_TIERS.includes('sampled-rate-50') &&
      SAMPLING_TIERS.includes('low-risk-skip'));

    // 3. VERDICTS frozen + length 3 + fire/skip/maybe present.
    assert('3. VERDICTS frozen with 3 entries fire/skip/maybe',
      Object.isFrozen(VERDICTS) && VERDICTS.length === 3 &&
      VERDICTS.includes('fire') && VERDICTS.includes('skip') && VERDICTS.includes('maybe'));

    // 4. MATRIX frozen at top + every nested level frozen.
    let allInnerFrozen = Object.isFrozen(MATRIX);
    for (const tier of SAMPLING_TIERS) {
      if (!Object.isFrozen(MATRIX[tier])) { allInnerFrozen = false; break; }
    }
    assert('4. MATRIX frozen at outer + nested levels', allInnerFrozen);

    // 5. decide() all 9 cells correct (iterate WORK_RISKS x SAMPLING_TIERS).
    const expected = {
      'always':          { low: 'fire', medium: 'fire', high: 'fire' },
      'sampled-rate-50': { low: 'skip', medium: 'maybe', high: 'fire' },
      'low-risk-skip':   { low: 'skip', medium: 'fire', high: 'fire' },
    };
    let allCellsOk = true;
    const wrong = [];
    for (const tier of SAMPLING_TIERS) {
      for (const risk of WORK_RISKS) {
        const got = decide({ work_risk: risk, gate_sampling_tier: tier });
        if (got !== expected[tier][risk]) {
          allCellsOk = false;
          wrong.push(`${tier}/${risk}: expected ${expected[tier][risk]} got ${got}`);
        }
      }
    }
    assert('5. decide() all 9 cells correct', allCellsOk, wrong.join('; '));

    // 6. decide() throws on bad work_risk.
    let threwRisk = false;
    try { decide({ work_risk: 'banana', gate_sampling_tier: 'always' }); }
    catch (e) { threwRisk = /work_risk must be one of/.test(e.message); }
    assert('6. decide() throws on bad work_risk', threwRisk);

    // 7. decide() throws on bad gate_sampling_tier.
    let threwTier = false;
    try { decide({ work_risk: 'low', gate_sampling_tier: 'turbo' }); }
    catch (e) { threwTier = /gate_sampling_tier must be one of/.test(e.message); }
    assert('7. decide() throws on bad gate_sampling_tier', threwTier);

    // 8. decide() default tier (gate_sampling_tier:undefined -> 'always' -> 'fire').
    const defaulted = decide({ work_risk: 'low', gate_sampling_tier: undefined });
    assert('8. decide() default tier gate_sampling_tier=undefined -> fire',
      defaulted === 'fire');

    // 9. scoreWorkRisk thresholds: 5 fixtures spanning low/medium/high tiers.
    // Inputs chosen to be unambiguous against the locked formula (sec 4.2):
    // - low:    docs phase, ~zero -> 0
    // - medium: feature 50/2 false (0.571)
    // - medium: refactor 100/3 false (0.333)
    // - high:   feature 200/6 true (0.925)
    // - high:   feature 100/2 true (0.633) -- security review pushes over 0.6
    const trivial = scoreWorkRisk({
      diff_lines: 10, files_touched_count: 1,
      phase_type: 'docs', phase_includes_security_review: false,
    });
    const mediumA = scoreWorkRisk({
      diff_lines: 50, files_touched_count: 2,
      phase_type: 'feature', phase_includes_security_review: false,
    });
    const mediumB = scoreWorkRisk({
      diff_lines: 100, files_touched_count: 3,
      phase_type: 'refactor', phase_includes_security_review: false,
    });
    const heavy = scoreWorkRisk({
      diff_lines: 200, files_touched_count: 6,
      phase_type: 'feature', phase_includes_security_review: true,
    });
    const security = scoreWorkRisk({
      diff_lines: 100, files_touched_count: 2,
      phase_type: 'feature', phase_includes_security_review: true,
    });
    assert('9. scoreWorkRisk thresholds (low/medium/medium/high/high)',
      trivial === 'low' && mediumA === 'medium' && mediumB === 'medium' &&
      heavy === 'high' && security === 'high',
      `got trivial=${trivial} mediumA=${mediumA} mediumB=${mediumB} heavy=${heavy} security=${security}`);

    // 10. scoreWorkRisk secondary bias <=50% per primary (lock 38.2).
    // Construct an input at primary-tier midpoint (just above 'medium' floor).
    // Empty history vs fully-blocked history should NOT cross a tier boundary.
    const baseInput = {
      diff_lines: 50, files_touched_count: 2,
      phase_type: 'feature', phase_includes_security_review: false,
    };
    const noHistory = scoreWorkRisk(baseInput);
    const fullyBlocked = scoreWorkRisk(Object.assign({}, baseInput, {
      gate_fitness_history: [{ fires: 100, block: 100 }, { fires: 100, block: 100 }],
    }));
    // Both must produce the SAME tier when only the secondary differs.
    assert('10. scoreWorkRisk secondary bias <=50% per primary',
      noHistory === fullyBlocked,
      `noHistory=${noHistory} fullyBlocked=${fullyBlocked}`);

    // 11. scoreWorkRisk cold-start (gate_fitness_history undefined or [] does NOT throw).
    let coldStartOk = true;
    try {
      scoreWorkRisk(Object.assign({}, baseInput, { gate_fitness_history: undefined }));
      scoreWorkRisk(Object.assign({}, baseInput, { gate_fitness_history: [] }));
      scoreWorkRisk(Object.assign({}, baseInput, { gate_fitness_history: null }));
    } catch (_) { coldStartOk = false; }
    assert('11. scoreWorkRisk cold-start does not throw on empty/null history', coldStartOk);

    // 12. validateGatesYaml accepts missing as soft-warn.
    const missing = validateGatesYaml({ gates: [{ name: 'g1' }] });
    assert('12. validateGatesYaml missing -> soft-warn',
      missing.ok === true && missing.violations.length === 1 &&
      missing.violations[0].severity === 'soft-warn' &&
      missing.violations[0].kind === 'missing');

    // 13. validateGatesYaml rejects invalid as throw.
    const invalid = validateGatesYaml({ gates: [{ name: 'g2', gate_sampling_tier: 'turbo' }] });
    assert('13. validateGatesYaml invalid enum -> throw',
      invalid.ok === false && invalid.violations.length === 1 &&
      invalid.violations[0].severity === 'throw' &&
      invalid.violations[0].kind === 'invalid');

    // 14. validateGatesYaml accepts all 3 valid tiers ({ok:true, violations:[]}).
    const allValid = validateGatesYaml({ gates: [
      { name: 'a', gate_sampling_tier: 'always' },
      { name: 'b', gate_sampling_tier: 'sampled-rate-50' },
      { name: 'c', gate_sampling_tier: 'low-risk-skip' },
    ]});
    assert('14. validateGatesYaml all valid tiers -> ok=true, violations=[]',
      allValid.ok === true && allValid.violations.length === 0);

    // 15. shouldSample respects force override.
    const stubGates = {
      getGate: () => ({ gate_sampling_tier: 'low-risk-skip' }),
    };
    const forced = shouldSample({
      gate: 'X', work_risk: 'low', gates: stubGates, gatesYamlPath: 'unused',
      overrides: { force: new Set(['X']), skip: new Set() },
    });
    assert('15. shouldSample respects force override (returns true)', forced === true);

    // 16. shouldSample respects skip override.
    const stubGates2 = {
      getGate: () => ({ gate_sampling_tier: 'always' }),
    };
    const skipped = shouldSample({
      gate: 'X', work_risk: 'high', gates: stubGates2, gatesYamlPath: 'unused',
      overrides: { force: new Set(), skip: new Set(['X']) },
    });
    assert('16. shouldSample respects skip override (returns false)', skipped === false);

    // 17. parseGateOverrides exits 1 without --override-reason (via spawnSync).
    const r17 = spawnSync(process.execPath, [
      __filename, '--parse-test', '--force-gates', 'per-dispatch-ATC',
    ], { encoding: 'utf8' });
    assert('17. parseGateOverrides exits 1 without --override-reason',
      r17.status === 1 && /require --override-reason/.test(r17.stderr || ''),
      `exit=${r17.status} stderr=${r17.stderr}`);

    // Bonus fingerprint guard: canonical gates.yaml + route-decisions.jsonl untouched.
    const gatesNowExists = fs.existsSync(gatesYaml);
    const gatesMtimeAfter = gatesNowExists ? fs.statSync(gatesYaml).mtimeMs : 0;
    const gatesSizeAfter = gatesNowExists ? fs.statSync(gatesYaml).size : 0;
    const ledgerNowExists = fs.existsSync(routeLedger);
    const ledgerMtimeAfter = ledgerNowExists ? fs.statSync(routeLedger).mtimeMs : 0;
    const ledgerSizeAfter = ledgerNowExists ? fs.statSync(routeLedger).size : 0;
    if (gatesExisted !== gatesNowExists ||
        gatesMtimeBefore !== gatesMtimeAfter ||
        gatesSizeBefore !== gatesSizeAfter) {
      fail++;
      failures.push({ name: 'BONUS. canonical gates.yaml fingerprint preserved',
        detail: `existed=${gatesExisted}->${gatesNowExists} mtime=${gatesMtimeBefore}->${gatesMtimeAfter} size=${gatesSizeBefore}->${gatesSizeAfter}` });
    }
    if (ledgerExisted !== ledgerNowExists ||
        ledgerMtimeBefore !== ledgerMtimeAfter ||
        ledgerSizeBefore !== ledgerSizeAfter) {
      fail++;
      failures.push({ name: 'BONUS. canonical route-decisions.jsonl fingerprint preserved',
        detail: `existed=${ledgerExisted}->${ledgerNowExists} mtime=${ledgerMtimeBefore}->${ledgerMtimeAfter} size=${ledgerSizeBefore}->${ledgerSizeAfter}` });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  console.log(`sampling-decider self-test: ${pass} pass, ${fail} fail`);
  if (fail > 0) {
    for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
    return 1;
  }
  return 0;
}

// -- main -------------------------------------------------------------------
if (require.main === module) {
  const cmd = process.argv[2];
  if (cmd === '--self-test') process.exit(selfTest());
  if (cmd === '--parse-test') {
    // Internal: assertion 17 invokes this with parseGateOverrides
    parseGateOverrides(process.argv.slice(2));
    process.exit(0);
  }
  console.log('Usage: node sampling-decider.cjs --self-test');
  console.log('  Or require() and call decide / shouldSample / scoreWorkRisk / validateGatesYaml / parseGateOverrides');
  console.log('  WORK_RISKS =', JSON.stringify(WORK_RISKS));
  console.log('  SAMPLING_TIERS =', JSON.stringify(SAMPLING_TIERS));
  process.exit(0);
}

module.exports = {
  decide,
  shouldSample,
  scoreWorkRisk,
  validateGatesYaml,
  parseGateOverrides,
  MATRIX,
  WORK_RISKS,
  SAMPLING_TIERS,
  VERDICTS,
  DEFAULT_TIER,
};
