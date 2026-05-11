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
    assert('Mission Control renders Codex executor telemetry in Codex tile',
      /Get-SgsdCodexExecutorStatus/.test(mission)
      && /CODEX EXECUTOR \/ REVIEW/.test(mission)
      && /separate Codex watch window/.test(mission),
      'Mission Control must surface codex-executor-live/log state, not only reviewer verdicts');
    assert('Mission Control reads current milestone phase evidence from root phases and PHASE-INDEX',
      /function Get-MilestoneRoadmapPhases/.test(mission)
      && /function Merge-SgsdPhaseEvidence/.test(mission)
      && /function Resolve-SgsdPhaseDir/.test(mission)
      && /function Get-PhaseSearchRoots/.test(mission)
      && /PHASE-INDEX\.jsonl/.test(mission)
      && /Join-Path \$PlanningDir "phases"/.test(mission)
      && /\(\?i\)\^\(PASS\|PASSED/.test(mission),
      'Mission Control must not show 0/N complete when current milestone evidence lives in .planning/phases plus PHASE-INDEX');

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

    const tabWatcher = read('super-gsd/scripts/lib/sgsd-tab-watcher.ps1');
    assert('Tab watcher title updates use silent ST terminator, not BEL',
      !/\[char\]7/.test(tabWatcher)
      && /OSC 0: ESC \] 0 ; <text> ST/.test(tabWatcher)
      && tabWatcher.includes("[char]27 + '\\')"),
      'OSC title updates must use ST (ESC \\\\), not BEL ([char]7), to avoid audible terminal pings');

    const renderCache = read('super-gsd/scripts/lib/sgsd-render-cache.ps1');
    assert('Render cache has calm default refresh with explicit fast/slow overrides',
      /function Get-SgsdRenderMinIntervalMs/.test(renderCache)
      && /SGSD_COCKPIT_MIN_REFRESH_MS/.test(renderCache)
      && /SGSD_COCKPIT_LOW_MOTION/.test(renderCache)
      && /SGSD_COCKPIT_FAST/.test(renderCache)
      && /5000/.test(renderCache)
      && /8000/.test(renderCache),
      'Cockpit redraw cadence must be configurable and default calmer than 2s');

    const codexStatus = read('super-gsd/scripts/lib/sgsd-codex-status.ps1');
    assert('Shared Codex status helper reads executor live and completion streams',
      /function Get-SgsdCodexExecutorStatus/.test(codexStatus)
      && /codex-executor-live\.txt/.test(codexStatus)
      && /codex-executor-log\.jsonl/.test(codexStatus)
      && /function Get-SgsdCodexExecutorStatusLine/.test(codexStatus),
      'Cockpit must read executor telemetry separately from reviewer telemetry');
    assert('Shared Codex verdict reader keeps root .planning/phases rows under milestone filtering',
      /Root-scoped projects/.test(codexStatus)
      && /\$src -match '\(\?i\)\[/.test(codexStatus)
      && /milestones/.test(codexStatus)
      && /phase filter/.test(codexStatus),
      'Root-scoped commit-reviews.jsonl rows must survive MilestoneFilter so current ATC is visible');

    assert('Codex executor running state survives long tails',
      /TotalCount 12/.test(codexStatus)
      && /Long runs can push the START banner out/.test(codexStatus)
      && /Tail 160/.test(codexStatus)
      && /\$hasStart -and -not \$hasEnd/.test(codexStatus),
      'Executor status must read the live file header, not only the tail, or long runs look not-fired');

    const codexMonitor = read('super-gsd/scripts/sgsd-codex-monitor.ps1');
    assert('Codex monitor renders live executor block',
      /Get-SgsdCodexExecutorStatus/.test(codexMonitor)
      && /CODEX EXECUTOR LIVE/.test(codexMonitor)
      && /Write-CodexExecutorLiveBlock/.test(codexMonitor),
      'Codex monitor must show live executor activity, not only review verdicts');
    assert('Codex monitor resolves current phase artifacts from root phases and milestone aliases',
      /function Get-ScopeMilestoneKeys/.test(codexMonitor)
      && /function Get-CurrentMilestonePhaseNums/.test(codexMonitor)
      && /function Get-PhaseSearchRoots/.test(codexMonitor)
      && /PHASE-INDEX\.jsonl/.test(codexMonitor)
      && /Join-Path \$PlanningDir "phases"/.test(codexMonitor),
      'Codex monitor ATC/MUDA/Gate Synopsis must find .planning/phases/<phase> artifacts for root-scoped projects');

    const watchCodex = read('super-gsd/scripts/sgsd-watch-codex.ps1');
    const profileExtensions = read('super-gsd/scripts/sgsd-profile-extensions.ps1');
    assert('Operator can open a dedicated PowerShell Codex tail window',
      /param\([\s\S]*\[switch\]\$OpenWindow/.test(watchCodex)
      && /param\([\s\S]*\[switch\]\$Narrate/.test(watchCodex)
      && /Start-SgsdBackgroundProcess/.test(watchCodex)
      && /Resolve-PowerShellWorkerExecutable/.test(watchCodex)
      && /Minimized/.test(watchCodex)
      && /codex-executor-live\.txt/.test(watchCodex)
      && /codex-live-output\.txt/.test(watchCodex)
      && /Invoke-HaikuNarrator/.test(watchCodex)
      && /function global:sgsd-watch-codex/.test(profileExtensions)
      && /-OpenWindow:\$OpenWindow/.test(profileExtensions)
      && /-Narrate:\$Narrate/.test(profileExtensions),
      'sgsd-watch-codex must support raw tailing plus -Narrate/-OpenWindow ELI5 mode');

    assert('Codex narrator wraps text and requests architecture diagrams',
      /function Get-CodexPaneWidth/.test(watchCodex)
      && /function Get-NarratorContentLayout/.test(watchCodex)
      && /function Get-SgsdNarratorContext/.test(watchCodex)
      && /function New-NarratorRawFallbackSummary/.test(watchCodex)
      && /function Split-WrappedText/.test(watchCodex)
      && /function Write-WrappedNarratorLine/.test(watchCodex)
      && /function Write-NarratorHeader/.test(watchCodex)
      && /LeftPad/.test(watchCodex)
      && /OUT OF SYNC/.test(watchCodex)
      && /live local fallback/.test(watchCodex)
      && /Raw stream live/.test(watchCodex)
      && /\[int\]\$NarrateSec = 60/.test(watchCodex)
      && /\[int\]\$ChunkChars = 6000/.test(watchCodex)
      && /PHASE WHY:/.test(watchCodex)
      && /ProjectContext/.test(watchCodex)
      && /Quote Trust Engine/.test(watchCodex)
      && /architecture-style ASCII diagram/.test(watchCodex)
      && /\+----------------------\+/.test(watchCodex)
      && /Every output line must fit within/.test(watchCodex),
      'Narrator pane must center/wrap long lines, preserve last good summaries on timeout, slow its default cadence, include phase context, and ask Haiku for boxed visual diagrams');

    const boot = read('super-gsd/scripts/sgsd-boot.ps1');
    assert('SG launch boots separate Codex watch window by default',
      /function Start-CodexLiveTail/.test(boot)
      && /sgsd-watch-codex\.ps1/.test(boot)
      && /SGSD-Codex-Raw/.test(boot)
      && /SGSD-Codex-Narrator/.test(boot)
      && /split-pane/.test(boot)
      && /"-Narrate"/.test(boot)
      && /\[switch\]\$NoCodexTail/.test(boot),
      'sgsd-boot/sg must open a separate raw+narrator Codex watch window unless -NoCodexTail is passed');

    const codexExecutor = read('super-gsd/scripts/codex-executor.sh');
    assert('Codex executor live file captures stdout and stderr',
      /tee -a "\$LIVE_OUT" -a "\$WATCH_OUT" > "\$STDERR_TMP"/.test(codexExecutor)
      && /tee -a "\$LIVE_OUT" -a "\$WATCH_OUT"[\s\\\n\r]*> "\$STDOUT_TMP"/.test(codexExecutor)
      && /codex-live-output\.txt/.test(codexExecutor),
      'Live tail must include Codex progress even when the CLI writes to stderr');
    assert('Codex executor routes Windows read-blocks to patch fallback',
      /CreateProcessAsUserW/.test(codexExecutor)
      && /--patch-fallback-files/.test(codexExecutor)
      && /codex-patch-executor\.sh/.test(codexExecutor)
      && /exit 8/.test(codexExecutor),
      'Windows Codex file-read failures must not become immediate operator-only stops');

    const codexPatchExecutor = read('super-gsd/scripts/codex-patch-executor.sh');
    assert('Codex patch executor enforces read-pack and allowlist',
      /PATCH_BEGIN/.test(codexPatchExecutor)
      && /apply --check/.test(codexPatchExecutor)
      && /patch touched non-allowlisted path/.test(codexPatchExecutor)
      && /mode":"patch-readpack/.test(codexPatchExecutor),
      'Patch fallback must have a strict patch contract, allowlist guard, and telemetry mode');

    const codexReview = read('super-gsd/scripts/codex-exec.sh');
    assert('Codex review/gate checks stream to the same live tail',
      /codex-live-output\.txt/.test(codexReview)
      && /codex-review START/.test(codexReview)
      && /codex-review END/.test(codexReview)
      && /tee -a "\$WATCH_OUT" > "\$STDERR_TMP"/.test(codexReview)
      && /tee -a "\$WATCH_OUT"[\s\\\n\r]*> "\$STDOUT_TMP"/.test(codexReview),
      'Codex gate/review checks must be visible in the dedicated live PowerShell tail');

    const ps1 = parsePowerShell('super-gsd/scripts/sgsd-mission-control.ps1');
    assert('Mission Control PowerShell parser OK', ps1.ok, ps1.stderr || ps1.stdout);
    const ps2 = parsePowerShell('super-gsd/scripts/sgsd-narrative.ps1');
    assert('Narrative PowerShell parser OK', ps2.ok, ps2.stderr || ps2.stdout);
    const ps3 = parsePowerShell('super-gsd/scripts/lib/sgsd-tab-watcher.ps1');
    assert('Tab watcher PowerShell parser OK', ps3.ok, ps3.stderr || ps3.stdout);
    const ps4 = parsePowerShell('super-gsd/scripts/lib/sgsd-render-cache.ps1');
    assert('Render cache PowerShell parser OK', ps4.ok, ps4.stderr || ps4.stdout);
    const ps5 = parsePowerShell('super-gsd/scripts/lib/sgsd-codex-status.ps1');
    assert('Codex status PowerShell parser OK', ps5.ok, ps5.stderr || ps5.stdout);
    const ps6 = parsePowerShell('super-gsd/scripts/sgsd-codex-monitor.ps1');
    assert('Codex monitor PowerShell parser OK', ps6.ok, ps6.stderr || ps6.stdout);
    const ps7 = parsePowerShell('super-gsd/scripts/sgsd-watch-codex.ps1');
    assert('Codex tail script PowerShell parser OK', ps7.ok, ps7.stderr || ps7.stdout);
    const ps8 = parsePowerShell('super-gsd/scripts/sgsd-profile-extensions.ps1');
    assert('Profile extensions PowerShell parser OK', ps8.ok, ps8.stderr || ps8.stdout);

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
