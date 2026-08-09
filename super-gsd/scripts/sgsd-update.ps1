# ============================================================================
# sgsd-update.ps1 — DLB-06 Wave A (PowerShell mirror of sgsd-update.sh)
# ============================================================================
# Guarded fast-forward + install.sh wrapper for the canonical source clone.
#
# Usage:
#   sgsd-update.ps1                  (update + re-install)
#   sgsd-update.ps1 -Check           (check drift, no changes)
#   sgsd-update.ps1 -NoInstall       (fast-forward only)
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

function Assert-TrustedOrigin {
    $originRows = @(& git -C $Source remote get-url --all origin 2>&1)
    if ($LASTEXITCODE -ne 0 -or $originRows.Count -eq 0) {
        Log "Could not resolve canonical source origin; refusing remote access."
        exit 6
    }
    foreach ($originRow in $originRows) {
        $originUrl = "$originRow".Trim()
        if ($originUrl -cnotmatch '^(?:git@github\.com:|https://github\.com/|ssh://git@github\.com/)Berrowj/super-gsd(?:\.git)?$') {
            Log "Untrusted origin URL; expected canonical github.com/Berrowj/super-gsd: $originUrl"
            exit 6
        }
    }
}

function Assert-CleanSource($Stage) {
    $statusRows = @(& git -C $Source status --porcelain=v1 --untracked-files=normal 2>&1)
    if ($LASTEXITCODE -ne 0) {
        Log "Could not inspect canonical source state before $Stage."
        exit 6
    }
    if ($statusRows.Count -ne 0) {
        Log "Canonical source is dirty before $Stage; no update was attempted."
        $statusRows | ForEach-Object { Write-Error $_ }
        exit 6
    }
}

function Get-SourceHead($Stage) {
    $headRows = @(& git -C $Source rev-parse --verify "HEAD^{commit}" 2>$null)
    if ($LASTEXITCODE -ne 0 -or $headRows.Count -ne 1) {
        Log "Could not resolve canonical source HEAD $Stage."
        exit 6
    }
    return $headRows[0].Trim()
}

function Assert-CapturedHead($ExpectedSha, $Stage) {
    $actualSha = Get-SourceHead $Stage
    if ($actualSha -ne $ExpectedSha) {
        Log "Canonical source SHA mismatch ${Stage}: expected=$ExpectedSha actual=$actualSha"
        exit 6
    }
}

function Write-AtomicProjectPin($PinPath, $Sha) {
    $pinDirectory = Split-Path -Parent $PinPath
    $pinLeaf = Split-Path -Leaf $PinPath
    $temporaryPin = Join-Path $pinDirectory ".$pinLeaf.tmp.$PID.$([Guid]::NewGuid().ToString('N'))"
    try {
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [IO.File]::WriteAllText($temporaryPin, "$Sha`n", $utf8NoBom)
        if ([IO.File]::Exists($PinPath)) {
            [IO.File]::Replace($temporaryPin, $PinPath, $null)
        } else {
            [IO.File]::Move($temporaryPin, $PinPath)
        }
    } catch {
        if ([IO.File]::Exists($temporaryPin)) { [IO.File]::Delete($temporaryPin) }
        Log "Could not atomically write $PinPath`: $($_.Exception.Message)"
        exit 6
    }
}

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

Assert-TrustedOrigin

# Check mode
if ($Check) {
    $localRows = @(& git -C $Source rev-parse --verify "refs/heads/master^{commit}" 2>$null)
    if ($LASTEXITCODE -ne 0 -or $localRows.Count -ne 1) {
        Log "Could not resolve local refs/heads/master."
        exit 6
    }
    $localSha = $localRows[0].Trim()
    $remoteRows = @(& git -C $Source ls-remote origin refs/heads/master 2>$null)
    if ($LASTEXITCODE -ne 0 -or $remoteRows.Count -ne 1) {
        Log "Could not reach upstream (network/VPN/offline). Last known: $localSha"
        exit 0
    }
    $remoteSha = (($remoteRows[0] -split '\s+')[0]).Trim()

    if ($localSha -eq $remoteSha) {
        Log "Up to date with origin/master ($localSha)"
        exit 0
    }

    $commitsBehind = & git -C $Source rev-list --count "$localSha..$remoteSha" 2>$null
    if (-not $commitsBehind) { $commitsBehind = "?" }
    Log "Drift detected: local=$localSha upstream=$remoteSha ($commitsBehind commits behind)"
    exit 10
}

# Update path
Assert-CleanSource "fetch"
$localSha = Get-SourceHead "before fetch"

Log "Fetching origin/master..."
& git -C $Source fetch origin "refs/heads/master:refs/remotes/origin/master"
if ($LASTEXITCODE -ne 0) {
    Log "Fetch failed. Check network + credentials."
    exit 4
}

$fetchedRows = @(& git -C $Source rev-parse --verify "FETCH_HEAD^{commit}" 2>$null)
if ($LASTEXITCODE -ne 0 -or $fetchedRows.Count -ne 1) {
    Log "Fetch completed but FETCH_HEAD could not be resolved to one commit."
    exit 4
}
$fetchedSha = $fetchedRows[0].Trim()
$trackingRows = @(& git -C $Source rev-parse --verify "refs/remotes/origin/master^{commit}" 2>$null)
if ($LASTEXITCODE -ne 0 -or $trackingRows.Count -ne 1) {
    Log "Fetch completed but refs/remotes/origin/master could not be resolved."
    exit 4
}
$trackingSha = $trackingRows[0].Trim()
if ($trackingSha -ne $fetchedSha) {
    Log "Fetched SHA mismatch: FETCH_HEAD=$fetchedSha origin/master=$trackingSha"
    exit 6
}

& git -C $Source merge-base --is-ancestor $localSha $fetchedSha
if ($LASTEXITCODE -ne 0) {
    & git -C $Source merge-base --is-ancestor $fetchedSha $localSha
    if ($LASTEXITCODE -eq 0) {
        Log "Canonical source is locally ahead of origin/master; refusing local-only commits."
    } else {
        Log "Canonical source has diverged from origin/master; refusing non-fast-forward history."
    }
    exit 6
}

Assert-CleanSource "merge"
Log "Fast-forwarding to captured origin/master SHA $fetchedSha..."
& git -C $Source merge --ff-only $fetchedSha
if ($LASTEXITCODE -ne 0) {
    Log "Fast-forward to captured origin/master SHA failed."
    exit 4
}
Assert-CapturedHead $fetchedSha "after fast-forward"
Assert-CleanSource "install"
Write-Output "source_sha=$fetchedSha"

if ($NoInstall) {
    Write-Output "project_pin=unchanged"
    Log "Fast-forward complete (install skipped per -NoInstall)"
    exit 0
}

Log "Running installer..."
$installScript = Join-Path $Source "super-gsd\install.sh"
$bashExe = Get-SgsdGitBash
if (-not $bashExe) {
    Log "Git Bash not found. Install Git for Windows or run install.sh from a real bash."
    exit 5
}
& $bashExe $installScript --update --install-global
if ($LASTEXITCODE -ne 0) {
    Log "Installer exited non-zero (see above)"
    exit 5
}
Assert-CapturedHead $fetchedSha "after install"

# Write .super-gsd-version atomically only after install success.
if (Test-Path ".\.planning") {
    $projectPinPath = Join-Path (Get-Location).Path ".super-gsd-version"
    Write-AtomicProjectPin $projectPinPath $fetchedSha
    Write-Output "project_pin=$fetchedSha"
} else {
    Write-Output "project_pin=not-written"
}

Log "sgsd-update complete."
