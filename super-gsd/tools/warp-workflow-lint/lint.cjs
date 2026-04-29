#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/warp-workflow-lint/lint.cjs
// Phase 64-01: Workflow YAML structural validator (READ-ONLY).
//
// PURPOSE
//   Lint every .warp/workflows/*.yaml in the project against the SGSD
//   workflow shape: name + description + command + tags (>=1 entry) +
//   arguments (with default_value), and confirm collectively the workflow
//   pack covers the canonical search-term vocabulary.
//
// EXIT CODES
//   0  all workflows valid + all search terms covered
//   1  one or more shape failures OR missing search terms (actionable)
//   2  internal error
//
// NO WRITES. ASCII-only.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

const REQUIRED_KEYS = Object.freeze(['name', 'description', 'command', 'tags', 'arguments']);
const REQUIRED_SEARCH_TERMS = Object.freeze([
  'start', 'auto', 'cockpit', 'token', 'recovery',
  'gates', 'watchdog', 'codex', 'blocked', 'status'
]);

function _resolveProjectDir(d) {
  if (d && typeof d === 'string') return path.resolve(d);
  return process.cwd();
}

function _lintFile(absPath) {
  const findings = { file: path.basename(absPath), checks: {} };
  let txt;
  try {
    txt = fs.readFileSync(absPath, 'utf8');
  } catch (e) {
    findings.checks.read_ok = false;
    findings.checks.error = e.message;
    findings.ok = false;
    return findings;
  }
  findings.checks.read_ok = true;
  for (const k of REQUIRED_KEYS) {
    findings.checks['has_' + k] = new RegExp('^' + k + ':', 'm').test(txt);
  }
  findings.checks.no_tabs = !/\t/.test(txt);
  findings.checks.has_default_value = /default_value:/.test(txt);
  findings.checks.tags_listed = /^tags:\s*$([\s\S]*?)(?=^[a-z_]+:|$(?![\r\n]))/m.test(txt) &&
                                 /^\s+- \S+/m.test(txt.split(/^arguments:/m)[0] || '');
  findings.ok = Object.entries(findings.checks)
    .filter(([k]) => k !== 'read_ok' || true)
    .every(([_, v]) => v);
  return findings;
}

function lintWorkflows(opts) {
  try {
    const o = opts || {};
    const projectDir = _resolveProjectDir(o.projectDir);
    const dir = path.join(projectDir, '.warp', 'workflows');
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      return {
        ok: false,
        schema_version: SCHEMA_VERSION,
        ts: new Date().toISOString(),
        project_dir: projectDir,
        workflows_dir: dir,
        files: [],
        search_terms: { required: REQUIRED_SEARCH_TERMS, found: [], missing: REQUIRED_SEARCH_TERMS, all_present: false },
        summary: { total: 0, valid: 0, invalid: 0 },
        exit_code: 1,
        error: 'workflows directory missing'
      };
    }

    const yamls = fs.readdirSync(dir)
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
      .sort()
      .map(f => path.join(dir, f));

    const files = yamls.map(_lintFile);
    const valid = files.filter(f => f.ok).length;
    const invalid = files.length - valid;

    const allText = yamls.map(p => {
      try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return ''; }
    }).join('\n').toLowerCase();

    const found = [];
    const missing = [];
    for (const t of REQUIRED_SEARCH_TERMS) {
      if (allText.indexOf(t.toLowerCase()) !== -1) found.push(t);
      else missing.push(t);
    }

    const allPresent = missing.length === 0;
    const exitCode = (invalid === 0 && allPresent) ? 0 : 1;

    return {
      ok: true,
      schema_version: SCHEMA_VERSION,
      ts: new Date().toISOString(),
      project_dir: projectDir,
      workflows_dir: dir,
      files,
      search_terms: {
        required: REQUIRED_SEARCH_TERMS,
        found,
        missing,
        all_present: allPresent
      },
      summary: { total: files.length, valid, invalid },
      exit_code: exitCode
    };
  } catch (e) {
    return {
      ok: false,
      schema_version: SCHEMA_VERSION,
      ts: new Date().toISOString(),
      summary: { total: 0, valid: 0, invalid: 0 },
      exit_code: 2,
      error: e && e.message ? e.message : 'unknown'
    };
  }
}

function selfTest() {
  const results = [];
  function assert(label, cond, detail) {
    results.push({ label, ok: !!cond, detail: detail || '' });
  }

  try {
    assert('A1_required_keys_frozen_5', Object.isFrozen(REQUIRED_KEYS) && REQUIRED_KEYS.length === 5,
      'len=' + REQUIRED_KEYS.length);
    assert('A2_search_terms_frozen_10', Object.isFrozen(REQUIRED_SEARCH_TERMS) && REQUIRED_SEARCH_TERMS.length === 10,
      'len=' + REQUIRED_SEARCH_TERMS.length);

    const env = lintWorkflows({ projectDir: process.cwd() });
    assert('A3_envelope_shape_ok',
      env && env.ok === true && Array.isArray(env.files) && typeof env.summary === 'object',
      'ok=' + (env && env.ok));
    assert('A4_files_have_required_check_keys', env.files.length === 0 ||
      env.files.every(f => REQUIRED_KEYS.every(k => 'has_' + k in f.checks)),
      'first_file_keys=' + (env.files[0] && Object.keys(env.files[0].checks).join(',')));
    assert('A5_search_terms_envelope', env.search_terms &&
      Array.isArray(env.search_terms.required) &&
      Array.isArray(env.search_terms.found) &&
      Array.isArray(env.search_terms.missing),
      'required=' + (env.search_terms && env.search_terms.required.length));

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
    assert('A6_read_only_invariant', hits.length === 0,
      hits.length === 0 ? 'no fs-write tokens' : 'BANNED: ' + hits.join(','));

    let firstNonAscii = -1;
    for (let i = 0; i < src.length; i++) {
      if (src.charCodeAt(i) > 127) { firstNonAscii = i; break; }
    }
    assert('A7_ascii_only', firstNonAscii === -1, 'first_nonascii_idx=' + firstNonAscii);

    const allOk = results.every(r => r.ok);
    return { ok: allOk, results };
  } catch (e) {
    results.push({ label: 'self_test_threw', ok: false, detail: 'error: ' + (e && e.message) });
    return { ok: false, results };
  }
}

function _renderTable(env) {
  const lines = [];
  lines.push('Warp Workflow Lint -- ' + env.ts);
  lines.push('Project: ' + env.project_dir);
  lines.push('Workflows: ' + env.workflows_dir);
  lines.push('');
  for (const f of env.files) {
    const status = f.ok ? 'PASS' : 'FAIL';
    lines.push(status + '  ' + f.file);
    if (!f.ok) {
      const missing = Object.entries(f.checks).filter(([_, v]) => !v).map(([k]) => k);
      lines.push('       missing: ' + missing.join(', '));
    }
  }
  lines.push('');
  lines.push('Search terms required: ' + env.search_terms.required.join(', '));
  lines.push('Search terms found:    ' + env.search_terms.found.join(', '));
  if (env.search_terms.missing.length > 0) {
    lines.push('Search terms MISSING:  ' + env.search_terms.missing.join(', '));
  }
  lines.push('');
  lines.push('Summary: ' + env.summary.valid + '/' + env.summary.total + ' valid; '
    + 'search-terms ' + (env.search_terms.all_present ? 'all-present' : 'incomplete')
    + '  (exit=' + env.exit_code + ')');
  return lines.join('\n');
}

function _printHelp() {
  return [
    'warp-workflow-lint -- read-only Warp workflow YAML validator',
    '',
    'Usage:',
    '  node super-gsd/tools/warp-workflow-lint/lint.cjs [--project PATH] [--json]',
    '  node super-gsd/tools/warp-workflow-lint/lint.cjs --self-test',
    '',
    'Exit codes:',
    '  0  all workflows valid + all 10 search terms covered',
    '  1  shape failure or missing search terms',
    '  2  internal error'
  ].join('\n');
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  let projectDir = null;
  let selfTestFlag = false;
  let json = false;
  let help = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') selfTestFlag = true;
    else if (a === '--json') json = true;
    else if (a === '--help' || a === '-h') help = true;
    else if (a === '--project') projectDir = argv[++i];
    else if (a.startsWith('--project=')) projectDir = a.slice('--project='.length);
  }

  if (help) {
    process.stdout.write(_printHelp() + '\n');
    process.exit(0);
  }

  if (selfTestFlag) {
    const st = selfTest();
    let pass = 0, fail = 0;
    for (const r of st.results) {
      const tag = r.ok ? 'PASS' : 'FAIL';
      if (r.ok) pass++; else fail++;
      process.stdout.write(tag + ' ' + r.label + (r.detail ? '  (' + r.detail + ')' : '') + '\n');
    }
    process.stdout.write('\nSelf-test: ' + pass + '/' + (pass + fail) + ' passed\n');
    process.exit(st.ok ? 0 : 1);
  }

  const env = lintWorkflows({ projectDir });
  if (json) {
    process.stdout.write(JSON.stringify(env, null, 2) + '\n');
  } else {
    process.stdout.write(_renderTable(env) + '\n');
  }
  process.exit(env.exit_code);
}

module.exports = { lintWorkflows, selfTest, REQUIRED_KEYS, REQUIRED_SEARCH_TERMS };
