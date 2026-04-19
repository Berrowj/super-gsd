# ============================================================================
# Super GSD · P5 · Gate Verdict Board
# ============================================================================
# Shows ATC + Browser Verify + Deferral Ledger status for the ACTIVE phase.
# Reactive via FileSystemWatcher — repaints the instant a gate file changes.
#
# Data sources:
#   .planning/STATE.md                   → current_phase
#   .planning/phases/{NN}-*/{NN}-VERIFICATION.md   → verifier verdict
#   .planning/phases/{NN}-*/{NN}-ATC-REVIEW.md     → ATC verdict
#   .planning/phases/{NN}-*/{NN}-BROWSER-REVIEW.md → browser verdict
#   .planning/phases/{NN}-*/BACKEND-NOT-READY.md   → Gate 4 halt evidence
#   .planning/phases/{NN}-*/TOOL-FALLBACK.md       → Gate 1 fallback declaration
#   .planning/phases/{NN}-*/evidence/              → artifact count
#   .planning/phases/{NN}-*/screenshots/           → screenshot count
#   .planning/DEFERRAL-LEDGER.md                   → open deferrals
#
# Usage:
#   sgsd-gate-verdict.ps1 [-ProjectDir PATH] [-Heartbeat 10]
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [int]$Heartbeat = 30
)

$ErrorActionPreference = "SilentlyContinue"

# Shared render cache: redraw throttle, HEAD-sha-keyed git cache, activity-log
# single-pass parser.
. (Join-Path $PSScriptRoot "lib\sgsd-render-cache.ps1")

# DLB-04 substrate status helper (registry + SEPL + distillation + gate 3).
. (Join-Path $PSScriptRoot "lib\sgsd-substrate-status.ps1")

try {
    $ProjectDir = (Resolve-Path $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve $ProjectDir" -ForegroundColor Red
    exit 1
}

$PlanningDir = Join-Path $ProjectDir ".planning"
if (-not (Test-Path $PlanningDir)) {
    Write-Host "ERROR: No .planning/ in $ProjectDir" -ForegroundColor Red
    exit 1
}

# ── ANSI escape codes ────────────────────────────────────────────────────────
$ESC = [char]27
$HOME_POS    = "$ESC[H"
$CLEAR_LINE  = "$ESC[K"
$CLEAR_BELOW = "$ESC[0J"
$HIDE_CURSOR = "$ESC[?25l"
$SHOW_CURSOR = "$ESC[?25h"
$ALT_ENTER   = "$ESC[?1049h"
$ALT_EXIT    = "$ESC[?1049l"

# Write-Host override — forces ANSI colour output in Warp/PTY. See sgsd-mission-control.ps1.
$script:_AnsiColors = @{
    Black = "$ESC[30m"; DarkBlue = "$ESC[34m"; DarkGreen = "$ESC[32m"; DarkCyan = "$ESC[36m"
    DarkRed = "$ESC[31m"; DarkMagenta = "$ESC[35m"; DarkYellow = "$ESC[33m"; Gray = "$ESC[37m"
    DarkGray = "$ESC[90m"; Blue = "$ESC[94m"; Green = "$ESC[92m"; Cyan = "$ESC[96m"
    Red = "$ESC[91m"; Magenta = "$ESC[95m"; Yellow = "$ESC[93m"; White = "$ESC[97m"
}
$script:_AnsiReset = "$ESC[0m"
function Write-Host {
    [CmdletBinding()]
    param(
        [Parameter(Position=0, ValueFromPipeline=$true, ValueFromRemainingArguments=$true)]
        [AllowNull()]
        [object]$Object,
        [switch]$NoNewline,
        [string]$ForegroundColor,
        [string]$BackgroundColor,
        [string]$Separator = ''
    )
    $text = if ($Object -is [array]) { ($Object -join $Separator) } else { "$Object" }
    if ($ForegroundColor -and $script:_AnsiColors.ContainsKey($ForegroundColor)) {
        $text = $script:_AnsiColors[$ForegroundColor] + $text + $script:_AnsiReset
    }
    if ($NoNewline) { [Console]::Out.Write($text) } else { [Console]::Out.WriteLine($text) }
}

# Mtime-keyed tail cache. Most redraws don't touch the specific log we're
# tailing — skip IO when file mtime+size match last cached read.
$script:_TailCache = @{}
function Get-CachedTail($path, $count) {
    if (-not (Test-Path $path)) { return @() }
    try {
        $item = Get-Item $path -ErrorAction Stop
        $key = "$path|$($item.LastWriteTimeUtc.Ticks)|$($item.Length)|$count"
        if ($script:_TailCache.ContainsKey($key)) { return $script:_TailCache[$key] }
        $lines = @(Get-Content $path -Tail $count -ErrorAction SilentlyContinue)
        $stale = @($script:_TailCache.Keys | Where-Object { $_.StartsWith("$path|") -and $_ -ne $key })
        foreach ($k in $stale) { $script:_TailCache.Remove($k) }
        $script:_TailCache[$key] = $lines
        return $lines
    } catch { return @() }
}

# ── Helpers ──────────────────────────────────────────────────────────────────
function Get-PaneWidth {
    try { return [Console]::WindowWidth - 1 } catch { return 50 }
}

function Trunc($text, $width) {
    if ($null -eq $text) { return "" }
    $text = "$text"
    if ($text.Length -gt $width) { return $text.Substring(0, [Math]::Max(0, $width - 2)) + ".." }
    return $text
}

function Get-Frontmatter($file, $key) {
    if (-not (Test-Path $file)) { return "" }
    try {
        $lines = Get-Content $file -TotalCount 30 -ErrorAction SilentlyContinue
        foreach ($line in $lines) {
            if ($line -match "^${key}:\s*(.*)$") {
                return $matches[1].Trim().Trim('"').Trim("'")
            }
        }
    } catch {}
    return ""
}

function Get-CurrentPhase {
    $stateFile = Join-Path $PlanningDir "STATE.md"
    $n = Get-Frontmatter $stateFile "current_phase"
    if (-not $n) { $n = Get-Frontmatter $stateFile "phase" }
    return $n
}

function Get-PhaseDir($phaseNum) {
    $phasesDir = Join-Path $PlanningDir "phases"
    if (-not (Test-Path $phasesDir)) { return $null }
    try {
        return Get-ChildItem -Path $phasesDir -Directory -ErrorAction SilentlyContinue |
               Where-Object { $_.Name -eq "$phaseNum" -or $_.Name.StartsWith("$phaseNum-") } |
               Select-Object -First 1
    } catch { return $null }
}

# ── Gate parsers ─────────────────────────────────────────────────────────────

function Parse-VerificationGate($phaseDir) {
    if ($null -eq $phaseDir) { return @{ status = "none"; detail = "" } }
    $files = Get-ChildItem -Path $phaseDir.FullName -Filter "*VERIFICATION.md" -ErrorAction SilentlyContinue
    if (-not $files) { return @{ status = "pending"; detail = "not run" } }
    $content = Get-Content $files[0].FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return @{ status = "pending"; detail = "empty file" } }
    $status = "unknown"
    $detail = ""
    if ($content -match '(?im)^\*\*?Status\*\*?:\s*(.+?)$') { $status = $matches[1].Trim().ToLower() }
    elseif ($content -match '(?im)^#\s+.*?(PASS|FAIL|VERIFIED|NEEDS)') { $status = $matches[1].ToLower() }
    $critRx = [regex]'(?i)critical.*?:\s*(\d+)'
    if ($critRx.IsMatch($content)) {
        $crit = [int]$critRx.Match($content).Groups[1].Value
        $detail = "$crit critical"
    } else {
        if ($content -match '(?im)criteria\s*(?:met|passed):\s*(\d+)\s*/\s*(\d+)') {
            $detail = "$($matches[1])/$($matches[2]) criteria"
        }
    }
    # Normalise to ok/warn/fail/pending
    $kind = "fail"
    if ($status -match "pass|verified|ok") { $kind = "ok" }
    elseif ($status -match "warn") { $kind = "warn" }
    return @{ status = $kind; detail = $detail; file = $files[0].Name }
}

function Parse-AtcGate($phaseDir) {
    if ($null -eq $phaseDir) { return @{ status = "none"; detail = "" } }
    $files = Get-ChildItem -Path $phaseDir.FullName -Filter "*ATC-REVIEW*.md" -ErrorAction SilentlyContinue
    if (-not $files) { return @{ status = "pending"; detail = "not run" } }
    $content = Get-Content $files[0].FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return @{ status = "pending"; detail = "empty file" } }
    $tier = "?"
    $crit = 0
    $warn = 0
    if ($content -match '(?im)tier[:\s]+(LITE|FULL|GATE|SKIP)') { $tier = $matches[1] }
    if ($content -match '(?im)critical[:\s]+(\d+)') { $crit = [int]$matches[1] }
    if ($content -match '(?im)warn(?:ing)?[:\s]+(\d+)') { $warn = [int]$matches[1] }
    $kind = "ok"
    if ($crit -gt 0) { $kind = "fail" }
    elseif ($warn -gt 0) { $kind = "warn" }
    return @{ status = $kind; detail = "$tier · $crit crit · $warn warn"; file = $files[0].Name }
}

function Parse-BrowserGate($phaseDir) {
    if ($null -eq $phaseDir) { return @{ status = "none"; detail = "" } }
    $result = @{
        status = "pending"
        detail = "not run"
        screenshots = 0
        har = 0
        api = 0
    }
    # Count evidence regardless of verdict file
    $evDir = Join-Path $phaseDir.FullName "evidence"
    $shotDir = Join-Path $phaseDir.FullName "screenshots"
    if (Test-Path $shotDir) {
        $result.screenshots = @(Get-ChildItem -Path $shotDir -Filter "*.png" -ErrorAction SilentlyContinue).Count
    }
    if (Test-Path $evDir) {
        $result.har = @(Get-ChildItem -Path $evDir -Filter "*.har" -ErrorAction SilentlyContinue).Count
        $result.api = @(Get-ChildItem -Path $evDir -Filter "*.api.json" -ErrorAction SilentlyContinue).Count
    }
    # Gate 1 / Gate 4 halt files take priority — they're the actual state
    $toolFallback = Join-Path $phaseDir.FullName "TOOL-FALLBACK.md"
    $backendNotReady = Join-Path $phaseDir.FullName "BACKEND-NOT-READY.md"
    if (Test-Path $backendNotReady) {
        $result.status = "fail"
        $result.detail = "Gate 4 HALT · backend not ready"
        return $result
    }
    if (Test-Path $toolFallback) {
        $result.status = "warn"
        $result.detail = "Gate 1 · tool fallback declared"
        return $result
    }
    $files = Get-ChildItem -Path $phaseDir.FullName -Filter "*BROWSER-REVIEW*.md" -ErrorAction SilentlyContinue
    if (-not $files) {
        if ($result.screenshots -gt 0) {
            $result.status = "warn"
            $result.detail = "$($result.screenshots) shots, no report"
        }
        return $result
    }
    $content = Get-Content $files[0].FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return $result }
    $verdict = "unknown"
    if ($content -match '(?im)overall verdict[:\s`*]+(\w+)') { $verdict = $matches[1].ToLower() }
    elseif ($content -match '(?im)^#\s+.*?(PROVEN|UNPROVEN|BLOCKED)') { $verdict = $matches[1].ToLower() }
    $routesChecked = 0
    if ($content -match '(?im)routes?\s*(?:audited|checked)[:\s]+(\d+)') { $routesChecked = [int]$matches[1] }
    $kind = switch ($verdict) {
        "proven"   { "ok" }
        "unproven" { "fail" }
        "blocked"  { "fail" }
        default    { "warn" }
    }
    $result.status = $kind
    $result.detail = "$verdict · $routesChecked routes"
    $result.file = $files[0].Name
    return $result
}

function Parse-NyquistGate($phaseDir) {
    if ($null -eq $phaseDir) { return @{ status = "none"; detail = "" } }
    $files = Get-ChildItem -Path $phaseDir.FullName -Filter "*VALIDATION*.md" -ErrorAction SilentlyContinue
    if (-not $files) { return @{ status = "pending"; detail = "not run" } }
    $content = Get-Content $files[0].FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return @{ status = "pending"; detail = "empty" } }
    $kind = "warn"; $detail = ""
    if ($content -match '(?im)(pass|verified|complete)') { $kind = "ok" }
    if ($content -match '(?im)(fail|incomplete|missing)') { $kind = "fail" }
    if ($content -match '(?im)coverage[:\s]+(\d+)\s*%') { $detail = "coverage $($matches[1])%" }
    elseif ($content -match '(?im)(\d+)\s*\/\s*(\d+)\s*requirements') { $detail = "$($matches[1])/$($matches[2]) reqs" }
    return @{ status = $kind; detail = $detail }
}

function Parse-SecurityGate($phaseDir) {
    if ($null -eq $phaseDir) { return @{ status = "none"; detail = "" } }
    $files = Get-ChildItem -Path $phaseDir.FullName -Filter "*SECURITY*.md" -ErrorAction SilentlyContinue
    if (-not $files) { return @{ status = "pending"; detail = "not run" } }
    $content = Get-Content $files[0].FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return @{ status = "pending"; detail = "empty" } }
    $high = 0; $med = 0; $low = 0
    if ($content -match '(?im)high[:\s]+(\d+)')    { $high = [int]$matches[1] }
    if ($content -match '(?im)medium[:\s]+(\d+)')  { $med  = [int]$matches[1] }
    if ($content -match '(?im)low[:\s]+(\d+)')     { $low  = [int]$matches[1] }
    $kind = "ok"
    if ($high -gt 0) { $kind = "fail" }
    elseif ($med -gt 0) { $kind = "warn" }
    return @{ status = $kind; detail = "H:$high M:$med L:$low" }
}

# Walk last 5 completed phase dirs and count PROVEN vs UNPROVEN browser verifies.
function Get-GateHistoryTrend {
    $phasesDir = Join-Path $PlanningDir "phases"
    if (-not (Test-Path $phasesDir)) { return @{ proven = 0; unproven = 0; total = 0 } }
    $result = @{ proven = 0; unproven = 0; total = 0 }
    try {
        $dirs = Get-ChildItem -Path $phasesDir -Directory -ErrorAction SilentlyContinue |
                Sort-Object Name -Descending | Select-Object -First 5
        foreach ($d in $dirs) {
            $br = Get-ChildItem -Path $d.FullName -Filter "*BROWSER-REVIEW*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
            if (-not $br) { continue }
            $c = Get-Content $br.FullName -Raw -ErrorAction SilentlyContinue
            if (-not $c) { continue }
            $result.total++
            if ($c -match '(?i)proven') { $result.proven++ }
            elseif ($c -match '(?i)unproven|blocked') { $result.unproven++ }
        }
    } catch {}
    return $result
}

function Parse-DeferralLedger {
    $file = Join-Path $PlanningDir "DEFERRAL-LEDGER.md"
    if (-not (Test-Path $file)) { return @() }
    $entries = @()
    try {
        $lines = Get-Content $file -ErrorAction SilentlyContinue
        foreach ($line in $lines) {
            if ($line -match '^\s*-\s*\[(x| )\]\s*\*\*Phase\s*(\d+(?:\.\d+)?)\*\*.*?—\s*(.+)$') {
                $done = ($matches[1] -eq "x")
                if ($done) { continue }
                $entries += @{
                    phase  = $matches[2]
                    reason = $matches[3].Trim()
                }
            } elseif ($line -match '^\s*-\s*\[(x| )\]\s*Phase\s*(\d+(?:\.\d+)?)\s*(?:[:\-—]\s*(.+))?$') {
                $done = ($matches[1] -eq "x")
                if ($done) { continue }
                $entries += @{
                    phase  = $matches[2]
                    reason = if ($matches[3]) { $matches[3].Trim() } else { "" }
                }
            }
        }
    } catch {}
    return @($entries)
}

# ── Karpathy enforcement parsers ────────────────────────────────────────────
# Each returns a hashtable of real numbers parsed from phase artefacts.
# When an artefact is missing, fields are 0/false — never errors.

# Principle 1: Think Before Coding
# Evidence: CONTEXT.md exists, RESEARCH.md exists, open questions count
function Get-ThinkScore($phaseDir) {
    $out = @{ hasContext = $false; hasResearch = $false; questions = 0; resolved = 0 }
    if ($null -eq $phaseDir) { return $out }
    $ctx = Get-ChildItem -Path $phaseDir.FullName -Filter "*CONTEXT*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    $res = Get-ChildItem -Path $phaseDir.FullName -Filter "*RESEARCH*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    $out.hasContext = ($ctx -ne $null)
    $out.hasResearch = ($res -ne $null)
    if ($ctx) {
        try {
            $c = Get-Content $ctx.FullName -Raw -ErrorAction SilentlyContinue
            if ($c) {
                # Count Q# markers and resolved markers
                $out.questions = ([regex]::Matches($c, '(?im)^\*\*?Q\d+\.?\*\*?|^Q\d+[.:]')).Count
                $out.resolved  = ([regex]::Matches($c, '(?im)recommendation[:\s*]')).Count
                if ($out.questions -eq 0) {
                    # Fallback: count lines starting with numbered list inside "Open questions" section
                    if ($c -match '(?ims)open questions([\s\S]+?)(?:\n##|\Z)') {
                        $qSection = $matches[1]
                        $out.questions = ([regex]::Matches($qSection, '(?m)^\s*\d+\.')).Count
                    }
                }
            }
        } catch {}
    }
    return $out
}

# Principle 2: Simplicity First
# Evidence: ATC review file — tier + critical/warning counts + checklist ratio
function Get-SimplicityScore($phaseDir) {
    $out = @{ hasReview = $false; tier = ""; critical = 0; warning = 0; checklistPass = 0; checklistTotal = 0 }
    if ($null -eq $phaseDir) { return $out }
    $atc = Get-ChildItem -Path $phaseDir.FullName -Filter "*ATC-REVIEW*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $atc) { return $out }
    $out.hasReview = $true
    try {
        $c = Get-Content $atc.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $c) { return $out }
        if ($c -match '(?im)tier[:\s]+(LITE|FULL|GATE|SKIP)') { $out.tier = $matches[1] }
        if ($c -match '(?im)critical[:\s]+(\d+)')             { $out.critical = [int]$matches[1] }
        if ($c -match '(?im)warn(?:ing)?[:\s]+(\d+)')          { $out.warning  = [int]$matches[1] }
        # Count ✅/❌ markers near anti-slop points
        $out.checklistPass  = ([regex]::Matches($c, '[✅✓]')).Count
        $out.checklistTotal = $out.checklistPass + ([regex]::Matches($c, '[❌✗]')).Count
        if ($out.checklistTotal -eq 0) { $out.checklistTotal = 10 }  # default anti-slop size
    } catch {}
    return $out
}

# Principle 3: Surgical Changes
# Evidence: git commits per phase, files touched vs files declared in plan,
# DEVIATIONS mentions in SUMMARY.md, orphan edits count.
function Get-SurgicalScore($phaseDir, $phaseNum) {
    $out = @{ commits = 0; filesTouched = 0; filesInPlan = 0; orphanFiles = 0; deviations = 0 }
    if ($null -eq $phaseDir) { return $out }

    # Count commits + files touched in a SINGLE git invocation.
    # Before: `git log --grep ... --format=%H` then one `git show --name-only`
    # per commit — N+1 git spawns (20 commits = 21 processes per render).
    # After: one `git log --grep ... --name-only --format=COMMIT:%H` that
    # interleaves a COMMIT:<sha> marker line with each commit's filenames; we
    # parse that stream in-process.
    try {
        $grep = "($phaseNum-|phase$phaseNum\b|P$phaseNum\b|feat\($phaseNum\b)"
        $lines = Invoke-CachedGit $ProjectDir "surgical-$phaseNum" @(
            "log", "--grep=$grep", "--format=COMMIT:%H", "--name-only", "-50"
        )
        $touched = @{}
        foreach ($line in $lines) {
            $line = "$line".Trim()
            if (-not $line) { continue }
            if ($line.StartsWith("COMMIT:")) {
                $out.commits++
                continue
            }
            $touched[$line] = $true
        }
        $out.filesTouched = $touched.Count
    } catch {}

    # Count files declared in plan <files> blocks
    try {
        $plans = Get-ChildItem -Path $phaseDir.FullName -Filter "*-PLAN.md" -ErrorAction SilentlyContinue
        $declared = @{}
        foreach ($p in $plans) {
            $c = Get-Content $p.FullName -Raw -ErrorAction SilentlyContinue
            if (-not $c) { continue }
            foreach ($m in [regex]::Matches($c, '(?s)<files>(.*?)</files>')) {
                foreach ($fLine in ($m.Groups[1].Value -split ',')) {
                    $f = $fLine.Trim().TrimEnd(',')
                    if ($f) { $declared[$f] = $true }
                }
            }
        }
        $out.filesInPlan = $declared.Count
    } catch {}

    # Count DEVIATIONS entries across SUMMARY.md files
    try {
        $summaries = Get-ChildItem -Path $phaseDir.FullName -Filter "*SUMMARY*.md" -ErrorAction SilentlyContinue
        foreach ($s in $summaries) {
            $c = Get-Content $s.FullName -Raw -ErrorAction SilentlyContinue
            if ($c -and $c -match '(?im)deviations[:\s]*(.+?)(?:\n##|\z)') {
                $dev = $matches[1]
                if ($dev -notmatch '(?i)none') {
                    $out.deviations += ([regex]::Matches($dev, '(?m)^\s*-\s+')).Count
                    if ($out.deviations -eq 0) { $out.deviations = 1 }
                }
            }
        }
    } catch {}

    # Orphan files = files touched but not declared in any plan
    if ($out.filesTouched -gt 0 -and $out.filesInPlan -gt 0) {
        $out.orphanFiles = [Math]::Max(0, $out.filesTouched - $out.filesInPlan)
    }
    return $out
}

# Principle 4: Goal-Driven Execution
# Evidence: VERIFICATION.md criteria met/total, test runs from activity log
function Get-GoalDrivenScore($phaseDir, $phaseNum) {
    $out = @{ hasVerification = $false; criteriaTotal = 0; criteriaMet = 0; testRuns = 0 }
    if ($null -eq $phaseDir) { return $out }

    $ver = Get-ChildItem -Path $phaseDir.FullName -Filter "*VERIFICATION*.md" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($ver) {
        $out.hasVerification = $true
        try {
            $c = Get-Content $ver.FullName -Raw -ErrorAction SilentlyContinue
            if ($c) {
                # Count numbered criteria, check for ✅
                $out.criteriaTotal = ([regex]::Matches($c, '(?m)^\s*\d+\.\s+')).Count
                $out.criteriaMet   = ([regex]::Matches($c, '[✅✓]')).Count
                if ($out.criteriaTotal -eq 0 -and $c -match '(?im)criteria\s*(?:met|passed):\s*(\d+)\s*/\s*(\d+)') {
                    $out.criteriaMet   = [int]$matches[1]
                    $out.criteriaTotal = [int]$matches[2]
                }
            }
        } catch {}
    }

    # Count pytest/npm test invocations from activity log tagged to this phase
    $log = Join-Path $PlanningDir "metrics\activity-log.jsonl"
    if (Test-Path $log) {
        try {
            # Was scanning the entire activity log every redraw. Cap at 400
            # lines — covers any realistic single-phase window.
            foreach ($line in (Get-CachedTail $log 400)) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    if ("$($e.phase)" -ne "$phaseNum") { continue }
                    if ($e.tool -ne "Bash") { continue }
                    if ("$($e.target)" -match '(?i)pytest|npm\s+test|jest|vitest|cargo\s+test|go\s+test') {
                        $out.testRuns++
                    }
                } catch {}
            }
        } catch {}
    }
    return $out
}

# ── Enrichment helpers (live enforcement block) ─────────────────────────────

# Phase elapsed time — earliest activity-log entry tagged phase=N
function Get-PhaseElapsed($phaseNum) {
    $log = Join-Path $PlanningDir "metrics\activity-log.jsonl"
    if (-not (Test-Path $log)) { return $null }
    try {
        $earliest = $null
        # Was a full-file scan. Cap at 400 — phase earliest ts lives here in
        # practice; if it drops off the tail the phase is too old to matter.
        $lines = Get-CachedTail $log 400
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ("$($e.phase)" -eq "$phaseNum") {
                    $ts = [DateTime]::Parse($e.ts)
                    if (-not $earliest -or $ts -lt $earliest) { $earliest = $ts }
                }
            } catch {}
        }
        if ($earliest) { return [int]((Get-Date) - $earliest).TotalSeconds }
    } catch {}
    return $null
}

# Format seconds as "4m 12s" or "1h 3m"
function Format-Elapsed($sec) {
    if ($null -eq $sec) { return "--" }
    if ($sec -lt 60)   { return "${sec}s" }
    if ($sec -lt 3600) { return "$([math]::Floor($sec/60))m $($sec % 60)s" }
    return "$([math]::Floor($sec/3600))h $(([math]::Floor($sec/60)) % 60)m"
}

# Build a timeline of orchestrator step completions for the current phase.
# Reads activity-log.jsonl for TaskCreate/TaskUpdate events tagged phase=N,
# plus the last 10 git commits matching the phase. Returns newest-first.
function Get-PhaseTimeline($phaseNum) {
    $events = @()
    $log = Join-Path $PlanningDir "metrics\activity-log.jsonl"
    if (Test-Path $log) {
        try {
            # Shrunk 400 → 150. Timeline only shows last handful of events.
            $lines = Get-CachedTail $log 150
            foreach ($line in $lines) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    if ("$($e.phase)" -ne "$phaseNum") { continue }
                    if ($e.tool -ne "TaskCreate" -and $e.tool -ne "Agent") { continue }
                    $target = "$($e.target)"
                    if (-not $target) { continue }
                    $ts = $null
                    try { $ts = [DateTime]::Parse($e.ts) } catch {}
                    if (-not $ts) { continue }
                    # Extract short agent name
                    $agent = $target
                    if ($target -match '^([a-zA-Z][\w-]+)\s*[:\[]') { $agent = $matches[1] }
                    elseif ($target -match '^([a-zA-Z][\w-]+)') { $agent = $matches[1] }
                    # Extract the activeForm description if bracketed
                    $desc = $target
                    if ($target -match '[–—-]\s*(.+)$') { $desc = $matches[1].Trim() }
                    $events += @{
                        ts = $ts
                        agent = $agent
                        desc = $desc
                        kind = "dispatch"
                    }
                } catch {}
            }
        } catch {}
    }
    # Git commits for the phase — shared HEAD-sha-keyed cache; free after first
    # render in any given HEAD state.
    try {
        $commits = Invoke-CachedGit $ProjectDir "cI-h-s-50" @("log", "--format=%cI|%h|%s", "-50")
        foreach ($c in $commits) {
            if (-not $c) { continue }
            $parts = $c -split '\|', 3
            if ($parts.Count -lt 3) { continue }
            $subj = $parts[2]
            if ($subj -notmatch "(?i)phase.?$phaseNum|P$phaseNum[\.\-]|\bph$phaseNum\b|\b0?$phaseNum\b") { continue }
            try {
                $ts = [DateTime]::Parse($parts[0])
                $events += @{
                    ts    = $ts
                    agent = "git"
                    desc  = "$($parts[1]) $subj"
                    kind  = "commit"
                }
            } catch {}
        }
    } catch {}
    # Sort newest first, deduplicate by (agent + desc + ts-rounded-to-sec)
    $events = $events | Sort-Object { $_.ts } -Descending
    return @($events)
}

# Find the most recently completed phase (lower number than current) that has gate reports
function Get-LastPhaseGates {
    $phasesDir = Join-Path $PlanningDir "phases"
    if (-not (Test-Path $phasesDir)) { return $null }
    $currentNum = Get-CurrentPhase
    try {
        $dirs = Get-ChildItem -Path $phasesDir -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^(\d+)' } |
                Sort-Object Name -Descending
        foreach ($d in $dirs) {
            # Skip the current phase
            if ($currentNum -and $d.Name.StartsWith("$currentNum")) { continue }
            # Must have at least one gate report
            $any = Get-ChildItem -Path $d.FullName -Filter "*VERIFICATION*" -ErrorAction SilentlyContinue
            if (-not $any) { continue }
            $verR = Parse-VerificationGate $d
            $atcR = Parse-AtcGate $d
            $brvR = Parse-BrowserGate $d
            $nyqR = Parse-NyquistGate $d
            $secR = Parse-SecurityGate $d
            $pnum = ($d.Name -split '-', 2)[0]
            return @{
                phase = $pnum
                ver = $verR.status
                atc = $atcR.status
                brv = $brvR.status
                nyq = $nyqR.status
                sec = $secR.status
            }
        }
    } catch {}
    return $null
}

# ── Readiness card ───────────────────────────────────────────────────────────
# Reads .planning/milestones/{id}/MILESTONE-READINESS.md and .planning/metrics/readiness-log.jsonl.
# Shows whether the active milestone cleared pre-flight + any recent drift events.

function Get-ReadinessCard {
    $state = Join-Path $PlanningDir "STATE.md"
    if (-not (Test-Path $state)) { return $null }
    $milestone = $null
    foreach ($ln in Get-Content $state -TotalCount 40 -ErrorAction SilentlyContinue) {
        if ($ln -match '^\s*active_milestone:\s*(\S+)') { $milestone = $Matches[1].Trim('"',"'"); break }
        if ($ln -match '^\s*milestone:\s*(\S+)')        { $milestone = $Matches[1].Trim('"',"'"); break }
    }
    if (-not $milestone) { return $null }

    $path = Join-Path $PlanningDir "milestones\$milestone\MILESTONE-READINESS.md"
    $status = "MISSING"; $eta = "n/a"; $stale = $false
    if (Test-Path $path) {
        $status = (Get-Frontmatter $path "status")
        $eta    = (Get-Frontmatter $path "first_stall_eta_min")
        $mt = (Get-Item $path).LastWriteTime
        $phasesDir = Join-Path $PlanningDir "phases"
        if (Test-Path $phasesDir) {
            $newest = Get-ChildItem $phasesDir -Directory -ErrorAction SilentlyContinue |
                      Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($newest -and $newest.LastWriteTime -gt $mt) { $stale = $true }
        }
    }
    # Last drift event
    $log = Join-Path $PlanningDir "metrics\readiness-log.jsonl"
    $lastDrift = $null
    if (Test-Path $log) {
        $tail = Get-CachedTail $log 20
        foreach ($ln in ($tail | Sort-Object -Descending)) {
            if ($ln -match '"status"\s*:\s*"DRIFT"') { $lastDrift = $ln; break }
        }
    }
    [pscustomobject]@{ milestone=$milestone; status=$status; eta=$eta; stale=$stale; path=$path; lastDrift=$lastDrift }
}

# ── Render ───────────────────────────────────────────────────────────────────

function Render {
    # Throttle FSWatcher bursts. Heartbeat still enforces a full repaint every
    # $Heartbeat seconds, so no gate state ever goes unnoticed.
    if (-not (Test-RenderDue -MinIntervalMs 2000)) { return }

    Write-Host $HOME_POS -NoNewline

    $pw = Get-PaneWidth
    $phaseNum = Get-CurrentPhase
    $phaseDir = Get-PhaseDir $phaseNum
    $ts = Get-Date -Format 'HH:mm:ss'

    # Header — single line, v5 compact style matching sgsd1
    Write-Host "SUPER GSD" -NoNewline -ForegroundColor Magenta
    Write-Host " ! " -NoNewline -ForegroundColor Red
    Write-Host "Gate Verdict" -NoNewline -ForegroundColor White
    Write-Host " P$phaseNum" -NoNewline -ForegroundColor Yellow
    Write-Host "  $ts" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    # Readiness card — milestone pre-flight + drift
    $rc = Get-ReadinessCard
    if ($rc) {
        $rcColor = switch ($rc.status) { "GO" {"Green"} "PARTIAL" {"Yellow"} "BLOCKED" {"Red"} "MISSING" {"DarkYellow"} default {"DarkGray"} }
        $tag = if ($rc.stale) { " (stale)" } else { "" }
        Write-Host "READINESS" -NoNewline -ForegroundColor White
        Write-Host ": " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($rc.status)$tag" -NoNewline -ForegroundColor $rcColor
        Write-Host "  M=" -NoNewline -ForegroundColor DarkGray
        Write-Host $rc.milestone -NoNewline -ForegroundColor Cyan
        if ($rc.lastDrift) {
            Write-Host "  [recent DRIFT]" -NoNewline -ForegroundColor Red
        }
        Write-Host $CLEAR_LINE
    }

    # ── DLB-04 Substrate panel: registry + SEPL queue + triple gate ──
    # This is the natural home for the DLB-04 status because gate-verdict IS
    # the gate board. Gate 1/2 routing outcomes + Gate 3 verdict show here.
    $substrate = Get-SubstrateStatus -ProjectDir $ProjectDir
    $substratePanel = Format-SubstratePanel -Status $substrate -Width 66
    $panelColor = if ($substrate.Gate3Verdict -eq "RETIRE") {
        "Red"
    } elseif ($substrate.NoveltyCount -gt 0) {
        "Green"
    } elseif ($substrate.HypothesesCount -gt 0) {
        "Yellow"
    } else {
        "DarkGray"
    }
    foreach ($ln in $substratePanel) {
        Write-Host $ln -ForegroundColor $panelColor -NoNewline
        Write-Host $CLEAR_LINE
    }

    if (-not $phaseNum) {
        Write-Host "  (no current phase in STATE.md)$CLEAR_LINE" -ForegroundColor DarkGray
        Write-Host $CLEAR_BELOW -NoNewline
        return
    }

    # Gates
    $ver  = Parse-VerificationGate $phaseDir
    $atc  = Parse-AtcGate $phaseDir
    $brv  = Parse-BrowserGate $phaseDir
    $nyq  = Parse-NyquistGate $phaseDir
    $sec  = Parse-SecurityGate $phaseDir

    # ── ENFORCEMENT block (live during execution) ──
    $elapsed = Get-PhaseElapsed $phaseNum
    Write-Host "ENFORCEMENT " -NoNewline -ForegroundColor White
    Write-Host "(P$phaseNum " -NoNewline -ForegroundColor DarkGray
    Write-Host "running " -NoNewline -ForegroundColor DarkGray
    Write-Host (Format-Elapsed $elapsed) -NoNewline -ForegroundColor Cyan
    Write-Host ")" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    # Real config detection for the Karpathy surface (option 3)
    $overlayPath = Join-Path $ProjectDir "CLAUDE.md"
    $globalOverlay = Join-Path $HOME ".claude\CLAUDE.md"
    $karpathyInstalled = $false
    foreach ($p in @($overlayPath, $globalOverlay)) {
        if (Test-Path $p) {
            $c = Get-Content $p -Raw -ErrorAction SilentlyContinue
            if ($c -and $c -match '(?i)karpathy') { $karpathyInstalled = $true; break }
        }
    }
    $skillPath = Join-Path $HOME ".claude\commands\sgsd-orchestrate\SKILL.md"
    $surgicalInjected = $false
    if (Test-Path $skillPath) {
        $c = Get-Content $skillPath -Raw -ErrorAction SilentlyContinue
        if ($c -and $c -match 'SURGICAL CONSTRAINT') { $surgicalInjected = $true }
    }

    Write-Host "  ATC tier " -NoNewline -ForegroundColor DarkGray
    Write-Host ($(if ($atc.status -eq "none") { "FULL" } else { "$($atc.detail)" })) -NoNewline -ForegroundColor Yellow
    Write-Host " / Karpathy " -NoNewline -ForegroundColor DarkGray
    if ($karpathyInstalled) { Write-Host "ON" -NoNewline -ForegroundColor Green }
    else                    { Write-Host "off" -NoNewline -ForegroundColor Red }
    Write-Host " / Surgical " -NoNewline -ForegroundColor DarkGray
    if ($surgicalInjected) { Write-Host "INJECTED" -NoNewline -ForegroundColor Green }
    else                    { Write-Host "missing" -NoNewline -ForegroundColor Red }
    Write-Host $CLEAR_LINE

    # ── KARPATHY REPORT CARD — real numbers per principle ──
    $think    = Get-ThinkScore $phaseDir
    $simple   = Get-SimplicityScore $phaseDir
    $surgical = Get-SurgicalScore $phaseDir $phaseNum
    $goal     = Get-GoalDrivenScore $phaseDir $phaseNum

    Write-Host "KARPATHY " -NoNewline -ForegroundColor White
    Write-Host "P$phaseNum" -NoNewline -ForegroundColor Yellow
    Write-Host " receipts" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    # [1] Think
    Write-Host "  [1] Think    " -NoNewline -ForegroundColor DarkGray
    $thinkColor = if ($think.hasContext -and $think.hasResearch) { "Green" } elseif ($think.hasContext) { "Yellow" } else { "DarkGray" }
    $ctxMark = if ($think.hasContext) { "ctx v" } else { "ctx ." }
    $resMark = if ($think.hasResearch) { "research v" } else { "research ." }
    Write-Host "$ctxMark" -NoNewline -ForegroundColor $thinkColor
    Write-Host " - " -NoNewline -ForegroundColor DarkGray
    Write-Host "$resMark" -NoNewline -ForegroundColor $thinkColor
    if ($think.questions -gt 0) {
        Write-Host " - " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($think.resolved)/$($think.questions) qs" -NoNewline -ForegroundColor $thinkColor
    }
    Write-Host $CLEAR_LINE

    # [2] Simplicity
    Write-Host "  [2] Simple   " -NoNewline -ForegroundColor DarkGray
    if ($simple.hasReview) {
        $simColor = if ($simple.critical -gt 0) { "Red" } elseif ($simple.warning -gt 0) { "Yellow" } else { "Green" }
        Write-Host "$($simple.tier)" -NoNewline -ForegroundColor Yellow
        Write-Host " - " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($simple.critical)c" -NoNewline -ForegroundColor $(if ($simple.critical -gt 0) { "Red" } else { "Green" })
        Write-Host " - " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($simple.warning)w" -NoNewline -ForegroundColor $(if ($simple.warning -gt 0) { "Yellow" } else { "Green" })
    } else {
        Write-Host "ATC not run yet" -NoNewline -ForegroundColor DarkGray
    }
    Write-Host $CLEAR_LINE

    # [3] Surgical
    Write-Host "  [3] Surgical " -NoNewline -ForegroundColor DarkGray
    $surgColor = if ($surgical.orphanFiles -gt 0 -or $surgical.deviations -gt 0) { "Red" } elseif ($surgical.commits -eq 0) { "DarkGray" } else { "Green" }
    Write-Host "$($surgical.commits)c" -NoNewline -ForegroundColor $surgColor
    Write-Host " - " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($surgical.filesTouched)f" -NoNewline -ForegroundColor $surgColor
    Write-Host "/" -NoNewline -ForegroundColor DarkGray
    Write-Host "$($surgical.filesInPlan) plan" -NoNewline -ForegroundColor DarkGray
    if ($surgical.orphanFiles -gt 0) {
        Write-Host " - " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($surgical.orphanFiles) orph" -NoNewline -ForegroundColor Red
    }
    if ($surgical.deviations -gt 0) {
        Write-Host " - " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($surgical.deviations) dev" -NoNewline -ForegroundColor Red
    }
    Write-Host $CLEAR_LINE

    # [4] Goal-Driven
    Write-Host "  [4] Goal     " -NoNewline -ForegroundColor DarkGray
    if ($goal.hasVerification) {
        $goalColor = if ($goal.criteriaTotal -gt 0 -and $goal.criteriaMet -eq $goal.criteriaTotal) { "Green" } elseif ($goal.criteriaMet -lt $goal.criteriaTotal) { "Yellow" } else { "Green" }
        Write-Host "$($goal.criteriaMet)/$($goal.criteriaTotal) criteria" -NoNewline -ForegroundColor $goalColor
    } else {
        Write-Host "verifier not run yet" -NoNewline -ForegroundColor DarkGray
    }
    if ($goal.testRuns -gt 0) {
        Write-Host " - " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($goal.testRuns) test runs" -NoNewline -ForegroundColor Cyan
    }
    Write-Host $CLEAR_LINE

    # Expected gate chain — dots light up as each gate's file lands
    Write-Host "  chain: " -NoNewline -ForegroundColor DarkGray
    $chain = @(
        @{ label = "Verify"; gate = $ver }
        @{ label = "ATC";    gate = $atc }
        @{ label = "Brw";    gate = $brv }
        @{ label = "Nyq";    gate = $nyq }
        @{ label = "Sec";    gate = $sec }
    )
    for ($i = 0; $i -lt $chain.Count; $i++) {
        $c = $chain[$i]
        $dot = switch ($c.gate.status) {
            "ok"      { "v" }
            "warn"    { "~" }
            "fail"    { "x" }
            "pending" { "." }
            default   { "." }
        }
        $dotColor = switch ($c.gate.status) {
            "ok"      { "Green" }
            "warn"    { "Yellow" }
            "fail"    { "Red" }
            "pending" { "DarkGray" }
            default   { "DarkGray" }
        }
        Write-Host "$($c.label)" -NoNewline -ForegroundColor DarkGray
        Write-Host $dot -NoNewline -ForegroundColor $dotColor
        if ($i -lt ($chain.Count - 1)) { Write-Host " - " -NoNewline -ForegroundColor DarkGray }
    }
    Write-Host $CLEAR_LINE

    # ── PHASE TIMELINE — orchestrator step completions for current phase ──
    $timeline = Get-PhaseTimeline $phaseNum
    if ($timeline.Count -gt 0) {
        Write-Host $CLEAR_LINE
        Write-Host "TIMELINE " -NoNewline -ForegroundColor White
        Write-Host "P$phaseNum" -NoNewline -ForegroundColor Yellow
        Write-Host " (last 6 events)" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
        $show = [Math]::Min(6, $timeline.Count)
        for ($i = 0; $i -lt $show; $i++) {
            $ev = $timeline[$i]
            $tsStr = $ev.ts.ToString("HH:mm:ss")
            $agentShort = $ev.agent
            if ($agentShort.Length -gt 14) { $agentShort = $agentShort.Substring(0, 13) + "." }
            $desc = $ev.desc
            $descMax = $pw - 28
            if ($descMax -lt 10) { $descMax = 10 }
            if ($desc.Length -gt $descMax) { $desc = $desc.Substring(0, [Math]::Max(1, $descMax - 2)) + ".." }
            $agentColor = if ($ev.kind -eq "commit") { "Green" } else { "Magenta" }
            Write-Host "  $tsStr " -NoNewline -ForegroundColor DarkGray
            Write-Host $agentShort.PadRight(14) -NoNewline -ForegroundColor $agentColor
            Write-Host " $desc" -NoNewline -ForegroundColor Gray
            Write-Host $CLEAR_LINE
        }
    }

    # Last phase gate summary — reference point so Jack knows what "good" looks like
    $last = Get-LastPhaseGates
    if ($last) {
        Write-Host "LAST " -NoNewline -ForegroundColor White
        Write-Host "P$($last.phase)" -NoNewline -ForegroundColor Yellow
        Write-Host " summary" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
        function Write-LastChip($label, $state) {
            $color = switch ($state) {
                "ok"      { "Green" }
                "warn"    { "Yellow" }
                "fail"    { "Red" }
                "pending" { "DarkGray" }
                default   { "DarkGray" }
            }
            $text = switch ($state) {
                "ok"      { "OK" }
                "warn"    { "WRN" }
                "fail"    { "FL" }
                "pending" { "--" }
                default   { "--" }
            }
            Write-Host "${label}:" -NoNewline -ForegroundColor DarkGray
            Write-Host "$text " -NoNewline -ForegroundColor $color
        }
        Write-Host "  " -NoNewline
        Write-LastChip "ver" $last.ver
        Write-LastChip "atc" $last.atc
        Write-LastChip "brw" $last.brv
        Write-LastChip "nyq" $last.nyq
        Write-LastChip "sec" $last.sec
        Write-Host $CLEAR_LINE
    }
    Write-Host $CLEAR_LINE

    function Write-GateLine($label, $gate) {
        $chip = switch ($gate.status) {
            "ok"      { "PASS" }
            "warn"    { "WARN" }
            "fail"    { "FAIL" }
            "pending" { "PEND" }
            default   { "  - " }
        }
        $chipColor = switch ($gate.status) {
            "ok"      { "Green" }
            "warn"    { "Yellow" }
            "fail"    { "Red" }
            "pending" { "DarkGray" }
            default   { "DarkGray" }
        }
        Write-Host "  [" -NoNewline -ForegroundColor DarkGray
        Write-Host $chip -NoNewline -ForegroundColor $chipColor
        Write-Host "] " -NoNewline -ForegroundColor DarkGray
        Write-Host $label.PadRight(14) -NoNewline -ForegroundColor Gray
        $detail = Trunc $gate.detail ($pw - 22)
        Write-Host $detail -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    }

    Write-GateLine "6.0 Verifier" $ver
    Write-GateLine "6.5 ATC"      $atc
    Write-GateLine "6.6 Browser"  $brv
    Write-GateLine "6.7 Nyquist"  $nyq
    Write-GateLine "6.8 Security" $sec

    # Browser evidence sub-line
    if ($brv.screenshots -gt 0 -or $brv.har -gt 0 -or $brv.api -gt 0) {
        Write-Host "       " -NoNewline
        Write-Host "evidence: " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($brv.screenshots) shots" -NoNewline -ForegroundColor Cyan
        Write-Host " / " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($brv.har) HAR" -NoNewline -ForegroundColor Cyan
        Write-Host " / " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($brv.api) api" -NoNewline -ForegroundColor Cyan
        Write-Host $CLEAR_LINE
    }

    # Gate history trend — last 5 phases browser verify outcomes
    $trend = Get-GateHistoryTrend
    if ($trend.total -gt 0) {
        Write-Host "  trend: " -NoNewline -ForegroundColor DarkGray
        $color = if ($trend.unproven -eq 0) { "Green" } elseif ($trend.unproven -ge 2) { "Red" } else { "Yellow" }
        Write-Host "$($trend.proven)/$($trend.total) PROVEN last 5" -NoNewline -ForegroundColor $color
        if ($trend.unproven -gt 0) {
            Write-Host " ($($trend.unproven) unproven)" -NoNewline -ForegroundColor Red
        }
        Write-Host $CLEAR_LINE
    }

    # Deferral ledger
    $deferrals = Parse-DeferralLedger
    $deferrals = @($deferrals)
    Write-Host $CLEAR_LINE
    Write-Host "─── DEFERRAL LEDGER · $($deferrals.Count) open " -NoNewline -ForegroundColor DarkGray
    $used = 26 + "$($deferrals.Count)".Length
    if ($pw - $used -gt 0) { Write-Host ("─" * ($pw - $used)) -NoNewline -ForegroundColor DarkGray }
    Write-Host $CLEAR_LINE
    if ($deferrals.Count -eq 0) {
        Write-Host "  (none open)$CLEAR_LINE" -ForegroundColor DarkGray
    } else {
        $show = [Math]::Min(5, $deferrals.Count)
        for ($i = 0; $i -lt $show; $i++) {
            $d = $deferrals[$i]
            $agePhases = 0
            if ($phaseNum -and $d.phase) {
                try { $agePhases = [int]([double]$phaseNum - [double]$d.phase) } catch {}
            }
            $mark = if ($agePhases -ge 3) { "[REOPEN]" } elseif ($agePhases -ge 2) { "[warn]" } else { "[open]" }
            $markColor = if ($agePhases -ge 3) { "Red" } elseif ($agePhases -ge 2) { "Yellow" } else { "DarkGray" }
            Write-Host "  P$($d.phase) " -NoNewline -ForegroundColor White
            Write-Host $mark -NoNewline -ForegroundColor $markColor
            Write-Host " " -NoNewline
            $reason = Trunc $d.reason ($pw - 14)
            Write-Host $reason -NoNewline -ForegroundColor DarkGray
            Write-Host $CLEAR_LINE
        }
        if ($deferrals.Count -gt $show) {
            Write-Host "  + $($deferrals.Count - $show) more$CLEAR_LINE" -ForegroundColor DarkGray
        }
    }

    # Clear below
    Write-Host $CLEAR_BELOW -NoNewline
}

# ── File watcher + main loop ─────────────────────────────────────────────────
Write-Host "$ALT_ENTER$ESC[2J$ESC[H$HIDE_CURSOR" -NoNewline

$global:needsRedraw = $true
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $PlanningDir
$watcher.IncludeSubdirectories = $true
$watcher.EnableRaisingEvents = $true
$null = Register-ObjectEvent -InputObject $watcher -EventName Changed -Action { $global:needsRedraw = $true }
$null = Register-ObjectEvent -InputObject $watcher -EventName Created -Action { $global:needsRedraw = $true }
$null = Register-ObjectEvent -InputObject $watcher -EventName Renamed -Action { $global:needsRedraw = $true }

$lastHeartbeat = [DateTime]::MinValue

try {
    while ($true) {
        if ($global:needsRedraw -or (((Get-Date) - $lastHeartbeat).TotalSeconds -ge $Heartbeat)) {
            $global:needsRedraw = $false
            $lastHeartbeat = Get-Date
            Render
        }
        # Longer sleep — Test-RenderDue inside Render enforces the real 2s cap.
        Start-Sleep -Milliseconds 2000
    }
} finally {
    Write-Host "$SHOW_CURSOR$ALT_EXIT" -NoNewline
}
