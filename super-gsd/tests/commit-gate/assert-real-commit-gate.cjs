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
const stateLibPath = path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'sgsd-state.cjs');
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

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    encoding: 'utf8',
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
  const hookPath = path.join(repoRoot, 'super-gsd', 'hooks', 'sgsd-commit-gate.cjs');
  return runNodeScript(hookPath, args, Object.assign({}, options, { cwd: repoDir }));
}

function readJsonl(root, subpath) {
  const text = fs.existsSync(contained(root, subpath)) ? readContainedFile(root, subpath) : '';
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
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

const scenarios = Object.freeze({
  'artifact-conventions-source-predicate': assertAllArtifactConventionCases,
  'gsdedits-backed': assertGsdeditsBacked,
  'false-plan-audit-missing': assertFalsePlanAuditMissing,
  'source-predicate': assertSourcePredicate,
  'convention-unknown': assertConventionUnknown,
  'per-path-granularity': assertPerPathGranularity
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
