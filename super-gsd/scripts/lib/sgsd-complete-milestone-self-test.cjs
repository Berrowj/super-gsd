#!/usr/bin/env node
// =============================================================================
// super-gsd/scripts/lib/sgsd-complete-milestone-self-test.cjs
// Phase 86-02 hardening self-test (operator override 2026-04-29T21:35Z).
//
// PURPOSE
//   Exercises the v2.6 close gate added to
//   super-gsd/scripts/sgsd-complete-milestone.cjs. Three legs:
//
//   leg1 -- BLOCK: synthetic crit-backlog.jsonl with one open v2_6_debt
//           row whose summary contains 'context_packet_builder_dormant'
//           causes the v2.6 close to exit 1 with stderr containing
//           'milestone_close_blocked:v2_6_debt_unresolved'.
//
//   leg2 -- BLOCK: synthetic crit-backlog.jsonl with one open v2_6_debt
//           row whose summary contains 'context_bench_full_mode_unproven'
//           causes the v2.6 close to exit 1 with stderr containing
//           'milestone_close_blocked:v2_6_debt_unresolved'.
//
//   leg3 -- PASS: synthetic crit-backlog.jsonl with no blocking rows
//           (resolved rows + unrelated kinds) causes v2.6 close to
//           exit 0 with stdout containing 'v2.6 close gate green'.
//
//   leg4 -- BACKWARD COMPAT: invoking with --milestone v2.0 (or any
//           non-v2.6 milestone with no env satisfied) MUST NOT execute
//           the v2.6 branch -- this leg verifies the v2.6 branch does
//           not regress v2.0 dispatch by checking stderr does NOT
//           contain 'milestone_close_blocked:v2_6_debt_unresolved'.
//
// USAGE
//   node super-gsd/scripts/lib/sgsd-complete-milestone-self-test.cjs
//   node super-gsd/scripts/lib/sgsd-complete-milestone-self-test.cjs --self-test
//
// EXIT CODE
//   0 -> all legs PASS.
//   1 -> any leg FAIL or fixture setup error.
//
// ASCII-ONLY. Lock-13 wraps fixture setup so no leg-1 throw nukes
// subsequent legs.
// =============================================================================

'use strict';

const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT_PATH = path.resolve(__dirname, '..', 'sgsd-complete-milestone.cjs');

function _now() { return new Date().toISOString(); }

function _mkTempPlanningDir(label) {
  const base = path.join(os.tmpdir(),
    'sgsd-complete-milestone-self-test-' + label + '-' + Date.now()
    + '-' + Math.floor(Math.random() * 1e6));
  fs.mkdirSync(path.join(base, 'metrics'), { recursive: true });
  return base;
}

function _writeCritBacklog(planningDir, rows) {
  const filePath = path.join(planningDir, 'metrics', 'crit-backlog.jsonl');
  let body = '';
  for (let i = 0; i < rows.length; i++) {
    body += JSON.stringify(rows[i]) + '\n';
  }
  fs.writeFileSync(filePath, body, 'utf8');
}

function _rmrfQuiet(dirPath) {
  try {
    if (typeof fs.rmSync === 'function') {
      fs.rmSync(dirPath, { recursive: true, force: true });
      return;
    }
  } catch (_e) { /* fall through */ }
  // Legacy fallback for older Node.
  try {
    const stack = [dirPath];
    while (stack.length > 0) {
      const cur = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(cur); } catch (_e) { continue; }
      for (let i = 0; i < entries.length; i++) {
        const sub = path.join(cur, entries[i]);
        try {
          const st = fs.statSync(sub);
          if (st.isDirectory()) {
            stack.push(sub);
          } else {
            try { fs.unlinkSync(sub); } catch (_e) { /* swallow */ }
          }
        } catch (_e) { /* swallow */ }
      }
      try { fs.rmdirSync(cur); } catch (_e) { /* swallow */ }
    }
  } catch (_e) { /* swallow */ }
}

function _runGate(args) {
  const result = child_process.spawnSync(
    process.execPath,
    [SCRIPT_PATH].concat(args),
    {
      encoding: 'utf8',
      timeout: 30000,
      windowsHide: true,
    }
  );
  return {
    status: (typeof result.status === 'number') ? result.status : -1,
    stdout: (typeof result.stdout === 'string') ? result.stdout : '',
    stderr: (typeof result.stderr === 'string') ? result.stderr : '',
    error: (result.error && result.error.message) ? result.error.message : '',
  };
}

function selfTest() {
  const results = [];
  function add(name, ok, detail) {
    results.push({ name: name, ok: !!ok, detail: detail || '' });
  }

  // ---- leg1: blocking row with context_packet_builder_dormant ----
  let leg1Dir = null;
  try {
    leg1Dir = _mkTempPlanningDir('leg1');
    _writeCritBacklog(leg1Dir, [
      {
        ts: _now(),
        kind: 'v2_6_debt',
        phase: 86,
        summary: 'Phase 45 context_packet_builder_dormant in current Warp run; '
          + 'wire-in deferred to Phase 87.',
        resolution: 'open',
        milestone: 'v2.6'
      }
    ]);
    const r1 = _runGate(['--milestone', 'v2.6', '--planning-dir', leg1Dir]);
    const r1Match = r1.stderr.indexOf('milestone_close_blocked:v2_6_debt_unresolved') !== -1;
    add('leg1_block_on_context_packet_builder_dormant',
      r1.status === 1 && r1Match,
      'status=' + r1.status + ' stderr_match=' + r1Match);
  } catch (e) {
    add('leg1_block_on_context_packet_builder_dormant', false,
      'fixture_threw=' + (e && e.message ? e.message : 'unknown'));
  } finally {
    if (leg1Dir) _rmrfQuiet(leg1Dir);
  }

  // ---- leg2: blocking row with context_bench_full_mode_unproven ----
  let leg2Dir = null;
  try {
    leg2Dir = _mkTempPlanningDir('leg2');
    _writeCritBacklog(leg2Dir, [
      {
        ts: _now(),
        kind: 'v2_6_debt',
        phase: 86,
        summary: 'context_bench_full_mode_unproven; ledger-only reduction '
          + 'claim awaiting real-mode benchmark.',
        resolution: 'open',
        milestone: 'v2.6'
      }
    ]);
    const r2 = _runGate(['--milestone', 'v2.6', '--planning-dir', leg2Dir]);
    const r2Match = r2.stderr.indexOf('milestone_close_blocked:v2_6_debt_unresolved') !== -1;
    add('leg2_block_on_context_bench_full_mode_unproven',
      r2.status === 1 && r2Match,
      'status=' + r2.status + ' stderr_match=' + r2Match);
  } catch (e) {
    add('leg2_block_on_context_bench_full_mode_unproven', false,
      'fixture_threw=' + (e && e.message ? e.message : 'unknown'));
  } finally {
    if (leg2Dir) _rmrfQuiet(leg2Dir);
  }

  // ---- leg3: no blocking rows (resolved + unrelated kinds + orthogonal v2_6_debt) ----
  let leg3Dir = null;
  try {
    leg3Dir = _mkTempPlanningDir('leg3');
    _writeCritBacklog(leg3Dir, [
      // Resolved blocking pattern -- ignored (resolution !== 'open').
      {
        ts: _now(),
        kind: 'v2_6_debt',
        phase: 86,
        summary: 'context_packet_builder_dormant from earlier run.',
        resolution: 'accepted-with-debt',
        milestone: 'v2.6'
      },
      // Different kind -- ignored.
      {
        ts: _now(),
        kind: 'edge_guard_miss',
        phase: 50,
        summary: 'unrelated edge guard miss',
        resolution: 'open'
      },
      // Open v2_6_debt but summary does NOT match either pattern -- ignored.
      {
        ts: _now(),
        kind: 'v2_6_debt',
        phase: 86,
        summary: 'codex provider_unavailable; orthogonal scope.',
        resolution: 'open',
        milestone: 'v2.6'
      }
    ]);
    const r3 = _runGate(['--milestone', 'v2.6', '--planning-dir', leg3Dir]);
    const r3Match = r3.stdout.indexOf('v2.6 close gate green') !== -1;
    add('leg3_pass_when_no_blocking_rows',
      r3.status === 0 && r3Match,
      'status=' + r3.status + ' stdout_match=' + r3Match);
  } catch (e) {
    add('leg3_pass_when_no_blocking_rows', false,
      'fixture_threw=' + (e && e.message ? e.message : 'unknown'));
  } finally {
    if (leg3Dir) _rmrfQuiet(leg3Dir);
  }

  // ---- leg4: backward compat -- non-v2.6 dispatch MUST NOT enter v2.6 branch ----
  // Use an unknown milestone (e.g., 'v9.9') so the script falls through
  // to its existing no-op default. This is a deterministic, low-cost
  // probe of the dispatch ordering: if the v2.6 branch were placed
  // wrong (e.g., before the missing-arg check, or matching loosely),
  // the synthetic blocking row would surface even for non-v2.6
  // milestones.
  //
  // Why not v2.0/v2.1 directly? Their chains pull live harnesses
  // (context-bench, installer-audit) which take 30s+ and depend on
  // workspace state. The v2.6-branch-isolation assertion is the same
  // either way: stderr/stdout MUST NOT contain the v2.6-blocked tag.
  let leg4Dir = null;
  try {
    leg4Dir = _mkTempPlanningDir('leg4');
    // Even with a blocking v2_6_debt row in the backlog, non-v2.6
    // dispatch must NOT consult that row -- v2.6 is a separate branch.
    _writeCritBacklog(leg4Dir, [
      {
        ts: _now(),
        kind: 'v2_6_debt',
        phase: 86,
        summary: 'context_packet_builder_dormant (would block v2.6 only).',
        resolution: 'open',
        milestone: 'v2.6'
      }
    ]);
    const r4 = _runGate(['--milestone', 'v9.9', '--planning-dir', leg4Dir]);
    // Assert: non-v2.6 path did not surface the v2.6 block tag AND
    // exited cleanly via the existing no-op default.
    const r4NoV26Block = r4.stderr.indexOf('milestone_close_blocked:v2_6_debt_unresolved') === -1
      && r4.stdout.indexOf('milestone_close_blocked:v2_6_debt_unresolved') === -1;
    const r4NoOp = r4.stdout.indexOf('no-op for milestone v9.9') !== -1;
    add('leg4_non_v2_6_path_unaffected_by_v2_6_branch',
      r4.status === 0 && r4NoV26Block && r4NoOp,
      'status=' + r4.status + ' v26_block_absent=' + r4NoV26Block
        + ' no_op=' + r4NoOp);
  } catch (e) {
    add('leg4_non_v2_6_path_unaffected_by_v2_6_branch', false,
      'fixture_threw=' + (e && e.message ? e.message : 'unknown'));
  } finally {
    if (leg4Dir) _rmrfQuiet(leg4Dir);
  }

  // ---- leg5: ASCII-only on the gate-script source ----
  let asciiOK = true;
  let asciiIdx = -1;
  try {
    const src = fs.readFileSync(SCRIPT_PATH, 'utf8');
    for (let i = 0; i < src.length; i++) {
      const c = src.charCodeAt(i);
      if (c > 127) {
        asciiOK = false;
        asciiIdx = i;
        break;
      }
    }
  } catch (e) {
    asciiOK = false;
    asciiIdx = -2;
  }
  add('leg5_gate_script_ascii_only',
    asciiOK,
    'ascii_idx=' + asciiIdx);

  // ---- leg6: gate script syntax-loadable ----
  let loadOK = false;
  let loadErr = '';
  try {
    const probe = child_process.spawnSync(
      process.execPath,
      ['-c', SCRIPT_PATH],
      { encoding: 'utf8', timeout: 10000, windowsHide: true }
    );
    loadOK = (probe.status === 0);
    if (!loadOK) loadErr = (probe.stderr || '').slice(0, 200);
  } catch (e) {
    loadOK = false;
    loadErr = (e && e.message) ? e.message : 'unknown';
  }
  add('leg6_gate_script_node_check_clean',
    loadOK,
    'load_err=' + loadErr);

  // ---- leg7: Phase 87-01 freshness assertion -- PASS path ---------------
  // Synthetic env where context-packet-log.jsonl is freshly written and
  // crit-backlog has zero blocking rows. v2.6 close gate exits 0.
  // Note: warp-doctor probe operates on projectDir/.planning so we set up
  // the planning dir as a child of a fresh project root.
  let leg7Root = null;
  try {
    leg7Root = path.join(os.tmpdir(),
      'sgsd-complete-milestone-self-test-leg7-' + Date.now()
      + '-' + Math.floor(Math.random() * 1e6));
    const leg7Planning = path.join(leg7Root, '.planning');
    fs.mkdirSync(path.join(leg7Planning, 'metrics'), { recursive: true });
    // No blocking debt rows (empty backlog).
    _writeCritBacklog(leg7Planning, []);
    // Fresh context-packet-log.jsonl (mtime now).
    const fresh7 = path.join(leg7Planning, 'metrics', 'context-packet-log.jsonl');
    fs.writeFileSync(fresh7,
      JSON.stringify({ schema_version: 1, ts: _now(),
        packet_id: 'leg7_synth', role: 'researcher' }) + '\n', 'utf8');
    // Touch STATE.md so warp-doctor's other freshness probe doesn't degrade.
    fs.writeFileSync(path.join(leg7Planning, 'STATE.md'),
      '# state\nactive_milestone: v2.6\n', 'utf8');
    const r7 = _runGate(['--milestone', 'v2.6', '--planning-dir', leg7Planning]);
    const r7Green = r7.stdout.indexOf('v2.6 close gate green') !== -1;
    const r7NotMissing = r7.stderr.indexOf(
      'context_packet_builder_freshness_missing') === -1;
    add('leg7_pass_when_freshness_green',
      r7.status === 0 && r7Green && r7NotMissing,
      'status=' + r7.status + ' green=' + r7Green
        + ' freshness_not_missing=' + r7NotMissing);
  } catch (e) {
    add('leg7_pass_when_freshness_green', false,
      'fixture_threw=' + (e && e.message ? e.message : 'unknown'));
  } finally {
    if (leg7Root) _rmrfQuiet(leg7Root);
  }

  // ---- leg8: Phase 87-01 freshness assertion -- MISSING path ------------
  // Synthetic env with stale context-packet-log.jsonl (mtime 25h+ old).
  // Empty crit-backlog so the staleness probe is the sole blocker.
  // Expect: exit 1 with stderr containing
  // 'context_packet_builder_freshness_missing'.
  let leg8Root = null;
  try {
    leg8Root = path.join(os.tmpdir(),
      'sgsd-complete-milestone-self-test-leg8-' + Date.now()
      + '-' + Math.floor(Math.random() * 1e6));
    const leg8Planning = path.join(leg8Root, '.planning');
    fs.mkdirSync(path.join(leg8Planning, 'metrics'), { recursive: true });
    _writeCritBacklog(leg8Planning, []);
    const stale8 = path.join(leg8Planning, 'metrics', 'context-packet-log.jsonl');
    fs.writeFileSync(stale8,
      JSON.stringify({ schema_version: 1, ts: _now(),
        packet_id: 'leg8_synth_stale', role: 'researcher' }) + '\n', 'utf8');
    // Backdate mtime by 25 hours so the freshness probe returns MISSING.
    const stalePast = (Date.now() / 1000) - (25 * 3600);
    try { fs.utimesSync(stale8, stalePast, stalePast); } catch (_e) { /* ok */ }
    fs.writeFileSync(path.join(leg8Planning, 'STATE.md'),
      '# state\nactive_milestone: v2.6\n', 'utf8');
    const r8 = _runGate(['--milestone', 'v2.6', '--planning-dir', leg8Planning]);
    const r8Missing = r8.stderr.indexOf(
      'milestone_close_blocked:context_packet_builder_freshness_missing') !== -1;
    add('leg8_block_when_freshness_missing',
      r8.status === 1 && r8Missing,
      'status=' + r8.status + ' freshness_block=' + r8Missing);
  } catch (e) {
    add('leg8_block_when_freshness_missing', false,
      'fixture_threw=' + (e && e.message ? e.message : 'unknown'));
  } finally {
    if (leg8Root) _rmrfQuiet(leg8Root);
  }

  return {
    ok: results.every(function (r) { return r.ok; }),
    results: results,
  };
}

function _printResults(out) {
  if (!out || !Array.isArray(out.results)) {
    process.stdout.write('sgsd-complete-milestone-self-test: results not an array\n');
    return false;
  }
  let pass = 0;
  for (let i = 0; i < out.results.length; i++) {
    const r = out.results[i];
    const tag = r.ok ? 'PASS' : 'FAIL';
    process.stdout.write(tag + ' ' + r.name + ' ' + (r.detail || '') + '\n');
    if (r.ok) pass++;
  }
  process.stdout.write('---\n');
  process.stdout.write('sgsd-complete-milestone-self-test: '
    + pass + '/' + out.results.length + ' assertions passed\n');
  return pass === out.results.length;
}

function _main(argv) {
  try {
    const out = selfTest();
    const allOK = _printResults(out);
    process.exit(allOK ? 0 : 1);
  } catch (e) {
    process.stderr.write('sgsd-complete-milestone-self-test: outer threw '
      + (e && e.message ? e.message : 'unknown') + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  _main(process.argv);
}

module.exports = { selfTest: selfTest };
