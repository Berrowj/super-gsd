# Super GSD Live Activity Feed - Simple scrollable live tail
# Shows every tool call as it happens, grouped by TaskCreate context.
#
# Usage:
#   .\sgsd-live-feed.ps1                              # current directory
#   .\sgsd-live-feed.ps1 -ProjectDir ~\project-name   # specific project
#
# Ctrl+C to stop.

param(
    [string]$ProjectDir = "."
)

$logPath = Join-Path $ProjectDir ".planning\metrics\activity-log.jsonl"

if (-not (Test-Path $logPath)) {
    Write-Host "No activity log at: $logPath" -ForegroundColor Red
    Write-Host "Run some commands first to populate the log." -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "         SUPER GSD -- LIVE AGENT FEED                           " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Log: $logPath" -ForegroundColor DarkGray
Write-Host "Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""
Write-Host "--- Recent activity ---" -ForegroundColor DarkGray

# Line processor as script block
$processLine = {
    param($line)
    try {
        $entry = $line | ConvertFrom-Json
        $time = [DateTime]::Parse($entry.ts).ToString("HH:mm:ss")
        $tool = $entry.tool
        $target = $entry.target
        if ($null -eq $target) { $target = "" }
        $phase = $entry.phase

        if ($tool -eq "TaskCreate") {
            Write-Host ""
            Write-Host ">> " -NoNewline -ForegroundColor White
            Write-Host $target -ForegroundColor White
            if ($phase) {
                Write-Host "   Phase $phase" -ForegroundColor DarkCyan
            }
            return
        }

        if ($tool -eq "TaskUpdate") {
            Write-Host "   " -NoNewline
            Write-Host "[done] " -NoNewline -ForegroundColor Green
            Write-Host $target -ForegroundColor DarkGray
            return
        }

        if ($tool -eq "Agent") {
            Write-Host ""
            Write-Host ">> SPAWN " -NoNewline -ForegroundColor Magenta
            Write-Host $target -ForegroundColor White
            return
        }

        $displayTarget = $target
        if ($displayTarget.Length -gt 90) {
            $displayTarget = $displayTarget.Substring(0, 90) + "..."
        }

        $color = "Gray"
        switch ($tool) {
            "Read"     { $color = "Cyan" }
            "Write"    { $color = "Green" }
            "Edit"     { $color = "Green" }
            "Bash"     { $color = "Yellow" }
            "Glob"     { $color = "DarkGray" }
            "Grep"     { $color = "DarkGray" }
            "WebFetch" { $color = "Cyan" }
        }

        Write-Host "   $time " -NoNewline -ForegroundColor DarkGray
        $toolPad = $tool.PadRight(8)
        Write-Host "$toolPad " -NoNewline -ForegroundColor $color
        Write-Host $displayTarget -ForegroundColor Gray
    } catch {
        # Ignore malformed lines
    }
}

$codexLogPath = Join-Path $ProjectDir ".planning\metrics\codex-log.jsonl"

# Process history: seed display with last 30 activity lines
$recent = Get-Content $logPath -Tail 30 -ErrorAction SilentlyContinue
foreach ($line in $recent) {
    & $processLine $line
}

Write-Host ""
Write-Host "[act] = activity-log events  [cdx] = codex-log reviews" -ForegroundColor DarkGray
Write-Host "--- watching activity-log + codex-log (Ctrl-C to stop) ---" -ForegroundColor DarkGray
Write-Host ""

# Snapshot-diff polling: avoids Get-Content -Wait blocking on dual-source
# (RESEARCH GAP-4: cannot add second -Wait; snapshot every 1500ms instead)
$activitySeenCount = (Get-Content $logPath -ErrorAction SilentlyContinue | Measure-Object -Line).Lines
if ($null -eq $activitySeenCount) { $activitySeenCount = 0 }
$codexSeenCount = 0
$renderedTsSet  = [System.Collections.Generic.HashSet[string]]::new()

while ($true) {
    Start-Sleep -Milliseconds 1500

    # Activity log: emit only new lines since last check
    $actLines = @(Get-Content $logPath -ErrorAction SilentlyContinue)
    if ($actLines.Count -gt $activitySeenCount) {
        $newAct = $actLines[$activitySeenCount..($actLines.Count - 1)]
        foreach ($line in $newAct) {
            & $processLine $line
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                $ts = if ($e.ts) { "$($e.ts)" } else { "" }
                if ($ts) { [void]$renderedTsSet.Add($ts) }
            } catch { }
        }
        $activitySeenCount = $actLines.Count
    }

    # Codex log: distinct [cdx] prefix + color per exit code
    if (Test-Path $codexLogPath) {
        $cdxLines = @(Get-Content $codexLogPath -ErrorAction SilentlyContinue)
        if ($cdxLines.Count -gt $codexSeenCount) {
            $newCdx = $cdxLines[$codexSeenCount..($cdxLines.Count - 1)]
            foreach ($line in $newCdx) {
                try {
                    $e = $line | ConvertFrom-Json -ErrorAction Stop
                    $ts   = if ($e.ts)   { "$($e.ts)" }   else { "" }
                    $step = if ($e.step) { "$($e.step)" } else { "" }
                    # Dedup: skip if ts already rendered by activity-log heartbeat
                    if ($ts -and $renderedTsSet.Contains($ts)) { continue }
                    $exitCode = if ($null -ne $e.exit) { "exit=$($e.exit)" } else { "" }
                    $dur      = if ($e.duration_ms)    { "dur=$($e.duration_ms)ms" } else { "" }
                    $fb       = if ($e.fallback_triggered) { "[FALLBACK]" } else { "" }
                    $cdxColor = if ($e.exit -eq 0) { "DarkCyan" } elseif ($e.exit -eq 5) { "DarkYellow" } else { "Red" }
                    Write-Host ("[cdx] $ts $step $exitCode $dur $fb") -ForegroundColor $cdxColor
                } catch {
                    Write-Host ("[cdx] $line") -ForegroundColor DarkCyan
                }
            }
            $codexSeenCount = $cdxLines.Count
        }
    }
}
