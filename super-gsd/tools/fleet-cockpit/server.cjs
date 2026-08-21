#!/usr/bin/env node
// Phase 162 P162-T3: read-only HTTP transport for the fleet cache.
// Discovery and snapshot builds happen outside request handling. The live
// Codex route performs one bounded, read-only file tail for its selected lane.
// ASCII-only.

'use strict';

var http = require('node:http');
var fs = require('node:fs');
var path = require('node:path');
var childProcess = require('node:child_process');
var fleetModule = require('./fleet.cjs');
var statusModule = require('./status.cjs');
var cockpitStateAdapter = require('../cockpit-state/adapter.cjs');

var DEFAULT_HOST = '127.0.0.1';
var DEFAULT_PORT = 7777;
var DEFAULT_INTERVAL_SECONDS = 20;
var MAX_INTERVAL_SECONDS = 86400;
var GIT_DISCOVERY_TIMEOUT_MS = 5000;
var GIT_DISCOVERY_MAX_BUFFER = 4 * 1024 * 1024;
var CODEX_LIVE_MAX_BYTES = 16 * 1024;
var CODEX_LIVE_HEARTBEAT_MS = 15 * 1000;
var CODEX_LIVE_WATCH_INTERVAL_MS = 250;
var CODEX_LIVE_NAMES = Object.freeze([
  'codex-executor-live.txt', 'codex-live-output.txt'
]);
var FRAME_BEGIN = 'SGSD_FLEET_FRAME_BEGIN';
var FRAME_END = 'SGSD_FLEET_FRAME_END';
var PUBLIC_DIR = path.join(__dirname, 'public');
var STATIC_ROUTES = Object.freeze({
  '/': Object.freeze({
    file: path.join(PUBLIC_DIR, 'index.html'),
    contentType: 'text/html; charset=utf-8'
  }),
  '/index.html': Object.freeze({
    file: path.join(PUBLIC_DIR, 'index.html'),
    contentType: 'text/html; charset=utf-8'
  }),
  '/app.js': Object.freeze({
    file: path.join(PUBLIC_DIR, 'app.js'),
    contentType: 'application/javascript; charset=utf-8'
  })
});

function parsePositiveNumber(value, name, maximum, integer) {
  var parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > maximum
      || (integer && Math.floor(parsed) !== parsed)) {
    throw new Error(name + ' must be a positive '
      + (integer ? 'integer' : 'number') + ' no greater than ' + maximum);
  }
  return parsed;
}

function parseArgs(argv) {
  var args = Array.isArray(argv) ? argv.slice() : [];
  var result = {
    root: path.resolve(process.cwd()),
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    intervalSeconds: DEFAULT_INTERVAL_SECONDS
  };

  function takeValue(index, flag) {
    if (!args[index + 1] || args[index + 1].indexOf('--') === 0) {
      throw new Error(flag + ' requires a value');
    }
    return args[index + 1];
  }

  for (var i = 0; i < args.length; i++) {
    var flag = args[i];
    if (flag === '--root') {
      result.root = path.resolve(takeValue(i, flag));
      i++;
    } else if (flag === '--host') {
      result.host = takeValue(i, flag);
      i++;
    } else if (flag === '--port') {
      result.port = parsePositiveNumber(takeValue(i, flag), 'port', 65535, true);
      i++;
    } else if (flag === '--interval') {
      result.intervalSeconds = parsePositiveNumber(
        takeValue(i, flag), 'interval', MAX_INTERVAL_SECONDS, false);
      i++;
    } else {
      throw new Error('unknown argument: ' + flag);
    }
  }

  if (!result.host.trim()) throw new Error('host must not be empty');
  return result;
}

function gitDiscoveryError(error) {
  var stderr = error && error.stderr;
  if (Buffer.isBuffer(stderr)) stderr = stderr.toString('utf8');
  var detail = typeof stderr === 'string' ? stderr.trim() : '';
  if (!detail && error && error.message) detail = error.message;
  return new Error(detail || 'git worktree discovery failed');
}

function readGitWorktreeFrame(root) {
  try {
    return childProcess.execFileSync('git', [
      '-C', root, 'worktree', 'list', '--porcelain'
    ], {
      encoding: 'utf8',
      timeout: GIT_DISCOVERY_TIMEOUT_MS,
      maxBuffer: GIT_DISCOVERY_MAX_BUFFER,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    throw gitDiscoveryError(error);
  }
}

function cacheAgeHeader(cache) {
  try {
    var health = cache.getHealth();
    var age = health ? health.cache_age_seconds : null;
    return age === null || age === undefined ? 'unknown' : String(age);
  } catch (_error) {
    return 'unknown';
  }
}

function setReadOnlyHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (req.headers.origin === 'null') {
    res.setHeader('Access-Control-Allow-Origin', 'null');
    res.setHeader('Vary', 'Origin');
  }
}

function sendJson(res, statusCode, value, cache, extraHeaders) {
  var body = JSON.stringify(value);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.setHeader('X-SGSD-Cache-Age-Seconds', cacheAgeHeader(cache));
  Object.keys(extraHeaders || {}).forEach(function (name) {
    res.setHeader(name, extraHeaders[name]);
  });
  res.end(body);
}

function sendStatic(res, route, cache) {
  var body = fs.readFileSync(route.file);
  res.statusCode = 200;
  res.setHeader('Content-Type', route.contentType);
  res.setHeader('Content-Length', body.length);
  res.setHeader('X-SGSD-Cache-Age-Seconds', cacheAgeHeader(cache));
  res.end(body);
}

function laneNotFound(res, cache) {
  sendJson(res, 404, {
    ok: false,
    error_code: 'lane_not_found',
    error: 'lane not found'
  }, cache);
}

function safeLaneName(encoded) {
  var name;
  try {
    name = decodeURIComponent(encoded);
  } catch (_error) {
    return null;
  }
  if (!name || name === '.' || name === '..'
      || name.indexOf('/') !== -1 || name.indexOf('\\') !== -1
      || name.indexOf('\0') !== -1) {
    return null;
  }
  return name;
}

function fleetRow(row) {
  var result = {
    name: row.name,
    path: row.path,
    branch: row.branch,
    status: row.status,
    headline: row.headline,
    phase: row.phase,
    phase_name: row.phase_name,
    last_activity_ts: row.last_activity_ts,
    age_minutes: row.age_minutes,
    conflict: row.conflict === true,
    degraded: Array.isArray(row.degraded) ? row.degraded : []
  };
  if (row.status === 'error') {
    result.error_code = row.error_code
      || (Array.isArray(row.reasons) && row.reasons[0])
      || 'snapshot_unavailable';
    result.error = row.error || row.headline || 'snapshot unavailable';
  }
  return result;
}

function openCodexLiveFile(lanePath) {
  var metricsDir = path.join(path.resolve(lanePath), '.planning', 'metrics');
  for (var i = 0; i < CODEX_LIVE_NAMES.length; i++) {
    var file = path.join(metricsDir, CODEX_LIVE_NAMES[i]);
    var descriptor = null;
    try {
      descriptor = fs.openSync(file, 'r');
      var stat = fs.fstatSync(descriptor);
      if (!stat.isFile()) continue;
      var opened = {
        descriptor: descriptor,
        file: file,
        source_file: CODEX_LIVE_NAMES[i],
        stat: stat
      };
      descriptor = null;
      return opened;
    } catch (error) {
      if (!error || error.code !== 'ENOENT') throw error;
    } finally {
      if (descriptor !== null) fs.closeSync(descriptor);
    }
  }
  return null;
}

function readDescriptorBytes(descriptor, offset, byteCount) {
  var buffer = Buffer.alloc(byteCount);
  var totalRead = 0;
  while (totalRead < byteCount) {
    var read = fs.readSync(
      descriptor, buffer, totalRead, byteCount - totalRead, offset + totalRead);
    if (read === 0) break;
    totalRead += read;
  }
  return buffer.subarray(0, totalRead);
}

function closeCodexLiveFile(opened) {
  if (!opened || opened.descriptor === null) return;
  var descriptor = opened.descriptor;
  opened.descriptor = null;
  fs.closeSync(descriptor);
}

function codexLiveValue(opened, text, truncated) {
  return {
    ok: true,
    present: true,
    source_file: opened.source_file,
    text: text,
    mtime: opened.stat.mtime.toISOString(),
    age_seconds: Math.max(
      0, Math.floor((Date.now() - opened.stat.mtimeMs) / 1000)),
    truncated: truncated === true
  };
}

function readCodexLive(lanePath) {
  var opened = openCodexLiveFile(lanePath);
  if (opened === null) return { ok: true, present: false };
  try {
    var byteCount = Math.min(opened.stat.size, CODEX_LIVE_MAX_BYTES);
    var offset = Math.max(0, opened.stat.size - byteCount);
    var buffer = readDescriptorBytes(opened.descriptor, offset, byteCount);
    return codexLiveValue(
      opened, buffer.toString('utf8'), opened.stat.size > CODEX_LIVE_MAX_BYTES);
  } finally {
    closeCodexLiveFile(opened);
  }
}

function codexLiveFiles(lanePath) {
  var metricsDir = path.join(path.resolve(lanePath), '.planning', 'metrics');
  return CODEX_LIVE_NAMES.map(function (name) {
    return path.join(metricsDir, name);
  });
}

function statExists(stat) {
  return !!stat && stat.nlink > 0 && stat.isFile();
}

function watchCodexLiveFile(file, onChange) {
  var watcher = null;
  var polling = false;
  var closed = false;

  function stopWatcher() {
    if (watcher === null) return;
    var current = watcher;
    watcher = null;
    current.close();
  }

  function stopPolling() {
    if (!polling) return;
    polling = false;
    fs.unwatchFile(file, onPoll);
  }

  function startPolling() {
    if (closed || polling) return;
    polling = true;
    fs.watchFile(file, {
      persistent: false,
      interval: CODEX_LIVE_WATCH_INTERVAL_MS
    }, onPoll);
  }

  function fallBackToPolling() {
    stopWatcher();
    startPolling();
  }

  function onPoll(current, previous) {
    if (closed) return;
    var currentExists = statExists(current);
    var previousExists = statExists(previous);
    var reset = currentExists !== previousExists
      || current.ino !== previous.ino
      || current.size < previous.size;
    onChange(reset);
    if (currentExists) {
      stopPolling();
      startWatcher();
    }
  }

  function startWatcher() {
    if (closed || watcher !== null) return;
    try {
      var candidate = fs.watch(file, { persistent: false }, function (eventType) {
        var reset = eventType === 'rename';
        onChange(reset);
        if (reset) fallBackToPolling();
      });
      watcher = candidate;
      candidate.on('error', function () {
        if (watcher !== candidate) return;
        onChange(true);
        fallBackToPolling();
      });
    } catch (_error) {
      startPolling();
    }
  }

  startWatcher();
  return function closeWatcher() {
    if (closed) return;
    closed = true;
    stopWatcher();
    stopPolling();
  };
}

function sendSseValue(res, value) {
  if (res.destroyed || res.writableEnded) return false;
  res.write('data: ' + JSON.stringify(value) + '\n\n');
  return true;
}

function codexFileIdentity(opened) {
  return String(opened.stat.dev) + ':' + String(opened.stat.ino)
    + ':' + String(opened.stat.birthtimeMs);
}

function streamCodexLive(req, res, lanePath, cache) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-SGSD-Cache-Age-Seconds', cacheAgeHeader(cache));
  res.flushHeaders();
  res.write('retry: 2000\n\n');

  var state = {
    present: false,
    source_file: null,
    identity: null,
    offset: 0
  };
  var cleanupWatchers = [];
  var initialized = false;
  var closed = false;
  var heartbeat = null;

  function cleanup() {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    cleanupWatchers.forEach(function (closeWatcher) { closeWatcher(); });
    cleanupWatchers = [];
  }

  res.once('close', cleanup);
  res.once('error', cleanup);

  function sendAbsent() {
    sendSseValue(res, {
      ok: true,
      present: false,
      reset: true
    });
  }

  function synchronize(resetHint, initial) {
    if (closed) return;
    var opened = null;
    try {
      opened = openCodexLiveFile(lanePath);
      if (opened === null) {
        if (initial || state.present) sendAbsent();
        state.present = false;
        state.source_file = null;
        state.identity = null;
        state.offset = 0;
        return;
      }

      var identity = codexFileIdentity(opened);
      var reset = initial || resetHint || !state.present
        || state.source_file !== opened.source_file
        || state.identity !== identity
        || opened.stat.size < state.offset;
      if (reset) {
        var tailBytes = Math.min(opened.stat.size, CODEX_LIVE_MAX_BYTES);
        var tailOffset = Math.max(0, opened.stat.size - tailBytes);
        var tail = readDescriptorBytes(
          opened.descriptor, tailOffset, tailBytes).toString('utf8');
        var resetValue = codexLiveValue(
          opened, tail, opened.stat.size > CODEX_LIVE_MAX_BYTES);
        resetValue.reset = true;
        sendSseValue(res, resetValue);
        state.offset = opened.stat.size;
      } else {
        while (state.offset < opened.stat.size) {
          var nextBytes = Math.min(
            CODEX_LIVE_MAX_BYTES, opened.stat.size - state.offset);
          var appended = readDescriptorBytes(
            opened.descriptor, state.offset, nextBytes);
          if (appended.length === 0) break;
          var appendValue = codexLiveValue(
            opened, appended.toString('utf8'), false);
          appendValue.reset = false;
          sendSseValue(res, appendValue);
          state.offset += appended.length;
        }
      }
      state.present = true;
      state.source_file = opened.source_file;
      state.identity = identity;
    } catch (_error) {
      sendSseValue(res, {
        ok: false,
        present: false,
        reset: true,
        error_code: 'codex_live_unavailable'
      });
    } finally {
      closeCodexLiveFile(opened);
    }
  }

  codexLiveFiles(lanePath).forEach(function (file) {
    cleanupWatchers.push(watchCodexLiveFile(file, function (reset) {
      if (initialized) synchronize(reset, false);
    }));
  });
  synchronize(false, true);
  initialized = true;

  heartbeat = setInterval(function () {
    if (!closed && !res.destroyed && !res.writableEnded) {
      res.write(': heartbeat\n\n');
    }
  }, CODEX_LIVE_HEARTBEAT_MS);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();
}

function createFleetServer(options) {
  var opts = options || {};
  var cache = opts.cache;
  var root = path.resolve(opts.root || process.cwd());
  if (!cache || typeof cache.getFleet !== 'function'
      || typeof cache.getLane !== 'function'
      || typeof cache.getRawLane !== 'function'
      || typeof cache.getHealth !== 'function') {
    throw new Error('createFleetServer requires the fleet cache getter API');
  }

  return http.createServer(function (req, res) {
    setReadOnlyHeaders(req, res);
    if (req.method !== 'GET') {
      sendJson(res, 405, {
        ok: false,
        error_code: 'method_not_allowed',
        error: 'method not allowed'
      }, cache, { Allow: 'GET' });
      return;
    }

    try {
      var requestUrl = new URL(req.url, 'http://localhost');
      var pathname = requestUrl.pathname;
      var staticRoute = STATIC_ROUTES[pathname];
      if (staticRoute) {
        sendStatic(res, staticRoute, cache);
        return;
      }
      if (pathname === '/api/fleet') {
        var fleet = cache.getFleet();
        sendJson(res, 200, {
          ok: true,
          schema_version: 1,
          ts: fleet.ts === undefined ? null : fleet.ts,
          root: root,
          cache_age_seconds: fleet.cache_age_seconds,
          counts: fleet.counts,
          lanes: (fleet.lanes || []).map(fleetRow)
        }, cache);
        return;
      }

      if (pathname === '/healthz') {
        var health = cache.getHealth();
        var healthFleet = cache.getFleet();
        var diagnostics = (healthFleet.lanes || []).filter(function (row) {
          return row.status === 'error';
        }).map(function (row) {
          return {
            name: row.name,
            error_code: row.error_code
              || (Array.isArray(row.reasons) && row.reasons[0])
              || 'snapshot_unavailable',
            error: row.error || row.headline || 'snapshot unavailable'
          };
        });
        var healthBody = {};
        Object.keys(health).forEach(function (key) { healthBody[key] = health[key]; });
        healthBody.ok = true;
        healthBody.last_build_diagnostics = diagnostics;
        sendJson(res, 200, healthBody, cache);
        return;
      }

      var laneMatch = /^\/api\/lane\/([^/]+?)(\/raw|\/codex-live|\/codex-live\/stream)?$/.exec(
        pathname);
      if (laneMatch) {
        var name = safeLaneName(laneMatch[1]);
        if (!name) {
          laneNotFound(res, cache);
          return;
        }
        var detail = cache.getLane(name);
        if (!detail) {
          laneNotFound(res, cache);
          return;
        }
        if (laneMatch[2] === '/codex-live/stream') {
          streamCodexLive(req, res, detail.path, cache);
          return;
        }
        if (laneMatch[2] === '/codex-live') {
          sendJson(res, 200, readCodexLive(detail.path), cache);
          return;
        }
        if (laneMatch[2] === '/raw') {
          var raw = cache.getRawLane(name);
          if (raw === null) {
            sendJson(res, 503, {
              ok: false,
              error_code: 'snapshot_unavailable',
              error: 'snapshot unavailable'
            }, cache);
          } else {
            sendJson(res, 200, raw, cache);
          }
          return;
        }
        var detailBody = { ok: detail.status !== 'error' };
        Object.keys(detail).forEach(function (key) {
          detailBody[key] = detail[key];
        });
        sendJson(res, 200, detailBody, cache);
        return;
      }

      sendJson(res, 404, {
        ok: false,
        error_code: 'not_found',
        error: 'not found'
      }, cache);
    } catch (_error) {
      sendJson(res, 500, {
        ok: false,
        error_code: 'internal_error',
        error: 'internal error'
      }, cache);
    }
  });
}

function attachFramedInput(input, cache) {
  var buffered = '';
  var inFrame = false;
  var frameLines = [];
  var refreshInFlight = false;
  var pendingPorcelain = null;

  function finishRefresh() {
    refreshInFlight = false;
    if (pendingPorcelain === null) return;
    var next = pendingPorcelain;
    pendingPorcelain = null;
    runFrame(next);
  }

  function runFrame(porcelain) {
    refreshInFlight = true;
    var accepted;
    try {
      accepted = cache.acceptDiscovery(porcelain);
    } catch (_error) {
      finishRefresh();
      return;
    }
    if (!accepted || accepted.ok !== true) {
      finishRefresh();
      return;
    }
    var refresh;
    try {
      refresh = cache.refreshNow();
    } catch (_error) {
      finishRefresh();
      return;
    }
    Promise.resolve(refresh).then(finishRefresh, finishRefresh);
  }

  function acceptLine(line) {
    if (line === FRAME_BEGIN) {
      inFrame = true;
      frameLines = [];
      return;
    }
    if (line === FRAME_END && inFrame) {
      var porcelain = frameLines.join('\n') + '\n';
      inFrame = false;
      frameLines = [];
      if (refreshInFlight) pendingPorcelain = porcelain;
      else runFrame(porcelain);
      return;
    }
    if (inFrame) frameLines.push(line);
  }

  input.setEncoding('utf8');
  input.on('data', function (chunk) {
    buffered += chunk;
    var lines = buffered.split('\n');
    buffered = lines.pop();
    lines.forEach(function (line) {
      acceptLine(line.replace(/\r$/, ''));
    });
  });
  input.on('end', function () {
    if (buffered) acceptLine(buffered.replace(/\r$/, ''));
  });
}

function createYieldingSnapshotBuilder(buildSnapshot) {
  if (typeof buildSnapshot !== 'function') {
    throw new TypeError('buildSnapshot must be a function');
  }
  var previous = Promise.resolve();
  return function yieldingSnapshotBuilder(input) {
    var result = previous.then(function () {
      return new Promise(function (resolve) {
        setImmediate(function () { setTimeout(resolve, 0); });
      });
    }).then(function () {
      return buildSnapshot(input);
    });
    previous = result.then(function () {}, function () {});
    return result;
  };
}

function main(argv) {
  var options = parseArgs(argv);
  if (!fs.statSync(options.root).isDirectory()) {
    throw new Error('root must be a directory');
  }
  var framed = process.env.SGSD_FLEET_FRAMED_STDIN === '1';
  var cache = fleetModule.createFleetCache({
    discoveryFrameSource: framed ? null : function () {
      return readGitWorktreeFrame(options.root);
    },
    buildSnapshot: createYieldingSnapshotBuilder(function (lane) {
      return cockpitStateAdapter.buildSnapshot({ projectDir: lane.projectDir });
    }),
    deriveLaneStatus: statusModule.deriveLaneStatus,
    intervalMs: options.intervalSeconds * 1000,
    concurrency: 4
  });
  if (framed) attachFramedInput(process.stdin, cache);
  else cache.start();

  var server = createFleetServer({ cache: cache, root: options.root });
  server.listen(options.port, options.host, function () {
    process.stdout.write('SGSD Fleet Cockpit: http://' + options.host + ':'
      + options.port + '\n');
  });

  function shutdown() {
    cache.stop();
    server.close();
  }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return { server: server, cache: cache, options: options };
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write('fleet-server: '
      + (error && error.message ? error.message : 'startup failed') + '\n');
    process.exitCode = 1;
  }
}

module.exports = {
  parseArgs: parseArgs,
  createFleetServer: createFleetServer,
  attachFramedInput: attachFramedInput,
  createYieldingSnapshotBuilder: createYieldingSnapshotBuilder,
  main: main
};
