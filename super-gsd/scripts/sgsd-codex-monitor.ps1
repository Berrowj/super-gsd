# ============================================================================
# Super GSD - P5 - Codex Monitor
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [int]$Heartbeat = 30
)

function __sgsd_fail {
    param($title, $detailLines)
    Write-Host ""
    Write-Host "  ========================================================" -ForegroundColor Red
    Write-Host ("  {0}" -f $title) -ForegroundColor Red
    Write-Host "  ========================================================" -ForegroundColor Red
    Write-Host ""
    foreach ($line in $detailLines) { Write-Host "    $line" -ForegroundColor DarkYellow }
    Write-Host ""
    if ($Host.Name -ne 'ConsoleHost' -or $env:SGSD_NO_PAUSE_ON_ERROR) { exit 1 }
    Write-Host "    Press any key to close this window..." -ForegroundColor DarkGray
    $null = [System.Console]::ReadKey($true)
    exit 1
}

try {
    $ProjectDir = (Resolve-Path $ProjectDir -ErrorAction Stop).Path
} catch {
    __sgsd_fail "CANNOT RESOLVE PROJECT DIR" @(
        "Supplied: $ProjectDir",
        "Resolve-Path error: $($_.Exception.Message)"
    )
}

$PlanningDir = Join-Path $ProjectDir ".planning"
if (-not (Test-Path $PlanningDir)) {
    __sgsd_fail "NO .planning DIRECTORY FOUND" @(
        "Project dir: $ProjectDir",
        "Expected:    $PlanningDir"
    )
}

$ErrorActionPreference = "SilentlyContinue"

. (Join-Path $PSScriptRoot "lib\sgsd-render-cache.ps1")
. (Join-Path $PSScriptRoot "lib\sgsd-substrate-status.ps1")
. (Join-Path $PSScriptRoot "lib\sgsd-codex-status.ps1")

$ESC = [char]27
$HOME_POS    = "$ESC[H"
$CLEAR_LINE  = "$ESC[K"
$CLEAR_BELOW = "$ESC[0J"
$HIDE_CURSOR = "$ESC[?25l"
$SHOW_CURSOR = "$ESC[?25h"
$ALT_ENTER   = "$ESC[?1049h"
$ALT_EXIT    = "$ESC[?1049l"

$script:_AnsiColors = @{
    Black = "$ESC[30m"; DarkBlue = "$ESC[34m"; DarkGreen = "$ESC[32m"; DarkCyan = "$ESC[36m"
    DarkRed = "$ESC[31m"; DarkMagenta = "$ESC[35m"; DarkYellow = "$ESC[33m"; Gray = "$ESC[37m"
    DarkGray = "$ESC[90m"; Blue = "$ESC[94m"; Green = "$ESC[92m"; Cyan = "$ESC[96m"
    Red = "$ESC[91m"; Magenta = "$ESC[95m"; Yellow = "$ESC[93m"; White = "$ESC[97m"
}
$script:_AnsiReset = "$ESC[0m"

function Write-Host {
    [CmdletBinding()]
    param(
        [Parameter(Position=0, ValueFromPipeline=$true, ValueFromRemainingArguments=$true)]
        [AllowNull()]
        [object]$Object,
        [switch]$NoNewline,
        [string]$ForegroundColor,
        [string]$BackgroundColor,
        [string]$Separator = ''
    )
    $text = if ($Object -is [array]) { ($Object -join $Separator) } else { "$Object" }
    if ($ForegroundColor -and $script:_AnsiColors.ContainsKey($ForegroundColor)) {
        $text = $script:_AnsiColors[$ForegroundColor] + $text + $script:_AnsiReset
    }
    if ($NoNewline) { [Console]::Out.Write($text) } else { [Console]::Out.WriteLine($text) }
}

function Get-PaneWidth {
    try { return [Console]::WindowWidth - 1 } catch { return 70 }
}

function Trunc($text, $width) {
    if ($null -eq $text) { return "" }
    $text = "$text"
    if ($text.Length -gt $width) { return $text.Substring(0, [Math]::Max(1, $width - 2)) + ".." }
    return $text
}

function Format-Age($sec) {
    if ($null -eq $sec) { return "--" }
    if ($sec -lt 60)   { return "${sec}s" }
    if ($sec -lt 3600) { return "$([math]::Floor($sec/60))m" }
    if ($sec -lt 86400){ return "$([math]::Floor($sec/3600))h" }
    return "$([math]::Floor($sec/86400))d"
}

function Get-CurrentPhaseNum {
    $stateFile = Join-Path $PlanningDir "STATE.md"
    if (-not (Test-Path $stateFile)) { return "" }
    foreach ($line in (Get-Content $stateFile -TotalCount 30 -ErrorAction SilentlyContinue)) {
        if ($line -match '^(?:current_phase|phase):\s*(\S+)') { return $matches[1].Trim('"', "'") }
    }
    return ""
}

function Render {
    if (-not (Test-RenderDue -MinIntervalMs 2000)) { return }

    Write-Host $HOME_POS -NoNewline
    $pw = Get-PaneWidth
    $ts = Get-Date -Format 'HH:mm:ss'
    $phaseNum = Get-CurrentPhaseNum
    $substrate = Get-SubstrateStatus -ProjectDir $ProjectDir
    $codex = Get-SgsdCodexStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
    $events = Get-SgsdCodexEvents -PlanningDir $PlanningDir -PhaseNum $phaseNum -MaxEvents 8
    $rows = Get-SgsdCodexLogRows -PlanningDir $PlanningDir -MaxRows 6

    Write-Host "SUPER GSD" -NoNewline -ForegroundColor Magenta
    Write-Host " ! " -NoNewline -ForegroundColor Cyan
    Write-Host "Codex Monitor" -NoNewline -ForegroundColor White
    Write-Host "  $ts" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    $substrateLine = Format-SubstrateStatusLine -Status $substrate
    Write-Host "DLB-04 " -NoNewline -ForegroundColor Magenta
    Write-Host $substrateLine -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    Write-Host "LANE " -NoNewline -ForegroundColor White
    Write-Host $codex.state.ToUpper() -NoNewline -ForegroundColor $codex.stateColor
    Write-Host " / cfg " -NoNewline -ForegroundColor DarkGray
    if ($codex.enabled) { Write-Host "enabled" -NoNewline -ForegroundColor Green }
    else { Write-Host "dark-launch" -NoNewline -ForegroundColor Yellow }
    if ($codex.updatedAgeSec -ne $null) {
        Write-Host " / updated " -NoNewline -ForegroundColor DarkGray
        Write-Host (Format-Age $codex.updatedAgeSec) -NoNewline -ForegroundColor Cyan
        Write-Host " ago" -NoNewline -ForegroundColor DarkGray
    }
    Write-Host $CLEAR_LINE

    Write-Host "ROUTING" -NoNewline -ForegroundColor White
    Write-Host ": 6.5=" -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($codex.phaseAtcProvider) { $codex.phaseAtcProvider } else { "--" })) -NoNewline -ForegroundColor Gray
    Write-Host "  9.5=" -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($codex.perDispatchProvider) { $codex.perDispatchProvider } else { "--" })) -NoNewline -ForegroundColor Gray
    Write-Host "  fb=" -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($codex.fallbackOnError) { "on" } else { "off" })) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE

    $scopeParts = @($codex.phase, $codex.plan, $codex.step) | Where-Object { $_ -and "$_".Trim() -ne "" }
    Write-Host "SCOPE" -NoNewline -ForegroundColor White
    Write-Host ": " -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($scopeParts.Count -gt 0) { Trunc ($scopeParts -join " / ") ($pw - 8) } else { "--" })) -NoNewline -ForegroundColor Cyan
    Write-Host $CLEAR_LINE

    Write-Host "TOOLBOX" -NoNewline -ForegroundColor White
    Write-Host ": " -NoNewline -ForegroundColor DarkGray
    Write-Host $codex.toolbox -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE

    Write-Host "BASH" -NoNewline -ForegroundColor White
    Write-Host ": " -NoNewline -ForegroundColor DarkGray
    $cmdText = if ($codex.commandPreview) { $codex.commandPreview } else { "--" }
    Write-Host (Trunc $cmdText ($pw - 7)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE

    Write-Host "IO" -NoNewline -ForegroundColor White
    Write-Host ": in " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($codex.promptBytes)B" -NoNewline -ForegroundColor Cyan
    Write-Host "  out " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($codex.reportBytes)B" -NoNewline -ForegroundColor Cyan
    if ($codex.durationMs -gt 0) {
        Write-Host "  dur " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($codex.durationMs)ms" -NoNewline -ForegroundColor Cyan
    }
    if ($null -ne $codex.exit) {
        Write-Host "  exit " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($codex.exit)" -NoNewline -ForegroundColor $(if ($codex.exit -eq 0) { "Green" } else { "Red" })
    }
    Write-Host $CLEAR_LINE

    if ($codex.oneLiner) {
        Write-Host "VERDICT" -NoNewline -ForegroundColor White
        Write-Host ": " -NoNewline -ForegroundColor DarkGray
        Write-Host (Trunc $codex.oneLiner ($pw - 10)) -NoNewline -ForegroundColor Yellow
        Write-Host $CLEAR_LINE
    } elseif ($codex.stderrPreview) {
        Write-Host "STDERR" -NoNewline -ForegroundColor White
        Write-Host ": " -NoNewline -ForegroundColor DarkGray
        Write-Host (Trunc $codex.stderrPreview ($pw - 9)) -NoNewline -ForegroundColor Red
        Write-Host $CLEAR_LINE
    }

    Write-Host $CLEAR_LINE
    Write-Host "RECENT CODEX EVENTS" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    if ($events.Count -eq 0) {
        Write-Host "  no codex activity in activity-log yet" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    } else {
        foreach ($ev in $events) {
            Write-Host "  $($ev.ts.ToString('HH:mm:ss')) " -NoNewline -ForegroundColor DarkGray
            Write-Host $ev.label.PadRight(14) -NoNewline -ForegroundColor Cyan
            Write-Host (Trunc $ev.detail ($pw - 28)) -NoNewline -ForegroundColor Gray
            Write-Host $CLEAR_LINE
        }
    }

    Write-Host $CLEAR_LINE
    Write-Host "RUN HISTORY" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    if ($rows.Count -eq 0) {
        Write-Host "  no codex-log rows yet" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    } else {
        foreach ($row in $rows) {
            $state = if ($row.exit -eq 0) { "OK" } elseif ($row.exit -eq 5) { "TIMEOUT" } else { "ERR" }
            $color = if ($row.exit -eq 0) { "Green" } elseif ($row.exit -eq 5) { "Yellow" } else { "Red" }
            $scope = @("$($row.phase)", "$($row.plan)", "$($row.step)") | Where-Object { $_ -and "$_".Trim() -ne "" }
            Write-Host "  " -NoNewline
            Write-Host $state.PadRight(7) -NoNewline -ForegroundColor $color
            Write-Host " " -NoNewline
            Write-Host (Trunc (($scope -join " / ")) 24) -NoNewline -ForegroundColor Cyan
            Write-Host " " -NoNewline
            Write-Host ("{0}ms {1}B->{2}B" -f $row.duration_ms, $row.prompt_bytes, $row.report_bytes) -NoNewline -ForegroundColor Gray
            Write-Host $CLEAR_LINE
        }
    }

    Write-Host $CLEAR_BELOW -NoNewline
}

Write-Host "$ALT_ENTER$ESC[2J$ESC[H$HIDE_CURSOR" -NoNewline

$global:needsRedraw = $true
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $PlanningDir
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$null = Register-ObjectEvent -InputObject $watcher -EventName Changed -Action { $global:needsRedraw = $true }
$null = Register-ObjectEvent -InputObject $watcher -EventName Created -Action { $global:needsRedraw = $true }
$null = Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action { $global:needsRedraw = $true }

$lastHeartbeat = [DateTime]::MinValue
try {
    while ($true) {
        if ($global:needsRedraw -or (((Get-Date) - $lastHeartbeat).TotalSeconds -ge $Heartbeat)) {
            $global:needsRedraw = $false
            $lastHeartbeat = Get-Date
            Render
        }
        Start-Sleep -Milliseconds 2000
    }
} finally {
    Write-Host "$SHOW_CURSOR$ALT_EXIT" -NoNewline
}
