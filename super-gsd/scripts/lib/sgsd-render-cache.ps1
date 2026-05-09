# ============================================================================
# Super GSD · Dashboard render cache library
# ============================================================================
# Shared caching + throttle helpers for sgsd-mission-control, sgsd-narrative,
# sgsd-gate-verdict. Dot-source at the top of each dashboard:
#
#     . (Join-Path $PSScriptRoot "lib\sgsd-render-cache.ps1")
#
# Each dashboard dot-sources this into its own script scope, so the caches
# below (`$script:_*`) are per-process — no cross-contamination.
#
# What the caches buy you:
#   * Test-RenderDue  → coalesces FSWatcher bursts into one redraw per window.
#   * Invoke-CachedGit → every `git log` becomes free until HEAD moves.
#   * Get-ActiveClaudeSessions → stops re-statting 300+ session JSONLs / tick.
#   * Get-SharedActivityEntries → activity-log.jsonl parses once per render
#     even when six parsers each want to scan it.
# ============================================================================

# ── Redraw throttle ─────────────────────────────────────────────────────────
# FSWatcher on .planning/ fires for every metrics append, so a single Agent
# dispatch can trip `$global:needsRedraw` ten times in a second. Without this
# guard the Render loop does the full ~80 ms work burst for each trip.
# Default to a calmer 5s paint cadence because line-by-line terminal redraws are
# visually noisy in Warp/Windows Terminal. Operators can opt back into the old
# 2s cadence with SGSD_COCKPIT_FAST=1, or set SGSD_COCKPIT_MIN_REFRESH_MS to a
# specific 1000..60000 ms value.
$script:_lastRenderAt = [DateTime]::MinValue

function Get-SgsdRenderMinIntervalMs {
    param([int]$RequestedMs = 2000)

    $effective = $RequestedMs
    $raw = $env:SGSD_COCKPIT_MIN_REFRESH_MS
    if ($raw) {
        $parsed = 0
        if ([int]::TryParse($raw, [ref]$parsed)) {
            if ($parsed -lt 1000)  { $parsed = 1000 }
            if ($parsed -gt 60000) { $parsed = 60000 }
            return $parsed
        }
    }

    if ($env:SGSD_COCKPIT_LOW_MOTION -eq "1" -and $effective -lt 8000) {
        return 8000
    }

    if ($env:SGSD_COCKPIT_FAST -ne "1" -and $effective -lt 5000) {
        return 5000
    }

    return $effective
}

function Test-RenderDue {
    param([int]$MinIntervalMs = 2000)
    $MinIntervalMs = Get-SgsdRenderMinIntervalMs -RequestedMs $MinIntervalMs
    $now = [DateTime]::UtcNow
    $sinceMs = ($now - $script:_lastRenderAt).TotalMilliseconds
    if ($sinceMs -lt $MinIntervalMs) { return $false }
    $script:_lastRenderAt = $now
    return $true
}

# ── Git HEAD-sha-keyed cache ─────────────────────────────────────────────────
# Every `git log` shell-out is ~50–100 ms on Windows. The dashboards were doing
# 3–20 of them per render. None of the results change until HEAD moves, so we
# cache the full stdout array, keyed on `<sha>|<arg-signature>`.
$script:_gitHeadSha    = $null
$script:_gitHeadSeenAt = [DateTime]::MinValue
$script:_gitCache      = @{}

function Get-GitHeadSha {
    param([string]$Dir)
    # Re-probe every 5s max — cheap, and lets us catch commits that land
    # mid-session without invalidating the cache on every render.
    if ($script:_gitHeadSha -and
        ([DateTime]::UtcNow - $script:_gitHeadSeenAt).TotalSeconds -lt 5) {
        return $script:_gitHeadSha
    }
    Push-Location $Dir -ErrorAction SilentlyContinue
    try {
        $sha = & git rev-parse HEAD 2>$null
        if ($sha) {
            $trim = "$sha".Trim()
            if ($trim -ne $script:_gitHeadSha) {
                # HEAD moved → invalidate whole cache
                $script:_gitCache = @{}
            }
            $script:_gitHeadSha = $trim
            $script:_gitHeadSeenAt = [DateTime]::UtcNow
        }
    } catch {}
    Pop-Location -ErrorAction SilentlyContinue
    return $script:_gitHeadSha
}

function Invoke-CachedGit {
    # Returns an array of stdout lines from `git @Args`, cached until HEAD moves.
    # $Key lets the caller distinguish same-arg invocations by meaning
    # (e.g. "waves-ts" vs "timeline-commits").
    param(
        [string]$Dir,
        [string]$Key,
        [string[]]$GitArgs
    )
    $sha = Get-GitHeadSha $Dir
    if (-not $sha) { $sha = "nohead" }
    $cacheKey = "$sha|$Key"
    if ($script:_gitCache.ContainsKey($cacheKey)) {
        return $script:_gitCache[$cacheKey]
    }
    Push-Location $Dir -ErrorAction SilentlyContinue
    $out = @()
    try {
        $out = @(& git @GitArgs 2>$null)
    } catch {}
    Pop-Location -ErrorAction SilentlyContinue
    $script:_gitCache[$cacheKey] = $out
    return $out
}

# ── Activity-log single-pass cache ───────────────────────────────────────────
# activity-log.jsonl gets scanned by Get-WaveTasks, Get-ActiveWaveFromLog,
# Get-AgentRoster, Get-PhaseElapsed, Get-PhaseTimeline, and the Haiku snippet
# builder. Each ConvertFrom-Json pass over ~400 lines is ~30 ms in PS 5.1.
# Parse once per (path, mtime, length) and hand out a pre-parsed array.
$script:_actLogKey     = $null
$script:_actLogEntries = @()

function Get-SharedActivityEntries {
    param(
        [string]$Path,
        [int]$Tail = 400
    )
    if (-not (Test-Path $Path)) { return @() }
    try {
        $item = Get-Item $Path -ErrorAction Stop
        $key = "$Path|$($item.LastWriteTimeUtc.Ticks)|$($item.Length)|$Tail"
        if ($key -eq $script:_actLogKey) { return $script:_actLogEntries }
        $lines = @(Get-Content $Path -Tail $Tail -ErrorAction SilentlyContinue)
        $entries = New-Object System.Collections.ArrayList
        foreach ($line in $lines) {
            try { [void]$entries.Add(($line | ConvertFrom-Json -ErrorAction Stop)) } catch {}
        }
        $script:_actLogKey     = $key
        $script:_actLogEntries = @($entries)
        return $script:_actLogEntries
    } catch { return @() }
}

# ── Active Claude session JSONL cache ────────────────────────────────────────
# ~/.claude/projects/<encoded>/ typically holds hundreds of session JSONLs.
# Only the top 1–3 by mtime matter. Sorting the full dir every tick is pure
# waste — the active file changes rarely. Re-scan on a 30 s wall-clock, or
# when the cached file disappears.
$script:_activeSessionFiles     = $null
$script:_activeSessionCheckedAt = [DateTime]::MinValue

function Get-ActiveClaudeSessions {
    param(
        [string]$SessionsDir,
        [int]$Top = 3,
        [int]$RecheckSec = 30
    )
    if (-not (Test-Path $SessionsDir)) { return @() }

    $cacheAgeSec = ([DateTime]::UtcNow - $script:_activeSessionCheckedAt).TotalSeconds
    if ($script:_activeSessionFiles -and $cacheAgeSec -lt $RecheckSec) {
        $stillExist = $true
        foreach ($f in $script:_activeSessionFiles) {
            if (-not (Test-Path $f.FullName)) { $stillExist = $false; break }
        }
        if ($stillExist) {
            # Refresh file stats on the cached handles without re-listing the dir
            $refreshed = @()
            foreach ($f in $script:_activeSessionFiles) {
                $fresh = Get-Item $f.FullName -ErrorAction SilentlyContinue
                if ($fresh) { $refreshed += $fresh }
            }
            return @($refreshed)
        }
    }

    try {
        $files = Get-ChildItem -Path $SessionsDir -Filter "*.jsonl" -File -ErrorAction SilentlyContinue |
                 Sort-Object LastWriteTime -Descending |
                 Select-Object -First $Top
        $script:_activeSessionFiles     = @($files)
        $script:_activeSessionCheckedAt = [DateTime]::UtcNow
        return $script:_activeSessionFiles
    } catch { return @() }
}

# Explicit busting hook — call from an FSWatcher Created-event handler when a
# new .jsonl appears in the sessions dir, so we don't wait the full 30 s to
# notice a brand-new session.
function Reset-ActiveClaudeSessionsCache {
    $script:_activeSessionFiles     = $null
    $script:_activeSessionCheckedAt = [DateTime]::MinValue
}
