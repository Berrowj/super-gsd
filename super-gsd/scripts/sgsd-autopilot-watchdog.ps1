# ============================================================================
# Super GSD - Autopilot Watchdog
# ============================================================================
# External failsafe for silent autonomous-run stalls.
#
# The dashboards can keep rendering even after the real SGSD loop stops making
# durable progress. This watcher runs outside Claude, checks project evidence,
# and writes:
#   .planning/metrics/autopilot-watchdog.json
#   .planning/metrics/stall-log.jsonl
#   .planning/AUTOPILOT-RECOVERY.md
#
# Optional -Recover starts a fresh Claude resume window after a stall is
# detected. It does not kill existing Claude processes.
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [int]$IntervalSec = 60,
    [int]$WarnMin = 20,
    [int]$StaleMin = 45,
    [switch]$Checkpoint,
    [switch]$Recover,
    [switch]$Once
)

$ErrorActionPreference = "SilentlyContinue"

try {
    $ProjectDir = (Resolve-Path $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-Host "sgsd-autopilot-watchdog: cannot resolve project dir: $ProjectDir" -ForegroundColor Red
    exit 1
}

$PlanningDir = Join-Path $ProjectDir ".planning"
if (-not (Test-Path $PlanningDir)) {
    Write-Host "sgsd-autopilot-watchdog: no .planning directory under $ProjectDir" -ForegroundColor Red
    exit 1
}

$Tool = Join-Path $ProjectDir "super-gsd\tools\autopilot-watchdog\check.cjs"
if (-not (Test-Path $Tool)) {
    Write-Host "sgsd-autopilot-watchdog: missing $Tool" -ForegroundColor Red
    exit 1
}

$MetricsDir = Join-Path $PlanningDir "metrics"
New-Item -ItemType Directory -Force -Path $MetricsDir | Out-Null
$LogPath = Join-Path $MetricsDir "autopilot-watchdog.log"
$RecoveryLock = Join-Path $MetricsDir "autopilot-watchdog-recovery.lock"

function Write-WatchdogLog {
    param([string]$Message)
    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $line = "[$ts] $Message"
    Add-Content -Path $LogPath -Value $line
    Write-Host $line
}

function Invoke-WatchdogCheck {
    $args = @(
        $Tool,
        "--project-dir", $ProjectDir,
        "--warn-min", "$WarnMin",
        "--stale-min", "$StaleMin",
        "--write",
        "--json"
    )
    if ($Checkpoint) { $args += "--checkpoint" }

    $out = & node @args 2>&1
    $jsonText = ($out -join "`n").Trim()
    try {
        return ($jsonText | ConvertFrom-Json)
    } catch {
        Write-WatchdogLog "check failed: $jsonText"
        return $null
    }
}

function Start-RecoveryClaude {
    param($Status)

    $now = Get-Date
    if (Test-Path $RecoveryLock) {
        $lockAge = ($now - (Get-Item $RecoveryLock).LastWriteTime).TotalSeconds
        if ($lockAge -lt ([Math]::Max($StaleMin * 60, 900))) {
            return
        }
    }

    Set-Content -Path $RecoveryLock -Value $Status.generated_at -NoNewline
    $prompt = 'Read .planning/AUTOPILOT-RECOVERY.md and .planning/STATE.md, recover the active phase, then continue: /sgsd-orchestrate go'
    $escapedProject = $ProjectDir.Replace("'", "''")
    $escapedPrompt = $prompt.Replace("'", "''")
    $cmd = "cd '$escapedProject'; claude --print --dangerously-skip-permissions -p '$escapedPrompt'"

    try {
        Start-Process powershell.exe -WorkingDirectory $ProjectDir -ArgumentList @(
            "-NoExit",
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-Command", $cmd
        ) | Out-Null
        Write-WatchdogLog "recovery launched for $($Status.milestone)/P$($Status.phase)"
    } catch {
        Write-WatchdogLog "recovery launch failed: $($_.Exception.Message)"
    }
}

Write-WatchdogLog "started project=$ProjectDir interval=${IntervalSec}s warn=${WarnMin}m stale=${StaleMin}m checkpoint=$Checkpoint recover=$Recover"

while ($true) {
    $status = Invoke-WatchdogCheck
    if ($status) {
        $age = if ($null -ne $status.durable_progress_age_min) { "$($status.durable_progress_age_min)m" } else { "?m" }
        $line = "$($status.status) $($status.milestone)/P$($status.phase) durable=$age source=$($status.latest_durable_source)"
        if ($status.status -eq "stalled") {
            Write-WatchdogLog "STALL $line recovery=$($status.recovery_packet)"
            if ($Recover) { Start-RecoveryClaude $status }
        } elseif ($status.status -eq "warn") {
            Write-WatchdogLog "WARN $line"
        } else {
            Write-WatchdogLog $line
        }
    }

    if ($Once) { break }
    Start-Sleep -Seconds ([Math]::Max(10, $IntervalSec))
}
