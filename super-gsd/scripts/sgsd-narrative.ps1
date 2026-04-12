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
    [int]$HaikuRefreshSec = 300
)

$ErrorActionPreference = "SilentlyContinue"

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

function Trunc($text, $width) {
    if ($null -eq $text) { return "" }
    $text = "$text"
    if ($text.Length -gt $width) { return $text.Substring(0, [Math]::Max(1, $width - 2)) + ".." }
    return $text
}

# Encode a project directory the way Claude Code does for its session index:
# replace path separators with dashes, drop drive colon.
#   C:\Users\jack.berrow\project-clarity-erp  →  C--Users-jack-berrow-project-clarity-erp
function Encode-ProjectPath($path) {
    # Claude Code encoding: colon, backslash, forward-slash, AND dot all become
    # dashes. The drive-letter colon + backslash produces the double-dash prefix:
    #   C:\Users\jack.berrow\project-clarity-erp  ->  C--Users-jack-berrow-project-clarity-erp
    # DO NOT collapse consecutive dashes — the double dash after the drive
    # letter is meaningful and must be preserved.
    # Strip trailing path separators first — otherwise a trailing backslash from
    # tab completion turns into an extra dash and the real dir never matches.
    $p = "$path".TrimEnd([char]92, [char]47)
    return $p -replace '[:\\/.]', '-'
}

function Get-ActiveSessionJsonl {
    $encoded = Encode-ProjectPath $ProjectDir
    $sessionsDir = Join-Path $HOME ".claude\projects\$encoded"
    if (-not (Test-Path $sessionsDir)) { return $null }
    try {
        $file = Get-ChildItem -Path $sessionsDir -Filter "*.jsonl" -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
        return $file
    } catch { return $null }
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
    switch ($tool) {
        "Read"     { if ($inp.file_path)  { $s = Split-Path $inp.file_path -Leaf } }
        "Write"    { if ($inp.file_path)  { $s = (Split-Path $inp.file_path -Leaf) + " (" + ("$($inp.content)".Length) + " chars)" } }
        "Edit"     { if ($inp.file_path)  { $s = Split-Path $inp.file_path -Leaf } }
        "Bash"     { if ($inp.command)    { $s = "$($inp.command)" } }
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
    switch ($tool) {
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

function Render-Header {
    param($ts)
    Write-Host "SUPER GSD" -NoNewline -ForegroundColor Magenta
    Write-Host " ~ " -NoNewline -ForegroundColor Yellow
    Write-Host "Narrative + Ctrl+O" -NoNewline -ForegroundColor White
    Write-Host "  $ts" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE
}

function Render-HaikuSummary {
    param($pw)
    Write-Host "> " -NoNewline -ForegroundColor Magenta
    Write-Host "CURRENT STATUS " -NoNewline -ForegroundColor White
    if (Test-Path $NarrativeCache) {
        $age = [int]((Get-Date) - (Get-Item $NarrativeCache).LastWriteTime).TotalSeconds
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
    $sessionFile = Get-ActiveSessionJsonl
    Write-Host "CTRL+O LIVE TOOL STREAM " -NoNewline -ForegroundColor White
    if ($null -eq $sessionFile) {
        Write-Host "(no session file found)$CLEAR_LINE" -ForegroundColor DarkGray
        return
    }
    Write-Host "(" -NoNewline -ForegroundColor DarkGray
    Write-Host "$($sessionFile.Name.Substring(0, 8))" -NoNewline -ForegroundColor Cyan
    Write-Host ")" -NoNewline -ForegroundColor DarkGray
    Write-Host $CLEAR_LINE

    $entries = Read-LastJsonlEntries $sessionFile 60
    $tools = Get-ToolEntries $entries
    if ($tools.Count -eq 0) {
        Write-Host "(no tool calls in recent session entries)$CLEAR_LINE" -ForegroundColor DarkGray
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
        $summary = Summarize-ToolInput $t.tool $t.inp
        $summary = Trunc ($summary -replace '\s+', ' ') ($pw - 22)
        Write-Host $tsStr -NoNewline -ForegroundColor DarkGray
        Write-Host " " -NoNewline
        Write-Host $toolPad -NoNewline -ForegroundColor $color
        Write-Host " " -NoNewline
        Write-Host $summary -NoNewline -ForegroundColor Gray
        Write-Host $CLEAR_LINE
    }
}

function Maybe-RefreshHaiku {
    # Regenerates NarrativeCache via `claude --print` when:
    #   1. The cache is older than $HaikuRefreshSec, OR
    #   2. The cache doesn't exist yet
    # AND the activity-log hash differs from what produced the cached summary.
    # Runs in the background (fire-and-forget spawn) so the pane never blocks.
    if (-not (Test-Path $ActivityLog)) { return }

    $needsRefresh = $false
    if (-not (Test-Path $NarrativeCache)) {
        $needsRefresh = $true
    } else {
        $age = [int]((Get-Date) - (Get-Item $NarrativeCache).LastWriteTime).TotalSeconds
        if ($age -ge $HaikuRefreshSec) { $needsRefresh = $true }
    }
    if (-not $needsRefresh) { return }

    # Guard: don't spawn a second Haiku call if one is already running
    $lockFile = "$NarrativeCache.lock"
    if (Test-Path $lockFile) {
        $lockAge = [int]((Get-Date) - (Get-Item $lockFile).LastWriteTime).TotalSeconds
        if ($lockAge -lt 120) { return }   # stale lock after 2min
    }
    New-Item -Path $lockFile -ItemType File -Force | Out-Null

    try {
        # Pull last 20 activity lines as context
        $lines = Get-Content $ActivityLog -Tail 20 -ErrorAction SilentlyContinue
        if (-not $lines) { Remove-Item $lockFile -Force; return }
        $snippet = @()
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                $target = "$($e.target)"
                if ($target.Length -gt 120) { $target = $target.Substring(0, 120) + "..." }
                $snippet += "$($e.tool): $target"
            } catch {}
        }
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

        # Pipe prompt via stdin to claude, capture stdout, write atomically
        # to cache. Route through cmd.exe /c so Windows resolves the claude.cmd
        # wrapper via PATHEXT (same fix we made to phase-verifier).
        # Blocking call with 25s timeout — pane freezes briefly once every 5 min at worst.
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "cmd.exe"
        $psi.Arguments = '/c claude --print --dangerously-skip-permissions --model claude-haiku-4-5-20251001'
        $psi.RedirectStandardInput = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        try {
            $p = [System.Diagnostics.Process]::Start($psi)
        } catch {
            # Log the failure so we can see it in the cache file itself
            Set-Content -Path $NarrativeCache -Value ("Haiku refresh failed to start claude: " + $_.Exception.Message) -Encoding utf8
            return
        }
        $p.StandardInput.Write($prompt)
        $p.StandardInput.Close()
        if ($p.WaitForExit(25000)) {
            $stdout = $p.StandardOutput.ReadToEnd()
            $stderr = $p.StandardError.ReadToEnd()
            if ($stdout -and $stdout.Trim().Length -gt 20) {
                Set-Content -Path $NarrativeCache -Value $stdout.Trim() -Encoding utf8
            } elseif ($stderr) {
                Set-Content -Path $NarrativeCache -Value ("claude --print returned no output. stderr: " + $stderr.Trim()) -Encoding utf8
            }
        } else {
            try { $p.Kill() } catch {}
            Set-Content -Path $NarrativeCache -Value "Haiku refresh timed out after 25s" -Encoding utf8
        }
    } catch {
        try { Set-Content -Path $NarrativeCache -Value ("Haiku refresh exception: " + $_.Exception.Message) -Encoding utf8 } catch {}
    } finally {
        Remove-Item $lockFile -Force -ErrorAction SilentlyContinue
    }
}

function Render {
    Write-Host $HOME_POS -NoNewline
    $pw = Get-PaneWidth
    $ph = Get-PaneHeight
    $ts = Get-Date -Format 'HH:mm:ss'

    # Kick off a Haiku refresh in the background if the cache is stale.
    # Non-blocking — pane continues to render the old cache while Haiku runs.
    Maybe-RefreshHaiku

    Render-Header $ts
    Write-Host $CLEAR_LINE
    Render-HaikuSummary $pw
    Write-Host $CLEAR_LINE

    # Remaining space goes to Ctrl+O stream (min 4 rows)
    $used = 14
    $ctrlOBudget = [Math]::Max(4, $ph - $used)
    Render-CtrlOStream $pw $ctrlOBudget

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
    $null = Register-ObjectEvent -InputObject $w2 -EventName Created -Action { $global:needsRedraw = $true }
}

$lastHeartbeat = [DateTime]::MinValue
$HeartbeatSec = 10

try {
    while ($true) {
        if ($global:needsRedraw -or (((Get-Date) - $lastHeartbeat).TotalSeconds -ge $HeartbeatSec)) {
            $global:needsRedraw = $false
            $lastHeartbeat = Get-Date
            Render
        }
        Start-Sleep -Milliseconds 250
    }
} finally {
    Write-Host "$SHOW_CURSOR$ALT_EXIT" -NoNewline
}
