'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { audit } = require('./audit.cjs');
const { registerRun, createGlobalStore, scopeEvent } = require('./global-store.cjs');
const { canonicalize } = require('./contract.cjs');
function fixture(t) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-audit-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const projectDir = path.join(temp, 'project'); fs.mkdirSync(path.join(projectDir, '.planning'), { recursive: true });
  const root = path.join(temp, 'global'), run = registerRun({ root, projectDir, provider: 'openai' });
  const store = createGlobalStore(root); t.after(() => store.close());
  return { root, run, store };
}
function event(run, id = 'req-1') {
  return scopeEvent({ schema_version: 1, source_event_id: id, occurred_at: '2026-09-08T12:00:00Z', event_type: 'api_request',
    source: { kind: 'codex_otel', instance: 'fixture', provenance: 'provider_reported', confidence: 'exact' },
    runtime: { provider: 'openai', model: 'gpt-6-astra' }, identity: { session_id: 'session', request_id: id },
    execution: { status: 'api_request', success: true }, usage: { input_tokens: 20, output_tokens: 5 } }, run);
}
function snapshot(root) {
  const files = {};
  for (const file of fs.readdirSync(root, { recursive: true })) {
    const name = path.join(root, file); if (fs.statSync(name).isFile()) files[file] = fs.readFileSync(name, 'hex');
  }
  return files;
}
test('empty registration is unavailable, never complete or zero-as-pass', async t => {
  const f = fixture(t), before = snapshot(f.root), result = await audit({ root: f.root });
  assert.equal(result.status, 'WARN');
  assert.equal(result.complete_coverage, false);
  assert.equal(result.projects[0].runs[0].coverage, 'unavailable');
  assert.deepEqual(snapshot(f.root), before);
});
test('canonical corruption and duplicates fail a read-only audit', async t => {
  const f = fixture(t); f.store.ingest(event(f.run));
  const file = path.join(f.run.metrics_dir, 'sgsd-atlas-events-unknown.jsonl');
  const row = fs.readFileSync(file, 'utf8');
  fs.appendFileSync(file, row.replace('"input_tokens":20', '"input_tokens":21'));
  const before = snapshot(f.root), result = await audit({ root: f.root });
  assert.equal(result.status, 'FAIL');
  assert.ok(result.findings.some(row => row.reason === 'duplicate_canonical_events'));
  assert.ok(result.findings.some(row => row.reason === 'schema_checksum_or_attribution_error'));
  assert.deepEqual(snapshot(f.root), before);
});
test('closed partition deletion is caught through the manifest', async t => {
  const f = fixture(t); f.store.ingest(event(f.run));
  f.store.ingest(scopeEvent({ schema_version: 1, source_event_id: 'quota', occurred_at: '2026-09-08T12:00:00Z', event_type: 'quota',
    source: { kind: 'claude_statusline', instance: 'fixture', provenance: 'client_observed', confidence: 'exact' },
    runtime: { provider: 'openai' }, quota: { window: 'seven_day', used_percentage: 5, resets_at: '2026-09-13T00:00:00Z', attribution: 'account_unallocated', scope: 'account' } }, f.run));
  f.store.ingest(event(f.run, 'req-2'));
  const file = path.join(f.run.metrics_dir, 'sgsd-atlas-events-unknown.jsonl');
  assert.ok(fs.existsSync(path.join(f.run.metrics_dir, 'sgsd-atlas-manifest.jsonl')));
  fs.unlinkSync(file); // fixture-only fault injection
  const before = snapshot(f.root), result = await audit({ root: f.root });
  assert.equal(result.status, 'FAIL');
  assert.ok(result.findings.some(row => row.reason === 'closed_partition_integrity'));
  assert.deepEqual(snapshot(f.root), before);
});
test('provider mismatch cannot qualify as native request coverage', async t => {
  const f = fixture(t), value = event(f.run);
  value.runtime.provider = 'anthropic'; value.source.kind = 'claude_otel';
  fs.mkdirSync(f.run.metrics_dir, { recursive: true });
  fs.writeFileSync(path.join(f.run.metrics_dir, 'sgsd-atlas-events-unknown.jsonl'), JSON.stringify(canonicalize(value)) + '\n');
  const result = await audit({ root: f.root });
  assert.equal(result.status, 'FAIL');
  assert.equal(result.projects[0].runs[0].coverage, 'unavailable');
});

test('a quota-first stream may legitimately close an empty initial partition', async t => {
  const f = fixture(t);
  const value = scopeEvent({ schema_version: 1, source_event_id: 'first-quota', occurred_at: '2026-09-08T12:00:00Z', event_type: 'quota',
    source: { kind: 'claude_statusline', instance: 'fixture', provenance: 'client_observed', confidence: 'exact' },
    runtime: { provider: 'openai' }, quota: { window: 'seven_day', used_percentage: 5, resets_at: '2026-09-13T00:00:00Z', attribution: 'account_unallocated', scope: 'account' } }, f.run);
  assert.equal(f.store.ingest(value).status, 'accepted');
  const result = await audit({ root: f.root });
  assert.ok(!result.findings.some(row => row.reason === 'closed_partition_integrity'));
});

test('audit separates provider runs and surfaces stale requests, missing quota, and old spool without writes', async t => {
  const f = fixture(t), projectDir = path.join(path.dirname(f.root), 'project');
  const claude = registerRun({ root: f.root, projectDir, provider: 'anthropic' });
  assert.equal(f.store.ingest(event(f.run)).status, 'accepted');
  const native = event(f.run, 'claude-request');
  native.runtime = { provider: 'anthropic', model: 'claude-fable' }; native.source.kind = 'claude_otel';
  assert.equal(f.store.ingest(scopeEvent(native, claude)).status, 'accepted');
  const spool = path.join(claude.state_dir, 'quota-spool'); fs.mkdirSync(spool, { recursive: true });
  const pending = path.join(spool, 'a'.repeat(64) + '.json'); fs.writeFileSync(pending, '{}');
  fs.utimesSync(pending, new Date('2026-09-08T12:00:00Z'), new Date('2026-09-08T12:00:00Z'));
  const before = snapshot(f.root), result = await audit({ root: f.root, now: Date.parse('2026-09-08T13:00:00Z') });
  assert.equal(result.status, 'WARN'); assert.equal(result.projects[0].runs.length, 2);
  assert.ok(result.projects[0].runs.every(run => run.coverage === 'observed' && run.requests === 1));
  for (const reason of ['requests_stale_or_session_idle', 'quota_window_coverage_partial', 'spool_backlog_stale']) {
    assert.ok(result.findings.some(row => row.reason === reason), reason);
  }
  assert.equal(result.complete_coverage, false); assert.deepEqual(snapshot(f.root), before);
});
