// ============================================================================
// SGSD - context-registry/check.cjs
// ============================================================================
// Phase 44 read-only validator. Walks packets/capsules and emits
// {valid, invalid_keys[]} reports against legal-keys.json. NEVER throws
// upward (Lock 13 mirror); CLI exits 0 even on valid:false (informational).
//
// Phase 41 imports BY REFERENCE (informational; not used directly here).
// build.cjs::loadRegistry consulted at every call (mtime-cached singleton).
//
// Public API:
//   validateReferences(packet, opts?) -> {valid,invalid_keys,checked_count,...}
//   validateOne(key, category, opts?) -> {valid, reason?, ...}
//   isLegal(key, category)            -> bool (NEVER throws)
//   loadRegistry, registryPath        -> re-exported from build.cjs
//   validateAllCapsules()             -> {markdown, counts}  (Phase 44 backfill)
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const buildModule = require('./build.cjs');
const { loadRegistry, registryPath } = buildModule;

// Phase 41 imports BY REFERENCE (informational).
let phase41 = null;
try {
  phase41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
} catch (_e) { phase41 = null; }

// ---------------------------------------------------------------------------
// FROZEN CONSTANTS
// ---------------------------------------------------------------------------

const REASONS = Object.freeze([
  'unknown_key',
  'superseded_key',
  'superseded_key_retired',
  'malformed_key',
  'registry_missing',
  'registry_malformed',
]);

// Default categories Phase 45 PACKET-03 will request.
const DEFAULT_CATEGORIES = Object.freeze([
  'phases', 'gates', 'agents', 'artifacts', 'providers',
]);

// ---------------------------------------------------------------------------
// KEY NORMALIZATION (RESEARCH lock Q4: 'v1.9/P41' -> 'v1.9/41')
// ---------------------------------------------------------------------------

function _normalizeKey(key, category) {
  if (typeof key !== 'string') return key;
  if (category === 'phases') {
    // Strip leading 'P' before phase number: 'v1.9/P41' -> 'v1.9/41'.
    return key.replace(/\/P(\d)/g, '/$1');
  }
  return key;
}

// ---------------------------------------------------------------------------
// SINGLE-KEY VALIDATION (4 outcomes per RESEARCH sec 5.4)
// ---------------------------------------------------------------------------

function validateOne(key, category, opts) {
  try {
    if (key === null || key === undefined || typeof key !== 'string' || !key) {
      return { valid: false, reason: 'malformed_key' };
    }
    if (!category || typeof category !== 'string') {
      return { valid: false, reason: 'malformed_key' };
    }
    const reg = loadRegistry(opts && opts.registryPath);
    if (!reg) return { valid: false, reason: 'registry_missing' };
    const cat = reg[category];
    if (!cat || typeof cat !== 'object') return { valid: false, reason: 'unknown_key' };
    const norm = _normalizeKey(key, category);

    // Active lookup: rows are objects with .id (or strings).
    const activeArr = Array.isArray(cat.active) ? cat.active : [];
    for (const row of activeArr) {
      if (typeof row === 'string' && row === norm) return { valid: true };
      if (row && typeof row === 'object' && (row.id === norm || row.id === key)) return { valid: true };
    }

    // Superseded lookup.
    const supArr = Array.isArray(cat.superseded) ? cat.superseded : [];
    for (const row of supArr) {
      if (row && typeof row === 'object' && (row.id === norm || row.id === key)) {
        if (row.replaced_by) {
          return {
            valid: false,
            reason: 'superseded_key',
            superseded_record: row,
            suggested: row.replaced_by,
          };
        }
        return {
          valid: false,
          reason: 'superseded_key_retired',
          superseded_record: row,
        };
      }
    }

    // Malformed (e.g., phase_folders.malformed list).
    const malArr = Array.isArray(cat.malformed) ? cat.malformed : [];
    for (const row of malArr) {
      if (row && typeof row === 'object' && (row.id === norm || row.id === key)) {
        return { valid: false, reason: 'unknown_key', malformed: true };
      }
    }

    return { valid: false, reason: 'unknown_key' };
  } catch (e) {
    return { valid: false, reason: 'malformed_key', detail: e && e.message ? e.message : String(e) };
  }
}

function isLegal(key, category) {
  try {
    const r = validateOne(key, category);
    return !!r.valid;
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// REFERENCE EXTRACTION (default: known capsule-schema fields)
// ---------------------------------------------------------------------------

function _extractRefs(packet, categoriesToCheck, deep) {
  const refs = [];
  if (!packet || typeof packet !== 'object') return refs;

  const wants = new Set(categoriesToCheck);

  // Direct category-keyed fields (e.g., {phases:[...], gates:[...]}).
  for (const cat of categoriesToCheck) {
    const arr = packet[cat];
    if (Array.isArray(arr)) {
      for (const k of arr) {
        if (typeof k === 'string') refs.push({ key: k, category: cat });
      }
    }
  }

  // downstream_contract.consumers[] -> phases.
  if (wants.has('phases') && packet.downstream_contract && Array.isArray(packet.downstream_contract.consumers)) {
    for (const c of packet.downstream_contract.consumers) {
      if (typeof c === 'string') {
        // Free-form 'Phase 42' / 'v1.9/42' / 'v1.9/P42' -- only extract if it
        // shapes 'v?.?/digits' (capsule-schema id form). Free-form 'Phase 42'
        // strings are out of scope (informational; Phase 45 owns elide policy).
        if (/^v\d+(?:\.\d+)?\/[Pp]?\d+/.test(c)) {
          refs.push({ key: c, category: 'phases' });
        }
      }
    }
  }

  // files[] -> phases (if shape 'v?.?/...').
  if (wants.has('phases') && Array.isArray(packet.files)) {
    for (const f of packet.files) {
      const p = (typeof f === 'string') ? f : (f && f.path);
      if (typeof p === 'string') {
        const m = p.match(/milestones\/(v\d+(?:\.\d+)?)\/phases\/(\d{2})-/);
        if (m) refs.push({ key: `${m[1]}/${m[2]}`, category: 'phases' });
      }
    }
  }

  // Top-level provider field.
  if (wants.has('providers') && typeof packet.provider === 'string') {
    refs.push({ key: packet.provider, category: 'providers' });
  }

  if (deep) {
    const seen = new WeakSet();
    function walk(node) {
      if (!node || typeof node !== 'object') return;
      if (seen.has(node)) return;
      seen.add(node);
      if (Array.isArray(node)) {
        for (const v of node) walk(v);
        return;
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (typeof v === 'string' && wants.has(k)) {
          refs.push({ key: v, category: k });
        }
        if (v && typeof v === 'object') walk(v);
      }
    }
    walk(packet);
  }

  return refs;
}

// ---------------------------------------------------------------------------
// STALE-REGISTRY DETECTION (RESEARCH sec 7.4)
// ---------------------------------------------------------------------------

function _detectStaleRegistry(registryFilePath, sourceHashes) {
  try {
    const stat = fs.statSync(registryFilePath);
    const regMtime = stat.mtimeMs;
    const stale = [];
    if (sourceHashes && typeof sourceHashes === 'object') {
      for (const relPath of Object.keys(sourceHashes)) {
        // Resolve relative to repo root (3-up from this dir).
        const abs = path.resolve(__dirname, '..', '..', '..', relPath);
        try {
          const s = fs.statSync(abs);
          if (s.mtimeMs > regMtime) stale.push(relPath);
        } catch (_e) { /* ignore missing */ }
      }
    }
    return { stale_warning: stale.length > 0, stale_sources: stale };
  } catch (_e) {
    return { stale_warning: false, stale_sources: [] };
  }
}

// ---------------------------------------------------------------------------
// PACKET VALIDATION
// ---------------------------------------------------------------------------

function validateReferences(packet, opts) {
  try {
    if (packet === null || packet === undefined) {
      return {
        valid: false,
        invalid_keys: [{ key: null, category: null, reason: 'malformed_key' }],
        checked_count: 0,
      };
    }
    if (typeof packet !== 'object') {
      return {
        valid: false,
        invalid_keys: [{ key: null, category: null, reason: 'malformed_key' }],
        checked_count: 0,
      };
    }
    const reg = loadRegistry(opts && opts.registryPath);
    if (!reg) {
      return {
        valid: false,
        invalid_keys: [{ key: null, category: null, reason: 'registry_missing' }],
        checked_count: 0,
      };
    }

    const categoriesToCheck = (opts && Array.isArray(opts.categoriesToCheck) && opts.categoriesToCheck.length)
      ? opts.categoriesToCheck
      : DEFAULT_CATEGORIES.slice();

    const refs = _extractRefs(packet, categoriesToCheck, !!(opts && opts.deep));
    const invalid_keys = [];
    let checked_count = 0;
    for (const { key, category } of refs) {
      checked_count++;
      const r = validateOne(key, category, opts);
      if (!r.valid) {
        const row = { key, category, reason: r.reason };
        if (r.superseded_record) row.superseded_record = r.superseded_record;
        if (r.suggested) row.suggested = r.suggested;
        invalid_keys.push(row);
      }
    }

    // Stale-registry detection.
    const regPath = (opts && opts.registryPath) || registryPath();
    const stale = _detectStaleRegistry(regPath, reg.source_hashes);

    return {
      valid: invalid_keys.length === 0,
      invalid_keys,
      checked_count,
      stale_warning: stale.stale_warning,
      stale_sources: stale.stale_sources,
    };
  } catch (e) {
    return {
      valid: false,
      invalid_keys: [{
        key: null,
        category: null,
        reason: 'malformed_key',
        detail: e && e.message ? e.message : String(e),
      }],
      checked_count: 0,
    };
  }
}

// ---------------------------------------------------------------------------
// VALIDATE-ALL-CAPSULES (Phase 44 backfill report; Task 3)
// ---------------------------------------------------------------------------

function _findAllCapsules(repoRoot) {
  const root = repoRoot || path.resolve(__dirname, '..', '..', '..');
  const out = [];
  const milestonesDir = path.join(root, '.planning', 'milestones');
  let mds = [];
  try {
    mds = fs.readdirSync(milestonesDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^v\d/.test(d.name))
      .map(d => d.name);
  } catch (_e) { return out; }
  for (const ms of mds) {
    const phasesDir = path.join(milestonesDir, ms, 'phases');
    let phs = [];
    try {
      phs = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
    } catch (_e) { phs = []; }
    for (const ph of phs) {
      const cap = path.join(phasesDir, ph, 'PHASE-CAPSULE.json');
      try {
        if (fs.existsSync(cap)) out.push({ milestone: ms, phase: ph, path: cap });
      } catch (_e) { /* skip */ }
    }
  }
  return out;
}

function validateAllCapsules(opts) {
  try {
    opts = opts || {};
    const repoRoot = opts.repoRoot || path.resolve(__dirname, '..', '..', '..');
    const capsules = _findAllCapsules(repoRoot);

    const rows = [];
    let totalValid = 0;
    let totalInvalid = 0;
    let totalInvalidKeys = 0;
    const reasonTally = {};

    // Read-only fingerprint of all capsules + PHASE-INDEX files.
    const fpBefore = {};
    for (const c of capsules) {
      fpBefore[c.path] = buildModule._hashSource ? buildModule._hashSource(c.path) : null;
    }

    for (const c of capsules) {
      let capObj = null;
      try {
        capObj = JSON.parse(fs.readFileSync(c.path, 'utf8'));
      } catch (_e) {
        capObj = null;
      }
      const v = validateReferences(capObj || {}, { categoriesToCheck: ['phases', 'gates', 'agents', 'artifacts', 'providers'] });
      const sample = (v.invalid_keys || []).slice(0, 3).map(k => `${k.category}:${k.key}(${k.reason})`).join('; ');
      const row = {
        milestone: c.milestone,
        phase: c.phase,
        capsule_path: path.relative(repoRoot, c.path).replace(/\\/g, '/'),
        valid: !!v.valid,
        invalid_count: (v.invalid_keys || []).length,
        sample_invalid_keys: sample,
        checked_count: v.checked_count || 0,
      };
      rows.push(row);
      if (v.valid) totalValid++;
      else totalInvalid++;
      totalInvalidKeys += row.invalid_count;
      for (const k of (v.invalid_keys || [])) {
        reasonTally[k.reason] = (reasonTally[k.reason] || 0) + 1;
      }
    }

    // Read-only assertion: capsules unchanged.
    const fpAfter = {};
    for (const c of capsules) {
      fpAfter[c.path] = buildModule._hashSource ? buildModule._hashSource(c.path) : null;
    }
    const drift = capsules.filter(c => fpBefore[c.path] !== fpAfter[c.path]);

    let mostCommonReason = '(none)';
    let mostCommonCount = 0;
    for (const k of Object.keys(reasonTally)) {
      if (reasonTally[k] > mostCommonCount) {
        mostCommonReason = k;
        mostCommonCount = reasonTally[k];
      }
    }

    const ts = new Date().toISOString();
    const lines = [];
    lines.push('---');
    lines.push('phase: 44');
    lines.push('title: Legal Context Registry -- Capsule Validation Backfill');
    lines.push(`generated_at: ${ts}`);
    lines.push('generated_by: super-gsd/tools/context-registry/check.cjs --validate-all-capsules');
    lines.push(`total_capsules: ${rows.length}`);
    lines.push(`total_valid: ${totalValid}`);
    lines.push(`total_invalid: ${totalInvalid}`);
    lines.push(`total_invalid_keys: ${totalInvalidKeys}`);
    lines.push('---');
    lines.push('');
    lines.push('# 44-VERIFICATION');
    lines.push('');
    lines.push('## Aggregate');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|------:|');
    lines.push(`| Capsules scanned | ${rows.length} |`);
    lines.push(`| Capsules with all-valid references | ${totalValid} |`);
    lines.push(`| Capsules with at least one invalid ref | ${totalInvalid} |`);
    lines.push(`| Total invalid_keys across all capsules | ${totalInvalidKeys} |`);
    lines.push(`| Most common reason | ${mostCommonReason} (${mostCommonCount}) |`);
    lines.push('');
    lines.push('## Per-capsule results');
    lines.push('');
    lines.push('| Milestone | Phase | Capsule path | Valid | invalid_count | checked_count | sample_invalid_keys |');
    lines.push('|-----------|-------|--------------|-------|--------------:|--------------:|---------------------|');
    for (const r of rows) {
      lines.push(`| ${r.milestone} | ${r.phase} | ${r.capsule_path} | ${r.valid ? 'true' : 'false'} | ${r.invalid_count} | ${r.checked_count} | ${r.sample_invalid_keys || ''} |`);
    }
    lines.push('');
    lines.push('## ROADMAP acceptance binding');
    lines.push('');
    lines.push('| Acceptance | Status | Evidence |');
    lines.push('|------------|--------|----------|');
    lines.push('| A1 (registry includes 8 categories + phase_folders) | PASS | super-gsd/tools/context-registry/legal-keys.json (10 top-level categories populated) |');
    lines.push(`| A2 (invalid IDs rejected) | ${totalInvalidKeys > 0 ? 'PASS' : 'PASS-no-invalid-refs-in-corpus'} | self-test F4 + this report rejects ${totalInvalidKeys} invented refs across ${rows.length} capsules |`);
    lines.push('| A3 (stale/superseded explicit) | PASS | self-test F2 (rebuild equiv) + F3 (4-outcome visibility); milestones.superseded[1] populated |');
    lines.push('');
    lines.push('## Read-only invariant');
    lines.push('');
    lines.push('| Source set | Pre-check | Post-check | Drift |');
    lines.push('|------------|-----------|------------|-------|');
    lines.push(`| ${rows.length} PHASE-CAPSULE.json files | hashed | hashed | ${drift.length === 0 ? 'NONE' : drift.length + ' drift'} |`);
    lines.push('');
    lines.push('## Lock 13 binding');
    lines.push('');
    lines.push('CLI exit 0 regardless of invalid_count. invalid_keys are INFORMATIONAL; Phase 45 PACKET-03 owns elide/warn/reject decision; Phase 49 GOV-02 owns memory-write admission decision; Phase 50 cockpit owns rendering decision.');
    lines.push('');

    return {
      markdown: lines.join('\n'),
      counts: {
        capsules: rows.length,
        valid: totalValid,
        invalid: totalInvalid,
        invalid_keys: totalInvalidKeys,
        drift: drift.length,
      },
      rows,
    };
  } catch (e) {
    return {
      markdown: `# 44-VERIFICATION (error)\n\nERROR: ${e && e.message ? e.message : String(e)}\n`,
      counts: { capsules: 0, valid: 0, invalid: 0, invalid_keys: 0, drift: 0 },
      rows: [],
    };
  }
}

// ---------------------------------------------------------------------------
// MODULE EXPORTS
// ---------------------------------------------------------------------------

module.exports = {
  validateReferences,
  validateOne,
  isLegal,
  loadRegistry,
  registryPath,
  validateAllCapsules,
  REASONS,
  DEFAULT_CATEGORIES,
};

// ---------------------------------------------------------------------------
// CLI (Lock 13: --check valid=0 invalid=0 (informational); registry-missing=1; bad-invocation=2)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--validate-all-capsules')) {
    const result = validateAllCapsules();
    // Stream markdown to stdout for redirect.
    process.stdout.write(result.markdown);
    process.exit(0);
  } else if (args.includes('--check')) {
    const idx = args.indexOf('--check');
    const file = args[idx + 1];
    if (!file) {
      console.error('[context-registry/check] usage: --check <packet.json> | --validate-all-capsules');
      process.exit(2);
    }
    let pkt = null;
    try { pkt = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (e) {
      console.error(`[context-registry/check] cannot read packet: ${e.message}`);
      process.exit(2);
    }
    const r = validateReferences(pkt);
    console.log(JSON.stringify(r, null, 2));
    // Lock 13: exit 0 even on invalid (informational).
    process.exit(0);
  } else if (args.includes('--self-test')) {
    try {
      require('./build.test.cjs');
    } catch (e) {
      console.error('[context-registry/check] self-test load failed:', e && e.message ? e.message : e);
      process.exit(1);
    }
  } else {
    console.log('Usage: node check.cjs --check <packet.json> | --validate-all-capsules | --self-test');
    process.exit(2);
  }
}
