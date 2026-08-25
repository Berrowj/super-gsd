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
    write(path.join(projectDir, '.planning', 'config.json'), '{\n}\n');
    write(path.join(projectDir, 'operator.txt'), 'project sentinel\n');
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
    assert.deepEqual(inventory(projectDir), projectBefore, 'refusal changed project bytes');
    assert.deepEqual(inventory(home), homeBefore, 'refusal changed profile bytes');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const CASES = Object.freeze({
  'generated-transitive-manifest': generatedTransitiveManifest,
  'empty-module-tree-real-install': emptyModuleTreeRealInstall,
  'unresolved-module-refuses-before-write': unresolvedModuleRefusesBeforeWrite,
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
