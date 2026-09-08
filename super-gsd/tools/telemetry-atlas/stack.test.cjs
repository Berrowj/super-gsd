'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');
const http = require('node:http');
const modulePath = path.join(__dirname, 'stack.cjs');
function stack() { assert.ok(fs.existsSync(modulePath), 'explicit stack delivery module is implemented'); return require(modulePath); }
function fixture(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-stack-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return { stateDir: path.join(root, 'state'), projectDir: path.join(root, 'project') }; }

test('trusted Linux releases have committed official versions, URLs and archive digests', () => {
  const releases = stack().RELEASES;
  assert.equal(releases.collector.version, '0.160.0');
  assert.equal(releases.prometheus.version, '3.14.0');
  for (const release of Object.values(releases)) { assert.match(release.url, /^https:\/\/github\.com\/(open-telemetry\/opentelemetry-collector-releases|prometheus\/prometheus)\/releases\/download\/v[\d.]+\//); assert.match(release.sha256, /^[a-f0-9]{64}$/); }
});

test('checksum mismatch is rejected before archive extraction', async t => {
  const f = fixture(t); const archive = path.join(path.dirname(f.stateDir), 'untrusted.tar.gz'); fs.writeFileSync(archive, 'invalid archive');
  await assert.rejects(stack().verifyArchive(archive, '0'.repeat(64)), { message: 'archive_checksum_mismatch' });
  assert.equal(fs.existsSync(f.stateDir), false);
  const expected = crypto.createHash('sha256').update('invalid archive').digest('hex');
  assert.equal(await stack().verifyArchive(archive, expected), expected);
});

test('status and runtime specs never install or silently enable absent binaries', t => {
  const f = fixture(t); assert.equal(stack().loadInstallation(f), null); assert.throws(() => stack().processSpecs(f), /stack_not_installed/); assert.equal(fs.existsSync(f.stateDir), false);
});

test('collector sanitizes every signal before any buffering or persistent exporter', t => {
  const config = stack().collectorConfig(fixture(t));
  for (const pipeline of Object.values(config.service.pipelines)) {
    assert.equal(pipeline.processors[0], 'transform/privacy');
    assert.ok(pipeline.processors.indexOf('batch') > 0);
    assert.ok(pipeline.processors.indexOf('memory_limiter') > 0);
  }
  const privacy = config.processors['transform/privacy']; assert.equal(privacy.error_mode, 'propagate');
  const statements = JSON.stringify(privacy);
  for (const required of ['keep_keys(log.attributes', 'set(log.body, "")', 'set(log.severity_text, "")', 'set(resource.schema_url, "")', 'set(scope.schema_url, "")', 'keep_keys(scope.attributes, [])', 'IsString', 'IsInt']) assert.ok(statements.includes(JSON.stringify(required).slice(1, -1)), required);
  assert.deepEqual(config.service.telemetry.logs.output_paths, ['/dev/null']);
  assert.deepEqual(config.service.telemetry.logs.error_output_paths, ['/dev/null']);
  assert.equal(config.receivers.otlp.protocols.http.endpoint, '127.0.0.1:4318');
  assert.equal(config.exporters.otlp_http.endpoint, 'http://127.0.0.1:4319');
  assert.equal(config.exporters.otlp_http.encoding, 'json');
  assert.equal(config.service.pipelines.traces, undefined);
});

test('queue, spool, Prometheus retention and labels are bounded in generated configuration', t => {
  const f = fixture(t); const collector = stack().collectorConfig(f); const prom = stack().prometheusConfig(f);
  assert.equal(collector.extensions.file_storage.max_size, 128 * 1024 * 1024);
  assert.equal(collector.exporters.otlp_http.sending_queue.storage, 'file_storage');
  assert.equal(collector.exporters.otlp_http.retry_on_failure.max_elapsed_time, '24h');
  assert.deepEqual(collector.exporters['file/spool'].rotation, { max_megabytes: 16, max_days: 7, max_backups: 31 });
  assert.equal(collector.exporters.prometheus.endpoint, '127.0.0.1:9464');
  assert.equal(collector.exporters.prometheus.without_scope_info, true);
  const labelKeep = prom.scrape_configs[0].metric_relabel_configs.find(x => x.action === 'labelkeep').regex;
  assert.equal(new RegExp(`^(?:${labelKeep})$`).test('session_id'), false);
  assert.equal(new RegExp(`^(?:${labelKeep})$`).test('run_id'), false);
  assert.equal(new RegExp(`^(?:${labelKeep})$`).test('model'), true);
  assert.ok(collector.service.telemetry.metrics.readers?.length, 'Collector exposes loopback queue accounting');
  assert.equal(collector.service.telemetry.metrics.readers[0].pull.exporter.prometheus.host, '127.0.0.1');
  assert.equal(collector.service.telemetry.metrics.readers[0].pull.exporter.prometheus.port, 9466);
  assert.equal(collector.service.telemetry.resource['service.instance.id'], null);
  assert.ok(collector.service.pipelines.metrics.exporters.includes('file/spool'));
});

test('unsafe and colliding ports fail before configuration files are created', t => {
  const f = fixture(t); assert.throws(() => stack().collectorConfig({ ...f, ports: { otlp: 0 } }), /invalid_port/);
  assert.throws(() => stack().collectorConfig({ ...f, ports: { otlp: 4319 } }), /duplicate_port/);
  assert.equal(fs.existsSync(f.stateDir), false);
});

test('installation witness rejects external executable paths and untrusted version manifests', t => {
  const f = fixture(t); fs.mkdirSync(f.stateDir); fs.writeFileSync(path.join(f.stateDir, 'installation.json'), JSON.stringify({ schema_version: 1, binaries: { collector: { path: process.execPath, sha256: '0'.repeat(64) } } }));
  assert.throws(() => stack().loadInstallation(f), /installation_invalid/);
});

test('explicit offline archive corruption leaves no published executables or installation witness', { skip: process.platform !== 'linux' }, async t => {
  const f = fixture(t); const archiveDir = path.join(path.dirname(f.stateDir), 'archives'); fs.mkdirSync(archiveDir);
  fs.writeFileSync(path.join(archiveDir, path.basename(new URL(stack().RELEASES.collector.url).pathname)), 'corrupt-offline-cache');
  await assert.rejects(stack().install({ ...f, archiveDir }), /archive_checksum_mismatch/);
  assert.equal(fs.existsSync(path.join(f.stateDir, 'bin')), false); assert.equal(stack().loadInstallation(f), null);
});

test('actual pinned Linux binaries install explicitly and validate both generated configurations', { skip: process.platform !== 'linux' || process.env.SGSD_ATLAS_REAL_STACK_TEST !== '1', timeout: 300000 }, async t => {
  const f = fixture(t); fs.mkdirSync(f.projectDir); const result = await stack().install({ ...f, archiveDir: process.env.SGSD_ATLAS_STACK_ARCHIVE_DIR });
  assert.equal(result.schema_version, 1); assert.ok(stack().loadInstallation(f));
  const specs = stack().processSpecs({ ...f, instanceId: 'fixture-instance', ports: { otlp: 24318, normalizer: 24319, collectorHealth: 23133, metrics: 29464, prometheus: 29090, normalizerHealth: 23134, normalizerMetrics: 29465, collectorInternal: 29466 } });
  assert.deepEqual(specs.map(x => x.name), ['collector', 'prometheus']);
  assert.ok(specs[1].args.includes('--storage.tsdb.retention.time=35d')); assert.ok(specs[1].args.includes('--storage.tsdb.retention.size=2GB'));
  assert.equal(spawnSync(specs[0].executable, ['validate', '--config', path.join(f.stateDir, 'config', 'collector.json')]).status, 0);
  assert.equal(spawnSync(path.join(f.stateDir, 'bin', 'promtool'), ['check', 'config', path.join(f.stateDir, 'config', 'prometheus.json')]).status, 0);
  assert.equal(fs.statSync(path.join(f.stateDir, 'installation.json')).mode & 0o777, 0o600);
  assert.equal(fs.statSync(f.stateDir).mode & 0o777, 0o700);
  const canonicalServer = await require('./server.cjs').startServer({ ...f, ingestPort: 0, healthPort: 23134, metricsPort: 29465, instanceId: 'fixture-normalizer', partitionId: 'fixture' }); t.after(() => canonicalServer.close());
  const received = []; const normalizer = http.createServer((request, response) => { let body = ''; request.on('data', chunk => { body += chunk; }); request.on('end', async () => { received.push(body); const result = await fetch(canonicalServer.urls.ingest + request.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }); response.writeHead(result.status, { 'Content-Type': 'application/json' }); response.end(await result.text()); }); });
  await new Promise(resolve => normalizer.listen(24319, '127.0.0.1', resolve)); t.after(() => normalizer.close());
  const children = []; let diagnostic = '';
  for (const spec of specs) {
    const child = spawn(spec.executable, spec.args, { env: { ...process.env, ...spec.env }, stdio: ['ignore', 'pipe', 'pipe'] }); children.push(child);
    child.stdout.on('data', data => { diagnostic += data; }); child.stderr.on('data', data => { diagnostic += data; });
    t.after(async () => { if (child.exitCode === null) { child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); } });
    let ready = false;
    for (let i = 0; i < 100; i++) { try { ready = (await fetch(spec.healthUrl)).ok; } catch {} if (ready) break; await new Promise(resolve => setTimeout(resolve, 50)); }
    assert.ok(ready, `${spec.name} became healthy`);
  }
  const canary = 'FORBIDDEN_PRIVATE_CONTENT_canary@example.invalid';
  const attr = (key, value) => ({ key, value: typeof value === 'number' ? { intValue: String(value) } : { stringValue: value } });
  const nested = { kvlistValue: { values: [attr('prompt', canary)] } };
  const payload = { resourceLogs: [{ schemaUrl: canary, resource: { attributes: [attr('user.email', canary), attr('host.name', canary), attr('service.name', 'claude-code')] }, scopeLogs: [{ schemaUrl: canary, scope: { name: canary, version: canary, attributes: [attr('prompt', canary)] }, logRecords: [{ timeUnixNano: String(BigInt(Date.now()) * 1000000n), severityText: canary, eventName: canary, body: nested, attributes: [attr('event.name', 'claude_code.api_request'), attr('request_id', 'request-fixture-01'), attr('session.id', 'session-fixture-01'), attr('input_tokens', 10), attr('output_tokens', 3), attr('raw_body', canary), { key: 'model', value: nested }, { key: 'cost_usd', value: nested }] }] }] }] };
  payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes[0] = attr('event.name', 'api_request');
  payload.resourceLogs[0].resource.attributes.push(attr('sgsd.run.id', 'run-fixture-01'));
  const posted = await fetch('http://127.0.0.1:24318/v1/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); assert.equal(posted.status, 200);
  payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes = [attr('event.name', 'tool_result'), attr('session.id', 'session-fixture-01'), attr('tool_use_id', 'tool-fixture-01'), attr('tool_name', 'Bash'), attr('success', 'false'), attr('app.version', '2.1.251'), { key: 'server_fallback_hop', value: { boolValue: true } }];
  assert.equal((await fetch('http://127.0.0.1:24318/v1/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).status, 200);
  for (const [eventName, sequence, fields] of [
    ['assistant_response', 3, { response_length: 84, 'message.uuid': 'message-fixture-01', 'workflow.run_id': 'workflow-fixture-01', 'agent.name': 'Plan', query_source: 'prompt_suggestion', response: canary }],
    ['compaction', 4, { success: 'true', duration_ms: 12, query_source: 'compact', summary: canary }],
    ['api_retries_exhausted', 5, { total_attempts: 3, query_source: 'explore', error: canary }]
  ]) {
    payload.resourceLogs[0].scopeLogs[0].logRecords[0].attributes = [attr('event.name', eventName), attr('session.id', 'session-fixture-01'), attr('event.sequence', sequence), ...Object.entries(fields).map(([key, value]) => attr(key, value))];
    assert.equal((await fetch('http://127.0.0.1:24318/v1/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })).status, 200);
  }
  const metric = { resourceMetrics: [{ schemaUrl: canary, resource: { attributes: [attr('service.instance.id', canary)] }, scopeMetrics: [{ schemaUrl: canary, scope: { name: canary }, metrics: [{ name: 'claude_code.token.usage', description: canary, unit: canary, sum: { aggregationTemporality: 2, isMonotonic: true, dataPoints: [{ timeUnixNano: String(BigInt(Date.now()) * 1000000n), asInt: '10', attributes: [attr('session.id', canary), attr('model', 'claude-opus-4-7'), attr('type', 'input')], exemplars: [{ asInt: '2', timeUnixNano: String(BigInt(Date.now()) * 1000000n), filteredAttributes: [attr('body', canary)] }] }] } }] }] }] };
  metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints.push({ timeUnixNano: String(BigInt(Date.now()) * 1000000n), asInt: '3', attributes: [attr('model', 'claude-opus-4-7'), attr('type', 'output')] });
  const postedMetric = await fetch('http://127.0.0.1:24318/v1/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(metric) });
  assert.equal(postedMetric.status, 200, await postedMetric.text());
  await fetch('http://127.0.0.1:24318/v1/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: `{"resourceLogs":${canary}` });
  for (let i = 0; received.length < 2 && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(received.length >= 2, 'both sanitized signals reached normalizer'); assert.ok(received.some(body => body.includes('request-fixture-01')));
  const receivedLogs = received.flatMap(body => JSON.parse(body).resourceLogs || []).flatMap(resource => resource.scopeLogs || []).flatMap(scope => scope.logRecords || []);
  const toolRecord = receivedLogs.find(record => record.attributes?.some(attribute => attribute.key === 'tool_use_id'));
  assert.ok(toolRecord); assert.equal(toolRecord.attributes.find(attribute => attribute.key === 'success')?.value?.boolValue, false, 'native string false is retained as boolean false');
  assert.equal(toolRecord.attributes.find(attribute => attribute.key === 'app.version')?.value?.stringValue, '2.1.251');
  assert.equal(toolRecord.attributes.find(attribute => attribute.key === 'server_fallback_hop')?.value?.boolValue, true);
  const spool = fs.readFileSync(path.join(f.stateDir, 'spool', 'content-free.jsonl'), 'utf8'); const scrape = await (await fetch('http://127.0.0.1:29464/metrics')).text();
  assert.match(scrape, /claude_code_token_usage/); assert.match(scrape, /model="claude-opus"/);
  for (const output of [...received, spool, scrape, diagnostic]) assert.equal(output.includes(canary), false, 'no content persisted, exported, scraped or logged');
  const internal = await (await fetch('http://127.0.0.1:29466/metrics')).text();
  assert.match(internal, /otelcol_exporter_queue_size/); assert.equal(internal.includes('service_instance_id'), false); assert.equal(internal.includes(canary), false);
  assert.equal(scrape.includes('session_id'), false); assert.equal(scrape.includes('service_instance_id'), false);
  const canonical = require('./contract.cjs').readLedger(path.join(f.projectDir, '.planning', 'metrics', 'sgsd-atlas-events-fixture.jsonl')).events;
  assert.equal(canonical.filter(event => event.event_type === 'api_request').length, 1);
  assert.equal(canonical.find(event => event.event_type === 'api_request').identity.sgsd_run_id, 'run-fixture-01');
  assert.equal(canonical.find(event => event.event_type === 'tool')?.tool.name, 'Bash', 'fixed-vocabulary tool identity survives Collector');
  const responseEvent = canonical.find(event => event.execution.status === 'assistant_response');
  assert.ok(responseEvent, 'content-free assistant response measurement reaches canonical storage');
  assert.equal(responseEvent.usage.visible_response_chars, 84); assert.equal(responseEvent.identity.message_id, 'message-fixture-01');
  assert.equal(responseEvent.identity.workflow_id, 'workflow-fixture-01'); assert.equal(responseEvent.runtime.active_agent, 'Plan');
  assert.equal(responseEvent.runtime.query_source, 'auxiliary');
  const compactEvent = canonical.find(event => event.execution.status === 'compaction');
  assert.ok(compactEvent); assert.equal(compactEvent.execution.compaction_event, true); assert.equal(compactEvent.execution.success, true);
  const retriesEvent = canonical.find(event => event.execution.status === 'api_retries_exhausted');
  assert.ok(retriesEvent); assert.equal(retriesEvent.execution.retry_count, 2); assert.equal(retriesEvent.execution.success, false);
  assert.equal(retriesEvent.runtime.query_source, 'subagent');
  assert.equal(JSON.stringify(canonical).includes(canary), false);
  let series = [];
  for (let i = 0; i < 80; i++) { const query = await (await fetch('http://127.0.0.1:29090/api/v1/query?query=sgsd_atlas_native_token_observation')).json(); series = query.data?.result || []; if (series.length >= 2) break; await new Promise(resolve => setTimeout(resolve, 250)); }
  assert.equal(series.length, 2, 'Prometheus stores distinct input and output native observations');
  assert.deepEqual(series.map(point => point.metric.token_type).sort(), ['input', 'output']);
  assert.ok(series.every(point => point.metric.model_family === 'opus'));
  for (const child of children) { child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); }
  fs.appendFileSync(specs[0].executable, 'corrupt'); assert.throws(() => stack().loadInstallation(f), /installation_binary_mismatch/);
});
