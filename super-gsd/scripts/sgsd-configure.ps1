# ============================================================================
# Super GSD - Project Knowledge Setup
# ============================================================================
# One-time project configuration for:
#   - private knowledge-bank directory, if the operator has one
#   - SGSD's project memory directory
#   - public/bundled fallback corpus when no private bank exists
#   - read-only Claude/Codex readiness reporting for first-run operators
#
# SCOPE BOUNDARY (Phase 59-01):
#   This script owns the `knowledge` block ONLY. Provider readiness is reported
#   to the console but never written to config. Project-level keys
#   (cockpit panel layout, default boot mode, operator preferences) are
#   owned by sgsd-new-project-wizard.cjs. The two are complementary; each
#   leaves the other byte-untouched on every run. To configure project
#   defaults after running sgsd-configure.ps1, run:
#     node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults
#   The wizard is non-destructive (deep-merge, never clobbers existing
#   keys) and idempotent (re-run produces byte-identical config).
# ============================================================================

param(
    [string]$ProjectDir = ".",
    [string]$KnowledgeRoot = "",
    [string]$MemoryRoot = ".planning/memory",
    [ValidateSet("sgsd-bundled-research", "public-software-engineering", "none")]
    [string]$FallbackCorpus = "sgsd-bundled-research",
    [switch]$NonInteractive,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

try {
    $ProjectDir = (Resolve-Path -LiteralPath $ProjectDir -ErrorAction Stop).Path
} catch {
    Write-Host "ERROR: Cannot resolve project dir: $ProjectDir" -ForegroundColor Red
    exit 1
}

$planningDir = Join-Path $ProjectDir ".planning"
$configPath = Join-Path $planningDir "config.json"
if (-not (Test-Path $planningDir)) {
    Write-Host "ERROR: .planning directory not found at $planningDir" -ForegroundColor Red
    Write-Host "Run SGSD install/backfill first, then rerun sgsd-setup." -ForegroundColor DarkGray
    exit 2
}

function Get-SgsdCliStatus {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [string[]]$VersionArgs = @("--version")
    )

    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $cmd) {
        return [pscustomobject]@{
            Name = $Name
            Found = $false
            Version = ""
            Detail = "not on PATH"
        }
    }

    $version = ""
    try {
        $out = & $Name @VersionArgs 2>&1 | Select-Object -First 1
        if ($out) { $version = ($out | Out-String).Trim() }
    } catch {
        $version = "version check failed: $($_.Exception.Message)"
    }

    return [pscustomobject]@{
        Name = $Name
        Found = $true
        Version = $version
        Detail = $cmd.Source
    }
}

function Test-SgsdCodexLogin {
    $codex = Get-Command codex -ErrorAction SilentlyContinue
    if (-not $codex) {
        return [pscustomobject]@{
            Available = $false
            Detail = "codex not on PATH; run: npm install -g @openai/codex"
        }
    }

    $oldErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $out = & codex login status 2>&1 | Out-String
        if ($out -match "Logged in") {
            return [pscustomobject]@{
                Available = $true
                Detail = ($out -replace "\s+", " ").Trim()
            }
        }
        return [pscustomobject]@{
            Available = $false
            Detail = "codex login not confirmed; run: codex login"
        }
    } catch {
        return [pscustomobject]@{
            Available = $false
            Detail = "codex login status failed: $($_.Exception.Message)"
        }
    } finally {
        $ErrorActionPreference = $oldErrorActionPreference
    }
}

function Write-SgsdProviderReadiness {
    Write-Host ""
    Write-Host "SGSD provider readiness" -ForegroundColor White

    $claude = Get-SgsdCliStatus -Name "claude"
    if ($claude.Found) {
        Write-Host "  Claude Code CLI: found ($($claude.Version))" -ForegroundColor Green
    } else {
        Write-Host "  Claude Code CLI: missing - install/login with Claude Code, then run: claude" -ForegroundColor Yellow
    }

    $codex = Get-SgsdCliStatus -Name "codex"
    if ($codex.Found) {
        Write-Host "  Codex CLI:      found ($($codex.Version))" -ForegroundColor Green
    } else {
        Write-Host "  Codex CLI:      missing - run: npm install -g @openai/codex" -ForegroundColor Yellow
    }

    $codexLogin = Test-SgsdCodexLogin
    if ($codexLogin.Available) {
        Write-Host "  Codex login:    available" -ForegroundColor Green
    } else {
        Write-Host "  Codex login:    not ready - $($codexLogin.Detail)" -ForegroundColor Yellow
    }

    Write-Host "  API keys:       not requested; SGSD uses Claude/Codex CLI OAuth for normal setup" -ForegroundColor DarkGray
}

if (-not $NonInteractive) {
    Write-Host ""
    Write-Host "SGSD Project Knowledge Setup" -ForegroundColor Magenta
    Write-Host "----------------------------" -ForegroundColor Magenta
    Write-Host "Private knowledge bank can be a folder of markdown/PDF/text exports, a synced notes vault, or a local KB repo." -ForegroundColor DarkGray
    Write-Host "Leave blank if this project has no private knowledge bank yet." -ForegroundColor DarkGray
    Write-Host ""

    $inputKnowledge = Read-Host "Private knowledge bank directory"
    if (-not [string]::IsNullOrWhiteSpace($inputKnowledge)) {
        $KnowledgeRoot = $inputKnowledge.Trim()
    }

    $inputMemory = Read-Host "SGSD memory directory [`"$MemoryRoot`"]"
    if (-not [string]::IsNullOrWhiteSpace($inputMemory)) {
        $MemoryRoot = $inputMemory.Trim()
    }

    Write-Host ""
    Write-Host "Fallback corpus when no private bank is available:" -ForegroundColor White
    Write-Host "  1. sgsd-bundled-research       local SGSD docs, briefs, decisions, and seeded memory"
    Write-Host "  2. public-software-engineering curated public software/system design references"
    Write-Host "  3. none                        disable fallback enrichment"
    $choice = Read-Host "Fallback [1]"
    switch ($choice.Trim()) {
        "2" { $FallbackCorpus = "public-software-engineering" }
        "3" { $FallbackCorpus = "none" }
        default { $FallbackCorpus = "sgsd-bundled-research" }
    }
}

$knowledgeRootResolved = $null
if (-not [string]::IsNullOrWhiteSpace($KnowledgeRoot)) {
    try {
        $knowledgeRootResolved = (Resolve-Path -LiteralPath $KnowledgeRoot -ErrorAction Stop).Path
    } catch {
        Write-Host "ERROR: Knowledge bank directory does not exist: $KnowledgeRoot" -ForegroundColor Red
        Write-Host "Create it first, or rerun setup and leave it blank." -ForegroundColor DarkGray
        exit 3
    }
}

$memoryRootValue = $MemoryRoot
$memoryRootPath = if ([IO.Path]::IsPathRooted($MemoryRoot)) {
    $MemoryRoot
} else {
    Join-Path $ProjectDir $MemoryRoot
}

$cfg = [ordered]@{}
if (Test-Path $configPath) {
    $raw = Get-Content $configPath -Raw
    if (-not [string]::IsNullOrWhiteSpace($raw)) {
        $parsed = $raw | ConvertFrom-Json
        foreach ($prop in $parsed.PSObject.Properties) {
            $cfg[$prop.Name] = $prop.Value
        }
    }
}

$publicSources = @(
    [ordered]@{
        id = "sgsd-bundled-research"
        mode = "local"
        enabled = ($FallbackCorpus -eq "sgsd-bundled-research")
        description = "Local SGSD docs, briefs, decisions, milestones, and seeded project memory."
        roots = @("README.md", "super-gsd/docs", ".planning/briefs", ".planning/decisions", ".planning/memory")
    },
    [ordered]@{
        id = "arxiv-cs"
        mode = "online"
        enabled = ($FallbackCorpus -eq "public-software-engineering")
        url = "https://arxiv.org/"
        description = "Open computer-science research discovery; use metadata/abstracts first, PDFs only when licensing and relevance are clear."
    },
    [ordered]@{
        id = "google-sre"
        mode = "online"
        enabled = ($FallbackCorpus -eq "public-software-engineering")
        url = "https://sre.google/books/"
        description = "Google SRE books for reliability, incident response, toil, SLOs, and operational design."
    },
    [ordered]@{
        id = "nasa-systems-engineering"
        mode = "online"
        enabled = ($FallbackCorpus -eq "public-software-engineering")
        url = "https://www.nasa.gov/reference/systems-engineering-handbook/"
        description = "NASA systems engineering handbook for lifecycle, verification, validation, and gate discipline."
    },
    [ordered]@{
        id = "microsoft-api-guidelines"
        mode = "online"
        enabled = ($FallbackCorpus -eq "public-software-engineering")
        url = "https://github.com/microsoft/api-guidelines"
        description = "Microsoft REST API guidelines for public API design and governance."
    },
    [ordered]@{
        id = "aosa"
        mode = "online"
        enabled = ($FallbackCorpus -eq "public-software-engineering")
        url = "https://aosabook.org/en/"
        description = "Architecture of Open Source Applications case studies for real system structure."
    }
)

$cfg["knowledge"] = [ordered]@{
    version = 1
    private_root = $knowledgeRootResolved
    memory_root = $memoryRootValue
    fallback_corpus = $FallbackCorpus
    public_sources = $publicSources
    notes = "Private knowledge stays optional. SGSD memory is project-local by default. Public sources are discovery targets, not blindly ingested content."
}

$json = $cfg | ConvertTo-Json -Depth 20

if ($DryRun) {
    Write-Host $json
    exit 0
}

if (-not (Test-Path $memoryRootPath)) {
    New-Item -ItemType Directory -Path $memoryRootPath -Force | Out-Null
}

Set-Content -Path $configPath -Value ($json + "`n")

Write-Host ""
Write-Host "SGSD knowledge configuration written." -ForegroundColor Green
Write-Host "  Config:       $configPath" -ForegroundColor DarkGray
Write-Host "  Memory root:  $memoryRootPath" -ForegroundColor DarkGray
if ($knowledgeRootResolved) {
    Write-Host "  Private KB:   $knowledgeRootResolved" -ForegroundColor DarkGray
} else {
    Write-Host "  Private KB:   not configured" -ForegroundColor DarkGray
}
Write-Host "  Fallback:     $FallbackCorpus" -ForegroundColor DarkGray

Write-SgsdProviderReadiness

# ----------------------------------------------------------------------------
# Phase 59-01: optional non-destructive invocation hook to the project-level
# wizard. The wizard owns project keys (cockpit panes, default boot mode);
# this hook only suggests it -- never invokes automatically -- so the
# byte-equality contract for the knowledge block above is preserved.
# Operators who want the project block can run the suggested command.
# ----------------------------------------------------------------------------
$wizardPath = Join-Path $ProjectDir "super-gsd/scripts/sgsd-new-project-wizard.cjs"
if (Test-Path $wizardPath) {
    Write-Host ""
    Write-Host "Project-level defaults (cockpit panes, boot mode) are owned by the wizard:" -ForegroundColor White
    Write-Host "  node super-gsd/scripts/sgsd-new-project-wizard.cjs --defaults" -ForegroundColor DarkGray
    Write-Host "Wizard is non-destructive (deep-merge) and idempotent." -ForegroundColor DarkGray
}
