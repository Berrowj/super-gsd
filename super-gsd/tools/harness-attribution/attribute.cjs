// SGSD Harness Attribution -- Phase 101 (v2.9 AHE).
// Scores prior manifest predictions against next-run evidence.
// Lock-13: never throws. Public API returns {ok, verdict, fix_metrics,
// regression_metrics, rollback_recommendation, errors}.

'use strict';

const fs = require('fs');
const path = require('path');

const VERDICTS = Object.freeze([
  'keep',
  'revert',
  'quarantine',
  'pivot_component',
  'inconclusive',
  'environmental_skip'
]);

const DEFAULT_PROJECT = path.resolve(__dirname, '..', '..', '..');
const ATTRIBUTION_REL = path.join('.planning', 'metrics', 'harness-attribution.jsonl');

function attributionPath(projectDir) {
  return path.join(projectDir || DEFAULT_PROJECT, ATTRIBUTION_REL);
}

function asLabelSet(ev) {
  if (!ev || typeof ev !== 'object') return new Set();
  if (!Array.isArray(ev.labels)) return new Set();
  return new Set(ev.labels.filter(function (l) { return typeof l === 'string'; }));
}

function envOk(ev) {
  if (!ev || typeof ev !== 'object') return false;
  if (typeof ev.env !== 'string') return false;
  return ev.env === 'ok';
}

function computeFixMetrics(predicted, prevSet, nextSet) {
  let tp = 0, fn = 0, fp = 0;
  for (const lab of predicted) {
    const inPrev = prevSet.has(lab);
    const inNext = nextSet.has(lab);
    if (inPrev && !inNext) tp++;
    else if (inPrev && inNext) fn++;
    else if (!inPrev && !inNext) fp++;
    // !inPrev && inNext -> not a valid fix prediction (label appeared from nowhere)
  }
  const denomP = tp + fp;
  const denomR = tp + fn;
  return {
    tp: tp,
    fn: fn,
    fp: fp,
    precision: denomP === 0 ? null : tp / denomP,
    recall: denomR === 0 ? null : tp / denomR
  };
}

function computeRegressionMetrics(predicted, prevSet, nextSet) {
  let tp = 0, fn = 0, fp = 0;
  for (const lab of predicted) {
    const inPrev = prevSet.has(lab);
    const inNext = nextSet.has(lab);
    if (!inPrev && inNext) tp++;
    else if (inPrev && inNext) tp++; // already there, still there: counted
    else if (!inNext) fp++;
  }
  // Surprises: labels in next, not in prev, not predicted-as-fix-target,
  // not predicted-as-regression. These are FN -- missed regression risks.
  const surprises = [];
  for (const lab of nextSet) {
    if (!prevSet.has(lab) && !predicted.includes(lab)) {
      surprises.push(lab);
      fn++;
    }
  }
  const denomP = tp + fp;
  const denomR = tp + fn;
  return {
    tp: tp,
    fn: fn,
    fp: fp,
    surprises: surprises,
    precision: denomP === 0 ? null : tp / denomP,
    recall: denomR === 0 ? null : tp / denomR
  };
}

function pickVerdict(opts) {
  // Decision tree per RESEARCH D5.
  if (!opts.env_ok) return 'environmental_skip';
  const fixRecall = opts.fix.recall;
  const surprises = opts.regression.surprises.length;

  if (opts.repeated_same_class_failure) return 'pivot_component';
  if (fixRecall === 0 && surprises > 0) return 'revert';
  if (fixRecall === 1 && surprises === 0) return 'keep';
  if (fixRecall === null && surprises === 0) return 'inconclusive';
  if (fixRecall !== null && fixRecall < 1 && surprises === 0) return 'quarantine';
  return 'inconclusive';
}

function buildRollbackRecommendation(manifest) {
  return {
    action: 'git-revert',
    files: Array.isArray(manifest.files) ? manifest.files.slice() : [],
    change_id: manifest.change_id || null,
    manual_command: 'git revert <commit_ref_for_change_' +
      (manifest.change_id || 'unknown') + '>',
    note: 'Identify the commit that introduced this change_id and run git revert <hash>. Do not use --no-edit on shipped commits without operator approval.'
  };
}

// PUBLIC API -- Lock-13: never throws.
function attribute(input) {
  try {
    if (!input || typeof input !== 'object') {
      return { ok: false, verdict: null, errors: ['input_required'] };
    }
    const manifest = input.manifest;
    const prev = input.prevEvidence;
    const next = input.nextEvidence;
    const errors = [];

    if (!manifest || typeof manifest !== 'object') {
      errors.push('manifest_required');
    }
    if (!prev || typeof prev !== 'object') errors.push('prevEvidence_required');
    if (!next || typeof next !== 'object') errors.push('nextEvidence_required');
    if (errors.length > 0) {
      return { ok: false, verdict: null, errors: errors };
    }

    if (!Array.isArray(manifest.predicted_fixes)) {
      errors.push('manifest_predicted_fixes_must_be_array');
    }
    if (!Array.isArray(manifest.predicted_regressions)) {
      errors.push('manifest_predicted_regressions_must_be_array');
    }
    if (errors.length > 0) {
      return { ok: false, verdict: null, errors: errors };
    }

    const prevSet = asLabelSet(prev);
    const nextSet = asLabelSet(next);
    const env_ok = envOk(prev) && envOk(next);

    const fix = computeFixMetrics(manifest.predicted_fixes, prevSet, nextSet);
    const regression = computeRegressionMetrics(
      manifest.predicted_regressions, prevSet, nextSet);

    const verdict = pickVerdict({
      env_ok: env_ok,
      fix: fix,
      regression: regression,
      repeated_same_class_failure: !!input.repeated_same_class_failure
    });

    let rollback = null;
    if (verdict === 'revert') {
      rollback = buildRollbackRecommendation(manifest);
    }

    return {
      ok: true,
      verdict: verdict,
      change_id: manifest.change_id || null,
      component_id: manifest.component_id || null,
      component_class: manifest.component_class || null,
      env_ok: env_ok,
      fix_metrics: fix,
      regression_metrics: regression,
      rollback_recommendation: rollback,
      errors: []
    };
  } catch (e) {
    return { ok: false, verdict: null,
      errors: ['attribute_failed: ' + (e && e.message || e)] };
  }
}

function appendAttribution(record, opts) {
  try {
    if (!record || typeof record !== 'object') {
      return { ok: false, errors: ['record_required'] };
    }
    if (VERDICTS.indexOf(record.verdict) === -1) {
      return { ok: false, errors: ['verdict_invalid:' + record.verdict] };
    }
    if (typeof record.change_id !== 'string' || record.change_id.length === 0) {
      return { ok: false, errors: ['change_id_required'] };
    }
    const projectDir = (opts && opts.projectDir) || DEFAULT_PROJECT;
    const ap = attributionPath(projectDir);
    try { fs.mkdirSync(path.dirname(ap), { recursive: true }); }
    catch (e) { /* ignore */ }
    const annotated = Object.assign({}, record,
      { _appended_at: new Date().toISOString() });
    fs.appendFileSync(ap, JSON.stringify(annotated) + '\n', 'utf8');
    return { ok: true, errors: [], attribution_path: ap };
  } catch (e) {
    return { ok: false, errors: ['append_failed: ' + (e && e.message || e)] };
  }
}

function readAttributions(projectDir) {
  try {
    const ap = attributionPath(projectDir || DEFAULT_PROJECT);
    if (!fs.existsSync(ap)) return { ok: true, rows: [], errors: [] };
    const src = fs.readFileSync(ap, 'utf8');
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

function findUnattributedManifests(opts) {
  // For the milestone-close gate. Returns list of change_ids that have
  // no matching attribution row (or have attribution with verdict=revert
  // not yet acted on).
  try {
    const projectDir = (opts && opts.projectDir) || DEFAULT_PROJECT;
    let manifestRows = [];
    try {
      const m = require('../harness-manifest/manifest.cjs');
      const mr = m.readLedger(projectDir);
      if (mr.ok) manifestRows = mr.rows;
    } catch (e) { /* missing manifest module: nothing to attribute */ }

    const attributions = readAttributions(projectDir);
    const attributedById = {};
    if (attributions.ok) {
      for (const a of attributions.rows) {
        if (a && a.change_id) attributedById[a.change_id] = a;
      }
    }

    const unattributed = [];
    for (const m of manifestRows) {
      if (!m || !m.change_id) continue;
      const a = attributedById[m.change_id];
      if (!a) {
        unattributed.push({ change_id: m.change_id, reason: 'no_attribution' });
      } else if (a.verdict === 'revert' && !a.revert_applied) {
        unattributed.push({
          change_id: m.change_id,
          reason: 'revert_recommended_not_applied'
        });
      }
    }
    return { ok: true, unattributed: unattributed,
      total_manifests: manifestRows.length,
      total_attributions: attributions.rows.length };
  } catch (e) {
    return { ok: false, unattributed: [],
      errors: ['scan_failed: ' + (e && e.message || e)] };
  }
}

module.exports = {
  attribute: attribute,
  appendAttribution: appendAttribution,
  readAttributions: readAttributions,
  findUnattributedManifests: findUnattributedManifests,
  attributionPath: attributionPath,
  VERDICTS: VERDICTS,
  DEFAULT_PROJECT: DEFAULT_PROJECT,
  computeFixMetrics: computeFixMetrics,
  computeRegressionMetrics: computeRegressionMetrics,
  pickVerdict: pickVerdict
};
