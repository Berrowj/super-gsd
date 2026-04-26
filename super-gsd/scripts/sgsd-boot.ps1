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
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -NoOpen           # preflight only
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -Claude            # also launch Claude (silent)
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -Claude -Greet     # also launch Claude with SGSD intro
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -Claude -Go        # also launch Claude in AUTO MODE
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [switch]$SkipPreflight,
    [switch]$NoOpen,
    [switch]$Bootstrap,
    [switch]$Backfill,
    [switch]$Claude,
    [switch]$Go,
    [switch]$Greet
)

# -Go implies -Claude (auto-send "go" only makes sense if we're launching claude)
if ($Go)    { $Claude = $true }
# -Greet implies -Claude (the kickoff message is for the spawned Claude window)
if ($Greet) { $Claude = $true }
# -Go and -Greet are mutually exclusive — Go enters AUTO MODE, Greet pauses for instructions
if ($Go -and $Greet) {
    Write-Host "ERROR: -Go and -Greet are mutually exclusive. Pick one." -ForegroundColor Red
    Write-Host "  -Go    : auto-launch Claude + auto-type 'go' to enter AUTO MODE" -ForegroundColor DarkGray
    Write-Host "  -Greet : auto-launch Claude + introduce SGSD + wait for first instruction" -ForegroundColor DarkGray
    exit 1
}

$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "SGSD Boot"

# Force UTF-8 output so the dark-green block-letter logo + box-drawing chars
# render correctly in Windows Terminal AND survive piping through bash.
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding           = [System.Text.Encoding]::UTF8
} catch { }

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

# Pin to Git-Bash (non-WSL). Both bash.exes ship on Windows 11 — Git-Bash
# at ...\Git\usr\bin\bash.exe handles C:/... paths; WSL's C:\WINDOWS\System32\bash.exe
# does not, and its "No such file or directory" error looks like a missing
# script when it is actually a path-scheme mismatch. Pin explicitly so a
# PATH reorder (e.g. after installing WSL distro updates) cannot break boot.
$BashExe = (Get-Command bash -All -ErrorAction SilentlyContinue |
    Where-Object { $_.Source -notmatch 'System32' -and $_.Source -notmatch 'WindowsApps' } |
    Select-Object -First 1 -ExpandProperty Source)
if (-not $BashExe) {
    Write-Host "ERROR: Git-Bash not found on PATH (only WSL / system32 bash present)" -ForegroundColor Red
    Write-Host "Install Git for Windows: https://git-scm.com/download/win" -ForegroundColor DarkGray
    exit 1
}

function Write-Step($label, $status, $color) {
    Write-Host ("  [{0}] " -f $status) -NoNewline -ForegroundColor $color
    Write-Host $label
}

function Banner {
    Write-Host ""
    Write-Host "    ███████  ██████  ███████ ██████ " -ForegroundColor DarkGreen
    Write-Host "    ██      ██       ██      ██   ██" -ForegroundColor DarkGreen
    Write-Host "    ███████ ██   ███ ███████ ██   ██" -ForegroundColor DarkGreen
    Write-Host "         ██ ██    ██      ██ ██   ██" -ForegroundColor DarkGreen
    Write-Host "    ███████  ██████  ███████ ██████ " -ForegroundColor DarkGreen
    Write-Host ""
    Write-Host "         Super GSD · token-efficient autonomous engine" -ForegroundColor DarkGreen
    Write-Host "    ────────────────────────────────────────────────────────────" -ForegroundColor Magenta
    Write-Host "    Project:  $ProjectDir" -ForegroundColor DarkGray
    Write-Host ""
}

if (-not ("Sgsd.NativeWindow" -as [type])) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class SgsdNativeWindow {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);

    [DllImport("user32.dll")]
    public static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    public static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);
}
"@
}

function Stop-CockpitWindows {
    $patterns = @(
        'SGSD-Cockpit',
        'SGSD3-Codex',
        'Mission Control',
        'Narrative + Ctrl\+O',
        'SUPER GSD'
    )
    $targets = New-Object System.Collections.Generic.List[object]
    $currentProcessTree = @{}
    try {
        $cursor = $PID
        while ($cursor -and -not $currentProcessTree.ContainsKey([int]$cursor)) {
            $currentProcessTree[[int]$cursor] = $true
            $procInfo = Get-CimInstance Win32_Process -Filter "ProcessId=$cursor" -ErrorAction SilentlyContinue
            if (-not $procInfo -or -not $procInfo.ParentProcessId) { break }
            $cursor = [int]$procInfo.ParentProcessId
        }
    } catch { }

    [SgsdNativeWindow]::EnumWindows({
        param($hWnd, $lParam)

        if (-not [SgsdNativeWindow]::IsWindowVisible($hWnd)) { return $true }
        $len = [SgsdNativeWindow]::GetWindowTextLength($hWnd)
        if ($len -le 0) { return $true }

        $sb = New-Object System.Text.StringBuilder ($len + 1)
        [void][SgsdNativeWindow]::GetWindowText($hWnd, $sb, $sb.Capacity)
        $title = $sb.ToString()
        if ([string]::IsNullOrWhiteSpace($title)) { return $true }

        $windowPid = 0
        [void][SgsdNativeWindow]::GetWindowThreadProcessId($hWnd, [ref]$windowPid)
        if ($currentProcessTree.ContainsKey([int]$windowPid)) { return $true }
        foreach ($pattern in $patterns) {
            if ($title -match $pattern) {
                $targets.Add([pscustomobject]@{
                    Handle = $hWnd
                    Title  = $title
                    Pid    = $windowPid
                })
                break
            }
        }

        return $true
    }, [IntPtr]::Zero) | Out-Null

    if ($targets.Count -eq 0) { return 0 }

    foreach ($target in $targets) {
        [void][SgsdNativeWindow]::PostMessage($target.Handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
    }

    Start-Sleep -Milliseconds 600

    foreach ($target in $targets) {
        try {
            $proc = Get-Process -Id $target.Pid -ErrorAction SilentlyContinue
            if ($proc -and -not $proc.HasExited) {
                $matchingWindow = Get-Process -Id $target.Pid -ErrorAction SilentlyContinue |
                    Where-Object { $_.MainWindowTitle -eq $target.Title }
                if ($matchingWindow) {
                    Stop-Process -Id $target.Pid -Force -ErrorAction SilentlyContinue
                }
            }
        } catch { }
    }

    return $targets.Count
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
        $bashUnix = $BashExe -replace '\\','/'
        $syncOut = & $BashExe -c "'$bashUnix' '$($sync -replace '\\','/')' --root '$pdUnix' 2>&1"
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
        Write-Step "legacy .brv/context-tree/ detected - run /sgsd-memory-migrate inside Claude Code" "WARN" Yellow
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
    # Mirror sgsd-curate.sh's mode detection: if MEMORY.md exists, curate runs
    # in v1.2 mode (writes .planning/memory/architecture/patterns/ + appends
    # "- [...](architecture/patterns/$slug.md) - ..." to MEMORY.md); otherwise
    # legacy mode (writes .brv/context-tree/patterns/ + appends pipe-row
    # "| pattern | $slug | patterns/$slug.md | ... |" to INDEX.md). Previous
    # revision hard-coded the legacy file path AND the v1.2 index — guaranteed
    # FAIL on any project (legacy projects fail the index check, migrated
    # projects fail the file-path check).
    $curate = Join-Path $ScriptsDir "sgsd-curate.sh"
    if (Test-Path $curate) {
        $smokeSlug = "boot-smoke-test"

        if (Test-Path $indexPath) {
            # v1.2 mode
            $smokeFile  = Join-Path $ProjectDir ".planning/memory/architecture/patterns/$smokeSlug.md"
            $indexUsed  = $indexPath
            $rowPattern = "(architecture/patterns/$smokeSlug.md)"
        } else {
            # legacy mode
            $smokeFile  = Join-Path $ProjectDir ".brv/context-tree/patterns/$smokeSlug.md"
            $indexUsed  = $legacyIndexPath
            $rowPattern = "| $smokeSlug |"
        }
        # Pre-clean any leftover body file from a prior failed run
        if (Test-Path $smokeFile) { Remove-Item $smokeFile -Force -ErrorAction SilentlyContinue }

        # Note: keep bash's own 2>&1 inside the command string (merges bash stderr into
        # stdout for capture). Do NOT add PowerShell's outer 2>&1 here — in PS 5.1 it
        # wraps native-cmd stderr (e.g. WSL's benign .wslconfig warning) as a
        # NativeCommandError and, combined with $ErrorActionPreference=Stop, kills
        # the script before we can check $LASTEXITCODE.
        $bashUnix = $BashExe -replace '\\','/'
        $bashCmd = "echo 'boot smoke' | '$bashUnix' '$($curate -replace '\\','/')' --type pattern --slug '$smokeSlug' --summary 'boot preflight' --root '$($ProjectDir -replace '\\','/')' 2>&1"
        $smokeOutput = & $BashExe -c $bashCmd
        $indexText = if (Test-Path $indexUsed) { Get-Content $indexUsed -Raw } else { "" }
        $landed = (Test-Path $smokeFile) -and ($indexText -match [regex]::Escape($rowPattern))

        if ($landed) {
            Write-Step "curate write-pipe smoke test" "OK" Green
            # Clean up — remove body file and the index row we just appended
            Remove-Item $smokeFile -Force -ErrorAction SilentlyContinue
            if (Test-Path $indexUsed) {
                $cleanIndex = (Get-Content $indexUsed) | Where-Object { $_ -notmatch [regex]::Escape($rowPattern) }
                $cleanIndex -join "`n" | Set-Content $indexUsed -NoNewline
            }
        } else {
            Write-Step "curate write-pipe smoke test - DLB-04 Day 0 blocker" "FAIL" Red
            Write-Host "    Repro: $bashCmd" -ForegroundColor DarkGray
            Write-Host "    Output: $smokeOutput" -ForegroundColor DarkGray
            Write-Host "    Expected file: $smokeFile" -ForegroundColor DarkGray
            Write-Host "    Expected row pattern in $indexUsed : $rowPattern" -ForegroundColor DarkGray
            exit 4
        }
    } else {
        Write-Step "sgsd-curate.sh not found - skipping smoke test" "WARN" Yellow
    }

    # 4. Agents registry refresh (DLB-04 Wave A)
    $registrySync = Join-Path $ScriptsDir "sgsd-registry-sync.sh"
    if (Test-Path $registrySync) {
        # See note above re: PowerShell 5.1 + native stderr + $ErrorActionPreference=Stop.
        # $bashUnix already assigned above (smoke-test block); recompute defensively
        # in case that block was skipped (missing sgsd-curate.sh).
        $bashUnix = $BashExe -replace '\\','/'
        $bashCmd = "'$bashUnix' '$($registrySync -replace '\\','/')' --root '$($ProjectDir -replace '\\','/')' 2>&1"
        $syncOutput = & $BashExe -c $bashCmd
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

    # 6. Gates probe — count armed enforcement-mode rows in registry
    $gatesYaml = Join-Path $ProjectDir "super-gsd/registry/gates.yaml"
    if (Test-Path $gatesYaml) {
        $gateContent  = Get-Content $gatesYaml -Raw
        $gateNameRe   = [regex]"(?m)^\s*-\s*name:\s*(\S+)"
        $disabledRe   = [regex]"enforcement_mode:\s*disabled"
        $totalGates   = $gateNameRe.Matches($gateContent).Count
        $disabledHits = $disabledRe.Matches($gateContent).Count
        $armedGates   = $totalGates - $disabledHits
        if ($armedGates -eq $totalGates -and $totalGates -gt 0) {
            Write-Step "Gates armed ($armedGates/$totalGates)" "OK" Green
        } elseif ($armedGates -gt 0) {
            Write-Step "Gates armed ($armedGates/$totalGates — $disabledHits disabled)" "WARN" Yellow
        } else {
            Write-Step "Gates registry empty or all disabled" "WARN" Yellow
        }
    }

    # 7. Codex live probe — codex-exec.sh self-test (skip-network keeps preflight fast)
    #    Self-test runs 4 sub-probes in priority order: PATH (10) → auth (11)
    #    → timeout-math (12) → contract (13). Exit 0 = all 4 PASS. Exit N>0 =
    #    Nth probe failed and ones after it weren't reached.
    $codexExec = Join-Path $ScriptsDir "codex-exec.sh"
    if (Test-Path $codexExec) {
        $bashUnix  = $BashExe -replace '\\','/'
        $codexCmd  = "'$bashUnix' '$($codexExec -replace '\\','/')' --self-test --skip-network 2>&1"
        $null      = & $BashExe -c $codexCmd
        $rc        = $LASTEXITCODE
        # ✓/✗ per probe based on which exit fired
        $p_path = if ($rc -eq 0 -or $rc -gt 10) { "✓" } else { "✗" }
        $p_auth = if ($rc -eq 0 -or $rc -gt 11) { "✓" } elseif ($rc -lt 11) { "—" } else { "✗" }
        $p_time = if ($rc -eq 0 -or $rc -gt 12) { "✓" } elseif ($rc -lt 12) { "—" } else { "✗" }
        $p_ctr  = if ($rc -eq 0)                { "✓" } elseif ($rc -lt 13) { "—" } else { "✗" }
        $probeLine = "PATH $p_path · auth $p_auth · timeout $p_time · contract $p_ctr"
        switch ($rc) {
            0       { Write-Step "Codex live ($probeLine)" "OK" Green }
            10      { Write-Step "Codex CLI not on PATH ($probeLine)" "WARN" Yellow }
            11      { Write-Step "Codex auth missing — run 'codex login' ($probeLine)" "WARN" Yellow }
            12      { Write-Step "Codex timeout-math probe failed ($probeLine)" "WARN" Yellow }
            13      { Write-Step "Codex contract probe failed ($probeLine)" "WARN" Yellow }
            default { Write-Step "Codex self-test exit $rc (non-blocking)" "WARN" Yellow }
        }

        # Codex responsibilities — list gates whose reviewer_provider is codex-cli-reviewer.
        # Split per-gate (lookahead at next name:) and inspect each block in
        # isolation — a single regex with .*? was crossing gate boundaries
        # when a closer gate had no reviewer_provider field.
        if (Test-Path $gatesYaml) {
            $gateBlocks  = [regex]::Split($gateContent, "(?m)(?=^\s*-\s*name:\s*\S+)")
            $codexOwned  = @()
            foreach ($block in $gateBlocks) {
                $nameMatch = [regex]::Match($block, "(?m)^\s*-\s*name:\s*(\S+)")
                if (-not $nameMatch.Success) { continue }
                if ($block -match "reviewer_provider:\s*codex-cli-reviewer") {
                    $codexOwned += $nameMatch.Groups[1].Value
                }
            }
            if ($codexOwned.Count -gt 0) {
                $ownedStr = ($codexOwned -join ", ")
                Write-Host ("       owns " + $codexOwned.Count + " gates: " + $ownedStr) -ForegroundColor DarkGray
            }
        }
    }

    # 8. VTP repo presence — proxy for VTP gate's degraded-mode trigger
    $vtpRoot = "C:\Users\jack.berrow\Voice-Text-Plan"
    if (Test-Path $vtpRoot) {
        Write-Step "VTP repo present" "OK" Green
    } else {
        Write-Step "VTP repo not found — VTP gate runs in degraded mode" "WARN" Yellow
    }

    Write-Host ""
}

# ----------------------------------------------------------------------------
# AGENT ROSTER - parse resource-registry/agents.jsonl, group by model
# ----------------------------------------------------------------------------
$agentsFile = Join-Path $ProjectDir ".planning/resource-registry/agents.jsonl"
if (Test-Path $agentsFile) {
    $rows = @()
    foreach ($line in Get-Content $agentsFile) {
        if ([string]::IsNullOrWhiteSpace($line)) { continue }
        try {
            $obj = $line | ConvertFrom-Json
            if ($obj.status -eq "active") { $rows += $obj }
        } catch { }
    }
    if ($rows.Count -gt 0) {
        Write-Host "AGENT ROSTER ($($rows.Count) active)" -ForegroundColor White
        Write-Host "----------------------"
        $byModel = $rows | Group-Object model | Sort-Object Name
        foreach ($g in $byModel) {
            $color = switch ($g.Name) {
                "opus"   { "Magenta" }
                "sonnet" { "DarkGreen" }
                "haiku"  { "DarkYellow" }
                default  { "DarkGray" }
            }
            Write-Host ("  {0,-12} ({1,2})  " -f $g.Name, $g.Count) -NoNewline -ForegroundColor $color
            $names = ($g.Group | Sort-Object id | ForEach-Object { $_.id }) -join ", "
            if ($names.Length -gt 100) { $names = $names.Substring(0, 97) + "..." }
            Write-Host $names -ForegroundColor DarkGray
        }
        Write-Host ""
    }
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
    Write-Host "  powershell -File super-gsd/scripts/sgsd-codex-monitor.ps1   -ProjectDir '$ProjectDir'"
    exit 0
}

Write-Host "LAUNCH" -ForegroundColor White
Write-Host "------"

$sgsd1 = Join-Path $ScriptsDir "sgsd-mission-control.ps1"
$sgsd2 = Join-Path $ScriptsDir "sgsd-narrative.ps1"
$sgsd3 = Join-Path $ScriptsDir "sgsd-codex-monitor.ps1"

foreach ($script in @($sgsd1, $sgsd2, $sgsd3)) {
    if (-not (Test-Path $script)) {
        Write-Host "  MISSING: $script" -ForegroundColor Red
        exit 5
    }
}

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue

if ($wt) {
    $closed = Stop-CockpitWindows
    if ($closed -gt 0) {
        Write-Step "closed existing cockpit window(s) ($closed)" "OK" Yellow
    }

    $psCmd = "powershell.exe"

    # Cockpit layout:
    #   left-top:    SGSD1 (Mission Control)
    #   left-bottom: SGSD2 (Narrative + Ctrl+O stream)
    #   right-full:  SGSD3 (Codex + VTP/MCP detail)
    #
    # Build order:
    #   1. SGSD1 fills the tab.
    #   2. Split right for SGSD3 at full height.
    #   3. Return left and split SGSD1 horizontally for SGSD2.
    #   4. Focus SGSD3 so the high-detail pane is active.
    $launchArgs = @(
        "new-tab", "--title", "SGSD-Cockpit", "--startingDirectory", $ProjectDir,
        $psCmd, "-NoExit", "-NoProfile", "-File", $sgsd1, "-ProjectDir", $ProjectDir,
        ";", "split-pane", "-V", "--size", "0.50", "--title", "SGSD3-Codex+VTP", "--startingDirectory", $ProjectDir,
        $psCmd, "-NoExit", "-NoProfile", "-File", $sgsd3, "-ProjectDir", $ProjectDir,
        ";", "move-focus", "left",
        ";", "split-pane", "-H", "--size", "0.50", "--title", "SGSD2", "--startingDirectory", $ProjectDir,
        $psCmd, "-NoExit", "-NoProfile", "-File", $sgsd2, "-ProjectDir", $ProjectDir,
        ";", "move-focus", "right"
    )

    Write-Step "Windows Terminal detected" "OK" Green
    Write-Host "  Opening SGSD1+SGSD2 stacked left, SGSD3-Codex+VTP full-height right..."
    Start-Process -FilePath "wt.exe" -ArgumentList $launchArgs
    Start-Sleep -Milliseconds 500

    # Raise the MRU Windows Terminal window to foreground so the new tab is
    # actually visible. Without this, new-tab silently lands in a minimized
    # or off-screen WT instance (confirmed failure path 2026-04-23). Uses
    # WScript.Shell AppActivate (shipped with Windows since forever, no
    # Add-Type needed). Non-fatal on error — tab still exists, operator can
    # Alt+Tab to find the cockpit.
    try {
        $wtProc = Get-Process WindowsTerminal -ErrorAction SilentlyContinue |
                  Where-Object { $_.MainWindowHandle -ne 0 } |
                  Sort-Object StartTime -Descending |
                  Select-Object -First 1
        if ($wtProc) {
            $shell = New-Object -ComObject WScript.Shell
            $shell.AppActivate($wtProc.Id) | Out-Null
        }
    } catch {
        Write-Host "  (note: couldn't auto-raise WT window — Alt+Tab to SGSD-Cockpit tab)" -ForegroundColor DarkYellow
    }
    Write-Host ""
    Write-Host "Cockpit launched." -ForegroundColor Green
} else {
    # Fallback - three separate PowerShell windows
    Write-Step "Windows Terminal not found - using separate PowerShell windows" "WARN" Yellow
    $closed = Stop-CockpitWindows
    if ($closed -gt 0) {
        Write-Step "closed existing cockpit window(s) ($closed)" "OK" Yellow
    }

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

# ----------------------------------------------------------------------------
# CLAUDE (optional) - auto-launch Claude Code in a new window, optionally with
# --dangerously-skip-permissions and an auto "go" seed to enter AUTO MODE.
# Opt-in only: --dangerously-skip-permissions is a real authority grant and
# should be a conscious choice per session, not baked into every boot.
# ----------------------------------------------------------------------------
if ($Claude) {
    Write-Host "CLAUDE" -ForegroundColor White
    Write-Host "------"

    $claudeCmd = Get-Command claude -ErrorAction SilentlyContinue
    if (-not $claudeCmd) {
        Write-Step "Claude Code CLI not on PATH - skipping auto-launch" "WARN" Yellow
        Write-Host "    Install: https://docs.claude.com/claude-code" -ForegroundColor DarkGray
    } else {
        $claudeLine  = "claude --dangerously-skip-permissions"
        $kickoffDesc = ""
        if ($Go) {
            $claudeLine += " 'go'"
            $kickoffDesc = " + auto-go"
        } elseif ($Greet) {
            # Kickoff message: tell Claude to introduce SGSD and wait for first
            # instruction. No apostrophes — single-quoted PS string passes through.
            $greetMsg = "You are booting in Super GSD mode. Do these four things in your first response: (1) read .planning/STATE.md frontmatter and report current milestone status in one line, (2) report active agent count grouped by model from .planning/resource-registry/agents.jsonl, (3) confirm the SGSD cockpit dashboards are open in the other window, (4) ask the operator what they want to build. Do NOT enter auto mode — wait for their first instruction."
            $claudeLine += " '$greetMsg'"
            $kickoffDesc = " + greet"
        }
        $cmdString = "Set-Location -LiteralPath '$ProjectDir'; $claudeLine"
        $desc = "Claude Code (--dangerously-skip-permissions$kickoffDesc)"
        Write-Step "launching $desc in a new window" "OK" Green
        Start-Process powershell.exe -ArgumentList @("-NoExit", "-NoProfile", "-Command", $cmdString)
    }
    Write-Host ""
}

Write-Host "Next actions:"
if (-not $Claude) {
    Write-Host "  1. In a second PowerShell, cd to the project and start Claude Code:"
    Write-Host "     claude"
    Write-Host "     Or re-run with one of:"
    Write-Host "       sgsd -Claude          # auto-launch Claude (silent)" -ForegroundColor DarkGray
    Write-Host "       sgsd -Claude -Greet   # auto-launch + Claude greets and waits for instructions" -ForegroundColor DarkGray
    Write-Host "       sgsd -Claude -Go      # auto-launch + enter AUTO MODE immediately" -ForegroundColor DarkGray
    Write-Host "  2. In Claude Code, tell it what to build (or say 'go' for AUTO MODE)."
    Write-Host "  3. Watch the three dashboards for live state."
} elseif ($Greet) {
    Write-Host "  1. Switch to the Claude Code window that just opened."
    Write-Host "  2. Claude will introduce SGSD and ask what to build — answer it."
    Write-Host "  3. Watch the three dashboards for live state."
} elseif ($Go) {
    Write-Host "  1. Switch to the Claude Code window that just opened - AUTO MODE already engaged."
    Write-Host "  2. Watch the three dashboards for live state."
} else {
    Write-Host "  1. Switch to the Claude Code window that just opened."
    Write-Host "  2. Tell it what to build (or say 'go' for AUTO MODE, or re-run with -Greet next time)."
    Write-Host "  3. Watch the three dashboards for live state."
}
Write-Host ""
Write-Host "  To pause anytime:  /sgsd-pause"
Write-Host "  To resume:         /sgsd-resume"
Write-Host ""
