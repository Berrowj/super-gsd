#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'super-gsd', 'registry', 'codex-profiles.yaml');
const SHELL_HELPER_PATH = path.join(REPO_ROOT, 'super-gsd', 'scripts', 'lib', 'codex-profile-shell.sh');
const resolver = require(path.join(REPO_ROOT, 'super-gsd', 'tools', 'codex-pro', 'profile-resolver.cjs'));

const EXPECTED_ROLE_CONTRACTS = {
  'codex.readonly.audit': ['gpt-5.6-sol', 'xhigh', false, false, false, false, [], 0],
  'codex.plan': ['gpt-5.6-sol', 'xhigh', false, false, false, false, ['.planning/'], 1],
  'codex.goal': ['gpt-5.6-sol', 'xhigh', true, true, true, true, [], 12],
  'codex.execute.bounded': ['gpt-5.6-sol', 'xhigh', true, true, true, true, [], 6],
  'codex.execute.patch': ['gpt-5.6-sol', 'xhigh', false, true, false, false, [], 20],
  'codex.review.native': ['gpt-5.6-sol', 'xhigh', false, false, false, false, [], 0],
  'codex.review.swarm': ['gpt-5.6-sol', 'high', false, false, false, false, [], 0],
  'codex.cockpit.brief': ['gpt-5.6-sol', 'high', false, false, false, false, [], 0],
  'codex.app_lab': ['gpt-5.6-sol', 'xhigh', true, true, true, true, [], 25],
  'codex.cloud_lab': ['gpt-5.6-sol', 'xhigh', true, true, true, true, [], 25],
};

const PROFILE_CONTEXTS = {
  'codex.readonly.audit': { phase_type: 'audit' },
  'codex.plan': { phase_type: 'plan' },
  'codex.goal': { phase_type: 'goal' },
  'codex.execute.bounded': { phase_type: 'execute', risk: 'low', allowed_files: ['src/a.cjs'] },
  'codex.execute.patch': { phase_type: 'execute', risk: 'high', uses_patch_fallback: true },
  'codex.review.native': { phase_type: 'review', mode: 'native' },
  'codex.review.swarm': { phase_type: 'review', mode: 'swarm' },
  'codex.cockpit.brief': { phase_type: 'cockpit' },
  'codex.app_lab': { phase_type: 'lab', environment: 'app' },
  'codex.cloud_lab': { phase_type: 'lab', environment: 'cloud' },
};

function assertFullAccess(profile, label, { cli = false } = {}) {
  assert.equal(profile.sandbox, 'danger-full-access', `${label} sandbox`);
  assert.equal(profile.approval, 'never', `${label} approval`);
  if (cli) assert.equal(profile.ephemeral, false, `${label} retained session`);
}

function parseKeyValue(output) {
  return Object.fromEntries(output.trim().split(/\r?\n/).map((line) => {
    const separator = line.indexOf('=');
    return [line.slice(0, separator), line.slice(separator + 1)];
  }));
}

function assertSafeCliFlags(text, label) {
  assert.match(text, /--sandbox danger-full-access(?:\s|$)/, `${label} sandbox flag`);
  assert.match(text, /--ask-for-approval never(?:\s|$)/, `${label} approval flag`);
  assert.doesNotMatch(text, /--full-auto(?:\s|$)/, `${label} must not use --full-auto`);
  assert.doesNotMatch(text, /--ephemeral(?:\s|$)/, `${label} must retain its session`);
}

test('all shipped role and CLI profiles grant full access without changing role contracts', () => {
  const registry = resolver.loadFullRegistry(REGISTRY_PATH);
  assert.deepEqual(Object.keys(registry.profiles), Object.keys(EXPECTED_ROLE_CONTRACTS));

  for (const [name, expected] of Object.entries(EXPECTED_ROLE_CONTRACTS)) {
    const profile = registry.profiles[name];
    assertFullAccess(profile, name);
    assert.deepEqual([
      profile.model,
      profile.reasoning,
      profile.requires_worktree,
      profile.requires_locked_plan,
      profile.hooks_required,
      profile.native_review_required,
      profile.allowed_write_roots,
      profile.max_changed_files,
    ], expected, `${name} role contract`);
  }

  assert.deepEqual(Object.keys(registry.cli_profiles), ['executor', 'review', 'triage']);
  for (const [name, profile] of Object.entries(registry.cli_profiles)) {
    assertFullAccess(profile, `cli_profiles.${name}`, { cli: true });
    assert.equal(profile.model, 'gpt-5.6-sol', `cli_profiles.${name} model`);
    assert.equal(profile.reasoning, 'xhigh', `cli_profiles.${name} reasoning`);
  }
});

test('every role resolver path, including its default, resolves to full access', () => {
  for (const [name, context] of Object.entries(PROFILE_CONTEXTS)) {
    const resolved = resolver.resolveProfile(context);
    assert.equal(resolved.profile, name);
    assertFullAccess(resolved, `resolved ${name}`);
  }

  const fallback = resolver.resolveProfile({ phase_type: 'unknown' });
  assert.equal(fallback.profile, 'codex.readonly.audit');
  assertFullAccess(fallback, 'default role fallback');
});

test('registry CLI profiles emit explicit full-access and never-approval flags', () => {
  for (const name of resolver.CLI_PROFILE_NAMES) {
    const resolution = resolver.resolveCliProfile(name, { registryPath: REGISTRY_PATH });
    assert.equal(resolution.status, 'ok');
    assertFullAccess(resolution.profile_data, `resolved CLI ${name}`, { cli: true });

    const values = parseKeyValue(resolver.cliResolutionToKeyValue(resolution));
    assert.equal(values.CODEX_FULL_AUTO, 'false');
    assert.equal(values.CODEX_EPHEMERAL, 'false');
    assertSafeCliFlags(values.CODEX_DEFAULT_FLAG_FRAGMENT, `${name} key-value output`);
  }

  const legacy = resolver.resolveCliProfile('codex.review.native', { registryPath: REGISTRY_PATH });
  assert.equal(legacy.profile, 'review');
  assertFullAccess(legacy.profile_data, 'legacy codex.review.native alias', { cli: true });
});

test('Node built-ins and registry failure fallbacks remain full-access retained sessions', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-worker-permissions-'));
  try {
    for (const name of resolver.CLI_PROFILE_NAMES) {
      assertFullAccess(resolver.BUILTIN_CLI_PROFILES[name], `built-in ${name}`, { cli: true });
      const resolution = resolver.resolveCliProfile(name, {
        registryPath: path.join(tempRoot, 'missing.yaml'),
        defaultProfile: name,
        logPath: path.join(tempRoot, 'resolution.jsonl'),
      });
      assert.equal(resolution.status, 'fallback');
      assert.equal(resolution.source, 'built-in');
      assert.equal(resolution.profile, name);
      assertFullAccess(resolution.profile_data, `fallback ${name}`, { cli: true });
      assertSafeCliFlags(parseKeyValue(resolver.cliResolutionToKeyValue(resolution)).CODEX_DEFAULT_FLAG_FRAGMENT, `${name} fallback output`);
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test('executor and review command builders never downgrade full access with --full-auto', () => {
  const shared = {
    timeout: 30,
    promptFile: 'prompt.md',
    model: 'gpt-5.5',
    reasoning: 'xhigh',
  };

  for (const launcher of ['direct', 'cmd']) {
    const executor = resolver.buildExecutorResolvedCommand({
      ...shared,
      profile: resolver.BUILTIN_CLI_PROFILES.executor,
      codexCd: 'PROJECT',
      launcher,
    });
    assertSafeCliFlags(executor, `executor ${launcher} command`);

    for (const name of ['review', 'triage']) {
      const command = resolver.buildReviewResolvedCommand({
        ...shared,
        profile: resolver.BUILTIN_CLI_PROFILES[name],
        project: 'PROJECT',
        launcher,
        command: launcher === 'cmd' ? 'cmd.exe' : 'codex',
      });
      assertSafeCliFlags(command, `${name} ${launcher} command`);
    }
  }
});

test('Bash built-in fallback executes with full access for every CLI role', () => {
  const shellPath = process.platform === 'win32'
    ? SHELL_HELPER_PATH.replace(/^([A-Za-z]):/, (_match, drive) => `/mnt/${drive.toLowerCase()}`).replace(/\\/g, '/')
    : SHELL_HELPER_PATH;
  const script = [
    `source '${shellPath}'`,
    'for profile in executor review triage; do',
    '  sgsd_codex_profile_apply_builtin "$profile" "$profile" test',
    "  printf '%s|%s|%s|%s|%s\\n' $SGSD_CODEX_RESOLVED_PROFILE $SGSD_CODEX_PROFILE_SANDBOX $SGSD_CODEX_PROFILE_APPROVAL $SGSD_CODEX_PROFILE_EPHEMERAL $SGSD_CODEX_PROFILE_FULL_AUTO",
    'done',
  ].join('\n');
  const result = spawnSync(process.platform === 'win32' ? 'bash.exe' : 'bash', [], { encoding: 'utf8', input: script });
  assert.equal(result.status, 0, result.stderr);
  const rows = result.stdout.replace(/\0/g, '').trim().split(/\r?\n/);
  assert.deepEqual(rows, [
    'executor|danger-full-access|never|false|false',
    'review|danger-full-access|never|false|false',
    'triage|danger-full-access|never|false|false',
  ]);
});

test('dangerous-control mutation still requires exact interactive confirmation', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-worker-guard-'));
  const before = fs.readFileSync(REGISTRY_PATH, 'utf8');
  try {
    assert.throws(
      () => resolver.setCliProfileField('triage', 'sandbox', 'danger-full-access', {
        registryPath: REGISTRY_PATH,
        logPath: path.join(tempRoot, 'resolution.jsonl'),
      }),
      /CONFIRM SGSD CODEX PROFILE triage sandbox danger-full-access/,
    );
    assert.equal(fs.readFileSync(REGISTRY_PATH, 'utf8'), before);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
