'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { digest } = require('./contract.cjs');
const { registerRun, writeJson } = require('./global-store.cjs');
const { createContinuousManager } = require('./codex-continuous-manager.cjs');

const boot = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture(t, withCursor = true, role = 'executor') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-continuous-manager-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const projectDir = path.join(temp, 'project'), rollout = path.join(temp, 'rollout.jsonl');
  fs.mkdirSync(path.join(projectDir, '.planning'), { recursive: true }); fs.writeFileSync(rollout, 'history\n', { mode: 0o600 });
  const run = registerRun({ root: path.join(temp, 'global'), projectDir, provider: 'openai', role, accountingSource: 'codex_rollout',
    native_binding: { schema_version: 1, provider: 'openai', accounting_source: 'codex_rollout', project_id: digest(projectDir), project_dir: projectDir,
      session_id: 'session-native', thread_id: 'thread-native', pid: 123, start_time: '456', boot_id: boot, executable: '/codex/0.154.0/bin/codex' } });
  if (withCursor) { const stat = fs.statSync(rollout); writeJson(path.join(run.state_dir, 'native-continuous-cursor.json'),
    { schema_version: 1, path: rollout, dev: stat.dev, ino: stat.ino, offset: stat.size, last_response_id: null, last_event_id: null,
      observed_at: '2026-09-16T02:00:00.000Z', seen_event_ids: [], seen_response_ids: [] }); }
  return { root: path.join(temp, 'global'), run, rollout };
}

test('manager admits only cursor-backed native runs and owns one unref timer', t => {
  const f = fixture(t), calls = [], captures = [];
  let tick, cleared = false, unref = false;
  const timer = { unref() { unref = true; } };
  const manager = createContinuousManager({ root: f.root, timerSet(fn) { tick = fn; return timer; }, timerClear(value) { cleared = value === timer; },
    captureFactory(options) { calls.push(options); const capture = { poll() { return { healthy: true }; }, status() { return { available: true }; }, close() { captures.push('close'); } }; return capture; } });
  assert.equal(manager.start(), true); assert.equal(calls.length, 1); assert.equal(unref, true); assert.deepEqual(calls[0], {
    root: f.root, projectDir: f.run.project_dir, runId: f.run.run_id, rolloutPath: f.rollout,
    threadId: 'thread-native', sessionId: 'session-native', stateFile: path.join(f.run.state_dir, 'native-continuous-cursor.json') });
  tick(); assert.equal(manager.status().captures, 1); assert.equal(manager.close(), true); assert.equal(cleared, true); assert.deepEqual(captures, ['close']);
});

test('manager never creates a cursor for a registered run without one', t => {
  const f = fixture(t, false); let created = 0, unref = false;
  const manager = createContinuousManager({ root: f.root, timerSet() { return { unref() { unref = true; } }; }, captureFactory() { created++; } });
  manager.start(); assert.equal(created, 0); assert.equal(unref, true); assert.equal(fs.existsSync(path.join(f.run.state_dir, 'native-continuous-cursor.json')), false); manager.close();
});

test('manager admits a cursor-backed native orchestrator alongside executor runs', t => {
  const f = fixture(t, true, 'orchestrator'); let selected;
  const manager = createContinuousManager({ root: f.root, timerSet() { return { unref() {} }; },
    captureFactory(options) { selected = options; return { poll() { return { healthy: true }; }, status() { return { available: true }; }, close() {} }; } });
  manager.start(); assert.equal(selected.runId, f.run.run_id); assert.equal(f.run.role, 'orchestrator'); manager.close();
});

test('manager scans past irrelevant lexical predecessors and fails explicitly at the resource bound', t => {
  const f = fixture(t);
  for (let i = 0; i < 300; i++) fs.mkdirSync(path.join(f.root, 'runs', `irrelevant-${String(i).padStart(3, '0')}`));
  assert.equal(require('./codex-continuous-manager.cjs').candidates(f.root).length, 1);
  for (let i = 300; i < 1025; i++) fs.mkdirSync(path.join(f.root, 'runs', `overflow-${String(i).padStart(4, '0')}`));
  assert.throws(() => require('./codex-continuous-manager.cjs').candidates(f.root), /continuous_candidate_scan_limit/);
  const errors = [], manager = createContinuousManager({ root: f.root, timerSet() { return { unref() {} }; }, onError: error => errors.push(error) });
  manager.start(); assert.equal(manager.status().scan_incomplete, true); assert.equal(manager.status().scan_error, 'continuous_candidate_scan_limit');
  assert.equal(errors.length, 1); manager.close();
});

test('identity failure stops only that capture and performs no parent action', t => {
  const f = fixture(t), calls = [], errors = [];
  const manager = createContinuousManager({ root: f.root, timerSet(fn) { calls.push(fn); return { unref() {} }; }, onError: error => errors.push(error),
    captureFactory() { return { poll() { return { healthy: false, reasons: ['native_usage_process_identity_changed'] }; }, status() { return { available: true }; }, close() { calls.push('capture-close'); } }; } });
  manager.start(); calls[0](); assert.equal(manager.status().captures, 0); assert.equal(calls.at(-1), 'capture-close'); assert.deepEqual(errors, []); manager.close();
});
