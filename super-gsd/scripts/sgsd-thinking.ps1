# Super GSD Thinking Feed
# Shows Claude's actual text output (thinking, reasoning, explanations) in real time.
# Reads Claude Code's session JSONL files - the same ones Claude writes as it talks.
#
# This gives you the "watch Opus think out loud" view that GSD 2.0 / Pi used to have.
#
# Usage:
#   .\sgsd-thinking.ps1                                # auto-detects clarity-erp
#   .\sgsd-thinking.ps1 -Project project-clarity-erp   # specific project
#
# How it works:
# 1. Finds the most recent session JSONL file for the project
# 2. Reads the history (last 50 messages) to show context
# 3. Streams new lines as Claude writes them
# 4. Filters for assistant text blocks (ignoring tool calls - those are in the activity feed)

param(
    [string]$Project = "project-clarity-erp"
)

# Convert project name to Claude Code's session folder format
# C:\Users\user\project-clarity-erp -> C--Users-user-project-clarity-erp
$sessionRoot = "$env:USERPROFILE\.claude\projects"
$projectSlug = "C--Users-user-$Project"
$projectDir = Join-Path $sessionRoot $projectSlug

if (-not (Test-Path $projectDir)) {
    Write-Host "No session directory found: $projectDir" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available projects:" -ForegroundColor Yellow
    Get-ChildItem $sessionRoot -Directory | ForEach-Object {
        $name = $_.Name -replace "^C--Users-user-", ""
        Write-Host "  $name" -ForegroundColor Gray
    }
    exit 1
}

# Find the most recent .jsonl file (most recent = active session)
$latestFile = Get-ChildItem $projectDir -Filter "*.jsonl" -File |
              Sort-Object LastWriteTime -Descending |
              Select-Object -First 1

if (-not $latestFile) {
    Write-Host "No session files in $projectDir" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "         SUPER GSD -- CLAUDE THINKING FEED                      " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Project: $Project" -ForegroundColor DarkGray
Write-Host "Session: $($latestFile.Name)" -ForegroundColor DarkGray
Write-Host "Ctrl+C to stop" -ForegroundColor DarkGray
Write-Host ""

function Show-Message {
    param($line)

    try {
        $entry = $line | ConvertFrom-Json
        $msgType = $entry.type

        if ($msgType -eq "assistant") {
            $content = $entry.message.content
            if ($null -eq $content) { return }

            foreach ($block in $content) {
                if ($block.type -eq "text") {
                    $text = $block.text
                    if ($text -and $text.Trim().Length -gt 0) {
                        Write-Host ""
                        Write-Host "--- CLAUDE ---" -ForegroundColor Yellow
                        Write-Host $text -ForegroundColor White
                    }
                }
                elseif ($block.type -eq "thinking") {
                    $text = $block.thinking
                    if ($text -and $text.Trim().Length -gt 0) {
                        Write-Host ""
                        Write-Host "--- THINKING ---" -ForegroundColor Magenta
                        Write-Host $text -ForegroundColor DarkMagenta
                    }
                }
                elseif ($block.type -eq "tool_use") {
                    $name = $block.name
                    Write-Host "  [$name]" -NoNewline -ForegroundColor DarkCyan
                    if ($block.input.description) {
                        Write-Host " $($block.input.description)" -ForegroundColor DarkGray
                    } elseif ($block.input.file_path) {
                        Write-Host " $($block.input.file_path)" -ForegroundColor DarkGray
                    } elseif ($block.input.command) {
                        $cmd = $block.input.command
                        if ($cmd.Length -gt 80) { $cmd = $cmd.Substring(0, 80) + "..." }
                        Write-Host " $cmd" -ForegroundColor DarkGray
                    } else {
                        Write-Host ""
                    }
                }
            }
        }
        elseif ($msgType -eq "user") {
            # Only show actual user messages, not tool results
            $content = $entry.message.content
            if ($content -is [string]) {
                Write-Host ""
                Write-Host "=== YOU ===" -ForegroundColor Green
                Write-Host $content -ForegroundColor Gray
            }
            elseif ($content -is [array]) {
                foreach ($block in $content) {
                    if ($block.type -eq "text") {
                        Write-Host ""
                        Write-Host "=== YOU ===" -ForegroundColor Green
                        Write-Host $block.text -ForegroundColor Gray
                    }
                }
            }
        }
    } catch {
        # Ignore malformed lines
    }
}

# Show last 50 messages as context
Write-Host "--- Recent session ---" -ForegroundColor DarkGray
$recent = Get-Content $latestFile.FullName -Tail 50 -ErrorAction SilentlyContinue
foreach ($line in $recent) {
    Show-Message $line
}

Write-Host ""
Write-Host "--- Live (waiting for Claude) ---" -ForegroundColor Yellow
Write-Host ""

# Stream new lines
Get-Content $latestFile.FullName -Wait -Tail 0 | ForEach-Object {
    Show-Message $_
}
