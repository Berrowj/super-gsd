#!/usr/bin/env node
// Phase 162 P162-T3: read-only HTTP transport for the fleet cache.
// Discovery and snapshot builds happen outside request handling.
// ASCII-only.

'use strict';

var http = require('node:http');
var fs = require('node:fs');
var path = require('node:path');
var fleetModule = require('./fleet.cjs');
var statusModule = require('./status.cjs');
var cockpitStateAdapter = require('../cockpit-state/adapter.cjs');

var DEFAULT_HOST = '127.0.0.1';
var DEFAULT_PORT = 7777;
var DEFAULT_INTERVAL_SECONDS = 20;
var MAX_INTERVAL_SECONDS = 86400;
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

      var laneMatch = /^\/api\/lane\/([^/]+?)(\/raw)?$/.exec(pathname);
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

function main(argv) {
  var options = parseArgs(argv);
  if (!fs.statSync(options.root).isDirectory()) {
    throw new Error('root must be a directory');
  }
  var cache = fleetModule.createFleetCache({
    buildSnapshot: function (lane) {
      return cockpitStateAdapter.buildSnapshot({ projectDir: lane.projectDir });
    },
    deriveLaneStatus: statusModule.deriveLaneStatus,
    intervalMs: options.intervalSeconds * 1000,
    concurrency: 4
  });
  var framed = process.env.SGSD_FLEET_FRAMED_STDIN === '1';
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
  main: main
};
