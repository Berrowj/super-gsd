'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerCurrentCodex } = require('./codex-parent-bridge.cjs');
const { readRun } = require('./global-store.cjs');
const { digest } = require('./contract.cjs');

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
  sessionId: 'session-123', threadId: 'session-123', rolloutPath: f.rolloutPath, processLookup: f.lookup, bootIdLookup: () => f.boot });
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
