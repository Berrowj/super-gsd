#!/usr/bin/env node
// =============================================================================
// super-gsd/scripts/sgsd-complete-milestone.cjs
// Phase 51-01-T7: v1.9 milestone-close pre-flight gate (context-bench).
// Phase 52-01-T7: extended with redis-adapter self-test (dual-gate v1.9).
//
// Invoked by super-gsd/skills/sgsd-complete-milestone/SKILL.md Step 0
// precondition list. Operator-runnable directly:
//   node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9
//
// CONTRACT
//   --milestone v1.9 -> dual gate. Step 1 require harness.cjs and call
//                       .selfTest() (Phase 51 context-bench). Step 2
//                       require redis-adapter.cjs and call .selfTest()
//                       (Phase 52). BOTH must pass. Propagate the exit
//                       code (0 = green = milestone close may proceed;
//                       1 = fail = milestone close MUST abort).
//   --milestone <other> -> exit 0 no-op (future milestones add their own
//                          gates here without touching the SKILL.md).
//
// ORDERING
//   Phase 51 context-bench runs FIRST. If it fails, we exit 1 immediately
//   (the redis check is skipped - keeps stderr signal clean and avoids
//   spurious projection-log rows when the prior gate already blocked).
//   Only when context-bench passes do we run redis-adapter.selfTest(); only
//   when BOTH pass does the gate exit 0.
//
// LOCK 13 (never throws upward)
//   - require('harness.cjs') is wrapped in try/catch. Import failure
//     writes stderr `milestone_close_blocked:context_bench_unavailable`
//     and exits 1. We never silently exit 0 on import failure -- that
//     would be the worst-case Phase 51 failure mode (milestone advances
//     to closed without the bench actually running).
//   - selfTest() exit !== 0 writes stderr
//     `milestone_close_blocked:context_bench_self_test_failed` and
//     exits 1.
//   - require('redis-adapter.cjs') is wrapped in try/catch. Import
//     failure writes stderr
//     `milestone_close_blocked:redis_adapter_unavailable` and exits 1.
//     We never silently exit 0 on redis-adapter import failure -- the
//     Phase 52 worst-case is identical to Phase 51's: milestone advances
//     to closed without the adapter actually running.
//   - redis-adapter.selfTest() exit !== 0 writes stderr
//     `milestone_close_blocked:redis_adapter_self_test_failed` and
//     exits 1.
//   - Any other unexpected throw is caught by the outer try/catch and
//     surfaces as a stderr error tag + exit 1; never throws upward.
//
// ASCII-ONLY: no smart quotes, no emoji, no non-ASCII literals anywhere.
// =============================================================================

'use strict';

function _argValue(args, key) {
  // Support --key=value AND --key value forms.
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === key && i + 1 < args.length) return args[i + 1];
    const prefix = key + '=';
    if (a.indexOf(prefix) === 0) return a.slice(prefix.length);
  }
  return null;
}

function _printSelfTestResults(results) {
  // Mirror harness _printSelfTest output shape so operator runs see the
  // same per-assertion PASS/FAIL lines whether they invoke harness
  // directly or through this gate.
  let pass = 0;
  if (!Array.isArray(results)) {
    process.stdout.write('milestone_close_gate: results not an array\n');
    return false;
  }
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const tag = r && r.ok ? 'PASS' : 'FAIL';
    const name = r && r.name ? r.name : 'unnamed';
    const detail = r && r.detail ? r.detail : '';
    process.stdout.write(tag + ' ' + name + ' ' + detail + '\n');
    if (r && r.ok) pass++;
  }
  process.stdout.write('---\n');
  process.stdout.write('milestone_close_gate self-test: '
    + pass + '/' + results.length + ' assertions passed\n');
  return pass === results.length;
}

function _main(argv) {
  try {
    const args = argv.slice(2);
    const milestone = _argValue(args, '--milestone');

    if (!milestone) {
      process.stderr.write(
        'milestone_close_blocked:missing_milestone_arg\n' +
        'usage: node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone <version>\n');
      process.exit(1);
      return;
    }

    // Future-proof: only v1.9 is gated by the context-bench right now.
    // Other milestones get their own gates added here as they need them;
    // until then this script is a deterministic no-op for them so the
    // SKILL.md call is harmless.
    if (milestone !== 'v1.9') {
      process.stdout.write('milestone_close_gate: no-op for milestone '
        + milestone + ' (only v1.9 is gated by context-bench)\n');
      process.exit(0);
      return;
    }

    // v1.9 path: require + selfTest + propagate exit code. Lock 13:
    // every step is wrapped so this script NEVER throws upward.
    let harness = null;
    try {
      harness = require('../tools/context-bench/harness.cjs');
    } catch (e) {
      process.stderr.write('milestone_close_blocked:context_bench_unavailable\n');
      process.stderr.write('  reason=harness_require_failed message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (!harness || typeof harness.selfTest !== 'function') {
      process.stderr.write('milestone_close_blocked:context_bench_unavailable\n');
      process.stderr.write('  reason=harness_selfTest_export_missing\n');
      process.exit(1);
      return;
    }

    let results = null;
    try {
      results = harness.selfTest();
    } catch (e) {
      process.stderr.write('milestone_close_blocked:context_bench_self_test_failed\n');
      process.stderr.write('  reason=selfTest_threw message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    const allOk = _printSelfTestResults(results);

    if (!allOk) {
      process.stderr.write('milestone_close_blocked:context_bench_self_test_failed\n');
      process.exit(1);
      return;
    }

    process.stdout.write('milestone_close_gate: v1.9 context-bench self-test green\n');

    // -----------------------------------------------------------------------
    // Phase 52-01-T7: redis-adapter self-test (second of dual-gate).
    // Context-bench passed; now run the redis-adapter selfTest. BOTH must
    // pass for the v1.9 gate to exit 0. Lock 13: try/catch on require AND
    // on selfTest invocation; never throw upward, always emit a stderr tag
    // and exit 1 on any failure.
    // -----------------------------------------------------------------------

    let redisAdapter = null;
    try {
      redisAdapter = require('../tools/context-cache/redis-adapter.cjs');
    } catch (e) {
      process.stderr.write('milestone_close_blocked:redis_adapter_unavailable\n');
      process.stderr.write('  reason=redis_adapter_require_failed message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (!redisAdapter || typeof redisAdapter.selfTest !== 'function') {
      process.stderr.write('milestone_close_blocked:redis_adapter_unavailable\n');
      process.stderr.write('  reason=redis_adapter_selfTest_export_missing\n');
      process.exit(1);
      return;
    }

    let redisOut = null;
    try {
      // redis-adapter.selfTest() is async (returns a Promise). We block
      // synchronously here via .then with a sentinel; child invocation in
      // the run-redis-self-test.cjs thin shell uses spawnSync but inside
      // this gate we are already in an async-friendly outer _main, so we
      // use a small synchronous adapter pattern: spawn a child process to
      // run the adapter --self-test, mirroring how the operator-facing
      // entry behaves. This keeps the gate Lock 13 wrapped without
      // pulling Promise resolution into the gate's exit path.
      const child_process = require('child_process');
      const path = require('path');
      const adapterPath = path.join(__dirname, '..', 'tools', 'context-cache', 'redis-adapter.cjs');
      const r = child_process.spawnSync(
        process.execPath,
        [adapterPath, '--self-test'],
        { stdio: 'inherit' }
      );
      if (r.error) {
        process.stderr.write('milestone_close_blocked:redis_adapter_self_test_failed\n');
        process.stderr.write('  reason=redis_adapter_spawn_failed message='
          + (r.error.message || 'unknown') + '\n');
        process.exit(1);
        return;
      }
      redisOut = (typeof r.status === 'number') ? r.status : 1;
    } catch (e) {
      process.stderr.write('milestone_close_blocked:redis_adapter_self_test_failed\n');
      process.stderr.write('  reason=redis_adapter_selfTest_threw message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (redisOut !== 0) {
      process.stderr.write('milestone_close_blocked:redis_adapter_self_test_failed\n');
      process.stderr.write('  reason=redis_adapter_exit_code='
        + redisOut + '\n');
      process.exit(1);
      return;
    }

    process.stdout.write('milestone_close_gate: v1.9 redis-adapter self-test green\n');
    process.stdout.write('milestone_close_gate: v1.9 dual-gate (context-bench + redis-adapter) green\n');
    process.exit(0);
  } catch (e) {
    // Outer guard: any unexpected error path exits 1 with a stderr tag.
    // Lock 13: we never throw upward.
    process.stderr.write('milestone_close_blocked:gate_internal_error\n');
    process.stderr.write('  reason=outer_catch message='
      + (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  _main(process.argv);
}

module.exports = { _main, _argValue, _printSelfTestResults };
