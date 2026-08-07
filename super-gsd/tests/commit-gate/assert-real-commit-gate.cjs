#!/usr/bin/env node
'use strict';

// ============================================================================
// SGSD commit-gate real Git fixture runner
// ============================================================================
// T147-01 owns the temp-repo helpers and the artifact-convention source
// predicate scenarios. Later T147 tasks reuse these helpers to run the real
// hook and inspect shadow rows from staged Git state.
// ============================================================================

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '../../..');
const conventionModulePath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'sgsd-artifact-conventions.cjs');
const shadowModulePath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'commit-gate-shadow-log.cjs');
const reportModulePath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'commit-gate-shadow-report.cjs');
const stateLibPath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'sgsd-state.cjs');
const hookModulePath = path.join(repoRoot, 'super-gsd', 'hooks', 'sgsd-commit-gate.cjs');
const installerScriptPath = path.join(repoRoot, 'super-gsd', 'scripts', 'install-commit-gate.cjs');
const installerMarker = 'SGSD-COMMIT-GATE-HOOK';
const { resolveContainedPath, readState } = require(stateLibPath);

const createdFixtureRoots = new Set();

function usage() {
  return [
    'Usage:',
    '  node super-gsd/tests/commit-gate/assert-real-commit-gate.cjs --scenario <name>',
    '',
    'Scenarios:',
    '  artifact-conventions-source-predicate',
    '  gsdedits-backed',
    '  false-plan-audit-missing',
    '  source-predicate',
    '  convention-unknown',
    '  per-path-granularity',
    '  shadow-ledger-contained-writer',
    '  hook-warn-unbacked',
    '  hook-docs-only',
    '  hook-sentinel-skip',
    '  hook-fail-open-degraded',
    '  hook-non-sgsd-no-write',
    '  hook-warn-sentinel-failopen',
    '  shadow-report-activation',
    '  ac-shadow-report-activation',
    '  installer-lifecycle',
    '  installer-refuses-unmarked',
    '  installer-trampoline-real-commit',
    '  installer-linked-worktree-warning',
    '',
    'Exports fixture helpers for later commit-gate tasks.'
  ].join('\n');
}

function parseArgs(argv) {
  const out = { help: false, scenario: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
    } else if (arg === '--scenario') {
      out.scenario = argv[index + 1] || null;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return out;
}

function loadConventions() {
  return require(conventionModulePath);
}

function loadShadowLog() {
  delete require.cache[require.resolve(shadowModulePath)];
  return require(shadowModulePath);
}

function loadShadowReport() {
  delete require.cache[require.resolve(reportModulePath)];
  return require(reportModulePath);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
    env: Object.assign({}, process.env, options.env || {}),
    input: options.input || undefined
  });
}

function runBuffer(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: Object.assign({}, process.env, options.env || {}),
    input: options.input || undefined
  });
}

function git(repoDir, args) {
  const result = run('git', args, { cwd: repoDir });
  if (result.status !== 0) {
    const detail = result.error ? result.error.message : `${result.stdout || ''}\n${result.stderr || ''}`;
    throw new Error(`git ${args.join(' ')} failed with ${result.status}: ${detail}`);
  }
  return result;
}

function gitBuffer(repoDir, args) {
  const result = runBuffer('git', args, { cwd: repoDir });
  if (result.status !== 0) {
    const stdout = Buffer.isBuffer(result.stdout) ? result.stdout.toString('utf8') : String(result.stdout || '');
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr || '');
    const detail = result.error ? result.error.message : `${stdout}\n${stderr}`;
    throw new Error(`git ${args.join(' ')} failed with ${result.status}: ${detail}`);
  }
  return Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(String(result.stdout || ''), 'utf8');
}

function realpathOrNull(target) {
  try {
    return fs.realpathSync.native(path.resolve(String(target)));
  } catch {
    try {
      return fs.realpathSync(path.resolve(String(target)));
    } catch {
      return null;
    }
  }
}

function pathKey(target) {
  const value = path.resolve(String(target || ''));
  return process.platform === 'win32' ? value.toLowerCase() : value;
}

function realPathStartsWith(rootReal, targetReal) {
  const rootKey = pathKey(rootReal);
  const targetKey = pathKey(targetReal);
  const rootPrefix = rootKey.endsWith(path.sep) ? rootKey : `${rootKey}${path.sep}`;
  return targetKey === rootKey || targetKey.startsWith(rootPrefix);
}

function tempFixtureRoot() {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-commit-gate-'));
  const real = realpathOrNull(target);
  if (!real) {
    fs.rmSync(target, { recursive: true, force: true });
    throw new Error('could not resolve OS-temp fixture root');
  }
  createdFixtureRoots.add(pathKey(real));
  return real;
}

function safeChildName(name) {
  const value = String(name || 'repo').replace(/[^A-Za-z0-9_.-]/g, '-');
  return value || 'repo';
}

function contained(root, subpath) {
  const resolved = resolveContainedPath(root, subpath);
  if (!resolved) throw new Error(`resolveContainedPath refused ${subpath}`);
  return resolved;
}

function writeContainedFile(root, subpath, content) {
  const target = contained(root, subpath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, String(content), 'utf8');
  return target;
}

function readContainedFile(root, subpath) {
  return fs.readFileSync(contained(root, subpath), 'utf8');
}

function createTempGitRepo(options = {}) {
  const tempRoot = tempFixtureRoot();
  try {
    const repoDir = contained(tempRoot, safeChildName(options.repoId || 'repo'));
    fs.mkdirSync(repoDir, { recursive: true });

    git(repoDir, ['init']);
    git(repoDir, ['config', 'core.autocrlf', 'false']);
    git(repoDir, ['config', 'user.email', 'sgsd-fixture@example.invalid']);
    git(repoDir, ['config', 'user.name', 'SGSD Fixture']);

    const milestone = options.milestone || 'v3.5';
    const phase = String(options.phase || '147');
    writeContainedFile(
      repoDir,
      path.join('.planning', 'STATE.md'),
      [
        '---',
        `milestone: ${JSON.stringify(milestone)}`,
        `current_phase: ${JSON.stringify(phase)}`,
        '---',
        '',
        '# Fixture State',
        ''
      ].join('\n')
    );

    return {
      tempRoot,
      repoDir,
      repoRoot: repoDir,
      milestone,
      phase,
      cleanup() {
        cleanupFixture(tempRoot);
      }
    };
  } catch (error) {
    cleanupFixture(tempRoot);
    throw error;
  }
}

function createPlainGitRepo(options = {}) {
  const tempRoot = tempFixtureRoot();
  try {
    const repoDir = contained(tempRoot, safeChildName(options.repoId || 'plain-repo'));
    fs.mkdirSync(repoDir, { recursive: true });

    git(repoDir, ['init']);
    git(repoDir, ['config', 'core.autocrlf', 'false']);
    git(repoDir, ['config', 'user.email', 'sgsd-fixture@example.invalid']);
    git(repoDir, ['config', 'user.name', 'SGSD Fixture']);

    return {
      tempRoot,
      repoDir,
      cleanup() {
        cleanupFixture(tempRoot);
      }
    };
  } catch (error) {
    cleanupFixture(tempRoot);
    throw error;
  }
}

function createBareSgsdFixture(options = {}) {
  const tempRoot = tempFixtureRoot();
  try {
    const repoDir = contained(tempRoot, safeChildName(options.repoId || 'shadow-repo'));
    fs.mkdirSync(repoDir, { recursive: true });
    if (options.withPlanning !== false) {
      fs.mkdirSync(contained(repoDir, '.planning'), { recursive: true });
    }
    if (options.withState !== false) {
      writeContainedFile(
        repoDir,
        path.join('.planning', 'STATE.md'),
        [
          '---',
          `milestone: ${JSON.stringify(options.milestone || 'v3.5')}`,
          `current_phase: ${JSON.stringify(String(options.phase || '147'))}`,
          '---',
          '',
          '# Fixture State',
          ''
        ].join('\n')
      );
    }
    return {
      tempRoot,
      repoDir,
      cleanup() {
        cleanupFixture(tempRoot);
      }
    };
  } catch (error) {
    cleanupFixture(tempRoot);
    throw error;
  }
}
function cleanupFixture(tempRoot) {
  try {
    if (!tempRoot) return { cleaned: false, reason_code: 'fixture_path_empty' };
    const targetReal = realpathOrNull(tempRoot);
    if (!targetReal) return { cleaned: false, reason_code: 'fixture_path_unresolved' };
    const targetKey = pathKey(targetReal);
    if (!createdFixtureRoots.has(targetKey)) {
      return { cleaned: false, reason_code: 'fixture_not_registered', path: targetReal };
    }

    const tmpReal = realpathOrNull(os.tmpdir());
    if (!tmpReal || !realPathStartsWith(tmpReal, targetReal)) {
      return { cleaned: false, reason_code: 'fixture_outside_tmpdir', path: targetReal };
    }

    fs.rmSync(targetReal, { recursive: true, force: true });
    createdFixtureRoots.delete(targetKey);
    return { cleaned: true, reason_code: 'fixture_removed', path: targetReal };
  } catch (error) {
    return {
      cleaned: false,
      reason_code: 'fixture_cleanup_failed',
      message: error && error.message ? error.message : String(error)
    };
  }
}

function stagePaths(repoDir, paths) {
  const staged = [];
  for (const filePath of paths) {
    const rel = String(filePath).replace(/\\/g, '/');
    git(repoDir, ['add', '--', rel]);
    staged.push(rel);
  }
  return staged;
}

function stagedNameStatus(repoDir) {
  const result = git(repoDir, ['diff', '--cached', '--name-status', '-z', '--find-renames', '--find-copies', '--']);
  const parts = result.stdout.split('\0').filter(Boolean);
  const out = [];
  for (let index = 0; index < parts.length; index += 1) {
    const status = parts[index];
    if (/^[RC]/.test(status)) {
      out.push({ status, oldPath: parts[index + 1], path: parts[index + 2] });
      index += 2;
    } else {
      out.push({ status, path: parts[index + 1] });
      index += 1;
    }
  }
  return out;
}

function runNodeScript(scriptPath, args = [], options = {}) {
  return run(process.execPath, [scriptPath, ...args], {
    cwd: options.cwd || repoRoot,
    env: options.env || {},
    input: options.input || undefined
  });
}

function runActualHook(repoDir, args = [], options = {}) {
  return runNodeScript(hookModulePath, args, Object.assign({}, options, { cwd: repoDir }));
}

function copyFixtureFile(root, sourcePath, relativeTarget) {
  const target = contained(root, relativeTarget);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(sourcePath, target);
  return target;
}

function copyCommitGateRuntime(fixture) {
  const root = fixture.repoDir;
  copyFixtureFile(root, hookModulePath, path.join('super-gsd', 'hooks', 'sgsd-commit-gate.cjs'));
  for (const libName of [
    'sgsd-state.cjs',
    'sgsd-artifact-conventions.cjs',
    'commit-gate-shadow-log.cjs',
    'commit-gate-shadow-report.cjs'
  ]) {
    copyFixtureFile(
      root,
      path.join(repoRoot, 'super-gsd', 'scripts', 'lib', libName),
      path.join('super-gsd', 'scripts', 'lib', libName)
    );
  }
}

function gitResolvedHookPath(repoDir) {
  const result = git(repoDir, ['rev-parse', '--git-path', 'hooks/pre-commit']);
  return path.resolve(repoDir, result.stdout.trim());
}

function runInstaller(repoDir, args = [], options = {}) {
  return runNodeScript(installerScriptPath, args, Object.assign({}, options, { cwd: repoDir }));
}

function runActualHookInProcess(repoDir, args = []) {
  const originalCwd = process.cwd();
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  let stdout = '';
  let stderr = '';
  let error = null;
  let status = null;
  process.stdout.write = function patchedStdout(chunk, encoding, callback) {
    stdout += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (typeof callback === 'function') callback();
    return true;
  };
  process.stderr.write = function patchedStderr(chunk, encoding, callback) {
    stderr += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (typeof callback === 'function') callback();
    return true;
  };
  try {
    process.chdir(repoDir);
    delete require.cache[require.resolve(hookModulePath)];
    status = require(hookModulePath).main(args);
  } catch (caught) {
    error = caught;
  } finally {
    process.chdir(originalCwd);
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }
  return { status, stdout, stderr, error };
}

function binaryDiffSha256(repoDir) {
  const diff = gitBuffer(repoDir, ['diff', '--cached', '--binary', '--']);
  return crypto.createHash('sha256').update(diff).digest('hex');
}

function readJsonl(root, subpath) {
  const text = fs.existsSync(contained(root, subpath)) ? readContainedFile(root, subpath) : '';
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function captureStderr(fn) {
  const originalWrite = process.stderr.write;
  let captured = '';
  process.stderr.write = function patchedWrite(chunk, encoding, callback) {
    captured += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
    if (typeof callback === 'function') callback();
    return true;
  };
  try {
    const value = fn();
    return { value, stderr: captured };
  } finally {
    process.stderr.write = originalWrite;
  }
}

function samplePathEvidence(pathValue = 'super-gsd/scripts/lib/shadow-fixture.cjs') {
  return [{
    path: pathValue,
    source_touching: true,
    evidence_status: 'missing',
    matched_artifacts: [],
    reason_code: 'phase_evidence_missing'
  }];
}

function sampleShadowRow(overrides = {}) {
  const stagedPaths = overrides.staged_paths || ['super-gsd/scripts/lib/shadow-fixture.cjs'];
  const pathEvidence = overrides.path_evidence || samplePathEvidence(stagedPaths[0]);
  return Object.assign({
    signal: 'commit_gate_shadow',
    status: 'warn',
    repo_id: 'fixture-repo',
    commit_candidate: 'HEAD',
    diff_content: 'fixture diff\n',
    artifact_predicate_version: 't147-01',
    artifact_convention_status: 'gsdedits_artifacts_discovered',
    staged_paths: stagedPaths,
    path_evidence: pathEvidence,
    would_warn: true,
    would_block: false,
    false_block_basis: ['phase_evidence_missing'],
    waived_paths: [],
    reason_codes: ['phase_evidence_missing'],
    milestone: 'v3.5',
    phase: '147'
  }, overrides);
}

function assertEnvelopeV1(row) {
  for (const key of [
    'envelope_version', 'ts', 'command', 'status', 'reason_codes',
    'artifacts', 'evidence', 'next_action', 'risk', 'duration_ms',
    'run_id', 'phase', 'milestone'
  ]) {
    assert(Object.prototype.hasOwnProperty.call(row, key), `missing envelope-v1 field ${key}`);
  }
  assert.strictEqual(row.envelope_version, 1);
  assert.match(row.run_id, /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
}

function assertShadowRowHasPerPathEvidence(row) {
  assert(Array.isArray(row.staged_paths), 'staged_paths must be present');
  assert(Array.isArray(row.path_evidence), 'path_evidence must be present');
  assert(row.path_evidence.length > 0, 'path_evidence must not be empty');
  for (const record of row.path_evidence) {
    assert(Object.prototype.hasOwnProperty.call(record, 'path'), 'path evidence missing path');
    assert(Object.prototype.hasOwnProperty.call(record, 'source_touching'), 'path evidence missing source_touching');
    assert(Object.prototype.hasOwnProperty.call(record, 'evidence_status'), 'path evidence missing evidence_status');
    assert(Object.prototype.hasOwnProperty.call(record, 'matched_artifacts'), 'path evidence missing matched_artifacts');
    assert(Object.prototype.hasOwnProperty.call(record, 'reason_code'), 'path evidence missing reason_code');
  }
}
function writeGsdeditsEvidence(fixture, sourcePaths) {
  const phaseDir = path.join(
    '.planning',
    'milestones',
    fixture.milestone,
    'phases',
    `${fixture.phase}-fixture`
  );
  const allowed = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];
  writeContainedFile(
    fixture.repoDir,
    path.join(phaseDir, `${fixture.phase}-01-PLAN-LOCKED.md`),
    [
      '---',
      'schema_version: 2',
      `phase: ${JSON.stringify(fixture.phase)}`,
      'allowed_files:',
      ...allowed.map((item) => `  - ${JSON.stringify(String(item).replace(/\\/g, '/'))}`),
      '---',
      '',
      '# Fixture PLAN-LOCKED',
      ''
    ].join('\n')
  );
  writeContainedFile(
    fixture.repoDir,
    path.join(phaseDir, `${fixture.phase}-ATC-REVIEW.md`),
    [
      '# Fixture ATC Review',
      '',
      'Verdict: pass',
      ''
    ].join('\n')
  );
}

function writeFalseBareArtifacts(fixture) {
  const phaseDir = path.join(
    '.planning',
    'milestones',
    fixture.milestone,
    'phases',
    `${fixture.phase}-fixture`
  );
  writeContainedFile(fixture.repoDir, path.join(phaseDir, 'PLAN.md'), '# Bare plan\n');
  writeContainedFile(fixture.repoDir, path.join(phaseDir, 'AUDIT.md'), '# Bare audit\n');
}

function evaluateStagedFixture(fixture, paths) {
  const { evaluatePaths } = loadConventions();
  for (const rel of paths) {
    writeContainedFile(fixture.repoDir, rel, `fixture ${rel}\n`);
  }
  stagePaths(fixture.repoDir, paths);
  return evaluatePaths(fixture.repoDir, stagedNameStatus(fixture.repoDir), readState(fixture.repoDir));
}

function assertSourcePredicate() {
  const { evaluatePaths, isSourceTouching } = loadConventions();
  const positives = [
    '.env',
    '.env.local',
    '.gitignore',
    '.npmrc',
    'Dockerfile',
    'docker-compose.yml',
    'Makefile',
    'super-gsd/scripts/lib/x.cjs',
    'super-gsd/docs/commit-gate.md',
    'scripts/tool.cjs',
    '.agents/skills/example/SKILL.md',
    '.codex/hooks.json',
    '.warp/workflows/sgsd.yaml',
    'custom-gsd-extract/run.ps1',
    'package-lock.json'
  ];
  const negatives = [
    '.planning/STATE.md',
    'docs/x.md',
    'README.md',
    'reports/summary.md'
  ];

  for (const item of positives) {
    assert.strictEqual(isSourceTouching(item), true, `${item} should be source-touching`);
  }
  for (const item of negatives) {
    assert.strictEqual(isSourceTouching(item), false, `${item} should not be source-touching`);
  }

  const records = evaluatePaths(process.cwd(), ['docs/x.md', 'README.md'], null);
  assert.deepStrictEqual(
    records.map((record) => record.evidence_status),
    ['not_source', 'not_source'],
    'docs-only paths must not warn'
  );
}

function assertCleanupFixtureContainment() {
  const directTemp = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-direct-temp-'));
  let refused;
  assert.doesNotThrow(() => {
    refused = cleanupFixture(directTemp);
  }, 'cleanupFixture must never throw for unregistered temp dirs');
  assert.strictEqual(fs.existsSync(directTemp), true, 'unregistered temp dir must not be deleted');
  assert.strictEqual(refused.cleaned, false);
  assert.strictEqual(refused.reason_code, 'fixture_not_registered');
  fs.rmSync(directTemp, { recursive: true, force: true });

  const fixtureRoot = tempFixtureRoot();
  let cleaned;
  assert.strictEqual(fs.existsSync(fixtureRoot), true, 'fixture root should exist before cleanup');
  assert.doesNotThrow(() => {
    cleaned = cleanupFixture(fixtureRoot);
  }, 'cleanupFixture must not throw for registered fixtures');
  assert.strictEqual(cleaned.cleaned, true);
  assert.strictEqual(cleaned.reason_code, 'fixture_removed');
  assert.strictEqual(fs.existsSync(fixtureRoot), false, 'registered fixture root should be deleted');
}

function assertInvalidPathRecords() {
  const { evaluatePaths } = loadConventions();
  const records = evaluatePaths(process.cwd(), ['../traversal', null], null);
  assert.strictEqual(records.length, 2, 'every staged path input must yield a record');
  assert.deepStrictEqual(
    records.map((record) => record.evidence_status),
    ['invalid_path', 'invalid_path']
  );
  assert.deepStrictEqual(
    records.map((record) => record.reason_code),
    ['path_traversal', 'path_not_string']
  );
}

function assertAllowedPathCasePolicy() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-case-policy', phase: '147', milestone: 'v3.5' });
  try {
    const { evaluatePaths } = loadConventions();
    const state = readState(fixture.repoDir);
    const stagedPath = 'SUPER-GSD/SCRIPTS/LIB/CASE.CJS';
    const cases = [
      'super-gsd/scripts/lib/case.cjs',
      'super-gsd/scripts/**',
      'super-gsd/**/*.cjs'
    ];
    for (const allowedPattern of cases) {
      writeGsdeditsEvidence(fixture, [allowedPattern]);
      const records = evaluatePaths(fixture.repoDir, [{ status: 'M', path: stagedPath }], state);
      assert.strictEqual(records.length, 1, `${allowedPattern} should produce one record`);
      assert.strictEqual(records[0].source_touching, true, `${stagedPath} should be source-touching`);
      assert.strictEqual(
        records[0].evidence_status,
        'backed',
        `${allowedPattern} should match staged path under the uniform case policy`
      );
    }
  } finally {
    fixture.cleanup();
  }
}
function assertGsdeditsBacked() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-shaped', phase: '147', milestone: 'v3.5' });
  try {
    const sourcePath = 'super-gsd/scripts/lib/covered.cjs';
    writeGsdeditsEvidence(fixture, [sourcePath]);
    const records = evaluateStagedFixture(fixture, [sourcePath]);
    assert.strictEqual(records.length, 1, 'expected one path record');
    assert.strictEqual(records[0].path, sourcePath);
    assert.strictEqual(records[0].source_touching, true);
    assert.strictEqual(records[0].evidence_status, 'backed');
    assert(records[0].matched_artifacts.length >= 2, 'expected plan and ATC artifacts');
  } finally {
    fixture.cleanup();
  }
}

function writeDiscoveredEvidence(fixture, sourcePaths) {
  const phaseDir = path.join(
    '.planning',
    'milestones',
    fixture.milestone,
    'phases',
    `${fixture.phase}-devcp-fixture`
  );
  const allowed = Array.isArray(sourcePaths) ? sourcePaths : [sourcePaths];
  writeContainedFile(
    fixture.repoDir,
    path.join(phaseDir, `${fixture.phase}-devcp-PLAN.md`),
    [
      '---',
      'schema_version: 2',
      `phase: ${JSON.stringify(fixture.phase)}`,
      'allowed_files:',
      ...allowed.map((item) => `  - ${JSON.stringify(String(item).replace(/\\/g, '/'))}`),
      '---',
      '',
      '# Fixture devcp plan',
      ''
    ].join('\n')
  );
  writeContainedFile(
    fixture.repoDir,
    path.join(phaseDir, `${fixture.phase}-devcp-VERIFICATION.md`),
    '# Fixture devcp verification\n'
  );
}
function assertFalsePlanAuditMissing() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-shaped-negative', phase: '147', milestone: 'v3.5' });
  try {
    const sourcePath = 'super-gsd/scripts/lib/uncovered.cjs';
    writeFalseBareArtifacts(fixture);
    const records = evaluateStagedFixture(fixture, [sourcePath]);
    assert.strictEqual(records.length, 1, 'expected one path record');
    assert.strictEqual(records[0].source_touching, true);
    assert.strictEqual(records[0].evidence_status, 'missing');
    assert.deepStrictEqual(records[0].matched_artifacts, []);
  } finally {
    fixture.cleanup();
  }
}

function assertConventionUnknown() {
  const fixture = createTempGitRepo({ repoId: 'devcp', phase: '147', milestone: 'v3.5' });
  try {
    const { discoverConvention, evaluatePaths } = loadConventions();
    writeContainedFile(
      fixture.repoDir,
      path.join('.planning', 'notes', 'random.md'),
      '# Repo-local planning, but no provable convention\n'
    );
    const discovered = discoverConvention(fixture.repoDir);
    assert.strictEqual(discovered.convention, 'unknown');
    assert.strictEqual(discovered.reason_code, 'convention_unknown');
    assert(Array.isArray(discovered.evidence), 'evidence must be an array');

    const sourcePath = 'src/index.cjs';
    writeContainedFile(fixture.repoDir, sourcePath, 'module.exports = 1;\n');
    stagePaths(fixture.repoDir, [sourcePath]);
    const records = evaluatePaths(fixture.repoDir, stagedNameStatus(fixture.repoDir), readState(fixture.repoDir));
    assert.strictEqual(records.length, 1, 'expected one path record');
    assert.strictEqual(records[0].source_touching, true);
    assert.notStrictEqual(records[0].evidence_status, 'backed');
    assert.strictEqual(records[0].evidence_status, 'missing');
  } finally {
    fixture.cleanup();
  }
}

function assertPerPathGranularity() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-per-path', phase: '147', milestone: 'v3.5' });
  try {
    const backedA = 'super-gsd/scripts/lib/backed-a.cjs';
    const backedB = '.codex/hooks.json';
    const missing = 'custom-gsd-extract/missing.cjs';
    writeGsdeditsEvidence(fixture, [backedA, backedB]);
    const records = evaluateStagedFixture(fixture, [backedA, backedB, missing]);
    const byPath = new Map(records.map((record) => [record.path, record]));
    assert.strictEqual(byPath.get(backedA).evidence_status, 'backed');
    assert.strictEqual(byPath.get(backedB).evidence_status, 'backed');
    assert.strictEqual(byPath.get(missing).evidence_status, 'missing');
    assert.strictEqual(records.filter((record) => record.evidence_status === 'missing').length, 1);
  } finally {
    fixture.cleanup();
  }
}

function assertAllArtifactConventionCases() {
  assertSourcePredicate();
  assertGsdeditsBacked();
  assertFalsePlanAuditMissing();
  assertConventionUnknown();
  assertPerPathGranularity();
}

function assertContainedShadowWrite() {
  const { appendShadowRow, readShadowRows, shadowLedgerPath } = loadShadowLog();
  const fixture = createBareSgsdFixture({ repoId: 'shadow-contained' });
  try {
    const diff = 'fixture diff\n';
    const expectedHash = crypto.createHash('sha256').update(diff).digest('hex');
    const row = appendShadowRow(fixture.repoDir, sampleShadowRow({ diff_content: diff }));
    assert(row, 'contained append should return the written row');
    assertEnvelopeV1(row);
    assert.strictEqual(row.signal, 'commit_gate_shadow');
    assert.strictEqual(row.diff_sha256, expectedHash);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(row, 'diff_content'), false);
    assertShadowRowHasPerPathEvidence(row);

    const ledger = shadowLedgerPath(fixture.repoDir);
    assert(ledger, 'shadowLedgerPath should resolve for SGSD fixture root');
    assert(realPathStartsWith(realpathOrNull(fixture.repoDir), realpathOrNull(ledger)), 'ledger must stay inside fixture root');

    const lines = fs.readFileSync(ledger, 'utf8').trim().split(/\r?\n/);
    assert.strictEqual(lines.length, 1, 'contained append should write one JSONL row');
    const parsed = JSON.parse(lines[0]);
    assertEnvelopeV1(parsed);
    assertShadowRowHasPerPathEvidence(parsed);
    assert.deepStrictEqual(parsed.staged_paths, ['super-gsd/scripts/lib/shadow-fixture.cjs']);

    const read = readShadowRows(fixture.repoDir, { limit: 10 });
    assert.strictEqual(read.rows.length, 1, 'readShadowRows should return appended row');
    assert.strictEqual(read.skipped_line_count, 0);
  } finally {
    fixture.cleanup();
  }
}

function assertShadowEscapeAttemptsRefused() {
  const { appendShadowRow } = loadShadowLog();
  const absoluteDestination = path.join(os.tmpdir(), `sgsd-shadow-escape-${process.pid}-${Date.now()}.jsonl`);
  const absolute = captureStderr(() => appendShadowRow(absoluteDestination, sampleShadowRow()));
  assert.strictEqual(absolute.value, null, 'absolute temp path must not be treated as a ledger destination');
  assert.match(absolute.stderr, /shadow_ledger_root_not_found/);
  assert.strictEqual(/\n\s+at\s/.test(absolute.stderr), false, 'breadcrumb must not include a stack trace');
  assert.strictEqual(fs.existsSync(absoluteDestination), false, 'absolute destination file must not be created');

  const bare = createBareSgsdFixture({ repoId: 'bare-planning-no-state', withState: false });
  try {
    const bareResult = captureStderr(() => appendShadowRow(bare.repoDir, sampleShadowRow()));
    assert.strictEqual(bareResult.value, null, 'bare .planning without STATE.md must be refused');
    assert.match(bareResult.stderr, /shadow_ledger_root_not_found/);
    assert.strictEqual(fs.existsSync(path.join(bare.repoDir, '.planning', 'metrics', 'commit-gate-shadow.jsonl')), false);
  } finally {
    bare.cleanup();
  }

  const linkRoot = tempFixtureRoot();
  const outsideRoot = tempFixtureRoot();
  let planningLink = null;
  try {
    const repoDir = contained(linkRoot, 'junction-repo');
    const outsidePlanning = contained(outsideRoot, 'outside-planning');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.mkdirSync(outsidePlanning, { recursive: true });
    fs.writeFileSync(path.join(outsidePlanning, 'STATE.md'), '---\nmilestone: v3.5\ncurrent_phase: "147"\n---\n', 'utf8');
    planningLink = path.join(repoDir, '.planning');
    try {
      fs.symlinkSync(outsidePlanning, planningLink, process.platform === 'win32' ? 'junction' : 'dir');
    } catch (error) {
      console.log(`[SKIP] shadow-ledger-junction: ${error.code || error.message}`);
      return;
    }
    const linked = captureStderr(() => appendShadowRow(repoDir, sampleShadowRow()));
    assert.strictEqual(linked.value, null, '.planning junction to outside dir must be refused');
    assert.match(linked.stderr, /shadow_ledger_root_not_found|shadow_ledger_containment_refused/);
    assert.strictEqual(fs.existsSync(path.join(outsidePlanning, 'metrics', 'commit-gate-shadow.jsonl')), false);
  } finally {
    if (planningLink && fs.existsSync(planningLink)) {
      try { fs.rmSync(planningLink, { recursive: true, force: true }); } catch {}
    }
    cleanupFixture(linkRoot);
    cleanupFixture(outsideRoot);
  }
}

function assertMetricsFileDegradedRow() {
  const { appendShadowRow } = loadShadowLog();
  const fixture = createBareSgsdFixture({ repoId: 'metrics-file-degraded' });
  try {
    writeContainedFile(fixture.repoDir, path.join('.planning', 'metrics'), 'metrics is a file\n');
    const result = captureStderr(() => appendShadowRow(fixture.repoDir, sampleShadowRow()));
    assert(result.value, 'append failure under known root should return a degraded row');
    assertEnvelopeV1(result.value);
    assertShadowRowHasPerPathEvidence(result.value);
    assert(result.value.reason_codes.includes('shadow_ledger_append_failed'));
    assert.match(result.stderr, /shadow_ledger_append_failed/);
    assert.strictEqual(/\n\s+at\s/.test(result.stderr), false, 'breadcrumb must not include a stack trace');
    assert.strictEqual(fs.existsSync(path.join(fixture.repoDir, '.planning', 'metrics', 'commit-gate-shadow.jsonl')), false);
  } finally {
    fixture.cleanup();
  }
}

function assertMalformedInputGetsDegradedRow() {
  const { appendShadowRow, readShadowRows } = loadShadowLog();
  const fixture = createBareSgsdFixture({ repoId: 'malformed-row-degraded' });
  try {
    const result = captureStderr(() => appendShadowRow(fixture.repoDir, null));
    assert(result.value, 'malformed input under known root should return a degraded row');
    assert(result.value.reason_codes.includes('shadow_row_malformed'));
    assertShadowRowHasPerPathEvidence(result.value);
    assert.match(result.stderr, /shadow_row_malformed/);
    const read = readShadowRows(fixture.repoDir, { limit: 10 });
    assert.strictEqual(read.rows.length, 1, 'malformed input should be persisted as degraded row when root is known');
    assert(read.rows[0].reason_codes.includes('shadow_row_malformed'));
    assertShadowRowHasPerPathEvidence(read.rows[0]);
  } finally {
    fixture.cleanup();
  }
}

function manualShadowLedgerRow(index) {
  const stagedPath = `src/file-${index}.cjs`;
  return {
    envelope_version: 1,
    ts: '2026-08-07T00:00:00.000Z',
    command: 'appendCommitGateShadowRow',
    status: 'ok',
    reason_codes: [],
    artifacts: [],
    evidence: [],
    next_action: null,
    risk: null,
    duration_ms: null,
    run_id: `2026-08-07T00:00:00.000Z-${(index % 65536).toString(16).padStart(4, '0')}`,
    phase: '147',
    milestone: 'v3.5',
    signal: 'commit_gate_shadow',
    repo_id: 'fixture-repo',
    commit_candidate: `commit-${index}`,
    diff_sha256: crypto.createHash('sha256').update(String(index)).digest('hex'),
    artifact_predicate_version: 't147-01',
    artifact_convention_status: 'gsdedits_artifacts_discovered',
    staged_paths: [stagedPath],
    path_evidence: samplePathEvidence(stagedPath),
    would_warn: false,
    would_block: false,
    false_block_basis: [],
    waived_paths: []
  };
}

function assertBoundedTailRead() {
  const { readShadowRows, shadowLedgerPath } = loadShadowLog();
  const fixture = createBareSgsdFixture({ repoId: 'bounded-tail-read' });
  try {
    const ledger = shadowLedgerPath(fixture.repoDir);
    fs.mkdirSync(path.dirname(ledger), { recursive: true });
    const lines = [];
    for (let index = 0; index < 2900; index += 1) lines.push(JSON.stringify(manualShadowLedgerRow(index)));
    for (let index = 2900; index < 2940; index += 1) lines.push(JSON.stringify(manualShadowLedgerRow(index)));
    lines.push('{not-json');
    for (let index = 2940; index < 2970; index += 1) lines.push(JSON.stringify(manualShadowLedgerRow(index)));
    lines.push('also not json');
    for (let index = 2970; index < 3000; index += 1) lines.push(JSON.stringify(manualShadowLedgerRow(index)));
    fs.writeFileSync(ledger, `${lines.join('\n')}\n`, 'utf8');

    const started = process.hrtime.bigint();
    const read = readShadowRows(fixture.repoDir, { limit: 100 });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert.strictEqual(read.rows.length, 100, 'reader should return 100 valid tail rows');
    assert.strictEqual(read.skipped_line_count, 2, 'reader should count corrupt tail lines');
    assert.strictEqual(read.rows[0].commit_candidate, 'commit-2900');
    assert.strictEqual(read.rows[99].commit_candidate, 'commit-2999');
    assert(elapsedMs < 1000, `tail read should be fast, got ${elapsedMs}ms`);
  } finally {
    fixture.cleanup();
  }
}

function assertBinaryDiffHashOnly() {
  const { appendShadowRow, shadowLedgerPath } = loadShadowLog();
  const fixture = createBareSgsdFixture({ repoId: 'binary-diff-hash' });
  try {
    const diff = Buffer.from([0, 255, 16, 128, 65, 66, 67]);
    const expectedHash = crypto.createHash('sha256').update(diff).digest('hex');
    const row = appendShadowRow(fixture.repoDir, sampleShadowRow({ diff_content: diff }));
    assert(row, 'binary diff append should return a row');
    assert.strictEqual(row.diff_sha256, expectedHash);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(row, 'diff_content'), false);

    const line = fs.readFileSync(shadowLedgerPath(fixture.repoDir), 'utf8');
    assert.strictEqual(line.includes('\uFFFD'), false, 'written JSON must not contain replacement characters');
    assert.strictEqual(line.includes('"data"'), false, 'Buffer payload data must not be embedded');
    const parsed = JSON.parse(line);
    assert.strictEqual(parsed.diff_sha256, expectedHash);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(parsed, 'diff_content'), false);
    assertShadowRowHasPerPathEvidence(parsed);
  } finally {
    fixture.cleanup();
  }
}

function assertShadowLedgerContainedWriter() {
  assertContainedShadowWrite();
  assertShadowEscapeAttemptsRefused();
  assertMalformedInputGetsDegradedRow();
  assertMetricsFileDegradedRow();
  assertBoundedTailRead();
  assertBinaryDiffHashOnly();
}
function assertNoStack(stderr) {
  assert.strictEqual(/\n\s+at\s/.test(String(stderr || '')), false, 'stderr breadcrumb must not include a stack trace');
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function assertHookWarnUnbacked() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-hook-warn', phase: '147', milestone: 'v3.5' });
  try {
    const sourcePath = 'super-gsd/scripts/lib/unbacked.cjs';
    writeContainedFile(fixture.repoDir, sourcePath, 'module.exports = 147;\n');
    stagePaths(fixture.repoDir, [sourcePath]);
    const expectedHash = binaryDiffSha256(fixture.repoDir);

    const result = runActualHook(fixture.repoDir);
    assert.strictEqual(result.status, 0, `warn mode must exit 0, got ${result.status}: ${result.stderr}`);
    assert.match(result.stderr, /\[SGSD\] commit gate warning/i);
    assert.match(result.stderr, /one governance layer/i);
    assert.match(result.stderr, new RegExp(escapeRegExp(sourcePath)));
    assertNoStack(result.stderr);

    const rows = readJsonl(fixture.repoDir, path.join('.planning', 'metrics', 'commit-gate-shadow.jsonl'));
    assert.strictEqual(rows.length, 1, 'source warn should append exactly one shadow row');
    const row = rows[0];
    assertEnvelopeV1(row);
    assert.strictEqual(row.signal, 'commit_gate_shadow');
    assert.strictEqual(row.status, 'warn');
    assert.strictEqual(row.diff_sha256, expectedHash, 'row diff_sha256 must match independently computed staged binary diff hash');
    assert.deepStrictEqual(row.staged_paths, [sourcePath]);
    assert.strictEqual(row.would_warn, true);
    assert.strictEqual(row.would_block, false);
    assert(row.reason_codes.includes('plan_evidence_missing'), 'missing plan evidence reason should be recorded');
    assertShadowRowHasPerPathEvidence(row);
    assert.strictEqual(row.path_evidence.length, 1);
    assert.strictEqual(row.path_evidence[0].path, sourcePath);
    assert.strictEqual(row.path_evidence[0].source_touching, true);
    assert.strictEqual(row.path_evidence[0].evidence_status, 'missing');
    assert.strictEqual(row.path_evidence[0].reason_code, 'plan_evidence_missing');
  } finally {
    fixture.cleanup();
  }
}

function assertHookDocsOnlyNotSourceRow() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-hook-docs', phase: '147', milestone: 'v3.5' });
  try {
    const docsPath = 'docs/commit-gate-note.md';
    writeContainedFile(fixture.repoDir, docsPath, '# docs only\n');
    stagePaths(fixture.repoDir, [docsPath]);
    const expectedHash = binaryDiffSha256(fixture.repoDir);

    const result = runActualHook(fixture.repoDir);
    assert.strictEqual(result.status, 0, `docs-only hook must exit 0, got ${result.status}: ${result.stderr}`);
    assert.doesNotMatch(result.stderr, /\[SGSD\] commit gate warning/i, 'docs-only path must not emit a warn banner');

    const rows = readJsonl(fixture.repoDir, path.join('.planning', 'metrics', 'commit-gate-shadow.jsonl'));
    assert.strictEqual(rows.length, 1, 'docs-only commit attempts are recorded as one not-source row');
    const row = rows[0];
    assertEnvelopeV1(row);
    assert.strictEqual(row.status, 'ok');
    assert.strictEqual(row.diff_sha256, expectedHash);
    assert.deepStrictEqual(row.staged_paths, [docsPath]);
    assert.strictEqual(row.would_warn, false);
    assert.strictEqual(row.would_block, false);
    assert(!row.reason_codes.some((code) => /evidence_missing/.test(code)), 'docs-only row must not carry missing-evidence reasons');
    assertShadowRowHasPerPathEvidence(row);
    assert.strictEqual(row.path_evidence[0].path, docsPath);
    assert.strictEqual(row.path_evidence[0].source_touching, false);
    assert.strictEqual(row.path_evidence[0].evidence_status, 'not_source');
  } finally {
    fixture.cleanup();
  }
}

function assertHookSentinelSkip() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-hook-sentinel', phase: '147', milestone: 'v3.5' });
  try {
    const sourcePath = 'super-gsd/scripts/lib/waived.cjs';
    writeContainedFile(fixture.repoDir, '.sgsd-gate-off', 'waive this commit attempt\n');
    writeContainedFile(fixture.repoDir, sourcePath, 'module.exports = "waived";\n');
    stagePaths(fixture.repoDir, [sourcePath]);
    const expectedHash = binaryDiffSha256(fixture.repoDir);

    const result = runActualHook(fixture.repoDir);
    assert.strictEqual(result.status, 0, `sentinel hook must exit 0, got ${result.status}: ${result.stderr}`);
    assert.match(result.stderr, /sentinel/i);
    assert.match(result.stderr, new RegExp(escapeRegExp(sourcePath)));
    assertNoStack(result.stderr);

    const rows = readJsonl(fixture.repoDir, path.join('.planning', 'metrics', 'commit-gate-shadow.jsonl'));
    assert.strictEqual(rows.length, 1, 'sentinel commit attempt should append exactly one skip row');
    const row = rows[0];
    assertEnvelopeV1(row);
    assert.strictEqual(row.status, 'skipped');
    assert.strictEqual(row.diff_sha256, expectedHash);
    assert.deepStrictEqual(row.staged_paths, [sourcePath]);
    assert.deepStrictEqual(row.waived_paths, [sourcePath]);
    assert(row.reason_codes.includes('sentinel_waived_block'), 'sentinel reason code should be recorded');
    assert.strictEqual(row.would_block, false);
    assertShadowRowHasPerPathEvidence(row);
    assert.strictEqual(row.path_evidence[0].path, sourcePath);
  } finally {
    fixture.cleanup();
  }
}

function assertHookFailOpenDegraded() {
  const fixture = createBareSgsdFixture({ repoId: 'sgsd-no-git-worktree', phase: '147', milestone: 'v3.5' });
  try {
    const result = runActualHook(fixture.repoDir);
    assert.strictEqual(result.status, 0, `internal/git error must fail open, got ${result.status}: ${result.stderr}`);
    assert.match(result.stderr, /degraded/i);
    assert.match(result.stderr, /git_name_status_failed|git_diff_failed|git_spawn_failed/i);
    assertNoStack(result.stderr);

    const rows = readJsonl(fixture.repoDir, path.join('.planning', 'metrics', 'commit-gate-shadow.jsonl'));
    assert.strictEqual(rows.length, 1, 'SGSD-root git failure should append one degraded row');
    const row = rows[0];
    assertEnvelopeV1(row);
    assert.strictEqual(row.status, 'warn');
    assert(row.reason_codes.includes('git_name_status_failed') || row.reason_codes.includes('git_diff_failed') || row.reason_codes.includes('git_spawn_failed'));
    assertShadowRowHasPerPathEvidence(row);
  } finally {
    fixture.cleanup();
  }
}

function assertHookNonSgsdNoWrite() {
  const fixture = createPlainGitRepo({ repoId: 'plain-hook-repo' });
  try {
    const sourcePath = 'src/index.cjs';
    writeContainedFile(fixture.repoDir, sourcePath, 'module.exports = 1;\n');
    stagePaths(fixture.repoDir, [sourcePath]);

    const result = runActualHook(fixture.repoDir);
    assert.strictEqual(result.status, 0, `non-SGSD repo must exit 0, got ${result.status}: ${result.stderr}`);
    assert.match(result.stderr, /non-SGSD/i);
    assertNoStack(result.stderr);
    assert.strictEqual(
      fs.existsSync(path.join(fixture.repoDir, '.planning', 'metrics', 'commit-gate-shadow.jsonl')),
      false,
      'non-SGSD repo must not receive an arbitrary metrics file'
    );
  } finally {
    fixture.cleanup();
  }
}

function assertHookWarnSentinelFailOpen() {
  assertHookWarnUnbacked();
  assertHookDocsOnlyNotSourceRow();
  assertHookSentinelSkip();
  assertHookFailOpenDegraded();
  assertHookNonSgsdNoWrite();
}
function modeFilePath(fixture) {
  return contained(fixture.repoDir, path.join('.planning', 'config', 'commit-gate-mode.json'));
}

function appendSyntheticShadowRows(fixture, count, falseBlockCount, options = {}) {
  const { appendShadowRow } = loadShadowLog();
  const repoBase = path.basename(fixture.repoDir);
  const conventionStatus = options.conventionStatus || (/^devcp$/i.test(repoBase)
    ? 'repo_local_convention_discovered'
    : 'gsdedits_artifacts_discovered');
  const sourcePrefix = /^devcp$/i.test(repoBase) ? 'src' : 'super-gsd/scripts/lib';
  const artifactPath = /^devcp$/i.test(repoBase)
    ? `.planning/milestones/${fixture.milestone}/phases/${fixture.phase}-devcp-fixture/${fixture.phase}-devcp-PLAN.md`
    : `.planning/milestones/${fixture.milestone}/phases/${fixture.phase}-fixture/${fixture.phase}-01-PLAN-LOCKED.md`;

  for (let index = 0; index < count; index += 1) {
    const stagedPath = `${sourcePrefix}/shadow-report-${index}.cjs`;
    const falseBlock = index < falseBlockCount;
    const evidence = [{
      path: stagedPath,
      source_touching: true,
      evidence_status: falseBlock ? 'backed' : 'missing',
      matched_artifacts: falseBlock ? [artifactPath] : [],
      reason_code: falseBlock ? 'path_evidence_backed' : 'phase_evidence_missing'
    }];
    const row = appendShadowRow(fixture.repoDir, sampleShadowRow({
      status: falseBlock ? 'blocked' : 'warn',
      repo_id: repoBase,
      commit_candidate: `synthetic-${repoBase}-${index}`,
      diff_content: `diff-${repoBase}-${index}\n`,
      artifact_convention_status: conventionStatus,
      staged_paths: [stagedPath],
      path_evidence: evidence,
      would_warn: !falseBlock,
      would_block: falseBlock,
      false_block_basis: falseBlock ? [`${stagedPath}:path_evidence_backed`] : [],
      reason_codes: [evidence[0].reason_code]
    }));
    assert(row, 'synthetic report row must be written by appendShadowRow');
  }
}

function createReportPair(options = {}) {
  const gsd = createBareSgsdFixture({ repoId: 'GSDedits', phase: '147', milestone: 'v3.5' });
  const devcp = createBareSgsdFixture({ repoId: 'devcp', phase: '147', milestone: 'v3.5' });
  Object.assign(gsd, { phase: '147', milestone: 'v3.5' });
  Object.assign(devcp, { phase: '147', milestone: 'v3.5' });
  try {
    if (options.unknownDevcp !== true) writeDiscoveredEvidence(devcp, ['src/**']);
    writeGsdeditsEvidence(gsd, ['super-gsd/scripts/lib/**']);
    appendSyntheticShadowRows(gsd, options.gsdRows ?? 102, options.gsdFalseBlocks ?? 0);
    appendSyntheticShadowRows(devcp, options.devcpRows ?? 102, options.devcpFalseBlocks ?? 0, {
      conventionStatus: options.unknownDevcp === true ? 'convention_unknown' : 'repo_local_convention_discovered'
    });
    return { gsd, devcp, cleanup() { gsd.cleanup(); devcp.cleanup(); } };
  } catch (error) {
    gsd.cleanup();
    devcp.cleanup();
    throw error;
  }
}

function repoSummary(report, repoKey) {
  return report.repos.find((repo) => repo.repo_key === repoKey);
}

function assertShadowReportMath() {
  const { buildShadowReport } = loadShadowReport();

  const passPair = createReportPair({ gsdRows: 102, devcpRows: 102, gsdFalseBlocks: 5, devcpFalseBlocks: 5 });
  try {
    const report = buildShadowReport([passPair.gsd.repoDir, passPair.devcp.repoDir]);
    assert.strictEqual(report.falsifier.passed, true, JSON.stringify(report.falsifier));
    assert.strictEqual(report.total.real_payload_count, 204);
    assert.strictEqual(report.total.false_block_count, 10);
    assert.strictEqual(report.total.skipped_line_count, 0);
    assert(repoSummary(report, 'GSDedits').false_block_rate < 0.05, 'GSDedits 5/102 should pass under 5%');
    assert(repoSummary(report, 'devcp').false_block_rate < 0.05, 'devcp 5/102 should pass under 5%');
  } finally {
    passPair.cleanup();
  }

  const lowPair = createReportPair({ gsdRows: 100, devcpRows: 99 });
  try {
    const report = buildShadowReport([lowPair.gsd.repoDir, lowPair.devcp.repoDir]);
    assert.strictEqual(report.falsifier.passed, false);
    assert(report.falsifier.reason_codes.includes('insufficient_real_payloads'));
  } finally {
    lowPair.cleanup();
  }

  const highFalsePair = createReportPair({ gsdRows: 98, devcpRows: 102, gsdFalseBlocks: 5 });
  try {
    const report = buildShadowReport([highFalsePair.gsd.repoDir, highFalsePair.devcp.repoDir]);
    assert.strictEqual(report.falsifier.passed, false);
    assert(report.falsifier.reason_codes.includes('false_block_rate_high'));
    assert(repoSummary(report, 'GSDedits').false_block_rate > 0.05, 'GSDedits 5/98 should fail above 5%');
  } finally {
    highFalsePair.cleanup();
  }

  const corruptPair = createReportPair({ gsdRows: 102, devcpRows: 102 });
  try {
    const { shadowLedgerPath } = loadShadowLog();
    fs.appendFileSync(shadowLedgerPath(corruptPair.devcp.repoDir), '{not-json\n', 'utf8');
    const report = buildShadowReport([corruptPair.gsd.repoDir, corruptPair.devcp.repoDir]);
    assert.strictEqual(report.falsifier.passed, false);
    assert(report.falsifier.reason_codes.includes('shadow_ledger_corrupt'));
    assert.strictEqual(repoSummary(report, 'devcp').skipped_line_count, 1);
  } finally {
    corruptPair.cleanup();
  }

  const missing = createBareSgsdFixture({ repoId: 'GSDedits', phase: '147', milestone: 'v3.5' });
  Object.assign(missing, { phase: '147', milestone: 'v3.5' });
  try {
    writeGsdeditsEvidence(missing, ['super-gsd/scripts/lib/**']);
    const report = buildShadowReport([missing.repoDir]);
    assert.strictEqual(report.falsifier.passed, false);
    assert(report.falsifier.reason_codes.includes('shadow_ledger_missing'));
    assert(report.falsifier.reason_codes.includes('required_repo_missing_devcp'));
  } finally {
    missing.cleanup();
  }

  const unknownPair = createReportPair({ gsdRows: 102, devcpRows: 102, unknownDevcp: true });
  try {
    const report = buildShadowReport([unknownPair.gsd.repoDir, unknownPair.devcp.repoDir]);
    assert.strictEqual(report.falsifier.passed, false);
    assert(report.falsifier.reason_codes.includes('convention_unknown'));
  } finally {
    unknownPair.cleanup();
  }
}

function assertShadowReportActivation() {
  assertShadowReportMath();

  const reportOnly = createReportPair({ gsdRows: 102, devcpRows: 102, gsdFalseBlocks: 5, devcpFalseBlocks: 5 });
  try {
    const result = runActualHookInProcess(reportOnly.gsd.repoDir, ['--shadow-report', '--repo-root', reportOnly.devcp.repoDir]);
    assert.strictEqual(result.status, 0, `shadow report should exit 0: ${result.stderr}`);
    const report = JSON.parse(result.stdout);
    assert.strictEqual(report.falsifier.passed, true);
    assert.strictEqual(fs.existsSync(modeFilePath(reportOnly.gsd)), false, 'reporting alone must not create mode file');
  } finally {
    reportOnly.cleanup();
  }

  const failing = createReportPair({ gsdRows: 100, devcpRows: 99 });
  try {
    const result = runActualHookInProcess(failing.gsd.repoDir, ['--activate-block', '--repo-root', failing.devcp.repoDir]);
    assert.notStrictEqual(result.status, 0, 'failing verdict must refuse activation');
    assert.match(result.stderr, /activation refused/i);
    assert.strictEqual(fs.existsSync(modeFilePath(failing.gsd)), false, 'failing activation must not create mode file');
  } finally {
    failing.cleanup();
  }

  const passing = createReportPair({ gsdRows: 102, devcpRows: 102, gsdFalseBlocks: 5, devcpFalseBlocks: 5 });
  try {
    const result = runActualHookInProcess(passing.gsd.repoDir, ['--activate-block', '--repo-root', passing.devcp.repoDir]);
    assert.strictEqual(result.status, 0, `passing verdict should activate: ${result.stderr}`);
    const mode = JSON.parse(fs.readFileSync(modeFilePath(passing.gsd), 'utf8'));
    assert.strictEqual(mode.mode, 'block');
    assert.strictEqual(mode.report_summary.falsifier_passed, true);
    assert.strictEqual(mode.report_summary.total_real_payload_count, 204);
    assert(typeof mode.activated_at === 'string' && mode.activated_at.length > 0, 'activation timestamp must be embedded');
    assert(typeof mode.activated_by === 'string' && mode.activated_by.length > 0, 'activation actor must be embedded');

    const deactivated = runActualHookInProcess(passing.gsd.repoDir, ['--deactivate-block']);
    assert.strictEqual(deactivated.status, 0, `deactivation should exit 0: ${deactivated.stderr}`);
    assert.strictEqual(fs.existsSync(modeFilePath(passing.gsd)), false, 'deactivation must remove block mode file');
    const rows = readJsonl(passing.gsd.repoDir, path.join('.planning', 'metrics', 'commit-gate-shadow.jsonl'));
    assert(rows.some((row) => Array.isArray(row.reason_codes) && row.reason_codes.includes('mode_deactivated')), 'deactivation must be logged');
  } finally {
    passing.cleanup();
  }
}
function assertHookShape(hookPath) {
  const content = fs.readFileSync(hookPath, 'utf8');
  assert.strictEqual(content.split(/\r?\n/, 1)[0], '#!/bin/sh', 'installed hook must be POSIX sh');
  assert(content.includes(installerMarker), 'installed hook must carry SGSD marker');
  return content;
}

function assertInstallerHonorsCoreHooksPath() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-core-hooks-path', phase: '147', milestone: 'v3.5' });
  try {
    copyCommitGateRuntime(fixture);
    fs.mkdirSync(contained(fixture.repoDir, '.githooks'), { recursive: true });
    git(fixture.repoDir, ['config', 'core.hooksPath', '.githooks']);

    const result = runInstaller(fixture.repoDir, ['--install']);
    assert.strictEqual(result.status, 0, `core.hooksPath install should exit 0: ${result.stderr}`);
    const hookPath = gitResolvedHookPath(fixture.repoDir);
    assert.strictEqual(path.relative(contained(fixture.repoDir, '.githooks'), hookPath), 'pre-commit');
    assertHookShape(hookPath);
    assert.match(result.stdout, /installed hook/i);
    assert.match(result.stdout, new RegExp(escapeRegExp(hookPath)));
    assert.strictEqual(git(fixture.repoDir, ['config', '--get', 'core.hooksPath']).stdout.trim(), '.githooks');
  } finally {
    fixture.cleanup();
  }
}

function assertInstallerLifecycle() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-installer-lifecycle', phase: '147', milestone: 'v3.5' });
  try {
    copyCommitGateRuntime(fixture);
    const first = runInstaller(fixture.repoDir, ['--install']);
    assert.strictEqual(first.status, 0, `install should exit 0: ${first.stderr}`);
    const hookPath = gitResolvedHookPath(fixture.repoDir);
    assert.strictEqual(fs.existsSync(hookPath), true, 'hook must exist at git-resolved path');
    const firstContent = assertHookShape(hookPath);
    assert.match(first.stdout, /installed hook/i);
    assert.match(first.stdout, new RegExp(escapeRegExp(hookPath)));

    const second = runInstaller(fixture.repoDir, ['--install']);
    assert.strictEqual(second.status, 0, `reinstall should exit 0: ${second.stderr}`);
    assert.match(second.stderr, /hook_already_current/);
    assert.strictEqual(fs.readFileSync(hookPath, 'utf8'), firstContent, 'reinstall must be byte-identical');

    const dryUninstall = runInstaller(fixture.repoDir, ['--uninstall', '--dry-run']);
    assert.strictEqual(dryUninstall.status, 0, `dry-run uninstall should exit 0: ${dryUninstall.stderr}`);
    assert.match(dryUninstall.stdout, /DRY RUN/i);
    assert.strictEqual(fs.existsSync(hookPath), true, 'dry-run uninstall must leave hook in place');

    const removed = runInstaller(fixture.repoDir, ['--uninstall']);
    assert.strictEqual(removed.status, 0, `uninstall should exit 0: ${removed.stderr}`);
    assert.match(removed.stdout, /removed hook/i);
    assert.strictEqual(fs.existsSync(hookPath), false, 'uninstall must remove SGSD-marked hook');

    const removedAgain = runInstaller(fixture.repoDir, ['--uninstall']);
    assert.strictEqual(removedAgain.status, 0, `second uninstall should exit 0: ${removedAgain.stderr}`);
    assert.match(removedAgain.stderr, /hook_absent/);
    assert.match(removedAgain.stderr, new RegExp(escapeRegExp(hookPath)));
  } finally {
    fixture.cleanup();
  }

  assertInstallerHonorsCoreHooksPath();
}

function assertInstallerRefusesUnmarked() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-installer-unmarked', phase: '147', milestone: 'v3.5' });
  try {
    copyCommitGateRuntime(fixture);
    const hookPath = gitResolvedHookPath(fixture.repoDir);
    const original = '#!/bin/sh\necho preexisting hook\n';
    fs.writeFileSync(hookPath, original, 'utf8');

    const install = runInstaller(fixture.repoDir, ['--install']);
    assert.notStrictEqual(install.status, 0, 'install must refuse an unmarked existing hook');
    assert.match(install.stderr, /existing_hook_unmarked/);
    assert.strictEqual(fs.readFileSync(hookPath, 'utf8'), original, 'unmarked hook must be untouched by install');

    const uninstall = runInstaller(fixture.repoDir, ['--uninstall']);
    assert.notStrictEqual(uninstall.status, 0, 'uninstall must refuse an unmarked existing hook');
    assert.match(uninstall.stderr, /existing_hook_unmarked/);
    assert.strictEqual(fs.readFileSync(hookPath, 'utf8'), original, 'unmarked hook must be untouched by uninstall');
  } finally {
    fixture.cleanup();
  }
}

function commitWithMessage(repoDir, message, options = {}) {
  return run('git', ['commit', '-m', message], { cwd: repoDir, env: options.env || {} });
}

function pathEnvWithPrefix(dir) {
  const env = {};
  const pathName = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') || 'PATH';
  env[pathName] = `${dir}${path.delimiter}${process.env[pathName] || ''}`;
  env.PATH = env[pathName];
  return env;
}

function makeExecutable(filePath) {
  try {
    fs.chmodSync(filePath, 0o755);
  } catch {
    // Windows mode bits are advisory for Git Bash; the shebang is what matters.
  }
}

function assertInstallerTrampolineRealCommit() {
  const warnFixture = createTempGitRepo({ repoId: 'GSDedits-trampoline-warn', phase: '147', milestone: 'v3.5' });
  try {
    copyCommitGateRuntime(warnFixture);
    const install = runInstaller(warnFixture.repoDir, ['--install']);
    assert.strictEqual(install.status, 0, `install should exit 0: ${install.stderr}`);

    const sourcePath = 'super-gsd/scripts/lib/unbacked-real-commit.cjs';
    writeContainedFile(warnFixture.repoDir, sourcePath, 'module.exports = "warn";\n');
    stagePaths(warnFixture.repoDir, [sourcePath]);
    const committed = commitWithMessage(warnFixture.repoDir, 'warn mode fixture');
    assert.strictEqual(committed.status, 0, `warn-mode git commit must succeed: ${committed.stderr}`);
    assert.match(committed.stderr, /commit gate warning/i);
    const rows = readJsonl(warnFixture.repoDir, path.join('.planning', 'metrics', 'commit-gate-shadow.jsonl'));
    assert(rows.some((row) => row.status === 'warn' && row.staged_paths.includes(sourcePath)), 'warn commit must append shadow row');

    const missingScriptPath = contained(warnFixture.repoDir, path.join('super-gsd', 'hooks', 'sgsd-commit-gate.cjs'));
    fs.unlinkSync(missingScriptPath);
    const missingSource = 'super-gsd/scripts/lib/bootstrap-missing-script.cjs';
    writeContainedFile(warnFixture.repoDir, missingSource, 'module.exports = "missing-script";\n');
    stagePaths(warnFixture.repoDir, [missingSource]);
    const missingScriptCommit = commitWithMessage(warnFixture.repoDir, 'missing script fixture');
    assert.strictEqual(missingScriptCommit.status, 0, `missing hook script must fail open: ${missingScriptCommit.stderr}`);
    assert.match(missingScriptCommit.stderr, /bootstrap_hook_script_missing/);
    const withBootstrapRows = readJsonl(warnFixture.repoDir, path.join('.planning', 'metrics', 'commit-gate-shadow.jsonl'));
    assert(withBootstrapRows.some((row) => Array.isArray(row.reason_codes) && row.reason_codes.includes('bootstrap_hook_script_missing')), 'script-missing bootstrap failure should append degraded row when node is available');
  } finally {
    warnFixture.cleanup();
  }

  const nodeFixture = createTempGitRepo({ repoId: 'GSDedits-trampoline-node-stub', phase: '147', milestone: 'v3.5' });
  try {
    copyCommitGateRuntime(nodeFixture);
    const install = runInstaller(nodeFixture.repoDir, ['--install']);
    assert.strictEqual(install.status, 0, `install should exit 0: ${install.stderr}`);
    const stubDir = contained(nodeFixture.tempRoot, 'stub-bin');
    fs.mkdirSync(stubDir, { recursive: true });
    const stubNode = path.join(stubDir, process.platform === 'win32' ? 'node' : 'node');
    fs.writeFileSync(stubNode, '#!/bin/sh\necho stub node invoked >&2\nexit 127\n', 'utf8');
    makeExecutable(stubNode);

    const sourcePath = 'super-gsd/scripts/lib/node-stub-real-commit.cjs';
    writeContainedFile(nodeFixture.repoDir, sourcePath, 'module.exports = "node-stub";\n');
    stagePaths(nodeFixture.repoDir, [sourcePath]);
    const committed = commitWithMessage(nodeFixture.repoDir, 'node stub fixture', { env: pathEnvWithPrefix(stubDir) });
    assert.strictEqual(committed.status, 0, `node bootstrap failure must fail open: ${committed.stderr}`);
    assert.match(committed.stderr, /bootstrap_hook_exit_nonzero|bootstrap_node_missing/);
  } finally {
    nodeFixture.cleanup();
  }

  const blockFixture = createTempGitRepo({ repoId: 'GSDedits-trampoline-block', phase: '147', milestone: 'v3.5' });
  try {
    copyCommitGateRuntime(blockFixture);
    const install = runInstaller(blockFixture.repoDir, ['--install']);
    assert.strictEqual(install.status, 0, `install should exit 0: ${install.stderr}`);
    writeContainedFile(blockFixture.repoDir, path.join('.planning', 'config', 'commit-gate-mode.json'), `${JSON.stringify({ mode: 'block' }, null, 2)}\n`);
    const sourcePath = 'super-gsd/scripts/lib/blocked-real-commit.cjs';
    writeContainedFile(blockFixture.repoDir, sourcePath, 'module.exports = "block";\n');
    stagePaths(blockFixture.repoDir, [sourcePath]);
    const blocked = commitWithMessage(blockFixture.repoDir, 'block mode fixture');
    assert.notStrictEqual(blocked.status, 0, 'block-mode git commit must fail through exit-10 mapping');
    assert.match(blocked.stderr, /commit gate blocked/i);
    const staged = git(blockFixture.repoDir, ['diff', '--cached', '--name-only', '--']).stdout.trim().split(/\r?\n/).filter(Boolean);
    assert(staged.includes(sourcePath), 'blocked commit must leave source path staged');
  } finally {
    blockFixture.cleanup();
  }
}

function assertInstallerLinkedWorktreeWarning() {
  const fixture = createTempGitRepo({ repoId: 'GSDedits-linked-base', phase: '147', milestone: 'v3.5' });
  try {
    git(fixture.repoDir, ['add', '.planning/STATE.md']);
    git(fixture.repoDir, ['commit', '-m', 'base fixture']);
    const linkedDir = contained(fixture.tempRoot, 'linked-worktree');
    git(fixture.repoDir, ['worktree', 'add', '-b', 'sgsd-linked-fixture', linkedDir]);
    const linkedFixture = Object.assign({}, fixture, { repoDir: linkedDir });
    copyCommitGateRuntime(linkedFixture);

    const result = runInstaller(linkedDir, ['--install']);
    assert.strictEqual(result.status, 0, `linked worktree install should exit 0: ${result.stderr}`);
    assert.match(result.stderr, /linked_worktree_shared_hook_path/);
    assert.match(result.stderr, /shared/i);
    assert.strictEqual(fs.existsSync(gitResolvedHookPath(linkedDir)), true, 'linked worktree hook must be installed at git-resolved path');
  } finally {
    fixture.cleanup();
  }
}
const scenarios = Object.freeze({
  'artifact-conventions-source-predicate': assertAllArtifactConventionCases,
  'gsdedits-backed': assertGsdeditsBacked,
  'false-plan-audit-missing': assertFalsePlanAuditMissing,
  'source-predicate': assertSourcePredicate,
  'convention-unknown': assertConventionUnknown,
  'per-path-granularity': assertPerPathGranularity,
  'shadow-ledger-contained-writer': assertShadowLedgerContainedWriter,
  'hook-warn-unbacked': assertHookWarnUnbacked,
  'hook-docs-only': assertHookDocsOnlyNotSourceRow,
  'hook-sentinel-skip': assertHookSentinelSkip,
  'hook-fail-open-degraded': assertHookFailOpenDegraded,
  'hook-non-sgsd-no-write': assertHookNonSgsdNoWrite,
  'hook-warn-sentinel-failopen': assertHookWarnSentinelFailOpen,
  'shadow-report-activation': assertShadowReportActivation,
  'ac-shadow-report-activation': assertShadowReportActivation,
  'installer-lifecycle': assertInstallerLifecycle,
  'installer-refuses-unmarked': assertInstallerRefusesUnmarked,
  'installer-trampoline-real-commit': assertInstallerTrampolineRealCommit,
  'installer-linked-worktree-warning': assertInstallerLinkedWorktreeWarning
});

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const scenario = scenarios[args.scenario];
  if (!scenario) {
    console.error(usage());
    return 2;
  }
  scenario();
  console.log(`[PASS] ${args.scenario}`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(`[FAIL] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  cleanupFixture,
  contained,
  createTempGitRepo,
  git,
  readJsonl,
  runActualHook,
  runNodeScript,
  stagePaths,
  stagedNameStatus,
  tempFixtureRoot,
  writeContainedFile
};
