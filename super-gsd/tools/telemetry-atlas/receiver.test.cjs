'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const net = require('node:net');
const { canonicalClaudeLogs, canonicalClaudeMetrics, startServer } = require('./server.cjs');
const { digest, createStore } = require('./contract.cjs');

function attributes(values) {
  return Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => ({
    key, value: typeof value === 'number' ? { doubleValue: value }
      : typeof value === 'boolean' ? { boolValue: value } : { stringValue: value },
  }));
}
function logs(values = {}, resource = {}) {
  return { resourceLogs: [{ resource: { attributes: attributes({ 'sgsd.run_id': 'run-1',
    'sgsd.cost_center': 'orchestrator', 'sgsd.launcher_repo_id': 'repo-1', ...resource }) },
  scopeLogs: [{ logRecords: [{ timeUnixNano: '1788782400000000000',
    attributes: attributes({ 'event.name': 'api_request', 'event.sequence': 7,
      'session.id': 'session-1', request_id: 'req-1', model: 'claude-opus-4-7',
      input_tokens: 11, output_tokens: 3, cache_read_tokens: 19, ...values }) }] }] }] };
}
function metrics(amount = 42, extras = {}) {
  return { resourceMetrics: [{ scopeMetrics: [{ metrics: [{ name: 'claude_code.token.usage',
    sum: { aggregationTemporality: 2, isMonotonic: true, dataPoints: [{
      asDouble: amount, startTimeUnixNano: '1788782300000000000', timeUnixNano: '1788782400000000000',
      attributes: attributes({ type: 'cacheRead', model: 'claude-opus-4-7', ...extras }),
    }] } }] }] }] };
}
async function fixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-receiver-'));
  const instance = await startServer({ projectDir: root, ingestPort: 0, healthPort: 0,
    metricsPort: 0, instanceId: 'fixture-nonce', ...options });
  return { root, instance, async close() { await instance.close(); fs.rmSync(root, { recursive: true, force: true }); } };
}
async function post(instance, endpoint, value, headers = {}) {
  const response = await fetch(instance.urls.ingest + endpoint, { method: 'POST',
    headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(value) });
  return { status: response.status, body: await response.json() };
}

test('native failures preserve attempt, scoped identity, resource run and string false', () => {
  const [error] = canonicalClaudeLogs(logs({ 'event.name': 'api_error', request_id: undefined,
    client_request_id: 'client-1', attempt: 3, error: 'secret@example.test /private/file', input_tokens: undefined }));
  assert.equal(error.event_type, 'api_request');
  assert.equal(error.execution.status, 'api_error');
  assert.equal(error.execution.success, false);
  assert.equal(error.execution.retry_count, 2);
  assert.equal(error.identity.client_request_id, 'client-1');
  assert.equal(error.identity.sgsd_run_id, 'run-1');
  assert.equal(error.scope.cost_center, 'orchestrator');
  assert.equal(error.event_sequence, 7);
  assert.equal(error.usage.input_tokens, null);
  assert.equal(error.usage.reasoning_tokens, null);
  assert.doesNotMatch(JSON.stringify(error), /secret|private/);
  const [tool] = canonicalClaudeLogs(logs({ 'event.name': 'tool_result', tool_use_id: 'tool-1', success: 'false' }));
  assert.equal(tool.execution.success, false);
  assert.equal(tool.tool.success, false);
});

test('refusal is distinct from same-request accounting and fallback refusals remain distinct', () => {
  const [request] = canonicalClaudeLogs(logs());
  const [refusal] = canonicalClaudeLogs(logs({ 'event.name': 'api_refusal', server_fallback_hop: false }));
  const [hop] = canonicalClaudeLogs(logs({ 'event.name': 'api_refusal', server_fallback_hop: true }));
  assert.equal(refusal.event_type, 'api_request');
  assert.equal(refusal.execution.status, 'api_refusal');
  assert.equal(refusal.execution.stop_reason, 'refusal');
  assert.equal(refusal.execution.fallback, false);
  assert.equal(hop.execution.fallback, true);
  assert.equal(refusal.usage.input_tokens, null);
  assert.notEqual(request.source_event_id, refusal.source_event_id);
  assert.notEqual(hop.source_event_id, refusal.source_event_id);
});

test('identity uses session and stable event sequence, never just timestamps or event payload', () => {
  const first = canonicalClaudeLogs(logs())[0];
  assert.notEqual(first.source_event_id, canonicalClaudeLogs(logs({ 'session.id': 'session-2' }))[0].source_event_id);
  assert.equal(first.source_event_id, canonicalClaudeLogs(logs({ input_tokens: 12 }))[0].source_event_id);
  const sequence = logs({ request_id: undefined });
  assert.equal(canonicalClaudeLogs(sequence).length, 1);
  sequence.resourceLogs[0].scopeLogs[0].logRecords[0].timeUnixNano = '1788782410000000000';
  assert.equal(canonicalClaudeLogs(sequence)[0].source_event_id,
    canonicalClaudeLogs(logs({ request_id: undefined }))[0].source_event_id);
  assert.deepEqual(canonicalClaudeLogs(logs({ request_id: undefined, 'event.sequence': undefined })), []);
  assert.deepEqual(canonicalClaudeLogs(logs({ 'session.id': undefined })), []);
});

test('OTLP allowlist removes native content, identity and arbitrary labels from persisted events', async () => {
  const f = await fixture();
  try {
    const payload = logs({ error: 'CANARY-RAW', tool_input: 'CANARY-RAW',
      'user.email': 'CANARY-RAW@example.test', query_source: '/CANARY-RAW/path',
      'agent.name': 'CANARY-RAW', tool_name: 'CANARY-RAW' },
    { 'host.name': 'CANARY-RAW', 'user.account_id': 'CANARY-RAW', 'workspace.host_paths': 'CANARY-RAW' });
    assert.equal((await post(f.instance, '/v1/logs', payload)).status, 200);
    const rows = f.instance.store.read().events;
    assert.equal(rows.length, 1);
    assert.doesNotMatch(JSON.stringify(rows), /CANARY-RAW/);
    assert.equal(rows[0].runtime.query_source, 'unknown');
    assert.equal(rows[0].payload.raw_content_recorded, false);
  } finally { await f.close(); }
});

test('native metrics remain separate observations and cannot inflate canonical request totals', async () => {
  const f = await fixture();
  try {
    assert.equal(canonicalClaudeMetrics(metrics())[0].usage, undefined);
    await post(f.instance, '/v1/logs', logs());
    await post(f.instance, '/v1/logs', logs());
    await post(f.instance, '/v1/metrics', metrics(42, { 'session.id': 'session-secret', 'sgsd.run_id': 'run-secret' }));
    await post(f.instance, '/v1/metrics', metrics(42));
    assert.equal(f.instance.store.read().events.length, 1);
    const text = await (await fetch(f.instance.urls.metrics + '/metrics')).text();
    assert.match(text, /sgsd_atlas_request_tokens_total\{[^\n]*token_type="cache_read"[^\n]*\} 19/);
    assert.match(text, /sgsd_atlas_native_token_observation\{[^\n]*token_type="cache_read"[^\n]*\} 42/);
    assert.doesNotMatch(text, /session-secret|run-secret|request_id|session_id|sgsd_run_id/);
  } finally { await f.close(); }
});

test('health verifies process, instance and project and reports absent/missing native coverage', async () => {
  const f = await fixture();
  try {
    const health = await (await fetch(f.instance.urls.health + '/health')).json();
    assert.equal(health.pid, process.pid);
    assert.equal(health.instance_id, 'fixture-nonce');
    assert.equal(health.project_id, digest(path.resolve(f.root)));
    assert.equal(health.coverage.native_requests, 'unavailable');
    assert.equal('ledger_path' in health, false);
    const rejected = await post(f.instance, '/v1/logs', logs({ request_id: undefined, 'event.sequence': undefined }));
    assert.equal(rejected.body.partialSuccess.rejectedLogRecords, 1);
    const next = await (await fetch(f.instance.urls.health + '/health')).json();
    assert.equal(next.coverage.native_requests, 'partial');
    assert.equal(next.coverage.missing_stable_identity, 1);
  } finally { await f.close(); }
});

test('receiver rejects browser origins, malformed OTLP, oversized bodies and unknown routes safely', async () => {
  const f = await fixture({ maxBodyBytes: 512 });
  try {
    assert.equal((await post(f.instance, '/v1/events', {}, { origin: 'http://evil.test' })).status, 403);
    assert.equal((await post(f.instance, '/v1/logs', { resourceLogs: {} })).status, 400);
    const response = await post(f.instance, '/v1/logs', { private: 'CANARY'.repeat(256) });
    assert.equal(response.status, 413);
    assert.doesNotMatch(JSON.stringify(response.body), /CANARY/);
    assert.equal((await fetch(f.instance.urls.health + '/unknown')).status, 404);
    assert.equal((await fetch(f.instance.urls.metrics + '/unknown')).status, 404);
  } finally { await f.close(); }
});

test('slow requests have a fixed deadline and concurrency does not starve health', async () => {
  const f = await fixture({ requestTimeoutMs: 120, maxConcurrentRequests: 1 });
  try {
    let connected;
    const ready = new Promise((resolve) => { connected = resolve; });
    const slowResult = new Promise((resolve, reject) => {
      const request = http.request(f.instance.urls.ingest + '/v1/logs', {
        method: 'POST', headers: { 'content-type': 'application/json', 'transfer-encoding': 'chunked' },
      }, (response) => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
      request.on('error', reject); request.write('{'); request.flushHeaders();
      request.once('socket', (socket) => socket.once('connect', connected));
    });
    await ready;
    assert.equal((await post(f.instance, '/v1/logs', {})).status, 429);
    assert.equal((await fetch(f.instance.urls.health + '/health')).status, 200);
    assert.equal(await slowResult, 408);
  } finally { await f.close(); }
});

test('quota sampler spool drains into canonical partitions, including unavailable coverage', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-quota-drain-'));
  const stateDir = path.join(root, 'state');
  const { record } = require('./quota-sampler.cjs');
  const instance = await startServer({ projectDir: root, stateDir, ingestPort: 0,
    healthPort: 0, metricsPort: 0, spoolPollMs: 20 });
  try {
    const written = record({ session_id: 'session-1', version: '2.1.251',
      rate_limits: { seven_day: { used_percentage: 15, resets_at: 1789401600 } },
    }, { stateDir, runId: 'run-1', now: 1788782400000 });
    assert.equal(written.written, 1);
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline && !instance.store.read().events.length) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(instance.store.read().events.length, 1);
    assert.equal(instance.store.read().events[0].quota.used_percentage, 15);
    assert.equal(fs.readdirSync(path.join(stateDir, 'quota-spool')).length, 0);
    assert.equal(record({ session_id: 'session-1', version: '2.1.251' },
      { stateDir, runId: 'run-1', now: 1788782461000 }).written, 1);
    const end = Date.now() + 1000;
    while (Date.now() < end && instance.store.read().events.length < 2) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(instance.store.read().events[1].source.completeness_reason, 'rate_limits_unavailable');
    assert.equal(fs.readdirSync(path.join(stateDir, 'quota-spool')).length, 0);
  } finally { await instance.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('actual launcher session exit drains as lifecycle coverage without changing quota partitions', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-lifecycle-drain-'));
  const stateDir = path.join(root, 'state');
  const { execute } = require('./lifecycle.cjs');
  const { queueEvent } = require('./quota-sampler.cjs');
  const instance = await startServer({ projectDir: root, stateDir, ingestPort: 0,
    healthPort: 0, metricsPort: 0, spoolPollMs: 20 });
  try {
    assert.equal((await execute({ command: 'session-exit', projectDir: root, stateDir, runId: 'run-exit' })).recorded, true);
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline && !instance.store.read().events.length) await new Promise(resolve => setTimeout(resolve, 20));
    const [event] = instance.store.read().events;
    assert.ok(event);
    assert.equal(event.event_type, 'coverage');
    assert.equal(event.source.kind, 'atlas_lifecycle');
    assert.equal(event.source.completeness_reason, 'launcher_session_exit');
    assert.equal(event.identity.sgsd_run_id, 'run-exit');
    assert.equal(instance.store.status().partition_id, 'unknown');
    assert.equal(fs.readdirSync(path.join(stateDir, 'quota-spool')).length, 0);
    const { event_id, ingested_at, payload_sha256, ...input } = event;
    assert.equal(queueEvent({ ...input, source_event_id: 'invalid-lifecycle-quota', event_type: 'quota',
      quota: { window: 'seven_day', used_percentage: 15, resets_at: 1789401600, scope: 'account' } }, stateDir), true);
    let rejected = false;
    const end = Date.now() + 1000;
    while (Date.now() < end && !rejected) {
      rejected = (await (await fetch(instance.urls.health + '/health')).json()).coverage.quota_spool_rejected > 0;
      if (!rejected) await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(rejected, true);
    assert.equal(instance.store.read().events.length, 1);
    assert.equal(instance.store.status().partition_id, 'unknown');
  } finally { await instance.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('storage pressure remains visible without accepting data or exposing filesystem paths', async () => {
  const f = await fixture({ storeOptions: { freeRatio: () => 0.01 } });
  try {
    const result = await post(f.instance, '/v1/logs', logs());
    assert.equal(result.status, 503);
    assert.equal(result.body.reason, 'storage_unavailable');
    assert.equal(f.instance.store.read().events.length, 0);
    const health = await (await fetch(f.instance.urls.health + '/health')).json();
    assert.equal(health.status, 'degraded');
    assert.equal(health.storage.reason, 'disk_pressure');
    assert.equal(health.coverage.native_requests, 'partial');
    assert.equal(JSON.stringify(health).includes(f.root), false);
    assert.equal(fs.existsSync(path.join(f.root, '.planning', 'metrics', 'sgsd-atlas-gaps.jsonl')), true);
  } finally { await f.close(); }
});

test('a partially stored OTLP batch retries with 503 and replay does not inflate requests', async () => {
  let reads = 0;
  let recovered = false;
  const f = await fixture({ storeOptions: { freeRatio: () => recovered || ++reads === 1 ? 0.5 : 0.01 } });
  try {
    const payload = logs();
    payload.resourceLogs[0].scopeLogs[0].logRecords.push(logs({ request_id: 'req-2', 'event.sequence': 8 }).resourceLogs[0].scopeLogs[0].logRecords[0]);
    const first = await post(f.instance, '/v1/logs', payload);
    assert.equal(first.status, 503);
    assert.equal(f.instance.store.read().events.length, 1);
    recovered = true;
    const replay = await post(f.instance, '/v1/logs', payload);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.partialSuccess.rejectedLogRecords, 0);
    assert.equal(f.instance.store.read().events.length, 2);
    const text = await (await fetch(f.instance.urls.metrics + '/metrics')).text();
    assert.match(text, /sgsd_atlas_events_duplicate_total 1/);
    assert.match(text, /sgsd_atlas_request_tokens_total\{[^\n]*token_type="input"[^\n]*\} 22/);
  } finally { await f.close(); }
});

test('quota spool retries transient storage pressure after recovery', async () => {
  let healthy = false;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-quota-retry-'));
  const stateDir = path.join(root, 'state');
  const { record } = require('./quota-sampler.cjs');
  const instance = await startServer({ projectDir: root, stateDir, ingestPort: 0,
    healthPort: 0, metricsPort: 0, spoolPollMs: 20, storeOptions: { freeRatio: () => healthy ? 0.5 : 0.01 } });
  try {
    assert.equal(record({ session_id: 'session-1', rate_limits: {
      seven_day: { used_percentage: 15, resets_at: 1789401600 },
    } }, { stateDir, runId: 'run-1', now: 1788782400000 }).written, 1);
    let attempted = false;
    const deadline = Date.now() + 1000;
    while (Date.now() < deadline && !attempted) {
      const health = await (await fetch(instance.urls.health + '/health')).json();
      attempted = health.coverage.quota_spool_rejected > 0;
      if (!attempted) await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.equal(attempted, true);
    assert.equal(fs.readdirSync(path.join(stateDir, 'quota-spool')).length, 1);
    healthy = true;
    const end = Date.now() + 1000;
    while (Date.now() < end && !instance.store.read().events.length) await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(instance.store.read().events.length, 1);
    assert.equal(fs.readdirSync(path.join(stateDir, 'quota-spool')).length, 0);
  } finally { await instance.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('Collector-coarsened native model families remain classified with bounded labels', () => {
  for (const family of ['opus', 'sonnet', 'haiku']) {
    const [point] = canonicalClaudeMetrics(metrics(42, { model: `claude-${family}` }));
    assert.equal(point.labels.model_family, family);
  }
  const [unknown] = canonicalClaudeMetrics(metrics(42, { model: 'private-path-name' }));
  assert.equal(unknown.labels.model_family, 'unknown');
});

test('partition races and unverifiable crash locks keep native batches queued for retry', async () => {
  const f = await fixture();
  try {
    const other = createStore({ projectDir: f.root });
    const quota = canonicalClaudeLogs(logs())[0];
    quota.event_type = 'quota'; quota.source_event_id = 'quota-external';
    quota.quota = { window: 'seven_day', used_percentage: 15, resets_at: 1789401600, scope: 'account' };
    assert.equal(other.ingest(quota).status, 'accepted');
    assert.equal((await post(f.instance, '/v1/logs', logs())).status, 503);
    assert.equal(f.instance.store.status().reason, 'concurrent_partition_writer');
  } finally { await f.close(); }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-lock-retry-'));
  const metricsDir = path.join(root, '.planning', 'metrics');
  fs.mkdirSync(metricsDir, { recursive: true });
  fs.writeFileSync(path.join(metricsDir, '.sgsd-atlas-write.lock'), '');
  const instance = await startServer({ projectDir: root, ingestPort: 0, healthPort: 0, metricsPort: 0 });
  try {
    assert.equal((await post(instance, '/v1/logs', logs())).status, 503);
    assert.equal(instance.store.status().reason, 'writer_lock_unverifiable');
  } finally { await instance.close(); fs.rmSync(root, { recursive: true, force: true }); }
});

test('bind collisions close previously bound listeners and nonloopback binds are rejected', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-bind-check-'));
  const occupied = net.createServer();
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  try {
    await assert.rejects(startServer({ projectDir: root, ingestPort: port,
      healthPort: occupied.address().port, metricsPort: 0 }), { code: 'EADDRINUSE' });
    await assert.rejects(startServer({ projectDir: root, host: '0.0.0.0' }), /requires_loopback/);
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
  } finally {
    await new Promise(resolve => occupied.close(resolve)); await new Promise(resolve => probe.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a third-listener bind collision also releases the first two listeners', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-third-bind-check-'));
  const occupied = net.createServer(); await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  const free = async () => {
    const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port;
  };
  const ingest = await free(), health = await free(), probes = [];
  try {
    await assert.rejects(startServer({ projectDir: root, ingestPort: ingest,
      healthPort: health, metricsPort: occupied.address().port }), { code: 'EADDRINUSE' });
    for (const port of [ingest, health]) {
      const probe = net.createServer(); probes.push(probe);
      await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(port, '127.0.0.1', resolve); });
    }
  } finally {
    await Promise.all([occupied, ...probes].map(server => new Promise(resolve => server.close(resolve))));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('receiver close is one idempotent bounded drain and does not close its caller-owned store early', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-drain-check-'));
  const store = createStore({ projectDir: root });
  const instance = await startServer({ projectDir: root, store, ingestPort: 0, healthPort: 0, metricsPort: 0, closeGraceMs: 300 });
  let requestError;
  const response = new Promise(resolve => {
    const request = http.request(instance.urls.ingest + '/v1/logs', { method: 'POST',
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(JSON.stringify(logs())) } }, value => {
      value.resume(); value.on('end', () => resolve(value.statusCode));
    });
    request.on('error', error => { requestError = error; resolve(null); });
    request.write(JSON.stringify(logs()).slice(0, 20));
    setTimeout(() => request.end(JSON.stringify(logs()).slice(20)), 80);
  });
  await new Promise(resolve => setTimeout(resolve, 20));
  const first = instance.close(), second = instance.close();
  assert.equal(first, second, 'all signal paths must await the same drain promise');
  assert.equal(store.status().healthy, true, 'caller-owned store remains usable throughout server drain');
  assert.equal(await response, 200, requestError?.message);
  await first; fs.rmSync(root, { recursive: true, force: true });
});

test('receiver close forcibly bounds a client that never finishes its request', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-forced-drain-'));
  const instance = await startServer({ projectDir: root, ingestPort: 0, healthPort: 0, metricsPort: 0, closeGraceMs: 40 });
  const request = http.request(instance.urls.ingest + '/v1/logs', { method: 'POST', headers: {
    'content-type': 'application/json', 'content-length': '1000' } });
  request.on('error', () => {}); request.write('{'); await new Promise(resolve => setTimeout(resolve, 20));
  const started = Date.now(); await instance.close();
  assert.ok(Date.now() - started < 500, 'forced drain stays bounded'); request.destroy();
  fs.rmSync(root, { recursive: true, force: true });
});

module.exports = { logs, metrics, fixture };
