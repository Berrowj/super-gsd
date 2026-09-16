'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDurableChangedReturnWatcher, validateEvent, validateBinding } = require('./durable-changed-return-watcher.cjs');
const { createDurableReturnProducer } = require('./durable-return-producer.cjs');
const { firstLine } = require('./durable-changed-return-runner.cjs');

const UUID = '11111111-1111-4111-8111-111111111111';
const WORKER = '22222222-2222-4222-8222-222222222222';
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const makeRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'durable-return-'));
  const sourcePath = path.join(root, 'events.jsonl');
  const artifactPath = path.join(root, 'artifact.json'); fs.writeFileSync(artifactPath, '{}\n');
  const source = { path: sourcePath, sha256: 'a'.repeat(64), lane: 'harness', artifactPath, artifactSha: sha('{}\n') };
  fs.writeFileSync(sourcePath, '');
  fs.writeFileSync(path.join(root, 'native-intake.jsonl'), '');
  return { root, source, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
};
const event = (source, overrides = {}) => ({ event_id: UUID, kind: 'return', lane: source.lane, plan: 'plan-1012', task: 'task-1',
  source_owner: `worker.${WORKER}`, route: 'worker_to_pm', owner: 'pm-delivery', owner_epoch: 'epoch-1', source_path: source.path, source_sha256: source.sha256,
  observed_at: '2026-09-16T10:12:00.000Z', disposition: 'executing', next_action: 'wake_owner', pointer: 'Return artifact: handoff-1012.md.',
  artifact_path: source.artifactPath, artifact_sha256: source.artifactSha, ...overrides });
const append = (source, value) => fs.appendFileSync(source.path, JSON.stringify(value) + '\n');
const managedBinding = root => ({ owner: 'pm-delivery', epoch: 'epoch-1', kind: 'managed_worker', mailbox: {
  project: root, worker_id: WORKER, instance: 'instance-1', thread_id: 'thread-1', turn_id: 'turn-1' } });
const nativeBinding = root => ({ owner: 'deploy', epoch: 'epoch-1', kind: 'native_pane', identity: {
  pid: process.pid, start: 'start-1', pane_pid: process.pid, pane_start: 'pane-start-1', cwd: root, runtime: 'codex', session: 'session-1', pane: '%59', window: '@15', thread: 'thread-1', intake_path: path.join(root, 'native-intake.jsonl') } });
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
  append(fixture.source, event(fixture.source, { kind: 'ready', source_owner: 'pm-delivery', route: 'pm_to_deploy', owner: 'deploy' }));
  assert.equal(watcher.poll().actions[0].state, 'deferred'); assert.equal(calls.literal, 0);
  ready = true; assert.equal(watcher.poll().actions.at(-1).state, 'awaiting_ack');
  assert.equal(calls.literal, 1); assert.equal(calls.enter, 1); assert.ok(identity.cwd);
});

test('native identity mismatch fails closed without literal or Enter', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = nativeBinding(fixture.root), calls = { literal: 0, enter: 0 };
  const native = { observe(expected) { return { identity: { ...expected, pid: expected.pid + 1 }, ready: true }; },
    sendLiteral() { calls.literal++; return { status: 'sent' }; }, sendEnter() { calls.enter++; return { status: 'sent' }; } };
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], native });
  append(fixture.source, event(fixture.source, { kind: 'ready', source_owner: 'pm-delivery', route: 'pm_to_deploy', owner: 'deploy' }));
  const result = watcher.poll(); assert.equal(result.actions[0].reason, 'native_identity_mismatch');
  assert.deepEqual(calls, { literal: 0, enter: 0 });
});

test('native uncertain post-literal outcome is retained and never replayed', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = nativeBinding(fixture.root), calls = { literal: 0, enter: 0 };
  const native = { observe(expected, after) { return { identity: expected, ready: !after }; },
    sendLiteral() { calls.literal++; return { status: 'sent' }; }, sendEnter() { calls.enter++; return { status: 'sent' }; } };
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], native });
  append(fixture.source, event(fixture.source, { kind: 'ready', source_owner: 'pm-delivery', route: 'pm_to_deploy', owner: 'deploy' }));
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
  append(fixture.source, event(fixture.source, { event_id: 'completed-1', kind: 'ready', source_owner: 'pm-delivery', route: 'pm_to_deploy', owner: 'deploy', next_action: 'none', disposition: 'completed', pointer: undefined }));
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

test('runner reclaims only a verifiably dead exact lock owner', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const statePath = path.join(fixture.root, 'state.json'), lockPath = `${statePath}.lock`;
  fs.mkdirSync(path.dirname(lockPath), { recursive: true }); fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999999, start: 'dead-start' }) + '\n');
  const configPath = path.join(fixture.root, 'durable-return-watcher.json');
  fs.writeFileSync(configPath, JSON.stringify({ schema_version: 1, root: fixture.root, state_path: statePath, poll_ms: 8000, sources: [fixture.source], bindings: [managedBinding(fixture.root)] }) + '\n');
  const runner = path.join(__dirname, 'durable-changed-return-runner.cjs');
  const result = spawnSync(process.execPath, [runner, '--config', configPath, '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).valid, true); assert.equal(fs.existsSync(lockPath), false);
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

test('native Enter is delivered, then applied only from exact owned intake evidence', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = nativeBinding(fixture.root), identity = identityFrom(binding);
  const native = { observe(expected, after) { return { identity: expected, ready: true, pointer: after?.pointer }; },
    sendLiteral() { return { status: 'sent' }; }, sendEnter() { return { status: 'sent' }; },
    applied(record) { return { status: 'applied', event_id: record.event_id, owner_epoch: record.owner_epoch, pid: identity.pid, start: identity.start, thread: identity.thread }; } };
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [{ ...binding, owner: 'deploy' }], native });
  append(fixture.source, event(fixture.source, { kind: 'ready', source_owner: 'pm-delivery', route: 'pm_to_deploy', owner: 'deploy' }));
  assert.equal(watcher.poll().actions[0].state, 'awaiting_ack');
  assert.equal(watcher.poll().actions.at(-1).state, 'applied');
  assert.equal(watcher.status().counts.applied, 1); assert.equal(Object.keys(JSON.parse(fs.readFileSync(watcher.statePath, 'utf8')).receipts).length, 1);
});

test('mailbox producer projects an existing worker question and wrapper return into one durable reply source', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const project = path.join(fixture.root, 'project'), workerDir = path.join(project, '.planning', 'worker-sessions', WORKER);
  fs.mkdirSync(workerDir, { recursive: true });
  const record = { project, worker_id: WORKER, instance: 'instance-1', plan: 'plan-1012', step: 'task-1', pending: [{ id: 'request-1', kind: 'orchestrator_question' }] };
  fs.writeFileSync(path.join(workerDir, 'state.json'), JSON.stringify(record) + '\n'); fs.writeFileSync(path.join(workerDir, 'wrapper-result.json'), '{"status":"completed"}\n');
  const producer = createDurableReturnProducer({ mailbox: { read() { return record; } }, now: () => '2026-09-16T10:50:00.000Z' });
  const produced = producer.projectMailbox({ project, workerId: WORKER, owner: 'pm-delivery', ownerEpoch: 'epoch-1', lane: 'pm-delivery', outputPath: fixture.source.path });
  assert.equal(produced.emitted, 2);
  const source = { ...fixture.source, lane: 'pm-delivery', sha256: producer.registrationHash(fixture.source.path, 'pm-delivery') };
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding), watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [source], bindings: [binding], mailbox });
  const result = watcher.poll(); assert.equal(result.actions.length, 2); assert.equal(mailbox.calls.submit, 2);
  assert.deepEqual(result.actions.map(row => row.owner), ['pm-delivery', 'pm-delivery']);
});

test('PM-to-Root, Root-to-PM and PM-to-owned-worker routes require explicit ownership', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const rootBinding = { ...nativeBinding(fixture.root), owner: 'root' }, rootNative = { observe(expected) { return { identity: expected, ready: false, reason: 'busy' }; }, sendLiteral() { return { status: 'sent' }; }, sendEnter() { return { status: 'sent' }; } };
  const rootWatcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [rootBinding], native: rootNative });
  append(fixture.source, event(fixture.source, { source_owner: 'pm-delivery', route: 'pm_to_root', owner: 'root' }));
  assert.equal(rootWatcher.poll().actions[0].state, 'deferred');
  const workerTarget = { owner: `pm-delivery.worker.${WORKER}`, parent_owner: 'pm-delivery', epoch: 'epoch-1', kind: 'managed_worker', mailbox: {
    project: fixture.root, worker_id: WORKER, instance: 'instance-1', thread_id: 'thread-1', turn_id: 'turn-1' } };
  const mailbox = { read() { return { ...workerTarget.mailbox, owner: 'pm-delivery' }; }, submit() { return { queued: true, command_id: '44444444-4444-4444-8444-444444444444' }; } };
  const workerWatcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [workerTarget], mailbox, statePath: path.join(fixture.root, 'worker-state.json') });
  append(fixture.source, event(fixture.source, { event_id: 'pm-worker-1', source_owner: 'pm-delivery', route: 'pm_to_worker', owner: workerTarget.owner, target_worker_id: WORKER }));
  assert.equal(workerWatcher.poll().actions.at(-1).state, 'acknowledged');
  const pmBinding = managedBinding(fixture.root), pmMailbox = fakeMailbox(pmBinding), pmWatcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [pmBinding], mailbox: pmMailbox, statePath: path.join(fixture.root, 'pm-state.json') });
  append(fixture.source, event(fixture.source, { event_id: 'root-pm-1', source_owner: 'root', route: 'root_to_pm', owner: 'pm-delivery' }));
  assert.equal(pmWatcher.poll().actions.at(-1).state, 'acknowledged');
});

test('partial durable source records remain pending until newline, then append recovery wakes once', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = managedBinding(fixture.root), mailbox = fakeMailbox(binding), watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [fixture.source], bindings: [binding], mailbox });
  const row = JSON.stringify(event(fixture.source)); fs.appendFileSync(fixture.source.path, row);
  assert.equal(watcher.poll().actions.length, 0); fs.appendFileSync(fixture.source.path, '\n');
  assert.equal(watcher.poll().actions[0].state, 'acknowledged'); assert.equal(mailbox.calls.submit, 1);
});

test('native bindings require real tmux identifiers and retain pane process identity', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const binding = nativeBinding(fixture.root);
  assert.equal(validateBinding(binding), null);
  assert.equal(validateBinding({ ...binding, identity: { ...binding.identity, pane: 'pane-1' } }), 'invalid_native_binding');
  assert.equal(validateBinding({ ...binding, identity: { ...binding.identity, window: 'window-1' } }), 'invalid_native_binding');
  assert.equal(validateBinding({ ...binding, identity: { ...binding.identity, pane_pid: undefined } }), 'invalid_native_binding');
});

test('bounded primary rollout header copies valid JSON beyond the old 16KiB read boundary', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const file = path.join(fixture.root, 'rollout-test.jsonl');
  const header = JSON.stringify({ payload: { source: 'cli', originator: 'codex-tui', cwd: fixture.root, id: 'rollout-1' }, padding: 'x'.repeat(20000) });
  fs.writeFileSync(file, `${header}\n{}\n`);
  const actual = firstLine(file); assert.ok(Buffer.byteLength(actual) > 16 * 1024); assert.equal(JSON.parse(actual).payload.id, 'rollout-1');
});

test('real PM Root-inbox acknowledgement shape projects a pointer-only PM-to-Root return', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const inbox = path.join(fixture.root, 'pm-automation-root-cutover-alex-qa-1051.json');
  fs.writeFileSync(inbox, JSON.stringify({ event_id: 'pm-automation-root-cutover-alex-qa-1051', observed_at: '2026-09-16T10:54:36Z',
    owner: 'pm-automation', source_path: fixture.source.artifactPath, source_hash: fixture.source.artifactSha,
    question: 'opaque question text must not be relayed', result: { status: 'accepted' }, next_action: 'wake pm' }) + '\n');
  const output = path.join(fixture.root, 'root-events.jsonl');
  const producer = createDurableReturnProducer({ now: () => '2026-09-16T10:55:00.000Z' });
  const produced = producer.projectInbox({ inputPath: inbox, outputPath: output, ownerEpoch: 'epoch-1', plan: 'plan-1100', task: 'task-root-inbox' });
  assert.equal(produced.emitted, 1);
  const projected = JSON.parse(fs.readFileSync(output, 'utf8'));
  assert.equal(projected.route, 'pm_to_root'); assert.equal(projected.source_owner, 'pm-automation'); assert.equal(projected.owner, 'root');
  assert.equal(projected.event_id, 'pm-automation-root-cutover-alex-qa-1051'); assert.equal(projected.pointer, 'Root inbox: pm-automation-root-cutover-alex-qa-1051.json.');
  assert.equal(Object.hasOwn(projected, 'question'), false); assert.equal(Object.hasOwn(projected, 'result'), false);
});

test('copied Deploy EVENTS schema resolves its receipt artifact and never relays action prose', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const receipt = path.join(fixture.root, 'results', 'pm-delivery-dce-completed-work-c62b360a-1108.json');
  fs.mkdirSync(path.dirname(receipt), { recursive: true }); fs.writeFileSync(receipt, '{"schema_version":1,"status":"verified"}\n');
  const ledger = path.join(fixture.root, 'deploy-EVENTS.jsonl');
  const request = 'pm-delivery-dce-completed-work-c62b360a-1108';
  const transitions = [
    { at: '2026-09-16T11:10:07.824Z', event: 'dce_completed_work_claimed', request, action: 'claim prose must not be relayed' },
    { at: '2026-09-16T11:13:11.062Z', event: 'dce_completed_work_pr128_ci_pending', request, action: 'CI pending prose must not be relayed' },
    { at: '2026-09-16T11:20:49.768Z', event: 'dce_completed_work_pr128_merged_deployed', request, action: 'deploy prose must not be relayed' },
    { at: '2026-09-16T11:32:29.237Z', event: 'dce_changed_ui_browser_proof_environment_blocked', request, action: 'terminal result prose must not be relayed' },
  ].map(row => ({ ...row, repository: 'Berrowj/clarity-erp', accepted_chain: ['99b79ab6ab9dfc6270288c6274dfdda436123d1b'], required_services: ['clarity-python-api'], receipt: 'results/pm-delivery-dce-completed-work-c62b360a-1108.json' }));
  fs.writeFileSync(ledger, transitions.map(row => JSON.stringify(row)).join('\n') + '\n');
  const output = path.join(fixture.root, 'deploy-derived.jsonl');
  const producer = createDurableReturnProducer();
  const spec = { inputPath: ledger, outputPath: output, coordinationDir: fixture.root, lane: 'deploy', sourceOwner: 'deploy', route: 'deploy_to_pm', owner: 'pm-delivery', ownerEpoch: 'epoch-1', ownerEpochByOwner: { 'pm-delivery': 'epoch-1', 'pm-automation': 'automation-epoch-1' }, plan: 'plan-1119', task: 'task-deploy-schema' };
  assert.equal(producer.projectLedger(spec).emitted, 4); assert.equal(producer.projectLedger(spec).emitted, 0);
  const projected = fs.readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(new Set(projected.map(row => row.event_id)).size, 4); assert.ok(projected.every(row => row.owner === 'pm-delivery' && row.artifact_path === receipt));
  assert.ok(projected.every(row => row.artifact_sha256 === sha(fs.readFileSync(receipt)) && row.pointer.startsWith('Deploy transition ')));
  assert.ok(projected.every(row => !Object.hasOwn(row, 'action')));
  const automationLedger = path.join(fixture.root, 'deploy-automation-EVENTS.jsonl');
  fs.writeFileSync(automationLedger, JSON.stringify({ ...transitions[0], request: 'pm-automation-root-cutover-alex-qa-1051' }) + '\n');
  const automationOutput = path.join(fixture.root, 'deploy-automation-derived.jsonl');
  const automation = producer.projectLedger({ ...spec, inputPath: automationLedger, outputPath: automationOutput });
  assert.equal(automation.emitted, 1);
  const automationRow = JSON.parse(fs.readFileSync(automationOutput, 'utf8'));
  assert.equal(automationRow.owner, 'pm-automation'); assert.equal(automationRow.owner_epoch, 'automation-epoch-1');
});

test('dynamic Root inbox discovery accepts both hash schemas and skips unbound records', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const inbox = path.join(fixture.root, 'inbox'); fs.mkdirSync(inbox);
  const writeInbox = (name, value) => fs.writeFileSync(path.join(inbox, name), JSON.stringify(value) + '\n');
  writeInbox('pm-delivery-dce-browser-proof-deploy-applied-1133.json', { event_id: 'pm-delivery-dce-browser-proof-deploy-applied-1133', observed_at: '2026-09-16T11:11:30Z', owner: 'pm-delivery', source_path: fixture.source.artifactPath, source_sha256: fixture.source.artifactSha, question_or_result: 'opaque' });
  writeInbox('pm-automation-root-cutover-alex-qa-1051.json', { event_id: 'pm-automation-root-cutover-alex-qa-1051', observed_at: '2026-09-16T11:11:31+00:00', owner: 'pm-automation', source_path: fixture.source.artifactPath, source_hash: fixture.source.artifactSha, question: 'opaque', result: { status: 'done' } });
  writeInbox('chat-root-native-wake-boundary-1058.json', { event_id: 'chat-root-native-wake-boundary-1058', observed_at: '2026-09-16T11:11:32Z', owner: 'chat-support', source_path: fixture.source.artifactPath, source_hash: fixture.source.artifactSha, question_or_result: 'chat inbound' });
  writeInbox('unbound-source-1119.json', { event_id: 'unbound-source-1119', observed_at: '2026-09-16T11:11:33Z', owner: 'other', source_path: fixture.source.artifactPath, source_hash: fixture.source.artifactSha, question_or_result: 'must skip' });
  const output = path.join(fixture.root, 'inbox-derived.jsonl'), producer = createDurableReturnProducer({ now: () => '2026-09-16T11:12:00.000Z' });
  const spec = { inputDir: inbox, outputPath: output, ownerEpoch: 'root-epoch', plan: 'plan-1119', task: 'task-inbox-discovery' };
  const first = producer.projectInboxDirectory(spec), second = producer.projectInboxDirectory(spec);
  assert.equal(first.emitted, 3); assert.equal(second.emitted, 0); assert.equal(first.discovered, 4);
  assert.ok(first.skipped.some(row => row.reason === 'producer_inbox_shape_invalid'));
  const rows = fs.readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse); assert.deepEqual(rows.map(row => row.source_owner).sort(), ['chat.chat-support', 'pm-automation', 'pm-delivery']);
  assert.ok(rows.every(row => row.route === 'pm_to_root' || row.route === 'chat_to_root'));
  const rootBinding = { ...nativeBinding(fixture.root), owner: 'root', epoch: 'root-epoch' }, calls = { literal: 0, enter: 0 };
  const native = { observe(expected) { return { identity: expected, ready: true }; }, sendLiteral() { calls.literal++; return { status: 'sent' }; }, sendEnter() { calls.enter++; return { status: 'sent' }; } };
  const source = { path: output, sha256: producer.registrationHash(output, 'root'), lane: 'root' };
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [source], bindings: [rootBinding], native });
  const reached = watcher.poll(); assert.equal(reached.actions.length, 3); assert.equal(calls.literal, 3); assert.equal(calls.enter, 3);
  assert.ok(reached.actions.every(row => row.owner === 'root')); assert.ok(rows.every(row => row.source_owner !== 'root'));
  assert.equal(watcher.poll().actions.length, 0); assert.equal(calls.literal, 3);
});

test('native primary producer captures real completion/question records with bounded cursor and dedup', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const identity = { pid: process.pid, start: 'native-start-1111', pane_pid: process.pid, pane_start: 'pane-start-1111', cwd: fixture.root, runtime: 'codex', session: 'session-1', pane: '%59', window: '@15', thread: 'thread-1111', intake_path: path.join(fixture.root, 'native-intake.jsonl') };
  const rollout = path.join(fixture.root, 'rollout-primary.jsonl');
  const header = { timestamp: '2026-09-16T11:20:00.000Z', ordinal: 0, type: 'session_meta', payload: { id: identity.thread, source: 'cli', originator: 'codex-tui', thread_source: 'user', cwd: fixture.root } };
  const huge = JSON.stringify({ timestamp: '2026-09-16T11:20:01.000Z', ordinal: 1, type: 'response_item', payload: { type: 'reasoning', text: 'x'.repeat(512 * 1024) } });
  const question = { timestamp: '2026-09-16T11:20:02.000Z', ordinal: 2, type: 'response_item', payload: { type: 'custom_tool_call', id: 'q-1', name: 'request_user_input', call_id: 'call-1', turn_id: 'turn-1' } };
  const complete = { timestamp: '2026-09-16T11:20:03.000Z', ordinal: 3, type: 'event_msg', payload: { type: 'task_complete', turn_id: 'turn-1', completed_at: '2026-09-16T11:20:03.000Z' } };
  fs.writeFileSync(rollout, `${JSON.stringify(header)}\n${huge}\n${JSON.stringify(question)}\n${JSON.stringify(complete)}\n`);
  const output = path.join(fixture.root, 'native-derived.jsonl'), producer = createDurableReturnProducer({ now: () => '2026-09-16T11:21:00.000Z' });
  const spec = { inputPath: rollout, outputPath: output, lane: 'native-harness', sourceOwner: `native.${identity.thread}`, owner: 'pm-delivery', ownerEpoch: 'epoch-1111', plan: 'plan-1111', task: 'task-native-primary', identity, primary: true,
    processReader: () => ({ start_time: identity.start, cwd: identity.cwd }) };
  const first = producer.projectNativePrimary(spec), second = producer.projectNativePrimary(spec);
  assert.equal(first.emitted, 2); assert.equal(second.emitted, 0); assert.ok(first.skipped.includes('record_too_large')); assert.equal(first.cursor.offset, fs.statSync(rollout).size);
  const rows = fs.readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse); assert.deepEqual(rows.map(row => row.kind).sort(), ['question', 'return']);
  assert.ok(rows.every(row => row.route === 'native_to_pm' && row.owner === 'pm-delivery' && row.artifact_path === rollout));
  const source = { path: output, sha256: producer.registrationHash(output, 'native-harness'), lane: 'native-harness' }, binding = { ...managedBinding(fixture.root), epoch: 'epoch-1111' }, mailbox = fakeMailbox(binding);
  const watcher = createDurableChangedReturnWatcher({ root: fixture.root, sources: [source], bindings: [binding], mailbox });
  assert.equal(watcher.poll().actions.length, 2); assert.equal(mailbox.calls.submit, 2);
});

test('native primary producer rejects a registered path whose header is a subagent rollout', t => {
  const fixture = makeRoot(); t.after(fixture.cleanup);
  const identity = { pid: process.pid, start: 'native-start-1111', pane_pid: process.pid, pane_start: 'pane-start-1111', cwd: fixture.root, runtime: 'codex', session: 'session-1', pane: '%59', window: '@15', thread: 'thread-1111', intake_path: path.join(fixture.root, 'native-intake.jsonl') };
  const rollout = path.join(fixture.root, 'subagent.jsonl'); fs.writeFileSync(rollout, JSON.stringify({ type: 'session_meta', payload: { id: identity.thread, source: 'cli', originator: 'codex-subagent', thread_source: 'agent', cwd: fixture.root } }) + '\n');
  const producer = createDurableReturnProducer(); assert.throws(() => producer.projectNativePrimary({ inputPath: rollout, outputPath: path.join(fixture.root, 'out.jsonl'), lane: 'native-harness', sourceOwner: `native.${identity.thread}`, owner: 'pm-delivery', ownerEpoch: 'epoch-1111', plan: 'plan-1111', task: 'task-native-primary', identity, processReader: () => ({ start_time: identity.start, cwd: identity.cwd }) }), /producer_native_primary_unverified/);
});
