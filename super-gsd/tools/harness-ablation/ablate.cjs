// SGSD Harness Ablation Runner -- Phase 103 (v2.9 AHE).
// Disables one component class at a time in a copied workspace, runs the
// benchmark, and records outcome + interference signals.
//
// Workspace isolation: ablation NEVER touches the main workspace.
// Lock-13: never throws across public API.
// Protected surfaces: cannot ablate oracle/verifier/model-config classes.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_PROJECT = path.resolve(__dirname, '..', '..', '..');
const ABLATION_LOG_REL = path.join(
  '.planning', 'metrics', 'harness-ablation.jsonl'
);

const INTERFERENCE_RULES = Object.freeze([
  'duplicate_verification',
  'redundant_gate_stack',
  'token_cost_inversion'
]);

function ablationLogPath(projectDir) {
  return path.join(projectDir || DEFAULT_PROJECT, ABLATION_LOG_REL);
}

function loadCatalog() {
  try { return require('../harness-components/catalog.cjs'); }
  catch (e) { return { _load_failed: true, _err: e && e.message || String(e) }; }
}

function validateAblationSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== 'object') {
    errors.push('spec_must_be_object');
    return errors;
  }
  if (typeof spec.ablation_id !== 'string' ||
      !/^ab-[a-z0-9-]+$/.test(spec.ablation_id)) {
    errors.push('ablation_id_invalid');
  }
  if (typeof spec.target_component_id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]*$/.test(spec.target_component_id)) {
    errors.push('target_component_id_invalid');
  }
  if (!Array.isArray(spec.target_files) || spec.target_files.length === 0) {
    errors.push('target_files_required');
  }
  if (typeof spec.expected_behavior !== 'string' ||
      spec.expected_behavior.length === 0) {
    errors.push('expected_behavior_required');
  }
  return errors;
}

function planAblation(opts) {
  try {
    opts = opts || {};
    const errs = validateAblationSpec(opts.spec);
    if (errs.length > 0) return { ok: false, errors: errs };

    const cat = loadCatalog();
    if (cat._load_failed) {
      return { ok: false, errors: ['catalog_unavailable:' + cat._err] };
    }
    const row = cat.findById(opts.spec.target_component_id);
    if (!row) {
      return { ok: false,
        errors: ['component_not_in_registry:' + opts.spec.target_component_id] };
    }
    if (row.protected === true ||
        cat.PROTECTED_CLASSES.includes(row.class)) {
      return { ok: false,
        errors: ['cannot_ablate_protected_surface:' + row.class] };
    }
    return {
      ok: true,
      ablation_spec: Object.assign({}, opts.spec, {
        component_class: row.class,
        component_paths: row.paths,
        planned_at: new Date().toISOString(),
        requires_transfer_eval: true
      }),
      errors: []
    };
  } catch (e) {
    return { ok: false, errors: ['plan_failed: ' + (e && e.message || e)] };
  }
}

function copyDirShallow(src, dest, errors) {
  // Lock-13: errors collected, never throws.
  try {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const ent of entries) {
      const s = path.join(src, ent.name);
      const d = path.join(dest, ent.name);
      try {
        if (ent.isDirectory()) {
          copyDirShallow(s, d, errors);
        } else if (ent.isFile()) {
          fs.copyFileSync(s, d);
        }
      } catch (e) {
        errors.push({ path: s, msg: 'copy_failed: ' + (e && e.message || e) });
      }
    }
  } catch (e) {
    errors.push({ path: src, msg: 'enumerate_failed: ' + (e && e.message || e) });
  }
}

function isolateWorkspace(opts) {
  try {
    opts = opts || {};
    const projectDir = opts.projectDir || DEFAULT_PROJECT;
    const ablationId = opts.ablation_id || ('ab-iso-' + Date.now());
    const tempDir = path.join(os.tmpdir(),
      'sgsd-ablation-' + ablationId + '-' + Math.floor(Math.random() * 1e6));
    const errors = [];

    fs.mkdirSync(tempDir, { recursive: true });

    // Copy minimal subset: only target files + their parent dirs.
    const renamed = [];
    const targets = Array.isArray(opts.target_files) ? opts.target_files : [];
    for (const rel of targets) {
      const src = path.join(projectDir, rel);
      const dest = path.join(tempDir, rel);
      try {
        if (!fs.existsSync(src)) {
          errors.push({ rel: rel, msg: 'target_missing' });
          continue;
        }
        const stat = fs.statSync(src);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (stat.isDirectory()) {
          copyDirShallow(src, dest, errors);
        } else {
          fs.copyFileSync(src, dest);
        }
        // Ablate by renaming to *.ablated
        const ablatedName = dest + '.ablated';
        fs.renameSync(dest, ablatedName);
        renamed.push({ rel: rel, ablated_path: ablatedName });
      } catch (e) {
        errors.push({ rel: rel, msg: 'isolate_failed: ' + (e && e.message || e) });
      }
    }

    return {
      ok: errors.length === 0 || renamed.length > 0,
      temp_dir: tempDir,
      files_renamed: renamed,
      errors: errors
    };
  } catch (e) {
    return { ok: false, temp_dir: null, files_renamed: [],
      errors: [{ msg: 'isolate_threw: ' + (e && e.message || e) }] };
  }
}

function restoreWorkspace(opts) {
  // Lock-13: cleans up temp dir; main workspace was never touched.
  try {
    opts = opts || {};
    if (!opts.temp_dir) return { ok: false, errors: ['temp_dir_required'] };
    if (typeof opts.temp_dir !== 'string') {
      return { ok: false, errors: ['temp_dir_must_be_string'] };
    }
    if (opts.temp_dir.indexOf(os.tmpdir()) !== 0) {
      return { ok: false,
        errors: ['refused_outside_tmpdir:' + opts.temp_dir] };
    }
    fs.rmSync(opts.temp_dir, { recursive: true, force: true });
    return { ok: true, errors: [] };
  } catch (e) {
    return { ok: false,
      errors: ['restore_failed: ' + (e && e.message || e)] };
  }
}

function recordAblation(record, opts) {
  try {
    if (!record || typeof record !== 'object') {
      return { ok: false, errors: ['record_required'] };
    }
    if (typeof record.ablation_id !== 'string') {
      return { ok: false, errors: ['ablation_id_required'] };
    }
    const projectDir = (opts && opts.projectDir) || DEFAULT_PROJECT;
    const lp = ablationLogPath(projectDir);
    try { fs.mkdirSync(path.dirname(lp), { recursive: true }); }
    catch (e) { /* ignore */ }
    const annotated = Object.assign({}, record,
      { _appended_at: new Date().toISOString() });
    fs.appendFileSync(lp, JSON.stringify(annotated) + '\n', 'utf8');
    return { ok: true, errors: [], ablation_log_path: lp };
  } catch (e) {
    return { ok: false,
      errors: ['record_failed: ' + (e && e.message || e)] };
  }
}

function detectInterference(baseline, ablated) {
  try {
    const signals = [];
    if (!baseline || !ablated || typeof baseline !== 'object' ||
        typeof ablated !== 'object') {
      return { ok: false,
        signals: [], errors: ['baseline_and_ablated_required'] };
    }

    // Rule: duplicate_verification -- same root_cause label appears in both
    // with same frequency (component didn't actually contribute).
    const bLabels = baseline.labels || {};
    const aLabels = ablated.labels || {};
    for (const lab of Object.keys(bLabels)) {
      if (bLabels[lab] === aLabels[lab] && bLabels[lab] > 0) {
        signals.push({
          rule: 'duplicate_verification',
          label: lab,
          baseline_count: bLabels[lab],
          ablated_count: aLabels[lab]
        });
      }
    }

    // Rule: redundant_gate_stack -- ablated runs N% faster with same outcomes.
    if (typeof baseline.runtime_ms === 'number' &&
        typeof ablated.runtime_ms === 'number') {
      const speedup = (baseline.runtime_ms - ablated.runtime_ms) /
        baseline.runtime_ms;
      if (speedup >= 0.10 && baseline.failures === ablated.failures) {
        signals.push({
          rule: 'redundant_gate_stack',
          baseline_ms: baseline.runtime_ms,
          ablated_ms: ablated.runtime_ms,
          speedup_ratio: speedup
        });
      }
    }

    // Rule: token_cost_inversion -- ablation REDUCES tokens (component was burning).
    if (typeof baseline.token_cost === 'number' &&
        typeof ablated.token_cost === 'number') {
      if (ablated.token_cost < baseline.token_cost) {
        signals.push({
          rule: 'token_cost_inversion',
          baseline_tokens: baseline.token_cost,
          ablated_tokens: ablated.token_cost,
          delta: ablated.token_cost - baseline.token_cost
        });
      }
    }

    return { ok: true, signals: signals, errors: [] };
  } catch (e) {
    return { ok: false, signals: [],
      errors: ['detect_failed: ' + (e && e.message || e)] };
  }
}

module.exports = {
  planAblation: planAblation,
  isolateWorkspace: isolateWorkspace,
  restoreWorkspace: restoreWorkspace,
  recordAblation: recordAblation,
  detectInterference: detectInterference,
  validateAblationSpec: validateAblationSpec,
  ablationLogPath: ablationLogPath,
  INTERFERENCE_RULES: INTERFERENCE_RULES,
  DEFAULT_PROJECT: DEFAULT_PROJECT
};
