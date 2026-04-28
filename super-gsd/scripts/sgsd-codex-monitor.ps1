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

function Get-StateBodyValue {
    param([string]$Text, [string]$Key)
    if (-not $Text -or -not $Key) { return "" }
    $m = [regex]::Match($Text, "(?m)^\s*$([regex]::Escape($Key)):\s*`"?([^`"\r\n]+)`"?\s*$")
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return ""
}

function Get-CurrentScope {
    $stateFile = Join-Path $PlanningDir "STATE.md"
    $out = [ordered]@{ milestone = ""; phase = ""; status = "" }
    if (-not (Test-Path $stateFile)) { return [pscustomobject]$out }
    $stateText = Get-Content $stateFile -Raw -ErrorAction SilentlyContinue
    $out.milestone = Get-StateBodyValue $stateText "current_milestone"
    $out.phase = Get-StateBodyValue $stateText "current_phase"
    $out.status = Get-StateBodyValue $stateText "status"
    foreach ($line in (Get-Content $stateFile -TotalCount 80 -ErrorAction SilentlyContinue)) {
        if (-not $out.milestone -and $line -match '^milestone:\s*(.+)$') { $out.milestone = $matches[1].Trim().Trim('"', "'") }
        if (-not $out.phase -and $line -match '^(?:current_phase|phase):\s*"?([0-9]+)"?') { $out.phase = $matches[1] }
        if (-not $out.status -and $line -match '^status:\s*(.+)$') { $out.status = $matches[1].Trim().Trim('"', "'") }
        if (-not $out.phase -and $line -match '^status:\s*.*\bNext:\s*Phase\s+([0-9]+)\b') { $out.phase = $matches[1] }
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
        return "No P$($codex.currentPhase) Codex review has run yet; last marker is old: $old."
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
            attention = @("No current-phase Codex evidence yet; normal before the review gate. Last marker was $($codex.staleScope).")
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

function Get-PhaseGoalBrief {
    param([string]$PhaseNum)
    if (-not $PhaseNum) { return "" }
    $path = Join-Path $PlanningDir "ROADMAP-AGENT.md"
    if (-not (Test-Path $path)) { return "" }
    try {
        $raw = Get-Content $path -Raw -ErrorAction SilentlyContinue
        $section = [regex]::Match($raw, "(?ms)^###\s*Phase\s+$([regex]::Escape($PhaseNum))\b.*?\r?\n(.*?)(?=^###\s*Phase\s+|\z)")
        if (-not $section.Success) { return "" }
        $goal = [regex]::Match($section.Groups[1].Value, '(?ims)^\s*(?:\*\*)?Goal(?:\*\*)?:\s*(.+?)(?=\r?\n\*\*|\r?\n\s*-\s|\r?\n###|\z)')
        if ($goal.Success) { return (($goal.Groups[1].Value -replace '\s+', ' ') -replace '\*\*', '').Trim() }
    } catch {}
    return ""
}

function Get-PhaseEvidenceSummary {
    param([string]$Milestone, [string]$PhaseNum)
    $dir = Resolve-PhaseDir -Milestone $Milestone -PhaseNum $PhaseNum
    $checks = @(
        @{ key="R"; pattern="$PhaseNum-RESEARCH.md" },
        @{ key="C"; pattern="$PhaseNum-CONTEXT.md" },
        @{ key="P"; pattern="*-PLAN.md" },
        @{ key="V"; pattern="$PhaseNum-VERIFICATION.md" },
        @{ key="A"; pattern="$PhaseNum-ATC-REVIEW.md" },
        @{ key="X"; pattern="commit-reviews.jsonl" }
    )
    $bits = @()
    $done = 0
    foreach ($c in $checks) {
        $hit = $false
        if ($dir) { $hit = @(Get-ChildItem -Path $dir.FullName -Filter $c.pattern -File -ErrorAction SilentlyContinue | Select-Object -First 1).Count -gt 0 }
        if ($hit) { $done++; $bits += "$($c.key)#" } else { $bits += "$($c.key)." }
    }
    return [pscustomobject]@{ bits=($bits -join " "); done=$done; total=$checks.Count }
}

function Resolve-PhaseDir {
    param([string]$Milestone, [string]$PhaseNum)
    if (-not $Milestone -or -not $PhaseNum) { return $null }
    $root = Join-Path $PlanningDir "milestones\$Milestone\phases"
    if (-not (Test-Path $root)) { return $null }
    return Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -eq "$PhaseNum" -or $_.Name.StartsWith("$PhaseNum-") } |
        Select-Object -First 1
}

function Get-MilestonePhaseDirs {
    param([string]$Milestone)
    if (-not $Milestone) { return @() }
    $root = Join-Path $PlanningDir "milestones\$Milestone\phases"
    if (-not (Test-Path $root)) { return @() }
    return @(Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^[0-9]+' } |
        Sort-Object Name)
}

function Get-PhaseNumFromDirName {
    param([string]$Name)
    if ("$Name" -match '^([0-9]+)') { return $Matches[1] }
    return ""
}

function Get-PhaseReviewFile {
    param([string]$Milestone, [string]$PhaseNum)
    $dir = Resolve-PhaseDir -Milestone $Milestone -PhaseNum $PhaseNum
    if (-not $dir) { return $null }

    $reviewDir = Join-Path $dir.FullName "reviews"
    $candidates = @()
    if (Test-Path $reviewDir) {
        $direct = Join-Path $reviewDir "$PhaseNum-REVIEW.md"
        if (Test-Path $direct) { $candidates += Get-Item $direct -ErrorAction SilentlyContinue }
        $candidates += Get-ChildItem -Path $reviewDir -Filter "*REVIEW*.md" -File -ErrorAction SilentlyContinue
    }
    $directAtc = Join-Path $dir.FullName "$PhaseNum-ATC-REVIEW.md"
    if (Test-Path $directAtc) { $candidates += Get-Item $directAtc -ErrorAction SilentlyContinue }
    $candidates += Get-ChildItem -Path $dir.FullName -Filter "*ATC-REVIEW*.md" -File -ErrorAction SilentlyContinue

    return @($candidates | Where-Object { $_ } | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
}

function Get-PhaseCommitReviewFile {
    param([string]$Milestone, [string]$PhaseNum)
    $dir = Resolve-PhaseDir -Milestone $Milestone -PhaseNum $PhaseNum
    if (-not $dir) { return $null }
    return Get-ChildItem -Path $dir.FullName -Filter "commit-reviews.jsonl" -File -Recurse -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
}

function Write-GateTrack {
    param([string]$Name, [object[]]$Cells)
    Write-Host $Name.PadRight(8) -NoNewline -ForegroundColor White
    foreach ($c in $Cells) {
        $color = switch ($c.state) {
            "done" { "Green" }
            "active" { "Yellow" }
            "warn" { "Yellow" }
            "fail" { "Red" }
            "skip" { "DarkGray" }
            default { "Red" }
        }
        $suffix = if ($c.state -eq "fail") { "X" } elseif ($c.state -eq "warn") { "!" } else { "" }
        Write-Host ("[{0}{1}]" -f $c.letter, $suffix) -NoNewline -ForegroundColor $color
        Write-Host " " -NoNewline
    }
    Write-Host $CLEAR_LINE
}

function Set-MudaCellFromClass {
    param([object[]]$Cells, [string]$WasteClass, [string]$Verdict)
    $idx = switch -Regex ("$WasteClass".ToLowerInvariant()) {
        '^transport$' { 0; break }
        '^inventory$' { 1; break }
        '^motion$' { 2; break }
        '^waiting$' { 3; break }
        '^overproduction$' { 4; break }
        '^extra-processing$|^overprocessing$' { 5; break }
        '^defects?$' { 6; break }
        default { -1 }
    }
    if ($idx -lt 0 -or $idx -ge $Cells.Count) { return }
    $state = switch -Regex ("$Verdict".ToUpperInvariant()) {
        '^PASS$' { "done"; break }
        '^WARN$' { "warn"; break }
        '^FAIL$' { "fail"; break }
        default { "done" }
    }
    $Cells[$idx].state = $state
}

function Add-MudaStatsFinding {
    param($Stats, [string]$WasteClass, [string]$Verdict)
    $verdictNorm = "$Verdict".ToUpperInvariant()
    if ($verdictNorm -ne "WARN" -and $verdictNorm -ne "FAIL") { return }
    $key = switch -Regex ("$WasteClass".ToLowerInvariant()) {
        '^transport$' { "T"; break }
        '^inventory$' { "I"; break }
        '^motion$' { "M"; break }
        '^waiting$' { "W"; break }
        '^overproduction$' { "OP"; break }
        '^extra-processing$|^overprocessing$' { "EP"; break }
        '^defects?$' { "D"; break }
        default { "" }
    }
    if (-not $key) { return }
    $Stats.totalCaught++
    if ($verdictNorm -eq "WARN") { $Stats.warn++ }
    if ($verdictNorm -eq "FAIL") { $Stats.fail++ }
    $Stats.byClass[$key] = [int]$Stats.byClass[$key] + 1
}

function Get-MudaStats {
    param([string]$Milestone)
    $stats = [pscustomobject]@{
        audits = 0
        phases = 0
        totalCaught = 0
        warn = 0
        fail = 0
        byClass = [ordered]@{ T=0; I=0; M=0; W=0; OP=0; EP=0; D=0 }
        source = "none"
    }
    $phaseDirs = @(Get-MilestonePhaseDirs -Milestone $Milestone)
    $stats.phases = $phaseDirs.Count
    $mudaLog = Join-Path $PlanningDir "metrics\muda-log.jsonl"
    $logByPhase = @{}
    if (Test-Path $mudaLog) {
        try {
            foreach ($line in (Get-Content $mudaLog -Tail 300 -ErrorAction SilentlyContinue)) {
                if (-not "$line".Trim()) { continue }
                try {
                    $row = $line | ConvertFrom-Json -ErrorAction Stop
                    $p = "$($row.phase)"
                    if ($p) { $logByPhase[$p] = $row }
                } catch {}
            }
        } catch {}
    }

    foreach ($dir in $phaseDirs) {
        $phaseNum = Get-PhaseNumFromDirName $dir.Name
        if (-not $phaseNum) { continue }
        $waste = Get-ChildItem -Path $dir.FullName -Filter "*WASTE*.md" -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($waste) {
            $stats.audits++
            $stats.source = "WASTE.md"
            try {
                $raw = Get-Content $waste.FullName -Raw -ErrorAction SilentlyContinue
                foreach ($m in [regex]::Matches($raw, '(?m)^\|\s*([^|]+?)\s*\|\s*(PASS|WARN|FAIL)\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|')) {
                    $probe = $m.Groups[1].Value.Trim()
                    if ($probe -match '^-+$|^Probe$') { continue }
                    Add-MudaStatsFinding -Stats $stats -WasteClass ($m.Groups[3].Value.Trim()) -Verdict ($m.Groups[2].Value.Trim())
                }
            } catch {}
        } elseif ($logByPhase.ContainsKey($phaseNum)) {
            $stats.audits++
            if ($stats.source -eq "none") { $stats.source = "muda-log.jsonl" }
            $row = $logByPhase[$phaseNum]
            if ($row.probes) {
                foreach ($p in $row.probes.PSObject.Properties) {
                    $probe = $p.Value
                    Add-MudaStatsFinding -Stats $stats -WasteClass "$($probe.waste_class)" -Verdict "$($probe.verdict)"
                }
            } elseif ($row.fail -ne $null -or $row.warn -ne $null) {
                if ([int]$row.fail -gt 0) {
                    $stats.totalCaught += [int]$row.fail
                    $stats.fail += [int]$row.fail
                    $stats.byClass.D = [int]$stats.byClass.D + [int]$row.fail
                }
                if ([int]$row.warn -gt 0) {
                    $stats.totalCaught += [int]$row.warn
                    $stats.warn += [int]$row.warn
                    $stats.byClass.D = [int]$stats.byClass.D + [int]$row.warn
                }
            }
        }
    }
    return $stats
}

function Format-MudaStatsLine {
    param($Stats)
    if (-not $Stats -or [int]$Stats.phases -eq 0) { return "stats: no milestone phases found" }
    return ("caught {0} | WARN{1} FAIL{2} | T{3} I{4} M{5} Wait{6} Oprod{7} Oproc{8} D{9} | audits {10}/{11}" -f `
        [int]$Stats.totalCaught, [int]$Stats.warn, [int]$Stats.fail, `
        [int]$Stats.byClass.T, [int]$Stats.byClass.I, [int]$Stats.byClass.M, [int]$Stats.byClass.W, `
        [int]$Stats.byClass.OP, [int]$Stats.byClass.EP, [int]$Stats.byClass.D, `
        [int]$Stats.audits, [int]$Stats.phases)
}

function Get-MudaLogRow {
    param([string]$PhaseNum)
    $log = Join-Path $PlanningDir "metrics\muda-log.jsonl"
    if (-not (Test-Path $log)) { return $null }
    try {
        $lines = @(Get-Content $log -Tail 120 -ErrorAction SilentlyContinue)
        [array]::Reverse($lines)
        foreach ($line in $lines) {
            if (-not "$line".Trim()) { continue }
            try {
                $row = $line | ConvertFrom-Json -ErrorAction Stop
                if ("$($row.phase)" -eq "$PhaseNum") { return $row }
            } catch {}
        }
    } catch {}
    return $null
}

function Get-MudaGateState {
    param([string]$Milestone, [string]$PhaseNum, $Codex)
    $letters = @("T","I","M","W","O","O","D")
    $cells = @($letters | ForEach-Object { [pscustomobject]@{ letter=$_; state="todo" } })
    $summary = "MUDA has not run for P$PhaseNum yet."
    $details = "Runs after ATC at phase close. T=transport has no SGSD probe yet."
    $phaseDir = Resolve-PhaseDir -Milestone $Milestone -PhaseNum $PhaseNum
    $waste = if ($phaseDir) { Get-ChildItem -Path $phaseDir.FullName -Filter "*WASTE*.md" -File -ErrorAction SilentlyContinue | Select-Object -First 1 } else { $null }
    if ($waste) {
        foreach ($c in $cells) { $c.state = "skip" }
        $cells[0].state = "skip"
        $warnCount = 0
        $failCount = 0
        try {
            $raw = Get-Content $waste.FullName -Raw -ErrorAction SilentlyContinue
            $wm = [regex]::Match($raw, '(?mi)^warn_count:\s*([0-9]+)')
            $fm = [regex]::Match($raw, '(?mi)^fail_count:\s*([0-9]+)')
            if ($wm.Success) { $warnCount = [int]$wm.Groups[1].Value }
            if ($fm.Success) { $failCount = [int]$fm.Groups[1].Value }
            foreach ($m in [regex]::Matches($raw, '(?m)^\|\s*([^|]+?)\s*\|\s*(PASS|WARN|FAIL)\s*\|[^|]*\|[^|]*\|\s*([^|]+?)\s*\|')) {
                $probe = $m.Groups[1].Value.Trim()
                if ($probe -match '^-+$|^Probe$') { continue }
                Set-MudaCellFromClass -Cells $cells -WasteClass ($m.Groups[3].Value.Trim()) -Verdict ($m.Groups[2].Value.Trim())
            }
            $cellWarnCount = @($cells | Where-Object { $_.state -eq "warn" }).Count
            $cellFailCount = @($cells | Where-Object { $_.state -eq "fail" }).Count
            if ($cellWarnCount -gt $warnCount) { $warnCount = $cellWarnCount }
            if ($cellFailCount -gt $failCount) { $failCount = $cellFailCount }
            if ($failCount -gt 0) {
                $summary = "MUDA FAIL: $failCount fail + $warnCount warn; see WASTE.md."
            } elseif ($warnCount -gt 0) {
                $summary = "MUDA WARN: $warnCount warning(s); see WASTE.md."
            } else {
                $summary = "MUDA PASS: no waste detected by active probes."
            }
            $details = "Source: WASTE.md; green=clean, yellow=warn, red=fail, gray=not probed."
        } catch {}
    } elseif ($Codex.step -match '(?i)muda|waste') {
        $cells[4].state = "active"
        $summary = "MUDA review is currently running."
        $details = "Codex qualitative waste check is active."
    } else {
        $row = Get-MudaLogRow -PhaseNum $PhaseNum
        if ($row) {
            foreach ($c in $cells) { $c.state = "skip" }
            $cells[0].state = "skip"
            if ($row.probes) {
                foreach ($p in $row.probes.PSObject.Properties) {
                    $probe = $p.Value
                    Set-MudaCellFromClass -Cells $cells -WasteClass "$($probe.waste_class)" -Verdict "$($probe.verdict)"
                }
            } elseif ($row.fail -ne $null -or $row.warn -ne $null) {
                foreach ($i in 1..6) { $cells[$i].state = "done" }
                if ([int]$row.fail -gt 0) { $cells[6].state = "fail" }
                elseif ([int]$row.warn -gt 0) { $cells[6].state = "warn" }
            }
            $fail = if ($row.fail -ne $null) { [int]$row.fail } else { 0 }
            $warn = if ($row.warn -ne $null) { [int]$row.warn } else { 0 }
            if ($fail -gt 0) { $summary = "MUDA log says FAIL: $fail fail + $warn warn." }
            elseif ($warn -gt 0) { $summary = "MUDA log says WARN: $warn warning(s)." }
            else { $summary = "MUDA log says PASS for P$PhaseNum." }
            $details = "Source: muda-log.jsonl; WASTE.md not found for this phase."
        }
    }
    return [pscustomobject]@{ cells=$cells; summary=$summary; details=$details }
}

function Add-AtcFindingCounts {
    param($Stats, [string]$Provider, [string]$Text)
    if (-not $Text) { return }
    $providerKey = if ("$Provider" -match '(?i)codex|openai') { "codex" } else { "claude" }
    foreach ($m in [regex]::Matches($Text, '(?i)\b([0-9]+)\s+(CRITICAL|CRIT|HIGH|MEDIUM|MED|LOW|WARNING|WARN|WARNINGS)\b')) {
        $n = [int]$m.Groups[1].Value
        $sev = switch -Regex ($m.Groups[2].Value.ToUpperInvariant()) {
            '^CRIT' { "crit"; break }
            '^HIGH' { "high"; break }
            '^MED' { "medium"; break }
            '^LOW' { "low"; break }
            '^WARN' { "warn"; break }
            default { "warn" }
        }
        $Stats.$providerKey[$sev] = [int]$Stats.$providerKey[$sev] + $n
        $Stats.totalCaught += $n
    }
}

function Get-AtcStats {
    param([string]$Milestone)
    $stats = [pscustomobject]@{
        phases = 0
        reviews = 0
        totalCaught = 0
        fixedPhases = 0
        codexTimeouts = 0
        claude = [ordered]@{ crit=0; high=0; medium=0; low=0; warn=0 }
        codex = [ordered]@{ crit=0; high=0; medium=0; low=0; warn=0 }
    }
    $phaseDirs = @(Get-MilestonePhaseDirs -Milestone $Milestone)
    $stats.phases = $phaseDirs.Count
    foreach ($dir in $phaseDirs) {
        $phaseNum = Get-PhaseNumFromDirName $dir.Name
        if (-not $phaseNum) { continue }
        $review = Get-PhaseReviewFile -Milestone $Milestone -PhaseNum $phaseNum
        if (-not $review) { continue }
        $stats.reviews++
        try {
            $raw = Get-Content $review.FullName -Raw -ErrorAction SilentlyContinue
            foreach ($line in [regex]::Matches($raw, '(?m)^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|')) {
                $provider = $line.Groups[1].Value.Trim()
                if ($provider -match '^-+$|^Provider$') { continue }
                $status = $line.Groups[2].Value.Trim()
                $findings = $line.Groups[4].Value.Trim()
                if ($provider -match '(?i)Claude|Codex|OpenAI') {
                    Add-AtcFindingCounts -Stats $stats -Provider $provider -Text $findings
                    if ($provider -match '(?i)Codex|OpenAI' -and "$status $findings" -match '(?i)provider_unavailable|tier cap|timeout|timed out|exit=5') {
                        $stats.codexTimeouts++
                    }
                }
            }
            if ($raw -match '(?i)post-fix|resolved|closed|addressed|fix(ed)?') { $stats.fixedPhases++ }
        } catch {}
    }
    return $stats
}

function Format-AtcStatsLine {
    param($Stats)
    if (-not $Stats -or [int]$Stats.phases -eq 0) { return "stats: no milestone phases found" }
    $c = $Stats.claude
    $o = $Stats.codex
    return ("caught {0} | Claude CR{1}/H{2}/M{3}/L{4}/W{5} | Codex CR{6}/H{7}/M{8}/L{9}/W{10} | fixed {11} timeout {12} | reviews {13}/{14}" -f `
        [int]$Stats.totalCaught, `
        [int]$c.crit, [int]$c.high, [int]$c.medium, [int]$c.low, [int]$c.warn, `
        [int]$o.crit, [int]$o.high, [int]$o.medium, [int]$o.low, [int]$o.warn, `
        [int]$Stats.fixedPhases, [int]$Stats.codexTimeouts, [int]$Stats.reviews, [int]$Stats.phases)
}

function Read-SgsdNumber {
    param($Obj, [string]$Path)
    if ($null -eq $Obj -or -not $Path) { return [int64]0 }
    $cur = $Obj
    foreach ($part in ($Path -split '\.')) {
        if ($null -eq $cur) { return [int64]0 }
        $prop = $cur.PSObject.Properties[$part]
        if ($null -eq $prop) { return [int64]0 }
        $cur = $prop.Value
    }
    try { return [int64][double]$cur } catch { return [int64]0 }
}

function Format-SgsdMetricNumber {
    param($Value)
    $n = [double](Read-SgsdNumber ([pscustomobject]@{ value = $Value }) "value")
    if ($n -ge 1000000) { return ("{0:n1}m" -f ($n / 1000000)) }
    if ($n -ge 1000) { return ("{0:n1}k" -f ($n / 1000)) }
    return ("{0:n0}" -f $n)
}

function Get-GateSavingsSnapshot {
    param([string]$Milestone, [string]$PhaseNum)

    $out = [ordered]@{
        exists = $false
        generatedAgeSec = $null
        phase = $null
        milestone = $null
        project = $null
    }
    $file = Join-Path $PlanningDir "metrics\gate-savings.json"
    if (-not (Test-Path $file)) { return [pscustomobject]$out }

    try {
        $json = Get-Content $file -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        $out.exists = $true
        if ($json.generated_at) {
            try {
                $generated = [DateTimeOffset]::Parse("$($json.generated_at)")
                $out.generatedAgeSec = [Math]::Max(0, [int64](([DateTimeOffset]::UtcNow - $generated).TotalSeconds))
            } catch {}
        }
        $phaseKey = "$Milestone::$PhaseNum"
        $phaseProp = if ($json.phases) { $json.phases.PSObject.Properties[$phaseKey] } else { $null }
        if ($phaseProp) { $out.phase = $phaseProp.Value }
        $msProp = if ($json.milestones -and $Milestone) { $json.milestones.PSObject.Properties[$Milestone] } else { $null }
        if ($msProp) { $out.milestone = $msProp.Value }
        if ($json.project) { $out.project = $json.project }
    } catch {}
    return [pscustomobject]$out
}

function Write-GateSavingsBlock {
    param($Savings, [string]$PhaseNum, [int]$Pw)

    Write-Host "GATE VALUE" -NoNewline -ForegroundColor White
    if ($Savings.exists -and $Savings.generatedAgeSec -ne $null) {
        Write-Host "  snapshot " -NoNewline -ForegroundColor DarkGray
        Write-Host (Format-Age $Savings.generatedAgeSec) -NoNewline -ForegroundColor Cyan
        Write-Host " old" -NoNewline -ForegroundColor DarkGray
    }
    Write-Host $CLEAR_LINE

    if (-not $Savings.exists) {
        Write-Host "  " -NoNewline
        Write-Host (Trunc "No gate-savings snapshot yet; run node super-gsd/tools/gate-savings/report.cjs --write." ($Pw - 3)) -NoNewline -ForegroundColor Yellow
        Write-Host $CLEAR_LINE
        return
    }

    $p = $Savings.phase
    $m = $Savings.milestone
    $t = $Savings.project
    $phaseLine = ("phase P{0}: caught {1}, waste points {2}; milestone: caught {3}, points {4}; project: caught {5}, points {6}" -f `
        $PhaseNum,
        (Format-SgsdMetricNumber (Read-SgsdNumber $p "totals.caught")),
        (Format-SgsdMetricNumber (Read-SgsdNumber $p "totals.waste_points")),
        (Format-SgsdMetricNumber (Read-SgsdNumber $m "totals.caught")),
        (Format-SgsdMetricNumber (Read-SgsdNumber $m "totals.waste_points")),
        (Format-SgsdMetricNumber (Read-SgsdNumber $t "totals.caught")),
        (Format-SgsdMetricNumber (Read-SgsdNumber $t "totals.waste_points")))
    Write-Host "  " -NoNewline
    Write-Host (Trunc $phaseLine ($Pw - 3)) -NoNewline -ForegroundColor Green
    Write-Host $CLEAR_LINE

    $gateLine = ("facts: ATC {0}C/{1}W, MUDA {2}, token degraded {3}, Codex timeouts {4}; points are estimates, counts are evidence." -f `
        (Format-SgsdMetricNumber (Read-SgsdNumber $t "atc.critical")),
        (Format-SgsdMetricNumber (Read-SgsdNumber $t "atc.warning")),
        (Format-SgsdMetricNumber (Read-SgsdNumber $t "muda.caught")),
        (Format-SgsdMetricNumber (Read-SgsdNumber $t "token_waste.degraded")),
        (Format-SgsdMetricNumber (Read-SgsdNumber $t "atc.codex_timeouts")))
    Write-Host "  " -NoNewline
    Write-Host (Trunc $gateLine ($Pw - 3)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE
}

function Get-AtcGateState {
    param([string]$Milestone, [string]$PhaseNum, $Codex, $Verdicts)
    $cells = @(
        [pscustomobject]@{ letter="P"; state="todo" }, # phase package ready
        [pscustomobject]@{ letter="C"; state="todo" }, # Claude reviewer
        [pscustomobject]@{ letter="O"; state="todo" }, # Codex/OpenAI reviewer
        [pscustomobject]@{ letter="F"; state="todo" }, # findings/fixes
        [pscustomobject]@{ letter="V"; state="todo" }  # final verdict
    )
    $summary = "ATC has not run for P$PhaseNum yet."
    $details = "Key: P package, C Claude, O Codex, F fixes, V verdict."
    $reviewFile = Get-PhaseReviewFile -Milestone $Milestone -PhaseNum $PhaseNum
    $commitFile = Get-PhaseCommitReviewFile -Milestone $Milestone -PhaseNum $PhaseNum
    $evidence = Get-PhaseEvidenceSummary -Milestone $Milestone -PhaseNum $PhaseNum

    if ($evidence.done -ge 4 -or $reviewFile -or $commitFile) { $cells[0].state = "done" }
    elseif ($evidence.done -gt 0) { $cells[0].state = "active" }

    $codexCurrent = ($Codex.scopeCurrent -and "$($Codex.phase)" -eq "$PhaseNum")
    if ($codexCurrent -and "$($Codex.step)" -match '(?i)atc|review') {
        $cells[2].state = "active"
        $summary = "ATC running: Codex is reviewing P$PhaseNum."
    }

    if ($commitFile -or $Verdicts.Count -gt 0) {
        $cells[2].state = "done"
    }

    if ($reviewFile) {
        $raw = ""
        try { $raw = Get-Content $reviewFile.FullName -Raw -ErrorAction SilentlyContinue } catch {}

        $cells[1].state = if ($raw -match '(?i)Claude\s*\(|\|\s*Claude\b|sgsd-code-reviewer') { "done" } else { $cells[1].state }
        if ($raw -match '(?i)Codex\s*\(|\|\s*Codex\b|sgsd-codex-reviewer') {
            $cells[2].state = "done"
        }
        if ($raw -match '(?i)provider_unavailable|tier cap|timeout|timed out|exit=5') {
            $cells[2].state = "fail"
        }
        if ($raw -match '(?i)Findings|Resolution|HIGH|MEDIUM|LOW|CRIT|WARN') {
            $cells[3].state = "active"
        }
        if ($raw -match '(?i)resolved|post-fix|closed|addressed|fix(ed)?') {
            $cells[3].state = "done"
        }

        $verdictText = ""
        $vm = [regex]::Match($raw, '(?mi)^verdict:\s*(.+)$')
        if ($vm.Success) {
            $verdictText = $vm.Groups[1].Value.Trim()
        } else {
            $vm = [regex]::Match($raw, '(?is)Final Verdict\s*\r?\n\s*\*\*(.+?)\*\*')
            if ($vm.Success) { $verdictText = $vm.Groups[1].Value.Trim() }
        }
        if ($verdictText) {
            $cells[4].state = "done"
            if ($verdictText -match '(?i)FAIL|CRIT|REVISE') { $cells[4].state = "fail" }
        }

        $claude = if ($cells[1].state -eq "done") { "Claude reviewed" } else { "Claude not recorded" }
        $codex = if ($cells[2].state -eq "fail") { "Codex timed out or hit tier cap" } elseif ($cells[2].state -eq "done") { "Codex reviewed" } elseif ($cells[2].state -eq "active") { "Codex running" } else { "Codex not recorded" }
        $fixes = if ($cells[3].state -eq "done") { "fixes closed" } elseif ($cells[3].state -eq "active") { "findings open" } else { "no findings yet" }
        $summary = "$claude; $codex; $fixes."
        if ($verdictText) { $summary = "ATC $verdictText - $summary" }
        $details = "Source: $($reviewFile.Name)"
    } elseif ($Verdicts.Count -gt 0) {
        foreach ($c in $cells) { $c.state = "done" }
        $latest = $Verdicts[0]
        if ([int]$latest.critical -gt 0) { $cells[4].state = "fail" }
        $summary = "Per-dispatch ATC: $($latest.plan) - $($latest.one_liner)"
        $details = "No phase review file yet; showing commit review evidence."
    } elseif ($codexCurrent -and "$($Codex.state)" -eq "timeout") {
        $cells[2].state = "fail"
        $summary = "Codex ATC timed out for P$PhaseNum; fallback review evidence is still needed."
    } elseif ($evidence.done -ge 4) {
        $summary = "Package looks ready; waiting for ATC review."
    }
    return [pscustomobject]@{ cells=$cells; summary=$summary; details=$details }
}

function Get-GateStateColor {
    param([string]$State)
    switch ("$State") {
        "done"   { return "Green" }
        "active" { return "Yellow" }
        "warn"   { return "Yellow" }
        "fail"   { return "Red" }
        "skip"   { return "DarkGray" }
        default  { return "Red" }
    }
}

function Get-GateStateWord {
    param([string]$State)
    switch ("$State") {
        "done"   { return "done" }
        "active" { return "running" }
        "warn"   { return "warning" }
        "fail"   { return "failed" }
        "skip"   { return "not probed" }
        default  { return "not run" }
    }
}

function Get-AtcGateDescriptors {
    return @(
        [pscustomobject]@{ code="P"; name="Package"; explain="phase docs, plan, evidence, and review inputs are ready" },
        [pscustomobject]@{ code="C"; name="Claude"; explain="Claude reviewer checks implementation against the phase contract" },
        [pscustomobject]@{ code="O"; name="Codex"; explain="Codex gives an independent review or records fallback/timeout" },
        [pscustomobject]@{ code="F"; name="Fixes"; explain="findings are repaired, deferred, or proven irrelevant" },
        [pscustomobject]@{ code="V"; name="Verdict"; explain="final phase status is written as PASS, debt, or candidate" }
    )
}

function Get-MudaGateDescriptors {
    return @(
        [pscustomobject]@{ code="T"; name="Transport"; explain="looks for needless handoff between tools or systems; SGSD auto-probe is limited" },
        [pscustomobject]@{ code="I"; name="Inventory"; explain="looks for unused docs, stale context, and unconsumed artifacts" },
        [pscustomobject]@{ code="M"; name="Motion"; explain="looks for needless file/tool hopping and repeated scans" },
        [pscustomobject]@{ code="W"; name="Waiting"; explain="looks for idle blockers, avoidable waits, and queue stalls" },
        [pscustomobject]@{ code="O"; name="Overprod"; explain="looks for artifacts nobody consumes or duplicate outputs" },
        [pscustomobject]@{ code="O"; name="Overproc"; explain="looks for over-complex checks, wrappers, or process bloat" },
        [pscustomobject]@{ code="D"; name="Defects"; explain="looks for rework, broken contracts, and errors that caused repair loops" }
    )
}

function Get-AtcReviewStepDescriptors {
    return @(
        [pscustomobject]@{ num="1"; name="First principles"; explain="is this change needed for the phase goal?" },
        [pscustomobject]@{ num="2"; name="Delete"; explain="can any code, field, doc, or process be removed?" },
        [pscustomobject]@{ num="3"; name="Simplify"; explain="can the same result be reached with less structure?" },
        [pscustomobject]@{ num="4"; name="Accelerate"; explain="did the change introduce avoidable latency or token cost?" },
        [pscustomobject]@{ num="5"; name="Automate"; explain="only automate what survived the first four checks" },
        [pscustomobject]@{ num="6"; name="Validate"; explain="prove correctness with tests, fixtures, or binding evidence" },
        [pscustomobject]@{ num="7"; name="Anti-slop"; explain="orphans, dead imports, unused params, duplication, YAGNI, complexity, responsibility" }
    )
}

function Get-GateFocusLine {
    param(
        [string]$Name,
        [object[]]$Cells,
        [object[]]$Descriptors,
        [string]$DoneText
    )
    foreach ($targetState in @("active", "fail", "warn", "todo", "skip")) {
        for ($i = 0; $i -lt $Cells.Count -and $i -lt $Descriptors.Count; $i++) {
            if ("$($Cells[$i].state)" -eq $targetState) {
                $d = $Descriptors[$i]
                $word = Get-GateStateWord "$($Cells[$i].state)"
                return ("{0} focus: {1} {2} is {3} - {4}." -f $Name, $d.code, $d.name, $word, $d.explain)
            }
        }
    }
    return $DoneText
}

function Write-GateStepLine {
    param($Descriptor, [string]$State, [int]$Pw)
    $color = Get-GateStateColor $State
    $word = Get-GateStateWord $State
    $label = ("{0} {1}" -f $Descriptor.code, $Descriptor.name).PadRight(12)
    Write-Host "  " -NoNewline
    Write-Host $label -NoNewline -ForegroundColor $color
    Write-Host " " -NoNewline
    Write-Host (Trunc ("{0} - {1}" -f $word, $Descriptor.explain) ($Pw - 16)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE
}

function Write-AtcReviewSteps {
    param([int]$Pw, [switch]$Compact)

    Write-Host "ATC SPACE X CHECKS" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    Write-Host "  " -NoNewline
    Write-Host (Trunc "Lite = delete+simplify. Full = seven-step review + anti-slop. Gate = full plus architecture caution." ($Pw - 3)) -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    $steps = @(Get-AtcReviewStepDescriptors)
    $limit = if ($Compact) { 4 } else { $steps.Count }
    for ($i = 0; $i -lt $limit -and $i -lt $steps.Count; $i++) {
        $s = $steps[$i]
        $label = ("{0}. {1}" -f $s.num, $s.name).PadRight(20)
        Write-Host "  " -NoNewline
        Write-Host $label -NoNewline -ForegroundColor Cyan
        Write-Host (Trunc $s.explain ($Pw - 23)) -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
    }
    if ($Compact -and $steps.Count -gt $limit) {
        Write-Host "  " -NoNewline
        Write-Host (Trunc "Then: automate only after pruning, validate, and run the anti-slop checklist." ($Pw - 3)) -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
    }
}

function Write-GateSynopsis {
    param($Muda, $Atc, [string]$PhaseNum, [int]$Pw, [switch]$Compact)

    $atcDesc = @(Get-AtcGateDescriptors)
    $mudaDesc = @(Get-MudaGateDescriptors)

    Write-Host "GATE SYNOPSIS" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE

    $atcFocus = Get-GateFocusLine -Name "ATC" -Cells $Atc.cells -Descriptors $atcDesc -DoneText "ATC focus: all review stages are complete for this phase."
    Write-Host "  " -NoNewline
    Write-Host (Trunc $atcFocus ($Pw - 3)) -NoNewline -ForegroundColor Yellow
    Write-Host $CLEAR_LINE
    foreach ($i in 0..($atcDesc.Count - 1)) {
        Write-GateStepLine -Descriptor $atcDesc[$i] -State "$($Atc.cells[$i].state)" -Pw $Pw
    }

    Write-Host "  " -NoNewline
    Write-Host (Trunc "$($Atc.summary)" ($Pw - 3)) -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    Write-Host $CLEAR_LINE
    Write-AtcReviewSteps -Pw $Pw -Compact:$Compact

    if (-not $Compact) { Write-Host $CLEAR_LINE }
    $mudaFocus = Get-GateFocusLine -Name "MUDA" -Cells $Muda.cells -Descriptors $mudaDesc -DoneText "MUDA focus: all active waste probes are complete for this phase."
    Write-Host "  " -NoNewline
    Write-Host (Trunc $mudaFocus ($Pw - 3)) -NoNewline -ForegroundColor Yellow
    Write-Host $CLEAR_LINE

    $mudaLimit = if ($Compact) { 4 } else { $mudaDesc.Count }
    for ($i = 0; $i -lt $mudaLimit -and $i -lt $mudaDesc.Count; $i++) {
        Write-GateStepLine -Descriptor $mudaDesc[$i] -State "$($Muda.cells[$i].state)" -Pw $Pw
    }
    if ($Compact -and $mudaDesc.Count -gt $mudaLimit) {
        Write-Host "  " -NoNewline
        Write-Host (Trunc "More MUDA: Overprod, Overproc, and Defects also run at phase-close waste review." ($Pw - 3)) -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    }
}

function Render-CompactCodex {
    param($Scope, $Codex, $Substrate, $Rows, $Verdicts, $Brief, $Savings, $PhaseNum, $Pw)

    $ts = Get-Date -Format 'HH:mm:ss'
    Write-Host "SUPER GSD" -NoNewline -ForegroundColor Magenta
    Write-Host " ! " -NoNewline -ForegroundColor Cyan
    Write-Host "Codex " -NoNewline -ForegroundColor White
    Write-Host ("{0}/P{1}" -f $Scope.milestone, $PhaseNum) -NoNewline -ForegroundColor Yellow
    Write-Host "  $ts" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    Write-Host "LANE " -NoNewline -ForegroundColor White
    Write-Host $Codex.state.ToUpper() -NoNewline -ForegroundColor $Codex.stateColor
    Write-Host " / cfg " -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($Codex.enabled) { "enabled" } else { "dark" })) -NoNewline -ForegroundColor $(if ($Codex.enabled) { "Green" } else { "Yellow" })
    Write-Host " / age " -NoNewline -ForegroundColor DarkGray
    Write-Host (Format-Age $Codex.updatedAgeSec) -NoNewline -ForegroundColor Cyan
    Write-Host " / io " -NoNewline -ForegroundColor DarkGray
    Write-Host ("{0}/{1}" -f (Format-Bytes $Codex.promptBytes), (Format-Bytes $Codex.reportBytes)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE

    Write-Host "ROUTE 6.5=" -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($Codex.phaseAtcProvider) { $Codex.phaseAtcProvider } else { "--" })) -NoNewline -ForegroundColor Gray
    Write-Host " 9.5=" -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($Codex.perDispatchProvider) { $Codex.perDispatchProvider } else { "--" })) -NoNewline -ForegroundColor Gray
    Write-Host " fb=" -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($Codex.fallbackOnError) { "on" } else { "off" })) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE

    $scopeLine = if ($Codex.scopeCurrent) {
        "current live: $($Codex.phase) / $($Codex.plan) / $($Codex.step)"
    } elseif ($Codex.staleScope) {
        "current P$PhaseNum; last review was $($Codex.staleScope)"
    } else {
        "current P$PhaseNum; no Codex marker yet"
    }
    Write-Host "SCOPE " -NoNewline -ForegroundColor White
    Write-Host (Trunc $scopeLine ($Pw - 7)) -NoNewline -ForegroundColor Cyan
    Write-Host $CLEAR_LINE
    Write-Host $CLEAR_LINE

    $muda = Get-MudaGateState -Milestone $Scope.milestone -PhaseNum $PhaseNum -Codex $Codex
    Write-GateTrack "MUDA" $muda.cells
    Write-Host "  " -NoNewline
    Write-Host (Trunc $muda.summary ($Pw - 3)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE
    Write-Host "  " -NoNewline
    Write-Host (Trunc $muda.details ($Pw - 3)) -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE
    $mudaStats = Get-MudaStats -Milestone $Scope.milestone
    Write-Host "  stats " -NoNewline -ForegroundColor DarkGray
    Write-Host (Trunc (Format-MudaStatsLine $mudaStats) ($Pw - 9)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE

    $atc = Get-AtcGateState -Milestone $Scope.milestone -PhaseNum $PhaseNum -Codex $Codex -Verdicts $Verdicts
    Write-GateTrack "ATC" $atc.cells
    Write-Host "  " -NoNewline
    Write-Host (Trunc $atc.summary ($Pw - 3)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE
    Write-Host "  " -NoNewline
    Write-Host (Trunc $atc.details ($Pw - 3)) -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE
    $atcStats = Get-AtcStats -Milestone $Scope.milestone
    Write-Host "  stats " -NoNewline -ForegroundColor DarkGray
    Write-Host (Trunc (Format-AtcStatsLine $atcStats) ($Pw - 9)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE
    Write-Host $CLEAR_LINE

    Write-GateSavingsBlock -Savings $Savings -PhaseNum $PhaseNum -Pw $Pw
    Write-Host $CLEAR_LINE

    Write-Host "CODE REVIEW BRIEF" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    $briefLines = @()
    if ($Brief.conclusion) { $briefLines += "$($Brief.conclusion)" }
    foreach ($item in @($Brief.attention | Select-Object -First 2)) { $briefLines += "$item" }
    if ($briefLines.Count -eq 0) { $briefLines += "No current Codex review brief yet." }
    foreach ($line in @($briefLines | Select-Object -First 3)) {
        Write-Host "  " -NoNewline
        Write-Host (Trunc $line ($Pw - 3)) -NoNewline -ForegroundColor Yellow
        Write-Host $CLEAR_LINE
    }
    Write-Host $CLEAR_LINE
    Write-GateSynopsis -Muda $muda -Atc $atc -PhaseNum $PhaseNum -Pw $Pw -Compact
    Write-Host $CLEAR_BELOW -NoNewline
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
    $savings = Get-GateSavingsSnapshot -Milestone $scope.milestone -PhaseNum $phaseNum

    if ($ph -lt 36 -and $env:SGSD_CODEX_FULL -ne "1") {
        Render-CompactCodex -Scope $scope -Codex $codex -Substrate $substrate -Rows $rows -Verdicts $verdicts -Brief $brief -Savings $savings -PhaseNum $phaseNum -Pw $pw
        return
    }

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
    Write-Host " / io " -NoNewline -ForegroundColor DarkGray
    Write-Host ("{0}/{1}" -f (Format-Bytes $codex.promptBytes), (Format-Bytes $codex.reportBytes)) -NoNewline -ForegroundColor Gray
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

    Write-Host $CLEAR_LINE
    Write-Host "PHASE CONTEXT" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    $phaseGoal = Get-PhaseGoalBrief $phaseNum
    if ($phaseGoal) {
        Write-Host "  goal " -NoNewline -ForegroundColor DarkGray
        Write-Host (Trunc $phaseGoal ($pw - 8)) -NoNewline -ForegroundColor White
        Write-Host $CLEAR_LINE
    }
    $phaseEvidence = Get-PhaseEvidenceSummary -Milestone $scope.milestone -PhaseNum $phaseNum
    Write-Host "  evidence " -NoNewline -ForegroundColor DarkGray
    Write-Host ("[{0}] {1}/{2}" -f $phaseEvidence.bits, $phaseEvidence.done, $phaseEvidence.total) -NoNewline -ForegroundColor $(if ($phaseEvidence.done -eq $phaseEvidence.total) { "Green" } elseif ($phaseEvidence.done -gt 0) { "Yellow" } else { "DarkGray" })
    Write-Host $CLEAR_LINE

    $muda = Get-MudaGateState -Milestone $scope.milestone -PhaseNum $phaseNum -Codex $codex
    Write-GateTrack "MUDA" $muda.cells
    Write-Host "  " -NoNewline
    Write-Host (Trunc $muda.summary ($pw - 3)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE
    Write-Host "  " -NoNewline
    Write-Host (Trunc $muda.details ($pw - 3)) -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE
    $mudaStats = Get-MudaStats -Milestone $scope.milestone
    Write-Host "  stats " -NoNewline -ForegroundColor DarkGray
    Write-Host (Trunc (Format-MudaStatsLine $mudaStats) ($pw - 9)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE

    $atc = Get-AtcGateState -Milestone $scope.milestone -PhaseNum $phaseNum -Codex $codex -Verdicts $verdicts
    Write-GateTrack "ATC" $atc.cells
    Write-Host "  " -NoNewline
    Write-Host (Trunc $atc.summary ($pw - 3)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE
    Write-Host "  " -NoNewline
    Write-Host (Trunc $atc.details ($pw - 3)) -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE
    $atcStats = Get-AtcStats -Milestone $scope.milestone
    Write-Host "  stats " -NoNewline -ForegroundColor DarkGray
    Write-Host (Trunc (Format-AtcStatsLine $atcStats) ($pw - 9)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE

    Write-Host $CLEAR_LINE
    Write-GateSavingsBlock -Savings $savings -PhaseNum $phaseNum -Pw $pw

    if ($expanded) {
        Write-Host $CLEAR_LINE
        Write-Host $(if ($codex.scopeCurrent) { "ACTIVE CODEX DETAIL" } else { "LAST OLD CODEX DETAIL" }) -NoNewline -ForegroundColor White
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

    Write-Host $CLEAR_LINE
    Write-GateSynopsis -Muda $muda -Atc $atc -PhaseNum $phaseNum -Pw $pw

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
