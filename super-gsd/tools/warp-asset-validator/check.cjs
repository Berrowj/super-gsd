#!/usr/bin/env node
// =============================================================================
// super-gsd/tools/warp-asset-validator/check.cjs
// Phase 83-01: SGSD Warp asset index validator (READ-ONLY).
//
// Reads super-gsd/docs/SGSD-WARP-ASSET-INDEX.md; extracts every cited
// repo-relative path; verifies each exists. Exit 0 if clean; exit 1 if
// any missing.
//
// ASCII-only.
// =============================================================================

'use strict';

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

function _resolveProjectDir(d) {
  if (d && typeof d === 'string') return path.resolve(d);
  return process.cwd();
}

function _extractPaths(indexText) {
  // Match backtick-quoted paths starting with .warp/, super-gsd/, .agents/, .planning/, or repo-root caps (WARP.md, AGENTS.md, CLAUDE.md)
  const paths = [];
  const re = /`([\w./_\-]+)`/g;
  let m;
  while ((m = re.exec(indexText)) !== null) {
    const p = m[1];
    // Filter to actual repo paths
    if (
      p.startsWith('.warp/') ||
      p.startsWith('super-gsd/') ||
      p.startsWith('.agents/') ||
      p.startsWith('.planning/') ||
      /^[A-Z][A-Z]+\.md$/.test(p) ||
      p === 'WARP.md' || p === 'AGENTS.md' || p === 'CLAUDE.md'
    ) {
      // Skip wildcard / placeholder paths
      if (p.indexOf('*') !== -1) continue;
      if (p.indexOf('{') !== -1) continue;
      paths.push(p);
    }
  }
  // Deduplicate
  return Array.from(new Set(paths));
}

function validate(opts) {
  try {
    const projectDir = _resolveProjectDir(opts && opts.projectDir);
    const indexPath = path.join(projectDir, 'super-gsd', 'docs', 'SGSD-WARP-ASSET-INDEX.md');
    if (!fs.existsSync(indexPath)) {
      return { ok: false, error: 'index_file_missing', indexPath };
    }
    const text = fs.readFileSync(indexPath, 'utf8');
    const paths = _extractPaths(text);
    const results = paths.map(p => {
      const abs = path.join(projectDir, p);
      const exists = fs.existsSync(abs);
      return { path: p, exists };
    });
    const missing = results.filter(r => !r.exists);
    const exitCode = missing.length === 0 ? 0 : 1;
    return {
      ok: true,
      schema_version: SCHEMA_VERSION,
      ts: new Date().toISOString(),
      project_dir: projectDir,
      total_paths: paths.length,
      missing_count: missing.length,
      missing,
      results,
      exit_code: exitCode
    };
  } catch (e) {
    return { ok: false, error: 'validate_threw: ' + (e && e.message ? e.message : 'unknown') };
  }
}

function selfTest() {
  const results = [];
  function assert(label, cond, detail) {
    results.push({ label, ok: !!cond, detail: detail || '' });
  }

  try {
    // A1: extractPaths finds entries
    const sample = '`super-gsd/tools/foo.cjs` and `WARP.md` plus `not-a-path`.';
    const extracted = _extractPaths(sample);
    assert('A1_extract_paths_filters', extracted.length === 2 && extracted.includes('super-gsd/tools/foo.cjs') && extracted.includes('WARP.md'),
      'extracted=' + JSON.stringify(extracted));

    // A2: validate against this checkout
    const env = validate({ projectDir: process.cwd() });
    assert('A2_validate_envelope', env && env.ok === true && typeof env.total_paths === 'number',
      'ok=' + (env && env.ok));

    // A3: missing_count is reported
    assert('A3_missing_count_reported', env && typeof env.missing_count === 'number',
      'missing=' + (env && env.missing_count));

    // A4: ASCII-only
    const src = fs.readFileSync(__filename, 'utf8');
    let firstNonAscii = -1;
    for (let i = 0; i < src.length; i++) {
      if (src.charCodeAt(i) > 127) { firstNonAscii = i; break; }
    }
    assert('A4_ascii_only', firstNonAscii === -1, 'first_nonascii_idx=' + firstNonAscii);

    // A5: bad project dir -> degraded
    const r5 = validate({ projectDir: 'C:/no-such-dir-12345' });
    assert('A5_bad_dir_degraded', r5 && r5.ok === false, 'ok=' + (r5 && r5.ok));

    const allOk = results.every(r => r.ok);
    return { ok: allOk, results };
  } catch (e) {
    results.push({ label: 'self_test_threw', ok: false, detail: 'error: ' + (e && e.message) });
    return { ok: false, results };
  }
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  let projectDir = null;
  let selfTestFlag = false;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--self-test') selfTestFlag = true;
    else if (a === '--json') json = true;
    else if (a === '--project') projectDir = argv[++i];
    else if (a.startsWith('--project=')) projectDir = a.slice('--project='.length);
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

  const env = validate({ projectDir });
  if (json) {
    process.stdout.write(JSON.stringify(env, null, 2) + '\n');
  } else {
    process.stdout.write('Asset Index Validation\n');
    process.stdout.write('  index: super-gsd/docs/SGSD-WARP-ASSET-INDEX.md\n');
    process.stdout.write('  total paths cited: ' + env.total_paths + '\n');
    process.stdout.write('  missing: ' + env.missing_count + '\n');
    if (env.missing && env.missing.length > 0) {
      process.stdout.write('\n  Missing paths:\n');
      for (const m of env.missing) {
        process.stdout.write('    - ' + m.path + '\n');
      }
    }
  }
  process.exit(env.exit_code);
}

module.exports = { validate, selfTest, _extractPaths };
