# ============================================================================
# Super GSD · P4 · Narrative + Ctrl+O Stream (v5)
# ============================================================================
# Split-pane dashboard:
#   TOP    — Cached Haiku narrative (paragraph + bullets) of what Claude is
#            currently doing. Regenerates every 5 min only when activity has
#            changed. Cheap on tokens.
#   BOTTOM — Live Ctrl+O-style tool stream, tailed from the active Claude
#            session JSONL at ~/.claude/projects/<encoded-cwd>/<session>.jsonl.
#            Shows every tool_use / tool_result from the session in real time.
#
# Reactive via FileSystemWatcher on the session dir. No polling flicker.
#
# Usage:
#   sgsd-narrative.ps1 [-ProjectDir PATH] [-HaikuRefreshSec 300]
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [int]$HaikuRefreshSec = 300,
    [int]$Heartbeat = 30
)

$ErrorActionPreference = "SilentlyContinue"

# Shared render cache: redraw throttle + active Claude session cache.
. (Join-Path $PSScriptRoot "lib\sgsd-render-cache.ps1")

# DLB-04 substrate status helper (registry + SEPL + distillation + gate 3).
. (Join-Path $PSScriptRoot "lib\sgsd-substrate-status.ps1")
. (Join-Path $PSScriptRoot "lib\sgsd-codex-status.ps1")

try {
    $ProjectDir = (Resolve-Path $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve $ProjectDir" -ForegroundColor Red
    exit 1
}

$PlanningDir = Join-Path $ProjectDir ".planning"
$ActivityLog = Join-Path $PlanningDir "metrics\activity-log.jsonl"
$NarrativeCache = Join-Path $PlanningDir "metrics\narrative.md"

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

# ── Helpers ──────────────────────────────────────────────────────────────────
function Get-PaneWidth  { try { return [Console]::WindowWidth - 1 } catch { return 80 } }
function Get-PaneHeight { try { return [Console]::WindowHeight - 1 } catch { return 30 } }

# Mtime-keyed tail cache. FSWatcher fires on ANY file in the watched dir, but
# most redraws don't touch the specific file we're tailing. When the file's
# mtime+size match the last cached read, skip IO entirely.
$script:_TailCache = @{}
function Get-CachedTail($path, $count) {
    if (-not (Test-Path $path)) { return @() }
    try {
        $item = Get-Item $path -ErrorAction Stop
        $key = "$path|$($item.LastWriteTimeUtc.Ticks)|$($item.Length)|$count"
        if ($script:_TailCache.ContainsKey($key)) { return $script:_TailCache[$key] }
        $lines = @(Get-Content $path -Tail $count -ErrorAction SilentlyContinue)
        # Evict stale entries for this path (cache only latest per path)
        $stale = @($script:_TailCache.Keys | Where-Object { $_.StartsWith("$path|") -and $_ -ne $key })
        foreach ($k in $stale) { $script:_TailCache.Remove($k) }
        $script:_TailCache[$key] = $lines
        return $lines
    } catch { return @() }
}

# Memoised tool-entry extractor keyed by jsonl path+mtime. Re-parsing 80 lines
# of JSON × 3 files × 4/sec was the dominant CPU cost.
$script:_ToolCache = @{}
function Get-CachedToolEntries($file, $tailCount) {
    if ($null -eq $file) { return @() }
    try {
        $key = "$($file.FullName)|$($file.LastWriteTimeUtc.Ticks)|$($file.Length)|$tailCount"
        if ($script:_ToolCache.ContainsKey($key)) { return $script:_ToolCache[$key] }
        $entries = Read-LastJsonlEntries $file $tailCount
        $tools = Get-ToolEntries $entries
        $stale = @($script:_ToolCache.Keys | Where-Object { $_.StartsWith("$($file.FullName)|") -and $_ -ne $key })
        foreach ($k in $stale) { $script:_ToolCache.Remove($k) }
        $script:_ToolCache[$key] = $tools
        return $tools
    } catch { return @() }
}

function Trunc($text, $width) {
    if ($null -eq $text) { return "" }
    $text = "$text"
    if ($text.Length -gt $width) { return $text.Substring(0, [Math]::Max(1, $width - 2)) + ".." }
    return $text
}

function Format-Age($sec) {
    if ($null -eq $sec) { return "--" }
    if ($sec -lt 60) { return "${sec}s" }
    if ($sec -lt 3600) { return "$([math]::Floor($sec / 60))m" }
    if ($sec -lt 86400) { return "$([math]::Floor($sec / 3600))h" }
    return "$([math]::Floor($sec / 86400))d"
}

function Get-SafeAgeSeconds($From) {
    if ($null -eq $From) { return $null }
    try {
        $dt = [DateTime]$From
        $sec = ((Get-Date) - $dt).TotalSeconds
        if ([double]::IsNaN($sec) -or [double]::IsInfinity($sec)) { return $null }
        if ($sec -lt 0) { return 0 }
        if ($sec -gt [int]::MaxValue) { return [int]::MaxValue }
        return [int][math]::Floor($sec)
    } catch {
        return $null
    }
}

function Format-Tokens($n) {
    if ($null -eq $n) { return "--" }
    $v = [double]$n
    if ($v -lt 1000) { return ([int]$v).ToString() }
    if ($v -lt 1000000) { return ("{0}K" -f [math]::Round($v / 1000)) }
    return ("{0}M" -f [math]::Round($v / 1000000, 1))
}

$script:_TokenSummaryCache = $null
$script:_TokenSummaryAt = [DateTime]::MinValue
function Get-TokenAttributionSummary {
    if ($script:_TokenSummaryCache) {
        $age = Get-SafeAgeSeconds $script:_TokenSummaryAt
        if ($age -ne $null -and $age -lt 30) { return $script:_TokenSummaryCache }
    }

    $repoRoot = Split-Path $PSScriptRoot -Parent
    $collector = Join-Path $repoRoot "tools\token-attribution\collect.cjs"
    if (-not (Test-Path $collector)) { return $null }

    try {
        $json = & node $collector --project $ProjectDir --write --summary --current --recent 8 2>$null
        if ($LASTEXITCODE -eq 0 -and $json) {
            $script:_TokenSummaryCache = ($json | ConvertFrom-Json -ErrorAction Stop)
            $script:_TokenSummaryAt = Get-Date
            return $script:_TokenSummaryCache
        }
    } catch {}
    return $script:_TokenSummaryCache
}

# Encode a project directory the way Claude Code does for its session index:
# replace path separators with dashes, drop drive colon.
#   C:\Users\user\project-clarity-erp  →  C--Users-user-project-clarity-erp
function Encode-ProjectPath($path) {
    # Claude Code encoding: colon, backslash, forward-slash, AND dot all become
    # dashes. The drive-letter colon + backslash produces the double-dash prefix:
    #   C:\Users\user\project-clarity-erp  ->  C--Users-user-project-clarity-erp
    # DO NOT collapse consecutive dashes — the double dash after the drive
    # letter is meaningful and must be preserved.
    # Strip trailing path separators first — otherwise a trailing backslash from
    # tab completion turns into an extra dash and the real dir never matches.
    $p = "$path".TrimEnd([char]92, [char]47)
    return $p -replace '[:\\/.]', '-'
}

function Get-ActiveSessionJsonl {
    # Returns up to 3 most-recently-modified session JSONLs.
    # Multi-file aggregation matters when several Claude windows/subagents
    # are open in the same project — the single newest file may have just
    # received a hook attachment with no tool_use, while real tool activity
    # is in the second-most-recent file. Caller flattens + dedupes.
    #
    # The sessions dir commonly holds 300+ files. Get-ActiveClaudeSessions
    # caches the top-3 handle list for 30s, so we only re-sort when the cache
    # ages out or a cached file disappears. The watcher's Created handler
    # busts the cache the instant a brand-new session arrives.
    $encoded = Encode-ProjectPath $ProjectDir
    $sessionsDir = Join-Path $HOME ".claude\projects\$encoded"
    return @(Get-ActiveClaudeSessions -SessionsDir $sessionsDir -Top 3 -RecheckSec 30)
}

function Read-LastJsonlEntries($file, $tailCount) {
    if ($null -eq $file) { return @() }
    try {
        $lines = Get-Content $file.FullName -Tail $tailCount -ErrorAction SilentlyContinue
        if (-not $lines) { return @() }
        $entries = @()
        foreach ($line in $lines) {
            try {
                $entries += ($line | ConvertFrom-Json -ErrorAction Stop)
            } catch {}
        }
        return @($entries)
    } catch { return @() }
}

# Extract tool_use blocks from an assistant message, with matching tool_result from the next user message.
function Get-ToolEntries($entries) {
    $out = @()
    for ($i = 0; $i -lt $entries.Count; $i++) {
        $e = $entries[$i]
        if ($e.type -ne "assistant" -or -not $e.message) { continue }
        $content = $e.message.content
        if (-not $content) { continue }
        foreach ($block in @($content)) {
            if ($block.type -ne "tool_use") { continue }
            $toolName = "$($block.name)"
            # NOTE: do not use $input — it's a PowerShell automatic variable
            # (pipeline enumerator). Silently overrides and you get nothing.
            $inp = $block.input
            $toolResult = $null
            # Look ahead for the matching tool_result in next user message
            for ($j = $i + 1; $j -lt [Math]::Min($i + 3, $entries.Count); $j++) {
                $next = $entries[$j]
                if ($next.type -eq "user" -and $next.message) {
                    foreach ($nb in @($next.message.content)) {
                        if ($nb.type -eq "tool_result" -and $nb.tool_use_id -eq $block.id) {
                            $toolResult = $nb.content
                            break
                        }
                    }
                }
                if ($toolResult) { break }
            }
            $ts = $null
            try { $ts = [DateTime]::Parse($e.timestamp) } catch {}
            $out += @{
                ts     = $ts
                tool   = $toolName
                inp    = $inp
                result = $toolResult
            }
        }
    }
    return @($out)
}

function Summarize-ToolInput($tool, $inp) {
    if ($null -eq $inp) { return "" }
    $s = ""
    if ("$tool" -match '^mcp__vtp|vtp') {
        if ($inp.query) { return "VTP query: $($inp.query)" }
        if ($inp.topic) { return "VTP topic: $($inp.topic)" }
        if ($inp.project_id) { return "VTP project: $($inp.project_id)" }
        return "VTP call"
    }
    if ("$tool" -match '^mcp__|skill') {
        $firstKey = @($inp.PSObject.Properties)[0]
        if ($firstKey) { return "tool call: $($firstKey.Name)=$($firstKey.Value)" }
        return "tool call"
    }
    switch ($tool) {
        "Read"     { if ($inp.file_path)  { $s = Split-Path $inp.file_path -Leaf } }
        "Write"    { if ($inp.file_path)  { $s = (Split-Path $inp.file_path -Leaf) + " (" + ("$($inp.content)".Length) + " chars)" } }
        "Edit"     { if ($inp.file_path)  { $s = Split-Path $inp.file_path -Leaf } }
        "Bash"     {
            if ($inp.command) {
                $cmd = "$($inp.command)"
                if ($cmd -match 'codex-exec\.sh|codex exec') { $s = "CODEX $cmd" }
                else { $s = $cmd }
            }
        }
        "Grep"     { if ($inp.pattern)    { $s = "/$($inp.pattern)/" } }
        "Glob"     { if ($inp.pattern)    { $s = $inp.pattern } }
        "Agent"    {
            if ($inp.subagent_type) { $s = "$($inp.subagent_type)" }
            if ($inp.description)   { $s += ": $($inp.description)" }
        }
        "TaskCreate"   {
            if ($inp.activeForm) { $s = $inp.activeForm } elseif ($inp.content) { $s = $inp.content }
        }
        "TaskUpdate"   { if ($inp.status) { $s = "status=$($inp.status)" } }
        default    {
            $firstKey = @($inp.PSObject.Properties)[0]
            if ($firstKey) { $s = "$($firstKey.Name)=$($firstKey.Value)" }
        }
    }
    return $s
}

function Get-ToolColor($tool) {
    if ("$tool" -match '^mcp__|vtp|skill') { return "Cyan" }
    switch ($tool) {
        "Codex"      { return "Blue" }
        "Read"       { return "Cyan" }
        "Write"      { return "Green" }
        "Edit"       { return "Green" }
        "Bash"       { return "Yellow" }
        "Grep"       { return "Cyan" }
        "Glob"       { return "Cyan" }
        "Agent"      { return "Magenta" }
        "TaskCreate" { return "White" }
        "TaskUpdate" { return "DarkGray" }
        default      { return "Gray" }
    }
}

# ── Renderers ────────────────────────────────────────────────────────────────

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
    if (Test-Path $readiness) {
        try {
            foreach ($line in (Get-Content $readiness -TotalCount 40 -ErrorAction SilentlyContinue)) {
                if ($line -match '^milestone_name:\s*(.+)$') {
                    $name = $matches[1].Trim().Trim('"', "'")
                    if ($name) { return $name }
                }
            }
        } catch {}
    }

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
            $out += [pscustomobject]@{ num = $num; name = $name }
        }
    } catch {}
    return @($out)
}

function Resolve-LivePhaseNumber {
    param([string]$PhaseNum)
    if (-not $PhaseNum) { return $null }
    try {
        $milestonesRoot = Join-Path $PlanningDir "milestones"
        if (-not (Test-Path $milestonesRoot)) { return $null }
        $hits = @(Get-ChildItem -Path $milestonesRoot -Directory -ErrorAction SilentlyContinue |
            ForEach-Object {
                $phaseRoot = Join-Path $_.FullName "phases"
                if (-not (Test-Path $phaseRoot)) { return }
                Get-ChildItem -Path $phaseRoot -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match "^$([regex]::Escape($PhaseNum))(?:-|$)" }
            } |
            Sort-Object LastWriteTime -Descending)
        if ($hits.Count -eq 0) { return $null }
        $d = $hits[0]
        $slug = ($d.Name -replace "^[0-9]+-", "") -replace "-", " "
        $name = (Get-Culture).TextInfo.ToTitleCase($slug)
        return [pscustomobject]@{
            milestone = $d.Parent.Parent.Name
            phase     = $PhaseNum
            phaseName = $name
        }
    } catch { return $null }
}

function Get-LivePhaseHint {
    param([int]$Tail = 240, [int]$MaxAgeSec = 3600)
    if (-not (Test-Path $ActivityLog)) { return $null }
    try {
        $now = Get-Date
        $lines = @(Get-CachedTail $ActivityLog $Tail)
        for ($i = $lines.Count - 1; $i -ge 0; $i--) {
            $line = $lines[$i]
            if (-not $line) { continue }
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                $ts = if ($e.ts) { [DateTime]::Parse("$($e.ts)").ToLocalTime() } else { $null }
                $age = if ($ts) { [int]($now - $ts).TotalSeconds } else { $null }
                if ($age -ne $null -and $age -gt $MaxAgeSec) { continue }
                foreach ($text in @("$($e.target)", "$($e.command_preview)")) {
                    if (-not $text) { continue }
                    $m = [regex]::Match($text, '(?i)(?:^|[\\/])\.planning[\\/]milestones[\\/](v[0-9]+(?:\.[0-9]+)?)[\\/]phases[\\/]([0-9]+)-([^\\/"\s]+)')
                    if ($m.Success) {
                        $slug = ($m.Groups[3].Value -replace '-', ' ')
                        $name = (Get-Culture).TextInfo.ToTitleCase($slug)
                        return [pscustomobject]@{
                            milestone = $m.Groups[1].Value
                            phase     = $m.Groups[2].Value
                            phaseName = $name
                            ageSec    = $age
                            source    = "activity-log target path"
                        }
                    }
                    $pm = [regex]::Match($text, '(?i)\b(?:Phase\s*|P)([0-9]{1,3})\b')
                    if ($pm.Success) {
                        $resolved = Resolve-LivePhaseNumber $pm.Groups[1].Value
                        if ($resolved) {
                            $resolved | Add-Member -NotePropertyName ageSec -NotePropertyValue $age -Force
                            $resolved | Add-Member -NotePropertyName source -NotePropertyValue "activity-log phase mention" -Force
                            return $resolved
                        }
                    }
                }
            } catch { continue }
        }
    } catch { }
    return $null
}

function Get-StateScope {
    $stateFile = Join-Path $PlanningDir "STATE.md"
    $out = [ordered]@{ milestone=""; milestoneName=""; phase=""; phaseName=""; total=0; index=0; status=""; source="STATE.md" }
    if (-not (Test-Path $stateFile)) { return [pscustomobject]$out }
    try {
        $stateText = Get-Content $stateFile -Raw -ErrorAction SilentlyContinue
        $out.milestone = Get-StateBodyValue $stateText "current_milestone"
        $out.phase = Get-StateBodyValue $stateText "current_phase"
        $out.phaseName = Get-StateBodyValue $stateText "current_phase_name"
        $out.status = Get-StateBodyValue $stateText "status"

        foreach ($line in (Get-Content $stateFile -TotalCount 80 -ErrorAction SilentlyContinue)) {
            if (-not $out.milestone -and $line -match '^milestone:\s*(.+)$') { $out.milestone = $matches[1].Trim().Trim('"', "'") }
            if (-not $out.milestoneName -and $line -match '^milestone_name:\s*(.+)$') { $out.milestoneName = $matches[1].Trim().Trim('"', "'") }
            if (-not $out.status -and $line -match '^status:\s*(.+)$') { $out.status = $matches[1].Trim().Trim('"', "'") }
        }
        $out.milestoneName = Get-MilestoneDisplayName $out.milestone $out.milestoneName

        if (-not $out.phase -and $out.status -match '(?i)\bNext:\s*Phase\s+([0-9]+)\s*\(([^)]+)\)') {
            $out.phase = $matches[1]; $out.phaseName = $matches[2]
        } elseif (-not $out.phase -and $out.status -match '\bPhase\s+([0-9]+)\s*\(([^)]+)\)') {
            $out.phase = $matches[1]; $out.phaseName = $matches[2]
        } elseif (-not $out.phase -and $out.status -match '\bPhase\s+([0-9]+)\b') {
            $out.phase = $matches[1]
        }
        if ($out.phase -and "$($out.phase)" -notmatch '^[0-9]+$') {
            $out.phase = ""
        }

        $liveHint = Get-LivePhaseHint
        if ($liveHint -and ((-not $out.phase) -or "$($out.status)" -match '(?i)complete|closed|halted|awaiting operator' -or ($out.milestone -and $liveHint.milestone -ne $out.milestone))) {
            $out.milestone = $liveHint.milestone
            $out.phase = $liveHint.phase
            $out.phaseName = $liveHint.phaseName
            $out.source = "live activity"
        }
        if ($out.milestone) {
            $phases = @(Get-RoadmapAgentMilestonePhases $out.milestone)
            $root = Join-Path $PlanningDir "milestones\$($out.milestone)\phases"
            if ($phases.Count -eq 0 -and (Test-Path $root)) {
                $phases = @(Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match '^([0-9]+)' } |
                    ForEach-Object {
                        $num = ([regex]::Match($_.Name, '^([0-9]+)').Groups[1].Value)
                        $slug = ($_.Name -replace "^[0-9]+-", "") -replace "-", " "
                        [pscustomobject]@{ num = $num; name=$slug }
                    } |
                    Sort-Object { [int]$_.num })
            }
            $out.total = $phases.Count
            for ($i = 0; $i -lt $phases.Count; $i++) {
                if ($phases[$i].num -eq $out.phase) {
                    $out.index = $i + 1
                    if (-not $out.phaseName) { $out.phaseName = $phases[$i].name }
                    break
                }
            }
        }
    } catch {}
    return [pscustomobject]$out
}

function Get-NarrativeLines {
    if (-not (Test-Path $NarrativeCache)) { return @() }
    try {
        return @(Get-Content $NarrativeCache -ErrorAction SilentlyContinue | Where-Object { "$_".Trim() })
    } catch { return @() }
}

function Get-AgentRole {
    param([string]$Text)
    $t = "$Text"
    if ($t -match '(?i)research') { return "Research" }
    if ($t -match '(?i)executor|execute|exec') { return "Executor" }
    if ($t -match '(?i)plan-checker|planner|plan') { return "Planner" }
    if ($t -match '(?i)review|verifier|atc') { return "Review" }
    return "Agent"
}

function Get-AgentNumber {
    param([string]$Role)
    switch ($Role) {
        "Research" { return "Agent 1" }
        "Executor" { return "Agent 2" }
        "Planner" { return "Agent 3" }
        default { return "Agent" }
    }
}

function Clean-AgentText {
    param([string]$Text)
    $s = "$Text" -replace 'â€”', '-' -replace '—', '-' -replace '\s+', ' '
    $s = $s -replace '^\s*[-:]\s*', ''
    return $s.Trim()
}

function Get-AgentRows {
    $rows = @()
    if (-not (Test-Path $ActivityLog)) { return @() }
    try {
        $now = Get-Date
        foreach ($line in (Get-CachedTail $ActivityLog 180)) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($e.tool -ne "Agent" -and $e.tool -ne "TaskCreate") { continue }
                $target = Clean-AgentText "$($e.target)"
                if (-not $target) { continue }
                $ts = [DateTime]::Parse($e.ts)
                $age = Get-SafeAgeSeconds $ts
                if ($age -eq $null) { continue }
                $role = Get-AgentRole $target
                $phase = if ($target -match '(?i)Phase\s+([0-9]+)') { $matches[1] } else { "" }
                $rows += [pscustomobject]@{
                    ts = $ts
                    age = $age
                    phase = $phase
                    role = $role
                    label = "$(Get-AgentNumber $role) ($role)"
                    text = $target
                    active = ($age -lt 300)
                }
            } catch {}
        }
    } catch {}
    return @($rows | Sort-Object ts -Descending)
}

function Get-ExecutionRouteSummary {
    param($Scope, $AgentRows, [string]$CurrentNarrative)
    $routePath = Join-Path $PlanningDir "metrics\route-decisions.jsonl"
    try {
        if (Test-Path $routePath) {
            $rows = @()
            foreach ($line in (Get-CachedTail $routePath 120)) {
                try {
                    $r = $line | ConvertFrom-Json -ErrorAction Stop
                    if ($r.boundary -eq "execution_route") { $rows += $r }
                } catch {}
            }
            if ($rows.Count -gt 0) {
                $phase = if ($Scope.phase) { "$($Scope.phase)" } else { "" }
                $current = @($rows | Where-Object { "$($_.phase)" -eq $phase })
                $row = if ($current.Count -gt 0) { $current[-1] } else { $rows[-1] }
                $d = $row.decision
                $provider = if ($d.chosen_provider) { "$($d.chosen_provider)" } elseif ($d.primary_provider) { "$($d.primary_provider)" } else { "unknown" }
                $providerLabel = switch ($provider) {
                    "codex"        { "Codex" }
                    "claude"       { "Claude" }
                    "local-script" { "Local script" }
                    default        { $provider }
                }
                $task = if ($d.task_id -and $d.task_kind) { "$($d.task_id) ($($d.task_kind))" } elseif ($d.task_id) { "$($d.task_id)" } elseif ($d.task_kind) { "$($d.task_kind)" } else { "execution task" }
                $why = "route logged"
                $reasons = @($row.reason_codes)
                if ($d.fallback_used -and $d.fallback_reason) {
                    $why = "fallback: $($d.fallback_reason)"
                } elseif ($reasons -contains "codex_primary_bounded_task") {
                    $why = "Codex chosen: bounded edit, allowed files, tests available"
                } elseif ($reasons -contains "local_script_primary_deterministic") {
                    $why = "local script chosen: deterministic command"
                } elseif ($reasons -contains "claude_primary_judgment_required") {
                    $why = "Claude chosen: judgement or private context needed"
                } elseif ($reasons -contains "claude_primary_unbounded_or_no_tests") {
                    $why = "Claude chosen: unbounded task or no safe test contract"
                } elseif ($d.route_class) {
                    $why = "$($d.route_class)" -replace '_', ' '
                }
                if ($current.Count -eq 0 -and $phase) {
                    $why = "no P$phase route yet; last route was P$($row.phase)"
                    $providerLabel = "Claude"
                    $task = "direct SGSD agent execution"
                }
                return [pscustomobject]@{ provider=$providerLabel; task=$task; why=$why; color=$(if ($providerLabel -eq "Codex") { "Blue" } elseif ($providerLabel -eq "Local script") { "Green" } else { "Yellow" }) }
            }
        }
    } catch {}

    $active = @($AgentRows | Where-Object { $_.active -and @("Research","Executor","Planner") -contains $_.role } | Select-Object -First 1)
    $taskText = if ($active.Count -gt 0) { $active[0].text } elseif ($CurrentNarrative) { $CurrentNarrative } else { "direct SGSD execution" }
    return [pscustomobject]@{
        provider = "Claude"
        task = $taskText
        why = "no execution route logged yet; using live Claude/agent activity"
        color = "Yellow"
    }
}

function Render-AgentOverview {
    param($pw, $Scope, [switch]$Compact)
    $rowsWritten = 0
    $lines = Get-NarrativeLines
    $current = if ($lines.Count -gt 0) { Clean-AgentText ($lines[0]) } else { "Waiting for current Claude narrative." }
    Write-Host "CLAUDE NOW " -NoNewline -ForegroundColor White
    if ($Scope.phase) {
        Write-Host ("{0}/P{1}" -f $Scope.milestone, $Scope.phase) -NoNewline -ForegroundColor Yellow
        if ($Scope.total -gt 0) { Write-Host (" ({0}/{1})" -f $Scope.index, $Scope.total) -NoNewline -ForegroundColor DarkGray }
    }
    Write-Host $CLEAR_LINE
    $rowsWritten++
    Write-Host "  " -NoNewline
    Write-Host (Trunc $current ($pw - 3)) -NoNewline -ForegroundColor Yellow
    Write-Host $CLEAR_LINE
    $rowsWritten++

    $agentRows = @(Get-AgentRows)
    $activeLimit = if ($Compact) { 2 } else { 3 }
    $active = @($agentRows | Where-Object { $_.active -and @("Research","Executor","Planner") -contains $_.role } | Select-Object -First $activeLimit)
    Write-Host "ACTIVE AGENTS" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    $rowsWritten++
    if ($active.Count -eq 0) {
        Write-Host "  none" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
        $rowsWritten++
    } else {
        foreach ($a in $active) {
            $phase = if ($a.phase) { "P$($a.phase) " } else { "" }
            Write-Host "  $($a.label) " -NoNewline -ForegroundColor Green
            Write-Host (Format-Age $a.age) -NoNewline -ForegroundColor DarkGray
            Write-Host "  " -NoNewline
            Write-Host (Trunc ($phase + $a.text) ($pw - 24)) -NoNewline -ForegroundColor Green
            Write-Host $CLEAR_LINE
            $rowsWritten++
        }
    }

    $tokenAgentLimit = if ($Compact) { 2 } else { 4 }
    $rowsWritten += Render-TokenSpend $pw -MaxAgents $tokenAgentLimit -NoAudit:$Compact

    $exec = Get-ExecutionRouteSummary -Scope $Scope -AgentRows $agentRows -CurrentNarrative $current
    Write-Host "EXECUTOR " -NoNewline -ForegroundColor White
    Write-Host $exec.provider -NoNewline -ForegroundColor $exec.color
    Write-Host "  " -NoNewline
    Write-Host (Trunc $exec.task ($pw - 18)) -NoNewline -ForegroundColor $exec.color
    Write-Host $CLEAR_LINE
    $rowsWritten++
    Write-Host "WHY      " -NoNewline -ForegroundColor White
    Write-Host (Trunc $exec.why ($pw - 9)) -NoNewline -ForegroundColor Gray
    Write-Host $CLEAR_LINE
    $rowsWritten++

    Write-Host "AGENT HISTORY" -NoNewline -ForegroundColor White
    Write-Host $CLEAR_LINE
    $rowsWritten++
    $history = @()
    $seen = @{}
    $historyLimit = if ($Compact) { 2 } else { 5 }
    foreach ($a in $agentRows) {
        if ($a.active) { continue }
        if (-not @("Research","Executor","Planner") -contains $a.role) { continue }
        $key = "$($a.role)|$($a.phase)"
        if ($seen.ContainsKey($key)) { continue }
        $seen[$key] = $true
        $phase = if ($a.phase) { "P$($a.phase)" } else { "P?" }
        $verb = switch ($a.role) {
            "Research" { "found the phase constraints and evidence needed" }
            "Executor" { "last built or changed the phase artifact" }
            "Planner" { "set the delivery structure and acceptance route" }
            default { "updated the phase" }
        }
        $history += [pscustomobject]@{ role=$a.role; line="$phase $($a.label): $verb - $(Clean-AgentText $a.text)" }
        if ($a.role -eq "Research") {
            $history += [pscustomobject]@{ role=$a.role; line="$phase $($a.label): research shapes the current plan and review checklist." }
        }
        if ($history.Count -ge $historyLimit) { break }
    }
    if ($history.Count -eq 0) {
        Write-Host "  no prior agent records yet" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
        $rowsWritten++
    } else {
        foreach ($h in $history) {
            Write-Host "  " -NoNewline
            Write-Host (Trunc $h.line ($pw - 3)) -NoNewline -ForegroundColor Gray
            Write-Host $CLEAR_LINE
            $rowsWritten++
        }
    }
    return $rowsWritten
}

function Render-TokenSpend {
    param($pw, [int]$MaxAgents = 4, [switch]$NoAudit)
    $rowsWritten = 0
    $summary = Get-TokenAttributionSummary
    Write-Host "TOKEN SPEND" -NoNewline -ForegroundColor White
    if ($summary -and $summary.scope) {
        $scopeTxt = ""
        if ($summary.scope.milestone) { $scopeTxt += "$($summary.scope.milestone)" }
        if ($summary.scope.phase) { $scopeTxt += "/P$($summary.scope.phase)" }
        if ($scopeTxt) { Write-Host " $scopeTxt" -NoNewline -ForegroundColor DarkGray }
    }
    Write-Host $CLEAR_LINE
    $rowsWritten++

    if (-not $summary) {
        Write-Host "  no token attribution yet" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
        return ($rowsWritten + 1)
    }

    $agentTotal = Format-Tokens $summary.agent_total_tokens
    $mainCtx = Format-Tokens $summary.assistant_usage.context_tokens
    $mainOut = Format-Tokens $summary.assistant_usage.output_tokens
    $high = Format-Tokens $summary.codex_candidate_tokens.high
    $med = Format-Tokens $summary.codex_candidate_tokens.medium
    Write-Host "  agents " -NoNewline -ForegroundColor Gray
    Write-Host $agentTotal -NoNewline -ForegroundColor Yellow
    Write-Host " | main ctx " -NoNewline -ForegroundColor Gray
    Write-Host $mainCtx -NoNewline -ForegroundColor Magenta
    Write-Host " out " -NoNewline -ForegroundColor Gray
    Write-Host $mainOut -NoNewline -ForegroundColor Magenta
    Write-Host " | Codex candidates high " -NoNewline -ForegroundColor Gray
    Write-Host $high -NoNewline -ForegroundColor Green
    Write-Host " med " -NoNewline -ForegroundColor Gray
    Write-Host $med -NoNewline -ForegroundColor Yellow
    Write-Host $CLEAR_LINE
    $rowsWritten++

    $shown = 0
    foreach ($a in @($summary.by_agent)) {
        if ($shown -ge $MaxAgents) { break }
        $tok = Format-Tokens $a.total_tokens
        $avg = Format-Tokens $a.avg_tokens
        $cand = "$($a.codex_offload_candidate)"
        $candColor = switch ($cand) {
            "high" { "Green" }
            "medium" { "Yellow" }
            "low" { "DarkGray" }
            default { "DarkGray" }
        }
        $line = ("{0} {1} ({2}x avg {3})" -f $a.agent_type, $tok, $a.calls, $avg)
        Write-Host "  " -NoNewline
        Write-Host (Trunc $line ([Math]::Max(20, $pw - 18))) -NoNewline -ForegroundColor Cyan
        Write-Host "  offload " -NoNewline -ForegroundColor DarkGray
        Write-Host $cand -NoNewline -ForegroundColor $candColor
        Write-Host $CLEAR_LINE
        $shown++
        $rowsWritten++
    }
    if (-not $NoAudit -and $summary.ledger_path) {
        $ledger = ".planning\metrics\token-attribution.jsonl"
        $appendTxt = if ($summary.appended -gt 0) { " +$($summary.appended) new" } else { "" }
        Write-Host "  audit " -NoNewline -ForegroundColor DarkGray
        Write-Host "$ledger$appendTxt" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
        $rowsWritten++
    }
    return $rowsWritten
}

function Render-Header {
    param($ts)
    Write-Host "SUPER GSD" -NoNewline -ForegroundColor Magenta
    Write-Host " ! " -NoNewline -ForegroundColor Cyan
    Write-Host "Claude + Agents" -NoNewline -ForegroundColor White
    Write-Host "  $ts" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    # ── DLB-04 Substrate one-liner ────────────────────────────────────────────
    # Subtle, sub-header — doesn't compete with the Haiku narrative below.
    # Narrative pane is about what Claude is doing; this line is about what
    # the substrate has accumulated (registry, SEPL queue, distillation).
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
    Write-Host "  DLB-04 " -NoNewline -ForegroundColor DarkGray
    Write-Host $substrateLine -NoNewline -ForegroundColor $substrateColor
    Write-Host $CLEAR_LINE
}

function Render-HaikuSummary {
    param($pw)
    $codex = Get-SgsdCodexStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
    Write-Host "> " -NoNewline -ForegroundColor Magenta
    Write-Host "CURRENT STATUS " -NoNewline -ForegroundColor White
    if (Test-Path $NarrativeCache) {
        $age = Get-SafeAgeSeconds (Get-Item $NarrativeCache).LastWriteTime
        if ($age -eq $null) { $age = 0 }
        Write-Host "(cached " -NoNewline -ForegroundColor DarkGray
        Write-Host "$([math]::Floor($age/60))m ago" -NoNewline -ForegroundColor DarkGray
        Write-Host ")" -NoNewline -ForegroundColor DarkGray
    } else {
        Write-Host "(no cache yet)" -NoNewline -ForegroundColor DarkGray
    }
    Write-Host $CLEAR_LINE

    if (-not (Test-Path $NarrativeCache)) {
        Write-Host "(will populate on next Haiku refresh)$CLEAR_LINE" -ForegroundColor DarkGray
        return
    }
    Write-Host "> " -NoNewline -ForegroundColor Cyan
    Write-Host "CODEX " -NoNewline -ForegroundColor White
    Write-Host (Get-SgsdCodexStatusLine -Status $codex) -NoNewline -ForegroundColor $codex.stateColor
    Write-Host $CLEAR_LINE
    Write-Host $CLEAR_LINE
    $text = Get-Content $NarrativeCache -Raw -ErrorAction SilentlyContinue
    if (-not $text) {
        Write-Host "(empty)$CLEAR_LINE" -ForegroundColor DarkGray
        return
    }

    # Parse the cached narrative as two sections:
    #   1. Paragraph(s) — any plain prose lines
    #   2. Bullets — lines starting with - / * / • followed by space
    # Render each with distinct colour so structure is visible.
    $rawLines = @($text -split "`r?`n")
    $paraLines = @()
    $bulletLines = @()
    foreach ($raw in $rawLines) {
        $trim = $raw.Trim()
        if (-not $trim) { continue }
        if ($trim -match '^[-*\u2022]\s+(.+)$') {
            $bulletLines += $matches[1].Trim()
        } else {
            $paraLines += $trim
        }
    }

    # Word-wrap the paragraph prose, max 4 lines, with yellow left-rail `| `
    # mimicking the v5 mockup's border-left yellow stripe on .haiku-para
    $paraText = ($paraLines -join ' ') -replace '\s+', ' '
    if ($paraText) {
        $words = $paraText.Trim().Split(' ')
        $line = ""
        $paraRows = 0
        $maxPara = 4
        $truncated = $false
        $railWidth = 2  # "| " prefix eats 2 chars
        $paraMax = $pw - $railWidth - 1
        foreach ($word in $words) {
            if (($line.Length + $word.Length + 1) -gt $paraMax) {
                Write-Host "| " -NoNewline -ForegroundColor Yellow
                Write-Host $line -NoNewline -ForegroundColor Yellow
                Write-Host $CLEAR_LINE
                $paraRows++
                if ($paraRows -ge $maxPara) { $truncated = $true; $line = ""; break }
                $line = $word
            } else {
                if ($line) { $line = "$line $word" } else { $line = $word }
            }
        }
        if ($line -and -not $truncated) {
            Write-Host "| " -NoNewline -ForegroundColor Yellow
            Write-Host $line -NoNewline -ForegroundColor Yellow
            Write-Host $CLEAR_LINE
        }
    }

    # Bullets, max 5, each truncated to pane width
    if ($bulletLines.Count -gt 0) {
        Write-Host $CLEAR_LINE
        $maxBullets = 5
        $bulletsShown = 0
        foreach ($b in $bulletLines) {
            if ($bulletsShown -ge $maxBullets) { break }
            $text = Trunc $b ($pw - 4)
            Write-Host "> " -NoNewline -ForegroundColor Magenta
            Write-Host $text -NoNewline -ForegroundColor White
            Write-Host $CLEAR_LINE
            $bulletsShown++
        }
        if ($bulletLines.Count -gt $maxBullets) {
            Write-Host "  +$($bulletLines.Count - $maxBullets) more" -NoNewline -ForegroundColor DarkGray
            Write-Host $CLEAR_LINE
        }
    }
}

function Render-CtrlOStream {
    param($pw, $maxRows)
    $sessionFiles = Get-ActiveSessionJsonl
    Write-Host "CTRL+O LIVE TOOL STREAM " -NoNewline -ForegroundColor White
    if ($sessionFiles.Count -eq 0) {
        Write-Host "(claude session missing; codex lane only)$CLEAR_LINE" -ForegroundColor DarkGray
    } else {
        Write-Host "(" -NoNewline -ForegroundColor DarkGray
        $names = ($sessionFiles | ForEach-Object { $_.Name.Substring(0, 6) }) -join ","
        Write-Host $names -NoNewline -ForegroundColor Cyan
        Write-Host ")" -NoNewline -ForegroundColor DarkGray
        Write-Host $CLEAR_LINE
    }

    # Aggregate tools across all recent session files, dedupe by ts+tool+summary
    $allTools = @()
    foreach ($sf in $sessionFiles) {
        $allTools += (Get-CachedToolEntries $sf 80)
    }
    # Dedupe (tool_use IDs are unique; fall back to ts+tool composite)
    $seen = @{}
    $tools = @()
    foreach ($t in $allTools) {
        $key = "$($t.ts)|$($t.tool)|$($t.inp)"
        if ($seen.ContainsKey($key)) { continue }
        $seen[$key] = $true
        $tools += $t
    }
    $codexRows = @(Get-SgsdCodexTimelineRows -ProjectDir $ProjectDir -PlanningDir $PlanningDir -MaxRows $maxRows)
    foreach ($row in $codexRows) {
        $tools += @{
            ts     = $row.ts
            tool   = $row.tool
            inp    = [pscustomobject]@{ summary = $row.summary }
            result = $null
        }
    }
    # Sort by timestamp ascending (oldest first), so Render reverses to newest-on-top
    $tools = @($tools | Sort-Object { if ($_.ts) { $_.ts } else { [DateTime]::MinValue } })

    if ($tools.Count -eq 0) {
        Write-Host "(no recent claude or codex activity)$CLEAR_LINE" -ForegroundColor DarkGray
        return
    }
    # Newest first, show up to maxRows
    $reversed = @()
    for ($i = $tools.Count - 1; $i -ge 0; $i--) { $reversed += $tools[$i] }
    $show = [Math]::Min($maxRows, $reversed.Count)
    for ($i = 0; $i -lt $show; $i++) {
        $t = $reversed[$i]
        $tsStr = if ($t.ts) { $t.ts.ToString("HH:mm:ss") } else { "--:--:--" }
        $toolPad = "$($t.tool)".PadRight(10)
        $color = Get-ToolColor $t.tool
        $origin = if ($t.tool -eq "Codex") { "CODEX>" } else { "CLAUDE>" }
        $originColor = if ($t.tool -eq "Codex") { "Blue" } else { "DarkGray" }
        $summary = if ($t.tool -eq "Codex" -and $t.inp.summary) { "$($t.inp.summary)" } else { Summarize-ToolInput $t.tool $t.inp }
        $summary = Trunc ($summary -replace '\s+', ' ') ($pw - 30)
        Write-Host $tsStr -NoNewline -ForegroundColor DarkGray
        Write-Host " " -NoNewline
        Write-Host $origin.PadRight(8) -NoNewline -ForegroundColor $originColor
        Write-Host " " -NoNewline
        Write-Host $toolPad -NoNewline -ForegroundColor $color
        Write-Host " " -NoNewline
        Write-Host $summary -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
    }
}

function Maybe-RefreshHaiku {
    # Regenerates NarrativeCache via `claude --print` when the cache is older
    # than $HaikuRefreshSec (or missing). The actual claude call runs in a
    # DETACHED background PowerShell process so this function never blocks the
    # render loop. On failure we touch a sidecar stamp, NOT the cache — so the
    # freshness check correctly triggers a retry next tick.
    # Activity-log is the orchestrator's append log. When orchestrator isn't
    # running we fall back to the live session jsonl tool_uses so the Haiku
    # narrative still refreshes during normal interactive work. Either source
    # is fine — we just need *some* recent activity to summarise.
    $activityLogStale = $true
    if (Test-Path $ActivityLog) {
        $logAge = Get-SafeAgeSeconds (Get-Item $ActivityLog).LastWriteTime
        if ($logAge -ne $null -and $logAge -lt 600) { $activityLogStale = $false }
    }

    $lockFile    = "$NarrativeCache.lock"
    $failStamp   = "$NarrativeCache.lastfail"
    $attemptFile = "$NarrativeCache.lastattempt"

    # Exponential backoff on consecutive failures: 30s / 60s / 120s / 300s cap
    if (Test-Path $failStamp) {
        $failCount = [int](Get-Content $failStamp -ErrorAction SilentlyContinue | Select-Object -First 1)
        if ($failCount -gt 0 -and (Test-Path $attemptFile)) {
            $sinceAttempt = Get-SafeAgeSeconds (Get-Item $attemptFile).LastWriteTime
            if ($sinceAttempt -eq $null) { $sinceAttempt = [int]::MaxValue }
            $backoff = [Math]::Min(300, 30 * [Math]::Pow(2, [Math]::Min($failCount - 1, 4)))
            if ($sinceAttempt -lt $backoff) { return }
        }
    }

    $needsRefresh = $false
    if (-not (Test-Path $NarrativeCache)) {
        $needsRefresh = $true
    } else {
        $age = Get-SafeAgeSeconds (Get-Item $NarrativeCache).LastWriteTime
        if ($age -eq $null -or $age -ge $HaikuRefreshSec) { $needsRefresh = $true }
    }
    if (-not $needsRefresh) { return }

    # Don't spawn if one is already in flight
    if (Test-Path $lockFile) {
        $lockAge = Get-SafeAgeSeconds (Get-Item $lockFile).LastWriteTime
        if ($lockAge -ne $null -and $lockAge -lt 180) { return }   # stale lock after 3min
    }

    # Build snippet — prefer activity-log when fresh, else derive from live
    # session jsonl tool_uses so the Haiku stays current outside orchestrator runs.
    $snippet = @()
    if (-not $activityLogStale) {
        $lines = Get-CachedTail $ActivityLog 20
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                $target = "$($e.target)"
                if ($target.Length -gt 120) { $target = $target.Substring(0, 120) + "..." }
                $snippet += "$($e.tool): $target"
            } catch {}
        }
    } else {
        $sessionFiles = Get-ActiveSessionJsonl
        $allTools = @()
        foreach ($sf in $sessionFiles) {
            $entries = Read-LastJsonlEntries $sf 80
            $allTools += (Get-ToolEntries $entries)
        }
        $allTools = @($allTools | Sort-Object { if ($_.ts) { $_.ts } else { [DateTime]::MinValue } } | Select-Object -Last 20)
        foreach ($t in $allTools) {
            $target = Summarize-ToolInput $t.tool $t.inp
            if ($target.Length -gt 120) { $target = $target.Substring(0, 120) + "..." }
            $snippet += "$($t.tool): $target"
        }
    }
    if ($snippet.Count -eq 0) { return }
    $snippetText = $snippet -join "`n"

    $prompt = @"
You are a narrative observer for an autonomous Claude Code orchestrator session.
Read these recent tool calls and write:

1. ONE paragraph (2-3 sentences) describing what Claude is currently doing. Use exact filenames / agent names / phase numbers from the log. No greetings.

2. Then a blank line, then 3-5 BULLET POINTS (each starting with "- ") describing specific tasks / searches / agents / next steps. Each bullet one short line.

Format exactly:
<paragraph>

- <bullet 1>
- <bullet 2>
- <bullet 3>

Recent activity:
$snippetText

Narrative:
"@

    # Write prompt + worker script to temp, spawn detached pwsh that does the
    # actual claude call. Worker writes cache on success, or bumps failStamp
    # on timeout/error. Main loop returns immediately.
    $promptFile = [System.IO.Path]::GetTempFileName()
    Set-Content -Path $promptFile -Value $prompt -Encoding utf8 -NoNewline

    $workerScript = [System.IO.Path]::GetTempFileName() + ".ps1"
    $workerBody = @"
`$ErrorActionPreference = 'SilentlyContinue'
try {
    `$psi = New-Object System.Diagnostics.ProcessStartInfo
    `$psi.FileName = 'cmd.exe'
    `$psi.Arguments = '/c claude --print --dangerously-skip-permissions --model claude-haiku-4-5-20251001'
    `$psi.RedirectStandardInput = `$true
    `$psi.RedirectStandardOutput = `$true
    `$psi.RedirectStandardError = `$true
    `$psi.UseShellExecute = `$false
    `$psi.CreateNoWindow = `$true
    `$prompt = Get-Content -Raw '$promptFile'
    `$p = [System.Diagnostics.Process]::Start(`$psi)
    `$p.StandardInput.Write(`$prompt)
    `$p.StandardInput.Close()
    if (`$p.WaitForExit(60000)) {
        `$stdout = `$p.StandardOutput.ReadToEnd()
        if (`$stdout -and `$stdout.Trim().Length -gt 20) {
            Set-Content -Path '$NarrativeCache' -Value `$stdout.Trim() -Encoding utf8
            Remove-Item '$failStamp' -Force -ErrorAction SilentlyContinue
        } else {
            `$fc = 0; if (Test-Path '$failStamp') { `$fc = [int](Get-Content '$failStamp' | Select-Object -First 1) }
            Set-Content -Path '$failStamp' -Value ([string](`$fc + 1)) -Encoding ascii
        }
    } else {
        try { `$p.Kill() } catch {}
        `$fc = 0; if (Test-Path '$failStamp') { `$fc = [int](Get-Content '$failStamp' | Select-Object -First 1) }
        Set-Content -Path '$failStamp' -Value ([string](`$fc + 1)) -Encoding ascii
    }
} catch {
    `$fc = 0; if (Test-Path '$failStamp') { `$fc = [int](Get-Content '$failStamp' | Select-Object -First 1) }
    Set-Content -Path '$failStamp' -Value ([string](`$fc + 1)) -Encoding ascii
} finally {
    Remove-Item '$lockFile' -Force -ErrorAction SilentlyContinue
    Remove-Item '$promptFile' -Force -ErrorAction SilentlyContinue
    Remove-Item `$MyInvocation.MyCommand.Path -Force -ErrorAction SilentlyContinue
}
"@
    Set-Content -Path $workerScript -Value $workerBody -Encoding utf8

    # Mark in-flight and attempt time BEFORE spawning
    New-Item -Path $lockFile -ItemType File -Force | Out-Null
    Set-Content -Path $attemptFile -Value ((Get-Date).ToString('o')) -Encoding ascii -Force

    # Detached spawn — hidden window, no wait, no inheritance
    try {
        Start-Process -FilePath "powershell.exe" `
                      -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", $workerScript) `
                      -WindowStyle Hidden | Out-Null
    } catch {
        Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    }
}

function Render {
    # Throttle: the session-dir FSWatcher fires per tool_use append — can burst
    # 10×/sec during active work. Skip redraws inside the 2s window; heartbeat
    # still guarantees a full paint every $Heartbeat seconds.
    if (-not (Test-RenderDue -MinIntervalMs 2000)) { return }

    Write-Host $HOME_POS -NoNewline
    $pw = Get-PaneWidth
    $ph = Get-PaneHeight
    $ts = Get-Date -Format 'HH:mm:ss'

    # Kick off a Haiku refresh in the background if the cache is stale.
    # Non-blocking — pane continues to render the old cache while Haiku runs.
    Maybe-RefreshHaiku

    $compact = ($ph -lt 32)

    Render-Header $ts
    Write-Host $CLEAR_LINE
    $scope = Get-StateScope
    $overviewRows = Render-AgentOverview $pw $scope -Compact:$compact
    Write-Host $CLEAR_LINE

    # Remaining space goes to Ctrl+O stream. In the half-height pane, keep the
    # summary stable and only show the rows that physically fit.
    $used = 3 + [int]$overviewRows + 1
    $ctrlOBudget = [Math]::Max(0, $ph - $used - 1)
    if ($ctrlOBudget -gt 0) {
        Render-CtrlOStream $pw $ctrlOBudget
    }

    Write-Host $CLEAR_BELOW -NoNewline
}

# ── File watcher + main loop ─────────────────────────────────────────────────
Write-Host "$ALT_ENTER$ESC[2J$ESC[H$HIDE_CURSOR" -NoNewline

$global:needsRedraw = $true

# Watch the project .planning/metrics dir (activity log + narrative cache)
$metricsDir = Join-Path $PlanningDir "metrics"
if (Test-Path $metricsDir) {
    $w1 = New-Object System.IO.FileSystemWatcher
    $w1.Path = $metricsDir
    $w1.Filter = "*"
    $w1.EnableRaisingEvents = $true
    $null = Register-ObjectEvent -InputObject $w1 -EventName Changed -Action { $global:needsRedraw = $true }
}

# Watch the Claude Code session dir for tool_use appends
$encoded = Encode-ProjectPath $ProjectDir
$sessionsDir = Join-Path $HOME ".claude\projects\$encoded"
if (Test-Path $sessionsDir) {
    $w2 = New-Object System.IO.FileSystemWatcher
    $w2.Path = $sessionsDir
    $w2.Filter = "*.jsonl"
    $w2.EnableRaisingEvents = $true
    $null = Register-ObjectEvent -InputObject $w2 -EventName Changed -Action { $global:needsRedraw = $true }
    # On Created, bust the session-file cache so a brand-new Claude window shows
    # up on the NEXT render instead of waiting the full 30s recheck window.
    $null = Register-ObjectEvent -InputObject $w2 -EventName Created -Action {
        $global:needsRedraw = $true
        if (Get-Command Reset-ActiveClaudeSessionsCache -ErrorAction SilentlyContinue) {
            Reset-ActiveClaudeSessionsCache
        }
    }
}

$lastHeartbeat = [DateTime]::MinValue

try {
    while ($true) {
        if ($global:needsRedraw -or (((Get-Date) - $lastHeartbeat).TotalSeconds -ge $Heartbeat)) {
            $global:needsRedraw = $false
            $lastHeartbeat = Get-Date
            Render
        }
        # Longer sleep — render throttle enforces the real 2s min interval.
        Start-Sleep -Milliseconds 2000
    }
} finally {
    Write-Host "$SHOW_CURSOR$ALT_EXIT" -NoNewline
}
