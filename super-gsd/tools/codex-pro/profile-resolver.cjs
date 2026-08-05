#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
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

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const REGISTRY_PATH = path.resolve(__dirname, '..', '..', 'registry', 'codex-profiles.yaml');
const DEFAULT_PROFILE_RESOLUTION_LOG = path.resolve(REPO_ROOT, '.planning', 'metrics', 'codex-profile-resolution-log.jsonl');

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

const REQUIRED_CLI_PROFILE_FIELDS = [
  'model',
  'reasoning',
  'sandbox',
  'ephemeral',
  'approval',
];

const CLI_PROFILE_NAMES = ['executor', 'review', 'triage'];
const CLI_PROFILE_ALIASES = {
  'codex.review.native': 'review',
};

const SAFE_SCALAR_RE = /^[A-Za-z0-9._:@/+,-]+$/;
const ALLOWED_SANDBOXES = new Set(['read-only', 'workspace-write', 'danger-full-access']);
const ALLOWED_APPROVALS = new Set(['never', 'auto', 'full-auto', 'on-request', 'on-failure']);
const MUTABLE_CLI_FIELDS = new Set([
  'model',
  'reasoning',
  'sandbox',
  'ephemeral',
  'approval',
  'trust',
  'trust_required',
  'hook_trust',
  'hooks_required',
]);

const BUILTIN_CLI_PROFILES = Object.freeze({
  executor: Object.freeze({
    model: 'gpt-5.5',
    reasoning: 'xhigh',
    sandbox: 'workspace-write',
    ephemeral: false,
    approval: 'full-auto',
  }),
  review: Object.freeze({
    model: 'gpt-5.5',
    reasoning: 'xhigh',
    sandbox: 'read-only',
    ephemeral: true,
    approval: 'never',
  }),
  triage: Object.freeze({
    model: 'gpt-5.5',
    reasoning: 'xhigh',
    sandbox: 'read-only',
    ephemeral: false,
    approval: 'never',
  }),
});

function usage() {
  return [
    'Usage:',
    '  node profile-resolver.cjs [--help] [--resolve <json-context>] [--list]',
    '                            [--resolve-cli <profile>] [--default-cli <profile>]',
    '                            [--show-cli] [--set-cli <profile> <field> <value> [--confirm <phrase>]]',
    '                            [--registry <path>]',
    '                            [--self-test-plan] [--self-test-bounded] [--self-test-audit]',
    '                            [--self-test-cli-registry] [--self-test-cli-parity]',
    '                            [--self-test-cli-fail-open] [--self-test-cli-guard]',
    '',
    'Resolves Codex Pro Mode dispatch context and SGSD Codex CLI profiles.',
    '',
    'Examples:',
    '  node profile-resolver.cjs --list',
    '  node profile-resolver.cjs --resolve "{\\"phase_type\\":\\"execute\\",\\"risk\\":\\"low\\",\\"allowed_files\\":[\\"src/x.ts\\"]}"',
    '  node profile-resolver.cjs --resolve-cli review',
  ].join('\n');
}

function optionValue(argv, flag, fallback = undefined) {
  const index = argv.indexOf(flag);
  if (index === -1) return fallback;
  const value = argv[index + 1];
  if (value === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function registryPathFromArgv(argv) {
  return path.resolve(optionValue(argv, '--registry', process.env.SGSD_CODEX_PROFILES_REGISTRY || REGISTRY_PATH));
}

function logPathFromEnv() {
  return path.resolve(process.env.SGSD_CODEX_PROFILE_LOG || DEFAULT_PROFILE_RESOLUTION_LOG);
}

function readYamlRegistry(registryPath = REGISTRY_PATH) {
  const raw = fs.readFileSync(registryPath, 'utf8');
  const parsed = yaml.load(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid Codex profile registry: ${registryPath}`);
  }
  return parsed;
}

function loadRegistry(registryPath = REGISTRY_PATH) {
  const parsed = readYamlRegistry(registryPath);
  if (!parsed.profiles || typeof parsed.profiles !== 'object') {
    throw new Error(`Invalid Codex Pro profile registry: ${registryPath}`);
  }
  validateProfiles(parsed.profiles);
  return parsed.profiles;
}

function loadFullRegistry(registryPath = REGISTRY_PATH) {
  const parsed = readYamlRegistry(registryPath);
  if (!parsed.profiles || typeof parsed.profiles !== 'object') {
    throw new Error(`Invalid Codex Pro profile registry: ${registryPath}`);
  }
  validateProfiles(parsed.profiles);
  if (!parsed.cli_profiles || typeof parsed.cli_profiles !== 'object') {
    throw new Error(`CLI profile registry missing cli_profiles: ${registryPath}`);
  }
  parsed.cli_profiles = validateCliProfiles(parsed.cli_profiles);
  return parsed;
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

function validateSafeScalar(label, value) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || !SAFE_SCALAR_RE.test(value)) {
    throw new Error(`${label} must be a non-empty safe scalar`);
  }
  return value;
}

function validateCliProfile(name, profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new Error(`CLI profile ${name} must be an object`);
  }
  const missing = REQUIRED_CLI_PROFILE_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(profile, field));
  if (missing.length > 0) {
    throw new Error(`CLI profile ${name} missing required fields: ${missing.join(', ')}`);
  }

  const model = validateSafeScalar(`CLI profile ${name}.model`, String(profile.model));
  const reasoning = validateSafeScalar(`CLI profile ${name}.reasoning`, String(profile.reasoning));
  const sandbox = validateSafeScalar(`CLI profile ${name}.sandbox`, String(profile.sandbox));
  const approval = validateSafeScalar(`CLI profile ${name}.approval`, String(profile.approval));

  if (!ALLOWED_SANDBOXES.has(sandbox)) {
    throw new Error(`CLI profile ${name}.sandbox invalid: ${sandbox}`);
  }
  if (typeof profile.ephemeral !== 'boolean') {
    throw new Error(`CLI profile ${name}.ephemeral must be boolean`);
  }
  if (!ALLOWED_APPROVALS.has(approval)) {
    throw new Error(`CLI profile ${name}.approval invalid: ${approval}`);
  }

  return {
    ...profile,
    model,
    reasoning,
    sandbox,
    ephemeral: profile.ephemeral,
    approval,
  };
}

function validateCliProfiles(cliProfiles) {
  const normalized = {};
  for (const name of CLI_PROFILE_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(cliProfiles, name)) {
      throw new Error(`CLI profile registry missing ${name}`);
    }
    normalized[name] = validateCliProfile(name, cliProfiles[name]);
  }
  return normalized;
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

function normalizeCliProfileName(name) {
  if (typeof name !== 'string' || name.trim() === '') return null;
  const trimmed = name.trim();
  return CLI_PROFILE_ALIASES[trimmed] || trimmed;
}

function builtinCliProfileName(name) {
  const normalized = normalizeCliProfileName(name);
  return CLI_PROFILE_NAMES.includes(normalized) ? normalized : null;
}

function fallbackCliProfileName(name) {
  return builtinCliProfileName(name) || 'review';
}

function cloneCliProfile(profile) {
  return {
    ...profile,
    ephemeral: profile.ephemeral === true,
  };
}

function defaultFlagFragment(profile) {
  if (profile.approval === 'full-auto') return '--full-auto';
  return profile.ephemeral ? `--sandbox ${profile.sandbox} --ephemeral` : `--sandbox ${profile.sandbox}`;
}

function fallbackReason(error) {
  if (!error) return 'unknown_profile';
  if (error.code === 'ENOENT') return 'registry_missing';
  if (error.name === 'YAMLException') return 'registry_corrupt';
  if (/bad indentation|duplicated mapping key|can not read|unexpected end/i.test(error.message || '')) return 'registry_corrupt';
  return 'invalid_registry';
}

function jsonEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

function appendProfileResolutionLog(event, options = {}) {
  const logPath = path.resolve(options.logPath || logPathFromEnv());
  const row = {
    ts: new Date().toISOString(),
    subsystem: 'codex-profile-resolution',
    ...event,
  };
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify(row)}\n`, 'utf8');
  } catch (error) {
    process.stderr.write(`[profile-resolver] unable to append profile log: ${error.message}\n`);
  }
}

function resolveCliProfile(requestedProfile, options = {}) {
  const registryPath = path.resolve(options.registryPath || REGISTRY_PATH);
  const defaultProfile = normalizeCliProfileName(options.defaultProfile || 'review') || 'review';
  const requested = requestedProfile || defaultProfile;
  const normalizedRequested = normalizeCliProfileName(requested);
  const fallbackProfile = fallbackCliProfileName(requested);
  const logOptions = { logPath: options.logPath };

  try {
    const registry = loadFullRegistry(registryPath);
    if (!normalizedRequested || !Object.prototype.hasOwnProperty.call(registry.cli_profiles, normalizedRequested)) {
      const resolved = {
        requested_profile: requested,
        profile: fallbackProfile,
        status: 'fallback',
        reason: 'unknown_profile',
        registry_path: registryPath,
        source: 'built-in',
        profile_data: cloneCliProfile(BUILTIN_CLI_PROFILES[fallbackProfile]),
      };
      appendProfileResolutionLog({
        action: 'resolve-cli',
        status: 'fallback',
        reason: 'unknown_profile',
        requested_profile: requested,
        resolved_profile: fallbackProfile,
        registry_path: registryPath,
      }, logOptions);
      return resolved;
    }
    return {
      requested_profile: requested,
      profile: normalizedRequested,
      status: 'ok',
      reason: 'registry',
      registry_path: registryPath,
      source: 'registry',
      profile_data: cloneCliProfile(registry.cli_profiles[normalizedRequested]),
    };
  } catch (error) {
    const reason = fallbackReason(error);
    const resolved = {
      requested_profile: requested,
      profile: fallbackProfile,
      status: 'fallback',
      reason,
      registry_path: registryPath,
      source: 'built-in',
      profile_data: cloneCliProfile(BUILTIN_CLI_PROFILES[fallbackProfile]),
    };
    appendProfileResolutionLog({
      action: 'resolve-cli',
      status: 'fallback',
      reason,
      requested_profile: requested,
      resolved_profile: fallbackProfile,
      registry_path: registryPath,
      error: error.message,
    }, logOptions);
    return resolved;
  }
}

function assertSafeKeyValue(key, value) {
  if (!/^[A-Z0-9_]+$/.test(key)) {
    throw new Error(`Unsafe KEY output: ${key}`);
  }
  const stringValue = String(value);
  if (/[\r\n=]/.test(stringValue)) {
    throw new Error(`Unsafe VALUE output for ${key}`);
  }
  return `${key}=${stringValue}`;
}

function cliResolutionToKeyValue(resolution) {
  const profile = resolution.profile_data;
  const rows = {
    CODEX_PROFILE_REQUESTED: resolution.requested_profile,
    CODEX_PROFILE: resolution.profile,
    CODEX_PROFILE_STATUS: resolution.status,
    CODEX_PROFILE_REASON: resolution.reason,
    CODEX_PROFILE_SOURCE: resolution.source,
    CODEX_MODEL: profile.model,
    CODEX_REASONING_EFFORT: profile.reasoning,
    CODEX_SANDBOX: profile.sandbox,
    CODEX_EPHEMERAL: profile.ephemeral ? 'true' : 'false',
    CODEX_APPROVAL: profile.approval,
    CODEX_FULL_AUTO: profile.approval === 'full-auto' ? 'true' : 'false',
    CODEX_DEFAULT_FLAG_FRAGMENT: defaultFlagFragment(profile),
  };
  return `${Object.entries(rows).map(([key, value]) => assertSafeKeyValue(key, value)).join('\n')}\n`;
}

function showCliProfiles(options = {}) {
  const registryPath = path.resolve(options.registryPath || REGISTRY_PATH);
  try {
    const registry = loadFullRegistry(registryPath);
    return {
      status: 'ok',
      reason: 'registry',
      registry_path: registryPath,
      cli_profiles: registry.cli_profiles,
    };
  } catch (error) {
    const reason = fallbackReason(error);
    appendProfileResolutionLog({
      action: 'show-cli',
      status: 'fallback',
      reason,
      registry_path: registryPath,
      error: error.message,
    }, { logPath: options.logPath });
    return {
      status: 'fallback',
      reason,
      registry_path: registryPath,
      cli_profiles: cloneBuiltinCliProfiles(),
    };
  }
}

function cloneBuiltinCliProfiles() {
  return Object.fromEntries(Object.entries(BUILTIN_CLI_PROFILES).map(([name, profile]) => [name, cloneCliProfile(profile)]));
}

function coerceFieldValue(field, value) {
  if (!MUTABLE_CLI_FIELDS.has(field)) {
    throw new Error(`Unsupported CLI profile field: ${field}`);
  }
  if (field === 'ephemeral' || field === 'trust_required' || field === 'hooks_required') {
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`${field} must be true or false`);
  }
  const scalar = validateSafeScalar(field, String(value));
  if (field === 'sandbox' && !ALLOWED_SANDBOXES.has(scalar)) {
    throw new Error(`sandbox invalid: ${scalar}`);
  }
  if (field === 'approval' && !ALLOWED_APPROVALS.has(scalar)) {
    throw new Error(`approval invalid: ${scalar}`);
  }
  return scalar;
}

function confirmationPhrase(profileName, field, value) {
  return `CONFIRM SGSD CODEX PROFILE ${profileName} ${field} ${String(value)}`;
}

function isDangerousCliMutation(field, value) {
  const normalizedField = String(field).toLowerCase();
  const normalizedValue = String(value).toLowerCase();
  if (normalizedField === 'sandbox' && normalizedValue === 'danger-full-access') return true;
  if (normalizedField.includes('approval')) return normalizedValue !== 'never';
  if (normalizedField.includes('trust') || normalizedField.includes('hook')) {
    return normalizedValue !== 'false' && normalizedValue !== 'never';
  }
  return false;
}

function assertCliMutationGuard(profileName, field, rawValue, coercedValue, registryPath, options = {}) {
  if (!isDangerousCliMutation(field, coercedValue)) return;
  const phrase = confirmationPhrase(profileName, field, rawValue);
  const confirm = String(options.confirm || '');
  const ttyOverride = options.ttyOk === true || process.env.SGSD_CODEX_CONTROL_TTY_OK === '1';
  const hasTty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const reason = confirm !== phrase ? 'confirmation_required' : 'non_tty_guarded_mutation';
  if (confirm === phrase && (ttyOverride || hasTty)) return;

  appendProfileResolutionLog({
    action: 'set-cli',
    status: 'refuse',
    reason,
    requested_profile: profileName,
    resolved_profile: profileName,
    field,
    value: String(rawValue),
    registry_path: registryPath,
    required_confirmation: phrase,
  }, { logPath: options.logPath });
  throw new Error(`dangerous CLI profile mutation requires interactive TTY and --confirm "${phrase}"`);
}

function fingerprintFile(filePath) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
  } catch (_error) {
    return null;
  }
}

function setCliProfileField(profileName, field, value, options = {}) {
  const registryPath = path.resolve(options.registryPath || REGISTRY_PATH);
  const normalizedProfile = normalizeCliProfileName(profileName);
  if (!CLI_PROFILE_NAMES.includes(normalizedProfile)) {
    throw new Error(`Unknown CLI profile: ${profileName}`);
  }
  const coerced = coerceFieldValue(field, value);
  assertCliMutationGuard(normalizedProfile, field, value, coerced, registryPath, options);
  const before_fingerprint = fingerprintFile(registryPath);
  const registry = loadFullRegistry(registryPath);
  registry.cli_profiles[normalizedProfile][field] = coerced;
  registry.cli_profiles = validateCliProfiles(registry.cli_profiles);

  const dumped = yaml.dump(registry, { lineWidth: -1, noRefs: true, sortKeys: false });
  const tmpPath = `${registryPath}.tmp-${process.pid}`;
  fs.writeFileSync(tmpPath, dumped, 'utf8');
  fs.renameSync(tmpPath, registryPath);
  const after_fingerprint = fingerprintFile(registryPath);

  appendProfileResolutionLog({
    action: 'set-cli',
    status: 'set',
    requested_profile: profileName,
    resolved_profile: normalizedProfile,
    field,
    value: String(value),
    registry_path: registryPath,
    before_fingerprint,
    after_fingerprint,
  }, { logPath: options.logPath });

  return {
    status: 'set',
    profile: normalizedProfile,
    field,
    value: coerced,
    before_fingerprint,
    after_fingerprint,
    registry_path: registryPath,
  };
}

function logControlOutcome(event, options = {}) {
  appendProfileResolutionLog({ action: 'control', ...event }, { logPath: options.logPath });
}

function shellQuoteDouble(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function buildExecutorResolvedCommand({ profile, timeout, promptFile, model, reasoning, codexCd, launcher }) {
  const command = launcher === 'cmd' ? 'cmd.exe /c codex' : 'codex';
  let profileFlags;
  if (profile.approval === 'full-auto') {
    profileFlags = '--full-auto';
  } else {
    profileFlags = `--sandbox ${profile.sandbox}${profile.ephemeral ? ' --ephemeral' : ''}`;
  }
  return `timeout ${timeout}s bash -c 'cat "\$0" | ${command} exec ${profileFlags} --model "\$1" -c "model_reasoning_effort=\\"\$2\\"" --skip-git-repo-check --cd "\$3" -' ${shellQuoteDouble(promptFile)} ${shellQuoteDouble(model)} ${shellQuoteDouble(reasoning)} ${shellQuoteDouble(codexCd)}`;
}

function buildReviewResolvedCommand({ profile, timeout, promptFile, project, launcher, command, model, reasoning }) {
  const profileFlags = `--sandbox ${profile.sandbox}${profile.ephemeral ? ' --ephemeral' : ''}`;
  return `timeout ${timeout}s bash -c 'if [[ "\$2" == "cmd" ]]; then cat "\$0" | cmd.exe /c codex exec --model "\$4" -c "model_reasoning_effort=\\"\$5\\"" ${profileFlags} --skip-git-repo-check --cd "\$1" -; else cat "\$0" | "\$3" exec --model "\$4" -c "model_reasoning_effort=\\"\$5\\"" ${profileFlags} --skip-git-repo-check --cd "\$1" -; fi' ${shellQuoteDouble(promptFile)} ${shellQuoteDouble(project)} ${shellQuoteDouble(launcher)} ${shellQuoteDouble(command)} ${shellQuoteDouble(model)} ${shellQuoteDouble(reasoning)}`;
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

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function makeTempRegistry(cliProfiles = cloneBuiltinCliProfiles()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-codex-profiles-'));
  const registryPath = path.join(dir, 'codex-profiles.yaml');
  const profiles = loadRegistry(REGISTRY_PATH);
  fs.writeFileSync(registryPath, yaml.dump({ profiles, cli_profiles: cliProfiles }, { lineWidth: -1, noRefs: true, sortKeys: false }), 'utf8');
  return { dir, registryPath, logPath: path.join(dir, 'codex-profile-resolution-log.jsonl') };
}

function countJsonlRows(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean).length;
}

function selfTestCliRegistry() {
  const registry = loadFullRegistry(REGISTRY_PATH);
  expect(Object.keys(registry.profiles).length === 10, 'profiles map must still contain exactly 10 entries');
  for (const name of CLI_PROFILE_NAMES) {
    expect(Object.prototype.hasOwnProperty.call(registry.cli_profiles, name), `cli_profiles missing ${name}`);
  }
  expect(registry.cli_profiles.executor.model === 'gpt-5.5', 'executor model default drifted');
  expect(registry.cli_profiles.executor.reasoning === 'xhigh', 'executor reasoning default drifted');
  expect(registry.cli_profiles.executor.sandbox === 'workspace-write', 'executor sandbox default drifted');
  expect(registry.cli_profiles.executor.ephemeral === false, 'executor ephemeral default drifted');
  expect(defaultFlagFragment(registry.cli_profiles.executor) === '--full-auto', 'executor default_flag_fragment must be --full-auto');
  expect(registry.cli_profiles.review.sandbox === 'read-only', 'review sandbox default drifted');
  expect(registry.cli_profiles.review.ephemeral === true, 'review ephemeral default drifted');
  expect(registry.cli_profiles.triage.sandbox === 'read-only', 'triage sandbox default drifted');
  expect(registry.cli_profiles.triage.ephemeral === false, 'triage must default non-ephemeral');
  expect(resolveCliProfile('codex.review.native', { registryPath: REGISTRY_PATH }).profile === 'review', 'codex.review.native must alias to review');
  process.stdout.write('[profile-resolver] self-test-cli-registry passed\n');
  return 0;
}

function selfTestCliParity() {
  const prompt = 'prompt.md';
  const project = 'PROJECT';
  const model = 'gpt-5.5';
  const reasoning = 'xhigh';
  const executor = cloneCliProfile(BUILTIN_CLI_PROFILES.executor);
  const review = cloneCliProfile(BUILTIN_CLI_PROFILES.review);
  const triage = cloneCliProfile(BUILTIN_CLI_PROFILES.triage);

  const expectedExecutorDirect = 'timeout 1200s bash -c \'cat "$0" | codex exec --full-auto --model "$1" -c "model_reasoning_effort=\\"$2\\"" --skip-git-repo-check --cd "$3" -\' "prompt.md" "gpt-5.5" "xhigh" "PROJECT"';
  const expectedExecutorCmd = 'timeout 1200s bash -c \'cat "$0" | cmd.exe /c codex exec --full-auto --model "$1" -c "model_reasoning_effort=\\"$2\\"" --skip-git-repo-check --cd "$3" -\' "prompt.md" "gpt-5.5" "xhigh" "PROJECT"';
  const expectedReviewDirect = 'timeout 30s bash -c \'if [[ "$2" == "cmd" ]]; then cat "$0" | cmd.exe /c codex exec --model "$4" -c "model_reasoning_effort=\\"$5\\"" --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -; else cat "$0" | "$3" exec --model "$4" -c "model_reasoning_effort=\\"$5\\"" --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -; fi\' "prompt.md" "PROJECT" "direct" "codex" "gpt-5.5" "xhigh"';
  const expectedReviewCmd = 'timeout 30s bash -c \'if [[ "$2" == "cmd" ]]; then cat "$0" | cmd.exe /c codex exec --model "$4" -c "model_reasoning_effort=\\"$5\\"" --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -; else cat "$0" | "$3" exec --model "$4" -c "model_reasoning_effort=\\"$5\\"" --sandbox read-only --ephemeral --skip-git-repo-check --cd "$1" -; fi\' "prompt.md" "PROJECT" "cmd" "cmd.exe" "gpt-5.5" "xhigh"';
  const expectedTriageDirect = 'timeout 30s bash -c \'if [[ "$2" == "cmd" ]]; then cat "$0" | cmd.exe /c codex exec --model "$4" -c "model_reasoning_effort=\\"$5\\"" --sandbox read-only --skip-git-repo-check --cd "$1" -; else cat "$0" | "$3" exec --model "$4" -c "model_reasoning_effort=\\"$5\\"" --sandbox read-only --skip-git-repo-check --cd "$1" -; fi\' "prompt.md" "PROJECT" "direct" "codex" "gpt-5.5" "xhigh"';
  const expectedTriageCmd = 'timeout 30s bash -c \'if [[ "$2" == "cmd" ]]; then cat "$0" | cmd.exe /c codex exec --model "$4" -c "model_reasoning_effort=\\"$5\\"" --sandbox read-only --skip-git-repo-check --cd "$1" -; else cat "$0" | "$3" exec --model "$4" -c "model_reasoning_effort=\\"$5\\"" --sandbox read-only --skip-git-repo-check --cd "$1" -; fi\' "prompt.md" "PROJECT" "cmd" "cmd.exe" "gpt-5.5" "xhigh"';

  expect(buildExecutorResolvedCommand({ profile: executor, timeout: 1200, promptFile: prompt, model, reasoning, codexCd: project, launcher: 'direct' }) === expectedExecutorDirect, 'executor direct dry-run parity failed');
  expect(buildExecutorResolvedCommand({ profile: executor, timeout: 1200, promptFile: prompt, model, reasoning, codexCd: project, launcher: 'cmd' }) === expectedExecutorCmd, 'executor cmd dry-run parity failed');
  expect(buildReviewResolvedCommand({ profile: review, timeout: 30, promptFile: prompt, project, launcher: 'direct', command: 'codex', model, reasoning }) === expectedReviewDirect, 'review direct dry-run parity failed');
  expect(buildReviewResolvedCommand({ profile: review, timeout: 30, promptFile: prompt, project, launcher: 'cmd', command: 'cmd.exe', model, reasoning }) === expectedReviewCmd, 'review cmd dry-run parity failed');
  expect(buildReviewResolvedCommand({ profile: triage, timeout: 30, promptFile: prompt, project, launcher: 'direct', command: 'codex', model, reasoning }) === expectedTriageDirect, 'triage direct dry-run parity failed');
  expect(buildReviewResolvedCommand({ profile: triage, timeout: 30, promptFile: prompt, project, launcher: 'cmd', command: 'cmd.exe', model, reasoning }) === expectedTriageCmd, 'triage cmd dry-run parity failed');
  process.stdout.write('[profile-resolver] self-test-cli-parity passed\n');
  return 0;
}

function selfTestCliFailOpen() {
  const fixture = makeTempRegistry();
  const missingPath = path.join(fixture.dir, 'missing.yaml');
  const missing = resolveCliProfile('executor', { registryPath: missingPath, defaultProfile: 'executor', logPath: fixture.logPath });
  expect(missing.status === 'fallback' && missing.reason === 'registry_missing' && missing.profile === 'executor', 'missing registry must fall back to executor default');

  const corruptPath = path.join(fixture.dir, 'corrupt.yaml');
  fs.writeFileSync(corruptPath, 'profiles: [\n  nope: : :\n', 'utf8');
  const corrupt = resolveCliProfile('review', { registryPath: corruptPath, defaultProfile: 'review', logPath: fixture.logPath });
  expect(corrupt.status === 'fallback' && corrupt.reason === 'registry_corrupt' && corrupt.profile === 'review', 'corrupt registry must fall back to review default');

  const corruptRequestedReview = resolveCliProfile('review', { registryPath: corruptPath, defaultProfile: 'executor', logPath: fixture.logPath });
  expect(corruptRequestedReview.status === 'fallback' && corruptRequestedReview.reason === 'registry_corrupt' && corruptRequestedReview.profile === 'review', 'corrupt registry must fall back to requested review built-in, not wrapper executor');
  expect(corruptRequestedReview.profile_data.sandbox === 'read-only' && corruptRequestedReview.profile_data.approval === 'never', 'requested review fallback must stay read-only/never');

  const invalidProfiles = cloneBuiltinCliProfiles();
  invalidProfiles.triage.sandbox = 'moon';
  const invalid = makeTempRegistry(invalidProfiles);
  const invalidResolution = resolveCliProfile('triage', { registryPath: invalid.registryPath, defaultProfile: 'triage', logPath: fixture.logPath });
  expect(invalidResolution.status === 'fallback' && invalidResolution.reason === 'invalid_registry' && invalidResolution.profile === 'triage', 'invalid field must fall back to triage default');

  const unknown = resolveCliProfile('unknown.profile', { registryPath: fixture.registryPath, defaultProfile: 'executor', logPath: fixture.logPath });
  expect(unknown.status === 'fallback' && unknown.reason === 'unknown_profile' && unknown.profile === 'review', 'unknown profile must fail closed to review');

  const shellOutput = cliResolutionToKeyValue(unknown);
  expect(shellOutput.includes('CODEX_PROFILE=review\n'), 'KEY=VALUE output must include resolved profile');
  expect(shellOutput.split(/\r?\n/).filter(Boolean).every((line) => /^[A-Z0-9_]+=[^=\r\n]*$/.test(line)), 'KEY=VALUE output must be sanitized');
  expect(countJsonlRows(fixture.logPath) >= 4, 'fallback self-test must append loud JSONL rows');
  process.stdout.write('[profile-resolver] self-test-cli-fail-open passed\n');
  return 0;
}

function selfTestCliGuard() {
  const fixture = makeTempRegistry();
  const before = fingerprintFile(fixture.registryPath);
  const previousLogPath = process.env.SGSD_CODEX_PROFILE_LOG;
  const previousTtyOk = process.env.SGSD_CODEX_CONTROL_TTY_OK;
  let refusalMessage = '';
  process.env.SGSD_CODEX_PROFILE_LOG = fixture.logPath;
  delete process.env.SGSD_CODEX_CONTROL_TTY_OK;
  try {
    main(['--set-cli', 'triage', 'sandbox', 'danger-full-access', '--registry', fixture.registryPath]);
  } catch (error) {
    refusalMessage = error.message;
  } finally {
    if (previousLogPath === undefined) delete process.env.SGSD_CODEX_PROFILE_LOG;
    else process.env.SGSD_CODEX_PROFILE_LOG = previousLogPath;
    if (previousTtyOk === undefined) delete process.env.SGSD_CODEX_CONTROL_TTY_OK;
    else process.env.SGSD_CODEX_CONTROL_TTY_OK = previousTtyOk;
  }
  const after = fingerprintFile(fixture.registryPath);
  expect(refusalMessage.includes('CONFIRM SGSD CODEX PROFILE triage sandbox danger-full-access'), 'non-TTY resolver --set-cli danger-full-access must refuse with exact confirmation phrase');
  expect(after === before, 'refused resolver danger mutation must not alter registry');

  const safeResult = setCliProfileField('triage', 'ephemeral', 'true', { registryPath: fixture.registryPath, logPath: fixture.logPath });
  const updated = loadFullRegistry(fixture.registryPath);
  expect(safeResult.status === 'set' && updated.cli_profiles.triage.ephemeral === true, 'non-dangerous resolver --set-cli must remain unchanged');

  process.stdout.write('[profile-resolver] self-test-cli-guard passed\n');
  return 0;
}

function main(argv = process.argv.slice(2)) {
  if (argv.length === 0 || argv.includes('--help')) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }

  const registryPath = registryPathFromArgv(argv);
  const logPath = logPathFromEnv();

  if (argv.includes('--list')) {
    const profiles = loadRegistry(registryPath);
    process.stdout.write(`${Object.keys(profiles).join('\n')}\n`);
    return 0;
  }

  const resolveIndex = argv.indexOf('--resolve');
  if (resolveIndex !== -1) {
    const raw = argv[resolveIndex + 1];
    if (raw === undefined) {
      throw new Error('--resolve requires a JSON context argument');
    }
    const profiles = loadRegistry(registryPath);
    const resolved = resolveProfile(parseJsonContext(raw), profiles);
    process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
    return 0;
  }

  const resolveCliIndex = argv.indexOf('--resolve-cli');
  if (resolveCliIndex !== -1) {
    const rawProfile = argv[resolveCliIndex + 1];
    if (rawProfile === undefined) {
      throw new Error('--resolve-cli requires a profile argument');
    }
    const defaultProfile = optionValue(argv, '--default-cli', rawProfile);
    const resolved = resolveCliProfile(rawProfile, { registryPath, defaultProfile, logPath });
    process.stdout.write(cliResolutionToKeyValue(resolved));
    return 0;
  }

  if (argv.includes('--show-cli')) {
    process.stdout.write(`${JSON.stringify(showCliProfiles({ registryPath, logPath }), null, 2)}\n`);
    return 0;
  }

  const setCliIndex = argv.indexOf('--set-cli');
  if (setCliIndex !== -1) {
    const profile = argv[setCliIndex + 1];
    const field = argv[setCliIndex + 2];
    const value = argv[setCliIndex + 3];
    if (profile === undefined || field === undefined || value === undefined) {
      throw new Error('--set-cli requires <profile> <field> <value>');
    }
    const confirm = optionValue(argv, '--confirm', '');
    process.stdout.write(`${JSON.stringify(setCliProfileField(profile, field, value, { registryPath, logPath, confirm }), null, 2)}\n`);
    return 0;
  }

  const logControlIndex = argv.indexOf('--log-cli-control');
  if (logControlIndex !== -1) {
    const raw = argv[logControlIndex + 1];
    if (raw === undefined) {
      throw new Error('--log-cli-control requires a JSON event argument');
    }
    logControlOutcome(parseJsonContext(raw), { logPath });
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

  if (argv.includes('--self-test-cli-registry')) {
    return selfTestCliRegistry();
  }

  if (argv.includes('--self-test-cli-parity')) {
    return selfTestCliParity();
  }

  if (argv.includes('--self-test-cli-fail-open')) {
    return selfTestCliFailOpen();
  }

  if (argv.includes('--self-test-cli-guard')) {
    return selfTestCliGuard();
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
  REPO_ROOT,
  REGISTRY_PATH,
  DEFAULT_PROFILE_RESOLUTION_LOG,
  REQUIRED_PROFILE_FIELDS,
  REQUIRED_CLI_PROFILE_FIELDS,
  CLI_PROFILE_NAMES,
  CLI_PROFILE_ALIASES,
  BUILTIN_CLI_PROFILES,
  loadRegistry,
  loadFullRegistry,
  validateProfiles,
  validateCliProfiles,
  resolveProfileName,
  resolveProfile,
  resolveCliProfile,
  cliResolutionToKeyValue,
  showCliProfiles,
  setCliProfileField,
  logControlOutcome,
  buildExecutorResolvedCommand,
  buildReviewResolvedCommand,
  requireDependency,
};
