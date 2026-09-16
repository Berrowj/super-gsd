'use strict';

// Source-only changed-return adapter. Root must provide the lifecycle and the
// transports; this module never launches a worker, enters a pane, or calls a
// model. The durable state is the authority for replay suppression.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const HEX = /^[a-f0-9]{64}$/;
const ATOM = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const KINDS = new Set(['question', 'return', 'ready']);
const PMS = new Set(['pm-delivery', 'pm-automation']);
const TARGET_KINDS = new Set(['managed_worker', 'native_pane']);
const DISPOSITIONS = new Set(['executing', 'deferred', 'awaiting_named_dependency', 'genuinely_blocked', 'completed', 'acknowledged', 'applied']);
const NEXT_ACTIONS = new Set(['wake_owner', 'await_dependency', 'none']);
const MAX_LINE = 512 * 1024;
const MAX_STATE = 2 * 1024 * 1024;

const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const iso = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value) && Number.isFinite(Date.parse(value));
const digest = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const stable = value => Array.isArray(value) ? value.map(stable)
  : plain(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const fingerprint = value => digest(stable(value));
const absolute = value => typeof value === 'string' && path.isAbsolute(value) && value.length <= 4096;
const safeText = value => typeof value === 'string' && value.length > 0 && value.length <= 512
  && !/[\r\n\u0000-\u001f\u007f]/.test(value);

function validateSource(source) {
  if (!plain(source) || !absolute(source.path) || !HEX.test(source.sha256 || '') || !ATOM.test(source.lane || '')) return 'invalid_source';
  return null;
}

function validateEvent(event, source) {
  if (!plain(event)) return 'invalid_event';
  const required = ['event_id', 'kind', 'lane', 'plan', 'task', 'owner', 'owner_epoch', 'source_path', 'source_sha256', 'observed_at', 'disposition', 'next_action'];
  if (Object.keys(event).some(key => !required.includes(key) && key !== 'pointer')) return 'unknown_event_field';
  if (required.some(key => !Object.hasOwn(event, key))) return 'missing_event_field';
  if (!ATOM.test(event.event_id || '') || !KINDS.has(event.kind) || !ATOM.test(event.lane || '')
      || !ATOM.test(event.plan || '') || !ATOM.test(event.task || '') || !ATOM.test(event.owner || '')
      || !ATOM.test(event.owner_epoch || '') || !absolute(event.source_path) || !HEX.test(event.source_sha256 || '')
      || !iso(event.observed_at) || !DISPOSITIONS.has(event.disposition) || !NEXT_ACTIONS.has(event.next_action)) return 'invalid_event_field';
  if (validateSource(source)) return 'invalid_source';
  if (path.resolve(event.source_path) !== path.resolve(source.path) || event.source_sha256 !== source.sha256 || event.lane !== source.lane) return 'event_source_mismatch';
  if (event.kind === 'ready' ? event.owner !== 'deploy' : !PMS.has(event.owner)) return 'event_owner_mismatch';
  if (event.next_action === 'wake_owner' && !safeText(event.pointer || '')) return 'missing_safe_pointer';
  if (event.next_action !== 'wake_owner' && event.pointer !== undefined) return 'unexpected_pointer';
  if (Buffer.byteLength(JSON.stringify(event)) > MAX_LINE) return 'event_too_large';
  return null;
}

function validateBinding(binding) {
  if (!plain(binding) || !ATOM.test(binding.owner || '') || !ATOM.test(binding.epoch || '') || !TARGET_KINDS.has(binding.kind)) return 'invalid_target_binding';
  if (binding.kind === 'managed_worker') {
    const mailbox = binding.mailbox;
    if (!plain(mailbox) || !absolute(mailbox.project) || !UUID.test(mailbox.worker_id || '')
        || !ATOM.test(mailbox.instance || '') || !ATOM.test(mailbox.thread_id || '') || !ATOM.test(mailbox.turn_id || '')) return 'invalid_mailbox_binding';
  } else {
    const identity = binding.identity;
    if (!plain(identity) || !Number.isSafeInteger(identity.pid) || identity.pid < 1 || !ATOM.test(String(identity.start || ''))
        || !absolute(identity.cwd) || !ATOM.test(identity.runtime || '') || !ATOM.test(identity.session || '') || !ATOM.test(identity.pane || '')) return 'invalid_native_binding';
  }
  return null;
}

function bindingFor(event, bindings) {
  const matches = (Array.isArray(bindings) ? bindings : []).filter(row => row?.owner === event.owner);
  if (!matches.length) return { error: 'target_binding_missing' };
  const epochMatches = matches.filter(row => row.epoch === event.owner_epoch);
  if (epochMatches.length > 1) return { error: 'target_owner_epoch_ambiguous' };
  if (!epochMatches.length) return { error: 'owner_epoch_mismatch' };
  const binding = epochMatches[0];
  const error = validateBinding(binding);
  if (error) return { error };
  if (binding.epoch !== event.owner_epoch) return { error: 'owner_epoch_mismatch' };
  return { binding };
}

function stateDefault() {
  return { schema_version: 1, sources: {}, events: {}, event_fingerprints: {}, receipts: {}, findings: [] };
}

function ensureStateDir(file) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') { try { fs.chmodSync(dir, 0o700); } catch {} }
}

function readState(file) {
  try {
    const info = fs.lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > MAX_STATE) throw new Error('watcher_state_unreadable');
    const value = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!plain(value) || value.schema_version !== 1 || !plain(value.sources) || !plain(value.events)
        || !plain(value.event_fingerprints) || !plain(value.receipts)) throw new Error('watcher_state_unreadable');
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return stateDefault();
    throw error;
  }
}

function writeState(file, value) {
  const body = JSON.stringify(value) + '\n';
  if (Buffer.byteLength(body) > MAX_STATE) throw new Error('watcher_state_limit');
  ensureStateDir(file);
  const temp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temp, body, { flag: 'wx', mode: 0o600 });
  try { fs.renameSync(temp, file); } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function sourceStat(file, prior = null) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('event_source_unreadable');
  const data = fs.readFileSync(file);
  const prefix_length = Number.isSafeInteger(prior?.prefix_length) ? prior.prefix_length : Math.min(data.length, 4096);
  return { dev: info.dev, ino: info.ino, size: info.size, mtime_ms: info.mtimeMs,
    prefix_length, prefix_sha256: digest(data.subarray(0, prefix_length)), data };
}

function sourceMeta(snapshot, offset, deferredOffset) {
  const value = { dev: snapshot.dev, ino: snapshot.ino, size: snapshot.size, mtime_ms: snapshot.mtime_ms,
    prefix_length: snapshot.prefix_length, prefix_sha256: snapshot.prefix_sha256, offset };
  if (deferredOffset !== undefined) value.deferred_offset = deferredOffset;
  return value;
}

function sourceError(state, source, reason) {
  const finding = { source_path: source.path, lane: source.lane, reason, at: new Date().toISOString() };
  state.findings = [...(Array.isArray(state.findings) ? state.findings : []).slice(-127), finding];
  return { changed: false, status: 'genuinely_blocked', actions: [], findings: [finding] };
}

function identitySame(expected, actual) {
  if (!plain(actual)) return false;
  return actual.pid === expected.pid && String(actual.start) === String(expected.start) && actual.cwd === expected.cwd
    && actual.runtime === expected.runtime && actual.session === expected.session && actual.pane === expected.pane;
}

function resultFor(record, state) {
  return { event_id: record.event_id, owner: record.owner, owner_epoch: record.owner_epoch,
    state: record.state, disposition: record.disposition, reason: record.reason || null,
    command_id: record.command_id || null, wake_count: record.wake_count || 0,
    status: ['acknowledged', 'applied'].includes(record.state) ? record.state : record.state,
    source_path: record.source_path, plan: record.plan, task: record.task, persisted: Boolean(state) };
}

function persistAppliedReceipt(state, record) {
  state.receipts[`${record.event_id}|${record.owner}|${record.owner_epoch}`] = {
    schema_version: 1, event_id: record.event_id, owner: record.owner, owner_epoch: record.owner_epoch,
    applied_at: record.applied_at || new Date().toISOString(), wake_count: record.wake_count || 0,
    route: record.kind, reason: record.reason || null,
  };
}

function createDurableChangedReturnWatcher({ root, sources, bindings, mailbox = null, native = null, statePath = null, now = () => new Date().toISOString() } = {}) {
  if (!absolute(root)) throw new Error('watcher_root_required');
  root = path.resolve(root);
  if (!Array.isArray(sources) || !sources.length || sources.some(validateSource)) throw new Error('watcher_sources_required');
  if (!Array.isArray(bindings)) throw new Error('watcher_bindings_required');
  for (const binding of bindings) { const error = validateBinding(binding); if (error) throw new Error(error); }
  statePath = path.resolve(statePath || path.join(root, '.planning', 'atlas', 'durable-changed-return-watcher.json'));
  let closed = false;

  function save(state) { writeState(statePath, state); }

  function recordFinding(state, source, eventId, reason, sourceOffset) {
    const key = `finding:${source.path}:${sourceOffset}`;
    if (!state.events[key]) state.events[key] = { event_id: eventId || key, owner: null, owner_epoch: null, state: 'genuinely_blocked', disposition: 'genuinely_blocked', reason,
      source_path: source.path, plan: null, task: null, wake_count: 0, source_offset: sourceOffset };
    const finding = { event_id: eventId || null, source_path: source.path, reason, at: now() };
    state.findings = [...(Array.isArray(state.findings) ? state.findings : []).slice(-127), finding];
    return finding;
  }

  function reconcile(state, actions) {
    for (const record of Object.values(state.events)) {
      if (record.state !== 'acknowledged' || record.kind !== 'managed_worker' || !mailbox || typeof mailbox.receipt !== 'function') continue;
      let receipt;
      try { receipt = mailbox.receipt(record.binding.mailbox.project, record.binding.mailbox.worker_id, record.command_id); }
      catch { record.state = 'acknowledged'; record.reason = 'receipt_unavailable_no_retry'; continue; }
      if (receipt?.status === 'applied') { record.state = 'applied'; record.reason = 'mailbox_applied'; record.applied_at = now(); persistAppliedReceipt(state, record); actions.push(resultFor(record, state)); }
      else if (receipt?.status === 'rejected') { record.state = 'genuinely_blocked'; record.reason = receipt.reason || 'mailbox_rejected'; actions.push(resultFor(record, state)); }
    }
  }

  function preparedRecovery(state, actions) {
    for (const record of Object.values(state.events)) {
      if (!['prepared', 'literal_sent'].includes(record.state)) continue;
      if (record.kind === 'managed_worker' && mailbox && typeof mailbox.reconcile === 'function') {
        let found = null;
        try { found = mailbox.reconcile(record); } catch { found = null; }
        if (found?.status === 'applied') { record.state = 'applied'; record.reason = 'reconciled_after_restart'; record.applied_at = now(); persistAppliedReceipt(state, record); actions.push(resultFor(record, state)); continue; }
      }
      record.state = 'uncertain'; record.reason = 'uncertain_after_restart_no_replay'; actions.push(resultFor(record, state));
    }
  }

  function deliver(event, source, sourceOffset, state) {
    const key = `${event.event_id}|${event.owner}|${event.owner_epoch}`;
    const priorFingerprint = state.event_fingerprints[event.event_id];
    const currentFingerprint = fingerprint(event);
    if (priorFingerprint && priorFingerprint !== currentFingerprint) {
      const finding = recordFinding(state, source, event.event_id, 'event_identity_integrity_conflict', sourceOffset);
      return { terminal: true, finding, result: { event_id: event.event_id, state: 'genuinely_blocked', reason: 'event_identity_integrity_conflict' } };
    }
    state.event_fingerprints[event.event_id] = currentFingerprint;
    const prior = state.events[key];
    if (prior) return { terminal: true, result: resultFor(prior, state), duplicate: true };
    const route = bindingFor(event, bindings);
    if (route.error) {
      const record = { event_id: event.event_id, owner: event.owner, owner_epoch: event.owner_epoch, state: 'genuinely_blocked', disposition: 'genuinely_blocked', reason: route.error,
        source_path: event.source_path, plan: event.plan, task: event.task, wake_count: 0, source_offset: sourceOffset };
      state.events[key] = record;
      return { terminal: true, result: resultFor(record, state) };
    }
    const { binding } = route;
    if (event.next_action !== 'wake_owner') {
      const nextState = event.next_action === 'await_dependency' ? 'awaiting_named_dependency' : event.disposition;
      const record = { event_id: event.event_id, owner: event.owner, owner_epoch: event.owner_epoch, state: nextState, disposition: event.disposition,
        reason: event.next_action === 'await_dependency' ? 'awaiting_named_dependency' : 'no_wake_action', source_path: event.source_path, plan: event.plan, task: event.task, wake_count: 0, source_offset: sourceOffset };
      state.events[key] = record;
      return { terminal: true, result: resultFor(record, state) };
    }
    const record = { event_id: event.event_id, owner: event.owner, owner_epoch: event.owner_epoch, state: 'prepared', disposition: event.disposition,
      reason: null, source_path: event.source_path, plan: event.plan, task: event.task, wake_count: 0, source_offset: sourceOffset, kind: binding.kind,
      binding: binding.kind === 'native_pane' ? { kind: binding.kind, identity: binding.identity } : { kind: binding.kind, mailbox: binding.mailbox } };
    state.events[key] = record; save(state);
    if (binding.kind === 'managed_worker') {
      if (!mailbox || typeof mailbox.submit !== 'function') { record.state = 'genuinely_blocked'; record.reason = 'managed_mailbox_unconfigured'; return { terminal: true, result: resultFor(record, state) }; }
      if (typeof mailbox.read === 'function') {
        let current;
        try { current = mailbox.read(binding.mailbox.project, binding.mailbox.worker_id); } catch { current = null; }
        if (!current || current.project !== binding.mailbox.project || current.worker_id !== binding.mailbox.worker_id
            || current.instance !== binding.mailbox.instance || current.thread_id !== binding.mailbox.thread_id || current.turn_id !== binding.mailbox.turn_id
            || current.owner !== event.owner) { record.state = 'genuinely_blocked'; record.reason = 'managed_identity_mismatch'; return { terminal: true, result: resultFor(record, state) }; }
      }
      try {
        const queued = mailbox.submit(binding.mailbox.project, binding.mailbox.worker_id, 'steer', { text: event.pointer, owner: event.owner });
        if (!queued?.queued || !ATOM.test(queued.command_id || '')) { record.state = 'genuinely_blocked'; record.reason = queued?.reason || 'managed_submit_rejected'; return { terminal: true, result: resultFor(record, state) }; }
        record.command_id = queued.command_id; record.state = 'acknowledged'; record.wake_count = 1; record.reason = 'mailbox_queued';
        return { terminal: true, result: resultFor(record, state) };
      } catch (error) { record.state = 'genuinely_blocked'; record.reason = error.code || 'managed_submit_failed'; return { terminal: true, result: resultFor(record, state) }; }
    }
    const guard = typeof native === 'function' ? native(binding, event) : native;
    if (!guard || typeof guard.observe !== 'function' || typeof guard.sendLiteral !== 'function' || typeof guard.sendEnter !== 'function') {
      record.state = 'genuinely_blocked'; record.reason = 'native_guard_unconfigured'; return { terminal: true, result: resultFor(record, state) };
    }
    let observed;
    try { observed = guard.observe(binding.identity); } catch { observed = { ready: false, reason: 'native_observe_failed' }; }
    if (!identitySame(binding.identity, observed?.identity)) { record.state = 'genuinely_blocked'; record.reason = 'native_identity_mismatch'; return { terminal: true, result: resultFor(record, state) }; }
    if (observed.ready !== true) { delete state.events[key]; return { terminal: false, deferred: true, result: { event_id: event.event_id, state: 'deferred', reason: observed.reason || 'native_not_ready' } }; }
    let literal;
    try { literal = guard.sendLiteral(event.pointer); }
    catch (error) { record.state = 'uncertain'; record.reason = 'uncertain_after_literal'; return { terminal: true, result: resultFor(record, state) }; }
    if (literal?.status !== 'sent') { record.state = literal?.status === 'uncertain' ? 'uncertain' : 'genuinely_blocked'; record.reason = literal?.reason || 'native_literal_not_sent'; return { terminal: true, result: resultFor(record, state) }; }
    record.state = 'literal_sent'; record.wake_count = 1; record.reason = 'literal_sent'; save(state);
    let checked;
    try { checked = guard.observe(binding.identity, { pointer: event.pointer }); } catch { checked = { ready: false, reason: 'native_post_literal_observe_failed' }; }
    if (!identitySame(binding.identity, checked?.identity) || checked.ready !== true || (checked.pointer !== undefined && checked.pointer !== event.pointer)) {
      record.state = 'uncertain'; record.reason = 'uncertain_before_enter'; return { terminal: true, result: resultFor(record, state) };
    }
    let enter;
    try { enter = guard.sendEnter(event.pointer); }
    catch { record.state = 'uncertain'; record.reason = 'uncertain_after_enter'; return { terminal: true, result: resultFor(record, state) }; }
    if (enter?.status !== 'sent') { record.state = 'uncertain'; record.reason = enter?.reason || 'uncertain_after_enter'; return { terminal: true, result: resultFor(record, state) }; }
    record.state = 'applied'; record.reason = 'native_enter_sent'; record.applied_at = now(); persistAppliedReceipt(state, record);
    return { terminal: true, result: resultFor(record, state) };
  }

  function poll() {
    if (closed) return { changed: false, status: 'closed', actions: [], findings: [] };
    const state = readState(statePath), actions = [], findings = [];
    preparedRecovery(state, actions); reconcile(state, actions); save(state);
    for (const source of sources) {
      const error = validateSource(source); if (error) { findings.push({ source_path: source.path, reason: error }); continue; }
      let snap;
      const cursor = state.sources[source.path] || { offset: 0 };
      try { snap = sourceStat(source.path, cursor); } catch { const result = sourceError(state, source, 'event_source_unreadable'); findings.push(...result.findings); save(state); continue; }
      if (cursor.dev !== undefined && (cursor.dev !== snap.dev || cursor.ino !== snap.ino || snap.size < cursor.offset
          || (cursor.prefix_sha256 && cursor.prefix_sha256 !== snap.prefix_sha256))) {
        const result = sourceError(state, source, 'event_source_rewritten'); findings.push(...result.findings); save(state); continue;
      }
      const forced = Boolean(cursor.deferred_offset !== undefined);
      if (!forced && cursor.dev === snap.dev && cursor.ino === snap.ino && cursor.size === snap.size && cursor.mtime_ms === snap.mtime_ms) continue;
      let offset = cursor.offset || 0, blocked = false;
      while (offset < snap.data.length) {
        const newline = snap.data.indexOf(0x0a, offset);
        if (newline < 0) break;
        const lineBytes = snap.data.subarray(offset, newline), end = newline + 1;
        if (lineBytes.length > MAX_LINE) { findings.push(recordFinding(state, source, null, 'event_line_too_large', offset)); offset = end; continue; }
        const text = lineBytes.toString('utf8').trim();
        if (!text) { offset = end; continue; }
        let event;
        try { event = JSON.parse(text); } catch { findings.push(recordFinding(state, source, null, 'malformed_event', offset)); offset = end; continue; }
        const invalid = validateEvent(event, source);
        if (invalid) { findings.push(recordFinding(state, source, event.event_id || null, invalid, offset)); offset = end; continue; }
        const outcome = deliver(event, source, offset, state); actions.push(outcome.result); if (outcome.finding) findings.push(outcome.finding);
        if (outcome.deferred) { blocked = true; state.sources[source.path] = sourceMeta(snap, offset, offset); save(state); break; }
        offset = end; state.sources[source.path] = sourceMeta(snap, offset); save(state);
      }
      if (!blocked) { state.sources[source.path] = sourceMeta(snap, offset); save(state); }
    }
    return { changed: actions.length > 0 || findings.length > 0, status: actions.some(row => row.state === 'genuinely_blocked') || findings.length ? 'WARN' : actions.length ? 'processed' : 'unchanged', actions, findings, summary: status(state) };
  }

  function status(state = readState(statePath)) {
    const counts = {};
    for (const row of Object.values(state.events)) counts[row.state] = (counts[row.state] || 0) + 1;
    return { events: Object.keys(state.events).length, counts, findings: Array.isArray(state.findings) ? state.findings.length : 0 };
  }
  function close() { closed = true; return true; }
  return Object.freeze({ poll, status, close, statePath });
}

module.exports = Object.freeze({ createDurableChangedReturnWatcher, validateEvent, validateBinding, validateSource, bindingFor, identitySame });
