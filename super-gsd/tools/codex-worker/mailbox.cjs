'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { resolveContainedPath } = require('../../scripts/lib/sgsd-state.cjs');
const { processIdentity } = require('../telemetry-atlas/lifecycle.cjs');
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ACTIVE = new Set(['starting', 'running', 'waiting_input']);
const MAX_JSON = 128 * 1024;
const DELIVERY_SCHEMA_VERSION = 1;
const PROCESS_OUTCOMES = new Set(['not_run', 'running', 'succeeded', 'failed', 'timed_out', 'interrupted', 'dead', 'identity_mismatch', 'unknown']);
const REPORT_VALIDITIES = new Set(['not_run', 'unknown', 'valid', 'invalid']);
const DELIVERY_STATES = new Set(['not_run', 'unknown', 'observed']);
const VERIFICATION_STATES = new Set(['not_run', 'unknown', 'verified', 'failed']);
const renameBackoff = new Int32Array(new SharedArrayBuffer(4));
const FANOUT_LOCK_STALE_MS = 60 * 1000;
const FANOUT_LOCK_WAIT_MS = 60 * 1000;
const FANOUT_LOCK_RETRY_MS = 10;
const uid = () => crypto.randomUUID();
function observe(record, boundary, action = null, resultStatus = null) {
  try {
    require('../../scripts/lib/atlas-observation.cjs')
      .appendWorkerEvent(record.project, record, boundary, action, resultStatus);
  } catch { /* observational IO and optional instrumentation are fail-open */ }
}
function projectRoot(project) {
  const root = fs.realpathSync(path.resolve(project));
  const planning = resolveContainedPath(root, '.planning');
  if (!planning || !fs.statSync(planning).isDirectory()) throw new Error('worker_project_unavailable');
  return root;
}
function workspaceRoot(project, workspace = project) {
  const resolved = fs.realpathSync(path.resolve(workspace));
  if (!fs.statSync(resolved).isDirectory()) throw new Error('worker_workspace_unavailable');
  if (resolveContainedPath(project, path.relative(project, resolved) || '.') === resolved) return resolved;
  // WSL PATH can select Git for Windows, which cannot resolve Linux /tmp roots.
  const git = process.platform === 'linux' && /microsoft/i.test(os.release()) && fs.existsSync('/usr/bin/git') ? '/usr/bin/git' : 'git';
  const common = root => {
    const result = spawnSync(git, ['-C', root, 'rev-parse', '--git-common-dir'], { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    if (result.status !== 0 || !result.stdout.trim()) return null;
    return fs.realpathSync(path.resolve(root, result.stdout.trim()));
  };
  const expected = common(project);
  if (!expected || common(resolved) !== expected) throw new Error('worker_workspace_not_linked');
  return resolved;
}
function target(project, relative) {
  const value = resolveContainedPath(project, path.join('.planning', 'worker-sessions', relative));
  if (!value) throw new Error('worker_path_escapes_project');
  return value;
}
function folder(project, id) {
  if (!ID.test(id || '')) throw new Error('invalid_worker_id');
  return target(project, id);
}
function atomic(file, value, exclusive = false) {
  const body = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(body) > MAX_JSON) throw new Error('worker_record_limit');
  // Publish only complete messages. Exclusive link prevents two replies winning.
  const temporary = `${file}.${uid()}.tmp`;
  fs.writeFileSync(temporary, body, { flag: 'wx', mode: 0o600 });
  try {
    if (exclusive) fs.linkSync(temporary, file);
    else for (let attempt = 0; ; attempt++) {
      try { fs.renameSync(temporary, file); break; }
      catch (error) {
        if (process.platform !== 'win32' || !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) || attempt >= 20) throw error;
        // Windows readers/indexers may briefly deny replacement. Keep atomic
        // publication; never delete the old state or fall back to partial writes.
        Atomics.wait(renameBackoff, 0, 0, 10);
      }
    }
  }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function json(file) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_JSON) throw new Error('invalid_worker_record');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function alive(pid) { try { if (!Number.isSafeInteger(pid) || pid <= 0) return false; process.kill(pid, 0); return true; } catch { return false; } }
function deliveryObservation() {
  return { schema_version: DELIVERY_SCHEMA_VERSION, process_outcome: { state: 'not_run' }, report_validity: { state: 'not_run' },
    observed_delivery: { state: 'not_run' }, independent_verification: { state: 'not_run' } };
}
function observationId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._:-]{1,256}$/.test(value) && Buffer.byteLength(value) <= 256 ? value : null;
}
function observedDelivery(value, record) {
  if (value?.state !== 'observed') return { state: DELIVERY_STATES.has(value?.state) ? value.state : 'unknown' };
  const exact = value.worker_id === record.worker_id && value.instance === record.instance
    && observationId(value.thread_id) && observationId(value.turn_id)
    && Number.isSafeInteger(value.bytes) && value.bytes >= 0 && value.bytes <= 1024 * 1024
    && typeof value.sha256 === 'string' && /^[a-f0-9]{64}$/.test(value.sha256)
    && typeof value.observed_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.observed_at);
  return exact ? { state: 'observed', worker_id: record.worker_id, instance: record.instance, thread_id: value.thread_id,
    turn_id: value.turn_id, bytes: value.bytes, sha256: value.sha256, observed_at: value.observed_at } : { state: 'unknown' };
}
function currentDeliveryObservation(record) {
  const value = record?.delivery_observation;
  if (!value || value.schema_version !== DELIVERY_SCHEMA_VERSION) return deliveryObservation();
  return { schema_version: DELIVERY_SCHEMA_VERSION,
    process_outcome: { state: PROCESS_OUTCOMES.has(value.process_outcome?.state) ? value.process_outcome.state : 'unknown' },
    report_validity: { state: REPORT_VALIDITIES.has(value.report_validity?.state) ? value.report_validity.state : 'unknown' },
    observed_delivery: observedDelivery(value.observed_delivery, record),
    independent_verification: { state: VERIFICATION_STATES.has(value.independent_verification?.state) ? value.independent_verification.state : 'unknown' } };
}
function setDeliveryField(record, field, state) {
  const permitted = field === 'process_outcome' ? PROCESS_OUTCOMES : field === 'report_validity' ? REPORT_VALIDITIES : VERIFICATION_STATES;
  if (!permitted.has(state)) throw new Error('invalid_delivery_observation_state');
  const observation = currentDeliveryObservation(record);
  observation[field] = { state };
  record.delivery_observation = observation;
  return observation;
}
function setProcessOutcome(record, state) { return setDeliveryField(record, 'process_outcome', state); }
function setReportValidity(record, state) { return setDeliveryField(record, 'report_validity', state); }
function setIndependentVerification(record, state) { return setDeliveryField(record, 'independent_verification', state); }
function observeDelivery(record, { thread_id, turn_id, report } = {}) {
  const observation = currentDeliveryObservation(record);
  const thread = observationId(thread_id), turn = observationId(turn_id);
  if (typeof report !== 'string' || Buffer.byteLength(report) > 1024 * 1024 || !thread || !turn) {
    observation.observed_delivery = { state: 'unknown' };
  } else {
    observation.observed_delivery = { state: 'observed', worker_id: record.worker_id, instance: record.instance, thread_id: thread, turn_id: turn,
      bytes: Buffer.byteLength(report), sha256: crypto.createHash('sha256').update(report, 'utf8').digest('hex'), observed_at: new Date().toISOString() };
  }
  record.delivery_observation = observation;
  return observation;
}
function identity(pid) {
  const value = processIdentity(pid);
  if (!value || value.pid !== pid || !Number.isSafeInteger(pid) || pid < 1
      || !/^[0-9]{1,32}$/.test(value.start_time || '') || typeof value.executable !== 'string' || !value.executable
      || Buffer.byteLength(value.executable) > 4096 || !Array.isArray(value.argv) || value.argv.length < 1 || value.argv.length > 64
      || value.argv.some(item => typeof item !== 'string' || !item || Buffer.byteLength(item) > 4096)
      || Buffer.byteLength(JSON.stringify(value.argv)) > 16384) return null;
  return { pid: value.pid, start_time: value.start_time, executable: value.executable, argv: [...value.argv] };
}
function liveness(record) {
  if (!identityFields(record)) return { state: 'unknown', reason: 'missing_identity' };
  const actual = identity(record.pid);
  if (!actual) return { state: 'dead' };
  return record.start_time === actual.start_time && record.executable === actual.executable
      && JSON.stringify(record.argv) === JSON.stringify(actual.argv) ? { state: 'live' } : { state: 'identity_mismatch' };
}
function identityFields(record) {
  return Number.isSafeInteger(record?.pid) && record.pid > 0 && /^[0-9]{1,32}$/.test(record.start_time || '')
    && typeof record.executable === 'string' && record.executable && Buffer.byteLength(record.executable) <= 4096
    && Array.isArray(record.argv) && record.argv.length > 0 && record.argv.length <= 64
    && record.argv.every(item => typeof item === 'string' && item && Buffer.byteLength(item) <= 4096)
    && Buffer.byteLength(JSON.stringify(record.argv)) <= 16384;
}
function isLive(record) {
  if (!ACTIVE.has(record.status)) return false;
  // Pre-upgrade records have no exact process identity. Preserve their
  // PID-only eligibility while exposing the lack of identity separately.
  return identityFields(record) ? liveness(record).state === 'live' : alive(record.pid);
}
function fanoutLimit(metadata) {
  if (!Object.hasOwn(metadata, 'fanout_limit')) return null;
  if (!Number.isSafeInteger(metadata.fanout_limit) || metadata.fanout_limit < 1) throw new Error('invalid_worker_fanout_limit');
  return metadata.fanout_limit;
}
function fanoutLockPath(project, metadata = {}) {
  const field = key => Object.hasOwn(metadata, key) ? { present: true, value: metadata[key] } : { present: false };
  const scope = JSON.stringify([field('owner'), field('workspace')]);
  return path.join(target(project, ''), `.fanout-${crypto.createHash('sha256').update(scope).digest('hex')}.lock`);
}
function lockRecord(exactIdentity) {
  return { lock_id: uid(), pid: process.pid, ...exactIdentity, created_at: new Date().toISOString() };
}
function lockAge(stat, record) {
  const created = Date.parse(record?.created_at);
  const since = Number.isFinite(created) ? created : stat.mtimeMs;
  return Date.now() - since;
}
function staleFanoutLock(file) {
  let stat;
  try {
    stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_JSON) return lockAge(stat) >= FANOUT_LOCK_STALE_MS;
    const record = json(file);
    // A valid, identity-matched creator always owns its lock, regardless of
    // age. The age fallback is only for a lock whose creator cannot be
    // identified, so it cannot remove another live creator's lock.
    if (identityFields(record)) return liveness(record).state !== 'live';
    if (alive(record?.pid)) return false;
    return lockAge(stat, record) >= FANOUT_LOCK_STALE_MS;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    return stat ? lockAge(stat) >= FANOUT_LOCK_STALE_MS : false;
  }
}
function releaseLock(file, lockId) {
  try {
    if (json(file).lock_id === lockId) fs.unlinkSync(file);
  } catch (error) {
    if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
  }
}
function reclaimFanoutLock(file, exactIdentity) {
  if (!staleFanoutLock(file)) return false;
  const reclaim = `${file}.reclaim`, claim = lockRecord(exactIdentity);
  try { atomic(reclaim, claim, true); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // A crashed reclaimer cannot block the bounded recovery path. Reclaiming
    // this guard can only coordinate disposal of the already-stale primary
    // lock; it never removes a live creator's primary lock.
    if (staleFanoutLock(reclaim)) { try { fs.unlinkSync(reclaim); } catch (unlinkError) { if (unlinkError.code !== 'ENOENT') throw unlinkError; } }
    return false;
  }
  try {
    if (!staleFanoutLock(file)) return false;
    try { fs.unlinkSync(file); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    return true;
  } finally { releaseLock(reclaim, claim.lock_id); }
}
function acquireFanoutLock(project, metadata, exactIdentity) {
  const root = target(project, ''); fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const file = fanoutLockPath(project, metadata), lock = lockRecord(exactIdentity), deadline = Date.now() + FANOUT_LOCK_WAIT_MS;
  for (;;) {
    try {
      atomic(file, lock, true);
      return () => releaseLock(file, lock.lock_id);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    reclaimFanoutLock(file, exactIdentity);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('worker_fanout_lock_timeout');
    Atomics.wait(renameBackoff, 0, 0, Math.min(FANOUT_LOCK_RETRY_MS, remaining));
  }
}
function read(project, id) {
  project = projectRoot(project);
  const record = json(path.join(folder(project, id), 'state.json'));
  if (record.schema_version !== 1 || record.worker_id !== id || record.project !== project || !Array.isArray(record.pending)) throw new Error('worker_identity_mismatch');
  return record;
}
function create(project, metadata = {}) {
  project = projectRoot(project);
  const limit = fanoutLimit(metadata), exactIdentity = identity(process.pid);
  if (process.platform === 'linux' && !exactIdentity) throw new Error('worker_identity_unavailable');
  const publish = () => {
    const record = { ...metadata, schema_version: 1, worker_id: uid(), project, pid: process.pid, ...exactIdentity,
      instance: uid(), created_at: new Date().toISOString(), status: 'starting', thread_id: null, turn_id: null, pending: [], control_results: [],
      delivery_observation: deliveryObservation() };
    const dir = folder(project, record.worker_id);
    const staging = target(project, `.creating-${record.worker_id}`);
    fs.mkdirSync(path.join(staging, 'commands'), { recursive: true, mode: 0o700 });
    fs.chmodSync(path.dirname(dir), 0o700); fs.chmodSync(staging, 0o700);
    record.updated_at = new Date().toISOString();
    atomic(path.join(staging, 'state.json'), record);
    // Inventory discovers UUID directories only after their initial record is
    // complete. Never hide missing/corrupt state in an already published worker.
    fs.renameSync(staging, dir);
    observe(record, 'create');
    return record;
  };
  if (limit === null) return publish();
  const release = acquireFanoutLock(project, metadata, exactIdentity);
  try {
    if (list(project).filter(row => isLive(row) && row.owner === metadata.owner && row.workspace === metadata.workspace).length >= limit) {
      throw new Error('worker_fanout_limit');
    }
    return publish();
  } finally { release(); }
}
function saveInternal(record, emitObservation) {
  record.updated_at = new Date().toISOString();
  atomic(path.join(folder(record.project, record.worker_id), 'state.json'), record);
  if (emitObservation) observe(record, 'save');
}
function save(record) { saveInternal(record, true); }
function list(project) {
  project = projectRoot(project); const dir = target(project, '');
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir); if (entries.length > 4096) throw new Error('worker_inventory_limit');
  return entries.filter(id => ID.test(id)).map(id => {
    const row = read(project, id);
    if (!ACTIVE.has(row.status)) return row;
    const livenessObservation = liveness(row);
    const live = isLive(row);
    if (!live) {
      const outcome = livenessObservation.state === 'dead' ? 'dead'
        : livenessObservation.state === 'identity_mismatch' ? 'identity_mismatch' : 'unknown';
      if (currentDeliveryObservation(row).process_outcome.state !== outcome) {
        setProcessOutcome(row, outcome); saveInternal(row, false);
      }
    }
    return live ? { ...row, liveness_observation: livenessObservation }
      : { ...row, status: 'orphaned', pending: [], liveness_observation: livenessObservation };
  });
}
function answerFor(request, { text, answers } = {}) {
  if (request.kind !== 'user_input') {
    if (answers !== undefined) throw new Error('unexpected_worker_answers');
    return { text: validAnswer(text) };
  }
  const ids = request.question_ids;
  if (!answers) {
    if (ids.length !== 1) throw new Error('worker_answers_required_for_each_question');
    return { answers: { [ids[0]]: validAnswer(text) } };
  }
  if (text !== undefined || typeof answers !== 'object' || Array.isArray(answers)
      || Object.keys(answers).length !== ids.length || ids.some(id => !Object.hasOwn(answers, id))) throw new Error('worker_answers_mismatch');
  return { answers: Object.fromEntries(ids.map(id => [id, validAnswer(answers[id])])) };
}
function validAnswer(value) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value) > 16384) throw new Error('invalid_worker_text');
  return value;
}
function submit(project, worker, action, { requestId, text, answers, owner } = {}) {
  const record = read(project, worker);
  if (!['reply', 'steer', 'stop'].includes(action)) throw new Error('invalid_worker_action');
  if (typeof record.owner === 'string' && record.owner) {
    const id = uid();
    const reason = typeof owner !== 'string' || !owner.trim() ? 'worker_owner_required'
      : owner !== record.owner ? 'worker_owner_mismatch' : null;
    if (reason) {
      result(record, { id, action }, 'rejected', reason);
      return { queued: false, command_id: id, worker_id: worker, status: 'rejected', reason };
    }
  }
  if (!isLive(record) || !record.turn_id) throw new Error('worker_not_active');
  let payload = {};
  if (action === 'reply') {
    const request = record.pending.find(p => p.id === requestId);
    if (!request) throw new Error('worker_request_not_pending');
    payload = answerFor(request, { text, answers });
  } else if (action === 'steer') payload = { text: validAnswer(text) };
  const dir = target(record.project, path.join(worker, 'commands'));
  if (fs.readdirSync(dir).length >= 128) throw new Error('worker_control_limit');
  const id = action === 'reply' ? requestId : uid();
  if (!ID.test(id || '')) throw new Error('invalid_worker_request');
  const message = { id, action, worker_id: worker, instance: record.instance, thread_id: record.thread_id,
    turn_id: record.turn_id, request_id: requestId || null, ...payload, created_at: new Date().toISOString() };
  atomic(path.join(dir, `${id}.json`), message, true);
  observe(record, 'submit', action);
  return { queued: true, command_id: id, worker_id: worker };
}
function result(record, command, status, reason = null) {
  record.control_results = [...(record.control_results || []).slice(-127), { id: command.id, action: command.action, status, reason, at: new Date().toISOString() }];
  saveInternal(record, false);
  observe(record, 'result', command.action, status);
}
function receipt(project, worker, command) {
  if (!ID.test(command || '')) throw new Error('invalid_worker_command');
  const record = read(project, worker), found = record.control_results?.find(c => c.id === command);
  if (found) return found;
  const file = target(record.project, path.join(worker, 'commands', `${command}.json`));
  if (!fs.existsSync(file)) throw new Error('worker_command_not_found');
  return { id: command, status: isLive(record) ? 'queued' : 'unconfirmed' };
}
function claimThread(record, thread) {
  // One adapter owns a retained thread at a time, even via older worker records.
  const dir = target(record.project, '.threads'); fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, crypto.createHash('sha256').update(thread).digest('hex') + '.json');
  try { atomic(file, { worker_id: record.worker_id, instance: record.instance, pid: record.pid }, true); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('worker_thread_already_claimed'); throw error; }
  return () => {
    // A hard-killed adapter leaves a visible claim: fail closed, never steal it.
    if (fs.existsSync(file) && json(file).instance === record.instance) fs.unlinkSync(file);
  };
}
function commands(record) {
  const dir = target(record.project, path.join(record.worker_id, 'commands'));
  const files = fs.readdirSync(dir); if (files.length > 256) throw new Error('worker_control_limit');
  return files.filter(file => /^[a-f0-9-]{36}\.json$/.test(file)).map(file => json(path.join(dir, file)));
}
module.exports = { uid, read, create, save, list, submit, commands, alive, liveness, isLive, ACTIVE, projectRoot, workspaceRoot, answerFor, result, receipt, claimThread,
  fanoutLockPath,
  deliveryObservation, observeDelivery, setProcessOutcome, setReportValidity, setIndependentVerification };
