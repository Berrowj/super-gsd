'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { operationReport } = require('./operation-report.cjs');
const { SOURCES } = require('./sgsd-ledger.cjs');
const { canonicalize, digest } = require('./contract.cjs');
const { registerRun } = require('./global-store.cjs');
const { createLedgerRuntime, capturePaths, MAX_RECEIPT_BATCH_BYTES } = require('./sgsd-ledger-runtime.cjs');

const NOW = '2026-09-10T12:00:00.000Z';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');

function snapshot(directory) {
  const result = {};
  for (const relative of fs.readdirSync(directory, { recursive: true })) {
    const file = path.join(directory, relative);
    if (fs.statSync(file).isFile()) result[relative] = sha(fs.readFileSync(file));
  }
  return result;
}

function fixture(t, name = 'PRIVATE_PROJECT_PATH_CANARY') {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-operation-report-'));
  t.after(() => fs.rmSync(temporary, { recursive: true, force: true }));
  const projectDir = path.join(temporary, name);
  const root = path.join(temporary, 'global');
  fs.mkdirSync(path.join(projectDir, '.planning', 'metrics'), { recursive: true });
  const run = registerRun({ root, projectDir, provider: 'openai', role: 'executor' });
  const projectId = run.project_id;
  const registration = path.join(root, 'projects', projectId);
  const operational = path.join(registration, 'operational');
  fs.mkdirSync(operational, { recursive: true });
  return {
    temporary, projectDir, root, projectId, runId: run.run_id, operational,
    state: path.join(operational, 'sgsd-ledger-state.json'),
    receipts: path.join(operational, 'sgsd-ledger-receipts.jsonl'),
  };
}

function sourceState(f, relativePath, family, extra = {}) {
  const sourcePathSha = sha(relativePath);
  return [sha(JSON.stringify([family, relativePath])), {
    family,
    relative_path: relativePath,
    source_path_sha256: sourcePathSha,
    source_occurrence_id: sha(`${relativePath}:occurrence`),
    cursor: null,
    pending: null,
    pending_bytes: 0,
    lag_ms: 1000,
    last_observed_at: '2026-09-10T11:59:00.000Z',
    last_reason: null,
    counters: { accepted: 0, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 0, bytes_read: 0 },
    ...extra,
  }];
}

function writeState(f, sources, counters = {}) {
  fs.writeFileSync(f.state, JSON.stringify({
    schema_version: 1,
    project_id: f.projectId,
    capture_started_at: '2026-09-10T11:00:00.000Z',
    initial_cutoff_at: '2026-09-03T11:00:00.000Z',
    source_rotation: 2,
    updated_at: '2026-09-10T11:59:30.000Z',
    counters: { accepted: 0, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 0, bytes_read: 0, ...counters },
    sources: Object.fromEntries(sources),
  }) + '\n');
}

function receipt(f, fields = {}) {
  const family = fields.family || 'gate_value';
  const relativePath = fields.relativePath || '.planning/metrics/gate-value-log.jsonl';
  const sourcePathSha = sha(relativePath);
  const detail = fields.detail || {
    schema_version: 1,
    family,
    detail_coverage: 'typed_partial',
    identity_provenance: 'producer_observation',
    source_occurrence_id: sha(`${relativePath}:occurrence`),
    source_record_sha256: fields.sourceRecordSha || sha('record'),
    sequence: 1,
  };
  const offset = fields.offset ?? 0;
  const length = fields.length ?? 6;
  const recordSha = fields.sourceRecordSha || detail.source_record_sha256;
  const receiptId = fields.receiptId || digest(['sgsd-ledger-receipt-v1', f.projectId, family,
    detail.source_occurrence_id, offset, length, recordSha]);
  return {
    receipt_id: receiptId,
    family,
    source_path_sha256: sourcePathSha,
    source_occurrence_id: detail.source_occurrence_id,
    file_identity: fields.fileIdentity || sha(`${relativePath}:file`),
    offset,
    length,
    source_record_sha256: recordSha,
    observed_at: fields.observedAt === undefined ? '2026-09-10T11:59:00.000Z' : fields.observedAt,
    disposition: fields.disposition || 'accepted',
    reason: fields.reason || null,
    source_event_id: fields.sourceEventId === undefined ? sha(`source-event:${receiptId}`) : fields.sourceEventId,
    detail_sha256: digest(detail),
    run_correlation: fields.runCorrelation || 'exact',
    detail,
  };
}

function fileIdentity(file) {
  const stat = fs.statSync(file, { bigint: true });
  return sha(`${stat.dev}:${stat.ino}:${stat.birthtimeMs}`);
}

function writeReceipts(f, items, repeat = false) {
  const batch = { schema_version: 1, batch_id: digest(items.map(item => item.receipt_id)), project_id: f.projectId,
    committed_at: '2026-09-10T11:59:01.000Z', receipts: items };
  const line = JSON.stringify(batch) + '\n';
  fs.writeFileSync(f.receipts, repeat ? line + line : line);
}

function writeCanonical(f, items, occurredAt = null) {
  const rows = items.filter(item => ['accepted', 'duplicate'].includes(item.disposition)).map(item => canonicalize({
    schema_version: 1,
    source_event_id: item.source_event_id,
    occurred_at: occurredAt?.[item.source_event_id] || item.observed_at,
    event_sequence: item.detail?.sequence ?? 0,
    event_type: item.family === 'gate_value' ? 'gate' : item.family === 'muda' ? 'outcome' : 'artifact',
    source: { kind: 'sgsd_ledger', instance: f.projectId, provenance: item.detail.identity_provenance,
      confidence: item.detail.identity_provenance === 'producer_observation' ? 'exact' : 'unknown' },
    identity: { sgsd_run_id: item.run_correlation === 'exact' ? f.runId : null },
    scope: { launcher_repo_id: f.projectId, attribution_method: 'project_registration' },
    payload: { purpose: item.family, artifact_ref: item.detail_sha256,
      content_digest: item.source_record_sha256, raw_content_recorded: false },
  }, '2026-09-10T11:59:02.000Z'));
  fs.writeFileSync(path.join(f.operational, 'sgsd-atlas-events-unknown.jsonl'), rows.map(JSON.stringify).join('\n') + '\n');
}

function family(report, name) {
  return report.projects[0].families.find(row => row.family === name);
}

test('report is content-free, occurrence-counted and explicit about idle, provenance, correlation and MUDA coverage', t => {
  const f = fixture(t);
  const gatePath = '.planning/metrics/gate-value-log.jsonl';
  const mudaPath = '.planning/metrics/muda-log.jsonl';
  const genericPath = '.planning/metrics/private-canary.jsonl';
  const workerPath = '.planning/metrics/worker-events.jsonl';
  writeState(f, [
    sourceState(f, gatePath, 'gate_value', { counters: { accepted: 1, duplicate: 1, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 1, bytes_read: 60 } }),
    sourceState(f, mudaPath, 'muda', { counters: { accepted: 3, duplicate: 0, conflict: 0, rejected: 0, excluded: 1, gaps: 0, records: 4, bytes_read: 120 } }),
    sourceState(f, genericPath, 'generic_metric', { pending_bytes: 11, lag_ms: null, last_observed_at: null,
      last_reason: 'malformed_json', counters: { accepted: 0, duplicate: 0, conflict: 0, rejected: 1, excluded: 0, gaps: 1, records: 1, bytes_read: 40 } }),
    sourceState(f, workerPath, 'worker', { pending_bytes: 5, lag_ms: 2000, last_reason: 'processing_budget',
      counters: { accepted: 0, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 1, records: 0, bytes_read: 0 } }),
  ], { accepted: 4, duplicate: 1, rejected: 1, excluded: 1, gaps: 1, records: 6, bytes_read: 220 });

  const gate = receipt(f, { relativePath: gatePath });
  const mudaDetail = { ...receipt(f, { family: 'muda', relativePath: mudaPath }).detail,
    family: 'muda', identity_provenance: 'source_occurrence_fallback', coverage: 'measured', no_input: false,
    synthetic: false, qualitative: { closed_reason: 'completed', attempted: true, critical_count: 0, warning_count: 1 } };
  const muda = receipt(f, { family: 'muda', relativePath: mudaPath, detail: mudaDetail,
    runCorrelation: 'missing' });
  const noInputDetail = { ...mudaDetail, identity_provenance: 'producer_observation',
    source_record_sha256: sha('no-input'), sequence: 2,
    coverage: 'no_input', no_input: true, synthetic: false,
    qualitative: { closed_reason: 'insufficient_diff', attempted: false, critical_count: null, warning_count: null } };
  const noInput = receipt(f, { family: 'muda', relativePath: mudaPath, detail: noInputDetail,
    offset: 10, sourceRecordSha: sha('no-input') });
  const syntheticDetail = { ...mudaDetail, identity_provenance: 'producer_observation',
    source_record_sha256: sha('synthetic'), sequence: 3,
    coverage: 'synthetic', no_input: true, synthetic: true,
    qualitative: { closed_reason: 'disabled', attempted: false, critical_count: null, warning_count: null } };
  const synthetic = receipt(f, { family: 'muda', relativePath: mudaPath, detail: syntheticDetail,
    offset: 20, sourceRecordSha: sha('synthetic') });
  const excluded = receipt(f, { family: 'muda', relativePath: mudaPath, disposition: 'excluded',
    reason: 'excluded_before_capture_window', observedAt: '2026-08-01T00:00:00.000Z', offset: 30 });
  const rejectedBase = receipt(f, { family: 'generic_metric', relativePath: genericPath }).detail;
  const rejected = receipt(f, { family: 'generic_metric', relativePath: genericPath, disposition: 'rejected',
    reason: 'malformed_json', runCorrelation: 'unmatched', sourceEventId: null,
    detail: { ...rejectedBase, capture_reasons: ['unknown_time_observed_at'] } });
  writeReceipts(f, [gate, muda, noInput, synthetic, excluded, rejected], true);
  writeCanonical(f, [gate, muda, noInput, synthetic], { [gate.source_event_id]: '2026-09-10T10:00:00.000Z' });

  const before = snapshot(f.root);
  const report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'WARN', JSON.stringify(report.findings));
  assert.equal(report.complete_coverage, false);
  assert.equal(report.aggregate_semantics, 'source_observations_not_unique_actions');
  assert.equal(report.projects[0].observations, 6);
  assert.equal(report.projects[0].receipt_replays, 6);
  assert.equal(report.projects[0].families.length, Object.keys(SOURCES).length);
  assert.equal(family(report, 'review').state, 'idle');
  assert.equal(family(report, 'gate_value').provenance.producer_observation, 1);
  assert.equal(family(report, 'gate_value').time.latest_observed_at, '2026-09-10T10:00:00.000Z');
  assert.equal(family(report, 'gate_value').time.lag_ms, 2 * 60 * 60 * 1000);
  assert.equal(family(report, 'muda').provenance.source_occurrence_fallback, 1);
  assert.equal(family(report, 'muda').run_correlation.missing, 1);
  assert.equal(family(report, 'muda').excluded, 1);
  assert.equal(family(report, 'muda').muda.coverage.measured, 1);
  assert.equal(family(report, 'muda').muda.coverage.no_input, 1);
  assert.equal(family(report, 'muda').muda.coverage.synthetic, 1);
  assert.equal(family(report, 'muda').muda.qualitative.completed, 1);
  assert.equal(family(report, 'muda').time.unknown, 1);
  assert.equal(family(report, 'generic_metric').time.unknown, 1);
  assert.equal(family(report, 'generic_metric').pending_bytes, 11);
  assert.equal(family(report, 'worker').state, 'degraded');
  assert.equal(family(report, 'worker').gaps, 1);
  assert.equal(family(report, 'worker').pending_bytes, 5);
  assert.equal(family(report, 'worker').source_reasons.processing_budget, 1);
  assert.deepEqual(snapshot(f.root), before);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_PROJECT_PATH_CANARY|private-canary|prompt|input_tokens|output_tokens|token_cost/i);
});

test('exact project filter never infers production and source verification reports match, mismatch, race and limit', t => {
  const f = fixture(t, 'QA_COPY_PATH_CANARY');
  const otherDir = path.join(f.temporary, 'SECOND_PROJECT_PATH_CANARY');
  const otherId = digest(otherDir);
  fs.mkdirSync(path.join(f.root, 'projects', otherId, 'operational'), { recursive: true });
  fs.mkdirSync(otherDir, { recursive: true });
  fs.writeFileSync(path.join(f.root, 'projects', otherId, 'project.json'), JSON.stringify({
    schema_version: 1, project_id: otherId, project_dir: otherDir,
  }) + '\n');
  const relativePath = '.planning/metrics/gate-value-log.jsonl';
  const file = path.join(f.projectDir, relativePath);
  const body = '{"ok":1}';
  fs.writeFileSync(file, body + '\n');
  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 1, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 1, bytes_read: 6,
  } })], { accepted: 1, records: 1, bytes_read: 6 });
  const accepted = receipt(f, { relativePath, length: Buffer.byteLength(body), sourceRecordSha: sha(body),
    fileIdentity: fileIdentity(file) });
  writeReceipts(f, [accepted]);
  writeCanonical(f, [accepted]);

  let report = operationReport({ root: f.root, projectId: f.projectId, verifySources: true, now: Date.parse(NOW) });
  assert.equal(report.projects.length, 1);
  assert.equal(report.projects[0].project_id, f.projectId);
  assert.equal(JSON.stringify(report).includes(otherId), false);
  assert.deepEqual(report.projects[0].verification, {
    requested: true, status: 'verified', checked: 1, matched: 1, mismatched: 0,
    missing: 0, raced: 0, limited: 0, unverifiable: 0,
  }, JSON.stringify(report.projects[0].verification));

  const currentState = fs.readFileSync(f.state, 'utf8');
  const superseded = JSON.parse(currentState);
  Object.values(superseded.sources)[0].source_occurrence_id = sha('replacement-occurrence');
  fs.writeFileSync(f.state, JSON.stringify(superseded) + '\n');
  report = operationReport({ root: f.root, projectId: f.projectId, verifySources: true, now: Date.parse(NOW) });
  assert.equal(report.projects[0].verification.status, 'incomplete');
  assert.equal(report.projects[0].verification.unverifiable, 1);
  fs.writeFileSync(f.state, currentState);

  const linked = path.join(path.dirname(file), 'hardlink-fixture.jsonl');
  fs.linkSync(file, linked);
  report = operationReport({ root: f.root, projectId: f.projectId, verifySources: true, now: Date.parse(NOW) });
  assert.equal(report.projects[0].verification.status, 'incomplete');
  assert.equal(report.projects[0].verification.unverifiable, 1);
  fs.unlinkSync(linked);

  fs.writeFileSync(file, '{"ok":2}\n');
  report = operationReport({ root: f.root, projectId: f.projectId, verifySources: true, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.equal(report.projects[0].verification.status, 'mismatch');
  assert.equal(report.projects[0].verification.mismatched, 1);

  fs.writeFileSync(file, body + '\n');
  report = operationReport({ root: f.root, projectId: f.projectId, verifySources: true,
    limits: { maxVerificationBytes: 4 }, now: Date.parse(NOW) });
  assert.equal(report.projects[0].verification.status, 'incomplete');
  assert.equal(report.projects[0].verification.limited, 1);

  const original = fs.readSync;
  let changed = false;
  fs.readSync = function (...args) {
    const count = original.apply(this, args);
    if (!changed && args[4] === 0 && count === Buffer.byteLength(body)) {
      changed = true;
      fs.appendFileSync(file, ' ');
    }
    return count;
  };
  try {
    report = operationReport({ root: f.root, projectId: f.projectId, verifySources: true, now: Date.parse(NOW) });
  } finally { fs.readSync = original; }
  assert.equal(report.projects[0].verification.status, 'incomplete');
  assert.equal(report.projects[0].verification.raced, 1);

  fs.unlinkSync(file);
  report = operationReport({ root: f.root, projectId: f.projectId, verifySources: true, now: Date.parse(NOW) });
  assert.equal(report.projects[0].verification.status, 'incomplete');
  assert.equal(report.projects[0].verification.missing, 1);
  assert.doesNotMatch(JSON.stringify(report), /QA_COPY_PATH_CANARY|gate-value-log\.jsonl/);
});

test('accepted receipts require matching canonical evidence and replayed receipt content is immutable', t => {
  const f = fixture(t);
  const relativePath = '.planning/metrics/gate-value-log.jsonl';
  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 1, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 1, bytes_read: 6,
  } })], { accepted: 1, records: 1, bytes_read: 6 });
  const accepted = receipt(f, { relativePath });
  writeReceipts(f, [accepted]);
  writeCanonical(f, [accepted]);
  const canonicalFile = path.join(f.operational, 'sgsd-atlas-events-unknown.jsonl');
  const canonicalLine = fs.readFileSync(canonicalFile, 'utf8');
  let report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.projects[0].canonical.matched_receipts, 1);
  assert.ok(!report.findings.some(row => row.reason === 'canonical_event_missing'));
  assert.ok(report.findings.some(row => row.reason === 'canonical_receipt_proof_incomplete'));

  const originalRead = fs.readSync;
  let appended = false;
  fs.readSync = function (...args) {
    const count = originalRead.apply(this, args);
    const chunk = count > 0 ? args[1].subarray(args[2], args[2] + count).toString('utf8') : '';
    if (!appended && chunk.includes('sgsd_ledger')) {
      appended = true;
      fs.appendFileSync(canonicalFile, ' ');
    }
    return count;
  };
  try { report = operationReport({ root: f.root, now: Date.parse(NOW) }); }
  finally { fs.readSync = originalRead; }
  assert.equal(report.status, 'WARN', JSON.stringify(report.findings));
  assert.equal(report.projects[0].canonical.raced, true);
  assert.ok(report.findings.some(row => row.reason === 'canonical_ledger_raced'));
  assert.ok(!report.findings.some(row => row.reason === 'operational_canonical_invalid'));
  fs.writeFileSync(canonicalFile, canonicalLine);

  const originalEvent = JSON.parse(canonicalLine);
  const { event_id: ignoredId, payload_sha256: ignoredPayload, ingested_at: ingestedAt, ...eventBody } = originalEvent;
  eventBody.source.provenance = 'source_occurrence_fallback';
  eventBody.source.confidence = 'unknown';
  fs.writeFileSync(canonicalFile, JSON.stringify(canonicalize(eventBody, ingestedAt)) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'canonical_receipt_mismatch'));

  eventBody.source.provenance = accepted.detail.identity_provenance;
  eventBody.source.confidence = 'exact';
  eventBody.identity.sgsd_run_id = 'sgsd-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  fs.writeFileSync(canonicalFile, JSON.stringify(canonicalize(eventBody, ingestedAt)) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'canonical_receipt_mismatch'));
  fs.writeFileSync(canonicalFile, canonicalLine);

  fs.appendFileSync(canonicalFile, canonicalLine);
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'duplicate_canonical_events'));
  report = operationReport({ root: f.root, now: Date.parse(NOW), limits: { maxCanonicalRows: 1 } });
  assert.equal(report.projects[0].canonical.limited, true);
  assert.ok(report.findings.some(row => row.reason === 'canonical_scan_limit'));

  const firstEvent = JSON.parse(canonicalLine);
  const conflictingPayload = sha('different-payload');
  const conflict = { schema_version: 1,
    event_id: digest(['integrity_conflict', firstEvent.event_id, conflictingPayload]),
    event_type: 'integrity_conflict', source_event_id: firstEvent.source_event_id,
    occurred_at: firstEvent.occurred_at, ingested_at: firstEvent.ingested_at, source: firstEvent.source,
    identity: firstEvent.identity, conflicting_event_id: firstEvent.event_id,
    first_payload_sha256: sha('wrong-first-payload'), conflicting_payload_sha256: conflictingPayload };
  conflict.payload_sha256 = digest(conflict);
  fs.writeFileSync(canonicalFile, canonicalLine + JSON.stringify(conflict) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'operational_canonical_invalid'));

  fs.unlinkSync(canonicalFile);
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'canonical_event_missing'));

  writeCanonical(f, [accepted]);
  const changed = { ...accepted, disposition: 'duplicate' };
  const first = { schema_version: 1, batch_id: digest([accepted.receipt_id]), project_id: f.projectId,
    committed_at: NOW, receipts: [accepted] };
  const second = { schema_version: 1, batch_id: digest([changed.receipt_id]), project_id: f.projectId,
    committed_at: NOW, receipts: [changed] };
  fs.writeFileSync(f.receipts, `${JSON.stringify(first)}\n${JSON.stringify(second)}\n`);
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.projects[0].observations, 1);
  assert.equal(report.projects[0].receipt_replays, 1);
  assert.ok(!report.findings.some(row => row.reason === 'receipt_replay_conflict'));

  const impossibleTransition = { ...accepted, disposition: 'conflict' };
  fs.appendFileSync(f.receipts, JSON.stringify({ ...second, receipts: [impossibleTransition] }) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'receipt_replay_conflict'));
  fs.writeFileSync(f.receipts, `${JSON.stringify(first)}\n${JSON.stringify(second)}\n`);

  const incompatible = { ...changed, run_correlation: 'missing', reason: 'missing_recorded_run' };
  fs.appendFileSync(f.receipts, JSON.stringify({ ...second, receipts: [incompatible] }) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'receipt_replay_conflict'));

  const invalidIdentity = { ...accepted, receipt_id: sha('not-derived-from-provenance') };
  fs.writeFileSync(f.receipts, JSON.stringify({ ...first,
    batch_id: digest([invalidIdentity.receipt_id]), receipts: [invalidIdentity] }) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'receipt_ledger_corrupt'));

  const corrupted = { ...accepted, detail: { ...accepted.detail, identity_provenance: 'PRIVATE_CANARY' } };
  fs.writeFileSync(f.receipts, JSON.stringify({ ...first, batch_id: digest([corrupted.receipt_id]), receipts: [corrupted] }) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'receipt_ledger_corrupt'));
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_CANARY/);
});

test('bounded or racing canonical scans leave missing and mismatched joins incomplete', t => {
  const f = fixture(t), relativePath = '.planning/metrics/gate-value-log.jsonl';
  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 2, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 2, bytes_read: 12,
  } })], { accepted: 2, records: 2, bytes_read: 12 });
  const first = receipt(f, { relativePath });
  const second = receipt(f, { relativePath, offset: 6, sourceEventId: sha('second-source-event') });
  writeReceipts(f, [first, second]); writeCanonical(f, [first, second]);

  let report = operationReport({ root: f.root, now: Date.parse(NOW), limits: { maxCanonicalRows: 1 } });
  assert.equal(report.status, 'WARN', JSON.stringify(report.findings));
  assert.equal(report.projects[0].canonical.limited, true);
  assert.equal(report.projects[0].canonical.reconciliation, 'incomplete');
  assert.equal(report.projects[0].canonical.missing_receipts, null);
  assert.equal(report.projects[0].canonical.mismatched_receipts, null);
  assert.equal(report.projects[0].canonical.orphan_events, null);
  assert.equal(report.projects[0].canonical.unverified_observed_receipts, 1);
  assert.ok(!report.findings.some(row => row.reason === 'canonical_event_missing'));

  const canonicalFile = path.join(f.operational, 'sgsd-atlas-events-unknown.jsonl');
  const rows = fs.readFileSync(canonicalFile, 'utf8').trim().split(/\r?\n/).map(JSON.parse);
  rows[0].source.provenance = 'source_occurrence_fallback';
  const { event_id, payload_sha256, ingested_at, ...changed } = rows[0];
  rows[0] = canonicalize(changed, ingested_at);
  fs.writeFileSync(canonicalFile, rows.map(JSON.stringify).join('\n') + '\n');
  const originalRead = fs.readSync; let changedDuringRead = false;
  fs.readSync = function (...args) {
    const count = originalRead.apply(this, args);
    const chunk = count > 0 ? args[1].subarray(args[2], args[2] + count).toString('utf8') : '';
    if (!changedDuringRead && chunk.includes('sgsd_ledger')) {
      changedDuringRead = true; fs.appendFileSync(canonicalFile, ' ');
    }
    return count;
  };
  try { report = operationReport({ root: f.root, now: Date.parse(NOW) }); }
  finally { fs.readSync = originalRead; }
  assert.equal(report.status, 'WARN', JSON.stringify(report.findings));
  assert.equal(report.projects[0].canonical.raced, true);
  assert.equal(report.projects[0].canonical.reconciliation, 'incomplete');
  assert.equal(report.projects[0].canonical.missing_receipts, null);
  assert.equal(report.projects[0].canonical.mismatched_receipts, null);
  assert.equal(report.projects[0].canonical.orphan_events, null);
  assert.equal(report.projects[0].canonical.unverified_observed_receipts, 1);
  assert.ok(!report.findings.some(row => row.reason === 'canonical_receipt_mismatch'));
});

test('conflict proofs join conflict rows and orphan counts use distinct physical canonical IDs', t => {
  const f = fixture(t), relativePath = '.planning/metrics/gate-value-log.jsonl';
  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 0, duplicate: 1, conflict: 1, rejected: 0, excluded: 0, gaps: 0, records: 2, bytes_read: 12,
  } })], { duplicate: 1, conflict: 1, records: 2, bytes_read: 12 });
  const candidateReceipt = receipt(f, { relativePath, sourceRecordSha: sha('candidate-record') });
  const candidateEvent = {
    schema_version: 1, source_event_id: candidateReceipt.source_event_id,
    occurred_at: candidateReceipt.observed_at, event_sequence: candidateReceipt.detail.sequence,
    event_type: 'gate',
    source: { kind: 'sgsd_ledger', instance: f.projectId, provenance: candidateReceipt.detail.identity_provenance,
      confidence: 'exact' },
    identity: { sgsd_run_id: f.runId },
    scope: { launcher_repo_id: f.projectId, attribution_method: 'project_registration' },
    payload: { purpose: 'gate_value', artifact_ref: candidateReceipt.detail_sha256,
      content_digest: candidateReceipt.source_record_sha256, raw_content_recorded: false },
  };
  const candidate = canonicalize(candidateEvent, '2026-09-10T11:59:02.000Z');
  const firstEvent = canonicalize({ ...candidateEvent,
    payload: { ...candidateEvent.payload, content_digest: sha('first-record') },
  }, '2026-09-10T11:58:02.000Z');
  const conflictRow = {
    schema_version: 1,
    event_id: digest(['integrity_conflict', candidate.event_id, candidate.payload_sha256]),
    event_type: 'integrity_conflict', source_event_id: candidate.source_event_id,
    occurred_at: candidate.occurred_at, ingested_at: '2026-09-10T11:59:03.000Z',
    source: candidate.source, identity: candidate.identity,
    conflicting_event_id: candidate.event_id, first_payload_sha256: firstEvent.payload_sha256,
    conflicting_payload_sha256: candidate.payload_sha256,
  };
  conflictRow.payload_sha256 = digest(conflictRow);
  fs.writeFileSync(path.join(f.operational, 'sgsd-atlas-events-unknown.jsonl'),
    `${JSON.stringify(firstEvent)}\n${JSON.stringify(conflictRow)}\n`);
  const proof = { canonical_event_id: candidate.event_id, canonical_payload_sha256: candidate.payload_sha256 };
  const conflictReceipt = { ...candidateReceipt, ...proof, disposition: 'conflict', source_event_id: null,
    detail_sha256: null, detail: null };
  const duplicateReceipt = { ...candidateReceipt, ...proof, disposition: 'duplicate', offset: 6,
    receipt_id: digest(['sgsd-ledger-receipt-v1', f.projectId, candidateReceipt.family,
      candidateReceipt.source_occurrence_id, 6, candidateReceipt.length, candidateReceipt.source_record_sha256]) };
  writeReceipts(f, [conflictReceipt, duplicateReceipt]);

  const report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'WARN', JSON.stringify(report.findings));
  assert.equal(report.projects[0].canonical.reconciliation, 'checked');
  assert.equal(report.projects[0].canonical.matched_receipts, 2);
  assert.equal(report.projects[0].canonical.orphan_events, 1);
  assert.equal(report.projects[0].canonical.proof_incomplete_receipts, 0);
  assert.ok(report.findings.some(row => row.reason === 'canonical_event_without_receipt'));
  assert.ok(!report.findings.some(row => row.reason === 'receipt_ledger_corrupt'));
  assert.ok(!report.findings.some(row => row.reason === 'canonical_event_missing'));
  assert.ok(!report.findings.some(row => row.reason === 'canonical_receipt_mismatch'));

  const canonicalFile = path.join(f.operational,'sgsd-atlas-events-unknown.jsonl');
  const conflictFile = path.join(f.operational,'sgsd-atlas-events-a-conflict.jsonl');
  const parentFile = path.join(f.operational,'sgsd-atlas-events-z-parent.jsonl');
  fs.unlinkSync(canonicalFile);
  fs.writeFileSync(conflictFile,`${JSON.stringify(conflictRow)}\n`);
  fs.writeFileSync(parentFile,`${JSON.stringify(firstEvent)}\n`);
  const originalOpenDir = fs.opendirSync;
  fs.opendirSync = function (directory) {
    if (path.resolve(directory) !== path.resolve(f.operational)) return originalOpenDir.apply(this,arguments);
    const entries = fs.readdirSync(directory,{ withFileTypes: true })
      .sort((left,right) => left.name.localeCompare(right.name));
    return { readSync: () => entries.shift() || null, closeSync() {} };
  };
  let bounded;
  try { bounded = operationReport({ root: f.root, now: Date.parse(NOW), limits: { maxCanonicalFiles: 1 } }); }
  finally { fs.opendirSync = originalOpenDir; }
  assert.equal(bounded.status,'WARN',JSON.stringify(bounded.findings));
  assert.equal(bounded.projects[0].canonical.limited,true);
  assert.equal(bounded.projects[0].canonical.reconciliation,'incomplete');
  assert.equal(bounded.projects[0].canonical.orphan_events,null);
  assert.ok(!bounded.findings.some(row => row.reason === 'operational_canonical_invalid'));
  fs.unlinkSync(conflictFile); fs.unlinkSync(parentFile);
  const wrongPartial = { ...conflictRow, first_payload_sha256: sha('partial-parent-mismatch') };
  wrongPartial.payload_sha256 = digest(Object.fromEntries(Object.entries(wrongPartial)
    .filter(([key]) => key !== 'payload_sha256')));
  fs.writeFileSync(canonicalFile,`${JSON.stringify(firstEvent)}\n${JSON.stringify(wrongPartial)}\n{}\n`);
  const relationallyIncomplete = operationReport({ root: f.root, now: Date.parse(NOW),
    limits: { maxCanonicalRows: 2 } });
  assert.equal(relationallyIncomplete.status,'WARN',JSON.stringify(relationallyIncomplete.findings));
  assert.equal(relationallyIncomplete.projects[0].canonical.reconciliation,'incomplete');
  assert.ok(!relationallyIncomplete.findings.some(row => row.reason === 'operational_canonical_invalid'));
  fs.writeFileSync(canonicalFile,`${JSON.stringify(conflictRow)}\n`);
  const stableMissingParent = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(stableMissingParent.status,'FAIL');
  assert.ok(stableMissingParent.findings.some(row => row.reason === 'operational_canonical_invalid'));
  fs.writeFileSync(canonicalFile,`${JSON.stringify(firstEvent)}\n${JSON.stringify(conflictRow)}\n`);

  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 0, duplicate: 0, conflict: 1, rejected: 0, excluded: 0, gaps: 0, records: 1, bytes_read: 6,
  } })], { conflict: 1, records: 1, bytes_read: 6 });
  const richConflict = { ...candidateReceipt, ...proof, disposition: 'conflict' };
  const replayedConflict = { ...richConflict, disposition: 'duplicate' };
  const firstBatch = { schema_version: 1, batch_id: digest([richConflict.receipt_id]), project_id: f.projectId,
    committed_at: NOW, receipts: [richConflict] };
  const replayBatch = { ...firstBatch, receipts: [replayedConflict] };
  fs.writeFileSync(f.receipts, `${JSON.stringify(firstBatch)}\n${JSON.stringify(replayBatch)}\n`);
  const replayed = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(replayed.projects[0].receipt_replays, 1);
  assert.ok(!replayed.findings.some(row => row.reason === 'receipt_replay_conflict'));

  const contradictory = { ...conflictReceipt, canonical_payload_sha256: sha('contradictory-proof') };
  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 0, duplicate: 1, conflict: 1, rejected: 0, excluded: 0, gaps: 0, records: 2, bytes_read: 12,
  } })], { duplicate: 1, conflict: 1, records: 2, bytes_read: 12 });
  writeReceipts(f, [contradictory, duplicateReceipt]);
  const tampered = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(tampered.status, 'FAIL');
  assert.ok(tampered.findings.some(row => row.reason === 'canonical_receipt_mismatch'));
});

test('absent or malformed capture evidence is visible and cannot become PASS', t => {
  const f = fixture(t);
  let report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'WARN');
  assert.ok(report.findings.some(row => row.reason === 'capture_state_missing'));
  assert.ok(report.projects[0].families.every(row => row.state === 'idle'));

  fs.writeFileSync(f.state, '{"schema_version":99}\n');
  fs.writeFileSync(f.receipts, '{bad}\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'capture_state_invalid'));
  assert.ok(report.findings.some(row => row.reason === 'receipt_ledger_corrupt'));

  const registration = path.join(f.root, 'projects', f.projectId, 'project.json');
  fs.writeFileSync(registration, JSON.stringify({ project_id: f.projectId, project_dir: f.projectDir }) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.ok(report.findings.some(row => row.reason === 'invalid_project_registration'));
  fs.writeFileSync(registration, JSON.stringify({ schema_version: 1, project_id: f.projectId,
    project_dir: f.projectDir, PRIVATE_REGISTRATION_CANARY: true }) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.ok(report.findings.some(row => row.reason === 'invalid_project_registration'));
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_REGISTRATION_CANARY/);
  assert.throws(() => operationReport({ root: f.root, projectId: 'not-a-project' }), /invalid_project_id/);
});

test('receipt line byte bound applies even when the newline arrives in the same read', t => {
  const f = fixture(t), relativePath = '.planning/metrics/gate-value-log.jsonl';
  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 1, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 1, bytes_read: 6,
  } })], { accepted: 1, records: 1, bytes_read: 6 });
  const accepted = receipt(f, { relativePath });
  writeReceipts(f, [accepted]); writeCanonical(f, [accepted]);
  const report = operationReport({ root: f.root, now: Date.parse(NOW), limits: { maxReceiptLineBytes: 100 } });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'receipt_ledger_corrupt'));
});

test('receipt row limit leaves unread buffered lines incomplete rather than corrupt', t => {
  const f = fixture(t), relativePath = '.planning/metrics/gate-value-log.jsonl';
  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 1, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 1, bytes_read: 6,
  } })], { accepted: 1, records: 1, bytes_read: 6 });
  const accepted = receipt(f,{ relativePath });
  writeReceipts(f,[accepted]); writeCanonical(f,[accepted]);
  const line = fs.readFileSync(f.receipts,'utf8'); fs.writeFileSync(f.receipts,line.repeat(3));
  const report = operationReport({ root: f.root, now: Date.parse(NOW), limits: { maxReceiptRows: 1 } });
  assert.equal(report.status,'WARN',JSON.stringify(report.findings));
  assert.ok(report.findings.some(row => row.reason === 'receipt_scan_limit'));
  assert.ok(!report.findings.some(row => row.reason === 'receipt_ledger_corrupt'));
  const boundedLine = operationReport({ root: f.root, now: Date.parse(NOW), limits: {
    maxReceiptRows: 1, maxReceiptLineBytes: Buffer.byteLength(line.trim()),
  } });
  assert.equal(boundedLine.status,'WARN',JSON.stringify(boundedLine.findings));
  assert.ok(boundedLine.findings.some(row => row.reason === 'receipt_scan_limit'));
  assert.ok(!boundedLine.findings.some(row => row.reason === 'receipt_ledger_corrupt'));
});

test('bounded enumeration and durable state counts prevent coordinated receipt and event truncation', t => {
  const f = fixture(t), relativePath = '.planning/metrics/gate-value-log.jsonl';
  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 1, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 1, bytes_read: 6,
  } })], { accepted: 1, records: 1, bytes_read: 6 });
  const accepted = receipt(f, { relativePath }); writeReceipts(f, [accepted]); writeCanonical(f, [accepted]);
  const original = fs.readdirSync;
  fs.readdirSync = function (directory, ...args) {
    if ([path.join(f.root, 'projects'), f.operational].includes(path.resolve(directory)))
      throw new Error('unbounded_enumeration_canary');
    return original.call(this, directory, ...args);
  };
  let report;
  try { report = operationReport({ root: f.root, now: Date.parse(NOW) }); }
  finally { fs.readdirSync = original; }
  assert.equal(report.projects[0].observations, 1);

  const pendingState = JSON.parse(fs.readFileSync(f.state, 'utf8'));
  pendingState.counters.accepted = 0; pendingState.counters.records = 0; pendingState.counters.bytes_read = 0;
  const pendingSource = Object.values(pendingState.sources)[0];
  pendingSource.counters.accepted = 0; pendingSource.counters.records = 0; pendingSource.counters.bytes_read = 0;
  pendingSource.pending_bytes = 6;
  pendingSource.pending = { schema_version: 1, start_offset: 0, observed_at: NOW,
    source_occurrence_id: accepted.source_occurrence_id, attempt_records: 1,
    file_identity: accepted.file_identity, source_size: 6, mtime_ns: '0', correlations: [] };
  fs.writeFileSync(f.state, JSON.stringify(pendingState) + '\n');
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.ok(!report.findings.some(row => row.reason === 'capture_receipt_count_mismatch'));
  assert.ok(report.findings.some(row => row.reason === 'capture_receipt_commit_pending'));

  writeState(f, [sourceState(f, relativePath, 'gate_value', { counters: {
    accepted: 1, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0, records: 1, bytes_read: 6,
  } })], { accepted: 1, records: 1, bytes_read: 6 });
  fs.writeFileSync(f.receipts, '');
  fs.unlinkSync(path.join(f.operational, 'sgsd-atlas-events-unknown.jsonl'));
  report = operationReport({ root: f.root, now: Date.parse(NOW) });
  assert.equal(report.status, 'FAIL');
  assert.ok(report.findings.some(row => row.reason === 'capture_receipt_count_mismatch'));
});

test('state generation changing before a stable receipt scan is an incomplete live snapshot, not corruption', t => {
  const f = fixture(t, 'LIVE_STATE_RACE_FIXTURE');
  const source = path.join(f.projectDir, '.planning', 'metrics', 'gate-value-log.jsonl');
  fs.writeFileSync(source, JSON.stringify({ envelope_version: 1, ts: NOW, gate: 'phase-level-ATC', outcome: 'pass',
    atlas_observation: { schema_version: 1, observation_id: '01a08882-20f6-7b23-96d0-c995aaa419f9',
      sgsd_run_id: f.runId, gate_invocation_id: null } }) + '\n');
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW, clock: () => 0 });
  const receiptPath = capturePaths(f.root, f.projectId).receipts;
  const original = fs.existsSync; let triggered = false;
  fs.existsSync = function (target) {
    if (!triggered && path.resolve(target) === receiptPath) { triggered = true; runtime.cycle(); }
    return original.apply(this, arguments);
  };
  let report;
  try { report = operationReport({ root: f.root, now: Date.parse(NOW) }); }
  finally { fs.existsSync = original; runtime.close(); }
  assert.equal(triggered, true);
  assert.equal(report.projects[0].receipt_reconciliation.status, 'incomplete');
  assert.equal(report.projects[0].canonical.reconciliation, 'incomplete');
  assert.equal(report.projects[0].canonical.orphan_events, null);
  assert.ok(report.findings.some(row => row.reason === 'capture_state_raced'));
  assert.ok(!report.findings.some(row => row.reason === 'capture_receipt_count_mismatch'));
});

test('real collector output reconciles receipt, canonical event and source without native accounting writes', t => {
  const f = fixture(t, 'RUNTIME_REPORT_FIXTURE');
  const run = registerRun({ root: f.root, projectDir: f.projectDir, provider: 'openai', role: 'executor' });
  const source = path.join(f.projectDir, '.planning', 'metrics', 'gate-value-log.jsonl');
  const sourceRows = Array.from({ length: 140 }, (_, index) => JSON.stringify({
    envelope_version: 1, ts: NOW, gate: 'phase-level-ATC', outcome: 'pass',
    atlas_observation: { schema_version: 1,
      observation_id: `${String(index).padStart(8, '0')}-20f6-7b23-96d0-c995aaa419f9`,
      sgsd_run_id: run.run_id, gate_invocation_id: null },
  }));
  sourceRows.push(JSON.stringify({ PRIVATE_OVERSIZE_CANARY: 'x'.repeat(70 * 1024) }));
  fs.writeFileSync(source, sourceRows.join('\n') + '\n');
  const workerDirectory = path.join(f.projectDir, '.planning', 'worker-sessions', 'oversize');
  fs.mkdirSync(workerDirectory, { recursive: true });
  fs.writeFileSync(path.join(workerDirectory, 'state.json'), JSON.stringify({
    PRIVATE_OVERSIZE_CANARY: 'x'.repeat(70 * 1024),
  }));
  const runtime = createLedgerRuntime({ root: f.root, now: () => NOW });
  for (let cycle = 0; cycle < 30; cycle++) runtime.cycle();
  runtime.close();

  const report = operationReport({ root: f.root, projectId: run.project_id, verifySources: true,
    now: Date.parse(NOW) });
  assert.equal(report.projects[0].observations, 142);
  assert.equal(report.projects[0].canonical.matched_receipts, 140);
  assert.equal(report.projects[0].canonical.proof_incomplete_receipts, 0);
  assert.equal(report.projects[0].verification.matched, 141);
  assert.equal(report.projects[0].verification.unverifiable, 1);
  assert.equal(family(report, 'gate_value').rejected, 1);
  assert.equal(family(report, 'gate_value').reasons.line_too_large, 1);
  assert.equal(family(report, 'worker_state').rejected, 1);
  assert.equal(family(report, 'worker_state').reasons.record_too_large, 1);
  assert.equal(family(report, 'gate_value').run_correlation.exact, 140);
  assert.equal(family(report, 'gate_value').provenance.producer_observation, 140);
  for (const line of fs.readFileSync(capturePaths(f.root, run.project_id).receipts, 'utf8').trim().split(/\r?\n/))
    assert.ok(Buffer.byteLength(line) <= MAX_RECEIPT_BATCH_BYTES);
  assert.equal(fs.existsSync(run.metrics_dir), false);
  assert.doesNotMatch(JSON.stringify(report), /RUNTIME_REPORT_FIXTURE|PRIVATE_OVERSIZE_CANARY|gate-value-log\.jsonl|input_tokens|output_tokens/);
});
