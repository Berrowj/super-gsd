# ============================================================================
# Phase 30 T1 - Cockpit Acceptance Fixture Runner
# ============================================================================
# Walks A1/A2/A4/A6/A7/A8 + reuses Phase 29 fixtures F1/F4/F5/F6 for the four
# acceptance scenarios already covered by the Phase 29 suite (codex-stale,
# codex-timeout, codex-warned base, codex-unavailable).
#
# Deterministic, offline. Dot-sources the production lib at
# super-gsd/scripts/lib/sgsd-mission-strip.ps1 (Live-or-Local rule).
#
# Per-fixture assertions:
#   - $state.codexAgents       == expected-output.txt        (always)
#   - $state.modelColor field  encodes state via _ModelStateFromColor (when expected-model.txt present)
#   - $state.next contains substring expected-nextaction.txt (when present, A7 only)
#
# Activity-log placeholder substitution:
#   __TS_OFFSET_-NNN__   ->  ISO-8601 timestamp of (Get-Date).AddSeconds(-NNN)
#
# Exit code 0 on full pass, 1 on any failure.
# ASCII-only literals (PS 5.1 mojibake guard).
# ============================================================================

$ErrorActionPreference = "Stop"

$here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot   = Resolve-Path (Join-Path $here "..\..\..")
$libPath    = Join-Path $repoRoot "super-gsd\scripts\lib\sgsd-mission-strip.ps1"
$localFix   = Join-Path $here "fixtures"
$phase29Fix = Join-Path $here "..\mission-strip\fixtures"

if (-not (Test-Path $libPath))   { Write-Host "[ERROR] lib not found: $libPath" -ForegroundColor Red; exit 2 }
if (-not (Test-Path $localFix))  { Write-Host "[ERROR] local fixtures not found: $localFix" -ForegroundColor Red; exit 2 }
if (-not (Test-Path $phase29Fix)){ Write-Host "[ERROR] phase29 fixtures not found: $phase29Fix" -ForegroundColor Red; exit 2 }

# Stub for Get-SharedActivityEntries so fixtures run offline without the cache.
if (-not (Get-Command Get-SharedActivityEntries -ErrorAction SilentlyContinue)) {
    function Get-SharedActivityEntries {
        param(
            [string]$Path,
            [int]$Tail = 500
        )
        if (-not (Test-Path $Path)) { return @() }
        $lines = @(Get-Content -Tail $Tail $Path -ErrorAction SilentlyContinue)
        $entries = New-Object System.Collections.ArrayList
        foreach ($line in $lines) {
            if (-not $line) { continue }
            try { [void]$entries.Add(($line | ConvertFrom-Json -ErrorAction Stop)) } catch {}
        }
        return $entries.ToArray()
    }
}

. $libPath

function Substitute-TsTokens {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return }
    $raw = Get-Content -Raw $Path
    $pattern = '__TS_OFFSET_(-?\d+)__'
    $now = Get-Date
    $new = [regex]::Replace($raw, $pattern, {
        param($m)
        $offset = [int]$m.Groups[1].Value
        $now.AddSeconds($offset).ToString("o")
    })
    if ($new -ne $raw) {
        Set-Content -LiteralPath $Path -Value $new -NoNewline
    }
}

function Materialise-Fixture {
    param([string]$FixtureDir, [string]$TempDir)

    $planning = Join-Path $TempDir ".planning"
    $metrics  = Join-Path $planning "metrics"
    [void](New-Item -ItemType Directory -Force -Path $metrics)

    $meta = $null
    $metaPath = Join-Path $FixtureDir "meta.json"
    if (Test-Path $metaPath) {
        try { $meta = Get-Content -Raw $metaPath | ConvertFrom-Json } catch {}
    }

    # STATE.md (always at .planning/STATE.md)
    $srcState = Join-Path $FixtureDir "STATE.md"
    if (Test-Path $srcState) {
        Copy-Item $srcState (Join-Path $planning "STATE.md") -Force
    }

    # codex-live.json (optional)
    $srcCodex = Join-Path $FixtureDir "codex-live.json"
    if (Test-Path $srcCodex) {
        $dstCodex = Join-Path $metrics "codex-live.json"
        Copy-Item $srcCodex $dstCodex -Force
        if ($meta -and ($meta.codex_mtime_offset_sec -ne $null)) {
            (Get-Item $dstCodex).LastWriteTime = (Get-Date).AddSeconds([int]$meta.codex_mtime_offset_sec)
        }
    }

    # activity-log.jsonl (optional)
    $srcAct = Join-Path $FixtureDir "activity-log.jsonl"
    if (Test-Path $srcAct) {
        $dstAct = Join-Path $metrics "activity-log.jsonl"
        Copy-Item $srcAct $dstAct -Force
        Substitute-TsTokens -Path $dstAct
        if ($meta -and ($meta.activity_mtime_offset_sec -ne $null)) {
            (Get-Item $dstAct).LastWriteTime = (Get-Date).AddSeconds([int]$meta.activity_mtime_offset_sec)
        }
    }

    # heartbeat.jsonl (optional - A7)
    $srcHb = Join-Path $FixtureDir "heartbeat.jsonl"
    if (Test-Path $srcHb) {
        $dstHb = Join-Path $metrics "heartbeat.jsonl"
        Copy-Item $srcHb $dstHb -Force
        Substitute-TsTokens -Path $dstHb
        if ($meta -and ($meta.heartbeat_mtime_offset_sec -ne $null)) {
            (Get-Item $dstHb).LastWriteTime = (Get-Date).AddSeconds([int]$meta.heartbeat_mtime_offset_sec)
        }
    }

    # crit-backlog.jsonl (optional - A2)
    $srcCrit = Join-Path $FixtureDir "crit-backlog.jsonl"
    if (Test-Path $srcCrit) {
        $dstCrit = Join-Path $metrics "crit-backlog.jsonl"
        Copy-Item $srcCrit $dstCrit -Force
        if ($meta -and ($meta.crit_mtime_offset_sec -ne $null)) {
            (Get-Item $dstCrit).LastWriteTime = (Get-Date).AddSeconds([int]$meta.crit_mtime_offset_sec)
        }
    }

    # ORCHESTRATOR-CHECKPOINT.md (optional - A7) - lives at project root for lib semantics
    $srcCk = Join-Path $FixtureDir "ORCHESTRATOR-CHECKPOINT.md"
    if (Test-Path $srcCk) {
        Copy-Item $srcCk (Join-Path $planning "ORCHESTRATOR-CHECKPOINT.md") -Force
    }
}

function _ModelStateFromColor {
    param([string]$Color)
    switch ($Color) {
        "Green"   { "active" }
        "Yellow"  { "waiting" }
        "Red"     { "stale" }
        default   { "unavailable" }
    }
}

function Invoke-Fixture {
    param(
        [string]$Id,
        [string]$FixtureDir,
        [string]$Scenario
    )

    $expPath = Join-Path $FixtureDir "expected-output.txt"
    if (-not (Test-Path $expPath)) {
        return @{ pass=$false; details=@("missing expected-output.txt") }
    }
    $expected = (Get-Content -Raw $expPath).TrimEnd("`r","`n")

    $expModelPath = Join-Path $FixtureDir "expected-model.txt"
    $expectedModel = $null
    if (Test-Path $expModelPath) {
        $expectedModel = (Get-Content -Raw $expModelPath).Trim()
    }

    $expNextPath = Join-Path $FixtureDir "expected-nextaction.txt"
    $expectedNextSubstr = $null
    if (Test-Path $expNextPath) {
        $expectedNextSubstr = (Get-Content -Raw $expNextPath).Trim()
    }

    $tmp = Join-Path $env:TEMP ("sgsd-acceptance-" + [guid]::NewGuid().ToString("N"))
    [void](New-Item -ItemType Directory -Force -Path $tmp)
    $details = @()
    $pass = $true
    try {
        Materialise-Fixture -FixtureDir $FixtureDir -TempDir $tmp
        $state = Get-MissionStripState -ProjectDir $tmp -ActivityTail 500

        # Primary assertion: codexAgents string match
        $actual = "$($state.codexAgents)"
        if ($actual -ne $expected) {
            $pass = $false
            $details += "codexAgents expected={$expected} actual={$actual}"
        }

        # Secondary: model state via color encoding (A1/A6/A8 only)
        if ($expectedModel) {
            $actualModel = _ModelStateFromColor $state.modelColor
            if ($actualModel -ne $expectedModel) {
                $pass = $false
                $details += "model-state expected={$expectedModel} actual={$actualModel}"
            }
        }

        # Tertiary: next-action substring (A7 only)
        if ($expectedNextSubstr) {
            $actualNext = "$($state.next)"
            if ($actualNext -notlike "*$expectedNextSubstr*") {
                $pass = $false
                $details += "nextAction substr={$expectedNextSubstr} not in {$actualNext}"
            }
        }

        return @{ pass=$pass; details=$details; codexAgents=$actual; modelColor=$state.modelColor; next=$state.next }
    }
    finally {
        if (Test-Path $tmp) { Remove-Item -Recurse -Force -LiteralPath $tmp -ErrorAction SilentlyContinue }
    }
}

# Fixture order: A1..A8 (Phase 50 A2/A3/A5 added) + 4 reused Phase 29 (13 total).
# A3 = NEW Phase 50 codex-running fixture (replaces F4 alias; F4 still reused as F4-timeout).
# A5 = NEW Phase 50 viewport-fit suite (3 sub-fixtures: 80x24, 120x30, 132x40) covering
# the 40-row compact-mode threshold change (Phase 50 COCKPIT-05 / A4).
$fixtures = @(
    @{ Id="A1";          Dir=(Join-Path $localFix   "A1");           Scenario="active normal" }
    @{ Id="A2";          Dir=(Join-Path $localFix   "A2");           Scenario="blocked-gate" }
    @{ Id="A3";          Dir=(Join-Path $localFix   "A3");           Scenario="codex-running (Phase 50 A3)" }
    @{ Id="A4";          Dir=(Join-Path $localFix   "A4");           Scenario="codex-warned" }
    @{ Id="A5/80x24";    Dir=(Join-Path $localFix   "A5\80x24");     Scenario="viewport 80x24 compact" }
    @{ Id="A5/120x30";   Dir=(Join-Path $localFix   "A5\120x30");    Scenario="viewport 120x30 compact (40-row threshold)" }
    @{ Id="A5/132x40";   Dir=(Join-Path $localFix   "A5\132x40");    Scenario="viewport 132x40 full" }
    @{ Id="A6";          Dir=(Join-Path $localFix   "A6");           Scenario="activity-stale" }
    @{ Id="A7";          Dir=(Join-Path $localFix   "A7");           Scenario="forced-restart" }
    @{ Id="A8";          Dir=(Join-Path $localFix   "A8");           Scenario="no-tool-event" }
    @{ Id="F4-timeout";  Dir=(Join-Path $phase29Fix "F4");           Scenario="codex-timeout (reuse F4)" }
    @{ Id="F1-stale";    Dir=(Join-Path $phase29Fix "F1");           Scenario="codex-stale (reuse F1)" }
    @{ Id="F5-base";     Dir=(Join-Path $phase29Fix "F5");           Scenario="codex-warned base (reuse F5)" }
    @{ Id="F6-unavail";  Dir=(Join-Path $phase29Fix "F6");           Scenario="codex-unavailable (reuse F6)" }
)

# ============================================================================
# Test-CockpitReadOnlyInvariant (Phase 50 Task 6)
# ----------------------------------------------------------------------------
# Mirrors super-gsd/tools/dispatch-router/route.cjs:679-700 _captureFingerprint /
# _diffFingerprint pattern. Walks every .planning/metrics/*.jsonl and *.json
# under $PlanningDir, captures path + mtime + size pre-render, runs a single
# Render frame via Get-MissionStripState (the canonical lib that the live
# cockpit dot-sources), captures the fingerprints again, and asserts NO file
# drifted in mtime or size.
#
# Also asserts `git diff --quiet super-gsd/tools/` to enforce the read-only
# invariant against the locked Phase 41-49 helper trees and gate-savings tools.
# Phase 50 PLAN locks Render to read-only over .planning/. Any new write under
# .planning/metrics/ from a Render call (or its callees) violates Lock 13 and
# must trip this invariant.
# ============================================================================
function Test-CockpitReadOnlyInvariant {
    param(
        [string]$PlanningDir,
        [string]$ProjectDir,
        [string]$ToolsDir
    )

    $report = @{ pass=$true; details=@() }

    if (-not (Test-Path $PlanningDir)) {
        $report.pass = $false
        $report.details += "PlanningDir missing: $PlanningDir"
        return $report
    }

    $metricsDir = Join-Path $PlanningDir "metrics"

    function _Capture {
        param([string]$Dir)
        $fp = @{}
        if (-not (Test-Path $Dir)) { return $fp }
        $items = Get-ChildItem -Path $Dir -File -ErrorAction SilentlyContinue |
                 Where-Object { $_.Extension -in ".jsonl", ".json" }
        foreach ($it in $items) {
            $fp[$it.FullName] = @{
                exists = $true
                mtime  = $it.LastWriteTime.Ticks
                size   = $it.Length
            }
        }
        return $fp
    }

    $before = _Capture $metricsDir

    # Single Render frame via the canonical lib (already dot-sourced at top
    # of this harness). Get-MissionStripState is read-only by contract.
    try {
        [void](Get-MissionStripState -ProjectDir $ProjectDir -ActivityTail 500)
    } catch {
        $report.pass = $false
        $report.details += "Render frame threw: $($_.Exception.Message)"
    }

    $after = _Capture $metricsDir

    # Diff fingerprint: any drift = canonical-stream write detected.
    foreach ($k in $before.Keys) {
        $b = $before[$k]
        $a = $after[$k]
        if ($null -eq $a) {
            $report.pass = $false
            $report.details += ("DELETED during render: {0}" -f $k)
            continue
        }
        if ($b.mtime -ne $a.mtime -or $b.size -ne $a.size) {
            $report.pass = $false
            $report.details += ("DRIFT during render: {0} (mtime/size changed)" -f $k)
        }
    }
    foreach ($k in $after.Keys) {
        if (-not $before.ContainsKey($k)) {
            $report.pass = $false
            $report.details += ("CREATED during render: {0}" -f $k)
        }
    }

    # super-gsd/tools/ git-diff-quiet check (only if dir + git present).
    if ($ToolsDir -and (Test-Path $ToolsDir) -and (Get-Command git -ErrorAction SilentlyContinue)) {
        try {
            $gitOut = & git -C (Split-Path -Parent $ToolsDir) diff --quiet -- super-gsd/tools/ 2>$null
            if ($LASTEXITCODE -ne 0) {
                $report.pass = $false
                $report.details += "super-gsd/tools/ has uncommitted drift after render frame"
            }
        } catch {
            # git unavailable in CI - log but do not fail.
        }
    }

    return $report
}

$pass = 0
$fail = 0
$failures = @()
$started = Get-Date

foreach ($fx in $fixtures) {
    if (-not (Test-Path $fx.Dir)) {
        Write-Host ("[SKIP] {0,-10}  {1}  (dir missing: {2})" -f $fx.Id, $fx.Scenario, $fx.Dir) -ForegroundColor Yellow
        $fail++
        $failures += ("{0}  MISSING-FIXTURE-DIR" -f $fx.Id)
        continue
    }
    $r = Invoke-Fixture -Id $fx.Id -FixtureDir $fx.Dir -Scenario $fx.Scenario
    if ($r.pass) {
        Write-Host ("[PASS] {0,-10}  {1,-32}  {2}" -f $fx.Id, $fx.Scenario, $r.codexAgents) -ForegroundColor Green
        $pass++
    } else {
        Write-Host ("[FAIL] {0,-10}  {1}" -f $fx.Id, $fx.Scenario) -ForegroundColor Red
        foreach ($d in $r.details) {
            Write-Host ("       {0}" -f $d) -ForegroundColor DarkGray
        }
        $fail++
        $failures += ("{0}  {1}" -f $fx.Id, ($r.details -join " | "))
    }
}
$elapsedMs = [int]((Get-Date) - $started).TotalMilliseconds

# ----------------------------------------------------------------------------
# Read-only invariant - LAST step (Phase 50 PLAN Task 6 / Lock 13).
# Materialises a clean A1 fixture into a tmp dir and asserts no canonical
# stream drift after a single Render frame. Mirrors dispatch-router/route.cjs
# self-test fingerprint pattern. Skipped when invoked with -SkipInvariant.
# ----------------------------------------------------------------------------
$invariantPass = $true
$invariantDetails = @()
if (-not $env:SGSD_COCKPIT_SKIP_INVARIANT) {
    Write-Host ""
    $invTmp = Join-Path $env:TEMP ("sgsd-acceptance-invariant-" + [guid]::NewGuid().ToString("N"))
    [void](New-Item -ItemType Directory -Force -Path $invTmp)
    try {
        $invFixDir = Join-Path $localFix "A1"
        if (Test-Path $invFixDir) {
            Materialise-Fixture -FixtureDir $invFixDir -TempDir $invTmp
            $invPlanning = Join-Path $invTmp ".planning"
            $invToolsDir = Join-Path $repoRoot "super-gsd\tools"
            $rep = Test-CockpitReadOnlyInvariant -PlanningDir $invPlanning -ProjectDir $invTmp -ToolsDir $invToolsDir
            if ($rep.pass) {
                Write-Host ("[PASS] {0,-10}  {1}" -f "ReadOnly", "no canonical-stream drift after Render frame") -ForegroundColor Green
            } else {
                $invariantPass = $false
                $invariantDetails = $rep.details
                Write-Host ("[FAIL] {0,-10}  read-only invariant tripped" -f "ReadOnly") -ForegroundColor Red
                foreach ($d in $rep.details) {
                    Write-Host ("       {0}" -f $d) -ForegroundColor DarkGray
                }
            }
        } else {
            Write-Host ("[SKIP] ReadOnly      A1 fixture missing - cannot run invariant") -ForegroundColor Yellow
        }
    } finally {
        if (Test-Path $invTmp) { Remove-Item -Recurse -Force -LiteralPath $invTmp -ErrorAction SilentlyContinue }
    }
}

Write-Host ""
$total = $pass + $fail
$summaryColor = if ($fail -eq 0 -and $invariantPass) { "Green" } else { "Red" }
$invTag = if ($invariantPass) { "OK" } else { "TRIPPED" }
Write-Host ("acceptance: {0}/{1} PASS  invariant: {2}  ({3}ms)" -f $pass, $total, $invTag, $elapsedMs) -ForegroundColor $summaryColor

if ($fail -gt 0 -or -not $invariantPass) { exit 1 } else { exit 0 }
