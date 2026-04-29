// Self-test for harness component catalog -- Phase 98 (v2.9 AHE).
// Asserts: 25+ rows, closed-vocab class enforcement, protected mapping,
// Lock-13 no-throw on bad input, ASCII source, deterministic public API,
// path-safety rules.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const catalog = require('./catalog.cjs');

const results = [];

function pass(name, detail) {
  results.push({ ok: true, name: name, detail: detail || '' });
  console.log('PASS ' + name + (detail ? '  (' + detail + ')' : ''));
}

function fail(name, detail) {
  results.push({ ok: false, name: name, detail: detail || '' });
  console.log('FAIL ' + name + '  (' + detail + ')');
}

function check(name, cond, detail) {
  if (cond) pass(name, detail); else fail(name, detail);
}

// ------------------------------------------------------------
// A1 -- registry loads cleanly, has 25+ rows, ok==true
// ------------------------------------------------------------
const r = catalog.loadRegistry();
check('A1_registry_loads_clean',
  r.ok === true && r.rows.length >= 25,
  'ok=' + r.ok + ' rows=' + r.rows.length + ' errs=' + JSON.stringify(r.errors).slice(0, 200));

// ------------------------------------------------------------
// A2 -- closed-vocab classes are exactly 14
// ------------------------------------------------------------
check('A2_class_vocab_size_14',
  catalog.listClasses().length === 14,
  'classes=' + catalog.listClasses().length);

// ------------------------------------------------------------
// A3 -- protected classes subset of all classes (3)
// ------------------------------------------------------------
const all = catalog.listClasses();
const prot = catalog.listProtectedClasses();
const protSubset = prot.every(function (c) { return all.includes(c); });
check('A3_protected_subset',
  protSubset && prot.length === 3,
  'prot=' + prot.length);

// ------------------------------------------------------------
// A4 -- COMPONENT_CLASSES is frozen
// ------------------------------------------------------------
check('A4_classes_frozen',
  Object.isFrozen(catalog.COMPONENT_CLASSES),
  'frozen=' + Object.isFrozen(catalog.COMPONENT_CLASSES));

// ------------------------------------------------------------
// A5 -- PROTECTED_CLASSES is frozen
// ------------------------------------------------------------
check('A5_protected_frozen',
  Object.isFrozen(catalog.PROTECTED_CLASSES),
  'frozen=' + Object.isFrozen(catalog.PROTECTED_CLASSES));

// ------------------------------------------------------------
// A6 -- every row uses a valid class
// ------------------------------------------------------------
const badClassRows = r.rows.filter(function (x) {
  return !catalog.COMPONENT_CLASSES.includes(x.class);
});
check('A6_every_row_valid_class',
  badClassRows.length === 0,
  'invalid=' + badClassRows.length);

// ------------------------------------------------------------
// A7 -- protected:true rows use a protected_* class
// ------------------------------------------------------------
const badProtRows = r.rows.filter(function (x) {
  return x.protected === true && !catalog.PROTECTED_CLASSES.includes(x.class);
});
check('A7_protected_class_alignment',
  badProtRows.length === 0,
  'mismatch=' + badProtRows.length);

// ------------------------------------------------------------
// A8 -- at least 4 protected rows (oracle, verifier, model_config, budget)
// ------------------------------------------------------------
const protectedRows = r.rows.filter(function (x) { return x.protected === true; });
check('A8_min_protected_rows',
  protectedRows.length >= 4,
  'protected_rows=' + protectedRows.length);

// ------------------------------------------------------------
// A9 -- every required field present on every row
// ------------------------------------------------------------
const required = ['id', 'class', 'paths', 'owner', 'edit_policy',
  'test_commands', 'rollback_method', 'protected'];
const missingFieldRows = r.rows.filter(function (x) {
  return required.some(function (f) { return !(f in x); });
});
check('A9_required_fields_present',
  missingFieldRows.length === 0,
  'rows_missing_fields=' + missingFieldRows.length);

// ------------------------------------------------------------
// A10 -- every row has at least 1 path
// ------------------------------------------------------------
const emptyPathRows = r.rows.filter(function (x) {
  return !Array.isArray(x.paths) || x.paths.length === 0;
});
check('A10_paths_non_empty',
  emptyPathRows.length === 0,
  'empty_path_rows=' + emptyPathRows.length);

// ------------------------------------------------------------
// A11 -- ids are unique
// ------------------------------------------------------------
const idSet = new Set();
let dupId = null;
for (const row of r.rows) {
  if (idSet.has(row.id)) { dupId = row.id; break; }
  idSet.add(row.id);
}
check('A11_unique_ids', dupId === null, 'dup=' + dupId);

// ------------------------------------------------------------
// A12 -- ids are kebab-case
// ------------------------------------------------------------
const kebabBad = r.rows.filter(function (x) {
  return typeof x.id !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(x.id);
});
check('A12_ids_kebab_case', kebabBad.length === 0,
  'bad_ids=' + kebabBad.map(function (x) { return x.id; }).join(','));

// ------------------------------------------------------------
// A13 -- findById returns the right row for a known id
// ------------------------------------------------------------
const found = catalog.findById('warp-doctor');
check('A13_findById_works',
  found !== null && found.id === 'warp-doctor' && found.class === 'tool',
  'found=' + (found && found.id));

// ------------------------------------------------------------
// A14 -- findById returns null for an unknown id
// ------------------------------------------------------------
const notFound = catalog.findById('does-not-exist-xyz');
check('A14_findById_unknown_returns_null',
  notFound === null,
  'val=' + JSON.stringify(notFound));

// ------------------------------------------------------------
// A15 -- Lock-13: bad path returns degraded envelope, never throws
// ------------------------------------------------------------
let threw = false;
let badRes = null;
try {
  badRes = catalog.loadRegistry('/no/such/file/here.yaml');
} catch (e) { threw = true; }
check('A15_lock13_no_throw_bad_path',
  !threw && badRes && badRes.ok === false && badRes.rows.length === 0,
  'threw=' + threw + ' ok=' + (badRes && badRes.ok));

// ------------------------------------------------------------
// A16 -- Lock-13: invalid YAML returns degraded envelope
// ------------------------------------------------------------
const tmp = path.join(os.tmpdir(), 'sgsd-bad-registry-' + Date.now() + '.yaml');
fs.writeFileSync(tmp, 'this is: not\n  valid {{{ yaml @@@\n');
let badYamlThrew = false;
let badYamlRes = null;
try { badYamlRes = catalog.loadRegistry(tmp); }
catch (e) { badYamlThrew = true; }
fs.unlinkSync(tmp);
check('A16_lock13_no_throw_bad_yaml',
  !badYamlThrew && badYamlRes && typeof badYamlRes.ok === 'boolean',
  'threw=' + badYamlThrew + ' ok=' + (badYamlRes && badYamlRes.ok));

// ------------------------------------------------------------
// A17 -- ASCII-only source (catalog.cjs)
// ------------------------------------------------------------
const catSrc = fs.readFileSync(path.join(__dirname, 'catalog.cjs'), 'utf8');
let firstNonAsciiCat = -1;
for (let k = 0; k < catSrc.length; k++) {
  if (catSrc.charCodeAt(k) > 127) { firstNonAsciiCat = k; break; }
}
check('A17_catalog_ascii_only',
  firstNonAsciiCat === -1,
  'first_nonascii_idx=' + firstNonAsciiCat);

// ------------------------------------------------------------
// A18 -- ASCII-only source (run-self-test.cjs)
// ------------------------------------------------------------
const stSrc = fs.readFileSync(__filename, 'utf8');
let firstNonAsciiSt = -1;
for (let k = 0; k < stSrc.length; k++) {
  if (stSrc.charCodeAt(k) > 127) { firstNonAsciiSt = k; break; }
}
check('A18_self_test_ascii_only',
  firstNonAsciiSt === -1,
  'first_nonascii_idx=' + firstNonAsciiSt);

// ------------------------------------------------------------
// A19 -- public API surface stable (4 expected functions + 3 constants)
// ------------------------------------------------------------
const expectedKeys = ['loadRegistry', 'listClasses', 'listProtectedClasses',
  'findById', 'COMPONENT_CLASSES', 'PROTECTED_CLASSES', 'REGISTRY_PATH_DEFAULT'];
const actualKeys = Object.keys(catalog);
const missingKey = expectedKeys.find(function (k) { return !actualKeys.includes(k); });
check('A19_public_api_stable',
  missingKey === undefined,
  'missing=' + missingKey);

// ------------------------------------------------------------
// A20 -- absolute paths rejected for non-memory rows (synthesized)
// ------------------------------------------------------------
// We verify by inspecting current rows: no non-memory row should have an absolute path
const absViolations = r.rows.filter(function (x) {
  if (x.class === 'memory') return false;
  if (!Array.isArray(x.paths)) return false;
  return x.paths.some(function (p) {
    return /^[A-Za-z]:[\\\/]/.test(p) || p.startsWith('/');
  });
});
check('A20_no_absolute_paths_outside_memory',
  absViolations.length === 0,
  'violations=' + absViolations.length);

// ------------------------------------------------------------
// A21 -- no '..' traversal in any path
// ------------------------------------------------------------
const traversalRows = r.rows.filter(function (x) {
  return Array.isArray(x.paths) && x.paths.some(function (p) {
    return p.includes('..');
  });
});
check('A21_no_path_traversal',
  traversalRows.length === 0,
  'traversal_rows=' + traversalRows.length);

// ------------------------------------------------------------
// FOOTER
// ------------------------------------------------------------
const passed = results.filter(function (x) { return x.ok; }).length;
const total = results.length;
console.log('---');
console.log('harness-components-catalog-self-test: ' + passed + '/' + total + ' passed');
if (passed !== total) process.exit(1);
