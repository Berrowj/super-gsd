#!/usr/bin/env node
'use strict';

// Executable Root-installed adapter. It only reads the declared sources and
// invokes the already-supported mailbox/tmux transports. It never launches a
// model or worker and has no product/release authority.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const mailbox = require('../codex-worker/mailbox.cjs');
const { readNativeProcess } = require('../codex-worker/native-process.cjs');
const { createDurableChangedReturnWatcher } = require('./durable-changed-return-watcher.cjs');
const { createDurableReturnProducer } = require('./durable-return-producer.cjs');

const MAX_CAPTURE = 1024 * 1024;
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const APPROVAL = /Press (?:enter|Enter) to confirm|Do you trust the files|Yes, proceed|Yes, allow/i;

function tmux(args) {
  try { return execFileSync('tmux', args, { encoding: 'utf8', timeout: 5000, maxBuffer: 256 * 1024 }); }
  catch (error) { const failure = new Error('native_tmux_unavailable'); failure.cause = error; throw failure; }
}

function firstLine(file, limit = 65536) {
  const fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(64 * 1024), pieces = [];
  let total = 0;
  try {
    let position = 0, read, foundNewline = false;
    while (total < limit && (read = fs.readSync(fd, buffer, 0, Math.min(buffer.length, limit - total), position)) > 0) {
      const view = buffer.subarray(0, read), end = view.indexOf(0x0a), count = end < 0 ? read : end;
      if (count) pieces.push(Buffer.from(view.subarray(0, count)));
      total += count; position += read;
      if (end >= 0) { foundNewline = true; break; }
    }
    if (!foundNewline && total >= limit) throw new Error('native_rollout_header_too_large');
    return Buffer.concat(pieces, total).toString('utf8');
  } finally { fs.closeSync(fd); }
}

function primaryRollout(pid, cwd) {
  if (process.platform !== 'linux') throw new Error('native_rollout_platform_unsupported');
  const directory = `/proc/${pid}/fd`, candidates = new Map();
  for (const entry of fs.readdirSync(directory)) {
    try {
      const file = fs.realpathSync(path.join(directory, entry));
      if (!path.basename(file).startsWith('rollout-') || path.extname(file) !== '.jsonl') continue;
      const first = firstLine(file).split('\n')[0];
      const payload = JSON.parse(first).payload || {};
      if (payload.source === 'cli' && payload.originator === 'codex-tui' && payload.cwd === cwd && payload.id) candidates.set(file, payload.id);
    } catch {}
  }
  if (candidates.size !== 1) throw new Error('native_primary_rollout_ambiguous');
  return [...candidates.entries()][0];
}

function tailEvents(file) {
  const info = fs.statSync(file), size = Math.min(info.size, MAX_CAPTURE), fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(size);
  try { fs.readSync(fd, buffer, 0, size, info.size - size); } finally { fs.closeSync(fd); }
  if (buffer.length && !buffer.toString('utf8').endsWith('\n')) return null;
  return buffer.toString('utf8').split('\n').filter(Boolean).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
}

function intakeApplied(file, record, identity) {
  if (!file) return { status: 'awaiting_ack' };
  try {
    const info = fs.lstatSync(file); if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) return { status: 'awaiting_ack' };
    const size = Math.min(info.size, MAX_CAPTURE), fd = fs.openSync(file, 'r'), buffer = Buffer.alloc(size);
    try { fs.readSync(fd, buffer, 0, size, info.size - size); } finally { fs.closeSync(fd); }
    for (const line of buffer.toString('utf8').split('\n').filter(Boolean)) {
      try {
        const row = JSON.parse(line);
        if (row.status === 'applied' && row.event_id === record.event_id && row.owner_epoch === record.owner_epoch
            && row.pid === identity.pid && String(row.start) === String(identity.start) && row.thread === identity.thread) return row;
      } catch {}
    }
  } catch {}
  return { status: 'awaiting_ack' };
}

function rolloutState(events) {
  let state = 'unknown'; const pending = new Set();
  for (const event of events || []) {
    const payload = event?.payload || {}, type = payload.type;
    if (event.type === 'event_msg') {
      if (['task_started', 'user_message'].includes(type)) { state = 'busy'; pending.clear(); }
      else if (type === 'task_complete') state = pending.size ? 'waiting' : 'idle';
      else if (['task_aborted', 'approval_requested'].includes(type)) state = 'waiting';
    } else if (event.type === 'response_item') {
      if (type === 'message') state = payload.role === 'user' ? 'busy' : 'busy';
      else if (['function_call', 'custom_tool_call', 'tool_call'].includes(type)) { state = 'busy'; if (/request_user_input/.test(payload.name || '')) pending.add(payload.call_id); }
      else if (['function_call_output', 'custom_tool_call_output'].includes(type)) pending.delete(payload.call_id);
    }
  }
  return state;
}

function composerReady(snapshot, pointer) {
  if (snapshot.command !== 'codex' || snapshot.mode !== '0' || snapshot.dead !== '0' || APPROVAL.test(snapshot.screen)) return false;
  const raw = snapshot.screen.split('\n'), lines = raw.map(line => line.replace(ANSI, '')), row = snapshot.cursor_y;
  if (row < 0 || row >= lines.length) return false;
  const expected = pointer === undefined ? null : `› ${pointer}`;
  if (expected !== null ? lines[row].trimEnd() !== expected || snapshot.cursor_x !== 2 + pointer.length
    : !(['›', '› Ask Codex to do anything'].includes(lines[row].trimEnd())) || snapshot.cursor_x !== 2) return false;
  const footer = lines.slice(row + 1).map(line => line.trim()).filter(Boolean);
  if (footer.length !== 1) return false;
  const cwd = snapshot.cwd, home = process.env.HOME || '', paths = [cwd, home && cwd.startsWith(home + '/') ? `~${cwd.slice(home.length)}` : null].filter(Boolean);
  return paths.some(value => footer[0].includes(value));
}

function createNativePaneTransport(identity) {
  let rollout = null, lastPointer = null;
  function exactProcess() {
    const actual = readNativeProcess(identity.pid, identity.cwd);
    if (!actual || String(actual.start_time) !== String(identity.start) || actual.cwd !== identity.cwd) return false;
    const pane = readNativeProcess(identity.pane_pid, identity.cwd);
    if (!pane || String(pane.start_time) !== String(identity.pane_start) || pane.cwd !== identity.cwd) return false;
    if (process.platform === 'linux' && !processAncestry(identity.pid).includes(identity.pane_pid)) return false;
    return true;
  }
  function snapshot(pointer) {
    if (!exactProcess()) return { identity: null, ready: false, reason: 'native_identity_mismatch' };
    let pair;
    try { pair = primaryRollout(identity.pid, identity.cwd); } catch (error) { return { identity, ready: false, reason: error.message }; }
    if (rollout && (rollout[0] !== pair[0] || rollout[1] !== pair[1])) return { identity: null, ready: false, reason: 'native_primary_rollout_changed' };
    rollout = pair;
    let membership, fields;
    try {
      membership = tmux(['list-panes', '-s', '-t', identity.session, '-F', '#{pane_id}|#{window_id}']).trim().split('\n');
      const member = membership.find(row => row.startsWith(`${identity.pane}|`));
      if (!member || (identity.window && member !== `${identity.pane}|${identity.window}`)) return { identity: null, ready: false, reason: 'native_pane_membership_changed' };
      fields = tmux(['display-message', '-p', '-t', identity.pane, '#{pane_pid}\t#{pane_current_path}\t#{pane_current_command}\t#{pane_in_mode}\t#{pane_dead}\t#{pane_width}\t#{cursor_x}\t#{cursor_y}\t#{pane_id}']).trim().split('\t');
      if (fields.length !== 9 || fields[0] !== String(identity.pane_pid) || fields[1] !== identity.cwd
          || fields[2] !== identity.runtime || fields[8] !== identity.pane) return { identity: null, ready: false, reason: 'native_pane_identity_mismatch' };
      const screen = tmux(['capture-pane', '-p', '-e', '-t', identity.pane]);
      const snap = { identity, command: fields[2], cwd: fields[1], mode: fields[3], dead: fields[4], width: Number(fields[5]),
        cursor_x: Number(fields[6]), cursor_y: Number(fields[7]), screen };
      const state = rolloutState(tailEvents(rollout[0]));
      const reason = state === 'idle' && composerReady(snap, pointer) ? 'ready' : state === 'idle' ? 'composer_or_native_ui_guard' : state;
      return { ...snap, ready: reason === 'ready', reason };
    } catch (error) { return { identity, ready: false, reason: error.message || 'native_observe_failed' }; }
  }
  return Object.freeze({
    observe(expected, after) {
      const result = snapshot(after?.pointer);
      if (!result.identity) return result;
      if (after?.pointer !== undefined) result.pointer = after.pointer;
      return result;
    },
    sendLiteral(pointer) {
      const guard = snapshot();
      if (!guard.ready || pointer.length + 2 >= guard.width) throw new Error('native_pre_literal_guard_changed');
      tmux(['send-keys', '-t', identity.pane, '-l', '--', pointer]); lastPointer = pointer;
      return { status: 'sent' };
    },
    sendEnter(pointer) {
      if (pointer !== lastPointer) throw new Error('native_pointer_mismatch');
      const guard = this.observe(identity, { pointer });
      if (!guard.ready) throw new Error('native_pre_enter_guard_changed');
      tmux(['send-keys', '-t', identity.pane, 'Enter']);
      return { status: 'sent' };
    },
    applied(record) { return intakeApplied(identity.intake_path, record, identity); },
  });
}

function readConfig(file) {
  const info = fs.lstatSync(file); if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) throw new Error('runner_config_unreadable');
  const config = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (config?.schema_version !== 1 || typeof config.root !== 'string' || !Array.isArray(config.sources) || !Array.isArray(config.bindings)) throw new Error('runner_config_invalid');
  return config;
}

function processStart(pid) {
  if (process.platform !== 'linux') return String(pid);
  try { const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8'); return stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19]; }
  catch { throw new Error('watcher_process_identity_unavailable'); }
}

function processParent(pid) {
  if (process.platform !== 'linux') return null;
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/);
    const parent = Number(fields[1]);
    if (!Number.isSafeInteger(parent) || parent < 0) throw new Error('watcher_process_ancestry_unavailable');
    return parent;
  } catch { throw new Error('watcher_process_ancestry_unavailable'); }
}

function processAncestry(pid) {
  if (process.platform !== 'linux') return [pid];
  const chain = [], seen = new Set(); let current = pid;
  while (current > 0 && !seen.has(current) && chain.length < 64) {
    chain.push(current); seen.add(current);
    const parent = processParent(current); if (!parent || parent === current) break; current = parent;
  }
  return chain;
}

function lock(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  let fd;
  try { fd = fs.openSync(file, 'wx', 0o600); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let bytes, owner;
    try { bytes = fs.readFileSync(file); owner = JSON.parse(bytes.toString('utf8')); }
    catch { throw new Error('watcher_lock_unverifiable'); }
    if (!Number.isSafeInteger(owner?.pid) || owner.pid < 1 || typeof owner.start !== 'string' || !owner.start) throw new Error('watcher_lock_unverifiable');
    let live = false;
    try {
      process.kill(owner.pid, 0);
      if (process.platform === 'linux') {
        const stat = fs.readFileSync(`/proc/${owner.pid}/stat`, 'utf8'), actual = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)[19];
        if (actual === owner.start) live = true;
      } else live = true;
    } catch (probeError) { if (!['ESRCH', 'ENOENT'].includes(probeError.code)) throw new Error('watcher_lock_unverifiable'); }
    if (live) throw new Error('watcher_already_running');
    if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) throw new Error('watcher_already_running');
    try { fs.unlinkSync(file); } catch (unlinkError) { if (unlinkError.code !== 'ENOENT') throw new Error('watcher_lock_unverifiable'); }
    try { fd = fs.openSync(file, 'wx', 0o600); } catch { throw new Error('watcher_already_running'); }
  }
  fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, start: processStart(process.pid), started_at: new Date().toISOString() }) + '\n');
  return () => { try { fs.closeSync(fd); } catch {} try { fs.unlinkSync(file); } catch {} };
}

function createRunner(config) {
  const native = new Map();
  const watcher = createDurableChangedReturnWatcher({ root: config.root, sources: config.sources, bindings: config.bindings,
    statePath: config.state_path, mailbox, native: binding => {
      const key = JSON.stringify(binding.identity); if (!native.has(key)) native.set(key, createNativePaneTransport(binding.identity));
      return native.get(key);
    } });
  const producer = createDurableReturnProducer({ mailbox });
  const producers = (Array.isArray(config.producers) ? config.producers : []).map(spec => {
    if (spec?.type === 'mailbox') return () => producer.projectMailbox(spec);
    if (spec?.type === 'ledger') return () => producer.projectLedger(spec);
    if (spec?.type === 'inbox') return () => producer.projectInbox(spec);
    throw new Error('runner_producer_invalid');
  });
  const poll = () => {
    const producerResults = [];
    for (const emit of producers) { try { producerResults.push(emit()); } catch (error) { producerResults.push({ emitted: 0, status: 'producer_blocked', reason: error.message }); } }
    return { ...watcher.poll(), producer_results: producerResults };
  };
  return Object.freeze({ ...watcher, poll, producer_count: producers.length });
}

function main(argv = process.argv.slice(2)) {
  const value = flag => { const index = argv.indexOf(flag); return index < 0 ? null : argv[index + 1]; };
  const configFile = value('--config'); if (!configFile) throw new Error('runner_config_required');
  const config = readConfig(path.resolve(configFile)), once = argv.includes('--once'), check = argv.includes('--check');
  const watcher = createRunner(config), interval = Math.max(1000, Math.min(60000, Number(config.poll_ms) || 8000));
  const release = lock(`${watcher.statePath}.lock`);
  const emit = () => process.stdout.write(JSON.stringify({ at: new Date().toISOString(), ...watcher.poll() }) + '\n');
  try {
    if (check) { process.stdout.write(JSON.stringify({ valid: true, state_path: watcher.statePath, poll_ms: interval, sources: config.sources.length, bindings: config.bindings.length }) + '\n'); release(); return 0; }
    emit(); if (once) { release(); return 0; }
    const tick = () => { try { emit(); } catch (error) { process.stderr.write(`DURABLE_RETURN_WATCHER: ${error.message}\n`); clearInterval(timer); watcher.close(); release(); process.exitCode = 2; } };
    // This handle is the supervisor's liveness contract. Do not unref it:
    // without another unrelated handle a normal CLI must remain alive.
    let timer = setInterval(tick, interval);
    const stop = () => { clearInterval(timer); watcher.close(); release(); process.exitCode = 0; };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    return undefined;
  } catch (error) { release(); throw error; }
}

if (require.main === module) { try { const code = main(); if (Number.isInteger(code)) process.exitCode = code; } catch (error) { process.stderr.write(`DURABLE_RETURN_WATCHER: ${error.message}\n`); process.exitCode = 2; } }

module.exports = Object.freeze({ createNativePaneTransport, createRunner, firstLine, main, primaryRollout, rolloutState, composerReady });
