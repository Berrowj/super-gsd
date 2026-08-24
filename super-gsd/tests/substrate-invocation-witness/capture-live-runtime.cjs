#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { substratePayloadDigest } = require('../../scripts/lib/vtp-context-composer.cjs');

const EVIDENCE_SCHEMA_VERSION = 'sgsd.p167.real-mcp-hook-evidence.v1';
const MIN_CLAUDE_VERSION = [2, 1, 240];
const SHORT_TOOL = 'vtp_search_substrate';
const TARGET_TOOL = 'mcp__vtp-kb__vtp_search_substrate';
const BYPASS_TOOL = 'mcp__vtp-kb-bypass__vtp_search_substrate';
const PRE_HOOK_ID = 'pre-tool-use-substrate-invocation-witness';
const POST_HOOK_ID = 'post-tool-use-substrate-invocation-witness';
const HOOK_MATCHER = TARGET_TOOL;
const DENIAL_REASON = 'substrate_witness_denied:invalid_v2_payload';
const DEGRADATION_REASON = 'vtp_substrate_hit_truncated';
const UNAVAILABLE_PREFIX = 'substrate_witness_unavailable:';
const OVERSIZED_HIT_CHARS = 16001;
const RETAINED_HIT_CHARS = 16000;
const DEFAULT_TIMEOUT_MS = 300000;
const AUTH_ENV_KEYS = Object.freeze(['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY']);
const FIXTURE_RELATIVE_PATH = path.join(
  'super-gsd', 'tests', 'substrate-invocation-witness', 'fixture-vtp-mcp-server.cjs',
);
const CAPTURE_RELATIVE_PATH = path.join(
  'super-gsd', 'tests', 'substrate-invocation-witness', 'capture-live-runtime.cjs',
);
const HOOK_RELATIVE_PATH = path.join(
  'super-gsd', 'hooks', 'sgsd-substrate-invocation-witness.cjs',
);
const BROKER_RELATIVE_PATH = path.join(
  'super-gsd', 'tools', 'substrate-capability-broker.cjs',
);
const STORE_RELATIVE_PATH = path.join(
  'super-gsd', 'scripts', 'lib', 'substrate-invocation-witness-store.cjs',
);
const COMPOSER_RELATIVE_PATH = path.join(
  'super-gsd', 'scripts', 'lib', 'vtp-context-composer.cjs',
);
const AUDIT_RELATIVE_PATH = path.join(
  'super-gsd', 'tools', 'feature-propagation', 'audit.cjs',
);
const OVERLAY_RELATIVE_PATH = path.join('super-gsd', 'config', 'repo-settings-overlay.json');
const FROZEN_FILES = Object.freeze([
  'super-gsd/schemas/vtp-mcp-input-schemas.v1.json',
  '.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json',
]);

class HarnessFailure extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'HarnessFailure';
  }
}

function requireCondition(condition, reason) {
  if (!condition) throw new HarnessFailure(reason);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function fileSha256(filePath) {
  return sha256(fs.readFileSync(filePath));
}

function payloadDigest(payload) {
  return substratePayloadDigest(payload);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function valueDigest(value) {
  return sha256(Buffer.from(JSON.stringify(canonicalize(value)), 'utf8'));
}

function readJson(filePath, reason = 'json_invalid') {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  } catch (_) {
    throw new HarnessFailure(reason);
  }
}

function writePrivateJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + '\n', {
    encoding: 'utf8',
    mode: 0o600,
  });
  if (process.platform !== 'win32') fs.chmodSync(filePath, 0o600);
}

function isContained(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (relative !== '..'
    && !relative.startsWith('..' + path.sep)
    && !path.isAbsolute(relative));
}

function atomicWriteEvidence(projectRoot, evidencePath, evidence) {
  const target = path.resolve(evidencePath);
  requireCondition(isContained(projectRoot, target), 'evidence_path_outside_project');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = target + '.tmp-' + crypto.randomBytes(8).toString('hex');
  const bytes = Buffer.from(JSON.stringify(evidence, null, 2) + '\n', 'utf8');
  let descriptor;
  try {
    descriptor = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    fs.renameSync(temporary, target);
    if (process.platform !== 'win32') fs.chmodSync(target, 0o600);
  } finally {
    if (descriptor !== null && descriptor !== undefined) fs.closeSync(descriptor);
    try { fs.unlinkSync(temporary); } catch (_) {}
  }
}

function cliValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] || null;
}

function parseArgs(argv) {
  const capture = argv.includes('--capture');
  const verify = argv.includes('--verify');
  requireCondition(capture !== verify, 'choose_exactly_one_mode');
  const projectRoot = path.resolve(cliValue(argv, '--project-dir') || process.cwd());
  const evidenceValue = cliValue(argv, '--evidence-file');
  requireCondition(Boolean(evidenceValue), 'evidence_file_required');
  const timeoutValue = cliValue(argv, '--timeout-ms');
  const timeoutMs = timeoutValue === null ? DEFAULT_TIMEOUT_MS : Number(timeoutValue);
  requireCondition(Number.isInteger(timeoutMs) && timeoutMs >= 10000 && timeoutMs <= 900000,
    'timeout_invalid');
  const evidencePath = path.resolve(evidenceValue);
  requireCondition(isContained(projectRoot, evidencePath), 'evidence_path_outside_project');
  return {
    mode: capture ? 'capture' : 'verify',
    projectRoot,
    evidencePath,
    claudeBin: cliValue(argv, '--claude-bin') || process.env.CLAUDE_BIN || null,
    timeoutMs,
  };
}

function normalizedHookRegistration(entry) {
  const normalized = JSON.parse(JSON.stringify(entry));
  for (const command of Array.isArray(normalized.hooks) ? normalized.hooks : []) {
    if (!Array.isArray(command.args) || typeof command.args[0] !== 'string') continue;
    const portable = command.args[0].replace(/\\/g, '/');
    if (portable.endsWith(HOOK_RELATIVE_PATH.replace(/\\/g, '/'))) {
      command.args[0] = '<PROJECT_DIR>/' + HOOK_RELATIVE_PATH.replace(/\\/g, '/');
    }
  }
  return canonicalize(normalized);
}

function overlayRegistrations(projectRoot) {
  const overlay = readJson(path.join(projectRoot, OVERLAY_RELATIVE_PATH), 'overlay_invalid');
  const result = {};
  for (const [event, id] of [['PreToolUse', PRE_HOOK_ID], ['PostToolUse', POST_HOOK_ID]]) {
    const entries = overlay.hooks && Array.isArray(overlay.hooks[event]) ? overlay.hooks[event] : [];
    const matches = entries.filter((entry) => entry && entry.sgsd_hook_id === id);
    requireCondition(matches.length === 1, 'overlay_registration_invalid:' + event);
    result[event] = {
      id,
      matcher: matches[0].matcher,
      source_sha256: matches[0].sgsd_source_sha256,
      registration_sha256: valueDigest(normalizedHookRegistration(matches[0])),
    };
  }
  return result;
}

function normalizedBrokerConfigDigest() {
  return valueDigest({
    command: 'node',
    args: [
      '<PROJECT_DIR>/' + BROKER_RELATIVE_PATH.replace(/\\/g, '/'),
      '--project-root',
      '<PROJECT_DIR>',
      '--upstream-manifest',
      '<UPSTREAM_MANIFEST>',
    ],
  });
}

function collectCurrentSourceFacts(projectRoot) {
  const required = [
    FIXTURE_RELATIVE_PATH,
    CAPTURE_RELATIVE_PATH,
    HOOK_RELATIVE_PATH,
    BROKER_RELATIVE_PATH,
    STORE_RELATIVE_PATH,
    COMPOSER_RELATIVE_PATH,
    AUDIT_RELATIVE_PATH,
    OVERLAY_RELATIVE_PATH,
    ...FROZEN_FILES,
  ];
  for (const relative of required) {
    requireCondition(fs.existsSync(path.join(projectRoot, relative)), 'required_source_missing:' + relative);
  }
  const hookSha = fileSha256(path.join(projectRoot, HOOK_RELATIVE_PATH));
  const registrations = overlayRegistrations(projectRoot);
  requireCondition(registrations.PreToolUse.source_sha256 === hookSha, 'overlay_pre_source_hash_drift');
  requireCondition(registrations.PostToolUse.source_sha256 === hookSha, 'overlay_post_source_hash_drift');
  return {
    hook_sha256: hookSha,
    broker_sha256: fileSha256(path.join(projectRoot, BROKER_RELATIVE_PATH)),
    fixture_sha256: fileSha256(path.join(projectRoot, FIXTURE_RELATIVE_PATH)),
    capture_sha256: fileSha256(path.join(projectRoot, CAPTURE_RELATIVE_PATH)),
    broker_config_sha256: normalizedBrokerConfigDigest(),
    registrations,
    frozen_files: Object.fromEntries(FROZEN_FILES.map((relative) => [relative, {
      before_sha256: fileSha256(path.join(projectRoot, relative)),
    }])),
  };
}

function isolatedEnvironment(profileRoot, projectRoot) {
  const env = { ...process.env };
  for (const key of [
    'CLAUDECODE',
    'CLAUDE_CODE_ENTRYPOINT',
    'CLAUDE_CODE_SESSION_ID',
    'CLAUDE_SESSION_ID',
  ]) delete env[key];
  env.HOME = profileRoot;
  env.USERPROFILE = profileRoot;
  env.APPDATA = path.join(profileRoot, 'AppData', 'Roaming');
  env.LOCALAPPDATA = path.join(profileRoot, 'AppData', 'Local');
  env.XDG_CONFIG_HOME = path.join(profileRoot, '.config');
  env.CLAUDE_CONFIG_DIR = path.join(profileRoot, '.claude');
  env.CLAUDE_PROJECT_DIR = projectRoot;
  env.NO_COLOR = '1';
  for (const directory of [
    env.APPDATA,
    env.LOCALAPPDATA,
    env.XDG_CONFIG_HOME,
    env.CLAUDE_CONFIG_DIR,
  ]) fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  return env;
}

function requireInheritedAuthentication(env) {
  requireCondition(AUTH_ENV_KEYS.some((key) => typeof env[key] === 'string' && env[key].trim()),
    'claude_auth_environment_missing');
  return 'inherited_secret_environment';
}

function marker(prefix) {
  return prefix + '_' + crypto.randomBytes(16).toString('hex').toUpperCase();
}

function expectation(scenario, payload, rawMarker, tailMarker) {
  return {
    scenario,
    payload,
    payload_sha256: payloadDigest(payload),
    raw_response_marker: rawMarker,
    discarded_tail_marker: tailMarker,
  };
}

function seedClaudeProjectState(profileRoot, projectRoot, serverNames) {
  const statePath = path.join(profileRoot, '.claude.json');
  const state = fs.existsSync(statePath)
    ? readJson(statePath, 'disposable_claude_state_invalid')
    : { hasCompletedOnboarding: true, projects: {} };
  if (!state.projects || typeof state.projects !== 'object' || Array.isArray(state.projects)) {
    state.projects = {};
  }
  state.hasCompletedOnboarding = true;
  state.projects[projectRoot] = {
    ...(state.projects[projectRoot] || {}),
    hasTrustDialogAccepted: true,
    enabledMcpjsonServers: Array.from(new Set(serverNames)).sort(),
    disabledMcpjsonServers: [],
  };
  writePrivateJson(statePath, state);
}

function createDisposableScenario(tempRoot, name, sourceRoot, expectations) {
  const root = path.join(tempRoot, name);
  const projectRoot = path.join(root, 'project');
  const profileRoot = path.join(root, 'profile');
  fs.mkdirSync(projectRoot, { recursive: true, mode: 0o700 });
  fs.mkdirSync(profileRoot, { recursive: true, mode: 0o700 });
  fs.cpSync(path.join(sourceRoot, 'super-gsd'), path.join(projectRoot, 'super-gsd'), {
    recursive: true,
    force: true,
    dereference: false,
  });
  fs.mkdirSync(path.join(projectRoot, '.planning'), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, '.planning', 'STATE.md'),
    '---\ncurrent_milestone: p167-live-capture\nstatus: disposable\n---\n',
    'utf8',
  );
  writePrivateJson(path.join(projectRoot, '.claude', 'settings.json'), {
    enableAllProjectMcpServers: true,
  });

  const logPath = path.join(root, 'fixture-events.jsonl');
  const expectationsPath = path.join(root, 'fixture-expectations.json');
  fs.writeFileSync(logPath, '', { encoding: 'utf8', mode: 0o600 });
  writePrivateJson(expectationsPath, { schema_version: 1, expectations });
  const fixturePath = path.join(projectRoot, FIXTURE_RELATIVE_PATH);
  const directDefinition = {
    command: process.execPath,
    args: [fixturePath],
    cwd: projectRoot,
    env: {
      P167_FIXTURE_TEMP_DIR: root,
      P167_FIXTURE_LOG: logPath,
      P167_FIXTURE_EXPECTATIONS: expectationsPath,
    },
  };
  writePrivateJson(path.join(projectRoot, '.mcp.json'), {
    mcpServers: { 'vtp-kb': directDefinition },
  });
  seedClaudeProjectState(profileRoot, projectRoot, ['vtp-kb']);
  return {
    name,
    root,
    projectRoot,
    profileRoot,
    logPath,
    expectationsPath,
    expectations,
    fixturePath,
    directDefinition,
    env: isolatedEnvironment(profileRoot, projectRoot),
  };
}

function lastJsonLine(source, reason) {
  const lines = String(source || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try { return JSON.parse(lines[index]); } catch (_) {}
  }
  throw new HarnessFailure(reason);
}

function runSync(executable, args, options, reason) {
  const result = spawnSync(executable, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
    timeout: options.timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  requireCondition(!result.error, reason + ':spawn_failed');
  requireCondition(result.status === 0, reason + ':exit_' + String(result.status));
  return { stdout: result.stdout || '', stderr: result.stderr || '', status: result.status };
}

function installScenario(scenario, sourceRoot, timeoutMs) {
  const auditPath = path.join(sourceRoot, AUDIT_RELATIVE_PATH);
  const run = runSync(
    process.execPath,
    [
      auditPath,
      '--repair-substrate-capability',
      '--project-dir',
      scenario.projectRoot,
      '--install-global',
      '--init-local',
    ],
    { cwd: sourceRoot, env: scenario.env, timeoutMs },
    scenario.name + '_real_install_failed',
  );
  const report = lastJsonLine(run.stdout, scenario.name + '_install_report_invalid');
  requireCondition(report.ok === true, scenario.name + '_install_not_ok');
  requireCondition(report.substrate_granted === true, scenario.name + '_substrate_not_granted');
  requireCondition(report.witness_status === 'current', scenario.name + '_witness_not_current');
  requireCondition(report.capability_status === 'current', scenario.name + '_capability_not_current');
  return report;
}

function installedScenarioFacts(scenario, sourceRoot) {
  const settingsPath = path.join(scenario.projectRoot, '.claude', 'settings.json');
  const settings = readJson(settingsPath, scenario.name + '_settings_invalid');
  requireCondition(settings.enableAllProjectMcpServers === true,
    scenario.name + '_project_mcp_approval_missing');
  const registrations = {};
  for (const [event, id] of [['PreToolUse', PRE_HOOK_ID], ['PostToolUse', POST_HOOK_ID]]) {
    const entries = settings.hooks && Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
    const matches = entries.filter((entry) => entry && entry.sgsd_hook_id === id);
    requireCondition(matches.length === 1, scenario.name + '_hook_registration_invalid:' + event);
    requireCondition(matches[0].matcher === HOOK_MATCHER, scenario.name + '_hook_matcher_invalid:' + event);
    registrations[event] = {
      id,
      matcher: matches[0].matcher,
      source_sha256: matches[0].sgsd_source_sha256,
      registration_sha256: valueDigest(normalizedHookRegistration(matches[0])),
    };
  }
  const mcp = readJson(path.join(scenario.projectRoot, '.mcp.json'), scenario.name + '_mcp_invalid');
  const servers = mcp.mcpServers && typeof mcp.mcpServers === 'object' ? mcp.mcpServers : {};
  requireCondition(Object.keys(servers).length === 1
    && Object.keys(servers).filter((name) => name === 'vtp-kb').length === 1,
    scenario.name + '_broker_registration_missing');
  const broker = servers['vtp-kb'];
  requireCondition(broker && broker.command === 'node' && Array.isArray(broker.args),
    scenario.name + '_broker_registration_invalid');
  const normalizedBroker = {
    command: broker.command,
    args: broker.args.map((arg, index) => {
      if (index === 0) return '<PROJECT_DIR>/' + BROKER_RELATIVE_PATH.replace(/\\/g, '/');
      if (index === 2) return '<PROJECT_DIR>';
      if (index === 4) return '<UPSTREAM_MANIFEST>';
      return arg;
    }),
  };
  requireCondition(valueDigest(normalizedBroker) === normalizedBrokerConfigDigest(),
    scenario.name + '_broker_config_drift');
  const store = require(path.join(sourceRoot, STORE_RELATIVE_PATH));
  const paths = store.resolveWitnessPaths(scenario.projectRoot, scenario.env);
  const manifest = readJson(paths.upstream_manifest_path, scenario.name + '_upstream_manifest_invalid');
  requireCondition(manifest.project_digest === paths.project_digest,
    scenario.name + '_manifest_project_mismatch');
  requireCondition(manifest.broker_sha256 === fileSha256(path.join(scenario.projectRoot, BROKER_RELATIVE_PATH)),
    scenario.name + '_manifest_broker_drift');
  requireCondition(manifest.witness_source_sha256 === fileSha256(path.join(scenario.projectRoot, HOOK_RELATIVE_PATH)),
    scenario.name + '_manifest_hook_drift');
  const activeEntry = manifest.servers && manifest.servers[manifest.active_scope];
  requireCondition(activeEntry && activeEntry.transport === 'stdio'
    && valueDigest(activeEntry.definition) === valueDigest(scenario.directDefinition),
  scenario.name + '_fixture_not_private_upstream');
  requireCondition(fileSha256(scenario.fixturePath)
    === fileSha256(path.join(sourceRoot, FIXTURE_RELATIVE_PATH)),
  scenario.name + '_fixture_source_drift');
  return {
    settingsPath,
    project_mcp_approval: 'enableAllProjectMcpServers',
    registrations,
    broker,
    broker_config_sha256: valueDigest(normalizedBroker),
    manifestPath: paths.upstream_manifest_path,
    manifest,
    upstream_manifest_sha256: fileSha256(paths.upstream_manifest_path),
    witnessPaths: paths,
  };
}

function deriveGrantBearingAgent(scenario, name, tool, body) {
  const installed = path.join(scenario.profileRoot, '.claude', 'agents', 'sgsd-vtp-enrichment.md');
  requireCondition(fs.existsSync(installed), scenario.name + '_installed_agent_missing');
  const installedSource = fs.readFileSync(installed, 'utf8');
  requireCondition(installedSource.includes(TARGET_TOOL), scenario.name + '_installed_agent_not_granted');
  const target = path.join(scenario.projectRoot, '.claude', 'agents', name + '.md');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const source = [
    '---',
    'name: ' + name,
    'description: P167 isolated live capture agent',
    'tools: ' + tool,
    'model: inherit',
    '---',
    '',
    body,
    '',
  ].join('\n');
  fs.writeFileSync(target, source, 'utf8');
  return { path: target, source_sha256: sha256(Buffer.from(source, 'utf8')) };
}

function findOnPath(name) {
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const directory of String(process.env.PATH || '').split(path.delimiter).filter(Boolean)) {
    for (const extension of extensions) {
      const candidate = path.join(directory, name + extension);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
  }
  return null;
}

function resolveClaudeExecutable(explicit) {
  let candidate = explicit;
  if (candidate && !path.isAbsolute(candidate)) candidate = findOnPath(candidate) || candidate;
  if (!candidate) candidate = findOnPath('claude');
  requireCondition(Boolean(candidate), 'claude_cli_unavailable');
  if (process.platform === 'win32' && /\.(?:cmd|bat|ps1)$/i.test(candidate)) {
    const executable = path.join(
      path.dirname(candidate),
      'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe',
    );
    requireCondition(fs.existsSync(executable), 'claude_executable_unavailable');
    return executable;
  }
  return candidate;
}

function parseClaudeVersion(source) {
  const match = String(source || '').match(/\b(\d+)\.(\d+)\.(\d+)\b/);
  requireCondition(Boolean(match), 'claude_version_invalid');
  return { text: match[0], parts: match.slice(1).map(Number) };
}

function versionAtLeast(actual, minimum) {
  for (let index = 0; index < minimum.length; index += 1) {
    if (actual[index] > minimum[index]) return true;
    if (actual[index] < minimum[index]) return false;
  }
  return true;
}

function captureClaudeVersion(executable, env, cwd, timeoutMs) {
  const run = runSync(executable, ['--version'], { cwd, env, timeoutMs }, 'claude_version_failed');
  const version = parseClaudeVersion(run.stdout || run.stderr);
  requireCondition(versionAtLeast(version.parts, MIN_CLAUDE_VERSION), 'claude_version_too_old');
  return version.text;
}

function redactedClaudeCommand(agentName) {
  return [
    '<CLAUDE_CODE>',
    '--print',
    '--dangerously-skip-permissions',
    '--setting-sources',
    'project',
    '--session-id',
    '<SESSION_ID>',
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-hook-events',
    ...(agentName ? ['--agent', agentName] : []),
    '-p',
    '<PROMPT>',
  ];
}

function runClaudeProcess(options) {
  const args = [
    '--print',
    '--dangerously-skip-permissions',
    '--setting-sources',
    'project',
    '--session-id',
    options.sessionId,
    '--output-format',
    'stream-json',
    '--verbose',
    '--include-hook-events',
    ...(options.agentName ? ['--agent', options.agentName] : []),
    '-p',
    options.prompt,
  ];
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(options.executable, args, {
        cwd: options.cwd,
        env: options.env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        windowsHide: true,
      });
    } catch (_) {
      reject(new HarnessFailure(options.reason + ':spawn_failed'));
      return;
    }
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) {}
    }, options.timeoutMs);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 16 * 1024 * 1024) {
        try { child.kill(); } catch (_) {}
      }
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < 256 * 1024) stderr += chunk;
    });
    child.once('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new HarnessFailure(options.reason + ':spawn_failed'));
    });
    child.once('close', (status, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (status !== 0) {
        reject(new HarnessFailure(options.reason + ':exit_' + String(status) + ':' + String(signal || 'none')));
        return;
      }
      resolve({
        stdout,
        stderr,
        status,
        transcript_sha256: sha256(Buffer.from(stdout, 'utf8')),
        redacted_command: redactedClaudeCommand(options.agentName),
      });
    });
  });
}

function parseStreamEvents(stdout, reason) {
  const events = [];
  for (const line of String(stdout || '').split(/\r?\n/).filter(Boolean)) {
    try {
      events.push(JSON.parse(line));
    } catch (_) {
      throw new HarnessFailure(reason + ':non_json_stream');
    }
  }
  requireCondition(events.length > 0, reason + ':empty_stream');
  return events;
}

function walk(value, visitor) {
  if (!value || typeof value !== 'object') return;
  visitor(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visitor);
    return;
  }
  for (const child of Object.values(value)) walk(child, visitor);
}

function collectToolUses(events) {
  const uses = [];
  const seen = new Set();
  for (const event of events) {
    walk(event, (value) => {
      if (value.type !== 'tool_use' || typeof value.name !== 'string'
          || !value.input || typeof value.input !== 'object' || Array.isArray(value.input)) return;
      const identity = typeof value.id === 'string'
        ? value.id
        : value.name + ':' + payloadDigest(value.input) + ':' + uses.length;
      if (seen.has(identity)) return;
      seen.add(identity);
      uses.push({ id: value.id || identity, name: value.name, input: value.input });
    });
  }
  return uses;
}

function collectToolResults(events) {
  const results = [];
  const seen = new Set();
  for (const event of events) {
    walk(event, (value) => {
      if (value.type !== 'tool_result' || typeof value.tool_use_id !== 'string') return;
      const identity = value.tool_use_id + ':' + valueDigest(value.content);
      if (seen.has(identity)) return;
      seen.add(identity);
      results.push({
        tool_use_id: value.tool_use_id,
        content: value.content,
        is_error: value.is_error === true,
      });
    });
  }
  return results;
}

function contentStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    for (const item of value) contentStrings(item, output);
    return output;
  }
  if (typeof value.text === 'string') output.push(value.text);
  for (const [key, child] of Object.entries(value)) {
    if (key !== 'text') contentStrings(child, output);
  }
  return output;
}

function parseDomainFromToolResult(result, reason) {
  for (const text of contentStrings(result && result.content)) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch (_) {}
  }
  throw new HarnessFailure(reason);
}

function modelVisibleText(events) {
  const parts = [];
  for (const event of events) {
    if (!event || (event.type !== 'assistant' && event.type !== 'user')) continue;
    contentStrings(event.message || event, parts);
  }
  return parts.join('\n');
}

function eventTypeSummary(events) {
  const counts = {};
  for (const event of events) {
    const key = String(event && event.type || 'unknown')
      + (event && event.subtype ? ':' + event.subtype : '');
    counts[key] = (counts[key] || 0) + 1;
  }
  return canonicalize(counts);
}

function redactedHookResponse(event) {
  return {
    stdout: typeof event.stdout === 'string' ? event.stdout : null,
    output: typeof event.output === 'string' ? event.output : null,
    outcome: event.outcome || null,
    exit_code: event.exit_code,
  };
}

function hookLifecycle(events, hookName) {
  const relevant = events.filter((event) => event
    && event.type === 'system'
    && event.hook_name === hookName);
  const started = relevant.filter((event) => event.subtype === 'hook_started');
  const responses = relevant.filter((event) => event.subtype === 'hook_response');
  return {
    started,
    responses,
    summary: {
      started: started.length,
      responses: responses.length,
      successful: responses.filter((event) => event.exit_code === 0
        && (!event.outcome || event.outcome === 'success')).length,
      output_sha256: responses.map((event) => valueDigest(redactedHookResponse(event))),
    },
  };
}

function initDiscovery(events) {
  const init = events.find((event) => event && event.type === 'system' && event.subtype === 'init');
  const tools = init && Array.isArray(init.tools) ? init.tools.filter((item) => typeof item === 'string') : [];
  const servers = init && Array.isArray(init.mcp_servers) ? init.mcp_servers : [];
  return {
    init_present: Boolean(init),
    tool_names: tools,
    tool_names_sha256: valueDigest(tools.slice().sort()),
    vtp_kb_connected: servers.some((server) => server && server.name === 'vtp-kb'
      && (!server.status || server.status === 'connected')),
    vtp_kb_bypass_connected: servers.some((server) => server && server.name === 'vtp-kb-bypass'
      && (!server.status || server.status === 'connected')),
  };
}

function redactedTranscriptObservations(events) {
  const discovery = initDiscovery(events);
  return canonicalize({
    event_type_summary: eventTypeSummary(events),
    discovery,
    tool_uses: collectToolUses(events).map((item) => ({
      name: item.name,
      payload_sha256: payloadDigest(item.input),
      tool_use_sha256: sha256(Buffer.from(item.id, 'utf8')),
    })),
    tool_results: collectToolResults(events).map((item) => ({
      tool_use_sha256: sha256(Buffer.from(item.tool_use_id, 'utf8')),
      content_sha256: valueDigest(item.content),
      is_error: item.is_error,
    })),
    hook_lifecycle: {
      PreToolUse: hookLifecycle(events, 'PreToolUse').summary,
      PostToolUse: hookLifecycle(events, 'PostToolUse').summary,
    },
  });
}

function readJsonl(filePath, reason) {
  if (!fs.existsSync(filePath)) return [];
  const source = fs.readFileSync(filePath, 'utf8');
  if (!source) return [];
  requireCondition(source.endsWith('\n'), reason + ':incomplete_row');
  return source.split(/\r?\n/).filter(Boolean).map((line) => {
    try { return JSON.parse(line); } catch (_) { throw new HarnessFailure(reason + ':invalid_row'); }
  });
}

function fixtureLogSnapshot(scenario) {
  const rows = readJsonl(scenario.logPath, scenario.name + '_fixture_log_invalid');
  const calls = rows.filter((row) => row && row.event === 'tools/call');
  const redactedObservations = rows.map((row) => canonicalize({
    event: typeof row.event === 'string' ? row.event : 'unknown',
    traffic_class: typeof row.traffic_class === 'string' ? row.traffic_class : 'unknown',
    tool_name: typeof row.tool_name === 'string' ? row.tool_name : null,
    payload_sha256: typeof row.payload_sha256 === 'string' ? row.payload_sha256 : null,
    payload_keys: Array.isArray(row.payload_keys) ? row.payload_keys : [],
    payload_json_characters: Number.isInteger(row.payload_json_characters)
      ? row.payload_json_characters
      : 0,
    expectation: typeof row.expectation === 'string' ? row.expectation : null,
    accepted: row.accepted === true,
  }));
  return {
    rows,
    calls,
    log_sha256: fileSha256(scenario.logPath),
    redacted_observations: redactedObservations,
    redacted_observations_sha256: valueDigest(redactedObservations),
    event_counts: canonicalize(rows.reduce((counts, row) => {
      const key = String(row && row.event || 'unknown');
      counts[key] = (counts[key] || 0) + 1;
      return counts;
    }, {})),
  };
}

function directoryContentDigest(directory) {
  if (!fs.existsSync(directory)) return valueDigest([]);
  const rows = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const target = path.join(directory, name);
    if (!fs.statSync(target).isFile()) continue;
    rows.push({ name_sha256: sha256(Buffer.from(name, 'utf8')), content_sha256: fileSha256(target) });
  }
  return valueDigest(rows);
}

function witnessSnapshot(paths, matchingPayloadDigests) {
  const wanted = new Set(matchingPayloadDigests);
  const authoritative = [];
  if (fs.existsSync(paths.spool_dir)) {
    for (const name of fs.readdirSync(paths.spool_dir).sort()) {
      const target = path.join(paths.spool_dir, name);
      if (!fs.statSync(target).isFile()) continue;
      try {
        const row = JSON.parse(fs.readFileSync(target, 'utf8'));
        if (wanted.has(row.payload_digest)) authoritative.push(row);
      } catch (_) {}
    }
  }
  const mirrorRows = readJsonl(paths.mirror_path, 'witness_mirror_invalid');
  const mirrored = mirrorRows.filter((row) => wanted.has(row && row.payload_digest));
  return {
    authoritative_digest: directoryContentDigest(paths.spool_dir),
    mirror_digest: fs.existsSync(paths.mirror_path)
      ? fileSha256(paths.mirror_path)
      : valueDigest([]),
    authoritative_match_count: authoritative.length,
    mirrored_match_count: mirrored.length,
    matching_row_count: authoritative.length + mirrored.length,
    authoritative,
    mirrored,
  };
}

function activeWitnessSequence(paths, sessionSha, toolUseSha, payloadSha) {
  const rows = readJsonl(paths.mirror_path, 'active_witness_mirror_invalid').filter((row) => row
    && row.session_sha256 === sessionSha
    && row.tool_use_sha256 === toolUseSha
    && row.payload_digest === payloadSha);
  return rows.map((row) => ({
    event: row.event,
    state: row.state,
    payload_digest: row.payload_digest,
    session_sha256: row.session_sha256,
    tool_use_sha256: row.tool_use_sha256,
    source_digest: row.source_digest,
    rewrite: row.rewrite || null,
  }));
}

function oversizedHit(domain, scenario, reason) {
  const hits = domain && Array.isArray(domain.hits) ? domain.hits : [];
  const hit = hits.find((item) => item && item.doc_id === 'fixture:oversized:' + scenario);
  requireCondition(hit && typeof hit.text === 'string', reason);
  return hit;
}

function createJsonLineClient(definition, baseEnv, timeoutMs, reason) {
  const env = { ...baseEnv, ...(definition.env || {}) };
  const child = spawn(definition.command, definition.args || [], {
    cwd: definition.cwd || process.cwd(),
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: false,
    windowsHide: true,
  });
  let nextId = 1;
  let buffer = '';
  let stderr = '';
  let stopped = false;
  const pending = new Map();

  function failAll(code) {
    if (stopped) return;
    stopped = true;
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new HarnessFailure(reason + ':' + code));
    }
    pending.clear();
  }

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline === -1) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try { message = JSON.parse(line); } catch (_) { failAll('non_json_response'); continue; }
      if (!Object.prototype.hasOwnProperty.call(message, 'id') || !pending.has(message.id)) continue;
      const item = pending.get(message.id);
      pending.delete(message.id);
      clearTimeout(item.timer);
      item.resolve(message);
    }
  });
  child.stderr.on('data', (chunk) => {
    if (stderr.length < 65536) stderr += chunk;
  });
  child.on('error', () => failAll('spawn_failed'));
  child.on('exit', () => failAll('process_exit'));

  function request(method, params) {
    requireCondition(!stopped, reason + ':client_stopped');
    const id = nextId;
    nextId += 1;
    const message = { jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new HarnessFailure(reason + ':request_timeout'));
        try { child.kill(); } catch (_) {}
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify(message) + '\n', (error) => {
        if (!error || !pending.has(id)) return;
        clearTimeout(timer);
        pending.delete(id);
        reject(new HarnessFailure(reason + ':stdin_failed'));
      });
    });
  }

  function notify(method, params) {
    requireCondition(!stopped, reason + ':client_stopped');
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  async function close() {
    if (stopped) return;
    stopped = true;
    try { child.stdin.end(); } catch (_) {}
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try { child.kill(); } catch (_) {}
        resolve();
      }, 2000);
      child.once('close', () => { clearTimeout(timer); resolve(); });
    });
  }
  return { request, notify, close, stderr: () => stderr };
}

async function protocolConversation(definition, env, timeoutMs, reason, call) {
  const client = createJsonLineClient(definition, env, timeoutMs, reason);
  try {
    const initialized = await client.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'sgsd-p167-live-capture', version: '1.0.0' },
    });
    requireCondition(initialized.result && initialized.result.serverInfo, reason + ':initialize_failed');
    client.notify('notifications/initialized', {});
    const listed = await client.request('tools/list', {});
    requireCondition(listed.result && Array.isArray(listed.result.tools), reason + ':tools_list_failed');
    const called = call
      ? await client.request('tools/call', { name: SHORT_TOOL, arguments: call })
      : null;
    return { initialized, listed, called };
  } finally {
    await client.close();
  }
}

async function captureActivePath(context) {
  const composer = require(path.join(context.sourceRoot, COMPOSER_RELATIVE_PATH));
  const fixture = require(path.join(context.sourceRoot, FIXTURE_RELATIVE_PATH));
  const invalidPayload = { query: 'p167 invalid call missing policy fields' };
  const prepared = composer.prepareSubstrateCall('planning', {
    query: 'p167 deterministic live planning fixture',
  });
  const activeExpectation = expectation(
    'active-valid',
    prepared.payload,
    marker('P167_RAW_ACTIVE'),
    '\uE167',
  );
  const scenario = createDisposableScenario(
    context.tempRoot,
    'active-path',
    context.sourceRoot,
    [activeExpectation],
  );
  const install = installScenario(scenario, context.sourceRoot, context.timeoutMs);
  const installed = installedScenarioFacts(scenario, context.sourceRoot);
  const agentName = 'p167-active-live-capture';
  const body = [
    'Make exactly two calls to ' + TARGET_TOOL + ' in this order.',
    'First call with exactly this invalid input: ' + JSON.stringify(invalidPayload) + '.',
    'Second call with exactly this valid input: ' + JSON.stringify(prepared.payload) + '.',
    'Do not retry either call. Do not call any other tool. After both attempts, return ACTIVE_CAPTURE_DONE.',
  ].join('\n');
  const agent = deriveGrantBearingAgent(scenario, agentName, TARGET_TOOL, body);
  const sessionId = crypto.randomUUID();
  const run = await runClaudeProcess({
    executable: context.claudeExecutable,
    cwd: scenario.projectRoot,
    env: scenario.env,
    sessionId,
    agentName,
    prompt: 'Execute the two-call P167 live capture contract exactly once.',
    timeoutMs: context.timeoutMs,
    reason: 'active_claude_failed',
  });
  const events = parseStreamEvents(run.stdout, 'active_transcript_invalid');
  const transcriptObservations = redactedTranscriptObservations(events);
  const uses = collectToolUses(events).filter((item) => item.name === TARGET_TOOL);
  requireCondition(uses.length === 2, 'active_requires_exactly_two_tool_uses');
  requireCondition(JSON.stringify(uses[0].input) === JSON.stringify(invalidPayload),
    'active_invalid_input_mismatch');
  requireCondition(JSON.stringify(uses[1].input) === JSON.stringify(prepared.payload),
    'active_valid_input_mismatch');
  const preHooks = hookLifecycle(events, 'PreToolUse');
  const postHooks = hookLifecycle(events, 'PostToolUse');
  requireCondition(preHooks.summary.started === 2 && preHooks.summary.responses === 2,
    'active_pre_hook_lifecycle_invalid');
  requireCondition(postHooks.summary.started === 1 && postHooks.summary.responses === 1,
    'active_post_hook_lifecycle_invalid');
  const denialHookResponse = preHooks.responses.find((response) => JSON.stringify(response).includes(DENIAL_REASON));
  requireCondition(Boolean(denialHookResponse), 'active_invalid_call_not_denied');

  const results = collectToolResults(events);
  const validResult = results.find((item) => item.tool_use_id === uses[1].id);
  requireCondition(Boolean(validResult), 'active_valid_tool_result_missing');
  requireCondition(validResult.is_error !== true, 'active_valid_tool_result_failed');
  const replacementDomain = parseDomainFromToolResult(validResult, 'active_replacement_invalid');
  const replacementHit = oversizedHit(replacementDomain, activeExpectation.scenario,
    'active_replacement_oversized_hit_missing');
  requireCondition(replacementHit.text.length === RETAINED_HIT_CHARS,
    'active_replacement_not_16000');
  const notes = Array.isArray(replacementDomain.degradation_notes)
    ? replacementDomain.degradation_notes
    : [];
  const degradation = notes.find((note) => note
    && note.reason_code === DEGRADATION_REASON
    && note.original_chars === OVERSIZED_HIT_CHARS
    && note.retained_chars === RETAINED_HIT_CHARS);
  requireCondition(Boolean(degradation), 'active_degradation_note_missing');
  requireCondition(!contentStrings(validResult.content).join('\n').includes(activeExpectation.discarded_tail_marker),
    'active_discarded_marker_visible');
  requireCondition(replacementHit.text.includes(activeExpectation.raw_response_marker),
    'active_retained_raw_marker_missing');

  const rawDomain = fixture.buildDomainResult(activeExpectation);
  const rawHit = oversizedHit(rawDomain, activeExpectation.scenario, 'active_raw_hit_missing');
  requireCondition(rawHit.text.length === OVERSIZED_HIT_CHARS, 'active_raw_hit_not_16001');
  requireCondition(valueDigest(rawDomain) !== valueDigest(replacementDomain),
    'active_result_was_not_replaced');

  const fixtureLog = fixtureLogSnapshot(scenario);
  requireCondition(fixtureLog.calls.length === 1, 'active_fixture_invocation_count_invalid');
  const invocation = fixtureLog.calls[0];
  requireCondition(invocation.accepted === true, 'active_fixture_valid_call_not_accepted');
  requireCondition(invocation.payload_sha256 === prepared.gateway_evidence.payload_sha256,
    'active_fixture_payload_digest_mismatch');
  requireCondition(invocation.expectation === activeExpectation.scenario,
    'active_fixture_scenario_mismatch');

  const acceptanceDir = path.join(scenario.projectRoot, '.planning', 'tmp', 'p167-live-acceptance');
  fs.mkdirSync(acceptanceDir, { recursive: true });
  const preparedFile = path.join(acceptanceDir, 'prepared.json');
  const recordFile = path.join(acceptanceDir, 'record.json');
  writePrivateJson(preparedFile, prepared);
  writePrivateJson(recordFile, prepared);
  let acceptance;
  try {
    const accepted = runSync(
      process.execPath,
      [
        path.join(scenario.projectRoot, COMPOSER_RELATIVE_PATH),
        '--accept-substrate-call-record',
        '--intent',
        'planning',
        '--prepared-call-file',
        path.relative(scenario.projectRoot, preparedFile),
        '--record-file',
        path.relative(scenario.projectRoot, recordFile),
      ],
      {
        cwd: scenario.projectRoot,
        env: { ...scenario.env, CLAUDE_CODE_SESSION_ID: sessionId },
        timeoutMs: context.timeoutMs,
      },
      'active_acceptance_failed',
    );
    acceptance = lastJsonLine(accepted.stdout, 'active_acceptance_invalid');
  } finally {
    try { fs.unlinkSync(preparedFile); } catch (_) {}
    try { fs.unlinkSync(recordFile); } catch (_) {}
  }
  requireCondition(acceptance.ok === true && acceptance.witness_status === 'consumed',
    'active_witness_not_consumed');
  requireCondition(acceptance.payload_sha256 === prepared.gateway_evidence.payload_sha256,
    'active_acceptance_payload_mismatch');

  const sessionSha = sha256(Buffer.from(sessionId, 'utf8'));
  const validToolUseSha = sha256(Buffer.from(uses[1].id, 'utf8'));
  const sequence = activeWitnessSequence(
    installed.witnessPaths,
    sessionSha,
    validToolUseSha,
    prepared.gateway_evidence.payload_sha256,
  );
  requireCondition(JSON.stringify(sequence.map((row) => row.state))
    === JSON.stringify(['pre_allowed', 'rewritten', 'consumed']),
  'active_witness_state_sequence_invalid');

  return {
    scenario,
    evidence: {
      install: {
        mode: install.mode || 'repair-substrate-capability',
        witness_status: install.witness_status,
        capability_status: install.capability_status,
        substrate_granted: install.substrate_granted,
        agent_source_sha256: agent.source_sha256,
      },
      session_sha256: sessionSha,
      transcript_sha256: run.transcript_sha256,
      event_type_summary: eventTypeSummary(events),
      transcript_observations: transcriptObservations,
      transcript_observations_sha256: valueDigest(transcriptObservations),
      command: run.redacted_command,
      prepared_call: {
        intent_family: 'planning',
        payload: prepared.payload,
        prepared_payload_sha256: prepared.gateway_evidence.payload_sha256,
        actual_payload_sha256: payloadDigest(uses[1].input),
      },
      tool_uses: uses.map((item, index) => ({
        ordinal: index + 1,
        name: item.name,
        payload_sha256: payloadDigest(item.input),
        tool_use_sha256: sha256(Buffer.from(item.id, 'utf8')),
        denied: index === 0,
        policy_fields_missing: index === 0 ? ['source_types', 'limit'] : [],
      })),
      denial_reason: DENIAL_REASON,
      denial_observation: {
        reason_sha256: sha256(Buffer.from(DENIAL_REASON, 'utf8')),
        hook_response_sha256: valueDigest(redactedHookResponse(denialHookResponse)),
      },
      hooks: { PreToolUse: preHooks.summary, PostToolUse: postHooks.summary },
      server_invocation: {
        count: fixtureLog.calls.length,
        payload: prepared.payload,
        payload_sha256: invocation.payload_sha256,
        fixture_log_sha256: fixtureLog.log_sha256,
        fixture_event_counts: fixtureLog.event_counts,
        redacted_observations: fixtureLog.redacted_observations,
        redacted_observations_sha256: fixtureLog.redacted_observations_sha256,
      },
      response: {
        replacement_observed: true,
        raw_result_delivered: false,
        raw_domain_sha256: valueDigest(rawDomain),
        replacement_domain_sha256: valueDigest(replacementDomain),
        replacement_content_sha256: valueDigest(validResult.content),
        original_chars: rawHit.text.length,
        retained_chars: replacementHit.text.length,
        degradation_reason: degradation.reason_code,
        discarded_marker_sha256: sha256(Buffer.from(activeExpectation.discarded_tail_marker, 'utf8')),
        discarded_marker_absent: true,
        raw_marker_sha256: sha256(Buffer.from(activeExpectation.raw_response_marker, 'utf8')),
      },
      witness_state_sequence: sequence,
      acceptance_consumption: acceptance,
      registrations: installed.registrations,
      broker_config_sha256: installed.broker_config_sha256,
      upstream_manifest_sha256: installed.upstream_manifest_sha256,
    },
  };
}

async function captureAbsentGuard(context) {
  const absentExpectation = expectation(
    'absent-guard-forbidden',
    { query: 'p167 absent guard stale call' },
    marker('P167_RAW_ABSENT'),
    '\uE168',
  );
  const scenario = createDisposableScenario(
    context.tempRoot,
    'absent-guard',
    context.sourceRoot,
    [absentExpectation],
  );
  const install = installScenario(scenario, context.sourceRoot, context.timeoutMs);
  const installed = installedScenarioFacts(scenario, context.sourceRoot);
  const settings = readJson(installed.settingsPath, 'absent_settings_invalid');
  const deletedIds = [];
  for (const [event, id] of [['PreToolUse', PRE_HOOK_ID], ['PostToolUse', POST_HOOK_ID]]) {
    const entries = settings.hooks && Array.isArray(settings.hooks[event]) ? settings.hooks[event] : [];
    const before = entries.length;
    settings.hooks[event] = entries.filter((entry) => !entry || entry.sgsd_hook_id !== id);
    requireCondition(settings.hooks[event].length === before - 1, 'absent_hook_delete_failed:' + event);
    deletedIds.push(id);
  }
  writePrivateJson(installed.settingsPath, settings);
  const hookPath = path.join(scenario.projectRoot, HOOK_RELATIVE_PATH);
  fs.unlinkSync(hookPath);
  requireCondition(!fs.existsSync(hookPath), 'absent_hook_source_delete_failed');

  const sessionId = crypto.randomUUID();
  const run = await runClaudeProcess({
    executable: context.claudeExecutable,
    cwd: scenario.projectRoot,
    env: scenario.env,
    sessionId,
    agentName: null,
    prompt: [
      'Attempt to call the raw vtp_search_substrate tool exactly once with query',
      JSON.stringify(absentExpectation.payload.query) + '.',
      'Do not use Bash or any alternate tool. If the tool is not discoverable, report only ABSENT_GUARD_DONE.',
    ].join(' '),
    timeoutMs: context.timeoutMs,
    reason: 'absent_claude_failed',
  });
  const events = parseStreamEvents(run.stdout, 'absent_transcript_invalid');
  const transcriptObservations = redactedTranscriptObservations(events);
  const discovery = initDiscovery(events);
  requireCondition(discovery.init_present, 'absent_claude_discovery_missing');
  requireCondition(discovery.vtp_kb_connected, 'absent_broker_not_connected');
  requireCondition(!discovery.tool_names.includes(TARGET_TOOL), 'absent_tool_advertised_to_claude');
  const targetUses = collectToolUses(events).filter((item) => item.name === TARGET_TOOL);
  requireCondition(targetUses.length === 0, 'absent_model_reached_substrate_tool');

  const brokerDefinition = { ...installed.broker, cwd: scenario.projectRoot };
  const direct = await protocolConversation(
    brokerDefinition,
    { ...scenario.env, CLAUDE_PROJECT_DIR: scenario.projectRoot },
    context.timeoutMs,
    'absent_broker_probe_failed',
    absentExpectation.payload,
  );
  const listedNames = direct.listed.result.tools
    .map((tool) => tool && tool.name)
    .filter((name) => typeof name === 'string');
  requireCondition(!listedNames.includes(SHORT_TOOL) && !listedNames.includes(TARGET_TOOL),
    'absent_direct_discovery_advertised_substrate');
  const stale = direct.called;
  requireCondition(stale && stale.result && stale.result.isError === true,
    'absent_stale_call_not_rejected');
  requireCondition(Object.keys(stale.result).sort().join(',') === 'content,isError',
    'absent_stale_call_unbounded_shape');
  requireCondition(Array.isArray(stale.result.content) && stale.result.content.length === 1,
    'absent_stale_call_content_invalid');
  const staleText = stale.result.content[0] && stale.result.content[0].text;
  requireCondition(typeof staleText === 'string'
    && staleText.startsWith(UNAVAILABLE_PREFIX)
    && staleText.length <= 200
    && /^[a-z0-9_:.-]+$/i.test(staleText),
  'absent_stale_call_reason_invalid');

  const log = fixtureLogSnapshot(scenario);
  requireCondition(log.calls.length === 0, 'absent_fixture_received_tools_call');
  const visible = modelVisibleText(events);
  requireCondition(!visible.includes(absentExpectation.raw_response_marker),
    'absent_raw_marker_visible');
  requireCondition(!visible.includes(absentExpectation.discarded_tail_marker),
    'absent_tail_marker_visible');
  const results = collectToolResults(events);
  const resultIds = new Set(results.map((result) => result.tool_use_id));
  const substrateResultCount = targetUses.filter((use) => resultIds.has(use.id)).length;
  requireCondition(substrateResultCount === 0, 'absent_substrate_result_visible');

  return {
    scenario,
    evidence: {
      install: {
        mode: install.mode || 'repair-substrate-capability',
        witness_status_before_delete: install.witness_status,
        capability_status_before_delete: install.capability_status,
      },
      deleted_hook_ids: deletedIds.sort(),
      both_hook_ids_deleted: deletedIds.length === 2,
      hook_source_deleted: true,
      broker_tools_list: {
        discovery_succeeded: true,
        names: listedNames,
        names_sha256: valueDigest(listedNames.slice().sort()),
        substrate_absent: true,
      },
      stale_call: {
        issued_outside_model: true,
        rejected: true,
        reason: staleText,
        response_sha256: valueDigest(stale.result),
        bounded: staleText.length <= 200,
      },
      fixture: {
        tools_call_count: log.calls.length,
        log_sha256: log.log_sha256,
        event_counts: log.event_counts,
        redacted_observations: log.redacted_observations,
        redacted_observations_sha256: log.redacted_observations_sha256,
      },
      transcript: {
        session_sha256: sha256(Buffer.from(sessionId, 'utf8')),
        transcript_sha256: run.transcript_sha256,
        command: run.redacted_command,
        event_type_summary: eventTypeSummary(events),
        observations: transcriptObservations,
        observations_sha256: valueDigest(transcriptObservations),
        broker_connected: discovery.vtp_kb_connected,
        substrate_tool_use_count: targetUses.length,
        substrate_tool_result_count: substrateResultCount,
        raw_marker_sha256: sha256(Buffer.from(absentExpectation.raw_response_marker, 'utf8')),
        raw_marker_absent: true,
        discarded_marker_sha256: sha256(Buffer.from(absentExpectation.discarded_tail_marker, 'utf8')),
        discarded_marker_absent: true,
      },
      proof_sources: [
        'claude_stream_json',
        'broker_tools_list',
        'direct_stale_tools_call',
        'fixture_append_only_log',
      ],
      registrations_before_delete: installed.registrations,
      broker_config_sha256: installed.broker_config_sha256,
      upstream_manifest_sha256: installed.upstream_manifest_sha256,
    },
  };
}

async function captureSameUserBypass(context) {
  const composer = require(path.join(context.sourceRoot, COMPOSER_RELATIVE_PATH));
  const alternatePayload = { query: 'p167 same user alternate registration non v2' };
  const directPayload = { query: 'p167 same user direct stdio non v2' };
  requireCondition(!composer.validateSubstrateToolInput(alternatePayload), 'bypass_alternate_payload_was_v2');
  requireCondition(!composer.validateSubstrateToolInput(directPayload), 'bypass_direct_payload_was_v2');
  const alternateExpectation = expectation(
    'same-user-alternate',
    alternatePayload,
    marker('P167_RAW_BYPASS_ALT'),
    '\uE169',
  );
  const directExpectation = expectation(
    'same-user-direct',
    directPayload,
    marker('P167_RAW_BYPASS_DIRECT'),
    '\uE16A',
  );
  const scenario = createDisposableScenario(
    context.tempRoot,
    'same-user-bypass',
    context.sourceRoot,
    [alternateExpectation, directExpectation],
  );
  const install = installScenario(scenario, context.sourceRoot, context.timeoutMs);
  const installed = installedScenarioFacts(scenario, context.sourceRoot);
  const manifest = readJson(installed.manifestPath, 'bypass_private_manifest_invalid');
  const activeEntry = manifest.servers && manifest.servers[manifest.active_scope];
  requireCondition(activeEntry && activeEntry.transport === 'stdio' && activeEntry.definition,
    'bypass_private_upstream_missing');
  const upstreamDefinition = activeEntry.definition;
  const payloadDigests = [alternateExpectation.payload_sha256, directExpectation.payload_sha256];
  const witnessBefore = witnessSnapshot(installed.witnessPaths, payloadDigests);
  requireCondition(witnessBefore.matching_row_count === 0, 'bypass_matching_witness_before');

  const mcpPath = path.join(scenario.projectRoot, '.mcp.json');
  const mcp = readJson(mcpPath, 'bypass_mcp_invalid');
  requireCondition(mcp.mcpServers && mcp.mcpServers['vtp-kb'], 'bypass_broker_missing');
  mcp.mcpServers['vtp-kb-bypass'] = upstreamDefinition;
  writePrivateJson(mcpPath, mcp);
  seedClaudeProjectState(scenario.profileRoot, scenario.projectRoot, ['vtp-kb', 'vtp-kb-bypass']);
  const alternateConfigSha = valueDigest(upstreamDefinition);
  const agentName = 'p167-same-user-bypass-capture';
  const agent = deriveGrantBearingAgent(
    scenario,
    agentName,
    BYPASS_TOOL,
    [
      'Call ' + BYPASS_TOOL + ' exactly once with this deliberately non-v2 input:',
      JSON.stringify(alternatePayload) + '.',
      'Do not retry and do not call any other tool. After the result, return BYPASS_ALTERNATE_DONE.',
    ].join('\n'),
  );
  const sessionId = crypto.randomUUID();
  const run = await runClaudeProcess({
    executable: context.claudeExecutable,
    cwd: scenario.projectRoot,
    env: scenario.env,
    sessionId,
    agentName,
    prompt: 'Execute the alternate-registration P167 bypass capture exactly once.',
    timeoutMs: context.timeoutMs,
    reason: 'bypass_alternate_claude_failed',
  });
  const events = parseStreamEvents(run.stdout, 'bypass_alternate_transcript_invalid');
  const transcriptObservations = redactedTranscriptObservations(events);
  const discovery = initDiscovery(events);
  requireCondition(discovery.init_present && discovery.vtp_kb_bypass_connected,
    'bypass_alternate_discovery_failed');
  requireCondition(discovery.tool_names.includes(BYPASS_TOOL), 'bypass_alternate_tool_not_advertised');
  const uses = collectToolUses(events).filter((item) => item.name === BYPASS_TOOL);
  requireCondition(uses.length === 1, 'bypass_alternate_call_count_invalid');
  requireCondition(JSON.stringify(uses[0].input) === JSON.stringify(alternatePayload),
    'bypass_alternate_payload_mismatch');
  const results = collectToolResults(events);
  const alternateResult = results.find((item) => item.tool_use_id === uses[0].id);
  requireCondition(alternateResult && alternateResult.is_error !== true,
    'bypass_alternate_call_failed');
  const alternateDomain = parseDomainFromToolResult(alternateResult, 'bypass_alternate_result_invalid');
  const alternateHit = oversizedHit(alternateDomain, alternateExpectation.scenario,
    'bypass_alternate_hit_missing');
  requireCondition(alternateHit.text.length === OVERSIZED_HIT_CHARS,
    'bypass_alternate_result_was_rewritten');
  requireCondition(alternateHit.text.includes(alternateExpectation.raw_response_marker)
    && alternateHit.text.includes(alternateExpectation.discarded_tail_marker),
  'bypass_alternate_markers_missing');
  requireCondition(!alternateHit.text.includes(directExpectation.raw_response_marker)
    && !alternateHit.text.includes(directExpectation.discarded_tail_marker),
  'bypass_alternate_markers_not_unique');
  const afterAlternateLog = fixtureLogSnapshot(scenario);
  const alternateRows = afterAlternateLog.calls.filter((row) => row.expectation === alternateExpectation.scenario);
  requireCondition(afterAlternateLog.calls.length === 1 && alternateRows.length === 1
    && alternateRows[0].accepted === true,
  'bypass_alternate_fixture_row_invalid');

  const direct = await protocolConversation(
    upstreamDefinition,
    scenario.env,
    context.timeoutMs,
    'bypass_direct_stdio_failed',
    directPayload,
  );
  requireCondition(direct.called && direct.called.result && !direct.called.error,
    'bypass_direct_call_failed');
  const directDomain = parseDomainFromToolResult(direct.called.result, 'bypass_direct_result_invalid');
  const directHit = oversizedHit(directDomain, directExpectation.scenario, 'bypass_direct_hit_missing');
  requireCondition(directHit.text.length === OVERSIZED_HIT_CHARS,
    'bypass_direct_result_was_rewritten');
  requireCondition(directHit.text.includes(directExpectation.raw_response_marker)
    && directHit.text.includes(directExpectation.discarded_tail_marker),
  'bypass_direct_markers_missing');
  requireCondition(!directHit.text.includes(alternateExpectation.raw_response_marker)
    && !directHit.text.includes(alternateExpectation.discarded_tail_marker),
  'bypass_direct_markers_not_unique');

  const finalLog = fixtureLogSnapshot(scenario);
  const finalAlternateRows = finalLog.calls.filter((row) => row.expectation === alternateExpectation.scenario);
  const finalDirectRows = finalLog.calls.filter((row) => row.expectation === directExpectation.scenario);
  requireCondition(finalLog.calls.length === 2
    && finalAlternateRows.length === 1
    && finalDirectRows.length === 1
    && finalLog.calls.every((row) => row.accepted === true),
  'bypass_fixture_rows_invalid');
  const witnessAfter = witnessSnapshot(installed.witnessPaths, payloadDigests);
  requireCondition(witnessAfter.matching_row_count === 0, 'bypass_matching_witness_after');
  requireCondition(witnessBefore.authoritative_digest === witnessAfter.authoritative_digest
    && witnessBefore.mirror_digest === witnessAfter.mirror_digest,
  'bypass_witness_store_changed');

  const markerHashes = [
    alternateExpectation.raw_response_marker,
    alternateExpectation.discarded_tail_marker,
    directExpectation.raw_response_marker,
    directExpectation.discarded_tail_marker,
  ].map((value) => sha256(Buffer.from(value, 'utf8')));
  requireCondition(new Set(markerHashes).size === markerHashes.length, 'bypass_markers_not_unique');
  return {
    scenario,
    evidence: {
      boundary_result: 'bypass_succeeded',
      residual: 'same_user_can_restore_direct_mcp_or_replace_broker',
      private_manifest_read: true,
      install: {
        mode: install.mode || 'repair-substrate-capability',
        substrate_granted: install.substrate_granted,
      },
      alternate_registration: {
        server_name: 'vtp-kb-bypass',
        discovered: true,
        call_succeeded: true,
        v2_validation: false,
        non_v2_payload_sha256: alternateExpectation.payload_sha256,
        tool_use_sha256: sha256(Buffer.from(uses[0].id, 'utf8')),
        session_sha256: sha256(Buffer.from(sessionId, 'utf8')),
        transcript_sha256: run.transcript_sha256,
        transcript_observations: transcriptObservations,
        transcript_observations_sha256: valueDigest(transcriptObservations),
        result_content_sha256: valueDigest(alternateResult.content),
        command: run.redacted_command,
        fixture_invocation_count: finalAlternateRows.length,
        raw_marker_sha256: markerHashes[0],
        discarded_marker_sha256: markerHashes[1],
        raw_markers_observed: true,
      },
      direct_stdio: {
        call_succeeded: true,
        v2_validation: false,
        non_v2_payload_sha256: directExpectation.payload_sha256,
        response_sha256: valueDigest(directDomain),
        command: ['<UPSTREAM_COMMAND>', '<UPSTREAM_ARGS>', '<STDIO_TOOLS_CALL>'],
        fixture_invocation_count: finalDirectRows.length,
        raw_marker_sha256: markerHashes[2],
        discarded_marker_sha256: markerHashes[3],
        raw_markers_observed: true,
      },
      fixture: {
        total_tools_call_count: finalLog.calls.length,
        log_sha256: finalLog.log_sha256,
        event_counts: finalLog.event_counts,
        redacted_observations: finalLog.redacted_observations,
        redacted_observations_sha256: finalLog.redacted_observations_sha256,
      },
      witness_store: {
        before: {
          authoritative_sha256: witnessBefore.authoritative_digest,
          mirror_sha256: witnessBefore.mirror_digest,
          matching_row_count: witnessBefore.matching_row_count,
        },
        after: {
          authoritative_sha256: witnessAfter.authoritative_digest,
          mirror_sha256: witnessAfter.mirror_digest,
          matching_row_count: witnessAfter.matching_row_count,
        },
        authoritative_matching_row_count: witnessAfter.authoritative_match_count,
        mirrored_matching_row_count: witnessAfter.mirrored_match_count,
      },
      redacted_commands: [
        run.redacted_command,
        ['<UPSTREAM_COMMAND>', '<UPSTREAM_ARGS>', '<STDIO_TOOLS_CALL>'],
      ],
      source_and_configuration_digests: {
        fixture_source_sha256: fileSha256(path.join(context.sourceRoot, FIXTURE_RELATIVE_PATH)),
        upstream_manifest_sha256: installed.upstream_manifest_sha256,
        alternate_registration_sha256: alternateConfigSha,
        agent_source_sha256: agent.source_sha256,
        broker_config_sha256: installed.broker_config_sha256,
      },
    },
  };
}

function finalizeFrozenFacts(sourceFacts, projectRoot) {
  for (const relative of FROZEN_FILES) {
    const current = fileSha256(path.join(projectRoot, relative));
    sourceFacts.frozen_files[relative].after_sha256 = current;
    requireCondition(sourceFacts.frozen_files[relative].before_sha256 === current,
      'frozen_file_changed_during_capture:' + relative);
  }
}

function cleanupDisposableRoot(tempRoot) {
  const resolvedTemp = path.resolve(os.tmpdir());
  const resolvedTarget = path.resolve(tempRoot);
  requireCondition(isContained(resolvedTemp, resolvedTarget)
    && path.basename(resolvedTarget).startsWith('sgsd-p167-live-'),
  'temporary_cleanup_target_invalid');
  fs.rmSync(resolvedTarget, { recursive: true, force: true });
}

async function captureAll(options) {
  const sourceFacts = collectCurrentSourceFacts(options.projectRoot);
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-p167-live-'));
  let evidenceWritten = false;
  try {
    const versionProfile = path.join(tempRoot, 'version-profile');
    fs.mkdirSync(versionProfile, { recursive: true, mode: 0o700 });
    const versionEnv = isolatedEnvironment(versionProfile, options.projectRoot);
    const authenticationSource = requireInheritedAuthentication(versionEnv);
    const claudeExecutable = resolveClaudeExecutable(options.claudeBin);
    const claudeCodeVersion = captureClaudeVersion(
      claudeExecutable,
      versionEnv,
      options.projectRoot,
      options.timeoutMs,
    );
    const context = {
      sourceRoot: options.projectRoot,
      tempRoot,
      claudeExecutable,
      timeoutMs: options.timeoutMs,
    };
    const active = await captureActivePath(context);
    const absent = await captureAbsentGuard(context);
    const bypass = await captureSameUserBypass(context);
    finalizeFrozenFacts(sourceFacts, options.projectRoot);
    requireCondition(sourceFacts.hook_sha256
      === fileSha256(path.join(options.projectRoot, HOOK_RELATIVE_PATH)),
    'hook_source_changed_during_capture');
    requireCondition(sourceFacts.broker_sha256
      === fileSha256(path.join(options.projectRoot, BROKER_RELATIVE_PATH)),
    'broker_source_changed_during_capture');
    requireCondition(sourceFacts.fixture_sha256
      === fileSha256(path.join(options.projectRoot, FIXTURE_RELATIVE_PATH)),
    'fixture_source_changed_during_capture');

    const evidence = {
      schema_version: EVIDENCE_SCHEMA_VERSION,
      captured_at: new Date().toISOString(),
      capture: {
        runtime: 'claude-code',
        live_runtime: true,
        simulated_hook_mode: false,
        claude_code_version: claudeCodeVersion,
        permission_mode: 'bypassPermissions',
        permission_flag: '--dangerously-skip-permissions',
        node_version: process.version,
        platform: process.platform,
        architecture: process.arch,
        disposable_projects: 3,
        disposable_profiles: 3,
        capture_owner: 'orchestrator',
        transport: 'real_stdio_mcp',
        authentication_source: authenticationSource,
        authentication_secret_persisted: false,
        project_mcp_approval: 'trusted_disposable_state_plus_enableAllProjectMcpServers',
      },
      hooks: {
        matcher: HOOK_MATCHER,
        source_sha256: sourceFacts.hook_sha256,
        registrations: sourceFacts.registrations,
      },
      broker: {
        source_sha256: sourceFacts.broker_sha256,
        normalized_config_sha256: sourceFacts.broker_config_sha256,
        active_upstream_manifest_sha256: active.evidence.upstream_manifest_sha256,
        private_upstream_kind: 'fixture_stdio',
        private_upstream_fixture_source_sha256: sourceFacts.fixture_sha256,
      },
      fixture: {
        server_name: 'vtp-kb',
        declared_tools: [SHORT_TOOL],
        source_sha256: sourceFacts.fixture_sha256,
        oversized_hit_characters: OVERSIZED_HIT_CHARS,
      },
      harness_source_sha256: sourceFacts.capture_sha256,
      frozen_files: sourceFacts.frozen_files,
      active_path: active.evidence,
      absent_guard: absent.evidence,
      same_user_bypass: bypass.evidence,
      redaction: {
        raw_session_ids_persisted: false,
        raw_tool_use_ids_persisted: false,
        witness_key_persisted: false,
        private_upstream_object_persisted: false,
        discarded_text_persisted: false,
        unrelated_transcript_content_persisted: false,
        temporary_paths_persisted: false,
      },
    };
    verifyEvidence(evidence, options.projectRoot);
    atomicWriteEvidence(options.projectRoot, options.evidencePath, evidence);
    evidenceWritten = true;
    return evidence;
  } finally {
    cleanupDisposableRoot(tempRoot);
    if (!evidenceWritten) {
      // Capture failure intentionally leaves no synthetic or partial evidence artifact.
    }
  }
}

function isHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function requireHash(value, reason) {
  requireCondition(isHash(value), reason);
}

function allStrings(value, output = []) {
  if (typeof value === 'string') {
    output.push(value);
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  if (Array.isArray(value)) {
    for (const item of value) allStrings(item, output);
  } else {
    for (const child of Object.values(value)) allStrings(child, output);
  }
  return output;
}

function assertNoSensitiveFields(evidence) {
  const forbiddenKeys = new Set([
    'session_id',
    'tool_use_id',
    'witness_key',
    'private_upstream',
    'private_upstream_object',
    'temp_dir',
    'temporary_directory',
  ]);
  walk(evidence, (value) => {
    if (Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      requireCondition(!forbiddenKeys.has(key), 'evidence_sensitive_field:' + key);
    }
  });
  for (const value of allStrings(evidence)) {
    requireCondition(!/sgsd-p167-live-[^>\s]*/i.test(value), 'evidence_temporary_path_leak');
  }
}

function requireObject(value, reason) {
  requireCondition(value && typeof value === 'object' && !Array.isArray(value), reason);
  return value;
}

function requireExactKeys(value, keys, reason) {
  requireObject(value, reason);
  requireCondition(JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys.slice().sort()), reason);
}

function verifyTranscriptObservations(observations, digest, reason) {
  requireExactKeys(observations, [
    'discovery', 'event_type_summary', 'hook_lifecycle', 'tool_results', 'tool_uses',
  ], reason + '_shape_invalid');
  requireCondition(valueDigest(observations) === digest, reason + '_digest_invalid');
  requireObject(observations.event_type_summary, reason + '_event_summary_missing');
  requireCondition(Object.keys(observations.event_type_summary).length > 0,
    reason + '_event_summary_empty');
  const discovery = requireObject(observations.discovery, reason + '_discovery_missing');
  requireCondition(Array.isArray(discovery.tool_names)
    && discovery.tool_names_sha256 === valueDigest(discovery.tool_names.slice().sort()),
  reason + '_discovery_digest_invalid');
  requireCondition(Array.isArray(observations.tool_uses) && Array.isArray(observations.tool_results),
    reason + '_tool_observations_invalid');
  for (const use of observations.tool_uses) {
    requireExactKeys(use, ['name', 'payload_sha256', 'tool_use_sha256'],
      reason + '_tool_use_shape_invalid');
    requireCondition(typeof use.name === 'string', reason + '_tool_use_name_invalid');
    requireHash(use.payload_sha256, reason + '_tool_payload_hash_invalid');
    requireHash(use.tool_use_sha256, reason + '_tool_use_hash_invalid');
  }
  for (const result of observations.tool_results) {
    requireExactKeys(result, ['content_sha256', 'is_error', 'tool_use_sha256'],
      reason + '_tool_result_shape_invalid');
    requireHash(result.content_sha256, reason + '_tool_result_content_hash_invalid');
    requireHash(result.tool_use_sha256, reason + '_tool_result_use_hash_invalid');
    requireCondition(typeof result.is_error === 'boolean', reason + '_tool_result_error_invalid');
  }
  const hooks = requireObject(observations.hook_lifecycle, reason + '_hooks_missing');
  for (const event of ['PreToolUse', 'PostToolUse']) {
    const summary = requireObject(hooks[event], reason + '_hook_missing:' + event);
    requireCondition(Number.isInteger(summary.started) && Number.isInteger(summary.responses)
      && Number.isInteger(summary.successful) && Array.isArray(summary.output_sha256)
      && summary.output_sha256.every(isHash),
    reason + '_hook_summary_invalid:' + event);
  }
  return observations;
}

function verifyFixtureObservations(container, expectedCalls, expectedScenarios, reason) {
  requireCondition(Array.isArray(container.redacted_observations),
    reason + '_observations_missing');
  requireCondition(valueDigest(container.redacted_observations)
    === container.redacted_observations_sha256,
  reason + '_observations_digest_invalid');
  const counts = {};
  for (const row of container.redacted_observations) {
    requireExactKeys(row, [
      'accepted', 'event', 'expectation', 'payload_json_characters', 'payload_keys',
      'payload_sha256', 'tool_name', 'traffic_class',
    ], reason + '_observation_shape_invalid');
    requireCondition(typeof row.event === 'string' && typeof row.traffic_class === 'string'
      && typeof row.accepted === 'boolean' && Array.isArray(row.payload_keys)
      && Number.isInteger(row.payload_json_characters),
    reason + '_observation_value_invalid');
    requireCondition(row.event !== 'tools/call' || row.traffic_class === 'invocation',
      reason + '_call_class_invalid');
    requireCondition(row.event !== 'tools/list' || row.traffic_class === 'discovery',
      reason + '_list_class_invalid');
    counts[row.event] = (counts[row.event] || 0) + 1;
  }
  requireCondition(JSON.stringify(canonicalize(counts)) === JSON.stringify(container.event_counts),
    reason + '_event_counts_invalid');
  const calls = container.redacted_observations.filter((row) => row.event === 'tools/call');
  requireCondition(calls.length === expectedCalls, reason + '_call_count_invalid');
  requireCondition(JSON.stringify(calls.map((row) => row.expectation).sort())
    === JSON.stringify(expectedScenarios.slice().sort()),
  reason + '_scenario_sequence_invalid');
  for (const row of calls) {
    requireCondition(row.accepted === true && row.tool_name === SHORT_TOOL,
      reason + '_call_not_accepted');
    requireHash(row.payload_sha256, reason + '_payload_hash_invalid');
    requireCondition(row.payload_json_characters > 0 && row.payload_keys.length > 0,
      reason + '_payload_shape_missing');
  }
  return calls;
}

function verifyActivePath(active, current) {
  requireObject(active, 'active_path_missing');
  requireObject(active.install, 'active_install_missing');
  requireCondition(active.install.substrate_granted === true, 'active_grant_missing');
  requireHash(active.session_sha256, 'active_session_hash_invalid');
  requireHash(active.transcript_sha256, 'active_transcript_hash_invalid');
  const observations = verifyTranscriptObservations(
    active.transcript_observations,
    active.transcript_observations_sha256,
    'active_transcript_observations',
  );
  requireCondition(JSON.stringify(observations.event_type_summary)
    === JSON.stringify(active.event_type_summary),
  'active_event_summary_mismatch');
  requireCondition(observations.discovery.init_present === true
    && observations.discovery.vtp_kb_connected === true
    && observations.discovery.tool_names.includes(TARGET_TOOL),
  'active_discovery_not_proven');
  requireCondition(Array.isArray(active.command)
    && active.command.includes('--dangerously-skip-permissions'),
  'active_bypass_command_missing');
  const prepared = requireObject(active.prepared_call, 'active_prepared_call_missing');
  requireObject(prepared.payload, 'active_prepared_payload_missing');
  requireHash(prepared.prepared_payload_sha256, 'active_prepared_digest_invalid');
  requireHash(prepared.actual_payload_sha256, 'active_actual_digest_invalid');
  requireCondition(prepared.intent_family === 'planning', 'active_intent_invalid');
  requireCondition(payloadDigest(prepared.payload) === prepared.prepared_payload_sha256,
    'active_prepared_digest_mismatch');
  requireCondition(prepared.actual_payload_sha256 === prepared.prepared_payload_sha256,
    'active_actual_payload_mismatch');
  requireCondition(Array.isArray(active.tool_uses) && active.tool_uses.length === 2,
    'active_tool_use_count_invalid');
  for (let index = 0; index < active.tool_uses.length; index += 1) {
    const use = requireObject(active.tool_uses[index], 'active_tool_use_invalid');
    requireCondition(use.ordinal === index + 1 && use.name === TARGET_TOOL,
      'active_tool_use_identity_invalid');
    requireHash(use.payload_sha256, 'active_tool_payload_hash_invalid');
    requireHash(use.tool_use_sha256, 'active_tool_use_hash_invalid');
  }
  requireCondition(active.tool_uses[0].denied === true
    && active.tool_uses[1].denied === false,
  'active_denial_sequence_invalid');
  requireCondition(JSON.stringify(active.tool_uses[0].policy_fields_missing)
    === JSON.stringify(['source_types', 'limit'])
    && Array.isArray(active.tool_uses[1].policy_fields_missing)
    && active.tool_uses[1].policy_fields_missing.length === 0,
  'active_policy_field_evidence_invalid');
  requireCondition(active.tool_uses[1].payload_sha256 === prepared.prepared_payload_sha256,
    'active_valid_tool_payload_mismatch');
  requireCondition(active.tool_uses[0].payload_sha256 !== prepared.prepared_payload_sha256,
    'active_invalid_payload_was_valid');
  const observedUses = observations.tool_uses.filter((use) => use.name === TARGET_TOOL);
  requireCondition(observedUses.length === 2
    && observedUses.every((use, index) => use.payload_sha256 === active.tool_uses[index].payload_sha256
      && use.tool_use_sha256 === active.tool_uses[index].tool_use_sha256),
  'active_tool_uses_not_observation_bound');
  requireCondition(active.denial_reason === DENIAL_REASON, 'active_denial_reason_invalid');
  const denialObservation = requireObject(active.denial_observation,
    'active_denial_observation_missing');
  requireExactKeys(denialObservation, ['hook_response_sha256', 'reason_sha256'],
    'active_denial_observation_shape_invalid');
  requireCondition(denialObservation.reason_sha256 === sha256(Buffer.from(DENIAL_REASON, 'utf8')),
    'active_denial_reason_hash_invalid');
  requireHash(denialObservation.hook_response_sha256,
    'active_denial_hook_response_hash_invalid');
  const hooks = requireObject(active.hooks, 'active_hook_evidence_missing');
  for (const [event, expected] of [['PreToolUse', 2], ['PostToolUse', 1]]) {
    const summary = requireObject(hooks[event], 'active_hook_summary_missing:' + event);
    requireCondition(summary.started === expected && summary.responses === expected,
      'active_hook_lifecycle_invalid:' + event);
    requireCondition(Array.isArray(summary.output_sha256)
      && summary.output_sha256.length === expected
      && summary.output_sha256.every(isHash),
    'active_hook_output_hashes_invalid:' + event);
    requireCondition(valueDigest(summary) === valueDigest(observations.hook_lifecycle[event]),
      'active_hook_observation_mismatch:' + event);
  }
  requireCondition(hooks.PreToolUse.output_sha256.includes(denialObservation.hook_response_sha256),
    'active_denial_not_bound_to_pre_hook');
  const invocation = requireObject(active.server_invocation, 'active_server_invocation_missing');
  requireCondition(invocation.count === 1, 'active_server_invocation_count_invalid');
  requireObject(invocation.payload, 'active_server_payload_missing');
  requireCondition(JSON.stringify(invocation.payload) === JSON.stringify(prepared.payload),
    'active_server_payload_mismatch');
  requireCondition(invocation.payload_sha256 === prepared.prepared_payload_sha256,
    'active_server_payload_digest_mismatch');
  requireHash(invocation.fixture_log_sha256, 'active_fixture_log_hash_invalid');
  const fixtureCalls = verifyFixtureObservations(invocation, 1, ['active-valid'], 'active_fixture');
  requireCondition(fixtureCalls[0].payload_sha256 === prepared.prepared_payload_sha256,
    'active_fixture_observation_payload_mismatch');
  const response = requireObject(active.response, 'active_response_missing');
  requireCondition(response.replacement_observed === true && response.raw_result_delivered === false,
    'active_post_replacement_missing');
  requireHash(response.raw_domain_sha256, 'active_raw_domain_hash_invalid');
  requireHash(response.replacement_domain_sha256, 'active_replacement_hash_invalid');
  requireHash(response.replacement_content_sha256, 'active_replacement_content_hash_invalid');
  requireCondition(response.raw_domain_sha256 !== response.replacement_domain_sha256,
    'active_raw_result_not_replaced');
  requireCondition(response.original_chars === OVERSIZED_HIT_CHARS,
    'active_original_character_count_invalid');
  requireCondition(response.retained_chars === RETAINED_HIT_CHARS,
    'active_retained_character_count_invalid');
  requireCondition(response.degradation_reason === DEGRADATION_REASON,
    'active_degradation_reason_invalid');
  requireCondition(response.discarded_marker_absent === true,
    'active_discarded_marker_present');
  requireHash(response.discarded_marker_sha256, 'active_discarded_marker_hash_invalid');
  requireHash(response.raw_marker_sha256, 'active_raw_marker_hash_invalid');
  const invalidObservedResult = observations.tool_results.find((row) => row.tool_use_sha256
    === active.tool_uses[0].tool_use_sha256);
  const validObservedResult = observations.tool_results.find((row) => row.tool_use_sha256
    === active.tool_uses[1].tool_use_sha256);
  requireCondition(Boolean(invalidObservedResult),
    'active_invalid_denial_result_not_observed');
  requireCondition(validObservedResult && validObservedResult.is_error === false
    && validObservedResult.content_sha256 === response.replacement_content_sha256,
  'active_valid_replacement_not_observation_bound');
  requireCondition(Array.isArray(active.witness_state_sequence)
    && active.witness_state_sequence.length === 3,
  'active_witness_sequence_missing');
  requireCondition(JSON.stringify(active.witness_state_sequence.map((row) => row.state))
    === JSON.stringify(['pre_allowed', 'rewritten', 'consumed']),
  'active_witness_sequence_invalid');
  for (const row of active.witness_state_sequence) {
    requireCondition(row.payload_digest === prepared.prepared_payload_sha256,
      'active_witness_payload_mismatch');
    requireCondition(row.session_sha256 === active.session_sha256,
      'active_witness_session_mismatch');
    requireCondition(row.tool_use_sha256 === active.tool_uses[1].tool_use_sha256,
      'active_witness_tool_use_mismatch');
    requireCondition(row.source_digest === current.hook_sha256,
      'active_witness_source_drift');
  }
  const rewritten = active.witness_state_sequence[1].rewrite;
  requireObject(rewritten, 'active_rewrite_evidence_missing');
  requireCondition(rewritten.degradation_count === 1
    && rewritten.original_chars > rewritten.retained_chars,
  'active_rewrite_counts_invalid');
  const acceptance = requireObject(active.acceptance_consumption, 'active_acceptance_missing');
  requireCondition(acceptance.ok === true
    && acceptance.intent_family === 'planning'
    && acceptance.witness_status === 'consumed'
    && acceptance.payload_sha256 === prepared.prepared_payload_sha256,
  'active_acceptance_not_consumed');
  requireCondition(active.broker_config_sha256 === current.broker_config_sha256,
    'active_broker_config_drift');
  requireHash(active.upstream_manifest_sha256, 'active_manifest_hash_invalid');
  for (const event of ['PreToolUse', 'PostToolUse']) {
    requireCondition(valueDigest(active.registrations[event])
      === valueDigest(current.registrations[event]),
    'active_registration_drift:' + event);
  }
}

function verifyAbsentGuard(absent, current) {
  requireObject(absent, 'absent_guard_missing');
  requireCondition(absent.both_hook_ids_deleted === true && absent.hook_source_deleted === true,
    'absent_deletion_proof_missing');
  requireCondition(Array.isArray(absent.deleted_hook_ids)
    && absent.deleted_hook_ids.length === 2
    && new Set(absent.deleted_hook_ids).has(PRE_HOOK_ID)
    && new Set(absent.deleted_hook_ids).has(POST_HOOK_ID),
  'absent_hook_ids_invalid');
  const list = requireObject(absent.broker_tools_list, 'absent_tools_list_missing');
  requireCondition(list.discovery_succeeded === true && list.substrate_absent === true,
    'absent_discovery_not_proven');
  requireCondition(Array.isArray(list.names)
    && !list.names.includes(SHORT_TOOL)
    && !list.names.includes(TARGET_TOOL),
  'absent_substrate_still_advertised');
  requireCondition(list.names_sha256 === valueDigest(list.names.slice().sort()),
    'absent_tools_list_digest_invalid');
  const stale = requireObject(absent.stale_call, 'absent_stale_call_missing');
  requireCondition(stale.issued_outside_model === true
    && stale.rejected === true
    && stale.bounded === true,
  'absent_stale_call_not_proven');
  requireCondition(typeof stale.reason === 'string'
    && stale.reason.startsWith(UNAVAILABLE_PREFIX)
    && stale.reason.length <= 200
    && /^[a-z0-9_:.-]+$/i.test(stale.reason),
  'absent_stale_reason_invalid');
  requireHash(stale.response_sha256, 'absent_stale_response_hash_invalid');
  requireCondition(stale.response_sha256 === valueDigest({
    content: [{ type: 'text', text: stale.reason }],
    isError: true,
  }), 'absent_stale_response_digest_mismatch');
  const fixture = requireObject(absent.fixture, 'absent_fixture_missing');
  requireCondition(fixture.tools_call_count === 0, 'absent_fixture_invocation_present');
  requireHash(fixture.log_sha256, 'absent_fixture_log_hash_invalid');
  verifyFixtureObservations(fixture, 0, [], 'absent_fixture');
  const transcript = requireObject(absent.transcript, 'absent_transcript_missing');
  requireHash(transcript.session_sha256, 'absent_session_hash_invalid');
  requireHash(transcript.transcript_sha256, 'absent_transcript_hash_invalid');
  const observations = verifyTranscriptObservations(
    transcript.observations,
    transcript.observations_sha256,
    'absent_transcript_observations',
  );
  requireCondition(JSON.stringify(observations.event_type_summary)
    === JSON.stringify(transcript.event_type_summary),
  'absent_event_summary_mismatch');
  requireCondition(transcript.broker_connected === true, 'absent_broker_connection_missing');
  requireCondition(observations.discovery.init_present === true
    && observations.discovery.vtp_kb_connected === true
    && !observations.discovery.tool_names.includes(TARGET_TOOL),
  'absent_discovery_observations_invalid');
  requireCondition(transcript.substrate_tool_use_count === 0
    && transcript.substrate_tool_result_count === 0,
  'absent_substrate_result_present');
  requireCondition(!observations.tool_uses.some((use) => use.name === TARGET_TOOL)
    && !observations.tool_results.some((result) => observations.tool_uses.some((use) =>
      use.name === TARGET_TOOL && use.tool_use_sha256 === result.tool_use_sha256)),
  'absent_substrate_observation_present');
  requireCondition(transcript.raw_marker_absent === true
    && transcript.discarded_marker_absent === true,
  'absent_fixture_marker_present');
  requireHash(transcript.raw_marker_sha256, 'absent_raw_marker_hash_invalid');
  requireHash(transcript.discarded_marker_sha256, 'absent_tail_marker_hash_invalid');
  requireCondition(Array.isArray(transcript.command)
    && transcript.command.includes('--dangerously-skip-permissions'),
  'absent_bypass_command_missing');
  const expectedProofs = [
    'claude_stream_json',
    'broker_tools_list',
    'direct_stale_tools_call',
    'fixture_append_only_log',
  ].sort();
  requireCondition(Array.isArray(absent.proof_sources)
    && JSON.stringify(absent.proof_sources.slice().sort()) === JSON.stringify(expectedProofs),
  'absent_independent_proof_sources_invalid');
  requireCondition(!absent.proof_sources.some((source) => /audit|acceptance|refusal/i.test(source)),
    'absent_relies_on_late_refusal');
  requireCondition(absent.broker_config_sha256 === current.broker_config_sha256,
    'absent_broker_config_drift');
  requireHash(absent.upstream_manifest_sha256, 'absent_manifest_hash_invalid');
  for (const event of ['PreToolUse', 'PostToolUse']) {
    requireCondition(valueDigest(absent.registrations_before_delete[event])
      === valueDigest(current.registrations[event]),
    'absent_registration_drift:' + event);
  }
}

function verifySameUserBypass(bypass, current) {
  requireObject(bypass, 'same_user_bypass_missing');
  requireCondition(bypass.boundary_result === 'bypass_succeeded',
    'same_user_bypass_not_positive');
  requireCondition(bypass.residual === 'same_user_can_restore_direct_mcp_or_replace_broker',
    'same_user_bypass_residual_invalid');
  requireCondition(bypass.private_manifest_read === true, 'same_user_manifest_read_missing');
  const alternate = requireObject(bypass.alternate_registration, 'same_user_alternate_missing');
  requireCondition(alternate.server_name === 'vtp-kb-bypass'
    && alternate.discovered === true
    && alternate.call_succeeded === true
    && alternate.v2_validation === false
    && alternate.fixture_invocation_count === 1
    && alternate.raw_markers_observed === true,
  'same_user_alternate_did_not_succeed');
  for (const field of [
    'non_v2_payload_sha256', 'tool_use_sha256', 'session_sha256', 'transcript_sha256',
    'raw_marker_sha256', 'discarded_marker_sha256', 'result_content_sha256',
  ]) requireHash(alternate[field], 'same_user_alternate_hash_invalid:' + field);
  const observations = verifyTranscriptObservations(
    alternate.transcript_observations,
    alternate.transcript_observations_sha256,
    'same_user_alternate_observations',
  );
  requireCondition(observations.discovery.init_present === true
    && observations.discovery.vtp_kb_bypass_connected === true
    && observations.discovery.tool_names.includes(BYPASS_TOOL),
  'same_user_alternate_discovery_observation_invalid');
  const alternateUses = observations.tool_uses.filter((use) => use.name === BYPASS_TOOL);
  requireCondition(alternateUses.length === 1
    && alternateUses[0].payload_sha256 === alternate.non_v2_payload_sha256
    && alternateUses[0].tool_use_sha256 === alternate.tool_use_sha256,
  'same_user_alternate_use_not_observation_bound');
  const alternateResult = observations.tool_results.find((result) => result.tool_use_sha256
    === alternate.tool_use_sha256);
  requireCondition(alternateResult && alternateResult.is_error === false
    && alternateResult.content_sha256 === alternate.result_content_sha256,
  'same_user_alternate_result_not_observation_bound');
  requireCondition(Array.isArray(alternate.command)
    && alternate.command.includes('--dangerously-skip-permissions'),
  'same_user_alternate_bypass_command_missing');
  const direct = requireObject(bypass.direct_stdio, 'same_user_direct_missing');
  requireCondition(direct.call_succeeded === true
    && direct.v2_validation === false
    && direct.fixture_invocation_count === 1
    && direct.raw_markers_observed === true,
  'same_user_direct_did_not_succeed');
  for (const field of [
    'non_v2_payload_sha256', 'response_sha256', 'raw_marker_sha256', 'discarded_marker_sha256',
  ]) requireHash(direct[field], 'same_user_direct_hash_invalid:' + field);
  requireCondition(Array.isArray(direct.command)
    && direct.command.every((value) => /^<[^>]+>$/.test(value)),
  'same_user_direct_command_not_redacted');
  requireCondition(alternate.non_v2_payload_sha256 !== direct.non_v2_payload_sha256,
    'same_user_payload_markers_not_distinguished');
  const markerHashes = [
    alternate.raw_marker_sha256,
    alternate.discarded_marker_sha256,
    direct.raw_marker_sha256,
    direct.discarded_marker_sha256,
  ];
  requireCondition(new Set(markerHashes).size === markerHashes.length,
    'same_user_response_markers_not_unique');
  const fixture = requireObject(bypass.fixture, 'same_user_fixture_missing');
  requireCondition(fixture.total_tools_call_count === 2, 'same_user_fixture_total_invalid');
  requireHash(fixture.log_sha256, 'same_user_fixture_log_hash_invalid');
  const fixtureCalls = verifyFixtureObservations(
    fixture,
    2,
    ['same-user-alternate', 'same-user-direct'],
    'same_user_fixture',
  );
  requireCondition(fixtureCalls.some((row) => row.expectation === 'same-user-alternate'
    && row.payload_sha256 === alternate.non_v2_payload_sha256)
    && fixtureCalls.some((row) => row.expectation === 'same-user-direct'
      && row.payload_sha256 === direct.non_v2_payload_sha256),
  'same_user_fixture_payloads_not_observation_bound');
  const store = requireObject(bypass.witness_store, 'same_user_witness_store_missing');
  const before = requireObject(store.before, 'same_user_witness_before_missing');
  const after = requireObject(store.after, 'same_user_witness_after_missing');
  for (const snapshot of [before, after]) {
    requireHash(snapshot.authoritative_sha256, 'same_user_authoritative_hash_invalid');
    requireHash(snapshot.mirror_sha256, 'same_user_mirror_hash_invalid');
    requireCondition(snapshot.matching_row_count === 0, 'same_user_matching_witness_present');
  }
  requireCondition(before.authoritative_sha256 === after.authoritative_sha256
    && before.mirror_sha256 === after.mirror_sha256,
  'same_user_witness_store_changed');
  requireCondition(store.authoritative_matching_row_count === 0
    && store.mirrored_matching_row_count === 0,
  'same_user_matching_witness_row_present');
  requireCondition(Array.isArray(bypass.redacted_commands) && bypass.redacted_commands.length === 2,
    'same_user_redacted_commands_missing');
  const digests = requireObject(
    bypass.source_and_configuration_digests,
    'same_user_source_digests_missing',
  );
  requireCondition(digests.fixture_source_sha256 === current.fixture_sha256,
    'same_user_fixture_source_drift');
  requireCondition(digests.broker_config_sha256 === current.broker_config_sha256,
    'same_user_broker_config_drift');
  for (const field of [
    'upstream_manifest_sha256', 'alternate_registration_sha256', 'agent_source_sha256',
  ]) requireHash(digests[field], 'same_user_configuration_hash_invalid:' + field);
}

function verifyEvidence(evidence, projectRoot) {
  requireObject(evidence, 'evidence_root_invalid');
  requireExactKeys(evidence, [
    'absent_guard', 'active_path', 'broker', 'capture', 'captured_at', 'fixture',
    'frozen_files', 'harness_source_sha256', 'hooks', 'redaction', 'same_user_bypass',
    'schema_version',
  ], 'evidence_root_shape_invalid');
  requireCondition(evidence.schema_version === EVIDENCE_SCHEMA_VERSION,
    'evidence_schema_version_invalid');
  const capturedAt = Date.parse(evidence.captured_at);
  requireCondition(Number.isFinite(capturedAt)
    && capturedAt <= Date.now() + 300000,
  'evidence_capture_time_invalid');
  assertNoSensitiveFields(evidence);
  const current = collectCurrentSourceFacts(projectRoot);
  const capture = requireObject(evidence.capture, 'capture_metadata_missing');
  requireExactKeys(capture, [
    'architecture', 'authentication_secret_persisted', 'authentication_source', 'capture_owner',
    'claude_code_version', 'disposable_profiles', 'disposable_projects', 'live_runtime',
    'node_version', 'permission_flag', 'permission_mode', 'platform', 'project_mcp_approval',
    'runtime', 'simulated_hook_mode', 'transport',
  ], 'capture_metadata_shape_invalid');
  requireCondition(capture.runtime === 'claude-code'
    && capture.live_runtime === true
    && capture.simulated_hook_mode === false
    && capture.permission_mode === 'bypassPermissions'
    && capture.permission_flag === '--dangerously-skip-permissions'
    && capture.transport === 'real_stdio_mcp'
    && capture.capture_owner === 'orchestrator'
    && capture.authentication_source === 'inherited_secret_environment'
    && capture.authentication_secret_persisted === false
    && capture.project_mcp_approval
      === 'trusted_disposable_state_plus_enableAllProjectMcpServers',
  'capture_runtime_or_mode_invalid');
  requireCondition(capture.disposable_projects === 3 && capture.disposable_profiles === 3,
    'capture_disposable_isolation_invalid');
  requireCondition(capture.node_version === process.version
    && capture.platform === process.platform
    && capture.architecture === process.arch,
  'capture_runtime_version_drift');
  const claudeVersion = parseClaudeVersion(capture.claude_code_version);
  requireCondition(versionAtLeast(claudeVersion.parts, MIN_CLAUDE_VERSION),
    'capture_claude_version_invalid');

  const hooks = requireObject(evidence.hooks, 'hook_metadata_missing');
  requireExactKeys(hooks, ['matcher', 'registrations', 'source_sha256'],
    'hook_metadata_shape_invalid');
  requireExactKeys(hooks.registrations, ['PostToolUse', 'PreToolUse'],
    'hook_registrations_shape_invalid');
  requireCondition(hooks.matcher === HOOK_MATCHER, 'hook_matcher_invalid');
  requireCondition(hooks.source_sha256 === current.hook_sha256, 'hook_source_hash_drift');
  for (const event of ['PreToolUse', 'PostToolUse']) {
    const actual = requireObject(hooks.registrations[event], 'hook_registration_missing:' + event);
    requireCondition(valueDigest(actual) === valueDigest(current.registrations[event]),
      'hook_registration_hash_drift:' + event);
  }
  const broker = requireObject(evidence.broker, 'broker_metadata_missing');
  requireExactKeys(broker, [
    'active_upstream_manifest_sha256', 'normalized_config_sha256',
    'private_upstream_fixture_source_sha256', 'private_upstream_kind', 'source_sha256',
  ], 'broker_metadata_shape_invalid');
  requireCondition(broker.source_sha256 === current.broker_sha256, 'broker_source_hash_drift');
  requireCondition(broker.normalized_config_sha256 === current.broker_config_sha256,
    'broker_config_hash_drift');
  requireHash(broker.active_upstream_manifest_sha256, 'broker_manifest_hash_invalid');
  requireCondition(broker.private_upstream_kind === 'fixture_stdio'
    && broker.private_upstream_fixture_source_sha256 === current.fixture_sha256,
  'broker_private_upstream_binding_invalid');
  const fixture = requireObject(evidence.fixture, 'fixture_metadata_missing');
  requireExactKeys(fixture, [
    'declared_tools', 'oversized_hit_characters', 'server_name', 'source_sha256',
  ], 'fixture_metadata_shape_invalid');
  requireCondition(fixture.server_name === 'vtp-kb'
    && Array.isArray(fixture.declared_tools)
    && JSON.stringify(fixture.declared_tools) === JSON.stringify([SHORT_TOOL])
    && fixture.oversized_hit_characters === OVERSIZED_HIT_CHARS,
  'fixture_contract_invalid');
  requireCondition(fixture.source_sha256 === current.fixture_sha256,
    'fixture_source_hash_drift');
  requireCondition(evidence.harness_source_sha256 === current.capture_sha256,
    'capture_harness_source_hash_drift');
  const frozen = requireObject(evidence.frozen_files, 'frozen_file_evidence_missing');
  requireCondition(JSON.stringify(Object.keys(frozen).sort()) === JSON.stringify(FROZEN_FILES.slice().sort()),
    'frozen_file_evidence_shape_invalid');
  for (const relative of FROZEN_FILES) {
    const row = requireObject(frozen[relative], 'frozen_file_row_missing:' + relative);
    const actual = fileSha256(path.join(projectRoot, relative));
    requireCondition(row.before_sha256 === actual && row.after_sha256 === actual,
      'frozen_file_hash_drift:' + relative);
  }

  verifyActivePath(evidence.active_path, current);
  verifyAbsentGuard(evidence.absent_guard, current);
  verifySameUserBypass(evidence.same_user_bypass, current);
  requireCondition(broker.active_upstream_manifest_sha256
    === evidence.active_path.upstream_manifest_sha256,
  'broker_active_manifest_binding_invalid');
  requireCondition(evidence.active_path.server_invocation.count === 1
    && evidence.absent_guard.fixture.tools_call_count === 0
    && evidence.same_user_bypass.fixture.total_tools_call_count === 2,
  'scenario_invocation_counts_invalid');
  const redaction = requireObject(evidence.redaction, 'redaction_evidence_missing');
  const redactionKeys = [
    'discarded_text_persisted', 'private_upstream_object_persisted',
    'raw_session_ids_persisted', 'raw_tool_use_ids_persisted',
    'temporary_paths_persisted', 'unrelated_transcript_content_persisted',
    'witness_key_persisted',
  ];
  requireExactKeys(redaction, redactionKeys, 'redaction_evidence_shape_invalid');
  for (const [key, value] of Object.entries(redaction)) {
    requireCondition(value === false, 'redaction_failure:' + key);
  }
  requireCondition(!allStrings(evidence.same_user_bypass)
    .some((value) => /bypass_(?:prevented|denied)|sealed_boundary/i.test(value)),
  'same_user_bypass_mischaracterized');
  return {
    ok: true,
    schema_version: evidence.schema_version,
    active_invocations: evidence.active_path.server_invocation.count,
    absent_invocations: evidence.absent_guard.fixture.tools_call_count,
    same_user_bypass_invocations: evidence.same_user_bypass.fixture.total_tools_call_count,
  };
}

function safeFailureReason(error) {
  const reason = error && typeof error.message === 'string' ? error.message : 'harness_internal_error';
  return /^[a-z0-9_:.-]+$/i.test(reason) ? reason.slice(0, 240) : 'harness_internal_error';
}

async function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
    if (options.mode === 'verify') {
      requireCondition(fs.existsSync(options.evidencePath), 'evidence_file_missing');
      const evidence = readJson(options.evidencePath, 'evidence_json_invalid');
      const result = verifyEvidence(evidence, options.projectRoot);
      process.stdout.write('P167_T5_VERIFY PASS ' + JSON.stringify(result) + '\n');
      return 0;
    }
    const evidence = await captureAll(options);
    process.stdout.write('P167_T5_CAPTURE PASS schema=' + evidence.schema_version + '\n');
    return 0;
  } catch (error) {
    const mode = options && options.mode ? options.mode.toUpperCase() : 'HARNESS';
    process.stderr.write('P167_T5_' + mode + ' FAIL ' + safeFailureReason(error) + '\n');
    return 1;
  }
}

module.exports = {
  EVIDENCE_SCHEMA_VERSION,
  captureAll,
  collectCurrentSourceFacts,
  parseArgs,
  parseStreamEvents,
  verifyEvidence,
};

if (require.main === module) {
  main(process.argv.slice(2)).then((status) => { process.exitCode = status; });
}
