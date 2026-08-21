#!/usr/bin/env node
// Phase 162 P162-T1 through P162-T3 selectable fixture self-tests.
// Test-only Git processes create isolated repositories; production fleet code
// accepts the exact porcelain frame and never spawns or discovers on request.
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

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(function (key) { deepFreeze(value[key]); });
  return Object.freeze(value);
}

function deriveFixture(check, name, mutate) {
  check.assert('status_module_available',
    !!status && typeof status.deriveLaneStatus === 'function');
  var snapshot = readFixture(name);
  if (mutate) mutate(snapshot);
  var before = JSON.stringify(snapshot);
  deepFreeze(snapshot);
  var derived = status.deriveLaneStatus(snapshot, {
    nowMs: Date.parse('2026-08-20T18:19:31.052Z')
  });
  check.assert(name + '_input_unchanged', JSON.stringify(snapshot) === before);
  return derived;
}

function makeCheck() {
  var results = [];
  return {
    results: results,
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

function closeServer(server) {
  return new Promise(function (resolve, reject) {
    if (!server.listening) return resolve();
    server.close(function (error) {
      if (error) reject(error);
      else resolve();
    });
  });
}

function listenServer(server, host) {
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
    server.listen(0, host);
  });
}

function requestServer(address, requestPath, method) {
  return new Promise(function (resolve, reject) {
    var req = http.request({
      hostname: address.address,
      port: address.port,
      method: method || 'GET',
      path: requestPath
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

async function caseDefaultBind(check) {
  var moduleValue = requireServerModule(check);
  var defaults = moduleValue.parseArgs([]);
  var lan = moduleValue.parseArgs(['--host', '0.0.0.0']);
  check.assert('default_host_is_loopback', defaults.host === '127.0.0.1');
  check.assert('default_port_is_7777', defaults.port === 7777);
  check.assert('default_interval_is_20_seconds', defaults.intervalSeconds === 20);
  check.assert('lan_bind_requires_explicit_flag', lan.host === '0.0.0.0');

  var emptyCache = {
    getFleet: function () { return { ok: true, lanes: [], counts: {} }; },
    getLane: function () { return null; },
    getRawLane: function () { return null; },
    getHealth: function () { return { ok: true, cache_age_seconds: null }; }
  };
  var server = moduleValue.createFleetServer({ cache: emptyCache, root: '.' });
  try {
    var address = await listenServer(server, defaults.host);
    check.assert('actual_default_listener_is_loopback',
      address.address === '127.0.0.1', 'address=' + address.address);
  } finally {
    await closeServer(server);
  }
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
      match[1].indexOf('.') === 0 || allowed[match[1]] === true,
      'require=' + match[1]);
    }
  });

  var serverSource = fs.readFileSync(serverFile, 'utf8');
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

  var adapterResult = cockpitStateAdapter.selfTest();
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

var CASES = {
  'default-bind': caseDefaultBind,
  'http-contract': caseHttpContract,
  'read-only-methods': caseReadOnlyMethods,
  'verbatim-snapshot': caseVerbatimSnapshot,
  'healthz-shape': caseHealthzShape,
  'error-shape': caseErrorShape,
  'structural-load-safety': caseStructuralLoadSafety,
  'source-constraints': caseSourceConstraints,
  'wrapper-contract': caseWrapperContract,
  'fixture-git-discovery': caseFixtureGitDiscovery,
  'fleet-cache-scheduler': caseFleetCacheScheduler,
  'lane-failure-isolation': caseLaneFailureIsolation,
  'rollup-first-publish': caseRollupFirstPublish,
  'status-precedence': caseStatusPrecedence,
  'noise-agent-tools': caseNoiseAgentTools,
  'noise-tokens-absent': caseNoiseTokensAbsent,
  'noise-gates-empty': caseNoiseGatesEmpty,
  'noise-artifacts-source': caseNoiseArtifactsSource,
  'projection-conflict': caseProjectionConflict
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
  result.results.forEach(function (row) {
    if (row.ok) pass++;
    process.stdout.write((row.ok ? 'PASS ' : 'FAIL ') + row.label
      + (row.detail ? '  (' + row.detail + ')' : '') + '\n');
  });
  process.stdout.write('\nSelf-test: ' + pass + '/' + result.results.length + ' passed\n');
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
