#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { canonicalize, digest, safeAppend, safePath, validate } = require('./contract.cjs');
const { classifyAccounting } = require('./accounting.cjs');
const { readJson, readRun, writeJson, RUN } = require('./global-store.cjs');
const { rootPath, status: globalStatus } = require('./global.cjs');
const { privateDirectory } = require('./quota-sampler.cjs');
const { readCaptureState, capturePaths } = require('./sgsd-ledger-runtime.cjs');
const { SOURCES } = require('./sgsd-ledger.cjs');

const HEX = /^[a-f0-9]{64}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/;
const LIMITS = Object.freeze({ projects: 256, runs: 256, spool: 64, files: 64,
  nativeTailBytes: 256 * 1024, receiptTailBytes: 128 * 1024, metadataBytes: 256 * 1024,
  findings: 256, snapshotBytes: 1024 * 1024, incidentBytes: 4 * 1024 * 1024, deadlineMs: 2000 });
const CAPACITY = Object.freeze({ native: 128 * 1024 * 1024,
  operational: 256 * 1024 * 1024, receipts: 256 * 1024 * 1024 });
const STALE_NATIVE_MS = 15 * 60 * 1000;
const STALE_SPOOL_MS = 120 * 1000;
const STALE_BACKUP_MS = 30 * 60 * 60 * 1000;
const CAPACITY_REASONS = new Set(['disk_pressure','receipt_capacity','canonical_size_limit','index_limit']);
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const timestamp = value => typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value));
const finiteCount = value => Number.isSafeInteger(value) && value >= 0;

function finding(target, severity, reason, identity = {}) {
  const row = { severity, reason, ...Object.fromEntries(Object.entries(identity)
    .filter(([key, value]) => ['project_id','run_id','pid'].includes(key) && value != null)) };
  if (target.length < LIMITS.findings - 1) target.push(row);
  else {
    let marker = target.find(item => item.reason === 'finding_limit');
    if (!marker) { marker = { severity: 'WARN', reason: 'finding_limit' }; target.push(marker); }
    if (severity === 'FAIL') marker.severity = 'FAIL';
  }
}

function entries(directory, maximum) {
  if (!fs.existsSync(directory)) return { rows: [], limited: false };
  safePath(path.join(directory, '.atlas-monitor-read'));
  const rows = []; let handle;
  try {
    handle = fs.opendirSync(directory);
    while (rows.length < maximum) { const row = handle.readSync(); if (!row) return { rows, limited: false }; rows.push(row); }
    return { rows, limited: Boolean(handle.readSync()) };
  } finally { try { handle?.closeSync(); } catch {} }
}

function safeStat(file) {
  safePath(file);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
      || (process.getuid && stat.uid !== process.getuid())) throw new Error('unsafe_file');
  return stat;
}

function safeObject(file, maximum) {
  safePath(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || (process.getuid && stat.uid !== process.getuid()))
      throw new Error('unsafe_file');
    if (stat.size > maximum) throw new Error('read_limit');
    const buffer = Buffer.alloc(stat.size), count = stat.size ? fs.readSync(fd, buffer, 0, stat.size, 0) : 0;
    const after = fs.fstatSync(fd);
    if (count !== stat.size || stat.dev !== after.dev || stat.ino !== after.ino
        || stat.size !== after.size || stat.mtimeMs !== after.mtimeMs) throw new Error('file_raced');
    const value = JSON.parse(buffer.toString('utf8'));
    if (!plain(value)) throw new Error('invalid_json');
    return value;
  } finally { fs.closeSync(fd); }
}

function acquire(root) {
  const directory = path.join(root, 'monitor');
  privateDirectory(directory);
  const file = path.join(directory, '.check.lock');
  safePath(file);
  const value = JSON.stringify({ schema_version: 1, pid: process.pid,
    nonce: crypto.randomBytes(16).toString('hex'), started_at: new Date().toISOString() }) + '\n';
  let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL
      | (fs.constants.O_NOFOLLOW || 0), 0o600);
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || fs.writeSync(fd, value) !== Buffer.byteLength(value))
      throw new Error('monitor_lock_unavailable');
    fs.fsyncSync(fd);
  } catch (error) {
    if (fd !== undefined) fs.closeSync(fd);
    if (error.code === 'EEXIST') throw new Error('monitor_check_locked');
    throw error;
  }
  fs.closeSync(fd);
  return () => {
    try { if (fs.readFileSync(file, 'utf8') === value) fs.unlinkSync(file); } catch {}
  };
}

function configuredDirectories(root, supplied, findings) {
  let values = supplied;
  if (values === undefined) {
    const file = path.join(root, 'monitor', 'config.json');
    if (!fs.existsSync(file)) { finding(findings, 'WARN', 'monitor_config_missing'); return []; }
    try {
      const config = safeObject(file, 64 * 1024);
      if (config.schema_version !== 1 || !Array.isArray(config.project_dirs)
          || config.project_dirs.length > 32) throw new Error('invalid');
      values = config.project_dirs;
    } catch (error) {
      finding(findings, 'WARN', error.message === 'read_limit' ? 'monitor_config_limit' : 'monitor_config_invalid');
      return [];
    }
  }
  if (!Array.isArray(values) || values.length > 32) {
    finding(findings, 'WARN', 'monitor_config_invalid'); return [];
  }
  const result = [];
  for (const value of values) {
    if (typeof value !== 'string' || !path.isAbsolute(value)) {
      finding(findings, 'WARN', 'project_dir_invalid'); continue;
    }
    const resolved = path.resolve(value);
    if (!fs.existsSync(resolved)) { result.push({ requested: resolved, directory: null, common: null }); continue; }
    try {
      const stat = fs.lstatSync(resolved);
      if (!stat.isDirectory() || stat.isSymbolicLink()
          || (process.getuid && stat.uid !== process.getuid())) throw new Error();
      const directory = fs.realpathSync(resolved);
      result.push({ requested: resolved, directory, common: commonGitDir(directory) });
    } catch { finding(findings, 'WARN', 'project_dir_unsafe'); }
  }
  return [...new Map(result.map(item => [item.requested, item])).values()];
}

function commonGitDir(directory) {
  try {
    const dotgit = path.join(directory, '.git');
    const stat = fs.lstatSync(dotgit);
    let gitdir;
    if (stat.isDirectory() && !stat.isSymbolicLink()) gitdir = fs.realpathSync(dotgit);
    else {
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4096) return null;
      const match = /^gitdir: ([^\r\n]+)\r?\n?$/.exec(fs.readFileSync(dotgit, 'utf8'));
      if (!match) return null;
      const candidate = path.resolve(directory, match[1]);
      if (!fs.lstatSync(candidate).isDirectory()) return null;
      gitdir = fs.realpathSync(candidate);
    }
    const commonFile = path.join(gitdir, 'commondir');
    if (!fs.existsSync(commonFile)) return gitdir;
    const commonStat = safeStat(commonFile);
    if (commonStat.size > 4096) return null;
    const relative = fs.readFileSync(commonFile, 'utf8').trim();
    if (!relative || path.isAbsolute(relative)) return null;
    const common = path.resolve(gitdir, relative);
    return fs.lstatSync(common).isDirectory() ? fs.realpathSync(common) : null;
  } catch { return null; }
}

function registeredProjects(root, findings, deadline) {
  const directory = path.join(root, 'projects'), output = [];
  try {
    const listed = entries(directory, LIMITS.projects);
    if (listed.limited) finding(findings, 'WARN', 'project_inventory_limit');
    for (const entry of listed.rows) {
      if (Date.now() > deadline) { finding(findings, 'WARN', 'monitor_deadline'); break; }
      if (!entry.isDirectory() || !HEX.test(entry.name)) { finding(findings, 'WARN', 'invalid_project_entry'); continue; }
      try {
        const value = readJson(path.join(directory, entry.name, 'project.json'), 64 * 1024);
        if (value.schema_version !== 1 || value.project_id !== entry.name || !path.isAbsolute(value.project_dir)
            || digest(value.project_dir) !== entry.name) throw new Error();
        output.push({ project_id: entry.name, project_dir: path.resolve(value.project_dir),
          common: fs.existsSync(value.project_dir) ? commonGitDir(fs.realpathSync(value.project_dir)) : null });
      } catch { finding(findings, 'FAIL', 'invalid_project_registration', { project_id: entry.name }); }
    }
  } catch { finding(findings, 'WARN', 'project_inventory_unavailable'); }
  return output;
}

function registeredRuns(root, findings, now, deadline) {
  const output = new Map();
  try {
    const listed = entries(path.join(root, 'runs'), LIMITS.runs);
    if (listed.limited) finding(findings, 'WARN', 'run_inventory_limit');
    for (const entry of listed.rows) {
      if (Date.now() > deadline) { finding(findings, 'WARN', 'monitor_deadline'); break; }
      if (!entry.isDirectory() || !RUN.test(entry.name)) { finding(findings, 'WARN', 'invalid_run_entry'); continue; }
      const run = readRun(root, entry.name);
      if (!run) { finding(findings, 'FAIL', 'invalid_run_registration', { run_id: entry.name }); continue; }
      let closed = false;
      const exit = path.join(run.state_dir, 'exit.json');
      if (fs.existsSync(exit)) {
        try { closed = timestamp(safeObject(exit, 8192).occurred_at); }
        catch { finding(findings, 'WARN', 'run_exit_invalid', { project_id: run.project_id, run_id: run.run_id }); }
      }
      let pending = 0, oldest = null;
      try {
        const listedSpool = entries(path.join(run.state_dir, 'quota-spool'), LIMITS.spool);
        if (listedSpool.limited) finding(findings, 'WARN', 'spool_inventory_limit', { project_id: run.project_id, run_id: run.run_id });
        for (const entry of listedSpool.rows) {
          const file = path.join(run.state_dir, 'quota-spool', entry.name);
          if (!entry.isFile() || !/^[a-f0-9]{64}\.json$/.test(entry.name)) {
            finding(findings, 'FAIL', 'unsafe_spool_entry', { project_id: run.project_id, run_id: run.run_id }); continue;
          }
          try {
            const stat = safeStat(file); pending++; oldest = Math.max(oldest || 0, now - stat.mtimeMs);
          } catch { finding(findings, 'FAIL', 'unsafe_spool_entry', { project_id: run.project_id, run_id: run.run_id }); }
        }
      } catch { finding(findings, 'WARN', 'spool_inventory_unavailable', { project_id: run.project_id, run_id: run.run_id }); }
      if (oldest > STALE_SPOOL_MS) finding(findings, 'WARN', 'spool_backlog_stale',
        { project_id: run.project_id, run_id: run.run_id });
      output.set(run.run_id, { registration: run, closed, pending,
        oldest, lastReceived: null, lastOccurred: null, nativeEvents: 0 });
    }
  } catch { finding(findings, 'WARN', 'run_inventory_unavailable'); }
  return output;
}

function tailLines(file, maximum) {
  const before = safeStat(file), length = Math.min(before.size, maximum), offset = before.size - length;
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const opened = fs.fstatSync(fd), buffer = Buffer.alloc(length);
    if (!opened.isFile() || opened.nlink !== 1 || (process.getuid && opened.uid !== process.getuid())
        || opened.dev !== before.dev || opened.ino !== before.ino || opened.size !== before.size
        || opened.mtimeMs !== before.mtimeMs) throw new Error('file_raced');
    const count = length ? fs.readSync(fd, buffer, 0, length, offset) : 0;
    const after = fs.fstatSync(fd);
    if (count !== length || opened.dev !== after.dev || opened.ino !== after.ino
        || opened.size !== after.size || opened.mtimeMs !== after.mtimeMs) throw new Error('file_raced');
    let text = buffer.toString('utf8');
    if (offset) { const newline = text.indexOf('\n'); text = newline < 0 ? '' : text.slice(newline + 1); }
    const incomplete = text.length > 0 && !text.endsWith('\n');
    if (incomplete) text = text.slice(0, text.lastIndexOf('\n') + 1);
    return { lines: text.split('\n').filter(Boolean), incomplete, limited: offset > 0 };
  } finally { fs.closeSync(fd); }
}

function capacity(directory, pattern, limit, findings, projectId, reason) {
  let used = 0;
  try {
    if (!fs.existsSync(directory)) {
      finding(findings, 'WARN', `${reason}_storage_missing`, { project_id: projectId });
      return { used_bytes: null, limit_bytes: limit, percent: null };
    }
    const listed = entries(directory, LIMITS.files);
    if (listed.limited) throw new Error('limit');
    for (const entry of listed.rows) if (pattern.test(entry.name)) {
      if (!entry.isFile()) throw new Error('unsafe');
      used += safeStat(path.join(directory, entry.name)).size;
    }
    const percent = used / limit * 100;
    if (percent >= 90) finding(findings, 'FAIL', `${reason}_capacity_critical`, { project_id: projectId });
    else if (percent >= 80) finding(findings, 'WARN', `${reason}_capacity_warning`, { project_id: projectId });
    return { used_bytes: used, limit_bytes: limit, percent: Number(percent.toFixed(3)) };
  } catch {
    finding(findings, 'WARN', `${reason}_capacity_unknown`, { project_id: projectId });
    return { used_bytes: null, limit_bytes: limit, percent: null };
  }
}

function nativeSummary(root, project, runs, findings, now, deadline) {
  const directory = path.join(root, 'projects', project.project_id, 'metrics');
  const total = { availability: 'unavailable', scope: null, interval: null, generated_at: null, age_ms: null,
    input_tokens: null, output_tokens: null, total_provider_tokens: null, cache_read_tokens: null,
    cache_creation_tokens: null, reasoning_tokens: null };
  const native = { status: 'unavailable', last_received_at: null, last_occurred_at: null, summary: total };
  let listed;
  try { listed = entries(directory, LIMITS.files); }
  catch { finding(findings, 'WARN', 'native_inventory_unavailable', { project_id: project.project_id }); return native; }
  if (listed.limited) finding(findings, 'WARN', 'native_inventory_limit', { project_id: project.project_id });
  const files = [];
  for (const entry of listed.rows) if (/^sgsd-atlas-events-[A-Za-z0-9._-]+\.jsonl$/.test(entry.name)) {
    const file = path.join(directory, entry.name);
    try { files.push({ file, mtime: safeStat(file).mtimeMs }); }
    catch { finding(findings, 'FAIL', 'unsafe_native_file', { project_id: project.project_id }); }
  }
  files.sort((a, b) => b.mtime - a.mtime);
  const dimensions = ['input_tokens','output_tokens','total_provider_tokens','cache_read_tokens',
    'cache_creation_tokens','reasoning_tokens'];
  const seen = new Set(), observedDimensions = new Set(), values = Object.fromEntries(dimensions.map(key => [key, 0]));
  let consumed = 0, earliest = null, latest = null, received = null, observed = 0;
  let nativeLimited = false;
  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const item = files[fileIndex];
    if (Date.now() > deadline) { finding(findings, 'WARN', 'project_check_deadline', { project_id: project.project_id }); break; }
    if (consumed >= LIMITS.nativeTailBytes) { nativeLimited = true; break; }
    try {
      const tail = tailLines(item.file, Math.min(64 * 1024, LIMITS.nativeTailBytes - consumed));
      consumed += Math.min(safeStat(item.file).size, 64 * 1024);
      nativeLimited ||= tail.limited || (consumed >= LIMITS.nativeTailBytes && fileIndex < files.length - 1);
      if (tail.incomplete) finding(findings, 'WARN', 'native_tail_incomplete', { project_id: project.project_id });
      for (const text of tail.lines) {
        if (Buffer.byteLength(text) > 64 * 1024) { finding(findings, 'WARN', 'native_tail_line_limit', { project_id: project.project_id }); continue; }
        let row;
        try { row = JSON.parse(text); } catch { finding(findings, 'WARN', 'native_tail_invalid', { project_id: project.project_id }); continue; }
        if (!plain(row) || !HEX.test(row.event_id || '') || !timestamp(row.ingested_at)) {
          finding(findings, 'WARN', 'native_canonical_invalid', { project_id: project.project_id }); continue;
        }
        if (seen.has(row.event_id)) continue;
        const { event_id, payload_sha256, ingested_at, ...event } = row;
        let canonical;
        try { canonical = canonicalize(event, ingested_at); } catch {}
        if (validate(event) || !canonical || canonical.event_id !== event_id
            || canonical.payload_sha256 !== payload_sha256) {
          finding(findings, 'WARN', 'native_canonical_invalid', { project_id: project.project_id }); continue;
        }
        const run = runs.get(event.identity?.sgsd_run_id), accounting = classifyAccounting(event, run?.registration);
        if (!run || run.registration.project_id !== project.project_id || !accounting.eligible) continue;
        seen.add(event_id); observed++;
        const occurred = Date.parse(event.occurred_at), arrived = Date.parse(ingested_at);
        earliest = Math.min(earliest ?? occurred, occurred); latest = Math.max(latest ?? occurred, occurred);
        received = Math.max(received ?? arrived, arrived);
        run.lastReceived = Math.max(run.lastReceived ?? arrived, arrived);
        run.lastOccurred = Math.max(run.lastOccurred ?? occurred, occurred); run.nativeEvents++;
        for (const key of Object.keys(values)) if (finiteCount(accounting.usage?.[key])) {
          values[key] += accounting.usage[key]; observedDimensions.add(key);
        }
      }
    } catch { finding(findings, 'WARN', 'native_tail_unavailable', { project_id: project.project_id }); }
  }
  if (nativeLimited) finding(findings, 'WARN', 'native_tail_limit', { project_id: project.project_id });
  if (!observed) return native;
  native.last_received_at = new Date(received).toISOString(); native.last_occurred_at = new Date(latest).toISOString();
  native.summary = { availability: 'observed', scope: 'bounded_native_tail',
    interval: { start_at: new Date(earliest).toISOString(), end_at: new Date(latest).toISOString() },
    generated_at: new Date(received).toISOString(), age_ms: Math.max(0, now - received),
    ...Object.fromEntries(dimensions.map(key => [key, observedDimensions.has(key) ? values[key] : null])) };
  native.status = now - latest > STALE_NATIVE_MS ? 'stale_or_idle' : 'observed';
  return native;
}

function validReceiptMetadata(receipt, projectId) {
  if (!plain(receipt) || !Object.hasOwn(SOURCES, receipt.family)
      || !HEX.test(receipt.receipt_id || '') || !HEX.test(receipt.source_path_sha256 || '')
      || !HEX.test(receipt.source_occurrence_id || '')
      || (receipt.file_identity !== null && !HEX.test(receipt.file_identity || ''))
      || !finiteCount(receipt.offset) || !finiteCount(receipt.length)
      || !HEX.test(receipt.source_record_sha256 || '') || !timestamp(receipt.observed_at)
      || !['accepted','duplicate','conflict','rejected','excluded'].includes(receipt.disposition)
      || !['exact','missing','unmatched','cross_project'].includes(receipt.run_correlation)
      || (receipt.detail !== null && (!plain(receipt.detail)
        || digest(receipt.detail) !== receipt.detail_sha256))
      || (receipt.detail === null) !== (receipt.detail_sha256 === null)) return false;
  if (receipt.receipt_id !== digest(['sgsd-ledger-receipt-v1', projectId, receipt.family,
    receipt.source_occurrence_id, receipt.offset, receipt.length, receipt.source_record_sha256])) return false;
  if (['accepted','duplicate','conflict'].includes(receipt.disposition)
      && (!HEX.test(receipt.canonical_event_id || '') || !HEX.test(receipt.canonical_payload_sha256 || ''))) return false;
  return true;
}

function receiptFamilies(file, findings, projectId) {
  const families = {}, result = { received: null, observed: 0, degraded: false, families };
  if (!fs.existsSync(file)) return result;
  try {
    const tail = tailLines(file, LIMITS.receiptTailBytes);
    if (tail.limited) finding(findings, 'WARN', 'receipt_tail_limit', { project_id: projectId });
    if (tail.incomplete) finding(findings, 'WARN', 'receipt_tail_incomplete', { project_id: projectId });
    for (const text of tail.lines) {
      let batch;
      try { batch = JSON.parse(text); } catch { result.degraded = true; continue; }
      if (batch.schema_version !== 1 || batch.project_id !== projectId || !timestamp(batch.committed_at)
          || !HEX.test(batch.batch_id || '') || !Array.isArray(batch.receipts) || batch.receipts.length > 256
          || batch.batch_id !== digest(batch.receipts.map(receipt => receipt?.receipt_id))
          || batch.receipts.some(receipt => !validReceiptMetadata(receipt, projectId))) {
        result.degraded = true; finding(findings, 'WARN', 'receipt_tail_invalid', { project_id: projectId }); continue;
      }
      for (const receipt of batch.receipts) {
        const row = families[receipt.family] ||= { status: 'unobserved', last_received_at: null, last_occurred_at: null,
          observations: 0, verdict: null, summary_generated_at: null, age_ms: null };
        row.observations++; result.observed++;
        result.received = Math.max(result.received ?? 0, Date.parse(receipt.observed_at));
        if (!row.last_received_at || Date.parse(receipt.observed_at) > Date.parse(row.last_received_at))
          row.last_received_at = receipt.observed_at;
        row.summary_generated_at = row.last_received_at;
        if (['rejected','conflict'].includes(receipt.disposition)) { row.status = 'degraded'; result.degraded = true; }
        else if (['accepted','duplicate'].includes(receipt.disposition) && row.status !== 'degraded') row.status = 'observed';
        const verdict = receipt.detail?.verdict || receipt.detail?.outcome || receipt.detail?.status || null;
        if (typeof verdict === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(verdict)) row.verdict = verdict;
      }
    }
  } catch { result.degraded = true; finding(findings, 'WARN', 'receipt_tail_unavailable', { project_id: projectId }); }
  return result;
}

function operationalSummary(root, project, findings, audit, now) {
  const paths = capturePaths(root, project.project_id);
  let state;
  try { state = readCaptureState({ root, projectId: project.project_id }); }
  catch { finding(findings, 'FAIL', 'capture_state_invalid', { project_id: project.project_id }); state = null; }
  const receipts = receiptFamilies(paths.receipts, findings, project.project_id);
  for (const family of Object.values(receipts.families))
    family.age_ms = family.last_received_at ? Math.max(0, now - Date.parse(family.last_received_at)) : null;
  let pending = 0, pendingBytes = null, gaps = null, degraded = receipts.degraded;
  const cached = audit?.operations?.projects?.find(row => row.project_id === project.project_id);
  for (const family of cached?.families || []) {
    const existing = receipts.families[family.family];
    const cacheIsCurrent = !existing?.last_received_at
      || Date.parse(existing.last_received_at) <= Date.parse(audit.generated_at);
    if (!cacheIsCurrent) continue;
    receipts.families[family.family] = { status: family.state === 'observed' ? 'observed'
      : family.state === 'degraded' ? 'degraded' : 'unobserved', last_received_at: existing?.last_received_at || null,
      last_occurred_at: family.last_observed_at, observations: family.observations,
      verdict: family.latest_outcome, summary_generated_at: audit.generated_at,
      age_ms: Math.max(0, now - Date.parse(audit.generated_at)) };
    receipts.observed += family.state === 'observed' ? family.observations : 0;
    degraded ||= family.state === 'degraded';
  }
  if (state) {
    pendingBytes = 0; gaps = finiteCount(state.counters?.gaps) ? state.counters.gaps : null;
    for (const source of Object.values(state.sources || {})) {
      pendingBytes += finiteCount(source.pending_bytes) ? source.pending_bytes : 0;
      pending += Array.isArray(source.pending?.correlations) ? source.pending.correlations.length : 0;
      const row = receipts.families[source.family] ||= { status: 'unobserved', last_received_at: null, last_occurred_at: null,
        observations: 0, verdict: null, summary_generated_at: null, age_ms: null };
      if (source.last_reason || source.counters?.gaps || source.pending_bytes) row.status = 'degraded';
      if (CAPACITY_REASONS.has(source.last_reason)) finding(findings, 'FAIL', 'operational_capacity_stopped',
        { project_id: project.project_id });
      degraded ||= row.status === 'degraded';
    }
  }
  if (pending || pendingBytes || gaps) degraded = true;
  const observed = receipts.observed > 0;
  return { status: degraded ? 'degraded' : observed ? 'observed' : 'unavailable',
    last_received_at: receipts.received ? new Date(receipts.received).toISOString() : null,
    pending_bytes: pendingBytes, gaps, families: receipts.families };
}

function projectRow(root, project, classification, runs, findings, now, deadline, audit) {
  const projectRuns = [...runs.values()].filter(row => row.registration.project_id === project.project_id);
  const native = nativeSummary(root, project, runs, findings, now, deadline);
  for (const run of projectRuns) {
    const stale = !run.closed && run.lastOccurred && now - run.lastOccurred > STALE_NATIVE_MS;
    if (!run.closed && !run.nativeEvents) finding(findings, 'WARN', 'native_delivery_unobserved',
      { project_id: project.project_id, run_id: run.registration.run_id });
    else if (stale) finding(findings, 'WARN', 'native_delivery_stale_or_idle',
      { project_id: project.project_id, run_id: run.registration.run_id });
  }
  const operational = operationalSummary(root, project, findings, audit, now);
  if (operational.status === 'unavailable')
    finding(findings, 'WARN', 'operational_delivery_unobserved', { project_id: project.project_id });
  const nativeDir = path.join(root, 'projects', project.project_id, 'metrics');
  const operationalDir = path.join(root, 'projects', project.project_id, 'operational');
  return { project_id: project.project_id, project_dir: project.project_dir, classification, native, operational,
    runs: projectRuns.map(row => ({ run_id: row.registration.run_id, provider: row.registration.provider,
      role: row.registration.role, registered_at: row.registration.registered_at,
      state: row.closed ? 'closed' : 'open', native_status: !row.nativeEvents ? 'unavailable'
        : now - row.lastOccurred > STALE_NATIVE_MS && !row.closed ? 'stale_or_idle' : 'observed',
      last_received_at: row.lastReceived ? new Date(row.lastReceived).toISOString() : null,
      last_occurred_at: row.lastOccurred ? new Date(row.lastOccurred).toISOString() : null,
      pending_spool: row.pending, pending_spool_oldest_age_ms: row.oldest })),
    capacity: {
      native: capacity(nativeDir, /^sgsd-atlas-events-.*\.jsonl$/, CAPACITY.native, findings, project.project_id, 'native'),
      operational: capacity(operationalDir, /^sgsd-atlas-events-.*\.jsonl$/, CAPACITY.operational, findings, project.project_id, 'operational'),
      receipts: capacity(operationalDir, /^sgsd-ledger-receipts\.jsonl$/, CAPACITY.receipts, findings, project.project_id, 'receipts'),
    } };
}

function inventoryRow(project, classification, runs) {
  const row = missingRow({ requested: project.project_dir });
  row.project_id = project.project_id; row.classification = classification;
  row.runs = [...runs.values()].filter(item => item.registration.project_id === project.project_id)
    .map(item => ({ run_id: item.registration.run_id, provider: item.registration.provider, role: item.registration.role,
      registered_at: item.registration.registered_at, state: item.closed ? 'closed' : 'unknown', native_status: 'unavailable',
      last_received_at: null, last_occurred_at: null, pending_spool: item.pending,
      pending_spool_oldest_age_ms: item.oldest }));
  return row;
}

function missingRow(item) {
  const summary = { availability: 'unavailable', scope: null, interval: null, generated_at: null, age_ms: null,
    input_tokens: null, output_tokens: null, total_provider_tokens: null, cache_read_tokens: null,
    cache_creation_tokens: null, reasoning_tokens: null };
  return { project_id: null, project_dir: item.requested, classification: 'missing',
    native: { status: 'unavailable', last_received_at: null, last_occurred_at: null, summary },
    operational: { status: 'unavailable', last_received_at: null, pending_bytes: null, gaps: null, families: {} },
    runs: [], capacity: { native: { used_bytes: null, limit_bytes: CAPACITY.native, percent: null },
      operational: { used_bytes: null, limit_bytes: CAPACITY.operational, percent: null },
      receipts: { used_bytes: null, limit_bytes: CAPACITY.receipts, percent: null } } };
}

function cachedOperations(value) {
  if (value.operations == null) return null;
  const operation = value.operations;
  if (!plain(operation) || !['PASS','WARN','FAIL'].includes(operation.status)
      || !Array.isArray(operation.projects) || operation.projects.length > LIMITS.projects) throw new Error('invalid');
  const projects = operation.projects.map(project => {
    if (!plain(project) || !HEX.test(project.project_id || '') || !Array.isArray(project.families)
        || project.families.length > 32) throw new Error('invalid');
    return { project_id: project.project_id, families: project.families.map(family => {
      const last = family.last_observed_at ?? family.time?.latest_observed_at ?? null;
      const outcome = family.latest_outcome ?? null;
      if (!plain(family) || !Object.hasOwn(SOURCES, family.family)
          || !['observed','degraded','idle','excluded','unavailable'].includes(family.state)
          || !finiteCount(family.observations) || (last !== null && !timestamp(last))
          || (outcome !== null && (typeof outcome !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(outcome))))
        throw new Error('invalid');
      return { family: family.family, state: family.state, observations: family.observations,
        last_observed_at: last, latest_outcome: outcome };
    }) };
  });
  return { status: operation.status, projects };
}

function cachedStatus(root, name, findings, now) {
  const file = path.join(root, 'monitor', `${name}.json`);
  if (!fs.existsSync(file)) { finding(findings, 'WARN', `${name}_missing`); return null; }
  try {
    const value = safeObject(file, LIMITS.metadataBytes);
    const allowed = name === 'audit' ? ['PASS','WARN','FAIL'] : ['verified','failed','unobserved'];
    if (value.schema_version !== 1 || !allowed.includes(value.status)) throw new Error('invalid');
    const generated = timestamp(value.generated_at) ? value.generated_at : null;
    const result = { schema_version: 1, generated_at: generated, status: value.status };
    if (name === 'audit') {
      if (!generated) throw new Error('invalid');
      if (value.status === 'FAIL') finding(findings, 'FAIL', 'audit_failed');
      else if (value.status === 'WARN') finding(findings, 'WARN', 'audit_has_findings');
      result.complete_coverage = value.complete_coverage === true;
      result.finding_count = finiteCount(value.finding_count) ? value.finding_count : null;
      result.project_count = finiteCount(value.project_count) ? value.project_count : null;
      result.truncated = value.truncated === true;
      result.operations = cachedOperations(value);
      const generatedTime = Date.parse(generated);
      if (generatedTime > now + 60000) finding(findings, 'WARN', 'audit_future');
      else if (now - generatedTime > STALE_BACKUP_MS) finding(findings, 'WARN', 'audit_overdue');
      if (result.truncated) finding(findings, 'WARN', 'audit_truncated');
    }
    else {
      result.verified_at = timestamp(value.verified_at) ? value.verified_at : null;
      result.verified = value.status === 'verified';
      result.bundle_id = typeof value.bundle_id === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value.bundle_id)
        ? value.bundle_id : null;
      result.manifest_sha256 = HEX.test(value.manifest_sha256 || '') ? value.manifest_sha256 : null;
      result.audit_status = ['PASS','WARN','FAIL'].includes(value.audit_status) ? value.audit_status : null;
      result.capture_status = ['complete','incomplete'].includes(value.capture_status) ? value.capture_status : null;
      const freshness = Date.parse(result.verified_at || generated);
      if (!Number.isFinite(freshness) || now - freshness > STALE_BACKUP_MS) finding(findings, 'WARN', 'backup_overdue');
    }
    return result;
  } catch (error) {
    finding(findings, 'WARN', `${name}_${error.message === 'read_limit' ? 'read_limit' : 'read_error'}`); return null;
  }
}

function scheduledHealth(root, findings) {
  const checks = [
    { name: 'daily', statuses: ['running','completed','failed'], failed: 'daily_export_failed' },
    { name: 'schedule-last-run', statuses: ['executed','failed'], failed: 'schedule_last_run_failed' },
  ];
  for (const check of checks) {
    const file = path.join(root, 'monitor', `${check.name}.json`);
    if (!fs.existsSync(file)) continue;
    try {
      const value = safeObject(file, 64 * 1024);
      if (value.schema_version !== 1 || !check.statuses.includes(value.status)) throw new Error('invalid');
      if (value.status === 'failed') finding(findings, 'WARN', check.failed);
    } catch (error) {
      finding(findings, 'WARN', `${check.name.replaceAll('-', '_')}_${error.message === 'read_limit' ? 'read_limit' : 'read_error'}`);
    }
  }
}

function processCensus(included, servicePid, findings) {
  if (process.platform !== 'linux' || !fs.existsSync('/proc')) return [];
  const roots = included.map(row => row.project_dir), result = [];
  let handle, scanned = 0, limited = false;
  try { safePath('/proc/.atlas-monitor-read'); handle = fs.opendirSync('/proc'); }
  catch { finding(findings, 'WARN', 'process_inventory_unavailable'); return result; }
  try { while (scanned++ < 8192) {
    const entry = handle.readSync();
    if (!entry) break;
    if (!/^\d+$/.test(entry.name)) continue;
    const pid = Number(entry.name); if (pid === process.pid || pid === servicePid) continue;
    try {
      const cwd = fs.readlinkSync(`/proc/${pid}/cwd`), exe = fs.readlinkSync(`/proc/${pid}/exe`);
      const under = roots.some(root => cwd === root || cwd.startsWith(root + path.sep));
      if (!under || !/^(?:node|claude|codex)(?:\.exe)?$/i.test(path.basename(exe))) continue;
      result.push({ pid, started_at: null, cwd, exe, reason: 'process_attachment_unknown' });
      if (result.length >= 64) { finding(findings, 'WARN', 'unmatched_session_limit'); break; }
    } catch {}
  } limited = scanned > 8192 && Boolean(handle.readSync()); }
  catch { finding(findings, 'WARN', 'process_inventory_unavailable'); }
  finally { try { handle.closeSync(); } catch {} }
  if (limited) finding(findings, 'WARN', 'process_inventory_limit');
  if (result.length) finding(findings, 'WARN', 'unmatched_sessions_present');
  return result;
}

function incidentKey(row) {
  return JSON.stringify([row.severity, row.reason, row.project_id || null, row.run_id || null, row.pid || null]);
}

function validPrevious(value) {
  return value.schema_version === 1 && timestamp(value.generated_at)
    && ['PASS','WARN','FAIL'].includes(value.status) && value.complete_coverage === false
    && Array.isArray(value.projects) && Array.isArray(value.unmatched_sessions)
    && Array.isArray(value.findings) && value.findings.length <= LIMITS.findings
    && value.findings.every(row => plain(row) && ['WARN','FAIL'].includes(row.severity)
      && typeof row.reason === 'string' && /^[A-Za-z0-9._:-]{1,96}$/.test(row.reason));
}

function boundSnapshot(snapshot) {
  if (Buffer.byteLength(JSON.stringify(snapshot)) <= LIMITS.snapshotBytes) return;
  finding(snapshot.findings, 'WARN', 'snapshot_output_limit');
  const classes = ['excluded_unclassified','excluded_benchmark','worktree','configured','missing'];
  for (const classification of classes) {
    for (let index = snapshot.projects.length - 1;
      index >= 0 && Buffer.byteLength(JSON.stringify(snapshot)) > LIMITS.snapshotBytes; index--) {
      if (snapshot.projects[index].classification === classification) snapshot.projects.splice(index, 1);
    }
  }
  if (Buffer.byteLength(JSON.stringify(snapshot)) > LIMITS.snapshotBytes)
    throw new Error('snapshot_output_capacity');
  snapshot.status = snapshot.findings.some(row => row.severity === 'FAIL') ? 'FAIL' : 'WARN';
}

function persist(root, snapshot, previous, now) {
  const file = path.join(root, 'monitor', 'incidents.jsonl');
  const prior = new Map((previous?.findings || []).map(row => [incidentKey(row), row]));
  const current = new Map(snapshot.findings.map(row => [incidentKey(row), row]));
  const rows = [];
  for (const [key, row] of current) if (!prior.has(key)) rows.push({ schema_version: 1,
    incident_id: digest(['atlas-monitor-incident-v1', key]), recorded_at: new Date(now).toISOString(), state: 'open', ...row });
  for (const [key, row] of prior) if (!current.has(key)) rows.push({ schema_version: 1,
    incident_id: digest(['atlas-monitor-incident-v1', key]), recorded_at: new Date(now).toISOString(), state: 'recovered', ...row });
  for (const row of rows) {
    const existing = fs.existsSync(file) ? safeStat(file).size : 0;
    if (existing + Buffer.byteLength(JSON.stringify(row)) + 1 > LIMITS.incidentBytes) throw new Error('incident_history_capacity');
    safeAppend(file, row);
  }
  writeJson(path.join(root, 'monitor', 'latest.json'), snapshot);
}

async function collectSnapshot({ root = rootPath(), now = Date.now(), projectDirs } = {}) {
  if (typeof root !== 'string' || !root.length || !Number.isFinite(now)) throw new Error('invalid_monitor_options');
  root = path.resolve(root); const release = acquire(root), started = Date.now();
  try {
    const findings = [], generatedAt = new Date(now).toISOString();
    let previous = null;
    const latest = path.join(root, 'monitor', 'latest.json');
    if (fs.existsSync(latest)) {
      try {
        previous = safeObject(latest, LIMITS.snapshotBytes);
        if (!validPrevious(previous)) { previous = null; finding(findings, 'WARN', 'previous_snapshot_invalid'); }
      } catch { finding(findings, 'WARN', 'previous_snapshot_read_error'); }
    }
    const configured = configuredDirectories(root, projectDirs, findings);
    if (!configured.length) finding(findings, 'WARN', 'no_configured_projects');
    const serviceValue = await globalStatus(root, 250);
    const service = { healthy: Boolean(serviceValue), pid: serviceValue?.pid ?? null };
    if (!service.healthy) finding(findings, 'WARN', 'service_unavailable');
    const audit = cachedStatus(root, 'audit', findings, now), backup = cachedStatus(root, 'backup', findings, now);
    scheduledHealth(root, findings);
    const deadline = started + LIMITS.deadlineMs;
    const registrations = registeredProjects(root, findings, deadline);
    const runs = registeredRuns(root, findings, now, deadline);
    const selectedDirs = new Set(configured.filter(row => row.directory).map(row => row.directory));
    const selectedCommon = new Set(configured.filter(row => row.common).map(row => row.common));
    const projects = [];
    for (const project of registrations) {
      const classification = selectedDirs.has(project.project_dir) ? 'configured'
        : project.common && selectedCommon.has(project.common) ? 'worktree'
        : /(?:^|[\\/])benchmarks?(?:[\\/]|$)/i.test(project.project_dir) ? 'excluded_benchmark'
        : 'excluded_unclassified';
      if (!['configured','worktree'].includes(classification)) projects.push(inventoryRow(project, classification, runs));
      else if (Date.now() > deadline) {
        finding(findings, 'WARN', 'project_check_deadline', { project_id: project.project_id });
        projects.push(inventoryRow(project, classification, runs));
      } else projects.push(projectRow(root, project, classification, runs, findings, now, deadline, audit));
    }
    for (const item of configured) if (!item.directory) {
      finding(findings, 'WARN', 'project_dir_missing'); projects.push(missingRow(item));
    } else if (!registrations.some(project => project.project_dir === item.directory)) {
      const project = { project_id: digest(item.directory), project_dir: item.directory };
      finding(findings, 'WARN', 'project_not_registered', { project_id: project.project_id });
      projects.push(Date.now() > deadline ? inventoryRow(project, 'configured', runs)
        : projectRow(root, project, 'configured', runs, findings, now, deadline, audit));
    }
    const included = projects.filter(row => ['configured','worktree'].includes(row.classification));
    const unmatched = processCensus(included, service.pid, findings);
    if (Date.now() > deadline) finding(findings, 'WARN', 'monitor_deadline');
    const snapshot = { schema_version: 1, generated_at: generatedAt,
      status: findings.some(row => row.severity === 'FAIL') ? 'FAIL' : findings.length ? 'WARN' : 'PASS',
      complete_coverage: false, service, projects, unmatched_sessions: unmatched, findings, audit, backup };
    boundSnapshot(snapshot);
    try { persist(root, snapshot, previous, now); }
    catch (error) {
      if (error.message !== 'incident_history_capacity') throw error;
      finding(snapshot.findings, 'WARN', 'incident_history_capacity');
      snapshot.status = snapshot.findings.some(row => row.severity === 'FAIL') ? 'FAIL' : 'WARN';
      boundSnapshot(snapshot);
      writeJson(path.join(root, 'monitor', 'latest.json'), snapshot);
    }
    return snapshot;
  } finally { release(); }
}

async function cli(argv = process.argv.slice(2)) {
  if (argv[0] !== 'check') throw new Error('invalid_monitor_command');
  let root = rootPath();
  for (let index = 1; index < argv.length; index++) {
    if (argv[index] === '--root' && argv[index + 1]) root = argv[++index];
    else throw new Error('invalid_monitor_arguments');
  }
  const snapshot = await collectSnapshot({ root });
  process.stdout.write(JSON.stringify(snapshot) + '\n');
  return snapshot.status === 'FAIL' ? 1 : snapshot.status === 'WARN' ? 10 : 0;
}

if (require.main === module) cli().then(code => { process.exitCode = code; }).catch(error => {
  process.stdout.write(JSON.stringify({ schema_version: 1, status: 'FAIL', reason: error.message }) + '\n');
  process.exitCode = 1;
});

module.exports = Object.freeze({ collectSnapshot, cli, LIMITS, CAPACITY });
