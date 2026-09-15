'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const runner = path.join(__dirname, 'run.cjs'), control = path.join(__dirname, 'control.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sgsd-worker 'fixture'-"));
  const children = [], childPidFiles = [];
  t.after(async () => {
    for (const child of children) if (child.exitCode === null) child.kill(); await delay(150);
    for (const file of childPidFiles) if (fs.existsSync(file)) { try { process.kill(Number(fs.readFileSync(file, 'utf8'))); } catch {} }
    fs.rmSync(root, { recursive: true, force: true });
  });
  const projects = ['alpha', 'beta'].map(name => { const dir = path.join(root, name); fs.mkdirSync(path.join(dir, '.planning'), { recursive: true }); return dir; });
  return { root, projects, children, childPidFiles };
}
function start(f, project, mode = 'question', extra = [], holdPromptOpen = false, atlas = {}) {
  assert.ok(fs.existsSync(runner), 'worker adapter must exist');
  const capture = path.join(f.root, `${mode}-${f.children.length}.jsonl`);
  const childPidFile = capture + '.child'; f.childPidFiles.push(childPidFile);
  const child = spawn(process.execPath, [runner, '--project', project, '--model', 'gpt-6-astra', '--reasoning', 'max', '--timeout', '8', ...extra],
    { windowsHide: true, env: { ...process.env, SGSD_CODEX_APP_SERVER_COMMAND: process.execPath,
      SGSD_CODEX_APP_SERVER_ARGS: JSON.stringify([path.join(__dirname, 'fixtures/app-server.cjs')]), WORKER_FIXTURE_MODE: mode,
      WORKER_FIXTURE_CAPTURE: capture, WORKER_FIXTURE_CHILD_PID_FILE: childPidFile, SGSD_ATLAS_DISABLED: '1',
      SGSD_RUN_ID: '', SGSD_ATLAS_GLOBAL_ROOT: path.join(f.root, 'atlas-disabled'), SGSD_ATLAS_STATE_DIR: '',
      SGSD_WORKER_OWNER: 'orchestrator', CODEX_HOME: path.join(f.root, 'codex-home'), ...atlas } });
  f.children.push(child); let stdout = '', stderr = '';
  child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
  const completed = new Promise(resolve => child.on('close', code => resolve({ code, stdout, stderr })));
  if (holdPromptOpen) child.stdin.write('PRIVATE_WORKER_PROMPT no telemetry persistence');
  else child.stdin.end('PRIVATE_WORKER_PROMPT no telemetry persistence');
  return { child, completed, capture, childPidFile };
}
function command(project, action, args = [], owner = 'orchestrator') {
  const ownerArgs = owner === null || !['reply', 'steer', 'stop'].includes(action) ? [] : ['--owner', owner];
  return spawnSync(process.execPath, [control, action, '--project', project, ...args, ...ownerArgs], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
}
async function state(project, predicate) {
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    const response = command(project, 'status');
    if (response.status === 0) { const result = JSON.parse(response.stdout).workers.find(predicate); if (result) return result; }
    await delay(50);
  }
  assert.fail('expected worker state was not reached');
}
test('two project workers receive only their own live answers and preserve explicit routing', async t => {
  const f = fixture(t), a = start(f, f.projects[0]), b = start(f, f.projects[1]);
  const first = await state(f.projects[0], s => s.status === 'waiting_input');
  const second = await state(f.projects[1], s => s.status === 'waiting_input');
  assert.notEqual(first.worker_id, second.worker_id);
  assert.notEqual(command(f.projects[1], 'reply', ['--worker', first.worker_id, '--request', first.pending[0].id, '--text', 'wrong']).status, 0);
  for (const [project, row, answer] of [[f.projects[0], first, 'alpha answer'], [f.projects[1], second, 'beta answer']]) {
    assert.equal(command(project, 'reply', ['--worker', row.worker_id, '--request', row.pending[0].id, '--text', answer]).status, 0);
    assert.notEqual(command(project, 'reply', ['--worker', row.worker_id, '--request', row.pending[0].id, '--text', 'duplicate']).status, 0);
  }
  assert.deepEqual((await a.completed).stdout.trim(), 'alpha answer');
  assert.deepEqual((await b.completed).stdout.trim(), 'beta answer');
  const messages = fs.readFileSync(a.capture, 'utf8').trim().split('\n').map(JSON.parse);
  const thread = messages.find(m => m.method === 'thread/start');
  assert.equal(thread.params.model, 'gpt-6-astra'); assert.equal(thread.params.allowProviderModelFallback, false);
  assert.equal(messages.find(m => m.method === 'turn/start').params.effort, 'max');
  const persisted = fs.readFileSync(path.join(f.projects[0], '.planning', 'worker-sessions', first.worker_id, 'state.json'), 'utf8');
  assert.doesNotMatch(persisted, /PRIVATE_WORKER_PROMPT/);
});
test('native user-input request can be answered by the supervisor', async t => {
  const f = fixture(t), w = start(f, f.projects[0], 'native');
  const row = await state(f.projects[0], s => s.status === 'waiting_input');
  assert.equal(command(f.projects[0], 'reply', ['--worker', row.worker_id, '--request', row.pending[0].id, '--text', 'native answer']).status, 0);
  const result = await w.completed; assert.equal(result.code, 0, result.stderr); assert.equal(result.stdout.trim(), 'native answer');
});

test('multiple native questions retain options and require answers for each question', async t => {
  const f = fixture(t), w = start(f, f.projects[0], 'multi-input');
  const row = await state(f.projects[0], s => s.status === 'waiting_input');
  assert.equal(row.pending[0].questions[0].options[0].label, 'Tests');
  const target = ['--worker', row.worker_id, '--request', row.pending[0].id];
  assert.notEqual(command(f.projects[0], 'reply', [...target, '--text', 'ambiguous answer']).status, 0);
  assert.notEqual(command(f.projects[0], 'reply', [...target, '--answers-json', JSON.stringify({ q1: 'Tests' })]).status, 0);
  assert.equal(command(f.projects[0], 'reply', [...target, '--answers-json', JSON.stringify({ q1: 'Tests', q2: 'alpha' })]).status, 0);
  const result = await w.completed; assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), { q1: { answers: ['Tests'] }, q2: { answers: ['alpha'] } });
});

test('stale control messages are visibly rejected and cannot steer a different turn', async t => {
  const f = fixture(t), w = start(f, f.projects[0], 'wait');
  const row = await state(f.projects[0], s => s.status === 'running' && s.turn_id);
  const id = require('node:crypto').randomUUID();
  const bad = { id, worker_id: row.worker_id, instance: row.instance, thread_id: row.thread_id,
    turn_id: 'not-the-active-turn', action: 'steer', text: 'must not reach model' };
  fs.writeFileSync(path.join(f.projects[0], '.planning/worker-sessions', row.worker_id, 'commands', id + '.json'), JSON.stringify(bad));
  const updated = await state(f.projects[0], s => s.control_results?.some(c => c.id === id));
  assert.equal(updated.control_results.find(c => c.id === id).status, 'rejected');
  const receipt = command(f.projects[0], 'receipt', ['--worker', row.worker_id, '--command', id]);
  assert.equal(JSON.parse(receipt.stdout).status, 'rejected');
  command(f.projects[0], 'stop', ['--worker', row.worker_id]); assert.notEqual((await w.completed).code, 0);
});
test('steering and stop target the exact active turn', async t => {
  const f = fixture(t), w = start(f, f.projects[0], 'wait');
  const row = await state(f.projects[0], s => s.status === 'running' && s.turn_id);
  assert.equal(command(f.projects[0], 'steer', ['--worker', row.worker_id, '--text', 'new direction']).status, 0);
  assert.equal((await w.completed).stdout.trim(), 'new direction');
  const stop = start(f, f.projects[0], 'wait');
  const active = await state(f.projects[0], s => s.status === 'running' && s.worker_id !== row.worker_id && s.turn_id);
  assert.equal(command(f.projects[0], 'stop', ['--worker', active.worker_id]).status, 0);
  assert.notEqual((await stop.completed).code, 0);
});
test('exact owned identity rejects dead and PID-reused workers while unrelated workers remain live', async t => {
  const f = fixture(t), owned = start(f, f.projects[0], 'wait'), unrelated = start(f, f.projects[0], 'wait');
  const target = await state(f.projects[0], s => s.status === 'running' && s.turn_id && s.pid === owned.child.pid);
  const other = await state(f.projects[0], s => s.status === 'running' && s.turn_id && s.worker_id !== target.worker_id);
  assert.equal(target.pid, owned.child.pid);
  assert.equal(typeof target.start_time, 'string'); assert.equal(typeof target.executable, 'string'); assert.ok(Array.isArray(target.argv));
  owned.child.kill('SIGKILL'); await owned.completed;
  const dead = JSON.parse(command(f.projects[0], 'status').stdout).workers.find(s => s.worker_id === target.worker_id);
  const live = JSON.parse(command(f.projects[0], 'status').stdout).workers.find(s => s.worker_id === other.worker_id);
  assert.equal(dead.status, 'orphaned'); assert.equal(dead.liveness_observation.state, 'dead');
  assert.equal(live.status, 'running'); assert.equal(live.liveness_observation.state, 'live');
  const mailbox = require('./mailbox.cjs'), reused = mailbox.read(f.projects[0], target.worker_id);
  reused.pid = other.pid; reused.start_time = '0'; mailbox.save(reused);
  const mismatch = JSON.parse(command(f.projects[0], 'status').stdout).workers.find(s => s.worker_id === target.worker_id);
  const stillLive = JSON.parse(command(f.projects[0], 'status').stdout).workers.find(s => s.worker_id === other.worker_id);
  assert.equal(mismatch.status, 'orphaned'); assert.equal(mismatch.liveness_observation.state, 'identity_mismatch');
  assert.equal(stillLive.status, 'running'); assert.equal(stillLive.liveness_observation.state, 'live');
  command(f.projects[0], 'stop', ['--worker', other.worker_id]); await unrelated.completed;
});
test('legacy records without identity keep PID-only liveness and report unknown identity', async t => {
  const f = fixture(t), mailbox = require('./mailbox.cjs'), record = mailbox.create(f.projects[0]);
  record.status = 'running'; record.thread_id = 'legacy-thread'; record.turn_id = 'legacy-turn';
  delete record.start_time; delete record.executable; delete record.argv;
  mailbox.save(record);

  const listed = JSON.parse(command(f.projects[0], 'status').stdout).workers.find(row => row.worker_id === record.worker_id);
  assert.equal(listed.status, 'running');
  assert.deepEqual(listed.liveness_observation, { state: 'unknown', reason: 'missing_identity' });
  const accepted = JSON.parse(command(f.projects[0], 'steer', ['--worker', record.worker_id, '--text', 'legacy direction'], null).stdout);
  assert.equal(accepted.queued, true);

  record.pid = 999999; mailbox.save(record);
  const dead = JSON.parse(command(f.projects[0], 'status').stdout).workers.find(row => row.worker_id === record.worker_id);
  assert.equal(dead.status, 'orphaned');
  assert.deepEqual(dead.liveness_observation, { state: 'unknown', reason: 'missing_identity' });

  record.pid = process.pid; record.start_time = '0'; record.executable = process.execPath; record.argv = ['reused-pid']; mailbox.save(record);
  const reused = JSON.parse(command(f.projects[0], 'status').stdout).workers.find(row => row.worker_id === record.worker_id);
  assert.equal(reused.status, 'orphaned'); assert.equal(reused.liveness_observation.state, 'identity_mismatch');
  const rejected = command(f.projects[0], 'steer', ['--worker', record.worker_id, '--text', 'must not queue'], null);
  assert.notEqual(rejected.status, 0); assert.match(rejected.stderr, /worker_not_active/);
});
test('owner-scoped control and inherited fan-out are enforced by the real mailbox path', async t => {
  const f = fixture(t), owner = 'owner-a', worker = start(f, f.projects[0], 'question', ['--owner', owner], false,
    { SGSD_WORKER_FANOUT_LIMIT: '1' });
  const row = await state(f.projects[0], s => s.status === 'waiting_input' && s.owner === owner);
  assert.equal(row.fanout_limit, 1);
  const target = ['--worker', row.worker_id, '--request', row.pending[0].id, '--text', 'answer'];
  const missing = JSON.parse(command(f.projects[0], 'reply', target, null).stdout);
  const wrong = JSON.parse(command(f.projects[0], 'steer', ['--worker', row.worker_id, '--text', 'wrong owner'], 'owner-b').stdout);
  const stopped = JSON.parse(command(f.projects[0], 'stop', ['--worker', row.worker_id], null).stdout);
  for (const rejected of [missing, wrong, stopped]) {
    assert.equal(rejected.queued, false); assert.equal(rejected.status, 'rejected');
    const receipt = JSON.parse(command(f.projects[0], 'receipt', ['--worker', row.worker_id, '--command', rejected.command_id], null).stdout);
    assert.equal(receipt.status, 'rejected'); assert.match(receipt.reason, /^worker_owner_(required|mismatch)$/);
  }
  assert.equal((await start(f, f.projects[0], 'complete', ['--owner', owner], false, { SGSD_WORKER_FANOUT_LIMIT: '1' }).completed).code, 1);
  const differentOwner = await start(f, f.projects[0], 'complete', ['--owner', 'owner-b'], false, { SGSD_WORKER_FANOUT_LIMIT: '1' }).completed;
  assert.equal(differentOwner.code, 0, differentOwner.stderr);
  const approved = JSON.parse(command(f.projects[0], 'reply', target, owner).stdout);
  assert.equal((await worker.completed).stdout.trim(), 'answer');
  assert.equal(JSON.parse(command(f.projects[0], 'receipt', ['--worker', row.worker_id, '--command', approved.command_id], null).stdout).status, 'applied');
  const mailbox = require('./mailbox.cjs'), legacy = mailbox.create(f.projects[0]);
  legacy.status = 'running'; legacy.thread_id = 'legacy-thread'; legacy.turn_id = 'legacy-turn'; mailbox.save(legacy);
  const legacyControl = JSON.parse(command(f.projects[0], 'steer', ['--worker', legacy.worker_id, '--text', 'legacy direction'], null).stdout);
  assert.equal(legacyControl.queued, true);
});
test('concurrent creates cannot exceed the inherited fan-out limit', async t => {
  const f = fixture(t), mailbox = require('./mailbox.cjs'), project = f.projects[0];
  const owner = 'fanout-owner', workspace = fs.realpathSync(project), limit = 2;
  // Keep inventory work nontrivial so the pre-lock implementation reliably
  // exposes its check-then-publish race across the real child processes.
  for (let i = 0; i < 128; i++) {
    const historical = mailbox.create(project);
    historical.status = 'completed'; mailbox.save(historical);
  }
  const attempts = Array.from({ length: limit + 2 }, () => start(f, project, 'wait', ['--owner', owner], false,
    { SGSD_WORKER_FANOUT_LIMIT: String(limit) }));
  const until = async predicate => {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline) { const value = predicate(); if (value) return value; await delay(25); }
    assert.fail('expected concurrent worker outcome was not reached');
  };
  const active = await until(() => {
    const rows = mailbox.list(project).filter(row => mailbox.isLive(row) && row.owner === owner && row.workspace === workspace);
    return rows.length >= limit ? rows : null;
  });
  await until(() => attempts.filter(attempt => attempt.child.exitCode !== null).length === attempts.length - limit);
  const failed = await Promise.all(attempts.filter(attempt => attempt.child.exitCode !== null).map(attempt => attempt.completed));
  assert.equal(active.length, limit);
  for (const result of failed) { assert.notEqual(result.code, 0); assert.match(result.stderr, /worker_fanout_limit/); }
  for (const row of active) assert.equal(command(project, 'stop', ['--worker', row.worker_id], owner).status, 0);
  await Promise.all(attempts.filter(attempt => attempt.child.exitCode === null).map(attempt => attempt.completed));

  const staleOwner = 'stale-lock-owner', staleLock = mailbox.fanoutLockPath(project, { owner: staleOwner, workspace });
  fs.writeFileSync(staleLock, JSON.stringify({ lock_id: mailbox.uid(), pid: 999999, start_time: '1', executable: 'dead', argv: ['dead'],
    created_at: new Date(Date.now() - 61000).toISOString() }) + '\n', { mode: 0o600 });
  const reclaimed = mailbox.create(project, { owner: staleOwner, workspace, fanout_limit: limit });
  assert.equal(fs.existsSync(staleLock), false, 'a dead creator lock is reclaimed');
  reclaimed.status = 'completed'; mailbox.save(reclaimed);

  const liveOwner = 'live-lock-owner', liveLock = mailbox.fanoutLockPath(project, { owner: liveOwner, workspace });
  const liveIdentity = require('../telemetry-atlas/lifecycle.cjs').processIdentity(process.pid);
  assert.ok(liveIdentity);
  const lockId = mailbox.uid();
  fs.writeFileSync(liveLock, JSON.stringify({ lock_id: lockId, ...liveIdentity, created_at: new Date().toISOString() }) + '\n', { mode: 0o600 });
  const now = Date.now, base = now(); let calls = 0;
  Date.now = () => calls++ === 0 ? base : base + 60000;
  try {
    assert.throws(() => mailbox.create(project, { owner: liveOwner, workspace, fanout_limit: limit }), /worker_fanout_lock_timeout/);
  } finally { Date.now = now; }
  assert.equal(JSON.parse(fs.readFileSync(liveLock, 'utf8')).lock_id, lockId, 'a live creator lock is not reclaimed');
  fs.unlinkSync(liveLock);
});
test('delivery observation keeps process outcome report validity observed delivery and independent verification separate', async t => {
  const f = fixture(t), worker = start(f, f.projects[0], 'complete');
  assert.equal((await worker.completed).code, 0);
  const row = await state(f.projects[0], s => s.status === 'completed');
  const mailbox = require('./mailbox.cjs'), record = mailbox.read(f.projects[0], row.worker_id);
  assert.deepEqual(Object.keys(record.delivery_observation).sort(), [
    'independent_verification', 'observed_delivery', 'process_outcome', 'report_validity', 'schema_version',
  ]);
  assert.equal(record.delivery_observation.schema_version, 1);
  assert.equal(record.delivery_observation.process_outcome.state, 'succeeded');
  assert.equal(record.delivery_observation.report_validity.state, 'valid');
  assert.deepEqual(record.delivery_observation.observed_delivery, {
    state: 'observed', worker_id: record.worker_id, instance: record.instance,
    thread_id: record.thread_id, turn_id: record.turn_id, bytes: Buffer.byteLength('completed fixture'),
    sha256: require('node:crypto').createHash('sha256').update('completed fixture', 'utf8').digest('hex'),
    observed_at: record.delivery_observation.observed_delivery.observed_at,
  });
  assert.match(record.delivery_observation.observed_delivery.observed_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(record.delivery_observation.independent_verification.state, 'not_run');
  mailbox.setIndependentVerification(record, 'verified'); mailbox.save(record);
  const status = JSON.parse(command(f.projects[0], 'status').stdout).workers.find(s => s.worker_id === row.worker_id);
  assert.equal(status.delivery_observation.independent_verification.state, 'verified');
  assert.equal(status.delivery_observation.process_outcome.state, 'succeeded');
  assert.equal(status.delivery_observation.report_validity.state, 'valid');
});
test('empty malformed and unacknowledged reports never complete while nonzero exit preserves delivery evidence', async t => {
  const f = fixture(t), mailbox = require('./mailbox.cjs');
  for (const mode of ['empty', 'invalid-json', 'early-cross-turn']) {
    const worker = start(f, f.projects[0], mode);
    const result = await worker.completed; assert.notEqual(result.code, 0, mode);
    const record = mailbox.list(f.projects[0]).find(row => row.pid === worker.child.pid);
    assert.notEqual(record.status, 'completed', mode);
    assert.equal(record.delivery_observation.process_outcome.state, 'failed', mode);
    assert.equal(record.delivery_observation.report_validity.state, 'invalid', mode);
    if (mode === 'invalid-json') assert.equal(record.delivery_observation.observed_delivery.state, 'not_run');
    else {
      assert.equal(record.delivery_observation.observed_delivery.state, 'observed', mode);
      assert.equal(record.delivery_observation.observed_delivery.worker_id, record.worker_id, mode);
      assert.equal(record.delivery_observation.observed_delivery.instance, record.instance, mode);
    }
  }
  const failed = start(f, f.projects[1], 'fail');
  assert.notEqual((await failed.completed).code, 0);
  const record = mailbox.list(f.projects[1]).find(row => row.pid === failed.child.pid);
  assert.equal(record.delivery_observation.process_outcome.state, 'failed');
  assert.equal(record.delivery_observation.report_validity.state, 'invalid');
  assert.equal(record.delivery_observation.observed_delivery.state, 'observed');
  assert.equal(record.delivery_observation.observed_delivery.bytes, Buffer.byteLength('NOT A SUCCESS'));
  assert.match(record.delivery_observation.observed_delivery.sha256, /^[a-f0-9]{64}$/);
});
test('retained continuation binds its exact owned instance and result', async t => {
  const f = fixture(t), mailbox = require('./mailbox.cjs'), initial = start(f, f.projects[0], 'complete');
  assert.equal((await initial.completed).code, 0);
  const original = await state(f.projects[0], s => s.status === 'completed');
  const resumed = start(f, f.projects[0], 'complete', ['--resume-worker', original.worker_id]);
  assert.equal((await resumed.completed).code, 0);
  const continuation = mailbox.list(f.projects[0]).find(row => row.resumed_from === original.worker_id);
  assert.ok(continuation);
  assert.equal(continuation.thread_id, original.thread_id);
  assert.notEqual(continuation.worker_id, original.worker_id);
  assert.notEqual(continuation.instance, original.instance);
  assert.deepEqual(continuation.delivery_observation.observed_delivery, {
    state: 'observed', worker_id: continuation.worker_id, instance: continuation.instance,
    thread_id: continuation.thread_id, turn_id: continuation.turn_id, bytes: Buffer.byteLength('completed fixture'),
    sha256: require('node:crypto').createHash('sha256').update('completed fixture', 'utf8').digest('hex'),
    observed_at: continuation.delivery_observation.observed_delivery.observed_at,
  });
  assert.equal(continuation.delivery_observation.process_outcome.state, 'succeeded');
  assert.equal(continuation.delivery_observation.report_validity.state, 'valid');
});
test('failures, disconnects, oversized frames and permission requests never return successful reports', async t => {
  const f = fixture(t);
  for (const mode of ['fail', 'crash', 'oversize', 'approval', 'wait', 'invalid-json', 'empty', 'wrong-model', 'wrong-sandbox']) {
    const w = start(f, f.projects[0], mode, ['--timeout', '1']);
    const result = await w.completed; assert.notEqual(result.code, 0, mode); assert.equal(result.stdout, '', mode);
  }
});

test('recorded threads cannot be resumed concurrently through different historical worker IDs', async t => {
  const f = fixture(t), first = start(f, f.projects[0], 'complete');
  assert.equal((await first.completed).code, 0);
  const old = await state(f.projects[0], s => s.status === 'completed');
  const active = start(f, f.projects[0], 'wait', ['--resume-worker', old.worker_id]);
  const current = await state(f.projects[0], s => s.resumed_from === old.worker_id && s.status === 'running');
  const competing = start(f, f.projects[0], 'complete', ['--resume-worker', old.worker_id]);
  const result = await competing.completed; assert.notEqual(result.code, 0); assert.equal(result.stdout, '');
  command(f.projects[0], 'stop', ['--worker', current.worker_id]); assert.notEqual((await active.completed).code, 0);
});
test('explicit resume uses the recorded thread and refuses cross-project lookup', async t => {
  const f = fixture(t), first = start(f, f.projects[0], 'complete');
  assert.equal((await first.completed).code, 0);
  const row = await state(f.projects[0], s => s.status === 'completed');
  const resumed = start(f, f.projects[0], 'complete', ['--resume-worker', row.worker_id]);
  assert.equal((await resumed.completed).code, 0);
  const messages = fs.readFileSync(resumed.capture, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(messages.find(m => m.method === 'thread/resume').params.threadId, row.thread_id);
  assert.equal(messages.some(m => m.method === 'thread/start'), false);
  assert.notEqual((await start(f, f.projects[1], 'complete', ['--resume-worker', row.worker_id]).completed).code, 0);
});

for (const mode of ['child', 'delayed-child']) test(`stopping an adapter cleans up its owned App Server process tree (${mode})`, async t => {
  const f = fixture(t), w = start(f, f.projects[0], mode);
  // The turn/start reply can arrive before the fixture publishes its child PID.
  let pid;
  const row = await state(f.projects[0], s => {
    if (s.status !== 'running' || !s.turn_id || !fs.existsSync(w.childPidFile)) return false;
    pid = Number(fs.readFileSync(w.childPidFile, 'utf8'));
    return Number.isSafeInteger(pid) && pid > 0;
  });
  assert.ok(require('./mailbox.cjs').alive(pid));
  command(f.projects[0], 'stop', ['--worker', row.worker_id]); await w.completed;
  await delay(200);
  assert.equal(require('./mailbox.cjs').alive(pid), false);
});

test('workspace identity accepts contained or linked worktrees and rejects unrelated roots', t => {
  const f = fixture(t), mailbox = require('./mailbox.cjs'), project = f.projects[0];
  const nested = path.join(project, 'src'); fs.mkdirSync(nested);
  assert.equal(mailbox.workspaceRoot(project, nested), fs.realpathSync(nested));
  assert.throws(() => mailbox.workspaceRoot(project, f.projects[1]), /not_linked/);
  const fixtureGit = process.platform === 'linux' && fs.existsSync('/usr/bin/git') ? '/usr/bin/git' : 'git';
  const git = args => { const r = spawnSync(fixtureGit, ['-C', project, '-c', 'core.hooksPath=' + path.join(f.root, 'no-hooks'), ...args], { encoding: 'utf8', windowsHide: true, timeout: 10000 }); assert.equal(r.status, 0, r.stderr); };
  git(['init']); git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'fixture']);
  const linked = path.join(f.root, 'linked'); git(['worktree', 'add', '--detach', linked]);
  assert.equal(mailbox.workspaceRoot(project, linked), fs.realpathSync(linked));
  const opts = require('./run.cjs').options(['--project', project, '--workspace', linked]); assert.equal(opts.workspace, linked);
});

test('worker creation publishes a complete record before inventory can discover it', t => {
  const f = fixture(t), mailbox = require('./mailbox.cjs'), project = f.projects[0];
  const mkdir = fs.mkdirSync; let duringCreate;
  fs.mkdirSync = (file, ...args) => {
    const result = mkdir.call(fs, file, ...args);
    if (path.basename(file) === 'commands') duringCreate = mailbox.list(project);
    return result;
  };
  let record;
  try { record = mailbox.create(project); } finally { fs.mkdirSync = mkdir; }
  assert.deepEqual(duringCreate, []);
  assert.deepEqual(mailbox.list(project).map(row => row.worker_id), [record.worker_id]);
  fs.writeFileSync(path.join(project, '.planning/worker-sessions', record.worker_id, 'state.json'), '{invalid');
  assert.throws(() => mailbox.list(project), SyntaxError, 'corrupt published records still fail visibly');
});

test('deadline bounds an input stream that never reaches EOF without starting a provider', async t => {
  const f = fixture(t), w = start(f, f.projects[0], 'complete', ['--timeout', '1'], true);
  const result = await Promise.race([w.completed, delay(3500).then(() => ({ code: null, stdout: '' }))]);
  assert.equal(result.code, 124); assert.equal(result.stdout, '');
  assert.match(result.stderr, /worker_timeout/);
  assert.equal(fs.existsSync(w.capture), false, 'prompt collection must not start an App Server');
});

test('Windows Codex shim resolution preserves argument boundaries without a shell', t => {
  const f = fixture(t), rpc = require('./rpc.cjs');
  assert.equal(typeof rpc.resolveCommand, 'function');
  assert.throws(() => rpc.resolveCommand('codex.cmd', [], { platform: 'win32', env: {} }), /native.*required/);
  const appdata = path.join(f.root, 'App Data'), launcher = path.join(appdata, 'npm/node_modules/@openai/codex/bin/codex.js');
  fs.mkdirSync(path.dirname(launcher), { recursive: true }); fs.writeFileSync(launcher, '// fixture');
  assert.deepEqual(rpc.resolveCommand('codex', [], { platform: 'win32', env: { APPDATA: appdata, PATH: '' } }), { command: process.execPath, prefix: [launcher] });
});

test('authentication failures remain classifiable without leaking provider diagnostics', async t => {
  const f = fixture(t), result = await start(f, f.projects[0], 'auth').completed;
  assert.notEqual(result.code, 0); assert.match(result.stderr, /worker_authentication_required/);
  assert.doesNotMatch(result.stderr, /PRIVATE_PROVIDER_DIAGNOSTIC/); assert.equal(result.stdout, '');
});

test('unexpected new turns cannot inherit an earlier turn report', async t => {
  const f = fixture(t);
  for (const mode of ['cross-turn', 'early-cross-turn']) {
    const result = await start(f, f.projects[0], mode).completed;
    assert.notEqual(result.code, 0, mode); assert.equal(result.stdout, '', mode);
  }
});

test('receipts remain truthful for the full permitted control history', t => {
  const f = fixture(t), mailbox = require('./mailbox.cjs');
  const record = mailbox.create(f.projects[0]); record.status = 'running'; record.thread_id = 'thread'; record.turn_id = 'turn'; mailbox.save(record);
  let first;
  for (let i = 0; i < 128; i++) {
    const c = mailbox.submit(f.projects[0], record.worker_id, 'steer', { text: 'direction' }); first ||= c.command_id;
    mailbox.result(record, { id: c.command_id, action: 'steer' }, 'applied');
  }
  assert.equal(mailbox.receipt(f.projects[0], record.worker_id, first).status, 'applied');
});

test('Windows transient rename contention preserves an atomic complete worker record', { skip: process.platform !== 'win32' }, t => {
  const f = fixture(t), mailbox = require('./mailbox.cjs'), record = mailbox.create(f.projects[0]);
  const original = fs.renameSync; let injected = false;
  fs.renameSync = (...args) => {
    if (!injected && args[1].endsWith('state.json')) { injected = true; const error = new Error('transient sharing contention'); error.code = 'EPERM'; throw error; }
    return original(...args);
  };
  try { record.status = 'running'; mailbox.save(record); }
  finally { fs.renameSync = original; }
  assert.ok(injected); assert.equal(mailbox.read(f.projects[0], record.worker_id).status, 'running');
});

test('explicit server rejection produces a rejected steering receipt', async t => {
  const f = fixture(t), w = start(f, f.projects[0], 'steer-reject');
  const row = await state(f.projects[0], s => s.status === 'running' && s.turn_id);
  const submitted = command(f.projects[0], 'steer', ['--worker', row.worker_id, '--text', 'direction']); assert.equal(submitted.status, 0);
  const id = JSON.parse(submitted.stdout).command_id; assert.notEqual((await w.completed).code, 0);
  const receipt = command(f.projects[0], 'receipt', ['--worker', row.worker_id, '--command', id]);
  assert.equal(JSON.parse(receipt.stdout).status, 'rejected');
});

test('local installed Codex App Server initializes without a model turn', { skip: process.env.SGSD_WORKER_LIVE_INIT !== '1' }, async t => {
  const { Rpc } = require('./rpc.cjs');
  const rpc = new Rpc('codex', ['app-server', '--listen', 'stdio://']);
  rpc.on('fault', () => {});
  try {
    const result = await rpc.request('initialize', { clientInfo: { name: 'sgsd-worker-probe', version: '1.0.0' }, capabilities: { experimentalApi: true } });
    assert.equal(typeof result.userAgent, 'string');
    rpc.send({ method: 'initialized', params: {} });
    t.diagnostic(result.userAgent);
  } finally { rpc.close(); }
});

function accounting(f, project, file = path.join(f.root, 'native-rollout.jsonl')) {
  const root = path.join(f.root, 'atlas');
  const run = require('../telemetry-atlas/global-store.cjs').registerRun({ root, projectDir: project, provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  return { run, env: { SGSD_ATLAS_DISABLED: '0', SGSD_ATLAS_GLOBAL_ROOT: root, SGSD_RUN_ID: run.run_id,
    SGSD_ATLAS_STATE_DIR: run.state_dir, WORKER_FIXTURE_ROLLOUT: file } };
}
function observations(run) {
  const dir = path.join(run.state_dir, 'quota-spool');
  return fs.existsSync(dir) ? fs.readdirSync(dir).map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))) : [];
}
function gaps(run) {
  const file = path.join(run.metrics_dir, 'sgsd-atlas-gaps.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
const linux = { skip: process.platform !== 'linux' };
test('adapter captures durable native responses through the real private spool and final report path', linux, async t => {
  const f = fixture(t), a = accounting(f, f.projects[0]);
  const result = await start(f, f.projects[0], 'usage-complete', [], false, a.env).completed;
  assert.equal(result.code, 0, result.stderr); assert.equal(result.stdout.trim(), 'usage fixture completed');
  const events = observations(a.run);
  assert.equal(events.length, 2, 'real adapter must capture both provider response records');
  assert.deepEqual(events.map(e => e.usage.input_tokens).sort((a,b) => a-b), [80, 100]);
  assert.ok(events.every(e => e.identity.request_id === null && e.runtime.codex_version === null));
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE_ROLLOUT_CANARY|PRIVATE_WORKER_PROMPT|77777|9000|70000/);
});
test('capture is periodic while waiting for a real control reply and does not replace that reply', linux, async t => {
  const f = fixture(t), a = accounting(f, f.projects[0]), w = start(f, f.projects[0], 'usage-question', [], false, a.env);
  const row = await state(f.projects[0], s => s.status === 'waiting_input');
  const end = Date.now() + 1500;
  while (!observations(a.run).length && Date.now() < end) await delay(25);
  assert.equal(observations(a.run).length, 1, 'capture cannot wait for the worker to finish');
  assert.equal(command(f.projects[0], 'reply', ['--worker', row.worker_id, '--request', row.pending[0].id, '--text', 'approved answer']).status, 0);
  assert.equal((await w.completed).stdout.trim(), 'approved answer');
});
test('completed native responses survive later worker failure, interruption, timeout and transport death', linux, async t => {
  for (const [mode, code] of [['usage-fail', 1], ['usage-interrupted', 130], ['usage-timeout', 124], ['usage-crash', 1]]) {
    const f = fixture(t), a = accounting(f, f.projects[0]);
    const result = await start(f, f.projects[0], mode, mode === 'usage-timeout' ? ['--timeout', '3'] : [], false, a.env).completed;
    assert.equal(result.code, code, result.stderr); assert.equal(result.stdout, '');
    assert.equal(observations(a.run).length, 1, mode);
  }
});
test('early and final-flush responses bind to the acknowledged turn; cold resume excludes all preopen history', linux, async t => {
  const f = fixture(t), a = accounting(f, f.projects[0]);
  assert.equal((await start(f, f.projects[0], 'usage-early', [], false, a.env).completed).code, 0);
  assert.equal(observations(a.run).length, 1);
  const old = await state(f.projects[0], s => s.status === 'completed');
  const b = accounting(f, f.projects[0]);
  assert.equal((await start(f, f.projects[0], 'usage-final', ['--resume-worker', old.worker_id], false, b.env).completed).code, 0);
  const events = observations(b.run); assert.equal(events.length, 1); assert.equal(events[0].identity.thread_id, old.thread_id);
  assert.notEqual(events[0].identity.turn_id, old.turn_id); assert.equal(events[0].usage.input_tokens, 100);
});
test('missing capture capability and absent usage degrade content-free without replacing worker success', linux, async t => {
  for (const mode of ['usage-none', 'usage-missing-path']) {
    const f = fixture(t), a = accounting(f, f.projects[0]);
    const result = await start(f, f.projects[0], mode, [], false, a.env).completed;
    assert.equal(result.code, 0, result.stderr); assert.equal(observations(a.run).length, 0);
    assert.match(gaps(a.run), /native_request_usage_unobserved/); assert.doesNotMatch(gaps(a.run), /PRIVATE_|native-rollout/);
  }
});
test('pre-ACK deadline keeps worker_timeout and exit 124 at every awaited RPC stage', async t => {
  for (const mode of ['hang-initialize', 'hang-thread', 'hang-turn']) {
    const f = fixture(t), before = Date.now(), result = await start(f, f.projects[0], mode, ['--timeout', '1']).completed;
    assert.equal(result.code, 124, `${mode}: ${result.stderr}`); assert.match(result.stderr, /worker_timeout/);
    assert.ok(Date.now() - before < 2500, 'cleanup must not extend the deadline by another RPC timeout');
    assert.equal((await state(f.projects[0], s => s.status === 'timed_out')).failure, 'worker_timeout');
  }
});
test('disabled native capture leaves registered evidence untouched', linux, async t => {
  const f = fixture(t), a = accounting(f, f.projects[0]);
  const result = await start(f, f.projects[0], 'usage-complete', [], false, { ...a.env, SGSD_ATLAS_DISABLED: '1' }).completed;
  assert.equal(result.code, 0); assert.equal(observations(a.run).length, 0); assert.equal(gaps(a.run), '');
});
test('real wrapper honors a disabled custom Atlas root without false native capture gaps', linux, async t => {
  const f = fixture(t), project = f.projects[0], atlasRoot = path.join(f.root, 'custom-atlas');
  const fixtureHome = path.join(f.root, 'home'), prompt = path.join(project, 'prompt'), report = path.join(project, 'report');
  const selectedEnvironment = path.join(f.root, 'peer-environment.json'), peer = path.join(f.root, 'peer.cjs');
  fs.mkdirSync(atlasRoot, { mode: 0o700 }); fs.mkdirSync(fixtureHome);
  fs.writeFileSync(path.join(atlasRoot, 'disabled'), 'fixture disabled marker\n', { mode: 0o600 });
  fs.writeFileSync(prompt, 'Isolated disabled Atlas wrapper fixture.\n');
  fs.writeFileSync(peer, `
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(selectedEnvironment)}, JSON.stringify({
  root: process.env.SGSD_ATLAS_GLOBAL_ROOT, run_id: process.env.SGSD_RUN_ID,
  disabled: process.env.SGSD_ATLAS_DISABLED
}));
require(${JSON.stringify(path.join(__dirname, 'fixtures/app-server.cjs'))});
`);
  const result = spawnSync('/bin/bash', [path.resolve(__dirname, '../../scripts/codex-executor.sh'),
    '--workspace', project, '--prompt-file', prompt, '--report-out', report, '--profile', 'executor', '--timeout', '10'],
  { cwd: project, encoding: 'utf8', timeout: 20000, env: { ...process.env,
    HOME: fixtureHome, USERPROFILE: fixtureHome, CODEX_HOME: path.join(f.root, 'codex-home'), OPENAI_API_KEY: '',
    PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`, NODE_OPTIONS: '', NODE_PATH: '', BASH_ENV: '', ENV: '',
    SGSD_CODEX_APP_SERVER_COMMAND: process.execPath, SGSD_CODEX_APP_SERVER_ARGS: JSON.stringify([peer]),
    SGSD_CODEX_COMMAND: path.join(f.root, 'no-provider-fallback'), SGSD_CODEX_FORCE_LAUNCHER: 'direct',
    SGSD_CODEX_EXECUTOR_REEXECED: '', SGSD_CODEX_EXECUTOR_ORIGINAL_SCRIPT_DIR: '', SGSD_WORKER_RESUME_ID: '',
    SGSD_WORKER_OWNER: 'disabled-root-fixture', SGSD_ATLAS_DISABLED: '0', SGSD_ATLAS_GLOBAL_ROOT: atlasRoot,
    SGSD_ATLAS_STATE_DIR: '', SGSD_RUN_ID: 'inherited-run-must-be-cleared',
    WORKER_FIXTURE_MODE: 'usage-complete', WORKER_FIXTURE_REPORT: 'disabled wrapper completed',
    WORKER_FIXTURE_CAPTURE: path.join(f.root, 'peer-frames.jsonl'), WORKER_FIXTURE_ROLLOUT: path.join(f.root, 'native-rollout.jsonl'),
  } });
  assert.equal(result.status, 0, JSON.stringify({ status: result.status, signal: result.signal, error: result.error?.message,
    stdout: result.stdout, stderr: result.stderr }));
  assert.equal(fs.readFileSync(report, 'utf8').trim(), 'disabled wrapper completed');
  assert.deepEqual(JSON.parse(fs.readFileSync(selectedEnvironment, 'utf8')),
    { root: atlasRoot, run_id: '', disabled: '0' }, 'prepare-off must clear only the active run, not the custom bootstrap root');
  assert.deepEqual(fs.readdirSync(atlasRoot), ['disabled'], 'disabled root must receive no native gaps, spool or run registrations');
  assert.equal(fs.readFileSync(path.join(atlasRoot, 'disabled'), 'utf8'), 'fixture disabled marker\n');
  const records = require('./mailbox.cjs').list(project); assert.equal(records.length, 1);
  const record = records[0]; assert.equal(record.status, 'completed'); assert.equal(record.atlas_run_id, null);
  assert.equal(record.usage_capture, undefined, 'prepare-off must not start native capture');
  const receipt = JSON.parse(fs.readFileSync(path.join(project, '.planning/worker-sessions', record.worker_id, 'wrapper-result.json'), 'utf8'));
  assert.equal(receipt.exit_code, 0); assert.equal(receipt.report_path, report);
  const live = fs.readFileSync(path.join(project, '.planning/metrics/codex-executor-live.txt'), 'utf8');
  assert.doesNotMatch(result.stdout + result.stderr + live, /native worker usage|native_usage_|native_request_usage/);
});
test('controlled timeout finalizes capture before its first transport close, not only in finally', linux, async t => {
  const f = fixture(t), a = accounting(f, f.projects[0]);
  const order = path.join(f.root, 'cleanup-order.jsonl'), preload = path.join(f.root, 'observe-cleanup.cjs');
  fs.writeFileSync(preload, `
const fs = require('node:fs'), Module = require('node:module');
const log = value => fs.appendFileSync(${JSON.stringify(order)}, JSON.stringify(value) + '\\n');
const { Rpc } = require(${JSON.stringify(path.join(__dirname, 'rpc.cjs'))});
const close = Rpc.prototype.close;
Rpc.prototype.close = function(...args) { log('rpc.close'); return close.apply(this, args); };
const load = Module._load;
Module._load = function(request, ...args) {
 const value = load.call(this, request, ...args);
 if (!request.endsWith('/usage.cjs') && request !== './usage.cjs') return value;
 return { ...value, createCapture(...args) {
   const capture = value.createCapture(...args);
   return { ...capture, finalizeSync(...args) { log('capture.finalize'); return capture.finalizeSync(...args); } };
 } };
};
`);
  const result = await start(f, f.projects[0], 'usage-timeout', ['--timeout', '3'], false,
    { ...a.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` }).completed;
  assert.equal(result.code, 124, result.stderr);
  const events = fs.readFileSync(order, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(events.indexOf('capture.finalize') >= 0 && events.indexOf('capture.finalize') < events.indexOf('rpc.close'), JSON.stringify(events));
  assert.equal(observations(a.run).length, 1);
});
test('unacknowledged responses never count and timeout cleanup retains an earlier real failure', linux, async t => {
  for (const [mode, reason] of [['usage-early-cross-turn', 'worker_report_turn_mismatch'], ['hang-turn', 'worker_timeout'], ['fail-before-ack', 'worker_unsupported_host_request']]) {
    const f = fixture(t), a = accounting(f, f.projects[0]);
    const result = await start(f, f.projects[0], mode, ['--timeout', mode === 'hang-turn' ? '1' : '3'], false, a.env).completed;
    assert.notEqual(result.code, 0); assert.match(result.stderr, new RegExp(reason));
    assert.equal(observations(a.run).length, 0, mode);
    assert.match(gaps(a.run), /native_request_usage_unobserved/);
  }
});
for (const stage of ['thread', 'turn']) test(`same-chunk ${stage} ACK and transport fault cannot reopen native capture or leak a timer`, linux, async t => {
  const f = fixture(t), a = accounting(f, f.projects[0]);
  const lifecycle = path.join(f.root, 'fault-lifecycle.jsonl'), preload = path.join(f.root, 'observe-fault.cjs');
  fs.writeFileSync(preload, `
const fs = require('node:fs'), Module = require('node:module');
const log = value => fs.appendFileSync(${JSON.stringify(lifecycle)}, JSON.stringify(value) + '\\n');
const { Rpc } = require(${JSON.stringify(path.join(__dirname, 'rpc.cjs'))});
const fail = Rpc.prototype.fail;
Rpc.prototype.fail = function(error) { if (!this.closed) log('rpc.fault:' + error.message); return fail.call(this, error); };
const load = Module._load;
Module._load = function(request, ...args) {
 const value = load.call(this, request, ...args);
 if (request !== './usage.cjs') return value;
 return { ...value, createCapture(...args) {
   log('capture.create'); const capture = value.createCapture(...args);
   return { ...capture,
     bindTurn(...args) { log('capture.bind'); return capture.bindTurn(...args); },
     close(...args) { log('capture.close'); return capture.close(...args); } };
 } };
};
`);
  const w = start(f, f.projects[0], `usage-${stage}-ack-fault`, [], false,
    { ...a.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` });
  const setupBound = Date.now() + 8000;
  while (Date.now() < setupBound && (!fs.existsSync(lifecycle) || !fs.readFileSync(lifecycle, 'utf8').includes('rpc.fault:app_server_invalid_json'))) await delay(25);
  assert.ok(fs.existsSync(lifecycle) && fs.readFileSync(lifecycle, 'utf8').includes('rpc.fault:app_server_invalid_json'), 'fixture must reach its protocol-fault stage');
  // Bound natural exit from the observed fault, independently of setup time.
  let bound;
  const result = await Promise.race([w.completed, new Promise(resolve => { bound = setTimeout(() => resolve(null), 2500); })]);
  clearTimeout(bound);
  if (!result) { w.child.kill('SIGKILL'); await w.completed; }
  assert.ok(result, 'faulted adapter must exit naturally without a referenced capture interval');
  assert.equal(result.code, 1, result.stderr); assert.match(result.stderr, /app_server_invalid_json/); assert.equal(result.stdout, '');
  const events = fs.readFileSync(lifecycle, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(events, stage === 'thread' ? ['rpc.fault:app_server_invalid_json']
    : ['capture.create', 'rpc.fault:app_server_invalid_json', 'capture.close']);
  assert.equal(observations(a.run).length, 0);
});

test('fresh adapter handles lazy date-parents and final creation, while a missing resume remains degraded', linux, async t => {
  const f = fixture(t), file = path.join(f.root, 'native', 'sessions', '2026', '09', '09', 'rollout.jsonl');
  const a = accounting(f, f.projects[0], file);
  assert.equal(fs.existsSync(path.dirname(file)), false);
  assert.equal((await start(f, f.projects[0], 'usage-complete', [], false, a.env).completed).code, 0);
  assert.equal(observations(a.run).length, 2);
  const old = await state(f.projects[0], s => s.status === 'completed');
  fs.unlinkSync(file);
  const resumed = accounting(f, f.projects[0], file);
  assert.equal((await start(f, f.projects[0], 'usage-resume-missing', ['--resume-worker', old.worker_id], false, resumed.env).completed).code, 0);
  assert.equal(observations(resumed.run).length, 0); assert.match(gaps(resumed.run), /native_usage_path_unavailable/);
  for (const mode of ['usage-final', 'usage-never-created']) {
    const b = accounting(f, f.projects[0], path.join(f.root, mode, 'rollout.jsonl'));
    assert.equal((await start(f, f.projects[0], mode, [], false, b.env).completed).code, 0);
    assert.equal(observations(b.run).length, mode === 'usage-final' ? 1 : 0);
    if (mode === 'usage-never-created') assert.match(gaps(b.run), /native_request_usage_unobserved/);
  }
});

for (const [mode, code, reason] of [['usage-early-failed', 1, 'worker_turn_failed'], ['usage-early-interrupted', 130, 'worker_interrupted']]) {
  test(`${mode} retains its completed response after a valid ACK on the open transport`, linux, async t => {
    const f = fixture(t), a = accounting(f, f.projects[0]);
    // Existing file isolates logical-failure ordering from lazy materialization.
    fs.writeFileSync(a.env.WORKER_FIXTURE_ROLLOUT, '', { mode: 0o600 });
    const result = await start(f, f.projects[0], mode, [], false, a.env).completed;
    assert.equal(result.code, code, result.stderr); assert.match(result.stderr, new RegExp(reason)); assert.equal(result.stdout, '');
    assert.equal(observations(a.run).length, 1);
  });
}

test('synchronous capture setup cannot dispatch a new turn after the original deadline', linux, async t => {
  const f = fixture(t), a = accounting(f, f.projects[0]);
  const dispatches = path.join(f.root, 'startup-dispatches.jsonl'), preload = path.join(f.root, 'delay-capture.cjs');
  fs.writeFileSync(preload, `
const fs = require('node:fs'), Module = require('node:module');
const log = value => fs.appendFileSync(${JSON.stringify(dispatches)}, JSON.stringify(value) + '\\n');
const { Rpc } = require(${JSON.stringify(path.join(__dirname, 'rpc.cjs'))});
const request = Rpc.prototype.request;
Rpc.prototype.request = function(method, ...args) { log(method); return request.call(this, method, ...args); };
const load = Module._load;
Module._load = function(request, ...args) {
 const value = load.call(this, request, ...args);
 if (request !== './usage.cjs') return value;
 return { ...value, createCapture(...args) {
   const capture = value.createCapture(...args); log('capture.setup');
   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3100);
   return capture;
 } };
};
`);
  const result = await start(f, f.projects[0], 'usage-timeout', ['--timeout', '3'], false,
    { ...a.env, NODE_OPTIONS: `--require=${JSON.stringify(preload)}` }).completed;
  assert.equal(result.code, 124, result.stderr); assert.match(result.stderr, /worker_timeout/);
  const methods = fs.readFileSync(dispatches, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(methods.includes('capture.setup'), 'fixture must consume time in real capture setup');
  assert.equal(methods.filter(method => method === 'turn/start').length, 0, 'expired setup must not initiate a provider turn');
});
