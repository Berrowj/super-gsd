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

# Prefer the global install at ~/.claude/super-gsd/scripts/ as the recorded
# fallback path if it exists. That way the sgsd function works from any
# project, not just the source checkout. install.sh writes there in Step 6b.
$GlobalBoot = Join-Path $HOME ".claude\super-gsd\scripts\sgsd-boot.ps1"
if (Test-Path $GlobalBoot) {
    $BootScript = $GlobalBoot
}

# Resolve all profile paths we care about. Write to BOTH so the function is
# available no matter which one the user's PowerShell host actually loads.
#   CurrentUserCurrentHost = Microsoft.PowerShell_profile.ps1 (the default $PROFILE)
#   CurrentUserAllHosts    = profile.ps1 (shared across PowerShell hosts)
$ProfilePaths = @()
if ($PROFILE.CurrentUserCurrentHost) { $ProfilePaths += $PROFILE.CurrentUserCurrentHost }
if ($PROFILE.CurrentUserAllHosts)    { $ProfilePaths += $PROFILE.CurrentUserAllHosts }
if ($ProfilePaths.Count -eq 0 -and $PROFILE) { $ProfilePaths += $PROFILE }

# De-dup in case CurrentUserCurrentHost == CurrentUserAllHosts in some hosts
$ProfilePaths = $ProfilePaths | Select-Object -Unique

foreach ($p in $ProfilePaths) {
    $d = Split-Path -Parent $p
    if ($d -and -not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

# The original single-path code below rewrites $ProfilePath once per iteration.
# We'll loop over $ProfilePaths at install/uninstall time.

# Block markers for idempotent edits
$StartMarker = "# >>> SUPER-GSD sgsd shortcut (DLB-04) >>>"
$EndMarker   = "# <<< SUPER-GSD sgsd shortcut <<<"

# ----------------------------------------------------------------------------
# UNINSTALL path
# ----------------------------------------------------------------------------
if ($Uninstall) {
    $removed = 0
    foreach ($ProfilePath in $ProfilePaths) {
        if (-not (Test-Path $ProfilePath)) { continue }
        $content = Get-Content $ProfilePath -Raw
        if ($content -notmatch [regex]::Escape($StartMarker)) { continue }
        $pattern = [regex]::Escape($StartMarker) + '[\s\S]*?' + [regex]::Escape($EndMarker) + "(\r?\n)?"
        $cleaned = [regex]::Replace($content, $pattern, "")
        Set-Content -Path $ProfilePath -Value $cleaned -NoNewline
        Write-Host "Removed sgsd shortcut from $ProfilePath" -ForegroundColor Green
        $removed++
    }
    if ($removed -eq 0) {
        Write-Host "sgsd shortcut not present in any profile - nothing to remove." -ForegroundColor Yellow
    } else {
        Write-Host "Open a new PowerShell window to drop the function." -ForegroundColor DarkGray
    }
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
        [switch]`$Bootstrap,
        [switch]`$Help,
        [string]`$ProjectDir = `$null
    )

    if (`$Help) {
        Write-Host 'sgsd - Super GSD cockpit boot' -ForegroundColor Magenta
        Write-Host '  sgsd                 Boot cockpit (preflight + 3 dashboards)'
        Write-Host '  sgsd -NoOpen         Preflight only'
        Write-Host '  sgsd -SkipPreflight  Skip checks, just open dashboards'
        Write-Host '  sgsd -Bootstrap      Create minimal .brv/context-tree in place'
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
    if (`$Bootstrap)      { `$args += '-Bootstrap' }

    & powershell.exe @args
}
$EndMarker
"@

# Write to every profile path we discovered so the function is loaded
# regardless of which profile the user's PowerShell host chooses to run.
$installed = @()
$skipped   = @()
foreach ($ProfilePath in $ProfilePaths) {
    if (Test-Path $ProfilePath) {
        $existing = Get-Content $ProfilePath -Raw
        if ($existing -match [regex]::Escape($StartMarker) -and -not $Force) {
            $skipped += $ProfilePath
            continue
        }
        if ($Force -and ($existing -match [regex]::Escape($StartMarker))) {
            $pattern = [regex]::Escape($StartMarker) + '[\s\S]*?' + [regex]::Escape($EndMarker) + "(\r?\n)?"
            $existing = [regex]::Replace($existing, $pattern, "")
        }
        if ($existing -and -not $existing.EndsWith("`n")) {
            $existing += "`r`n"
        }
        $newContent = $existing + "`r`n" + $functionBlock + "`r`n"
    } else {
        $newContent = $functionBlock + "`r`n"
    }
    Set-Content -Path $ProfilePath -Value $newContent -NoNewline
    $installed += $ProfilePath
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  sgsd shortcut INSTALLED                       " -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta
foreach ($p in $installed) {
    Write-Host "  + $p" -ForegroundColor Green
}
foreach ($p in $skipped) {
    Write-Host "  = $p  (already present, use -Force to replace)" -ForegroundColor DarkGray
}
if ($installed.Count -eq 0 -and $skipped.Count -eq 0) {
    Write-Host "  NO profile paths resolved - this is unusual." -ForegroundColor Red
}
Write-Host "  Install root: $InstallRoot" -ForegroundColor DarkGray
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
