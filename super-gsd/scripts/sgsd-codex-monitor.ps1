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

function Get-PaneHeight {
    try { return [Console]::WindowHeight } catch { return 30 }
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

function Format-Duration($ms) {
    if ($null -eq $ms) { return "--" }
    $ms = [int]$ms
    if ($ms -le 0) { return "--" }
    if ($ms -lt 1000) { return "${ms}ms" }
    if ($ms -lt 60000) { return ("{0:n1}s" -f ($ms / 1000)) }
    $totalSec = [math]::Floor($ms / 1000)
    return ("{0}m{1:00}s" -f [math]::Floor($totalSec / 60), ($totalSec % 60))
}

function Format-Bytes($bytes) {
    if ($null -eq $bytes) { return "--" }
    $bytes = [double]$bytes
    if ($bytes -le 0) { return "0B" }
    if ($bytes -lt 1024) { return ("{0}B" -f [int]$bytes) }
    if ($bytes -lt 1048576) { return ("{0:n1}KB" -f ($bytes / 1024)) }
    return ("{0:n1}MB" -f ($bytes / 1048576))
}

function Format-Flag($value) {
    if ($value -eq $true) { return "yes" }
    if ($value -eq $false) { return "no" }
    return "--"
}

function Get-CurrentScope {
    $stateFile = Join-Path $PlanningDir "STATE.md"
    $out = [ordered]@{ milestone = ""; phase = ""; status = "" }
    if (-not (Test-Path $stateFile)) { return [pscustomobject]$out }
    foreach ($line in (Get-Content $stateFile -TotalCount 30 -ErrorAction SilentlyContinue)) {
        if (-not $out.milestone -and $line -match '^milestone:\s*(.+)$') { $out.milestone = $matches[1].Trim().Trim('"', "'") }
        if (-not $out.phase -and $line -match '^(?:current_phase|phase):\s*"?([0-9]+)"?') { $out.phase = $matches[1] }
        if (-not $out.status -and $line -match '^status:\s*(.+)$') { $out.status = $matches[1].Trim().Trim('"', "'") }
        if (-not $out.phase -and $line -match '^status:\s*.*\bPhase\s+([0-9]+)\b') { $out.phase = $matches[1] }
    }
    return [pscustomobject]$out
}

function Get-CurrentPhaseNum {
    $scope = Get-CurrentScope
    return $scope.phase
}

function Get-CodexStatusSummary($codex) {
    if (-not $codex.scopeCurrent -and $codex.currentPhase) {
        $old = if ($codex.staleScope) { $codex.staleScope } else { "--" }
        return "No current Codex run is recorded for P$($codex.currentPhase); last live marker is old: $old."
    }
    $scopeParts = @($codex.phase, $codex.plan, $codex.step) | Where-Object { $_ -and "$_".Trim() -ne "" }
    $scopeText = if ($scopeParts.Count -gt 0) { $scopeParts -join " / " } else { "the current review scope" }
    switch ("$($codex.state)".ToLower()) {
        "running" { return "Codex is actively reviewing $scopeText." }
        "ok" { return "Codex completed the latest review successfully for $scopeText." }
        "timeout" { return "The latest Codex review timed out on $scopeText and may need fallback or retry." }
        "error" { return "The latest Codex review failed on $scopeText." }
        "auth-denied" { return "Codex is enabled but auth failed on the latest review attempt." }
        default {
            if ($codex.enabled) { return "Codex routing is enabled, but there is no current review summary yet." }
            return "Codex routing is configured but still dark-launched."
        }
    }
}

function Get-VerdictLabel($vr) {
    if ([int]$vr.critical -gt 0) { return "Critical" }
    if ([int]$vr.warning -gt 0) { return "Warnings" }
    return "Clean"
}

function Clean-MarkdownInline($text) {
    if ($null -eq $text) { return "" }
    $s = "$text"
    $s = $s -replace '\*\*', ''
    $s = $s -replace '`', ''
    $s = $s -replace '\s+', ' '
    return $s.Trim()
}

function Get-MarkdownSectionItems {
    param(
        [string[]]$Lines,
        [string]$HeadingPattern,
        [int]$MaxItems = 4
    )
    $items = @()
    $inSection = $false
    foreach ($line in $Lines) {
        if ($line -match '^##\s+') {
            if ($inSection) { break }
            if ($line -match $HeadingPattern) { $inSection = $true }
            continue
        }
        if (-not $inSection) { continue }
        if ($line -match '^\s*(?:\d+\.\s+|-\s+)(.+)$') {
            $item = Clean-MarkdownInline $matches[1]
            if ($item) { $items += $item }
            if ($items.Count -ge $MaxItems) { break }
        }
    }
    return @($items)
}

function Get-CodexReportFields {
    param($codex)
    $path = if ($codex.reportOutResolved) { $codex.reportOutResolved } else { Resolve-SgsdRuntimePath "$($codex.reportOut)" }
    $out = [ordered]@{
        exists = $false
        path = $path
        findings = ""
        critical = ""
        warnings = ""
        passRate = ""
        oneLiner = ""
    }
    if (-not $path -or -not (Test-Path $path)) { return [pscustomobject]$out }
    $out.exists = $true
    try {
        foreach ($line in (Get-Content $path -TotalCount 120 -ErrorAction SilentlyContinue)) {
            if ($line -match '^FINDINGS:\s*(.+)$') { $out.findings = $matches[1].Trim(); continue }
            if ($line -match '^CRITICAL:\s*(.+)$') { $out.critical = $matches[1].Trim(); continue }
            if ($line -match '^WARNINGS:\s*(.+)$') { $out.warnings = $matches[1].Trim(); continue }
            if ($line -match '^PASS_RATE:\s*(.+)$') { $out.passRate = $matches[1].Trim(); continue }
            if ($line -match '^ONE_LINER:\s*(.+)$') { $out.oneLiner = $matches[1].Trim(); continue }
        }
    } catch {}
    return [pscustomobject]$out
}

function Get-CodexPromptBrief {
    param($codex)
    $path = if ($codex.promptFileResolved) { $codex.promptFileResolved } else { Resolve-SgsdRuntimePath "$($codex.promptFile)" }
    $out = [ordered]@{
        exists = $false
        path = $path
        title = ""
        checks = @()
    }
    if (-not $path -or -not (Test-Path $path)) { return [pscustomobject]$out }
    $out.exists = $true
    try {
        $lines = @(Get-Content $path -TotalCount 220 -ErrorAction SilentlyContinue)
        foreach ($line in $lines) {
            if ($line -match '^#\s+(.+)$') {
                $out.title = Clean-MarkdownInline $matches[1]
                break
            }
        }
        $checks = @(Get-MarkdownSectionItems -Lines $lines -HeadingPattern '^##\s+Review dimensions' -MaxItems 4)
        if ($checks.Count -eq 0) {
            $checks = @(Get-MarkdownSectionItems -Lines $lines -HeadingPattern '^##\s+Design invariants' -MaxItems 4)
        }
        if ($checks.Count -eq 0) {
            $checks = @(Get-MarkdownSectionItems -Lines $lines -HeadingPattern '^##\s+Plans shipped' -MaxItems 3)
        }
        $out.checks = $checks
    } catch {}
    return [pscustomobject]$out
}

function Get-CodexOperatorBrief {
    param($codex, $verdicts)
    if (-not $codex.scopeCurrent -and $codex.currentPhase) {
        return [pscustomobject]@{
            title = "current phase P$($codex.currentPhase)"
            scope = "current P$($codex.currentPhase); old live marker $($codex.staleScope)"
            checks = @()
            conclusion = ""
            report = [pscustomobject]@{ exists = $false }
            attention = @("Codex live marker is stale/out-of-scope; wait for the P$($codex.currentPhase) review or rerun it.")
        }
    }
    $prompt = Get-CodexPromptBrief $codex
    $report = Get-CodexReportFields $codex
    $latestVerdict = if ($verdicts.Count -gt 0) { $verdicts[0] } else { $null }
    $scope = @($codex.phase, $codex.plan, $codex.step) | Where-Object { $_ -and "$_".Trim() -ne "" }
    $scopeText = if ($scope.Count -gt 0) { $scope -join " / " } else { "current review scope" }

    $conclusion = ""
    if ($report.exists -and $report.oneLiner) {
        $conclusion = $report.oneLiner
    } elseif ($latestVerdict) {
        $conclusion = "$($latestVerdict.plan): $($latestVerdict.one_liner)"
    } elseif ($codex.oneLiner) {
        $conclusion = "$($codex.oneLiner)"
    }

    $attention = @()
    if ("$($codex.state)" -eq "timeout") {
        $attention += ("Timed out after {0}; no complete report for this run." -f (Format-Duration $codex.durationMs))
    } elseif ("$($codex.state)" -eq "running") {
        $attention += "Review currently running; waiting for report contract."
    } elseif ("$($codex.state)" -match 'error|auth-denied|contract') {
        $attention += "Review mechanism failed; fallback or retry is needed."
    }
    if ($latestVerdict -and ([int]$latestVerdict.critical -gt 0)) {
        $attention += ("Latest stored verdict has {0} critical issue(s)." -f [int]$latestVerdict.critical)
    } elseif ($latestVerdict -and ([int]$latestVerdict.warning -gt 0)) {
        $attention += ("Latest stored verdict has {0} warning(s)." -f [int]$latestVerdict.warning)
    }
    if ($attention.Count -eq 0 -and $report.exists) {
        $attention += "Report contract written; use findings above for action."
    }

    return [pscustomobject]@{
        title = if ($prompt.title) { $prompt.title } else { $scopeText }
        scope = $scopeText
        checks = @($prompt.checks)
        conclusion = $conclusion
        report = $report
        attention = @($attention)
    }
}

function Render {
    if (-not (Test-RenderDue -MinIntervalMs 2000)) { return }

    Write-Host $HOME_POS -NoNewline
    $pw = Get-PaneWidth
    $ph = Get-PaneHeight
    $expanded = ($pw -ge 96 -and $ph -ge 42)
    $deep = ($pw -ge 120 -and $ph -ge 50)
    $rowLimit = if ($deep) { 5 } elseif ($expanded) { 4 } else { 3 }
    $verdictLimit = if ($deep) { 4 } elseif ($expanded) { 3 } else { 2 }
    $ts = Get-Date -Format 'HH:mm:ss'
    $scope = Get-CurrentScope
    $phaseNum = $scope.phase
    $substrate = Get-SubstrateStatus -ProjectDir $ProjectDir
    $codex = Get-SgsdCodexStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
    $vtp = Get-SgsdVtpMcpStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
    $rows = Get-SgsdCodexLogRows -PlanningDir $PlanningDir -MaxRows $rowLimit -PhaseFilter $phaseNum
    $verdicts = Get-SgsdCodexVerdicts -PlanningDir $PlanningDir -MaxRows $verdictLimit -MilestoneFilter $scope.milestone -PhaseFilter $phaseNum
    $brief = Get-CodexOperatorBrief -codex $codex -verdicts $verdicts

    Write-Host "SUPER GSD" -NoNewline -ForegroundColor Magenta
    Write-Host " ! " -NoNewline -ForegroundColor Cyan
    Write-Host "Codex Monitor" -NoNewline -ForegroundColor White
    if ($scope.milestone -or $phaseNum) {
        Write-Host "  " -NoNewline
        Write-Host ("{0}/P{1}" -f $(if ($scope.milestone) { $scope.milestone } else { "?" }), $(if ($phaseNum) { $phaseNum } else { "?" })) -NoNewline -ForegroundColor Yellow
    }
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

    Write-Host "CODEX" -NoNewline -ForegroundColor White
    Write-Host ": model=" -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($codex.model) { $codex.model } else { "--" })) -NoNewline -ForegroundColor Gray
    Write-Host " effort=" -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($codex.reasoningEffort) { $codex.reasoningEffort } else { "--" })) -NoNewline -ForegroundColor Gray
    Write-Host " runs=" -NoNewline -ForegroundColor DarkGray
    Write-Host ("{0}/{1}" -f [int]$codex.okRuns, [int]$codex.totalRuns) -NoNewline -ForegroundColor Cyan
    Write-Host " fallback=" -NoNewline -ForegroundColor DarkGray
    Write-Host ([int]$codex.fallbackCount) -NoNewline -ForegroundColor Gray
    Write-Host " saved~" -NoNewline -ForegroundColor DarkGray
    Write-Host ([int]$codex.claudeTokensSaved) -NoNewline -ForegroundColor Gray
    Write-Host "tok" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    $scopeParts = @($codex.phase, $codex.plan, $codex.step) | Where-Object { $_ -and "$_".Trim() -ne "" }
    Write-Host "SCOPE" -NoNewline -ForegroundColor White
    Write-Host ": " -NoNewline -ForegroundColor DarkGray
    $scopeLine = "current {0} / P{1}" -f $(if ($scope.milestone) { $scope.milestone } else { "?" }), $(if ($phaseNum) { $phaseNum } else { "?" })
    if (-not $codex.scopeCurrent -and $codex.staleScope) { $scopeLine += "  old live: $($codex.staleScope)" }
    elseif ($scopeParts.Count -gt 0) { $scopeLine += "  live: " + ($scopeParts -join " / ") }
    Write-Host (Trunc $scopeLine ($pw - 8)) -NoNewline -ForegroundColor Cyan
    Write-Host $CLEAR_LINE

    Write-Host $CLEAR_LINE
    Write-Host "CURRENT STATUS" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    Write-Host "| " -NoNewline -ForegroundColor Yellow
    Write-Host (Trunc (Get-CodexStatusSummary $codex) ($pw - 3)) -NoNewline -ForegroundColor Yellow
    Write-Host $CLEAR_LINE
    if ($verdicts.Count -gt 0) {
        $latest = $verdicts[0]
        Write-Host "> " -NoNewline -ForegroundColor Magenta
        Write-Host ("Latest result: {0} on {1}" -f (Get-VerdictLabel $latest), "$($latest.plan)") -NoNewline -ForegroundColor White
        Write-Host $CLEAR_LINE
        Write-Host "  " -NoNewline
        Write-Host ("Critical: {0}  Warnings: {1}" -f [int]$latest.critical, [int]$latest.warning) -NoNewline -ForegroundColor Cyan
        Write-Host $CLEAR_LINE
        Write-Host "  " -NoNewline
        Write-Host (Trunc "$($latest.one_liner)" ($pw - 3)) -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
    }

    if ($expanded) {
        Write-Host $CLEAR_LINE
        Write-Host "ACTIVE CODEX DETAIL" -NoNewline -ForegroundColor White
        Write-Host $CLEAR_LINE
        Write-Host "  model " -NoNewline -ForegroundColor DarkGray
        Write-Host ($(if ($codex.model) { $codex.model } else { "--" })) -NoNewline -ForegroundColor Cyan
        Write-Host " / effort " -NoNewline -ForegroundColor DarkGray
        Write-Host ($(if ($codex.reasoningEffort) { $codex.reasoningEffort } else { "--" })) -NoNewline -ForegroundColor Cyan
        Write-Host " / timeout " -NoNewline -ForegroundColor DarkGray
        Write-Host ($(if ([int]$codex.timeoutSeconds -gt 0) { "$($codex.timeoutSeconds)s" } else { "--" })) -NoNewline -ForegroundColor Gray
        Write-Host " / duration " -NoNewline -ForegroundColor DarkGray
        Write-Host (Format-Duration $codex.durationMs) -NoNewline -ForegroundColor Gray
        Write-Host " / exit " -NoNewline -ForegroundColor DarkGray
        Write-Host ($(if ($null -ne $codex.exit) { "$($codex.exit)" } else { "--" })) -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
        Write-Host "  prompt " -NoNewline -ForegroundColor DarkGray
        Write-Host (Format-Bytes $codex.promptBytes) -NoNewline -ForegroundColor Gray
        Write-Host " / report " -NoNewline -ForegroundColor DarkGray
        Write-Host (Format-Bytes $codex.reportBytes) -NoNewline -ForegroundColor Gray
        Write-Host " / fallback " -NoNewline -ForegroundColor DarkGray
        Write-Host (Format-Flag $codex.fallbackTriggered) -NoNewline -ForegroundColor Gray
        if ($codex.reportOut) {
            Write-Host " / out " -NoNewline -ForegroundColor DarkGray
            Write-Host (Trunc "$($codex.reportOut)" ([Math]::Max(12, $pw - 45))) -NoNewline -ForegroundColor DarkGray
        }
        Write-Host $CLEAR_LINE
        if ($deep -and $codex.commandPreview) {
            Write-Host "  cmd " -NoNewline -ForegroundColor DarkGray
            Write-Host (Trunc "$($codex.commandPreview)" ($pw - 7)) -NoNewline -ForegroundColor DarkGray
            Write-Host $CLEAR_LINE
        }
    }

    Write-Host $CLEAR_LINE
    Write-Host "RECENT FINDINGS" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    if ($verdicts.Count -eq 0) {
        Write-Host "  no Codex findings for current phase yet" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    } else {
        foreach ($vr in $verdicts) {
            $label = Get-VerdictLabel $vr
            $labelColor = if ($label -eq "Critical") { "Red" } elseif ($label -eq "Warnings") { "Yellow" } else { "Green" }
            Write-Host "  $($vr.plan) " -NoNewline -ForegroundColor Cyan
            Write-Host $label -NoNewline -ForegroundColor $labelColor
            Write-Host $CLEAR_LINE
            Write-Host "    " -NoNewline
            Write-Host ("Critical: {0}  Warnings: {1}" -f [int]$vr.critical, [int]$vr.warning) -NoNewline -ForegroundColor Gray
            Write-Host $CLEAR_LINE
            Write-Host "    " -NoNewline
            Write-Host (Trunc "$($vr.one_liner)" ($pw - 5)) -NoNewline -ForegroundColor Gray
            Write-Host $CLEAR_LINE
            if ($vr.note) {
                Write-Host "    " -NoNewline
                Write-Host (Trunc "Context: $($vr.note)" ($pw - 5)) -NoNewline -ForegroundColor DarkGray
                Write-Host $CLEAR_LINE
            }
            Write-Host $CLEAR_LINE
        }
    }

    Write-Host "RECENT CODEX PROGRESS" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    if ($rows.Count -eq 0) {
        Write-Host "  no Codex run history for current phase yet" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    } else {
        foreach ($row in $rows) {
            $state = if ($row.exit -eq 0) { "Completed" } elseif ($row.exit -eq 5) { "Timed out" } else { "Failed" }
            $color = if ($row.exit -eq 0) { "Green" } elseif ($row.exit -eq 5) { "Yellow" } else { "Red" }
            $scope = @("$($row.phase)", "$($row.plan)", "$($row.step)") | Where-Object { $_ -and "$_".Trim() -ne "" }
            $model = if ($row.model) { "$($row.model)" } else { "$($codex.model)" }
            $effort = if ($row.reasoning_effort) { "$($row.reasoning_effort)" } else { "$($codex.reasoningEffort)" }
            $metaParts = @()
            if ($model -or $effort) { $metaParts += ("{0}/{1}" -f $(if ($model) { $model } else { "--" }), $(if ($effort) { $effort } else { "--" })) }
            if ($row.duration_ms) { $metaParts += (Format-Duration $row.duration_ms) }
            if ($row.prompt_bytes) { $metaParts += ("in {0}" -f (Format-Bytes $row.prompt_bytes)) }
            if ($row.report_bytes -ne $null) { $metaParts += ("out {0}" -f (Format-Bytes $row.report_bytes)) }
            Write-Host "  " -NoNewline
            Write-Host $state -NoNewline -ForegroundColor $color
            Write-Host "  " -NoNewline
            $progressLine = ($scope -join " / ")
            if ($expanded -and $metaParts.Count -gt 0) { $progressLine = "$progressLine  [$($metaParts -join ', ')]" }
            Write-Host (Trunc $progressLine ($pw - 14)) -NoNewline -ForegroundColor Cyan
            Write-Host $CLEAR_LINE
            if ($deep) {
                $flags = @()
                if ($null -ne $row.timeout_hit) { $flags += ("timeout={0}" -f (Format-Flag $row.timeout_hit)) }
                if ($null -ne $row.fallback_triggered) { $flags += ("fallback={0}" -f (Format-Flag $row.fallback_triggered)) }
                if ($row.stderr_preview) { $flags += ("stderr={0}" -f (("$($row.stderr_preview)" -split "`n")[0])) }
                if ($flags.Count -gt 0) {
                    Write-Host "    " -NoNewline
                    Write-Host (Trunc ($flags -join "  ") ($pw - 5)) -NoNewline -ForegroundColor DarkGray
                    Write-Host $CLEAR_LINE
                }
            }
        }
    }

    if ($expanded) {
        Write-Host $CLEAR_LINE
        Write-Host "VTP / MCP" -NoNewline -ForegroundColor White
        Write-Host $CLEAR_LINE
        $vtpCfgColor = if ($vtp.enabled) { "Green" } else { "Yellow" }
        Write-Host "  config " -NoNewline -ForegroundColor DarkGray
        Write-Host $vtp.configState -NoNewline -ForegroundColor $vtpCfgColor
        Write-Host " / health " -NoNewline -ForegroundColor DarkGray
        $healthColor = if ($vtp.healthState -match 'healthy|ok') { "Green" } elseif ($vtp.healthState -match 'degraded|error|fail|unavailable') { "Red" } else { "DarkGray" }
        Write-Host $vtp.healthState -NoNewline -ForegroundColor $healthColor
        if ($vtp.healthAgeSec -ne $null) {
            Write-Host " " -NoNewline
            Write-Host (Format-Age $vtp.healthAgeSec) -NoNewline -ForegroundColor Cyan
            Write-Host " ago" -NoNewline -ForegroundColor DarkGray
        }
        Write-Host " / last route " -NoNewline -ForegroundColor DarkGray
        $routeColor = if ($vtp.routingStatus -match 'success|zero_hits') { "Green" } elseif ($vtp.routingStatus -match 'error|timeout|unavailable|failure') { "Red" } else { "DarkGray" }
        Write-Host $vtp.routingStatus -NoNewline -ForegroundColor $routeColor
        if ($vtp.routingAgeSec -ne $null) {
            Write-Host " " -NoNewline
            Write-Host (Format-Age $vtp.routingAgeSec) -NoNewline -ForegroundColor Cyan
            Write-Host " ago" -NoNewline -ForegroundColor DarkGray
        }
        Write-Host $CLEAR_LINE

        Write-Host "  mcp " -NoNewline -ForegroundColor DarkGray
        $mcpBits = @()
        if ($vtp.mcpServers) { $mcpBits += ("servers={0}" -f $vtp.mcpServers) }
        if ($vtp.mcpVtpBinding) { $mcpBits += ("vtp-kb={0}" -f $vtp.mcpVtpBinding) }
        if ($vtp.mcpVtpTargetExists -ne $null) { $mcpBits += ("target_exists={0}" -f (Format-Flag $vtp.mcpVtpTargetExists)) }
        if ($vtp.mcpVtpTarget) { $mcpBits += ("target={0}" -f $vtp.mcpVtpTarget) }
        if ($mcpBits.Count -eq 0) { $mcpBits += "no .mcp.json data" }
        Write-Host (Trunc ($mcpBits -join "  ") ($pw - 7)) -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE

        Write-Host "  route " -NoNewline -ForegroundColor DarkGray
        $routeBits = @()
        if ($vtp.routingAgent) { $routeBits += ("agent={0}" -f $vtp.routingAgent) }
        if ($vtp.routingTier) { $routeBits += ("tier={0}" -f $vtp.routingTier) }
        if ($vtp.routingHits -ne $null) { $routeBits += ("hits={0}" -f $vtp.routingHits) }
        if ($vtp.routingElapsedMs -ne $null) { $routeBits += ("elapsed={0}" -f (Format-Duration $vtp.routingElapsedMs)) }
        if ($vtp.routingDoc) { $routeBits += ("doc={0}" -f $vtp.routingDoc) }
        if ($vtp.routingFailure) { $routeBits += ("fail={0}" -f $vtp.routingFailure) }
        if ($routeBits.Count -eq 0) { $routeBits += "no routing log yet" }
        Write-Host (Trunc ($routeBits -join "  ") ($pw - 9)) -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE

        Write-Host "  artifact " -NoNewline -ForegroundColor DarkGray
        $artifactColor = if ($vtp.artifactStatus -eq "success") { "Green" } elseif ($vtp.artifactStatus -eq "empty_hit") { "Yellow" } elseif ($vtp.artifactStatus -eq "api_error") { "Red" } else { "DarkGray" }
        Write-Host $vtp.artifactStatus -NoNewline -ForegroundColor $artifactColor
        $artifactBits = @()
        if ($vtp.artifactPhase) { $artifactBits += ("phase={0}" -f $vtp.artifactPhase) }
        if ($vtp.artifactHits -ne $null) { $artifactBits += ("hits={0}" -f $vtp.artifactHits) }
        if ($vtp.artifactQueryCount -ne $null) { $artifactBits += ("queries={0}" -f $vtp.artifactQueryCount) }
        if ($vtp.artifactDurationMs -ne $null) { $artifactBits += ("duration={0}" -f (Format-Duration $vtp.artifactDurationMs)) }
        if ($vtp.artifactAgeSec -ne $null) { $artifactBits += ("age={0}" -f (Format-Age $vtp.artifactAgeSec)) }
        if ($vtp.artifactPath) { $artifactBits += ("path={0}" -f $vtp.artifactPath) }
        if ($artifactBits.Count -gt 0) {
            Write-Host "  " -NoNewline
            Write-Host (Trunc ($artifactBits -join "  ") ($pw - 13)) -NoNewline -ForegroundColor Gray
        }
        Write-Host $CLEAR_LINE
    }

    Write-Host $CLEAR_LINE
    Write-Host "CODEX REVIEW BRIEF" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    Write-Host "  reviewing " -NoNewline -ForegroundColor DarkGray
    Write-Host (Trunc "$($brief.title)" ($pw - 13)) -NoNewline -ForegroundColor Yellow
    Write-Host $CLEAR_LINE
    Write-Host "  scope " -NoNewline -ForegroundColor DarkGray
    Write-Host (Trunc "$($brief.scope)" ($pw - 8)) -NoNewline -ForegroundColor Cyan
    Write-Host $CLEAR_LINE
    if ($brief.conclusion) {
        Write-Host "  last conclusion " -NoNewline -ForegroundColor DarkGray
        Write-Host (Trunc "$($brief.conclusion)" ($pw - 19)) -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
    }
    if ($brief.report.exists) {
        $reportBits = @()
        if ($brief.report.findings) { $reportBits += ("findings={0}" -f $brief.report.findings) }
        if ($brief.report.critical) { $reportBits += ("crit={0}" -f $brief.report.critical) }
        if ($brief.report.warnings) { $reportBits += ("warn={0}" -f $brief.report.warnings) }
        if ($brief.report.passRate) { $reportBits += ("pass={0}" -f $brief.report.passRate) }
        Write-Host "  report " -NoNewline -ForegroundColor DarkGray
        Write-Host (Trunc ($reportBits -join "  ") ($pw - 9)) -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
    }
    if ($brief.checks.Count -gt 0) {
        Write-Host "  checking" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
        $maxChecks = if ($deep) { 4 } else { 3 }
        foreach ($check in @($brief.checks | Select-Object -First $maxChecks)) {
            Write-Host "    - " -NoNewline -ForegroundColor DarkGray
            Write-Host (Trunc "$check" ($pw - 7)) -NoNewline -ForegroundColor Gray
            Write-Host $CLEAR_LINE
        }
    }
    if ($brief.attention.Count -gt 0) {
        Write-Host "  attention" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
        foreach ($item in @($brief.attention | Select-Object -First 3)) {
            $color = if ($item -match 'critical|failed|retry|Timed out|timeout') { "Yellow" } else { "Gray" }
            Write-Host "    > " -NoNewline -ForegroundColor Magenta
            Write-Host (Trunc "$item" ($pw - 7)) -NoNewline -ForegroundColor $color
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
