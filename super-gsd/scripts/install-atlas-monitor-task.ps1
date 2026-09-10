param(
    [switch]$Remove,
    [switch]$WhatIf,
    [switch]$RefreshOnly,
    [string]$ClientRoot = (Join-Path $env:LOCALAPPDATA 'SGSD\Atlas\devcp')
)
$ErrorActionPreference = 'Stop'
$atlasTaskName = 'SGSD-Atlas-Monitor'
$atlasDescription = 'SGSD Atlas verified DEVCP evidence pull; operator-authorized user scope.'
$atlasUser = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$atlasExisting = Get-ScheduledTask -TaskName $atlasTaskName -ErrorAction SilentlyContinue
if ($RefreshOnly -and -not $atlasExisting) { Write-Output 'No Atlas companion installed; no task created.'; return }
if ($atlasExisting -and $atlasExisting.Description -ne $atlasDescription) { throw 'Task name belongs to an unrecognized task; refusing replacement.' }
if ($Remove) {
    if ($WhatIf) { Write-Output 'Would remove only SGSD-Atlas-Monitor; evidence retained.'; return }
    if ($atlasExisting) { Unregister-ScheduledTask -TaskName $atlasTaskName -Confirm:$false }
    Write-Output 'Atlas pull task disabled. Local and DEVCP evidence retained.'
    return
}
$atlasSource = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\tools\telemetry-atlas')).Path
$atlasNode = (Get-Command node.exe -ErrorAction Stop).Source
$atlasRoot = [IO.Path]::GetFullPath($ClientRoot)
$atlasSourceFiles = @(Get-ChildItem -LiteralPath $atlasSource -File -Filter '*.cjs' | Sort-Object Name)
$atlasSourceRunner = Join-Path $PSScriptRoot 'sgsd-atlas-monitor.ps1'
$atlasDigestInput = (@($atlasSourceFiles | ForEach-Object { $_.Name + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }) + (Get-FileHash -LiteralPath $atlasSourceRunner -Algorithm SHA256).Hash) -join "`n"
$atlasHasher = [Security.Cryptography.SHA256]::Create()
try { $atlasVersion = [BitConverter]::ToString($atlasHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($atlasDigestInput))).Replace('-','').ToLowerInvariant().Substring(0,16) } finally { $atlasHasher.Dispose() }
$atlasRuntime = Join-Path $atlasRoot "runtime\$atlasVersion"
$atlasTools = Join-Path $atlasRuntime 'telemetry-atlas'
$atlasRunner = Join-Path $atlasRuntime 'sgsd-atlas-monitor.ps1'
if ($WhatIf) { @{ task=$atlasTaskName; user=$atlasUser; root=$atlasRoot; node=$atlasNode; interval_minutes=5; logon_catchup=$true; hidden=$true } | ConvertTo-Json; return }
# Never copy into a reparse-point destination. Existing evidence is not removed.
$atlasCursor = $atlasTools
while ($atlasCursor) {
    if (Test-Path -LiteralPath $atlasCursor) {
        if ((Get-Item -LiteralPath $atlasCursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unsafe Atlas destination reparse point.' }
    }
    $atlasParent = Split-Path -Parent $atlasCursor
    if ($atlasParent -eq $atlasCursor) { break }; $atlasCursor = $atlasParent
}
New-Item -ItemType Directory -Path $atlasTools -Force | Out-Null
$atlasSourceFiles | ForEach-Object {
    $atlasDestination = Join-Path $atlasTools $_.Name
    if ((Test-Path -LiteralPath $atlasDestination) -and ((Get-Item -LiteralPath $atlasDestination -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unsafe runtime destination.' }
    $atlasExpected = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    if (Test-Path -LiteralPath $atlasDestination) {
        if ((Get-FileHash -LiteralPath $atlasDestination -Algorithm SHA256).Hash -ne $atlasExpected) { throw 'Existing versioned runtime is inconsistent; refusing overwrite.' }
    } else { Copy-Item -LiteralPath $_.FullName -Destination $atlasDestination }
    if ((Get-FileHash -LiteralPath $atlasDestination -Algorithm SHA256).Hash -ne $atlasExpected) { throw 'Runtime copy hash mismatch.' }
}
if (-not (Test-Path -LiteralPath $atlasRunner)) { Copy-Item -LiteralPath $atlasSourceRunner -Destination $atlasRunner }
if ((Get-Item -LiteralPath $atlasRunner -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Unsafe runner destination.' }
if ((Get-FileHash -LiteralPath $atlasRunner -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $atlasSourceRunner -Algorithm SHA256).Hash) { throw 'Runtime runner hash mismatch.' }
& $atlasNode (Join-Path $atlasTools 'monitor-client.cjs') configure --root $atlasRoot | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Atlas client configuration failed.' }
$atlasPowerShell = Join-Path $PSHOME 'powershell.exe'
$atlasArguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}" -Action Pull -ClientRoot "{1}" -NodePath "{2}"' -f $atlasRunner,$atlasRoot,$atlasNode
$atlasAction = New-ScheduledTaskAction -Execute $atlasPowerShell -Argument $atlasArguments
$atlasTriggers = @(
    (New-ScheduledTaskTrigger -AtLogOn -User $atlasUser),
    (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5))
)
$atlasSettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
$atlasPrincipal = New-ScheduledTaskPrincipal -UserId $atlasUser -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $atlasTaskName -Action $atlasAction -Trigger $atlasTriggers -Settings $atlasSettings -Principal $atlasPrincipal -Description $atlasDescription -Force | Out-Null
$atlasShortcutPath = Join-Path $atlasRoot 'Open Atlas.lnk'
if ((Test-Path -LiteralPath $atlasShortcutPath) -and ((Get-Item -LiteralPath $atlasShortcutPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Unsafe shortcut destination.' }
$atlasShell = New-Object -ComObject WScript.Shell
try {
    $atlasShortcut = $atlasShell.CreateShortcut($atlasShortcutPath)
    if ((Test-Path -LiteralPath $atlasShortcutPath) -and $atlasShortcut.Description -ne $atlasDescription) { throw 'Unrecognized Atlas shortcut; refusing replacement.' }
    $atlasShortcut.TargetPath = $atlasPowerShell
    $atlasShortcut.Arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -File "{0}" -Action Open -ClientRoot "{1}" -NodePath "{2}"' -f $atlasRunner,$atlasRoot,$atlasNode
    $atlasShortcut.Description = $atlasDescription
    $atlasShortcut.WindowStyle = 7
    $atlasShortcut.Save()
} finally { if ($atlasShell) { [void][Runtime.InteropServices.Marshal]::ReleaseComObject($atlasShell) } }
@{ task=$atlasTaskName; status='installed'; root=$atlasRoot; runner=$atlasRunner; node=$atlasNode; shortcut=$atlasShortcutPath; note='Delivery needs an awake signed-in session and working SSH. No password stored.' } | ConvertTo-Json
