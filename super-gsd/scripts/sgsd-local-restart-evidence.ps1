#requires -Version 5.1

<#
.SYNOPSIS
Captures identity-verified local SGSD MCP and cockpit restart evidence.

.DESCRIPTION
Prepare records and terminates only MCP/cockpit processes whose current
Win32_Process identity still matches the displayed PID, CreationDate, and
command line. It then starts a fresh cockpit through sgsd-refresh.

Finalize is intentionally a separate invocation: the owning Warp/Claude
session must be restarted between modes so it can create new MCP children.
Finalize refuses evidence when an old MCP identity survives, provenance is
not rooted at ExpectedMcpRoot, or any recorded after identity is not live.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Prepare', 'Finalize')]
    [string]$Mode,

    [Parameter(Mandatory = $true)]
    [string]$Project,

    [Parameter(Mandatory = $true)]
    [string]$ExpectedMcpRoot,

    [Parameter(Mandatory = $true)]
    [string]$EvidencePath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Schema = 'sgsd.restart-evidence.v1'

function Resolve-SgsdDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Label
    )

    try {
        $resolved = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
    } catch {
        throw "$Label does not exist or cannot be resolved: $Path"
    }
    if (-not (Test-Path -LiteralPath $resolved -PathType Container)) {
        throw "$Label is not a directory: $resolved"
    }
    return [IO.Path]::GetFullPath($resolved).TrimEnd('\', '/')
}

function Test-SgsdPathWithinProject {
    param(
        [Parameter(Mandatory = $true)][string]$Candidate,
        [Parameter(Mandatory = $true)][string]$ProjectRoot
    )

    $candidateFull = [IO.Path]::GetFullPath($Candidate)
    $projectPrefix = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar
    return $candidateFull.StartsWith($projectPrefix, [StringComparison]::OrdinalIgnoreCase)
}

function Convert-SgsdCreationDate {
    param([Parameter(Mandatory = $true)]$CreationDate)

    try {
        return ([DateTime]$CreationDate).ToUniversalTime().ToString(
            'o',
            [Globalization.CultureInfo]::InvariantCulture
        )
    } catch {
        throw "Could not normalize Win32_Process CreationDate: $CreationDate"
    }
}

function ConvertTo-SgsdProcessIdentity {
    param([Parameter(Mandatory = $true)]$Process)

    if ([string]::IsNullOrWhiteSpace([string]$Process.CommandLine)) {
        throw "Process $($Process.ProcessId) has no inspectable CommandLine"
    }
    $startedUtc = Convert-SgsdCreationDate -CreationDate $Process.CreationDate
    return [pscustomobject][ordered]@{
        pid           = [int]$Process.ProcessId
        creation_date = $startedUtc
        started_utc   = $startedUtc
        command_line  = [string]$Process.CommandLine
        live_at_write = $true
    }
}

function Get-SgsdIdentityKey {
    param([Parameter(Mandatory = $true)]$Identity)
    return '{0}|{1}' -f ([int]$Identity.pid), ([string]$Identity.started_utc)
}

function Test-SgsdCommandRoot {
    param(
        [Parameter(Mandatory = $true)][string]$CommandLine,
        [Parameter(Mandatory = $true)][string]$Root
    )

    $normalizedCommand = $CommandLine.Replace('/', '\')
    $normalizedRoot = $Root.Replace('/', '\').TrimEnd('\')
    return $normalizedCommand.IndexOf(
        $normalizedRoot,
        [StringComparison]::OrdinalIgnoreCase
    ) -ge 0
}

function Test-SgsdMcpCommandLine {
    param(
        [Parameter(Mandatory = $true)][string]$CommandLine,
        [Parameter(Mandatory = $true)][string]$Root
    )

    return ($CommandLine -match '(?i)mcp') -and
        (Test-SgsdCommandRoot -CommandLine $CommandLine -Root $Root)
}

function Test-SgsdCockpitCommandLine {
    param(
        [Parameter(Mandatory = $true)][string]$CommandLine,
        [Parameter(Mandatory = $true)][string]$ProjectRoot
    )

    return ($CommandLine -match '(?i)cockpit-sidecar[\\/]serve\.cjs') -and
        (Test-SgsdCommandRoot -CommandLine $CommandLine -Root $ProjectRoot)
}

function Get-SgsdProcessIdentityByPid {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    $process = Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    if (-not $process) { return $null }
    return ConvertTo-SgsdProcessIdentity -Process $process
}

function Get-SgsdMatchingMcpProcesses {
    param([Parameter(Mandatory = $true)][string]$Root)

    return @(
        Get-CimInstance -ClassName Win32_Process -ErrorAction Stop |
            Where-Object {
                [int]$_.ProcessId -ne $PID -and
                -not [string]::IsNullOrWhiteSpace([string]$_.CommandLine) -and
                (Test-SgsdMcpCommandLine -CommandLine ([string]$_.CommandLine) -Root $Root)
            } |
            ForEach-Object { ConvertTo-SgsdProcessIdentity -Process $_ }
    )
}

function Get-SgsdCockpitIdentity {
    param([Parameter(Mandatory = $true)][string]$ProjectRoot)

    $pidPath = Join-Path $ProjectRoot '.planning\runtime\cockpit-server.pid'
    if (-not (Test-Path -LiteralPath $pidPath -PathType Leaf)) {
        throw "Cockpit PID file is missing: $pidPath"
    }
    $rawPid = (Get-Content -LiteralPath $pidPath -TotalCount 1 -ErrorAction Stop).Trim()
    if ($rawPid -notmatch '^\d+$' -or [int64]$rawPid -gt [int]::MaxValue -or [int]$rawPid -le 0) {
        throw "cockpit-server.pid is not a positive process ID: $rawPid"
    }
    $identity = Get-SgsdProcessIdentityByPid -ProcessId ([int]$rawPid)
    if (-not $identity) {
        throw "Cockpit PID is not live: $rawPid"
    }
    if (-not (Test-SgsdCockpitCommandLine -CommandLine $identity.command_line -ProjectRoot $ProjectRoot)) {
        throw "Cockpit PID $rawPid does not run cockpit-sidecar/serve.cjs for $ProjectRoot"
    }
    return $identity
}

function Get-SgsdLiveIdentity {
    param([Parameter(Mandatory = $true)]$Identity)

    $current = Get-SgsdProcessIdentityByPid -ProcessId ([int]$Identity.pid)
    if (-not $current) { return $null }
    if ((Get-SgsdIdentityKey -Identity $current) -ne (Get-SgsdIdentityKey -Identity $Identity)) {
        return $null
    }
    if ($current.command_line -cne [string]$Identity.command_line) {
        return $null
    }
    return $current
}

function Stop-SgsdVerifiedIdentity {
    param(
        [Parameter(Mandatory = $true)]$Identity,
        [Parameter(Mandatory = $true)][ValidateSet('MCP', 'Cockpit')][string]$Kind,
        [Parameter(Mandatory = $true)][string]$ExpectedRoot
    )

    $current = Get-SgsdLiveIdentity -Identity $Identity
    if (-not $current) {
        Write-Host "$Kind identity already stopped or replaced; no signal sent: $(Get-SgsdIdentityKey $Identity)"
        return
    }

    $provenanceOk = if ($Kind -eq 'MCP') {
        Test-SgsdMcpCommandLine -CommandLine $current.command_line -Root $ExpectedRoot
    } else {
        Test-SgsdCockpitCommandLine -CommandLine $current.command_line -ProjectRoot $ExpectedRoot
    }
    if (-not $provenanceOk) {
        throw "$Kind PID $($Identity.pid) changed provenance after confirmation; refusing Stop-Process"
    }

    Stop-Process -Id ([int]$Identity.pid) -ErrorAction Stop
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        Start-Sleep -Milliseconds 100
        if (-not (Get-SgsdLiveIdentity -Identity $Identity)) { return }
    }
    throw "$Kind identity did not stop: $(Get-SgsdIdentityKey $Identity)"
}

function Test-SgsdIdentityLiveWithProvenance {
    param(
        [Parameter(Mandatory = $true)]$Identity,
        [Parameter(Mandatory = $true)][ValidateSet('MCP', 'Cockpit')][string]$Kind,
        [Parameter(Mandatory = $true)][string]$ExpectedRoot
    )

    $current = Get-SgsdLiveIdentity -Identity $Identity
    if (-not $current) { return $false }
    if ($Kind -eq 'MCP') {
        return Test-SgsdMcpCommandLine -CommandLine $current.command_line -Root $ExpectedRoot
    }
    return Test-SgsdCockpitCommandLine -CommandLine $current.command_line -ProjectRoot $ExpectedRoot
}

function Protect-SgsdOutput {
    param([AllowNull()][object[]]$Lines)

    $text = (@($Lines) | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
    $text = $text -replace '(?im)\b(api[_-]?key|token|password|secret)\s*[:=]\s*(?:"[^"]*"|''[^'']*''|\S+)', '$1=<redacted>'
    $text = $text -replace '(?i)\bBearer\s+[A-Za-z0-9._~+/-]+=*', 'Bearer <redacted>'
    return $text
}

function Write-SgsdEvidence {
    param(
        [Parameter(Mandatory = $true)]$Evidence,
        [Parameter(Mandatory = $true)][string]$Path
    )

    $temporaryPath = '{0}.tmp.{1}.{2}' -f $Path, $PID, ([Guid]::NewGuid().ToString('N'))
    $json = $Evidence | ConvertTo-Json -Depth 16
    $utf8NoBom = New-Object Text.UTF8Encoding($false)
    try {
        [IO.File]::WriteAllText($temporaryPath, $json + [Environment]::NewLine, $utf8NoBom)
        Move-Item -LiteralPath $temporaryPath -Destination $Path -Force -ErrorAction Stop
    } finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
        }
    }
}

$ProjectRoot = Resolve-SgsdDirectory -Path $Project -Label 'Project'
$ExpectedRoot = Resolve-SgsdDirectory -Path $ExpectedMcpRoot -Label 'ExpectedMcpRoot'
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot '.planning') -PathType Container)) {
    throw "Project has no .planning directory: $ProjectRoot"
}

$EvidenceFile = if ([IO.Path]::IsPathRooted($EvidencePath)) {
    [IO.Path]::GetFullPath($EvidencePath)
} else {
    [IO.Path]::GetFullPath((Join-Path $ProjectRoot $EvidencePath))
}
if (-not (Test-SgsdPathWithinProject -Candidate $EvidenceFile -ProjectRoot $ProjectRoot)) {
    throw "EvidencePath must remain inside Project: $EvidenceFile"
}
$EvidenceDirectory = Split-Path -Parent $EvidenceFile
if (-not (Test-Path -LiteralPath $EvidenceDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $EvidenceDirectory -Force -ErrorAction Stop | Out-Null
}
$EvidenceDirectory = (Resolve-Path -LiteralPath $EvidenceDirectory -ErrorAction Stop).Path
if (-not (Test-SgsdPathWithinProject -Candidate $EvidenceDirectory -ProjectRoot $ProjectRoot)) {
    throw "Resolved evidence directory escapes Project: $EvidenceDirectory"
}

if ($Mode -eq 'Prepare') {
    $profileCommands = @(Get-Command -Name @('sg', 'sgsd', 'sgsd-refresh') -ErrorAction Stop)
    if ($profileCommands.Count -ne 3) {
        throw 'The current PowerShell session does not expose sg, sgsd, and sgsd-refresh'
    }

    $BeforeMcp = @(Get-SgsdMatchingMcpProcesses -Root $ExpectedRoot)
    if ($BeforeMcp.Count -lt 1) {
        throw "No matching MCP process uses ExpectedMcpRoot: $ExpectedRoot"
    }
    $BeforeCockpit = Get-SgsdCockpitIdentity -ProjectRoot $ProjectRoot

    Write-Host 'Verified MCP command lines selected for termination:' -ForegroundColor Yellow
    foreach ($identity in $BeforeMcp) {
        Write-Host ("  PID={0} CreationDate={1} CommandLine={2}" -f $identity.pid, $identity.creation_date, $identity.command_line)
    }
    Write-Host ("Verified cockpit CommandLine: PID={0} CreationDate={1} CommandLine={2}" -f $BeforeCockpit.pid, $BeforeCockpit.creation_date, $BeforeCockpit.command_line)

    $confirmation = Read-Host 'Type KILL to terminate only the verified MCP and cockpit identities'
    if ($confirmation -cne 'KILL') {
        throw 'Confirmation declined; no process was terminated'
    }

    foreach ($identity in $BeforeMcp) {
        Stop-SgsdVerifiedIdentity -Identity $identity -Kind MCP -ExpectedRoot $ExpectedRoot
    }
    Stop-SgsdVerifiedIdentity -Identity $BeforeCockpit -Kind Cockpit -ExpectedRoot $ProjectRoot

    $ExactCommand = 'sgsd-refresh -ProjectDir "{0}" -SkipPreflight' -f ($ProjectRoot -replace '"', '""')
    $LASTEXITCODE = 0
    $refreshOutput = @(& sgsd-refresh -ProjectDir $ProjectRoot -SkipPreflight 2>&1)
    $refreshSucceeded = $?
    $refreshExitStatus = $LASTEXITCODE
    if (-not $refreshSucceeded -or $refreshExitStatus -ne 0) {
        throw "sgsd-refresh failed while restarting the cockpit (native status $refreshExitStatus)"
    }

    $AfterCockpit = $null
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        try {
            $AfterCockpit = Get-SgsdCockpitIdentity -ProjectRoot $ProjectRoot
        } catch {
            $AfterCockpit = $null
        }
        if ($AfterCockpit -and
            (Get-SgsdIdentityKey $AfterCockpit) -ne (Get-SgsdIdentityKey $BeforeCockpit)) {
            break
        }
        Start-Sleep -Milliseconds 500
    }
    $cockpit_identity_changed = $AfterCockpit -and
        ((Get-SgsdIdentityKey $AfterCockpit) -ne (Get-SgsdIdentityKey $BeforeCockpit))
    if (-not $cockpit_identity_changed) {
        throw 'Cockpit identity did not change after sgsd-refresh'
    }
    if (-not (Test-SgsdIdentityLiveWithProvenance -Identity $AfterCockpit -Kind Cockpit -ExpectedRoot $ProjectRoot)) {
        throw 'Restarted cockpit identity is not live with canonical cockpit provenance'
    }

    $capturedUtc = [DateTime]::UtcNow.ToString('o', [Globalization.CultureInfo]::InvariantCulture)
    $machine = [Environment]::MachineName
    $redactedOutput = Protect-SgsdOutput -Lines $refreshOutput
    $profile = [ordered]@{
        exit            = 0
        exit_status     = 'passed'
        exact_command   = 'Get-Command sg,sgsd,sgsd-refresh -ErrorAction Stop'
        captured_utc    = $capturedUtc
        machine         = $machine
        live_at_write   = $true
        redacted_output = 'Commands resolved in the current PowerShell session.'
    }
    $localMcp = [ordered]@{
        exit                     = $null
        exit_status              = 'pending_session_restart'
        before_mcp_present       = $true
        after_mcp_present        = $false
        identity_intersection    = @()
        canonical_mcp_provenance = $false
        after_identities_live     = $false
        expected_root             = $ExpectedRoot
        before                    = @($BeforeMcp)
        after                     = @()
        exact_command             = 'Stop-Process for each freshly verified MCP identity'
        captured_utc              = $capturedUtc
        machine                   = $machine
        live_at_write             = $false
        redacted_output           = 'MCP after-evidence is intentionally deferred to Finalize.'
    }
    $localCockpit = [ordered]@{
        exit                     = 0
        exit_status              = 'passed'
        cockpit_identity_changed = [bool]$cockpit_identity_changed
        before                   = $BeforeCockpit
        after                    = $AfterCockpit
        exact_command            = $ExactCommand
        captured_utc             = $capturedUtc
        machine                  = $machine
        live_at_write            = $true
        redacted_output          = $redactedOutput
    }
    $prepareEvidence = [ordered]@{
        schema            = $Schema
        mode              = 'Prepare'
        exit_status       = 'pending_session_restart'
        project           = $ProjectRoot
        expected_mcp_root = $ExpectedRoot
        evidence_path     = $EvidenceFile
        exact_command     = $ExactCommand
        captured_utc      = $capturedUtc
        machine           = $machine
        live_at_write     = $true
        redacted_output   = $redactedOutput
        profile           = $profile
        local_mcp         = $localMcp
        local_cockpit     = $localCockpit
        components        = [ordered]@{
            mcp_restart     = $localMcp
            cockpit_restart = $localCockpit
        }
    }
    Write-SgsdEvidence -Evidence $prepareEvidence -Path $EvidenceFile
    Write-Host "Prepare evidence written: $EvidenceFile" -ForegroundColor Green
    Write-Host 'Restart the owning Warp/Claude session, then invoke this helper with -Mode Finalize.' -ForegroundColor Yellow
    return
}

if (-not (Test-Path -LiteralPath $EvidenceFile -PathType Leaf)) {
    throw "Finalize requires Prepare evidence: $EvidenceFile"
}
$Prior = Get-Content -Raw -LiteralPath $EvidenceFile -ErrorAction Stop | ConvertFrom-Json
if ([string]$Prior.schema -cne $Schema -or [string]$Prior.mode -cne 'Prepare') {
    throw 'Finalize requires sgsd.restart-evidence.v1 Prepare evidence'
}
if ([string]$Prior.project -ine $ProjectRoot -or
    [string]$Prior.expected_mcp_root -ine $ExpectedRoot) {
    throw 'Finalize Project or ExpectedMcpRoot differs from Prepare evidence'
}

$BeforeMcp = @($Prior.components.mcp_restart.before)
if ($BeforeMcp.Count -lt 1) {
    throw 'Prepare evidence contains no before MCP identity'
}
$AfterMcp = @(Get-SgsdMatchingMcpProcesses -Root $ExpectedRoot)
if ($AfterMcp.Count -lt 1) {
    throw "No matching after MCP process uses ExpectedMcpRoot: $ExpectedRoot"
}

$beforeKeys = [Collections.Generic.HashSet[string]]::new([StringComparer]::Ordinal)
foreach ($identity in $BeforeMcp) {
    [void]$beforeKeys.Add((Get-SgsdIdentityKey -Identity $identity))
}
$identity_intersection = @(
    $AfterMcp |
        ForEach-Object { Get-SgsdIdentityKey -Identity $_ } |
        Where-Object { $beforeKeys.Contains($_) }
)
if ($identity_intersection.Count -ne 0) {
    throw "Prior MCP identity survived the owning-session restart: $($identity_intersection -join ', ')"
}

$canonical_mcp_provenance = @(
    $AfterMcp | Where-Object {
        -not (Test-SgsdMcpCommandLine -CommandLine $_.command_line -Root $ExpectedRoot)
    }
).Count -eq 0
if (-not $canonical_mcp_provenance) {
    throw 'An after MCP command line lacks canonical MCP provenance'
}

$after_identities_live = @(
    $AfterMcp | Where-Object {
        -not (Test-SgsdIdentityLiveWithProvenance -Identity $_ -Kind MCP -ExpectedRoot $ExpectedRoot)
    }
).Count -eq 0
if (-not $after_identities_live) {
    throw 'An after MCP identity is no longer live with canonical provenance'
}

$BeforeCockpit = $Prior.components.cockpit_restart.before
$AfterCockpit = Get-SgsdCockpitIdentity -ProjectRoot $ProjectRoot
$cockpit_identity_changed = (Get-SgsdIdentityKey -Identity $AfterCockpit) -ne
    (Get-SgsdIdentityKey -Identity $BeforeCockpit)
if (-not $cockpit_identity_changed) {
    throw 'Cockpit still has its pre-Prepare PID plus CreationDate identity'
}
if (-not (Test-SgsdIdentityLiveWithProvenance -Identity $AfterCockpit -Kind Cockpit -ExpectedRoot $ProjectRoot)) {
    throw 'After cockpit identity is not live with canonical cockpit provenance'
}

$capturedUtc = [DateTime]::UtcNow.ToString('o', [Globalization.CultureInfo]::InvariantCulture)
$machine = [Environment]::MachineName
$ExactCommand = 'sgsd-local-restart-evidence.ps1 -Mode Finalize -Project "{0}" -ExpectedMcpRoot "{1}" -EvidencePath "{2}"' -f $ProjectRoot, $ExpectedRoot, $EvidenceFile
$localMcp = [ordered]@{
    exit                     = 0
    exit_status              = 'passed'
    before_mcp_present       = $true
    after_mcp_present        = $true
    identity_intersection    = @($identity_intersection)
    canonical_mcp_provenance = [bool]$canonical_mcp_provenance
    after_identities_live     = [bool]$after_identities_live
    expected_root             = $ExpectedRoot
    before                    = @($BeforeMcp)
    after                     = @($AfterMcp)
    exact_command             = $ExactCommand
    captured_utc              = $capturedUtc
    machine                   = $machine
    live_at_write             = $true
    redacted_output           = 'After MCP identities were re-read from Win32_Process.'
}
$localCockpit = [ordered]@{
    exit                     = 0
    exit_status              = 'passed'
    cockpit_identity_changed = [bool]$cockpit_identity_changed
    before                   = $BeforeCockpit
    after                    = $AfterCockpit
    exact_command            = $ExactCommand
    captured_utc             = $capturedUtc
    machine                  = $machine
    live_at_write            = $true
    redacted_output          = 'Cockpit PID, CreationDate, and command line were re-read.'
}
$finalEvidence = [ordered]@{
    schema            = $Schema
    mode              = 'Finalize'
    exit_status       = 'passed'
    project           = $ProjectRoot
    expected_mcp_root = $ExpectedRoot
    evidence_path     = $EvidenceFile
    exact_command     = $ExactCommand
    captured_utc      = $capturedUtc
    machine           = $machine
    live_at_write     = $true
    redacted_output   = 'All after identities are live with canonical provenance.'
    profile           = $Prior.profile
    local_mcp         = $localMcp
    local_cockpit     = $localCockpit
    components        = [ordered]@{
        mcp_restart     = $localMcp
        cockpit_restart = $localCockpit
    }
}
Write-SgsdEvidence -Evidence $finalEvidence -Path $EvidenceFile
Write-Host "Finalize evidence written: $EvidenceFile" -ForegroundColor Green
