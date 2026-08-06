// ============================================================================
// SGSD - GATE-EVIDENCE-LOG canonical writer for session governance evidence
// ============================================================================
// Source of truth: .planning/metrics/gate-evidence.jsonl (machine-readable)
//
// Append-only. Every row is a valid command-envelope-v1 row plus signal-specific
// extension fields such as `signal`, `file_path`, `tool_name`, `iterations`, or
// `p95_ms`. Public APIs wrap internals in try/catch and never throw upward.
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STATUSES = Object.freeze([
  'ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked',
]);

const RISKS = Object.freeze(['low', 'medium', 'high']);
const COMMAND_NAME = 'logGateEvidence';
const ENVELOPE_VERSION = 1;
const LEDGER_REL = path.join('metrics', 'gate-evidence.jsonl');
const DEFAULT_READ_LIMIT = 500;
const MAX_READ_LIMIT = 5000;
const READ_CHUNK_BYTES = 64 * 1024;

const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;

const ENVELOPE_KEYS = new Set([
  'envelope_version', 'ts', 'command', 'status', 'reason_codes',
  'artifacts', 'evidence', 'next_action', 'risk', 'duration_ms', 'run_id',
  'phase', 'milestone',
]);

function _isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function _hasStateFile(planningDir) {
  try {
    return fs.statSync(path.join(planningDir, 'STATE.md')).isFile();
  } catch {
    return false;
  }
}

// Accepted inputs are an SGSD repo root containing .planning/STATE.md, or the
// .planning dir itself containing STATE.md. Anything else is a falsey no-op.
function _planningDir(input) {
  if (!input) return null;
  let cur = path.resolve(String(input));
  if (path.basename(cur) === '.planning' && _isDirectory(cur) && _hasStateFile(cur)) return cur;
  if (!_isDirectory(cur)) cur = path.dirname(cur);

  const direct = path.join(cur, '.planning');
  if (_isDirectory(direct) && _hasStateFile(direct)) return direct;

  while (true) {
    const parent = path.dirname(cur);
    if (parent === cur) return null;
    cur = parent;
    const nested = path.join(cur, '.planning');
    if (_isDirectory(nested) && _hasStateFile(nested)) return nested;
  }
}

function ledgerPath(planningDir) {
  try {
    const dir = _planningDir(planningDir);
    return dir ? path.join(dir, LEDGER_REL) : null;
  } catch {
    return null;
  }
}

function generateRunId() {
  const ts = new Date().toISOString();
  const rand = crypto.randomBytes(2).toString('hex');
  return `${ts}-${rand}`;
}

function _copyExtensionFields(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (!ENVELOPE_KEYS.has(key) && value !== undefined) out[key] = value;
  }
  return out;
}

function _normalize(row) {
  if (!row || typeof row !== 'object') {
    throw new Error('gate-evidence-log: row must be an object');
  }
  if (typeof row.signal !== 'string' || !row.signal) {
    throw new Error('gate-evidence-log: signal must be a non-empty string');
  }
  const status = row.status || 'ok';
  if (!STATUSES.includes(status)) {
    throw new Error(`gate-evidence-log: status must be one of ${STATUSES.join(', ')} (got '${status}')`);
  }
  if (row.reason_codes !== undefined && !Array.isArray(row.reason_codes)) {
    throw new Error('gate-evidence-log: reason_codes must be an array (or omitted)');
  }
  if (row.artifacts !== undefined && !Array.isArray(row.artifacts)) {
    throw new Error('gate-evidence-log: artifacts must be an array (or omitted)');
  }
  if (row.evidence !== undefined && !Array.isArray(row.evidence)) {
    throw new Error('gate-evidence-log: evidence must be an array (or omitted)');
  }
  if (row.risk !== undefined && row.risk !== null && !RISKS.includes(row.risk)) {
    throw new Error(`gate-evidence-log: risk must be one of ${RISKS.join(', ')} or null (got '${row.risk}')`);
  }

  return {
    envelope_version: ENVELOPE_VERSION,
    ts: row.ts || new Date().toISOString(),
    command: COMMAND_NAME,
    status,
    reason_codes: Array.isArray(row.reason_codes) ? row.reason_codes.slice() : [],
    artifacts: Array.isArray(row.artifacts) ? row.artifacts.slice() : [],
    evidence: Array.isArray(row.evidence) ? row.evidence.slice() : [],
    next_action: row.next_action ?? null,
    risk: row.risk ?? null,
    duration_ms: typeof row.duration_ms === 'number' ? row.duration_ms : null,
    run_id: row.run_id || generateRunId(),
    phase: row.phase ?? null,
    milestone: row.milestone ?? null,
    ..._copyExtensionFields(row),
  };
}

function _assertEnvelopeV1(row) {
  const required = ['envelope_version', 'ts', 'command', 'status', 'reason_codes',
    'artifacts', 'evidence', 'next_action', 'risk', 'duration_ms', 'run_id', 'phase', 'milestone'];
  for (const k of required) {
    if (!(k in row)) throw new Error(`gate-evidence-log: emitted row missing required envelope-v1 field '${k}'`);
  }
  if (row.envelope_version !== 1) {
    throw new Error(`gate-evidence-log: envelope_version must be 1 (got ${row.envelope_version})`);
  }
  if (!RUN_ID_REGEX.test(row.run_id)) {
    throw new Error(`gate-evidence-log: run_id violates envelope-v1 pattern (got '${row.run_id}')`);
  }
  if (!STATUSES.includes(row.status)) {
    throw new Error(`gate-evidence-log: status must be one of ${STATUSES.join(', ')} (got '${row.status}')`);
  }
  if (row.duration_ms !== null && (!Number.isInteger(row.duration_ms) || row.duration_ms < 0)) {
    throw new Error(`gate-evidence-log: duration_ms must be non-negative integer or null (got ${row.duration_ms})`);
  }
  for (const e of row.evidence) {
    if (!e || typeof e.kind !== 'string' || !e.kind || typeof e.ref !== 'string' || !e.ref) {
      throw new Error(`gate-evidence-log: evidence item must be {kind:string, ref:string} (got ${JSON.stringify(e)})`);
    }
  }
  for (const a of row.artifacts) {
    if (!a || typeof a.kind !== 'string' || !a.kind || typeof a.path !== 'string' || !a.path) {
      throw new Error(`gate-evidence-log: artifacts item must be {kind:string, path:string} (got ${JSON.stringify(a)})`);
    }
  }
}

function _appendRowInternal(planningDir, row) {
  const p = ledgerPath(planningDir);
  if (!p) return null;
  const enriched = _normalize(row);
  _assertEnvelopeV1(enriched);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(p, JSON.stringify(enriched) + '\n', 'utf8');
  return enriched;
}

function logGateEvidence(planningDir, args) {
  try {
    return _appendRowInternal(planningDir, args || {});
  } catch (e) {
    console.warn('[SGSD] gate-evidence-log logGateEvidence failed:', e.message);
    return false;
  }
}

function _readLimit(opts) {
  const o = opts || {};
  const raw = Number.isInteger(o.limit) ? o.limit : (Number.isInteger(o.tail) ? o.tail : DEFAULT_READ_LIMIT);
  if (raw <= 0) return DEFAULT_READ_LIMIT;
  return Math.min(raw, MAX_READ_LIMIT);
}

function _readTailLines(p, limit) {
  const stat = fs.statSync(p);
  if (stat.size === 0) return [];

  const chunks = [];
  let position = stat.size;
  let newlines = 0;
  const fd = fs.openSync(p, 'r');
  try {
    while (position > 0 && newlines <= limit) {
      const readSize = Math.min(READ_CHUNK_BYTES, position);
      const buf = Buffer.alloc(readSize);
      position -= readSize;
      fs.readSync(fd, buf, 0, readSize, position);
      chunks.unshift(buf);
      for (let i = 0; i < buf.length; i += 1) {
        if (buf[i] === 10) newlines += 1;
      }
    }
  } finally {
    fs.closeSync(fd);
  }

  return Buffer.concat(chunks)
    .toString('utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .slice(-limit);
}

function readGateEvidenceRows(planningDir, opts) {
  try {
    const p = ledgerPath(planningDir);
    if (!p || !fs.existsSync(p)) return [];
    const o = opts || {};
    let rows = _readTailLines(p, _readLimit(o))
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
    if (o.signal) rows = rows.filter((r) => r.signal === o.signal);
    if (o.phase) rows = rows.filter((r) => r.phase === o.phase);
    if (o.milestone) rows = rows.filter((r) => r.milestone === o.milestone);
    if (o.status) rows = rows.filter((r) => r.status === o.status);
    return rows;
  } catch (e) {
    console.warn('[SGSD] gate-evidence-log readGateEvidenceRows failed:', e.message);
    return [];
  }
}

module.exports = {
  logGateEvidence,
  readGateEvidenceRows,
  ledgerPath,
  STATUSES,
  COMMAND_NAME,
  ENVELOPE_VERSION,
};