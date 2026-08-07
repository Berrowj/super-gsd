// ============================================================================
// SGSD - shared state resolver helpers
// ============================================================================
// Public API never throws upward. STATE phase resolution is frontmatter-only:
// current_phase wins, legacy phase is read-only compatibility, status prose is
// intentionally never parsed.
// ============================================================================

const fs = require('fs');
const path = require('path');

const PHASE_SOURCE = Object.freeze({
  CURRENT: 'current_phase',
  LEGACY: 'legacy_phase',
  // Deliberately unreachable: verification exits 2 if prose phase parsing returns.
  STATUS_PROSE: 'status_prose',
  ABSENT: 'absent',
});

function _isDirectory(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function _isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function _realpath(p) {
  try {
    return fs.realpathSync.native(path.resolve(String(p)));
  } catch {
    try {
      return fs.realpathSync(path.resolve(String(p)));
    } catch {
      return null;
    }
  }
}

function _comparePath(p) {
  const resolved = path.resolve(String(p));
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function _isInsideOrEqual(rootReal, candidateReal) {
  try {
    const rel = path.relative(_comparePath(rootReal), _comparePath(candidateReal));
    return rel === '' || (rel && !rel.startsWith('..') && !path.isAbsolute(rel));
  } catch {
    return false;
  }
}

function _nearestExistingAncestor(absTarget) {
  try {
    let cur = path.resolve(String(absTarget));
    while (true) {
      if (fs.existsSync(cur)) return cur;
      const parent = path.dirname(cur);
      if (parent === cur) return null;
      cur = parent;
    }
  } catch {
    return null;
  }
}

function resolveContainedPath(root, relativeSubpath) {
  try {
    if (!root || typeof relativeSubpath !== 'string' || !relativeSubpath.trim()) return null;
    if (path.isAbsolute(relativeSubpath)) return null;

    const rootAbs = path.resolve(String(root));
    const rootReal = _realpath(rootAbs);
    if (!rootReal) return null;

    const targetAbs = path.resolve(rootAbs, relativeSubpath);
    const existingAncestor = _nearestExistingAncestor(targetAbs);
    if (!existingAncestor) return null;

    const ancestorReal = _realpath(existingAncestor);
    if (!ancestorReal || !_isInsideOrEqual(rootReal, ancestorReal)) return null;

    const tail = path.relative(existingAncestor, targetAbs);
    const resolvedTarget = path.resolve(ancestorReal, tail);
    return _isInsideOrEqual(rootReal, resolvedTarget) ? resolvedTarget : null;
  } catch {
    return null;
  }
}

function findSgsdRoot(startDir) {
  try {
    if (!startDir) return null;
    let cur = path.resolve(String(startDir));
    if (!_isDirectory(cur)) cur = path.dirname(cur);

    while (true) {
      const planningDir = resolveContainedPath(cur, '.planning');
      const statePath = resolveContainedPath(cur, path.join('.planning', 'STATE.md'));
      if (planningDir && statePath && _isDirectory(planningDir) && _isFile(statePath)) return cur;
      const parent = path.dirname(cur);
      if (parent === cur) return null;
      cur = parent;
    }
  } catch {
    return null;
  }
}

function _stripScalar(raw) {
  if (raw === undefined || raw === null) return null;
  let value = String(raw).trim();
  if (!value) return '';
  const quoted =
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"));
  if (quoted && value.length >= 2) value = value.slice(1, -1);
  return value.trim();
}

function _parseFrontmatter(text) {
  const out = {};
  const duplicateKeys = [];
  const seenKeys = new Set();
  const fmMatch = String(text || '').replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return out;

  for (const line of fmMatch[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/);
    if (m) {
      if (seenKeys.has(m[1]) && !duplicateKeys.includes(m[1])) duplicateKeys.push(m[1]);
      seenKeys.add(m[1]);
      out[m[1]] = _stripScalar(m[2]);
    }
  }
  if (duplicateKeys.length > 0) out._duplicateKeys = duplicateKeys;
  return out;
}

function _normalizePhase(value) {
  const phase = _stripScalar(value);
  return phase && /^[0-9]+$/.test(phase) ? phase : null;
}

function _stateResult(milestone, phase, phaseSource, fm) {
  const result = { milestone, phase, phaseSource };
  if (Array.isArray(fm._duplicateKeys) && fm._duplicateKeys.length > 0) {
    result.frontmatterDuplicateKeys = fm._duplicateKeys.slice();
  }
  return result;
}

function readState(root) {
  try {
    if (!root) return null;
    const statePath = resolveContainedPath(path.resolve(String(root)), path.join('.planning', 'STATE.md'));
    if (!statePath || !fs.existsSync(statePath)) return null;
    const fm = _parseFrontmatter(fs.readFileSync(statePath, 'utf8'));
    const milestone = _stripScalar(fm.milestone) || null;

    const currentPhase = _normalizePhase(fm.current_phase);
    if (currentPhase) {
      return _stateResult(milestone, currentPhase, PHASE_SOURCE.CURRENT, fm);
    }

    const legacyPhase = _normalizePhase(fm.phase);
    if (legacyPhase) {
      return _stateResult(milestone, legacyPhase, PHASE_SOURCE.LEGACY, fm);
    }

    return _stateResult(milestone, null, PHASE_SOURCE.ABSENT, fm);
  } catch {
    return null;
  }
}

function _phaseCandidates(phase) {
  const normalized = _normalizePhase(phase);
  if (!normalized) return [];
  const candidates = [normalized];
  if (normalized.length < 2) candidates.push(normalized.padStart(2, '0'));
  return Array.from(new Set(candidates));
}

function _planRegexes(phase) {
  return _phaseCandidates(phase).map((p) => ({
    fileRe: new RegExp(`^${p}-.+-PLAN-LOCKED\\.md$`),
    dirRe: new RegExp(`^${p}(?:-|$)`),
  }));
}

function _collectMatchingFiles(dir, regexes, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (regexes.some((r) => r.fileRe.test(entry.name))) {
      out.push(path.resolve(dir, entry.name));
    }
  }
}

function _collectFromPhasesRoot(phasesRoot, regexes, out) {
  let entries;
  try {
    entries = fs.readdirSync(phasesRoot, { withFileTypes: true });
  } catch {
    return;
  }

  _collectMatchingFiles(phasesRoot, regexes, out);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!regexes.some((r) => r.dirRe.test(entry.name))) continue;
    _collectMatchingFiles(path.join(phasesRoot, entry.name), regexes, out);
  }
}

function _collectContainedPhasesRoot(repoRoot, relativeSubpath, regexes, out) {
  const phasesRoot = resolveContainedPath(repoRoot, relativeSubpath);
  if (!phasesRoot) return;
  _collectFromPhasesRoot(phasesRoot, regexes, out);
}

function _safeMilestoneName(milestone) {
  const value = _stripScalar(milestone);
  if (!value || value.includes('/') || value.includes('\\')) return null;
  return value;
}

function findPlanLockedFiles(root, phase, milestone) {
  try {
    if (!root) return [];
    const regexes = _planRegexes(phase);
    if (regexes.length === 0) return [];

    const repoRoot = path.resolve(String(root));
    const out = [];
    _collectContainedPhasesRoot(repoRoot, path.join('.planning', 'phases'), regexes, out);

    const scopedMilestone = _safeMilestoneName(milestone);
    if (scopedMilestone) {
      _collectContainedPhasesRoot(
        repoRoot,
        path.join('.planning', 'milestones', scopedMilestone, 'phases'),
        regexes,
        out
      );
      return Array.from(new Set(out)).sort();
    }

    const milestonesRoot = resolveContainedPath(repoRoot, path.join('.planning', 'milestones'));
    let milestones;
    try {
      milestones = milestonesRoot ? fs.readdirSync(milestonesRoot, { withFileTypes: true }) : [];
    } catch {
      milestones = [];
    }
    for (const item of milestones) {
      if (!item.isDirectory()) continue;
      _collectContainedPhasesRoot(
        repoRoot,
        path.join('.planning', 'milestones', item.name, 'phases'),
        regexes,
        out
      );
    }

    return Array.from(new Set(out)).sort();
  } catch {
    return [];
  }
}

module.exports = {
  findSgsdRoot,
  resolveContainedPath,
  readState,
  findPlanLockedFiles,
  PHASE_SOURCE,
};