'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerCurrentCodex, cursorSeed, trustedWindowsExecutableVersion, observedExecutableVersion } = require('./codex-parent-bridge.cjs');
const { readRun, registerRun, writeJson } = require('./global-store.cjs');
const { digest } = require('./contract.cjs');
const { createContinuousManager } = require('./codex-continuous-manager.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-codex-bridge-'));
  const projectDir = path.join(root, 'project'); fs.mkdirSync(path.join(projectDir, '.planning'), { recursive: true });
  const rolloutPath = path.join(root, 'rollout.jsonl');
  fs.writeFileSync(rolloutPath, [
    JSON.stringify({ type: 'session_meta', payload: { session_id: 'session-123', cwd: projectDir, model_provider: 'openai', source: 'cli', cli_version: '0.154.0' }}), '\n',
    JSON.stringify({ type: 'event_msg', payload: { thread_id: 'session-123' } }), '\n'].join(''));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const process = { pid: 12001, start_time: '987654', boot_id: '11111111-1111-4111-8111-111111111111',
    executable: '/codex/0.154.0-x86_64-unknown-linux-musl/bin/codex', cwd: projectDir, environment: {} };
  return { root, projectDir, rolloutPath, process, lookup: () => process, boot: process.boot_id };
}
const options = f => ({ root: f.root, projectDir: f.projectDir, pid: f.process.pid, expectedStartTime: f.process.start_time,
  role: 'executor', sessionId: 'session-123', threadId: 'session-123', rolloutPath: f.rolloutPath, processLookup: f.lookup, bootIdLookup: () => f.boot });
const withBoot = f => ({ ...options(f), processLookup: () => f.process });

test('registers an exact current Codex parent and returns the same registration idempotently', async t => {
  const f = fixture(t);
  const first = await registerCurrentCodex(options(f));
  assert.equal(first.status, 'registered');
  assert.equal(first.run.provider, 'openai');
  assert.equal(first.run.role, 'executor');
  assert.equal(first.run.accountingSource, 'codex_rollout');
  assert.deepEqual(first.run.native_binding, { schema_version: 1, provider: 'openai', accounting_source: 'codex_rollout',
    project_id: digest(f.projectDir), project_dir: f.projectDir, session_id: 'session-123', thread_id: 'session-123',
    pid: 12001, start_time: '987654', boot_id: f.boot, executable: '/codex/0.154.0-x86_64-unknown-linux-musl/bin/codex' });
  const second = await registerCurrentCodex(withBoot(f));
  assert.equal(second.status, 'already_registered');
  assert.equal(second.run.run_id, first.run.run_id);
  assert.equal(fs.readdirSync(path.join(f.root, 'runs')).length, 1);
  assert.deepEqual(readRun(f.root, first.run.run_id).native_binding, first.run.native_binding);
});

test('registers and selects an explicit native orchestrator project role', async t => {
  const f = fixture(t), first = await registerCurrentCodex({ ...options(f), role: 'orchestrator' });
  assert.equal(first.run.role, 'orchestrator');
  assert.equal(readRun(f.root, first.run.run_id).role, 'orchestrator');
  const stat = fs.statSync(f.rolloutPath);
  writeJson(path.join(first.run.state_dir, 'native-continuous-cursor.json'), cursorSeed(f.rolloutPath, stat));
  let selected, timer;
  const manager = createContinuousManager({ root: f.root, timerSet(fn) { timer = fn; return { unref() {} }; },
    captureFactory(options) { selected = options; return { poll() { return { healthy: true }; }, status() { return { available: true }; }, close() {} }; } });
  t.after(() => manager.close()); manager.start(); timer();
  assert.equal(selected.runId, first.run.run_id); assert.equal(selected.projectDir, first.run.project_dir);
  const projected = require('../codex-worker/usage.cjs').projectUsageRecord({ timestamp: '2026-09-16T05:00:00.000Z', type: 'token_usage_record',
    payload: { thread_id: 'session-123', turn_id: 'turn-1', session_id: 'session-123', root_turn_id: 'turn-1', response_id: 'response-1',
      usage: { input_tokens: 1, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0, total_tokens: 2 } } },
    { run: first.run, threadId: 'session-123', turnId: 'turn-1', model: 'gpt-6-astra', modelProvider: 'openai' });
  assert.equal(projected.event.scope.role, 'orchestrator');
});

test('rejects process, rollout, duplicate and provider-crossing ambiguity', async t => {
  const f = fixture(t);
  await assert.rejects(registerCurrentCodex({ ...options(f), expectedStartTime: '999999' }), /codex_bridge_identity_mismatch/);
  await assert.rejects(registerCurrentCodex({ ...options(f), threadId: 'other-thread' }), /codex_bridge_rollout_mismatch/);
  const wrongProvider = path.join(f.root, 'wrong-provider.jsonl');
  fs.writeFileSync(wrongProvider, JSON.stringify({ type: 'session_meta', payload: { session_id: 'session-123', cwd: f.projectDir,
    model_provider: 'anthropic', source: 'cli', cli_version: '0.154.0' } }) + '\n');
  await assert.rejects(registerCurrentCodex({ ...options(f), rolloutPath: wrongProvider }), /codex_bridge_rollout_mismatch/);
  const first = await registerCurrentCodex(options(f));
  const duplicateId = 'sgsd-11111111-1111-4111-8111-111111111111';
  const duplicateDir = path.join(f.root, 'runs', duplicateId); fs.mkdirSync(duplicateDir, { recursive: true });
  const duplicate = { ...first.run, run_id: duplicateId }; delete duplicate.state_dir; delete duplicate.metrics_dir;
  fs.writeFileSync(path.join(duplicateDir, 'registration.json'), JSON.stringify(duplicate));
  await assert.rejects(registerCurrentCodex(withBoot(f)), /codex_bridge_registration_ambiguous/);
});

test('reads the bounded metadata prefix without rejecting a large rollout file', async t => {
  const f = fixture(t); fs.truncateSync(f.rolloutPath, 9 * 1024 * 1024);
  const result = await registerCurrentCodex(options(f));
  assert.equal(result.status, 'registered');
});

test('builds a Windows EOF cursor seed without copying rollout content', () => {
  const seed = cursorSeed('C:\\Users\\jackberrow\\.codex\\sessions\\rollout.jsonl', { dev: 17, ino: 23, size: 381885826 }, '2026-09-16T04:39:00.000Z');
  assert.deepEqual(seed, { schema_version: 1, path: 'C:\\Users\\jackberrow\\.codex\\sessions\\rollout.jsonl', dev: 17, ino: 23,
    offset: 381885826, last_response_id: null, last_event_id: null, observed_at: '2026-09-16T04:39:00.000Z',
    seen_event_ids: [], seen_response_ids: [] });
});

test('requires explicit ordinary roles and rejects coordination/project role confusion', async t => {
  const f = fixture(t);
  const missingRole = options(f); delete missingRole.role;
  await assert.rejects(registerCurrentCodex(missingRole), /codex_bridge_project_role_invalid/);
  const nativeBinding = { schema_version: 1, provider: 'openai', accounting_source: 'codex_rollout', project_id: digest(f.projectDir),
    project_dir: f.projectDir, session_id: 'session-123', thread_id: 'session-123', pid: 12001, start_time: '987654',
    boot_id: f.boot, executable: '/codex/0.154.0-x86_64-unknown-linux-musl/bin/codex' };
  assert.throws(() => registerRun({ root: f.root, projectDir: f.projectDir, provider: 'openai', role: 'reviewer',
    accountingSource: 'codex_rollout', native_binding: nativeBinding }), /invalid_native_binding/);
  const bridge = path.join(__dirname, 'codex-parent-bridge.cjs');
  const bad = require('node:child_process').spawnSync(process.execPath, [bridge, '--root', f.root, '--project-dir', f.projectDir,
    '--role', 'pm-delivery', '--pid', '12001', '--start-time', '987654', '--session-id', 'session-123', '--thread-id', 'session-123',
    '--rollout-file', f.rolloutPath], { encoding: 'utf8' });
  assert.equal(bad.status, 1); assert.match(bad.stderr, /codex_bridge_role_confusion/);
});

test('derives the actual deep Windows Codex executable version from its bounded package evidence', () => {
  const executable = 'C:\\Users\\jack.berrow\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\node_modules\\@openai\\codex-win32-x64\\vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe';
  const packageFile = 'C:\\Users\\jack.berrow\\AppData\\Roaming\\npm\\node_modules\\@openai\\codex\\package.json';
  const lstat = file => { assert.equal(file, packageFile); return { isFile: () => true, isSymbolicLink: () => false, nlink: 1, size: 112 }; };
  const readFile = (file, encoding) => { assert.equal(file, packageFile); assert.equal(encoding, 'utf8'); return JSON.stringify({ name: '@openai/codex', version: '0.154.0' }); };
  assert.equal(trustedWindowsExecutableVersion(executable, { lstat, readFile }), '0.154.0');
  assert.equal(trustedWindowsExecutableVersion(executable.replace('codex.exe', 'other.exe'), { lstat, readFile }), null);
  assert.equal(trustedWindowsExecutableVersion(executable, { lstat: () => ({ isFile: () => true, isSymbolicLink: () => true, nlink: 1, size: 112 }), readFile }), null);
  assert.equal(trustedWindowsExecutableVersion(executable, { lstat, readFile: () => JSON.stringify({ name: '@openai/codex', version: '0.155.0' }) }), '0.155.0');
  assert.equal(trustedWindowsExecutableVersion(executable, { lstat, readFile: () => JSON.stringify({ name: '@openai/codex-win32-x64', version: '0.154.0' }) }), null);
  const numericPrefix = executable.replace('Users\\jack.berrow', 'Users\\123.456.789');
  assert.equal(observedExecutableVersion(numericPrefix, { lstat: () => { throw new Error('package_missing'); }, readFile }), null);
});

test('Windows cursor ownership compares only comparable runtime values', () => {
  const { ownerMismatch } = require('./codex-parent-bridge.cjs');
  assert.equal(ownerMismatch({ uid: 0 }, null), false);
  assert.equal(ownerMismatch({ uid: 0 }, () => undefined), false);
  assert.equal(ownerMismatch({ uid: 0 }, () => 0), false);
  assert.equal(ownerMismatch({ uid: 0 }, () => 1000), true);
});
