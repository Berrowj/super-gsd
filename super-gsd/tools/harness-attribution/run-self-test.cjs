// Self-test for harness attribution -- Phase 101 (v2.9 AHE).
// Asserts: 6 verdicts reachable, fix/regression metrics independent,
// rollback recommendation only on revert, Lock-13 no-throw, append/read
// round-trip, ASCII source, public API stable.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const attr = require('./attribute.cjs');

const results = [];
function pass(n, d) { results.push({ ok: true }); console.log('PASS ' + n + (d ? '  (' + d + ')' : '')); }
function fail(n, d) { results.push({ ok: false }); console.log('FAIL ' + n + '  (' + d + ')'); }
function check(n, c, d) { if (c) pass(n, d); else fail(n, d); }

function tmpProject(label) {
  const root = path.join(os.tmpdir(), 'sgsd-attr-' + label + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
  return root;
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ } }

function manifestOf(opts) {
  return Object.assign({
    schema_version: 1,
    change_id: 'ch-test',
    component_id: 'warp-doctor',
    component_class: 'tool',
    files: ['super-gsd/tools/warp-doctor/check.cjs'],
    evidence_ids: ['run-prev'],
    root_cause: 'gate_false_negative',
    targeted_fix: 'add probe',
    predicted_fixes: ['gate_false_negative'],
    predicted_regressions: [],
    expected_token_delta: 0,
    expected_gate_delta: 0,
    rollback_method: 'git-revert',
    protected_surface_check: 'false'
  }, opts || {});
}

// ------------------------------------------------------------
// A1 -- VERDICTS frozen, 6 entries
// ------------------------------------------------------------
check('A1_verdicts_frozen_6',
  Object.isFrozen(attr.VERDICTS) && attr.VERDICTS.length === 6,
  'frozen=' + Object.isFrozen(attr.VERDICTS) + ' len=' + attr.VERDICTS.length);

// ------------------------------------------------------------
// A2 -- TP fix: predicted_fix in prev, absent in next -> verdict 'keep'
// ------------------------------------------------------------
const r2 = attr.attribute({
  manifest: manifestOf({ predicted_fixes: ['gate_false_negative'], predicted_regressions: [] }),
  prevEvidence: { labels: ['gate_false_negative'], env: 'ok' },
  nextEvidence: { labels: [], env: 'ok' }
});
check('A2_tp_fix_keep',
  r2.ok === true && r2.verdict === 'keep' &&
  r2.fix_metrics.tp === 1 && r2.fix_metrics.fn === 0 &&
  r2.fix_metrics.recall === 1,
  'verdict=' + r2.verdict + ' fix=' + JSON.stringify(r2.fix_metrics));

// ------------------------------------------------------------
// A3 -- FN fix: predicted_fix still in next AND surprise regression -> 'revert'
// ------------------------------------------------------------
const r3 = attr.attribute({
  manifest: manifestOf({ predicted_fixes: ['gate_false_negative'], predicted_regressions: [] }),
  prevEvidence: { labels: ['gate_false_negative'], env: 'ok' },
  nextEvidence: { labels: ['gate_false_negative', 'token_budget_breach'], env: 'ok' }
});
check('A3_fn_fix_with_surprise_revert',
  r3.ok === true && r3.verdict === 'revert' &&
  r3.fix_metrics.fn === 1 &&
  r3.regression_metrics.surprises.indexOf('token_budget_breach') !== -1 &&
  r3.rollback_recommendation !== null,
  'verdict=' + r3.verdict + ' surprises=' + JSON.stringify(r3.regression_metrics.surprises));

// ------------------------------------------------------------
// A4 -- FN fix without surprise -> 'quarantine'
// ------------------------------------------------------------
const r4 = attr.attribute({
  manifest: manifestOf({ predicted_fixes: ['gate_false_negative', 'gate_false_positive'], predicted_regressions: [] }),
  prevEvidence: { labels: ['gate_false_negative', 'gate_false_positive'], env: 'ok' },
  nextEvidence: { labels: ['gate_false_negative'], env: 'ok' }
});
check('A4_fn_fix_no_surprise_quarantine',
  r4.ok === true && r4.verdict === 'quarantine' &&
  r4.fix_metrics.tp === 1 && r4.fix_metrics.fn === 1,
  'verdict=' + r4.verdict + ' fix=' + JSON.stringify(r4.fix_metrics));

// ------------------------------------------------------------
// A5 -- environmental skip: env != 'ok'
// ------------------------------------------------------------
const r5 = attr.attribute({
  manifest: manifestOf(),
  prevEvidence: { labels: ['gate_false_negative'], env: 'codex_unavailable' },
  nextEvidence: { labels: [], env: 'ok' }
});
check('A5_env_skip',
  r5.ok === true && r5.verdict === 'environmental_skip',
  'verdict=' + r5.verdict);

// ------------------------------------------------------------
// A6 -- pivot_component: repeated same-class failure flag set
// ------------------------------------------------------------
const r6 = attr.attribute({
  manifest: manifestOf(),
  prevEvidence: { labels: ['gate_false_negative'], env: 'ok' },
  nextEvidence: { labels: ['gate_false_negative'], env: 'ok' },
  repeated_same_class_failure: true
});
check('A6_pivot_component',
  r6.ok === true && r6.verdict === 'pivot_component',
  'verdict=' + r6.verdict);

// ------------------------------------------------------------
// A7 -- inconclusive: empty fix predictions, no surprises
// ------------------------------------------------------------
const r7 = attr.attribute({
  manifest: manifestOf({ predicted_fixes: [], predicted_regressions: [] }),
  prevEvidence: { labels: [], env: 'ok' },
  nextEvidence: { labels: [], env: 'ok' }
});
check('A7_inconclusive_no_predictions',
  r7.ok === true && r7.verdict === 'inconclusive',
  'verdict=' + r7.verdict);

// ------------------------------------------------------------
// A8 -- predicted regression observed (TP regression)
// ------------------------------------------------------------
const r8 = attr.attribute({
  manifest: manifestOf({
    predicted_fixes: ['gate_false_negative'],
    predicted_regressions: ['duplicate_verification']
  }),
  prevEvidence: { labels: ['gate_false_negative'], env: 'ok' },
  nextEvidence: { labels: ['duplicate_verification'], env: 'ok' }
});
check('A8_predicted_regression_observed',
  r8.ok === true && r8.regression_metrics.tp === 1,
  'reg=' + JSON.stringify(r8.regression_metrics));

// ------------------------------------------------------------
// A9 -- rollback recommendation only on revert
// ------------------------------------------------------------
check('A9_rollback_only_on_revert',
  r2.rollback_recommendation === null && r3.rollback_recommendation !== null,
  'r2=' + (r2.rollback_recommendation === null) + ' r3=' + (r3.rollback_recommendation !== null));

// ------------------------------------------------------------
// A10 -- rollback contains files + change_id, not prose only
// ------------------------------------------------------------
check('A10_rollback_has_exact_refs',
  r3.rollback_recommendation &&
  Array.isArray(r3.rollback_recommendation.files) &&
  r3.rollback_recommendation.change_id === 'ch-test' &&
  typeof r3.rollback_recommendation.manual_command === 'string',
  'has_files=' + Array.isArray(r3.rollback_recommendation.files) +
  ' change_id=' + r3.rollback_recommendation.change_id);

// ------------------------------------------------------------
// A11 -- Lock-13: bad input no throw
// ------------------------------------------------------------
let threw = false;
let bad = null;
try { bad = attr.attribute(null); }
catch (e) { threw = true; }
check('A11_lock13_no_throw_null',
  !threw && bad && bad.ok === false,
  'threw=' + threw + ' ok=' + (bad && bad.ok));

// ------------------------------------------------------------
// A12 -- Lock-13: missing manifest detected, not thrown
// ------------------------------------------------------------
const r12 = attr.attribute({
  prevEvidence: { labels: [], env: 'ok' },
  nextEvidence: { labels: [], env: 'ok' }
});
check('A12_missing_manifest_detected',
  r12.ok === false &&
  r12.errors.some(function (x) { return x.indexOf('manifest_required') !== -1; }),
  'ok=' + r12.ok + ' errs=' + r12.errors.join('|'));

// ------------------------------------------------------------
// A13 -- appendAttribution + readAttributions round-trip
// ------------------------------------------------------------
const t13 = tmpProject('append');
const a13 = attr.appendAttribution({
  change_id: 'ch-r-1',
  verdict: 'keep',
  evidence_ids: ['run-1', 'run-2'],
  fix_metrics: { tp: 1, fn: 0, fp: 0, precision: 1, recall: 1 },
  regression_metrics: { tp: 0, fn: 0, fp: 0, surprises: [], precision: null, recall: null }
}, { projectDir: t13 });
const r13r = attr.readAttributions(t13);
check('A13_append_and_read',
  a13.ok === true && r13r.ok === true && r13r.rows.length === 1 &&
  r13r.rows[0].change_id === 'ch-r-1',
  'append_ok=' + a13.ok + ' rows=' + r13r.rows.length);
rmrf(t13);

// ------------------------------------------------------------
// A14 -- appendAttribution rejects unknown verdict
// ------------------------------------------------------------
const t14 = tmpProject('badverdict');
const a14 = attr.appendAttribution({
  change_id: 'ch-bad', verdict: 'maybe-keep'
}, { projectDir: t14 });
check('A14_unknown_verdict_rejected',
  a14.ok === false &&
  a14.errors.some(function (x) { return x.indexOf('verdict_invalid') !== -1; }),
  'errs=' + a14.errors.join('|'));
rmrf(t14);

// ------------------------------------------------------------
// A15 -- findUnattributedManifests detects unattributed candidate
// ------------------------------------------------------------
const t15 = tmpProject('unattr');
fs.writeFileSync(
  path.join(t15, '.planning', 'metrics', 'harness-change-manifest.jsonl'),
  JSON.stringify({
    schema_version: 1, change_id: 'ch-unattr-1',
    component_id: 'warp-doctor', component_class: 'tool',
    files: ['x'], evidence_ids: ['e'], root_cause: 'unknown',
    targeted_fix: 'x', predicted_fixes: ['x'], predicted_regressions: [],
    expected_token_delta: 0, expected_gate_delta: 0,
    rollback_method: 'git-revert', protected_surface_check: 'false'
  }) + '\n', 'utf8');
const u15 = attr.findUnattributedManifests({ projectDir: t15 });
check('A15_unattributed_detected',
  u15.ok === true && u15.unattributed.length === 1 &&
  u15.unattributed[0].change_id === 'ch-unattr-1',
  'unattr=' + u15.unattributed.length);
rmrf(t15);

// ------------------------------------------------------------
// A16 -- ASCII-only source (attribute.cjs)
// ------------------------------------------------------------
const aSrc = fs.readFileSync(path.join(__dirname, 'attribute.cjs'), 'utf8');
let nonAsciiA = -1;
for (let i = 0; i < aSrc.length; i++) {
  if (aSrc.charCodeAt(i) > 127) { nonAsciiA = i; break; }
}
check('A16_attribute_ascii_only', nonAsciiA === -1, 'idx=' + nonAsciiA);

// ------------------------------------------------------------
// A17 -- ASCII-only source (this self-test)
// ------------------------------------------------------------
const stSrc = fs.readFileSync(__filename, 'utf8');
let nonAsciiSt = -1;
for (let i = 0; i < stSrc.length; i++) {
  if (stSrc.charCodeAt(i) > 127) { nonAsciiSt = i; break; }
}
check('A17_self_test_ascii_only', nonAsciiSt === -1, 'idx=' + nonAsciiSt);

// ------------------------------------------------------------
// A18 -- public API surface stable
// ------------------------------------------------------------
const expected = ['attribute', 'appendAttribution', 'readAttributions',
  'findUnattributedManifests', 'attributionPath', 'VERDICTS',
  'DEFAULT_PROJECT', 'computeFixMetrics', 'computeRegressionMetrics',
  'pickVerdict'];
const apiMissing = expected.find(function (k) { return !(k in attr); });
check('A18_public_api_stable', apiMissing === undefined, 'missing=' + apiMissing);

// ------------------------------------------------------------
// FOOTER
// ------------------------------------------------------------
const passed = results.filter(function (x) { return x.ok; }).length;
const total = results.length;
console.log('---');
console.log('harness-attribution-self-test: ' + passed + '/' + total + ' passed');
if (passed !== total) process.exit(1);
