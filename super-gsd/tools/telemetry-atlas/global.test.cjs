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

test('native accounting authority is explicit, immutable and absent for legacy runs', t => {
  const f = fixture(t);
  const run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  assert.equal(run.accountingSource, 'codex_rollout');
  assert.equal(Object.isFrozen(run), true);
  assert.throws(() => { run.accountingSource = 'codex_otel'; }, TypeError);
  const { readRun } = require('./global-store.cjs');
  assert.equal(readRun(f.root, run.run_id).accountingSource, 'codex_rollout');
  assert.equal(registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai' }).accountingSource, undefined);
  assert.throws(() => registerRun({ root: f.root, projectDir: f.projects[0], provider: 'anthropic', accountingSource: 'codex_rollout' }), /accounting/);
});

function rollout(run, id = 'resp-native') {
  return require('../codex-worker/usage.cjs').projectUsageRecord({ timestamp: '2026-09-08T12:00:00Z', type: 'token_usage_record', payload: {
    thread_id: 'thread-native', turn_id: 'turn-native', session_id: 'session-native', root_turn_id: 'turn-native', response_id: id,
    usage: { input_tokens: 100, cached_input_tokens: 60, cache_write_input_tokens: 5, output_tokens: 20, reasoning_output_tokens: 12, total_tokens: 120 },
  } }, { run: { ...run, accountingSource: 'codex_rollout' }, threadId: 'thread-native', turnId: 'turn-native', model: 'gpt-6-astra', modelProvider: 'openai' }).event;
}
async function until(check) {
  const end = Date.now() + 2500;
  while (Date.now() < end) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 20)); }
  assert.fail('bounded fixture observation timed out');
}
function legacyCodex() {
  const body = payload('session-native', 'resp-native', 100);
  const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
  attrs.find(a => a.key === 'event.name').value.stringValue = 'codex.sse_event';
  attrs.find(a => a.key === 'model').value.stringValue = 'gpt-6-astra';
  attrs.push({ key: 'event.kind', value: { stringValue: 'response.completed' } }); return body;
}

test('native source claims cannot self-authorize direct or canonical HTTP intake', async t => {
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  const instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const event = rollout(run);
  assert.equal(instance.store.ingest(event).status, 'rejected');
  assert.equal(instance.store.ingest(event, { kind: 'private_spool', runId: run.run_id }).status, 'rejected');
  const response = await fetch(`${instance.urls.ingest}/runs/${run.run_id}/v1/events`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(event) });
  assert.equal(response.status, 400);
  assert.equal(fs.existsSync(run.metrics_dir), false);
});

test('registered native spool is authoritative in both arrival orders and drives health and accepted-only counters', async t => {
  const { queueEvent } = require('./quota-sampler.cjs');
  for (const order of ['otel-first', 'rollout-first']) {
    const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
    const instance = await startGlobal({ root: f.root, spoolPollMs: 20 }); t.after(() => instance.close());
    if (order === 'otel-first') await send(instance, run, legacyCodex());
    assert.equal(queueEvent(rollout(run), run.state_dir), true);
    await until(() => fs.existsSync(run.metrics_dir) && rows(run).some(e => e.source.kind === 'codex_rollout'));
    if (order === 'rollout-first') await send(instance, run, legacyCodex());
    const canonical = rows(run), metadata = canonical.find(e => e.source.kind === 'codex_otel');
    assert.equal(canonical.filter(e => e.event_type === 'api_request').length, 1);
    assert.equal(metadata.event_type, 'coverage'); assert.equal(Object.values(metadata.usage).every(v => v === null), true);
    const health = await (await fetch(instance.urls.health + '/health')).json();
    assert.equal(health.coverage.native_responses, 'observed');
    assert.equal(health.coverage.native_requests, 'unavailable', 'response ID is not HTTP request ID');
    queueEvent(rollout(run), run.state_dir);
    await until(() => fs.readdirSync(path.join(run.state_dir, 'quota-spool')).length === 0);
    let metrics = await (await fetch(instance.urls.metrics + '/metrics')).text();
    assert.match(metrics, /sgsd_atlas_request_tokens_total\{[^\n]*token_type="input"[^\n]*\} 100/);
    assert.match(metrics, /sgsd_atlas_events_duplicate_total 1/);
    const changed = rollout(run); changed.usage.input_tokens++;
    queueEvent(changed, run.state_dir);
    await until(() => rows(run).some(e => e.event_type === 'integrity_conflict'));
    metrics = await (await fetch(instance.urls.metrics + '/metrics')).text();
    assert.match(metrics, /sgsd_atlas_request_tokens_total\{[^\n]*token_type="input"[^\n]*\} 100/);
    assert.equal((await (await fetch(instance.urls.health + '/health')).json()).coverage.native_responses, 'partial');
  }
});

test('native spool rejects legacy authority, other registrations and malformed native envelopes', async t => {
  const { queueEvent } = require('./quota-sampler.cjs');
  const f = fixture(t), legacy = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor' });
  const native = registerRun({ root: f.root, projectDir: f.projects[1], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  const instance = await startGlobal({ root: f.root, spoolPollMs: 20 }); t.after(() => instance.close());
  assert.equal(queueEvent(rollout(legacy), legacy.state_dir), true);
  assert.equal(queueEvent(rollout(native), legacy.state_dir), true, 'valid envelope in wrong private route');
  const malformed = rollout(native); malformed.usage.total_provider_tokens = null;
  assert.equal(queueEvent(malformed, native.state_dir), false, 'producer refuses malformed usage');
  const dir = path.join(native.state_dir, 'quota-spool'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(dir, 'a'.repeat(64) + '.json'), JSON.stringify(malformed), { mode: 0o600 });
  await until(async () => (await (await fetch(instance.urls.health + '/health')).json()).coverage.quota_spool_rejected >= 3);
  for (const run of [legacy, native]) assert.ok(!fs.existsSync(run.metrics_dir) || !rows(run).some(e => e.event_type === 'api_request'));
});

test('direct global intake enforces registered provider and role while preparation opts in explicitly', async t => {
  const f = fixture(t), instance = await startGlobal({ root: f.root }); t.after(() => instance.close());
  const prepared = await prepare({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  assert.equal(prepared.run.accountingSource, 'codex_rollout');
  const { scopeEvent } = require('./global-store.cjs');
  const normalized = require('./codex-otlp.cjs').normalizeLogs(legacyCodex()).events[0];
  const value = scopeEvent(normalized, prepared.run);
  for (const section of ['provider', 'role', 'project']) {
    const forged = structuredClone(value);
    if (section === 'provider') forged.runtime.provider = 'anthropic';
    if (section === 'role') forged.scope.role = 'orchestrator';
    if (section === 'project') forged.scope.launcher_repo_id = 'b'.repeat(64);
    assert.equal(instance.store.ingest(forged).status, 'rejected', section);
  }
});

test('permanent native spool scope failures are terminal across repeated polls', async t => {
  const { queueEvent } = require('./quota-sampler.cjs');
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor' });
  queueEvent(rollout(run), run.state_dir);
  const instance = await startGlobal({ root: f.root, spoolPollMs: 20 }); t.after(() => instance.close());
  const failures = async () => (await (await fetch(instance.urls.health + '/health')).json()).coverage.quota_spool_rejected;
  await until(async () => await failures() > 0);
  const count = await failures();
  await new Promise(resolve => setTimeout(resolve, 180));
  assert.equal(await failures(), count, 'terminal scope rejection must not be parsed and rejected on every poll');
  assert.equal(fs.readdirSync(path.join(run.state_dir, 'quota-spool')).length, 1, 'retain rejected evidence without deleting user data');
});

test('strict native source validation rejects illegal fields and all invalid numeric dimensions before spool writes', t => {
  const { queueEvent } = require('./quota-sampler.cjs');
  const { validate } = require('./contract.cjs');
  const f = fixture(t), run = registerRun({ root: f.root, projectDir: f.projects[0], provider: 'openai', role: 'executor', accountingSource: 'codex_rollout' });
  const event = rollout(run);
  const mutations = [e => { e.identity.request_id = e.identity.response_id; }, e => { delete e.identity.turn_id; },
    e => { e.runtime.provider = 'anthropic'; }, e => { e.runtime.model_provenance = 'provider_response'; },
    e => { e.event_type = 'coverage'; }, e => { e.source.provenance = 'client_observed'; },
    e => { e.execution.success = false; }, e => { e.payload.prompt = 'PRIVATE-CANARY'; }];
  for (const field of Object.keys(event.usage)) for (const number of [-1, 0.2, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
    if (field === 'cache_creation_tokens' && number === null) continue;
    mutations.push(e => { e.usage[field] = number; });
  }
  for (const mutate of mutations) {
    const invalid = structuredClone(event); mutate(invalid);
    assert.ok(validate(invalid)); assert.equal(queueEvent(invalid, run.state_dir), false);
  }
  assert.equal(fs.existsSync(path.join(run.state_dir, 'quota-spool')), false);
});
