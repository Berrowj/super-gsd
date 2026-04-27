# ============================================================================
# Phase 29 T2 - Mission Strip Q5/Q6 Fixture Suite
# ============================================================================
# Deterministic, offline, dot-sources the production lib (Live-or-Local rule).
# Walks F1-F12 under fixtures/, materialises each into a temp project dir,
# invokes Get-MissionStripState against the real lib, asserts $state.codexAgents
# matches the per-fixture expected-output.txt.
#
# Exit code 0 on full pass, non-zero on any failure.
# ASCII-only literals (PS 5.1 mojibake guard).
# ============================================================================

$ErrorActionPreference = "Stop"

$here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot   = Resolve-Path (Join-Path $here "..\..\..")
$libPath    = Join-Path $repoRoot "super-gsd\scripts\lib\sgsd-mission-strip.ps1"
$fixturesDir = Join-Path $here "fixtures"

if (-not (Test-Path $libPath))      { Write-Host "[ERROR] lib not found: $libPath" -ForegroundColor Red; exit 2 }
if (-not (Test-Path $fixturesDir))  { Write-Host "[ERROR] fixtures not found: $fixturesDir" -ForegroundColor Red; exit 2 }

# Minimal stub for Get-SharedActivityEntries so fixtures run offline without
# the render-cache dependency. Same return shape as the real cache.
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
        # Caller wraps with @(...). Return as object[] (no comma op) so PowerShell's
        # output stream unrolls cleanly and @() collects back to a flat array.
        return $entries.ToArray()
    }
}

. $libPath

function Materialise-Fixture {
    param([string]$FixtureDir, [string]$TempDir)

    $planning = Join-Path $TempDir ".planning"
    $metrics  = Join-Path $planning "metrics"
    [void](New-Item -ItemType Directory -Force -Path $metrics)

    # STATE.md (required for activePhase derivation)
    $srcState = Join-Path $FixtureDir "STATE.md"
    if (Test-Path $srcState) {
        Copy-Item $srcState (Join-Path $planning "STATE.md") -Force
    }

    # codex-live.json (optional, F6 omits it)
    $srcCodex = Join-Path $FixtureDir "codex-live.json"
    if (Test-Path $srcCodex) {
        $dstCodex = Join-Path $metrics "codex-live.json"
        Copy-Item $srcCodex $dstCodex -Force

        # Forge mtime per meta.json (deterministic, no clock drift)
        $metaPath = Join-Path $FixtureDir "meta.json"
        if (Test-Path $metaPath) {
            try {
                $meta = Get-Content -Raw $metaPath | ConvertFrom-Json
                if ($meta.codex_mtime_offset_sec -ne $null) {
                    $offset = [int]$meta.codex_mtime_offset_sec
                    $newTime = (Get-Date).AddSeconds($offset)
                    (Get-Item $dstCodex).LastWriteTime = $newTime
                }
            } catch {}
        }
    }

    # activity-log.jsonl (optional)
    $srcAct = Join-Path $FixtureDir "activity-log.jsonl"
    if (Test-Path $srcAct) {
        Copy-Item $srcAct (Join-Path $metrics "activity-log.jsonl") -Force
    }
}

function Invoke-Fixture {
    param([string]$FixtureName)

    $fixDir  = Join-Path $fixturesDir $FixtureName
    $expPath = Join-Path $fixDir "expected-output.txt"
    if (-not (Test-Path $expPath)) {
        return @{ pass = $false; expected = "<missing>"; actual = "(no expected-output.txt)" }
    }
    $expected = (Get-Content -Raw $expPath).TrimEnd("`r","`n")

    $tmp = Join-Path $env:TEMP ("sgsd-fixture-" + [guid]::NewGuid().ToString("N"))
    [void](New-Item -ItemType Directory -Force -Path $tmp)
    try {
        Materialise-Fixture -FixtureDir $fixDir -TempDir $tmp
        $state = Get-MissionStripState -ProjectDir $tmp -ActivityTail 500
        $actual = "$($state.codexAgents)"
        return @{
            pass     = ($actual -eq $expected)
            expected = $expected
            actual   = $actual
        }
    }
    finally {
        if (Test-Path $tmp) { Remove-Item -Recurse -Force -LiteralPath $tmp -ErrorAction SilentlyContinue }
    }
}

# Walk F1-F12 in order
$fixtureOrder = 1..12 | ForEach-Object { "F$_" }
$pass = 0
$fail = 0
$failures = @()

$started = Get-Date
foreach ($name in $fixtureOrder) {
    $fixDir = Join-Path $fixturesDir $name
    if (-not (Test-Path $fixDir)) {
        Write-Host "[SKIP] $name  (fixture dir missing)" -ForegroundColor Yellow
        $fail++
        $failures += "$name  MISSING-FIXTURE-DIR"
        continue
    }
    $r = Invoke-Fixture -FixtureName $name
    if ($r.pass) {
        Write-Host ("[PASS] {0}  {1}" -f $name, $r.actual) -ForegroundColor Green
        $pass++
    } else {
        Write-Host ("[FAIL] {0}" -f $name) -ForegroundColor Red
        Write-Host ("       expected: {0}" -f $r.expected) -ForegroundColor DarkGray
        Write-Host ("       actual:   {0}" -f $r.actual)   -ForegroundColor DarkGray
        $fail++
        $failures += ("{0}  expected={1}  actual={2}" -f $name, $r.expected, $r.actual)
    }
}
$elapsedMs = [int]((Get-Date) - $started).TotalMilliseconds

Write-Host ""
$summaryColor = if ($fail -eq 0) { "Green" } else { "Red" }
Write-Host ("{0}/12 fixtures pass  ({1}ms)" -f $pass, $elapsedMs) -ForegroundColor $summaryColor

if ($fail -gt 0) { exit 1 } else { exit 0 }
