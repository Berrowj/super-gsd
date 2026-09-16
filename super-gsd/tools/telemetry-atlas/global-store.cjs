'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStore, digest, appendGap, safePath, validate } = require('./contract.cjs');
const { privateDirectory } = require('./quota-sampler.cjs');
const { NATIVE_SOURCE, scopeReason, applyAuthority, classifyAccounting } = require('./accounting.cjs');
const RUN = /^sgsd-[a-f0-9-]{36}$/;
const ROLES = new Set(['orchestrator', 'executor', 'reviewer', 'planner', 'verifier', 'narrator', 'board', 'recovery', 'observer']);
const RECOVERY = /^recovery-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const NATIVE_ID = /^[A-Za-z0-9._:-]{1,160}$/;
const BOOT_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const CONTEXT_PATH = /^\.planning\/(?:STATE\.md|HANDOFF\.json|ORCHESTRATOR-CHECKPOINT\.md|analyses\/[A-Za-z0-9_-]{1,120}fleet-handover[A-Za-z0-9_.-]{0,100}\.md)$/;
function validContextRefs(refs) {
  return Array.isArray(refs) && refs.length <= 8 && new Set(refs.map(row => row?.path)).size === refs.length
    && refs.every(row => row && typeof row === 'object' && !Array.isArray(row)
      && Object.keys(row).length === 3 && Object.keys(row).every(key => ['path', 'sha256', 'bytes'].includes(key))
      && typeof row.path === 'string' && CONTEXT_PATH.test(row.path) && !row.path.includes('..')
      && /^[a-f0-9]{64}$/.test(row.sha256) && Number.isSafeInteger(row.bytes) && row.bytes >= 0 && row.bytes <= 1024 * 1024);
}
function validNativeBinding(value, expected = {}) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 11
    && Object.keys(value).every(key => ['schema_version', 'provider', 'accounting_source', 'project_id', 'project_dir',
      'session_id', 'thread_id', 'pid', 'start_time', 'boot_id', 'executable'].includes(key))
    && value.schema_version === 1 && value.provider === 'openai' && value.accounting_source === 'codex_rollout'
    && typeof value.project_id === 'string' && /^[a-f0-9]{64}$/.test(value.project_id)
    && typeof value.project_dir === 'string' && path.isAbsolute(value.project_dir) && !/[\x00-\x1f\x7f]/.test(value.project_dir)
    && NATIVE_ID.test(value.session_id || '') && NATIVE_ID.test(value.thread_id || '')
    && Number.isSafeInteger(value.pid) && value.pid > 0 && value.pid <= 2147483647
    && typeof value.start_time === 'string' && /^\d{1,32}$/.test(value.start_time)
    && BOOT_ID.test(value.boot_id || '') && typeof value.executable === 'string' && path.isAbsolute(value.executable)
    && !/[\x00-\x1f\x7f]/.test(value.executable)
    && (expected.project_id === undefined || value.project_id === expected.project_id)
    && (expected.project_dir === undefined || value.project_dir === expected.project_dir);
}
function recoveryShape(scope, recovery) {
  if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)
      || Object.keys(recovery).length !== 3 || Object.keys(recovery).some(key => !['recovery_id', 'previous_run_id', 'context_refs'].includes(key))
      || !RECOVERY.test(recovery.recovery_id || '') || !RUN.test(recovery.previous_run_id || '')
      || recovery.previous_run_id === scope.run_id || !validContextRefs(recovery.context_refs)
      || scope.role !== 'orchestrator' || scope.provider !== 'anthropic') throw new Error('invalid_recovery_lineage');
}
function validateRecovery(root, scope, recovery, validatePredecessor = true) {
  recoveryShape(scope, recovery);
  // New lineage checks the predecessor as a reader would. readRun validates its
  // immediate edge, not an unbounded historical chain (no recursive disk walk).
  const prior = validatePredecessor ? readRun(root, recovery.previous_run_id) : readRegistration(root, recovery.previous_run_id);
  if (!prior || prior.role !== 'orchestrator' || prior.provider !== 'anthropic'
      || prior.project_id !== scope.project_id || prior.project_dir !== scope.project_dir) throw new Error('invalid_recovery_lineage');
  return Object.freeze({ recovery_id: recovery.recovery_id, previous_run_id: recovery.previous_run_id,
    context_refs: Object.freeze(recovery.context_refs.map(row => Object.freeze({ ...row }))) });
}

function readJson(file, limit = 8192) {
  safePath(file);
  const info = fs.statSync(file);
  if (info.size > limit) throw new Error('atlas_metadata_too_large');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
  privateDirectory(path.dirname(file)); safePath(file);
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value) + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function registerRun({ root, projectDir, provider = 'anthropic', role = 'orchestrator', accountingSource, recovery, native_binding }) {
  if (accountingSource !== undefined && (accountingSource !== 'codex_rollout' || provider !== 'openai')) throw new Error('invalid_accounting_source');
  projectDir = fs.realpathSync(path.resolve(projectDir));
  while (!fs.existsSync(path.join(projectDir, '.planning'))) {
    const parent = path.dirname(projectDir);
    if (parent === projectDir) throw new Error('not_sgsd_project');
    projectDir = parent;
  }
  if (!fs.statSync(path.join(projectDir, '.planning')).isDirectory()) throw new Error('not_sgsd_project');
  if (!['anthropic', 'openai'].includes(provider) || !ROLES.has(role)) throw new Error('invalid_run_scope');
  if (native_binding !== undefined && (!validNativeBinding(native_binding, { project_id: digest(projectDir), project_dir: projectDir })
      || provider !== native_binding.provider || accountingSource !== native_binding.accounting_source || role !== 'executor')) throw new Error('invalid_native_binding');
  privateDirectory(root);
  const projectId = digest(projectDir);
  const lineage = recovery === undefined ? undefined : validateRecovery(root, { project_id: projectId, project_dir: projectDir, provider, role }, recovery);
  const projectState = path.join(root, 'projects', projectId);
  privateDirectory(projectState);
  const registration = { schema_version: 1, project_id: projectId, project_dir: projectDir };
  writeJson(path.join(projectState, 'project.json'), registration);
  const runId = `sgsd-${crypto.randomUUID()}`;
  const stateDir = path.join(root, 'runs', runId);
  const run = Object.freeze({ ...registration, run_id: runId, provider, role, registered_at: new Date().toISOString(),
    ...(accountingSource === undefined ? {} : { accountingSource }),
    ...(native_binding === undefined ? {} : { native_binding }),
    ...(lineage === undefined ? {} : { recovery: lineage }),
    state_dir: stateDir, metrics_dir: path.join(projectState, 'metrics') });
  // Registration is local authority. Neither telemetry bodies nor URLs can supply a disk path.
  const registrationFile = path.join(stateDir, 'registration.json');
  writeJson(registrationFile, run);
  if (lineage !== undefined) {
    // A recovery ticket must never durably name a registration whose bytes are
    // still only in the page cache when power is lost.
    flushRunRegistration({ root, runId, projectId, projectDir });
  }
  return run;
}
function readRegistration(root, runId) {
  if (!RUN.test(runId || '')) return null;
  try {
    const run = readJson(path.join(root, 'runs', runId, 'registration.json'));
    if (run.schema_version !== 1 || typeof run.registered_at !== 'string' || !Number.isFinite(Date.parse(run.registered_at))
        || typeof run.project_dir !== 'string' || !path.isAbsolute(run.project_dir) || /[\x00-\x1f\x7f]/.test(run.project_dir)
        || run.run_id !== runId || !/^[a-f0-9]{64}$/.test(run.project_id)
        || digest(run.project_dir) !== run.project_id || !ROLES.has(run.role)
        || !['anthropic','openai'].includes(run.provider)
        || (run.accountingSource !== undefined && (run.accountingSource !== 'codex_rollout' || run.provider !== 'openai'))) return null;
    if (run.recovery !== undefined) recoveryShape(run, run.recovery);
    if (run.native_binding !== undefined && (!validNativeBinding(run.native_binding, { project_id: run.project_id, project_dir: run.project_dir })
        || run.provider !== run.native_binding.provider || run.accountingSource !== run.native_binding.accounting_source || run.role !== 'executor')) return null;
    return Object.freeze({ ...run, state_dir: path.join(root, 'runs', runId),
      metrics_dir: path.join(root, 'projects', run.project_id, 'metrics') });
  } catch { return null; }
}
function readRun(root, runId) {
  const run = readRegistration(root, runId);
  if (!run || run.recovery === undefined) return run;
  try { return Object.freeze({ ...run, recovery: validateRecovery(root, run, run.recovery, false) }); } catch { return null; }
}
function flushRunRegistration({ root, runId, projectId, projectDir }) {
  const run = readRun(root, runId);
  if (!run || run.project_id !== projectId || run.project_dir !== projectDir) throw new Error('recovery_catalog_unregistered');
  const file = path.join(run.state_dir, 'registration.json'); safePath(file);
  const before = fs.statSync(file), fd = fs.openSync(file, fs.constants.O_RDWR | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino || !opened.isFile() || opened.nlink !== 1) throw new Error('recovery_registration_changed');
    fs.fsyncSync(fd);
    const current = fs.statSync(file);
    if (current.dev !== opened.dev || current.ino !== opened.ino || digest(readRun(root, runId)) !== digest(run)) throw new Error('recovery_registration_changed');
  } finally { fs.closeSync(fd); }
  // Flush the file's name, the new run directory, and (when first created) the
  // runs/root directory links before a durable catalog or ticket references it.
  if (process.platform !== 'win32') for (const directory of new Set([run.state_dir, path.dirname(run.state_dir), root, path.dirname(root)])) {
    safePath(path.join(directory, '.registration-directory-check'));
    const parent = fs.openSync(directory, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0) | (fs.constants.O_NOFOLLOW || 0));
    try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
  }
  return run;
}
function readCoordination(root, runId) {
  return require('./supervised-coordination.cjs').readCoordination(root, runId);
}
function validCoordinationBinding(value, expected = {}) {
  return require('./supervised-coordination.cjs').validCoordinationBinding(value, expected);
}
function scopeEvent(event, run) {
  if (!run) throw new Error('unregistered_run');
  // Native envelopes already carry exact producer bindings. Never rewrite a
  // different thread's registration into the private spool's route.
  if (event.source?.kind === NATIVE_SOURCE) {
    const reason = validate(event) || scopeReason(event, run);
    if (reason) throw new Error(reason);
    return event;
  }
  if (event.runtime?.provider && event.runtime.provider !== run.provider) throw new Error('provider_scope_mismatch');
  if ((event.source?.kind === 'claude_otel' && run.provider !== 'anthropic')
      || (event.source?.kind === 'codex_otel' && run.provider !== 'openai')) throw new Error('provider_scope_mismatch');
  return { ...event, identity: { ...event.identity, sgsd_run_id: run.run_id },
    scope: { ...event.scope, launcher_repo_id: run.project_id,
      role: event.runtime?.query_source === 'subagent' ? 'subagent' : run.role,
      cost_center: run.role, attribution_method: 'launcher_registration' } };
}
function createGlobalStore(root) {
  const stores = new Map();
  const spoolIntakes = new WeakMap();
  const gap = reason => { try { appendGap(path.join(root, 'sgsd-atlas-gaps.jsonl'), reason); } catch { /* fail open */ } };
  const directories = new Map();
  const authority = runId => require('./supervised-coordination.cjs').resolveNativeAuthority(root, runId);
  function ingest(event, intake) {
    const invalid = validate(event);
    if (invalid) return { status: 'rejected', reason: invalid };
    const run = authority(event.identity?.sgsd_run_id);
    if (!run || (run.scope === 'supervised_coordination'
      ? event.scope?.coordination_id !== run.coordination_id : event.scope?.launcher_repo_id !== run.project_id)) {
      gap('unregistered_run'); return { status: 'rejected', reason: 'unregistered_run' };
    }
    if (event.source.kind === NATIVE_SOURCE && (!intake || spoolIntakes.get(intake) !== run.run_id)) {
      gap('native_private_spool_required'); return { status: 'rejected', reason: 'native_private_spool_required' };
    }
    const scopeInvalid = scopeReason(event, run);
    if (scopeInvalid) { gap(scopeInvalid); return { status: 'rejected', reason: scopeInvalid }; }
    const scoped = applyAuthority(event, run), accounting = classifyAccounting(scoped, run);
    if (accounting.reason) { gap(accounting.reason); return { status: 'rejected', reason: accounting.reason }; }
    try {
      const storeId = run.source_hash;
      let store = stores.get(storeId);
      if (!store) {
        if (stores.size >= 8) stores.delete(stores.keys().next().value);
        store = createStore({ metricsDir: run.ledger_dir, maxIndexEntries: 25000, maxBytes: 128 * 1024 * 1024 });
      }
      stores.delete(storeId); stores.set(storeId, store);
      return { ...store.ingest(scoped), accounting };
    } catch { gap('project_storage_unavailable'); return { status: 'rejected', reason: 'storage_unavailable' }; }
  }
  function spoolSources() {
    const result = [];
    for (const [kind, name] of [['project', 'runs'], ['coordination', 'coordination-runs']]) try {
      let directory = directories.get(kind);
      if (!directory) { directory = fs.opendirSync(path.join(root, name)); directories.set(kind, directory); }
      for (let i = 0; i < 32; i++) {
        const entry = directory.readSync();
        if (!entry) { directory.closeSync(); directories.delete(kind); break; }
        if (!entry.isDirectory() || (kind === 'project' ? !RUN.test(entry.name) : !/^coord-[a-f0-9-]{36}$/.test(entry.name))) continue;
        // Project spools include legacy ordinary registrations without native
        // bindings. Keep that route compatible; coordination spools are
        // always resolved through the stricter supervised authority.
        const run = kind === 'project' ? readRun(root, entry.name) : authority(entry.name);
        if (run) {
          // Unserializable, receiver-local authority: the server passes this only
          // after its bounded read of this exact registered private spool route.
          const intake = Object.freeze({}); spoolIntakes.set(intake, run.run_id);
          result.push({ directory: path.join(run.state_dir, 'quota-spool'), route: run, intake });
        }
      }
    } catch { const directory = directories.get(kind); if (directory) { try { directory.closeSync(); } catch {} directories.delete(kind); } }
    return result;
  }
  return { ingest, gap, spoolSources, scopeEvent,
    resolveRoute: url => {
      const match = /^\/(runs|coordination-runs)\/((?:sgsd|coord)-[a-f0-9-]{36})\/v1\/(logs|metrics|events)$/.exec(url);
      if (match && match[1] === 'runs' && !/^sgsd-/.test(match[2])) return null;
      if (match && match[1] === 'coordination-runs' && !/^coord-/.test(match[2])) return null;
      // Ordinary HTTP intake predates native authority and must continue to
      // serve registered legacy runs. Coordination routes remain fail-closed
      // through the supervised resolver.
      const run = match && (match[1] === 'runs' ? readRun(root, match[2]) : authority(match[2]));
      return run ? { ...run, pathname: `/v1/${match[3]}` } : null;
    },
    status: () => ({ healthy: true, coverage: 'partial', partition_id: 'per_project',
      reason: null, degraded_projects: [...stores.values()].filter(store => !store.status().healthy).length }),
    close: () => { for (const directory of directories.values()) directory.closeSync(); directories.clear(); stores.clear(); },
  };
}
module.exports = { registerRun, readRun, readCoordination, readJson, writeJson, createGlobalStore, scopeEvent, RUN, RECOVERY,
  validContextRefs, validNativeBinding, validCoordinationBinding, validateRecovery, flushRunRegistration };
