'use strict';

// ============================================================================
// SGSD commit-gate shadow report
// ============================================================================
// T147-04: pure report math for mechanical block-mode promotion. Ledger rows
// are read only through the bounded commit-gate-shadow-log reader.
// ============================================================================

const fs = require('fs');
const path = require('path');

const { findSgsdRoot } = require('./sgsd-state.cjs');
const { readShadowRows, shadowLedgerPath } = require('./commit-gate-shadow-log.cjs');
const { discoverConvention } = require('./sgsd-artifact-conventions.cjs');

const REPORT_VERSION = 't147-04';
const SIGNAL = 'commit_gate_shadow';
const REQUIRED_REPOS = Object.freeze(['GSDedits', 'devcp']);
const MIN_REAL_PAYLOADS = 200;
const MAX_FALSE_BLOCK_RATE = 0.05;
const DEFAULT_REPORT_LIMIT = 5000;
const MODE_FILE_REL = path.join('.planning', 'config', 'commit-gate-mode.json');

const MALFORMED_REASON_CODES = Object.freeze(new Set([
  'shadow_row_malformed',
  'shadow_signal_unexpected',
  'path_evidence_missing',
  'path_evidence_malformed',
  'path_evidence_reason_missing',
  'diff_sha256_missing',
  'diff_sha256_invalid',
  'diff_hash_failed',
  'staged_paths_missing',
  'repo_id_invalid',
  'commit_candidate_invalid',
  'artifact_predicate_version_invalid',
  'artifact_convention_status_invalid',
  'status_invalid'
]));

const INTERNAL_REASON_CODES = Object.freeze(new Set([
  'internal_error',
  'git_name_status_failed',
  'git_diff_failed',
  'git_spawn_failed',
  'name_status_unparsable',
  'artifact_evaluation_failed',
  'shadow_ledger_append_failed',
  'shadow_ledger_read_failed',
  'shadow_ledger_unexpected_error'
]));

function _asArray(value) {
  return Array.isArray(value) ? value : [];
}

function _reasonCodes(row) {
  return _asArray(row && row.reason_codes).filter((item) => typeof item === 'string' && item.trim());
}

function _addReason(target, reasonCode) {
  const value = typeof reasonCode === 'string' ? reasonCode.trim() : '';
  if (value) target.add(value);
}

function _sum(target, source, keys) {
  for (const key of keys) target[key] += source[key] || 0;
}

function _sha256Like(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

function _rowPathEvidence(row) {
  return _asArray(row && row.path_evidence).filter((record) => record && typeof record === 'object' && !Array.isArray(record));
}

function _sourcePathRecords(row) {
  return _rowPathEvidence(row).filter((record) => record.source_touching === true);
}

function _hasMalformedReason(row) {
  return _reasonCodes(row).some((reason) => MALFORMED_REASON_CODES.has(reason));
}

function _hasInternalReason(row) {
  return _reasonCodes(row).some((reason) => INTERNAL_REASON_CODES.has(reason) || /^git_/.test(reason) || /internal_error/.test(reason));
}

function _isSentinelSkip(row) {
  return row && row.status === 'skipped' && _reasonCodes(row).includes('sentinel_waived_block');
}

function _isModeControlRow(row) {
  const reasons = _reasonCodes(row);
  if (reasons.includes('mode_activated') || reasons.includes('mode_deactivated')) return true;
  if (typeof row.commit_candidate === 'string' && row.commit_candidate.startsWith('mode-control:')) return true;
  return _asArray(row.staged_paths).some((item) => String(item).replace(/\\/g, '/') === MODE_FILE_REL.replace(/\\/g, '/'));
}

function _rowMalformed(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return true;
  if (row.signal !== SIGNAL) return true;
  if (!_sha256Like(row.diff_sha256)) return true;
  if (!Array.isArray(row.staged_paths) || row.staged_paths.length === 0) return true;
  if (_rowPathEvidence(row).length === 0) return true;
  return _hasMalformedReason(row);
}

function _rowConventionUnknown(row) {
  if (String(row && row.artifact_convention_status || '').toLowerCase().includes('convention_unknown')) return true;
  return _reasonCodes(row).includes('convention_unknown');
}

function _recordBacked(record) {
  return record && record.source_touching === true
    && (record.evidence_status === 'backed' || _asArray(record.matched_artifacts).length > 0);
}

function _recordMissing(record) {
  if (!record || record.source_touching !== true) return false;
  return record.evidence_status !== 'backed' && record.evidence_status !== 'not_source' && record.evidence_status !== 'invalid_path';
}

function _pathWouldWarn(row, record) {
  if (!record || record.source_touching !== true) return false;
  if (row.status === 'skipped') return false;
  return row.would_warn === true || _recordMissing(record) || _rowConventionUnknown(row);
}

function _pathWouldBlock(row, record) {
  if (!record || record.source_touching !== true) return false;
  if (row.status === 'skipped' || _rowConventionUnknown(row)) return false;
  return row.would_block === true || _recordMissing(record);
}

function _pathFalseBlock(row, record) {
  return _pathWouldBlock(row, record) && _recordBacked(record);
}

function _repoRoot(input) {
  try {
    if (!input || typeof input !== 'string') return null;
    return findSgsdRoot(path.resolve(input));
  } catch {
    return null;
  }
}

function _repoRoots(inputs) {
  const out = [];
  const seen = new Set();
  for (const input of _asArray(inputs)) {
    const root = _repoRoot(input);
    if (!root) continue;
    const key = process.platform === 'win32' ? path.resolve(root).toLowerCase() : path.resolve(root);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(root);
  }
  return out;
}

function _emptyCounts() {
  return {
    row_count: 0,
    real_payload_count: 0,
    source_touching_count: 0,
    would_warn_count: 0,
    would_warn_path_count: 0,
    would_block_count: 0,
    would_block_path_count: 0,
    false_block_count: 0,
    false_block_rate: 0,
    malformed_row_count: 0,
    skipped_row_count: 0,
    sentinel_skip_count: 0,
    internal_error_row_count: 0,
    convention_unknown_count: 0,
    skipped_line_count: 0,
    ledger_missing_count: 0,
    ledger_empty_count: 0,
    ledger_unreadable_count: 0
  };
}

function _ledgerState(root) {
  const ledger = shadowLedgerPath(root);
  if (!ledger) return { ledger_path: null, reason_code: 'shadow_ledger_unresolved' };
  if (!fs.existsSync(ledger)) return { ledger_path: ledger, reason_code: 'shadow_ledger_missing' };
  try {
    const stat = fs.statSync(ledger);
    if (!stat.isFile()) return { ledger_path: ledger, reason_code: 'shadow_ledger_unreadable' };
    if (stat.size === 0) return { ledger_path: ledger, reason_code: 'shadow_ledger_empty' };
    return { ledger_path: ledger, reason_code: null };
  } catch {
    return { ledger_path: ledger, reason_code: 'shadow_ledger_unreadable' };
  }
}

function _classifyRepoKey(root, rows, runtimeConvention) {
  const base = path.basename(path.resolve(root));
  const lowerBase = base.toLowerCase();
  const rowRepoIds = rows.map((row) => String(row && row.repo_id || '').toLowerCase());
  if (lowerBase === 'devcp' || rowRepoIds.includes('devcp')) return 'devcp';
  if (lowerBase.includes('gsdedits') || runtimeConvention.convention === 'gsdedits') return 'GSDedits';
  return base || 'repo';
}

function _rowRepoIds(rows, fallback) {
  const ids = new Set();
  for (const row of rows) {
    if (typeof row.repo_id === 'string' && row.repo_id.trim()) ids.add(row.repo_id.trim());
  }
  if (ids.size === 0) ids.add(fallback);
  return Array.from(ids).sort();
}

function analyzeShadowRepo(root, options = {}) {
  const resolvedRoot = _repoRoot(root);
  if (!resolvedRoot) {
    const reasonCodes = ['shadow_repo_root_not_found'];
    return Object.assign(_emptyCounts(), {
      repo_key: path.basename(String(root || 'repo')) || 'repo',
      repo_ids: [],
      root: root || null,
      ledger_path: null,
      artifact_convention_status: 'unknown',
      artifact_convention_reason_code: 'shadow_repo_root_not_found',
      reason_codes: reasonCodes,
      false_block_rate: 0
    });
  }

  const runtimeConvention = discoverConvention(resolvedRoot);
  const ledgerState = _ledgerState(resolvedRoot);
  const read = readShadowRows(resolvedRoot, { limit: options.limit || DEFAULT_REPORT_LIMIT });
  const rows = _asArray(read.rows);
  const reasonSet = new Set(_asArray(read.reason_codes));
  const counts = _emptyCounts();
  counts.row_count = rows.length;
  counts.skipped_line_count = Number.isInteger(read.skipped_line_count) ? read.skipped_line_count : 0;

  if (ledgerState.reason_code) _addReason(reasonSet, ledgerState.reason_code);
  if (ledgerState.reason_code === 'shadow_ledger_missing') counts.ledger_missing_count += 1;
  if (ledgerState.reason_code === 'shadow_ledger_empty') counts.ledger_empty_count += 1;
  if (ledgerState.reason_code === 'shadow_ledger_unreadable' || ledgerState.reason_code === 'shadow_ledger_unresolved') {
    counts.ledger_unreadable_count += 1;
  }
  if (counts.skipped_line_count > 0) _addReason(reasonSet, 'shadow_ledger_corrupt');

  const runtimeUnknown = !runtimeConvention || runtimeConvention.convention === 'unknown';
  if (runtimeUnknown) {
    counts.convention_unknown_count += 1;
    _addReason(reasonSet, 'convention_unknown');
  }

  for (const row of rows) {
    if (_isModeControlRow(row)) continue;

    const malformed = _rowMalformed(row);
    const internal = _hasInternalReason(row);
    const skipped = row && row.status === 'skipped';
    const sentinel = _isSentinelSkip(row);
    const rowUnknown = _rowConventionUnknown(row);
    const sourceRecords = _sourcePathRecords(row);
    const wouldWarnPathCount = sourceRecords.filter((record) => _pathWouldWarn(row, record)).length;
    const wouldBlockPathCount = sourceRecords.filter((record) => _pathWouldBlock(row, record)).length;
    const falseBlockPathCount = sourceRecords.filter((record) => _pathFalseBlock(row, record)).length;

    counts.source_touching_count += sourceRecords.length;
    counts.would_warn_path_count += wouldWarnPathCount;
    counts.would_block_path_count += wouldBlockPathCount;
    counts.false_block_count += falseBlockPathCount;

    if (wouldWarnPathCount > 0) counts.would_warn_count += 1;
    if (wouldBlockPathCount > 0) counts.would_block_count += 1;
    if (malformed) counts.malformed_row_count += 1;
    if (internal) counts.internal_error_row_count += 1;
    if (skipped) counts.skipped_row_count += 1;
    if (sentinel) counts.sentinel_skip_count += 1;
    if (rowUnknown) counts.convention_unknown_count += 1;

    if (malformed) _addReason(reasonSet, 'malformed_rows_present');
    if (internal) _addReason(reasonSet, 'internal_error_rows_present');
    if (rowUnknown) _addReason(reasonSet, 'convention_unknown');
    if (_reasonCodes(row).includes('path_evidence_missing')) _addReason(reasonSet, 'per_path_evidence_missing');

    if (!malformed && !internal && !skipped && row && row.signal === SIGNAL) counts.real_payload_count += 1;
  }

  counts.false_block_rate = counts.source_touching_count > 0
    ? counts.false_block_count / counts.source_touching_count
    : 0;

  const repoKey = _classifyRepoKey(resolvedRoot, rows, runtimeConvention || {});
  return Object.assign(counts, {
    repo_key: repoKey,
    repo_ids: _rowRepoIds(rows, path.basename(resolvedRoot)),
    root: resolvedRoot,
    ledger_path: ledgerState.ledger_path,
    artifact_convention_status: runtimeConvention && runtimeConvention.convention || 'unknown',
    artifact_convention_reason_code: runtimeConvention && runtimeConvention.reason_code || 'convention_unknown',
    reason_codes: Array.from(reasonSet).sort()
  });
}

function _totals(repos) {
  const total = _emptyCounts();
  for (const repo of repos) {
    _sum(total, repo, Object.keys(total).filter((key) => key !== 'false_block_rate'));
  }
  total.false_block_rate = total.source_touching_count > 0
    ? total.false_block_count / total.source_touching_count
    : 0;
  return total;
}

function _falsifier(repos, total) {
  const reasons = new Set();
  const byKey = new Map(repos.map((repo) => [repo.repo_key, repo]));

  for (const required of REQUIRED_REPOS) {
    if (!byKey.has(required)) _addReason(reasons, `required_repo_missing_${required.toLowerCase()}`);
  }

  if (total.real_payload_count < MIN_REAL_PAYLOADS) _addReason(reasons, 'insufficient_real_payloads');
  if (total.ledger_missing_count > 0) _addReason(reasons, 'shadow_ledger_missing');
  if (total.ledger_empty_count > 0) _addReason(reasons, 'shadow_ledger_empty');
  if (total.ledger_unreadable_count > 0) _addReason(reasons, 'shadow_ledger_unreadable');
  if (total.skipped_line_count > 0) _addReason(reasons, 'shadow_ledger_corrupt');
  if (total.malformed_row_count > 0) _addReason(reasons, 'malformed_rows_present');
  if (total.internal_error_row_count > 0) _addReason(reasons, 'internal_error_rows_present');
  if (total.convention_unknown_count > 0) _addReason(reasons, 'convention_unknown');

  for (const repo of repos) {
    for (const reason of repo.reason_codes) {
      if (reason === 'per_path_evidence_missing') _addReason(reasons, reason);
      if (/^shadow_ledger_/.test(reason)) _addReason(reasons, reason);
    }
    if (repo.false_block_rate >= MAX_FALSE_BLOCK_RATE && repo.source_touching_count > 0) {
      _addReason(reasons, 'false_block_rate_high');
    }
  }

  return {
    passed: reasons.size === 0,
    reason_codes: Array.from(reasons).sort(),
    required_repos: REQUIRED_REPOS.slice(),
    min_real_payloads: MIN_REAL_PAYLOADS,
    max_false_block_rate_exclusive: MAX_FALSE_BLOCK_RATE
  };
}

function buildShadowReport(repoRoots, options = {}) {
  const roots = _repoRoots(repoRoots);
  const repos = roots.map((root) => analyzeShadowRepo(root, options));
  const total = _totals(repos);
  const falsifier = _falsifier(repos, total);
  return {
    signal: 'commit_gate_shadow_report',
    report_version: REPORT_VERSION,
    generated_at: new Date().toISOString(),
    repos,
    total,
    falsifier
  };
}

function reportSummary(report) {
  return {
    report_version: report && report.report_version || REPORT_VERSION,
    generated_at: report && report.generated_at || new Date().toISOString(),
    falsifier_passed: Boolean(report && report.falsifier && report.falsifier.passed),
    reason_codes: _asArray(report && report.falsifier && report.falsifier.reason_codes),
    total_real_payload_count: report && report.total && report.total.real_payload_count || 0,
    total_false_block_count: report && report.total && report.total.false_block_count || 0,
    total_false_block_rate: report && report.total && report.total.false_block_rate || 0,
    repos: _asArray(report && report.repos).map((repo) => ({
      repo_key: repo.repo_key,
      repo_ids: _asArray(repo.repo_ids),
      real_payload_count: repo.real_payload_count,
      source_touching_count: repo.source_touching_count,
      false_block_count: repo.false_block_count,
      false_block_rate: repo.false_block_rate,
      artifact_convention_status: repo.artifact_convention_status,
      artifact_convention_reason_code: repo.artifact_convention_reason_code,
      reason_codes: _asArray(repo.reason_codes)
    }))
  };
}

module.exports = {
  buildShadowReport,
  analyzeShadowRepo,
  reportSummary,
  REPORT_VERSION,
  REQUIRED_REPOS,
  MIN_REAL_PAYLOADS,
  MAX_FALSE_BLOCK_RATE,
  MODE_FILE_REL
};