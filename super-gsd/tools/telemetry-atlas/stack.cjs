#!/usr/bin/env node
'use strict';

// No third-party dependency and no download except through explicit install().
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable, Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { spawnSync } = require('node:child_process');

const RELEASES = Object.freeze({
  collector: Object.freeze({ version: '0.160.0', url: 'https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v0.160.0/otelcol-contrib_0.160.0_linux_amd64.tar.gz', sha256: '7bb60c584c241c86261c2b8697cd3725dd8c56691f5ad5d98454eaa005b47b0c', members: ['otelcol-contrib'] }),
  prometheus: Object.freeze({ version: '3.14.0', url: 'https://github.com/prometheus/prometheus/releases/download/v3.14.0/prometheus-3.14.0.linux-amd64.tar.gz', sha256: 'f665c6da19eb7ba399c915d30c7d9793c9b417bf8a749b504bc470678631478d', members: ['prometheus-3.14.0.linux-amd64/prometheus', 'prometheus-3.14.0.linux-amd64/promtool'] })
});
const DEFAULT_PORTS = Object.freeze({ otlp: 4318, normalizer: 4319, collectorHealth: 13133, metrics: 9464, prometheus: 9090, normalizerHealth: 13134, normalizerMetrics: 9465, collectorInternal: 9466 });
const METRICS = ['claude_code.token.usage', 'claude_code.cost.usage', 'claude_code.session.count', 'claude_code.active_time.total'];
const EVENT_NAMES = ['api_request', 'api_error', 'api_refusal', 'tool_result', 'tool_decision', 'user_prompt', 'assistant_response', 'api_retries_exhausted', 'compaction'];
const EVENTS = EVENT_NAMES.map(name => `claude_code.${name}`);
const NUMERIC_LOG_KEYS = ['event.sequence', 'input_tokens', 'output_tokens', 'cache_read_tokens', 'cache_creation_tokens', 'duration_ms', 'cost_usd', 'cost_usd_micros', 'attempt', 'tool_input_size_bytes', 'tool_result_size_bytes', 'prompt_length', 'response_length', 'total_attempts'];
const BOOLEAN_LOG_KEYS = ['success', 'server_fallback_hop'];
const STRING_LOG_PATTERNS = {
  'app.version': '^[0-9]{1,5}[.][0-9]{1,5}[.][0-9]{1,5}$',
  'event.name': `^(claude_code[.])?(${EVENT_NAMES.join('|')})$`,
  'event.timestamp': '^[0-9TZ:.-]{10,40}$',
  request_id: '^[A-Za-z0-9_-]{1,128}$', 'request.id': '^[A-Za-z0-9_-]{1,128}$',
  client_request_id: '^[A-Za-z0-9_-]{1,128}$', 'session.id': '^[A-Za-z0-9_-]{1,128}$',
  'prompt.id': '^[A-Za-z0-9_-]{1,128}$', tool_use_id: '^[A-Za-z0-9_-]{1,128}$',
  session_id: '^[A-Za-z0-9_-]{1,128}$', 'message.uuid': '^[A-Za-z0-9_-]{1,128}$', 'workflow.run_id': '^[A-Za-z0-9_-]{1,128}$',
  'sgsd.run_id': '^[A-Za-z0-9_-]{1,128}$', 'sgsd.run.id': '^[A-Za-z0-9_-]{1,128}$', 'sgsd.launcher_repo_id': '^[a-f0-9]{16,64}$',
  'sgsd.cost_center': '^(orchestrator|executor|observer|narrator|board|recovery|unknown)$',
  'agent.name': '^(Explore|Plan|general-purpose|custom|unknown)$',
  tool_name: '^(Read|Write|Edit|MultiEdit|NotebookEdit|Bash|Glob|Grep|Agent|Task|Skill|WebFetch|WebSearch|TodoWrite|AskUserQuestion|Workflow)$',
  model: '^claude-(opus|sonnet|haiku)[-0-9.]{0,30}$',
  speed: '^(fast|normal|standard)$', effort: '^(low|medium|high|xhigh|max)$',
  query_source: '^(main|repl_main_thread|sdk|auxiliary|compact|summarize|prompt_suggestion|session_title|auto_mode|subagent|agent|explore|plan|general-purpose|unknown)$',
  decision: '^(accept|reject|allow|deny|approved|denied|auto|ask)$'
};
const RESOURCE_PATTERNS = { 'service.name': '^(claude-code|claude_code|sgsd)$', 'service.version': '^[0-9]{1,5}[.][0-9]{1,5}[.][0-9]{1,5}$', 'app.version': '^[0-9]{1,5}[.][0-9]{1,5}[.][0-9]{1,5}$', 'sgsd.run_id': '^[A-Za-z0-9_-]{1,128}$', 'sgsd.run.id': '^[A-Za-z0-9_-]{1,128}$', 'sgsd.launcher_repo_id': '^[a-f0-9]{16,64}$', 'sgsd.cost_center': '^(orchestrator|executor|observer|narrator|board|recovery|unknown)$' };

function options(input = {}) {
  if (!input.stateDir || !path.isAbsolute(input.stateDir) || /[\r\n$]/.test(input.stateDir)) throw new Error('invalid_state_directory');
  const stateDir = path.resolve(input.stateDir);
  if (stateDir === path.parse(stateDir).root) throw new Error('invalid_state_directory');
  const ports = { ...DEFAULT_PORTS, ...input.ports };
  for (const port of Object.values(ports)) if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid_port');
  if (new Set(Object.values(ports)).size !== Object.values(ports).length) throw new Error('duplicate_port');
  return { ...input, stateDir, ports };
}
function privateDir(dir) {
  // Refuse symlinks in every existing ancestor, including the caller's state root.
  let cursor = path.resolve(dir);
  while (cursor !== path.dirname(cursor)) { if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('unsafe_state_symlink'); cursor = path.dirname(cursor); }
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700);
}
function privateWrite(file, value) {
  if (fs.existsSync(file) && (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink())) throw new Error('unsafe_state_file');
  const temp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  fs.writeFileSync(temp, value, { flag: 'wx', mode: 0o600 }); fs.renameSync(temp, file); fs.chmodSync(file, 0o600);
}
function boundedStrings(prefix, patterns) {
  return Object.entries(patterns).flatMap(([key, pattern]) => [
    `delete_key(${prefix}, ${JSON.stringify(key)}) where not IsString(${prefix}[${JSON.stringify(key)}])`,
    `delete_key(${prefix}, ${JSON.stringify(key)}) where IsString(${prefix}[${JSON.stringify(key)}]) and not IsMatch(${prefix}[${JSON.stringify(key)}], ${JSON.stringify(pattern)})`
  ]);
}
function collectorConfig(input) {
  const { stateDir, ports } = options(input);
  const scope = ['keep_keys(scope.attributes, [])', 'set(scope.name, "sgsd-atlas")', 'set(scope.version, "1")', 'set(scope.schema_url, "")', 'set(resource.schema_url, "")'];
  const logStatements = [
    // The body is read only for a fixed native event name, then destroyed.
    ...EVENTS.flatMap(name => [name, name.replace('claude_code.', '')]).map(name => `set(log.attributes["event.name"], ${JSON.stringify(name)}) where log.body == ${JSON.stringify(name)} and log.attributes["event.name"] == nil`),
    'set(log.body, "")', 'set(log.severity_text, "")', 'set(log.event_name, "")',
    ...scope,
    `keep_keys(resource.attributes, ${JSON.stringify(Object.keys(RESOURCE_PATTERNS))})`,
    ...boundedStrings('resource.attributes', RESOURCE_PATTERNS),
    `keep_keys(log.attributes, ${JSON.stringify([...Object.keys(STRING_LOG_PATTERNS), ...NUMERIC_LOG_KEYS, ...BOOLEAN_LOG_KEYS])})`,
    ...boundedStrings('log.attributes', STRING_LOG_PATTERNS),
    ...NUMERIC_LOG_KEYS.flatMap(key => [
      `set(log.attributes[${JSON.stringify(key)}], Double(log.attributes[${JSON.stringify(key)}])) where IsString(log.attributes[${JSON.stringify(key)}]) and IsMatch(log.attributes[${JSON.stringify(key)}], "^[0-9]{1,14}([.][0-9]{1,9})?$")`,
      `delete_key(log.attributes, ${JSON.stringify(key)}) where not IsInt(log.attributes[${JSON.stringify(key)}]) and not IsDouble(log.attributes[${JSON.stringify(key)}])`
    ]),
    ...BOOLEAN_LOG_KEYS.flatMap(key => [
      `set(log.attributes[${JSON.stringify(key)}], true) where log.attributes[${JSON.stringify(key)}] == "true"`,
      `set(log.attributes[${JSON.stringify(key)}], false) where log.attributes[${JSON.stringify(key)}] == "false"`,
      `delete_key(log.attributes, ${JSON.stringify(key)}) where not IsBool(log.attributes[${JSON.stringify(key)}])`
    ])
  ];
  const metricStatements = [
    ...scope, 'keep_keys(resource.attributes, [])', 'set(metric.description, "")', 'set(metric.unit, "")',
    'keep_keys(datapoint.attributes, ["model", "type"])',
    ...boundedStrings('datapoint.attributes', { model: '^claude-(opus|sonnet|haiku)[-0-9.]{0,30}$', type: '^(input|output|cacheRead|cacheCreation|cache_read|cache_creation)$' }),
    ...['opus', 'sonnet', 'haiku'].map(model => `set(datapoint.attributes["model"], "claude-${model}") where IsString(datapoint.attributes["model"]) and IsMatch(datapoint.attributes["model"], "^claude-${model}")`)
  ];
  return {
    receivers: { otlp: { protocols: { http: { endpoint: `127.0.0.1:${ports.otlp}`, include_metadata: false, max_request_body_size: 1048576, read_timeout: '1s', write_timeout: '1s' } } } },
    extensions: {
      health_check: { endpoint: `127.0.0.1:${ports.collectorHealth}` },
      file_storage: { directory: path.join(stateDir, 'queue'), max_size: 134217728, create_directory: false, fsync: true, timeout: '1s', compaction: { on_start: false, on_rebound: false } }
    },
    processors: {
      'transform/privacy': { error_mode: 'propagate', log_statements: [{ context: 'log', statements: logStatements }], metric_statements: [{ context: 'datapoint', statements: metricStatements }, { context: 'exemplar', statements: ['keep_keys(exemplar.filtered_attributes, [])', 'set(exemplar.trace_id, TraceID(0x00000000000000000000000000000000))', 'set(exemplar.span_id, SpanID(0x0000000000000000))'] }] },
      'filter/known_metrics': { error_mode: 'propagate', metrics: { metric: [METRICS.map(name => `name != ${JSON.stringify(name)}`).join(' and '), 'type != METRIC_DATA_TYPE_SUM and type != METRIC_DATA_TYPE_GAUGE'] } },
      memory_limiter: { check_interval: '1s', limit_mib: 224, spike_limit_mib: 32 },
      batch: { timeout: '1s', send_batch_size: 64, send_batch_max_size: 128 }
    },
    exporters: {
      otlp_http: { endpoint: `http://127.0.0.1:${ports.normalizer}`, encoding: 'json', compression: 'none', timeout: '1s', sending_queue: { enabled: true, storage: 'file_storage', sizer: 'bytes', queue_size: 67108864, num_consumers: 1, block_on_overflow: false }, retry_on_failure: { enabled: true, initial_interval: '1s', max_interval: '30s', max_elapsed_time: '24h' } },
      'file/spool': { path: path.join(stateDir, 'spool', 'content-free.jsonl'), format: 'json', rotation: { max_megabytes: 16, max_days: 7, max_backups: 31 } },
      prometheus: { endpoint: `127.0.0.1:${ports.metrics}`, without_scope_info: true, resource_to_telemetry_conversion: { enabled: false }, resource_constant_labels: { excluded: ['*'] }, enable_open_metrics: false, send_timestamps: false, metric_expiration: '5m' }
    },
    service: {
      extensions: ['health_check', 'file_storage'],
      telemetry: { resource: { 'service.instance.id': null, 'service.name': 'sgsd-atlas-collector', 'service.version': RELEASES.collector.version }, logs: { level: 'error', output_paths: ['/dev/null'], error_output_paths: ['/dev/null'], disable_stacktrace: true }, metrics: { level: 'normal', readers: [{ pull: { exporter: { prometheus: { host: '127.0.0.1', port: ports.collectorInternal } } } }] } },
      pipelines: {
        logs: { receivers: ['otlp'], processors: ['transform/privacy', 'memory_limiter', 'batch'], exporters: ['otlp_http', 'file/spool'] },
        metrics: { receivers: ['otlp'], processors: ['transform/privacy', 'filter/known_metrics', 'memory_limiter', 'batch'], exporters: ['otlp_http', 'prometheus', 'file/spool'] }
      }
    }
  };
}
function prometheusConfig(input) {
  const { ports } = options(input);
  return { global: { scrape_interval: '15s', scrape_timeout: '2s', evaluation_interval: '1m' }, scrape_configs: [
    { job_name: 'sgsd-atlas-collector', static_configs: [{ targets: [`127.0.0.1:${ports.metrics}`] }], sample_limit: 1000, label_limit: 8, label_name_length_limit: 64, label_value_length_limit: 80, body_size_limit: '1MB', metric_relabel_configs: [ { source_labels: ['__name__'], regex: 'claude_code_(token_usage|cost_usage|session_count|active_time_total).*|target_info', action: 'keep' }, { regex: '__name__|job|instance|model|type', action: 'labelkeep' } ] },
    { job_name: 'sgsd-atlas-normalizer', static_configs: [{ targets: [`127.0.0.1:${ports.normalizerMetrics}`] }], sample_limit: 1000, label_limit: 10, label_name_length_limit: 64, label_value_length_limit: 80, body_size_limit: '1MB', metric_relabel_configs: [ { source_labels: ['__name__'], regex: 'sgsd_atlas_.*', action: 'keep' }, { regex: '__name__|job|instance|provider|model|model_family|type|token_type|source|outcome|reason|status|cost_center', action: 'labelkeep' } ] }
  ] };
}
async function verifyArchive(file, expected) {
  const hash = crypto.createHash('sha256');
  for await (const bytes of fs.createReadStream(file)) hash.update(bytes);
  const digest = hash.digest('hex'); if (digest !== expected) throw new Error('archive_checksum_mismatch'); return digest;
}
function hashFile(file) {
  const hash = crypto.createHash('sha256'); const fd = fs.openSync(file, 'r'); const buffer = Buffer.alloc(1024 * 1024);
  try { let size; while ((size = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, size)); } finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function loadInstallation(input) {
  const { stateDir } = options(input); const file = path.join(stateDir, 'installation.json'); if (!fs.existsSync(file)) return null;
  let manifest; try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('installation_invalid'); }
  if (manifest.schema_version !== 1 || manifest.platform !== 'linux-x64' || !manifest.binaries || !manifest.releases) throw new Error('installation_invalid');
  for (const [name, release] of Object.entries(RELEASES)) if (manifest.releases[name]?.sha256 !== release.sha256 || manifest.releases[name]?.version !== release.version) throw new Error('installation_invalid');
  for (const name of ['otelcol-contrib', 'prometheus', 'promtool']) {
    const target = path.join(stateDir, 'bin', name); const entry = manifest.binaries[name];
    if (!entry || entry.path !== target || !/^[a-f0-9]{64}$/.test(entry.sha256) || !fs.existsSync(target) || fs.lstatSync(target).isSymbolicLink() || !fs.lstatSync(target).isFile()) throw new Error('installation_invalid');
    if (hashFile(target) !== entry.sha256) throw new Error('installation_binary_mismatch');
  }
  return manifest;
}
function writeConfigs(input) {
  const opts = options(input); for (const name of ['', 'config', 'spool', 'queue', 'prometheus', 'logs']) privateDir(path.join(opts.stateDir, name));
  privateWrite(path.join(opts.stateDir, 'config', 'collector.json'), `${JSON.stringify(collectorConfig(opts), null, 2)}\n`);
  privateWrite(path.join(opts.stateDir, 'config', 'prometheus.json'), `${JSON.stringify(prometheusConfig(opts), null, 2)}\n`);
}
function processSpecs(input) {
  const opts = options(input); if (!loadInstallation(opts)) throw new Error('stack_not_installed'); writeConfigs(opts);
  const { stateDir, ports } = opts;
  return [
    { name: 'collector', executable: path.join(stateDir, 'bin', 'otelcol-contrib'), args: ['--config', path.join(stateDir, 'config', 'collector.json')], env: { GOMEMLIMIT: '192MiB' }, healthUrl: `http://127.0.0.1:${ports.collectorHealth}/`, internalMetricsUrl: `http://127.0.0.1:${ports.collectorInternal}/metrics`, resourceLimits: { rssBytes: 268435456, mode: 'soft-heap-plus-lifecycle-rss-monitor', queueMaxBytes: 268435456, queueMaxAgeMs: 86400000, spoolMaxBytes: 536870912, spoolMaxAgeMs: 604800000 } },
    { name: 'prometheus', executable: path.join(stateDir, 'bin', 'prometheus'), args: [`--config.file=${path.join(stateDir, 'config', 'prometheus.json')}`, `--storage.tsdb.path=${path.join(stateDir, 'prometheus')}`, '--storage.tsdb.retention.time=35d', '--storage.tsdb.retention.size=2GB', '--storage.tsdb.wal-compression', `--web.listen-address=127.0.0.1:${ports.prometheus}`, '--web.max-connections=16', '--query.max-concurrency=2', '--query.max-samples=100000', '--query.timeout=5s', '--log.level=error'], env: { GOMEMLIMIT: '384MiB' }, healthUrl: `http://127.0.0.1:${ports.prometheus}/-/ready`, resourceLimits: { rssBytes: 536870912, mode: 'soft-heap-plus-lifecycle-rss-monitor', tsdbRetentionBytes: 2147483648, headroomBytes: 536870912 } }
  ];
}
async function download(url, file) {
  let current = new URL(url);
  for (let redirect = 0; redirect < 5; redirect++) {
    if (current.protocol !== 'https:' || !['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'].includes(current.hostname)) throw new Error('untrusted_download_destination');
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(180000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) { await response.body?.cancel(); current = new URL(response.headers.get('location'), current); continue; }
    if (!response.ok || !response.body) throw new Error('release_download_failed');
    let size = 0; const bound = new Transform({ transform(chunk, encoding, callback) { size += chunk.length; callback(size > 268435456 ? new Error('release_archive_too_large') : null, chunk); } });
    await pipeline(Readable.fromWeb(response.body), bound, fs.createWriteStream(file, { flags: 'wx', mode: 0o600 })); return;
  }
  throw new Error('release_redirect_limit');
}
async function install(input) {
  const opts = options(input); if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('unsupported_platform_requires_linux_x64');
  const existing = loadInstallation(opts); if (existing) return existing;
  if (fs.existsSync(path.join(opts.stateDir, 'bin'))) throw new Error('installation_target_exists_or_unsafe');
  if (opts.archiveDir && !path.isAbsolute(opts.archiveDir)) throw new Error('invalid_archive_directory');
  privateDir(opts.stateDir); const stage = fs.mkdtempSync(path.join(opts.stateDir, '.install-')); fs.chmodSync(stage, 0o700);
  const manifest = { schema_version: 1, platform: 'linux-x64', installed_at: new Date().toISOString(), releases: {}, binaries: {} };
  try {
    privateDir(path.join(stage, 'bin'));
    for (const [name, release] of Object.entries(RELEASES)) {
      const archive = opts.archiveDir ? path.join(opts.archiveDir, path.basename(new URL(release.url).pathname)) : path.join(stage, `${name}.tar.gz`);
      if (!opts.archiveDir) await download(release.url, archive);
      await verifyArchive(archive, release.sha256);
      const extraction = spawnSync('tar', ['--extract', '--gzip', '--file', archive, '--directory', stage, '--no-same-owner', '--no-same-permissions', ...release.members], { encoding: 'utf8', timeout: 60000, maxBuffer: 1048576 });
      if (extraction.status !== 0) throw new Error('release_extraction_failed');
      for (const member of release.members) {
        const executable = path.basename(member); const source = path.join(stage, member); const target = path.join(opts.stateDir, 'bin', executable);
        if (!fs.lstatSync(source).isFile() || fs.lstatSync(source).isSymbolicLink() || fs.existsSync(target)) throw new Error('installation_target_exists_or_unsafe');
        const stagedTarget = path.join(stage, 'bin', executable);
        fs.copyFileSync(source, stagedTarget, fs.constants.COPYFILE_EXCL); fs.chmodSync(stagedTarget, 0o700);
        manifest.binaries[executable] = { path: target, sha256: hashFile(stagedTarget) };
      }
      manifest.releases[name] = { version: release.version, sha256: release.sha256, url: release.url };
    }
    writeConfigs(opts);
    for (const [name, args] of [['otelcol-contrib', ['validate', '--config', path.join(opts.stateDir, 'config', 'collector.json')]], ['promtool', ['check', 'config', path.join(opts.stateDir, 'config', 'prometheus.json')]]]) {
      const validation = spawnSync(path.join(stage, 'bin', name), args, { encoding: 'utf8', timeout: 30000, maxBuffer: 1048576 });
      if (validation.status !== 0) throw new Error(`${name === 'promtool' ? 'prometheus' : 'collector'}_configuration_invalid`);
    }
    fs.renameSync(path.join(stage, 'bin'), path.join(opts.stateDir, 'bin'));
    privateWrite(path.join(opts.stateDir, 'installation.json'), `${JSON.stringify(manifest, null, 2)}\n`); return manifest;
  } finally { fs.rmSync(stage, { recursive: true, force: true }); }
}
module.exports = { RELEASES, DEFAULT_PORTS, collectorConfig, prometheusConfig, verifyArchive, loadInstallation, processSpecs, install };

if (require.main === module) {
  const args = process.argv.slice(2); const command = args.shift(); const value = flag => { const i = args.indexOf(flag); return i < 0 ? undefined : args[i + 1]; };
  const input = { stateDir: value('--state-dir'), projectDir: value('--project-dir'), archiveDir: value('--archive-dir') };
  Promise.resolve().then(() => { if (command === 'install') return install(input); if (command === 'status') return { installed: Boolean(loadInstallation(input)) }; throw new Error('usage_stack_install_or_status_requires_state_dir'); }).then(result => process.stdout.write(`${JSON.stringify(result)}\n`), error => { process.stderr.write(`${JSON.stringify({ error: /^[a-z0-9_]+$/.test(error.message) ? error.message : 'stack_operation_failed' })}\n`); process.exitCode = 1; });
}
