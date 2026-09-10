'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { digest } = require('../../tools/telemetry-atlas/contract.cjs');

const HEALTH_TIMEOUT_MS = 1500;
const SNAPSHOT_STALE_MS = 10 * 60 * 1000;
const RUN_ID = /^sgsd-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function oneLine(value, fallback = 'unknown') {
  const text = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  return (text || fallback).slice(0, 240);
}

function readJson(filePath, maximumBytes) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size > maximumBytes) throw new Error('invalid_file');
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function safeRealpath(value) {
  try {
    return fs.realpathSync(value);
  } catch {
    return null;
  }
}

function clockTime(value) {
  if (typeof value !== 'string' || !value.trim()) return 'unknown';
  const time = new Date(value);
  if (!Number.isFinite(time.getTime())) return 'unknown';
  return `${String(time.getUTCHours()).padStart(2, '0')}:${String(time.getUTCMinutes()).padStart(2, '0')}Z`;
}

function healthEndpoint(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1'
        || parsed.username || parsed.password) return null;
    if (parsed.pathname === '/' || parsed.pathname === '') parsed.pathname = '/health';
    return parsed.toString();
  } catch {
    return null;
  }
}

function defaultFetchHealth(url, timeoutMs) {
  const script = `
    'use strict';
    const http = require('node:http');
    const url = process.argv[1];
    const timeoutMs = Number(process.argv[2]);
    let finished = false;
    let timer;
    function finish(value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      process.stdout.write(JSON.stringify(value));
    }
    const request = http.get(url, { agent: false }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 65536) {
          finish({ reason: 'health response too large' });
          request.destroy();
        }
      });
      response.on('end', () => {
        if (finished) return;
        try { finish({ statusCode: response.statusCode, body: JSON.parse(body) }); }
        catch { finish({ statusCode: response.statusCode, reason: 'invalid health response' }); }
      });
    });
    timer = setTimeout(() => {
      finish({ reason: 'timeout' });
      request.destroy();
    }, timeoutMs);
    request.on('error', error => finish({ reason: error.code || error.message || 'request error' }));
  `;
  const result = spawnSync(process.execPath, ['-e', script, url, String(timeoutMs)], {
    encoding: 'utf8',
    timeout: timeoutMs + 200,
    windowsHide: true,
  });
  if (result.error) return { reason: result.error.code === 'ETIMEDOUT' ? 'timeout' : oneLine(result.error.message) };
  try {
    return JSON.parse(result.stdout || '');
  } catch {
    return { reason: 'invalid health response' };
  }
}

function receiverIdentity(service) {
  return {
    pid: Number.isSafeInteger(service && service.pid) && service.pid > 0 ? service.pid : 'unknown',
    fingerprint: typeof service?.runtime_fingerprint === 'string' && service.runtime_fingerprint
      ? service.runtime_fingerprint.slice(0, 8) : 'unknown',
    started: clockTime(service && service.started_at),
  };
}

function receiverHealth(response, service, globalRoot) {
  if (!response || typeof response !== 'object') return { healthy: false, reason: 'health unavailable' };
  if (Number.isInteger(response.statusCode) && response.statusCode !== 200) {
    return { healthy: false, reason: oneLine(response.reason || response.body?.reason || `HTTP ${response.statusCode}`) };
  }
  const health = response.body && typeof response.body === 'object' ? response.body : response;
  if (health.status !== 'healthy' && health.healthy !== true) {
    return { healthy: false, reason: oneLine(health.reason || health.storage?.reason || response.reason,
      'unhealthy response') };
  }
  const rootId = digest(globalRoot);
  const requiredIdentity = [
    ['pid', service.pid],
    ['instance_id', service.instance_id],
    ['root_id', rootId],
    ['project_id', rootId],
    ['runtime_fingerprint', service.runtime_fingerprint],
  ];
  for (const [field, expected] of requiredIdentity) {
    if (!Object.prototype.hasOwnProperty.call(health, field)
        || health[field] === null || health[field] === '') {
      return { healthy: false, reason: `health ${field} missing` };
    }
    if (health[field] !== expected) return { healthy: false, reason: `health ${field} mismatch` };
  }
  return { healthy: true, reason: null };
}

function collectReceiver(globalRoot, fetchHealth, timeoutMs) {
  const servicePath = path.join(globalRoot, 'service.json');
  if (!fs.existsSync(servicePath)) return { state: 'not_deployed' };

  let service;
  try {
    service = readJson(servicePath, 64 * 1024);
  } catch {
    return { state: 'unhealthy', reason: 'invalid service record',
      identity: receiverIdentity(null) };
  }
  const identity = receiverIdentity(service);
  if (!service || service.schema_version !== 1 || service.root_id !== digest(globalRoot)) {
    return { state: 'unhealthy', reason: 'invalid service record', identity };
  }
  if (identity.pid === 'unknown') return { state: 'unhealthy', reason: 'service pid missing', identity };
  try {
    process.kill(identity.pid, 0);
  } catch (error) {
    if (!error || error.code !== 'EPERM') {
      return { state: 'unhealthy', reason: error && error.code === 'ESRCH' ? 'pid not running'
        : `pid check ${oneLine(error && (error.code || error.message))}`, identity };
    }
  }
  const endpoint = healthEndpoint(service.urls && service.urls.health);
  if (!endpoint) return { state: 'unhealthy', reason: 'health URL is not loopback', identity };

  let response;
  try {
    response = fetchHealth(endpoint, Math.min(HEALTH_TIMEOUT_MS,
      Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : HEALTH_TIMEOUT_MS));
  } catch (error) {
    return { state: 'unhealthy', reason: oneLine(error && (error.code || error.message), 'health unavailable'), identity };
  }
  const checked = receiverHealth(response, service, globalRoot);
  return { state: checked.healthy ? 'healthy' : 'unhealthy', reason: checked.reason, identity };
}

function collectSession(projectReal, projectId, globalRoot, env) {
  const runId = typeof env.SGSD_RUN_ID === 'string' ? env.SGSD_RUN_ID.trim() : '';
  if (!runId) return { state: 'not_attached', reason: 'no_run_id' };
  if (!RUN_ID.test(runId)) return { state: 'not_attached', reason: 'invalid_run_id', runId };
  const environmentProjectId = typeof env.SGSD_ATLAS_PROJECT_ID === 'string'
    ? env.SGSD_ATLAS_PROJECT_ID.trim() : '';
  const environmentRoot = typeof env.SGSD_ATLAS_GLOBAL_ROOT === 'string'
    ? env.SGSD_ATLAS_GLOBAL_ROOT.trim() : '';
  if (!environmentProjectId || !environmentRoot) {
    return { state: 'not_attached', reason: 'atlas_environment_missing', runId };
  }

  let registration;
  try {
    registration = readJson(path.join(globalRoot, 'runs', runId, 'registration.json'), 64 * 1024);
  } catch {
    return { state: 'not_attached', reason: 'registration_missing', runId };
  }
  if (!registration || registration.schema_version !== 1 || registration.run_id !== runId
      || typeof registration.project_id !== 'string' || typeof registration.project_dir !== 'string') {
    return { state: 'not_attached', reason: 'registration_invalid', runId };
  }
  const registeredProjectReal = safeRealpath(registration.project_dir);
  if (!registeredProjectReal || registration.project_id !== digest(registeredProjectReal)) {
    return { state: 'not_attached', reason: 'registration_mismatch', runId };
  }
  if (registeredProjectReal !== projectReal) {
    return { state: 'different_project', runId, projectDir: registeredProjectReal };
  }
  if (registration.project_id !== projectId || environmentProjectId !== registration.project_id) {
    return { state: 'not_attached', reason: 'registration_mismatch', runId };
  }
  return { state: 'attached', runId, registeredAt: registration.registered_at };
}

function deliveryText(name, value) {
  const entry = value && typeof value === 'object' ? value : {};
  const status = typeof entry.status === 'string' && entry.status ? oneLine(entry.status) : 'unknown';
  const timestamps = [entry.last_received_at, entry.last_occurred_at].filter(item => item != null);
  const observedAt = timestamps.map(clockTime).find(item => item !== 'unknown')
    || (timestamps.length ? 'unknown' : 'none');
  let text = `${name} ${status} (last ${observedAt}`;
  if (name === 'operational') {
    const gaps = entry.gaps === undefined || entry.gaps === null ? 'unknown' : entry.gaps;
    const backlog = entry.pending_bytes === undefined || entry.pending_bytes === null ? 'unknown' : entry.pending_bytes;
    text += `, gaps ${gaps}, backlog ${backlog} bytes`;
  }
  return text + ')';
}

function projectRegistration(globalRoot, projectId, projectReal) {
  try {
    const registration = readJson(path.join(globalRoot, 'projects', projectId, 'project.json'), 64 * 1024);
    const registeredProjectReal = registration && typeof registration.project_dir === 'string'
      ? safeRealpath(registration.project_dir) : null;
    return registration && registration.schema_version === 1
      && registration.project_id === projectId && registeredProjectReal === projectReal
      ? 'registered' : 'not registered';
  } catch {
    return 'not registered';
  }
}

function collectProjectSnapshot(globalRoot, projectId, projectReal) {
  const registration = projectRegistration(globalRoot, projectId, projectReal);
  let snapshot;
  try {
    snapshot = readJson(path.join(globalRoot, 'monitor', 'latest.json'), 1024 * 1024);
  } catch {
    return { state: 'missing', registration, findings: [] };
  }
  if (!snapshot || !Array.isArray(snapshot.projects) || !Array.isArray(snapshot.findings)) {
    return { state: 'missing', registration, findings: [] };
  }
  const generatedAt = typeof snapshot.generated_at === 'string' && snapshot.generated_at.trim()
    ? new Date(snapshot.generated_at).getTime() : NaN;
  const ageMs = Number.isFinite(generatedAt) ? Math.max(0, Date.now() - generatedAt) : null;
  const project = snapshot.projects.find(item => item && item.project_id === projectId) || null;
  const findings = snapshot.findings.filter(item => item && item.project_id === projectId)
    .map(item => oneLine(item.reason));
  return {
    state: 'available',
    registration,
    native: deliveryText('native', project && project.native),
    operational: deliveryText('operational', project && project.operational),
    generatedAt: snapshot.generated_at,
    ageMinutes: ageMs === null ? null : Math.floor(ageMs / 60000),
    stale: ageMs !== null && ageMs > SNAPSHOT_STALE_MS,
    findings,
  };
}

function collectAtlasBootBriefing({
  projectRoot,
  homeDir = os.homedir(),
  env = process.env,
  timeoutMs = HEALTH_TIMEOUT_MS,
  fetchHealth = defaultFetchHealth,
} = {}) {
  try {
    const projectReal = safeRealpath(projectRoot || process.cwd());
    if (!projectReal) throw new Error('project root unavailable');
    const projectId = digest(projectReal);
    const configuredRoot = typeof env.SGSD_ATLAS_GLOBAL_ROOT === 'string'
      && env.SGSD_ATLAS_GLOBAL_ROOT.trim() ? env.SGSD_ATLAS_GLOBAL_ROOT.trim() : null;
    const globalRoot = path.resolve(configuredRoot
      || path.join(homeDir, '.local', 'state', 'sgsd', 'telemetry', 'global'));
    return {
      projectId,
      receiver: collectReceiver(globalRoot, fetchHealth, timeoutMs),
      session: collectSession(projectReal, projectId, globalRoot, env),
      project: collectProjectSnapshot(globalRoot, projectId, projectReal),
    };
  } catch (error) {
    return {
      projectId: 'unknown',
      receiver: { state: 'unhealthy', reason: oneLine(error && error.message), identity: receiverIdentity(null) },
      session: { state: 'not_attached', reason: 'status_unavailable' },
      project: { state: 'missing', findings: [] },
    };
  }
}

function formatSession(session) {
  if (session.state === 'attached') {
    return `- This session: attached, run ${session.runId} registered ${clockTime(session.registeredAt)} for this worktree`;
  }
  if (session.state === 'different_project') {
    return `- This session: attached, run ${session.runId} registered for a DIFFERENT project (${session.projectDir})`;
  }
  if (session.reason === 'no_run_id') {
    return "- This session: NOT ATTACHED (no SGSD_RUN_ID; started outside the SGSD launch paths, so this session's native telemetry is not collected)";
  }
  const reason = {
    invalid_run_id: 'invalid SGSD_RUN_ID',
    atlas_environment_missing: 'Atlas launch environment missing',
    registration_missing: 'run registration missing',
    registration_invalid: 'run registration invalid',
    registration_mismatch: 'run registration does not match the Atlas launch environment',
  }[session.reason] || 'attachment status unavailable';
  return `- This session: NOT ATTACHED (${reason}${session.runId ? ` for ${session.runId}` : ''})`;
}

function formatAtlasBriefing(result) {
  const lines = ['Atlas Telemetry'];
  const receiver = result.receiver;
  if (receiver.state === 'not_deployed') lines.push('- Receiver: not deployed');
  else {
    const identity = receiver.identity || receiverIdentity(null);
    const status = receiver.state === 'healthy' ? 'healthy' : `unhealthy (${oneLine(receiver.reason)})`;
    lines.push(`- Receiver: ${status} [pid ${identity.pid}, fp ${identity.fingerprint}, started ${identity.started}]`);
  }
  lines.push(formatSession(result.session));

  const projectId = typeof result.projectId === 'string' ? result.projectId.slice(0, 8) : 'unknown';
  if (result.project.state === 'missing') {
    lines.push(`- Project ${projectId}: monitor snapshot missing`);
  } else {
    const snapshotTime = clockTime(result.project.generatedAt);
    const snapshotAge = result.project.ageMinutes === null ? 'unknown age' : `${result.project.ageMinutes}m old`;
    lines.push(`- Project ${projectId}: ${result.project.registration}; ${result.project.native}; ${result.project.operational}`
      + ` (monitor snapshot ${snapshotTime}, ${snapshotAge})${result.project.stale ? ' (stale)' : ''}`);
  }
  for (const finding of result.project.findings || []) lines.push(`- WARN: ${finding}`);
  return lines;
}

module.exports = { collectAtlasBootBriefing, formatAtlasBriefing };
