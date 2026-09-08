'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { registerRun, startGlobal, prepare } = require('./global.cjs');
const { readLedger } = require('./contract.cjs');
const { record } = require('./quota-sampler.cjs');
const { normalizeLogs } = require('./otlp.cjs');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-global-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const projects = ['alpha', 'beta'].map(name => {
    const dir = path.join(root, name); fs.mkdirSync(path.join(dir, '.planning'), { recursive: true }); return dir;
  });
  return { root: path.join(root, 'global'), projects };
}
function payload(session, request, tokens = 5) {
  const attrs = { 'event.name': 'api_request', 'session.id': session, request_id: request,
    'event.timestamp': '2026-09-08T09:00:00Z', model: 'claude-opus-4-7', input_tokens: tokens,
    user_prompt: 'PRIVATE_PROMPT@example.invalid', tool_input: '/PRIVATE_HOST_PATH',
    'sgsd.launcher_repo_id': 'forged', 'sgsd.run_id': 'forged' };
  return { resourceLogs: [{ scopeLogs: [{ logRecords: [{ attributes: Object.entries(attrs).map(([key, value]) =>
    ({ key, value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value } })) }] }] }] };
}
async function send(instance, run, body) {
  const response = await fetch(`${instance.urls.ingest}/runs/${run.run_id}/v1/logs`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}
function rows(run) {
  return fs.readdirSync(run.metrics_dir).filter(name => /^sgsd-atlas-events-.*\.jsonl$/.test(name))
    .flatMap(name => readLedger(path.join(run.metrics_dir, name)).events);
}

test('two projects and three sessions share a receiver without mixing or leaking data', async t => {
  const f = fixture(t);
  const a = registerRun({ root: f.root, projectDir: f.projects[0] });
  const b = registerRun({ root: f.root, projectDir: f.projects[1] });
  const a2 = registerRun({ root: f.root, projectDir: f.projects[0] });
  const instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  for (const [run, id] of [[a, 's1'], [b, 's2'], [a2, 's3']]) {
    assert.equal((await send(instance, run, payload(id, 'request'))).status, 200);
  }
  await send(instance, a, payload('s1', 'request'));
  assert.equal(rows(a).filter(row => row.event_type === 'api_request').length, 2);
  assert.equal(rows(b).filter(row => row.event_type === 'api_request').length, 1);
  const event = rows(a).find(row => row.identity?.session_id === 's1');
  assert.equal(event.scope.launcher_repo_id, a.project_id);
  assert.equal(event.identity.sgsd_run_id, a.run_id);
  assert.doesNotMatch(JSON.stringify([...rows(a), ...rows(b)]), /PRIVATE_|forged/);
  assert.equal((await send(instance, { run_id: 'unregistered' }, payload('s4', 'r'))).status, 403);
});

test('quota spools from independent sessions drain into their registered projects', async t => {
  const f = fixture(t);
  const a = registerRun({ root: f.root, projectDir: f.projects[0] });
  const b = registerRun({ root: f.root, projectDir: f.projects[1] });
  const instance = await startGlobal({ root: f.root, spoolPollMs: 20 }); t.after(() => instance.close());
  for (const run of [a, b]) record({ session_id: run.run_id, rate_limits: { seven_day: { used_percentage: 12, resets_at: 1789250400 } } },
    { stateDir: run.state_dir, runId: run.run_id });
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && ![a, b].every(run => fs.existsSync(run.metrics_dir) && rows(run).some(row => row.event_type === 'quota')))
    await new Promise(resolve => setTimeout(resolve, 20));
  for (const run of [a, b]) {
    const quota = rows(run).find(row => row.event_type === 'quota');
    assert.equal(quota.scope.launcher_repo_id, run.project_id);
    assert.equal(quota.quota.attribution, 'account_unallocated');
  }
});

test('bootstrap reuses one healthy service, creates fresh runs, and respects opt-out', async t => {
  const f = fixture(t);
  const instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const a = await prepare({ root: f.root, projectDir: f.projects[0] });
  const b = await prepare({ root: f.root, projectDir: f.projects[1] });
  assert.equal(a.environment.OTEL_EXPORTER_OTLP_ENDPOINT, b.environment.OTEL_EXPORTER_OTLP_ENDPOINT);
  assert.notEqual(a.environment.SGSD_RUN_ID, b.environment.SGSD_RUN_ID);
  assert.notEqual(a.environment.SGSD_ATLAS_STATE_DIR, b.environment.SGSD_ATLAS_STATE_DIR);
  assert.equal(a.environment.OTEL_LOG_RAW_API_BODIES, '0');
  assert.equal((await prepare({ root: f.root, projectDir: f.projects[0], disabled: true })).enabled, false);
});

test('launch from a project subdirectory keeps one project registration', t => {
  const f = fixture(t), nested = path.join(f.projects[0], 'src', 'nested');
  fs.mkdirSync(nested, { recursive: true });
  assert.equal(registerRun({ root: f.root, projectDir: nested }).project_id,
    registerRun({ root: f.root, projectDir: f.projects[0] }).project_id);
});

test('registered endpoint rejects a different provider in canonical events', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai' });
  const event = normalizeLogs(payload('claude-session', 'request')).events[0];
  const response = await fetch(`${instance.urls.ingest}/runs/${run.run_id}/v1/events`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) });
  assert.ok(response.status >= 400);
});

test('synthetic ID-bearing legacy Codex completions deduplicate tokens and omit private bodies', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor' });
  const body = payload('codex-session', 'response-one', 23);
  const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
  attrs.find(a => a.key === 'event.name').value.stringValue = 'codex.sse_event';
  attrs.find(a => a.key === 'model').value.stringValue = 'gpt-6-astra';
  attrs.push({ key: 'kind', value: { stringValue: 'response.completed' } },
    { key: 'output_tokens', value: { intValue: '7' } }, { key: 'reasoning_output_tokens', value: { intValue: '3' } });
  assert.equal((await send(instance, run, body)).status, 200);
  await send(instance, run, body);
  const canonical = rows(run), requests = canonical.filter(e => e.event_type === 'api_request');
  assert.equal(requests.length, 1); assert.equal(requests[0].usage.input_tokens, 23);
  assert.equal(requests[0].usage.output_tokens, 7); assert.equal(requests[0].usage.reasoning_tokens, 3);
  assert.equal(requests[0].runtime.provider, 'openai'); assert.equal(requests[0].scope.launcher_repo_id, run.project_id);
  assert.doesNotMatch(JSON.stringify(canonical), /PRIVATE_|forged/);
});

test('observed native Codex completion without provider request identity remains non-billable coverage', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor' });
  const body = payload('native-codex-session', 'remove-request', 999);
  const record = body.resourceLogs[0].scopeLogs[0].logRecords[0];
  const attrs = record.attributes;
  attrs.find(a => a.key === 'event.name').value.stringValue = 'codex.sse_event';
  attrs.find(a => a.key === 'session.id').key = 'conversation.id';
  attrs.find(a => a.key === 'model').value.stringValue = 'gpt-6-astra';
  attrs.splice(attrs.findIndex(a => a.key === 'request_id'), 1);
  attrs.splice(attrs.findIndex(a => a.key === 'input_tokens'), 1);
  attrs.splice(attrs.findIndex(a => a.key === 'event.timestamp'), 1);
  record.timeUnixNano = '1788782400000000000';
  attrs.push({ key: 'event.kind', value: { stringValue: 'response.completed' } },
    { key: 'input_token_count', value: { intValue: '23' } },
    { key: 'output_token_count', value: { intValue: '7' } },
    { key: 'cached_token_count', value: { intValue: '5' } },
    { key: 'reasoning_token_count', value: { intValue: '3' } },
    { key: 'total_token_count', value: { intValue: '30' } });
  assert.equal((await send(instance, run, body)).status, 200);
  assert.equal((await send(instance, run, body)).status, 200);
  const canonical = rows(run);
  assert.equal(canonical.length, 1, 'native coverage must deduplicate without inflating requests');
  assert.equal(canonical[0].event_type, 'coverage');
  assert.equal(canonical[0].source.completeness_reason, 'missing_stable_request_identity');
  assert.equal(canonical[0].identity.session_id, 'native-codex-session');
  assert.equal(canonical[0].identity.request_id, null);
  assert.equal(Object.values(canonical[0].usage).every(value => value === null), true);
  assert.doesNotMatch(JSON.stringify(canonical), /PRIVATE_|forged/);
  const health = await (await fetch(instance.urls.health + '/health')).json();
  assert.ok(health.coverage.missing_stable_identity >= 1);
});

test('Claude request sequence without provider request ID is coverage, not token accounting', () => {
  const body = payload('missing-request', 'r', 123);
  const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
  attrs.splice(attrs.findIndex(a => a.key === 'request_id'), 1);
  attrs.push({ key: 'event.sequence', value: { intValue: '7' } });
  const normalized = normalizeLogs(body);
  assert.equal(normalized.missing_stable_identity, 1);
  assert.equal(normalized.events[0].event_type, 'coverage');
  assert.equal(normalized.events[0].usage.input_tokens, null);
});

test('end-of-session marker is registered and idempotent', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root, spoolPollMs: 20 });
  t.after(() => instance.close());
  const prepared = await prepare({ root: f.root, projectDir: f.projects[0] });
  const { finish } = require('./global.cjs');
  assert.equal(finish({ root: f.root, runId: prepared.run.run_id }), true);
  finish({ root: f.root, runId: prepared.run.run_id });
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && (!fs.existsSync(prepared.run.metrics_dir) || !rows(prepared.run).some(row => row.source.completeness_reason === 'launcher_session_exit')))
    await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(rows(prepared.run).filter(row => row.source.completeness_reason === 'launcher_session_exit').length, 1);
});

test('timed-out bootstrap retains ownership until its delayed receiver publishes', async t => {
  const f = fixture(t);
  const cp = require('node:child_process'), original = cp.spawn;
  let starts = 0, instance;
  const instances = [], pending = [];
  cp.spawn = (_file, args) => {
    starts++;
    const token = args[args.indexOf('--startup-token') + 1];
    pending.push(new Promise(resolve => setTimeout(async () => {
      instance = await startGlobal({ root: f.root, startupToken: token }); instances.push(instance); resolve();
    }, 220)));
    return { pid: process.pid, on() {}, unref() {} };
  };
  t.after(async () => { cp.spawn = original; await Promise.all(pending); await Promise.all(instances.map(server => server.close())); });
  // Reload only the bootstrap module so its spawn binding sees this isolated delay.
  delete require.cache[require.resolve('./global.cjs')];
  const bootstrap = require('./global.cjs');
  await assert.rejects(bootstrap.ensureService(f.root, 60), /timeout/);
  const service = await bootstrap.ensureService(f.root, 1500);
  assert.equal(starts, 1);
  assert.equal(service.instance_id, instance.instanceId);
});

module.exports = { payload, rows, fixture };
