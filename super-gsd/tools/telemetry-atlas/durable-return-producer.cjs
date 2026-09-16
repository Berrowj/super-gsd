'use strict';

// Minimum producer bridge for existing durable records. It copies only typed
// metadata and artifact pointers; it never forwards model text or creates work.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { safeAppend } = require('./contract.cjs');

const HEX = /^[a-f0-9]{64}$/;
const ATOM = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MAX_LINE = 512 * 1024;
const CHUNK = 64 * 1024;
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const registrationHash = (file, lane) => digest(`sgsd-durable-source:v1:${path.resolve(file)}:${lane}`);
const atom = value => typeof value === 'string' && ATOM.test(value) ? value : null;

function fileHash(file) {
  const info = fs.lstatSync(file); if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('producer_artifact_unreadable');
  const fd = fs.openSync(file, 'r'), hash = crypto.createHash('sha256'), buffer = Buffer.alloc(CHUNK);
  try { let read; while ((read = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) hash.update(buffer.subarray(0, read)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}

function readJsonBounded(file, limit = MAX_LINE) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > limit) throw new Error('producer_inbox_unreadable');
  const fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(info.size);
  try { fs.readSync(fd, buffer, 0, info.size, 0); } finally { fs.closeSync(fd); }
  return JSON.parse(buffer.toString('utf8'));
}

function atomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`, body = JSON.stringify(value) + '\n';
  fs.writeFileSync(temp, body, { flag: 'wx', mode: 0o600 });
  try { fs.renameSync(temp, file); } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function loadState(file) {
  try { const value = JSON.parse(fs.readFileSync(file, 'utf8')); if (value?.schema_version !== 1 || !Array.isArray(value.seen)) throw new Error('producer_state_invalid'); return value; }
  catch (error) { if (error.code === 'ENOENT') return { schema_version: 1, seen: [], cursors: {} }; throw error; }
}

function writeOnce(output, state, event) {
  if (state.seen.includes(event.event_id)) return false;
  safeAppend(output, event); state.seen = [...state.seen.slice(-4095), event.event_id]; atomic(`${output}.producer-state.json`, state); return true;
}

function readLine(file, start, size) {
  const fd = fs.openSync(file, 'r'), pieces = []; let position = start, length = 0, tooLarge = false;
  try {
    while (position < size) {
      const chunk = Buffer.alloc(Math.min(CHUNK, size - position)), read = fs.readSync(fd, chunk, 0, chunk.length, position);
      if (!read) break;
      const view = chunk.subarray(0, read), newline = view.indexOf(0x0a), count = newline < 0 ? read : newline;
      length += count; if (length > MAX_LINE) tooLarge = true; else if (count) pieces.push(view.subarray(0, count));
      position += newline < 0 ? read : newline + 1;
      if (newline >= 0) return { end: position, tooLarge, bytes: tooLarge ? null : Buffer.concat(pieces, length) };
    }
    return { partial: true };
  } finally { fs.closeSync(fd); }
}

function artifact(file) { return { artifact_path: path.resolve(file), artifact_sha256: fileHash(file) }; }

function baseEvent({ eventId, kind, lane, plan, task, sourceOwner, route, owner, ownerEpoch, sourcePath, sourceSha, observedAt, disposition, nextAction, pointer, artifactPath, artifactSha, targetWorkerId }) {
  if (![eventId, lane, plan, task, sourceOwner, route, owner, ownerEpoch].every(atom) || !ATOM.test(eventId || '')
      || !['question', 'return', 'ready'].includes(kind) || !HEX.test(sourceSha || '') || !HEX.test(artifactSha || '')
      || !path.isAbsolute(sourcePath) || !path.isAbsolute(artifactPath) || !['executing', 'awaiting_named_dependency', 'completed', 'delivered'].includes(disposition)
      || !['wake_owner', 'await_dependency', 'none'].includes(nextAction)) return null;
  const event = { event_id: eventId, kind, lane, plan, task, source_owner: sourceOwner, route, owner, owner_epoch: ownerEpoch,
    source_path: path.resolve(sourcePath), source_sha256: sourceSha, observed_at: observedAt, disposition, next_action: nextAction,
    artifact_path: path.resolve(artifactPath), artifact_sha256: artifactSha };
  if (targetWorkerId) event.target_worker_id = targetWorkerId;
  if (nextAction === 'wake_owner') event.pointer = pointer;
  return event;
}

function createDurableReturnProducer({ mailbox = null, now = () => new Date().toISOString() } = {}) {
  function projectMailbox({ project, workerId, owner, ownerEpoch, lane, outputPath, plan = null, task = null } = {}) {
    if (!mailbox?.read || !UUID.test(workerId || '') || !ATOM.test(owner || '') || !ATOM.test(ownerEpoch || '') || !ATOM.test(lane || '') || !path.isAbsolute(outputPath)) throw new Error('producer_mailbox_config_invalid');
    const record = mailbox.read(project, workerId), statePath = path.join(record.project, '.planning', 'worker-sessions', workerId, 'state.json');
    const sourceSha = registrationHash(outputPath, lane), stateFile = `${outputPath}.producer-state.json`, state = loadState(stateFile), emitted = [];
    const common = { lane, sourcePath: outputPath, sourceSha, owner, ownerEpoch, plan: atom(plan || record.plan), task: atom(task || record.step || record.task), sourceOwner: `worker.${workerId}`, route: 'worker_to_pm', observedAt: now() };
    if (!common.plan || !common.task) return { emitted: 0, skipped: 1, reason: 'mailbox_plan_task_unavailable' };
    for (const request of Array.isArray(record.pending) ? record.pending : []) {
      if (!atom(request.id)) continue;
      const info = artifact(statePath);
      const row = baseEvent({ ...common, eventId: digest(['worker_question', workerId, record.instance, request.id]), kind: 'question', disposition: 'awaiting_named_dependency', nextAction: 'wake_owner', pointer: `Worker question: ${workerId}/${request.id}.`, artifactPath: info.artifact_path, artifactSha: info.artifact_sha256 });
      if (row && writeOnce(outputPath, state, row)) emitted.push(row.event_id);
    }
    const resultPath = path.join(record.project, '.planning', 'worker-sessions', workerId, 'wrapper-result.json');
    if (fs.existsSync(resultPath)) {
      const info = artifact(resultPath);
      const row = baseEvent({ ...common, eventId: digest(['worker_return', workerId, record.instance, info.artifact_sha256]), kind: 'return', disposition: 'completed', nextAction: 'wake_owner', pointer: `Worker return: ${workerId}/wrapper-result.json.`, artifactPath: info.artifact_path, artifactSha: info.artifact_sha256 });
      if (row && writeOnce(outputPath, state, row)) emitted.push(row.event_id);
    }
    atomic(stateFile, state); return { emitted: emitted.length, event_ids: emitted, output_path: outputPath };
  }

  function projectLedger({ inputPath, outputPath, lane, sourceOwner, route, owner, ownerEpoch, defaultKind = 'return' } = {}) {
    if (![inputPath, outputPath].every(path.isAbsolute) || !ATOM.test(lane || '') || !ATOM.test(sourceOwner || '') || !ATOM.test(route || '') || !ATOM.test(owner || '') || !ATOM.test(ownerEpoch || '')) throw new Error('producer_ledger_config_invalid');
    const info = fs.lstatSync(inputPath); if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('producer_ledger_unreadable');
    const stateFile = `${outputPath}.producer-state.json`, state = loadState(stateFile), key = path.resolve(inputPath), cursor = state.cursors[key] || { dev: info.dev, ino: info.ino, offset: 0 };
    if (cursor.dev !== info.dev || cursor.ino !== info.ino || info.size < cursor.offset) throw new Error('producer_ledger_rewritten');
    const sourceSha = registrationHash(outputPath, lane), emitted = [], skipped = [];
    while (cursor.offset < info.size) {
      const line = readLine(inputPath, cursor.offset, info.size); if (line.partial) break; cursor.offset = line.end;
      if (line.tooLarge) { skipped.push('record_too_large'); continue; }
      let input; try { input = JSON.parse(line.bytes.toString('utf8')); } catch { skipped.push('record_malformed'); continue; }
      const kind = input.kind || defaultKind, eventId = atom(input.event_id || input.id), observedAt = input.observed_at || input.at;
      const artifactPath = input.artifact_path, artifactSha = input.artifact_sha256 || input.sha256, pointer = input.pointer;
      const row = baseEvent({ eventId, kind, lane, plan: atom(input.plan), task: atom(input.task), sourceOwner, route, owner, ownerEpoch,
        sourcePath: outputPath, sourceSha, observedAt, disposition: input.disposition, nextAction: input.next_action || 'wake_owner', pointer,
        artifactPath, artifactSha, targetWorkerId: input.target_worker_id });
      if (!row) { skipped.push('record_contract_invalid'); continue; }
      if (writeOnce(outputPath, state, row)) emitted.push(row.event_id);
    }
    state.cursors[key] = cursor; atomic(stateFile, state); return { emitted: emitted.length, skipped, output_path: outputPath, input_path: inputPath };
  }

  function projectInbox({ inputPath, outputPath, lane = 'root', sourceOwner = 'root', route = 'root_to_pm', owner, ownerEpoch, plan, task } = {}) {
    if (![inputPath, outputPath].every(path.isAbsolute) || !ATOM.test(lane) || !ATOM.test(sourceOwner)
        || !ATOM.test(route) || !ATOM.test(owner || '') || !ATOM.test(ownerEpoch || '') || !ATOM.test(plan || '') || !ATOM.test(task || '')) {
      throw new Error('producer_inbox_config_invalid');
    }
    const row = readJsonBounded(inputPath);
    const eventId = atom(row.event_id), observedAt = row.observed_at, sourcePath = row.source_path, sourceSha = row.source_hash;
    if (!eventId || !sourcePath || !path.isAbsolute(sourcePath) || !HEX.test(sourceSha || '') || typeof observedAt !== 'string') {
      throw new Error('producer_inbox_shape_invalid');
    }
    if (fileHash(sourcePath) !== sourceSha) throw new Error('producer_inbox_artifact_mismatch');
    const stateFile = `${outputPath}.producer-state.json`, state = loadState(stateFile), info = artifact(sourcePath);
    const event = baseEvent({ eventId, kind: 'return', lane, plan, task, sourceOwner, route, owner, ownerEpoch,
      sourcePath: outputPath, sourceSha: registrationHash(outputPath, lane), observedAt, disposition: 'completed', nextAction: 'wake_owner',
      pointer: `Root inbox: ${path.basename(inputPath)}.`, artifactPath: info.artifact_path, artifactSha: info.artifact_sha256 });
    if (!event) throw new Error('producer_inbox_contract_invalid');
    const emitted = writeOnce(outputPath, state, event) ? 1 : 0;
    atomic(stateFile, state);
    return { emitted, event_ids: emitted ? [eventId] : [], output_path: outputPath, input_path: inputPath };
  }
  return Object.freeze({ projectMailbox, projectLedger, projectInbox, registrationHash });
}

module.exports = Object.freeze({ createDurableReturnProducer, registrationHash, fileHash, readLine, readJsonBounded });
