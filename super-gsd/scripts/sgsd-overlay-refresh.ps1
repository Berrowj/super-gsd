# ============================================================================
# sgsd-overlay-refresh.ps1 — DLB-06 follow-up
# ============================================================================
# Keeps a project's CLAUDE.md in sync with the latest super-gsd
# CLAUDE-OVERLAY.md. Uses HTML-comment markers for idempotent replacement.
#
# First run: requires -Force (no markers yet). Appends the overlay with
# markers. Warns about possible duplication if the project already had the
# overlay appended manually.
#
# Subsequent runs: detects markers, replaces block between them with current
# canonical overlay. Backup created as CLAUDE.md.bak.
#
# Usage:
#   sgsd-overlay-refresh.ps1                     (current cwd)
#   sgsd-overlay-refresh.ps1 -ProjectDir PATH
#   sgsd-overlay-refresh.ps1 -DryRun             (show diff, no writes)
#   sgsd-overlay-refresh.ps1 -Force              (first-run append)
#   sgsd-overlay-refresh.ps1 -Source PATH        (override overlay source)
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [switch]$DryRun,
    [switch]$Force,
    [string]$Source = ""
)

$ErrorActionPreference = "Stop"

# Resolve ProjectDir to absolute
try {
    $ProjectDir = (Resolve-Path $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve $ProjectDir" -ForegroundColor Red
    exit 1
}

# Locate canonical overlay source
$overlayCandidates = @()
if ($Source) { $overlayCandidates += $Source }
$overlayCandidates += @(
    (Join-Path $HOME ".claude\super-gsd\source\super-gsd\CLAUDE-OVERLAY.md"),
    (Join-Path $PSScriptRoot "..\CLAUDE-OVERLAY.md"),
    "C:\Users\jack.berrow\GSDedits\super-gsd\CLAUDE-OVERLAY.md"
)

$overlaySource = $null
foreach ($c in $overlayCandidates) {
    if ($c -and (Test-Path $c)) {
        $overlaySource = (Resolve-Path $c).Path
        break
    }
}

if (-not $overlaySource) {
    Write-Host "ERROR: Cannot find CLAUDE-OVERLAY.md. Tried:" -ForegroundColor Red
    $overlayCandidates | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    Write-Host "Run 'sgsd-update' first to clone the canonical source, or pass -Source PATH." -ForegroundColor Yellow
    exit 2
}

$overlayContent = Get-Content $overlaySource -Raw
$overlayHash = (Get-FileHash $overlaySource).Hash.Substring(0, 10)

Write-Host ""
Write-Host "=== sgsd-overlay-refresh ===" -ForegroundColor Magenta
Write-Host "  Project      : $ProjectDir"
Write-Host "  Overlay src  : $overlaySource"
Write-Host "  Overlay hash : $overlayHash"
Write-Host ""

$projectClaudeMd = Join-Path $ProjectDir "CLAUDE.md"
$startMarker = "<!-- SUPER-GSD-OVERLAY-START -->"
$endMarker = "<!-- SUPER-GSD-OVERLAY-END -->"

# Compose the wrapped block
$wrappedBlock = "$startMarker`r`n<!-- Auto-synced by sgsd-overlay-refresh. Hash: $overlayHash -->`r`n$overlayContent`r`n$endMarker"

# Case 1: CLAUDE.md doesn't exist -> create from scratch
if (-not (Test-Path $projectClaudeMd)) {
    if ($DryRun) {
        Write-Host "DRY RUN: would CREATE $projectClaudeMd with overlay wrapped in markers" -ForegroundColor Cyan
        exit 0
    }
    $header = "# Project CLAUDE.md`r`n`r`nThis file carries per-project instructions for Claude Code. The super-gsd overlay below is auto-synced — do not edit between the markers.`r`n`r`n---`r`n`r`n"
    Set-Content -Path $projectClaudeMd -Value "$header$wrappedBlock" -NoNewline
    Write-Host "[+] CREATED $projectClaudeMd (fresh file with marker-wrapped overlay)" -ForegroundColor Green
    exit 0
}

$existing = Get-Content $projectClaudeMd -Raw

$hasStart = $existing.Contains($startMarker)
$hasEnd   = $existing.Contains($endMarker)

if ($hasStart -and $hasEnd) {
    # Case 2: markers present -> replace between them
    $pattern = [regex]::Escape($startMarker) + "[\s\S]*?" + [regex]::Escape($endMarker)
    $newContent = [regex]::Replace($existing, $pattern, { param($m) $wrappedBlock })

    if ($newContent -eq $existing) {
        Write-Host "[=] CLAUDE.md already current with overlay hash $overlayHash. No change." -ForegroundColor DarkGray
        exit 0
    }

    if ($DryRun) {
        Write-Host "DRY RUN: would REPLACE block between markers" -ForegroundColor Cyan
        $oldMatch = [regex]::Match($existing, $pattern)
        $oldHash = if ($oldMatch.Value -match "Hash:\s*([0-9A-F]+)") { $Matches[1] } else { "unknown" }
        Write-Host "  Old hash: $oldHash"
        Write-Host "  New hash: $overlayHash"
        exit 0
    }

    Copy-Item $projectClaudeMd "$projectClaudeMd.bak" -Force
    Set-Content -Path $projectClaudeMd -Value $newContent -NoNewline
    Write-Host "[~] REPLACED overlay block in CLAUDE.md" -ForegroundColor Green
    Write-Host "    Backup: $projectClaudeMd.bak" -ForegroundColor DarkGray
    exit 0
}

if ($hasStart -xor $hasEnd) {
    Write-Host "ERROR: CLAUDE.md has only one of the markers (orphan)." -ForegroundColor Red
    Write-Host "  Start marker present: $hasStart"
    Write-Host "  End marker present  : $hasEnd"
    Write-Host "Fix manually — either complete the pair around the overlay block, or remove the stray marker." -ForegroundColor Yellow
    exit 3
}

# Case 3: no markers -> first run
if (-not $Force) {
    Write-Host "Existing CLAUDE.md has no super-gsd markers." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  1. If CLAUDE.md does NOT already contain the super-gsd overlay:"
    Write-Host "     Re-run with -Force — appends the overlay with markers."
    Write-Host ""
    Write-Host "  2. If CLAUDE.md ALREADY contains an older super-gsd overlay (manually appended via Add-Content):"
    Write-Host "     a. Delete the old overlay section from CLAUDE.md manually"
    Write-Host "     b. Re-run with -Force"
    Write-Host "     OR"
    Write-Host "     a. Add the markers manually around the existing overlay block"
    Write-Host "     b. Re-run without -Force — will then detect markers and replace cleanly"
    Write-Host ""
    Write-Host "  Use -DryRun with -Force to preview without writing."
    exit 4
}

# -Force path: append
if ($DryRun) {
    Write-Host "DRY RUN: would APPEND marker-wrapped overlay to $projectClaudeMd" -ForegroundColor Cyan
    Write-Host "WARNING: if CLAUDE.md already contains an unmarked overlay, this will duplicate content." -ForegroundColor Yellow
    exit 0
}

Copy-Item $projectClaudeMd "$projectClaudeMd.bak" -Force
if (-not $existing.EndsWith("`n")) { $existing += "`r`n" }
$newContent = $existing + "`r`n---`r`n`r`n$wrappedBlock"
Set-Content -Path $projectClaudeMd -Value $newContent -NoNewline
Write-Host "[+] APPENDED marker-wrapped overlay to CLAUDE.md" -ForegroundColor Green
Write-Host "    Backup: $projectClaudeMd.bak" -ForegroundColor DarkGray
Write-Host "    IMPORTANT: if the project already had an older overlay before this refresh, you may now have duplicated content. Check CLAUDE.md for two copies of super-gsd instructions and delete the older unmarked copy." -ForegroundColor Yellow
