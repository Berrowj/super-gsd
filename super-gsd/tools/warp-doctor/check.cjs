#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/warp-doctor/check.cjs
// Phase 67-01: Warp + SGSD setup diagnostic (READ-ONLY).
//
// PURPOSE
//   Probe the local checkout + operator environment for Warp + SGSD setup
//   health and emit a concise table or JSON envelope. The doctor NEVER
//   writes, appends, unlinks, or mkdirs anywhere on disk; selfTest A8
//   enforces this by scanning this very source for those banned tokens.
//
//   The probe set is seeded from Phase 63 audit findings
//   (.planning/milestones/v2.2/phases/63-warp-capability-smoke/63-RESEARCH.md
//   sections A-G). The doctor is the canonical "is my Warp + SGSD install
//   healthy?" surface that v2.2+ depends on.
//
//   ROADMAP-AGENT verbatim goal (warp-integration/ROADMAP.md Phase 67):
//     "Implement super-gsd/tools/warp-doctor/check.cjs ... Output concise
//      table. Add self-test with fixture repo. No write operations."
//
// 4 PUBLIC APIs (Lock-13 wrapped, mirrors Phase 62 upgrade-drift shape)
//   - runWarpDoctor({projectDir, env?})
//       -> {ok, schema_version, ts, probes:[...], summary:{...}, exit_code}
//   - getProbe(name, opts?)
//       -> {ok, name, status, present, evidence, reason}
//   - selfTest()
//       -> {ok, results:[...]}     (12-15 assertions)
//   - _internals  (helper bag for cross-task composition)
//
// PROBES (16 entries; closed-vocab PROBE_NAMES array)
//   1.  warp_env_present                       -- env.TERM_PROGRAM === 'WarpTerminal'
//   2.  sg_command_defined_in_profile          -- grep "function sg {" in $PROFILE
//   3.  sgsd_command_defined_in_profile        -- grep "function sgsd {" in $PROFILE
//   4.  sgsd_setup_command_defined_in_profile  -- grep "function sgsd-setup {" in $PROFILE
//   5.  warp_workflows_dir_present             -- Test-Path .warp/workflows
//   6.  warp_workflows_yaml_shape              -- each yaml parses + has name/command/tags
//   7.  warp_md_present                        -- repo/WARP.md
//   8.  agents_md_present                      -- repo/AGENTS.md (Phase 65 deliverable)
//   9.  claude_md_present                      -- repo/CLAUDE.md
//   10. launch_config_dir_present              -- ~/.warp/launch_configurations/
//   11. warpindexingignore_present             -- repo/.warpindexingignore
//   12. warp_install_present                   -- Warp.exe at standard install path
//   13. claude_cli_resolvable                  -- claude on PATH
//   14. codex_cli_resolvable                   -- codex on PATH
//   15. mcp_config_present                     -- placeholder; NOT-APPLICABLE until v2.3
//   16. codebase_context_state                 -- always MANUAL-CHECK-REQUIRED (UI-bound)
//
//   PROBE_NAMES is Object.freeze'd; selfTest A1 verifies length=16 and frozen.
//
// STATUS_VALUES (closed vocab, frozen, len=5)
//   - PASS                       (probe found expected evidence)
//   - MISSING                    (probe ran, expected evidence absent)
//   - MANUAL-CHECK-REQUIRED      (UI-bound; cannot be probed from terminal)
//   - NOT-APPLICABLE             (probe not relevant on this host/version)
//   - DEGRADED                   (probe threw; Lock-13 caught; sentinel returned)
//
// REASON_NOTES (closed vocab, frozen)
//   present_env_var_match / present_profile_function_match /
//   present_dir_found / present_file_found / present_yaml_shape_ok /
//   present_path_on_path / missing_env_var / missing_profile / missing_function /
//   missing_dir / missing_file / missing_yaml_shape / missing_path / not_applicable_non_windows /
//   not_applicable_v2_3_not_shipped / manual_check_ui_bound /
//   probe_internal_error_degraded
//
// LOCK INVARIANTS
//   - Lock 4: existing tool trees byte-untouched. The doctor never require()s
//     upstream Phase 41-66 modules. It uses fs.existsSync + fs.readFileSync
//     + path.join only.
//   - Lock 11: closed-vocab indexOf / Set membership on PROBE_NAMES + STATUS_VALUES
//     + REASON_NOTES. No regex/fuzzy matching on these enums.
//   - Lock 13: try/catch wraps every probe + every public API. Bad inputs
//     return degraded sentinel without throwing upward.
//   - READ-ONLY: zero filesystem write/append/unlink/mkdir/rm/rmdir
//     synchronous calls anywhere in the source. selfTest A8 builds the
//     banned token list dynamically (string concatenation) and scans this
//     file for any literal occurrence; finding even one fails the gate.
//   - ASCII-only: first_nonascii_idx === -1 across this file. selfTest A11.
//
// ASCII-only.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const SCHEMA_VERSION = 1;

// -- Frozen vocabulary -------------------------------------------------------

const PROBE_NAMES = Object.freeze([
  'warp_env_present',
  'sg_command_defined_in_profile',
  'sgsd_command_defined_in_profile',
  'sgsd_setup_command_defined_in_profile',
  'warp_workflows_dir_present',
  'warp_workflows_yaml_shape',
  'warp_md_present',
  'agents_md_present',
  'claude_md_present',
  'launch_config_dir_present',
  'warpindexingignore_present',
  'warp_install_present',
  'claude_cli_resolvable',
  'codex_cli_resolvable',
  'mcp_config_present',
  'codebase_context_state'
]);

const STATUS_VALUES = Object.freeze([
  'PASS',
  'MISSING',
  'MANUAL-CHECK-REQUIRED',
  'NOT-APPLICABLE',
  'DEGRADED'
]);

const REASON_NOTES = Object.freeze([
  'present_env_var_match',
  'present_profile_function_match',
  'present_dir_found',
  'present_file_found',
  'present_yaml_shape_ok',
  'present_path_on_path',
  'missing_env_var',
  'missing_profile',
  'missing_function',
  'missing_dir',
  'missing_file',
  'missing_yaml_shape',
  'missing_path',
  'not_applicable_non_windows',
  'not_applicable_v2_3_not_shipped',
  'manual_check_ui_bound',
  'probe_internal_error_degraded'
]);

const REQUIRED_YAML_KEYS = Object.freeze(['name', 'command', 'tags']);

// -- Internals ---------------------------------------------------------------

function _resolveProjectDir(projectDir) {
  if (projectDir && typeof projectDir === 'string') {
    return path.resolve(projectDir);
  }
  return process.cwd();
}

function _findPowerShellProfile() {
  // Standard PowerShell 5.1 profile locations on Windows. We don't spawn
  // PowerShell -- we inspect the file directly.
  const home = os.homedir();
  const candidates = [
    path.join(home, 'OneDrive - John Cullen Lighting', 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(home, 'OneDrive', 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'),
    path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1')
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return c;
      }
    } catch (_e) { /* ignore */ }
  }
  return null;
}

function _grepProfileForFunction(funcName) {
  const profile = _findPowerShellProfile();
  if (!profile) {
    return { found: false, evidence: null, profile: null };
  }
  try {
    const txt = fs.readFileSync(profile, 'utf8');
    const re = new RegExp('^\\s*function\\s+' + funcName.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\s*\\{', 'm');
    const found = re.test(txt);
    return { found, evidence: found ? profile : null, profile };
  } catch (_e) {
    return { found: false, evidence: null, profile };
  }
}

function _checkPathOnSystem(cmd) {
  // Cross-platform check: try `where` on Windows, `which` elsewhere.
  const isWin = process.platform === 'win32';
  try {
    const out = execSync(
      isWin ? 'where ' + cmd : 'which ' + cmd,
      { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
    ).toString().trim();
    return out.length > 0 ? out.split(/\r?\n/)[0] : null;
  } catch (_e) {
    return null;
  }
}

function _readWarpWorkflowsList(projectDir) {
  const dir = path.join(projectDir, '.warp', 'workflows');
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return null;
    }
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map(f => path.join(dir, f));
  } catch (_e) {
    return null;
  }
}

function _liteYamlShapeCheck(yamlPath) {
  // Lightweight shape check: does the file contain "name:", "command:", "tags:"
  // each at column 0 of some line. Doesn't require a YAML parser dep.
  try {
    const txt = fs.readFileSync(yamlPath, 'utf8');
    const findings = {};
    for (const k of REQUIRED_YAML_KEYS) {
      findings[k] = new RegExp('^' + k + ':\\s', 'm').test(txt);
    }
    const ok = REQUIRED_YAML_KEYS.every(k => findings[k]);
    return { ok, findings, file: yamlPath };
  } catch (_e) {
    return { ok: false, findings: null, file: yamlPath };
  }
}

function _windowsWarpInstallCandidates(home) {
  return [
    path.join(home, 'AppData', 'Local', 'Programs', 'Warp', 'Warp.exe'),
    'C:\\Program Files\\Warp\\Warp.exe',
    'C:\\Program Files\\WarpDotDev\\WarpDotDev.exe',
    path.join(home, 'AppData', 'Local', 'WarpDotDev', 'WarpDotDev.exe'),
    path.join(home, 'AppData', 'Local', 'Programs', 'WarpDotDev', 'WarpDotDev.exe')
  ];
}

// -- Probe implementations --------------------------------------------------

function _probe_warp_env_present(env) {
  try {
    const t = (env && env.TERM_PROGRAM) || '';
    const found = t === 'WarpTerminal';
    return _mkProbe('warp_env_present',
      found ? 'PASS' : 'MISSING',
      found ? 'TERM_PROGRAM=WarpTerminal' : 'TERM_PROGRAM=' + (t || '<unset>'),
      found ? 'present_env_var_match' : 'missing_env_var');
  } catch (e) {
    return _degraded('warp_env_present', e);
  }
}

function _probe_function_in_profile(probeName, funcName) {
  try {
    if (process.platform !== 'win32') {
      return _mkProbe(probeName, 'NOT-APPLICABLE', 'profile-grep is Windows-only', 'not_applicable_non_windows');
    }
    const r = _grepProfileForFunction(funcName);
    if (!r.profile) {
      return _mkProbe(probeName, 'MISSING', 'no PowerShell profile found at standard paths', 'missing_profile');
    }
    if (!r.found) {
      return _mkProbe(probeName, 'MISSING', 'profile=' + r.profile + '; function ' + funcName + ' not defined', 'missing_function');
    }
    return _mkProbe(probeName, 'PASS', r.evidence, 'present_profile_function_match');
  } catch (e) {
    return _degraded(probeName, e);
  }
}

function _probe_warp_workflows_dir(projectDir) {
  try {
    const dir = path.join(projectDir, '.warp', 'workflows');
    const exists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    return _mkProbe('warp_workflows_dir_present',
      exists ? 'PASS' : 'MISSING',
      dir,
      exists ? 'present_dir_found' : 'missing_dir');
  } catch (e) {
    return _degraded('warp_workflows_dir_present', e);
  }
}

function _probe_warp_workflows_yaml_shape(projectDir) {
  try {
    const list = _readWarpWorkflowsList(projectDir);
    if (!list) {
      return _mkProbe('warp_workflows_yaml_shape', 'MISSING', '.warp/workflows missing', 'missing_dir');
    }
    if (list.length === 0) {
      return _mkProbe('warp_workflows_yaml_shape', 'MISSING', 'no .yaml files in .warp/workflows', 'missing_yaml_shape');
    }
    const results = list.map(_liteYamlShapeCheck);
    const failing = results.filter(r => !r.ok);
    if (failing.length === 0) {
      return _mkProbe('warp_workflows_yaml_shape', 'PASS',
        results.length + '/' + results.length + ' workflows have name+command+tags',
        'present_yaml_shape_ok');
    }
    const failNames = failing.map(f => path.basename(f.file)).join(', ');
    return _mkProbe('warp_workflows_yaml_shape', 'MISSING',
      (results.length - failing.length) + '/' + results.length + ' OK; failing: ' + failNames,
      'missing_yaml_shape');
  } catch (e) {
    return _degraded('warp_workflows_yaml_shape', e);
  }
}

function _probe_repo_file(probeName, projectDir, fileName) {
  try {
    const p = path.join(projectDir, fileName);
    const exists = fs.existsSync(p) && fs.statSync(p).isFile();
    return _mkProbe(probeName,
      exists ? 'PASS' : 'MISSING',
      p,
      exists ? 'present_file_found' : 'missing_file');
  } catch (e) {
    return _degraded(probeName, e);
  }
}

function _probe_launch_config_dir() {
  try {
    if (process.platform !== 'win32') {
      return _mkProbe('launch_config_dir_present', 'NOT-APPLICABLE', 'launch_configurations is Windows path', 'not_applicable_non_windows');
    }
    const dir = path.join(os.homedir(), '.warp', 'launch_configurations');
    const exists = fs.existsSync(dir) && fs.statSync(dir).isDirectory();
    let extra = '';
    if (exists) {
      try {
        const entries = fs.readdirSync(dir).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
        extra = ' (' + entries.length + ' yaml file(s))';
      } catch (_e) { /* ignore */ }
    }
    return _mkProbe('launch_config_dir_present',
      exists ? 'PASS' : 'MISSING',
      dir + extra,
      exists ? 'present_dir_found' : 'missing_dir');
  } catch (e) {
    return _degraded('launch_config_dir_present', e);
  }
}

function _probe_warp_install() {
  try {
    if (process.platform !== 'win32') {
      return _mkProbe('warp_install_present', 'NOT-APPLICABLE', 'Warp.exe path is Windows-specific', 'not_applicable_non_windows');
    }
    const home = os.homedir();
    const candidates = _windowsWarpInstallCandidates(home);
    for (const c of candidates) {
      try {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) {
          return _mkProbe('warp_install_present', 'PASS', c, 'present_file_found');
        }
      } catch (_e) { /* try next */ }
    }
    return _mkProbe('warp_install_present', 'MISSING',
      'tried: ' + candidates.length + ' candidates including ' + candidates[0],
      'missing_path');
  } catch (e) {
    return _degraded('warp_install_present', e);
  }
}

function _probe_cli_resolvable(probeName, cmd) {
  try {
    const where = _checkPathOnSystem(cmd);
    return _mkProbe(probeName,
      where ? 'PASS' : 'MISSING',
      where || (cmd + ' not on PATH'),
      where ? 'present_path_on_path' : 'missing_path');
  } catch (e) {
    return _degraded(probeName, e);
  }
}

function _probe_mcp_config() {
  // Placeholder for v2.3 Phase 68+. Returns NOT-APPLICABLE until MCP ships.
  return _mkProbe('mcp_config_present', 'NOT-APPLICABLE',
    'SGSD MCP server not yet shipped; planned v2.3 Phase 68-72',
    'not_applicable_v2_3_not_shipped');
}

function _probe_codebase_context_state() {
  // UI-bound; honest deferral per Phase 63 Q10 / WARP-SMOKE row Q10.
  return _mkProbe('codebase_context_state', 'MANUAL-CHECK-REQUIRED',
    'Warp Codebase Context state is not exposed to terminal; verify in Warp Agent UI per .planning/milestones/v2.2/MANUAL-CHECKS.md M5',
    'manual_check_ui_bound');
}

// -- Probe envelope helpers --------------------------------------------------

function _mkProbe(name, status, evidence, reason) {
  // Lock 11: indexOf membership on closed enums.
  if (PROBE_NAMES.indexOf(name) === -1) {
    return _degraded(name || '<no_name>', new Error('unknown probe name'));
  }
  if (STATUS_VALUES.indexOf(status) === -1) {
    return _degraded(name, new Error('unknown status: ' + status));
  }
  if (REASON_NOTES.indexOf(reason) === -1) {
    return _degraded(name, new Error('unknown reason: ' + reason));
  }
  return Object.freeze({
    ok: true,
    name,
    status,
    present: status === 'PASS',
    evidence: evidence || '',
    reason
  });
}

function _degraded(name, err) {
  return Object.freeze({
    ok: false,
    name: name || '<unknown>',
    status: 'DEGRADED',
    present: false,
    evidence: 'error: ' + (err && err.message ? err.message : 'unknown'),
    reason: 'probe_internal_error_degraded'
  });
}

// -- Public APIs (Lock-13 wrapped) ------------------------------------------

function runWarpDoctor(opts) {
  try {
    const o = opts || {};
    const projectDir = _resolveProjectDir(o.projectDir);
    const env = o.env || process.env;

    const probes = [
      _probe_warp_env_present(env),
      _probe_function_in_profile('sg_command_defined_in_profile', 'sg'),
      _probe_function_in_profile('sgsd_command_defined_in_profile', 'sgsd'),
      _probe_function_in_profile('sgsd_setup_command_defined_in_profile', 'sgsd-setup'),
      _probe_warp_workflows_dir(projectDir),
      _probe_warp_workflows_yaml_shape(projectDir),
      _probe_repo_file('warp_md_present', projectDir, 'WARP.md'),
      _probe_repo_file('agents_md_present', projectDir, 'AGENTS.md'),
      _probe_repo_file('claude_md_present', projectDir, 'CLAUDE.md'),
      _probe_launch_config_dir(),
      _probe_repo_file('warpindexingignore_present', projectDir, '.warpindexingignore'),
      _probe_warp_install(),
      _probe_cli_resolvable('claude_cli_resolvable', 'claude'),
      _probe_cli_resolvable('codex_cli_resolvable', 'codex'),
      _probe_mcp_config(),
      _probe_codebase_context_state()
    ];

    const summary = {
      total: probes.length,
      pass: probes.filter(p => p.status === 'PASS').length,
      missing: probes.filter(p => p.status === 'MISSING').length,
      manual_check_required: probes.filter(p => p.status === 'MANUAL-CHECK-REQUIRED').length,
      not_applicable: probes.filter(p => p.status === 'NOT-APPLICABLE').length,
      degraded: probes.filter(p => p.status === 'DEGRADED').length
    };

    // Exit code: 0 if no MISSING, 1 if any MISSING (actionable but not abort).
    const exitCode = summary.missing > 0 ? 1 : 0;

    return {
      ok: true,
      schema_version: SCHEMA_VERSION,
      ts: new Date().toISOString(),
      project_dir: projectDir,
      probes,
      summary,
      exit_code: exitCode
    };
  } catch (e) {
    return {
      ok: false,
      schema_version: SCHEMA_VERSION,
      ts: new Date().toISOString(),
      probes: [],
      summary: { total: 0, pass: 0, missing: 0, manual_check_required: 0, not_applicable: 0, degraded: 1 },
      exit_code: 2,
      error: e && e.message ? e.message : 'unknown'
    };
  }
}

function getProbe(name, opts) {
  try {
    if (typeof name !== 'string' || PROBE_NAMES.indexOf(name) === -1) {
      return _degraded(name || '<no_name>', new Error('unknown probe name'));
    }
    const o = opts || {};
    const projectDir = _resolveProjectDir(o.projectDir);
    const env = o.env || process.env;

    switch (name) {
      case 'warp_env_present':                      return _probe_warp_env_present(env);
      case 'sg_command_defined_in_profile':         return _probe_function_in_profile(name, 'sg');
      case 'sgsd_command_defined_in_profile':       return _probe_function_in_profile(name, 'sgsd');
      case 'sgsd_setup_command_defined_in_profile': return _probe_function_in_profile(name, 'sgsd-setup');
      case 'warp_workflows_dir_present':            return _probe_warp_workflows_dir(projectDir);
      case 'warp_workflows_yaml_shape':             return _probe_warp_workflows_yaml_shape(projectDir);
      case 'warp_md_present':                       return _probe_repo_file(name, projectDir, 'WARP.md');
      case 'agents_md_present':                     return _probe_repo_file(name, projectDir, 'AGENTS.md');
      case 'claude_md_present':                     return _probe_repo_file(name, projectDir, 'CLAUDE.md');
      case 'launch_config_dir_present':             return _probe_launch_config_dir();
      case 'warpindexingignore_present':            return _probe_repo_file(name, projectDir, '.warpindexingignore');
      case 'warp_install_present':                  return _probe_warp_install();
      case 'claude_cli_resolvable':                 return _probe_cli_resolvable(name, 'claude');
      case 'codex_cli_resolvable':                  return _probe_cli_resolvable(name, 'codex');
      case 'mcp_config_present':                    return _probe_mcp_config();
      case 'codebase_context_state':                return _probe_codebase_context_state();
      default:                                      return _degraded(name, new Error('switch fall-through'));
    }
  } catch (e) {
    return _degraded(name, e);
  }
}

// -- selfTest ----------------------------------------------------------------

function selfTest() {
  const results = [];
  function assert(label, cond, detail) {
    results.push({ label, ok: !!cond, detail: detail || '' });
  }

  try {
    // A1: PROBE_NAMES frozen, len=16
    assert('A1_probe_names_frozen_16', Object.isFrozen(PROBE_NAMES) && PROBE_NAMES.length === 16,
      'len=' + PROBE_NAMES.length + ' frozen=' + Object.isFrozen(PROBE_NAMES));

    // A2: STATUS_VALUES frozen, len=5
    assert('A2_status_values_frozen_5', Object.isFrozen(STATUS_VALUES) && STATUS_VALUES.length === 5,
      'len=' + STATUS_VALUES.length);

    // A3: REASON_NOTES frozen
    assert('A3_reason_notes_frozen', Object.isFrozen(REASON_NOTES),
      'len=' + REASON_NOTES.length);

    // A4: getProbe with bad name -> DEGRADED, never throws
    const r4 = getProbe('not_a_real_probe');
    assert('A4_bad_probe_name_degraded', r4 && r4.status === 'DEGRADED' && r4.ok === false,
      'status=' + (r4 && r4.status));

    // A5: getProbe with non-string -> DEGRADED, never throws
    const r5 = getProbe(null);
    assert('A5_non_string_name_degraded', r5 && r5.status === 'DEGRADED',
      'status=' + (r5 && r5.status));

    // A6: getProbe with each valid name returns a probe object with valid status
    let allShapeOk = true;
    let firstBad = null;
    for (const n of PROBE_NAMES) {
      const r = getProbe(n);
      if (!r || typeof r.name !== 'string' || STATUS_VALUES.indexOf(r.status) === -1) {
        allShapeOk = false;
        firstBad = n + ':' + (r && r.status);
        break;
      }
    }
    assert('A6_all_probes_shape_ok', allShapeOk, firstBad || 'all 16 OK');

    // A7: runWarpDoctor returns valid envelope
    const env = runWarpDoctor({ projectDir: process.cwd() });
    assert('A7_runWarpDoctor_envelope_ok',
      env && env.ok === true &&
      env.schema_version === SCHEMA_VERSION &&
      Array.isArray(env.probes) &&
      env.probes.length === 16 &&
      typeof env.summary === 'object' &&
      typeof env.exit_code === 'number',
      'schema=' + (env && env.schema_version) + ' probes=' + (env && env.probes && env.probes.length));

    // A8: READ-ONLY invariant -- scan THIS source for fs-write tokens.
    // Banned strings are constructed via concatenation so the literal
    // tokens never appear in this file's bytes (otherwise the scan would
    // false-positive on its own banned list).
    const src = fs.readFileSync(__filename, 'utf8');
    const FS = 'fs.';
    const banned = [
      FS + 'write' + 'FileSync',
      FS + 'append' + 'FileSync',
      FS + 'unlink' + 'Sync',
      FS + 'mkdir' + 'Sync',
      FS + 'rm' + 'Sync',
      FS + 'rmdir' + 'Sync'
    ];
    const hits = banned.filter(b => src.indexOf(b) !== -1);
    assert('A8_read_only_invariant', hits.length === 0,
      hits.length === 0 ? 'no fs-write tokens found' : 'BANNED tokens found: ' + hits.join(','));

    // A9: PROBE_NAMES uniqueness
    const setSize = (new Set(PROBE_NAMES)).size;
    assert('A9_probe_names_unique', setSize === PROBE_NAMES.length,
      'set=' + setSize + ' arr=' + PROBE_NAMES.length);

    // A10: STATUS_VALUES uniqueness + closed vocab
    const ssz = (new Set(STATUS_VALUES)).size;
    assert('A10_status_values_unique', ssz === STATUS_VALUES.length, 'set=' + ssz);

    // A11: ASCII-only check on this source file
    let firstNonAsciiIdx = -1;
    for (let i = 0; i < src.length; i++) {
      if (src.charCodeAt(i) > 127) { firstNonAsciiIdx = i; break; }
    }
    assert('A11_ascii_only_source', firstNonAsciiIdx === -1,
      'first_nonascii_idx=' + firstNonAsciiIdx);

    // A12: codebase_context_state is always MANUAL-CHECK-REQUIRED (D67.5)
    const cb = getProbe('codebase_context_state');
    assert('A12_codebase_context_manual_check', cb && cb.status === 'MANUAL-CHECK-REQUIRED',
      'status=' + (cb && cb.status));

    // A13: mcp_config_present is always NOT-APPLICABLE until v2.3 (D67.6)
    const mcp = getProbe('mcp_config_present');
    assert('A13_mcp_config_not_applicable', mcp && mcp.status === 'NOT-APPLICABLE',
      'status=' + (mcp && mcp.status));

    // A14: _mkProbe rejects unknown name with DEGRADED (Lock 11 enforcement)
    const r14 = _mkProbe('not_a_probe', 'PASS', 'evidence', 'present_file_found');
    assert('A14_mkProbe_rejects_unknown_name', r14.status === 'DEGRADED',
      'status=' + r14.status);

    // A15: _mkProbe rejects unknown status (Lock 11 enforcement)
    const r15 = _mkProbe('warp_env_present', 'TOTALLY-INVALID-STATUS', 'evidence', 'present_env_var_match');
    assert('A15_mkProbe_rejects_unknown_status', r15.status === 'DEGRADED',
      'status=' + r15.status);

    const allOk = results.every(r => r.ok);
    return { ok: allOk, results };
  } catch (e) {
    results.push({ label: 'self_test_threw', ok: false, detail: 'error: ' + (e && e.message) });
    return { ok: false, results };
  }
}

// -- _internals --------------------------------------------------------------

const _internals = Object.freeze({
  _resolveProjectDir,
  _findPowerShellProfile,
  _grepProfileForFunction,
  _checkPathOnSystem,
  _readWarpWorkflowsList,
  _liteYamlShapeCheck,
  _windowsWarpInstallCandidates,
  _mkProbe,
  _degraded,
  PROBE_NAMES,
  STATUS_VALUES,
  REASON_NOTES,
  SCHEMA_VERSION
});

// -- CLI ---------------------------------------------------------------------

function _renderTable(env) {
  const lines = [];
  lines.push('Warp Doctor -- ' + env.ts);
  lines.push('Project: ' + env.project_dir);
  lines.push('');
  const widthName = Math.max.apply(null, env.probes.map(p => p.name.length).concat([20]));
  const widthStatus = 22;
  lines.push(_pad('PROBE', widthName) + '  ' + _pad('STATUS', widthStatus) + '  EVIDENCE');
  lines.push(_pad('-----', widthName) + '  ' + _pad('------', widthStatus) + '  --------');
  for (const p of env.probes) {
    lines.push(_pad(p.name, widthName) + '  ' + _pad(p.status, widthStatus) + '  ' + (p.evidence || ''));
  }
  lines.push('');
  const s = env.summary;
  lines.push('Summary: ' + s.pass + ' PASS, ' + s.missing + ' MISSING, '
    + s.manual_check_required + ' MANUAL-CHECK, '
    + s.not_applicable + ' NOT-APPLICABLE, '
    + s.degraded + ' DEGRADED  (total=' + s.total + ', exit=' + env.exit_code + ')');
  return lines.join('\n');
}

function _pad(s, w) {
  s = String(s || '');
  if (s.length >= w) return s;
  return s + ' '.repeat(w - s.length);
}

function _printSelfTest(st) {
  const lines = [];
  let pass = 0, fail = 0;
  for (const r of st.results) {
    const tag = r.ok ? 'PASS' : 'FAIL';
    if (r.ok) pass++; else fail++;
    lines.push(tag + ' ' + r.label + (r.detail ? '  (' + r.detail + ')' : ''));
  }
  lines.push('');
  lines.push('Self-test: ' + pass + '/' + (pass + fail) + ' passed');
  return { text: lines.join('\n'), pass, fail };
}

function _parseArgs(argv) {
  const args = { projectDir: null, selfTest: false, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') args.selfTest = true;
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--project') { args.projectDir = argv[++i]; }
    else if (a.startsWith('--project=')) { args.projectDir = a.slice('--project='.length); }
  }
  return args;
}

function _printHelp() {
  return [
    'warp-doctor -- read-only Warp + SGSD setup diagnostic',
    '',
    'Usage:',
    '  node super-gsd/tools/warp-doctor/check.cjs [--project PATH] [--json]',
    '  node super-gsd/tools/warp-doctor/check.cjs --self-test',
    '  node super-gsd/tools/warp-doctor/check.cjs --help',
    '',
    'Flags:',
    '  --project PATH   Project root (default: cwd)',
    '  --json           Emit JSON envelope instead of human table',
    '  --self-test      Run selfTest() and report assertions',
    '  --help           Show this help',
    '',
    'Exit codes:',
    '  0  all probes PASS / NOT-APPLICABLE / MANUAL-CHECK-REQUIRED',
    '  1  one or more MISSING probes (actionable; doctor never aborts hard)',
    '  2  internal error (Lock-13 caught at runWarpDoctor envelope)'
  ].join('\n');
}

if (require.main === module) {
  const args = _parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(_printHelp() + '\n');
    process.exit(0);
  }

  if (args.selfTest) {
    const st = selfTest();
    const out = _printSelfTest(st);
    process.stdout.write(out.text + '\n');
    process.exit(st.ok ? 0 : 1);
  }

  const env = runWarpDoctor({ projectDir: args.projectDir });
  if (args.json) {
    process.stdout.write(JSON.stringify(env, null, 2) + '\n');
  } else {
    process.stdout.write(_renderTable(env) + '\n');
  }
  process.exit(env.exit_code);
}

module.exports = { runWarpDoctor, getProbe, selfTest, _internals };
