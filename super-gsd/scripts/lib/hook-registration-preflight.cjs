#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CHECK_TIMEOUT_MS = 5_000;
const SMOKE_TIMEOUT_FLOOR_MS = 15_000;
const SMOKE_TIMEOUT_MS = SMOKE_TIMEOUT_FLOOR_MS;
const SMOKE_MANIFEST_MODE = '--smoke-manifest';
const SMOKE_REPO_OVERLAY_MODE = '--smoke-repo-overlay';
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
  constructor(descriptor) {
    const location = descriptor.event + '/' + descriptor.hookId;
    super('hook_smoke_failed ' + descriptor.scriptPath + ' [' + location + ']');
    this.name = 'HookSmokeError';
    this.descriptor = descriptor;
  }
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

function parseCombinedCommand(command, event, hookId) {
  const raw = typeof command === 'string' ? command.trim() : '';
  const match = raw.match(/^(node|bash)\s+(?:"([^"]+)"|'([^']+)'|(\S+))$/i);
  if (!match) launchInvalid(event, hookId, null, 'expected node|bash followed by exactly one script path');
  return {
    interpreter: match[1].toLowerCase(),
    scriptPath: match[2] || match[3] || match[4],
  };
}

function descriptorFor(hook, event, hookId) {
  if (!hook || typeof hook !== 'object' || Array.isArray(hook)) {
    launchInvalid(event, hookId, null, 'command hook must be an object');
  }
  const command = typeof hook.command === 'string' ? hook.command.trim() : '';
  if (!command) launchInvalid(event, hookId, null, 'command hook has no command');

  let interpreter;
  let scriptPath;
  const normalizedCommand = command.toLowerCase();
  if (SUPPORTED_INTERPRETERS.has(normalizedCommand)) {
    if (!Array.isArray(hook.args) || hook.args.length < 1 || typeof hook.args[0] !== 'string') {
      launchInvalid(event, hookId, null, 'split launch requires a script path in args[0]');
    }
    interpreter = normalizedCommand;
    scriptPath = hook.args[0].trim();
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
  };
}

function enumerateHookRegistrations(overlay) {
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    launchInvalid('overlay', 'root', null, 'overlay must be an object');
  }
  const descriptors = [];
  if (overlay.statusLine && overlay.statusLine.type === 'command') {
    descriptors.push(descriptorFor(overlay.statusLine, 'statusLine', 'status-line'));
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
        launchInvalid(event, `${event}[${entryIndex}]`, null, 'hook entry must contain a hooks array');
      }
      entry.hooks.forEach((hook, hookIndex) => {
        if (!hook || typeof hook !== 'object' || Array.isArray(hook)) {
          launchInvalid(event, `${event}[${entryIndex}].hooks[${hookIndex}]`, null, 'hook must be an object');
        }
        if (hook.type !== 'command') return;
        const hookId = typeof entry.sgsd_hook_id === 'string' && entry.sgsd_hook_id.trim()
          ? entry.sgsd_hook_id.trim()
          : `${event}[${entryIndex}].hooks[${hookIndex}]`;
        descriptors.push(descriptorFor(hook, event, hookId));
      });
    });
  }
  return descriptors;
}

function pathIsInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative && !relative.startsWith('..') && !path.isAbsolute(relative));
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

function descriptorSmokeTimeout(descriptor) {
  const registeredBudget = Number.isFinite(descriptor.timeout) && descriptor.timeout > 0
    ? descriptor.timeout * 1000
    : SMOKE_TIMEOUT_MS;
  return Math.max(SMOKE_TIMEOUT_FLOOR_MS, registeredBudget);
}

function smokePayload(event, cwd) {
  return {
    hook_event_name: event,
    cwd,
    session_id: 'sgsd-installer-hook-smoke',
    prompt: 'SGSD installer dependency smoke',
    tool_name: 'Read',
    tool_input: { file_path: 'sgsd-hook-smoke.txt' },
    tool_response: { ok: true },
  };
}

function smokeHookRegistrations(descriptors, adapters = {}) {
  const checked = preflightHookDescriptors(descriptors, adapters);
  const spawn = adapters.spawnSync || spawnSync;
  const nodePath = adapters.nodePath || process.execPath;
  const bashPath = adapters.bashPath || process.env.SGSD_BASH_PATH || 'bash';
  const home = path.resolve(adapters.home || os.homedir());
  const ownsCwd = !adapters.cwd;
  const cwd = adapters.cwd
    ? path.resolve(adapters.cwd)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-hook-smoke-'));

  try {
    for (const descriptor of checked) {
      const input = JSON.stringify(smokePayload(descriptor.event, cwd)) + '\n';
      let result;
      try {
        result = spawn(
          descriptor.interpreter === 'node' ? nodePath : bashPath,
          [descriptor.scriptPath],
          {
            cwd,
            env: { ...process.env, HOME: home, USERPROFILE: home },
            input,
            shell: false,
            stdio: ['pipe', 'ignore', 'ignore'],
            timeout: descriptorSmokeTimeout(descriptor),
            windowsHide: true,
          },
        );
      } catch (_error) {
        result = null;
      }
      if (!checkPassed(result)) throw new HookSmokeError(descriptor);
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

function smokeCli(argv) {
  const mode = argv[0];
  let descriptors;
  if (mode === SMOKE_MANIFEST_MODE && argv.length === 3) {
    descriptors = parseHookSmokeManifest(fs.readFileSync(0, 'utf8'), argv[1]);
    preflightHookDeploymentSources(descriptors, argv[2]);
  } else if (mode === SMOKE_REPO_OVERLAY_MODE && argv.length === 3) {
    const overlay = JSON.parse(fs.readFileSync(argv[1], 'utf8'));
    descriptors = enumerateHookRegistrations(realizeRepoLocalHookOverlay(overlay, argv[2]));
  } else {
    process.stderr.write(
      'Usage: hook-registration-preflight.cjs --smoke-manifest <installed-hooks-root> <source-hooks-root>\n'
      + '       hook-registration-preflight.cjs --smoke-repo-overlay <overlay.json> <repo-root>\n',
    );
    return 64;
  }
  smokeHookRegistrations(descriptors);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = smokeCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write('ERROR: ' + error.message + '\n');
    process.exitCode = 4;
  }
}

module.exports = {
  CHECK_TIMEOUT_MS,
  SMOKE_TIMEOUT_FLOOR_MS,
  SMOKE_TIMEOUT_MS,
  HookRegistrationPreflightError,
  HookSmokeError,
  enumerateHookRegistrations,
  parseHookSmokeManifest,
  preflightHookDeploymentSources,
  preflightHookDescriptors,
  preflightHookRegistrations,
  realizeRepoLocalHookOverlay,
  smokeHookRegistrations,
};
