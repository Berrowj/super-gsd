'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { registerRun } = require('./global-store.cjs');
const { readLedger } = require('./contract.cjs');
const { readBatch } = require('./sgsd-ledger-reader.cjs');
const { operationReport } = require('./operation-report.cjs');
const { createLedgerRuntime, readCaptureState, capturePaths,
  RECEIPT_MAX_BYTES, STATE_MAX_BYTES } = require('./sgsd-ledger-runtime.cjs');

const NOW = '2026-09-10T02:00:00.000Z';
const OLD = '2026-09-01T02:00:00.000Z';
const OBS = '123e4567-e89b-72d3-a456-426614174000';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function fixture(t) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-ledger-runtime-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'global');
  const projects = ['alpha','beta'].map(name => {
    const project = path.join(base, name);
    fs.mkdirSync(path.join(project, '.planning', 'metrics'), { recursive: true });
    return project;
  });
  return { base, root, projects };
}

function writeRows(project, name, rows) {
  const file = path.join(project, '.planning', 'metrics', name);
  fs.writeFileSync(file, rows.map(row => JSON.stringify(row)).join('\n') + '\n');
  return file;
}

function receiptBatches(root, projectId) {
  const file = capturePaths(root, projectId).receipts;
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
}

function receipts(root, projectId) {
  return receiptBatches(root, projectId).flatMap(batch => batch.receipts);
}

function events(root, projectId) {
  const directory = capturePaths(root, projectId).directory;
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).filter(name => /^sgsd-atlas-events-.*\.jsonl$/.test(name))
    .flatMap(name => readLedger(path.join(directory, name)).events);
}

function gate(ts, runId = null, observationId = OBS) {
  return { envelope_version: 1, ts, gate: 'phase-level-ATC', outcome: 'pass', duration_ms: 7,
    ...(observationId ? { atlas_observation: { schema_version: 1, observation_id: observationId,
      sgsd_run_id: runId, gate_invocation_id: null } } : {}) };
}

test('collector captures two projects separately, freezes cutoff, and restart does not replay committed sources', t => {
  const f = fixture(t);
  const runA = registerRun({ root: f.root, projectDir: f.projects[0] });
  registerRun({ root: f.root, projectDir: f.projects[0] });
  const runB = registerRun({ root: f.root, projectDir: f.projects[1] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', [gate(NOW, runA.run_id), gate(OLD, null,
    '223e4567-e89b-72d3-a456-426614174000')]);
  writeRows(f.projects[1], 'gate-value-log.jsonl', [gate(NOW, null,
    '323e4567-e89b-72d3-a456-426614174000')]);

  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW });
  runtime.cycle(); runtime.close();
  assert.equal(events(f.root, runA.project_id).length, 1);
  assert.equal(events(f.root, runB.project_id).length, 1);
  assert.equal(receipts(f.root,runA.project_id).length,2,'multiple run registrations discover one project source once');
  assert.equal(events(f.root, runA.project_id)[0].identity.sgsd_run_id, runA.run_id);
  assert.equal(events(f.root, runB.project_id)[0].identity.sgsd_run_id, null);
  const aReceipts = receipts(f.root, runA.project_id);
  assert.deepEqual(aReceipts.map(row => row.disposition).sort(), ['accepted','excluded']);
  assert.equal(aReceipts.find(row => row.disposition === 'excluded').reason, 'excluded_before_capture_window');
  assert.equal(aReceipts.find(row => row.disposition === 'accepted').run_correlation, 'exact');
  assert.equal(JSON.stringify(receiptBatches(f.root, runA.project_id)).includes(f.projects[0]), false);
  const state = readCaptureState({ root: f.root, projectId: runA.project_id });
  assert.equal(state.initial_cutoff_at, '2026-09-03T02:00:00.000Z');
  assert.ok(Object.values(state.sources).every(source => !path.isAbsolute(source.relative_path)));
  assert.equal(fs.statSync(capturePaths(f.root, runA.project_id).state).size <= STATE_MAX_BYTES, true);

  const before = { events: events(f.root, runA.project_id).length,
    batches: receiptBatches(f.root, runA.project_id).length };
  const restarted = createLedgerRuntime({ root: f.root, now: () => '2026-09-11T02:00:00.000Z' });
  restarted.cycle(); restarted.close();
  assert.deepEqual({ events: events(f.root, runA.project_id).length,
    batches: receiptBatches(f.root, runA.project_id).length }, before);
  assert.equal(readCaptureState({ root: f.root, projectId: runA.project_id }).initial_cutoff_at,
    state.initial_cutoff_at);
  assert.equal(fs.existsSync(runA.metrics_dir), false, 'operational capture never writes native accounting storage');
});

test('retry keeps committed cursor back and freezes observedAt plus first exact run decision', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', [{ envelope_version: 1, gate: 'phase-level-ATC',
    outcome: 'warn', atlas_observation: { schema_version: 1, observation_id: OBS,
      sgsd_run_id: run.run_id, gate_invocation_id: null } }]);
  let attempts = 0;
  const captured = [];
  const storeFactory = () => ({
    ingest(event) { attempts++; if (attempts === 1) return { status: 'rejected', reason: 'disk_pressure' };
      captured.push(event); return { status: 'accepted', event_id: sha('accepted') }; },
    status() { return { healthy: attempts !== 1, reason: attempts === 1 ? 'disk_pressure' : null,
      bytes: 0, indexed_events: captured.length }; },
  });
  let clock = NOW;
  const runtime = createLedgerRuntime({ root: f.root, now: () => clock, storeFactory });
  runtime.cycle();
  const pending = Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)
    .find(source => source.pending)?.pending;
  assert.equal(pending.observed_at, NOW);
  assert.equal(pending.correlations[0].sgsd_run_id, run.run_id);
  assert.equal(pending.correlations[0].run_correlation, 'exact');
  assert.equal(Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)
    .find(source => source.pending).cursor, null);
  fs.unlinkSync(path.join(run.state_dir, 'registration.json'));
  clock = '2026-09-10T03:00:00.000Z';
  runtime.cycle(); runtime.close();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].occurred_at, NOW);
  assert.equal(captured[0].identity.sgsd_run_id, run.run_id, 'replay keeps first correlation decision');
  assert.equal(receipts(f.root, run.project_id)[0].run_correlation, 'exact');
  const committed = Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)[0];
  assert.equal(committed.pending, null);
  assert.ok(committed.cursor.offset > 0);
});

test('crash after receipt append replays canonically and report dedup keeps the first decision', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', [gate(NOW, run.run_id)]);
  const originalRename = fs.renameSync;
  let stateRenames = 0;
  fs.renameSync = function (from, to) {
    if (to.endsWith('sgsd-ledger-state.json') && ++stateRenames === 2) throw new Error('fixture_crash');
    return originalRename.apply(this, arguments);
  };
  const crashed = createLedgerRuntime({ root: f.root, now: () => NOW });
  try { crashed.cycle(); } finally { fs.renameSync = originalRename; crashed.close(); }
  assert.equal(events(f.root, run.project_id).length, 1);
  assert.equal(receipts(f.root, run.project_id).length, 1);
  const pending = Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)[0].pending;
  assert.equal(pending.correlations[0].run_correlation, 'exact');

  fs.unlinkSync(path.join(run.state_dir, 'registration.json'));
  const restarted = createLedgerRuntime({ root: f.root, now: () => '2026-09-10T04:00:00.000Z' });
  restarted.cycle(); restarted.close();
  assert.equal(events(f.root, run.project_id).length, 1);
  const replayed = receipts(f.root, run.project_id);
  assert.equal(replayed.length, 2);
  assert.equal(new Set(replayed.map(row => row.receipt_id)).size, 1);
  assert.equal(replayed[0].disposition, 'accepted');
  assert.equal(replayed[1].disposition, 'duplicate');
  assert.equal(replayed.every(row => row.run_correlation === 'exact'), true);
});

test('receipts prove the exact normal and conflicting canonical candidates', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', [gate(NOW,run.run_id),
    { ...gate(NOW,run.run_id), outcome: 'warn' }]);
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  runtime.cycle(); runtime.close();
  const observed = receipts(f.root,run.project_id);
  const accepted = observed.find(row => row.disposition === 'accepted');
  const conflict = observed.find(row => row.disposition === 'conflict');
  assert.ok(accepted); assert.ok(conflict);
  assert.match(accepted.canonical_event_id,/^[a-f0-9]{64}$/);
  assert.equal(conflict.canonical_event_id,accepted.canonical_event_id);
  assert.match(accepted.canonical_payload_sha256,/^[a-f0-9]{64}$/);
  assert.notEqual(conflict.canonical_payload_sha256,accepted.canonical_payload_sha256);
  const canonical = events(f.root,run.project_id);
  const stored = canonical.find(row => row.event_type !== 'integrity_conflict');
  const conflictRow = canonical.find(row => row.event_type === 'integrity_conflict');
  assert.equal(stored.event_id,accepted.canonical_event_id);
  assert.equal(stored.payload_sha256,accepted.canonical_payload_sha256);
  assert.equal(conflictRow.conflicting_event_id,conflict.canonical_event_id);
  assert.equal(conflictRow.conflicting_payload_sha256,conflict.canonical_payload_sha256);
});

test('full sparse receipt capacity blocks canonical ingest and durably preserves pending coverage', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', [gate(NOW,run.run_id)]);
  const paths = capturePaths(f.root,run.project_id);
  fs.mkdirSync(paths.directory,{ recursive: true });
  fs.writeFileSync(paths.receipts,''); fs.truncateSync(paths.receipts,RECEIPT_MAX_BYTES);
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  runtime.cycle(); runtime.cycle(); runtime.close();
  assert.equal(events(f.root,run.project_id).length,0);
  const state = readCaptureState({ root: f.root, projectId: run.project_id });
  const source = Object.values(state.sources)[0];
  assert.ok(source.pending); assert.equal(source.cursor,null);
  assert.equal(source.last_reason,'receipt_capacity');
  assert.equal(source.counters.gaps,1); assert.equal(state.counters.gaps,1);
  assert.equal(source.counters.records,0); assert.equal(state.counters.records,0);
});

test('near-capacity reservation accounts for the longer duplicate receipt before store ingest', t => {
  const sample = fixture(t), sampleRun = registerRun({ root: sample.root, projectDir: sample.projects[0] });
  writeRows(sample.projects[0], 'gate-value-log.jsonl', [gate(NOW,sampleRun.run_id)]);
  const sampler = createLedgerRuntime({ root: sample.root, now: () => NOW, clock: () => 0,
    storeFactory: () => ({ ingest: () => ({ status: 'duplicate', event_id: sha('sample') }),
      status: () => ({ healthy: true, indexed_events: 0, bytes: 0 }) }) });
  sampler.cycle(); sampler.close();
  const duplicateBytes = fs.statSync(capturePaths(sample.root,sampleRun.project_id).receipts).size;
  assert.equal(receipts(sample.root,sampleRun.project_id)[0].disposition,'duplicate');

  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', [gate(NOW,run.run_id)]);
  const paths = capturePaths(f.root,run.project_id); fs.mkdirSync(paths.directory,{ recursive: true });
  fs.writeFileSync(paths.receipts,''); fs.truncateSync(paths.receipts,RECEIPT_MAX_BYTES - duplicateBytes + 1);
  let ingests = 0;
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0,
    storeFactory: () => ({ ingest() { ingests++; return { status: 'duplicate', event_id: sha('target') }; },
      status: () => ({ healthy: true, indexed_events: 0, bytes: 0 }) }) });
  runtime.cycle(); runtime.close();
  assert.equal(ingests,0);
  const state = readCaptureState({ root: f.root, projectId: run.project_id });
  assert.equal(Object.values(state.sources)[0].last_reason,'receipt_capacity');
});

test('receipt capacity preflight honors the ten-percent free-space floor before canonical ingest', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', [gate(NOW,run.run_id)]);
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0,
    receiptFreeRatio: () => 0.09 });
  runtime.cycle(); runtime.close();
  assert.equal(events(f.root,run.project_id).length,0);
  const state = readCaptureState({ root: f.root, projectId: run.project_id });
  const source = Object.values(state.sources)[0];
  assert.ok(source.pending); assert.equal(source.last_reason,'receipt_capacity');
  assert.equal(source.counters.gaps,1); assert.equal(state.counters.gaps,1);
});

test('a first-ever sole unsafe source creates private receipt storage before checking free space', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  const unsafe = writeRows(f.projects[0], 'only-unsafe.jsonl', [{ ts: NOW, value: 1 }]);
  fs.linkSync(unsafe,path.join(f.projects[0],'outside-metrics-hardlink.jsonl'));
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  runtime.cycle(); runtime.close();
  const observed = receipts(f.root,run.project_id);
  assert.equal(observed.length,1); assert.equal(observed[0].reason,'unsafe_hardlink');
  const source = Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)[0];
  assert.equal(source.last_reason,'unsafe_hardlink'); assert.equal(source.counters.records,1);
});

test('unmatched and cross-project run references become explicit null correlations', t => {
  const f = fixture(t);
  const runA = registerRun({ root: f.root, projectDir: f.projects[0] });
  const runB = registerRun({ root: f.root, projectDir: f.projects[1] });
  const unmatched = 'sgsd-423e4567-e89b-72d3-a456-426614174000';
  writeRows(f.projects[0], 'gate-value-log.jsonl', [gate(NOW, runB.run_id),
    gate(NOW, unmatched, '523e4567-e89b-72d3-a456-426614174000')]);
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW });
  runtime.cycle(); runtime.close();
  assert.deepEqual(events(f.root, runA.project_id).map(event => event.identity.sgsd_run_id), [null,null]);
  const observed = receipts(f.root, runA.project_id);
  assert.deepEqual(observed.map(row => row.run_correlation).sort(), ['cross_project','unmatched']);
  assert.deepEqual(observed.map(row => row.reason).sort(), ['cross_project_recorded_run','unmatched_recorded_run']);
});

test('unsafe source is isolated and idle projects do not reconstruct event stores', t => {
  const f = fixture(t);
  const runA = registerRun({ root: f.root, projectDir: f.projects[0] });
  registerRun({ root: f.root, projectDir: f.projects[1] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', [gate(NOW, runA.run_id)]);
  const original = writeRows(f.projects[0], 'untrusted-origin.jsonl', [{ ts: NOW, value: 1 }]);
  const hardlink = path.join(f.projects[0], '.planning', 'metrics', 'untrusted-hardlink.jsonl');
  fs.linkSync(original, hardlink);
  let stores = 0;
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW,
    storeFactory: options => { stores++; return require('./contract.cjs').createStore(options); } });
  runtime.cycle(); runtime.close();
  assert.equal(events(f.root, runA.project_id).length, 1);
  assert.ok(receipts(f.root, runA.project_id).some(row => row.disposition === 'rejected'
    && row.reason === 'unsafe_hardlink'));
  assert.equal(stores, 1, 'unsafe and idle sources do not create extra canonical stores');
  const report = operationReport({ root: f.root, projectId: runA.project_id, now: Date.parse(NOW) });
  assert.equal(report.projects[0].receipt_reconciliation.status, 'matched', JSON.stringify(report.findings));
  assert.ok(!report.findings.some(row => row.reason === 'capture_receipt_count_mismatch'));
});

test('unchanged committed sources perform no ledger reads, state writes, flushes, or store opens', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', [gate(NOW, run.run_id)]);
  let reads = 0, stores = 0;
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW,
    readBatchFn(options) { reads++; return readBatch(options); },
    storeFactory(options) { stores++; return require('./contract.cjs').createStore(options); } });
  runtime.cycle();
  const firstReads = reads, firstStores = stores, original = fs.fsyncSync;
  let flushes = 0;
  fs.fsyncSync = function () { flushes++; return original.apply(this, arguments); };
  let idle;
  try { idle = runtime.cycle(); } finally { fs.fsyncSync = original; runtime.close(); }
  assert.equal(idle.bytes_read, 0);
  assert.equal(reads, firstReads);
  assert.equal(stores, firstStores);
  assert.equal(flushes, 0);
});

test('deadline retains the whole pending batch, degrades operational health, and rotates next source', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', Array.from({ length: 20 }, (_, index) =>
    gate(NOW, null, `${String(index).padStart(8,'0')}-20f6-7b23-96d0-c995aaa419f9`)));
  writeRows(f.projects[0], 'review-ledger.jsonl', [{ envelope_version: 1, ts: NOW,
    status: 'pass', verdict: 'pass', phase: '170', plan: '170-10', provider: 'codex' }]);
  let attempts = 0;
  let tick = 0;
  const sourceReads = [];
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, maxCycleMs: 10,
    clock() { return tick++; },
    readBatchFn(options) { sourceReads.push(path.basename(options.file)); return readBatch(options); },
    storeFactory: () => ({ ingest() { attempts++; tick = 11;
      return { status: 'rejected', reason: 'disk_pressure' }; },
    status: () => ({ healthy: false, reason: 'disk_pressure', bytes: 0, indexed_events: 0 }) }) });
  const first = runtime.cycle();
  assert.ok(attempts < 20, 'processing stops instead of finishing an already-read 20-row batch');
  assert.equal(first.budget_exhausted, true);
  assert.ok(first.pending_bytes > 0);
  assert.equal(runtime.status().status, 'degraded');
  assert.equal(runtime.status().cycle.reason, 'disk_pressure');
  runtime.cycle(); runtime.close();
  assert.ok(sourceReads.includes('review-ledger.jsonl'), 'persisted source rotation prevents hot retry starvation');
  const source = Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)
    .find(value => value.family === 'gate_value');
  assert.equal(source.cursor, null);
  assert.ok(source.pending);
});

test('unchanged unsafe source keeps one stable receipt and failure observation', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  const original = writeRows(f.projects[0], 'bad-origin.jsonl', [{ ts: NOW, value: 1 }]);
  fs.linkSync(original,path.join(f.projects[0],'.planning','metrics','bad-hardlink.jsonl'));
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  for (let cycle = 0; cycle < 4; cycle++) {
    runtime.cycle();
    const state = readCaptureState({ root: f.root, projectId: run.project_id });
    if (Object.values(state?.sources || {}).length === 2
        && Object.values(state.sources).every(source => source.last_reason === 'unsafe_hardlink')) break;
  }
  const first = receiptBatches(f.root,run.project_id).length;
  const originalFsync = fs.fsyncSync; let flushes = 0;
  fs.fsyncSync = function () { flushes++; return originalFsync.apply(this,arguments); };
  try { runtime.cycle(); } finally { fs.fsyncSync = originalFsync; runtime.close(); }
  assert.equal(receiptBatches(f.root,run.project_id).length,first);
  assert.equal(flushes,0);
});

test('cycle and private artifacts remain hard bounded with low-cardinality cached status', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  const many = Array.from({ length: 300 }, (_, index) => gate(NOW, null,
    `${String(index).padStart(8,'0')}-20f6-7b23-96d0-c995aaa419f9`));
  writeRows(f.projects[0], 'gate-value-log.jsonl', many);
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW });
  let result;
  for (let cycle = 0; cycle < 10 && !fs.existsSync(capturePaths(f.root,run.project_id).receipts); cycle++)
    result = runtime.cycle();
  const status = runtime.status();
  assert.ok(result.bytes_read <= 1024 * 1024);
  assert.ok(result.duration_ms <= 100 || result.budget_exhausted === true);
  assert.ok(result.projects_enumerated <= 32);
  assert.ok(result.records <= 256);
  assert.deepEqual(Object.keys(status.families).every(name => [
    'gate_value','review','commit_review','gate_evidence','muda','route_decision','edge_guard',
    'orchestrator_live','worker','worker_state','wrapper_result','generic_metric'].includes(name)), true);
  assert.equal(JSON.stringify(status).includes(f.projects[0]), false);
  assert.ok(fs.statSync(capturePaths(f.root, run.project_id).receipts).size <= RECEIPT_MAX_BYTES);
  for (const line of fs.readFileSync(capturePaths(f.root, run.project_id).receipts, 'utf8').trim().split(/\r?\n/))
    assert.ok(Buffer.byteLength(line) <= 64 * 1024, 'receipt batches remain readable by the bounded reader');
  runtime.close();
});

test('an unchanged static backlog drains across bounded cycles and receipt batches stay below the exported line cap', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', Array.from({ length: 300 }, (_, index) => gate(NOW, null,
    `${String(index).padStart(8,'0')}-20f6-7b23-96d0-c995aaa419f9`)));
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  for (let cycle = 0; cycle < 50 && receipts(f.root,run.project_id).length < 300; cycle++) runtime.cycle();
  runtime.close();
  assert.equal(receipts(f.root,run.project_id).length,300);
  assert.equal(events(f.root,run.project_id).length,300);
  for (const line of fs.readFileSync(capturePaths(f.root,run.project_id).receipts,'utf8').trim().split(/\r?\n/))
    assert.ok(Buffer.byteLength(line) <= require('./sgsd-ledger-runtime.cjs').MAX_RECEIPT_BATCH_BYTES);
});

test('a byte-limited unchanged backlog is not mistaken for an incomplete tail', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  const padding = 'x'.repeat(20 * 1024);
  writeRows(f.projects[0], 'gate-value-log.jsonl', Array.from({ length: 20 }, (_, index) => ({
    ...gate(NOW,null,`${String(index).padStart(8,'0')}-20f6-7b23-96d0-c995aaa419f9`), ignored: padding })));
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  for (let cycle = 0; cycle < 5 && events(f.root,run.project_id).length < 20; cycle++) runtime.cycle();
  runtime.close();
  assert.equal(events(f.root,run.project_id).length,20);
  const source = Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)[0];
  assert.equal(source.cursor.offset,source.cursor.source_size);
});

test('a timed-out large batch persistently shrinks until its unchanged prefix advances', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', Array.from({ length: 12 }, (_, index) => gate(NOW,null,
    `${String(index).padStart(8,'0')}-20f6-7b23-96d0-c995aaa419f9`)));
  let tick = 0;
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, maxCycleMs: 10, clock: () => tick++ });
  for (let cycle = 0; cycle < 50 && events(f.root,run.project_id).length < 12; cycle++) runtime.cycle();
  runtime.close();
  assert.equal(events(f.root,run.project_id).length,12);
  const source = Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)[0];
  assert.equal(source.pending,null);
  assert.equal(source.cursor.offset,source.cursor.source_size);
});

test('a reduced prefix commit preserves unknown time and exact run decisions for the untouched suffix across restart', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  writeRows(f.projects[0], 'gate-value-log.jsonl', Array.from({ length: 4 }, (_, index) => ({
    envelope_version: 1, gate: 'phase-level-ATC', outcome: 'pass', atlas_observation: {
      schema_version: 1, observation_id: `${String(index).padStart(8,'0')}-20f6-7b23-96d0-c995aaa419f9`,
      sgsd_run_id: run.run_id, gate_invocation_id: null } })));
  let tick = 0;
  const first = createLedgerRuntime({ root: f.root, now: () => NOW, maxCycleMs: 10,
    clock() { const value = tick; tick += 3; return value; } });
  first.cycle(); first.close();
  const frozenSource = Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)[0];
  const frozen = frozenSource.pending;
  assert.equal(frozen.correlations.length,4);
  assert.equal(frozen.attempt_records,2);
  assert.equal(frozenSource.last_reason,'processing_budget');
  assert.equal(frozen.correlations.every(item => item.run_correlation === 'exact'),true);
  fs.unlinkSync(path.join(run.state_dir,'registration.json'));
  const readLimits = [], byteLimits = [];
  const restarted = createLedgerRuntime({ root: f.root, now: () => '2026-09-10T08:00:00.000Z', clock: () => 0,
    readBatchFn(options) { readLimits.push(options.maxRecords); byteLimits.push(options.maxBytes);
      return readBatch(options); } });
  restarted.cycle();
  assert.deepEqual(readLimits,[2]);
  assert.deepEqual(byteLimits,[80 * 1024]);
  const replayState = readCaptureState({ root: f.root, projectId: run.project_id });
  const suffix = Object.values(replayState.sources)[0].pending;
  assert.ok(suffix,JSON.stringify(replayState));
  assert.equal(suffix.correlations.length,2);
  assert.equal(suffix.observed_at,NOW);
  restarted.cycle(); restarted.close();
  assert.equal(events(f.root,run.project_id).length,4);
  assert.equal(events(f.root,run.project_id).every(event => event.occurred_at === NOW
    && event.identity.sgsd_run_id === run.run_id),true);
  assert.equal(receipts(f.root,run.project_id).every(receipt => receipt.run_correlation === 'exact'),true);
});

test('discovery includes named worker snapshots and fallback phase reviews without a canonical review ledger', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  const worker = path.join(f.projects[0],'.planning','worker-sessions','worker-a');
  fs.mkdirSync(worker,{ recursive: true });
  fs.writeFileSync(path.join(worker,'state.json'),JSON.stringify({ schema_version: 1, worker_id: OBS,
    status: 'completed', created_at: NOW, updated_at: NOW, thread_id: OBS, turn_id: OBS, pending: [] }));
  fs.writeFileSync(path.join(worker,'wrapper-result.json'),JSON.stringify({ schema_version: 1,
    wrapper_attempt_id: '423e4567-e89b-72d3-a456-426614174000', worker_id: OBS, thread_id: OBS,
    turn_id: OBS, exit_code: 0, sha256: 'b'.repeat(64), bytes: 12, finished_at: NOW }));
  const phase = path.join(f.projects[0],'.planning','phases','170-capture'); fs.mkdirSync(phase,{ recursive: true });
  fs.writeFileSync(path.join(phase,'commit-reviews.jsonl'),JSON.stringify({ envelope_version: 1, ts: NOW,
    status: 'pass', verdict: 'pass', phase: '170', plan: '170-10', provider: 'codex' }) + '\n');
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  runtime.cycle(); runtime.close();
  assert.deepEqual([...new Set(receipts(f.root,run.project_id).map(row => row.family))].sort(),
    ['commit_review','worker_state','wrapper_result']);
});

test('a mutable worker snapshot rewritten under storage pressure retires stale pending provenance with an explicit gap', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  const worker = path.join(f.projects[0],'.planning','worker-sessions','worker-rewrite');
  fs.mkdirSync(worker,{ recursive: true });
  const file = path.join(worker,'state.json');
  fs.writeFileSync(file,JSON.stringify({ schema_version: 1, worker_id: OBS, status: 'running',
    created_at: NOW, updated_at: NOW, thread_id: OBS, turn_id: OBS, pending: [] }));
  let attempts = 0; const captured = [];
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0,
    storeFactory: () => ({ ingest(event) { if (++attempts === 1) return { status: 'rejected', reason: 'disk_pressure' };
      captured.push(event); return { status: 'accepted' }; }, status() { return { healthy: true }; } }) });
  runtime.cycle();
  assert.ok(Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)[0].pending);
  fs.writeFileSync(file,JSON.stringify({ schema_version: 1, worker_id: OBS, status: 'completed',
    created_at: NOW, updated_at: '2026-09-10T03:00:00.000Z', thread_id: OBS, turn_id: OBS,
    pending: [], revision_marker: true }));
  runtime.cycle(); runtime.close();
  assert.equal(captured.length,1);
  const state = readCaptureState({ root: f.root, projectId: run.project_id });
  assert.equal(Object.values(state.sources)[0].pending,null);
  assert.ok(receipts(f.root,run.project_id).some(receipt => receipt.reason === 'source_rewritten'
    && receipt.disposition === 'rejected'));
});

test('a same-size JSONL rewrite while pending starts a new occurrence and records the discontinuity', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  const file = writeRows(f.projects[0],'gate-value-log.jsonl',[gate(NOW,run.run_id,
    '123e4567-e89b-72d3-a456-426614174000')]);
  let attempts = 0; const captured = [];
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0,
    storeFactory: () => ({ ingest(event) { if (++attempts === 1) return { status: 'rejected', reason: 'disk_pressure' };
      captured.push(event); return { status: 'accepted' }; }, status() { return { healthy: true }; } }) });
  runtime.cycle();
  const pendingOccurrence = Object.values(readCaptureState({ root: f.root, projectId: run.project_id }).sources)[0]
    .pending.source_occurrence_id;
  writeRows(f.projects[0],'gate-value-log.jsonl',[gate(NOW,run.run_id,
    '223e4567-e89b-72d3-a456-426614174000')]);
  const future = new Date(Date.now() + 2000); fs.utimesSync(file,future,future);
  runtime.cycle(); runtime.close();
  const rows = receipts(f.root,run.project_id);
  assert.equal(captured.length,1);
  assert.ok(rows.some(receipt => receipt.reason === 'source_rewritten'));
  assert.notEqual(rows.find(receipt => receipt.disposition === 'accepted').source_occurrence_id,pendingOccurrence);
});

test('restart health remains degraded for durable malformed source evidence without replay inflation', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  const file = path.join(f.projects[0],'.planning','metrics','gate-value-log.jsonl');
  fs.writeFileSync(file,'{malformed}\n');
  const first = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  first.cycle(); first.close();
  const count = receipts(f.root,run.project_id).length;
  const restarted = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  restarted.cycle();
  assert.equal(restarted.status().status,'degraded');
  assert.equal(restarted.status().cycle.reason,'malformed_json');
  restarted.cycle(); restarted.close();
  assert.equal(receipts(f.root,run.project_id).length,count);
});

test('a previously tracked source deletion records one stable missing-source gap', t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0] });
  const file = writeRows(f.projects[0],'gate-value-log.jsonl',[gate(NOW,run.run_id)]);
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  runtime.cycle(); fs.unlinkSync(file); runtime.cycle();
  const missing = receipts(f.root,run.project_id).filter(receipt => receipt.reason === 'source_missing');
  assert.equal(missing.length,1);
  assert.equal(runtime.status().status,'degraded');
  runtime.cycle(); runtime.close();
  assert.equal(receipts(f.root,run.project_id).filter(receipt => receipt.reason === 'source_missing').length,1);
});

test('project batches rotate fairly and store cache admission remains bounded', t => {
  const f = fixture(t), projects = [];
  for (let index = 0; index < 9; index++) {
    const project = path.join(f.base, `fair-${index}`);
    fs.mkdirSync(path.join(project, '.planning', 'metrics'), { recursive: true });
    const run = registerRun({ root: f.root, projectDir: project });
    const count = index === 0 ? 300 : 1;
    writeRows(project, 'gate-value-log.jsonl', Array.from({ length: count }, (_, row) =>
      gate(NOW, null, `${String(index * 1000 + row).padStart(8,'0')}-20f6-7b23-96d0-c995aaa419f9`)));
    projects.push(run);
  }
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, maxProjects: 2,
    maxCachedStores: 2, maxCachedRows: 50 });
  for (let cycle = 0; cycle < 12; cycle++) runtime.cycle();
  assert.equal(projects.every(run => events(f.root, run.project_id).length > 0), true,
    'a hot first project cannot starve later registration batches');
  assert.ok(runtime.status().cached_stores <= 2);
  assert.ok(runtime.status().cached_rows <= 50);
  runtime.close();
});

test('capture path and state readers distinguish absence from invalid private state', t => {
  const f = fixture(t), projectId = 'a'.repeat(64), paths = capturePaths(f.root, projectId);
  assert.equal(readCaptureState({ root: f.root, projectId }), null);
  assert.equal(path.basename(paths.state), 'sgsd-ledger-state.json');
  assert.equal(path.basename(paths.receipts), 'sgsd-ledger-receipts.jsonl');
  fs.mkdirSync(paths.directory, { recursive: true });
  fs.writeFileSync(paths.state, '{}');
  assert.throws(() => readCaptureState({ root: f.root, projectId }), /invalid_capture_state/);
});
