'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const atlas = require('../../tools/telemetry-atlas/global.cjs');
const mailbox = require('../../tools/codex-worker/mailbox.cjs');
const dispatch = require('../../scripts/lib/board-dispatch.cjs');
const scripts = path.resolve(__dirname, '../../scripts');
const peer = path.resolve(__dirname, '../../tools/codex-worker/fixtures/app-server.cjs');
const control = path.resolve(__dirname, '../../tools/codex-worker/control.cjs');
const bashOnly = process.platform === 'win32' ? 'Run the Bash process tests under WSL/Linux' : false;
const boardReport = 'position: SUPPORT\nconfidence: 4\nrisks_raised: []\nevidence_cited: []\nfalsifier: a failed test\nimplementation_concerns: []\nknown_deadends: []\nintuition: bounded\nwhy_principled: evidence\nrationale: fixture\n';
const reviewerReport = 'FINDINGS: none\nCRITICAL: 0\nWARNINGS: 0\nPASS_RATE: 1/1\nONE_LINER: fixture\nFINDINGS_DETAIL: retained detail\n';
function writePeerCommand(file, label) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
if (process.argv[2] === '--version') { process.stdout.write('codex-app-server-fixture\\n'); process.exit(0); }
if (process.argv[2] === 'login' && process.argv[3] === 'status') { process.stdout.write('Logged in\\n'); process.exit(0); }
fs.writeFileSync(process.env.WORKER_FIXTURE_SELECTED_EXECUTABLE, ${JSON.stringify(label)} + '\\n');
if (process.env.WORKER_FIXTURE_SELECTED_ARGV) fs.writeFileSync(process.env.WORKER_FIXTURE_SELECTED_ARGV, JSON.stringify(process.argv.slice(2)));
require(process.env.WORKER_FIXTURE_PEER);
`, { mode: 0o700 });
}
function isolatedNativeTools(root) {
  const directory = path.join(root, 'isolated native tools'); fs.mkdirSync(directory);
  for (const name of ['awk', 'bash', 'cat', 'chmod', 'cp', 'date', 'dirname', 'find', 'grep', 'head', 'mkdir',
    'mktemp', 'mv', 'rm', 'sed', 'sort', 'tail', 'tee', 'timeout', 'tr', 'wc']) {
    const source = ['/usr/bin', '/bin'].map(base => path.join(base, name)).find(candidate => fs.existsSync(candidate));
    assert.ok(source, `native fixture tool is available: ${name}`);
    fs.symlinkSync(fs.realpathSync(source), path.join(directory, name));
  }
  return directory;
}
function fixture(t, { defaultDiscovery = false, parentEnv = process.env } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "worker launch 'quoted'-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.planning'));
  fs.writeFileSync(path.join(root, '.planning/STATE.md'), '---\nmilestone: fixture-worker\ncurrent_phase: "170"\ncurrent_plan: "170-03"\n---\n');
  const prompt = path.join(root, 'prompt.md'), report = path.join(root, 'report.txt'), capture = path.join(root, 'rpc.jsonl');
  fs.writeFileSync(prompt, 'Bounded fixture task. Ask the supervising unit if context is missing.\n');
  const fixtureHome = path.join(root, 'home'); fs.mkdirSync(fixtureHome);
  const callerBin = path.join(root, 'caller bin');
  const localBin = path.join(fixtureHome, '.local/bin');
  const nvmBin = path.join(fixtureHome, '.nvm/versions/node/v99.0.0/bin');
  const selectedExecutableLog = path.join(root, 'selected executable');
  const profileLog = path.join(root, 'profile-resolution.jsonl');
  writePeerCommand(path.join(callerBin, 'codex'), 'caller');
  writePeerCommand(path.join(localBin, 'codex'), 'user-local');
  writePeerCommand(path.join(nvmBin, 'codex'), 'nvm');
  fs.symlinkSync(fs.realpathSync(process.execPath), path.join(nvmBin, 'node'));
  const env = { ...parentEnv, HOME: fixtureHome, USERPROFILE: fixtureHome,
    PATH: `${callerBin}:${path.dirname(fs.realpathSync(process.execPath))}:/usr/bin:/bin`,
    OPENAI_API_KEY: '', SGSD_ATLAS_DISABLED: '1', SGSD_CODEX_APP_SERVER_COMMAND: process.execPath,
    SGSD_CODEX_APP_SERVER_ARGS: JSON.stringify([peer]), WORKER_FIXTURE_CAPTURE: capture, WORKER_FIXTURE_MODE: 'complete',
    SGSD_CODEX_COMMAND: path.join(root, 'must-not-use-one-shot'), SGSD_WORKER_OWNER: 'fable.fixture',
    SGSD_CODEX_PROFILE_LOG: profileLog,
    CODEX_HOME: path.join(root, 'isolated codex home'),
    WORKER_FIXTURE_PEER: peer, WORKER_FIXTURE_SELECTED_EXECUTABLE: selectedExecutableLog };
  if (defaultDiscovery) {
    delete env.SGSD_CODEX_APP_SERVER_COMMAND;
    delete env.SGSD_CODEX_COMMAND;
    env.SGSD_CODEX_APP_SERVER_ARGS = '[]';
  }
  delete env.SGSD_CODEX_FORCE_LAUNCHER; delete env.SGSD_WORKER_RESUME_ID;
  return { root, prompt, report, capture, env, callerBin, localBin, nvmBin, selectedExecutableLog, profileLog };
}
function launch(t, argv, f, env = {}) {
  const child = spawn('bash', argv, { cwd: f.root, env: { ...f.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '', exited = false;
  child.stdout.on('data', b => { stdout += b; }); child.stderr.on('data', b => { stderr += b; });
  const done = new Promise((resolve, reject) => { child.on('error', reject); child.on('close', code => { exited = true; resolve({ code, stdout, stderr }); }); });
  t.after(async () => { if (!exited) child.kill('SIGTERM'); await done; });
  return { done, get exited() { return exited; }, get stderr() { return stderr; } };
}
async function waiting(f, processHandle) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline && !processHandle.exited) {
    const record = mailbox.list(f.root).find(value => value.status === 'waiting_input');
    if (record) return record;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.fail(`wrapper must keep an active question-bound worker: ${processHandle.stderr}`);
}
function frames(f) { return fs.readFileSync(f.capture, 'utf8').trim().split('\n').map(JSON.parse); }
function treeSnapshot(root) {
  if (!fs.existsSync(root)) return null;
  const rows = [];
  const visit = (directory, relative = '') => {
    for (const name of fs.readdirSync(directory).sort()) {
      const absolute = path.join(directory, name), child = path.join(relative, name), stat = fs.lstatSync(absolute);
      if (stat.isDirectory()) { rows.push([child, 'directory', stat.mode & 0o777]); visit(absolute, child); }
      else if (stat.isSymbolicLink()) rows.push([child, 'symlink', fs.readlinkSync(absolute)]);
      else rows.push([child, 'file', stat.mode & 0o777, fs.readFileSync(absolute).toString('base64')]);
    }
  };
  visit(root); return rows;
}
async function stopDetachedAtlas(root) {
  let record;
  try { record = JSON.parse(fs.readFileSync(path.join(root, 'service.json'), 'utf8')); } catch { return; }
  const { owned } = require('../../tools/telemetry-atlas/lifecycle.cjs');
  if (record.pid !== process.pid && record.process_identity && owned(record.process_identity)) {
    process.kill(record.pid, 'SIGTERM');
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline && owned(record.process_identity)) await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(owned(record.process_identity), false, `detached Atlas fixture ${record.pid} stopped before cleanup`);
  }
}

test('board wrapper pauses for its exact worker reply before validating the completed board report', { skip: bashOnly, timeout: 25000 }, async t => {
  const parentRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-profile-parent-'));
  const parentLog = path.join(parentRoot, 'profile-resolution.jsonl'), sentinel = '{"fixture":"parent-before"}\n';
  fs.writeFileSync(parentLog, sentinel); t.after(() => fs.rmSync(parentRoot, { recursive: true, force: true }));
  const f = fixture(t, { parentEnv: { ...process.env, SGSD_CODEX_PROFILE_LOG: parentLog,
    SGSD_CODEX_PROFILES_REGISTRY: path.join(parentRoot, 'missing-profiles.yaml') } });
  const spec = dispatch.prepare({ memberName: 'sgsd-board-pragmatist', projectDir: f.root, promptFile: f.prompt,
    timeoutSeconds: 20, owner: f.env.SGSD_WORKER_OWNER });
  const running = launch(t, spec.argv, f, { WORKER_FIXTURE_MODE: 'question', WORKER_FIXTURE_REPORT: boardReport });
  const record = await waiting(f, running);
  assert.equal(fs.existsSync(spec.report_path), false, 'a pending question is not a validated report');
  assert.equal(record.owner, 'fable.fixture'); assert.equal(record.role, 'board');
  assert.equal(record.phase, '170'); assert.equal(record.plan, '170-03'); assert.equal(record.step, 'sgsd-board-pragmatist');
  const reply = spawnSync(process.execPath, [control, 'reply', '--project', f.root, '--worker', record.worker_id,
    '--request', record.pending[0].id, '--text', 'Check the bounded change first.'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(reply.status, 0, reply.stderr);
  const result = await running.done; assert.equal(result.code, 0, result.stderr);
  assert.equal(require('../../scripts/lib/deliberation-schema.cjs').validate(fs.readFileSync(spec.report_path, 'utf8')).valid, true);
  const start = frames(f).find(frame => frame.method === 'thread/start');
  assert.equal(start.params.model, 'gpt-5.6-luna'); assert.equal(start.params.sandbox, 'danger-full-access');
  assert.equal(start.params.approvalPolicy, 'never'); assert.equal(start.params.ephemeral, false);
  assert.equal(frames(f).find(frame => frame.method === 'turn/start').params.effort, 'max');
  assert.equal(fs.readFileSync(parentLog, 'utf8'), sentinel, 'ordinary fixture leaves the inherited parent profile log byte-unchanged');
  const profileRows = fs.readFileSync(f.profileLog, 'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(profileRows.some(row => row.action === 'resolve-cli' && row.status === 'fallback'),
    'real wrapper fallback evidence is written to the fixture-owned profile log');
});

test('review wrapper preserves the additive report contract and full-access worker metadata', { skip: bashOnly }, async t => {
  const f = fixture(t, { defaultDiscovery: true });
  const running = launch(t, [path.join(scripts, 'codex-exec.sh'), '--project', f.root, '--prompt-file', f.prompt,
    '--report-out', f.report, '--phase', '170', '--plan', '170-03', '--step', 'spec-review', '--timeout', '10'], f,
  { WORKER_FIXTURE_REPORT: reviewerReport });
  const result = await running.done; assert.equal(result.code, 0, result.stderr);
  assert.equal(fs.readFileSync(f.selectedExecutableLog, 'utf8').trim(), 'caller');
  assert.match(fs.readFileSync(f.report, 'utf8'), /FINDINGS_DETAIL: retained detail/);
  const record = mailbox.list(f.root)[0]; assert.equal(record.role, 'reviewer'); assert.equal(record.step, 'spec-review');
});

test('executor and explicit patch wrapper use the worker adapter and retain scoped completion', { skip: bashOnly }, async t => {
  for (const patch of [false, true]) {
    const f = fixture(t, { defaultDiscovery: true }), workspace = path.join(f.root, 'nested workspace'); fs.mkdirSync(workspace);
    fs.writeFileSync(path.join(workspace, 'a.txt'), 'before\n'); fs.writeFileSync(path.join(f.root, 'files.txt'), 'a.txt\n');
    const args = [path.join(scripts, patch ? 'codex-patch-executor.sh' : 'codex-executor.sh'), '--workspace', workspace,
      '--prompt-file', f.prompt, '--report-out', f.report, '--phase', '170', '--plan', '170-03', '--step', 'implementation', '--timeout', '10'];
    if (patch) args.push('--files', path.join(f.root, 'files.txt'), '--no-apply');
    const report = patch ? 'PATCH_BEGIN\ndiff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-before\n+after\nPATCH_END\nREPORT_BEGIN\nONE_LINER: fixture\nREPORT_END' : 'Executor completed fixture';
    const result = await launch(t, args, f, { WORKER_FIXTURE_REPORT: report }).done;
    assert.equal(result.code, 0, result.stderr); assert.ok(fs.readFileSync(f.report, 'utf8').includes(report));
    assert.equal(fs.readFileSync(f.selectedExecutableLog, 'utf8').trim(), 'caller');
    assert.equal(frames(f).filter(frame => frame.method === 'turn/start').length, 1);
    const record = mailbox.list(f.root)[0]; assert.equal(record.status, 'completed'); assert.equal(record.role, 'executor');
    assert.equal(record.plan, '170-03'); assert.equal(record.step, 'implementation');
    assert.equal(frames(f).find(frame => frame.method === 'thread/start').params.cwd, workspace);
    assert.equal(fs.existsSync(path.join(workspace, '.planning/worker-sessions')), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, '.planning/worker-sessions', record.worker_id, 'wrapper-result.json'))).exit_code, 0);
  }
});

test('explicit selectors are pinned before PATH and cwd changes with prefix argv intact', { skip: bashOnly }, async t => {
  for (const kind of ['basename', 'absolute', 'relative']) {
    const f = fixture(t, { defaultDiscovery: true });
    const workspace = path.join(f.root, 'nested workspace'); fs.mkdirSync(workspace);
    const selectedArgv = path.join(f.root, `selected argv ${kind}`);
    const env = { WORKER_FIXTURE_REPORT: 'Executor completed fixture', WORKER_FIXTURE_SELECTED_ARGV: selectedArgv };
    if (kind === 'basename') {
      env.SGSD_CODEX_COMMAND = 'codex';
    } else {
      const command = path.join(f.root, `selected ${kind} "quoted"`, 'codex command');
      writePeerCommand(command, `explicit-${kind}`);
      env.SGSD_CODEX_APP_SERVER_COMMAND = kind === 'absolute' ? command : path.relative(f.root, command);
      env.SGSD_CODEX_COMMAND = path.join(f.nvmBin, 'codex');
      env.SGSD_CODEX_APP_SERVER_ARGS = JSON.stringify(['prefix with spaces', 'prefix"quote']);
    }
    const result = await launch(t, [path.join(scripts, 'codex-executor.sh'), '--workspace', workspace,
      '--prompt-file', f.prompt, '--report-out', f.report, '--timeout', '10'], f, env).done;
    assert.equal(result.code, 0, result.stderr);
    assert.equal(fs.readFileSync(f.selectedExecutableLog, 'utf8').trim(), kind === 'basename' ? 'caller' : `explicit-${kind}`);
    const argv = JSON.parse(fs.readFileSync(selectedArgv, 'utf8'));
    if (kind !== 'basename') assert.deepEqual(argv.slice(0, 2), ['prefix with spaces', 'prefix"quote']);
    assert.equal(argv.filter(value => value === 'app-server').length, 1);
    assert.equal(frames(f).filter(frame => frame.method === 'turn/start').length, 1);
  }
});

test('default discovery falls back natively and env-node Codex runs when Node exists only in nvm', { skip: bashOnly }, async t => {
  const f = fixture(t, { defaultDiscovery: true });
  f.env.PATH = isolatedNativeTools(f.root);
  const result = await launch(t, [path.join(scripts, 'codex-executor.sh'), '--workspace', f.root,
    '--prompt-file', f.prompt, '--report-out', f.report, '--timeout', '10'], f,
  { WORKER_FIXTURE_REPORT: 'Executor completed fixture' }).done;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(fs.readFileSync(f.selectedExecutableLog, 'utf8').trim(), 'user-local');
  assert.equal(frames(f).filter(frame => frame.method === 'turn/start').length, 1);
});

test('invalid explicit selectors and interop executables fail without fallback dispatch', { skip: bashOnly }, async t => {
  for (const selector of ['missing-command', 'missing-app', 'interop']) {
    const f = fixture(t, { defaultDiscovery: true });
    const command = selector === 'interop' ? path.join(f.root, 'codex.exe') : 'missing-explicit-codex';
    if (selector === 'interop') writePeerCommand(command, 'must-not-run');
    const selection = selector === 'missing-app'
      ? { SGSD_CODEX_APP_SERVER_COMMAND: command, SGSD_CODEX_COMMAND: path.join(f.callerBin, 'codex') }
      : { SGSD_CODEX_COMMAND: command };
    const result = await launch(t, [path.join(scripts, 'codex-executor.sh'), '--workspace', f.root,
      '--prompt-file', f.prompt, '--report-out', f.report, '--timeout', '10'], f,
    { ...selection, WORKER_FIXTURE_REPORT: 'must not complete' }).done;
    assert.equal(result.code, 3, result.stderr);
    assert.match(result.stderr, selector === 'interop' ? /unsupported.*interop|interop.*unsupported/i : /not found/i);
    assert.equal(fs.existsSync(f.capture), false);
    assert.equal(fs.existsSync(f.selectedExecutableLog), false);
  }
});

test('help and dry-run checks do not require a real Codex', { skip: bashOnly }, t => {
  const f = fixture(t, { defaultDiscovery: true });
  const emptyHome = path.join(f.root, 'empty home'); fs.mkdirSync(emptyHome);
  const env = { ...f.env, HOME: emptyHome, USERPROFILE: emptyHome,
    PATH: `${path.dirname(fs.realpathSync(process.execPath))}:${isolatedNativeTools(f.root)}` };
  delete env.SGSD_CODEX_APP_SERVER_COMMAND;
  delete env.SGSD_CODEX_COMMAND;
  for (const name of ['codex-exec.sh', 'codex-executor.sh', 'codex-patch-executor.sh']) {
    const help = spawnSync('bash', [path.join(scripts, name), '--help'], { cwd: f.root, env, encoding: 'utf8', timeout: 5000 });
    assert.equal(help.status, 0, `${name}: ${help.stderr}`);
    const args = [path.join(scripts, name), name === 'codex-exec.sh' ? '--project' : '--workspace', f.root,
      '--prompt-file', f.prompt, '--report-out', f.report, '--dry-run'];
    if (name === 'codex-patch-executor.sh') {
      fs.writeFileSync(path.join(f.root, 'files'), 'a.txt\n'); fs.writeFileSync(path.join(f.root, 'a.txt'), 'before\n');
      args.push('--files', path.join(f.root, 'files'), '--no-apply');
    }
    const dryRun = spawnSync('bash', args, { cwd: f.root, env, encoding: 'utf8', timeout: 5000 });
    assert.equal(dryRun.status, 0, `${name}: ${dryRun.stderr}`);
    assert.match(dryRun.stdout, /DRY RUN/);
  }
});

test('offline exit-priority table bypasses executable selection', { skip: bashOnly }, t => {
  const f = fixture(t, { defaultDiscovery: true });
  const emptyHome = path.join(f.root, 'empty home'); fs.mkdirSync(emptyHome);
  const env = { ...f.env, HOME: emptyHome, USERPROFILE: emptyHome,
    PATH: `${path.dirname(fs.realpathSync(process.execPath))}:/usr/bin:/bin`,
    SGSD_CODEX_COMMAND: path.join(f.root, 'nonexistent-codex-offline-review') };
  delete env.SGSD_CODEX_APP_SERVER_COMMAND;
  const result = spawnSync('bash', [path.join(scripts, 'codex-exec.sh'), '--prompt-file', '/dev/null',
    '--report-out', '/dev/null', '--project', f.root, '--self-test-exit-priority'],
  { cwd: f.root, env, encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /exit priority table/);
  assert.equal(fs.existsSync(f.capture), false);
});

test('fake-only online self-test pins the incoming CLI before PATH recovery', { skip: bashOnly, timeout: 65000 }, t => {
  const f = fixture(t, { defaultDiscovery: true });
  const result = spawnSync('bash', [path.join(scripts, 'codex-exec.sh'), '--self-test'],
    { cwd: f.root, env: { ...f.env, WORKER_FIXTURE_REPORT: reviewerReport }, encoding: 'utf8', timeout: 55000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.equal(fs.readFileSync(f.selectedExecutableLog, 'utf8').trim(), 'caller');
  assert.equal(frames(f).filter(frame => frame.method === 'turn/start').length, 1);
});

test('online self-test diagnoses explicit invalid and interop selectors without dispatching a fallback', { skip: bashOnly }, t => {
  for (const kind of ['missing', 'interop']) {
    const f = fixture(t, { defaultDiscovery: true });
    const command = kind === 'missing' ? `missing-${path.basename(f.root).replace(/[^a-zA-Z0-9]/g, '')}` : path.join(f.root, 'codex.exe');
    if (kind === 'missing') {
      writePeerCommand(path.join(f.localBin, command), 'must-not-run');
      writePeerCommand(path.join(f.nvmBin, command), 'must-not-run');
    } else writePeerCommand(command, 'must-not-run');
    const result = spawnSync('bash', [path.join(scripts, 'codex-exec.sh'), '--self-test'],
      { cwd: f.root, env: { ...f.env, PATH: isolatedNativeTools(f.root), SGSD_CODEX_COMMAND: command,
        WORKER_FIXTURE_REPORT: reviewerReport }, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 10, result.stdout + result.stderr);
    assert.match(result.stdout, /Probe 1 PATH:\s+FAIL/);
    assert.equal(fs.existsSync(f.capture), false);
    assert.equal(fs.existsSync(f.selectedExecutableLog), false);
  }
});

test('failed and timed-out workers keep wrapper failure codes without reporting success', { skip: bashOnly, timeout: 20000 }, async t => {
  for (const [mode, code] of [['fail', 1], ['wait', 5]]) {
    const f = fixture(t);
    const result = await launch(t, [path.join(scripts, 'codex-exec.sh'), '--project', f.root, '--prompt-file', f.prompt,
      '--report-out', f.report, '--timeout', mode === 'wait' ? '1' : '5'], f, { WORKER_FIXTURE_MODE: mode }).done;
    assert.equal(result.code, code, result.stderr); assert.doesNotMatch(result.stdout, /codex-exec: OK/);
    assert.notEqual(mailbox.list(f.root)[0].status, 'completed');
  }
});

test('prompt FIFO deadline bounds opening and unfinished input without leaving descendants', { skip: process.platform !== 'linux', timeout: 42000 }, async t => {
  function descendants(pid) {
    try {
      return fs.readFileSync(`/proc/${pid}/task/${pid}/children`, 'utf8').trim().split(/\s+/).filter(Boolean)
        .map(Number).flatMap(child => [child, ...descendants(child)]);
    } catch { return []; }
  }
  function alive(pid) {
    try { return !/\) Z /.test(fs.readFileSync(`/proc/${pid}/stat`, 'utf8')); } catch { return false; }
  }
  for (const name of ['codex-exec.sh', 'codex-executor.sh']) {
    for (const hasProducer of [false, true]) {
      const f = fixture(t), fifo = path.join(f.root, 'prompt pipe');
      const created = spawnSync('mkfifo', [fifo], { env: f.env, encoding: 'utf8' }); assert.equal(created.status, 0, created.stderr);
      let producer;
      if (hasProducer) {
        producer = fs.openSync(fifo, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
        fs.writeSync(producer, 'A partial prompt whose producer deliberately stays open.\n');
      }
      const child = spawn('bash', [path.join(scripts, name), name === 'codex-exec.sh' ? '--project' : '--workspace',
        f.root, '--prompt-file', fifo, '--report-out', f.report, '--timeout', '1'],
      { cwd: f.root, env: f.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '', exited = false;
      const owned = new Set();
      const collect = setInterval(() => { for (const pid of descendants(child.pid)) owned.add(pid); }, 25);
      const done = new Promise((resolve, reject) => {
        child.on('error', reject); child.on('close', code => { exited = true; resolve(code); });
      });
      child.stdout.on('data', chunk => { stdout += chunk; }); child.stderr.on('data', chunk => { stderr += chunk; });
      function cleanup() {
        clearInterval(collect);
        for (const pid of [...descendants(child.pid), ...owned].reverse()) {
          try { process.kill(pid, 'SIGKILL'); } catch {}
        }
        if (!exited) child.kill('SIGKILL');
        if (producer !== undefined) { fs.closeSync(producer); producer = undefined; }
      }
      t.after(cleanup);
      let guard;
      const code = await Promise.race([done, new Promise(resolve => {
        guard = setTimeout(() => { cleanup(); resolve('deadline-not-enforced'); }, 8000);
      })]);
      clearTimeout(guard); clearInterval(collect);
      if (producer !== undefined) { fs.closeSync(producer); producer = undefined; }
      assert.equal(code, 5, `${name} producer=${hasProducer}: ${stderr}`);
      assert.doesNotMatch(stdout, /codex-(?:exec|executor): OK/);
      assert.equal(fs.existsSync(f.capture), false, 'an incomplete prompt must not dispatch any model task');
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.deepEqual([...owned].filter(alive), [], 'the deadline must clean up its own descendants');
    }
  }
});

test('forced Windows interop fails explicitly before any provider or worker dispatch', { skip: bashOnly }, async t => {
  const f = fixture(t);
  const result = await launch(t, [path.join(scripts, 'codex-executor.sh'), '--workspace', f.root,
    '--prompt-file', f.prompt, '--report-out', f.report], f, { SGSD_CODEX_FORCE_LAUNCHER: 'cmd' }).done;
  assert.equal(result.code, 3, result.stderr); assert.match(result.stderr, /unsupported.*interop|interop.*unsupported/i);
  assert.equal(fs.existsSync(f.capture), false);
});

function isolatedLegacyCommand(f) {
  const bin = path.join(f.root, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'codex'), '#!/usr/bin/env node\nprocess.stderr.write("fixture refuses legacy one-shot dispatch\\n"); process.exit(91);\n', { mode: 0o700 });
  return { ...f.env, PATH: `${bin}:${path.dirname(fs.realpathSync(process.execPath))}:/usr/bin:/bin` };
}
test('backlog rerun uses a retained reviewer worker with review metadata', { skip: bashOnly }, t => {
  const f = fixture(t), env = isolatedLegacyCommand(f);
  const result = spawnSync(process.execPath, [path.resolve(__dirname, '../../tools/codex-rerun/rerun-missing-reviews.cjs'),
    '--id', '2026-04-26T23-13-37-843Z-3584'], { cwd: f.root, encoding: 'utf8', timeout: 15000,
    env: { ...env, WORKER_FIXTURE_REPORT: reviewerReport } });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const record = mailbox.list(f.root)[0]; assert.equal(record.role, 'reviewer'); assert.equal(record.phase, '26');
  assert.equal(record.plan, 'phase-level'); assert.equal(record.step, 'backlog-rerun');
  assert.equal(record.status, 'completed');
});

test('double-agent worktree execution retains its worker record in the supervising project', { skip: bashOnly }, t => {
  const f = fixture(t), env = isolatedLegacyCommand(f);
  fs.writeFileSync(path.join(f.root, 'example.txt'), 'fixture\n');
  // This commit exists only in the disposable fixture repository to exercise
  // the production git-worktree workflow without touching the SGSD checkout.
  for (const args of [['init'], ['add', 'example.txt'], ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'fixture']]) {
    const git = spawnSync('git', args, { cwd: f.root, env, encoding: 'utf8', timeout: 10000 }); assert.equal(git.status, 0, git.stderr);
  }
  const capsule = { schema_version: 1, task_id: 'worker-fixture', milestone: 'fixture-worker', phase: 170,
    role: 'executor', task_kind: 'code_edit', goal: 'Review a bounded fixture.', allowed_files: ['example.txt'],
    acceptance_commands: ['node --version'], risk: 'medium', ambiguity: 'low', requires_private_knowledge: false, estimated_line_count: 20 };
  const opts = { projectDir: f.root, planningDir: path.join(f.root, '.planning'), forceCodexHealth: true, timeoutMs: 10000 };
  const code = 'const mod = require(process.argv[1]); process.stdout.write(JSON.stringify(mod.runCapsule(JSON.parse(process.argv[2]), JSON.parse(process.argv[3]))));';
  const result = spawnSync(process.execPath, ['-e', code, path.resolve(__dirname, '../../tools/double-agent-executor/run.cjs'),
    JSON.stringify(capsule), JSON.stringify(opts)], { cwd: f.root, env: { ...env, WORKER_FIXTURE_REPORT: 'bounded worktree fixture completed' },
    encoding: 'utf8', timeout: 20000 });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout); assert.equal(output.result.status, 'accepted_patch_written', JSON.stringify(output.result));
  const record = mailbox.list(f.root)[0]; assert.equal(record.role, 'executor'); assert.equal(record.phase, '170');
  assert.equal(record.step, 'worker-fixture'); assert.equal(record.status, 'completed');
  assert.equal(fs.existsSync(output.result.worktree_dir), false, 'worktree cleanup preserves the project-owned worker evidence');
});

test('provider-health diagnostic canary requires full-access and never approval', { skip: bashOnly }, t => {
  const f = fixture(t), env = isolatedLegacyCommand(f), argvPath = path.join(f.root, 'canary-args');
  fs.writeFileSync(path.join(f.root, 'bin/codex'), '#!/usr/bin/env node\nrequire("node:fs").writeFileSync(process.env.CANARY_ARGV, JSON.stringify(process.argv.slice(2))); process.stdin.resume(); process.stdin.on("end", () => process.stdout.write(process.env.WORKER_FIXTURE_REPORT));\n', { mode: 0o700 });
  const result = spawnSync(process.execPath, ['-e', 'process.stdout.write(JSON.stringify(require(process.argv[1]).probeCodexCanary()))',
    path.resolve(__dirname, '../../tools/provider-health/check.cjs')], { cwd: f.root, env: { ...env, CANARY_ARGV: argvPath,
    WORKER_FIXTURE_REPORT: reviewerReport }, encoding: 'utf8', timeout: 10000 });
  assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).available, true);
  const argv = JSON.parse(fs.readFileSync(argvPath)); assert.equal(argv[argv.indexOf('--sandbox') + 1], 'danger-full-access');
  assert.equal(argv[argv.indexOf('--ask-for-approval') + 1], 'never'); assert.equal(argv.includes('--ephemeral'), false);
});

test('offline wrapper self-tests exercise worker transport without a model call', { skip: bashOnly, timeout: 65000 }, t => {
  for (const name of ['codex-exec.sh', 'codex-executor.sh']) {
    const f = fixture(t), env = isolatedLegacyCommand(f);
    const result = spawnSync('bash', [path.join(scripts, name), '--self-test', '--skip-network'],
      { cwd: f.root, env, encoding: 'utf8', timeout: 55000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
});

test('offline wrapper self-tests leave enabled production Atlas and project metrics byte-unchanged',
  { skip: bashOnly, timeout: 130000 }, async t => {
    for (const name of ['codex-exec.sh', 'codex-executor.sh']) {
      const f = fixture(t), env = isolatedLegacyCommand(f);
      const relativeScripts = path.join(f.root, 'relative wrapper scripts');
      fs.symlinkSync(scripts, relativeScripts, 'dir');
      const wrapper = path.relative(f.root, path.join(relativeScripts, name));
      const atlasRoot = path.join(f.root, 'production atlas');
      const productionProject = path.join(f.root, 'production project');
      fs.mkdirSync(path.join(productionProject, '.planning'), { recursive: true });
      atlas.registerRun({ root: atlasRoot, projectDir: productionProject, provider: 'openai', role: 'executor' });
      const receiver = await atlas.startGlobal({ root: atlasRoot });
      t.after(() => receiver.close());
      const metricsRoot = path.join(f.root, '.planning/metrics');
      const metrics = path.join(metricsRoot, 'codex-log.jsonl');
      const profileLog = path.join(metricsRoot, 'custom-profile-resolution.jsonl');
      const sourceMetrics = path.resolve(__dirname, '../../..', '.planning/metrics');
      fs.mkdirSync(metricsRoot, { recursive: true });
      fs.writeFileSync(metrics, '{"fixture":"production-before-self-test"}\n');
      fs.writeFileSync(path.join(metricsRoot, 'existing-ledger.jsonl'), '{"fixture":"other-production-metric"}\n');
      fs.writeFileSync(profileLog, '{"fixture":"profile-resolution-before-self-test"}\n');
      const beforeAtlas = treeSnapshot(atlasRoot), beforeMetrics = treeSnapshot(metricsRoot);
      const beforeSourceMetrics = treeSnapshot(sourceMetrics);
      const result = await launch(t, [wrapper, '--self-test', '--skip-network'], f,
        { ...env, SGSD_ATLAS_DISABLED: '', SGSD_ATLAS_GLOBAL_ROOT: atlasRoot,
          SGSD_CODEX_PROFILE: 'unknown.fixture', SGSD_CODEX_PROFILE_LOG: profileLog }).done;
      assert.equal(result.code, 0, result.stdout + result.stderr);
      if (name === 'codex-exec.sh') {
        assert.match(result.stdout, /Probe 5 profiles:\s+PASS/); assert.match(result.stdout, /Probe 6 finalize:\s+PASS/);
        assert.match(result.stdout, /Exit: 0/);
      } else assert.match(result.stdout, /codex-executor self-test: full-access worker completion PASS/);
      assert.deepEqual(treeSnapshot(atlasRoot), beforeAtlas, `${name}: enabled parent Atlas root is diagnostic-read-only`);
      assert.deepEqual(treeSnapshot(metricsRoot), beforeMetrics, `${name}: offline diagnostics do not change any production metric`);

      const emptyHome = path.join(f.root, 'empty default home'); fs.mkdirSync(emptyHome);
      const fallbackRegistry = path.join(f.root, name === 'codex-exec.sh' ? 'corrupt-profiles.yaml' : 'missing-profiles.yaml');
      if (name === 'codex-exec.sh') fs.writeFileSync(fallbackRegistry, 'not: [valid');
      const defaultRoot = path.join(emptyHome, '.local/state/sgsd/telemetry/global');
      t.after(() => stopDetachedAtlas(defaultRoot));
      const absent = await launch(t, [wrapper, '--self-test', '--skip-network'], f,
        { ...env, HOME: emptyHome, USERPROFILE: emptyHome, SGSD_ATLAS_DISABLED: '', SGSD_ATLAS_GLOBAL_ROOT: '',
          SGSD_CODEX_PROFILE: 'unknown.fixture', SGSD_CODEX_PROFILE_LOG: '', SGSD_CODEX_PROFILES_REGISTRY: fallbackRegistry }).done;
      assert.equal(absent.code, 0, absent.stdout + absent.stderr);
      assert.equal(fs.existsSync(defaultRoot), false, `${name}: an absent default Atlas root remains absent`);
      assert.deepEqual(treeSnapshot(metricsRoot), beforeMetrics, `${name}: repeated offline diagnostics remain metrics-read-only`);
      assert.deepEqual(treeSnapshot(sourceMetrics), beforeSourceMetrics, `${name}: default profile logging remains source-read-only`);
    }
  });

test('explicit timeout escalation retains dispatch arguments and records both worker attempts', { skip: bashOnly, timeout: 22000 }, async t => {
  const f = fixture(t), entry = path.join(f.root, 'retry-peer.cjs'), attempts = path.join(f.root, 'attempts');
  fs.writeFileSync(path.join(f.root, '.planning/config.json'), JSON.stringify({ review_providers: { codex_timeout_tiers: { analysis: 5 } } }));
  fs.writeFileSync(entry, 'const fs=require("node:fs"); const file=process.env.RETRY_ATTEMPTS; const count=fs.existsSync(file)?Number(fs.readFileSync(file)):0; fs.writeFileSync(file,String(count+1)); process.env.WORKER_FIXTURE_MODE=count?"complete":"wait"; require(process.env.RETRY_PEER);\n');
  const result = await launch(t, [path.join(scripts, 'codex-exec.sh'), '--project', f.root, '--prompt-file', f.prompt,
    '--report-out', f.report, '--phase', '170', '--plan', '170-03', '--step', 'phase-level-ATC', '--timeout', '1',
    '--retry-on-timeout-escalate'], f, { SGSD_CODEX_APP_SERVER_ARGS: JSON.stringify([entry]), RETRY_PEER: peer,
    RETRY_ATTEMPTS: attempts, WORKER_FIXTURE_REPORT: reviewerReport }).done;
  assert.equal(result.code, 0, result.stderr);
  assert.equal(fs.readFileSync(attempts, 'utf8'), '2');
  const records = mailbox.list(f.root); assert.equal(records.length, 2);
  assert.ok(records.every(row => row.owner === 'fable.fixture' && row.phase === '170' && row.plan === '170-03' && row.step === 'phase-level-ATC'));
  assert.deepEqual(records.map(row => row.status).sort(), ['completed', 'timed_out']);
  assert.deepEqual(records.map(row => JSON.parse(fs.readFileSync(path.join(f.root, '.planning/worker-sessions', row.worker_id, 'wrapper-result.json'))).exit_code).sort(), [0, 5]);
  const log = fs.readFileSync(path.join(f.root, '.planning/metrics/codex-log.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(log.map(row => row.exit), [5, 0]);
});

test('durable wrapper receipt binds its validated exit and report hash to the exact worker', { skip: bashOnly }, async t => {
  for (const [report, code] of [[reviewerReport, 0], ['invalid review report', 6]]) {
    const f = fixture(t);
    const result = await launch(t, [path.join(scripts, 'codex-exec.sh'), '--project', f.root,
      '--prompt-file', f.prompt, '--report-out', f.report, '--timeout', '10'], f, { WORKER_FIXTURE_REPORT: report }).done;
    assert.equal(result.code, code, result.stderr);
    const record = mailbox.list(f.root)[0]; assert.equal(record.status, 'completed', 'core completion does not substitute for validation');
    const receiptPath = path.join(f.root, '.planning/worker-sessions', record.worker_id, 'wrapper-result.json');
    assert.ok(fs.existsSync(receiptPath), 'wrapper completion must survive loss of the background handle');
    const receipt = JSON.parse(fs.readFileSync(receiptPath));
    assert.equal(receipt.worker_id, record.worker_id); assert.equal(receipt.wrapper_attempt_id, record.wrapper_attempt_id);
    assert.equal(receipt.exit_code, code); assert.equal(receipt.report_path, f.report);
    assert.equal(receipt.sha256, require('node:crypto').createHash('sha256').update(fs.readFileSync(f.report)).digest('hex'));
    assert.equal(receipt.bytes, fs.statSync(f.report).size);
  }
});

test('receipt persistence failure cannot print or log wrapper success', { skip: bashOnly, timeout: 22000 }, async t => {
  const f = fixture(t);
  const running = launch(t, [path.join(scripts, 'codex-exec.sh'), '--project', f.root,
    '--prompt-file', f.prompt, '--report-out', f.report, '--timeout', '15'], f,
  { WORKER_FIXTURE_MODE: 'question', WORKER_FIXTURE_REPORT: reviewerReport });
  const record = await waiting(f, running);
  fs.mkdirSync(path.join(f.root, '.planning/worker-sessions', record.worker_id, 'wrapper-result.json'));
  const reply = spawnSync(process.execPath, [control, 'reply', '--project', f.root, '--worker', record.worker_id,
    '--request', record.pending[0].id, '--text', 'Continue the bounded task.'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(reply.status, 0, reply.stderr);
  const result = await running.done; assert.equal(result.code, 9, result.stderr);
  assert.doesNotMatch(result.stdout, /codex-exec: OK/);
  const log = fs.readFileSync(path.join(f.root, '.planning/metrics/codex-log.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(log.at(-1).exit, 9);
});

test('explicit patch work still requires the allowlist and successful git apply before its receipt can succeed', { skip: bashOnly }, async t => {
  for (const valid of [true, false]) {
    const f = fixture(t); fs.writeFileSync(path.join(f.root, 'a.txt'), 'before\n');
    fs.writeFileSync(path.join(f.root, 'files'), 'a.txt\n');
    const git = spawnSync('git', ['init'], { cwd: f.root, env: f.env, encoding: 'utf8', timeout: 5000 }); assert.equal(git.status, 0, git.stderr);
    const report = `PATCH_BEGIN\ndiff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-${valid ? 'before' : 'wrong context'}\n+after\nPATCH_END\nREPORT_BEGIN\nONE_LINER: fixture\nREPORT_END`;
    const result = await launch(t, [path.join(scripts, 'codex-patch-executor.sh'), '--workspace', f.root,
      '--prompt-file', f.prompt, '--report-out', f.report, '--files', path.join(f.root, 'files'), '--timeout', '10'], f,
    { WORKER_FIXTURE_REPORT: report }).done;
    assert.equal(result.code, valid ? 0 : 6, result.stderr);
    assert.equal(fs.readFileSync(path.join(f.root, 'a.txt'), 'utf8'), valid ? 'after\n' : 'before\n');
    const record = mailbox.list(f.root)[0];
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, '.planning/worker-sessions', record.worker_id, 'wrapper-result.json'))).exit_code, result.code);
    if (!valid) assert.doesNotMatch(fs.readFileSync(f.report, 'utf8'), /SGSD_PATCH_APPLY: success/);
  }
});
