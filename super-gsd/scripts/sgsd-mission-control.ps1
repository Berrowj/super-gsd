# ============================================================================
# Super GSD · P3 · Mission Control
# ============================================================================
# Reactive live dashboard. Uses FileSystemWatcher to redraw only when source
# files change. No polling flicker. Fixed-width columns so in-place redraws
# never leave trailing characters.
#
# Shows (matches .superpowers/mockups/sgsd-workspace-v4.html P3):
#   - Milestone header + progress bar
#   - Phase progression (last built · current · next) with ROADMAP traceability
#   - Full wave timeline for active phase with completion timestamps from git
#   - Red counters for remaining phases + sub-waves
#   - Session cost box (Opus/Sonnet/Haiku + total + per-phase)
#   - Agent roster with ACTIVE/IDLE/RECENT status
#
# Usage:
#   sgsd-mission-control.ps1 [-ProjectDir PATH] [-Heartbeat 10]
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [int]$Heartbeat = 30
)

# ── loud-fail helper ─────────────────────────────────────────────────────────
# Runs BEFORE $ErrorActionPreference = SilentlyContinue so errors are visible.
# In -NoExit panes (the Cockpit), pauses so operators can read the error
# instead of landing on a blank PS prompt.
function __sgsd_fail($title, $detail) {
    Write-Host ""
    Write-Host "  ╔════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host ("  ║  {0,-54}║" -f $title)                                        -ForegroundColor Red
    Write-Host "  ╚════════════════════════════════════════════════════════╝" -ForegroundColor Red
    Write-Host ""
    foreach ($line in $detail) { Write-Host "    $line" -ForegroundColor DarkYellow }
    Write-Host ""
    Write-Host "    Fix: run from the project dir, or pass it explicitly:" -ForegroundColor Gray
    Write-Host "      sgsd1 C:\path\to\project" -ForegroundColor Gray
    Write-Host "    Default fallback: C:\Users\jack.berrow\GSDedits"      -ForegroundColor Gray
    Write-Host ""
    if ($Host.Name -ne 'ConsoleHost' -or $env:SGSD_NO_PAUSE_ON_ERROR) { exit 1 }
    Write-Host "    Press any key to close this window..." -ForegroundColor DarkGray
    $null = [System.Console]::ReadKey($true)
    exit 1
}

# ── resolve + guard BEFORE silencing errors ──────────────────────────────────
try {
    $ProjectDir = (Resolve-Path $ProjectDir -ErrorAction Stop).Path
} catch {
    __sgsd_fail "CANNOT RESOLVE PROJECT DIR" @(
        "Supplied: $ProjectDir",
        "Resolve-Path error: $($_.Exception.Message)"
    )
}

$PlanningDir = Join-Path $ProjectDir ".planning"
if (-not (Test-Path $PlanningDir)) {
    __sgsd_fail "NO .planning/ DIRECTORY FOUND" @(
        "Project dir: $ProjectDir",
        "Expected:    $PlanningDir",
        "",
        "SGSD dashboards require a project root that contains .planning/.",
        "If the sgsd1.cmd launcher passed the wrong path, you can override:",
        "  sgsd1 C:\Users\jack.berrow\GSDedits"
    )
}

# Now silence non-fatal errors for the hot path.
$ErrorActionPreference = "SilentlyContinue"

# Shared render cache: redraw throttle, HEAD-sha-keyed git cache, activity-log
# single-pass parser, active Claude session cache.
$__renderCache = Join-Path $PSScriptRoot "lib\sgsd-render-cache.ps1"
if (-not (Test-Path $__renderCache)) {
    __sgsd_fail "MISSING LIB: sgsd-render-cache.ps1" @(
        "Expected: $__renderCache",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__renderCache

# DLB-04 substrate status helper (registry + SEPL + distillation + gate 3).
$__substrate = Join-Path $PSScriptRoot "lib\sgsd-substrate-status.ps1"
if (-not (Test-Path $__substrate)) {
    __sgsd_fail "MISSING LIB: sgsd-substrate-status.ps1" @(
        "Expected: $__substrate",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__substrate

$__codex = Join-Path $PSScriptRoot "lib\sgsd-codex-status.ps1"
if (-not (Test-Path $__codex)) {
    __sgsd_fail "MISSING LIB: sgsd-codex-status.ps1" @(
        "Expected: $__codex",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__codex

# ── ANSI escape codes ────────────────────────────────────────────────────────
$ESC = [char]27
$HOME_POS    = "$ESC[H"
$CLEAR_LINE  = "$ESC[K"
$CLEAR_BELOW = "$ESC[0J"
$HIDE_CURSOR = "$ESC[?25l"
$SHOW_CURSOR = "$ESC[?25h"

# ── Write-Host override ──────────────────────────────────────────────────────
# PowerShell 5.1's native Write-Host -ForegroundColor routes through the
# Windows Console colour API which gets SILENTLY STRIPPED in Warp's PTY.
# This override emits raw ANSI escape codes via [Console]::Out instead, so
# every existing Write-Host call renders colour in any terminal without
# modifying the call sites.
$script:_AnsiColors = @{
    Black        = "$ESC[30m"
    DarkBlue     = "$ESC[34m"
    DarkGreen    = "$ESC[32m"
    DarkCyan     = "$ESC[36m"
    DarkRed      = "$ESC[31m"
    DarkMagenta  = "$ESC[35m"
    DarkYellow   = "$ESC[33m"
    Gray         = "$ESC[37m"
    DarkGray     = "$ESC[90m"
    Blue         = "$ESC[94m"
    Green        = "$ESC[92m"
    Cyan         = "$ESC[96m"
    Red          = "$ESC[91m"
    Magenta      = "$ESC[95m"
    Yellow       = "$ESC[93m"
    White        = "$ESC[97m"
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
    if ($NoNewline) {
        [Console]::Out.Write($text)
    } else {
        [Console]::Out.WriteLine($text)
    }
}
# Alt screen buffer — essential for Warp/terminals that use block-oriented
# rendering. Without this, each redraw scrolls the previous content into
# scrollback instead of overwriting in place.
$ALT_ENTER   = "$ESC[?1049h"
$ALT_EXIT    = "$ESC[?1049l"

# ── Cost rates (API-equivalent blended) ──────────────────────────────────────
$RATE_OPUS   = 45.0 / 1000000
$RATE_SONNET =  9.0 / 1000000
$RATE_HAIKU  =  2.4 / 1000000

# Per-field rates for session-aggregate cost (BACKLOG-001). Blended rates above
# are designed for token-log.jsonl's `total` field (est_input+est_output, no cache).
# Session JSONL carries 4 distinct usage fields — each priced differently by Anthropic.
# Values USD per MTok as of 2026-04; update when Anthropic's pricing page shifts.
# Source: https://www.anthropic.com/pricing (verify before acting on the cockpit's $ figure).
$RATE_OPUS_IN     = 15.0    / 1000000
$RATE_OPUS_OUT    = 75.0    / 1000000
$RATE_OPUS_CWRITE = 18.75   / 1000000
$RATE_OPUS_CREAD  =  1.50   / 1000000
$RATE_SONNET_IN     =  3.0  / 1000000
$RATE_SONNET_OUT    = 15.0  / 1000000
$RATE_SONNET_CWRITE =  3.75 / 1000000
$RATE_SONNET_CREAD  =  0.30 / 1000000
$RATE_HAIKU_IN     =  0.80  / 1000000
$RATE_HAIKU_OUT    =  4.00  / 1000000
$RATE_HAIKU_CWRITE =  1.00  / 1000000
$RATE_HAIKU_CREAD  =  0.08  / 1000000

# Mtime-keyed tail cache. FSWatcher fires on ANY file under .planning, but
# most redraws don't touch the specific log we're tailing. When the file's
# mtime+size match the last cached read, skip IO + allocation entirely.
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

function Pad-To($text, $width) {
    if ($null -eq $text) { $text = "" }
    $text = "$text"
    if ($text.Length -gt $width) { return $text.Substring(0, [Math]::Max(0, $width - 2)) + ".." }
    return $text.PadRight($width)
}

function Format-Num($n) {
    if ($n -lt 1000) { return "$n" }
    if ($n -lt 1000000) { return "$([math]::Round($n/1000))K" }
    return "$([math]::Round($n/1000000, 1))M"
}

function Format-Dollar($n) {
    if ($n -lt 0.01) { return "<`$0.01" }
    if ($n -lt 100)  { return "`$$([math]::Round($n, 2))" }
    return "`$$([math]::Round($n))"
}

function Format-Age($sec) {
    if ($null -eq $sec) { return "--" }
    if ($sec -lt 60)   { return "${sec}s" }
    if ($sec -lt 3600) { return "$([math]::Floor($sec/60))m" }
    if ($sec -lt 86400){ return "$([math]::Floor($sec/3600))h" }
    return "$([math]::Floor($sec/86400))d"
}

function Make-Bar($pct, $width) {
    $filled = [math]::Floor(($pct / 100) * $width)
    if ($filled -gt $width) { $filled = $width }
    if ($filled -lt 0) { $filled = 0 }
    return ('#' * $filled) + ('-' * ($width - $filled))
}

# Read a key:value from YAML frontmatter (first 30 lines)
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

# Claude Code session dir encoding: colon/slash/dot → dash
function Encode-ProjectPath($path) {
    return $path -replace '[:\\/.]', '-'
}

# Returns @{ contextTokens, contextMax, contextPct, thinkingBlocks, thinkingOn, model }
function Get-SessionStats {
    $stats = @{
        contextTokens  = 0
        contextMax     = 200000  # Opus default
        contextPct     = 0
        thinkingBlocks = 0
        thinkingOn     = $false
        model          = "unknown"
    }
    $encoded = Encode-ProjectPath $ProjectDir
    $sessionsDir = Join-Path $HOME ".claude\projects\$encoded"
    if (-not (Test-Path $sessionsDir)) { return $stats }
    try {
        $file = Get-ChildItem -Path $sessionsDir -Filter "*.jsonl" -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
        if (-not $file) { return $stats }
        # Tail last 20 lines — usage blocks are on assistant messages
        $lines = Get-CachedTail $file.FullName 20
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($e.type -eq "assistant" -and $e.message) {
                    # Pick the most recent usage block (highest input_tokens + cache_read)
                    if ($e.message.usage) {
                        $u = $e.message.usage
                        $total = [int]($u.input_tokens) + [int]($u.cache_read_input_tokens) + [int]($u.cache_creation_input_tokens)
                        if ($total -gt $stats.contextTokens) { $stats.contextTokens = $total }
                    }
                    if ($e.message.model) { $stats.model = "$($e.message.model)" }
                    # Count thinking blocks in content
                    if ($e.message.content) {
                        foreach ($block in @($e.message.content)) {
                            if ($block.type -eq "thinking") { $stats.thinkingBlocks++ }
                        }
                    }
                }
            } catch {}
        }
        # Determine context max from model.
        # Match any Claude model with [1m] suffix (opus-4-6, opus-4-7, sonnet-4-6 1M variants etc)
        # or -1m suffix. Inference fallback: if observed tokens already exceed the 200k standard cap,
        # the session must be running on a 1M-context variant regardless of model string (Claude Code's
        # session JSONL sometimes records model without the [1m] suffix even for 1M sessions — see
        # super-gsd/scripts/sgsd-ctx.js `maxForModel` for the full write-up).
        if ($stats.model -match "\[1m\]|-1m($|[^a-z])") { $stats.contextMax = 1000000 }
        elseif ($stats.contextTokens -gt 200000)        { $stats.contextMax = 1000000 }
        elseif ($stats.model -match "opus|sonnet|haiku"){ $stats.contextMax = 200000 }
        if ($stats.contextTokens -gt 0 -and $stats.contextMax -gt 0) {
            $stats.contextPct = [math]::Round(($stats.contextTokens / $stats.contextMax) * 100)
        }
        $stats.thinkingOn = ($stats.thinkingBlocks -gt 0)
    } catch {}
    return $stats
}

# Session-wide token aggregation: walks the FULL current session JSONL and sums
# input + cache_read + cache_creation + output per assistant turn, partitioned by
# model family. Cached by (mtime, size) so we only re-read when the session grows.
# Returns @{ opusTok, sonnetTok, haikuTok, totalTok, outputTok, cost, session }.
# Resolves BACKLOG-001: cockpit should show total session tokens + $ aggregate,
# not just per-model $ from the (often stale) token-log.jsonl.
$script:_sessionAggKey    = $null
$script:_sessionAggParsed = $null
function Get-SessionAggregate {
    $agg = @{
        opusTok   = 0
        sonnetTok = 0
        haikuTok  = 0
        totalTok  = 0
        outputTok = 0
        cost      = 0.0
        session   = $null
    }
    $encoded = Encode-ProjectPath $ProjectDir
    $sessionsDir = Join-Path $HOME ".claude\projects\$encoded"
    if (-not (Test-Path $sessionsDir)) { return $agg }
    try {
        $file = Get-ChildItem -Path $sessionsDir -Filter "*.jsonl" -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
        if (-not $file) { return $agg }
        $agg.session = $file.Name
        $key = "$($file.LastWriteTimeUtc.Ticks)|$($file.Length)"
        if ($script:_sessionAggKey -eq $key -and $script:_sessionAggParsed) {
            return $script:_sessionAggParsed
        }
        foreach ($line in (Get-Content $file.FullName -ErrorAction SilentlyContinue)) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($e.type -ne "assistant" -or -not $e.message -or -not $e.message.usage) { continue }
                $u = $e.message.usage
                $uIn     = [int]($u.input_tokens)
                $uOut    = [int]($u.output_tokens)
                $uCwrite = [int]($u.cache_creation_input_tokens)
                $uCread  = [int]($u.cache_read_input_tokens)
                $turnAll = $uIn + $uOut + $uCwrite + $uCread
                $agg.totalTok  += $turnAll
                $agg.outputTok += $uOut
                $m = "$($e.message.model)".ToLower()
                # Per-field pricing — cache_read is ~10x cheaper than fresh input,
                # so summing into a blended rate overstates cost by 5-10x (see git
                # history note on BACKLOG-001 session-cost fix).
                if ($m -match 'opus') {
                    $agg.opusTok += $turnAll
                    $agg.cost += ($uIn * $RATE_OPUS_IN) + ($uOut * $RATE_OPUS_OUT) + ($uCwrite * $RATE_OPUS_CWRITE) + ($uCread * $RATE_OPUS_CREAD)
                } elseif ($m -match 'sonnet') {
                    $agg.sonnetTok += $turnAll
                    $agg.cost += ($uIn * $RATE_SONNET_IN) + ($uOut * $RATE_SONNET_OUT) + ($uCwrite * $RATE_SONNET_CWRITE) + ($uCread * $RATE_SONNET_CREAD)
                } elseif ($m -match 'haiku') {
                    $agg.haikuTok += $turnAll
                    $agg.cost += ($uIn * $RATE_HAIKU_IN) + ($uOut * $RATE_HAIKU_OUT) + ($uCwrite * $RATE_HAIKU_CWRITE) + ($uCread * $RATE_HAIKU_CREAD)
                }
            } catch {}
        }
        $script:_sessionAggKey    = $key
        $script:_sessionAggParsed = $agg
    } catch {}
    return $agg
}

# Parse STATE.md body `## Blockers` section (lines below the header until next ##)
function Get-StateBlockers {
    $stateFile = Join-Path $PlanningDir "STATE.md"
    if (-not (Test-Path $stateFile)) { return @() }
    $blockers = @()
    try {
        $inBlockers = $false
        foreach ($line in Get-Content $stateFile -ErrorAction SilentlyContinue) {
            if ($line -match '^##\s*Blockers?') { $inBlockers = $true; continue }
            if ($inBlockers -and $line -match '^##\s') { break }
            if ($inBlockers -and $line -match '^\s*-\s+(.+)$') {
                $b = $matches[1].Trim()
                if ($b -and $b -notmatch '^(None|N\/A|-)$') { $blockers += $b }
            }
        }
    } catch {}
    return @($blockers)
}

# Returns true if a checkpoint exists (session is paused)
function Test-Checkpoint {
    return (Test-Path (Join-Path $PlanningDir "ORCHESTRATOR-CHECKPOINT.md"))
}

# Parse tasks for a specific wave. Returns @{ taskStart; taskEnd; total; done; active; nextT; tasks=@() }
# Task range comes from the "(Tasks X-Y)" or "(Task X)" suffix in the wave's <name>.
# Done count comes from git log commits matching "feat(phase{N}-W{M}" or "P{N}-W{M}-T{k}".
# Active task comes from the newest TaskCreate target matching "W{M}" for this phase.
function Get-WaveTasks($wave, $phaseNum) {
    $result = @{
        taskStart = 0
        taskEnd = 0
        total = 0
        done = 0
        activeTask = $null
        tasks = @()
    }
    if (-not $wave -or -not $wave.name) { return $result }

    # Extract (Tasks X-Y) / (Task X) from the original wave description if available.
    # Fall back to scanning the PLAN.md for the raw wave name including the suffix.
    $waveNameFull = ""
    try {
        $phasesDir = Join-Path $PlanningDir "phases"
        $dir = Get-ChildItem -Path $phasesDir -Directory -ErrorAction SilentlyContinue |
               Where-Object { $_.Name -eq "$phaseNum" -or $_.Name.StartsWith("$phaseNum-") } |
               Select-Object -First 1
        if ($dir) {
            foreach ($plan in (Get-ChildItem -Path $dir.FullName -Filter "*-PLAN.md" -ErrorAction SilentlyContinue)) {
                $c = Get-Content $plan.FullName -Raw -ErrorAction SilentlyContinue
                if ($c -and $c -match "<name>\s*Wave\s+$($wave.wave)\s*[·•\.\-:].*?</name>") {
                    $waveNameFull = $matches[0]
                    break
                }
            }
        }
    } catch {}

    if ($waveNameFull -match '\(Tasks?\s*(\d+)(?:\s*[\-\u2013]\s*(\d+))?\)') {
        $result.taskStart = [int]$matches[1]
        $result.taskEnd   = if ($matches[2]) { [int]$matches[2] } else { [int]$matches[1] }
        $result.total     = $result.taskEnd - $result.taskStart + 1
    } else {
        $result.total = 1
    }

    # Done tasks: count commits matching any known pattern for this phase + wave.
    # Pull git log ONCE via the HEAD-sha-keyed cache, then filter in-process for
    # every (phase, wave) combination. Before the cache, each active wave
    # re-spawned git — four waves = four git processes per render.
    try {
        $wv = $wave.wave
        $pattern = "(phase$phaseNum[-_]|P$phaseNum[\.\-_]|^(\d+-)?(\w+)\(phase$phaseNum).*[Ww]$wv|[-_]W$wv[\s:\-]|\bW$wv[\s:]"
        $commits = Invoke-CachedGit $ProjectDir "oneline-200" @("log", "--oneline", "-200") |
                   Select-String -Pattern $pattern -List
        $result.done = @($commits).Count
    } catch {}

    # Active task: scan activity log for newest TaskCreate with W{wv} tag
    $log = Join-Path $PlanningDir "metrics\activity-log.jsonl"
    if (Test-Path $log) {
        try {
            $lines = @(Get-CachedTail $log 100)
            [array]::Reverse($lines)
            foreach ($line in $lines) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    if ($e.tool -ne "TaskCreate" -and $e.tool -ne "Agent") { continue }
                    if ("$($e.phase)" -ne "$phaseNum") { continue }
                    $t = "$($e.target)"
                    if ($t -match "W$($wave.wave)\b" -or $t -match "Wave\s+$($wave.wave)\b") {
                        # Extract task number if present: "T5" or "Task 5"
                        if ($t -match '\bT(\d+)\b|\bTask\s+(\d+)\b') {
                            $tn = if ($matches[1]) { [int]$matches[1] } else { [int]$matches[2] }
                            $result.activeTask = @{ num = $tn; target = $t }
                        }
                        if (-not $result.activeTask) {
                            $result.activeTask = @{ num = 0; target = $t }
                        }
                        break
                    }
                } catch {}
            }
        } catch {}
    }

    # Build per-task rows if we know the range
    if ($result.taskStart -gt 0 -and $result.total -le 20) {
        for ($i = $result.taskStart; $i -le $result.taskEnd; $i++) {
            $status = "pending"
            if ($result.done -ge ($i - $result.taskStart + 1)) { $status = "done" }
            if ($result.activeTask -and $result.activeTask.num -eq $i) { $status = "active" }
            $result.tasks += @{ num = $i; status = $status }
        }
    }
    return $result
}

# Returns last 3 git commits as array of @{ hash; subject }
function Get-RecentCommits {
    $out = @()
    try {
        $lines = Invoke-CachedGit $ProjectDir "oneline-3" @("log", "--oneline", "-3")
        foreach ($l in $lines) {
            if ($l -match '^([a-f0-9]+)\s+(.+)$') {
                $out += @{ hash = $matches[1]; subject = $matches[2] }
            }
        }
    } catch {}
    return @($out)
}

function Get-CodexCommitCount {
    try {
        $lines = Invoke-CachedGit $ProjectDir "oneline-12" @("log", "--oneline", "-12")
        return @($lines | Where-Object { $_ -match 'CODEX-|codex' }).Count
    } catch {}
    return 0
}

# ── Parsers ──────────────────────────────────────────────────────────────────

function Get-StateInfo {
    $stateFile = Join-Path $PlanningDir "STATE.md"
    return @{
        milestone     = Get-Frontmatter $stateFile "milestone"
        milestoneName = Get-Frontmatter $stateFile "milestone_name"
        currentPhase  = Get-Frontmatter $stateFile "current_phase"
        status        = Get-Frontmatter $stateFile "status"
    }
}

function Get-RoadmapPhases($milestone) {
    # Returns array of @{ num; name; done } extracted from ROADMAP.md.
    # Strategy: the SUMMARY LIST (with `- [x] **Phase N: title**` markdown) is the
    # authoritative done/not-done source. Parse that FIRST. If the list isn't
    # present, fall back to the detail block `### Phase N:` headers.
    $path = Join-Path $PlanningDir "ROADMAP.md"
    if (-not (Test-Path $path)) { return @() }
    $content = Get-Content $path -Raw -ErrorAction SilentlyContinue
    if (-not $content) { return @() }
    $phases = @()
    $seen = @{}

    # PRIMARY: summary list `- [x] **Phase N: title**` — supports bold markdown
    # + optional `✅` / `🔄` / `⏸` emoji + optional `(completed ...)` trailing note.
    $rxSummary = [regex]'(?m)^\s*-\s*\[(x| )\]\s*\*{0,2}Phase\s+(\d+(?:\.\d+)?):\s*\*{0,2}(.+?)\*{0,2}\s*$'
    foreach ($m in $rxSummary.Matches($content)) {
        $num = $m.Groups[2].Value
        if ($seen.ContainsKey($num)) { continue }
        $seen[$num] = $true
        $name = $m.Groups[3].Value.Trim()
        # Strip bold markers, emoji, and trailing "- description" notes if present
        $name = $name -replace '\s*\*+\s*$', '' -replace '^\s*\*+\s*', ''
        if ($name -match '^(.+?)\s*(?:[-—]|\(completed|\*\*)') { $name = $matches[1].Trim() }
        $done = ($m.Groups[1].Value -eq "x")
        $phases += @{ num = $num; name = $name; done = $done }
    }

    # SECONDARY: detail block `### Phase NN: description` — used if summary missing
    # OR if summary has fewer entries than the detail block (i.e. some phases
    # exist only in detail form). Only add phases not already seen from summary.
    $rx = [regex]'(?m)^###\s*Phase\s+(\d+(?:\.\d+)?):\s*(.+?)(?:\s*(✅|🔄|⏸))?$'
    foreach ($m in $rx.Matches($content)) {
        $num = $m.Groups[1].Value
        if ($seen.ContainsKey($num)) { continue }
        $seen[$num] = $true
        $name = $m.Groups[2].Value.Trim()
        $done = $m.Groups[3].Value -eq "✅"
        $phases += @{ num = $num; name = $name; done = $done }
    }

    # Fallback list format: `- [x] Phase N: title` (no bold, no asterisks)
    if ($phases.Count -eq 0) {
        $rx2 = [regex]'(?m)^\s*-\s*\[(x| )\]\s*Phase\s+(\d+(?:\.\d+)?):\s*(.+)$'
        foreach ($m in $rx2.Matches($content)) {
            $phases += @{
                num  = $m.Groups[2].Value
                name = $m.Groups[3].Value.Trim()
                done = ($m.Groups[1].Value -eq "x")
            }
        }
    }
    return @($phases | Sort-Object { [double]$_.num })
}

function Get-ActivePhaseDir($phaseNum) {
    $phasesDir = Join-Path $PlanningDir "phases"
    if (-not (Test-Path $phasesDir)) { return $null }
    try {
        $d = Get-ChildItem -Path $phasesDir -Directory -ErrorAction SilentlyContinue |
             Where-Object { $_.Name -eq "$phaseNum" -or $_.Name.StartsWith("$phaseNum-") } |
             Select-Object -First 1
        return $d
    } catch { return $null }
}

function Get-Waves($phaseDir) {
    # Parse PLAN.md bodies for <name>Wave N · description (Tasks X-Y)</name>
    $waves = @()
    if ($null -eq $phaseDir) { return $waves }
    try {
        $plans = Get-ChildItem -Path $phaseDir.FullName -Filter "*-PLAN.md" -ErrorAction SilentlyContinue | Sort-Object Name
        foreach ($plan in $plans) {
            $content = Get-Content $plan.FullName -Raw -ErrorAction SilentlyContinue
            if (-not $content) { continue }
            $rx = [regex]'<name>\s*Wave\s+(\d+)\s*[\u00B7\u2022\.\-:]\s*([^<]+?)\s*</name>'
            foreach ($m in $rx.Matches($content)) {
                $num  = [int]$m.Groups[1].Value
                $desc = $m.Groups[2].Value.Trim()
                $taskCount = 0
                if ($desc -match '\(Tasks?\s*(\d+)(?:\s*[\-\u2013]\s*(\d+))?\)') {
                    $start = [int]$matches[1]
                    $end   = if ($matches[2]) { [int]$matches[2] } else { $start }
                    $taskCount = $end - $start + 1
                }
                $cleanName = ($desc -replace '\s*\(Tasks?\s*\d+(?:\s*[\-\u2013]\s*\d+)?\)\s*$', '').Trim()
                $waves += @{
                    plan      = $plan.BaseName
                    wave      = $num
                    name      = $cleanName
                    taskCount = $taskCount
                    status    = "pending"
                    completedAt = $null
                    completedAgo = $null
                }
            }
        }
    } catch {}
    return @($waves | Sort-Object { $_.wave })
}

function Get-WaveTimestamps($waves, $phaseNum) {
    # For each wave, find the most recent commit matching `phaseN-WM` or `phaseX-WM`
    # in git log. Returns the waves array with completedAt and completedAgo filled in.
    # Pulls the recent-commit list ONCE via the HEAD-sha-keyed cache, then filters
    # in-process per wave (was: one git spawn per wave per render).
    $commits = Invoke-CachedGit $ProjectDir "cI-s-50" @("log", "--format=%cI|%s", "-50")
    foreach ($w in $waves) {
        $pattern = "[Ww](?:ave\s*)?$($w.wave)\b|-W$($w.wave)\b"
        $hit = $commits | Select-String -Pattern $pattern -List | Select-Object -First 1
        if ($hit) {
            try {
                $ts = [DateTime]::Parse($hit.Line.Split('|')[0])
                $w.completedAt  = $ts
                $w.completedAgo = [int]((Get-Date) - $ts).TotalSeconds
            } catch {}
        }
    }
    return $waves
}

function Get-ActiveWaveFromLog {
    # Scan recent activity log for `W<N>` or `Wave <N>` in TaskCreate/Agent targets
    $log = Join-Path $PlanningDir "metrics\activity-log.jsonl"
    if (-not (Test-Path $log)) { return $null }
    try {
        $lines = @(Get-CachedTail $log 100)
        if ($lines.Count -eq 0) { return $null }
        [array]::Reverse($lines)
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($e.tool -ne "TaskCreate" -and $e.tool -ne "Agent") { continue }
                $target = "$($e.target)"
                if ($target -match '\bW(\d+)\b') { return [int]$matches[1] }
                if ($target -match '\bWave\s+(\d+)') { return [int]$matches[1] }
            } catch {}
        }
    } catch {}
    return $null
}

$script:_tokenStatsKey    = $null
$script:_tokenStatsParsed = $null  # @{ lines = [object[]]; currentPhase = "" ; stats = @{...} }
function Get-TokenStats {
    $log = Join-Path $PlanningDir "metrics\token-log.jsonl"
    $stats = @{ opus = 0; sonnet = 0; haiku = 0; total = 0; cost = 0.0; phaseCost = 0.0 }
    if (-not (Test-Path $log)) { return $stats }

    # Cache the parsed entries AND the opus/sonnet/haiku totals by (mtime, length).
    # Before: every render re-read the whole file and reparsed every line. After:
    # only the phaseCost (which depends on currentPhase) gets recomputed per
    # render — everything else is memoised until a new token event lands.
    try {
        $item = Get-Item $log -ErrorAction Stop
        $key = "$($item.LastWriteTimeUtc.Ticks)|$($item.Length)"
        $state = Get-StateInfo
        $currentPhase = $state.currentPhase

        $parsed = $null
        if ($script:_tokenStatsKey -eq $key) {
            $parsed = $script:_tokenStatsParsed
        } else {
            $parsed = @{ entries = @() }
            foreach ($line in (Get-Content $log -ErrorAction SilentlyContinue)) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    $parsed.entries += @{
                        model = "$($e.model)".ToLower()
                        total = [int]$e.total
                        phase = "$($e.phase)"
                    }
                } catch {}
            }
            # Totals don't depend on currentPhase — safe to cache
            $parsed.opus   = 0
            $parsed.sonnet = 0
            $parsed.haiku  = 0
            foreach ($e in $parsed.entries) {
                switch ($e.model) {
                    "opus"   { $parsed.opus   += $e.total }
                    "sonnet" { $parsed.sonnet += $e.total }
                    "haiku"  { $parsed.haiku  += $e.total }
                }
            }
            $script:_tokenStatsKey    = $key
            $script:_tokenStatsParsed = $parsed
        }

        $stats.opus   = $parsed.opus
        $stats.sonnet = $parsed.sonnet
        $stats.haiku  = $parsed.haiku
        $stats.total  = $stats.opus + $stats.sonnet + $stats.haiku
        $stats.cost   = ($stats.opus * $RATE_OPUS) + ($stats.sonnet * $RATE_SONNET) + ($stats.haiku * $RATE_HAIKU)

        # Per-phase subtotal — depends on currentPhase, recompute every render
        foreach ($e in $parsed.entries) {
            if ($e.phase -ne $currentPhase) { continue }
            $rate = if ($e.model -eq "opus") { $RATE_OPUS } elseif ($e.model -eq "sonnet") { $RATE_SONNET } else { $RATE_HAIKU }
            $stats.phaseCost += $e.total * $rate
        }
    } catch {}
    return $stats
}

function Get-AgentRoster($maxAgeSec = 21600) {
    $log = Join-Path $PlanningDir "metrics\activity-log.jsonl"
    $roster = [ordered]@{}
    if (-not (Test-Path $log)) { return @() }
    try {
        # Shrunk 300 → 120: agent roster only needs the last ~6h of activity,
        # and 120 lines of log covers that in practice. Halves parse cost.
        $lines = @(Get-CachedTail $log 120)
        if ($lines.Count -eq 0) { return @() }
        $now = Get-Date
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($e.tool -ne "Agent" -and $e.tool -ne "TaskCreate") { continue }
                $t = "$($e.target)".Trim()
                if (-not $t) { continue }
                $ts = $null
                try { $ts = [DateTime]::Parse($e.ts) } catch {}
                if (-not $ts) { continue }
                $age = [int]($now - $ts).TotalSeconds
                if ($age -gt $maxAgeSec) { continue }
                $name = $t
                if ($t -match '^([a-zA-Z][\w-]+)\s*[:\[]') { $name = $matches[1] }
                elseif ($t -match '^([a-zA-Z][\w-]+)') { $name = $matches[1] }
                $key = "$name|$t"
                if (-not $roster.Contains($key) -or $roster[$key].lastTs -lt $ts) {
                    $roster[$key] = @{
                        name   = $name
                        target = $t
                        lastTs = $ts
                        ageSec = $age
                    }
                }
            } catch {}
        }
    } catch {}
    # Widened thresholds so a dispatched agent stays visible as ACTIVE for the
    # full execution window (5m), not just the first minute. The PreToolUse
    # hook fires at dispatch time, not completion time, so a 60s window
    # silently dropped agents that were still working.
    foreach ($entry in $roster.Values) {
        if ($entry.ageSec -lt 300)       { $entry.status = "ACTIVE" }
        elseif ($entry.ageSec -lt 900)   { $entry.status = "IDLE" }
        elseif ($entry.ageSec -lt 3600)  { $entry.status = "RECENT" }
        else                              { $entry.status = "OLDER" }
    }
    return @($roster.Values | Sort-Object { $_.ageSec } | Select-Object -First 6)
}

# ── Inference watchdog (stuck-thinking detector) ────────────────────────────
# Tool hangs are caught by the heartbeat below. Inference hangs are different:
# Claude's status bar says "Inferring..." for 20+ minutes and no tokens arrive.
# The Claude Code session JSONL's mtime advances only when assistant tokens
# land, so a frozen mtime with an active session = stuck inference.

function Get-InferenceState {
    $encoded = Encode-ProjectPath $ProjectDir.TrimEnd([char]92,[char]47)
    $sessionsDir = Join-Path $HOME ".claude\projects\$encoded"
    if (-not (Test-Path $sessionsDir)) { return $null }
    $file = Get-ChildItem -Path $sessionsDir -Filter "*.jsonl" -File -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $file) { return $null }
    $age = [int]([DateTime]::Now - $file.LastWriteTime).TotalSeconds
    $state = "LIVE"
    if     ($age -lt 30)   { $state = "LIVE" }
    elseif ($age -lt 180)  { $state = "SLOW" }
    elseif ($age -lt 600)  { $state = "STUCK" }
    else                   { $state = "DEAD" }
    [pscustomobject]@{ state=$state; ageSec=$age; session=$file.Name }
}

# ── Heartbeat (silent-hang detector) ─────────────────────────────────────────
# Pairs two logs:
#   activity-log.jsonl (PreToolUse)  → last tool START
#   heartbeat.jsonl    (PostToolUse) → last tool END
# If last START is recent and END is older, a tool is in-flight. If START is
# recent and no END has arrived within the hang threshold, we're silently hung.

function Get-Heartbeat {
    $actLog = Join-Path $PlanningDir "metrics\activity-log.jsonl"
    $hbLog  = Join-Path $PlanningDir "metrics\heartbeat.jsonl"

    $lastStart = $null; $lastStartTool = $null; $lastStartTs = $null
    $lastEnd = $null; $lastEndEmpty = $false
    $now = [DateTime]::UtcNow

    if (Test-Path $actLog) {
        $tail = Get-CachedTail $actLog 1
        if ($tail -and $tail -match '"ts":"([^"]+)".*?"tool":"([^"]+)"') {
            $lastStartTs = [DateTime]::Parse($Matches[1]).ToUniversalTime()
            $lastStartTool = $Matches[2]
            $lastStart = [int]($now - $lastStartTs).TotalSeconds
        }
    }
    if (Test-Path $hbLog) {
        $tail = Get-CachedTail $hbLog 1
        if ($tail -and $tail -match '"ts":"([^"]+)"') {
            $endTs = [DateTime]::Parse($Matches[1]).ToUniversalTime()
            $lastEnd = [int]($now - $endTs).TotalSeconds
            if ($tail -match '"empty":true') { $lastEndEmpty = $true }
        }
    }

    # State machine
    $state = "IDLE"
    $inflight = $null
    if ($lastStart -ne $null) {
        if ($lastEnd -eq $null -or $lastStartTs -gt [DateTime]::UtcNow.AddSeconds(-$lastEnd)) {
            # Start is newer than latest end → a tool is running
            $inflight = $lastStart
            if ($lastStart -lt 30)      { $state = "RUNNING" }
            elseif ($lastStart -lt 120) { $state = "SLOW" }
            else                        { $state = "HUNG" }
        } elseif ($lastEndEmpty) {
            $state = "EMPTY_RESULT"
        } else {
            $state = "IDLE"
        }
    }

    [pscustomobject]@{
        state        = $state
        lastStart    = $lastStart
        lastEnd      = $lastEnd
        lastTool     = $lastStartTool
        inflightSec  = $inflight
        lastEndEmpty = $lastEndEmpty
    }
}

# ── Readiness banner ─────────────────────────────────────────────────────────
# Reads .planning/milestones/{id}/MILESTONE-READINESS.md (written by the
# sgsd-milestone-readiness agent). One-line cockpit answer to "can I walk away?"

function Get-ReadinessInfo($milestone) {
    if (-not $milestone) { return $null }
    $path = Join-Path $PlanningDir "milestones\$milestone\MILESTONE-READINESS.md"
    if (-not (Test-Path $path)) { return $null }
    $status = Get-Frontmatter $path "status"
    $eta    = Get-Frontmatter $path "first_stall_eta_min"
    $gen    = Get-Frontmatter $path "generated"
    # Freshness: manifest mtime vs any phase dir mtime under the milestone
    $mt = (Get-Item $path).LastWriteTime
    $stale = $false
    $phasesDir = Join-Path $PlanningDir "phases"
    if (Test-Path $phasesDir) {
        $newest = Get-ChildItem $phasesDir -Directory -ErrorAction SilentlyContinue |
                  Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($newest -and $newest.LastWriteTime -gt $mt) { $stale = $true }
    }
    # Count GO / BLOCKED / WILL sections by counting table rows after each header
    $raw = Get-Content $path -Raw -ErrorAction SilentlyContinue
    $go = 0; $blk = 0; $will = 0
    if ($raw -match '(?s)## GO[^\n]*\n(.*?)(##|\z)')          { $go   = ([regex]::Matches($Matches[1], '(?m)^\|\s+\d')).Count }
    if ($raw -match '(?s)## BLOCKED[^\n]*\n(.*?)(##|\z)')     { $blk  = ([regex]::Matches($Matches[1], '(?m)^###\s')).Count }
    if ($raw -match '(?s)## WILL BLOCK[^\n]*\n(.*?)(##|\z)')  { $will = ([regex]::Matches($Matches[1], '(?m)^\|\s+\w')).Count }
    [pscustomobject]@{ status=$status; eta=$eta; gen=$gen; stale=$stale; go=$go; blk=$blk; will=$will; path=$path }
}

# ── Render functions ─────────────────────────────────────────────────────────

function Write-Row {
    param([string]$text, [string]$color = "Gray")
    $pw = Get-PaneWidth
    if ($text.Length -gt $pw) { $text = $text.Substring(0, [Math]::Max(0, $pw - 1)) }
    Write-Host $text -ForegroundColor $color -NoNewline
    Write-Host $CLEAR_LINE
}

function Write-Header($text) {
    Write-Row ("--- " + $text + " ").PadRight((Get-PaneWidth), '-') "DarkGray"
}

function Render {
    # Throttle: FSWatcher fires for every metrics append, potentially dozens of
    # times per second. Skip any redraw that's less than 2s after the previous
    # one — the heartbeat loop guarantees a full render at least every $Heartbeat
    # seconds regardless, so no signal is ever lost.
    if (-not (Test-RenderDue -MinIntervalMs 2000)) { return }

    # Always use the ANSI cursor-home escape. [Console]::SetCursorPosition no-ops
    # silently in Warp's PTY without throwing, breaking the previous try/catch.
    Write-Host $HOME_POS -NoNewline

    $pw = Get-PaneWidth
    $state = Get-StateInfo
    $phases = Get-RoadmapPhases $state.milestone
    $currentNum = $state.currentPhase
    $activePhase = $phases | Where-Object { $_.num -eq $currentNum } | Select-Object -First 1
    $activeDir = Get-ActivePhaseDir $currentNum
    $waves = Get-Waves $activeDir
    $waves = Get-WaveTimestamps $waves $currentNum
    $activeWaveNum = Get-ActiveWaveFromLog

    # Mark wave statuses
    foreach ($w in $waves) {
        if ($w.completedAt -and ($activeWaveNum -eq $null -or $w.wave -lt $activeWaveNum)) {
            $w.status = "done"
        } elseif ($activeWaveNum -and $w.wave -eq $activeWaveNum) {
            $w.status = "active"
        } else {
            $w.status = "pending"
        }
    }

    # ── Header bar ────────────────────────────────────────────────────────────
    $ts = Get-Date -Format 'HH:mm:ss'
    Write-Host "SUPER GSD" -NoNewline -ForegroundColor Magenta
    Write-Host " * " -NoNewline -ForegroundColor Yellow
    Write-Host "Mission Control" -NoNewline -ForegroundColor White
    Write-Host "  $ts" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    # ── DLB-04 Substrate ──────────────────────────────────────────────────────
    # One-liner: [reg N agents] [sepl Xp/Yc/Zr] [distill Xh/Yq] [g3 median verdict]
    $substrate = Get-SubstrateStatus -ProjectDir $ProjectDir
    $substrateLine = Format-SubstrateStatusLine -Status $substrate
    $substrateColor = if ($substrate.Gate3Verdict -eq "RETIRE") {
        "Red"
    } elseif ($substrate.NoveltyCount -gt 0) {
        "Green"
    } elseif ($substrate.HypothesesCount -gt 0) {
        "Yellow"
    } else {
        "DarkGray"
    }
    Write-Host "DLB-04 " -NoNewline -ForegroundColor Magenta
    Write-Host $substrateLine -NoNewline -ForegroundColor $substrateColor
    Write-Host $CLEAR_LINE

    # Heartbeat — silent-hang detector. RUNNING/SLOW/HUNG/EMPTY_RESULT/IDLE.
    $hb = Get-Heartbeat
    $hbColor = switch ($hb.state) {
        "RUNNING"      { "Green" }
        "SLOW"         { "Yellow" }
        "HUNG"         { "Red" }
        "EMPTY_RESULT" { "Red" }
        "IDLE"         { "DarkGray" }
        default        { "DarkGray" }
    }
    Write-Host "HEARTBEAT" -NoNewline -ForegroundColor White
    Write-Host ": " -NoNewline -ForegroundColor DarkGray
    Write-Host $hb.state -NoNewline -ForegroundColor $hbColor
    if ($hb.lastTool) {
        Write-Host "  last " -NoNewline -ForegroundColor DarkGray
        Write-Host $hb.lastTool -NoNewline -ForegroundColor Cyan
        if ($hb.lastStart -ne $null) {
            Write-Host (" {0}s ago" -f $hb.lastStart) -NoNewline -ForegroundColor DarkGray
        }
    }
    if ($hb.state -eq "HUNG") {
        Write-Host "  ⚠ no completion — check transport" -NoNewline -ForegroundColor Red
        # Bell
        [Console]::Write([char]7)
    } elseif ($hb.state -eq "EMPTY_RESULT") {
        Write-Host "  ⚠ last tool returned empty" -NoNewline -ForegroundColor Red
        [Console]::Write([char]7)
    }
    Write-Host $CLEAR_LINE

    # Inference watchdog — session JSONL mtime freshness
    $inf = Get-InferenceState
    if ($inf) {
        $infColor = switch ($inf.state) {
            "LIVE"  { "Green" }
            "SLOW"  { "Yellow" }
            "STUCK" { "Red" }
            "DEAD"  { "DarkRed" }
            default { "DarkGray" }
        }
        Write-Host "INFERENCE" -NoNewline -ForegroundColor White
        Write-Host ": " -NoNewline -ForegroundColor DarkGray
        Write-Host $inf.state -NoNewline -ForegroundColor $infColor
        $mins = [int]($inf.ageSec / 60); $secs = $inf.ageSec % 60
        $ageStr = if ($mins -gt 0) { "${mins}m ${secs}s" } else { "${secs}s" }
        Write-Host "  jsonl frozen " -NoNewline -ForegroundColor DarkGray
        Write-Host $ageStr -NoNewline -ForegroundColor Cyan
        if ($inf.state -eq "STUCK") {
            Write-Host "  ← Esc + retry recommended" -NoNewline -ForegroundColor Red
            [Console]::Write([char]7)
        } elseif ($inf.state -eq "DEAD") {
            Write-Host "  ← session likely dead" -NoNewline -ForegroundColor DarkRed
            [Console]::Write([char]7)
        }
        Write-Host $CLEAR_LINE
    }

    # Readiness banner — answers "can I walk away?"
    $rd = Get-ReadinessInfo $state.milestone
    if ($rd) {
        $rdColor = switch ($rd.status) { "GO" {"Green"} "PARTIAL" {"Yellow"} "BLOCKED" {"Red"} default {"DarkGray"} }
        $tag = if ($rd.stale) { " (stale)" } else { "" }
        Write-Host "UNATTENDED" -NoNewline -ForegroundColor White
        Write-Host ": " -NoNewline -ForegroundColor DarkGray
        Write-Host $rd.status -NoNewline -ForegroundColor $rdColor
        Write-Host "$tag  " -NoNewline -ForegroundColor DarkGray
        Write-Host ("[GO {0} / BLK {1} / CASCADE {2}]" -f $rd.go, $rd.blk, $rd.will) -NoNewline -ForegroundColor Gray
        if ($rd.eta -and $rd.eta -ne "n/a") {
            Write-Host "  stall@" -NoNewline -ForegroundColor DarkGray
            Write-Host ("{0}m" -f $rd.eta) -NoNewline -ForegroundColor Yellow
        }
        Write-Host $CLEAR_LINE
    } else {
        Write-Host "UNATTENDED" -NoNewline -ForegroundColor White
        Write-Host ": no readiness manifest — run /gsd-readiness" -NoNewline -ForegroundColor DarkYellow
        Write-Host $CLEAR_LINE
    }

    # Checkpoint banner — flash if session is paused
    if (Test-Checkpoint) {
        Write-Host "[PAUSED]" -NoNewline -ForegroundColor Yellow
        Write-Host " checkpoint present - /sgsd-resume" -NoNewline -ForegroundColor DarkYellow
        Write-Host $CLEAR_LINE
    }

    # Session stats: context % + thinking mode + model
    $sess = Get-SessionStats
    if ($sess.contextTokens -gt 0) {
        $pctColor = if ($sess.contextPct -ge 70) { "Red" } elseif ($sess.contextPct -ge 50) { "Yellow" } else { "Green" }
        $modelShort = switch -Regex ($sess.model) {
            'opus'   { "Opus" }
            'sonnet' { "Sonnet" }
            'haiku'  { "Haiku" }
            default  { "?" }
        }
        $ctxK = [math]::Round($sess.contextTokens / 1000)
        $maxK = [math]::Round($sess.contextMax / 1000)
        Write-Host "ctx " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($sess.contextPct)%" -NoNewline -ForegroundColor $pctColor
        Write-Host " (${ctxK}k/${maxK}k) " -NoNewline -ForegroundColor DarkGray
        Write-Host $modelShort -NoNewline -ForegroundColor Cyan
        Write-Host " " -NoNewline
        if ($sess.thinkingOn) {
            Write-Host "think:" -NoNewline -ForegroundColor DarkGray
            Write-Host "ON" -NoNewline -ForegroundColor Magenta
            Write-Host "($($sess.thinkingBlocks))" -NoNewline -ForegroundColor DarkGray
        } else {
            Write-Host "think:" -NoNewline -ForegroundColor DarkGray
            Write-Host "off" -NoNewline -ForegroundColor DarkGray
        }
        Write-Host $CLEAR_LINE

        # Session-wide token + $ aggregate (BACKLOG-001 — total tokens + $ conversion).
        # Walks the FULL current session JSONL so the operator sees total spend this
        # session, not just the per-model milestone totals from (often stale) token-log.jsonl.
        $agg = Get-SessionAggregate
        if ($agg.totalTok -gt 0) {
            $totK = [math]::Round($agg.totalTok / 1000)
            $outK = [math]::Round($agg.outputTok / 1000)
            Write-Host "sess " -NoNewline -ForegroundColor DarkGray
            Write-Host "${totK}k" -NoNewline -ForegroundColor White
            Write-Host " (out " -NoNewline -ForegroundColor DarkGray
            Write-Host "${outK}k" -NoNewline -ForegroundColor Gray
            Write-Host ")  " -NoNewline -ForegroundColor DarkGray
            Write-Host (Format-Dollar $agg.cost) -NoNewline -ForegroundColor Green
            if (($agg.opusTok + $agg.sonnetTok + $agg.haikuTok) -gt 0) {
                Write-Host "  " -NoNewline
                if ($agg.opusTok   -gt 0) { Write-Host "O " -NoNewline -ForegroundColor DarkGray; Write-Host "$([math]::Round($agg.opusTok/1000))k" -NoNewline -ForegroundColor Magenta; Write-Host " " -NoNewline }
                if ($agg.sonnetTok -gt 0) { Write-Host "S " -NoNewline -ForegroundColor DarkGray; Write-Host "$([math]::Round($agg.sonnetTok/1000))k" -NoNewline -ForegroundColor Cyan; Write-Host " " -NoNewline }
                if ($agg.haikuTok  -gt 0) { Write-Host "H " -NoNewline -ForegroundColor DarkGray; Write-Host "$([math]::Round($agg.haikuTok/1000))k" -NoNewline -ForegroundColor White }
            }
            Write-Host $CLEAR_LINE
        }
    }

    # Blockers — red flash if non-empty
    $blockers = Get-StateBlockers
    if ($blockers.Count -gt 0) {
        Write-Host "[BLOCKED] " -NoNewline -ForegroundColor Red
        Write-Host "$($blockers.Count) open" -NoNewline -ForegroundColor Red
        Write-Host $CLEAR_LINE
        $b = $blockers[0]
        $bMax = $pw - 4
        if ($b.Length -gt $bMax) { $b = $b.Substring(0, [Math]::Max(1, $bMax - 2)) + ".." }
        Write-Host "  ! " -NoNewline -ForegroundColor Red
        Write-Host $b -NoNewline -ForegroundColor Yellow
        Write-Host $CLEAR_LINE
    }

    # SGSD-V2 signal tile — orchestrator-pulse + last-gate + token-burn sparkline
    # Added Phase E3/E4 (brief R-Q8d + HCC-P-08 growth-curve). Consumes emits
    # plumbed in Phase D (orchestrator-pulse.jsonl) + existing commit-reviews.jsonl
    # + existing token-log.jsonl.
    $metricsDir = Join-Path $PlanningDir "metrics"
    $pulseFile  = Join-Path $metricsDir "orchestrator-pulse.jsonl"
    $tokenFile  = Join-Path $metricsDir "token-log.jsonl"

    $pulseAgeSec = $null
    if (Test-Path $pulseFile) {
        $pulseAgeSec = [int]((Get-Date) - (Get-Item $pulseFile).LastWriteTime).TotalSeconds
    }
    $pulseColor = if ($null -eq $pulseAgeSec)    { "DarkGray" }
                  elseif ($pulseAgeSec -lt 300)  { "Green" }
                  elseif ($pulseAgeSec -lt 900)  { "Yellow" }
                  else                           { "Red" }

    $lastGate = "--"
    $gateColor = "DarkGray"
    $phasesRoot = Join-Path $PlanningDir "phases"
    if (Test-Path $phasesRoot) {
        $gateFile = Get-ChildItem -Path $phasesRoot -Filter "commit-reviews.jsonl" -Recurse -ErrorAction SilentlyContinue |
                    Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($gateFile) {
            $gateLine = Get-Content $gateFile.FullName -Tail 1 -Encoding UTF8 -ErrorAction SilentlyContinue
            try {
                $g = $gateLine | ConvertFrom-Json
                $lastGate = $g.verdict
                $gateColor = switch ($lastGate) { "pass" {"Green"} "warn" {"Yellow"} default {"Red"} }
            } catch {}
        }
    }

    $v2Sparkline = ""
    if (Test-Path $tokenFile) {
        $v2Tail5 = @(Get-Content $tokenFile -Tail 5 -Encoding UTF8 -ErrorAction SilentlyContinue |
                     ForEach-Object { try { ($_ | ConvertFrom-Json).total } catch { $null } } |
                     Where-Object { $_ -ne $null })
        if ($v2Tail5.Count -ge 2) {
            $v2Max = ($v2Tail5 | Measure-Object -Maximum).Maximum
            if ($v2Max -gt 0) {
                $v2Chars = '.-=+X#&@'
                $v2Sparkline = -join ($v2Tail5 | ForEach-Object {
                    $idx = [Math]::Min([int](($_ / $v2Max) * 7), 7)
                    $v2Chars[$idx]
                })
            }
        }
    }

    Write-Host "SGSD-V2" -NoNewline -ForegroundColor White
    Write-Host ": " -NoNewline -ForegroundColor DarkGray
    Write-Host "pulse " -NoNewline -ForegroundColor DarkGray
    Write-Host (Format-Age $pulseAgeSec) -NoNewline -ForegroundColor $pulseColor
    Write-Host "  gate " -NoNewline -ForegroundColor DarkGray
    Write-Host $lastGate -NoNewline -ForegroundColor $gateColor
    if ($v2Sparkline) {
        Write-Host "  tok " -NoNewline -ForegroundColor DarkGray
        Write-Host $v2Sparkline -NoNewline -ForegroundColor Cyan
    }
    Write-Host $CLEAR_LINE

    $codex = Get-SgsdCodexStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
    Write-Host "CODEX" -NoNewline -ForegroundColor White
    Write-Host ": " -NoNewline -ForegroundColor DarkGray
    Write-Host (Get-SgsdCodexStatusLine -Status $codex) -NoNewline -ForegroundColor $codex.stateColor
    Write-Host $CLEAR_LINE
    Write-Host "      " -NoNewline
    Write-Host "mdl " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($codex.model)" -NoNewline -ForegroundColor Yellow
    Write-Host "  git " -NoNewline -ForegroundColor DarkGray
    Write-Host "$(Get-CodexCommitCount)" -NoNewline -ForegroundColor Magenta
    Write-Host "  runs " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($codex.totalRuns)" -NoNewline -ForegroundColor White
    Write-Host " ok/" -NoNewline -ForegroundColor DarkGray
    Write-Host "$($codex.okRuns)" -NoNewline -ForegroundColor Green
    Write-Host " fail/" -NoNewline -ForegroundColor DarkGray
    Write-Host "$($codex.failedRuns)" -NoNewline -ForegroundColor Red
    if ($codex.claudeTokensSaved -gt 0) {
        Write-Host "  offload " -NoNewline -ForegroundColor DarkGray
        Write-Host "$([math]::Round($codex.claudeTokensSaved/1000))k" -NoNewline -ForegroundColor Cyan
    } else {
        Write-Host "  offload " -NoNewline -ForegroundColor DarkGray
        Write-Host "n/a" -NoNewline -ForegroundColor DarkGray
    }
    if ($codex.totalRuns -gt 0) {
        Write-Host "  io " -NoNewline -ForegroundColor DarkGray
        Write-Host "$($codex.totalPromptBytes)B" -NoNewline -ForegroundColor Gray
        Write-Host "/" -NoNewline -ForegroundColor DarkGray
        Write-Host "$($codex.totalReportBytes)B" -NoNewline -ForegroundColor Gray
    }
    Write-Host $CLEAR_LINE

    # Milestone — 2 lines
    $ms = if ($state.milestone) { $state.milestone } else { "?" }
    $msName = if ($state.milestoneName) { $state.milestoneName } else { "" }
    $total = $phases.Count
    $done  = @($phases | Where-Object { $_.done }).Count
    $pct   = if ($total -gt 0) { [math]::Round(($done / $total) * 100) } else { 0 }
    Write-Host "$ms " -NoNewline -ForegroundColor Yellow
    $shortName = if ($msName.Length -gt ($pw - 16)) { $msName.Substring(0, [Math]::Max(1, $pw - 18)) + ".." } else { $msName }
    Write-Host $shortName -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE
    Write-Host "[" -NoNewline -ForegroundColor DarkGray
    Write-Host (Make-Bar $pct 12) -NoNewline -ForegroundColor Green
    Write-Host "] " -NoNewline -ForegroundColor DarkGray
    Write-Host "$done/$total " -NoNewline -ForegroundColor White
    Write-Host "($pct%)" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    # Phase progression — 3 compact lines (last / current / next)
    $doneList = @($phases | Where-Object { $_.done })
    $lastBuilt = if ($doneList.Count -gt 0) { $doneList[-1] } else { $null }
    $nextPhase = $null
    for ($i = 0; $i -lt $phases.Count; $i++) {
        if ($phases[$i].num -eq $currentNum -and $i -lt ($phases.Count - 1)) {
            $nextPhase = $phases[$i + 1]
            break
        }
    }
    $nameMax = $pw - 10
    if ($lastBuilt) {
        Write-Host "v P$($lastBuilt.num) " -NoNewline -ForegroundColor Green
        $ln = if ($lastBuilt.name.Length -gt $nameMax) { $lastBuilt.name.Substring(0, [Math]::Max(1, $nameMax - 2)) + ".." } else { $lastBuilt.name }
        Write-Host $ln -NoNewline -ForegroundColor Green
        Write-Host $CLEAR_LINE
    }
    if ($activePhase) {
        Write-Host "> P$($activePhase.num) " -NoNewline -ForegroundColor Yellow
        $cn = if ($activePhase.name.Length -gt $nameMax) { $activePhase.name.Substring(0, [Math]::Max(1, $nameMax - 2)) + ".." } else { $activePhase.name }
        Write-Host $cn -NoNewline -ForegroundColor Yellow
        Write-Host $CLEAR_LINE
    } elseif ($currentNum) {
        Write-Host "> P$currentNum (not in roadmap)" -NoNewline -ForegroundColor DarkYellow
        Write-Host $CLEAR_LINE
    }
    if ($nextPhase) {
        Write-Host ". P$($nextPhase.num) " -NoNewline -ForegroundColor Gray
        $nn = if ($nextPhase.name.Length -gt $nameMax) { $nextPhase.name.Substring(0, [Math]::Max(1, $nameMax - 2)) + ".." } else { $nextPhase.name }
        Write-Host $nn -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
    }

    # Wave timeline — compact: last done + active + next 3 + overflow counter
    if ($waves.Count -gt 0) {
        $doneW = @($waves | Where-Object { $_.status -eq "done" }).Count
        $actW  = @($waves | Where-Object { $_.status -eq "active" }).Count
        $pendW = @($waves | Where-Object { $_.status -eq "pending" }).Count

        $allDone = @($waves | Where-Object { $_.status -eq "done" })
        $active  = @($waves | Where-Object { $_.status -eq "active" }) | Select-Object -First 1
        $pending = @($waves | Where-Object { $_.status -eq "pending" })
        $display = @()
        if ($allDone.Count -gt 0) { $display += $allDone[-1] }
        if ($active) { $display += $active }
        $nextThree = @($pending | Select-Object -First 3)
        foreach ($p in $nextThree) { $display += $p }
        $overflow = $pending.Count - $nextThree.Count

        Write-Host "P$currentNum WAVES " -NoNewline -ForegroundColor White
        Write-Host "${doneW}v " -NoNewline -ForegroundColor Green
        Write-Host "${actW}> " -NoNewline -ForegroundColor Yellow
        Write-Host "${pendW}." -NoNewline -ForegroundColor Red
        Write-Host $CLEAR_LINE

        foreach ($w in $display) {
            $marker = switch ($w.status) {
                "done"   { "v" }
                "active" { ">" }
                default  { "." }
            }
            $color = switch ($w.status) {
                "done"   { "Green" }
                "active" { "Yellow" }
                default  { "DarkGray" }
            }
            $tag = "W$($w.wave)"
            $tsStr = switch ($w.status) {
                "done"    { if ($w.completedAt) { $w.completedAt.ToString("HH:mm") } else { "" } }
                "active"  { "now" }
                default   { "" }
            }
            $nameMax = $pw - 13 - $tsStr.Length
            $name = if ($w.name.Length -gt $nameMax) { $w.name.Substring(0, [Math]::Max(1, $nameMax - 2)) + ".." } else { $w.name }
            Write-Host "$marker " -NoNewline -ForegroundColor $color
            Write-Host "$tag " -NoNewline -ForegroundColor $color
            Write-Host $name -NoNewline -ForegroundColor $color
            if ($tsStr) {
                $pad = $nameMax - $name.Length
                if ($pad -gt 0) { Write-Host (" " * $pad) -NoNewline }
                Write-Host " $tsStr" -NoNewline -ForegroundColor DarkGray
            }
            Write-Host $CLEAR_LINE

            # For the ACTIVE wave, drill into task-level detail with tree indent
            if ($w.status -eq "active") {
                $taskInfo = Get-WaveTasks $w $currentNum
                if ($taskInfo.total -gt 0) {
                    Write-Host "  " -NoNewline
                    Write-Host "|- " -NoNewline -ForegroundColor DarkGray
                    Write-Host "$($taskInfo.done)/$($taskInfo.total) tasks" -NoNewline -ForegroundColor Yellow
                    if ($taskInfo.activeTask) {
                        Write-Host " - active: " -NoNewline -ForegroundColor DarkGray
                        $activeLabel = if ($taskInfo.activeTask.num -gt 0) { "T$($taskInfo.activeTask.num)" } else { "dispatched" }
                        Write-Host $activeLabel -NoNewline -ForegroundColor Yellow
                    }
                    Write-Host $CLEAR_LINE

                    # Render per-task dots on one line if it fits: T4v T5v T6> T7. T8.
                    if ($taskInfo.tasks.Count -gt 0 -and $taskInfo.tasks.Count -le 12) {
                        Write-Host "  " -NoNewline
                        Write-Host "|- " -NoNewline -ForegroundColor DarkGray
                        foreach ($t in $taskInfo.tasks) {
                            $tm = switch ($t.status) {
                                "done"   { "v" }
                                "active" { ">" }
                                default  { "." }
                            }
                            $tc = switch ($t.status) {
                                "done"   { "Green" }
                                "active" { "Yellow" }
                                default  { "Red" }
                            }
                            Write-Host "T$($t.num)" -NoNewline -ForegroundColor $tc
                            Write-Host $tm -NoNewline -ForegroundColor $tc
                            Write-Host " " -NoNewline
                        }
                        Write-Host $CLEAR_LINE
                    }
                }
            }
        }

        if ($overflow -gt 0) {
            Write-Host ". " -NoNewline -ForegroundColor Red
            Write-Host "+$overflow more pending" -NoNewline -ForegroundColor Red
            Write-Host $CLEAR_LINE
        }
    }

    # ── Remaining counters ────────────────────────────────────────────────────
    $phasesLeft = @($phases | Where-Object { -not $_.done }).Count
    $wavesLeft = 0
    foreach ($p in $phases) {
        if ($p.done) { continue }
        if ($p.num -eq $currentNum) {
            $wavesLeft += @($waves | Where-Object { $_.status -ne "done" }).Count
        } else {
            $wavesLeft += 4
        }
    }
    Write-Host "left " -NoNewline -ForegroundColor DarkGray
    Write-Host "$phasesLeft phases " -NoNewline -ForegroundColor Red
    Write-Host "$wavesLeft waves" -NoNewline -ForegroundColor Red
    Write-Host $CLEAR_LINE

    # ── Cost box ─────────────────────────────────────────────────────────────
    $tokens = Get-TokenStats
    Write-Host "O " -NoNewline -ForegroundColor DarkGray
    Write-Host (Format-Dollar ($tokens.opus * $RATE_OPUS)) -NoNewline -ForegroundColor Magenta
    Write-Host "  S " -NoNewline -ForegroundColor DarkGray
    Write-Host (Format-Dollar ($tokens.sonnet * $RATE_SONNET)) -NoNewline -ForegroundColor Cyan
    Write-Host "  H " -NoNewline -ForegroundColor DarkGray
    Write-Host (Format-Dollar ($tokens.haiku * $RATE_HAIKU)) -NoNewline -ForegroundColor White
    Write-Host "  = " -NoNewline -ForegroundColor DarkGray
    Write-Host (Format-Dollar $tokens.cost) -NoNewline -ForegroundColor Green
    Write-Host $CLEAR_LINE

    Write-Host "P$currentNum running " -NoNewline -ForegroundColor DarkGray
    Write-Host (Format-Dollar $tokens.phaseCost) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE

    # ── Agents ────────────────────────────────────────────────────────────────
    $roster = Get-AgentRoster
    $roster = @($roster)
    $active  = @($roster | Where-Object { $_.status -eq "ACTIVE" }).Count
    $idle    = @($roster | Where-Object { $_.status -eq "IDLE" }).Count
    $recent  = @($roster | Where-Object { $_.status -eq "RECENT" }).Count
    Write-Host "AGENTS " -NoNewline -ForegroundColor White
    Write-Host "$active act " -NoNewline -ForegroundColor Green
    Write-Host "$idle idle " -NoNewline -ForegroundColor Yellow
    Write-Host "$recent recent" -NoNewline -ForegroundColor Cyan
    Write-Host $CLEAR_LINE
    if ($roster.Count -eq 0) {
        Write-Host "(none)$CLEAR_LINE" -ForegroundColor DarkGray
    } else {
        $showCount = [Math]::Min(3, $roster.Count)
        for ($i = 0; $i -lt $showCount; $i++) {
            $ag = $roster[$i]
            $sc = switch ($ag.status) {
                "ACTIVE" { "Green" }
                "IDLE"   { "Yellow" }
                "RECENT" { "Cyan" }
                default  { "DarkGray" }
            }
            $nm = $ag.name
            if ($nm.Length -gt 12) { $nm = $nm.Substring(0, 11) + "." }
            $detail = $ag.target
            if ($detail -match '^[a-zA-Z][\w-]+\s*[:\[]\s*(.*)$') { $detail = $matches[1] }
            $ageStr = Format-Age $ag.ageSec
            $detailMax = $pw - 12 - 4 - 4
            if ($detail.Length -gt $detailMax) { $detail = $detail.Substring(0, [Math]::Max(1, $detailMax - 2)) + ".." }
            Write-Host $nm.PadRight(12) -NoNewline -ForegroundColor Magenta
            Write-Host " $($ageStr.PadLeft(3)) " -NoNewline -ForegroundColor $sc
            Write-Host $detail -NoNewline -ForegroundColor Gray
            Write-Host $CLEAR_LINE
        }
    }

    # Recent commits — last 3 one-liners
    $commits = Get-RecentCommits
    if ($commits.Count -gt 0) {
        Write-Host "COMMITS" -NoNewline -ForegroundColor White
        Write-Host $CLEAR_LINE
        foreach ($c in $commits) {
            $subj = $c.subject
            $subjMax = $pw - 10
            if ($subj.Length -gt $subjMax) { $subj = $subj.Substring(0, [Math]::Max(1, $subjMax - 2)) + ".." }
            Write-Host $c.hash -NoNewline -ForegroundColor Cyan
            Write-Host " " -NoNewline
            Write-Host $subj -NoNewline -ForegroundColor Gray
            Write-Host $CLEAR_LINE
        }
    }

    # Clear anything left over below content
    Write-Host $CLEAR_BELOW -NoNewline
}

# ── File watcher + main loop ─────────────────────────────────────────────────
# Enter alt screen buffer so redraws never pollute Warp scrollback.
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

# Restore main buffer on Ctrl+C / pane close.
[Console]::TreatControlCAsInput = $false
try {
    while ($true) {
        if ($global:needsRedraw -or (((Get-Date) - $lastHeartbeat).TotalSeconds -ge $Heartbeat)) {
            $global:needsRedraw = $false
            $lastHeartbeat = Get-Date
            Render
        }
        # Sleep longer than the render throttle so we don't burn CPU spinning.
        # Heartbeat + FSWatcher set $needsRedraw; Test-RenderDue inside Render
        # is the actual min-interval enforcer.
        Start-Sleep -Milliseconds 2000
    }
} finally {
    Write-Host "$SHOW_CURSOR$ALT_EXIT" -NoNewline
}
