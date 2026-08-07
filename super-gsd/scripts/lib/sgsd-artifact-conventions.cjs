'use strict';

// ============================================================================
// SGSD artifact convention discovery/evaluation
// ============================================================================
// T147-01: pure evaluator only. This module writes no rows and performs no
// filesystem mutations; later commit-gate tasks own shadow evidence writers.
// ============================================================================

const fs = require('fs');
const path = require('path');
const {
  findPlanLockedFiles,
  readState,
  resolveContainedPath
} = require('./sgsd-state.cjs');

const RUNTIME_PREFIXES = Object.freeze([
  'super-gsd/',
  '.agents/',
  '.codex/',
  '.warp/workflows/',
  'custom-gsd-extract/'
]);

const CODE_CONFIG_EXTENSIONS = Object.freeze(new Set([
  '.bat', '.c', '.cmd', '.conf', '.config', '.cpp', '.cs', '.cjs', '.css',
  '.env', '.go', '.h', '.hpp', '.html', '.ini', '.java', '.js', '.json',
  '.jsonc', '.jsx', '.kt', '.mjs', '.ps1', '.py', '.rb', '.rs', '.scss',
  '.sh', '.sql', '.toml', '.ts', '.tsx', '.xml', '.yaml', '.yml'
]));

const ROOT_CONFIG_BASENAMES = Object.freeze(new Set([
  '.gitattributes', '.gitignore', '.npmrc', 'makefile'
]));

const ROOT_CONFIG_PREFIXES = Object.freeze(['.env', 'docker-compose', 'dockerfile.']);

const RELEVANT_STATUS_CHARS = Object.freeze(new Set(['A', 'C', 'M', 'R', 'D', 'T']));
const MAX_PLANNING_FILES = 5000;

function _normalizeRelPath(input) {
  if (typeof input !== 'string') return '';
  let value = input.trim().replace(/\\/g, '/');
  while (value.startsWith('./')) value = value.slice(2);
  value = value.replace(/\/+/g, '/');
  if (!value || value.startsWith('/') || /^[A-Za-z]:\//.test(value)) return '';
  if (value.split('/').some((part) => part === '..')) return '';
  return value;
}

function _statusChar(status) {
  const value = typeof status === 'string' && status.trim() ? status.trim()[0].toUpperCase() : 'M';
  return value;
}

function _statusRelevant(status) {
  return RELEVANT_STATUS_CHARS.has(_statusChar(status));
}

function _isRootConfigBasename(base) {
  return ROOT_CONFIG_BASENAMES.has(base) || ROOT_CONFIG_PREFIXES.some((prefix) => base.startsWith(prefix)) || base === 'dockerfile';
}

function isSourceTouching(filePath) {
  try {
    const rel = _normalizeRelPath(filePath);
    if (!rel) return false;
    const lower = rel.toLowerCase();
    const base = path.posix.basename(lower);

    if (lower.startsWith('.planning/')) return false;
    if (lower === 'readme.md') return false;
    if (lower.startsWith('docs/')) return false;

    if (RUNTIME_PREFIXES.some((prefix) => lower.startsWith(prefix))) return true;
    if (/^package.*\.json$/i.test(base)) return true;
    if (!lower.includes('/') && _isRootConfigBasename(base)) return true;

    const ext = path.posix.extname(lower);
    if (ext === '.md') return false;
    return CODE_CONFIG_EXTENSIONS.has(ext);
  } catch {
    return false;
  }
}

function _rel(root, absPath) {
  try {
    return path.relative(path.resolve(String(root)), absPath).replace(/\\/g, '/');
  } catch {
    return String(absPath || '').replace(/\\/g, '/');
  }
}

function _isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function _isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function _phaseCandidates(phase) {
  const value = String(phase || '').trim().replace(/^P/i, '');
  if (!/^\d+$/.test(value)) return [];
  const out = [value];
  if (value.length < 2) out.push(value.padStart(2, '0'));
  return Array.from(new Set(out));
}

function _safeMilestoneName(milestone) {
  const value = String(milestone || '').trim();
  if (!value || value.includes('/') || value.includes('\\')) return null;
  return value;
}

function _phaseDirMatches(name, phaseCandidates) {
  return phaseCandidates.some((phase) => name === phase || name.startsWith(`${phase}-`));
}

function _phaseFileMatches(name, phaseCandidates) {
  return phaseCandidates.some((phase) => name.startsWith(`${phase}-`));
}

function _collectFilesInDirectory(dir, predicate, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (predicate(entry.name)) out.push(path.resolve(dir, entry.name));
  }
}

function _collectActivePhaseFilesFromRoot(phasesRoot, phaseCandidates, predicate, out) {
  let entries;
  try {
    entries = fs.readdirSync(phasesRoot, { withFileTypes: true });
  } catch {
    return;
  }

  _collectFilesInDirectory(
    phasesRoot,
    (name) => _phaseFileMatches(name, phaseCandidates) && predicate(name),
    out
  );

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!_phaseDirMatches(entry.name, phaseCandidates)) continue;
    _collectFilesInDirectory(path.join(phasesRoot, entry.name), predicate, out);
  }
}

function _collectContainedActivePhaseFiles(repoRoot, relativeRoot, phaseCandidates, predicate, out) {
  const phasesRoot = resolveContainedPath(repoRoot, relativeRoot);
  if (!phasesRoot || !_isDirectory(phasesRoot)) return;
  _collectActivePhaseFilesFromRoot(phasesRoot, phaseCandidates, predicate, out);
}

function _atcNameMatches(name) {
  return /ATC-REVIEW.*\.md$/i.test(name) && !/^AUDIT\.md$/i.test(name);
}

function _collectActiveAtcFiles(repoRoot, state) {
  const phaseCandidates = _phaseCandidates(state && state.phase);
  if (phaseCandidates.length === 0) return [];

  const out = [];
  _collectContainedActivePhaseFiles(repoRoot, path.join('.planning', 'phases'), phaseCandidates, _atcNameMatches, out);

  const milestone = _safeMilestoneName(state && state.milestone);
  if (milestone) {
    _collectContainedActivePhaseFiles(
      repoRoot,
      path.join('.planning', 'milestones', milestone, 'phases'),
      phaseCandidates,
      _atcNameMatches,
      out
    );
    return Array.from(new Set(out)).sort();
  }

  const milestonesRoot = resolveContainedPath(repoRoot, path.join('.planning', 'milestones'));
  let milestones = [];
  try {
    milestones = milestonesRoot ? fs.readdirSync(milestonesRoot, { withFileTypes: true }) : [];
  } catch {
    milestones = [];
  }
  for (const item of milestones) {
    if (!item.isDirectory()) continue;
    _collectContainedActivePhaseFiles(
      repoRoot,
      path.join('.planning', 'milestones', item.name, 'phases'),
      phaseCandidates,
      _atcNameMatches,
      out
    );
  }
  return Array.from(new Set(out)).sort();
}

function _extractFrontmatter(text) {
  const match = String(text || '').replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return match ? match[1] : '';
}

function _stripScalar(raw) {
  let value = String(raw || '').trim();
  if (!value) return '';
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  if (quoted && value.length >= 2) value = value.slice(1, -1);
  return value.trim();
}

function _parseInlineList(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
  const body = trimmed.slice(1, -1).trim();
  if (!body) return [];
  return body.split(',').map((part) => _stripScalar(part)).filter(Boolean);
}

function _parseListField(frontmatter, fieldName) {
  const lines = String(frontmatter || '').split(/\r?\n/);
  const out = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = new RegExp(`^${fieldName}\\s*:\\s*(.*?)\\s*$`).exec(line);
    if (!match) continue;

    const inline = _parseInlineList(match[1]);
    if (inline) return inline;
    if (match[1]) return [_stripScalar(match[1])].filter(Boolean);

    for (let listIndex = index + 1; listIndex < lines.length; listIndex += 1) {
      const itemLine = lines[listIndex];
      if (/^\S[^:]*:\s*/.test(itemLine)) break;
      const item = /^\s*-\s*(.+?)\s*$/.exec(itemLine);
      if (item) out.push(_stripScalar(item[1]));
    }
    return out.filter(Boolean);
  }
  return [];
}

function _readAllowedFiles(planPath) {
  try {
    const frontmatter = _extractFrontmatter(fs.readFileSync(planPath, 'utf8'));
    return _parseListField(frontmatter, 'allowed_files').map(_normalizeRelPath).filter(Boolean);
  } catch {
    return [];
  }
}

function _artifact(kind, repoRoot, absPath) {
  return {
    kind,
    path: _rel(repoRoot, absPath),
    abs_path: absPath
  };
}

function _loadGsdeditsArtifacts(repoRoot, state) {
  const plans = findPlanLockedFiles(repoRoot, state && state.phase, state && state.milestone)
    .filter(_isFile)
    .map((planPath) => Object.assign(_artifact('plan_locked', repoRoot, planPath), {
      allowed_files: _readAllowedFiles(planPath)
    }));
  const atc = _collectActiveAtcFiles(repoRoot, state)
    .filter(_isFile)
    .map((atcPath) => _artifact('atc_review', repoRoot, atcPath));
  return { plans, assurance: atc };
}

function _planningRoot(repoRoot) {
  const planning = resolveContainedPath(repoRoot, '.planning');
  return planning && _isDirectory(planning) ? planning : null;
}

function _walkPlanningFiles(planningRoot, out, limit = MAX_PLANNING_FILES) {
  if (out.length >= limit) return;
  let entries;
  try {
    entries = fs.readdirSync(planningRoot, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (out.length >= limit) return;
    if (entry.isSymbolicLink && entry.isSymbolicLink()) continue;
    const child = path.join(planningRoot, entry.name);
    if (entry.isDirectory()) {
      _walkPlanningFiles(child, out, limit);
    } else if (entry.isFile()) {
      out.push(child);
    }
  }
}

function _isPhaseSpecificArtifact(name, phaseCandidates) {
  return _phaseFileMatches(name, phaseCandidates);
}

function _isGenericPlanName(name, phaseCandidates) {
  if (/^PLAN\.md$/i.test(name)) return false;
  return _isPhaseSpecificArtifact(name, phaseCandidates) && /PLAN/i.test(name) && /\.md$/i.test(name);
}

function _isGenericAssuranceName(name, phaseCandidates) {
  if (/^AUDIT\.md$/i.test(name)) return false;
  return _isPhaseSpecificArtifact(name, phaseCandidates)
    && /(ATC-REVIEW|VERIFICATION|REVIEW|AUDIT)/i.test(name)
    && /\.md$/i.test(name);
}

function _discoverRepoLocalArtifacts(repoRoot, state) {
  const planning = _planningRoot(repoRoot);
  const phaseCandidates = _phaseCandidates(state && state.phase);
  if (!planning || phaseCandidates.length === 0) return { plans: [], assurance: [] };

  const files = [];
  _walkPlanningFiles(planning, files);
  const plans = [];
  const assurance = [];
  for (const filePath of files) {
    const name = path.basename(filePath);
    if (_isGenericPlanName(name, phaseCandidates)) {
      plans.push(Object.assign(_artifact('discovered_plan', repoRoot, filePath), {
        allowed_files: _readAllowedFiles(filePath)
      }));
    } else if (_isGenericAssuranceName(name, phaseCandidates)) {
      assurance.push(_artifact('discovered_assurance', repoRoot, filePath));
    }
  }
  return {
    plans: plans.sort((a, b) => a.path.localeCompare(b.path)),
    assurance: assurance.sort((a, b) => a.path.localeCompare(b.path))
  };
}

function _stateLooksLikeGsdedits(repoRoot, state) {
  const milestone = String(state && state.milestone || '').trim();
  if (!state || !state.phase || !/^v\d+(?:\.\d+)*$/i.test(milestone)) return false;
  const superGsdDir = resolveContainedPath(repoRoot, 'super-gsd');
  if (superGsdDir && _isDirectory(superGsdDir)) return true;
  return path.resolve(String(repoRoot || '')).split(/[\\/]+/).some((part) => /^GSDedits$/i.test(part) || /^GSDedits-/i.test(part));
}

function _baseConvention(root, suppliedState) {
  const repoRoot = path.resolve(String(root || process.cwd()));
  const planning = _planningRoot(repoRoot);
  if (!planning) {
    return {
      convention: 'unknown',
      reason_code: 'planning_missing',
      convention_basis: 'none',
      evidence: [],
      plans: [],
      assurance: [],
      state: null,
      repoRoot
    };
  }

  const state = suppliedState || readState(repoRoot);
  if (!state || !state.phase) {
    return {
      convention: 'unknown',
      reason_code: 'state_phase_unknown',
      convention_basis: 'none',
      evidence: [_rel(repoRoot, resolveContainedPath(repoRoot, path.join('.planning', 'STATE.md')) || planning)],
      plans: [],
      assurance: [],
      state: state || null,
      repoRoot
    };
  }

  const gsdedits = _loadGsdeditsArtifacts(repoRoot, state);
  if (gsdedits.plans.length > 0 || gsdedits.assurance.length > 0) {
    return {
      convention: 'gsdedits',
      reason_code: 'gsdedits_artifacts_discovered',
      convention_basis: 'artifact_evidence',
      evidence: [...gsdedits.plans, ...gsdedits.assurance].map((item) => item.path),
      plans: gsdedits.plans,
      assurance: gsdedits.assurance,
      state,
      repoRoot
    };
  }

  const discovered = _discoverRepoLocalArtifacts(repoRoot, state);
  if (discovered.plans.length > 0 && discovered.assurance.length > 0) {
    return {
      convention: 'discovered',
      reason_code: 'repo_local_convention_discovered',
      convention_basis: 'artifact_evidence',
      evidence: [...discovered.plans, ...discovered.assurance].map((item) => item.path),
      plans: discovered.plans,
      assurance: discovered.assurance,
      state,
      repoRoot
    };
  }

  if (_stateLooksLikeGsdedits(repoRoot, state)) {
    return {
      convention: 'gsdedits',
      reason_code: 'gsdedits_state_detected',
      convention_basis: 'heuristic',
      evidence: [...discovered.plans, ...discovered.assurance].map((item) => item.path),
      plans: discovered.plans,
      assurance: discovered.assurance,
      state,
      repoRoot
    };
  }

  return {
    convention: 'unknown',
    reason_code: 'convention_unknown',
    convention_basis: 'none',
    evidence: [],
    plans: discovered.plans,
    assurance: discovered.assurance,
    state,
    repoRoot
  };
}

function discoverConvention(root) {
  try {
    const result = _baseConvention(root, null);
    return {
      convention: result.convention,
      reason_code: result.reason_code,
      convention_basis: result.convention_basis || 'none',
      evidence: Array.isArray(result.evidence) ? result.evidence.slice() : []
    };
  } catch {
    return { convention: 'unknown', reason_code: 'convention_error', convention_basis: 'none', evidence: [] };
  }
}

function _globToRegExp(glob) {
  let source = '';
  const normalized = _normalizeRelPath(glob);
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === '*') {
      if (normalized[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else {
        source += '[^/]*';
      }
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, 'i');
}

function _casePolicyKey(value) {
  return String(value || '').toLowerCase();
}

function _allowedMatches(allowedPattern, relPath) {
  const allowed = _normalizeRelPath(allowedPattern);
  const rel = _normalizeRelPath(relPath);
  if (!allowed || !rel) return false;
  const allowedKey = _casePolicyKey(allowed);
  const relKey = _casePolicyKey(rel);
  if (allowedKey === relKey) return true;
  if (allowedKey.endsWith('/**')) return relKey.startsWith(allowedKey.slice(0, -2));
  if (allowed.includes('*')) return _globToRegExp(allowed).test(rel);
  return false;
}

function _planCoversPath(plan, relPath) {
  const allowed = Array.isArray(plan && plan.allowed_files) ? plan.allowed_files : [];
  return allowed.some((item) => _allowedMatches(item, relPath));
}

function _entryRawPath(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return null;
  for (const key of ['path', 'newPath', 'oldPath']) {
    if (typeof entry[key] === 'string') return entry[key];
  }
  return null;
}

function _entryDisplayPath(entry) {
  const raw = _entryRawPath(entry);
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
}

function _entryInvalidReason(entry) {
  const raw = _entryRawPath(entry);
  if (typeof raw !== 'string') return 'path_not_string';
  let value = raw.trim().replace(/\\/g, '/');
  while (value.startsWith('./')) value = value.slice(2);
  value = value.replace(/\/+/g, '/');
  if (!value) return 'path_empty';
  if (value.startsWith('/') || /^[A-Za-z]:\//.test(value)) return 'path_absolute';
  if (value.split('/').some((part) => part === '..')) return 'path_traversal';
  return null;
}

function _invalidPathRecord(entry, reasonCode) {
  return {
    path: _entryDisplayPath(entry),
    source_touching: false,
    evidence_status: 'invalid_path',
    matched_artifacts: [],
    reason_code: reasonCode
  };
}

function _entryPath(entry) {
  return _normalizeRelPath(_entryRawPath(entry));
}

function _entryOldPath(entry) {
  if (!entry || typeof entry !== 'object') return '';
  return _normalizeRelPath(entry.oldPath || '');
}

function _entryStatus(entry) {
  return typeof entry === 'object' && entry ? entry.status : 'M';
}

function _entrySourceTouching(entry) {
  if (!_statusRelevant(_entryStatus(entry))) return false;
  return isSourceTouching(_entryPath(entry)) || isSourceTouching(_entryOldPath(entry));
}

function _missingReason(convention, matchingPlans) {
  if (!convention || convention.reason_code === 'convention_unknown') return 'convention_unknown';
  if (convention.plans.length === 0) return 'plan_evidence_missing';
  if (convention.assurance.length === 0) return 'assurance_evidence_missing';
  if (matchingPlans.length === 0) return 'path_evidence_missing';
  return 'phase_evidence_missing';
}

function _evaluatePathRecord(convention, entry) {
  const invalidReason = _entryInvalidReason(entry);
  if (invalidReason) return _invalidPathRecord(entry, invalidReason);
  const relPath = _entryPath(entry);
  const sourceTouching = _entrySourceTouching(entry);
  const base = {
    path: relPath,
    source_touching: sourceTouching,
    evidence_status: 'not_source',
    matched_artifacts: [],
    reason_code: sourceTouching ? null : 'not_source'
  };
  if (!sourceTouching) return base;

  const matchingPlans = convention.plans.filter((plan) => _planCoversPath(plan, relPath));
  if (matchingPlans.length > 0 && convention.assurance.length > 0 && convention.convention !== 'unknown') {
    return Object.assign({}, base, {
      evidence_status: 'backed',
      matched_artifacts: [
        ...matchingPlans.map((item) => item.path),
        ...convention.assurance.map((item) => item.path)
      ],
      reason_code: 'path_evidence_backed'
    });
  }

  return Object.assign({}, base, {
    evidence_status: 'missing',
    matched_artifacts: [],
    reason_code: _missingReason(convention, matchingPlans)
  });
}

function _normalizeEntries(stagedPaths) {
  if (!Array.isArray(stagedPaths)) return [];
  return stagedPaths.slice();
}

function evaluatePaths(root, stagedPaths, state) {
  const entries = _normalizeEntries(stagedPaths);
  try {
    const convention = _baseConvention(root, state || null);
    return entries.map((entry) => _evaluatePathRecord(convention, entry));
  } catch {
    return entries.map((entry) => {
      const invalidReason = _entryInvalidReason(entry);
      if (invalidReason) return _invalidPathRecord(entry, invalidReason);
      const sourceTouching = _entrySourceTouching(entry);
      return {
        path: _entryPath(entry),
        source_touching: sourceTouching,
        evidence_status: sourceTouching ? 'missing' : 'not_source',
        matched_artifacts: [],
        reason_code: sourceTouching ? 'artifact_evaluation_error' : 'not_source'
      };
    });
  }
}

module.exports = {
  discoverConvention,
  evaluatePaths,
  isSourceTouching,
  _normalizeRelPath
};
