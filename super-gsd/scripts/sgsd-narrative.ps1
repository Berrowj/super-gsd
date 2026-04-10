# Super GSD Narrative Feed — Task Tree + Haiku Summary (Options 5 + 6)
#
# TOP:    Rolling task tree parsed from TaskCreate/TaskUpdate entries
# BOTTOM: 100-token Claude summary of what's happening right now
#
# Refreshes every 60 seconds (configurable) and ONLY re-runs the summary
# if activity changed since last check.
#
# Usage:
#   .\sgsd-narrative.ps1                                 # current directory
#   .\sgsd-narrative.ps1 -ProjectDir ~\project-clarity-erp
#   .\sgsd-narrative.ps1 -RefreshSec 30                  # faster refresh
#
# Cost: ~600-1200 tokens per summary refresh (Claude Code overhead + 100 token output).
# At 60s refresh that's ~60K-120K tokens/hour — cheap on Max plan.

param(
    [string]$ProjectDir = ".",
    [int]$RefreshSec = 60
)

$ErrorActionPreference = "SilentlyContinue"

try {
    $ProjectDir = (Resolve-Path $ProjectDir).Path
} catch {
    Write-Host "ERROR: Cannot resolve $ProjectDir" -ForegroundColor Red
    exit 1
}

$activityLog = Join-Path $ProjectDir ".planning\metrics\activity-log.jsonl"
$narrativeFile = Join-Path $ProjectDir ".planning\metrics\narrative.md"

if (-not (Test-Path $activityLog)) {
    Write-Host "No activity log at: $activityLog" -ForegroundColor Red
    Write-Host "Make sure sgsd-activity-logger hook is installed and firing." -ForegroundColor DarkGray
    exit 1
}

# ANSI escape codes for clean in-place refresh
$ESC = [char]27
$HOME_POS = "$ESC[H"
$CLEAR_BELOW = "$ESC[0J"

Clear-Host
$lastHash = ""

while ($true) {
    [Console]::Write("$HOME_POS$CLEAR_BELOW")

    # Header
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "         SUPER GSD -- NARRATIVE                                 " -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host (Get-Date -Format 'HH:mm:ss') -NoNewline -ForegroundColor DarkGray
    Write-Host " | refresh ${RefreshSec}s | Ctrl+C to quit" -ForegroundColor DarkGray
    Write-Host ""

    # ====== TASK TREE (Option 5) ======
    # Parse TaskCreate/TaskUpdate entries to build the current task list
    Write-Host "TASK TREE" -ForegroundColor White
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray

    $allLines = Get-Content $activityLog -Tail 200 -ErrorAction SilentlyContinue
    $tasks = [ordered]@{}

    if ($allLines) {
        foreach ($line in $allLines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($e.tool -eq "TaskCreate") {
                    $key = $e.target
                    if ($key -and -not $tasks.Contains($key)) {
                        $tasks[$key] = @{
                            status = "in_progress"
                            ts = $e.ts
                            phase = $e.phase
                        }
                    }
                } elseif ($e.tool -eq "TaskUpdate") {
                    $key = $e.target
                    if ($key -and $tasks.Contains($key)) {
                        $tasks[$key].status = "done"
                        $tasks[$key].completedAt = $e.ts
                    }
                }
            } catch {}
        }
    }

    if ($tasks.Count -eq 0) {
        Write-Host "  (no TaskCreate entries — orchestrator not active)" -ForegroundColor DarkGray
    } else {
        $lastTasks = @($tasks.Keys) | Select-Object -Last 10
        foreach ($key in $lastTasks) {
            $task = $tasks[$key]
            if ($task.status -eq "done") {
                Write-Host "  [done] " -NoNewline -ForegroundColor Green
                Write-Host $key -ForegroundColor DarkGray
            } else {
                Write-Host "  [>>]   " -NoNewline -ForegroundColor Yellow
                Write-Host $key -ForegroundColor White
            }
        }
    }
    Write-Host ""

    # Read last 10 activity entries for summary
    $lines = Get-Content $activityLog -Tail 10 -ErrorAction SilentlyContinue
    if (-not $lines) {
        Write-Host "No recent activity to summarize." -ForegroundColor DarkGray
        Start-Sleep -Seconds $RefreshSec
        continue
    }

    # Build compact activity snippet
    $snippetLines = @()
    foreach ($line in $lines) {
        try {
            $e = $line | ConvertFrom-Json -ErrorAction Stop
            $target = $e.target
            if ($target.Length -gt 80) { $target = $target.Substring(0, 80) + "..." }
            $snippetLines += "$($e.tool): $target"
        } catch {}
    }
    $snippet = $snippetLines -join "`n"

    # Hash current activity — skip API call if unchanged
    $currentHash = [System.BitConverter]::ToString(
        [System.Security.Cryptography.MD5]::Create().ComputeHash(
            [System.Text.Encoding]::UTF8.GetBytes($snippet)
        )
    )

    if ($currentHash -eq $lastHash) {
        # No new activity — show cached narrative
        if (Test-Path $narrativeFile) {
            $cached = Get-Content $narrativeFile -Raw -ErrorAction SilentlyContinue
            if ($cached) {
                Write-Host "WHAT CLAUDE IS DOING " -NoNewline -ForegroundColor White
                Write-Host "(cached — no new activity)" -ForegroundColor DarkGray
                Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
                Write-Host $cached -ForegroundColor Yellow
                Write-Host ""
            }
        }
        Start-Sleep -Seconds $RefreshSec
        continue
    }

    $lastHash = $currentHash

    # Call claude --print with a tight prompt
    Write-Host "WHAT CLAUDE IS DOING " -NoNewline -ForegroundColor White
    Write-Host "(generating summary...)" -ForegroundColor DarkGray
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray

    $prompt = @"
You are a narrative summarizer. Read these 10 recent tool calls from a Claude Code session and write a 1-2 sentence summary of what Claude is currently doing. Plain English, present tense, max 100 tokens total. Do NOT list the tool calls — synthesize the intent.

Recent activity:
$snippet

Summary (max 100 tokens, 1-2 sentences):
"@

    try {
        # Run claude in print mode with no permissions prompting
        $narrative = & claude --print --dangerously-skip-permissions -p $prompt 2>$null

        if ($narrative) {
            # Cap at roughly 100 tokens (~400 chars)
            if ($narrative.Length -gt 500) {
                $narrative = $narrative.Substring(0, 500) + "..."
            }

            # Display
            Write-Host $narrative -ForegroundColor Yellow
            Write-Host ""

            # Cache to file
            try {
                $narrative | Out-File -FilePath $narrativeFile -Encoding utf8 -NoNewline
            } catch {}
        } else {
            Write-Host "(claude returned empty — check claude CLI is on PATH)" -ForegroundColor Red
        }
    } catch {
        Write-Host "(error calling claude: $_)" -ForegroundColor Red
    }

    # Show the raw activity below for context
    Write-Host "RECENT ACTIVITY" -ForegroundColor DarkGray
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
    $snippetLines | Select-Object -Last 5 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor DarkGray
    }
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor DarkGray
    Write-Host "Next refresh in ${RefreshSec}s..." -ForegroundColor DarkGray

    Start-Sleep -Seconds $RefreshSec
}
