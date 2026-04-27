// ============================================================================
// SGSD - context-registry/build.cjs
// ============================================================================
// Phase 44 Legal Context Registry: canonical-source walker + writer for the
// projection legal-keys.json. Reads 13 canonical sources, normalizes, sorts,
// hashes (idempotent modulo generated_at + generated_by), and writes the
// registry atomically via tmpfile-rename.
//
// Design contract (44-RESEARCH.md, 44-01-PLAN.md):
//   - All public APIs (build, loadRegistry, registryPath, resetCache) wrap
//     internals in try/catch and NEVER throw upward (Lock 13 mirror).
//   - Read-only against ALL canonical sources; only owned write is
//     legal-keys.json.
//   - Phase 41 frozen consts (ROLES, PROVIDERS, STATUSES, BLOAT_THRESHOLDS,
//     COMMAND_NAME, ENVELOPE_VERSION) imported BY REFERENCE -- never
//     redefined.
//   - Phase 42 frozen consts (VERDICTS, ROUTE_REASONS) imported BY REFERENCE.
//   - Content hash strips generated_at + generated_by; mirrors Phase 43
//     _capsuleContentHash sec.5.2 verbatim.
//   - CLI exit codes (Lock 13):
//       --self-test  pass=0  fail=1
//       --build      ok=0    source-missing=1   bad-invocation=2
//       --check      delegates to check.cjs
// ============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// FROZEN CONSTANTS
// ---------------------------------------------------------------------------
const SCHEMA_VERSION = 1;
const REGISTRY_VERSION = '1.0.0';

const CATEGORIES = Object.freeze([
  'milestones',
  'phases',
  'gates',
  'agents',
  'artifacts',
  'providers',
  'statuses',
  'phase_folders',
  'commands',
  'reason_codes',
]);

const STATUS_KIND = Object.freeze(['envelope', 'capsule', 'agent']);

// Phase 41 imports BY REFERENCE -- NEVER redefine.
let phase41 = null;
try {
  phase41 = require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'));
} catch (_e) {
  phase41 = null;
}

// Phase 42 imports BY REFERENCE -- NEVER redefine.
let phase42 = null;
try {
  phase42 = require(path.join(__dirname, '..', 'token-waste', 'check.cjs'));
} catch (_e) {
  phase42 = null;
}

// js-yaml fallback (mirror gates-registry.cjs:38-44).
let yaml = null;
try {
  yaml = require(path.join(__dirname, '..', 'plan-schema', 'node_modules', 'js-yaml'));
} catch (_e) {
  yaml = null;
}

// ---------------------------------------------------------------------------
// PATH RESOLUTION (3-up walk; Phase 41 sec 7.1 + Phase 42 + Phase 43 mirror)
// ---------------------------------------------------------------------------
function _defaultRepoRoot() {
  // __dirname = super-gsd/tools/context-registry/
  // 3-up = repo root.
  return path.resolve(__dirname, '..', '..', '..');
}

function _registryFilePath() {
  return path.join(__dirname, 'legal-keys.json');
}

function registryPath() {
  return _registryFilePath();
}

// ---------------------------------------------------------------------------
// SOURCE READERS (RESEARCH sec 4.1) -- 13 canonical sources, all read-only.
// ---------------------------------------------------------------------------

function _safeReadFile(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch (_e) {
    return null;
  }
}

function _safeYamlLoad(text) {
  if (!yaml || !text) return null;
  try {
    return yaml.load(text);
  } catch (_e) {
    return null;
  }
}

function _safeJsonParse(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_e) {
    return null;
  }
}

function _hashSource(p) {
  try {
    const buf = fs.readFileSync(p);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch (_e) {
    return null;
  }
}

// Source #1: gates.yaml -> 13 active gates.
function _readGates(p) {
  const txt = _safeReadFile(p);
  const obj = _safeYamlLoad(txt);
  if (!obj || !Array.isArray(obj.gates)) return { active: [], superseded: [] };
  const active = [];
  const superseded = [];
  for (const g of obj.gates) {
    if (!g || !g.name) continue;
    const row = {
      id: String(g.name),
      category: g.category || null,
      enforcement_mode: g.enforcement_mode || null,
      state: g.state || null,
    };
    if (g.state === 'active' || !g.state) active.push(row);
    else superseded.push(row);
  }
  return { active, superseded };
}

// Source #2: agents.yaml -> 8 agents with category metadata.
function _readAgentsYaml(p) {
  const txt = _safeReadFile(p);
  const obj = _safeYamlLoad(txt);
  if (!obj || !Array.isArray(obj.agents)) return [];
  const out = [];
  for (const a of obj.agents) {
    if (!a || !a.name) continue;
    out.push({
      id: String(a.name),
      category: a.category || null,
      state: a.state || a.lifecycle || null,
      source: 'agents.yaml',
    });
  }
  return out;
}

// Source #3: agents.jsonl -> 23 agents with status filter.
function _readAgentsJsonl(p) {
  const txt = _safeReadFile(p);
  if (!txt) return [];
  const out = [];
  for (const line of txt.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = _safeJsonParse(line);
    if (!row || !row.id) continue;
    out.push({
      id: String(row.id),
      status: row.status || null,
      model: row.model || null,
      source: 'agents.jsonl',
    });
  }
  return out;
}

// Source #4: review-providers.yaml -> 2 review aliases.
function _readReviewProviders(p) {
  const txt = _safeReadFile(p);
  const obj = _safeYamlLoad(txt);
  if (!obj || !Array.isArray(obj.providers)) return [];
  const out = [];
  for (const r of obj.providers) {
    if (!r || !r.name) continue;
    out.push({
      id: String(r.name),
      invocation: r.invocation || null,
      state: r.state || null,
    });
  }
  return out;
}

// Source #5: command-envelope-v1.yaml -> emitters + reason_codes.
function _readEnvelopeRegistry(p) {
  const txt = _safeReadFile(p);
  const obj = _safeYamlLoad(txt);
  if (!obj) return { emitters: [], reason_codes: [] };
  const emitters = Array.isArray(obj.emitters)
    ? obj.emitters.filter(e => e && e.name).map(e => ({
        id: String(e.name),
        emits_envelope: e.emits_envelope || null,
        first_wave: !!e.first_wave,
      }))
    : [];
  const reason_codes = Array.isArray(obj.reason_codes)
    ? obj.reason_codes.filter(c => c && c.code).map(c => ({
        id: String(c.code),
        group: c.group || null,
        status: c.status || null,
      }))
    : [];
  return { emitters, reason_codes };
}

// Source #6: command-envelope-v1.json -> envelope status enum.
function _readEnvelopeJsonStatuses(p) {
  const txt = _safeReadFile(p);
  const obj = _safeJsonParse(txt);
  if (!obj || !obj.properties || !obj.properties.status) return [];
  const en = obj.properties.status.enum;
  if (!Array.isArray(en)) return [];
  return en.slice().map(String);
}

// Source #7: PHASE-CAPSULE.schema.json -> capsule status enum + artifact kinds.
function _readCapsuleSchema(p) {
  const txt = _safeReadFile(p);
  const obj = _safeJsonParse(txt);
  if (!obj) return { status_enum: [], artifact_kinds: [] };
  const status_enum = (obj.properties && obj.properties.status && Array.isArray(obj.properties.status.enum))
    ? obj.properties.status.enum.slice().map(String)
    : [];
  // Phase 43 CAPSULE_FILE_KINDS: 5 kinds -- read from Phase 43 module by reference.
  // Independent of Phase 41 availability; sibling tools/phase-capsule may load
  // even if tools/token-attribution did not.
  let artifact_kinds = [];
  try {
    const phase43 = require(path.join(__dirname, '..', 'phase-capsule', 'write.cjs'));
    if (phase43 && Array.isArray(phase43.CAPSULE_FILE_KINDS)) {
      artifact_kinds = phase43.CAPSULE_FILE_KINDS.slice().map(String);
    }
  } catch (_e) { artifact_kinds = []; }
  return { status_enum, artifact_kinds };
}

// Source #10: PHASE-INDEX.jsonl per milestone -> phases.active.
function _walkPhaseIndices(planningDir) {
  const out = [];
  const milestoneRoot = path.join(planningDir, '.planning', 'milestones');
  let milestoneDirs = [];
  try {
    milestoneDirs = fs.readdirSync(milestoneRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^v\d/.test(d.name))
      .map(d => d.name);
  } catch (_e) {
    milestoneDirs = [];
  }
  for (const ms of milestoneDirs) {
    const idx = path.join(milestoneRoot, ms, 'PHASE-INDEX.jsonl');
    const txt = _safeReadFile(idx);
    if (!txt) continue;
    for (const line of txt.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const row = _safeJsonParse(line);
      if (!row || !row.milestone || !row.phase) continue;
      out.push({
        id: `${row.milestone}/${row.phase}`,
        milestone: String(row.milestone),
        phase: String(row.phase),
        phase_name: row.phase_name || null,
        status: row.status || null,
      });
    }
  }
  return out;
}

// Source #11: filesystem walk -> phase_folders.{active,malformed}.
function _walkPhaseFolders(planningDir) {
  const active = [];
  const malformed = [];
  const milestoneRoot = path.join(planningDir, '.planning', 'milestones');
  let milestoneDirs = [];
  try {
    milestoneDirs = fs.readdirSync(milestoneRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^v\d/.test(d.name))
      .map(d => d.name);
  } catch (_e) {
    return { active, malformed };
  }
  for (const ms of milestoneDirs) {
    const phasesDir = path.join(milestoneRoot, ms, 'phases');
    let entries = [];
    try {
      entries = fs.readdirSync(phasesDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
    } catch (_e) { entries = []; }
    for (const name of entries) {
      const id = `${ms}/${name}`;
      if (/^\d{2}-/.test(name)) {
        active.push({ id, milestone: ms, folder: name });
      } else {
        malformed.push({ id, milestone: ms, folder: name, reason: 'name_not_NN-prefix' });
      }
    }
  }
  return { active, malformed };
}

// Source #12: archive/superseded/*/README.md -> milestones.superseded.
function _walkSupersededArchive(planningDir) {
  const out = [];
  const archiveRoot = path.join(planningDir, '.planning', 'archive', 'superseded');
  let entries = [];
  try {
    entries = fs.readdirSync(archiveRoot, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch (_e) {
    return out;
  }
  for (const id of entries) {
    const readmePath = path.join(archiveRoot, id, 'README.md');
    const txt = _safeReadFile(readmePath);
    if (!txt) continue;
    // Frontmatter parse (between --- lines).
    const m = txt.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!m) {
      out.push({ id, superseded_at: null, replaced_by: null, reason: null, evidence_path: readmePath });
      continue;
    }
    const fm = _safeYamlLoad(m[1]) || {};
    out.push({
      id,
      superseded_at: fm.superseded_at || null,
      replaced_by: fm.superseded_by ? 'v1.9' : (fm.replaced_by || null),
      reason: fm.preservation_intent || fm.reason || null,
      evidence_path: readmePath,
    });
  }
  return out;
}

// Source #13: milestone REQUIREMENTS.md frontmatter (v1.9 only by default).
function _readMilestoneRequirements(planningDir) {
  const milestoneRoot = path.join(planningDir, '.planning', 'milestones');
  let milestoneDirs = [];
  try {
    milestoneDirs = fs.readdirSync(milestoneRoot, { withFileTypes: true })
      .filter(d => d.isDirectory() && /^v\d/.test(d.name))
      .map(d => d.name);
  } catch (_e) {
    return [];
  }
  const out = [];
  for (const ms of milestoneDirs) {
    const reqPath = path.join(milestoneRoot, ms, 'REQUIREMENTS.md');
    const txt = _safeReadFile(reqPath);
    if (!txt) {
      out.push({ id: ms, name: null, requirements_path: null });
      continue;
    }
    const m = txt.match(/^---\s*\n([\s\S]*?)\n---/);
    const fm = m ? (_safeYamlLoad(m[1]) || {}) : {};
    out.push({
      id: ms,
      name: fm.name || fm.title || null,
      requirements_path: reqPath,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// MERGERS + DE-DUPLICATORS (RESEARCH sec 4.2)
// ---------------------------------------------------------------------------

function _mergeAgents(yamlAgents, jsonlAgents) {
  const map = new Map();
  for (const a of jsonlAgents) {
    map.set(a.id, { id: a.id, status: a.status || null, model: a.model || null, category: null });
  }
  for (const a of yamlAgents) {
    const prev = map.get(a.id) || { id: a.id, status: null, model: null, category: null };
    prev.category = a.category || prev.category;
    prev.state = a.state || prev.state || null;
    map.set(a.id, prev);
  }
  const active = [];
  const superseded = [];
  for (const a of map.values()) {
    const isActive = (a.status === 'active') || (a.state === 'active') || (!a.status && !a.state);
    const isRetired = (a.status === 'retired') || (a.state === 'retired')
      || (a.status === 'deprecated') || (a.state === 'deprecated');
    if (isRetired) superseded.push(a);
    else if (isActive) active.push(a);
    else superseded.push(a);
  }
  return { active, superseded };
}

function _splitReasonCodes(allCodes) {
  const active = [];
  const future = [];
  for (const c of allCodes) {
    if (c.status === 'future_v1_9') future.push(c);
    else active.push(c);
  }
  return { active, future };
}

// ---------------------------------------------------------------------------
// SCHEMA VALIDATOR + CONTENT-HASH (RESEARCH sec 7.1)
// ---------------------------------------------------------------------------

function _validateRegistry(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.schema_version !== SCHEMA_VERSION) return false;
  if (typeof obj.registry_version !== 'string') return false;
  if (typeof obj.generated_at !== 'string') return false;
  if (typeof obj.generated_by !== 'string') return false;
  if (!obj.source_hashes || typeof obj.source_hashes !== 'object') return false;
  for (const c of CATEGORIES) {
    if (!obj[c] || typeof obj[c] !== 'object') return false;
    if (!Array.isArray(obj[c].active)) return false;
    if (!Array.isArray(obj[c].superseded)) return false;
  }
  return true;
}

function _sortKeysDeep(value) {
  if (Array.isArray(value)) {
    const sorted = value.map(_sortKeysDeep);
    if (sorted.length && typeof sorted[0] === 'object' && sorted[0] !== null && 'id' in sorted[0]) {
      sorted.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    } else if (sorted.length && typeof sorted[0] === 'string') {
      sorted.sort();
    }
    return sorted;
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value).sort()) out[k] = _sortKeysDeep(value[k]);
    return out;
  }
  return value;
}

function _registryContentHash(obj) {
  const stripped = JSON.parse(JSON.stringify(obj));
  delete stripped.generated_at;
  delete stripped.generated_by;
  const canonical = JSON.stringify(_sortKeysDeep(stripped));
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// ---------------------------------------------------------------------------
// ATOMIC WRITER (tmpfile-rename; RESEARCH sec 7.2)
// ---------------------------------------------------------------------------

function _atomicWriteRegistry(targetPath, obj) {
  const dir = path.dirname(targetPath);
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_e) { /* ignore */ }
  const tmp = targetPath + '.tmp';
  const json = JSON.stringify(obj, null, 2) + '\n';
  fs.writeFileSync(tmp, json, { encoding: 'utf8' });
  fs.renameSync(tmp, targetPath);
}

// ---------------------------------------------------------------------------
// CACHE (mtime-keyed; loadRegistry shares cache; resetCache for self-test)
// ---------------------------------------------------------------------------

let _REG_CACHE = null;
let _REG_CACHE_PATH = null;
let _REG_CACHE_MTIME = null;

function resetCache() {
  _REG_CACHE = null;
  _REG_CACHE_PATH = null;
  _REG_CACHE_MTIME = null;
}

function loadRegistry(legalKeysPath) {
  try {
    const p = legalKeysPath || _registryFilePath();
    let stat;
    try { stat = fs.statSync(p); } catch (_e) { return null; }
    if (_REG_CACHE && _REG_CACHE_PATH === p && _REG_CACHE_MTIME === stat.mtimeMs) {
      return _REG_CACHE;
    }
    const txt = _safeReadFile(p);
    if (!txt) return null;
    const obj = _safeJsonParse(txt);
    if (!obj) return null;
    _REG_CACHE = obj;
    _REG_CACHE_PATH = p;
    _REG_CACHE_MTIME = stat.mtimeMs;
    return obj;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// BUILD (the main public API)
// ---------------------------------------------------------------------------

function build(repoRoot, opts) {
  try {
    opts = opts || {};
    const root = repoRoot || _defaultRepoRoot();
    const targetPath = opts.outputPath || _registryFilePath();

    // Resolve canonical source paths (relative to repo root).
    const srcPaths = {
      gates_yaml: path.join(root, 'super-gsd', 'registry', 'gates.yaml'),
      agents_yaml: path.join(root, 'super-gsd', 'registry', 'agents.yaml'),
      agents_jsonl: path.join(root, '.planning', 'resource-registry', 'agents.jsonl'),
      review_providers_yaml: path.join(root, 'super-gsd', 'registry', 'review-providers.yaml'),
      envelope_yaml: path.join(root, 'super-gsd', 'registry', 'command-envelope-v1.yaml'),
      envelope_json: path.join(root, 'super-gsd', 'templates', 'command-envelope-v1.json'),
      capsule_schema: path.join(root, 'super-gsd', 'tools', 'phase-capsule', 'PHASE-CAPSULE.schema.json'),
      phase41_report: path.join(root, 'super-gsd', 'tools', 'token-attribution', 'report.cjs'),
      phase42_check: path.join(root, 'super-gsd', 'tools', 'token-waste', 'check.cjs'),
      archive_root: path.join(root, '.planning', 'archive', 'superseded'),
      milestones_root: path.join(root, '.planning', 'milestones'),
    };

    // ------- Walk sources -------
    const gates = _readGates(srcPaths.gates_yaml);
    const agentsYaml = _readAgentsYaml(srcPaths.agents_yaml);
    const agentsJsonl = _readAgentsJsonl(srcPaths.agents_jsonl);
    const agents = _mergeAgents(agentsYaml, agentsJsonl);
    const reviewProviders = _readReviewProviders(srcPaths.review_providers_yaml);
    const envelope = _readEnvelopeRegistry(srcPaths.envelope_yaml);
    const envelopeStatuses = _readEnvelopeJsonStatuses(srcPaths.envelope_json);
    const capsuleSchema = _readCapsuleSchema(srcPaths.capsule_schema);
    const phaseIndices = _walkPhaseIndices(root);
    const phaseFolders = _walkPhaseFolders(root);
    const supersededArchive = _walkSupersededArchive(root);
    const milestoneFm = _readMilestoneRequirements(root);

    // Phase 41 const imports BY REFERENCE (NEVER redefine):
    if (!phase41) {
      return { ok: false, reason: 'phase41_import_failed', detail: 'token-attribution/report.cjs unavailable' };
    }
    const PROVIDERS = phase41.PROVIDERS;
    const ROLES = phase41.ROLES;
    const STATUSES = phase41.STATUSES;
    const PHASE41_CMD = phase41.COMMAND_NAME;

    if (!phase42) {
      return { ok: false, reason: 'phase42_import_failed', detail: 'token-waste/check.cjs unavailable' };
    }
    const VERDICTS = phase42.VERDICTS;
    const ROUTE_REASONS = phase42.ROUTE_REASONS;
    const PHASE42_CMD = phase42.COMMAND_NAME;

    // Phase 43 (capsule schema status enum already absorbed via _readCapsuleSchema).
    let phase43 = null;
    try {
      phase43 = require(path.join(root, 'super-gsd', 'tools', 'phase-capsule', 'write.cjs'));
    } catch (_e) { phase43 = null; }
    // Phase 43 doesn't expose a COMMAND_NAME (it writes JSON files, not envelope-v1
    // ledger rows). Use the public API symbol name as the discriminator -- read
    // by reference so a future Phase 43 rename auto-propagates here. Falls back
    // to null when Phase 43 is unavailable.
    const PHASE43_CMD = phase43 && typeof phase43.writeCapsule === 'function'
      ? 'writeCapsule'
      : null;

    // ------- Derive milestones from PHASE-INDEX phases + milestoneFm -------
    const milestonesActive = milestoneFm.map(m => ({
      id: m.id,
      name: m.name,
    }));
    const milestonesSuperseded = supersededArchive.map(s => ({
      id: s.id,
      superseded_at: s.superseded_at,
      replaced_by: s.replaced_by,
      reason: s.reason,
      evidence_path: s.evidence_path
        ? path.relative(root, s.evidence_path).replace(/\\/g, '/')
        : null,
    }));

    // ------- phases.active from PHASE-INDEX rows -------
    const phasesActive = phaseIndices.map(p => ({
      id: p.id,
      milestone: p.milestone,
      phase: p.phase,
      phase_name: p.phase_name,
      status: p.status,
    }));
    // phases.superseded -- derive from archive original_phases if present.
    const phasesSuperseded = [];
    for (const s of supersededArchive) {
      // Re-read frontmatter for original_phases (best-effort; declared in archive).
      const txt = _safeReadFile(path.join(root, '.planning', 'archive', 'superseded', s.id, 'README.md'));
      if (!txt) continue;
      const m = txt.match(/^---\s*\n([\s\S]*?)\n---/);
      if (!m) continue;
      const fm = _safeYamlLoad(m[1]) || {};
      const orig = Array.isArray(fm.original_phases) ? fm.original_phases : [];
      for (const ph of orig) {
        phasesSuperseded.push({
          id: `${s.id}/${ph}`,
          milestone: s.id,
          phase: String(ph),
          superseded_at: s.superseded_at,
          replaced_by: s.replaced_by,
        });
      }
    }

    // ------- statuses (envelope + capsule + agent) -------
    const agentLifecycle = ['active', 'deprecated', 'retired', 'draft'];
    const statusesActive = [];
    for (const e of envelopeStatuses) statusesActive.push({ id: `envelope:${e}`, kind: 'envelope', value: e });
    for (const c of capsuleSchema.status_enum) statusesActive.push({ id: `capsule:${c}`, kind: 'capsule', value: c });
    for (const a of agentLifecycle) statusesActive.push({ id: `agent:${a}`, kind: 'agent', value: a });

    // ------- providers (Phase 41 PROVIDERS verbatim + review aliases as informational) -------
    const providersActive = (PROVIDERS || []).map(p => ({ id: p, source: 'phase41-PROVIDERS' }));
    const providersSuperseded = [];
    // Review aliases recorded as informational under providers.review_aliases for Phase 45 disambiguation.
    const providerReviewAliases = reviewProviders.map(p => ({
      id: p.id,
      invocation: p.invocation,
      state: p.state,
    }));

    // ------- artifacts (capsule schema PhaseOutput.kind + capsule_file_kinds) -------
    const artifactsActive = (capsuleSchema.artifact_kinds || []).map(k => ({ id: k, source: 'phase43-CAPSULE_FILE_KINDS' }));

    // ------- commands (envelope emitters union Phase 41/42/43 command names) -------
    const cmdMap = new Map();
    for (const e of envelope.emitters) {
      cmdMap.set(e.id, { id: e.id, source: 'envelope-v1.yaml', first_wave: !!e.first_wave });
    }
    if (PHASE41_CMD) cmdMap.set(PHASE41_CMD, { id: PHASE41_CMD, source: 'phase41', first_wave: true });
    if (PHASE42_CMD) cmdMap.set(PHASE42_CMD, { id: PHASE42_CMD, source: 'phase42', first_wave: true });
    if (PHASE43_CMD) cmdMap.set(PHASE43_CMD, { id: PHASE43_CMD, source: 'phase43', first_wave: true });
    const commandsActive = Array.from(cmdMap.values());

    // ------- reason_codes (split active vs future) -------
    const splitCodes = _splitReasonCodes(envelope.reason_codes);

    // ------- gates -------
    const gatesActive = gates.active;
    const gatesSuperseded = gates.superseded;

    // ------- phase_folders -------
    const folders = phaseFolders;

    // ------- source_hashes -------
    const sourceHashes = {
      'super-gsd/registry/gates.yaml': _hashSource(srcPaths.gates_yaml),
      'super-gsd/registry/agents.yaml': _hashSource(srcPaths.agents_yaml),
      '.planning/resource-registry/agents.jsonl': _hashSource(srcPaths.agents_jsonl),
      'super-gsd/registry/review-providers.yaml': _hashSource(srcPaths.review_providers_yaml),
      'super-gsd/registry/command-envelope-v1.yaml': _hashSource(srcPaths.envelope_yaml),
      'super-gsd/templates/command-envelope-v1.json': _hashSource(srcPaths.envelope_json),
      'super-gsd/tools/phase-capsule/PHASE-CAPSULE.schema.json': _hashSource(srcPaths.capsule_schema),
      'super-gsd/tools/token-attribution/report.cjs': _hashSource(srcPaths.phase41_report),
      'super-gsd/tools/token-waste/check.cjs': _hashSource(srcPaths.phase42_check),
    };

    // ------- assemble registry -------
    const registry = {
      schema_version: SCHEMA_VERSION,
      registry_version: REGISTRY_VERSION,
      generated_at: new Date().toISOString(),
      generated_by: 'super-gsd/tools/context-registry/build.cjs',
      source_hashes: sourceHashes,
      milestones: { active: milestonesActive, superseded: milestonesSuperseded },
      phases: { active: phasesActive, superseded: phasesSuperseded },
      gates: { active: gatesActive, superseded: gatesSuperseded },
      agents: { active: agents.active, superseded: agents.superseded },
      artifacts: { active: artifactsActive, superseded: [] },
      providers: { active: providersActive, superseded: providersSuperseded, review_aliases: providerReviewAliases },
      statuses: { active: statusesActive, superseded: [] },
      phase_folders: { active: folders.active, superseded: [], malformed: folders.malformed },
      commands: { active: commandsActive, superseded: [] },
      reason_codes: { active: splitCodes.active, superseded: [], future: splitCodes.future },
    };

    // Sort arrays deterministically.
    const sorted = _sortKeysDeep(registry);
    // Re-attach generated_at + generated_by which sort survives.
    const finalReg = sorted;

    // Validate.
    if (!_validateRegistry(finalReg)) {
      return { ok: false, reason: 'registry_invalid', detail: 'closed-shape check failed' };
    }

    const contentHash = _registryContentHash(finalReg);

    // Atomic write.
    _atomicWriteRegistry(targetPath, finalReg);
    resetCache();

    const counts = {
      milestones: finalReg.milestones.active.length,
      phases: finalReg.phases.active.length,
      gates: finalReg.gates.active.length,
      agents: finalReg.agents.active.length,
      artifacts: finalReg.artifacts.active.length,
      providers: finalReg.providers.active.length,
      statuses: finalReg.statuses.active.length,
      phase_folders: finalReg.phase_folders.active.length,
      commands: finalReg.commands.active.length,
      reason_codes: finalReg.reason_codes.active.length,
    };

    return {
      ok: true,
      written: targetPath,
      content_hash: contentHash,
      source_hashes: sourceHashes,
      counts,
    };
  } catch (e) {
    return { ok: false, reason: 'internal_error', detail: e && e.message ? e.message : String(e) };
  }
}

// ---------------------------------------------------------------------------
// MODULE EXPORTS
// ---------------------------------------------------------------------------

module.exports = {
  build,
  loadRegistry,
  registryPath,
  resetCache,
  // Frozen consts:
  SCHEMA_VERSION,
  REGISTRY_VERSION,
  CATEGORIES,
  STATUS_KIND,
  // Internal helpers exposed for self-test only:
  _registryContentHash,
  _sortKeysDeep,
  _validateRegistry,
  _hashSource,
};

// ---------------------------------------------------------------------------
// CLI (Lock 13: --self-test 0/1; --build 0/1/2; --check delegates)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    try {
      require('./build.test.cjs');
      // build.test.cjs handles its own process.exit.
    } catch (e) {
      console.error('[context-registry] self-test load failed:', e && e.message ? e.message : e);
      process.exit(1);
    }
  } else if (args.includes('--build')) {
    const result = build();
    if (result.ok) {
      console.log(`[context-registry] build OK written=${result.written}`);
      console.log(`[context-registry] content_hash=${result.content_hash}`);
      console.log(`[context-registry] counts=${JSON.stringify(result.counts)}`);
      process.exit(0);
    } else {
      console.error(`[context-registry] build FAIL reason=${result.reason} detail=${result.detail || ''}`);
      process.exit(1);
    }
  } else if (args.includes('--check')) {
    try {
      const checkMod = require('./check.cjs');
      // Delegate; check.cjs CLI runs when invoked as main, but we can re-dispatch.
      const idx = args.indexOf('--check');
      const rest = args.slice(idx);
      if (rest.includes('--validate-all-capsules')) {
        const out = checkMod.validateAllCapsules();
        console.log(out.markdown || '');
        process.exit(0);
      } else {
        console.error('[context-registry] --check requires sub-flag (e.g. --validate-all-capsules)');
        process.exit(2);
      }
    } catch (e) {
      console.error('[context-registry] --check failed:', e && e.message ? e.message : e);
      process.exit(1);
    }
  } else {
    console.log('Usage: node build.cjs [--self-test | --build | --check --validate-all-capsules]');
    process.exit(2);
  }
}
