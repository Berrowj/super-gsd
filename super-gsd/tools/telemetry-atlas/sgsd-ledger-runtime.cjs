'use strict';
// Receiver-owned, bounded collection of content-free SGSD operational evidence.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { canonicalize, createStore, digest, safeAppend, safePath, scan, appendGap } = require('./contract.cjs');
const { privateDirectory } = require('./quota-sampler.cjs');
const { readRun, readJson } = require('./global-store.cjs');
const { SOURCES, projectRecord } = require('./sgsd-ledger.cjs');
const { readBatch, DEFAULT_MAX_BYTES, DEFAULT_MAX_RECORDS, DEFAULT_MAX_LINE_BYTES } = require('./sgsd-ledger-reader.cjs');

const HEX = /^[a-f0-9]{64}$/;
const RECEIPT_MAX_BYTES = 256 * 1024 * 1024;
const MAX_RECEIPT_BATCH_BYTES = 64 * 1024;
const STATE_MAX_BYTES = 8 * 1024 * 1024;
const OPERATIONAL_MAX_BYTES = 256 * 1024 * 1024;
const MAX_SOURCE_STATES = 4096;
const MAX_PENDING = 256;
const DEFAULT_CYCLE_BYTES = 1024 * 1024;
const DEFAULT_CYCLE_MS = 100;
const DEFAULT_PROJECTS = 32;
const DEFAULT_RUNTIME_RECORDS = 256;
const REDUCED_READER_BYTES = 80 * 1024;
const DEFAULT_POLL_MS = 5000;
const MAX_CACHED_STORES = 8;
const MAX_CACHED_ROWS = 150000;
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const COUNTER_NAMES = ['accepted','duplicate','conflict','rejected','excluded','gaps','records','bytes_read'];
const RETRYABLE = new Set(['disk_pressure','writer_locked','storage_unavailable','canonical_size_limit','index_limit',
  'concurrent_writer_or_modified_ledger','malformed_tail','corrupt_ledger','corrupt_manifest',
  'closed_partition_integrity','concurrent_partition_writer','writer_lock_unverifiable','receipt_capacity']);
const REASONS = new Set(['excluded_before_capture_window','source_missing','source_empty','source_replaced',
  'source_truncated','source_rewritten','source_changed_during_read','malformed_json','line_too_large',
  'record_too_large','unsafe_file_owner','unsafe_hardlink','unsafe_symlink','unsafe_special_file','source_read_failed',
  'unsupported_source_schema','invalid_source_row','invalid_observation_shape','invalid_muda_shape',
  'invalid_source_shape','invalid_recorded_run_identity','unknown_time_observed_at','semantic_detail_unknown',
  'projection_rejected','unmatched_recorded_run','cross_project_recorded_run','missing_recorded_run',
  ...RETRYABLE,'source_state_limit','processing_budget','invalid_project_registration','invalid_capture_state',
  'source_incomplete_tail','capture_gaps_recorded']);
const RECEIPT_RESERVE_REASON = [...REASONS].reduce((longest,reason) =>
  reason.length > longest.length ? reason : longest,'');
const RUN = /^sgsd-[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SPECIFIC = new Set(SOURCES.generic_metric.exclude_basenames);
const emptyCounters = () => Object.fromEntries(COUNTER_NAMES.map(name => [name, 0]));
const sha = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const iso = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const integer = value => Number.isSafeInteger(value) && value >= 0;
const bounded = (value, fallback, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum ? value : fallback;
const relativeName = (projectDir, file) => path.relative(projectDir, file).split(path.sep).join('/');

function capturePaths(root, projectId) {
  if (typeof root !== 'string' || !root.length || !HEX.test(projectId || '')) throw new Error('invalid_capture_path');
  const directory = path.join(path.resolve(root), 'projects', projectId, 'operational');
  return Object.freeze({ directory,
    state: path.join(directory, 'sgsd-ledger-state.json'),
    receipts: path.join(directory, 'sgsd-ledger-receipts.jsonl'),
    canonical_manifest: path.join(directory, 'sgsd-atlas-manifest.jsonl'),
    canonical_gaps: path.join(directory, 'sgsd-atlas-gaps.jsonl'),
    event_prefix: path.join(directory, 'sgsd-atlas-events-') });
}

function validCounters(value) {
  return value && typeof value === 'object' && COUNTER_NAMES.every(name => integer(value[name]));
}

function validCursor(value, format) {
  if (value == null) return true;
  return value && typeof value === 'object' && value.schema_version === 1 && value.format === format
    && integer(value.offset) && HEX.test(value.file_identity || '') && integer(value.head_length)
    && value.head_length <= 4096 && (value.head_length === 0 ? value.head_sha256 === null : HEX.test(value.head_sha256 || ''))
    && integer(value.tail_start) && integer(value.tail_length) && value.tail_length <= 4096
    && (value.tail_length === 0 ? value.tail_sha256 === null : HEX.test(value.tail_sha256 || ''))
    && typeof value.discarding_oversize === 'boolean' && integer(value.source_size)
    && value.offset <= value.source_size && /^\d+$/.test(value.mtime_ns || '');
}

function validState(value, projectId) {
  if (!value || typeof value !== 'object' || value.schema_version !== 1 || value.project_id !== projectId
      || !iso(value.capture_started_at) || !iso(value.initial_cutoff_at) || !integer(value.source_rotation)
      || !iso(value.updated_at) || !validCounters(value.counters) || !value.sources || typeof value.sources !== 'object'
      || Array.isArray(value.sources) || Object.keys(value.sources).length > MAX_SOURCE_STATES) return false;
  for (const [key, source] of Object.entries(value.sources)) {
    if (!HEX.test(key) || !source || typeof source !== 'object' || !Object.hasOwn(SOURCES, source.family)
        || typeof source.relative_path !== 'string' || path.isAbsolute(source.relative_path)
        || source.relative_path.split('/').includes('..')
        || key !== sha([source.family,source.relative_path])
        || source.source_path_sha256 !== sha(source.relative_path)
        || (source.source_occurrence_id != null && !HEX.test(source.source_occurrence_id))
        || !validCursor(source.cursor,SOURCES[source.family].format)
        || !integer(source.pending_bytes) || !validCounters(source.counters)
        || (source.lag_ms != null && !integer(source.lag_ms))
        || (source.last_observed_at != null && !iso(source.last_observed_at))
        || (source.last_reason != null && !REASONS.has(source.last_reason))) return false;
    if (source.pending != null) {
      const pending = source.pending;
      if (!pending || pending.schema_version !== 1 || !integer(pending.start_offset) || !iso(pending.observed_at)
          || pending.start_offset !== (source.cursor?.offset || 0)
          || !integer(pending.attempt_records) || pending.attempt_records < 1 || pending.attempt_records > MAX_PENDING
          || !HEX.test(pending.file_identity || '') || !integer(pending.source_size)
          || !/^\d+$/.test(pending.mtime_ns || '')
          || !HEX.test(pending.source_occurrence_id || '') || !Array.isArray(pending.correlations)
          || pending.correlations.length > MAX_PENDING) return false;
      for (const item of pending.correlations) {
        if (!item || !HEX.test(item.provenance_sha256 || '')
            || !['exact','missing','unmatched','cross_project'].includes(item.run_correlation)
            || (item.run_correlation === 'exact' ? !RUN.test(item.sgsd_run_id || '') : item.sgsd_run_id !== null)
            || (item.reason != null && !REASONS.has(item.reason))) return false;
      }
    }
  }
  return true;
}

function readCaptureState({ root, projectId }) {
  const file = capturePaths(root, projectId).state;
  if (!fs.existsSync(file)) return null;
  try {
    safePath(file);
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size > STATE_MAX_BYTES) throw new Error('invalid_capture_state');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!validState(value, projectId)) throw new Error('invalid_capture_state');
    return value;
  } catch (error) {
    if (error.message === 'invalid_capture_state') throw error;
    throw new Error('invalid_capture_state');
  }
}

function durableState(file, state) {
  const bytes = Buffer.from(JSON.stringify(state) + '\n');
  if (bytes.length > STATE_MAX_BYTES) throw new Error('source_state_limit');
  privateDirectory(path.dirname(file)); safePath(file);
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    if (fs.writeSync(fd, bytes) !== bytes.length) throw new Error('short_write');
    fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    fs.renameSync(temporary, file);
    if (process.platform !== 'win32') {
      const directory = fs.openSync(path.dirname(file), 'r');
      try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
    }
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
    try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
  }
}

function initialState(projectId, observedAt) {
  return { schema_version: 1, project_id: projectId, capture_started_at: observedAt,
    initial_cutoff_at: new Date(Date.parse(observedAt) - LOOKBACK_MS).toISOString(), source_rotation: 0,
    updated_at: observedAt, counters: emptyCounters(), sources: {} };
}

function receiptReason(value, fallback = 'projection_rejected') {
  return REASONS.has(value) ? value : fallback;
}

function receiptBatches(projectId, items, committedAt) {
  const batches = [];
  const row = receipts => ({ schema_version: 1, batch_id: digest(receipts.map(item => item.receipt_id)),
    project_id: projectId, committed_at: committedAt, receipts });
  const overhead = Buffer.byteLength(JSON.stringify(row([])));
  let group = [], groupBytes = overhead, length = 0;
  const flush = () => { if (!group.length) return; batches.push(row(group)); length += groupBytes + 1;
    group = []; groupBytes = overhead; };
  for (const item of items) {
    const bytes = Buffer.byteLength(JSON.stringify(item)), candidateBytes = groupBytes + bytes + (group.length ? 1 : 0);
    if (candidateBytes > MAX_RECEIPT_BATCH_BYTES && group.length) flush();
    group.push(item); groupBytes += bytes + (group.length > 1 ? 1 : 0);
    if (groupBytes > MAX_RECEIPT_BATCH_BYTES) throw new Error('receipt_capacity');
  }
  flush(); return { batches, length };
}

function receiptCapacity(file, projectId, items, committedAt, freeRatio) {
  if (!items.length) return { available: true, batches: [] };
  try { privateDirectory(path.dirname(file)); }
  catch { return { available: false, batches: [] }; }
  let prepared;
  try { prepared = receiptBatches(projectId,items,committedAt); }
  catch { return { available: false, batches: [] }; }
  const existing = fs.existsSync(file) ? fs.statSync(file).size : 0;
  let ratio;
  try { ratio = freeRatio(file); } catch { ratio = 0; }
  return { available: existing + prepared.length <= RECEIPT_MAX_BYTES
    && Number.isFinite(ratio) && ratio >= 0.1, batches: prepared.batches };
}

function appendReceiptBatch(file, projectId, items, committedAt, freeRatio) {
  if (!items.length) return;
  const capacity = receiptCapacity(file,projectId,items,committedAt,freeRatio);
  if (!capacity.available) throw new Error('receipt_capacity');
  for (const batch of capacity.batches) safeAppend(file,batch);
}

function countOperationalRows(directory) {
  let count = 0, bytes = 0, handle;
  if (!fs.existsSync(directory)) return count;
  try {
    handle = fs.opendirSync(directory);
    for (let files = 0; files <= MAX_SOURCE_STATES; files++) {
      const entry = handle.readSync(); if (!entry) break;
      if (files === MAX_SOURCE_STATES) throw new Error('index_limit');
      if (!entry.isFile() || !/^sgsd-atlas-events-[A-Za-z0-9._-]+\.jsonl$/.test(entry.name)) continue;
      const file = path.join(directory,entry.name), size = fs.statSync(file).size;
      bytes += size; if (bytes > OPERATIONAL_MAX_BYTES) throw new Error('canonical_size_limit');
      scan(file, () => { if (++count > 100000)
        throw Object.assign(new Error('index_limit'),{ code: 'INDEX_LIMIT' }); });
    }
  } finally { try { handle?.closeSync(); } catch {} }
  return count;
}

function inspectSource(file, projectId, sourcePathSha) {
  try {
    const stat = fs.lstatSync(file,{ bigint: true });
    let reason = null;
    if (stat.isSymbolicLink()) reason = 'unsafe_symlink';
    else if (!stat.isFile()) reason = 'unsafe_special_file';
    else if (stat.nlink !== 1n) reason = 'unsafe_hardlink';
    else if (process.getuid && stat.uid !== BigInt(process.getuid())) reason = 'unsafe_file_owner';
    const fingerprint = sha([projectId,sourcePathSha,String(stat.dev),String(stat.ino),String(stat.size),
      String(stat.mtimeNs),String(stat.birthtimeMs),String(stat.nlink),String(stat.uid)]);
    return { reason, fingerprint, identity: sha(`${stat.dev}:${stat.ino}:${stat.birthtimeMs}`),
      size: Number(stat.size), mtime_ns: String(stat.mtimeNs) };
  } catch (error) { return { reason: error.code === 'ENOENT' ? 'source_missing' : 'source_read_failed',
    fingerprint: sha([projectId,sourcePathSha,'unavailable']) }; }
}

function discoverSources(projectDir, trackedSources = []) {
  const found = new Map();
  let censusLimited = false;
  const add = (family, file, tracked = false) => {
    if (found.size >= MAX_SOURCE_STATES) { censusLimited = true; return; }
    if (!tracked && !fs.existsSync(file)) return;
    const relative = relativeName(projectDir, file);
    if (!relative || relative.startsWith('../') || path.isAbsolute(relative)) return;
    found.set(`${family}\0${relative}`, { family, format: SOURCES[family].format, relative_path: relative, file });
  };
  const planning = path.join(projectDir, '.planning'), metrics = path.join(planning, 'metrics');
  const exact = [
    ['gate_value',path.join(metrics,'gate-value-log.jsonl')], ['review',path.join(metrics,'review-ledger.jsonl')],
    ['gate_evidence',path.join(metrics,'gate-evidence.jsonl')], ['muda',path.join(metrics,'muda-log.jsonl')],
    ['route_decision',path.join(metrics,'route-decisions.jsonl')], ['edge_guard',path.join(metrics,'edge-guard-log.jsonl')],
    ['orchestrator_live',path.join(planning,'ORCHESTRATOR-LIVE.jsonl')], ['worker',path.join(metrics,'worker-events.jsonl')],
  ];
  for (const [family,file] of exact) add(family,file);
  const boundedEntries = (directory, maximum = MAX_SOURCE_STATES) => {
    const rows = []; let handle;
    try {
      handle = fs.opendirSync(directory);
      while (rows.length < maximum) { const entry = handle.readSync(); if (!entry) break; rows.push(entry); }
      if (rows.length === maximum && handle.readSync()) censusLimited = true;
    } catch {} finally { try { handle?.closeSync(); } catch {} }
    return rows;
  };
  for (const entry of boundedEntries(metrics)) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl') || SPECIFIC.has(entry.name)
        || SOURCES.generic_metric.exclude_prefixes.some(prefix => entry.name.startsWith(prefix))) continue;
    add('generic_metric',path.join(metrics,entry.name));
  }
  for (const entry of boundedEntries(path.join(planning,'worker-sessions'))) {
    if (!entry.isDirectory()) continue;
    add('worker_state',path.join(planning,'worker-sessions',entry.name,'state.json'));
    add('wrapper_result',path.join(planning,'worker-sessions',entry.name,'wrapper-result.json'));
  }
  if (!fs.existsSync(path.join(metrics,'review-ledger.jsonl'))) {
    const phaseRoots = [path.join(planning,'phases')];
    for (const milestone of boundedEntries(path.join(planning,'milestones'), 256))
      if (milestone.isDirectory()) phaseRoots.push(path.join(planning,'milestones',milestone.name,'phases'));
    for (const phaseRoot of phaseRoots) for (const phase of boundedEntries(phaseRoot, 256))
      if (phase.isDirectory()) add('commit_review',path.join(phaseRoot,phase.name,'commit-reviews.jsonl'));
  }
  for (const source of trackedSources) {
    if (!source || !Object.hasOwn(SOURCES,source.family) || typeof source.relative_path !== 'string') continue;
    const file = path.resolve(projectDir,...source.relative_path.split('/'));
    if (file !== path.resolve(projectDir) && file.startsWith(path.resolve(projectDir) + path.sep))
      add(source.family,file,true);
  }
  return { sources: [...found.values()].sort((a,b) => a.family.localeCompare(b.family)
    || a.relative_path.localeCompare(b.relative_path)), censusLimited };
}

function createLedgerRuntime(options = {}) {
  const root = path.resolve(options.root || '');
  if (!root) throw new Error('collector_root_required');
  const now = options.now || (() => new Date().toISOString());
  const clock = options.clock || Date.now;
  const storeFactory = options.storeFactory || createStore;
  const readRunFn = options.readRunFn || readRun;
  const readBatchFn = options.readBatchFn || readBatch;
  const projectRecordFn = options.projectRecordFn || projectRecord;
  const receiptFreeRatio = typeof options.receiptFreeRatio === 'function' ? options.receiptFreeRatio : file => {
    const stat = fs.statfsSync(path.dirname(file));
    return stat.blocks ? stat.bavail / stat.blocks : 0;
  };
  const maxCycleBytes = bounded(options.maxCycleBytes, DEFAULT_CYCLE_BYTES, 80 * 1024, DEFAULT_CYCLE_BYTES);
  const maxCycleMs = bounded(options.maxCycleMs, DEFAULT_CYCLE_MS, 10, DEFAULT_CYCLE_MS);
  const maxProjects = bounded(options.maxProjects, DEFAULT_PROJECTS, 1, DEFAULT_PROJECTS);
  const maxRecords = bounded(options.maxRecords, DEFAULT_RUNTIME_RECORDS, 1, MAX_PENDING);
  const maxCachedStores = bounded(options.maxCachedStores, MAX_CACHED_STORES, 1, MAX_CACHED_STORES);
  const maxCachedRows = bounded(options.maxCachedRows, MAX_CACHED_ROWS, 1, MAX_CACHED_ROWS);
  const pollMs = bounded(options.pollMs, DEFAULT_POLL_MS, 20, 60000);
  const stores = new Map();
  const projectHealth = new Map();
  const invalidProjects = new Set();
  let projectDirectory = null, projects = [], timer = null, running = false, closed = false;
  const totals = emptyCounters();
  const families = Object.fromEntries(Object.keys(SOURCES).map(family => [family, emptyCounters()]));
  let last = { schema_version: 1, running: false, duration_ms: 0, bytes_read: 0, records: 0,
    projects_enumerated: 0, pending_bytes: 0, budget_exhausted: false, reason: null };

  function touchStore(projectId, projectDir) {
    let entry = stores.get(projectId);
    if (entry) { stores.delete(projectId); stores.set(projectId, entry); return entry.store; }
    const paths = capturePaths(root, projectId), rows = countOperationalRows(paths.directory);
    while (stores.size && ([...stores.values()].reduce((sum,item) => sum + item.rows,0) + rows > maxCachedRows
        || stores.size >= maxCachedStores)) stores.delete(stores.keys().next().value);
    const store = storeFactory({ metricsDir: paths.directory, maxBytes: OPERATIONAL_MAX_BYTES,
      maxIndexEntries: 100000 });
    entry = { store, rows, projectDir };
    stores.set(projectId, entry);
    while (stores.size > maxCachedStores || [...stores.values()].reduce((sum,item) => sum + item.rows,0) > maxCachedRows) {
      const oldest = stores.keys().next().value;
      stores.delete(oldest);
    }
    return store;
  }

  function note(family, name, amount = 1) {
    if (Object.hasOwn(totals,name)) totals[name] += amount;
    if (families[family] && Object.hasOwn(families[family],name)) families[family][name] += amount;
  }

  function projectBatch() {
    if (projects.length) return { enumerated: 0, rejected: 0 };
    let enumerated = 0, rejected = 0;
    try {
      if (!projectDirectory) projectDirectory = fs.opendirSync(path.join(root,'projects'));
      while (enumerated < maxProjects) {
        const entry = projectDirectory.readSync();
        if (!entry) { projectDirectory.closeSync(); projectDirectory = null; break; }
        enumerated++;
        if (!entry.isDirectory() || !HEX.test(entry.name)) continue;
        try {
          const registrationFile = path.join(root,'projects',entry.name,'project.json');
          const registration = readJson(registrationFile);
          const projectDir = fs.realpathSync(registration.project_dir);
          if (registration.schema_version !== 1 || registration.project_id !== entry.name
              || digest(projectDir) !== entry.name || !fs.statSync(path.join(projectDir,'.planning')).isDirectory())
            throw new Error('invalid_project_registration');
          projects.push({ projectId: entry.name, projectDir });
        } catch {
          rejected++;
          if (!invalidProjects.has(entry.name)) {
            if (invalidProjects.size < MAX_SOURCE_STATES) invalidProjects.add(entry.name);
            try { appendGap(path.join(root,'sgsd-atlas-gaps.jsonl'),'invalid_project_registration'); } catch {}
          }
        }
      }
    } catch { try { projectDirectory?.closeSync(); } catch {} projectDirectory = null; }
    return { enumerated, rejected };
  }

  function sourceState(state, source) {
    const key = sha([source.family,source.relative_path]);
    let value = state.sources[key];
    if (!value) {
      if (Object.keys(state.sources).length >= MAX_SOURCE_STATES) throw new Error('source_state_limit');
      value = { family: source.family, relative_path: source.relative_path,
        source_path_sha256: sha(source.relative_path), source_occurrence_id: null, cursor: null, pending: null,
        pending_bytes: 0, lag_ms: null, last_observed_at: null, last_reason: null, counters: emptyCounters() };
      state.sources[key] = value;
    }
    return value;
  }

  function correlation(event, projectId) {
    const recorded = event?.identity?.sgsd_run_id;
    if (!recorded) return { run_correlation: 'missing', sgsd_run_id: null, reason: 'missing_recorded_run' };
    const run = readRunFn(root,recorded);
    if (!run) return { run_correlation: 'unmatched', sgsd_run_id: null, reason: 'unmatched_recorded_run' };
    if (run.project_id !== projectId) return { run_correlation: 'cross_project', sgsd_run_id: null, reason: 'cross_project_recorded_run' };
    return { run_correlation: 'exact', sgsd_run_id: recorded, reason: null };
  }

  function applyCorrelation(event, decision) {
    if (!event || decision.run_correlation === 'exact' || !event.identity?.sgsd_run_id) return event;
    return { ...event, source: { ...event.source, confidence: 'unknown', completeness_reason: decision.reason },
      identity: { ...event.identity, sgsd_run_id: null } };
  }

  function receiptBase(projectId, source, sourceValue, occurrence, fileIdentity, record, observedAt) {
    const item = { family: source.family, source_path_sha256: sourceValue.source_path_sha256,
      source_occurrence_id: occurrence, file_identity: fileIdentity || null, offset: record.offset,
      length: record.length, source_record_sha256: record.sha256, observed_at: observedAt };
    return { ...item, receipt_id: digest(['sgsd-ledger-receipt-v1',projectId,source.family,occurrence,
      record.offset,record.length,record.sha256]), canonical_event_id: null, canonical_payload_sha256: null };
  }

  function persistReadFailure(state, source, sourceValue, error, observedAt, paths) {
    const reason = receiptReason(error.message,'source_read_failed');
    const inspected = inspectSource(source.file,state.project_id,sourceValue.source_path_sha256);
    const occurrence = inspected.fingerprint;
    if (sourceValue.source_occurrence_id === occurrence && sourceValue.last_reason === reason) return;
    observedAt = sourceValue.last_observed_at || observedAt;
    const record = { offset: sourceValue.cursor?.offset || 0, length: 0,
      sha256: sha(['source_read_failure',sourceValue.source_path_sha256,reason]) };
    const base = receiptBase(state.project_id,source,sourceValue,occurrence,null,record,observedAt);
    const receipt = { ...base, disposition: 'rejected', reason, source_event_id: null,
      detail_sha256: null, run_correlation: 'missing', detail: null };
    try { appendReceiptBatch(paths.receipts,state.project_id,[receipt],observedAt,receiptFreeRatio); }
    catch (appendError) {
      if (appendError.message !== 'receipt_capacity') throw appendError;
      if (sourceValue.last_reason !== 'receipt_capacity') {
        sourceValue.counters.gaps++; state.counters.gaps++; note(source.family,'gaps');
      }
      sourceValue.source_occurrence_id = occurrence; sourceValue.last_reason = 'receipt_capacity';
      sourceValue.last_observed_at = observedAt; state.updated_at = observedAt; durableState(paths.state,state);
      return;
    }
    sourceValue.source_occurrence_id = occurrence; sourceValue.last_reason = reason;
    sourceValue.last_observed_at = observedAt; sourceValue.counters.rejected++; sourceValue.counters.gaps++;
    sourceValue.counters.records++;
    state.source_rotation++;
    state.counters.rejected++; state.counters.gaps++; state.counters.records++;
    state.updated_at = observedAt; durableState(paths.state,state);
    note(source.family,'rejected'); note(source.family,'gaps'); note(source.family,'records');
  }

  function processSource(project, state, source, budget, deadline) {
    const paths = capturePaths(root,project.projectId), sourceValue = sourceState(state,source);
    let observedAt = sourceValue.pending?.observed_at || now();
    const inspected = inspectSource(source.file,project.projectId,sourceValue.source_path_sha256);
    const settledCursor = sourceValue.cursor && (sourceValue.cursor.offset === sourceValue.cursor.source_size
      || source.format === 'json' || sourceValue.last_reason === 'source_incomplete_tail');
    if (!sourceValue.pending && settledCursor && !inspected.reason
        && inspected.identity === sourceValue.cursor.file_identity
        && inspected.size === sourceValue.cursor.source_size && inspected.mtime_ns === sourceValue.cursor.mtime_ns) {
      budget.lagMs = Math.max(budget.lagMs,sourceValue.lag_ms || 0);
      return;
    }
    if (!sourceValue.pending && inspected.reason
        && sourceValue.source_occurrence_id === inspected.fingerprint && sourceValue.last_reason === inspected.reason) {
      budget.reason ||= inspected.reason; return;
    }
    let result;
    const pendingDiscontinuity = sourceValue.pending && !inspected.reason && (
      inspected.identity !== sourceValue.pending.file_identity || inspected.size < sourceValue.pending.source_size
      || (source.format === 'jsonl' && inspected.size === sourceValue.pending.source_size
        && inspected.mtime_ns !== sourceValue.pending.mtime_ns)
      || (source.format === 'json' && (inspected.size !== sourceValue.pending.source_size
        || inspected.mtime_ns !== sourceValue.pending.mtime_ns)));
    const discontinuityReason = pendingDiscontinuity ? inspected.identity !== sourceValue.pending.file_identity
      ? 'source_replaced' : inspected.size < sourceValue.pending.source_size ? 'source_truncated' : 'source_rewritten' : null;
    if (pendingDiscontinuity) observedAt = now();
    const readStartOffset = pendingDiscontinuity ? 0 : sourceValue.cursor?.offset || 0;
    const availableRecords = Math.min(DEFAULT_MAX_RECORDS,budget.records);
    const pendingBatch = sourceValue.pending?.correlations.length || 0;
    const pendingAttempt = sourceValue.pending?.attempt_records || pendingBatch;
    const requestedRecords = pendingBatch
      ? Math.max(1,Math.min(availableRecords,pendingAttempt,pendingBatch)) : availableRecords;
    const readerBytes = pendingBatch && requestedRecords <= 64 ? REDUCED_READER_BYTES : DEFAULT_MAX_BYTES;
    try {
      result = readBatchFn({ file: source.file, cursor: pendingDiscontinuity ? null : sourceValue.cursor, format: source.format,
        maxBytes: Math.min(readerBytes,budget.bytes),
        maxRecords: requestedRecords, maxLineBytes: DEFAULT_MAX_LINE_BYTES });
    } catch (error) { persistReadFailure(state,source,sourceValue,error,observedAt,paths); return; }
    if (discontinuityReason) result = { ...result, gaps: [{ offset: 0, length: 0,
      sha256: sha(['pending_source_discontinuity',sourceValue.pending.source_occurrence_id,discontinuityReason]),
      reason: discontinuityReason },...result.gaps] };
    budget.bytes -= result.bytesRead; budget.records -= result.records.length;
    note(source.family,'bytes_read',result.bytesRead);
    const changed = result.gaps.find(gap => ['source_missing','source_replaced','source_truncated','source_rewritten'].includes(gap.reason));
    const occurrence = changed?.reason === 'source_missing' ? inspected.fingerprint
      : !pendingDiscontinuity && sourceValue.pending?.source_occurrence_id || (!sourceValue.source_occurrence_id || changed
      ? sha([project.projectId,source.relative_path,result.cursor.file_identity,changed?.reason || 'initial',
        result.cursor.source_size,result.cursor.mtime_ns]) : sourceValue.source_occurrence_id);
    const projected = result.records.map(record => ({ record,
      result: projectRecordFn({ family: source.family, row: record.value, projectId: project.projectId,
        sourceId: `${source.relative_path}#${occurrence}`, recordDigest: record.sha256,
        sequence: record.offset, observedAt }) }));
    const previousPending = !pendingDiscontinuity && sourceValue.pending
      && sourceValue.pending.start_offset === (sourceValue.cursor?.offset || 0)
      && sourceValue.pending.source_occurrence_id === occurrence ? sourceValue.pending : null;
    const priorCorrelations = new Map((previousPending?.correlations || []).map(item => [item.provenance_sha256,item]));
    const correlations = [];
    const currentProvenance = new Set();
    for (const item of projected) {
      const provenance = sha([item.record.offset,item.record.length,item.record.sha256]);
      currentProvenance.add(provenance);
      const decision = priorCorrelations.get(provenance) || { provenance_sha256: provenance,
        ...(item.result.event ? correlation(item.result.event,project.projectId)
          : { run_correlation: 'missing', sgsd_run_id: null,
            reason: receiptReason(item.result.reason,'projection_rejected') }) };
      item.decision = decision; correlations.push(decision);
    }
    for (const decision of previousPending?.correlations || [])
      if (!currentProvenance.has(decision.provenance_sha256)) correlations.push(decision);
    if (correlations.length > MAX_PENDING) throw new Error('source_state_limit');
    sourceValue.pending = { schema_version: 1, start_offset: readStartOffset,
      observed_at: observedAt, source_occurrence_id: occurrence,
      attempt_records: Math.max(1,Math.min(requestedRecords,result.records.length || requestedRecords)),
      file_identity: result.cursor.file_identity, source_size: result.cursor.source_size,
      mtime_ns: result.cursor.mtime_ns, correlations };
    sourceValue.pending_bytes = Math.max(result.pendingBytes,
      result.cursor.source_size - readStartOffset);
    state.source_rotation++; state.updated_at = observedAt;
    durableState(paths.state,state);
    const receiptItems = [];
    for (const gap of result.gaps) {
      const base = receiptBase(project.projectId,source,sourceValue,occurrence,result.cursor.file_identity,gap,observedAt);
      receiptItems.push({ ...base, disposition: 'rejected', reason: receiptReason(gap.reason),
        source_event_id: null, detail_sha256: null, run_correlation: 'missing', detail: null });
    }
    const prepared = projected.map(item => {
      const base = receiptBase(project.projectId,source,sourceValue,occurrence,result.cursor.file_identity,item.record,observedAt);
      if (!item.result.event) return { item, base, event: null, proof: null, planned: { ...base,
        disposition: 'rejected', reason: receiptReason(item.result.reason), source_event_id: null,
        detail_sha256: null, run_correlation: 'missing', detail: null } };
      const decision = item.decision, event = applyCorrelation(item.result.event,decision);
      const unknownTime = item.result.detail?.capture_reasons?.includes('unknown_time_observed_at');
      if (!unknownTime && Date.parse(event.occurred_at) < Date.parse(state.initial_cutoff_at))
        return { item, base, event, proof: null, planned: { ...base, disposition: 'excluded',
          reason: 'excluded_before_capture_window', source_event_id: event.source_event_id,
          detail_sha256: event.payload.artifact_ref, run_correlation: decision.run_correlation,
          detail: item.result.detail } };
      const proof = canonicalize(event,observedAt);
      return { item, base, event, proof, planned: { ...base, disposition: 'duplicate',
        reason: RECEIPT_RESERVE_REASON,
        source_event_id: event.source_event_id, detail_sha256: event.payload.artifact_ref,
        canonical_event_id: proof.event_id, canonical_payload_sha256: proof.payload_sha256,
        run_correlation: decision.run_correlation, detail: item.result.detail } };
    });
    const reservation = receiptCapacity(paths.receipts,project.projectId,
      [...receiptItems,...prepared.map(item => item.planned)],observedAt,receiptFreeRatio);
    if (!reservation.available) {
      if (sourceValue.last_reason !== 'receipt_capacity') {
        sourceValue.counters.gaps++; state.counters.gaps++; note(source.family,'gaps');
      }
      sourceValue.pending.attempt_records = Math.max(1,Math.floor(sourceValue.pending.attempt_records / 2));
      sourceValue.last_reason = 'receipt_capacity'; state.updated_at = observedAt;
      budget.reason ||= 'receipt_capacity'; durableState(paths.state,state); return;
    }
    let processedRecords = 0;
    for (const { item, base, event, proof, planned } of prepared) {
      if (clock() >= deadline && !(requestedRecords === 1 && processedRecords === 0)) {
        budget.exhausted = true; budget.reason ||= 'processing_budget';
        sourceValue.pending.attempt_records = Math.max(1,Math.floor(sourceValue.pending.attempt_records / 2));
        sourceValue.last_reason = 'processing_budget'; state.updated_at = observedAt;
        durableState(paths.state,state); return;
      }
      if (!event || !proof) { receiptItems.push(planned); processedRecords++; continue; }
      const decision = item.decision;
      let stored;
      try { stored = touchStore(project.projectId,project.projectDir).ingest(event); }
      catch { stored = { status: 'rejected', reason: 'storage_unavailable' }; }
      if (stored.status === 'rejected' && RETRYABLE.has(stored.reason)) {
        sourceValue.last_reason = receiptReason(stored.reason,'storage_unavailable');
        budget.reason ||= sourceValue.last_reason;
        if (clock() >= deadline) budget.exhausted = true;
        state.updated_at = observedAt; durableState(paths.state,state); return;
      }
      if (['accepted','conflict'].includes(stored.status)) {
        const cached = stores.get(project.projectId); if (cached) cached.rows++;
        while ([...stores.values()].reduce((sum,value) => sum + value.rows,0) > maxCachedRows && stores.size) {
          const oldest = stores.keys().next().value;
          stores.delete(oldest);
        }
      }
      const disposition = ['accepted','duplicate','conflict'].includes(stored.status) ? stored.status : 'rejected';
      receiptItems.push({ ...base, disposition, reason: disposition === 'rejected'
        ? receiptReason(stored.reason) : receiptReason(item.result.reason,decision.reason) || decision.reason,
        source_event_id: event.source_event_id, detail_sha256: event.payload.artifact_ref,
        canonical_event_id: disposition === 'rejected' ? null : proof.event_id,
        canonical_payload_sha256: disposition === 'rejected' ? null : proof.payload_sha256,
        run_correlation: decision.run_correlation, detail: item.result.detail });
      processedRecords++;
      if (clock() >= deadline) budget.exhausted = true;
    }
    if (receiptItems.length) appendReceiptBatch(paths.receipts,project.projectId,receiptItems,observedAt,receiptFreeRatio);
    const remainingCorrelations = (previousPending?.correlations || [])
      .filter(decision => !currentProvenance.has(decision.provenance_sha256));
    sourceValue.cursor = result.cursor;
    sourceValue.pending = remainingCorrelations.length ? { schema_version: 1, start_offset: result.cursor.offset,
      observed_at: observedAt, source_occurrence_id: occurrence,
      attempt_records: Math.min(requestedRecords,remainingCorrelations.length), file_identity: result.cursor.file_identity,
      source_size: result.cursor.source_size, mtime_ns: result.cursor.mtime_ns,
      correlations: remainingCorrelations } : null;
    sourceValue.pending_bytes = result.pendingBytes;
    sourceValue.source_occurrence_id = occurrence; sourceValue.last_observed_at = observedAt;
    const dataGaps = result.gaps.filter(gap => gap.length > 0);
    sourceValue.last_reason = result.pendingBytes && source.format === 'jsonl' && result.records.length === 0
      && dataGaps.length === 0 && result.cursor.offset === readStartOffset
      && !result.cursor.discarding_oversize && !result.gaps.length
      ? 'source_incomplete_tail' : receiptItems.at(-1)?.reason || null;
    sourceValue.lag_ms = result.pendingBytes ? Math.max(0,Date.parse(now()) - Date.parse(observedAt)) : 0;
    for (const receipt of receiptItems) {
      sourceValue.counters[receipt.disposition]++; state.counters[receipt.disposition]++;
      sourceValue.counters.records++; state.counters.records++;
      if (receipt.disposition === 'rejected') { sourceValue.counters.gaps++; state.counters.gaps++; }
    }
    sourceValue.counters.bytes_read += result.bytesRead; state.counters.bytes_read += result.bytesRead;
    state.updated_at = observedAt;
    durableState(paths.state,state);
    for (const receipt of receiptItems) { note(source.family,receipt.disposition); note(source.family,'records');
      if (receipt.disposition === 'rejected') note(source.family,'gaps'); }
  }

  function processProject(project, budget, deadline) {
    const paths = capturePaths(root,project.projectId), observedAt = now();
    let state;
    try { state = readCaptureState({ root, projectId: project.projectId }) || initialState(project.projectId,observedAt); }
    catch { budget.reason ||= 'invalid_capture_state'; return; }
    const discovery = discoverSources(project.projectDir,Object.values(state.sources)), sources = discovery.sources;
    if (discovery.censusLimited) budget.reason ||= 'source_state_limit';
    if (!sources.length) return;
    const start = state.source_rotation % sources.length;
    for (let index = 0; index < sources.length && budget.bytes >= 80 * 1024 && budget.records > 0; index++) {
      if (clock() >= deadline) { budget.exhausted = true; break; }
      const source = sources[(start + index) % sources.length];
      try { processSource(project,state,source,budget,deadline); }
      catch (error) {
        if (error.message === 'source_state_limit') { state.counters.gaps++; state.updated_at = observedAt;
          try { durableState(paths.state,state); } catch {} }
        budget.reason ||= receiptReason(error.message,'storage_unavailable');
      }
    }
    const sourceRows = Object.values(state.sources);
    projectHealth.delete(project.projectId);
    projectHealth.set(project.projectId,{ pending_bytes: sourceRows.reduce((sum,row) => sum + row.pending_bytes,0),
      lag_ms: sourceRows.reduce((maximum,row) => Math.max(maximum,row.lag_ms || 0),0), gaps: state.counters.gaps,
      reason: sourceRows.find(row => row.last_reason && row.counters.gaps)?.last_reason || null });
    while (projectHealth.size > MAX_SOURCE_STATES) projectHealth.delete(projectHealth.keys().next().value);
  }

  function cycle() {
    if (closed) return last;
    if (running) return { ...last, running: true, reason: 'cycle_already_running' };
    running = true; const started = clock(), deadline = started + maxCycleMs;
    const budget = { bytes: maxCycleBytes, records: maxRecords, exhausted: false,
      pendingBytes: 0, lagMs: 0, reason: null };
    const discovery = projectBatch();
    try {
      while (projects.length && budget.bytes >= 80 * 1024 && budget.records > 0) {
        if (clock() >= deadline) { budget.exhausted = true; break; }
        processProject(projects.shift(),budget,deadline);
      }
    } finally {
      const duration = Math.max(0,clock() - started);
      const knownPending = [...projectHealth.values()].reduce((sum,row) => sum + row.pending_bytes,0);
      const knownLag = [...projectHealth.values()].reduce((maximum,row) => Math.max(maximum,row.lag_ms),0);
      const knownGaps = [...projectHealth.values()].reduce((sum,row) => sum + row.gaps,0);
      const knownReason = [...projectHealth.values()].find(row => row.reason)?.reason;
      last = { schema_version: 1, running: false, duration_ms: duration,
        bytes_read: maxCycleBytes - budget.bytes, records: maxRecords - budget.records,
        projects_enumerated: discovery.enumerated, pending_bytes: knownPending, lag_ms: knownLag,
        budget_exhausted: budget.exhausted || duration >= maxCycleMs || budget.bytes < 80 * 1024 || budget.records === 0,
        reason: budget.reason || knownReason || (knownGaps ? 'capture_gaps_recorded' : null)
          || (discovery.rejected ? 'invalid_project_registration' : null) };
      running = false;
    }
    return last;
  }

  function start() {
    if (closed || timer) return false;
    cycle(); timer = setInterval(cycle,pollMs); timer.unref(); return true;
  }

  function status() {
    return Object.freeze({ schema_version: 1, status: closed ? 'closed'
      : last.reason || totals.gaps ? 'degraded' : last.pending_bytes ? 'catching_up' : 'observed',
      cycle: { ...last }, counters: { ...totals }, families: Object.fromEntries(Object.entries(families)
        .filter(([,row]) => COUNTER_NAMES.some(name => row[name])).map(([name,row]) => [name,{ ...row }])),
      cached_stores: stores.size, cached_rows: [...stores.values()].reduce((sum,item) => sum + item.rows,0) });
  }

  function close() {
    if (closed) return false;
    closed = true; if (timer) clearInterval(timer); timer = null;
    try { projectDirectory?.closeSync(); } catch {} projectDirectory = null; projects = []; stores.clear();
    projectHealth.clear(); invalidProjects.clear(); return true;
  }

  return Object.freeze({ start, cycle, status, close });
}

module.exports = Object.freeze({ createLedgerRuntime, readCaptureState, capturePaths,
  RECEIPT_MAX_BYTES, MAX_RECEIPT_BATCH_BYTES, STATE_MAX_BYTES, OPERATIONAL_MAX_BYTES, MAX_SOURCE_STATES, MAX_PENDING,
  DEFAULT_CYCLE_BYTES, DEFAULT_CYCLE_MS, DEFAULT_PROJECTS, DEFAULT_POLL_MS });
