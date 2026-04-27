// ============================================================================
// SGSD - ROUTE-LEDGER local fallback test for codex_route boundary
// ============================================================================
// Patch 4 (mass-discuss 2026-04-26): "deterministic local-fallback that
// exercises the PRODUCTION CALLER PATH... Mock predicates that bypass
// the production caller are forbidden."
//
// This test imports `logCodexRoute` from the production lib -- the same
// helper SKILL.md Step 9.5 imports at line 1236. It fakes only the
// `dispatchResult` payload (the I/O boundary -- output of shelling to
// codex-exec.sh). All status / reason_code mapping logic runs under
// the test.
//
// Invocation: node super-gsd/scripts/lib/route-ledger.test.cjs
// Exits 0 when all 4 fixtures PASS; 1 otherwise.
// ============================================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const ledger = require('./route-ledger.cjs');

let pass = 0, fail = 0;
const failures = [];
const assert = (name, cond, detail) => {
  if (cond) { pass++; }
  else { fail++; failures.push({ name, detail: detail || '' }); }
};

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-test-'));
fs.mkdirSync(path.join(tmp, 'metrics'), { recursive: true });

try {
  // -- Fixture A: Codex success ----------------------------------------------
  ledger.logCodexRoute(tmp, {
    phase: '32', milestone: 'v1.7', plan: '32-01',
    dispatchResult: { exit: 0, timeout_hit: false },
    effectiveProviderName: 'codex-cli-reviewer',
    fallbackProviderName: 'openai-codex',
    fallbackTriggered: false,
    fallbackReason: null,
    reportPath: '.planning/milestones/v1.7/phases/32-route-decision-ledger/commit-reviews.jsonl',
  });

  // -- Fixture B: Codex timeout ----------------------------------------------
  ledger.logCodexRoute(tmp, {
    phase: '32', milestone: 'v1.7', plan: '32-01',
    dispatchResult: { exit: 5, timeout_hit: true },
    effectiveProviderName: 'codex-cli-reviewer',
    fallbackProviderName: 'openai-codex',
    fallbackTriggered: false,
    fallbackReason: null,
    reportPath: null,
  });

  // -- Fixture C: Codex auth fail -> claude fallback fired -------------------
  ledger.logCodexRoute(tmp, {
    phase: '32', milestone: 'v1.7', plan: '32-01',
    dispatchResult: { exit: 4, timeout_hit: false },
    effectiveProviderName: 'codex-cli-reviewer',
    fallbackProviderName: 'claude-via-fallback',
    fallbackTriggered: true,
    fallbackReason: null,
    reportPath: null,
  });

  // -- Fixture D: parse_failure -> claude fallback fired (status=warn) -------
  ledger.logCodexRoute(tmp, {
    phase: '32', milestone: 'v1.7', plan: '32-01',
    dispatchResult: { exit: 0, timeout_hit: false },
    effectiveProviderName: 'codex-cli-reviewer',
    fallbackProviderName: 'claude-via-fallback',
    fallbackTriggered: true,
    fallbackReason: 'parse_failure',
    reportPath: '.planning/milestones/v1.7/phases/32-route-decision-ledger/commit-reviews.jsonl',
  });

  const rows = ledger.readRows(tmp);
  assert('A. four rows appended', rows.length === 4);

  // Fixture A assertions: success
  const a = rows[0];
  assert('A. codex_success: boundary === codex_route', a.boundary === 'codex_route');
  assert('A. codex_success: status === ok', a.status === 'ok');
  assert('A. codex_success: reason_codes includes review_unanimous_pass',
    Array.isArray(a.reason_codes) && a.reason_codes.includes('review_unanimous_pass'));
  assert('A. codex_success: decision.fallback_triggered === false',
    a.decision && a.decision.fallback_triggered === false);
  assert('A. codex_success: decision.from === codex-cli-reviewer',
    a.decision && a.decision.from === 'codex-cli-reviewer');
  assert('A. envelope_version === 1', a.envelope_version === 1);
  assert('A. command === logRouteDecision', a.command === 'logRouteDecision');
  assert('A. phase + milestone present', a.phase === '32' && a.milestone === 'v1.7');
  assert('A. evidence contains review_report kind (envelope-v1: review_report is evidence, not artifact)',
    Array.isArray(a.evidence) && a.evidence.length === 1 && a.evidence[0].kind === 'review_report' && typeof a.evidence[0].ref === 'string');
  assert('A. artifacts is empty (logCodexRoute does not WRITE the report)',
    Array.isArray(a.artifacts) && a.artifacts.length === 0);

  // Fixture B assertions: timeout
  const b = rows[1];
  assert('B. codex_timeout: status === timeout', b.status === 'timeout');
  assert('B. codex_timeout: reason_codes includes codex_timeout',
    Array.isArray(b.reason_codes) && b.reason_codes.includes('codex_timeout'));
  assert('B. codex_timeout: decision.timeout_hit === true',
    b.decision && b.decision.timeout_hit === true);
  assert('B. codex_timeout: decision.exit === 5',
    b.decision && b.decision.exit === 5);

  // Fixture C assertions: auth fail + fallback
  const c = rows[2];
  assert('C. codex_auth_fail: status === fail', c.status === 'fail');
  assert('C. codex_auth_fail: reason_codes includes codex_auth_missing',
    Array.isArray(c.reason_codes) && c.reason_codes.includes('codex_auth_missing'));
  assert('C. codex_auth_fail: reason_codes includes codex_fallback_triggered',
    Array.isArray(c.reason_codes) && c.reason_codes.includes('codex_fallback_triggered'));
  assert('C. codex_auth_fail: decision.fallback_triggered === true',
    c.decision && c.decision.fallback_triggered === true);
  assert('C. codex_auth_fail: decision.to === claude-via-fallback',
    c.decision && c.decision.to === 'claude-via-fallback');

  // Fixture D assertions: parse_failure -> warn
  const d = rows[3];
  assert('D. parse_failure: status === warn', d.status === 'warn');
  assert('D. parse_failure: reason_codes includes codex_fallback_triggered',
    Array.isArray(d.reason_codes) && d.reason_codes.includes('codex_fallback_triggered'));
  assert('D. parse_failure: reason_codes includes parse_failure',
    Array.isArray(d.reason_codes) && d.reason_codes.includes('parse_failure'));
  assert('D. parse_failure: decision.fallback_triggered === true',
    d.decision && d.decision.fallback_triggered === true);
  assert('D. parse_failure: decision.fallback_reason === parse_failure',
    d.decision && d.decision.fallback_reason === 'parse_failure');
  assert('D. parse_failure: decision.from -> to populated',
    d.decision && d.decision.from === 'codex-cli-reviewer' &&
    d.decision.to === 'claude-via-fallback');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`route-ledger fallback test: ${pass} pass, ${fail} fail`);
if (fail > 0) {
  for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
  process.exit(1);
}
process.exit(0);
