// SGSD Harness Change Manifest -- Phase 100 (v2.9 AHE).
// Append-only JSONL ledger of falsifiable harness-edit predictions.
// Lock-13: never throws across boundary. Public API returns {ok, ...}.

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;
const DEFAULT_PROJECT = path.resolve(__dirname, '..', '..', '..');
const LEDGER_REL = path.join('.planning', 'metrics', 'harness-change-manifest.jsonl');

const COMPONENT_CLASSES = Object.freeze([
  'prompt', 'tool', 'middleware_hook', 'skill', 'agent_config',
  'memory', 'workflow', 'mcp_bridge', 'gate', 'dashboard', 'docs',
  'protected_oracle', 'protected_verifier', 'protected_model_config'
]);

const PROTECTED_CLASSES = Object.freeze([
  'protected_oracle', 'protected_verifier', 'protected_model_config'
]);

const ROOT_CAUSES = Object.freeze([
  'state_projection_drift', 'missing_context_packet',
  'provider_unavailable', 'gate_false_negative', 'gate_false_positive',
  'token_budget_breach', 'duplicate_verification',
  'incomplete_artifact', 'hidden_fault_uncaught',
  'successful_recovery_pattern', 'unknown'
]);

const ROLLBACK_METHODS = Object.freeze([
  'git-revert', 'manual-edit-restore', 'operator-manual', 'none'
]);

const REQUIRED_FIELDS = Object.freeze([
  'schema_version', 'change_id', 'component_id', 'component_class',
  'files', 'evidence_ids', 'root_cause', 'targeted_fix',
  'predicted_fixes', 'predicted_regressions',
  'expected_token_delta', 'expected_gate_delta',
  'rollback_method', 'protected_surface_check'
]);

function ledgerPath(projectDir) {
  return path.join(projectDir || DEFAULT_PROJECT, LEDGER_REL);
}

function validateEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== 'object') {
    errors.push('entry_must_be_object');
    return errors;
  }
  for (const f of REQUIRED_FIELDS) {
    if (!(f in entry)) errors.push('missing_required:' + f);
  }
  if (entry.schema_version !== SCHEMA_VERSION) {
    errors.push('schema_version_must_be_' + SCHEMA_VERSION);
  }
  if (entry.change_id !== undefined) {
    if (typeof entry.change_id !== 'string' ||
        !/^ch-[a-z0-9-]+$/.test(entry.change_id) ||
        entry.change_id.length < 5 || entry.change_id.length > 80) {
      errors.push('change_id_invalid');
    }
  }
  if (entry.component_id !== undefined) {
    if (typeof entry.component_id !== 'string' ||
        !/^[a-z0-9][a-z0-9-]*$/.test(entry.component_id)) {
      errors.push('component_id_invalid');
    }
  }
  if (entry.component_class !== undefined &&
      !COMPONENT_CLASSES.includes(entry.component_class)) {
    errors.push('component_class_invalid:' + entry.component_class);
  }
  if (entry.root_cause !== undefined && !ROOT_CAUSES.includes(entry.root_cause)) {
    errors.push('root_cause_invalid:' + entry.root_cause);
  }
  if (entry.rollback_method !== undefined &&
      !ROLLBACK_METHODS.includes(entry.rollback_method)) {
    errors.push('rollback_method_invalid:' + entry.rollback_method);
  }
  if (entry.files !== undefined) {
    if (!Array.isArray(entry.files) || entry.files.length === 0) {
      errors.push('files_must_be_nonempty_array');
    }
  }
  if (entry.evidence_ids !== undefined) {
    if (!Array.isArray(entry.evidence_ids) || entry.evidence_ids.length === 0) {
      errors.push('evidence_ids_must_be_nonempty_array');
    }
  }
  if (entry.predicted_fixes !== undefined) {
    if (!Array.isArray(entry.predicted_fixes) || entry.predicted_fixes.length === 0) {
      errors.push('predicted_fixes_must_be_nonempty_array');
    }
  }
  if (entry.predicted_regressions !== undefined) {
    if (!Array.isArray(entry.predicted_regressions)) {
      errors.push('predicted_regressions_must_be_array');
    }
  }
  if (entry.expected_token_delta !== undefined &&
      !Number.isInteger(entry.expected_token_delta)) {
    errors.push('expected_token_delta_must_be_integer');
  }
  if (entry.expected_gate_delta !== undefined &&
      !Number.isInteger(entry.expected_gate_delta)) {
    errors.push('expected_gate_delta_must_be_integer');
  }
  if (entry.protected_surface_check !== undefined &&
      entry.protected_surface_check !== 'true' &&
      entry.protected_surface_check !== 'false') {
    errors.push('protected_surface_check_must_be_string_true_or_false');
  }
  if (entry.targeted_fix !== undefined) {
    if (typeof entry.targeted_fix !== 'string' ||
        entry.targeted_fix.length === 0 ||
        entry.targeted_fix.length > 240) {
      errors.push('targeted_fix_invalid');
    }
  }

  // Cross-field rule: protected class without operator_override_id rejected.
  const isProtected = PROTECTED_CLASSES.includes(entry.component_class);
  const declared = entry.protected_surface_check === 'true';
  if (isProtected || declared) {
    if (typeof entry.operator_override_id !== 'string' ||
        entry.operator_override_id.length === 0) {
      errors.push('protected_surface_requires_operator_override_id');
    }
  }
  return errors;
}

function readLedger(projectDir) {
  try {
    const lp = ledgerPath(projectDir);
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
    return { ok: false, rows: [], errors: [{ msg: 'read_failed: ' + (e && e.message || e) }] };
  }
}

function appendEntry(entry, opts) {
  opts = opts || {};
  try {
    const projectDir = opts.projectDir || DEFAULT_PROJECT;
    const errs = validateEntry(entry);
    if (errs.length > 0) {
      return { ok: false, errors: errs };
    }

    // Idempotency: reject if change_id already present.
    const cur = readLedger(projectDir);
    if (cur.ok) {
      for (const r of cur.rows) {
        if (r && r.change_id === entry.change_id) {
          return { ok: false, errors: ['duplicate_change_id:' + entry.change_id] };
        }
      }
    }

    const lp = ledgerPath(projectDir);
    const dir = path.dirname(lp);
    try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }

    // Annotate with append timestamp (do not mutate caller's object).
    const annotated = Object.assign({}, entry, {
      _appended_at: new Date().toISOString()
    });
    fs.appendFileSync(lp, JSON.stringify(annotated) + '\n', 'utf8');
    return { ok: true, errors: [], change_id: entry.change_id, ledger_path: lp };
  } catch (e) {
    return { ok: false, errors: ['append_failed: ' + (e && e.message || e)] };
  }
}

function findByChangeId(change_id, opts) {
  const r = readLedger((opts && opts.projectDir) || DEFAULT_PROJECT);
  if (!r.ok) return null;
  return r.rows.find(function (x) { return x && x.change_id === change_id; }) || null;
}

function filterByComponentId(component_id, opts) {
  const r = readLedger((opts && opts.projectDir) || DEFAULT_PROJECT);
  if (!r.ok) return [];
  return r.rows.filter(function (x) { return x && x.component_id === component_id; });
}

module.exports = {
  validateEntry: validateEntry,
  appendEntry: appendEntry,
  readLedger: readLedger,
  findByChangeId: findByChangeId,
  filterByComponentId: filterByComponentId,
  ledgerPath: ledgerPath,
  SCHEMA_VERSION: SCHEMA_VERSION,
  COMPONENT_CLASSES: COMPONENT_CLASSES,
  PROTECTED_CLASSES: PROTECTED_CLASSES,
  ROOT_CAUSES: ROOT_CAUSES,
  ROLLBACK_METHODS: ROLLBACK_METHODS,
  REQUIRED_FIELDS: REQUIRED_FIELDS
};
