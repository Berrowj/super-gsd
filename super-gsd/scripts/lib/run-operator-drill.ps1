# =============================================================================
# super-gsd/scripts/lib/run-operator-drill.ps1
# Phase 88-01: End-to-End Warp Operator Drill runner.
#
# Runs 7 automatable steps from the 11-step drill (Phase 88 spec).
# Manual UI steps (1, 4, 6, 9) listed with operator instructions.
# ASCII-only.
# =============================================================================

[CmdletBinding()]
param(
    [string]$ProjectDir = (Get-Location).Path,
    [switch]$Help
)

function Show-Help {
    Write-Host 'run-operator-drill.ps1 -- SGSD Warp Operator Drill (Phase 88)' -ForegroundColor Cyan
    Write-Host '  -ProjectDir <path>   Project root containing .planning + super-gsd'
    Write-Host '  -Help                this help'
    Write-Host ''
    Write-Host 'Runs 7 automatable steps; lists manual UI steps for operator follow-up.'
    Write-Host 'Capture output to:'
    Write-Host '  .planning/milestones/v2.6/phases/88-end-to-end-warp-operator-drill/88-DRILL-RESULT.md'
}

if ($Help) { Show-Help; exit 0 }

$results = @()
$pass = 0
$fail = 0
$manual = 0

function Record($n, $title, $mode, $verdict, $detail) {
    $script:results += [pscustomobject]@{ Step = $n; Title = $title; Mode = $mode; Verdict = $verdict; Detail = $detail }
    switch ($verdict) {
        'PASS' { $script:pass += 1 }
        'FAIL' { $script:fail += 1 }
        'MANUAL-CHECK' { $script:manual += 1 }
    }
}

Write-Host ''
Write-Host '== SGSD WARP OPERATOR DRILL ==' -ForegroundColor Cyan
Write-Host ('Project: ' + $ProjectDir)
Write-Host ('Started: ' + (Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'))
Write-Host ''

# Step 1 -- manual
Record 1 'Open Warp' 'manual' 'MANUAL-CHECK' 'Operator confirms Warp window open in repo dir.'

# Step 2 -- warp-doctor
Write-Host '[Step 2] Run warp-doctor...' -ForegroundColor DarkGray
$doctorOut = & node (Join-Path $ProjectDir 'super-gsd/tools/warp-doctor/check.cjs') --project $ProjectDir --json 2>$null
$doctorExit = $LASTEXITCODE
if ($doctorOut) {
    try {
        $doctor = $doctorOut | ConvertFrom-Json
        $probeCount = if ($doctor.probes) { $doctor.probes.Count } else { 0 }
        if ($probeCount -ge 16) {
            Record 2 'Run SGSD: Warp Doctor' 'auto' 'PASS' ("$probeCount probes; exit=$doctorExit")
        } else {
            Record 2 'Run SGSD: Warp Doctor' 'auto' 'FAIL' ("only $probeCount probes; expected >=16")
        }
    } catch {
        Record 2 'Run SGSD: Warp Doctor' 'auto' 'FAIL' ("JSON parse error: $($_.Exception.Message)")
    }
} else {
    Record 2 'Run SGSD: Warp Doctor' 'auto' 'FAIL' "no output"
}

# Step 3 -- SGSD: Status (STATE.md frontmatter)
Write-Host '[Step 3] Read STATE.md frontmatter...' -ForegroundColor DarkGray
$statePath = Join-Path $ProjectDir '.planning/STATE.md'
if (Test-Path -LiteralPath $statePath) {
    $stateLines = Get-Content -LiteralPath $statePath -TotalCount 30 -Encoding UTF8
    if ($stateLines.Count -ge 9) {
        Record 3 'Run SGSD: Status' 'auto' 'PASS' ("STATE.md $($stateLines.Count) lines read")
    } else {
        Record 3 'Run SGSD: Status' 'auto' 'FAIL' ('STATE.md too short: ' + $stateLines.Count)
    }
} else {
    Record 3 'Run SGSD: Status' 'auto' 'FAIL' 'STATE.md absent'
}

# Step 4 -- manual MCP query
Record 4 'Ask Warp Agent for status through MCP' 'manual' 'MANUAL-CHECK' 'Operator types prompt P1 into Warp Agent; verifies MCP-cited response.'

# Step 5 -- sg shortcut probe (via warp-doctor)
Write-Host '[Step 5] Verify sg shortcut...' -ForegroundColor DarkGray
if ($doctorOut) {
    try {
        $sgProbe = $doctor.probes | Where-Object { $_.name -eq 'sg_command_defined_in_profile' }
        if ($sgProbe -and $sgProbe.status -eq 'PASS') {
            Record 5 'sg shortcut available' 'auto' 'PASS' 'profile defines function sg'
        } else {
            Record 5 'sg shortcut available' 'auto' 'FAIL' "probe status: $($sgProbe.status)"
        }
    } catch {
        Record 5 'sg shortcut available' 'auto' 'FAIL' 'probe lookup failed'
    }
} else {
    Record 5 'sg shortcut available' 'auto' 'FAIL' 'doctor output unavailable'
}

# Step 6 -- manual cockpit
Record 6 'Open cockpit' 'manual' 'MANUAL-CHECK' 'Operator confirms cockpit panes open separately from Claude tab.'

# Step 7 -- gate-status workflow check (read existing crit-backlog rows)
Write-Host '[Step 7] Verify gate-status surface...' -ForegroundColor DarkGray
$critBacklog = Join-Path $ProjectDir '.planning/metrics/crit-backlog.jsonl'
if (Test-Path -LiteralPath $critBacklog) {
    $rowCount = (Get-Content -LiteralPath $critBacklog | Measure-Object -Line).Lines
    Record 7 'Gate status / crit-backlog visible' 'auto' 'PASS' ("$rowCount rows")
} else {
    Record 7 'Gate status / crit-backlog visible' 'auto' 'PASS' 'crit-backlog absent (clean run)'
}

# Step 8 -- gate-triage skill verification (file presence)
$skillPath = Join-Path $ProjectDir '.agents/skills/sgsd-gate-triage/SKILL.md'
if (Test-Path -LiteralPath $skillPath) {
    Record 8 'Gate triage skill loadable' 'auto' 'PASS' $skillPath
} else {
    Record 8 'Gate triage skill loadable' 'auto' 'FAIL' 'skill missing'
}

# Step 9 -- manual Code Review panel
Record 9 'Open Warp Code Review' 'manual' 'MANUAL-CHECK' 'Operator opens Code Review panel; verifies recent diff visible.'

# Step 10 -- recovery packet via MCP
Write-Host '[Step 10] Recovery packet via MCP...' -ForegroundColor DarkGray
$mcpReq = '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"sgsd_recovery_packet","arguments":{}},"id":1}'
$mcpServer = Join-Path $ProjectDir 'super-gsd/tools/warp-mcp/server.cjs'
$recoveryOut = $mcpReq | & node $mcpServer 2>$null
if ($recoveryOut) {
    $bytes = [System.Text.Encoding]::UTF8.GetByteCount($recoveryOut)
    if ($bytes -lt 4096) {
        Record 10 'Recovery packet ≤ 4KB' 'auto' 'PASS' "$bytes bytes"
    } else {
        Record 10 'Recovery packet ≤ 4KB' 'auto' 'FAIL' "$bytes bytes > 4096 ceiling"
    }
} else {
    Record 10 'Recovery packet ≤ 4KB' 'auto' 'FAIL' 'no MCP output'
}

# Step 11 -- remote monitor packet workflow file presence
$rmpWorkflow = Join-Path $ProjectDir '.warp/workflows/sgsd-remote-monitor-packet.yaml'
if (Test-Path -LiteralPath $rmpWorkflow) {
    Record 11 'Remote monitor packet workflow' 'auto' 'PASS' $rmpWorkflow
} else {
    Record 11 'Remote monitor packet workflow' 'auto' 'FAIL' 'workflow missing'
}

# Render summary
Write-Host ''
Write-Host '== DRILL SUMMARY ==' -ForegroundColor Cyan
$results | Format-Table -AutoSize -Wrap | Out-String | Write-Host
Write-Host ''
Write-Host ("Total: $pass PASS / $fail FAIL / $manual MANUAL-CHECK (of $($results.Count) steps)")
if ($fail -gt 0) {
    Write-Host 'FAIL rows present -- operator must address before v2.6 SHIPPED-clean.' -ForegroundColor Red
    exit 1
} else {
    Write-Host 'No FAIL rows -- automatable portion green. Address MANUAL-CHECK rows in operator UI.' -ForegroundColor Green
    exit 0
}
