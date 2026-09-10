param(
    [ValidateSet('Pull','Status','Open')][string]$Action = 'Pull',
    [string]$ClientRoot = (Join-Path $env:LOCALAPPDATA 'SGSD\Atlas\devcp'),
    [string]$NodePath = 'node.exe'
)
$ErrorActionPreference = 'Stop'
$atlasCandidates = @(
    (Join-Path $PSScriptRoot 'telemetry-atlas\monitor-client.cjs'),
    (Join-Path $PSScriptRoot '..\tools\telemetry-atlas\monitor-client.cjs')
)
$atlasClient = $atlasCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $atlasClient) { throw 'Atlas client runtime is missing; rerun install-atlas-monitor-task.ps1.' }
try {
    $atlasResultText = & $NodePath $atlasClient $Action.ToLowerInvariant() --root $ClientRoot
    $atlasExit = $LASTEXITCODE
    $atlasResult = ($atlasResultText -join "`n") | ConvertFrom-Json
    if (-not $atlasResult -or -not $atlasResult.status -and $Action -ne 'Open') { throw 'Invalid client output.' }
} catch {
    $atlasExit = 1
    $atlasResult = [pscustomobject]@{ schema_version=1; status='failed'; reason='client_invocation_failed'; last_verified_at=$null; copy_overdue=$true }
}
if ($Action -eq 'Open') {
    if ($atlasExit -ne 0 -or -not $atlasResult.url) { throw 'Atlas cockpit connection was not verified.' }
    Start-Process $atlasResult.url
}
if ($Action -eq 'Pull') {
    $atlasHealthPath = Join-Path $ClientRoot 'health.json'
    $atlasReasons = @()
    if (Test-Path -LiteralPath $atlasHealthPath) {
        try { $atlasHealth = Get-Content -LiteralPath $atlasHealthPath -Raw | ConvertFrom-Json; $atlasReasons = @($atlasHealth.findings | ForEach-Object { $_.reason } | Sort-Object -Unique) } catch { $atlasReasons = @('local_health_unreadable') }
    }
    $atlasKey = "$($atlasResult.status)|$($atlasResult.reason)|$($atlasResult.copy_overdue)|$($atlasReasons -join ',')"
    $atlasNotificationPath = Join-Path $ClientRoot 'notification.json'
    $atlasPrevious = $null
    if (Test-Path -LiteralPath $atlasNotificationPath) { try { $atlasPrevious = Get-Content -LiteralPath $atlasNotificationPath -Raw | ConvertFrom-Json } catch {} }
    if (-not $atlasPrevious -or $atlasPrevious.incident_key -ne $atlasKey) {
        $atlasOutcome = 'unavailable_noninteractive'
        if ([Environment]::UserInteractive) {
            try {
                Add-Type -AssemblyName System.Windows.Forms
                Add-Type -AssemblyName System.Drawing
                $atlasIcon = New-Object System.Windows.Forms.NotifyIcon
                $atlasIcon.Icon = [System.Drawing.SystemIcons]::Warning
                $atlasIcon.Visible = $true
                $atlasMessage = "Copy: $($atlasResult.status). Last verified: $($atlasResult.last_verified_at). Capture findings: $($atlasReasons.Count). Open the Atlas cockpit for details."
                $atlasIcon.ShowBalloonTip(5000, 'SGSD Atlas collection check', $atlasMessage, [System.Windows.Forms.ToolTipIcon]::Warning)
                Start-Sleep -Seconds 6
                $atlasIcon.Dispose()
                $atlasOutcome = 'attempted_not_delivery_confirmed'
            } catch { $atlasOutcome = 'unavailable_notification_api' }
        }
        $atlasNote = @{ schema_version=1; generated_at=[DateTime]::UtcNow.ToString('o'); incident_key=$atlasKey; outcome=$atlasOutcome } | ConvertTo-Json -Compress
        $atlasTemporary = "$atlasNotificationPath.$([Guid]::NewGuid().ToString('N')).tmp"
        [IO.File]::WriteAllText($atlasTemporary, $atlasNote, (New-Object Text.UTF8Encoding($false)))
        Move-Item -LiteralPath $atlasTemporary -Destination $atlasNotificationPath -Force
    }
}
$atlasResult | ConvertTo-Json -Depth 6 -Compress
exit $atlasExit
