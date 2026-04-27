'use strict';
/**
 * Local fallback test for sampling-decider.cjs (Phase 38 SAMPLE-01..05).
 * Exercises the SAME exported helpers SKILL.md calls, against fixtures.
 *
 * 5 fixture cases per RESEARCH sec 10:
 *   1. All 9 matrix cells (lock 38.3 verbatim)
 *   2. Trivial phase work_risk -> 'low'
 *   3. Security phase work_risk -> 'high'
 *   4. --force-gates wires to route-ledger (boundary='gate_override')
 *   5. --force-gates without --override-reason -> exit 1
 *
 * Lib has zero external deps; live verification cannot be blocked by
 * provider_unavailable. Local fallback covers all SAMPLE-XX requirements
 * deterministically.
 *
 * Note on Fixture 3: with the locked formula (sec 4.2 verbatim), inputs
 * (diff_lines:50, files:2, feature, security:true) yield total=0.571 ->
 * 'medium'. To produce the documented 'high' verdict, the fixture uses
 * diff_lines:100 (total=0.633 >= 0.6 threshold). Plan deviation logged
 * in 38-01-SUMMARY.md as Rule 1 (plan internal inconsistency between
 * verbatim formula and stated test outcome). Formula is canonical.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const sd = require('./sampling-decider.cjs');

let pass = 0, fail = 0;
const failures = [];
function assert(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ name, detail: detail || '' }); }
}

// Fixture 1: all 9 cells per RESEARCH sec 2 table
const expected9 = [
  ['always',          'low',    'fire'],
  ['always',          'medium', 'fire'],
  ['always',          'high',   'fire'],
  ['sampled-rate-50', 'low',    'skip'],
  ['sampled-rate-50', 'medium', 'maybe'],
  ['sampled-rate-50', 'high',   'fire'],
  ['low-risk-skip',   'low',    'skip'],
  ['low-risk-skip',   'medium', 'fire'],
  ['low-risk-skip',   'high',   'fire'],
];
let allCellsCorrect = true;
const wrongCells = [];
for (const [tier, risk, expected] of expected9) {
  const got = sd.decide({ work_risk: risk, gate_sampling_tier: tier });
  if (got !== expected) { allCellsCorrect = false; wrongCells.push(`${tier}/${risk}: expected ${expected} got ${got}`); }
}
assert('1. all 9 matrix cells match lock 38.3', allCellsCorrect, wrongCells.join('; '));

// Fixture 2: docs phase, 10 lines, 1 file -> 'low'
const trivial = sd.scoreWorkRisk({
  diff_lines: 10, files_touched_count: 1,
  phase_type: 'docs', phase_includes_security_review: false,
});
assert('2. trivial phase scoreWorkRisk = low', trivial === 'low', `got ${trivial}`);

// Fixture 3: feature with security review -> primary midpoint + security pushes to high.
// Inputs sized so locked formula (sec 4.2) yields 'high' (>=0.6 threshold).
// 100/2/feature/security:true: 0.25*(0.5 + 0.333 + 0.7 + 1.0) = 0.633 -> high.
const security = sd.scoreWorkRisk({
  diff_lines: 100, files_touched_count: 2,
  phase_type: 'feature', phase_includes_security_review: true,
});
assert('3. security-review phase scoreWorkRisk = high', security === 'high', `got ${security}`);

// Fixture 4: --force-gates wires to route-ledger
// Spawn a tiny bootstrap helper that mimics the SKILL.md step 3.65 wiring:
// loads sampling-decider, calls parseGateOverrides with stub validator,
// then calls route-ledger logRouteDecision in a tmpdir.

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-test-'));
const bootstrapPath = path.join(tmp, 'bootstrap.cjs');
const libPath = path.resolve(__dirname, 'sampling-decider.cjs');
const rlPath = path.resolve(__dirname, 'route-ledger.cjs');
fs.writeFileSync(bootstrapPath, `
'use strict';
const sd = require(${JSON.stringify(libPath)});
const rl = require(${JSON.stringify(rlPath)});
const overrides = sd.parseGateOverrides(process.argv.slice(2), () => true);
const planningDir = process.argv[process.argv.length - 1]; // last arg = tmp planning dir
for (const g of overrides.force) {
  rl.logRouteDecision(planningDir, {
    boundary: 'gate_override', status: 'ok',
    phase: '38', milestone: 'v1.8',
    reason_codes: ['gate_force_override_with_reason'],
    decision: { gate: g, action: 'force', reason: overrides.reason },
  });
}
process.exit(0);
`, 'utf8');

const planningDir = path.join(tmp, '.planning');
fs.mkdirSync(path.join(planningDir, 'metrics'), { recursive: true });

const r = spawnSync(process.execPath, [
  bootstrapPath,
  '--force-gates', 'per-dispatch-ATC',
  '--override-reason', 'test-fixture',
  planningDir,
], { encoding: 'utf8' });

const ledger = path.join(planningDir, 'metrics', 'route-decisions.jsonl');
let row4 = null;
if (fs.existsSync(ledger)) {
  const lines = fs.readFileSync(ledger, 'utf8').split(/\r?\n/).filter(Boolean);
  if (lines.length === 1) { try { row4 = JSON.parse(lines[0]); } catch (_) { /* malformed */ } }
}
assert('4. --force-gates appends route-decisions.jsonl row with boundary=gate_override',
  r.status === 0 &&
  row4 &&
  row4.boundary === 'gate_override' &&
  row4.decision && row4.decision.gate === 'per-dispatch-ATC' &&
  row4.decision.action === 'force' &&
  row4.decision.reason === 'test-fixture' &&
  Array.isArray(row4.reason_codes) &&
  row4.reason_codes.includes('gate_force_override_with_reason'),
  `exit=${r.status}, stderr=${r.stderr}, row=${JSON.stringify(row4)}`
);

// Fixture 5: --force-gates without --override-reason -> exit 1
const r5 = spawnSync(process.execPath, [
  bootstrapPath,
  '--force-gates', 'per-dispatch-ATC',
  planningDir,
], { encoding: 'utf8' });
assert('5. --force-gates without --override-reason exits 1',
  r5.status === 1 && /require --override-reason/.test(r5.stderr || ''),
  `exit=${r5.status}, stderr=${r5.stderr}`
);

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`sampling-decider.test: ${pass} pass, ${fail} fail`);
if (fail > 0) {
  for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
  process.exit(1);
}
process.exit(0);
