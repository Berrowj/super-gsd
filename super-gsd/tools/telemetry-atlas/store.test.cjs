'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore, validate } = require('./contract.cjs');
const event = (id = 'req-1', extra = {}) => ({ schema_version: 1, source_event_id: id,
  occurred_at: '2026-09-07T12:00:00.000Z', event_type: 'api_request',
  source: { kind: 'claude_otel', instance: 'local', provenance: 'provider_reported', confidence: 'exact' },
  identity: { session_id: 'session-1', request_id: id }, usage: { input_tokens: 10 }, ...extra });
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, ledgerPath: path.join(root, 'events.jsonl'), gapPath: path.join(root, 'gaps.jsonl') };
}
function diskText(root) {
  return fs.readdirSync(root, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
    .map(e => fs.readFileSync(path.join(e.parentPath || e.path, e.name), 'utf8')).join('\n');
}
test('nested allowlists reject arbitrary content and malformed numeric types before any disk write', t => {
  const f = fixture(t), store = createStore(f);
  for (const section of ['source','identity','scope','runtime','usage','execution']) {
    const input = event(); input[section] = { ...input[section], summary: 'CANARY PRIVATE SENTENCE' };
    assert.equal(store.ingest(input).status, 'rejected', section);
  }
  assert.notEqual(validate(event('req', { usage: { input_tokens: 'CANARY PRIVATE SENTENCE' } })), null);
  assert.notEqual(validate(event('req', { identity: { session_id: 'alice@example.test' } })), null);
  assert.notEqual(validate(event('req', { usage: { output_tokens: -1 } })), null);
  assert.notEqual(validate(event('req', { usage: { input_tokens: Infinity } })), null);
  assert.equal(diskText(f.root).includes('CANARY'), false);
});
test('replayed conflicts append once and new session never collides', t => {
  const f = fixture(t), store = createStore(f), first = event();
  assert.equal(store.ingest(first).status, 'accepted');
  assert.equal(store.ingest(first).status, 'duplicate');
  const changed = event('req-1', { usage: { input_tokens: 11 } });
  assert.equal(store.ingest(changed).status, 'conflict');
  assert.equal(store.ingest(changed).status, 'duplicate');
  assert.equal(store.ingest(event('req-1', { identity: { session_id: 'session-2', request_id: 'req-1' } })).status, 'accepted');
  assert.equal(store.read().events.length, 3);
  const restored = createStore(f);
  assert.equal(restored.ingest(first).status, 'duplicate');
  assert.equal(restored.ingest(changed).status, 'duplicate');
  assert.equal(restored.read().events.length, 3);
});
test('corruption in the middle preserves later valid evidence and blocks appends with independent gap', t => {
  const f = fixture(t), store = createStore(f);
  store.ingest(event('one')); store.ingest(event('two'));
  const lines = fs.readFileSync(f.ledgerPath, 'utf8').trimEnd().split('\n');
  fs.writeFileSync(f.ledgerPath, `${lines[0]}\nnot-json\n${lines[1]}\n`);
  const before = fs.readFileSync(f.ledgerPath);
  const reopened = createStore(f);
  assert.equal(reopened.ingest(event('three')).status, 'rejected');
  assert.equal(reopened.read().events.length, 2);
  assert.deepEqual(fs.readFileSync(f.ledgerPath), before);
  assert.equal(fs.readFileSync(f.gapPath, 'utf8').includes('corrupt_ledger'), true);
});
test('configured canonical byte ceiling and disk pressure stop detail without deleting evidence', t => {
  const f = fixture(t), store = createStore({ ...f, maxBytes: 1800 });
  assert.equal(store.ingest(event('one')).status, 'accepted');
  for (let n = 2; n < 10; n++) store.ingest(event(`req-${n}`));
  assert.ok(fs.statSync(f.ledgerPath).size <= 1800);
  assert.equal(store.status().healthy, false);
  assert.match(fs.readFileSync(f.gapPath, 'utf8'), /canonical_size_limit/);
  const disk = createStore({ ...fixture(t), freeRatio: () => 0.05 });
  assert.deepEqual(disk.ingest(event()).reason, 'disk_pressure');
});
test('index limit is bounded and a second writer fails safe without overwriting', t => {
  const f = fixture(t), first = createStore({ ...f, maxIndexEntries: 2 });
  first.ingest(event('one')); first.ingest(event('two'));
  assert.equal(first.ingest(event('three')).reason, 'index_limit');
  const external = createStore(f); external.ingest(event('external'));
  assert.equal(first.ingest(event('four')).status, 'rejected');
});
test('quota reset closes hashed immutable partition; unknown start is partial and replays are no-ops', t => {
  const f = fixture(t), store = createStore({ projectDir: f.root, now: () => '2026-09-07T12:00:00.000Z' });
  assert.equal(store.ingest(event()).status, 'accepted');
  const initial = store.ledgerPath;
  const quota = event('quota-1', { event_type: 'quota', quota: { window: 'seven_day', used_percentage: 25,
    resets_at: '2026-09-10T12:00:00Z', scope: 'account', attribution: 'account_unallocated' } });
  assert.equal(store.ingest(quota).status, 'accepted');
  assert.notEqual(store.ledgerPath, initial);
  const saved = fs.readFileSync(initial);
  assert.equal(store.ingest(event()).status, 'duplicate');
  assert.deepEqual(fs.readFileSync(initial), saved);
  const manifest = fs.readFileSync(path.join(f.root, '.planning/metrics/sgsd-atlas-manifest.jsonl'), 'utf8');
  assert.match(manifest, /sha256/); assert.match(manifest, /partial/);
  const active = store.ledgerPath;
  const reset2 = { ...quota, source_event_id: 'quota-2', quota: { ...quota.quota, resets_at: '2026-09-17T12:00:00Z' } };
  store.ingest(reset2);
  assert.notEqual(store.ledgerPath, active);
  assert.equal(createStore({ projectDir: f.root }).ingest(quota).status, 'duplicate');
});
test('symlink destination is refused without changing the target', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t), outside = path.join(f.root, 'outside'); fs.writeFileSync(outside, 'keep');
  fs.symlinkSync(outside, f.ledgerPath);
  assert.throws(() => createStore(f), /unsafe/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
});
test('same-size canonical tampering and closed partition edits are detected on recovery', t => {
  const f = fixture(t), store = createStore({ projectDir: f.root });
  store.ingest(event()); const first = store.ledgerPath;
  store.ingest(event('quota', { event_type: 'quota', quota: { window: 'seven_day', used_percentage: 20,
    resets_at: '2026-09-10T12:00:00Z', scope: 'account', attribution: 'account_unallocated' } }));
  fs.writeFileSync(first, fs.readFileSync(first,'utf8').replace('"input_tokens":10','"input_tokens":11'));
  const recovered = createStore({ projectDir: f.root });
  assert.equal(recovered.status().healthy,false);
  assert.equal(recovered.ingest(event('next')).status,'rejected');
});
test('source event sequence is preserved and huge individual rows never become unbounded scan buffers', t => {
  const f = fixture(t), store = createStore(f);
  store.ingest(event('one', { event_sequence: 73 }));
  assert.equal(store.read().events[0].event_sequence,73);
  fs.appendFileSync(f.ledgerPath,'x'.repeat(200000)+'\n');
  const reopened = createStore(f);
  assert.equal(reopened.ingest(event('two')).status,'rejected');
  assert.equal(reopened.read().events.length,1);
});
test('a stale writer cannot append into a partition closed by another writer', t => {
  const f = fixture(t), owner = createStore({ projectDir: f.root }); owner.ingest(event());
  const stale = createStore({ projectDir: f.root });
  owner.ingest(event('quota', { event_type: 'quota', quota: { window: 'seven_day', used_percentage: 20,
    resets_at: '2026-09-10T12:00:00Z', scope: 'account', attribution: 'account_unallocated' } }));
  const before = fs.readFileSync(stale.ledgerPath);
  assert.equal(stale.ingest(event('stale')).status,'rejected');
  assert.deepEqual(fs.readFileSync(stale.ledgerPath),before);
});
test('an unverifiable crash lock degrades health and emits a recoverable diagnostic', t => {
  const f = fixture(t); fs.writeFileSync(path.join(f.root,'.sgsd-atlas-write.lock'),'');
  const store = createStore(f);
  assert.equal(store.status().healthy,false);
  assert.equal(store.ingest(event()).reason,'writer_lock_unverifiable');
  assert.match(fs.readFileSync(f.gapPath,'utf8'),/writer_lock_unverifiable/);
});
test('malformed conflict rows fail recovery validation rather than bypassing the envelope', t => {
  const f = fixture(t);
  fs.writeFileSync(f.ledgerPath, JSON.stringify({ event_id: 'junk', event_type: 'integrity_conflict',
    source: { prompt: 'PRIVATE-CANARY' } })+'\n');
  const store = createStore(f);
  assert.equal(store.status().healthy,false);
  assert.equal(store.ingest(event()).status,'rejected');
});
test('verified dead-writer lock recovers without deleting canonical evidence', t => {
  const f = fixture(t), store = createStore(f); store.ingest(event());
  const before = fs.readFileSync(f.ledgerPath,'utf8');
  const { spawnSync } = require('node:child_process');
  const child = spawnSync(process.execPath,['-e',
    'require("fs").writeFileSync(process.argv[1],JSON.stringify({schema_version:1,pid:process.pid,start_time:null,nonce:"a".repeat(32)}))',
    path.join(f.root,'.sgsd-atlas-write.lock')], { encoding: 'utf8' });
  assert.equal(child.status,0,child.stderr);
  const recovered = createStore(f);
  assert.equal(recovered.status().healthy,true);
  assert.equal(recovered.ingest(event()).status,'duplicate');
  assert.equal(fs.readFileSync(f.ledgerPath,'utf8'),before);
  assert.match(fs.readFileSync(f.gapPath,'utf8'),/recovered_stale_writer_lock/);
});
test('conflict metadata has a checksum and must reference the original payload digest', t => {
  const f = fixture(t), store = createStore(f); store.ingest(event());
  store.ingest(event('req-1',{ usage: { input_tokens: 11 } }));
  const rows = store.read().events;
  rows[1].first_payload_sha256 = 'f'.repeat(64);
  fs.writeFileSync(f.ledgerPath,rows.map(row => JSON.stringify(row)+'\n').join(''));
  assert.equal(createStore(f).status().healthy,false);
});
