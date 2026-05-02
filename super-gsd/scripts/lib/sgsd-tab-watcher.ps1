# sgsd-tab-watcher.ps1
# Multi-repo tab title watcher. Updates the Warp tab title every IntervalSeconds
# with current SGSD state for the project this tab is operating on. Detects the
# project automatically by walking up from the current working directory to find
# a `.planning/` directory, then reads STATE.md + git for the title content.
#
# Designed for the multi-repo case: operator has multiple Warp tabs across
# different projects (or worktrees of the same project), and each tab needs to
# advertise its own repo + milestone + phase via the title. Repo name is the
# primary disambiguator; branch is included when it isn't master/main.
#
# Title shape (per role):
#   claude          🤖 {repo}/{branch?} · {milestone} {phase} {glyph}
#   codex           🧪 {repo}/{branch?} · {milestone} {phase} {glyph}
#   cockpit         📊 {repo} · {milestone} {phase}
#   review          🔍 {repo}/{branch}
#   debug           🔧 {repo} · {milestone} {phase} {glyph}
#   post-mortem     📋 {repo}/{branch}
#   remote-monitor  🛰 {repo} · {milestone} {phase}
#   token-audit     💰 {repo} · {milestone}
#
# State glyph: ✓ PASS · ✗ FAIL · ⚠ WARN · ⏷ BLOCKED · ⏸ paused (checkpoint
# present) · ● running/default
#
# Usage (from any Warp tab — typically via the sgsd-watch alias in
# sgsd-profile-extensions.ps1):
#   sgsd-tab-watcher.ps1                         # Role=claude, cwd-detected
#   sgsd-tab-watcher.ps1 -Role codex             # explicit role
#   sgsd-tab-watcher.ps1 -ProjectDir <abs-path>  # override auto-detection
#   sgsd-tab-watcher.ps1 -Once                   # single-tick mode (testing)

param(
    [ValidateSet('claude','codex','cockpit','review','debug','post-mortem','remote-monitor','token-audit')]
    [string]$Role = 'claude',

    [int]$IntervalSeconds = 120,

    # When unset, we walk up from the caller's cwd to find a `.planning/` dir.
    # The first ancestor with `.planning/` is treated as the project root.
    [string]$ProjectDir = '',

    [switch]$Once
)

# Force UTF-8 so emoji + glyph characters survive the OSC 0 write to Warp.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Clamp interval to keep the watcher polite. <60s thrashes; >600s defeats the
# point of "live" updates.
if ($IntervalSeconds -lt 60)  { $IntervalSeconds = 60 }
if ($IntervalSeconds -gt 600) { $IntervalSeconds = 600 }

function Find-PlanningRoot {
    # Walk up from $StartDir until we find a directory containing `.planning/`.
    # Returns the project root path, or $null if none found.
    param([string]$StartDir)
    $current = $StartDir
    while ($current -and (Test-Path -LiteralPath $current)) {
        if (Test-Path -LiteralPath (Join-Path $current '.planning')) { return $current }
        $parent = Split-Path -Parent $current
        if (-not $parent -or $parent -eq $current) { return $null }
        $current = $parent
    }
    return $null
}

# Project-dir resolution. Explicit -ProjectDir wins; otherwise walk up from cwd.
if (-not $ProjectDir) {
    $ProjectDir = Find-PlanningRoot -StartDir (Get-Location).Path
    if (-not $ProjectDir) {
        # No `.planning/` ancestor — fall back to cwd so we still emit *something*
        # rather than silently doing nothing in non-SGSD repos.
        $ProjectDir = (Get-Location).Path
    }
}
try { $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path } catch {}

function Read-StateInfo {
    param([string]$Dir)

    $info = [pscustomobject]@{
        milestone = ''
        phase     = ''
        verdict   = ''
        isPaused  = $false
        hasState  = $false
    }

    $statePath = Join-Path $Dir '.planning\STATE.md'
    if (Test-Path -LiteralPath $statePath) {
        $info.hasState = $true
        try {
            foreach ($line in (Get-Content -LiteralPath $statePath -TotalCount 30 -ErrorAction SilentlyContinue)) {
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

    if (Test-Path -LiteralPath (Join-Path $Dir '.planning\ORCHESTRATOR-CHECKPOINT.md')) {
        $info.isPaused = $true
    }

    return $info
}

function Get-RepoName {
    # Repo identity = project-dir leaf (most common case). For git worktrees
    # this still gives the worktree's directory leaf, which is usually the
    # disambiguator the operator wants (e.g. `GSDedits-feat-x`).
    param([string]$Dir)
    return (Split-Path -Leaf $Dir)
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
        default     { return '●' }
    }
}

function Format-RepoLabel {
    # Pretty repo identifier. If on master/main we omit the branch (less noise);
    # otherwise we append `/branch` so worktrees and feature branches are
    # distinguishable in the tab strip.
    param([string]$Repo, [string]$Branch)
    $defaultBranches = @('master', 'main', 'trunk')
    if ($Branch -and ($defaultBranches -notcontains $Branch.ToLower())) {
        $branchTrim = if ($Branch.Length -gt 12) { $Branch.Substring(0, 10) + '..' } else { $Branch }
        return "$Repo/$branchTrim"
    }
    return $Repo
}

function Compose-TabTitle {
    param(
        [string]$Role,
        $State,
        [string]$Repo,
        [string]$Branch
    )

    $repoLabel = Format-RepoLabel -Repo $Repo -Branch $Branch
    $milestone = if ($State.milestone) { $State.milestone } else { '?' }
    $phase     = if ($State.phase) { 'P' + $State.phase } else { '' }
    $glyph     = Format-StateGlyph $State

    # If we couldn't read STATE.md (non-SGSD repo, or new repo before any
    # phase is active), fall back to a tab format that still identifies the
    # repo + role without lying about phase state.
    if (-not $State.hasState) {
        switch ($Role) {
            'claude'         { return "🤖 $repoLabel".Trim() }
            'codex'          { return "🧪 $repoLabel".Trim() }
            'cockpit'        { return "📊 $repoLabel".Trim() }
            'review'         { return "🔍 $repoLabel".Trim() }
            'debug'          { return "🔧 $repoLabel".Trim() }
            'post-mortem'    { return "📋 $repoLabel".Trim() }
            'remote-monitor' { return "🛰 $repoLabel".Trim() }
            'token-audit'    { return "💰 $repoLabel".Trim() }
            default          { return "SGSD $repoLabel".Trim() }
        }
    }

    switch ($Role) {
        'claude'         { return "🤖 $repoLabel · $milestone $phase $glyph".Trim() }
        'codex'          { return "🧪 $repoLabel · $milestone $phase $glyph".Trim() }
        'cockpit'        { return "📊 $repoLabel · $milestone $phase".Trim() }
        'review'         { return "🔍 $repoLabel".Trim() }
        'debug'          { return "🔧 $repoLabel · $milestone $phase $glyph".Trim() }
        'post-mortem'    { return "📋 $repoLabel".Trim() }
        'remote-monitor' { return "🛰 $repoLabel · $milestone $phase".Trim() }
        'token-audit'    { return "💰 $repoLabel · $milestone".Trim() }
        default          { return "SGSD $repoLabel · $milestone $phase".Trim() }
    }
}

function Set-WarpTabTitle {
    param([string]$Title)
    # OSC 0: ESC ] 0 ; <text> BEL — sets window/icon title together. Warp picks
    # this up as the tab label.
    [Console]::Write([char]27 + ']0;' + $Title + [char]7)
}

# ── Main loop ───────────────────────────────────────────────────────────────
$repo      = Get-RepoName -Dir $ProjectDir
$lastTitle = ''

do {
    try {
        $state  = Read-StateInfo -Dir $ProjectDir
        $branch = Get-Branch     -Dir $ProjectDir
        $title  = Compose-TabTitle -Role $Role -State $state -Repo $repo -Branch $branch
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
