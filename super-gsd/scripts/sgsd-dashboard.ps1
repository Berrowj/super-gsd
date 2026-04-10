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

while ($true) {
    [Console]::Write("$HOME_POS$CLEAR_BELOW")

    # HEADER
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "           SUPER GSD -- PROJECT DASHBOARD                       " -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host (Get-Date -Format 'HH:mm:ss') -NoNewline -ForegroundColor DarkGray
    Write-Host " | refresh ${RefreshSec}s | Ctrl+C to quit" -ForegroundColor DarkGray
    Write-Host ""

    # STATE FILES
    $stateFile = Join-Path $ProjectDir ".planning\STATE.md"
    $roadmapFile = Join-Path $ProjectDir ".planning\ROADMAP.md"
    $checkpointFile = Join-Path $ProjectDir ".planning\ORCHESTRATOR-CHECKPOINT.md"
    $tokenLog = Join-Path $ProjectDir ".planning\metrics\token-log.jsonl"
    $activityLog = Join-Path $ProjectDir ".planning\metrics\activity-log.jsonl"

    # MILESTONE
    $milestone = Get-Value $stateFile "milestone"
    $milestoneName = Get-Value $stateFile "milestone_name"
    $currentPhase = Get-Value $stateFile "current_phase"
    $status = Get-Value $stateFile "status"

    if (-not $milestone) { $milestone = "?" }
    if (-not $currentPhase) { $currentPhase = "?" }
    if (-not $status) { $status = "?" }

    Write-Host "MILESTONE " -NoNewline -ForegroundColor White
    Write-Host "$milestone " -NoNewline -ForegroundColor Yellow
    if ($milestoneName) { Write-Host "- $milestoneName" -ForegroundColor Gray } else { Write-Host "" }

    # Progress from ROADMAP
    $totalPhases = 0; $donePhases = 0
    if (Test-Path $roadmapFile) {
        $roadmapText = Get-Content $roadmapFile -Raw -ErrorAction SilentlyContinue
        if ($roadmapText) {
            $totalPhases = ([regex]::Matches($roadmapText, '(?m)^- \[')).Count
            $donePhases = ([regex]::Matches($roadmapText, '(?m)^- \[x\]')).Count
        }
    }

    if ($totalPhases -gt 0) {
        $pct = [math]::Round(($donePhases / $totalPhases) * 100)
        $bar = Make-Bar $pct 20
        Write-Host "Progress: " -NoNewline
        Write-Host "[$bar] " -NoNewline -ForegroundColor Green
        Write-Host "$donePhases/$totalPhases ($pct%)" -ForegroundColor White
    }
    Write-Host "Status:   " -NoNewline
    Write-Host $status -ForegroundColor White
    Write-Host ""

    # CURRENT PHASE
    Write-Host "CURRENT PHASE " -NoNewline -ForegroundColor White
    Write-Host $currentPhase -ForegroundColor Yellow

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
            $phaseDirName = $phaseDir.Name
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

    if ($phaseDirName) {
        Write-Host "  Name:   " -NoNewline
        Write-Host $phaseDirName -ForegroundColor Gray
    }
    if ($currentPlan) {
        Write-Host "  Sub:    " -NoNewline
        Write-Host $currentPlan -NoNewline -ForegroundColor Yellow
        Write-Host " (pending)" -ForegroundColor DarkGray
    }
    $phasePlanTotal = $planDoneCount + $planPendingCount
    if ($phasePlanTotal -gt 0) {
        $phasePct = [math]::Round(($planDoneCount / $phasePlanTotal) * 100)
        $phaseBar = Make-Bar $phasePct 10
        Write-Host "  Plans:  " -NoNewline
        Write-Host "[$phaseBar] " -NoNewline -ForegroundColor Green
        Write-Host "$planDoneCount/$phasePlanTotal ($phasePct%)" -ForegroundColor White
    }
    Write-Host ""

    # PHASE BREAKDOWN (all phases with % complete)
    $phaseList = Get-PhaseBreakdown $ProjectDir
    if ($phaseList.Count -gt 0) {
        Write-Host "PHASE BREAKDOWN" -ForegroundColor White
        # Show only phases with plans, up to 8 most recent
        $withPlans = $phaseList | Where-Object { $_.total -gt 0 } | Select-Object -Last 8
        foreach ($p in $withPlans) {
            $bar = Make-Bar $p.pct 10
            $color = if ($p.pct -eq 100) { "Green" } elseif ($p.pct -gt 0) { "Yellow" } else { "DarkGray" }
            Write-Host "  P$($p.num.PadLeft(2)) " -NoNewline -ForegroundColor $color
            Write-Host "[$bar] " -NoNewline -ForegroundColor $color
            Write-Host "$($p.done)/$($p.total) " -NoNewline
            $shortName = $p.name
            if ($shortName.Length -gt 28) { $shortName = $shortName.Substring(0, 28) + ".." }
            Write-Host $shortName -ForegroundColor Gray
        }
        Write-Host ""
    }

    # ACTIVE AGENT
    Write-Host "ACTIVE AGENT" -ForegroundColor White
    if (Test-Path $activityLog) {
        $recentLines = Get-Content $activityLog -Tail 10 -ErrorAction SilentlyContinue
        $agentContext = ""
        $lastTool = ""
        $lastTs = $null

        if ($recentLines) {
            [array]::Reverse($recentLines)
            foreach ($line in $recentLines) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    if (-not $lastTool) {
                        $lastTool = $e.tool
                        $lastTs = [DateTime]::Parse($e.ts)
                    }
                    if ($e.tool -eq "TaskCreate" -or $e.tool -eq "Agent") {
                        $agentContext = $e.target
                        break
                    }
                } catch {}
            }
        }

        if ($agentContext) {
            Write-Host "  Context: " -NoNewline
            $ctx = $agentContext
            if ($ctx.Length -gt 55) { $ctx = $ctx.Substring(0, 55) + ".." }
            Write-Host $ctx -ForegroundColor Magenta
        } else {
            Write-Host "  Context: " -NoNewline
            Write-Host "(no task context)" -ForegroundColor DarkGray
        }

        if ($lastTs) {
            $age = [int]((Get-Date) - $lastTs).TotalSeconds
            $ageStr = if ($age -lt 60) { "${age}s ago" }
                      elseif ($age -lt 3600) { "$([math]::Floor($age/60))m ago" }
                      else { "$([math]::Floor($age/3600))h ago" }
            Write-Host "  Last:    " -NoNewline
            Write-Host "$ageStr ($lastTool)" -ForegroundColor DarkGray
            Write-Host "  Status:  " -NoNewline
            if ($age -lt 30) { Write-Host "ACTIVE" -ForegroundColor Green }
            elseif ($age -lt 300) { Write-Host "IDLE" -ForegroundColor Yellow }
            else { Write-Host "STOPPED" -ForegroundColor Red }
        }
    }
    Write-Host ""

    # BLOCKERS
    $blockers = Get-Blockers $stateFile
    if ($blockers.Count -gt 0) {
        Write-Host "BLOCKERS " -NoNewline -ForegroundColor Red
        Write-Host "($($blockers.Count))" -ForegroundColor DarkGray
        foreach ($b in $blockers | Select-Object -First 5) {
            $short = $b
            if ($short.Length -gt 60) { $short = $short.Substring(0, 60) + ".." }
            Write-Host "  ! " -NoNewline -ForegroundColor Red
            Write-Host $short -ForegroundColor White
        }
        Write-Host ""
    }

    # TODOS
    $todos = Get-Todos $ProjectDir
    if ($todos.Count -gt 0) {
        Write-Host "TODOS " -NoNewline -ForegroundColor White
        Write-Host "($($todos.Count) pending)" -ForegroundColor DarkGray
        foreach ($t in $todos | Select-Object -First 5) {
            $short = $t
            if ($short.Length -gt 60) { $short = $short.Substring(0, 60) + ".." }
            Write-Host "  - " -NoNewline -ForegroundColor Yellow
            Write-Host $short -ForegroundColor Gray
        }
        if ($todos.Count -gt 5) {
            Write-Host "  ... +$($todos.Count - 5) more" -ForegroundColor DarkGray
        }
        Write-Host ""
    }

    # REQUIREMENTS
    $reqs = Get-RequirementsProgress $ProjectDir
    if ($reqs -and $reqs.total -gt 0) {
        $reqPct = [math]::Round(($reqs.done / $reqs.total) * 100)
        $reqBar = Make-Bar $reqPct 20
        Write-Host "REQUIREMENTS" -ForegroundColor White
        Write-Host "  " -NoNewline
        Write-Host "[$reqBar] " -NoNewline -ForegroundColor Green
        Write-Host "$($reqs.done)/$($reqs.total) ($reqPct%)" -ForegroundColor White
        Write-Host ""
    }

    # CHECKPOINT
    if (Test-Path $checkpointFile) {
        Write-Host "CHECKPOINT" -ForegroundColor Yellow
        $lastCompleted = Get-Value $checkpointFile "last_completed"
        $nextUnit = Get-Value $checkpointFile "next_unit"
        if ($lastCompleted) {
            $lc = $lastCompleted
            if ($lc.Length -gt 55) { $lc = $lc.Substring(0, 55) + ".." }
            Write-Host "  Last: " -NoNewline -ForegroundColor DarkGray
            Write-Host $lc -ForegroundColor Gray
        }
        if ($nextUnit) {
            $nu = $nextUnit
            if ($nu.Length -gt 55) { $nu = $nu.Substring(0, 55) + ".." }
            Write-Host "  Next: " -NoNewline -ForegroundColor DarkGray
            Write-Host $nu -ForegroundColor Gray
        }
        Write-Host ""
    }

    # TOKEN USAGE + DOLLAR COST
    $tokens = Get-TokenStats $tokenLog
    if ($tokens.total -gt 0) {
        Write-Host "TOKENS " -NoNewline -ForegroundColor White
        Write-Host "(~equivalent API cost)" -ForegroundColor DarkGray

        $opusDollar = $tokens.opus * $RATE_OPUS
        $sonnetDollar = $tokens.sonnet * $RATE_SONNET
        $haikuDollar = $tokens.haiku * $RATE_HAIKU

        Write-Host "  Opus:   " -NoNewline -ForegroundColor Magenta
        Write-Host (Format-Num $tokens.opus).PadRight(8) -NoNewline
        Write-Host (Format-Dollar $opusDollar) -ForegroundColor DarkGray

        Write-Host "  Sonnet: " -NoNewline -ForegroundColor Blue
        Write-Host (Format-Num $tokens.sonnet).PadRight(8) -NoNewline
        Write-Host (Format-Dollar $sonnetDollar) -ForegroundColor DarkGray

        Write-Host "  Haiku:  " -NoNewline -ForegroundColor Cyan
        Write-Host (Format-Num $tokens.haiku).PadRight(8) -NoNewline
        Write-Host (Format-Dollar $haikuDollar) -ForegroundColor DarkGray

        Write-Host "  ------" -ForegroundColor DarkGray
        Write-Host "  Total:  " -NoNewline -ForegroundColor White
        Write-Host (Format-Num $tokens.total).PadRight(8) -NoNewline -ForegroundColor Yellow
        Write-Host (Format-Dollar $tokens.cost) -ForegroundColor Green
        Write-Host "  " -NoNewline
        Write-Host "(Max plan: $0 actual cost)" -ForegroundColor DarkGray
        Write-Host ""
    }

    # RECENT COMMITS
    Write-Host "RECENT COMMITS" -ForegroundColor White
    Push-Location $ProjectDir -ErrorAction SilentlyContinue
    try {
        $commits = & git log --oneline -5 2>$null
        if ($commits) {
            foreach ($c in $commits) {
                $parts = $c -split ' ', 2
                if ($parts.Count -eq 2) {
                    Write-Host "  $($parts[0]) " -NoNewline -ForegroundColor Cyan
                    $msg = $parts[1]
                    if ($msg.Length -gt 58) { $msg = $msg.Substring(0, 58) + ".." }
                    Write-Host $msg -ForegroundColor Gray
                }
            }
        }
    } catch {}
    Pop-Location -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "================================================================" -ForegroundColor DarkGray

    Start-Sleep -Seconds $RefreshSec
}
