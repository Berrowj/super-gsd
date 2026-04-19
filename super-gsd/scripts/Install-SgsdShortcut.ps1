# ============================================================================
# Super GSD - Install sgsd shortcut
# ============================================================================
# Adds a `sgsd` PowerShell function to your $PROFILE so you can boot the
# cockpit from any directory just by typing:
#
#     sgsd                 # boot cockpit (preflight + 3 dashboards)
#     sgsd -NoOpen         # preflight only
#     sgsd -SkipPreflight  # skip checks, just open dashboards
#     sgsd -Help           # show flags
#
# The installed function walks up the current directory looking for a
# super-gsd/scripts/sgsd-boot.ps1 to invoke. Falls back to the install path
# recorded when you ran this installer.
#
# Usage:
#     powershell -File super-gsd/scripts/Install-SgsdShortcut.ps1
#
# Uninstall:
#     powershell -File super-gsd/scripts/Install-SgsdShortcut.ps1 -Uninstall
# ============================================================================

param(
    [switch]$Uninstall,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# Discover the install path (this script's grandparent directory)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InstallRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BootScript = Join-Path $ScriptDir "sgsd-boot.ps1"

if (-not (Test-Path $BootScript)) {
    Write-Host "ERROR: Cannot find sgsd-boot.ps1 at $BootScript" -ForegroundColor Red
    Write-Host "Run this installer from inside super-gsd/scripts/." -ForegroundColor DarkGray
    exit 1
}

# Resolve PowerShell profile path
$ProfilePath = $PROFILE.CurrentUserAllHosts
if (-not $ProfilePath) { $ProfilePath = $PROFILE }

# Ensure profile directory exists
$profileDir = Split-Path -Parent $ProfilePath
if (-not (Test-Path $profileDir)) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# Block markers for idempotent edits
$StartMarker = "# >>> SUPER-GSD sgsd shortcut (DLB-04) >>>"
$EndMarker   = "# <<< SUPER-GSD sgsd shortcut <<<"

# ----------------------------------------------------------------------------
# UNINSTALL path
# ----------------------------------------------------------------------------
if ($Uninstall) {
    if (-not (Test-Path $ProfilePath)) {
        Write-Host "Profile not found at $ProfilePath - nothing to remove." -ForegroundColor Yellow
        exit 0
    }
    $content = Get-Content $ProfilePath -Raw
    if ($content -notmatch [regex]::Escape($StartMarker)) {
        Write-Host "sgsd shortcut not present in profile - nothing to remove." -ForegroundColor Yellow
        exit 0
    }
    # Strip block (non-greedy)
    $pattern = [regex]::Escape($StartMarker) + '[\s\S]*?' + [regex]::Escape($EndMarker) + "(\r?\n)?"
    $cleaned = [regex]::Replace($content, $pattern, "")
    Set-Content -Path $ProfilePath -Value $cleaned -NoNewline
    Write-Host "Removed sgsd shortcut from $ProfilePath" -ForegroundColor Green
    Write-Host "Run 'refreshenv' or open a new shell to drop the function." -ForegroundColor DarkGray
    exit 0
}

# ----------------------------------------------------------------------------
# INSTALL path
# ----------------------------------------------------------------------------
$functionBlock = @"
$StartMarker
# Super GSD cockpit boot shortcut. Walks up from current directory to find
# a super-gsd/scripts/sgsd-boot.ps1; falls back to the install path recorded
# below. Edit the fallback path if you move the install.
function sgsd {
    [CmdletBinding()]
    param(
        [switch]`$NoOpen,
        [switch]`$SkipPreflight,
        [switch]`$Help,
        [string]`$ProjectDir = `$null
    )

    if (`$Help) {
        Write-Host 'sgsd - Super GSD cockpit boot' -ForegroundColor Magenta
        Write-Host '  sgsd                 Boot cockpit (preflight + 3 dashboards)'
        Write-Host '  sgsd -NoOpen         Preflight only'
        Write-Host '  sgsd -SkipPreflight  Skip checks, just open dashboards'
        Write-Host '  sgsd -ProjectDir X   Explicit project directory'
        Write-Host '  sgsd -Help           This help'
        return
    }

    # Find the boot script: walk up from cwd looking for super-gsd/scripts/sgsd-boot.ps1
    `$bootScript = `$null
    `$projectRoot = `$null
    `$d = (Get-Location).Path
    while (`$d -and `$d -ne (Split-Path -Parent `$d)) {
        `$candidate = Join-Path `$d 'super-gsd\scripts\sgsd-boot.ps1'
        if (Test-Path `$candidate) {
            `$bootScript = `$candidate
            `$projectRoot = `$d
            break
        }
        `$d = Split-Path -Parent `$d
    }

    # Fallback to the install path recorded at installer run time
    if (-not `$bootScript) {
        `$bootScript = '$BootScript'
        if (-not (Test-Path `$bootScript)) {
            Write-Host "ERROR: sgsd-boot.ps1 not found. Reinstall: powershell -File $ScriptDir\Install-SgsdShortcut.ps1" -ForegroundColor Red
            return
        }
        `$projectRoot = (Get-Location).Path
    }

    if (-not `$ProjectDir) { `$ProjectDir = `$projectRoot }

    `$args = @('-File', `$bootScript, '-ProjectDir', `$ProjectDir)
    if (`$NoOpen)         { `$args += '-NoOpen' }
    if (`$SkipPreflight)  { `$args += '-SkipPreflight' }

    & powershell.exe @args
}
$EndMarker
"@

# Read existing profile (if any)
if (Test-Path $ProfilePath) {
    $existing = Get-Content $ProfilePath -Raw
    if ($existing -match [regex]::Escape($StartMarker) -and -not $Force) {
        Write-Host "sgsd shortcut already present in $ProfilePath" -ForegroundColor Yellow
        Write-Host "Use -Force to replace it, or -Uninstall to remove it first." -ForegroundColor DarkGray
        exit 0
    }
    if ($Force -and ($existing -match [regex]::Escape($StartMarker))) {
        $pattern = [regex]::Escape($StartMarker) + '[\s\S]*?' + [regex]::Escape($EndMarker) + "(\r?\n)?"
        $existing = [regex]::Replace($existing, $pattern, "")
    }
    # Append new block, ensure newline separation
    if ($existing -and -not $existing.EndsWith("`n")) {
        $existing += "`r`n"
    }
    $newContent = $existing + "`r`n" + $functionBlock + "`r`n"
} else {
    $newContent = $functionBlock + "`r`n"
}

Set-Content -Path $ProfilePath -Value $newContent -NoNewline

Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  sgsd shortcut INSTALLED                       " -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  Profile: $ProfilePath" -ForegroundColor DarkGray
Write-Host "  Install: $InstallRoot" -ForegroundColor DarkGray
Write-Host ""
Write-Host "To activate in the current shell:" -ForegroundColor White
Write-Host "  . `$PROFILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "Or open a new PowerShell window, then run:"
Write-Host "  sgsd          " -NoNewline -ForegroundColor Cyan
Write-Host "(boot cockpit)"
Write-Host "  sgsd -NoOpen  " -NoNewline -ForegroundColor Cyan
Write-Host "(preflight only)"
Write-Host "  sgsd -Help    " -NoNewline -ForegroundColor Cyan
Write-Host "(all flags)"
Write-Host ""

# Check execution policy — PowerShell profiles won't load under Restricted
try {
    $policy = Get-ExecutionPolicy -Scope CurrentUser
    if ($policy -eq "Restricted") {
        Write-Host "WARNING: Your CurrentUser execution policy is Restricted." -ForegroundColor Yellow
        Write-Host "Profiles won't load. To fix once:" -ForegroundColor Yellow
        Write-Host "  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned" -ForegroundColor Cyan
        Write-Host ""
    }
} catch { }
