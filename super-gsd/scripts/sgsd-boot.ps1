# ============================================================================
# Super GSD - Boot Command
# ============================================================================
# One-command cockpit launcher. Preflights the substrate, refreshes the
# Agents registry, then opens the three live dashboards (SGSD1/2/3) in a
# single Windows Terminal window with three cockpit panes.
#
# Falls back to separate PowerShell windows if Windows Terminal (wt.exe)
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
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -NoCodexTail       # do not open Codex watch window
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -RaiseCockpit      # opt in to foreground activation
#   powershell -File super-gsd/scripts/sgsd-boot.ps1 -WatchdogRecover   # watchdog launches fresh Claude on stall
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [switch]$SkipPreflight,
    [switch]$FullPreflight,  # additive: runs the expensive Codex contract canary; default boot stays cheap
    [switch]$NoOpen,
    [switch]$Bootstrap,
    [switch]$Backfill,
    [switch]$Claude,
    [switch]$Go,
    [switch]$Greet,
    [switch]$NoCodexTail,
    [switch]$RaiseCockpit,
    [switch]$NoWatchdog,
    [switch]$WatchdogRecover,
    [int]$WatchdogWarnMin = 20,
    [int]$WatchdogStaleMin = 45
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
    $gitBashCandidates = @(
        (Join-Path ${env:ProgramFiles} "Git\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles} "Git\usr\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Git\bin\bash.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Git\usr\bin\bash.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Git\bin\bash.exe"),
        (Join-Path $env:LOCALAPPDATA "Programs\Git\usr\bin\bash.exe")
    ) | Where-Object { $_ -and (Test-Path $_) }
    $BashExe = $gitBashCandidates | Select-Object -First 1
    if ($BashExe) {
        $env:PATH = (Split-Path -Parent $BashExe) + ";" + $env:PATH
    }
}
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
        'SGSD-Codex-Raw',
        'SGSD-Codex-Narrator',
        'SGSD2-Codex',
        'SGSD3-Claude',
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

function Stop-SgsdDashboardProcesses {
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

    $projectRe = [regex]::Escape($ProjectDir)
    $dashboardRe = 'super-gsd[\\/]scripts[\\/](sgsd-mission-control|sgsd-narrative|sgsd-codex-monitor|sgsd-dashboard-host|sgsd-autopilot-watchdog|sgsd-watch-codex|sgsd-open-codex-watch)\.ps1'
    $targets = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            $_.CommandLine -match $projectRe -and
            $_.CommandLine -match $dashboardRe -and
            -not $currentProcessTree.ContainsKey([int]$_.ProcessId)
        })

    foreach ($target in $targets) {
        try {
            Stop-Process -Id $target.ProcessId -Force -ErrorAction SilentlyContinue
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
        ".planning/metrics/token-attribution.jsonl",
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

    # 1b. Required local tools. Keep these checks before any Node-backed
    # wizard/cache probes so a new operator gets a clear missing dependency.
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Step "Node.js missing - install Node.js 22 or newer" "FAIL" Red
        exit 20
    }
    $nodeVersionRaw = (& node --version 2>$null)
    $nodeMajor = 0
    if ($nodeVersionRaw -match '^v?(\d+)') { $nodeMajor = [int]$Matches[1] }
    if ($nodeMajor -ge 22) {
        Write-Step "Node.js $nodeVersionRaw" "OK" Green
    } else {
        Write-Step "Node.js $nodeVersionRaw found; SGSD expects 22+" "FAIL" Red
        exit 20
    }

    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if (-not $gitCmd) {
        Write-Step "Git missing - install Git for Windows" "FAIL" Red
        exit 21
    }
    $gitVersionRaw = (& git --version 2>$null)
    Write-Step "$gitVersionRaw" "OK" Green

    $betterSqliteOut = & node -e "try{require('better-sqlite3');process.exit(0)}catch(e){process.exit(1)}" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Step "Node dependencies installed (better-sqlite3)" "OK" Green
    } else {
        Write-Step "Node dependencies missing - run npm install for local context DB" "WARN" Yellow
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

    # 2b. First-run local defaults. VTP is private/optional; a new SGSD user
    # should boot into local project memory + bundled SGSD research without
    # knowing what VTP is. Existing knowledge/project blocks are preserved.
    $configPath = Join-Path $ProjectDir ".planning/config.json"
    $needsKnowledgeConfig = $true
    $needsProjectConfig = $true
    $configMalformed = $false
    if (Test-Path $configPath) {
        try {
            $firstRunCfg = Get-Content $configPath -Raw | ConvertFrom-Json
            if ($firstRunCfg.knowledge) { $needsKnowledgeConfig = $false }
            if ($firstRunCfg.project) { $needsProjectConfig = $false }
        } catch {
            $configMalformed = $true
        }
    }

    if ($configMalformed) {
        Write-Step ".planning/config.json malformed - fix JSON or rerun sgsd-setup" "WARN" Yellow
    } else {
        if ($needsKnowledgeConfig) {
            $configureTool = Join-Path $ScriptsDir "sgsd-configure.ps1"
            if (Test-Path $configureTool) {
                $null = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $configureTool `
                    -ProjectDir $ProjectDir `
                    -MemoryRoot ".planning/memory" `
                    -FallbackCorpus "sgsd-bundled-research" `
                    -NonInteractive 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Step "First-run knowledge defaults seeded (local memory + bundled research)" "OK" Green
                } else {
                    Write-Step "First-run knowledge defaults failed - run sgsd-setup" "WARN" Yellow
                }
            } else {
                Write-Step "sgsd-configure.ps1 missing - cannot seed knowledge defaults" "WARN" Yellow
            }
        } else {
            Write-Step "Knowledge config present" "OK" Green
        }

        if ($needsProjectConfig) {
            $projectWizard = Join-Path $ScriptsDir "sgsd-new-project-wizard.cjs"
            if (Test-Path $projectWizard) {
                $null = & node $projectWizard --defaults --project-dir $ProjectDir 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-Step "Project wizard defaults seeded" "OK" Green
                } else {
                    Write-Step "Project wizard defaults failed - rerun wizard manually" "WARN" Yellow
                }
            } else {
                Write-Step "sgsd-new-project-wizard.cjs missing - cannot seed project defaults" "WARN" Yellow
            }
        } else {
            Write-Step "Project defaults present" "OK" Green
        }
    }

    # 2c. Cross-repo feature propagation guard.
    # Safe repair refreshes global SGSD agents, legacy planning-agent SGSD
    # contracts, and project feature defaults
    # (Codex executor, VTP enrichment, weighted triage/context flags). It does
    # NOT move project-local agent shadows; those are reported because they can
    # override refined global agents.
    $featureAudit = Join-Path $ProjectDir "super-gsd/tools/feature-propagation/audit.cjs"
    if (Test-Path $featureAudit) {
        $auditOut = & node $featureAudit --project-dir $ProjectDir --repair-safe --json 2>&1
        $auditText = ($auditOut -join "`n")
        $audit = $null
        try { $audit = $auditText | ConvertFrom-Json } catch { }

        if ($audit -and $audit.ok -eq $true) {
            Write-Step "Feature propagation OK (Codex/VTP/CLAUDE.md/agent contracts)" "OK" Green
        } elseif ($audit) {
            $issueText = if ($audit.issues) { (@($audit.issues) -join ", ") } else { "unknown" }
            Write-Step "Feature propagation drift detected" "WARN" Yellow
            Write-Host "       issues: $issueText" -ForegroundColor DarkGray
            if ($audit.summary -and $audit.summary.drifted_local_agent_shadows -gt 0) {
                Write-Host "       local agent shadows drifted: $($audit.summary.drifted_local_agent_shadows) (run repair before auto mode)" -ForegroundColor DarkYellow
            }
            if ($audit.summary -and $audit.summary.global_legacy_agent_patch_issues -gt 0) {
                Write-Host "       legacy planning agents missing SGSD VTP contract patches: $($audit.summary.global_legacy_agent_patch_issues)" -ForegroundColor DarkYellow
            }
            if ($audit.summary -and $audit.summary.stale_super_gsd_tree -eq $true) {
                Write-Host "       stale standalone super-gsd tree detected; junction to canonical GSDedits copy" -ForegroundColor DarkYellow
            }
            if ($audit.summary -and $audit.summary.project_claude_md_missing -gt 0) {
                Write-Host "       project CLAUDE.md stale: $($audit.summary.project_claude_md_missing) missing SGSD contract markers" -ForegroundColor DarkYellow
                if ($audit.project_claude_md -and $audit.project_claude_md.missing) {
                    Write-Host "       CLAUDE.md missing: $((@($audit.project_claude_md.missing) -join ', '))" -ForegroundColor DarkGray
                }
            }
        } else {
            Write-Step "Feature propagation audit parse failed" "WARN" Yellow
            Write-Host "       run: node super-gsd/tools/feature-propagation/audit.cjs --project-dir '$ProjectDir'" -ForegroundColor DarkGray
        }
    } else {
        Write-Step "Feature propagation audit tool missing" "WARN" Yellow
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
        $agentsDir = Join-Path $ProjectDir "super-gsd/agents"
        $manifest = Join-Path $ProjectDir ".planning/resource-registry/agents.jsonl"
        $agentFiles = @(Get-ChildItem -Path $agentsDir -Filter "*.md" -File -ErrorAction SilentlyContinue)
        $manifestFresh = $false
        if ((Test-Path $manifest) -and $agentFiles.Count -gt 0) {
            $manifestInfo = Get-Item $manifest
            $latestAgent = ($agentFiles | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1).LastWriteTimeUtc
            $manifestCount = @(Get-Content $manifest -ErrorAction SilentlyContinue | Where-Object { $_ -match '^\s*\{' }).Count
            $manifestFresh = ($manifestCount -eq $agentFiles.Count) -and ($manifestInfo.LastWriteTimeUtc -ge $latestAgent)
        }

        if ($manifestFresh) {
            Write-Step "Agents registry fresh ($($agentFiles.Count) agents)" "OK" Green
        } else {
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

    # 7. Codex live probe — codex-exec.sh self-test
    #    Self-test runs 4 sub-probes in priority order: PATH (10) → auth (11)
    #    → timeout-math (12) → contract (13). Exit 0 = all 4 PASS. Exit N>0 =
    #    Nth probe failed and ones after it weren't reached.
    #
    #    Modes:
    #      Default boot          → --skip-network (cheap; auth via codex login status; no API call)
    #      -FullPreflight        → without --skip-network (real contract canary; burns ~13k Codex tokens)
    $codexExec = Join-Path $ScriptsDir "codex-exec.sh"
    if (Test-Path $codexExec) {
        $bashUnix  = $BashExe -replace '\\','/'
        $networkFlag = if ($FullPreflight) { '' } else { '--skip-network' }
        $codexCmd  = "'$bashUnix' '$($codexExec -replace '\\','/')' --self-test $networkFlag 2>&1"
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

        # 7b. Provider-health behavioral probe (always cheap — no API call by default).
        # Cross-checks codex login status against the self-test result. Catches
        # the v1.6 incident class where the script-level self-test gave a
        # false-negative on auth even though the CLI was logged in.
        # On -FullPreflight, also dispatches the contract canary (real call).
        $providerHealth = Join-Path $ProjectDir "super-gsd/tools/provider-health/check.cjs"
        if (Test-Path $providerHealth) {
            $phArgs = @($providerHealth, '--provider', 'codex')
            if ($FullPreflight) { $phArgs += '--behavioral' }
            # IMPORTANT: do not pipe through Select-Object — it closes the pipeline early
            # and kills the node process before it exits, producing a false UNAVAILABLE.
            # Capture full output, then read $LASTEXITCODE.
            $phOut = & node @phArgs 2>&1
            $phRc = $LASTEXITCODE
            if ($phRc -eq 0) {
                $phMode = if ($FullPreflight) { 'login-status + canary' } else { 'login-status' }
                Write-Step "Provider-health (codex) AVAILABLE [$phMode]" "OK" Green
            } else {
                Write-Step "Provider-health (codex) UNAVAILABLE [exit $phRc] — see metrics/codex-log.jsonl" "WARN" Yellow
        }
    }

    # Codex live watcher / narrator relay. This is the operator-side handoff
    # surface: raw stream stays live while Haiku summarisation runs in a hidden
    # relay worker and writes codex-eli5-relay.* under .planning/metrics.
    $codexWatchPs = Join-Path $ScriptsDir "sgsd-watch-codex.ps1"
    $codexWatchOpenPs = Join-Path $ScriptsDir "sgsd-open-codex-watch.ps1"
    $watcherFiles = @($codexWatchPs, $codexWatchOpenPs)
    $watcherMissing = @($watcherFiles | Where-Object { -not (Test-Path -LiteralPath $_) })
    if ($watcherMissing.Count -gt 0) {
        Write-Step "Codex watch relay missing: $($watcherMissing -join ', ')" "WARN" Yellow
    } else {
        $parseErrors = @()
        foreach ($watcherFile in $watcherFiles) {
            try {
                $tokens = $null
                $errors = $null
                [System.Management.Automation.Language.Parser]::ParseFile($watcherFile, [ref]$tokens, [ref]$errors) | Out-Null
                if ($errors -and $errors.Count -gt 0) { $parseErrors += "$watcherFile ($($errors.Count) parser errors)" }
            } catch {
                $parseErrors += "$watcherFile ($($_.Exception.Message))"
            }
        }
        $watcherText = Get-Content -LiteralPath $codexWatchPs -Raw -ErrorAction SilentlyContinue
        $relayContractOk = $watcherText -match 'NarrateWorker' -and
            $watcherText -match 'Start-NarratorRelay' -and
            $watcherText -match 'codex-eli5-relay' -and
            $watcherText -match '--strict-mcp-config' -and
            $watcherText -match '--no-session-persistence'

        if ($parseErrors.Count -gt 0) {
            Write-Step "Codex watch relay parser errors: $($parseErrors -join '; ')" "WARN" Yellow
        } elseif (-not $relayContractOk) {
            Write-Step "Codex watch relay contract missing (NarrateWorker / relay / stripped Haiku flags)" "WARN" Yellow
        } else {
            Write-Step "Codex watch relay ready (raw + narrator handoff)" "OK" Green
        }
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

    # 8. Knowledge-bank presence — VTP is one possible private KB, not a universal assumption.
    $configPath = Join-Path $ProjectDir ".planning/config.json"
    $mcpPath = Join-Path $ProjectDir ".mcp.json"
    $privateKnowledgeRoot = $null
    $memoryRoot = ".planning/memory"
    $fallbackCorpus = "sgsd-bundled-research"
    $vtpEnabled = $false
    $vtpMcpConfigured = $false

    try {
        if (Test-Path $configPath) {
            $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
            if ($cfg.knowledge) {
                if ($cfg.knowledge.private_root) { $privateKnowledgeRoot = "$($cfg.knowledge.private_root)" }
                if ($cfg.knowledge.memory_root) { $memoryRoot = "$($cfg.knowledge.memory_root)" }
                if ($cfg.knowledge.fallback_corpus) { $fallbackCorpus = "$($cfg.knowledge.fallback_corpus)" }
            }
            if ($cfg.vtp_enrichment -and $cfg.vtp_enrichment.enabled -eq $true) { $vtpEnabled = $true }
        }
    } catch { }

    if (Test-Path $mcpPath) {
        try {
            $mcp = Get-Content $mcpPath -Raw | ConvertFrom-Json
            $vtpServer = $mcp.mcpServers.PSObject.Properties | Where-Object { $_.Name -eq "vtp-kb" } | Select-Object -First 1
            if ($vtpServer) { $vtpMcpConfigured = $true }
        } catch { }
    }

    $memoryPath = if ([IO.Path]::IsPathRooted($memoryRoot)) { $memoryRoot } else { Join-Path $ProjectDir $memoryRoot }
    if (Test-Path $memoryPath) {
        Write-Step "SGSD memory root present ($memoryRoot)" "OK" Green
    } else {
        Write-Step "SGSD memory root missing ($memoryRoot) — run sgsd-setup" "WARN" Yellow
    }

    if ($privateKnowledgeRoot -and (Test-Path $privateKnowledgeRoot)) {
        Write-Step "Private knowledge bank present ($privateKnowledgeRoot)" "OK" Green
    } elseif ($vtpEnabled -and $vtpMcpConfigured) {
        Write-Step "VTP enrichment enabled via configured MCP; private KB path not required" "OK" Green
    } elseif ($vtpEnabled) {
        Write-Step "Knowledge bank missing but enrichment is enabled — run sgsd-setup" "WARN" Yellow
    } else {
        Write-Step "Private knowledge bank optional; fallback=$fallbackCorpus" "OK" DarkGray
    }

    if ($vtpMcpConfigured -and -not $privateKnowledgeRoot) {
        Write-Step "VTP MCP configured separately; private KB remains opt-in" "OK" DarkGray
    }

    # 8b. Local context database and optional Redis projection.
    # SQLite is the local query database friends can use without VTP. Redis is
    # only a disposable live cache; never canonical truth and never required.
    $contextRebuild = Join-Path $ProjectDir "super-gsd/tools/context-cache/rebuild.cjs"
    if (Test-Path $contextRebuild) {
        $activePlanningDir = Join-Path $ProjectDir ".planning"
        $cacheOut = & node $contextRebuild --status --planning-dir $activePlanningDir 2>&1
        $cacheText = ($cacheOut -join "`n")
        $cacheStatus = $null
        try { $cacheStatus = $cacheText | ConvertFrom-Json } catch { }

        if ($cacheStatus -and $cacheStatus.ok -eq $true) {
            $docCount = $cacheStatus.doc_count
            if ($cacheStatus.source_drift -and $cacheStatus.source_drift.detected -eq $true) {
                $driftPaths = @()
                if ($cacheStatus.source_drift.drifted_paths) { $driftPaths = @($cacheStatus.source_drift.drifted_paths) }
                $driftCount = $driftPaths.Count
                Write-Step "Local context DB present ($docCount docs) but drifted ($driftCount paths) - run node super-gsd/tools/context-cache/rebuild.cjs --rebuild" "WARN" Yellow
            } else {
                Write-Step "Local context DB ready ($docCount docs)" "OK" Green
            }
        } elseif ($cacheStatus -and $cacheStatus.error -eq "better_sqlite3_missing") {
            Write-Step "Local context DB unavailable - run npm install" "WARN" Yellow
        } elseif ($cacheStatus -and $cacheStatus.error -eq "db_missing") {
            $rebuildOut = & node $contextRebuild --rebuild --planning-dir $activePlanningDir 2>&1
            $rebuildText = ($rebuildOut -join "`n")
            $rebuildStatus = $null
            try { $rebuildStatus = $rebuildText | ConvertFrom-Json } catch { }
            if ($rebuildStatus -and $rebuildStatus.ok -eq $true) {
                Write-Step "Local context DB built ($($rebuildStatus.doc_count) docs)" "OK" Green
            } elseif ($rebuildStatus -and $rebuildStatus.error -eq "better_sqlite3_missing") {
                Write-Step "Local context DB not built - run npm install" "WARN" Yellow
            } else {
                Write-Step "Local context DB build failed - run node super-gsd/tools/context-cache/rebuild.cjs --rebuild" "WARN" Yellow
            }
        } else {
            Write-Step "Local context DB status unknown - run node super-gsd/tools/context-cache/rebuild.cjs --status" "WARN" Yellow
        }
    } else {
        Write-Step "Local context DB tool missing" "WARN" Yellow
    }

    $redisCli = (Get-Command redis-cli -ErrorAction SilentlyContinue)
    $redisRuntime = (Get-Command redis-server -ErrorAction SilentlyContinue)
    $dockerRuntime = (Get-Command docker -ErrorAction SilentlyContinue)
    $redisPong = $false
    if ($redisCli) {
        try {
            $redisPing = & redis-cli ping 2>$null
            if ("$redisPing".Trim() -eq "PONG") { $redisPong = $true }
        } catch { }
    }
    if ($redisPong) {
        Write-Step "Redis active (PONG); local DB remains canonical" "OK" Green
    } elseif ($redisRuntime -or $dockerRuntime) {
        Write-Step "Redis available but not active; local DB/file fallback active" "OK" DarkGray
    } else {
        Write-Step "Redis optional - not installed; local DB/file fallback active" "OK" DarkGray
    }

    if ($FullPreflight) {
        $redisSelfTest = Join-Path $ProjectDir "super-gsd/tools/context-cache/run-redis-self-test.cjs"
        if (Test-Path $redisSelfTest) {
            $null = & node $redisSelfTest 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Step "Redis adapter self-test (degrades without Redis)" "OK" Green
            } else {
                Write-Step "Redis adapter self-test failed (non-blocking)" "WARN" Yellow
            }
        }
    }

    # 9. Autopilot watchdog - external stall detector.
    # The dashboard can keep rendering even when the SGSD loop has stopped.
    # This self-test verifies the outside-of-Claude progress failsafe before
    # the cockpit launches it in monitor mode.
    $watchdogTool = Join-Path $ProjectDir "super-gsd/tools/autopilot-watchdog/check.cjs"
    if (Test-Path $watchdogTool) {
        $null = & node $watchdogTool --self-test 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Step "Autopilot watchdog self-test" "OK" Green
        } else {
            Write-Step "Autopilot watchdog self-test failed" "WARN" Yellow
        }
    } else {
        Write-Step "Autopilot watchdog missing" "WARN" Yellow
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
    Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/sgsd-mission-control.ps1 -ProjectDir '$ProjectDir'"
    Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/sgsd-codex-monitor.ps1   -ProjectDir '$ProjectDir'"
    Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/sgsd-narrative.ps1       -ProjectDir '$ProjectDir'"
    Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/sgsd-open-codex-watch.ps1 -ProjectDir '$ProjectDir'"
    Write-Host "  powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/sgsd-watch-codex.ps1      -ProjectDir '$ProjectDir' -Narrate"
    exit 0
}

Write-Host "LAUNCH" -ForegroundColor White
Write-Host "------"

$sgsd1 = Join-Path $ScriptsDir "sgsd-mission-control.ps1"
$sgsd2 = Join-Path $ScriptsDir "sgsd-codex-monitor.ps1"
$sgsd3 = Join-Path $ScriptsDir "sgsd-narrative.ps1"
$dashboardHost = Join-Path $ScriptsDir "sgsd-dashboard-host.ps1"
$cockpitServerStart = Join-Path $ScriptsDir "start-cockpit-server.ps1"
$watchdog = Join-Path $ScriptsDir "sgsd-autopilot-watchdog.ps1"
$codexWatch = Join-Path $ScriptsDir "sgsd-watch-codex.ps1"
$codexWatchOpen = Join-Path $ScriptsDir "sgsd-open-codex-watch.ps1"

foreach ($script in @($sgsd1, $sgsd2, $sgsd3, $dashboardHost, $cockpitServerStart, $watchdog, $codexWatch, $codexWatchOpen)) {
    if (-not (Test-Path $script)) {
        Write-Host "  MISSING: $script" -ForegroundColor Red
        exit 5
    }
}

function Start-LocalhostCockpit {
    if (-not (Test-Path -LiteralPath $cockpitServerStart)) {
        Write-Step "localhost cockpit startup script missing" "WARN" Yellow
        return
    }

    try {
        $serverOut = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $cockpitServerStart -Workspace $ProjectDir 2>&1
        $serverRc = $LASTEXITCODE
        foreach ($line in $serverOut) {
            Write-Host ("  {0}" -f $line) -ForegroundColor DarkGray
        }
        if ($serverRc -eq 0) {
            $portFile = Join-Path $ProjectDir ".planning/runtime/cockpit-server.port"
            $urlFile = Join-Path $ProjectDir ".planning/runtime/cockpit-server.url"
            $url = if (Test-Path $urlFile) { (Get-Content -Path $urlFile -TotalCount 1 -ErrorAction SilentlyContinue) } else { "" }
            $port = if (Test-Path $portFile) { (Get-Content -Path $portFile -TotalCount 1 -ErrorAction SilentlyContinue) } else { "" }
            $label = if ($url) { "localhost cockpit healthy ($url)" } elseif ($port) { "localhost cockpit healthy (port $port)" } else { "localhost cockpit healthy" }
            Write-Step $label "OK" Green
        } else {
            Write-Step "localhost cockpit failed to start [exit $serverRc]" "WARN" Yellow
        }
    } catch {
        Write-Step "localhost cockpit startup threw: $($_.Exception.Message)" "WARN" Yellow
    }
}

function Start-CodexLiveTail {
    if ($NoCodexTail) {
        Write-Step "codex watch window disabled by -NoCodexTail" "WARN" Yellow
        return
    }
    if (-not (Test-Path -LiteralPath $codexWatch)) {
        Write-Step "codex watch script missing" "WARN" Yellow
        return
    }
    try {
        if ($wt -and (Test-Path -LiteralPath $codexWatchOpen)) {
            $codexOpenArgs = @(
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", $codexWatchOpen,
                "-ProjectDir", $ProjectDir
            )
            if ($RaiseCockpit) { $codexOpenArgs += "-Foreground" }
            Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $codexOpenArgs | Out-Null
            $watchFocus = if ($RaiseCockpit) { "foreground" } else { "minimized/no-focus" }
            Write-Step "codex watch window opened (raw + narrator relay split, $watchFocus)" "OK" Green
        } else {
            $watchStyle = if ($RaiseCockpit) { "Normal" } else { "Minimized" }
            Start-Process powershell.exe -WindowStyle $watchStyle -ArgumentList "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $codexWatch, "-ProjectDir", $ProjectDir
            Start-Sleep -Milliseconds 250
            Start-Process powershell.exe -WindowStyle $watchStyle -ArgumentList "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $codexWatch, "-ProjectDir", $ProjectDir, "-Narrate"
            $watchFocus = if ($RaiseCockpit) { "foreground" } else { "minimized/no-focus" }
            Write-Step "codex watch windows opened (raw + narrator, $watchFocus)" "OK" Green
        }
    } catch {
        Write-Step "codex watch window failed to open" "WARN" Yellow
    }
}

function Start-AutopilotWatchdog {
    if ($NoWatchdog) {
        Write-Step "autopilot watchdog disabled by -NoWatchdog" "WARN" Yellow
        return
    }

    $args = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $watchdog,
        "-ProjectDir", $ProjectDir,
        "-IntervalSec", "60",
        "-WarnMin", "$WatchdogWarnMin",
        "-StaleMin", "$WatchdogStaleMin",
        "-Checkpoint"
    )
    if ($WatchdogRecover) { $args += "-Recover" }

    try {
        Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $args | Out-Null
        $mode = if ($WatchdogRecover) { "checkpoint + recovery launch" } else { "checkpoint only" }
        Write-Step "autopilot watchdog armed (${WatchdogWarnMin}m warn / ${WatchdogStaleMin}m stall, $mode)" "OK" Green
    } catch {
        Write-Step "autopilot watchdog failed to start" "WARN" Yellow
    }
}

$wt = Get-Command wt.exe -ErrorAction SilentlyContinue

Start-LocalhostCockpit

if ($wt) {
    $closedProcesses = Stop-SgsdDashboardProcesses
    if ($closedProcesses -gt 0) {
        Write-Step "stopped stale dashboard process(es) ($closedProcesses)" "OK" Yellow
    }

    $closed = Stop-CockpitWindows
    if ($closed -gt 0) {
        Write-Step "closed existing cockpit window(s) ($closed)" "OK" Yellow
    }

    Start-AutopilotWatchdog

    $psCmd = "powershell.exe"

    # Cockpit layout:
    #   left-top:     SGSD1 (Mission Control)
    #   left-bottom:  SGSD3 (Claude + active agents + fitted tool stream)
    #   right-full:   SGSD2 (Codex executor + ATC/gate/SpaceX detail)
    #
    # Build order matters: create SGSD2 as the right full-height pane first,
    # focus the first/left leaf pane directly, then split SGSD1 horizontally.
    # `move-focus left` proved unreliable inside chained wt commands; `first`
    # targets the original Mission Control pane regardless of split focus state.
    $launchArgs = @(
        "-w", "new",
        "new-tab", "--title", "SGSD-Cockpit", "--startingDirectory", $ProjectDir,
        $psCmd, "-NoExit", "-NoProfile", "-File", $dashboardHost, "-DashboardScript", $sgsd1, "-ProjectDir", $ProjectDir, "-Name", "SGSD1-Mission-Control",
        ";", "split-pane", "-V", "--size", "0.55", "--title", "SGSD2-Codex", "--startingDirectory", $ProjectDir,
        $psCmd, "-NoExit", "-NoProfile", "-File", $dashboardHost, "-DashboardScript", $sgsd2, "-ProjectDir", $ProjectDir, "-Name", "SGSD2-Codex",
        ";", "move-focus", "first",
        ";", "split-pane", "-H", "--size", "0.50", "--title", "SGSD3-Claude+Agents", "--startingDirectory", $ProjectDir,
        $psCmd, "-NoExit", "-NoProfile", "-File", $dashboardHost, "-DashboardScript", $sgsd3, "-ProjectDir", $ProjectDir, "-Name", "SGSD3-Claude+Agents"
    )
    Write-Step "Windows Terminal detected" "OK" Green
    $cockpitWindowStyle = if ($RaiseCockpit) { "Normal" } else { "Minimized" }
    $cockpitFocus = if ($RaiseCockpit) { "foreground" } else { "minimized/no-focus" }
    Write-Host "  Opening fresh WT window ($cockpitFocus): Mission + Claude stacked left, Codex/ATC full-height right..."
    Start-Process -FilePath "wt.exe" -ArgumentList $launchArgs -WindowStyle $cockpitWindowStyle
    Start-Sleep -Milliseconds 500

    if ($RaiseCockpit) {
        # Foreground activation is opt-in. The default boot path avoids
        # stealing focus from the terminal where `sg` was typed.
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
            Write-Host "  (note: couldn't auto-raise WT window - Alt+Tab to SGSD-Cockpit tab)" -ForegroundColor DarkYellow
        }
    }
    Write-Host ""
    Write-Host "Cockpit launched." -ForegroundColor Green
    Start-CodexLiveTail
} else {
    # Fallback - three separate PowerShell windows
    Write-Step "Windows Terminal not found - using separate PowerShell windows" "WARN" Yellow
    $closedProcesses = Stop-SgsdDashboardProcesses
    if ($closedProcesses -gt 0) {
        Write-Step "stopped stale dashboard process(es) ($closedProcesses)" "OK" Yellow
    }

    $closed = Stop-CockpitWindows
    if ($closed -gt 0) {
        Write-Step "closed existing cockpit window(s) ($closed)" "OK" Yellow
    }

    Start-AutopilotWatchdog

    $dashboardWindowStyle = if ($RaiseCockpit) { "Normal" } else { "Minimized" }
    Start-Process powershell.exe -WindowStyle $dashboardWindowStyle -ArgumentList "-NoExit", "-NoProfile", "-File", $dashboardHost, "-DashboardScript", $sgsd1, "-ProjectDir", $ProjectDir, "-Name", "SGSD1-Mission-Control"
    Start-Sleep -Milliseconds 300
    Start-Process powershell.exe -WindowStyle $dashboardWindowStyle -ArgumentList "-NoExit", "-NoProfile", "-File", $dashboardHost, "-DashboardScript", $sgsd2, "-ProjectDir", $ProjectDir, "-Name", "SGSD2-Codex"
    Start-Sleep -Milliseconds 300
    Start-Process powershell.exe -WindowStyle $dashboardWindowStyle -ArgumentList "-NoExit", "-NoProfile", "-File", $dashboardHost, "-DashboardScript", $sgsd3, "-ProjectDir", $ProjectDir, "-Name", "SGSD3-Claude+Agents"

    Write-Host ""
    Write-Host "Three dashboards opened in separate windows." -ForegroundColor Green
    Write-Host "Install Windows Terminal for a single-window cockpit: https://aka.ms/terminal" -ForegroundColor DarkGray
    Start-CodexLiveTail
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
        $claudeWindowStyle = if ($RaiseCockpit) { "Normal" } else { "Minimized" }
        Start-Process powershell.exe -WindowStyle $claudeWindowStyle -ArgumentList @("-NoExit", "-NoProfile", "-Command", $cmdString)
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
    Write-Host "  3. Watch the cockpit plus the separate Codex watch window (minimized unless -RaiseCockpit was used)."
} elseif ($Greet) {
    Write-Host "  1. Restore/switch to the Claude Code window that just opened."
    Write-Host "  2. Claude will introduce SGSD and ask what to build — answer it."
    Write-Host "  3. Watch the cockpit plus the separate Codex watch window (minimized unless -RaiseCockpit was used)."
} elseif ($Go) {
    Write-Host "  1. Restore/switch to the Claude Code window that just opened - AUTO MODE already engaged."
    Write-Host "  2. Watch the cockpit plus the separate Codex watch window (minimized unless -RaiseCockpit was used)."
} else {
    Write-Host "  1. Restore/switch to the Claude Code window that just opened."
    Write-Host "  2. Tell it what to build (or say 'go' for AUTO MODE, or re-run with -Greet next time)."
    Write-Host "  3. Watch the cockpit plus the separate Codex watch window (minimized unless -RaiseCockpit was used)."
}
Write-Host ""
Write-Host "  To pause anytime:  /sgsd-pause"
Write-Host "  To resume:         /sgsd-resume"
Write-Host ""
