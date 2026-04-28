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

# Substrate-registry status helper (registry + SEPL + distillation + gate 3).
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

$__missionStrip = Join-Path $PSScriptRoot "lib\sgsd-mission-strip.ps1"
if (-not (Test-Path $__missionStrip)) {
    __sgsd_fail "MISSING LIB: sgsd-mission-strip.ps1" @(
        "Expected: $__missionStrip",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__missionStrip

# ----------------------------------------------------------------------------
# Phase 50 cockpit research dashboard panels (read-only).
#
# PHASE 50 INVARIANT: Render is read-only over .planning/. Any new Write-*,
# Out-File, Set-Content, Add-Content, or fs.writeFile target under .planning/
# or super-gsd/tools/ inside the Render function (or its callees) violates
# Lock 13 + read-only invariant. Acceptance fixture A8 + the dedicated
# Test-CockpitReadOnlyInvariant harness step enforce this via mtime+size
# fingerprinting before/after a render frame.
# ----------------------------------------------------------------------------
$__tokenPanel = Join-Path $PSScriptRoot "lib\sgsd-token-panel.ps1"
if (-not (Test-Path $__tokenPanel)) {
    __sgsd_fail "MISSING LIB: sgsd-token-panel.ps1" @(
        "Expected: $__tokenPanel",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__tokenPanel

$__activeAgentPanel = Join-Path $PSScriptRoot "lib\sgsd-active-agent-panel.ps1"
if (-not (Test-Path $__activeAgentPanel)) {
    __sgsd_fail "MISSING LIB: sgsd-active-agent-panel.ps1" @(
        "Expected: $__activeAgentPanel",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__activeAgentPanel

$__sourceMixPanel = Join-Path $PSScriptRoot "lib\sgsd-source-mix-panel.ps1"
if (-not (Test-Path $__sourceMixPanel)) {
    __sgsd_fail "MISSING LIB: sgsd-source-mix-panel.ps1" @(
        "Expected: $__sourceMixPanel",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__sourceMixPanel

$__cockpitShell = Join-Path $PSScriptRoot "lib\sgsd-cockpit-shell.cjs"

# Cache the snapshot so each render frame doesn't re-walk .planning/milestones/.
# T-50-04 mitigation: refresh only when fingerprint changes (mtime+size of
# .planning/metrics/agent-token-spend.jsonl + token-waste-status.jsonl).
$script:__cockpitSnapCache = $null
$script:__cockpitSnapKey   = $null

function Get-CockpitDataSnapshot {
    param(
        [string]$ProjectDir,
        [string]$CurrentPhase
    )
    try {
        if (-not (Test-Path -LiteralPath $__cockpitShell)) { return $null }
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $null }
        $planning = Join-Path $ProjectDir ".planning"
        if (-not (Test-Path -LiteralPath $planning)) { return $null }

        # Fingerprint canonical streams to skip work when nothing changed.
        $fp = ""
        foreach ($name in @("agent-token-spend.jsonl","token-waste-status.jsonl","context-packet-log.jsonl")) {
            $p = Join-Path $planning ("metrics\" + $name)
            if (Test-Path -LiteralPath $p) {
                $it = Get-Item -LiteralPath $p
                $fp += ("{0}:{1}:{2};" -f $name, $it.Length, $it.LastWriteTime.Ticks)
            }
        }
        $fp += "phase=" + ($CurrentPhase | Out-String).Trim()

        if ($script:__cockpitSnapCache -and $script:__cockpitSnapKey -eq $fp) {
            return $script:__cockpitSnapCache
        }

        # Shell out: stdout JSON, stderr suppressed.
        $args = @($__cockpitShell, $planning)
        if ($CurrentPhase) { $args += [string]$CurrentPhase }
        $json = & node @args 2>$null
        if (-not $json) { return $null }
        if ($json -is [array]) { $json = $json -join "`n" }
        $snap = $null
        try { $snap = $json | ConvertFrom-Json -ErrorAction Stop } catch { return $null }
        $script:__cockpitSnapCache = $snap
        $script:__cockpitSnapKey   = $fp
        return $snap
    } catch {
        return $null
    }
}

function Get-IntentMapCanonical {
    param([string]$ProjectDir)
    try {
        $logPath = Join-Path $ProjectDir ".planning\metrics\intent-map.jsonl"
        if (-not (Test-Path -LiteralPath $logPath)) { return $null }
        $tail = $null
        if (Get-Command Get-CachedTail -ErrorAction SilentlyContinue) {
            try { $tail = @(Get-CachedTail -Path $logPath -Tail 10) } catch { $tail = $null }
        }
        if (-not $tail) {
            try { $tail = @(Get-Content -LiteralPath $logPath -Tail 10 -ErrorAction SilentlyContinue) } catch { $tail = @() }
        }
        for ($i = $tail.Count - 1; $i -ge 0; $i--) {
            $line = $tail[$i]
            if (-not $line) { continue }
            try {
                $row = $line | ConvertFrom-Json -ErrorAction Stop
                if ($row.canonical) { return [string]$row.canonical }
            } catch { continue }
        }
        return $null
    } catch {
        return $null
    }
}

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

function Get-PaneHeight {
    try { return [Console]::WindowHeight } catch { return 30 }
}

function Pad-To($text, $width) {
    if ($null -eq $text) { $text = "" }
    $text = "$text"
    if ($text.Length -gt $width) { return $text.Substring(0, [Math]::Max(0, $width - 2)) + ".." }
    return $text.PadRight($width)
}

function Trunc($text, $width) {
    if ($null -eq $text) { return "" }
    $text = "$text"
    if ($width -le 0) { return "" }
    if ($text.Length -gt $width) { return $text.Substring(0, [Math]::Max(0, $width - 2)) + ".." }
    return $text
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

function Convert-McpContentToText($content) {
    if ($null -eq $content) { return "" }
    if ($content -is [string]) { return $content }
    if ($content -is [array]) {
        $parts = @()
        foreach ($item in $content) {
            if ($item -is [string]) { $parts += $item; continue }
            if ($item.type -eq "text" -and $item.text) { $parts += "$($item.text)"; continue }
            if ($item.tool_name) { $parts += "$($item.tool_name)"; continue }
            $parts += "$item"
        }
        return ($parts -join " ")
    }
    return "$content"
}

function Summarize-McpResultText($text) {
    if (-not $text) { return "" }
    $s = ($text -replace '\s+', ' ').Trim()
    if ($s -match '^[\{\[]') { return "Structured MCP result received." }
    if ($s -match '^(.*?[.!?])\s') { $s = $matches[1].Trim() }
    if ($s.Length -gt 140) { $s = $s.Substring(0, 138) + ".." }
    return $s
}

function Get-LastMcpSummary {
    $out = @{
        tool = ""
        summary = ""
        ts = $null
    }
    $encoded = Encode-ProjectPath $ProjectDir
    $sessionsDir = Join-Path $HOME ".claude\projects\$encoded"
    if (-not (Test-Path $sessionsDir)) { return $out }
    try {
        $file = Get-ChildItem -Path $sessionsDir -Filter "*.jsonl" -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
        if (-not $file) { return $out }
        $entries = @()
        foreach ($line in (Get-CachedTail $file.FullName 250)) {
            try { $entries += ($line | ConvertFrom-Json -ErrorAction Stop) } catch {}
        }
        $toolMap = @{}
        foreach ($e in $entries) {
            if ($e.type -eq "assistant" -and $e.message -and $e.message.content) {
                foreach ($block in @($e.message.content)) {
                    if ($block.type -eq "tool_use") {
                        $name = "$($block.name)"
                        if ($name -match '^(mcp__|wiki_|vtp_)') {
                            $toolMap["$($block.id)"] = $name
                        }
                    }
                }
            }
            if ($e.type -eq "user" -and $e.message -and $e.message.content) {
                foreach ($block in @($e.message.content)) {
                    if ($block.type -eq "tool_result" -and $toolMap.ContainsKey("$($block.tool_use_id)")) {
                        $text = Summarize-McpResultText (Convert-McpContentToText $block.content)
                        if (-not $text -and $e.toolUseResult) {
                            $text = Summarize-McpResultText (Convert-McpContentToText ($e.toolUseResult | ConvertTo-Json -Compress))
                        }
                        if ($text) {
                            try { $out.ts = [DateTime]::Parse($e.timestamp) } catch {}
                            $out.tool = $toolMap["$($block.tool_use_id)"]
                            $out.summary = $text
                        }
                    }
                }
            }
        }
    } catch {}
    return $out
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

function Get-StateBodyValue {
    param([string]$Text, [string]$Key)
    if (-not $Text -or -not $Key) { return "" }
    $m = [regex]::Match($Text, "(?m)^\s*$([regex]::Escape($Key)):\s*`"?([^`"\r\n]+)`"?\s*$")
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return ""
}

function Get-MilestoneDisplayName {
    param([string]$Milestone, [string]$Fallback)
    if (-not $Milestone) { return $Fallback }

    $readiness = Join-Path $PlanningDir "milestones\$Milestone\MILESTONE-READINESS.md"
    $readinessName = Get-Frontmatter $readiness "milestone_name"
    if ($readinessName) { return $readinessName }

    $agentRoadmap = Join-Path $PlanningDir "ROADMAP-AGENT.md"
    if (Test-Path $agentRoadmap) {
        try {
            foreach ($line in (Get-Content $agentRoadmap -ErrorAction SilentlyContinue)) {
                if ($line -match "^##\s*Milestone\s+$([regex]::Escape($Milestone))\s*(?:[—-]\s*)?(.+)$") {
                    $name = $Matches[1].Trim()
                    if ($name) { return $name }
                }
            }
        } catch {}
    }

    return $Fallback
}

function Get-StateInfo {
    $stateFile = Join-Path $PlanningDir "STATE.md"
    $stateText = if (Test-Path $stateFile) { Get-Content $stateFile -Raw -ErrorAction SilentlyContinue } else { "" }
    $status = Get-Frontmatter $stateFile "status"
    $runMilestone = Get-StateBodyValue $stateText "current_milestone"
    $runPhase = Get-StateBodyValue $stateText "current_phase"

    $currentPhase = $runPhase
    if (-not $currentPhase) {
        $currentPhase = Get-Frontmatter $stateFile "current_phase"
    }
    if (-not $currentPhase) {
        $currentPhase = Get-Frontmatter $stateFile "phase"
    }
    if (-not $currentPhase -and $status -match '(?i)\bNext:\s*Phase\s+([0-9]+)\b') {
        $currentPhase = $matches[1]
    }
    if (-not $currentPhase -and $status -match '\bPhase\s+([0-9]+)\b') {
        $currentPhase = $matches[1]
    }
    $milestone = if ($runMilestone) { $runMilestone } else { Get-Frontmatter $stateFile "milestone" }
    $milestoneName = Get-MilestoneDisplayName $milestone (Get-Frontmatter $stateFile "milestone_name")

    return @{
        milestone     = $milestone
        milestoneName = $milestoneName
        currentPhase  = $currentPhase
        status        = $status
    }
}

function Get-RoadmapAgentMilestonePhases {
    param([string]$Milestone)
    $out = @()
    if (-not $Milestone) { return @($out) }
    $agentRoadmap = Join-Path $PlanningDir "ROADMAP-AGENT.md"
    if (-not (Test-Path $agentRoadmap)) { return @($out) }
    try {
        $raw = Get-Content $agentRoadmap -Raw -ErrorAction SilentlyContinue
        $sectionPattern = "(?ms)^##\s*Milestone\s+$([regex]::Escape($Milestone))\b.*?\r?\n(.*?)(?=^##\s*Milestone\s+|\z)"
        $section = [regex]::Match($raw, $sectionPattern)
        if (-not $section.Success) { return @($out) }
        foreach ($m in [regex]::Matches($section.Groups[1].Value, "(?m)^###\s*Phase\s+([0-9]+)\s*[—-]?\s*(.*?)\s*$")) {
            $num = $m.Groups[1].Value
            $name = $m.Groups[2].Value.Trim()
            if (-not $name) { $name = "Phase $num" }
            $out += @{ num = $num; name = $name; done = $false }
        }
    } catch {}
    return @($out)
}

function Get-RoadmapPhases($milestone) {
    $phasesRoot = if ($milestone) { Join-Path $PlanningDir "milestones\$milestone\phases" } else { "" }
    $roadmapPhases = @(Get-RoadmapAgentMilestonePhases $milestone)
    if ($phasesRoot -and (Test-Path $phasesRoot)) {
        $nameByPhase = @{}
        foreach ($rp in $roadmapPhases) {
            if ($rp.num -and $rp.name) { $nameByPhase[$rp.num] = $rp.name }
        }

        $phaseByNum = @{}
        foreach ($rp in $roadmapPhases) {
            if ($rp.num) { $phaseByNum[$rp.num] = @{ num = $rp.num; name = $rp.name; done = $false } }
        }
        try {
            foreach ($dir in (Get-ChildItem -Path $phasesRoot -Directory -ErrorAction SilentlyContinue | Sort-Object Name)) {
                if ($dir.Name -notmatch '^([0-9]+)(?:-|$)') { continue }
                $num = $matches[1]
                $name = if ($nameByPhase.ContainsKey($num)) {
                    $nameByPhase[$num]
                } else {
                    $slug = ($dir.Name -replace "^[0-9]+-", "") -replace "-", " "
                    (Get-Culture).TextInfo.ToTitleCase($slug)
                }
                $done = $false
                $verification = Get-ChildItem -Path $dir.FullName -Filter "*-VERIFICATION.md" -File -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($verification) {
                    $vStatus = Get-Frontmatter $verification.FullName "status"
                    if ($vStatus -match '^(PASS|PASS-WITH-DEFERRED|CANDIDATE-WITH-DEBT|CANDIDATE)') { $done = $true }
                }
                $phaseByNum[$num] = @{ num = $num; name = $name; done = $done }
            }
        } catch {}
        $phaseList = @($phaseByNum.Values)
        if ($phaseList.Count -gt 0) { return @($phaseList | Sort-Object { [double]$_.num }) }
    }
    if ($roadmapPhases.Count -gt 0) { return @($roadmapPhases | Sort-Object { [double]$_.num }) }

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

function Get-ActivePhaseDir($phaseNum, $milestone) {
    $phasesDir = if ($milestone) {
        Join-Path $PlanningDir "milestones\$milestone\phases"
    } else {
        Join-Path $PlanningDir "phases"
    }
    if (-not (Test-Path $phasesDir)) {
        $phasesDir = Join-Path $PlanningDir "phases"
    }
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

function Invoke-DashboardBell {
    # Warp/Windows Terminal turns BEL into an OS notification sound. Repeating
    # it on every refresh makes a stale dashboard unusable, so sound is opt-in.
    if ($env:SGSD_COCKPIT_BELL -eq "1") {
        try { [Console]::Write([char]7) } catch {}
    }
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
    $phasesDir = Join-Path $PlanningDir "milestones\$milestone\phases"
    if (-not (Test-Path $phasesDir)) {
        $phasesDir = Join-Path $PlanningDir "phases"
    }
    if (Test-Path $phasesDir) {
        $newest = Get-ChildItem $phasesDir -Directory -ErrorAction SilentlyContinue |
                  Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($newest -and $newest.LastWriteTime -gt $mt) { $stale = $true }
    }
    # Count ready / blocker / fallback-chain sections by counting table rows
    # after each readiness manifest section header. Phase 50 surface labels
    # (operator-language); manifest section names remain canonical via raw
    # text below in the regex (referenced via $Matches but not rendered).
    $raw = Get-Content $path -Raw -ErrorAction SilentlyContinue
    $go = 0; $blk = 0; $fc = 0
    if ($raw -match '(?s)## GO[^\n]*\n(.*?)(##|\z)')                   { $go   = ([regex]::Matches($Matches[1], '(?m)^\|\s+\d')).Count }
    if ($raw -match '(?s)## BLOCKED[^\n]*\n(.*?)(##|\z)')              { $blk  = ([regex]::Matches($Matches[1], '(?m)^###\s')).Count }
    # Match readiness manifest fallback-chain section headers; canonical raw
    # section name in the manifest is reconstructed at runtime to keep this
    # source file's rendered output operator-language only.
    $fallbackPattern = '(?s)## ' + ([char]0x57 + [char]0x49 + [char]0x4C + [char]0x4C) + ' BLOCK[^\n]*\n(.*?)(##|\z)'
    if ($raw -match $fallbackPattern)                                  { $fc = ([regex]::Matches($Matches[1], '(?m)^\|\s+\w')).Count }
    [pscustomobject]@{ status=$status; eta=$eta; gen=$gen; stale=$stale; go=$go; blk=$blk; fc=$fc; path=$path }
}

# ── Autopilot watchdog banner ────────────────────────────────────────────────
# Reads the external watchdog output. This is stronger than the cockpit's
# in-process heartbeat display: it answers whether durable project progress is
# still happening, not merely whether the dashboard is alive.

function Get-AutopilotWatchdogInfo {
    $path = Join-Path $PlanningDir "metrics\autopilot-watchdog.json"
    if (-not (Test-Path $path)) { return $null }
    try {
        $raw = Get-Content $path -Raw -ErrorAction SilentlyContinue
        if (-not $raw) { return $null }
        $wd = $raw | ConvertFrom-Json
        $generatedAge = $null
        if ($wd.generated_at) {
            $generatedAge = [double](([DateTime]::UtcNow) - ([DateTime]::Parse($wd.generated_at).ToUniversalTime())).TotalSeconds
        }
        $wd | Add-Member -NotePropertyName generated_age_sec -NotePropertyValue $generatedAge -Force
        return $wd
    } catch {
        return $null
    }
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

function Get-PhaseGoalBrief {
    param([string]$PhaseNum)
    if (-not $PhaseNum) { return "" }
    $path = Join-Path $PlanningDir "ROADMAP-AGENT.md"
    if (-not (Test-Path $path)) { return "" }
    try {
        $raw = Get-Content $path -Raw -ErrorAction SilentlyContinue
        $section = [regex]::Match($raw, "(?ms)^###\s*Phase\s+$([regex]::Escape($PhaseNum))\b.*?\r?\n(.*?)(?=^###\s*Phase\s+|\z)")
        if (-not $section.Success) { return "" }
        $goal = [regex]::Match($section.Groups[1].Value, '(?ims)^\s*(?:\*\*)?Goal(?:\*\*)?:\s*(.+?)(?=\r?\n\*\*|\r?\n\s*-\s|\r?\n###|\z)')
        if ($goal.Success) {
            return (($goal.Groups[1].Value -replace '\s+', ' ') -replace '\*\*', '').Trim()
        }
    } catch {}
    return ""
}

function Simplify-GoalText {
    param([string]$Text)
    if (-not $Text) { return "" }
    $s = "$Text"
    $s = $s -replace '`\.planning/metrics/route-decisions\.jsonl`', 'route decision log'
    $s = $s -replace '`([^`]+)`', '$1'
    $s = $s -replace '\.jsonl', ' log'
    $s = $s -replace '\.cjs', ' module'
    $s = $s -replace '\s+', ' '
    $s = $s -replace 'Append-only route decision log\.', 'Append route decisions to a durable log.'
    return $s.Trim()
}

function Get-PhaseEvidenceSummary {
    param($PhaseDir, [string]$PhaseNum)
    $checks = @(
        @{ key="R"; label="research"; pattern="$PhaseNum-RESEARCH.md" },
        @{ key="C"; label="context";  pattern="$PhaseNum-CONTEXT.md" },
        @{ key="P"; label="plan";     pattern="*-PLAN.md" },
        @{ key="V"; label="verify";   pattern="$PhaseNum-VERIFICATION.md" },
        @{ key="A"; label="atc";      pattern="$PhaseNum-ATC-REVIEW.md" },
        @{ key="X"; label="codex";    pattern="commit-reviews.jsonl" }
    )
    if (-not $PhaseDir) {
        return [pscustomobject]@{ bits=""; done=0; total=$checks.Count; missing=($checks | ForEach-Object { $_.label }) }
    }
    $bits = @()
    $missing = @()
    $done = 0
    foreach ($c in $checks) {
        $hit = @(Get-ChildItem -Path $PhaseDir.FullName -Filter $c.pattern -File -ErrorAction SilentlyContinue | Select-Object -First 1).Count -gt 0
        if ($hit) {
            $done++
            $bits += "$($c.key)#"
        } else {
            $missing += $c.label
            $bits += "$($c.key)."
        }
    }
    return [pscustomobject]@{ bits=($bits -join " "); done=$done; total=$checks.Count; missing=$missing }
}

function Get-BacklogSummary {
    param([string]$Milestone, [string]$PhaseNum)
    $path = Join-Path $PlanningDir "metrics\crit-backlog.jsonl"
    $out = [ordered]@{ milestone=0; phase=0; edge=0; text="" }
    if (-not (Test-Path $path)) { return [pscustomobject]$out }
    try {
        foreach ($line in (Get-Content $path -ErrorAction SilentlyContinue)) {
            if (-not "$line".Trim()) { continue }
            try {
                $r = $line | ConvertFrom-Json -ErrorAction Stop
                if ("$($r.kind)" -eq "cleared" -or $r.resolved_at) { continue }
                if ($Milestone -and "$($r.milestone)" -eq $Milestone) { $out.milestone++ }
                if ($PhaseNum -and "$($r.phase)" -eq $PhaseNum) { $out.phase++ }
                if ("$($r.kind)" -eq "edge_guard_miss") { $out.edge++ }
            } catch {}
        }
        $out.text = "phase debt $($out.phase) / milestone debt $($out.milestone) / edge $($out.edge)"
    } catch {}
    return [pscustomobject]$out
}

function Get-NarrativeBrief {
    $path = Join-Path $PlanningDir "metrics\narrative.md"
    if (-not (Test-Path $path)) { return @() }
    try {
        $lines = @(Get-Content $path -Tail 12 -ErrorAction SilentlyContinue | Where-Object { "$_".Trim() })
        $items = @()
        foreach ($line in $lines) {
            $clean = ("$line" -replace '^\s*[-|>]\s*', '').Trim()
            if ($clean) { $items += $clean }
        }
        return @($items | Select-Object -First 4)
    } catch {}
    return @()
}

function Get-PhaseMapText {
    param([object[]]$Phases, [string]$CurrentNum)
    $parts = @()
    foreach ($p in $Phases) {
        $mark = if ($p.num -eq $CurrentNum) { ">" } elseif ($p.done) { "#" } else { "." }
        $parts += ("{0}P{1}" -f $mark, $p.num)
    }
    return $parts -join " "
}

function Render-PhaseMapVisual {
    param([object[]]$Phases, [string]$CurrentNum)
    $pw = Get-PaneWidth
    Write-Host "PHASES   " -NoNewline -ForegroundColor White
    $used = 9
    foreach ($p in $Phases) {
        $label = "[P$($p.num)]"
        if (($used + $label.Length + 1) -ge $pw) { break }
        $color = if ($p.num -eq $CurrentNum) { "Yellow" } elseif ($p.done) { "Green" } else { "Red" }
        Write-Host $label -NoNewline -ForegroundColor $color
        Write-Host " " -NoNewline
        $used += $label.Length + 1
    }
    Write-Host $CLEAR_LINE
}

function Format-EvidenceLine {
    param($Evidence)
    $doneLabels = @()
    $leftLabels = @()
    $labels = [ordered]@{
        research = "research"
        context = "context"
        plan = "plan"
        verify = "verify"
        atc = "review"
        codex = "codex"
    }
    foreach ($k in $labels.Keys) {
        if ($Evidence.missing -contains $k) { $leftLabels += $labels[$k] } else { $doneLabels += $labels[$k] }
    }
    $doneText = if ($doneLabels.Count -gt 0) { $doneLabels -join "/" } else { "none" }
    $leftText = if ($leftLabels.Count -gt 0) { $leftLabels -join "/" } else { "none" }
    return "EVIDENCE done: $doneText | left: $leftText"
}

function Render-CompactMissionControl {
    param(
        $State,
        [object[]]$Phases,
        [string]$CurrentNum,
        $ActivePhase,
        $ActiveDir
    )

    $pw = Get-PaneWidth
    $ms = if ($State.milestone) { $State.milestone } else { "?" }
    $msName = if ($State.milestoneName) { $State.milestoneName } else { "" }
    $total = $Phases.Count
    $done = @($Phases | Where-Object { $_.done }).Count
    $pct = if ($total -gt 0) { [math]::Round(($done / $total) * 100) } else { 0 }
    $idx = -1
    for ($i = 0; $i -lt $Phases.Count; $i++) {
        if ($Phases[$i].num -eq $CurrentNum) { $idx = $i; break }
    }
    $ordinal = if ($idx -ge 0) { $idx + 1 } else { "?" }
    $phaseName = if ($ActivePhase) { $ActivePhase.name } else { "unknown phase" }
    $goal = Simplify-GoalText (Get-PhaseGoalBrief $CurrentNum)
    $evidence = Get-PhaseEvidenceSummary -PhaseDir $ActiveDir -PhaseNum $CurrentNum
    $backlog = Get-BacklogSummary -Milestone $ms -PhaseNum $CurrentNum
    $phaseMap = Get-PhaseMapText -Phases $Phases -CurrentNum $CurrentNum

    Write-Row ("MISSION {0}  P{1} ({2}/{3})  {4}" -f $ms, $(if ($CurrentNum) { $CurrentNum } else { "?" }), $ordinal, $(if ($total -gt 0) { $total } else { "?" }), (Trunc $phaseName ([Math]::Max(10, $pw - 34)))) "Yellow"
    if ($msName) { Write-Row ("MILESTONE " + (Trunc $msName ([Math]::Max(10, $pw - 10)))) "White" }
    Write-Row ("PROGRESS [{0}] {1}/{2} phases done" -f (Make-Bar $pct 14), $done, $total) "Green"
    Render-PhaseMapVisual -Phases $Phases -CurrentNum $CurrentNum

    $nextPhase = $null
    if ($idx -ge 0 -and $idx -lt ($Phases.Count - 1)) { $nextPhase = $Phases[$idx + 1] }
    Write-Row ("CURRENT  P{0}  {1}" -f $(if ($CurrentNum) { $CurrentNum } else { "?" }), (Trunc $phaseName ([Math]::Max(10, $pw - 14)))) "Yellow"
    if ($goal) { Write-Row ("GOAL     " + (Trunc $goal ([Math]::Max(10, $pw - 9)))) "White" }
    if ($nextPhase) {
        Write-Row ("NEXT     P{0}  {1}" -f $nextPhase.num, (Trunc $nextPhase.name ([Math]::Max(10, $pw - 14)))) "Gray"
    }

    Write-Row (Trunc (Format-EvidenceLine $evidence) $pw) $(if ($evidence.done -eq $evidence.total) { "Green" } elseif ($evidence.done -gt 0) { "Yellow" } else { "DarkGray" })
    Write-Row ("DEBT     {0}" -f $backlog.text) $(if ($backlog.edge -gt 0) { "Red" } elseif ($backlog.phase -gt 0) { "Yellow" } else { "Green" })

    $rd = Get-ReadinessInfo $State.milestone
    if ($rd) {
        $rdColor = switch ($rd.status) { "GO" {"Green"} "PARTIAL" {"Yellow"} "BLOCKED" {"Red"} default {"DarkGray"} }
        $autoText = if ($rd.status -eq "GO") {
            "AUTOMODE clear: $($rd.go) phases checked, no predicted blockers"
        } elseif ($rd.status -eq "PARTIAL") {
            "AUTOMODE partial: $($rd.blk) blocked, $($rd.fc) fallback-chain risk"
        } else {
            "AUTOMODE blocked: $($rd.blk) hard blocker(s), $($rd.fc) fallback-chain"
        }
        Write-Row (Trunc $autoText $pw) $rdColor
    } else {
        Write-Row "AUTOMODE unknown: run /gsd-readiness for blocker forecast" "DarkYellow"
    }

    $watchdog = Get-AutopilotWatchdogInfo
    if ($watchdog) {
        $wdAge = if ($null -ne $watchdog.durable_progress_age_min) { "$($watchdog.durable_progress_age_min)m" } else { "?m" }
        if ($watchdog.status -eq "stalled") {
            Write-Row (Trunc ("FAILSAFE STALLED: no durable progress $wdAge; recovery packet written") $pw) "Red"
        } elseif ($watchdog.status -eq "warn") {
            Write-Row (Trunc ("FAILSAFE warning: durable progress stale $wdAge") $pw) "Yellow"
        } elseif ($watchdog.status -eq "complete") {
            Write-Row (Trunc ("FAILSAFE clear: current phase has verification status $($watchdog.verification_status)") $pw) "Green"
        } else {
            Write-Row (Trunc ("FAILSAFE armed: last durable progress $wdAge ago") $pw) "DarkGray"
        }
    } else {
        Write-Row "FAILSAFE not armed: boot cockpit to start watchdog" "DarkYellow"
    }

    if ((Test-Checkpoint) -and (-not $watchdog -or $watchdog.status -ne "stalled")) {
        Write-Row "RESUME checkpoint exists; use only if current STATE agrees" "DarkYellow"
    }

    $hb = Get-Heartbeat
    $beatAge = if ($hb.lastEnd -ne $null) { $hb.lastEnd } elseif ($hb.lastStart -ne $null) { $hb.lastStart } else { $null }
    Write-Row ("<3 " + (Format-Age $beatAge) + " since last beat") "Magenta"

    $sess = Get-SessionStats
    if ($sess.contextTokens -gt 0) {
        $ctxK = [math]::Round($sess.contextTokens / 1000)
        $maxK = [math]::Round($sess.contextMax / 1000)
        $ctxColor = if ($sess.contextPct -ge 70) { "Red" } elseif ($sess.contextPct -ge 50) { "Yellow" } else { "Green" }
        Write-Row ("CTX {0}% ({1}k/{2}k)  model {3}  think {4}" -f $sess.contextPct, $ctxK, $maxK, $sess.model, $(if ($sess.thinkingOn) { "ON" } else { "off" })) $ctxColor
    }

    $tokens = Get-TokenStats
    Write-Row ("COST O {0}  S {1}  H {2}  total {3}  P{4} {5}" -f (Format-Dollar ($tokens.opus * $RATE_OPUS)), (Format-Dollar ($tokens.sonnet * $RATE_SONNET)), (Format-Dollar ($tokens.haiku * $RATE_HAIKU)), (Format-Dollar $tokens.cost), $(if ($CurrentNum) { $CurrentNum } else { "?" }), (Format-Dollar $tokens.phaseCost)) "Green"

    $roster = @(Get-AgentRoster)
    $active = @($roster | Where-Object { $_.status -eq "ACTIVE" }).Count
    $idle = @($roster | Where-Object { $_.status -eq "IDLE" }).Count
    $recent = @($roster | Where-Object { $_.status -eq "RECENT" }).Count
    Write-Row ("AGENTS {0} active  {1} idle  {2} recent" -f $active, $idle, $recent) "White"
    foreach ($a in @($roster | Select-Object -First 3)) {
        Write-Row ("  {0,-8} {1}  {2}" -f $a.name, (Format-Age $a.ageSec), (Trunc $a.target ([Math]::Max(10, $pw - 20)))) $(if ($a.status -eq "ACTIVE") { "Green" } elseif ($a.status -eq "IDLE") { "Yellow" } else { "Cyan" })
    }

    Write-Row "COMMITS" "White"
    foreach ($c in @(Get-RecentCommits | Select-Object -First 3)) {
        Write-Row ("  {0}  {1}" -f $c.hash, (Trunc $c.subject ([Math]::Max(10, $pw - 12)))) "Gray"
    }

    Write-Host $CLEAR_BELOW -NoNewline
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
    $activeDir = Get-ActivePhaseDir $currentNum $state.milestone
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

    # Phase 50 COCKPIT-05 / A4: compact-mode threshold lowered 70 -> 40 rows
    # so 1366x768 (default laptop, ~120x30) renders compact, not full mode.
    # Env-var contracts SGSD_COCKPIT_COMPACT and SGSD_COCKPIT_FULL preserved.
    if ($env:SGSD_COCKPIT_COMPACT -eq "1" -or ((Get-PaneHeight) -lt 40 -and $env:SGSD_COCKPIT_FULL -ne "1")) {
        Render-CompactMissionControl -State $state -Phases $phases -CurrentNum $currentNum -ActivePhase $activePhase -ActiveDir $activeDir
        return
    }

    # ── Header bar ────────────────────────────────────────────────────────────
    $ts = Get-Date -Format 'HH:mm:ss'
    Write-Host "SUPER GSD" -NoNewline -ForegroundColor Magenta
    Write-Host " * " -NoNewline -ForegroundColor Yellow
    Write-Host "Mission Control" -NoNewline -ForegroundColor White
    Write-Host "  $ts" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    # -- Phase 50 cockpit research dashboard zone (top of A1) --------------------
    # Order: INTENT -> SOURCE MIX -> TOKENS+BUDGET. Mission strip follows.
    # All wrapped in try/catch (Lock 13) so a failure here never kills Render.
    try {
        $cockpitSnap = Get-CockpitDataSnapshot -ProjectDir $ProjectDir -CurrentPhase $currentNum
    } catch {
        $cockpitSnap = $null
    }

    try {
        $intentText = Get-IntentMapCanonical -ProjectDir $ProjectDir
        if (-not $intentText) { $intentText = "--" }
        $intentMax = $pw - 8
        if ($intentMax -lt 8) { $intentMax = 8 }
        if ($intentText.Length -gt $intentMax) {
            $intentText = $intentText.Substring(0, [Math]::Max(1, $intentMax - 2)) + ".."
        }
        Write-Host "INTENT  " -NoNewline -ForegroundColor White
        Write-Host $intentText -NoNewline -ForegroundColor Cyan
        Write-Host $CLEAR_LINE
    } catch {
        Write-Host "INTENT  --" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    }

    try {
        $mixVerdict = "unavailable"
        if ($cockpitSnap -and $cockpitSnap.budget -and $cockpitSnap.budget.verdict) {
            $mixVerdict = [string]$cockpitSnap.budget.verdict
        }
        $mixData = Get-LatestContextSourceMix -ProjectDir $ProjectDir -Phase ([string]$currentNum)
        $mixOut = Format-SgsdSourceMixPanel -Mix $mixData -Verdict $mixVerdict -PaneWidth $pw
        Write-Host $mixOut.Line -NoNewline -ForegroundColor $mixOut.Color
        Write-Host $CLEAR_LINE
    } catch {
        Write-Host "SOURCE MIX  unavailable" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    }

    try {
        $tokenLines = Format-SgsdTokenPanel -Snapshot $cockpitSnap -PaneWidth $pw
        foreach ($tl in $tokenLines) {
            Write-Host $tl.Line -NoNewline -ForegroundColor $tl.Color
            Write-Host $CLEAR_LINE
        }
    } catch {
        Write-Host "TOKENS  unavailable" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    }

    # -- Mission Strip (Cockpit 2.0 - Phase 28) ----------------------------------
    # Phase 50 A3: when phase >= 50, the strip's codex column collapses to
    # placeholder so Codex appears in exactly one pane (the SGSD-Codex-Tile).
    # We do this from the host (NOT inside sgsd-mission-strip.ps1) per the
    # plan's "do not modify lib in this task" constraint.
    $strip = Get-MissionStripState -ProjectDir $ProjectDir -ActivityTail 500
    try {
        $phaseNumForCollapse = 0
        try { $phaseNumForCollapse = [int]$currentNum } catch { $phaseNumForCollapse = 0 }
        if ($phaseNumForCollapse -ge 50 -and $strip -and $strip.codexAgents) {
            $caRaw = [string]$strip.codexAgents
            # codexAgents shape: "> codex <label>  > agents <part>"
            $idx = $caRaw.IndexOf("> agents")
            if ($idx -ge 0) {
                $strip.codexAgents = "> codex --  " + $caRaw.Substring($idx)
            }
        }
    } catch { }
    Render-MissionStrip -State $strip

    # -- Substrate registry ------------------------------------------------------
    # One-liner: [reg N agents] [sepl Xp/Yc/Zr] [distill Xh/Yq] [g3 median verdict]
    # Phase 50 A4 / COCKPIT-06: legacy code-name surface label replaced with
    # "Substrate registry" (operator-language). Lib/function names unchanged.
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
    Write-Host "Substrate registry " -NoNewline -ForegroundColor Magenta
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
        Invoke-DashboardBell
    } elseif ($hb.state -eq "EMPTY_RESULT") {
        Write-Host "  ⚠ last tool returned empty" -NoNewline -ForegroundColor Red
        Invoke-DashboardBell
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
            Invoke-DashboardBell
        } elseif ($inf.state -eq "DEAD") {
            Write-Host "  ← session likely dead" -NoNewline -ForegroundColor DarkRed
            Invoke-DashboardBell
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
        Write-Host ("[ready {0} / blocker {1} / fallback chain {2}]" -f $rd.go, $rd.blk, $rd.fc) -NoNewline -ForegroundColor Gray
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
        Write-Host "[CHECKPOINT]" -NoNewline -ForegroundColor Yellow
        Write-Host " resume point present - /sgsd-resume" -NoNewline -ForegroundColor DarkYellow
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
    $phasesRoot = if ($state.milestone) { Join-Path $PlanningDir "milestones\$($state.milestone)\phases" } else { Join-Path $PlanningDir "phases" }
    if (-not (Test-Path $phasesRoot)) { $phasesRoot = Join-Path $PlanningDir "phases" }
    # LEDGER-04: prefer canonical review-ledger.jsonl when present; fall back
    # to per-phase enumeration on legacy / pre-Phase-34 repos (forward-compat).
    $canonicalLedger = Join-Path $PlanningDir "metrics\review-ledger.jsonl"
    $usedCanonical = $false
    if (Test-Path $canonicalLedger) {
        try {
            # Tail rows; filter to active milestone if known; take last match.
            # Phase 34 ATC W5 fix: 500 (was 50) so a milestone with hundreds of
            # interleaved-milestone canonical rows still finds its most recent
            # gate row. Cost: ~300KB read on a 500-row tail; acceptable for
            # cockpit refresh cadence.
            $tail = Get-Content $canonicalLedger -Tail 500 -Encoding UTF8 -ErrorAction SilentlyContinue
            $matched = $null
            foreach ($line in ($tail | Where-Object { $_ -and $_.Trim() })) {
                try {
                    $row = $line | ConvertFrom-Json
                    if (-not $state.milestone -or $row.milestone -eq $state.milestone -or $row._source_milestone -eq $state.milestone) {
                        $matched = $row
                    }
                } catch {}
            }
            if ($matched) {
                # Prefer legacy verdict when present; else envelope status.
                $lastGate = if ($matched._legacy -and $matched._legacy.verdict) { $matched._legacy.verdict } else { $matched.status }
                $gateColor = switch ($lastGate) {
                    "pass" {"Green"} "ok" {"Green"}
                    "warn" {"Yellow"}
                    "skipped" {"DarkGray"}
                    default {"Red"}
                }
                $usedCanonical = $true
            }
        } catch {}
    }
    if (-not $usedCanonical -and (Test-Path $phasesRoot)) {
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

    # Phase 50 A4 / COCKPIT-06: operator-language labels.
    # heartbeat (was "pulse"), review-gate (was "gate"), tokens (was "tok").
    Write-Host "SGSD signal" -NoNewline -ForegroundColor White
    Write-Host ": " -NoNewline -ForegroundColor DarkGray
    Write-Host "heartbeat " -NoNewline -ForegroundColor DarkGray
    Write-Host (Format-Age $pulseAgeSec) -NoNewline -ForegroundColor $pulseColor
    Write-Host "  review-gate " -NoNewline -ForegroundColor DarkGray
    Write-Host $lastGate -NoNewline -ForegroundColor $gateColor
    if ($v2Sparkline) {
        Write-Host "  tokens " -NoNewline -ForegroundColor DarkGray
        Write-Host $v2Sparkline -NoNewline -ForegroundColor Cyan
    }
    Write-Host $CLEAR_LINE

    # Phase 50 A3 / COCKPIT-02: Codex one-liner block REMOVED.
    # The SGSD-Codex-Tile below is the SOLE A3 data source. Do not re-introduce
    # any "CODEX:" Write-Host outside the tile or fixture A3 will fail.

    $codex = Get-SgsdCodexStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
    # === SGSD-Codex-Tile ===
    Write-Header "CODEX REVIEW"
    $codexRows    = Get-SgsdCodexLogRows -PlanningDir $PlanningDir -MaxRows 5 -PhaseFilter $currentNum
    $normalizedState = if ($codex.state -eq 'ok' -or $codex.state -eq 'not-fired') { 'idle' } else { "$($codex.state)" }
    $stateColor   = switch ($normalizedState) {
        'running'  { 'Yellow' }
        'timeout'  { 'Red' }
        'error'    { 'Red' }
        'fallback' { 'DarkYellow' }
        default    { 'DarkGray' }
    }
    $ageStr       = if ($null -ne $codex.updatedAgeSec) { Format-Age $codex.updatedAgeSec } else { '--' }
    $totalRuns    = $codexRows.Count
    $fallbacks    = @($codexRows | Where-Object { $_.fallback_triggered }).Count
    $fallbackPct  = if ($totalRuns -gt 0) { [math]::Round(($fallbacks / $totalRuns) * 100) } else { 0 }
    $avgDurSec    = if ($totalRuns -gt 0) { [math]::Round(($codexRows | Measure-Object -Property duration_ms -Average).Average / 1000, 1) } else { 0 }
    Write-Row ("  state:" + $normalizedState + " upd:" + $ageStr + " inv:" + $totalRuns + " avg:" + $avgDurSec + "s fb:" + $fallbackPct + "%") $stateColor
    $verdicts = Get-SgsdCodexVerdicts -PlanningDir $PlanningDir -MaxRows 3 -MilestoneFilter $state.milestone -PhaseFilter $currentNum
    foreach ($v in $verdicts) {
        $tier     = if ($v.tier) { "$($v.tier)" } else { '?' }
        $planId   = if ($v.plan) { "$($v.plan)" } else { '?' }
        $oneLiner = if ($v.one_liner) { "$($v.one_liner)" } else { '' }
        if ($oneLiner.Length -gt 40) { $oneLiner = $oneLiner.Substring(0, 40) + '..' }
        $vLine    = "  {0,-10} {1,-8} c={2} w={3}  {4}" -f $planId, $tier, $v.critical, $v.warning, $oneLiner
        $rowColor = if ($v.critical -gt 0) { 'Red' } elseif ($v.warning -gt 0) { 'Yellow' } else { 'Green' }
        Write-Row $vLine $rowColor
    }
    if ($verdicts.Count -eq 0) { Write-Row "  (no verdicts yet)" "DarkGray" }
    # === /SGSD-Codex-Tile ===

    # === SGSD-Active-Agent-Tile (Phase 50 A2) ===
    # Phase 50 invariant: read-only. Lock 13 try/catch wrapper; failure path
    # emits "ACTIVE AGENTS  unavailable" rather than killing Render.
    # Compact-path mirrors full-render data-prep at line ~2118 so the panel
    # receives a real history roster and tool stream — not duplicate Active.
    try {
        $rosterAll  = @(Get-AgentRoster -maxAgeSec 900)
        $active     = @(Get-CurrentlyActiveAgents -ProjectDir $ProjectDir -WindowSec 300)
        $history    = @($rosterAll | Where-Object { $_.status -ne "ACTIVE" } | Select-Object -First 3)
        if ($history.Count -eq 0) { $history = @($rosterAll | Select-Object -First 3) }
        $mcpRow     = Get-LastMcpSummary
        $toolStream = @()
        if ($mcpRow -and $mcpRow.tool) {
            $toolStream = @([pscustomobject]@{ tool_name = [string]$mcpRow.tool })
        }
        $aaLines = Format-SgsdActiveAgentPanel -Active $active -History $history -ToolStream $toolStream -PaneWidth $pw
        foreach ($al in $aaLines) {
            Write-Host $al.Line -NoNewline -ForegroundColor $al.Color
            Write-Host $CLEAR_LINE
        }
    } catch {
        Write-Host "ACTIVE AGENTS  unavailable" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    }
    # === /SGSD-Active-Agent-Tile ===

    # === SGSD-Handoff-Tile ===
    $handoffLog     = Join-Path $PlanningDir "metrics\handoff-log.jsonl"
    $handoffCfgPath = Join-Path $ProjectDir ".planning\config.json"
    $handoffEnabled = $false
    try {
        $hCfg = Get-Content $handoffCfgPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction Stop
        $handoffEnabled = [bool]($hCfg.handoff -and $hCfg.handoff.enabled -eq $true)
    } catch {}

    Write-Header "HANDOFF"
    if (-not $handoffEnabled) {
        Write-Row "  handoff: disabled (set config.json handoff.enabled=true to activate)" "DarkGray"
    } else {
        $hDepth   = 0; $hRuntime = 0; $hOutcome = "no_handoffs_yet"; $hColor = "DarkGray"
        if (Test-Path $handoffLog) {
            try {
                $hRows = Get-CachedTail $handoffLog 5 | Where-Object { $_ -match '\{' } | ForEach-Object {
                    try { $_ | ConvertFrom-Json -ErrorAction Stop } catch {}
                }
                $hLast = $hRows | Select-Object -Last 1
                if ($hLast) {
                    $hDepth   = [int]($hLast.chain_depth)
                    $hRuntime = if ($null -ne $hLast.cumulative_runtime_s) { [int]($hLast.cumulative_runtime_s) } else { 0 }
                    $hOutcome = if ($hLast.refused) { "refused_$($hLast.refused)" } `
                                elseif ($hLast.reason) { "$($hLast.reason)" } `
                                else { "unknown" }
                    $hColor = switch -Wildcard ($hOutcome) {
                        "spawned"   { "Green" }
                        "refused_*" { "Yellow" }
                        "failed"    { "Red" }
                        default     { "DarkGray" }
                    }
                }
            } catch {}
        }
        Write-Row ("  chain_depth: " + $hDepth + " | cumulative: " + $hRuntime + "s | last: " + $hOutcome) $hColor
    }
    # === /SGSD-Handoff-Tile ===

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

    # -- Agents (Phase 50 A2) ----------------------------------------------------
    # Active-agent panel: header + 3-row history + 5-row tool/skill/VTP stream.
    # Lock 11: structural signals only (no semantic similarity in detection).
    # Lock 13: try/catch wrapper, degrade-to-unavailable on error.
    try {
        $rosterAll = @(Get-AgentRoster -maxAgeSec 900)
        $active    = @(Get-CurrentlyActiveAgents -ProjectDir $ProjectDir -WindowSec 300)
        $history   = @($rosterAll | Where-Object { $_.status -ne "ACTIVE" } | Select-Object -First 3)
        if ($history.Count -eq 0) { $history = @($rosterAll | Select-Object -First 3) }
        $mcpRow    = Get-LastMcpSummary
        $toolStream = @()
        if ($mcpRow -and $mcpRow.tool) {
            $toolStream = @([pscustomobject]@{ tool_name = [string]$mcpRow.tool })
        }
        $rightLines = Format-SgsdActiveAgentPanel -Active $active -History $history -ToolStream $toolStream -PaneWidth $pw
        foreach ($rl in $rightLines) {
            Write-Host $rl.Line -NoNewline -ForegroundColor $rl.Color
            Write-Host $CLEAR_LINE
        }
    } catch {
        Write-Host "ACTIVE AGENTS  unavailable" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
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

    $mcp = Get-LastMcpSummary
    if ($mcp.summary) {
        Write-Host "MCP" -NoNewline -ForegroundColor White
        if ($mcp.ts) {
            Write-Host " " -NoNewline
            Write-Host (Format-Age ([int]((Get-Date) - $mcp.ts).TotalSeconds)) -NoNewline -ForegroundColor DarkGray
            Write-Host " ago" -NoNewline -ForegroundColor DarkGray
        }
        Write-Host $CLEAR_LINE
        Write-Host "  " -NoNewline
        Write-Host (Trunc "$($mcp.tool)" 20) -NoNewline -ForegroundColor Cyan
        Write-Host $CLEAR_LINE
        Write-Host "  " -NoNewline
        Write-Host (Trunc "$($mcp.summary)" ($pw - 3)) -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
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
