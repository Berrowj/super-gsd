#!/usr/bin/env node
// ============================================================================
// SGSD - Double-Agent Executor Scorecard
// ============================================================================
// Reads route-decisions.jsonl execution_route rows and reports provider usage,
// fallback, acceptance, scope violations, test pass rates, and estimated token
// movement for the double-agent executor.
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const routeLedger = require('../../scripts/lib/route-ledger.cjs');

function repoRoot() {
  return path.resolve(__dirname, '..', '..', '..');
}

function defaultPlanningDir() {
  return path.join(repoRoot(), '.planning');
}

function readExecutionRows(planningDir) {
  return routeLedger.readRows(planningDir)
    .filter((r) => r.boundary === 'execution_route');
}

function emptyBucket(key) {
  return {
    key,
    tasks: 0,
    accepted: 0,
    applied: 0,
    tests_passed: 0,
    fallback_used: 0,
    timeouts: 0,
    scope_violations: 0,
    estimated_tokens: 0,
    changed_files: 0,
  };
}

function addToBucket(bucket, row) {
  const d = row.decision || {};
  bucket.tasks++;
  if (d.accepted) bucket.accepted++;
  if (d.applied) bucket.applied++;
  if (d.tests_passed) bucket.tests_passed++;
  if (d.fallback_used) bucket.fallback_used++;
  if (row.status === 'timeout') bucket.timeouts++;
  if (Array.isArray(d.out_of_scope_files) && d.out_of_scope_files.length > 0) {
    bucket.scope_violations++;
  }
  if (d.token_estimate && typeof d.token_estimate.total_estimated_tokens === 'number') {
    bucket.estimated_tokens += d.token_estimate.total_estimated_tokens;
  }
  if (Array.isArray(d.changed_files)) bucket.changed_files += d.changed_files.length;
}

function summarize(planningDir, filters) {
  const f = filters || {};
  const rows = readExecutionRows(planningDir).filter((row) => {
    if (f.milestone && String(row.milestone) !== String(f.milestone)) return false;
    if (f.phase && String(row.phase) !== String(f.phase)) return false;
    return true;
  });

  const byProvider = {};
  const byPhase = {};
  for (const row of rows) {
    const d = row.decision || {};
    const provider = d.chosen_provider || 'unknown';
    if (!byProvider[provider]) byProvider[provider] = emptyBucket(provider);
    addToBucket(byProvider[provider], row);

    const phaseKey = `${row.milestone || '-'}:${row.phase || '-'}`;
    if (!byPhase[phaseKey]) byPhase[phaseKey] = emptyBucket(phaseKey);
    addToBucket(byPhase[phaseKey], row);
  }

  const totals = emptyBucket('total');
  for (const row of rows) addToBucket(totals, row);

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    scope: {
      milestone: f.milestone || null,
      phase: f.phase || null,
    },
    rows: rows.length,
    totals,
    by_provider: Object.values(byProvider).sort((a, b) => b.tasks - a.tasks || a.key.localeCompare(b.key)),
    by_phase: Object.values(byPhase).sort((a, b) => a.key.localeCompare(b.key)),
  };
}

function pct(a, b) {
  if (!b) return '0%';
  return ((a / b) * 100).toFixed(1) + '%';
}

function renderText(summary) {
  const lines = [];
  lines.push('# Double-Agent Executor Scorecard');
  lines.push('');
  lines.push(`Generated: ${summary.generated_at}`);
  lines.push(`Rows: ${summary.rows}`);
  lines.push('');
  lines.push('## Totals');
  lines.push('');
  lines.push('| Tasks | Accepted | Tests passed | Fallback | Timeouts | Scope violations | Est tokens |');
  lines.push('|---:|---:|---:|---:|---:|---:|---:|');
  const t = summary.totals;
  lines.push(`| ${t.tasks} | ${t.accepted} (${pct(t.accepted, t.tasks)}) | ${t.tests_passed} | ${t.fallback_used} | ${t.timeouts} | ${t.scope_violations} | ${t.estimated_tokens} |`);
  lines.push('');
  lines.push('## By Provider');
  lines.push('');
  lines.push('| Provider | Tasks | Accepted | Tests passed | Fallback | Timeouts | Scope violations | Est tokens |');
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|');
  for (const b of summary.by_provider) {
    lines.push(`| ${b.key} | ${b.tasks} | ${b.accepted} | ${b.tests_passed} | ${b.fallback_used} | ${b.timeouts} | ${b.scope_violations} | ${b.estimated_tokens} |`);
  }
  lines.push('');
  lines.push('## By Phase');
  lines.push('');
  lines.push('| Phase | Tasks | Accepted | Fallback | Timeouts | Est tokens |');
  lines.push('|---|---:|---:|---:|---:|---:|');
  for (const b of summary.by_phase) {
    lines.push(`| ${b.key} | ${b.tasks} | ${b.accepted} | ${b.fallback_used} | ${b.timeouts} | ${b.estimated_tokens} |`);
  }
  return lines.join('\n') + '\n';
}

function parseArgs(argv) {
  const out = { selfTest: false, json: false, milestone: null, phase: null, planningDir: defaultPlanningDir() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') out.selfTest = true;
    else if (a === '--json') out.json = true;
    else if (a === '--milestone') out.milestone = argv[++i];
    else if (a === '--phase') out.phase = argv[++i];
    else if (a === '--planning-dir') out.planningDir = path.resolve(argv[++i]);
    else if (a === '--help' || a === '-h') out.help = true;
    else throw new Error('unknown flag ' + a);
  }
  return out;
}

function selfTest() {
  let pass = 0, fail = 0;
  const failures = [];
  const assert = (name, cond, detail) => {
    if (cond) pass++;
    else { fail++; failures.push({ name, detail: detail || '' }); }
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dae-score-'));
  try {
    routeLedger.appendRow(tmp, {
      boundary: 'execution_route',
      status: 'ok',
      phase: '1',
      milestone: 'vX',
      reason_codes: ['codex_primary_bounded_task', 'execution_accepted'],
      decision: {
        task_id: 'a',
        chosen_provider: 'codex',
        fallback_used: false,
        accepted: true,
        tests_passed: true,
        applied: false,
        changed_files: ['a.js'],
        out_of_scope_files: [],
        token_estimate: { total_estimated_tokens: 100 },
      },
    });
    routeLedger.appendRow(tmp, {
      boundary: 'execution_route',
      status: 'warn',
      phase: '1',
      milestone: 'vX',
      reason_codes: ['codex_unhealthy_fallback_claude'],
      decision: {
        task_id: 'b',
        chosen_provider: 'claude',
        fallback_used: true,
        accepted: false,
        tests_passed: false,
        changed_files: [],
        out_of_scope_files: [],
        token_estimate: { total_estimated_tokens: 0 },
      },
    });

    const s = summarize(tmp, {});
    assert('1. summarizes two rows', s.rows === 2 && s.totals.tasks === 2);
    assert('2. provider buckets include codex and claude',
      s.by_provider.some((b) => b.key === 'codex') && s.by_provider.some((b) => b.key === 'claude'));
    assert('3. accepted count', s.totals.accepted === 1);
    assert('4. fallback count', s.totals.fallback_used === 1);
    assert('5. token sum', s.totals.estimated_tokens === 100);
    assert('6. render contains provider table', /By Provider/.test(renderText(s)));
  } catch (e) {
    fail++;
    failures.push({ name: 'self-test exception', detail: e.stack || e.message });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`double-agent-scorecard self-test: ${pass} pass, ${fail} fail`);
  if (fail) {
    console.error(JSON.stringify(failures, null, 2));
    return 1;
  }
  return 0;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv);
    if (args.help) {
      console.log('Usage: node super-gsd/tools/double-agent-executor/scorecard.cjs [--json] [--milestone vX] [--phase N]');
      process.exit(0);
    }
    if (args.selfTest) process.exit(selfTest());
    const s = summarize(args.planningDir, args);
    if (args.json) console.log(JSON.stringify(s, null, 2));
    else process.stdout.write(renderText(s));
  } catch (e) {
    console.error('double-agent-scorecard error: ' + e.message);
    process.exit(2);
  }
}

module.exports = {
  readExecutionRows,
  summarize,
  renderText,
  selfTest,
};

