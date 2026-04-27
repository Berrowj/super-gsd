// ============================================================================
// SGSD - gate-value-log local fallback test (Phase 36 Patch 4)
// ============================================================================
// LIVE proof: subsequent phase-level-ATC / per-dispatch-ATC / MUDA-waste-audit
//   gate fires append rows via the SKILL.md wire-ins (T1.A2).
// LOCAL proof (this file): 4 outcome fixtures (pass/warn/block/skip) calling
//   the SAME exported logGateValue helper that SKILL.md calls.
//
// No mocks: imports from production lib at gate-value-log.cjs.
// tmpdir-isolated; canonical .planning/metrics/gate-value-log.jsonl untouched.
//
// Mirrors the local-fallback pattern of any prior Phase 32+34 verifier
// (no separate mocha/jest dep -- plain assert + run-as-script).
// ============================================================================

const fs   = require('fs');
const os   = require('os');
const path = require('path');
const {
  logGateValue,
  readGateValueRows,
  outcomeFromVerdict,
  ledgerPath,
} = require('./gate-value-log.cjs');

let pass = 0, fail = 0;
const failures = [];
function assert(name, cond, detail) {
  if (cond) { pass++; }
  else      { fail++; failures.push({ name, detail: detail || '' }); }
}

// Fingerprint guard: anchor to __dirname (parity with self-test).
const realLedger = path.resolve(__dirname, '..', '..', '..', '.planning', 'metrics', 'gate-value-log.jsonl');
const realExistedBefore = fs.existsSync(realLedger);
const realMtimeBefore   = realExistedBefore ? fs.statSync(realLedger).mtimeMs : 0;
const realSizeBefore    = realExistedBefore ? fs.statSync(realLedger).size : 0;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gvl-test-'));

try {
  // Fixture 1: phase-level-ATC SKIP arm.
  const f1 = logGateValue(tmp, {
    gate:        'phase-level-ATC',
    outcome:     'skip',
    phase:       '36',
    milestone:   'v1.8',
    retroactive: { step: '6.5', category: 'code-quality', enforcement_mode: 'hard-halt', version: '2.1' },
  });
  assert('F1 phase-level-ATC skip',
    f1 && f1.outcome === 'skip' && f1.status === 'skipped' &&
    f1.gate === 'phase-level-ATC' &&
    Array.isArray(f1.reason_codes) && f1.reason_codes.includes('gate_skip_with_reason') &&
    Array.isArray(f1.evidence) && f1.evidence.length === 0 &&
    f1.envelope_version === 1 && f1.command === 'logGateValue');

  // Fixture 2: phase-level-ATC FIRE arm with verdict=pass.
  const v2 = outcomeFromVerdict('pass');
  const f2 = logGateValue(tmp, {
    gate:        'phase-level-ATC',
    outcome:     v2,
    phase:       '36',
    milestone:   'v1.8',
    retroactive: { step: '6.5', category: 'code-quality', enforcement_mode: 'hard-halt', version: '2.1' },
  });
  assert('F2 phase-level-ATC pass',
    v2 === 'pass' && f2 && f2.outcome === 'pass' && f2.status === 'ok' &&
    f2.reason_codes.includes('review_unanimous_pass'));

  // Fixture 3: per-dispatch-ATC FIRE arm with verdict=critical, criticalCount=3.
  const v3 = outcomeFromVerdict('critical', 3);
  const f3 = logGateValue(tmp, {
    gate:        'per-dispatch-ATC',
    outcome:     v3,
    phase:       '36',
    milestone:   'v1.8',
    evidence:    [{ kind: 'review_report', ref: '/tmp/per-dispatch-atc-fixture.md' }],
    retroactive: { step: '9.5', category: 'code-quality', enforcement_mode: 'hard-halt', version: '2.0' },
  });
  assert('F3 per-dispatch-ATC block',
    v3 === 'block' && f3 && f3.outcome === 'block' && f3.status === 'fail' &&
    f3.reason_codes.includes('atc_critical') &&
    f3.evidence.length === 1 && f3.evidence[0].kind === 'review_report');

  // Fixture 4: MUDA-waste-audit FIRE arm with shell exit 1 -> warn.
  const f4 = logGateValue(tmp, {
    gate:        'MUDA-waste-audit',
    outcome:     'warn',
    phase:       '36',
    milestone:   'v1.8',
    retroactive: { step: '6.55', category: 'process-hygiene', enforcement_mode: 'soft-warn', version: '2.0' },
  });
  assert('F4 MUDA-waste-audit warn',
    f4 && f4.outcome === 'warn' && f4.status === 'warn' &&
    f4.gate === 'MUDA-waste-audit' &&
    f4.reason_codes.includes('atc_warn_only'));

  // Read-back: 4 rows, append order, all envelope-shaped.
  const rows = readGateValueRows(tmp);
  assert('R rows length 4', rows.length === 4);
  assert('R row 0 = F1', rows[0].gate === 'phase-level-ATC' && rows[0].outcome === 'skip');
  assert('R row 1 = F2', rows[1].gate === 'phase-level-ATC' && rows[1].outcome === 'pass');
  assert('R row 2 = F3', rows[2].gate === 'per-dispatch-ATC' && rows[2].outcome === 'block');
  assert('R row 3 = F4', rows[3].gate === 'MUDA-waste-audit' && rows[3].outcome === 'warn');

  // Envelope-v1 13-field presence on each row.
  const required = ['envelope_version', 'ts', 'command', 'status', 'reason_codes',
    'artifacts', 'evidence', 'next_action', 'risk', 'duration_ms', 'run_id', 'phase', 'milestone'];
  let envelopeOk = true;
  for (const r of rows) {
    for (const k of required) {
      if (!(k in r)) { envelopeOk = false; break; }
    }
    if (!envelopeOk) break;
  }
  assert('E envelope-v1 13 required fields present on every row', envelopeOk);

  // Sanity: ledgerPath helper produces the canonical relative path.
  assert('L ledgerPath returns metrics/gate-value-log.jsonl under planningDir',
    ledgerPath(tmp) === path.join(tmp, 'metrics', 'gate-value-log.jsonl'));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

const realExistedAfter = fs.existsSync(realLedger);
const realMtimeAfter   = realExistedAfter ? fs.statSync(realLedger).mtimeMs : 0;
const realSizeAfter    = realExistedAfter ? fs.statSync(realLedger).size : 0;
assert('G canonical ledger untouched by local-fallback test',
  realExistedBefore === realExistedAfter &&
  realMtimeBefore === realMtimeAfter &&
  realSizeBefore === realSizeAfter);

console.log('gate-value-log local-fallback: ' + pass + ' pass, ' + fail + ' fail');
if (fail > 0) {
  for (const f of failures) console.error('  FAIL: ' + f.name + (f.detail ? ' -- ' + f.detail : ''));
  process.exit(1);
}
process.exit(0);
