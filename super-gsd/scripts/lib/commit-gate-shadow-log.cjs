'use strict';

// ============================================================================
// SGSD commit-gate shadow ledger writer/reader
// ============================================================================
// Source of truth: .planning/metrics/commit-gate-shadow.jsonl
//
// Append-only, never-throw public API. The caller supplies a repo/start path,
// not a destination. This module independently resolves the SGSD root, then
// resolves the fixed ledger subpath inside that root.
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { findSgsdRoot, readState, resolveContainedPath } = require('./sgsd-state.cjs');

const STATUSES = Object.freeze(['ok', 'warn', 'fail', 'skipped', 'timeout', 'blocked']);
const RISKS = Object.freeze(['low', 'medium', 'high']);
const COMMAND_NAME = 'appendCommitGateShadowRow';
const ENVELOPE_VERSION = 1;
const SIGNAL = 'commit_gate_shadow';
const LEDGER_REL = path.join('.planning', 'metrics', 'commit-gate-shadow.jsonl');
const DEFAULT_READ_LIMIT = 500;
const MAX_READ_LIMIT = 5000;
const READ_CHUNK_BYTES = 64 * 1024;

const RUN_ID_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]+)?Z-[a-f0-9]{4}$/;
const SHA256_REGEX = /^[a-f0-9]{64}$/;

function _oneLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 300);
}

function _breadcrumb(reasonCode, detail) {
  try {
    const suffix = detail ? `: ${_oneLine(detail)}` : '';
    process.stderr.write(`[SGSD] commit-gate-shadow-log ${reasonCode}${suffix}\n`);
  } catch {
    // Reporting failure must never become the failure mode.
  }
}

function _addReason(set, reasonCode) {
  const value = typeof reasonCode === 'string' ? reasonCode.trim() : '';
  if (value) set.add(value);
}

function _stringList(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());
}

function _boolean(value) {
  return value === true;
}

function _validStatus(value) {
  return typeof value === 'string' && STATUSES.includes(value) ? value : null;
}

function _validRisk(value) {
  return value === null || value === undefined || RISKS.includes(value) ? (value ?? null) : null;
}

function _duration(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return rounded >= 0 ? rounded : null;
}

function _generateRunId() {
  const ts = new Date().toISOString();
  return `${ts}-${crypto.randomBytes(2).toString('hex')}`;
}

function _repoRoot(input) {
  try {
    if (!input || typeof input !== 'string') return null;
    return findSgsdRoot(path.resolve(input));
  } catch {
    return null;
  }
}

function _resolveLedger(input) {
  const root = _repoRoot(input);
  if (!root) return { root: null, ledger: null, reason_code: 'shadow_ledger_root_not_found' };
  const ledger = resolveContainedPath(root, LEDGER_REL);
  if (!ledger) return { root, ledger: null, reason_code: 'shadow_ledger_containment_refused' };
  return { root, ledger, reason_code: null };
}

function shadowLedgerPath(root) {
  try {
    const resolved = _resolveLedger(root);
    return resolved.ledger || null;
  } catch {
    return null;
  }
}

function _hashInput(value) {
  try {
    if (Buffer.isBuffer(value)) return crypto.createHash('sha256').update(value).digest('hex');
    if (value instanceof ArrayBuffer) return crypto.createHash('sha256').update(Buffer.from(value)).digest('hex');
    if (ArrayBuffer.isView(value)) {
      return crypto.createHash('sha256').update(Buffer.from(value.buffer, value.byteOffset, value.byteLength)).digest('hex');
    }
    if (typeof value === 'string') return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
    if (value !== undefined && value !== null) {
      return crypto.createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
    }
    return null;
  } catch {
    return null;
  }
}

function _diffSha256(source, reasons) {
  if (source && typeof source.diff_sha256 === 'string' && SHA256_REGEX.test(source.diff_sha256.trim().toLowerCase())) {
    return source.diff_sha256.trim().toLowerCase();
  }
  if (source && source.diff_sha256 !== undefined) _addReason(reasons, 'diff_sha256_invalid');

  for (const key of ['diff_content', 'diff', 'staged_diff', 'diff_buffer']) {
    if (source && source[key] !== undefined && source[key] !== null) {
      const hash = _hashInput(source[key]);
      if (hash) return hash;
      _addReason(reasons, 'diff_hash_failed');
      return null;
    }
  }

  _addReason(reasons, 'diff_sha256_missing');
  return null;
}

function _artifactList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    if (typeof item.kind === 'string' && item.kind && typeof item.path === 'string' && item.path) {
      out.push({ kind: item.kind, path: item.path });
    }
  }
  return out;
}

function _evidenceList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    if (typeof item.kind === 'string' && item.kind && typeof item.ref === 'string' && item.ref) {
      out.push({ kind: item.kind, ref: item.ref });
    }
  }
  return out;
}

function _pathEvidenceList(source, stagedPaths, reasons) {
  const raw = source && (source.path_evidence || source.per_path_evidence || source.path_records || source.per_path_records);
  if (!Array.isArray(raw) || raw.length === 0) {
    _addReason(reasons, 'path_evidence_missing');
    return [{
      path: stagedPaths[0] || null,
      source_touching: false,
      evidence_status: 'degraded',
      matched_artifacts: [],
      reason_code: 'path_evidence_missing',
    }];
  }

  const out = [];
  for (const record of raw) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      _addReason(reasons, 'path_evidence_malformed');
      out.push({
        path: null,
        source_touching: false,
        evidence_status: 'degraded',
        matched_artifacts: [],
        reason_code: 'path_evidence_malformed',
      });
      continue;
    }
    const reasonCode = typeof record.reason_code === 'string' && record.reason_code.trim()
      ? record.reason_code.trim()
      : null;
    if (!reasonCode) _addReason(reasons, 'path_evidence_reason_missing');
    out.push({
      path: typeof record.path === 'string' && record.path.trim() ? record.path.trim().replace(/\\/g, '/') : null,
      source_touching: record.source_touching === true,
      evidence_status: typeof record.evidence_status === 'string' && record.evidence_status.trim()
        ? record.evidence_status.trim()
        : 'degraded',
      matched_artifacts: _stringList(record.matched_artifacts).map((item) => item.replace(/\\/g, '/')),
      reason_code: reasonCode || 'path_evidence_reason_missing',
    });
  }
  if (out.length === 0) {
    _addReason(reasons, 'path_evidence_missing');
    return [{
      path: stagedPaths[0] || null,
      source_touching: false,
      evidence_status: 'degraded',
      matched_artifacts: [],
      reason_code: 'path_evidence_missing',
    }];
  }
  return out;
}

function _normalizeRow(root, input) {
  const state = readState(root) || {};
  const reasons = new Set(_stringList(input && input.reason_codes));
  const degradedReasons = new Set();
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  if (source !== input) {
    _addReason(reasons, 'shadow_row_malformed');
    _addReason(degradedReasons, 'shadow_row_malformed');
  }

  if (source.signal !== undefined && source.signal !== SIGNAL) {
    _addReason(reasons, 'shadow_signal_unexpected');
    _addReason(degradedReasons, 'shadow_signal_unexpected');
  }

  let stagedPaths = _stringList(source.staged_paths).map((item) => item.replace(/\\/g, '/'));
  const pathEvidence = _pathEvidenceList(source, stagedPaths, reasons);
  if (stagedPaths.length === 0) {
    stagedPaths = pathEvidence.map((record) => record.path).filter((item) => typeof item === 'string' && item);
  }
  if (stagedPaths.length === 0) {
    _addReason(reasons, 'staged_paths_missing');
    _addReason(degradedReasons, 'staged_paths_missing');
  }

  for (const record of pathEvidence) {
    _addReason(reasons, record.reason_code);
  }
  for (const code of ['path_evidence_missing', 'path_evidence_malformed', 'path_evidence_reason_missing']) {
    if (reasons.has(code)) _addReason(degradedReasons, code);
  }

  const diffSha256 = _diffSha256(source, reasons);
  for (const code of ['diff_sha256_missing', 'diff_sha256_invalid', 'diff_hash_failed']) {
    if (reasons.has(code)) _addReason(degradedReasons, code);
  }

  if (source.repo_id !== undefined && (typeof source.repo_id !== 'string' || !source.repo_id.trim())) {
    _addReason(reasons, 'repo_id_invalid');
    _addReason(degradedReasons, 'repo_id_invalid');
  }
  if (source.commit_candidate !== undefined && (typeof source.commit_candidate !== 'string' || !source.commit_candidate.trim())) {
    _addReason(reasons, 'commit_candidate_invalid');
    _addReason(degradedReasons, 'commit_candidate_invalid');
  }
  if (source.artifact_predicate_version !== undefined
    && (typeof source.artifact_predicate_version !== 'string' || !source.artifact_predicate_version.trim())) {
    _addReason(reasons, 'artifact_predicate_version_invalid');
    _addReason(degradedReasons, 'artifact_predicate_version_invalid');
  }
  if (source.artifact_convention_status !== undefined
    && (typeof source.artifact_convention_status !== 'string' || !source.artifact_convention_status.trim())) {
    _addReason(reasons, 'artifact_convention_status_invalid');
    _addReason(degradedReasons, 'artifact_convention_status_invalid');
  }

  let status = _validStatus(source.status) || 'ok';
  if (source.status !== undefined && !_validStatus(source.status)) {
    _addReason(reasons, 'status_invalid');
    _addReason(degradedReasons, 'status_invalid');
  }
  if (degradedReasons.size > 0 && status === 'ok') status = 'warn';

  const row = {
    envelope_version: ENVELOPE_VERSION,
    ts: typeof source.ts === 'string' && source.ts.trim() ? source.ts.trim() : new Date().toISOString(),
    command: COMMAND_NAME,
    status,
    reason_codes: Array.from(reasons),
    artifacts: _artifactList(source.artifacts),
    evidence: _evidenceList(source.evidence),
    next_action: source.next_action ?? null,
    risk: _validRisk(source.risk),
    duration_ms: _duration(source.duration_ms),
    run_id: typeof source.run_id === 'string' && RUN_ID_REGEX.test(source.run_id) ? source.run_id : _generateRunId(),
    phase: source.phase ?? state.phase ?? null,
    milestone: source.milestone ?? state.milestone ?? null,
    signal: SIGNAL,
    repo_id: typeof source.repo_id === 'string' && source.repo_id.trim() ? source.repo_id.trim() : path.basename(root),
    commit_candidate: typeof source.commit_candidate === 'string' && source.commit_candidate.trim() ? source.commit_candidate.trim() : null,
    diff_sha256: diffSha256,
    artifact_predicate_version: typeof source.artifact_predicate_version === 'string' && source.artifact_predicate_version.trim()
      ? source.artifact_predicate_version.trim()
      : null,
    artifact_convention_status: typeof source.artifact_convention_status === 'string' && source.artifact_convention_status.trim()
      ? source.artifact_convention_status.trim()
      : null,
    staged_paths: stagedPaths,
    path_evidence: pathEvidence,
    would_warn: _boolean(source.would_warn),
    would_block: _boolean(source.would_block),
    false_block_basis: _stringList(source.false_block_basis),
    waived_paths: _stringList(source.waived_paths).map((item) => item.replace(/\\/g, '/')),
  };

  return { row, degraded_reason_codes: Array.from(degradedReasons) };
}

function _withReason(row, reasonCode) {
  const reasonCodes = new Set(Array.isArray(row && row.reason_codes) ? row.reason_codes : []);
  _addReason(reasonCodes, reasonCode);
  return Object.assign({}, row, {
    status: row && row.status && row.status !== 'ok' ? row.status : 'warn',
    reason_codes: Array.from(reasonCodes),
  });
}

function appendShadowRow(root, row) {
  try {
    const resolved = _resolveLedger(root);
    if (!resolved.ledger) {
      _breadcrumb(resolved.reason_code, root);
      return null;
    }

    let normalized = _normalizeRow(resolved.root, row);
    for (const reasonCode of normalized.degraded_reason_codes) {
      _breadcrumb(reasonCode);
    }

    try {
      const dir = path.dirname(resolved.ledger);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(resolved.ledger, JSON.stringify(normalized.row) + '\n', 'utf8');
      return normalized.row;
    } catch (error) {
      const failedRow = _withReason(normalized.row, 'shadow_ledger_append_failed');
      _breadcrumb('shadow_ledger_append_failed', error && (error.code || error.message));
      return failedRow;
    }
  } catch (error) {
    _breadcrumb('shadow_ledger_unexpected_error', error && (error.code || error.message));
    return null;
  }
}

function _readLimit(opts) {
  const raw = opts && Number.isInteger(opts.limit) ? opts.limit : DEFAULT_READ_LIMIT;
  if (raw <= 0) return DEFAULT_READ_LIMIT;
  return Math.min(raw, MAX_READ_LIMIT);
}

function _splitLines(text, atFileStart) {
  const lines = String(text || '').split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (!atFileStart && lines.length > 0) lines.shift();
  return lines;
}

function _parseTailRowsFromText(text, limit, atFileStart) {
  const lines = _splitLines(text, atFileStart);
  const rows = [];
  let skipped = 0;
  for (let index = lines.length - 1; index >= 0 && rows.length < limit; index -= 1) {
    const line = lines[index];
    try {
      if (!line) throw new Error('blank line');
      rows.push(JSON.parse(line));
    } catch {
      skipped += 1;
    }
  }
  rows.reverse();
  return { rows, skipped_line_count: skipped };
}

function _readTailRows(filePath, limit) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile() || stat.size === 0) return { rows: [], skipped_line_count: 0 };

  const fd = fs.openSync(filePath, 'r');
  const chunks = [];
  let position = stat.size;
  try {
    while (position > 0) {
      const readSize = Math.min(READ_CHUNK_BYTES, position);
      const buf = Buffer.alloc(readSize);
      position -= readSize;
      fs.readSync(fd, buf, 0, readSize, position);
      chunks.unshift(buf);
      const parsed = _parseTailRowsFromText(Buffer.concat(chunks).toString('utf8'), limit, position === 0);
      if (parsed.rows.length >= limit || position === 0) return parsed;
    }
    return { rows: [], skipped_line_count: 0 };
  } finally {
    fs.closeSync(fd);
  }
}

function _readResult(rows, skippedLineCount, reasonCodes) {
  const result = {
    rows: Array.isArray(rows) ? rows : [],
    skipped_line_count: Number.isInteger(skippedLineCount) && skippedLineCount > 0 ? skippedLineCount : 0,
  };
  result.skippedLineCount = result.skipped_line_count;
  if (Array.isArray(reasonCodes) && reasonCodes.length > 0) result.reason_codes = reasonCodes.slice();
  return result;
}

function readShadowRows(root, opts) {
  try {
    const resolved = _resolveLedger(root);
    if (!resolved.ledger) {
      _breadcrumb(resolved.reason_code, root);
      return _readResult([], 0, [resolved.reason_code]);
    }
    if (!fs.existsSync(resolved.ledger)) return _readResult([], 0, []);
    const parsed = _readTailRows(resolved.ledger, _readLimit(opts || {}));
    return _readResult(parsed.rows, parsed.skipped_line_count, []);
  } catch (error) {
    _breadcrumb('shadow_ledger_read_failed', error && (error.code || error.message));
    return _readResult([], 0, ['shadow_ledger_read_failed']);
  }
}

module.exports = {
  appendShadowRow,
  readShadowRows,
  shadowLedgerPath,
  STATUSES,
  COMMAND_NAME,
  ENVELOPE_VERSION,
  SIGNAL,
};