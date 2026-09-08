#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { registerRun, readRun, readJson, writeJson, createGlobalStore } = require('./global-store.cjs');
const { digest, appendGap, safePath } = require('./contract.cjs');
const { privateDirectory, queueEvent } = require('./quota-sampler.cjs');
const { telemetryEnvironment } = require('./lifecycle.cjs');
const PROTOCOL = 1;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const quote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`;
const rootPath = () => path.resolve(process.env.SGSD_ATLAS_GLOBAL_ROOT || path.join(os.homedir(), '.local', 'state', 'sgsd', 'telemetry', 'global'));
const servicePath = root => path.join(root, 'service.json');
function alive(pid) { try { if (!Number.isSafeInteger(pid) || pid < 1) return false; process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } }
function gap(root, reason) { try { appendGap(path.join(root, 'sgsd-atlas-gaps.jsonl'), reason); } catch {} }

function getJson(url, timeout = 250) {
  return new Promise(resolve => {
    let timer; let finished = false;
    const done = result => { if (!finished) { finished = true; clearTimeout(timer); resolve(result); } };
    let parsed;
    try { parsed = new URL(url); if (parsed.hostname !== '127.0.0.1' || parsed.protocol !== 'http:' || parsed.username || parsed.password) return done(null); }
    catch { return done(null); }
    const request = http.get(parsed, { agent: false }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; if (body.length > 65536) { request.destroy(); done(null); } });
      response.on('end', () => { try { done(response.statusCode === 200 ? JSON.parse(body) : null); } catch { done(null); } });
      response.on('error', () => done(null));
    });
    timer = setTimeout(() => { request.destroy(); done(null); }, timeout);
    request.on('error', () => done(null));
  });
}
async function status(root = rootPath()) {
  try {
    const record = readJson(servicePath(root));
    if (record.schema_version !== PROTOCOL || !alive(record.pid) || record.root_id !== digest(root)) return null;
    const health = await getJson(record.urls.health + '/health');
    if (health?.pid !== record.pid || health.instance_id !== record.instance_id || health.project_id !== digest(root)) return null;
    return { ...record, health };
  } catch { return null; }
}
function ownsStartup(root, token) {
  try { const lock = readJson(path.join(root, 'startup.lock')); return lock.pid === process.pid && lock.token === token; }
  catch { return false; }
}
function releaseStartup(root, token) {
  try { if (ownsStartup(root, token)) fs.unlinkSync(path.join(root, 'startup.lock')); } catch {}
}
async function startGlobal({ root = rootPath(), spoolPollMs = 1000, startupToken } = {}) {
  root = path.resolve(root); privateDirectory(root);
  if (startupToken && !ownsStartup(root, startupToken)) throw new Error('startup_ownership_lost');
  const store = createGlobalStore(root);
  const instance = await require('./server.cjs').startServer({ projectDir: root, store,
    resolveRoute: store.resolveRoute, scopeEvent: store.scopeEvent, spoolSources: store.spoolSources,
    ingestPort: 0, healthPort: 0, metricsPort: 0, spoolPollMs });
  const record = { schema_version: PROTOCOL, mode: 'global', root_id: digest(root), pid: process.pid,
    instance_id: instance.instanceId, started_at: new Date().toISOString(), urls: instance.urls };
  try {
    if (startupToken && !ownsStartup(root, startupToken)) throw new Error('startup_ownership_lost');
    writeJson(servicePath(root), record);
    if (startupToken) releaseStartup(root, startupToken);
  } catch (error) { store.close(); await instance.close(); throw error; }
  let closed = false;
  const close = async () => {
    if (closed) return; closed = true;
    store.close(); await instance.close();
    try { if (readJson(servicePath(root)).instance_id === record.instance_id) fs.unlinkSync(servicePath(root)); } catch {}
  };
  return { ...instance, record, close };
}
async function ensureService(root, timeoutMs = 2000) {
  const existing = await status(root); if (existing) return existing;
  privateDirectory(root);
  const lock = path.join(root, 'startup.lock'); safePath(lock);
  const deadline = Date.now() + timeoutMs;
  let token;
  while (Date.now() < deadline) {
    try {
      token = crypto.randomUUID();
      fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, token }), { flag: 'wx', mode: 0o600 });
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      token = null;
      try { const previous = readJson(lock); if (!alive(previous.pid)) fs.unlinkSync(lock); } catch {}
      const running = await status(root); if (running) return running;
      await pause(40);
    }
  }
  if (!token) throw new Error('startup_busy');
  let childOwnsLock = false;
  try {
    const running = await status(root); if (running) return running;
    // A live process with unverifiable health is not authority to kill or replace it.
    try { const old = readJson(servicePath(root)); if (alive(old.pid)) throw new Error('service_unverified'); }
    catch (error) { if (error.message === 'service_unverified') throw error; }
    const child = spawn(process.execPath, ['--max-old-space-size=256', __filename, 'serve', '--root', root, '--startup-token', token],
      { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env } });
    let failed = false; child.on('error', () => { failed = true; }); child.unref();
    if (Number.isSafeInteger(child.pid) && child.pid > 0) {
      writeJson(lock, { pid: child.pid, token }); childOwnsLock = true;
    }
    while (Date.now() < deadline && !failed) { const ready = await status(root); if (ready) return ready; await pause(40); }
    throw new Error('service_start_timeout');
  } finally { if (!childOwnsLock) releaseStartup(root, token); }
}
function disabledEnvironment() {
  return { CLAUDE_CODE_ENABLE_TELEMETRY: '0', OTEL_LOGS_EXPORTER: 'none', OTEL_METRICS_EXPORTER: 'none', OTEL_TRACES_EXPORTER: 'none',
    SGSD_ATLAS_ENDPOINT: '', SGSD_ATLAS_STATE_DIR: '', SGSD_ATLAS_RUN_ENDPOINT: '', SGSD_ATLAS_PROJECT_ID: '', SGSD_RUN_ID: '', SGSD_ATLAS_CODEX_EXPORTER: '' };
}
function unsetKeys() {
  return [...new Set([...Object.keys(process.env).filter(key => /^OTEL_[A-Z0-9_]+$/.test(key)),
    'BETA_TRACING_ENDPOINT','CLAUDE_CODE_ENHANCED_TELEMETRY_BETA','ENABLE_ENHANCED_TELEMETRY_BETA'])];
}
async function prepare({ root = rootPath(), projectDir = process.cwd(), provider = 'anthropic', role = 'orchestrator', disabled = false } = {}) {
  root = path.resolve(root);
  const off = reason => ({ enabled: false, reason, unset: unsetKeys(), environment: disabledEnvironment(), codex_args: [] });
  if (disabled || process.env.SGSD_ATLAS_DISABLED === '1' || fs.existsSync(path.join(root, 'disabled'))) return off('disabled');
  try {
    const run = registerRun({ root, projectDir, provider, role });
    const service = await ensureService(root);
    const endpoint = `${service.urls.ingest}/runs/${run.run_id}`;
    const environment = { ...telemetryEnvironment({ healthy: true, runId: run.run_id, stateDir: run.state_dir,
      projectId: run.project_id, endpoint: service.urls.ingest }),
      OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: `${endpoint}/v1/logs`,
      OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: `${endpoint}/v1/metrics`,
      OTEL_LOG_RAW_API_BODIES: '0', SGSD_ATLAS_RUN_ENDPOINT: endpoint,
      SGSD_ATLAS_PROJECT_ID: run.project_id, SGSD_ATLAS_GLOBAL_ROOT: root };
    // Only telemetry configuration is added; no model, auth, sandbox or output setting.
    const exporter = `{ otlp-http = { endpoint = "${endpoint}/v1/logs", protocol = "json", headers = {} } }`;
    environment.SGSD_ATLAS_CODEX_EXPORTER = provider === 'openai' ? `otel.exporter=${exporter}` : '';
    const codexArgs = ['-c', `otel.exporter=${exporter}`, '-c', 'otel.log_user_prompt=false',
      '-c', 'otel.trace_exporter="none"', '-c', 'otel.metrics_exporter="none"'];
    const now = new Date().toISOString();
    if (!queueEvent({ schema_version: 1, source_event_id: `launch:${run.run_id}`, occurred_at: now, event_type: 'coverage',
      source: { kind: 'atlas_lifecycle', instance: 'local', provenance: 'client_observed', confidence: 'exact', completeness_reason: 'launcher_session_start' },
      identity: { sgsd_run_id: run.run_id }, runtime: { provider }, execution: { success: true } }, run.state_dir)) gap(root, 'launch_spool_full');
    return { enabled: true, unset: unsetKeys(), environment, codex_args: codexArgs, run };
  } catch (error) { gap(root, 'automatic_capture_unavailable'); return off('automatic_capture_unavailable'); }
}
function finish({ root = rootPath(), runId = process.env.SGSD_RUN_ID } = {}) {
  try {
    const run = readRun(root, runId); if (!run) return false;
    const file = path.join(run.state_dir, 'exit.json');
    let ended;
    try { ended = readJson(file); }
    catch { ended = { occurred_at: new Date().toISOString() }; writeJson(file, ended); }
    return queueEvent({ schema_version: 1, source_event_id: `exit:${run.run_id}`, occurred_at: ended.occurred_at,
      event_type: 'coverage', source: { kind: 'atlas_lifecycle', instance: 'local', provenance: 'client_observed', confidence: 'exact', completeness_reason: 'launcher_session_exit' },
      identity: { sgsd_run_id: run.run_id }, runtime: { provider: run.provider } }, run.state_dir);
  } catch { return false; }
}
function shell(result, prefix = false) {
  const environment = Object.entries(result.environment);
  if (prefix) return ['env', ...result.unset.flatMap(key => ['-u', key]), ...environment.map(([key, value]) => `${key}=${quote(value)}`)].join(' ');
  return [...result.unset.map(key => `unset ${key}`), ...environment.map(([key, value]) => `export ${key}=${quote(value)}`),
    `SGSD_ATLAS_CODEX_ARGS=(${result.codex_args.map(quote).join(' ')})`].join('\n');
}
if (require.main === module) {
  const value = (flag, fallback) => { const index = process.argv.indexOf(flag); return index < 0 ? fallback : process.argv[index + 1]; };
  const root = path.resolve(value('--root', rootPath()));
  if (process.argv[2] === 'serve') {
    if (process.platform !== 'win32') process.umask(0o077);
    const startupToken = value('--startup-token');
    const start = async () => {
      // The parent publishes the child's PID before the child can own the lock.
      const deadline = Date.now() + 1000;
      while (startupToken && !ownsStartup(root, startupToken) && Date.now() < deadline) await pause(20);
      return startGlobal({ root, startupToken });
    };
    start().then(instance => {
      const finish = async () => { clearInterval(monitor); await instance.close(); process.exit(0); };
      const monitor = setInterval(() => {
        if (fs.existsSync(path.join(root, 'disabled'))) { finish(); return; }
        if (process.memoryUsage().rss > 512 * 1024 * 1024) { gap(root, 'global_memory_limit'); finish(); }
      }, 5000);
      process.on('SIGTERM', finish); process.on('SIGINT', finish);
    }).catch(() => { releaseStartup(root, startupToken); gap(root, 'global_service_failed'); process.exitCode = 1; });
  } else if (process.argv[2] === 'finish') {
    process.exitCode = finish({ root, runId: value('--run-id', process.env.SGSD_RUN_ID) }) ? 0 : 1;
  } else if (process.argv[2] === 'status') {
    status(root).then(result => { process.stdout.write(JSON.stringify(result || { healthy: false, reason: 'service_unavailable' }) + '\n'); if (!result) process.exitCode = 1; });
  } else {
    const emitOff = () => {
      const result = { enabled: false, unset: unsetKeys(), environment: disabledEnvironment(), codex_args: [] };
      const format = value('--format', 'json');
      process.stdout.write((format === 'shell' ? shell(result) : format === 'prefix' ? shell(result, true) : JSON.stringify(result)) + '\n');
    };
    const timer = setTimeout(() => { gap(root, 'bootstrap_timeout'); process.stderr.write('[Atlas] capture unavailable: startup timeout\n'); emitOff(); process.exit(0); }, 3000);
    prepare({ root, projectDir: value('--project-dir', process.cwd()), provider: value('--provider', 'anthropic'), role: value('--role', 'orchestrator') })
      .then(result => {
        clearTimeout(timer);
        if (!result.enabled && result.reason !== 'disabled') process.stderr.write('[Atlas] capture unavailable; run the Atlas audit\n');
        const format = value('--format', 'json');
        process.stdout.write((format === 'shell' ? shell(result) : format === 'prefix' ? shell(result, true) : JSON.stringify(result)) + '\n');
      }).catch(() => { clearTimeout(timer); gap(root, 'bootstrap_failed'); emitOff(); process.exitCode = 0; });
  }
}
module.exports = { prepare, finish, startGlobal, status, ensureService, rootPath, registerRun, getJson, shell };
