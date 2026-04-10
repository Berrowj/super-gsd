# Super GSD Agent Dashboard — Windows PowerShell
# Live view of agents, activity, and token usage
#
# Usage: .\gsd-agent-dashboard.ps1 [-ProjectDir <path>]

param(
    [string]$ProjectDir = ".",
    [int]$RefreshSec = 10
)

if (-not (Test-Path (Join-Path $ProjectDir ".planning"))) {
    Write-Host "ERROR: No .planning/ directory in $ProjectDir" -ForegroundColor Red
    exit 1
}

function Get-StateValue($file, $key) {
    if (Test-Path $file) {
        $match = Select-String -Path $file -Pattern "^${key}:\s*(.*)$" -List
        if ($match) { return $match.Matches.Groups[1].Value.Trim() }
    }
    return ""
}

function Get-TokenSummary($logFile) {
    if (-not (Test-Path $logFile)) { return @{ opus = 0; sonnet = 0; haiku = 0; total = 0 } }
    $lines = Get-Content $logFile -Tail 50 -ErrorAction SilentlyContinue
    $total = @{ opus = 0; sonnet = 0; haiku = 0 }
    foreach ($line in $lines) {
        try {
            $e = $line | ConvertFrom-Json
            $model = $e.model.ToLower()
            if ($total.ContainsKey($model)) {
                $total[$model] += [int]$e.total
            }
        } catch {}
    }
    $total.total = $total.opus + $total.sonnet + $total.haiku
    return $total
}

function Format-Tokens($n) {
    if ($n -lt 1000) { return "$n" }
    if ($n -lt 1000000) { return "$([math]::Round($n/1000))K" }
    return "$([math]::Round($n/1000000, 1))M"
}

while ($true) {
    Clear-Host

    # Header
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "              SUPER GSD -- AGENT DASHBOARD                      " -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | Refreshes every ${RefreshSec}s | Ctrl+C to quit" -ForegroundColor DarkGray
    Write-Host ""

    # Milestone + Progress
    $stateFile = Join-Path $ProjectDir ".planning\STATE.md"
    $roadmapFile = Join-Path $ProjectDir ".planning\ROADMAP.md"

    $milestone = Get-StateValue $stateFile "milestone"
    $currentPhase = Get-StateValue $stateFile "current_phase"
    $status = Get-StateValue $stateFile "status"

    $total = 0; $done = 0
    if (Test-Path $roadmapFile) {
        $content = Get-Content $roadmapFile -Raw
        $total = ([regex]::Matches($content, '^\- \[', 'Multiline')).Count
        $done = ([regex]::Matches($content, '^\- \[x\]', 'Multiline')).Count
    }

    if ($total -gt 0) {
        $pct = [math]::Round(($done / $total) * 100)
        $filled = [math]::Round($pct / 5)
        $empty = 20 - $filled
        $bar = ('#' * $filled) + ('-' * $empty)

        Write-Host "Milestone: " -NoNewline
        Write-Host "$milestone" -ForegroundColor White -NoNewline
        Write-Host " | Phase: " -NoNewline
        Write-Host "$currentPhase/$total" -ForegroundColor White -NoNewline
        Write-Host " | Status: " -NoNewline
        Write-Host "$status" -ForegroundColor White
        Write-Host "[$bar] " -ForegroundColor Green -NoNewline
        Write-Host "$done/$total phases ($pct%)" -ForegroundColor White
    }
    Write-Host ""

    # Checkpoint
    $checkpoint = Join-Path $ProjectDir ".planning\ORCHESTRATOR-CHECKPOINT.md"
    if (Test-Path $checkpoint) {
        Write-Host "[CHECKPOINT ACTIVE]" -ForegroundColor Yellow
        $lastCompleted = Get-StateValue $checkpoint "last_completed"
        $nextUnit = Get-StateValue $checkpoint "next_unit"
        Write-Host "  Last: $lastCompleted" -ForegroundColor DarkGray
        Write-Host "  Next: $nextUnit" -ForegroundColor DarkGray
        Write-Host ""
    }

    # Agent Activity
    Write-Host "AGENT ACTIVITY (last 10 dispatches)" -ForegroundColor White
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray

    $tokenLog = Join-Path $ProjectDir ".planning\metrics\token-log.jsonl"
    if (Test-Path $tokenLog) {
        $lines = Get-Content $tokenLog -Tail 10 -ErrorAction SilentlyContinue
        if ($lines) {
            [Array]::Reverse($lines)
            foreach ($line in $lines) {
                try {
                    $e = $line | ConvertFrom-Json
                    $model = $e.model.ToLower()
                    $role = if ($e.role) { $e.role } else { $e.description }
                    $tokens = Format-Tokens $e.total
                    $time = if ($e.ts) { (Get-Date $e.ts -Format 'HH:mm:ss') } else { '' }
                    $phase = if ($e.phase) { "P$($e.phase).$($e.plan)" } else { '' }
                    $activity = "$role $phase".PadRight(42).Substring(0, 42)

                    $color = switch ($model) {
                        'opus' { 'Magenta' }
                        'sonnet' { 'Blue' }
                        'haiku' { 'Cyan' }
                        default { 'DarkGray' }
                    }

                    Write-Host "  $time " -ForegroundColor DarkGray -NoNewline
                    Write-Host $model.PadRight(7) -ForegroundColor $color -NoNewline
                    Write-Host " $activity" -NoNewline
                    Write-Host " $tokens" -ForegroundColor Yellow
                } catch {}
            }

            Write-Host ""
            $summary = Get-TokenSummary $tokenLog
            Write-Host "  SESSION TOTALS:" -ForegroundColor White
            Write-Host "  Opus:   " -ForegroundColor Magenta -NoNewline
            Write-Host "$(Format-Tokens $summary.opus)"
            Write-Host "  Sonnet: " -ForegroundColor Blue -NoNewline
            Write-Host "$(Format-Tokens $summary.sonnet)"
            Write-Host "  Haiku:  " -ForegroundColor Cyan -NoNewline
            Write-Host "$(Format-Tokens $summary.haiku)"
            Write-Host "  Total:  $(Format-Tokens $summary.total)" -ForegroundColor White
        } else {
            Write-Host "  No entries yet" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  No agents dispatched yet" -ForegroundColor DarkGray
    }
    Write-Host ""

    # Current phase files
    if ($currentPhase) {
        $phaseDir = Get-ChildItem -Path (Join-Path $ProjectDir ".planning\phases") -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match "^${currentPhase}-" } | Select-Object -First 1
        if ($phaseDir) {
            Write-Host "CURRENT PHASE FILES " -NoNewline
            Write-Host "($($phaseDir.Name))" -ForegroundColor DarkGray
            Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray

            Get-ChildItem -Path $phaseDir.FullName -Filter "*-PLAN.md" | ForEach-Object {
                $planName = $_.BaseName
                $summaryPath = $_.FullName -replace 'PLAN\.md$', 'SUMMARY.md'
                if (Test-Path $summaryPath) {
                    Write-Host "  [done]    " -ForegroundColor Green -NoNewline
                    Write-Host $planName
                } else {
                    Write-Host "  [pending] " -ForegroundColor Yellow -NoNewline
                    Write-Host $planName
                }
            }
            Write-Host ""
        }
    }

    # Recent commits
    Write-Host "RECENT COMMITS" -ForegroundColor White
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
    Push-Location $ProjectDir
    git log --oneline -5 2>$null | ForEach-Object {
        $parts = $_ -split ' ', 2
        Write-Host "  $($parts[0]) " -ForegroundColor Cyan -NoNewline
        $msg = if ($parts[1].Length -gt 60) { $parts[1].Substring(0, 60) } else { $parts[1] }
        Write-Host $msg
    }
    Pop-Location

    Write-Host ""
    Write-Host "================================================================" -ForegroundColor DarkGray
    Write-Host "Project: $ProjectDir" -ForegroundColor DarkGray

    Start-Sleep -Seconds $RefreshSec
}
