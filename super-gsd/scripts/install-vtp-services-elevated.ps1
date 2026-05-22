# Bootstrap wrapper for the VTP-MCP service install.
# Hardcodes the NSSM + Node paths to avoid terminal copy-paste mangling.
# Run as Administrator (right-click PowerShell -> Run as administrator).

$ErrorActionPreference = 'Stop'

$projectRoot = 'C:\Users\user\Voice-Text-Plan'
$installer   = Join-Path $projectRoot 'super-gsd\scripts\install-vtp-remote-services.ps1'
$nssmPath    = 'C:\Users\user\AppData\Local\Microsoft\WinGet\Packages\NSSM.NSSM_Microsoft.Winget.Source_8wekyb3d8bbwe\nssm-2.24-101-g897c7ad\win64\nssm.exe'
$nodeExe     = 'C:\Program Files\nodejs\node.exe'

foreach ($p in @($projectRoot, $installer, $nssmPath, $nodeExe)) {
  if (-not (Test-Path $p)) {
    Write-Host "MISSING: $p" -ForegroundColor Red
    exit 2
  }
}
Write-Host "All paths verified - invoking installer..." -ForegroundColor Cyan

& $installer -NssmPath $nssmPath -NodeExe $nodeExe -ProjectRoot $projectRoot
