# Super GSD Live Activity Feed — Grouped View
# Shows tool calls grouped by agent/task context.
# Uses TaskCreate entries as section headers.
#
# Usage: .\sgsd-live-feed.ps1 [-ProjectDir <path>]
#
# Example:
#   .\sgsd-live-feed.ps1
#   .\sgsd-live-feed.ps1 -ProjectDir ~\project-clarity-erp

param(
    [string]$ProjectDir = "."
)

$logPath = Join-Path $ProjectDir ".planning\metrics\activity-log.jsonl"

if (-not (Test-Path $logPath)) {
    Write-Host "No activity log at: $logPath" -ForegroundColor Red
    Write-Host "Run /sgsd-orchestrate or make tool calls first." -ForegroundColor DarkGray
    exit 1
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "         SUPER GSD -- LIVE AGENT FEED                           " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Project: $ProjectDir" -ForegroundColor DarkGray
Write-Host "Log: $logPath" -ForegroundColor DarkGray
Write-Host "Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

# Color scheme
$toolColors = @{
    Read       = "Cyan"
    Write      = "Green"
    Edit       = "Green"
    Bash       = "Yellow"
    Glob       = "DarkGray"
    Grep       = "DarkGray"
    Agent      = "Magenta"
    WebFetch   = "Cyan"
    TaskCreate = "White"
    TaskUpdate = "DarkGray"
}

# Last known agent context (set by TaskCreate entries)
$script:currentContext = $null
$script:lastPhase = $null

function Format-Entry {
    param($entry)

    $time = [DateTime]::Parse($entry.ts).ToString("HH:mm:ss")
    $tool = $entry.tool
    $target = $entry.target
    if ($null -eq $target) { $target = "" }

    # TaskCreate entries become section headers (new agent context)
    if ($tool -eq "TaskCreate") {
        Write-Host ""
        Write-Host "▶ " -NoNewline -ForegroundColor White
        Write-Host $target -ForegroundColor White
        if ($entry.phase -and $entry.phase -ne $script:lastPhase) {
            Write-Host "  [Phase $($entry.phase)]" -ForegroundColor DarkCyan
            $script:lastPhase = $entry.phase
        }
        $script:currentContext = $target
        return
    }

    # TaskUpdate — show as a completion mark
    if ($tool -eq "TaskUpdate") {
        Write-Host "  ✓ " -NoNewline -ForegroundColor Green
        Write-Host $target -ForegroundColor DarkGray
        return
    }

    # Agent spawn — special formatting
    if ($tool -eq "Agent") {
        Write-Host ""
        Write-Host "▶ " -NoNewline -ForegroundColor Magenta
        Write-Host "SPAWN " -NoNewline -ForegroundColor Magenta
        Write-Host $target -ForegroundColor White
        if ($entry.phase) {
            Write-Host "  [Phase $($entry.phase)]" -ForegroundColor DarkCyan
        }
        return
    }

    # Regular tool calls — indented under current context
    $targetDisplay = if ($target.Length -gt 90) {
        $target.Substring(0, 90) + "..."
    } else {
        $target
    }

    $color = if ($toolColors.ContainsKey($tool)) { $toolColors[$tool] } else { "Gray" }

    Write-Host "  $time " -NoNewline -ForegroundColor DarkGray
    Write-Host "$($tool.PadRight(8)) " -NoNewline -ForegroundColor $color
    Write-Host $targetDisplay -ForegroundColor Gray
}

# Show the last 30 entries as history (so user sees context when they start)
try {
    $recent = Get-Content $logPath -Tail 30 -ErrorAction SilentlyContinue
    Write-Host "--- Recent activity ---" -ForegroundColor DarkGray
    foreach ($line in $recent) {
        try {
            $entry = $line | ConvertFrom-Json
            Format-Entry $entry
        } catch {}
    }
    Write-Host ""
    Write-Host "--- Live feed (waiting for new activity) ---" -ForegroundColor Yellow
    Write-Host ""
} catch {}

# Stream new entries live
Get-Content $logPath -Wait -Tail 0 | ForEach-Object {
    try {
        $entry = $_ | ConvertFrom-Json
        Format-Entry $entry
    } catch {
        # Ignore malformed lines
    }
}
