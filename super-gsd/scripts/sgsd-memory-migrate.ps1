# ============================================================================
# Super GSD - Memory Consolidation Migration
# ============================================================================
# Merges Claude Code auto-memory (~/.claude/projects/<encoded>/memory/) +
# DLB-01 context-tree (<project>/.brv/context-tree/) into a single git-tracked
# store at <project>/.planning/memory/ with 8-folder semantic taxonomy.
#
# New structure:
#   .planning/memory/
#     MEMORY.md                        single catalog for auto-memory + sgsd-recall
#     architecture/{patterns,anti-patterns,decisions,expertise}/
#     code/<language>/
#     domain/
#     workflow/{user,feedback,preferences}/
#     project/
#     reference/
#     errors/
#     trajectory/{hypothesis,candidate,lesson}/
#
# After migration, Claude Code's auto-memory path becomes a directory junction
# pointing at .planning/memory/ - so auto-load still works, but real files
# live in git.
#
# SAFETY:
#   - Idempotent. Re-running against already-migrated project no-ops.
#   - Never overwrites existing files in the target.
#   - -DryRun shows every move + new-dir + junction without touching disk.
#   - -Force replaces an already-migrated .planning/memory/ (destructive).
#
# Usage:
#   powershell -File sgsd-memory-migrate.ps1                          (cwd)
#   powershell -File sgsd-memory-migrate.ps1 -ProjectDir <PATH>
#   powershell -File sgsd-memory-migrate.ps1 -DryRun
#   powershell -File sgsd-memory-migrate.ps1 -SkipJunction             (no mklink)
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [switch]$DryRun,
    [switch]$SkipJunction,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

try {
    $ProjectDir = (Resolve-Path $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve $ProjectDir" -ForegroundColor Red
    exit 1
}

# Guard against accidental runs in non-projects (home dir, random cwd).
# A super-gsd project should already have .planning/ from gsd-new-project or
# sgsd -Backfill. If it doesn't, bail with a clear message rather than silently
# creating .planning/memory/ in the wrong directory.
$planningPath = Join-Path $ProjectDir ".planning"
if (-not (Test-Path $planningPath) -and -not $Force) {
    Write-Host ""
    Write-Host "ERROR: $ProjectDir is not a super-gsd project." -ForegroundColor Red
    Write-Host "       No .planning/ directory found." -ForegroundColor Red
    Write-Host ""
    Write-Host "If this is a new project you want to set up:" -ForegroundColor DarkGray
    Write-Host "  cd $ProjectDir" -ForegroundColor Cyan
    Write-Host "  sgsd -Backfill" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "If you're trying to migrate a different project, pass its path:" -ForegroundColor DarkGray
    Write-Host "  powershell -File $PSCommandPath -ProjectDir 'C:\path\to\project'" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To override this guard (knowing the risks), pass -Force." -ForegroundColor DarkGray
    exit 1
}

$MemoryRoot = Join-Path $ProjectDir ".planning\memory"
$LegacyBrvRoot = Join-Path $ProjectDir ".brv\context-tree"

# Derive encoded auto-memory path (Claude Code convention):
#   "C:\Users\user\project-clarity-erp" -> "C--Users-user-project-clarity-erp"
# Rules: ':' -> '-', '\' -> '-', '.' -> '-'. Leading 'C:' becomes 'C-' (the
# colon eats one dash, then the first '\' adds another, producing 'C--').
$encoded = ($ProjectDir -replace ':', '-') -replace '\\', '-' -replace '\.', '-'
$AutoMemoryRoot = Join-Path $HOME ".claude\projects\$encoded\memory"

Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  SGSD Memory Consolidation                     " -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  Project       : $ProjectDir"
Write-Host "  Target        : $MemoryRoot"
Write-Host "  Auto-memory   : $AutoMemoryRoot"
Write-Host "  Legacy .brv   : $LegacyBrvRoot"
if ($DryRun) { Write-Host "  Mode          : DRY RUN" -ForegroundColor Yellow }
Write-Host ""

# ----------------------------------------------------------------------------
# Guard: already migrated?
# ----------------------------------------------------------------------------
if ((Test-Path (Join-Path $MemoryRoot "MEMORY.md")) -and -not $Force) {
    Write-Host "Target already migrated ($MemoryRoot/MEMORY.md exists)." -ForegroundColor Yellow
    Write-Host "Re-run with -Force to re-migrate (destructive - overwrites), or exit."
    exit 0
}

# ----------------------------------------------------------------------------
# Create the 8-folder taxonomy
# ----------------------------------------------------------------------------
$Taxonomy = @(
    "architecture\patterns",
    "architecture\anti-patterns",
    "architecture\decisions",
    "architecture\expertise",
    "code",
    "domain",
    "workflow\user",
    "workflow\feedback",
    "workflow\preferences",
    "project",
    "reference",
    "errors",
    "trajectory\hypothesis",
    "trajectory\candidate",
    "trajectory\lesson"
)

Write-Host "STEP 1 - CREATE TAXONOMY" -ForegroundColor White
Write-Host "------------------------"
foreach ($sub in $Taxonomy) {
    $d = Join-Path $MemoryRoot $sub
    if (Test-Path $d) {
        Write-Host "  [=] $sub" -ForegroundColor DarkGray
    } elseif ($DryRun) {
        Write-Host "  [+] $sub  (dry run)" -ForegroundColor Cyan
    } else {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
        # .gitkeep so sparse dirs still track
        New-Item -ItemType File -Path (Join-Path $d ".gitkeep") -Force | Out-Null
        Write-Host "  [+] $sub" -ForegroundColor Green
    }
}
Write-Host ""

# ----------------------------------------------------------------------------
# Classifier functions
# ----------------------------------------------------------------------------
function Get-AutoMemoryCategory($filename) {
    # files in auto-memory are prefixed user_ / feedback_ / project_ / reference_
    switch -regex ($filename) {
        '^user_'       { return 'workflow\user' }
        '^feedback_'   { return 'workflow\feedback' }
        '^preference_' { return 'workflow\preferences' }
        '^project_'    { return 'project' }
        '^reference_'  { return 'reference' }
        '^MEMORY\.md$' { return $null }  # index file, handled separately
        default        { return 'project' }  # sensible default for unprefixed
    }
}

function Get-BrvCategory($relPath) {
    # relPath like "patterns\mypattern.md" or "scripts\nodejs\foo.md"
    if ($relPath -match '^patterns[\\/]')              { return 'architecture\patterns' }
    if ($relPath -match '^anti-patterns[\\/]')         { return 'architecture\anti-patterns' }
    if ($relPath -match '^decisions[\\/]')             { return 'architecture\decisions' }
    if ($relPath -match '^expertise[\\/]')             { return 'architecture\expertise' }
    if ($relPath -match '^domain[\\/]')                { return 'domain' }
    if ($relPath -match '^error-rules[\\/]')           { return 'errors' }
    if ($relPath -match '^trajectory-hypothesis[\\/]candidate[\\/]') { return 'trajectory\candidate' }
    if ($relPath -match '^trajectory-hypothesis[\\/]') { return 'trajectory\hypothesis' }
    # scripts/<lang>/file.md -> code/<lang>/
    if ($relPath -match '^scripts[\\/]([^\\/]+)[\\/]') { return "code\$($Matches[1])" }
    if ($relPath -match '^scripts[\\/]')               { return 'code' }
    if ($relPath -match '^INDEX\.md$')                 { return $null }
    return 'archive'  # tombstone - shouldn't happen
}

function Move-Memory-File($src, $dstDir, $tag) {
    $fname = Split-Path -Leaf $src
    $dst = Join-Path (Join-Path $MemoryRoot $dstDir) $fname
    if (Test-Path $dst) {
        Write-Host "  [=] $tag/$($fname)  (already at target)" -ForegroundColor DarkGray
        return $null
    }
    if ($DryRun) {
        Write-Host "  [->] $tag/$($fname) -> $dstDir" -ForegroundColor Cyan
        return @{ src = $src; dst = $dst; subdir = $dstDir; fname = $fname }
    }
    Copy-Item -Path $src -Destination $dst -ErrorAction Stop
    Remove-Item -Path $src -Force -ErrorAction SilentlyContinue
    Write-Host "  [->] $tag/$($fname) -> $dstDir" -ForegroundColor Green
    return @{ src = $src; dst = $dst; subdir = $dstDir; fname = $fname }
}

# ----------------------------------------------------------------------------
# Migrate .brv/context-tree/ files
# ----------------------------------------------------------------------------
Write-Host "STEP 2 - MIGRATE .brv/context-tree/" -ForegroundColor White
Write-Host "-----------------------------------"
$migrated = @()
if (Test-Path $LegacyBrvRoot) {
    $files = Get-ChildItem -Path $LegacyBrvRoot -Recurse -File -ErrorAction SilentlyContinue |
             Where-Object { $_.Extension -eq '.md' -and $_.Name -ne 'INDEX.md' -and $_.Name -ne '.gitkeep' }
    foreach ($f in $files) {
        $rel = $f.FullName.Substring($LegacyBrvRoot.Length + 1)
        $cat = Get-BrvCategory $rel
        if ($null -eq $cat) { continue }
        # Ensure category dir exists (taxonomy covers the common ones, but code\<lang> is dynamic)
        $catDir = Join-Path $MemoryRoot $cat
        if (-not (Test-Path $catDir) -and -not $DryRun) {
            New-Item -ItemType Directory -Path $catDir -Force | Out-Null
        }
        $rec = Move-Memory-File $f.FullName $cat ".brv"
        if ($rec) { $migrated += $rec }
    }
    if ($files.Count -eq 0) { Write-Host "  (no .md files to migrate)" -ForegroundColor DarkGray }
} else {
    Write-Host "  (.brv/context-tree/ not present - nothing to migrate)" -ForegroundColor DarkGray
}
Write-Host ""

# ----------------------------------------------------------------------------
# Migrate auto-memory files
# ----------------------------------------------------------------------------
Write-Host "STEP 3 - MIGRATE auto-memory" -ForegroundColor White
Write-Host "----------------------------"
$autoMigrated = @()
if (Test-Path $AutoMemoryRoot) {
    # Check this is a real directory, not an already-junction
    $item = Get-Item $AutoMemoryRoot -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host "  (already a junction - skipping auto-memory migration)" -ForegroundColor DarkGray
    } else {
        $files = Get-ChildItem -Path $AutoMemoryRoot -File -ErrorAction SilentlyContinue |
                 Where-Object { $_.Extension -eq '.md' }
        foreach ($f in $files) {
            $cat = Get-AutoMemoryCategory $f.Name
            if ($null -eq $cat) { continue }  # MEMORY.md - handled by step 3b below
            $rec = Move-Memory-File $f.FullName $cat "auto-mem"
            if ($rec) { $autoMigrated += $rec }
        }
        if ($files.Count -eq 0) { Write-Host "  (no .md files to migrate)" -ForegroundColor DarkGray }

        # Legacy auto-memory MEMORY.md is now redundant — we rebuild a superior
        # catalog at .planning/memory/MEMORY.md. Remove the stale one so the
        # junction step can replace the whole dir. Dry-run just notes it.
        $legacyMemoryMd = Join-Path $AutoMemoryRoot "MEMORY.md"
        if (Test-Path $legacyMemoryMd) {
            if ($DryRun) {
                Write-Host "  [x] auto-mem/MEMORY.md  (would remove - superseded by new catalog)" -ForegroundColor Cyan
            } else {
                Remove-Item $legacyMemoryMd -Force -ErrorAction SilentlyContinue
                Write-Host "  [x] auto-mem/MEMORY.md  (removed - superseded)" -ForegroundColor Yellow
            }
        }
    }
} else {
    Write-Host "  ($AutoMemoryRoot not present - nothing to migrate)" -ForegroundColor DarkGray
}
Write-Host ""

# ----------------------------------------------------------------------------
# Rebuild MEMORY.md catalog
# ----------------------------------------------------------------------------
Write-Host "STEP 4 - REBUILD MEMORY.md" -ForegroundColor White
Write-Host "--------------------------"
if ($DryRun) {
    Write-Host "  (dry run - skipping)" -ForegroundColor DarkGray
} else {
    $memoryMd = Join-Path $MemoryRoot "MEMORY.md"
    $lines = @()
    $lines += "# SGSD Memory - Consolidated Index"
    $lines += ""
    $lines += "Generated by sgsd-memory-migrate on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')."
    $lines += "Format: one markdown list item per file, readable by auto-memory AND sgsd-recall."
    $lines += ""

    # Walk the new store and emit a line per .md file
    $sections = [ordered]@{}
    Get-ChildItem -Path $MemoryRoot -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -eq '.md' -and $_.Name -ne 'MEMORY.md' -and $_.Name -ne '.gitkeep' } |
        Sort-Object FullName |
        ForEach-Object {
            $relFull = $_.FullName.Substring($MemoryRoot.Length + 1)
            $relUnix = $relFull -replace '\\', '/'
            $parent = Split-Path -Parent $relUnix
            if (-not $sections.Contains($parent)) { $sections[$parent] = @() }

            # Parse title from frontmatter or filename
            $title = $_.BaseName
            $firstLines = Get-Content $_.FullName -TotalCount 10 -ErrorAction SilentlyContinue
            foreach ($ln in $firstLines) {
                if ($ln -match '^title:\s*(.+)$')       { $title = $Matches[1].Trim(); break }
                elseif ($ln -match '^description:\s*"?(.+?)"?\s*$') { $title = $Matches[1].Trim(); break }
            }

            # Parse one-line hook
            $hook = ""
            foreach ($ln in $firstLines) {
                if ($ln -match '^description:\s*"?(.+?)"?\s*$') { $hook = $Matches[1].Trim(); break }
                elseif ($ln -match '^summary:\s*(.+)$')        { $hook = $Matches[1].Trim(); break }
            }

            $entry = if ($hook) {
                "- [$title]($relUnix) - $hook"
            } else {
                "- [$title]($relUnix)"
            }
            $sections[$parent] += $entry
        }

    foreach ($s in $sections.Keys) {
        $lines += "## $s"
        $lines += ""
        foreach ($e in $sections[$s]) { $lines += $e }
        $lines += ""
    }

    Set-Content -Path $memoryMd -Value ($lines -join "`r`n") -NoNewline
    $entryCount = ($sections.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum
    Write-Host "  MEMORY.md written: $entryCount entries across $($sections.Count) sections" -ForegroundColor Green
}
Write-Host ""

# ----------------------------------------------------------------------------
# Create directory junction: auto-memory -> .planning/memory/
# ----------------------------------------------------------------------------
Write-Host "STEP 5 - JUNCTION" -ForegroundColor White
Write-Host "-----------------"
if ($SkipJunction) {
    Write-Host "  (-SkipJunction flag - not creating)" -ForegroundColor DarkGray
} elseif ($DryRun) {
    Write-Host "  [link] $AutoMemoryRoot -> $MemoryRoot  (dry run)" -ForegroundColor Cyan
} elseif (Test-Path $AutoMemoryRoot) {
    $item = Get-Item $AutoMemoryRoot -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        Write-Host "  (junction already exists - leaving it alone)" -ForegroundColor DarkGray
    } else {
        # Dir should be empty by now (files migrated). Remove + recreate as junction.
        $remaining = Get-ChildItem $AutoMemoryRoot -Force -ErrorAction SilentlyContinue |
                     Where-Object { $_.Name -notin @('.', '..') }
        if ($remaining.Count -gt 0) {
            Write-Host "  WARNING: $AutoMemoryRoot still contains files - skipping junction." -ForegroundColor Yellow
            Write-Host "  Remaining: $(($remaining | Select-Object -ExpandProperty Name) -join ', ')" -ForegroundColor Yellow
        } else {
            Remove-Item $AutoMemoryRoot -Recurse -Force
            # cmd /c mklink /J - no admin needed for directory junctions
            $output = & cmd /c mklink /J "`"$AutoMemoryRoot`"" "`"$MemoryRoot`"" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  [link] $AutoMemoryRoot -> $MemoryRoot" -ForegroundColor Green
            } else {
                Write-Host "  FAILED to create junction: $output" -ForegroundColor Red
                Write-Host "  Recreating empty auto-memory dir so Claude Code doesn't break..." -ForegroundColor Yellow
                New-Item -ItemType Directory -Path $AutoMemoryRoot -Force | Out-Null
            }
        }
    }
} else {
    # No auto-memory dir existed - create a junction anyway so auto-load starts working
    $parent = Split-Path -Parent $AutoMemoryRoot
    if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $output = & cmd /c mklink /J "`"$AutoMemoryRoot`"" "`"$MemoryRoot`"" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  [link] $AutoMemoryRoot -> $MemoryRoot  (auto-memory was absent)" -ForegroundColor Green
    } else {
        Write-Host "  Junction skipped (mklink failed): $output" -ForegroundColor Yellow
    }
}
Write-Host ""

# ----------------------------------------------------------------------------
# Cleanup empty legacy dirs
# ----------------------------------------------------------------------------
Write-Host "STEP 6 - CLEANUP" -ForegroundColor White
Write-Host "----------------"
if ((Test-Path $LegacyBrvRoot) -and -not $DryRun) {
    # Remove empty subdirs in .brv/context-tree/
    $emptyCount = 0
    Get-ChildItem $LegacyBrvRoot -Recurse -Directory -ErrorAction SilentlyContinue |
        Sort-Object -Property FullName -Descending |
        ForEach-Object {
            $remaining = Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue |
                         Where-Object { $_.Name -ne '.gitkeep' }
            if ($remaining.Count -eq 0) {
                Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
                $emptyCount++
            }
        }
    # If the root is now effectively empty (only INDEX.md or .gitkeep), remove it too
    $brvRemaining = Get-ChildItem $LegacyBrvRoot -Force -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -notin @('.gitkeep', 'INDEX.md') }
    if ($brvRemaining.Count -eq 0) {
        Remove-Item $LegacyBrvRoot -Recurse -Force -ErrorAction SilentlyContinue
        # Also remove .brv/ parent if it's now empty
        $brvParent = Split-Path -Parent $LegacyBrvRoot
        $brvParentContent = Get-ChildItem $brvParent -Force -ErrorAction SilentlyContinue
        if ($brvParentContent.Count -eq 0) {
            Remove-Item $brvParent -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  Removed empty .brv/ (memory fully migrated)" -ForegroundColor Green
        } else {
            Write-Host "  Removed empty .brv/context-tree/ ($emptyCount empty subdirs swept)" -ForegroundColor Green
        }
    } else {
        Write-Host "  .brv/context-tree/ retained - $($brvRemaining.Count) unmigrated items" -ForegroundColor Yellow
        Write-Host "  Remaining: $(($brvRemaining | Select-Object -ExpandProperty Name) -join ', ')" -ForegroundColor Yellow
    }
} else {
    Write-Host "  (nothing to clean up)" -ForegroundColor DarkGray
}
Write-Host ""

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
$total = $migrated.Count + $autoMigrated.Count
Write-Host "================================================" -ForegroundColor Magenta
if ($DryRun) {
    Write-Host "  DRY RUN COMPLETE                              " -ForegroundColor Magenta
} else {
    Write-Host "  MIGRATION COMPLETE                            " -ForegroundColor Magenta
}
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  .brv files migrated : $($migrated.Count)"
Write-Host "  auto-mem migrated   : $($autoMigrated.Count)"
Write-Host "  total files         : $total"
Write-Host "  target              : $MemoryRoot"
if (-not $DryRun) {
    Write-Host ""
    Write-Host "  Next: commit the new .planning/memory/ and run sgsd to verify."
    Write-Host "  Rollback: git checkout -- .planning/ .brv/  then rm $MemoryRoot"
}
Write-Host ""
