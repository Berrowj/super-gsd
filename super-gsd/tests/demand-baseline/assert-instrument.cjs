'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  recordEligibleQuery,
} = require('../../scripts/lib/demand-baseline-ledger.cjs');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, assertion) {
  try {
    assertion();
    passed += 1;
  } catch (error) {
    failed += 1;
    failures.push(`${name}: ${error.message}`);
  }
}

function eligibleQuery(overrides = {}) {
  return {
    decision_id: 'eligible-1',
    query: 'What evidence already exists for this decision?',
    adequate: true,
    reason: 'existing_path_adequate',
    latency_ms: 12,
    est_tokens: 34,
    vtp_call_count: 0,
    ...overrides,
  };
}

function without(record, key) {
  const copy = { ...record };
  delete copy[key];
  return copy;
}

check('exports recordEligibleQuery', () => {
  assert.strictEqual(typeof recordEligibleQuery, 'function');
});

if (typeof recordEligibleQuery === 'function') {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demand-baseline-instrument-test-'));
  try {
    const ledgerPath = path.join(tmp, 'metrics', 'triage-advisory', 'demand-baseline.jsonl');
    const denominatorPath = path.join(tmp, 'metrics', 'triage-advisory', 'denominator.json');

    const first = recordEligibleQuery(tmp, eligibleQuery());
    const second = recordEligibleQuery(tmp, eligibleQuery({
      decision_id: 'eligible-2',
      query: 'Which prior artefact covers the second decision?',
      adequate: false,
      reason: 'enrichment_empty_hit',
      latency_ms: 56,
      est_tokens: 78,
      vtp_call_count: 1,
    }));

    check('increments and persists the denominator once per unique decision_id', () => {
      assert.strictEqual(first.ok, true);
      assert.strictEqual(first.denominator, 1);
      assert.strictEqual(second.ok, true);
      assert.strictEqual(second.denominator, 2);

      const state = JSON.parse(fs.readFileSync(denominatorPath, 'utf8'));
      assert.strictEqual(state.schema_version, 1);
      assert.strictEqual(state.denominator, 2);
      assert.deepStrictEqual(state.decision_ids, ['eligible-1', 'eligible-2']);

      const rows = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
      assert.deepStrictEqual(rows.map((row) => row.denominator), [1, 2]);
      assert.deepStrictEqual(rows.map((row) => row.query), [
        'What evidence already exists for this decision?',
        'Which prior artefact covers the second decision?',
      ]);
    });

    const replay = recordEligibleQuery(tmp, eligibleQuery({ latency_ms: 999 }));
    check('replay neither increments the denominator nor double-appends', () => {
      assert.strictEqual(replay.ok, true);
      assert.strictEqual(replay.deduped, true);
      assert.strictEqual(replay.denominator, 2);
      const state = JSON.parse(fs.readFileSync(denominatorPath, 'utf8'));
      const rows = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/);
      assert.strictEqual(state.denominator, 2);
      assert.deepStrictEqual(state.decision_ids, ['eligible-1', 'eligible-2']);
      assert.strictEqual(rows.length, 2);
    });

    check('bad reason is rejected before denominator mutation', () => {
      const stateBefore = fs.readFileSync(denominatorPath, 'utf8');
      const ledgerBefore = fs.readFileSync(ledgerPath, 'utf8');
      const result = recordEligibleQuery(tmp, eligibleQuery({
        decision_id: 'invalid-reason',
        reason: 'not_in_the_closed_vocabulary',
      }));
      assert.strictEqual(result.ok, false);
      assert.strictEqual(fs.readFileSync(denominatorPath, 'utf8'), stateBefore);
      assert.strictEqual(fs.readFileSync(ledgerPath, 'utf8'), ledgerBefore);
    });

    check('required metrics cannot be dropped without validation failure', () => {
      const stateBefore = fs.readFileSync(denominatorPath, 'utf8');
      for (const field of ['latency_ms', 'est_tokens', 'vtp_call_count']) {
        const result = recordEligibleQuery(
          tmp,
          without(eligibleQuery({ decision_id: `missing-${field}` }), field)
        );
        assert.strictEqual(result.ok, false, `${field} was accepted`);
      }
      assert.strictEqual(fs.readFileSync(denominatorPath, 'utf8'), stateBefore);
    });

    check('write failure returns ok:false without throwing', () => {
      const blockedPlanningDir = path.join(tmp, 'not-a-directory');
      fs.writeFileSync(blockedPlanningDir, 'blocking file', 'utf8');
      let result;
      assert.doesNotThrow(() => {
        result = recordEligibleQuery(blockedPlanningDir, eligibleQuery({
          decision_id: 'write-failure',
        }));
      });
      assert.strictEqual(result.ok, false);
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

for (const failure of failures) process.stderr.write(`${failure}\n`);
process.stdout.write(`${passed} pass, ${failed} fail\n`);
if (failed > 0) process.exitCode = 1;
