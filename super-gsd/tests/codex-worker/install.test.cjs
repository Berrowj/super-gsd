'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const source = path.resolve(__dirname, '../..');
test('isolated global install delivers the full worker closure and its installed wrapper runs it', { skip: process.platform !== 'linux', timeout: 180000 }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-install-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixtureHome = path.join(root, 'home'), project = path.join(root, 'project'); fs.mkdirSync(project);
  fs.mkdirSync(path.join(fixtureHome, '.claude/get-shit-done'), { recursive: true });
  const nodeExecutable = fs.realpathSync(process.execPath);
  const env = { ...process.env, HOME: fixtureHome, USERPROFILE: fixtureHome, OPENAI_API_KEY: '', SGSD_ATLAS_DISABLED: '1',
    PATH: `${path.dirname(nodeExecutable)}:${process.env.PATH}` };
  const result = spawnSync('bash', [path.join(source, 'install.sh'), '--install-global', '--project-dir', project],
    { cwd: project, env, encoding: 'utf8', timeout: 150000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const installed = path.join(fixtureHome, '.claude/super-gsd');
  for (const file of ['run.cjs', 'rpc.cjs', 'mailbox.cjs', 'control.cjs', 'fixtures/app-server.cjs']) {
    const target = path.join(installed, 'tools/codex-worker', file);
    assert.ok(fs.existsSync(target), `installed runtime closure includes ${file}`);
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(source, 'tools/codex-worker', file)));
  }
  assert.deepEqual(fs.readFileSync(path.join(installed, 'scripts/lib/sgsd-state.cjs')), fs.readFileSync(path.join(source, 'scripts/lib/sgsd-state.cjs')));
  fs.mkdirSync(path.join(project, '.planning')); fs.writeFileSync(path.join(project, 'prompt'), 'Installed runtime fixture.\n');
  const report = path.join(project, 'report');
  const run = spawnSync('bash', [path.join(installed, 'scripts/codex-executor.sh'), '--workspace', project,
    '--prompt-file', path.join(project, 'prompt'), '--report-out', report, '--timeout', '10'],
  { cwd: project, env: { ...env, SGSD_CODEX_APP_SERVER_COMMAND: nodeExecutable,
    SGSD_CODEX_APP_SERVER_ARGS: JSON.stringify([path.join(installed, 'tools/codex-worker/fixtures/app-server.cjs')]),
    WORKER_FIXTURE_MODE: 'complete', WORKER_FIXTURE_REPORT: 'installed worker completed',
    SGSD_CODEX_COMMAND: path.join(root, 'no-legacy-fallback') }, encoding: 'utf8', timeout: 20000 });
  assert.equal(run.status, 0, run.stderr); assert.match(fs.readFileSync(report, 'utf8'), /installed worker completed/);
  const status = spawnSync(nodeExecutable, [path.join(installed, 'tools/codex-worker/control.cjs'), 'status', '--project', project],
    { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(status.status, 0, status.stderr); assert.equal(JSON.parse(status.stdout).workers[0].status, 'completed');
  const record = JSON.parse(status.stdout).workers[0];
  const receipt = JSON.parse(fs.readFileSync(path.join(project, '.planning/worker-sessions', record.worker_id, 'wrapper-result.json')));
  assert.equal(receipt.exit_code, 0); assert.equal(receipt.report_path, report);
  assert.equal(receipt.sha256, require('node:crypto').createHash('sha256').update(fs.readFileSync(report)).digest('hex'));
  const flat = spawnSync(nodeExecutable, [path.join(fixtureHome, '.claude/tools/codex-worker/control.cjs'), 'status', '--project', project],
    { env, encoding: 'utf8', timeout: 5000 });
  assert.equal(flat.status, 0, flat.stderr); assert.equal(JSON.parse(flat.stdout).workers[0].worker_id, record.worker_id);
});
