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

# UTF-8 output for emoji + box-drawing. Best-effort under managed CLM shells.
try {
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $OutputEncoding = [System.Text.Encoding]::UTF8
} catch {}

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
        'claude-md' {
            $p = Join-Path $ProjectDir 'CLAUDE.md'
            $snippet = Read-Template 'claude-md-snippet.template'
            if (-not $snippet) { Write-Host "    ✗ snippet missing" -ForegroundColor Red; return $false }
            $existing = if (Test-Path -LiteralPath $p) { [System.IO.File]::ReadAllText($p) } else { '' }
            if ($existing -match 'BEGIN sgsd-overlay') {
                Write-Host "    ⓘ CLAUDE.md already has SGSD overlay markers — skipping (use /sgsd-overlay-refresh to update)" -ForegroundColor DarkYellow
                return $true
            }
            $combined = if ($existing) { $existing.TrimEnd() + "`n" + $snippet } else { "# CLAUDE.md`n" + $snippet }
            Write-FileWithBom -Path $p -Content $combined
            Write-Host "    ✓ appended SGSD overlay section to CLAUDE.md" -ForegroundColor Green
            return $true
        }
        'warp-workflows' {
            # Junction <repo>/.warp/workflows/ → canonical workflows at GSDedits root.
            # The .warp/ parent dir may not exist yet; create it first. Don't recurse-
            # junction the whole .warp/ because the operator may have repo-specific
            # tab-configs we shouldn't shadow.
            $warpDir   = Join-Path $ProjectDir '.warp'
            $linkPath  = Join-Path $warpDir 'workflows'
            $canonical = 'C:\Users\jack.berrow\GSDedits\.warp\workflows'
            if (-not (Test-Path -LiteralPath $canonical)) {
                Write-Host "    ✗ canonical workflows dir not found at $canonical" -ForegroundColor Red
                return $false
            }
            if (Test-Path -LiteralPath $linkPath) { Write-Host "    ⓘ .warp/workflows/ already present — leaving alone" -ForegroundColor DarkYellow; return $true }
            if (-not (Test-Path -LiteralPath $warpDir)) { New-Item -ItemType Directory -Force -Path $warpDir | Out-Null }
            $out = cmd /c "mklink /J `"$linkPath`" `"$canonical`"" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    ✓ junction .warp/workflows/ → $canonical" -ForegroundColor Green
                Write-Host "    ⓘ canonical workflows have GSDedits-rooted defaults; override project_dir per invocation" -ForegroundColor DarkYellow
                return $true
            }
            Write-Host "    ✗ mklink failed: $out" -ForegroundColor Red
            return $false
        }
        'resource-registry' {
            # Empty agents.jsonl placeholder — populated later by /gsd-intel refresh
            # which scans super-gsd/agents/*.md and builds the canonical registry.
            $regDir = Join-Path $ProjectDir '.planning\resource-registry'
            $regFile = Join-Path $regDir 'agents.jsonl'
            if (-not (Test-Path -LiteralPath $regDir)) { New-Item -ItemType Directory -Force -Path $regDir | Out-Null }
            if (-not (Test-Path -LiteralPath $regFile)) { New-Item -ItemType File -Force -Path $regFile | Out-Null }
            Write-Host "    ✓ created .planning/resource-registry/agents.jsonl (empty — populate via /gsd-intel refresh)" -ForegroundColor Green
            return $true
        }
        'warp-md' {
            $p = Join-Path $ProjectDir 'WARP.md'
            if (Test-Path -LiteralPath $p) { Write-Host "    ⓘ WARP.md already present — leaving alone" -ForegroundColor DarkYellow; return $true }
            $tpl = Read-Template 'WARP.md.template'
            if (-not $tpl) { Write-Host "    ✗ template missing" -ForegroundColor Red; return $false }
            Write-FileWithBom -Path $p -Content (Apply-TemplateVars $tpl $vars)
            Write-Host "    ✓ wrote WARP.md (review the TODO marker)" -ForegroundColor Green
            return $true
        }
        'mcp-json' {
            $p = Join-Path $ProjectDir '.mcp.json'
            if (Test-Path -LiteralPath $p) { Write-Host "    ⓘ .mcp.json already present — leaving alone" -ForegroundColor DarkYellow; return $true }
            $tpl = Read-Template 'mcp.json.template'
            if (-not $tpl) { Write-Host "    ✗ template missing" -ForegroundColor Red; return $false }
            $localVars = $vars.Clone()
            $localVars['PROJECT_DIR_FORWARD_SLASH'] = ($ProjectDir -replace '\\', '/')
            Write-FileWithBom -Path $p -Content (Apply-TemplateVars $tpl $localVars)
            Write-Host "    ✓ wrote .mcp.json with SGSD MCP server entry" -ForegroundColor Green
            return $true
        }
        'auto-memory' {
            # Junction ~/.claude/projects/<encoded>/memory/ → .planning/memory/
            # so Claude Code's auto-memory writes are git-tracked under the repo.
            $repoLeaf2 = Split-Path -Leaf $ProjectDir
            $encoded   = ($ProjectDir -replace '[\\:]', '-') -replace '^-', ''
            $autoMem   = Join-Path $env:USERPROFILE ".claude\projects\$encoded\memory"
            $target    = Join-Path $ProjectDir '.planning\memory'
            if (-not (Test-Path -LiteralPath $target)) {
                Write-Host "    ✗ target $target doesn't exist — run memory-tree component first" -ForegroundColor Red
                return $false
            }
            if (Test-Path -LiteralPath $autoMem) {
                # Already exists. If it's a junction, we're done. Otherwise leave alone (don't risk losing user data).
                try {
                    $item = Get-Item -LiteralPath $autoMem -Force -ErrorAction SilentlyContinue
                    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                        Write-Host "    ⓘ auto-memory junction already in place — skipping" -ForegroundColor DarkYellow
                        return $true
                    }
                } catch {}
                Write-Host "    ✗ $autoMem exists and is not a junction — manual migration required (rename + retry)" -ForegroundColor Red
                return $false
            }
            $parentDir = Split-Path -Parent $autoMem
            if (-not (Test-Path -LiteralPath $parentDir)) { New-Item -ItemType Directory -Force -Path $parentDir | Out-Null }
            $out = cmd /c "mklink /J `"$autoMem`" `"$target`"" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host "    ✓ junction $autoMem → $target" -ForegroundColor Green
                return $true
            }
            Write-Host "    ✗ mklink failed: $out" -ForegroundColor Red
            return $false
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

# Install-list = MISSING (always) + WARN (handled by installers that can fix
# the warn condition: missing optional files, partially-populated dirs, etc.).
# Components in the WARN bucket whose installer is a no-op silently skip.
$todo = @($report | Where-Object { $_.Status -eq 'MISSING' -or $_.Status -eq 'WARN' })
if ($todo.Count -eq 0) {
    Write-Host "Nothing to install — repo is fully onboarded." -ForegroundColor Green
    Write-Host ""
    exit 0
}

if (-not $All) {
    $missCount = @($todo | Where-Object { $_.Status -eq 'MISSING' }).Count
    $warnCount = @($todo | Where-Object { $_.Status -eq 'WARN' }).Count
    Write-Host "$($todo.Count) component(s) can be installed ($missCount missing, $warnCount warn)." -ForegroundColor White
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
