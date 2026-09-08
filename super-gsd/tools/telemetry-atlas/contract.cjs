#!/usr/bin/env node
'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { StringDecoder } = require('node:string_decoder');

// Permitted containers never grant permission to store arbitrary model text.
const atom = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(v);
const number = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= Number.MAX_SAFE_INTEGER;
const integer = v => number(v) && Number.isInteger(v);
const boolean = v => typeof v === 'boolean';
const percent = v => number(v) && v <= 100;
const timestamp = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const fields = (names, check = atom) => Object.fromEntries(names.split(' ').map(name => [name, check]));
const SHAPES = Object.freeze({
  source: fields('kind instance version provenance confidence completeness_reason'),
  identity: fields('sgsd_run_id session_id request_id client_request_id trace_id span_id parent_span_id message_id prompt_id agent_id parent_agent_id workflow_id handoff_id parent_handoff_id dispatch_id packet_id gate_invocation_id attempt_id retry_group_id tool_use_id finding_id repair_id'),
  scope: fields('launcher_repo_id event_cwd_repo_id target_repo_id target_repo_source target_repo_confidence milestone phase plan task gate role cost_center attribution_method'),
  runtime: fields('provider model effort service_tier speed query_source active_agent active_skill active_plugin active_mcp_server source_sha pre_commit_sha post_commit_sha claude_version codex_version collector_version prometheus_version prompt_template_digest system_prompt_digest config_digest gate_registry_digest route_registry_digest pricing_table_version classifier_rules_version fingerprint_version'),
  usage: { ...fields('input_tokens cache_creation_tokens cache_read_tokens output_tokens reasoning_tokens total_provider_tokens visible_response_chars visible_response_tokens_estimated report_bytes tool_input_bytes tool_result_bytes context_window_tokens unattributed_residual_tokens cost_usd_estimated duration_ms', number), context_occupancy_percentage: percent },
  execution: { ...fields('status stop_reason error_code'), ...fields('success compaction_event fallback', boolean), ...fields('retry_count iteration_count time_to_first_token_ms', number) },
  tool: { ...fields('name family argument_digest result_digest'), success: boolean, duration_ms: number },
  quota: { window: v => ['five_hour','seven_day','gateway'].includes(v), used_percentage: percent, resets_at: v => timestamp(v) || (integer(v) && v > 0), gateway_spend_limit_percentage: percent, scope: v => ['account','gateway','unknown'].includes(v), attribution: atom },
  payload: { ...fields('purpose artifact_ref content_digest component_manifest_ref'), raw_content_recorded: v => v === false },
  gate: { ...fields('verdict finding_fingerprint finding_disposition duplicate_of'), ...fields('eligible fired', boolean) },
  outcome: { ...fields('gate_outcome status evidence_ref'), ...fields('accepted tests_passed operator_corrected', boolean) },
});
const EVENT_TYPES = new Set(['api_request','handoff','tool','artifact','gate','finding','repair','quota','outcome','coverage']);
const TOP_LEVEL = new Set(['schema_version','source_event_id','occurred_at','event_sequence','event_type', ...Object.keys(SHAPES)]);
const FORBIDDEN = /^(?:.*_)?(?:prompt|response|email|account_id|account_uuid|raw_api_body|raw_api_bodies|request_body|response_body|reasoning_content|tool_content|tool_details)$/;
const plain = v => v && typeof v === 'object' && !Array.isArray(v) && [Object.prototype,null].includes(Object.getPrototypeOf(v));
function forbidden(value, seen = new Set(), depth = 0) {
  if (!value || typeof value !== 'object') return false;
  if (depth > 8 || seen.has(value)) return true;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.test(key.toLowerCase().replace(/[-.]/g, '_')) || forbidden(child, seen, depth + 1)) return true;
  }
  return false;
}
function validate(input) {
  if (!plain(input)) return 'invalid_envelope';
  if (forbidden(input)) return 'privacy_forbidden_field';
  if (Object.keys(input).some(key => !TOP_LEVEL.has(key))) return 'unknown_top_level_field';
  if (input.schema_version !== 1) return 'unsupported_schema_version';
  if (!atom(input.source_event_id)) return 'missing_source_event_id';
  if (!timestamp(input.occurred_at)) return 'invalid_occurred_at';
  if (!EVENT_TYPES.has(input.event_type)) return 'invalid_event_type';
  if (input.event_sequence != null && !integer(input.event_sequence)) return 'invalid_event_sequence';
  if (!plain(input.source) || !atom(input.source.kind) || !atom(input.source.instance)) return 'invalid_source';
  for (const [section, shape] of Object.entries(SHAPES)) {
    if (input[section] == null) continue;
    if (!plain(input[section])) return 'invalid_section';
    for (const [key, value] of Object.entries(input[section])) {
      if (!Object.hasOwn(shape,key)) return 'unknown_nested_field';
      if (value !== null && !shape[key](value)) return 'invalid_field_type';
    }
  }
  if (Buffer.byteLength(JSON.stringify(input)) > 32768) return 'event_too_large';
  return null;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key,stable(value[key])]));
  return value;
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex'); }
function canonicalize(input, ingestedAt = new Date().toISOString()) {
  const payload = { ...input, event_sequence: input.event_sequence ?? null };
  return Object.freeze({ ...stable(payload), event_id: digest([input.schema_version,input.source.kind,input.source.instance,
    input.runtime?.provider || null,input.identity?.session_id || null,input.event_type,input.source_event_id]),
  ingested_at: ingestedAt, payload_sha256: digest(payload) });
}
function safePath(file) {
  let current = path.resolve(file);
  while (true) {
    try { if (fs.lstatSync(current).isSymbolicLink()) throw new Error('unsafe_symlink'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  if (fs.existsSync(file)) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.nlink !== 1 || (process.getuid && stat.uid !== process.getuid())) throw new Error('unsafe_file');
  }
}
function ensureParent(file) {
  safePath(file);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    if (process.getuid && fs.statSync(path.dirname(file)).uid !== process.getuid()) throw new Error('unsafe_directory_owner');
    fs.chmodSync(path.dirname(file), 0o700);
  }
}
function safeAppend(file, row) {
  ensureParent(file);
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND | (fs.constants.O_NOFOLLOW || 0), 0o600);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1) throw new Error('unsafe_file');
    if (process.platform !== 'win32') fs.fchmodSync(fd, 0o600);
    const bytes = Buffer.from(JSON.stringify(row) + '\n');
    if (fs.writeSync(fd, bytes) !== bytes.length) throw new Error('short_append');
    fs.fsyncSync(fd);
    return bytes.length;
  } finally { fs.closeSync(fd); }
}
// Streaming avoids rereading the entire ledger on every request.
function scan(file, onRow) {
  safePath(file);
  if (!fs.existsSync(file)) return { malformed_tail: false, corrupt: false };
  const fd = fs.openSync(file,'r'), buffer = Buffer.alloc(65536), decoder = new StringDecoder('utf8');
  let pending = '', corrupt = false, tooLong = false;
  const line = text => {
    if (tooLong) { corrupt = true; tooLong = false; return; }
    if (!text.trim()) return;
    try { onRow(JSON.parse(text)); } catch (error) { if (error.code === 'INDEX_LIMIT') throw error; corrupt = true; }
  };
  try {
    let size;
    while ((size = fs.readSync(fd,buffer,0,buffer.length,null)) > 0) {
      pending += decoder.write(buffer.subarray(0,size));
      let end;
      while ((end = pending.indexOf('\n')) !== -1) { line(pending.slice(0,end)); pending = pending.slice(end+1); }
      if (pending.length > 65536) { pending = ''; tooLong = true; }
    }
    pending += decoder.end();
    return { corrupt, malformed_tail: Boolean(pending.length || tooLong) };
  } finally { fs.closeSync(fd); }
}
function readLedger(file, limit = 10000) {
  const events = []; let truncated = false;
  const state = scan(file, row => { if (events.length < limit) events.push(row); else truncated = true; });
  return { events, ...state, truncated };
}
const recentGaps = new Map();
function appendGap(gapPath, reason, now = new Date().toISOString()) {
  const safeReason = atom(reason) ? reason : 'capture_unavailable';
  const bucket = Math.floor(Date.parse(now) / 300000), key = digest([path.resolve(gapPath),safeReason,bucket]);
  if (recentGaps.has(key)) return false;
  ensureParent(gapPath);
  if (fs.existsSync(gapPath) && fs.statSync(gapPath).size >= 1024 * 1024) return false;
  const row = { schema_version: 1, event_id: key, occurred_at: now, event_type: 'coverage',
    source: { kind: 'atlas_gap', instance: 'local', confidence: 'unknown', completeness_reason: safeReason } };
  safeAppend(gapPath,row);
  if (recentGaps.size >= 1024) recentGaps.clear(); recentGaps.set(key,true); return true;
}
function fileDigest(file) {
  const hash = crypto.createHash('sha256');
  if (!fs.existsSync(file)) return hash.digest('hex');
  const fd = fs.openSync(file,'r'), buffer = Buffer.alloc(65536);
  try { let n; while ((n = fs.readSync(fd,buffer,0,buffer.length,null)) > 0) hash.update(buffer.subarray(0,n)); }
  finally { fs.closeSync(fd); }
  return hash.digest('hex');
}
function processStart(pid) {
  try { const stat = fs.readFileSync('/proc/' + pid + '/stat','utf8'); return stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19]; }
  catch (_) { return null; }
}
function recoverLock(file, gap) {
  safePath(file);
  if (!fs.existsSync(file)) return null;
  try {
    if (fs.statSync(file).size > 1024) return 'writer_lock_unverifiable';
    const bytes = fs.readFileSync(file,'utf8'), row = JSON.parse(bytes);
    if (row.schema_version !== 1 || !Number.isSafeInteger(row.pid) || row.pid < 1 || !/^[a-f0-9]{32}$/.test(row.nonce)) return 'writer_lock_unverifiable';
    let dead = false;
    try { process.kill(row.pid,0); }
    catch (error) { if (error.code === 'ESRCH') dead = true; else return 'writer_locked'; }
    if (!dead && process.platform === 'linux' && atom(row.start_time)) {
      const actual = processStart(row.pid); if (actual && actual !== row.start_time) dead = true;
    }
    if (!dead) return 'writer_locked';
    // Remove only this verified stale lock, never a successor's replacement.
    if (fs.readFileSync(file,'utf8') !== bytes) return 'writer_locked';
    fs.unlinkSync(file); gap('recovered_stale_writer_lock'); return null;
  } catch (_) { return 'writer_lock_unverifiable'; }
}
function validConflict(row) {
  if (!plain(row)) return false;
  const { payload_sha256, ...body } = row;
  if (digest(body) !== payload_sha256) return false;
  const { event_id, ingested_at, conflicting_event_id, first_payload_sha256, conflicting_payload_sha256, ...input } = body;
  if (![event_id,conflicting_event_id,first_payload_sha256,conflicting_payload_sha256].every(v => /^[a-f0-9]{64}$/.test(v || '')) || !timestamp(ingested_at)) return false;
  if (event_id !== digest(['integrity_conflict',conflicting_event_id,conflicting_payload_sha256])) return false;
  return validate({ ...input, event_type: 'coverage' }) === null;
}
function createStore(options = {}) {
  if (!options.ledgerPath && !options.projectDir && !options.metricsDir) throw new Error('ledgerPath_or_projectDir_required');
  const now = options.now || (() => new Date().toISOString()), dynamic = !options.ledgerPath;
  const dir = dynamic ? options.metricsDir ? path.resolve(options.metricsDir) : path.resolve(options.projectDir,'.planning','metrics') : path.dirname(path.resolve(options.ledgerPath));
  const gapPath = path.resolve(options.gapPath || path.join(dir,'sgsd-atlas-gaps.jsonl'));
  const manifestPath = path.join(dir,'sgsd-atlas-manifest.jsonl');
  const lockPath = path.join(dir,'.sgsd-atlas-write.lock');
  const maxBytes = options.maxBytes ?? 1024 * 1024 * 1024, maxIndex = options.maxIndexEntries ?? 100000;
  let ledgerPath = dynamic ? path.join(dir,'sgsd-atlas-events-unknown.jsonl') : path.resolve(options.ledgerPath);
  let partitionId = dynamic ? 'unknown' : path.basename(ledgerPath), resetAt = null;
  let blocked = null, totalBytes = 0, activeSize = 0;
  const index = new Map(), conflicts = new Map(), closed = new Set();
  const gap = reason => { try { return appendGap(gapPath,reason,now()); } catch (_) { return false; } };
  ensureParent(ledgerPath);
  blocked = recoverLock(lockPath,gap);
  if (dynamic && fs.existsSync(manifestPath)) {
    const manifest = scan(manifestPath, row => {
      if (!atom(row.partition_id) || !['open','closed'].includes(row.action)) throw new Error('invalid_manifest');
      if (row.action === 'closed') {
        closed.add(row.partition_id);
        const file = path.join(dir,'sgsd-atlas-events-' + row.partition_id + '.jsonl');
        safePath(file);
        if (fileDigest(file) !== row.sha256) blocked = 'closed_partition_integrity';
      }
      if (row.action === 'open') { partitionId = row.partition_id; resetAt = row.resets_at || null; }
    });
    if (manifest.corrupt || manifest.malformed_tail) blocked = 'corrupt_manifest';
    if (closed.has(partitionId)) { partitionId = 'unknown-' + digest(now()).slice(0,16); resetAt = null; }
    ledgerPath = path.join(dir,'sgsd-atlas-events-' + partitionId + '.jsonl');
  }
  const files = dynamic ? fs.readdirSync(dir).filter(name => /^sgsd-atlas-events-[A-Za-z0-9._-]+\.jsonl$/.test(name)).sort().map(name => path.join(dir,name)) : [ledgerPath];
  for (const file of files) {
    safePath(file); if (!fs.existsSync(file)) continue;
    totalBytes += fs.statSync(file).size;
    try {
      const state = scan(file,row => {
        if (!atom(row.event_id)) throw new Error('invalid_stored_row');
        if (index.size + conflicts.size >= maxIndex) throw Object.assign(new Error('index_limit'),{ code: 'INDEX_LIMIT' });
        if (row.event_type === 'integrity_conflict') {
          if (!validConflict(row)) throw new Error('invalid_conflict');
          conflicts.set(row.event_id,{ target: row.conflicting_event_id, sha: row.first_payload_sha256 });
        }
        else if (/^[a-f0-9]{64}$/.test(row.payload_sha256 || '')) {
          const { event_id, ingested_at, payload_sha256, ...payload } = row;
          if (validate(payload) || digest(payload) !== payload_sha256 || canonicalize(payload).event_id !== event_id) throw new Error('invalid_stored_payload');
          index.set(row.event_id,{ sha: payload_sha256, partition: path.basename(file) });
        }
        else throw new Error('invalid_stored_row');
      });
      if (state.malformed_tail) blocked = 'malformed_tail';
      else if (state.corrupt) blocked = 'corrupt_ledger';
    } catch (error) { if (error.code === 'INDEX_LIMIT') blocked = 'index_limit'; else throw error; }
  }
  for (const conflict of conflicts.values()) if (index.get(conflict.target)?.sha !== conflict.sha) blocked = blocked || 'corrupt_ledger';
  if (totalBytes >= maxBytes) blocked = 'canonical_size_limit';
  activeSize = fs.existsSync(ledgerPath) ? fs.statSync(ledgerPath).size : 0;
  let manifestHash = dynamic ? fileDigest(manifestPath) : null;
  if (blocked) gap(blocked);
  function pressure() {
    try {
      const ratio = options.freeRatio ? options.freeRatio() : (() => { const s = fs.statfsSync(dir); return s.blocks ? s.bavail / s.blocks : 0; })();
      return !Number.isFinite(ratio) || ratio < 0.1;
    } catch (_) { return true; }
  }
  function reject(reason, persistent = false) {
    if (persistent) blocked = reason;
    gap(reason); return Object.freeze({ status: 'rejected', reason });
  }
  function rotate(input) {
    if (!dynamic || input.event_type !== 'quota' || input.quota?.window !== 'seven_day' || input.quota.resets_at == null) return;
    const value = input.quota.resets_at, millis = typeof value === 'number' ? value * (value < 1e12 ? 1000 : 1) : Date.parse(value);
    if (!Number.isFinite(millis) || (resetAt && millis <= Date.parse(resetAt))) return;
    const next = new Date(millis).toISOString(), nextId = 'reset-' + Math.floor(millis / 1000);
    if (closed.has(nextId)) return;
    safeAppend(manifestPath,{ schema_version: 1, action: 'closed', partition_id: partitionId,
      closed_at: now(), resets_at: resetAt, sha256: fileDigest(ledgerPath), bytes: activeSize, coverage: 'partial' });
    closed.add(partitionId);
    safeAppend(manifestPath,{ schema_version: 1, action: 'open', partition_id: nextId, opened_at: now(), resets_at: next, coverage: 'partial', reason: 'calibration' });
    manifestHash = fileDigest(manifestPath);
    partitionId = nextId; resetAt = next; ledgerPath = path.join(dir,'sgsd-atlas-events-' + partitionId + '.jsonl');
    safePath(ledgerPath);
    if (fs.existsSync(ledgerPath)) throw new Error('partition_already_exists');
    activeSize = 0;
  }
  function ingest(input) {
    const reason = validate(input); if (reason) return { status: 'rejected', reason };
    const candidate = canonicalize(input,now()), previous = index.get(candidate.event_id);
    if (previous?.sha === candidate.payload_sha256) return { status: 'duplicate', event_id: candidate.event_id };
    const conflictId = digest(['integrity_conflict',candidate.event_id,candidate.payload_sha256]);
    if (previous && conflicts.has(conflictId)) return { status: 'duplicate', event_id: conflictId };
    if (blocked) return reject(blocked);
    if (pressure()) return reject('disk_pressure');
    if (index.size + conflicts.size >= maxIndex) return reject('index_limit',true);
    let lockFd;
    try {
      safePath(lockPath); lockFd = fs.openSync(lockPath,'wx',0o600);
      fs.writeSync(lockFd,JSON.stringify({ schema_version: 1, pid: process.pid,
        start_time: processStart(process.pid), nonce: crypto.randomBytes(16).toString('hex') }));
      if (dynamic && fileDigest(manifestPath) !== manifestHash) return reject('concurrent_partition_writer',true);
      const actualSize = fs.existsSync(ledgerPath) ? fs.statSync(ledgerPath).size : 0;
      if (actualSize !== activeSize) return reject('concurrent_writer_or_modified_ledger',true);
      const row = previous ? { schema_version: 1, event_id: conflictId, event_type: 'integrity_conflict',
        source_event_id: input.source_event_id, occurred_at: input.occurred_at, ingested_at: now(),
        source: stable(input.source), identity: stable(input.identity || {}), conflicting_event_id: candidate.event_id,
        first_payload_sha256: previous.sha, conflicting_payload_sha256: candidate.payload_sha256 } : candidate;
      if (previous) row.payload_sha256 = digest(row);
      const bytes = Buffer.byteLength(JSON.stringify(row)+'\n');
      if (totalBytes + bytes > maxBytes) return reject('canonical_size_limit',true);
      if (!previous) rotate(input);
      const written = safeAppend(ledgerPath,row); totalBytes += written; activeSize += written;
      if (previous) conflicts.set(conflictId,{ target: candidate.event_id, sha: previous.sha });
      else index.set(candidate.event_id,{ sha: candidate.payload_sha256, partition: partitionId });
      return { status: previous ? 'conflict' : 'accepted', event_id: candidate.event_id };
    } catch (error) { return reject(error.code === 'EEXIST' ? 'writer_locked' : 'storage_unavailable',error.code !== 'EEXIST'); }
    finally { if (lockFd !== undefined) { fs.closeSync(lockFd); fs.unlinkSync(lockPath); } }
  }
  return Object.freeze({ ingest, gap, read: () => readLedger(ledgerPath),
    status: () => ({ healthy: !blocked && !pressure(), reason: blocked || (pressure() ? 'disk_pressure' : null),
      coverage: 'partial', partition_id: partitionId, bytes: totalBytes, indexed_events: index.size, resets_at: resetAt }),
    get ledgerPath() { return ledgerPath; } });
}
module.exports = Object.freeze({ canonicalize, createStore, digest, readLedger, validate, appendGap, safeAppend, safePath, scan, validConflict, fileDigest });
