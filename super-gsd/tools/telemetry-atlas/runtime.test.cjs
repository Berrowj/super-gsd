#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const lifecycle = require('./lifecycle.cjs');

const cases = [];
function test(name, fn) { cases.push([name, fn]); }
function fixture() { return fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-atlas-runtime-')); }
function clean(root) { fs.rmSync(root, { recursive: true, force: true }); }

test('environment removes raw logging and signal overrides without changing argv', () => {
  assert.equal(typeof lifecycle.environmentCommand, 'function', 'one environment renderer must exist');
  const command = lifecycle.environmentCommand({ healthy: true, runId: 'run-1', stateDir: '/tmp/atlas-state',
    endpoint: 'http://127.0.0.1:4318' });
  assert.match(command, /-u OTEL_LOG_RAW_API_BODIES/);
  assert.match(command, /OTEL_METRICS_INCLUDE_SESSION_ID='false'/);
  assert.match(command, /OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES='false'/);
  if (process.platform !== 'linux') return;
  const root = fixture();
  try {
    const fake = path.join(root, 'fake.cjs');
    fs.writeFileSync(fake, 'console.log(JSON.stringify({argv:process.argv.slice(2),env:process.env}))');
    const run = spawnSync('bash', ['-c', `${command} '${process.execPath}' '${fake}' --dangerously-skip-permissions 'literal $() prompt'`], {
      encoding: 'utf8', env: { ...process.env, OTEL_LOG_RAW_API_BODIES: 'file:/tmp/raw',
        OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: 'https://remote.invalid', OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'grpc' },
    });
    assert.equal(run.status, 0, run.stderr);
    const output = JSON.parse(run.stdout);
    assert.deepEqual(output.argv, ['--dangerously-skip-permissions', 'literal $() prompt']);
    assert.equal(output.env.OTEL_LOG_RAW_API_BODIES, undefined);
    assert.equal(output.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT, 'http://127.0.0.1:4318/v1/logs');
    assert.equal(output.env.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL, 'http/json');
    assert.equal(output.env.OTEL_METRICS_INCLUDE_SESSION_ID, 'false');
  } finally { clean(root); }
});

test('process identity rejects PID reuse and path-prefix lookalikes', async () => {
  assert.equal(typeof lifecycle.processIdentity, 'function', 'Linux identity reader must exist');
  if (process.platform !== 'linux') return;
  const child = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { stdio: 'ignore' });
  try {
    await new Promise(resolve => setTimeout(resolve, 40));
    const identity = lifecycle.processIdentity(child.pid);
    assert.equal(lifecycle.owned(identity), true);
    assert.equal(lifecycle.owned({ ...identity, start_time: String(BigInt(identity.start_time) + 1n) }), false);
    assert.equal(lifecycle.owned({ ...identity, argv: [...identity.argv, 'extra'] }), false);
  } finally { child.kill(); await new Promise(resolve => child.once('close', resolve)); }
});

test('environment variable names cannot inject shell commands', () => {
  const malicious = 'OTEL_X;touch /tmp/atlas-injection;#';
  process.env[malicious] = 'value';
  try {
    const command = lifecycle.environmentCommand({ healthy: true, runId: 'run-1', stateDir: '/tmp/state' });
    assert.equal(command.includes(malicious), false);
  } finally { delete process.env[malicious]; }
});

test('disabled attachment returns within one second without enabling or spawning', async () => {
  const root = fixture();
  try {
    const start = performance.now();
    const result = await lifecycle.execute({ command: 'attach', projectDir: root, stateDir: path.join(root, 'state'), runId: 'run-1' });
    assert.equal(result.healthy, false);
    assert.ok(performance.now() - start < 1000);
    assert.equal(fs.existsSync(path.join(root, 'state', 'sidecar.json')), false);
  } finally { clean(root); }
});

test('readiness rejects a healthy imposter and the wrong project', async () => {
  assert.equal(typeof lifecycle.readiness, 'function', 'identity-bound readiness must exist');
  if (process.platform !== 'linux') return;
  const http = require('node:http');
  const { digest } = require('./contract.cjs');
  const projectDir = '/tmp/atlas-readiness-project';
  let body = { status: 'healthy' };
  const server = http.createServer((_request, response) => response.end(JSON.stringify(body)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    const record = { project_dir: projectDir, project_id: digest(projectDir), status: 'ready', instance_id: 'nonce-1',
      processes: [{ ...lifecycle.processIdentity(process.pid), name: 'normalizer', ports: [port], health_url: `http://127.0.0.1:${port}/health` }] };
    assert.equal(await lifecycle.readiness(record, projectDir), false);
    body = { status: 'healthy', instance_id: 'nonce-1', project_id: digest(projectDir), pid: process.pid };
    assert.equal(await lifecycle.readiness(record, projectDir), true);
    assert.equal(await lifecycle.readiness(record, '/tmp/different-project'), false);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('lifecycle lock excludes concurrent starts without removing live ownership', () => {
  assert.equal(typeof lifecycle.acquireLock, 'function', 'exclusive lifecycle locking must exist');
  if (process.platform !== 'linux') return;
  const root = fixture();
  try {
    const release = lifecycle.acquireLock(root);
    assert.throws(() => lifecycle.acquireLock(root), /lifecycle_busy/);
    release();
    lifecycle.acquireLock(root)();
  } finally { clean(root); }
});

test('session exit records content-free lifecycle evidence independently of health', async () => {
  const root = fixture();
  try {
    const result = await lifecycle.execute({ command: 'session-exit', stateDir: path.join(root, 'state'), projectDir: root, runId: 'run-1' });
    assert.equal(result.recorded, true);
    const directory = path.join(root, 'state', 'quota-spool');
    const row = JSON.parse(fs.readFileSync(path.join(directory, fs.readdirSync(directory)[0]), 'utf8'));
    assert.equal(row.source.completeness_reason, 'launcher_session_exit');
    assert.equal(row.identity.sgsd_run_id, 'run-1');
  } finally { clean(root); }
});

test('resource checks expose pressure without signalling an unrelated process', () => {
  assert.equal(typeof lifecycle.resourceIssue, 'function', 'resource guard must exist');
  if (process.platform !== 'linux') return;
  const root = fixture();
  try {
    const identity = lifecycle.processIdentity(process.pid);
    assert.equal(lifecycle.resourceIssue({ processes: [{ ...identity, rss_limit_mib: 0.01 }] }, root), 'telemetry_memory_limit');
    assert.equal(lifecycle.owned(identity), true);
  } finally { clean(root); }
});

test('Prometheus storage headroom is bounded without deleting its evidence', () => {
  const root = fixture();
  try {
    const directory = path.join(root, 'prometheus'); fs.mkdirSync(directory);
    const target = path.join(directory, 'sparse-wal'); fs.writeFileSync(target, '');
    fs.truncateSync(target, 2684354561);
    assert.equal(lifecycle.resourceIssue({ processes: [] }, root), 'prometheus_storage_limit');
    assert.equal(fs.statSync(target).size, 2684354561);
  } finally { clean(root); }
});

test('real installed stack starts, attaches, refuses cross-project reuse, and stops', async () => {
  if (process.platform !== 'linux' || process.env.SGSD_ATLAS_REAL_RUNTIME_TEST !== '1') return;
  const root = fixture();
  const options = { projectDir: path.join(root, 'project'), stateDir: path.join(root, 'state'),
    ports: { otlp: 35318, normalizer: 35319, collectorHealth: 35133, normalizerHealth: 35134,
      metrics: 35464, normalizerMetrics: 35465, collectorInternal: 35466, prometheus: 35090 } };
  fs.mkdirSync(options.projectDir);
  try {
    await assert.rejects(lifecycle.execute({ ...options, command: 'enable' }), /stack_not_installed/);
    await require('./stack.cjs').install(options);
    await lifecycle.execute({ ...options, command: 'enable' });
    const occupied = require('node:http').createServer((_request, response) => response.end('{"status":"healthy"}'));
    await new Promise(resolve => occupied.listen(options.ports.collectorHealth, '127.0.0.1', resolve));
    try {
      await assert.rejects(lifecycle.execute({ ...options, command: 'start' }), /sidecar_health_timeout|child_identity_unavailable/);
      assert.equal(occupied.listening, true, 'unowned listener survives failed start');
    } finally { await new Promise(resolve => occupied.close(resolve)); }
    const result = await lifecycle.execute({ ...options, command: 'start' });
    assert.equal(result.healthy, true);
    const started = performance.now();
    const attached = await lifecycle.execute({ ...options, command: 'attach', runId: 'run-fixture' });
    assert.equal(attached.healthy, true);
    assert.ok(performance.now() - started < 1000);
    await new Promise(resolve => setTimeout(resolve, 5500));
    assert.equal((await lifecycle.execute({ ...options, command: 'status' })).healthy, true, 'monitor preserves healthy stack');
    const wrong = await lifecycle.execute({ ...options, command: 'attach', projectDir: path.join(root, 'other'), runId: 'run-other' });
    assert.equal(wrong.healthy, false);
    const record = JSON.parse(fs.readFileSync(path.join(options.stateDir, 'sidecar.json'), 'utf8'));
    await lifecycle.execute({ ...options, command: 'stop' });
    assert.equal(record.processes.some(lifecycle.owned), false);
    await lifecycle.execute({ ...options, command: 'disable' });
  } finally {
    try { await lifecycle.execute({ ...options, command: 'stop' }); } catch (_) {}
    clean(root);
  }
});

test('quota samples are content-free, change-triggered and heartbeat-bounded', () => {
  const file = path.join(__dirname, 'quota-sampler.cjs');
  assert.equal(fs.existsSync(file), true, 'quota spool sampler must exist');
  const sampler = require(file);
  const root = fixture();
  try {
    const data = { session_id: 'session-1', prompt_id: 'prompt-1', version: '2.1.251',
      user_prompt: 'SECRET-CANARY', workspace: { current_dir: '/private/path' },
      rate_limits: { five_hour: { used_percentage: 12, resets_at: 1790000000 },
        seven_day: { used_percentage: 33, resets_at: 1790400000 } }, context_window: { used_percentage: 22 } };
    const options = { stateDir: root, runId: 'run-1', now: 1790000000000 };
    assert.equal(sampler.record(data, options).written, 2);
    assert.equal(sampler.record(data, { ...options, now: options.now + 1000 }).written, 0);
    assert.equal(sampler.record(data, { ...options, now: options.now + 61000 }).written, 2);
    const files = fs.readdirSync(path.join(root, 'quota-spool'));
    const bytes = files.map(name => fs.readFileSync(path.join(root, 'quota-spool', name), 'utf8'));
    assert.equal(bytes.join('').includes('SECRET-CANARY'), false);
    assert.equal(bytes.join('').includes('/private/path'), false);
    const rows = bytes.map(JSON.parse);
    assert.equal(new Set(rows.map(row => row.source_event_id)).size, 4);
    assert.deepEqual(new Set(rows.map(row => row.quota.window)), new Set(['five_hour', 'seven_day']));
    assert.equal(rows[0].identity.sgsd_run_id, 'run-1');
    if (process.platform === 'linux') {
      assert.equal(fs.statSync(path.join(root, 'quota-spool')).mode & 0o777, 0o700);
      assert.equal(fs.statSync(path.join(root, 'quota-spool', files[0])).mode & 0o777, 0o600);
    }
    const missing = sampler.record({ session_id: 'unavailable', version: '2.1.251' }, options);
    assert.equal(missing.written, 1);
  } finally { clean(root); }
});

test('quota recording p95 stays below ten milliseconds and does not wait on HTTP', () => {
  const file = path.join(__dirname, 'quota-sampler.cjs');
  assert.equal(fs.existsSync(file), true, 'quota spool sampler must exist');
  const sampler = require(file);
  const root = fixture();
  try {
    const samples = [];
    for (let i = 0; i < 60; i++) {
      const start = performance.now();
      sampler.record({ session_id: 'latency', version: '2.1.251', rate_limits: {
        five_hour: { used_percentage: i, resets_at: 1790000000 } } }, { stateDir: root, runId: 'run-1' });
      samples.push(performance.now() - start);
    }
    samples.sort((a,b)=>a-b);
    const p95 = samples[Math.ceil(samples.length * 0.95) - 1];
    console.log(`quota_recorder_p95_ms=${p95.toFixed(3)}`);
    assert.ok(p95 < 10, `quota recorder p95 ${p95}ms`);
    const hook = fs.readFileSync(path.join(__dirname, '../../hooks/sgsd-statusline.js'), 'utf8');
    assert.doesNotMatch(hook, /await recordAtlasStatus|await fetch/);
  } finally { clean(root); }
});

test('full quota spool emits independent missingness evidence', () => {
  const root = fixture();
  try {
    const stateDir = path.join(root, 'state'); const spool = path.join(stateDir, 'quota-spool');
    fs.mkdirSync(spool, { recursive: true });
    for (let i = 0; i < 256; i++) fs.writeFileSync(path.join(spool, `${i}.json`), '{}');
    const result = require('./quota-sampler.cjs').record({ session_id: 'session' }, { stateDir, projectDir: root, runId: 'run-1' });
    assert.equal(result.written, 0);
    const gap = path.join(root, '.planning', 'metrics', 'sgsd-atlas-gaps.jsonl');
    assert.equal(fs.existsSync(gap), true, 'spool cap needs independent coverage gap');
    assert.match(fs.readFileSync(gap, 'utf8'), /quota_spool_capacity/);
  } finally { clean(root); }
});

test('quota sampler refuses symlink ancestors without changing their target', () => {
  if (process.platform !== 'linux') return;
  const sampler = require('./quota-sampler.cjs');
  const root = fixture();
  try {
    const target = path.join(root, 'target');
    fs.mkdirSync(target, { mode: 0o755 });
    fs.symlinkSync(target, path.join(root, 'link'));
    const result = sampler.record({ session_id: 'session' }, { stateDir: path.join(root, 'link', 'state'), runId: 'run-1' });
    assert.equal(result.written, 0);
    assert.deepEqual(fs.readdirSync(target), []);
    assert.equal(fs.statSync(target).mode & 0o777, 0o755);
  } finally { clean(root); }
});

test('installed statusline preserves stdout with quota capture enabled or unavailable', () => {
  const root = fixture();
  try {
    fs.mkdirSync(path.join(root, '.planning'));
    fs.writeFileSync(path.join(root, '.planning', 'STATE.md'), '---\nmilestone: fixture\n---\n');
    const script = path.join(__dirname, '../../hooks/sgsd-statusline.js');
    const input = JSON.stringify({ session_id: 'status-fixture', version: '2.1.251', model: { display_name: 'Fixture' },
      rate_limits: { five_hour: { used_percentage: 23, resets_at: 1790000000 } },
      context_window: { remaining_percentage: 75 } });
    const invoke = state => spawnSync(process.execPath, [script], { cwd: root, input, encoding: 'utf8',
      env: { ...process.env, SGSD_ATLAS_STATE_DIR: state, SGSD_RUN_ID: 'run-1' }, timeout: 3000 });
    const disabled = invoke('');
    const enabled = invoke(path.join(root, 'state'));
    fs.writeFileSync(path.join(root, 'unwritable'), 'file');
    const unavailable = invoke(path.join(root, 'unwritable', 'state'));
    for (const result of [disabled, enabled, unavailable]) assert.equal(result.status, 0, result.stderr);
    assert.equal(enabled.stdout, disabled.stdout);
    assert.equal(unavailable.stdout, disabled.stdout);
    assert.equal(fs.readdirSync(path.join(root, 'state', 'quota-spool')).length, 1);
  } finally { clean(root); }
});

test('real launcher bounds a stalled attachment and preserves direct Claude argv', () => {
  if (process.platform !== 'linux') return;
  const root = fixture();
  try {
    const projectDir = path.join(root, 'project'); const sourceDir = path.join(root, 'source');
    const scriptsDir = path.join(root, 'scripts'); const agentsDir = path.join(root, 'agents'); const bin = path.join(root, 'bin');
    for (const directory of [path.join(projectDir, '.planning'), path.join(sourceDir, 'super-gsd', 'tools', 'telemetry-atlas'), scriptsDir, agentsDir, bin]) fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'super-gsd', 'tools', 'telemetry-atlas', 'lifecycle.cjs'), 'setTimeout(()=>{},5000)');
    fs.writeFileSync(path.join(scriptsDir, 'start-cockpit-server.sh'), '#!/bin/sh\nexit 0\n');
    const nativeGit = fs.existsSync('/usr/bin/git') ? '/usr/bin/git' : 'git';
    fs.symlinkSync(nativeGit, path.join(bin, 'git'));
    const git = args => spawnSync(nativeGit, ['-C', sourceDir, ...args], { encoding: 'utf8' });
    assert.equal(git(['init','--quiet']).status, 0);
    assert.equal(git(['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','--allow-empty','--quiet','-m','fixture']).status, 0);
    const recorded = path.join(root, 'operator-command');
    fs.writeFileSync(path.join(bin, 'tmux'), '#!/bin/bash\ncase "$1" in\n has-session) exit 1;;\n new-session) printf "%s" "${@: -1}" > "$ATLAS_TEST_COMMAND";;\n display-message|split-window) printf "%%1\\n";;\nesac\n', { mode: 0o700 });
    const argsFile = path.join(root, 'claude-argv');
    const fakeClaude = path.join(root, 'fake-claude');
    fs.writeFileSync(fakeClaude, '#!/bin/bash\nprintf "%s\\n" "$@" > "$ATLAS_TEST_ARGV"\n', { mode: 0o700 });
    const started = performance.now();
    const launch = spawnSync('bash', [path.join(__dirname, '../../scripts/sgsd-remote-tmux.sh'), '--project', projectDir,
      '--source-dir', sourceDir, '--scripts-dir', scriptsDir, '--agents-dir', agentsDir, '--go', '--no-attach'], {
      encoding: 'utf8', timeout: 3000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ATLAS_TEST_COMMAND: recorded },
    });
    const elapsed = performance.now() - started;
    assert.equal(launch.status, 0, launch.stderr);
    const command = fs.readFileSync(recorded, 'utf8');
    fs.writeFileSync(path.join(sourceDir, 'super-gsd', 'tools', 'telemetry-atlas', 'lifecycle.cjs'), 'process.stdout.write("\\n")');
    const baselineStarted = performance.now();
    const baseline = spawnSync('bash', [path.join(__dirname, '../../scripts/sgsd-remote-tmux.sh'), '--project', projectDir,
      '--source-dir', sourceDir, '--scripts-dir', scriptsDir, '--agents-dir', agentsDir, '--go', '--no-attach'], {
      encoding: 'utf8', timeout: 3000, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ATLAS_TEST_COMMAND: recorded },
    });
    const added = elapsed - (performance.now() - baselineStarted);
    assert.equal(baseline.status, 0, baseline.stderr);
    assert.ok(added < 1000, `stalled attachment added ${added}ms`);
    assert.match(command, / claude --dangerously-skip-permissions 'go'/);
    assert.doesNotMatch(command, /CLAUDE_CODE_ENABLE_TELEMETRY=/);
    const fakeCommand = command.replace(' claude --', ` '${fakeClaude}' --`).replace('exec bash -l', 'true');
    const result = spawnSync('bash', ['-c', fakeCommand], { encoding: 'utf8', timeout: 2000,
      env: { ...process.env, ATLAS_TEST_ARGV: argsFile } });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(argsFile, 'utf8'), '--dangerously-skip-permissions\ngo\n');
    console.log(`stalled_attachment_added_ms=${added.toFixed(3)}`);
  } finally { clean(root); }
});

(async () => {
  let failures = 0; let passed = 0; let skipped = 0;
  const linuxCases = new Set(['environment removes raw logging and signal overrides without changing argv',
    'process identity rejects PID reuse and path-prefix lookalikes', 'readiness rejects a healthy imposter and the wrong project',
    'lifecycle lock excludes concurrent starts without removing live ownership', 'resource checks expose pressure without signalling an unrelated process',
    'quota sampler refuses symlink ancestors without changing their target', 'real launcher bounds a stalled attachment and preserves direct Claude argv']);
  for (const [name, fn] of cases) {
    if ((linuxCases.has(name) && process.platform !== 'linux') || (name.startsWith('real installed stack')
      && (process.platform !== 'linux' || process.env.SGSD_ATLAS_REAL_RUNTIME_TEST !== '1'))) {
      skipped++; console.log(`SKIP ${name} (requires Linux${name.startsWith('real installed stack') ? ' and SGSD_ATLAS_REAL_RUNTIME_TEST=1' : ''})`); continue;
    }
    try { await fn(); passed++; console.log(`PASS ${name}`); }
    catch (error) { failures++; console.error(`FAIL ${name}: ${error.stack}`); }
  }
  console.log(`runtime_results passed=${passed} skipped=${skipped} failed=${failures}`);
  process.exitCode = failures ? 1 : 0;
})();
