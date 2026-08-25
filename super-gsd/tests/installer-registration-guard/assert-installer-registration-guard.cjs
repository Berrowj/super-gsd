#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');

const SUPER_GSD_ROOT = path.resolve(__dirname, '..', '..');
const REPOSITORY_ROOT = path.dirname(SUPER_GSD_ROOT);
const INSTALL_PATH = path.join(SUPER_GSD_ROOT, 'install.sh');
const UPDATE_PATH = path.join(SUPER_GSD_ROOT, 'scripts', 'sgsd-update.sh');
const PREFLIGHT_PATH = path.join(SUPER_GSD_ROOT, 'scripts', 'lib', 'hook-registration-preflight.cjs');
const BUNDLED_OVERLAY_PATH = path.join(SUPER_GSD_ROOT, 'CLAUDE-OVERLAY.md');
const GLOBAL_OVERLAY_PATH = path.join(SUPER_GSD_ROOT, 'config', 'settings-overlay.json');
const REPO_OVERLAY_PATH = path.join(SUPER_GSD_ROOT, 'config', 'repo-settings-overlay.json');
const CODEX_HOOK_CONFIG_PATH = path.join(SUPER_GSD_ROOT, 'config', 'codex-hooks.json');
const HOOK_MANIFEST_PATH = path.join(SUPER_GSD_ROOT, 'config', 'hook-manifest.json');
const HOOK_INSTALL_CONTRACT_PATH = path.join(SUPER_GSD_ROOT, 'scripts', 'lib', 'hook-install-contract.cjs');
const WITNESS_STORE_PATH = path.join(SUPER_GSD_ROOT, 'scripts', 'lib', 'substrate-invocation-witness-store.cjs');
const COMMIT_GATE_INSTALLER_PATH = path.join(SUPER_GSD_ROOT, 'scripts', 'install-commit-gate.cjs');
const UPDATE_SKILL_PATH = path.join(SUPER_GSD_ROOT, 'skills', 'sgsd-update', 'SKILL.md');
const STALE_OVERLAY_MARKERS = Object.freeze([
  Object.freeze({
    id: 'query_byterover',
    pattern: /\bQuery ByteRover\b/i,
    mutation: 'Query ByteRover before dispatching.',
  }),
  Object.freeze({
    id: 'byterover_results',
    pattern: /\bByteRover\b/i,
    mutation: 'Inject ByteRover results into the agent prompt.',
  }),
  Object.freeze({
    id: 'brv_queries',
    pattern: /(?:\bbrv[-_]queries\b|\bBRV\b(?!\/context-tree))/i,
    mutation: 'Return brv_queries with the selected files.',
  }),
  Object.freeze({
    id: 'brv_context_tree_route',
    pattern: /\.brv\/context-tree\/?/i,
    mutation: 'Route live memory through .brv/context-tree/.',
  }),
  Object.freeze({
    id: 'haiku_agent_dispatch',
    pattern: /\bHaiku\b/i,
    mutation: 'Run a Haiku classifier agent.',
    outsideProviderLock: true,
  }),
  Object.freeze({
    id: 'legacy_sonnet_role_row',
    pattern: /^\s*\|\s*[^|\r\n]+\s*\|\s*Sonnet(?:\s+unless specified)?\s*\|/im,
    mutation: '| Verifier/checker/board | Sonnet unless specified | Bounded review |',
    outsideProviderLock: true,
  }),
  Object.freeze({
    id: 'sonnet_agent_dispatch',
    pattern: /\bSonnet\b/i,
    mutation: 'Dispatch readiness through a Sonnet agent.',
    outsideProviderLock: true,
  }),
]);
const CLARITY_NINE_HOOKS = Object.freeze([
  'gsd-checkpoint-writer.js',
  'gsd-context-monitor.js',
  'gsd-session-start.js',
  'gsd-stuck-detector.js',
  'gsd-token-logger.js',
  'sgsd-activity-logger.js',
  'sgsd-heartbeat.js',
  'sgsd-session-start.js',
  'sgsd-statusline.js',
]);
const DEFAULT_INSTALLER_SPAWN_TIMEOUT_MS = 150_000;
const BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS = 3 * 90_000;
const REAL_UPDATE_SPAWN_TIMEOUT_MS = 3 * 90_000;
const FIXTURE_GIT_SPAWN_TIMEOUT_MS = 30_000;
const SHIPPED_HOOK_NAMES = Object.freeze([
  'gsd-checkpoint-writer.js',
  'gsd-context-monitor.js',
  'gsd-phase-boundary.sh',
  'gsd-session-start.js',
  'gsd-session-state.sh',
  'gsd-stuck-detector.js',
  'gsd-token-logger.js',
  'sgsd-activity-logger.js',
  'sgsd-commit-gate.cjs',
  'sgsd-heartbeat.js',
  'sgsd-intent-classifier.cjs',
  'sgsd-quality-gate.js',
  'sgsd-session-start.js',
  'sgsd-statusline.js',
  'sgsd-stop-handoff.js',
  'sgsd-substrate-invocation-witness.cjs',
  'sgsd-vtp-pending.js',
]);
const EXPECTED_CODEX_ENTRY_NAMES = Object.freeze([
  'block-forbidden-write.cjs',
  'block-secret-leak.cjs',
  'enforce-allowed-files.cjs',
  'log-tool-event.cjs',
  'validate-stop-contract.cjs',
]);
const REPO_REGISTRATIONS = Object.freeze([
  ['PreToolUse', 'pre-tool-use-substrate-invocation-witness', 'super-gsd/hooks/sgsd-substrate-invocation-witness.cjs'],
  ['SessionStart', 'session-start-governance', 'super-gsd/hooks/sgsd-session-start.js'],
  ['UserPromptSubmit', 'user-prompt-intent-classifier', 'super-gsd/hooks/sgsd-intent-classifier.cjs'],
  ['UserPromptSubmit', 'user-prompt-secret-leak-guard', 'super-gsd/tools/codex-hooks/block-secret-leak.cjs'],
  ['PostToolUse', 'post-tool-use-substrate-invocation-witness', 'super-gsd/hooks/sgsd-substrate-invocation-witness.cjs'],
  ['PostToolUse', 'post-tool-use-quality-gate', 'super-gsd/hooks/sgsd-quality-gate.js'],
]);
const CLARITY_HISTORICAL_IDS = Object.freeze([
  'session-start-governance',
  'user-prompt-intent-classifier',
  'post-tool-use-quality-gate',
]);
const GLOBAL_SCRIPT_NAMES = Object.freeze([
  'sgsd-statusline.js',
  'gsd-session-start.js',
  'gsd-session-state.sh',
  'sgsd-vtp-pending.js',
  'sgsd-session-start.js',
  'sgsd-activity-logger.js',
  'sgsd-intent-classifier.cjs',
  'sgsd-heartbeat.js',
  'gsd-token-logger.js',
  'gsd-stuck-detector.js',
  'gsd-checkpoint-writer.js',
  'gsd-context-monitor.js',
  'sgsd-quality-gate.js',
  'sgsd-stop-handoff.js',
]);
const HOOK_MANIFEST_SURFACES = Object.freeze([
  'claude-global hooks',
  'claude-global statusLine',
  'claude-project',
  'codex-project',
  'git-pre-commit',
  'auxiliary-only',
]);
const HOOK_DISTRIBUTION_TARGETS = Object.freeze([
  'claude-global',
  'claude-project',
  'codex-project',
]);

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function readBytes(filePath) {
  return fs.readFileSync(filePath);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sentinelSettings(label) {
  return {
    unrelatedProjectKey: { label, survives: true },
    hooks: {
      Notification: [{
        matcher: 'permission_prompt',
        hooks: [{ type: 'prompt', prompt: `sentinel:${label}` }],
      }],
      SessionStart: [{
        matcher: `operator-pathological:${label}`,
        hooks: [{
          type: 'command',
          command: `operator garbage command:${label}`,
          args: { deliberately: 'not-an-array' },
        }],
      }],
    },
  };
}

function operatorRowsBytes(settings) {
  const hooks = (settings && settings.hooks) || {};
  return Buffer.from(JSON.stringify({
    Notification: Array.isArray(hooks.Notification) ? hooks.Notification : [],
    SessionStart: Array.isArray(hooks.SessionStart) ? hooks.SessionStart.slice(0, 1) : [],
  }));
}

let classifiedFixturePackageRows = null;

function fixturePackageRows() {
  if (classifiedFixturePackageRows === null) {
    const { computeHookDependencyGraph } = require(HOOK_INSTALL_CONTRACT_PATH);
    classifiedFixturePackageRows = computeHookDependencyGraph({ sgsdRoot: SUPER_GSD_ROOT }).packages;
  }
  return classifiedFixturePackageRows;
}

function resolveFixturePackageRoot(packageName) {
  let resolvedEntry;
  try {
    resolvedEntry = require.resolve(packageName, { paths: [REPOSITORY_ROOT] });
  } catch (cause) {
    const error = new Error(`fixture bare package is missing: ${packageName}: ${cause.message}`);
    error.code = 'FIXTURE_PACKAGE_MISSING';
    error.package = packageName;
    error.cause = cause;
    throw error;
  }

  const packageParts = packageName.split('/');
  let current = fs.statSync(resolvedEntry).isDirectory() ? resolvedEntry : path.dirname(resolvedEntry);
  while (true) {
    let nodeModulesParent = current;
    let matchesPackagePath = true;
    for (let index = packageParts.length - 1; index >= 0; index -= 1) {
      if (path.basename(nodeModulesParent) !== packageParts[index]) {
        matchesPackagePath = false;
        break;
      }
      nodeModulesParent = path.dirname(nodeModulesParent);
    }
    const packageJsonPath = path.join(current, 'package.json');
    if (matchesPackagePath && path.basename(nodeModulesParent) === 'node_modules'
        && fs.existsSync(packageJsonPath)) {
      try {
        if (JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).name === packageName) return current;
      } catch (_) { /* Keep walking to the resolved node_modules package root. */ }
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  const error = new Error(`fixture bare package root is missing: ${packageName} at ${resolvedEntry}`);
  error.code = 'FIXTURE_PACKAGE_MISSING';
  error.package = packageName;
  throw error;
}

function linkFixturePackage(packageName, sourceRoot, fixturePath) {
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  let mechanism = process.platform === 'win32' ? 'junction' : 'symlink';
  try {
    fs.symlinkSync(sourceRoot, fixturePath, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (linkError) {
    mechanism = 'copy';
    try {
      fs.cpSync(sourceRoot, fixturePath, { recursive: true });
    } catch (copyError) {
      const error = new Error(
        `fixture bare package provisioning failed: ${packageName}: `
        + `link=${linkError.message}; copy=${copyError.message}`,
      );
      error.code = 'FIXTURE_PACKAGE_PROVISION_FAILED';
      error.package = packageName;
      error.cause = copyError;
      throw error;
    }
  }
  return {
    fixture_path: fixturePath,
    mechanism,
    package: packageName,
    source_root: sourceRoot,
  };
}

function provisionFixtureHookPackages(fixtureRoot) {
  return fixturePackageRows().map((packageRow) => {
    const packageName = packageRow.package;
    const sourceRoot = resolveFixturePackageRoot(packageName);
    const fixturePath = path.join(fixtureRoot, 'node_modules', ...packageName.split('/'));
    return linkFixturePackage(packageName, sourceRoot, fixturePath);
  });
}

function fixturePackageRelativePath(packageRow) {
  const fallback = path.join('node_modules', ...packageRow.package.split('/'));
  if (typeof packageRow.source_path !== 'string') return fallback;
  const packageParts = packageRow.package.split('/');
  let current = path.resolve(packageRow.source_path);
  try {
    if (fs.statSync(current).isFile()) current = path.dirname(current);
  } catch (_) { /* A missing package may still name its intended fixture path. */ }
  while (true) {
    let nodeModulesParent = current;
    let matchesPackagePath = true;
    for (let index = packageParts.length - 1; index >= 0; index -= 1) {
      if (path.basename(nodeModulesParent) !== packageParts[index]) {
        matchesPackagePath = false;
        break;
      }
      nodeModulesParent = path.dirname(nodeModulesParent);
    }
    if (matchesPackagePath && path.basename(nodeModulesParent) === 'node_modules') {
      const relative = path.relative(SUPER_GSD_ROOT, current);
      if (relative && !path.isAbsolute(relative) && relative !== '..'
          && !relative.startsWith(`..${path.sep}`)) return relative;
      return fallback;
    }
    const parent = path.dirname(current);
    if (parent === current) return fallback;
    current = parent;
  }
}

function provisionFixtureSourcePackages(vendoredRoot) {
  return fixturePackageRows().map((packageRow) => {
    const packageName = packageRow.package;
    const sourceRoot = resolveFixturePackageRoot(packageName);
    return linkFixturePackage(
      packageName,
      sourceRoot,
      path.join(vendoredRoot, fixturePackageRelativePath(packageRow)),
    );
  });
}

function fixtureTempEnv(fixtureRoot) {
  const resolved = path.resolve(fixtureRoot);
  return { TEMP: resolved, TMP: resolved, TMPDIR: resolved };
}

function copyFixtureSupport(projectRoot, options = {}) {
  const vendoredRoot = path.join(projectRoot, 'super-gsd');
  fs.mkdirSync(vendoredRoot, { recursive: true });
  for (const name of ['install.sh', 'CLAUDE-OVERLAY.md']) {
    fs.copyFileSync(path.join(SUPER_GSD_ROOT, name), path.join(vendoredRoot, name));
  }
  for (const relative of ['agents', 'config', 'hooks', 'registry', 'scripts']) {
    fs.cpSync(path.join(SUPER_GSD_ROOT, relative), path.join(vendoredRoot, relative), { recursive: true });
  }
  for (const relative of [
    path.join('tools', 'codex-hooks'),
    path.join('tools', 'feature-propagation'),
    path.join('tools', 'state-resolver'),
    path.join('tools', 'vtp-readiness'),
  ]) {
    fs.cpSync(path.join(SUPER_GSD_ROOT, relative), path.join(vendoredRoot, relative), { recursive: true });
  }
  fs.copyFileSync(
    path.join(SUPER_GSD_ROOT, 'tools', 'substrate-capability-broker.cjs'),
    path.join(vendoredRoot, 'tools', 'substrate-capability-broker.cjs'),
  );
  if (options.provisionPackages !== false) provisionFixtureSourcePackages(vendoredRoot);
  return vendoredRoot;
}

function createFixture(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-registration-${label}-`));
  provisionFixtureHookPackages(root);
  const projectRoot = path.join(root, 'target project');
  const homeRoot = path.join(root, 'fixture home');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(path.join(homeRoot, '.claude', 'get-shit-done'), { recursive: true });
  const vendoredRoot = copyFixtureSupport(projectRoot);
  return {
    root,
    projectRoot,
    homeRoot,
    vendoredRoot,
    repoSettings: path.join(projectRoot, '.claude', 'settings.json'),
    globalSettings: path.join(homeRoot, '.claude', 'settings.json'),
  };
}

function boundGlobalSmokeFixture(fixture, scriptNames) {
  const installerPath = path.join(fixture.vendoredRoot, 'install.sh');
  const installer = fs.readFileSync(installerPath, 'utf8');
  const manifestMatch = installer.match(/GLOBAL_HOOK_DEPLOYMENT_MANIFEST='([\s\S]*?)'\r?\n/);
  assert.ok(manifestMatch, 'fixture installer lost the global hook manifest');
  const selected = manifestMatch[1].split(/\r?\n/).filter((row) => {
    const fields = row.split('|');
    return scriptNames.includes(fields[3]);
  });
  assert.equal(selected.length, scriptNames.length, 'bounded fixture smoke selection is incomplete');
  assert.equal(selected.every((row) => row.split('|')[2] === 'node'), true, 'bounded fixture smoke must remain node-only');
  const replacement = 'GLOBAL_HOOK_DEPLOYMENT_MANIFEST=\'' + selected.join('\n') + '\'\n';
  fs.writeFileSync(installerPath, installer.replace(manifestMatch[0], replacement), 'utf8');

  const installedHooksRoot = path.join(fixture.homeRoot, '.claude', 'hooks');
  fs.mkdirSync(installedHooksRoot, { recursive: true });
  for (const name of GLOBAL_SCRIPT_NAMES) {
    fs.copyFileSync(
      path.join(fixture.vendoredRoot, 'hooks', name),
      path.join(installedHooksRoot, name),
    );
  }
}

function removeFixture(fixture) {
  try {
    fs.rmSync(fixture.root, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  } catch (error) {
    process.stderr.write(
      `[installer-registration-guard] WARN: fixture cleanup failed for ${fixture.root}: ${error.message}\n`,
    );
  }
}

function hookFiles(hooksRoot) {
  return fs.readdirSync(hooksRoot)
    .filter((name) => fs.statSync(path.join(hooksRoot, name)).isFile())
    .sort();
}

function relativeFiles(root) {
  const files = [];
  function visit(current, prefix) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relative = prefix ? path.join(prefix, entry.name) : entry.name;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute, relative);
      else if (entry.isFile()) files.push(relative);
    }
  }
  visit(root, '');
  return files.sort();
}

function configuredCodexEntryNames() {
  const config = JSON.parse(fs.readFileSync(CODEX_HOOK_CONFIG_PATH, 'utf8'));
  const names = new Set();
  function visit(value) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (typeof value.command === 'string') {
      const match = value.command.match(/^node\s+super-gsd\/tools\/codex-hooks\/([^/\s]+)$/);
      assert.ok(match, 'unexpected Codex hook command shape: ' + value.command);
      names.add(match[1]);
    }
    Object.values(value).forEach(visit);
  }
  visit(config);
  return [...names].sort();
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function manifestFailure(code, sourcePath, surface) {
  throw new Error(`${code} ${sourcePath} [${surface}]`);
}

function commandSourcePath(command, args = []) {
  const launch = [command, ...args].join(' ').replace(/\\/g, '/');
  let match = launch.match(/^(?:node|bash)\s+~\/\.claude\/hooks\/([^\s]+)$/);
  if (match) return `hooks/${match[1]}`;
  match = launch.match(/^(?:node|bash)\s+super-gsd\/(hooks\/[^\s]+|tools\/codex-hooks\/[^\s]+)(?:\s+.*)?$/);
  return match ? match[1] : null;
}

function configuredRegistrationRecords(globalOverlay, repoOverlay, codexConfig, installer, commitGateInstaller) {
  const records = [];
  function addHooks(config, authority, surface) {
    for (const [event, groups] of Object.entries(config.hooks || {})) {
      for (const group of groups || []) {
        for (const hook of group.hooks || []) {
          if (hook.type !== 'command') {
            records.push({ source_path: null, authority, surface, event });
            continue;
          }
          records.push({
            source_path: commandSourcePath(hook.command, hook.args),
            authority,
            surface,
            event,
            matcher: group.matcher ?? null,
            timeout_seconds: hook.timeout ?? null,
            command: [hook.command, ...(hook.args || [])].join(' '),
            hook_id: group.sgsd_hook_id ?? null,
          });
        }
      }
    }
  }

  if (globalOverlay.statusLine && globalOverlay.statusLine.type === 'command') {
    records.push({
      source_path: commandSourcePath(globalOverlay.statusLine.command),
      authority: 'config/settings-overlay.json',
      surface: 'claude-global statusLine',
      event: 'statusLine',
      matcher: null,
      timeout_seconds: globalOverlay.statusLine.timeout ?? null,
      command: globalOverlay.statusLine.command,
      hook_id: null,
    });
  }
  addHooks(globalOverlay, 'config/settings-overlay.json', 'claude-global hooks');
  addHooks(repoOverlay, 'config/repo-settings-overlay.json', 'claude-project');
  addHooks(codexConfig, 'config/codex-hooks.json', 'codex-project');
  const quote = String.fromCharCode(34);
  const lifecyclePresent = installer.includes('run_commit_gate_installer()')
    && installer.includes('INSTALLER_SCRIPT=' + quote + '$SCRIPT_DIR/scripts/install-commit-gate.cjs' + quote)
    && installer.includes('run_commit_gate_installer install');
  const targetPresent = /path\.resolve\(repoRoot, 'super-gsd', 'hooks', 'sgsd-commit-gate\.cjs'\)/
    .test(commitGateInstaller);
  if (lifecyclePresent && targetPresent) {
    records.push({
      source_path: 'hooks/sgsd-commit-gate.cjs',
      authority: 'install.sh --install-commit-gate',
      surface: 'git-pre-commit',
      event: 'pre-commit',
      matcher: null,
      timeout_seconds: null,
      command: 'node super-gsd/hooks/sgsd-commit-gate.cjs',
      hook_id: null,
    });
  }
  return records;
}

function registrationKey(record) {
  return JSON.stringify([
    record.source_path,
    record.authority,
    record.surface,
    record.event,
    record.matcher ?? null,
    record.timeout_seconds ?? null,
    record.command,
    record.hook_id ?? null,
  ]);
}

function validateManifestInventory(snapshot) {
  const entries = snapshot.manifest && Array.isArray(snapshot.manifest.entries)
    ? snapshot.manifest.entries
    : [];
  const inventory = [...snapshot.hookInventory, ...snapshot.codexInventory].sort();
  const entryPaths = entries.map((entry) => entry.source_path);
  const entryPathSet = new Set(entryPaths);
  const inventorySet = new Set(inventory);
  for (const sourcePath of inventory) {
    if (!entryPathSet.has(sourcePath)) manifestFailure('hook_manifest_entry_missing', sourcePath, 'inventory');
  }
  for (const sourcePath of entryPaths) {
    if (!inventorySet.has(sourcePath)) manifestFailure('hook_manifest_entry_unexpected', sourcePath, 'inventory');
  }
  if (entryPathSet.size !== entryPaths.length) {
    const duplicate = entryPaths.find((sourcePath, index) => entryPaths.indexOf(sourcePath) !== index);
    manifestFailure('hook_manifest_entry_unexpected', duplicate, 'manifest');
  }
  assert.equal(snapshot.codexInventory.length, 5, 'hook manifest inventory must contain exactly five Codex entries');
  return { entries, inventorySet, shippedSet: new Set(snapshot.shippedInventory) };
}

function validateDistribution(entry) {
  const expectedInterpreter = entry.source_path.endsWith('.sh') ? 'bash' : 'node';
  if (entry.interpreter !== expectedInterpreter) {
    manifestFailure('hook_manifest_interpreter_invalid', entry.source_path, 'manifest');
  }
  const expectedTargets = entry.source_path.startsWith('hooks/')
    ? ['claude-global', 'claude-project']
    : ['codex-project'];
  const targets = Array.isArray(entry.distribution_targets) ? [...entry.distribution_targets].sort() : [];
  if (targets.some((target) => !HOOK_DISTRIBUTION_TARGETS.includes(target))
    || JSON.stringify(targets) !== JSON.stringify(expectedTargets)) {
    manifestFailure('hook_manifest_distribution_invalid', entry.source_path, 'distribution');
  }
}

function manifestExpectations(entries) {
  const registrations = [];
  const smoke = [];
  const authorities = {
    'claude-global hooks': 'config/settings-overlay.json',
    'claude-global statusLine': 'config/settings-overlay.json',
    'claude-project': 'config/repo-settings-overlay.json',
    'codex-project': 'config/codex-hooks.json',
    'git-pre-commit': 'install.sh --install-commit-gate',
  };
  for (const entry of entries) {
    validateDistribution(entry);
    if (!Array.isArray(entry.dispositions) || entry.dispositions.length === 0) {
      manifestFailure('hook_manifest_reason_missing', entry.source_path, 'disposition');
    }
    for (const disposition of entry.dispositions || []) {
      if (!HOOK_MANIFEST_SURFACES.includes(disposition.surface)) {
        manifestFailure('hook_manifest_surface_invalid', entry.source_path, disposition.surface || 'missing');
      }
      if (disposition.kind === 'intentionally_unregistered') {
        if (typeof disposition.reason !== 'string' || disposition.reason.trim() === '') {
          manifestFailure('hook_manifest_reason_missing', entry.source_path, disposition.surface);
        }
        if (disposition.surface === 'auxiliary-only') {
          smoke.push({
            source_path: entry.source_path,
            event: disposition.smoke_event,
            interpreter: entry.interpreter,
            timeout_seconds: disposition.smoke_timeout_seconds ?? null,
            surface: disposition.surface,
          });
        }
        continue;
      }
      if (disposition.kind !== 'registered') {
        manifestFailure('hook_manifest_reason_missing', entry.source_path, disposition.surface);
      }
      const expectedAuthority = authorities[disposition.surface];
      if (!expectedAuthority || disposition.authority !== expectedAuthority) {
        manifestFailure('hook_manifest_registration_missing', entry.source_path, disposition.surface);
      }
      registrations.push({
        source_path: entry.source_path,
        authority: disposition.authority,
        surface: disposition.surface,
        event: disposition.event,
        matcher: disposition.matcher ?? null,
        timeout_seconds: disposition.timeout_seconds ?? null,
        command: disposition.command,
        hook_id: disposition.hook_id ?? null,
      });
      if (disposition.surface.startsWith('claude-global')) {
        smoke.push({
          source_path: entry.source_path,
          event: disposition.event,
          interpreter: entry.interpreter,
          timeout_seconds: disposition.timeout_seconds ?? null,
          surface: disposition.surface,
        });
      }
    }
  }
  return { registrations, smoke };
}

function validateConfiguredRegistrations(snapshot, inventorySet, shippedSet, expected) {
  const actual = configuredRegistrationRecords(
    snapshot.globalOverlay,
    snapshot.repoOverlay,
    snapshot.codexConfig,
    snapshot.installer,
    snapshot.commitGateInstaller,
  );
  const actualEventKeys = new Set();
  for (const record of actual) {
    if (!record.source_path || !inventorySet.has(record.source_path) || !shippedSet.has(record.source_path)) {
      manifestFailure('hook_manifest_registration_unexpected', record.source_path || 'unsupported-command', record.surface);
    }
    const eventKey = JSON.stringify([record.source_path, record.surface, record.event]);
    if (actualEventKeys.has(eventKey)) {
      manifestFailure('hook_manifest_registration_unexpected', record.source_path, record.surface);
    }
    actualEventKeys.add(eventKey);
  }
  const actualCounts = new Map();
  for (const record of actual) {
    const key = registrationKey(record);
    actualCounts.set(key, (actualCounts.get(key) || 0) + 1);
  }
  for (const record of expected) {
    const key = registrationKey(record);
    const count = actualCounts.get(key) || 0;
    if (count === 0) manifestFailure('hook_manifest_registration_missing', record.source_path, record.surface);
    actualCounts.set(key, count - 1);
  }
  const unexpected = actual.find((record) => (actualCounts.get(registrationKey(record)) || 0) > 0);
  if (unexpected) manifestFailure('hook_manifest_registration_unexpected', unexpected.source_path, unexpected.surface);
}

function validateManifestSmoke(smokeManifest, expected) {
  const actual = smokeManifest.split(/\r?\n/).filter(Boolean).map((row) => {
    const [event, , interpreter, fileName, timeout] = row.split('|');
    return {
      source_path: `hooks/${fileName}`,
      event,
      interpreter,
      timeout_seconds: timeout === '' ? null : Number(timeout),
    };
  });
  const keyOf = (record) => JSON.stringify([
    record.source_path,
    record.event,
    record.interpreter,
    record.timeout_seconds ?? null,
  ]);
  assert.equal(new Set(actual.map(keyOf)).size, actual.length, 'hook manifest smoke contains a duplicate entry');
  const actualKeys = new Set(actual.map(keyOf));
  for (const record of expected) {
    const key = keyOf(record);
    if (!actualKeys.has(key)) manifestFailure('hook_manifest_registration_missing', record.source_path, record.surface);
    actualKeys.delete(key);
  }
  if (actualKeys.size > 0) {
    const extra = actual.find((record) => actualKeys.has(keyOf(record)));
    manifestFailure('hook_manifest_registration_unexpected', extra.source_path, 'auxiliary-only');
  }
}

function validateHookManifest(snapshot) {
  const { entries, inventorySet, shippedSet } = validateManifestInventory(snapshot);
  const expected = manifestExpectations(entries);
  validateConfiguredRegistrations(snapshot, inventorySet, shippedSet, expected.registrations);
  validateManifestSmoke(snapshot.smokeManifest, expected.smoke);
  return { entries: entries.length, registrations: expected.registrations.length, smoke: expected.smoke.length };
}

function hookManifestSnapshot() {
  const hookInventory = hookFiles(path.join(SUPER_GSD_ROOT, 'hooks')).map((name) => `hooks/${name}`);
  const codexInventory = configuredCodexEntryNames().map((name) => `tools/codex-hooks/${name}`);
  return {
    manifest: JSON.parse(fs.readFileSync(HOOK_MANIFEST_PATH, 'utf8')),
    hookInventory,
    codexInventory,
    shippedInventory: [
      ...hookInventory,
      ...codexInventory.filter((sourcePath) => {
        const absolute = path.join(SUPER_GSD_ROOT, sourcePath);
        return fs.existsSync(absolute) && fs.statSync(absolute).isFile();
      }),
    ],
    globalOverlay: JSON.parse(fs.readFileSync(GLOBAL_OVERLAY_PATH, 'utf8')),
    repoOverlay: JSON.parse(fs.readFileSync(REPO_OVERLAY_PATH, 'utf8')),
    codexConfig: JSON.parse(fs.readFileSync(CODEX_HOOK_CONFIG_PATH, 'utf8')),
    installer: fs.readFileSync(INSTALL_PATH, 'utf8'),
    commitGateInstaller: fs.readFileSync(COMMIT_GATE_INSTALLER_PATH, 'utf8'),
    smokeManifest: readGlobalDeploymentManifest(),
  };
}

function assertManifestMutationRefused(base, mutate, code, sourcePath, surface) {
  const fixture = deepClone(base);
  mutate(fixture);
  assert.throws(
    () => validateHookManifest(fixture),
    (error) => error.message === `${code} ${sourcePath} [${surface}]`,
    `${code} mutation passed silently for ${sourcePath} [${surface}]`,
  );
}

function assertFixtureBarePackageSupport() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd fixture package support '));
  try {
    const expected = fixturePackageRows().map((row) => row.package).sort();
    const provisioned = provisionFixtureHookPackages(root);
    assert.deepEqual(provisioned.map((row) => row.package).sort(), expected);
    for (const row of provisioned) {
      assert.ok(fs.existsSync(row.fixture_path), `fixture package link is missing: ${row.package}`);
      assert.ok(['junction', 'symlink', 'copy'].includes(row.mechanism),
        `fixture package used an unknown provisioning mechanism: ${row.package}`);
      if (row.mechanism === 'copy') {
        assert.equal(fs.lstatSync(row.fixture_path).isSymbolicLink(), false,
          `fixture package copy fallback remained a link: ${row.package}`);
      } else {
        assert.equal(fs.lstatSync(row.fixture_path).isSymbolicLink(), true,
          `fixture package was copied while linking was available: ${row.package}`);
        assert.equal(
          fs.realpathSync(row.fixture_path),
          fs.realpathSync(row.source_root),
          `fixture package link does not target the resolved package root: ${row.package}`,
        );
      }
      assert.ok(
        require.resolve(row.package, { paths: [path.join(root, 'consumer with spaces')] }),
        `fixture package cannot be required: ${row.package}`,
      );
    }
    const trimmedRoot = copyFixtureSupport(path.join(root, 'trimmed checkout with spaces'));
    const { computeHookDependencyGraph } = require(HOOK_INSTALL_CONTRACT_PATH);
    const trimmedPackages = computeHookDependencyGraph({
      sgsdRoot: trimmedRoot,
      projectDir: path.dirname(trimmedRoot),
    }).packages;
    assert.deepEqual(trimmedPackages.map((row) => row.package).sort(), expected);
    assert.equal(trimmedPackages.every((row) => row.present), true,
      'trimmed fixture closure still reports a required bare package missing');
    const missing = 'sgsd-deliberately-absent-fixture-package';
    assert.throws(
      () => resolveFixturePackageRoot(missing),
      (error) => error.code === 'FIXTURE_PACKAGE_MISSING' && error.message.includes(missing),
      'an absent closure package did not fail loudly by name',
    );
  } finally {
    removeFixture({ root });
  }
}

function runHookManifestCompleteness() {
  assertFixtureBarePackageSupport();
  const snapshot = hookManifestSnapshot();
  assert.deepEqual(validateHookManifest(snapshot), { entries: 22, registrations: 26, smoke: 15 });

  assertManifestMutationRefused(snapshot, (fixture) => {
    fixture.globalOverlay.hooks.SessionStart = fixture.globalOverlay.hooks.SessionStart
      .filter((group) => group.hooks[0].command !== 'node ~/.claude/hooks/sgsd-session-start.js');
  }, 'hook_manifest_registration_missing', 'hooks/sgsd-session-start.js', 'claude-global hooks');
  assertManifestMutationRefused(snapshot, (fixture) => {
    const entry = fixture.manifest.entries.find((candidate) => candidate.source_path === 'hooks/sgsd-statusline.js');
    entry.dispositions.find((item) => item.kind === 'intentionally_unregistered').reason = '   ';
  }, 'hook_manifest_reason_missing', 'hooks/sgsd-statusline.js', 'claude-global hooks');
  assertManifestMutationRefused(snapshot, (fixture) => {
    fixture.globalOverlay.hooks.PostToolUse.push({
      matcher: '*',
      hooks: [{ type: 'command', command: 'node ~/.claude/hooks/sgsd-commit-gate.cjs', timeout: 5 }],
    });
  }, 'hook_manifest_registration_unexpected', 'hooks/sgsd-commit-gate.cjs', 'claude-global hooks');
  assertManifestMutationRefused(snapshot, (fixture) => {
    fixture.hookInventory.push('hooks/unmanifested-source.js');
  }, 'hook_manifest_entry_missing', 'hooks/unmanifested-source.js', 'inventory');
  assertManifestMutationRefused(snapshot, (fixture) => {
    const quality = fixture.globalOverlay.hooks.PostToolUse.find(
      (group) => group.hooks[0].command === 'node ~/.claude/hooks/sgsd-quality-gate.js',
    );
    fixture.globalOverlay.hooks.PostToolUse.push(deepClone(quality));
  }, 'hook_manifest_registration_unexpected', 'hooks/sgsd-quality-gate.js', 'claude-global hooks');
  assertManifestMutationRefused(snapshot, (fixture) => {
    fixture.globalOverlay.hooks.PostToolUse.push({
      matcher: '*',
      hooks: [{ type: 'command', command: 'node ~/.claude/hooks/not-shipped.js', timeout: 5 }],
    });
  }, 'hook_manifest_registration_unexpected', 'hooks/not-shipped.js', 'claude-global hooks');
  assertManifestMutationRefused(snapshot, (fixture) => {
    fixture.shippedInventory = fixture.shippedInventory
      .filter((sourcePath) => sourcePath !== 'tools/codex-hooks/block-forbidden-write.cjs');
  }, 'hook_manifest_registration_unexpected', 'tools/codex-hooks/block-forbidden-write.cjs', 'codex-project');
}

function createDistributionFixture(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-registration-${label}-`));
  provisionFixtureHookPackages(root);
  const sourceCheckout = path.join(root, 'source checkout');
  const projectRoot = path.join(root, 'target project');
  const homeRoot = path.join(root, 'fixture home');
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(path.join(homeRoot, '.claude', 'get-shit-done'), { recursive: true });
  const vendoredRoot = copyFixtureSupport(sourceCheckout);

  const projectSgsdRoot = path.join(projectRoot, 'super-gsd');
  for (const relative of [
    path.join('scripts', 'lib'),
    'registry',
    path.join('tools', 'vtp-readiness'),
  ]) {
    const target = path.join(projectSgsdRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(vendoredRoot, relative), target, { recursive: true });
  }
  provisionFixtureSourcePackages(projectSgsdRoot);
  const systemdRoot = path.join(projectSgsdRoot, 'hooks', 'systemd');
  const systemdSentinel = path.join(systemdRoot, 'operator-owned.service');
  fs.mkdirSync(systemdRoot, { recursive: true });
  fs.writeFileSync(systemdSentinel, 'operator-owned-systemd-sentinel\n', 'utf8');
  assert.deepEqual(
    fs.readdirSync(path.dirname(systemdRoot)).sort(),
    ['systemd'],
    'distribution target did not start with only systemd/',
  );

  return {
    root,
    sourceCheckout,
    projectRoot,
    homeRoot,
    vendoredRoot,
    systemdSentinel,
    repoSettings: path.join(projectRoot, '.claude', 'settings.json'),
    globalSettings: path.join(homeRoot, '.claude', 'settings.json'),
  };
}

function assertNamedFilesMatch(sourceRoot, targetRoot, names, label) {
  const failures = [];
  for (const name of names) {
    const source = path.join(sourceRoot, name);
    const target = path.join(targetRoot, name);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) failures.push(`missing:${name}`);
    else if (!readBytes(target).equals(readBytes(source))) failures.push(`bytes:${name}`);
  }
  if (failures.length > 0) throw new Error(`hook_distribution_incomplete ${label} ${failures.join(',')}`);
  assert.deepEqual(hookFiles(targetRoot), [...names].sort(), `${label} contains an unexpected regular file`);
}

function assertTreeMatches(sourceRoot, targetRoot, label) {
  const sourceFiles = relativeFiles(sourceRoot);
  assert.deepEqual(relativeFiles(targetRoot), sourceFiles, `${label} file inventory drifted`);
  for (const relative of sourceFiles) {
    assert.deepEqual(
      readBytes(path.join(targetRoot, relative)),
      readBytes(path.join(sourceRoot, relative)),
      `${label} bytes drifted for ${relative}`,
    );
  }
}

function assertLegacyHookGlobIsRejected(sourceHooksRoot, fixtureRoot) {
  for (const site of ['global', 'repo-local']) {
    const targetRoot = path.join(fixtureRoot, `legacy-${site}-hooks`);
    fs.mkdirSync(targetRoot, { recursive: true });
    for (const name of hookFiles(sourceHooksRoot).filter((entry) => /\.(?:js|sh)$/.test(entry))) {
      fs.copyFileSync(path.join(sourceHooksRoot, name), path.join(targetRoot, name));
    }
    assert.throws(
      () => assertNamedFilesMatch(sourceHooksRoot, targetRoot, SHIPPED_HOOK_NAMES, site),
      (error) => error.message.includes('hook_distribution_incomplete')
        && error.message.includes('missing:sgsd-commit-gate.cjs')
        && error.message.includes('missing:sgsd-intent-classifier.cjs'),
      `${site} old .js/.sh glob was not rejected`,
    );
  }
}

function assertUndistributedProjectRefusesFour(projectRoot) {
  const {
    preflightHookRegistrations,
    realizeRepoLocalHookOverlay,
  } = require(PREFLIGHT_PATH);
  const overlay = realizeRepoLocalHookOverlay(
    JSON.parse(fs.readFileSync(REPO_OVERLAY_PATH, 'utf8')),
    projectRoot,
  );
  let refusal;
  try {
    preflightHookRegistrations(overlay);
  } catch (error) {
    refusal = error;
  }
  assert.ok(refusal, 'undistributed project unexpectedly passed registration preflight');
  assert.match(refusal.message, /hook_registration_missing/);
  for (const [, , relative] of REPO_REGISTRATIONS) {
    assert.ok(
      refusal.message.includes(path.resolve(projectRoot, relative)),
      `pre-fix refusal omitted ${relative}`,
    );
  }
}

function retainClarityNine(vendoredRoot) {
  const hooksRoot = path.join(vendoredRoot, 'hooks');
  for (const name of hookFiles(hooksRoot)) {
    if (!CLARITY_NINE_HOOKS.includes(name)) fs.rmSync(path.join(hooksRoot, name));
  }
  fs.rmSync(path.join(vendoredRoot, 'tools', 'codex-hooks', 'block-secret-leak.cjs'));
  assert.deepEqual(hookFiles(hooksRoot), [...CLARITY_NINE_HOOKS].sort(), 'fixture is not the exact Clarity nine-hook shape');
}

function runInstaller(fixture, args, timeoutMs = DEFAULT_INSTALLER_SPAWN_TIMEOUT_MS) {
  const bash = process.env.SGSD_TEST_BASH || 'bash';
  return spawnSync(
    bash,
    [path.join(fixture.vendoredRoot, 'install.sh'), ...args],
    {
      cwd: fixture.projectRoot,
      env: {
        ...process.env,
        HOME: fixture.homeRoot,
        USERPROFILE: fixture.homeRoot,
        APPDATA: path.join(fixture.homeRoot, 'AppData', 'Roaming'),
        XDG_CONFIG_HOME: path.join(fixture.homeRoot, '.config'),
        ...fixtureTempEnv(fixture.root),
      },
      encoding: 'utf8',
      shell: false,
      timeout: timeoutMs,
      windowsHide: true,
    },
  );
}

function runFixtureProcess(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env || process.env,
    encoding: 'utf8',
    shell: false,
    timeout: options.timeoutMs || FIXTURE_GIT_SPAWN_TIMEOUT_MS,
    windowsHide: true,
  });
}

function assertFixtureProcessOk(result, label) {
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `${label} failed:\n${result.stderr || ''}\n${result.stdout || ''}`);
  return String(result.stdout || '').trim();
}

function runFixtureGit(args, cwd, label) {
  return assertFixtureProcessOk(
    runFixtureProcess(process.env.SGSD_TEST_GIT || 'git', args, { cwd }),
    label,
  );
}

function removeBrokenGlobalCoverage(sourceRoot, missingGlobalNames) {
  const overlayPath = path.join(sourceRoot, 'super-gsd', 'config', 'settings-overlay.json');
  const overlay = JSON.parse(fs.readFileSync(overlayPath, 'utf8'));
  for (const event of Object.keys(overlay.hooks || {})) {
    overlay.hooks[event] = overlay.hooks[event].filter((entry) => !(entry.hooks || []).some((hook) => {
      const launch = [hook.command, ...(hook.args || [])].join(' ');
      return missingGlobalNames.some((name) => launch.includes(name));
    }));
  }
  writeJson(overlayPath, overlay);

  const installerPath = path.join(sourceRoot, 'super-gsd', 'install.sh');
  let installer = fs.readFileSync(installerPath, 'utf8');
  const currentPreflightCall = '  preflight_existing_repo_local_hooks || return $?\n';
  assert.ok(installer.includes(currentPreflightCall), 'production installer lost existing-project preflight');
  installer = installer.replace(currentPreflightCall, '');
  const manifestMatch = installer.match(/GLOBAL_HOOK_DEPLOYMENT_MANIFEST='([\s\S]*?)'\r?\n/);
  assert.ok(manifestMatch, 'broken control lost the global deployment manifest');
  const rows = manifestMatch[1].split(/\r?\n/).filter((row) => {
    const fileName = row.split('|')[3];
    return !missingGlobalNames.includes(fileName);
  });
  const replacement = `GLOBAL_HOOK_DEPLOYMENT_MANIFEST='${rows.join('\n')}'\n`;
  fs.writeFileSync(installerPath, installer.replace(manifestMatch[0], replacement), 'utf8');
}

function assertNoUpdaterTemp(projectRoot, settingsPath) {
  assert.equal(fs.existsSync(`${settingsPath}.tmp`), false, 'settings temp artifact remains');
  assert.equal(
    fs.readdirSync(projectRoot).some((name) => name.startsWith('.super-gsd-version.tmp.')),
    false,
    'project pin temp artifact remains',
  );
}

function seedTarget(filePath, label) {
  writeJson(filePath, sentinelSettings(label));
  const bytes = readBytes(filePath);
  return { bytes, hash: sha256(bytes) };
}

function assertRefused(result, targetPath, before, expectedFragments) {
  if (result.error) throw result.error;
  const output = `${result.stderr || ''}\n${result.stdout || ''}`;
  assert.notEqual(result.status, 0, `installer unexpectedly succeeded:\n${output}`);
  for (const fragment of expectedFragments) {
    assert.ok(output.includes(fragment), `refusal did not name ${fragment}:\n${output}`);
  }
  const after = readBytes(targetPath);
  assert.equal(sha256(after), before.hash, `settings hash changed at ${targetPath}`);
  assert.deepEqual(after, before.bytes, `settings bytes changed at ${targetPath}`);
  assert.equal(fs.existsSync(`${targetPath}.tmp`), false, `temporary settings artifact remains at ${targetPath}.tmp`);
}

function assertModuleNotFoundPayload(output, expected) {
  let refusal = null;
  let refusalLine = null;
  for (const line of String(output || '').split(/\r?\n/)) {
    if (!line.trim().startsWith('{')) continue;
    try {
      const candidate = JSON.parse(line);
      if (candidate && candidate.ok === false) {
        refusal = candidate;
        refusalLine = line.trim();
      }
    } catch (_) { /* Non-JSON installer diagnostics remain available to the caller. */ }
  }
  assert.ok(refusal, 'refusal omitted its structured payload:\n' + output);
  assert.ok(refusalLine, 'refusal omitted its single-line JSON disclosure');
  assert.equal(refusal.reason, 'hook_smoke_failed', 'refusal changed its closed reason');
  assert.ok(refusal.underlying_error, 'refusal omitted its underlying module error');
  assert.deepEqual(Object.keys(refusal.underlying_error).sort(), ['code', 'message', 'path', 'request']);
  assert.equal(refusal.underlying_error.code, 'MODULE_NOT_FOUND');
  assert.equal(refusal.underlying_error.request, expected.request);
  assert.equal(refusal.underlying_error.path, expected.path);
  assert.equal(typeof refusal.underlying_error.message, 'string', 'refusal omitted its bounded message');
  assert.ok(
    Buffer.byteLength(refusal.underlying_error.message, 'utf8') <= 2048,
    'refusal message exceeded the 2048-byte bounded-line limit',
  );
  assert.doesNotMatch(
    refusal.underlying_error.message,
    /[\r\n\t]/,
    'refusal message disclosed multi-line raw hook output',
  );
  for (const fragment of expected.messageFragments || [expected.request]) {
    assert.ok(
      refusal.underlying_error.message.includes(fragment),
      'bounded module error omitted ' + fragment + ': ' + refusal.underlying_error.message,
    );
  }
  return refusal;
}

function assertModuleNotFoundRefused(result, targetPath, before, expected) {
  assertRefused(result, targetPath, before, [
    'hook_smoke_failed',
    'MODULE_NOT_FOUND',
    expected.request,
  ]);
  return assertModuleNotFoundPayload(
    (result.stderr || '') + '\n' + (result.stdout || ''),
    expected,
  );
}

function countManagedHook(settings, event, hookId) {
  return ((settings.hooks && settings.hooks[event]) || [])
    .filter((entry) => entry.sgsd_managed === true && entry.sgsd_hook_id === hookId)
    .length;
}

function providerLockRange(overlay) {
  const heading = /^## CURRENT PROVIDER LOCK\s*$/m;
  const match = heading.exec(overlay);
  assert.ok(match, 'bundled overlay lost CURRENT PROVIDER LOCK');
  const start = match.index;
  const afterHeading = start + match[0].length;
  const nextHeading = /^##\s+/m.exec(overlay.slice(afterHeading));
  const end = nextHeading ? afterHeading + nextHeading.index : overlay.length;
  return { start, end, text: overlay.slice(start, end) };
}

function markdownSection(overlay, heading) {
  const match = heading.exec(overlay);
  assert.ok(match, 'bundled overlay lost load-bearing section');
  const afterHeading = match.index + match[0].length;
  const nextHeading = /^#{1,3}\s+/m.exec(overlay.slice(afterHeading));
  const end = nextHeading ? afterHeading + nextHeading.index : overlay.length;
  return overlay.slice(match.index, end);
}

function assertBundledOverlayCurrent(overlay) {
  const providerLock = providerLockRange(overlay);
  const outsideProviderLock = overlay.slice(0, providerLock.start) + overlay.slice(providerLock.end);

  for (const marker of STALE_OVERLAY_MARKERS) {
    const scanned = marker.outsideProviderLock ? outsideProviderLock : overlay;
    if (marker.pattern.test(scanned)) {
      throw new Error('bundled_overlay_stale ' + marker.id);
    }
  }

  assert.match(providerLock.text, /\bCodex gpt-5\.6-sol\b/i, 'provider lock lost Codex gpt-5.6-sol');
  assert.match(
    providerLock.text,
    /Sonnet is not a fresh-clone default provider and is not a Codex fallback/i,
    'provider lock lost its explicit Sonnet prohibition',
  );
  const memorySection = markdownSection(overlay, /^### Memory Retrieval\b.*$/m);
  assert.match(memorySection, /\.planning\/memory\//, 'bundled overlay lost the DLB-01 memory root');
  assert.match(memorySection, /\bMEMORY\.md\b/, 'bundled overlay lost the memory catalogue');
  assert.match(memorySection, /sgsd-recall/, 'bundled overlay lost the recall wrapper');
  assert.match(memorySection, /sgsd-curate/, 'bundled overlay lost the curate wrapper');

  const modelSection = markdownSection(overlay, /^### Model Routing\s*$/m);
  assert.match(modelSection, /\| Classifier \| Codex\/local \|/, 'model routing lost local classification');
  assert.match(modelSection, /\| Context selector \| Codex\/local \|/, 'model routing lost local context selection');
  assert.match(modelSection, /\| Code execution \| Codex gpt-5\.6-sol\/xhigh \|/, 'model routing lost delivery provider');

  const commitSection = markdownSection(overlay, /^### Commit Discipline\s*$/m);
  assert.match(
    commitSection,
    /Commit after EVERY unit\. Never batch\. Never skip\. Never amend\./,
    'bundled overlay lost commit discipline',
  );
}

function runBundledOverlayStatic() {
  const overlay = fs.readFileSync(BUNDLED_OVERLAY_PATH, 'utf8');
  assertBundledOverlayCurrent(overlay);

  for (const marker of STALE_OVERLAY_MARKERS) {
    const mutated = overlay.trimEnd() + '\n' + marker.mutation + '\n';
    let rejection;
    try {
      assertBundledOverlayCurrent(mutated);
    } catch (error) {
      rejection = error;
    }
    assert.ok(rejection, 'stale overlay mutation passed: ' + marker.id);
    assert.equal(rejection.message, 'bundled_overlay_stale ' + marker.id);
    assert.equal(rejection.message.includes(marker.mutation), false, 'stale line leaked for ' + marker.id);
  }
}

function runBundledOverlayCurrent() {
  const overlay = readBytes(BUNDLED_OVERLAY_PATH);
  assertBundledOverlayCurrent(overlay.toString('utf8'));
  const fixture = createFixture('bundled-overlay');
  try {
    const installedPath = path.join(fixture.projectRoot, 'CLAUDE.md');
    assert.equal(fs.existsSync(installedPath), false, 'fresh fixture already has CLAUDE.md');
    const result = runInstaller(fixture, ['--init-project', '--skip-cockpit-deps']);
    if (result.error) throw result.error;
    assert.equal(result.status, 0, 'fresh overlay install failed:\n' + result.stderr + '\n' + result.stdout);
    assert.deepEqual(readBytes(installedPath), overlay, 'fresh CLAUDE.md differs from bundled overlay');
  } finally {
    removeFixture(fixture);
  }
}

function runPreflightStatic() {
  const {
    enumerateGlobalManifestCoverage,
    enumerateHookRegistrations,
    enumerateProjectManagedHookRegistrations,
    filterWarnedHookDescriptors,
    preflightHookRegistrations,
    preflightProjectManagedRegistrations,
  } = require(PREFLIGHT_PATH);
  const root = path.resolve(os.tmpdir(), 'sgsd preflight static');
  const paths = {
    status: path.join(root, 'status line.js'),
    session: path.join(root, 'session.js'),
    state: path.join(root, 'session state.sh'),
    quality: path.join(root, 'quality.js'),
  };
  const quote = String.fromCharCode(34);
  const overlay = {
    statusLine: { type: 'command', command: `node ${quote}${paths.status}${quote}` },
    hooks: {
      SessionStart: [{
        sgsd_managed: true,
        sgsd_hook_id: 'session-governance',
        hooks: [
          { type: 'command', command: 'node', args: [paths.session], timeout: 5 },
          { type: 'command', command: `bash ${quote}${paths.state}${quote}`, timeout: 5 },
        ],
      }],
      PostToolUse: [{ hooks: [{ type: 'command', command: 'node', args: [paths.quality] }] }],
    },
  };
  const descriptors = enumerateHookRegistrations(overlay);
  assert.equal(descriptors.length, 3);
  assert.deepEqual(descriptors.map((item) => item.event), ['SessionStart', 'SessionStart', 'PostToolUse']);
  assert.equal(descriptors[0].hookId, 'session-governance');
  assert.equal(descriptors[2].hookId, 'PostToolUse[0].hooks[0]');

  const checked = [];
  const passed = preflightHookRegistrations(overlay, {
    isFile: () => true,
    nodeCheck: (scriptPath) => { checked.push(`node:${scriptPath}`); return { status: 0 }; },
    shellCheck: (scriptPath) => { checked.push(`bash:${scriptPath}`); return { status: 0 }; },
  });
  assert.equal(passed.length, 3);
  assert.deepEqual(checked, [
    `node:${paths.session}`,
    `bash:${paths.state}`,
    `node:${paths.quality}`,
  ]);

  let aggregateError;
  try {
    preflightHookRegistrations(overlay, {
      isFile: (scriptPath) => scriptPath !== paths.session && scriptPath !== paths.state,
      nodeCheck: (scriptPath) => ({ status: scriptPath === paths.quality ? 1 : 0 }),
      shellCheck: () => ({ status: 0 }),
    });
  } catch (error) {
    aggregateError = error;
  }
  assert.ok(aggregateError, 'aggregate refusal was not thrown');
  assert.match(aggregateError.message, /hook_registration_missing/);
  assert.match(aggregateError.message, /hook_registration_node_check_failed/);
  for (const expectedPath of [paths.session, paths.state, paths.quality]) {
    assert.ok(aggregateError.message.includes(expectedPath), `aggregate refusal omitted ${expectedPath}`);
  }
  assert.equal(aggregateError.message.includes(paths.status), false, 'passing path was reported as failed');

  const nodeOnly = { hooks: { Stop: [{ hooks: [{ type: 'command', command: 'node', args: [paths.quality] }] }] } };
  for (const failedResult of [
    { error: Object.assign(new Error('do-not-leak-spawn'), { code: 'EPERM' }), status: null },
    { signal: 'SIGTERM', status: null, stderr: 'do-not-leak-signal' },
    { error: Object.assign(new Error('do-not-leak-timeout'), { code: 'ETIMEDOUT' }), status: null },
    { status: 1, stdout: 'do-not-leak-stdout', stderr: 'do-not-leak-stderr' },
  ]) {
    let checkError;
    try {
      preflightHookRegistrations(nodeOnly, {
        isFile: () => true,
        nodeCheck: () => failedResult,
      });
    } catch (error) {
      checkError = error;
    }
    assert.ok(checkError && checkError.message.includes(`hook_registration_node_check_failed ${paths.quality}`));
    assert.equal(checkError.message.includes('do-not-leak'), false, 'raw checker output leaked into refusal');
  }

  assert.throws(
    () => preflightHookRegistrations({
      hooks: { Stop: [{ hooks: [{ type: 'command', command: `bash ${quote}${paths.state}${quote}` }] }] },
    }, {
      isFile: () => true,
      shellCheck: () => ({ status: 1 }),
    }),
    new RegExp(`hook_registration_shell_check_failed.*${paths.state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  );

  assert.deepEqual(
    enumerateHookRegistrations({ statusLine: { type: 'command', command: `python ${paths.status}` } }),
    [],
    'native statusLine entered event-hook launch validation',
  );
  assert.throws(
    () => enumerateHookRegistrations({
      hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node', args: ['relative.js'] }] }] },
    }),
    /hook_registration_launch_invalid.*SessionStart\[0\]\.hooks\[0\]/,
  );

  const projectSettings = sentinelSettings('preflight-operator-project');
  projectSettings.hooks.PostToolUse = [{
    sgsd_managed: true,
    sgsd_hook_id: 'managed-quality',
    hooks: [{ type: 'command', command: 'node', args: [paths.quality] }],
  }];
  const globalQuality = path.join(root, 'global', 'quality.js');
  const globalSettings = sentinelSettings('preflight-operator-global');
  globalSettings.hooks.PostToolUse = [{
    hooks: [{ type: 'command', command: `node ${quote}${globalQuality}${quote}` }],
  }];
  const projectOperatorBefore = operatorRowsBytes(projectSettings);
  const globalOperatorBefore = operatorRowsBytes(globalSettings);
  const managedDescriptors = enumerateProjectManagedHookRegistrations(projectSettings);
  assert.equal(managedDescriptors.length, 1, 'operator project rows entered managed enumeration');
  const coverageDescriptors = enumerateGlobalManifestCoverage(globalSettings, managedDescriptors);
  assert.equal(coverageDescriptors.length, 1, 'matching global manifest coverage was not isolated');

  const coverageChecks = [];
  const covered = preflightProjectManagedRegistrations(projectSettings, globalSettings, {
    isFile: (scriptPath) => scriptPath === globalQuality,
    nodeCheck: (scriptPath) => {
      coverageChecks.push(scriptPath);
      return { status: 0 };
    },
  });
  assert.deepEqual(coverageChecks, [globalQuality], 'operator or foreign global row entered coverage validation');
  assert.equal(covered.warnings.length, 1);
  assert.equal(covered.warnings[0].code, 'project_hook_registration_missing_global_covered');
  assert.equal(Object.prototype.hasOwnProperty.call(covered, 'globalIssues'), false, 'operator diagnostics leaked from coverage lookup');
  assert.deepEqual(
    filterWarnedHookDescriptors(managedDescriptors, covered.warnedDescriptors, {
      isFile: () => false,
    }),
    [],
    'operator project row entered the repo smoke set',
  );
  const postDistributionChecks = [];
  assert.deepEqual(
    filterWarnedHookDescriptors(managedDescriptors, covered.warnedDescriptors, {
      isFile: (scriptPath) => {
        postDistributionChecks.push(scriptPath);
        return true;
      },
    }),
    managedDescriptors,
    'distributed warned descriptor did not re-enter the repo smoke set',
  );
  assert.deepEqual(
    postDistributionChecks,
    [paths.quality],
    'warned descriptor existence was not re-evaluated after distribution',
  );
  assert.deepEqual(operatorRowsBytes(projectSettings), projectOperatorBefore, 'project operator rows changed during preflight');
  assert.deepEqual(operatorRowsBytes(globalSettings), globalOperatorBefore, 'global operator rows changed during coverage lookup');
  assert.equal(JSON.stringify(covered).includes('operator-pathological'), false, 'operator row was mentioned by preflight');
  assert.equal(JSON.stringify(covered).includes('operator garbage command'), false, 'pathological operator row was mentioned by preflight');

  const audit = require(path.join(SUPER_GSD_ROOT, 'tools', 'feature-propagation', 'audit.cjs'));
  assert.equal(
    typeof audit._internals.checkSubstrateHookRegistrations,
    'function',
    'feature propagation audit lacks the shared non-mutating substrate registration check',
  );
  const fixture = createFixture('substrate-precheck');
  try {
    fs.mkdirSync(path.join(fixture.root, '.planning'), { recursive: true });
    assert.equal(
      audit.runAudit({ projectDir: fixture.projectRoot }).project_dir,
      path.resolve(fixture.projectRoot),
      'explicit project destination was overridden by ancestor .planning discovery',
    );
    retainClarityNine(fixture.vendoredRoot);
    const snapshot = () => relativeFiles(fixture.root).map((relative) => [
      relative,
      sha256(readBytes(path.join(fixture.root, relative))),
    ]);
    const before = snapshot();
    const result = audit._internals.checkSubstrateHookRegistrations({
      projectDir: fixture.projectRoot,
      sgsdRoot: fixture.vendoredRoot,
    }, { repairProjectHooks: true });
    const expectedLines = REPO_REGISTRATIONS
      .filter(([, hookId]) => hookId !== 'session-start-governance')
      .map(([event, hookId, relative]) => (
        `hook_registration_missing ${path.resolve(fixture.projectRoot, relative)} [${event}/${hookId}]`
      ));
    assert.equal(result.ok, false, 'incomplete substrate registration sources passed the read-only check');
    assert.deepEqual(result.detail.split(/\r?\n/), expectedLines, 'read-only check did not return the complete refusal set');
    assert.deepEqual(snapshot(), before, 'read-only substrate registration check mutated its fixture');
    const repairActions = [];
    const repair = audit._internals.repairClaudeSubstrateWitness({
      projectDir: fixture.projectRoot,
      sgsdRoot: fixture.vendoredRoot,
    }, repairActions, { repairProjectHooks: true });
    assert.equal(repair.ok, false, 'repair path bypassed the shared registration refusal');
    assert.deepEqual(repair.detail.split(/\r?\n/), expectedLines, 'repair and read-only checks disagreed');
    assert.deepEqual(repairActions, [], 'repair mutated capability state after the shared refusal was known');
    assert.deepEqual(snapshot(), before, 'repair path mutated its fixture after the shared refusal was known');
  } finally {
    removeFixture(fixture);
  }
}

function realizeGlobalOverlayForStatic(value, hooksRoot) {
  if (Array.isArray(value)) return value.map((child) => realizeGlobalOverlayForStatic(child, hooksRoot));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'command' || typeof child !== 'string') {
      out[key] = realizeGlobalOverlayForStatic(child, hooksRoot);
      continue;
    }
    const match = child.match(/^(node|bash)\s+~\/\.claude\/hooks\/([^\s]+)$/);
    assert.ok(match, 'unexpected global overlay launch shape: ' + child);
    const quote = String.fromCharCode(34);
    out[key] = match[1] + ' ' + quote + path.resolve(hooksRoot, match[2]) + quote;
  }
  return out;
}

function assertInstallerSmokeOrder(installer) {
  const quote = String.fromCharCode(34);
  const globalHookBatch = 'copy_files_to_root ' + quote + '$HOOKS_DIR' + quote
    + ' ' + quote + '${hook_sources[@]}' + quote;
  const projectHookBatch = 'copy_files_to_root ' + quote + '$PROJECT_HOOKS_DIR' + quote
    + ' ' + quote + '${project_hook_sources[@]}' + quote;
  const globalHooks = installer.indexOf('Installing global hooks...');
  const globalDistribution = installer.indexOf(globalHookBatch, globalHooks);
  const stateResolverCopy = installer.indexOf('tools/state-resolver/resolve.cjs');
  const scriptsReady = installer.indexOf('scripts + lib + watchdogs installed');
  const globalMergeLaunch = 'node ' + quote + '$MERGE_SCRIPT' + quote
    + ' ' + quote + '$OVERLAY_FILE' + quote + ' ' + quote + '$SETTINGS_FILE' + quote;
  const globalMerge = installer.indexOf(globalMergeLaunch, globalDistribution);
  assert.ok(globalHooks >= 0 && globalHooks < globalDistribution, 'global regular-file hook distribution is missing');
  assert.ok(stateResolverCopy >= 0 && stateResolverCopy < scriptsReady, 'state resolver is not deployed before scripts-ready boundary');
  for (const dependencyCopy of [
    'copy_tree_files ' + quote + '$SCRIPT_DIR/scripts/lib' + quote + ' ' + quote + '$CLAUDE_DIR/scripts/lib' + quote,
    'copy_tree_files ' + quote + '$SCRIPT_DIR/registry' + quote + ' ' + quote + '$CLAUDE_DIR/registry' + quote,
    'copy_tree_files ' + quote + '$SCRIPT_DIR/tools/vtp-readiness' + quote + ' ' + quote + '$CLAUDE_DIR/tools/vtp-readiness' + quote,
  ]) {
    const dependencyIndex = installer.indexOf(dependencyCopy);
    assert.ok(dependencyIndex >= 0 && dependencyIndex < globalMerge, `${dependencyCopy} is absent before global settings merge`);
  }
  // P168 replacement reason: the legacy installed-global smoke was a rejecting
  // spawn after profile writes. Candidate smoke now runs before the first writer.
  assert.doesNotMatch(
    installer,
    /node \x22\$PREFLIGHT_SCRIPT\x22 --smoke-manifest/,
    'installer retained a rejecting global hook smoke after profile publication',
  );
  const mainPrecheck = installer.lastIndexOf('  precheck_installation_refusals');
  const mainPublication = installer.lastIndexOf('  publish_project_install_contract');
  const bannerCall = installer.lastIndexOf('\nprint_banner');
  const globalDispatch = installer.lastIndexOf('\nif [ "$INSTALL_GLOBAL" = true ]');
  assert.ok(
    mainPrecheck >= 0 && mainPrecheck < mainPublication
      && mainPublication < bannerCall && bannerCall < globalDispatch,
    'sealed candidate precheck/publication does not precede global profile dispatch in required order',
  );
  assert.ok(globalMerge > globalDistribution, 'global settings merge is absent after sealed candidate smoke');

  const distributionFunction = installer.indexOf('distribute_project_hooks()');
  const contractDelegation = installer.indexOf('  publish_project_install_contract', distributionFunction);
  const codexDetectorDefinitions = installer.match(/^detect_codex_hook_entry_sources\(\) \{/gm) || [];
  const codexDetectorFunction = installer.indexOf('detect_codex_hook_entry_sources()');
  const codexDistribution = installer.indexOf('$PROJECT_DIR/super-gsd/tools/codex-hooks/$name', codexDetectorFunction);
  const codexMissingRefusal = installer.indexOf('hook_registration_missing $missing_target', codexDistribution);
  const substratePrecheckFunction = installer.indexOf('precheck_substrate_capability()');
  const combinedPrecheckFunction = installer.indexOf('precheck_installation_refusals()');
  const combinedPrecheckEnd = installer.indexOf('\n}\n', combinedPrecheckFunction);
  const combinedDetectorCall = installer.indexOf('  detect_codex_hook_entry_sources', combinedPrecheckFunction);
  const combinedCandidateCall = installer.indexOf('--prepare-candidate', combinedPrecheckFunction);
  const combinedSubstrateCall = installer.indexOf('  precheck_substrate_capability', combinedPrecheckFunction);
  // P168 replacement reason: the legacy unjournaled project copier assertions
  // are superseded by a stronger sealed-candidate delegation assertion. Keeping
  // the old batch-copy expectation would require the forbidden competing writer.
  assert.ok(
    distributionFunction >= 0 && contractDelegation > distributionFunction,
    'project hook distribution does not delegate to the transactional install contract',
  );
  assert.doesNotMatch(
    installer.slice(distributionFunction, installer.indexOf('\n}\n', distributionFunction)),
    /copy_files_to_root|\bcp\b|\bmkdir\b|chmod/,
    'project hook distribution retained a writer outside the sealed publication seam',
  );
  assert.equal(codexDetectorDefinitions.length, 1, 'Codex hook entry source detector is missing or duplicated');
  assert.ok(codexDetectorFunction >= 0 && codexDetectorFunction < codexDistribution, 'shared Codex entry detector lacks its source inventory');
  assert.ok(codexDistribution < codexMissingRefusal, 'Codex distribution refusal does not name missing targets');
  assert.ok(substratePrecheckFunction >= 0, 'installer lacks a non-mutating substrate capability pre-check');
  assert.ok(
    combinedPrecheckFunction >= 0
      && combinedPrecheckFunction < combinedDetectorCall
      && combinedDetectorCall < combinedCandidateCall
      && combinedCandidateCall < combinedSubstrateCall
      && combinedSubstrateCall < combinedPrecheckEnd,
    'combined refusal pre-check does not detect Codex, smoke the candidate, then check substrate before publication',
  );
  assert.doesNotMatch(
    installer,
    /CODEX_HOOK_DISTRIBUTION_INCOMPLETE/,
    'installer retained deferred Codex refusal state across the mutating repair boundary',
  );
  assert.doesNotMatch(installer, /register_repo_local_hooks/, 'installer retained a second repo settings merge path');
  for (const functionName of ['init_local_project()', 'update_existing()']) {
    const functionStart = installer.indexOf(functionName);
    const distributionCall = installer.indexOf('  distribute_project_hooks', functionStart);
    const repairCall = installer.indexOf('  repair_substrate_capability', functionStart);
    const codexCall = installer.indexOf('  register_codex_hooks', functionStart);
    // P168 replacement reason: the old post-distribution rejection assertion is
    // invalid once distribution consumes a pre-smoked sealed candidate. The
    // stronger assertion forbids any rejection-capable precheck after it.
    assert.ok(
      functionStart >= 0 && functionStart < distributionCall
        && distributionCall < repairCall && repairCall < codexCall,
      `${functionName} does not preserve sealed publication before repair and registration`,
    );
    assert.equal(
      installer.slice(distributionCall, repairCall).includes('precheck_substrate_capability'),
      false,
      `${functionName} performs a rejection-capable substrate precheck after publication`,
    );
  }
  const repairPaths = [
    ['install_global_assets()', '  ensure_gsd_base'],
    ['init_local_project()', '  echo'],
    ['update_existing()', '  preflight_existing_repo_local_hooks'],
  ];
  const repairCalls = installer.match(/^[ \t]+repair_substrate_capability$/gm) || [];
  assert.equal(repairCalls.length, repairPaths.length, 'installer has an unenumerated substrate repair entry point');
  for (const [functionName, firstWriterBoundary] of repairPaths) {
    const functionStart = installer.indexOf(functionName);
    const functionEnd = installer.indexOf('\n}\n', functionStart);
    const combinedPrecheckCall = installer.indexOf('  precheck_installation_refusals', functionStart);
    const firstWriter = installer.indexOf(firstWriterBoundary, functionStart);
    const repairCall = installer.indexOf('repair_substrate_capability', functionStart);
    assert.ok(
      functionStart >= 0 && functionEnd > functionStart
        && combinedPrecheckCall > functionStart && combinedPrecheckCall < firstWriter
        && firstWriter < functionEnd && repairCall > combinedPrecheckCall && repairCall < functionEnd,
      `${functionName} can reach substrate repair before the complete refusal set precedes its first writer`,
    );
  }
  assert.match(
    installer,
    /install_global_assets\(\) \{\r?\n  precheck_installation_refusals\r?\n  ensure_gsd_base/,
    'global installation does not make the combined refusal pre-check unconditional before its first writer',
  );
  assert.match(
    installer,
    /init_local_project\(\) \{\r?\n  precheck_installation_refusals\r?\n  echo/,
    'project initialization does not make the combined refusal pre-check unconditional before its first writer',
  );
  assert.match(
    installer,
    /return 0\r?\n  fi\r?\n\r?\n  precheck_installation_refusals\r?\n  preflight_existing_repo_local_hooks/,
    'project update can pass its no-project return and write before the combined refusal pre-check',
  );
  assert.doesNotMatch(
    installer,
    /\$SCRIPT_DIR\/hooks\/\x22?\*\.(?:js|cjs|sh)/,
    'hook distribution reverted to an extension-filtered glob',
  );
  assert.match(installer, /copy_files_to_root\(\)/, 'installer lost its batched regular-file copier');
  assert.match(installer, /copy_entries_to_root\(\)/, 'installer lost its batched recursive-entry copier');
  assert.doesNotMatch(installer, /copy_file \x22\$source_file\x22/, 'runtime trees reverted to per-file copies');
  assert.doesNotMatch(installer, /\$\(basename\s/, 'installer reverted to forked basename calls');
  assert.doesNotMatch(installer, /\$\(frontmatter_field\s/, 'agent filtering reverted to a per-file subshell');
  assert.match(
    installer,
    /chmod \+x \x22\$\{global_executable_targets\[@\]\}\x22/,
    'global executable bits are not applied in one batch',
  );
  // P168 replacement reason: project modes are sealed per computed row instead
  // of being chmodded by the removed unjournaled batch copier.
  assert.match(
    fs.readFileSync(path.join(SUPER_GSD_ROOT, 'scripts', 'lib', 'hook-install-contract.cjs'), 'utf8'),
    /fs\.chmodSync\(candidatePath, fs\.statSync\(required\.source_path\)\.mode\)/,
    'sealed project publication does not preserve executable source modes',
  );
}

function readGlobalDeploymentManifest() {
  const installer = fs.readFileSync(INSTALL_PATH, 'utf8');
  assertInstallerSmokeOrder(installer);
  const match = installer.match(/GLOBAL_HOOK_DEPLOYMENT_MANIFEST='([\s\S]*?)'\r?\n/);
  assert.ok(match, 'install.sh lost GLOBAL_HOOK_DEPLOYMENT_MANIFEST');
  assert.doesNotMatch(installer, /hooks\/(?:(?:\x22\*)|\*)\.js/, 'global hook deployment reverted to a flattening JS glob');
  return match[1];
}

function smokeAdapters(overrides = {}) {
  return {
    isFile: () => true,
    nodeCheck: () => ({ status: 0 }),
    shellCheck: () => ({ status: 0 }),
    ...overrides,
  };
}

function fakeSmokeChild(onInput, result, onComplete = () => {}) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = {
    end(input) {
      onInput(input);
      setImmediate(() => {
        if (result.stdout) child.stdout.emit('data', result.stdout);
        if (result.stderr) child.stderr.emit('data', result.stderr);
        onComplete();
        if (result.error) child.emit('error', result.error);
        else child.emit('close', result.status, result.signal || null);
      });
    },
  };
  return child;
}

async function assertSmokeFailures(descriptor, smokeCwd, smokeHome, smokeHookRegistrations) {
  for (const failedResult of [
    { error: Object.assign(new Error('do-not-leak-spawn'), { code: 'EPERM' }), status: null },
    { signal: 'SIGTERM', status: null, stderr: 'do-not-leak-signal' },
    { error: Object.assign(new Error('do-not-leak-timeout'), { code: 'ETIMEDOUT' }), status: null },
    { status: 1, stdout: 'do-not-leak-stdout', stderr: 'do-not-leak-stderr' },
  ]) {
    let smokeError;
    let mergeCalls = 0;
    try {
      await smokeHookRegistrations([descriptor], smokeAdapters({
        cwd: smokeCwd,
        home: smokeHome,
        spawn: () => fakeSmokeChild(() => {}, failedResult),
      }));
      mergeCalls += 1;
    } catch (error) {
      smokeError = error;
    }
    assert.ok(smokeError, 'failed hook smoke did not refuse installation');
    assert.match(smokeError.message, /hook_smoke_failed/);
    assert.ok(smokeError.message.includes(descriptor.scriptPath), 'smoke refusal omitted entry hook path');
    assert.ok(smokeError.message.includes(descriptor.hookId), 'smoke refusal omitted hook name');
    assert.equal(smokeError.message.includes('do-not-leak'), false, 'raw child output leaked into smoke refusal');
    assert.equal(smokeError.message.includes('SGSD installer dependency smoke'), false, 'smoke payload leaked into refusal');
    const observed = [failedResult.error && failedResult.error.message,
      failedResult.stdout, failedResult.stderr].filter(Boolean);
    for (const fragment of observed) {
      assert.ok(smokeError.underlyingError.message.includes(fragment),
        'bounded underlying failure omitted observed output: ' + fragment);
    }
    assert.equal(mergeCalls, 0, 'settings merge callback ran after smoke refusal');
  }

  const policyDecision = await smokeHookRegistrations([descriptor], smokeAdapters({
    cwd: smokeCwd,
    home: smokeHome,
    spawn: () => fakeSmokeChild(() => {}, {
      status: 1,
      stderr: '[validate-stop-contract] blocked: missing_report\n',
    }),
  }));
  assert.deepEqual(policyDecision, [descriptor], 'clean policy decision was mistaken for a load failure');
}

async function runSmokeStatic() {
  const {
    SMOKE_CONCURRENCY,
    SMOKE_TIMEOUT_FLOOR_MS,
    SMOKE_TIMEOUT_MS,
    enumerateHookRegistrations,
    parseHookSmokeManifest,
    preflightHookDeploymentSources,
    realizeRepoLocalHookOverlay,
    smokeHookRegistrations,
  } = require(PREFLIGHT_PATH);
  const staticRoot = path.resolve(os.tmpdir(), 'sgsd hook smoke static');
  const hooksRoot = path.join(staticRoot, 'installed hooks');
  const repoRoot = path.join(staticRoot, 'target repo');
  const smokeCwd = path.join(staticRoot, 'non-sgsd cwd');
  const smokeHome = path.join(staticRoot, 'isolated home');
  fs.mkdirSync(smokeCwd, { recursive: true });
  fs.mkdirSync(smokeHome, { recursive: true });

  const globalDescriptors = parseHookSmokeManifest(readGlobalDeploymentManifest(), hooksRoot);
  assert.equal(globalDescriptors.length, GLOBAL_SCRIPT_NAMES.length + 1, 'global manifest must contain 14 registered hooks plus one auxiliary');
  const overlay = realizeGlobalOverlayForStatic(JSON.parse(fs.readFileSync(GLOBAL_OVERLAY_PATH, 'utf8')), hooksRoot);
  const registeredDescriptors = enumerateHookRegistrations(overlay);
  assert.deepEqual(
    globalDescriptors.slice(0, -1)
      .filter((item) => item.event !== 'statusLine')
      .map((item) => [item.event, item.interpreter, path.basename(item.scriptPath), item.timeout]),
    registeredDescriptors.map((item) => [item.event, item.interpreter, path.basename(item.scriptPath), item.timeout]),
    'global event-hook deployment manifest drifted from settings-overlay.json',
  );
  assert.deepEqual(
    globalDescriptors.map((item) => path.basename(item.scriptPath)),
    [...GLOBAL_SCRIPT_NAMES, 'gsd-phase-boundary.sh'],
  );
  assert.deepEqual(globalDescriptors.at(-1), {
    event: 'PostToolUse',
    hookId: 'phase-boundary-auxiliary',
    interpreter: 'bash',
    scriptPath: path.resolve(hooksRoot, 'gsd-phase-boundary.sh'),
    timeout: 5,
  });
  assert.equal(
    globalDescriptors.some((item) => path.basename(item.scriptPath) === 'sgsd-commit-gate.cjs'),
    false,
    'Git pre-commit gate was misregistered as a global Claude event hook',
  );

  let sourceError;
  try {
    preflightHookDeploymentSources(globalDescriptors.slice(0, 2), path.join(staticRoot, 'source hooks'), {
      isFile: (sourcePath) => path.basename(sourcePath) !== path.basename(globalDescriptors[1].scriptPath),
    });
  } catch (error) {
    sourceError = error;
  }
  assert.ok(sourceError, 'missing deployment source did not refuse registration');
  assert.match(sourceError.message, /hook_registration_missing/);
  assert.ok(
    sourceError.message.includes(globalDescriptors[1].scriptPath),
    'deployment-source refusal omitted the normalized installed hook path',
  );

  const repoOverlay = realizeRepoLocalHookOverlay(
    JSON.parse(fs.readFileSync(REPO_OVERLAY_PATH, 'utf8')),
    repoRoot,
  );
  const repoDescriptors = enumerateHookRegistrations(repoOverlay);
  assert.equal(repoDescriptors.length, REPO_REGISTRATIONS.length, 'repo smoke did not realize all six overlay commands');
  assert.deepEqual(
    repoDescriptors.map((item) => [item.event, item.hookId, item.scriptPath]),
    REPO_REGISTRATIONS.map(([event, hookId, relative]) => [event, hookId, path.resolve(repoRoot, relative)]),
  );

  const descriptors = [...globalDescriptors, ...repoDescriptors];
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const passed = await smokeHookRegistrations(descriptors, smokeAdapters({
    cwd: smokeCwd,
    home: smokeHome,
    nodePath: 'fixture-node',
    bashPath: 'fixture-bash',
    spawn: (command, args, options) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      const call = { command, args, options, input: null };
      calls.push(call);
      return fakeSmokeChild((input) => {
        call.input = input;
      }, { status: 0 }, () => {
        active -= 1;
      });
    },
  }));
  assert.deepEqual(passed, descriptors);
  assert.equal(SMOKE_CONCURRENCY, 4, 'smoke concurrency drifted from the bounded four-worker contract');
  assert.equal(maxActive, SMOKE_CONCURRENCY, 'hook smoke did not exercise four-way bounded concurrency');
  assert.equal(calls.length, descriptors.length, 'a deployed descriptor was skipped or spawned twice');
  descriptors.forEach((descriptor) => {
    const call = calls.find((candidate) => candidate.args[0] === descriptor.scriptPath
      && JSON.parse(candidate.input).hook_event_name === descriptor.event);
    assert.ok(call, `hook smoke omitted ${descriptor.scriptPath}`);
    const payload = JSON.parse(call.input);
    assert.equal(call.command, descriptor.interpreter === 'node' ? 'fixture-node' : 'fixture-bash');
    assert.deepEqual(call.args, [descriptor.scriptPath, ...(descriptor.argv || [])]);
    assert.equal(call.options.shell, false);
    assert.deepEqual(call.options.stdio, ['pipe', 'pipe', 'pipe']);
    assert.equal(call.options.cwd, smokeCwd);
    assert.equal(call.options.env.HOME, smokeHome);
    assert.equal(call.options.env.USERPROFILE, smokeHome);
    const registeredBudget = descriptor.timeout === null ? SMOKE_TIMEOUT_MS : descriptor.timeout * 1000;
    assert.equal(call.options.timeout, Math.max(SMOKE_TIMEOUT_FLOOR_MS, registeredBudget));
    assert.ok(call.options.timeout >= registeredBudget, 'smoke ignored the registered timeout budget');
    assert.equal(call.input.endsWith('\n'), true, 'child stdin was not closed with a complete payload');
    const expectedPayloadKeys = [
      'cwd', 'hook_event_name', 'prompt', 'session_id',
      'tool_input', 'tool_name', 'tool_response',
    ];
    if (descriptor.matcher && descriptor.matcher.startsWith('mcp__')) {
      expectedPayloadKeys.push('tool_use_id');
    }
    assert.deepEqual(Object.keys(payload).sort(), expectedPayloadKeys.sort());
    assert.equal(payload.hook_event_name, descriptor.event);
    assert.equal(payload.cwd, smokeCwd);
    assert.equal(payload.session_id, 'sgsd-installer-hook-smoke');
    assert.equal(payload.prompt, 'SGSD installer dependency smoke');
    const expectedTool = descriptor.matcher && descriptor.matcher !== '*'
      ? descriptor.matcher.split('|')[0]
      : 'Read';
    assert.equal(payload.tool_name, expectedTool);
    if (expectedTool.startsWith('mcp__')) {
      assert.equal(payload.tool_use_id, 'sgsd-installer-hook-smoke-tool');
      assert.equal(payload.tool_input.schema_version, 'vtp-mcp-input-schemas.v2');
      assert.deepEqual(JSON.parse(payload.tool_response.content[0].text), { hits: [] });
    } else {
      assert.deepEqual(payload.tool_input, { file_path: 'sgsd-hook-smoke.txt' });
      assert.deepEqual(payload.tool_response, { ok: true });
    }
  });

  await assertSmokeFailures(repoDescriptors[0], smokeCwd, smokeHome, smokeHookRegistrations);
}

function runVendoredNineHook() {
  const fixture = createFixture('vendored-nine');
  try {
    retainClarityNine(fixture.vendoredRoot);
    const before = seedTarget(fixture.repoSettings, 'vendored-nine-hook');
    const request = 'hooks/gsd-phase-boundary.sh';
    const result = runInstaller(fixture, ['--init-project', '--skip-cockpit-deps']);
    assertModuleNotFoundRefused(result, fixture.repoSettings, before, {
      request,
      path: path.join(fixture.vendoredRoot, request),
    });
    const settings = JSON.parse(readBytes(fixture.repoSettings).toString('utf8'));
    for (const [event, hookId] of REPO_REGISTRATIONS) {
      assert.equal(countManagedHook(settings, event, hookId), 0, `${hookId} was partially registered`);
    }
  } finally {
    removeFixture(fixture);
  }
}

function runFailureDirection(label, site, failure) {
  const fixture = createFixture(`${site}-${failure}`);
  try {
    const global = site === 'global';
    const sourcePath = global
      ? path.join(fixture.vendoredRoot, 'hooks', 'sgsd-heartbeat.js')
      : path.join(fixture.vendoredRoot, 'hooks', 'sgsd-quality-gate.js');
    if (failure === 'missing') fs.rmSync(sourcePath);
    else fs.writeFileSync(sourcePath, 'const = invalid javascript;\n', 'utf8');
    const targetPath = global ? fixture.globalSettings : fixture.repoSettings;
    const before = seedTarget(targetPath, label);
    const args = global
      ? ['--install-global']
      : ['--init-project', '--skip-cockpit-deps'];
    if (failure === 'missing') {
      const request = global ? 'hooks/sgsd-heartbeat.js' : 'hooks/sgsd-quality-gate.js';
      const result = runInstaller(fixture, args, BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS);
      assertModuleNotFoundRefused(result, targetPath, before, {
        request,
        path: sourcePath,
      });
      return;
    }

    // P168 candidate preparation still invokes this node check, but its CLI
    // currently drops HookRegistrationPreflightError artifact details. Preserve
    // exact two-site syntax coverage here instead of accepting a generic refusal.
    const {
      HookRegistrationPreflightError,
      preflightHookDescriptors,
    } = require(PREFLIGHT_PATH);
    let refusal;
    try {
      preflightHookDescriptors([{
        event: 'PostToolUse',
        hookId: label,
        interpreter: 'node',
        scriptPath: sourcePath,
      }]);
    } catch (error) {
      refusal = error;
    }
    assert.ok(refusal instanceof HookRegistrationPreflightError, site + ' invalid source did not refuse node check');
    assert.deepEqual(refusal.issues, [{
      code: 'hook_registration_node_check_failed',
      event: 'PostToolUse',
      hookId: label,
      scriptPath: sourcePath,
    }]);
    const after = readBytes(targetPath);
    assert.equal(sha256(after), before.hash, 'node check changed settings hash at ' + targetPath);
    assert.deepEqual(after, before.bytes, 'node check changed settings bytes at ' + targetPath);
    assert.equal(fs.existsSync(targetPath + '.tmp'), false, 'node check left temporary settings at ' + targetPath);
  } finally {
    removeFixture(fixture);
  }
}

function runNodeCheckBothSites() {
  runFailureDirection('global-missing-source', 'global', 'missing');
  runFailureDirection('global-invalid-source', 'global', 'invalid');
  runFailureDirection('repo-missing-source', 'repo', 'missing');
  runFailureDirection('repo-invalid-source', 'repo', 'invalid');
}

function assertGlobalSettings(fixture) {
  const {
    enumerateGlobalManifestCoverage,
    enumerateHookRegistrations,
    preflightHookDescriptors,
  } = require(PREFLIGHT_PATH);
  const globalSettings = JSON.parse(readBytes(fixture.globalSettings).toString('utf8'));
  assert.equal(globalSettings.unrelatedProjectKey.survives, true);

  const manifestDescriptors = enumerateHookRegistrations(realizeGlobalOverlayForStatic(
    JSON.parse(fs.readFileSync(GLOBAL_OVERLAY_PATH, 'utf8')),
    path.join(fixture.homeRoot, '.claude', 'hooks'),
  ));
  const globalDescriptors = enumerateGlobalManifestCoverage(globalSettings, manifestDescriptors);
  preflightHookDescriptors(globalDescriptors);
  const globalEventScriptNames = GLOBAL_SCRIPT_NAMES.filter((name) => name !== 'sgsd-statusline.js');
  assert.equal(globalDescriptors.length, globalEventScriptNames.length);
  assert.equal(globalSettings.statusLine && globalSettings.statusLine.type, 'command');
  assert.equal(globalDescriptors.some((item) => item.event === 'statusLine'), false);
  for (const name of globalEventScriptNames) {
    assert.equal(globalDescriptors.filter((item) => path.basename(item.scriptPath) === name).length, 1, `${name} is missing or duplicated globally`);
  }
}

function assertRepoSettings(fixture) {
  const {
    enumerateProjectManagedHookRegistrations,
    preflightHookDescriptors,
  } = require(PREFLIGHT_PATH);
  const repoSettings = JSON.parse(readBytes(fixture.repoSettings).toString('utf8'));
  assert.equal(repoSettings.unrelatedProjectKey.survives, true);

  const repoDescriptors = enumerateProjectManagedHookRegistrations(repoSettings);
  assert.equal(repoDescriptors.length, REPO_REGISTRATIONS.length);
  preflightHookDescriptors(repoDescriptors);
  for (const [event, hookId, relative] of REPO_REGISTRATIONS) {
    assert.equal(countManagedHook(repoSettings, event, hookId), 1, `${hookId} is missing or duplicated repo-locally`);
    assert.ok(repoDescriptors.some((item) => item.event === event
      && item.hookId === hookId
      && item.scriptPath === path.resolve(fixture.projectRoot, relative)), `${hookId} did not realize to its target repository`);
  }
}

function assertCanonicalSettings(fixture) {
  assertGlobalSettings(fixture);
  assertRepoSettings(fixture);
}

function runHookDistributionAllTypes() {
  assert.deepEqual(
    hookFiles(path.join(SUPER_GSD_ROOT, 'hooks')),
    [...SHIPPED_HOOK_NAMES],
    'source hook inventory drifted from the locked basenames',
  );
  const codexEntryNames = configuredCodexEntryNames();
  assert.deepEqual(
    codexEntryNames,
    [...EXPECTED_CODEX_ENTRY_NAMES],
    'config/codex-hooks.json no longer resolves to the locked five entries',
  );

  const fixture = createDistributionFixture('all-hook-types');
  try {
    for (const target of [fixture.projectRoot, fixture.homeRoot]) {
      const relativeSource = path.relative(target, fixture.vendoredRoot);
      assert.ok(
        relativeSource === '..' || relativeSource.startsWith(`..${path.sep}`),
        'source checkout is nested under a deployment target',
      );
    }
    const sourceHooksRoot = path.join(fixture.vendoredRoot, 'hooks');
    assertUndistributedProjectRefusesFour(fixture.projectRoot);
    assertLegacyHookGlobIsRejected(sourceHooksRoot, fixture.root);
    seedTarget(fixture.globalSettings, 'distribution-global');
    seedTarget(fixture.repoSettings, 'distribution-repo');
    boundGlobalSmokeFixture(fixture, ['sgsd-heartbeat.js']);

    const args = ['--install-global', '--init-project', '--skip-cockpit-deps'];
    const first = runInstaller(fixture, args, BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS);
    if (first.error) throw first.error;
    assert.equal(first.status, 0, `all-types install failed:\n${first.stderr}\n${first.stdout}`);

    assertNamedFilesMatch(
      sourceHooksRoot,
      path.join(fixture.homeRoot, '.claude', 'hooks'),
      SHIPPED_HOOK_NAMES,
      'global',
    );
    assertNamedFilesMatch(
      sourceHooksRoot,
      path.join(fixture.projectRoot, 'super-gsd', 'hooks'),
      SHIPPED_HOOK_NAMES,
      'repo-local',
    );
    assertNamedFilesMatch(
      path.join(fixture.vendoredRoot, 'tools', 'codex-hooks'),
      path.join(fixture.projectRoot, 'super-gsd', 'tools', 'codex-hooks'),
      codexEntryNames,
      'Codex project entries',
    );
    for (const [sourceRelative, targetRelative] of [
      [path.join('scripts', 'lib'), path.join('scripts', 'lib')],
      ['registry', 'registry'],
      [path.join('tools', 'vtp-readiness'), path.join('tools', 'vtp-readiness')],
    ]) {
      assertTreeMatches(
        path.join(fixture.vendoredRoot, sourceRelative),
        path.join(fixture.homeRoot, '.claude', targetRelative),
        `global hook runtime ${sourceRelative}`,
      );
    }
    assert.deepEqual(
      readBytes(fixture.systemdSentinel),
      Buffer.from('operator-owned-systemd-sentinel\n'),
      'repo distribution removed or changed systemd/',
    );
    assertCanonicalSettings(fixture);
  } finally {
    removeFixture(fixture);
  }
}

function runDeployedHookSmoke() {
  const fixture = createDistributionFixture('deployed-hook-smoke');
  try {
    seedTarget(fixture.globalSettings, 'smoke-global');
    seedTarget(fixture.repoSettings, 'smoke-repo');
    boundGlobalSmokeFixture(fixture, ['sgsd-intent-classifier.cjs']);
    const healthyArgs = ['--install-global', '--init-project', '--skip-cockpit-deps'];
    const healthy = runInstaller(fixture, healthyArgs, BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS);
    if (healthy.error) throw healthy.error;
    assert.equal(
      healthy.status,
      0,
      'healthy deployed hook smoke failed:\n' + healthy.stderr + '\n' + healthy.stdout,
    );
    assertRepoSettings(fixture);

    const beforeGlobal = { bytes: readBytes(fixture.globalSettings) };
    beforeGlobal.hash = sha256(beforeGlobal.bytes);
    const beforeRepo = { bytes: readBytes(fixture.repoSettings) };
    beforeRepo.hash = sha256(beforeRepo.bytes);
    const dependencyRelative = path.join('scripts', 'lib', 'skill-routing-registry.cjs');
    const sourceDependencyPath = path.join(fixture.vendoredRoot, dependencyRelative);
    const targetDependencyPath = path.join(fixture.projectRoot, 'super-gsd', dependencyRelative);
    const sourceEntryPath = path.join(fixture.vendoredRoot, 'hooks', 'sgsd-intent-classifier.cjs');
    const targetEntryPath = path.join(fixture.projectRoot, 'super-gsd', 'hooks', 'sgsd-intent-classifier.cjs');
    fs.rmSync(sourceDependencyPath);
    fs.rmSync(targetDependencyPath);
    fs.rmSync(targetEntryPath);
    assert.equal(fs.existsSync(sourceEntryPath), true, 'dependency break removed the source entry hook');
    assert.equal(fs.existsSync(targetEntryPath), false, 'recovery entry still existed before distribution');

    const syntax = spawnSync(process.execPath, ['--check', sourceEntryPath], {
      encoding: 'utf8',
      shell: false,
      timeout: 5_000,
      windowsHide: true,
    });
    if (syntax.error) throw syntax.error;
    assert.equal(syntax.status, 0, 'entry hook stopped being node --check-clean: ' + syntax.stderr);

    const loadRoot = path.join(fixture.root, 'non-sgsd-load-root');
    fs.mkdirSync(loadRoot, { recursive: true });
    const load = spawnSync(process.execPath, [sourceEntryPath], {
      cwd: loadRoot,
      env: {
        ...process.env,
        HOME: fixture.homeRoot,
        USERPROFILE: fixture.homeRoot,
        APPDATA: path.join(fixture.homeRoot, 'AppData', 'Roaming'),
        XDG_CONFIG_HOME: path.join(fixture.homeRoot, '.config'),
      },
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: loadRoot }) + '\n',
      encoding: 'utf8',
      shell: false,
      timeout: 5_000,
      windowsHide: true,
    });
    if (load.error) throw load.error;
    assert.notEqual(load.status, 0, 'missing sibling dependency still loaded');
    assert.match(load.stderr, /MODULE_NOT_FOUND/, 'broken fixture did not prove the real load error');

    const refused = runInstaller(fixture, ['--update', '--skip-cockpit-deps']);
    assertModuleNotFoundRefused(refused, fixture.repoSettings, beforeRepo, {
      request: '../scripts/lib/skill-routing-registry.cjs',
      path: sourceDependencyPath,
      messageFragments: [
        'hooks/sgsd-intent-classifier.cjs',
        '../scripts/lib/skill-routing-registry.cjs',
      ],
    });
    const output = (refused.stderr || '') + '\n' + (refused.stdout || '');
    assert.equal(output.includes('Require stack:'), false, 'unbounded installed-hook stack leaked from refusal');
    assert.deepEqual(readBytes(fixture.globalSettings), beforeGlobal.bytes, 'global settings changed during broken reinstall');
    assert.equal(sha256(readBytes(fixture.globalSettings)), beforeGlobal.hash, 'global settings hash changed during broken reinstall');
    assert.equal(fs.existsSync(fixture.globalSettings + '.tmp'), false, 'global settings temp artifact remains');
  } finally {
    removeFixture(fixture);
  }
}

function commitClarityUpdateSource(seedRoot, missingRows) {
  const seedSuperGsd = copyFixtureSupport(seedRoot, { provisionPackages: false });
  assert.deepEqual(
    fs.readFileSync(path.join(seedSuperGsd, 'scripts', 'sgsd-update.sh')),
    fs.readFileSync(UPDATE_PATH),
    'fixture updater is not the real production script',
  );
  removeBrokenGlobalCoverage(seedRoot, [
    'sgsd-session-start.js',
    'sgsd-intent-classifier.cjs',
    'sgsd-quality-gate.js',
  ]);
  for (const relative of new Set(missingRows.map(([, , item]) => item))) {
    fs.rmSync(path.join(seedRoot, relative));
  }
  fs.chmodSync(path.join(seedSuperGsd, 'install.sh'), 0o755);
  fs.chmodSync(path.join(seedSuperGsd, 'scripts', 'sgsd-update.sh'), 0o755);

  runFixtureGit(['init', '--initial-branch=master'], seedRoot, 'initialize upstream seed');
  runFixtureGit(['config', 'user.name', 'SGSD fixture'], seedRoot, 'configure fixture author');
  runFixtureGit(['config', 'user.email', 'sgsd-fixture@example.invalid'], seedRoot, 'configure fixture email');
  runFixtureGit(['config', 'commit.gpgsign', 'false'], seedRoot, 'disable fixture signing');
  runFixtureGit(['config', 'core.autocrlf', 'false'], seedRoot, 'disable fixture autocrlf');
  runFixtureGit(['add', '.'], seedRoot, 'stage broken source');
  runFixtureGit(['commit', '-m', 'broken hook distribution control'], seedRoot, 'commit broken source');
  const oldSha = runFixtureGit(['rev-parse', 'HEAD'], seedRoot, 'resolve broken source SHA');

  for (const relative of [
    'install.sh',
    path.join('config', 'settings-overlay.json'),
    path.join('hooks', 'sgsd-session-start.js'),
    path.join('hooks', 'sgsd-intent-classifier.cjs'),
    path.join('hooks', 'sgsd-quality-gate.js'),
    path.join('hooks', 'sgsd-substrate-invocation-witness.cjs'),
    path.join('tools', 'codex-hooks', 'block-secret-leak.cjs'),
  ]) {
    const target = path.join(seedSuperGsd, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(SUPER_GSD_ROOT, relative), target);
  }
  fs.chmodSync(path.join(seedSuperGsd, 'install.sh'), 0o755);
  runFixtureGit(['add', '.'], seedRoot, 'stage repaired source');
  runFixtureGit(['commit', '-m', 'post-T2 production source'], seedRoot, 'commit repaired source');
  const fixedSha = runFixtureGit(['rev-parse', 'HEAD'], seedRoot, 'resolve repaired source SHA');
  assert.match(oldSha, /^[0-9a-f]{40}$/);
  assert.match(fixedSha, /^[0-9a-f]{40}$/);
  assert.notEqual(fixedSha, oldSha, 'two-commit upstream collapsed to one SHA');
  return { fixedSha, oldSha };
}

function writeClarityGitSshRouter(sshRouterPath) {
  fs.writeFileSync(sshRouterPath, [
    '#!/usr/bin/env bash',
    'set -eu',
    'remote_command=${*: -1}',
    'printf \'%s\\n\' $remote_command >> $SGSD_TEST_SSH_LOG',
    'case $remote_command in',
    '  *Berrowj/super-gsd.git*) ;;',
    '  *) printf \'unexpected fixture SSH command\\n\' >&2; exit 97 ;;',
    'esac',
    'exec git-upload-pack $SGSD_TEST_BARE_REPO',
    '',
  ].join('\n'), 'utf8');
  fs.chmodSync(sshRouterPath, 0o755);
}

function createClarityUpdateGitFixture(fixtureRoot, missingRows) {
  const seedRoot = path.join(fixtureRoot, 'upstream seed');
  const bareRoot = path.join(fixtureRoot, 'upstream.git');
  const sourceRoot = path.join(fixtureRoot, 'canonical source');
  const sshRouterPath = path.join(fixtureRoot, 'fixture-git-ssh.sh');
  const sshLogPath = path.join(fixtureRoot, 'fixture-git-ssh.log');
  const canonicalOrigin = 'git@github.com:Berrowj/super-gsd.git';
  fs.mkdirSync(seedRoot, { recursive: true });
  const { fixedSha, oldSha } = commitClarityUpdateSource(seedRoot, missingRows);
  runFixtureGit(['clone', '--bare', seedRoot, bareRoot], fixtureRoot, 'create bare upstream');
  runFixtureGit(['--git-dir', bareRoot, 'update-ref', 'refs/heads/master', oldSha], fixtureRoot, 'pin bare upstream to broken SHA');
  runFixtureGit(['clone', bareRoot, sourceRoot], fixtureRoot, 'clone canonical source at broken SHA');
  const sourcePackageLinks = provisionFixtureSourcePackages(path.join(sourceRoot, 'super-gsd'));
  fs.appendFileSync(
    path.join(sourceRoot, '.git', 'info', 'exclude'),
    sourcePackageLinks.map((row) => (
      `/${path.relative(sourceRoot, row.fixture_path).replace(/\\/g, '/')}`
    )).join('\n') + '\n',
  );
  runFixtureGit(['remote', 'set-url', 'origin', canonicalOrigin], sourceRoot, 'set canonical stored origin');
  assert.equal(
    runFixtureGit(['remote', 'get-url', 'origin'], sourceRoot, 'read canonical stored origin'),
    canonicalOrigin,
  );
  assert.equal(runFixtureGit(['rev-parse', 'HEAD'], sourceRoot, 'read initial source HEAD'), oldSha);
  writeClarityGitSshRouter(sshRouterPath);
  return { bareRoot, fixedSha, oldSha, sourceRoot, sshLogPath, sshRouterPath };
}

function seedClarityUpdateProject(fixtureRoot, oldSha) {
  const projectRoot = path.join(fixtureRoot, 'clarity project');
  const homeRoot = path.join(fixtureRoot, 'isolated home');
  const projectMcpPath = path.join(projectRoot, '.mcp.json');
  const repoSettingsPath = path.join(projectRoot, '.claude', 'settings.json');
  const globalSettingsPath = path.join(homeRoot, '.claude', 'settings.json');
  const projectPinPath = path.join(projectRoot, '.super-gsd-version');
  const systemdSentinel = path.join(projectRoot, 'super-gsd', 'hooks', 'systemd', 'operator-owned');
  fs.mkdirSync(path.join(homeRoot, '.claude'), { recursive: true });
  fs.mkdirSync(path.dirname(systemdSentinel), { recursive: true });
  fs.writeFileSync(systemdSentinel, 'operator-owned-systemd-sentinel\n', 'utf8');
  fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
  fs.writeFileSync(projectPinPath, oldSha + '\n', 'utf8');

  const upstreamDefinition = {
    command: 'node',
    args: [path.join(projectRoot, 'VTP upstream with spaces', 'server.cjs'), '--stdio'],
    env: { CLARITY_FIXTURE: 'preserved-private-upstream' },
  };
  writeJson(projectMcpPath, {
    unrelatedMcpKey: { survives: true },
    mcpServers: { 'vtp-kb': upstreamDefinition },
  });

  for (const relative of [
    path.join('scripts', 'lib'),
    'registry',
    path.join('tools', 'vtp-readiness'),
  ]) {
    const target = path.join(projectRoot, 'super-gsd', relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(path.join(SUPER_GSD_ROOT, relative), target, { recursive: true });
  }
  provisionFixtureSourcePackages(path.join(projectRoot, 'super-gsd'));
  const { realizeRepoLocalHookOverlay } = require(PREFLIGHT_PATH);
  const realizedOverlay = realizeRepoLocalHookOverlay(
    JSON.parse(fs.readFileSync(REPO_OVERLAY_PATH, 'utf8')),
    projectRoot,
  );
  const historicalIds = new Set(CLARITY_HISTORICAL_IDS);
  const originalManagedRows = [];
  const globalSettings = sentinelSettings('sgsd-update-clarity-recovery-global');
  writeJson(globalSettingsPath, globalSettings);
  const claritySettings = sentinelSettings('sgsd-update-clarity-recovery');
  for (const [event, entries] of Object.entries(realizedOverlay.hooks)) {
    for (const entry of entries) {
      if (!historicalIds.has(entry.sgsd_hook_id)) continue;
      const original = deepClone(entry);
      originalManagedRows.push([event, original]);
      if (!claritySettings.hooks[event]) claritySettings.hooks[event] = [];
      claritySettings.hooks[event].push(deepClone(original));
    }
  }
  assert.equal(originalManagedRows.length, 3, 'fixture did not seed exactly three historical managed rows');
  writeJson(repoSettingsPath, claritySettings);
  assert.deepEqual(
    relativeFiles(path.join(projectRoot, 'super-gsd', 'hooks')),
    [path.join('systemd', 'operator-owned')],
  );
  return {
    globalSettingsPath,
    homeRoot,
    globalOperatorRowsBefore: operatorRowsBytes(globalSettings),
    originalManagedRows,
    projectOperatorRowsBefore: operatorRowsBytes(claritySettings),
    projectMcpPath,
    projectPinPath,
    projectRoot,
    repoSettingsPath,
    settingsBeforeBroken: readBytes(repoSettingsPath),
    mcpBeforeBroken: readBytes(projectMcpPath),
    systemdSentinel,
    upstreamDefinition,
    witnessEnv: {
      HOME: homeRoot,
      USERPROFILE: homeRoot,
      APPDATA: path.join(homeRoot, 'AppData', 'Roaming'),
      XDG_CONFIG_HOME: path.join(homeRoot, '.config'),
    },
  };
}

function assertBrokenClarityUpdate(result, project, sourceRoot, oldSha) {
  if (result.error) throw result.error;
  const output = (result.stderr || '') + '\n' + (result.stdout || '');
  assert.equal(result.status, 5, 'broken updater control did not exit 5:\n' + output);
  assert.equal(output.includes('hook_registration_launch_invalid'), false, 'operator row entered broken-run validation:\n' + output);
  assert.equal(output.includes('operator-pathological'), false, 'operator sentinel was mentioned by broken run:\n' + output);
  assert.equal(output.includes('operator garbage command'), false, 'pathological operator command was mentioned by broken run:\n' + output);
  const missingRequest = 'hooks/sgsd-intent-classifier.cjs';
  assertModuleNotFoundPayload(output, {
    request: missingRequest,
    path: path.join(sourceRoot, 'super-gsd', missingRequest),
  });
  assert.deepEqual(
    readBytes(project.repoSettingsPath),
    project.settingsBeforeBroken,
    'broken updater changed project settings bytes',
  );
  assert.deepEqual(
    readBytes(project.projectMcpPath),
    project.mcpBeforeBroken,
    'broken updater changed the direct Clarity upstream before refusal',
  );
  assert.equal(
    fs.readFileSync(project.projectPinPath, 'utf8'),
    oldSha + '\n',
    'broken updater advanced the project pin',
  );
  assert.equal(runFixtureGit(['rev-parse', 'HEAD'], sourceRoot, 'read broken-run source HEAD'), oldSha);
  assert.deepEqual(
    operatorRowsBytes(JSON.parse(fs.readFileSync(project.globalSettingsPath, 'utf8'))),
    project.globalOperatorRowsBefore,
    'broken updater changed global operator rows',
  );
  assertNoUpdaterTemp(project.projectRoot, project.repoSettingsPath);
}

function assertUncoveredProjectRowsRefuse(project) {
  const {
    HookRegistrationPreflightError,
    preflightProjectManagedRegistrations,
  } = require(PREFLIGHT_PATH);
  let outcome;
  let didThrow = false;
  try {
    outcome = preflightProjectManagedRegistrations(
      JSON.parse(fs.readFileSync(project.repoSettingsPath, 'utf8')),
      fs.existsSync(project.globalSettingsPath)
        ? JSON.parse(fs.readFileSync(project.globalSettingsPath, 'utf8'))
        : {},
    );
  } catch (error) {
    didThrow = true;
    outcome = error;
  }
  const issueCodes = didThrow && Array.isArray(outcome && outcome.issues)
    ? outcome.issues.map((issue) => issue && issue.code)
    : [];
  const warningCodes = !didThrow && Array.isArray(outcome && outcome.warnings)
    ? outcome.warnings.map((warning) => warning && warning.code)
    : [];
  const outcomeDetail = didThrow
    ? 'threw=' + (outcome && outcome.constructor ? outcome.constructor.name : typeof outcome)
      + ' issue_codes=' + JSON.stringify(issueCodes)
      + ' issues_length=' + issueCodes.length
    : 'returned warning_codes=' + JSON.stringify(warningCodes);
  assert.ok(
    didThrow
      && outcome instanceof HookRegistrationPreflightError
      && issueCodes.length === 3
      && issueCodes.every((code) => code === 'hook_registration_missing'),
    'dead managed project rows without live global coverage did not refuse: ' + outcomeDetail,
  );
  const unmanagedSettings = sentinelSettings('sgsd-update-unmanaged-only');
  unmanagedSettings.hooks.PostToolUse = [{
    hooks: [{
      type: 'command',
      command: 'node',
      args: [path.join(project.projectRoot, 'unmanaged-dead.js')],
    }],
  }];
  const unmanagedOutcome = preflightProjectManagedRegistrations(unmanagedSettings, sentinelSettings('global-unmanaged-only'));
  assert.deepEqual(unmanagedOutcome.warnings, [], 'unmanaged project entry entered the managed downgrade path');
  assert.deepEqual(unmanagedOutcome.descriptors, [], 'unmanaged project entry was enumerated');
  assert.equal(Object.prototype.hasOwnProperty.call(unmanagedOutcome, 'globalIssues'), false, 'operator diagnostics leaked from coverage lookup');
}

function assertRepairedClarityUpdate(result, project, sourceRoot, fixedSha) {
  if (result.error) throw result.error;
  const output = (result.stderr || '') + '\n' + (result.stdout || '');
  assert.equal(result.status, 0, 'repaired updater failed:\n' + output);
  assert.equal(output.includes('hook_registration_launch_invalid'), false, 'operator row entered repaired-run validation:\n' + output);
  assert.equal(output.includes('operator-pathological'), false, 'operator sentinel was mentioned by repaired run:\n' + output);
  assert.equal(output.includes('operator garbage command'), false, 'pathological operator command was mentioned by repaired run:\n' + output);
  assert.ok(output.includes('source_sha=' + fixedSha), 'repaired updater omitted fetched source SHA');
  assert.ok(output.includes('project_pin=' + fixedSha), 'repaired updater omitted advanced project pin');
  assert.equal(
    fs.readFileSync(project.projectPinPath, 'utf8'),
    fixedSha + '\n',
    'project pin did not advance to fetched SHA',
  );
  assert.equal(runFixtureGit(['rev-parse', 'FETCH_HEAD'], sourceRoot, 'read fetched SHA'), fixedSha);
  assert.equal(runFixtureGit(['rev-parse', 'HEAD'], sourceRoot, 'read repaired source HEAD'), fixedSha);

  const capabilityReports = output.split(/\r?\n/).flatMap((line) => {
    try {
      const report = JSON.parse(line.trim());
      return report && Object.prototype.hasOwnProperty.call(report, 'capability_status') ? [report] : [];
    } catch (_) {
      return [];
    }
  });
  assert.ok(capabilityReports.length > 0, 'repaired updater omitted its capability result:\n' + output);
  const capability = capabilityReports.at(-1);
  assert.equal(capability.ok, true, 'repaired updater did not approve the provisioned Clarity upstream');
  assert.equal(capability.witness_status, 'current');
  assert.equal(capability.capability_status, 'current');
  assert.deepEqual(capability.reasons, []);
  assert.equal(capability.substrate_granted, true);

  const warningLines = output.split(/\r?\n/)
    .filter((line) => line.includes('WARN project_hook_registration_missing_global_covered'));
  assert.equal(warningLines.length, 0, 'transactionally healed project hooks were still reported missing:\n' + output);
  const historicalIds = new Set(CLARITY_HISTORICAL_IDS);
  for (const [event, hookId, relative] of REPO_REGISTRATIONS.filter(([, id]) => historicalIds.has(id))) {
    const expectedPath = path.resolve(project.projectRoot, relative);
    assert.ok(
      fs.statSync(expectedPath).isFile(),
      `transactional recovery did not heal ${expectedPath} [${event}/${hookId}]`,
    );
  }
  assert.equal(
    warningLines.some((line) => line.includes('user-prompt-secret-leak-guard')),
    false,
    'new secret-leak registration was incorrectly reported as a stale project row',
  );

  const brokeredMcp = JSON.parse(fs.readFileSync(project.projectMcpPath, 'utf8'));
  assert.equal(brokeredMcp.unrelatedMcpKey.survives, true, 'Clarity MCP sentinel was removed');
  assert.equal(brokeredMcp.mcpServers['vtp-kb'].command, 'node');
  assert.equal(
    path.basename(brokeredMcp.mcpServers['vtp-kb'].args[0]),
    'substrate-capability-broker.cjs',
    'Clarity upstream was not replaced by the SGSD broker',
  );
  const witnessStore = require(WITNESS_STORE_PATH);
  const upstreamManifest = JSON.parse(fs.readFileSync(
    witnessStore.resolveWitnessPaths(project.projectRoot, project.witnessEnv).upstream_manifest_path,
    'utf8',
  ));
  assert.equal(upstreamManifest.active_scope, 'project');
  assert.deepEqual(upstreamManifest.servers.project.definition, project.upstreamDefinition);

  const {
    enumerateGlobalManifestCoverage,
    enumerateHookRegistrations,
    enumerateProjectManagedHookRegistrations,
    preflightHookDescriptors,
  } = require(PREFLIGHT_PATH);
  const globalSettings = JSON.parse(fs.readFileSync(project.globalSettingsPath, 'utf8'));
  const manifestDescriptors = enumerateHookRegistrations(realizeGlobalOverlayForStatic(
    JSON.parse(fs.readFileSync(GLOBAL_OVERLAY_PATH, 'utf8')),
    path.join(project.homeRoot, '.claude', 'hooks'),
  ));
  const globalDescriptors = enumerateGlobalManifestCoverage(globalSettings, manifestDescriptors);
  preflightHookDescriptors(globalDescriptors);
  const globalEventScriptNames = GLOBAL_SCRIPT_NAMES.filter((name) => name !== 'sgsd-statusline.js');
  assert.equal(globalDescriptors.length, globalEventScriptNames.length, 'global event-hook coverage is incomplete after update');
  assert.equal(globalSettings.statusLine && globalSettings.statusLine.type, 'command');
  assert.equal(globalDescriptors.some((descriptor) => descriptor.event === 'statusLine'), false);
  assert.equal(
    new Set(globalDescriptors.map((descriptor) => [
      descriptor.event,
      path.basename(descriptor.scriptPath),
    ].join('|'))).size,
    globalDescriptors.length,
    'global registrations are duplicated',
  );

  const repairedSettings = JSON.parse(fs.readFileSync(project.repoSettingsPath, 'utf8'));
  assert.equal(repairedSettings.unrelatedProjectKey.survives, true, 'unrelated settings sentinel was removed');
  assert.deepEqual(operatorRowsBytes(globalSettings), project.globalOperatorRowsBefore, 'global operator rows changed during recovery');
  assert.deepEqual(operatorRowsBytes(repairedSettings), project.projectOperatorRowsBefore, 'project operator rows changed during recovery');
  for (const [event, original] of project.originalManagedRows) {
    const survivors = repairedSettings.hooks[event].filter(
      (entry) => entry.sgsd_managed === true && entry.sgsd_hook_id === original.sgsd_hook_id,
    );
    assert.equal(survivors.length, 1, original.sgsd_hook_id + ' is missing or duplicated');
    assert.deepEqual(survivors[0], original, original.sgsd_hook_id + ' was changed instead of preserved');
  }
  for (const [event, hookId] of REPO_REGISTRATIONS) {
    assert.equal(countManagedHook(repairedSettings, event, hookId), 1, hookId + ' is not uniquely registered');
  }
  assert.equal(enumerateProjectManagedHookRegistrations(repairedSettings).length, REPO_REGISTRATIONS.length);
  assert.deepEqual(readBytes(project.systemdSentinel), Buffer.from('operator-owned-systemd-sentinel\n'));
  assertNoUpdaterTemp(project.projectRoot, project.repoSettingsPath);
}

function assertClarityRecoveryRunbook() {
  const skill = fs.readFileSync(UPDATE_SKILL_PATH, 'utf8');
  const orderedFragments = [
    'Back up `.claude/settings.json`',
    'prove `source_sha` and `project_pin`',
    'live global file plus registration coverage',
    'Remove only reviewed obsolete `sgsd_managed` rows',
    'Validate the edited settings as JSON',
    'Start a fresh client',
    'Verify hook evidence',
  ];
  let previous = -1;
  for (const fragment of orderedFragments) {
    const index = skill.indexOf(fragment);
    assert.ok(index > previous, 'sgsd-update cleanup order missing or out of order: ' + fragment);
    previous = index;
  }
  assert.match(
    skill,
    /sgsd-update never (?:performs|automates) deletion/i,
    'sgsd-update skill does not state its no-deletion boundary',
  );
  assert.match(
    skill,
    /remove the dead per-project entries only once global registration is confirmed live, otherwise the project is left with no coverage at all/i,
    '2026-08-13 report ordering is not preserved verbatim',
  );
}

function runBrokeredSubstrateCapability() {
  const overlay = JSON.parse(fs.readFileSync(REPO_OVERLAY_PATH, 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(HOOK_MANIFEST_PATH, 'utf8'));
  const sourcePath = path.join(SUPER_GSD_ROOT, 'hooks', 'sgsd-substrate-invocation-witness.cjs');
  const sourceDigest = sha256(readBytes(sourcePath));
  const matcher = ['mcp__vtp-kb__vtp', 'search', 'substrate'].join('_');
  const expected = [
    ['PreToolUse', 'pre-tool-use-substrate-invocation-witness'],
    ['PostToolUse', 'post-tool-use-substrate-invocation-witness'],
  ];
  for (const [event, hookId] of expected) {
    const rows = (overlay.hooks[event] || []).filter((entry) => entry.sgsd_hook_id === hookId);
    assert.equal(rows.length, 1, `${event} witness registration is missing or duplicated`);
    assert.equal(rows[0].sgsd_managed, true);
    assert.equal(rows[0].matcher, matcher);
    assert.equal(rows[0].sgsd_source_sha256, sourceDigest);
    assert.deepEqual(rows[0].hooks[0].args, [
      'super-gsd/hooks/sgsd-substrate-invocation-witness.cjs', '--event', event,
    ]);
    assert.equal(rows[0].hooks[0].timeout, 5);
  }
  const manifestEntry = manifest.entries.find((entry) => entry.source_path === 'hooks/sgsd-substrate-invocation-witness.cjs');
  assert.ok(manifestEntry, 'witness source is absent from hook manifest');
  assert.equal(manifestEntry.dispositions.filter((row) => row.kind === 'registered').length, 2);
  assert.equal(manifestEntry.dispositions.filter((row) => row.kind === 'intentionally_unregistered'
    && row.surface === 'claude-global hooks').length, 1);

  const mergeSource = fs.readFileSync(path.join(SUPER_GSD_ROOT, 'scripts', 'merge-settings.js'), 'utf8');
  assert.match(mergeSource, /if \(require\.main === module\) main\(\);/);
  const merge = require(path.join(SUPER_GSD_ROOT, 'scripts', 'merge-settings.js'));
  assert.equal(typeof merge.mergeSettingsFiles, 'function');
  const auditPath = path.join(SUPER_GSD_ROOT, 'tools', 'feature-propagation', 'audit.cjs');
  const auditSource = fs.readFileSync(auditPath, 'utf8');
  const audit = require(auditPath);
  assert.equal(typeof audit._internals.auditClaudeSubstrateWitness, 'function');
  assert.equal(typeof audit._internals.auditClaudeSubstrateCapability, 'function');
  assert.match(auditSource, /--smoke-repo-overlay/, 'substrate repair omits the deployed hook smoke');

  const installer = fs.readFileSync(INSTALL_PATH, 'utf8');
  assert.match(installer, /repair_substrate_capability\(\)/);
  assert.match(installer, /refusing grant-bearing agent installation/);
  assert.match(installer, /repair_args\+=\(--install-global\)/, 'global substrate mutation is not gated by the global opt-in');
  for (const functionName of ['init_local_project()', 'update_existing()']) {
    const start = installer.indexOf(functionName);
    const distributionIndex = installer.indexOf('  distribute_project_hooks', start);
    const repairIndex = installer.indexOf('  repair_substrate_capability', start);
    const codexIndex = installer.indexOf('  register_codex_hooks', start);
    assert.ok(
      start >= 0 && distributionIndex > start && repairIndex > distributionIndex && codexIndex > repairIndex,
      `${functionName} does not perform one distribution and substrate repair sequence`,
    );
  }

  const fixture = createDistributionFixture('brokered-substrate-capability');
  try {
    const secret = 'P167_INSTALLER_PRIVATE_UPSTREAM_VALUE';
    const repoSeed = sentinelSettings('p167-repo');
    const stalePre = deepClone(overlay.hooks.PreToolUse[0]);
    stalePre.hooks[0].command = 'node-stale';
    const stalePost = deepClone(overlay.hooks.PostToolUse[0]);
    stalePost.hooks[0].args[2] = 'PreToolUse';
    repoSeed.hooks.PreToolUse = [stalePre, deepClone(stalePre)];
    repoSeed.hooks.PostToolUse = [deepClone(stalePre), stalePost, deepClone(stalePost)];
    writeJson(fixture.repoSettings, repoSeed);

    const globalSeed = sentinelSettings('p167-global');
    globalSeed.hooks.PreToolUse = [deepClone(overlay.hooks.PreToolUse[0])];
    writeJson(fixture.globalSettings, globalSeed);
    const configPath = path.join(fixture.projectRoot, '.planning', 'config.json');
    const customisedConfig = Buffer.from('{\r\n  "operator_custom": "P167_INSTALLER_CONFIG_BYTES"\r\n}\r\n', 'utf8');
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, customisedConfig);

    const projectMcpPath = path.join(fixture.projectRoot, '.mcp.json');
    const localMcpPath = path.join(fixture.projectRoot, '.claude', 'settings.local.json');
    const userMcpPath = path.join(fixture.homeRoot, '.claude.json');
    writeJson(projectMcpPath, {
      unrelated: { survives: true },
      mcpServers: {
        unrelated: { command: 'unrelated-command', args: ['--preserve'] },
        'vtp-kb': { command: 'node', args: ['project-upstream.cjs'], env: { PRIVATE_VALUE: secret } },
      },
    });
    writeJson(localMcpPath, {
      unrelatedLocal: true,
      mcpServers: { 'vtp-kb': { command: 'node', args: ['local-settings-upstream.cjs'] } },
    });
    writeJson(userMcpPath, {
      unrelatedUser: true,
      mcpServers: { 'vtp-kb': { command: 'node', args: ['user-upstream.cjs'] } },
      projects: {
        [fixture.projectRoot]: {
          unrelatedProjectState: true,
          mcpServers: { 'vtp-kb': { command: 'node', args: ['local-profile-upstream.cjs'] } },
        },
      },
    });

    const legacyDir = path.join(fixture.homeRoot, '.claude', 'agents');
    fs.mkdirSync(legacyDir, { recursive: true });
    for (const [name, marker] of [
      ['gsd-phase-researcher.md', 'phase_research'],
      ['gsd-planner.md', 'planning'],
    ]) {
      fs.writeFileSync(
        path.join(legacyDir, name),
        `---\ntools: Read, Bash\n---\noperator-owned ${name}\n<sgsd_vtp_substrate_policy_p166_${marker}>old P166 content</sgsd_vtp_substrate_policy_p166_${marker}>\n`,
        'utf8',
      );
    }

    const targetWitness = path.join(fixture.projectRoot, 'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs');
    fs.mkdirSync(path.dirname(targetWitness), { recursive: true });
    fs.writeFileSync(targetWitness, fs.readFileSync(sourcePath, 'utf8') + '\n// stale target source\n', 'utf8');

    const localOnlyArgs = ['--init-project', '--skip-cockpit-deps'];
    const globalBeforeRefusal = readBytes(fixture.globalSettings);
    const refused = runInstaller(fixture, localOnlyArgs, BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS);
    if (refused.error) throw refused.error;
    assert.notEqual(refused.status, 0, 'project-local install silently removed a global witness registration');
    assert.deepEqual(readBytes(fixture.globalSettings), globalBeforeRefusal, 'project-local install changed global settings without opt-in');
    assert.deepEqual(readBytes(configPath), customisedConfig, 'refused substrate repair rewrote customised config bytes');

    const args = ['--install-global', '--init-project', '--skip-cockpit-deps'];
    const first = runInstaller(fixture, args, BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS);
    if (first.error) throw first.error;
    const firstOutput = `${first.stderr || ''}\n${first.stdout || ''}`;
    assert.equal(first.status, 0, `brokered capability install failed:\n${firstOutput}`);
    assert.equal(firstOutput.includes(secret), false, 'installer output exposed private upstream data');
    assert.equal(sha256(readBytes(targetWitness)), sourceDigest, 'installer did not refresh the stale witness source');
    assert.deepEqual(readBytes(configPath), customisedConfig, 'substrate repair rewrote customised config bytes');

    const installedRepo = JSON.parse(readBytes(fixture.repoSettings).toString('utf8'));
    assert.equal(installedRepo.unrelatedProjectKey.survives, true);
    for (const [event, hookId] of expected) assert.equal(countManagedHook(installedRepo, event, hookId), 1);
    const installedGlobal = JSON.parse(readBytes(fixture.globalSettings).toString('utf8'));
    assert.equal(installedGlobal.unrelatedProjectKey.survives, true);
    assert.equal(JSON.stringify(installedGlobal).includes('substrate-invocation-witness'), false);

    const installedLocal = JSON.parse(readBytes(localMcpPath).toString('utf8'));
    const installedUser = JSON.parse(readBytes(userMcpPath).toString('utf8'));
    const definitions = [
      JSON.parse(readBytes(projectMcpPath).toString('utf8')).mcpServers['vtp-kb'],
      installedLocal.mcpServers['vtp-kb'],
      installedUser.mcpServers['vtp-kb'],
      installedUser.projects[fixture.projectRoot].mcpServers['vtp-kb'],
    ];
    for (const definition of definitions) {
      assert.equal(path.basename(definition.args[0]), 'substrate-capability-broker.cjs');
      assert.equal(Object.prototype.hasOwnProperty.call(definition, 'env'), false);
    }
    assert.equal(JSON.parse(readBytes(projectMcpPath).toString('utf8')).unrelated.survives, true);
    assert.equal(installedLocal.unrelatedLocal, true);
    assert.equal(installedUser.unrelatedUser, true);

    const witnessStore = require(WITNESS_STORE_PATH);
    const isolatedEnv = {
      HOME: fixture.homeRoot,
      USERPROFILE: fixture.homeRoot,
      APPDATA: path.join(fixture.homeRoot, 'AppData', 'Roaming'),
      XDG_CONFIG_HOME: path.join(fixture.homeRoot, '.config'),
    };
    const manifestPath = witnessStore.resolveWitnessPaths(fixture.projectRoot, isolatedEnv).upstream_manifest_path;
    assert.equal(readBytes(manifestPath).includes(Buffer.from(secret)), true, 'private manifest did not preserve upstream secret bytes');

    const installedAgents = [
      path.join(legacyDir, 'sgsd-vtp-enrichment.md'),
      path.join(legacyDir, 'sgsd-board-researcher.md'),
      path.join(legacyDir, 'gsd-phase-researcher.md'),
      path.join(legacyDir, 'gsd-planner.md'),
    ];
    for (const agentPath of installedAgents) {
      const text = readBytes(agentPath).toString('utf8');
      assert.match(text.split(/---/)[1], new RegExp(matcher));
      assert.match(text, /<sgsd_vtp_substrate_witness_p167>/);
      assert.doesNotMatch(text, /\btool_use_id\b/);
      assert.doesNotMatch(text, /truncate it in memory to its first 16000 JavaScript characters/);
    }

    const stablePaths = [
      fixture.repoSettings,
      fixture.globalSettings,
      configPath,
      projectMcpPath,
      localMcpPath,
      userMcpPath,
      manifestPath,
      targetWitness,
      ...installedAgents,
    ];
    const firstBytes = new Map(stablePaths.map((filePath) => [filePath, readBytes(filePath)]));
    const second = runInstaller(fixture, args, BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS);
    if (second.error) throw second.error;
    assert.equal(second.status, 0, `brokered capability reinstall failed:\n${second.stderr || ''}\n${second.stdout || ''}`);
    for (const filePath of stablePaths) assert.deepEqual(readBytes(filePath), firstBytes.get(filePath), `second install changed ${filePath}`);
  } finally {
    removeFixture(fixture);
  }
}

function runSgsdUpdateClarityRecovery() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-update-clarity-recovery-'));
  try {
    provisionFixtureHookPackages(fixtureRoot);
    const gitFixture = createClarityUpdateGitFixture(fixtureRoot, REPO_REGISTRATIONS);
    const project = seedClarityUpdateProject(fixtureRoot, gitFixture.oldSha);
    const updaterEnv = {
      ...process.env,
      HOME: project.homeRoot,
      USERPROFILE: project.homeRoot,
      APPDATA: path.join(project.homeRoot, 'AppData', 'Roaming'),
      XDG_CONFIG_HOME: path.join(project.homeRoot, '.config'),
      GIT_SSH_COMMAND: gitFixture.sshRouterPath.replace(/\\/g, '/'),
      GIT_SSH_VARIANT: 'ssh',
      GIT_TERMINAL_PROMPT: '0',
      SGSD_TEST_BARE_REPO: gitFixture.bareRoot,
      SGSD_TEST_SSH_LOG: gitFixture.sshLogPath,
      ...fixtureTempEnv(fixtureRoot),
    };
    const runUpdater = () => runFixtureProcess(
      process.env.SGSD_TEST_BASH || 'bash',
      [
        path.join(gitFixture.sourceRoot, 'super-gsd', 'scripts', 'sgsd-update.sh'),
        '--source',
        gitFixture.sourceRoot,
      ],
      {
        cwd: project.projectRoot,
        env: updaterEnv,
        timeoutMs: REAL_UPDATE_SPAWN_TIMEOUT_MS,
      },
    );

    assertBrokenClarityUpdate(
      runUpdater(),
      project,
      gitFixture.sourceRoot,
      gitFixture.oldSha,
    );
    assertUncoveredProjectRowsRefuse(project);
    runFixtureGit(
      ['--git-dir', gitFixture.bareRoot, 'update-ref', 'refs/heads/master', gitFixture.fixedSha],
      fixtureRoot,
      'advance bare upstream to repaired SHA',
    );
    assertRepairedClarityUpdate(
      runUpdater(),
      project,
      gitFixture.sourceRoot,
      gitFixture.fixedSha,
    );
    assert.ok(
      fs.readFileSync(gitFixture.sshLogPath, 'utf8').trim().length > 0,
      'fixture SSH transport was not exercised',
    );
    assertClarityRecoveryRunbook();
  } finally {
    removeFixture({ root: fixtureRoot });
  }
}

function runWitnessRepairSmokeNoMutation() {
  const audit = require(path.join(SUPER_GSD_ROOT, 'tools', 'feature-propagation', 'audit.cjs'));
  const fixture = createDistributionFixture('witness-repair-smoke-no-mutation');
  const savedProfileEnv = Object.fromEntries(
    ['HOME', 'USERPROFILE', 'APPDATA', 'XDG_CONFIG_HOME'].map((name) => [name, process.env[name]]),
  );
  try {
    const targetHooksRoot = path.join(fixture.projectRoot, 'super-gsd', 'hooks');
    fs.mkdirSync(targetHooksRoot, { recursive: true });
    for (const name of SHIPPED_HOOK_NAMES) {
      fs.copyFileSync(path.join(fixture.vendoredRoot, 'hooks', name), path.join(targetHooksRoot, name));
    }
    const targetCodexRoot = path.join(fixture.projectRoot, 'super-gsd', 'tools', 'codex-hooks');
    fs.mkdirSync(targetCodexRoot, { recursive: true });
    for (const name of EXPECTED_CODEX_ENTRY_NAMES) {
      fs.copyFileSync(path.join(fixture.vendoredRoot, 'tools', 'codex-hooks', name), path.join(targetCodexRoot, name));
    }

    const repoOverlay = JSON.parse(readBytes(REPO_OVERLAY_PATH).toString('utf8'));
    writeJson(fixture.repoSettings, sentinelSettings('repair-smoke-project'));
    const globalSettings = sentinelSettings('repair-smoke-global');
    globalSettings.hooks.PreToolUse = [deepClone(repoOverlay.hooks.PreToolUse[0])];
    writeJson(fixture.globalSettings, globalSettings);

    fs.writeFileSync(
      path.join(targetHooksRoot, 'sgsd-quality-gate.js'),
      "#!/usr/bin/env node\n'use strict';\nprocess.exitCode = 23;\n",
      'utf8',
    );
    const targetBroker = path.join(fixture.projectRoot, 'super-gsd', 'tools', 'substrate-capability-broker.cjs');
    assert.equal(fs.existsSync(targetBroker), false, 'fixture unexpectedly starts with the substrate broker installed');

    process.env.HOME = fixture.homeRoot;
    process.env.USERPROFILE = fixture.homeRoot;
    process.env.APPDATA = path.join(fixture.homeRoot, 'AppData', 'Roaming');
    process.env.XDG_CONFIG_HOME = path.join(fixture.homeRoot, '.config');
    const snapshot = () => relativeFiles(fixture.root).map((relative) => [
      relative,
      sha256(readBytes(path.join(fixture.root, relative))),
    ]);
    const before = snapshot();
    const actions = [];
    const repair = audit._internals.repairClaudeSubstrateWitness({
      projectDir: fixture.projectRoot,
      sgsdRoot: fixture.vendoredRoot,
    }, actions, { allowGlobalRepair: true, repairProjectHooks: true });

    assert.equal(repair.ok, false, 'failing repo hook overlay smoke did not refuse witness repair');
    assert.deepEqual(repair.reasons, ['witness_repair_failed']);
    assert.deepEqual(actions, [], 'failed repo hook overlay smoke recorded repair mutations');
    assert.deepEqual(snapshot(), before, 'failed repo hook overlay smoke changed fixture bytes');
  } finally {
    for (const [name, value] of Object.entries(savedProfileEnv)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    removeFixture(fixture);
  }
}

const CASES = Object.freeze({
  'preflight-static': runPreflightStatic,
  'smoke-static': runSmokeStatic,
  'bundled-overlay-static': runBundledOverlayStatic,
  'bundled-overlay-current': runBundledOverlayCurrent,
  'vendored-nine-hook': runVendoredNineHook,
  'node-check-both-sites': runNodeCheckBothSites,
  'deployed-hook-smoke': runDeployedHookSmoke,
  'hook-distribution-all-types': runHookDistributionAllTypes,
  'hook-manifest-completeness': runHookManifestCompleteness,
  'brokered-substrate-capability': runBrokeredSubstrateCapability,
  'witness-repair-smoke-no-mutation': runWitnessRepairSmokeNoMutation,
  'sgsd-update-clarity-shape': runSgsdUpdateClarityRecovery,
  'sgsd-update-clarity-recovery': runSgsdUpdateClarityRecovery,
});

async function main(argv) {
  if (argv.includes('--all')) {
    for (const [name, runCase] of Object.entries(CASES)) {
      await runCase();
      process.stdout.write(`[installer-registration-guard] ${name} PASS\n`);
    }
    return 0;
  }
  const caseIndex = argv.indexOf('--case');
  const caseName = caseIndex >= 0 ? argv[caseIndex + 1] : null;
  if (!caseName || !CASES[caseName]) {
    process.stderr.write(`Usage: ${path.basename(__filename)} --all|--case ${Object.keys(CASES).join('|')}\n`);
    return 64;
  }
  await CASES[caseName]();
  process.stdout.write(`[installer-registration-guard] ${caseName} PASS\n`);
  return 0;
}

main(process.argv.slice(2)).then((exitCode) => {
  process.exitCode = exitCode;
}, (error) => {
  process.stderr.write(`[installer-registration-guard] FAIL: ${error.stack || error.message}\n`);
  process.exitCode = 1;
});
