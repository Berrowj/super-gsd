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

function findSgsdRoot(startDir) {
  try {
    if (!startDir) return null;
    let cur = path.resolve(String(startDir));
    if (!_isDirectory(cur)) cur = path.dirname(cur);

    while (true) {
      if (_isDirectory(path.join(cur, '.planning')) && _isFile(path.join(cur, '.planning', 'STATE.md'))) return cur;
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
    const statePath = path.join(path.resolve(String(root)), '.planning', 'STATE.md');
    if (!fs.existsSync(statePath)) return null;
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

function findPlanLockedFiles(root, phase) {
  try {
    if (!root) return [];
    const regexes = _planRegexes(phase);
    if (regexes.length === 0) return [];

    const repoRoot = path.resolve(String(root));
    const out = [];
    _collectFromPhasesRoot(path.join(repoRoot, '.planning', 'phases'), regexes, out);

    const milestonesRoot = path.join(repoRoot, '.planning', 'milestones');
    let milestones;
    try {
      milestones = fs.readdirSync(milestonesRoot, { withFileTypes: true });
    } catch {
      milestones = [];
    }
    for (const milestone of milestones) {
      if (!milestone.isDirectory()) continue;
      _collectFromPhasesRoot(
        path.join(milestonesRoot, milestone.name, 'phases'),
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
  readState,
  findPlanLockedFiles,
  PHASE_SOURCE,
};