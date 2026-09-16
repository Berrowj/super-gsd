'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDurableChangedReturnWatcher, validateEvent, validateBinding } = require('./durable-changed-return-watcher.cjs');

const UUID = '11111111-1111-4111-8111-111111111111';
const WORKER = '22222222-2222-4222-8222-222222222222';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const makeRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'durable-return-'));
  const sourcePath = path.join(root, 'events.jsonl');
  const source = { path: sourcePath, sha256: 'a'.repeat(64), lane: 'harness' };
  fs.writeFileSync(sourcePath, '');
  return { root, source, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
};
const event = (source, overrides = {}) => ({ event_id: UUID, kind: 'return', lane: source.lane, plan: 'plan-1012', task: 'task-1',
  owner: 'pm-delivery', owner_epoch: 'epoch-1', source_path: source.path, source_sha256: source.sha256,
  observed_at: '2026-09-16T10:12:00.000Z', disposition: 'executing', next_action: 'wake_owner', pointer: 'Return artifact: handoff-1012.md.', ...overrides });
const append = (source, value) => fs.appendFileSync(source.path, JSON.stringify(value) + '\n');
const managedBinding = root => ({ owner: 'pm-delivery', epoch: 'epoch-1', kind: 'managed_worker', mailbox: {
  project: root, worker_id: WORKER, instance: 'instance-1', thread_id: 'thread-1', turn_id: 'turn-1' } });
const nativeBinding = root => ({ owner: 'deploy', epoch: 'epoch-1', kind: 'native_pane', identity: {
  pid: process.pid, start: 'start-1', cwd: root, runtime: 'node22', session: 'session-1', pane: 'pane-1' } });
const identityFrom = binding => binding.kind === 'native_pane' ? binding.identity : null;

function fakeMailbox(binding, { applied = false } = {}) {
  const calls = { read: 0, submit: 0, receipt: 0 };
  return { calls, read() { calls.read++; return { project: binding.mailbox.project, worker_id: binding.mailbox.worker_id,
    instance: binding.mailbox.instance, thread_id: binding.mailbox.thread_id, turn_id: binding.mailbox.turn_id, owner: binding.owner }; },
  submit() { calls.submit++; return { queued: true, command_id: '33333333-3333-4333-8333-333333333333' }; },
  receipt() { calls.receipt++; return { status: applied ? 'applied' : 'queued' }; } };
}

test('managed return wakes the named PM once and preserves duplicate suppression', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding);
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox });
  const row = event(fixture.source); append(fixture.source, row); append(fixture.source, row);
  const result = watcher.poll();
  assert.equal(mailbox.calls.submit, 1); assert.equal(mailbox.calls.read, 1);
  assert.equal(result.actions[0].wake_count, 1);
  assert.equal(watcher.status().counts.acknowledged, 1);
});

test('unchanged polling performs no transport work, while an append is consumed', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding);
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox });
  assert.equal(watcher.poll().status, 'unchanged');
  append(fixture.source, event(fixture.source)); watcher.poll();
  const before = { ...mailbox.calls }; const idle = watcher.poll();
  assert.equal(idle.status, 'unchanged'); assert.equal(mailbox.calls.submit, before.submit); assert.equal(mailbox.calls.read, before.read);
  assert.equal(mailbox.calls.receipt, before.receipt + 1);
});

test('mailbox acknowledgement is reconciled to applied without a second wake', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding);
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox });
  append(fixture.source, event(fixture.source)); watcher.poll();
  const firstSubmit = mailbox.calls.submit;
  mailbox.receipt = () => { mailbox.calls.receipt++; return { status: 'applied' }; };
  const result = watcher.poll();
  assert.equal(mailbox.calls.submit, firstSubmit); assert.equal(result.actions.at(-1).state, 'applied');
  assert.equal(watcher.status().counts.applied, 1);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(watcher.statePath, 'utf8')).receipts).length, 1);
});

test('native busy composer defers and retries only after the guard is ready', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = nativeBinding(fixture.root), identity = identityFrom(binding), calls = { observe: 0, literal: 0, enter: 0 };
  let ready = false;
  const native = { observe(expected, after) { calls.observe++; return { identity: expected, ready, pointer: after?.pointer }; },
    sendLiteral() { calls.literal++; return { status: 'sent' }; }, sendEnter() { calls.enter++; return { status: 'sent' }; } };
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], native });
  append(fixture.source, event(fixture.source, { kind: 'ready', owner: 'deploy' }));
  assert.equal(watcher.poll().actions[0].state, 'deferred'); assert.equal(calls.literal, 0);
  ready = true; assert.equal(watcher.poll().actions.at(-1).state, 'applied');
  assert.equal(calls.literal, 1); assert.equal(calls.enter, 1); assert.ok(identity.cwd);
});

test('native identity mismatch fails closed without literal or Enter', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = nativeBinding(fixture.root), calls = { literal: 0, enter: 0 };
  const native = { observe(expected) { return { identity: { ...expected, pid: expected.pid + 1 }, ready: true }; },
    sendLiteral() { calls.literal++; return { status: 'sent' }; }, sendEnter() { calls.enter++; return { status: 'sent' }; } };
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], native });
  append(fixture.source, event(fixture.source, { kind: 'ready', owner: 'deploy' }));
  const result = watcher.poll(); assert.equal(result.actions[0].reason, 'native_identity_mismatch');
  assert.deepEqual(calls, { literal: 0, enter: 0 });
});

test('native uncertain post-literal outcome is retained and never replayed', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = nativeBinding(fixture.root), calls = { literal: 0, enter: 0 };
  const native = { observe(expected, after) { return { identity: expected, ready: !after }; },
    sendLiteral() { calls.literal++; return { status: 'sent' }; }, sendEnter() { calls.enter++; return { status: 'sent' }; } };
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], native });
  append(fixture.source, event(fixture.source, { kind: 'ready', owner: 'deploy' }));
  assert.equal(watcher.poll().actions[0].state, 'uncertain'); assert.equal(calls.literal, 1); assert.equal(calls.enter, 0);
  const restarted = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], native });
  restarted.poll(); assert.equal(calls.literal, 1); assert.equal(calls.enter, 0); assert.equal(restarted.status().counts.uncertain, 1);
});

test('source rewrite is visible and does not wake an owner', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding);
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox });
  append(fixture.source, event(fixture.source)); watcher.poll();
  fs.writeFileSync(fixture.source.path, JSON.stringify(event(fixture.source, { event_id: 'rewrite-1' })) + '\n');
  const result = watcher.poll(); assert.ok(result.findings.some(row => row.reason === 'event_source_rewritten')); assert.equal(mailbox.calls.submit, 1);
});

test('owner epoch and target cardinality are explicit fail-closed gaps', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding);
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [{ ...binding, epoch: 'epoch-2' }], mailbox });
  append(fixture.source, event(fixture.source)); const result = watcher.poll();
  assert.equal(result.actions[0].reason, 'owner_epoch_mismatch'); assert.equal(mailbox.calls.submit, 0);
  assert.equal(validateBinding(binding), null); assert.equal(validateEvent(event(fixture.source), fixture.source), null);
});

test('an explicit successor epoch routes when old and new bindings coexist', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const first = managedBinding(fixture.root), successor = { ...first, epoch: 'epoch-2', mailbox: { ...first.mailbox, instance: 'instance-2', thread_id: 'thread-2', turn_id: 'turn-2' } };
  const mailbox = { submit() { return { queued: true, command_id: '33333333-3333-4333-8333-333333333333' }; }, read() { return { ...successor.mailbox, owner: successor.owner }; } };
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [first, successor], mailbox });
  append(fixture.source, event(fixture.source, { owner_epoch: 'epoch-2' }));
  assert.equal(watcher.poll().actions[0].state, 'acknowledged');
});

test('ready routes only to Deploy and terminal dispositions do not wake', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = nativeBinding(fixture.root), calls = { literal: 0 };
  const native = { observe(expected) { return { identity: expected, ready: true }; }, sendLiteral() { calls.literal++; return { status: 'sent' }; }, sendEnter() { return { status: 'sent' }; } };
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], native });
  append(fixture.source, event(fixture.source, { event_id: 'completed-1', kind: 'ready', owner: 'deploy', next_action: 'none', disposition: 'completed', pointer: undefined }));
  const result = watcher.poll(); assert.equal(result.actions[0].state, 'completed'); assert.equal(calls.literal, 0);
  assert.equal(watcher.status().counts.completed, 1);
});

test('malformed and semantically invalid records are ledgered without wake', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding);
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox });
  fs.appendFileSync(fixture.source.path, '{not-json}\n' + JSON.stringify(event(fixture.source, { pointer: 'bad\ntext' })) + '\n');
  const result = watcher.poll(); assert.ok(result.findings.some(row => row.reason === 'malformed_event')); assert.ok(result.findings.some(row => row.reason === 'missing_safe_pointer'));
  assert.equal(mailbox.calls.submit, 0); assert.equal(watcher.status().counts.genuinely_blocked, 2);
});

test('awaiting a named dependency is distinct from completed and does not wake', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding);
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox });
  append(fixture.source, event(fixture.source, { event_id: 'await-1', next_action: 'await_dependency', disposition: 'executing', pointer: undefined }));
  const result = watcher.poll(); assert.equal(result.actions[0].state, 'awaiting_named_dependency'); assert.equal(mailbox.calls.submit, 0);
});

test('altered payload under one event ID is an integrity conflict, never a second wake', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding), watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox });
  append(fixture.source, event(fixture.source)); watcher.poll();
  append(fixture.source, event(fixture.source, { pointer: 'different safe pointer.' }));
  const result = watcher.poll(); assert.ok(result.findings.some(row => row.reason === 'event_identity_integrity_conflict')); assert.equal(mailbox.calls.submit, 1);
});

test('prepared delivery recovered after restart becomes uncertain rather than replayed', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding);
  const statePath = path.join(fixture.root, 'state.json');
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox, statePath });
  append(fixture.source, event(fixture.source)); watcher.poll();
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8')), key = `${UUID}|pm-delivery|epoch-1`;
  state.events[key].state = 'prepared'; delete state.events[key].command_id; fs.writeFileSync(statePath, JSON.stringify(state) + '\n');
  const restarted = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox, statePath });
  restarted.poll(); assert.equal(mailbox.calls.submit, 1); assert.equal(restarted.status().counts.uncertain, 1);
});

test('executable runner validates a concrete config without polling or waking', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const configPath = path.join(fixture.root, 'durable-return-watcher.json');
  fs.writeFileSync(configPath, JSON.stringify({ schema_version: 1, root: fixture.root, poll_ms: 8000, sources: [fixture.source], bindings: [managedBinding(fixture.root)] }) + '\n');
  const runner = path.join(__dirname, 'durable-changed-return-runner.cjs');
  const result = spawnSync(process.execPath, [runner, '--config', configPath, '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).valid, true); assert.equal(result.stderr, '');
  assert.equal(fs.existsSync(`${path.join(fixture.root, '.planning', 'atlas', 'durable-changed-return-watcher.json')}.lock`), false);
});

test('normal runner remains alive on its referenced scheduler handle', async t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const configPath = path.join(fixture.root, 'durable-return-watcher.json');
  fs.writeFileSync(configPath, JSON.stringify({ schema_version: 1, root: fixture.root, poll_ms: 1000, sources: [fixture.source], bindings: [managedBinding(fixture.root)] }) + '\n');
  const runner = path.join(__dirname, 'durable-changed-return-runner.cjs');
  const child = spawn(process.execPath, [runner, '--config', configPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill('SIGTERM'); });
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.equal(child.exitCode, null); assert.equal(child.signalCode, null);
  child.kill('SIGTERM');
  const status = await new Promise(resolve => child.once('close', (code, signal) => resolve({ code, signal })));
  assert.equal(status.code, 0); assert.equal(status.signal, null);
  assert.equal(fs.existsSync(`${path.join(fixture.root, '.planning', 'atlas', 'durable-changed-return-watcher.json')}.lock`), false);
});
