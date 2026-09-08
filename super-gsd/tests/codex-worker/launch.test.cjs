'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const mailbox = require('../../tools/codex-worker/mailbox.cjs');
const dispatch = require('../../scripts/lib/board-dispatch.cjs');
const scripts = path.resolve(__dirname, '../../scripts');
const peer = path.resolve(__dirname, '../../tools/codex-worker/fixtures/app-server.cjs');
const control = path.resolve(__dirname, '../../tools/codex-worker/control.cjs');
const bashOnly = process.platform === 'win32' ? 'Run the Bash process tests under WSL/Linux' : false;
const boardReport = 'position: SUPPORT\nconfidence: 4\nrisks_raised: []\nevidence_cited: []\nfalsifier: a failed test\nimplementation_concerns: []\nknown_deadends: []\nintuition: bounded\nwhy_principled: evidence\nrationale: fixture\n';
const reviewerReport = 'FINDINGS: none\nCRITICAL: 0\nWARNINGS: 0\nPASS_RATE: 1/1\nONE_LINER: fixture\nFINDINGS_DETAIL: retained detail\n';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "worker launch 'quoted'-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.planning'));
  fs.writeFileSync(path.join(root, '.planning/STATE.md'), '---\nmilestone: fixture-worker\ncurrent_phase: "170"\ncurrent_plan: "170-03"\n---\n');
  const prompt = path.join(root, 'prompt.md'), report = path.join(root, 'report.txt'), capture = path.join(root, 'rpc.jsonl');
  fs.writeFileSync(prompt, 'Bounded fixture task. Ask the supervising unit if context is missing.\n');
  const fixtureHome = path.join(root, 'home'); fs.mkdirSync(fixtureHome);
  const env = { ...process.env, HOME: fixtureHome, USERPROFILE: fixtureHome,
    PATH: `${path.dirname(fs.realpathSync(process.execPath))}:/usr/bin:/bin`,
    OPENAI_API_KEY: '', SGSD_ATLAS_DISABLED: '1', SGSD_CODEX_APP_SERVER_COMMAND: process.execPath,
    SGSD_CODEX_APP_SERVER_ARGS: JSON.stringify([peer]), WORKER_FIXTURE_CAPTURE: capture, WORKER_FIXTURE_MODE: 'complete',
    SGSD_CODEX_COMMAND: path.join(root, 'must-not-use-one-shot'), SGSD_WORKER_OWNER: 'fable.fixture' };
  delete env.SGSD_CODEX_FORCE_LAUNCHER; delete env.SGSD_WORKER_RESUME_ID;
  return { root, prompt, report, capture, env };
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

test('board wrapper pauses for its exact worker reply before validating the completed board report', { skip: bashOnly, timeout: 25000 }, async t => {
  const f = fixture(t);
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
});

test('review wrapper preserves the additive report contract and full-access worker metadata', { skip: bashOnly }, async t => {
  const f = fixture(t);
  const running = launch(t, [path.join(scripts, 'codex-exec.sh'), '--project', f.root, '--prompt-file', f.prompt,
    '--report-out', f.report, '--phase', '170', '--plan', '170-03', '--step', 'spec-review', '--timeout', '10'], f,
  { WORKER_FIXTURE_REPORT: reviewerReport });
  const result = await running.done; assert.equal(result.code, 0, result.stderr);
  assert.match(fs.readFileSync(f.report, 'utf8'), /FINDINGS_DETAIL: retained detail/);
  const record = mailbox.list(f.root)[0]; assert.equal(record.role, 'reviewer'); assert.equal(record.step, 'spec-review');
});

test('executor and explicit patch wrapper use the worker adapter and retain scoped completion', { skip: bashOnly }, async t => {
  for (const patch of [false, true]) {
    const f = fixture(t), workspace = path.join(f.root, 'nested workspace'); fs.mkdirSync(workspace);
    fs.writeFileSync(path.join(workspace, 'a.txt'), 'before\n'); fs.writeFileSync(path.join(f.root, 'files.txt'), 'a.txt\n');
    const args = [path.join(scripts, patch ? 'codex-patch-executor.sh' : 'codex-executor.sh'), '--workspace', workspace,
      '--prompt-file', f.prompt, '--report-out', f.report, '--phase', '170', '--plan', '170-03', '--step', 'implementation', '--timeout', '10'];
    if (patch) args.push('--files', path.join(f.root, 'files.txt'), '--no-apply');
    const report = patch ? 'PATCH_BEGIN\ndiff --git a/a.txt b/a.txt\n--- a/a.txt\n+++ b/a.txt\n@@ -1 +1 @@\n-before\n+after\nPATCH_END\nREPORT_BEGIN\nONE_LINER: fixture\nREPORT_END' : 'Executor completed fixture';
    const result = await launch(t, args, f, { WORKER_FIXTURE_REPORT: report }).done;
    assert.equal(result.code, 0, result.stderr); assert.ok(fs.readFileSync(f.report, 'utf8').includes(report));
    const record = mailbox.list(f.root)[0]; assert.equal(record.status, 'completed'); assert.equal(record.role, 'executor');
    assert.equal(record.plan, '170-03'); assert.equal(record.step, 'implementation');
    assert.equal(frames(f).find(frame => frame.method === 'thread/start').params.cwd, workspace);
    assert.equal(fs.existsSync(path.join(workspace, '.planning/worker-sessions')), false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.root, '.planning/worker-sessions', record.worker_id, 'wrapper-result.json'))).exit_code, 0);
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
