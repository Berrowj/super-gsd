// ============================================================================
// SGSD - MUDA-DELETION-CANDIDATES local-fallback test (Phase 37)
// ============================================================================
// Per 37-RESEARCH.md sec 10 (Live-or-Local Fallback): this test is the
// "local" path; the post-hook in sgsd-muda-audit.sh is the "live" path.
// Same exported helpers; same code path; no provider faking; lib reads
// filesystem-only.
//
// 3 fixtures, each tmpdir-isolated:
//   1. low_value heuristic fires (1 pass + 5 block on g_lo, value_score=0)
//   2. recurring heuristic fires across 2 milestones (v1.5 + v1.7)
//   3. skip_drift cold-start defer + idempotent re-run + replacement on
//      data change (single tmpdir, three sub-asserts)
//
// All asserts use the production lib via require() -- the SAME exports
// the live post-hook calls. Filesystem state is the asserted oracle.
// ============================================================================

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const lib          = require('./muda-deletion-candidates.cjs');
const gateValueLog = require('./gate-value-log.cjs');
const critBacklog  = require('./crit-backlog.cjs');

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; failures.push({ name, detail: detail || '' }); }
}

// --- Fixture 1: low_value heuristic fires ----------------------------------
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-test-lv-'));
  fs.mkdirSync(path.join(tmp, 'metrics'), { recursive: true });
  try {
    // 1 pass + 5 block on g_lo: fires=6, value_score=max(0,(1-5)/6)=0.
    gateValueLog.logGateValue(tmp, { gate: 'g_lo', outcome: 'pass',  phase: '37', milestone: 'v1.8' });
    for (let i = 0; i < 5; i++) {
      gateValueLog.logGateValue(tmp, { gate: 'g_lo', outcome: 'block', phase: '37', milestone: 'v1.8' });
    }
    const wasteFile = path.join(tmp, 'WASTE.md');
    const preamble = '# Phase 99 WASTE\n\n## Probe Results\n\n(empty)\n';
    fs.writeFileSync(wasteFile, preamble, 'utf8');

    const ok = lib.appendToWasteFile(tmp, wasteFile, { milestone: 'v1.8' });
    const content = fs.readFileSync(wasteFile, 'utf8');

    check('F1.1: appendToWasteFile returns true on low_value fire',
      ok === true);
    check('F1.2: WASTE.md contains ## Deletion Candidates section',
      content.includes('## Deletion Candidates'));
    check('F1.3: low_value row present (low_value_gate, g_lo, medium, value_score=0.000)',
      content.includes('low_value_gate') && content.includes('g_lo') &&
      content.includes('medium') && content.includes('value_score=0.000'));
    check('F1.4: preamble preserved (# Phase 99 WASTE still present)',
      content.startsWith('# Phase 99 WASTE'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// --- Fixture 2: recurring heuristic across 2 milestones --------------------
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-test-rec-'));
  fs.mkdirSync(path.join(tmp, 'metrics'), { recursive: true });
  try {
    // Use v1 schema 4-field set to satisfy crit-backlog v1 guard. Use
    // suspected_cause 'codex review missing' (NOT 'codex unavailable',
    // which triggers the codex-unavailable guard requiring
    // provider_health_check).
    critBacklog.appendRow(tmp, {
      kind: 'verifier_fail', phase: 30, milestone: 'v1.5',
      summary: 'Codex review missing; fallback used',
      missing_evidence: 'codex output',
      suspected_cause: 'codex review missing',
      confidence: 'high',
      clearance_requires: 'codex run',
    });
    critBacklog.appendRow(tmp, {
      kind: 'verifier_fail', phase: 33, milestone: 'v1.7',
      summary: 'Codex review missing; fallback used',
      missing_evidence: 'codex output',
      suspected_cause: 'codex review missing',
      confidence: 'high',
      clearance_requires: 'codex run',
    });

    const wasteFile = path.join(tmp, 'WASTE.md');
    fs.writeFileSync(wasteFile, '# Phase 99 WASTE\n\n## Probe Results\n\n(empty)\n', 'utf8');

    // No milestone filter -- recurring spans milestones.
    const ok = lib.appendToWasteFile(tmp, wasteFile);
    const content = fs.readFileSync(wasteFile, 'utf8');

    check('F2.1: appendToWasteFile returns true on recurring fire',
      ok === true);
    check('F2.2: recurring_backlog row present with low risk',
      content.includes('## Deletion Candidates') &&
      content.includes('recurring_backlog') &&
      content.includes('verifier_fail: codex review missing') &&
      / low /.test(content));
    check('F2.3: evidence cell references both v1.5 AND v1.7',
      /v1\.5/.test(content) && /v1\.7/.test(content));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// --- Fixture 3: skip_drift + cold-start + idempotent + replacement ---------
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mdc-test-sd-'));
  fs.mkdirSync(path.join(tmp, 'metrics'), { recursive: true });
  try {
    const wasteFile = path.join(tmp, 'WASTE.md');
    const preamble = '# Phase 99 WASTE\n\n## Probe Results\n\n(empty)\n';
    fs.writeFileSync(wasteFile, preamble, 'utf8');

    // 3a: cold-start defer-on-empty (no ledgers yet).
    const ok3a = lib.appendToWasteFile(tmp, wasteFile);
    const after3a = fs.readFileSync(wasteFile, 'utf8');
    check('F3.1 (cold-start): defer placeholder emitted on empty ledgers',
      ok3a === true &&
      after3a.includes('## Deletion Candidates') &&
      after3a.includes('_No deletion candidates surfaced'));

    // 3b: skip_drift fires (1 fire pass + 9 skips on g_dr; total_obs=10, fire_rate=0.1).
    gateValueLog.logGateValue(tmp, { gate: 'g_dr', outcome: 'pass', phase: '37', milestone: 'v1.8' });
    for (let i = 0; i < 9; i++) {
      gateValueLog.logGateValue(tmp, { gate: 'g_dr', outcome: 'skip', phase: '37', milestone: 'v1.8' });
    }
    const ok3bFirst = lib.appendToWasteFile(tmp, wasteFile, { milestone: 'v1.8' });
    const firstRun = fs.readFileSync(wasteFile, 'utf8');
    check('F3.2 (skip_drift fires + idempotent first call)',
      ok3bFirst === true &&
      firstRun.includes('skip_drift_gate') &&
      firstRun.includes('g_dr') &&
      firstRun.includes('fire_rate=0.100'));

    // Idempotent: call again with same data, file byte-identical.
    const ok3bSecond = lib.appendToWasteFile(tmp, wasteFile, { milestone: 'v1.8' });
    const secondRun = fs.readFileSync(wasteFile, 'utf8');
    check('F3.3 (idempotent): second call produces byte-identical file',
      ok3bSecond === true && secondRun === firstRun);

    // 3c: replacement on data change. Push fire_rate above 0.2 -> skip_drift no longer fires.
    // Need 3 more fires on g_dr to flip: total_obs=13, fires=4, fire_rate=4/13=0.308 > 0.2.
    for (let i = 0; i < 3; i++) {
      gateValueLog.logGateValue(tmp, { gate: 'g_dr', outcome: 'pass', phase: '37', milestone: 'v1.8' });
    }
    const ok3c = lib.appendToWasteFile(tmp, wasteFile, { milestone: 'v1.8' });
    const replaced = fs.readFileSync(wasteFile, 'utf8');
    const headingCount = (replaced.match(/## Deletion Candidates/g) || []).length;
    check('F3.4 (replacement on data change): section replaced (not duplicated); preamble preserved',
      ok3c === true &&
      replaced !== firstRun &&
      replaced.startsWith('# Phase 99 WASTE') &&
      headingCount === 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

console.log(`muda-deletion-candidates local-fallback test: ${pass} pass, ${fail} fail`);
if (fail > 0) {
  for (const f of failures) console.error(`  FAIL: ${f.name}${f.detail ? ' -- ' + f.detail : ''}`);
  process.exit(1);
}
process.exit(0);
