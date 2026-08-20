#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SUPER_GSD_ROOT = path.resolve(__dirname, '..', '..');
const PREFLIGHT_PATH = path.join(SUPER_GSD_ROOT, 'scripts', 'lib', 'hook-registration-preflight.cjs');
const BUNDLED_OVERLAY_PATH = path.join(SUPER_GSD_ROOT, 'CLAUDE-OVERLAY.md');
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
  'sgsd-activity-logger.js',
  'sgsd-heartbeat.js',
  'gsd-token-logger.js',
  'gsd-stuck-detector.js',
  'gsd-checkpoint-writer.js',
  'gsd-context-monitor.js',
  'sgsd-stop-handoff.js',
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
  for (const relative of ['config', 'hooks', path.join('tools', 'codex-hooks')]) {
    fs.cpSync(path.join(SUPER_GSD_ROOT, relative), path.join(vendoredRoot, relative), { recursive: true });
  }
  fs.mkdirSync(path.join(vendoredRoot, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(
    path.join(SUPER_GSD_ROOT, 'scripts', 'merge-settings.js'),
    path.join(vendoredRoot, 'scripts', 'merge-settings.js'),
  );
  fs.copyFileSync(
    PREFLIGHT_PATH,
    path.join(vendoredRoot, 'scripts', 'lib', 'hook-registration-preflight.cjs'),
  );
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

function removeFixture(fixture) {
  fs.rmSync(fixture.root, { recursive: true, force: true });
}

function hookFiles(hooksRoot) {
  return fs.readdirSync(hooksRoot)
    .filter((name) => fs.statSync(path.join(hooksRoot, name)).isFile())
    .sort();
}

function retainClarityNine(vendoredRoot) {
  const hooksRoot = path.join(vendoredRoot, 'hooks');
  for (const name of hookFiles(hooksRoot)) {
    if (!CLARITY_NINE_HOOKS.includes(name)) fs.rmSync(path.join(hooksRoot, name));
  }
  fs.rmSync(path.join(vendoredRoot, 'tools', 'codex-hooks', 'block-secret-leak.cjs'));
  assert.deepEqual(hookFiles(hooksRoot), [...CLARITY_NINE_HOOKS].sort(), 'fixture is not the exact Clarity nine-hook shape');
}

function runInstaller(fixture, args) {
  const bash = process.env.SGSD_TEST_BASH || 'bash';
  return spawnSync(
    bash,
    ['-o', 'pipefail', path.join(fixture.vendoredRoot, 'install.sh'), ...args],
    {
      cwd: fixture.projectRoot,
      env: {
        ...process.env,
        HOME: fixture.homeRoot,
        USERPROFILE: fixture.homeRoot,
      },
      encoding: 'utf8',
      shell: false,
      timeout: 120_000,
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
    const result = runInstaller(fixture, args);
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

function assertCanonicalSettings(fixture) {
  const { enumerateHookRegistrations, preflightHookRegistrations } = require(PREFLIGHT_PATH);
  const globalSettings = JSON.parse(readBytes(fixture.globalSettings).toString('utf8'));
  const repoSettings = JSON.parse(readBytes(fixture.repoSettings).toString('utf8'));
  assert.equal(globalSettings.unrelatedProjectKey.survives, true);
  assert.equal(repoSettings.unrelatedProjectKey.survives, true);

  const globalDescriptors = preflightHookRegistrations(globalSettings);
  assert.equal(globalDescriptors.length, GLOBAL_SCRIPT_NAMES.length);
  for (const name of GLOBAL_SCRIPT_NAMES) {
    assert.equal(globalDescriptors.filter((item) => path.basename(item.scriptPath) === name).length, 1, `${name} is missing or duplicated globally`);
  }

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

function runCanonicalSixteenHook() {
  assert.equal(hookFiles(path.join(SUPER_GSD_ROOT, 'hooks')).length, CANONICAL_HOOK_COUNT, 'canonical source is no longer a sixteen-hook layout');
  const fixture = createFixture('canonical-sixteen');
  try {
    assert.equal(hookFiles(path.join(fixture.vendoredRoot, 'hooks')).length, CANONICAL_HOOK_COUNT, 'vendored canonical fixture is incomplete');
    seedTarget(fixture.globalSettings, 'canonical-global');
    seedTarget(fixture.repoSettings, 'canonical-repo');
    const args = ['--install-global', '--init-project', '--skip-cockpit-deps'];
    const first = runInstaller(fixture, args);
    if (first.error) throw first.error;
    assert.equal(first.status, 0, `canonical install failed:\n${first.stderr}\n${first.stdout}`);
    assertCanonicalSettings(fixture);
    const firstGlobal = readBytes(fixture.globalSettings);
    const firstRepo = readBytes(fixture.repoSettings);

    const second = runInstaller(fixture, args);
    if (second.error) throw second.error;
    assert.equal(second.status, 0, `canonical reinstall failed:\n${second.stderr}\n${second.stdout}`);
    assert.deepEqual(readBytes(fixture.globalSettings), firstGlobal, 'global reinstall was not byte-idempotent');
    assert.deepEqual(readBytes(fixture.repoSettings), firstRepo, 'repo reinstall was not byte-idempotent');
    assertCanonicalSettings(fixture);
  } finally {
    removeFixture(fixture);
  }
}

const CASES = Object.freeze({
  'preflight-static': runPreflightStatic,
  'bundled-overlay-static': runBundledOverlayStatic,
  'bundled-overlay-current': runBundledOverlayCurrent,
  'vendored-nine-hook': runVendoredNineHook,
  'node-check-both-sites': runNodeCheckBothSites,
  'canonical-sixteen-hook': runCanonicalSixteenHook,
});

function main(argv) {
  const caseIndex = argv.indexOf('--case');
  const caseName = caseIndex >= 0 ? argv[caseIndex + 1] : null;
  if (!caseName || !CASES[caseName]) {
    process.stderr.write(`Usage: ${path.basename(__filename)} --case ${Object.keys(CASES).join('|')}\n`);
    return 64;
  }
  CASES[caseName]();
  process.stdout.write(`[installer-registration-guard] ${caseName} PASS\n`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  process.stderr.write(`[installer-registration-guard] FAIL: ${error.stack || error.message}\n`);
  process.exitCode = 1;
}
