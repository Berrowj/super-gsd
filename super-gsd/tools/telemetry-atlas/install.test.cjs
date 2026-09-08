'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const sourceRoot = path.resolve(__dirname, '../../..');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

test('real global install delivers self-contained Atlas and installed statusline records quota without changing stdout', { skip: process.platform !== 'linux', timeout: 180000 }, t => {
  // Resolve Node before isolating HOME: installer and hooks must not depend on
  // an NVM shim whose target is re-resolved under the empty fixture home.
  const nodeExecutable = fs.realpathSync(process.execPath);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-atlas-global-install-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixtureHome = path.join(root, 'home');
  const projectDir = path.join(root, 'project');
  const stateDir = path.join(root, 'state');
  fs.mkdirSync(projectDir); fs.mkdirSync(path.join(fixtureHome, '.claude', 'get-shit-done'), { recursive: true });
  const env = { ...process.env, HOME: fixtureHome, USERPROFILE: fixtureHome,
    PATH: `${path.dirname(nodeExecutable)}${path.delimiter}${process.env.PATH || ''}` };
  for (const key of Object.keys(env)) if (key.startsWith('SGSD_ATLAS_') || key === 'SGSD_RUN_ID') delete env[key];
  const installed = spawnSync('bash', [path.join(sourceRoot, 'super-gsd', 'install.sh'), '--install-global', '--project-dir', projectDir], {
    cwd: projectDir, env, encoding: 'utf8', timeout: 150000, maxBuffer: 4 * 1024 * 1024,
  });
  const targetRoot = path.join(fixtureHome, '.claude', 'tools', 'telemetry-atlas');
  assert.ok(fs.existsSync(path.join(targetRoot, 'quota-sampler.cjs')), 'global statusline sibling quota sampler is installed');
  for (const name of fs.readdirSync(__dirname)) {
    if (!fs.statSync(path.join(__dirname, name)).isFile()) continue;
    assert.ok(fs.existsSync(path.join(targetRoot, name)), `global Atlas file delivered: ${name}`);
    assert.equal(hash(path.join(targetRoot, name)), hash(path.join(__dirname, name)), `global Atlas hash matches: ${name}`);
  }
  // Activate the hook's existing SGSD-project branch only after the global
  // installation, keeping this fixture independent of project-install closure.
  fs.mkdirSync(path.join(projectDir, '.planning'));
  const input = JSON.stringify({ version: '2.1.251', session_id: 'global-fixture-session', prompt_id: 'global-fixture-prompt',
    model: { display_name: 'Claude' }, workspace: { current_dir: projectDir },
    rate_limits: { five_hour: { used_percentage: 12, resets_at: 1788796800 }, seven_day: { used_percentage: 24, resets_at: 1789250400 } },
    context_window: { used_percentage: 25, current_usage: { input_tokens: 3, output_tokens: 2, cache_read_input_tokens: 5 } },
    prompt: 'PRIVATE_GLOBAL_INSTALL_CANARY@example.invalid',
  });
  const statusline = path.join(fixtureHome, '.claude', 'hooks', 'sgsd-statusline.js');
  const disabled = spawnSync(nodeExecutable, [statusline], { cwd: projectDir, env, input, encoding: 'utf8', timeout: 5000 });
  assert.equal(disabled.status, 0); assert.equal(disabled.stderr, ''); assert.match(disabled.stdout, /Claude/);
  assert.equal(fs.existsSync(stateDir), false, 'global installation and disabled hook do not enable telemetry');
  const enabled = spawnSync(nodeExecutable, [statusline], { cwd: projectDir, env: { ...env,
    SGSD_ATLAS_STATE_DIR: stateDir, SGSD_RUN_ID: 'global-fixture-run', SGSD_PROJECT_DIR: projectDir },
    input, encoding: 'utf8', timeout: 5000 });
  assert.equal(enabled.status, 0); assert.equal(enabled.stderr, ''); assert.equal(enabled.stdout, disabled.stdout);
  const spool = path.join(stateDir, 'quota-spool');
  assert.ok(fs.existsSync(spool), 'installed global statusline writes content-free quota spool');
  const files = fs.readdirSync(spool).filter(name => name.endsWith('.json')); assert.equal(files.length, 2);
  const rows = files.map(name => JSON.parse(fs.readFileSync(path.join(spool, name), 'utf8')));
  assert.deepEqual(rows.map(row => row.quota.window).sort(), ['five_hour', 'seven_day']);
  assert.ok(rows.every(row => row.identity.sgsd_run_id === 'global-fixture-run'));
  assert.equal(JSON.stringify(rows).includes('PRIVATE_GLOBAL_INSTALL_CANARY'), false);
  assert.equal(fs.statSync(spool).mode & 0o777, 0o700);
  for (const name of files) assert.equal(fs.statSync(path.join(spool, name)).mode & 0o777, 0o600);
  assert.equal(installed.status, 0, `existing global installer gates failed after Atlas delivery:\n${installed.stdout}\n${installed.stderr}`);
});
