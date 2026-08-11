'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');

const modulePath = path.resolve(__dirname, '..', '..', 'scripts', 'lib', 'demand-baseline-ledger.cjs');
let ledger = {};
try {
  ledger = require(modulePath);
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

let passed = 0;
function check(name, assertion) {
  assertion();
  passed += 1;
}

function validRow(overrides = {}) {
  return {
    schema_version: 1,
    decision_id: 'decision-1',
    adequate: true,
    reason: 'existing_path_adequate',
    latency_ms: 12,
    est_tokens: 34,
    vtp_call_count: 0,
    artefact_kind: null,
    ...overrides,
  };
}

function without(row, key) {
  const copy = { ...row };
  delete copy[key];
  return copy;
}

check('exports validateRow', () => assert.strictEqual(typeof ledger.validateRow, 'function'));
check('exports appendRow', () => assert.strictEqual(typeof ledger.appendRow, 'function'));

const reasons = [
  'existing_path_adequate',
  'enrichment_empty_hit',
  'enrichment_off_topic',
  'enrichment_stale',
  'no_enrichment_attempted',
  'other_inadequate',
];

check('accepts valid rows for the complete reason vocabulary', () => {
  for (const reason of reasons) {
    const note = reason === 'other_inadequate' ? 'Evidence was inadequate for another reason.' : undefined;
    assert.deepStrictEqual(ledger.validateRow(validRow({ reason, note })).valid, true);
  }
});
check('rejects missing schema_version', () => {
  assert.strictEqual(ledger.validateRow(without(validRow(), 'schema_version')).valid, false);
});
check('rejects missing or blank reason', () => {
  assert.strictEqual(ledger.validateRow(without(validRow(), 'reason')).valid, false);
  assert.strictEqual(ledger.validateRow(validRow({ reason: '   ' })).valid, false);
});
check('rejects reasons outside the closed vocabulary', () => {
  assert.strictEqual(ledger.validateRow(validRow({ reason: 'unknown' })).valid, false);
});
check('requires a note for other_inadequate', () => {
  assert.strictEqual(ledger.validateRow(validRow({ reason: 'other_inadequate' })).valid, false);
  assert.strictEqual(ledger.validateRow(validRow({ reason: 'other_inadequate', note: '  ' })).valid, false);
  const inheritedNote = validRow({ reason: 'other_inadequate' });
  Object.setPrototypeOf(inheritedNote, { note: 'inherited note' });
  assert.strictEqual(ledger.validateRow(inheritedNote).valid, false);
});
check('enforces required field types and non-negative finite metrics', () => {
  assert.strictEqual(ledger.validateRow(validRow({ schema_version: 1.5 })).valid, false);
  assert.strictEqual(ledger.validateRow(validRow({ decision_id: ' ' })).valid, false);
  assert.strictEqual(ledger.validateRow(validRow({ adequate: 'yes' })).valid, false);
  assert.strictEqual(ledger.validateRow(validRow({ latency_ms: -1 })).valid, false);
  assert.strictEqual(ledger.validateRow(validRow({ est_tokens: Number.NaN })).valid, false);
  assert.strictEqual(ledger.validateRow(validRow({ vtp_call_count: Number.POSITIVE_INFINITY })).valid, false);
});
check('rejects required fields inherited from the prototype', () => {
  assert.strictEqual(ledger.validateRow(Object.create(validRow())).valid, false);
});
check('accepts omitted, null, or non-empty string artefact_kind', () => {
  assert.strictEqual(ledger.validateRow(without(validRow(), 'artefact_kind')).valid, true);
  assert.strictEqual(ledger.validateRow(validRow({ artefact_kind: null })).valid, true);
  assert.strictEqual(ledger.validateRow(validRow({ artefact_kind: 'research_note' })).valid, true);
});
check('rejects invalid artefact_kind and unexpected fields', () => {
  assert.strictEqual(ledger.validateRow(validRow({ artefact_kind: 7 })).valid, false);
  assert.strictEqual(ledger.validateRow(validRow({ unexpected: true })).valid, false);
});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'demand-baseline-ledger-test-'));
try {
  const first = ledger.appendRow(tmp, validRow());
  const duplicate = ledger.appendRow(tmp, validRow({ latency_ms: 99 }));
  const ledgerPath = path.join(tmp, 'metrics', 'triage-advisory', 'demand-baseline.jsonl');
  const rows = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);

  check('appends to the contracted JSONL path', () => {
    assert.deepStrictEqual(first, { ok: true, deduped: false });
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].decision_id, 'decision-1');
  });
  check('dedupes repeated decision_id values', () => {
    assert.deepStrictEqual(duplicate, { ok: true, deduped: true });
  });
  check('serializes a canonical row despite an inherited toJSON hook', () => {
    const hookedRow = validRow({ decision_id: 'hooked-row' });
    Object.setPrototypeOf(hookedRow, { toJSON: () => ({}) });
    assert.deepStrictEqual(ledger.appendRow(tmp, hookedRow), { ok: true, deduped: false });
    const written = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    assert.strictEqual(written.at(-1).decision_id, 'hooked-row');
  });
  check('appends distinct rows without overwriting prior rows', () => {
    assert.deepStrictEqual(
      ledger.appendRow(tmp, validRow({ decision_id: 'decision-2' })),
      { ok: true, deduped: false }
    );
    const written = fs.readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    assert.deepStrictEqual(written.map((row) => row.decision_id), [
      'decision-1',
      'hooked-row',
      'decision-2',
    ]);
  });
  check('returns a failure result for invalid rows', () => {
    const result = ledger.appendRow(tmp, without(validRow({ decision_id: 'invalid-row' }), 'reason'));
    assert.strictEqual(result.ok, false);
    assert.strictEqual(typeof result.error, 'string');
  });

  const blockedPlanningDir = path.join(tmp, 'not-a-directory');
  fs.writeFileSync(blockedPlanningDir, 'blocking file', 'utf8');
  check('returns a failure result rather than throwing on write failure', () => {
    let result;
    assert.doesNotThrow(() => {
      result = ledger.appendRow(blockedPlanningDir, validRow({ decision_id: 'write-failure' }));
    });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(typeof result.error, 'string');
  });

  check('fails closed on an orphaned lock rather than risking a duplicate', () => {
    const lockPath = `${ledgerPath}.lock`;
    fs.writeFileSync(lockPath, 'incomplete owner metadata', 'utf8');
    const staleTime = new Date(Date.now() - 60000);
    fs.utimesSync(lockPath, staleTime, staleTime);
    const result = ledger.appendRow(tmp, validRow({ decision_id: 'must-not-append' }));
    assert.strictEqual(result.ok, false);
    assert.strictEqual(fs.readFileSync(lockPath, 'utf8'), 'incomplete owner metadata');
    fs.unlinkSync(lockPath);
  });

  check('dedupes one decision_id across concurrent workers', () => {
    const concurrentDir = path.join(tmp, 'concurrent-planning');
    const concurrentLedger = path.join(
      concurrentDir,
      'metrics',
      'triage-advisory',
      'demand-baseline.jsonl'
    );
    fs.mkdirSync(path.dirname(concurrentLedger), { recursive: true });
    const seedCount = 2500;
    const seed = Array.from({ length: seedCount }, (_, index) => (
      JSON.stringify(validRow({ decision_id: `seed-${index}` }))
    )).join('\n');
    fs.writeFileSync(concurrentLedger, `${seed}\n`, 'utf8');

    const workerSource = [
      `'use strict';`,
      `const { workerData } = require('worker_threads');`,
      `const sync = new Int32Array(workerData.syncBuffer);`,
      `Atomics.add(sync, 0, 1);`,
      `Atomics.notify(sync, 0);`,
      `Atomics.wait(sync, 1, 0);`,
      `const result = require(workerData.modulePath).appendRow(workerData.planningDir, workerData.row);`,
      `if (!result.ok) Atomics.add(sync, 3, 1);`,
      `Atomics.add(sync, 2, 1);`,
      `Atomics.notify(sync, 2);`,
    ].join('\n');
    const workerCount = 12;
    const syncBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 4);
    const sync = new Int32Array(syncBuffer);
    const workers = Array.from({ length: workerCount }, () => new Worker(workerSource, {
      eval: true,
      workerData: {
        modulePath,
        planningDir: concurrentDir,
        row: validRow({ decision_id: 'concurrent-decision' }),
        syncBuffer,
      },
    }));
    workers.forEach((worker) => worker.unref());

    const deadline = Date.now() + 20000;
    while (Atomics.load(sync, 0) < workerCount && Date.now() < deadline) {
      Atomics.wait(sync, 0, Atomics.load(sync, 0), 100);
    }
    assert.strictEqual(Atomics.load(sync, 0), workerCount, 'workers did not reach the start barrier');
    Atomics.store(sync, 1, 1);
    Atomics.notify(sync, 1, workerCount);
    while (Atomics.load(sync, 2) < workerCount && Date.now() < deadline) {
      Atomics.wait(sync, 2, Atomics.load(sync, 2), 100);
    }
    assert.strictEqual(Atomics.load(sync, 2), workerCount, 'workers did not finish');
    assert.strictEqual(Atomics.load(sync, 3), 0, 'a concurrent append returned ok:false');

    const written = fs.readFileSync(concurrentLedger, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
    assert.strictEqual(written.length, seedCount + 1);
    assert.strictEqual(
      written.filter((row) => row.decision_id === 'concurrent-decision').length,
      1
    );
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

process.stdout.write(`${passed} pass, 0 fail\n`);
