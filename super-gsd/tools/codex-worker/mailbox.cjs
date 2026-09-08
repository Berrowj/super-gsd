'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { resolveContainedPath } = require('../../scripts/lib/sgsd-state.cjs');
const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ACTIVE = new Set(['starting', 'running', 'waiting_input']);
const MAX_JSON = 128 * 1024;
const renameBackoff = new Int32Array(new SharedArrayBuffer(4));
const uid = () => crypto.randomUUID();
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
function read(project, id) {
  project = projectRoot(project);
  const record = json(path.join(folder(project, id), 'state.json'));
  if (record.schema_version !== 1 || record.worker_id !== id || record.project !== project || !Array.isArray(record.pending)) throw new Error('worker_identity_mismatch');
  return record;
}
function create(project, metadata = {}) {
  project = projectRoot(project);
  const record = { ...metadata, schema_version: 1, worker_id: uid(), project, pid: process.pid,
    instance: uid(), created_at: new Date().toISOString(), status: 'starting', thread_id: null, turn_id: null, pending: [], control_results: [] };
  const dir = folder(project, record.worker_id);
  const staging = target(project, `.creating-${record.worker_id}`);
  fs.mkdirSync(path.join(staging, 'commands'), { recursive: true, mode: 0o700 });
  fs.chmodSync(path.dirname(dir), 0o700); fs.chmodSync(staging, 0o700);
  record.updated_at = new Date().toISOString();
  atomic(path.join(staging, 'state.json'), record);
  // Inventory discovers UUID directories only after their initial record is
  // complete. Never hide missing/corrupt state in an already published worker.
  fs.renameSync(staging, dir);
  return record;
}
function save(record) {
  record.updated_at = new Date().toISOString();
  atomic(path.join(folder(record.project, record.worker_id), 'state.json'), record);
}
function list(project) {
  project = projectRoot(project); const dir = target(project, '');
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir); if (entries.length > 4096) throw new Error('worker_inventory_limit');
  return entries.filter(id => ID.test(id)).map(id => {
    const row = read(project, id);
    return ACTIVE.has(row.status) && !alive(row.pid) ? { ...row, status: 'orphaned', pending: [] } : row;
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
  if (owner && record.owner !== owner) throw new Error('worker_owner_mismatch');
  if (!ACTIVE.has(record.status) || !alive(record.pid) || !record.turn_id) throw new Error('worker_not_active');
  if (!['reply', 'steer', 'stop'].includes(action)) throw new Error('invalid_worker_action');
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
  return { queued: true, command_id: id, worker_id: worker };
}
function result(record, command, status, reason = null) {
  record.control_results = [...(record.control_results || []).slice(-127), { id: command.id, action: command.action, status, reason, at: new Date().toISOString() }];
  save(record);
}
function receipt(project, worker, command) {
  if (!ID.test(command || '')) throw new Error('invalid_worker_command');
  const record = read(project, worker), found = record.control_results?.find(c => c.id === command);
  if (found) return found;
  const file = target(record.project, path.join(worker, 'commands', `${command}.json`));
  if (!fs.existsSync(file)) throw new Error('worker_command_not_found');
  return { id: command, status: ACTIVE.has(record.status) && alive(record.pid) ? 'queued' : 'unconfirmed' };
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
module.exports = { uid, read, create, save, list, submit, commands, alive, ACTIVE, projectRoot, workspaceRoot, answerFor, result, receipt, claimThread };
