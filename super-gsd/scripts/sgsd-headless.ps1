# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  Super GSD Headless Runner - Windows PowerShell
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#
#  Same as gsd-headless.sh but for native Windows.
#  Runs Claude Code in a loop with auto-restart.
#
#  Usage:
#    .\gsd-headless.ps1
#    .\gsd-headless.ps1 -ProjectDir C:\Users\me\myproject
#    .\gsd-headless.ps1 -MaxRuns 10
#    .\gsd-headless.ps1 -Stop
#
#  Run in Windows Terminal and minimize - it'll keep going.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

param(
    [string]$ProjectDir = ".",
    [int]$MaxRuns = 50,
    [int]$RestartDelay = 10,
    [int]$BackoffMax = 120,
    [switch]$Stop
)

$LockFile = Join-Path $ProjectDir ".planning\.headless.lock"
$LogFile = Join-Path $ProjectDir ".planning\metrics\headless-log.txt"
$Prompt = 'Read .planning/ORCHESTRATOR-CHECKPOINT.md if it exists, then enter auto mode: /sgsd-orchestrate go'

# -- Stop existing session --
if ($Stop) {
    if (Test-Path $LockFile) {
        $pid = Get-Content $LockFile
        try {
            Stop-Process -Id $pid -Force
            Write-Host "Stopped headless session (PID $pid)"
        } catch {
            Write-Host "Process $pid not found"
        }
        Remove-Item $LockFile -Force
    } else {
        Write-Host "No headless session running"
    }
    exit 0
}

# -- Validate --
if (-not (Test-Path (Join-Path $ProjectDir ".planning"))) {
    Write-Host "ERROR: No .planning/ directory. Run install.sh --init-project first."
    exit 1
}

# -- Lock --
if (Test-Path $LockFile) {
    $oldPid = Get-Content $LockFile
    try {
        Get-Process -Id $oldPid -ErrorAction Stop | Out-Null
        Write-Host "ERROR: Already running (PID $oldPid). Use -Stop first."
        exit 1
    } catch {
        Remove-Item $LockFile -Force
    }
}

$PID > $LockFile
$null = New-Item -Path (Split-Path $LogFile) -ItemType Directory -Force -ErrorAction SilentlyContinue

function Log($msg) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Check-AllDone {
    $roadmap = Join-Path $ProjectDir ".planning\ROADMAP.md"
    if (-not (Test-Path $roadmap)) { return $false }
    $content = Get-Content $roadmap -Raw
    $total = ([regex]::Matches($content, '^\- \[', 'Multiline')).Count
    $done = ([regex]::Matches($content, '^\- \[x\]', 'Multiline')).Count
    return ($total -gt 0 -and $total -eq $done)
}

# -- Main Loop --
Log "Super GSD Headless Runner - Starting"
Log "Project: $ProjectDir | Max: $MaxRuns | PID: $PID"

$run = 0
$failures = 0
$delay = $RestartDelay

while ($run -lt $MaxRuns) {
    $run++

    if (Check-AllDone) {
        Log "ALL PHASES COMPLETE - stopping"
        break
    }

    $hasCheckpoint = Test-Path (Join-Path $ProjectDir ".planning\ORCHESTRATOR-CHECKPOINT.md")
    Log "Run $run/$MaxRuns - $(if ($hasCheckpoint) { 'Resuming from checkpoint' } else { 'Cold start' })"

    Log "Launching claude --print --dangerously-skip-permissions"
    $startTime = Get-Date

    Push-Location $ProjectDir
    try {
        claude --print --dangerously-skip-permissions -p $Prompt 2>&1 | Add-Content -Path $LogFile
        $exitCode = $LASTEXITCODE
    } catch {
        $exitCode = 1
    }
    Pop-Location

    $duration = ((Get-Date) - $startTime).TotalSeconds
    Log "Claude exited ($exitCode) after $([math]::Round($duration))s"

    if (Check-AllDone) {
        Log "ALL PHASES COMPLETE - stopping"
        break
    }

    # Check for commits
    Push-Location $ProjectDir
    $commits = (git log --oneline -5 2>$null | Measure-Object -Line).Lines
    Pop-Location

    if ($commits -eq 0 -and $exitCode -ne 0) {
        $failures++
        $delay = [math]::Min($RestartDelay * $failures, $BackoffMax)
        Log "WARNING: No commits + error. Failure #$failures. Delay: ${delay}s"
    } else {
        $failures = 0
        $delay = $RestartDelay
    }

    if ($failures -ge 5) {
        Log "ERROR: 5 consecutive failures. Stopping."
        break
    }

    Log "Waiting ${delay}s..."
    Start-Sleep -Seconds $delay
}

Log "Headless runner finished after $run runs"
Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
