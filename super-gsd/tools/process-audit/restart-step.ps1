param(
    [int[]]$Kill = @(18524, 20460, 26732),
    [string]$ProjectDir = "C:\Users\user\project-clarity-erp"
)

$ErrorActionPreference = "SilentlyContinue"

Write-Host "=== 1. Killing old SGSD dashboards ===" -ForegroundColor Yellow
# Target by script name, not PID — PIDs change each relaunch.
$matches = @(Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" |
             Where-Object { $_.CommandLine -match 'sgsd-(mission-control|narrative|gate-verdict)\.ps1' })
if ($matches.Count -eq 0) {
    Write-Host "  (no SGSD dashboard processes running)" -ForegroundColor DarkGray
} else {
    foreach ($m in $matches) {
        $script = if ($m.CommandLine -match 'sgsd-[a-z\-]+\.ps1') { $Matches[0] } else { '?' }
        Write-Host ("  kill {0,-6} {1}" -f $m.ProcessId, $script)
        Stop-Process -Id $m.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Milliseconds 500

Write-Host ""
Write-Host "=== 2. Clearing narrative failStamp + stale lock ===" -ForegroundColor Yellow
$metrics = Join-Path $ProjectDir ".planning\metrics"
foreach ($f in @("narrative.md.lastfail", "narrative.md.lock", "narrative.md.lastattempt")) {
    $p = Join-Path $metrics $f
    if (Test-Path $p) {
        Remove-Item $p -Force -ErrorAction SilentlyContinue
        Write-Host "  removed $f"
    } else {
        Write-Host "  $f absent" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "=== 3. Probing 'claude --print' with Haiku model ===" -ForegroundColor Yellow
$probeOut = Join-Path $metrics "narrative-probe.out"
$probeErr = Join-Path $metrics "narrative-probe.err"
Remove-Item $probeOut, $probeErr -Force -ErrorAction SilentlyContinue

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'cmd.exe'
$psi.Arguments = '/c claude --print --dangerously-skip-permissions --model claude-haiku-4-5-20251001'
$psi.RedirectStandardInput  = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError  = $true
$psi.UseShellExecute = $false
$psi.CreateNoWindow  = $true

$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.Write("Respond with exactly: PROBE OK")
    $proc.StandardInput.Close()
    if ($proc.WaitForExit(30000)) {
        $stdout = $proc.StandardOutput.ReadToEnd()
        $stderr = $proc.StandardError.ReadToEnd()
        Set-Content -Path $probeOut -Value $stdout -Encoding utf8
        Set-Content -Path $probeErr -Value $stderr -Encoding utf8
        Write-Host "  exit code: $($proc.ExitCode)"
        Write-Host "  elapsed:   $($sw.ElapsedMilliseconds) ms"
        Write-Host "  stdout ($($stdout.Length) chars): $(($stdout -replace '\s+', ' ').Substring(0, [Math]::Min(200, $stdout.Length)))"
        if ($stderr) {
            Write-Host "  stderr ($($stderr.Length) chars):" -ForegroundColor Red
            Write-Host "  $(($stderr -replace '`r`n', ' | ' ).Substring(0, [Math]::Min(500, $stderr.Length)))" -ForegroundColor Red
        }
    } else {
        Write-Host "  TIMEOUT at 30s" -ForegroundColor Red
        try { $proc.Kill() } catch {}
    }
} catch {
    Write-Host "  spawn failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== 4. Relaunch command (paste in each Windows Terminal pane) ===" -ForegroundColor Yellow
Write-Host '  powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\user\GSDedits\super-gsd\scripts\sgsd-mission-control.ps1" -ProjectDir "C:\Users\user\project-clarity-erp"' -ForegroundColor Cyan
Write-Host '  powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\user\GSDedits\super-gsd\scripts\sgsd-narrative.ps1"        -ProjectDir "C:\Users\user\project-clarity-erp"' -ForegroundColor Cyan
Write-Host '  powershell -NoProfile -ExecutionPolicy Bypass -File "C:\Users\user\GSDedits\super-gsd\scripts\sgsd-gate-verdict.ps1"     -ProjectDir "C:\Users\user\project-clarity-erp"' -ForegroundColor Cyan
