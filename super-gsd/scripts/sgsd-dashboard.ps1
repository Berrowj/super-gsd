# Super GSD Project Dashboard — Wide Project View
# Shows: milestone, phase, sub-phase, active agent, blockers, tokens, commits
# Refreshes every 10 seconds.
#
# Usage:
#   .\sgsd-dashboard.ps1                                # current directory
#   .\sgsd-dashboard.ps1 -ProjectDir ~\project-clarity-erp
#   .\sgsd-dashboard.ps1 -RefreshSec 5                  # faster refresh

param(
    [string]$ProjectDir = ".",
    [int]$RefreshSec = 10
)

if (-not (Test-Path (Join-Path $ProjectDir ".planning"))) {
    Write-Host "ERROR: No .planning/ directory in $ProjectDir" -ForegroundColor Red
    exit 1
}

# Resolve to absolute path so Git commands work
$ProjectDir = (Resolve-Path $ProjectDir).Path

function Get-StateValue($file, $key) {
    if (Test-Path $file) {
        $match = Select-String -Path $file -Pattern "^${key}:\s*(.*)$" -List
        if ($match) { return $match.Matches.Groups[1].Value.Trim() }
    }
    return ""
}

function Format-Tokens($n) {
    if ($n -lt 1000) { return "$n" }
    if ($n -lt 1000000) { return "$([math]::Round($n/1000))K" }
    return "$([math]::Round($n/1000000, 1))M"
}

function Get-CurrentSubPhase($projectDir, $phase) {
    # Find the most recent pending plan for the current phase
    $phaseDir = Get-ChildItem -Path (Join-Path $projectDir ".planning\phases") -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match "^${phase}-" } | Select-Object -First 1

    if (-not $phaseDir) { return $null }

    $result = @{
        dir = $phaseDir.Name
        phaseName = $phaseDir.Name -replace "^\d+-", ""
        plans = @()
        pendingCount = 0
        doneCount = 0
        currentPlan = $null
    }

    Get-ChildItem -Path $phaseDir.FullName -Filter "*-PLAN.md" | Sort-Object Name | ForEach-Object {
        $planName = $_.BaseName
        $summaryPath = $_.FullName -replace 'PLAN\.md$', 'SUMMARY.md'
        $isDone = Test-Path $summaryPath

        $result.plans += @{ name = $planName; done = $isDone }
        if ($isDone) {
            $result.doneCount++
        } else {
            $result.pendingCount++
            if (-not $result.currentPlan) { $result.currentPlan = $planName }
        }
    }

    return $result
}

function Get-RecentActivity($projectDir) {
    # Read last 3 entries from activity log to find what's being worked on right now
    $logPath = Join-Path $projectDir ".planning\metrics\activity-log.jsonl"
    if (-not (Test-Path $logPath)) { return $null }

    $lines = Get-Content $logPath -Tail 5 -ErrorAction SilentlyContinue
    if (-not $lines) { return $null }

    # Find most recent TaskCreate (agent context) or regular tool call
    [Array]::Reverse($lines)
    foreach ($line in $lines) {
        try {
            $e = $line | ConvertFrom-Json
            if ($e.tool -eq "TaskCreate" -or $e.tool -eq "Agent") {
                return @{
                    context = $e.target
                    tool = $e.tool
                    ts = [DateTime]::Parse($e.ts)
                    phase = $e.phase
                }
            }
        } catch {}
    }

    # Fall back to most recent tool call
    try {
        $e = $lines[0] | ConvertFrom-Json
        return @{
            context = "$($e.tool): $($e.target)"
            tool = $e.tool
            ts = [DateTime]::Parse($e.ts)
            phase = $e.phase
        }
    } catch {}

    return $null
}

function Get-Blockers($projectDir) {
    # Extract blockers from STATE.md
    $stateFile = Join-Path $projectDir ".planning\STATE.md"
    if (-not (Test-Path $stateFile)) { return @() }

    $content = Get-Content $stateFile -Raw
    $blockers = @()

    # Look for blockers section
    if ($content -match "(?s)##\s*Blockers?[^`n]*`n(.*?)(?=`n##|`n---|\z)") {
        $section = $matches[1]
        $section -split "`n" | ForEach-Object {
            $line = $_.Trim()
            if ($line -and $line -notmatch "^(None|-+|\*+|$)" -and $line -match "^[-*]\s*(.+)") {
                $blockers += $matches[1]
            }
        }
    }

    return $blockers
}

while ($true) {
    Clear-Host

    # Header
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "            SUPER GSD -- PROJECT DASHBOARD                      " -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    $timeStr = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Write-Host "$timeStr | Refresh: ${RefreshSec}s | Ctrl+C to quit" -ForegroundColor DarkGray
    Write-Host ""

    # Milestone + Progress
    $stateFile = Join-Path $ProjectDir ".planning\STATE.md"
    $roadmapFile = Join-Path $ProjectDir ".planning\ROADMAP.md"

    $milestone = Get-StateValue $stateFile "milestone"
    $milestoneName = Get-StateValue $stateFile "milestone_name"
    $currentPhase = Get-StateValue $stateFile "current_phase"
    $status = Get-StateValue $stateFile "status"

    $total = 0; $done = 0
    if (Test-Path $roadmapFile) {
        $content = Get-Content $roadmapFile -Raw
        $total = ([regex]::Matches($content, '^- \[', 'Multiline')).Count
        $done = ([regex]::Matches($content, '^- \[x\]', 'Multiline')).Count
    }

    # MILESTONE BLOCK
    Write-Host "MILESTONE " -NoNewline -ForegroundColor White
    Write-Host "$milestone " -NoNewline -ForegroundColor Yellow
    if ($milestoneName) { Write-Host "- $milestoneName" -ForegroundColor DarkGray }
    else { Write-Host "" }

    if ($total -gt 0) {
        $pct = [math]::Round(($done / $total) * 100)
        $filled = [math]::Round($pct / 5)
        $empty = 20 - $filled
        $bar = ('#' * $filled) + ('-' * $empty)
        Write-Host "Progress: " -NoNewline
        Write-Host "[$bar] " -NoNewline -ForegroundColor Green
        Write-Host "$done/$total phases ($pct%)" -ForegroundColor White
    }
    Write-Host "Status:   " -NoNewline
    Write-Host $status -ForegroundColor White
    Write-Host ""

    # CURRENT PHASE BLOCK
    Write-Host "CURRENT PHASE" -ForegroundColor White
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray

    $subPhase = Get-CurrentSubPhase $ProjectDir $currentPhase
    if ($subPhase) {
        Write-Host "Phase:    " -NoNewline
        Write-Host "$currentPhase " -NoNewline -ForegroundColor Yellow
        Write-Host "- $($subPhase.phaseName)" -ForegroundColor Gray
        Write-Host "Sub:      " -NoNewline
        if ($subPhase.currentPlan) {
            Write-Host $subPhase.currentPlan -ForegroundColor Yellow -NoNewline
            Write-Host "  (pending)" -ForegroundColor DarkGray
        } else {
            Write-Host "(all plans complete)" -ForegroundColor Green
        }
        Write-Host "Plans:    " -NoNewline
        Write-Host "$($subPhase.doneCount) done" -NoNewline -ForegroundColor Green
        Write-Host " / " -NoNewline
        Write-Host "$($subPhase.pendingCount) pending" -ForegroundColor Yellow
    } else {
        Write-Host "Phase: $currentPhase (no directory found)" -ForegroundColor DarkGray
    }
    Write-Host ""

    # ACTIVE AGENT BLOCK
    Write-Host "ACTIVE AGENT" -ForegroundColor White
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray

    $activity = Get-RecentActivity $ProjectDir
    if ($activity) {
        $age = [math]::Round(((Get-Date) - $activity.ts).TotalSeconds)
        $ageStr = if ($age -lt 60) { "${age}s ago" }
                  elseif ($age -lt 3600) { "$([math]::Round($age/60))m ago" }
                  else { "$([math]::Round($age/3600, 1))h ago" }

        Write-Host "Context:  " -NoNewline
        Write-Host $activity.context -ForegroundColor Magenta
        Write-Host "Last:     " -NoNewline
        Write-Host "$ageStr " -NoNewline -ForegroundColor DarkGray
        Write-Host "($($activity.tool))" -ForegroundColor DarkGray

        if ($age -gt 60) {
            Write-Host "Status:   " -NoNewline
            Write-Host "IDLE" -ForegroundColor Yellow -NoNewline
            Write-Host " (no activity in ${age}s)" -ForegroundColor DarkGray
        } else {
            Write-Host "Status:   " -NoNewline
            Write-Host "ACTIVE" -ForegroundColor Green
        }
    } else {
        Write-Host "  No activity yet" -ForegroundColor DarkGray
    }
    Write-Host ""

    # BLOCKERS BLOCK
    $blockers = Get-Blockers $ProjectDir
    if ($blockers.Count -gt 0) {
        Write-Host "BLOCKERS" -ForegroundColor Red
        Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
        foreach ($blocker in $blockers) {
            Write-Host "  ! " -NoNewline -ForegroundColor Red
            Write-Host $blocker -ForegroundColor White
        }
        Write-Host ""
    }

    # CHECKPOINT STATUS
    $checkpoint = Join-Path $ProjectDir ".planning\ORCHESTRATOR-CHECKPOINT.md"
    if (Test-Path $checkpoint) {
        Write-Host "CHECKPOINT ACTIVE" -ForegroundColor Yellow
        Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
        $lastCompleted = Get-StateValue $checkpoint "last_completed"
        $nextUnit = Get-StateValue $checkpoint "next_unit"
        Write-Host "  Last: " -NoNewline -ForegroundColor DarkGray
        Write-Host $lastCompleted -ForegroundColor Gray
        Write-Host "  Next: " -NoNewline -ForegroundColor DarkGray
        Write-Host $nextUnit -ForegroundColor Gray
        Write-Host ""
    }

    # TOKEN TOTALS
    $tokenLog = Join-Path $ProjectDir ".planning\metrics\token-log.jsonl"
    if (Test-Path $tokenLog) {
        $lines = Get-Content $tokenLog -ErrorAction SilentlyContinue
        if ($lines) {
            $opus = 0; $sonnet = 0; $haiku = 0
            foreach ($line in $lines) {
                try {
                    $e = $line | ConvertFrom-Json
                    $m = $e.model.ToLower()
                    if ($m -eq "opus") { $opus += [int]$e.total }
                    elseif ($m -eq "sonnet") { $sonnet += [int]$e.total }
                    elseif ($m -eq "haiku") { $haiku += [int]$e.total }
                } catch {}
            }
            $totalTokens = $opus + $sonnet + $haiku
            if ($totalTokens -gt 0) {
                Write-Host "TOKEN USAGE" -ForegroundColor White
                Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
                Write-Host "  Opus:   " -ForegroundColor Magenta -NoNewline
                Write-Host (Format-Tokens $opus)
                Write-Host "  Sonnet: " -ForegroundColor Blue -NoNewline
                Write-Host (Format-Tokens $sonnet)
                Write-Host "  Haiku:  " -ForegroundColor Cyan -NoNewline
                Write-Host (Format-Tokens $haiku)
                Write-Host "  Total:  " -NoNewline -ForegroundColor White
                Write-Host (Format-Tokens $totalTokens) -ForegroundColor Yellow
                Write-Host ""
            }
        }
    }

    # PHASE PLANS
    if ($subPhase -and $subPhase.plans.Count -gt 0) {
        Write-Host "PHASE PLANS " -NoNewline -ForegroundColor White
        Write-Host "($($subPhase.dir))" -ForegroundColor DarkGray
        Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
        foreach ($plan in $subPhase.plans) {
            if ($plan.done) {
                Write-Host "  [done]    " -NoNewline -ForegroundColor Green
            } else {
                Write-Host "  [pending] " -NoNewline -ForegroundColor Yellow
            }
            Write-Host $plan.name
        }
        Write-Host ""
    }

    # RECENT COMMITS
    Write-Host "RECENT COMMITS" -ForegroundColor White
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
    Push-Location $ProjectDir
    try {
        $commits = git log --oneline -5 2>$null
        if ($commits) {
            $commits | ForEach-Object {
                $parts = $_ -split ' ', 2
                Write-Host "  $($parts[0]) " -NoNewline -ForegroundColor Cyan
                $msg = $parts[1]
                if ($msg.Length -gt 70) { $msg = $msg.Substring(0, 70) + "..." }
                Write-Host $msg -ForegroundColor Gray
            }
        }
    } catch {}
    Pop-Location

    Write-Host ""
    Write-Host "================================================================" -ForegroundColor DarkGray
    Write-Host "Project: $ProjectDir" -ForegroundColor DarkGray

    Start-Sleep -Seconds $RefreshSec
}
