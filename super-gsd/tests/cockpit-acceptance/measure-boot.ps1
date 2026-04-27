# ============================================================================
# Phase 30 T1 - Boot Timing Capture
# ============================================================================
# Runs sgsd-boot.ps1 -NoOpen three times, captures wall-time via Measure-Command,
# emits a single-line summary in the format expected by COCKPIT-ACCEPTANCE-EVIDENCE.md.
#
# Exit 0 always (recording-only; absolute timing is not gated).
# ASCII-only literals (PS 5.1 mojibake guard).
# ============================================================================

param(
    [int]$Runs = 3
)

$ErrorActionPreference = "Stop"

$here     = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $here "..\..\..")
$boot     = Join-Path $repoRoot "super-gsd\scripts\sgsd-boot.ps1"

if (-not (Test-Path $boot)) {
    Write-Host "[ERROR] boot script not found: $boot" -ForegroundColor Red
    exit 2
}

$measurements = New-Object System.Collections.ArrayList
for ($i = 1; $i -le $Runs; $i++) {
    $tm = Measure-Command {
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $boot -NoOpen -ProjectDir $repoRoot 2>&1 | Out-Null
    }
    [void]$measurements.Add([pscustomobject]@{ Run = $i; Ms = [int]$tm.TotalMilliseconds })
}

$msArr = $measurements | ForEach-Object { $_.Ms }
$min = ($msArr | Measure-Object -Minimum).Minimum
$max = ($msArr | Measure-Object -Maximum).Maximum
$sorted = $msArr | Sort-Object
$median = if ($sorted.Count -ge 1) { $sorted[[Math]::Floor(($sorted.Count - 1) / 2)] } else { 0 }

Write-Host ""
$measurements | Format-Table | Out-String | Write-Host
Write-Host ("boot timing (sgsd-boot.ps1 -NoOpen, {0} runs): min={1}ms median={2}ms max={3}ms" -f $Runs, $min, $median, $max)

exit 0
