# sgsd-open-codex-watch.ps1
# Opens a Windows Terminal tab split vertically:
#   left  = raw Codex stream
#   right = SGSD Codex narrator
#
# This avoids fragile inline `wt ... ; split-pane ...` escaping in PowerShell.

param(
    [string]$ProjectDir = (Get-Location).Path,
    [string]$WatchScript = '',
    [int]$NarrateSec = 60,
    [int]$ChunkChars = 6000,
    [int]$NarratorTimeoutSec = 120,
    [decimal]$NarratorSize = 0.45,
    [switch]$Foreground
)

function Resolve-SgsdProjectRoot {
    param([string]$StartDir)

    try {
        $current = (Resolve-Path -LiteralPath $StartDir -ErrorAction Stop).Path
    } catch {
        $current = (Get-Location).Path
    }

    while ($current -and (Test-Path -LiteralPath $current)) {
        if (Test-Path -LiteralPath (Join-Path $current '.planning')) {
            return $current
        }
        $parent = Split-Path -Parent $current
        if (-not $parent -or $parent -eq $current) { break }
        $current = $parent
    }

    return $null
}

$root = Resolve-SgsdProjectRoot -StartDir $ProjectDir
if (-not $root) {
    Write-Host "sgsd-open-codex-watch: no .planning/ ancestor found from $ProjectDir" -ForegroundColor Red
    exit 1
}

if (-not $WatchScript) {
    $WatchScript = Join-Path $PSScriptRoot 'sgsd-watch-codex.ps1'
}

try {
    $WatchScript = (Resolve-Path -LiteralPath $WatchScript -ErrorAction Stop).Path
} catch {
    Write-Host "sgsd-open-codex-watch: watcher script not found: $WatchScript" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command wt.exe -ErrorAction SilentlyContinue)) {
    Write-Host "sgsd-open-codex-watch: wt.exe not found. Open Windows Terminal and install/update it." -ForegroundColor Red
    exit 1
}

$sizeText = $NarratorSize.ToString([System.Globalization.CultureInfo]::InvariantCulture)
$args = @(
    '-w', 'new',
    'new-tab',
    '--title', 'SGSD-Codex-Raw',
    '-d', $root,
    'powershell.exe',
    '-NoExit',
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $WatchScript,
    '-ProjectDir', $root,
    ';',
    'split-pane',
    '-V',
    '--size', $sizeText,
    '--title', 'SGSD-Codex-Narrator',
    '-d', $root,
    'powershell.exe',
    '-NoExit',
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', $WatchScript,
    '-ProjectDir', $root,
    '-Narrate',
    '-NarrateSec', "$NarrateSec",
    '-ChunkChars', "$ChunkChars",
    '-NarratorTimeoutSec', "$NarratorTimeoutSec"
)

$windowStyle = if ($Foreground) { 'Normal' } else { 'Minimized' }
Start-Process -FilePath wt.exe -ArgumentList $args -WindowStyle $windowStyle
$focusText = if ($Foreground) { 'foreground' } else { 'minimized/no-focus' }
Write-Host "sgsd-open-codex-watch: opened raw + narrator split for $root ($focusText)" -ForegroundColor Green
