#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { StringDecoder } = require('node:string_decoder');
const { canonicalize, digest, scan, validate, validConflict } = require('./contract.cjs');
const { readRun } = require('./global-store.cjs');
const { SOURCES } = require('./sgsd-ledger.cjs');
const { RECEIPT_MAX_BYTES, MAX_RECEIPT_BATCH_BYTES } = require('./sgsd-ledger-runtime.cjs');
const { DEFAULT_MAX_BYTES } = require('./sgsd-ledger-reader.cjs');

const HEX = /^[a-f0-9]{64}$/;
const PROJECT = HEX;
const ISO = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/;
const DISPOSITIONS = new Set(['accepted','duplicate','conflict','rejected','excluded']);
const RUN_CORRELATIONS = new Set(['exact','missing','unmatched','cross_project']);
const PROVENANCE = new Set(['producer_observation','source_occurrence_fallback','recorded_attempt_identity']);
const MUDA_COVERAGE = new Set(['measured','no_input','synthetic','partial','unknown']);
const QUALITATIVE = new Set(['disabled','mechanical_findings','insufficient_diff','dry_run','attempt_failed','completed']);
const REASONS = new Set([null, 'excluded_before_capture_window', 'source_missing', 'source_empty',
  'source_replaced', 'source_truncated', 'source_rewritten', 'source_changed_during_read',
  'malformed_json', 'line_too_large', 'record_too_large', 'unsafe_file_owner', 'unsafe_hardlink',
  'unsafe_symlink', 'unsafe_special_file', 'source_read_failed', 'unsupported_source_schema',
  'invalid_source_row', 'invalid_observation_shape', 'invalid_muda_shape', 'invalid_source_shape',
  'invalid_recorded_run_identity', 'unknown_time_observed_at', 'semantic_detail_unknown',
  'projection_rejected', 'unmatched_recorded_run', 'cross_project_recorded_run', 'missing_recorded_run',
  'disk_pressure', 'writer_locked', 'storage_unavailable', 'canonical_size_limit', 'index_limit',
  'concurrent_writer_or_modified_ledger', 'malformed_tail', 'corrupt_ledger', 'corrupt_manifest',
  'closed_partition_integrity', 'concurrent_partition_writer', 'writer_lock_unverifiable',
  'receipt_capacity', 'source_state_limit', 'processing_budget', 'invalid_capture_state',
  'invalid_project_registration', 'source_incomplete_tail']);
const RECEIPT_KEYS = ['receipt_id','family','source_path_sha256','source_occurrence_id','file_identity',
  'offset','length','source_record_sha256','observed_at','disposition','reason','source_event_id',
  'detail_sha256','run_correlation','detail','canonical_event_id','canonical_payload_sha256'];
const DEFAULT_LIMITS = Object.freeze({ maxReceiptBytes: RECEIPT_MAX_BYTES, maxReceiptLineBytes: MAX_RECEIPT_BATCH_BYTES,
  maxReceiptRows: 250000, maxCanonicalBytes: 256 * 1024 * 1024, maxCanonicalRows: 150000,
  maxCanonicalFiles: 512, maxVerificationBytes: 64 * 1024 * 1024,
  maxVerificationRecords: 100000, maxProjects: 1024 });

const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const integer = value => Number.isSafeInteger(value) && value >= 0;
const timestamp = value => typeof value === 'string' && ISO.test(value) && Number.isFinite(Date.parse(value));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const only = (value, keys) => plain(value) && Object.keys(value).every(key => keys.includes(key));
const defaultRoot = () => path.resolve(process.env.SGSD_ATLAS_GLOBAL_ROOT
  || path.join(os.homedir(), '.local', 'state', 'sgsd', 'telemetry', 'global'));

function boundedLimits(input) {
  if (input == null) return { ...DEFAULT_LIMITS };
  if (!plain(input)) throw new Error('invalid_report_limits');
  const result = { ...DEFAULT_LIMITS };
  for (const [name, value] of Object.entries(input)) {
    if (!Object.hasOwn(DEFAULT_LIMITS, name) || !Number.isSafeInteger(value) || value < 1)
      throw new Error('invalid_report_limits');
    result[name] = Math.min(value, DEFAULT_LIMITS[name]);
  }
  return result;
}

function runtimeApi() {
  const api = require('./sgsd-ledger-runtime.cjs');
  if (typeof api.readCaptureState !== 'function' || typeof api.capturePaths !== 'function')
    throw new Error('capture_interface_unavailable');
  return api;
}

function finding(target, severity, reason, projectId = null, family = null) {
  target.push({ severity, reason, project_id: projectId, family });
}

function safeJson(file, maxBytes) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
      || (process.getuid && stat.uid !== process.getuid())) throw new Error('unsafe_report_input');
  if (stat.size > maxBytes) throw new Error('report_input_limit');
  const value = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!plain(value)) throw new Error('invalid_report_input');
  return value;
}

function boundedEntries(directory, maximum) {
  const entries = []; let handle, limited = false;
  try {
    handle = fs.opendirSync(directory);
    while (entries.length < maximum) { const entry = handle.readSync(); if (!entry) return { entries, limited }; entries.push(entry); }
    limited = Boolean(handle.readSync());
    return { entries, limited };
  } finally { try { handle?.closeSync(); } catch {} }
}

function projects(root, projectId, limits, findings) {
  const directory = path.join(root, 'projects');
  if (projectId) {
    const registration = path.join(directory, projectId, 'project.json');
    if (!fs.existsSync(registration)) {
      finding(findings, 'WARN', 'project_not_registered', projectId);
      return [];
    }
    return [registration];
  }
  if (!fs.existsSync(directory)) return [];
  const listed = boundedEntries(directory, limits.maxProjects), entries = listed.entries;
  if (listed.limited) finding(findings, 'WARN', 'project_scan_limit');
  return entries.filter(entry => entry.isDirectory() && PROJECT.test(entry.name))
    .map(entry => path.join(directory, entry.name, 'project.json'));
}

function registration(file, findings) {
  const expected = path.basename(path.dirname(file));
  try {
    const value = safeJson(file, 64 * 1024);
    if (!only(value, ['schema_version','project_id','project_dir']) || value.schema_version !== 1
        || value.project_id !== expected || digest(value.project_dir) !== expected
        || typeof value.project_dir !== 'string' || !path.isAbsolute(value.project_dir)) throw new Error('invalid');
    return { project_id: expected, project_dir: path.resolve(value.project_dir) };
  } catch {
    finding(findings, 'FAIL', 'invalid_project_registration', PROJECT.test(expected) ? expected : null);
    return null;
  }
}

function validReceipt(value, projectId) {
  const oversizedLine = value?.disposition === 'rejected' && value?.reason === 'line_too_large'
    && integer(value.length) && value.length > 64 * 1024 && value.length <= DEFAULT_MAX_BYTES;
  const oversizedRecord = value?.disposition === 'rejected' && value?.reason === 'record_too_large'
    && integer(value.length) && value.length > 64 * 1024;
  const hasCanonicalEvent = Object.hasOwn(value || {}, 'canonical_event_id');
  const hasCanonicalPayload = Object.hasOwn(value || {}, 'canonical_payload_sha256');
  const canonicalProof = hasCanonicalEvent && hasCanonicalPayload;
  if (!only(value, RECEIPT_KEYS) || hasCanonicalEvent !== hasCanonicalPayload
      || (canonicalProof && ((value.canonical_event_id === null) !== (value.canonical_payload_sha256 === null)
        || (value.canonical_event_id !== null && (!HEX.test(value.canonical_event_id || '')
          || !HEX.test(value.canonical_payload_sha256 || '')))))
      || !HEX.test(value.receipt_id || '') || value.project_id !== undefined
      || !Object.hasOwn(SOURCES, value.family) || !HEX.test(value.source_path_sha256 || '')
      || !HEX.test(value.source_occurrence_id || '')
      || (value.file_identity !== null && !HEX.test(value.file_identity || ''))
      || !integer(value.offset) || !integer(value.length)
      || (value.length > 64 * 1024 && !oversizedLine && !oversizedRecord)
      || !HEX.test(value.source_record_sha256 || '') || !timestamp(value.observed_at)
      || !DISPOSITIONS.has(value.disposition) || !REASONS.has(value.reason)
      || (value.source_event_id !== null && !HEX.test(value.source_event_id || ''))
      || (value.detail_sha256 !== null && !HEX.test(value.detail_sha256 || ''))
      || !RUN_CORRELATIONS.has(value.run_correlation)
      || (value.detail !== null && !plain(value.detail))) return false;
  if ((value.detail === null) !== (value.detail_sha256 === null)) return false;
  if (value.detail !== null && digest(value.detail) !== value.detail_sha256) return false;
  if (value.receipt_id !== digest(['sgsd-ledger-receipt-v1', projectId, value.family,
    value.source_occurrence_id, value.offset, value.length, value.source_record_sha256])) return false;
  if (['accepted','duplicate'].includes(value.disposition)
      && (!value.source_event_id || !value.detail_sha256)) return false;
  if (['accepted','duplicate','conflict'].includes(value.disposition)) {
    if (canonicalProof && value.canonical_event_id === null) return false;
  } else if (canonicalProof && value.canonical_event_id !== null) return false;
  return true;
}

function scanReceipts(file, projectId, limits, onReceipt) {
  const result = { corrupt: false, raced: false, limited: false, physical: 0 };
  if (!fs.existsSync(file)) return result;
  const before = fs.lstatSync(file, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
      || (process.getuid && before.uid !== BigInt(process.getuid()))) return { ...result, corrupt: true };
  if (before.size > BigInt(limits.maxReceiptBytes)) return { ...result, limited: true };
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  const decoder = new StringDecoder('utf8'), buffer = Buffer.alloc(64 * 1024);
  let pending = '', rows = 0;
  const consume = text => {
    if (!text.trim()) return;
    if (Buffer.byteLength(text) > limits.maxReceiptLineBytes) { result.corrupt = true; return; }
    if (++rows > limits.maxReceiptRows) { result.limited = true; return; }
    let batch;
    try { batch = JSON.parse(text); } catch { result.corrupt = true; return; }
    if (!only(batch, ['schema_version','batch_id','project_id','committed_at','receipts'])
        || batch.schema_version !== 1 || !HEX.test(batch.batch_id || '') || batch.project_id !== projectId
        || !timestamp(batch.committed_at) || !Array.isArray(batch.receipts) || batch.receipts.length > 256) {
      result.corrupt = true; return;
    }
    if (batch.batch_id !== digest(batch.receipts.map(receipt => receipt?.receipt_id))) {
      result.corrupt = true; return;
    }
    for (const receipt of batch.receipts) {
      result.physical++;
      if (!validReceipt(receipt, projectId)) result.corrupt = true;
      else onReceipt(receipt);
    }
  };
  try {
    let count;
    while (!result.limited && (count = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) {
      pending += decoder.write(buffer.subarray(0, count));
      let end;
      while (!result.limited && (end = pending.indexOf('\n')) !== -1) {
        consume(pending.slice(0, end)); pending = pending.slice(end + 1);
      }
      if (!result.limited && Buffer.byteLength(pending) > limits.maxReceiptLineBytes) {
        result.corrupt = true; pending = '';
      }
    }
    pending += decoder.end();
    if (!result.limited && pending.length) result.corrupt = true;
    const after = fs.fstatSync(fd, { bigint: true });
    let current;
    try { current = fs.lstatSync(file, { bigint: true }); } catch { current = null; }
    result.raced = !current || current.dev !== after.dev || current.ino !== after.ino
      || after.dev !== before.dev || after.ino !== before.ino || after.size !== before.size || after.mtimeNs !== before.mtimeNs;
  } finally { fs.closeSync(fd); }
  return result;
}

function emptyFamily(name) {
  return { family: name, state: 'idle', sources: 0, observations: 0, accepted: 0, duplicate: 0,
    conflict: 0, rejected: 0, excluded: 0, gaps: 0, pending: 0, pending_bytes: 0, lag_ms: null,
    provenance: { producer_observation: 0, source_occurrence_fallback: 0, recorded_attempt_identity: 0, unknown: 0 },
    run_correlation: { exact: 0, missing: 0, unmatched: 0, cross_project: 0 },
    time: { observed: 0, unknown: 0, latest_observed_at: null, lag_ms: null }, reasons: {}, source_reasons: {},
    ...(name === 'muda' ? { muda: { coverage: { measured: 0, no_input: 0, synthetic: 0, partial: 0, unknown: 0 },
      qualitative: Object.fromEntries([...QUALITATIVE].map(reason => [reason, 0])),
      completed_reports: 0, critical_count: 0, warning_count: 0 } } : {}) };
}

function observe(family, receipt, event, now) {
  family.observations++;
  family[receipt.disposition]++;
  family.run_correlation[receipt.run_correlation]++;
  if (receipt.reason) family.reasons[receipt.reason] = (family.reasons[receipt.reason] || 0) + 1;
  const provenance = receipt.detail?.identity_provenance;
  family.provenance[PROVENANCE.has(provenance) ? provenance : 'unknown']++;
  const unknownTime = !event || (Array.isArray(receipt.detail?.capture_reasons)
    && receipt.detail.capture_reasons.includes('unknown_time_observed_at'));
  family.time[unknownTime ? 'unknown' : 'observed']++;
  if (!unknownTime && timestamp(event.occurred_at)) {
    if (!family.time.latest_observed_at || Date.parse(event.occurred_at) > Date.parse(family.time.latest_observed_at))
      family.time.latest_observed_at = event.occurred_at;
    family.time.lag_ms = Math.max(0, now - Date.parse(family.time.latest_observed_at));
  }
  if (family.family === 'muda') {
    const coverage = MUDA_COVERAGE.has(receipt.detail?.coverage) ? receipt.detail.coverage : 'unknown';
    family.muda.coverage[coverage]++;
    const closed = receipt.detail?.qualitative?.closed_reason;
    if (QUALITATIVE.has(closed)) family.muda.qualitative[closed]++;
    if (closed === 'completed') {
      family.muda.completed_reports++;
      if (integer(receipt.detail?.qualitative?.critical_count)) family.muda.critical_count += receipt.detail.qualitative.critical_count;
      if (integer(receipt.detail?.qualitative?.warning_count)) family.muda.warning_count += receipt.detail.qualitative.warning_count;
    }
  }
}

function canonicalEvents(paths, projectId, limits) {
  const result = { events: new Map(), eventIds: new Map(), corrupt: false, raced: false, limited: false,
    conflictCandidates: new Map(), conflictEventIds: new Set(), physical: new Map(),
    conflicts: 0, duplicates: 0, rows: 0 };
  const conflictRows = [];
  if (!fs.existsSync(paths.directory)) return result;
  const prefix = path.basename(paths.event_prefix);
  let bytes = 0;
  const listed = boundedEntries(paths.directory, limits.maxCanonicalFiles);
  if (listed.limited) result.limited = true;
  for (const entry of listed.entries) {
    if (!entry.name.startsWith(prefix) || !entry.name.endsWith('.jsonl')) continue;
    if (!entry.isFile()) { result.corrupt = true; continue; }
    const file = path.join(paths.directory, entry.name), before = fs.lstatSync(file, { bigint: true });
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
        || (process.getuid && before.uid !== BigInt(process.getuid()))) { result.corrupt = true; continue; }
    bytes += Number(before.size);
    if (bytes > limits.maxCanonicalBytes) { result.limited = true; break; }
    let parsed;
    try {
      parsed = scan(file, row => {
        if (++result.rows > limits.maxCanonicalRows) { const error = new Error('limit'); error.code = 'INDEX_LIMIT'; throw error; }
        if (row.event_type === 'integrity_conflict') {
          if (!validConflict(row)) result.corrupt = true;
          else {
            result.conflicts++; conflictRows.push(row);
            const prior = result.physical.get(row.event_id);
            if (prior) {
              result.duplicates++;
              if (prior.payload_sha256 !== row.payload_sha256) result.corrupt = true;
            } else result.physical.set(row.event_id,row);
            result.conflictCandidates.set(`${row.conflicting_event_id}:${row.conflicting_payload_sha256}`,row);
            result.conflictEventIds.add(row.conflicting_event_id);
          }
          return;
        }
        const { event_id, payload_sha256, ingested_at, ...event } = row;
        if (validate(event) || !timestamp(ingested_at)) { result.corrupt = true; return; }
        const canonical = canonicalize(event, ingested_at);
        if (canonical.event_id !== event_id || canonical.payload_sha256 !== payload_sha256
            || event.source?.kind !== 'sgsd_ledger' || event.source?.instance !== projectId
            || event.scope?.launcher_repo_id !== projectId) { result.corrupt = true; return; }
        const physical = result.physical.get(event_id);
        if (physical) {
          result.duplicates++;
          if (physical.payload_sha256 !== payload_sha256) result.corrupt = true;
        } else result.physical.set(event_id,row);
        const prior = result.events.get(event.source_event_id);
        if (prior && prior.event_id !== event_id) {
          result.duplicates++;
          if (prior.payload_sha256 !== payload_sha256) result.corrupt = true;
        } else if (!prior) result.events.set(event.source_event_id, row);
        result.eventIds.set(event_id, payload_sha256);
      });
    } catch (error) {
      if (error.code !== 'INDEX_LIMIT') throw error;
      result.limited = true;
      parsed = { corrupt: false, malformed_tail: false };
    }
    let after;
    try { after = fs.lstatSync(file, { bigint: true }); } catch { after = null; }
    const raced = !after || after.dev !== before.dev || after.ino !== before.ino
      || after.size !== before.size || after.mtimeNs !== before.mtimeNs;
    if (raced) result.raced = true;
    if (parsed.corrupt || (parsed.malformed_tail && !raced)) result.corrupt = true;
  }
  for (const row of conflictRows) {
    const parentPayload = result.eventIds.get(row.conflicting_event_id);
    if (!result.limited && !result.raced && parentPayload !== row.first_payload_sha256) result.corrupt = true;
  }
  return result;
}

function reconcileReceipts(state, receipts, scanned, stateRaced) {
  if (!state) return { status: receipts.size ? (stateRaced ? 'incomplete' : 'mismatch') : 'unavailable', durable_records: null,
    unique_receipts: receipts.size };
  const bySource = new Map();
  for (const receipt of receipts.values())
    bySource.set(receipt.source_path_sha256, (bySource.get(receipt.source_path_sha256) || 0) + 1);
  let missing = state.counters.records > receipts.size, ahead = receipts.size > state.counters.records;
  for (const source of Object.values(state.sources || {})) {
    const observed = bySource.get(source.source_path_sha256) || 0;
    missing ||= source.counters.records > observed;
    ahead ||= observed > source.counters.records;
    bySource.delete(source.source_path_sha256);
  }
  if (bySource.size) ahead = true;
  const pending = Object.values(state.sources || {}).some(source => source.pending !== null);
  const stable = !stateRaced && !scanned.corrupt && !scanned.raced && !scanned.limited;
  const status = !stable ? 'incomplete' : missing || (ahead && !pending) ? 'mismatch'
    : ahead ? 'pending_commit' : 'matched';
  return { status, durable_records: state.counters.records, unique_receipts: receipts.size };
}

function verifyCanonical(receipts, canonical, root, projectId) {
  let matched = 0, missing = 0, mismatched = 0, proofIncomplete = 0;
  const matchedPhysical = new Set(), receiptEvents = new Map();
  for (const receipt of receipts.values()) {
    if (!['accepted','duplicate','conflict'].includes(receipt.disposition)) continue;
    const hasProof = Object.hasOwn(receipt,'canonical_event_id')
      && Object.hasOwn(receipt,'canonical_payload_sha256');
    let row;
    if (hasProof) {
      if (receipt.disposition !== 'conflict') {
        const normal = canonical.physical.get(receipt.canonical_event_id);
        if (normal?.event_type !== 'integrity_conflict'
            && normal?.payload_sha256 === receipt.canonical_payload_sha256) row = normal;
      }
      if (!row && receipt.disposition !== 'accepted')
        row = canonical.conflictCandidates.get(`${receipt.canonical_event_id}:${receipt.canonical_payload_sha256}`);
      if (!row) {
        const candidate = canonical.physical.get(receipt.canonical_event_id);
        if (candidate || canonical.conflictEventIds.has(receipt.canonical_event_id)) mismatched++;
        else missing++;
        continue;
      }
    } else {
      proofIncomplete++;
      if (receipt.disposition === 'conflict') continue;
      row = canonical.events.get(receipt.source_event_id);
      if (!row) { missing++; continue; }
    }
    let runMismatch = false;
    if (receipt.run_correlation === 'exact') {
      try {
        const run = readRun(root, row.identity?.sgsd_run_id);
        runMismatch = !run || run.project_id !== projectId;
      } catch { runMismatch = true; }
    } else runMismatch = row.identity?.sgsd_run_id != null;
    const isConflict = row.event_type === 'integrity_conflict';
    const receiptMismatch = receipt.source_event_id !== null && row.source_event_id !== receipt.source_event_id;
    const detailMismatch = !isConflict && (row.payload?.artifact_ref !== receipt.detail_sha256
      || row.payload?.content_digest !== receipt.source_record_sha256
      || row.payload?.purpose !== receipt.family
      || row.source?.provenance !== receipt.detail?.identity_provenance);
    if (receiptMismatch || detailMismatch || runMismatch) mismatched++;
    else {
      matched++; matchedPhysical.add(row.event_id); receiptEvents.set(receipt.receipt_id,row);
    }
  }
  return { matched, missing, mismatched, proofIncomplete,
    orphans: Math.max(0, canonical.physical.size - matchedPhysical.size), receiptEvents };
}

function openSource(projectDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.length || path.isAbsolute(relativePath)) throw new Error('unsafe');
  const project = path.resolve(projectDir), file = path.resolve(project, relativePath);
  if (file !== project && !file.startsWith(project + path.sep)) throw new Error('unsafe');
  let current = project;
  for (const part of path.relative(project, file).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { bigint: true });
    if (stat.isSymbolicLink()) throw new Error('unsafe');
  }
  const before = fs.lstatSync(file, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
      || (process.getuid && before.uid !== BigInt(process.getuid()))) throw new Error('unsafe');
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  const stat = fs.fstatSync(fd, { bigint: true });
  if (stat.dev !== before.dev || stat.ino !== before.ino) { fs.closeSync(fd); throw new Error('unsafe'); }
  return { fd, file, stat, identity: sha(`${stat.dev}:${stat.ino}:${stat.birthtimeMs}`) };
}

function verification(projectDir, state, receipts, requested, limits) {
  const result = { requested, status: requested ? 'verified' : 'not_requested', checked: 0, matched: 0,
    mismatched: 0, missing: 0, raced: 0, limited: 0, unverifiable: 0 };
  if (!requested) return result;
  const sourceValues = plain(state?.sources) ? Object.values(state.sources) : [];
  const sources = Object.fromEntries(sourceValues.map(source => [source.source_path_sha256, source]));
  const grouped = new Map(); let selected = 0, bytes = 0;
  for (const receipt of receipts.values()) {
    if (receipt.reason === 'record_too_large') { result.unverifiable++; continue; }
    if (selected >= limits.maxVerificationRecords || bytes + receipt.length > limits.maxVerificationBytes) {
      result.limited++; continue;
    }
    selected++; bytes += receipt.length;
    const source = sources[receipt.source_path_sha256];
    if (!source || source.source_occurrence_id !== receipt.source_occurrence_id || receipt.length === 0
        || receipt.file_identity === null) {
      result.unverifiable++; continue;
    }
    const list = grouped.get(receipt.source_path_sha256) || [];
    list.push(receipt); grouped.set(receipt.source_path_sha256, list);
  }
  for (const [sourceKey, items] of grouped) {
    const source = sources[sourceKey]; let opened;
    try { opened = openSource(projectDir, source.relative_path); }
    catch (error) {
      const target = error.code === 'ENOENT' ? 'missing' : 'unverifiable';
      result[target] += items.length; continue;
    }
    const local = { matched: 0, mismatched: 0, checked: 0 };
    try {
      for (const receipt of items) {
        local.checked++;
        if (opened.identity !== receipt.file_identity || BigInt(receipt.offset + receipt.length) > opened.stat.size) {
          local.mismatched++; continue;
        }
        const buffer = Buffer.alloc(receipt.length);
        const count = fs.readSync(opened.fd, buffer, 0, buffer.length, receipt.offset);
        if (count !== receipt.length || sha(buffer) !== receipt.source_record_sha256) local.mismatched++;
        else local.matched++;
      }
      const after = fs.fstatSync(opened.fd, { bigint: true });
      let current;
      try { current = fs.lstatSync(opened.file, { bigint: true }); } catch { current = null; }
      const raced = !current || current.dev !== after.dev || current.ino !== after.ino
        || after.dev !== opened.stat.dev || after.ino !== opened.stat.ino
        || after.size !== opened.stat.size || after.mtimeNs !== opened.stat.mtimeNs;
      if (raced) result.raced += local.checked;
      else { result.checked += local.checked; result.matched += local.matched; result.mismatched += local.mismatched; }
    } finally { fs.closeSync(opened.fd); }
  }
  if (result.mismatched) result.status = 'mismatch';
  else if (result.missing || result.raced || result.limited || result.unverifiable) result.status = 'incomplete';
  return result;
}

function captureSummary(state) {
  if (!state) return null;
  const counters = {};
  for (const name of ['accepted','duplicate','conflict','rejected','excluded','gaps','records','bytes_read'])
    counters[name] = integer(state.counters?.[name]) ? state.counters[name] : 0;
  let pending = 0, pendingBytes = 0;
  for (const source of Object.values(state.sources || {})) {
    pendingBytes += integer(source.pending_bytes) ? source.pending_bytes : 0;
    pending += Array.isArray(source.pending?.correlations) ? source.pending.correlations.length : 0;
  }
  return { capture_started_at: timestamp(state.capture_started_at) ? state.capture_started_at : null,
    initial_cutoff_at: timestamp(state.initial_cutoff_at) ? state.initial_cutoff_at : null,
    updated_at: timestamp(state.updated_at) ? state.updated_at : null,
    source_rotation: integer(state.source_rotation) ? state.source_rotation : 0,
    pending, pending_bytes: pendingBytes, counters };
}

function projectReport(root, registered, options, findings) {
  const { readCaptureState, capturePaths } = runtimeApi();
  const paths = capturePaths(root, registered.project_id);
  let state = null;
  try { state = readCaptureState({ root, projectId: registered.project_id }); }
  catch { finding(findings, 'FAIL', 'capture_state_invalid', registered.project_id); }
  if (!state) finding(findings, 'WARN', 'capture_state_missing', registered.project_id);
  const families = new Map(Object.keys(SOURCES).map(name => [name, emptyFamily(name)]));
  if (state && plain(state.sources)) for (const source of Object.values(state.sources)) {
    const family = families.get(source.family); if (!family) continue;
    family.sources++;
    family.pending_bytes += integer(source.pending_bytes) ? source.pending_bytes : 0;
    family.pending += Array.isArray(source.pending?.correlations) ? source.pending.correlations.length : 0;
    if (integer(source.counters?.gaps)) family.gaps += source.counters.gaps;
    if (integer(source.lag_ms)) family.lag_ms = Math.max(family.lag_ms || 0, source.lag_ms);
    if (REASONS.has(source.last_reason) && source.last_reason)
      family.source_reasons[source.last_reason] = (family.source_reasons[source.last_reason] || 0) + 1;
  }
  const unique = new Map(); let receiptReplays = 0, replayConflict = false;
  const scanned = scanReceipts(paths.receipts, registered.project_id, options.limits, receipt => {
    const prior = unique.get(receipt.receipt_id);
    if (prior) {
      receiptReplays++;
      const dispositions = new Set([prior.disposition,receipt.disposition]);
      const compatibleDisposition = dispositions.size === 1
        || (dispositions.size === 2 && dispositions.has('duplicate')
          && (dispositions.has('accepted') || dispositions.has('conflict')));
      const normalizedPrior = { ...prior, disposition: compatibleDisposition ? 'stored' : prior.disposition };
      const normalizedReceipt = { ...receipt, disposition: compatibleDisposition ? 'stored' : receipt.disposition };
      if (!compatibleDisposition || digest(normalizedPrior) !== digest(normalizedReceipt)) replayConflict = true;
      return;
    }
    unique.set(receipt.receipt_id, receipt);
  });
  if (scanned.corrupt) finding(findings, 'FAIL', 'receipt_ledger_corrupt', registered.project_id);
  if (scanned.raced) finding(findings, 'WARN', 'receipt_ledger_raced', registered.project_id);
  if (scanned.limited) finding(findings, 'WARN', 'receipt_scan_limit', registered.project_id);
  if (replayConflict) finding(findings, 'FAIL', 'receipt_replay_conflict', registered.project_id);
  let stateRaced = false;
  try {
    const latestState = readCaptureState({ root, projectId: registered.project_id });
    stateRaced = (state === null) !== (latestState === null)
      || (state !== null && digest(state) !== digest(latestState));
  } catch { stateRaced = true; }
  if (stateRaced) finding(findings, 'WARN', 'capture_state_raced', registered.project_id);
  const receiptReconciliation = reconcileReceipts(state, unique, scanned, stateRaced);
  if (receiptReconciliation.status === 'mismatch')
    finding(findings, 'FAIL', 'capture_receipt_count_mismatch', registered.project_id);
  else if (receiptReconciliation.status === 'pending_commit')
    finding(findings, 'WARN', 'capture_receipt_commit_pending', registered.project_id);

  const canonical = canonicalEvents(paths, registered.project_id, options.limits);
  if (canonical.corrupt) finding(findings, 'FAIL', 'operational_canonical_invalid', registered.project_id);
  if (canonical.raced) finding(findings, 'WARN', 'canonical_ledger_raced', registered.project_id);
  if (canonical.duplicates) finding(findings, 'FAIL', 'duplicate_canonical_events', registered.project_id);
  if (canonical.limited) finding(findings, 'WARN', 'canonical_scan_limit', registered.project_id);
  const join = verifyCanonical(unique, canonical, root, registered.project_id);
  const canonicalIncomplete = canonical.raced || canonical.limited;
  const reconciliationIncomplete = canonicalIncomplete || scanned.raced || scanned.limited || stateRaced;
  if (join.missing && !canonicalIncomplete) finding(findings, 'FAIL', 'canonical_event_missing', registered.project_id);
  if (join.mismatched && !canonicalIncomplete) finding(findings, 'FAIL', 'canonical_receipt_mismatch', registered.project_id);
  if (join.proofIncomplete) finding(findings, 'WARN', 'canonical_receipt_proof_incomplete', registered.project_id);
  if (join.orphans && !reconciliationIncomplete)
    finding(findings, 'WARN', 'canonical_event_without_receipt', registered.project_id);

  for (const receipt of unique.values())
    observe(families.get(receipt.family), receipt,
      join.receiptEvents.get(receipt.receipt_id) || canonical.events.get(receipt.source_event_id), options.now);

  for (const family of families.values()) {
    if (family.conflict || family.rejected || family.gaps || family.pending || family.pending_bytes
        || family.run_correlation.unmatched || family.run_correlation.cross_project) family.state = 'degraded';
    else if (!family.observations) family.state = 'idle';
    else if (family.observations === family.excluded) family.state = 'excluded';
    else family.state = 'observed';
  }
  const verify = verification(registered.project_dir, state, unique, options.verifySources, options.limits);
  if (verify.status === 'mismatch') finding(findings, 'FAIL', 'source_verification_mismatch', registered.project_id);
  else if (verify.status === 'incomplete') finding(findings, 'WARN', 'source_verification_incomplete', registered.project_id);
  if ([...families.values()].some(family => family.state !== 'observed'))
    finding(findings, 'WARN', 'operation_coverage_incomplete', registered.project_id);
  return { project_id: registered.project_id, observations: unique.size, receipt_rows: scanned.physical,
    receipt_replays: receiptReplays, capture: captureSummary(state), canonical: {
      rows: canonical.rows, reconciliation: reconciliationIncomplete ? 'incomplete' : 'checked',
      matched_receipts: join.matched, missing_receipts: canonicalIncomplete ? null : join.missing,
      mismatched_receipts: canonicalIncomplete ? null : join.mismatched,
      unverified_observed_receipts: canonicalIncomplete ? join.missing + join.mismatched : 0,
      proof_incomplete_receipts: join.proofIncomplete,
      orphan_events: reconciliationIncomplete ? null : join.orphans, conflicts: canonical.conflicts,
      duplicates: canonical.duplicates, raced: canonical.raced, limited: canonical.limited },
    receipt_reconciliation: receiptReconciliation,
    families: [...families.values()], verification: verify };
}

function operationReport(options = {}) {
  if (!plain(options)) throw new Error('invalid_report_options');
  const root = path.resolve(options.root || defaultRoot());
  const projectId = options.projectId == null ? null : options.projectId;
  if (projectId !== null && !PROJECT.test(projectId)) throw new Error('invalid_project_id');
  const now = options.now == null ? Date.now() : options.now;
  if (!Number.isFinite(now)) throw new Error('invalid_report_time');
  const limits = boundedLimits(options.limits), findings = [];
  const report = { schema_version: 1, generated_at: new Date(now).toISOString(), status: 'WARN',
    complete_coverage: false, aggregate_semantics: 'source_observations_not_unique_actions',
    project_filter: projectId, projects: [], findings };
  let files;
  try { files = projects(root, projectId, limits, findings); }
  catch { finding(findings, 'FAIL', 'project_scan_unavailable'); files = []; }
  for (const file of files) {
    const registered = registration(file, findings);
    if (registered) report.projects.push(projectReport(root, registered, {
      verifySources: options.verifySources === true, now, limits }, findings));
  }
  if (!report.projects.length) finding(findings, 'WARN', 'no_registered_projects');
  report.status = findings.some(row => row.severity === 'FAIL') ? 'FAIL'
    : findings.length ? 'WARN' : 'PASS';
  return report;
}

function cli(argv = process.argv.slice(2)) {
  const options = {}; let json = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--root' && argv[index + 1]) options.root = argv[++index];
    else if (arg === '--project-id' && argv[index + 1]) options.projectId = argv[++index];
    else if (arg === '--verify-sources') options.verifySources = true;
    else if (arg === '--json') json = true;
    else throw new Error('invalid_report_arguments');
  }
  const report = operationReport(options);
  process.stdout.write(JSON.stringify(report, null, json ? 0 : 2) + '\n');
  return report.status === 'FAIL' ? 1 : report.status === 'WARN' ? 10 : 0;
}

if (require.main === module) {
  try { process.exitCode = cli(); }
  catch { process.stdout.write('{"status":"FAIL","reason":"operation_report_unavailable"}\n'); process.exitCode = 1; }
}

module.exports = Object.freeze({ operationReport, cli, DEFAULT_LIMITS });
