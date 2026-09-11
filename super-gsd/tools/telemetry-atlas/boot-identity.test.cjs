'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const entry = path.join(__dirname, 'boot-identity.cjs');
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
function api() { assert.ok(fs.existsSync(entry), 'boot identity implementation must exist'); return require(entry); }
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-boot-lock-'));
  fs.chmodSync(root, 0o700); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, file: path.join(root, 'owner.lock'), receiptDirectory: path.join(root, 'receipts') };
}
test('boot comparison never invents an identity from missing, malformed or unsupported evidence', () => {
  const boot = api();
  assert.equal(boot.currentBootId({ bootId: () => A }), A);
  for (const value of [null, undefined, '', 'not-a-boot', A + 'x']) assert.equal(boot.currentBootId({ bootId: () => value }), null);
  assert.equal(boot.bootState(A, { bootId: () => B }), 'prior');
  assert.equal(boot.bootState(A, { bootId: () => A }), 'same');
  assert.equal(boot.bootState(undefined, { bootId: () => B }), 'unknown');
});
test('prior-boot lock reclaims without probing reused PID and preserves exact source bytes', t => {
  const f = fixture(t), boot = api(), body = JSON.stringify({ pid: process.pid, token: A, boot_id: A }) + '\n';
  fs.writeFileSync(f.file, body, { mode: 0o600 });
  assert.equal(boot.reclaimLock(f, { bootId: () => B, processState: () => { assert.fail('prior boot does not inspect reused PID'); } }), true);
  assert.equal(fs.existsSync(f.file), false);
  const receipts = fs.readdirSync(f.receiptDirectory).map(name => JSON.parse(fs.readFileSync(path.join(f.receiptDirectory, name))));
  assert.equal(receipts.length, 1); assert.equal(receipts[0].source_bytes, body);
  assert.equal(receipts[0].reason, 'prior_boot');
});
test('same-boot and legacy live or unknown locks stay intact; proved-dead legacy can recover', t => {
  const f = fixture(t), boot = api();
  for (const boot_id of [A, undefined]) for (const state of ['alive', 'unknown']) {
    const body = JSON.stringify({ pid: process.pid, token: A, boot_id }); fs.writeFileSync(f.file, body);
    assert.equal(boot.reclaimLock(f, { bootId: () => A, processState: () => state }), false);
    assert.equal(fs.readFileSync(f.file, 'utf8'), body);
  }
  assert.equal(boot.reclaimLock(f, { bootId: () => A, processState: () => 'dead' }), true);
});
test('malformed metadata, symlink and interrupted reclaim guard fail closed', t => {
  const f = fixture(t), boot = api();
  for (const body of ['{', '{}', JSON.stringify({ pid: 12, token: A, boot_id: 'bad' })]) {
    fs.writeFileSync(f.file, body);
    assert.equal(boot.reclaimLock(f, { bootId: () => B, processState: () => 'dead' }), false);
    assert.equal(fs.readFileSync(f.file, 'utf8'), body);
  }
  const body = JSON.stringify({ pid: process.pid, token: A, boot_id: A }); fs.writeFileSync(f.file, body);
  fs.writeFileSync(`${f.file}.reclaim-${B}`, 'interrupted');
  assert.equal(boot.reclaimLock(f, { bootId: () => B }), false);
  assert.equal(fs.readFileSync(f.file, 'utf8'), body);
  fs.unlinkSync(f.file); fs.symlinkSync(f.receiptDirectory, f.file, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => boot.reclaimLock(f, { bootId: () => B }), /unsafe|symlink/);
});
test('malformed optional startup identity never permits lock reclamation', t => {
  const f = fixture(t), boot = api();
  const valid = { pid: process.pid, start_time: '123', executable: process.execPath, argv: [process.execPath] };
  for (const identity of [{}, 'broken', { ...valid, pid: process.pid + 1 }, { ...valid, start_time: '' },
    { ...valid, argv: [''] }, { ...valid, executable: 'relative' }, { ...valid, extra: 'unknown' }]) {
    const body = JSON.stringify({ pid: process.pid, token: A, boot_id: A, identity }); fs.writeFileSync(f.file, body);
    assert.equal(boot.reclaimLock(f, { bootId: () => B, processState: () => 'dead' }), false);
    assert.equal(fs.readFileSync(f.file, 'utf8'), body);
  }
});
test('real concurrent old-boot reclaim has at most one winner', async t => {
  const f = fixture(t); api(); fs.writeFileSync(f.file, JSON.stringify({ pid: process.pid, token: A, boot_id: A }));
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', 'const b=require(process.argv[1]);const f=JSON.parse(process.argv[2]);process.stdout.write(String(b.reclaimLock(f,{bootId:()=>process.argv[3]})))', entry, JSON.stringify(f), B], { windowsHide: true });
    let out = ''; child.stdout.on('data', data => { out += data; }); child.once('error', reject); child.once('close', code => resolve({ code, out }));
  });
  const results = await Promise.all([run(), run(), run(), run()]);
  assert.equal(results.filter(r => r.code === 0 && r.out === 'true').length, 1, JSON.stringify(results));
  assert.ok(results.every(r => r.code === 0), JSON.stringify(results));
});
test('first receipt directory parent is flushed before reclaim unlinks its source', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t), boot = api(), body = JSON.stringify({ pid: process.pid, token: A, boot_id: A });
  fs.writeFileSync(f.file, body, { mode: 0o600 });
  const parent = fs.statSync(path.dirname(f.receiptDirectory)), originalSync = fs.fsyncSync, originalUnlink = fs.unlinkSync;
  let parentFlushed = false, flushedBeforeUnlink = false;
  try {
    fs.fsyncSync = fd => { const stat = fs.fstatSync(fd); const result = originalSync(fd);
      if (stat.dev === parent.dev && stat.ino === parent.ino) parentFlushed = true; return result; };
    fs.unlinkSync = file => { if (file === f.file) flushedBeforeUnlink = parentFlushed; return originalUnlink(file); };
    assert.equal(boot.reclaimLock(f, { bootId: () => B }), true);
  } finally { fs.fsyncSync = originalSync; fs.unlinkSync = originalUnlink; }
  assert.equal(flushedBeforeUnlink, true, 'receipt directory link must be durable before deleting the original lock');
  const receipt = JSON.parse(fs.readFileSync(path.join(f.receiptDirectory, fs.readdirSync(f.receiptDirectory)[0])));
  assert.equal(receipt.source_bytes, body);
});
test('receipt-parent fsync failure preserves the exact original lock for retry', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t), boot = api(), body = JSON.stringify({ pid: process.pid, token: A, boot_id: A });
  fs.writeFileSync(f.file, body, { mode: 0o600 });
  const before = fs.statSync(f.file), parent = fs.statSync(path.dirname(f.receiptDirectory)), originalSync = fs.fsyncSync;
  try {
    fs.fsyncSync = fd => { const stat = fs.fstatSync(fd);
      if (stat.dev === parent.dev && stat.ino === parent.ino) throw new Error('fixture_parent_sync_failure'); return originalSync(fd); };
    assert.throws(() => boot.reclaimLock(f, { bootId: () => B }), /fixture_parent_sync_failure/);
  } finally { fs.fsyncSync = originalSync; }
  assert.equal(fs.existsSync(f.file), true, 'failed receipt durability must not delete source');
  assert.equal(fs.readFileSync(f.file, 'utf8'), body); assert.equal(fs.statSync(f.file).ino, before.ino);
  assert.equal(boot.reclaimLock(f, { bootId: () => B }), true);
});
