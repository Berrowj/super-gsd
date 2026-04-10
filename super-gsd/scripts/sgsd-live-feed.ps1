# Super GSD Live Activity Feed — Simple scrollable live tail
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

# Process history
$recent = Get-Content $logPath -Tail 30 -ErrorAction SilentlyContinue
foreach ($line in $recent) {
    & $processLine $line
}

Write-Host ""
Write-Host "--- Live (waiting for activity) ---" -ForegroundColor Yellow
Write-Host ""

# Stream new lines as they're appended
Get-Content $logPath -Wait -Tail 0 | ForEach-Object {
    & $processLine $_
}
