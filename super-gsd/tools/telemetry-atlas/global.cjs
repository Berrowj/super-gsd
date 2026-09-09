#!/usr/bin/env node
'use strict';
function loadedGlobalRuntime() {
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const DEPENDENCY_FILES = ['server.cjs', 'codex-otlp.cjs', 'otlp.cjs', 'accounting.cjs',
  'contract.cjs', 'global-store.cjs', 'quota-sampler.cjs', 'lifecycle.cjs'];
function dependencySnapshot() {
  return DEPENDENCY_FILES.map(name => {
    const bytes = fs.readFileSync(path.join(__dirname, name));
    return { name, length: bytes.length, hash: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
}
const cachedDependencies = DEPENDENCY_FILES.filter(name => require.cache[require.resolve(path.join(__dirname, name))]);
const dependencyBefore = dependencySnapshot();
const { registerRun: registerRunStore, readRun, readJson, writeJson, createGlobalStore } = require('./global-store.cjs');
const { digest, appendGap, safePath } = require('./contract.cjs');
const { privateDirectory, queueEvent } = require('./quota-sampler.cjs');
const { telemetryEnvironment, processIdentity, owned, ownsPort } = require('./lifecycle.cjs');
const { startServer } = require('./server.cjs');
const PROTOCOL = 1;
const dependencyAfter = dependencySnapshot();
const dependencyCoherent = cachedDependencies.length === 0
  && JSON.stringify(dependencyBefore) === JSON.stringify(dependencyAfter);
const compiledEntry = Function.prototype.toString.call(loadedGlobalRuntime);
const entryComponent = { name: 'global.cjs', length: Buffer.byteLength(compiledEntry),
  hash: crypto.createHash('sha256').update(compiledEntry).digest('hex') };
const RUNTIME_FINGERPRINT = dependencyCoherent ? crypto.createHash('sha256')
  .update([entryComponent, ...dependencyBefore].map(row => `${row.name}\0${row.length}\0${row.hash}\n`).join('')).digest('hex') : null;
function requireAttestedRuntime() { if (!RUNTIME_FINGERPRINT) throw new Error('runtime_closure_unattested'); }
function registerRun(options) { requireAttestedRuntime(); return registerRunStore(options); }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const quote = value => `'${String(value).replace(/'/g, `'"'"'`)}'`;
const rootPath = () => path.resolve(process.env.SGSD_ATLAS_GLOBAL_ROOT || path.join(os.homedir(), '.local', 'state', 'sgsd', 'telemetry', 'global'));
const servicePath = root => path.join(root, 'service.json');
const lockPath = root => path.join(root, 'startup.lock');
const transitionPath = root => path.join(root, 'receiver-transition.json');
function alive(pid) { try { if (!Number.isSafeInteger(pid) || pid < 1) return false; process.kill(pid, 0); return true; } catch (error) { return error.code !== 'ESRCH'; } }
function gap(root, reason) { try { appendGap(path.join(root, 'sgsd-atlas-gaps.jsonl'), reason); } catch {} }
function durableJson(file, value) {
  privateDirectory(path.dirname(file)); safePath(file);
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    const bytes = Buffer.from(JSON.stringify(value) + '\n');
    if (fs.writeSync(fd, bytes) !== bytes.length) throw new Error('short_write');
    fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    fs.renameSync(temporary, file);
    if (process.platform !== 'win32') {
      const directory = fs.openSync(path.dirname(file), 'r');
      try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
  }
}
function readTransition(root) { return fs.existsSync(transitionPath(root)) ? readJson(transitionPath(root)) : null; }
function pendingTransition(root) {
  const value = readTransition(root);
  if (!value) return null;
  if (value.schema_version !== PROTOCOL || value.root_id !== digest(root) || !value.token) throw new Error('transition_journal_unverified');
  return value.phase !== 'complete' ? value : null;
}
function urlPorts(record) {
  const result = {};
  for (const name of ['ingest', 'health', 'metrics']) {
    const url = new URL(record?.urls?.[name]);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/') throw new Error('service_endpoint_unverified');
    const port = Number(url.port); if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('service_endpoint_unverified');
    result[name] = port;
  }
  if (new Set(Object.values(result)).size !== 3) throw new Error('service_endpoint_unverified');
  return result;
}
function realRegular(file) {
  const resolved = fs.realpathSync(path.resolve(file)); safePath(resolved);
  const stat = fs.lstatSync(resolved);
  if (!stat.isFile() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid())) throw new Error('untrusted_runtime_entry');
  return resolved;
}
function expectedServeArgv(entry, root, token, ports, instanceId, transitionToken, executable = process.execPath) {
  return [executable, '--max-old-space-size=256', entry, 'serve', '--root', root, '--startup-token', token,
    ...(ports ? ['--ingest-port', String(ports.ingest), '--health-port', String(ports.health), '--metrics-port', String(ports.metrics)] : []),
    ...(instanceId ? ['--instance-id', instanceId] : []), ...(transitionToken ? ['--transition-token', transitionToken] : [])];
}
function exactIdentity(record, root, trustedSourceEntry) {
  const identity = processIdentity(record?.pid); if (!identity) throw new Error('service_identity_unverified');
  const allowed = new Set([realRegular(__filename)]);
  if (trustedSourceEntry) allowed.add(realRegular(trustedSourceEntry));
  const entry = identity.argv[2];
  let argvExecutable;
  try { argvExecutable = fs.realpathSync(identity.argv[0]); } catch { throw new Error('service_identity_unverified'); }
  if (!allowed.has(entry) || identity.executable !== argvExecutable) throw new Error('service_identity_unverified');
  const token = identity.argv[identity.argv.indexOf('--startup-token') + 1];
  const base = expectedServeArgv(entry, root, token, undefined, undefined, undefined, identity.argv[0]);
  let exact = token && JSON.stringify(identity.argv) === JSON.stringify(base);
  if (!exact && token && record.runtime_fingerprint) {
    const full = expectedServeArgv(entry, root, token, urlPorts(record), record.instance_id, token, identity.argv[0]);
    exact = JSON.stringify(identity.argv) === JSON.stringify(full);
  }
  if (!exact) throw new Error('service_identity_unverified');
  const modern = record.runtime_fingerprint !== undefined || record.process_identity !== undefined;
  if (modern && (!record.runtime_fingerprint || !record.process_identity
      || !sameIdentity(identity, record.process_identity) || !owned(record.process_identity)))
    throw new Error('service_identity_changed');
  return identity;
}
function requireDeadline(deadline, reason = 'receiver_transition_timeout') {
  if (deadline !== undefined && Date.now() >= deadline) throw new Error(reason);
}
function namespaceListeners(pid, ports, deadline) {
  const listeners = new Map(ports.map(port => [port, new Set()])); let complete = true;
  for (const kind of ['tcp', 'tcp6']) {
    let lines;
    try { lines = fs.readFileSync(`/proc/${pid}/net/${kind}`, 'utf8').split('\n').slice(1); }
    catch { complete = false; continue; }
    for (const line of lines) {
      requireDeadline(deadline);
      const fields = line.trim().split(/\s+/);
      const port = parseInt(fields[1]?.split(':').pop(), 16);
      if (fields[3] === '0A' && listeners.has(port)) listeners.get(port).add(fields[9]);
    }
  }
  return { complete, listeners };
}
function portStates(ports, deadline) {
  const uniquePorts = [...new Set(ports)], states = new Map(uniquePorts.map(port => [port, 'vacant']));
  if (process.platform !== 'linux') return states;
  const observed = namespaceListeners('self', uniquePorts, deadline);
  for (const port of uniquePorts) {
    states.set(port, observed.listeners.get(port).size ? 'occupied' : observed.complete ? 'vacant' : 'unknown');
  }
  return states;
}
function requireVacantPorts(ports, deadline) {
  const states = portStates(ports, deadline);
  requireDeadline(deadline);
  if ([...states.values()].some(state => state === 'occupied')) throw new Error('receiver_port_taken');
  if ([...states.values()].some(state => state === 'unknown')) throw new Error('receiver_port_ownership_unverified');
}
function remainingTimeout(deadline, maximum = 250, reason = 'receiver_transition_timeout') {
  if (deadline === undefined) return maximum;
  requireDeadline(deadline, reason);
  return Math.max(1, Math.min(maximum, deadline - Date.now()));
}
async function verifiedService(root, trustedSourceEntry, targetFingerprint, deadline, timeoutReason = 'receiver_transition_timeout') {
  requireDeadline(deadline, timeoutReason);
  const record = await status(root, remainingTimeout(deadline, 250, timeoutReason));
  requireDeadline(deadline, timeoutReason);
  if (!record) throw new Error('service_health_unverified');
  const identity = exactIdentity(record, root, trustedSourceEntry), ports = urlPorts(record);
  requireDeadline(deadline, timeoutReason);
  for (const port of Object.values(ports)) {
    requireDeadline(deadline, timeoutReason);
    const owns = ownsPort(record.pid, port);
    requireDeadline(deadline, timeoutReason);
    if (!owns) throw new Error('service_port_ownership_unverified');
  }
  if (targetFingerprint && (record.runtime_fingerprint !== targetFingerprint || record.health?.runtime_fingerprint !== targetFingerprint))
    throw new Error('service_fingerprint_mismatch');
  return { record, identity, ports };
}

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
async function status(root = rootPath(), timeout = 250) {
  try {
    const record = readJson(servicePath(root));
    if (record.schema_version !== PROTOCOL || !alive(record.pid) || record.root_id !== digest(root)) return null;
    const health = await getJson(record.urls.health + '/health', timeout);
    if (health?.pid !== record.pid || health.instance_id !== record.instance_id || health.project_id !== digest(root)
        || (health.root_id !== undefined && health.root_id !== digest(root))
        || (record.runtime_fingerprint && health.runtime_fingerprint !== record.runtime_fingerprint)) return null;
    return { ...record, health };
  } catch { return null; }
}
function ownsStartup(root, token) {
  try { const lock = readJson(lockPath(root)); return lock.pid === process.pid && lock.token === token; }
  catch { return false; }
}
function releaseStartup(root, token) {
  try { if (ownsStartup(root, token)) fs.unlinkSync(lockPath(root)); } catch {}
}
function createStartupLock(root, token) {
  privateDirectory(root); const file = lockPath(root); safePath(file);
  const fd = fs.openSync(file, 'wx', 0o600);
  try {
    const bytes = Buffer.from(JSON.stringify({ pid: process.pid, token, identity: processIdentity(process.pid) }) + '\n');
    if (fs.writeSync(fd, bytes) !== bytes.length) throw new Error('short_write'); fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  if (process.platform !== 'win32') {
    const directory = fs.openSync(root, 'r'); try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  }
}
function replaceStartupLock(root, pid, token) { durableJson(lockPath(root), { pid, token, identity: processIdentity(pid) }); }
async function acquireStartup(root, token, deadline) {
  while (Date.now() < deadline) {
    try { createStartupLock(root, token); return true; }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        const previous = readJson(lockPath(root));
        if (!alive(previous.pid)) { fs.unlinkSync(lockPath(root)); continue; }
      } catch (readError) { if (readError.code === 'ENOENT') continue; }
      await pause(40);
    }
  }
  return false;
}
function transitionChildClaim(root, token, instanceId) {
  if (!token) return;
  const journal = pendingTransition(root);
  if (!journal || journal.token !== token || !['launching', 'handoff', 'child_owned'].includes(journal.phase)) throw new Error('transition_ownership_lost');
  if (!ownsStartup(root, token)) throw new Error('startup_ownership_lost');
  const identity = processIdentity(process.pid); if (!identity) throw new Error('transition_identity_unavailable');
  if (journal.candidate_identity && !owned(journal.candidate_identity)) throw new Error('transition_candidate_changed');
  durableJson(transitionPath(root), { ...journal, phase: 'child_owned', replacement_instance_id: instanceId,
    replacement_identity: identity, child_owned_at: new Date().toISOString(), updated_at: new Date().toISOString() });
}
async function startGlobal({ root = rootPath(), spoolPollMs = 1000, startupToken, transitionToken, ports = {}, instanceId,
  storeFactory = createGlobalStore, serverFactory = startServer } = {}) {
  requireAttestedRuntime();
  root = path.resolve(root); privateDirectory(root);
  if (startupToken && !ownsStartup(root, startupToken)) throw new Error('startup_ownership_lost');
  instanceId ||= crypto.randomUUID();
  transitionChildClaim(root, transitionToken, instanceId);
  const store = storeFactory(root);
  let instance;
  try {
    instance = await serverFactory({ projectDir: root, store, instanceId, runtimeFingerprint: RUNTIME_FINGERPRINT,
      resolveRoute: store.resolveRoute, scopeEvent: store.scopeEvent, spoolSources: store.spoolSources,
      ingestPort: ports.ingest ?? 0, healthPort: ports.health ?? 0, metricsPort: ports.metrics ?? 0, spoolPollMs });
  } catch (error) { store.close(); throw error; }
  const record = { schema_version: PROTOCOL, mode: 'global', root_id: digest(root), pid: process.pid,
    instance_id: instance.instanceId, started_at: new Date().toISOString(), urls: instance.urls,
    runtime_fingerprint: RUNTIME_FINGERPRINT, process_identity: processIdentity(process.pid), entry: fs.realpathSync(__filename),
    startup_token: startupToken || null };
  try {
    if (startupToken && !ownsStartup(root, startupToken)) throw new Error('startup_ownership_lost');
    writeJson(servicePath(root), record);
    if (transitionToken) {
      const journal = pendingTransition(root);
      if (!journal || journal.token !== transitionToken) throw new Error('transition_ownership_lost');
      durableJson(transitionPath(root), { ...journal, phase: 'service_ready', replacement_identity: record.process_identity,
        replacement_instance_id: record.instance_id, service_ready_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    }
    if (startupToken) releaseStartup(root, startupToken);
  } catch (error) { await instance.close(); store.close(); throw error; }
  let closePromise;
  const close = () => {
    if (closePromise) return closePromise;
    closePromise = (async () => {
      await instance.close(); store.close();
      try { if (readJson(servicePath(root)).instance_id === record.instance_id) fs.unlinkSync(servicePath(root)); } catch {}
    })();
    return closePromise;
  };
  return { ...instance, record, close };
}
async function ensureService(root, timeoutMs = 2000) {
  requireAttestedRuntime();
  if (pendingTransition(root)) throw new Error('receiver_transition_pending');
  const existing = await status(root);
  if (pendingTransition(root)) throw new Error('receiver_transition_pending');
  if (existing) return existing;
  privateDirectory(root);
  const deadline = Date.now() + timeoutMs;
  const token = crypto.randomUUID();
  if (!await acquireStartup(root, token, deadline)) throw new Error('startup_busy');
  let childOwnsLock = false;
  try {
    if (pendingTransition(root)) throw new Error('receiver_transition_pending');
    const running = await status(root);
    if (pendingTransition(root)) throw new Error('receiver_transition_pending');
    if (running) return running;
    // A live process with unverifiable health is not authority to kill or replace it.
    try { const old = readJson(servicePath(root)); if (alive(old.pid)) throw new Error('service_unverified'); }
    catch (error) { if (error.message === 'service_unverified') throw error; }
    const child = spawn(process.execPath, ['--max-old-space-size=256', __filename, 'serve', '--root', root, '--startup-token', token],
      { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env } });
    let failed = false; child.on('error', () => { failed = true; }); child.unref();
    if (Number.isSafeInteger(child.pid) && child.pid > 0) {
      replaceStartupLock(root, child.pid, token); childOwnsLock = true;
    }
    while (Date.now() < deadline && !failed) {
      const ready = await status(root);
      if (pendingTransition(root)) throw new Error('receiver_transition_pending');
      if (ready) return ready;
      await pause(40);
    }
    throw new Error('service_start_timeout');
  } finally { if (!childOwnsLock) releaseStartup(root, token); }
}
function sameIdentity(left, right) {
  return Boolean(left && right && left.pid === right.pid && left.start_time === right.start_time
    && left.executable === right.executable && JSON.stringify(left.argv) === JSON.stringify(right.argv));
}
function validIdentity(identity) {
  return Boolean(identity && Number.isSafeInteger(identity.pid) && identity.pid > 0
    && typeof identity.start_time === 'string' && identity.start_time
    && typeof identity.executable === 'string' && identity.executable
    && Array.isArray(identity.argv) && identity.argv.every(value => typeof value === 'string'));
}
async function waitForStopped(identity, ports, deadline) {
  for (;;) {
    if (Date.now() >= deadline) throw new Error('receiver_stop_timeout');
    if (!owned(identity)) break;
    await pause(Math.min(40, Math.max(1, deadline - Date.now())));
  }
  requireVacantPorts(Object.values(ports), deadline);
}
async function completeTransition(root, journal, deadline) {
  while (Date.now() < deadline) {
    try {
      const replacement = await verifiedService(root, journal.target_entry, journal.target_fingerprint, deadline, 'receiver_start_timeout');
      const latest = readTransition(root);
      if (!latest || latest.token !== journal.token || latest.target_fingerprint !== journal.target_fingerprint) throw new Error('transition_journal_unverified');
      const recordedIdentity = latest.replacement_identity || latest.candidate_identity;
      if (replacement.record.instance_id !== latest.replacement_instance_id
          || replacement.record.startup_token !== latest.token || !sameIdentity(replacement.identity, recordedIdentity))
        throw new Error('replacement_identity_mismatch');
      const complete = { ...latest, phase: 'complete', replacement_identity: replacement.identity,
        replacement_instance_id: replacement.record.instance_id, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      durableJson(transitionPath(root), complete); gap(root, 'receiver_revision_transition');
      return { status: 'restarted', service: replacement.record };
    } catch (error) {
      if (!['service_health_unverified', 'service_fingerprint_mismatch'].includes(error.message)) throw error;
    }
    await pause(40);
  }
  throw new Error('receiver_start_timeout');
}
async function restartService({ root = rootPath(), trustedSourceEntry, timeoutMs = 5000, transitionObserver } = {}) {
  requireAttestedRuntime();
  root = path.resolve(root);
  const deadline = Date.now() + timeoutMs;
  if (!fs.existsSync(root) || process.env.SGSD_ATLAS_DISABLED === '1' || fs.existsSync(path.join(root, 'disabled')))
    return { status: fs.existsSync(root) ? 'disabled' : 'absent' };
  const serviceFile = servicePath(root), existingJournal = readTransition(root);
  const targetEntry = realRegular(__filename);
  const trustedEntry = trustedSourceEntry ? realRegular(trustedSourceEntry) : undefined;
  let journal = existingJournal;
  if (journal && (journal.schema_version !== PROTOCOL || journal.root_id !== digest(root) || !journal.token))
    throw new Error('transition_journal_unverified');
  if (journal && journal.phase !== 'complete'
      && (journal.target_fingerprint !== RUNTIME_FINGERPRINT || journal.target_entry !== targetEntry))
    throw new Error('receiver_transition_target_changed');
  let token = journal && journal.phase !== 'complete' ? journal.token : crypto.randomUUID();
  if (!await acquireStartup(root, token, deadline)) throw new Error('startup_busy');
  let childOwnsLock = false;
  try {
    requireDeadline(deadline);
    journal = readTransition(root);
    if (journal && journal.phase !== 'complete' && journal.token !== token) {
      releaseStartup(root, token);
      requireDeadline(deadline);
      return restartService({ root, trustedSourceEntry, timeoutMs: Math.max(1, deadline - Date.now()), transitionObserver });
    }
    if (!fs.existsSync(serviceFile) && (!journal || journal.phase === 'complete')) {
      if (journal) {
        const identities = [journal.old_identity, journal.candidate_identity, journal.replacement_identity].filter(Boolean);
        if (!validIdentity(journal.replacement_identity) || identities.some(identity => !validIdentity(identity)))
          throw new Error('transition_journal_unverified');
        if (identities.some(identity => owned(identity))) throw new Error('service_health_unverified');
        const ports = urlPorts({ urls: journal.urls });
        if (['ingest', 'health', 'metrics'].some(name => journal.ports?.[name] !== ports[name]))
          throw new Error('transition_journal_unverified');
        requireVacantPorts(Object.values(ports), deadline);
      }
      return { status: 'absent' };
    }
    if (process.platform !== 'linux') throw new Error('receiver_transition_windows_open');
    if (!journal || journal.phase === 'complete') {
      const old = await verifiedService(root, trustedEntry, undefined, deadline);
      if (old.record.runtime_fingerprint === RUNTIME_FINGERPRINT && old.record.health?.runtime_fingerprint === RUNTIME_FINGERPRINT) {
        return { status: 'already_current', service: old.record };
      }
      journal = { schema_version: PROTOCOL, token, phase: 'prepared', created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(), root_id: digest(root), target_entry: targetEntry,
        trusted_source_entry: trustedEntry || null, target_fingerprint: RUNTIME_FINGERPRINT,
        old_identity: old.identity, old_instance_id: old.record.instance_id, old_runtime_fingerprint: old.record.runtime_fingerprint || null,
        urls: old.record.urls, ports: old.ports, replacement_instance_id: crypto.randomUUID() };
      durableJson(transitionPath(root), journal);
      if (transitionObserver) await transitionObserver('prepared', journal);
      requireDeadline(deadline);
    }
    if (journal.target_fingerprint !== RUNTIME_FINGERPRINT || journal.target_entry !== targetEntry) throw new Error('receiver_transition_target_changed');
    if (!['prepared', 'stopping'].includes(journal.phase)) {
      try {
        const ready = await verifiedService(root, journal.target_entry, journal.target_fingerprint, deadline);
        if (ready.record.instance_id === journal.replacement_instance_id) return completeTransition(root, journal, deadline);
      } catch (error) {
        if (!['service_health_unverified', 'service_fingerprint_mismatch'].includes(error.message)) throw error;
      }
    }
    if (['prepared', 'stopping'].includes(journal.phase)) {
      if (owned(journal.old_identity)) {
        requireDeadline(deadline);
        const old = await verifiedService(root, journal.trusted_source_entry || undefined, undefined, deadline);
        if (!sameIdentity(old.identity, journal.old_identity) || old.record.instance_id !== journal.old_instance_id
            || JSON.stringify(old.ports) !== JSON.stringify(journal.ports)) throw new Error('receiver_identity_changed');
        // Identity, health and every listener are re-proved immediately before this one graceful signal.
        requireDeadline(deadline);
        process.kill(old.record.pid, 'SIGTERM');
        journal = { ...journal, phase: 'stopping', signal_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        durableJson(transitionPath(root), journal);
      }
      await waitForStopped(journal.old_identity, journal.ports, deadline);
      journal = { ...journal, phase: 'stopped', stopped_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      durableJson(transitionPath(root), journal);
      if (transitionObserver) await transitionObserver('old_stopped', journal);
      requireDeadline(deadline);
      await waitForStopped(journal.old_identity, journal.ports, deadline);
    } else {
      await waitForStopped(journal.old_identity, journal.ports, deadline);
    }
    if (Date.now() >= deadline) throw new Error('receiver_transition_timeout');
    journal = { ...journal, phase: 'launching', launch_started_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    delete journal.candidate_identity; delete journal.replacement_identity;
    durableJson(transitionPath(root), journal);
    requireDeadline(deadline);
    const args = expectedServeArgv(journal.target_entry, root, journal.token, journal.ports,
      journal.replacement_instance_id, journal.token).slice(1);
    const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env } });
    let failed = false; child.on('error', () => { failed = true; }); child.unref();
    let candidate;
    while (!failed && Date.now() < deadline && !(candidate = processIdentity(child.pid))) await pause(10);
    if (failed || !candidate) throw new Error('receiver_spawn_failed');
    journal = { ...journal, phase: 'launching', candidate_identity: candidate, updated_at: new Date().toISOString() };
    durableJson(transitionPath(root), journal);
    if (transitionObserver) await transitionObserver('child_launched', journal);
    requireDeadline(deadline);
    journal = { ...journal, phase: 'handoff', handoff_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    durableJson(transitionPath(root), journal);
    requireDeadline(deadline);
    replaceStartupLock(root, child.pid, journal.token); childOwnsLock = true;
    if (transitionObserver) await transitionObserver('handoff', journal);
    requireDeadline(deadline);
    return await completeTransition(root, journal, deadline);
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
async function prepare({ root = rootPath(), projectDir = process.cwd(), provider = 'anthropic', role = 'orchestrator', accountingSource, disabled = false } = {}) {
  requireAttestedRuntime();
  root = path.resolve(root);
  const off = reason => ({ enabled: false, reason, unset: unsetKeys(), environment: disabledEnvironment(), codex_args: [] });
  if (disabled || process.env.SGSD_ATLAS_DISABLED === '1' || fs.existsSync(path.join(root, 'disabled'))) return off('disabled');
  try {
    const run = registerRun({ root, projectDir, provider, role, accountingSource });
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
    const transitionToken = value('--transition-token');
    const instanceId = value('--instance-id');
    const ports = {};
    for (const name of ['ingest', 'health', 'metrics']) {
      const raw = value(`--${name}-port`);
      if (raw !== undefined) { const port = Number(raw); if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('invalid_port'); ports[name] = port; }
    }
    const start = async () => {
      // The parent publishes the child's PID before the child can own the lock.
      const deadline = Date.now() + 1000;
      while (startupToken && !ownsStartup(root, startupToken) && Date.now() < deadline) await pause(20);
      return startGlobal({ root, startupToken, transitionToken, ports, instanceId });
    };
    start().then(instance => {
      let finishPromise;
      const finish = () => {
        if (!finishPromise) finishPromise = (async () => { clearInterval(monitor); await instance.close(); process.exit(0); })();
        return finishPromise;
      };
      const monitor = setInterval(() => {
        if (fs.existsSync(path.join(root, 'disabled'))) { finish(); return; }
        if (process.memoryUsage().rss > 512 * 1024 * 1024) { gap(root, 'global_memory_limit'); finish(); }
      }, 5000);
      process.on('SIGTERM', finish); process.on('SIGINT', finish);
    }).catch(() => { releaseStartup(root, startupToken); gap(root, 'global_service_failed'); process.exitCode = 1; });
  } else if (process.argv[2] === 'restart') {
    if (!process.argv.includes('--if-running')) { process.stderr.write('restart requires --if-running\n'); process.exitCode = 2; }
    else restartService({ root, trustedSourceEntry: value('--trusted-source-entry') })
      .then(result => { process.stdout.write(JSON.stringify({ status: result.status,
        runtime_fingerprint: result.service?.runtime_fingerprint || null }) + '\n'); })
      .catch(error => { process.stderr.write(`[Atlas] receiver transition failed: ${error.message}\n`); process.exitCode = 1; });
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
    prepare({ root, projectDir: value('--project-dir', process.cwd()), provider: value('--provider', 'anthropic'), role: value('--role', 'orchestrator'), accountingSource: value('--accounting-source') })
      .then(result => {
        clearTimeout(timer);
        if (!result.enabled && result.reason !== 'disabled') process.stderr.write('[Atlas] capture unavailable; run the Atlas audit\n');
        const format = value('--format', 'json');
        process.stdout.write((format === 'shell' ? shell(result) : format === 'prefix' ? shell(result, true) : JSON.stringify(result)) + '\n');
      }).catch(() => { clearTimeout(timer); gap(root, 'bootstrap_failed'); emitOff(); process.exitCode = 0; });
  }
}
module.exports = { prepare, finish, startGlobal, status, ensureService, restartService, rootPath, registerRun, getJson, shell, RUNTIME_FINGERPRINT };
}
loadedGlobalRuntime();
