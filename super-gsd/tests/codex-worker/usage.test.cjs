'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerRun } = require('../../tools/telemetry-atlas/global-store.cjs');
const { validate } = require('../../tools/telemetry-atlas/contract.cjs');
const modulePath = path.resolve(__dirname, '../../tools/codex-worker/usage.cjs');
function api() {
  assert.ok(fs.existsSync(modulePath), 'native usage projector and bounded capture must exist');
  return require(modulePath);
}
// Release 0.153.2 RolloutLine + TokenUsageRecord, not an OTEL event or token_count snapshot.
function record(response = 'resp-native-1', overrides = {}) {
  return { timestamp: '2026-09-08T12:00:00.000Z', ordinal: 23, type: 'token_usage_record', payload: {
    thread_id: 'thread-native', turn_id: 'turn-current', session_id: 'session-native', root_turn_id: 'root-turn-native',
    response_id: response, usage: { input_tokens: 100, cached_input_tokens: 60, cache_write_input_tokens: 5,
      output_tokens: 20, reasoning_output_tokens: 12, total_tokens: 120 },
    turn_token_usage: { total_tokens: 9000 }, thread_token_usage: { total_tokens: 70000 }, ...overrides,
  } };
}
function context() {
  return { threadId: 'thread-native', turnId: 'turn-current', model: 'gpt-6-astra', modelProvider: 'openai',
    run: { run_id: 'sgsd-11111111-1111-4111-8111-111111111111', project_id: 'a'.repeat(64), provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' } };
}
function fixture(t, initial = '') {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-native-usage-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const projectDir = path.join(temp, 'project'); fs.mkdirSync(path.join(projectDir, '.planning'), { recursive: true });
  const root = path.join(temp, 'atlas');
  const run = registerRun({ root, projectDir, provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  const file = path.join(temp, 'native.jsonl'); fs.writeFileSync(file, initial, { mode: 0o600 });
  const opened = { thread: { id: 'thread-native', path: file, cliVersion: '0.1.0' }, model: 'gpt-6-astra', modelProvider: 'openai' };
  const capture = options => {
    assert.equal(typeof api().createCapture, 'function', 'bounded native capture must exist');
    const value = api().createCapture({ root, projectDir, runId: run.run_id, opened, ...options });
    t.after(() => value.close()); return value;
  };
  return { temp, root, run, file, opened, capture };
}
const append = (f, row) => fs.appendFileSync(f.file, JSON.stringify(row) + '\n');
function queued(f) {
  const dir = path.join(f.run.state_dir, 'quota-spool');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter(name => name.endsWith('.json')).map(name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'))) : [];
}
function gaps(f) {
  const file = path.join(f.run.metrics_dir, 'sgsd-atlas-gaps.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}
const linux = { skip: process.platform !== 'linux' };

test('native projection preserves per-response usage and true IDs without cumulative or subset addition', () => {
  const projected = api().projectUsageRecord(record(), context());
  assert.equal(projected.reason, null);
  const e = projected.event;
  assert.equal(validate(e), null);
  assert.deepEqual(e.usage, { input_tokens: 100, cache_read_tokens: 60, cache_creation_tokens: 5,
    output_tokens: 20, reasoning_tokens: 12, total_provider_tokens: 120 });
  assert.equal(e.identity.request_id, null);
  for (const key of ['thread_id', 'turn_id', 'session_id', 'root_turn_id', 'response_id']) assert.equal(e.identity[key], record().payload[key]);
  assert.equal(e.runtime.model_provenance, 'thread_configuration');
  assert.equal(e.runtime.response_model, null);
  assert.equal(e.runtime.codex_version, null);
  assert.doesNotMatch(JSON.stringify(e), /9000|70000|turn_token_usage|thread_token_usage/);
});

test('missing optional cache-write and unknown returned model remain unknown', () => {
  const row = record(); delete row.payload.usage.cache_write_input_tokens;
  const e = api().projectUsageRecord(row, { ...context(), model: undefined }).event;
  assert.equal(e.usage.cache_creation_tokens, null);
  assert.equal(e.runtime.model, 'unknown');
  assert.equal(e.usage.total_provider_tokens, 120);
});

test('native projection rejects missing identity, usage, and non-safe integer counts', () => {
  const project = api().projectUsageRecord;
  for (const field of ['thread_id', 'turn_id', 'session_id', 'root_turn_id', 'response_id', 'usage']) {
    const row = record(); delete row.payload[field];
    assert.equal(project(row, context()).event, null, field);
    assert.ok(project(row, context()).reason, field);
  }
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '120', null]) {
    const row = record(); row.payload.usage.total_tokens = value;
    assert.equal(project(row, context()).event, null, String(value));
  }
});

test('projection ignores wrong turns, other threads and embedded historical snapshots without leaking canaries', () => {
  const project = api().projectUsageRecord;
  for (const row of [record('old', { turn_id: 'old-turn' }), record('child', { thread_id: 'child-thread' }),
    { type: 'compacted', payload: { latest_token_usage_record: record().payload, text: 'PRIVATE-CANARY' } },
    { type: 'response_item', payload: { content: 'PRIVATE-CANARY' } }, { type: 'event_msg', payload: { type: 'token_count', info: record().payload } }]) {
    const result = project(row, context()); assert.equal(result.event, null); assert.equal(result.reason, null);
  }
  const row = record(); row.payload.prompt = 'PRIVATE-CANARY'; row.payload.usage.private_text = 'PRIVATE-CANARY';
  assert.doesNotMatch(JSON.stringify(project(row, context())), /PRIVATE-CANARY|private_text|prompt/);
});

test('capture snapshots preturn EOF, waits for ACK, and reads only new matching records', linux, t => {
  const f = fixture(t, JSON.stringify(record('historical')) + '\n'); const capture = f.capture();
  append(f, record('current-1')); capture.poll(); assert.equal(queued(f).length, 0, 'no guessed turn before ACK');
  assert.equal(capture.bindTurn({ threadId: 'thread-native', turnId: 'turn-current' }), true);
  capture.poll(); capture.poll(); append(f, record('current-2')); append(f, record('foreign', { turn_id: 'old-turn' }));
  capture.finalizeSync({ terminalStatus: 'failed' });
  assert.deepEqual(queued(f).map(e => e.identity.response_id).sort(), ['current-1', 'current-2']);
  assert.ok(queued(f).every(e => e.runtime.codex_version === null), 'creation CLI version is not running CLI version');
  assert.equal(capture.status().complete_coverage, false);
});

test('split appended lines and a pre-existing partial history line cannot create phantom usage', linux, t => {
  const f = fixture(t, '{"type":"response_item","payload":"old'); const capture = f.capture({ limits: { readBytes: 80 } });
  capture.bindTurn({ threadId: 'thread-native', turnId: 'turn-current' });
  fs.appendFileSync(f.file, '-PRIVATE-CANARY"}\n');
  const line = JSON.stringify(record()); fs.appendFileSync(f.file, line.slice(0, 120));
  for (let i = 0; i < 5; i++) capture.poll(); assert.equal(queued(f).length, 0);
  fs.appendFileSync(f.file, line.slice(120) + '\n');
  for (let i = 0; i < 20; i++) capture.poll();
  assert.equal(queued(f).length, 1); assert.doesNotMatch(JSON.stringify(queued(f)), /PRIVATE-CANARY/);
});

test('oversized lines are bounded and skipped through newline, then later usage is captured', linux, t => {
  const f = fixture(t); const capture = f.capture({ limits: { lineBytes: 1024, readBytes: 128 } });
  capture.bindTurn({ threadId: 'thread-native', turnId: 'turn-current' });
  fs.appendFileSync(f.file, 'PRIVATE-CANARY'.repeat(300) + '\n'); append(f, record());
  for (let i = 0; i < 60; i++) { capture.poll(); assert.ok(capture.status().buffered_bytes <= 1024); }
  assert.equal(queued(f).length, 1); assert.match(gaps(f), /native_usage_line_limit/);
  assert.doesNotMatch(gaps(f), /PRIVATE-CANARY/);
});

test('truncated or replaced native paths fail closed without reading replacement data', linux, t => {
  for (const action of ['truncate', 'replace']) {
    const f = fixture(t, 'old history\n'); const capture = f.capture(); capture.bindTurn({ threadId: 'thread-native', turnId: 'turn-current' });
    if (action === 'truncate') fs.truncateSync(f.file, 0);
    else { fs.renameSync(f.file, f.file + '.old'); fs.writeFileSync(f.file, JSON.stringify(record()) + '\n'); }
    capture.poll(); assert.equal(queued(f).length, 0); assert.equal(capture.status().healthy, false);
    assert.match(gaps(f), /native_usage_file_changed/);
  }
});

test('missing, relative, symlink and hardlinked native paths are refused without native mutations', linux, t => {
  for (const kind of ['missing', 'relative', 'symlink', 'ancestor', 'hardlink']) {
    const f = fixture(t, 'PRIVATE-CANARY'); let file = f.file;
    if (kind === 'missing') file += '.missing';
    if (kind === 'relative') file = 'native.jsonl';
    if (kind === 'symlink') { file += '.link'; fs.symlinkSync(f.file, file); }
    if (kind === 'ancestor') { const dir = path.join(f.temp, 'link'); fs.symlinkSync(f.temp, dir); file = path.join(dir, 'native.jsonl'); }
    if (kind === 'hardlink') fs.linkSync(f.file, f.file + '.hardlink');
    const capture = f.capture({ opened: { ...f.opened, thread: { ...f.opened.thread, path: file } } });
    assert.equal(capture.status().healthy, false, kind); assert.equal(fs.readFileSync(f.file, 'utf8'), 'PRIVATE-CANARY');
    assert.doesNotMatch(gaps(f), /PRIVATE-CANARY|native\.jsonl/);
  }
});

test('repeated records deduplicate locally but conflicting payloads keep separate spool files', linux, t => {
  const f = fixture(t), capture = f.capture(); capture.bindTurn({ threadId: 'thread-native', turnId: 'turn-current' });
  const first = record(); append(f, first); append(f, first); const changed = record(); changed.payload.usage.input_tokens++;
  append(f, changed); capture.poll(); capture.poll();
  assert.equal(queued(f).length, 2); assert.equal(new Set(queued(f).map(e => e.identity.response_id)).size, 1);
  const resumed = f.capture(); resumed.bindTurn({ threadId: 'thread-native', turnId: 'turn-current' }); resumed.poll();
  assert.equal(queued(f).length, 2, 'a fresh capture never scans prior history');
});

test('full spool retains bounded retries and writes independent registered-project gaps', linux, t => {
  const f = fixture(t), dir = path.join(f.run.state_dir, 'quota-spool'); fs.mkdirSync(dir, { mode: 0o700 });
  for (let i = 0; i < 256; i++) fs.writeFileSync(path.join(dir, `fixture-${i}.json`), '{}');
  const capture = f.capture({ limits: { pending: 1 } }); capture.bindTurn({ threadId: 'thread-native', turnId: 'turn-current' });
  append(f, record('one')); append(f, record('two')); capture.poll();
  assert.equal(capture.status().pending, 1); assert.match(gaps(f), /native_usage_spool_unavailable/);
  for (let i = 0; i < 256; i++) fs.unlinkSync(path.join(dir, `fixture-${i}.json`));
  capture.poll(); assert.equal(queued(f).length, 2, 'backpressure must leave the later response capturable'); assert.equal(capture.status().pending, 0);
  assert.equal(fs.existsSync(path.join(f.run.project_dir, '.planning', 'metrics')), false);
});

test('bounded finalization reports incomplete tails and absent usage without fabricating zero spend', linux, t => {
  const f = fixture(t), capture = f.capture({ limits: { readBytes: 8, finalPolls: 1 } });
  capture.bindTurn({ threadId: 'thread-native', turnId: 'turn-current' }); append(f, record());
  const before = capture.status().read_bytes; capture.finalizeSync({ terminalStatus: 'interrupted' });
  assert.ok(capture.status().read_bytes - before <= 8); assert.equal(queued(f).length, 0);
  assert.match(gaps(f), /native_usage_final_read_incomplete/); assert.match(gaps(f), /native_request_usage_unobserved/);
});

test('missing or wrong-project authority records only content-free verified global gaps', linux, t => {
  for (const kind of ['missing-run', 'wrong-project', 'missing-project']) {
    const f = fixture(t);
    const projectDir = path.join(f.temp, 'other'); fs.mkdirSync(projectDir);
    const capture = f.capture(kind === 'missing-run' ? { runId: 'unregistered' }
      : { projectDir: kind === 'missing-project' ? undefined : projectDir });
    assert.equal(capture.status().available, false, kind);
    const file = path.join(f.root, 'sgsd-atlas-gaps.jsonl');
    assert.ok(fs.existsSync(file), 'verified existing global root retains authority failure');
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /unregistered|other|native.jsonl/);
    assert.equal(gaps(f), '', 'wrong run cannot select a project ledger');
  }
});

test('unverified roots are not created and non-normalized native paths cannot hide a symlink', linux, t => {
  const f = fixture(t), root = path.join(f.temp, 'absent');
  const absent = f.capture({ root }); assert.equal(absent.status().available, false);
  assert.equal(fs.existsSync(root), false);
  const link = path.join(f.temp, 'link'); fs.symlinkSync(f.temp, link);
  const file = `${link}/../${path.basename(f.temp)}/native.jsonl`;
  const capture = f.capture({ opened: { ...f.opened, thread: { ...f.opened.thread, path: file } } });
  assert.equal(capture.status().available, false);
});

test('an identical native observation already pending succeeds at full spool capacity without rewriting it', linux, t => {
  const { queueEvent } = require('../../tools/telemetry-atlas/quota-sampler.cjs');
  const f = fixture(t), event = api().projectUsageRecord(record(), { ...context(), run: f.run }).event;
  assert.equal(queueEvent(event, f.run.state_dir), true);
  const dir = path.join(f.run.state_dir, 'quota-spool'), filename = path.join(dir, fs.readdirSync(dir)[0]);
  const before = fs.statSync(filename);
  for (let i = 0; i < 255; i++) fs.writeFileSync(path.join(dir, `fixture-${i}.json`), '{}');
  assert.equal(queueEvent(event, f.run.state_dir), true, 'durable existing payload is already queued');
  assert.equal(fs.statSync(filename).mtimeMs, before.mtimeMs);
  const conflict = structuredClone(event); conflict.usage.input_tokens++;
  assert.equal(queueEvent(conflict, f.run.state_dir), false, 'new conflicting payload still needs capacity');
});

test('turn mismatches, malformed native rows and response-index limits remain explicit bounded gaps', linux, t => {
  const f = fixture(t), wrong = f.capture();
  assert.equal(wrong.bindTurn({ threadId: 'different', turnId: 'turn-current' }), false);
  const capture = f.capture({ limits: { responses: 1 } });
  capture.bindTurn({ threadId: 'thread-native', turnId: 'turn-current' });
  const missing = record(); delete missing.payload.response_id;
  append(f, missing); append(f, record('one')); append(f, record('two')); capture.finalizeSync();
  assert.equal(queued(f).length, 1); assert.equal(capture.status().healthy, false);
  for (const reason of ['native_usage_turn_mismatch', 'native_usage_identity_missing', 'native_usage_response_limit']) assert.match(gaps(f), new RegExp(reason));
});
