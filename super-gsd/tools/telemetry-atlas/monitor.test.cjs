'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { canonicalize, digest } = require('./contract.cjs');
const { registerRun } = require('./global-store.cjs');
const { collectSnapshot } = require('./monitor.cjs');

const NOW = Date.parse('2026-09-10T12:00:00.000Z');
const rm = directory => fs.rmSync(directory, { recursive: true, force: true });
const json = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value) + '\n');
};
const fixture = t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-monitor-'));
  t.after(() => rm(directory));
  const root = path.join(directory, 'global');
  const project = path.join(directory, 'clarity');
  fs.mkdirSync(path.join(project, '.planning'), { recursive: true });
  fs.mkdirSync(path.join(project, '.git'), { recursive: true });
  return { directory, root, project };
};

function nativeEvent(run, occurredAt, responseId = 'response-1', usage = {}) {
  return {
    schema_version: 1,
    source_event_id: responseId,
    occurred_at: occurredAt,
    event_type: 'api_request',
    source: { kind: 'codex_rollout', instance: 'codex', version: '1', provenance: 'provider_reported',
      confidence: 'exact', completeness_reason: 'http_request_identity_unavailable' },
    identity: { sgsd_run_id: run.run_id, session_id: 'session-1', thread_id: 'thread-1', turn_id: 'turn-1',
      root_turn_id: 'root-1', response_id: responseId, request_id: null },
    runtime: { provider: 'openai', model: 'gpt-5.5', model_provenance: 'thread_configuration',
      response_model: null, model_provider: 'openai', codex_version: '1.0.0' },
    scope: { launcher_repo_id: run.project_id, role: run.role, cost_center: run.role,
      attribution_method: 'launcher_registration' },
    usage: { input_tokens: 100, cache_read_tokens: 40, cache_creation_tokens: null,
      output_tokens: 20, reasoning_tokens: 5, total_provider_tokens: 120, ...usage },
    execution: { status: 'response_completed', success: true },
    payload: { raw_content_recorded: false },
  };
}

function appendNative(root, run, event, ingestedAt) {
  const directory = path.join(root, 'projects', run.project_id, 'metrics');
  fs.mkdirSync(directory, { recursive: true });
  const row = canonicalize(event, ingestedAt);
  fs.appendFileSync(path.join(directory, 'sgsd-atlas-events-open.jsonl'), JSON.stringify(row) + '\n');
}

function validState(projectId, updatedAt = new Date(NOW).toISOString()) {
  return { schema_version: 1, project_id: projectId, capture_started_at: updatedAt,
    initial_cutoff_at: updatedAt, source_rotation: 0, updated_at: updatedAt,
    counters: { accepted: 0, duplicate: 0, conflict: 0, rejected: 0, excluded: 0, gaps: 0,
      records: 0, bytes_read: 0 }, sources: {} };
}

function receiptBatch(projectId, observedAt, detail = { verdict: 'pass' }) {
  const receipt = { family: 'review', source_path_sha256: 'b'.repeat(64),
    source_occurrence_id: 'c'.repeat(64), file_identity: 'd'.repeat(64), offset: 0, length: 1,
    source_record_sha256: 'e'.repeat(64), observed_at: observedAt, disposition: 'accepted', reason: null,
    source_event_id: 'f'.repeat(64), detail_sha256: digest(detail), run_correlation: 'exact', detail,
    canonical_event_id: '1'.repeat(64), canonical_payload_sha256: '2'.repeat(64) };
  receipt.receipt_id = digest(['sgsd-ledger-receipt-v1', projectId, receipt.family,
    receipt.source_occurrence_id, receipt.offset, receipt.length, receipt.source_record_sha256]);
  return { schema_version: 1, batch_id: digest([receipt.receipt_id]), project_id: projectId,
    committed_at: observedAt, receipts: [receipt] };
}

test('empty root never proves collection', async t => {
  const f = fixture(t);
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [] });
  assert.equal(s.complete_coverage, false);
  assert.notEqual(s.status, 'PASS');
  assert.deepEqual(s.service, { healthy: false, pid: null });
  assert.ok(s.findings.some(row => row.reason === 'no_configured_projects'));
  assert.equal(fs.existsSync(path.join(f.root, 'monitor', 'latest.json')), true);
});

test('missing configured project remains visible and unknown', async t => {
  const f = fixture(t), missing = path.join(f.directory, 'missing');
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [missing] });
  assert.equal(s.projects.length, 1);
  assert.equal(s.projects[0].classification, 'missing');
  assert.equal(s.projects[0].project_id, null);
  assert.equal(s.projects[0].native.status, 'unavailable');
  assert.ok(s.findings.some(row => row.reason === 'project_dir_missing'));
});

test('quiet registered run is unavailable, never zero-token success', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project, provider: 'openai', role: 'executor',
    accountingSource: 'codex_rollout' });
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  const project = s.projects.find(row => row.project_id === run.project_id);
  assert.equal(project.classification, 'configured');
  assert.equal(project.native.status, 'unavailable');
  assert.deepEqual(project.native.summary, { availability: 'unavailable', scope: null, interval: null,
    generated_at: null, age_ms: null, input_tokens: null, output_tokens: null,
    total_provider_tokens: null, cache_read_tokens: null, cache_creation_tokens: null,
    reasoning_tokens: null });
  assert.equal(project.runs[0].native_status, 'unavailable');
  assert.ok(s.findings.some(row => row.reason === 'native_delivery_unobserved'));
});

test('bounded native tail keeps received and occurred times distinct and subsets non-additive', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project, provider: 'openai', role: 'executor',
    accountingSource: 'codex_rollout' });
  const occurredAt = new Date(NOW - 20 * 60 * 1000).toISOString();
  const receivedAt = new Date(NOW - 5 * 1000).toISOString();
  appendNative(f.root, run, nativeEvent(run, occurredAt), receivedAt);
  const source = path.join(f.root, 'projects', run.project_id, 'metrics', 'sgsd-atlas-events-open.jsonl');
  const before = fs.readFileSync(source);
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  const native = s.projects[0].native;
  assert.equal(native.last_received_at, receivedAt);
  assert.equal(native.last_occurred_at, occurredAt);
  assert.equal(native.status, 'stale_or_idle');
  assert.equal(native.summary.scope, 'bounded_native_tail');
  assert.equal(native.summary.total_provider_tokens, 120);
  assert.equal(native.summary.input_tokens, 100);
  assert.equal(native.summary.output_tokens, 20);
  assert.equal(native.summary.cache_read_tokens, 40);
  assert.equal(native.summary.cache_creation_tokens, null);
  assert.equal(native.summary.reasoning_tokens, 5);
  assert.deepEqual(fs.readFileSync(source), before, 'canonical source must remain byte-identical');
});

test('fresh native delivery and valid capture state are observed without scanning operational ledgers', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project, provider: 'openai', role: 'executor',
    accountingSource: 'codex_rollout' });
  appendNative(f.root, run, nativeEvent(run, new Date(NOW - 1000).toISOString()), new Date(NOW).toISOString());
  const stateFile = path.join(f.root, 'projects', run.project_id, 'operational', 'sgsd-ledger-state.json');
  json(stateFile, validState(run.project_id));
  const before = fs.readFileSync(stateFile);
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  assert.equal(s.projects[0].native.status, 'observed');
  assert.equal(s.projects[0].operational.status, 'unavailable');
  assert.deepEqual(fs.readFileSync(stateFile), before);
});

test('missing evidence directories have unknown capacity rather than a successful zero', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project, provider: 'openai', role: 'executor',
    accountingSource: 'codex_rollout' });
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  const capacity = s.projects.find(row => row.project_id === run.project_id).capacity;
  assert.equal(capacity.native.used_bytes, null);
  assert.equal(capacity.operational.used_bytes, null);
  assert.equal(capacity.receipts.used_bytes, null);
});

test('bounded receipt metadata exposes operational family verdict and receipt freshness', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project });
  const observedAt = new Date(NOW - 2000).toISOString();
  const operational = path.join(f.root, 'projects', run.project_id, 'operational');
  json(path.join(operational, 'sgsd-ledger-state.json'), validState(run.project_id));
  fs.writeFileSync(path.join(operational, 'sgsd-ledger-receipts.jsonl'),
    JSON.stringify(receiptBatch(run.project_id, observedAt)) + '\n');
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  assert.equal(s.projects[0].operational.status, 'observed');
  assert.deepEqual(s.projects[0].operational.families.review, { status: 'observed',
    last_received_at: observedAt, last_occurred_at: null, observations: 1, verdict: 'pass',
    summary_generated_at: observedAt, age_ms: 2000 });
});

test('malformed receipt cannot manufacture an observed PASS family verdict', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project });
  const operational = path.join(f.root, 'projects', run.project_id, 'operational');
  json(path.join(operational, 'sgsd-ledger-state.json'), validState(run.project_id));
  fs.writeFileSync(path.join(operational, 'sgsd-ledger-receipts.jsonl'), JSON.stringify({
    schema_version: 1, receipts: [{ family: 'review', observed_at: new Date(NOW).toISOString(),
      disposition: 'accepted', detail: { verdict: 'pass' } }],
  }) + '\n');
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  assert.equal(s.projects[0].operational.status, 'degraded');
  assert.equal(s.projects[0].operational.families.review, undefined);
  assert.ok(s.findings.some(row => row.reason === 'receipt_tail_invalid'));
});

test('compact daily audit preserves older operational family occurrence and cache age', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project });
  const observedAt = new Date(NOW - 24 * 60 * 60 * 1000).toISOString();
  const generatedAt = new Date(NOW - 60 * 60 * 1000).toISOString();
  json(path.join(f.root, 'monitor', 'audit.json'), { schema_version: 1, generated_at: generatedAt,
    status: 'WARN', complete_coverage: false, finding_count: 2, project_count: 1, projects: [],
    operations: { status: 'WARN', projects: [{ project_id: run.project_id, families: [{ family: 'muda',
      state: 'observed', observations: 3, last_observed_at: observedAt, latest_outcome: 'warn' }] }] } });
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  assert.deepEqual(s.projects[0].operational.families.muda, { status: 'observed', last_received_at: null,
    last_occurred_at: observedAt, observations: 3, verdict: 'warn', summary_generated_at: generatedAt,
    age_ms: 60 * 60 * 1000 });
  assert.equal(s.projects[0].operational.status, 'observed');
});

test('stale private spool warns and exposes only content-free run identity', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project, provider: 'openai', role: 'executor',
    accountingSource: 'codex_rollout' });
  const spool = path.join(f.root, 'runs', run.run_id, 'quota-spool', 'a'.repeat(64) + '.json');
  json(spool, { private: 'must-not-appear' });
  fs.utimesSync(spool, new Date(NOW - 121000), new Date(NOW - 121000));
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  assert.equal(s.projects[0].runs[0].pending_spool, 1);
  assert.ok(s.findings.some(row => row.reason === 'spool_backlog_stale'));
  assert.doesNotMatch(JSON.stringify(s), /must-not-appear/);
});

test('unsafe and oversized monitor inputs fail closed while safe audit is preserved', async t => {
  const f = fixture(t), monitor = path.join(f.root, 'monitor');
  fs.mkdirSync(monitor, { recursive: true });
  json(path.join(monitor, 'audit.json'), { schema_version: 1, generated_at: new Date(NOW).toISOString(), status: 'WARN' });
  fs.writeFileSync(path.join(monitor, 'backup.json'), 'x'.repeat(300000));
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [] });
  assert.equal(s.audit.status, 'WARN');
  assert.equal(s.backup, null);
  assert.ok(s.findings.some(row => row.reason === 'backup_read_limit'));
  assert.notEqual(s.status, 'PASS');
});

test('verified Windows receipt is accepted as backup freshness metadata', async t => {
  const f = fixture(t), monitor = path.join(f.root, 'monitor'), verifiedAt = new Date(NOW - 1000).toISOString();
  fs.mkdirSync(monitor, { recursive: true });
  json(path.join(monitor, 'backup.json'), { schema_version: 1, status: 'verified', bundle_id: '20260910T115959Z',
    manifest_sha256: 'a'.repeat(64), verified_at: verifiedAt, received_at: new Date(NOW).toISOString(),
    verification: 'windows_client_sha256', capture_status: 'incomplete' });
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [] });
  assert.equal(s.backup.status, 'verified');
  assert.equal(s.backup.verified, true);
  assert.equal(s.backup.verified_at, verifiedAt);
  assert.equal(s.backup.capture_status, 'incomplete');
  assert.equal(s.findings.some(row => row.reason === 'backup_read_error'), false);
});

test('stale, future, and truncated audit projections are never treated as fresh coverage', async t => {
  const f = fixture(t), audit = path.join(f.root, 'monitor', 'audit.json');
  json(audit, { schema_version: 1, generated_at: new Date(NOW - 31 * 60 * 60 * 1000).toISOString(),
    status: 'WARN', complete_coverage: false, truncated: true, finding_count: 1, project_count: 0,
    projects: [], operations: { status: 'WARN', projects: [] } });
  const stale = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [] });
  assert.ok(stale.findings.some(row => row.reason === 'audit_overdue'));
  assert.ok(stale.findings.some(row => row.reason === 'audit_truncated'));
  json(audit, { schema_version: 1, generated_at: new Date(NOW + 61000).toISOString(),
    status: 'WARN', complete_coverage: false, truncated: false, finding_count: 0, project_count: 0,
    projects: [], operations: { status: 'WARN', projects: [] } });
  const future = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [] });
  assert.ok(future.findings.some(row => row.reason === 'audit_future'));
});

test('failed daily export and scheduler receipts surface in minute health', async t => {
  const f = fixture(t), monitor = path.join(f.root, 'monitor');
  json(path.join(monitor, 'daily.json'), { schema_version: 1, status: 'failed',
    attempted_at: new Date(NOW).toISOString(), reason: 'export_failed' });
  json(path.join(monitor, 'schedule-last-run.json'), { schema_version: 1, status: 'failed',
    checked_at: new Date(NOW).toISOString(), reason: 'monitor_did_not_publish' });
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [] });
  assert.ok(s.findings.some(row => row.reason === 'daily_export_failed'));
  assert.ok(s.findings.some(row => row.reason === 'schedule_last_run_failed'));
});

test('registration inventory limit is explicit and cannot produce all-covered', async t => {
  const f = fixture(t), runs = path.join(f.root, 'runs');
  fs.mkdirSync(runs, { recursive: true });
  for (let i = 0; i < 258; i++) fs.mkdirSync(path.join(runs,
    `sgsd-${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`));
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  assert.ok(s.findings.some(row => row.reason === 'run_inventory_limit'));
  assert.equal(s.complete_coverage, false);
});

test('common-Git-dir worktree is included while benchmark and unknown registrations stay visible', async t => {
  const f = fixture(t);
  const gitDir = path.join(f.project, '.git');
  const worktree = path.join(f.directory, 'clarity-worktree');
  const worktreeGit = path.join(gitDir, 'worktrees', 'trial');
  fs.mkdirSync(path.join(worktree, '.planning'), { recursive: true });
  fs.mkdirSync(worktreeGit, { recursive: true });
  fs.writeFileSync(path.join(worktree, '.git'), `gitdir: ${worktreeGit}\n`);
  fs.writeFileSync(path.join(worktreeGit, 'commondir'), '../..\n');
  const benchmark = path.join(f.directory, 'benchmarks', 'trial');
  const other = path.join(f.directory, 'other');
  for (const directory of [benchmark, other]) {
    fs.mkdirSync(path.join(directory, '.planning'), { recursive: true });
    fs.mkdirSync(path.join(directory, '.git'), { recursive: true });
  }
  registerRun({ root: f.root, projectDir: f.project });
  registerRun({ root: f.root, projectDir: worktree });
  registerRun({ root: f.root, projectDir: benchmark });
  registerRun({ root: f.root, projectDir: other });
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  const classes = new Map(s.projects.map(row => [row.project_dir, row.classification]));
  assert.equal(classes.get(fs.realpathSync(f.project)), 'configured');
  assert.equal(classes.get(fs.realpathSync(worktree)), 'worktree');
  assert.equal(classes.get(fs.realpathSync(benchmark)), 'excluded_benchmark');
  assert.equal(classes.get(fs.realpathSync(other)), 'excluded_unclassified');
  const excludedIds = new Set(s.projects.filter(row => row.classification.startsWith('excluded_'))
    .map(row => row.project_id));
  assert.equal(s.findings.some(row => excludedIds.has(row.project_id)), false,
    'excluded inventory must not affect selected-project health');
});

test('incident and recovery rows deduplicate across minute checks', async t => {
  const f = fixture(t), incidents = path.join(f.root, 'monitor', 'incidents.jsonl');
  await collectSnapshot({ root: f.root, now: NOW, projectDirs: [] });
  await collectSnapshot({ root: f.root, now: NOW + 60000, projectDirs: [] });
  const afterRepeat = fs.readFileSync(incidents, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(afterRepeat.filter(row => row.reason === 'no_configured_projects').length, 1);
  await collectSnapshot({ root: f.root, now: NOW + 120000, projectDirs: [f.project] });
  const rows = fs.readFileSync(incidents, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(rows.some(row => row.reason === 'no_configured_projects' && row.state === 'recovered'));
});

test('incident capacity fallback still publishes a bounded explicit snapshot', async t => {
  const f = fixture(t), incidents = path.join(f.root, 'monitor', 'incidents.jsonl');
  fs.mkdirSync(path.dirname(incidents), { recursive: true });
  fs.writeFileSync(incidents, 'x');
  fs.truncateSync(incidents, 4 * 1024 * 1024);
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [] });
  assert.ok(s.findings.some(row => row.reason === 'incident_history_capacity'));
  assert.ok(Buffer.byteLength(fs.readFileSync(path.join(f.root, 'monitor', 'latest.json'))) <= 1024 * 1024);
});

test('malformed prior snapshot is discarded without breaking incident persistence', async t => {
  const f = fixture(t);
  json(path.join(f.root, 'monitor', 'latest.json'), { schema_version: 1, findings: {} });
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [] });
  assert.ok(s.findings.some(row => row.reason === 'previous_snapshot_invalid'));
  assert.ok(Array.isArray(JSON.parse(fs.readFileSync(path.join(f.root, 'monitor', 'latest.json'))).findings));
});

test('finding output is explicitly capped below the snapshot byte limit', async t => {
  const f = fixture(t);
  for (let index = 0; index < 5; index++) {
    const run = registerRun({ root: f.root, projectDir: f.project });
    const spool = path.join(f.root, 'runs', run.run_id, 'quota-spool');
    fs.mkdirSync(spool, { recursive: true });
    for (let item = 0; item < 64; item++) fs.writeFileSync(path.join(spool, `unsafe-${item}`), 'x');
  }
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  assert.ok(s.findings.some(row => row.reason === 'finding_limit'));
  assert.ok(Buffer.byteLength(JSON.stringify(s)) <= 1024 * 1024);
});

test('bounded native and receipt tails surface truncation', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project });
  const metrics = path.join(f.root, 'projects', run.project_id, 'metrics');
  const operational = path.join(f.root, 'projects', run.project_id, 'operational');
  fs.mkdirSync(metrics, { recursive: true });
  fs.mkdirSync(operational, { recursive: true });
  fs.writeFileSync(path.join(metrics, 'sgsd-atlas-events-open.jsonl'), `${'x'.repeat(70 * 1024)}\n`);
  fs.writeFileSync(path.join(operational, 'sgsd-ledger-receipts.jsonl'), `${'x'.repeat(130 * 1024)}\n`);
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  assert.ok(s.findings.some(row => row.reason === 'native_tail_limit'));
  assert.ok(s.findings.some(row => row.reason === 'receipt_tail_limit'));
});

test('canonical rows that fail validation or hashes are explicitly degraded', async t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.project });
  appendNative(f.root, run, nativeEvent(run, new Date(NOW).toISOString()), new Date(NOW).toISOString());
  const source = path.join(f.root, 'projects', run.project_id, 'metrics', 'sgsd-atlas-events-open.jsonl');
  const row = JSON.parse(fs.readFileSync(source, 'utf8'));
  row.payload_sha256 = '0'.repeat(64);
  fs.writeFileSync(source, JSON.stringify(row) + '\n');
  const s = await collectSnapshot({ root: f.root, now: NOW, projectDirs: [f.project] });
  assert.equal(s.projects[0].native.status, 'unavailable');
  assert.ok(s.findings.some(item => item.reason === 'native_canonical_invalid'));
});

test('failed integrity audit changes monitor severity and incident identity',async t=>{
  const f=fixture(t);fs.mkdirSync(path.join(f.root,'monitor'),{recursive:true});
  fs.writeFileSync(path.join(f.root,'monitor/audit.json'),JSON.stringify({schema_version:1,status:'FAIL',generated_at:new Date(NOW).toISOString(),complete_coverage:false}));
  const snapshot=await collectSnapshot({root:f.root,now:NOW,projectDirs:[f.project]});
  assert.equal(snapshot.status,'FAIL');assert.ok(snapshot.findings.some(row=>row.reason==='audit_failed'&&row.severity==='FAIL'));
});

test('CLI check writes latest snapshot and returns WARN exit 10 for empty root', t => {
  const f = fixture(t);
  const result = spawnSync(process.execPath, [path.join(__dirname, 'monitor.cjs'), 'check', '--root', f.root],
    { encoding: 'utf8' });
  assert.equal(result.status, 10, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'WARN');
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, 'monitor', 'latest.json'), 'utf8')).status, 'WARN');
});

test('Linux process census keeps an unregistered project process unmatched without arguments',
  { skip: process.platform !== 'linux' }, async t => {
    const f = fixture(t);
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { cwd: f.project, stdio: 'ignore' });
    t.after(() => child.kill());
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    const s = await collectSnapshot({ root: f.root, now: Date.now(), projectDirs: [f.project] });
    const item = s.unmatched_sessions.find(row => row.pid === child.pid);
    assert.ok(item);
    assert.equal(item.reason, 'process_attachment_unknown');
    assert.deepEqual(Object.keys(item).sort(), ['cwd', 'exe', 'pid', 'reason', 'started_at']);
    assert.doesNotMatch(JSON.stringify(item), /setInterval/);
  });
