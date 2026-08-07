#!/usr/bin/env node
'use strict';

// ============================================================================
// SGSD commit gate hook
// ============================================================================
// T147-03: warn-mode pre-commit hook. T147-04 adds explicit shadow reporting
// and mechanical block activation. This is one governance layer only;
// --no-verify and some GUI clients can bypass it. All shadow writes go through
// appendShadowRow(root, row), with root derived only from findSgsdRoot(cwd).
// ============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');

const { findSgsdRoot, readState, resolveContainedPath } = require('../scripts/lib/sgsd-state.cjs');
const { discoverConvention, evaluatePaths } = require('../scripts/lib/sgsd-artifact-conventions.cjs');
const { appendShadowRow } = require('../scripts/lib/commit-gate-shadow-log.cjs');
const {
  buildShadowReport,
  reportSummary,
  MODE_FILE_REL
} = require('../scripts/lib/commit-gate-shadow-report.cjs');

const EXIT_OK = 0;
const EXIT_EARNED_BLOCK = 10;
const EXIT_USAGE = 2;
const EXIT_REFUSED = 3;
const MODE_WARN = 'warn';
const MODE_BLOCK = 'block';
const ARTIFACT_PREDICATE_VERSION = 't147-01';
const SENTINEL_FILE = '.sgsd-gate-off';
const SIGNAL = 'commit_gate_shadow';
const DIFF_HASH_MAX_BYTES = 32 * 1024 * 1024;
const DIFF_HASH_TRUNCATED_BASIS = 'truncated_32mb';
const DIFF_HASH_TRUNCATED_REASON = 'diff_hash_truncated_32mb';
const INTERNAL_HASH_DIFF_ARG = '--sgsd-internal-hash-staged-diff';
const MODE_FILE_DIGEST_CONTEXT = 'sgsd.commit-gate.block-mode.v1';

function oneLine(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').slice(0, 300);
}

function stderr(line) {
  try {
    process.stderr.write(`${line}\n`);
  } catch {
    // Stderr failure must not become the commit failure mode.
  }
}

function stdoutJson(value) {
  try {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  } catch {
    // Console failure is outside the governance decision.
  }
}

function breadcrumb(reasonCode, detail) {
  const suffix = detail ? `: ${oneLine(detail)}` : '';
  stderr(`[SGSD] commit-gate degraded ${reasonCode}${suffix}`);
}

function repoId(root) {
  try {
    return path.basename(path.resolve(String(root || 'repo'))) || 'repo';
  } catch {
    return 'repo';
  }
}

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value === undefined || value === null) return Buffer.alloc(0);
  return Buffer.from(String(value), 'utf8');
}

function git(args, options = {}) {
  try {
    const result = spawnSync('git', args, {
      cwd: options.cwd || process.cwd(),
      encoding: options.encoding,
      env: process.env,
      windowsHide: true
    });
    if (result.error) {
      return {
        ok: false,
        reason_code: 'git_spawn_failed',
        detail: result.error.code || result.error.message || 'spawn_failed',
        result
      };
    }
    if (result.status !== 0) {
      const stdoutText = Buffer.isBuffer(result.stdout) ? result.stdout.toString('utf8') : String(result.stdout || '');
      const stderrText = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr || '');
      return {
        ok: false,
        reason_code: options.reason_code || 'git_command_failed',
        detail: stderrText || stdoutText || `exit_${result.status}`,
        result
      };
    }
    return { ok: true, stdout: result.stdout, stderr: result.stderr, result };
  } catch (error) {
    return {
      ok: false,
      reason_code: 'git_spawn_failed',
      detail: error && (error.code || error.message) || 'git_unexpected_error',
      result: null
    };
  }
}

function parseNameStatus(buffer) {
  const text = asBuffer(buffer).toString('utf8');
  if (!text) return [];

  const parts = text.split('\0');
  if (parts[parts.length - 1] === '') parts.pop();

  const out = [];
  for (let index = 0; index < parts.length;) {
    const status = parts[index++];
    if (!status) throw new Error('empty_status');

    if (/^[RC]/i.test(status)) {
      const oldPath = parts[index++];
      const newPath = parts[index++];
      if (!oldPath || !newPath) throw new Error(`rename_copy_record_incomplete:${status}`);
      out.push({ status, oldPath: oldPath.replace(/\\/g, '/'), path: newPath.replace(/\\/g, '/') });
      continue;
    }

    const filePath = parts[index++];
    if (!filePath) throw new Error(`name_status_record_incomplete:${status}`);
    out.push({ status, path: filePath.replace(/\\/g, '/') });
  }
  return out;
}

function stagedNameStatus(root) {
  const result = git(['diff', '--cached', '--name-status', '-z', '--find-renames', '--find-copies', '--'], {
    cwd: root,
    reason_code: 'git_name_status_failed'
  });
  if (!result.ok) return result;

  try {
    return { ok: true, entries: parseNameStatus(result.stdout) };
  } catch (error) {
    return {
      ok: false,
      reason_code: 'name_status_unparsable',
      detail: error && error.message || 'parse_failed'
    };
  }
}

function streamStagedDiffSha256(root, maxBytes = DIFF_HASH_MAX_BYTES) {
  const byteLimit = Number.isInteger(maxBytes) && maxBytes > 0 ? maxBytes : DIFF_HASH_MAX_BYTES;
  return new Promise((resolve) => {
    const hash = crypto.createHash('sha256');
    let bytesHashed = 0;
    let stderrText = '';
    let truncated = false;
    let settled = false;

    function finish(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }

    let child;
    try {
      child = spawn('git', ['diff', '--cached', '--binary', '--'], {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true
      });
    } catch (error) {
      finish({ ok: false, reason_code: 'git_spawn_failed', detail: error && (error.code || error.message) || 'spawn_failed' });
      return;
    }

    child.on('error', (error) => {
      finish({ ok: false, reason_code: 'git_spawn_failed', detail: error && (error.code || error.message) || 'spawn_failed' });
    });

    child.stderr.on('data', (chunk) => {
      if (stderrText.length < 4096) stderrText += asBuffer(chunk).toString('utf8').slice(0, 4096 - stderrText.length);
    });

    child.stdout.on('data', (chunk) => {
      if (truncated) return;
      const buffer = asBuffer(chunk);
      const remaining = byteLimit - bytesHashed;
      if (buffer.length <= remaining) {
        hash.update(buffer);
        bytesHashed += buffer.length;
        return;
      }

      if (remaining > 0) {
        hash.update(buffer.subarray(0, remaining));
        bytesHashed += remaining;
      }
      truncated = true;
      try { child.stdout.destroy(); } catch {}
      try { child.kill(); } catch {}
    });

    child.on('close', (status, signal) => {
      if (settled) return;
      const digest = hash.digest('hex');
      if (truncated) {
        finish({
          ok: true,
          diff_sha256: digest,
          diff_hash_basis: DIFF_HASH_TRUNCATED_BASIS,
          diff_hash_byte_limit: byteLimit,
          diff_hash_bytes_hashed: bytesHashed,
          reason_codes: [DIFF_HASH_TRUNCATED_REASON]
        });
        return;
      }
      if (status !== 0) {
        finish({ ok: false, reason_code: 'git_diff_failed', detail: stderrText || `exit_${status}${signal ? `_${signal}` : ''}` });
        return;
      }
      finish({
        ok: true,
        diff_sha256: digest,
        diff_hash_basis: 'full',
        diff_hash_bytes_hashed: bytesHashed,
        reason_codes: []
      });
    });
  });
}

async function hashStagedDiffInternal(argv) {
  const root = path.resolve(String(argv[0] || process.cwd()));
  const maxBytes = Number.parseInt(argv[1], 10);
  const result = await streamStagedDiffSha256(root, Number.isInteger(maxBytes) && maxBytes > 0 ? maxBytes : DIFF_HASH_MAX_BYTES);
  try {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    return 1;
  }
  return result.ok ? 0 : 1;
}

function stagedDiffSha256(root) {
  let result;
  try {
    result = spawnSync(process.execPath, [__filename, INTERNAL_HASH_DIFF_ARG, root, String(DIFF_HASH_MAX_BYTES)], {
      cwd: root,
      encoding: 'utf8',
      env: process.env,
      maxBuffer: 1024 * 1024,
      windowsHide: true
    });
  } catch (error) {
    return { ok: false, reason_code: 'git_spawn_failed', detail: error && (error.code || error.message) || 'spawn_failed' };
  }

  if (result.error) {
    return { ok: false, reason_code: 'git_spawn_failed', detail: result.error.code || result.error.message || 'spawn_failed' };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(String(result.stdout || '').trim());
  } catch (error) {
    const detail = result.stderr || result.stdout || (error && error.message) || 'hash_worker_unparseable';
    return { ok: false, reason_code: 'git_diff_failed', detail };
  }

  if (result.status !== 0 || !parsed || parsed.ok !== true) {
    return {
      ok: false,
      reason_code: parsed && parsed.reason_code || 'git_diff_failed',
      detail: parsed && parsed.detail || result.stderr || `exit_${result.status}`
    };
  }

  return parsed;
}

function commitCandidate(root) {
  const result = git(['rev-parse', '--verify', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
    reason_code: 'git_head_unavailable'
  });
  if (!result.ok) return 'unborn-HEAD';
  const value = String(result.stdout || '').trim();
  return value || 'unborn-HEAD';
}

function sentinelPresent(root) {
  try {
    return fs.existsSync(path.join(root, SENTINEL_FILE));
  } catch {
    return false;
  }
}

function listReasonCodes(pathEvidence, extraReasons = []) {
  const out = new Set();
  for (const reason of extraReasons) {
    if (typeof reason === 'string' && reason.trim()) out.add(reason.trim());
  }
  for (const record of Array.isArray(pathEvidence) ? pathEvidence : []) {
    if (record && typeof record.reason_code === 'string' && record.reason_code.trim()) {
      out.add(record.reason_code.trim());
    }
  }
  return Array.from(out);
}

function evaluatedPaths(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => entry && typeof entry.path === 'string' ? entry.path.replace(/\\/g, '/') : '')
    .filter(Boolean);
}

function sourceMissingEvidence(record) {
  return Boolean(record && record.source_touching === true && record.evidence_status !== 'backed');
}

function degradedEvidence(reasonCode, entries) {
  const paths = evaluatedPaths(entries);
  if (paths.length > 0) {
    return paths.map((pathValue) => ({
      path: pathValue,
      source_touching: false,
      evidence_status: 'degraded',
      matched_artifacts: [],
      reason_code: reasonCode
    }));
  }
  return [{
    path: null,
    source_touching: false,
    evidence_status: 'degraded',
    matched_artifacts: [],
    reason_code: reasonCode
  }];
}

function appendRow(root, row) {
  const written = appendShadowRow(root, row);
  if (!written) breadcrumb('shadow_row_append_refused', row && Array.isArray(row.reason_codes) ? row.reason_codes.join(',') : 'unknown');
  return written;
}
function shadowWriteFailureReason(written) {
  if (!written) return 'shadow_row_append_refused';
  const reasons = Array.isArray(written.reason_codes) ? written.reason_codes : [];
  if (reasons.includes('shadow_ledger_append_failed')) return 'shadow_ledger_append_failed';
  return null;
}

function shadowDecisionRowPersisted(written) {
  return Boolean(written) && shadowWriteFailureReason(written) === null;
}

function appendDegradedRow(root, reasonCode, detail, extra = {}) {
  breadcrumb(reasonCode, detail);
  const entries = Array.isArray(extra.entries) ? extra.entries : [];
  const pathEvidence = Array.isArray(extra.path_evidence) && extra.path_evidence.length > 0
    ? extra.path_evidence
    : degradedEvidence(reasonCode, entries);
  const stagedPaths = Array.isArray(extra.staged_paths) ? extra.staged_paths : evaluatedPaths(entries);

  return appendRow(root, {
    signal: SIGNAL,
    status: 'warn',
    repo_id: repoId(root),
    commit_candidate: extra.commit_candidate || 'unknown',
    diff_sha256: typeof extra.diff_sha256 === 'string' ? extra.diff_sha256 : undefined,
    artifact_predicate_version: ARTIFACT_PREDICATE_VERSION,
    artifact_convention_status: extra.artifact_convention_status || 'degraded',
    staged_paths: stagedPaths,
    path_evidence: pathEvidence,
    would_warn: true,
    would_block: false,
    false_block_basis: [reasonCode],
    waived_paths: [],
    reason_codes: listReasonCodes(pathEvidence, [reasonCode])
  });
}

function modeFilePath(root) {
  try {
    return resolveContainedPath(root, MODE_FILE_REL);
  } catch {
    return null;
  }
}
function modeFileActivationRecord(payload) {
  return {
    mode: payload && payload.mode,
    activated_at: payload && payload.activated_at,
    activated_by: payload && payload.activated_by,
    report_summary: payload && payload.report_summary
  };
}

function modeFileDigest(record) {
  // No secret is available inside a local git hook. This digest is tamper-evident,
  // not tamper-proof: it rejects bare block files and casual edits at the read seam.
  return crypto
    .createHash('sha256')
    .update(`${MODE_FILE_DIGEST_CONTEXT}\n${JSON.stringify(record)}`, 'utf8')
    .digest('hex');
}

function buildBlockModePayload(report) {
  const record = {
    mode: MODE_BLOCK,
    activated_at: new Date().toISOString(),
    activated_by: actorName(),
    report_summary: reportSummary(report)
  };
  return Object.assign({}, record, {
    integrity_digest: modeFileDigest(record)
  });
}

function validateBlockModePayload(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ok: false, reason_code: 'mode_file_shape_invalid' };
  const record = modeFileActivationRecord(parsed);
  if (record.mode !== MODE_BLOCK) return { ok: false, reason_code: 'mode_file_mode_invalid' };
  if (typeof record.activated_at !== 'string' || !record.activated_at.trim()) return { ok: false, reason_code: 'mode_file_activation_missing' };
  if (typeof record.activated_by !== 'string' || !record.activated_by.trim()) return { ok: false, reason_code: 'mode_file_actor_missing' };
  if (!record.report_summary || typeof record.report_summary !== 'object' || Array.isArray(record.report_summary)) return { ok: false, reason_code: 'mode_file_report_missing' };
  if (record.report_summary.falsifier_passed !== true || record.report_summary.verdict !== 'pass') return { ok: false, reason_code: 'mode_file_report_not_passed' };
  if (!Number.isFinite(record.report_summary.total_real_payload_count)) return { ok: false, reason_code: 'mode_file_payload_count_invalid' };
  if (!Number.isFinite(record.report_summary.total_false_block_rate)) return { ok: false, reason_code: 'mode_file_false_block_rate_invalid' };
  if (!Array.isArray(record.report_summary.repos)) return { ok: false, reason_code: 'mode_file_repo_summary_invalid' };
  if (typeof parsed.integrity_digest !== 'string' || !/^[a-f0-9]{64}$/i.test(parsed.integrity_digest)) return { ok: false, reason_code: 'mode_file_digest_missing' };
  const expected = modeFileDigest(record);
  if (parsed.integrity_digest.toLowerCase() !== expected) return { ok: false, reason_code: 'mode_file_digest_mismatch' };
  return { ok: true, record };
}

function readCommitGateMode(root) {
  const filePath = modeFilePath(root);
  if (!filePath) return { mode: MODE_WARN, reason_codes: ['mode_file_containment_refused'], invalid: true, detail: 'mode_file_containment_refused' };
  if (!fs.existsSync(filePath)) return { mode: MODE_WARN, reason_codes: [] };

  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    const detail = error && (error.code || error.message) || 'read_failed';
    breadcrumb('mode_file_unreadable', detail);
    return { mode: MODE_WARN, reason_codes: ['mode_file_unreadable'], invalid: true, detail };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const detail = error && error.message || 'json_parse_failed';
    breadcrumb('mode_file_invalid', detail);
    return { mode: MODE_WARN, reason_codes: ['mode_file_invalid'], invalid: true, detail };
  }

  const validation = validateBlockModePayload(parsed);
  if (validation.ok) return { mode: MODE_BLOCK, reason_codes: [], activation_record: validation.record };

  breadcrumb('mode_file_invalid', validation.reason_code || filePath);
  return { mode: MODE_WARN, reason_codes: ['mode_file_invalid'], invalid: true, detail: validation.reason_code || 'mode_file_invalid' };
}

function printWarnSummary(unbackedRecords) {
  const paths = unbackedRecords.map((record) => record.path).filter(Boolean);
  stderr('[SGSD] commit gate warning: source-touching staged paths lack active SGSD plan/assurance evidence.');
  stderr('[SGSD] This pre-commit hook is one governance layer only; --no-verify and some GUI clients can bypass it.');
  for (const filePath of paths) stderr(`[SGSD] unbacked staged path: ${filePath}`);
}

function printBlockSummary(unbackedRecords) {
  const paths = unbackedRecords.map((record) => record.path).filter(Boolean);
  stderr('[SGSD] commit gate blocked: source-touching staged paths lack active SGSD plan/assurance evidence.');
  stderr(`[SGSD] To waive this governance layer for one attempt, create ${SENTINEL_FILE}; waived paths will be logged.`);
  for (const filePath of paths) stderr(`[SGSD] blocked staged path: ${filePath}`);
}

function printSentinelSummary(paths) {
  stderr(`[SGSD] commit gate sentinel ${SENTINEL_FILE} present; skipping this one governance layer.`);
  for (const filePath of paths) stderr(`[SGSD] sentinel waived staged path: ${filePath}`);
}

function diffReasonCodes(diffInfo) {
  const out = [];
  if (diffInfo && Array.isArray(diffInfo.reason_codes)) out.push(...diffInfo.reason_codes);
  if (diffInfo && diffInfo.diff_hash_basis === DIFF_HASH_TRUNCATED_BASIS) out.push(DIFF_HASH_TRUNCATED_REASON);
  return Array.from(new Set(out.filter((item) => typeof item === 'string' && item.trim())));
}

function diffNextAction(diffInfo) {
  if (!diffInfo || diffInfo.diff_hash_basis !== DIFF_HASH_TRUNCATED_BASIS) return undefined;
  return JSON.stringify({
    diff_hash_basis: diffInfo.diff_hash_basis,
    diff_hash_byte_limit: diffInfo.diff_hash_byte_limit,
    diff_hash_bytes_hashed: diffInfo.diff_hash_bytes_hashed
  });
}

function buildNormalRow(root, state, convention, entries, pathEvidence, diffInfo, status, mode, extraReasons = []) {
  const reasons = listReasonCodes(pathEvidence, [...extraReasons, ...diffReasonCodes(diffInfo)]);
  const unbacked = pathEvidence.filter(sourceMissingEvidence);
  return {
    signal: SIGNAL,
    status,
    repo_id: repoId(root),
    commit_candidate: commitCandidate(root),
    diff_sha256: diffInfo && diffInfo.diff_sha256,
    artifact_predicate_version: ARTIFACT_PREDICATE_VERSION,
    artifact_convention_status: convention.reason_code || convention.convention || 'unknown',
    staged_paths: evaluatedPaths(entries),
    path_evidence: pathEvidence,
    would_warn: status === 'warn',
    would_block: mode === MODE_BLOCK && status === 'blocked',
    false_block_basis: unbacked.map((record) => record.reason_code).filter(Boolean),
    waived_paths: [],
    reason_codes: reasons,
    next_action: diffNextAction(diffInfo),
    milestone: state && state.milestone || null,
    phase: state && state.phase || null
  };
}

function buildSentinelRow(root, state, convention, entries, pathEvidence, diffInfo, extraReasons = []) {
  const paths = evaluatedPaths(entries);
  return {
    signal: SIGNAL,
    status: 'skipped',
    repo_id: repoId(root),
    commit_candidate: commitCandidate(root),
    diff_sha256: diffInfo && diffInfo.diff_sha256,
    artifact_predicate_version: ARTIFACT_PREDICATE_VERSION,
    artifact_convention_status: convention.reason_code || convention.convention || 'unknown',
    staged_paths: paths,
    path_evidence: pathEvidence,
    would_warn: false,
    would_block: false,
    false_block_basis: [],
    waived_paths: paths,
    reason_codes: listReasonCodes(pathEvidence, ['sentinel_waived_block', ...extraReasons, ...diffReasonCodes(diffInfo)]),
    next_action: diffNextAction(diffInfo),
    milestone: state && state.milestone || null,
    phase: state && state.phase || null
  };
}

function decisionForMode(mode, wouldBlock) {
  if (mode === MODE_BLOCK && wouldBlock) return 'block';
  return 'allow';
}

function exitCodeForDecision(decision) {
  return decision === 'block' ? EXIT_EARNED_BLOCK : EXIT_OK;
}

function evaluateCommitAttempt(root) {
  const nameStatus = stagedNameStatus(root);
  if (!nameStatus.ok) {
    appendDegradedRow(root, nameStatus.reason_code, nameStatus.detail);
    return exitCodeForDecision(decisionForMode(MODE_WARN, false));
  }

  const diff = stagedDiffSha256(root);
  if (!diff.ok) {
    appendDegradedRow(root, diff.reason_code, diff.detail, { entries: nameStatus.entries });
    return exitCodeForDecision(decisionForMode(MODE_WARN, false));
  }

  let state = null;
  let convention = null;
  let pathEvidence = null;
  try {
    state = readState(root) || {};
    convention = discoverConvention(root);
    pathEvidence = evaluatePaths(root, nameStatus.entries, state);
  } catch (error) {
    appendDegradedRow(root, 'artifact_evaluation_failed', error && error.message, {
      entries: nameStatus.entries,
      diff_sha256: diff.diff_sha256
    });
    return exitCodeForDecision(decisionForMode(MODE_WARN, false));
  }

  const modeInfo = readCommitGateMode(root);
  const mode = modeInfo.mode;
  const conventionReasons = Array.isArray(modeInfo.reason_codes) ? modeInfo.reason_codes.slice() : [];
  if (modeInfo.invalid) {
    const reasonCode = conventionReasons.includes('mode_file_invalid')
      ? 'mode_file_invalid'
      : (conventionReasons[0] || 'mode_file_invalid');
    appendDegradedRow(root, reasonCode, modeInfo.detail, {
      entries: nameStatus.entries,
      path_evidence: pathEvidence,
      diff_sha256: diff.diff_sha256,
      commit_candidate: commitCandidate(root),
      artifact_convention_status: 'degraded'
    });
  }
  const conventionUnknown = !convention || convention.convention === 'unknown';
  if (conventionUnknown) {
    const reasonCode = convention && convention.reason_code || 'convention_unknown';
    conventionReasons.push(reasonCode);
    breadcrumb(reasonCode);
  }

  if (sentinelPresent(root)) {
    const row = buildSentinelRow(root, state, convention || {}, nameStatus.entries, pathEvidence, diff, conventionReasons);
    appendRow(root, row);
    printSentinelSummary(row.waived_paths);
    return exitCodeForDecision(decisionForMode(MODE_WARN, false));
  }

  const unbacked = pathEvidence.filter(sourceMissingEvidence);
  const shouldBlock = mode === MODE_BLOCK && !conventionUnknown && unbacked.length > 0;
  const status = shouldBlock ? 'blocked' : (conventionUnknown || unbacked.length > 0 ? 'warn' : 'ok');
  const row = buildNormalRow(root, state, convention || {}, nameStatus.entries, pathEvidence, diff, status, mode, conventionReasons);
  const written = appendRow(root, row);

  if (shouldBlock && !shadowDecisionRowPersisted(written)) {
    const writeFailure = shadowWriteFailureReason(written) || 'decision_shadow_row_not_persisted';
    stderr(`[SGSD] commit gate would have blocked, but the decision shadow row did not persist (${writeFailure}); degrading to warn mode.`);
    appendDegradedRow(root, 'decision_shadow_row_not_persisted', writeFailure, {
      entries: nameStatus.entries,
      path_evidence: pathEvidence,
      diff_sha256: diff.diff_sha256,
      commit_candidate: row.commit_candidate,
      artifact_convention_status: 'degraded'
    });
    printWarnSummary(unbacked);
    return EXIT_OK;
  }

  if (unbacked.length > 0) {
    if (shouldBlock) printBlockSummary(unbacked);
    else printWarnSummary(unbacked);
  }
  return exitCodeForDecision(decisionForMode(mode, shouldBlock));
}

function parseCliArgs(argv) {
  const out = { action: 'commit', repoRoots: [], limit: undefined, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg === '--shadow-report') {
      out.action = 'shadow-report';
    } else if (arg === '--activate-block') {
      out.action = 'activate-block';
    } else if (arg === '--deactivate-block') {
      out.action = 'deactivate-block';
    } else if (arg === '--repo-root') {
      const value = argv[index + 1];
      if (!value) throw new Error('missing --repo-root value');
      out.repoRoots.push(value);
      index += 1;
    } else if (arg === '--limit') {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value <= 0) throw new Error('invalid --limit value');
      out.limit = value;
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return out;
}

function usage() {
  return [
    'Usage:',
    '  sgsd-commit-gate.cjs',
    '  sgsd-commit-gate.cjs --shadow-report [--repo-root <path>]...',
    '  sgsd-commit-gate.cjs --activate-block [--repo-root <path>]...',
    '  sgsd-commit-gate.cjs --deactivate-block',
    '',
    'Reports are read-only. Block activation recomputes the report and writes the contained mode file only after the falsifier passes.'
  ].join('\n');
}

function reportRoots(controlRoot, extraRoots) {
  const out = [];
  if (controlRoot) out.push(controlRoot);
  for (const item of Array.isArray(extraRoots) ? extraRoots : []) out.push(item);
  return out;
}

function actorName() {
  return process.env.SGSD_COMMIT_GATE_ACTOR
    || process.env.USER
    || process.env.USERNAME
    || 'unknown';
}

function appendModeControlRow(root, reasonCode, extra = {}) {
  return appendRow(root, {
    signal: SIGNAL,
    status: 'ok',
    repo_id: repoId(root),
    commit_candidate: `mode-control:${reasonCode}`,
    diff_content: JSON.stringify({ reason_code: reasonCode, extra }),
    artifact_predicate_version: ARTIFACT_PREDICATE_VERSION,
    artifact_convention_status: 'mode_control',
    staged_paths: [MODE_FILE_REL.replace(/\\/g, '/')],
    path_evidence: [{
      path: MODE_FILE_REL.replace(/\\/g, '/'),
      source_touching: false,
      evidence_status: 'not_source',
      matched_artifacts: [],
      reason_code: reasonCode
    }],
    would_warn: false,
    would_block: false,
    false_block_basis: [],
    waived_paths: [],
    reason_codes: [reasonCode]
  });
}

function writeBlockModeFile(root, report) {
  const filePath = modeFilePath(root);
  if (!filePath) return { ok: false, reason_code: 'mode_file_containment_refused' };
  const payload = buildBlockModePayload(report);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    return { ok: true, path: filePath, payload };
  } catch (error) {
    return { ok: false, reason_code: 'mode_file_write_failed', detail: error && (error.code || error.message) };
  }
}

function runShadowReport(root, args) {
  const report = buildShadowReport(reportRoots(root, args.repoRoots), { limit: args.limit });
  stdoutJson(report);
  return EXIT_OK;
}

function reportHasUnknownConvention(report) {
  return Array.isArray(report && report.repos)
    && report.repos.some((repo) => repo.convention_unknown_count > 0 || repo.artifact_convention_status === 'unknown');
}

function activateBlock(root, args) {
  const report = buildShadowReport(reportRoots(root, args.repoRoots), { limit: args.limit });
  const summary = reportSummary(report);
  if (!report.falsifier.passed || reportHasUnknownConvention(report)) {
    stderr(`[SGSD] commit gate activation refused: ${summary.reason_codes.join(',') || 'falsifier_failed'}`);
    stdoutJson({ ok: false, action: 'activate-block', report_summary: summary });
    return EXIT_REFUSED;
  }

  const written = writeBlockModeFile(root, report);
  if (!written.ok) {
    stderr(`[SGSD] commit gate activation refused: ${written.reason_code}`);
    stdoutJson({ ok: false, action: 'activate-block', reason_code: written.reason_code, report_summary: summary });
    return EXIT_REFUSED;
  }

  appendModeControlRow(root, 'mode_activated', { report_summary: summary });
  stdoutJson({ ok: true, action: 'activate-block', mode_file: written.path, report_summary: summary });
  return EXIT_OK;
}

function deactivateBlock(root) {
  const filePath = modeFilePath(root);
  let removed = false;
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      removed = true;
    } catch (error) {
      stderr(`[SGSD] commit gate deactivation failed: ${oneLine(error && (error.code || error.message))}`);
      stdoutJson({ ok: false, action: 'deactivate-block', reason_code: 'mode_file_remove_failed' });
      return EXIT_REFUSED;
    }
  }

  appendModeControlRow(root, 'mode_deactivated', { mode_file: filePath, removed });
  stderr('[SGSD] commit gate block mode deactivated; warn mode active.');
  stdoutJson({ ok: true, action: 'deactivate-block', mode_file: filePath, removed });
  return EXIT_OK;
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === INTERNAL_HASH_DIFF_ARG) return hashStagedDiffInternal(argv.slice(1));

  let args;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    stderr(`[SGSD] commit gate usage error: ${oneLine(error && error.message)}`);
    stderr(usage());
    return EXIT_USAGE;
  }

  if (args.help) {
    stdoutJson({ usage: usage() });
    return EXIT_OK;
  }

  let root = null;
  try {
    root = findSgsdRoot(process.env.SGSD_COMMIT_GATE_TARGET_ROOT || process.cwd());
    if (args.action === 'shadow-report') return runShadowReport(root, args);

    if (!root) {
      stderr('[SGSD] commit gate non-SGSD repo: no .planning/STATE.md root found; exiting 0 without writing metrics.');
      return EXIT_OK;
    }

    if (args.action === 'activate-block') return activateBlock(root, args);
    if (args.action === 'deactivate-block') return deactivateBlock(root);
    return evaluateCommitAttempt(root);
  } catch (error) {
    if (root) appendDegradedRow(root, 'internal_error', error && error.message);
    else breadcrumb('internal_error_no_sgsd_root', error && error.message);
    return EXIT_OK;
  }
}

if (require.main === module) {
  const status = main();
  if (status && typeof status.then === 'function') {
    status
      .then((code) => { process.exitCode = code; })
      .catch((error) => {
        breadcrumb('internal_error', error && error.message);
        process.exitCode = EXIT_OK;
      });
  } else {
    process.exitCode = status;
  }
}

module.exports = {
  ARTIFACT_PREDICATE_VERSION,
  EXIT_EARNED_BLOCK,
  EXIT_OK,
  MODE_WARN,
  MODE_BLOCK,
  parseNameStatus,
  decisionForMode,
  exitCodeForDecision,
  evaluateCommitAttempt,
  readCommitGateMode,
  modeFilePath,
  main
};
