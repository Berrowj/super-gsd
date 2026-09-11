'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { registerRun, readRun } = require('./global-store.cjs');
function fixture(t) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-lineage-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const root = path.join(tmp, 'root'), projectDir = path.join(tmp, 'project'), other = path.join(tmp, 'other');
  for (const dir of [projectDir, other]) fs.mkdirSync(path.join(dir, '.planning'), { recursive: true });
  const prior = registerRun({ root, projectDir });
  const recovery = { recovery_id: 'recovery-11111111-1111-4111-8111-111111111111', previous_run_id: prior.run_id,
    context_refs: [{ path: '.planning/STATE.md', sha256: 'a'.repeat(64), bytes: 15 }] };
  return { root, projectDir, other, prior, recovery };
}
test('registered recovery carries immutable exact-project prior-run lineage', t => {
  const f = fixture(t), next = registerRun({ root: f.root, projectDir: f.projectDir, recovery: f.recovery });
  assert.deepEqual(readRun(f.root, next.run_id).recovery, f.recovery);
  assert.notEqual(next.run_id, f.prior.run_id);
});
test('recovery rejects cross-project, unregistered, non-orchestrator and unsafe reference lineage', t => {
  const f = fixture(t);
  assert.throws(() => registerRun({ root: f.root, projectDir: f.other, recovery: f.recovery }), /invalid_recovery_lineage/);
  for (const recovery of [{ ...f.recovery, previous_run_id: 'sgsd-00000000-0000-0000-0000-000000000000' },
    { ...f.recovery, context_refs: [{ path: '../../auth.json', sha256: 'a'.repeat(64), bytes: 1 }] },
    { ...f.recovery, prompt: 'must not persist' }]) {
    assert.throws(() => registerRun({ root: f.root, projectDir: f.projectDir, recovery }), /invalid_recovery_lineage/);
  }
  assert.throws(() => registerRun({ root: f.root, projectDir: f.projectDir, role: 'executor', provider: 'openai', recovery: f.recovery }), /invalid_recovery_lineage/);
});
test('recovery registration bytes are flushed before publication of its new run ID', t => {
  const f = fixture(t), sync = fs.fsyncSync, observed = [];
  let next;
  try {
    fs.fsyncSync = fd => { const s = fs.fstatSync(fd); observed.push({ dev: s.dev, ino: s.ino }); return sync(fd); };
    next = registerRun({ root: f.root, projectDir: f.projectDir, recovery: f.recovery });
  } finally { fs.fsyncSync = sync; }
  const registration = fs.statSync(path.join(next.state_dir, 'registration.json'));
  assert.ok(observed.some(row => row.dev === registration.dev && row.ino === registration.ino), 'registration file must be fsynced');
  if (process.platform !== 'win32') {
    const parent = fs.statSync(next.state_dir);
    assert.ok(observed.some(row => row.dev === parent.dev && row.ino === parent.ino), 'registration directory must be fsynced');
  }
});
test('a malformed predecessor registration cannot be promoted into valid recovery lineage', t => {
  const f = fixture(t), file = path.join(f.prior.state_dir, 'registration.json'), original = JSON.parse(fs.readFileSync(file));
  for (const corrupted of [{ ...original, schema_version: 999 }, { ...original, registered_at: 'not-a-time' },
    { ...original, recovery: { prompt: 'invalid-private-field' } }]) {
    fs.writeFileSync(file, JSON.stringify(corrupted));
    assert.equal(readRun(f.root, f.prior.run_id), null);
    assert.throws(() => registerRun({ root: f.root, projectDir: f.projectDir, recovery: f.recovery }), /invalid_recovery_lineage/);
  }
});
