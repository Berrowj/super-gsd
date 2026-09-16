'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { digest } = require('../../tools/telemetry-atlas/contract.cjs');
const { registerRun } = require('../../tools/telemetry-atlas/global-store.cjs');
const api = require('../../tools/codex-worker/usage.cjs');

const boot = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function row(response = 'resp-1', turn = 'turn-1', thread = 'thread-native') {
  return { timestamp: '2026-09-16T01:00:00.000Z', type: 'token_usage_record', payload: {
    thread_id: thread, turn_id: turn, session_id: 'session-native', root_turn_id: turn,
    response_id: response, usage: { input_tokens: 10, cached_input_tokens: 2, cache_write_input_tokens: 0,
      output_tokens: 3, reasoning_output_tokens: 1, total_tokens: 13 },
  } };
}
function fixture(t, initial = '') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-continuous-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const projectDir = path.join(temp, 'project'); fs.mkdirSync(path.join(projectDir, '.planning'), { recursive: true });
  const file = path.join(temp, 'rollout.jsonl'); fs.writeFileSync(file, initial, { mode: 0o600 });
  const executable = '/codex/0.154.0/bin/codex';
  const native_binding = { schema_version: 1, provider: 'openai', accounting_source: 'codex_rollout',
    project_id: digest(projectDir), project_dir: projectDir, session_id: 'session-native', thread_id: 'thread-native',
    pid: 123, start_time: '456', boot_id: boot, executable };
  const root = path.join(temp, 'atlas'), run = registerRun({ root, projectDir, provider: 'openai', role: 'executor',
    accountingSource: 'codex_rollout', native_binding });
  const processLookup = () => ({ start_time: '456', boot_id: boot, cwd: projectDir, executable });
  const queue = [];
  const capture = options => api.createContinuousCapture({ root, projectDir, runId: run.run_id, rolloutPath: file,
    threadId: 'thread-native', sessionId: 'session-native', runtimeVersion: '0.154.0', stateFile: path.join(run.state_dir, 'cursor.json'),
    processLookup, bootIdLookup: () => boot, queue: (event) => { queue.push(event); return true; }, ...options });
  return { temp, file, run, queue, capture };
}
const append = (f, value) => fs.appendFileSync(f.file, typeof value === 'string' ? value : JSON.stringify(value) + '\n');

test('continuous capture persists an EOF boundary, resumes from cursor, and deduplicates', t => {
  const f = fixture(t, JSON.stringify(row('historic')) + '\n'), first = f.capture();
  assert.equal(first.status().offset, fs.statSync(f.file).size); first.poll(); assert.equal(f.queue.length, 0);
  append(f, row('one')); first.poll(); assert.equal(f.queue.length, 1); first.close();
  const resumed = f.capture(); append(f, row('one')); append(f, row('two')); const status = resumed.poll();
  assert.equal(status.accepted_observations, 1); assert.equal(status.duplicate_observations, 1);
  assert.deepEqual(f.queue.map(event => event.identity.response_id), ['one', 'two']);
  const cursor = JSON.parse(fs.readFileSync(path.join(f.run.state_dir, 'cursor.json'), 'utf8'));
  assert.equal(cursor.last_response_id, 'two'); assert.equal(cursor.last_event_id.length, 64);
});

test('continuous capture retains incomplete lines and classifies rotation and truncation', t => {
  const f = fixture(t), capture = f.capture(); append(f, JSON.stringify(row('partial')).slice(0, 20));
  capture.poll(); assert.match(readGaps(f), /native_usage_incomplete_line/); assert.equal(f.queue.length, 0);
  fs.appendFileSync(f.file, JSON.stringify(row('partial')).slice(20) + '\n'); capture.poll(); assert.equal(f.queue.length, 1);
  fs.renameSync(f.file, f.file + '.old'); fs.writeFileSync(f.file, JSON.stringify(row('replacement')) + '\n');
  assert.match(capture.poll().reasons.join(','), /native_usage_file_rotated/);
  const truncated = fixture(t, JSON.stringify(row('old')) + '\n'), second = truncated.capture();
  fs.truncateSync(truncated.file, 0); assert.match(second.poll().reasons.join(','), /native_usage_file_truncated/);
});

test('continuous capture retries spool delivery, fences process identity, and finalizes terminal interval', t => {
  const f = fixture(t), attempts = []; let valid = true;
  const capture = f.capture({ queue: event => { attempts.push(event); return attempts.length > 1; } });
  append(f, row('retry')); capture.poll(); assert.match(readGaps(f), /native_usage_spool_unavailable/);
  const retry = capture.poll(); assert.equal(retry.accepted_observations, 1); assert.equal(attempts.length, 2);
  valid = false; // The injected lookup is replaced below to exercise the fence.
  const fenced = f.capture({ processLookup: () => null });
  assert.match(fenced.status().reasons.join(','), /native_usage_process_identity_changed/);
  const final = capture.finalizeSync({ terminalStatus: 'exited' }); assert.equal(final.terminal_interval, true);
});

function readGaps(f) {
  const file = path.join(f.run.metrics_dir, 'sgsd-atlas-gaps.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
