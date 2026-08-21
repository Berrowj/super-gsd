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
const INSTALL_PATH = path.join(SUPER_GSD_ROOT, 'install.sh');
const PREFLIGHT_PATH = path.join(SUPER_GSD_ROOT, 'scripts', 'lib', 'hook-registration-preflight.cjs');
const BUNDLED_OVERLAY_PATH = path.join(SUPER_GSD_ROOT, 'CLAUDE-OVERLAY.md');
const GLOBAL_OVERLAY_PATH = path.join(SUPER_GSD_ROOT, 'config', 'settings-overlay.json');
const REPO_OVERLAY_PATH = path.join(SUPER_GSD_ROOT, 'config', 'repo-settings-overlay.json');
const CODEX_HOOK_CONFIG_PATH = path.join(SUPER_GSD_ROOT, 'config', 'codex-hooks.json');
const HOOK_MANIFEST_PATH = path.join(SUPER_GSD_ROOT, 'config', 'hook-manifest.json');
const COMMIT_GATE_INSTALLER_PATH = path.join(SUPER_GSD_ROOT, 'scripts', 'install-commit-gate.cjs');
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
const CANONICAL_HOOK_COUNT = 16;
const DEFAULT_INSTALLER_SPAWN_TIMEOUT_MS = 150_000;
const BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS = 3 * 90_000;
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
  ['SessionStart', 'session-start-governance', 'super-gsd/hooks/sgsd-session-start.js'],
  ['UserPromptSubmit', 'user-prompt-intent-classifier', 'super-gsd/hooks/sgsd-intent-classifier.cjs'],
  ['UserPromptSubmit', 'user-prompt-secret-leak-guard', 'super-gsd/tools/codex-hooks/block-secret-leak.cjs'],
  ['PostToolUse', 'post-tool-use-quality-gate', 'super-gsd/hooks/sgsd-quality-gate.js'],
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
    },
  };
}

function copyFixtureSupport(projectRoot) {
  const vendoredRoot = path.join(projectRoot, 'super-gsd');
  fs.mkdirSync(vendoredRoot, { recursive: true });
  for (const name of ['install.sh', 'CLAUDE-OVERLAY.md']) {
    fs.copyFileSync(path.join(SUPER_GSD_ROOT, name), path.join(vendoredRoot, name));
  }
  for (const relative of ['config', 'hooks', 'registry', 'scripts']) {
    fs.cpSync(path.join(SUPER_GSD_ROOT, relative), path.join(vendoredRoot, relative), { recursive: true });
  }
  for (const relative of [
    path.join('tools', 'codex-hooks'),
    path.join('tools', 'state-resolver'),
    path.join('tools', 'vtp-readiness'),
  ]) {
    fs.cpSync(path.join(SUPER_GSD_ROOT, relative), path.join(vendoredRoot, relative), { recursive: true });
  }
  return vendoredRoot;
}

function createFixture(label) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `sgsd-registration-${label}-`));
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
  match = launch.match(/^(?:node|bash)\s+super-gsd\/(hooks\/[^\s]+|tools\/codex-hooks\/[^\s]+)$/);
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
  assert.equal(snapshot.hookInventory.length, 16, 'hook manifest inventory must contain exactly sixteen Claude entries');
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

function runHookManifestCompleteness() {
  const snapshot = hookManifestSnapshot();
  assert.deepEqual(validateHookManifest(snapshot), { entries: 21, registrations: 24, smoke: 15 });

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
      },
      encoding: 'utf8',
      shell: false,
      timeout: timeoutMs,
      windowsHide: true,
    },
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
    enumerateHookRegistrations,
    preflightHookRegistrations,
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
  assert.equal(descriptors.length, 4);
  assert.deepEqual(descriptors.map((item) => item.event), ['statusLine', 'SessionStart', 'SessionStart', 'PostToolUse']);
  assert.equal(descriptors[1].hookId, 'session-governance');
  assert.equal(descriptors[3].hookId, 'PostToolUse[0].hooks[0]');

  const checked = [];
  const passed = preflightHookRegistrations(overlay, {
    isFile: () => true,
    nodeCheck: (scriptPath) => { checked.push(`node:${scriptPath}`); return { status: 0 }; },
    shellCheck: (scriptPath) => { checked.push(`bash:${scriptPath}`); return { status: 0 }; },
  });
  assert.equal(passed.length, 4);
  assert.deepEqual(checked, [
    `node:${paths.status}`,
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

  assert.throws(
    () => enumerateHookRegistrations({ statusLine: { type: 'command', command: `python ${paths.status}` } }),
    /hook_registration_launch_invalid.*statusLine/,
  );
  assert.throws(
    () => enumerateHookRegistrations({
      hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node', args: ['relative.js'] }] }] },
    }),
    /hook_registration_launch_invalid.*SessionStart\[0\]\.hooks\[0\]/,
  );
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
  const globalSmoke = installer.indexOf('--smoke-manifest');
  const globalMergeLaunch = 'node ' + quote + '$MERGE_SCRIPT' + quote
    + ' ' + quote + '$OVERLAY_FILE' + quote + ' ' + quote + '$SETTINGS_FILE' + quote;
  const globalMerge = installer.indexOf(globalMergeLaunch, globalSmoke);
  assert.ok(globalHooks >= 0 && globalHooks < globalDistribution, 'global regular-file hook distribution is missing');
  assert.ok(globalDistribution < globalSmoke, 'global hook distribution runs after smoke');
  assert.ok(stateResolverCopy >= 0 && stateResolverCopy < scriptsReady, 'state resolver is not deployed before scripts-ready boundary');
  assert.ok(scriptsReady < globalSmoke, 'global smoke runs before script dependencies are deployed');
  for (const dependencyCopy of [
    'copy_tree_files ' + quote + '$SCRIPT_DIR/scripts/lib' + quote + ' ' + quote + '$CLAUDE_DIR/scripts/lib' + quote,
    'copy_tree_files ' + quote + '$SCRIPT_DIR/registry' + quote + ' ' + quote + '$CLAUDE_DIR/registry' + quote,
    'copy_tree_files ' + quote + '$SCRIPT_DIR/tools/vtp-readiness' + quote + ' ' + quote + '$CLAUDE_DIR/tools/vtp-readiness' + quote,
  ]) {
    const dependencyIndex = installer.indexOf(dependencyCopy);
    assert.ok(dependencyIndex >= 0 && dependencyIndex < globalSmoke, `${dependencyCopy} runs after global smoke`);
  }
  assert.ok(globalSmoke < globalMerge, 'global settings merge runs before hook smoke');
  assert.match(
    installer,
    /--smoke-manifest \x22\$HOOKS_DIR\x22 \x22\$SCRIPT_DIR\/hooks\x22/,
    'global smoke does not validate the deployment source before registration',
  );

  const repoFunction = installer.indexOf('register_repo_local_hooks()');
  const repoSmoke = installer.indexOf('--smoke-repo-overlay', repoFunction);
  const codexMissingRefusal = installer.indexOf('hook_registration_missing $missing_target', repoSmoke);
  const repoMerge = installer.indexOf('--repo-local-hooks', repoSmoke);
  assert.ok(repoFunction >= 0 && repoFunction < repoSmoke, 'repo-local hook smoke is not wired into registration');
  assert.ok(
    repoSmoke < codexMissingRefusal && codexMissingRefusal < repoMerge,
    'Codex distribution refusal does not name missing targets before repo settings merge',
  );
  assert.ok(repoSmoke < repoMerge, 'repo-local settings merge runs before hook smoke');

  const distributionFunction = installer.indexOf('distribute_project_hooks()');
  const repoDistribution = installer.indexOf(projectHookBatch, distributionFunction);
  const codexDistribution = installer.indexOf('$PROJECT_DIR/super-gsd/tools/codex-hooks/$name', distributionFunction);
  assert.ok(distributionFunction >= 0 && distributionFunction < repoDistribution, 'repo regular-file hook distribution is missing');
  assert.ok(repoDistribution < codexDistribution, 'Codex entries are copied before the repo hook inventory');
  for (const functionName of ['init_local_project()', 'update_existing()']) {
    const functionStart = installer.indexOf(functionName);
    const distributionCall = installer.indexOf('  distribute_project_hooks', functionStart);
    const repoCall = installer.indexOf('  register_repo_local_hooks', functionStart);
    const codexCall = installer.indexOf('  register_codex_hooks', functionStart);
    assert.ok(
      functionStart >= 0 && functionStart < distributionCall
        && distributionCall < repoCall && repoCall < codexCall,
      `${functionName} does not distribute Claude and Codex entries before registration`,
    );
  }
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
  assert.match(
    installer,
    /chmod \+x \x22\$\{project_executable_targets\[@\]\}\x22/,
    'project executable bits are not applied in one batch',
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
  child.stdin = {
    end(input) {
      onInput(input);
      setImmediate(() => {
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
    assert.equal(mergeCalls, 0, 'settings merge callback ran after smoke refusal');
  }
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
    globalDescriptors.slice(0, -1).map((item) => [item.event, item.interpreter, path.basename(item.scriptPath), item.timeout]),
    registeredDescriptors.map((item) => [item.event, item.interpreter, path.basename(item.scriptPath), item.timeout]),
    'global deployment manifest drifted from settings-overlay.json',
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
  assert.equal(repoDescriptors.length, REPO_REGISTRATIONS.length, 'repo smoke did not realize all four overlay commands');
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
    const call = calls.find((candidate) => candidate.args[0] === descriptor.scriptPath);
    assert.ok(call, `hook smoke omitted ${descriptor.scriptPath}`);
    const payload = JSON.parse(call.input);
    assert.equal(call.command, descriptor.interpreter === 'node' ? 'fixture-node' : 'fixture-bash');
    assert.deepEqual(call.args, [descriptor.scriptPath]);
    assert.equal(call.options.shell, false);
    assert.deepEqual(call.options.stdio, ['pipe', 'ignore', 'ignore']);
    assert.equal(call.options.cwd, smokeCwd);
    assert.equal(call.options.env.HOME, smokeHome);
    assert.equal(call.options.env.USERPROFILE, smokeHome);
    const registeredBudget = descriptor.timeout === null ? SMOKE_TIMEOUT_MS : descriptor.timeout * 1000;
    assert.equal(call.options.timeout, Math.max(SMOKE_TIMEOUT_FLOOR_MS, registeredBudget));
    assert.ok(call.options.timeout >= registeredBudget, 'smoke ignored the registered timeout budget');
    assert.equal(call.input.endsWith('\n'), true, 'child stdin was not closed with a complete payload');
    assert.deepEqual(Object.keys(payload).sort(), [
      'cwd', 'hook_event_name', 'prompt', 'session_id',
      'tool_input', 'tool_name', 'tool_response',
    ]);
    assert.equal(payload.hook_event_name, descriptor.event);
    assert.equal(payload.cwd, smokeCwd);
    assert.equal(payload.session_id, 'sgsd-installer-hook-smoke');
    assert.equal(payload.prompt, 'SGSD installer dependency smoke');
    assert.equal(payload.tool_name, 'Read');
    assert.deepEqual(payload.tool_input, { file_path: 'sgsd-hook-smoke.txt' });
    assert.deepEqual(payload.tool_response, { ok: true });
  });

  await assertSmokeFailures(repoDescriptors[0], smokeCwd, smokeHome, smokeHookRegistrations);
}

function runVendoredNineHook() {
  const fixture = createFixture('vendored-nine');
  try {
    retainClarityNine(fixture.vendoredRoot);
    const before = seedTarget(fixture.repoSettings, 'vendored-nine-hook');
    const missing = REPO_REGISTRATIONS.slice(1).map(([, , relative]) => path.resolve(fixture.projectRoot, relative));
    const result = runInstaller(fixture, ['--init-project', '--skip-cockpit-deps']);
    assertRefused(result, fixture.repoSettings, before, ['hook_registration_missing', ...missing]);
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
    const realizedPath = global
      ? path.join(fixture.homeRoot, '.claude', 'hooks', 'sgsd-heartbeat.js')
      : path.join(fixture.projectRoot, 'super-gsd', 'hooks', 'sgsd-quality-gate.js');
    if (failure === 'missing') fs.rmSync(sourcePath);
    else fs.writeFileSync(sourcePath, 'const = invalid javascript;\n', 'utf8');
    const targetPath = global ? fixture.globalSettings : fixture.repoSettings;
    const before = seedTarget(targetPath, label);
    const args = global
      ? ['--install-global']
      : ['--init-project', '--skip-cockpit-deps'];
    const result = runInstaller(fixture, args, BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS);
    const code = failure === 'missing'
      ? 'hook_registration_missing'
      : 'hook_registration_node_check_failed';
    assertRefused(result, targetPath, before, [code, realizedPath]);
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
  const { enumerateHookRegistrations, preflightHookRegistrations } = require(PREFLIGHT_PATH);
  const globalSettings = JSON.parse(readBytes(fixture.globalSettings).toString('utf8'));
  assert.equal(globalSettings.unrelatedProjectKey.survives, true);

  const globalDescriptors = preflightHookRegistrations(globalSettings);
  assert.equal(globalDescriptors.length, GLOBAL_SCRIPT_NAMES.length);
  for (const name of GLOBAL_SCRIPT_NAMES) {
    assert.equal(globalDescriptors.filter((item) => path.basename(item.scriptPath) === name).length, 1, `${name} is missing or duplicated globally`);
  }
}

function assertRepoSettings(fixture) {
  const { enumerateHookRegistrations, preflightHookRegistrations } = require(PREFLIGHT_PATH);
  const repoSettings = JSON.parse(readBytes(fixture.repoSettings).toString('utf8'));
  assert.equal(repoSettings.unrelatedProjectKey.survives, true);

  const repoDescriptors = enumerateHookRegistrations(repoSettings);
  assert.equal(repoDescriptors.length, REPO_REGISTRATIONS.length);
  preflightHookRegistrations(repoSettings);
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
    'source hook inventory drifted from the locked sixteen basenames',
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

function runCanonicalSixteenHook() {
  assert.equal(hookFiles(path.join(SUPER_GSD_ROOT, 'hooks')).length, CANONICAL_HOOK_COUNT, 'canonical source is no longer a sixteen-hook layout');
  const fixture = createFixture('canonical-sixteen');
  try {
    assert.equal(hookFiles(path.join(fixture.vendoredRoot, 'hooks')).length, CANONICAL_HOOK_COUNT, 'vendored canonical fixture is incomplete');
    boundGlobalSmokeFixture(fixture, ['sgsd-heartbeat.js']);
    seedTarget(fixture.globalSettings, 'canonical-global');
    seedTarget(fixture.repoSettings, 'canonical-repo');
    const args = ['--install-global', '--init-project', '--skip-cockpit-deps'];
    const first = runInstaller(fixture, args, BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS);
    if (first.error) throw first.error;
    assert.equal(first.status, 0, `canonical install failed:\n${first.stderr}\n${first.stdout}`);
    assertCanonicalSettings(fixture);
    const firstGlobal = readBytes(fixture.globalSettings);
    const firstRepo = readBytes(fixture.repoSettings);

    const second = runInstaller(fixture, args, BATCHED_GLOBAL_INSTALLER_SPAWN_TIMEOUT_MS);
    if (second.error) throw second.error;
    assert.equal(second.status, 0, `canonical reinstall failed:\n${second.stderr}\n${second.stdout}`);
    assert.deepEqual(readBytes(fixture.globalSettings), firstGlobal, 'global reinstall was not byte-idempotent');
    assert.deepEqual(readBytes(fixture.repoSettings), firstRepo, 'repo reinstall was not byte-idempotent');
    assertCanonicalSettings(fixture);
  } finally {
    removeFixture(fixture);
  }
}

function runDeployedHookSmoke() {
  assert.equal(hookFiles(path.join(SUPER_GSD_ROOT, 'hooks')).length, CANONICAL_HOOK_COUNT, 'canonical source is no longer a sixteen-hook layout');
  const fixture = createFixture('deployed-hook-smoke');
  try {
    seedTarget(fixture.globalSettings, 'smoke-global');
    seedTarget(fixture.repoSettings, 'smoke-repo');
    const args = ['--init-project', '--skip-cockpit-deps'];
    const healthy = runInstaller(fixture, args);
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
    const dependencyPath = path.join(fixture.vendoredRoot, 'scripts', 'lib', 'sgsd-state.cjs');
    const entryPath = path.join(fixture.vendoredRoot, 'hooks', 'sgsd-session-start.js');
    fs.rmSync(dependencyPath);
    assert.equal(fs.existsSync(entryPath), true, 'dependency break removed the entry hook');

    const syntax = spawnSync(process.execPath, ['--check', entryPath], {
      encoding: 'utf8',
      shell: false,
      timeout: 5_000,
      windowsHide: true,
    });
    if (syntax.error) throw syntax.error;
    assert.equal(syntax.status, 0, 'entry hook stopped being node --check-clean: ' + syntax.stderr);

    const loadRoot = path.join(fixture.root, 'non-sgsd-load-root');
    fs.mkdirSync(loadRoot, { recursive: true });
    const load = spawnSync(process.execPath, [entryPath], {
      cwd: loadRoot,
      env: { ...process.env, HOME: fixture.homeRoot, USERPROFILE: fixture.homeRoot },
      input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: loadRoot }) + '\n',
      encoding: 'utf8',
      shell: false,
      timeout: 5_000,
      windowsHide: true,
    });
    if (load.error) throw load.error;
    assert.notEqual(load.status, 0, 'missing sibling dependency still loaded');
    assert.match(load.stderr, /MODULE_NOT_FOUND/, 'broken fixture did not prove the real load error');

    const refused = runInstaller(fixture, args);
    assertRefused(refused, fixture.repoSettings, beforeRepo, [
      'hook_smoke_failed',
      'session-start-governance',
      entryPath,
    ]);
    const output = (refused.stderr || '') + '\n' + (refused.stdout || '');
    assert.equal(output.includes('MODULE_NOT_FOUND'), false, 'raw installed-hook output leaked from refusal');
    assert.deepEqual(readBytes(fixture.globalSettings), beforeGlobal.bytes, 'global settings changed during broken reinstall');
    assert.equal(sha256(readBytes(fixture.globalSettings)), beforeGlobal.hash, 'global settings hash changed during broken reinstall');
    assert.equal(fs.existsSync(fixture.globalSettings + '.tmp'), false, 'global settings temp artifact remains');
  } finally {
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
  'canonical-sixteen-hook': runCanonicalSixteenHook,
  'deployed-hook-smoke': runDeployedHookSmoke,
  'hook-distribution-all-types': runHookDistributionAllTypes,
  'hook-manifest-completeness': runHookManifestCompleteness,
});

async function main(argv) {
  const caseIndex = argv.indexOf('--case');
  const caseName = caseIndex >= 0 ? argv[caseIndex + 1] : null;
  if (!caseName || !CASES[caseName]) {
    process.stderr.write(`Usage: ${path.basename(__filename)} --case ${Object.keys(CASES).join('|')}\n`);
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
