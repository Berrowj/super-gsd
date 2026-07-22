'use strict';

// ============================================================================
// rd-memo-schema tests
// ============================================================================
// Run: node super-gsd/scripts/lib/rd-memo-schema.test.cjs
//
// Every case here corresponds to a treaty rule that must hold mechanically
// rather than by reviewer diligence. Several exist because the RD-2026-001
// live run broke them:
//   - provenance was required by §4.5 r5 and collected by nothing
//   - predictions were tautological, defeating §4.5 r16
//   - js-yaml coerces unquoted ISO timestamps to Date, which silently failed
//     a string check and would have rejected every well-formed memo
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const schema = require('./rd-memo-schema.cjs');

// Do NOT derive the repo from __dirname. super-gsd is a junction on Windows
// (resolving outside the project) and a peer directory on devcp (/opt/clarity/
// super-gsd), so a fixed ../../.. hop lands somewhere different on each host.
// Walk up from the invocation directory looking for the marker instead.
function findRepoRoot(start) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.planning'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
const REPO = findRepoRoot(process.cwd());

const BASE = [
  'verdict: ADVANCE',
  'confidence: 4',
  'observations_cited:',
  '  - src/x.py:1 does a real thing',
  'inferences:',
  '  - reasoning from that',
  'strongest_uncertainty: the thing most likely wrong',
  'reversing_evidence:',
  '  - what would flip this',
  'case_against_self: the strongest argument I am wrong',
  'prediction:',
  '  gate_outcome: ADVANCE',
  '  basis: why',
  'rationale: concise',
].join('\n');

const PROV = [
  '',
  'provenance:',
  '  provider: openai',
  '  model_id: gpt-5.5',
  '  reasoning_effort: xhigh',
  '  template_version: rd-memo-v1.1',
  '  completed_at: 2026-07-22T16:05:00Z',
].join('\n');

let pass = 0;
const results = [];
function t(name, fn) {
  try {
    fn();
    results.push(`  PASS  ${name}`);
    pass += 1;
  } catch (error) {
    results.push(`  FAIL  ${name}\n        ${error.message}`);
  }
}

// ── Core contract ───────────────────────────────────────────────────────────
t('accepts a well-formed memo', () => assert.strictEqual(schema.validate(BASE).valid, true));
t('rejects an unknown verdict', () =>
  assert.strictEqual(schema.validate(BASE.replace('verdict: ADVANCE', 'verdict: MAYBE')).valid, false));
t('rejects confidence outside 1-5', () =>
  assert.strictEqual(schema.validate(BASE.replace('confidence: 4', 'confidence: 9')).valid, false));
t('requires placement_mode for the slot-architect seat', () =>
  assert.strictEqual(schema.validate(BASE, { requirePlacementMode: true }).valid, false));

// ── §2 invariant 1 — a claim must not become an observation ─────────────────
t('blocks ADVANCE on zero cited observations', () => {
  const memo = BASE.replace('  - src/x.py:1 does a real thing', '').replace('observations_cited:\n', 'observations_cited: []\n');
  assert.strictEqual(schema.validate(memo).valid, false);
});

// ── §10 superlative bar ─────────────────────────────────────────────────────
for (const word of ['breakthrough', 'seminal', 'state-of-the-art', 'first-ever']) {
  t(`superlative bar catches "${word}"`, () =>
    assert.strictEqual(schema.validate(BASE.replace('rationale: concise', `rationale: a ${word} result`)).valid, false));
}

// ── §13.5.1 blind ballot ────────────────────────────────────────────────────
for (const leak of ['the Contrarian disagrees', 'Moonshot argued otherwise', 'rd-board-cartographer said so']) {
  t(`blind ballot catches seat reference: "${leak}"`, () =>
    assert.strictEqual(schema.validate(BASE.replace('case_against_self: the strongest argument I am wrong', `case_against_self: ${leak}`)).valid, false));
}
for (const tally of ['3 of 4 members agree', 'the majority view', 'consensus so far']) {
  t(`blind ballot catches tally: "${tally}"`, () =>
    assert.strictEqual(schema.validate(BASE.replace('case_against_self: the strongest argument I am wrong', `case_against_self: ${tally}`)).valid, false));
}

// ── §4.5 r16 prediction must be a comparable token ──────────────────────────
t('rejects prose gate_outcome', () =>
  assert.strictEqual(schema.validate(BASE.replace('  gate_outcome: ADVANCE', '  gate_outcome: probably fine eventually')).valid, false));

// ── §4.5 r5 provenance (added v0.3.1) ───────────────────────────────────────
t('provenance not required by default (migration)', () =>
  assert.strictEqual(schema.validate(BASE).valid, true));
t('provenance required when asked', () =>
  assert.strictEqual(schema.validate(BASE, { requireProvenance: true }).valid, false));
t('provenance satisfied when complete', () =>
  assert.strictEqual(schema.validate(BASE + PROV, { requireProvenance: true }).valid, true));
t('partial provenance rejected', () =>
  assert.strictEqual(schema.validate(`${BASE}\nprovenance:\n  provider: openai`, { requireProvenance: true }).valid, false));
t('unquoted ISO timestamp normalises to string (js-yaml Date coercion)', () => {
  const r = schema.validate(BASE + PROV, { requireProvenance: true });
  assert.strictEqual(typeof r.parsed.provenance.completed_at, 'string');
});
t('quoted ISO timestamp preserved verbatim', () => {
  const quoted = PROV.replace('completed_at: 2026-07-22T16:05:00Z', 'completed_at: "2026-07-22T16:05:00Z"');
  const r = schema.validate(BASE + quoted, { requireProvenance: true });
  assert.strictEqual(r.parsed.provenance.completed_at, '2026-07-22T16:05:00Z');
});

// ── §4.5 r13 divergence floor ───────────────────────────────────────────────
t('identical memos score 0 divergence', () =>
  assert.strictEqual(schema.divergence([{ a: 'same words here' }, { a: 'same words here' }]).score, 0));
t('disjoint memos score 1 divergence', () =>
  assert.strictEqual(schema.divergence([{ a: 'alpha beta' }, { a: 'gamma delta' }]).score, 1));
t('floor voids a converged round', () =>
  assert.strictEqual(schema.checkDiversityFloor([{ a: 'x y z' }, { a: 'x y z' }], 0.4).void_round, true));
t('floor passes a genuinely divergent round', () =>
  assert.strictEqual(schema.checkDiversityFloor([{ a: 'alpha beta gamma' }, { a: 'delta epsilon zeta' }], 0.4).void_round, false));
t('null floor never voids (uncalibrated)', () =>
  assert.strictEqual(schema.checkDiversityFloor([{ a: 'x' }, { a: 'x' }], null).void_round, false));

// ── §4.5 r16 prediction scoring (added v0.3.1) ──────────────────────────────
t('tautological prediction is excluded, not scored correct', () => {
  const r = schema.scorePredictions([{ verdict: 'ADVANCE', prediction: { gate_outcome: 'ADVANCE' } }], 'REJECT_FIT');
  assert.strictEqual(r.tautological_count, 1);
  assert.strictEqual(r.informative_count, 0);
  assert.strictEqual(r.forecast_accuracy, null, 'no informative forecasts must yield null, not 0');
});
t('informative forecast is scored', () => {
  const r = schema.scorePredictions([{ verdict: 'ADVANCE', prediction: { gate_outcome: 'REJECT_FIT' } }], 'REJECT_FIT');
  assert.strictEqual(r.informative_count, 1);
  assert.strictEqual(r.forecast_accuracy, 1);
});
t('reproduces the RD-2026-001 all-tautological round', () => {
  const memos = [
    { verdict: 'ADVANCE_WITH_CONDITIONS', prediction: { gate_outcome: 'ADVANCE_WITH_CONDITIONS' } },
    { verdict: 'ADVANCE_WITH_CONDITIONS', prediction: { gate_outcome: 'ADVANCE_WITH_CONDITIONS' } },
    { verdict: 'REJECT_COMPLEXITY', prediction: { gate_outcome: 'REJECT_COMPLEXITY' } },
    { verdict: 'REJECT_EVIDENCE', prediction: { gate_outcome: 'REJECT_EVIDENCE' } },
  ];
  const r = schema.scorePredictions(memos, 'REJECT_COMPLEXITY');
  assert.strictEqual(r.tautological_count, 4);
  assert.strictEqual(r.forecast_accuracy, null);
});

// ── Regression: the four real memos from RD-2026-001 must keep parsing ──────
const memoDir = REPO ? path.join(REPO, '.planning', 'rd', 'candidates', 'RD-2026-001', 'memos') : null;
if (memoDir && fs.existsSync(memoDir)) {
  for (const seat of ['cartographer', 'experimentalist', 'contrarian', 'moonshot']) {
    t(`RD-2026-001 memo still parses: ${seat}`, () => {
      const raw = fs.readFileSync(path.join(memoDir, `${seat}.yaml`), 'utf8');
      const r = schema.validate(raw, { requirePlacementMode: seat === 'cartographer' });
      assert.strictEqual(r.valid, true, (r.errors || []).join('; '));
    });
  }
} else {
  results.push('  SKIP  RD-2026-001 memo regression (candidate dir absent)');
}

console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('  FAIL')).length;
console.log(`\n  ${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
