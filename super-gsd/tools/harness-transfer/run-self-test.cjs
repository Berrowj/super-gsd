// Self-test for harness transfer evaluator -- Phase 104 (v2.9 AHE).
// Asserts: schema validation, frozen-before-run hard rule, 3 critical
// regression detectors, 2+ environment axes covered, append/read,
// report writer, Lock-13 no-throw, ASCII source, public API stable.
// NO LLM. NO REAL BENCHMARK.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const xfer = require('./evaluate.cjs');

const results = [];
function pass(n, d) { results.push({ ok: true }); console.log('PASS ' + n + (d ? '  (' + d + ')' : '')); }
function fail(n, d) { results.push({ ok: false }); console.log('FAIL ' + n + '  (' + d + ')'); }
function check(n, c, d) { if (c) pass(n, d); else fail(n, d); }

function tmpProject(label) {
  const root = path.join(os.tmpdir(), 'sgsd-transfer-' + label + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(path.join(root, '.planning', 'metrics'), { recursive: true });
  return root;
}
function rmrf(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) { /* ignore */ } }

function validRecord(opts) {
  return Object.assign({
    transfer_id: 'tx-test-' + Math.floor(Math.random() * 1e9),
    change_id: 'ch-test-001',
    frozen_at: '2026-04-30T00:00:00.000Z',
    started_at: '2026-04-30T00:01:00.000Z',
    completed_at: '2026-04-30T00:02:00.000Z',
    deck: 'deterministic_smoke',
    environment: {
      vtp_enabled: true, codex_available: true,
      shell: 'powershell', warp_assisted: false, fresh_clone: false
    },
    outcome: {
      success_rate: 1.0, failures_detected: 0,
      token_cost: 1000, runtime_ms: 30000,
      regressions_observed: []
    }
  }, opts || {});
}

// ------------------------------------------------------------
// A1 -- public API stable
// ------------------------------------------------------------
const expected = ['evaluateTransfer', 'recordTransfer', 'readTransfers',
  'writeTransferReport', 'detectCriticalRegression', 'isFrozenBeforeRun',
  'validateRecord', 'transferLogPath', 'TRANSFER_DECKS', 'ENVIRONMENT_AXES',
  'CRITICAL_REGRESSION_RULES', 'DEFAULT_PROJECT'];
const apiMissing = expected.find(function (k) { return !(k in xfer); });
check('A1_public_api_stable', apiMissing === undefined, 'missing=' + apiMissing);

// ------------------------------------------------------------
// A2 -- frozen vocabs
// ------------------------------------------------------------
const allFrozen = Object.isFrozen(xfer.TRANSFER_DECKS) &&
  Object.isFrozen(xfer.ENVIRONMENT_AXES) &&
  Object.isFrozen(xfer.CRITICAL_REGRESSION_RULES);
check('A2_vocabs_frozen', allFrozen, 'frozen=' + allFrozen);

// ------------------------------------------------------------
// A3 -- isFrozenBeforeRun hard rule
// ------------------------------------------------------------
check('A3_frozen_before_pass',
  xfer.isFrozenBeforeRun('2026-04-30T00:00:00Z', '2026-04-30T00:01:00Z') === true,
  'expected=true');

check('A3b_frozen_after_fail',
  xfer.isFrozenBeforeRun('2026-04-30T00:01:00Z', '2026-04-30T00:00:00Z') === false,
  'expected=false');

check('A3c_frozen_bad_input_fail',
  xfer.isFrozenBeforeRun(null, null) === false,
  'expected=false');

// ------------------------------------------------------------
// A4 -- evaluateTransfer rejects post-freeze manifests
// ------------------------------------------------------------
const r4 = xfer.evaluateTransfer({
  record: validRecord({
    frozen_at: '2026-04-30T00:01:00Z',
    started_at: '2026-04-30T00:00:00Z'  // started BEFORE frozen
  })
});
check('A4_post_freeze_rejected',
  r4.ok === false &&
  r4.errors.some(function (x) { return x.indexOf('frozen_at_must_precede_started_at') !== -1; }),
  'ok=' + r4.ok + ' errs=' + r4.errors.join('|'));

// ------------------------------------------------------------
// A5 -- evaluateTransfer accepts pre-freeze manifests
// ------------------------------------------------------------
const r5 = xfer.evaluateTransfer({ record: validRecord() });
check('A5_pre_freeze_accepted',
  r5.ok === true && r5.transfer_record &&
  r5.transfer_record.evaluated_at,
  'ok=' + r5.ok);

// ------------------------------------------------------------
// A6 -- detectCriticalRegression: success_rate drop
// ------------------------------------------------------------
const c6 = xfer.detectCriticalRegression(
  { outcome: { success_rate: 0.85, token_cost: 1000, regressions_observed: [] } },
  { outcome: { success_rate: 1.0, token_cost: 1000 } }
);
check('A6_success_drop_critical',
  c6.critical === true &&
  c6.reasons.some(function (r) { return r.indexOf('success_rate_drop') !== -1; }),
  'reasons=' + c6.reasons.join('|'));

// ------------------------------------------------------------
// A7 -- detectCriticalRegression: token_cost bloat
// ------------------------------------------------------------
const c7 = xfer.detectCriticalRegression(
  { outcome: { success_rate: 1.0, token_cost: 2500, regressions_observed: [] } },
  { outcome: { success_rate: 1.0, token_cost: 1000 } }
);
check('A7_token_bloat_critical',
  c7.critical === true &&
  c7.reasons.some(function (r) { return r.indexOf('token_cost_bloat') !== -1; }),
  'reasons=' + c7.reasons.join('|'));

// ------------------------------------------------------------
// A8 -- detectCriticalRegression: regressions_observed
// ------------------------------------------------------------
const c8 = xfer.detectCriticalRegression(
  { outcome: { success_rate: 1.0, token_cost: 1000,
    regressions_observed: ['surprise_label_1'] } },
  { outcome: { success_rate: 1.0, token_cost: 1000 } }
);
check('A8_regressions_observed_critical',
  c8.critical === true &&
  c8.reasons.some(function (r) { return r.indexOf('regressions_observed') !== -1; }),
  'reasons=' + c8.reasons.join('|'));

// ------------------------------------------------------------
// A9 -- non-critical case
// ------------------------------------------------------------
const c9 = xfer.detectCriticalRegression(
  { outcome: { success_rate: 1.0, token_cost: 1100, regressions_observed: [] } },
  { outcome: { success_rate: 1.0, token_cost: 1000 } }
);
check('A9_non_critical',
  c9.critical === false,
  'reasons=' + c9.reasons.join('|'));

// ------------------------------------------------------------
// A10 -- 2+ environment axes covered (powershell + codex_unavailable)
// ------------------------------------------------------------
const psRec = validRecord({
  environment: { vtp_enabled: true, codex_available: true,
    shell: 'powershell', warp_assisted: false, fresh_clone: false }
});
const codexOffRec = validRecord({
  transfer_id: 'tx-codex-off-' + Math.floor(Math.random() * 1e9),
  environment: { vtp_enabled: true, codex_available: false,
    shell: 'bash', warp_assisted: false, fresh_clone: false }
});
const er1 = xfer.evaluateTransfer({ record: psRec });
const er2 = xfer.evaluateTransfer({ record: codexOffRec });
check('A10_two_env_axes_covered',
  er1.ok === true && er2.ok === true &&
  er1.transfer_record.environment.shell === 'powershell' &&
  er2.transfer_record.environment.codex_available === false,
  'er1=' + er1.ok + ' er2=' + er2.ok);

// ------------------------------------------------------------
// A11 -- append + read round trip
// ------------------------------------------------------------
const t11 = tmpProject('append');
const a11 = xfer.recordTransfer(validRecord(), { projectDir: t11 });
const r11r = xfer.readTransfers(t11);
check('A11_append_and_read',
  a11.ok === true && r11r.ok === true && r11r.rows.length === 1,
  'append=' + a11.ok + ' rows=' + r11r.rows.length);
rmrf(t11);

// ------------------------------------------------------------
// A12 -- writeTransferReport produces non-empty markdown
// ------------------------------------------------------------
const t12 = tmpProject('report');
const reportPath = path.join(t12, 'REPORT.md');
const w12 = xfer.writeTransferReport({
  outPath: reportPath,
  records: [validRecord(), validRecord({ transfer_id: 'tx-r2-' + Math.floor(Math.random()*1e9) })]
});
const reportSize = fs.existsSync(reportPath) ? fs.statSync(reportPath).size : 0;
check('A12_report_written',
  w12.ok === true && reportSize > 100,
  'ok=' + w12.ok + ' size=' + reportSize);
rmrf(t12);

// ------------------------------------------------------------
// A13 -- Lock-13 no throw on null inputs
// ------------------------------------------------------------
let threw = false;
try {
  xfer.evaluateTransfer(null);
  xfer.recordTransfer(null);
  xfer.readTransfers(null);
  xfer.writeTransferReport(null);
  xfer.detectCriticalRegression(null, null);
  xfer.validateRecord(null);
  xfer.isFrozenBeforeRun(null, null);
} catch (e) { threw = true; }
check('A13_lock13_no_throw_null', !threw, 'threw=' + threw);

// ------------------------------------------------------------
// A14 -- validateRecord rejects bad deck
// ------------------------------------------------------------
const bad14 = xfer.validateRecord(validRecord({ deck: 'unicorn_deck' }));
check('A14_bad_deck_rejected',
  bad14.some(function (x) { return x.indexOf('deck_invalid') !== -1; }),
  'errs=' + bad14.join('|'));

// ------------------------------------------------------------
// A15 -- ASCII-only source (evaluate.cjs)
// ------------------------------------------------------------
const eSrc = fs.readFileSync(path.join(__dirname, 'evaluate.cjs'), 'utf8');
let nonAsciiE = -1;
for (let k = 0; k < eSrc.length; k++) {
  if (eSrc.charCodeAt(k) > 127) { nonAsciiE = k; break; }
}
check('A15_evaluate_ascii_only', nonAsciiE === -1, 'idx=' + nonAsciiE);

// ------------------------------------------------------------
// A16 -- ASCII-only source (this self-test)
// ------------------------------------------------------------
const stSrc = fs.readFileSync(__filename, 'utf8');
let nonAsciiSt = -1;
for (let k = 0; k < stSrc.length; k++) {
  if (stSrc.charCodeAt(k) > 127) { nonAsciiSt = k; break; }
}
check('A16_self_test_ascii_only', nonAsciiSt === -1, 'idx=' + nonAsciiSt);

// ------------------------------------------------------------
// FOOTER
// ------------------------------------------------------------
const passed = results.filter(function (x) { return x.ok; }).length;
const total = results.length;
console.log('---');
console.log('harness-transfer-self-test: ' + passed + '/' + total + ' passed');
if (passed !== total) process.exit(1);
