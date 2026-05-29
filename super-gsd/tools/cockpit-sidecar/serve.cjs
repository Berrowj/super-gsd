#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const sidecar = require('./cockpit-sidecar.cjs');
const { renderShell } = require('./render-html.cjs');

const DEFAULT_PORT = 7777;
// Legacy fixed watch list — kept as fallback for environments where fs.watch
// recursive isn't supported (Linux pre-Node-20). On Windows + macOS the
// recursive .planning/ watch in startWatchers below supersedes this.
const WATCH_PATHS = [
  '.planning/STATE.md',
  '.planning/chronicles/INDEX.jsonl',
  '.planning/metrics/chronicle-validation-log.jsonl',
  '.planning/metrics/codex-executor-log.jsonl',
  '.planning/metrics/token-attribution.jsonl',
];

// P143.2 — paths the cockpit writes back to disk during its own composition.
// Watching these would cause an infinite recompute loop. Filtered out in the
// recursive watcher's trigger handler.
const WATCH_IGNORE_PATTERNS = [
  /[\\/]runtime[\\/]cockpit-server.*\.pid$/,
  /[\\/]runtime[\\/]cockpit-rendered\.html$/,
  /[\\/]runtime[\\/]cockpit-smoke-[^/\\]+\.html$/,
  /[\\/]runtime[\\/]stream-health\.jsonl$/,
  /[\\/]runtime[\\/]cockpit-server\.log$/,
  /[\\/]runtime[\\/]\.sgsd-/,
  /\.tmp$/,
  /[\\/]node_modules[\\/]/,
];

const WATCH_DEBOUNCE_MS = 200;

function parseArgs(argv) {
  const options = {
    port: DEFAULT_PORT,
    workspace: process.cwd(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--port') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--port requires a value');
      }
      options.port = parsePort(argv[index]);
      continue;
    }

    if (arg === '--workspace') {
      index += 1;
      if (index >= argv.length) {
        throw new Error('--workspace requires a value');
      }
      options.workspace = argv[index];
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  options.workspace = path.resolve(options.workspace);
  return options;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`invalid port: ${value}`);
  }
  return port;
}

function writeResponse(res, statusCode, contentType, body) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function writeBufferResponse(res, statusCode, contentType, body) {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': body.length,
  });
  res.end(body);
}

function parseCapturedJson(output) {
  const trimmed = String(output || '').trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (_err) {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw _err;
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

async function runSidecar(workspace) {
  const previousCwd = process.cwd();
  const previousWrite = process.stdout.write;
  const captured = [];

  process.stdout.write = function writeCaptured(chunk, encoding, callback) {
    const value = Buffer.isBuffer(chunk)
      ? chunk.toString(typeof encoding === 'string' ? encoding : 'utf8')
      : String(chunk);
    captured.push(value);

    if (typeof encoding === 'function') {
      encoding();
    }
    if (typeof callback === 'function') {
      callback();
    }
    return true;
  };

  try {
    process.chdir(workspace);
    const result = await Promise.resolve(sidecar.run([]));
    return normalizeSnapshot(result, captured.join(''));
  } finally {
    process.chdir(previousCwd);
    process.stdout.write = previousWrite;
  }
}

function normalizeSnapshot(result, capturedOutput) {
  if (result && typeof result === 'object' && !Buffer.isBuffer(result)) {
    if (Object.prototype.hasOwnProperty.call(result, 'stdout')) {
      try {
        return JSON.parse(result.stdout);
      } catch (_err) {
        return {
          error: 'snapshot_parse_failed',
          exitCode: result.exitCode,
        };
      }
    }
    return result;
  }

  if (Buffer.isBuffer(result)) {
    return JSON.parse(result.toString('utf8'));
  }

  if (typeof result === 'string') {
    return JSON.parse(result);
  }

  const parsedCaptured = parseCapturedJson(capturedOutput);
  if (parsedCaptured) {
    return parsedCaptured;
  }

  throw new Error('cockpit-sidecar run() did not return or print JSON');
}

function formatSseSnapshot(snapshot) {
  return `event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`;
}

function startWatchers(workspace, scheduleRecompute) {
  // P143.2 — recursive watch on .planning/ so a new phase dir, an edited
  // CONTEXT.md, a new PHASE-CAPSULE.json, a new brief, a new memory entry,
  // or a new cockpit-smoke verdict ALL trigger a live recompute + SSE
  // broadcast. Operator: 'the page goes stale unless you personally
  // refresh it' (2026-05-26). Single recursive watcher + debounce coalesces
  // bursts of writes into one snapshot recompute every WATCH_DEBOUNCE_MS.
  // Write-back files (cockpit-rendered.html, pidfiles, stream-health.jsonl)
  // are filtered to prevent feedback loops.
  //
  // P143.3: COCKPIT_SMOKE set (any value, set by run-self-test + browser-smoke)
  // → use legacy fixed-path watchers only, skip recursive walk. Recursive
  // fs.watch on .planning/ adds 1-3s of cold-start per child on Windows;
  // under 14-way parallel SAC load this pushed cold-start past 20s. Tests
  // that exercise the watcher (e.g. SAC-P132-03) touch STATE.md which IS in
  // the legacy fixed path list, so watcher→SSE wiring is still validated.
  // Operator's localhost:7777 (no env var) gets the full recursive watch.
  const useLegacyWatchers = process.env.COCKPIT_SMOKE != null;
  const watchers = [];
  let recomputeTimer = null;
  function trigger(filename) {
    const norm = (filename || '').replace(/\\/g, '/');
    if (norm && WATCH_IGNORE_PATTERNS.some(function (re) { return re.test(filename || ''); })) return;
    if (recomputeTimer) clearTimeout(recomputeTimer);
    recomputeTimer = setTimeout(function () { recomputeTimer = null; scheduleRecompute(); }, WATCH_DEBOUNCE_MS);
  }

  // Recursive watch on .planning/ (supported on Windows + macOS natively).
  const planningDir = path.resolve(workspace, '.planning');
  let recursiveOk = false;
  if (!useLegacyWatchers && fs.existsSync(planningDir)) {
    try {
      const w = fs.watch(planningDir, { recursive: true }, function (_event, filename) {
        trigger(filename);
      });
      watchers.push(w);
      recursiveOk = true;
    } catch (err) {
      console.error('cockpit-server: recursive watch failed (' + err.message + ') — falling back to fixed-path list');
    }
  }

  // Fallback to the legacy fixed-path watch list when recursive isn't
  // supported (e.g. Linux without recent libuv) or .planning/ doesn't exist.
  if (!recursiveOk) {
    for (const relativePath of WATCH_PATHS) {
      const target = path.resolve(workspace, relativePath);
      if (!fs.existsSync(target)) {
        console.error('cockpit-server watch missing: ' + target);
        continue;
      }
      try {
        const watcher = fs.watch(target, function () { trigger(target); });
        watchers.push(watcher);
      } catch (err) {
        console.error('cockpit-server watch failed: ' + target + ': ' + err.message);
      }
    }
  }

  // Watch .git/logs/HEAD so new commits trigger §7 Event tape +
  // agents.recent_actions refresh. Also watch the working-copy index file
  // so staged changes show without waiting for commit.
  const gitHead = path.resolve(workspace, '.git/logs/HEAD');
  if (fs.existsSync(gitHead)) {
    try { watchers.push(fs.watch(gitHead, function () { trigger(gitHead); })); }
    catch (err) { console.error('cockpit-server: .git/logs/HEAD watch failed: ' + err.message); }
  }

  // Watch the memory MEMORY.md so a new sgsd-curate entry appears live.
  const memoryDir = path.resolve(process.env.USERPROFILE || process.env.HOME || '',
    '.claude/projects/C--Users-jack-berrow-GSDedits/memory');
  if (fs.existsSync(memoryDir)) {
    try {
      watchers.push(fs.watch(memoryDir, { recursive: true }, function (_e, filename) {
        trigger(filename);
      }));
    } catch (err) { /* non-fatal */ }
  }

  console.error('cockpit-server: watchers active (' + watchers.length + ') ' + (recursiveOk ? 'recursive' : 'legacy'));
  return watchers;
}

function writePidFile(workspace, port) {
  // P141.5: pidfile per port so parallel test spawns don't race on a single
  // .planning/runtime/cockpit-server.pid (the recurring P132 SAC flake).
  // P143.3: only the browser-smoke harness (which never reads the pidfile)
  // skips it; run-self-test SAC-P132-05 asserts the pidfile exists.
  if (process.env.COCKPIT_SMOKE === 'smoke-only') return null;
  const runtimeDir = path.resolve(workspace, '.planning/runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });
  const name = port && port !== 7777 ? `cockpit-server-${port}.pid` : 'cockpit-server.pid';
  const pidPath = path.join(runtimeDir, name);
  fs.writeFileSync(pidPath, `${process.pid}\n`, 'utf8');
  return pidPath;
}

function removePidFile(pidPath) {
  if (!pidPath) {
    return;
  }

  try {
    fs.unlinkSync(pidPath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`cockpit-server pid cleanup failed: ${err.message}`);
    }
  }
}

async function start(options = {}) {
  const workspace = path.resolve(options.workspace || process.cwd());
  const port = options.port === undefined ? DEFAULT_PORT : parsePort(options.port);
  const clients = new Set();
  const heartbeats = new Map();
  const watchers = [];
  let lastSnapshot = null;
  let recomputeTimer = null;
  let recomputePromise = null;
  let pidPath = null;
  let closing = false;

  function removeClient(res) {
    clients.delete(res);
    const heartbeat = heartbeats.get(res);
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeats.delete(res);
    }
  }

  function writeSse(res, payload) {
    try {
      res.write(payload);
    } catch (_err) {
      removeClient(res);
    }
  }

  function broadcastSnapshot(snapshot) {
    const payload = formatSseSnapshot(snapshot);
    for (const client of clients) {
      writeSse(client, payload);
    }
  }

  // P143.4: two races to handle:
  // 1. pendingBroadcast — caller requested broadcast while a recompute was
  //    in-flight. The earlier code dropped the flag.
  // 2. needsRerun — caller asked for a recompute while one was in-flight.
  //    The in-flight result is based on PRE-touch state; we need to run
  //    another compute after it completes to pick up the new state.
  // Without (2), a touch landing mid-recompute is silently dropped.
  let pendingBroadcast = false;
  let needsRerun = false;
  async function recomputeSnapshot(shouldBroadcast) {
    if (shouldBroadcast) pendingBroadcast = true;
    if (recomputePromise) {
      needsRerun = true;
      return recomputePromise;
    }

    recomputePromise = runSidecar(workspace)
      .then((snapshot) => {
        lastSnapshot = snapshot;
        if (pendingBroadcast) {
          pendingBroadcast = false;
          broadcastSnapshot(snapshot);
        }
        return snapshot;
      })
      .finally(() => {
        recomputePromise = null;
        if (needsRerun && !closing) {
          needsRerun = false;
          // Schedule a fresh compute on next tick so the in-flight finally
          // callback unwinds cleanly. shouldBroadcast carries forward via
          // pendingBroadcast (still true if any caller set it during the
          // window between in-flight and now).
          setImmediate(() => recomputeSnapshot(true).catch((err) => {
            console.error(`cockpit-server rerun failed: ${err.message}`);
          }));
        }
      });

    return recomputePromise;
  }

  function scheduleRecompute() {
    if (closing) {
      return;
    }
    if (recomputeTimer) {
      clearTimeout(recomputeTimer);
    }
    recomputeTimer = setTimeout(() => {
      recomputeTimer = null;
      recomputeSnapshot(true).catch((err) => {
        console.error(`cockpit-server snapshot failed: ${err.message}`);
      });
    }, 100);
  }

  async function handleRequest(req, res) {
    if (req.method !== 'GET') {
      res.writeHead(405, {
        Allow: 'GET',
        'Content-Type': 'text/plain; charset=utf-8',
      });
      res.end('method not allowed\n');
      return;
    }

    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = url.pathname;

    if (pathname === '/') {
      writeResponse(res, 200, 'text/html; charset=utf-8', renderShell());
      return;
    }

    if (pathname === '/client.js') {
      const clientPath = path.join(__dirname, 'client.js');
      try {
        const body = fs.readFileSync(clientPath);
        writeBufferResponse(res, 200, 'application/javascript; charset=utf-8', body);
      } catch (err) {
        if (err.code === 'ENOENT') {
          writeResponse(res, 404, 'text/plain; charset=utf-8', 'not found\n');
          return;
        }
        throw err;
      }
      return;
    }

    if (pathname === '/events') {
      if (!lastSnapshot) {
        await recomputeSnapshot(false);
      }

      req.socket.setTimeout(0);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
      }

      clients.add(res);
      // v3.4 INTENT invariant #10 — liveness contract: 15s ping; client flips
      // data-conn=RECONNECTING after 2 missed pings (30s silence).
      const heartbeat = setInterval(() => {
        writeSse(res, ': keep-alive\n\n');
      }, 15000);
      heartbeats.set(res, heartbeat);

      req.on('close', () => {
        removeClient(res);
      });

      writeSse(res, formatSseSnapshot(lastSnapshot));
      return;
    }

    if (pathname === '/snapshot') {
      if (!lastSnapshot) {
        await recomputeSnapshot(false);
      }
      writeResponse(
        res,
        200,
        'application/json; charset=utf-8',
        `${JSON.stringify(lastSnapshot)}\n`
      );
      return;
    }

    // P143 — Handover passthrough route. Operator (2026-05-25):
    // "need another page to link all the handover HTMLs we've done so we
    // can quickly and easily click through em". Serves any .html under
    // .planning/{briefs,analyses,milestones}/ via /handover/<rel_path>.
    // Path-traversal guarded: ../ and absolute paths rejected; only files
    // under the configured planning root + with .html extension.
    if (pathname.startsWith('/handover/')) {
      const relRaw = decodeURIComponent(pathname.slice('/handover/'.length));
      // Reject path traversal
      if (relRaw.includes('..') || relRaw.startsWith('/') || relRaw.startsWith('\\')) {
        writeResponse(res, 403, 'text/plain; charset=utf-8', 'forbidden\n');
        return;
      }
      if (!relRaw.endsWith('.html')) {
        writeResponse(res, 400, 'text/plain; charset=utf-8', 'only .html allowed\n');
        return;
      }
      // Must be under .planning/{briefs,analyses,milestones}/
      const allowedPrefixes = ['.planning/briefs/', '.planning/analyses/', '.planning/milestones/'];
      if (!allowedPrefixes.some(function (p) { return relRaw.startsWith(p); })) {
        writeResponse(res, 403, 'text/plain; charset=utf-8', 'path not in allowed prefix\n');
        return;
      }
      const filePath = path.resolve(workspace, relRaw);
      // Final guard: resolved path must still be inside workspace
      if (!filePath.startsWith(path.resolve(workspace) + path.sep)) {
        writeResponse(res, 403, 'text/plain; charset=utf-8', 'forbidden\n');
        return;
      }
      try {
        const body = fs.readFileSync(filePath, 'utf8');
        writeResponse(res, 200, 'text/html; charset=utf-8', body);
      } catch (_e) {
        writeResponse(res, 404, 'text/plain; charset=utf-8', 'handover not found\n');
      }
      return;
    }

    writeResponse(res, 404, 'text/plain; charset=utf-8', 'not found\n');
  }

  const server = http.createServer((req, res) => {
    handleRequest(req, res).catch((err) => {
      console.error(`cockpit-server request failed: ${err.message}`);
      if (!res.headersSent) {
        writeResponse(res, 500, 'text/plain; charset=utf-8', 'internal server error\n');
      } else {
        res.end();
      }
    });
  });

  await new Promise((resolve, reject) => {
    function onError(err) {
      reject(err);
    }

    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', onError);
      resolve();
    });
  });

  const actualPort = server.address().port;
  try {
    await recomputeSnapshot(false);
    pidPath = writePidFile(workspace, actualPort);
    watchers.push(...startWatchers(workspace, scheduleRecompute));
  } catch (err) {
    await new Promise((resolve) => server.close(resolve));
    throw err;
  }

  console.error(`cockpit-server listening port: ${actualPort}`);

  async function close() {
    if (closing) {
      return;
    }
    closing = true;

    if (recomputeTimer) {
      clearTimeout(recomputeTimer);
      recomputeTimer = null;
    }

    for (const watcher of watchers) {
      try {
        watcher.close();
      } catch (_err) {
        // Closing is best-effort on process shutdown.
      }
    }

    for (const client of Array.from(clients)) {
      removeClient(client);
      try {
        client.end();
      } catch (_err) {
        // Client sockets may already be gone.
      }
    }

    removePidFile(pidPath);

    await new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  return {
    server,
    port: actualPort,
    workspace,
    pidPath,
    getSnapshot: () => lastSnapshot,
    broadcastSnapshot,
    close,
  };
}

if (require.main === module) {
  let controller = null;
  let shuttingDown = false;

  function exitWithError(err, options) {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`cockpit-server EADDRINUSE port: ${options.port}`);
    } else {
      console.error(`cockpit-server failed: ${err.message}`);
    }
    process.exit(1);
  }

  function shutdown() {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    if (!controller) {
      process.exit(0);
      return;
    }

    controller.close()
      .catch((err) => {
        console.error(`cockpit-server shutdown failed: ${err.message}`);
      })
      .finally(() => {
        process.exit(0);
      });
  }

  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`cockpit-server failed: ${err.message}`);
    process.exit(1);
  }

  start(options)
    .then((started) => {
      controller = started;
      process.on('SIGTERM', shutdown);
      process.on('SIGINT', shutdown);
    })
    .catch((err) => {
      exitWithError(err, options);
    });
}

module.exports = {
  start,
  parseArgs,
};
