# sgsd-watch-codex.ps1
# Follow live Codex stdout/stderr for the current SGSD project.

param(
    [string]$ProjectDir = (Get-Location).Path,
    [switch]$OpenWindow,
    [switch]$Foreground,
    [switch]$Narrate,
    [int]$PollMs = 150,
    [int]$TailLines = 100,
    [int]$NarrateSec = 60,
    [int]$ChunkChars = 6000,
    [int]$NarratorTimeoutSec = 120,
    [int]$NarratorWidth = 112,
    [switch]$NarrateWorker,
    [string]$WorkerChunkFile = '',
    [string]$WorkerContextFile = '',
    [string]$WorkerResultFile = '',
    [string]$WorkerProjectName = '',
    [string]$WorkerHash = '',
    [int]$WorkerDisplayWidth = 96
)

try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

$ESC = [char]27
$HOME_POS    = "$ESC[H"
$CLEAR_BELOW = "$ESC[0J"
$HIDE_CURSOR = "$ESC[?25l"
$SHOW_CURSOR = "$ESC[?25h"

function Test-SgsdWindowsHost {
    return ($env:OS -eq 'Windows_NT' -or $PSVersionTable.PSEdition -eq 'Desktop' -or $IsWindows)
}

function Resolve-SgsdProjectRoot {
    param([string]$StartDir)

    try {
        $current = (Resolve-Path -LiteralPath $StartDir -ErrorAction Stop).Path
    } catch {
        $current = (Get-Location).Path
    }

    while ($current -and (Test-Path -LiteralPath $current)) {
        if (Test-Path -LiteralPath (Join-Path $current '.planning')) {
            return $current
        }
        $parent = Split-Path -Parent $current
        if (-not $parent -or $parent -eq $current) { break }
        $current = $parent
    }

    return $null
}

function Quote-PowerShellLiteral {
    param([string]$Value)
    return "'" + ($Value -replace "'", "''") + "'"
}

function Get-CodexLineColor {
    param([string]$Line)
    if (-not $Line) { return 'DarkGray' }
    switch -Regex ($Line) {
        '^=+$' { return 'DarkGray' }
        '^codex-(executor|review) START\b' { return 'Cyan' }
        '^codex-(executor|review) END\b.*exit=0\b' { return 'Green' }
        '^codex-(executor|review) END\b.*exit=(5|124)\b' { return 'Yellow' }
        '^codex-(executor|review) END\b.*exit=[1-9]' { return 'Red' }
        '^(model|workspace|project)=' { return 'DarkGray' }
        '^BLOCKERS:' { return 'Red' }
        '^VERIFICATION:' { return 'Cyan' }
        '^DEVIATIONS:' { return 'Yellow' }
        '^FILES_CHANGED:|^SCRIPTS_CREATED:' { return 'White' }
        '^ONE_LINER:' { return 'Green' }
        '^diff --git ' { return 'Magenta' }
        '^index ' { return 'DarkGray' }
        '^@@' { return 'Cyan' }
        '^\+\+\+ |^--- ' { return 'Blue' }
        '^\+' { return 'Green' }
        '^-' { return 'Red' }
        '\b(exit 0|PASS|OK)\b' { return 'Green' }
        '\b(FAIL|FAILED|ERROR|Traceback|Exception|CRITICAL|BLOCKER)\b' { return 'Red' }
        '\b(WARN|WARNING|warning|Deviation|DEVIATION)\b' { return 'Yellow' }
        default { return 'Gray' }
    }
}

function Write-CodexLine {
    param([string]$Line)
    Write-Host $Line -ForegroundColor (Get-CodexLineColor $Line)
}

function Get-CodexPaneWidth {
    try {
        $width = [Console]::WindowWidth
    } catch {
        $width = 100
    }
    if ($width -lt 20) { $width = 100 }
    return [Math]::Max(36, $width - 2)
}

function Get-NarratorContentLayout {
    $detectedPaneWidth = Get-CodexPaneWidth
    $targetWidth = [Math]::Max(72, [Math]::Min($NarratorWidth, 140))

    # SSH/PowerShell can report a stale narrow console width after Windows Terminal
    # splits panes. Prefer the configured target so Haiku does not hard-wrap at
    # 40-50 columns while the pane has usable space.
    $paneWidth = [Math]::Max($detectedPaneWidth, $targetWidth)
    $contentWidth = [Math]::Min(140, $paneWidth)
    $leftPad = 0

    return [pscustomobject]@{
        PaneWidth    = $paneWidth
        ContentWidth = $contentWidth
        LeftPad      = $leftPad
        Pad          = (' ' * $leftPad)
    }
}

function Get-WrapPrefix {
    param([string]$Line)

    if ($Line -match '^(\s*[-*]\s+)') {
        return ' ' * $matches[1].Length
    }
    if ($Line -match '^([A-Z][A-Z0-9 _-]*:\s*)') {
        return ' ' * $matches[1].Length
    }
    if ($Line -match '^(\s+)') {
        return $matches[1]
    }
    return ''
}

function Split-WrappedText {
    param(
        [string]$Text,
        [int]$Width
    )

    if ($null -eq $Text) { return @('') }
    if ($Text.Length -le $Width) { return @($Text) }

    $continuationPrefix = Get-WrapPrefix -Line $Text
    $lines = New-Object System.Collections.Generic.List[string]
    $remaining = $Text.TrimEnd()
    $prefix = ''
    $currentWidth = $Width

    while ($remaining.Length -gt $currentWidth) {
        $take = [Math]::Min($remaining.Length, $currentWidth)
        $slice = $remaining.Substring(0, $take)
        $breakAt = -1
        for ($i = $slice.Length - 1; $i -gt 0; $i--) {
            if ([char]::IsWhiteSpace($slice[$i])) {
                $breakAt = $i
                break
            }
        }

        if ($breakAt -lt 12) {
            $breakAt = $take
        }

        $part = $remaining.Substring(0, $breakAt).TrimEnd()
        if ($part.Length -gt 0) {
            $lines.Add($prefix + $part)
        }

        $remaining = $remaining.Substring($breakAt).TrimStart()
        $prefix = $continuationPrefix
        $currentWidth = [Math]::Max(12, $Width - $prefix.Length)
    }

    if ($remaining.Length -gt 0) {
        $lines.Add($prefix + $remaining)
    }

    return $lines.ToArray()
}

function Test-NarratorDiagramLine {
    param([string]$Line)
    if (-not $Line) { return $false }
    return ($Line -match '^\s*(\+[-+]+\+?|[|]|v$|V$|/|\\|[-=]+>|<[-=]+|\[[^\]]+\])')
}

function Write-WrappedNarratorLine {
    param(
        [string]$Line,
        [string]$Color,
        [int]$Width,
        [string]$Pad = ''
    )

    foreach ($wrapped in (Split-WrappedText -Text $Line -Width $Width)) {
        Write-Host ($Pad + $wrapped) -ForegroundColor $Color
    }
}

function Write-NarratorHeader {
    param(
        [string]$ProjectName,
        $Layout
    )

    $time = Get-Date -Format 'HH:mm:ss'
    $line = "SGSD Codex Narrator  $ProjectName  $time"
    $padLen = [int][Math]::Floor(($Layout.PaneWidth - $line.Length) / 2)
    if ($padLen -lt 0) { $padLen = $Layout.LeftPad }

    Write-Host (' ' * $padLen) -NoNewline
    Write-Host "SGSD Codex Narrator" -ForegroundColor Magenta -NoNewline
    Write-Host "  $ProjectName" -ForegroundColor Yellow -NoNewline
    Write-Host "  $time" -ForegroundColor DarkGray
}

function Get-FirstMatch {
    param(
        [string]$Text,
        [string]$Pattern
    )
    if ($Text -match $Pattern) { return $matches[1].Trim().Trim('"', "'") }
    return ''
}

function Get-PlanIdFromCodexChunk {
    param([string]$RawChunk)
    if ($RawChunk -match '\bplan=(\d{2,4}-\d{2,3})\b') { return $matches[1] }
    if ($RawChunk -match '[\\/](\d{2,4}-\d{2,3})-[A-Z0-9][^\\/]*?(?:CODEX|EXECUTOR|REPORT|PLAN)') { return $matches[1] }
    return ''
}

function Get-SgsdNarratorContext {
    param(
        [string]$ProjectRoot,
        [string]$RawChunk
    )

    $planningDir = Join-Path $ProjectRoot '.planning'
    $statePath = Join-Path $planningDir 'STATE.md'
    $stateText = ''
    if (Test-Path -LiteralPath $statePath) {
        try { $stateText = (Get-Content -LiteralPath $statePath -TotalCount 80 -Encoding UTF8 -ErrorAction Stop) -join "`n" } catch {}
    }

    $milestone = Get-FirstMatch -Text $stateText -Pattern '(?m)^milestone:\s*(.+)$'
    $milestoneName = Get-FirstMatch -Text $stateText -Pattern '(?m)^milestone_name:\s*(.+)$'
    $phase = Get-FirstMatch -Text $stateText -Pattern '(?m)^current_phase:\s*(.+)$'
    $statePlan = Get-FirstMatch -Text $stateText -Pattern '(?m)^current_plan:\s*(.+)$'
    $planId = Get-PlanIdFromCodexChunk -RawChunk $RawChunk
    if (-not $planId -and $statePlan -match '(\d{2,4}-\d{2,3})') { $planId = $matches[1] }

    $planPath = ''
    if ($planId -and (Test-Path -LiteralPath $planningDir)) {
        try {
            $planHit = Get-ChildItem -LiteralPath $planningDir -Recurse -File -Filter "$planId-PLAN.md" -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                Select-Object -First 1
            if ($planHit) { $planPath = $planHit.FullName }
        } catch {}
    }

    $phaseName = ''
    $planGoal = ''
    $planTitle = ''
    if ($planPath) {
        $parentLeaf = Split-Path -Leaf (Split-Path -Parent $planPath)
        if ($parentLeaf -match '^\d+-(.+)$') { $phaseName = ($matches[1] -replace '-', ' ') }
        try {
            $planText = Get-Content -LiteralPath $planPath -Raw -Encoding UTF8 -ErrorAction Stop
            $planTitle = Get-FirstMatch -Text $planText -Pattern '(?m)^#\s+(.+)$'
            $planGoal = Get-FirstMatch -Text $planText -Pattern '(?m)^goal:\s*"(.+)"\s*$'
            if (-not $planGoal) {
                $planGoal = Get-FirstMatch -Text $planText -Pattern '(?ms)^## Goal\s+(.+?)(?:\n## |\z)'
                $planGoal = ($planGoal -replace '\s+', ' ').Trim()
            }
            if ($planGoal.Length -gt 900) { $planGoal = $planGoal.Substring(0, 900) + '...' }
        } catch {}
    }

    $lines = New-Object System.Collections.Generic.List[string]
    if ($milestone -or $milestoneName) { $lines.Add("Milestone: $milestone $milestoneName".Trim()) }
    if ($phase -or $phaseName) { $lines.Add("Active phase: $phase $phaseName".Trim()) }
    if ($planId -or $planTitle) { $lines.Add("Active plan: $planId $planTitle".Trim()) }
    if ($statePlan) { $lines.Add("STATE current_plan: $statePlan") }
    if ($planGoal) { $lines.Add("Plan goal: $planGoal") }
    $lines.Add('Narrator obligation: always explain how current files/tests/hooks advance the active phase and Quote Trust Engine. A PreToolUse hook test matters because it proves quote-post Bash calls are blocked/approved by the same quote gate engine before a bad quote reaches SAP.')

    return ($lines.ToArray() -join "`n")
}

function Get-SignificantRawLine {
    param([string]$RawChunk)

    $lines = @($RawChunk -split "`r?`n")
    for ($i = $lines.Count - 1; $i -ge 0; $i--) {
        $candidate = "$($lines[$i])".Trim()
        if (-not $candidate) { continue }
        if ($candidate -match '^[+=-]{3,}$') { continue }
        if ($candidate -match '^codex-executor (START|END)\b') { continue }
        if ($candidate -match '^(model|workspace|provider|approval|sandbox|reasoning effort|session id):') { continue }
        if ($candidate.Length -gt 140) { $candidate = $candidate.Substring(0, 140) + '...' }
        return $candidate
    }
    return 'raw Codex output is updating'
}

function Get-RecentRawFiles {
    param([string]$RawChunk)

    $hits = New-Object System.Collections.Generic.List[string]
    $matches = [regex]::Matches($RawChunk, '[A-Za-z0-9_.\\/:-]+\.(?:py|json|ya?ml|md|sh|txt)')
    foreach ($m in $matches) {
        $v = "$($m.Value)".Trim().Trim('"', "'", '`', ',', ';', ')', '(')
        if (-not $v) { continue }
        $v = $v -replace '\\', '/'
        if ($hits -notcontains $v) { $hits.Add($v) }
    }

    if ($hits.Count -eq 0) { return @() }
    $start = [Math]::Max(0, $hits.Count - 5)
    return @($hits.ToArray()[$start..($hits.Count - 1)])
}

function New-NarratorRawFallbackSummary {
    param(
        [string]$ProjectContext,
        [string]$RawChunk
    )

    $planId = Get-PlanIdFromCodexChunk -RawChunk $RawChunk
    $phase = ''
    if ($RawChunk -match '\bphase=([0-9]+)\b') { $phase = $matches[1] }
    if (-not $phase -and $ProjectContext -match '(?m)^Active phase:\s*([0-9]+)') { $phase = $matches[1] }

    $planGoal = Get-FirstMatch -Text $ProjectContext -Pattern '(?m)^Plan goal:\s*(.+)$'
    if ($planGoal.Length -gt 220) { $planGoal = $planGoal.Substring(0, 220) + '...' }
    $rawNow = Get-SignificantRawLine -RawChunk $RawChunk
    $files = @(Get-RecentRawFiles -RawChunk $RawChunk)
    $scope = if ($phase -and $planId) { "P$phase / $planId" } elseif ($phase) { "P$phase" } elseif ($planId) { $planId } else { "current plan" }

    $risk = 'Haiku narrator is late; raw stream remains authoritative.'
    if ($RawChunk -match '(?i)\b(timeout|failed|error|traceback|exception|denied|blocker)\b') {
        $risk = 'Raw output includes failure/error/timeout language; check raw pane if this persists.'
    }

    $summary = New-Object System.Collections.Generic.List[string]
    $summary.Add("STATUS: Codex is running $scope; Haiku narrator is out of sync.")
    $summary.Add('VISUAL:')
    $summary.Add('+------------------+')
    $summary.Add('| SGSD orchestrator|')
    $summary.Add('+------------------+')
    $summary.Add('        v')
    $summary.Add('+------------------+')
    $summary.Add('| Codex executor   |')
    $summary.Add('+------------------+')
    $summary.Add('        v')
    $summary.Add('+------------------+')
    $summary.Add('| Raw stream live  |')
    $summary.Add('+------------------+')
    $summary.Add('ELI5:')
    $summary.Add("- Haiku did not return a summary quickly, but Codex output is still updating.")
    $summary.Add("- Latest raw line: $rawNow")
    $summary.Add('PHASE WHY:')
    if ($planGoal) {
        $summary.Add("- Active plan goal: $planGoal")
    } else {
        $summary.Add('- This work belongs to the current SGSD phase; raw output is live while Haiku catches up.')
    }
    $summary.Add('- This fallback is local: it preserves visibility until Haiku produces a proper phase-aware explanation.')
    $summary.Add('FILES:')
    if ($files.Count -gt 0) {
        foreach ($f in $files) { $summary.Add("- $f") }
    } else {
        $summary.Add('- No filename extracted from the latest raw chunk.')
    }
    $summary.Add('RISKS:')
    $summary.Add("- $risk")
    $summary.Add('NEXT:')
    $summary.Add('- Haiku will retry on the next refresh; keep using the raw pane for exact live detail.')

    return ($summary.ToArray() -join "`n")
}

function Resolve-ClaudeNarratorExecutable {
    if ($IsWindows -and $env:APPDATA) {
        $direct = Join-Path $env:APPDATA 'npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe'
        if ($direct -and (Test-Path -LiteralPath $direct)) {
            return $direct
        }
    }

    if (Test-SgsdWindowsHost) {
        $cmd = Get-Command claude.cmd -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source) {
            return $cmd.Source
        }
    }

    $plain = Get-Command claude -ErrorAction SilentlyContinue
    if ($plain -and $plain.Source) {
        return $plain.Source
    }

    return 'claude'
}

function Resolve-PowerShellWorkerExecutable {
    if (Test-SgsdWindowsHost) {
        $cmd = Get-Command powershell.exe -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source) { return $cmd.Source }
        return 'powershell.exe'
    }

    $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
    if ($pwsh -and $pwsh.Source) { return $pwsh.Source }

    $shim = Get-Command powershell.exe -ErrorAction SilentlyContinue
    if ($shim -and $shim.Source) { return $shim.Source }

    return 'pwsh'
}

function Start-SgsdBackgroundProcess {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string[]]$ArgumentList,
        [ValidateSet('Hidden', 'Normal', 'Minimized')][string]$WindowStyle = 'Hidden',
        [switch]$PassThru
    )

    $params = @{
        FilePath     = $FilePath
        ArgumentList = $ArgumentList
    }
    if (Test-SgsdWindowsHost) {
        $params.WindowStyle = $WindowStyle
    }
    if ($PassThru) {
        $params.PassThru = $true
    }

    Start-Process @params
}

function Get-SgsdTextHash {
    param([string]$Text)
    if ($null -eq $Text) { $Text = '' }
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes)) -replace '-', '').ToLowerInvariant()
    } finally {
        $sha.Dispose()
    }
}

function Get-NarratorRelayPaths {
    param([string]$MetricsDir)
    return [pscustomobject]@{
        Chunk   = Join-Path $MetricsDir 'codex-eli5-relay.chunk.txt'
        Context = Join-Path $MetricsDir 'codex-eli5-relay.context.txt'
        Result  = Join-Path $MetricsDir 'codex-eli5-relay.result.json'
        Pid     = Join-Path $MetricsDir 'codex-eli5-relay.pid.json'
    }
}

function Read-NarratorRelayResult {
    param(
        [string]$ResultPath,
        [string]$ExpectedHash
    )
    if (-not (Test-Path -LiteralPath $ResultPath)) { return $null }
    try {
        $result = Get-Content -LiteralPath $ResultPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($result.hash -and $result.hash -eq $ExpectedHash) { return $result }
    } catch {}
    return $null
}

function Get-NarratorRelayActive {
    param([string]$PidPath)
    if (-not (Test-Path -LiteralPath $PidPath)) {
        return [pscustomobject]@{ Active = $false; ProcessId = 0; Hash = ''; AgeSec = 0 }
    }

    try {
        $state = Get-Content -LiteralPath $PidPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $proc = Get-Process -Id ([int]$state.pid) -ErrorAction SilentlyContinue
        if ($proc) {
            $started = [datetime]::Parse($state.started_at).ToUniversalTime()
            $age = [int](([datetime]::UtcNow - $started).TotalSeconds)
            return [pscustomobject]@{ Active = $true; ProcessId = [int]$state.pid; Hash = [string]$state.hash; AgeSec = $age }
        }
    } catch {}

    return [pscustomobject]@{ Active = $false; ProcessId = 0; Hash = ''; AgeSec = 0 }
}

function Start-NarratorRelay {
    param(
        [string]$ScriptPath,
        [object]$RelayPaths,
        [string]$ProjectName,
        [string]$Context,
        [string]$Chunk,
        [string]$Hash,
        [int]$DisplayWidth,
        [int]$TimeoutSec
    )

    Set-Content -LiteralPath $RelayPaths.Chunk -Value $Chunk -Encoding UTF8
    Set-Content -LiteralPath $RelayPaths.Context -Value $Context -Encoding UTF8

    $args = @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $ScriptPath,
        '-NarrateWorker',
        '-WorkerChunkFile', $RelayPaths.Chunk,
        '-WorkerContextFile', $RelayPaths.Context,
        '-WorkerResultFile', $RelayPaths.Result,
        '-WorkerProjectName', $ProjectName,
        '-WorkerHash', $Hash,
        '-WorkerDisplayWidth', "$DisplayWidth",
        '-NarratorWidth', "$DisplayWidth",
        '-NarratorTimeoutSec', "$TimeoutSec"
    )

    $proc = Start-SgsdBackgroundProcess -FilePath (Resolve-PowerShellWorkerExecutable) -ArgumentList $args -WindowStyle Hidden -PassThru
    $state = [pscustomobject]@{
        pid        = $proc.Id
        hash       = $Hash
        started_at = [datetime]::UtcNow.ToString('o')
    }
    Set-Content -LiteralPath $RelayPaths.Pid -Value ($state | ConvertTo-Json -Depth 4) -Encoding UTF8
    return $proc
}

function Watch-CodexLiveFile {
    param(
        [string]$Path,
        [int]$PollMs,
        [int]$TailLines
    )

    if ($TailLines -gt 0) {
        try {
            foreach ($line in (Get-Content -LiteralPath $Path -Tail $TailLines -Encoding UTF8 -ErrorAction SilentlyContinue)) {
                Write-CodexLine "$line"
            }
        } catch {}
    }

    $offset = 0L
    try { $offset = (Get-Item -LiteralPath $Path -ErrorAction Stop).Length } catch {}
    $partial = ''
    $encoding = New-Object System.Text.UTF8Encoding($false, $false)

    while ($true) {
        try {
            $item = Get-Item -LiteralPath $Path -ErrorAction Stop
            if ($item.Length -lt $offset) {
                $offset = 0L
                $partial = ''
            }

            if ($item.Length -gt $offset) {
                $count = [int]($item.Length - $offset)
                $fs = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
                try {
                    $fs.Seek($offset, [System.IO.SeekOrigin]::Begin) | Out-Null
                    $buffer = New-Object byte[] $count
                    $read = $fs.Read($buffer, 0, $count)
                    if ($read -gt 0) {
                        $offset += $read
                        $chunk = $partial + $encoding.GetString($buffer, 0, $read)
                        $parts = [regex]::Split($chunk, "\r?\n")
                        $completeCount = $parts.Count - 1
                        for ($i = 0; $i -lt $completeCount; $i++) {
                            Write-CodexLine $parts[$i]
                        }
                        $partial = $parts[$parts.Count - 1]
                    }
                } finally {
                    $fs.Dispose()
                }
            }
        } catch {
            Write-Host "sgsd-watch-codex: waiting for live file..." -ForegroundColor DarkYellow
        }
        Start-Sleep -Milliseconds ([Math]::Max(50, $PollMs))
    }
}

function Invoke-HaikuNarrator {
    param(
        [string]$Chunk,
        [string]$ProjectName,
        [string]$ProjectContext = '',
        [int]$DisplayWidth = 96,
        [int]$TimeoutSec = 25
    )

    if (-not $Chunk -or $Chunk.Trim().Length -lt 20) {
        return [pscustomobject]@{ Ok = $false; Warning = 'OUT OF SYNC: waiting for enough Codex output; showing live local fallback'; Summary = '' }
    }

    # The narrator is a live dashboard, not a final audit. Keep prompts small so
    # Haiku either answers quickly or we fall back to a current local summary.
    if ($ProjectContext -and $ProjectContext.Length -gt 2600) {
        $ProjectContext = $ProjectContext.Substring(0, 2600) + "`n...[phase context truncated for live narrator]"
    }
    if ($Chunk -and $Chunk.Length -gt 3000) {
        $Chunk = $Chunk.Substring($Chunk.Length - 3000)
    }

    $safeWidth = [Math]::Max(72, [Math]::Min($DisplayWidth, 140))

    $prompt = @(
        'You are an ELI5 narrator for the operator watching Codex work live inside SGSD.',
        '',
        'Explain this recent Codex output in plain English. Do not pretend to know more',
        'than the log shows. Preserve exact filenames, test names, phase numbers, and',
        'blocking errors when present. Avoid generic reassurance.',
        '',
        'You must put the Codex work in the context of the active SGSD phase.',
        'Do not only say what changed. Explain why it matters to the phase goal,',
        'the Quote Trust Engine, and quote-generator safety. If Codex is writing',
        'a test/hook/module, explain which production failure it prevents.',
        '',
        "Every output line must fit within $safeWidth characters. Wrap prose yourself.",
        'Do not use Markdown tables or triple-backtick fences.',
        'VISUAL must be an architecture-style ASCII diagram with boxes, not a one-line',
        'arrow. Use +---+ box borders, | labels |, and vertical arrows. If space is',
        'tight, stack boxes vertically. Show the useful current flow: Codex action,',
        'files/tests/gates, blocker, and next step when visible.',
        '',
        'Return exactly this shape:',
        'STATUS: <one short line>',
        'VISUAL:',
        '+----------------------+',
        '| Codex action         |',
        '+----------------------+',
        '          v',
        '+----------------------+',
        '| Files / tests / gate |',
        '+----------------------+',
        '          v',
        '+----------------------+',
        '| Blocker or next step |',
        '+----------------------+',
        'ELI5:',
        '- <plain-English point 1>',
        '- <plain-English point 2>',
        '- <plain-English point 3>',
        'PHASE WHY:',
        '- <how this work advances the active phase / quote generator safety>',
        '- <what risk it reduces or what acceptance criterion it proves>',
        'FILES:',
        '- <file or area>: <what changed / was checked>',
        'RISKS:',
        '- <risk/blocker, or "none seen in this chunk">',
        'NEXT:',
        '- <what is likely happening next>',
        '',
        "Project: $ProjectName",
        '',
        'Active SGSD context:',
        '```text',
        $ProjectContext,
        '```',
        '',
        'Recent Codex output:',
        '```text',
        $Chunk,
        '```'
    ) -join "`n"

    try {
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = Resolve-ClaudeNarratorExecutable
        $psi.Arguments = '--print --dangerously-skip-permissions --model claude-haiku-4-5-20251001 --tools "" --strict-mcp-config --mcp-config "{\"mcpServers\":{}}" --no-session-persistence'
        $psi.RedirectStandardInput = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $p = [System.Diagnostics.Process]::Start($psi)
        $p.StandardInput.Write($prompt)
        $p.StandardInput.Close()
        $timeoutMs = [Math]::Max(8, $TimeoutSec) * 1000
        if (-not $p.WaitForExit($timeoutMs)) {
            try {
                Get-CimInstance Win32_Process -Filter "ParentProcessId=$($p.Id)" -ErrorAction SilentlyContinue |
                    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
                Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
                $null = $p.WaitForExit(2000)
            } catch {}
            return [pscustomobject]@{ Ok = $false; Warning = 'OUT OF SYNC: Claude Haiku timed out; showing live local fallback'; Summary = '' }
        }
        $stdout = $p.StandardOutput.ReadToEnd()
        $stderr = $p.StandardError.ReadToEnd()
        if ($stdout -and $stdout.Trim().Length -gt 20) {
            return [pscustomobject]@{ Ok = $true; Warning = ''; Summary = $stdout.Trim() }
        }
        if ($stderr) {
            $err = $stderr.Trim()
            if ($err.Length -gt 180) { $err = $err.Substring(0, 180) + '...' }
            return [pscustomobject]@{ Ok = $false; Warning = "OUT OF SYNC: narrator returned no summary ($err); showing live local fallback"; Summary = '' }
        }
    } catch {
        return [pscustomobject]@{ Ok = $false; Warning = "OUT OF SYNC: narrator unavailable ($($_.Exception.Message)); showing live local fallback"; Summary = '' }
    }
    return [pscustomobject]@{ Ok = $false; Warning = 'OUT OF SYNC: narrator produced no update; showing live local fallback'; Summary = '' }
}

function Write-NarratedPanel {
    param(
        [string]$Summary,
        [string]$ProjectName,
        [string]$LiveFile,
        [string]$State,
        [int]$ChunkLength,
        [string]$Warning = ''
    )

    Write-Host "$HIDE_CURSOR$HOME_POS" -NoNewline
    $layout = Get-NarratorContentLayout
    Write-NarratorHeader -ProjectName $ProjectName -Layout $layout
    Write-WrappedNarratorLine -Line "raw: $LiveFile" -Color 'DarkGray' -Width $layout.ContentWidth -Pad $layout.Pad
    Write-WrappedNarratorLine -Line "state: $State  chunk: $ChunkLength chars  refresh: ${NarrateSec}s" -Color 'DarkGray' -Width $layout.ContentWidth -Pad $layout.Pad
    if ($Warning) {
        Write-WrappedNarratorLine -Line $Warning -Color 'Yellow' -Width $layout.ContentWidth -Pad $layout.Pad
    }
    Write-Host ""

    foreach ($line in ($Summary -split "`r?`n")) {
        $color = switch -Regex ($line) {
            '^STATUS:' { 'Cyan'; break }
            '^VISUAL:' { 'Magenta'; break }
            '^ELI5:' { 'White'; break }
            '^PHASE WHY:' { 'Cyan'; break }
            '^FILES:' { 'Blue'; break }
            '^RISKS:' { 'Yellow'; break }
            '^NEXT:' { 'Green'; break }
            '^\s*-\s' { 'Gray'; break }
            '^\s*(\+[-+]+\+?|[|])' { 'Magenta'; break }
            '->|=>|\[|\]' { 'Magenta'; break }
            'fail|error|block|risk|timeout|critical' { 'Red'; break }
            'pass|ok|success|exit 0' { 'Green'; break }
            default { 'Gray' }
        }
        if (Test-NarratorDiagramLine -Line $line) {
            Write-WrappedNarratorLine -Line $line -Color $color -Width $layout.ContentWidth -Pad $layout.Pad
        } else {
            Write-WrappedNarratorLine -Line $line -Color $color -Width $layout.ContentWidth -Pad $layout.Pad
        }
    }
    Write-Host ""
    Write-WrappedNarratorLine -Line "Ctrl+C stops. Raw view: sgsd-watch-codex" -Color 'DarkGray' -Width $layout.ContentWidth -Pad $layout.Pad
    Write-Host $CLEAR_BELOW -NoNewline
    Write-Host $SHOW_CURSOR -NoNewline
}

if ($NarrateWorker) {
    try {
        $chunk = Get-Content -LiteralPath $WorkerChunkFile -Raw -Encoding UTF8 -ErrorAction Stop
        $context = Get-Content -LiteralPath $WorkerContextFile -Raw -Encoding UTF8 -ErrorAction Stop
        $projectName = if ($WorkerProjectName) { $WorkerProjectName } else { 'project' }
        $hash = if ($WorkerHash) { $WorkerHash } else { Get-SgsdTextHash -Text ($context + "`n---`n" + $chunk) }

        $result = Invoke-HaikuNarrator -Chunk $chunk -ProjectName $projectName -ProjectContext $context -DisplayWidth $WorkerDisplayWidth -TimeoutSec $NarratorTimeoutSec
        $payload = [pscustomobject]@{
            ok        = [bool]$result.Ok
            warning   = [string]$result.Warning
            summary   = [string]$result.Summary
            hash      = $hash
            chunk_len = $chunk.Length
            pid       = $PID
            ts        = [datetime]::UtcNow.ToString('o')
        }
    } catch {
        $payload = [pscustomobject]@{
            ok        = $false
            warning   = "OUT OF SYNC: narrator relay failed ($($_.Exception.Message)); showing live local fallback"
            summary   = ''
            hash      = $WorkerHash
            chunk_len = 0
            pid       = $PID
            ts        = [datetime]::UtcNow.ToString('o')
        }
    }

    if ($WorkerResultFile) {
        $tmp = "$WorkerResultFile.tmp.$PID"
        Set-Content -LiteralPath $tmp -Value ($payload | ConvertTo-Json -Depth 6) -Encoding UTF8
        Move-Item -LiteralPath $tmp -Destination $WorkerResultFile -Force
    }

    if ($payload.ok) { exit 0 }
    exit 2
}

function Watch-CodexNarrated {
    param(
        [string]$Path,
        [int]$NarrateSec,
        [int]$ChunkChars,
        [int]$NarratorTimeoutSec
    )

    $projectName = Split-Path -Leaf $root
    $scriptPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }
    $relayPaths = Get-NarratorRelayPaths -MetricsDir $metricsDir
    $lastSignature = ''
    $currentHash = ''
    $currentRaw = ''
    $currentContext = ''
    $currentFallback = ''
    $currentChunkLength = 0
    $currentDisplayWidth = (Get-NarratorContentLayout).ContentWidth
    $lastRenderedKey = ''
    $lastNarratorWarning = ''
    $lastRelayRequestedHash = ''
    $lastRelayRequestedAt = [datetime]::MinValue
    $lastSummary = "STATUS: waiting for Codex output`nVISUAL:`n+------+`n| SGSD |`n+------+`n   v`n+-------+`n| Codex |`n+-------+`n   v`n+---------------+`n| Files / tests |`n+---------------+`n   v`n+--------+`n| Report |`n+--------+`nELI5:`n- No Codex executor or gate-check output has arrived yet.`nPHASE WHY:`n- Waiting for live work before connecting it to the active phase.`nRISKS:`n- none seen yet`nNEXT:`n- Start or resume SGSD; this panel will summarize the next chunk."
    Write-NarratedPanel -Summary $lastSummary -ProjectName $projectName -LiveFile $Path -State "waiting" -ChunkLength 0

    while ($true) {
        try {
            $item = Get-Item -LiteralPath $Path -ErrorAction Stop
            $signature = "$($item.Length)|$($item.LastWriteTimeUtc.Ticks)"
            $changed = ($signature -ne $lastSignature)

            if ($changed -and $item.Length -gt 0) {
                $lastSignature = $signature
                $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
                if ($raw.Length -gt $ChunkChars) { $raw = $raw.Substring($raw.Length - $ChunkChars) }
                $context = Get-SgsdNarratorContext -ProjectRoot $root -RawChunk $raw
                $currentRaw = $raw
                $currentContext = $context
                $currentChunkLength = $raw.Length
                $currentDisplayWidth = (Get-NarratorContentLayout).ContentWidth
                $currentHash = Get-SgsdTextHash -Text ("narrator-width=$currentDisplayWidth`n---`n" + $context + "`n---`n" + $raw)
                $currentFallback = New-NarratorRawFallbackSummary -ProjectContext $context -RawChunk $raw
                $lastRenderedKey = ''
            }

            if ($currentHash) {
                $relayResult = Read-NarratorRelayResult -ResultPath $relayPaths.Result -ExpectedHash $currentHash
                if ($relayResult -and $relayResult.ok -and $relayResult.summary) {
                    $renderKey = "haiku:${currentHash}:$($relayResult.ts)"
                    if ($renderKey -ne $lastRenderedKey) {
                        $lastSummary = [string]$relayResult.summary
                        $lastNarratorWarning = ''
                        $summaryPath = Join-Path $metricsDir 'codex-eli5-live.md'
                        Set-Content -LiteralPath $summaryPath -Value $lastSummary -Encoding UTF8
                        Write-NarratedPanel -Summary $lastSummary -ProjectName $projectName -LiveFile $Path -State "live (Haiku relay)" -ChunkLength $currentChunkLength
                        $lastRenderedKey = $renderKey
                    }
                } else {
                    $active = Get-NarratorRelayActive -PidPath $relayPaths.Pid
                    if ($active.Active -and $active.AgeSec -gt ($NarratorTimeoutSec + 45)) {
                        Get-CimInstance Win32_Process -Filter "ParentProcessId=$($active.ProcessId)" -ErrorAction SilentlyContinue |
                            ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
                        Stop-Process -Id $active.ProcessId -Force -ErrorAction SilentlyContinue
                        $timedOut = [pscustomobject]@{
                            ok        = $false
                            warning   = "OUT OF SYNC: narrator relay exceeded $NarratorTimeoutSec seconds; showing live local fallback"
                            summary   = ''
                            hash      = $active.Hash
                            chunk_len = $currentChunkLength
                            pid       = $active.ProcessId
                            ts        = [datetime]::UtcNow.ToString('o')
                        }
                        Set-Content -LiteralPath $relayPaths.Result -Value ($timedOut | ConvertTo-Json -Depth 6) -Encoding UTF8
                        $active = [pscustomobject]@{ Active = $false; ProcessId = 0; Hash = ''; AgeSec = 0 }
                    }
                    $now = [datetime]::UtcNow
                    $retryDue = (($now - $lastRelayRequestedAt).TotalSeconds -gt 300)
                    $startedRelay = $false
                    if (-not $active.Active -and ($currentHash -ne $lastRelayRequestedHash -or $retryDue)) {
                        $proc = Start-NarratorRelay -ScriptPath $scriptPath -RelayPaths $relayPaths -ProjectName $projectName -Context $currentContext -Chunk $currentRaw -Hash $currentHash -DisplayWidth $currentDisplayWidth -TimeoutSec $NarratorTimeoutSec
                        $lastRelayRequestedHash = $currentHash
                        $lastRelayRequestedAt = $now
                        $lastNarratorWarning = "RELAY: handed current chunk to Haiku (pid=$($proc.Id)); showing live local fallback until it returns"
                        $startedRelay = $true
                    } elseif ($active.Active) {
                        $lastNarratorWarning = "RELAY: Haiku worker pid=$($active.ProcessId) is summarising in background ($($active.AgeSec)s); showing live local fallback"
                    } elseif ($relayResult -and $relayResult.warning) {
                        $lastNarratorWarning = [string]$relayResult.warning
                    } else {
                        $lastNarratorWarning = 'RELAY: waiting before retrying Haiku; showing live local fallback'
                    }

                    $renderKey = "fallback:${currentHash}:$lastNarratorWarning"
                    if ($changed -or $startedRelay -or $renderKey -ne $lastRenderedKey) {
                        $lastSummary = $currentFallback
                        Write-NarratedPanel -Summary $lastSummary -ProjectName $projectName -LiveFile $Path -State "live local fallback" -ChunkLength $currentChunkLength -Warning $lastNarratorWarning
                        $lastRenderedKey = $renderKey
                    }
                }
            }
        } catch {
            $renderKey = "waiting-file:$lastNarratorWarning"
            if ($renderKey -ne $lastRenderedKey) {
                Write-NarratedPanel -Summary $lastSummary -ProjectName $projectName -LiveFile $Path -State "waiting for live file" -ChunkLength 0 -Warning $lastNarratorWarning
                $lastRenderedKey = $renderKey
            }
        }
        Start-Sleep -Seconds ([Math]::Max(5, $NarrateSec))
    }
}

$root = Resolve-SgsdProjectRoot -StartDir $ProjectDir
if (-not $root) {
    Write-Host "sgsd-watch-codex: no .planning/ ancestor found from $ProjectDir" -ForegroundColor Red
    exit 1
}

$metricsDir = Join-Path $root '.planning\metrics'
$liveFile = Join-Path $metricsDir 'codex-live-output.txt'
$executorFile = Join-Path $metricsDir 'codex-executor-live.txt'
if (-not (Test-Path -LiteralPath $metricsDir)) {
    New-Item -ItemType Directory -Path $metricsDir -Force | Out-Null
}
if (-not (Test-Path -LiteralPath $liveFile)) {
    New-Item -ItemType File -Path $liveFile -Force | Out-Null
}
if (-not (Test-Path -LiteralPath $executorFile)) {
    New-Item -ItemType File -Path $executorFile -Force | Out-Null
}

if ($OpenWindow) {
    $scriptPath = if ($PSCommandPath) { $PSCommandPath } else { $MyInvocation.MyCommand.Path }
    if (-not $scriptPath) {
        Write-Host "sgsd-watch-codex: cannot resolve script path for -OpenWindow" -ForegroundColor Red
        exit 1
    }

    $narrateArg = if ($Narrate) { ' -Narrate' } else { '' }
    $cmd = "Set-Location -LiteralPath $(Quote-PowerShellLiteral $root); & $(Quote-PowerShellLiteral $scriptPath) -ProjectDir $(Quote-PowerShellLiteral $root) -PollMs $PollMs -TailLines $TailLines$narrateArg -NarrateSec $NarrateSec -ChunkChars $ChunkChars -NarratorTimeoutSec $NarratorTimeoutSec"
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($cmd))
    $windowStyle = if ($Foreground) { 'Normal' } else { 'Minimized' }
    Start-SgsdBackgroundProcess -FilePath (Resolve-PowerShellWorkerExecutable) -ArgumentList @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $encoded) -WindowStyle $windowStyle | Out-Null
    $focusText = if ($Foreground) { 'foreground' } else { 'minimized/no-focus' }
    Write-Host "sgsd-watch-codex: opened PowerShell tail for $root ($focusText)" -ForegroundColor Green
    return
}

Write-Host "sgsd-watch-codex: tailing $liveFile" -ForegroundColor Cyan
if ($Narrate) {
    Write-Host "sgsd-watch-codex: narrator mode uses Claude Haiku every ${NarrateSec}s (timeout=${NarratorTimeoutSec}s); Ctrl+C stops" -ForegroundColor DarkGray
    Watch-CodexNarrated -Path $liveFile -NarrateSec $NarrateSec -ChunkChars $ChunkChars -NarratorTimeoutSec $NarratorTimeoutSec
} else {
    Write-Host "sgsd-watch-codex: follows Codex executor and Codex gate/review checks; refresh=${PollMs}ms; Ctrl+C stops the tail" -ForegroundColor DarkGray
    Watch-CodexLiveFile -Path $liveFile -PollMs $PollMs -TailLines $TailLines
}
