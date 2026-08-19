#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SCHEME_ORDER = Object.freeze({ integer: 0, decimal: 1, v: 2 });

function parsePhaseName(name, dir) {
  if (typeof name !== 'string' || name.length === 0) return null;
  const match = /^(?:(v\d+-\d+(?:\.\d+)?)|(\d+\.\d+)|(\d+))(?:-([A-Za-z0-9][A-Za-z0-9._-]*))?$/.exec(name);
  if (!match) return null;
  return {
    token: match[1] || match[2] || match[3],
    scheme: match[1] ? 'v' : match[2] ? 'decimal' : 'integer',
    slug: match[4] || null,
    dir: typeof dir === 'string' && dir.length > 0 ? path.resolve(dir) : null,
  };
}

function parsePhaseToken(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    value = String(value);
  }
  if (typeof value !== 'string' || value.length === 0) return null;
  const parsed = parsePhaseName(value);
  return parsed && parsed.slug === null ? parsed : null;
}

function compareText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareNumericText(left, right) {
  const leftInteger = normalizedInteger(String(left));
  const rightInteger = normalizedInteger(String(right));
  if (leftInteger.length !== rightInteger.length) {
    return leftInteger.length < rightInteger.length ? -1 : 1;
  }
  return compareText(leftInteger, rightInteger);
}

function numericSegments(phase) {
  if (!phase || typeof phase.token !== 'string') return [];
  if (phase.scheme === 'integer') return [phase.token];
  if (phase.scheme === 'decimal') return phase.token.split('.');
  if (phase.scheme === 'v') return phase.token.slice(1).split(/[-.]/);
  return [];
}

function compareNumericSegments(left, right) {
  const leftSegments = numericSegments(left);
  const rightSegments = numericSegments(right);
  const sharedLength = Math.min(leftSegments.length, rightSegments.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const segmentOrder = compareNumericText(leftSegments[index], rightSegments[index]);
    if (segmentOrder !== 0) return segmentOrder;
  }
  if (leftSegments.length !== rightSegments.length) {
    return leftSegments.length < rightSegments.length ? -1 : 1;
  }
  return 0;
}

function comparePhases(left, right) {
  const leftRank = Object.prototype.hasOwnProperty.call(SCHEME_ORDER, left && left.scheme)
    ? SCHEME_ORDER[left.scheme] : Number.MAX_SAFE_INTEGER;
  const rightRank = Object.prototype.hasOwnProperty.call(SCHEME_ORDER, right && right.scheme)
    ? SCHEME_ORDER[right.scheme] : Number.MAX_SAFE_INTEGER;
  if (leftRank !== rightRank) return leftRank < rightRank ? -1 : 1;
  if (left && right && left.scheme === right.scheme) {
    const numericOrder = compareNumericSegments(left, right);
    if (numericOrder !== 0) return numericOrder;
  }
  const tokenOrder = compareText(String(left && left.token || ''), String(right && right.token || ''));
  if (tokenOrder !== 0) return tokenOrder;
  const slugOrder = compareText(String(left && left.slug || ''), String(right && right.slug || ''));
  if (slugOrder !== 0) return slugOrder;
  return compareText(String(left && left.dir || ''), String(right && right.dir || ''));
}

function stripQuotes(value) {
  const text = String(value || '').trim();
  const first = text.charCodeAt(0);
  const last = text.charCodeAt(text.length - 1);
  if (text.length >= 2 && ((first === 34 && last === 34) || (first === 39 && last === 39))) {
    return text.slice(1, -1);
  }
  return text;
}

function discoveryError(operation, target, error) {
  const resolvedPath = path.resolve(String(target));
  const errorCode = error && typeof error.code === 'string' ? error.code : 'UNKNOWN';
  const message = error && error.message ? String(error.message) : String(error || 'unknown error');
  return {
    ok: false,
    reason: `phase discovery ${operation} failed at ${resolvedPath} (${errorCode}): ${message}`,
    operation,
    path: resolvedPath,
    error_code: errorCode,
  };
}

function isDiscoveryError(value) {
  return Boolean(value && !Array.isArray(value) && value.ok === false
    && typeof value.reason === 'string');
}

function activeMilestone(planningDir) {
  const statePath = path.join(planningDir, 'STATE.md');
  let content;
  try {
    content = fs.readFileSync(statePath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    return discoveryError('read', statePath, error);
  }
  try {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const match = /^\s*milestone:\s*(.*?)\s*$/.exec(line);
      if (match && match[1]) return stripQuotes(match[1]);
    }
  } catch (error) {
    return discoveryError('parse', statePath, error);
  }
  return null;
}

function discoverPhases(projectDir, options) {
  try {
    const opts = options || {};
    const project = path.resolve(projectDir || process.cwd());
    const planningDir = path.resolve(opts.planningDir || path.join(project, '.planning'));
    let milestones;
    if (Array.isArray(opts.milestones)) {
      milestones = opts.milestones.filter(
        (value) => typeof value === 'string' && value.length > 0);
    } else {
      const selectedMilestone = opts.milestone || activeMilestone(planningDir);
      if (isDiscoveryError(selectedMilestone)) return selectedMilestone;
      milestones = [selectedMilestone].filter(Boolean);
    }
    const roots = [];
    if (opts.includeMilestone !== false) {
      for (const milestone of milestones) {
        roots.push(path.join(planningDir, 'milestones', milestone, 'phases'));
      }
    }
    if (opts.includeFlat !== false) roots.push(path.join(planningDir, 'phases'));

    const seen = new Set();
    const phases = [];
    for (const root of roots) {
      let rootStat;
      let names;
      try {
        rootStat = fs.statSync(root);
      } catch (error) {
        if (error && error.code === 'ENOENT') continue;
        return discoveryError('stat', root, error);
      }
      if (!rootStat.isDirectory()) {
        const error = new Error('phase root is not a directory');
        error.code = 'ENOTDIR';
        return discoveryError('stat', root, error);
      }
      try {
        names = fs.readdirSync(root).sort(compareText);
      } catch (error) {
        return discoveryError('readdir', root, error);
      }
      for (const name of names) {
        const candidate = path.join(root, name);
        const parsed = parsePhaseName(name, candidate);
        if (!parsed) continue;
        let real;
        try {
          if (!fs.statSync(candidate).isDirectory()) continue;
        } catch (error) {
          return discoveryError('stat', candidate, error);
        }
        try {
          real = fs.realpathSync(candidate);
        } catch (error) {
          return discoveryError('realpath', candidate, error);
        }
        const key = process.platform === 'win32' ? real.toLowerCase() : real;
        if (seen.has(key)) continue;
        seen.add(key);
        phases.push({ token: parsed.token, scheme: parsed.scheme, slug: parsed.slug, dir: real });
      }
    }
    return phases.sort(comparePhases);
  } catch (error) {
    return discoveryError('initialize', projectDir || process.cwd(), error);
  }
}

function normalizedInteger(token) {
  let index = 0;
  while (index < token.length - 1 && token[index] === '0') index += 1;
  return token.slice(index);
}

function phaseTokensEqual(left, right) {
  if (!left || !right || left.scheme !== right.scheme) return false;
  if (left.scheme === 'integer') {
    return normalizedInteger(left.token) === normalizedInteger(right.token);
  }
  return left.token === right.token;
}

function phaseFromRoadmapCell(value) {
  if (typeof value !== 'string') return null;
  let text = value.trim().replace(/[*`]/g, '');
  if (text.length === 0) return null;
  const phasePrefix = /^phase\s+/i.exec(text);
  if (phasePrefix) text = text.slice(phasePrefix[0].length).trim();
  const candidates = [text];
  const firstWord = text.split(/\s+/)[0].replace(/[:.]$/, '');
  if (firstWord !== text) candidates.push(firstWord);
  if (/^p/i.test(firstWord)) candidates.push(firstWord.slice(1));
  for (const candidate of candidates) {
    const parsed = parsePhaseToken(candidate);
    if (parsed) return parsed;
  }
  return null;
}

function parseRoadmapPhases(source) {
  if (typeof source !== 'string' || source.length === 0) return [];
  const tablePhases = [];
  let phaseTable = false;

  function add(target, parsed, name) {
    if (!parsed) return;
    if (target.some((entry) => phaseTokensEqual(entry, parsed))) return;
    target.push({
      token: parsed.token,
      scheme: parsed.scheme,
      slug: null,
      dir: null,
      name: typeof name === 'string' && name.trim().length > 0
        ? name.trim().replace(/[*`]/g, '') : null,
    });
  }

  for (const line of source.split(/\r?\n/)) {
    if (!/^\s*\|/.test(line)) {
      phaseTable = false;
      continue;
    }
    const cells = line.trim().replace(/^\||\|$/g, '').split('|')
      .map((cell) => cell.trim());
    if (cells.length === 0) continue;
    if (/^phase$/i.test(cells[0].replace(/[*`]/g, ''))) {
      phaseTable = true;
      continue;
    }
    if (!phaseTable || /^:?-+:?$/.test(cells[0])) continue;
    add(tablePhases, phaseFromRoadmapCell(cells[0]), cells[1] || null);
  }
  return tablePhases;
}

function orderPhasesByRoadmap(phases, roadmapPhases) {
  if (!Array.isArray(phases) || !Array.isArray(roadmapPhases)) return [];
  for (const phase of phases) {
    const matches = roadmapPhases.filter(
      (roadmapPhase) => phaseTokensEqual(phase, roadmapPhase));
    if (matches.length !== 1) return [];
  }
  const ordered = [];
  for (const roadmapPhase of roadmapPhases) {
    const matches = phases.filter((phase) => phaseTokensEqual(phase, roadmapPhase));
    if (matches.length === 1) ordered.push(matches[0]);
  }
  return ordered;
}

function phaseBasename(entry) {
  return entry.slug ? entry.token + '-' + entry.slug : entry.token;
}

function findPhase(projectDir, query, options) {
  if (typeof query !== 'string' || query.length === 0) return null;
  const phases = discoverPhases(projectDir, options);
  if (isDiscoveryError(phases)) return phases;
  const queryName = path.basename(query);
  const exact = phases.find((entry) => phaseBasename(entry) === queryName);
  if (exact) return exact;
  const parsedQuery = parsePhaseName(queryName);
  if (parsedQuery) {
    const tokenMatch = phases.find((entry) => phaseTokensEqual(entry, parsedQuery));
    if (tokenMatch) return tokenMatch;
  }
  return phases.find((entry) => entry.slug === queryName) || null;
}

function selfTest() {
  const results = [];
  function check(name, ok) {
    results.push({ name, ok: Boolean(ok) });
  }
  check('exact opaque token accepted',
    parsePhaseToken('v30-07') && parsePhaseToken('v30-07').token === 'v30-07');
  check('folder-shaped token rejected', parsePhaseToken('v30-07-lookalike') === null);
  const roadmap = parseRoadmapPhases([
    '## Phase v30-07 - detail appears before table',
    '| Phase | Name |',
    '|---:|---|',
    '| 999 | Legacy |',
    '| v30-07 | Opaque |',
    '## Phase 999 - duplicate detail',
  ].join('\n'));
  check('roadmap table order preserved',
    roadmap.length === 2 && roadmap[0].token === '999' && roadmap[1].token === 'v30-07');
  const ordered = orderPhasesByRoadmap(
    [parsePhaseName('v30-07-active'), parsePhaseName('999-legacy')], roadmap);
  check('discovery follows roadmap order',
    ordered.length === 2 && ordered[ordered.length - 1].token === 'v30-07');
  return {
    ok: results.every((result) => result.ok),
    pass: results.filter((result) => result.ok).length,
    total: results.length,
    results,
  };
}

function usage() {
  process.stderr.write(
    'Usage: node phase-name.cjs --parse <name> [--dir <path>]\n'
    + '   or: node phase-name.cjs --list [--project <path>] [--planning-dir <path>]'
    + ' [--milestone <id>] [--match <name-or-token>]\n'
    + '   or: node phase-name.cjs --self-test\n'
  );
}

function runCli(argv) {
  const args = argv.slice(2);
  let mode = null;
  let parseName = null;
  let projectDir = process.cwd();
  const options = {};
  let match = null;
  let parseDir = null;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--parse') {
      mode = 'parse';
      parseName = args[++index];
    } else if (arg === '--list') {
      mode = 'list';
    } else if (arg === '--self-test') {
      mode = 'self-test';
    } else if (arg === '--project') {
      projectDir = args[++index];
    } else if (arg === '--planning-dir') {
      options.planningDir = args[++index];
    } else if (arg === '--milestone') {
      options.milestone = args[++index];
    } else if (arg === '--match') {
      match = args[++index];
    } else if (arg === '--dir') {
      parseDir = args[++index];
    } else if (arg === '--help' || arg === '-h') {
      usage();
      return 0;
    } else {
      usage();
      return 2;
    }
  }
  if (mode === 'parse' && typeof parseName === 'string') {
    process.stdout.write(JSON.stringify(parsePhaseName(parseName, parseDir)) + '\n');
    return 0;
  }
  if (mode === 'list') {
    const discovered = match
      ? findPhase(projectDir, match, options)
      : discoverPhases(projectDir, options);
    if (isDiscoveryError(discovered)) {
      process.stderr.write(`phase-name: ${discovered.reason}\n`);
      return 1;
    }
    const result = match ? [discovered].filter(Boolean) : discovered;
    process.stdout.write(JSON.stringify(result) + '\n');
    return 0;
  }
  if (mode === 'self-test') {
    const result = selfTest();
    for (const row of result.results) {
      process.stdout.write(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}\n`);
    }
    process.stdout.write(`phase_name_self_test: ${result.pass}/${result.total}\n`);
    return result.ok ? 0 : 1;
  }
  usage();
  return 2;
}

if (require.main === module) process.exit(runCli(process.argv));

module.exports = {
  SCHEME_ORDER,
  parsePhaseName,
  parsePhaseToken,
  parseRoadmapPhases,
  orderPhasesByRoadmap,
  comparePhases,
  discoverPhases,
  findPhase,
  isDiscoveryError,
  phaseTokensEqual,
  selfTest,
};
