#!/usr/bin/env node
'use strict';
// Private ownership metadata only. No process launches, signals, telemetry or model calls.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { safePath, digest } = require('./contract.cjs');
const { privateDirectory } = require('./quota-sampler.cjs');
const { readRun, readJson, writeJson, RUN } = require('./global-store.cjs');
const MAX_CLAIMS = 256, MAX_METADATA = 8192;
const HEX = /^[a-f0-9]{64}$/, COORDINATOR = /^fleet-[a-f0-9-]{36}$/;
const fail = reason => { throw new Error(reason); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
const atom = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value);
const absolute = value => typeof value === 'string' && value.length <= 4096 && !/[\x00-\x1f\x7f]/.test(value) && path.isAbsolute(value);
const only = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

function directory(value, missing = false) {
  if (!absolute(value)) fail('fleet_path_invalid');
  const resolved = path.resolve(value);
  // safePath checks every ancestor; use a non-existing sentinel for a directory leaf.
  safePath(path.join(resolved, '.fleet-path-check'));
  let stat;
  try { stat = fs.lstatSync(resolved); } catch (error) { if (missing && error.code === 'ENOENT') return null; throw error; }
  if (!stat.isDirectory() || stat.isSymbolicLink() || (process.getuid && stat.uid !== process.getuid())) fail('fleet_directory_unsafe');
  return fs.realpathSync(resolved);
}
function rootDirectory(root, missing = false) {
  const resolved = directory(root, missing);
  if (resolved && process.platform !== 'win32' && (fs.statSync(resolved).mode & 0o777) !== 0o700) fail('fleet_root_not_private');
  return resolved;
}
function locations(root) {
  const base = path.join(root, 'fleet');
  return { base, coordinator: path.join(base, 'coordinator.json'), lock: path.join(base, 'ownership.lock'),
    claims: path.join(base, 'claims'), receipts: path.join(base, 'receipts') };
}
function syncDirectory(value) {
  if (process.platform === 'win32') return;
  const fd = fs.openSync(value, fs.constants.O_RDONLY);
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function durableJson(file, value) {
  if (Buffer.byteLength(JSON.stringify(value)) > MAX_METADATA) fail('fleet_metadata_limit');
  writeJson(file, value);
  const fd = fs.openSync(file, fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  syncDirectory(path.dirname(file));
}
function withLock(root, action) {
  const p = locations(root); privateDirectory(p.base);
  let fd;
  try { safePath(p.lock); fd = fs.openSync(p.lock, 'wx', 0o600); }
  catch (error) {
    // Windows can report EPERM while another process's deleted lock is closing.
    // All these cases refuse acquisition; none permits recovery or takeover.
    if (error.code === 'EEXIST' || (process.platform === 'win32' && ['EPERM', 'EACCES', 'ENOENT'].includes(error.code))) fail('fleet_busy');
    throw error;
  }
  const token = crypto.randomUUID();
  try {
    fs.writeFileSync(fd, JSON.stringify({ token, pid: process.pid }) + '\n'); fs.fsyncSync(fd);
    return action(p);
  } finally {
    fs.closeSync(fd);
    // Never remove a lock replaced by somebody else, including an unreadable one.
    if (readJson(p.lock).token !== token) fail('fleet_lock_ownership_lost');
    fs.unlinkSync(p.lock);
  }
}
function coordinator(root, p, create = false) {
  safePath(p.coordinator);
  if (!fs.existsSync(p.coordinator)) {
    if (!create) return null;
    for (const existing of [p.claims, p.receipts]) {
      if (!fs.existsSync(existing)) continue;
      directory(existing);
      const dir = fs.opendirSync(existing);
      try { if (dir.readSync()) fail('fleet_coordinator_missing'); } finally { dir.closeSync(); }
    }
    durableJson(p.coordinator, { schema_version: 1, coordinator_id: `fleet-${crypto.randomUUID()}`,
      root_id: digest(root), created_at: new Date().toISOString() });
  }
  const row = readJson(p.coordinator);
  if (!only(row, ['schema_version', 'coordinator_id', 'root_id', 'created_at']) || row.schema_version !== 1
      || !COORDINATOR.test(row.coordinator_id) || row.root_id !== digest(root) || !timestamp(row.created_at)) fail('fleet_coordinator_invalid');
  return row.coordinator_id;
}
function registration(root, runId) {
  const run = readRun(root, runId);
  if (!run) fail('fleet_run_unregistered');
  if (run.role !== 'orchestrator') fail('fleet_role_unsupported');
  if (directory(run.project_dir) !== run.project_dir) fail('fleet_registration_mismatch');
  return run;
}
function processIdentity(value) {
  if (!plain(value) || !integer(value.pid) || typeof value.start_time !== 'string' || !/^\d{1,32}$/.test(value.start_time)
      || !absolute(value.executable)) fail('fleet_process_unverified');
  return { pid: value.pid, start_time: value.start_time, executable: value.executable };
}
function tmuxMetadata(value) {
  if (value === undefined || value === null) return null;
  if (!plain(value)) fail('fleet_tmux_invalid');
  const selected = {};
  for (const key of ['server_pid', 'session_id', 'session_name', 'pane_id', 'socket_path']) {
    if (value[key] === undefined || value[key] === null) continue;
    const item = value[key];
    const valid = key === 'server_pid' ? integer(item) : key === 'socket_path' ? absolute(item)
      : key === 'session_id' ? typeof item === 'string' && /^\$\d{1,12}$/.test(item)
      : key === 'pane_id' ? typeof item === 'string' && /^%\d{1,12}$/.test(item) : atom(item);
    if (!valid) fail('fleet_tmux_invalid');
    selected[key] = item;
  }
  return selected;
}
function readClaim(root, p, projectId, coordinatorId) {
  const file = path.join(p.claims, `${projectId}.json`); safePath(file);
  if (!fs.existsSync(file)) return null;
  let c;
  try {
    c = readJson(file);
    if (!only(c, ['schema_version', 'coordinator_id', 'project_id', 'project_dir', 'run_id', 'status', 'identity',
      'session_id', 'tmux', 'created_at', 'bound_at']) || c.schema_version !== 1 || c.coordinator_id !== coordinatorId
      || c.project_id !== projectId || !HEX.test(projectId) || !RUN.test(c.run_id || '')
      || !['pending', 'bound'].includes(c.status) || !timestamp(c.created_at)) throw new Error();
    const run = registration(root, c.run_id);
    if (run.project_id !== projectId || run.project_dir !== c.project_dir) throw new Error();
    if (c.status === 'pending') {
      if (c.identity !== null || c.session_id !== null || c.tmux !== null || c.bound_at !== null) throw new Error();
    } else {
      if (JSON.stringify(processIdentity(c.identity)) !== JSON.stringify(c.identity) || !timestamp(c.bound_at)
          || (c.session_id !== null && !atom(c.session_id)) || digest(tmuxMetadata(c.tmux)) !== digest(c.tmux)) throw new Error();
    }
  } catch { fail('fleet_claim_invalid'); }
  return c;
}
function reserve({ root, run } = {}) {
  root = rootDirectory(root);
  const registered = registration(root, run?.run_id);
  if (run.project_id !== registered.project_id || run.project_dir !== registered.project_dir
      || run.provider !== registered.provider || run.role !== registered.role) fail('fleet_registration_mismatch');
  return withLock(root, p => {
    const id = coordinator(root, p, true), receipt = path.join(p.receipts, `${registered.run_id}.json`);
    safePath(receipt); if (fs.existsSync(receipt)) fail('fleet_run_released');
    const previous = readClaim(root, p, registered.project_id, id);
    if (previous) { if (previous.run_id !== registered.run_id) fail('fleet_project_owned'); return previous; }
    const claim = { schema_version: 1, coordinator_id: id, project_id: registered.project_id, project_dir: registered.project_dir,
      run_id: registered.run_id, status: 'pending', identity: null, session_id: null, tmux: null,
      created_at: new Date().toISOString(), bound_at: null };
    durableJson(path.join(p.claims, `${claim.project_id}.json`), claim);
    return claim;
  });
}

// Linux proc is the production authority. Missing PID is dead; inaccessible or
// inconsistent evidence is unknown. Read no command line and retain no environment.
function procBytes(file, limit) {
  const fd = fs.openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(limit + 1); let length = 0, n;
    while (length < buffer.length && (n = fs.readSync(fd, buffer, length, buffer.length - length, null))) length += n;
    if (length > limit) fail('fleet_process_metadata_limit');
    return buffer.subarray(0, length).toString('utf8');
  } finally { fs.closeSync(fd); }
}
function linuxProcess(pid) {
  if (process.platform !== 'linux' || !integer(pid)) return { state: 'unknown' };
  const base = `/proc/${pid}`;
  let first;
  try { first = procBytes(`${base}/stat`, 8192); }
  catch (error) { return { state: error.code === 'ENOENT' ? 'dead' : 'unknown' }; }
  try {
    const fields = first.slice(first.lastIndexOf(')') + 2).trim().split(/\s+/);
    if (!first.startsWith(`${pid} (`) || !/^\d+$/.test(fields[19])) return { state: 'unknown' };
    if (['Z', 'X'].includes(fields[0])) return { state: 'dead' };
    if (process.getuid && fs.statSync(base).uid !== process.getuid()) return { state: 'unknown' };
    const executable = fs.readlinkSync(`${base}/exe`), environment = {};
    for (const entry of procBytes(`${base}/environ`, 1024 * 1024).split('\0')) {
      const equal = entry.indexOf('='), key = entry.slice(0, equal);
      if (['SGSD_RUN_ID', 'SGSD_ATLAS_PROJECT_ID'].includes(key)) {
        if (Object.hasOwn(environment, key)) return { state: 'unknown' };
        environment[key] = entry.slice(equal + 1);
      }
    }
    const second = procBytes(`${base}/stat`, 8192);
    const after = second.slice(second.lastIndexOf(')') + 2).trim().split(/\s+/);
    if (after[19] !== fields[19] || ['Z', 'X'].includes(after[0]) || fs.readlinkSync(`${base}/exe`) !== executable) return { state: 'unknown' };
    return { state: 'alive', pid, start_time: fields[19], executable, environment };
  } catch { return { state: 'unknown' }; }
}
function lookup(pid, dependencies) {
  try { return (dependencies?.processLookup || linuxProcess)(pid) || { state: 'unknown' }; }
  catch { return { state: 'unknown' }; }
}
function scopeMatches(actual, run) {
  return actual.environment?.SGSD_RUN_ID === run.run_id && actual.environment?.SGSD_ATLAS_PROJECT_ID === run.project_id;
}
function processState(claim, dependencies) {
  if (claim.status === 'pending') return 'pending';
  const actual = lookup(claim.identity.pid, dependencies);
  if (actual.state === 'dead') return 'dead';
  if (actual.state !== 'alive') return 'unknown';
  let identity;
  try { identity = processIdentity(actual); } catch { return 'unknown'; }
  if (identity.pid !== claim.identity.pid) return 'unknown';
  if (identity.start_time !== claim.identity.start_time) return 'reused';
  return identity.executable === claim.identity.executable && scopeMatches(actual, claim) ? 'alive' : 'unknown';
}
function ownedClaim(root, p, run) {
  const id = coordinator(root, p);
  if (!id) fail('fleet_coordinator_missing');
  const claim = readClaim(root, p, run.project_id, id);
  if (!claim) fail('fleet_claim_missing');
  if (claim.run_id !== run.run_id) fail('fleet_owner_mismatch');
  return claim;
}
function bind({ root, runId, projectDir, pid, sessionId = null, tmux = null } = {}, dependencies) {
  root = rootDirectory(root); const run = registration(root, runId);
  if (directory(projectDir) !== run.project_dir) fail('fleet_project_mismatch');
  if (!integer(pid) || (sessionId !== null && !atom(sessionId))) fail('fleet_binding_invalid');
  const selectedTmux = tmuxMetadata(tmux);
  return withLock(root, p => {
    const receipt = path.join(p.receipts, `${run.run_id}.json`);
    safePath(receipt); if (fs.existsSync(receipt)) fail('fleet_run_released');
    const claim = ownedClaim(root, p, run), actual = lookup(pid, dependencies);
    if (actual.state !== 'alive' || actual.pid !== pid) fail('fleet_process_unverified');
    const identity = processIdentity(actual);
    if (!scopeMatches(actual, run)) fail('fleet_process_scope_mismatch');
    if (claim.status === 'bound') {
      if (digest([claim.identity, claim.session_id, claim.tmux]) !== digest([identity, sessionId, selectedTmux])) fail('fleet_binding_conflict');
      return claim;
    }
    const bound = { ...claim, status: 'bound', identity, session_id: sessionId, tmux: selectedTmux, bound_at: new Date().toISOString() };
    durableJson(path.join(p.claims, `${run.project_id}.json`), bound);
    return bound;
  });
}
function release({ root, runId, allowPending = false } = {}, dependencies) {
  root = rootDirectory(root); const run = registration(root, runId);
  if (typeof allowPending !== 'boolean') fail('fleet_release_invalid');
  return withLock(root, p => {
    const claim = ownedClaim(root, p, run);
    let reason;
    if (claim.status === 'pending') {
      if (!allowPending) fail('fleet_pending_abort_required');
      reason = 'pending_launch_aborted';
    } else {
      const state = processState(claim, dependencies);
      if (!['dead', 'reused'].includes(state)) fail('fleet_process_not_dead');
      reason = state === 'dead' ? 'bound_process_dead' : 'bound_process_replaced';
    }
    const file = path.join(p.receipts, `${run.run_id}.json`); safePath(file);
    let receipt;
    if (fs.existsSync(file)) {
      receipt = readJson(file);
      if (!only(receipt, ['schema_version', 'coordinator_id', 'project_id', 'project_dir', 'run_id', 'status', 'reason', 'identity', 'released_at', 'claim'])
          || receipt.schema_version !== 1 || receipt.status !== 'released' || receipt.run_id !== runId
          || receipt.coordinator_id !== claim.coordinator_id || receipt.project_id !== claim.project_id || receipt.project_dir !== claim.project_dir
          || !timestamp(receipt.released_at) || !['pending_launch_aborted', 'bound_process_dead', 'bound_process_replaced'].includes(receipt.reason)
          || (claim.status === 'pending') !== (receipt.reason === 'pending_launch_aborted')
          || digest(receipt.identity) !== digest(claim.identity) || digest(receipt.claim) !== digest(claim)) fail('fleet_receipt_conflict');
    } else {
      receipt = { schema_version: 1, coordinator_id: claim.coordinator_id, project_id: claim.project_id,
        project_dir: claim.project_dir, run_id: runId, status: 'released', reason,
        identity: claim.identity, released_at: new Date().toISOString(), claim };
      durableJson(file, receipt);
    }
    // A crash between the durable receipt and unlink leaves an owned claim,
    // never a claim-free project without its terminal evidence.
    const claimFile = path.join(p.claims, `${run.project_id}.json`);
    if (digest(readClaim(root, p, run.project_id, claim.coordinator_id)) !== digest(claim)) fail('fleet_owner_mismatch');
    safePath(claimFile); fs.unlinkSync(claimFile); syncDirectory(p.claims);
    return receipt;
  });
}
function status({ root, projectDir } = {}, dependencies) {
  root = rootDirectory(root, true);
  const empty = { schema_version: 1, coordinator_id: null, claims: [], limited: false };
  if (!root) return empty;
  const p = locations(root); if (!directory(p.base, true)) return empty;
  const coordinatorId = coordinator(root, p), claims = [];
  if (!directory(p.claims, true)) return { ...empty, coordinator_id: coordinatorId };
  const target = projectDir === undefined ? null : digest(directory(projectDir));
  let limited = false, seen = 0;
  const dir = fs.opendirSync(p.claims);
  try {
    let entry;
    while ((entry = dir.readSync())) {
      if (++seen > MAX_CLAIMS) { limited = true; break; }
      const match = /^([a-f0-9]{64})\.json$/.exec(entry.name);
      if (!match || (target && match[1] !== target)) continue;
      let claim;
      try {
        if (!coordinatorId) fail('fleet_coordinator_missing');
        claim = readClaim(root, p, match[1], coordinatorId);
        if (!claim) continue; // Concurrent explicit release; no ownership claim is inferred.
        const state = processState(claim, dependencies);
        claims.push({ ...claim, active: state === 'alive', process_state: state });
      } catch {
        claims.push({ project_id: match[1], status: 'unknown', active: false, process_state: 'unknown' });
      }
    }
  } finally { dir.closeSync(); }
  return { schema_version: 1, coordinator_id: coordinatorId, claims, limited };
}
function main(argv = process.argv.slice(2)) {
  const command = argv.shift() || 'status', values = {};
  const allowed = { status: ['--root', '--project-dir'], bind: ['--root', '--run-id', '--project-dir', '--pid', '--session-id', '--tmux-json'],
    release: ['--root', '--run-id', '--allow-pending'] };
  if (!allowed[command]) fail('fleet_command_invalid');
  while (argv.length) {
    const flag = argv.shift();
    if (!allowed[command].includes(flag) || Object.hasOwn(values, flag)) fail('fleet_argument_invalid');
    if (flag === '--allow-pending') values[flag] = true;
    else { if (!argv.length || argv[0].startsWith('--')) fail('fleet_argument_invalid'); values[flag] = argv.shift(); }
  }
  const root = path.resolve(values['--root'] || process.env.SGSD_ATLAS_GLOBAL_ROOT || path.join(os.homedir(), '.local/state/sgsd/telemetry/global'));
  if (command === 'status') return status({ root, projectDir: values['--project-dir'] === undefined ? undefined : path.resolve(values['--project-dir']) });
  if (!values['--run-id']) fail('fleet_argument_invalid');
  if (command === 'release') return release({ root, runId: values['--run-id'], allowPending: values['--allow-pending'] === true });
  if (!values['--project-dir'] || !values['--pid']) fail('fleet_argument_invalid');
  let tmux = null;
  if (values['--tmux-json']) { try { tmux = JSON.parse(values['--tmux-json']); } catch { fail('fleet_tmux_invalid'); } }
  return bind({ root, runId: values['--run-id'], projectDir: path.resolve(values['--project-dir']), pid: Number(values['--pid']),
    sessionId: values['--session-id'] || null, tmux });
}
if (require.main === module) {
  try { process.stdout.write(JSON.stringify(main()) + '\n'); }
  catch (error) { process.stderr.write(`SGSD_FLEET: ${/^(fleet_[a-z_]+|unsafe_[a-z_]+)$/.test(error.message) ? error.message : 'fleet_operation_failed'}\n`); process.exitCode = 2; }
}
module.exports = Object.freeze({ reserve, bind, release, status });
