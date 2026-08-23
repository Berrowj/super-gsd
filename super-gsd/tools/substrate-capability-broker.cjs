'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const SHORT_TOOL = ['vtp', 'search', 'substrate'].join('_');
const TARGET_TOOL = 'mcp__vtp-kb__' + SHORT_TOOL;
const STORE_RELATIVE_PATH = path.join('super-gsd', 'scripts', 'lib', 'substrate-invocation-witness-store.cjs');

class UpstreamFailure extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'UpstreamFailure';
  }
}

function loadUpstreamManifest(manifestPath, projectDigest, schemaVersion) {
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    throw new Error(error && error.code === 'ENOENT' ? 'upstream_manifest_missing' : 'upstream_manifest_invalid');
  }
  if (process.platform !== 'win32' && (fs.statSync(manifestPath).mode & 0o077) !== 0) {
    throw new Error('upstream_manifest_permissions_invalid');
  }
  if (!manifest
    || manifest.schema_version !== schemaVersion
    || manifest.project_digest !== projectDigest
    || typeof manifest.active_scope !== 'string'
    || !manifest.servers
    || typeof manifest.servers !== 'object'
    || Array.isArray(manifest.servers)) {
    throw new Error('upstream_manifest_invalid');
  }
  const entry = manifest.servers[manifest.active_scope];
  const server = entry && entry.definition;
  if (!entry
    || entry.transport !== 'stdio'
    || !server
    || typeof server !== 'object'
    || Array.isArray(server)
    || typeof server.command !== 'string'
    || !server.command
    || !Array.isArray(server.args)
    || server.args.some((item) => typeof item !== 'string')
    || (server.env !== undefined
      && (!server.env || typeof server.env !== 'object' || Array.isArray(server.env)))) {
    throw new Error('upstream_manifest_invalid');
  }
  if (server.env && Object.values(server.env).some((item) => typeof item !== 'string')) {
    throw new Error('upstream_manifest_invalid');
  }
  return server;
}

function spawnManifestServer(server, projectRoot, env) {
  return childProcess.spawn(server.command, server.args, {
    cwd: typeof server.cwd === 'string' && server.cwd ? server.cwd : projectRoot,
    env: { ...env, ...(server.env || {}) },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
}

function createUpstreamClient(child, onNotification) {
  const pending = new Map();
  const serverRequests = new Map();
  let nextId = 1;
  let nextServerId = 1;
  let buffer = '';
  let stoppedReason = null;

  function rejectPending(reason) {
    if (!stoppedReason) stoppedReason = reason;
    for (const item of pending.values()) item.reject(new UpstreamFailure(stoppedReason));
    pending.clear();
  }

  function receiveLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (_) {
      rejectPending('malformed_json');
      return;
    }
    if (message
      && typeof message.method !== 'string'
      && Object.prototype.hasOwnProperty.call(message, 'id')
      && pending.has(message.id)) {
      const item = pending.get(message.id);
      pending.delete(message.id);
      const returned = { ...message, id: item.clientId };
      item.resolve(returned);
      return;
    }
    if (message && typeof message.method === 'string') {
      if (Object.prototype.hasOwnProperty.call(message, 'id')) {
        const clientId = 'sgsd-upstream-request-' + nextServerId;
        nextServerId += 1;
        serverRequests.set(clientId, message.id);
        onNotification({ ...message, id: clientId });
        return;
      }
      onNotification(message);
    }
  }

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline === -1) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) receiveLine(line);
    }
  });
  child.stdout.on('error', () => rejectPending('stdout_error'));
  child.stdin.on('error', () => rejectPending('stdin_error'));
  child.on('error', () => rejectPending('process_error'));
  child.on('exit', () => rejectPending('upstream_exit'));
  if (child.stderr && typeof child.stderr.resume === 'function') child.stderr.resume();

  function request(message) {
    if (stoppedReason) return Promise.reject(new UpstreamFailure(stoppedReason));
    if (!Object.prototype.hasOwnProperty.call(message, 'id')) {
      child.stdin.write(JSON.stringify(message) + '\n');
      return Promise.resolve(null);
    }
    const upstreamId = 'sgsd-broker-' + nextId;
    nextId += 1;
    const forwarded = { ...message, id: upstreamId };
    return new Promise((resolve, reject) => {
      pending.set(upstreamId, { resolve, reject, clientId: message.id });
      try {
        child.stdin.write(JSON.stringify(forwarded) + '\n', (error) => {
          if (!error || !pending.has(upstreamId)) return;
          pending.delete(upstreamId);
          reject(new UpstreamFailure('stdin_error'));
        });
      } catch (_) {
        pending.delete(upstreamId);
        reject(new UpstreamFailure('stdin_error'));
      }
    });
  }

  function respond(message) {
    if (!serverRequests.has(message.id)) return false;
    const upstreamId = serverRequests.get(message.id);
    serverRequests.delete(message.id);
    try {
      child.stdin.write(JSON.stringify({ ...message, id: upstreamId }) + '\n');
      return true;
    } catch (_) {
      return false;
    }
  }

  function close() {
    rejectPending('broker_closed');
    serverRequests.clear();
    try { child.kill(); } catch (_) {}
  }

  return { request, respond, close };
}

function isSubstrateName(name) {
  return name === SHORT_TOOL || name === TARGET_TOOL;
}

function boundedReason(reason) {
  const safe = typeof reason === 'string' && /^[a-z0-9_:.-]+$/i.test(reason)
    ? reason
    : 'unknown';
  return safe.slice(0, 160);
}

function unavailableResult(id, reason) {
  return {
    jsonrpc: '2.0',
    id,
    result: {
      content: [{
        type: 'text',
        text: 'substrate_witness_unavailable:' + boundedReason(reason),
      }],
      isError: true,
    },
  };
}

function upstreamError(id, reason) {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32603,
      message: 'substrate_broker_upstream_failed:' + boundedReason(reason),
    },
  };
}

function watchReadinessInputs(projectRoot, store, env, refresh) {
  const paths = store.resolveWitnessPaths(projectRoot, env);
  const directories = [
    path.join(projectRoot, '.claude'),
    path.join(projectRoot, 'super-gsd', 'hooks'),
    path.dirname(paths.key_path),
  ];
  const watchers = [];
  for (const directory of directories) {
    try {
      const watcher = fs.watch(directory, { persistent: false }, refresh);
      watchers.push(watcher);
    } catch (_) {}
  }
  return watchers;
}

function createBroker(options) {
  const projectRoot = path.resolve(options.projectRoot);
  const env = options.env || process.env;
  const store = require(path.join(projectRoot, STORE_RELATIVE_PATH));
  const paths = store.resolveWitnessPaths(projectRoot, env);
  const manifestPath = store.assertPathOutsideProject(
    projectRoot,
    options.upstreamManifestPath || paths.upstream_manifest_path,
    'upstream_manifest_inside_project',
  );
  const server = loadUpstreamManifest(
    manifestPath,
    paths.project_digest,
    store.UPSTREAM_MANIFEST_SCHEMA_VERSION,
  );
  const spawnUpstream = options.spawnUpstream || spawnManifestServer;
  const notify = typeof options.onNotification === 'function' ? options.onNotification : () => {};
  const child = spawnUpstream(server, projectRoot, env);
  const upstream = createUpstreamClient(child, notify);
  let readiness = store.inspectWitnessReadiness(projectRoot, env);
  let debounce = null;
  let closed = false;

  function refreshReadiness() {
    if (closed) return readiness;
    const next = store.inspectWitnessReadiness(projectRoot, env);
    if (next.ready !== readiness.ready) {
      notify({
        jsonrpc: '2.0',
        method: 'notifications/tools/list_changed',
        params: {},
      });
    }
    readiness = next;
    return readiness;
  }

  function scheduleRefresh() {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      refreshReadiness();
    }, 25);
    if (typeof debounce.unref === 'function') debounce.unref();
  }

  const watchers = options.watch === false
    ? []
    : watchReadinessInputs(projectRoot, store, env, scheduleRefresh);

  async function handleRequest(message) {
    const id = message && Object.prototype.hasOwnProperty.call(message, 'id') ? message.id : null;
    try {
      if (isClientResponse(message)) {
        upstream.respond(message);
        return null;
      }
      if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32600, message: 'substrate_broker_invalid_request' },
        };
      }
      if (message.method === 'tools/call'
        && message.params
        && isSubstrateName(message.params.name)) {
        const current = refreshReadiness();
        if (!current.ready) return unavailableResult(id, current.reason);
      }

      const response = await upstream.request(message);
      if (!response) return null;
      if (message.method === 'initialize'
        && response.result
        && typeof response.result === 'object'
        && !Array.isArray(response.result)) {
        const capabilities = response.result.capabilities && typeof response.result.capabilities === 'object'
          ? response.result.capabilities
          : {};
        response.result = {
          ...response.result,
          capabilities: {
            ...capabilities,
            tools: { ...(capabilities.tools || {}), listChanged: true },
          },
        };
      }
      if (message.method === 'tools/list') {
        const current = refreshReadiness();
        if (!response.result || !Array.isArray(response.result.tools)) {
          throw new UpstreamFailure('malformed_tools_list');
        }
        response.result = {
          ...response.result,
          tools: current.ready
            ? response.result.tools
            : response.result.tools.filter((tool) => !tool || !isSubstrateName(tool.name)),
        };
      }
      return response;
    } catch (error) {
      const reason = error instanceof UpstreamFailure ? error.message : 'request_failed';
      return upstreamError(id, reason);
    }
  }

  function close() {
    closed = true;
    if (debounce) clearTimeout(debounce);
    for (const watcher of watchers) {
      try { watcher.close(); } catch (_) {}
    }
    upstream.close();
  }

  return { handleRequest, refreshReadiness, close };
}

function cliValue(argv, name) {
  const index = argv.indexOf(name);
  return index === -1 ? null : argv[index + 1] || null;
}

function isClientResponse(message) {
  return Boolean(message
    && message.jsonrpc === '2.0'
    && typeof message.method !== 'string'
    && Object.prototype.hasOwnProperty.call(message, 'id')
    && (Object.prototype.hasOwnProperty.call(message, 'result')
      || Object.prototype.hasOwnProperty.call(message, 'error')));
}

function createStdioRouter(broker, writeMessage) {
  let chain = Promise.resolve();

  function routeLine(line) {
    let message;
    try {
      message = JSON.parse(line);
    } catch (_) {
      writeMessage({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'substrate_broker_parse_error' },
      });
      return;
    }
    if (isClientResponse(message)) {
      Promise.resolve(broker.handleRequest(message)).catch(() => {});
      return;
    }
    chain = chain.then(async () => {
      const response = await broker.handleRequest(message);
      if (response) writeMessage(response);
    });
  }

  function finish() {
    return chain;
  }

  return { routeLine, finish };
}

function runStdio(argv) {
  const projectRoot = cliValue(argv, '--project-root') || process.cwd();
  const manifestPath = cliValue(argv, '--upstream-manifest');
  const writeMessage = (message) => process.stdout.write(JSON.stringify(message) + '\n');
  let broker;
  try {
    broker = createBroker({
      projectRoot,
      env: process.env,
      upstreamManifestPath: manifestPath || undefined,
      onNotification: writeMessage,
    });
  } catch (_) {
    process.stderr.write('substrate_broker_start_failed\n');
    return 2;
  }

  let buffer = '';
  const router = createStdioRouter(broker, writeMessage);
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    buffer += chunk;
    for (;;) {
      const newline = buffer.indexOf('\n');
      if (newline === -1) break;
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      router.routeLine(line);
    }
  });
  process.stdin.on('end', () => {
    router.finish().finally(() => broker.close());
  });
  process.stdin.on('error', () => broker.close());
  return 0;
}

module.exports = { createBroker, createStdioRouter };

if (require.main === module) process.exitCode = runStdio(process.argv.slice(2));
