# ============================================================================
# sgsd-update.ps1 — DLB-06 Wave A (PowerShell mirror of sgsd-update.sh)
# ============================================================================
# Wraps git pull + install.sh against the canonical super-gsd source clone.
#
# Usage:
#   sgsd-update.ps1                  (update + re-install)
#   sgsd-update.ps1 -Check           (check drift, no changes)
#   sgsd-update.ps1 -NoInstall       (pull only)
#   sgsd-update.ps1 -Source PATH     (override source location)
# ============================================================================

param(
    [switch]$Check,
    [switch]$NoInstall,
    [string]$Source = "$HOME\.claude\super-gsd\source"
)

$ErrorActionPreference = "Continue"
$repoSsh = "git@github.com:Berrowj/super-gsd.git"
$repoHttps = "https://github.com/Berrowj/super-gsd.git"

function Log($msg) { Write-Host "  [sgsd-update] $msg" }

function Get-SgsdGitBash {
    $resolved = Get-Command bash -All -ErrorAction SilentlyContinue |
        Where-Object { $_.Source -notmatch 'System32' -and $_.Source -notmatch 'WindowsApps' } |
        Select-Object -First 1 -ExpandProperty Source
    if ($resolved) { return $resolved }

    $candidates = @(
        (Join-Path ${env:ProgramFiles} "Git\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles} "Git\usr\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Git\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Git\usr\bin\bash.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Git\bin\bash.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Git\usr\bin\bash.exe")
    ) | Where-Object { $_ -and (Test-Path $_) }
    return ($candidates | Select-Object -First 1)
}

# Clone source if missing
if (-not (Test-Path (Join-Path $Source ".git"))) {
    if ($Check) {
        Log "Source not present at $Source. Run without -Check to clone."
        exit 1
    }
    Log "Source clone not present. Cloning to $Source..."
    $parent = Split-Path -Parent $Source
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    & git clone $repoSsh $Source
    if ($LASTEXITCODE -ne 0) {
        Log "SSH clone failed, trying HTTPS..."
        & git clone $repoHttps $Source
        if ($LASTEXITCODE -ne 0) {
            Log "Clone failed. Check network + credentials."
            exit 3
        }
    }
}

# Check mode
if ($Check) {
    $localSha = & git -C $Source rev-parse HEAD 2>$null
    # 3s timeout ls-remote for offline-safety
    $remoteShaOutput = & git -C $Source ls-remote origin HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $remoteShaOutput) {
        Log "Could not reach upstream (network/VPN/offline). Last known: $localSha"
        exit 0
    }
    $remoteSha = ($remoteShaOutput -split "`t")[0]

    if ($localSha -eq $remoteSha) {
        Log "Up to date with origin/master ($localSha)"
        exit 0
    }

    $commitsBehind = & git -C $Source rev-list --count "HEAD..origin/master" 2>$null
    if (-not $commitsBehind) { $commitsBehind = "?" }
    Log "Drift detected: local=$localSha upstream=$remoteSha ($commitsBehind commits behind)"
    exit 10
}

# Update path
Log "Pulling latest from origin/master..."
& git -C $Source pull origin master
if ($LASTEXITCODE -ne 0) {
    Log "Pull failed. Check network + conflicts."
    exit 4
}

if ($NoInstall) {
    Log "Pull complete (install skipped per -NoInstall)"
    exit 0
}

# Re-run installer. --init-project only if .planning/ present in cwd.
$installArgs = @()
if (Test-Path ".\.planning") {
    $installArgs += "--init-project"
}

Log "Running installer..."
$installScript = Join-Path $Source "super-gsd\install.sh"
$bashExe = Get-SgsdGitBash
if (-not $bashExe) {
    Log "Git Bash not found. Install Git for Windows or run install.sh from a real bash."
    exit 5
}
& $bashExe $installScript @installArgs
if ($LASTEXITCODE -ne 0) {
    Log "Installer exited non-zero (see above)"
    exit 5
}

# Write .super-gsd-version for current project if .planning/ exists
if (Test-Path ".\.planning") {
    $currentSha = & git -C $Source rev-parse HEAD
    Set-Content -Path ".\.super-gsd-version" -Value $currentSha -NoNewline
    Log "Wrote .super-gsd-version = $currentSha"
}

Log "sgsd-update complete."
