'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validate, canonicalize, appendGap } = require('../telemetry-atlas/contract.cjs');
const { NATIVE_SOURCE, atom, count } = require('../telemetry-atlas/accounting.cjs');
const { readRun, readJson, writeJson } = require('../telemetry-atlas/global-store.cjs');
const { SCOPE: COORDINATION_SCOPE, resolveNativeAuthority } = require('../telemetry-atlas/supervised-coordination.cjs');
const { queueEvent } = require('../telemetry-atlas/quota-sampler.cjs');
const { readBootId, readNativeProcess } = require('./native-process.cjs');

// Codex rust-v0.153.2: protocol TokenUsageRecord/TokenUsage and history RolloutLine.
// usage is per response; cumulative snapshots and embedded compaction records are not inputs.
function projectUsageRecord(record, context = {}) {
  const absent = reason => ({ event: null, reason });
  if (!record || record.type !== 'token_usage_record') return absent(null);
  const p = record.payload;
  if (!p || !['thread_id', 'turn_id', 'session_id', 'root_turn_id', 'response_id'].every(key => atom(p[key]))) return absent('native_usage_identity_missing');
  if (p.thread_id !== context.threadId || p.turn_id !== context.turnId) return absent(null);
  const u = p.usage;
  if (!u || !['input_tokens', 'cached_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens'].every(key => count(u[key]))
      || (Object.hasOwn(u, 'cache_write_input_tokens') && !count(u.cache_write_input_tokens))) return absent('native_usage_invalid_counts');
  const run = context.run;
  const coordination = run?.scope === COORDINATION_SCOPE;
  if (!run || run.provider !== 'openai' || (coordination ? run.accountingSource !== 'supervised_coordination' : run.accountingSource !== NATIVE_SOURCE)) return absent('native_usage_authority_unavailable');
  const event = {
    schema_version: 1, source_event_id: p.response_id, occurred_at: record.timestamp, event_type: 'api_request',
    source: { kind: NATIVE_SOURCE, instance: 'native', provenance: 'provider_reported', confidence: 'exact', completeness_reason: 'http_request_identity_unavailable' },
    identity: { sgsd_run_id: run.run_id, session_id: p.session_id, thread_id: p.thread_id, turn_id: p.turn_id,
      root_turn_id: p.root_turn_id, response_id: p.response_id, request_id: null },
    scope: coordination
      ? { launcher_repo_id: null, coordination_id: run.coordination_id, association: COORDINATION_SCOPE,
        role: run.role, cost_center: run.role, attribution_method: COORDINATION_SCOPE }
      : { launcher_repo_id: run.project_id, role: run.role, cost_center: run.role, attribution_method: 'launcher_registration' },
    runtime: { provider: run.provider, model: typeof context.model === 'string' && /^gpt-[A-Za-z0-9._-]{1,64}$/.test(context.model) ? context.model : 'unknown',
      model_provenance: 'thread_configuration', response_model: null, model_provider: atom(context.modelProvider) ? context.modelProvider : 'unknown',
      codex_version: typeof context.runtimeVersion === 'string' && /^\d+\.\d+\.\d+$/.test(context.runtimeVersion) ? context.runtimeVersion : null },
    usage: { input_tokens: u.input_tokens, cache_read_tokens: u.cached_input_tokens, cache_creation_tokens: u.cache_write_input_tokens ?? null,
      output_tokens: u.output_tokens, reasoning_tokens: u.reasoning_output_tokens, total_provider_tokens: u.total_tokens },
    execution: { status: 'response_completed', success: true }, payload: { raw_content_recorded: false },
  };
  return validate(event) ? absent('native_usage_invalid_envelope') : { event, reason: null };
}

const bounded = (value, fallback, max) => Number.isSafeInteger(value) && value > 0 && value <= max ? value : fallback;
function pathSnapshot(file, allowMissing = false) {
  if (typeof file !== 'string' || !path.isAbsolute(file)) throw new Error('native_usage_path_unavailable');
  let current = file, leaf;
  const ancestors = new Map();
  for (let depth = 0; ; depth++) {
    if (depth > 128) throw new Error('native_usage_path_unavailable');
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (!allowMissing || error.code !== 'ENOENT') throw error; }
    if (stat) {
      if (stat.isSymbolicLink() || (current !== file && !stat.isDirectory())) throw new Error('native_usage_unsafe_file');
      if (current === file) leaf = stat; else ancestors.set(current, stat);
    }
    const parent = path.dirname(current); if (parent === current) break; current = parent;
  }
  return { stat: leaf, ancestors };
}
const checkedPath = file => pathSnapshot(file).stat;
function validFile(stat) {
  return stat.isFile() && stat.nlink === 1 && stat.uid === process.getuid()
    && Number.isSafeInteger(stat.size) && stat.size >= 0;
}
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;

// Snapshot is synchronous and MUST happen after thread/open and BEFORE turn/start.
// No filesystem discovery, timers, provider transport, native writes or chmod.
function createCapture({ root, projectDir, runId, opened, opening, runtimeVersion, limits = {} } = {}) {
  const bound = { readBytes: bounded(limits.readBytes, 65536, 1048576), lineBytes: bounded(limits.lineBytes, 65536, 1048576),
    responses: bounded(limits.responses, 4096, 16384), pending: bounded(limits.pending, 64, 256),
    retries: bounded(limits.retries, 16, 64), finalPolls: bounded(limits.finalPolls, 2, 4) };
  let run = null, verifiedRoot;
  try {
    const stat = checkedPath(root);
    if (!stat.isDirectory() || (process.getuid && stat.uid !== process.getuid())
        || (process.platform !== 'win32' && (stat.mode & 0o777) !== 0o700)) throw new Error();
    verifiedRoot = stat;
    const registered = readRun(root, runId);
    if (typeof projectDir === 'string' && path.isAbsolute(projectDir) && registered
        && fs.realpathSync(projectDir) === registered.project_dir) run = registered;
  } catch {}
  const reasons = new Set();
  const gap = reason => {
    if (reasons.has(reason)) return;
    reasons.add(reason);
    try { if (run && appendGap(path.join(run.ledger_dir || run.metrics_dir, 'sgsd-atlas-gaps.jsonl'), reason)) return; } catch {}
    // Registration or project-sink failure must remain independently visible.
    // Never create a root from an unverified environment path.
    try { if (verifiedRoot && sameFile(verifiedRoot, checkedPath(root))) appendGap(path.join(root, 'sgsd-atlas-gaps.jsonl'), reason); } catch {}
  };
  let fd, original, offset = 0, size = 0, readBytes = 0, pendingLine = Buffer.alloc(0), discard = false;
  let ancestors = new Map(), awaitingFile = false;
  let fatal = false, finalized = false, turnId = null, observed = 0, delivered = 0;
  const pending = new Map(), seen = new Set();
  const file = opened?.thread?.path, threadId = opened?.thread?.id;
  const context = Object.freeze({ run, threadId, model: opened?.model, modelProvider: opened?.modelProvider, runtimeVersion });
  const fail = reason => { fatal = true; gap(reason); };
  function verifyAncestors(snapshot) {
    for (const [name, pinned] of ancestors) {
      const current = snapshot.ancestors.get(name);
      if (!current || !sameFile(pinned, current)) throw new Error('native_usage_file_changed');
    }
  }
  function openFile(snapshot, atEOF) {
    if (!validFile(snapshot.stat)) throw new Error('native_usage_unsafe_file');
    // NONBLOCK also prevents a racing FIFO substitution from blocking cleanup.
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
    original = fs.fstatSync(fd); const after = pathSnapshot(file); verifyAncestors(after);
    if (!validFile(original) || !validFile(after.stat) || !sameFile(snapshot.stat, original) || !sameFile(after.stat, original)) throw new Error('native_usage_file_changed');
    ancestors = after.ancestors; awaitingFile = false;
    size = original.size; offset = atEOF ? size : 0;
    if (offset) { const last = Buffer.alloc(1); if (fs.readSync(fd, last, 0, 1, offset - 1) !== 1) throw new Error('native_usage_file_changed'); discard = last[0] !== 10; }
  }
  try {
    if (process.platform !== 'linux') throw new Error('native_usage_linux_required');
    if (!run || run.provider !== 'openai' || run.accountingSource !== NATIVE_SOURCE) throw new Error('native_usage_authority_unavailable');
    if (!atom(threadId)) throw new Error('native_usage_identity_missing');
    const before = pathSnapshot(file, opening === 'fresh'); ancestors = before.ancestors;
    if (before.stat) openFile(before, true);
    else awaitingFile = true; // Explicit fresh branch only; native creation may also defer date directories.
  } catch (error) {
    fail(/^native_usage_[a-z_]+$/.test(error.message) ? error.message : 'native_usage_path_unavailable');
    if (fd !== undefined) { fs.closeSync(fd); fd = undefined; }
  }
  function recheck() {
    const snapshot = pathSnapshot(file); verifyAncestors(snapshot);
    const current = snapshot.stat, descriptor = fs.fstatSync(fd);
    if (!validFile(current) || !validFile(descriptor) || !sameFile(original, current) || !sameFile(original, descriptor)
        || current.size < size || descriptor.size < size || current.size < offset || descriptor.size < offset) throw new Error('native_usage_file_changed');
    size = Math.max(current.size, descriptor.size);
  }
  function enqueue(event) {
    try { if (queueEvent(event, run.state_dir)) { delivered++; return true; } } catch {}
    gap('native_usage_spool_unavailable'); return false;
  }
  function line(bytes) {
    if (!bytes.length) return;
    let parsed;
    try { parsed = JSON.parse(bytes.toString('utf8')); } catch { gap('native_usage_invalid_line'); return; }
    const projected = projectUsageRecord(parsed, { ...context, turnId });
    if (projected.reason) gap(projected.reason);
    if (!projected.event) return;
    const event = projected.event, canonical = canonicalize(event), key = canonical.payload_sha256;
    if (seen.has(key)) return;
    if (seen.size >= bound.responses) { fail('native_usage_response_limit'); return; }
    seen.add(key); observed++;
    if (!enqueue(event)) pending.set(key, event);
  }
  function poll() {
    if (finalized || !turnId || fatal) return status();
    try {
      if (fd === undefined) {
        if (!awaitingFile) return status();
        const snapshot = pathSnapshot(file, true); verifyAncestors(snapshot);
        ancestors = snapshot.ancestors;
        if (!snapshot.stat) return status();
        openFile(snapshot, false); // Verified pre-turn absence, never resumed-history discovery.
      }
      recheck();
      let tried = 0;
      for (const [key, event] of pending) { if (tried++ >= bound.retries) break; if (enqueue(event)) pending.delete(key); else break; }
      if (pending.size >= bound.pending) return status();
      const buffer = Buffer.alloc(Math.min(bound.readBytes, Math.max(0, size - offset)));
      if (!buffer.length) return status();
      const n = fs.readSync(fd, buffer, 0, buffer.length, offset); readBytes += n;
      recheck(); // Never project bytes read across a detected replacement/truncation.
      if (!n) { fail('native_usage_file_changed'); return status(); }
      let start = 0;
      while (start < n && !fatal && pending.size < bound.pending) {
        const newline = buffer.indexOf(10, start), end = newline < 0 || newline >= n ? n : newline;
        const part = buffer.subarray(start, end);
        if (!discard) {
          if (pendingLine.length + part.length > bound.lineBytes) { pendingLine = Buffer.alloc(0); discard = true; gap('native_usage_line_limit'); }
          else pendingLine = Buffer.concat([pendingLine, part]);
        }
        offset += end - start;
        if (end < n) {
          offset++; if (!discard) line(pendingLine); pendingLine = Buffer.alloc(0); discard = false; start = end + 1;
        } else start = n;
      }
    } catch { fail('native_usage_file_changed'); }
    return status();
  }
  function status() {
    return { healthy: !fatal && reasons.size === 0, available: fd !== undefined && !fatal, bound: Boolean(turnId),
      awaiting_file: awaitingFile && !fatal && !finalized,
      observed_responses: observed, queued_observations: delivered, pending: pending.size, buffered_bytes: pendingLine.length,
      read_bytes: readBytes, complete_coverage: false, scope: 'acknowledged_worker_thread_turn', reasons: [...reasons] };
  }
  function bindTurn(ack) {
    if (finalized || fatal) return false;
    if (ack?.threadId !== threadId || !atom(ack?.turnId) || (turnId && turnId !== ack.turnId)) { fail('native_usage_turn_mismatch'); return false; }
    turnId = ack.turnId; return true;
  }
  function finalizeSync() {
    if (finalized) return status();
    for (let i = 0; i < bound.finalPolls; i++) poll();
    if (awaitingFile) gap('native_usage_path_unavailable');
    if (!turnId) gap('native_usage_turn_unacknowledged');
    if (pending.size) gap('native_usage_delivery_incomplete');
    if (offset < size || pendingLine.length || discard) gap('native_usage_final_read_incomplete');
    if (!observed) gap('native_request_usage_unobserved');
    finalized = true; return status();
  }
  function close() { finalized = true; awaitingFile = false; if (fd !== undefined) { fs.closeSync(fd); fd = undefined; } pendingLine = Buffer.alloc(0); }
  return Object.freeze({ bindTurn, poll, finalizeSync, close, status });
}
// Capture an already-running native parent from a durable cursor. This is
// intentionally a projector adapter, not a second telemetry system or poller.
// The cursor contains no raw rollout bytes; an incomplete final line is reread
// from its byte offset on the next bounded poll.
function createContinuousCapture({ root, projectDir, runId, rolloutPath, threadId, sessionId, model, modelProvider,
  runtimeVersion, stateFile, limits = {}, processLookup = readNativeProcess, bootIdLookup = readBootId,
  queue = queueEvent, now = () => new Date().toISOString(), initialCursor } = {}) {
  const maxRead = bounded(limits.readBytes, 256 * 1024, 1024 * 1024);
  const maxLine = bounded(limits.lineBytes, 1024 * 1024, 4 * 1024 * 1024);
  const maxIds = bounded(limits.ids, 4096, 16384);
  const reasons = new Set();
  if (typeof rolloutPath === 'string' && path.isAbsolute(rolloutPath)) rolloutPath = path.resolve(rolloutPath);
  let run = null, state = null, fatal = false, finalized = false, terminal = false;
  let observed = 0, accepted = 0, duplicates = 0, readBytes = 0;
  const gap = reason => {
    if (reasons.has(reason)) return;
    reasons.add(reason);
    try { if (run) appendGap(path.join(run.ledger_dir || run.metrics_dir, 'sgsd-atlas-gaps.jsonl'), reason); } catch {}
  };
  const fail = reason => { fatal = true; gap(reason); };
  const validRun = value => value && value.provider === 'openai'
    && (value.scope === COORDINATION_SCOPE ? value.accountingSource === 'supervised_coordination' : value.accountingSource === NATIVE_SOURCE)
    && value.native_binding && value.native_binding.thread_id === threadId
    && value.native_binding.session_id === sessionId
    && (value.scope === COORDINATION_SCOPE ? value.native_binding.coordination_dir === value.coordination_dir : value.native_binding.project_dir === value.project_dir);
  try {
    const registered = resolveNativeAuthority(root, runId);
    if (registered && (registered.scope === COORDINATION_SCOPE
      ? registered.native_binding.coordination_dir === registered.coordination_dir
      : typeof projectDir === 'string' && fs.realpathSync(projectDir) === registered.project_dir) && validRun(registered)) run = registered;
    if (!run) throw new Error('native_usage_authority_unavailable');
    if (!['linux', 'win32'].includes(process.platform)) throw new Error('native_usage_platform_unsupported');
    if (!path.isAbsolute(rolloutPath)) throw new Error('native_usage_path_unavailable');
    stateFile ||= path.join(run.state_dir, 'native-continuous-cursor.json');
    const current = checkedPath(rolloutPath);
    if (!validFile(current)) throw new Error('native_usage_path_unavailable');
    const descriptor = run.scope === COORDINATION_SCOPE ? run.native_binding.rollout_descriptor : null;
    if (descriptor && (descriptor.path !== rolloutPath || descriptor.dev !== current.dev || descriptor.ino !== current.ino)) throw new Error('native_usage_file_rotated');
    const binding = run.native_binding, proc = processLookup(binding.pid,
      run.scope === COORDINATION_SCOPE ? binding.cwd : run.project_dir);
    if (!proc || proc.start_time !== binding.start_time || proc.boot_id !== binding.boot_id
        || proc.cwd !== (run.scope === COORDINATION_SCOPE ? binding.cwd : run.project_dir)
        || proc.executable !== binding.executable || proc.boot_id !== bootIdLookup()) {
      throw new Error('native_usage_process_identity_changed');
    }
    const cursorExists = fs.existsSync(stateFile);
    try { state = readJson(stateFile, 32768); } catch { if (cursorExists) throw new Error('native_usage_cursor_invalid'); }
    if (state && (state.schema_version !== 1 || state.path !== rolloutPath || state.dev !== current.dev || state.ino !== current.ino
      || !Number.isSafeInteger(state.offset) || state.offset < 0 || state.offset > current.size
      || !Array.isArray(state.seen_event_ids) || !Array.isArray(state.seen_response_ids)
      || state.seen_event_ids.length > maxIds || state.seen_response_ids.length > maxIds
      || state.seen_event_ids.some(value => !atom(value)) || state.seen_response_ids.some(value => !atom(value)))) {
      throw new Error('native_usage_cursor_identity_changed');
    }
    if (!state) {
      if (run.scope === COORDINATION_SCOPE && (!initialCursor || initialCursor.path !== rolloutPath
          || initialCursor.dev !== current.dev || initialCursor.ino !== current.ino || initialCursor.offset > current.size)) {
        throw new Error('native_usage_cursor_unavailable');
      }
      state = initialCursor || { schema_version: 1, path: rolloutPath, dev: current.dev, ino: current.ino, offset: current.size,
        last_response_id: null, last_event_id: null, observed_at: now(), seen_event_ids: [], seen_response_ids: [] };
      writeJson(stateFile, state);
    }
  } catch (error) { fail(/^native_usage_[a-z_]+$/.test(error.message) ? error.message : 'native_usage_path_unavailable'); }

  function status() {
    return { healthy: !fatal && reasons.size === 0, available: Boolean(run && state) && !fatal,
      terminal_interval: terminal, complete_coverage: false, offset: state?.offset ?? 0,
      observed_responses: observed, accepted_observations: accepted, duplicate_observations: duplicates,
      read_bytes: readBytes, last_response_id: state?.last_response_id ?? null, last_event_id: state?.last_event_id ?? null,
      observed_at: state?.observed_at ?? null, reasons: [...reasons] };
  }
  const persist = () => { state.observed_at = now(); writeJson(stateFile, state); };
  function remember(list, value) { if (!list.includes(value)) list.push(value); while (list.length > maxIds) list.shift(); }
  function line(text) {
    if (Buffer.byteLength(text) > maxLine) { gap('native_usage_line_limit'); return true; }
    let row; try { row = JSON.parse(text); } catch { gap('native_usage_invalid_line'); return true; }
    if (row?.type !== 'token_usage_record') return true;
    const payload = row.payload;
    if (payload?.thread_id !== threadId || payload?.session_id !== sessionId) { gap('native_usage_identity_mismatch'); return true; }
    const projected = projectUsageRecord(row, { run, threadId, turnId: payload.turn_id, model, modelProvider, runtimeVersion });
    if (projected.reason) { gap(projected.reason); return true; }
    if (!projected.event) return true;
    const event = projected.event, canonical = canonicalize(event);
    if (state.seen_event_ids.includes(canonical.event_id) && state.seen_response_ids.includes(payload.response_id)) { duplicates++; return true; }
    observed++;
    let written = false; try { written = queue(event, run.state_dir); } catch {}
    if (!written) { gap('native_usage_spool_unavailable'); return false; }
    accepted++; remember(state.seen_event_ids, canonical.event_id); remember(state.seen_response_ids, payload.response_id);
    state.last_response_id = payload.response_id; state.last_event_id = canonical.event_id;
    return true;
  }
  function identityStillBound() {
    const binding = run.native_binding, proc = processLookup(binding.pid,
      run.scope === COORDINATION_SCOPE ? binding.cwd : run.project_dir);
    return proc && proc.start_time === binding.start_time && proc.boot_id === binding.boot_id
      && proc.cwd === (run.scope === COORDINATION_SCOPE ? binding.cwd : run.project_dir)
      && proc.executable === binding.executable && proc.boot_id === bootIdLookup();
  }
  function poll() {
    if (finalized || fatal || !state) return status();
    if (!identityStillBound()) { fail('native_usage_process_identity_changed'); return status(); }
    let current; try { current = checkedPath(rolloutPath); } catch { fail('native_usage_file_changed'); return status(); }
    if (!validFile(current)) { fail('native_usage_file_changed'); return status(); }
    if (current.dev !== state.dev || current.ino !== state.ino) { fail('native_usage_file_rotated'); return status(); }
    if (current.size < state.offset) { fail('native_usage_file_truncated'); return status(); }
    if (current.size === state.offset) return status();
    const length = Math.min(maxRead, current.size - state.offset), buffer = Buffer.alloc(length);
    let n;
    try {
      const fd = fs.openSync(rolloutPath, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
      try {
        const opened = fs.fstatSync(fd);
        if (!validFile(opened) || !sameFile(opened, current) || opened.size < state.offset) throw new Error('native_usage_file_changed');
        n = fs.readSync(fd, buffer, 0, length, state.offset);
        const after = fs.fstatSync(fd), pathAfter = checkedPath(rolloutPath);
        if (!validFile(after) || !sameFile(after, opened) || !sameFile(pathAfter, opened) || after.size < state.offset + n) throw new Error('native_usage_file_changed');
      } finally { fs.closeSync(fd); }
    }
    catch { fail('native_usage_file_changed'); return status(); }
    readBytes += n;
    const chunk = buffer.subarray(0, n), lastNewline = chunk.lastIndexOf(10);
    // A bounded read may end inside the next JSONL record. Leave the cursor at
    // the fragment start so the next poll rereads it after the writer appends
    // its newline; this is resumable input, not an unhealthy capture.
    if (lastNewline < 0) return status();
    const complete = chunk.subarray(0, lastNewline + 1).toString('utf8');
    let progressed = 0;
    for (const text of complete.split('\n')) {
      const bytes = Buffer.byteLength(text) + 1;
      if (!text) continue;
      if (!line(text)) break;
      progressed += bytes;
    }
    if (progressed) { state.offset += progressed; persist(); }
    return status();
  }
  function finalizeSync({ terminalStatus } = {}) {
    if (finalized) return status();
    poll(); terminal = Boolean(terminalStatus); finalized = true;
    if (terminal) { try { persist(); } catch { gap('native_usage_cursor_unavailable'); } }
    return status();
  }
  function close() { finalized = true; }
  return Object.freeze({ poll, finalizeSync, close, status });
}

module.exports = Object.freeze({ projectUsageRecord, createCapture, createContinuousCapture });
