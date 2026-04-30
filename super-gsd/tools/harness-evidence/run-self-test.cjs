// Self-test for trajectory evidence distiller -- Phase 99 (v2.9 AHE).
// Asserts: 11 root cause labels frozen, classifier deterministic, Lock-13
// no-throw on missing/malformed input, OVERVIEW <=4KB on benchmark-only,
// per-task reports link rather than copy, INDEX.json schema stable, ASCII
// source.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const distill = require('./distill.cjs');

const results = [];
function pass(n, d) { results.push({ ok: true }); console.log('PASS ' + n + (d ? '  (' + d + ')' : '')); }
function fail(n, d) { results.push({ ok: false }); console.log('FAIL ' + n + '  (' + d + ')'); }
function check(n, c, d) { if (c) pass(n, d); else fail(n, d); }

function tmpProject(name) {
  const root = path.join(os.tmpdir(), 'sgsd-distill-' + name + '-' + Date.now());
  fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
  return root;
}

function rmrf(p) {
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------
// A1 -- ROOT_CAUSES is frozen and 11 labels
// ------------------------------------------------------------
check('A1_root_causes_frozen_11',
  Object.isFrozen(distill.ROOT_CAUSES) && distill.ROOT_CAUSES.length === 11,
  'frozen=' + Object.isFrozen(distill.ROOT_CAUSES) + ' len=' + distill.ROOT_CAUSES.length);

// ------------------------------------------------------------
// A2 -- JSONL_SOURCES is frozen and 7 entries
// ------------------------------------------------------------
check('A2_jsonl_sources_frozen_7',
  Object.isFrozen(distill.JSONL_SOURCES) && distill.JSONL_SOURCES.length === 7,
  'frozen=' + Object.isFrozen(distill.JSONL_SOURCES) + ' len=' + distill.JSONL_SOURCES.length);

// ------------------------------------------------------------
// A3 -- classifyEvent returns array, includes unknown for empty
// ------------------------------------------------------------
const empty = distill.classifyEvent({});
check('A3_classify_empty_unknown',
  Array.isArray(empty) && empty.indexOf('unknown') !== -1,
  'labels=' + JSON.stringify(empty));

// ------------------------------------------------------------
// A4 -- classifyEvent finds projection_stale -> state_projection_drift
// ------------------------------------------------------------
const drift = distill.classifyEvent({ projection_stale: true, source: 'pulse' });
check('A4_classify_state_drift',
  drift.indexOf('state_projection_drift') !== -1,
  'labels=' + JSON.stringify(drift));

// ------------------------------------------------------------
// A5 -- classifyEvent finds provider_unavailable
// ------------------------------------------------------------
const prov = distill.classifyEvent({ status: 'failed', reason: 'codex_provider_unhealthy' });
check('A5_classify_provider_unavailable',
  prov.indexOf('provider_unavailable') !== -1,
  'labels=' + JSON.stringify(prov));

// ------------------------------------------------------------
// A6 -- classifyEvent finds successful_recovery_pattern
// ------------------------------------------------------------
const rec = distill.classifyEvent({ status: 'recovered', detail: 'successful_recovery' });
check('A6_classify_recovery',
  rec.indexOf('successful_recovery_pattern') !== -1,
  'labels=' + JSON.stringify(rec));

// ------------------------------------------------------------
// A7 -- classifier is deterministic (same input -> same output)
// ------------------------------------------------------------
const e = { phase: 98, plan: '98-01', status: 'ok', reason_codes: ['noop'] };
const r1 = JSON.stringify(distill.classifyEvent(e));
const r2 = JSON.stringify(distill.classifyEvent(e));
check('A7_classifier_deterministic', r1 === r2, 'r1=' + r1 + ' r2=' + r2);

// ------------------------------------------------------------
// A8 -- groupByPhasePlan groups events
// ------------------------------------------------------------
const grp = distill.groupByPhasePlan([
  { phase: 98, plan: '98-01', ts: '2026-04-30T00:00:00Z' },
  { phase: 98, plan: '98-01', ts: '2026-04-30T00:00:01Z' },
  { phase: 99, plan: '99-01', ts: '2026-04-30T00:00:02Z' }
]);
check('A8_groupByPhasePlan_keys',
  Object.keys(grp).length === 2 && grp['98:98-01'] && grp['98:98-01'].events.length === 2,
  'keys=' + Object.keys(grp).join(','));

// ------------------------------------------------------------
// A9 -- empty fixture (no JSONL) -> ok=false, errors lists nothing parsed
// ------------------------------------------------------------
const t1 = tmpProject('empty');
let r1Threw = false;
let r1Out = null;
try { r1Out = distill.distillRun({ projectDir: t1, run_id: 'test-empty' }); }
catch (e) { r1Threw = true; }
check('A9_empty_fixture_no_throw',
  !r1Threw && r1Out && r1Out.ok === false,
  'threw=' + r1Threw + ' ok=' + (r1Out && r1Out.ok));
rmrf(t1);

// ------------------------------------------------------------
// A10 -- malformed JSONL fixture -> ok=true with single error row, valid lines parsed
// ------------------------------------------------------------
const t2 = tmpProject('malformed');
fs.writeFileSync(path.join(t2, '.planning', 'metrics', 'activity-log.jsonl'),
  '{"ts":"2026-04-30T00:00:00Z","tool":"Read","phase":99}\n' +
  'NOT_VALID_JSON\n' +
  '{"ts":"2026-04-30T00:00:01Z","tool":"Write","phase":99}\n', 'utf8');
let r2Threw = false;
let r2Out = null;
try { r2Out = distill.distillRun({ projectDir: t2, run_id: 'test-malformed' }); }
catch (e) { r2Threw = true; }
check('A10_malformed_no_throw',
  !r2Threw && r2Out && r2Out.ok === true && r2Out.errors.length >= 1,
  'threw=' + r2Threw + ' ok=' + (r2Out && r2Out.ok) + ' errs=' + (r2Out && r2Out.errors.length));
rmrf(t2);

// ------------------------------------------------------------
// A11 -- benchmark-only fixture (no JSONL, has RUN.json) -> ok=true
// ------------------------------------------------------------
const t3 = tmpProject('benchmark');
const benchDir = path.join(t3, 'bench');
fs.mkdirSync(benchDir, { recursive: true });
fs.writeFileSync(path.join(benchDir, 'RUN.json'),
  JSON.stringify({ profile: 'smoke', total: 49, passed: 49 }), 'utf8');
fs.writeFileSync(path.join(benchDir, 'REPORT.md'),
  '# Bench Report\n\n49/49 passed.\n', 'utf8');
let r3Out = null;
try { r3Out = distill.distillRun({ projectDir: t3, benchmarkDir: benchDir, run_id: 'test-benchmark' }); }
catch (e) { /* ignore */ }
check('A11_benchmark_only_ok',
  r3Out && r3Out.ok === true,
  'ok=' + (r3Out && r3Out.ok));

// ------------------------------------------------------------
// A12 -- OVERVIEW.md is under 4KB on benchmark-only fixture
// ------------------------------------------------------------
check('A12_overview_under_4kb',
  r3Out && r3Out.overview_size_bytes < 4096,
  'size=' + (r3Out && r3Out.overview_size_bytes));
rmrf(t3);

// ------------------------------------------------------------
// A13 -- live-ish fixture (5 events / 2 phases) -> 2 task reports
// ------------------------------------------------------------
const t4 = tmpProject('live');
fs.writeFileSync(path.join(t4, '.planning', 'metrics', 'orchestrator-pulse.jsonl'),
  '{"ts":"2026-04-30T00:00:00Z","phase":98,"plan":"98-01","iteration":1}\n' +
  '{"ts":"2026-04-30T00:00:01Z","phase":98,"plan":"98-01","iteration":2}\n' +
  '{"ts":"2026-04-30T00:00:02Z","phase":99,"plan":"99-01","iteration":3,"projection_stale":true}\n' +
  '{"ts":"2026-04-30T00:00:03Z","phase":99,"plan":"99-01","iteration":4}\n' +
  '{"ts":"2026-04-30T00:00:04Z","phase":99,"plan":"99-01","iteration":5,"status":"successful_recovery"}\n',
  'utf8');
let r4Out = null;
try { r4Out = distill.distillRun({ projectDir: t4, run_id: 'test-live' }); }
catch (e) { /* ignore */ }
check('A13_live_fixture_two_tasks',
  r4Out && r4Out.ok === true && r4Out.task_paths.length === 2,
  'tasks=' + (r4Out && r4Out.task_paths.length));

// ------------------------------------------------------------
// A14 -- INDEX.json has expected schema
// ------------------------------------------------------------
let indexJson = null;
if (r4Out && r4Out.index_path && fs.existsSync(r4Out.index_path)) {
  try { indexJson = JSON.parse(fs.readFileSync(r4Out.index_path, 'utf8')); }
  catch (e) { /* ignore */ }
}
const expectedKeys = ['schema_version', 'run_id', 'generated', 'events_total',
  'sources', 'source_totals', 'group_keys', 'task_paths',
  'benchmark', 'errors', 'root_cause_vocab'];
const missing = expectedKeys.find(function (k) { return !indexJson || !(k in indexJson); });
check('A14_index_json_schema_stable', missing === undefined, 'missing=' + missing);

// ------------------------------------------------------------
// A15 -- per-task reports do NOT contain raw JSONL event lines (pointers, not copies)
// ------------------------------------------------------------
let taskHasRaw = false;
if (r4Out && r4Out.task_paths.length > 0) {
  const taskMd = fs.readFileSync(r4Out.task_paths[0], 'utf8');
  // A raw event line would be a JSON object. We expect english + bullet pointers.
  taskHasRaw = /^\{".+"\}$/m.test(taskMd);
}
check('A15_task_report_pointers_not_copies', !taskHasRaw,
  'has_raw_jsonl=' + taskHasRaw);
rmrf(t4);

// ------------------------------------------------------------
// A16 -- ASCII-only source (distill.cjs)
// ------------------------------------------------------------
const distillSrc = fs.readFileSync(path.join(__dirname, 'distill.cjs'), 'utf8');
let firstNonAsciiD = -1;
for (let i = 0; i < distillSrc.length; i++) {
  if (distillSrc.charCodeAt(i) > 127) { firstNonAsciiD = i; break; }
}
check('A16_distill_ascii_only', firstNonAsciiD === -1, 'first_nonascii_idx=' + firstNonAsciiD);

// ------------------------------------------------------------
// A17 -- ASCII-only source (this file)
// ------------------------------------------------------------
const stSrc = fs.readFileSync(__filename, 'utf8');
let firstNonAsciiSt = -1;
for (let i = 0; i < stSrc.length; i++) {
  if (stSrc.charCodeAt(i) > 127) { firstNonAsciiSt = i; break; }
}
check('A17_self_test_ascii_only', firstNonAsciiSt === -1, 'first_nonascii_idx=' + firstNonAsciiSt);

// ------------------------------------------------------------
// A18 -- public API surface stable
// ------------------------------------------------------------
const expected = ['distillRun', 'classifyEvent', 'groupByPhasePlan',
  'ROOT_CAUSES', 'JSONL_SOURCES', 'DEFAULT_PROJECT'];
const apiMissing = expected.find(function (k) { return !(k in distill); });
check('A18_public_api_stable', apiMissing === undefined, 'missing=' + apiMissing);

// ------------------------------------------------------------
// FOOTER
// ------------------------------------------------------------
const passed = results.filter(function (x) { return x.ok; }).length;
const total = results.length;
console.log('---');
console.log('harness-evidence-distill-self-test: ' + passed + '/' + total + ' passed');
if (passed !== total) process.exit(1);
