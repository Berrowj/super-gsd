#!/usr/bin/env node
// Phase 162 P162-T1 and P162-T2 selectable fixture self-tests.
// Test-only Git processes create isolated repositories; production fleet code
// accepts the exact porcelain frame and never spawns or discovers on request.
// ASCII-only.

'use strict';

var fs = require('node:fs');
var path = require('node:path');
var os = require('node:os');
var childProcess = require('node:child_process');
var fleet = require('./fleet.cjs');
var status = null;
try {
  status = require('./status.cjs');
} catch (_statusLoadError) {
  status = null;
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

function printHelp() {
  process.stdout.write('fleet-cockpit/run-self-test.cjs --case <name>\n');
  Object.keys(CASES).forEach(function (name) {
    process.stdout.write('  ' + name + '\n');
  });
}

async function main(argv) {
  var caseIndex = argv.indexOf('--case');
  if (caseIndex === -1 || !argv[caseIndex + 1]) {
    printHelp();
    return 1;
  }
  var result = await runCase(argv[caseIndex + 1]);
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
  CASE_NAMES: Object.freeze(Object.keys(CASES)),
  runCase: runCase,
  _internals: {
    createGitFixture: createGitFixture,
    createSyntheticDiscovery: createSyntheticDiscovery,
    makeTimers: makeTimers,
    SECTION_KEYS: SECTION_KEYS
  }
};
