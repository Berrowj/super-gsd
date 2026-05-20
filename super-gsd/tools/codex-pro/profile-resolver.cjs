#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function requireDependency(name) {
  const candidates = [
    path.resolve(__dirname, '..', 'plan-schema', 'node_modules', name),
    path.resolve(__dirname, 'node_modules', name),
    name,
  ];

  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }

  throw new Error(`Unable to require ${name}. Tried:\n${failures.join('\n')}`);
}

const yaml = requireDependency('js-yaml');

const REGISTRY_PATH = path.resolve(__dirname, '..', '..', 'registry', 'codex-profiles.yaml');

const REQUIRED_PROFILE_FIELDS = [
  'model',
  'reasoning',
  'sandbox',
  'approval',
  'requires_worktree',
  'requires_locked_plan',
  'hooks_required',
  'native_review_required',
  'allowed_write_roots',
  'max_changed_files',
];

function usage() {
  return [
    'Usage:',
    '  node profile-resolver.cjs [--help] [--resolve <json-context>] [--list]',
    '                            [--self-test-plan] [--self-test-bounded] [--self-test-audit]',
    '',
    'Resolves Codex Pro Mode dispatch context into one of the DLB-09.1 profiles.',
    '',
    'Examples:',
    '  node profile-resolver.cjs --list',
    '  node profile-resolver.cjs --resolve "{\\"phase_type\\":\\"execute\\",\\"risk\\":\\"low\\",\\"allowed_files\\":[\\"src/x.ts\\"]}"',
  ].join('\n');
}

function loadRegistry() {
  const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== 'object' || !parsed.profiles || typeof parsed.profiles !== 'object') {
    throw new Error(`Invalid Codex Pro profile registry: ${REGISTRY_PATH}`);
  }
  validateProfiles(parsed.profiles);
  return parsed.profiles;
}

function validateProfiles(profiles) {
  const names = Object.keys(profiles || {});
  if (names.length !== 10) {
    throw new Error(`Codex Pro registry must contain exactly 10 profiles; found ${names.length}`);
  }

  for (const [name, profile] of Object.entries(profiles)) {
    const missing = REQUIRED_PROFILE_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(profile, field));
    if (missing.length > 0) {
      throw new Error(`Profile ${name} missing required fields: ${missing.join(', ')}`);
    }
    if (!Array.isArray(profile.allowed_write_roots)) {
      throw new Error(`Profile ${name} allowed_write_roots must be an array`);
    }
    if (!Number.isInteger(profile.max_changed_files)) {
      throw new Error(`Profile ${name} max_changed_files must be an integer`);
    }
  }
}

function profileEnvelope(profileName, profiles) {
  const selected = profiles[profileName];
  if (!selected) {
    throw new Error(`Profile not found in registry: ${profileName}`);
  }
  return {
    profile: profileName,
    ...selected,
  };
}

function resolveProfileName(context) {
  const ctx = context && typeof context === 'object' ? context : {};
  const profiles = loadRegistry();
  const allowedFiles = Array.isArray(ctx.allowed_files) ? ctx.allowed_files : [];

  if (typeof ctx.profile_override === 'string' && profiles[ctx.profile_override]) {
    return ctx.profile_override;
  }
  if (ctx.phase_type === 'plan') return 'codex.plan';
  if (ctx.phase_type === 'audit' || ctx.read_only === true) return 'codex.readonly.audit';
  if (ctx.phase_type === 'review' && ctx.mode === 'native') return 'codex.review.native';
  if (ctx.phase_type === 'review' && ctx.mode === 'swarm') return 'codex.review.swarm';
  if (ctx.phase_type === 'execute' && ctx.risk === 'low' && allowedFiles.length <= 6) return 'codex.execute.bounded';
  if (ctx.phase_type === 'execute' && ctx.uses_patch_fallback === true) return 'codex.execute.patch';
  if (ctx.phase_type === 'goal') return 'codex.goal';
  if (ctx.phase_type === 'cockpit') return 'codex.cockpit.brief';
  if (ctx.phase_type === 'lab' && ctx.environment === 'app') return 'codex.app_lab';
  if (ctx.phase_type === 'lab' && ctx.environment === 'cloud') return 'codex.cloud_lab';
  return 'codex.readonly.audit';
}

function resolveProfile(context, profiles = loadRegistry()) {
  return profileEnvelope(resolveProfileName(context), profiles);
}

function parseJsonContext(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON context: ${error.message}`);
  }
}

function expectSelfTest(name, context, expectedProfile, extraAssert) {
  const resolved = resolveProfile(context);
  if (resolved.profile !== expectedProfile) {
    throw new Error(`${name} expected ${expectedProfile}, got ${resolved.profile}`);
  }
  if (extraAssert) {
    extraAssert(resolved);
  }
  process.stdout.write(`[profile-resolver] ${name} passed\n`);
}

function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes('--help')) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  const profiles = loadRegistry();

  if (argv.includes('--list')) {
    process.stdout.write(`${Object.keys(profiles).join('\n')}\n`);
    return 0;
  }

  const resolveIndex = argv.indexOf('--resolve');
  if (resolveIndex !== -1) {
    const raw = argv[resolveIndex + 1];
    if (raw === undefined) {
      throw new Error('--resolve requires a JSON context argument');
    }
    const resolved = resolveProfile(parseJsonContext(raw), profiles);
    process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
    return 0;
  }

  if (argv.includes('--self-test-plan')) {
    expectSelfTest('self-test-plan', { phase_type: 'plan' }, 'codex.plan');
    return 0;
  }

  if (argv.includes('--self-test-bounded')) {
    expectSelfTest(
      'self-test-bounded',
      { phase_type: 'execute', risk: 'low', allowed_files: ['src/x.ts'] },
      'codex.execute.bounded',
      (resolved) => {
        if (resolved.requires_worktree !== true || resolved.native_review_required !== true) {
          throw new Error('codex.execute.bounded must require worktree and native review');
        }
      },
    );
    return 0;
  }

  if (argv.includes('--self-test-audit')) {
    expectSelfTest('self-test-audit', { phase_type: 'audit' }, 'codex.readonly.audit');
    return 0;
  }

  throw new Error(`Unknown arguments: ${argv.join(' ')}`);
}

if (require.main === module) {
  try {
    process.exitCode = main();
  } catch (error) {
    process.stderr.write(`[profile-resolver] ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  REGISTRY_PATH,
  REQUIRED_PROFILE_FIELDS,
  loadRegistry,
  validateProfiles,
  resolveProfileName,
  resolveProfile,
  requireDependency,
};
