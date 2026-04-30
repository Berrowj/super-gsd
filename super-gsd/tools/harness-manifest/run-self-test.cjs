// Self-test for harness change manifest -- Phase 100 (v2.9 AHE).
// Asserts: schema enforcement, protected-surface guard, append + read,
// duplicate change_id rejection, ASCII-only, public API stability,
// Lock-13 no-throw, cross-link via task capsule.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const manifest = require('./manifest.cjs');

const results = [];
function pass(n, d) { results.push({ ok: true }); console.log('PASS ' + n + (d ? '  (' + d + ')' : '')); }
function fail(n, d) { results.push({ ok: false }); console.log('FAIL ' + n + '  (' + d + ')'); }
function check(n, c, d) { if (c) pass(n, d); else fail(n, d); }

function tmpProject(label) {
  const root = path.join(os.tmpdir(), 'sgsd-manifest-' + label + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
  return root;
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ } }

function validBaseEntry() {
  return {
    schema_version: 1,
    change_id: 'ch-test-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
    component_id: 'warp-doctor',
    component_class: 'tool',
    files: ['super-gsd/tools/warp-doctor/check.cjs'],
    evidence_ids: ['run-test-001'],
    root_cause: 'gate_false_negative',
    targeted_fix: 'add probe X to detect Y condition',
    predicted_fixes: ['probe X detects Y'],
    predicted_regressions: ['no expected regression'],
    expected_token_delta: -10,
    expected_gate_delta: 0,
    rollback_method: 'git-revert',
    protected_surface_check: 'false'
  };
}

// ------------------------------------------------------------
// A1 -- valid entry validates clean
// ------------------------------------------------------------
const errs1 = manifest.validateEntry(validBaseEntry());
check('A1_valid_entry_no_errors', errs1.length === 0, 'errs=' + JSON.stringify(errs1));

// ------------------------------------------------------------
// A2 -- missing required field is detected
// ------------------------------------------------------------
const e2 = validBaseEntry();
delete e2.predicted_fixes;
const errs2 = manifest.validateEntry(e2);
check('A2_missing_predicted_fixes_detected',
  errs2.some(function (x) { return x.indexOf('missing_required:predicted_fixes') !== -1; }),
  'errs=' + errs2.join('|'));

// ------------------------------------------------------------
// A3 -- empty predicted_fixes rejected (predictions are first-class)
// ------------------------------------------------------------
const e3 = validBaseEntry();
e3.predicted_fixes = [];
const errs3 = manifest.validateEntry(e3);
check('A3_empty_predicted_fixes_rejected',
  errs3.some(function (x) { return x.indexOf('predicted_fixes_must_be_nonempty') !== -1; }),
  'errs=' + errs3.join('|'));

// ------------------------------------------------------------
// A4 -- predicted_regressions can be empty array (low-risk fixes)
// ------------------------------------------------------------
const e4 = validBaseEntry();
e4.predicted_regressions = [];
const errs4 = manifest.validateEntry(e4);
check('A4_empty_predicted_regressions_allowed',
  errs4.length === 0, 'errs=' + errs4.join('|'));

// ------------------------------------------------------------
// A5 -- predicted_regressions=null rejected (must be array, no implicit nulls)
// ------------------------------------------------------------
const e5 = validBaseEntry();
e5.predicted_regressions = null;
const errs5 = manifest.validateEntry(e5);
check('A5_null_predicted_regressions_rejected',
  errs5.some(function (x) { return x.indexOf('predicted_regressions_must_be_array') !== -1; }),
  'errs=' + errs5.join('|'));

// ------------------------------------------------------------
// A6 -- unknown component_class rejected
// ------------------------------------------------------------
const e6 = validBaseEntry();
e6.component_class = 'fairy_dust';
const errs6 = manifest.validateEntry(e6);
check('A6_unknown_class_rejected',
  errs6.some(function (x) { return x.indexOf('component_class_invalid') !== -1; }),
  'errs=' + errs6.join('|'));

// ------------------------------------------------------------
// A7 -- unknown root_cause rejected
// ------------------------------------------------------------
const e7 = validBaseEntry();
e7.root_cause = 'unicorn_misalignment';
const errs7 = manifest.validateEntry(e7);
check('A7_unknown_root_cause_rejected',
  errs7.some(function (x) { return x.indexOf('root_cause_invalid') !== -1; }),
  'errs=' + errs7.join('|'));

// ------------------------------------------------------------
// A8 -- protected class without operator_override_id rejected
// ------------------------------------------------------------
const e8 = validBaseEntry();
e8.component_class = 'protected_oracle';
e8.component_id = 'hidden-benchmark-decks';
e8.protected_surface_check = 'true';
const errs8 = manifest.validateEntry(e8);
check('A8_protected_no_override_rejected',
  errs8.some(function (x) { return x.indexOf('protected_surface_requires_operator_override_id') !== -1; }),
  'errs=' + errs8.join('|'));

// ------------------------------------------------------------
// A9 -- protected class with empty operator_override_id rejected
// ------------------------------------------------------------
const e9 = validBaseEntry();
e9.component_class = 'protected_oracle';
e9.component_id = 'hidden-benchmark-decks';
e9.protected_surface_check = 'true';
e9.operator_override_id = '';
const errs9 = manifest.validateEntry(e9);
check('A9_protected_empty_override_rejected',
  errs9.some(function (x) { return x.indexOf('protected_surface_requires_operator_override_id') !== -1; }),
  'errs=' + errs9.join('|'));

// ------------------------------------------------------------
// A10 -- protected class WITH override accepted
// ------------------------------------------------------------
const e10 = validBaseEntry();
e10.component_class = 'protected_oracle';
e10.component_id = 'hidden-benchmark-decks';
e10.protected_surface_check = 'true';
e10.operator_override_id = 'OPERATOR-2026-04-30-A';
const errs10 = manifest.validateEntry(e10);
check('A10_protected_with_override_accepted',
  errs10.length === 0, 'errs=' + errs10.join('|'));

// ------------------------------------------------------------
// A11 -- append + read round trip
// ------------------------------------------------------------
const t11 = tmpProject('append');
const r11 = manifest.appendEntry(validBaseEntry(), { projectDir: t11 });
const r11r = manifest.readLedger(t11);
check('A11_append_and_read',
  r11.ok === true && r11r.ok === true && r11r.rows.length === 1,
  'append_ok=' + r11.ok + ' read_rows=' + r11r.rows.length);
rmrf(t11);

// ------------------------------------------------------------
// A12 -- duplicate change_id rejected
// ------------------------------------------------------------
const t12 = tmpProject('dup');
const e12 = validBaseEntry();
e12.change_id = 'ch-fixed-id-for-dup-test';
const r12a = manifest.appendEntry(e12, { projectDir: t12 });
const r12b = manifest.appendEntry(e12, { projectDir: t12 });
check('A12_duplicate_rejected',
  r12a.ok === true && r12b.ok === false &&
    r12b.errors.some(function (x) { return x.indexOf('duplicate_change_id') !== -1; }),
  'first_ok=' + r12a.ok + ' second_ok=' + r12b.ok + ' errs=' + r12b.errors.join('|'));
rmrf(t12);

// ------------------------------------------------------------
// A13 -- findByChangeId returns the entry
// ------------------------------------------------------------
const t13 = tmpProject('find');
const e13 = validBaseEntry();
e13.change_id = 'ch-findable-1';
manifest.appendEntry(e13, { projectDir: t13 });
const found = manifest.findByChangeId('ch-findable-1', { projectDir: t13 });
check('A13_findByChangeId_returns_entry',
  found !== null && found.change_id === 'ch-findable-1',
  'found=' + (found && found.change_id));
rmrf(t13);

// ------------------------------------------------------------
// A14 -- filterByComponentId returns matching rows
// ------------------------------------------------------------
const t14 = tmpProject('filter');
const eA = validBaseEntry();
eA.change_id = 'ch-comp-a-1';
eA.component_id = 'warp-doctor';
const eB = validBaseEntry();
eB.change_id = 'ch-comp-a-2';
eB.component_id = 'warp-doctor';
const eC = validBaseEntry();
eC.change_id = 'ch-comp-b-1';
eC.component_id = 'state-resolver';
const aR = manifest.appendEntry(eA, { projectDir: t14 });
const bR = manifest.appendEntry(eB, { projectDir: t14 });
const cR = manifest.appendEntry(eC, { projectDir: t14 });
const ledgerNow = manifest.readLedger(t14);
const wd = manifest.filterByComponentId('warp-doctor', { projectDir: t14 });
const sr = manifest.filterByComponentId('state-resolver', { projectDir: t14 });
check('A14_filterByComponentId',
  wd.length === 2 && sr.length === 1,
  'wd=' + wd.length + ' sr=' + sr.length +
  ' a_ok=' + aR.ok + ' b_ok=' + bR.ok + ' c_ok=' + cR.ok +
  ' a_err=' + (aR.errors || []).join(',') +
  ' b_err=' + (bR.errors || []).join(',') +
  ' rows_in_ledger=' + ledgerNow.rows.length);
rmrf(t14);

// ------------------------------------------------------------
// A15 -- Lock-13: bad input returns degraded envelope, never throws
// ------------------------------------------------------------
let threw = false;
let bad = null;
try { bad = manifest.validateEntry(null); }
catch (e) { threw = true; }
check('A15_lock13_no_throw_null',
  !threw && Array.isArray(bad) && bad.length > 0,
  'threw=' + threw + ' errs=' + (bad && bad.length));

// ------------------------------------------------------------
// A16 -- Lock-13: appendEntry on bad input does not throw
// ------------------------------------------------------------
let appendThrew = false;
let badAppend = null;
const t16 = tmpProject('bad-append');
try { badAppend = manifest.appendEntry({ random: 'thing' }, { projectDir: t16 }); }
catch (e) { appendThrew = true; }
check('A16_lock13_no_throw_append_bad',
  !appendThrew && badAppend && badAppend.ok === false && badAppend.errors.length > 0,
  'threw=' + appendThrew + ' ok=' + (badAppend && badAppend.ok));
rmrf(t16);

// ------------------------------------------------------------
// A17 -- ASCII-only source (manifest.cjs)
// ------------------------------------------------------------
const mSrc = fs.readFileSync(path.join(__dirname, 'manifest.cjs'), 'utf8');
let firstNonAsciiM = -1;
for (let k = 0; k < mSrc.length; k++) {
  if (mSrc.charCodeAt(k) > 127) { firstNonAsciiM = k; break; }
}
check('A17_manifest_ascii_only', firstNonAsciiM === -1, 'idx=' + firstNonAsciiM);

// ------------------------------------------------------------
// A18 -- ASCII-only source (this self-test)
// ------------------------------------------------------------
const stSrc = fs.readFileSync(__filename, 'utf8');
let firstNonAsciiSt = -1;
for (let k = 0; k < stSrc.length; k++) {
  if (stSrc.charCodeAt(k) > 127) { firstNonAsciiSt = k; break; }
}
check('A18_self_test_ascii_only', firstNonAsciiSt === -1, 'idx=' + firstNonAsciiSt);

// ------------------------------------------------------------
// A19 -- public API surface stable
// ------------------------------------------------------------
const expected = ['validateEntry', 'appendEntry', 'readLedger',
  'findByChangeId', 'filterByComponentId', 'ledgerPath',
  'SCHEMA_VERSION', 'COMPONENT_CLASSES', 'PROTECTED_CLASSES',
  'ROOT_CAUSES', 'ROLLBACK_METHODS', 'REQUIRED_FIELDS'];
const apiMissing = expected.find(function (k) { return !(k in manifest); });
check('A19_public_api_stable', apiMissing === undefined, 'missing=' + apiMissing);

// ------------------------------------------------------------
// A20 -- frozen vocabs (COMPONENT_CLASSES + PROTECTED_CLASSES + ROOT_CAUSES + ROLLBACK_METHODS)
// ------------------------------------------------------------
const allFrozen = Object.isFrozen(manifest.COMPONENT_CLASSES)
  && Object.isFrozen(manifest.PROTECTED_CLASSES)
  && Object.isFrozen(manifest.ROOT_CAUSES)
  && Object.isFrozen(manifest.ROLLBACK_METHODS);
check('A20_vocabs_frozen', allFrozen, 'frozen=' + allFrozen);

// ------------------------------------------------------------
// A21 -- task-capsule schema accepts harness_change_id pattern (file-level check)
// ------------------------------------------------------------
const schemaPath = path.join(__dirname, '..', 'double-agent-executor', 'task-capsule.schema.json');
const schemaSrc = fs.readFileSync(schemaPath, 'utf8');
const schemaJson = JSON.parse(schemaSrc);
const hasHCID = !!(schemaJson.properties && schemaJson.properties.harness_change_id);
check('A21_capsule_schema_has_harness_change_id', hasHCID, 'present=' + hasHCID);

// ------------------------------------------------------------
// FOOTER
// ------------------------------------------------------------
const passed = results.filter(function (x) { return x.ok; }).length;
const total = results.length;
console.log('---');
console.log('harness-manifest-self-test: ' + passed + '/' + total + ' passed');
if (passed !== total) process.exit(1);
