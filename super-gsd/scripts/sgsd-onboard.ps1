# sgsd-onboard.ps1
# /sgsd-onboard wizard. Runs Test-SgsdReadiness against the current repo,
# shows what's missing, and installs each missing/incomplete component.
#
# Usage:
#   sgsd-onboard.ps1                        # interactive wizard in cwd
#   sgsd-onboard.ps1 -ProjectDir <path>     # target a specific repo
#   sgsd-onboard.ps1 -All                   # install everything missing without prompting
#   sgsd-onboard.ps1 -Check                 # readiness report only, no install

param(
    [string]$ProjectDir = (Get-Location).Path,
    [switch]$All,
    [switch]$Check
)

# UTF-8 output for emoji + box-drawing
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

try { $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path } catch {
    Write-Host "ERR: cannot resolve project dir '$ProjectDir'" -ForegroundColor Red
    exit 1
}

# Locate the canonical super-gsd/ install — needed for templates and as the
# junction target. Use the readiness module's Resolve-SgsdHome.
$scriptDir = Split-Path -Parent $PSCommandPath
$libDir    = Join-Path $scriptDir 'lib'
$readinessLib = Join-Path $libDir 'sgsd-readiness.ps1'
if (-not (Test-Path -LiteralPath $readinessLib)) {
    Write-Host "ERR: sgsd-readiness.ps1 not found at $readinessLib" -ForegroundColor Red
    exit 1
}
. $readinessLib

$sgsdHome = Resolve-SgsdHome -StartDir $ProjectDir
if (-not $sgsdHome) {
    # Fall back to the caller's super-gsd location (we're inside it).
    $sgsdHome = Split-Path -Parent (Split-Path -Parent $PSCommandPath)
    if (-not (Test-Path -LiteralPath (Join-Path $sgsdHome 'scripts'))) {
        Write-Host "ERR: cannot locate canonical super-gsd/ install" -ForegroundColor Red
        exit 1
    }
}
$templatesDir = Join-Path $sgsdHome 'templates\onboard'
if (-not (Test-Path -LiteralPath $templatesDir)) {
    Write-Host "ERR: templates dir missing: $templatesDir" -ForegroundColor Red
    exit 1
}

function Read-Template {
    param([string]$Name)
    $p = Join-Path $templatesDir $Name
    if (-not (Test-Path -LiteralPath $p)) { return $null }
    return [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8)
}

function Write-FileWithBom {
    # Write UTF-8 with BOM so PowerShell 5.1 reads non-ASCII chars correctly.
    param([string]$Path, [string]$Content)
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $utf8Bom = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8Bom)
}

function Apply-TemplateVars {
    param([string]$Content, [hashtable]$Vars)
    foreach ($k in $Vars.Keys) {
        $Content = $Content -replace ('\{\{' + [regex]::Escape($k) + '\}\}'), $Vars[$k]
    }
    return $Content
}

function Install-SgsdComponent {
    # Returns $true on success, $false on failure or skip-by-design.
    param([string]$ComponentId, [string]$ProjectDir, [string]$SgsdHome)

    $repoLeaf = Split-Path -Leaf $ProjectDir
    $today    = (Get-Date).ToString('yyyy-MM-dd')
    $vars     = @{ 'REPO_NAME' = $repoLeaf; 'TODAY' = $today }

    switch ($ComponentId) {
        'super-gsd' {
            $link = Join-Path $ProjectDir 'super-gsd'
            if (Test-Path -LiteralPath $link) { Write-Host "    super-gsd/ already exists — leaving alone" -ForegroundColor DarkYellow; return $true }
            $out = cmd /c "mklink /J `"$link`" `"$SgsdHome`"" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    ✓ junction → $SgsdHome" -ForegroundColor Green
                return $true
            }
            Write-Host "    ✗ mklink failed: $out" -ForegroundColor Red
            return $false
        }
        'planning-dir' {
            $p = Join-Path $ProjectDir '.planning'
            New-Item -ItemType Directory -Force -Path $p | Out-Null
            Write-Host "    ✓ created .planning/" -ForegroundColor Green
            return $true
        }
        'state-md' {
            $p = Join-Path $ProjectDir '.planning\STATE.md'
            $tpl = Read-Template 'STATE.md.template'
            if (-not $tpl) { Write-Host "    ✗ template missing" -ForegroundColor Red; return $false }
            Write-FileWithBom -Path $p -Content (Apply-TemplateVars $tpl $vars)
            Write-Host "    ✓ wrote .planning/STATE.md" -ForegroundColor Green
            return $true
        }
        'milestones-dir' {
            $p = Join-Path $ProjectDir '.planning\milestones'
            New-Item -ItemType Directory -Force -Path $p | Out-Null
            Write-Host "    ✓ created .planning/milestones/" -ForegroundColor Green
            return $true
        }
        'metrics-dir' {
            $p = Join-Path $ProjectDir '.planning\metrics'
            New-Item -ItemType Directory -Force -Path $p | Out-Null
            foreach ($f in @('codex-log.jsonl', 'activity-log.jsonl', 'token-log.jsonl')) {
                $fp = Join-Path $p $f
                if (-not (Test-Path -LiteralPath $fp)) { New-Item -ItemType File -Force -Path $fp | Out-Null }
            }
            $narrative = Join-Path $p 'narrative.md'
            if (-not (Test-Path -LiteralPath $narrative)) {
                Write-FileWithBom -Path $narrative -Content "# Narrative`n`nlatest: `nlastfail: `n`n## Events`n"
            }
            Write-Host "    ✓ created .planning/metrics/ + log files" -ForegroundColor Green
            return $true
        }
        'memory-tree' {
            $p = Join-Path $ProjectDir '.planning\memory'
            New-Item -ItemType Directory -Force -Path $p | Out-Null
            foreach ($sub in @('errors', 'architecture\decisions', 'architecture\patterns', 'architecture\anti-patterns', 'workflow\feedback', 'code')) {
                New-Item -ItemType Directory -Force -Path (Join-Path $p $sub) | Out-Null
            }
            $idx = Join-Path $p 'MEMORY.md'
            if (-not (Test-Path -LiteralPath $idx)) {
                Write-FileWithBom -Path $idx -Content "# Memory Index`n`nGenerated by /sgsd-onboard on $today.`nFormat: one markdown list item per file, readable by auto-memory AND sgsd-recall.`n"
            }
            Write-Host "    ✓ created .planning/memory/ + MEMORY.md index" -ForegroundColor Green
            return $true
        }
        'agents-md' {
            $p = Join-Path $ProjectDir 'AGENTS.md'
            $tpl = Read-Template 'AGENTS.md.template'
            if (-not $tpl) { Write-Host "    ✗ template missing" -ForegroundColor Red; return $false }
            Write-FileWithBom -Path $p -Content (Apply-TemplateVars $tpl $vars)
            Write-Host "    ✓ wrote AGENTS.md (review the TODO markers)" -ForegroundColor Green
            return $true
        }
        'warpindexingignore' {
            $p = Join-Path $ProjectDir '.warpindexingignore'
            $tpl = Read-Template '.warpindexingignore.template'
            if (-not $tpl) { Write-Host "    ✗ template missing" -ForegroundColor Red; return $false }
            Write-FileWithBom -Path $p -Content (Apply-TemplateVars $tpl $vars)
            Write-Host "    ✓ wrote .warpindexingignore" -ForegroundColor Green
            return $true
        }
        'gitignore' {
            $p = Join-Path $ProjectDir '.gitignore'
            $snippet = Read-Template 'gitignore-snippet.template'
            if (-not $snippet) { Write-Host "    ✗ snippet missing" -ForegroundColor Red; return $false }
            $existing = if (Test-Path -LiteralPath $p) { [System.IO.File]::ReadAllText($p) } else { '' }
            if ($existing -match 'SGSD-managed entries') {
                Write-Host "    ⓘ .gitignore already has SGSD entries — skipping" -ForegroundColor DarkYellow
                return $true
            }
            $combined = if ($existing) { $existing.TrimEnd() + "`n`n" + $snippet } else { $snippet.TrimStart() }
            Write-FileWithBom -Path $p -Content $combined
            Write-Host "    ✓ appended SGSD entries to .gitignore" -ForegroundColor Green
            return $true
        }
        default {
            Write-Host "    ⓘ component '$ComponentId' not yet auto-installable — see fix hint" -ForegroundColor DarkYellow
            return $false
        }
    }
}

# ── Wizard flow ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  SGSD Onboard Wizard                                           ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "Project: $ProjectDir" -ForegroundColor DarkGray
Write-Host "SGSD home: $sgsdHome" -ForegroundColor DarkGray

$report = Test-SgsdReadiness -ProjectDir $ProjectDir
Format-SgsdReadinessReport $report

if ($Check) { exit 0 }

$todo = @($report | Where-Object { $_.Status -eq 'MISSING' })
if ($todo.Count -eq 0) {
    Write-Host "Nothing to install — repo is fully onboarded." -ForegroundColor Green
    Write-Host ""
    exit 0
}

if (-not $All) {
    Write-Host "$($todo.Count) missing component(s) can be auto-installed." -ForegroundColor White
    Write-Host "Install all? [Y]es / [n]o (review each) / [q]uit: " -NoNewline -ForegroundColor Yellow
    $resp = Read-Host
    if ($resp -match '^q') { Write-Host "Aborted." -ForegroundColor DarkGray; exit 0 }
    $autoAll = ($resp -match '^[Yy]?$')
} else {
    $autoAll = $true
}

$installed = 0
$failed    = 0
foreach ($item in $todo) {
    Write-Host ""
    Write-Host "→ $($item.Id) — $($item.Description)" -ForegroundColor Cyan
    Write-Host "    fix: $($item.Fix)" -ForegroundColor DarkGray
    if (-not $autoAll) {
        Write-Host "    Install? [Y]es / [n]o / [q]uit: " -NoNewline -ForegroundColor Yellow
        $resp = Read-Host
        if ($resp -match '^q') { Write-Host "Aborted." -ForegroundColor DarkGray; break }
        if ($resp -match '^n') { Write-Host "    skipped" -ForegroundColor DarkGray; continue }
    }
    $ok = Install-SgsdComponent -ComponentId $item.Id -ProjectDir $ProjectDir -SgsdHome $sgsdHome
    if ($ok) { $installed++ } else { $failed++ }
}

Write-Host ""
Write-Host "═════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Onboarding complete: " -NoNewline -ForegroundColor White
Write-Host "$installed installed" -NoNewline -ForegroundColor Green
if ($failed -gt 0) {
    Write-Host " · " -NoNewline -ForegroundColor DarkGray
    Write-Host "$failed failed" -NoNewline -ForegroundColor Red
}
Write-Host ""
Write-Host ""

# Final readiness re-check
$report2 = Test-SgsdReadiness -ProjectDir $ProjectDir
$missingAfter = @($report2 | Where-Object { $_.Status -eq 'MISSING' }).Count
$warnAfter    = @($report2 | Where-Object { $_.Status -eq 'WARN' }).Count
if ($missingAfter -eq 0) {
    Write-Host "✓ All MISSING components are now installed. Repo is ready for /sgsd-orchestrate." -ForegroundColor Green
} else {
    Write-Host "⚠ $missingAfter component(s) still missing — re-run /sgsd-onboard or install manually." -ForegroundColor Yellow
}
if ($warnAfter -gt 0) {
    Write-Host "  $warnAfter component(s) in WARN state (non-blocking; see /sgsd-onboard -Check for details)." -ForegroundColor DarkYellow
}
Write-Host ""
