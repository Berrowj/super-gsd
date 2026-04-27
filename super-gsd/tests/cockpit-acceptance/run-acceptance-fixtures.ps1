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

# Fixture order: 6 new local + 4 reused Phase 29 (10 total)
$fixtures = @(
    @{ Id="A1";        Dir=(Join-Path $localFix   "A1"); Scenario="active normal" }
    @{ Id="A2";        Dir=(Join-Path $localFix   "A2"); Scenario="blocked-gate" }
    @{ Id="A4";        Dir=(Join-Path $localFix   "A4"); Scenario="codex-warned" }
    @{ Id="A6";        Dir=(Join-Path $localFix   "A6"); Scenario="activity-stale" }
    @{ Id="A7";        Dir=(Join-Path $localFix   "A7"); Scenario="forced-restart" }
    @{ Id="A8";        Dir=(Join-Path $localFix   "A8"); Scenario="no-tool-event" }
    @{ Id="A3=F4";     Dir=(Join-Path $phase29Fix "F4"); Scenario="codex-timeout (reuse F4)" }
    @{ Id="F1-stale";  Dir=(Join-Path $phase29Fix "F1"); Scenario="codex-stale (reuse F1)" }
    @{ Id="F5-base";   Dir=(Join-Path $phase29Fix "F5"); Scenario="codex-warned base (reuse F5)" }
    @{ Id="F6-unavail";Dir=(Join-Path $phase29Fix "F6"); Scenario="codex-unavailable (reuse F6)" }
)

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

Write-Host ""
$total = $pass + $fail
$summaryColor = if ($fail -eq 0) { "Green" } else { "Red" }
Write-Host ("acceptance: {0}/{1} PASS  ({2}ms)" -f $pass, $total, $elapsedMs) -ForegroundColor $summaryColor

if ($fail -gt 0) { exit 1 } else { exit 0 }
