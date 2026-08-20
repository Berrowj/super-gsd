#!/usr/bin/env node
'use strict';

const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const { fileURLToPath } = require('url');

const {
  loadRegistry,
  VtpRegistryError,
} = require('./registry.cjs');

const VALID_TRIGGERS = new Set(['auto', 'manual', 'semi']);
const CONNECT_TIMEOUT_MS = 1500;

function result(probeId, status, reasonCode, envName) {
  const row = {
    probe_id: probeId,
    status,
  };
  if (envName) row.env_name = envName;
  row.reason_code = reasonCode;
  return row;
}

function emit(trigger, status, results) {
  process.stdout.write(JSON.stringify({ trigger, status, results }) + '\n');
}

function parseArguments(argv) {
  const values = {};
  const allowed = new Set(['--trigger', '--project-dir', '--registry']);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!allowed.has(flag) || Object.prototype.hasOwnProperty.call(values, flag)) {
      return { ok: false };
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) return { ok: false };
    values[flag] = value;
    index += 1;
  }
  const trigger = values['--trigger'];
  const projectDir = values['--project-dir'];
  if (!VALID_TRIGGERS.has(trigger)
      || typeof projectDir !== 'string' || !projectDir.trim()) {
    return { ok: false, trigger: VALID_TRIGGERS.has(trigger) ? trigger : 'invalid' };
  }
  return {
    ok: true,
    trigger,
    projectDir: path.resolve(projectDir),
    registryPath: values['--registry'],
  };
}

function comparisonPath(candidate) {
  const resolved = path.resolve(candidate);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isInsideOrEqual(root, candidate) {
  const relative = path.relative(comparisonPath(root), comparisonPath(candidate));
  return relative === ''
    || (Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveFreshnessPaths(paths) {
  const realRoot = fs.realpathSync(paths.vtp_root);
  const realSource = fs.realpathSync(paths.source_dir);
  const realCli = fs.realpathSync(paths.cli_entry);
  const root = fs.lstatSync(paths.vtp_root);
  if (!root.isDirectory() || root.isSymbolicLink()
      || !isInsideOrEqual(realRoot, realSource)
      || !isInsideOrEqual(realRoot, realCli)) {
    return null;
  }
  return { sourceDir: realSource, cliEntry: realCli };
}

function newestRegularSourceFile(sourceDir, walkRoot) {
  const root = fs.lstatSync(sourceDir);
  if (!root.isDirectory() || root.isSymbolicLink()) return null;
  const pending = [walkRoot];
  let newest = null;
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const candidate = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        pending.push(candidate);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = fs.lstatSync(candidate);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      if (!newest || stat.mtimeMs > newest.mtimeMs) newest = stat;
    }
  }
  return newest;
}

function probeFreshness(paths) {
  try {
    const resolved = resolveFreshnessPaths(paths);
    if (!resolved) {
      return result('dist_freshness', 'warn', 'freshness_path_outside_vtp_root');
    }
    const newestSource = newestRegularSourceFile(paths.source_dir, resolved.sourceDir);
    if (!newestSource) {
      return result('dist_freshness', 'warn', 'source_files_missing');
    }
    const cli = fs.lstatSync(paths.cli_entry);
    if (!cli.isFile() || cli.isSymbolicLink()) {
      return result('dist_freshness', 'warn', 'dist_entry_missing');
    }
    const realCli = fs.lstatSync(resolved.cliEntry);
    if (realCli.mtimeMs < newestSource.mtimeMs) {
      return result('dist_freshness', 'warn', 'dist_stale_reconnect_mcp');
    }
    return result('dist_freshness', 'pass', 'dist_fresh');
  } catch (_error) {
    return result('dist_freshness', 'warn', 'freshness_unavailable');
  }
}

function tcpTarget(rawValue) {
  try {
    const parsed = new URL(rawValue);
    if (!['http:', 'https:', 'tcp:'].includes(parsed.protocol)
        || !parsed.hostname) return null;
    let port = parsed.port ? Number(parsed.port) : null;
    if (port === null && parsed.protocol === 'http:') port = 80;
    if (port === null && parsed.protocol === 'https:') port = 443;
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
    return { host: parsed.hostname, port };
  } catch (_error) {
    return null;
  }
}

function boundedTcpConnect(target) {
  return new Promise((resolve) => {
    let settled = false;
    let socket;
    const finish = (connected) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (socket) socket.destroy();
      resolve(connected);
    };
    const timer = setTimeout(() => finish(false), CONNECT_TIMEOUT_MS);
    try {
      socket = net.createConnection({ host: target.host, port: target.port });
      socket.once('connect', () => finish(true));
      socket.once('error', () => finish(false));
    } catch (_error) {
      finish(false);
    }
  });
}

async function probeQdrant(environment) {
  const envName = 'QDRANT_URL';
  if (!Object.prototype.hasOwnProperty.call(environment, envName)
      || !String(environment[envName]).trim()) {
    return result('qdrant_tcp', 'warn', 'environment_missing', envName);
  }
  const target = tcpTarget(String(environment[envName]));
  if (!target) {
    return result('qdrant_tcp', 'warn', 'connection_config_invalid', envName);
  }
  const connected = await boundedTcpConnect(target);
  return connected
    ? result('qdrant_tcp', 'pass', 'tcp_connect_ok', envName)
    : result('qdrant_tcp', 'warn', 'tcp_connect_failed', envName);
}

function evidenceTarget(rawValue, projectDir) {
  try {
    if (/^file:/i.test(rawValue)) return fileURLToPath(new URL(rawValue));
    if (/^sqlite:/i.test(rawValue)) {
      const asFile = rawValue.replace(/^sqlite:/i, 'file:');
      return fileURLToPath(new URL(asFile));
    }
    return path.isAbsolute(rawValue)
      ? path.resolve(rawValue)
      : path.resolve(projectDir, rawValue);
  } catch (_error) {
    return null;
  }
}

function probeEvidenceStore(environment, projectDir) {
  const envName = 'VTP_EVIDENCE_STORE_URL';
  if (!Object.prototype.hasOwnProperty.call(environment, envName)
      || !String(environment[envName]).trim()) {
    return result('evidence_store', 'warn', 'environment_missing', envName);
  }
  const target = evidenceTarget(String(environment[envName]), projectDir);
  if (!target) {
    return result('evidence_store', 'warn', 'evidence_config_invalid', envName);
  }
  try {
    const stat = fs.statSync(target);
    if (stat.isFile() || stat.isDirectory()) {
      return result('evidence_store', 'pass', 'evidence_present', envName);
    }
    return result('evidence_store', 'warn', 'evidence_missing', envName);
  } catch (_error) {
    return result('evidence_store', 'warn', 'evidence_missing', envName);
  }
}

function registryFailureCode(error) {
  if (error instanceof VtpRegistryError
      && typeof error.code === 'string'
      && /^registry_[a-z_]+$/.test(error.code)) {
    return error.code;
  }
  return 'registry_load_failed';
}

async function main() {
  const parsed = parseArguments(process.argv.slice(2));
  if (!parsed.ok) {
    emit(parsed.trigger || 'invalid', 'error', [
      result('runner_input', 'error', 'input_invalid'),
    ]);
    process.exit(2);
  }

  let registry;
  try {
    const options = { homeDir: os.homedir() };
    if (parsed.registryPath !== undefined) options.registryPath = parsed.registryPath;
    registry = loadRegistry(options);
  } catch (error) {
    emit(parsed.trigger, 'error', [
      result('registry_load', 'error', registryFailureCode(error)),
    ]);
    process.exit(2);
  }

  try {
    const results = [
      probeFreshness(registry.paths),
      await probeQdrant(process.env),
      probeEvidenceStore(process.env, parsed.projectDir),
    ];
    const findings = results.some((row) => row.status !== 'pass');
    emit(parsed.trigger, findings ? 'degraded' : 'ready', results);
    process.exit(findings ? 1 : 0);
  } catch (_error) {
    emit(parsed.trigger, 'error', [
      result('runner_internal', 'error', 'internal_failure'),
    ]);
    process.exit(2);
  }
}

main();
