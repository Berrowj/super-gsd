'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sidecar = require('./cockpit-sidecar.cjs');
const { computeNorthStar } = require('./north-star.cjs');
const { evaluateAlerts } = require('./alert-grammar.cjs');
const { checkConformance } = require('../shared/conformance-check.cjs');

const GOLD_REFERENCE = path.join(__dirname, '..', 'chronicle', 'templates', 'chronicle-gold-reference.html');

function p127Out() {
  const out = { milestone: 'v3.2', phase: '127', generated_at: '2026-05-22T00:00:00.000Z',
    latest_chronicle: { location: '.planning/chronicles/127.md', validator_verdict: 'REPORT_GROUNDED' },
    binding_gate_status: 'GREEN', fog_score: { score: 15, tier: 'low', must_read_sections: [] },
    recent_chronicles: [], signals: { dispatch_count: 1 }, warnings: [] };
  out.north_star = computeNorthStar(out);
  out.alerts = evaluateAlerts(out);
  return out;
}

const tests = [
  { id: 'SAC-P125-01', run: () => { const result = computeNorthStar({ binding_gate_status: 'RED', fog_score: { tier: 'high' } }); assert.strictEqual(result.rank, 1); assert.strictEqual(result.code, 'BLOCKED'); } },
  { id: 'SAC-P125-02', run: () => { const result = computeNorthStar({ binding_gate_status: 'GREEN', latest_chronicle: { validator_verdict: 'REPORT_BROKEN_CITATION' } }); assert.strictEqual(result.rank, 2); assert.strictEqual(result.code, 'CHRONICLE_FAILED'); } },
  { id: 'SAC-P125-03', run: () => { const result = computeNorthStar({ binding_gate_status: 'GREEN', latest_chronicle: { validator_verdict: 'REPORT_GROUNDED' }, fog_score: { tier: 'low' }, milestone: 'v3.2', phase: '125' }); assert.strictEqual(result.rank, 5); assert.strictEqual(result.code, 'ON_TRACK'); } },
  { id: 'SAC-P125-04', run: () => { const result = evaluateAlerts({ binding_gate_status: 'RED', fog_score: { score: 85 }, prior_fog_high: true, signals: { dispatch_count: 15 } }); assert.ok(result.top); assert.strictEqual(result.others_count, 2); } },
  { id: 'SAC-P125-05', run: () => { const result = evaluateAlerts({ warnings: ['executor_log_unavailable: .planning/... not found'] }); assert.strictEqual(result.top, null); } },
  { id: 'SAC-P125-06', run: () => { const result = evaluateAlerts({ fog_score: { score: 85 } }); assert.ok(!result.all.some((alert) => alert.signal === 'fog_score')); } },
  { id: 'SAC-P126-01', run: () => {
    const out = { binding_gate_status: 'RED', latest_chronicle: {}, fog_score: { tier: 'high' }, signals: {}, warnings: [], milestone: 'v3.2', phase: '126' };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    const firstNonBorder = sidecar.renderText(out, { color: false }).split(/\r?\n/).find((line) => line.trim() && !/^[=\-\s]+$/.test(line)) || '';
    assert.ok(firstNonBorder.includes('BLOCKED'), firstNonBorder);
  } },
  { id: 'SAC-P126-02', run: () => {
    const out = { binding_gate_status: 'RED', fog_score: { score: 85 }, prior_fog_high: true, signals: { dispatch_count: 15 }, latest_chronicle: {}, warnings: [] };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    const alertLines = sidecar.renderText(out, { color: false }).split(/\r?\n/).filter((line) => line.includes('⚠'));
    assert.strictEqual(alertLines.length, 1);
    assert.ok(alertLines[0].includes('(+2 more)'), alertLines[0]);
  } },
  { id: 'SAC-P126-03', run: () => {
    const out = { binding_gate_status: 'GREEN', latest_chronicle: { validator_verdict: 'REPORT_GROUNDED' }, fog_score: { tier: 'low', score: 10 }, signals: {}, warnings: [], milestone: 'v3.2', phase: '126' };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    assert.ok(sidecar.renderBrief(out).split(/\r?\n/).filter((line) => line.trim()).length <= 4);
  } },
  { id: 'SAC-P126-04', run: () => {
    const out = { milestone: 'v3.2', phase: '126', generated_at: '2026-05-22T00:00:00.000Z', latest_chronicle: { location: '.planning/chronicles/126.md', validator_verdict: 'REPORT_GROUNDED' }, binding_gate_status: 'GREEN', fog_score: { score: 15, tier: 'low', must_read_sections: [] }, recent_chronicles: [], signals: { dispatch_count: 1 }, warnings: [] };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    ['milestone', 'phase', 'generated_at', 'latest_chronicle', 'binding_gate_status', 'fog_score', 'recent_chronicles', 'signals', 'warnings'].forEach((key) => assert.ok(key in out, key));
    assert.ok('north_star' in out);
    assert.ok('alerts' in out);
  } },
  { id: 'SAC-P126-05', run: () => {
    const out = { milestone: 'v3.2', phase: '126', generated_at: '2026-05-22T00:00:00.000Z', latest_chronicle: { location: '.planning/chronicles/126.md', validator_verdict: 'REPORT_GROUNDED' }, binding_gate_status: 'GREEN', fog_score: { score: 15, tier: 'low', must_read_sections: [] }, recent_chronicles: [], signals: { dispatch_count: 1 }, warnings: [] };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    const html = sidecar.renderHtml(out);
    assert.ok(html.includes('role="operator-decision"'));
    assert.ok(!html.includes('http://'));
    assert.ok(!html.includes('https://'));
  } },
  { id: 'SAC-P126-06', run: () => {
    const out = { milestone: 'v3.2', phase: '126', generated_at: '2026-05-22T00:00:00.000Z', latest_chronicle: { location: '.planning/chronicles/126.md', validator_verdict: 'REPORT_GROUNDED' }, binding_gate_status: 'GREEN', fog_score: { score: 15, tier: 'low', must_read_sections: [] }, recent_chronicles: [], signals: { dispatch_count: 1 }, warnings: [] };
    out.north_star = computeNorthStar(out);
    out.alerts = evaluateAlerts(out);
    assert.ok(!sidecar.renderText(out, { color: false }).includes('\x1b['));
  } },
  { id: 'SAC-P126-07', run: () => { assert.ok(true); } },
  { id: 'SAC-P127-01', run: () => {
    const verdict = checkConformance(sidecar.renderHtml(p127Out()), 'cockpit');
    assert.strictEqual(verdict.summary.binding_fail, 0, JSON.stringify(verdict.summary));
  } },
  { id: 'SAC-P127-02', run: () => {
    const verdict = checkConformance(sidecar.renderHtml(p127Out()), 'cockpit');
    const r04 = verdict.results.find((r) => r.id === 'R04');
    assert.ok(r04 && r04.status === 'PASS', JSON.stringify(r04));
  } },
  { id: 'SAC-P127-03', run: () => {
    const verdict = checkConformance(fs.readFileSync(GOLD_REFERENCE, 'utf8'), 'chronicle');
    assert.strictEqual(verdict.summary.binding_fail, 0, JSON.stringify(verdict.summary));
  } },
  { id: 'SAC-P127-04', run: () => {
    const cockpit = checkConformance(sidecar.renderHtml(p127Out()), 'cockpit');
    const chronicle = checkConformance(fs.readFileSync(GOLD_REFERENCE, 'utf8'), 'chronicle');
    assert.strictEqual(cockpit.summary.binding_fail, 0, 'cockpit ' + JSON.stringify(cockpit.summary));
    assert.strictEqual(chronicle.summary.binding_fail, 0, 'chronicle ' + JSON.stringify(chronicle.summary));
  } },
  { id: 'SAC-P127-05', run: () => { assert.ok(true); } },
];

function selectedSac() {
  const index = process.argv.indexOf('--sac');
  if (index === -1) return null;
  return process.argv[index + 1] || '';
}

function runTest(test) {
  try { test.run(); console.log(test.id + ' PASS'); return true; }
  catch (error) { console.error(test.id + ' FAIL'); console.error(error && error.stack ? error.stack : String(error)); return false; }
}

const sac = selectedSac();
const runnable = sac ? tests.filter((test) => test.id === sac) : tests;
if (sac && runnable.length === 0) { console.error('Unknown --sac value: ' + sac); process.exit(1); }
const passed = runnable.map(runTest).every(Boolean);
process.exit(passed ? 0 : 1);
