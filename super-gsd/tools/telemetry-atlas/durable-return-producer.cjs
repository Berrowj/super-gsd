'use strict';

// Minimum producer bridge for existing durable records. It copies only typed
// metadata and artifact pointers; it never forwards model text or creates work.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { safeAppend } = require('./contract.cjs');
const { readNativeProcess } = require('../codex-worker/native-process.cjs');

const HEX = /^[a-f0-9]{64}$/;
const ATOM = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const PANE = /^%[0-9]+$/;
const WINDOW = /^@[0-9]+$/;
const PMS = new Set(['pm-delivery', 'pm-automation']);
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

function readPrefix(file, length) {
  if (!length) return Buffer.alloc(0);
  const fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(length);
  try { let offset = 0, read; while (offset < length && (read = fs.readSync(fd, buffer, offset, length - offset, offset)) > 0) offset += read; return buffer.subarray(0, offset); }
  finally { fs.closeSync(fd); }
}

function sourceSnapshot(file, prior = null) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('producer_native_source_unreadable');
  const prefixLength = Number.isSafeInteger(prior?.prefix_length) ? prior.prefix_length : Math.min(info.size, 4096);
  return { dev: info.dev, ino: info.ino, size: info.size, mtime_ms: info.mtimeMs, prefix_length: prefixLength,
    prefix_sha256: digest(readPrefix(file, prefixLength)) };
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

  function projectLedger({ inputPath, outputPath, lane, sourceOwner, route, owner, ownerEpoch, defaultKind = 'return', coordinationDir, plan: defaultPlan, task: defaultTask } = {}) {
    if (![inputPath, outputPath].every(path.isAbsolute) || !ATOM.test(lane || '') || !ATOM.test(sourceOwner || '') || !ATOM.test(route || '') || !ATOM.test(owner || '') || !ATOM.test(ownerEpoch || '')) throw new Error('producer_ledger_config_invalid');
    const info = fs.lstatSync(inputPath); if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('producer_ledger_unreadable');
    const stateFile = `${outputPath}.producer-state.json`, state = loadState(stateFile), key = path.resolve(inputPath), cursor = state.cursors[key] || { dev: info.dev, ino: info.ino, offset: 0 };
    if (cursor.dev !== info.dev || cursor.ino !== info.ino || info.size < cursor.offset) throw new Error('producer_ledger_rewritten');
    const sourceSha = registrationHash(outputPath, lane), emitted = [], skipped = [];
    while (cursor.offset < info.size) {
      const line = readLine(inputPath, cursor.offset, info.size); if (line.partial) break; cursor.offset = line.end;
      if (line.tooLarge) { skipped.push('record_too_large'); continue; }
      let input; try { input = JSON.parse(line.bytes.toString('utf8')); } catch { skipped.push('record_malformed'); continue; }
      const deployShape = input && typeof input === 'object' && input.request && input.receipt && input.at;
      let row;
      if (deployShape) {
        const base = path.resolve(path.isAbsolute(coordinationDir || '') ? coordinationDir : path.dirname(inputPath));
        const receipt = typeof input.receipt === 'string' ? path.resolve(base, input.receipt) : null;
        if (!receipt || (receipt !== base && !receipt.startsWith(`${base}${path.sep}`)) || !fs.existsSync(receipt)) { skipped.push('record_artifact_unavailable'); continue; }
        const info = artifact(receipt);
        row = baseEvent({ eventId: atom(input.request || input.event), kind: defaultKind, lane, plan: atom(defaultPlan || input.plan), task: atom(defaultTask || input.task), sourceOwner, route, owner, ownerEpoch,
          sourcePath: outputPath, sourceSha, observedAt: input.at, disposition: 'completed', nextAction: 'wake_owner', pointer: `Deploy receipt: ${path.relative(base, receipt)}.`,
          artifactPath: info.artifact_path, artifactSha: info.artifact_sha256 });
      } else {
        const kind = input.kind || defaultKind, eventId = atom(input.event_id || input.id), observedAt = input.observed_at || input.at;
        const artifactPath = input.artifact_path, artifactSha = input.artifact_sha256 || input.sha256, pointer = input.pointer;
        row = baseEvent({ eventId, kind, lane, plan: atom(input.plan), task: atom(input.task), sourceOwner, route, owner, ownerEpoch,
          sourcePath: outputPath, sourceSha, observedAt, disposition: input.disposition, nextAction: input.next_action || 'wake_owner', pointer,
          artifactPath, artifactSha, targetWorkerId: input.target_worker_id });
      }
      if (!row) { skipped.push('record_contract_invalid'); continue; }
      if (writeOnce(outputPath, state, row)) emitted.push(row.event_id);
    }
    state.cursors[key] = cursor; atomic(stateFile, state); return { emitted: emitted.length, skipped, output_path: outputPath, input_path: inputPath };
  }

  function projectInbox({ inputPath, outputPath, lane = 'root', sourceOwner = 'root', route = 'root_to_pm', owner, ownerEpoch, ownerEpochByOwner = {}, plan, task } = {}) {
    if (![inputPath, outputPath].every(path.isAbsolute) || !ATOM.test(lane) || !ATOM.test(sourceOwner)
        || !ATOM.test(route) || (owner !== undefined && !ATOM.test(owner)) || (!ownerEpoch && !ownerEpochByOwner)
        || (ownerEpoch !== undefined && !ATOM.test(ownerEpoch)) || !ATOM.test(plan || '') && plan !== undefined || !ATOM.test(task || '') && task !== undefined) {
      throw new Error('producer_inbox_config_invalid');
    }
    const row = readJsonBounded(inputPath);
    const targetOwner = owner || row.owner, targetEpoch = ownerEpoch || ownerEpochByOwner[targetOwner], targetPlan = plan || row.plan, targetTask = task || row.task;
    const eventId = atom(row.event_id), observedAt = row.observed_at, sourcePath = row.source_path, sourceSha = row.source_hash || row.source_sha256;
    if (!eventId || !sourcePath || !path.isAbsolute(sourcePath) || !HEX.test(sourceSha || '') || typeof observedAt !== 'string') {
      throw new Error('producer_inbox_shape_invalid');
    }
    if (!PMS.has(targetOwner || '') || !ATOM.test(targetEpoch || '') || !ATOM.test(targetPlan || '') || !ATOM.test(targetTask || '')
        || (owner && row.owner && row.owner !== owner)
        || !['question', 'result', 'question_or_result'].some(key => Object.hasOwn(row, key))) throw new Error('producer_inbox_shape_invalid');
    if (fileHash(sourcePath) !== sourceSha) throw new Error('producer_inbox_artifact_mismatch');
    const stateFile = `${outputPath}.producer-state.json`, state = loadState(stateFile), info = artifact(sourcePath);
    const event = baseEvent({ eventId, kind: 'return', lane, plan: targetPlan, task: targetTask, sourceOwner, route, owner: targetOwner, ownerEpoch: targetEpoch,
      sourcePath: outputPath, sourceSha: registrationHash(outputPath, lane), observedAt: new Date(observedAt).toISOString(), disposition: 'completed', nextAction: 'wake_owner',
      pointer: `Root inbox: ${path.basename(inputPath)}.`, artifactPath: info.artifact_path, artifactSha: info.artifact_sha256 });
    if (!event) throw new Error('producer_inbox_contract_invalid');
    const emitted = writeOnce(outputPath, state, event) ? 1 : 0;
    atomic(stateFile, state);
    return { emitted, event_ids: emitted ? [eventId] : [], output_path: outputPath, input_path: inputPath };
  }
  function projectInboxDirectory({ inputDir, outputPath, lane = 'root', sourceOwner = 'root', route = 'root_to_pm', ownerEpochByOwner = {}, ownerEpoch, plan, task, maxFiles = 1024 } = {}) {
    if (!path.isAbsolute(inputDir) || !path.isAbsolute(outputPath)) throw new Error('producer_inbox_directory_config_invalid');
    const stateFile = `${outputPath}.producer-state.json`, entries = fs.readdirSync(inputDir).filter(name => name.endsWith('.json')).sort().slice(0, maxFiles);
    const emitted = [], skipped = [];
    for (const name of entries) {
      const inputPath = path.join(inputDir, name);
      try {
        const result = projectInbox({ inputPath, outputPath, lane, sourceOwner, route, ownerEpochByOwner, ownerEpoch, plan, task });
        emitted.push(...(result.event_ids || []));
      } catch (error) { skipped.push({ file: inputPath, reason: error.message }); }
    }
    const state = loadState(stateFile);
    state.cursors[`inbox:${path.resolve(inputDir)}`] = { entries, observed_at: now() }; atomic(stateFile, state);
    return { emitted: emitted.length, event_ids: emitted, skipped, discovered: entries.length, input_dir: inputDir, output_path: outputPath };
  }
  function projectNativePrimary({ inputPath, outputPath, lane, sourceOwner, owner, ownerEpoch, plan, task, identity, rolloutId = identity?.thread, primary = true, processReader = readNativeProcess } = {}) {
    if (![inputPath, outputPath].every(path.isAbsolute) || !primary || !PMS.has(owner || '') || !ATOM.test(sourceOwner || '') || !ATOM.test(ownerEpoch || '') || !ATOM.test(plan || '') || !ATOM.test(task || '')) throw new Error('producer_native_config_invalid');
    if (!identity || !Number.isSafeInteger(identity.pid) || !ATOM.test(String(identity.start || '')) || !Number.isSafeInteger(identity.pane_pid)
        || !ATOM.test(String(identity.pane_start || '')) || !path.isAbsolute(identity.cwd) || identity.runtime !== 'codex'
        || !ATOM.test(identity.session || '') || !PANE.test(identity.pane || '') || (identity.window !== undefined && !WINDOW.test(identity.window))
        || !ATOM.test(identity.thread || '') || identity.thread !== rolloutId) throw new Error('producer_native_config_invalid');
    const actual = processReader(identity.pid, identity.cwd);
    if (!actual || String(actual.start_time) !== String(identity.start) || actual.cwd !== identity.cwd) throw new Error('producer_native_identity_mismatch');
    const info = sourceSnapshot(inputPath), stateFile = `${outputPath}.producer-state.json`, state = loadState(stateFile), key = `native:${path.resolve(inputPath)}`;
    const prior = state.cursors[key];
    if (prior && (prior.dev !== info.dev || prior.ino !== info.ino || info.size < prior.offset || prior.prefix_sha256 !== info.prefix_sha256)) throw new Error('producer_native_source_rewritten');
    const header = readLine(inputPath, 0, info.size); if (header.partial) throw new Error('producer_native_header_incomplete');
    let envelope; try { envelope = JSON.parse(header.bytes.toString('utf8')); } catch { throw new Error('producer_native_header_invalid'); }
    const payload = envelope.payload || {};
    if (envelope.type !== 'session_meta' || payload.source !== 'cli' || payload.originator !== 'codex-tui' || payload.thread_source !== 'user'
        || payload.cwd !== identity.cwd || payload.id !== rolloutId) throw new Error('producer_native_primary_unverified');
    const cursor = prior || { ...info, offset: 0 }, emitted = [], skipped = [];
    while (cursor.offset < info.size) {
      const line = readLine(inputPath, cursor.offset, info.size); if (line.partial) break; cursor.offset = line.end;
      if (line.tooLarge) { skipped.push('record_too_large'); state.cursors[key] = { ...info, offset: cursor.offset }; atomic(stateFile, state); continue; }
      let record; try { record = JSON.parse(line.bytes.toString('utf8')); } catch { skipped.push('record_malformed'); state.cursors[key] = { ...info, offset: cursor.offset }; atomic(stateFile, state); continue; }
      const p = record.payload || {}, completion = record.type === 'event_msg' && p.type === 'task_complete';
      const question = record.type === 'event_msg' && p.type === 'approval_requested' || record.type === 'response_item'
        && ['function_call', 'custom_tool_call'].includes(p.type) && p.name === 'request_user_input';
      if (!completion && !question) { state.cursors[key] = { ...info, offset: cursor.offset }; atomic(stateFile, state); continue; }
      const turn = p.turn_id || record.turn_id, explicitThread = p.thread_id || record.thread_id;
      if (!ATOM.test(turn || '') || (explicitThread && explicitThread !== identity.thread) || typeof record.timestamp !== 'string' || !Number.isFinite(Date.parse(record.timestamp))) { skipped.push('record_identity_invalid'); state.cursors[key] = { ...info, offset: cursor.offset }; atomic(stateFile, state); continue; }
      const kind = completion ? 'return' : 'question', evidence = { timestamp: record.timestamp, ordinal: record.ordinal, type: record.type, payload_type: p.type, id: p.id, name: p.name, call_id: p.call_id, turn_id: turn, thread_id: explicitThread || identity.thread };
      const event = baseEvent({ eventId: digest(['native-primary-v1', inputPath, record.ordinal, kind, turn, p.id, p.call_id]), kind, lane, plan, task,
        sourceOwner, route: 'native_to_pm', owner, ownerEpoch, sourcePath: outputPath, sourceSha: registrationHash(outputPath, lane), observedAt: new Date(record.timestamp).toISOString(),
        disposition: completion ? 'completed' : 'awaiting_named_dependency', nextAction: 'wake_owner', pointer: `Native ${kind}: ${path.basename(inputPath)}#${record.ordinal}.`, artifactPath: inputPath, artifactSha: digest(evidence) });
      if (!event) skipped.push('record_contract_invalid'); else if (writeOnce(outputPath, state, event)) emitted.push(event.event_id);
      state.cursors[key] = { ...info, offset: cursor.offset }; atomic(stateFile, state);
    }
    state.cursors[key] = { ...info, offset: cursor.offset }; atomic(stateFile, state);
    return { emitted: emitted.length, event_ids: emitted, skipped, input_path: inputPath, output_path: outputPath, cursor: state.cursors[key] };
  }
  return Object.freeze({ projectMailbox, projectLedger, projectInbox, projectInboxDirectory, projectNativePrimary, registrationHash });
}

module.exports = Object.freeze({ createDurableReturnProducer, registrationHash, fileHash, readLine, readJsonBounded });
