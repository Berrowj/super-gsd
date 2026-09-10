'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validate } = require('./contract.cjs');
const { SOURCES, projectRecord } = require('./sgsd-ledger.cjs');
const { readBatch } = require('./sgsd-ledger-reader.cjs');

const PROJECT = 'a'.repeat(64);
const RUN = 'sgsd-123e4567-e89b-12d3-a456-426614174000';
const OBS = '123e4567-e89b-12d3-a456-426614174000';
const NOW = '2026-09-09T23:00:00Z';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const digest = row => sha(JSON.stringify(row));
const input = (family, row, extra = {}) => ({ family, row, projectId: PROJECT,
  sourceId: 'metrics/example.jsonl#occurrence-1', recordDigest: digest(row), sequence: 7,
  observedAt: NOW, ...extra });

test('SOURCES is a frozen complete bounded discovery catalog', () => {
  const expected = ['gate_value','review','commit_review','gate_evidence','muda','route_decision',
    'edge_guard','orchestrator_live','worker','worker_state','wrapper_result','generic_metric'];
  assert.deepEqual(Object.keys(SOURCES).sort(), expected.sort());
  assert.ok(Object.isFrozen(SOURCES));
  for (const [family, source] of Object.entries(SOURCES)) {
    assert.equal(source.family, family);
    assert.ok(['jsonl','json'].includes(source.format));
    assert.ok(['full','typed_partial','generic'].includes(source.detail_coverage));
    assert.ok(Object.isFrozen(source));
  }
});

test('gate projection is canonical and content-free and never adopts legacy run_id', () => {
  const canary = 'PRIVATE prompt /home/operator customer@example.test';
  const row = { envelope_version: 1, ts: NOW, run_id: '2026-09-09T23:00:00.000Z-a1b2',
    gate: canary, outcome: 'pass', status: 'ok', duration_ms: 31,
    next_action: canary, evidence: [{ kind: 'report', ref: canary }], _legacy: { prompt: canary } };
  const result = projectRecord(input('gate_value', row));
  assert.equal(result.reason, null);
  assert.equal(validate(result.event), null);
  assert.equal(result.event.source.kind, 'sgsd_ledger');
  assert.equal(result.event.source.instance, PROJECT);
  assert.equal(result.event.identity.sgsd_run_id, null);
  assert.equal(result.event.gate.verdict, 'pass');
  assert.deepEqual(result.event.usage, { duration_ms: 31 });
  assert.equal(result.event.payload.content_digest, digest(row));
  assert.equal(result.event.payload.raw_content_recorded, false);
  assert.equal(JSON.stringify(result).includes(canary), false);
  assert.equal(Object.keys(result.event.usage).some(key => /token|cache|cost/.test(key)), false);
});

test('producer observation identity is preferred and only strict recorded Atlas runs survive', () => {
  const base = { envelope_version: 1, ts: NOW, gate: 'phase-level-ATC', outcome: 'warn',
    atlas_observation: { schema_version: 1, observation_id: OBS, sgsd_run_id: RUN,
      gate_invocation_id: '223e4567-e89b-12d3-a456-426614174000' } };
  const exact = projectRecord(input('gate_value', base));
  assert.equal(exact.event.identity.sgsd_run_id, RUN);
  assert.equal(exact.event.identity.gate_invocation_id, base.atlas_observation.gate_invocation_id);
  assert.equal(exact.detail.identity_provenance, 'producer_observation');

  const invalid = projectRecord(input('gate_value', { ...base,
    atlas_observation: { ...base.atlas_observation, sgsd_run_id: 'not-an-atlas-run' } }));
  assert.equal(invalid.event.identity.sgsd_run_id, null);
  assert.equal(invalid.reason, 'invalid_recorded_run_identity');
});

test('UUIDv7 producer, run, invocation and worker IDs retain exact join identity', () => {
  const observationId = '01a08882-20f6-7b23-96d0-c995aaa419f9';
  const runId = 'sgsd-01a08882-20f6-7b23-96d0-c995aaa419f9';
  const invocationId = '01a08882-20f6-7b23-96d0-c995aaa419f8';
  const row = { envelope_version: 1, ts: NOW, gate: 'phase-level-ATC', outcome: 'pass',
    atlas_observation: { schema_version: 1, observation_id: observationId,
      sgsd_run_id: runId, gate_invocation_id: invocationId } };
  const projected = projectRecord(input('gate_value', row));
  assert.equal(projected.event.identity.sgsd_run_id, runId);
  assert.equal(projected.event.identity.gate_invocation_id, invocationId);

  const worker = projectRecord(input('worker', { schema_version: 1, ts: NOW, boundary: 'save', action: null,
    worker_id: observationId, thread_id: observationId, turn_id: observationId, status: 'running' }));
  assert.equal(worker.detail.thread_id, observationId);
  assert.equal(worker.detail.thread_id_identity, 'exact_uuid');
  const impossible = projectRecord(input('gate_value', { ...row,
    atlas_observation: { ...row.atlas_observation, sgsd_run_id: `sgsd-${'-'.repeat(36)}` } }));
  assert.equal(impossible.event.identity.sgsd_run_id, null);
  assert.equal(impossible.reason, 'invalid_recorded_run_identity');
});

test('logical replay keeps identity while payload and source occurrence remain independently observable', () => {
  const first = { envelope_version: 1, ts: NOW, gate: 'phase-level-ATC', outcome: 'pass',
    atlas_observation: { schema_version: 1, observation_id: OBS, sgsd_run_id: null, gate_invocation_id: null } };
  const second = { ...first, outcome: 'warn' };
  const a = projectRecord(input('gate_value', first));
  const b = projectRecord(input('gate_value', second, { sourceId: 'metrics/example.jsonl#occurrence-2' }));
  assert.equal(a.event.source_event_id, b.event.source_event_id);
  assert.notEqual(a.event.payload.content_digest, b.event.payload.content_digest);
  assert.notEqual(a.event.source.version, b.event.source.version);
});

test('legacy and generic fallback identity is occurrence-scoped, stable on replay, and explicitly weak', () => {
  const generic = { ts: NOW, count: 1 };
  const first = projectRecord(input('generic_metric', generic, { sourceId: 'metrics/a.jsonl#1', sequence: 4 }));
  const replay = projectRecord(input('generic_metric', generic, { sourceId: 'metrics/a.jsonl#1', sequence: 4 }));
  const other = projectRecord(input('generic_metric', generic, { sourceId: 'metrics/b.jsonl#1', sequence: 4 }));
  assert.equal(first.event.source_event_id, replay.event.source_event_id);
  assert.notEqual(first.event.source_event_id, other.event.source_event_id);
  assert.equal(first.detail.identity_provenance, 'source_occurrence_fallback');
  assert.equal(first.event.source.confidence, 'unknown');
  assert.equal(first.event.source.completeness_reason, 'underlying_invocation_unknown');

  const legacyRun = { envelope_version: 1, ts: NOW, status: 'ok', verdict: 'pass', phase: '170',
    plan: '170-10', provider: 'codex', run_id: 'arbitrary-but-repeated' };
  const a = projectRecord(input('review', legacyRun, { sourceId: 'review-ledger#1', sequence: 1 }));
  const b = projectRecord(input('review', legacyRun, { sourceId: 'review-ledger#2', sequence: 1 }));
  assert.notEqual(a.event.source_event_id, b.event.source_event_id);
  assert.equal(a.detail.identity_provenance, 'source_occurrence_fallback');
});

test('canonical review is primary and per-phase fallback exposes only a weak semantic equivalence key', () => {
  const legacy = { ts: NOW, plan: '170-10', provider: 'codex', phase: '170', tier: 'full',
    verdict: 'warn', critical: 0, warning: 2, pass_rate: 0.8, one_liner: 'SECRET finding' };
  const canonical = { envelope_version: 1, ts: NOW, status: 'warn', phase: '170',
    _source_phase: '170-atlas-capture-foundation', _legacy: legacy };
  const a = projectRecord(input('review', canonical));
  const b = projectRecord(input('commit_review', legacy));
  assert.equal(SOURCES.commit_review.fallback_for, 'review');
  assert.equal(SOURCES.commit_review.collect_when_primary_absent, true);
  assert.notEqual(a.event.source_event_id, b.event.source_event_id);
  assert.equal(a.detail.semantic_equivalence_sha256, b.detail.semantic_equivalence_sha256);
  assert.equal(a.detail.semantic_equivalence_confidence, 'unknown');
  assert.equal(b.detail.semantic_equivalence_confidence, 'unknown');
  assert.equal(JSON.stringify([a,b]).includes('SECRET'), false);
  assert.equal(a.detail.critical_count, 0);
  assert.equal(a.detail.warning_count, 2);
});

test('distinct producer review observations never collapse even with the same legacy tuple', () => {
  const common = { ts: NOW, plan: '170-10', provider: 'codex', phase: '170', verdict: 'pass' };
  const a = projectRecord(input('commit_review', { ...common,
    atlas_observation: { schema_version: 1, observation_id: OBS, sgsd_run_id: null, gate_invocation_id: null } }));
  const b = projectRecord(input('commit_review', { ...common,
    atlas_observation: { schema_version: 1, observation_id: '323e4567-e89b-12d3-a456-426614174000', sgsd_run_id: null, gate_invocation_id: null } }));
  assert.notEqual(a.event.source_event_id, b.event.source_event_id);
});

test('mutable worker snapshots use content identity and arbitrary identifier-shaped strings never escape', () => {
  const canary = 'PRIVATE_ID_CANARY';
  const first = { schema_version: 1, worker_id: OBS, status: 'running', updated_at: NOW,
    thread_id: canary, turn_id: canary, pending: [] };
  const second = { ...first, status: 'completed' };
  const a = projectRecord(input('worker_state', first));
  const b = projectRecord(input('worker_state', second));
  assert.notEqual(a.event.source_event_id, b.event.source_event_id);
  assert.equal(a.event.identity.thread_id, null);
  assert.equal(a.detail.thread_id, null);
  assert.equal(a.detail.thread_id_sha256, sha(canary));
  assert.equal(a.detail.thread_id_identity, 'hashed_non_join');
  assert.equal(JSON.stringify(a).includes(canary), false);
});

test('worker projection preserves pre-hashed non-join IDs and closed mailbox result statuses', () => {
  const prehashed = 'c'.repeat(64);
  for (const resultStatus of ['applied','rejected','unconfirmed']) {
    const row = { schema_version: 1, ts: NOW, boundary: 'result', action: 'reply', worker_id: OBS,
      status: 'running', thread_id: prehashed, turn_id: prehashed, result_status: resultStatus };
    const projected = projectRecord(input('worker', row));
    assert.equal(projected.detail.thread_id, null);
    assert.equal(projected.detail.thread_id_sha256, prehashed);
    assert.equal(projected.detail.thread_id_identity, 'hashed_non_join');
    assert.equal(projected.detail.turn_id_sha256, prehashed);
    assert.equal(projected.detail.result_status, resultStatus);
  }
  const unknown = projectRecord(input('worker', { schema_version: 1, ts: NOW, boundary: 'result',
    action: null, worker_id: OBS, result_status: 'private-status' }));
  assert.equal(unknown.detail.result_status, null);
});

test('MUDA projects typed measurements and explicit unknown, synthetic and qualitative coverage', () => {
  const row = { ts: NOW, warn: 1, fail: 0, exit: 1,
    probes: { haiku_fails: 'PASS', narrative_age_sec: 'WARN' },
    atlas_muda: { schema_version: 1,
      mechanical: { executed: true, coverage: 'measured', no_input: false, synthetic: false, exit: 1,
        probes: { narrative_age_sec: { value: 1900, warn_threshold: 1800, fail_threshold: 3600,
          denominator: null, no_input: false, verdict: 'WARN' } } },
      qualitative: { enabled: true, diff_lines: 250, mechanical_exit: 1, dry_run: false,
        eligible: false, attempted: false, exit_code: null, closed_reason: 'mechanical_findings', critical: null, warnings: null } } };
  const result = projectRecord(input('muda', row));
  assert.equal(validate(result.event), null);
  assert.equal(result.detail.warn_count, 1);
  assert.equal(result.detail.fail_count, 0);
  assert.deepEqual(result.detail.probes.narrative_age_sec, {
    verdict: 'warn', value: 1900, warn_threshold: 1800, fail_threshold: 3600,
    denominator: null, no_input: false, measurement: 'measured'
  });
  assert.deepEqual(result.detail.qualitative, { enabled: true, diff_lines: 250, mechanical_exit: 1,
    dry_run: false, eligible: false, attempted: false, exit_code: null, closed_reason: 'mechanical_findings', critical_count: null,
    warning_count: null });
  assert.equal(result.detail.synthetic, false);

  const historical = projectRecord(input('muda', { ts: NOW, warn: 0, fail: 0, exit: 0,
    probes: { inventory: 'PASS' } }));
  assert.equal(historical.detail.probes.inventory.value, null);
  assert.equal(historical.detail.probes.inventory.measurement, 'unknown');
});

test('all supported families project safe activity without raw native accounting fields', () => {
  const rows = {
    gate_evidence: { envelope_version: 1, ts: NOW, signal: 'hook_route', status: 'ok', route_ok: true,
      eligible: true, fired: false, decision: 'allow', outcome: 'pass', evidence_hit_count: 2 },
    route_decision: { envelope_version: 1, ts: NOW, boundary: 'dispatch_route', status: 'ok', decision: { fallback_triggered: false, exit: 0 } },
    edge_guard: { ts: NOW, resolution: 'log-only', expected_emits: ['private/path'], actual_emits: [], missing_emits: ['private/path'], from_step: 6, to_step: 7 },
    orchestrator_live: { schema_version: 1, ts: NOW, type: 'agent_completed', phase: '170', data: { worker_id: OBS, status: 'completed', question: 'SECRET' } },
    worker: { schema_version: 1, ts: NOW, boundary: 'save', action: null, worker_id: OBS, status: 'running', thread_id: 'thread-1', pending_count: 3 },
    worker_state: { schema_version: 1, worker_id: OBS, status: 'completed', created_at: NOW, updated_at: NOW, thread_id: 'thread-1', turn_id: 'turn-1', pending: [{ text: 'SECRET' }] },
    wrapper_result: { schema_version: 1, wrapper_attempt_id: '423e4567-e89b-12d3-a456-426614174000', worker_id: OBS, thread_id: 'thread-1', turn_id: 'turn-1', exit_code: 0, sha256: 'b'.repeat(64), bytes: 123, finished_at: NOW, report_path: '/SECRET/report' },
    generic_metric: { ts: NOW, arbitrary: 'SECRET', count: 99, input_tokens: 12345 }
  };
  for (const [family, row] of Object.entries(rows)) {
    const result = projectRecord(input(family, row));
    assert.ok(result.event, `${family}: ${result.reason}`);
    assert.equal(validate(result.event), null, family);
    assert.equal(JSON.stringify(result).includes('SECRET'), false, family);
    assert.equal(Object.keys(result.event.usage || {}).some(key => /token|cache|cost/.test(key)), false, family);
    assert.equal(JSON.stringify(result).includes('input_tokens'), false, family);
  }
  assert.equal(projectRecord(input('edge_guard', rows.edge_guard)).detail.expected_emit_count, 1);
  assert.deepEqual(Object.fromEntries(Object.entries(projectRecord(input('gate_evidence', rows.gate_evidence)).detail)
    .filter(([key]) => ['eligible','fired','decision','outcome'].includes(key))),
    { eligible: true, fired: false, decision: 'allow', outcome: 'pass' });
  assert.equal(projectRecord(input('wrapper_result', rows.wrapper_result)).detail.report_bytes, 123);
  assert.equal(projectRecord(input('generic_metric', rows.generic_metric)).detail.detail_coverage, 'unknown');
});

test('generic producer timestamps are retained for bounded lookback classification', () => {
  const result = projectRecord(input('generic_metric', { generated_at: '2026-09-08T12:00:00Z', count: 1 }));
  assert.equal(result.event.occurred_at, '2026-09-08T12:00:00Z');
  assert.equal(result.reason, 'semantic_detail_unknown');
});

test('unknown families, schemas and unsafe caller inputs reject explicitly', () => {
  assert.equal(projectRecord(input('unknown', {})).reason, 'unknown_family');
  assert.equal(projectRecord(input('orchestrator_live', { schema_version: 99, ts: NOW, type: 'run_started', data: {} })).reason, 'unsupported_source_schema');
  assert.equal(projectRecord(input('gate_value', [])).reason, 'invalid_source_row');
  const unsafeMuda = { ts: NOW, atlas_muda: { schema_version: 1, raw_evidence: 'private', mechanical: {}, qualitative: {} } };
  assert.equal(projectRecord(input('muda', unsafeMuda)).reason, 'invalid_muda_shape');
  assert.equal(projectRecord({ ...input('gate_value', {}), projectId: 'bad' }).reason, 'invalid_project_id');
  assert.equal(projectRecord({ ...input('gate_value', {}), recordDigest: 'bad' }).reason, 'invalid_record_digest');
});

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-ledger-reader-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return { dir, file: path.join(dir, 'source.jsonl') };
}

function readWithInjectedMutation(file, expectedBytes, mutate, read) {
  const original = fs.readSync;
  let injected = false;
  fs.readSync = function (...args) {
    const count = original.apply(this, args);
    if (!injected && args[4] === 0 && count === expectedBytes) {
      injected = true;
      mutate();
    }
    return count;
  };
  try { return read(); } finally { fs.readSync = original; }
}

test('reader returns exact byte provenance and resumes with finite record bounds', t => {
  const f = fixture(t), lines = ['{"a":1}', '{"b":2}', '{"c":3}'];
  fs.writeFileSync(f.file, lines.join('\n') + '\n');
  const first = readBatch({ file: f.file, maxRecords: 2 });
  assert.equal(first.records.length, 2);
  assert.deepEqual(first.records[0], { offset: 0, length: 7, sha256: sha(lines[0]), value: { a: 1 } });
  assert.equal(first.eof, false);
  assert.ok(first.bytesRead <= 256 * 1024);
  assert.equal(JSON.stringify(first.cursor).includes(lines[0]), false);
  const second = readBatch({ file: f.file, cursor: first.cursor, maxRecords: 2 });
  assert.deepEqual(second.records.map(r => r.value), [{ c: 3 }]);
  assert.equal(second.eof, true);
  assert.equal(second.pendingBytes, 0);
});

test('reader retains incomplete tails until newline completes the source record', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '{"a":1}\n{"pending":');
  const first = readBatch({ file: f.file });
  assert.deepEqual(first.records.map(r => r.value), [{ a: 1 }]);
  assert.equal(first.pendingBytes, Buffer.byteLength('{"pending":'));
  assert.equal(first.eof, false);
  fs.appendFileSync(f.file, 'true}\n');
  const second = readBatch({ file: f.file, cursor: first.cursor });
  assert.deepEqual(second.records.map(r => r.value), [{ pending: true }]);
  assert.equal(second.eof, true);
});

test('reader distinguishes newline-free JSON snapshots from incomplete JSONL tails', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '{"snapshot":true}');
  const jsonl = readBatch({ file: f.file });
  assert.equal(jsonl.records.length, 0);
  assert.equal(jsonl.pendingBytes, Buffer.byteLength('{"snapshot":true}'));
  fs.appendFileSync(f.file, '\n');
  const completedJsonl = readBatch({ file: f.file, cursor: jsonl.cursor });
  assert.deepEqual(completedJsonl.records.map(r => r.value), [{ snapshot: true }]);

  fs.writeFileSync(f.file, '{"snapshot":true}');
  const complete = readBatch({ file: f.file, format: 'json' });
  assert.deepEqual(complete.records.map(r => r.value), [{ snapshot: true }]);
  assert.equal(complete.eof, true);
  fs.writeFileSync(f.file, '{"snapshot":');
  const partial = readBatch({ file: f.file, format: 'json' });
  assert.equal(partial.records.length, 0);
  assert.equal(partial.pendingBytes, Buffer.byteLength('{"snapshot":'));
  assert.equal(partial.eof, false);
});

test('JSON snapshot mode parses one pretty-printed value and rejects multiple values', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '{\n  "snapshot": true,\n  "count": 2\n}');
  const pretty = readBatch({ file: f.file, format: 'json' });
  assert.deepEqual(pretty.records.map(r => r.value), [{ snapshot: true, count: 2 }]);
  fs.writeFileSync(f.file, '{"one":1}\n{"two":2}');
  const multiple = readBatch({ file: f.file, format: 'json' });
  assert.equal(multiple.records.length, 0);
  assert.deepEqual(multiple.gaps.map(g => g.reason), ['malformed_json']);
  assert.equal(multiple.pendingBytes, fs.statSync(f.file).size);
});

test('JSON snapshot mode replays only after a bounded size or mtime change', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '{"snapshot":true}');
  const initial = readBatch({ file: f.file, format: 'json' });
  assert.deepEqual(initial.records.map(record => record.value), [{ snapshot: true }]);

  const unchanged = readBatch({ file: f.file, format: 'json', cursor: initial.cursor });
  assert.equal(unchanged.records.length, 0);
  assert.equal(unchanged.pendingBytes, 0);
  assert.equal(unchanged.eof, true);

  fs.appendFileSync(f.file, ' ');
  const grown = readBatch({ file: f.file, format: 'json', cursor: unchanged.cursor });
  assert.deepEqual(grown.records.map(record => record.value), [{ snapshot: true }]);
  assert.deepEqual(grown.gaps.map(gap => gap.reason), ['source_rewritten']);
  assert.equal(grown.pendingBytes, 0);
  assert.equal(grown.eof, true);

  const stableAgain = readBatch({ file: f.file, format: 'json', cursor: grown.cursor });
  assert.equal(stableAgain.records.length, 0);
});

test('JSON snapshot shrink resets and parses the complete replacement', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '{"snapshot":true,"count":2}');
  const initial = readBatch({ file: f.file, format: 'json' });
  fs.writeFileSync(f.file, '{"snapshot":false}');
  const shrunk = readBatch({ file: f.file, format: 'json', cursor: initial.cursor });
  assert.deepEqual(shrunk.gaps.map(gap => gap.reason), ['source_truncated']);
  assert.deepEqual(shrunk.records.map(record => record.value), [{ snapshot: false }]);
  assert.equal(shrunk.pendingBytes, 0);
  assert.equal(shrunk.eof, true);
});

test('same-size JSON snapshot rewrite resets once and does not replay while unchanged', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '{"snapshot":true}');
  const initial = readBatch({ file: f.file, format: 'json' });
  fs.writeFileSync(f.file, '{"snapshot":null}');
  const future = new Date(Date.now() + 2000);
  fs.utimesSync(f.file, future, future);
  const rewritten = readBatch({ file: f.file, format: 'json', cursor: initial.cursor });
  assert.deepEqual(rewritten.gaps.map(gap => gap.reason), ['source_rewritten']);
  assert.deepEqual(rewritten.records.map(record => record.value), [{ snapshot: null }]);
  const unchanged = readBatch({ file: f.file, format: 'json', cursor: rewritten.cursor });
  assert.equal(unchanged.records.length, 0);
  assert.equal(unchanged.pendingBytes, 0);
});

test('JSON snapshot growth during its main read discards ambiguity and resets for bounded replay', t => {
  const f = fixture(t), body = '{"snapshot":true}';
  fs.writeFileSync(f.file, body);
  const raced = readWithInjectedMutation(f.file, Buffer.byteLength(body),
    () => fs.appendFileSync(f.file, ' '),
    () => readBatch({ file: f.file, format: 'json' }));
  assert.equal(raced.records.length, 0);
  assert.deepEqual(raced.gaps.map(gap => gap.reason), ['source_changed_during_read']);
  assert.equal(raced.cursor.offset, 0);
  assert.equal(raced.pendingBytes, Buffer.byteLength(body + ' '));

  const replay = readBatch({ file: f.file, format: 'json', cursor: raced.cursor });
  assert.deepEqual(replay.records.map(record => record.value), [{ snapshot: true }]);
  assert.equal(replay.pendingBytes, 0);
  assert.equal(replay.eof, true);
});

test('same-size JSONL rewrite during read resets, while concurrent append stays incremental', t => {
  const rewrittenFile = fixture(t), firstLine = '{"a":1}\n', secondLine = '{"b":2}\n';
  fs.writeFileSync(rewrittenFile.file, firstLine);
  const rewritten = readWithInjectedMutation(rewrittenFile.file, Buffer.byteLength(firstLine), () => {
    const writer = fs.openSync(rewrittenFile.file, 'r+');
    try { fs.writeSync(writer, Buffer.from(secondLine), 0, Buffer.byteLength(secondLine), 0); }
    finally { fs.closeSync(writer); }
    const future = new Date(Date.now() + 2000);
    fs.utimesSync(rewrittenFile.file, future, future);
  }, () => readBatch({ file: rewrittenFile.file }));
  assert.equal(rewritten.records.length, 0);
  assert.deepEqual(rewritten.gaps.map(gap => gap.reason), ['source_changed_during_read']);
  assert.equal(rewritten.cursor.offset, 0);
  const rewriteReplay = readBatch({ file: rewrittenFile.file, cursor: rewritten.cursor });
  assert.deepEqual(rewriteReplay.records.map(record => record.value), [{ b: 2 }]);

  const appendedFile = fixture(t);
  fs.writeFileSync(appendedFile.file, firstLine);
  const appended = readWithInjectedMutation(appendedFile.file, Buffer.byteLength(firstLine),
    () => fs.appendFileSync(appendedFile.file, secondLine),
    () => readBatch({ file: appendedFile.file }));
  assert.deepEqual(appended.records.map(record => record.value), [{ a: 1 }]);
  assert.equal(appended.gaps.length, 0);
  assert.equal(appended.pendingBytes, Buffer.byteLength(secondLine));
  const appendResume = readBatch({ file: appendedFile.file, cursor: appended.cursor });
  assert.deepEqual(appendResume.records.map(record => record.value), [{ b: 2 }]);
});

test('oversized JSONL tails stay in discard mode until their terminating newline', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '{"huge":"' + 'x'.repeat(80));
  const first = readBatch({ file: f.file, maxLineBytes: 64 });
  assert.equal(first.cursor.discarding_oversize, true);
  assert.equal(first.eof, false);
  fs.appendFileSync(f.file, 'continued"}\n{"safe":true}\n');
  const second = readBatch({ file: f.file, cursor: first.cursor, maxLineBytes: 64 });
  assert.deepEqual(second.records.map(r => r.value), [{ safe: true }]);
  assert.equal(second.cursor.discarding_oversize, false);
});

test('reader records bounded malformed and oversized complete-line gaps', t => {
  const f = fixture(t), oversized = JSON.stringify({ value: 'x'.repeat(80) });
  fs.writeFileSync(f.file, '{bad}\n' + oversized + '\n{"ok":true}\n');
  const result = readBatch({ file: f.file, maxLineBytes: 64 });
  assert.deepEqual(result.records.map(r => r.value), [{ ok: true }]);
  assert.deepEqual(result.gaps.map(g => g.reason), ['malformed_json','line_too_large']);
  assert.equal(JSON.stringify(result.gaps).includes('xxxxx'), false);
  assert.ok(result.gaps.every(g => /^[a-f0-9]{64}$/.test(g.sha256)));
});

test('reader detects truncate, replacement and in-place prefix rewrite and replays safely', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '{"a":1}\n{"b":2}\n');
  const initial = readBatch({ file: f.file });

  fs.writeFileSync(f.file, '{"z":0}\n');
  const truncated = readBatch({ file: f.file, cursor: initial.cursor });
  assert.ok(truncated.gaps.some(g => g.reason === 'source_truncated' || g.reason === 'source_replaced'));
  assert.deepEqual(truncated.records.map(r => r.value), [{ z: 0 }]);

  const stable = readBatch({ file: f.file });
  const fd = fs.openSync(f.file, 'r+');
  try { fs.writeSync(fd, Buffer.from('{"y":9}'), 0, 7, 0); } finally { fs.closeSync(fd); }
  const rewritten = readBatch({ file: f.file, cursor: stable.cursor });
  assert.ok(rewritten.gaps.some(g => g.reason === 'source_rewritten'));
  assert.deepEqual(rewritten.records.map(r => r.value), [{ y: 9 }]);
});

test('reader uses size and mtime metadata to detect a same-size middle rewrite outside anchors', t => {
  const f = fixture(t), body = JSON.stringify({ value: 'a'.repeat(12000) }) + '\n';
  fs.writeFileSync(f.file, body);
  const initial = readBatch({ file: f.file });
  const fd = fs.openSync(f.file, 'r+');
  try { fs.writeSync(fd, Buffer.from('b'), 0, 1, 6000); } finally { fs.closeSync(fd); }
  const future = new Date(Date.now() + 2000); fs.utimesSync(f.file, future, future);
  const rewritten = readBatch({ file: f.file, cursor: initial.cursor });
  assert.ok(rewritten.gaps.some(g => g.reason === 'source_rewritten'));
  assert.equal(rewritten.records.length, 1);
});

test('reader rejects hardlinks, symlinks and special files before reading', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, '{"a":1}\n');
  const hard = path.join(f.dir, 'hard.jsonl'); fs.linkSync(f.file, hard);
  assert.throws(() => readBatch({ file: hard }), /unsafe_hardlink/);
  fs.unlinkSync(hard);
  const link = path.join(f.dir, 'link.jsonl');
  try {
    fs.symlinkSync(f.file, link, 'file');
    assert.throws(() => readBatch({ file: link }), /unsafe_symlink/);
  } catch (error) { if (!['EPERM','EACCES'].includes(error.code)) throw error; }
  const special = path.join(f.dir, 'directory'); fs.mkdirSync(special);
  assert.throws(() => readBatch({ file: special }), /unsafe_special_file/);
});

test('reader enforces hard finite budgets and does not grow cursor with source content', t => {
  const f = fixture(t);
  fs.writeFileSync(f.file, Array.from({ length: 2000 }, (_, i) => JSON.stringify({ i })).join('\n') + '\n');
  const result = readBatch({ file: f.file, maxBytes: Number.MAX_SAFE_INTEGER, maxRecords: Number.MAX_SAFE_INTEGER,
    maxLineBytes: Number.MAX_SAFE_INTEGER });
  assert.ok(result.bytesRead <= 256 * 1024);
  assert.ok(result.records.length <= 256);
  assert.ok(Buffer.byteLength(JSON.stringify(result.cursor)) < 2048);
});
