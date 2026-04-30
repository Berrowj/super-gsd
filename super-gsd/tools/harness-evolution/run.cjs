// SGSD Harness Evolution Runner -- Phase 102 (v2.9 AHE).
// Outer loop: evaluate -> distill -> propose -> route bounded edit -> test
//                                   -> commit candidate.
// 4 modes: dry-run, proposal-only, apply-candidate, attribute-only.
// Lock-13: never throws across public API.
// Hard boundary: never reads protected oracle paths into model context.

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_PROJECT = path.resolve(__dirname, '..', '..', '..');
const EVOLUTION_LOG_REL = path.join(
  '.planning', 'metrics', 'harness-evolution-log.jsonl'
);

function logPath(projectDir) {
  return path.join(projectDir || DEFAULT_PROJECT, EVOLUTION_LOG_REL);
}

function loadModule(rel) {
  try { return require(rel); } catch (e) {
    return { _load_failed: true, _err: e && e.message || String(e) };
  }
}

function loadCatalog() { return loadModule('../harness-components/catalog.cjs'); }
function loadManifest() { return loadModule('../harness-manifest/manifest.cjs'); }
function loadAttribution() { return loadModule('../harness-attribution/attribute.cjs'); }
function loadDistill() { return loadModule('../harness-evidence/distill.cjs'); }

function appendEvolutionEvent(record, opts) {
  try {
    const projectDir = (opts && opts.projectDir) || DEFAULT_PROJECT;
    const lp = logPath(projectDir);
    try { fs.mkdirSync(path.dirname(lp), { recursive: true }); } catch (e) { /* ignore */ }
    const annotated = Object.assign({ ts: new Date().toISOString() }, record);
    fs.appendFileSync(lp, JSON.stringify(annotated) + '\n', 'utf8');
    return { ok: true };
  } catch (e) {
    return { ok: false, errors: ['log_append_failed: ' + (e && e.message || e)] };
  }
}

function readSpec(specPath) {
  try {
    if (!specPath) return { ok: false, errors: ['spec_path_required'] };
    if (!fs.existsSync(specPath)) {
      return { ok: false, errors: ['spec_not_found:' + specPath] };
    }
    const src = fs.readFileSync(specPath, 'utf8');
    const obj = JSON.parse(src);
    return { ok: true, spec: obj };
  } catch (e) {
    return { ok: false, errors: ['spec_parse_failed: ' + (e && e.message || e)] };
  }
}

function specToManifestEntry(spec) {
  return {
    schema_version: 1,
    change_id: spec.change_id,
    component_id: spec.component_id,
    component_class: spec.component_class || 'tool',
    files: spec.files || [],
    evidence_ids: spec.evidence_ids || [],
    root_cause: spec.root_cause || 'unknown',
    targeted_fix: spec.targeted_fix || '',
    predicted_fixes: spec.predicted_fixes || [],
    predicted_regressions: spec.predicted_regressions || [],
    expected_token_delta: typeof spec.expected_token_delta === 'number'
      ? spec.expected_token_delta : 0,
    expected_gate_delta: typeof spec.expected_gate_delta === 'number'
      ? spec.expected_gate_delta : 0,
    rollback_method: spec.rollback_method || 'git-revert',
    protected_surface_check: spec.protected_surface_check || 'false',
    operator_override_id: spec.operator_override_id || null
  };
}

function protectedSurfaceCheck(spec, opts) {
  // Returns { allowed: bool, reason }.
  const cat = loadCatalog();
  if (cat._load_failed) {
    return { allowed: false,
      reason: 'catalog_unavailable:' + cat._err };
  }
  const row = cat.findById(spec.component_id);
  if (!row) {
    return { allowed: false,
      reason: 'component_not_in_registry:' + spec.component_id };
  }
  const isProtected = row.protected === true ||
    cat.PROTECTED_CLASSES.includes(row.class);
  if (isProtected) {
    if (typeof spec.operator_override_id !== 'string' ||
        spec.operator_override_id.length === 0) {
      return { allowed: false,
        reason: 'protected_surface_requires_override:' + row.class };
    }
  }
  // Reject any file in the spec that appears in a protected row's paths.
  const allRows = cat.loadRegistry();
  if (allRows.ok) {
    const protectedPaths = new Set();
    for (const r of allRows.rows) {
      if (r && r.protected === true && Array.isArray(r.paths)) {
        for (const p of r.paths) protectedPaths.add(p);
      }
    }
    for (const f of spec.files || []) {
      if (protectedPaths.has(f)) {
        return { allowed: false,
          reason: 'protected_path_in_files:' + f };
      }
    }
  }
  return { allowed: true, reason: 'ok', component_row: row };
}

// PUBLIC API -- Lock-13: never throws.

function runDryRun(opts) {
  try {
    opts = opts || {};
    const projectDir = opts.projectDir || DEFAULT_PROJECT;
    const sp = readSpec(opts.specPath);
    if (!sp.ok) return { ok: false, errors: sp.errors };

    const cat = loadCatalog();
    if (cat._load_failed) {
      return { ok: false, errors: ['catalog_unavailable'] };
    }
    const row = cat.findById(sp.spec.component_id);

    const proposal = {
      mode: 'dry-run',
      change_id: sp.spec.change_id || null,
      component_id: sp.spec.component_id || null,
      component_known: row !== null,
      protected: row ? (row.protected === true) : null,
      files: sp.spec.files || [],
      predicted_fixes: sp.spec.predicted_fixes || [],
      predicted_regressions: sp.spec.predicted_regressions || []
    };

    appendEvolutionEvent({
      mode: 'dry-run', change_id: proposal.change_id,
      outcome: 'dry-run-printed',
      component_id: proposal.component_id
    }, { projectDir: projectDir });

    return { ok: true, proposal_summary: proposal, errors: [] };
  } catch (e) {
    return { ok: false, errors: ['dry_run_failed: ' + (e && e.message || e)] };
  }
}

function runProposalOnly(opts) {
  try {
    opts = opts || {};
    const projectDir = opts.projectDir || DEFAULT_PROJECT;
    const sp = readSpec(opts.specPath);
    if (!sp.ok) return { ok: false, errors: sp.errors };

    const guard = protectedSurfaceCheck(sp.spec, { projectDir: projectDir });
    if (!guard.allowed) {
      appendEvolutionEvent({
        mode: 'proposal-only', change_id: sp.spec.change_id,
        outcome: 'refused', reason: guard.reason
      }, { projectDir: projectDir });
      return { ok: false, errors: ['refused:' + guard.reason] };
    }

    const m = loadManifest();
    if (m._load_failed) {
      return { ok: false, errors: ['manifest_unavailable:' + m._err] };
    }
    const entry = specToManifestEntry(sp.spec);
    const r = m.appendEntry(entry, { projectDir: projectDir });
    appendEvolutionEvent({
      mode: 'proposal-only', change_id: entry.change_id,
      outcome: r.ok ? 'manifest-appended' : 'manifest-rejected',
      errors: r.errors || []
    }, { projectDir: projectDir });
    return { ok: r.ok, change_id: entry.change_id, errors: r.errors || [] };
  } catch (e) {
    return { ok: false, errors: ['proposal_only_failed: ' + (e && e.message || e)] };
  }
}

function runApplyCandidate(opts) {
  try {
    opts = opts || {};
    const projectDir = opts.projectDir || DEFAULT_PROJECT;
    const sp = readSpec(opts.specPath);
    if (!sp.ok) return { ok: false, errors: sp.errors };

    const guard = protectedSurfaceCheck(sp.spec, { projectDir: projectDir });
    if (!guard.allowed) {
      appendEvolutionEvent({
        mode: 'apply-candidate', change_id: sp.spec.change_id,
        outcome: 'refused', reason: guard.reason
      }, { projectDir: projectDir });
      return { ok: false, errors: ['refused:' + guard.reason] };
    }

    // Default: route-only, no edit applied. --commit flag would
    // dispatch the actual executor; runner stays conservative.
    const route_decision = {
      mode: 'route-only',
      task_id: 'evolution-' + sp.spec.change_id,
      chosen_provider: opts.mockProvider || null,
      note: 'apply-candidate route stub. Full apply pending --commit flag.'
    };

    appendEvolutionEvent({
      mode: 'apply-candidate', change_id: sp.spec.change_id,
      outcome: 'route-stub',
      provider: route_decision.chosen_provider
    }, { projectDir: projectDir });

    return { ok: true, change_id: sp.spec.change_id,
      route_decision: route_decision, errors: [] };
  } catch (e) {
    return { ok: false, errors: ['apply_candidate_failed: ' + (e && e.message || e)] };
  }
}

function runAttributeOnly(opts) {
  try {
    opts = opts || {};
    const projectDir = opts.projectDir || DEFAULT_PROJECT;
    const a = loadAttribution();
    if (a._load_failed) {
      return { ok: false, errors: ['attribution_unavailable:' + a._err] };
    }
    if (!opts.manifest || !opts.prevEvidence || !opts.nextEvidence) {
      return { ok: false, errors: ['attribute_inputs_required'] };
    }
    const r = a.attribute({
      manifest: opts.manifest,
      prevEvidence: opts.prevEvidence,
      nextEvidence: opts.nextEvidence,
      repeated_same_class_failure: !!opts.repeated_same_class_failure
    });
    appendEvolutionEvent({
      mode: 'attribute-only',
      change_id: opts.manifest.change_id,
      outcome: r.ok ? r.verdict : 'attribute-failed'
    }, { projectDir: projectDir });
    return r;
  } catch (e) {
    return { ok: false, errors: ['attribute_only_failed: ' + (e && e.message || e)] };
  }
}

module.exports = {
  runDryRun: runDryRun,
  runProposalOnly: runProposalOnly,
  runApplyCandidate: runApplyCandidate,
  runAttributeOnly: runAttributeOnly,
  protectedSurfaceCheck: protectedSurfaceCheck,
  specToManifestEntry: specToManifestEntry,
  appendEvolutionEvent: appendEvolutionEvent,
  logPath: logPath,
  DEFAULT_PROJECT: DEFAULT_PROJECT
};

// CLI entry
if (require.main === module) {
  const argv = process.argv.slice(2);
  const opts = {};
  let mode = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') mode = 'dry';
    else if (a === '--proposal-only') mode = 'prop';
    else if (a === '--apply-candidate') mode = 'apply';
    else if (a === '--attribute-only') mode = 'attr';
    else if (a === '--candidate-spec') opts.specPath = argv[++i];
    else if (a === '--project') opts.projectDir = argv[++i];
    else if (a === '--manifest-file') opts.manifestFile = argv[++i];
    else if (a === '--prev-evidence') opts.prevEvidenceFile = argv[++i];
    else if (a === '--next-evidence') opts.nextEvidenceFile = argv[++i];
  }
  let r;
  try {
    if (mode === 'dry') r = runDryRun(opts);
    else if (mode === 'prop') r = runProposalOnly(opts);
    else if (mode === 'apply') r = runApplyCandidate(opts);
    else if (mode === 'attr') {
      // Read inputs from disk if files supplied
      const m = opts.manifestFile ? JSON.parse(fs.readFileSync(opts.manifestFile, 'utf8')) : null;
      const p = opts.prevEvidenceFile ? JSON.parse(fs.readFileSync(opts.prevEvidenceFile, 'utf8')) : null;
      const n = opts.nextEvidenceFile ? JSON.parse(fs.readFileSync(opts.nextEvidenceFile, 'utf8')) : null;
      r = runAttributeOnly(Object.assign({}, opts, {
        manifest: m, prevEvidence: p, nextEvidence: n
      }));
    } else {
      r = { ok: false, errors: ['no_mode_specified'] };
    }
  } catch (e) {
    r = { ok: false, errors: ['cli_failed: ' + (e && e.message || e)] };
  }
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}
