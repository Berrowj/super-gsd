# ============================================================================
# Super GSD - Dashboard Pane Host
# ============================================================================
# Runs one cockpit dashboard script and keeps the pane useful if it crashes.
# Without this host, `powershell -NoExit -File dashboard.ps1` falls through to a
# plain prompt after a script error, which makes a broken dashboard look like a
# normal idle shell.
# ============================================================================

param(
    [Parameter(Mandatory = $true)]
    [string]$DashboardScript,

    [Parameter(Mandatory = $true)]
    [string]$ProjectDir,

    [string]$Name = "SGSD Dashboard"
)

$ErrorActionPreference = "Stop"

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch { }

function Hold-Pane {
    Write-Host ""
    Write-Host "Pane held open so the failure stays visible. Press Ctrl+C to close it, then rerun sgsd." -ForegroundColor DarkGray
    while ($true) { Start-Sleep -Seconds 3600 }
}

function Write-DashboardFailure {
    param(
        [string]$Title,
        [string]$Detail
    )

    $esc = [char]27
    Write-Host "$esc[H$esc[0J" -NoNewline
    Write-Host "SUPER GSD DASHBOARD FAILURE" -ForegroundColor Red
    Write-Host "----------------------------" -ForegroundColor Red
    Write-Host "Pane:    $Name" -ForegroundColor White
    Write-Host "Script:  $DashboardScript" -ForegroundColor DarkGray
    Write-Host "Project: $ProjectDir" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host $Title -ForegroundColor Yellow
    if ($Detail) {
        Write-Host ""
        Write-Host $Detail -ForegroundColor Gray
    }
}

try {
    $DashboardScript = (Resolve-Path -LiteralPath $DashboardScript -ErrorAction Stop).Path
    $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-DashboardFailure "Boot could not resolve the dashboard path." ($_ | Out-String)
    Hold-Pane
}

try {
    & $DashboardScript -ProjectDir $ProjectDir
    Write-DashboardFailure "Dashboard script returned instead of continuing to render." "This usually means the render loop exited cleanly. Check recent edits to the dashboard script."
    Hold-Pane
} catch {
    Write-DashboardFailure "Dashboard script crashed before it could keep rendering." ($_ | Out-String)
    Hold-Pane
}
