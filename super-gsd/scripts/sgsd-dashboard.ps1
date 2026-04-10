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

Clear-Host
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
    # Reset cursor to top (no Clear-Host, preserves scroll)
    try {
        if (-not $firstRun) {
            [Console]::SetCursorPosition(0, 0)
        }
        $firstRun = $false
    } catch {
        # Fallback if console doesn't support SetCursorPosition
        Clear-Host
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

    # ACTIVE AGENT (1 line)
    $agentStr = ""
    $statusStr = ""
    $statusColor = "DarkGray"
    if (Test-Path $activityLog) {
        $recentLines = Get-Content $activityLog -Tail 10 -ErrorAction SilentlyContinue
        if ($recentLines) {
            [array]::Reverse($recentLines)
            $lastTs = $null
            $lastTool = ""
            foreach ($line in $recentLines) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    if (-not $lastTool) {
                        $lastTool = $e.tool
                        $lastTs = [DateTime]::Parse($e.ts)
                    }
                    if ($e.tool -eq "TaskCreate" -or $e.tool -eq "Agent") {
                        $agentStr = $e.target
                        break
                    }
                } catch {}
            }
            if ($lastTs) {
                $age = [int]((Get-Date) - $lastTs).TotalSeconds
                $ageStr = if ($age -lt 60) { "${age}s" } elseif ($age -lt 3600) { "$([math]::Floor($age/60))m" } else { "$([math]::Floor($age/3600))h" }
                if ($age -lt 30) { $statusStr = "ACTIVE"; $statusColor = "Green" }
                elseif ($age -lt 300) { $statusStr = "IDLE"; $statusColor = "Yellow" }
                else { $statusStr = "STOPPED"; $statusColor = "Red" }
                $statusStr = "$statusStr ($ageStr)"
            }
        }
    }
    Write-Host "Agent " -NoNewline -ForegroundColor White
    if ($agentStr) {
        $ag = $agentStr
        if ($ag.Length -gt 45) { $ag = $ag.Substring(0, 45) + ".." }
        Write-Host "$ag " -NoNewline -ForegroundColor Magenta
    } else {
        Write-Host "(no context) " -NoNewline -ForegroundColor DarkGray
    }
    Write-Host $statusStr -ForegroundColor $statusColor

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
