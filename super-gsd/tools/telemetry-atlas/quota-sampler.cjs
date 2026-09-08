'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { appendGap } = require('./contract.cjs');

const MAX_FILES = 256;
const MAX_BYTES = 4096;
const HEARTBEAT_MS = 60000;
const opaque = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(value) ? value : null;
const number = (value, maximum = Number.MAX_SAFE_INTEGER) => typeof value === 'number'
  && Number.isFinite(value) && value >= 0 && value <= maximum ? value : null;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function recordGap(options, reason) {
  try {
    const projectDir = options.projectDir || process.env.SGSD_PROJECT_DIR;
    if (projectDir && path.isAbsolute(projectDir)) appendGap(path.join(projectDir, '.planning', 'metrics', 'sgsd-atlas-gaps.jsonl'), reason);
  } catch (_) { /* Recorder failure never reaches the status line. */ }
}

function privateDirectory(directory) {
  let ancestor = path.resolve(directory);
  for (;;) {
    try { if (fs.lstatSync(ancestor).isSymbolicLink()) throw new Error('unsafe_spool_ancestor'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_spool_directory');
  if (process.getuid && stat.uid !== process.getuid()) throw new Error('foreign_spool_directory');
  if (process.platform !== 'win32' && (stat.mode & 0o777) !== 0o700) fs.chmodSync(directory, 0o700);
}

function atomicJson(filename, value) {
  const temporary = `${filename}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, JSON.stringify(value) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, filename);
  } finally {
    try { fs.unlinkSync(temporary); } catch (_) { /* Rename consumed the private temporary. */ }
  }
}

function queueEvent(event, stateDir) {
  const bytes = JSON.stringify(event) + '\n';
  if (Buffer.byteLength(bytes) > MAX_BYTES) return false;
  const spool = path.join(stateDir, 'quota-spool');
  privateDirectory(spool);
  if (fs.readdirSync(spool).length >= MAX_FILES) return false;
  const filename = path.join(spool, `${hash(event.source_event_id)}.json`);
  atomicJson(filename, event);
  return true;
}

function record(data, options = {}) {
  try {
    const stateDir = options.stateDir || process.env.SGSD_ATLAS_STATE_DIR;
    const runId = opaque(options.runId || process.env.SGSD_RUN_ID);
    if (!stateDir || !path.isAbsolute(stateDir) || !runId) return { written: 0 };
    privateDirectory(stateDir);
    const now = options.now ?? Date.now();
    const observed = new Date(now).toISOString();
    const sessionId = opaque(data.session_id);
    const version = typeof data.version === 'string' && /^\d+\.\d+\.\d+(?:[A-Za-z0-9.+-]*)$/.test(data.version)
      ? data.version.slice(0, 64) : 'unknown';
    const samples = ['five_hour', 'seven_day'].flatMap(window => {
      const sample = data.rate_limits?.[window];
      if (!sample || number(sample.used_percentage, 100) === null) return [];
      return [{ window, used_percentage: number(sample.used_percentage, 100),
        resets_at: number(sample.resets_at), scope: 'account', attribution: 'account_unallocated' }];
    });
    const fingerprint = hash([runId, sessionId, version, samples]);
    const marker = path.join(stateDir, 'quota-last-samples.json');
    let cache = {};
    try {
      const info = fs.lstatSync(marker);
      if (!info.isSymbolicLink() && info.isFile() && info.size <= 32768) cache = JSON.parse(fs.readFileSync(marker, 'utf8'));
    } catch (_) { /* First sample or a damaged disposable cache. */ }
    const key = hash([runId, sessionId]);
    const previous = cache[key];
    if (previous?.fingerprint === fingerprint && now >= previous.at && now - previous.at < HEARTBEAT_MS) {
      return { written: 0 };
    }
    const current = data.context_window?.current_usage;
    const base = {
      schema_version: 1, occurred_at: observed,
      source: { kind: 'claude_statusline', instance: 'local', version,
        provenance: 'client_observed', confidence: 'exact', completeness_reason: null },
      identity: { sgsd_run_id: runId, session_id: sessionId, prompt_id: opaque(data.prompt_id) },
      scope: { role: 'orchestrator', cost_center: 'orchestrator', attribution_method: 'exact' },
      runtime: { provider: 'anthropic', claude_version: version },
      usage: { input_tokens: number(current?.input_tokens), output_tokens: number(current?.output_tokens),
        cache_creation_tokens: number(current?.cache_creation_input_tokens),
        cache_read_tokens: number(current?.cache_read_input_tokens),
        context_occupancy_percentage: number(data.context_window?.used_percentage, 100) },
      execution: { success: true, error_code: null },
    };
    const events = samples.length ? samples.map(quota => ({ ...base, event_type: 'quota', quota,
      source_event_id: `quota:${now}:${crypto.randomUUID()}` })) : [{ ...base, event_type: 'coverage',
      source_event_id: `quota-unavailable:${now}:${crypto.randomUUID()}`,
      source: { ...base.source, confidence: 'unknown', completeness_reason: 'rate_limits_unavailable' } }];
    let written = 0;
    for (const event of events) if (queueEvent(event, stateDir)) written++;
    if (written !== events.length) recordGap(options, 'quota_spool_capacity');
    if (written === events.length) {
      cache[key] = { fingerprint, at: now };
      const bounded = Object.fromEntries(Object.entries(cache).sort((a,b) => b[1].at - a[1].at).slice(0, 64));
      atomicJson(marker, bounded);
    }
    return { written };
  } catch (_) { recordGap(options, 'quota_sampler_unavailable'); return { written: 0 }; }
}

module.exports = Object.freeze({ record, queueEvent, privateDirectory });
