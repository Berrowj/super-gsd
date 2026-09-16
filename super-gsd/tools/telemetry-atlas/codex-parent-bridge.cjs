#!/usr/bin/env node
'use strict';

// Bounded registration metadata for an already-running Codex parent. This
// never launches, signals, mutates process environments, or ingests telemetry.
const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { registerRun, readRun, writeJson, validNativeBinding, RUN } = require('./global-store.cjs');
const { safePath, digest } = require('./contract.cjs');
const { registerCoordination, COORDINATION_ROLES } = require('./supervised-coordination.cjs');
const { readBootId, readNativeProcess } = require('../codex-worker/native-process.cjs');

const MAX_ROLLOUT_BYTES = 8 * 1024 * 1024;
const MAX_ROLLOUT_LINES = 256;
const executableVersion = executable => executable.match(/[\\/](\d+\.\d+\.\d+)(?:[-\\/]|$)/)?.[1] || null;
const fail = reason => { throw new Error(reason); };

function readProcess(pid, expectedCwd, options = {}) {
  if (process.platform === 'win32') return readNativeProcess(pid, expectedCwd, options);
  if (process.platform !== 'linux' || !Number.isSafeInteger(pid) || pid < 1) fail('codex_bridge_process_unverified');
  const base = `/proc/${pid}`;
  let stat;
  try { stat = fs.readFileSync(`${base}/stat`, 'utf8'); } catch { fail('codex_bridge_process_unverified'); }
  const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
  if (!/^\d+$/.test(fields[19]) || ['Z', 'X'].includes(fields[0])) fail('codex_bridge_process_unverified');
  let executable, cwd;
  try { executable = fs.readlinkSync(`${base}/exe`); cwd = fs.realpathSync(`${base}/cwd`); } catch { fail('codex_bridge_process_unverified'); }
  const environment = {};
  try {
    for (const row of fs.readFileSync(`${base}/environ`).toString().split('\0')) {
      const equal = row.indexOf('='), key = row.slice(0, equal);
      if (['SGSD_RUN_ID', 'SGSD_ATLAS_PROJECT_ID'].includes(key)) environment[key] = row.slice(equal + 1);
    }
  } catch { fail('codex_bridge_process_unverified'); }
  return { pid, start_time: fields[19], executable, cwd, environment, boot_id: readBootId() };
}

async function readRolloutMetadata(file) {
  file = path.resolve(file); safePath(file);
  const info = fs.statSync(file);
  if (!info.isFile()) fail('codex_bridge_rollout_limit');
  const stream = fs.createReadStream(file, { encoding: 'utf8', start: 0, end: MAX_ROLLOUT_BYTES - 1 });
  const input = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lines = 0, bytes = 0, sessionMeta = null, threadIds = new Set();
  try {
    for await (const line of input) {
      if (++lines > MAX_ROLLOUT_LINES || (bytes += Buffer.byteLength(line)) > MAX_ROLLOUT_BYTES) fail('codex_bridge_rollout_limit');
      let row; try { row = JSON.parse(line); } catch { continue; }
      const payload = row?.payload;
      if (row.type === 'session_meta' && payload && sessionMeta === null) {
        sessionMeta = { session_id: payload.session_id, cwd: payload.cwd, model_provider: payload.model_provider,
          source: payload.source, cli_version: payload.cli_version };
      }
      if (typeof payload?.thread_id === 'string') threadIds.add(payload.thread_id);
      if (sessionMeta && threadIds.size) break;
    }
  } finally { input.close(); stream.destroy(); }
  return { sessionMeta, threadIds: [...threadIds] };
}

function sameBinding(left, right) {
  return ['provider', 'accounting_source', 'project_id', 'project_dir', 'session_id', 'thread_id', 'pid', 'start_time', 'boot_id', 'executable']
    .every(key => left[key] === right[key]);
}

function existingBindings(root, binding) {
  const runsDir = path.join(root, 'runs'); safePath(path.join(runsDir, '.codex-bridge-read-check'));
  if (!fs.existsSync(runsDir)) return [];
  const result = [];
  for (const entry of fs.readdirSync(runsDir).slice(0, 10000)) {
    if (!RUN.test(entry)) continue;
    const run = readRun(root, entry); if (!run?.native_binding) continue;
    const prior = run.native_binding;
    if (prior.session_id === binding.session_id && prior.thread_id === binding.thread_id
        || prior.pid === binding.pid && prior.start_time === binding.start_time && prior.boot_id === binding.boot_id) result.push(run);
  }
  return result;
}

function cursorSeed(file, stat, observedAt = new Date().toISOString()) {
  return { schema_version: 1, path: file, dev: stat.dev, ino: stat.ino, offset: stat.size,
    last_response_id: null, last_event_id: null, observed_at: observedAt, seen_event_ids: [], seen_response_ids: [] };
}

function seedWindowsCursor(run, rolloutPath) {
  if (process.platform !== 'win32') return;
  const cursorFile = path.join(run.state_dir, 'native-continuous-cursor.json');
  if (fs.existsSync(cursorFile)) return;
  const file = path.resolve(rolloutPath); safePath(file);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || Number.isSafeInteger(stat.uid) && stat.uid !== process.getuid?.()) {
    fail('codex_bridge_rollout_unavailable');
  }
  writeJson(cursorFile, cursorSeed(file, stat));
}

async function registerCurrentCodex({ root, projectDir, pid, expectedStartTime, sessionId, threadId, rolloutPath,
  processLookup = readProcess, rolloutReader = readRolloutMetadata, bootIdLookup = readBootId } = {}) {
  root = path.resolve(root); projectDir = fs.realpathSync(path.resolve(projectDir));
  const actual = processLookup(pid, projectDir, { requireInvokerCwd: process.platform === 'win32' });
  if (actual.pid !== pid || actual.start_time !== expectedStartTime || actual.cwd !== projectDir || actual.boot_id !== bootIdLookup()) fail('codex_bridge_identity_mismatch');
  if (actual.environment.SGSD_RUN_ID || actual.environment.SGSD_ATLAS_PROJECT_ID) fail('codex_bridge_process_already_scoped');
  const rollout = await rolloutReader(rolloutPath);
  const meta = rollout.sessionMeta;
  if (!meta || meta.session_id !== sessionId || meta.cwd !== projectDir || meta.model_provider !== 'openai' || meta.source !== 'cli'
      || !rollout.threadIds.includes(threadId) || threadId !== sessionId || executableVersion(actual.executable) !== meta.cli_version) fail('codex_bridge_rollout_mismatch');
  const native_binding = { schema_version: 1, provider: 'openai', accounting_source: 'codex_rollout',
    project_id: digest(projectDir), project_dir: projectDir, session_id: sessionId, thread_id: threadId,
    pid, start_time: actual.start_time, boot_id: actual.boot_id, executable: actual.executable };
  if (!validNativeBinding(native_binding, { project_id: native_binding.project_id, project_dir: projectDir })) fail('codex_bridge_binding_invalid');
  const prior = existingBindings(root, native_binding);
  if (prior.length) {
    if (prior.length === 1 && sameBinding(prior[0].native_binding, native_binding)) return { status: 'already_registered', run: prior[0], binding: native_binding };
    fail('codex_bridge_registration_ambiguous');
  }
  const run = registerRun({ root, projectDir, provider: 'openai', role: 'executor', accountingSource: 'codex_rollout', native_binding });
  seedWindowsCursor(run, rolloutPath);
  return { status: 'registered', run, binding: native_binding };
}

async function registerCurrentCoordination({ root, coordinationDir, role, pid, expectedStartTime, sessionId, threadId, rolloutPath,
  processLookup = readProcess, rolloutReader = readRolloutMetadata, bootIdLookup = readBootId } = {}) {
  root = path.resolve(root); coordinationDir = fs.realpathSync(path.resolve(coordinationDir));
  if (!COORDINATION_ROLES.has(role)) fail('codex_bridge_coordination_role_invalid');
  const actual = processLookup(pid, coordinationDir, { requireInvokerCwd: process.platform === 'win32' });
  if (actual.pid !== pid || actual.start_time !== expectedStartTime || actual.cwd !== coordinationDir || actual.boot_id !== bootIdLookup()) fail('codex_bridge_identity_mismatch');
  if (actual.environment.SGSD_RUN_ID || actual.environment.SGSD_ATLAS_PROJECT_ID) fail('codex_bridge_process_already_scoped');
  const rollout = await rolloutReader(rolloutPath), meta = rollout.sessionMeta;
  if (!meta || meta.session_id !== sessionId || meta.cwd !== coordinationDir || meta.model_provider !== 'openai'
      || meta.source !== 'cli' || !rollout.threadIds.includes(threadId) || threadId !== sessionId
      || executableVersion(actual.executable) !== meta.cli_version) fail('codex_bridge_rollout_mismatch');
  const result = registerCoordination({ root, coordinationDir, role, pid, startTime: actual.start_time, bootId: actual.boot_id,
    executable: actual.executable, cwd: actual.cwd, sessionId, threadId, rolloutPath });
  return { ...result, binding: result.binding || result.native_binding };
}

function values(argv) {
  const out = {}; const allowed = new Set(['--root', '--project-dir', '--coordination-dir', '--role', '--pid', '--start-time', '--session-id', '--thread-id', '--rollout-file']);
  while (argv.length) { const flag = argv.shift(); if (!allowed.has(flag) || out[flag] !== undefined || !argv.length) fail('codex_bridge_arguments_invalid'); out[flag] = argv.shift(); }
  const coordination = out['--coordination-dir'] !== undefined || out['--role'] !== undefined;
  if (coordination ? out['--project-dir'] !== undefined : !out['--project-dir']) fail('codex_bridge_arguments_invalid');
  if (coordination && !out['--coordination-dir'] || !coordination && out['--role'] !== undefined) fail('codex_bridge_arguments_invalid');
  for (const flag of ['--pid', '--start-time', '--session-id', '--thread-id', '--rollout-file']) if (!out[flag]) fail('codex_bridge_arguments_invalid');
  if (coordination && !out['--role']) fail('codex_bridge_arguments_invalid');
  return out;
}

if (require.main === module) {
  const args = values(process.argv.slice(2));
  const root = args['--root'] || process.env.SGSD_ATLAS_GLOBAL_ROOT || path.join(require('node:os').homedir(), '.local/state/sgsd/telemetry/global');
  const registration = args['--coordination-dir'] !== undefined
    ? registerCurrentCoordination({ root, coordinationDir: args['--coordination-dir'], role: args['--role'], pid: Number(args['--pid']),
      expectedStartTime: args['--start-time'], sessionId: args['--session-id'], threadId: args['--thread-id'], rolloutPath: args['--rollout-file'] })
    : registerCurrentCodex({ root, projectDir: args['--project-dir'], pid: Number(args['--pid']), expectedStartTime: args['--start-time'],
      sessionId: args['--session-id'], threadId: args['--thread-id'], rolloutPath: args['--rollout-file'] });
  registration.then(result => process.stdout.write(JSON.stringify(result) + '\n')).catch(error => {
    process.stderr.write(`CODEX_BRIDGE: ${error.message}\n`); process.exitCode = 2;
  });
}

module.exports = Object.freeze({ registerCurrentCodex, registerCurrentCoordination, readRolloutMetadata, cursorSeed });
