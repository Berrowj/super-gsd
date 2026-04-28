# ============================================================================
# Phase 50 A2 active-agent panel.
# Lock 13: never throws upward; degrade-to-unavailable on error.
# Lock 11: structural signals only (timestamp comparisons + string equality on
#         agent/role/subagent_type fields). NO embedding, cosine, similarity,
#         vector, or vtp_search invocation. Source-level prohibition.
# T-50-01 mitigation: ANSI escape strip pass before Write-Host.
# T-50-02 mitigation: tool_name only; tool *arguments* never rendered.
# ASCII-only literals (PS5.1 mojibake guard).
# ============================================================================

# Frozen const (mirrors Object.freeze intent for PS).
$script:ACTIVE_PULSE_SEC = 60

# Local fallback Trunc - host scope may already define one.
if (-not (Get-Command Trunc -ErrorAction SilentlyContinue)) {
    function Trunc {
        param([string]$Text, [int]$Width)
        if ($null -eq $Text) { return "" }
        if ($Width -le 0)    { return "" }
        if ($Text.Length -le $Width) { return $Text }
        if ($Width -le 3) { return $Text.Substring(0, $Width) }
        return $Text.Substring(0, $Width - 1) + "."
    }
}

# T-50-01 Tampering mitigation: strip ANSI escape sequences before any
# Write-Host call. Pattern matches the regex `\x1B\[[0-9;]*[a-zA-Z]` (per
# Phase 50 PLAN Task 3). Use [regex] hex escape so the pattern survives
# both PS5.1 single-quoted and double-quoted string parsing.
$script:ANSI_STRIP_PATTERN = '\x1B\[[0-9;]*[a-zA-Z]'

function _SgsdScrubAnsi {
    param([string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return "" }
    try {
        return [regex]::Replace($Text, $script:ANSI_STRIP_PATTERN, "")
    } catch {
        return $Text
    }
}

function _SgsdReadJsonlTail {
    param(
        [string]$Path,
        [int]$Tail = 50
    )
    if (-not (Test-Path -LiteralPath $Path)) { return @() }
    try {
        # Prefer host's render-cache helper when dot-sourced together.
        if (Get-Command Get-CachedTail -ErrorAction SilentlyContinue) {
            $lines = @(Get-CachedTail -Path $Path -Tail $Tail)
        } else {
            $lines = @(Get-Content -LiteralPath $Path -Tail $Tail -ErrorAction SilentlyContinue)
        }
    } catch { return @() }

    $out = New-Object System.Collections.ArrayList
    foreach ($line in $lines) {
        if (-not $line) { continue }
        try { [void]$out.Add(($line | ConvertFrom-Json -ErrorAction Stop)) } catch { continue }
    }
    return $out.ToArray()
}

function _SgsdAgeSec {
    param($IsoTs, [datetime]$Now)
    if (-not $IsoTs) { return [int]::MaxValue }
    try {
        $t = [datetime]::Parse([string]$IsoTs)
        $diff = ($Now - $t).TotalSeconds
        if ($diff -lt 0) { return 0 }
        return [int]$diff
    } catch {
        return [int]::MaxValue
    }
}

function Get-CurrentlyActiveAgents {
    param(
        [string]$ProjectDir,
        [int]$WindowSec = 300
    )
    try {
        if (-not $ProjectDir -or -not (Test-Path -LiteralPath $ProjectDir)) { return @() }
        $now = Get-Date
        $pulsePath    = Join-Path $ProjectDir ".planning/metrics/orchestrator-pulse.jsonl"
        $activityPath = Join-Path $ProjectDir ".planning/metrics/activity-log.jsonl"

        # (a) Pulse must be within ACTIVE_PULSE_SEC.
        $pulseRows = _SgsdReadJsonlTail -Path $pulsePath -Tail 5
        if ($pulseRows.Count -eq 0) { return @() }
        $lastPulse = $pulseRows[$pulseRows.Count - 1]
        $pulseAge = _SgsdAgeSec -IsoTs $lastPulse.ts -Now $now
        if ($pulseAge -gt $script:ACTIVE_PULSE_SEC) { return @() }

        # (b) activity-log Agent or TaskCreate within $WindowSec.
        $activity = _SgsdReadJsonlTail -Path $activityPath -Tail 200
        if ($activity.Count -eq 0) { return @() }

        $active = New-Object System.Collections.ArrayList
        $seen = @{}
        # Walk most recent first.
        for ($i = $activity.Count - 1; $i -ge 0; $i--) {
            $row = $activity[$i]
            if (-not $row) { continue }
            $kind = ""
            try { $kind = [string]$row.kind } catch { $kind = "" }
            if ($kind -ne "Agent" -and $kind -ne "TaskCreate") { continue }
            $age = _SgsdAgeSec -IsoTs $row.ts -Now $now
            if ($age -gt $WindowSec) { continue }
            $name = ""
            try { if ($row.subagent_type) { $name = [string]$row.subagent_type } } catch { }
            if (-not $name) { try { if ($row.agent) { $name = [string]$row.agent } } catch { } }
            if (-not $name) { try { if ($row.role)  { $name = [string]$row.role  } } catch { } }
            if (-not $name) { continue }
            $name = _SgsdScrubAnsi $name
            if ($seen.ContainsKey($name)) { continue }
            $seen[$name] = $true
            [void]$active.Add([pscustomobject]@{
                agent  = $name
                ageSec = $age
                kind   = $kind
            })
        }
        return $active.ToArray()
    } catch {
        return @()
    }
}

function Format-SgsdActiveAgentPanel {
    param(
        $Active,
        $History,
        $ToolStream,
        [int]$PaneWidth = 60
    )
    try {
        $lines = New-Object System.Collections.ArrayList

        # Header line.
        $activeArr = @()
        if ($null -ne $Active) { $activeArr = @($Active) }
        if ($activeArr.Count -eq 0) {
            [void]$lines.Add([pscustomobject]@{
                Line  = (Trunc "ACTIVE AGENTS  none in last 60s" $PaneWidth)
                Color = "DarkGray"
            })
        } else {
            $names = ($activeArr | Select-Object -First 3 | ForEach-Object {
                _SgsdScrubAnsi ([string]$_.agent)
            }) -join ", "
            $hdr = "ACTIVE AGENTS  {0}: {1}" -f $activeArr.Count, $names
            [void]$lines.Add([pscustomobject]@{
                Line  = (Trunc $hdr $PaneWidth)
                Color = "White"
            })
        }

        # Agent history block (3 most recent).
        $histArr = @()
        if ($null -ne $History) { $histArr = @($History) }
        $histTop = $histArr | Select-Object -First 3
        if (@($histTop).Count -eq 0) {
            [void]$lines.Add([pscustomobject]@{
                Line  = (Trunc "  (no recent agent history)" $PaneWidth)
                Color = "DarkGray"
            })
        } else {
            foreach ($row in $histTop) {
                $name = ""
                $age  = 0
                try { $name = _SgsdScrubAnsi ([string]$row.agent) } catch { $name = "" }
                if (-not $name) { try { $name = _SgsdScrubAnsi ([string]$row.role) } catch { $name = "" } }
                try { $age = [int]$row.ageSec } catch { $age = 0 }
                $rowText = "  {0,-18} {1,4}s ago" -f $name, $age
                [void]$lines.Add([pscustomobject]@{
                    Line  = (Trunc $rowText $PaneWidth)
                    Color = "Gray"
                })
            }
        }

        # Tool/skill/VTP stream block (5 most recent). NEVER render arguments.
        $toolArr = @()
        if ($null -ne $ToolStream) { $toolArr = @($ToolStream) }
        $toolTop = $toolArr | Select-Object -First 5
        if (@($toolTop).Count -eq 0) {
            [void]$lines.Add([pscustomobject]@{
                Line  = (Trunc "  (no tool/skill activity)" $PaneWidth)
                Color = "DarkGray"
            })
        } else {
            foreach ($t in $toolTop) {
                $tname = ""
                try { $tname = [string]$t.tool_name } catch { $tname = "" }
                if (-not $tname) { try { $tname = [string]$t.name } catch { $tname = "" } }
                if (-not $tname) { try { $tname = [string]$t.tool } catch { $tname = "" } }
                $tname = _SgsdScrubAnsi $tname
                $maxToolWidth = $PaneWidth - 4
                if ($maxToolWidth -lt 4) { $maxToolWidth = 4 }
                $rowText = "  " + (Trunc $tname $maxToolWidth)
                [void]$lines.Add([pscustomobject]@{
                    Line  = $rowText
                    Color = "Gray"
                })
            }
        }

        return $lines.ToArray()
    } catch {
        return ,([pscustomobject]@{ Line = "ACTIVE AGENTS  unavailable"; Color = "DarkGray" })
    }
}
