# ============================================================================
# Super GSD remote launcher
# ============================================================================
# Opens a local terminal attached to a remote SGSD tmux cockpit.
#
# Example:
#   powershell -File super-gsd/scripts/sgsd-remote-launch.ps1 `
#     -HostName devcp `
#     -ProjectDir /opt/clarity/project-clarity-erp `
#     -Greet
# ============================================================================

param(
    [string]$HostName = "devcp",
    [string]$ProjectDir = "/opt/clarity/project-clarity-erp",
    [string]$Session = "clarity-sgsd",
    [string]$RemoteScript = "~/.claude/super-gsd/scripts/sgsd-remote-tmux.sh",
    [switch]$Greet,
    [switch]$Go,
    [switch]$Shell,
    [switch]$Reset,
    [switch]$Doctor,
    [switch]$CurrentWindow,
    [switch]$SeparatePowerShell,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Quote-BashArg {
    param([Parameter(Mandatory = $true)][string]$Value)
    if ($Value -match '^[A-Za-z0-9_./:@%+=,~:-]+$') {
        return $Value
    }
    $single = "'"
    $escaped = $Value.Replace($single, "$single`"$single`"$single")
    return "$single$escaped$single"
}

function Quote-PowerShellLiteral {
    param([Parameter(Mandatory = $true)][string]$Value)
    return "'" + $Value.Replace("'", "''") + "'"
}

$modeCount = @($Greet, $Go, $Shell | Where-Object { $_ }).Count
if ($modeCount -gt 1) {
    throw "Choose only one of -Greet, -Go, or -Shell."
}

$mode = "--greet"
if ($Go) {
    $mode = "--go"
} elseif ($Shell) {
    $mode = "--shell"
} elseif ($Greet) {
    $mode = "--greet"
}

$remoteParts = @(
    "bash",
    (Quote-BashArg $RemoteScript),
    "--project", (Quote-BashArg $ProjectDir),
    "--session", (Quote-BashArg $Session),
    $mode
)
if ($Reset) { $remoteParts += "--reset" }
if ($Doctor) { $remoteParts += "--doctor" }

$remoteCommand = ($remoteParts -join " ")
$sshArgs = @("-t", $HostName, $remoteCommand)
$sshLine = "ssh -t $(Quote-PowerShellLiteral $HostName) $(Quote-PowerShellLiteral $remoteCommand)"

Write-Host "SGSD remote launch" -ForegroundColor Cyan
Write-Host "  host:    $HostName"
Write-Host "  project: $ProjectDir"
Write-Host "  session: $Session"
Write-Host "  mode:    $mode"
Write-Host ""
Write-Host "Remote command:" -ForegroundColor DarkGray
Write-Host "  $remoteCommand" -ForegroundColor DarkGray
Write-Host ""

if ($DryRun) {
    Write-Host "Dry run only. No SSH connection opened." -ForegroundColor Yellow
    exit 0
}

if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) {
    throw "ssh is not on PATH. Install OpenSSH Client or run this from a shell where ssh works."
}

if ($CurrentWindow) {
    & ssh @sshArgs
    exit $LASTEXITCODE
}

if ($SeparatePowerShell) {
    Start-Process powershell.exe -ArgumentList @("-NoExit", "-NoProfile", "-Command", $sshLine) | Out-Null
    exit 0
}

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue
if ($wt) {
    Start-Process -FilePath $wt.Source -ArgumentList @(
        "new-tab",
        "--title", "Clarity SGSD",
        "powershell.exe",
        "-NoExit",
        "-NoProfile",
        "-Command", $sshLine
    ) | Out-Null
    exit 0
}

Write-Host "Windows Terminal not found; opening a separate PowerShell window." -ForegroundColor Yellow
Start-Process powershell.exe -ArgumentList @("-NoExit", "-NoProfile", "-Command", $sshLine) | Out-Null
