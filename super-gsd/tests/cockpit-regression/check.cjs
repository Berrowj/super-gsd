#!/usr/bin/env node
// ============================================================================
// SGSD cockpit regression checks
// ============================================================================
// Purpose: stop cockpit "fixes" from being visual-only patches with no proof.
// This covers the exact regressions that made the dashboard misleading:
//   1. no route ledger -> honest Claude/direct execution fallback
//   2. current execution_route row -> provider/task/why is surfaced
//   3. stale execution_route row -> not presented as current
//   4. Mission Control handles current_phase: complete without Pcomplete
//   5. Mission Control and Claude+Agents both expose EXECUTOR / WHY lines
//
// Read-only: temp fixtures only. Does not mutate repo state.
// ============================================================================

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const cockpitShell = require(path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'sgsd-cockpit-shell.cjs'));
const routeLedger = require(path.join(repoRoot, 'super-gsd', 'scripts', 'lib', 'route-ledger.cjs'));
const cockpitState = require(path.join(repoRoot, 'super-gsd', 'tools', 'cockpit-state', 'adapter.cjs'));

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

function read(rel) {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function makePlanningDir(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgsd-cockpit-regression-' + name + '-'));
  const planning = path.join(root, '.planning');
  mkdirp(path.join(planning, 'metrics'));
  return { root, planning };
}

function parsePowerShell(rel) {
  const scriptPath = path.join(repoRoot, rel);
  const command = [
    '$err = $null;',
    `[System.Management.Automation.PSParser]::Tokenize((Get-Content -LiteralPath '${scriptPath.replace(/'/g, "''")}' -Raw), [ref]$err) | Out-Null;`,
    'if ($err -and $err.Count) { $err | Format-List; exit 1 } else { exit 0 }'
  ].join(' ');
  const r = childProcess.spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    cwd: repoRoot,
    encoding: 'utf8'
  });
  return { ok: r.status === 0, stdout: r.stdout || '', stderr: r.stderr || '' };
}

function run() {
  let pass = 0;
  let fail = 0;
  const failures = [];

  function assert(name, condition, detail) {
    if (condition) {
      pass++;
      console.log('PASS  ' + name);
    } else {
      fail++;
      failures.push({ name, detail: detail || '' });
      console.log('FAIL  ' + name);
      if (detail) console.log('      ' + detail);
    }
  }

  let tmp1 = null;
  let tmp2 = null;
  let tmp3 = null;
  let tmp4 = null;
  try {
    tmp1 = makePlanningDir('missing-route');
    const noRoute = cockpitShell.buildSnapshot(tmp1.planning, '63').executionRoute;
    assert('missing route ledger falls back to Claude/direct',
      noRoute && noRoute.provider === 'claude'
      && noRoute.has_rows === false
      && /No double-agent execution route/.test(noRoute.why),
      JSON.stringify(noRoute));

    tmp2 = makePlanningDir('current-route');
    routeLedger.appendRow(tmp2.planning, {
      boundary: 'execution_route',
      status: 'ok',
      phase: '64',
      milestone: 'v2.2',
      reason_codes: ['codex_primary_bounded_task', 'execution_accepted'],
      decision: {
        task_id: 'demo-codex-edit',
        task_kind: 'code_edit',
        chosen_provider: 'codex',
        primary_provider: 'codex',
        fallback_used: false,
        accepted: true,
        tests_passed: true,
        token_estimate: { total_estimated_tokens: 1200 },
        changed_files: ['super-gsd/demo.js'],
        out_of_scope_files: []
      }
    });
    const currentRoute = cockpitShell.buildSnapshot(tmp2.planning, '64').executionRoute;
    assert('current execution_route surfaces Codex task and reason',
      currentRoute && currentRoute.provider === 'codex'
      && currentRoute.current_phase_match === true
      && currentRoute.what === 'demo-codex-edit (code_edit)'
      && /Codex fits/.test(currentRoute.why)
      && currentRoute.estimated_tokens === 1200,
      JSON.stringify(currentRoute));

    tmp3 = makePlanningDir('stale-route');
    routeLedger.appendRow(tmp3.planning, {
      boundary: 'execution_route',
      status: 'ok',
      phase: '41',
      milestone: 'v1.9',
      reason_codes: ['codex_primary_bounded_task'],
      decision: {
        task_id: 'old-route',
        task_kind: 'code_edit',
        chosen_provider: 'codex',
        primary_provider: 'codex',
        fallback_used: false,
        accepted: false,
        tests_passed: false
      }
    });
    const staleRoute = cockpitShell.buildSnapshot(tmp3.planning, '67').executionRoute;
    assert('stale execution_route is not labelled as current executor',
      staleRoute && staleRoute.provider === 'claude'
      && staleRoute.current_phase_match === false
      && /last route was Codex on P41/.test(staleRoute.why),
      JSON.stringify(staleRoute));

    tmp4 = makePlanningDir('live-phase-override');
    mkdirp(path.join(tmp4.planning, 'milestones', 'v2.5', 'phases', '80-warp-plan-to-phase-scaffold'));
    fs.writeFileSync(path.join(tmp4.planning, 'STATE.md'), [
      '---',
      'milestone: v2.2',
      'milestone_name: stale milestone',
      'milestone_status: v2.2 complete',
      'roadmap_run:',
      '  current_milestone: v2.2',
      '  current_phase: complete',
      '  current_phase_name: complete',
      '---',
      ''
    ].join('\n'), 'utf8');
    fs.writeFileSync(path.join(tmp4.planning, 'metrics', 'activity-log.jsonl'),
      JSON.stringify({
        ts: new Date().toISOString(),
        tool: 'Write',
        target: path.join(tmp4.planning, 'milestones', 'v2.5', 'phases', '80-warp-plan-to-phase-scaffold', '80-CONTEXT.md')
      }) + '\n',
      'utf8');
    const liveOverride = cockpitState.buildSnapshot({ planningDir: tmp4.planning }).data.objective;
    assert('cockpit-state adapter lets recent phase path override stale complete STATE',
      liveOverride && liveOverride.milestone === 'v2.5'
      && liveOverride.phase === '80'
      && liveOverride.status === 'in-progress'
      && (/overrides stale STATE/.test(liveOverride.source) || liveOverride.source === 'activity_log'),
      JSON.stringify(liveOverride));

    const mission = read('super-gsd/scripts/sgsd-mission-control.ps1');
    assert('Mission Control has current_phase complete guard',
      /isMilestoneComplete/.test(mission)
      && /milestone complete; awaiting milestone close/.test(mission)
      && /phaseState/.test(mission),
      'Mission Control must not render current_phase: complete as Pcomplete');
    assert('Mission Control can infer live phase from recent activity paths',
      /function Get-LivePhaseHint/.test(mission)
      && /Resolve-LivePhaseNumber/.test(mission)
      && /overrides stale STATE\.md/.test(mission),
      'Mission Control must not trust stale STATE.md when live activity has a newer phase');
    assert('Mission Control renders EXECUTOR and WHY route rows',
      /function Get-ExecutionRouteRows/.test(mission)
      && /EXECUTOR/.test(mission)
      && /WHY/.test(mission),
      'Mission Control lost executor route strip');

    const narrative = read('super-gsd/scripts/sgsd-narrative.ps1');
    assert('Claude+Agents pane renders EXECUTOR and WHY route rows',
      /function Get-ExecutionRouteSummary/.test(narrative)
      && /EXECUTOR/.test(narrative)
      && /WHY/.test(narrative),
      'Narrative pane lost executor route strip');
    assert('Claude+Agents pane can infer live phase from recent activity paths',
      /function Get-LivePhaseHint/.test(narrative)
      && /Resolve-LivePhaseNumber/.test(narrative)
      && /live activity/.test(narrative),
      'Narrative pane must not trust stale STATE.md when live activity has a newer phase');

    const ps1 = parsePowerShell('super-gsd/scripts/sgsd-mission-control.ps1');
    assert('Mission Control PowerShell parser OK', ps1.ok, ps1.stderr || ps1.stdout);
    const ps2 = parsePowerShell('super-gsd/scripts/sgsd-narrative.ps1');
    assert('Narrative PowerShell parser OK', ps2.ok, ps2.stderr || ps2.stdout);

    assert('cockpit-shell selfTest still passes',
      cockpitShell.selfTest() === true,
      'sgsd-cockpit-shell selfTest returned false');
  } catch (e) {
    fail++;
    failures.push({ name: 'uncaught exception', detail: e && (e.stack || e.message) });
  } finally {
    for (const tmp of [tmp1, tmp2, tmp3, tmp4]) {
      if (tmp && tmp.root) fs.rmSync(tmp.root, { recursive: true, force: true });
    }
  }

  console.log('cockpit-regression: ' + pass + ' pass, ' + fail + ' fail');
  if (fail) {
    console.error(JSON.stringify(failures, null, 2));
    return 1;
  }
  return 0;
}

if (require.main === module) {
  process.exit(run());
}

module.exports = { run };
