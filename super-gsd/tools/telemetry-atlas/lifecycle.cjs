#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const http = require('http');
const { digest, appendGap } = require('./contract.cjs');
const DEFAULT_PORTS = { otlp: 4318, normalizer: 4319, collectorHealth: 13133,
  normalizerHealth: 13134, metrics: 9464, normalizerMetrics: 9465, collectorInternal: 9466, prometheus: 9090 };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const shellQuote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`;

function parse(argv) {
  const command = argv[2] || 'status';
  const value = (flag, fallback) => {
    const index = argv.indexOf(flag);
    return index >= 0 ? argv[index + 1] : fallback;
  };
  const projectDir = path.resolve(value('--project-dir', process.cwd()));
  const ports = Object.fromEntries(Object.entries(DEFAULT_PORTS).map(([key, fallback]) => [key,
    Number(value(`--${key.replace(/[A-Z]/g, match => '-' + match.toLowerCase())}-port`, fallback))]));
  for (const port of Object.values(ports)) if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_port');
  return {
    command,
    json: argv.includes('--json'),
    stateDir: path.resolve(value('--state-dir', path.join(os.homedir(), '.local', 'state', 'sgsd', 'telemetry', digest(projectDir).slice(0, 16)))),
    projectDir, ports, runId: value('--run-id', ''), shell: argv.includes('--shell'),
  };
}

function paths(stateDir) {
  return { enabled: path.join(stateDir, 'enabled.json'), pid: path.join(stateDir, 'sidecar.json'),
    pending: path.join(stateDir, 'starting.json'), lock: path.join(stateDir, 'lifecycle.lock') };
}

function telemetryEnvironment({ healthy, runId, stateDir, projectId = digest(process.cwd()), endpoint = 'http://127.0.0.1:4318' }) {
  if (!healthy) return Object.freeze({});
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(String(runId || ''))) throw new Error('invalid_run_id');
  if (!/^[a-f0-9]{64}$/.test(projectId)) throw new Error('invalid_project_id');
  const url = new URL(endpoint);
  if (url.hostname !== '127.0.0.1' || url.protocol !== 'http:' || url.username || url.password || url.pathname !== '/') throw new Error('invalid_telemetry_endpoint');
  const base = url.origin;
  return Object.freeze({
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    OTEL_METRICS_EXPORTER: 'otlp',
    OTEL_LOGS_EXPORTER: 'otlp',
    OTEL_TRACES_EXPORTER: 'none',
    OTEL_EXPORTER_OTLP_PROTOCOL: 'http/json',
    OTEL_EXPORTER_OTLP_ENDPOINT: base,
    OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${base}/v1/logs`,
    OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: `${base}/v1/metrics`,
    OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: 'http/json',
    OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: 'http/json',
    OTEL_METRICS_INCLUDE_SESSION_ID: 'false',
    OTEL_METRICS_INCLUDE_ACCOUNT_UUID: 'false',
    OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES: 'false',
    OTEL_LOG_USER_PROMPTS: '0',
    OTEL_LOG_ASSISTANT_RESPONSES: '0',
    OTEL_LOG_TOOL_DETAILS: '0',
    OTEL_LOG_TOOL_CONTENT: '0',
    OTEL_EXPORTER_OTLP_TIMEOUT: '300', OTEL_EXPORTER_OTLP_LOGS_TIMEOUT: '300', OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: '300',
    OTEL_METRIC_EXPORT_TIMEOUT: '300', OTEL_BLRP_EXPORT_TIMEOUT: '300', OTEL_BLRP_MAX_QUEUE_SIZE: '128',
    OTEL_BLRP_MAX_EXPORT_BATCH_SIZE: '32', OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE: 'delta',
    SGSD_ATLAS_ENDPOINT: base,
    SGSD_ATLAS_STATE_DIR: path.resolve(stateDir || '.'),
    SGSD_RUN_ID: String(runId),
    OTEL_RESOURCE_ATTRIBUTES: `sgsd.run_id=${runId},sgsd.cost_center=orchestrator,sgsd.launcher_repo_id=${projectId}`,
  });
}

function environmentCommand(options) {
  if (!options.healthy) return '';
  const remove = [...new Set([
    'OTEL_LOG_RAW_API_BODIES', 'BETA_TRACING_ENDPOINT', 'CLAUDE_CODE_ENHANCED_TELEMETRY_BETA', 'ENABLE_ENHANCED_TELEMETRY_BETA',
    'OTEL_EXPORTER_OTLP_HEADERS', 'OTEL_EXPORTER_OTLP_COMPRESSION', 'OTEL_EXPORTER_OTLP_CERTIFICATE',
    'OTEL_EXPORTER_OTLP_CLIENT_KEY', 'OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE',
    ...['LOGS','METRICS','TRACES'].flatMap(signal => ['ENDPOINT','PROTOCOL','HEADERS','COMPRESSION','CERTIFICATE','CLIENT_KEY','CLIENT_CERTIFICATE']
      .map(suffix => `OTEL_EXPORTER_OTLP_${signal}_${suffix}`)),
    ...Object.keys(process.env).filter(key => /^OTEL_[A-Z0-9_]+$/.test(key)),
  ])];
  return ['env', ...remove.flatMap(key => ['-u', key]), ...Object.entries(telemetryEnvironment(options)).map(([key,value]) => `${key}=${shellQuote(value)}`)].join(' ');
}

function atomicJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temporary, filePath);
  try { fs.chmodSync(filePath, 0o600); } catch (_error) { /* Windows */ }
}

function readJson(filePath) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_error) { return null; }
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (_error) { return false; }
}

function processIdentity(pid) {
  if (process.platform !== 'linux' || !Number.isInteger(pid) || pid < 1) return null;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    if (fields[0] === 'Z') return null;
    const argv = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean);
    return { pid, start_time: fields[19], argv, executable: fs.readlinkSync(`/proc/${pid}/exe`) };
  } catch (_) { return null; }
}
function commandLine(pid) { return processIdentity(pid)?.argv.join(' ') || ''; }

function owned(record) {
  const actual = processIdentity(record?.pid);
  return Boolean(actual && record.start_time === actual.start_time && record.executable === actual.executable
    && Array.isArray(record.argv) && JSON.stringify(record.argv) === JSON.stringify(actual.argv));
}

function ownsPort(pid, port) {
  try {
    const inodes = new Set(fs.readdirSync(`/proc/${pid}/fd`).flatMap(fd => {
      try { const match = fs.readlinkSync(`/proc/${pid}/fd/${fd}`).match(/^socket:\[(\d+)\]$/); return match ? [match[1]] : []; }
      catch (_) { return []; }
    }));
    return ['tcp', 'tcp6'].some(kind => fs.readFileSync(`/proc/${pid}/net/${kind}`, 'utf8').split('\n').slice(1).some(line => {
      const fields = line.trim().split(/\s+/);
      return fields[3] === '0A' && parseInt(fields[1]?.split(':').pop(), 16) === port && inodes.has(fields[9]);
    }));
  } catch (_) { return false; }
}
function healthRequest(url, json = false, timeout = 120) {
  try { const parsed = new URL(url); if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') return Promise.resolve(false); }
  catch (_) { return Promise.resolve(false); }
  return new Promise(resolve => {
    let finished = false;
    let timer;
    const done = value => { if (!finished) { finished = true; clearTimeout(timer); resolve(value); } };
    const request = http.get(url, { agent: false }, response => {
      if (!json) { response.resume(); done(response.statusCode === 200); return; }
      let body = '';
      response.on('data', chunk => { body += chunk; if (body.length > 4096) { request.destroy(); done(null); } });
      response.on('end', () => { try { done(response.statusCode === 200 ? JSON.parse(body) : null); } catch (_) { done(null); } });
      response.on('error', () => done(null));
    });
    timer = setTimeout(() => { request.destroy(); done(null); }, timeout);
    request.on('error', () => done(null));
  });
}
async function readiness(record, projectDir) {
  if (!record || record.project_dir !== projectDir || record.project_id !== digest(projectDir)
    || record.status !== 'ready' || !Array.isArray(record.processes)) return false;
  if (!record.processes.every(item => owned(item) && (item.ports || []).every(port => ownsPort(item.pid, port)))) return false;
  if (!record.processes.some(item => item.name === 'normalizer')) return false;
  const checks = await Promise.all(record.processes.filter(item => item.health_url).map(async item => {
    if (item.name !== 'normalizer') return healthRequest(item.health_url);
    const result = await healthRequest(item.health_url, true);
    return result?.status === 'healthy' && result.pid === item.pid
      && result.instance_id === record.instance_id && result.project_id === record.project_id;
  }));
  return checks.every(Boolean);
}
function gap(options, reason) {
  try { appendGap(path.join(options.projectDir, '.planning', 'metrics', 'sgsd-atlas-gaps.jsonl'), reason); } catch (_) { /* independent evidence is best effort */ }
}
function lifecycleEvent(options, reason) {
  try {
    if (options.runId && !/^[A-Za-z0-9_-]{1,128}$/.test(options.runId)) return false;
    const now = new Date().toISOString();
    const written = require('./quota-sampler.cjs').queueEvent({ schema_version: 1,
      source_event_id: `lifecycle:${crypto.randomUUID()}`, occurred_at: now, event_type: 'coverage',
      source: { kind: 'atlas_lifecycle', instance: 'local', version: '1', provenance: 'client_observed',
        confidence: 'exact', completeness_reason: reason }, identity: { sgsd_run_id: options.runId || null },
      scope: { role: 'observer', cost_center: 'telemetry', attribution_method: 'exact' },
      execution: { success: true, error_code: null },
    }, options.stateDir);
    if (!written) gap(options, 'lifecycle_spool_capacity');
    return written;
  } catch (_) { gap(options, 'lifecycle_spool_unavailable'); return false; }
}
function resourceIssue(record, stateDir) {
  try {
    const disk = fs.statfsSync(stateDir);
    if (disk.blocks && disk.bavail / disk.blocks < 0.10) return 'telemetry_disk_pressure';
    for (const item of record.processes || []) {
      if (!owned(item) || !item.rss_limit_mib) continue;
      const status = fs.readFileSync(`/proc/${item.pid}/status`, 'utf8');
      const rss = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024;
      if (rss > item.rss_limit_mib * 1024 * 1024) return 'telemetry_memory_limit';
    }
    for (const [name, maximum] of [['queue', 256 * 1024 * 1024], ['spool', 512 * 1024 * 1024]]) {
      const directory = path.join(stateDir, name);
      if (!fs.existsSync(directory)) continue;
      require('./quota-sampler.cjs').privateDirectory(directory);
      const files = fs.readdirSync(directory);
      if (files.length > 128) return 'telemetry_storage_limit';
      let bytes = 0;
      for (const filename of files) {
        const stat = fs.lstatSync(path.join(directory, filename));
        if (stat.isSymbolicLink() || !stat.isFile()) return 'telemetry_storage_unverified';
        bytes += stat.size;
      }
      if (bytes > maximum) return 'telemetry_storage_limit';
    }
    const prometheus = path.join(stateDir, 'prometheus');
    if (fs.existsSync(prometheus)) {
      require('./quota-sampler.cjs').privateDirectory(prometheus);
      const pending = [prometheus]; let bytes = 0; let entries = 0;
      while (pending.length) {
        const directory = pending.pop();
        for (const name of fs.readdirSync(directory)) {
          if (++entries > 4096) return 'prometheus_storage_unverified';
          const filename = path.join(directory, name); const stat = fs.lstatSync(filename);
          if (stat.isSymbolicLink()) return 'prometheus_storage_unverified';
          if (stat.isDirectory()) pending.push(filename);
          else if (stat.isFile()) bytes += stat.size;
          else return 'prometheus_storage_unverified';
          if (bytes > 2684354560) return 'prometheus_storage_limit';
        }
      }
    }
    return null;
  } catch (_) { return 'telemetry_resource_check_failed'; }
}
function scrape(url) {
  return new Promise(resolve => {
    let body = ''; let timer;
    const request = http.get(url, { agent: false }, response => {
      response.on('data', chunk => { body += chunk; if (body.length > 262144) request.destroy(); });
      response.on('end', () => { clearTimeout(timer); resolve(response.statusCode === 200 ? body : null); });
      response.on('error', () => { clearTimeout(timer); resolve(null); });
    });
    timer = setTimeout(() => { request.destroy(); resolve(null); }, 200);
    request.on('error', () => { clearTimeout(timer); resolve(null); });
  });
}
async function watch(options) {
  let lastHeartbeat = 0;
  for (;;) {
    await delay(5000);
    const record = readJson(paths(options.stateDir).pid);
    if (!record || record.project_id !== digest(options.projectDir)) return;
    const issue = resourceIssue(record, options.stateDir);
    const collector = record.processes.find(item => item.name === 'collector');
    if (issue) {
      gap(options, issue);
      const affected = issue === 'telemetry_disk_pressure' ? record.processes.filter(item => item.pid !== process.pid)
        : issue.startsWith('prometheus_') ? record.processes.filter(item => item.name === 'prometheus')
        : issue === 'telemetry_memory_limit' ? record.processes.filter(item => resourceIssue({ processes: [item] }, options.stateDir) === issue)
          : [collector].filter(Boolean);
      await stopRecords({ processes: affected });
    }
    if (collector && owned(collector)) {
      const metricText = await scrape(`http://127.0.0.1:${record.ports.collectorInternal}/metrics`);
      if (metricText !== null) {
        const queueLines = metricText.split('\n').filter(line => /^otelcol_exporter_queue_size(?:\{|\s)/.test(line));
        if (!queueLines.length) gap(options, 'collector_queue_metric_unavailable');
        const queued = queueLines.reduce((total, line) => total + Number(line.trim().split(/\s+/).pop()), 0);
        const observationPath = path.join(options.stateDir, 'queue-observation.json');
        const previous = readJson(observationPath);
        const now = Date.now();
        const pendingSince = previous?.pending_since || previous?.empty_at || (record.queue_fresh ? Date.parse(record.started_at) : null);
        if (queueLines.length && queued > 0 && (!pendingSince || now - pendingSince >= 86400000)) {
          gap(options, pendingSince ? 'collector_queue_age_limit' : 'collector_queue_age_unverified');
          await stopRecords({ processes: [collector] });
        } else if (queueLines.length) atomicJson(observationPath, queued > 0 ? { pending_since: pendingSince } : { empty_at: now });
      } else gap(options, 'collector_queue_observer_unavailable');
    } else gap(options, 'collector_unavailable');
    // Only explicitly disposable, regular raw spool files are subject to retention.
    const spool = path.join(options.stateDir, 'spool');
    if (fs.existsSync(spool)) {
      require('./quota-sampler.cjs').privateDirectory(spool);
      for (const filename of fs.readdirSync(spool).slice(0, 128)) {
        if (!/^content-free(?:[-.][A-Za-z0-9_.-]+)?\.jsonl$/.test(filename)) continue;
        const target = path.join(spool, filename); const stat = fs.lstatSync(target);
        if (stat.isFile() && !stat.isSymbolicLink() && Date.now() - stat.mtimeMs > 604800000) {
          if (filename === 'content-free.jsonl' && collector && owned(collector)) {
            gap(options, 'collector_spool_retention_restart_required');
            await stopRecords({ processes: [collector] });
          }
          fs.unlinkSync(target);
        }
      }
    }
    if (Date.now() - lastHeartbeat >= 60000) { lifecycleEvent(options, 'collector_heartbeat'); lastHeartbeat = Date.now(); }
  }
}
function acquireLock(stateDir) {
  require('./quota-sampler.cjs').privateDirectory(stateDir);
  const filename = paths(stateDir).lock;
  try {
    const fd = fs.openSync(filename, 'wx', 0o600);
    fs.writeFileSync(fd, JSON.stringify(processIdentity(process.pid)) + '\n'); fs.closeSync(fd);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const previous = readJson(filename);
    if (!previous || owned(previous) || alive(previous.pid)) throw new Error('lifecycle_busy');
    fs.unlinkSync(filename);
    return acquireLock(stateDir);
  }
  return () => { if (owned(readJson(filename))) fs.unlinkSync(filename); };
}
async function spawnOwned(spec) {
  const previousUmask = process.umask(0o077);
  let child;
  try { child = spawn(spec.executable, spec.args, { detached: true, stdio: 'ignore', windowsHide: true,
    env: { ...process.env, ...(spec.env || {}) } }); } finally { process.umask(previousUmask); }
  let failure;
  child.on('error', error => { failure = error; }); child.unref();
  for (let attempt = 0; attempt < 40; attempt++) {
    if (failure) throw failure;
    const identity = processIdentity(child.pid);
    if (identity && identity.argv.length > 1 && identity.argv.includes(spec.args[0])) {
      return { ...identity, name: spec.name, health_url: spec.healthUrl || null, ports: spec.ports || [], rss_limit_mib: spec.rssLimitMiB || null };
    }
    await delay(10);
  }
  throw new Error('child_identity_unavailable');
}
async function stopRecords(record) {
  if (!record) return;
  for (const item of record.processes || []) {
    if (alive(item.pid) && processIdentity(item.pid) && !owned(item)) throw new Error('pid_identity_mismatch');
  }
  for (const item of record.processes || []) if (owned(item)) process.kill(item.pid, 'SIGTERM');
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline && (record.processes || []).some(owned)) await delay(40);
  if ((record.processes || []).some(owned)) throw new Error('sidecar_stop_timeout');
}
async function execute(raw) {
  const options = { ...raw, projectDir: path.resolve(raw.projectDir || process.cwd()), ports: { ...DEFAULT_PORTS, ...(raw.ports || {}) } };
  const files = paths(options.stateDir);
  let enabled = readJson(files.enabled);
  let record = readJson(files.pid);
  const matches = value => value?.project_dir === options.projectDir && value?.project_id === digest(options.projectDir);
  if (options.command === 'session-exit') return { recorded: lifecycleEvent(options, 'launcher_session_exit') };
  if (options.command === 'watch') { await watch(options); return { running: false }; }
  if (options.command === 'attach' || options.command === 'status') {
    const healthy = Boolean(matches(enabled) && await readiness(record, options.projectDir));
    const result = { enabled: matches(enabled), running: matches(record) && Boolean(record?.processes?.some(owned)), healthy,
      reason: healthy ? null : !matches(enabled) ? 'disabled' : 'sidecar_unavailable', urls: healthy ? record.urls : null };
    if (options.command === 'attach') {
      if (!healthy && matches(enabled)) gap(options, 'launch_sidecar_unavailable');
      result.environment = environmentCommand({ healthy, runId: options.runId, stateDir: options.stateDir,
        projectId: digest(options.projectDir), endpoint: record?.urls?.ingest });
      if (healthy) lifecycleEvent(options, 'launcher_session_start');
    }
    return result;
  }
  if (process.platform !== 'linux') throw new Error('linux_runtime_required');
  const release = acquireLock(options.stateDir);
  try {
    enabled = readJson(files.enabled);
    record = readJson(files.pid);
    if (options.command === 'enable') {
      if ((enabled && !matches(enabled)) || (record && !matches(record))) throw new Error('project_identity_mismatch');
      if (!require('./stack.cjs').loadInstallation(options)) throw new Error('stack_not_installed');
      atomicJson(files.enabled, { schema_version: 1, project_dir: options.projectDir, project_id: digest(options.projectDir), enabled_at: new Date().toISOString() });
      return { enabled: true, running: false };
    }
    if (options.command === 'stop' || options.command === 'disable') {
      for (const candidate of [record, readJson(files.pending)]) {
        if (candidate && !matches(candidate)) throw new Error('project_identity_mismatch');
        await stopRecords(candidate);
      }
      for (const file of [files.pid, files.pending, ...(options.command === 'disable' ? [files.enabled] : [])]) {
        try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      return { enabled: options.command !== 'disable' && matches(enabled), running: false };
    }
    if (options.command !== 'start') throw new Error('unknown_command');
    if (!matches(enabled)) return { enabled: false, running: false, reason: 'disabled' };
    if (record) {
      if (!matches(record)) throw new Error('project_identity_mismatch');
      if (await readiness(record, options.projectDir)) return { enabled: true, running: true, healthy: true, urls: record.urls };
      if (record.processes?.some(item => processIdentity(item.pid))) throw new Error('existing_sidecar_unhealthy');
    }
    const pending = readJson(files.pending);
    if (pending?.processes?.some(item => processIdentity(item.pid))) throw new Error('incomplete_start_requires_stop');
    const stack = require('./stack.cjs');
    stack.loadInstallation(options);
    const instanceId = crypto.randomUUID();
    const projectId = digest(options.projectDir);
    const ports = options.ports;
    const specifications = [{ name: 'normalizer', executable: process.execPath,
      args: [path.join(__dirname, 'server.cjs'), '--project-dir', options.projectDir, '--state-dir', options.stateDir,
        '--instance-id', instanceId, '--project-id', projectId, '--ingest-port', String(ports.normalizer),
        '--health-port', String(ports.normalizerHealth), '--metrics-port', String(ports.normalizerMetrics)],
      healthUrl: `http://127.0.0.1:${ports.normalizerHealth}/health`, ports: [ports.normalizer, ports.normalizerHealth, ports.normalizerMetrics], rssLimitMiB: 256 },
      ...stack.processSpecs({ ...options, instanceId, projectId }).map(spec => ({ ...spec,
        ports: spec.name === 'collector' ? [ports.otlp, ports.collectorHealth, ports.metrics, ports.collectorInternal] : [ports.prometheus],
        rssLimitMiB: spec.name === 'collector' ? 256 : 512 }))];
    const next = { schema_version: 1, project_dir: options.projectDir, project_id: projectId, instance_id: instanceId,
      status: 'starting', started_at: new Date().toISOString(), processes: [], ports,
      queue_fresh: fs.readdirSync(path.join(options.stateDir, 'queue')).length === 0, urls: {
        ingest: `http://127.0.0.1:${ports.otlp}`, health: `http://127.0.0.1:${ports.normalizerHealth}/health`,
        metrics: `http://127.0.0.1:${ports.metrics}/metrics`, prometheus: `http://127.0.0.1:${ports.prometheus}` } };
    try {
      for (const spec of specifications) { next.processes.push(await spawnOwned(spec)); atomicJson(files.pending, next); }
      next.status = 'ready';
      const deadline = Date.now() + 10000;
      while (!await readiness(next, options.projectDir)) {
        if (Date.now() >= deadline || next.processes.some(item => !owned(item))) throw new Error('sidecar_health_timeout');
        await delay(40);
      }
      next.processes.push(await spawnOwned({ name: 'monitor', executable: process.execPath,
        args: [__filename, 'watch', '--project-dir', options.projectDir, '--state-dir', options.stateDir] }));
      atomicJson(files.pid, next); fs.unlinkSync(files.pending);
      return { enabled: true, running: true, healthy: true, urls: next.urls, instance_id: instanceId };
    } catch (error) {
      gap(options, 'sidecar_start_failed');
      await stopRecords(next);
      try { fs.unlinkSync(files.pending); } catch (_) { /* no pending record was published */ }
      throw error;
    }
  } finally { release(); }
}

if (require.main === module) {
  process.umask(0o077);
  const options = parse(process.argv);
  execute(options).then((result) => {
    process.stdout.write(options.shell ? `${result.environment || ''}\n` : JSON.stringify(result) + '\n');
  }).catch((error) => {
    if (options.command === 'attach') { gap(options, 'launch_attachment_failed'); process.stdout.write(options.shell ? '\n' : '{"healthy":false}\n'); }
    else { if (options.command === 'watch') gap(options, 'lifecycle_monitor_failed');
      process.stderr.write(`telemetry_atlas_${options.command}_failed:${error.message}\n`); process.exitCode = 1; }
  });
}

module.exports = Object.freeze({ alive, commandLine, execute, owned, parse, processIdentity,
  readiness, ownsPort, acquireLock, resourceIssue, telemetryEnvironment, environmentCommand });
