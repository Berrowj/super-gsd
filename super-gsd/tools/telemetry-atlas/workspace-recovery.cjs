#!/usr/bin/env node
'use strict';
// Durable workspace intent is not an ownership claim. Only the managed launcher
// starts providers; this coordinator never resumes business work or signals one.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { digest, safePath } = require('./contract.cjs');
const { privateDirectory } = require('./quota-sampler.cjs');
const { readRun, readJson, RUN, RECOVERY, validContextRefs, validateRecovery, flushRunRegistration } = require('./global-store.cjs');
const { currentBootId, validBootId, bootState, reclaimLock } = require('./boot-identity.cjs');
const fleet = require('./fleet.cjs');
const HEX = /^[a-f0-9]{64}$/, NAME = /^[A-Za-z0-9_-]{1,80}$/;
const MAX_ENTRIES = 256, MAX_BYTES = 1024 * 1024;
const fail = reason => { throw new Error(reason); };
const only = (row, keys) => row && typeof row === 'object' && !Array.isArray(row) && Object.keys(row).every(key => keys.includes(key));
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const absolute = value => typeof value === 'string' && value.length <= 4096 && !/[\x00-\x1f\x7f]/.test(value) && path.isAbsolute(value);
const rootDefault = () => path.resolve(process.env.SGSD_ATLAS_GLOBAL_ROOT || path.join(os.homedir(), '.local/state/sgsd/telemetry/global'));
function directory(value, missing = false, isRoot = false) {
  if (!absolute(value) || path.resolve(value) !== value) fail('recovery_path_invalid');
  safePath(path.join(value, '.recovery-directory-check'));
  let s; try { s = fs.lstatSync(value); } catch (e) { if (missing && e.code === 'ENOENT') return null; throw e; }
  if (!s.isDirectory() || s.isSymbolicLink() || (process.getuid && s.uid !== process.getuid())
      || (isRoot && process.platform !== 'win32' && (s.mode & 0o777) !== 0o700)
      || fs.realpathSync(value) !== value) fail('recovery_directory_unsafe');
  return value;
}
const base = root => path.join(root, 'fleet', 'workspaces');
const catalogPath = root => path.join(base(root), 'catalog.json');
const ticketPath = (root, id) => { if (!RECOVERY.test(id || '')) fail('recovery_ticket_invalid'); return path.join(base(root), 'tickets', `${id}.json`); };
function syncDirectory(dir) {
  if (process.platform === 'win32') return;
  const fd = fs.openSync(dir, 'r'); try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function durable(file, row, limit = MAX_BYTES) {
  const bytes = JSON.stringify(row) + '\n'; if (Buffer.byteLength(bytes) > limit) fail('recovery_metadata_limit');
  privateDirectory(path.dirname(file)); safePath(file);
  // tickets/latest are one level below the already-durable workspace root.
  // Persist a newly created leaf and its parent link before dependent metadata.
  syncDirectory(path.dirname(file)); syncDirectory(path.dirname(path.dirname(file)));
  const tmp = `${file}.${crypto.randomUUID()}.tmp`; let fd;
  try {
    fd = fs.openSync(tmp, 'wx', 0o600); fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    fs.renameSync(tmp, file); syncDirectory(path.dirname(file));
  } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
function optional(file, limit = MAX_BYTES) {
  safePath(file); try { return readJson(file, limit); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
function lock(root, name, deps) {
  directory(root, false, true); privateDirectory(base(root));
  // The lock creates this tree before put() runs. Its directory names therefore
  // need flushing here, not just when a later writer notices a missing leaf.
  for (const directory of [base(root), path.dirname(base(root)), root]) syncDirectory(directory);
  const file = path.join(base(root), `${name}.lock`); safePath(file); let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (e) {
    if (e.code === 'EEXIST' && reclaimLock({ file, receiptDirectory: path.join(base(root), 'lock-receipts') }, deps)) return lock(root, name, deps);
    if (['EEXIST', 'EPERM', 'EACCES', 'ENOENT'].includes(e.code)) fail('recovery_busy'); throw e;
  }
  const token = crypto.randomUUID();
  fs.writeFileSync(fd, JSON.stringify({ token, pid: process.pid, boot_id: currentBootId(deps) }) + '\n'); fs.fsyncSync(fd);
  return () => {
    fs.closeSync(fd); if (optional(file)?.token !== token) fail('recovery_lock_ownership_lost');
    fs.unlinkSync(file); syncDirectory(path.dirname(file));
  };
}
function locked(root, name, deps, fn) { const unlock = lock(root, name, deps); try { return fn(); } finally { unlock(); } }
function projectIdentity(projectDir) { const s = fs.statSync(directory(projectDir)); return { dev: String(s.dev), ino: String(s.ino) }; }
function refs(projectDir) {
  const names = ['.planning/STATE.md', '.planning/HANDOFF.json', '.planning/ORCHESTRATOR-CHECKPOINT.md'];
  const analysis = path.join(projectDir, '.planning', 'analyses');
  if (directory(analysis, true)) {
    const dir = fs.opendirSync(analysis); let seen = 0; const candidates = [];
    try { let row; while ((row = dir.readSync())) {
      if (++seen > 4096) fail('recovery_context_scan_limit');
      if (row.isFile() && /^[A-Za-z0-9_-]{1,120}fleet-handover[A-Za-z0-9_.-]{0,100}\.md$/.test(row.name)) candidates.push(row.name);
    } } finally { dir.closeSync(); }
    names.push(...candidates.sort().reverse().slice(0, 5).map(name => `.planning/analyses/${name}`));
  }
  const result = [];
  for (const relative of names) {
    const file = path.join(projectDir, relative); safePath(file);
    let stat; try { stat = fs.statSync(file); } catch (e) { if (e.code === 'ENOENT') continue; throw e; }
    if (stat.size > MAX_BYTES) fail('recovery_context_limit');
    const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const bytes = Buffer.alloc(stat.size + 1), size = fs.readSync(fd, bytes, 0, bytes.length, 0), after = fs.fstatSync(fd);
      if (size !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) fail('recovery_context_changed');
      result.push({ path: relative, sha256: crypto.createHash('sha256').update(bytes.subarray(0, size)).digest('hex'), bytes: size });
    } finally { fs.closeSync(fd); }
  }
  if (!validContextRefs(result)) fail('recovery_context_invalid'); return result;
}
function validEntry(row, root) {
  if (!only(row, ['project_id', 'project_dir', 'project_identity', 'display_name', 'preferred_session', 'previous_run_id',
    'boot_id', 'provider_session_id', 'context_refs', 'remembered_at', 'updated_at']) || !HEX.test(row.project_id || '')
    || !absolute(row.project_dir) || digest(row.project_dir) !== row.project_id || !RUN.test(row.previous_run_id || '')
    || !only(row.project_identity, ['dev', 'ino']) || !/^\d+$/.test(row.project_identity.dev) || !/^\d+$/.test(row.project_identity.ino)
    || typeof row.display_name !== 'string' || row.display_name.length > 120 || /[\x00-\x1f\x7f]/.test(row.display_name)
    || !NAME.test(row.preferred_session || '') || (row.boot_id !== null && !validBootId(row.boot_id))
    || (row.provider_session_id !== null && !/^[A-Za-z0-9._:-]{1,160}$/.test(row.provider_session_id))
    || !validContextRefs(row.context_refs) || !iso(row.remembered_at) || !iso(row.updated_at)) fail('recovery_catalog_invalid');
  const run = readRun(root, row.previous_run_id);
  if (!run || run.role !== 'orchestrator' || run.provider !== 'anthropic' || run.project_dir !== row.project_dir) fail('recovery_catalog_unregistered');
  return row;
}
function catalog(root) {
  const value = optional(catalogPath(root));
  if (!value) return { schema_version: 1, entries: [], forgotten: [] };
  if (!only(value, ['schema_version', 'entries', 'forgotten']) || value.schema_version !== 1 || !Array.isArray(value.entries)
      || !Array.isArray(value.forgotten) || value.entries.length + value.forgotten.length > MAX_ENTRIES) fail('recovery_catalog_invalid');
  const ids = new Set();
  for (const row of value.entries) { validEntry(row, root); if (ids.has(row.project_id)) fail('recovery_catalog_invalid'); ids.add(row.project_id); }
  for (const row of value.forgotten) {
    if (!only(row, ['project_id', 'run_id', 'forgotten_at']) || !HEX.test(row.project_id || '') || !RUN.test(row.run_id || '')
        || !iso(row.forgotten_at) || ids.has(row.project_id)) fail('recovery_catalog_invalid'); ids.add(row.project_id);
  }
  return value;
}
function fromClaim(claim, previous = null, preferredSession) {
  if (preferredSession !== undefined && !NAME.test(preferredSession)) fail('recovery_session_invalid');
  const slug = path.basename(claim.project_dir).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 45) || 'workspace';
  const now = new Date().toISOString();
  return { project_id: claim.project_id, project_dir: claim.project_dir, project_identity: projectIdentity(claim.project_dir),
    display_name: path.basename(claim.project_dir).slice(0, 120),
    preferred_session: preferredSession || previous?.preferred_session || (NAME.test(claim.tmux?.session_name || '') ? claim.tmux.session_name : `sgsd-${slug}-${claim.project_id.slice(0, 8)}`),
    previous_run_id: claim.run_id, boot_id: claim.boot_id || null, provider_session_id: claim.session_id || null,
    context_refs: refs(claim.project_dir), remembered_at: previous?.remembered_at || now, updated_at: now };
}
function put(root, value, row) {
  value.entries = value.entries.filter(item => item.project_id !== row.project_id).concat(row);
  value.forgotten = value.forgotten.filter(item => item.project_id !== row.project_id);
  if (value.entries.length + value.forgotten.length > MAX_ENTRIES) fail('recovery_catalog_limit');
  validEntry(row, root);
  flushRunRegistration({ root, runId: row.previous_run_id, projectId: row.project_id, projectDir: row.project_dir });
  durable(catalogPath(root), value); return row;
}
function remember({ root = rootDefault(), runId, preferredSession } = {}, deps) {
  return locked(root, 'catalog', deps, () => {
    const value = catalog(root), claim = fleet.status({ root }, deps).claims.find(row => row.run_id === runId);
    if (!claim || claim.status !== 'bound' || !claim.active) fail('recovery_owner_unverified');
    if (value.forgotten.some(row => row.project_id === claim.project_id && row.run_id === runId)) return null;
    return put(root, value, fromClaim(claim, value.entries.find(row => row.project_id === claim.project_id), preferredSession));
  });
}
function refresh({ root = rootDefault(), runId } = {}, deps) {
  if (!directory(root, true, true) || !optional(catalogPath(root))) return null;
  return locked(root, 'catalog', deps, () => {
    const value = catalog(root), row = value.entries.find(item => item.previous_run_id === runId);
    if (!row) return null;
    if (availability(row) !== 'available') return row;
    return put(root, value, { ...row, context_refs: refs(row.project_dir), updated_at: new Date().toISOString() });
  });
}
function availability(row) {
  try { if (!directory(row.project_dir, true)) return 'project_missing';
    if (digest(projectIdentity(row.project_dir)) !== digest(row.project_identity)) return 'project_replaced';
    if (!directory(path.join(row.project_dir, '.planning'), true)) return 'planning_missing'; return 'available';
  } catch { return 'project_unsafe'; }
}
function contextStatus(row) {
  return row.context_refs.map(reference => {
    let status = 'unavailable';
    try {
      const file = path.join(row.project_dir, reference.path); safePath(file);
      const before = fs.statSync(file);
      if (before.size > MAX_BYTES) status = 'too_large';
      else {
        const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
        try {
          const bytes = Buffer.alloc(before.size + 1), size = fs.readSync(fd, bytes, 0, bytes.length, 0), after = fs.fstatSync(fd);
          status = before.dev !== after.dev || before.ino !== after.ino || before.mtimeMs !== after.mtimeMs || before.size !== after.size || size !== before.size
            ? 'changed' : crypto.createHash('sha256').update(bytes.subarray(0, size)).digest('hex') === reference.sha256 ? 'present' : 'changed';
        } finally { fs.closeSync(fd); }
      }
    } catch (error) { status = error.code === 'ENOENT' ? 'missing' : 'unsafe'; }
    return { path: reference.path, status };
  });
}
function validContextStatus(rows) {
  return Array.isArray(rows) && rows.length <= 8 && rows.every(row => only(row, ['path', 'status'])
    && ['present', 'changed', 'missing', 'unsafe', 'too_large', 'unavailable'].includes(row.status))
    && validContextRefs(rows.map(row => ({ path: row.path, sha256: '0'.repeat(64), bytes: 0 })));
}
function list({ root = rootDefault() } = {}, deps) {
  if (!directory(root, true, true)) return { schema_version: 1, boot_id: currentBootId(deps), entries: [], blockers: [], limited: false };
  const value = catalog(root), owners = fleet.status({ root }, deps);
  if (owners.limited) fail('recovery_claim_limit');
  const entries = value.entries.map(row => ({ ...row, source: 'remembered' })), blockers = [];
  for (const claim of owners.claims) {
    if (entries.some(row => row.project_id === claim.project_id)
        || value.forgotten.some(row => row.project_id === claim.project_id)) continue;
    if (claim.status !== 'bound') { blockers.push({ project_id: claim.project_id,
      reason: claim.status === 'pending' ? 'recovery_pending_owner' : 'recovery_legacy_claim_unverified' }); continue; }
    try { entries.push({ ...fromClaim(claim), source: 'legacy_claim' }); }
    catch { blockers.push({ project_id: claim.project_id, reason: 'recovery_legacy_context_unverified' }); }
  }
  if (entries.length + value.forgotten.length > MAX_ENTRIES) fail('recovery_catalog_limit');
  return { schema_version: 1, boot_id: currentBootId(deps), entries: entries.map(row => ({ ...row, availability: availability(row), context_status: contextStatus(row),
    owner: owners.claims.find(item => item.project_id === row.project_id) || null })), blockers, limited: false };
}
function forget({ root = rootDefault(), projectId } = {}, deps) {
  if (!HEX.test(projectId || '')) fail('recovery_project_invalid');
  return locked(root, 'catalog', deps, () => {
    const value = catalog(root), existing = list({ root }, deps).entries.find(row => row.project_id === projectId);
    if (!existing) return { project_id: projectId, status: 'not_remembered' };
    value.entries = value.entries.filter(row => row.project_id !== projectId);
    value.forgotten = value.forgotten.filter(row => row.project_id !== projectId);
    value.forgotten.push({ project_id: projectId, run_id: existing.owner?.run_id || existing.previous_run_id, forgotten_at: new Date().toISOString() });
    durable(catalogPath(root), value); return { project_id: projectId, status: 'forgotten' };
  });
}
function offer({ root = rootDefault(), acknowledge = false } = {}, deps) {
  const inventory = list({ root }, deps), file = path.join(base(root), 'offer.json'), boot = currentBootId(deps);
  const previous = optional(file, 8192);
  if (previous && (!only(previous, ['schema_version', 'boot_id', 'offered_at']) || previous.schema_version !== 1
      || !validBootId(previous.boot_id) || !iso(previous.offered_at))) fail('recovery_offer_invalid');
  const needed = Boolean(boot && (inventory.blockers.length || inventory.entries.some(row => bootState(row.boot_id, deps) !== 'same')) && previous?.boot_id !== boot);
  if (acknowledge && needed) locked(root, 'catalog', deps, () => durable(file, { schema_version: 1, boot_id: boot, offered_at: new Date().toISOString() }, 8192));
  return { schema_version: 1, needed, boot_id: boot, entries: inventory.entries, blockers: inventory.blockers };
}
function validResult(result) {
  return only(result, ['status', 'reason', 'run_id']) && Object.keys(result).length === 3
    && ['restored', 'pending', 'failed', 'blocked', 'interrupted'].includes(result.status)
    && (result.reason === null || /^[a-z_]{1,100}$/.test(result.reason || '')) && (result.run_id === null || RUN.test(result.run_id || ''));
}
function readTicket(root, id) {
  const row = optional(ticketPath(root, id), 16384);
  if (!row || !only(row, ['schema_version', 'recovery_id', 'project_id', 'project_dir', 'previous_run_id', 'context_refs', 'context_status', 'session_name',
    'boot_id', 'stage', 'created_at', 'consumed_at', 'consumer_pid', 'new_run_id', 'result']) || row.schema_version !== 1 || row.recovery_id !== id
      || !HEX.test(row.project_id || '') || !absolute(row.project_dir) || digest(row.project_dir) !== row.project_id
      || !NAME.test(row.session_name || '') || !validBootId(row.boot_id) || !iso(row.created_at) || !validContextStatus(row.context_status)
      || !['selected', 'released', 'consumed', 'prepared'].includes(row.stage)
      || (row.consumed_at !== null && !iso(row.consumed_at)) || (row.consumer_pid !== null && (!Number.isSafeInteger(row.consumer_pid) || row.consumer_pid < 1))
      || (row.new_run_id !== null && !RUN.test(row.new_run_id || '')) || (row.result !== null && !validResult(row.result))
      || (['selected', 'released'].includes(row.stage) && (row.consumed_at !== null || row.consumer_pid !== null || row.new_run_id !== null))
      || (['consumed', 'prepared'].includes(row.stage) && (!iso(row.consumed_at) || !row.consumer_pid))
      || (row.stage === 'prepared') !== (row.new_run_id !== null)) fail('recovery_ticket_invalid');
  validateRecovery(root, { project_id: row.project_id, project_dir: row.project_dir, role: 'orchestrator', provider: 'anthropic' },
    { recovery_id: id, previous_run_id: row.previous_run_id, context_refs: row.context_refs });
  return row;
}
function updateTicket(root, id, deps, update) { return locked(root, 'ticket', deps, () => {
  const row = update(readTicket(root, id)); durable(ticketPath(root, id), row, 16384); return row;
}); }
function consumeTicket({ root = rootDefault(), recoveryId, projectDir } = {}, deps) {
  let lineage;
  updateTicket(root, recoveryId, deps, row => {
    if (latest(root, row.project_id)?.recovery_id !== recoveryId) fail('recovery_ticket_superseded');
    if (!['selected', 'released'].includes(row.stage)) fail('recovery_ticket_consumed');
    if (bootState(row.boot_id, deps) !== 'same') fail('recovery_ticket_boot_mismatch');
    if (directory(projectDir) !== row.project_dir) fail('recovery_ticket_project_mismatch');
    const owner = fleet.status({ root, projectDir }, deps).claims[0];
    if (owner) fail('recovery_project_owned');
    lineage = { recovery_id: recoveryId, previous_run_id: row.previous_run_id, context_refs: row.context_refs };
    return { ...row, stage: 'consumed', consumed_at: new Date().toISOString(), consumer_pid: process.pid };
  }); return lineage;
}
function recordPrepared({ root = rootDefault(), recoveryId, runId } = {}, deps) {
  return updateTicket(root, recoveryId, deps, row => {
    if (bootState(row.boot_id, deps) !== 'same') fail('recovery_ticket_boot_mismatch');
    if (row.stage !== 'consumed' || row.new_run_id !== null) fail('recovery_ticket_consumed');
    if (row.consumer_pid !== process.pid) fail('recovery_consumer_mismatch');
    const run = readRun(root, runId);
    if (!run || run.project_id !== row.project_id || run.project_dir !== row.project_dir || run.recovery?.recovery_id !== recoveryId
        || run.recovery.previous_run_id !== row.previous_run_id || digest(run.recovery.context_refs) !== digest(row.context_refs)) fail('recovery_prepared_mismatch');
    return { ...row, stage: 'prepared', new_run_id: runId };
  });
}
function recordResult({ root = rootDefault(), recoveryId, result } = {}, deps) {
  if (!validResult(result)) fail('recovery_result_invalid');
  return updateTicket(root, recoveryId, deps, row => {
    if (row.new_run_id !== result.run_id) fail('recovery_result_mismatch');
    return { ...row, result: { ...result } };
  });
}
function latest(root, projectId) {
  const p = optional(path.join(base(root), 'latest', `${projectId}.json`), 8192);
  if (!p) return null;
  if (!only(p, ['schema_version', 'project_id', 'recovery_id']) || p.schema_version !== 1 || p.project_id !== projectId) fail('recovery_ticket_invalid');
  const row = readTicket(root, p.recovery_id); if (row.project_id !== projectId) fail('recovery_ticket_invalid'); return row;
}
function terminal(root, ticket) {
  if (!ticket.new_run_id) return false;
  const run = readRun(root, ticket.new_run_id); if (!run || run.project_id !== ticket.project_id || run.recovery?.recovery_id !== ticket.recovery_id) return false;
  const exit = optional(path.join(root, 'runs', run.run_id, 'exit.json'), 8192);
  if (exit && only(exit, ['occurred_at']) && iso(exit.occurred_at) && Date.parse(exit.occurred_at) >= Date.parse(run.registered_at)) return true;
  const receipt = optional(path.join(root, 'fleet', 'receipts', `${run.run_id}.json`), 16384), claim = receipt?.claim;
  const coordinator = optional(path.join(root, 'fleet', 'coordinator.json'), 8192);
  return Boolean(only(receipt, ['schema_version', 'coordinator_id', 'project_id', 'project_dir', 'run_id', 'status', 'reason', 'identity', 'released_at', 'claim'])
    && receipt.schema_version === 1 && receipt.status === 'released' && receipt.run_id === run.run_id
    && receipt.project_id === run.project_id && receipt.project_dir === run.project_dir && iso(receipt.released_at)
    && Date.parse(receipt.released_at) >= Date.parse(run.registered_at) && /^fleet-[a-f0-9-]{36}$/.test(receipt.coordinator_id || '')
    && coordinator?.coordinator_id === receipt.coordinator_id && coordinator?.root_id === digest(root)
    && only(claim, ['schema_version', 'coordinator_id', 'project_id', 'project_dir', 'run_id', 'status', 'identity', 'session_id', 'tmux', 'created_at', 'bound_at', 'boot_id'])
    && claim.schema_version === 1 && claim.run_id === run.run_id && claim.project_id === run.project_id && claim.project_dir === run.project_dir
    && claim.coordinator_id === receipt.coordinator_id && iso(claim.created_at) && ['pending', 'bound'].includes(claim.status)
    && digest(receipt.identity) === digest(claim.identity)
    && (receipt.reason === 'prior_boot_interrupted' && validBootId(claim.boot_id)
      || receipt.reason === 'pending_launch_aborted' && claim.status === 'pending' && claim.identity === null
      || ['bound_process_dead', 'bound_process_replaced'].includes(receipt.reason) && claim.status === 'bound' && iso(claim.bound_at)
        && Number.isSafeInteger(claim.identity?.pid) && claim.identity.pid > 0 && /^\d+$/.test(claim.identity.start_time) && absolute(claim.identity.executable)));
}
function sessionExists(name) {
  try { execFileSync('tmux', ['has-session', '-t', `=${name}`], { stdio: 'pipe', timeout: 3000, maxBuffer: 4096 }); return true; }
  catch (e) { if (e.status === 1) return false; fail('recovery_tmux_unavailable'); }
}
function verifyBinding(claim, name) {
  if (!claim.active || !claim.tmux?.pane_id || (claim.tmux.session_name && claim.tmux.session_name !== name)) return false;
  try {
    const lines = execFileSync('tmux', ['list-panes', '-t', `=${name}`, '-F', '#{pane_id}\t#{pane_pid}'], { encoding: 'utf8', timeout: 3000, maxBuffer: 8192 }).trim().split('\n');
    const row = lines.map(line => line.split('\t')).find(fields => fields[0] === claim.tmux.pane_id);
    const panePid = Number(row?.[1]); if (!Number.isSafeInteger(panePid) || panePid < 1) return false;
    let pid = claim.identity.pid;
    for (let i = 0; i < 32 && pid > 1; i++) {
      if (pid === panePid) return true;
      const bytes = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); if (bytes.length > 8192) return false;
      pid = Number(bytes.slice(bytes.lastIndexOf(')') + 2).split(/\s+/)[1]);
    }
  } catch {} return false;
}
function coverage(root, projectId, runId) {
  const result = { native: { status: 'pending', last_received_at: null }, operational: { status: 'unknown', scope: 'project', last_received_at: null, gaps: null, pending_bytes: null } };
  try {
    const snapshot = optional(path.join(root, 'monitor', 'latest.json'));
    const age = Date.now() - Date.parse(snapshot?.generated_at);
    if (snapshot?.schema_version !== 1 || !Number.isFinite(age) || age < -5000 || age > 10 * 60 * 1000 || !Array.isArray(snapshot.projects)) return result;
    const project = snapshot.projects.find(row => row.project_id === projectId), run = project?.runs?.find(row => row.run_id === runId), registration = readRun(root, runId);
    const received = Date.parse(run?.last_received_at);
    if (run?.native_status === 'observed' && registration && received >= Date.parse(registration.registered_at) && received <= Date.now() + 5000)
      result.native = { status: 'observed', last_received_at: run.last_received_at };
    else if (run?.native_status === 'stale_or_idle') result.native.status = 'stale_or_idle';
    if (project?.operational) {
      const op = project.operational;
      result.operational = { status: ['observed', 'degraded', 'unavailable'].includes(op.status) ? op.status : 'unknown', scope: 'project',
        last_received_at: iso(op.last_received_at) ? op.last_received_at : null,
        gaps: Number.isSafeInteger(op.gaps) && op.gaps >= 0 ? op.gaps : null,
        pending_bytes: Number.isSafeInteger(op.pending_bytes) && op.pending_bytes >= 0 ? op.pending_bytes : null };
    }
  } catch {} return result;
}
function provenance(row, options) {
  const state = availability(row); if (state !== 'available') fail(`recovery_${state}`);
  for (const name of ['scriptsDir', 'agentsDir', 'sourceDir']) directory(options[name]);
  const launcher = path.join(options.scriptsDir, 'sgsd-remote-tmux.sh'); safePath(launcher);
  if (!fs.existsSync(launcher)) fail('recovery_launcher_missing');
  let sha; try { sha = execFileSync('git', ['-C', options.sourceDir, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8', timeout: 5000, maxBuffer: 4096 }).trim(); }
  catch { fail('recovery_source_unavailable'); }
  const pin = path.join(row.project_dir, '.super-gsd-version'); safePath(pin);
  if (!fs.existsSync(pin) || fs.statSync(pin).size > 256) fail('recovery_provenance_mismatch');
  if (!/^[a-f0-9]{40}$/.test(sha) || fs.readFileSync(pin, 'utf8').trim() !== sha) fail('recovery_provenance_mismatch');
  return launcher;
}
function launch({ command, args, root }) {
  return new Promise(resolve => {
    const child = spawn(command, args, { stdio: 'ignore', windowsHide: true, env: { ...process.env, SGSD_ATLAS_GLOBAL_ROOT: root } });
    // Timeout stops waiting, not the launcher/provider. A consumed or pending
    // ticket remains a retry blocker until its exact owner is reconciled.
    const timer = setTimeout(() => { child.unref(); resolve({ code: null, reason: 'recovery_launch_timeout' }); }, 45000);
    child.once('error', () => { clearTimeout(timer); resolve({ code: null, reason: 'recovery_launch_failed' }); });
    child.once('exit', code => { clearTimeout(timer); resolve({ code }); });
  });
}
async function restore(options = {}, deps = {}) {
  const root = options.root || rootDefault(), ids = options.projectIds;
  if (!Array.isArray(ids) || !ids.length) fail('recovery_selection_required');
  if (ids.length > MAX_ENTRIES || ids.some(id => !HEX.test(id)) || new Set(ids).size !== ids.length) fail('recovery_selection_invalid');
  const boot = currentBootId(deps); if (!boot) fail('recovery_boot_unavailable');
  const unlock = lock(root, 'restore', deps), results = [];
  try {
    for (const projectId of ids) {
      let ticket = null;
      try {
        const inventory = list({ root }, deps), entry = inventory.entries.find(row => row.project_id === projectId);
        if (!entry) fail(inventory.blockers.find(row => row.project_id === projectId)?.reason || 'recovery_workspace_not_remembered');
        const owner = fleet.status({ root }, deps).claims.find(row => row.project_id === projectId);
        if (owner?.active) {
          const attempt = latest(root, projectId);
          const sessionName = attempt?.new_run_id === owner.run_id ? attempt.session_name : owner.tmux?.session_name;
          const tmuxVerified = NAME.test(sessionName || '') && (deps.verifyBinding || verifyBinding)(owner, sessionName);
          if (attempt?.new_run_id === owner.run_id && !tmuxVerified) fail('recovery_binding_unconfirmed');
          results.push({ project_id: projectId, status: 'already_running', run_id: owner.run_id,
            session_name: sessionName || null, attach_command: tmuxVerified ? `tmux attach -t =${sessionName}` : null,
            context_status: entry.context_status, ...coverage(root, projectId, owner.run_id) }); continue;
        }
        const launcher = provenance(entry, options);
        if (owner && !['dead', 'reused', 'prior_boot'].includes(owner.process_state)) fail(owner.status === 'pending' ? 'recovery_pending_owner' : 'recovery_owner_unknown');
        const prior = latest(root, projectId), exists = deps.sessionExists || sessionExists;
        if (exists(entry.preferred_session)) fail('recovery_session_collision');
        if (prior && ['consumed', 'prepared'].includes(prior.stage) && bootState(prior.boot_id, deps) !== 'prior' && !owner) {
          if (!terminal(root, prior)) fail(prior.new_run_id ? 'recovery_prepared_unconfirmed' : 'recovery_consumption_incomplete');
        }
        const previousRun = owner?.run_id || prior?.new_run_id || entry.previous_run_id;
        const now = new Date().toISOString();
        const saved = { ...entry, previous_run_id: previousRun, context_refs: refs(entry.project_dir), updated_at: now };
        delete saved.source; delete saved.availability; delete saved.owner; delete saved.context_status;
        locked(root, 'catalog', deps, () => {
          const current = catalog(root);
          if (current.forgotten.some(row => row.project_id === projectId)) fail('recovery_workspace_forgotten');
          const remembered = current.entries.find(row => row.project_id === projectId);
          if (remembered && remembered.previous_run_id !== entry.previous_run_id) fail('recovery_catalog_changed');
          return put(root, current, saved);
        });
        ticket = { schema_version: 1, recovery_id: `recovery-${crypto.randomUUID()}`, project_id: projectId, project_dir: entry.project_dir,
          previous_run_id: previousRun, context_refs: saved.context_refs, context_status: entry.context_status, session_name: entry.preferred_session, boot_id: boot,
          stage: 'selected', created_at: now, consumed_at: null, consumer_pid: null, new_run_id: null, result: null };
        durable(ticketPath(root, ticket.recovery_id), ticket, 16384);
        durable(path.join(base(root), 'latest', `${projectId}.json`), { schema_version: 1, project_id: projectId, recovery_id: ticket.recovery_id }, 8192);
        if (owner) fleet.release({ root, runId: owner.run_id }, deps);
        ticket = updateTicket(root, ticket.recovery_id, deps, row => ({ ...row, stage: 'released' }));
        const args = [launcher, '--restore-id', ticket.recovery_id, '--project', entry.project_dir,
          '--scripts-dir', options.scriptsDir, '--agents-dir', options.agentsDir, '--source-dir', options.sourceDir,
          '--greet', '--no-attach', '--session', entry.preferred_session];
        const dispatched = await (deps.launch || launch)({ command: 'bash', args, root });
        const deadline = Date.now() + (deps.bindingWaitMs ?? 10000); let current;
        do {
          ticket = readTicket(root, ticket.recovery_id);
          current = fleet.status({ root, projectDir: entry.project_dir }, deps).claims.find(row => row.run_id === ticket.new_run_id);
          if (current?.active || !ticket.new_run_id || dispatched?.code !== 0) break;
          if (Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
        } while (Date.now() < deadline);
        const bound = current?.active && (deps.verifyBinding || verifyBinding)(current, entry.preferred_session);
        const ended = !current?.active && ticket.new_run_id && terminal(root, ticket);
        const status = bound ? 'restored' : ended ? 'failed' : ticket.new_run_id ? 'pending' : 'failed';
        const reason = bound ? null : ended ? 'recovery_launch_terminated' : ticket.new_run_id ? 'recovery_binding_unconfirmed' : 'recovery_launch_unprepared';
        recordResult({ root, recoveryId: ticket.recovery_id, result: { status, reason, run_id: ticket.new_run_id } }, deps);
        results.push({ project_id: projectId, recovery_id: ticket.recovery_id, status, reason, run_id: ticket.new_run_id,
          previous_run_id: previousRun, session_name: entry.preferred_session, attach_command: bound ? `tmux attach -t =${entry.preferred_session}` : null,
          context_status: ticket.context_status, ...coverage(root, projectId, ticket.new_run_id) });
      } catch (error) {
        const reason = /^(recovery_|fleet_|unsafe_|invalid_recovery_)[a-z_]+$/.test(error.message) ? error.message : 'recovery_operation_failed';
        if (ticket) { try { recordResult({ root, recoveryId: ticket.recovery_id, result: { status: 'blocked', reason, run_id: ticket.new_run_id } }, deps); } catch {} }
        results.push({ project_id: projectId, status: 'blocked', reason, recovery_id: ticket?.recovery_id || null, attach_command: null });
      }
    }
    return { schema_version: 1, boot_id: boot, results };
  } finally { unlock(); }
}
async function main(argv = process.argv.slice(2)) {
  const command = argv.shift(), flags = {}, ids = [];
  const allowed = { list: ['--root'], offer: ['--root', '--acknowledge'], forget: ['--root', '--project-id'],
    restore: ['--root', '--project-id', '--all', '--scripts-dir', '--agents-dir', '--source-dir'] };
  if (!allowed[command]) fail('recovery_command_invalid');
  while (argv.length) {
    const flag = argv.shift(); if (!allowed[command].includes(flag) || (flag !== '--project-id' && Object.hasOwn(flags, flag))) fail('recovery_argument_invalid');
    if (['--acknowledge', '--all'].includes(flag)) flags[flag] = true;
    else { if (!argv.length || argv[0].startsWith('--')) fail('recovery_argument_invalid'); const value = argv.shift();
      if (flag === '--project-id') ids.push(value); else flags[flag] = value; }
  }
  const root = flags['--root'] ? path.resolve(flags['--root']) : rootDefault();
  if (command === 'list') return list({ root });
  if (command === 'offer') return offer({ root, acknowledge: flags['--acknowledge'] === true });
  if (command === 'forget') { if (ids.length !== 1) fail('recovery_argument_invalid'); return forget({ root, projectId: ids[0] }); }
  if (flags['--all'] && ids.length) fail('recovery_selection_invalid');
  const inventory = flags['--all'] ? list({ root }) : null;
  return restore({ root, projectIds: inventory ? [...new Set([...inventory.entries, ...inventory.blockers].map(row => row.project_id))] : ids,
    scriptsDir: flags['--scripts-dir'], agentsDir: flags['--agents-dir'], sourceDir: flags['--source-dir'] });
}
if (require.main === module) main().then(result => { process.stdout.write(JSON.stringify(result) + '\n');
  if (result.results?.some(row => !['restored', 'already_running'].includes(row.status))) process.exitCode = 2;
}).catch(error => { process.stderr.write(`SGSD_RECOVERY: ${/^recovery_[a-z_]+$/.test(error.message) ? error.message : 'recovery_operation_failed'}\n`); process.exitCode = 2; });
module.exports = Object.freeze({ remember, refresh, list, forget, offer, restore, consumeTicket, recordPrepared, recordResult });
