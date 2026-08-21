#!/usr/bin/env node
// Phase 162 P162-T1 through P162-T3 selectable fixture self-tests.
// Test-only Git processes create isolated repositories. The production server
// has one read-only Git adapter; fleet discovery never runs on an HTTP request.
// ASCII-only.

'use strict';

var fs = require('node:fs');
var path = require('node:path');
var os = require('node:os');
var http = require('node:http');
var childProcess = require('node:child_process');
var fleet = require('./fleet.cjs');
var cockpitStateAdapter = require('../cockpit-state/adapter.cjs');
var status = null;
var serverModule = null;
try {
  status = require('./status.cjs');
} catch (_statusLoadError) {
  status = null;
}
try {
  serverModule = require('./server.cjs');
} catch (_serverLoadError) {
  serverModule = null;
}

if (!fleet || typeof fleet.parseWorktreePorcelain !== 'function'
    || typeof fleet.createFleetCache !== 'function') {
  throw new Error('fleet.cjs public API is incomplete');
}

var SECTION_KEYS = [
  'now', 'objective', 'unlock', 'blockers', 'agents', 'codex',
  'gates', 'tokens', 'artifacts', 'staleness', 'harness_evolution',
  'resume_command'
];

function readFixture(name) {
  var file = path.join(__dirname, 'fixtures', 'lanes', name + '.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readEventFixture(name) {
  var file = path.join(__dirname, 'fixtures', 'events', name + '.jsonl');
  return fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).filter(Boolean).map(
    function (line) { return JSON.parse(line); });
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function deriveFixture(check, name, mutate, deriveOptions) {
  check.assert('status_module_available',
    !!status && typeof status.deriveLaneStatus === 'function');
  var snapshot = readFixture(name);
  if (mutate) mutate(snapshot);
  var before = JSON.stringify(snapshot);
  deepFreeze(snapshot);
  var options = Object.assign({
    nowMs: Date.parse('2026-08-20T18:19:31.052Z')
  }, deriveOptions || {});
  var optionsBefore = JSON.stringify(options);
  deepFreeze(options);
  var derived = status.deriveLaneStatus(snapshot, options);
  check.assert(name + '_input_unchanged', JSON.stringify(snapshot) === before);
  if (deriveOptions) {
    check.assert(name + '_derive_options_unchanged',
      JSON.stringify(options) === optionsBefore);
  }
  return derived;
}

function makeCheck() {
  var results = [];
  return {
    results: results,
    skip: function (label, detail) {
      results.push({ label: label, ok: true, skipped: true, detail: detail || '' });
    },
    assert: function (label, condition, detail) {
      results.push({ label: label, ok: !!condition, detail: detail || '' });
      if (!condition) throw new Error(label + (detail ? ': ' + detail : ''));
    }
  };
}

function git(cwd, args) {
  var result = childProcess.spawnSync('git', args, {
    cwd: cwd,
    encoding: 'utf8',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error('git failed: ' + args.join(' ') + ': '
      + String(result.stderr || '').trim());
  }
  return result.stdout;
}

function createGitFixture(laneCount, options) {
  var opts = options || {};
  var container = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd fleet fixture '));
  var checkout = path.join(container, 'main checkout');
  fs.mkdirSync(checkout, { recursive: true });
  git(container, ['init', '-b', 'main', checkout]);
  git(checkout, ['config', 'user.email', 'fixture@example.invalid']);
  git(checkout, ['config', 'user.name', 'SGSD Fixture']);
  fs.writeFileSync(path.join(checkout, 'seed.txt'), 'fixture\n', 'utf8');
  git(checkout, ['add', 'seed.txt']);
  git(checkout, ['commit', '-m', 'fixture seed']);

  var lanes = [{
    name: path.basename(checkout),
    path: checkout,
    branch: 'main'
  }];
  fs.mkdirSync(path.join(checkout, '.planning'), { recursive: true });

  for (var i = 1; i < laneCount; i++) {
    var suffix = String(i).padStart(2, '0');
    var lanePath = path.join(container, 'lane ' + suffix);
    var branch = 'fixture-lane-' + suffix;
    if (i === opts.detachedIndex) {
      git(checkout, ['worktree', 'add', '--detach', lanePath]);
      branch = null;
    } else {
      git(checkout, ['worktree', 'add', '-b', branch, lanePath]);
    }
    lanes.push({ name: path.basename(lanePath), path: lanePath, branch: branch });
    if (i !== opts.missingPlanningIndex) {
      fs.mkdirSync(path.join(lanePath, '.planning'), { recursive: true });
    }
  }

  return {
    container: container,
    checkout: checkout,
    lanes: lanes,
    porcelain: git(checkout, ['-C', checkout, 'worktree', 'list', '--porcelain']),
    cleanup: function () {
      fs.rmSync(container, { recursive: true, force: true });
    }
  };
}

function createSyntheticDiscovery(count) {
  var root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd fleet pure '));
  var lanes = [];
  var frames = [];
  for (var i = 0; i < count; i++) {
    var lanePath = path.join(root, 'lane ' + String(i).padStart(2, '0'));
    fs.mkdirSync(path.join(lanePath, '.planning'), { recursive: true });
    lanes.push({ name: path.basename(lanePath), path: lanePath });
    frames.push('worktree ' + lanePath + '\nHEAD 0000000000000000000000000000000000000000\n'
      + 'branch refs/heads/pure-' + i + '\n');
  }
  return {
    root: root,
    lanes: lanes,
    porcelain: frames.join('\n'),
    cleanup: function () { fs.rmSync(root, { recursive: true, force: true }); }
  };
}

function makeTimers() {
  var queue = [];
  var nextId = 1;
  return {
    setTimeout: function (fn, delay) {
      var item = { id: nextId++, fn: fn, delay: delay };
      queue.push(item);
      return item.id;
    },
    clearTimeout: function (id) {
      queue = queue.filter(function (item) { return item.id !== id; });
    },
    runNext: function () {
      if (queue.length === 0) throw new Error('no fake timer pending');
      queue.sort(function (a, b) { return a.delay - b.delay || a.id - b.id; });
      return queue.shift().fn();
    },
    size: function () { return queue.length; }
  };
}

function fixtureDerivation(snapshot) {
  var live = snapshot && snapshot.data && snapshot.data.codex
    ? snapshot.data.codex.live_state : null;
  var blockers = snapshot && snapshot.data && snapshot.data.blockers
    ? snapshot.data.blockers.count : 0;
  var stale = snapshot && snapshot.data && snapshot.data.staleness
    && snapshot.data.staleness.state_md
    ? snapshot.data.staleness.state_md.stale : false;
  var status = blockers > 0 ? 'attention'
    : (live === 'ok' ? 'running' : (stale || live === 'stale' ? 'stale' : 'idle'));
  var objective = snapshot && snapshot.data ? snapshot.data.objective : {};
  var now = snapshot && snapshot.data ? snapshot.data.now : {};
  return {
    status: status,
    headline: status + ' fixture',
    reasons: [status + '_fixture'],
    phase: objective.phase || null,
    phase_name: objective.phase_name || null,
    last_activity_ts: now.ts || null,
    age_minutes: 0,
    conflict: false,
    degraded: snapshot._section_degraded || [],
    agents: { state: 'fixture-detail' }
  };
}

async function pump() {
  await Promise.resolve();
  await Promise.resolve();
}

function requireServerModule(check) {
  check.assert('server_module_available', !!serverModule
    && typeof serverModule.parseArgs === 'function'
    && typeof serverModule.createFleetServer === 'function'
    && typeof serverModule.main === 'function');
  return serverModule;
}

function adapterSelfTestInProcess() {
  var originalSpawnSync = childProcess.spawnSync;
  var writerPath = path.resolve(__dirname, '..', '..', 'scripts', 'lib',
    'orchestrator-live-writer.cjs');
  var writer = require(writerPath);
  childProcess.spawnSync = function (command, args, options) {
    var callArgs = Array.isArray(args) ? args : [];
    if (command === process.execPath && path.resolve(callArgs[0] || '') === writerPath
        && callArgs[1] === '--emit') {
      var event;
      try {
        event = JSON.parse(callArgs[2]);
      } catch (error) {
        return { status: 1, stdout: '', stderr: error.message, error: error };
      }
      event.projectDir = options && options.cwd;
      var result = writer.appendEvent(event);
      return {
        status: result.ok ? 0 : 1,
        stdout: JSON.stringify(result) + '\n',
        stderr: result.ok ? '' : result.error
      };
    }
    return {
      status: null,
      stdout: '',
      stderr: 'unexpected spawn blocked by fleet self-test',
      error: new Error('unexpected spawn blocked by fleet self-test')
    };
  };
  try {
    return cockpitStateAdapter.selfTest();
  } finally {
    childProcess.spawnSync = originalSpawnSync;
  }
}

function closeServer(server) {
  return new Promise(function (resolve, reject) {
    if (!server.listening) return resolve();
    server.close(function (error) {
      if (error) reject(error);
      else resolve();
    });
  });
}

function listenServer(server, host, port) {
  return new Promise(function (resolve, reject) {
    function onError(error) {
      server.removeListener('listening', onListening);
      reject(error);
    }
    function onListening() {
      server.removeListener('error', onError);
      resolve(server.address());
    }
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port === undefined ? 0 : port, host);
  });
}

function requestServer(address, requestPath, method, headers, agent) {
  return new Promise(function (resolve, reject) {
    var req = http.request({
      hostname: address.address,
      port: address.port,
      method: method || 'GET',
      path: requestPath,
      headers: headers || {},
      agent: agent
    }, function (res) {
      var chunks = [];
      res.on('data', function (chunk) { chunks.push(chunk); });
      res.on('end', function () {
        var text = Buffer.concat(chunks).toString('utf8');
        var body = null;
        try {
          body = JSON.parse(text);
        } catch (_parseError) {
          body = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          text: text,
          body: body
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function waitForCondition(predicate, timeoutMs) {
  var deadline = Date.now() + timeoutMs;
  return new Promise(function (resolve, reject) {
    function check() {
      if (predicate()) {
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error('timed out waiting for condition'));
        return;
      }
      setTimeout(check, 20);
    }
    check();
  });
}

function openSseStream(address, requestPath, agent) {
  return new Promise(function (resolve, reject) {
    var request = http.get({
      hostname: address.address,
      port: address.port,
      method: 'GET',
      path: requestPath,
      headers: { Accept: 'text/event-stream' },
      agent: agent
    });
    var settled = false;
    request.once('error', function (error) {
      if (!settled) reject(error);
    });
    request.once('response', function (response) {
      settled = true;
      response.setEncoding('utf8');
      var buffered = '';
      var queued = [];
      var waiters = [];
      var ended = false;

      function deliver(value) {
        if (waiters.length > 0) {
          waiters.shift().resolve(value);
        } else {
          queued.push(value);
        }
      }

      function failWaiters(error) {
        while (waiters.length > 0) waiters.shift().reject(error);
      }

      function parseFrames() {
        var boundary;
        while ((boundary = buffered.indexOf('\n\n')) !== -1) {
          var frame = buffered.slice(0, boundary);
          buffered = buffered.slice(boundary + 2);
          var dataLines = frame.split('\n').filter(function (line) {
            return line.indexOf('data:') === 0;
          }).map(function (line) {
            return line.slice(5).replace(/^ /, '');
          });
          if (dataLines.length === 0) continue;
          try {
            deliver(JSON.parse(dataLines.join('\n')));
          } catch (error) {
            failWaiters(error);
          }
        }
      }

      response.on('data', function (chunk) {
        buffered += chunk.replace(/\r\n/g, '\n');
        parseFrames();
      });
      response.on('end', function () {
        ended = true;
        failWaiters(new Error('SSE stream ended'));
      });
      response.on('error', failWaiters);

      resolve({
        statusCode: response.statusCode,
        headers: response.headers,
        nextEvent: function (timeoutMs) {
          if (queued.length > 0) return Promise.resolve(queued.shift());
          if (ended) return Promise.reject(new Error('SSE stream ended'));
          return new Promise(function (eventResolve, eventReject) {
            var waiter = { resolve: eventResolve, reject: eventReject };
            var timer = setTimeout(function () {
              var index = waiters.indexOf(waiter);
              if (index !== -1) waiters.splice(index, 1);
              eventReject(new Error('timed out waiting for SSE event'));
            }, timeoutMs);
            waiter.resolve = function (value) {
              clearTimeout(timer);
              eventResolve(value);
            };
            waiter.reject = function (error) {
              clearTimeout(timer);
              eventReject(error);
            };
            waiters.push(waiter);
          });
        },
        close: function () {
          response.destroy();
          request.destroy();
        }
      });
    });
  });
}

function spawnDelayedAppend(file, marker, delayMs) {
  var script = [
    "'use strict';",
    "var fs = require('node:fs');",
    'setTimeout(function () {',
    "  fs.appendFileSync(process.argv[1], process.argv[2] + Date.now() + '\\n', 'utf8');",
    '}, Number(process.argv[3]));'
  ].join('\n');
  var child = childProcess.spawn(process.execPath, [
    '-e', script, file, marker, String(delayMs)
  ], { stdio: 'ignore' });
  var ready = new Promise(function (resolve, reject) {
    var settled = false;
    child.once('spawn', function () {
      if (settled) return;
      settled = true;
      resolve();
    });
    child.once('error', function (error) {
      if (settled) return;
      settled = true;
      reject(error);
    });
    child.once('exit', function (code) {
      if (settled) return;
      settled = true;
      reject(new Error('delayed append exited before spawn: ' + code));
    });
  });
  var completion = new Promise(function (resolve, reject) {
    child.once('error', reject);
    child.once('exit', function (code) {
      if (code === 0) resolve();
      else reject(new Error('delayed append exited ' + code));
    });
  });
  return { ready: ready, completion: completion };
}

function installWatcherAudit() {
  var originalWatch = fs.watch;
  var originalWatchFile = fs.watchFile;
  var originalUnwatchFile = fs.unwatchFile;
  var watchers = new Set();
  var pollers = new Map();

  fs.watch = function () {
    var watcher = originalWatch.apply(fs, arguments);
    var originalClose = watcher.close.bind(watcher);
    var open = true;
    watchers.add(watcher);
    watcher.close = function () {
      if (open) {
        open = false;
        watchers.delete(watcher);
      }
      return originalClose();
    };
    return watcher;
  };
  fs.watchFile = function (file, options, listener) {
    var callback = typeof options === 'function' ? options : listener;
    pollers.set(callback, file);
    return originalWatchFile.apply(fs, arguments);
  };
  fs.unwatchFile = function (file, listener) {
    if (listener) pollers.delete(listener);
    return originalUnwatchFile.apply(fs, arguments);
  };

  return {
    activeCount: function () { return watchers.size + pollers.size; },
    forceCleanup: function () {
      Array.from(watchers).forEach(function (watcher) { watcher.close(); });
      pollers.forEach(function (file, listener) {
        originalUnwatchFile.call(fs, file, listener);
      });
      pollers.clear();
    },
    restore: function () {
      fs.watch = originalWatch;
      fs.watchFile = originalWatchFile;
      fs.unwatchFile = originalUnwatchFile;
    }
  };
}

function makePorcelain(lanes) {
  return lanes.map(function (lane, index) {
    return 'worktree ' + lane.path
      + '\nHEAD ' + String(index).padStart(40, '0')
      + '\nbranch refs/heads/' + lane.branch + '\n';
  }).join('\n');
}

async function createHttpFixture(snapshot, options) {
  var opts = options || {};
  var root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd fleet http '));
  var lanePath = path.join(root, 'lane-one');
  var skippedPath = path.join(root, 'lane-skipped');
  fs.mkdirSync(path.join(lanePath, '.planning'), { recursive: true });
  var lanes = [{ path: lanePath, branch: 'lane-one' }];
  if (opts.includeSkipped) {
    fs.mkdirSync(skippedPath, { recursive: true });
    lanes.push({ path: skippedPath, branch: 'lane-skipped' });
  }
  var clockMs = Date.parse('2026-08-20T18:19:31.052Z');
  var cache = fleet.createFleetCache({
    buildSnapshot: opts.buildSnapshot || function () { return copy(snapshot); },
    deriveLaneStatus: opts.deriveLaneStatus || fixtureDerivation,
    now: opts.now || function () { return clockMs; },
    intervalMs: opts.intervalMs,
    concurrency: opts.concurrency
  });
  cache.acceptDiscovery(makePorcelain(lanes));
  await cache.refreshNow();
  await new Promise(function (resolve) { setTimeout(resolve, 0); });
  return {
    root: root,
    cache: cache,
    laneName: 'lane-one',
    cleanup: function () {
      cache.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}

async function withHttpServer(check, fixture, callback) {
  var moduleValue = requireServerModule(check);
  var server = moduleValue.createFleetServer({
    cache: fixture.cache,
    root: fixture.root
  });
  try {
    var address = await listenServer(server, '127.0.0.1');
    await callback(address, server);
  } finally {
    await closeServer(server);
  }
}

var PAGE_FIXTURE_NAMES = Object.freeze([
  'attention', 'running', 'stale', 'idle', 'noise-tokens-absent',
  'noise-gates-empty', 'projection-conflict', 'build-error'
]);

function pageFile(name) {
  return path.join(__dirname, 'public', name);
}

function extractMarkedHelper(source, name) {
  var begin = '/* SGSD_FLEET_HELPER_BEGIN ' + name + ' */';
  var end = '/* SGSD_FLEET_HELPER_END ' + name + ' */';
  var beginIndex = source.indexOf(begin);
  var endIndex = source.indexOf(end);
  if (beginIndex === -1 || endIndex === -1 || endIndex <= beginIndex) {
    throw new Error('missing production helper markers: ' + name);
  }
  return source.slice(beginIndex + begin.length, endIndex).trim();
}

function extractNamedFunction(source, name) {
  var start = source.indexOf('function ' + name + '(');
  if (start === -1) throw new Error('missing production function: ' + name);
  var open = source.indexOf('{', start);
  var depth = 0;
  for (var i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('unbalanced production function: ' + name);
}

function compileFunction(source, name, dependencies) {
  var deps = dependencies || {};
  var names = Object.keys(deps);
  var values = names.map(function (key) { return deps[key]; });
  var factory = Function.apply(null, names.concat([source + '\nreturn ' + name + ';']));
  return factory.apply(null, values);
}

function compilePageHelpers(appSource) {
  var compareLaneRows = compileFunction(
    extractMarkedHelper(appSource, 'compareLaneRows'), 'compareLaneRows');
  var formatValue = compileFunction(
    extractMarkedHelper(appSource, 'formatValue'), 'formatValue');
  var escapeHtml = compileFunction(
    extractNamedFunction(appSource, 'escapeHtml'), 'escapeHtml');
  var safeStatus = compileFunction(
    extractNamedFunction(appSource, 'safeStatus'), 'safeStatus');
  var formatAge = compileFunction(
    extractMarkedHelper(appSource, 'formatAge'), 'formatAge', {
      formatValue: formatValue
    });
  var renderLaneRail = compileFunction(
    extractMarkedHelper(appSource, 'renderLaneRail'), 'renderLaneRail', {
      compareLaneRows: compareLaneRows,
      safeStatus: safeStatus,
      formatAge: formatAge,
      escapeHtml: escapeHtml
    });
  var renderObjectiveConflict = compileFunction(
    extractMarkedHelper(appSource, 'renderObjectiveConflict'),
    'renderObjectiveConflict', {
      formatValue: formatValue,
      escapeHtml: escapeHtml
    });
  var renderNow = compileFunction(
    extractMarkedHelper(appSource, 'renderNow'), 'renderNow', {
      formatValue: formatValue,
      escapeHtml: escapeHtml
    });
  var renderObjective = compileFunction(
    extractMarkedHelper(appSource, 'renderObjective'), 'renderObjective', {
      formatValue: formatValue,
      escapeHtml: escapeHtml
    });
  return {
    compareLaneRows: compareLaneRows,
    formatValue: formatValue,
    formatAge: formatAge,
    escapeHtml: escapeHtml,
    renderLaneRail: renderLaneRail,
    renderObjectiveConflict: renderObjectiveConflict,
    renderNow: renderNow,
    renderObjective: renderObjective
  };
}

async function createPageFixture() {
  if (!status || typeof status.deriveLaneStatus !== 'function') {
    throw new Error('status module unavailable');
  }
  var moduleValue = serverModule;
  if (!moduleValue || typeof moduleValue.createFleetServer !== 'function') {
    throw new Error('server module unavailable');
  }
  var root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd fleet page '));
  var snapshots = Object.create(null);
  var lanes = PAGE_FIXTURE_NAMES.map(function (name) {
    var lanePath = path.join(root, name);
    fs.mkdirSync(path.join(lanePath, '.planning'), { recursive: true });
    snapshots[name] = readFixture(name);
    return { path: lanePath, branch: 'fixture-' + name };
  });
  var clockMs = Date.parse('2026-08-20T18:19:31.052Z');
  var cache = fleet.createFleetCache({
    buildSnapshot: function (input) {
      return copy(snapshots[path.basename(input.projectDir)]);
    },
    deriveLaneStatus: status.deriveLaneStatus,
    now: function () { return clockMs; },
    intervalMs: 20000,
    concurrency: 4
  });
  var server = null;
  try {
    var accepted = cache.acceptDiscovery(makePorcelain(lanes));
    if (!accepted || accepted.ok !== true) throw new Error('fixture discovery failed');
    await cache.refreshNow();
    await new Promise(function (resolve) { setTimeout(resolve, 0); });
    server = moduleValue.createFleetServer({ cache: cache, root: root });
    var address = await listenServer(server, '127.0.0.1', 0);
    return {
      address: address,
      cache: cache,
      root: root,
      names: PAGE_FIXTURE_NAMES.slice(),
      snapshots: snapshots,
      cleanup: async function () {
        await closeServer(server);
        cache.stop();
        fs.rmSync(root, { recursive: true, force: true });
      }
    };
  } catch (error) {
    if (server) await closeServer(server);
    cache.stop();
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

async function caseDefaultBind(check) {
  var moduleValue = requireServerModule(check);
  var defaults = moduleValue.parseArgs([]);
  var lan = moduleValue.parseArgs(['--host', '0.0.0.0']);
  check.assert('default_host_is_loopback', defaults.host === '127.0.0.1');
  check.assert('default_port_is_7777', defaults.port === 7777);
  check.assert('default_interval_is_20_seconds', defaults.intervalSeconds === 20);
  check.assert('lan_bind_requires_explicit_flag', lan.host === '0.0.0.0');

  var probe = http.createServer();
  try {
    await listenServer(probe, defaults.host, defaults.port);
  } catch (error) {
    if (error && error.code === 'EADDRINUSE') {
      check.skip('real_default_bind_127_0_0_1_7777_port_busy',
        'SKIP: 127.0.0.1:7777 is occupied; actual main([]) bind not attempted');
      return;
    }
    throw error;
  }
  await closeServer(probe);

  var root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd fleet default bind '));
  var priorCwd = process.cwd();
  var priorSigint = process.listeners('SIGINT');
  var priorSigterm = process.listeners('SIGTERM');
  var runtime = null;
  try {
    process.chdir(root);
    runtime = moduleValue.main([]);
    process.chdir(priorCwd);
    var address = runtime.server.listening
      ? runtime.server.address()
      : await new Promise(function (resolve, reject) {
        runtime.server.once('error', reject);
        runtime.server.once('listening', function () {
          runtime.server.removeListener('error', reject);
          resolve(runtime.server.address());
        });
      });
    check.assert('actual_cli_default_listener_is_127_0_0_1_7777',
      address.address === defaults.host && address.port === defaults.port,
      'address=' + address.address + ':' + address.port);
    check.assert('actual_cli_default_path_used_parse_and_listen_defaults',
      runtime.options.host === defaults.host && runtime.options.port === defaults.port
      && runtime.options.intervalSeconds === defaults.intervalSeconds);
  } finally {
    if (process.cwd() !== priorCwd) process.chdir(priorCwd);
    if (runtime) {
      runtime.cache.stop();
      await closeServer(runtime.server);
    }
    process.listeners('SIGINT').forEach(function (listener) {
      if (priorSigint.indexOf(listener) === -1) process.removeListener('SIGINT', listener);
    });
    process.listeners('SIGTERM').forEach(function (listener) {
      if (priorSigterm.indexOf(listener) === -1) process.removeListener('SIGTERM', listener);
    });
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function framedPorcelain(label) {
  return 'SGSD_FLEET_FRAME_BEGIN\nworktree C:\\fixture\\' + label
    + '\nHEAD 0000000000000000000000000000000000000000\n'
    + 'branch refs/heads/' + label + '\nSGSD_FLEET_FRAME_END\n';
}

async function caseFrameCoalescing(check) {
  var moduleValue = requireServerModule(check);
  check.assert('framed_input_hook_available',
    typeof moduleValue.attachFramedInput === 'function');
  var input = new (require('node:stream').PassThrough)();
  var accepted = [];
  var releases = [];
  var refreshes = 0;
  var cache = {
    acceptDiscovery: function (porcelain) {
      accepted.push(porcelain);
      return { ok: true };
    },
    refreshNow: function () {
      refreshes++;
      return new Promise(function (resolve) { releases.push(resolve); });
    }
  };
  moduleValue.attachFramedInput(input, cache);
  input.write(framedPorcelain('first'));
  await pump();
  input.write(framedPorcelain('second'));
  input.write(framedPorcelain('third'));
  await pump();
  check.assert('overlapping_frames_do_not_queue_rebuild_per_tick',
    refreshes === 1, 'refreshes=' + refreshes);
  releases.shift()();
  await pump();
  await pump();
  check.assert('overlapping_frames_collapse_to_one_pending_rebuild',
    refreshes === 2, 'refreshes=' + refreshes);
  check.assert('pending_rebuild_uses_latest_complete_frame',
    accepted.length === 2
      && accepted[0].indexOf('first') !== -1
      && accepted[1].indexOf('third') !== -1
      && accepted.every(function (frame) { return frame.indexOf('second') === -1; }));
  releases.shift()();
  await pump();
  input.end();
}

async function caseHttpContract(check) {
  var moduleValue = requireServerModule(check);
  var invalidArgs = [
    ['--port', '0'], ['--port', '65536'],
    ['--interval', '0'], ['--interval', '86401'],
    ['--host'], ['--unknown', 'value']
  ];
  check.assert('cli_rejects_missing_nonpositive_and_unbounded_values',
    invalidArgs.every(function (args) {
      try {
        moduleValue.parseArgs(args);
        return false;
      } catch (_error) {
        return true;
      }
    }));
  var fixture = await createHttpFixture(readFixture('attention'));
  try {
    await withHttpServer(check, fixture, async function (address) {
      var response = await requestServer(address, '/api/fleet');
      var row = response.body && response.body.lanes
        ? response.body.lanes[0] : null;
      check.assert('fleet_route_returns_200', response.statusCode === 200);
      check.assert('fleet_contract_top_level_shape', response.body.ok === true
        && response.body.schema_version === 1
        && response.body.root === fixture.root
        && response.body.cache_age_seconds === 0);
      check.assert('fleet_contract_counts_shape',
        response.body.counts.attention === 1
        && response.body.counts.running === 0
        && response.body.counts.stale === 0
        && response.body.counts.idle === 0);
      check.assert('fleet_contract_lane_shape', !!row
        && row.name === fixture.laneName
        && row.status === 'attention'
        && Object.prototype.hasOwnProperty.call(row, 'headline')
        && Object.prototype.hasOwnProperty.call(row, 'phase')
        && Object.prototype.hasOwnProperty.call(row, 'phase_name')
        && Object.prototype.hasOwnProperty.call(row, 'last_activity_ts')
        && Object.prototype.hasOwnProperty.call(row, 'age_minutes')
        && Object.prototype.hasOwnProperty.call(row, 'conflict')
        && Array.isArray(row.degraded));
      check.assert('fleet_route_exposes_cache_age_header',
        response.headers['x-sgsd-cache-age-seconds'] === '0');
    });
  } finally {
    fixture.cleanup();
  }
}

async function caseCodexLiveAbsent(check) {
  var fixture = await createHttpFixture(readFixture('idle'));
  try {
    await withHttpServer(check, fixture, async function (address) {
      var response = await requestServer(address, '/api/lane/'
        + encodeURIComponent(fixture.laneName) + '/codex-live');
      check.assert('codex_live_absent_returns_clean_contract',
        response.statusCode === 200
        && response.body.ok === true
        && response.body.present === false
        && Object.keys(response.body).sort().join(',') === 'ok,present');
      check.assert('codex_live_absent_is_read_only_json',
        response.headers['content-type'] === 'application/json; charset=utf-8'
        && response.headers['cache-control'] === 'no-store');
    });
  } finally {
    fixture.cleanup();
  }
}

async function caseCodexLivePresent(check) {
  var fixture = await createHttpFixture(readFixture('running'));
  var metricsDir = path.join(fixture.root, fixture.laneName, '.planning', 'metrics');
  fs.mkdirSync(metricsDir, { recursive: true });
  var primary = path.join(metricsDir, 'codex-executor-live.txt');
  var fallback = path.join(metricsDir, 'codex-live-output.txt');
  fs.writeFileSync(primary, 'primary live line\n', 'utf8');
  fs.writeFileSync(fallback, 'fallback must not win\n', 'utf8');
  try {
    await withHttpServer(check, fixture, async function (address) {
      var response = await requestServer(address, '/api/lane/'
        + encodeURIComponent(fixture.laneName) + '/codex-live');
      check.assert('codex_live_present_prefers_executor_file',
        response.statusCode === 200
        && response.body.ok === true
        && response.body.present === true
        && response.body.source_file === 'codex-executor-live.txt'
        && response.body.text === 'primary live line\n');
      check.assert('codex_live_present_exposes_mtime_age',
        typeof response.body.mtime === 'string'
        && Number.isFinite(Date.parse(response.body.mtime))
        && typeof response.body.age_seconds === 'number'
        && response.body.age_seconds >= 0
        && response.body.truncated === false);
    });
  } finally {
    fixture.cleanup();
  }
}

async function caseCodexLiveTailBounded(check) {
  var fixture = await createHttpFixture(readFixture('running'));
  var metricsDir = path.join(fixture.root, fixture.laneName, '.planning', 'metrics');
  fs.mkdirSync(metricsDir, { recursive: true });
  var fallback = path.join(metricsDir, 'codex-live-output.txt');
  var prefix = 'discard-this-prefix\n';
  var tail = 'T'.repeat(16 * 1024);
  fs.writeFileSync(fallback, prefix + tail, 'utf8');
  try {
    await withHttpServer(check, fixture, async function (address) {
      var response = await requestServer(address, '/api/lane/'
        + encodeURIComponent(fixture.laneName) + '/codex-live');
      check.assert('codex_live_falls_back_to_legacy_file',
        response.statusCode === 200
        && response.body.present === true
        && response.body.source_file === 'codex-live-output.txt');
      check.assert('codex_live_tail_is_last_16kb_exactly',
        Buffer.byteLength(response.body.text, 'utf8') === 16 * 1024
        && response.body.text === tail
        && response.body.text.indexOf(prefix) === -1
        && response.body.truncated === true);
    });
  } finally {
    fixture.cleanup();
  }
}

async function caseSseStream(check) {
  var fixture = await createHttpFixture(readFixture('running'));
  var metricsDir = path.join(fixture.root, fixture.laneName, '.planning', 'metrics');
  fs.mkdirSync(metricsDir, { recursive: true });
  var primary = path.join(metricsDir, 'codex-executor-live.txt');
  var fallback = path.join(metricsDir, 'codex-live-output.txt');
  var initialTail = 'I'.repeat(16 * 1024);
  fs.writeFileSync(primary, 'discarded prefix\n' + initialTail, 'utf8');
  var audit = installWatcherAudit();
  var streams = [];
  try {
    await withHttpServer(check, fixture, async function (address) {
      var streamPath = '/api/lane/' + encodeURIComponent(fixture.laneName)
        + '/codex-live/stream';
      try {
        var first = await openSseStream(address, streamPath);
        var second = await openSseStream(address, streamPath);
        streams.push(first, second);
        check.assert('sse_stream_holds_open_with_required_headers',
          first.statusCode === 200
          && /^text\/event-stream(?:;|$)/.test(first.headers['content-type'] || '')
          && first.headers['cache-control'] === 'no-cache'
          && first.headers.connection === 'keep-alive');
        var serverSource = fs.readFileSync(
          path.join(__dirname, 'server.cjs'), 'utf8');
        check.assert('sse_stream_has_exact_15s_comment_heartbeat',
          /CODEX_LIVE_HEARTBEAT_MS\s*=\s*15\s*\*\s*1000/.test(serverSource)
          && serverSource.indexOf(': heartbeat\\n\\n') !== -1);

        var initial = await Promise.all([
          first.nextEvent(3000), second.nextEvent(3000)
        ]);
        check.assert('sse_stream_connect_sends_current_tail',
          initial.every(function (event) {
            return event.ok === true && event.present === true
              && event.reset === true
              && event.source_file === 'codex-executor-live.txt'
              && event.text === initialTail
              && event.truncated === true;
          }));
        var bothSubscriberWatchers = audit.activeCount();
        check.assert('sse_stream_multiple_subscribers_have_independent_watchers',
          bothSubscriberWatchers >= 2);

        fs.appendFileSync(primary, 'first delta\n', 'utf8');
        var deltas = await Promise.all([
          first.nextEvent(3000), second.nextEvent(3000)
        ]);
        check.assert('sse_stream_growth_pushes_only_appended_bytes',
          deltas.every(function (event) {
            return event.ok === true && event.present === true
              && event.reset === false
              && event.source_file === 'codex-executor-live.txt'
              && event.text === 'first delta\n';
          }));

        first.close();
        streams.shift();
        await waitForCondition(function () {
          return audit.activeCount() < bothSubscriberWatchers;
        }, 3000);
        check.assert('sse_stream_disconnect_frees_only_its_watchers',
          audit.activeCount() > 0);
        fs.appendFileSync(primary, 'second delta\n', 'utf8');
        var survivingDelta = await second.nextEvent(3000);
        check.assert('sse_stream_other_subscriber_survives_disconnect',
          survivingDelta.reset === false
          && survivingDelta.text === 'second delta\n');

        fs.writeFileSync(primary, 'truncated tail\n', 'utf8');
        var truncationEvent = await second.nextEvent(3000);
        check.assert('sse_stream_truncation_resends_tail',
          truncationEvent.present === true
          && truncationEvent.reset === true
          && truncationEvent.text === 'truncated tail\n');

        var rotated = primary + '.rotated';
        fs.renameSync(primary, rotated);
        fs.writeFileSync(primary, 'rotated tail\n', 'utf8');
        var rotationEvent = await second.nextEvent(3000);
        check.assert('sse_stream_rotation_resends_tail',
          rotationEvent.present === true
          && rotationEvent.reset === true
          && rotationEvent.text === 'rotated tail\n');

        second.close();
        streams.shift();
        await waitForCondition(function () {
          return audit.activeCount() === 0;
        }, 3000);
        check.assert('sse_stream_disconnect_frees_all_watchers',
          audit.activeCount() === 0);

        fs.unlinkSync(primary);
        var absent = await openSseStream(address, streamPath);
        streams.push(absent);
        var absentEvent = await absent.nextEvent(3000);
        check.assert('sse_stream_absent_file_stays_connected',
          absentEvent.ok === true && absentEvent.present === false
          && absentEvent.reset === true);
        fs.writeFileSync(fallback, 'created output\n', 'utf8');
        var creationEvent = await absent.nextEvent(4000);
        check.assert('sse_stream_creation_pushes_new_tail',
          creationEvent.ok === true && creationEvent.present === true
          && creationEvent.reset === true
          && creationEvent.source_file === 'codex-live-output.txt'
          && creationEvent.text === 'created output\n');
        absent.close();
        streams.shift();
        await waitForCondition(function () {
          return audit.activeCount() === 0;
        }, 3000);
      } finally {
        streams.forEach(function (stream) { stream.close(); });
        streams = [];
      }
    });
  } finally {
    audit.forceCleanup();
    audit.restore();
    fixture.cleanup();
  }
}

async function caseDeltasAcrossRebuilds(check) {
  var moduleValue = requireServerModule(check);
  var root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd fleet sse rebuild '));
  var lanes = [];
  for (var i = 0; i < 7; i++) {
    var lanePath = path.join(root, 'lane-' + String(i + 1));
    fs.mkdirSync(path.join(lanePath, '.planning'), { recursive: true });
    lanes.push({ path: lanePath, branch: 'lane-' + String(i + 1) });
  }
  var metricsDir = path.join(lanes[0].path, '.planning', 'metrics');
  fs.mkdirSync(metricsDir, { recursive: true });
  var primary = path.join(metricsDir, 'codex-executor-live.txt');
  var initialTail = 'I'.repeat(16 * 1024);
  fs.writeFileSync(primary, initialTail, 'utf8');

  var snapshot = readFixture('running');
  var buildCalls = 0;
  function slowSynchronousBuild() {
    buildCalls++;
    var deadline = Date.now() + 225;
    while (Date.now() < deadline) {
      // Model the synchronous production adapter without adding a dependency.
    }
    return copy(snapshot);
  }
  var hasYieldingBuilder = typeof moduleValue.createYieldingSnapshotBuilder === 'function';
  var buildSnapshot = hasYieldingBuilder
    ? moduleValue.createYieldingSnapshotBuilder(slowSynchronousBuild)
    : slowSynchronousBuild;
  var cache = fleet.createFleetCache({
    buildSnapshot: buildSnapshot,
    deriveLaneStatus: fixtureDerivation,
    intervalMs: 60 * 1000,
    concurrency: 4
  });
  cache.acceptDiscovery(makePorcelain(lanes));
  await cache.refreshNow();
  await new Promise(function (resolve) { setTimeout(resolve, 0); });

  var fixture = {
    root: root,
    cache: cache,
    cleanup: function () {
      cache.stop();
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
  var agent = new http.Agent({ keepAlive: true, maxSockets: 6 });
  var stream = null;
  var maxLagMs = 0;
  var deltaLatencies = [];
  var fleetResponses = [];
  var address = null;

  async function overlapRebuild(marker) {
    var append = spawnDelayedAppend(primary, marker, 75);
    await append.ready;
    var streamEvent = stream.nextEvent(5000).then(function (event) {
      return { event: event, receivedAt: Date.now() };
    });
    var probeIntervalMs = 20;
    var lastProbeMs = Date.now();
    var probe = setInterval(function () {
      var currentMs = Date.now();
      maxLagMs = Math.max(maxLagMs,
        Math.max(0, currentMs - lastProbeMs - probeIntervalMs));
      lastProbeMs = currentMs;
    }, probeIntervalMs);
    var polls = [];
    for (var poll = 0; poll < 8; poll++) {
      polls.push(requestServer(address, '/api/fleet', 'GET', {}, agent));
    }
    var rebuild = cache.refreshNow().finally(function () { clearInterval(probe); });
    var received = await streamEvent;
    var completed = await Promise.all([append.completion, rebuild].concat(polls));
    Array.prototype.push.apply(fleetResponses, completed.slice(2));
    var appendedAt = Number(received.event.text.slice(marker.length).trim());
    check.assert('sse_rebuild_' + marker + '_delivers_exact_delta',
      received.event.reset === false
      && received.event.text.indexOf(marker) === 0
      && Number.isFinite(appendedAt));
    deltaLatencies.push(received.receivedAt - appendedAt);
  }

  try {
    await withHttpServer(check, fixture, async function (addressValue) {
      address = addressValue;
      var streamPath = '/api/lane/lane-1/codex-live/stream';
      stream = await openSseStream(address, streamPath, agent);
      try {
        var initial = await stream.nextEvent(3000);
        check.assert('sse_rebuild_client_holds_one_http_get_connection',
          initial.reset === true && initial.text === initialTail
          && agent.maxSockets === 6);
        await overlapRebuild('delta-one:');
        await overlapRebuild('delta-two:');
      } finally {
        stream.close();
        stream = null;
        agent.destroy();
      }
    });
  } finally {
    if (stream !== null) stream.close();
    agent.destroy();
    fixture.cleanup();
  }

  check.assert('sse_rebuild_runs_two_complete_seven_lane_cycles',
    buildCalls >= 21, 'builds=' + buildCalls);
  check.assert('sse_rebuild_concurrent_keep_alive_fleet_fetches_complete',
    fleetResponses.length === 16 && fleetResponses.every(function (response) {
      return response.statusCode === 200 && response.body && response.body.ok === true;
    }));
  check.assert('sse_rebuild_each_delta_arrives_within_1s',
    deltaLatencies.length === 2 && deltaLatencies.every(function (latency) {
      return latency >= 0 && latency < 1000;
    }), 'latencies_ms=' + deltaLatencies.join(','));
  check.assert('sse_rebuild_event_loop_stall_stays_below_500ms',
    maxLagMs < 500, 'max_lag_ms=' + maxLagMs);
  check.assert('sse_rebuild_uses_yielding_production_builder',
    hasYieldingBuilder
    && /buildSnapshot:\s*createYieldingSnapshotBuilder\(/.test(
      moduleValue.main.toString()));
}

async function caseReadOnlyMethods(check) {
  var fixture = await createHttpFixture(readFixture('idle'));
  try {
    await withHttpServer(check, fixture, async function (address) {
      var verbs = ['POST', 'PUT', 'PATCH', 'DELETE'];
      for (var i = 0; i < verbs.length; i++) {
        var response = await requestServer(address, '/api/fleet', verbs[i]);
        check.assert(verbs[i].toLowerCase() + '_rejected_before_routing',
          response.statusCode === 405
          && response.headers.allow === 'GET'
          && response.body.error_code === 'method_not_allowed');
        check.assert(verbs[i].toLowerCase() + '_error_has_no_stack',
          !Object.prototype.hasOwnProperty.call(response.body, 'stack'));
        check.assert(verbs[i].toLowerCase() + '_has_cache_age_header',
          response.headers['x-sgsd-cache-age-seconds'] === '0');
      }
    });
  } finally {
    fixture.cleanup();
  }
}

async function caseVerbatimSnapshot(check) {
  var snapshot = readFixture('projection-conflict');
  var expectedBytes = JSON.stringify(snapshot);
  var fixture = await createHttpFixture(snapshot, {
    deriveLaneStatus: status.deriveLaneStatus
  });
  try {
    await withHttpServer(check, fixture, async function (address) {
      var encoded = encodeURIComponent(fixture.laneName);
      var detail = await requestServer(address, '/api/lane/' + encoded);
      var raw = await requestServer(address, '/api/lane/' + encoded + '/raw');
      check.assert('detail_snapshot_is_byte_equal_to_adapter_value',
        JSON.stringify(detail.body.snapshot) === expectedBytes);
      check.assert('derived_metadata_is_beside_snapshot',
        detail.body.conflict === true
        && detail.body.objective_conflict
        && detail.body.snapshot.data.objective.projection_stale === true);
      check.assert('raw_route_is_only_adapter_envelope', raw.text === expectedBytes);
      check.assert('raw_route_exposes_age_only_in_header',
        raw.headers['x-sgsd-cache-age-seconds'] === '0'
        && !Object.prototype.hasOwnProperty.call(raw.body, 'cache_age_seconds'));
    });
  } finally {
    fixture.cleanup();
  }
}

async function caseHealthzShape(check) {
  var fixture = await createHttpFixture(readFixture('idle'), {
    includeSkipped: true
  });
  try {
    await withHttpServer(check, fixture, async function (address) {
      var response = await requestServer(address, '/healthz');
      var body = response.body;
      check.assert('healthz_returns_required_shape', response.statusCode === 200
        && body.ok === true
        && body.lanes === 1
        && body.cache_age_seconds === 0
        && typeof body.build_ms_last === 'number'
        && Array.isArray(body.skipped_lanes));
      check.assert('healthz_reports_skipped_lane', body.skipped_lanes.length === 1
        && body.skipped_lanes[0].name === 'lane-skipped'
        && body.skipped_lanes[0].reason === 'planning_dir_missing');
      check.assert('healthz_exposes_diagnostics_without_stack',
        Object.prototype.hasOwnProperty.call(body, 'last_discovery_error')
        && Array.isArray(body.last_build_diagnostics)
        && JSON.stringify(body).indexOf('stack') === -1);
      check.assert('healthz_has_cache_age_header',
        response.headers['x-sgsd-cache-age-seconds'] === '0');
    });
  } finally {
    fixture.cleanup();
  }
}

async function caseErrorShape(check) {
  var fixture = await createHttpFixture(readFixture('idle'));
  try {
    await withHttpServer(check, fixture, async function (address) {
      var unknown = await requestServer(address, '/api/lane/not-a-lane');
      var traversal = await requestServer(address,
        '/api/lane/%2E%2E%5Cprivate');
      [unknown, traversal].forEach(function (response, index) {
        check.assert('unknown_or_traversal_' + index + '_is_clean_404',
          response.statusCode === 404
          && response.body.ok === false
          && response.body.error_code === 'lane_not_found');
        check.assert('unknown_or_traversal_' + index + '_hides_path_and_stack',
          !Object.prototype.hasOwnProperty.call(response.body, 'path')
          && !Object.prototype.hasOwnProperty.call(response.body, 'stack'));
        check.assert('unknown_or_traversal_' + index + '_has_cache_age_header',
          response.headers['x-sgsd-cache-age-seconds'] === '0');
      });
    });

    var failedFixture = await createHttpFixture(readFixture('idle'), {
      buildSnapshot: function () { throw new Error('lane build fixture'); }
    });
    try {
      await withHttpServer(check, failedFixture, async function (address) {
        var fleetResponse = await requestServer(address, '/api/fleet');
        var detailResponse = await requestServer(address,
          '/api/lane/' + failedFixture.laneName);
        var rawResponse = await requestServer(address,
          '/api/lane/' + failedFixture.laneName + '/raw');
        check.assert('failed_build_remains_lane_local_error_row',
          fleetResponse.statusCode === 200
          && fleetResponse.body.lanes[0].status === 'error'
          && fleetResponse.body.lanes[0].error_code === 'snapshot_build_failed');
        check.assert('failed_build_detail_is_clean_error',
          detailResponse.statusCode === 200
          && detailResponse.body.ok === false
          && detailResponse.body.status === 'error'
          && detailResponse.body.snapshot === null
          && !Object.prototype.hasOwnProperty.call(detailResponse.body, 'stack'));
        check.assert('failed_build_raw_is_unavailable_without_stack',
          rawResponse.statusCode === 503
          && rawResponse.body.error_code === 'snapshot_unavailable'
          && !Object.prototype.hasOwnProperty.call(rawResponse.body, 'stack'));
      });
    } finally {
      failedFixture.cleanup();
    }

    var unavailableSnapshot = readFixture('build-error');
    var unavailableFixture = await createHttpFixture(unavailableSnapshot, {
      deriveLaneStatus: status.deriveLaneStatus
    });
    try {
      await withHttpServer(check, unavailableFixture, async function (address) {
        var fleetResponse = await requestServer(address, '/api/fleet');
        var detailResponse = await requestServer(address,
          '/api/lane/' + unavailableFixture.laneName);
        var rawResponse = await requestServer(address,
          '/api/lane/' + unavailableFixture.laneName + '/raw');
        check.assert('adapter_error_envelope_has_distinct_machine_code',
          fleetResponse.body.lanes[0].status === 'error'
          && fleetResponse.body.lanes[0].error_code === 'snapshot_unavailable');
        check.assert('adapter_error_envelope_stays_verbatim_on_detail_and_raw',
          JSON.stringify(detailResponse.body.snapshot)
            === JSON.stringify(unavailableSnapshot)
          && rawResponse.text === JSON.stringify(unavailableSnapshot));
      });
    } finally {
      unavailableFixture.cleanup();
    }

    var moduleValue = requireServerModule(check);
    var crashingCache = {
      getFleet: function () { throw new Error('sensitive fixture path'); },
      getLane: function () { return null; },
      getRawLane: function () { return null; },
      getHealth: function () { return { cache_age_seconds: 7 }; }
    };
    var crashingServer = moduleValue.createFleetServer({
      cache: crashingCache,
      root: fixture.root
    });
    try {
      var address = await listenServer(crashingServer, '127.0.0.1');
      var internal = await requestServer(address, '/api/fleet');
      check.assert('internal_error_is_stable_and_has_no_stack',
        internal.statusCode === 500
        && internal.body.error_code === 'internal_error'
        && internal.body.error === 'internal error'
        && JSON.stringify(internal.body).indexOf('sensitive fixture path') === -1
        && !Object.prototype.hasOwnProperty.call(internal.body, 'stack'));
    } finally {
      await closeServer(crashingServer);
    }
  } finally {
    fixture.cleanup();
  }
}

async function caseStructuralLoadSafety(check) {
  var root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd fleet load '));
  var lanes = [];
  var buildCalls = 0;
  var active = 0;
  var maxActive = 0;
  for (var i = 0; i < 8; i++) {
    var lanePath = path.join(root, 'lane-' + String(i).padStart(2, '0'));
    fs.mkdirSync(path.join(lanePath, '.planning'), { recursive: true });
    lanes.push({ path: lanePath, branch: 'load-' + i });
  }
  var cache = fleet.createFleetCache({
    buildSnapshot: async function () {
      buildCalls++;
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(function (resolve) { setTimeout(resolve, 5); });
      active--;
      return copy(readFixture('running'));
    },
    deriveLaneStatus: fixtureDerivation,
    now: function () { return Date.parse('2026-08-20T18:19:31.052Z'); }
  });
  cache.acceptDiscovery(makePorcelain(lanes));
  var firstRefresh = cache.refreshNow();
  var coalescedRefresh = cache.refreshNow();
  check.assert('overlapping_refreshes_coalesce', firstRefresh === coalescedRefresh);
  await Promise.all([firstRefresh, coalescedRefresh]);
  await new Promise(function (resolve) { setTimeout(resolve, 0); });

  var fixture = { root: root, cache: cache };
  try {
    await withHttpServer(check, fixture, async function (address) {
      var beforeBurst = buildCalls;
      var requestPaths = [
        '/api/fleet', '/healthz', '/api/lane/lane-00',
        '/api/lane/lane-00/raw'
      ];
      var burst = [];
      for (var requestIndex = 0; requestIndex < 40; requestIndex++) {
        burst.push(requestServer(address,
          requestPaths[requestIndex % requestPaths.length]));
      }
      var responses = await Promise.all(burst);
      check.assert('request_burst_all_returns_without_building',
        responses.every(function (response) { return response.statusCode === 200; })
        && buildCalls === beforeBurst);
      check.assert('bounded_builder_reaches_four_and_never_exceeds_it',
        maxActive === 4);
      var health = cache.getHealth();
      check.assert('cache_defaults_are_interval_20_concurrency_4',
        health.interval_ms === 20000 && health.concurrency === 4);
      var handlerSource = serverModule.createFleetServer.toString();
      check.assert('request_handler_has_no_refresh_or_build_edge',
        !/(refreshNow|acceptDiscovery|buildSnapshot)/.test(handlerSource));
    });
  } finally {
    cache.stop();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function isAsciiFile(file) {
  var bytes = fs.readFileSync(file);
  for (var i = 0; i < bytes.length; i++) {
    if (bytes[i] > 127) return false;
  }
  return true;
}

async function caseSourceConstraints(check) {
  var toolDir = __dirname;
  var serverFile = path.join(toolDir, 'server.cjs');
  var fleetFile = path.join(toolDir, 'fleet.cjs');
  var statusFile = path.join(toolDir, 'status.cjs');
  var wrapperFile = path.join(toolDir, '..', '..', 'scripts', 'sgsd-fleet.sh');
  var docsFile = path.join(toolDir, '..', '..', 'docs', 'FLEET-COCKPIT.md');
  var requiredFiles = [serverFile, wrapperFile, docsFile];
  check.assert('t3_files_exist', requiredFiles.every(function (file) {
    return fs.existsSync(file);
  }));
  check.assert('new_files_are_ascii', requiredFiles.every(isAsciiFile));
  check.assert('production_javascript_is_cjs', path.extname(serverFile) === '.cjs'
    && path.extname(fleetFile) === '.cjs'
    && path.extname(statusFile) === '.cjs');

  var allowed = { 'node:http': true, 'node:fs': true, 'node:path': true };
  [serverFile, fleetFile, statusFile].forEach(function (file) {
    var source = fs.readFileSync(file, 'utf8');
    var requirePattern = /require\(['\x22]([^'\x22]+)['\x22]\)/g;
    var match;
    while ((match = requirePattern.exec(source)) !== null) {
      check.assert('runtime_require_allowed_' + path.basename(file) + '_'
        + match[1].replace(/[^a-z0-9]/gi, '_'),
      match[1].indexOf('.') === 0 || allowed[match[1]] === true
        || (file === serverFile && match[1] === 'node:child_process'),
      'require=' + match[1]);
    }
  });

  var serverSource = fs.readFileSync(serverFile, 'utf8');
  var processCalls = serverSource.match(
    /\bchildProcess\.(?:exec|execFile|spawn|fork)(?:Sync)?\s*\(/g) || [];
  check.assert('production_git_adapter_is_bounded_read_only_exec_file',
    processCalls.length === 1
    && processCalls[0] === 'childProcess.execFileSync('
    && /execFileSync\('git'/.test(serverSource)
    && /'-C', root, 'worktree', 'list', '--porcelain'/.test(serverSource)
    && /timeout:\s*GIT_DISCOVERY_TIMEOUT_MS/.test(serverSource)
    && /stdio:\s*\['ignore', 'pipe', 'pipe'\]/.test(serverSource));
  var runtimeSource = serverSource + '\n'
    + fs.readFileSync(fleetFile, 'utf8') + '\n'
    + fs.readFileSync(statusFile, 'utf8');
  check.assert('production_runtime_has_no_mutating_fs_call',
    !/\b(writeFile|appendFile|unlink|rm|mkdir|rename|copyFile)(Sync)?\s*\(/.test(
      runtimeSource));
  check.assert('production_server_has_no_mutating_method_branch',
    !/req\.method\s*===\s*['\x22](POST|PUT|PATCH|DELETE)['\x22]/.test(
      serverSource));
  check.assert('production_runtime_has_no_framework_or_package_import',
    !/require\(['\x22](express|fastify|koa|hapi|next|react|axios)['\x22]\)/.test(
      runtimeSource));
  check.assert('framed_mode_disables_internal_timer',
    /SGSD_FLEET_FRAMED_STDIN/.test(serverSource)
    && /if \(framed\).*attachFramedInput/.test(serverSource)
    && /else cache\.start\(\)/.test(serverSource));

  var adapterResult = adapterSelfTestInProcess();
  check.assert('untouched_adapter_reports_exact_19_of_19',
    adapterResult.ok === true
    && adapterResult.results.length === 19
    && adapterResult.results.every(function (row) { return row.ok; }));
}

async function caseWrapperContract(check) {
  var wrapperFile = path.join(__dirname, '..', '..', 'scripts', 'sgsd-fleet.sh');
  var docsFile = path.join(__dirname, '..', '..', 'docs', 'FLEET-COCKPIT.md');
  check.assert('wrapper_exists', fs.existsSync(wrapperFile));
  check.assert('operator_docs_exist', fs.existsSync(docsFile));
  var wrapper = fs.readFileSync(wrapperFile, 'utf8');
  var docs = fs.readFileSync(docsFile, 'utf8');
  check.assert('wrapper_uses_bash_pipefail_and_script_dir',
    wrapper.indexOf('#!/usr/bin/env bash') === 0
    && wrapper.indexOf('set -o pipefail') !== -1
    && wrapper.indexOf('SCRIPT_DIR=') !== -1);
  check.assert('wrapper_keeps_state_below_cache_home',
    wrapper.indexOf('${XDG_CACHE_HOME:-$HOME/.cache}/super-gsd/fleet-cockpit') !== -1);
  check.assert('wrapper_has_idempotent_lifecycle',
    /start\|stop\|status/.test(wrapper)
    && wrapper.indexOf('kill -0') !== -1
    && wrapper.indexOf('PID_FILE') !== -1);
  check.assert('wrapper_validates_project_and_git',
    wrapper.indexOf('/.planning') !== -1
    && wrapper.indexOf('git -C') !== -1
    && wrapper.indexOf('rev-parse') !== -1);
  check.assert('wrapper_feeds_exact_framed_porcelain',
    wrapper.indexOf('worktree list --porcelain') !== -1
    && wrapper.indexOf('SGSD_FLEET_FRAME_BEGIN') !== -1
    && wrapper.indexOf('SGSD_FLEET_FRAME_END') !== -1
    && wrapper.indexOf('SGSD_FLEET_FRAMED_STDIN=1') !== -1);
  check.assert('wrapper_preserves_porcelain_bytes_without_command_substitution',
    /git -C \x22\$project_dir\x22 worktree list --porcelain >\x22\$porcelain_file\x22/.test(
      wrapper)
    && /cat \x22\$porcelain_file\x22/.test(wrapper)
    && !/porcelain=\x22\$\(git/.test(wrapper));
  check.assert('wrapper_forwards_bind_flags_and_warns_for_lan',
    wrapper.indexOf('--host') !== -1
    && wrapper.indexOf('--port') !== -1
    && wrapper.indexOf('--interval') !== -1
    && wrapper.indexOf('0.0.0.0') !== -1
    && /warning/i.test(wrapper));
  check.assert('docs_cover_required_operator_contract',
    docs.indexOf('127.0.0.1') !== -1
    && docs.indexOf('--host 0.0.0.0') !== -1
    && docs.indexOf('cache_age_seconds') !== -1
    && docs.indexOf('X-SGSD-Cache-Age-Seconds') !== -1
    && docs.indexOf('/api/lane/:name/raw') !== -1
    && docs.indexOf('attention > running > stale > idle') !== -1
    && docs.indexOf('devcp') !== -1);
}

async function caseFixtureGitDiscovery(check) {
  var fixture = createGitFixture(7, { detachedIndex: 5, missingPlanningIndex: 6 });
  var timers = makeTimers();
  try {
    var parsed = fleet.parseWorktreePorcelain(fixture.porcelain);
    check.assert('porcelain_has_every_git_lane', parsed.lanes.length === 7);
    check.assert('porcelain_preserves_space_path', parsed.lanes.some(function (lane) {
      return lane.path.indexOf(' ') !== -1;
    }));
    check.assert('porcelain_strips_only_heads_prefix', parsed.lanes.some(function (lane) {
      return lane.branch === 'fixture-lane-01';
    }));
    check.assert('porcelain_retains_detached_lane', parsed.lanes.some(function (lane) {
      return lane.branch === null;
    }));

    var failedName = fixture.lanes[2].name;
    var cache = fleet.createFleetCache({
      buildSnapshot: function (opts) {
        if (path.basename(opts.projectDir) === failedName) {
          return Promise.reject(new Error('injected fixture failure'));
        }
        return copy(readFixture('idle'));
      },
      deriveLaneStatus: fixtureDerivation,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout
    });
    var accepted = cache.acceptDiscovery(fixture.porcelain);
    check.assert('discovery_accepts_exact_git_frame', accepted.ok === true);
    await cache.refreshNow();
    var rollup = cache.getFleet();
    check.assert('missing_planning_skipped', rollup.lanes.length === 6);
    check.assert('builder_failure_is_error_row', rollup.lanes.some(function (lane) {
      return lane.name === failedName && lane.status === 'error'
        && lane.error_code === 'snapshot_build_failed';
    }));
    check.assert('skipped_lane_reported', cache.getHealth().skipped_lanes.some(function (lane) {
      return lane.name === fixture.lanes[6].name;
    }));
  } finally {
    fixture.cleanup();
  }
}

async function caseProductionDiscovery(check) {
  var moduleValue = requireServerModule(check);
  var fixture = createGitFixture(2);
  var probe = http.createServer();
  var runtime = null;
  var priorSigint = process.listeners('SIGINT');
  var priorSigterm = process.listeners('SIGTERM');
  try {
    var probeAddress = await listenServer(probe, '127.0.0.1', 0);
    var port = probeAddress.port;
    await closeServer(probe);

    runtime = moduleValue.main([
      '--root', fixture.checkout,
      '--host', '127.0.0.1',
      '--port', String(port),
      '--interval', '60'
    ]);
    var address = runtime.server.listening
      ? runtime.server.address()
      : await new Promise(function (resolve, reject) {
        runtime.server.once('error', reject);
        runtime.server.once('listening', function () {
          runtime.server.removeListener('error', reject);
          resolve(runtime.server.address());
        });
      });
    await runtime.cache.refreshNow();

    var expected = fleet.parseWorktreePorcelain(fixture.porcelain).lanes;
    var health = await requestServer(address, '/healthz');
    var rollup = await requestServer(address, '/api/fleet');
    var actualNames = rollup.body && Array.isArray(rollup.body.lanes)
      ? rollup.body.lanes.map(function (lane) { return lane.name; }).sort() : [];
    var expectedNames = expected.map(function (lane) { return lane.name; }).sort();
    check.assert('production_discovery_health_matches_real_git',
      health.statusCode === 200
      && health.body.discovered_lanes === expected.length,
      'discovered=' + (health.body && health.body.discovered_lanes)
        + ' expected=' + expected.length);
    check.assert('production_discovery_lanes_reach_fleet_api',
      rollup.statusCode === 200
      && JSON.stringify(actualNames) === JSON.stringify(expectedNames),
      'actual=' + actualNames.join(',') + ' expected=' + expectedNames.join(','));
  } finally {
    if (probe.listening) await closeServer(probe);
    if (runtime) {
      runtime.cache.stop();
      await closeServer(runtime.server);
    }
    process.listeners('SIGINT').forEach(function (listener) {
      if (priorSigint.indexOf(listener) === -1) process.removeListener('SIGINT', listener);
    });
    process.listeners('SIGTERM').forEach(function (listener) {
      if (priorSigterm.indexOf(listener) === -1) process.removeListener('SIGTERM', listener);
    });
    fixture.cleanup();
  }
}

async function caseDiscoveryFrameSourceFailure(check) {
  var calls = 0;
  var cache = fleet.createFleetCache({
    discoveryFrameSource: function () {
      calls++;
      throw new Error('fatal: fixture git discovery failed');
    }
  });
  await cache.refreshNow();
  var firstHealth = cache.getHealth();
  check.assert('discovery_frame_source_called_on_first_cycle', calls === 1);
  check.assert('discovery_frame_source_failure_does_not_reject_refresh',
    firstHealth.discovered_lanes === 0);
  check.assert('discovery_frame_source_failure_reaches_health',
    firstHealth.last_discovery_error
      && firstHealth.last_discovery_error.error_code === 'worktree_discovery_failed'
      && firstHealth.last_discovery_error.error.indexOf(
        'fatal: fixture git discovery failed') !== -1);

  await cache.refreshNow();
  check.assert('discovery_frame_source_called_each_cache_cycle', calls === 2);
}

async function caseFleetCacheScheduler(check) {
  var fixture = createSyntheticDiscovery(8);
  var timers = makeTimers();
  var pending = [];
  var active = 0;
  var maxActive = 0;
  var buildCount = 0;
  try {
    var cache = fleet.createFleetCache({
      buildSnapshot: function () {
        buildCount++;
        active++;
        maxActive = Math.max(maxActive, active);
        return new Promise(function (resolve) {
          pending.push(function () {
            active--;
            resolve(copy(readFixture('running')));
          });
        });
      },
      deriveLaneStatus: fixtureDerivation,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout,
      intervalMs: 20000,
      concurrency: 99
    });
    cache.acceptDiscovery(fixture.porcelain);
    cache.getFleet();
    cache.getHealth();
    check.assert('getters_never_build', buildCount === 0);
    cache.start();
    check.assert('start_schedules_before_build', buildCount === 0 && timers.size() === 1);
    var scheduledCycle = timers.runNext();
    await pump();
    var coalesced = cache.refreshNow();
    var resolved = 0;
    while (resolved < 8) {
      await pump();
      var batch = pending.splice(0);
      check.assert('worker_batch_bounded', batch.length <= 4);
      resolved += batch.length;
      batch.forEach(function (release) { release(); });
    }
    await Promise.all([scheduledCycle, coalesced]);
    check.assert('concurrency_reaches_four', maxActive === 4, 'max=' + maxActive);
    check.assert('coalesced_refresh_builds_once', buildCount === 8, 'builds=' + buildCount);
    check.assert('rollup_published_for_all_lanes', cache.getFleet().lanes.length === 8);
    check.assert('details_wait_for_next_turn', cache.getLane(fixture.lanes[0].name).snapshot === null);
    await timers.runNext();
    check.assert('details_publish_on_next_turn', !!cache.getRawLane(fixture.lanes[0].name));
    cache.stop();
  } finally {
    fixture.cleanup();
  }
}

async function caseLaneFailureIsolation(check) {
  var fixture = createGitFixture(60);
  var timers = makeTimers();
  var failedName = fixture.lanes[2].name;
  var removed = fixture.lanes[3];
  try {
    var cache = fleet.createFleetCache({
      buildSnapshot: function (opts) {
        if (path.basename(opts.projectDir) === failedName) {
          throw new Error('isolated failure');
        }
        return copy(readFixture('idle'));
      },
      deriveLaneStatus: fixtureDerivation,
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout
    });
    cache.acceptDiscovery(fixture.porcelain);
    await cache.refreshNow();
    check.assert('first_cycle_keeps_sixty_rows', cache.getFleet().lanes.length === 60);
    fs.rmSync(path.join(removed.path, '.planning'), { recursive: true, force: true });
    await cache.refreshNow();
    var second = cache.getFleet();
    check.assert('removed_planning_leaves_other_fifty_nine', second.lanes.length === 59);
    check.assert('failed_lane_does_not_poison_fleet', second.lanes.some(function (lane) {
      return lane.name === failedName && lane.status === 'error';
    }) && second.lanes.filter(function (lane) { return lane.status !== 'error'; }).length === 58);
    check.assert('removed_lane_named_in_health', cache.getHealth().skipped_lanes.some(function (lane) {
      return lane.name === removed.name;
    }));
  } finally {
    fixture.cleanup();
  }
}

async function caseRollupFirstPublish(check) {
  var fixture = createSyntheticDiscovery(4);
  var timers = makeTimers();
  var captured = readFixture('attention');
  var before = JSON.stringify(captured);
  try {
    var cache = fleet.createFleetCache({
      buildSnapshot: function () { return captured; },
      deriveLaneStatus: fixtureDerivation,
      now: function () { return 100000; },
      setTimeout: timers.setTimeout,
      clearTimeout: timers.clearTimeout
    });
    cache.acceptDiscovery(fixture.porcelain);
    await cache.refreshNow();
    var fleetView = cache.getFleet();
    check.assert('all_rollups_publish_atomically', fleetView.lanes.length === 4
      && fleetView.lanes.every(function (lane) { return lane.status === 'attention'; }));
    check.assert('cache_age_is_clock_derived', fleetView.cache_age_seconds === 0);
    check.assert('detail_absent_before_timer_turn', cache.getRawLane(fixture.lanes[0].name) === null);
    check.assert('derived_detail_publishes_with_rollup',
      cache.getLane(fixture.lanes[0].name).agents.state === 'fixture-detail');
    await timers.runNext();
    var raw = cache.getRawLane(fixture.lanes[0].name);
    check.assert('snapshot_publishes_verbatim', JSON.stringify(raw) === before);
    raw.data.now.action = 'mutated by caller';
    check.assert('snapshot_getter_is_defensive', JSON.stringify(cache.getRawLane(
      fixture.lanes[0].name)) === before);
    check.assert('captured_snapshot_not_mutated', JSON.stringify(captured) === before);
  } finally {
    fixture.cleanup();
  }
}

async function caseNoiseAgentTools(check) {
  var derived = deriveFixture(check, 'noise-agent-tools');
  var names = derived.agents.roster.map(function (row) { return row.agent; });
  check.assert('noise_agent_tools_filtered',
    JSON.stringify(names) === JSON.stringify(['gsd-executor', 'custom-worker']),
    'agents=' + names.join(','));
  check.assert('noise_agent_tools_by_phase_filtered',
    derived.agents.by_phase.unknown.length === 2);
  check.assert('noise_agent_tools_do_not_create_running',
    derived.status === 'idle' && derived.reasons[0] === 'idle_no_signal');
}

async function caseNoiseTokensAbsent(check) {
  var derived = deriveFixture(check, 'noise-tokens-absent');
  check.assert('tokens_absent_is_no_data', derived.tokens.state === 'no_data');
  check.assert('tokens_absent_value_is_null', derived.tokens.value === null);
  check.assert('tokens_absent_reason_is_machine_code',
    derived.tokens.reason === 'tokens_source_absent');
}

async function caseNoiseGatesEmpty(check) {
  var derived = deriveFixture(check, 'noise-gates-empty');
  check.assert('empty_gates_are_no_data', derived.gates.state === 'no_data');
  check.assert('empty_gates_reason_is_no_gate_data',
    derived.gates.reason === 'no_gate_data');
  check.assert('empty_gates_never_claim_passed',
    derived.gates.state !== 'passed' && derived.gates.reason !== 'all_passed');
}

async function caseNoiseArtifactsSource(check) {
  var derived = deriveFixture(check, 'noise-artifacts-source');
  check.assert('missing_phases_dir_is_no_data',
    derived.artifacts.state === 'no_data');
  check.assert('missing_phases_dir_reason_preserved',
    derived.artifacts.reason === 'phases_dir_missing');
  check.assert('missing_phases_dir_not_empty_success',
    derived.artifacts.state !== 'data');
  check.assert('adapter_artifact_phases_field_is_preserved',
    Array.isArray(derived.artifacts.phases)
      && derived.artifacts.phases.length === 0
      && !Object.prototype.hasOwnProperty.call(derived.artifacts, 'items'));
}

async function caseLaterRunSemantics(check) {
  function signalSnapshot(snapshot, live) {
    var prefix = live ? '18:10' : '18:00';
    snapshot.data.blockers = { count: 1, items: [{
      source: 'live_events.operator_attention_required',
      ts: '2026-08-20T' + prefix + ':01.000Z'
    }] };
    snapshot.data.gates = {
      gates: [{ gate: 'ATC', verdict: 'fail',
        ts: '2026-08-20T' + prefix + ':00.000Z' }],
      latest_per_gate: { ATC: { verdict: 'fail',
        ts: '2026-08-20T' + prefix + ':00.000Z' } },
      live_event_count: 5
    };
    snapshot.data.resume_command = {
      command: '/sgsd-orchestrate go',
      source: 'live_events.checkpoint_written'
    };
  }

  var live = deriveFixture(check, 'attention', function (snapshot) {
    signalSnapshot(snapshot, true);
  }, { events: readEventFixture('later-run-live') });
  check.assert('signals_after_clear_events_still_fire',
    live.status === 'attention'
      && JSON.stringify(live.reasons) === JSON.stringify([
        'gate_failed', 'operator_attention_required',
        'blockers_present', 'checkpoint_waiting_for_run'
      ]), 'status=' + live.status + ' reasons=' + live.reasons.join(','));

  var cleared = deriveFixture(check, 'attention', function (snapshot) {
    signalSnapshot(snapshot, false);
  }, { events: readEventFixture('later-run-cleared') });
  check.assert('subsequent_run_started_and_gate_passed_clear_stale_signals',
    cleared.status === 'idle'
      && JSON.stringify(cleared.reasons) === JSON.stringify(['idle_no_signal']),
    'status=' + cleared.status + ' reasons=' + cleared.reasons.join(','));

  var fleetFixture = createSyntheticDiscovery(1);
  try {
    fs.writeFileSync(path.join(fleetFixture.lanes[0].path, '.planning',
      'ORCHESTRATOR-LIVE.jsonl'), fs.readFileSync(path.join(__dirname,
      'fixtures', 'events', 'later-run-cleared.jsonl'), 'utf8'), 'utf8');
    var cache = fleet.createFleetCache({
      buildSnapshot: function () {
        var snapshot = readFixture('attention');
        signalSnapshot(snapshot, false);
        return snapshot;
      },
      deriveLaneStatus: status.deriveLaneStatus,
      now: function () { return Date.parse('2026-08-20T18:19:31.052Z'); }
    });
    cache.acceptDiscovery(fleetFixture.porcelain);
    await cache.refreshNow();
    check.assert('fleet_passes_lane_live_events_into_status_derivation',
      cache.getFleet().lanes[0].status === 'idle',
      'status=' + cache.getFleet().lanes[0].status);
    cache.stop();
  } finally {
    fleetFixture.cleanup();
  }
}

async function caseProjectionConflict(check) {
  var derived = deriveFixture(check, 'projection-conflict');
  var conflict = derived.objective_conflict;
  check.assert('projection_stale_sets_conflict', derived.conflict === true);
  check.assert('projection_conflict_reason_surfaced',
    derived.reasons.indexOf('state_projection_conflict') !== -1);
  check.assert('projection_conflict_exposes_both_milestones',
    conflict.milestone === 'v2.0' && conflict.state_md_milestone === 'v3.0');
  check.assert('projection_conflict_exposes_both_phases',
    conflict.phase === '156' && conflict.state_md_phase === null);
  check.assert('projection_conflict_exposes_source_and_confidence',
    conflict.source === 'phase_folders'
      && conflict.effective_confidence === 0.7);
}

async function caseStatusPrecedence(check) {
  var matrix = [
    {
      name: 'attention_over_running_and_stale',
      fixture: 'checkpoint-attention',
      mutate: function (snapshot) {
        snapshot.data.gates.latest_per_gate = { ATC: { verdict: 'fail' } };
        snapshot.data.blockers = { count: 1, items: [
          { source: 'live_events.operator_attention_required' }
        ] };
        snapshot.data.agents = copy(readFixture('agent-in-flight').data.agents);
        snapshot.data.codex = {
          live_state: 'ok', live_json_age_seconds: 1, stale_threshold_seconds: 120
        };
        snapshot.data.staleness.state_md.stale = true;
        snapshot.data.now.ts = '2026-08-18T12:00:00.000Z';
      },
      status: 'attention',
      reasons: ['gate_failed', 'operator_attention_required',
        'blockers_present', 'checkpoint_waiting_for_run']
    },
    {
      name: 'running_over_stale',
      fixture: 'agent-in-flight',
      mutate: function (snapshot) {
        snapshot.data.codex = {
          live_state: 'running', live_json_age_seconds: 1,
          stale_threshold_seconds: 120
        };
        snapshot.data.staleness.state_md.stale = true;
        snapshot.data.now.ts = '2026-08-18T12:00:00.000Z';
      },
      status: 'running',
      reasons: ['codex_live', 'agent_in_flight']
    },
    {
      name: 'handover_ok_codex_value',
      fixture: 'running',
      mutate: function (snapshot) {
        snapshot.data.agents = { roster: [], by_phase: {}, count: 0 };
      },
      status: 'running',
      reasons: ['codex_live']
    },
    {
      name: 'failed_verdict_value',
      fixture: 'attention',
      status: 'attention',
      reasons: ['gate_failed', 'blockers_present']
    },
    {
      name: 'stale_without_higher_signal',
      fixture: 'stale',
      status: 'stale',
      reasons: ['state_md_stale', 'last_activity_stale', 'codex_stale']
    },
    {
      name: 'idle_fallback',
      fixture: 'idle',
      status: 'idle',
      reasons: ['idle_no_signal']
    }
  ];
  matrix.forEach(function (row) {
    var derived = deriveFixture(check, row.fixture, row.mutate);
    check.assert(row.name + '_status', derived.status === row.status,
      'status=' + derived.status);
    check.assert(row.name + '_winning_reasons_only',
      JSON.stringify(derived.reasons) === JSON.stringify(row.reasons),
      'reasons=' + derived.reasons.join(','));
    check.assert(row.name + '_machine_codes_only',
      derived.reasons.every(function (reason) {
        return /^[a-z0-9_]+$/.test(reason);
      }));
  });
  var malformed = deriveFixture(check, 'idle', function (snapshot) {
    snapshot.data.now.ts = 'not-a-timestamp';
  });
  check.assert('malformed_timestamp_does_not_create_stale',
    malformed.status === 'idle' && malformed.last_activity_ts === null
      && malformed.age_minutes === null);
  var failed = deriveFixture(check, 'build-error');
  check.assert('failed_snapshot_has_stable_error_status',
    failed.status === 'error'
      && JSON.stringify(failed.reasons) === JSON.stringify(['snapshot_unavailable']));
  check.assert('failed_snapshot_preserves_degraded_sections',
    failed.degraded.length === 12);
}

async function casePageDataContract(check) {
  var fixture = await createPageFixture();
  try {
    var fleetResponse = await requestServer(fixture.address, '/api/fleet');
    var body = fleetResponse.body;
    check.assert('page_fleet_endpoint_returns_fixture_envelope',
      fleetResponse.statusCode === 200 && body && body.ok === true
      && body.schema_version === 1 && body.root === fixture.root
      && body.cache_age_seconds === 0 && body.lanes.length === fixture.names.length);
    ['ts', 'counts', 'lanes'].forEach(function (key) {
      check.assert('page_fleet_has_' + key,
        Object.prototype.hasOwnProperty.call(body, key));
    });

    var rowFields = [
      'name', 'path', 'branch', 'status', 'headline', 'phase', 'phase_name',
      'last_activity_ts', 'age_minutes', 'conflict', 'degraded'
    ];
    body.lanes.forEach(function (row) {
      rowFields.forEach(function (key) {
        check.assert('page_rollup_' + row.name + '_has_' + key,
          Object.prototype.hasOwnProperty.call(row, key));
      });
      check.assert('page_rollup_' + row.name + '_degraded_is_array',
        Array.isArray(row.degraded));
    });

    var details = Object.create(null);
    for (var i = 0; i < fixture.names.length; i++) {
      var name = fixture.names[i];
      var response = await requestServer(
        fixture.address, '/api/lane/' + encodeURIComponent(name));
      var detail = response.body;
      details[name] = detail;
      check.assert('page_detail_' + name + '_is_displayable',
        response.statusCode === 200 && detail && detail.name === name
        && Object.prototype.hasOwnProperty.call(detail, 'ok'));
      [
        'status', 'reasons', 'cache_age_seconds', 'agents', 'tokens', 'gates',
        'artifacts', 'objective_conflict', 'snapshot'
      ].forEach(function (key) {
        check.assert('page_detail_' + name + '_has_' + key,
          Object.prototype.hasOwnProperty.call(detail, key));
      });
      check.assert('page_detail_' + name + '_cache_age_accepts_zero',
        detail.cache_age_seconds === 0);
      check.assert('page_detail_' + name + '_snapshot_is_unchanged',
        JSON.stringify(detail.snapshot) === JSON.stringify(fixture.snapshots[name]));
      check.assert('page_detail_' + name + '_keeps_twelve_sections',
        JSON.stringify(Object.keys(detail.snapshot.data).sort())
          === JSON.stringify(SECTION_KEYS.slice().sort()));
    }

    var tokenDetail = details['noise-tokens-absent'];
    check.assert('page_tokens_no_data_sits_beside_raw_zero',
      tokenDetail.tokens.state === 'no_data'
      && tokenDetail.tokens.value === null
      && tokenDetail.tokens.reason === 'tokens_source_absent'
      && tokenDetail.snapshot.data.tokens.source === 'absent'
      && tokenDetail.snapshot.data.tokens.total_tokens === 0);
    var gateDetail = details['noise-gates-empty'];
    check.assert('page_gates_no_data_sits_beside_raw_empty_evidence',
      gateDetail.gates.state === 'no_data'
      && gateDetail.gates.reason === 'no_gate_data'
      && gateDetail.gates.live_event_count === 0
      && gateDetail.snapshot.data.gates.gates.length === 0
      && Object.keys(gateDetail.snapshot.data.gates.latest_per_gate).length === 0);
    var conflict = details['projection-conflict'].objective_conflict;
    check.assert('page_projection_conflict_has_both_pairs_source_and_confidence',
      conflict.milestone === 'v2.0' && conflict.phase === '156'
      && conflict.source === 'phase_folders'
      && conflict.state_md_milestone === 'v3.0'
      && conflict.state_md_phase === null
      && conflict.effective_confidence === 0.7);
    var attention = body.lanes.filter(function (row) {
      return row.name === 'attention';
    })[0];
    check.assert('page_failed_gate_is_attention_with_readable_rollup_headline',
      attention && attention.status === 'attention'
      && attention.headline === 'gate failed');
  } finally {
    await fixture.cleanup();
  }
}

async function casePageHttpDelivery(check) {
  var fixture = await createPageFixture();
  try {
    var expectations = [
      ['/', 'index.html', 'text/html; charset=utf-8'],
      ['/index.html', 'index.html', 'text/html; charset=utf-8'],
      ['/app.js', 'app.js', 'application/javascript; charset=utf-8']
    ];
    for (var i = 0; i < expectations.length; i++) {
      var item = expectations[i];
      var response = await requestServer(fixture.address, item[0]);
      check.assert('page_static_' + item[0].replace(/[^a-z]/gi, '_') + '_status_200',
        response.statusCode === 200);
      check.assert('page_static_' + item[1].replace('.', '_') + '_exact_disk_bytes',
        response.text === fs.readFileSync(pageFile(item[1]), 'utf8'));
      check.assert('page_static_' + item[1].replace('.', '_') + '_content_type',
        response.headers['content-type'] === item[2]);
      check.assert('page_static_' + item[1].replace('.', '_') + '_safe_headers',
        response.headers['x-content-type-options'] === 'nosniff'
        && response.headers['cache-control'] === 'no-store'
        && response.headers['x-sgsd-cache-age-seconds'] === '0');
    }

    var fileOrigin = await requestServer(
      fixture.address, '/api/fleet', 'GET', { Origin: 'null' });
    check.assert('page_file_origin_gets_exact_null_cors',
      fileOrigin.statusCode === 200
      && fileOrigin.headers['access-control-allow-origin'] === 'null'
      && fileOrigin.headers.vary === 'Origin');
    var untrusted = await requestServer(
      fixture.address, '/api/fleet', 'GET', { Origin: 'https://untrusted.invalid' });
    check.assert('page_untrusted_origin_is_not_reflected_or_wildcarded',
      untrusted.statusCode === 200
      && untrusted.headers['access-control-allow-origin'] === undefined);
  } finally {
    await fixture.cleanup();
  }

  await caseHttpContract(check);
  await caseReadOnlyMethods(check);
  await caseErrorShape(check);
  await caseStructuralLoadSafety(check);
}

async function casePageSortComparator(check) {
  var appSource = fs.readFileSync(pageFile('app.js'), 'utf8');
  var comparatorSource = extractMarkedHelper(appSource, 'compareLaneRows');
  var compareLaneRows = compileFunction(
    comparatorSource, 'compareLaneRows');
  var rows = [
    { name: 'idle-null', status: 'idle', last_activity_ts: null },
    { name: 'stale-lane', status: 'stale', last_activity_ts: '2026-08-20T10:00:00Z' },
    { name: 'running-old', status: 'running', last_activity_ts: '2026-08-20T09:00:00Z' },
    { name: 'attention-lane', status: 'attention', last_activity_ts: '2026-08-20T12:00:00Z' },
    { name: 'idle-malformed', status: 'idle', last_activity_ts: 'not-a-time' },
    { name: 'running-B', status: 'running', last_activity_ts: '2026-08-20T11:00:00Z' },
    { name: 'error-lane', status: 'error', last_activity_ts: null },
    { name: 'idle-valid', status: 'idle', last_activity_ts: '2026-08-20T08:00:00Z' },
    { name: 'running-A', status: 'running', last_activity_ts: '2026-08-20T11:00:00Z' }
  ];
  var sorted = rows.slice().sort(compareLaneRows);
  check.assert('page_comparator_is_exact_marker_delimited_production_source',
    comparatorSource.indexOf('function compareLaneRows') !== -1
    && comparatorSource.indexOf('attention: 0') !== -1);
  check.assert('page_comparator_attention_error_running_stale_idle_order',
    JSON.stringify(sorted.map(function (row) { return row.name; }))
      === JSON.stringify([
        'attention-lane', 'error-lane', 'running-A', 'running-B',
        'running-old', 'stale-lane', 'idle-valid', 'idle-malformed', 'idle-null'
      ]));
  check.assert('page_comparator_newest_first_and_ascii_ties',
    sorted[2].name === 'running-A' && sorted[3].name === 'running-B'
    && sorted[4].name === 'running-old');
  check.assert('page_comparator_null_and_malformed_activity_sort_last',
    sorted[7].name === 'idle-malformed' && sorted[8].name === 'idle-null');
  check.assert('page_comparator_error_is_attention_equivalent',
    sorted[1].status === 'error' && sorted[2].status === 'running');
}

async function casePageRenderStructure(check) {
  var appSource = fs.readFileSync(pageFile('app.js'), 'utf8');
  var html = fs.readFileSync(pageFile('index.html'), 'utf8');
  var helpers = compilePageHelpers(appSource);
  var fixture = await createPageFixture();
  var fleetBody;
  var details = Object.create(null);
  try {
    fleetBody = (await requestServer(fixture.address, '/api/fleet')).body;
    for (var i = 0; i < fixture.names.length; i++) {
      var fixtureName = fixture.names[i];
      details[fixtureName] = (await requestServer(
        fixture.address, '/api/lane/' + encodeURIComponent(fixtureName))).body;
    }
    var comparatorCalls = 0;
    function observedComparator(left, right) {
      comparatorCalls++;
      return helpers.compareLaneRows(left, right);
    }
    var railSource = extractMarkedHelper(appSource, 'renderLaneRail');
    var productionRail = compileFunction(railSource, 'renderLaneRail', {
      compareLaneRows: observedComparator,
      safeStatus: compileFunction(
        extractNamedFunction(appSource, 'safeStatus'), 'safeStatus'),
      formatAge: helpers.formatAge,
      escapeHtml: helpers.escapeHtml
    });
    var rendered = productionRail({ lanes: fleetBody.lanes.slice().reverse() }, 'running');
    var renderedNames = [];
    var namePattern = /data-lane-name=\x22([^\x22]+)\x22/g;
    var nameMatch;
    while ((nameMatch = namePattern.exec(rendered)) !== null) {
      renderedNames.push(nameMatch[1]);
    }
    var expectedRows = fleetBody.lanes.slice().sort(helpers.compareLaneRows);
    check.assert('page_rail_directly_invokes_comparator',
      /\.sort\(compareLaneRows\)/.test(railSource) && comparatorCalls > 0,
      'calls=' + comparatorCalls);
    check.assert('page_rail_emits_every_fixture_lane',
      renderedNames.length === fixture.names.length);
    check.assert('page_rail_output_is_attention_first',
      JSON.stringify(renderedNames)
        === JSON.stringify(expectedRows.map(function (row) { return row.name; }))
      && expectedRows[0].status === 'attention'
      && expectedRows[1].status === 'error'
      && expectedRows[2].status === 'running'
      && expectedRows[3].status === 'stale');
    expectedRows.forEach(function (row) {
      var marker = 'data-lane-name=\x22' + helpers.escapeHtml(row.name) + '\x22';
      var start = rendered.indexOf(marker);
      var end = rendered.indexOf('</button>', start);
      var segment = start === -1 || end === -1 ? '' : rendered.slice(start, end);
      check.assert('page_rail_' + row.name + '_has_status_headline_age',
        segment.indexOf('class=\x22lane-status\x22>'
          + helpers.escapeHtml(row.status) + '</span>') !== -1
        && segment.indexOf('>' + helpers.escapeHtml(row.headline) + '<') !== -1
        && segment.indexOf('>' + helpers.escapeHtml(
          helpers.formatAge(row.age_minutes).text) + '<') !== -1);
    });
  } finally {
    await fixture.cleanup();
  }
  var noData = helpers.formatValue(details['noise-tokens-absent'].tokens);
  var zero = helpers.formatValue(
    details['noise-tokens-absent'].snapshot.data.tokens.total_tokens);
  check.assert('page_formatter_no_data_is_exact',
    noData.text === 'No data' && noData.className === 'value-no-data');
  check.assert('page_formatter_zero_is_exact_and_distinct',
    zero.text === '0' && zero.className === 'value-zero'
    && zero.className !== noData.className);
  check.assert('page_no_data_zero_classes_have_distinct_treatments',
    /\.value-no-data\s*\{[^}]*dashed[^}]*\}/.test(html)
    && /\.value-zero\s*\{[^}]*font-style:\s*normal[^}]*\}/.test(html));
  var conflictOutput = helpers.renderObjectiveConflict(details['projection-conflict']);
  [
    'Effective milestone: v2.0', 'Effective phase: 156',
    'Source: phase_folders', 'STATE milestone: v3.0',
    'STATE phase: No data', 'Confidence: 0.7'
  ].forEach(function (textValue) {
    check.assert('page_conflict_' + textValue.replace(/[^a-z0-9]/gi, '_'),
      conflictOutput.indexOf(textValue) !== -1);
  });
  check.assert('page_objective_calls_conflict_renderer',
    /projection_stale\s*===\s*true[\s\S]{0,180}renderObjectiveConflict\(detail\)/.test(
      appSource));
  var nowOutput = helpers.renderNow({
    action: '{\x22tool_name\x22:\x22apply_patch\x22,\x22args\x22:{\x22file\x22:\x22app.js\x22,\x22hunks\x22:3}}',
    ts: '2026-08-21T12:00:00Z'
  });
  check.assert('page_now_is_readable_tool_and_arg_summary_not_raw_json',
    nowOutput.indexOf('apply_patch') !== -1
    && nowOutput.indexOf('file: app.js') !== -1
    && nowOutput.indexOf('hunks: 3') !== -1
    && nowOutput.indexOf('{') === -1
    && nowOutput.indexOf('&quot;') === -1);
  var objectiveOutput = helpers.renderObjective({
    milestone: 'v3.8-fleet-cockpit', phase: '163', phase_name: 'fleet-page',
    status: 'in-progress', effective_confidence: 0.9,
    milestone_status: 'A deliberately long operator narrative.',
    projection_stale: false, source: 'STATE.md'
  });
  check.assert('page_objective_is_curated_and_collapses_long_status',
    objectiveOutput.indexOf('v3.8-fleet-cockpit') !== -1
    && objectiveOutput.indexOf('163 - fleet-page') !== -1
    && objectiveOutput.indexOf('in-progress') !== -1
    && objectiveOutput.indexOf('0.9') !== -1
    && /<details[^>]*class=\x22milestone-context\x22/.test(objectiveOutput)
    && objectiveOutput.indexOf('A deliberately long operator narrative.') !== -1
    && objectiveOutput.indexOf('projection_stale') === -1
    && objectiveOutput.indexOf('source') === -1);
  check.assert('page_numeric_paths_use_formatValue_without_or_fallback',
    appSource.indexOf('formatValue(blockers.count)') !== -1
    && appSource.indexOf('formatValue(gates.live_event_count)') !== -1
    && appSource.indexOf('formatValue(tokens.value)') !== -1
    && appSource.indexOf('formatValue(lastFleet.lanes.length)') !== -1
    && !/(blockers\.count|live_event_count|tokens\.value|cache_age_seconds)\s*\|\|/.test(
      appSource));
  check.assert('page_failed_status_and_verdict_are_red_with_text',
    /\.status-attention[^{]*\{[^}]*var\(--red\)/.test(html)
    && /\.state-failed[^{]*\{[^}]*var\(--red\)/.test(html)
    && appSource.indexOf('lane-headline') !== -1
    && appSource.indexOf('<strong>') !== -1);
  SECTION_KEYS.forEach(function (key) {
    check.assert('page_structure_has_section_' + key,
      html.indexOf('data-section=\x22' + key + '\x22') !== -1);
  });
  check.assert('page_raw_snapshot_targets_pre',
    /<pre\s+id=\x22raw-snapshot\x22/.test(html)
    && appSource.indexOf('JSON.stringify(snapshot, null, 2)') !== -1);
  var resumeHtml = /<article class=\x22tile resume-tile\x22 data-section=\x22resume_command\x22[\s\S]*?<\/article>/.exec(
    html);
  var resumeSource = extractNamedFunction(appSource, 'renderResumeCommand');
  check.assert('page_resume_command_is_inert_code_only',
    resumeHtml && !/<(?:button|a|form)\b/i.test(resumeHtml[0])
    && resumeSource.indexOf('<code class=\x22resume-code\x22 tabindex=\x220\x22>') !== -1
    && resumeSource.indexOf('Ctrl+C') !== -1
    && !/\b(?:eval|Function|exec|spawn)\s*\(|clipboard|WebSocket|process\./.test(
      resumeSource));
}

async function casePageBehaviourStructure(check) {
  var appSource = fs.readFileSync(pageFile('app.js'), 'utf8');
  var html = fs.readFileSync(pageFile('index.html'), 'utf8');
  check.assert('page_behaviour_structural_not_browser_execution', true,
    'STRUCTURAL: no supported browser or DOM implementation is used');
  check.assert('page_behaviour_polls_only_fleet_5000ms',
    /window\.setInterval\(refreshFleet,\s*5000\)/.test(appSource)
    && !/setInterval\([^)]*(?:Codex|codex)/.test(appSource)
    && (appSource.match(/requestJson\('\/api\/fleet'\)/g) || []).length === 1);
  check.assert('page_behaviour_has_encoded_detail_and_sse_stream_paths',
    /'\/api\/lane\/'\s*\+\s*encodeURIComponent\(name\)/.test(appSource)
    && /encodeURIComponent\(name\)\s*\+\s*'\/codex-live\/stream'/.test(
      appSource));
  check.assert('page_behaviour_file_and_http_base_is_exact',
    /window\.location\.protocol\s*===\s*'file:'/.test(appSource)
    && appSource.indexOf('? \'http://127.0.0.1:7777\' : \'\'') !== -1);
  check.assert('page_behaviour_deep_link_parse_write_hashchange',
    appSource.indexOf('/^#\\/lane\\/(.+)$/') !== -1
    && appSource.indexOf('\'#/lane/\' + encodeURIComponent(name)') !== -1
    && appSource.indexOf('window.addEventListener(\'hashchange\'') !== -1);
  check.assert('page_behaviour_cache_age_is_permanent_and_zero_safe',
    html.indexOf('id=\x22cache-age-value\x22') !== -1
    && extractNamedFunction(appSource, 'updateCacheAge').indexOf(
      'formatValue(value)') !== -1
    && extractNamedFunction(appSource, 'updateCacheAge').indexOf('||') === -1);
  check.assert('page_behaviour_guards_poll_and_stale_detail',
    appSource.indexOf('if (fleetRequestInFlight) return;') !== -1
    && appSource.indexOf('var requestGeneration = ++detailRequestGeneration;') !== -1
    && appSource.indexOf('requestGeneration !== detailRequestGeneration') !== -1);
  check.assert('page_behaviour_codex_live_uses_one_eventsource_per_selection',
    appSource.indexOf('new window.EventSource') !== -1
    && appSource.indexOf('codexLiveSource.close()') !== -1
    && appSource.indexOf('source.onopen') !== -1
    && appSource.indexOf('source.onmessage') !== -1
    && appSource.indexOf('source.onerror') !== -1
    && appSource.indexOf('reconnecting') !== -1);
  var codexOpenSource = extractNamedFunction(appSource, 'openCodexLiveStream');
  check.assert('page_behaviour_codex_live_waits_for_window_load',
    /var codexLiveLoadFired\s*=\s*document\.readyState\s*===\s*'complete'/.test(
      appSource)
    && appSource.indexOf('window.addEventListener(\'load\'') !== -1
    && /window\.setTimeout\(flushPendingCodexLiveStream,\s*0\)/.test(appSource)
    && /if \(!codexLiveLoadFired\)\s*\{[\s\S]*codexLivePendingName\s*=\s*name;[\s\S]*return;[\s\S]*new window\.EventSource/.test(
      codexOpenSource));
  var codexRenderSource = extractNamedFunction(appSource, 'renderCodexLive');
  var codexAppendIndex = codexRenderSource.indexOf(
    'elements.codexLive.textContent += value.text');
  var codexTrimIndex = codexRenderSource.indexOf(
    'slice(-CODEX_LIVE_TEXT_LIMIT)');
  check.assert('page_behaviour_codex_live_append_buffer_is_bounded_64kb',
    /var CODEX_LIVE_TEXT_LIMIT\s*=\s*64\s*\*\s*1024/.test(appSource)
    && codexAppendIndex !== -1
    && codexTrimIndex > codexAppendIndex
    && /textContent\.length\s*>\s*CODEX_LIVE_TEXT_LIMIT/.test(
      codexRenderSource));
  check.assert('page_behaviour_codex_live_appends_and_respects_scroll_pin',
    appSource.indexOf('elements.codexLive.textContent += value.text') !== -1
    && appSource.indexOf('function isCodexLivePinned(') !== -1
    && appSource.indexOf('elements.codexLive.addEventListener(\'scroll\'') !== -1
    && /if \(wasPinned\)[\s\S]{0,160}scrollTop\s*=\s*elements\.codexLive\.scrollHeight/.test(
      appSource));
  var tabReturnResyncSource = extractNamedFunction(appSource, 'resyncAfterTabReturn');
  check.assert('page_behaviour_visible_tab_return_uses_debounced_production_resync',
    /document\.addEventListener\(\'visibilitychange\'/.test(appSource)
    && /if \(!document\.hidden\)\s*resyncAfterTabReturn\(\)/.test(appSource)
    && /window\.addEventListener\(\'focus\',\s*resyncAfterTabReturn\)/.test(appSource)
    && /lastTabReturnResyncAt/.test(tabReturnResyncSource)
    && /refreshFleet\(\)/.test(tabReturnResyncSource)
    && /if \(selectedName\s*===\s*null\)\s*return;[\s\S]*loadLane\(selectedName\)/.test(
      tabReturnResyncSource)
    && /closeCodexLiveStream\(\)[\s\S]*openCodexLiveStream\(selectedName\)/.test(
      tabReturnResyncSource));

  var fleetFailure = extractNamedFunction(appSource, 'refreshFleet');
  fleetFailure = fleetFailure.slice(fleetFailure.indexOf('.catch'));
  var laneFailure = extractNamedFunction(appSource, 'loadLane');
  laneFailure = laneFailure.slice(laneFailure.indexOf('.catch'));
  var forbiddenReset = /(lastFleet|lastDetail)\s*=\s*null|renderNoDetail\s*\(|laneList\.(?:innerHTML|textContent)|rawSnapshot\.(?:innerHTML|textContent)|cacheAge\.(?:innerHTML|textContent)/;
  check.assert('page_fleet_failure_banner_keeps_last_good',
    fleetFailure.indexOf('setFailure(\'fleet\'') !== -1
    && !forbiddenReset.test(fleetFailure));
  check.assert('page_lane_failure_banner_keeps_last_good',
    laneFailure.indexOf('setFailure(\'lane\'') !== -1
    && !forbiddenReset.test(laneFailure));
  check.assert('page_success_clears_banner_and_keeps_last_good_state',
    appSource.indexOf('clearFailure(\'fleet\')') !== -1
    && appSource.indexOf('clearFailure(\'lane\')') !== -1
    && appSource.indexOf('var lastFleet = null;') !== -1
    && appSource.indexOf('var lastDetail = null;') !== -1);
}

async function casePageSourceConstraints(check) {
  var indexFile = pageFile('index.html');
  var appFile = pageFile('app.js');
  var serverFile = path.join(__dirname, 'server.cjs');
  var html = fs.readFileSync(indexFile, 'utf8');
  var appSource = fs.readFileSync(appFile, 'utf8');
  var serverSource = fs.readFileSync(serverFile, 'utf8');
  check.assert('page_sources_are_ascii',
    [indexFile, appFile, serverFile].every(isAsciiFile));
  var syntaxOk = true;
  try {
    Function(appSource);
  } catch (_syntaxError) {
    syntaxOk = false;
  }
  check.assert('page_app_compiles_in_process', syntaxOk);
  check.assert('page_html_has_one_document_shell',
    (html.match(/<!doctype html>/gi) || []).length === 1
    && (html.match(/<html\b/gi) || []).length === 1
    && (html.match(/<head\b/gi) || []).length === 1
    && (html.match(/<body\b/gi) || []).length === 1
    && (html.match(/<\/html>/gi) || []).length === 1
    && (html.match(/<\/head>/gi) || []).length === 1
    && (html.match(/<\/body>/gi) || []).length === 1);
  ['header', 'main', 'nav', 'section', 'aside', 'pre'].forEach(function (tag) {
    var opens = (html.match(new RegExp('<' + tag + '\\b', 'gi')) || []).length;
    var closes = (html.match(new RegExp('<\\/' + tag + '>', 'gi')) || []).length;
    check.assert('page_html_balances_' + tag, opens > 0 && opens === closes);
  });
  check.assert('page_html_uses_only_relative_defer_script',
    /<script\s+src=\x22\.\/app\.js\x22\s+defer><\/script>/.test(html)
    && !/type\s*=\s*['\x22]module['\x22]/i.test(html));

  var palette = [
    ['paper', '#f6f7f8'], ['ink', '#202629'], ['muted', '#647076'],
    ['line', '#d8dee1'], ['panel', '#ffffff'], ['teal', '#147a74'],
    ['blue', '#315f90'], ['amber', '#b27622'], ['green', '#4f7f45'],
    ['red', '#aa4a43'], ['violet', '#6a5b8f']
  ];
  palette.forEach(function (entry) {
    check.assert('page_palette_has_' + entry[0],
      html.indexOf('--' + entry[0] + ': ' + entry[1]) !== -1);
  });
  check.assert('page_has_required_system_stack_heads',
    html.indexOf('Segoe UI') !== -1 && html.indexOf('Cascadia Mono') !== -1);
  check.assert('page_segoe_is_explicit_for_names_headlines_and_titles',
    /\.lane-name,\s*\.lane-headline,\s*h1,\s*h2,\s*h3\s*\{[^}]*font-family:\s*var\(--ui-font\)/.test(html));
  check.assert('page_teal_primary_is_used_not_only_declared',
    /\.topbar\s*\{[^}]*border-top:\s*4px solid var\(--teal\)/.test(html)
    && /\.lane-row\[aria-current=\x22true\x22\]\s*\{[^}]*var\(--teal\)/.test(html)
    && /\.tile h3\s*\{[^}]*color:\s*var\(--teal\)/.test(html)
    && /a\s*\{[^}]*color:\s*var\(--teal\)/.test(html));
  check.assert('page_left_rail_is_full_height_square_product_surface',
    /\.lane-rail\s*\{[^}]*min-height:\s*calc\(100vh - 96px\)[^}]*border-radius:\s*0/.test(html));
  check.assert('page_right_rail_stacks_codex_live_over_collapsed_raw',
    html.indexOf('id=\x22codex-live\x22') !== -1
    && html.indexOf('id=\x22codex-live-age\x22') !== -1
    && /<details class=\x22raw-pane\x22(?![^>]*\sopen)[^>]*>/.test(html)
    && /<pre\s+id=\x22raw-snapshot\x22/.test(html));

  var pageSource = html + '\n' + appSource;
  var urls = pageSource.match(/https?:\/\/[^\s'\x22<)]+/g) || [];
  check.assert('page_has_only_exact_loopback_service_url',
    JSON.stringify(urls) === JSON.stringify(['http://127.0.0.1:7777']));
  check.assert('page_has_no_remote_or_dependency_surfaces',
    !/<(?:link|img|iframe)\b|@import|\brequire\s*\(|\bimport\s+|sourceMappingURL|serviceWorker|WebSocket|telemetry/i.test(
      pageSource)
    && !/\b(?:react|vue|svelte|angular|jquery|bootstrap|package)\b/i.test(pageSource));
  check.assert('page_server_uses_fixed_three_path_allowlist',
    serverSource.indexOf('STATIC_ROUTES') !== -1
    && serverSource.indexOf('\'/\'') !== -1
    && serverSource.indexOf('\'/index.html\'') !== -1
    && serverSource.indexOf('\'/app.js\'') !== -1
    && serverSource.indexOf('STATIC_ROUTES[pathname]') !== -1
    && !/path\.join\([^)]*(?:pathname|req\.url)/.test(serverSource));
}

async function casePageManualChecksDocumented(check) {
  var docsFile = path.join(__dirname, '..', '..', 'docs', 'FLEET-COCKPIT.md');
  var docs = fs.readFileSync(docsFile, 'utf8');
  var manualIndex = docs.indexOf('## MANUAL CHECKS');
  var manual = manualIndex === -1 ? '' : docs.slice(manualIndex);
  check.assert('page_manual_phone_section_is_explicit',
    manualIndex !== -1 && manual.indexOf('Manual phone over LAN check') !== -1);
  [
    '--host 0.0.0.0', 'trusted-network/firewall',
    'http://<LAN-IP>:7777/', 'device, browser, time, and result',
    'lane rail is first', 'all rows select', 'status dot is not the sole cue',
    '44px targets', 'centre and raw content follow',
    'no page-wide horizontal overflow', 'cache age remains visible',
    'last render under a banner', 'refreshing recovers',
    'hash deep link restores a lane', 'browser network log'
  ].forEach(function (requiredText) {
    check.assert('page_manual_has_' + requiredText.replace(/[^a-z0-9]/gi, '_'),
      manual.indexOf(requiredText) !== -1);
  });
  check.assert('page_manual_result_is_unchecked_and_operator_owned',
    (manual.match(/^- \[ \]/gm) || []).length >= 10
    && !/^- \[[xX]\]/m.test(manual)
    && manual.indexOf('Result: PENDING - operator-owned') !== -1);
  check.assert('page_manual_disclaims_automated_phone_pass',
    manual.indexOf('self-test verifies this documentation only') !== -1
    && manual.indexOf('Only an operator observation may record PASS') !== -1
    && manual.indexOf('Result: PASS') === -1);
  check.skip('manual_phone_over_lan_pending_operator_observation',
    'MANUAL PENDING: documentation checked; no phone usability result asserted');
}

var CASES = {
  'default-bind': caseDefaultBind,
  'frame-coalescing': caseFrameCoalescing,
  'http-contract': caseHttpContract,
  'codex-live-absent': caseCodexLiveAbsent,
  'codex-live-present': caseCodexLivePresent,
  'codex-live-tail-bounded': caseCodexLiveTailBounded,
  'sse-stream': caseSseStream,
  'deltas-across-rebuilds': caseDeltasAcrossRebuilds,
  'read-only-methods': caseReadOnlyMethods,
  'verbatim-snapshot': caseVerbatimSnapshot,
  'healthz-shape': caseHealthzShape,
  'error-shape': caseErrorShape,
  'structural-load-safety': caseStructuralLoadSafety,
  'source-constraints': caseSourceConstraints,
  'wrapper-contract': caseWrapperContract,
  'fixture-git-discovery': caseFixtureGitDiscovery,
  'production-discovery': caseProductionDiscovery,
  'discovery-frame-source-failure': caseDiscoveryFrameSourceFailure,
  'fleet-cache-scheduler': caseFleetCacheScheduler,
  'lane-failure-isolation': caseLaneFailureIsolation,
  'rollup-first-publish': caseRollupFirstPublish,
  'status-precedence': caseStatusPrecedence,
  'later-run-semantics': caseLaterRunSemantics,
  'noise-agent-tools': caseNoiseAgentTools,
  'noise-tokens-absent': caseNoiseTokensAbsent,
  'noise-gates-empty': caseNoiseGatesEmpty,
  'noise-artifacts-source': caseNoiseArtifactsSource,
  'projection-conflict': caseProjectionConflict,
  'page-http-delivery': casePageHttpDelivery,
  'page-data-contract': casePageDataContract,
  'page-sort-comparator': casePageSortComparator,
  'page-render-structure': casePageRenderStructure,
  'page-behaviour-structure': casePageBehaviourStructure,
  'page-source-constraints': casePageSourceConstraints,
  'page-manual-checks-documented': casePageManualChecksDocumented
};

function assertFixtureShapes(check) {
  [
    'attention', 'running', 'stale', 'idle', 'build-error',
    'noise-agent-tools', 'noise-tokens-absent', 'noise-gates-empty',
    'noise-artifacts-source', 'projection-conflict',
    'checkpoint-attention', 'agent-in-flight'
  ].forEach(function (name) {
    var snapshot = readFixture(name);
    var actualKeys = Object.keys(snapshot.data || {}).sort();
    var expectedKeys = SECTION_KEYS.slice().sort();
    check.assert('fixture_' + name + '_schema_v1', snapshot.schema_version === 1);
    check.assert('fixture_' + name + '_has_exactly_twelve_sections',
      JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
      'keys=' + actualKeys.join(','));
    check.assert('fixture_' + name + '_has_adapter_metadata',
      typeof snapshot.ok === 'boolean' && typeof snapshot.ts === 'string'
        && Array.isArray(snapshot._section_degraded)
        && Array.isArray(snapshot._redactions_applied));
  });
}

async function runCase(name) {
  var check = makeCheck();
  if (!Object.prototype.hasOwnProperty.call(CASES, name)) {
    check.results.push({ label: 'known_case', ok: false, detail: 'unknown case: ' + name });
    return { ok: false, results: check.results };
  }
  try {
    assertFixtureShapes(check);
    await CASES[name](check);
  } catch (error) {
    if (check.results.length === 0 || check.results[check.results.length - 1].ok) {
      check.results.push({
        label: name + '_threw',
        ok: false,
        detail: error && error.message ? error.message : 'unknown error'
      });
    }
  }
  return {
    ok: check.results.length > 0 && check.results.every(function (row) { return row.ok; }),
    results: check.results
  };
}

async function runAll() {
  var check = makeCheck();
  try {
    assertFixtureShapes(check);
  } catch (_fixtureError) {
    return { ok: false, results: check.results };
  }
  var names = Object.keys(CASES);
  for (var i = 0; i < names.length; i++) {
    var beforeCount = check.results.length;
    try {
      await CASES[names[i]](check);
    } catch (error) {
      if (check.results.length === beforeCount
          || check.results[check.results.length - 1].ok) {
        check.results.push({
          label: names[i] + '_threw',
          ok: false,
          detail: error && error.message ? error.message : 'unknown error'
        });
      }
    }
  }
  return {
    ok: check.results.length > 0 && check.results.every(function (row) {
      return row.ok;
    }),
    results: check.results
  };
}

function printHelp() {
  process.stdout.write('fleet-cockpit/run-self-test.cjs --case <name>\n');
  process.stdout.write('  all\n');
  Object.keys(CASES).forEach(function (name) {
    process.stdout.write('  ' + name + '\n');
  });
}

async function main(argv) {
  var caseIndex = argv.indexOf('--case');
  var caseName = caseIndex === -1 ? 'all' : argv[caseIndex + 1];
  if (!caseName) {
    printHelp();
    return 1;
  }
  var result = caseName === 'all' ? await runAll() : await runCase(caseName);
  var pass = 0;
  var skipped = 0;
  result.results.forEach(function (row) {
    if (row.skipped) skipped++;
    else if (row.ok) pass++;
    process.stdout.write((row.skipped ? 'SKIP ' : row.ok ? 'PASS ' : 'FAIL ') + row.label
      + (row.detail ? '  (' + row.detail + ')' : '') + '\n');
  });
  process.stdout.write('\nSelf-test: ' + pass + '/'
    + (result.results.length - skipped) + ' passed'
    + (skipped > 0 ? ', ' + skipped + ' skipped' : '') + '\n');
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) {
    process.exitCode = code;
  }, function (error) {
    process.stderr.write('FAIL self_test_threw  ('
      + (error && error.message ? error.message : 'unknown') + ')\n');
    process.exitCode = 1;
  });
}

module.exports = {
  CASE_NAMES: Object.freeze(['all'].concat(Object.keys(CASES))),
  runCase: runCase,
  runAll: runAll,
  _internals: {
    createGitFixture: createGitFixture,
    createSyntheticDiscovery: createSyntheticDiscovery,
    makeTimers: makeTimers,
    SECTION_KEYS: SECTION_KEYS
  }
};
