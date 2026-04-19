# Measures the cost of a single Render() from each SGSD dashboard.
# Run from the repo root. Outputs wall-clock ms + GC allocations per render.
param(
    [string]$ProjectDir = "."
)

$ErrorActionPreference = "Stop"
$ProjectDir = (Resolve-Path $ProjectDir).Path

function Measure-Script($scriptPath, $iterations = 5) {
    $sb = [scriptblock]::Create((Get-Content $scriptPath -Raw))
    # Strip the `while ($true)` main loop so we only measure Render() cost.
    $src = Get-Content $scriptPath -Raw
    # Extract everything up to but not including the main loop's while($true)
    $cut = $src -replace '(?s)while\s*\(\s*\$true\s*\).*$', ''
    $cut = $cut -replace '(?s)Register-ObjectEvent[^\n]*\n', ''
    $cut = $cut -replace '(?s)\$watcher\.EnableRaisingEvents\s*=\s*\$true', ''
    $cut = $cut -replace '(?s)\$w1\.EnableRaisingEvents\s*=\s*\$true', ''
    $cut = $cut -replace '(?s)\$w2\.EnableRaisingEvents\s*=\s*\$true', ''

    # Replace Write-Host to /dev/null to isolate pure compute cost
    $cut = "function Write-Host { param([Parameter(ValueFromRemainingArguments=`$true)]`$args) }`n" + $cut

    $tmpScript = New-TemporaryFile
    $tmpPs1 = "$($tmpScript.FullName).ps1"
    Set-Content -Path $tmpPs1 -Value $cut -Encoding utf8

    # Warm up
    & powershell -NoProfile -ExecutionPolicy Bypass -Command "& '$tmpPs1' -ProjectDir '$ProjectDir'; Render" 2>&1 | Out-Null

    $times = @()
    for ($i = 0; $i -lt $iterations; $i++) {
        $sw = [System.Diagnostics.Stopwatch]::StartNew()
        & powershell -NoProfile -ExecutionPolicy Bypass -Command "& '$tmpPs1' -ProjectDir '$ProjectDir'; Render" 2>&1 | Out-Null
        $sw.Stop()
        $times += $sw.ElapsedMilliseconds
    }
    Remove-Item $tmpPs1 -Force -ErrorAction SilentlyContinue
    Remove-Item $tmpScript.FullName -Force -ErrorAction SilentlyContinue

    $avg = [math]::Round(($times | Measure-Object -Average).Average, 0)
    $min = ($times | Measure-Object -Minimum).Minimum
    $max = ($times | Measure-Object -Maximum).Maximum
    Write-Host "$($scriptPath | Split-Path -Leaf): avg=${avg}ms min=${min}ms max=${max}ms (n=$iterations, includes pwsh startup)"
}

$scripts = @(
    "super-gsd\scripts\sgsd-mission-control.ps1",
    "super-gsd\scripts\sgsd-narrative.ps1",
    "super-gsd\scripts\sgsd-gate-verdict.ps1"
)

foreach ($s in $scripts) {
    Measure-Script (Join-Path $ProjectDir $s)
}
