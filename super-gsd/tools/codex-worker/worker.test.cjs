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
function start(f, project, mode = 'question', extra = [], holdPromptOpen = false) {
  assert.ok(fs.existsSync(runner), 'worker adapter must exist');
  const capture = path.join(f.root, `${mode}-${f.children.length}.jsonl`);
  const childPidFile = capture + '.child'; f.childPidFiles.push(childPidFile);
  const child = spawn(process.execPath, [runner, '--project', project, '--model', 'gpt-6-astra', '--reasoning', 'max', '--timeout', '8', ...extra],
    { windowsHide: true, env: { ...process.env, SGSD_CODEX_APP_SERVER_COMMAND: process.execPath,
      SGSD_CODEX_APP_SERVER_ARGS: JSON.stringify([path.join(__dirname, 'fixtures/app-server.cjs')]), WORKER_FIXTURE_MODE: mode,
      WORKER_FIXTURE_CAPTURE: capture, WORKER_FIXTURE_CHILD_PID_FILE: childPidFile, SGSD_ATLAS_DISABLED: '1' } });
  f.children.push(child); let stdout = '', stderr = '';
  child.stdout.on('data', chunk => stdout += chunk); child.stderr.on('data', chunk => stderr += chunk);
  const completed = new Promise(resolve => child.on('close', code => resolve({ code, stdout, stderr })));
  if (holdPromptOpen) child.stdin.write('PRIVATE_WORKER_PROMPT no telemetry persistence');
  else child.stdin.end('PRIVATE_WORKER_PROMPT no telemetry persistence');
  return { child, completed, capture, childPidFile };
}
function command(project, action, args = []) {
  return spawnSync(process.execPath, [control, action, '--project', project, ...args], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
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
