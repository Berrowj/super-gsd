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
      CODEX_HOME: path.join(f.root, 'codex-home'), ...atlas } });
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
