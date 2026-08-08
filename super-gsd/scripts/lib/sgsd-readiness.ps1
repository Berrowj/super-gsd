# sgsd-readiness.ps1
# Reports whether a repo is ready for full SGSD usage. Returns a list of
# component records — each with id, description, status (OK/MISSING/STALE/WARN),
# fix hint. The single source of truth for the wizard, the auto-trigger
# guard, and `sgsd-doctor`.
#
# Usage:
#   . sgsd-readiness.ps1
#   $report = Test-SgsdReadiness -ProjectDir <path>
#   $report | Format-Table -AutoSize
#   $missing = $report | Where-Object { $_.Status -ne 'OK' }
#
# Exit code from a top-level script that calls this:
#   0 if all OK, 1 if any missing/stale/warn — same shape as warp-doctor.

function Resolve-SgsdHome {
    # Best-effort discovery of the canonical super-gsd/ install directory.
    # Order: $env:SGSD_HOME, walk-up from cwd, well-known fallback.
    param([string]$StartDir = (Get-Location).Path)

    if ($env:SGSD_HOME -and (Test-Path -LiteralPath $env:SGSD_HOME)) {
        return (Resolve-Path -LiteralPath $env:SGSD_HOME).Path
    }

    $current = $StartDir
    while ($current -and (Test-Path -LiteralPath $current)) {
        $candidate = Join-Path $current 'super-gsd'
        if ((Test-Path -LiteralPath $candidate) -and (Test-Path -LiteralPath (Join-Path $candidate 'scripts'))) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
        $parent = Split-Path -Parent $current
        if (-not $parent -or $parent -eq $current) { break }
        $current = $parent
    }

    $wellKnown = 'C:\Users\user\GSDedits\super-gsd'
    if (Test-Path -LiteralPath $wellKnown) { return (Resolve-Path -LiteralPath $wellKnown).Path }
    return $null
}

function Test-SgsdReadiness {
    param([string]$ProjectDir = (Get-Location).Path)

    try { $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path } catch {}

    $sgsdHome = Resolve-SgsdHome -StartDir $ProjectDir
    $checks   = New-Object System.Collections.Generic.List[object]

    function Add-Check {
        param([string]$Id, [string]$Desc, [string]$Status, [string]$Path = '', [string]$Fix = '')
        $script:checks.Add([pscustomobject]@{
            Id          = $Id
            Description = $Desc
            Status      = $Status
            Path        = $Path
            Fix         = $Fix
        })
    }
    $script:checks = $checks

    # 1. super-gsd/ runtime
    $superGsd = Join-Path $ProjectDir 'super-gsd'
    $superGsdPresent = Test-Path -LiteralPath (Join-Path $superGsd 'scripts')
    Add-Check 'super-gsd' 'super-gsd/ runtime tree (junction or local clone)' `
        $(if ($superGsdPresent) { 'OK' } else { 'MISSING' }) $superGsd `
        'Create directory junction to canonical install (mklink /J)'

    # 2. .planning/ directory
    $planning = Join-Path $ProjectDir '.planning'
    Add-Check 'planning-dir' '.planning/ directory present' `
        $(if (Test-Path -LiteralPath $planning) { 'OK' } else { 'MISSING' }) $planning `
        'Initialize .planning/ tree with default subdirs'

    # 3. STATE.md frontmatter
    $statePath = Join-Path $planning 'STATE.md'
    if (Test-Path -LiteralPath $statePath) {
        $hasFrontmatter = $false
        try {
            $head = Get-Content -LiteralPath $statePath -TotalCount 5 -ErrorAction SilentlyContinue
            if ($head -and $head[0] -match '^---' -and ($head -join "`n") -match 'gsd_state_version|milestone:') {
                $hasFrontmatter = $true
            }
        } catch {}
        Add-Check 'state-md' '.planning/STATE.md with valid frontmatter' `
            $(if ($hasFrontmatter) { 'OK' } else { 'WARN' }) $statePath `
            'Re-init STATE.md with default frontmatter template'
    } else {
        Add-Check 'state-md' '.planning/STATE.md with valid frontmatter' 'MISSING' $statePath `
            'Write default STATE.md template'
    }

    # 4. .planning/milestones/
    $milestones = Join-Path $planning 'milestones'
    Add-Check 'milestones-dir' '.planning/milestones/ directory present' `
        $(if (Test-Path -LiteralPath $milestones) { 'OK' } else { 'MISSING' }) $milestones `
        'Create empty milestones/ subdir'

    # 5. .planning/metrics/ (key metrics files create-on-empty so probes don't fail)
    $metrics = Join-Path $planning 'metrics'
    $metricsPresent = Test-Path -LiteralPath $metrics
    $metricsKeyFiles = @('codex-log.jsonl', 'activity-log.jsonl', 'narrative.md')
    $missingKeyMetrics = @()
    if ($metricsPresent) {
        foreach ($f in $metricsKeyFiles) {
            if (-not (Test-Path -LiteralPath (Join-Path $metrics $f))) { $missingKeyMetrics += $f }
        }
    }
    Add-Check 'metrics-dir' ".planning/metrics/ + key files ($($metricsKeyFiles -join ', '))" `
        $(if ($metricsPresent -and $missingKeyMetrics.Count -eq 0) { 'OK' } elseif ($metricsPresent) { 'WARN' } else { 'MISSING' }) $metrics `
        $(if ($missingKeyMetrics.Count -gt 0) { "Create empty: $($missingKeyMetrics -join ', ')" } else { 'Create metrics/ + empty log files' })

    # 6. .planning/memory/ tree
    $memory = Join-Path $planning 'memory'
    $memoryIndex = Join-Path $memory 'MEMORY.md'
    Add-Check 'memory-tree' '.planning/memory/ + MEMORY.md index' `
        $(if (Test-Path -LiteralPath $memoryIndex) { 'OK' } elseif (Test-Path -LiteralPath $memory) { 'WARN' } else { 'MISSING' }) $memory `
        'Initialize memory tree with empty MEMORY.md index + folder skeleton'

    # 7. CLAUDE.md (root)
    $claudeMd = Join-Path $ProjectDir 'CLAUDE.md'
    $claudeMdHasSgsd = $false
    if (Test-Path -LiteralPath $claudeMd) {
        try {
            $content = Get-Content -LiteralPath $claudeMd -Raw -ErrorAction SilentlyContinue
            if ($content -match 'super-gsd|sgsd|SGSD|Super GSD') { $claudeMdHasSgsd = $true }
        } catch {}
    }
    Add-Check 'claude-md' 'CLAUDE.md with SGSD section' `
        $(if ($claudeMdHasSgsd) { 'OK' } elseif (Test-Path -LiteralPath $claudeMd) { 'WARN' } else { 'MISSING' }) $claudeMd `
        $(if (Test-Path -LiteralPath $claudeMd) { 'Append SGSD overlay section (HTML-comment delimited)' } else { 'Create CLAUDE.md with full SGSD overlay' })

    # 8. AGENTS.md (root) — per-repo agent rules
    $agentsMd = Join-Path $ProjectDir 'AGENTS.md'
    Add-Check 'agents-md' 'AGENTS.md per-repo agent rules' `
        $(if (Test-Path -LiteralPath $agentsMd) { 'OK' } else { 'MISSING' }) $agentsMd `
        'Create AGENTS.md from default template'

    # 9. WARP.md (root) — Warp-specific
    $warpMd = Join-Path $ProjectDir 'WARP.md'
    Add-Check 'warp-md' 'WARP.md Warp-specific instructions' `
        $(if (Test-Path -LiteralPath $warpMd) { 'OK' } else { 'WARN' }) $warpMd `
        'Create WARP.md from default template (only needed if using Warp)'

    # 10. .warpindexingignore
    $wii = Join-Path $ProjectDir '.warpindexingignore'
    Add-Check 'warpindexingignore' '.warpindexingignore present' `
        $(if (Test-Path -LiteralPath $wii) { 'OK' } else { 'MISSING' }) $wii `
        'Create with default exclusions (.planning/, node_modules/, etc.)'

    # 11. .warp/workflows/ (Warp workflow palette)
    $warpWorkflows = Join-Path $ProjectDir '.warp\workflows'
    $warpWorkflowsPresent = Test-Path -LiteralPath $warpWorkflows
    Add-Check 'warp-workflows' '.warp/workflows/ palette' `
        $(if ($warpWorkflowsPresent) { 'OK' } else { 'WARN' }) $warpWorkflows `
        'Junction or copy SGSD workflows from canonical install'

    # 12. .mcp.json (MCP server config)
    $mcpJson = Join-Path $ProjectDir '.mcp.json'
    Add-Check 'mcp-json' '.mcp.json MCP server config' `
        $(if (Test-Path -LiteralPath $mcpJson) { 'OK' } else { 'WARN' }) $mcpJson `
        'Create .mcp.json with default SGSD MCP server entry'

    # 13. .planning/resource-registry/agents.jsonl
    $registry = Join-Path $planning 'resource-registry\agents.jsonl'
    Add-Check 'resource-registry' '.planning/resource-registry/agents.jsonl' `
        $(if (Test-Path -LiteralPath $registry) { 'OK' } else { 'WARN' }) $registry `
        'Snapshot agents.jsonl from canonical or run /gsd-intel refresh'

    # 14. .gitignore SGSD entries
    $gitignore = Join-Path $ProjectDir '.gitignore'
    $gitignoreOk = $false
    if (Test-Path -LiteralPath $gitignore) {
        try {
            $gi = Get-Content -LiteralPath $gitignore -Raw -ErrorAction SilentlyContinue
            if ($gi -match 'ORCHESTRATOR-CHECKPOINT|\.planning/metrics/.*\.jsonl|metrics/\*\.jsonl') {
                $gitignoreOk = $true
            }
        } catch {}
    }
    Add-Check 'gitignore' '.gitignore has SGSD entries' `
        $(if ($gitignoreOk) { 'OK' } elseif (Test-Path -LiteralPath $gitignore) { 'WARN' } else { 'MISSING' }) $gitignore `
        'Append SGSD entries: .planning/metrics/*.jsonl, .planning/ORCHESTRATOR-CHECKPOINT.md, etc.'

    # 15. Auto-memory junction
    # Encoded path: ~/.claude/projects/C--Users-user-<repo>/memory/
    $repoLeaf = Split-Path -Leaf $ProjectDir
    $encoded  = ($ProjectDir -replace '[\\:]', '-') -replace '^-', ''
    $autoMem  = Join-Path $env:USERPROFILE ".claude\projects\$encoded\memory"
    $autoMemLinked = $false
    if (Test-Path -LiteralPath $autoMem) {
        # Check if it's a junction back to .planning/memory/
        try {
            $item = Get-Item -LiteralPath $autoMem -Force -ErrorAction SilentlyContinue
            if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $autoMemLinked = $true }
        } catch {}
    }
    Add-Check 'auto-memory' "Auto-memory at ~/.claude/projects/$encoded/memory linked to .planning/memory/" `
        $(if ($autoMemLinked) { 'OK' } elseif (Test-Path -LiteralPath $autoMem) { 'WARN' } else { 'MISSING' }) $autoMem `
        'Junction auto-memory dir to .planning/memory/ for git tracking'

    # 16. Project-local Codex hook registrations
    $codexHooks = Join-Path $ProjectDir '.codex\hooks.json'
    $codexHookStatus = 'MISSING'
    $codexHookFix = 'Run the SGSD Codex hook safe-merge installer'
    if (Test-Path -LiteralPath $codexHooks) {
        $codexHookStatus = 'WARN'
        if ($sgsdHome) {
            $codexHookInstaller = Join-Path $sgsdHome 'tools\codex-hooks\install-hooks.cjs'
            $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
            if ((Test-Path -LiteralPath $codexHookInstaller) -and $nodeCommand) {
                try {
                    $hookJson = & $nodeCommand.Source $codexHookInstaller `
                        --project $ProjectDir --check --json 2>$null
                    $hookReport = ($hookJson -join "`n") | ConvertFrom-Json -ErrorAction Stop
                    if ($hookReport.ok) {
                        $codexHookStatus = 'OK'
                        $codexHookFix = ''
                    } elseif ($hookReport.status -eq 'stale') {
                        $codexHookStatus = 'STALE'
                        $codexHookFix = "Merge $($hookReport.missing.Count) missing, $($hookReport.stale.Count) stale, and $($hookReport.duplicates.Count) duplicate managed registrations"
                    } else {
                        $codexHookStatus = 'WARN'
                        $codexHookFix = "Repair Codex hook configuration: $($hookReport.status)"
                    }
                } catch {
                    $codexHookStatus = 'WARN'
                    $codexHookFix = 'Codex hook configuration could not be audited; run install-hooks.cjs manually'
                }
            }
        }
    }
    Add-Check 'codex-hooks' 'Project .codex/hooks.json has current SGSD registrations' `
        $codexHookStatus $codexHooks $codexHookFix

    return $checks
}

function Format-SgsdReadinessReport {
    # Non-pipelined: caller passes the full report array.
    # Pipeline mode would split each item into its own invocation.
    param($Report)

    if (-not $Report) { return }
    $reportArr    = @($Report)  # force array shape even on single item
    $okCount      = @($reportArr | Where-Object { $_.Status -eq 'OK' }).Count
    $missingCount = @($reportArr | Where-Object { $_.Status -eq 'MISSING' }).Count
    $warnCount    = @($reportArr | Where-Object { $_.Status -eq 'WARN' }).Count
    $total        = $reportArr.Count

    Write-Host ""
    Write-Host "SGSD readiness: " -NoNewline -ForegroundColor White
    Write-Host "$okCount OK" -NoNewline -ForegroundColor Green
    Write-Host " · " -NoNewline -ForegroundColor DarkGray
    Write-Host "$missingCount missing" -NoNewline -ForegroundColor Red
    Write-Host " · " -NoNewline -ForegroundColor DarkGray
    Write-Host "$warnCount warn" -NoNewline -ForegroundColor Yellow
    Write-Host " (total $total)"
    Write-Host ""

    foreach ($c in $reportArr) {
        $glyph = switch ($c.Status) {
            'OK'      { '✓' }
            'MISSING' { '✗' }
            'STALE'   { '↻' }
            'WARN'    { '⚠' }
            default   { '·' }
        }
        $color = switch ($c.Status) {
            'OK'      { 'Green' }
            'MISSING' { 'Red' }
            'STALE'   { 'Yellow' }
            'WARN'    { 'Yellow' }
            default   { 'DarkGray' }
        }
        Write-Host ("  {0} {1,-22} " -f $glyph, $c.Id) -NoNewline -ForegroundColor $color
        Write-Host $c.Description -ForegroundColor Gray
    }
    Write-Host ""
}
