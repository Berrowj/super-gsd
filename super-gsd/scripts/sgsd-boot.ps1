# ============================================================================
# Super GSD - Boot Command
# ============================================================================
# One-command cockpit launcher. Preflights the substrate, refreshes the
# Agents registry, then opens the three live dashboards (SGSD1/2/3) in a
# single Windows Terminal window with three panes.
#
# Falls back to three separate PowerShell windows if Windows Terminal (wt.exe)
# is not installed.
#
# Usage:
#   powershell -File super-gsd/scripts/sgsd-boot.ps1
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -ProjectDir C:\path
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -SkipPreflight
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -NoOpen   # preflight only
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [switch]$SkipPreflight,
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "SGSD Boot"

try {
    $ProjectDir = (Resolve-Path $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve $ProjectDir" -ForegroundColor Red
    exit 1
}

$ScriptsDir = Join-Path $PSScriptRoot ""
if (-not (Test-Path $ScriptsDir)) {
    Write-Host "ERROR: Cannot locate scripts directory at $ScriptsDir" -ForegroundColor Red
    exit 1
}

function Write-Step($label, $status, $color) {
    Write-Host ("  [{0}] " -f $status) -NoNewline -ForegroundColor $color
    Write-Host $label
}

function Banner {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Magenta
    Write-Host "          SUPER GSD - Boot Command              " -ForegroundColor Magenta
    Write-Host "================================================" -ForegroundColor Magenta
    Write-Host "  Project: $ProjectDir" -ForegroundColor DarkGray
    Write-Host ""
}

Banner

# ----------------------------------------------------------------------------
# PREFLIGHT - verify the substrate is healthy before opening dashboards
# ----------------------------------------------------------------------------
if (-not $SkipPreflight) {
    Write-Host "PREFLIGHT" -ForegroundColor White
    Write-Host "---------"

    # 1. .planning/ exists
    $planning = Join-Path $ProjectDir ".planning"
    if (Test-Path $planning) {
        Write-Step ".planning/ present" "OK" Green
    } else {
        Write-Step ".planning/ missing - run bash super-gsd/install.sh --init-project first" "FAIL" Red
        exit 2
    }

    # 2. .brv/context-tree/INDEX.md exists
    $indexPath = Join-Path $ProjectDir ".brv/context-tree/INDEX.md"
    if (Test-Path $indexPath) {
        Write-Step ".brv/context-tree/INDEX.md present" "OK" Green
    } else {
        Write-Step "INDEX.md missing - memory tier not initialized" "FAIL" Red
        exit 3
    }

    # 3. curate-pipe smoke test (DLB-04 Day 0 gate)
    $curate = Join-Path $ScriptsDir "sgsd-curate.sh"
    if (Test-Path $curate) {
        $smokeSlug = "boot-smoke-test"
        $smokeFile = Join-Path $ProjectDir ".brv/context-tree/patterns/$smokeSlug.md"
        # Pre-clean
        if (Test-Path $smokeFile) { Remove-Item $smokeFile -Force -ErrorAction SilentlyContinue }
        $indexBackup = Get-Content $indexPath -Raw -ErrorAction SilentlyContinue

        $bashCmd = "echo 'boot smoke' | bash '$($curate -replace '\\','/')' --type pattern --slug '$smokeSlug' --summary 'boot preflight' --root '$($ProjectDir -replace '\\','/')' 2>&1"
        $smokeOutput = & bash -c $bashCmd 2>&1
        $landed = (Test-Path $smokeFile) -and ((Get-Content $indexPath -Raw) -match [regex]::Escape("| $smokeSlug |"))

        if ($landed) {
            Write-Step "curate write-pipe smoke test" "OK" Green
            # Clean up
            Remove-Item $smokeFile -Force -ErrorAction SilentlyContinue
            $cleanIndex = (Get-Content $indexPath) | Where-Object { $_ -notmatch [regex]::Escape("| $smokeSlug |") }
            $cleanIndex -join "`n" | Set-Content $indexPath -NoNewline
        } else {
            Write-Step "curate write-pipe smoke test - DLB-04 Day 0 blocker" "FAIL" Red
            Write-Host "    Repro: $bashCmd" -ForegroundColor DarkGray
            Write-Host "    Output: $smokeOutput" -ForegroundColor DarkGray
            exit 4
        }
    } else {
        Write-Step "sgsd-curate.sh not found - skipping smoke test" "WARN" Yellow
    }

    # 4. Agents registry refresh (DLB-04 Wave A)
    $registrySync = Join-Path $ScriptsDir "sgsd-registry-sync.sh"
    if (Test-Path $registrySync) {
        $bashCmd = "bash '$($registrySync -replace '\\','/')' --root '$($ProjectDir -replace '\\','/')' 2>&1"
        $syncOutput = & bash -c $bashCmd 2>&1
        if ($LASTEXITCODE -eq 0) {
            $countMatch = ($syncOutput -join " ") -match "(\d+) agent records"
            $count = if ($countMatch) { $Matches[1] } else { "?" }
            Write-Step "Agents registry synced ($count agents)" "OK" Green
        } else {
            Write-Step "Agents registry sync failed (non-blocking)" "WARN" Yellow
        }
    }

    # 5. Substrate status summary
    $helper = Join-Path $PSScriptRoot "lib\sgsd-substrate-status.ps1"
    if (Test-Path $helper) {
        . $helper
        $status = Get-SubstrateStatus -ProjectDir $ProjectDir
        $line = Format-SubstrateStatusLine -Status $status
        Write-Host ""
        Write-Host "  DLB-04 $line" -ForegroundColor Magenta
    }

    Write-Host ""
}

# ----------------------------------------------------------------------------
# LAUNCH - open the three dashboards in Windows Terminal
# ----------------------------------------------------------------------------
if ($NoOpen) {
    Write-Host "NoOpen flag set - skipping dashboard launch." -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "Start manually with:"
    Write-Host "  powershell -File super-gsd/scripts/sgsd-mission-control.ps1 -ProjectDir '$ProjectDir'"
    Write-Host "  powershell -File super-gsd/scripts/sgsd-narrative.ps1       -ProjectDir '$ProjectDir'"
    Write-Host "  powershell -File super-gsd/scripts/sgsd-gate-verdict.ps1    -ProjectDir '$ProjectDir'"
    exit 0
}

Write-Host "LAUNCH" -ForegroundColor White
Write-Host "------"

$sgsd1 = Join-Path $ScriptsDir "sgsd-mission-control.ps1"
$sgsd2 = Join-Path $ScriptsDir "sgsd-narrative.ps1"
$sgsd3 = Join-Path $ScriptsDir "sgsd-gate-verdict.ps1"

foreach ($script in @($sgsd1, $sgsd2, $sgsd3)) {
    if (-not (Test-Path $script)) {
        Write-Host "  MISSING: $script" -ForegroundColor Red
        exit 5
    }
}

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue

if ($wt) {
    # Windows Terminal - open one window with three panes:
    #   left:       SGSD1 mission control
    #   right-top:  SGSD2 narrative
    #   right-bot:  SGSD3 gate verdict
    $psCmd = "powershell.exe"
    $launchArgs = @(
        "new-tab", "--title", "SGSD-Cockpit",
        $psCmd, "-NoExit", "-NoProfile", "-File", $sgsd1, "-ProjectDir", $ProjectDir,
        ";", "split-pane", "-V", "--title", "SGSD2",
        $psCmd, "-NoExit", "-NoProfile", "-File", $sgsd2, "-ProjectDir", $ProjectDir,
        ";", "split-pane", "-H", "--title", "SGSD3",
        $psCmd, "-NoExit", "-NoProfile", "-File", $sgsd3, "-ProjectDir", $ProjectDir
    )

    Write-Step "Windows Terminal detected" "OK" Green
    Write-Host "  Opening SGSD1/2/3 in a single cockpit window..."
    Start-Process -FilePath "wt.exe" -ArgumentList $launchArgs
    Start-Sleep -Milliseconds 500
    Write-Host ""
    Write-Host "Cockpit launched." -ForegroundColor Green
} else {
    # Fallback - three separate PowerShell windows
    Write-Step "Windows Terminal not found - using separate PowerShell windows" "WARN" Yellow

    Start-Process powershell.exe -ArgumentList "-NoExit", "-NoProfile", "-File", $sgsd1, "-ProjectDir", $ProjectDir
    Start-Sleep -Milliseconds 300
    Start-Process powershell.exe -ArgumentList "-NoExit", "-NoProfile", "-File", $sgsd2, "-ProjectDir", $ProjectDir
    Start-Sleep -Milliseconds 300
    Start-Process powershell.exe -ArgumentList "-NoExit", "-NoProfile", "-File", $sgsd3, "-ProjectDir", $ProjectDir

    Write-Host ""
    Write-Host "Three dashboards opened in separate windows." -ForegroundColor Green
    Write-Host "Install Windows Terminal for a single-window cockpit: https://aka.ms/terminal" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "Next actions:"
Write-Host "  1. In a second PowerShell, cd to the project and start Claude Code:"
Write-Host "     claude"
Write-Host "  2. In Claude Code, say:  go"
Write-Host "  3. Watch the three dashboards for live state."
Write-Host ""
Write-Host "  To pause anytime:  /sgsd-pause"
Write-Host "  To resume:         /sgsd-resume"
Write-Host ""
