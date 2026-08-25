#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const CHECK_TIMEOUT_MS = 5_000;
const SMOKE_TIMEOUT_FLOOR_MS = 15_000;
const SMOKE_TIMEOUT_MS = SMOKE_TIMEOUT_FLOOR_MS;
const SMOKE_CONCURRENCY = 4;
const SMOKE_OUTPUT_MAX_BYTES = 8192;
const SMOKE_MANIFEST_MODE = '--smoke-manifest';
const SMOKE_REPO_OVERLAY_MODE = '--smoke-repo-overlay';
const PREFLIGHT_PROJECT_SETTINGS_MODE = '--preflight-project-settings';
const SUPPORTED_INTERPRETERS = new Set(['node', 'bash']);

class HookRegistrationPreflightError extends Error {
  constructor(issues) {
    const lines = issues.map((issue) => {
      const location = `${issue.event}/${issue.hookId}`;
      const detail = issue.detail ? ` (${issue.detail})` : '';
      return `${issue.code} ${issue.scriptPath} [${location}]${detail}`;
    });
    super(lines.join('\n'));
    this.name = 'HookRegistrationPreflightError';
    this.issues = issues;
  }
}

class HookSmokeError extends Error {
  constructor(descriptor, underlyingError = null) {
    const location = descriptor.event + '/' + descriptor.hookId;
    super('hook_smoke_failed ' + descriptor.scriptPath + ' [' + location + ']');
    this.name = 'HookSmokeError';
    this.descriptor = descriptor;
    this.code = 'hook_smoke_failed';
    this.underlyingError = underlyingError;
    this.underlying_error = underlyingError;
  }
}

function boundedLine(value, maxBytes = 2048) {
  const oneLine = String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  const bytes = Buffer.from(oneLine, 'utf8');
  if (bytes.length <= maxBytes) return oneLine;
  return bytes.subarray(0, maxBytes).toString('utf8').replace(/\uFFFD$/u, '');
}

function boundedText(value, maxBytes) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value || ''), 'utf8');
  if (bytes.length <= maxBytes) return bytes.toString('utf8');
  return bytes.subarray(0, maxBytes).toString('utf8').replace(/\uFFFD$/u, '');
}

function sanitizedBoundedLine(value, maxBytes = 2048) {
  let inRequireStack = false;
  const kept = [];
  for (const line of String(value || '').replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*Require stack:\s*$/i.test(line)) {
      inRequireStack = true;
      continue;
    }
    if (inRequireStack && /^\s*-\s+/.test(line)) continue;
    inRequireStack = false;
    if (/^\s*at\s+/.test(line)) continue;
    kept.push(line);
  }
  return boundedLine(kept.join('\n'), maxBytes);
}

function moduleFailureDetail(output, options = {}) {
  const message = sanitizedBoundedLine(output);
  if (!/MODULE_NOT_FOUND|Cannot find module/.test(message)) return {
    code: 'HOOK_PROCESS_FAILED',
    request: null,
    path: null,
    message,
  };
  const requestMatch = message.match(/Cannot find module\s+['\u0022]([^'\u0022]+)['\u0022]/);
  const request = requestMatch ? requestMatch[1] : null;
  let resolvedPath = request && path.isAbsolute(request) ? path.resolve(request) : null;
  if (resolvedPath && options.candidateRoot && options.targetRoot) {
    const relative = path.relative(path.resolve(options.candidateRoot), resolvedPath);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      resolvedPath = path.resolve(options.targetRoot, relative);
    }
  }
  return {
    code: 'MODULE_NOT_FOUND',
    request,
    path: resolvedPath,
    message,
  };
}

function isCleanPolicyDecision(output) {
  const decision = String(output || '').replace(/\r\n?/g, '\n').trim();
  if (!decision || decision.includes('\n')) return false;
  return /^\[[a-z0-9_.:-]+\]\s+(?:[a-z0-9_.:-]+\s+)*(?:blocked|denied|refused):\s+\S[^\r\n]*$/i
    .test(decision);
}

function launchInvalid(event, hookId, scriptPath, detail) {
  throw new HookRegistrationPreflightError([{
    code: 'hook_registration_launch_invalid',
    event,
    hookId,
    scriptPath: scriptPath || '<unresolved>',
    detail,
  }]);
}

function normalizeScriptPath(rawValue, allowUnquotedWhitespace) {
  const raw = typeof rawValue === 'string' ? rawValue.trim() : '';
  const quoted = raw.match(/^(?:"([^"]+)"|'([^']+)')$/);
  if (quoted) return quoted[1] || quoted[2];
  if (!raw || (!allowUnquotedWhitespace && /\s/.test(raw))) return null;
  return raw;
}

function parseScriptPath(rawValue, event, hookId, allowUnquotedWhitespace) {
  const scriptPath = normalizeScriptPath(rawValue, allowUnquotedWhitespace);
  if (!scriptPath) launchInvalid(event, hookId, null, 'expected exactly one script path');
  return scriptPath;
}

function parseCombinedCommand(command, event, hookId) {
  const raw = typeof command === 'string' ? command.trim() : '';
  const match = raw.match(/^(node|bash)\s+(.+)$/i);
  if (!match) launchInvalid(event, hookId, null, 'expected node|bash followed by exactly one script path');
  return {
    interpreter: match[1].toLowerCase(),
    scriptPath: parseScriptPath(match[2], event, hookId, false),
  };
}

function descriptorFor(hook, event, hookId, matcher = null) {
  if (!hook || typeof hook !== 'object' || Array.isArray(hook)) {
    launchInvalid(event, hookId, null, 'command hook must be an object');
  }
  const command = typeof hook.command === 'string' ? hook.command.trim() : '';
  if (!command) launchInvalid(event, hookId, null, 'command hook has no command');

  let interpreter;
  let scriptPath;
  let argv = [];
  const normalizedCommand = command.toLowerCase();
  if (SUPPORTED_INTERPRETERS.has(normalizedCommand)) {
    if (!Array.isArray(hook.args) || hook.args.length < 1 || typeof hook.args[0] !== 'string') {
      launchInvalid(event, hookId, null, 'split launch requires a script path in args[0]');
    }
    interpreter = normalizedCommand;
    scriptPath = parseScriptPath(hook.args[0], event, hookId, true);
    argv = hook.args.slice(1).map((value) => String(value));
  } else {
    if (Object.prototype.hasOwnProperty.call(hook, 'args')
      && (!Array.isArray(hook.args) || hook.args.length > 0)) {
      launchInvalid(event, hookId, null, 'combined launch cannot also declare args');
    }
    ({ interpreter, scriptPath } = parseCombinedCommand(command, event, hookId));
  }

  if (!scriptPath || !path.isAbsolute(scriptPath)) {
    launchInvalid(event, hookId, scriptPath, 'script path must already be realized and absolute');
  }
  return {
    event,
    hookId,
    interpreter,
    scriptPath: path.resolve(scriptPath),
    timeout: Number.isFinite(hook.timeout) ? hook.timeout : null,
    argv,
    matcher: typeof matcher === 'string' ? matcher : null,
  };
}

function enumerateHookRegistrations(overlay) {
  const descriptors = [];
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    launchInvalid('overlay', 'root', null, 'overlay must be an object');
  }
  if (overlay.hooks === undefined) return descriptors;
  if (!overlay.hooks || typeof overlay.hooks !== 'object' || Array.isArray(overlay.hooks)) {
    launchInvalid('hooks', 'root', null, 'hooks must be an event object');
  }
  for (const [event, entries] of Object.entries(overlay.hooks)) {
    if (event === '_comment') continue;
    if (!Array.isArray(entries)) launchInvalid(event, 'event', null, 'hook event must be an array');
    entries.forEach((entry, entryIndex) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !Array.isArray(entry.hooks)) {
        launchInvalid(
          event,
          `${event}[${entryIndex}]`,
          null,
          'hook entry must contain a hooks array',
        );
      }
      entry.hooks.forEach((hook, hookIndex) => {
        if (!hook || typeof hook !== 'object' || Array.isArray(hook)) {
          launchInvalid(
            event,
            `${event}[${entryIndex}].hooks[${hookIndex}]`,
            null,
            'hook must be an object',
          );
        }
        if (hook.type !== 'command') return;
        const hookId = typeof entry.sgsd_hook_id === 'string' && entry.sgsd_hook_id.trim()
          ? entry.sgsd_hook_id.trim()
          : `${event}[${entryIndex}].hooks[${hookIndex}]`;
        descriptors.push(descriptorFor(hook, event, hookId, entry.matcher));
      });
    });
  }
  return descriptors;
}

function pathIsInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolvedPathKey(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function readPreparedCandidateDeliveryPaths(descriptorPath) {
  const resolvedDescriptorPath = path.resolve(String(descriptorPath || ''));
  const descriptor = JSON.parse(fs.readFileSync(resolvedDescriptorPath, 'utf8'));
  if (!descriptor || descriptor.schema_version !== 1
      || path.resolve(descriptor.candidate_root || '') !== path.dirname(resolvedDescriptorPath)
      || !Array.isArray(descriptor.rows)) {
    throw new Error('invalid sealed install candidate descriptor');
  }
  const deliveryPaths = new Set();
  for (const row of descriptor.rows) {
    if (!row || typeof row.publication_path !== 'string'
        || !path.isAbsolute(row.publication_path)) {
      throw new Error('invalid sealed install candidate delivery row');
    }
    deliveryPaths.add(resolvedPathKey(row.publication_path));
  }
  return deliveryPaths;
}

function parseHookSmokeManifest(source, hooksRoot) {
  const rawRoot = String(hooksRoot || '');
  const root = path.resolve(rawRoot);
  if (!rawRoot || !path.isAbsolute(rawRoot)) {
    launchInvalid('manifest', 'root', root || null, 'hook deployment root must be absolute');
  }
  const descriptors = [];
  const lines = String(source || '').split(/\r?\n/);
  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const fields = line.split('|');
    if (fields.length !== 5) {
      launchInvalid('manifest', 'line-' + (index + 1), null, 'expected event|hook-id|interpreter|script|timeout');
    }
    const [event, hookId, rawInterpreter, scriptName, rawTimeout] = fields.map((field) => field.trim());
    const interpreter = rawInterpreter.toLowerCase();
    if (!event || !hookId || !SUPPORTED_INTERPRETERS.has(interpreter) || !scriptName) {
      launchInvalid(event || 'manifest', hookId || ('line-' + (index + 1)), scriptName, 'manifest descriptor is incomplete');
    }
    const timeout = rawTimeout === '' ? null : Number(rawTimeout);
    if (timeout !== null && (!Number.isFinite(timeout) || timeout <= 0)) {
      launchInvalid(event, hookId, scriptName, 'timeout must be a positive number of seconds');
    }
    const scriptPath = path.resolve(root, scriptName);
    if (!pathIsInside(root, scriptPath)) {
      launchInvalid(event, hookId, scriptPath, 'manifest script escapes hook deployment root');
    }
    descriptors.push({ event, hookId, interpreter, scriptPath, timeout });
  });
  return descriptors;
}

function preflightHookDeploymentSources(descriptors, sourceRoot, adapters = {}) {
  if (!Array.isArray(descriptors)) {
    launchInvalid('deployment-sources', 'root', null, 'descriptors must be an array');
  }
  const rawRoot = String(sourceRoot || '');
  const root = path.resolve(rawRoot);
  if (!rawRoot || !path.isAbsolute(rawRoot)) {
    launchInvalid('deployment-sources', 'root', root || null, 'hook source root must be absolute');
  }
  const isFile = adapters.isFile || defaultIsFile;
  const issues = [];
  for (const descriptor of descriptors) {
    const sourcePath = path.resolve(root, path.basename(descriptor.scriptPath));
    let present = false;
    try {
      present = isFile(sourcePath, descriptor) === true;
    } catch (_error) {
      present = false;
    }
    if (!present) {
      issues.push({
        code: 'hook_registration_missing',
        event: descriptor.event,
        hookId: descriptor.hookId,
        scriptPath: descriptor.scriptPath,
      });
    }
  }
  if (issues.length > 0) throw new HookRegistrationPreflightError(issues);
  return descriptors;
}

function realizeRepoLocalHookOverlay(value, repoRoot) {
  const rawRoot = String(repoRoot || '');
  const root = path.resolve(rawRoot);
  if (!rawRoot || !path.isAbsolute(rawRoot)) {
    launchInvalid('repo-overlay', 'root', root || null, 'repo root must be absolute');
  }
  if (Array.isArray(value)) return value.map((child) => realizeRepoLocalHookOverlay(child, root));
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = realizeRepoLocalHookOverlay(child, root);
  }
  if (out.type === 'command' && Array.isArray(out.args) && typeof out.args[0] === 'string') {
    const scriptPath = path.resolve(root, out.args[0]);
    if (!pathIsInside(root, scriptPath)) {
      launchInvalid('repo-overlay', 'command', scriptPath, 'repo-local hook escapes repo root');
    }
    out.args = [scriptPath, ...out.args.slice(1)];
  }
  return out;
}

function defaultIsFile(scriptPath) {
  try {
    return fs.statSync(scriptPath).isFile();
  } catch (_error) {
    return false;
  }
}

function defaultNodeCheck(scriptPath) {
  return spawnSync(process.execPath, ['--check', scriptPath], {
    shell: false,
    stdio: 'ignore',
    timeout: CHECK_TIMEOUT_MS,
    windowsHide: true,
  });
}

function defaultShellCheck(scriptPath) {
  return spawnSync(process.env.SGSD_BASH_PATH || 'bash', ['-n', scriptPath], {
    shell: false,
    stdio: 'ignore',
    timeout: CHECK_TIMEOUT_MS,
    windowsHide: true,
  });
}

function checkPassed(result) {
  if (result === true) return true;
  return Boolean(result)
    && !result.error
    && !result.signal
    && result.status === 0;
}

function preflightHookDescriptors(descriptors, adapters = {}) {
  if (!Array.isArray(descriptors)) {
    launchInvalid('descriptors', 'root', null, 'descriptors must be an array');
  }
  const isFile = adapters.isFile || defaultIsFile;
  const nodeCheck = adapters.nodeCheck || defaultNodeCheck;
  const shellCheck = adapters.shellCheck || defaultShellCheck;
  const issues = [];

  for (const descriptor of descriptors) {
    let present = false;
    try {
      present = isFile(descriptor.scriptPath, descriptor) === true;
    } catch (_error) {
      present = false;
    }
    if (!present) {
      issues.push({
        code: 'hook_registration_missing',
        event: descriptor.event,
        hookId: descriptor.hookId,
        scriptPath: descriptor.scriptPath,
      });
      continue;
    }

    const checker = descriptor.interpreter === 'node' ? nodeCheck : shellCheck;
    let result;
    try {
      result = checker(descriptor.scriptPath, descriptor);
    } catch (_error) {
      result = null;
    }
    if (!checkPassed(result)) {
      issues.push({
        code: descriptor.interpreter === 'node'
          ? 'hook_registration_node_check_failed'
          : 'hook_registration_shell_check_failed',
        event: descriptor.event,
        hookId: descriptor.hookId,
        scriptPath: descriptor.scriptPath,
      });
    }
  }

  if (issues.length > 0) throw new HookRegistrationPreflightError(issues);
  return descriptors;
}

function preflightHookRegistrations(overlay, adapters = {}) {
  return preflightHookDescriptors(enumerateHookRegistrations(overlay), adapters);
}

function enumerateProjectManagedHookRegistrations(settings) {
  const managed = { hooks: {} };
  for (const [event, entries] of Object.entries((settings && settings.hooks) || {})) {
    if (!Array.isArray(entries)) continue;
    const selected = entries.filter((entry) => entry && entry.sgsd_managed === true);
    if (selected.length > 0) managed.hooks[event] = selected;
  }
  return enumerateHookRegistrations(managed);
}

function hookMatchesDescriptorIdentity(hook, event, manifestDescriptor) {
  if (event !== manifestDescriptor.event
    || !hook
    || typeof hook !== 'object'
    || Array.isArray(hook)
    || hook.type !== 'command') {
    return false;
  }
  const command = typeof hook.command === 'string' ? hook.command.trim() : '';
  if (!command) return false;

  let interpreter;
  let scriptPath;
  const normalizedCommand = command.toLowerCase();
  if (SUPPORTED_INTERPRETERS.has(normalizedCommand)) {
    if (!Array.isArray(hook.args) || typeof hook.args[0] !== 'string') return false;
    interpreter = normalizedCommand;
    scriptPath = normalizeScriptPath(hook.args[0], true);
  } else {
    const match = command.match(/^(node|bash)\s+(.+)$/i);
    if (!match) return false;
    interpreter = match[1].toLowerCase();
    scriptPath = normalizeScriptPath(match[2], false);
  }
  if (!scriptPath || !path.isAbsolute(scriptPath)) return false;
  return interpreter === manifestDescriptor.interpreter
    && path.basename(scriptPath).toLowerCase()
      === path.basename(manifestDescriptor.scriptPath).toLowerCase();
}

function enumerateGlobalManifestCoverage(settings, manifestDescriptors) {
  if (!Array.isArray(manifestDescriptors)) {
    launchInvalid('coverage-manifest', 'root', null, 'manifest descriptors must be an array');
  }
  const hooks = settings
    && typeof settings === 'object'
    && !Array.isArray(settings)
    && settings.hooks
    && typeof settings.hooks === 'object'
    && !Array.isArray(settings.hooks)
    ? settings.hooks
    : {};
  const descriptors = [];
  const seenRows = new Set();

  for (const manifestDescriptor of manifestDescriptors) {
    const entries = hooks[manifestDescriptor.event];
    if (!Array.isArray(entries)) continue;
    entries.forEach((entry, entryIndex) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry) || !Array.isArray(entry.hooks)) return;
      entry.hooks.forEach((hook, hookIndex) => {
        if (!hookMatchesDescriptorIdentity(hook, manifestDescriptor.event, manifestDescriptor)) return;
        const rowIdentity = `${manifestDescriptor.event}/${entryIndex}/${hookIndex}`;
        if (seenRows.has(rowIdentity)) return;
        const hookId = typeof entry.sgsd_hook_id === 'string' && entry.sgsd_hook_id.trim()
          ? entry.sgsd_hook_id.trim()
          : `${manifestDescriptor.event}[${entryIndex}].hooks[${hookIndex}]`;
        try {
          const descriptor = descriptorFor(hook, manifestDescriptor.event, hookId, entry.matcher);
          if (!sameHookRegistration(manifestDescriptor, descriptor)) return;
          seenRows.add(rowIdentity);
          descriptors.push(descriptor);
        } catch (error) {
          if (!(error instanceof HookRegistrationPreflightError)) throw error;
          // Unparseable global rows are non-coverage and remain operator-silent.
        }
      });
    });
  }
  return descriptors;
}

function sameHookRegistration(projectDescriptor, globalDescriptor) {
  return projectDescriptor.event === globalDescriptor.event
    && projectDescriptor.interpreter === globalDescriptor.interpreter
    && JSON.stringify(projectDescriptor.argv || []) === JSON.stringify(globalDescriptor.argv || [])
    && path.basename(projectDescriptor.scriptPath).toLowerCase()
      === path.basename(globalDescriptor.scriptPath).toLowerCase();
}

function hookDescriptorIdentity(descriptor) {
  const scriptPath = path.resolve(descriptor.scriptPath);
  return JSON.stringify([
    descriptor.event,
    descriptor.hookId,
    descriptor.interpreter,
    descriptor.argv || [],
    process.platform === 'win32' ? scriptPath.toLowerCase() : scriptPath,
  ]);
}

function filterWarnedHookDescriptors(descriptors, warnedDescriptors, adapters = {}) {
  const warnedIdentities = new Set(warnedDescriptors.map(hookDescriptorIdentity));
  const isFile = adapters.isFile || defaultIsFile;
  return descriptors.filter((descriptor) => {
    if (!warnedIdentities.has(hookDescriptorIdentity(descriptor))) return true;
    try {
      return isFile(descriptor.scriptPath, descriptor) === true;
    } catch (_error) {
      return false;
    }
  });
}

function findLiveGlobalCoverage(projectDescriptor, globalDescriptors, adapters) {
  for (const globalDescriptor of globalDescriptors) {
    if (!sameHookRegistration(projectDescriptor, globalDescriptor)) continue;
    try {
      preflightHookDescriptors([globalDescriptor], adapters);
      return globalDescriptor;
    } catch (_error) {
      // A matching registration without a live deployed script is not coverage.
    }
  }
  return null;
}

function preflightProjectManagedRegistrations(projectSettings, globalSettings, adapters = {}) {
  const projectDescriptors = enumerateProjectManagedHookRegistrations(projectSettings);
  const globalDescriptors = enumerateGlobalManifestCoverage(
    globalSettings || {},
    projectDescriptors,
  );
  const candidateDeliveryPaths = new Set(
    adapters.candidateDeliveryPaths instanceof Set
      ? [...adapters.candidateDeliveryPaths].map((item) => resolvedPathKey(item))
      : [],
  );
  const refusals = [];
  const warnings = [];
  const warnedDescriptors = [];

  for (const descriptor of projectDescriptors) {
    try {
      preflightHookDescriptors([descriptor], adapters);
    } catch (error) {
      if (!(error instanceof HookRegistrationPreflightError)) throw error;
      for (const issue of error.issues) {
        if (issue.code === 'hook_registration_missing'
            && candidateDeliveryPaths.has(resolvedPathKey(issue.scriptPath))) {
          continue;
        }
        const coverage = issue.code === 'hook_registration_missing'
          ? findLiveGlobalCoverage(descriptor, globalDescriptors, adapters)
          : null;
        if (coverage) {
          warnedDescriptors.push(descriptor);
          warnings.push({
            ...issue,
            code: 'project_hook_registration_missing_global_covered',
            globalScriptPath: coverage.scriptPath,
          });
        } else {
          refusals.push(issue);
        }
      }
    }
  }

  if (refusals.length > 0) {
    throw new HookRegistrationPreflightError(refusals);
  }
  return { descriptors: projectDescriptors, warnings, warnedDescriptors };
}

function descriptorSmokeTimeout(descriptor) {
  const registeredBudget = Number.isFinite(descriptor.timeout) && descriptor.timeout > 0
    ? descriptor.timeout * 1000
    : SMOKE_TIMEOUT_MS;
  return Math.max(SMOKE_TIMEOUT_FLOOR_MS, registeredBudget);
}

function smokePayload(descriptor, cwd) {
  const event = descriptor.event;
  const matcher = descriptor.matcher && descriptor.matcher !== '*'
    ? descriptor.matcher.split('|')[0]
    : 'Read';
  const mcp = matcher.startsWith('mcp__');
  const payload = {
    hook_event_name: event,
    cwd,
    session_id: 'sgsd-installer-hook-smoke',
    prompt: 'SGSD installer dependency smoke',
    tool_name: matcher,
    tool_input: mcp
      ? { schema_version: 'vtp-mcp-input-schemas.v2', query: 'installer dependency smoke' }
      : { file_path: 'sgsd-hook-smoke.txt' },
    tool_response: { ok: true },
  };
  if (mcp) {
    payload.tool_use_id = 'sgsd-installer-hook-smoke-tool';
    payload.tool_response = {
      content: [{ type: 'text', text: JSON.stringify({ hits: [] }) }],
    };
  }
  return payload;
}

function spawnSmokeHook(descriptor, options) {
  const {
    bashPath,
    cwd,
    home,
    nodePath,
    spawnProcess,
    env,
  } = options;
  const input = JSON.stringify(smokePayload(descriptor, cwd)) + '\n';
  return new Promise((resolve) => {
    let child;
    let settled = false;
    const outputChunks = [];
    let outputByteLength = 0;
    let outputTruncated = false;
    const captureOutput = (chunk) => {
      if (outputTruncated) return;
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk || ''), 'utf8');
      if (bytes.length === 0) return;
      const remaining = SMOKE_OUTPUT_MAX_BYTES - outputByteLength;
      if (bytes.length <= remaining) {
        outputChunks.push(bytes);
        outputByteLength += bytes.length;
        return;
      }
      outputTruncated = true;
      const retained = bytes.subarray(0, remaining + 1);
      outputChunks.push(retained);
      outputByteLength += retained.length;
    };
    const finish = (passed, launchError = null, status = null, signal = null) => {
      if (settled) return;
      settled = true;
      resolve({
        passed,
        output: boundedText(Buffer.concat(outputChunks, outputByteLength), SMOKE_OUTPUT_MAX_BYTES),
        outputTruncated,
        launchError,
        status,
        signal,
      });
    };
    try {
      child = spawnProcess(
        descriptor.interpreter === 'node' ? nodePath : bashPath,
        [descriptor.scriptPath, ...(descriptor.argv || [])],
        {
          cwd,
          env: env || { ...process.env, HOME: home, USERPROFILE: home },
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: descriptorSmokeTimeout(descriptor),
          windowsHide: true,
        },
      );
      if (child.stdout && typeof child.stdout.on === 'function') {
        child.stdout.on('data', captureOutput);
      }
      if (child.stderr && typeof child.stderr.on === 'function') {
        child.stderr.on('data', captureOutput);
      }
      child.once('error', (error) => finish(false, error));
      child.once('close', (status, signal) => (
        finish(checkPassed({ status, signal }), null, status, signal)
      ));
      if (child.stdin && typeof child.stdin.once === 'function') {
        child.stdin.once('error', () => {
          // The child close status remains authoritative, as with spawnSync.
        });
      }
      child.stdin.end(input);
    } catch (_error) {
      if (child && typeof child.kill === 'function') {
        try {
          child.kill();
        } catch (_killError) {
          // Preserve the launch failure as the smoke result.
        }
      }
      finish(false, _error);
    }
  });
}

async function mapWithConcurrency(items, concurrency, task) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  }
  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function smokeHookRegistrations(descriptors, adapters = {}) {
  const checked = preflightHookDescriptors(descriptors, adapters);
  const spawnProcess = adapters.spawn || spawn;
  const nodePath = adapters.nodePath || process.execPath;
  const bashPath = adapters.bashPath || process.env.SGSD_BASH_PATH || 'bash';
  const home = path.resolve(adapters.home || os.homedir());
  const ownsCwd = !adapters.cwd;
  const cwd = adapters.cwd
    ? path.resolve(adapters.cwd)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-hook-smoke-'));

  try {
    const results = await mapWithConcurrency(checked, SMOKE_CONCURRENCY, (descriptor) => (
      spawnSmokeHook(descriptor, {
        bashPath,
        cwd,
        env: adapters.env,
        home,
        nodePath,
        spawnProcess,
      })
    ));
    const failureDetails = results.map((result) => {
      if (result.passed) return null;
      const raw = result.launchError && result.launchError.message
        ? result.launchError.message
        : result.output;
      const detail = moduleFailureDetail(raw, {
        candidateRoot: adapters.candidateRoot,
        targetRoot: adapters.targetRoot,
      });
      if (detail.code === 'MODULE_NOT_FOUND') return detail;
      if (!result.launchError && !result.signal && result.status !== null
        && !result.outputTruncated
        && isCleanPolicyDecision(raw)) {
        return null;
      }
      return detail;
    });
    const failedIndex = failureDetails.findIndex(Boolean);
    if (failedIndex >= 0) {
      throw new HookSmokeError(
        checked[failedIndex],
        failureDetails[failedIndex],
      );
    }
  } finally {
    if (ownsCwd) {
      try {
        fs.rmSync(cwd, { recursive: true, force: true });
      } catch (_error) {
        // Preserve the hook result as the primary installer outcome.
      }
    }
  }
  return checked;
}

async function smokeCli(argv) {
  const mode = argv[0];
  if (mode === PREFLIGHT_PROJECT_SETTINGS_MODE && (argv.length === 3 || argv.length === 4)) {
    const projectSettings = fs.existsSync(argv[1])
      ? JSON.parse(fs.readFileSync(argv[1], 'utf8'))
      : {};
    const globalSettings = fs.existsSync(argv[2])
      ? JSON.parse(fs.readFileSync(argv[2], 'utf8'))
      : {};
    const candidateDeliveryPaths = argv.length === 4
      ? readPreparedCandidateDeliveryPaths(argv[3])
      : new Set();
    const result = preflightProjectManagedRegistrations(
      projectSettings,
      globalSettings,
      { candidateDeliveryPaths },
    );
    for (const warning of result.warnings) {
      const location = warning.event + '/' + warning.hookId;
      process.stderr.write(
        'WARN ' + warning.code + ' ' + warning.scriptPath
        + ' [' + location + '] (global=' + warning.globalScriptPath + ')\n',
      );
    }
    process.stdout.write(JSON.stringify(result.warnedDescriptors));
    return 0;
  }

  let descriptors;
  if (mode === SMOKE_MANIFEST_MODE && argv.length === 3) {
    descriptors = parseHookSmokeManifest(fs.readFileSync(0, 'utf8'), argv[1]);
    preflightHookDeploymentSources(descriptors, argv[2]);
  } else if (mode === SMOKE_REPO_OVERLAY_MODE && (argv.length === 3 || argv.length === 4)) {
    const overlay = JSON.parse(fs.readFileSync(argv[1], 'utf8'));
    descriptors = enumerateHookRegistrations(realizeRepoLocalHookOverlay(overlay, argv[2]));
    if (argv.length === 4) {
      descriptors = filterWarnedHookDescriptors(descriptors, JSON.parse(argv[3]));
    }
  } else {
    process.stderr.write(
      'Usage: hook-registration-preflight.cjs --smoke-manifest <installed-hooks-root> <source-hooks-root>\n'
      + '       hook-registration-preflight.cjs --smoke-repo-overlay <overlay.json> <repo-root> [warned-descriptors-json]\n'
      + '       hook-registration-preflight.cjs --preflight-project-settings <project-settings.json> <global-settings.json> [prepared-candidate.json]\n',
    );
    return 64;
  }
  await smokeHookRegistrations(descriptors);
  return 0;
}

if (require.main === module) {
  smokeCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  }, (error) => {
    if (error instanceof HookSmokeError) {
      process.stderr.write(JSON.stringify({
        ok: false,
        reason: 'hook_smoke_failed',
        detail: error.message,
        underlying_error: error.underlyingError,
      }) + '\n');
    } else {
      process.stderr.write('ERROR: ' + error.message + '\n');
    }
    process.exitCode = 4;
  });
}

module.exports = {
  CHECK_TIMEOUT_MS,
  SMOKE_CONCURRENCY,
  SMOKE_OUTPUT_MAX_BYTES,
  SMOKE_TIMEOUT_FLOOR_MS,
  SMOKE_TIMEOUT_MS,
  HookRegistrationPreflightError,
  HookSmokeError,
  enumerateGlobalManifestCoverage,
  enumerateHookRegistrations,
  enumerateProjectManagedHookRegistrations,
  filterWarnedHookDescriptors,
  isCleanPolicyDecision,
  parseHookSmokeManifest,
  preflightHookDeploymentSources,
  preflightHookDescriptors,
  preflightHookRegistrations,
  preflightProjectManagedRegistrations,
  readPreparedCandidateDeliveryPaths,
  realizeRepoLocalHookOverlay,
  smokeHookRegistrations,
};
