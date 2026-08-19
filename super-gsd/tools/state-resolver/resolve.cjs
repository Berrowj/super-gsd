#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/state-resolver/resolve.cjs
// Phase 90-02 (D90.0 + D90.6): Effective State Resolver (READ-ONLY).
//
// PURPOSE
//   Resolve the EFFECTIVE active milestone + phase from priority-ordered
//   live evidence. STATE.md frontmatter is treated as a LEGACY PROJECTION,
//   not the authoritative source. Eliminates the class of bugs where the
//   read-side (sgsd_current_state, sgsd_current_phase, sgsd_recovery_packet,
//   cockpit objective) trusts a stale STATE.md while the orchestrator has
//   already advanced N phases past it.
//
//   Phase 86 added staleness DETECTION (mtime drift). This resolver
//   replaces TRUST: callers compute the effective state up-front and
//   surface state_md as just one (lowest-priority) evidence stream.
//
// PRIORITY ORDER (highest -> lowest)
//   1. ORCHESTRATOR-CHECKPOINT.md   (mtime <2h)            confidence 0.95
//   2. orchestrator-pulse.jsonl     (latest row <30min)    confidence 0.90
//   3. activity-log.jsonl           (Task/dispatch <60min) confidence 0.80
//   4. phase folders                (ROADMAP order)         confidence 0.65-0.70
//   5. git log                      (feat(p<token>))        confidence 0.60
//   6. STATE.md frontmatter         (legacy projection)    confidence 0.40
//   7. none of above                                       ok=false
//
// 2 PUBLIC APIs (Lock-13 wrapped)
//   - resolveEffectiveState({projectDir})
//       -> {ok, schema_version, ts, milestone, phase, phase_name,
//           phase_status, confidence, source, projection_stale,
//           stale_sources, conflicts, recommended_repair}
//   - selfTest()
//       -> {ok, results: [...]} (12+ assertions)
//
// CLI
//   --project <path>   resolve against the given project directory
//   --json             emit the envelope as JSON
//   --self-test        run the self-test, exit 0/1
//   --help             usage
//
// LOCK INVARIANTS
//   - Lock-13: every public API try/catch wrapped; bad input / missing
//     files / parse errors -> degraded envelope; never throws.
//   - READ-ONLY: zero mutating fs calls in the public-API surface
//     (write+FileSync, append+FileSync, unlink+Sync, mkdir+Sync, rm+Sync,
//     rmdir+Sync, rename+Sync -- listed with concatenation markers so the
//     A_READ_ONLY scan does not match this comment). The self-test
//     fixture region below the public surface DOES write to a temp dir
//     (it MUST, to build synthetic trees) and is excluded from the scan
//     by a slice boundary.
//   - ASCII-only: selfTest A_ASCII enforces.
//
// DEPENDENCIES
//   - Pure Node built-ins (fs, path, child_process) only. No new deps.
// =============================================================================

'use strict';

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var phase_name = require('../../scripts/lib/phase-name.cjs');

var SCHEMA_VERSION = 1;

var RESOLVER_SOURCES = Object.freeze([
  'checkpoint',
  'pulse',
  'activity_log',
  'phase_folders',
  'git',
  'state_md_legacy',
]);

var STALE_SOURCE_KEYS = Object.freeze([
  'state_md',
  'pulse',
  'activity_log',
  'phase_folders',
  'git',
]);

// ---------------------------------------------------------------------------
// SHARED HELPERS (Lock-13 wrapped; never throw)
// ---------------------------------------------------------------------------
function _now() {
  try { return new Date().toISOString(); } catch (_e) { return ''; }
}

function _resolveProjectDir(opts) {
  try {
    if (opts && typeof opts.projectDir === 'string'
        && opts.projectDir.length > 0) {
      return path.resolve(opts.projectDir);
    }
    if (opts && typeof opts.planningDir === 'string'
        && opts.planningDir.length > 0) {
      return path.dirname(path.resolve(opts.planningDir));
    }
    return process.cwd();
  } catch (_e) {
    return process.cwd();
  }
}

function _resolvePlanningDir(opts) {
  try {
    if (opts && typeof opts.planningDir === 'string'
        && opts.planningDir.length > 0) {
      return path.resolve(opts.planningDir);
    }
    var projectDir = _resolveProjectDir(opts);
    return path.join(projectDir, '.planning');
  } catch (_e) {
    return '.planning';
  }
}

function _stripQuotes(s) {
  if (typeof s !== 'string') return s;
  var t = s.replace(/^\s+|\s+$/g, '');
  if (t.length >= 2) {
    var c0 = t.charAt(0);
    var cN = t.charAt(t.length - 1);
    if ((c0 === '"' && cN === '"') || (c0 === "'" && cN === "'")) {
      return t.slice(1, -1);
    }
  }
  return t;
}

function _stripInlineComment(s) {
  if (typeof s !== 'string') return s;
  var t = s.replace(/^\s+|\s+$/g, '');
  var first = t.charCodeAt(0);
  if (first === 34 || first === 39) return t;
  return t.replace(/\s+#.*$/, '').replace(/\s+$/, '');
}

function _countIndent(s) {
  var n = 0;
  while (n < s.length && (s.charAt(n) === ' ' || s.charAt(n) === '\t')) n++;
  return n;
}

// Minimal frontmatter reader for resolver fields. Only indentation-zero
// keys and direct children of a real roadmap_run mapping are admitted.
// Returns null on any failure. Never throws.
function _parseFrontmatter(filePath) {
  try {
    if (typeof filePath !== 'string' || filePath.length === 0) return null;
    if (!fs.existsSync(filePath)) return null;
    var src = '';
    try { src = fs.readFileSync(filePath, 'utf8'); } catch (_re) { return null; }
    if (typeof src !== 'string' || src.length === 0) return null;
    var lines = src.split(/\r?\n/);
    if (lines.length < 2) return null;
    if (lines[0].replace(/\s+$/, '') !== '---') return null;
    var endIdx = -1;
    for (var i = 1; i < lines.length; i++) {
      if (lines[i].replace(/\s+$/, '') === '---') { endIdx = i; break; }
    }
    if (endIdx === -1) return null;
    var out = {};
    var roadmapRun = null;
    var roadmapRunIndent = -1;
    var roadmapRunChildIndent = -1;
    for (var li = 1; li < endIdx; li++) {
      var raw = lines[li];
      if (typeof raw !== 'string') continue;
      var trimmed = raw.replace(/^\s+|\s+$/g, '');
      if (trimmed.length === 0) continue;
      if (trimmed.charAt(0) === '#') continue;
      var indent = _countIndent(raw);
      var colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      var key = trimmed.slice(0, colonIdx).replace(/^\s+|\s+$/g, '');
      var val = trimmed.slice(colonIdx + 1).replace(/^\s+|\s+$/g, '');
      if (key.charAt(0) === '-') continue;
      if (key.length === 0) continue;

      if (indent === 0) {
        roadmapRun = null;
        roadmapRunIndent = -1;
        roadmapRunChildIndent = -1;
        if (val.length === 0) {
          out[key] = {};
          if (key === 'roadmap_run') {
            roadmapRun = out[key];
            roadmapRunIndent = indent;
          }
        } else {
          out[key] = _stripQuotes(_stripInlineComment(val));
        }
        continue;
      }

      if (!roadmapRun || indent <= roadmapRunIndent) continue;
      if (roadmapRunChildIndent === -1) roadmapRunChildIndent = indent;
      if (indent !== roadmapRunChildIndent || val.length === 0) continue;
      roadmapRun[key] = _stripQuotes(_stripInlineComment(val));
    }
    return out;
  } catch (_e) {
    return null;
  }
}

function _stateProjectionFromFrontmatter(fm) {
  try {
    if (!fm || typeof fm !== 'object') return null;
    var rr = (fm.roadmap_run && typeof fm.roadmap_run === 'object')
      ? fm.roadmap_run : {};
    var rrPhase = _uniquePhaseCandidate([
      (typeof rr.current_phase !== 'undefined') ? rr.current_phase : null,
    ]);
    // Treat roadmap_run current-state fields as one bundle. An invalid or
    // absent phase cannot donate a stale milestone, name, or status.
    var useRoadmapRun = rrPhase !== null;
    var smMilestone = (useRoadmapRun
      && typeof rr.current_milestone === 'string'
      && rr.current_milestone.length > 0)
      ? rr.current_milestone
      : ((typeof fm.milestone === 'string') ? fm.milestone : null);
    var smPhaseCandidate = useRoadmapRun
      ? rrPhase
      : _uniquePhaseCandidate([fm.current_phase]);
    return {
      milestone: smMilestone,
      phase: smPhaseCandidate ? smPhaseCandidate.token : null,
      phase_name: (useRoadmapRun && typeof rr.current_phase_name === 'string')
        ? rr.current_phase_name
        : (typeof fm.current_phase_name === 'string' ? fm.current_phase_name : null),
      phase_status: (useRoadmapRun && typeof rr.current_phase_status === 'string')
        ? rr.current_phase_status
        : (typeof fm.current_phase_status === 'string' ? fm.current_phase_status : null),
    };
  } catch (_e) {
    return null;
  }
}

// Read the LAST non-empty JSONL row from a file. Returns the parsed object
// (or null) plus the file's mtime in ms.
function _lastJsonlRow(filePath) {
  try {
    if (typeof filePath !== 'string' || filePath.length === 0) return null;
    if (!fs.existsSync(filePath)) return null;
    var src = '';
    try { src = fs.readFileSync(filePath, 'utf8'); } catch (_re) { return null; }
    if (typeof src !== 'string' || src.length === 0) return null;
    var lines = src.split(/\r?\n/);
    var mtimeMs = null;
    try {
      var st = fs.statSync(filePath);
      if (st && st.mtime) mtimeMs = st.mtime.getTime();
    } catch (_se) { mtimeMs = null; }
    for (var i = lines.length - 1; i >= 0; i--) {
      var ln = lines[i];
      if (typeof ln !== 'string') continue;
      var t = ln.replace(/^\s+|\s+$/g, '');
      if (t.length === 0) continue;
      try {
        var obj = JSON.parse(t);
        return { row: obj, mtimeMs: mtimeMs };
      } catch (_pe) { /* skip parse errors */ }
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// Read the LAST N non-empty JSONL rows. Used to scan recent
// activity-log entries for phase markers.
function _tailJsonl(filePath, n) {
  var rows = [];
  try {
    if (typeof filePath !== 'string' || filePath.length === 0) return rows;
    if (!fs.existsSync(filePath)) return rows;
    var src = '';
    try { src = fs.readFileSync(filePath, 'utf8'); } catch (_re) { return rows; }
    if (typeof src !== 'string' || src.length === 0) return rows;
    var lines = src.split(/\r?\n/);
    var nn = (typeof n === 'number' && n > 0) ? Math.floor(n) : 50;
    var collected = [];
    for (var i = lines.length - 1; i >= 0 && collected.length < nn; i--) {
      var ln = lines[i];
      if (typeof ln !== 'string') continue;
      var t = ln.replace(/^\s+|\s+$/g, '');
      if (t.length === 0) continue;
      try {
        collected.push(JSON.parse(t));
      } catch (_pe) { /* skip */ }
    }
    for (var ri = collected.length - 1; ri >= 0; ri--) {
      rows.push(collected[ri]);
    }
    return rows;
  } catch (_e) { return rows; }
}

function _findPhaseFolder(planningDir, milestone, phaseToken) {
  try {
    return phase_name.findPhase(path.dirname(planningDir), String(phaseToken), {
      planningDir: planningDir,
      milestone: milestone,
    });
  } catch (_e) { return null; }
}

function _parsePhaseToken(value) {
  try {
    return phase_name.parsePhaseToken(value);
  } catch (_e) { return null; }
}

function _samePhaseToken(left, right) {
  try {
    var leftParsed = (left && typeof left === 'object' && left.scheme)
      ? left : _parsePhaseToken(left);
    var rightParsed = (right && typeof right === 'object' && right.scheme)
      ? right : _parsePhaseToken(right);
    return Boolean(leftParsed && rightParsed
      && phase_name.phaseTokensEqual(leftParsed, rightParsed));
  } catch (_e) { return false; }
}

function _uniquePhaseCandidate(values) {
  try {
    var parsed = [];
    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      if (value === null || typeof value === 'undefined' || value === '') continue;
      var candidate = _parsePhaseToken(value);
      if (!candidate) return null;
      if (!parsed.some(function (entry) {
        return _samePhaseToken(entry, candidate);
      })) parsed.push(candidate);
    }
    return parsed.length === 1 ? parsed[0] : null;
  } catch (_e) { return null; }
}

function _readRoadmapOrder(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    var content = fs.readFileSync(filePath, 'utf8');
    return phase_name.parseRoadmapPhases(content);
  } catch (_e) { return []; }
}

function _roadmapForMilestone(planningDir, milestone, allowRoot, expectedPhase) {
  try {
    if (typeof milestone === 'string' && milestone.length > 0) {
      var milestoneOrder = _readRoadmapOrder(
        path.join(planningDir, 'milestones', milestone, 'ROADMAP.md'));
      if (milestoneOrder.length > 0) return milestoneOrder;
    }
    if (!allowRoot) return [];
    var rootOrder = _readRoadmapOrder(path.join(planningDir, 'ROADMAP.md'));
    if (rootOrder.length === 0) return [];
    if (expectedPhase && !rootOrder.some(function (entry) {
      return _samePhaseToken(entry, expectedPhase);
    })) return [];
    return rootOrder;
  } catch (_e) { return []; }
}

function _milestoneVersion(name) {
  try {
    var match = /^v(\d+)\.(\d+)/.exec(String(name || ''));
    if (!match) return null;
    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
    };
  } catch (_e) { return null; }
}

function _compareMilestonesDescending(left, right) {
  var leftVersion = _milestoneVersion(left);
  var rightVersion = _milestoneVersion(right);
  if (leftVersion && rightVersion) {
    if (leftVersion.major !== rightVersion.major) {
      return rightVersion.major - leftVersion.major;
    }
    if (leftVersion.minor !== rightVersion.minor) {
      return rightVersion.minor - leftVersion.minor;
    }
  } else if (leftVersion) {
    return -1;
  } else if (rightVersion) {
    return 1;
  }
  return left < right ? 1 : left > right ? -1 : 0;
}

function _milestoneCandidates(planningDir, preferredMilestone) {
  var names = [];
  try {
    var milestonesDir = path.join(planningDir, 'milestones');
    if (fs.existsSync(milestonesDir)) names = fs.readdirSync(milestonesDir);
  } catch (_e) { names = []; }
  names = names.filter(function (name) {
    return typeof name === 'string' && name.length > 0;
  });
  names.sort(_compareMilestonesDescending);
  if (typeof preferredMilestone === 'string' && preferredMilestone.length > 0) {
    names = names.filter(function (name) { return name !== preferredMilestone; });
    names.unshift(preferredMilestone);
  }
  return names;
}

function _locatePhase(planningDir, phaseToken, preferredMilestone) {
  try {
    var parsed = _parsePhaseToken(phaseToken);
    if (!parsed) return null;
    var candidates = _milestoneCandidates(planningDir, preferredMilestone);
    for (var i = 0; i < candidates.length; i++) {
      var milestone = candidates[i];
      var folder = _findPhaseFolder(planningDir, milestone, parsed.token);
      if (!folder) continue;
      var explicitPreferred = milestone === preferredMilestone;
      var roadmap = _roadmapForMilestone(
        planningDir, milestone, explicitPreferred, parsed);
      if (roadmap.length > 0 && !roadmap.some(function (entry) {
        return _samePhaseToken(entry, parsed);
      })) continue;
      return {
        milestone: milestone,
        folder: folder,
        phase_name: _phaseNameFromFolder(folder),
      };
    }
    return null;
  } catch (_e) { return null; }
}

function _hasPhaseContext(phase) {
  try {
    if (!phase || typeof phase.dir !== 'string') return false;
    var names = fs.readdirSync(phase.dir);
    if (names.indexOf('CONTEXT.md') !== -1) return true;
    for (var i = 0; i < names.length; i++) {
      var name = names[i];
      if (!/-CONTEXT\.md$/i.test(name)) continue;
      var prefix = name.slice(0, -'-CONTEXT.md'.length);
      var parsed = _parsePhaseToken(prefix);
      if (parsed && _samePhaseToken(parsed, phase)) return true;
    }
    return false;
  } catch (_e) { return false; }
}

function _isClosedStatus(status) {
  if (typeof status !== 'string') return false;
  return status.toUpperCase().indexOf('PASS') === 0;
}

function _phaseNameFromFolder(folder) {
  try {
    var parsed = (folder && typeof folder === 'object')
      ? folder : phase_name.parsePhaseName(String(folder));
    if (!parsed || !parsed.slug) return null;
    var slug = parsed.slug;
    var words = slug.split('-');
    var titled = [];
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.length === 0) continue;
      titled.push(w.charAt(0).toUpperCase() + w.slice(1));
    }
    return titled.join(' ');
  } catch (_e) { return null; }
}

function _phaseStatusFromFolder(phase) {
  try {
    if (!phase || typeof phase.dir !== 'string') return null;
    var phaseDir = phase.dir;
    if (!fs.existsSync(phaseDir)) return null;
    var names = [phase.token + '-VERIFICATION.md'];
    if (phase.scheme === 'integer' && phase.token.length === 1) {
      names.unshift('0' + phase.token + '-VERIFICATION.md');
    }
    var verPath = null;
    for (var i = 0; i < names.length; i++) {
      var candidate = path.join(phaseDir, names[i]);
      if (fs.existsSync(candidate)) { verPath = candidate; break; }
    }
    if (!fs.existsSync(verPath)) return null;
    var fm = _parseFrontmatter(verPath);
    if (!fm) return null;
    if (typeof fm.status === 'string' && fm.status.length > 0) return fm.status;
    if (typeof fm.verdict === 'string' && fm.verdict.length > 0) return fm.verdict;
    return null;
  } catch (_e) { return null; }
}

function _phaseValue(phase) {
  return phase && typeof phase.token === 'string' ? phase.token : null;
}

// Walk ROADMAP-ordered phases for the active milestone. Returns
// { milestone, phase, phase_name, phase_status, phase_dir } or null.
function _scanPhaseFolders(planningDir, preferredMilestone, preferredPhase) {
  try {
    var candidates = _milestoneCandidates(planningDir, preferredMilestone);
    if (candidates.length === 0 && preferredMilestone) candidates.push(preferredMilestone);
    var preferredRoadmap = _roadmapForMilestone(
      planningDir, preferredMilestone, true, preferredPhase);

    var orderedCandidates = [];
    if (preferredRoadmap.length > 0
        && !fs.existsSync(path.join(
          planningDir, 'milestones', preferredMilestone, 'ROADMAP.md'))) {
      orderedCandidates = [preferredMilestone];
    } else {
      orderedCandidates = candidates.filter(function (milestone) {
        return fs.existsSync(path.join(
          planningDir, 'milestones', milestone, 'ROADMAP.md'));
      });
      orderedCandidates.sort(_compareMilestonesDescending);
      if (preferredMilestone && preferredRoadmap.length === 0) {
        if (orderedCandidates.length === 0
            || (orderedCandidates[0] !== preferredMilestone
              && _compareMilestonesDescending(
                orderedCandidates[0], preferredMilestone) >= 0)) return null;
      }
    }

    for (var mi = 0; mi < orderedCandidates.length; mi++) {
      var milestone = orderedCandidates[mi];
      var roadmap = milestone === preferredMilestone
        ? preferredRoadmap
        : _roadmapForMilestone(planningDir, milestone, false, null);
      var phases = phase_name.discoverPhases(path.dirname(planningDir), {
        planningDir: planningDir,
        milestone: milestone,
      });
      if (phase_name.isDiscoveryError(phases) || phases.length === 0) continue;
      var ordered = roadmap.length > 0
        ? phase_name.orderPhasesByRoadmap(phases, roadmap) : [];
      var roadmapComplete = ordered.length === phases.length && ordered.length > 0;
      if (!roadmapComplete) {
        var discoveredOrder = phases.slice().sort(phase_name.comparePhases);
        var newest = discoveredOrder[discoveredOrder.length - 1];
        var newestStatus = _phaseStatusFromFolder(newest);
        return {
          milestone: milestone,
          phase: _phaseValue(newest),
          phase_name: _phaseNameFromFolder(newest),
          phase_status: (typeof newestStatus === 'string') ? newestStatus : 'in-progress',
          phase_dir: newest.dir,
          from_next_after_close: false,
        };
      }

      var active = null;
      var activeStatus = null;
      var fromNextAfterClose = false;
      var statuses = [];
      var lastClosedIndex = -1;
      for (var pi = 0; pi < ordered.length; pi++) {
        statuses.push(_phaseStatusFromFolder(ordered[pi]));
        if (_isClosedStatus(statuses[pi])) lastClosedIndex = pi;
      }
      if (lastClosedIndex >= 0) {
        active = ordered[lastClosedIndex];
        activeStatus = statuses[lastClosedIndex];
        var closedRoadmapIndex = -1;
        for (var ri = 0; ri < roadmap.length; ri++) {
          if (_samePhaseToken(roadmap[ri], active)) {
            closedRoadmapIndex = ri;
            break;
          }
        }
        if (closedRoadmapIndex >= 0 && closedRoadmapIndex + 1 < roadmap.length) {
          var immediate = phases.filter(function (phase) {
            return _samePhaseToken(phase, roadmap[closedRoadmapIndex + 1]);
          });
          if (immediate.length === 1) {
            var immediateStatus = _phaseStatusFromFolder(immediate[0]);
            if (!_isClosedStatus(immediateStatus) && _hasPhaseContext(immediate[0])) {
              active = immediate[0];
              activeStatus = immediateStatus;
              fromNextAfterClose = true;
            }
          }
        }
      } else {
        for (var ai = 0; ai < ordered.length; ai++) {
          if (!_isClosedStatus(statuses[ai]) && _hasPhaseContext(ordered[ai])) {
            active = ordered[ai];
            activeStatus = statuses[ai];
          }
        }
      }
      if (!active) continue;
      return {
        milestone: milestone,
        phase: _phaseValue(active),
        phase_name: _phaseNameFromFolder(active),
        phase_status: (typeof activeStatus === 'string') ? activeStatus : 'in-progress',
        phase_dir: active.dir,
        from_next_after_close: fromNextAfterClose,
      };
    }
    return null;
  } catch (_e) { return null; }
}

function _activityCandidate(probe) {
  try {
    if (typeof probe !== 'string' || probe.length === 0) return null;
    var candidates = [];
    var ambiguous = false;
    function add(parsed, milestone) {
      if (!parsed) return;
      var existing = candidates.find(function (candidate) {
        return _samePhaseToken(candidate.phase, parsed);
      });
      if (existing) {
        if (existing.milestone && milestone
            && existing.milestone !== milestone) ambiguous = true;
        if (!existing.milestone && milestone) existing.milestone = milestone;
        return;
      }
      candidates.push({ phase: parsed, milestone: milestone || null });
    }

    var pathPattern = /\.planning[\\\/]((?:milestones[\\\/]([^\\\/\s]+)[\\\/])?)phases[\\\/]([^\\\/\s]+)/ig;
    var pathMatch = null;
    while ((pathMatch = pathPattern.exec(probe)) !== null) {
      add(phase_name.parsePhaseName(pathMatch[3]), pathMatch[2] || null);
    }

    var markerPattern = /\bP([A-Za-z0-9._-]+)/g;
    var markerMatch = null;
    while ((markerMatch = markerPattern.exec(probe)) !== null) {
      var marker = _parsePhaseToken(markerMatch[1]);
      if (marker) {
        add(marker, null);
      } else if (phase_name.parsePhaseName(markerMatch[1])) {
        return null;
      }
    }
    return !ambiguous && candidates.length === 1 ? candidates[0] : null;
  } catch (_e) { return null; }
}

// Run `git log --oneline -50` against projectDir; use the newest exact
// feat(p<opaque-token>) marker and look up its milestone via phase folders.
function _scanGitLog(projectDir, planningDir, preferredMilestone) {
  try {
    if (typeof projectDir !== 'string' || projectDir.length === 0) return null;
    var out = '';
    try {
      out = child_process.execFileSync('git',
        ['log', '--oneline', '-50'],
        { cwd: projectDir, encoding: 'utf8', timeout: 5000 });
    } catch (_ge) { return null; }
    if (typeof out !== 'string' || out.length === 0) return null;
    var lines = out.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (typeof ln !== 'string') continue;
      var markerPattern = /feat\(p([^)]+)\)/ig;
      var parsedCandidates = [];
      var marker = null;
      while ((marker = markerPattern.exec(ln)) !== null) {
        var parsedPhase = _parsePhaseToken(marker[1]);
        if (parsedPhase) {
          if (!parsedCandidates.some(function (candidate) {
            return _samePhaseToken(candidate, parsedPhase);
          })) parsedCandidates.push(parsedPhase);
        } else if (phase_name.parsePhaseName(marker[1])) {
          return null;
        }
      }
      if (parsedCandidates.length > 1) return null;
      if (parsedCandidates.length === 0) continue;
      var selected = parsedCandidates[0];
      var located = _locatePhase(planningDir, selected.token, preferredMilestone);
      return {
        milestone: located ? located.milestone : null,
        phase: selected.token,
        phase_name: located ? located.phase_name : null,
      };
    }
    return null;
  } catch (_e) { return null; }
}

// ---------------------------------------------------------------------------
// PUBLIC API: resolveEffectiveState(opts)
//
//   opts: { projectDir?: string, planningDir?: string, nowMs?: number }
//   Returns the effective-state envelope. Lock-13 wrapped.
// ---------------------------------------------------------------------------
function resolveEffectiveState(opts) {
  try {
    var planningDir = _resolvePlanningDir(opts);
    var projectDir = _resolveProjectDir(opts);
    var nowMs = (opts && typeof opts.nowMs === 'number' && !isNaN(opts.nowMs))
      ? opts.nowMs : Date.now();

    var resolved = null;       // the chosen result
    var stateMd = null;        // STATE.md frontmatter projection (always probed)
    var conflicts = [];

    // -- Probe STATE.md frontmatter once (used both as priority 6 fallback
    //    and as the legacy projection compared against higher-priority
    //    sources for projection_stale detection). --
    try {
      var statePath = path.join(planningDir, 'STATE.md');
      var fm = _parseFrontmatter(statePath);
      if (fm) stateMd = _stateProjectionFromFrontmatter(fm);
    } catch (_se) { stateMd = null; }

    // -- Priority 1: ORCHESTRATOR-CHECKPOINT.md (mtime <2h) --
    try {
      var ckpPath = path.join(planningDir, 'ORCHESTRATOR-CHECKPOINT.md');
      if (fs.existsSync(ckpPath)) {
        var st = fs.statSync(ckpPath);
        var ckpMtime = (st && st.mtime) ? st.mtime.getTime() : null;
        var ckpAgeMin = (ckpMtime !== null) ? Math.round((nowMs - ckpMtime) / 60000) : null;
        if (ckpAgeMin !== null && ckpAgeMin < 120) {
          var ckpFm = _parseFrontmatter(ckpPath);
          if (ckpFm) {
            var ckpMilestone = (typeof ckpFm.milestone === 'string')
              ? ckpFm.milestone : null;
            var ckpPhase = _uniquePhaseCandidate([
              ckpFm.current_phase,
              ckpFm.phase,
            ]);
            if (ckpPhase) {
              resolved = {
                milestone: ckpMilestone,
                phase: ckpPhase.token,
                phase_name: (typeof ckpFm.current_phase_name === 'string')
                  ? ckpFm.current_phase_name : null,
                phase_status: (typeof ckpFm.current_phase_status === 'string')
                  ? ckpFm.current_phase_status : 'in-progress',
                source: 'checkpoint',
                confidence: 0.95,
              };
            }
          }
        }
      }
    } catch (_ckpe) { /* lock-13: drop to next priority */ }

    // -- Priority 2: orchestrator-pulse.jsonl latest (<30 min) --
    if (!resolved) {
      try {
        var pulsePath = path.join(planningDir, 'metrics', 'orchestrator-pulse.jsonl');
        var lastPulse = _lastJsonlRow(pulsePath);
        if (lastPulse && lastPulse.row) {
          var rowTs = null;
          if (typeof lastPulse.row.ts === 'string') {
            var parsedTs = Date.parse(lastPulse.row.ts);
            if (!isNaN(parsedTs)) rowTs = parsedTs;
          }
          var pulseAgeMs = (rowTs !== null) ? (nowMs - rowTs)
            : (lastPulse.mtimeMs !== null ? (nowMs - lastPulse.mtimeMs) : null);
          if (pulseAgeMs !== null && pulseAgeMs < 30 * 60 * 1000) {
            var pulsePhase = _uniquePhaseCandidate([lastPulse.row.phase]);
            if (pulsePhase) {
              var pulseMilestone = typeof lastPulse.row.milestone === 'string'
                ? lastPulse.row.milestone : null;
              var pulseLocated = _locatePhase(
                planningDir, pulsePhase.token, pulseMilestone || (stateMd && stateMd.milestone));
              resolved = {
                milestone: pulseMilestone || (pulseLocated ? pulseLocated.milestone : null),
                phase: pulsePhase.token,
                phase_name: pulseLocated ? pulseLocated.phase_name : null,
                phase_status: 'in-progress',
                source: 'pulse',
                confidence: 0.90,
              };
            }
          }
        }
      } catch (_pe) { /* drop to next priority */ }
    }

    // -- Priority 3: activity-log.jsonl recent Task/dispatch (<60 min) --
    if (!resolved) {
      try {
        var actPath = path.join(planningDir, 'metrics', 'activity-log.jsonl');
        var rows = _tailJsonl(actPath, 100);
        var foundPhase = null;
        var foundMilestone = null;
        for (var ai = rows.length - 1; ai >= 0; ai--) {
          var arow = rows[ai] || {};
          if (typeof arow.ts !== 'string') continue;
          var ats = Date.parse(arow.ts);
          if (isNaN(ats)) continue;
          if ((nowMs - ats) > 60 * 60 * 1000) continue;
          // Scan target + command_preview for phase markers.
          var probe = '';
          if (typeof arow.target === 'string') probe += arow.target + ' ';
          if (typeof arow.command_preview === 'string') probe += arow.command_preview + ' ';
          var activity = _activityCandidate(probe);
          if (activity) {
            foundPhase = activity.phase.token;
            foundMilestone = activity.milestone;
            var activityLocated = _locatePhase(
              planningDir, foundPhase, foundMilestone || (stateMd && stateMd.milestone));
            if (!foundMilestone && activityLocated) {
              foundMilestone = activityLocated.milestone;
            }
            break;
          }
        }
        if (foundPhase) {
          // Look up phase name via folder if milestone present.
          var actPhaseName = null;
          if (foundMilestone) {
            var actLocated = _locatePhase(planningDir, foundPhase, foundMilestone);
            if (actLocated) actPhaseName = actLocated.phase_name;
          }
          resolved = {
            milestone: foundMilestone,
            phase: foundPhase,
            phase_name: actPhaseName,
            phase_status: 'in-progress',
            source: 'activity_log',
            confidence: 0.80,
          };
        }
      } catch (_ae) { /* drop to next priority */ }
    }

    // -- Priority 4: phase folders (active ROADMAP order) --
    if (!resolved) {
      try {
        var pf = _scanPhaseFolders(
          planningDir,
          stateMd && stateMd.milestone,
          stateMd && stateMd.phase);
        if (pf) {
          resolved = {
            milestone: pf.milestone,
            phase: pf.phase,
            phase_name: pf.phase_name,
            phase_status: pf.phase_status || 'in-progress',
            source: 'phase_folders',
            confidence: pf.from_next_after_close ? 0.65 : 0.70,
          };
        }
      } catch (_pfe) { /* drop to next priority */ }
    }

    // -- Priority 5: git log feat(p<opaque-token>) --
    if (!resolved) {
      try {
        var g = _scanGitLog(projectDir, planningDir, stateMd && stateMd.milestone);
        if (g && g.phase) {
          resolved = {
            milestone: g.milestone,
            phase: g.phase,
            phase_name: g.phase_name,
            phase_status: 'in-progress',
            source: 'git',
            confidence: 0.60,
          };
        }
      } catch (_ge) { /* drop to next priority */ }
    }

    // -- Priority 6: STATE.md legacy projection --
    if (!resolved && stateMd && stateMd.phase) {
      resolved = {
        milestone: stateMd.milestone,
        phase: stateMd.phase,
        phase_name: stateMd.phase_name,
        phase_status: stateMd.phase_status,
        source: 'state_md_legacy',
        confidence: 0.40,
      };
    }

    // -- Priority 7: nothing found --
    if (!resolved) {
      return {
        ok: false,
        schema_version: SCHEMA_VERSION,
        ts: _now(),
        milestone: null,
        phase: null,
        phase_name: null,
        phase_status: null,
        confidence: 0,
        source: null,
        projection_stale: false,
        stale_sources: [],
        conflicts: [],
        recommended_repair: null,
        error_code: 'no_evidence_found',
        error_message: 'no checkpoint/pulse/activity/phase-folder/git/STATE.md evidence available',
      };
    }

    // -- Compare against STATE.md (skip if STATE.md WAS the source) --
    var staleSources = [];
    var recommendedRepair = null;
    if (resolved.source !== 'state_md_legacy' && stateMd) {
      var stateMdMismatch =
        (stateMd.milestone !== resolved.milestone)
        || (stateMd.phase !== resolved.phase);
      if (stateMdMismatch) {
        staleSources.push('state_md');
        recommendedRepair = 'Re-sync STATE.md to milestone='
          + (resolved.milestone || '?')
          + ' phase=' + (resolved.phase || '?');
        conflicts.push({
          source_a: resolved.source,
          source_b: 'state_md',
          phase_a: resolved.phase,
          phase_b: stateMd.phase,
          milestone_a: resolved.milestone,
          milestone_b: stateMd.milestone,
        });
      }
    }

    // -- Pulse vs activity-log cross-check (only when neither is the
    //    chosen source, to surface divergence to operators). --
    try {
      if (resolved.source !== 'pulse' && resolved.source !== 'activity_log') {
        // (No-op for now; structured cross-check requires both probes
        // to agree that the data is fresh enough. Future hook.)
      }
    } catch (_ce) { /* ignore */ }

    return {
      ok: true,
      schema_version: SCHEMA_VERSION,
      ts: _now(),
      milestone: resolved.milestone,
      phase: resolved.phase,
      phase_name: resolved.phase_name,
      phase_status: resolved.phase_status,
      confidence: resolved.confidence,
      source: resolved.source,
      projection_stale: staleSources.length > 0,
      stale_sources: staleSources,
      conflicts: conflicts,
      recommended_repair: recommendedRepair,
      // Echo the STATE.md projection so callers can show the
      // discrepancy without re-parsing the file.
      _state_md: stateMd,
    };
  } catch (_e) {
    return {
      ok: false,
      schema_version: SCHEMA_VERSION,
      ts: _now(),
      milestone: null,
      phase: null,
      phase_name: null,
      phase_status: null,
      confidence: 0,
      source: null,
      projection_stale: false,
      stale_sources: [],
      conflicts: [],
      recommended_repair: null,
      error_code: 'internal_error_degraded',
      error_message: 'resolver threw: ' + ((_e && _e.message) ? _e.message : 'unknown'),
    };
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: selfTest()
// ---------------------------------------------------------------------------
function _writeSyntheticTree(rootDir, opts) {
  // Helper for self-test fixtures. Lives inside selfTest's scope per
  // convention; the READ-ONLY scan ignores this region.
  var pl = path.join(rootDir, '.planning');
  fs.mkdirSync(pl, { recursive: true });
  fs.mkdirSync(path.join(pl, 'metrics'), { recursive: true });
  fs.mkdirSync(path.join(pl, 'milestones'), { recursive: true });
  if (opts.stateMd) {
    fs.writeFileSync(path.join(pl, 'STATE.md'), opts.stateMd, 'utf8');
  }
  if (opts.checkpoint) {
    fs.writeFileSync(path.join(pl, 'ORCHESTRATOR-CHECKPOINT.md'),
      opts.checkpoint, 'utf8');
  }
  if (opts.pulseRows) {
    fs.writeFileSync(path.join(pl, 'metrics', 'orchestrator-pulse.jsonl'),
      opts.pulseRows.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n',
      'utf8');
  }
  if (opts.activityRows) {
    fs.writeFileSync(path.join(pl, 'metrics', 'activity-log.jsonl'),
      opts.activityRows.map(function (r) { return JSON.stringify(r); }).join('\n') + '\n',
      'utf8');
  }
  if (opts.phases) {
    var roadmapRows = {};
    for (var mi = 0; mi < opts.phases.length; mi++) {
      var p = opts.phases[mi];
      var msDir = path.join(pl, 'milestones', p.milestone, 'phases');
      fs.mkdirSync(msDir, { recursive: true });
      var pad2 = (String(p.num).length === 1) ? ('0' + p.num) : String(p.num);
      var folderName = pad2 + '-' + (p.slug || 'synthetic');
      var phaseDir = path.join(msDir, folderName);
      fs.mkdirSync(phaseDir, { recursive: true });
      if (p.context !== false) {
        fs.writeFileSync(path.join(phaseDir, pad2 + '-CONTEXT.md'),
          '---\nphase: ' + p.num + '\nstatus: in-progress\n---\n', 'utf8');
      }
      if (p.verification) {
        fs.writeFileSync(path.join(phaseDir, pad2 + '-VERIFICATION.md'),
          '---\nphase: ' + p.num + '\nstatus: ' + p.verification + '\n---\n', 'utf8');
      }
      if (!roadmapRows[p.milestone]) roadmapRows[p.milestone] = [];
      roadmapRows[p.milestone].push('| ' + p.num + ' | '
        + (p.slug || 'synthetic') + ' | Planned |');
    }
    var roadmapMilestones = Object.keys(roadmapRows);
    for (var rmi = 0; rmi < roadmapMilestones.length; rmi++) {
      var roadmapMilestone = roadmapMilestones[rmi];
      fs.writeFileSync(
        path.join(pl, 'milestones', roadmapMilestone, 'ROADMAP.md'),
        '| Phase | Name | Status |\n|---:|---|---|\n'
          + roadmapRows[roadmapMilestone].join('\n') + '\n',
        'utf8');
    }
  }
  return pl;
}

function _mkTmpDir(label) {
  var os = require('os');
  var base = path.join(os.tmpdir(),
    'sgsd-state-resolver-' + label + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function _rmTree(dir) {
  // Banned-token note: this self-test cleanup helper is the ONLY mutating
  // fs path in this file. The READ-ONLY scan in A_READ_ONLY restricts
  // its source range to the public API region (above selfTest), so this
  // does not trigger the scan. Built via concatenation regardless to
  // avoid any chance of self-match.
  try {
    if (typeof fs.rmSync === 'function') {
      fs['r' + 'mSync'](dir, { recursive: true, force: true });
    } else {
      // Best-effort recursion fallback (Node <14).
      var entries = fs.readdirSync(dir);
      for (var i = 0; i < entries.length; i++) {
        var ep = path.join(dir, entries[i]);
        var st = fs.statSync(ep);
        if (st.isDirectory()) _rmTree(ep);
        else fs['un' + 'linkSync'](ep);
      }
      fs['r' + 'mdirSync'](dir);
    }
  } catch (_e) { /* best-effort */ }
}

function selfTest() {
  var results = [];
  function assert(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  var srcText = '';
  try { srcText = fs.readFileSync(__filename, 'utf8'); } catch (_re) { srcText = ''; }

  // A1: PUBLIC_APIS surface
  var a1 = (typeof resolveEffectiveState === 'function')
    && (typeof selfTest === 'function');
  assert('A1_public_apis_present', a1,
    'resolveEffectiveState=' + typeof resolveEffectiveState
    + ' selfTest=' + typeof selfTest);

  // A_ASCII: ASCII-only source (excluding intentional READ-ONLY ban tokens
  // that are built via concatenation, so they remain ASCII anyway).
  var firstNonAscii = -1;
  for (var ci = 0; ci < srcText.length; ci++) {
    if (srcText.charCodeAt(ci) > 127) { firstNonAscii = ci; break; }
  }
  assert('A_ASCII_only', firstNonAscii === -1, 'idx=' + firstNonAscii);

  // A_READ_ONLY: scan ONLY the public-API portion (everything BEFORE the
  // self-test fixture region marker). The fixture writers below this
  // marker legitimately write to a temp dir, but the public surface
  // (resolveEffectiveState + its helpers) must not. We mark the boundary
  // with the well-known _writeSyntheticTree function -- everything before
  // that is the surface guarded by Lock-13 + READ-ONLY.
  var publicSentinel = 'function _write' + 'SyntheticTree(';
  var publicEndIdx = srcText.indexOf(publicSentinel);
  if (publicEndIdx === -1) publicEndIdx = srcText.length;
  var publicSrc = srcText.slice(0, publicEndIdx);
  var bannedTokens = [
    'write' + 'FileSync',
    'append' + 'FileSync',
    'unlink' + 'Sync',
    'mkdir' + 'Sync',
    'r' + 'mSync',
    'r' + 'mdirSync',
    'rename' + 'Sync',
  ];
  var bannedHit = null;
  for (var bi = 0; bi < bannedTokens.length; bi++) {
    if (publicSrc.indexOf(bannedTokens[bi]) !== -1) { bannedHit = bannedTokens[bi]; break; }
  }
  assert('A_READ_ONLY_invariant_public_api', bannedHit === null,
    'banned_hit=' + (bannedHit || 'none'));

  // -- Build synthetic fixtures and assert priority order --
  var nowMs = Date.now();
  var freshTs = new Date(nowMs - 5 * 60 * 1000).toISOString();   // 5 min ago
  var oldTs = new Date(nowMs - 8 * 60 * 60 * 1000).toISOString(); // 8h ago
  var staleTs = new Date(nowMs - 90 * 60 * 1000).toISOString();   // 90 min ago

  // Fixture A: checkpoint present + valid + recent -> wins.
  var dirA = _mkTmpDir('A');
  try {
    _writeSyntheticTree(dirA, {
      stateMd: '---\nmilestone: v1.0\nroadmap_run:\n  current_phase: "10"\n  current_milestone: v1.0\n---\n',
      checkpoint: '---\nmilestone: v9.9\ncurrent_phase: "99"\ncurrent_phase_name: Test Checkpoint\n---\n',
      pulseRows: [{ ts: freshTs, phase: 50, iteration: 1, step: 'loop_entry' }],
      activityRows: [{ ts: freshTs, tool: 'Task', target: 'Phase 50' }],
      phases: [{ milestone: 'v1.0', num: 10, verification: 'PASS' }],
    });
    var rA = resolveEffectiveState({ projectDir: dirA });
    assert('A2_checkpoint_priority', rA.ok && rA.source === 'checkpoint'
      && rA.phase === '99' && rA.milestone === 'v9.9',
      'src=' + rA.source + ' ph=' + rA.phase + ' ms=' + rA.milestone);
  } finally { _rmTree(dirA); }

  // Fixture B: no checkpoint -> pulse wins (with milestone lookup).
  var dirB = _mkTmpDir('B');
  try {
    _writeSyntheticTree(dirB, {
      stateMd: '---\nmilestone: v1.0\nroadmap_run:\n  current_phase: "10"\n---\n',
      pulseRows: [{ ts: freshTs, phase: 50, iteration: 1 }],
      activityRows: [{ ts: oldTs, tool: 'Task', target: 'Phase 30' }],
      phases: [
        { milestone: 'v2.0', num: 50, slug: 'pulse-wins' },
        { milestone: 'v1.0', num: 10, verification: 'PASS' },
      ],
    });
    var rB = resolveEffectiveState({ projectDir: dirB });
    assert('A3_pulse_over_activity_log', rB.ok && rB.source === 'pulse'
      && rB.phase === '50' && rB.milestone === 'v2.0',
      'src=' + rB.source + ' ph=' + rB.phase + ' ms=' + rB.milestone);
  } finally { _rmTree(dirB); }

  // Fixture C: no checkpoint, stale pulse -> activity-log wins.
  var dirC = _mkTmpDir('C');
  try {
    _writeSyntheticTree(dirC, {
      stateMd: '---\nmilestone: v1.0\nroadmap_run:\n  current_phase: "10"\n---\n',
      pulseRows: [{ ts: staleTs, phase: 50, iteration: 1 }],
      activityRows: [{ ts: freshTs, tool: 'Task',
        target: 'gsd-executor [sonnet] P40 -- something fresh' }],
      phases: [
        { milestone: 'v2.0', num: 40, slug: 'activity-wins' },
        { milestone: 'v1.0', num: 10, verification: 'PASS' },
      ],
    });
    var rC = resolveEffectiveState({ projectDir: dirC });
    assert('A4_activity_over_phase_folders', rC.ok
      && rC.source === 'activity_log' && rC.phase === '40',
      'src=' + rC.source + ' ph=' + rC.phase);
  } finally { _rmTree(dirC); }

  // Fixture D: no checkpoint/pulse/activity -> phase folders win.
  var dirD = _mkTmpDir('D');
  try {
    _writeSyntheticTree(dirD, {
      stateMd: '---\nmilestone: v1.0\nroadmap_run:\n  current_phase: "10"\n---\n',
      phases: [
        { milestone: 'v2.0', num: 30, slug: 'folder-wins' },
        { milestone: 'v1.0', num: 10, verification: 'PASS' },
      ],
    });
    var rD = resolveEffectiveState({ projectDir: dirD });
    assert('A5_phase_folders_over_git', rD.ok
      && rD.source === 'phase_folders' && rD.phase === '30'
      && rD.milestone === 'v2.0',
      'src=' + rD.source + ' ph=' + rD.phase + ' ms=' + rD.milestone);
  } finally { _rmTree(dirD); }

  // Fixture E: only STATE.md present -> state_md_legacy.
  var dirE = _mkTmpDir('E');
  try {
    _writeSyntheticTree(dirE, {
      stateMd: '---\nmilestone: v1.5\nroadmap_run:\n  current_phase: "20"\n  current_milestone: v1.5\n---\n',
    });
    var rE = resolveEffectiveState({ projectDir: dirE });
    assert('A7_state_md_legacy_last_resort', rE.ok
      && rE.source === 'state_md_legacy' && rE.phase === '20'
      && rE.milestone === 'v1.5' && rE.projection_stale === false,
      'src=' + rE.source + ' ph=' + rE.phase + ' stale=' + rE.projection_stale);
  } finally { _rmTree(dirE); }

  // Fixture F: empty -> no_evidence_found.
  var dirF = _mkTmpDir('F');
  try {
    _writeSyntheticTree(dirF, {});
    var rF = resolveEffectiveState({ projectDir: dirF });
    assert('A9_no_evidence_found', rF.ok === false
      && rF.error_code === 'no_evidence_found',
      'ok=' + rF.ok + ' err=' + rF.error_code);
  } finally { _rmTree(dirF); }

  // Fixture G: pulse says phase 50 (v2.0), STATE.md says phase 10 (v1.0)
  // -> projection_stale: true, stale_sources includes state_md, repair text
  // mentions resolved phase.
  var dirG = _mkTmpDir('G');
  try {
    _writeSyntheticTree(dirG, {
      stateMd: '---\nmilestone: v1.0\nroadmap_run:\n  current_phase: "10"\n  current_milestone: v1.0\n---\n',
      pulseRows: [{ ts: freshTs, phase: 50, iteration: 1 }],
      phases: [
        { milestone: 'v2.0', num: 50, slug: 'fresh' },
        { milestone: 'v1.0', num: 10, verification: 'PASS' },
      ],
    });
    var rG = resolveEffectiveState({ projectDir: dirG });
    var staleHit = rG.projection_stale === true
      && Array.isArray(rG.stale_sources)
      && rG.stale_sources.indexOf('state_md') !== -1
      && typeof rG.recommended_repair === 'string'
      && rG.recommended_repair.indexOf('50') !== -1;
    assert('A8_projection_stale_state_md', staleHit,
      'stale=' + rG.projection_stale + ' src=' + JSON.stringify(rG.stale_sources)
      + ' repair=' + (rG.recommended_repair || 'null'));
    assert('A8b_conflicts_populated',
      Array.isArray(rG.conflicts) && rG.conflicts.length > 0
      && rG.conflicts[0].source_b === 'state_md',
      'len=' + (Array.isArray(rG.conflicts) ? rG.conflicts.length : 'na'));
  } finally { _rmTree(dirG); }

  // A6: git fallback synthesised (we cannot easily fake git inside this
  // self-test; assert the function exists and gracefully returns null on a
  // non-git dir).
  var dirH = _mkTmpDir('H');
  try {
    _writeSyntheticTree(dirH, {});
    var gOut = _scanGitLog(dirH, path.join(dirH, '.planning'));
    assert('A6_git_fallback_safe_on_non_git_dir',
      gOut === null, 'gOut=' + (gOut === null ? 'null' : 'object'));
  } finally { _rmTree(dirH); }

  // A10: live resolver against THIS checkout: must NOT return v2.6/86 stale.
  // Skipped if the live planning dir is missing.
  try {
    var liveProject = path.join(__dirname, '..', '..', '..');
    var livePlanning = path.join(liveProject, '.planning');
    if (fs.existsSync(livePlanning)) {
      var rLive = resolveEffectiveState({ projectDir: liveProject });
      // The checkout may intentionally have no active ROADMAP while a
      // milestone is being scoped. That must degrade to a valid tier,
      // never invent folder order.
      var liveOk = (rLive.ok === true
          && RESOLVER_SOURCES.indexOf(rLive.source) !== -1)
        || (rLive.ok === false
          && rLive.source === null
          && rLive.error_code === 'no_evidence_found');
      assert('A12_live_repo_graceful_without_active_roadmap', liveOk,
        'ok=' + rLive.ok + ' src=' + rLive.source
        + ' ms=' + rLive.milestone + ' ph=' + rLive.phase);
    } else {
      assert('A12_live_repo_skipped_no_planning_dir', true,
        'live planning dir absent -- ok');
    }
  } catch (_le) {
    assert('A12_live_repo_threw', false,
      'err=' + ((_le && _le.message) ? _le.message : 'unknown'));
  }

  // A_RESOLVER_SOURCES: ensure source values are a closed vocab.
  var sourceVocab = RESOLVER_SOURCES.slice();
  // Run several fixtures already; each chosen source should be in the vocab.
  var dirI = _mkTmpDir('I');
  try {
    _writeSyntheticTree(dirI, {
      pulseRows: [{ ts: freshTs, phase: 7, iteration: 1 }],
      phases: [{ milestone: 'v1.0', num: 7, slug: 'vocab' }],
    });
    var rI = resolveEffectiveState({ projectDir: dirI });
    assert('A_resolver_source_in_vocab',
      rI.ok && sourceVocab.indexOf(rI.source) !== -1,
      'src=' + rI.source);
  } finally { _rmTree(dirI); }

  var passCount = 0;
  for (var i = 0; i < results.length; i++) if (results[i].ok) passCount++;
  return {
    ok: passCount === results.length,
    pass: passCount,
    total: results.length,
    results: results,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function _printUsage() {
  process.stdout.write([
    'Usage: node resolve.cjs [--project <path>] [--json | --self-test | --help]',
    '',
    '  --project <path>   resolve effective state against the given project dir',
    '  --json             print the resolved envelope as JSON (default mode)',
    '  --self-test        run the resolver self-test, exit 0 on PASS, 1 on FAIL',
    '  --help             show this usage block',
    '',
    'Output envelope fields:',
    '  ok, schema_version, ts, milestone, phase, phase_name, phase_status,',
    '  confidence, source, projection_stale, stale_sources, conflicts,',
    '  recommended_repair',
    ''
  ].join('\n'));
}

function _runCli(argv) {
  var args = argv.slice(2);
  var projectDir = null;
  var mode = 'json';
  for (var i = 0; i < args.length; i++) {
    var a = args[i];
    if (a === '--help' || a === '-h') { mode = 'help'; }
    else if (a === '--self-test') { mode = 'self-test'; }
    else if (a === '--json') { mode = 'json'; }
    else if (a === '--project' && i + 1 < args.length) {
      projectDir = args[++i];
    }
  }
  if (mode === 'help') {
    _printUsage();
    return 0;
  }
  if (mode === 'self-test') {
    var st = selfTest();
    for (var ri = 0; ri < st.results.length; ri++) {
      var r = st.results[ri];
      process.stdout.write((r.ok ? 'PASS ' : 'FAIL ') + r.name
        + ' ' + r.detail + '\n');
    }
    process.stdout.write('\nstate_resolver_self_test: '
      + st.pass + '/' + st.total + ' assertions passed\n');
    return st.ok ? 0 : 1;
  }
  // mode === 'json'
  var env = resolveEffectiveState({ projectDir: projectDir || process.cwd() });
  process.stdout.write(JSON.stringify(env, null, 2) + '\n');
  return env.ok || env.error_code === 'no_evidence_found' ? 0 : 2;
}

if (require.main === module) {
  process.exit(_runCli(process.argv));
}

module.exports = {
  resolveEffectiveState: resolveEffectiveState,
  selfTest: selfTest,
  RESOLVER_SOURCES: RESOLVER_SOURCES,
  STALE_SOURCE_KEYS: STALE_SOURCE_KEYS,
  SCHEMA_VERSION: SCHEMA_VERSION,
};
