[CmdletBinding()]
param(
    [int]$Port = 7777,
    [string]$Workspace = (Get-Location).Path,
    [int]$MaxPortAttempts = 25
)

$ErrorActionPreference = 'Stop'

try {
    $Workspace = (Resolve-Path -LiteralPath $Workspace -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve workspace $Workspace" -ForegroundColor Red
    exit 1
}

# Ensure runtime directory
$runtimeDir = Join-Path $Workspace '.planning\runtime'
if (-not (Test-Path $runtimeDir)) { New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null }

$serveScript = Join-Path $Workspace 'super-gsd\tools\cockpit-sidecar\serve.cjs'
if (-not (Test-Path $serveScript)) {
    Write-Error "serve.cjs not found at $serveScript"
    exit 1
}

function Test-SgsdCockpitHealth {
    param([Parameter(Mandatory = $true)][int]$CandidatePort)

    try {
        $resp = Invoke-WebRequest -Uri "http://127.0.0.1:$CandidatePort/snapshot" -UseBasicParsing -TimeoutSec 1
        if ($resp.StatusCode -ne 200) { return $null }
        try {
            return ($resp.Content | ConvertFrom-Json)
        } catch {
            return [pscustomobject]@{ milestone = '?'; phase = '?' }
        }
    } catch {
        return $null
    }
}

function Test-SgsdPortFree {
    param([Parameter(Mandatory = $true)][int]$CandidatePort)

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse('127.0.0.1'), $CandidatePort)
        $listener.Start()
        return $true
    } catch {
        return $false
    } finally {
        if ($listener) { $listener.Stop() }
    }
}

function Get-SgsdFreeCockpitPort {
    param(
        [Parameter(Mandatory = $true)][int]$StartPort,
        [Parameter(Mandatory = $true)][int]$Attempts
    )

    for ($candidate = $StartPort; $candidate -lt ($StartPort + $Attempts); $candidate++) {
        if (Test-SgsdPortFree -CandidatePort $candidate) {
            return $candidate
        }
    }
    throw "No free loopback port found from $StartPort to $($StartPort + $Attempts - 1)"
}

function Write-SgsdRuntimeFiles {
    param(
        [int]$PidValue,
        [int]$ActualPort
    )

    Set-Content -Path (Join-Path $runtimeDir 'cockpit-server.pid') -Value $PidValue -Encoding ASCII
    Set-Content -Path (Join-Path $runtimeDir 'cockpit-server.port') -Value $ActualPort -Encoding ASCII
    Set-Content -Path (Join-Path $runtimeDir 'cockpit-server.url') -Value "http://localhost:$ActualPort/" -Encoding ASCII
}

function Get-SgsdExistingCockpitPid {
    $pidPath = Join-Path $runtimeDir 'cockpit-server.pid'
    if (-not (Test-Path $pidPath)) { return 0 }
    try {
        $raw = (Get-Content -Path $pidPath -TotalCount 1 -ErrorAction Stop).Trim()
        if ($raw -notmatch '^\d+$') { return 0 }
        $candidatePid = [int]$raw
        if ($candidatePid -le 0) { return 0 }
        $proc = Get-Process -Id $candidatePid -ErrorAction SilentlyContinue
        if ($proc) { return $candidatePid }
    } catch { }
    return 0
}

$existing = Test-SgsdCockpitHealth -CandidatePort $Port
if ($existing) {
    $existingPid = Get-SgsdExistingCockpitPid
    Write-SgsdRuntimeFiles -PidValue $existingPid -ActualPort $Port
    Write-Host "Cockpit server already healthy at http://localhost:$Port" -ForegroundColor Green
    Write-Host "  Loopback health: http://127.0.0.1:$Port/snapshot"
    Write-Host "  Snapshot: milestone $($existing.milestone) phase $($existing.phase)"
    Write-Host "  Events: http://127.0.0.1:$Port/events"
    if ($existingPid -gt 0) {
        Write-Host "  Stop with: Stop-Process -Id $existingPid"
    }
    exit 0
}

$actualPort = Get-SgsdFreeCockpitPort -StartPort $Port -Attempts $MaxPortAttempts
$stdoutPath = Join-Path $runtimeDir "cockpit-server-$actualPort.out.log"
$stderrPath = Join-Path $runtimeDir "cockpit-server-$actualPort.err.log"

# Spawn node serve.cjs in background
Write-Host "Starting cockpit server on port $actualPort..."
$startArgs = @{
    FilePath = 'node'
    ArgumentList = @($serveScript, '--port', $actualPort, '--workspace', $Workspace)
    PassThru = $true
    RedirectStandardOutput = $stdoutPath
    RedirectStandardError = $stderrPath
}
if (($PSVersionTable.PSVersion.Major -lt 6) -or $IsWindows) {
    $startArgs['WindowStyle'] = 'Hidden'
}
$process = Start-Process @startArgs

# Write PID
$pidFile = Join-Path $runtimeDir 'cockpit-server.pid'
Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII
Write-Host "PID $($process.Id) -> $pidFile"

# Poll health for up to 15 seconds
$snapshot = $null
for ($attempt = 1; $attempt -le 30; $attempt++) {
    Start-Sleep -Milliseconds 500
    $snapshot = Test-SgsdCockpitHealth -CandidatePort $actualPort
    if ($snapshot) {
        break
    }
}

if ($snapshot) {
    Write-SgsdRuntimeFiles -PidValue $process.Id -ActualPort $actualPort
    Write-Host "Cockpit server healthy at http://localhost:$actualPort" -ForegroundColor Green
    Write-Host "  Loopback health: http://127.0.0.1:$actualPort/snapshot"
    Write-Host "  Snapshot: milestone $($snapshot.milestone) phase $($snapshot.phase)"
    Write-Host "  Events: http://127.0.0.1:$actualPort/events"
    Write-Host "  Stop with: Stop-Process -Id $($process.Id)"
    exit 0
} else {
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    if (Test-Path $pidFile) { Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue }
    Write-Host "ERROR: Cockpit server did not become healthy within 15 seconds" -ForegroundColor Red
    if (Test-Path $stderrPath) {
        Write-Host "Recent stderr:" -ForegroundColor DarkYellow
        Get-Content -Path $stderrPath -Tail 20 -ErrorAction SilentlyContinue
    }
    exit 1
}
