# ============================================================================
# Super GSD - Project Knowledge Setup
# ============================================================================
# One-time project configuration for:
#   - private knowledge-bank directory, if the operator has one
#   - SGSD's project memory directory
#   - public/bundled fallback corpus when no private bank exists
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
