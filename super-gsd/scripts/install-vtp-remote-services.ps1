<#
.SYNOPSIS
  Install VTP MCP server + tunnel supervisor as NSSM services on Windows.
  Idempotent. Run as Administrator.

.DESCRIPTION
  Registers two services that auto-start at boot and auto-restart on crash:
    vtp-mcp          - VTP MCP HTTP server bound to 127.0.0.1:4101
    vtp-mcp-tunnel   - reverse SSH tunnel + per-session bearer-token rotation

  Together they let a Linux build host reach this Windows box's VTP MCP
  over an SSH reverse tunnel with no long-lived secret on Linux. See
  docs/vtp-remote-access.md for the Linux-side wiring.

.PARAMETER NssmPath
  Path to nssm.exe. Default: nssm.exe on PATH. Install from https://nssm.cc/.

.PARAMETER ProjectRoot
  Repo root. Defaults to two directories above this script.

.PARAMETER NodeExe
  Path to node.exe. Defaults to (Get-Command node).Source.

.PARAMETER Uninstall
  If set, removes both services and exits.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\super-gsd\scripts\install-vtp-remote-services.ps1
  powershell -ExecutionPolicy Bypass -File .\super-gsd\scripts\install-vtp-remote-services.ps1 -Uninstall
#>
[CmdletBinding()]
param(
  [string] $NssmPath,
  [string] $ProjectRoot,
  [string] $NodeExe,
  [switch] $Uninstall
)

function Assert-Admin {
  $current = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($current)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "This script must be run as Administrator."
  }
}

function Resolve-Tool($name, $explicit) {
  if ($explicit) { return $explicit }
  $cmd = Get-Command $name -ErrorAction SilentlyContinue
  if (-not $cmd) { throw "$name not found on PATH. Pass an explicit path or install it." }
  return $cmd.Source
}

function Service-Exists($name) {
  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
  return $null -ne $svc
}

Assert-Admin

if (-not $ProjectRoot) {
  $ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}
if (-not (Test-Path $ProjectRoot)) {
  throw "Project root not found: $ProjectRoot"
}

$NssmPath = Resolve-Tool "nssm.exe" $NssmPath
$NodeExe  = Resolve-Tool "node.exe" $NodeExe

$NpxExe = (Get-Command npx.cmd -ErrorAction SilentlyContinue)
if (-not $NpxExe) { $NpxExe = Get-Command npx -ErrorAction SilentlyContinue }
if (-not $NpxExe) { throw "npx not found on PATH." }
$NpxExe = $NpxExe.Source

$McpServiceName    = "vtp-mcp"
$TunnelServiceName = "vtp-mcp-tunnel"

$LogDir = Join-Path $ProjectRoot ".planning\logs\services"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

$TokenFile = Join-Path $env:USERPROFILE ".vtp\mcp-active-tokens.json"

if ($Uninstall) {
  foreach ($svc in @($TunnelServiceName, $McpServiceName)) {
    if (Service-Exists $svc) {
      Write-Host "[uninstall] stopping $svc"
      & $NssmPath stop $svc confirm | Out-Null
      Write-Host "[uninstall] removing $svc"
      & $NssmPath remove $svc confirm | Out-Null
    } else {
      Write-Host "[uninstall] $svc not present"
    }
  }
  Write-Host "Done."
  return
}

$SupervisorScript = Join-Path $ProjectRoot "super-gsd\scripts\vtp-tunnel-supervisor.cjs"
if (-not (Test-Path $SupervisorScript)) {
  throw "Supervisor script missing: $SupervisorScript"
}

$ConfigFile = Join-Path $ProjectRoot "super-gsd\config\vtp-tunnel.json"
if (-not (Test-Path $ConfigFile)) {
  Write-Warning "Config file not present: $ConfigFile"
  Write-Warning "Copy vtp-tunnel.json.example to vtp-tunnel.json and edit before starting the tunnel service."
}

# ---- Service 1: VTP MCP HTTP server ----
if (Service-Exists $McpServiceName) {
  Write-Host "[mcp] service exists - updating settings"
  & $NssmPath stop $McpServiceName confirm | Out-Null
} else {
  Write-Host "[mcp] installing $McpServiceName"
  & $NssmPath install $McpServiceName $NpxExe "tsx src/cli.ts mcp --transport http --host 127.0.0.1 --port 4101" | Out-Null
}

& $NssmPath set $McpServiceName AppDirectory $ProjectRoot | Out-Null
& $NssmPath set $McpServiceName AppStdout (Join-Path $LogDir "vtp-mcp.out.log") | Out-Null
& $NssmPath set $McpServiceName AppStderr (Join-Path $LogDir "vtp-mcp.err.log") | Out-Null
& $NssmPath set $McpServiceName AppRotateFiles 1 | Out-Null
& $NssmPath set $McpServiceName AppRotateBytes 10485760 | Out-Null
& $NssmPath set $McpServiceName Start SERVICE_AUTO_START | Out-Null
& $NssmPath set $McpServiceName AppExit Default Restart | Out-Null
& $NssmPath set $McpServiceName AppRestartDelay 5000 | Out-Null
& $NssmPath set $McpServiceName AppEnvironmentExtra "VTP_MCP_TOKEN_FILE=$TokenFile" | Out-Null

# ---- Service 2: Tunnel supervisor ----
if (Service-Exists $TunnelServiceName) {
  Write-Host "[tunnel] service exists - updating settings"
  & $NssmPath stop $TunnelServiceName confirm | Out-Null
} else {
  Write-Host "[tunnel] installing $TunnelServiceName"
  & $NssmPath install $TunnelServiceName $NodeExe $SupervisorScript | Out-Null
}

& $NssmPath set $TunnelServiceName AppDirectory $ProjectRoot | Out-Null
& $NssmPath set $TunnelServiceName AppStdout (Join-Path $LogDir "vtp-tunnel.out.log") | Out-Null
& $NssmPath set $TunnelServiceName AppStderr (Join-Path $LogDir "vtp-tunnel.err.log") | Out-Null
& $NssmPath set $TunnelServiceName AppRotateFiles 1 | Out-Null
& $NssmPath set $TunnelServiceName AppRotateBytes 10485760 | Out-Null
& $NssmPath set $TunnelServiceName Start SERVICE_AUTO_START | Out-Null
& $NssmPath set $TunnelServiceName AppExit Default Restart | Out-Null
& $NssmPath set $TunnelServiceName AppRestartDelay 5000 | Out-Null
& $NssmPath set $TunnelServiceName AppEnvironmentExtra "VTP_MCP_TOKEN_FILE=$TokenFile" | Out-Null

# Tunnel depends on MCP being up
& $NssmPath set $TunnelServiceName DependOnService $McpServiceName | Out-Null

# Start MCP first, then tunnel
Write-Host "[mcp] starting $McpServiceName"
& $NssmPath start $McpServiceName | Out-Null

if (Test-Path $ConfigFile) {
  Write-Host "[tunnel] starting $TunnelServiceName"
  & $NssmPath start $TunnelServiceName | Out-Null
} else {
  Write-Host "[tunnel] NOT starting yet - config file missing. Edit $ConfigFile then run: nssm start $TunnelServiceName"
}

Write-Host ""
Write-Host "Done."
Write-Host "  MCP server   : http://127.0.0.1:4101/mcp (auth required, token file: $TokenFile)"
Write-Host "  Tunnel       : ssh -R <bind>:127.0.0.1:4101 to remote host configured in $ConfigFile"
Write-Host "  Logs         : $LogDir"
Write-Host "  Linux setup  : super-gsd/docs/vtp-remote-access.md"
