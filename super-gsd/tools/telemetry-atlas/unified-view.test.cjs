'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildUnifiedView, dedupeNativeEvents } = require('./unified-view.cjs');

const file = (directory, name, value) => {
  const target = path.join(directory, name); fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value) + '\n');
  return { name, bytes: fs.statSync(target).size };
};

test('unified view keeps Root local and verified PM/worker peer observations distinct', t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-unified-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const now = Date.parse('2026-09-16T09:40:00.000Z'), projectId = 'a'.repeat(64);
  const pm = { schema_version: 1, scope: 'supervised_coordination', provider: 'openai', accountingSource: 'supervised_coordination',
    coordination_id: 'b'.repeat(64), role: 'pm-delivery', run_id: 'coord-00000000-0000-4000-8000-000000000001', registered_at: new Date(now).toISOString() };
  const worker = { schema_version: 1, project_id: projectId, project_dir: '/peer/clarity', run_id: 'sgsd-00000000-0000-4000-8000-000000000002',
    provider: 'openai', role: 'executor', registered_at: new Date(now).toISOString() };
  const event = { runtime: { model_provider: 'openai' }, identity: { response_id: 'response-1' },
    usage: { input_tokens: 11, output_tokens: 3, total_provider_tokens: 14 } };
  const altered = { ...event, usage: { input_tokens: 12, output_tokens: 3, total_provider_tokens: 15 } };
  const pmRow = file(directory, '1'.repeat(64) + '.json', pm);
  const workerRow = file(directory, '2'.repeat(64) + '.json', worker);
  const eventsRow = file(directory, '3'.repeat(64) + '.jsonl', JSON.stringify(event) + '\n' + JSON.stringify(event) + '\n' + JSON.stringify(altered) + '\n');
  const view = buildUnifiedView({ now, localSnapshot: { generated_at: new Date(now).toISOString(), projects: [{ project_id: projectId,
    project_dir: '/local/root', classification: 'configured', native: { last_received_at: new Date(now).toISOString() },
    runs: [{ run_id: 'local-worker', role: 'executor', last_received_at: new Date(now).toISOString() },
      { run_id: 'root-run', role: 'orchestrator', last_received_at: new Date(now).toISOString() }] }] },
    peerBundles: [{ bundle_id: 'atlas-20260916T094000Z-1234abcd', verified: { verified: true }, origin: { transport: 'configured_ssh',
      trust: 'configured_transport_and_root', host: 'devcp', remote_root: '/global' }, manifest: { capture_status: 'complete', audit_status: 'WARN',
      files: [{ ...pmRow, source_role: 'coordination_registration' }, { ...workerRow, source_role: 'run_registration' },
        { ...eventsRow, source_role: 'coordination_event_ledger' }] }, directory }] });
  assert.equal(view.coverage.root.status, 'observed'); assert.equal(view.coverage.root.source, 'local');
  assert.equal(view.coverage.pm_delivery.status, 'observed'); assert.equal(view.coverage.pm_delivery.source, 'peer');
  assert.equal(view.coverage.worker.status, 'observed'); assert.equal(view.coverage.worker.source, 'peer');
  assert.equal(view.coverage.worker.run_id, worker.run_id); assert.equal(view.coverage.worker.provenance, 'verified_peer_bundle');
  assert.equal(view.local_observations.every(row => row.source === 'local'), true);
  assert.equal(view.peer_observations.every(row => row.source === 'peer'), true);
  assert.equal(view.api_usage.root.status, 'unknown'); assert.equal(view.api_usage.root.input_tokens, null);
  assert.equal(view.dedup.duplicates, 1); assert.equal(view.dedup.conflicts, 1);
  assert.ok(view.findings.some(row => row.reason === 'native_identity_integrity_conflict'));
});

test('unified view rejects untrusted or missing origin and keeps stale/unknown explicit', () => {
  const view = buildUnifiedView({ now: Date.parse('2026-09-16T09:40:00.000Z'), localSnapshot: { projects: [], generated_at: null },
    peerBundles: [{ verified: { verified: true }, manifest: { files: [] }, origin: { host: 'self', remote_root: '/global' } }],
    peerFindings: [{ reason: 'peer_copy_unverified' }] });
  assert.equal(view.peer_observations.length, 0); assert.ok(view.findings.some(row => row.reason === 'peer_origin_untrusted'));
  assert.equal(view.coverage.root.status, 'unknown'); assert.equal(view.coverage.pm_delivery.status, 'offline');
  assert.deepEqual(dedupeNativeEvents([]).events, []);
});

test('verified peer observation becomes stale without being promoted to current coverage', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-unified-stale-'));
  try {
    const value = { scope: 'supervised_coordination', role: 'pm-delivery', coordination_id: 'c'.repeat(64),
      run_id: 'coord-00000000-0000-4000-8000-000000000003', registered_at: '2026-09-16T08:00:00.000Z' };
    const name = '4'.repeat(64) + '.json'; fs.writeFileSync(path.join(directory, name), JSON.stringify(value) + '\n');
    const view = buildUnifiedView({ now: Date.parse('2026-09-16T09:40:00.000Z'), localSnapshot: { projects: [] }, peerBundles: [{
      bundle_id: 'atlas-20260916T080000Z-1234abcd', verified: { verified: true }, origin: { transport: 'configured_ssh',
        trust: 'configured_transport_and_root', host: 'devcp', remote_root: '/global' }, manifest: { files: [{ name, bytes: fs.statSync(path.join(directory, name)).size,
        source_role: 'coordination_registration' }] }, directory }] });
    assert.equal(view.coverage.pm_delivery.status, 'stale');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
