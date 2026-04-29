#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/installer-audit/audit.cjs
// Phase 58-01: Installer Portability Audit (READ-ONLY).
//
// PURPOSE
//   Probe the local environment for the dependencies super-gsd needs to
//   install and run. Each probe is self-contained, READ-ONLY (zero file
//   mutation, zero network), and Lock-13 wrapped so a missing or broken
//   tool never throws -- it returns a degraded sentinel describing what
//   was looked for and why it could not be confirmed.
//
//   Phase 58 ROADMAP-AGENT.md AUDIT WARNING: harden the existing installer
//   + setup; do NOT create a second startup system. This audit is an
//   evidence-gatherer, not a launcher; it has zero install side effects.
//
// 4 PUBLIC APIs (Lock-13 wrapped, mirrors Phase 55/57 surface conventions)
//   - runAudit({planningDir?, projectRoot?})
//       -> {ok, schema_version, ts, probes:[...], summary:{...}, exit_code}
//   - getProbe(name, opts?)
//       -> {ok, name, ...probeShape}  (single-probe accessor)
//   - selfTest()
//       -> {ok, results:[...]} (8-12 assertions)
//   - _internals  (bag of helpers for cross-task composition)
//
// PROBES (>=9; closed-vocab PROBE_NAMES array)
//   - node_version          mandatory (>=20)
//   - npm                   mandatory
//   - git                   mandatory
//   - bash                  mandatory on POSIX, optional on Windows
//   - powershell            optional, helpful on Windows
//   - redis_optional        optional (used by Phase 52 redis-adapter)
//   - docker_optional       optional (used by docker-compose.redis.yml)
//   - codex_cli_optional    optional (used by codex-exec.sh)
//   - claude_cli_optional   optional (used by autonomous-mode permissions)
//   - better_sqlite3_optional optional (used by Phase 46 memory store)
//   - planning_dir_present  evidence (does .planning/ already exist?)
//   - super_gsd_tree_present evidence (does super-gsd/ tree exist?)
//
//   Probe shape (Lock 11 byte-equality on closed enum fields):
//     {
//       name: <PROBE_NAMES entry>,
//       ok: true|false,            // probe ran without throwing
//       version: string|null,      // version string when discoverable
//       source: 'present'|'missing'|'optional',
//       note: string,              // closed-vocab REASON_NOTES entry
//     }
//
// REASON_NOTES (closed vocab)
//   - present_version_captured
//   - present_no_version_command
//   - missing_command_not_found
//   - optional_not_installed
//   - optional_module_missing
//   - mandatory_floor_unmet
//   - read_only_filesystem_probe
//   - probe_internal_error_degraded
//
// LOCK INVARIANTS
//   - Lock 4: Phase 41-57 byte-untouched. We never require() any Phase
//     41-57 module from this file. The probes for the v2.0 toolchain are
//     filesystem existence checks only -- never an import.
//   - Lock 11: probe matching uses byte-equality on closed-vocab fields
//     (source enum, REASON_NOTES enum). No regex on tool names, no
//     fuzzy version match.
//   - Lock 13: every public API and every probe wraps internals in
//     try/catch; never throws upward. spawnSync failure -> degraded
//     sentinel; require() failure -> degraded sentinel; missing path ->
//     missing source.
//   - READ-ONLY: zero fs.writeFileSync, zero fs.appendFileSync, zero
//     fs.mkdirSync, zero fs.unlinkSync. selfTest enforces this by
//     scanning the source for those substrings and asserting absent.
//   - ASCII-only: no smart quotes, no emoji, no non-ASCII literals
//     anywhere. selfTest enforces via first_nonascii_idx === -1.
// =============================================================================

'use strict';

var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var os = require('os');

// ---------------------------------------------------------------------------
// FROZEN SURFACES
// ---------------------------------------------------------------------------
var SCHEMA_VERSION = 1;

var PROBE_NAMES = Object.freeze([
  'node_version',
  'npm',
  'git',
  'bash',
  'powershell',
  'redis_optional',
  'docker_optional',
  'codex_cli_optional',
  'claude_cli_optional',
  'better_sqlite3_optional',
  'planning_dir_present',
  'super_gsd_tree_present',
]);

var SOURCE_VALUES = Object.freeze(['present', 'missing', 'optional']);

var REASON_NOTES = Object.freeze([
  'present_version_captured',
  'present_no_version_command',
  'missing_command_not_found',
  'optional_not_installed',
  'optional_module_missing',
  'mandatory_floor_unmet',
  'read_only_filesystem_probe',
  'probe_internal_error_degraded',
]);

var MANDATORY_PROBES = Object.freeze([
  'node_version',
  'npm',
  'git',
]);

var NODE_FLOOR_MAJOR = 20;

// ---------------------------------------------------------------------------
// Project root resolution. Walks up from __dirname looking for .planning/.
// Defensive: never throws.
// ---------------------------------------------------------------------------
function _resolveProjectRoot(opts) {
  try {
    if (opts && typeof opts.projectRoot === 'string' && opts.projectRoot.length > 0) {
      return path.resolve(opts.projectRoot);
    }
    var cur = path.resolve(__dirname);
    for (var i = 0; i < 8; i++) {
      var probe = path.join(cur, '.planning');
      if (fs.existsSync(probe)) return cur;
      var parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }
    return path.resolve(__dirname, '..', '..', '..');
  } catch (_e) {
    return path.resolve(__dirname, '..', '..', '..');
  }
}

function _resolvePlanningDir(opts) {
  try {
    if (opts && typeof opts.planningDir === 'string' && opts.planningDir.length > 0) {
      if (path.isAbsolute(opts.planningDir)) return opts.planningDir;
      return path.resolve(_resolveProjectRoot(opts), opts.planningDir);
    }
    return path.join(_resolveProjectRoot(opts), '.planning');
  } catch (_e) {
    return path.join(_resolveProjectRoot(opts), '.planning');
  }
}

// ---------------------------------------------------------------------------
// Spawn a command with argv, capture stdout, return {ok, stdout, stderr,
// exit_code}. Never throws (Lock 13).
// ---------------------------------------------------------------------------
function _spawnCapture(cmd, args, timeoutMs) {
  try {
    var r = child_process.spawnSync(cmd, args, {
      encoding: 'utf8',
      timeout: typeof timeoutMs === 'number' ? timeoutMs : 5000,
      windowsHide: true,
      shell: false,
    });
    if (r.error) {
      return {
        ok: false,
        stdout: '',
        stderr: (r.error && r.error.message) ? r.error.message : 'spawn_error',
        exit_code: -1,
      };
    }
    return {
      ok: (typeof r.status === 'number') ? (r.status === 0) : false,
      stdout: typeof r.stdout === 'string' ? r.stdout : '',
      stderr: typeof r.stderr === 'string' ? r.stderr : '',
      exit_code: (typeof r.status === 'number') ? r.status : -1,
    };
  } catch (_e) {
    return { ok: false, stdout: '', stderr: 'spawn_threw', exit_code: -1 };
  }
}

// ---------------------------------------------------------------------------
// Make an empty/sentinel probe. Used to keep PROBE shape canonical even
// when the underlying probe is degraded.
// ---------------------------------------------------------------------------
function _mkProbe(name, ok, version, source, note) {
  return {
    name: name,
    ok: !!ok,
    version: (typeof version === 'string' && version.length > 0) ? version : null,
    source: source,
    note: note,
  };
}

// ---------------------------------------------------------------------------
// PROBE IMPLEMENTATIONS
// Every probe is wrapped by getProbe with a try/catch (Lock 13). Each
// returns a {name, ok, version, source, note} shape using closed-vocab
// SOURCE_VALUES and REASON_NOTES.
// ---------------------------------------------------------------------------

function _probeNodeVersion() {
  var v = process.version || '';
  if (v.charAt(0) === 'v') {
    var rest = v.slice(1);
    var dot = rest.indexOf('.');
    var major = parseInt(dot >= 0 ? rest.slice(0, dot) : rest, 10);
    if (!isNaN(major) && major >= NODE_FLOOR_MAJOR) {
      return _mkProbe('node_version', true, v, 'present', 'present_version_captured');
    }
    return _mkProbe('node_version', false, v, 'missing', 'mandatory_floor_unmet');
  }
  return _mkProbe('node_version', false, null, 'missing', 'missing_command_not_found');
}

function _probeNpm() {
  // npm is the package manager shim; on POSIX it's `npm`, on Windows
  // it's `npm.cmd`. spawnSync without shell:true cannot resolve .cmd
  // extensions on Windows, so we try a sequence of candidate binaries.
  // We also fall back to a PATH lookup via `where` (Win) / `which`
  // (POSIX) so an unusual install layout is still detected.
  var candidates = (process.platform === 'win32')
    ? ['npm.cmd', 'npm.exe', 'npm']
    : ['npm'];
  for (var i = 0; i < candidates.length; i++) {
    var r = _spawnCapture(candidates[i], ['--version'], 4000);
    if (r.ok) {
      var ver = (r.stdout || '').toString().trim().split(/\r?\n/)[0];
      return _mkProbe('npm', true, ver || candidates[i],
        'present',
        ver ? 'present_version_captured' : 'present_no_version_command');
    }
  }
  // PATH fallback: locate the npm shim, then if found mark present
  // without a version (we never invoke a discovered binary blindly).
  var locator = (process.platform === 'win32') ? 'where' : 'which';
  var locArg = (process.platform === 'win32') ? 'npm' : 'npm';
  var loc = _spawnCapture(locator, [locArg], 3000);
  if (loc.ok && loc.stdout && loc.stdout.toString().trim().length > 0) {
    var p = loc.stdout.toString().trim().split(/\r?\n/)[0];
    return _mkProbe('npm', true, p, 'present', 'present_no_version_command');
  }
  return _mkProbe('npm', false, null, 'missing', 'missing_command_not_found');
}

function _probeGit() {
  var r = _spawnCapture('git', ['--version'], 4000);
  if (r.ok) {
    var ver = (r.stdout || '').toString().trim();
    return _mkProbe('git', true, ver || null, 'present', 'present_version_captured');
  }
  return _mkProbe('git', false, null, 'missing', 'missing_command_not_found');
}

function _probeBash() {
  // bash is mandatory on POSIX, optional on Windows (Git Bash / WSL
  // commonly available but not required if the operator uses
  // PowerShell-only flow).
  var r = _spawnCapture('bash', ['--version'], 4000);
  if (r.ok) {
    var firstLine = (r.stdout || '').toString().split(/\r?\n/)[0].trim();
    return _mkProbe('bash', true, firstLine || null, 'present', 'present_version_captured');
  }
  if (process.platform === 'win32') {
    return _mkProbe('bash', false, null, 'optional', 'optional_not_installed');
  }
  return _mkProbe('bash', false, null, 'missing', 'missing_command_not_found');
}

function _probePowerShell() {
  // Optional: helpful on Windows for sgsd-boot.ps1 and dashboard scripts.
  // pwsh is the cross-platform PowerShell 7+; powershell.exe is Win-only.
  var r1 = _spawnCapture('pwsh', ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], 5000);
  if (r1.ok) {
    var ver1 = (r1.stdout || '').toString().trim().split(/\r?\n/)[0];
    return _mkProbe('powershell', true, ver1 || 'pwsh', 'present', 'present_version_captured');
  }
  if (process.platform === 'win32') {
    var r2 = _spawnCapture('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], 5000);
    if (r2.ok) {
      var ver2 = (r2.stdout || '').toString().trim().split(/\r?\n/)[0];
      return _mkProbe('powershell', true, ver2 || 'powershell', 'present', 'present_version_captured');
    }
  }
  return _mkProbe('powershell', false, null, 'optional', 'optional_not_installed');
}

function _probeRedisOptional() {
  // Phase 52 redis-adapter degrades cleanly without Redis; this probe
  // simply records whether `redis-cli ping` returns PONG locally.
  var r = _spawnCapture('redis-cli', ['ping'], 3000);
  if (r.ok) {
    var out = (r.stdout || '').toString().trim();
    if (out === 'PONG') {
      return _mkProbe('redis_optional', true, 'pong', 'present', 'present_version_captured');
    }
    return _mkProbe('redis_optional', false, out, 'optional', 'optional_not_installed');
  }
  return _mkProbe('redis_optional', false, null, 'optional', 'optional_not_installed');
}

function _probeDockerOptional() {
  var r = _spawnCapture('docker', ['--version'], 4000);
  if (r.ok) {
    var ver = (r.stdout || '').toString().trim();
    return _mkProbe('docker_optional', true, ver || null, 'present', 'present_version_captured');
  }
  return _mkProbe('docker_optional', false, null, 'optional', 'optional_not_installed');
}

function _probeCodexCliOptional() {
  var r = _spawnCapture('codex', ['--version'], 4000);
  if (r.ok) {
    var ver = (r.stdout || '').toString().trim();
    return _mkProbe('codex_cli_optional', true, ver || null, 'present', 'present_version_captured');
  }
  return _mkProbe('codex_cli_optional', false, null, 'optional', 'optional_not_installed');
}

function _probeClaudeCliOptional() {
  var r = _spawnCapture('claude', ['--version'], 4000);
  if (r.ok) {
    var ver = (r.stdout || '').toString().trim();
    return _mkProbe('claude_cli_optional', true, ver || null, 'present', 'present_version_captured');
  }
  return _mkProbe('claude_cli_optional', false, null, 'optional', 'optional_not_installed');
}

function _probeBetterSqlite3Optional() {
  // Resolve only; do not require() so we never trigger native bindings.
  try {
    var resolved = require.resolve('better-sqlite3', {
      paths: [_resolveProjectRoot()],
    });
    if (typeof resolved === 'string' && resolved.length > 0) {
      return _mkProbe('better_sqlite3_optional', true, resolved, 'present', 'present_no_version_command');
    }
    return _mkProbe('better_sqlite3_optional', false, null, 'optional', 'optional_module_missing');
  } catch (_e) {
    return _mkProbe('better_sqlite3_optional', false, null, 'optional', 'optional_module_missing');
  }
}

function _probePlanningDirPresent(opts) {
  var p = _resolvePlanningDir(opts);
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      return _mkProbe('planning_dir_present', true, p, 'present', 'read_only_filesystem_probe');
    }
    return _mkProbe('planning_dir_present', false, p, 'missing', 'read_only_filesystem_probe');
  } catch (_e) {
    return _mkProbe('planning_dir_present', false, p, 'missing', 'probe_internal_error_degraded');
  }
}

function _probeSuperGsdTreePresent(opts) {
  var root = _resolveProjectRoot(opts);
  var p = path.join(root, 'super-gsd');
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      // Cross-check: at least one canonical entry under super-gsd/.
      var manifest = path.join(p, 'install.sh');
      if (fs.existsSync(manifest)) {
        return _mkProbe('super_gsd_tree_present', true, p, 'present', 'read_only_filesystem_probe');
      }
      return _mkProbe('super_gsd_tree_present', false, p, 'missing', 'read_only_filesystem_probe');
    }
    return _mkProbe('super_gsd_tree_present', false, p, 'missing', 'read_only_filesystem_probe');
  } catch (_e) {
    return _mkProbe('super_gsd_tree_present', false, p, 'missing', 'probe_internal_error_degraded');
  }
}

// ---------------------------------------------------------------------------
// PROBE DISPATCH
// ---------------------------------------------------------------------------
function _runOneProbe(name, opts) {
  switch (name) {
    case 'node_version':            return _probeNodeVersion();
    case 'npm':                     return _probeNpm();
    case 'git':                     return _probeGit();
    case 'bash':                    return _probeBash();
    case 'powershell':              return _probePowerShell();
    case 'redis_optional':          return _probeRedisOptional();
    case 'docker_optional':         return _probeDockerOptional();
    case 'codex_cli_optional':      return _probeCodexCliOptional();
    case 'claude_cli_optional':     return _probeClaudeCliOptional();
    case 'better_sqlite3_optional': return _probeBetterSqlite3Optional();
    case 'planning_dir_present':    return _probePlanningDirPresent(opts);
    case 'super_gsd_tree_present':  return _probeSuperGsdTreePresent(opts);
    default:
      return _mkProbe(name, false, null, 'missing', 'probe_internal_error_degraded');
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: getProbe (Lock-13 wrapped)
// ---------------------------------------------------------------------------
function getProbe(name, opts) {
  try {
    if (typeof name !== 'string' || PROBE_NAMES.indexOf(name) === -1) {
      return _mkProbe(typeof name === 'string' ? name : '?', false, null,
        'missing', 'probe_internal_error_degraded');
    }
    var p = _runOneProbe(name, opts || {});
    if (!p || typeof p !== 'object') {
      return _mkProbe(name, false, null, 'missing', 'probe_internal_error_degraded');
    }
    return p;
  } catch (_e) {
    return _mkProbe(typeof name === 'string' ? name : '?', false, null,
      'missing', 'probe_internal_error_degraded');
  }
}

// ---------------------------------------------------------------------------
// PUBLIC API: runAudit (Lock-13 wrapped)
// ---------------------------------------------------------------------------
function runAudit(opts) {
  var ts = new Date().toISOString();
  var probes = [];
  for (var i = 0; i < PROBE_NAMES.length; i++) {
    probes.push(getProbe(PROBE_NAMES[i], opts || {}));
  }
  var summary = _summarize(probes);
  var exitCode = summary.mandatory_floor_met ? 0 : 1;
  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    ts: ts,
    probes: probes,
    summary: summary,
    exit_code: exitCode,
  };
}

function _summarize(probes) {
  var present = 0;
  var missing = 0;
  var optional = 0;
  var mandatoryMissing = [];
  for (var i = 0; i < probes.length; i++) {
    var p = probes[i];
    if (!p) continue;
    if (p.source === 'present') present++;
    else if (p.source === 'missing') missing++;
    else if (p.source === 'optional') optional++;
    if (MANDATORY_PROBES.indexOf(p.name) !== -1 && p.source !== 'present') {
      mandatoryMissing.push(p.name);
    }
  }
  return {
    total: probes.length,
    present: present,
    missing: missing,
    optional: optional,
    mandatory_missing: mandatoryMissing,
    mandatory_floor_met: mandatoryMissing.length === 0,
  };
}

// ---------------------------------------------------------------------------
// PUBLIC API: selfTest (Lock-13 wrapped)
// 8-12 assertions covering shape, frozen surfaces, Lock 13, READ-ONLY,
// ASCII-only, and degraded-OK fallback.
// ---------------------------------------------------------------------------
function selfTest() {
  var results = [];
  function add(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  try {
    // A1: PROBE_NAMES length >= 9 and frozen.
    var lenOK = PROBE_NAMES.length >= 9;
    var frozen = Object.isFrozen(PROBE_NAMES);
    add('probe_names_min_9_and_frozen',
      lenOK && frozen,
      'len=' + PROBE_NAMES.length + ' frozen=' + frozen);

    // A2: every probe entry from runAudit() has the canonical shape.
    var snap = runAudit({});
    var shapeOK = Array.isArray(snap.probes) && snap.probes.length === PROBE_NAMES.length;
    if (shapeOK) {
      for (var i = 0; i < snap.probes.length; i++) {
        var p = snap.probes[i];
        if (!p || typeof p.name !== 'string' || typeof p.ok !== 'boolean'
            || (p.version !== null && typeof p.version !== 'string')
            || SOURCE_VALUES.indexOf(p.source) === -1
            || REASON_NOTES.indexOf(p.note) === -1) {
          shapeOK = false;
          break;
        }
      }
    }
    add('every_probe_canonical_shape', shapeOK,
      'count=' + (snap.probes ? snap.probes.length : 0));

    // A3: Lock 13: getProbe with bad name returns degraded sentinel,
    // never throws.
    var threw = false;
    var bad;
    try {
      bad = getProbe('not_a_real_probe_xyz');
    } catch (_e) { threw = true; }
    add('get_probe_bad_name_degraded',
      !threw && bad && bad.ok === false && bad.source === 'missing'
        && bad.note === 'probe_internal_error_degraded',
      'note=' + (bad ? bad.note : 'null'));

    // A4: Lock 13: getProbe with non-string returns degraded sentinel,
    // never throws.
    var threw2 = false;
    var bad2;
    try {
      bad2 = getProbe(123);
    } catch (_e) { threw2 = true; }
    add('get_probe_non_string_degraded',
      !threw2 && bad2 && bad2.ok === false && bad2.source === 'missing',
      'threw=' + threw2);

    // A5: node_version probe ALWAYS reports present (this very file is
    // running on Node, so the floor must be met).
    var nv = getProbe('node_version');
    add('node_version_present',
      nv && nv.ok === true && nv.source === 'present',
      'version=' + (nv && nv.version ? nv.version : '?'));

    // A6: super_gsd_tree_present detects the tree when invoked from
    // within it.
    var sgsd = getProbe('super_gsd_tree_present');
    add('super_gsd_tree_detected',
      sgsd && sgsd.ok === true && sgsd.source === 'present',
      'path=' + (sgsd && sgsd.version ? sgsd.version : '?'));

    // A7: ASCII-only of audit.cjs source.
    var src = '';
    try { src = fs.readFileSync(__filename, 'utf8'); } catch (_e) { src = ''; }
    var firstNonAscii = -1;
    for (var j = 0; j < src.length; j++) {
      var c = src.charCodeAt(j);
      if (c > 0x7E || (c < 0x20 && c !== 0x09 && c !== 0x0A && c !== 0x0D)) {
        firstNonAscii = j;
        break;
      }
    }
    add('ascii_only_source',
      firstNonAscii === -1,
      'first_nonascii_idx=' + firstNonAscii);

    // A8: READ-ONLY invariant: audit.cjs CODE contains zero mutating fs
    // calls. We strip pure comment lines (// or leading *) before
    // scanning so the assertion does not self-trigger on doc strings or
    // on its own assertion text. Tokens are assembled from substrings so
    // they cannot appear contiguously even in code-mode.
    var FS = 'fs.';
    var bannedTokens = [
      FS + 'write' + 'FileSync',
      FS + 'append' + 'FileSync',
      FS + 'unlink' + 'Sync',
      FS + 'mkdir' + 'Sync',
      FS + 'rm' + 'Sync',
      FS + 'rmdir' + 'Sync',
    ];
    var srcLines = src.split(/\r?\n/);
    var codeOnly = '';
    for (var ki = 0; ki < srcLines.length; ki++) {
      var ln = srcLines[ki];
      var lt = ln.replace(/^\s+/, '');
      if (lt.indexOf('//') === 0) continue;
      if (lt.indexOf('*') === 0) continue;
      codeOnly += ln + '\n';
    }
    var hasWrite = false;
    for (var bi = 0; bi < bannedTokens.length; bi++) {
      if (codeOnly.indexOf(bannedTokens[bi]) !== -1) { hasWrite = true; break; }
    }
    add('read_only_invariant',
      hasWrite === false,
      'hasWrite=' + hasWrite);

    // A9: source enum values are exactly 'present'|'missing'|'optional'
    // and frozen.
    var srcEnumOK = SOURCE_VALUES.length === 3
                 && SOURCE_VALUES[0] === 'present'
                 && SOURCE_VALUES[1] === 'missing'
                 && SOURCE_VALUES[2] === 'optional'
                 && Object.isFrozen(SOURCE_VALUES);
    add('source_values_frozen_3_entries', srcEnumOK,
      'len=' + SOURCE_VALUES.length);

    // A10: REASON_NOTES is frozen and includes the 8 closed-vocab notes.
    var reasonsOK = REASON_NOTES.length === 8 && Object.isFrozen(REASON_NOTES)
                 && REASON_NOTES.indexOf('present_version_captured') !== -1
                 && REASON_NOTES.indexOf('mandatory_floor_unmet') !== -1
                 && REASON_NOTES.indexOf('probe_internal_error_degraded') !== -1;
    add('reason_notes_frozen_8_entries', reasonsOK,
      'len=' + REASON_NOTES.length);

    // A11: runAudit summary shape.
    var sumOK = snap && snap.summary
              && typeof snap.summary.total === 'number'
              && typeof snap.summary.present === 'number'
              && typeof snap.summary.missing === 'number'
              && typeof snap.summary.optional === 'number'
              && Array.isArray(snap.summary.mandatory_missing)
              && typeof snap.summary.mandatory_floor_met === 'boolean';
    add('summary_shape_ok', sumOK,
      'total=' + (sumOK ? snap.summary.total : '?'));

    // A12: schema_version is 1 (locked).
    add('schema_version_locked',
      snap && snap.schema_version === SCHEMA_VERSION,
      'schema_version=' + (snap ? snap.schema_version : '?'));

    return {
      ok: results.every(function (r) { return r.ok; }),
      results: results,
    };
  } catch (e) {
    add('self_test_outer_threw', false,
      'message=' + (e && e.message ? e.message : 'unknown'));
    return { ok: false, results: results };
  }
}

// ---------------------------------------------------------------------------
// _internals (cross-task composition)
// ---------------------------------------------------------------------------
var _internals = {
  PROBE_NAMES: PROBE_NAMES,
  SOURCE_VALUES: SOURCE_VALUES,
  REASON_NOTES: REASON_NOTES,
  MANDATORY_PROBES: MANDATORY_PROBES,
  NODE_FLOOR_MAJOR: NODE_FLOOR_MAJOR,
  SCHEMA_VERSION: SCHEMA_VERSION,
  _spawnCapture: _spawnCapture,
  _resolveProjectRoot: _resolveProjectRoot,
  _resolvePlanningDir: _resolvePlanningDir,
  _mkProbe: _mkProbe,
  _runOneProbe: _runOneProbe,
  _summarize: _summarize,
};

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------
function _printSelfTest(out) {
  if (!out || !Array.isArray(out.results)) {
    process.stdout.write('audit_self_test: results not an array\n');
    return false;
  }
  var pass = 0;
  for (var i = 0; i < out.results.length; i++) {
    var r = out.results[i];
    var tag = r.ok ? 'PASS' : 'FAIL';
    process.stdout.write(tag + ' ' + r.name + ' ' + (r.detail || '') + '\n');
    if (r.ok) pass++;
  }
  process.stdout.write('---\n');
  process.stdout.write('audit_self_test: ' + pass + '/' + out.results.length
    + ' assertions passed\n');
  return pass === out.results.length;
}

function _printRun(out) {
  if (!out || !Array.isArray(out.probes)) {
    process.stdout.write('audit_run: no probes\n');
    return 1;
  }
  process.stdout.write('audit_run schema_version=' + out.schema_version
    + ' ts=' + out.ts + '\n');
  for (var i = 0; i < out.probes.length; i++) {
    var p = out.probes[i];
    process.stdout.write('  '
      + (p.ok ? 'OK   ' : 'FAIL ')
      + p.name + ' source=' + p.source
      + ' version=' + (p.version || 'null')
      + ' note=' + p.note + '\n');
  }
  process.stdout.write('---\n');
  process.stdout.write('audit_summary total=' + out.summary.total
    + ' present=' + out.summary.present
    + ' missing=' + out.summary.missing
    + ' optional=' + out.summary.optional
    + ' mandatory_floor_met=' + out.summary.mandatory_floor_met + '\n');
  if (out.summary.mandatory_missing.length > 0) {
    process.stdout.write('audit_mandatory_missing: '
      + out.summary.mandatory_missing.join(',') + '\n');
  }
  return out.exit_code;
}

function _argValue(args, key) {
  for (var i = 0; i < args.length; i++) {
    if (args[i] === key && i + 1 < args.length) return args[i + 1];
    if (args[i] && args[i].indexOf(key + '=') === 0) {
      return args[i].slice(key.length + 1);
    }
  }
  return null;
}

function _main(argv) {
  try {
    var args = argv.slice(2);
    if (args.indexOf('--self-test') !== -1) {
      var out = selfTest();
      var allOK = _printSelfTest(out);
      process.exit(allOK ? 0 : 1);
      return;
    }
    if (args.indexOf('--run') !== -1
        || args.indexOf('--audit') !== -1
        || args.length === 0) {
      var pd = _argValue(args, '--planning-dir');
      var pr = _argValue(args, '--project-root');
      var snap = runAudit({
        planningDir: pd || undefined,
        projectRoot: pr || undefined,
      });
      var code = _printRun(snap);
      process.exit(code);
      return;
    }
    process.stdout.write('usage: node audit.cjs [--run|--self-test]'
      + ' [--planning-dir <path>] [--project-root <path>]\n');
    process.exit(0);
  } catch (e) {
    process.stderr.write('audit_internal_error message='
      + (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  _main(process.argv);
}

module.exports = {
  runAudit: runAudit,
  getProbe: getProbe,
  selfTest: selfTest,
  _internals: _internals,
};
