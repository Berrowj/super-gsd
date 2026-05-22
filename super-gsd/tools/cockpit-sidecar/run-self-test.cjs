'use strict';

const assert = require('assert');
const { computeNorthStar } = require('./north-star.cjs');
const { evaluateAlerts } = require('./alert-grammar.cjs');

const tests = [
  {
    id: 'SAC-P125-01',
    run: () => {
      const result = computeNorthStar({ binding_gate_status: 'RED', fog_score: { tier: 'high' } });
      assert.strictEqual(result.rank, 1);
      assert.strictEqual(result.code, 'BLOCKED');
    },
  },
  {
    id: 'SAC-P125-02',
    run: () => {
      const result = computeNorthStar({
        binding_gate_status: 'GREEN',
        latest_chronicle: { validator_verdict: 'REPORT_BROKEN_CITATION' },
      });
      assert.strictEqual(result.rank, 2);
      assert.strictEqual(result.code, 'CHRONICLE_FAILED');
    },
  },
  {
    id: 'SAC-P125-03',
    run: () => {
      const result = computeNorthStar({
        binding_gate_status: 'GREEN',
        latest_chronicle: { validator_verdict: 'REPORT_GROUNDED' },
        fog_score: { tier: 'low' },
        milestone: 'v3.2',
        phase: '125',
      });
      assert.strictEqual(result.rank, 5);
      assert.strictEqual(result.code, 'ON_TRACK');
    },
  },
  {
    id: 'SAC-P125-04',
    run: () => {
      const result = evaluateAlerts({
        binding_gate_status: 'RED',
        fog_score: { score: 85 },
        prior_fog_high: true,
        signals: { dispatch_count: 15 },
      });
      assert.ok(result.top);
      assert.strictEqual(result.others_count, 2);
    },
  },
  {
    id: 'SAC-P125-05',
    run: () => {
      const result = evaluateAlerts({
        warnings: ['executor_log_unavailable: .planning/... not found'],
      });
      assert.strictEqual(result.top, null);
    },
  },
  {
    id: 'SAC-P125-06',
    run: () => {
      const result = evaluateAlerts({ fog_score: { score: 85 } });
      assert.ok(!result.all.some((alert) => alert.signal === 'fog_score'));
    },
  },
];

function selectedSac() {
  const index = process.argv.indexOf('--sac');
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || '';
}

function runTest(test) {
  try {
    test.run();
    console.log(test.id + ' PASS');
    return true;
  } catch (error) {
    console.error(test.id + ' FAIL');
    console.error(error && error.stack ? error.stack : String(error));
    return false;
  }
}

const sac = selectedSac();
const runnable = sac ? tests.filter((test) => test.id === sac) : tests;

if (sac && runnable.length === 0) {
  console.error('Unknown --sac value: ' + sac);
  process.exit(1);
}

const passed = runnable.map(runTest).every(Boolean);
process.exit(passed ? 0 : 1);
