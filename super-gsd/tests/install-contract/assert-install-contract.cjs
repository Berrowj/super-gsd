#!/usr/bin/env node
'use strict';

const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Module = require('module');

const SUPER_GSD_ROOT = path.resolve(__dirname, '..', '..');
const CONTRACT_PATH = path.join(SUPER_GSD_ROOT, 'scripts', 'lib', 'hook-install-contract.cjs');
const MANIFEST_PATH = path.join(SUPER_GSD_ROOT, 'config', 'hook-manifest.json');
const INSTALL_PATH = path.join(SUPER_GSD_ROOT, 'install.sh');
const { isCleanPolicyDecision } = require(path.join(
  SUPER_GSD_ROOT, 'scripts', 'lib', 'hook-registration-preflight.cjs',
));

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function write(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value);
}

function inventory(root) {
  if (!fs.existsSync(root)) return [];
  const rows = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) rows.push([
        path.relative(root, absolute).replace(/\\/g, '/'),
        sha256(fs.readFileSync(absolute)),
      ]);
    }
  }
  visit(root);
  return rows.sort((left, right) => left[0].localeCompare(right[0]));
}

function fixtureRoot(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-install-contract-${label}-`));
}

function copyTree(source, target) {
  fs.cpSync(source, target, { recursive: true });
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8',
    shell: false,
    timeout: options.timeout || 180_000,
    input: options.input,
  });
}

function resolveExecutable(command) {
  if (path.isAbsolute(command)) return command;
  const extensions = process.platform === 'win32'
    ? ['', ...(process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';')]
    : [''];
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    if (!directory) continue;
    for (const extension of extensions) {
      const candidate = path.join(directory, command + extension);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
  }
  throw new Error(`executable not found on PATH: ${command}`);
}

function assertSpawn(result, context) {
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${context}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
}

function syntheticManifest(sourcePath) {
  return {
    version: 1,
    entries: [{
      source_path: sourcePath,
      interpreter: 'node',
      distribution_targets: ['claude-project'],
      dispositions: [{
        kind: 'intentionally_unregistered',
        surface: 'fixture',
        smoke_event: 'PostToolUse',
        smoke_timeout_seconds: 5,
        reason: 'Generated fixture entry.',
      }],
    }],
  };
}

function generatedResolutionFixture(root) {
  const sgsdRoot = path.join(root, 'upstream seed', 'super-gsd');
  const generated = [];
  const add = (relative, source) => {
    write(path.join(sgsdRoot, relative), source);
    generated.push(relative.replace(/\\/g, '/'));
  };
  add('scripts/lib/extensionless.js', `module.exports = require('./transitive.js');\n`);
  add('scripts/lib/transitive.js', 'module.exports = true;\n');
  add('scripts/lib/explicit.js', 'module.exports = true;\n');
  add('scripts/lib/data.json', JSON.stringify({ ok: true }) + '\n');
  add('scripts/lib/package-directory/package.json', JSON.stringify({ main: 'main.cjs' }) + '\n');
  add('scripts/lib/package-directory/main.cjs', 'module.exports = true;\n');
  add('scripts/lib/index-directory/index.js', 'module.exports = true;\n');
  add('scripts/lib/cycle-a.cjs', `module.exports = require('./cycle-b.cjs');\n`);
  add('scripts/lib/cycle-b.cjs', `module.exports = require('./cycle-a.cjs');\n`);
  const expressions = [
    'extensionless', 'explicit.js', 'data.json', 'package-directory',
    'index-directory', 'cycle-a.cjs',
  ].map((name) => `require('../scripts/lib/${name}');`).join('\n');
  add('hooks/generated-entry.cjs', expressions + `\nrequire('node:fs');\nrequire('fixture-package');\n`);
  return {
    sgsdRoot,
    manifest: syntheticManifest('hooks/generated-entry.cjs'),
    generated: generated.filter((relative) => relative !== 'hooks/generated-entry.cjs').sort(),
  };
}

function loaderTrace(entryPath, sourceRoot) {
  const originalLoad = Module._load;
  const observed = new Set();
  Module._load = function tracedLoad(request, parent, isMain) {
    if (request === 'fixture-package') return {};
    let resolved = null;
    try { resolved = Module._resolveFilename(request, parent, isMain); } catch (_) { /* Preserve loader result. */ }
    if (typeof resolved === 'string' && resolved.startsWith(sourceRoot + path.sep)) {
      observed.add(path.relative(sourceRoot, resolved).replace(/\\/g, '/'));
    }
    return originalLoad.apply(this, arguments);
  };
  try {
    require(entryPath);
  } finally {
    Module._load = originalLoad;
    for (const cachePath of Object.keys(require.cache)) {
      if (cachePath.startsWith(sourceRoot + path.sep)) delete require.cache[cachePath];
    }
  }
  observed.delete(path.relative(sourceRoot, entryPath).replace(/\\/g, '/'));
  return [...observed].sort();
}

function realEntryLoaderTrace(entry, sourceRoot) {
  const entryPath = path.join(sourceRoot, entry.source_path);
  const originalLoad = Module._load;
  const observed = new Set();
  Module._load = function tracedLoad(request, parent, isMain) {
    let resolved = null;
    try { resolved = Module._resolveFilename(request, parent, isMain); } catch (_) { /* Preserve loader result. */ }
    if (typeof resolved === 'string' && resolved.startsWith(sourceRoot + path.sep)) {
      observed.add(path.relative(sourceRoot, resolved).replace(/\\/g, '/'));
    }
    return originalLoad.apply(this, arguments);
  };
  try {
    const loaded = require(entryPath);
    const mcpDisposition = (entry.dispositions || []).find(
      (row) => typeof row.matcher === 'string' && row.matcher.startsWith('mcp__'),
    );
    if (loaded && typeof loaded.processHookPayload === 'function' && mcpDisposition) {
      loaded.processHookPayload({
        hook_event_name: mcpDisposition.event,
        cwd: path.dirname(sourceRoot),
        session_id: 'sgsd-loader-trace',
        tool_use_id: 'sgsd-loader-trace-tool',
        tool_name: mcpDisposition.matcher,
        tool_input: {},
      }, { expectedEvent: mcpDisposition.event, env: {} });
    }
  } finally {
    Module._load = originalLoad;
    for (const cachePath of Object.keys(require.cache)) {
      if (cachePath.startsWith(sourceRoot + path.sep)) delete require.cache[cachePath];
    }
  }
  observed.delete(entry.source_path);
  return [...observed].sort();
}

async function generatedTransitiveManifest() {
  const contract = require(CONTRACT_PATH);
  const root = fixtureRoot('generated');
  try {
    const fixture = generatedResolutionFixture(root);
    const graph = contract.computeHookDependencyGraph({
      sgsdRoot: fixture.sgsdRoot,
      manifest: fixture.manifest,
      projectDir: path.join(root, 'target project'),
    });
    assert.deepEqual(graph.entries[0].dependencies, fixture.generated);
    for (const observed of loaderTrace(
      path.join(fixture.sgsdRoot, 'hooks', 'generated-entry.cjs'), fixture.sgsdRoot,
    )) {
      assert.equal(graph.entries[0].dependencies.includes(observed), true,
        `runtime loader edge omitted from generated closure: ${observed}`);
    }
    assert.deepEqual(graph.packages.map((row) => row.package), ['fixture-package']);
    assert.deepEqual(
      contract.renderManifestDependencies(fixture.manifest, graph).entries[0].dependencies,
      fixture.generated,
    );
    const report = contract.inspectProjectInstall({
      sgsdRoot: fixture.sgsdRoot,
      manifest: fixture.manifest,
      projectDir: path.join(root, 'target project'),
      checkManifest: false,
    });
    assert.equal(report.requiredFiles.every((row) => row.status === 'missing'), true);
    for (const row of report.requiredFiles) {
      assert.deepEqual(row.required_by, ['hooks/generated-entry.cjs']);
    }
    const applied = await contract.applyProjectInstall(report, { smoke: false });
    assert.equal(applied.ok, true);
    const current = contract.inspectProjectInstall({
      sgsdRoot: fixture.sgsdRoot,
      manifest: fixture.manifest,
      projectDir: path.join(root, 'target project'),
      checkManifest: false,
    });
    assert.equal(current.requiredFiles.every((row) => row.status === 'current'), true);
    assert.deepEqual((await contract.applyProjectInstall(current, { smoke: false })).actions, []);

    const fixtureSource = path.join(fixture.sgsdRoot, 'hooks', 'generated-entry.cjs');
    const originalSource = fs.readFileSync(fixtureSource);
    fs.appendFileSync(fixtureSource, '\nrequire(path.join(__dirname, unresolvedName));\n');
    assert.throws(() => contract.computeHookDependencyGraph({
      sgsdRoot: fixture.sgsdRoot,
      manifest: fixture.manifest,
    }), /generated-entry\.cjs.*unresolvedName|unresolvedName.*generated-entry\.cjs/);
    fs.writeFileSync(fixtureSource, `require('../../outside-root.cjs');\n`);
    assert.throws(() => contract.computeHookDependencyGraph({
      sgsdRoot: fixture.sgsdRoot,
      manifest: fixture.manifest,
    }), /escape/i);
    fs.writeFileSync(fixtureSource, `require('../scripts/lib/generated-missing.cjs');\n`);
    let missingError;
    try {
      contract.computeHookDependencyGraph({
        sgsdRoot: fixture.sgsdRoot,
        manifest: fixture.manifest,
        projectDir: path.join(root, 'target project'),
      });
    } catch (error) {
      missingError = error;
    }
    assert.equal(missingError.code, 'MODULE_NOT_FOUND');
    assert.equal(missingError.request, '../scripts/lib/generated-missing.cjs');
    assert.equal(
      missingError.resolved_path,
      path.join(root, 'target project', 'super-gsd', 'scripts', 'lib', 'generated-missing.cjs'),
    );
    assert.equal(Buffer.byteLength(missingError.message, 'utf8') <= 2048, true);
    fs.writeFileSync(fixtureSource, originalSource);

    const committed = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const realGraph = contract.computeHookDependencyGraph({ sgsdRoot: SUPER_GSD_ROOT, manifest: committed });
    const traceEntries = committed.entries.filter((entry) => entry.interpreter === 'node'
      && fs.readFileSync(path.join(SUPER_GSD_ROOT, entry.source_path), 'utf8')
        .includes('if (require.main === module)'));
    for (const manifestEntry of traceEntries) {
      const graphEntry = realGraph.entries.find((entry) => entry.source_path === manifestEntry.source_path);
      assert.ok(graphEntry, `real graph entry missing: ${manifestEntry.source_path}`);
      for (const observed of realEntryLoaderTrace(manifestEntry, SUPER_GSD_ROOT)
        .filter((relative) => !relative.includes('/node_modules/'))) {
        assert.equal(graphEntry.dependencies.includes(observed), true,
          `runtime loader edge lacks per-entry ownership: ${manifestEntry.source_path} -> ${observed}`);
      }
    }
    assert.deepEqual(contract.renderManifestDependencies(committed, realGraph), committed);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function isolatedEnv(home) {
  const env = { ...process.env };
  const values = {
    HOME: home,
    USERPROFILE: home,
    APPDATA: path.join(home, 'AppData', 'Roaming'),
    LOCALAPPDATA: path.join(home, 'AppData', 'Local'),
    XDG_CONFIG_HOME: path.join(home, '.config'),
    XDG_DATA_HOME: path.join(home, '.local', 'share'),
    XDG_STATE_HOME: path.join(home, '.local', 'state'),
    XDG_CACHE_HOME: path.join(home, '.cache'),
  };
  for (const directory of Object.values(values)) fs.mkdirSync(directory, { recursive: true });
  Object.assign(env, values);
  delete env.NODE_PATH;
  delete env.NODE_OPTIONS;
  return env;
}

function finalHookExecutions(projectDir, env) {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const seen = new Set();
  for (const entry of manifest.entries) {
    if (!entry.distribution_targets.some((target) => target.endsWith('-project'))) continue;
    for (const disposition of entry.dispositions || []) {
      const event = disposition.kind === 'registered' ? disposition.event : disposition.smoke_event;
      if (!event) continue;
      const command = typeof disposition.command === 'string'
        ? disposition.command.trim().split(/\s+/)
        : [];
      const argv = command.length >= 2 ? command.slice(2) : [];
      const identity = JSON.stringify([entry.source_path, event, argv]);
      if (seen.has(identity)) continue;
      seen.add(identity);
      const matcher = disposition.matcher && disposition.matcher !== '*'
        ? disposition.matcher.split('|')[0]
        : 'Read';
      const mcp = matcher.startsWith('mcp__');
      const payload = {
        hook_event_name: event,
        cwd: projectDir,
        session_id: 'sgsd-final-install-smoke',
        prompt: 'final installed hook smoke',
        tool_name: matcher,
        tool_input: mcp
          ? { schema_version: 'vtp-mcp-input-schemas.v2', query: 'final installed hook smoke' }
          : { file_path: 'sgsd-hook-smoke.txt' },
        tool_response: mcp
          ? { content: [{ type: 'text', text: JSON.stringify({ hits: [] }) }] }
          : { ok: true },
      };
      if (mcp) payload.tool_use_id = 'sgsd-final-install-smoke-tool';
      const scriptPath = path.join(projectDir, 'super-gsd', entry.source_path);
      const executable = entry.interpreter === 'node'
        ? process.execPath
        : process.env.SGSD_TEST_BASH || 'bash';
      const result = run(executable, [scriptPath, ...argv], {
        cwd: projectDir,
        env,
        input: JSON.stringify(payload) + '\n',
      });
      if (!result.error && !result.signal && result.status !== null && result.status !== 0
        && isCleanPolicyDecision(`${result.stdout}\n${result.stderr}`)) {
        continue;
      }
      assertSpawn(result, `final installed hook failed: ${entry.source_path} ${event}`);
    }
  }
  return seen.size;
}

async function emptyModuleTreeRealInstall() {
  const contract = require(CONTRACT_PATH);
  const root = fixtureRoot('real-install');
  try {
    const projectDir = path.join(root, 'target project');
    const decoy = path.join(root, 'decoy cwd');
    const home = path.join(root, 'isolated home');
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(decoy, { recursive: true });
    const env = isolatedEnv(home);
    const result = run(process.env.SGSD_TEST_BASH || 'bash', [
      INSTALL_PATH, '--init-project', '--skip-cockpit-deps', '--project-dir', projectDir,
    ], { cwd: decoy, env });
    assertSpawn(result, 'real empty-tree installation failed');
    const report = contract.inspectProjectInstall({ projectDir, sgsdRoot: SUPER_GSD_ROOT });
    assert.equal(report.requiredFiles.every((row) => row.status === 'current'), true);
    assert.equal(report.requiredFiles.filter(
      (row) => row.relative_path.startsWith('hooks/'),
    ).length, 17, 'real install did not deliver all 17 hook files');
    assert.equal(report.requiredFiles.filter(
      (row) => row.relative_path.startsWith('scripts/lib/'),
    ).length, 9, 'real install did not deliver all 9 scripts/lib modules');
    assert.deepEqual(inventory(decoy), [], 'explicit project install touched decoy cwd');
    assert.ok(finalHookExecutions(projectDir, env) > 0, 'no final installed hook was executed');

    const dependency = report.graph.entries.flatMap((entry) => entry.dependencies)[0];
    assert.ok(dependency, 'real graph has no transitive dependency fixture');
    const stalePath = path.join(projectDir, 'super-gsd', dependency);
    fs.appendFileSync(stalePath, '\nstale dependency fixture\n');
    const updated = run(process.env.SGSD_TEST_BASH || 'bash', [
      INSTALL_PATH, '--update', '--skip-cockpit-deps', '--project-dir', projectDir,
    ], { cwd: decoy, env });
    assertSpawn(updated, 'real stale dependency update failed');
    const refreshed = contract.inspectProjectInstall({ projectDir, sgsdRoot: SUPER_GSD_ROOT });
    assert.equal(refreshed.requiredFiles.every((row) => row.status === 'current'), true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function unresolvedModuleRefusesBeforeWrite() {
  const root = fixtureRoot('refusal');
  try {
    const upstream = path.join(root, 'upstream seed', 'super-gsd');
    copyTree(SUPER_GSD_ROOT, upstream);
    const manifest = JSON.parse(fs.readFileSync(path.join(upstream, 'config', 'hook-manifest.json')));
    const entry = manifest.entries.find((row) => row.interpreter === 'node'
      && row.distribution_targets.some((target) => target.endsWith('-project')));
    assert.ok(entry, 'no generated project fixture root');
    fs.appendFileSync(path.join(upstream, entry.source_path),
      `\nrequire('../scripts/lib/generated-missing-refusal.cjs');\n`);
    const projectDir = path.join(root, 'target project');
    const home = path.join(root, 'isolated home');
    const decoy = path.join(root, 'decoy cwd');
    const npmSentinel = path.join(projectDir, 'npm-preinstall-ran');
    write(path.join(projectDir, '.planning', 'config.json'), '{\n}\n');
    write(path.join(projectDir, 'operator.txt'), 'project sentinel\n');
    write(path.join(projectDir, 'package.json'), JSON.stringify({
      name: 'sgsd-refusal-fixture',
      version: '1.0.0',
      private: true,
      scripts: {
        preinstall: 'node -e ' + JSON.stringify(
          `require('fs').writeFileSync('npm-preinstall-ran', 'ran')`,
        ),
      },
    }, null, 2) + '\n');
    write(path.join(home, '.claude', 'settings.json'), '{\n}\n');
    fs.mkdirSync(decoy, { recursive: true });
    const projectBefore = inventory(projectDir);
    const homeBefore = inventory(home);
    const result = run(process.env.SGSD_TEST_BASH || 'bash', [
      path.join(upstream, 'install.sh'), '--install-global', '--update',
      '--skip-cockpit-deps', '--project-dir', projectDir,
    ], { cwd: decoy, env: isolatedEnv(home) });
    if (result.error) throw result.error;
    assert.notEqual(result.status, 0, 'missing dependency did not refuse');
    const output = `${result.stderr}\n${result.stdout}`;
    assert.match(output, /hook_smoke_failed/);
    assert.match(output, /MODULE_NOT_FOUND/);
    assert.match(output, /generated-missing-refusal\.cjs/);
    assert.equal(fs.existsSync(npmSentinel), false, 'refused install ran npm preinstall');
    const refusalRecord = output.split(/\r?\n/).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch (_) { return []; }
    }).find((row) => row && row.reason === 'hook_smoke_failed');
    assert.ok(refusalRecord, 'refusal output omitted its structured result');
    assert.deepEqual(refusalRecord.actions, [], 'refused install recorded repair actions');
    assert.deepEqual(inventory(projectDir), projectBefore, 'refusal changed project bytes');
    assert.deepEqual(inventory(home), homeBefore, 'refusal changed profile bytes');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function seedProjectInstall(report) {
  for (const row of report.requiredFiles) {
    write(row.target_path, fs.readFileSync(row.source_path));
  }
}

function gitRun(args, cwd) {
  const result = run('git', args, { cwd });
  assertSpawn(result, 'git ' + args.join(' ') + ' failed');
  return result.stdout.trim();
}

async function doctorRealGitWorktreeStaleness() {
  const contract = require(CONTRACT_PATH);
  const root = fixtureRoot('doctor worktree');
  try {
    const fakeRevision = 'a'.repeat(40);
    const formatted = contract.formatProjectInstallStatus(Object.freeze({
      ok: false,
      project_dir: path.join(root, 'formatter project'),
      canonical_source_revision: fakeRevision,
      requiredFiles: [
        { kind: 'hook', relative_path: 'hooks\\missing.cjs', status: 'missing',
          expected_sha256: '1'.repeat(64), actual_sha256: null },
        { kind: 'hook', relative_path: 'hooks/stale.cjs', status: 'stale',
          expected_sha256: '2'.repeat(64), actual_sha256: '3'.repeat(64) },
        { kind: 'module', relative_path: 'scripts\\lib\\missing.cjs', status: 'missing',
          expected_sha256: '4'.repeat(64), actual_sha256: null },
        { kind: 'module', relative_path: 'scripts/lib/stale.cjs', status: 'stale',
          expected_sha256: '5'.repeat(64), actual_sha256: '6'.repeat(64) },
        { kind: 'hook', relative_path: 'hooks/current.cjs', status: 'current',
          expected_sha256: '7'.repeat(64), actual_sha256: '7'.repeat(64) },
        { kind: 'module', relative_path: 'scripts/lib/current.cjs', status: 'current',
          expected_sha256: '8'.repeat(64), actual_sha256: '8'.repeat(64) },
      ],
    }));
    assert.match(formatted, /Project install status: drift/);
    assert.equal(formatted.includes('Canonical source revision: ' + fakeRevision), true);
    assert.equal(formatted.includes(
      'hook path=hooks/missing.cjs expected_sha256=' + '1'.repeat(64)
      + ' actual_sha256=<missing>',
    ), true);
    assert.equal(formatted.includes(
      'hook path=hooks/stale.cjs expected_sha256=' + '2'.repeat(64)
      + ' actual_sha256=' + '3'.repeat(64),
    ), true);
    assert.equal(formatted.includes(
      'module path=scripts/lib/missing.cjs expected_sha256=' + '4'.repeat(64)
      + ' actual_sha256=<missing>',
    ), true);
    assert.equal(formatted.includes(
      'module path=scripts/lib/stale.cjs expected_sha256=' + '5'.repeat(64)
      + ' actual_sha256=' + '6'.repeat(64),
    ), true);
    assert.match(formatted, /Current rows: hooks=1 modules=1 total=2\/6/);
    assert.doesNotMatch(formatted, /hooks\/current\.cjs|scripts\/lib\/current\.cjs/);

    const repository = path.join(root, 'primary repository');
    const worktree = path.join(root, 'linked worktree project');
    const decoy = path.join(root, 'decoy cwd');
    const home = path.join(root, 'isolated home');
    fs.mkdirSync(repository, { recursive: true });
    fs.mkdirSync(decoy, { recursive: true });
    gitRun(['init', '--initial-branch=main'], repository);
    gitRun(['config', 'user.email', 'doctor-fixture@example.invalid'], repository);
    gitRun(['config', 'user.name', 'Doctor Fixture'], repository);
    write(path.join(repository, '.planning', 'config.json'), '{}\n');
    gitRun(['add', '.planning/config.json'], repository);
    gitRun(['commit', '-m', 'seed doctor fixture'], repository);
    gitRun(['worktree', 'add', '-b', 'doctor-linked-fixture', worktree], repository);
    assert.equal(fs.statSync(path.join(repository, '.git')).isDirectory(), true,
      'primary repository does not have .git directory shape');
    assert.equal(fs.statSync(path.join(worktree, '.git')).isFile(), true,
      'linked worktree does not have .git file shape');

    const normalReport = contract.inspectProjectInstall({
      projectDir: repository,
      sgsdRoot: SUPER_GSD_ROOT,
    });
    seedProjectInstall(normalReport);
    const seededWorktree = contract.inspectProjectInstall({
      projectDir: worktree,
      sgsdRoot: SUPER_GSD_ROOT,
    });
    seedProjectInstall(seededWorktree);
    const missingHook = seededWorktree.requiredFiles.find(
      (row) => row.kind === 'hook' && row.relative_path.startsWith('hooks/'),
    );
    const modules = seededWorktree.requiredFiles.filter(
      (row) => row.kind === 'module' && row.relative_path.startsWith('scripts/lib/'),
    );
    assert.ok(missingHook, 'fixture has no project hook row');
    assert.ok(modules.length >= 2, 'fixture has fewer than two transitive module rows');
    const [staleModule, currentModule] = modules;
    fs.rmSync(missingHook.target_path);
    fs.appendFileSync(staleModule.target_path, '\nstale doctor fixture\n');

    const expected = contract.inspectProjectInstall({
      projectDir: worktree,
      sgsdRoot: SUPER_GSD_ROOT,
    });
    assert.equal(expected.missing.length, 1);
    assert.equal(expected.stale.length, 1);
    assert.equal(expected.missing[0].relative_path, missingHook.relative_path);
    assert.equal(expected.stale[0].relative_path, staleModule.relative_path);
    assert.equal(expected.current.some(
      (row) => row.relative_path === currentModule.relative_path,
    ), true);

    const env = isolatedEnv(home);
    const bash = process.env.SGSD_TEST_BASH || 'bash';
    const bashExecutable = resolveExecutable(bash);
    const noNodeBin = path.join(root, 'PATH without Node');
    const dirnameShim = path.join(noNodeBin, 'dirname');
    write(dirnameShim, `#!/bin/bash
value="\${1//\\\\//}"
case "$value" in
  */*) value="\${value%/*}"; [ -n "$value" ] || value=/ ;;
  *) value=. ;;
esac
printf '%s\\n' "$value"
`);
    fs.chmodSync(dirnameShim, 0o755);
    const noNodeEnv = { ...env, PATH: noNodeBin };
    const nodeProbe = run(bashExecutable, ['-c', 'command -v node'], { env: noNodeEnv });
    assert.equal(nodeProbe.status, 1, 'Node remained available in the status-2 fixture');
    const unableBefore = inventory(root);
    const unableDoctor = run(bashExecutable, [
      INSTALL_PATH, '--project-dir', worktree, '--doctor',
    ], { cwd: decoy, env: noNodeEnv });
    if (unableDoctor.error) throw unableDoctor.error;
    assert.equal(unableDoctor.status, 2,
      'Node-unavailable doctor exit mismatch\nstdout:\n' + unableDoctor.stdout
      + '\nstderr:\n' + unableDoctor.stderr);
    assert.match(unableDoctor.stdout, /Node\.js: missing/);
    assert.deepEqual(inventory(root), unableBefore, 'Node-unavailable doctor changed fixture bytes');
    const sourceRevision = gitRun(['rev-parse', 'HEAD'], path.dirname(SUPER_GSD_ROOT));
    const normalHead = gitRun(['rev-parse', 'HEAD'], repository);
    const normalBefore = inventory(root);
    const normalDoctor = run(bash, [INSTALL_PATH, '--doctor', '--project-dir', repository], {
      cwd: decoy,
      env,
    });
    if (normalDoctor.error) throw normalDoctor.error;
    assert.equal(normalDoctor.status, 0,
      'normal-repository doctor failed\nstdout:\n' + normalDoctor.stdout
      + '\nstderr:\n' + normalDoctor.stderr);
    assert.match(normalDoctor.stdout, /Project install status: current/);
    assert.equal(normalDoctor.stdout.includes('Project git HEAD: ' + normalHead), true);
    assert.match(normalDoctor.stdout, /SGSD GitHub master: (?:[0-9a-f]{40}|unavailable)/);
    assert.match(normalDoctor.stdout, /Freshness: /);
    assert.deepEqual(inventory(root), normalBefore, 'normal-repository doctor changed fixture bytes');

    const before = inventory(root);
    const firstDoctor = run(bash, [INSTALL_PATH, '--doctor', '--project-dir', worktree], {
      cwd: decoy,
      env,
    });
    if (firstDoctor.error) throw firstDoctor.error;
    assert.equal(firstDoctor.status, 10,
      'drifted worktree doctor exit mismatch\nstdout:\n' + firstDoctor.stdout
      + '\nstderr:\n' + firstDoctor.stderr);
    const linkedHead = gitRun(['rev-parse', 'HEAD'], worktree);
    assert.equal(firstDoctor.stdout.includes('Project git HEAD: ' + linkedHead), true);
    assert.doesNotMatch(firstDoctor.stdout, /Project git HEAD: not a git repo/);
    assert.match(firstDoctor.stdout, /SGSD GitHub master: (?:[0-9a-f]{40}|unavailable)/);
    assert.match(firstDoctor.stdout, /Freshness: /);
    assert.equal(firstDoctor.stdout.includes('Canonical source revision: ' + sourceRevision), true);
    assert.equal(firstDoctor.stdout.includes(
      'hook path=' + missingHook.relative_path
      + ' expected_sha256=' + missingHook.expected_sha256
      + ' actual_sha256=<missing>',
    ), true);
    assert.equal(firstDoctor.stdout.includes(
      'module path=' + staleModule.relative_path
      + ' expected_sha256=' + staleModule.expected_sha256
      + ' actual_sha256=' + expected.stale[0].actual_sha256,
    ), true);
    assert.equal(firstDoctor.stdout.includes(currentModule.relative_path), false,
      'doctor named a current module as behind');
    assert.deepEqual(inventory(root), before, 'linked-worktree doctor changed fixture bytes');

    const conflictBefore = inventory(root);
    const conflictingDoctor = run(bash, [
      INSTALL_PATH, '--doctor', '--update', '--project-dir', worktree,
    ], { cwd: decoy, env });
    if (conflictingDoctor.error) throw conflictingDoctor.error;
    assert.equal(conflictingDoctor.status, 1, 'doctor/update usage conflict exit mismatch');
    assert.deepEqual(inventory(root), conflictBefore, 'doctor/update conflict changed fixture bytes');

    const primaryBeforeUpdate = inventory(repository);
    const updated = run(bash, [
      INSTALL_PATH, '--update', '--skip-cockpit-deps', '--project-dir', worktree,
    ], { cwd: decoy, env });
    assertSpawn(updated, 'production worktree update failed');
    const repaired = contract.inspectProjectInstall({
      projectDir: worktree,
      sgsdRoot: SUPER_GSD_ROOT,
    });
    assert.equal(repaired.ok, true);
    assert.equal(repaired.requiredFiles.every(
      (row) => row.expected_sha256 === row.actual_sha256,
    ), true);
    assert.deepEqual(inventory(repository), primaryBeforeUpdate,
      'explicit worktree update changed the primary checkout');
    assert.deepEqual(inventory(decoy), [], 'explicit worktree update changed the decoy cwd');

    const finalDoctor = run(bash, [INSTALL_PATH, '--doctor', '--project-dir', worktree], {
      cwd: decoy,
      env,
    });
    assertSpawn(finalDoctor, 'current worktree doctor failed');
    assert.match(finalDoctor.stdout, /Project install status: current/);
    assert.match(finalDoctor.stdout, /Missing hooks: 0/);
    assert.match(finalDoctor.stdout, /Stale hooks: 0/);
    assert.match(finalDoctor.stdout, /Missing modules: 0/);
    assert.match(finalDoctor.stdout, /Stale modules: 0/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const CASES = Object.freeze({
  'generated-transitive-manifest': generatedTransitiveManifest,
  'empty-module-tree-real-install': emptyModuleTreeRealInstall,
  'unresolved-module-refuses-before-write': unresolvedModuleRefusesBeforeWrite,
  'doctor-real-git-worktree-staleness': doctorRealGitWorktreeStaleness,
});

async function main(argv) {
  const caseIndex = argv.indexOf('--case');
  const names = caseIndex >= 0 ? [argv[caseIndex + 1]] : Object.keys(CASES);
  for (const name of names) {
    if (!CASES[name]) throw new Error(`unknown case: ${name || '<missing>'}`);
    await CASES[name]();
    process.stdout.write(`[install-contract] ${name} PASS\n`);
  }
}

main(process.argv.slice(2)).catch((error) => {
  process.stderr.write(`[install-contract] FAIL: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
