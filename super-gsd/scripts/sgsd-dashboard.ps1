# Super GSD Project Dashboard — Bulletproof Version
# Shows: milestone, phase, current plan, active agent, tokens, commits
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

# Resolve path
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

function Get-Value($file, $key) {
    if (-not (Test-Path $file)) { return "" }
    $match = Select-String -Path $file -Pattern "^${key}:" -List -ErrorAction SilentlyContinue
    if ($match) {
        $line = $match.Matches[0].Value
        return ($line -replace "^${key}:\s*", "").Trim().Trim('"')
    }
    return ""
}

function Format-Num($n) {
    if ($n -lt 1000) { return "$n" }
    if ($n -lt 1000000) { return "$([math]::Round($n/1000))K" }
    return "$([math]::Round($n/1000000, 1))M"
}

while ($true) {
    Clear-Host

    # HEADER
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "           SUPER GSD -- PROJECT DASHBOARD                       " -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host (Get-Date -Format 'HH:mm:ss') -NoNewline -ForegroundColor DarkGray
    Write-Host " | refresh: ${RefreshSec}s | Ctrl+C to quit" -ForegroundColor DarkGray
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

    Write-Host "MILESTONE" -ForegroundColor White
    Write-Host "  Version:  " -NoNewline
    Write-Host $milestone -ForegroundColor Yellow
    if ($milestoneName) {
        Write-Host "  Name:     " -NoNewline
        Write-Host $milestoneName -ForegroundColor Gray
    }
    Write-Host "  Status:   " -NoNewline
    Write-Host $status -ForegroundColor White

    # Progress from ROADMAP
    if (Test-Path $roadmapFile) {
        $roadmapText = Get-Content $roadmapFile -Raw -ErrorAction SilentlyContinue
        if ($roadmapText) {
            $totalMatches = [regex]::Matches($roadmapText, '(?m)^- \[')
            $doneMatches = [regex]::Matches($roadmapText, '(?m)^- \[x\]')
            $totalCount = $totalMatches.Count
            $doneCount = $doneMatches.Count

            if ($totalCount -gt 0) {
                $pct = [math]::Round(($doneCount / $totalCount) * 100)
                $filled = [math]::Floor($pct / 5)
                if ($filled -gt 20) { $filled = 20 }
                if ($filled -lt 0) { $filled = 0 }
                $empty = 20 - $filled
                $bar = ('#' * $filled) + ('-' * $empty)

                Write-Host "  Progress: " -NoNewline
                Write-Host "[$bar] " -NoNewline -ForegroundColor Green
                Write-Host "$doneCount/$totalCount ($pct%)" -ForegroundColor White
            }
        }
    }
    Write-Host ""

    # CURRENT PHASE
    Write-Host "CURRENT PHASE" -ForegroundColor White
    Write-Host "  Phase:    " -NoNewline
    Write-Host $currentPhase -ForegroundColor Yellow

    # Find phase directory
    $phasesDir = Join-Path $ProjectDir ".planning\phases"
    $phaseDirName = ""
    $currentPlan = ""
    $planDone = 0
    $planPending = 0

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
                    $planDone++
                } else {
                    $planPending++
                    if (-not $currentPlan) { $currentPlan = $plan.BaseName }
                }
            }
        }
    }

    if ($phaseDirName) {
        Write-Host "  Dir:      " -NoNewline
        Write-Host $phaseDirName -ForegroundColor Gray
    }
    if ($currentPlan) {
        Write-Host "  Sub:      " -NoNewline
        Write-Host $currentPlan -NoNewline -ForegroundColor Yellow
        Write-Host " (pending)" -ForegroundColor DarkGray
    } elseif ($planDone -gt 0) {
        Write-Host "  Sub:      " -NoNewline
        Write-Host "all plans done" -ForegroundColor Green
    }
    Write-Host "  Plans:    " -NoNewline
    Write-Host "$planDone done" -NoNewline -ForegroundColor Green
    Write-Host " / " -NoNewline
    Write-Host "$planPending pending" -ForegroundColor Yellow
    Write-Host ""

    # ACTIVE AGENT (from activity log)
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
            Write-Host "  Context:  " -NoNewline
            Write-Host $agentContext -ForegroundColor Magenta
        } else {
            Write-Host "  Context:  " -NoNewline
            Write-Host "(no task context)" -ForegroundColor DarkGray
        }

        if ($lastTs) {
            $age = [int]((Get-Date) - $lastTs).TotalSeconds
            $ageStr = if ($age -lt 60) { "${age}s ago" }
                      elseif ($age -lt 3600) { "$([math]::Floor($age/60))m ago" }
                      else { "$([math]::Floor($age/3600))h ago" }
            Write-Host "  Last:     " -NoNewline
            Write-Host "$ageStr ($lastTool)" -ForegroundColor DarkGray
            Write-Host "  Status:   " -NoNewline
            if ($age -lt 30) {
                Write-Host "ACTIVE" -ForegroundColor Green
            } elseif ($age -lt 300) {
                Write-Host "IDLE" -ForegroundColor Yellow
            } else {
                Write-Host "STOPPED" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  (no activity log)" -ForegroundColor DarkGray
    }
    Write-Host ""

    # CHECKPOINT
    if (Test-Path $checkpointFile) {
        Write-Host "CHECKPOINT" -ForegroundColor Yellow
        $lastCompleted = Get-Value $checkpointFile "last_completed"
        $nextUnit = Get-Value $checkpointFile "next_unit"
        if ($lastCompleted) {
            Write-Host "  Last:     " -NoNewline -ForegroundColor DarkGray
            Write-Host $lastCompleted -ForegroundColor Gray
        }
        if ($nextUnit) {
            Write-Host "  Next:     " -NoNewline -ForegroundColor DarkGray
            Write-Host $nextUnit -ForegroundColor Gray
        }
        Write-Host ""
    }

    # TOKEN USAGE
    if (Test-Path $tokenLog) {
        $opus = 0; $sonnet = 0; $haiku = 0
        try {
            $tokenLines = Get-Content $tokenLog -ErrorAction SilentlyContinue
            foreach ($line in $tokenLines) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    $m = "$($e.model)".ToLower()
                    $t = [int]$e.total
                    if ($m -eq "opus") { $opus += $t }
                    elseif ($m -eq "sonnet") { $sonnet += $t }
                    elseif ($m -eq "haiku") { $haiku += $t }
                } catch {}
            }
        } catch {}

        $totalT = $opus + $sonnet + $haiku
        if ($totalT -gt 0) {
            Write-Host "TOKENS" -ForegroundColor White
            Write-Host "  Opus:     " -NoNewline -ForegroundColor Magenta
            Write-Host (Format-Num $opus)
            Write-Host "  Sonnet:   " -NoNewline -ForegroundColor Blue
            Write-Host (Format-Num $sonnet)
            Write-Host "  Haiku:    " -NoNewline -ForegroundColor Cyan
            Write-Host (Format-Num $haiku)
            Write-Host "  Total:    " -NoNewline
            Write-Host (Format-Num $totalT) -ForegroundColor Yellow
            Write-Host ""
        }
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
                    if ($msg.Length -gt 60) { $msg = $msg.Substring(0, 60) + "..." }
                    Write-Host $msg -ForegroundColor Gray
                }
            }
        } else {
            Write-Host "  (no git history)" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "  (git error)" -ForegroundColor DarkGray
    }
    Pop-Location -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "================================================================" -ForegroundColor DarkGray

    Start-Sleep -Seconds $RefreshSec
}
