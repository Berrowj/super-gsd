'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { readJson, readRun, writeJson } = require('./global-store.cjs');
const { privateDirectory } = require('./quota-sampler.cjs');
const { safePath, digest } = require('./contract.cjs');

const SCOPE = 'supervised_coordination';
const ACCOUNTING_SOURCE = 'supervised_coordination';
const COORDINATION_RUN = /^coord-[a-f0-9-]{36}$/;
const COORDINATION_ROLES = new Set(['pm-delivery', 'pm-automation', 'deploy']);
const COORDINATION_NAMES = new Map([['pm-delivery', 'PM Delivery'], ['pm-automation', 'PM Automation'], ['deploy', 'Deploy']]);
const BOOT_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const NATIVE_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const MAX_ROLLOUT_BYTES = 512 * 1024 * 1024;
const fail = reason => { throw new Error(reason); };

function ownedFile(file, limit) {
  safePath(file);
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || (process.getuid && info.uid !== process.getuid()) || info.size > limit) return false;
  return true;
}

function coordinationFiles(directory, role) {
  const requested = path.resolve(directory); safePath(path.join(requested, '.coordination-directory-check'));
  if (fs.lstatSync(requested).isSymbolicLink()) fail('coordination_directory_unowned');
  directory = fs.realpathSync(requested);
  const dir = fs.lstatSync(directory);
  if (!dir.isDirectory() || dir.isSymbolicLink() || dir.nlink < 1 || (process.getuid && dir.uid !== process.getuid())) fail('coordination_directory_unowned');
  const charter = path.join(directory, 'CHARTER.md'), assignment = path.join(directory, 'ASSIGNMENT.json');
  if (!ownedFile(charter, 128 * 1024)) fail('coordination_authority_missing');
  if (!fs.readFileSync(charter, 'utf8').trim()) fail('coordination_charter_invalid');
  if (role === 'deploy') {
    const current = path.join(directory, 'CURRENT.md');
    if (!ownedFile(current, 128 * 1024)) fail('coordination_authority_missing');
    const charterText = fs.readFileSync(charter, 'utf8'), currentText = fs.readFileSync(current, 'utf8');
    if (!/single release owner/i.test(charterText)) fail('coordination_charter_invalid');
    const match = /^Owner:\s+deploy\s+\((?:`([^`\r\n]+)`|([A-Za-z0-9._:-]{1,160}))\)/m.exec(currentText);
    const epoch = match?.[1] || match?.[2];
    if (!epoch || !NATIVE_ID.test(epoch)) fail('coordination_epoch_invalid');
    return { directory, charter, current, assignment: null, assignmentValue: null, epoch };
  }
  if (!COORDINATION_ROLES.has(role) || role === 'deploy' || !ownedFile(assignment, 64 * 1024)) fail('coordination_authority_missing');
  let value;
  try { value = JSON.parse(fs.readFileSync(assignment, 'utf8')); } catch { fail('coordination_assignment_invalid'); }
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.name !== 'string'
      || typeof value.title !== 'string' || !NATIVE_ID.test(value.session || '')
      || !Number.isSafeInteger(value.index) || value.index < 0 || !Array.isArray(value.workers)) fail('coordination_assignment_invalid');
  if (value.name !== role || value.title !== COORDINATION_NAMES.get(role)) fail('coordination_assignment_mismatch');
  return { directory, charter, assignment, assignmentValue: value, epoch: value.session };
}

function validCoordinationBinding(value, expected = {}) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 17
    && Object.keys(value).every(key => ['schema_version', 'scope', 'provider', 'accounting_source', 'coordination_id',
      'coordination_dir', 'authority_epoch', 'role', 'pid', 'start_time', 'boot_id', 'executable', 'cwd', 'session_id', 'thread_id',
      'rollout_descriptor', 'cursor_seed'].includes(key))
    && value.schema_version === 1 && value.scope === SCOPE && value.provider === 'openai'
    && value.accounting_source === ACCOUNTING_SOURCE && /^[a-f0-9]{64}$/.test(value.coordination_id || '')
    && NATIVE_ID.test(value.authority_epoch || '')
    && COORDINATION_ROLES.has(value.role) && typeof value.coordination_dir === 'string'
    && path.isAbsolute(value.coordination_dir) && !/[\x00-\x1f\x7f]/.test(value.coordination_dir)
    && typeof value.cwd === 'string' && value.cwd === value.coordination_dir
    && NATIVE_ID.test(value.session_id || '') && NATIVE_ID.test(value.thread_id || '')
    && Number.isSafeInteger(value.pid) && value.pid > 0 && value.pid <= 2147483647
    && typeof value.start_time === 'string' && /^\d{1,32}$/.test(value.start_time)
    && BOOT_ID.test(value.boot_id || '') && typeof value.executable === 'string' && path.isAbsolute(value.executable)
    && !/[\x00-\x1f\x7f]/.test(value.executable)
    && validRolloutDescriptor(value.rollout_descriptor)
    && validCursorSeed(value.cursor_seed, value.rollout_descriptor)
    && (expected.coordination_id === undefined || value.coordination_id === expected.coordination_id)
    && (expected.coordination_dir === undefined || value.coordination_dir === expected.coordination_dir)
    && (expected.authority_epoch === undefined || value.authority_epoch === expected.authority_epoch)
    && (expected.role === undefined || value.role === expected.role);
}

function validRolloutDescriptor(value) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 4
    && Object.keys(value).every(key => ['schema_version', 'path', 'dev', 'ino'].includes(key)) && value.schema_version === 1
    && typeof value.path === 'string' && path.isAbsolute(value.path) && !/[\x00-\x1f\x7f]/.test(value.path)
    && Number.isSafeInteger(value.dev) && value.dev >= 0 && Number.isSafeInteger(value.ino) && value.ino >= 0;
}

function validCursorSeed(value, descriptor) {
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 9
    && Object.keys(value).every(key => ['schema_version', 'path', 'dev', 'ino', 'offset', 'last_response_id', 'last_event_id', 'seen_event_ids', 'seen_response_ids'].includes(key))
    && value.schema_version === 1 && validRolloutDescriptor({ schema_version: 1, path: value.path, dev: value.dev, ino: value.ino })
    && (!descriptor || value.path === descriptor.path && value.dev === descriptor.dev && value.ino === descriptor.ino)
    && Number.isSafeInteger(value.offset) && value.offset >= 0 && (value.last_response_id === null || NATIVE_ID.test(value.last_response_id))
    && (value.last_event_id === null || NATIVE_ID.test(value.last_event_id)) && Array.isArray(value.seen_event_ids)
    && Array.isArray(value.seen_response_ids) && value.seen_event_ids.every(item => NATIVE_ID.test(item))
    && value.seen_response_ids.every(item => NATIVE_ID.test(item));
}

function rolloutDescriptor(file) {
  file = path.resolve(file); safePath(file);
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || (process.getuid && info.uid !== process.getuid())
      || info.size > MAX_ROLLOUT_BYTES) fail('coordination_rollout_invalid');
  return { schema_version: 1, path: file, dev: info.dev, ino: info.ino };
}

function sameCoordinationBinding(left, right) {
  return ['scope', 'provider', 'accounting_source', 'coordination_id', 'coordination_dir', 'authority_epoch', 'role', 'pid', 'start_time',
    'boot_id', 'executable', 'cwd', 'session_id', 'thread_id'].every(key => left[key] === right[key]);
}

function readCoordination(root, runId) {
  if (!COORDINATION_RUN.test(runId || '')) return null;
  try {
    const run = readJson(path.join(root, 'coordination-runs', runId, 'registration.json'), 65536);
    if (run.schema_version !== 1 || run.run_id !== runId || run.scope !== SCOPE || run.provider !== 'openai'
        || run.accountingSource !== ACCOUNTING_SOURCE || typeof run.registered_at !== 'string' || !Number.isFinite(Date.parse(run.registered_at))
        || !COORDINATION_NAMES.has(run.role) || !/^[a-f0-9]{64}$/.test(run.coordination_id || '')
        || digest(run.coordination_dir) !== run.coordination_id || !validCoordinationBinding(run.native_binding, {
          coordination_id: run.coordination_id, coordination_dir: run.coordination_dir, authority_epoch: run.authority_epoch, role: run.role })
        || coordinationFiles(run.coordination_dir, run.role).epoch !== run.authority_epoch) return null;
  return Object.freeze({ ...run, state_dir: path.join(root, 'coordination-runs', runId) });
  } catch { return null; }
}

function resolveNativeAuthority(root, runId) {
  const coordination = readCoordination(root, runId);
  if (coordination) return Object.freeze({ scope: SCOPE, run_id: coordination.run_id, role: coordination.role,
    provider: coordination.provider, accountingSource: coordination.accountingSource, native_binding: coordination.native_binding,
    state_dir: coordination.state_dir, source_hash: coordination.coordination_id, coordination_id: coordination.coordination_id,
    coordination_dir: coordination.coordination_dir, project_id: null, project_dir: null,
    ledger_dir: path.join(path.resolve(root), 'coordination-ledger', coordination.coordination_id), association: SCOPE });
  const run = readRun(root, runId);
  if (run) {
    return Object.freeze({ scope: 'sgsd_project', run_id: run.run_id, role: run.role, provider: run.provider,
      accountingSource: run.accountingSource, native_binding: run.native_binding, state_dir: run.state_dir,
      source_hash: run.project_id, coordination_id: null, coordination_dir: null, project_id: run.project_id,
      project_dir: run.project_dir, ledger_dir: run.metrics_dir, association: 'launcher_registration' });
  }
  return null;
}

function existingCoordination(root, binding) {
  const directory = path.join(root, 'coordination-runs');
  safePath(path.join(directory, '.coordination-read-check'));
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).slice(0, 10000).filter(name => COORDINATION_RUN.test(name))
    .map(name => readCoordination(root, name)).filter(run => run && (run.native_binding.session_id === binding.session_id
      && run.native_binding.thread_id === binding.thread_id
      || run.native_binding.pid === binding.pid && run.native_binding.start_time === binding.start_time
      && run.native_binding.boot_id === binding.boot_id));
}

function registerCoordination({ root, coordinationDir, role, provider = 'openai', pid, startTime, bootId, executable, cwd, sessionId, threadId, rolloutPath }) {
  if (provider !== 'openai' || !COORDINATION_ROLES.has(role)) fail('invalid_coordination_scope');
  const authority = coordinationFiles(coordinationDir, role);
  const descriptor = rolloutDescriptor(rolloutPath);
  const stat = fs.statSync(descriptor.path);
  const cursor_seed = { schema_version: 1, path: descriptor.path, dev: descriptor.dev, ino: descriptor.ino, offset: stat.size,
    last_response_id: null, last_event_id: null, seen_event_ids: [], seen_response_ids: [] };
  const coordinationId = digest(authority.directory);
  const native_binding = { schema_version: 1, scope: SCOPE, provider, accounting_source: ACCOUNTING_SOURCE,
    coordination_id: coordinationId, coordination_dir: authority.directory, authority_epoch: authority.epoch, role, pid, start_time: startTime,
    boot_id: bootId, executable, cwd: cwd || authority.directory, session_id: sessionId, thread_id: threadId,
    rollout_descriptor: descriptor, cursor_seed };
  if (!validCoordinationBinding(native_binding, { coordination_id: coordinationId, coordination_dir: authority.directory,
    authority_epoch: authority.epoch, role })) fail('invalid_coordination_binding');
  const prior = existingCoordination(root, native_binding);
  if (prior.length) {
    if (prior.length === 1 && sameCoordinationBinding(prior[0].native_binding, native_binding)) return { status: 'already_registered', run: prior[0], binding: native_binding };
    fail('coordination_registration_ambiguous');
  }
  privateDirectory(path.resolve(root));
  const runId = `coord-${crypto.randomUUID()}`;
  const stateDir = path.join(root, 'coordination-runs', runId);
  const run = Object.freeze({ schema_version: 1, scope: SCOPE, provider, accountingSource: ACCOUNTING_SOURCE,
    coordination_id: coordinationId, coordination_dir: authority.directory, authority_epoch: authority.epoch, role, run_id: runId,
    registered_at: new Date().toISOString(), native_binding, state_dir: stateDir });
  writeJson(path.join(stateDir, 'registration.json'), run);
  return { status: 'registered', run, binding: native_binding };
}

module.exports = Object.freeze({ SCOPE, ACCOUNTING_SOURCE, COORDINATION_RUN, COORDINATION_ROLES,
  coordinationFiles, validCoordinationBinding, validRolloutDescriptor, validCursorSeed, rolloutDescriptor,
  readCoordination, resolveNativeAuthority, registerCoordination });
