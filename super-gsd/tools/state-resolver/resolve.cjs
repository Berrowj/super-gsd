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
//   4. phase folders                (newest NN)            confidence 0.65-0.70
//   5. git log                      (feat(pNN) commits)    confidence 0.60
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

function _countLeadingSpaces(s) {
  var n = 0;
  while (n < s.length && s.charAt(n) === ' ') n++;
  return n;
}

// Mirror of the warp-mcp / cockpit-state frontmatter parser. Returns null
// on any failure. Never throws.
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
    var stack = [{ obj: out, indent: -1 }];
    for (var li = 1; li < endIdx; li++) {
      var raw = lines[li];
      if (typeof raw !== 'string') continue;
      var trimmed = raw.replace(/^\s+|\s+$/g, '');
      if (trimmed.length === 0) continue;
      if (trimmed.charAt(0) === '#') continue;
      var indent = _countLeadingSpaces(raw);
      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      var parent = stack[stack.length - 1].obj;
      var colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;
      var key = trimmed.slice(0, colonIdx).replace(/^\s+|\s+$/g, '');
      var val = trimmed.slice(colonIdx + 1).replace(/^\s+|\s+$/g, '');
      if (key.charAt(0) === '-') continue;
      if (key.length === 0) continue;
      if (val.length === 0) {
        var child = {};
        parent[key] = child;
        stack.push({ obj: child, indent: indent });
      } else {
        parent[key] = _stripQuotes(val);
      }
    }
    return out;
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

function _phaseFolderName(phasesDir, phaseNum) {
  try {
    if (!fs.existsSync(phasesDir)) return null;
    var entries = fs.readdirSync(phasesDir);
    var pad2 = (String(phaseNum).length === 1) ? ('0' + phaseNum) : String(phaseNum);
    for (var i = 0; i < entries.length; i++) {
      var en = entries[i];
      if (typeof en !== 'string') continue;
      if (en.indexOf(pad2 + '-') === 0 || en.indexOf(String(phaseNum) + '-') === 0) {
        return en;
      }
    }
    return null;
  } catch (_e) { return null; }
}

function _phaseNameFromFolder(folderName) {
  try {
    var m = String(folderName).match(/^\d+-(.+)$/);
    if (!m) return null;
    var slug = m[1];
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

function _phaseStatusFromFolder(phaseDir, phaseNum) {
  try {
    if (!fs.existsSync(phaseDir)) return null;
    var pad2 = (String(phaseNum).length === 1) ? ('0' + phaseNum) : String(phaseNum);
    var verPath = path.join(phaseDir, pad2 + '-VERIFICATION.md');
    if (!fs.existsSync(verPath)) return null;
    var fm = _parseFrontmatter(verPath);
    if (!fm) return null;
    if (typeof fm.status === 'string' && fm.status.length > 0) return fm.status;
    if (typeof fm.verdict === 'string' && fm.verdict.length > 0) return fm.verdict;
    return null;
  } catch (_e) { return null; }
}

// Walk planning/milestones to find the highest-numbered milestone + the
// highest-numbered phase folder under it. Returns
// { milestone, phase, phase_name, phase_status, phase_dir } or null.
function _scanPhaseFolders(planningDir) {
  try {
    var milestonesDir = path.join(planningDir, 'milestones');
    if (!fs.existsSync(milestonesDir)) return null;
    var milestoneEntries = fs.readdirSync(milestonesDir);
    var milestoneVersions = [];
    for (var i = 0; i < milestoneEntries.length; i++) {
      var me = milestoneEntries[i];
      if (typeof me !== 'string') continue;
      // Match v{major}.{minor}, treat (major*1000+minor) as sort key.
      var mm = me.match(/^v(\d+)\.(\d+)$/);
      if (!mm) continue;
      var major = parseInt(mm[1], 10);
      var minor = parseInt(mm[2], 10);
      if (isNaN(major) || isNaN(minor)) continue;
      milestoneVersions.push({
        name: me,
        sortKey: major * 1000 + minor,
      });
    }
    if (milestoneVersions.length === 0) return null;
    milestoneVersions.sort(function (a, b) { return b.sortKey - a.sortKey; });
    // Highest milestone first; walk down until we find one with phases.
    for (var mi = 0; mi < milestoneVersions.length; mi++) {
      var milestone = milestoneVersions[mi].name;
      var phasesDir = path.join(milestonesDir, milestone, 'phases');
      if (!fs.existsSync(phasesDir)) continue;
      var phaseEntries = [];
      try { phaseEntries = fs.readdirSync(phasesDir); } catch (_re) { continue; }
      var phases = [];
      for (var pi = 0; pi < phaseEntries.length; pi++) {
        var pe = phaseEntries[pi];
        if (typeof pe !== 'string') continue;
        var pm = pe.match(/^(\d+)-/);
        if (!pm) continue;
        var num = parseInt(pm[1], 10);
        if (isNaN(num)) continue;
        phases.push({ name: pe, num: num });
      }
      if (phases.length === 0) continue;
      phases.sort(function (a, b) { return b.num - a.num; });
      var highest = phases[0];
      var highestDir = path.join(phasesDir, highest.name);
      var highestStatus = _phaseStatusFromFolder(highestDir, highest.num);
      // If highest is closed (PASS or PASS-WITH-DEFERRED-N), check for a
      // next-numbered phase candidate with CONTEXT.md but no
      // VERIFICATION.md -- that is the new active phase.
      var isClosed = false;
      if (typeof highestStatus === 'string') {
        var s = highestStatus.toUpperCase();
        if (s.indexOf('PASS') === 0) isClosed = true;
      }
      if (isClosed) {
        var nextNum = highest.num + 1;
        var nextFolder = _phaseFolderName(phasesDir, nextNum);
        if (nextFolder) {
          var nextDir = path.join(phasesDir, nextFolder);
          var nextStatus = _phaseStatusFromFolder(nextDir, nextNum);
          // Confirm CONTEXT.md exists (phase has scope). VERIFICATION
          // absent or in-progress means active.
          var pad2 = (String(nextNum).length === 1) ? ('0' + nextNum) : String(nextNum);
          var ctxPath = path.join(nextDir, pad2 + '-CONTEXT.md');
          if (fs.existsSync(ctxPath)) {
            return {
              milestone: milestone,
              phase: String(nextNum),
              phase_name: _phaseNameFromFolder(nextFolder),
              phase_status: (typeof nextStatus === 'string') ? nextStatus : 'in-progress',
              phase_dir: nextDir,
              from_next_after_close: true,
            };
          }
        }
        // No next phase scoped -- highest is the last one, and it's closed.
        return {
          milestone: milestone,
          phase: String(highest.num),
          phase_name: _phaseNameFromFolder(highest.name),
          phase_status: highestStatus,
          phase_dir: highestDir,
          from_next_after_close: false,
        };
      }
      return {
        milestone: milestone,
        phase: String(highest.num),
        phase_name: _phaseNameFromFolder(highest.name),
        phase_status: (typeof highestStatus === 'string') ? highestStatus : 'in-progress',
        phase_dir: highestDir,
        from_next_after_close: false,
      };
    }
    return null;
  } catch (_e) { return null; }
}

// Run `git log --oneline -50` against projectDir; scan messages for
// feat(pNN-..) or feat(pNN.. patterns; return the highest NN and
// matching milestone (looked up via phase folders).
function _scanGitLog(projectDir, planningDir) {
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
    var highestNum = -1;
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i];
      if (typeof ln !== 'string') continue;
      var m = ln.match(/feat\(p(\d+)/i);
      if (m) {
        var n = parseInt(m[1], 10);
        if (!isNaN(n) && n > highestNum) highestNum = n;
      }
    }
    if (highestNum === -1) return null;
    // Look up milestone by checking phase folders.
    var milestonesDir = path.join(planningDir, 'milestones');
    if (!fs.existsSync(milestonesDir)) return null;
    var milestoneEntries = fs.readdirSync(milestonesDir);
    for (var j = 0; j < milestoneEntries.length; j++) {
      var me = milestoneEntries[j];
      if (typeof me !== 'string') continue;
      var phasesDir = path.join(milestonesDir, me, 'phases');
      var folder = _phaseFolderName(phasesDir, highestNum);
      if (folder) {
        return {
          milestone: me,
          phase: String(highestNum),
          phase_name: _phaseNameFromFolder(folder),
        };
      }
    }
    // Found commit but no folder -- return phase number alone.
    return {
      milestone: null,
      phase: String(highestNum),
      phase_name: null,
    };
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
      if (fm) {
        var rr = (fm.roadmap_run && typeof fm.roadmap_run === 'object')
          ? fm.roadmap_run : {};
        var smMilestone = (typeof rr.current_milestone === 'string'
          && rr.current_milestone.length > 0)
          ? rr.current_milestone
          : ((typeof fm.milestone === 'string') ? fm.milestone : null);
        var smPhase = (typeof rr.current_phase === 'string'
          && rr.current_phase.length > 0)
          ? rr.current_phase : null;
        var smPhaseName = (typeof rr.current_phase_name === 'string')
          ? rr.current_phase_name : null;
        var smPhaseStatus = (typeof rr.current_phase_status === 'string')
          ? rr.current_phase_status : null;
        stateMd = {
          milestone: smMilestone,
          phase: smPhase,
          phase_name: smPhaseName,
          phase_status: smPhaseStatus,
        };
      }
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
            var ckpPhase = (typeof ckpFm.current_phase === 'string')
              ? ckpFm.current_phase
              : (typeof ckpFm.phase === 'string') ? ckpFm.phase : null;
            if (ckpPhase) {
              resolved = {
                milestone: ckpMilestone,
                phase: String(ckpPhase),
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
            // Phase number can be int or string in pulse rows.
            var pulsePhase = lastPulse.row.phase;
            if (typeof pulsePhase === 'number') pulsePhase = String(pulsePhase);
            if (typeof pulsePhase === 'string' && pulsePhase.length > 0) {
              // Milestone is not in pulse rows -- look up via phase folders.
              var resolvedMilestone = null;
              var resolvedPhaseName = null;
              try {
                var milestonesDir = path.join(planningDir, 'milestones');
                if (fs.existsSync(milestonesDir)) {
                  var msEntries = fs.readdirSync(milestonesDir);
                  // Search highest version first.
                  var versionsForPulse = [];
                  for (var pi = 0; pi < msEntries.length; pi++) {
                    var msE = msEntries[pi];
                    if (typeof msE !== 'string') continue;
                    var msMm = msE.match(/^v(\d+)\.(\d+)$/);
                    if (!msMm) continue;
                    versionsForPulse.push({
                      name: msE,
                      sortKey: parseInt(msMm[1], 10) * 1000 + parseInt(msMm[2], 10),
                    });
                  }
                  versionsForPulse.sort(function (a, b) { return b.sortKey - a.sortKey; });
                  for (var vp = 0; vp < versionsForPulse.length; vp++) {
                    var vName = versionsForPulse[vp].name;
                    var phasesDirForPulse = path.join(milestonesDir, vName, 'phases');
                    var folderForPulse = _phaseFolderName(phasesDirForPulse, pulsePhase);
                    if (folderForPulse) {
                      resolvedMilestone = vName;
                      resolvedPhaseName = _phaseNameFromFolder(folderForPulse);
                      break;
                    }
                  }
                }
              } catch (_lme) { /* leave nulls */ }
              resolved = {
                milestone: resolvedMilestone,
                phase: pulsePhase,
                phase_name: resolvedPhaseName,
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
          var pathMatch = probe.match(/\.planning[\\\/]milestones[\\\/](v\d+(?:\.\d+)?)[\\\/]phases[\\\/](\d+)-/i);
          if (pathMatch) {
            foundMilestone = pathMatch[1];
            foundPhase = pathMatch[2];
            break;
          }
          var phaseMatch = probe.match(/\bP(\d{2,3})\b/);
          if (phaseMatch) {
            foundPhase = phaseMatch[1];
            // Try to look up milestone via phase folders.
            try {
              var msDir = path.join(planningDir, 'milestones');
              if (fs.existsSync(msDir)) {
                var msNames = fs.readdirSync(msDir);
                for (var msi = 0; msi < msNames.length; msi++) {
                  var msNm = msNames[msi];
                  if (typeof msNm !== 'string') continue;
                  if (!/^v\d+\.\d+$/.test(msNm)) continue;
                  var pdir = path.join(msDir, msNm, 'phases');
                  var fld = _phaseFolderName(pdir, parseInt(foundPhase, 10));
                  if (fld) { foundMilestone = msNm; break; }
                }
              }
            } catch (_le) { /* leave milestone null */ }
            break;
          }
        }
        if (foundPhase) {
          // Look up phase name via folder if milestone present.
          var actPhaseName = null;
          if (foundMilestone) {
            var actPhasesDir = path.join(planningDir, 'milestones', foundMilestone, 'phases');
            var actFolder = _phaseFolderName(actPhasesDir, parseInt(foundPhase, 10));
            if (actFolder) actPhaseName = _phaseNameFromFolder(actFolder);
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

    // -- Priority 4: phase folders (newest NN) --
    if (!resolved) {
      try {
        var pf = _scanPhaseFolders(planningDir);
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

    // -- Priority 5: git log feat(pNN..) --
    if (!resolved) {
      try {
        var g = _scanGitLog(projectDir, planningDir);
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
      // Acceptance: resolver must not be source state_md_legacy on this
      // checkout (something fresher should win).
      var liveOk = rLive.ok === true
        && rLive.source !== 'state_md_legacy';
      assert('A12_live_repo_not_state_md_legacy', liveOk,
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
  return env.ok ? 0 : 2;
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
