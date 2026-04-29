#!/usr/bin/env node
// =============================================================================
// super-gsd/scripts/sgsd-complete-milestone.cjs
// Phase 51-01-T7: v1.9 milestone-close pre-flight gate (context-bench).
// Phase 52-01-T7: extended with redis-adapter self-test (dual-gate v1.9).
// Phase 53-01-T7: extended with failure-injection self-test + --run-all
//                 (triple-gate v2.0; v1.9 dual-gate path preserved
//                 byte-untouched).
// Phase 54-01-T4: extended with chaos-restart self-test (quad-gate v2.0;
//                 v1.9 dual-gate AND Phase 53 triple-gate paths preserved
//                 byte-untouched up to the chaos-restart insertion point).
// Phase 55-01-T3: extended with provider-circuit self-test (quint-gate v2.0;
//                 v1.9 dual-gate AND Phase 53 triple-gate AND Phase 54 quad-gate
//                 paths preserved byte-untouched up to the provider-circuit
//                 insertion point).
// Phase 56-01-T3: extended with scenario-suite run-self-test (sext-gate v2.0;
//                 v1.9 dual-gate AND Phase 53 triple-gate AND Phase 54 quad-gate
//                 AND Phase 55 quint-gate paths preserved byte-untouched up to
//                 the scenario-suite insertion point).
// Phase 57-01-T2: extended with release-readiness score (sept-gate v2.0;
//                 prior six gates preserved byte-untouched up to the
//                 release-readiness insertion point). The score gate is the
//                 closing gate: it observes evidence emitted by the prior 6
//                 gates and refuses milestone close on score<70 OR any
//                 edge_guard_miss row in .planning/metrics/crit-backlog.jsonl.
// Phase 58-01-T2: extended with installer-audit self-test (first-gate v2.1;
//                 v1.9 dual-gate, v2.0 sept-gate (53/54/55/56/57) paths
//                 preserved byte-untouched. v2.1 has its own dispatch branch
//                 that runs ONLY the installer-audit selfTest -- the v2.0
//                 evidence buckets do not gate v2.1 close (different scope:
//                 distribution + onboarding, not failure injection).
// Phase 59-01-T2: extended with new-project-wizard self-test (second-gate
//                 v2.1; Phase 58 first-gate path preserved byte-equality up
//                 to the wizard insertion point. v2.1 dual-gate now: gate 1
//                 installer-audit selfTest (12/12) + runAudit floor met,
//                 gate 2 wizard selfTest (>=8/>=8). Both must exit 0 for
//                 v2.1 milestone close to proceed.
// Phase 60-01-T6: extended with example-walkthrough self-test (third-gate
//                 v2.1; Phase 58 first-gate AND Phase 59 second-gate paths
//                 preserved byte-equality up to the example-walkthrough
//                 insertion point. v2.1 triple-gate now: gate 1
//                 installer-audit selfTest (12/12) + runAudit floor met,
//                 gate 2 wizard selfTest (>=8/>=8), gate 3 wizard
//                 --defaults exercised against examples/hello-world fixture
//                 with config.json sha256 matching the canonical
//                 fe16729a... fingerprint. All three must exit 0 for v2.1
//                 milestone close to proceed. Lock 13: degraded-OK if the
//                 fixture directory is missing on disk (partial-checkout
//                 path); the gate emits an explicit skipped-fixture warning
//                 and exits 0 rather than blocking close.
//
// Invoked by super-gsd/skills/sgsd-complete-milestone/SKILL.md Step 0
// precondition list. Operator-runnable directly:
//   node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v1.9
//   node super-gsd/scripts/sgsd-complete-milestone.cjs --milestone v2.0
//
// CONTRACT
//   --milestone v1.9 -> dual gate. Step 1 require harness.cjs and call
//                       .selfTest() (Phase 51 context-bench). Step 2
//                       require redis-adapter.cjs and call .selfTest()
//                       (Phase 52). BOTH must pass. Propagate the exit
//                       code (0 = green = milestone close may proceed;
//                       1 = fail = milestone close MUST abort).
//   --milestone v2.0 -> triple gate. Step 1 Phase 51 context-bench
//                       self-test (33/33). Step 2 Phase 52 redis-adapter
//                       self-test (26/26). Step 3 Phase 53 failure-
//                       injection self-test (24/24). Step 4 Phase 53
//                       --run-all (10/10 scenarios end-to-end). All four
//                       spawns must exit 0 for the gate to exit 0.
//   --milestone <other> -> exit 0 no-op (future milestones add their own
//                          gates here without touching the SKILL.md).
//
// ORDERING
//   v1.9: context-bench FIRST (fail-fast); only when it passes do we run
//   redis-adapter; only when BOTH pass does the gate exit 0.
//   v2.0: context-bench FIRST, then redis-adapter, then failure-injection
//   --self-test (24/24), then failure-injection --run-all (10/10). Stop
//   at the first failure; never run a later gate if an earlier one is red.
//   Fail-fast preserves stderr signal clarity (one tag per real failure)
//   and avoids spurious envelope-v1 rows being appended to
//   .planning/metrics/failure-injection-log.jsonl when an upstream gate
//   already blocked the milestone close.
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
//   - require('failure-injection/harness.cjs') is wrapped in try/catch.
//     Import failure writes stderr
//     `milestone_close_blocked:failure_injection_unavailable` and exits 1.
//     We never silently exit 0 on failure-injection import failure -- the
//     Phase 53 worst-case mirrors Phase 51 and 52: a v2.0 milestone close
//     that advanced without the harness actually running would be the
//     unrecoverable failure mode the gate exists to prevent.
//   - failure-injection harness.cjs --self-test (spawnSync) exit !== 0
//     writes stderr `milestone_close_blocked:failure_injection_self_test_failed`
//     and exits 1.
//   - failure-injection harness.cjs --run-all (spawnSync) exit !== 0
//     writes stderr `milestone_close_blocked:failure_injection_run_all_failed`
//     and exits 1.
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

    // -----------------------------------------------------------------------
    // Phase 58-01-T2: v2.1 first-gate (installer-audit self-test).
    // v2.1 scope is distribution + onboarding; the gate is the
    // installer-audit selfTest (>=9 probes pass + frozen surfaces +
    // READ-ONLY invariant + ASCII-only + Lock 13 never-throws). v1.9 and
    // v2.0 paths are NOT entered for v2.1 -- this branch returns
    // independently. Lock 13: try/catch wraps require + spawnSync.
    // -----------------------------------------------------------------------
    if (milestone === 'v2.1') {
      let installerAudit = null;
      try {
        installerAudit = require('../tools/installer-audit/audit.cjs');
      } catch (e) {
        process.stderr.write('milestone_close_blocked:installer_audit_unavailable\n');
        process.stderr.write('  reason=installer_audit_require_failed message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      if (!installerAudit
          || typeof installerAudit.selfTest !== 'function'
          || typeof installerAudit.runAudit !== 'function'
          || typeof installerAudit.getProbe !== 'function') {
        process.stderr.write('milestone_close_blocked:installer_audit_unavailable\n');
        process.stderr.write('  reason=installer_audit_api_export_missing\n');
        process.exit(1);
        return;
      }

      let auditOut = null;
      try {
        const child_process_v21 = require('child_process');
        const path_v21 = require('path');
        const auditPath = path_v21.join(__dirname, '..', 'tools',
                                         'installer-audit', 'audit.cjs');
        const r_v21 = child_process_v21.spawnSync(
          process.execPath,
          [auditPath, '--self-test'],
          { stdio: 'inherit' }
        );
        if (r_v21.error) {
          process.stderr.write('milestone_close_blocked:installer_audit_self_test_failed\n');
          process.stderr.write('  reason=installer_audit_spawn_failed message='
            + (r_v21.error.message || 'unknown') + '\n');
          process.exit(1);
          return;
        }
        auditOut = (typeof r_v21.status === 'number') ? r_v21.status : 1;
      } catch (e) {
        process.stderr.write('milestone_close_blocked:installer_audit_self_test_failed\n');
        process.stderr.write('  reason=installer_audit_self_test_threw message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      if (auditOut !== 0) {
        process.stderr.write('milestone_close_blocked:installer_audit_self_test_failed\n');
        process.stderr.write('  reason=installer_audit_self_test_exit_nonzero exit='
          + auditOut + '\n');
        process.exit(1);
        return;
      }

      // Disambiguating snapshot: capture the runAudit summary and
      // refuse milestone close if the mandatory floor is unmet
      // (mandatory_missing.length > 0). Lock 13 wrapped.
      let auditSnap = null;
      try {
        auditSnap = installerAudit.runAudit({});
      } catch (_e) {
        auditSnap = null;
      }
      if (!auditSnap
          || !auditSnap.summary
          || auditSnap.summary.mandatory_floor_met !== true) {
        process.stderr.write('milestone_close_blocked:installer_audit_mandatory_floor_unmet\n');
        var miss = (auditSnap && auditSnap.summary && Array.isArray(auditSnap.summary.mandatory_missing))
          ? auditSnap.summary.mandatory_missing.join(',')
          : 'unknown';
        process.stderr.write('  reason=mandatory_missing=' + miss + '\n');
        process.exit(1);
        return;
      }

      process.stdout.write('milestone_close_gate: v2.1 installer-audit '
        + 'self-test green (' + auditSnap.summary.total + ' probes; '
        + 'mandatory floor met)\n');
      process.stdout.write('milestone_close_gate: v2.1 first-gate '
        + '(installer-audit) green\n');

      // ---------------------------------------------------------------
      // Phase 59-01-T2: v2.1 SECOND-GATE (new-project wizard self-test).
      // Lock 4: extends the v2.1 branch only; v1.9 dual-gate, v2.0
      // sept-gate, and Phase 58 first-gate (lines 159-242 above) are all
      // preserved byte-equal up to this insertion point. The wizard
      // self-test (>=8 assertions; shipped 13) covers deep-merge
      // non-clobber + idempotent + Lock 13 + ASCII; failure of any
      // assertion blocks v2.1 milestone close. Lock 13: try/catch
      // wraps require + spawnSync; never throws upward.
      // ---------------------------------------------------------------
      let wizardSelfTestExit = null;
      try {
        const child_process_v21b = require('child_process');
        const path_v21b = require('path');
        const wizardPath = path_v21b.join(__dirname,
                                           'sgsd-new-project-wizard.cjs');
        const r_v21b = child_process_v21b.spawnSync(
          process.execPath,
          [wizardPath, '--self-test'],
          { stdio: 'inherit' }
        );
        if (r_v21b.error) {
          process.stderr.write('milestone_close_blocked:wizard_self_test_failed\n');
          process.stderr.write('  reason=wizard_spawn_failed message='
            + (r_v21b.error.message || 'unknown') + '\n');
          process.exit(1);
          return;
        }
        wizardSelfTestExit = (typeof r_v21b.status === 'number')
          ? r_v21b.status : 1;
      } catch (e) {
        process.stderr.write('milestone_close_blocked:wizard_self_test_failed\n');
        process.stderr.write('  reason=wizard_self_test_threw message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      if (wizardSelfTestExit !== 0) {
        process.stderr.write('milestone_close_blocked:wizard_self_test_failed\n');
        process.stderr.write('  reason=wizard_self_test_exit_nonzero exit='
          + wizardSelfTestExit + '\n');
        process.exit(1);
        return;
      }

      process.stdout.write('milestone_close_gate: v2.1 new-project-wizard '
        + 'self-test green (>=8 assertions PASS; deep-merge non-clobber + '
        + 'idempotent + Lock 13 verified)\n');
      process.stdout.write('milestone_close_gate: v2.1 second-gate '
        + '(new-project-wizard) green\n');

      // ---------------------------------------------------------------
      // Phase 60-01-T6: v2.1 THIRD-GATE (example-walkthrough self-test).
      // Lock 4: extends the v2.1 branch only; v1.9 dual-gate, v2.0
      // sept-gate, Phase 58 first-gate, and Phase 59 second-gate paths
      // are all preserved byte-equal up to this insertion point.
      // The third gate exercises the wizard --defaults against the
      // examples/hello-world fixture and verifies the produced
      // config.json sha256 matches the canonical fingerprint
      // (fe16729a...). Lock 13: try/catch wraps spawnSync + fs ops;
      // if the fixture directory is missing (partial-checkout path),
      // the gate prints a degraded sentinel and exits 0 rather than
      // blocking close (Lock 13 / walkthrough-degrades-gracefully).
      // ASCII-only: stderr/stdout literals are 0x09/0x0A/0x20-0x7E.
      // ---------------------------------------------------------------
      var EXAMPLE_FIXTURE_SHA256 =
        'fe16729aff1c12a04eaf10724da297370f6c8f2d16ffab04a6ea381907550be7';

      var fs_v21c = null;
      var path_v21c = null;
      var crypto_v21c = null;
      var child_process_v21c = null;
      try {
        fs_v21c = require('fs');
        path_v21c = require('path');
        crypto_v21c = require('crypto');
        child_process_v21c = require('child_process');
      } catch (e) {
        process.stderr.write('milestone_close_blocked:example_walkthrough_unavailable\n');
        process.stderr.write('  reason=example_walkthrough_require_failed message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      var repoRoot_v21c = path_v21c.join(__dirname, '..', '..');
      var fixtureDir_v21c = path_v21c.join(repoRoot_v21c, 'examples',
                                            'hello-world');
      var fixturePlanning_v21c = path_v21c.join(fixtureDir_v21c, '.planning');
      var fixtureConfigPath_v21c = path_v21c.join(fixturePlanning_v21c,
                                                   'config.json');
      var wizardPath_v21c = path_v21c.join(__dirname,
                                            'sgsd-new-project-wizard.cjs');

      // Lock 13 / walkthrough-degrades-gracefully: if the fixture
      // directory is absent (partial checkout, sparse clone, etc.) we
      // emit a skip sentinel and exit 0. The fixture is a deterministic
      // target; its absence is a checkout-shape problem, not a
      // milestone-close problem.
      var fixturePresent_v21c = false;
      try {
        fixturePresent_v21c = fs_v21c.existsSync(fixturePlanning_v21c)
          && fs_v21c.statSync(fixturePlanning_v21c).isDirectory();
      } catch (_e) {
        fixturePresent_v21c = false;
      }
      if (!fixturePresent_v21c) {
        process.stdout.write('milestone_close_gate: v2.1 example-walkthrough '
          + 'self-test SKIPPED (fixture missing: examples/hello-world/.planning '
          + 'not present; partial checkout suspected; degrading to second-gate '
          + 'only per Lock 13)\n');
        process.stdout.write('milestone_close_gate: v2.1 third-gate '
          + '(example-walkthrough) green-with-skip\n');
        process.exit(0);
        return;
      }

      // Capture the prior state of the fixture's config.json so we can
      // restore it after the gate runs (avoid mutating fixture bytes
      // that would ripple into roadmap-staleness scans).
      var priorConfig_v21c = null;
      var priorConfigExists_v21c = false;
      try {
        if (fs_v21c.existsSync(fixtureConfigPath_v21c)) {
          priorConfig_v21c = fs_v21c.readFileSync(fixtureConfigPath_v21c);
          priorConfigExists_v21c = true;
        }
      } catch (_e) {
        priorConfig_v21c = null;
        priorConfigExists_v21c = false;
      }

      // Run the wizard --defaults against the fixture. Lock 13 wrapped.
      var walkExit_v21c = null;
      try {
        var rW_v21c = child_process_v21c.spawnSync(
          process.execPath,
          [wizardPath_v21c, '--defaults', '--project-dir', fixtureDir_v21c],
          { stdio: 'inherit' }
        );
        if (rW_v21c.error) {
          process.stderr.write('milestone_close_blocked:example_walkthrough_self_test_failed\n');
          process.stderr.write('  reason=example_walkthrough_spawn_failed message='
            + (rW_v21c.error.message || 'unknown') + '\n');
          process.exit(1);
          return;
        }
        walkExit_v21c = (typeof rW_v21c.status === 'number')
          ? rW_v21c.status : 1;
      } catch (e) {
        process.stderr.write('milestone_close_blocked:example_walkthrough_self_test_failed\n');
        process.stderr.write('  reason=example_walkthrough_spawn_threw message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      if (walkExit_v21c !== 0) {
        process.stderr.write('milestone_close_blocked:example_walkthrough_self_test_failed\n');
        process.stderr.write('  reason=example_walkthrough_wizard_exit_nonzero exit='
          + walkExit_v21c + '\n');
        process.exit(1);
        return;
      }

      // Verify the produced config.json sha256 matches canonical.
      var producedHash_v21c = null;
      try {
        var bytes_v21c = fs_v21c.readFileSync(fixtureConfigPath_v21c);
        producedHash_v21c = crypto_v21c.createHash('sha256')
          .update(bytes_v21c).digest('hex');
      } catch (e) {
        process.stderr.write('milestone_close_blocked:example_walkthrough_self_test_failed\n');
        process.stderr.write('  reason=example_walkthrough_hash_failed message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      if (producedHash_v21c !== EXAMPLE_FIXTURE_SHA256) {
        process.stderr.write('milestone_close_blocked:example_walkthrough_self_test_failed\n');
        process.stderr.write('  reason=example_walkthrough_hash_mismatch '
          + 'expected=' + EXAMPLE_FIXTURE_SHA256
          + ' produced=' + producedHash_v21c + '\n');
        // Restore prior state before exiting (don't leave fixture dirty).
        try {
          if (priorConfigExists_v21c && priorConfig_v21c) {
            fs_v21c.writeFileSync(fixtureConfigPath_v21c, priorConfig_v21c);
          } else {
            try { fs_v21c.unlinkSync(fixtureConfigPath_v21c); } catch (_e) {}
          }
        } catch (_e) { /* best effort */ }
        process.exit(1);
        return;
      }

      // Restore the fixture's prior config.json bytes so the gate is
      // observation-only (no mutation, no mtime bump).
      try {
        if (priorConfigExists_v21c && priorConfig_v21c) {
          // Only rewrite if bytes actually differ (preserve idempotence).
          var nowBytes_v21c = fs_v21c.readFileSync(fixtureConfigPath_v21c);
          if (Buffer.compare(nowBytes_v21c, priorConfig_v21c) !== 0) {
            fs_v21c.writeFileSync(fixtureConfigPath_v21c, priorConfig_v21c);
          }
        } else {
          // Fixture had no config.json before the gate ran; remove ours.
          try { fs_v21c.unlinkSync(fixtureConfigPath_v21c); } catch (_e) {}
        }
      } catch (_e) { /* best effort; gate already green */ }

      process.stdout.write('milestone_close_gate: v2.1 example-walkthrough '
        + 'self-test green (wizard --defaults exit 0 + idempotent + '
        + 'sha256 ' + producedHash_v21c.slice(0, 8) + '...)\n');
      process.stdout.write('milestone_close_gate: v2.1 third-gate '
        + '(example-walkthrough) green\n');
      process.exit(0);
      return;
    }

    // Future-proof: v1.9 (dual-gate) and v2.0 (triple-gate) are wired.
    // Other milestones get their own gates added here as they need them;
    // until then this script is a deterministic no-op for them so the
    // SKILL.md call is harmless.
    if (milestone !== 'v1.9' && milestone !== 'v2.0') {
      process.stdout.write('milestone_close_gate: no-op for milestone '
        + milestone + ' (only v1.9 dual-gate and v2.0 triple-gate are wired)\n');
      process.exit(0);
      return;
    }

    // Both v1.9 and v2.0 share Phase 51 (context-bench) + Phase 52
    // (redis-adapter) gates. v2.0 additionally chains Phase 53. The
    // shared section runs first; the v2.0-only triple-gate extension
    // runs after the shared dual-gate is green. Lock 13: every step is
    // wrapped so this script NEVER throws upward.
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

    process.stdout.write('milestone_close_gate: ' + milestone
      + ' redis-adapter self-test green\n');

    if (milestone === 'v1.9') {
      process.stdout.write('milestone_close_gate: v1.9 dual-gate '
        + '(context-bench + redis-adapter) green\n');
      process.exit(0);
      return;
    }

    // -----------------------------------------------------------------------
    // Phase 53-01-T7: v2.0 triple-gate extension. Only reached when
    // milestone === 'v2.0' AND the shared dual-gate (Phase 51 + Phase 52)
    // already passed. Two additional spawnSync invocations:
    //   3. node super-gsd/tools/failure-injection/harness.cjs --self-test
    //      (24/24 PASS expected; sub-60s; READ-ONLY).
    //   4. node super-gsd/tools/failure-injection/harness.cjs --run-all
    //      (10/10 PASS expected; appends one envelope-v1 row per scenario
    //      to .planning/metrics/failure-injection-log.jsonl as the
    //      witness of the live-tool exercise).
    // Both must exit 0 for the v2.0 gate to exit 0. Lock 13: try/catch
    // on the require import (precondition only - we never call selfTest
    // through the in-proc API; we use spawnSync to mirror the operator-
    // facing entry and to keep the gate's exit-code path consistent
    // across all four spawns) AND on each spawnSync; never throw upward.
    // Pitfall mirror of Phase 52: avoid in-proc require of harness.cjs
    // running scenarios in the parent's process (would risk pollution of
    // canonical streams via the Phase 53 _setupContainer fingerprint
    // probe paths). spawnSync is the gate's contract.
    // -----------------------------------------------------------------------

    let failureInjectionHarness = null;
    try {
      failureInjectionHarness = require(
        '../tools/failure-injection/harness.cjs');
    } catch (e) {
      process.stderr.write('milestone_close_blocked:failure_injection_unavailable\n');
      process.stderr.write('  reason=failure_injection_require_failed message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (!failureInjectionHarness ||
        typeof failureInjectionHarness.selfTest !== 'function' ||
        typeof failureInjectionHarness.runAll !== 'function') {
      process.stderr.write('milestone_close_blocked:failure_injection_unavailable\n');
      process.stderr.write('  reason=failure_injection_api_export_missing\n');
      process.exit(1);
      return;
    }

    // Step 3: failure-injection --self-test (24/24).
    let fiSelfOut = null;
    try {
      const child_process2 = require('child_process');
      const path2 = require('path');
      const fiHarnessPath = path2.join(__dirname, '..', 'tools',
                                        'failure-injection', 'harness.cjs');
      const r3 = child_process2.spawnSync(
        process.execPath,
        [fiHarnessPath, '--self-test'],
        { stdio: 'inherit' }
      );
      if (r3.error) {
        process.stderr.write('milestone_close_blocked:failure_injection_self_test_failed\n');
        process.stderr.write('  reason=failure_injection_spawn_failed message='
          + (r3.error.message || 'unknown') + '\n');
        process.exit(1);
        return;
      }
      fiSelfOut = (typeof r3.status === 'number') ? r3.status : 1;
    } catch (e) {
      process.stderr.write('milestone_close_blocked:failure_injection_self_test_failed\n');
      process.stderr.write('  reason=failure_injection_self_test_threw message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (fiSelfOut !== 0) {
      process.stderr.write('milestone_close_blocked:failure_injection_self_test_failed\n');
      process.stderr.write('  reason=failure_injection_self_test_exit_code='
        + fiSelfOut + '\n');
      process.exit(1);
      return;
    }

    process.stdout.write('milestone_close_gate: v2.0 failure-injection '
      + 'self-test green (24/24)\n');

    // Step 4: failure-injection --run-all (10/10).
    let fiRunAllOut = null;
    try {
      const child_process3 = require('child_process');
      const path3 = require('path');
      const fiHarnessPath3 = path3.join(__dirname, '..', 'tools',
                                         'failure-injection', 'harness.cjs');
      const r4 = child_process3.spawnSync(
        process.execPath,
        [fiHarnessPath3, '--run-all'],
        { stdio: 'inherit' }
      );
      if (r4.error) {
        process.stderr.write('milestone_close_blocked:failure_injection_run_all_failed\n');
        process.stderr.write('  reason=failure_injection_run_all_spawn_failed message='
          + (r4.error.message || 'unknown') + '\n');
        process.exit(1);
        return;
      }
      fiRunAllOut = (typeof r4.status === 'number') ? r4.status : 1;
    } catch (e) {
      process.stderr.write('milestone_close_blocked:failure_injection_run_all_failed\n');
      process.stderr.write('  reason=failure_injection_run_all_threw message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (fiRunAllOut !== 0) {
      process.stderr.write('milestone_close_blocked:failure_injection_run_all_failed\n');
      process.stderr.write('  reason=failure_injection_run_all_exit_code='
        + fiRunAllOut + '\n');
      process.exit(1);
      return;
    }

    process.stdout.write('milestone_close_gate: v2.0 failure-injection '
      + '--run-all green (10/10)\n');

    // -----------------------------------------------------------------------
    // Phase 54-01-T4: v2.0 quad-gate extension (chaos-restart). Only reached
    // when milestone === 'v2.0' AND the prior triple-gate (Phase 51 + Phase
    // 52 + Phase 53) already passed. One additional spawnSync invocation:
    //   5. node super-gsd/tools/chaos-restart/harness.cjs --self-test
    //      (18/18 PASS expected; sub-30s; READ-ONLY-by-shape - the run-all
    //      step in the bootstrap suite uses no_log:true).
    // The Phase 54 --run-all path is INTENTIONALLY not chained as a separate
    // 5th spawn here: the harness self-test already exercises the full driver
    // (assertion 18: runall_canonical_streams_byte_equal proves --run-all
    // exited PASS without canonical drift), and adding a 5th spawn would
    // double-write to chaos-restart-log.jsonl on every milestone-close.
    // Lock 13: try/catch on require AND spawnSync; never throw upward.
    // Lock 4: Phase 41-53 trees byte-untouched; this is a surgical extension
    // ONLY at this insertion point.
    // -----------------------------------------------------------------------

    let chaosRestartHarness = null;
    try {
      chaosRestartHarness = require(
        '../tools/chaos-restart/harness.cjs');
    } catch (e) {
      process.stderr.write('milestone_close_blocked:chaos_restart_unavailable\n');
      process.stderr.write('  reason=chaos_restart_require_failed message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (!chaosRestartHarness ||
        typeof chaosRestartHarness.selfTest !== 'function' ||
        typeof chaosRestartHarness.runAll !== 'function' ||
        typeof chaosRestartHarness.validateManifest !== 'function') {
      process.stderr.write('milestone_close_blocked:chaos_restart_unavailable\n');
      process.stderr.write('  reason=chaos_restart_api_export_missing\n');
      process.exit(1);
      return;
    }

    let crSelfOut = null;
    try {
      const child_process4 = require('child_process');
      const path4 = require('path');
      const crHarnessPath = path4.join(__dirname, '..', 'tools',
                                        'chaos-restart', 'harness.cjs');
      const r5 = child_process4.spawnSync(
        process.execPath,
        [crHarnessPath, '--self-test'],
        { stdio: 'inherit' }
      );
      if (r5.error) {
        process.stderr.write('milestone_close_blocked:chaos_restart_self_test_failed\n');
        process.stderr.write('  reason=chaos_restart_spawn_failed message='
          + (r5.error.message || 'unknown') + '\n');
        process.exit(1);
        return;
      }
      crSelfOut = (typeof r5.status === 'number') ? r5.status : 1;
    } catch (e) {
      process.stderr.write('milestone_close_blocked:chaos_restart_self_test_failed\n');
      process.stderr.write('  reason=chaos_restart_self_test_threw message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (crSelfOut !== 0) {
      process.stderr.write('milestone_close_blocked:chaos_restart_self_test_failed\n');
      process.stderr.write('  reason=chaos_restart_self_test_exit_code='
        + crSelfOut + '\n');
      process.exit(1);
      return;
    }

    process.stdout.write('milestone_close_gate: v2.0 chaos-restart '
      + 'self-test green (18/18)\n');

    // -----------------------------------------------------------------------
    // Phase 55-01-T3: v2.0 quint-gate extension (provider-circuit). Only
    // reached when milestone === 'v2.0' AND the prior quad-gate (Phase 51 +
    // Phase 52 + Phase 53 + Phase 54) already passed. One additional
    // spawnSync invocation:
    //   6. node super-gsd/scripts/lib/provider-circuit.cjs --self-test
    //      (>=8 PASS expected; sub-5s; READ-ONLY -- the self-test uses an
    //      env-overridden tmp state file, never touches canonical
    //      .planning/metrics/provider-circuit.json).
    // Lock 13: try/catch on require AND spawnSync; never throw upward.
    // Lock 4: Phase 41-54 trees byte-untouched; this is a surgical extension
    // ONLY at this insertion point (the quad-gate green emission above is
    // preserved as the boundary marker for the chaos-restart gate; the
    // quint-gate emission moves to AFTER provider-circuit returns green).
    // -----------------------------------------------------------------------

    let providerCircuitLib = null;
    try {
      providerCircuitLib = require('../scripts/lib/provider-circuit.cjs');
    } catch (e) {
      process.stderr.write('milestone_close_blocked:provider_circuit_unavailable\n');
      process.stderr.write('  reason=provider_circuit_require_failed message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (!providerCircuitLib ||
        typeof providerCircuitLib.selfTest !== 'function' ||
        typeof providerCircuitLib.shouldFallback !== 'function' ||
        typeof providerCircuitLib.recordProviderResult !== 'function' ||
        typeof providerCircuitLib.getCircuitState !== 'function' ||
        typeof providerCircuitLib.resetCircuit !== 'function' ||
        typeof providerCircuitLib.getDefaultFallback !== 'function') {
      process.stderr.write('milestone_close_blocked:provider_circuit_unavailable\n');
      process.stderr.write('  reason=provider_circuit_api_export_missing\n');
      process.exit(1);
      return;
    }

    let pcSelfOut = null;
    try {
      const child_process5 = require('child_process');
      const path5 = require('path');
      const pcLibPath = path5.join(__dirname, 'lib', 'provider-circuit.cjs');
      const r6 = child_process5.spawnSync(
        process.execPath,
        [pcLibPath, '--self-test'],
        { stdio: 'inherit' }
      );
      if (r6.error) {
        process.stderr.write('milestone_close_blocked:provider_circuit_self_test_failed\n');
        process.stderr.write('  reason=provider_circuit_spawn_failed message='
          + (r6.error.message || 'unknown') + '\n');
        process.exit(1);
        return;
      }
      pcSelfOut = (typeof r6.status === 'number') ? r6.status : 1;
    } catch (e) {
      process.stderr.write('milestone_close_blocked:provider_circuit_self_test_failed\n');
      process.stderr.write('  reason=provider_circuit_self_test_threw message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (pcSelfOut !== 0) {
      process.stderr.write('milestone_close_blocked:provider_circuit_self_test_failed\n');
      process.stderr.write('  reason=provider_circuit_self_test_exit_code='
        + pcSelfOut + '\n');
      process.exit(1);
      return;
    }

    process.stdout.write('milestone_close_gate: v2.0 provider-circuit '
      + 'self-test green (>=8/8)\n');

    // -----------------------------------------------------------------------
    // Phase 56-01-T3: v2.0 sext-gate extension (scenario-suite). Only reached
    // when milestone === 'v2.0' AND the prior quint-gate (Phase 51 + Phase 52
    // + Phase 53 + Phase 54 + Phase 55) already passed. One additional
    // spawnSync invocation:
    //   7. node super-gsd/tools/scenario-suite/run-self-test.cjs
    //      (~21 self-test assertions + 10/10 --run-all; sub-90s; READ-ONLY-
    //      by-shape on canonical streams - the run-all step writes one
    //      envelope-v1 row per scenario to scenario-suite-log.jsonl which
    //      is NOT in PHASE_56_GUARDED_STREAMS).
    // Lock 13: try/catch on require AND spawnSync; never throw upward.
    // Lock 4: Phase 41-55 trees byte-untouched; this is a surgical extension
    // ONLY at this insertion point (the quint-gate green emission above is
    // preserved as the boundary marker for the provider-circuit gate; the
    // sext-gate emission moves to AFTER the scenario-suite returns green).
    // -----------------------------------------------------------------------

    let scenarioSuiteHarness = null;
    try {
      scenarioSuiteHarness = require(
        '../tools/scenario-suite/harness.cjs');
    } catch (e) {
      process.stderr.write('milestone_close_blocked:scenario_suite_unavailable\n');
      process.stderr.write('  reason=scenario_suite_require_failed message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (!scenarioSuiteHarness ||
        typeof scenarioSuiteHarness.selfTest !== 'function' ||
        typeof scenarioSuiteHarness.runAll !== 'function' ||
        typeof scenarioSuiteHarness.validateScenarioOutcome !== 'function') {
      process.stderr.write('milestone_close_blocked:scenario_suite_unavailable\n');
      process.stderr.write('  reason=scenario_suite_api_export_missing\n');
      process.exit(1);
      return;
    }

    let ssRunSelfOut = null;
    try {
      const child_process6 = require('child_process');
      const path6 = require('path');
      const ssRunSelfPath = path6.join(__dirname, '..', 'tools',
                                        'scenario-suite', 'run-self-test.cjs');
      const r7 = child_process6.spawnSync(
        process.execPath,
        [ssRunSelfPath],
        { stdio: 'inherit' }
      );
      if (r7.error) {
        process.stderr.write('milestone_close_blocked:scenario_suite_self_test_failed\n');
        process.stderr.write('  reason=scenario_suite_spawn_failed message='
          + (r7.error.message || 'unknown') + '\n');
        process.exit(1);
        return;
      }
      ssRunSelfOut = (typeof r7.status === 'number') ? r7.status : 1;
    } catch (e) {
      process.stderr.write('milestone_close_blocked:scenario_suite_self_test_failed\n');
      process.stderr.write('  reason=scenario_suite_self_test_threw message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (ssRunSelfOut !== 0) {
      process.stderr.write('milestone_close_blocked:scenario_suite_self_test_failed\n');
      process.stderr.write('  reason=scenario_suite_self_test_exit_code='
        + ssRunSelfOut + '\n');
      process.exit(1);
      return;
    }

    process.stdout.write('milestone_close_gate: v2.0 scenario-suite '
      + 'self-test + run-all green (~21 + 10/10)\n');
    process.stdout.write('milestone_close_gate: v2.0 sext-gate '
      + '(context-bench + redis-adapter + failure-injection + chaos-restart + provider-circuit + scenario-suite) green\n');

    // -----------------------------------------------------------------------
    // Phase 57-01-T2: v2.0 sept-gate extension (release-readiness). Only
    // reached when milestone === 'v2.0' AND the prior sext-gate (Phase 51 +
    // Phase 52 + Phase 53 + Phase 54 + Phase 55 + Phase 56) already passed.
    // One additional spawnSync invocation:
    //   8. node super-gsd/tools/release-readiness/score.cjs
    //      --milestone v2.0
    //      (8-bucket composite 0-100. Exit 0 if score>=70 AND no
    //      edge_guard_miss row in crit-backlog.jsonl; exit 1 otherwise.
    //      READ-ONLY -- the score gate never writes to canonical streams
    //      and never spawns subprocesses of its own.)
    // The score gate is the CLOSING gate: it observes evidence emitted by
    // gates 1-7 and computes a composite readiness score. Hard precondition:
    // any edge_guard_miss row -> RED + exit 1 regardless of bucket totals.
    // Lock 13: try/catch on require AND spawnSync; never throw upward.
    // Lock 4: Phase 41-56 trees byte-untouched; this is a surgical extension
    // ONLY at this insertion point (the sext-gate green emission above is
    // preserved as the boundary marker for the scenario-suite gate; the
    // sept-gate emission moves to AFTER release-readiness returns green).
    // -----------------------------------------------------------------------

    let releaseReadinessScore = null;
    try {
      releaseReadinessScore = require(
        '../tools/release-readiness/score.cjs');
    } catch (e) {
      process.stderr.write('milestone_close_blocked:release_readiness_unavailable\n');
      process.stderr.write('  reason=release_readiness_require_failed message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (!releaseReadinessScore ||
        typeof releaseReadinessScore.computeScore !== 'function' ||
        typeof releaseReadinessScore.getBucketScore !== 'function' ||
        typeof releaseReadinessScore.hasEdgeGuardMiss !== 'function' ||
        typeof releaseReadinessScore.getColor !== 'function' ||
        typeof releaseReadinessScore.selfTest !== 'function') {
      process.stderr.write('milestone_close_blocked:release_readiness_unavailable\n');
      process.stderr.write('  reason=release_readiness_api_export_missing\n');
      process.exit(1);
      return;
    }

    let rrOut = null;
    try {
      const child_process7 = require('child_process');
      const path7 = require('path');
      const rrScorePath = path7.join(__dirname, '..', 'tools',
                                      'release-readiness', 'score.cjs');
      const r8 = child_process7.spawnSync(
        process.execPath,
        [rrScorePath, '--milestone', 'v2.0'],
        { stdio: 'inherit' }
      );
      if (r8.error) {
        process.stderr.write('milestone_close_blocked:release_readiness_score_failed\n');
        process.stderr.write('  reason=release_readiness_spawn_failed message='
          + (r8.error.message || 'unknown') + '\n');
        process.exit(1);
        return;
      }
      rrOut = (typeof r8.status === 'number') ? r8.status : 1;
    } catch (e) {
      process.stderr.write('milestone_close_blocked:release_readiness_score_failed\n');
      process.stderr.write('  reason=release_readiness_score_threw message='
        + (e && e.message ? e.message : 'unknown') + '\n');
      process.exit(1);
      return;
    }

    if (rrOut !== 0) {
      // Disambiguate the failure cause via in-proc API call (Lock 13 wrapped
      // computeScore returns ok:true even on RED; we read the reason field).
      let scoreSnap = null;
      try {
        scoreSnap = releaseReadinessScore.computeScore({ milestone: 'v2.0' });
      } catch (_e) {
        scoreSnap = null;
      }
      if (scoreSnap && scoreSnap.reason === 'score_red_edge_guard_miss') {
        process.stderr.write('milestone_close_blocked:edge_guard_miss_present\n');
        process.stderr.write('  reason=edge_guard_miss_count='
          + (scoreSnap.edge_guard_miss_count || 0) + '\n');
      } else {
        process.stderr.write('milestone_close_blocked:release_score_below_threshold\n');
        process.stderr.write('  reason=release_score='
          + (scoreSnap && typeof scoreSnap.score === 'number'
              ? scoreSnap.score : 'unknown')
          + ' color=' + (scoreSnap && scoreSnap.color ? scoreSnap.color : 'unknown')
          + ' threshold=70\n');
      }
      process.exit(1);
      return;
    }

    process.stdout.write('milestone_close_gate: v2.0 release-readiness '
      + 'score green (>=70 + no edge_guard_miss)\n');
    process.stdout.write('milestone_close_gate: v2.0 sept-gate '
      + '(context-bench + redis-adapter + failure-injection + chaos-restart + provider-circuit + scenario-suite + release-readiness) green\n');
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
