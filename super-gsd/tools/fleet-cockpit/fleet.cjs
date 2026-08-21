// Phase 162 P162-T1: request-agnostic, read-only fleet discovery cache.
// Git discovery is performed by the launcher. This module accepts the exact
// `git -C <root> worktree list --porcelain` frame and never spawns a process.
// ASCII-only.

'use strict';

var fs = require('node:fs');
var path = require('node:path');
var cockpitStateAdapter = require('../cockpit-state/adapter.cjs');

var DEFAULT_INTERVAL_MS = 20000;
var DEFAULT_CONCURRENCY = 4;
var MAX_CONCURRENCY = 4;
var SCHEMA_VERSION = 1;

function cloneValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(function (item) { return cloneValue(item); });
  }
  var result = {};
  Object.keys(value).forEach(function (key) {
    result[key] = cloneValue(value[key]);
  });
  return result;
}

function parseWorktreePorcelain(text) {
  if (typeof text !== 'string') {
    throw new TypeError('worktree porcelain must be a string');
  }

  var records = [];
  var current = null;
  var lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  function finishCurrent() {
    if (!current) return;
    if (!current.path) throw new Error('worktree record is missing an absolute path');
    if (!path.isAbsolute(current.path)) {
      throw new Error('worktree path is not absolute: ' + current.path);
    }
    current.name = path.basename(current.path);
    if (!current.name) throw new Error('worktree path has no stable basename');
    records.push(current);
    current = null;
  }

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line.indexOf('worktree ') === 0) {
      finishCurrent();
      current = { path: line.substring('worktree '.length), branch: null };
    } else if (current && line.indexOf('branch ') === 0) {
      var branch = line.substring('branch '.length);
      var prefix = 'refs/heads/';
      current.branch = branch.indexOf(prefix) === 0
        ? branch.substring(prefix.length) : branch;
    } else if (current && line === 'detached') {
      current.branch = null;
    }
  }
  finishCurrent();

  var byName = Object.create(null);
  var duplicateMap = Object.create(null);
  records.forEach(function (record) {
    if (!Object.prototype.hasOwnProperty.call(byName, record.name)) {
      byName[record.name] = record;
      return;
    }
    if (!duplicateMap[record.name]) {
      duplicateMap[record.name] = [byName[record.name].path];
    }
    duplicateMap[record.name].push(record.path);
  });

  var duplicateNames = Object.keys(duplicateMap).sort().map(function (name) {
    return { name: name, paths: duplicateMap[name].slice().sort() };
  });
  var rejected = Object.create(null);
  duplicateNames.forEach(function (duplicate) { rejected[duplicate.name] = true; });

  var lanes = records.filter(function (record) {
    return !rejected[record.name];
  }).map(function (record) {
    return { name: record.name, path: record.path, branch: record.branch };
  }).sort(function (a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    if (a.path < b.path) return -1;
    if (a.path > b.path) return 1;
    return 0;
  });

  return { lanes: lanes, duplicate_names: duplicateNames };
}

function defaultDerivation(snapshot) {
  if (!snapshot || snapshot.ok !== true) {
    return {
      status: 'error',
      headline: 'snapshot unavailable',
      reasons: ['snapshot_unavailable'],
      phase: null,
      phase_name: null,
      last_activity_ts: null,
      age_minutes: null,
      conflict: false,
      degraded: snapshot && Array.isArray(snapshot._section_degraded)
        ? snapshot._section_degraded : []
    };
  }
  var data = snapshot.data || {};
  var objective = data.objective || {};
  var now = data.now || {};
  return {
    status: 'idle',
    headline: 'no derived status callback',
    reasons: ['idle_no_signal'],
    phase: objective.phase || null,
    phase_name: objective.phase_name || null,
    last_activity_ts: now.ts || null,
    age_minutes: null,
    conflict: !!objective.projection_stale,
    degraded: Array.isArray(snapshot._section_degraded)
      ? snapshot._section_degraded : []
  };
}

function errorRow(lane, error) {
  return {
    name: lane.name,
    path: lane.path,
    branch: lane.branch,
    status: 'error',
    headline: 'snapshot build failed',
    reasons: ['snapshot_build_failed'],
    phase: null,
    phase_name: null,
    last_activity_ts: null,
    age_minutes: null,
    conflict: false,
    degraded: [],
    error_code: 'snapshot_build_failed',
    error: error && error.message ? error.message : 'snapshot build failed'
  };
}

function readLaneEvents(projectDir) {
  var file = path.join(projectDir, '.planning', 'ORCHESTRATOR-LIVE.jsonl');
  var text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (_error) {
    return [];
  }
  return text.split(/\r?\n/).filter(Boolean).reduce(function (events, line) {
    try {
      var event = JSON.parse(line);
      if (event && typeof event === 'object') events.push(event);
    } catch (_error) {
      // Match the adapter's degraded reader: malformed rows do not poison a lane.
    }
    return events;
  }, []);
}

function rollupRow(lane, derived) {
  var value = derived || {};
  return {
    name: lane.name,
    path: lane.path,
    branch: lane.branch,
    status: typeof value.status === 'string' ? value.status : 'error',
    headline: typeof value.headline === 'string' ? value.headline : '',
    reasons: Array.isArray(value.reasons) ? cloneValue(value.reasons) : [],
    phase: value.phase === undefined ? null : value.phase,
    phase_name: value.phase_name === undefined ? null : value.phase_name,
    last_activity_ts: value.last_activity_ts === undefined
      ? null : value.last_activity_ts,
    age_minutes: value.age_minutes === undefined ? null : value.age_minutes,
    conflict: value.conflict === true,
    degraded: Array.isArray(value.degraded) ? cloneValue(value.degraded) : []
  };
}

function createFleetCache(options) {
  var opts = options || {};
  var buildSnapshot = typeof opts.buildSnapshot === 'function'
    ? opts.buildSnapshot : cockpitStateAdapter.buildSnapshot;
  var deriveLaneStatus = typeof opts.deriveLaneStatus === 'function'
    ? opts.deriveLaneStatus : defaultDerivation;
  var now = typeof opts.now === 'function' ? opts.now : Date.now;
  var setTimer = typeof opts.setTimeout === 'function' ? opts.setTimeout : setTimeout;
  var clearTimer = typeof opts.clearTimeout === 'function' ? opts.clearTimeout : clearTimeout;
  var intervalMs = Number(opts.intervalMs);
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) intervalMs = DEFAULT_INTERVAL_MS;
  var requestedConcurrency = Number(opts.concurrency);
  if (!Number.isFinite(requestedConcurrency) || requestedConcurrency <= 0) {
    requestedConcurrency = DEFAULT_CONCURRENCY;
  }
  var concurrency = Math.min(MAX_CONCURRENCY, Math.max(1,
    Math.floor(requestedConcurrency)));

  var discovery = { lanes: [], duplicate_names: [] };
  var lastDiscoveryError = null;
  var skippedLanes = [];
  var rows = [];
  var laneDetails = Object.create(null);
  var snapshots = Object.create(null);
  var generationMs = null;
  var generation = 0;
  var buildMsLast = null;
  var lastCycleDurationMs = null;
  var inFlight = null;
  var started = false;
  var cycleTimer = null;
  var detailTimer = null;

  function readNow() {
    var value = now();
    var ms = value instanceof Date ? value.getTime() : Number(value);
    if (!Number.isFinite(ms)) throw new Error('now callback returned an invalid time');
    return ms;
  }

  function cacheAgeSeconds() {
    if (generationMs === null) return null;
    return Math.max(0, Math.floor((readNow() - generationMs) / 1000));
  }

  function acceptDiscovery(porcelain) {
    try {
      var parsed = parseWorktreePorcelain(porcelain);
      discovery = {
        lanes: parsed.lanes.map(function (lane) { return cloneValue(lane); }),
        duplicate_names: cloneValue(parsed.duplicate_names)
      };
      if (parsed.duplicate_names.length > 0) {
        lastDiscoveryError = {
          error_code: 'duplicate_lane_name',
          duplicate_names: cloneValue(parsed.duplicate_names)
        };
      } else {
        lastDiscoveryError = null;
      }
      return {
        ok: true,
        lanes: discovery.lanes.length,
        duplicate_names: cloneValue(discovery.duplicate_names)
      };
    } catch (error) {
      lastDiscoveryError = {
        error_code: 'worktree_discovery_invalid',
        error: error && error.message ? error.message : 'invalid worktree porcelain'
      };
      return { ok: false, error_code: lastDiscoveryError.error_code };
    }
  }

  function eligibleQueue() {
    var queue = [];
    var skipped = [];
    discovery.lanes.forEach(function (lane) {
      var planningDir = path.join(lane.path, '.planning');
      var eligible = false;
      try {
        eligible = fs.statSync(planningDir).isDirectory();
      } catch (_error) {
        eligible = false;
      }
      if (eligible) {
        queue.push(cloneValue(lane));
      } else {
        skipped.push({
          name: lane.name,
          path: lane.path,
          branch: lane.branch,
          reason: 'planning_dir_missing'
        });
      }
    });
    skippedLanes = skipped;
    return queue;
  }

  async function buildLane(lane, cycleNowMs) {
    try {
      var captured = await Promise.resolve().then(function () {
        return buildSnapshot({ projectDir: lane.path });
      });
      var stagedSnapshot = cloneValue(captured);
      var events = readLaneEvents(lane.path);
      var derived = await Promise.resolve(deriveLaneStatus(cloneValue(captured), {
        nowMs: cycleNowMs,
        events: events
      }));
      var normalizedDerived = derived && typeof derived === 'object' ? derived : {};
      return {
        row: rollupRow(lane, normalizedDerived),
        detail: cloneValue(normalizedDerived),
        snapshot: stagedSnapshot
      };
    } catch (error) {
      var failed = errorRow(lane, error);
      return { row: failed, detail: cloneValue(failed), snapshot: null };
    }
  }

  async function runWorkers(queue, cycleNowMs) {
    var results = new Array(queue.length);
    var nextIndex = 0;

    async function worker() {
      while (true) {
        var index = nextIndex++;
        if (index >= queue.length) return;
        results[index] = await buildLane(queue[index], cycleNowMs);
      }
    }

    var workers = [];
    var workerCount = Math.min(concurrency, queue.length);
    for (var i = 0; i < workerCount; i++) workers.push(worker());
    await Promise.all(workers);
    return results;
  }

  function publishDetails(staged, stagedGeneration) {
    if (stagedGeneration !== generation) return;
    snapshots = staged;
  }

  async function refreshCycle() {
    var startedMs = readNow();
    var queue = eligibleQueue();
    var results = await runWorkers(queue, startedMs);
    var finishedMs = readNow();
    var stagedRows = [];
    var stagedDetails = Object.create(null);
    var stagedSnapshots = Object.create(null);

    for (var i = 0; i < results.length; i++) {
      stagedRows.push(results[i].row);
      stagedDetails[queue[i].name] = results[i].detail;
      if (results[i].snapshot !== null) {
        stagedSnapshots[queue[i].name] = results[i].snapshot;
      }
    }

    if (detailTimer !== null) {
      clearTimer(detailTimer);
      detailTimer = null;
    }
    rows = stagedRows;
    laneDetails = stagedDetails;
    snapshots = Object.create(null);
    generationMs = finishedMs;
    generation++;
    buildMsLast = Math.max(0, finishedMs - startedMs);
    lastCycleDurationMs = buildMsLast;

    var stagedGeneration = generation;
    detailTimer = setTimer(function () {
      detailTimer = null;
      publishDetails(stagedSnapshots, stagedGeneration);
    }, 0);
  }

  function refreshNow() {
    if (inFlight) return inFlight;
    inFlight = refreshCycle().then(function () {
      inFlight = null;
    }, function (error) {
      inFlight = null;
      throw error;
    });
    return inFlight;
  }

  function scheduleNext(delay) {
    if (!started || cycleTimer !== null) return;
    cycleTimer = setTimer(function () {
      cycleTimer = null;
      return refreshNow().then(function () {
        scheduleNext(intervalMs);
      }, function () {
        scheduleNext(intervalMs);
      });
    }, delay);
  }

  function start() {
    if (started) return false;
    started = true;
    scheduleNext(0);
    return true;
  }

  function stop() {
    started = false;
    if (cycleTimer !== null) {
      clearTimer(cycleTimer);
      cycleTimer = null;
    }
    if (detailTimer !== null) {
      clearTimer(detailTimer);
      detailTimer = null;
    }
  }

  function findRow(name) {
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].name === name) return rows[i];
    }
    return null;
  }

  function getFleet() {
    var counts = { attention: 0, running: 0, stale: 0, idle: 0 };
    rows.forEach(function (row) {
      if (Object.prototype.hasOwnProperty.call(counts, row.status)) {
        counts[row.status]++;
      }
    });
    return {
      ok: true,
      schema_version: SCHEMA_VERSION,
      ts: generationMs === null ? null : new Date(generationMs).toISOString(),
      cache_age_seconds: cacheAgeSeconds(),
      counts: counts,
      lanes: cloneValue(rows)
    };
  }

  function getLane(name) {
    var row = findRow(name);
    if (!row) return null;
    var result = Object.prototype.hasOwnProperty.call(laneDetails, name)
      ? cloneValue(laneDetails[name]) : {};
    Object.keys(row).forEach(function (key) {
      result[key] = cloneValue(row[key]);
    });
    result.cache_age_seconds = cacheAgeSeconds();
    result.snapshot = Object.prototype.hasOwnProperty.call(snapshots, name)
      ? cloneValue(snapshots[name]) : null;
    return result;
  }

  function getRawLane(name) {
    if (!Object.prototype.hasOwnProperty.call(snapshots, name)) return null;
    return cloneValue(snapshots[name]);
  }

  function getHealth() {
    return {
      ok: true,
      lanes: rows.length,
      lane_count: rows.length,
      discovered_lanes: discovery.lanes.length,
      cache_generation_ts: generationMs === null
        ? null : new Date(generationMs).toISOString(),
      cache_age_seconds: cacheAgeSeconds(),
      build_ms_last: buildMsLast,
      last_cycle_duration_ms: lastCycleDurationMs,
      skipped_lanes: cloneValue(skippedLanes),
      duplicate_names: cloneValue(discovery.duplicate_names),
      last_discovery_error: cloneValue(lastDiscoveryError),
      refresh_in_flight: !!inFlight,
      concurrency: concurrency,
      interval_ms: intervalMs
    };
  }

  return {
    acceptDiscovery: acceptDiscovery,
    start: start,
    stop: stop,
    refreshNow: refreshNow,
    getFleet: getFleet,
    getLane: getLane,
    getRawLane: getRawLane,
    getHealth: getHealth
  };
}

module.exports = {
  parseWorktreePorcelain: parseWorktreePorcelain,
  createFleetCache: createFleetCache,
  DEFAULT_INTERVAL_MS: DEFAULT_INTERVAL_MS,
  MAX_CONCURRENCY: MAX_CONCURRENCY
};
