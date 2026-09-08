'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const source = path.resolve(__dirname, '../..');

function copyFreshSource(root, name) {
  const target = path.join(root, name, 'super-gsd');
  fs.cpSync(source, target, { recursive: true,
    filter: candidate => !candidate.split(path.sep).includes('node_modules') });
  return target;
}

function writeNpmFixture(binDir) {
  fs.mkdirSync(binDir, { recursive: true });
  const script = path.join(binDir, 'npm');
  fs.writeFileSync(script, `#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const globalTargets = ['agents', 'hooks', 'super-gsd'].map(name => path.join(process.env.HOME, '.claude', name));
fs.appendFileSync(process.env.FIXTURE_NPM_CAPTURE, JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(),
  global_assets_present: globalTargets.some(target => fs.existsSync(target)) }) + '\\n');
if (process.env.FIXTURE_NPM_MODE === 'fail') process.exit(23);
for (const name of ['js-yaml', 'argparse', 'ajv', 'fast-deep-equal', 'fast-uri', 'json-schema-traverse', 'require-from-string']) {
  fs.cpSync(path.join(process.env.FIXTURE_DEP_SOURCE, name), path.join(process.cwd(), 'node_modules', name),
    { recursive: true });
}
fs.copyFileSync(path.join(process.env.FIXTURE_DEP_SOURCE, '.package-lock.json'),
  path.join(process.cwd(), 'node_modules', '.package-lock.json'));
`, { mode: 0o700 });
}

function writeInstalledPeerCommand(file, label) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `#!/usr/bin/env node
'use strict';
require('node:fs').writeFileSync(process.env.WORKER_FIXTURE_SELECTED_EXECUTABLE, ${JSON.stringify(label)} + '\\n');
require(process.env.WORKER_FIXTURE_PEER);
`, { mode: 0o700 });
}

test('isolated global install delivers the full worker closure and its installed wrapper runs it', { skip: process.platform !== 'linux', timeout: 180000 }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-install-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixtureHome = path.join(root, 'home'), project = path.join(root, 'project'); fs.mkdirSync(project);
  fs.mkdirSync(path.join(fixtureHome, '.claude/get-shit-done'), { recursive: true });
  const nodeExecutable = fs.realpathSync(process.execPath);
  const callerBin = path.join(root, 'caller bin'), localBin = path.join(fixtureHome, '.local/bin');
  const nvmBin = path.join(fixtureHome, '.nvm/versions/node/v99.0.0/bin');
  const selectedExecutableLog = path.join(root, 'selected executable');
  const fixturePeer = path.join(fixtureHome, '.claude/super-gsd/tools/codex-worker/fixtures/app-server.cjs');
  writeInstalledPeerCommand(path.join(callerBin, 'codex'), 'caller');
  writeInstalledPeerCommand(path.join(localBin, 'codex'), 'user-local');
  writeInstalledPeerCommand(path.join(nvmBin, 'codex'), 'nvm');
  fs.symlinkSync(nodeExecutable, path.join(nvmBin, 'node'));
  const env = { ...process.env, HOME: fixtureHome, USERPROFILE: fixtureHome, OPENAI_API_KEY: '', SGSD_ATLAS_DISABLED: '1',
    PATH: `${callerBin}:${path.dirname(nodeExecutable)}:${process.env.PATH}`,
    WORKER_FIXTURE_PEER: fixturePeer, WORKER_FIXTURE_SELECTED_EXECUTABLE: selectedExecutableLog };
  delete env.SGSD_CODEX_APP_SERVER_COMMAND;
  delete env.SGSD_CODEX_COMMAND;
  const result = spawnSync('bash', [path.join(source, 'install.sh'), '--install-global', '--project-dir', project],
    { cwd: project, env, encoding: 'utf8', timeout: 150000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const installed = path.join(fixtureHome, '.claude/super-gsd');
  const isolatedEnv = { ...env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths' };
  for (const file of ['run.cjs', 'rpc.cjs', 'mailbox.cjs', 'control.cjs', 'fixtures/app-server.cjs']) {
    const target = path.join(installed, 'tools/codex-worker', file);
    assert.ok(fs.existsSync(target), `installed runtime closure includes ${file}`);
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(source, 'tools/codex-worker', file)));
  }
  assert.deepEqual(fs.readFileSync(path.join(installed, 'scripts/lib/sgsd-state.cjs')), fs.readFileSync(path.join(source, 'scripts/lib/sgsd-state.cjs')));
  for (const file of ['tools/codex-pro/profile-resolver.cjs', 'registry/codex-profiles.yaml', 'registry/board-members.yaml',
    'config/model-routing.json', 'tools/plan-schema/node_modules/js-yaml/index.js', 'tools/plan-schema/node_modules/argparse/argparse.js']) {
    const target = path.join(installed, file);
    assert.ok(fs.existsSync(target), `installed profile and board closure includes ${file}`);
    assert.deepEqual(fs.readFileSync(target), fs.readFileSync(path.join(source, file)));
  }
  assert.deepEqual(fs.readdirSync(path.join(installed, 'tools/plan-schema/node_modules')).sort(), ['argparse', 'js-yaml']);
  const resolver = spawnSync(nodeExecutable, ['--no-global-search-paths', path.join(installed, 'tools/codex-pro/profile-resolver.cjs'),
    '--resolve-cli', 'executor'], { cwd: project, env: isolatedEnv, encoding: 'utf8', timeout: 5000 });
  assert.equal(resolver.status, 0, resolver.stderr);
  assert.match(resolver.stdout, /^CODEX_PROFILE_STATUS=ok$/m);
  assert.match(resolver.stdout, /^CODEX_PROFILE_SOURCE=registry$/m);
  assert.match(resolver.stdout, /^CODEX_MODEL=gpt-5\.6-sol$/m);
  assert.match(resolver.stdout, /^CODEX_REASONING_EFFORT=xhigh$/m);
  const boardScript = path.join(installed, 'scripts/lib/board-dispatch.cjs');
  const describeBoard = extra => spawnSync(nodeExecutable, ['--no-global-search-paths', boardScript, '--describe',
    '--member', 'sgsd-board-architect', ...extra], { cwd: project, env: isolatedEnv, encoding: 'utf8', timeout: 5000 });
  const boardDefault = describeBoard([]);
  assert.equal(boardDefault.status, 0, boardDefault.stderr);
  assert.deepEqual(JSON.parse(boardDefault.stdout), {
    member: 'sgsd-board-architect', role: 'Technical Architect', dispatch: 'codex-exec', provider: 'openai',
    model: 'external', model_id: 'gpt-6-astra', reasoning_effort: 'max',
    codex_profile: 'codex.readonly.audit', codex_contract: 'board-position-v1',
  });
  const boardOverride = describeBoard(['--model', 'luna-max']);
  assert.equal(boardOverride.status, 0, boardOverride.stderr);
  assert.equal(JSON.parse(boardOverride.stdout).model_id, 'gpt-5.6-luna');
  assert.equal(JSON.parse(boardOverride.stdout).reasoning_effort, 'max');
  fs.mkdirSync(path.join(project, '.planning')); fs.writeFileSync(path.join(project, 'prompt'), 'Installed runtime fixture.\n');
  const report = path.join(project, 'report'), capture = path.join(project, 'app-server-capture.jsonl');
  const run = spawnSync('bash', [path.join(installed, 'scripts/codex-executor.sh'), '--workspace', project,
    '--prompt-file', path.join(project, 'prompt'), '--report-out', report, '--timeout', '10'],
  { cwd: project, env: { ...isolatedEnv, SGSD_CODEX_APP_SERVER_ARGS: '[]',
    WORKER_FIXTURE_MODE: 'complete', WORKER_FIXTURE_REPORT: 'installed worker completed', WORKER_FIXTURE_CAPTURE: capture,
  }, encoding: 'utf8', timeout: 20000 });
  assert.equal(run.status, 0, run.stderr); assert.match(fs.readFileSync(report, 'utf8'), /installed worker completed/);
  assert.equal(fs.readFileSync(selectedExecutableLog, 'utf8').trim(), 'caller');
  const messages = fs.readFileSync(capture, 'utf8').trim().split('\n').map(JSON.parse);
  const thread = messages.find(message => message.method === 'thread/start');
  const turn = messages.find(message => message.method === 'turn/start');
  assert.equal(thread.params.model, 'gpt-5.6-sol'); assert.equal(thread.params.allowProviderModelFallback, false);
  assert.equal(turn.params.model, 'gpt-5.6-sol'); assert.equal(turn.params.effort, 'xhigh');
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

  fs.writeFileSync(path.join(project, '.planning', 'STATE.md'),
    '---\nmilestone: fixture-milestone\ncurrent_phase: "170"\ncurrent_plan: 170-04\n---\n');
  const boardPrepare = spawnSync(nodeExecutable, ['--no-global-search-paths', boardScript,
    '--member', 'sgsd-board-pragmatist', '--project', project, '--prompt-file', path.join(project, 'prompt'),
    '--timeout', '10', '--owner', 'installed-board-fixture'],
  { cwd: project, env: isolatedEnv, encoding: 'utf8', timeout: 5000 });
  assert.equal(boardPrepare.status, 0, boardPrepare.stderr);
  const boardSpec = JSON.parse(boardPrepare.stdout);
  assert.ok(boardSpec.report_path.startsWith(path.join(project, '.planning', 'deliberations')));
  const boardCapture = path.join(project, 'board-app-server-capture.jsonl');
  const validPosition = 'position: SUPPORT\nconfidence: 4\nrisks_raised: []\nevidence_cited: []\nfalsifier: a failed test\nimplementation_concerns: []\nknown_deadends: []\nintuition: bounded\nwhy_principled: evidence\nrationale: installed fixture\n';
  const boardRun = spawnSync('bash', boardSpec.argv,
  { cwd: project, env: { ...isolatedEnv, SGSD_CODEX_APP_SERVER_COMMAND: nodeExecutable,
    SGSD_CODEX_APP_SERVER_ARGS: JSON.stringify([path.join(installed, 'tools/codex-worker/fixtures/app-server.cjs')]),
    SGSD_CIRCUIT_STATE_FILE: path.join(project, 'board-circuit.json'), WORKER_FIXTURE_MODE: 'complete',
    WORKER_FIXTURE_REPORT: validPosition, WORKER_FIXTURE_CAPTURE: boardCapture,
    SGSD_CODEX_COMMAND: path.join(root, 'no-legacy-fallback') }, encoding: 'utf8', timeout: 30000 });
  assert.equal(boardRun.status, 0, boardRun.stderr);
  const boardFrames = fs.readFileSync(boardCapture, 'utf8').trim().split('\n').map(JSON.parse);
  const boardThread = boardFrames.find(message => message.method === 'thread/start');
  const boardTurn = boardFrames.find(message => message.method === 'turn/start');
  assert.equal(boardThread.params.model, 'gpt-5.6-luna');
  assert.equal(boardThread.params.allowProviderModelFallback, false);
  assert.equal(boardTurn.params.model, 'gpt-5.6-luna'); assert.equal(boardTurn.params.effort, 'max');
  const validateBoard = spawnSync(nodeExecutable, ['--no-global-search-paths',
    path.join(installed, 'scripts/lib/deliberation-schema.cjs')],
  { cwd: project, env: isolatedEnv, input: fs.readFileSync(boardSpec.report_path), encoding: 'utf8', timeout: 5000 });
  assert.equal(validateBoard.status, 0, validateBoard.stderr);
  assert.match(validateBoard.stdout, /^position: SUPPORT$/m);
});

test('fresh source bootstraps only the pinned installed YAML closure before global writes',
  { skip: process.platform !== 'linux', timeout: 180000 }, t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-install-bootstrap-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const nodeExecutable = fs.realpathSync(process.execPath);
  const binDir = path.join(root, 'bin'); writeNpmFixture(binDir);
  const dependencySource = path.join(source, 'tools/plan-schema/node_modules');

  const runFreshInstall = (name, npmMode) => {
    const freshSource = copyFreshSource(root, name);
    const fixtureHome = path.join(root, `${name}-home`), project = path.join(root, `${name}-project`);
    fs.mkdirSync(path.join(fixtureHome, '.claude/get-shit-done'), { recursive: true });
    fs.mkdirSync(project);
    const capture = path.join(root, `${name}-npm.jsonl`);
    const env = { ...process.env, HOME: fixtureHome, USERPROFILE: fixtureHome, OPENAI_API_KEY: '',
      SGSD_ATLAS_DISABLED: '1', FIXTURE_DEP_SOURCE: dependencySource, FIXTURE_NPM_CAPTURE: capture,
      FIXTURE_NPM_MODE: npmMode, PATH: `${binDir}:${path.dirname(nodeExecutable)}:${process.env.PATH}` };
    const result = spawnSync('bash', [path.join(freshSource, 'install.sh'), '--install-global', '--project-dir', project],
      { cwd: project, env, encoding: 'utf8', timeout: 150000, maxBuffer: 4 * 1024 * 1024 });
    return { capture, env, fixtureHome, freshSource, project, result };
  };

  const installed = runFreshInstall('success', 'copy');
  const bootstrapDebug = { capture: fs.existsSync(installed.capture) ? fs.readFileSync(installed.capture, 'utf8') : null,
    yaml_exists: fs.existsSync(path.join(installed.freshSource, 'tools/plan-schema/node_modules/js-yaml/index.js')) };
  assert.equal(installed.result.status, 0,
    `${installed.result.stdout}\n${installed.result.stderr}\n${JSON.stringify(bootstrapDebug)}`);
  const calls = fs.readFileSync(installed.capture, 'utf8').trim().split('\n').map(JSON.parse);
  assert.deepEqual(calls, [{ argv: ['ci', '--ignore-scripts', '--no-audit', '--no-fund'],
    cwd: fs.realpathSync(path.join(installed.freshSource, 'tools/plan-schema')), global_assets_present: false }]);
  const installedRoot = path.join(installed.fixtureHome, '.claude/super-gsd');
  assert.deepEqual(fs.readdirSync(path.join(installedRoot, 'tools/plan-schema/node_modules')).sort(), ['argparse', 'js-yaml']);
  const isolatedEnv = { ...installed.env, NODE_PATH: '', NODE_OPTIONS: '--no-global-search-paths' };
  const resolver = spawnSync(nodeExecutable, ['--no-global-search-paths',
    path.join(installedRoot, 'tools/codex-pro/profile-resolver.cjs'), '--resolve-cli', 'executor'],
  { cwd: installed.project, env: isolatedEnv, encoding: 'utf8', timeout: 5000 });
  assert.equal(resolver.status, 0, resolver.stderr);
  assert.match(resolver.stdout, /^CODEX_PROFILE_SOURCE=registry$/m);
  assert.match(resolver.stdout, /^CODEX_MODEL=gpt-5\.6-sol$/m);
  const board = spawnSync(nodeExecutable, ['--no-global-search-paths',
    path.join(installedRoot, 'scripts/lib/board-dispatch.cjs'), '--describe',
    '--member', 'sgsd-board-pragmatist'], { cwd: installed.project, env: isolatedEnv, encoding: 'utf8', timeout: 5000 });
  assert.equal(board.status, 0, board.stderr);
  assert.equal(JSON.parse(board.stdout).model_id, 'gpt-5.6-luna');

  const failed = runFreshInstall('failure', 'fail');
  assert.notEqual(failed.result.status, 0);
  assert.match(failed.result.stderr, /runtime dependency bootstrap failed/);
  assert.equal(JSON.parse(fs.readFileSync(failed.capture, 'utf8').trim()).global_assets_present, false);
  for (const target of ['agents', 'hooks', 'super-gsd']) {
    assert.equal(fs.existsSync(path.join(failed.fixtureHome, '.claude', target)), false,
      `failed bootstrap must not partially publish ${target}`);
  }
});
