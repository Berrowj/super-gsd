# User-scope Scheduled Tasks for VTP MCP + tunnel.
# NO ADMIN REQUIRED. Registers two tasks under the current user that:
#   - Run at logon
#   - Have no time limit
#   - Restart automatically if they fail (every 1 minute, up to 999 times)
# Triggered via launch-*.vbs so no cmd window flashes.
# Idempotent: re-running re-registers fresh.

$ErrorActionPreference = 'Stop'

$user = "$env:USERDOMAIN\$env:USERNAME"
$proj = 'C:\Users\jack.berrow\Voice-Text-Plan'
$mcpLauncher    = Join-Path $proj 'super-gsd\scripts\launch-vtp-mcp.vbs'
$tunnelLauncher = Join-Path $proj 'super-gsd\scripts\launch-vtp-tunnel.vbs'

foreach ($p in @($mcpLauncher, $tunnelLauncher)) {
  if (-not (Test-Path $p)) { Write-Host "MISSING: $p" -ForegroundColor Red; exit 2 }
}

function Register-VtpTask {
  param([string]$Name, [string]$Launcher)

  # Remove any existing task with this name (so this script is idempotent).
  $existing = Get-ScheduledTask -TaskName $Name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "[task] removing existing $Name"
    Unregister-ScheduledTask -TaskName $Name -Confirm:$false
  }

  $action = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "`"$Launcher`""
  $trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365) `
    -MultipleInstances IgnoreNew
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

  Write-Host "[task] registering $Name"
  Register-ScheduledTask -TaskName $Name `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "VTP MCP service - user-scope, restarts on crash, runs at logon. Source: $Launcher" | Out-Null
}

Register-VtpTask -Name 'VTP-MCP'        -Launcher $mcpLauncher
Register-VtpTask -Name 'VTP-MCP-Tunnel' -Launcher $tunnelLauncher

Write-Host ""
Write-Host "Done. Two scheduled tasks registered:"
Write-Host "  VTP-MCP         (runs vtp-mcp-loop.cmd at logon)"
Write-Host "  VTP-MCP-Tunnel  (runs vtp-tunnel-loop.cmd at logon)"
Write-Host ""
Write-Host "Logs land in $proj\.planning\logs\services\"
Write-Host ""
Write-Host "Start them now (without waiting for next logon):"
Write-Host "  schtasks /Run /TN VTP-MCP"
Write-Host "  Start-Sleep -Seconds 8"
Write-Host "  schtasks /Run /TN VTP-MCP-Tunnel"
Write-Host ""
Write-Host "Stop:   schtasks /End /TN VTP-MCP        (and /TN VTP-MCP-Tunnel)"
Write-Host "Verify: Get-ScheduledTask -TaskName VTP-*"
