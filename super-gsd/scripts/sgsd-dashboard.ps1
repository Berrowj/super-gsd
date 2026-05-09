# Super GSD Project Dashboard - Full Stats
# Shows: milestone, phase breakdown, todos, blockers, requirements,
#        active agent, tokens + $ cost, session metrics, commits
#
# Usage:
#   .\sgsd-dashboard.ps1                                # current directory
#   .\sgsd-dashboard.ps1 -ProjectDir ~\project-clarity-erp
#   .\sgsd-dashboard.ps1 -RefreshSec 5

param(
    [string]$ProjectDir = ".",
    [int]$RefreshSec = 10
)

$ErrorActionPreference = "SilentlyContinue"

try {
    $ProjectDir = (Resolve-Path $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve $ProjectDir" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $ProjectDir ".planning"))) {
    Write-Host "ERROR: No .planning/ directory in $ProjectDir" -ForegroundColor Red
    exit 1
}

# ANSI escape codes for clean in-place refresh
$ESC = [char]27
$HOME_POS = "$ESC[H"
$CLEAR_BELOW = "$ESC[0J"

# Token-to-dollar conversion rates (blended, approx)
# Haiku 3.5:  $0.80 / 1M in, $4 / 1M out    (avg ~$2.4/1M)
# Sonnet 4.5: $3    / 1M in, $15 / 1M out   (avg ~$9/1M)
# Opus 4.6:   $15   / 1M in, $75 / 1M out   (avg ~$45/1M)
$RATE_HAIKU = 2.4 / 1000000
$RATE_SONNET = 9.0 / 1000000
$RATE_OPUS = 45.0 / 1000000

function Get-Value($file, $key) {
    if (-not (Test-Path $file)) { return "" }
    try {
        $content = Get-Content $file -ErrorAction SilentlyContinue
        foreach ($line in $content) {
            if ($line -match "^${key}:\s*(.*)$") {
                return $matches[1].Trim().Trim('"').Trim("'")
            }
        }
    } catch {}
    return ""
}

function Format-Num($n) {
    if ($n -lt 1000) { return "$n" }
    if ($n -lt 1000000) { return "$([math]::Round($n/1000))K" }
    return "$([math]::Round($n/1000000, 1))M"
}

function Format-Dollar($n) {
    if ($n -lt 0.01) { return "<$0.01" }
    if ($n -lt 1) { return "`$$([math]::Round($n, 2))" }
    if ($n -lt 100) { return "`$$([math]::Round($n, 2))" }
    return "`$$([math]::Round($n))"
}

function Make-Bar($pct, $width) {
    $filled = [math]::Floor(($pct / 100) * $width)
    if ($filled -gt $width) { $filled = $width }
    if ($filled -lt 0) { $filled = 0 }
    $empty = $width - $filled
    return ('#' * $filled) + ('-' * $empty)
}

function Get-Blockers($stateFile) {
    $blockers = @()
    if (-not (Test-Path $stateFile)) { return $blockers }
    try {
        $inBlockerSection = $false
        $content = Get-Content $stateFile -ErrorAction SilentlyContinue
        foreach ($line in $content) {
            if ($line -match "^##\s*Blockers?") {
                $inBlockerSection = $true
                continue
            }
            if ($inBlockerSection -and $line -match "^##") {
                break
            }
            if ($inBlockerSection) {
                $trimmed = $line.Trim()
                if ($trimmed -match "^[-*]\s+(.+)$") {
                    $b = $matches[1].Trim()
                    if ($b -and $b -notmatch "^(None|N/A|-)$") {
                        $blockers += $b
                    }
                }
            }
        }
    } catch {}
    return $blockers
}

function Get-Todos($projectDir) {
    $todos = @()
    $todoDir = Join-Path $projectDir ".planning\todos\pending"
    if (Test-Path $todoDir) {
        try {
            Get-ChildItem -Path $todoDir -Filter "*.md" -ErrorAction SilentlyContinue | ForEach-Object {
                $firstLine = (Get-Content $_.FullName -TotalCount 1 -ErrorAction SilentlyContinue)
                if ($firstLine -match "^#\s*(.+)$") {
                    $todos += $matches[1]
                } else {
                    $todos += $_.BaseName
                }
            }
        } catch {}
    }
    return $todos
}

function Get-RequirementsProgress($projectDir) {
    $reqFile = Join-Path $projectDir ".planning\REQUIREMENTS.md"
    if (-not (Test-Path $reqFile)) { return $null }
    try {
        $content = Get-Content $reqFile -Raw -ErrorAction SilentlyContinue
        if (-not $content) { return $null }
        $total = ([regex]::Matches($content, '(?m)^\s*-\s*\[')).Count
        $done = ([regex]::Matches($content, '(?m)^\s*-\s*\[x\]')).Count
        return @{ total = $total; done = $done }
    } catch {
        return $null
    }
}

function Get-Waves($phaseDir) {
    # Parses PLAN.md bodies for inline wave definitions:
    #   <name>Wave N · description (Tasks X-Y)</name>
    # Returns ordered array of @{ plan; wave; name; range; taskCount; status }
    $result = @()
    if (-not (Test-Path $phaseDir)) { return $result }
    try {
        $plans = Get-ChildItem -Path $phaseDir -Filter "*-PLAN.md" -ErrorAction SilentlyContinue | Sort-Object Name
        foreach ($plan in $plans) {
            $content = Get-Content $plan.FullName -Raw -ErrorAction SilentlyContinue
            if (-not $content) { continue }
            # Match XML <name>Wave N ...</name>
            $rxXml = [regex]'<name>\s*Wave\s+(\d+)\s*[\u00B7\u2022\.\-:]\s*([^<]+?)\s*</name>'
            $found = $rxXml.Matches($content)
            # Fallback: markdown headings "## Wave N: description"
            if ($found.Count -eq 0) {
                $rxMd = [regex]'(?m)^#{1,3}\s*Wave\s+(\d+)\s*[\u00B7\u2022\.\-:]\s*(.+?)\s*$'
                $found = $rxMd.Matches($content)
            }
            foreach ($m in $found) {
                $num = [int]$m.Groups[1].Value
                $desc = $m.Groups[2].Value.Trim()
                $range = ""
                $taskCount = 0
                if ($desc -match '\(Tasks?\s*(\d+)(?:\s*[\-\u2013]\s*(\d+))?\)') {
                    $start = [int]$matches[1]
                    $end = if ($matches[2]) { [int]$matches[2] } else { $start }
                    $taskCount = $end - $start + 1
                    $range = if ($end -gt $start) { "T$start-T$end" } else { "T$start" }
                }
                # Strip the (Tasks ...) suffix from name to keep it clean
                $cleanName = ($desc -replace '\s*\(Tasks?\s*\d+(?:\s*[\-\u2013]\s*\d+)?\)\s*$', '').Trim()
                $result += @{
                    plan      = $plan.BaseName
                    wave      = $num
                    name      = $cleanName
                    range     = $range
                    taskCount = $taskCount
                    status    = "pending"
                }
            }
        }
    } catch {}
    return @($result | Sort-Object { $_.plan }, { $_.wave })
}

function Get-ActiveWaveFromLog($activityLog) {
    # Finds most recent TaskCreate/Agent target containing "W<N>" or "Wave N".
    if (-not (Test-Path $activityLog)) { return $null }
    try {
        $lines = Get-Content $activityLog -Tail 200 -ErrorAction SilentlyContinue
        if (-not $lines) { return $null }
        [array]::Reverse($lines)
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($e.tool -ne "TaskCreate" -and $e.tool -ne "Agent") { continue }
                if ("$($e.target)" -match '\bW(\d+)\b|\bWave\s+(\d+)') {
                    if ($matches[1]) { return [int]$matches[1] }
                    if ($matches[2]) { return [int]$matches[2] }
                }
            } catch {}
        }
    } catch {}
    return $null
}

function Get-WaveStatusFromGit($projectDir) {
    # Returns highest "Wave N done" mentioned in last 50 commits, or 0.
    $highest = 0
    Push-Location $projectDir -ErrorAction SilentlyContinue
    try {
        $commits = & git log --oneline -50 2>$null
        if ($commits) {
            foreach ($c in $commits) {
                $rx = [regex]::Matches($c, '[Ww]ave\s+(\d+)\s+done')
                foreach ($m in $rx) {
                    $n = [int]$m.Groups[1].Value
                    if ($n -gt $highest) { $highest = $n }
                }
            }
        }
    } catch {}
    Pop-Location -ErrorAction SilentlyContinue
    return $highest
}

function Get-AgentRoster($activityLog, $maxAgeSec = 21600) {
    # Returns ordered array of unique agents seen in recent log lines.
    # Default window: 6 hours. Returns last 10 most recent.
    $roster = [ordered]@{}
    if (-not (Test-Path $activityLog)) { return @() }
    try {
        $lines = Get-Content $activityLog -Tail 500 -ErrorAction SilentlyContinue
        if (-not $lines) { return @() }
        $now = Get-Date
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($e.tool -ne "Agent" -and $e.tool -ne "TaskCreate") { continue }
                $t = "$($e.target)".Trim()
                if (-not $t) { continue }
                $ts = $null
                try { $ts = [DateTime]::Parse($e.ts) } catch {}
                if (-not $ts) { continue }
                $age = [int]($now - $ts).TotalSeconds
                if ($age -gt $maxAgeSec) { continue }
                $name = $t
                if ($t -match '^([a-zA-Z][\w-]+)\s*[:\[]') { $name = $matches[1] }
                elseif ($t -match '^([a-zA-Z][\w-]+)') { $name = $matches[1] }
                $key = "$name|$t"
                if (-not $roster.Contains($key) -or $roster[$key].lastTs -lt $ts) {
                    $roster[$key] = @{
                        name   = $name
                        target = $t
                        lastTs = $ts
                        ageSec = $age
                        tool   = $e.tool
                    }
                }
            } catch {}
        }
    } catch {}
    foreach ($entry in $roster.Values) {
        if ($entry.ageSec -lt 60)        { $entry.status = "ACTIVE" }
        elseif ($entry.ageSec -lt 300)   { $entry.status = "IDLE" }
        elseif ($entry.ageSec -lt 1800)  { $entry.status = "RECENT" }
        else                              { $entry.status = "OLDER" }
    }
    return @($roster.Values | Sort-Object { $_.ageSec } | Select-Object -First 10)
}

function Get-OrchestratorPulse($projectDir, $activityLog) {
    # Returns @{ lastCommitAgo; lastActivityAgo; commits5min; commits1hr }
    $pulse = @{ lastCommitAgo = $null; lastActivityAgo = $null; commits5min = 0; commits1hr = 0 }
    Push-Location $projectDir -ErrorAction SilentlyContinue
    try {
        $now = Get-Date
        $lastCommitTs = & git log -1 --format="%cI" 2>$null
        if ($lastCommitTs) {
            try {
                $ts = [DateTime]::Parse($lastCommitTs)
                $pulse.lastCommitAgo = [int]($now - $ts).TotalSeconds
            } catch {}
        }
        $recent = & git log --since="1 hour ago" --format="%cI" 2>$null
        if ($recent) {
            foreach ($r in $recent) {
                try {
                    $ts = [DateTime]::Parse($r)
                    $age = ($now - $ts).TotalSeconds
                    if ($age -le 3600) { $pulse.commits1hr++ }
                    if ($age -le 300)  { $pulse.commits5min++ }
                } catch {}
            }
        }
    } catch {}
    Pop-Location -ErrorAction SilentlyContinue
    if (Test-Path $activityLog) {
        try {
            $last = Get-Content $activityLog -Tail 1 -ErrorAction SilentlyContinue
            if ($last) {
                $e = $last | ConvertFrom-Json -ErrorAction Stop
                $ts = [DateTime]::Parse($e.ts)
                $pulse.lastActivityAgo = [int]((Get-Date) - $ts).TotalSeconds
            }
        } catch {}
    }
    return $pulse
}

function Get-PhaseBreakdown($projectDir) {
    $phases = @()
    $phasesDir = Join-Path $projectDir ".planning\phases"
    if (-not (Test-Path $phasesDir)) { return $phases }
    try {
        Get-ChildItem -Path $phasesDir -Directory -ErrorAction SilentlyContinue |
            Sort-Object Name | ForEach-Object {
                $dirName = $_.Name
                $num = ""
                $name = $dirName
                if ($dirName -match "^(\d+)-(.+)$") {
                    $num = $matches[1]
                    $name = $matches[2]
                }
                $plans = @(Get-ChildItem -Path $_.FullName -Filter "*-PLAN.md" -ErrorAction SilentlyContinue)
                $planTotal = $plans.Count
                $planDone = 0
                foreach ($plan in $plans) {
                    $summaryPath = $plan.FullName -replace 'PLAN\.md$', 'SUMMARY.md'
                    if (Test-Path $summaryPath) { $planDone++ }
                }
                $pct = 0
                if ($planTotal -gt 0) { $pct = [math]::Round(($planDone / $planTotal) * 100) }
                $phases += @{
                    num = $num
                    name = $name
                    done = $planDone
                    total = $planTotal
                    pct = $pct
                }
            }
    } catch {}
    return $phases
}

function Get-TokenStats($tokenLog) {
    $stats = @{ opus = 0; sonnet = 0; haiku = 0; total = 0; cost = 0.0 }
    if (-not (Test-Path $tokenLog)) { return $stats }
    try {
        $lines = Get-Content $tokenLog -ErrorAction SilentlyContinue
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                $m = "$($e.model)".ToLower()
                $t = [int]$e.total
                if ($m -eq "opus") { $stats.opus += $t }
                elseif ($m -eq "sonnet") { $stats.sonnet += $t }
                elseif ($m -eq "haiku") { $stats.haiku += $t }
            } catch {}
        }
        $stats.total = $stats.opus + $stats.sonnet + $stats.haiku
        $stats.cost = ($stats.opus * $RATE_OPUS) + ($stats.sonnet * $RATE_SONNET) + ($stats.haiku * $RATE_HAIKU)
    } catch {}
    return $stats
}

function Get-CodexStats($codexLog, $milestoneStartTs) {
    $stats = @{ invocations = 0; fallbacks = 0; totalDurationMs = 0; claudeTokensSaved = 0 }
    if (-not (Test-Path $codexLog)) { return $stats }
    try {
        foreach ($line in (Get-Content $codexLog -ErrorAction SilentlyContinue)) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($milestoneStartTs -and $e.ts -lt $milestoneStartTs) { continue }
                $stats.invocations++
                if ($e.fallback_triggered) { $stats.fallbacks++ }
                if ($e.duration_ms) { $stats.totalDurationMs += [int]$e.duration_ms }
            } catch {}
        }
    } catch {}
    # claude_tokens_saved: token-log.jsonl rows where model="codex" (D-07 proxy)
    $tokenLog = $codexLog -replace 'codex-log\.jsonl$', 'token-log.jsonl'
    if (Test-Path $tokenLog) {
        try {
            foreach ($line in (Get-Content $tokenLog -ErrorAction SilentlyContinue)) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    if ("$($e.model)".ToLower() -eq 'codex') {
                        $stats.claudeTokensSaved += [int]$e.total
                    }
                } catch {}
            }
        } catch {}
    }
    return $stats
}

Write-Host "$HOME_POS$CLEAR_BELOW" -NoNewline
$firstRun = $true

# Track how many lines we wrote last iteration for proper overwrite
$script:linesWritten = 0

# Helper: write a line and increment the counter
function W-Line {
    param([scriptblock]$content)
    & $content
    $script:linesWritten++
}

while ($true) {
    # Reset cursor to top without clearing the screen; this preserves scroll.
    try {
        if (-not $firstRun) {
            [Console]::SetCursorPosition(0, 0)
        }
        $firstRun = $false
    } catch {
        # Fallback if console doesn't support SetCursorPosition
        Write-Host $HOME_POS -NoNewline
    }

    $script:linesWritten = 0

    # COLORFUL HEADER
    $time = Get-Date -Format 'HH:mm:ss'
    Write-Host "+" -NoNewline -ForegroundColor Cyan
    Write-Host ("=" * 62) -NoNewline -ForegroundColor Cyan
    Write-Host "+" -ForegroundColor Cyan
    Write-Host "|" -NoNewline -ForegroundColor Cyan
    Write-Host "  SUPER GSD " -NoNewline -ForegroundColor Magenta
    Write-Host "* " -NoNewline -ForegroundColor Yellow
    Write-Host "Mission Control" -NoNewline -ForegroundColor White
    Write-Host "   $time " -NoNewline -ForegroundColor DarkGray
    Write-Host "live feed" -NoNewline -ForegroundColor Green
    Write-Host "   |" -ForegroundColor Cyan
    Write-Host "+" -NoNewline -ForegroundColor Cyan
    Write-Host ("=" * 62) -NoNewline -ForegroundColor Cyan
    Write-Host "+" -ForegroundColor Cyan

    # STATE FILES
    $stateFile = Join-Path $ProjectDir ".planning\STATE.md"
    $roadmapFile = Join-Path $ProjectDir ".planning\ROADMAP.md"
    $checkpointFile = Join-Path $ProjectDir ".planning\ORCHESTRATOR-CHECKPOINT.md"
    $tokenLog = Join-Path $ProjectDir ".planning\metrics\token-log.jsonl"
    $activityLog = Join-Path $ProjectDir ".planning\metrics\activity-log.jsonl"

    # Collect all values
    $milestone = Get-Value $stateFile "milestone"
    $milestoneName = Get-Value $stateFile "milestone_name"
    $currentPhase = Get-Value $stateFile "current_phase"
    $status = Get-Value $stateFile "status"
    if (-not $milestone) { $milestone = "?" }
    if (-not $currentPhase) { $currentPhase = "?" }
    if (-not $status) { $status = "?" }

    $totalPhases = 0; $donePhases = 0
    if (Test-Path $roadmapFile) {
        $roadmapText = Get-Content $roadmapFile -Raw -ErrorAction SilentlyContinue
        if ($roadmapText) {
            $totalPhases = ([regex]::Matches($roadmapText, '(?m)^- \[')).Count
            $donePhases = ([regex]::Matches($roadmapText, '(?m)^- \[x\]')).Count
        }
    }

    # MILESTONE + PROGRESS (1 line)
    $mlPct = if ($totalPhases -gt 0) { [math]::Round(($donePhases / $totalPhases) * 100) } else { 0 }
    $mlBar = Make-Bar $mlPct 14
    Write-Host "$milestone " -NoNewline -ForegroundColor Yellow
    if ($milestoneName) {
        $nm = $milestoneName
        if ($nm.Length -gt 25) { $nm = $nm.Substring(0, 25) + ".." }
        Write-Host "$nm " -NoNewline -ForegroundColor Gray
    }
    Write-Host "[$mlBar] " -NoNewline -ForegroundColor Green
    Write-Host "$donePhases/$totalPhases " -NoNewline -ForegroundColor White
    Write-Host "($mlPct%) " -NoNewline -ForegroundColor DarkGray
    Write-Host $status -ForegroundColor Cyan

    # CURRENT PHASE (2 lines)
    $phasesDir = Join-Path $ProjectDir ".planning\phases"
    $phaseDirName = ""
    $currentPlan = ""
    $planDoneCount = 0
    $planPendingCount = 0

    if ((Test-Path $phasesDir) -and $currentPhase -ne "?") {
        $phaseDir = Get-ChildItem -Path $phasesDir -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name.StartsWith("$currentPhase-") } |
                    Select-Object -First 1
        if ($phaseDir) {
            $phaseDirName = $phaseDir.Name -replace "^\d+-", ""
            $plans = Get-ChildItem -Path $phaseDir.FullName -Filter "*-PLAN.md" -ErrorAction SilentlyContinue | Sort-Object Name
            foreach ($plan in $plans) {
                $summaryPath = $plan.FullName -replace 'PLAN\.md$', 'SUMMARY.md'
                if (Test-Path $summaryPath) {
                    $planDoneCount++
                } else {
                    $planPendingCount++
                    if (-not $currentPlan) { $currentPlan = $plan.BaseName }
                }
            }
        }
    }

    $phasePlanTotal = $planDoneCount + $planPendingCount
    Write-Host "Phase " -NoNewline -ForegroundColor White
    Write-Host "P$currentPhase " -NoNewline -ForegroundColor Yellow
    if ($phaseDirName) {
        $pn = $phaseDirName
        if ($pn.Length -gt 22) { $pn = $pn.Substring(0, 22) + ".." }
        Write-Host "$pn " -NoNewline -ForegroundColor Gray
    }
    if ($phasePlanTotal -gt 0) {
        $phasePct = [math]::Round(($planDoneCount / $phasePlanTotal) * 100)
        $phaseBar = Make-Bar $phasePct 8
        Write-Host "[$phaseBar] " -NoNewline -ForegroundColor Green
        Write-Host "$planDoneCount/$phasePlanTotal " -NoNewline -ForegroundColor White
        Write-Host "($phasePct%)" -ForegroundColor DarkGray
    } else {
        Write-Host ""
    }
    if ($currentPlan) {
        Write-Host "  Sub: " -NoNewline
        $cp = $currentPlan
        if ($cp.Length -gt 50) { $cp = $cp.Substring(0, 50) + ".." }
        Write-Host "$cp " -NoNewline -ForegroundColor Yellow
        Write-Host "(pending)" -ForegroundColor DarkGray
    }

    # Pane width — used to size columns and prevent wrap/scramble
    try { $paneW = [Console]::WindowWidth } catch { $paneW = 80 }
    if ($paneW -lt 40) { $paneW = 40 }

    # WAVES — full list with names, marks done/active/pending from git + activity log
    $waves = @()
    if ($phaseDir) { $waves = Get-Waves $phaseDir.FullName }
    if ($waves.Count -gt 0) {
        $highestDone = Get-WaveStatusFromGit $ProjectDir
        $activeFromLog = Get-ActiveWaveFromLog $activityLog
        # Compute statuses
        foreach ($w in $waves) {
            if ($w.wave -le $highestDone) { $w.status = "done" }
            elseif ($activeFromLog -and $w.wave -eq $activeFromLog) { $w.status = "active" }
            elseif ($w.wave -eq ($highestDone + 1) -and -not $activeFromLog) { $w.status = "active" }
            else { $w.status = "pending" }
        }
        $totalW = $waves.Count
        $doneW  = @($waves | Where-Object { $_.status -eq "done" }).Count
        $actW   = @($waves | Where-Object { $_.status -eq "active" }).Count
        Write-Host "Waves " -NoNewline -ForegroundColor White
        Write-Host "$doneW" -NoNewline -ForegroundColor Green
        Write-Host "/$totalW done " -NoNewline -ForegroundColor DarkGray
        if ($actW -gt 0) {
            Write-Host "$actW active" -ForegroundColor Yellow
        } else {
            Write-Host "(idle)" -ForegroundColor DarkGray
        }
        # One row per wave: marker + W# + name (truncated to pane width)
        $nameWidth = $paneW - 10
        if ($nameWidth -lt 12) { $nameWidth = 12 }
        foreach ($w in $waves) {
            $marker = switch ($w.status) {
                "done"   { "v" }
                "active" { ">" }
                default  { "." }
            }
            $mc = switch ($w.status) {
                "done"   { "Green" }
                "active" { "Yellow" }
                default  { "DarkGray" }
            }
            $nm = $w.name
            if ($nm.Length -gt $nameWidth) { $nm = $nm.Substring(0, $nameWidth - 2) + ".." }
            Write-Host "  $marker " -NoNewline -ForegroundColor $mc
            Write-Host "W$($w.wave) " -NoNewline -ForegroundColor $mc
            Write-Host $nm -ForegroundColor Gray
        }
    }

    # ORCHESTRATOR PULSE — last commit + last log entry + recent commit velocity
    $pulse = Get-OrchestratorPulse $ProjectDir $activityLog
    Write-Host "Pulse " -NoNewline -ForegroundColor White
    function Format-Age($s) {
        if ($null -eq $s) { return "--" }
        if ($s -lt 60) { return "${s}s" }
        if ($s -lt 3600) { return "$([math]::Floor($s/60))m" }
        return "$([math]::Floor($s/3600))h"
    }
    $commitColor = if ($pulse.lastCommitAgo -lt 300) { "Green" }
                   elseif ($pulse.lastCommitAgo -lt 1800) { "Yellow" }
                   else { "DarkGray" }
    $actColor = if ($pulse.lastActivityAgo -lt 60) { "Green" }
                elseif ($pulse.lastActivityAgo -lt 300) { "Yellow" }
                else { "DarkGray" }
    Write-Host "commit:" -NoNewline -ForegroundColor DarkGray
    Write-Host "$(Format-Age $pulse.lastCommitAgo) " -NoNewline -ForegroundColor $commitColor
    Write-Host "act:" -NoNewline -ForegroundColor DarkGray
    Write-Host "$(Format-Age $pulse.lastActivityAgo) " -NoNewline -ForegroundColor $actColor
    Write-Host "1h:" -NoNewline -ForegroundColor DarkGray
    Write-Host "$($pulse.commits1hr)c " -NoNewline -ForegroundColor White
    Write-Host "5m:" -NoNewline -ForegroundColor DarkGray
    Write-Host "$($pulse.commits5min)c" -ForegroundColor White

    # AGENT ROSTER — last 6h, up to 10 agents, width-aware truncation
    $roster = Get-AgentRoster $activityLog 21600
    Write-Host "Agents " -NoNewline -ForegroundColor White
    if ($roster.Count -eq 0) {
        Write-Host "(none recent)" -ForegroundColor DarkGray
    } else {
        $cActive = @($roster | Where-Object { $_.status -eq "ACTIVE" }).Count
        $cIdle   = @($roster | Where-Object { $_.status -eq "IDLE" }).Count
        $cRecent = @($roster | Where-Object { $_.status -eq "RECENT" }).Count
        $cOlder  = @($roster | Where-Object { $_.status -eq "OLDER" }).Count
        Write-Host "$($roster.Count) " -NoNewline -ForegroundColor White
        Write-Host "($cActive active, $cIdle idle, $cRecent recent, $cOlder older)" -ForegroundColor DarkGray
        # Layout: "  NAME(14) STATUS(7) AGE(4) DETAIL"
        # Reserve cols: 2 indent + 14 name + 1 + 7 status + 1 + 4 age + 1 = 30 used
        $detailW = $paneW - 30
        if ($detailW -lt 12) { $detailW = 12 }
        foreach ($ag in $roster) {
            $sc = switch ($ag.status) {
                "ACTIVE" { "Green" }
                "IDLE"   { "Yellow" }
                "RECENT" { "Cyan" }
                default  { "DarkGray" }
            }
            $ageStr = (Format-Age $ag.ageSec).PadLeft(4)
            $nm = $ag.name
            if ($nm.Length -gt 14) { $nm = $nm.Substring(0, 13) + "." }
            $nm = $nm.PadRight(14)
            $stStr = $ag.status.PadRight(7)
            $detail = $ag.target
            if ($detail -match '^[a-zA-Z][\w-]+\s*[:\[]\s*(.*)$') { $detail = $matches[1] }
            $detail = $detail -replace '\s+', ' '
            if ($detail.Length -gt $detailW) { $detail = $detail.Substring(0, $detailW - 2) + ".." }
            Write-Host "  " -NoNewline
            Write-Host $nm -NoNewline -ForegroundColor Magenta
            Write-Host " " -NoNewline
            Write-Host $stStr -NoNewline -ForegroundColor $sc
            Write-Host " " -NoNewline
            Write-Host $ageStr -NoNewline -ForegroundColor DarkGray
            Write-Host " " -NoNewline
            Write-Host $detail -ForegroundColor Gray
        }
    }

    # BLOCKERS + TODOS + REQS (compact, 1-3 lines)
    $blockers = Get-Blockers $stateFile
    $todos = Get-Todos $ProjectDir
    $reqs = Get-RequirementsProgress $ProjectDir

    $summaryParts = @()
    if ($blockers.Count -gt 0) {
        $summaryParts += "! BLOCK:$($blockers.Count)"
    }
    if ($todos.Count -gt 0) {
        $summaryParts += "TODO:$($todos.Count)"
    }
    if ($reqs -and $reqs.total -gt 0) {
        $reqPct = [math]::Round(($reqs.done / $reqs.total) * 100)
        $summaryParts += "REQ:$($reqs.done)/$($reqs.total)($reqPct%)"
    }
    if ($summaryParts.Count -gt 0) {
        Write-Host ($summaryParts -join "  ") -ForegroundColor White
    }

    # Top blocker inline (if any)
    if ($blockers.Count -gt 0) {
        $b = $blockers[0]
        if ($b.Length -gt 58) { $b = $b.Substring(0, 58) + ".." }
        Write-Host "  ! " -NoNewline -ForegroundColor Red
        Write-Host $b -ForegroundColor White
    }

    # CHECKPOINT (1 line if exists)
    if (Test-Path $checkpointFile) {
        $nextUnit = Get-Value $checkpointFile "next_unit"
        if ($nextUnit) {
            $nu = $nextUnit
            if ($nu.Length -gt 55) { $nu = $nu.Substring(0, 55) + ".." }
            Write-Host "CKPT -> " -NoNewline -ForegroundColor Yellow
            Write-Host $nu -ForegroundColor Gray
        }
    }

    # PHASE BREAKDOWN (compact - 1 or 2 lines showing last 8 phases)
    $phaseList = Get-PhaseBreakdown $ProjectDir
    $withPlans = @($phaseList | Where-Object { $_.total -gt 0 })
    if ($withPlans.Count -gt 0) {
        $lastPhases = $withPlans | Select-Object -Last 10
        Write-Host "Phases: " -NoNewline -ForegroundColor White
        foreach ($p in $lastPhases) {
            $marker = if ($p.pct -eq 100) { "v" } elseif ($p.pct -gt 0) { "~" } else { "." }
            $mcolor = if ($p.pct -eq 100) { "Green" } elseif ($p.pct -gt 0) { "Yellow" } else { "DarkGray" }
            Write-Host "P$($p.num)" -NoNewline -ForegroundColor $mcolor
            Write-Host "$marker " -NoNewline -ForegroundColor $mcolor
        }
        Write-Host ""
    }

    # TOKENS + DOLLAR (1 line)
    $tokens = Get-TokenStats $tokenLog
    if ($tokens.total -gt 0) {
        $opusD = Format-Dollar ($tokens.opus * $RATE_OPUS)
        $sonnetD = Format-Dollar ($tokens.sonnet * $RATE_SONNET)
        $haikuD = Format-Dollar ($tokens.haiku * $RATE_HAIKU)
        $totalD = Format-Dollar $tokens.cost

        Write-Host "Tokens " -NoNewline -ForegroundColor White
        Write-Host "O:" -NoNewline -ForegroundColor DarkGray
        Write-Host "$(Format-Num $tokens.opus) " -NoNewline -ForegroundColor Magenta
        Write-Host "S:" -NoNewline -ForegroundColor DarkGray
        Write-Host "$(Format-Num $tokens.sonnet) " -NoNewline -ForegroundColor Blue
        Write-Host "H:" -NoNewline -ForegroundColor DarkGray
        Write-Host "$(Format-Num $tokens.haiku) " -NoNewline -ForegroundColor Cyan
        Write-Host "= " -NoNewline -ForegroundColor DarkGray
        Write-Host "$(Format-Num $tokens.total) " -NoNewline -ForegroundColor Yellow
        Write-Host "($totalD)" -ForegroundColor Green
    }

    # MC-05: Multimodal Review Offload tile (D-07 metrics from codex-log.jsonl)
    $msStartTs = $null
    if (Test-Path $stateFile) {
        $sfLines = Get-Content $stateFile -TotalCount 30 -ErrorAction SilentlyContinue
        $msLine = $sfLines | Where-Object { $_ -match '^milestone_start:\s*(.+)' } | Select-Object -First 1
        if ($msLine -match '^milestone_start:\s*(.+)') { $msStartTs = $Matches[1].Trim() }
    }
    $codexLog = Join-Path $ProjectDir ".planning\metrics\codex-log.jsonl"
    $cx = Get-CodexStats $codexLog $msStartTs
    $cxAvgSec  = if ($cx.invocations -gt 0) { [math]::Round($cx.totalDurationMs / $cx.invocations / 1000, 1) } else { 0 }
    $cxFbRate  = if ($cx.invocations -gt 0) { [math]::Round(($cx.fallbacks / $cx.invocations) * 100) } else { 0 }
    $cxSavedK  = [math]::Round($cx.claudeTokensSaved / 1000)
    W-Line { Write-Host "" }
    W-Line { Write-Host " MultimodalReview Offload" -ForegroundColor Cyan }
    W-Line { Write-Host ("  inv:" + $cx.invocations + "  fb:" + $cxFbRate + "%  avg:" + $cxAvgSec + "s  saved:" + $cxSavedK + "k tok") -ForegroundColor DarkCyan }

    # RECENT COMMITS (3 lines)
    Push-Location $ProjectDir -ErrorAction SilentlyContinue
    try {
        $commits = & git log --oneline -3 2>$null
        if ($commits) {
            Write-Host "Commits " -ForegroundColor White
            foreach ($c in $commits) {
                $parts = $c -split ' ', 2
                if ($parts.Count -eq 2) {
                    Write-Host "  $($parts[0].Substring(0, [Math]::Min(7, $parts[0].Length))) " -NoNewline -ForegroundColor Cyan
                    $msg = $parts[1]
                    if ($msg.Length -gt 55) { $msg = $msg.Substring(0, 55) + ".." }
                    Write-Host $msg -ForegroundColor Gray
                }
            }
        }
    } catch {}
    Pop-Location -ErrorAction SilentlyContinue

    # Pad remaining space with blank lines so refresh overwrites cleanly
    try {
        $currentY = [Console]::CursorTop
        $windowH = [Console]::WindowHeight
        $linesLeft = $windowH - $currentY - 1
        for ($i = 0; $i -lt $linesLeft; $i++) {
            Write-Host (" " * ([Console]::WindowWidth - 1))
        }
    } catch {}

    # Live update: wait for file change OR heartbeat timeout
    $global:needsRedraw = $false
    $elapsed = 0
    while ($elapsed -lt $RefreshSec -and -not $global:needsRedraw) {
        Start-Sleep -Milliseconds 500
        $elapsed += 0.5
    }
}
