'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const board = require('./board-registry.cjs');
const dispatch = require('./board-dispatch.cjs');

test('active seats resolve real provider transports and independent model effort', () => {
  for (const name of ['sgsd-ceo', 'sgsd-board-contrarian']) {
    assert.equal(dispatch.describe(board.getMember(name)).model, 'fable');
    assert.equal(dispatch.describe(board.getMember(name)).dispatch, 'agent');
  }
  for (const seat of ['architect', 'moonshot', 'pragmatist']) {
    const spec = dispatch.describe(board.getMember(`sgsd-board-${seat}`));
    assert.equal(spec.dispatch, 'codex-exec');
    assert.equal(spec.model_id, seat === 'pragmatist' ? 'gpt-5.6-luna' : 'gpt-6-astra');
    assert.equal(spec.reasoning_effort, 'max');
    assert.equal(spec.codex_profile, 'codex.readonly.audit');
    assert.equal(spec.codex_contract, 'board-position-v1');
  }
});

test('unknown models, inactive seats, and non-advisory board profiles fail closed', () => {
  const external = { name: 'seat', state: 'active', model_default: 'external', provider: 'openai',
    dispatch: 'codex-exec', model_id: 'gpt-6-astra', reasoning_effort: 'max',
    codex_profile: 'codex.readonly.audit', codex_contract: 'board-position-v1' };
  for (const change of [{ model_id: 'astra-max' }, { model_id: null }, { model_id: 'atlas' },
    { reasoning_effort: '' }, { state: 'legacy-disabled' }, { codex_profile: 'executor' }, { dispatch: 'agent' }]) {
    assert.throws(() => dispatch.describe({ ...external, ...change }), /unavailable|invalid|inactive/);
  }
});

test('explicit per-seat preset can switch provider without changing the registry', () => {
  const member = board.getMember('sgsd-board-architect');
  assert.equal(dispatch.describe(member, 'fable').dispatch, 'agent');
  assert.equal(dispatch.describe(member, 'luna-max').model_id, 'gpt-5.6-luna');
  assert.equal(dispatch.describe(member, 'luna-max').reasoning_effort, 'max');
  assert.equal(member.model_id, 'gpt-6-astra');
  assert.throws(() => dispatch.describe(member, 'atlas'), /not allowed/);
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "board 'quoted'-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.planning'), { recursive: true });
  fs.writeFileSync(path.join(root, '.planning', 'STATE.md'), '---\nmilestone: fixture-milestone\ncurrent_phase: "170"\n---\n');
  const prompt = path.join(root, 'prompt.md'); fs.writeFileSync(prompt, 'Board fixture; no provider call.\n');
  return { root, prompt };
}

test('each attempt has a fresh contained output and explicit wire arguments', t => {
  const f = fixture(t);
  const opts = { memberName: 'sgsd-board-architect', projectDir: f.root, promptFile: f.prompt };
  const first = dispatch.prepare(opts), retry = dispatch.prepare(opts);
  assert.notEqual(first.report_path, retry.report_path);
  assert.equal(fs.existsSync(first.report_path), false);
  assert.ok(first.report_path.startsWith(path.join(f.root, '.planning', 'deliberations')));
  assert.equal(first.argv[first.argv.indexOf('--model') + 1], 'gpt-6-astra');
  assert.equal(first.argv[first.argv.indexOf('--reasoning') + 1], 'max');
  assert.equal(first.argv[first.argv.indexOf('--contract') + 1], 'board-position-v1');
  assert.equal(first.argv[first.argv.indexOf('--milestone') + 1], 'fixture-milestone');
  assert.ok(first.command.includes("'\"'\"'"));
  fs.writeFileSync(path.join(f.root, '.planning', 'STATE.md'), '---\ncurrent_phase: "170"\n---\n');
  assert.throws(() => dispatch.prepare(opts), /milestone/);
});

test('missing host validator stops before any model call', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t), scriptsDir = path.join(f.root, 'scripts'), lib = path.join(scriptsDir, 'lib');
  fs.mkdirSync(lib, { recursive: true });
  fs.copyFileSync(path.resolve(__dirname, '..', 'codex-exec.sh'), path.join(scriptsDir, 'codex-exec.sh'));
  fs.copyFileSync(path.join(__dirname, 'codex-profile-shell.sh'), path.join(lib, 'codex-profile-shell.sh'));
  fs.copyFileSync(path.join(__dirname, 'codex-worker-shell.sh'), path.join(lib, 'codex-worker-shell.sh'));
  const result = spawnSync('bash', [path.join(scriptsDir, 'codex-exec.sh'), '--contract', 'board-position-v1',
    '--profile', 'codex.readonly.audit', '--project', f.root, '--prompt-file', f.prompt, '--report-out', path.join(f.root, 'report'), '--dry-run'],
  { encoding: 'utf8', timeout: 10000, env: { ...process.env, OPENAI_API_KEY: '', SGSD_ATLAS_DISABLED: '1' } });
  assert.equal(result.status, 8, result.stderr);
  assert.match(result.stderr, /validator unavailable/);
});

const validPosition = 'position: SUPPORT\nconfidence: 4\nrisks_raised: []\nevidence_cited: []\nfalsifier: a failed test\nimplementation_concerns: []\nknown_deadends: []\nintuition: bounded\nwhy_principled: evidence\nrationale: fixture\n';
test('real wrapper forwards seat model and validates board YAML without a paid call', { skip: process.platform === 'win32' ? 'Run integration under WSL/Linux Bash' : false }, t => {
  const f = fixture(t), peer = path.resolve(__dirname, '../../tools/codex-worker/fixtures/app-server.cjs');
  for (const response of [validPosition, 'position: SUPPORT\n']) {
    const spec = dispatch.prepare({ memberName: 'sgsd-board-pragmatist', projectDir: f.root, promptFile: f.prompt, timeoutSeconds: 10 });
    const argvFile = path.join(f.root, 'argv.json');
    const result = spawnSync('bash', ['-c', spec.command], { cwd: f.root, encoding: 'utf8', timeout: 30000,
      env: { ...process.env, SGSD_CODEX_APP_SERVER_COMMAND: process.execPath, SGSD_CODEX_APP_SERVER_ARGS: JSON.stringify([peer]),
        SGSD_ATLAS_DISABLED: '1', OPENAI_API_KEY: '', SGSD_CIRCUIT_STATE_FILE: path.join(f.root, 'circuit.json'),
        WORKER_FIXTURE_MODE: 'complete', WORKER_FIXTURE_CAPTURE: argvFile, WORKER_FIXTURE_REPORT: response } });
    assert.equal(result.status, response === validPosition ? 0 : 6, result.stderr);
    const frames = fs.readFileSync(argvFile, 'utf8').trim().split('\n').map(JSON.parse);
    const start = frames.find(frame => frame.method === 'thread/start');
    assert.equal(start.params.model, 'gpt-5.6-luna');
    assert.equal(frames.find(frame => frame.method === 'turn/start').params.effort, 'max');
    assert.equal(start.params.sandbox, 'danger-full-access');
    assert.equal(start.params.approvalPolicy, 'never');
    if (result.status === 0) assert.equal(require('./deliberation-schema.cjs').validate(fs.readFileSync(spec.report_path, 'utf8')).valid, true);
  }
});

test('open provider circuit blocks a board call without substituting its model', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t), fake = path.join(f.root, 'codex-fixture'), called = path.join(f.root, 'called');
  fs.writeFileSync(fake, '#!/usr/bin/env node\nrequire("node:fs").writeFileSync(process.env.BOARD_CALLED, "called");\n', { mode: 0o700 });
  const circuitPath = path.join(f.root, '.planning', 'metrics', 'provider-circuit.json');
  fs.mkdirSync(path.dirname(circuitPath), { recursive: true });
  fs.writeFileSync(circuitPath, JSON.stringify({ schema_version: 1, milestones: { 'fixture-milestone': { codex:
    { consecutive_failures: 3, fallback_active: true, last_failure_ts: new Date().toISOString(), last_success_ts: null } } } }));
  const spec = dispatch.prepare({ memberName: 'sgsd-board-architect', projectDir: f.root, promptFile: f.prompt });
  const env = { ...process.env, SGSD_CODEX_COMMAND: fake, SGSD_ATLAS_DISABLED: '1', OPENAI_API_KEY: '', BOARD_CALLED: called };
  delete env.SGSD_CIRCUIT_STATE_FILE;
  const result = spawnSync('bash', ['-c', spec.command], { cwd: f.root, encoding: 'utf8', timeout: 30000, env });
  assert.equal(result.status, 7, result.stderr);
  assert.match(result.stderr, /no automatic provider substitution/);
  assert.equal(fs.existsSync(called), false);
  assert.equal(fs.existsSync(spec.report_path), false);
});
