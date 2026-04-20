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
    [switch]$NoOpen,
    [switch]$Bootstrap,
    [switch]$Backfill
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
# BACKFILL - scan existing project, create all missing DLB-04 scaffolding.
# Idempotent. Safe: only creates new paths and files, never overwrites.
# Use on older projects that predate DLB-04 or were installed before certain
# dirs/logs existed. Exits without launching dashboards.
# ----------------------------------------------------------------------------
if ($Backfill) {
    Write-Host "BACKFILL" -ForegroundColor White
    Write-Host "--------"
    $created = 0

    # New consolidated memory taxonomy (v1.2). Replaces the legacy
    # .brv/context-tree/ fork — one tree, semantic folders, git-tracked.
    # If the project has pre-consolidation memory, run sgsd-memory-migrate.
    $requiredDirs = @(
        ".planning",
        ".planning/metrics",
        ".planning/proposals",
        ".planning/resource-registry",
        ".planning/milestones",
        ".planning/memory",
        ".planning/memory/architecture",
        ".planning/memory/architecture/patterns",
        ".planning/memory/architecture/anti-patterns",
        ".planning/memory/architecture/decisions",
        ".planning/memory/architecture/expertise",
        ".planning/memory/code",
        ".planning/memory/domain",
        ".planning/memory/workflow",
        ".planning/memory/workflow/user",
        ".planning/memory/workflow/feedback",
        ".planning/memory/workflow/preferences",
        ".planning/memory/project",
        ".planning/memory/reference",
        ".planning/memory/errors",
        ".planning/memory/trajectory",
        ".planning/memory/trajectory/hypothesis",
        ".planning/memory/trajectory/candidate",
        ".planning/memory/trajectory/lesson"
    )

    foreach ($rel in $requiredDirs) {
        $d = Join-Path $ProjectDir $rel
        if (Test-Path $d) {
            Write-Host "  [=] $rel" -ForegroundColor DarkGray
        } else {
            New-Item -ItemType Directory -Path $d -Force | Out-Null
            Write-Host "  [+] $rel" -ForegroundColor Green
            $created++
            # .gitkeep for dirs that are empty by design
            if ($rel -like "*trajectory-hypothesis*" -or $rel -like "*proposals*" -or $rel -like "*resource-registry*") {
                New-Item -ItemType File -Path (Join-Path $d ".gitkeep") -Force | Out-Null
            }
        }
    }

    # Touch append-only jsonl logs (empty files are fine — downstream scripts append)
    $requiredFiles = @(
        ".planning/metrics/token-log.jsonl",
        ".planning/metrics/activity-log.jsonl",
        ".planning/metrics/sepl-log.jsonl",
        ".planning/metrics/distillation-novelty.jsonl",
        ".planning/metrics/muda-log.jsonl",
        ".planning/metrics/intent-log.jsonl"
    )
    foreach ($rel in $requiredFiles) {
        $f = Join-Path $ProjectDir $rel
        if (Test-Path $f) {
            Write-Host "  [=] $rel" -ForegroundColor DarkGray
        } else {
            New-Item -ItemType File -Path $f -Force | Out-Null
            Write-Host "  [+] $rel" -ForegroundColor Green
            $created++
        }
    }

    # MEMORY.md catalog - single index readable by Claude Code auto-memory
    # AND sgsd-recall. Format: one markdown list item per file.
    $memoryMd = Join-Path $ProjectDir ".planning/memory/MEMORY.md"
    if (-not (Test-Path $memoryMd)) {
        $memorySeed = @"
# SGSD Memory - Consolidated Index

Backfill-generated on $(Get-Date -Format 'yyyy-MM-dd'). Add entries as markdown
list items under their section:

    - [Title](subpath/file.md) - one-line hook

sgsd-curate appends; sgsd-recall greps. Auto-memory reads this as MEMORY.md.

## architecture/patterns

## architecture/anti-patterns

## architecture/decisions

## architecture/expertise

## code

## domain

## workflow/user

## workflow/feedback

## workflow/preferences

## project

## reference

## errors

## trajectory/hypothesis

## trajectory/candidate

## trajectory/lesson
"@
        Set-Content -Path $memoryMd -Value $memorySeed -NoNewline
        Write-Host "  [+] .planning/memory/MEMORY.md" -ForegroundColor Green
        $created++
    } else {
        Write-Host "  [=] .planning/memory/MEMORY.md" -ForegroundColor DarkGray
    }

    # Sync Agents registry (DLB-04 Wave A) — writes to resource-registry/agents.jsonl
    $sync = Join-Path $ScriptsDir "sgsd-registry-sync.sh"
    if (Test-Path $sync) {
        $pdUnix = $ProjectDir -replace '\\','/'
        $syncOut = & bash -c "bash '$($sync -replace '\\','/')' --root '$pdUnix' 2>&1"
        if ($LASTEXITCODE -eq 0) {
            $count = if (($syncOut -join ' ') -match '(\d+) agent records') { $Matches[1] } else { '?' }
            Write-Host "  [+] resource-registry/agents.jsonl synced ($count agents)" -ForegroundColor Green
        } else {
            Write-Host "  [!] registry sync skipped (scripts unreachable)" -ForegroundColor Yellow
        }
    }

    Write-Host ""
    if ($created -eq 0) {
        Write-Host "Backfill complete - project was already up to date." -ForegroundColor Green
    } else {
        Write-Host "Backfill complete - $created items created." -ForegroundColor Green
    }
    Write-Host "Run 'sgsd' to boot the cockpit, or 'sgsd -NoOpen' to re-verify preflight."
    Write-Host ""
    exit 0
}

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

    # 2. .planning/memory/MEMORY.md exists (v1.2 consolidated taxonomy)
    $indexPath = Join-Path $ProjectDir ".planning/memory/MEMORY.md"
    $legacyIndexPath = Join-Path $ProjectDir ".brv/context-tree/INDEX.md"
    if (Test-Path $indexPath) {
        Write-Step ".planning/memory/MEMORY.md present" "OK" Green
    } elseif (Test-Path $legacyIndexPath) {
        Write-Step "legacy .brv/context-tree/ detected - run sgsd-memory-migrate" "WARN" Yellow
    } else {
        if ($Bootstrap -or $Backfill) {
            # Full -Backfill handles this; the lightweight Bootstrap path here
            # creates the minimum needed so the preflight can continue.
            $treeRoot = Join-Path $ProjectDir ".planning/memory"
            $subdirs = @(
                "architecture/patterns", "architecture/anti-patterns",
                "architecture/decisions", "architecture/expertise",
                "code", "domain",
                "workflow/user", "workflow/feedback", "workflow/preferences",
                "project", "reference", "errors",
                "trajectory/hypothesis", "trajectory/candidate", "trajectory/lesson"
            )
            foreach ($sub in $subdirs) {
                $d = Join-Path $treeRoot $sub
                if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
                $gk = Join-Path $d ".gitkeep"
                if (-not (Test-Path $gk)) { New-Item -ItemType File -Path $gk -Force | Out-Null }
            }
            $memorySeed = @"
# SGSD Memory - Consolidated Index

Bootstrap-generated on $(Get-Date -Format 'yyyy-MM-dd'). Entries are markdown
list items. sgsd-curate appends; sgsd-recall greps. Auto-memory reads this.

## architecture/patterns

## architecture/anti-patterns

## architecture/decisions

## architecture/expertise

## code

## domain

## workflow/user

## workflow/feedback

## workflow/preferences

## project

## reference

## errors

## trajectory/hypothesis

## trajectory/candidate

## trajectory/lesson
"@
            Set-Content -Path $indexPath -Value $memorySeed -NoNewline
            # Downstream DLB-04 dirs
            $metricsDir = Join-Path $ProjectDir ".planning/metrics"
            $regDir     = Join-Path $ProjectDir ".planning/resource-registry"
            if (-not (Test-Path $metricsDir)) { New-Item -ItemType Directory -Path $metricsDir -Force | Out-Null }
            if (-not (Test-Path $regDir))     { New-Item -ItemType Directory -Path $regDir -Force | Out-Null }
            Write-Step "bootstrapped consolidated memory ($treeRoot)" "OK" Green
        } else {
            Write-Step "MEMORY.md missing - memory not initialized" "FAIL" Red
            Write-Host "    Fix one of:" -ForegroundColor DarkGray
            Write-Host "      sgsd -Bootstrap            " -NoNewline -ForegroundColor Cyan
            Write-Host "(quick: create empty tree in place)" -ForegroundColor DarkGray
            Write-Host "      bash super-gsd/install.sh --init-project  " -NoNewline -ForegroundColor Cyan
            Write-Host "(full: seed 9 knowledge files)" -ForegroundColor DarkGray
            exit 3
        }
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
