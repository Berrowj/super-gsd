#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_TEMPLATE = path.resolve(__dirname, '..', '..', 'config', 'codex-hooks.json');
const TARGET_RELATIVE = path.join('.codex', 'hooks.json');

class HookInstallError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'HookInstallError';
    Object.assign(this, details);
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function defaultTemplatePath() {
  return DEFAULT_TEMPLATE;
}

function targetPathFor(projectDir) {
  return path.resolve(projectDir || process.cwd(), TARGET_RELATIVE);
}

function readParsedJson(filePath, label) {
  let bytes;
  try {
    bytes = fs.readFileSync(filePath);
  } catch (error) {
    throw new HookInstallError(`${label} is unreadable at ${filePath}: ${error.message}`, {
      cause: error,
      errorPath: filePath,
    });
  }
  try {
    return { bytes, value: JSON.parse(bytes.toString('utf8')) };
  } catch (error) {
    throw new HookInstallError(`${label} JSON is malformed at ${filePath}: ${error.message}`, {
      cause: error,
      errorPath: filePath,
      originalBytes: bytes,
    });
  }
}

function validateHookDocument(value, filePath, canonical) {
  if (!isObject(value)) {
    throw new HookInstallError(`hook JSON root must be an object at ${filePath}`, { errorPath: filePath });
  }
  if (!Object.prototype.hasOwnProperty.call(value, 'hooks')) {
    if (canonical) {
      throw new HookInstallError(`canonical hook JSON is missing hooks at ${filePath}`, { errorPath: filePath });
    }
    return;
  }
  if (!isObject(value.hooks)) {
    throw new HookInstallError(`hooks must be an object at ${filePath}`, { errorPath: filePath });
  }
  for (const [event, groups] of Object.entries(value.hooks)) {
    if (!Array.isArray(groups)) {
      throw new HookInstallError(`hook event ${event} must be an array at ${filePath}`, { errorPath: filePath });
    }
    for (const group of groups) {
      if (!isObject(group)) {
        throw new HookInstallError(`hook matcher group for ${event} must be an object at ${filePath}`, { errorPath: filePath });
      }
      if (Object.prototype.hasOwnProperty.call(group, 'hooks') && !Array.isArray(group.hooks)) {
        throw new HookInstallError(`hooks for event ${event} must be an array at ${filePath}`, { errorPath: filePath });
      }
      if (!canonical) continue;
      if (typeof group.matcher !== 'string' || !Array.isArray(group.hooks)) {
        throw new HookInstallError(`canonical matcher group for ${event} is incomplete at ${filePath}`, { errorPath: filePath });
      }
      for (const hook of group.hooks) {
        if (!isObject(hook) || typeof hook.type !== 'string' || typeof hook.command !== 'string'
          || !hook.type.trim() || !hook.command.trim()) {
          throw new HookInstallError(`canonical hook for ${event} is incomplete at ${filePath}`, { errorPath: filePath });
        }
      }
    }
  }
}

function managedPathFromCommand(command, managedPaths) {
  if (typeof command !== 'string') return null;
  const normalized = command.replace(/\\/g, '/');
  for (const managedPath of managedPaths) {
    const index = normalized.indexOf(managedPath);
    if (index === -1) continue;
    const before = index === 0 ? '' : normalized[index - 1];
    const after = normalized[index + managedPath.length] || '';
    if ((!before || /[\s'=.\/]/.test(before)) && (!after || /[\s']/.test(after))) {
      return managedPath;
    }
  }
  return null;
}

function flattenTemplate(template, templatePath) {
  validateHookDocument(template, templatePath, true);
  const registrations = [];
  for (const [event, groups] of Object.entries(template.hooks)) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        const normalized = hook.command.replace(/\\/g, '/');
        const match = normalized.match(/super-gsd\/tools\/codex-hooks\/[A-Za-z0-9._-]+\.cjs/);
        if (!match) {
          throw new HookInstallError(`canonical command is not an SGSD hook path at ${templatePath}`, {
            errorPath: templatePath,
          });
        }
        registrations.push({
          event,
          matcher: group.matcher,
          type: hook.type,
          command: hook.command,
          managedPath: match[0],
          hook: clone(hook),
        });
      }
    }
  }
  if (registrations.length === 0) {
    throw new HookInstallError(`canonical template has no managed registrations at ${templatePath}`, {
      errorPath: templatePath,
    });
  }
  const keys = new Set();
  for (const registration of registrations) {
    const key = [registration.event, registration.matcher, registration.type, registration.managedPath].join('\n');
    if (keys.has(key)) {
      throw new HookInstallError(`canonical template duplicates ${registration.managedPath} at ${templatePath}`, {
        errorPath: templatePath,
      });
    }
    keys.add(key);
  }
  return registrations;
}

function loadTemplate(templatePath = defaultTemplatePath()) {
  const resolved = path.resolve(templatePath);
  const parsed = readParsedJson(resolved, 'canonical hook template');
  const registrations = flattenTemplate(parsed.value, resolved);
  return { path: resolved, value: parsed.value, registrations };
}

function matchingGroups(document, registration) {
  const groups = document.hooks[registration.event] || [];
  return groups.filter((group) => isObject(group)
    && group.matcher === registration.matcher
    && Array.isArray(group.hooks));
}

function mergeManagedRegistrations(target, templateInfo) {
  const merged = clone(target);
  if (!isObject(merged.hooks)) merged.hooks = {};
  const managedPaths = templateInfo.registrations.map((registration) => registration.managedPath);

  for (const registration of templateInfo.registrations) {
    if (!Array.isArray(merged.hooks[registration.event])) {
      merged.hooks[registration.event] = [];
    }
    let groups = matchingGroups(merged, registration);
    let first = null;
    for (const group of groups) {
      group.hooks = group.hooks.filter((hook) => {
        if (!isObject(hook)
          || managedPathFromCommand(hook.command, managedPaths) !== registration.managedPath) {
          return true;
        }
        if (first) return false;
        first = hook;
        return true;
      });
    }
    if (first) {
      Object.assign(first, registration.hook);
      continue;
    }
    if (groups.length === 0) {
      const group = { matcher: registration.matcher, hooks: [] };
      merged.hooks[registration.event].push(group);
      groups = [group];
    }
    groups[0].hooks.push(clone(registration.hook));
  }
  return merged;
}

function inspectDocument(target, templateInfo, targetPath) {
  validateHookDocument(target, targetPath, false);
  const managedPaths = templateInfo.registrations.map((registration) => registration.managedPath);
  const missing = [];
  const stale = [];
  const duplicates = [];

  for (const registration of templateInfo.registrations) {
    const candidates = [];
    for (const group of matchingGroups(target, registration)) {
      for (const hook of group.hooks) {
        if (isObject(hook)
          && managedPathFromCommand(hook.command, managedPaths) === registration.managedPath) {
          candidates.push(hook);
        }
      }
    }
    const exact = candidates.filter((hook) => hook.type === registration.type
      && hook.command === registration.command);
    const detail = {
      event: registration.event,
      matcher: registration.matcher,
      type: registration.type,
      command: registration.command,
      managed_path: registration.managedPath,
    };
    if (exact.length === 0) {
      if (candidates.length === 0) missing.push(detail);
      else stale.push({ ...detail, observed: candidates.map((hook) => clone(hook)) });
    }
    if (candidates.length > 1) {
      duplicates.push({ ...detail, count: candidates.length });
    }
  }

  return {
    ok: missing.length === 0 && stale.length === 0 && duplicates.length === 0,
    status: missing.length || stale.length || duplicates.length ? 'stale' : 'current',
    target: targetPath,
    target_exists: true,
    managed_registrations: templateInfo.registrations.length,
    missing,
    stale,
    duplicates,
  };
}

function inspectProject(options = {}) {
  const projectDir = path.resolve(options.projectDir || process.cwd());
  const targetPath = targetPathFor(projectDir);
  let templateInfo;
  try {
    templateInfo = loadTemplate(options.templatePath);
  } catch (error) {
    return {
      ok: false,
      status: 'template-error',
      target: targetPath,
      target_exists: fs.existsSync(targetPath),
      managed_registrations: 0,
      missing: [],
      stale: [],
      duplicates: [],
      error: error.message,
      error_path: error.errorPath || options.templatePath || defaultTemplatePath(),
    };
  }
  if (!fs.existsSync(targetPath)) {
    return {
      ok: false,
      status: 'missing',
      target: targetPath,
      target_exists: false,
      managed_registrations: templateInfo.registrations.length,
      missing: templateInfo.registrations.map((registration) => ({
        event: registration.event,
        matcher: registration.matcher,
        type: registration.type,
        command: registration.command,
        managed_path: registration.managedPath,
      })),
      stale: [],
      duplicates: [],
    };
  }
  try {
    const parsed = readParsedJson(targetPath, 'project hook configuration');
    return inspectDocument(parsed.value, templateInfo, targetPath);
  } catch (error) {
    return {
      ok: false,
      status: 'malformed',
      target: targetPath,
      target_exists: true,
      managed_registrations: templateInfo.registrations.length,
      missing: [],
      stale: [],
      duplicates: [],
      error: error.message,
      error_path: error.errorPath || targetPath,
    };
  }
}

function backupBytes(targetPath, bytes) {
  const backupPath = `${targetPath}.sgsd-error-${Date.now()}-${process.pid}.bak`;
  fs.writeFileSync(backupPath, bytes, { flag: 'wx' });
  return backupPath;
}

function attachBackup(error, targetPath, bytes) {
  let backupPath = null;
  try {
    backupPath = backupBytes(targetPath, bytes);
  } catch (backupError) {
    error.backupError = backupError.message;
  }
  error.backupPath = backupPath;
  error.errorPath = error.errorPath || targetPath;
  return error;
}

function atomicWrite(targetPath, text, renameFile) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tempPath = path.join(
    path.dirname(targetPath),
    `.${path.basename(targetPath)}.tmp-${process.pid}-${Date.now()}`,
  );
  let descriptor = null;
  try {
    descriptor = fs.openSync(tempPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, text, 'utf8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    (renameFile || fs.renameSync)(tempPath, targetPath);
  } catch (error) {
    if (descriptor !== null) {
      try { fs.closeSync(descriptor); } catch (_closeError) {}
    }
    try { fs.unlinkSync(tempPath); } catch (_unlinkError) {}
    throw error;
  }
}

function installHooks(options = {}) {
  const projectDir = path.resolve(options.projectDir || process.cwd());
  const targetPath = targetPathFor(projectDir);
  const templateInfo = loadTemplate(options.templatePath);
  let originalBytes = null;
  let target = {};

  if (fs.existsSync(targetPath)) {
    let parsed;
    try {
      parsed = readParsedJson(targetPath, 'project hook configuration');
      validateHookDocument(parsed.value, targetPath, false);
    } catch (error) {
      if (error.originalBytes) throw attachBackup(error, targetPath, error.originalBytes);
      throw error;
    }
    originalBytes = parsed.bytes;
    target = parsed.value;
  }

  const merged = mergeManagedRegistrations(target, templateInfo);
  const unchanged = originalBytes !== null
    && JSON.stringify(target) === JSON.stringify(merged);
  if (unchanged) {
    return {
      ok: true,
      changed: false,
      status: 'unchanged',
      target: targetPath,
      managed_registrations: templateInfo.registrations.length,
    };
  }

  const serialized = `${JSON.stringify(merged, null, 2)}\n`;
  try {
    atomicWrite(targetPath, serialized, options.renameFile);
  } catch (cause) {
    const error = new HookInstallError(`atomic hook replacement failed at ${targetPath}: ${cause.message}`, {
      cause,
      errorPath: targetPath,
    });
    if (originalBytes !== null) throw attachBackup(error, targetPath, originalBytes);
    throw error;
  }

  const verified = inspectProject({ projectDir, templatePath: templateInfo.path });
  if (!verified.ok) {
    const error = new HookInstallError(`managed hook verification failed at ${targetPath}`, {
      errorPath: targetPath,
      verification: verified,
    });
    if (originalBytes !== null) error.backupPath = backupBytes(targetPath, originalBytes);
    throw error;
  }
  return {
    ok: true,
    changed: true,
    status: originalBytes === null ? 'installed' : 'updated',
    target: targetPath,
    managed_registrations: templateInfo.registrations.length,
  };
}

function argValue(args, name) {
  const index = args.indexOf(name);
  if (index !== -1 && index + 1 < args.length) return args[index + 1];
  const prefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function usage() {
  return [
    'Usage:',
    '  node install-hooks.cjs --project <dir> [--template <file>] [--json]',
    '  node install-hooks.cjs --project <dir> [--template <file>] --check [--json]',
    '',
    'Safely merges the canonical SGSD registrations into project .codex/hooks.json.',
  ].join('\n');
}

function printHuman(result) {
  process.stdout.write(`[codex-hooks] ${result.status}: ${result.target}\n`);
  process.stdout.write(`managed_registrations=${result.managed_registrations}\n`);
  if (Array.isArray(result.missing) && result.missing.length) {
    process.stdout.write(`missing=${result.missing.length}\n`);
  }
  if (Array.isArray(result.stale) && result.stale.length) {
    process.stdout.write(`stale=${result.stale.length}\n`);
  }
  if (Array.isArray(result.duplicates) && result.duplicates.length) {
    process.stdout.write(`duplicates=${result.duplicates.length}\n`);
  }
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(`${usage()}\n`);
    return 0;
  }
  const known = new Set(['--project', '--template', '--json', '--check']);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const key = arg.includes('=') ? arg.slice(0, arg.indexOf('=')) : arg;
    if (!known.has(key)) {
      process.stderr.write(`[codex-hooks] unknown argument: ${arg}\n${usage()}\n`);
      return 64;
    }
    if ((arg === '--project' || arg === '--template')) index += 1;
  }

  const options = {
    projectDir: argValue(args, '--project') || process.cwd(),
    templatePath: argValue(args, '--template') || undefined,
  };
  const asJson = args.includes('--json');
  try {
    const result = args.includes('--check') ? inspectProject(options) : installHooks(options);
    if (asJson) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    else printHuman(result);
    return result.ok ? 0 : 2;
  } catch (error) {
    process.stderr.write(`[codex-hooks] ${error.message}\n`);
    process.stderr.write(`error_path=${error.errorPath || options.templatePath || targetPathFor(options.projectDir)}\n`);
    if (error.backupPath) process.stderr.write(`backup_path=${error.backupPath}\n`);
    if (error.backupError) process.stderr.write(`backup_error=${error.backupError}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv);

module.exports = {
  HookInstallError,
  installHooks,
  inspectProject,
  mergeManagedRegistrations,
  defaultTemplatePath,
  targetPathFor,
  _internals: {
    flattenTemplate,
    managedPathFromCommand,
    validateHookDocument,
    atomicWrite,
  },
};
