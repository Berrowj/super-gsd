function Start-SgsdAtlas {
    param([string]$ProjectDir = (Get-Location).Path, [string]$Role = 'orchestrator')
    $saved = @{}
    $managed = ($PSVersionTable.Platform -eq 'Unix' -and $IsLinux -and $Role -eq 'orchestrator')
    $clear = @(Get-ChildItem Env: | Where-Object { $_.Name -match '^OTEL_' } | ForEach-Object { $_.Name }) + @(
        'BETA_TRACING_ENDPOINT', 'CLAUDE_CODE_ENHANCED_TELEMETRY_BETA', 'ENABLE_ENHANCED_TELEMETRY_BETA',
        'CLAUDE_CODE_ENABLE_TELEMETRY', 'SGSD_RUN_ID', 'SGSD_ATLAS_STATE_DIR', 'SGSD_ATLAS_ENDPOINT',
        'SGSD_ATLAS_RUN_ENDPOINT', 'SGSD_ATLAS_PROJECT_ID', 'SGSD_ATLAS_CODEX_EXPORTER',
        'SGSD_FLEET_MANAGED', 'SGSD_FLEET_COORDINATOR_ID',
        'OTEL_LOGS_EXPORTER', 'OTEL_METRICS_EXPORTER', 'OTEL_TRACES_EXPORTER')
    foreach ($key in $clear) {
        if (-not $saved.ContainsKey($key)) { $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
        [Environment]::SetEnvironmentVariable($key, $null, 'Process')
    }
    $env:CLAUDE_CODE_ENABLE_TELEMETRY = '0'
    $env:OTEL_LOGS_EXPORTER = 'none'; $env:OTEL_METRICS_EXPORTER = 'none'; $env:OTEL_TRACES_EXPORTER = 'none'
    $runtime = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'tools/telemetry-atlas/global.cjs'
    if (-not (Test-Path -LiteralPath $runtime)) {
        $runtime = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.claude/tools/telemetry-atlas/global.cjs'
    }
    if (-not (Test-Path -LiteralPath $runtime) -or -not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Warning 'Atlas capture unavailable: runtime missing'
        if ($managed) {
            foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') }
            throw 'Managed SGSD launch refused: Atlas runtime missing'
        }
        return $saved
    }
    try {
        $required = @(); if ($managed) { $required = @('--require-managed') }
        $raw = & node $runtime prepare --project-dir $ProjectDir --role $Role --format json @required
        $prepareExit = $LASTEXITCODE
        $result = ($raw -join "`n") | ConvertFrom-Json
        if ($managed -and ($prepareExit -ne 0 -or -not $result.enabled -or $result.environment.SGSD_FLEET_MANAGED -ne '1')) { throw 'Managed preparation refused' }
        if (-not $result.environment) { return $saved }
        foreach ($key in @($result.unset) + @($result.environment.PSObject.Properties.Name)) {
            if (-not $saved.ContainsKey($key)) { $saved[$key] = [Environment]::GetEnvironmentVariable($key, 'Process') }
        }
        foreach ($key in $result.unset) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
        foreach ($entry in $result.environment.PSObject.Properties) {
            [Environment]::SetEnvironmentVariable($entry.Name, [string]$entry.Value, 'Process')
        }
        if ($managed) {
            & node (Join-Path (Split-Path -Parent $runtime) 'monitor-schedule.cjs') include --project-dir $ProjectDir | Out-Null
            if ($LASTEXITCODE -ne 0) {
                & node $runtime abort --run-id $env:SGSD_RUN_ID 2>$null | Out-Null
                throw 'Monitor enrollment failed'
            }
        }
    } catch {
        if ($managed) {
            foreach ($key in $saved.Keys) { [Environment]::SetEnvironmentVariable($key, $saved[$key], 'Process') }
            throw 'Managed SGSD launch refused: Atlas/ownership unavailable; inspect session health'
        }
        Write-Warning 'Atlas capture unavailable; run the Atlas audit'
    }
    return $saved
}
function Restore-SgsdAtlas {
    param([hashtable]$Saved)
    if ($Saved -and $Saved.Count -gt 0) {
        Stop-SgsdAtlas
        foreach ($key in $Saved.Keys) { [Environment]::SetEnvironmentVariable($key, $Saved[$key], 'Process') }
    }
}
function Stop-SgsdAtlas {
    $nativeExitCode = $global:LASTEXITCODE
    try {
        if ($env:SGSD_RUN_ID) {
            $runtime = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'tools/telemetry-atlas/global.cjs'
            if (-not (Test-Path -LiteralPath $runtime)) { $runtime = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.claude/tools/telemetry-atlas/global.cjs' }
            if (Test-Path -LiteralPath $runtime) { & node $runtime finish --run-id $env:SGSD_RUN_ID 2>$null | Out-Null }
        }
    } catch {} finally { $global:LASTEXITCODE = $nativeExitCode }
}
