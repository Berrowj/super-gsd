# =============================================================================
# super-gsd/scripts/lib/render-cockpit-snapshot.ps1
# Phase 77-01: Warp-friendly cockpit snapshot renderer.
#
# Wraps `node super-gsd/tools/cockpit-state/adapter.cjs --json` and renders
# the 11-section snapshot to console. Operators can call this directly or
# wire it into existing cockpit panes (sgsd-mission-control.ps1 etc.) at
# their pace.
#
# Phase 86 update: SECTIONS array grew from 10 to 11 entries with the
# insertion of `staleness` between `artifacts` and `resume_command`.
#
# USAGE:
#   . super-gsd/scripts/lib/render-cockpit-snapshot.ps1 -ProjectDir <path>
#   . super-gsd/scripts/lib/render-cockpit-snapshot.ps1 -ProjectDir <path> -Section blockers
#   . super-gsd/scripts/lib/render-cockpit-snapshot.ps1 -ProjectDir <path> -Json
#   . super-gsd/scripts/lib/render-cockpit-snapshot.ps1 -Help
#
# ASCII-only.
# =============================================================================

[CmdletBinding()]
param(
    [string]$ProjectDir = (Get-Location).Path,
    [string]$Section = '',
    [switch]$Json,
    [switch]$Help
)

$SECTIONS = @('now','objective','unlock','blockers','agents','codex','gates','tokens','artifacts','staleness','resume_command')

function Show-Help {
    Write-Host 'render-cockpit-snapshot.ps1 -- Warp-friendly cockpit snapshot renderer' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Usage:'
    Write-Host '  -ProjectDir <path>   Project root containing .planning and super-gsd (default: cwd)'
    Write-Host '  -Section <name>      Render only this section. Names:'
    Write-Host ('                       ' + ($SECTIONS -join ', '))
    Write-Host '  -Json                Emit raw adapter JSON (for piping)'
    Write-Host '  -Help                This help'
    Write-Host ''
    Write-Host 'Exit codes:'
    Write-Host '  0  snapshot rendered successfully'
    Write-Host '  1  adapter returned ok:false'
    Write-Host '  2  unknown section name'
}

function Get-Snapshot {
    param([string]$Dir)
    $adapterPath = Join-Path $Dir 'super-gsd/tools/cockpit-state/adapter.cjs'
    if (-not (Test-Path -LiteralPath $adapterPath)) {
        return $null
    }
    try {
        $raw = & node $adapterPath --json --project $Dir 2>$null
        if (-not $raw) { return $null }
        return ($raw | Out-String | ConvertFrom-Json)
    } catch {
        return $null
    }
}

function Render-Section {
    param(
        [string]$Name,
        $Data
    )
    Write-Host ''
    Write-Host ("== " + $Name.ToUpper() + " ==") -ForegroundColor Cyan
    if ($null -eq $Data) {
        Write-Host '  (empty)' -ForegroundColor DarkGray
        return
    }
    if ($Data -is [string]) {
        Write-Host ('  ' + $Data)
        return
    }
    if ($Data -is [System.Array] -or $Data -is [System.Collections.IList]) {
        if ($Data.Count -eq 0) {
            Write-Host '  (empty)' -ForegroundColor DarkGray
            return
        }
        foreach ($row in $Data) {
            if ($row -is [string]) {
                Write-Host ('  - ' + $row)
            } else {
                Write-Host ('  - ' + (ConvertTo-Json -InputObject $row -Compress -Depth 3))
            }
        }
        return
    }
    $props = $Data.PSObject.Properties
    if (-not $props) {
        Write-Host ('  ' + (ConvertTo-Json -InputObject $Data -Compress -Depth 3))
        return
    }
    $hasAny = $false
    foreach ($p in $props) {
        $hasAny = $true
        $v = $p.Value
        if ($null -eq $v) {
            Write-Host ('  ' + $p.Name + ': (null)') -ForegroundColor DarkGray
        } elseif ($v -is [string]) {
            Write-Host ('  ' + $p.Name + ': ' + $v)
        } elseif ($v -is [int] -or $v -is [long] -or $v -is [double] -or $v -is [bool]) {
            Write-Host ('  ' + $p.Name + ': ' + $v)
        } elseif ($v -is [System.Array] -or $v -is [System.Collections.IList]) {
            Write-Host ('  ' + $p.Name + ': [' + $v.Count + ' rows]')
        } else {
            Write-Host ('  ' + $p.Name + ': ' + (ConvertTo-Json -InputObject $v -Compress -Depth 3))
        }
    }
    if (-not $hasAny) {
        Write-Host '  (empty)' -ForegroundColor DarkGray
    }
}

if ($Help) {
    Show-Help
    exit 0
}

if ($Section -and -not ($SECTIONS -contains $Section)) {
    Write-Error ("Unknown section: " + $Section + ". Valid: " + ($SECTIONS -join ', '))
    exit 2
}

$snap = Get-Snapshot -Dir $ProjectDir
if ($null -eq $snap) {
    Write-Error "Adapter unavailable; cannot render snapshot."
    exit 1
}
if (-not $snap.ok) {
    Write-Error ("Adapter returned ok:false. error=" + $snap.error)
    exit 1
}

if ($Json) {
    $snap | ConvertTo-Json -Depth 10
    exit 0
}

Write-Host ''
Write-Host ("SGSD Cockpit Snapshot -- " + $snap.ts) -ForegroundColor White
Write-Host ('schema_version=' + $snap.schema_version + '  project=' + $ProjectDir) -ForegroundColor DarkGray

if ($Section) {
    $sectionData = $snap.data.$Section
    Render-Section -Name $Section -Data $sectionData
} else {
    foreach ($s in $SECTIONS) {
        Render-Section -Name $s -Data $snap.data.$s
    }
}

Write-Host ''
exit 0
