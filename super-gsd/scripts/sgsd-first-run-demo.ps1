# ============================================================================
# SGSD - First-Run Demo Bootstrap
# ============================================================================
# Creates the minimum files needed to demonstrate SGSD first boot in a fresh
# project. Intended for throwaway demo projects such as C:\Users\...\SGSD-WARP.
#
# Usage from the demo project root:
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\sgsd-first-run-demo.ps1
#
# Optional:
#   -SourceRepo C:\Users\user\GSDedits
#   -InstallCodex
#   -SkipNpmInstall
#   -SkipBoot
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [string]$SourceRepo = "C:\Users\user\GSDedits",
    [switch]$InstallCodex,
    [switch]$SkipNpmInstall,
    [switch]$SkipBoot
)

$ErrorActionPreference = "Stop"

function Write-Step($Message, $Status = "OK", $Color = "Green") {
    Write-Host ("[{0}] " -f $Status) -NoNewline -ForegroundColor $Color
    Write-Host $Message
}

try {
    $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve project dir: $ProjectDir" -ForegroundColor Red
    exit 1
}

try {
    $SourceRepo = (Resolve-Path -LiteralPath $SourceRepo -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve source repo: $SourceRepo" -ForegroundColor Red
    exit 1
}

$sourceSgsd = Join-Path $SourceRepo "super-gsd"
$sourcePackage = Join-Path $SourceRepo "package.json"
$sourceLock = Join-Path $SourceRepo "package-lock.json"

if (-not (Test-Path $sourceSgsd)) {
    Write-Host "ERROR: Source super-gsd not found at $sourceSgsd" -ForegroundColor Red
    exit 2
}
if (-not (Test-Path $sourcePackage)) {
    Write-Host "ERROR: Source package.json not found at $sourcePackage" -ForegroundColor Red
    exit 2
}
if (-not (Test-Path $sourceLock)) {
    Write-Host "ERROR: Source package-lock.json not found at $sourceLock" -ForegroundColor Red
    exit 2
}

Write-Host ""
Write-Host "SGSD first-run demo bootstrap" -ForegroundColor Magenta
Write-Host "Project: $ProjectDir" -ForegroundColor DarkGray
Write-Host "Source:  $SourceRepo" -ForegroundColor DarkGray
Write-Host ""

# Required tools.
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "ERROR: Node.js missing. Install Node.js 22+ first." -ForegroundColor Red
    exit 3
}
$nodeVersion = (& node --version 2>$null)
$nodeMajor = 0
if ($nodeVersion -match '^v?(\d+)') { $nodeMajor = [int]$Matches[1] }
if ($nodeMajor -lt 22) {
    Write-Host "ERROR: Node.js 22+ required. Found $nodeVersion" -ForegroundColor Red
    exit 3
}
Write-Step "Node.js $nodeVersion"

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    Write-Host "ERROR: Git missing. Install Git for Windows first." -ForegroundColor Red
    exit 4
}
Write-Step (& git --version 2>$null)

$gitBash = Get-Command bash -All -ErrorAction SilentlyContinue |
    Where-Object { $_.Source -notmatch 'System32' -and $_.Source -notmatch 'WindowsApps' } |
    Select-Object -First 1
if (-not $gitBash) {
    $gitBashCandidates = @(
        (Join-Path ${env:ProgramFiles} "Git\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles} "Git\usr\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Git\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Git\usr\bin\bash.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Git\bin\bash.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Git\usr\bin\bash.exe")
    ) | Where-Object { $_ -and (Test-Path $_) }
    $gitBashPath = $gitBashCandidates | Select-Object -First 1
    if ($gitBashPath) {
        $env:PATH = (Split-Path -Parent $gitBashPath) + ";" + $env:PATH
        Write-Step "Git Bash found via fallback path: $gitBashPath"
    } else {
        Write-Step "Git Bash not found; boot will fail until Git for Windows bash is visible" "WARN" "Yellow"
        Write-Host "       Install Git for Windows or add C:\Program Files\Git\bin to PATH." -ForegroundColor DarkGray
    }
} else {
    Write-Step "Git Bash found: $($gitBash.Source)"
}

# Copy SGSD and Node dependency manifests into the demo project.
Copy-Item -LiteralPath $sourceSgsd -Destination (Join-Path $ProjectDir "super-gsd") -Recurse -Force
Copy-Item -LiteralPath $sourcePackage -Destination (Join-Path $ProjectDir "package.json") -Force
Copy-Item -LiteralPath $sourceLock -Destination (Join-Path $ProjectDir "package-lock.json") -Force
Write-Step "Copied super-gsd and package manifests"

# Create minimal project files.
Set-Content -LiteralPath (Join-Path $ProjectDir "README.md") -Value "# SGSD-WARP Demo`n"
Set-Content -LiteralPath (Join-Path $ProjectDir "CLAUDE.md") -Value "Use SGSD normally. Local knowledge only. No VTP required.`n"

$planning = Join-Path $ProjectDir ".planning"
$memory = Join-Path $planning "memory"
New-Item -ItemType Directory -Force -Path $memory | Out-Null

$memoryText = @'
# SGSD Memory - Demo

## project

## workflow/user

## workflow/feedback

## architecture/patterns
'@
Set-Content -LiteralPath (Join-Path $memory "MEMORY.md") -Value $memoryText

$stateText = @'
---
current_milestone: demo
current_phase: 1
roadmap_status: demo
---

# Project State

Demo project for first-run SGSD boot.
'@
Set-Content -LiteralPath (Join-Path $planning "STATE.md") -Value $stateText

$roadmapText = @'
# Roadmap

- demo: prove SGSD boots with local knowledge defaults.
'@
Set-Content -LiteralPath (Join-Path $planning "ROADMAP.md") -Value $roadmapText
Write-Step "Created minimal README, CLAUDE.md, .planning, and local memory"

Push-Location $ProjectDir
try {
    if (-not $SkipNpmInstall) {
        Write-Host ""
        Write-Host "Running npm install..." -ForegroundColor White
        & npm install
        if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit $LASTEXITCODE" }
        Write-Step "npm install complete"
    }

    if ($InstallCodex) {
        Write-Host ""
        Write-Host "Checking optional Codex CLI..." -ForegroundColor White
        $codexCmd = Get-Command codex -ErrorAction SilentlyContinue
        if (-not $codexCmd) {
            Write-Host "Installing Codex CLI globally..." -ForegroundColor White
            & npm install -g "@openai/codex"
            if ($LASTEXITCODE -ne 0) { throw "Codex install failed with exit $LASTEXITCODE" }
            $codexCmd = Get-Command codex -ErrorAction SilentlyContinue
        }
        if ($codexCmd) {
            $codexVersion = (& codex --version 2>$null)
            Write-Step "Codex CLI $codexVersion"
            $loginStatus = (& codex login status 2>&1)
            if (($loginStatus -join "`n") -match 'Logged in') {
                Write-Step "Codex login active"
            } else {
                Write-Step "Codex installed but not logged in - run codex login" "WARN" "Yellow"
                Write-Host "       Then run: codex login status" -ForegroundColor DarkGray
            }
        } else {
            Write-Step "Codex CLI unavailable after install attempt" "WARN" "Yellow"
        }
    } else {
        $codexCmd = Get-Command codex -ErrorAction SilentlyContinue
        if ($codexCmd) {
            $codexVersion = (& codex --version 2>$null)
            Write-Step "Optional Codex detected: $codexVersion"
        } else {
            Write-Step "Optional Codex not installed; SGSD will use degraded/fallback review" "WARN" "Yellow"
            Write-Host "       To add it later: npm install -g @openai/codex; codex login" -ForegroundColor DarkGray
        }
    }

    if (-not $SkipBoot) {
        Write-Host ""
        Write-Host "Running SGSD first boot preflight..." -ForegroundColor White
        & powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\super-gsd\scripts\sgsd-boot.ps1" -NoOpen
        if ($LASTEXITCODE -ne 0) { throw "sgsd-boot.ps1 failed with exit $LASTEXITCODE" }
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Demo bootstrap complete." -ForegroundColor Green
Write-Host "Inspect generated local config:" -ForegroundColor White
Write-Host "  Get-Content .planning\config.json" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Optional Codex setup:" -ForegroundColor White
Write-Host "  npm install -g @openai/codex" -ForegroundColor DarkGray
Write-Host "  codex login" -ForegroundColor DarkGray
Write-Host "  node .\super-gsd\tools\provider-health\check.cjs --provider codex" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Install shortcuts, then boot:" -ForegroundColor White
Write-Host "  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\super-gsd\scripts\Install-SgsdShortcut.ps1 -Force" -ForegroundColor DarkGray
Write-Host "  . `$PROFILE" -ForegroundColor DarkGray
Write-Host "  sg" -ForegroundColor DarkGray
