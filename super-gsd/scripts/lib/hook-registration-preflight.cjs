#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const CHECK_TIMEOUT_MS = 5_000;
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

function preflightHookRegistrations(overlay, adapters = {}) {
  const descriptors = enumerateHookRegistrations(overlay);
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

module.exports = {
  CHECK_TIMEOUT_MS,
  HookRegistrationPreflightError,
  enumerateHookRegistrations,
  preflightHookRegistrations,
};
