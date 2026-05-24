[CmdletBinding()]
param(
    [int]$Port = 7777,
    [string]$Workspace = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

# Ensure runtime directory
$runtimeDir = Join-Path $Workspace '.planning\runtime'
if (-not (Test-Path $runtimeDir)) { New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null }

$serveScript = Join-Path $Workspace 'super-gsd\tools\cockpit-sidecar\serve.cjs'
if (-not (Test-Path $serveScript)) {
    Write-Error "serve.cjs not found at $serveScript"
    exit 1
}

# Spawn node serve.cjs in background
Write-Host "Starting cockpit server on port $Port..."
$process = Start-Process -FilePath 'node' -ArgumentList @($serveScript, '--port', $Port, '--workspace', $Workspace) -PassThru -WindowStyle Hidden

# Write PID
$pidFile = Join-Path $runtimeDir 'cockpit-server.pid'
Set-Content -Path $pidFile -Value $process.Id -Encoding ASCII
Write-Host "PID $($process.Id) -> $pidFile"

# Poll health for up to 5 seconds
$healthy = $false
for ($attempt = 1; $attempt -le 10; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:$Port/snapshot" -UseBasicParsing -TimeoutSec 1
        if ($resp.StatusCode -eq 200) {
            $healthy = $true
            break
        }
    } catch {
        # not ready yet; continue polling
    }
}

if ($healthy) {
    Write-Host "Cockpit server healthy at http://localhost:$Port" -ForegroundColor Green
    Write-Host "  Open in browser: http://localhost:$Port"
    Write-Host "  Stop with: Stop-Process -Id $($process.Id)"
    exit 0
} else {
    Write-Error "Cockpit server did not become healthy within 5 seconds"
    if (-not $process.HasExited) { Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue }
    if (Test-Path $pidFile) { Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue }
    exit 1
}
