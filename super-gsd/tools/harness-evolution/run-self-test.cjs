// Self-test for harness-evolution runner -- Phase 102 (v2.9 AHE).
// Asserts: 4 modes accessible, Lock-13 no-throw, protected-surface guard,
// dry-run is read-only, proposal-only writes manifest, apply-candidate
// route stub (no actual edit), attribute-only routes through Phase 101,
// ASCII-only, public API stable. NO LLM CALLS.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const runner = require('./run.cjs');

const results = [];
function pass(n, d) { results.push({ ok: true }); console.log('PASS ' + n + (d ? '  (' + d + ')' : '')); }
function fail(n, d) { results.push({ ok: false }); console.log('FAIL ' + n + '  (' + d + ')'); }
function check(n, c, d) { if (c) pass(n, d); else fail(n, d); }

function tmpProject(label) {
  const root = path.join(os.tmpdir(), 'sgsd-evolve-' + label + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
  return root;
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ } }

function writeSpec(dir, content) {
  const p = path.join(dir, 'spec.json');
  fs.writeFileSync(p, JSON.stringify(content), 'utf8');
  return p;
}

function validSpec(opts) {
  return Object.assign({
    change_id: 'ch-evolve-' + Math.floor(Math.random() * 1e9),
    component_id: 'warp-doctor',
    component_class: 'tool',
    files: ['super-gsd/tools/warp-doctor/check.cjs'],
    evidence_ids: ['run-test-001'],
    root_cause: 'gate_false_negative',
    targeted_fix: 'add probe X',
    predicted_fixes: ['gate_false_negative'],
    predicted_regressions: [],
    expected_token_delta: 0,
    expected_gate_delta: 0,
    rollback_method: 'git-revert',
    protected_surface_check: 'false'
  }, opts || {});
}

// ------------------------------------------------------------
// A1 -- public API surface stable
// ------------------------------------------------------------
const expected = ['runDryRun', 'runProposalOnly', 'runApplyCandidate',
  'runAttributeOnly', 'protectedSurfaceCheck', 'specToManifestEntry',
  'appendEvolutionEvent', 'logPath', 'DEFAULT_PROJECT'];
const apiMissing = expected.find(function (k) { return !(k in runner); });
check('A1_public_api_stable', apiMissing === undefined, 'missing=' + apiMissing);

// ------------------------------------------------------------
// A2 -- Lock-13: bad input no throw on each mode
// ------------------------------------------------------------
let threwAny = false;
const tries = [
  function () { return runner.runDryRun(null); },
  function () { return runner.runProposalOnly(null); },
  function () { return runner.runApplyCandidate(null); },
  function () { return runner.runAttributeOnly(null); }
];
for (const t of tries) { try { t(); } catch (e) { threwAny = true; } }
check('A2_lock13_no_throw_null_inputs', !threwAny, 'threwAny=' + threwAny);

// ------------------------------------------------------------
// A3 -- runDryRun emits proposal_summary, no manifest write
// ------------------------------------------------------------
const t3 = tmpProject('dry');
const sp3 = writeSpec(t3, validSpec());
const r3 = runner.runDryRun({ specPath: sp3, projectDir: t3 });
const manifestExists3 = fs.existsSync(path.join(
  t3, '.planning', 'metrics', 'harness-change-manifest.jsonl'));
check('A3_dry_run_no_manifest_write',
  r3.ok === true && r3.proposal_summary &&
  r3.proposal_summary.mode === 'dry-run' && manifestExists3 === false,
  'ok=' + r3.ok + ' manifest_written=' + manifestExists3);
rmrf(t3);

// ------------------------------------------------------------
// A4 -- runProposalOnly writes manifest entry
// ------------------------------------------------------------
const t4 = tmpProject('prop');
const sp4 = writeSpec(t4, validSpec());
const r4 = runner.runProposalOnly({ specPath: sp4, projectDir: t4 });
const mf4 = path.join(t4, '.planning', 'metrics', 'harness-change-manifest.jsonl');
let mf4Lines = 0;
if (fs.existsSync(mf4)) {
  mf4Lines = fs.readFileSync(mf4, 'utf8').split('\n').filter(function (l) { return l.length > 0; }).length;
}
check('A4_proposal_only_writes_manifest',
  r4.ok === true && mf4Lines === 1,
  'ok=' + r4.ok + ' manifest_lines=' + mf4Lines);
rmrf(t4);

// ------------------------------------------------------------
// A5 -- runApplyCandidate refuses protected component
// ------------------------------------------------------------
const t5 = tmpProject('refuse');
const sp5 = writeSpec(t5, validSpec({
  component_id: 'hidden-benchmark-decks',  // protected
  component_class: 'protected_oracle',
  files: ['.planning/benchmarks/hidden/deck.json']
}));
const r5 = runner.runApplyCandidate({ specPath: sp5, projectDir: t5 });
check('A5_apply_refuses_protected',
  r5.ok === false &&
  r5.errors.some(function (x) { return x.indexOf('refused:') !== -1; }),
  'ok=' + r5.ok + ' errs=' + r5.errors.join('|'));
rmrf(t5);

// ------------------------------------------------------------
// A6 -- runApplyCandidate accepts non-protected with route-only stub
// ------------------------------------------------------------
const t6 = tmpProject('apply');
const sp6 = writeSpec(t6, validSpec());
const r6 = runner.runApplyCandidate({
  specPath: sp6, projectDir: t6, mockProvider: 'mock-claude'
});
check('A6_apply_route_only_stub',
  r6.ok === true && r6.route_decision &&
  r6.route_decision.mode === 'route-only' &&
  r6.route_decision.chosen_provider === 'mock-claude',
  'ok=' + r6.ok + ' provider=' + (r6.route_decision && r6.route_decision.chosen_provider));
rmrf(t6);

// ------------------------------------------------------------
// A7 -- runAttributeOnly routes through Phase 101
// ------------------------------------------------------------
const t7 = tmpProject('attr');
const r7 = runner.runAttributeOnly({
  projectDir: t7,
  manifest: {
    change_id: 'ch-attr-1', component_id: 'warp-doctor',
    component_class: 'tool', files: ['x'], evidence_ids: ['e1'],
    root_cause: 'gate_false_negative', targeted_fix: 't',
    predicted_fixes: ['gate_false_negative'],
    predicted_regressions: [],
    expected_token_delta: 0, expected_gate_delta: 0,
    rollback_method: 'git-revert', protected_surface_check: 'false'
  },
  prevEvidence: { labels: ['gate_false_negative'], env: 'ok' },
  nextEvidence: { labels: [], env: 'ok' }
});
check('A7_attribute_only_keep',
  r7.ok === true && r7.verdict === 'keep',
  'ok=' + r7.ok + ' verdict=' + r7.verdict);
rmrf(t7);

// ------------------------------------------------------------
// A8 -- evolution-log JSONL appended on each mode
// ------------------------------------------------------------
const t8 = tmpProject('log');
const sp8 = writeSpec(t8, validSpec());
runner.runDryRun({ specPath: sp8, projectDir: t8 });
runner.runProposalOnly({ specPath: sp8, projectDir: t8 });
runner.runApplyCandidate({ specPath: sp8, projectDir: t8, mockProvider: 'm' });
const lp8 = path.join(t8, '.planning', 'metrics', 'harness-evolution-log.jsonl');
let lp8Lines = 0;
if (fs.existsSync(lp8)) {
  lp8Lines = fs.readFileSync(lp8, 'utf8').split('\n').filter(function (l) { return l.length > 0; }).length;
}
check('A8_evolution_log_appends',
  lp8Lines >= 3,
  'lines=' + lp8Lines);
rmrf(t8);

// ------------------------------------------------------------
// A9 -- protectedSurfaceCheck rejects unknown component
// ------------------------------------------------------------
const c9 = runner.protectedSurfaceCheck({ component_id: 'no-such-component' });
check('A9_unknown_component_rejected',
  c9.allowed === false &&
  c9.reason.indexOf('component_not_in_registry') !== -1,
  'allowed=' + c9.allowed + ' reason=' + c9.reason);

// ------------------------------------------------------------
// A10 -- protectedSurfaceCheck rejects protected file path
// ------------------------------------------------------------
const c10 = runner.protectedSurfaceCheck({
  component_id: 'warp-doctor',  // non-protected
  files: ['.planning/benchmarks/hidden']  // BUT path matches a protected row's path
});
check('A10_protected_path_rejected',
  c10.allowed === false &&
  c10.reason.indexOf('protected_path_in_files') !== -1,
  'allowed=' + c10.allowed + ' reason=' + c10.reason);

// ------------------------------------------------------------
// A11 -- protectedSurfaceCheck accepts non-protected
// ------------------------------------------------------------
const c11 = runner.protectedSurfaceCheck({
  component_id: 'warp-doctor', files: []
});
check('A11_non_protected_accepted',
  c11.allowed === true,
  'allowed=' + c11.allowed + ' reason=' + c11.reason);

// ------------------------------------------------------------
// A12 -- specToManifestEntry shape
// ------------------------------------------------------------
const e12 = runner.specToManifestEntry({
  change_id: 'ch-x', component_id: 'warp-doctor'
});
const required12 = ['schema_version', 'change_id', 'component_id',
  'component_class', 'files', 'evidence_ids', 'root_cause',
  'targeted_fix', 'predicted_fixes', 'predicted_regressions',
  'expected_token_delta', 'expected_gate_delta', 'rollback_method',
  'protected_surface_check'];
const missing12 = required12.find(function (k) { return !(k in e12); });
check('A12_specToManifestEntry_complete', missing12 === undefined,
  'missing=' + missing12);

// ------------------------------------------------------------
// A13 -- specToManifestEntry preserves operator_override_id
// ------------------------------------------------------------
const e13 = runner.specToManifestEntry({
  change_id: 'ch-y', component_id: 'warp-doctor',
  operator_override_id: 'OP-2026-04-30-Z'
});
check('A13_operator_override_preserved',
  e13.operator_override_id === 'OP-2026-04-30-Z',
  'override=' + e13.operator_override_id);

// ------------------------------------------------------------
// A14 -- runDryRun returns ok:false on missing spec
// ------------------------------------------------------------
const r14 = runner.runDryRun({});
check('A14_missing_spec_ok_false',
  r14.ok === false && r14.errors.length > 0,
  'ok=' + r14.ok + ' errs=' + r14.errors.join('|'));

// ------------------------------------------------------------
// A15 -- runDryRun returns ok:false on bad JSON
// ------------------------------------------------------------
const t15 = tmpProject('badjson');
const sp15 = path.join(t15, 'bad.json');
fs.writeFileSync(sp15, 'NOT VALID JSON {{{', 'utf8');
const r15 = runner.runDryRun({ specPath: sp15, projectDir: t15 });
check('A15_bad_spec_json_ok_false',
  r15.ok === false &&
  r15.errors.some(function (x) { return x.indexOf('spec_parse_failed') !== -1; }),
  'ok=' + r15.ok + ' errs=' + r15.errors.join('|'));
rmrf(t15);

// ------------------------------------------------------------
// A16 -- ASCII-only source (run.cjs)
// ------------------------------------------------------------
const rSrc = fs.readFileSync(path.join(__dirname, 'run.cjs'), 'utf8');
let nonAsciiR = -1;
for (let k = 0; k < rSrc.length; k++) {
  if (rSrc.charCodeAt(k) > 127) { nonAsciiR = k; break; }
}
check('A16_run_ascii_only', nonAsciiR === -1, 'idx=' + nonAsciiR);

// ------------------------------------------------------------
// A17 -- ASCII-only source (this self-test)
// ------------------------------------------------------------
const stSrc = fs.readFileSync(__filename, 'utf8');
let nonAsciiSt = -1;
for (let k = 0; k < stSrc.length; k++) {
  if (stSrc.charCodeAt(k) > 127) { nonAsciiSt = k; break; }
}
check('A17_self_test_ascii_only', nonAsciiSt === -1, 'idx=' + nonAsciiSt);

// ------------------------------------------------------------
// FOOTER
// ------------------------------------------------------------
const passed = results.filter(function (x) { return x.ok; }).length;
const total = results.length;
console.log('---');
console.log('harness-evolution-runner-self-test: ' + passed + '/' + total + ' passed');
if (passed !== total) process.exit(1);
