# sgsd-tab-watcher.ps1
# Per-tab background watcher that rewrites the Warp tab title every
# IntervalSeconds with current SGSD state (milestone + phase + verdict glyph)
# plus role-specific suffixes. Sets the title via OSC 0 escape sequence so
# Warp picks it up; runs forever as a background ThreadJob inside the launch-
# config tab, sharing stdout with the foreground process.
#
# Usage:
#   sgsd-tab-watcher.ps1 -Role <role> [-IntervalSeconds 120] [-ProjectDir <path>] [-Once]
#
# Roles:
#   claude codex cockpit review debug post-mortem remote-monitor token-audit
#
# Designed per .planning/milestones/warp-integration/PHASE-BRIEF-tab-watcher.md.

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('claude','codex','cockpit','review','debug','post-mortem','remote-monitor','token-audit')]
    [string]$Role,

    [int]$IntervalSeconds = 120,

    [string]$ProjectDir = (Get-Location).Path,

    [switch]$Once  # single-tick mode for testability + smoke checks
)

# Force UTF-8 output so emoji + box-drawing chars survive the OSC write.
# Without this, PS 5.1's default Windows-1252 console encoding mojibakes them.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Clamp interval to brief's 60..600 bound. <60s thrashes; >600s defeats the
# whole point of "live" updates.
if ($IntervalSeconds -lt 60)  { $IntervalSeconds = 60 }
if ($IntervalSeconds -gt 600) { $IntervalSeconds = 600 }

# Resolve project dir; fall back to current location if invalid.
try { $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path } catch {}

function Read-StateInfo {
    param([string]$Dir)

    $info = [pscustomobject]@{
        milestone = ''
        phase     = ''
        verdict   = ''
        isPaused  = $false
    }

    $statePath = Join-Path $Dir '.planning\STATE.md'
    if (Test-Path $statePath) {
        try {
            foreach ($line in (Get-Content $statePath -TotalCount 30 -ErrorAction SilentlyContinue)) {
                if (-not $info.milestone -and $line -match '^milestone:\s*(.+)$') {
                    $info.milestone = $matches[1].Trim().Trim('"', "'")
                }
                if (-not $info.phase -and $line -match '^(?:current_phase|phase):\s*"?([0-9]+)"?') {
                    $info.phase = $matches[1]
                }
                if (-not $info.phase -and $line -match '^status:.*\bPhase\s+([0-9]+)\b') {
                    $info.phase = $matches[1]
                }
                if (-not $info.verdict -and $line -match '\b(PASS|FAIL|WARN|RUNNING|BLOCKED)\b') {
                    $info.verdict = $matches[1]
                }
            }
        } catch {}
    }

    $checkpointPath = Join-Path $Dir '.planning\ORCHESTRATOR-CHECKPOINT.md'
    if (Test-Path $checkpointPath) { $info.isPaused = $true }

    return $info
}

function Get-Branch {
    param([string]$Dir)
    try {
        $branch = & git -C $Dir rev-parse --abbrev-ref HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $branch -and $branch.Trim() -ne 'HEAD') {
            return $branch.Trim()
        }
        $sha = & git -C $Dir rev-parse --short HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $sha) { return $sha.Trim() }
    } catch {}
    return ''
}

function Format-StateGlyph {
    param($State)
    if ($State.isPaused) { return '⏸' }
    switch -Regex ($State.verdict) {
        '^PASS$'    { return '✓' }
        '^FAIL$'    { return '✗' }
        '^WARN$'    { return '⚠' }
        '^BLOCKED$' { return '⏷' }
        '^RUNNING$' { return '●' }
        default     { return '●' }
    }
}

function Compose-TabTitle {
    param(
        [string]$Role,
        $State,
        [string]$Branch
    )

    $milestone = if ($State.milestone) { $State.milestone } else { '?' }
    $phase     = if ($State.phase)     { 'P' + $State.phase } else { '' }
    $glyph     = Format-StateGlyph $State
    $branchTrim = if ($Branch.Length -gt 14) { $Branch.Substring(0, 12) + '..' } else { $Branch }

    switch ($Role) {
        'claude'         { return "🤖 Claude · $milestone $phase $glyph".Trim() }
        'codex'          { return "🧪 Codex · $milestone $phase $glyph".Trim() }
        'cockpit'        { return "📊 Cockpit · $milestone $phase".Trim() }
        'review'         { return "🔍 Review · $branchTrim".Trim() }
        'debug'          { return "🔧 Debug · $milestone $phase $glyph".Trim() }
        'post-mortem'    { return "📋 Post-Mortem · $branchTrim".Trim() }
        'remote-monitor' { return "🛰 Remote · $milestone $phase".Trim() }
        'token-audit'    { return "💰 Tokens · $milestone".Trim() }
        default          { return "SGSD · $milestone $phase".Trim() }
    }
}

function Set-WarpTabTitle {
    param([string]$Title)
    # OSC 0: ESC ] 0 ; <text> BEL — sets window/icon title together.
    # Warp picks this up as the tab label.
    [Console]::Write([char]27 + ']0;' + $Title + [char]7)
}

# ── Main loop ───────────────────────────────────────────────────────────────
$lastTitle = ''
do {
    try {
        $state  = Read-StateInfo -Dir $ProjectDir
        $branch = Get-Branch     -Dir $ProjectDir
        $title  = Compose-TabTitle -Role $Role -State $state -Branch $branch
        if ($title -ne $lastTitle) {
            Set-WarpTabTitle -Title $title
            $lastTitle = $title
        }
    } catch {
        # Watcher failures are silent — never disrupt the foreground tab.
    }

    if ($Once) { break }
    Start-Sleep -Seconds $IntervalSeconds
} while ($true)
