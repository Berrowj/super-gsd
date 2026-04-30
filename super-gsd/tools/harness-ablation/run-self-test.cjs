// Self-test for harness ablation runner -- Phase 103 (v2.9 AHE).
// Asserts: spec validation, plan-ablation rejects protected, workspace
// isolation in tmpdir, main workspace byte-stable, interference rules
// fire on synthetic data, recordAblation appends, Lock-13 no-throw,
// ASCII source, public API stable. NO LLM, NO REAL BENCHMARK.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const ablate = require('./ablate.cjs');

const results = [];
function pass(n, d) { results.push({ ok: true }); console.log('PASS ' + n + (d ? '  (' + d + ')' : '')); }
function fail(n, d) { results.push({ ok: false }); console.log('FAIL ' + n + '  (' + d + ')'); }
function check(n, c, d) { if (c) pass(n, d); else fail(n, d); }

function tmpProject(label) {
  const root = path.join(os.tmpdir(), 'sgsd-ablate-test-' + label + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
  return root;
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ } }

// ------------------------------------------------------------
// A1 -- public API surface
// ------------------------------------------------------------
const expected = ['planAblation', 'isolateWorkspace', 'restoreWorkspace',
  'recordAblation', 'detectInterference', 'validateAblationSpec',
  'ablationLogPath', 'INTERFERENCE_RULES', 'DEFAULT_PROJECT'];
const apiMissing = expected.find(function (k) { return !(k in ablate); });
check('A1_public_api_stable', apiMissing === undefined, 'missing=' + apiMissing);

// ------------------------------------------------------------
// A2 -- INTERFERENCE_RULES is frozen and 3 entries
// ------------------------------------------------------------
check('A2_interference_rules_frozen_3',
  Object.isFrozen(ablate.INTERFERENCE_RULES) &&
  ablate.INTERFERENCE_RULES.length === 3,
  'frozen=' + Object.isFrozen(ablate.INTERFERENCE_RULES) +
  ' len=' + ablate.INTERFERENCE_RULES.length);

// ------------------------------------------------------------
// A3 -- validateAblationSpec rejects bad spec
// ------------------------------------------------------------
const e3 = ablate.validateAblationSpec({});
check('A3_bad_spec_rejected', e3.length >= 3, 'errs=' + e3.length);

// ------------------------------------------------------------
// A4 -- validateAblationSpec accepts good spec
// ------------------------------------------------------------
const e4 = ablate.validateAblationSpec({
  ablation_id: 'ab-test-001',
  target_component_id: 'context-packet',
  target_files: ['super-gsd/tools/context-packet'],
  expected_behavior: 'token cost should drop'
});
check('A4_good_spec_accepted', e4.length === 0, 'errs=' + e4.join('|'));

// ------------------------------------------------------------
// A5 -- planAblation refuses protected component
// ------------------------------------------------------------
const r5 = ablate.planAblation({
  spec: {
    ablation_id: 'ab-test-002',
    target_component_id: 'hidden-benchmark-decks',  // protected_oracle
    target_files: ['.planning/benchmarks/hidden'],
    expected_behavior: 'should not be allowed'
  }
});
check('A5_protected_refused',
  r5.ok === false &&
  r5.errors.some(function (x) { return x.indexOf('cannot_ablate_protected_surface') !== -1; }),
  'ok=' + r5.ok + ' errs=' + r5.errors.join('|'));

// ------------------------------------------------------------
// A6 -- planAblation refuses unknown component
// ------------------------------------------------------------
const r6 = ablate.planAblation({
  spec: {
    ablation_id: 'ab-test-003',
    target_component_id: 'no-such-component',
    target_files: ['x'],
    expected_behavior: 'unknown'
  }
});
check('A6_unknown_component_refused',
  r6.ok === false &&
  r6.errors.some(function (x) { return x.indexOf('component_not_in_registry') !== -1; }),
  'ok=' + r6.ok + ' errs=' + r6.errors.join('|'));

// ------------------------------------------------------------
// A7 -- planAblation accepts non-protected with requires_transfer_eval
// ------------------------------------------------------------
const r7 = ablate.planAblation({
  spec: {
    ablation_id: 'ab-test-004',
    target_component_id: 'cockpit-state-adapter',
    target_files: ['super-gsd/tools/cockpit-state/adapter.cjs'],
    expected_behavior: 'cockpit may go stale'
  }
});
check('A7_non_protected_planned',
  r7.ok === true && r7.ablation_spec &&
  r7.ablation_spec.requires_transfer_eval === true,
  'ok=' + r7.ok + ' transfer=' + (r7.ablation_spec && r7.ablation_spec.requires_transfer_eval));

// ------------------------------------------------------------
// A8 -- isolateWorkspace creates temp + main is byte-stable
// ------------------------------------------------------------
// Set up a fake "project" with one target file
const t8 = tmpProject('isolate');
const targetRel = 'super-gsd/tools/cockpit-state/adapter.cjs';
const fullSrc = path.join(t8, targetRel);
fs.mkdirSync(path.dirname(fullSrc), { recursive: true });
fs.writeFileSync(fullSrc, '// fake adapter\n', 'utf8');
const beforeMtime = fs.statSync(fullSrc).mtimeMs;

const iso = ablate.isolateWorkspace({
  projectDir: t8,
  ablation_id: 'ab-iso-test',
  target_files: [targetRel]
});

const afterMtime = fs.statSync(fullSrc).mtimeMs;
check('A8_main_workspace_byte_stable',
  iso.ok === true &&
  iso.temp_dir &&
  iso.temp_dir.indexOf(os.tmpdir()) === 0 &&
  beforeMtime === afterMtime &&
  fs.existsSync(fullSrc),
  'ok=' + iso.ok + ' main_unchanged=' + (beforeMtime === afterMtime));

// ------------------------------------------------------------
// A9 -- target file in temp is renamed to .ablated
// ------------------------------------------------------------
const ablatedExists = iso.files_renamed.length === 1 &&
  fs.existsSync(iso.files_renamed[0].ablated_path) &&
  iso.files_renamed[0].ablated_path.endsWith('.ablated');
check('A9_target_renamed_to_ablated',
  ablatedExists,
  'renamed=' + iso.files_renamed.length);

// ------------------------------------------------------------
// A10 -- restoreWorkspace cleans up temp
// ------------------------------------------------------------
const rest = ablate.restoreWorkspace({ temp_dir: iso.temp_dir });
check('A10_temp_cleaned',
  rest.ok === true && !fs.existsSync(iso.temp_dir),
  'ok=' + rest.ok + ' temp_exists=' + fs.existsSync(iso.temp_dir));
rmrf(t8);

// ------------------------------------------------------------
// A11 -- restoreWorkspace refuses paths outside tmpdir (safety)
// ------------------------------------------------------------
const r11 = ablate.restoreWorkspace({ temp_dir: '/etc' });
check('A11_restore_refuses_outside_tmpdir',
  r11.ok === false &&
  r11.errors.some(function (x) { return x.indexOf('refused_outside_tmpdir') !== -1; }),
  'ok=' + r11.ok + ' errs=' + r11.errors.join('|'));

// ------------------------------------------------------------
// A12 -- detectInterference: duplicate_verification fires on equal label counts
// ------------------------------------------------------------
const i12 = ablate.detectInterference(
  { labels: { state_projection_drift: 3 }, runtime_ms: 100, failures: 0, token_cost: 1000 },
  { labels: { state_projection_drift: 3 }, runtime_ms: 100, failures: 0, token_cost: 1000 }
);
check('A12_duplicate_verification_fires',
  i12.ok === true &&
  i12.signals.some(function (s) { return s.rule === 'duplicate_verification'; }),
  'signals=' + i12.signals.map(function (s) { return s.rule; }).join(','));

// ------------------------------------------------------------
// A13 -- detectInterference: redundant_gate_stack on speedup, same outcomes
// ------------------------------------------------------------
const i13 = ablate.detectInterference(
  { labels: {}, runtime_ms: 1000, failures: 0, token_cost: 500 },
  { labels: {}, runtime_ms: 800, failures: 0, token_cost: 500 }
);
check('A13_redundant_gate_fires',
  i13.ok === true &&
  i13.signals.some(function (s) { return s.rule === 'redundant_gate_stack'; }),
  'signals=' + i13.signals.map(function (s) { return s.rule; }).join(','));

// ------------------------------------------------------------
// A14 -- detectInterference: token_cost_inversion when ablation cuts tokens
// ------------------------------------------------------------
const i14 = ablate.detectInterference(
  { labels: {}, runtime_ms: 100, failures: 0, token_cost: 2000 },
  { labels: {}, runtime_ms: 100, failures: 0, token_cost: 1500 }
);
check('A14_token_inversion_fires',
  i14.ok === true &&
  i14.signals.some(function (s) { return s.rule === 'token_cost_inversion'; }),
  'signals=' + i14.signals.map(function (s) { return s.rule; }).join(','));

// ------------------------------------------------------------
// A15 -- recordAblation appends JSONL
// ------------------------------------------------------------
const t15 = tmpProject('record');
const a15 = ablate.recordAblation({
  ablation_id: 'ab-record-1',
  target_component_id: 'cockpit-state-adapter',
  outcome: { success: true, delta_token_cost: -50 }
}, { projectDir: t15 });
const ledger15 = path.join(t15, '.planning', 'metrics', 'harness-ablation.jsonl');
let lines15 = 0;
if (fs.existsSync(ledger15)) {
  lines15 = fs.readFileSync(ledger15, 'utf8').split('\n').filter(function (l) { return l.length > 0; }).length;
}
check('A15_record_appends',
  a15.ok === true && lines15 === 1,
  'ok=' + a15.ok + ' lines=' + lines15);
rmrf(t15);

// ------------------------------------------------------------
// A16 -- Lock-13 no throw on null inputs
// ------------------------------------------------------------
let threw = false;
try {
  ablate.planAblation(null);
  ablate.isolateWorkspace(null);
  ablate.restoreWorkspace(null);
  ablate.recordAblation(null);
  ablate.detectInterference(null, null);
  ablate.validateAblationSpec(null);
} catch (e) { threw = true; }
check('A16_lock13_no_throw_null_inputs', !threw, 'threw=' + threw);

// ------------------------------------------------------------
// A17 -- ASCII-only source (ablate.cjs)
// ------------------------------------------------------------
const aSrc = fs.readFileSync(path.join(__dirname, 'ablate.cjs'), 'utf8');
let nonAsciiA = -1;
for (let k = 0; k < aSrc.length; k++) {
  if (aSrc.charCodeAt(k) > 127) { nonAsciiA = k; break; }
}
check('A17_ablate_ascii_only', nonAsciiA === -1, 'idx=' + nonAsciiA);

// ------------------------------------------------------------
// A18 -- ASCII-only source (this self-test)
// ------------------------------------------------------------
const stSrc = fs.readFileSync(__filename, 'utf8');
let nonAsciiSt = -1;
for (let k = 0; k < stSrc.length; k++) {
  if (stSrc.charCodeAt(k) > 127) { nonAsciiSt = k; break; }
}
check('A18_self_test_ascii_only', nonAsciiSt === -1, 'idx=' + nonAsciiSt);

// ------------------------------------------------------------
// FOOTER
// ------------------------------------------------------------
const passed = results.filter(function (x) { return x.ok; }).length;
const total = results.length;
console.log('---');
console.log('harness-ablation-self-test: ' + passed + '/' + total + ' passed');
if (passed !== total) process.exit(1);
