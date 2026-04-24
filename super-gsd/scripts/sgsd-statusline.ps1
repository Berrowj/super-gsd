# ============================================================================
# sgsd-statusline.ps1 — SGSD v2 custom statusline (R-Q8c)
# ============================================================================
# Claude Code statusline script. Reads session context JSON on stdin; emits
# two lines of SGSD-specific health and position signal to stdout.
#
# Research grounding:
#   HCC-P-08  — shape growth curve, not just snapshot (age-based colors)
#   SKR-P-02  — hidden-state probing for intervention points (multi-signal read)
#   LLMS-P-03 — systems declare success before verifying (surface verdicts)
#   R-Q1 (brief) — heartbeat + pulse as first-class observability signals
#   R-Q8c (brief) — operator sees project+loop health at a glance
#
# Emits consumed:
#   .planning/STATE.md                           — milestone/phase/plan/progress
#   .planning/metrics/heartbeat.jsonl            — tool-level liveness
#   .planning/metrics/orchestrator-pulse.jsonl   — loop-iteration liveness
#   .planning/metrics/token-log.jsonl            — session token burn
#   .planning/phases/*/commit-reviews.jsonl      — last gate verdict
#   .planning/phases/*/BLOCKED*.md               — active blockers
#   git log -1 --format=%ct                      — commit freshness
#
# Wire via ~/.claude/settings.json statusLine field. See Phase E2.
# ============================================================================

$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ─── Parse stdin JSON (Claude Code session context) ─────────────────────────
$stdin = [Console]::In.ReadToEnd()
$cwd = $null
if ($stdin) {
    try {
        $session = $stdin | ConvertFrom-Json
        if ($session.workspace.current_dir) { $cwd = $session.workspace.current_dir }
        elseif ($session.cwd) { $cwd = $session.cwd }
    } catch {}
}
if (-not $cwd) { $cwd = (Get-Location).Path }

# Normalize bash-style paths (/c/Users/... → C:\Users\...) for PowerShell
if ($cwd -match '^/([a-zA-Z])/(.+)$') {
    $cwd = "$($matches[1].ToUpper()):\$($matches[2] -replace '/', '\')"
}

# ─── Walk up to find .planning/ ─────────────────────────────────────────────
function Find-PlanningDir {
    param($startDir)
    $d = $startDir
    for ($i = 0; $i -lt 10; $i++) {
        if (Test-Path (Join-Path $d '.planning')) { return $d }
        $parent = Split-Path $d -Parent
        if (-not $parent -or $parent -eq $d) { return $null }
        $d = $parent
    }
    return $null
}
$projectDir = Find-PlanningDir $cwd
if (-not $projectDir) {
    [Console]::Out.Write("[SGSD] no .planning/ in tree (cwd=$cwd)")
    exit 0
}
$planning = Join-Path $projectDir '.planning'
$metrics  = Join-Path $planning 'metrics'

# ─── ANSI helpers ───────────────────────────────────────────────────────────
$ESC     = [char]27
$GREEN   = '92'; $YELLOW = '93'; $RED = '91'
$CYAN    = '96'; $GRAY = '90'; $MAGENTA = '95'; $WHITE = '97'
function C($code, $text) { return "$ESC[${code}m${text}$ESC[0m" }

# ─── Age helpers ────────────────────────────────────────────────────────────
function AgeSec($file) {
    if (-not (Test-Path $file)) { return $null }
    return [int]((Get-Date) - (Get-Item $file).LastWriteTime).TotalSeconds
}
function FormatAge($sec) {
    if ($null -eq $sec) { return '--' }
    if ($sec -lt 60)     { return "${sec}s" }
    if ($sec -lt 3600)   { return "$([int]($sec/60))m" }
    if ($sec -lt 86400)  { return "$([int]($sec/3600))h" }
    return "$([int]($sec/86400))d"
}
function ColorForAge($sec, $greenMax, $yellowMax) {
    if ($null -eq $sec)    { return $GRAY }
    if ($sec -lt $greenMax)  { return $GREEN }
    if ($sec -lt $yellowMax) { return $YELLOW }
    return $RED
}

# ─── 1. STATE.md frontmatter ────────────────────────────────────────────────
$stateFile = Join-Path $planning 'STATE.md'
$milestone = '?'; $phase = '?'; $plan = '?'
$totalPlans = 0; $completedPlans = 0
if (Test-Path $stateFile) {
    $lines = Get-Content $stateFile -TotalCount 40 -Encoding UTF8 -ErrorAction SilentlyContinue
    foreach ($line in $lines) {
        if     ($line -match '^milestone:\s*"?([^"\r\n]+)"?') { $milestone = $matches[1].Trim() }
        elseif ($line -match '^current_phase:\s*"?([^"\r\n]+)"?') { $phase = $matches[1].Trim() }
        elseif ($line -match '^\s*total_plans:\s*(\d+)') { $totalPlans = [int]$matches[1] }
        elseif ($line -match '^\s*completed_plans:\s*(\d+)') { $completedPlans = [int]$matches[1] }
        elseif ($line -match 'current_plan.*[Pp](\d+)[-.](\d+)') { $plan = $matches[2] }
    }
}

# ─── 2-3. Heartbeat + Pulse age ─────────────────────────────────────────────
$hbSec    = AgeSec (Join-Path $metrics 'heartbeat.jsonl')
$pulseSec = AgeSec (Join-Path $metrics 'orchestrator-pulse.jsonl')

# ─── 4. Session token total (sum last 50 dispatch entries) ──────────────────
$tokens = 0
$tokenFile = Join-Path $metrics 'token-log.jsonl'
if (Test-Path $tokenFile) {
    Get-Content $tokenFile -Tail 50 -Encoding UTF8 -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            $e = $_ | ConvertFrom-Json
            if ($e.total) { $tokens += [int]$e.total }
        } catch {}
    }
    $tokens = [int]($tokens / 1000)
}

# ─── 5. Last gate verdict (most recent commit-reviews.jsonl across phases) ──
$lastGate = '--'; $gateColor = $GRAY
$phasesDir = Join-Path $planning 'phases'
if (Test-Path $phasesDir) {
    $gateFile = Get-ChildItem -Path $phasesDir -Filter 'commit-reviews.jsonl' -Recurse -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($gateFile) {
        $lastLine = Get-Content $gateFile.FullName -Tail 1 -Encoding UTF8 -ErrorAction SilentlyContinue
        try {
            $g = $lastLine | ConvertFrom-Json
            $lastGate = $g.verdict
            switch ($lastGate) {
                'pass' { $gateColor = $GREEN }
                'warn' { $gateColor = $YELLOW }
                default { $gateColor = $RED }
            }
        } catch {}
    }
}

# ─── 6. Blockers (BLOCKED*.md files anywhere under .planning) ───────────────
$blockerCount = (Get-ChildItem -Path $planning -Filter 'BLOCKED*.md' -Recurse -ErrorAction SilentlyContinue |
                 Measure-Object).Count
$blockerColor = if ($blockerCount -eq 0) { $GREEN } else { $RED }

# ─── 7. Git commit age ──────────────────────────────────────────────────────
$commitAge = '--'
Push-Location $projectDir
$lastUnix = (git log -1 --format=%ct 2>$null)
Pop-Location
if ($lastUnix -and $lastUnix -match '^\d+$') {
    $nowUnix = [int]((Get-Date -UFormat %s))
    $commitAgeSec = $nowUnix - [int]$lastUnix
    $commitAge = FormatAge $commitAgeSec
}

# ─── 8. Phase progress ──────────────────────────────────────────────────────
$progressPct = if ($totalPlans -gt 0) { [int](($completedPlans * 100) / $totalPlans) } else { 0 }
$progressColor = if     ($progressPct -eq 100) { $GREEN }
                 elseif ($progressPct -gt 0)   { $YELLOW }
                 else                          { $GRAY }

# ─── 9. Growth-curve mini (last 5 dispatch token sums, ASCII sparkline) ─────
# HCC-P-08 — shape of growth over time, not just current value
$sparkline = ''
if (Test-Path $tokenFile) {
    $tail5 = @(Get-Content $tokenFile -Tail 5 -Encoding UTF8 -ErrorAction SilentlyContinue |
               ForEach-Object { try { ($_ | ConvertFrom-Json).total } catch { $null } } |
               Where-Object { $_ -ne $null })
    if ($tail5.Count -ge 2) {
        $max = ($tail5 | Measure-Object -Maximum).Maximum
        if ($max -gt 0) {
            # ASCII bar chars (PowerShell 5.1 + file-encoding-safe; no Unicode)
            $chars = '.-=+X#&@'
            $sparkline = -join ($tail5 | ForEach-Object {
                $idx = [Math]::Min([int](($_ / $max) * 7), 7)
                $chars[$idx]
            })
        }
    }
}

# ─── Compose two-line output ────────────────────────────────────────────────
$hbAgeStr    = FormatAge $hbSec
$pulseAgeStr = FormatAge $pulseSec
$hbColor     = ColorForAge $hbSec 120 600
$pulseColor  = ColorForAge $pulseSec 300 900

$line1Parts = @(
    (C $MAGENTA 'SGSD'),
    (C $CYAN   "M$milestone"),
    (C $CYAN   "P$phase.$plan"),
    (C $progressColor "$completedPlans/$totalPlans"),
    (C $CYAN   "$($tokens)k"),
    (C $GRAY   "git $commitAge")
)
$line2Parts = @(
    (C $hbColor     "heart $hbAgeStr"),
    (C $pulseColor  "pulse $pulseAgeStr"),
    (C $gateColor   "gate $lastGate"),
    (C $blockerColor "blk $blockerCount"),
    (C $progressColor "prog $progressPct%")
)
if ($sparkline) { $line2Parts += (C $WHITE "tok $sparkline") }

# MC-02: Codex live state segment (read codex-live.json inline — no helper dot-source, latency sensitive)
$codexLivePath = Join-Path $metrics "codex-live.json"
$cdxState = 'idle'
$cdxLabel = ''
if (Test-Path $codexLivePath) {
    try {
        $cdxLive = Get-Content $codexLivePath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction Stop
        $rawState = if ($cdxLive.state) { "$($cdxLive.state)" } else { 'idle' }
        # GAP-5: normalize "ok" and "not-fired" -> "idle"
        $cdxState = if ($rawState -eq 'ok' -or $rawState -eq 'not-fired') { 'idle' } else { $rawState }
        if ($cdxState -eq 'running' -and $cdxLive.updated_at) {
            $ageSec = [int]((Get-Date) - [datetime]$cdxLive.updated_at).TotalSeconds
            $cdxLabel = "cdx:running [$($ageSec)s]"
        } else {
            $cdxLabel = "cdx:$cdxState"
        }
    } catch { $cdxLabel = 'cdx:idle' }
} else {
    $cdxLabel = 'cdx:idle'
}
$cdxColor = switch ($cdxState) {
    'running'  { '33' }   # Yellow
    'timeout'  { '31' }   # Red
    'error'    { '31' }   # Red
    'fallback' { '33' }   # DarkYellow (33; label distinguishes from running)
    default    { '90' }   # Gray (idle / not-fired)
}
$line2Parts += (C $cdxColor "[x] $cdxLabel")

$line1 = ($line1Parts -join ' · ')
$line2 = ($line2Parts -join ' · ')

[Console]::Out.WriteLine($line1)
[Console]::Out.Write($line2)
