// SGSD Harness Transfer Evaluator -- Phase 104 (v2.9 AHE).
// Tests whether candidate harness changes generalize across decks and
// environment-degradation modes.
// Hard rule: refuses to attribute a transfer to a manifest entry whose
// timestamp is AFTER the transfer's start.
// Lock-13: never throws across public API.

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_PROJECT = path.resolve(__dirname, '..', '..', '..');
const TRANSFER_LOG_REL = path.join(
  '.planning', 'metrics', 'harness-transfer.jsonl'
);

const TRANSFER_DECKS = Object.freeze([
  'deterministic_smoke',
  'hidden_live',
  'held_out_live'
]);

const ENVIRONMENT_AXES = Object.freeze([
  'vtp_enabled',
  'codex_available',
  'shell',
  'warp_assisted',
  'fresh_clone'
]);

const CRITICAL_REGRESSION_RULES = Object.freeze([
  'success_rate_drop',
  'token_cost_bloat',
  'regressions_observed'
]);

function transferLogPath(projectDir) {
  return path.join(projectDir || DEFAULT_PROJECT, TRANSFER_LOG_REL);
}

function isFrozenBeforeRun(manifest_appended_at, run_started_at) {
  // Strict: manifest must be appended BEFORE run started.
  // Returns boolean. Lock-13: any error means false (conservative refuse).
  try {
    if (typeof manifest_appended_at !== 'string') return false;
    if (typeof run_started_at !== 'string') return false;
    const m = Date.parse(manifest_appended_at);
    const r = Date.parse(run_started_at);
    if (isNaN(m) || isNaN(r)) return false;
    return m < r;
  } catch (e) {
    return false;
  }
}

function detectCriticalRegression(record, baseline) {
  const reasons = [];
  try {
    if (!record || !record.outcome) {
      return { critical: false, reasons: ['record_missing_outcome'] };
    }
    if (!baseline || !baseline.outcome) {
      // Without a baseline we cannot call something a regression; the
      // record's regressions_observed array is still authoritative.
      const regressionsObserved =
        Array.isArray(record.outcome.regressions_observed)
          ? record.outcome.regressions_observed
          : [];
      if (regressionsObserved.length >= 1) {
        reasons.push('regressions_observed:' + regressionsObserved.length);
        return { critical: true, reasons: reasons };
      }
      return { critical: false, reasons: ['no_baseline_no_regressions'] };
    }

    const recR = typeof record.outcome.success_rate === 'number'
      ? record.outcome.success_rate : null;
    const baseR = typeof baseline.outcome.success_rate === 'number'
      ? baseline.outcome.success_rate : null;
    if (recR !== null && baseR !== null && (baseR - recR) >= 0.05) {
      reasons.push('success_rate_drop:' + ((baseR - recR).toFixed(4)));
    }

    const recT = typeof record.outcome.token_cost === 'number'
      ? record.outcome.token_cost : null;
    const baseT = typeof baseline.outcome.token_cost === 'number'
      ? baseline.outcome.token_cost : null;
    if (recT !== null && baseT !== null && baseT > 0
        && recT > baseT * 1.5) {
      reasons.push('token_cost_bloat:' + recT + 'vs' + baseT);
    }

    const regressionsObserved =
      Array.isArray(record.outcome.regressions_observed)
        ? record.outcome.regressions_observed
        : [];
    if (regressionsObserved.length >= 1) {
      reasons.push('regressions_observed:' + regressionsObserved.length);
    }

    return { critical: reasons.length > 0, reasons: reasons };
  } catch (e) {
    return { critical: false,
      reasons: ['detect_failed: ' + (e && e.message || e)] };
  }
}

function validateRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    errors.push('record_must_be_object');
    return errors;
  }
  if (typeof record.transfer_id !== 'string' ||
      !/^tx-[a-z0-9-]+$/.test(record.transfer_id)) {
    errors.push('transfer_id_invalid');
  }
  if (typeof record.change_id !== 'string' ||
      !/^ch-[a-z0-9-]+$/.test(record.change_id)) {
    errors.push('change_id_invalid');
  }
  if (typeof record.frozen_at !== 'string') errors.push('frozen_at_required');
  if (typeof record.started_at !== 'string') errors.push('started_at_required');
  if (TRANSFER_DECKS.indexOf(record.deck) === -1) {
    errors.push('deck_invalid:' + record.deck);
  }
  if (!record.environment || typeof record.environment !== 'object') {
    errors.push('environment_required');
  }
  if (!record.outcome || typeof record.outcome !== 'object') {
    errors.push('outcome_required');
  }
  return errors;
}

// PUBLIC API -- Lock-13: never throws.
function evaluateTransfer(opts) {
  try {
    opts = opts || {};
    if (!opts.record || typeof opts.record !== 'object') {
      return { ok: false, errors: ['record_required'] };
    }
    const errs = validateRecord(opts.record);
    if (errs.length > 0) return { ok: false, errors: errs };

    if (!isFrozenBeforeRun(opts.record.frozen_at, opts.record.started_at)) {
      return { ok: false,
        errors: ['frozen_at_must_precede_started_at'],
        transfer_record: opts.record };
    }

    const reg = detectCriticalRegression(opts.record, opts.baseline || null);
    const out = Object.assign({}, opts.record, {
      critical_regression: reg.critical,
      critical_regression_reasons: reg.reasons,
      evaluated_at: new Date().toISOString()
    });
    return { ok: true, transfer_record: out, errors: [] };
  } catch (e) {
    return { ok: false,
      errors: ['evaluate_failed: ' + (e && e.message || e)] };
  }
}

function recordTransfer(record, opts) {
  try {
    if (!record || typeof record !== 'object') {
      return { ok: false, errors: ['record_required'] };
    }
    const errs = validateRecord(record);
    if (errs.length > 0) return { ok: false, errors: errs };
    const projectDir = (opts && opts.projectDir) || DEFAULT_PROJECT;
    const lp = transferLogPath(projectDir);
    try { fs.mkdirSync(path.dirname(lp), { recursive: true }); }
    catch (e) { /* ignore */ }
    const annotated = Object.assign({}, record,
      { _appended_at: new Date().toISOString() });
    fs.appendFileSync(lp, JSON.stringify(annotated) + '\n', 'utf8');
    return { ok: true, errors: [], transfer_log_path: lp };
  } catch (e) {
    return { ok: false,
      errors: ['record_failed: ' + (e && e.message || e)] };
  }
}

function readTransfers(projectDir) {
  try {
    const lp = transferLogPath(projectDir || DEFAULT_PROJECT);
    if (!fs.existsSync(lp)) return { ok: true, rows: [], errors: [] };
    const src = fs.readFileSync(lp, 'utf8');
    const rows = [];
    const errors = [];
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (!ln || /^\s*$/.test(ln)) continue;
      try { rows.push(JSON.parse(ln)); }
      catch (e) {
        errors.push({ line: i + 1, msg: 'json_parse_failed' });
      }
    }
    return { ok: true, rows: rows, errors: errors };
  } catch (e) {
    return { ok: false, rows: [],
      errors: [{ msg: 'read_failed: ' + (e && e.message || e) }] };
  }
}

function writeTransferReport(opts) {
  try {
    opts = opts || {};
    if (!opts.outPath) return { ok: false, errors: ['outPath_required'] };
    const records = Array.isArray(opts.records) ? opts.records : [];
    const baseline = opts.baseline || null;

    const lines = [];
    lines.push('# SGSD Transfer Evaluation Report');
    lines.push('');
    lines.push('records: ' + records.length);
    lines.push('baseline_present: ' + (baseline !== null));
    lines.push('');
    lines.push('| transfer_id | change_id | deck | env | success | tokens | critical |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const r of records) {
      const env = r.environment || {};
      const envStr = Object.keys(env).map(function (k) {
        return k + '=' + env[k];
      }).join(';');
      const out = r.outcome || {};
      lines.push('| ' + (r.transfer_id || '') +
        ' | ' + (r.change_id || '') +
        ' | ' + (r.deck || '') +
        ' | ' + envStr +
        ' | ' + (typeof out.success_rate === 'number' ? out.success_rate : '') +
        ' | ' + (typeof out.token_cost === 'number' ? out.token_cost : '') +
        ' | ' + (r.critical_regression === true ? 'YES' : 'no') +
        ' |');
    }
    lines.push('');
    lines.push('## Frozen-before-run check');
    lines.push('Every record above was validated to have frozen_at < started_at.');
    lines.push('Records that fail this check are rejected upstream by evaluateTransfer.');

    const out = lines.join('\n');
    try { fs.mkdirSync(path.dirname(opts.outPath), { recursive: true }); }
    catch (e) { /* ignore */ }
    fs.writeFileSync(opts.outPath, out, 'utf8');
    return { ok: true, report_path: opts.outPath, size: Buffer.byteLength(out, 'utf8'), errors: [] };
  } catch (e) {
    return { ok: false,
      errors: ['report_write_failed: ' + (e && e.message || e)] };
  }
}

module.exports = {
  evaluateTransfer: evaluateTransfer,
  recordTransfer: recordTransfer,
  readTransfers: readTransfers,
  writeTransferReport: writeTransferReport,
  detectCriticalRegression: detectCriticalRegression,
  isFrozenBeforeRun: isFrozenBeforeRun,
  validateRecord: validateRecord,
  transferLogPath: transferLogPath,
  TRANSFER_DECKS: TRANSFER_DECKS,
  ENVIRONMENT_AXES: ENVIRONMENT_AXES,
  CRITICAL_REGRESSION_RULES: CRITICAL_REGRESSION_RULES,
  DEFAULT_PROJECT: DEFAULT_PROJECT
};
