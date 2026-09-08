'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createStore, digest, appendGap, safePath, validate } = require('./contract.cjs');
const { privateDirectory } = require('./quota-sampler.cjs');
const { NATIVE_SOURCE, scopeReason, applyAuthority, classifyAccounting } = require('./accounting.cjs');
const RUN = /^sgsd-[a-f0-9-]{36}$/;
const ROLES = new Set(['orchestrator', 'executor', 'reviewer', 'planner', 'verifier', 'narrator', 'board', 'recovery', 'observer']);

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
function registerRun({ root, projectDir, provider = 'anthropic', role = 'orchestrator', accountingSource }) {
  if (accountingSource !== undefined && (accountingSource !== 'codex_rollout' || provider !== 'openai')) throw new Error('invalid_accounting_source');
  projectDir = fs.realpathSync(path.resolve(projectDir));
  while (!fs.existsSync(path.join(projectDir, '.planning'))) {
    const parent = path.dirname(projectDir);
    if (parent === projectDir) throw new Error('not_sgsd_project');
    projectDir = parent;
  }
  if (!fs.statSync(path.join(projectDir, '.planning')).isDirectory()) throw new Error('not_sgsd_project');
  if (!['anthropic', 'openai'].includes(provider) || !ROLES.has(role)) throw new Error('invalid_run_scope');
  privateDirectory(root);
  const projectId = digest(projectDir);
  const projectState = path.join(root, 'projects', projectId);
  privateDirectory(projectState);
  const registration = { schema_version: 1, project_id: projectId, project_dir: projectDir };
  writeJson(path.join(projectState, 'project.json'), registration);
  const runId = `sgsd-${crypto.randomUUID()}`;
  const stateDir = path.join(root, 'runs', runId);
  const run = Object.freeze({ ...registration, run_id: runId, provider, role, registered_at: new Date().toISOString(),
    ...(accountingSource === undefined ? {} : { accountingSource }),
    state_dir: stateDir, metrics_dir: path.join(projectState, 'metrics') });
  // Registration is local authority. Neither telemetry bodies nor URLs can supply a disk path.
  writeJson(path.join(stateDir, 'registration.json'), run);
  return run;
}
function readRun(root, runId) {
  if (!RUN.test(runId || '')) return null;
  try {
    const run = readJson(path.join(root, 'runs', runId, 'registration.json'));
    if (run.run_id !== runId || !/^[a-f0-9]{64}$/.test(run.project_id)
        || digest(run.project_dir) !== run.project_id || !ROLES.has(run.role)
        || !['anthropic','openai'].includes(run.provider)
        || (run.accountingSource !== undefined && (run.accountingSource !== 'codex_rollout' || run.provider !== 'openai'))) return null;
    return Object.freeze({ ...run, state_dir: path.join(root, 'runs', runId),
      metrics_dir: path.join(root, 'projects', run.project_id, 'metrics') });
  } catch { return null; }
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
  let directory = null;
  function ingest(event, intake) {
    const invalid = validate(event);
    if (invalid) return { status: 'rejected', reason: invalid };
    const run = readRun(root, event.identity?.sgsd_run_id);
    if (!run || event.scope?.launcher_repo_id !== run.project_id) {
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
      let store = stores.get(run.project_id);
      if (!store) {
        if (stores.size >= 8) stores.delete(stores.keys().next().value);
        store = createStore({ metricsDir: run.metrics_dir, maxIndexEntries: 25000, maxBytes: 128 * 1024 * 1024 });
      }
      stores.delete(run.project_id); stores.set(run.project_id, store);
      return { ...store.ingest(scoped), accounting };
    } catch { gap('project_storage_unavailable'); return { status: 'rejected', reason: 'storage_unavailable' }; }
  }
  function spoolSources() {
    const result = [];
    try {
      if (!directory) directory = fs.opendirSync(path.join(root, 'runs'));
      for (let i = 0; i < 32; i++) {
        const entry = directory.readSync();
        if (!entry) { directory.closeSync(); directory = null; break; }
        if (!entry.isDirectory() || !RUN.test(entry.name)) continue;
        const run = readRun(root, entry.name);
        if (run) {
          // Unserializable, receiver-local authority: the server passes this only
          // after its bounded read of this exact registered private spool route.
          const intake = Object.freeze({}); spoolIntakes.set(intake, run.run_id);
          result.push({ directory: path.join(run.state_dir, 'quota-spool'), route: run, intake });
        }
      }
    } catch { if (directory) { try { directory.closeSync(); } catch {} directory = null; } }
    return result;
  }
  return { ingest, gap, spoolSources, scopeEvent,
    resolveRoute: url => {
      const match = /^\/runs\/(sgsd-[a-f0-9-]{36})\/v1\/(logs|metrics|events)$/.exec(url);
      const run = match && readRun(root, match[1]);
      return run ? { ...run, pathname: `/v1/${match[2]}` } : null;
    },
    status: () => ({ healthy: true, coverage: 'partial', partition_id: 'per_project',
      reason: null, degraded_projects: [...stores.values()].filter(store => !store.status().healthy).length }),
    close: () => { if (directory) directory.closeSync(); directory = null; stores.clear(); },
  };
}
module.exports = { registerRun, readRun, readJson, writeJson, createGlobalStore, scopeEvent, RUN };
