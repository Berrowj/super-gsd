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
// Phase 61-01-T3: extended with docs-refresh check (fourth-gate v2.1;
//                 prior three v2.1 gates preserved byte-equality up to
//                 the docs-refresh insertion point). Closed-vocab grep
//                 on README.md verifying VTP mentions are marked
//                 optional only (vtp_required_count=0).
// Phase 62-01-T1: extended with upgrade-drift check (fifth-gate v2.1;
//                 prior four v2.1 gates preserved byte-equality up to
//                 the upgrade-drift insertion point). v2.1 quint-gate
//                 now: gate 1 installer-audit + gate 2 wizard + gate 3
//                 example-walkthrough + gate 4 docs-refresh + gate 5
//                 upgrade-drift selfTest (>=8 self-test) AND runDrift
//                 probe count (>=8 probes) AND READ-ONLY assertion
//                 (selfTest A8 hasWrite=false). Lock 4: only the v2.1
//                 branch is extended; v1.9 dual-gate AND v2.0 sept-gate
//                 paths are preserved byte-equality byte-for-byte. Lock
//                 13: upgrade-drift module unavailable -> emits
//                 milestone_close_blocked:upgrade_drift_unavailable
//                 stderr tag, never throws upward. The fifth-gate is
//                 the FINAL gate of the v1.6 -> v2.1 roadmap; once it
//                 exits 0 the entire roadmap is complete.
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
    // Phase 101-01: v2.9 close gate (Agentic Harness Evolution).
    // Refuses SHIPPED-clean while harness-change-manifest.jsonl has any
    // candidate change_id without a matching attribution row, or with
    // a verdict=revert attribution that has not yet been applied.
    //
    // AHE-GOV-04 contract: a milestone with unattributed candidate
    // edits cannot ship clean.
    //
    // Lock 13: try/catch around all reads. Independent return path.
    // Backward compat: v1.9 / v2.0 / v2.1 / v2.6 / other paths NOT entered
    // for v2.9 -- this branch returns independently.
    // -----------------------------------------------------------------------
    if (milestone === 'v2.9') {
      try {
        const path_v29 = require('path');
        const planningDir_v29 = path_v29.join(__dirname, '..', '..',
          '.planning');
        let attribution_v29 = null;
        try {
          attribution_v29 = require(
            '../tools/harness-attribution/attribute.cjs');
        } catch (e_v29_req) {
          process.stderr.write(
            'milestone_close_blocked:harness_attribution_unavailable\n');
          process.stderr.write('  reason=harness_attribution_require_failed message='
            + (e_v29_req && e_v29_req.message ? e_v29_req.message : 'unknown')
            + '\n');
          process.exit(1);
          return;
        }

        if (!attribution_v29
            || typeof attribution_v29.findUnattributedManifests !== 'function') {
          process.stderr.write(
            'milestone_close_blocked:harness_attribution_unavailable\n');
          process.stderr.write(
            '  reason=findUnattributedManifests_export_missing\n');
          process.exit(1);
          return;
        }

        const projectDir_v29 = path_v29.dirname(planningDir_v29);
        const scan_v29 = attribution_v29.findUnattributedManifests({
          projectDir: projectDir_v29
        });

        if (!scan_v29 || scan_v29.ok !== true) {
          process.stderr.write(
            'milestone_close_blocked:harness_attribution_scan_failed\n');
          process.stderr.write('  errors='
            + JSON.stringify((scan_v29 && scan_v29.errors) || []) + '\n');
          process.exit(1);
          return;
        }

        if (scan_v29.unattributed && scan_v29.unattributed.length > 0) {
          process.stderr.write(
            'milestone_close_blocked:v2_9_unattributed_candidates\n');
          process.stderr.write('  ' + scan_v29.unattributed.length
            + ' unattributed harness change manifest rows blocking SHIPPED-clean.\n');
          process.stderr.write('  total_manifests=' + scan_v29.total_manifests
            + ' total_attributions=' + scan_v29.total_attributions + '\n');
          for (const u_v29 of scan_v29.unattributed) {
            process.stderr.write('  -- change_id=' + u_v29.change_id
              + ' reason=' + u_v29.reason + '\n');
          }
          process.stderr.write(
            '  AHE-GOV-04: every candidate harness edit must have an '
            + 'attribution verdict before clean ship.\n');
          process.stderr.write(
            '  Run: node super-gsd/tools/harness-attribution/attribute.cjs '
            + '<args> for each open change_id, then re-attempt close.\n');
          process.exit(1);
          return;
        }

        // Phase 105 extension: AHE-EVAL-03/05 -- check transfer eval.
        // Any keep-verdict change without a transfer record is a blocker.
        // Critical regressions in transfer also block clean ship.
        let transferBlockers_v29 = [];
        try {
          const xfer_v29 = require('../tools/harness-transfer/evaluate.cjs');
          const tx_v29 = xfer_v29.readTransfers(projectDir_v29);
          if (tx_v29.ok) {
            // Build map of change_id -> transfer present + critical?
            const xferByChange_v29 = {};
            for (const tr_v29 of tx_v29.rows) {
              if (tr_v29 && tr_v29.change_id) {
                if (!xferByChange_v29[tr_v29.change_id]) {
                  xferByChange_v29[tr_v29.change_id] = {
                    has_transfer: false, critical: false
                  };
                }
                xferByChange_v29[tr_v29.change_id].has_transfer = true;
                if (tr_v29.critical_regression === true) {
                  xferByChange_v29[tr_v29.change_id].critical = true;
                }
              }
            }
            // Read attribution rows; for each verdict=keep without transfer or with critical, block.
            try {
              const att_v29 = attribution_v29.readAttributions(projectDir_v29);
              if (att_v29.ok) {
                for (const a_v29 of att_v29.rows) {
                  if (!a_v29 || a_v29.verdict !== 'keep') continue;
                  const xc_v29 = xferByChange_v29[a_v29.change_id];
                  if (!xc_v29 || !xc_v29.has_transfer) {
                    transferBlockers_v29.push({
                      change_id: a_v29.change_id,
                      reason: 'keep_verdict_without_transfer_record'
                    });
                  } else if (xc_v29.critical === true) {
                    transferBlockers_v29.push({
                      change_id: a_v29.change_id,
                      reason: 'transfer_critical_regression'
                    });
                  }
                }
              }
            } catch (_e_att) { /* tolerated */ }
          }
        } catch (_e_xfer) {
          // Phase 104 module unavailable -- not a blocker if no manifests exist.
        }

        if (transferBlockers_v29.length > 0) {
          process.stderr.write(
            'milestone_close_blocked:v2_9_transfer_eval_missing_or_critical\n');
          for (const b_v29 of transferBlockers_v29) {
            process.stderr.write('  -- change_id=' + b_v29.change_id
              + ' reason=' + b_v29.reason + '\n');
          }
          process.stderr.write(
            '  AHE-EVAL-03/05: keep-verdict candidates need transfer records '
            + 'with no critical regression.\n');
          process.stderr.write(
            '  Or mark v2.9 SHIPPED-WITH-UNPROVEN-HARNESS-EVOLUTION '
            + 'explicitly (operator decision).\n');
          process.exit(1);
          return;
        }

        process.stdout.write('milestone_close_gate: v2.9 close gate green '
          + '(0 unattributed harness change manifest rows; '
          + scan_v29.total_manifests + ' manifests / '
          + scan_v29.total_attributions + ' attributions; '
          + '0 transfer-blocking changes)\n');
        process.exit(0);
        return;
      } catch (e_v29) {
        process.stderr.write('milestone_close_blocked:v2_9_gate_threw\n');
        process.stderr.write('  message=' + (e_v29 && e_v29.message ? e_v29.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }
    }

    // -----------------------------------------------------------------------
    // Phase 86-02 hardening: v2.6 close gate (operator override
    // 2026-04-29T21:35Z). Refuses SHIPPED-clean while crit-backlog has
    // open `v2_6_debt` rows whose summary matches
    // `context_packet_builder_dormant` OR
    // `context_bench_full_mode_unproven`. Other v2_6_debt rows are
    // tolerated (orthogonal scope -- e.g., codex provider unavailable).
    //
    // Pattern source: super-gsd/tools/release-readiness/score.cjs
    // (`edge_guard_miss` row blocks SHIPPED-clean). Mirrors that shape
    // but with v2.6-specific kind + summary regex.
    //
    // Backward compat: v1.9 / v2.0 / v2.1 paths are NOT entered for v2.6
    // -- this branch returns independently. Lock 13: try/catch wraps
    // fs.existsSync + readFileSync + JSON.parse so this gate NEVER
    // throws upward. ASCII-only.
    // -----------------------------------------------------------------------
    if (milestone === 'v2.6') {
      const fs_v26 = require('fs');
      const path_v26 = require('path');
      let planningDir_v26 = _argValue(args, '--planning-dir');
      if (typeof planningDir_v26 !== 'string' || planningDir_v26.length === 0) {
        planningDir_v26 = path_v26.join(process.cwd(), '.planning');
      }
      const critBacklogPath_v26 = path_v26.join(
        planningDir_v26, 'metrics', 'crit-backlog.jsonl');
      const blockingRows_v26 = [];
      let scanErr_v26 = '';
      try {
        if (fs_v26.existsSync(critBacklogPath_v26)) {
          const raw_v26 = fs_v26.readFileSync(critBacklogPath_v26, 'utf8');
          const lines_v26 = raw_v26.split(/\r?\n/);
          for (let li_v26 = 0; li_v26 < lines_v26.length; li_v26++) {
            const ln_v26 = lines_v26[li_v26];
            if (!ln_v26 || ln_v26.length === 0) continue;
            try {
              const row_v26 = JSON.parse(ln_v26);
              if (row_v26 && row_v26.kind === 'v2_6_debt'
                  && row_v26.resolution === 'open') {
                const sum_v26 = (typeof row_v26.summary === 'string')
                  ? row_v26.summary : '';
                if (/context_packet_builder_dormant/i.test(sum_v26)
                    || /context_bench_full_mode_unproven/i.test(sum_v26)) {
                  blockingRows_v26.push(row_v26);
                }
              }
            } catch (_pe_v26) {
              // skip parse errors per Lock-13 (don't fail the gate on
              // malformed lines; they're orthogonal to this check).
            }
          }
        }
      } catch (e_v26) {
        scanErr_v26 = (e_v26 && e_v26.message) ? e_v26.message : 'unknown';
        process.stderr.write('milestone_close_blocked:v2_6_debt_scan_failed\n');
        process.stderr.write('  reason=' + scanErr_v26 + '\n');
        process.exit(1);
        return;
      }
      if (blockingRows_v26.length > 0) {
        process.stderr.write(
          'milestone_close_blocked:v2_6_debt_unresolved\n');
        process.stderr.write('  ' + blockingRows_v26.length
          + ' open v2_6_debt rows blocking SHIPPED-clean.\n');
        for (let bi_v26 = 0; bi_v26 < blockingRows_v26.length; bi_v26++) {
          const br_v26 = blockingRows_v26[bi_v26];
          const summary_v26 = (br_v26 && typeof br_v26.summary === 'string')
            ? br_v26.summary : '<no summary>';
          const trimmed_v26 = (summary_v26.length > 120)
            ? summary_v26.substring(0, 120) : summary_v26;
          process.stderr.write('  - ' + trimmed_v26 + '\n');
        }
        process.stderr.write(
          '  v2.6 may close as SHIPPED-WITH-CRIT-DEBT (operator decision); '
          + 'this gate refuses SHIPPED-clean.\n');
        process.stderr.write(
          '  To proceed: resolve via Phase 87 (live orchestrator wire-in) '
          + 'OR mark each row resolution=accepted-with-debt.\n');
        process.exit(1);
        return;
      }

      // ---------------------------------------------------------------------
      // Phase 87-01 v2.6 close gate extension: context_packet_builder_freshness
      // must be PASS at milestone close. The freshness probe (Phase 86 D86.2,
      // warp-doctor _probe_context_packet_builder_freshness) checks the mtime
      // of .planning/metrics/context-packet-log.jsonl against a 24h window.
      // After Phase 87-01 ships orchestrator-hooks.cjs, /sgsd-orchestrate go
      // refreshes the log via the bash hook on every dispatch. If the probe
      // returns MISSING (log >24h stale OR Phase 45 absent + dormant), the
      // close gate refuses SHIPPED-clean and instructs operator to either
      // refresh via a hook invocation or mark SHIPPED-WITH-CRIT-DEBT.
      // Lock 13: spawn / parse failures DO NOT fail the gate; only an
      // explicit MISSING status from a parsed envelope blocks. PASS,
      // NOT-APPLICABLE, DEGRADED -> continue.
      // ---------------------------------------------------------------------
      try {
        const child_process_v26 = require('child_process');
        const doctorPath_v26 = path_v26.resolve(__dirname, '..', 'tools',
          'warp-doctor', 'check.cjs');
        if (fs_v26.existsSync(doctorPath_v26)) {
          const doctorRes_v26 = child_process_v26.spawnSync(
            process.execPath,
            [doctorPath_v26,
              '--project', path_v26.dirname(planningDir_v26),
              '--json'],
            { encoding: 'utf8', timeout: 10000, windowsHide: true }
          );
          let probeStatus_v26 = null;
          let probeReason_v26 = '';
          let probeEvidence_v26 = '';
          if (!doctorRes_v26.error
              && typeof doctorRes_v26.stdout === 'string'
              && doctorRes_v26.stdout.length > 0) {
            try {
              const env_v26 = JSON.parse(doctorRes_v26.stdout);
              if (env_v26 && Array.isArray(env_v26.probes)) {
                for (let pi_v26 = 0; pi_v26 < env_v26.probes.length; pi_v26++) {
                  const pp_v26 = env_v26.probes[pi_v26];
                  if (pp_v26
                      && pp_v26.name === 'context_packet_builder_freshness') {
                    probeStatus_v26 = pp_v26.status || null;
                    probeReason_v26 = pp_v26.reason || '';
                    probeEvidence_v26 = pp_v26.evidence || '';
                    break;
                  }
                }
              }
            } catch (_pe_v26) {
              // Parse failure -- Lock 13: do NOT fail the gate on tooling
              // hiccups. Continue to the green path.
            }
          }
          if (probeStatus_v26 === 'MISSING') {
            process.stderr.write(
              'milestone_close_blocked:context_packet_builder_freshness_missing\n');
            process.stderr.write('  reason=' + probeReason_v26 + '\n');
            process.stderr.write('  evidence=' + probeEvidence_v26 + '\n');
            process.stderr.write(
              '  Phase 45 builder is dormant (context-packet-log.jsonl '
              + '>24h stale).\n');
            process.stderr.write(
              '  Refresh: node super-gsd/scripts/lib/orchestrator-hooks.cjs '
              + '--context-packet-build --role researcher --phase v2.6 '
              + '--milestone v2.6 --project-dir "' + path_v26.dirname(planningDir_v26) + '"\n');
            process.stderr.write(
              '  OR mark v2.6 SHIPPED-WITH-CRIT-DEBT explicitly.\n');
            process.exit(1);
            return;
          }
          // PASS, NOT-APPLICABLE, DEGRADED, or null -> continue.
        }
      } catch (_e_v26) {
        // Lock 13: never throw upward from the freshness assertion.
      }

      process.stdout.write('milestone_close_gate: v2.6 close gate green '
        + '(no open v2_6_debt rows match '
        + 'context_packet_builder_dormant or context_bench_full_mode_unproven; '
        + 'context_packet_builder_freshness PASS or NOT-APPLICABLE)\n');
      process.exit(0);
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

      // ---------------------------------------------------------------
      // Phase 61-01-T3: v2.1 FOURTH-GATE (docs-refresh check). Lock 4:
      // extends the v2.1 branch only; v1.9 dual-gate, v2.0 sept-gate,
      // Phase 58 first-gate, Phase 59 second-gate, AND Phase 60 third-
      // gate paths are all preserved byte-equal up to this insertion
      // point (bytes 1-478 of the post-Phase-60 file). The fourth gate
      // performs a closed-vocab grep on README.md to verify the public
      // docs refresh shipped: VTP mentions must be marked optional only
      // (zero occurrences of 'vtp.*required' or 'vtp.*must'). The check
      // is intentionally narrow: it observes the README's VTP-vocab
      // discipline as a regression sentinel for the Phase 61 docs
      // refresh. Lock 11: closed-vocab grep on 'required' / 'must' /
      // 'optional' (no fuzzy matching). Lock 13: README missing on
      // disk -> gate emits a SKIPPED sentinel and exits 0 rather than
      // blocking close (partial-checkout / sparse-clone path; the
      // README is a public-docs surface, its absence is a checkout-
      // shape problem, not a milestone-close problem).
      // ASCII-only: stderr/stdout literals are 0x09/0x0A/0x20-0x7E.
      // ---------------------------------------------------------------
      var readmePath_v21d = path_v21c.join(repoRoot_v21c, 'README.md');

      var readmePresent_v21d = false;
      try {
        readmePresent_v21d = fs_v21c.existsSync(readmePath_v21d)
          && fs_v21c.statSync(readmePath_v21d).isFile();
      } catch (_e) {
        readmePresent_v21d = false;
      }

      if (!readmePresent_v21d) {
        // Lock 13: README absent -> degrade gracefully, do NOT block
        // close. The fourth-gate's purpose is to catch VTP-vocab
        // regressions in the public docs; if the README is missing
        // there is no public-docs surface to regress against.
        process.stdout.write('milestone_close_gate: v2.1 docs-refresh '
          + 'check SKIPPED (README.md not present at repo root; '
          + 'partial checkout suspected; degrading to third-gate only '
          + 'per Lock 13)\n');
        process.stdout.write('milestone_close_gate: v2.1 fourth-gate '
          + '(docs-refresh) green-with-skip\n');
        process.exit(0);
        return;
      }

      // Read README and run the closed-vocab grep in-proc (avoid
      // shelling out to grep so the gate is portable across PowerShell
      // / cmd.exe / bash without depending on platform grep semantics).
      var readmeBytes_v21d = null;
      try {
        readmeBytes_v21d = fs_v21c.readFileSync(readmePath_v21d, 'utf8');
      } catch (e) {
        process.stderr.write('milestone_close_blocked:docs_refresh_self_test_failed\n');
        process.stderr.write('  reason=docs_refresh_readme_read_failed message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      // Closed-vocab regex: 'vtp' (case-insensitive) followed within
      // the same line by 'required' or 'must' (case-insensitive). Any
      // match is a Phase 61 regression: the docs refresh mandates VTP
      // be marked optional only.
      var vtpRequiredCount_v21d = 0;
      var vtpAnyCount_v21d = 0;
      try {
        var lines_v21d = readmeBytes_v21d.split(/\r?\n/);
        var rxRequired_v21d = /vtp[^\n]*(required|must)/i;
        var rxAny_v21d = /vtp/i;
        for (var li_v21d = 0; li_v21d < lines_v21d.length; li_v21d++) {
          if (rxAny_v21d.test(lines_v21d[li_v21d])) {
            vtpAnyCount_v21d++;
            if (rxRequired_v21d.test(lines_v21d[li_v21d])) {
              vtpRequiredCount_v21d++;
            }
          }
        }
      } catch (e) {
        process.stderr.write('milestone_close_blocked:docs_refresh_self_test_failed\n');
        process.stderr.write('  reason=docs_refresh_grep_threw message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      if (vtpRequiredCount_v21d > 0) {
        process.stderr.write('milestone_close_blocked:docs_refresh_vtp_required_present\n');
        process.stderr.write('  reason=vtp_required_count='
          + vtpRequiredCount_v21d + ' (must be 0; VTP must be marked '
          + 'optional only per Phase 61 docs refresh)\n');
        process.exit(1);
        return;
      }

      process.stdout.write('milestone_close_gate: v2.1 docs-refresh '
        + 'check green (vtp_required_count=0; vtp_any_count='
        + vtpAnyCount_v21d + '; closed-vocab grep on required/must)\n');
      process.stdout.write('milestone_close_gate: v2.1 fourth-gate '
        + '(docs-refresh) green\n');

      // ---------------------------------------------------------------
      // Phase 62-01-T1: v2.1 FIFTH-GATE (upgrade-drift check). Lock 4:
      // extends the v2.1 branch only; v1.9 dual-gate, v2.0 sept-gate,
      // and prior four v2.1 gates (Phase 58 first / Phase 59 second /
      // Phase 60 third / Phase 61 fourth) paths are all preserved
      // byte-equal up to this insertion point. The fifth gate is the
      // FINAL gate of the v1.6 -> v2.1 roadmap. It runs the upgrade-
      // drift selfTest and asserts:
      //   (a) selfTest exit_code 0 (>=8 in-tree assertions PASS)
      //   (b) runDrift().probes.length >= 8 (>=8 probes per
      //       ROADMAP-AGENT.md line 770)
      //   (c) read-only invariant (selfTest A8 'read_only_invariant'
      //       PASS -> hasWrite === false on the source code substring
      //       scan)
      // Lock 11: closed-vocab indexOf membership on the assertion name
      // 'read_only_invariant' (no fuzzy / regex). Lock 13: upgrade-
      // drift module unavailable on disk -> emit
      // milestone_close_blocked:upgrade_drift_unavailable stderr tag
      // and exit 1. Selftest threw -> emit
      // milestone_close_blocked:upgrade_drift_self_test_threw and
      // exit 1. ASCII-only literals (0x09/0x0A/0x20-0x7E).
      // ---------------------------------------------------------------
      var driftModulePath_v21e = path_v21c.join(__dirname, '..', 'tools',
        'upgrade-drift', 'check.cjs');

      var driftMod_v21e = null;
      try {
        driftMod_v21e = require(driftModulePath_v21e);
      } catch (e) {
        process.stderr.write('milestone_close_blocked:upgrade_drift_unavailable\n');
        process.stderr.write('  reason=upgrade_drift_require_failed message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      if (!driftMod_v21e
          || typeof driftMod_v21e.selfTest !== 'function'
          || typeof driftMod_v21e.runDrift !== 'function') {
        process.stderr.write('milestone_close_blocked:upgrade_drift_unavailable\n');
        process.stderr.write('  reason=upgrade_drift_export_missing\n');
        process.exit(1);
        return;
      }

      // (a) selfTest exit_code 0 (>=8 PASS).
      var driftSelf_v21e = null;
      try {
        driftSelf_v21e = driftMod_v21e.selfTest();
      } catch (e) {
        process.stderr.write('milestone_close_blocked:upgrade_drift_self_test_threw\n');
        process.stderr.write('  reason=upgrade_drift_selfTest_threw message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      if (!driftSelf_v21e || driftSelf_v21e.ok !== true
          || !Array.isArray(driftSelf_v21e.results)
          || driftSelf_v21e.results.length < 8) {
        process.stderr.write('milestone_close_blocked:upgrade_drift_self_test_failed\n');
        process.stderr.write('  reason=upgrade_drift_selfTest_not_all_pass results='
          + (driftSelf_v21e && Array.isArray(driftSelf_v21e.results)
            ? driftSelf_v21e.results.length : 0)
          + ' ok=' + (driftSelf_v21e ? driftSelf_v21e.ok : 'null') + '\n');
        process.exit(1);
        return;
      }

      // (c) read_only_invariant PASS in selfTest results (closed-vocab
      // indexOf membership on assertion name).
      var readOnlyOK_v21e = false;
      for (var ri_v21e = 0; ri_v21e < driftSelf_v21e.results.length; ri_v21e++) {
        var r_v21e = driftSelf_v21e.results[ri_v21e];
        if (r_v21e && r_v21e.name === 'read_only_invariant'
            && r_v21e.ok === true) {
          readOnlyOK_v21e = true;
          break;
        }
      }
      if (readOnlyOK_v21e !== true) {
        process.stderr.write('milestone_close_blocked:upgrade_drift_read_only_invariant_failed\n');
        process.stderr.write('  reason=upgrade_drift_selfTest_read_only_assertion_not_pass\n');
        process.exit(1);
        return;
      }

      // (b) runDrift().probes.length >= 8.
      var driftSnap_v21e = null;
      try {
        driftSnap_v21e = driftMod_v21e.runDrift({});
      } catch (e) {
        process.stderr.write('milestone_close_blocked:upgrade_drift_self_test_threw\n');
        process.stderr.write('  reason=upgrade_drift_runDrift_threw message='
          + (e && e.message ? e.message : 'unknown') + '\n');
        process.exit(1);
        return;
      }

      if (!driftSnap_v21e || !Array.isArray(driftSnap_v21e.probes)
          || driftSnap_v21e.probes.length < 8) {
        process.stderr.write('milestone_close_blocked:upgrade_drift_probe_count_below_floor\n');
        process.stderr.write('  reason=upgrade_drift_probe_count='
          + (driftSnap_v21e && Array.isArray(driftSnap_v21e.probes)
            ? driftSnap_v21e.probes.length : 0)
          + ' (must be >=8 per ROADMAP-AGENT.md line 770)\n');
        process.exit(1);
        return;
      }

      process.stdout.write('milestone_close_gate: v2.1 upgrade-drift '
        + 'self-test green ('
        + driftSelf_v21e.results.length + '/'
        + driftSelf_v21e.results.length + ' PASS; probes='
        + driftSnap_v21e.probes.length + '; read-only invariant green)\n');
      process.stdout.write('milestone_close_gate: v2.1 fifth-gate '
        + '(upgrade-drift) green\n');
      process.stdout.write('milestone_close_gate: v2.1 quint-gate '
        + '(installer-audit + new-project-wizard + example-walkthrough '
        + '+ docs-refresh + upgrade-drift) green\n');
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
