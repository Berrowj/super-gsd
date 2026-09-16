'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { readJson, readRun, RUN } = require('./global-store.cjs');
const { atom } = require('./accounting.cjs');
const { safePath } = require('./contract.cjs');
const { createContinuousCapture } = require('../codex-worker/usage.cjs');

const DEFAULT_POLL_MS = 1000;
const MAX_RUNS = 256;

function validCursor(file) {
  try {
    safePath(file);
    const info = fs.lstatSync(file);
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || (process.getuid && info.uid !== process.getuid())) return null;
    const value = readJson(file, 32768);
    if (value?.schema_version !== 1 || typeof value.path !== 'string' || !path.isAbsolute(value.path)
        || !Number.isSafeInteger(value.dev) || !Number.isSafeInteger(value.ino) || !Number.isSafeInteger(value.offset)
        || value.offset < 0 || !Array.isArray(value.seen_event_ids) || !Array.isArray(value.seen_response_ids)
        || value.seen_event_ids.some(item => !atom(item)) || value.seen_response_ids.some(item => !atom(item))) return null;
    return value;
  } catch { return null; }
}

function candidates(root) {
  const result = [];
  let entries;
  try { entries = fs.readdirSync(path.join(root, 'runs'), { withFileTypes: true }).slice(0, MAX_RUNS); } catch { return result; }
  for (const entry of entries) {
    if (!entry.isDirectory() || !RUN.test(entry.name)) continue;
    const run = readRun(root, entry.name);
    if (!run || run.provider !== 'openai' || run.role !== 'executor' || run.accountingSource !== 'codex_rollout' || !run.native_binding) continue;
    const cursorFile = path.join(run.state_dir, 'native-continuous-cursor.json'), cursor = validCursor(cursorFile);
    if (!cursor) continue;
    result.push({ run, cursor, cursorFile });
  }
  return result;
}

function createContinuousManager({ root, pollMs = DEFAULT_POLL_MS, timerSet = setInterval, timerClear = clearInterval,
  captureFactory = createContinuousCapture, onError = () => {} } = {}) {
  root = path.resolve(root);
  const captures = new Map();
  const stopped = new Set();
  let timer = null, closed = false;
  const stop = runId => {
    const capture = captures.get(runId);
    if (!capture) return;
    captures.delete(runId); stopped.add(runId);
    try { capture.close(); } catch (error) { onError(error); }
  };
  function refresh() {
    if (closed) return;
    for (const { run, cursor, cursorFile } of candidates(root)) {
      if (captures.has(run.run_id) || stopped.has(run.run_id)) continue;
      try {
        const capture = captureFactory({ root, projectDir: run.project_dir, runId: run.run_id,
          rolloutPath: cursor.path, threadId: run.native_binding.thread_id, sessionId: run.native_binding.session_id,
          stateFile: cursorFile });
        if (!capture?.poll || !capture?.status || !capture?.close || !capture.status().available) {
          try { capture?.close?.(); } catch {}
          stopped.add(run.run_id); continue;
        }
        captures.set(run.run_id, capture);
      } catch (error) { onError(error); stopped.add(run.run_id); }
    }
  }
  function tick() {
    if (closed) return;
    refresh();
    for (const [runId, capture] of captures) {
      try {
        const status = capture.poll();
        if (status?.healthy === false) stop(runId);
      } catch (error) { onError(error); stop(runId); }
    }
  }
  function start() {
    if (closed || timer) return false;
    refresh();
    timer = timerSet(tick, Math.max(100, Math.min(60000, pollMs)));
    if (typeof timer?.unref === 'function') timer.unref();
    return true;
  }
  function close() {
    if (closed) return false;
    closed = true;
    if (timer) { timerClear(timer); timer = null; }
    for (const capture of captures.values()) { try { capture.close(); } catch (error) { onError(error); } }
    captures.clear();
    return true;
  }
  function status() { return { running: !closed && Boolean(timer), captures: captures.size, stopped: stopped.size }; }
  return Object.freeze({ start, tick, refresh, close, status });
}

module.exports = Object.freeze({ createContinuousManager, candidates, validCursor });
