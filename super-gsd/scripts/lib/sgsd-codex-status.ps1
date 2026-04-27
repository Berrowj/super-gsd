# ============================================================================
# Super GSD · Shared Codex reviewer status helpers
# ============================================================================
# Shared by sgsd-mission-control, sgsd-narrative, and sgsd-codex-monitor.
# Reads only authoritative files:
#   .planning/config.json
#   .planning/metrics/codex-live.json
#   .planning/metrics/codex-log.jsonl
#   .planning/metrics/activity-log.jsonl
#   super-gsd/registry/gates.yaml
# ============================================================================

function Resolve-SgsdRuntimePath {
    param([string]$Path)
    if (-not $Path) { return "" }
    if (Test-Path $Path) { return $Path }

    if ($Path -match '^/tmp/(.+)$') {
        $candidate = Join-Path $env:TEMP ($matches[1] -replace '/', '\')
        if (Test-Path $candidate) { return $candidate }
    }

    if ($Path -match '^/([A-Za-z])/(.+)$') {
        $drive = $matches[1].ToUpper()
        $rest = $matches[2] -replace '/', '\'
        $candidate = "${drive}:\$rest"
        if (Test-Path $candidate) { return $candidate }
    }

    if ($Path -match '^/mnt/([A-Za-z])/(.+)$') {
        $drive = $matches[1].ToUpper()
        $rest = $matches[2] -replace '/', '\'
        $candidate = "${drive}:\$rest"
        if (Test-Path $candidate) { return $candidate }
    }

    return $Path
}

function Get-SgsdCodexStatus {
    param(
        [string]$ProjectDir,
        [string]$PlanningDir
    )

    $cfgPath = Join-Path $PlanningDir "config.json"
    $gatesPath = Join-Path $ProjectDir "super-gsd\registry\gates.yaml"
    $livePath = Join-Path $PlanningDir "metrics\codex-live.json"
    $logPath = Join-Path $PlanningDir "metrics\codex-log.jsonl"

    $out = [ordered]@{
        enabled = $false
        defaultProvider = "claude-sonnet-reviewer"
        model = "gpt-5.5"
        reasoningEffort = "xhigh"
        fallbackOnError = $true
        phaseAtcProvider = $null
        perDispatchProvider = $null
        state = "not-fired"
        stateColor = "DarkGray"
        phase = ""
        plan = ""
        step = ""
        toolbox = "bash -> codex exec"
        commandPreview = ""
        promptFile = ""
        promptFileResolved = ""
        startedAt = ""
        timeoutSeconds = 0
        promptBytes = 0
        reportBytes = 0
        durationMs = 0
        exit = $null
        fallbackTriggered = $null
        updatedAgeSec = $null
        reportOut = ""
        reportOutResolved = ""
        oneLiner = ""
        stderrPreview = ""
        totalRuns = 0
        okRuns = 0
        failedRuns = 0
        fallbackCount = 0
        totalPromptBytes = 0
        totalReportBytes = 0
        tokenRows = 0
        codexDispatches = 0
        claudeTokensSaved = 0
        currentMilestone = ""
        currentPhase = ""
        scopeCurrent = $true
        staleScope = ""
    }

    $statePath = Join-Path $PlanningDir "STATE.md"
    if (Test-Path $statePath) {
        try {
            foreach ($line in (Get-Content $statePath -TotalCount 40 -ErrorAction SilentlyContinue)) {
                if (-not $out.currentMilestone -and $line -match '^milestone:\s*(.+)$') {
                    $out.currentMilestone = $matches[1].Trim().Trim('"', "'")
                }
                if (-not $out.currentPhase -and $line -match '^(?:current_phase|phase):\s*"?([0-9]+)"?') {
                    $out.currentPhase = $matches[1]
                }
                if (-not $out.currentPhase -and $line -match '^status:\s*.*\bPhase\s+([0-9]+)\b') {
                    $out.currentPhase = $matches[1]
                }
            }
        } catch {}
    }

    if (Test-Path $cfgPath) {
        try {
            $cfg = Get-Content $cfgPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction Stop
            if ($cfg.review_providers) {
                $out.enabled = [bool]$cfg.review_providers.codex_enabled
                if ($cfg.review_providers.default_provider) { $out.defaultProvider = "$($cfg.review_providers.default_provider)" }
                if ($cfg.review_providers.codex_model) { $out.model = "$($cfg.review_providers.codex_model)" }
                if ($cfg.review_providers.codex_reasoning_effort) { $out.reasoningEffort = "$($cfg.review_providers.codex_reasoning_effort)" }
                if ($null -ne $cfg.review_providers.fallback_on_error) { $out.fallbackOnError = [bool]$cfg.review_providers.fallback_on_error }
            }
        } catch {}
    }

    if (Test-Path $gatesPath) {
        try {
            $gatesRaw = Get-Content $gatesPath -Raw -ErrorAction SilentlyContinue
            $out.phaseAtcProvider = Get-SgsdGateReviewerProvider -Content $gatesRaw -GateName "phase-level-ATC"
            $out.perDispatchProvider = Get-SgsdGateReviewerProvider -Content $gatesRaw -GateName "per-dispatch-ATC"
        } catch {}
    }

    $live = $null
    if (Test-Path $livePath) {
        try { $live = Get-Content $livePath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction Stop } catch {}
    }
    if ($live) {
        $out.state = "$($live.state)"
        $out.phase = "$($live.phase)"
        $out.plan = "$($live.plan)"
        $out.step = "$($live.step)"
        $out.toolbox = if ($live.toolbox) { "$($live.toolbox)" } else { $out.toolbox }
        if ($live.model) { $out.model = "$($live.model)" }
        if ($live.reasoning_effort) { $out.reasoningEffort = "$($live.reasoning_effort)" }
        $out.commandPreview = "$($live.command_preview)"
        $out.promptFile = "$($live.prompt_file)"
        $out.promptFileResolved = Resolve-SgsdRuntimePath "$($live.prompt_file)"
        $out.startedAt = "$($live.started_at)"
        $out.timeoutSeconds = [int]($live.timeout_seconds)
        $out.promptBytes = [int]($live.prompt_bytes)
        $out.reportBytes = [int]($live.report_bytes)
        $out.durationMs = [int]($live.duration_ms)
        $out.exit = $live.exit
        if ($null -ne $live.fallback_triggered) { $out.fallbackTriggered = [bool]$live.fallback_triggered }
        $out.reportOut = "$($live.report_out)"
        $out.reportOutResolved = Resolve-SgsdRuntimePath "$($live.report_out)"
        $out.stderrPreview = "$($live.stderr_preview)"
        try {
            $updated = [DateTime]::Parse($live.updated_at)
            $out.updatedAgeSec = [int]((Get-Date) - $updated).TotalSeconds
        } catch {}
    }

    if ($out.currentPhase -and $out.phase -and "$($out.phase)" -ne "$($out.currentPhase)") {
        $oldScope = @($out.phase, $out.plan, $out.step) | Where-Object { $_ -and "$_".Trim() -ne "" }
        $out.scopeCurrent = $false
        $out.staleScope = if ($oldScope.Count -gt 0) { $oldScope -join " / " } else { "$($out.phase)" }
        $out.state = "stale"
    }

    if (Test-Path $logPath) {
        try {
            $rows = @()
            foreach ($line in (Get-Content $logPath -ErrorAction SilentlyContinue)) {
                try { $rows += ($line | ConvertFrom-Json -ErrorAction Stop) } catch {}
            }
            $out.totalRuns = $rows.Count
            if ($rows.Count -gt 0) {
                $out.okRuns = @($rows | Where-Object { [int]$_.exit -eq 0 }).Count
                $out.failedRuns = @($rows | Where-Object { [int]$_.exit -ne 0 }).Count
                $out.totalPromptBytes = (@($rows | Measure-Object -Property prompt_bytes -Sum).Sum | ForEach-Object { if ($_ -ne $null) { [int]$_ } else { 0 } })
                $out.totalReportBytes = (@($rows | Measure-Object -Property report_bytes -Sum).Sum | ForEach-Object { if ($_ -ne $null) { [int]$_ } else { 0 } })
                $row = $rows[-1]
                if (-not $live) {
                    $out.phase = "$($row.phase)"
                    $out.plan = "$($row.plan)"
                    $out.step = "$($row.step)"
                    $out.durationMs = [int]($row.duration_ms)
                    $out.promptBytes = [int]($row.prompt_bytes)
                    $out.reportBytes = [int]($row.report_bytes)
                    $out.exit = $row.exit
                    if ($row.model) { $out.model = "$($row.model)" }
                    if ($row.reasoning_effort) { $out.reasoningEffort = "$($row.reasoning_effort)" }
                    $out.state = if ($row.exit -eq 0) { "ok" } elseif ($row.exit -eq 5) { "timeout" } else { "error" }
                }
            }
        } catch {}
    }

    if ($out.currentPhase -and $out.phase -and "$($out.phase)" -ne "$($out.currentPhase)") {
        $oldScope = @($out.phase, $out.plan, $out.step) | Where-Object { $_ -and "$_".Trim() -ne "" }
        $out.scopeCurrent = $false
        $out.staleScope = if ($oldScope.Count -gt 0) { $oldScope -join " / " } else { "$($out.phase)" }
        $out.state = "stale"
    }

    $tokenPath = Join-Path $PlanningDir "metrics\token-log.jsonl"
    if (Test-Path $tokenPath) {
        try {
            $milestoneId = ""
            $statePath = Join-Path $PlanningDir "STATE.md"
            if (Test-Path $statePath) {
                foreach ($line in (Get-Content $statePath -TotalCount 20 -ErrorAction SilentlyContinue)) {
                    if ($line -match '^milestone:\s*(.+)$') { $milestoneId = $matches[1].Trim(); break }
                }
            }

            $milestoneStart = $null
            if ($milestoneId) {
                $milestoneDir = Join-Path $PlanningDir ("milestones\" + $milestoneId)
                if (Test-Path $milestoneDir) {
                    $milestoneStart = (Get-Item $milestoneDir -ErrorAction SilentlyContinue).LastWriteTimeUtc
                }
            }

            $tokenRows = @()
            foreach ($line in (Get-Content $tokenPath -ErrorAction SilentlyContinue)) {
                try {
                    $row = $line | ConvertFrom-Json -ErrorAction Stop
                    if ($milestoneStart) {
                        $rowTs = [DateTime]::Parse($row.ts).ToUniversalTime()
                        if ($rowTs -lt $milestoneStart) { continue }
                    }
                    $tokenRows += $row
                } catch {}
            }

            # INSTR-02 (v1.5 Phase 25) — math semantics, audited:
            #   tokenRows         = ALL token-log rows in scan window (all providers)
            #   codexDispatches   = COUNT of provider:openai-codex rows
            #                       (any role; reviewer + verifier + future codex roles)
            #   fallbackCount     = COUNT of provider:claude-via-fallback rows
            #                       (i.e. codex attempted then fell back to Claude)
            #   claudeTokensSaved = SUM of est_input + est_output over codex review rows
            #                       (code_reviewer + adversarial_verifier only — these
            #                        are the roles that displaced Claude). Excludes
            #                        fallback rows because Claude DID run for those.
            #   fallback_rate     = fallbackCount / (codexDispatches + fallbackCount)
            #                       computed at consumer site (mission-control); denom
            #                       represents total review-intent invocations.
            $out.tokenRows = $tokenRows.Count
            $codexRows = @($tokenRows | Where-Object {
                $provider = if ($_.provider) { "$($_.provider)" } else { "claude" }
                $provider -eq "openai-codex"
            })
            $fallbackRows = @($tokenRows | Where-Object {
                $provider = if ($_.provider) { "$($_.provider)" } else { "claude" }
                $provider -eq "claude-via-fallback"
            })
            $reviewRows = @($codexRows | Where-Object {
                $role = if ($_.role) { "$($_.role)" } else { "unknown" }
                @("code_reviewer", "adversarial_verifier") -contains $role
            })
            $out.codexDispatches = $codexRows.Count
            $out.fallbackCount = $fallbackRows.Count
            $saved = 0
            foreach ($row in $reviewRows) {
                $saved += [int]($row.est_input)
                $saved += [int]($row.est_output)
            }
            $out.claudeTokensSaved = $saved
        } catch {}
    }

    $reportPath = if ($out.reportOutResolved) { $out.reportOutResolved } else { Resolve-SgsdRuntimePath $out.reportOut }
    if ($reportPath -and (Test-Path $reportPath)) {
        try {
            foreach ($line in (Get-Content $reportPath -ErrorAction SilentlyContinue)) {
                if ($line -match '^ONE_LINER:\s*(.+)$') { $out.oneLiner = $matches[1].Trim(); break }
            }
        } catch {}
    }

    $out.stateColor = switch -Regex ($out.state) {
        '^running$' { "Yellow" }
        '^(ok|success)$' { "Green" }
        '^(timeout|error|auth-denied|contract-violation)$' { "Red" }
        default {
            if (-not $out.enabled) { "DarkYellow" } else { "DarkGray" }
        }
    }

    return [pscustomobject]$out
}

function Get-SgsdGateReviewerProvider {
    param(
        [string]$Content,
        [string]$GateName
    )
    if (-not $Content) { return $null }
    $pattern = "(?ms)- name:\s*$([regex]::Escape($GateName))\b(.*?)(?=^\s*-\s+name:|\z)"
    $m = [regex]::Match($Content, $pattern)
    if (-not $m.Success) { return $null }
    $p = [regex]::Match($m.Groups[1].Value, 'reviewer_provider:\s*([^\s]+)')
    if ($p.Success) { return $p.Groups[1].Value.Trim() }
    return $null
}

function Get-SgsdCodexEvents {
    param(
        [string]$PlanningDir,
        [string]$PhaseNum = "",
        [int]$MaxEvents = 8
    )
    $log = Join-Path $PlanningDir "metrics\activity-log.jsonl"
    if (-not (Test-Path $log)) { return @() }

    $entries = @()
    try {
        $lines = Get-Content $log -Tail 250 -ErrorAction SilentlyContinue
        foreach ($line in $lines) {
            try {
                $e = $line | ConvertFrom-Json -ErrorAction Stop
                if ($PhaseNum -and $e.phase -and "$($e.phase)" -ne "$PhaseNum") { continue }
                $isRealWrapper = ("$($e.command_kind)" -eq "codex-wrapper") -and $e.prompt_file -and $e.report_out
                $isRealCli = ("$($e.command_kind)" -eq "codex-cli")
                $isCodex = ($e.provider -eq "codex" -and ($isRealWrapper -or $isRealCli)) -or $isRealCli
                if (-not $isCodex) { continue }
                $ts = [DateTime]::Parse($e.ts)
                $detail = ""
                $scopeParts = @("$($e.review_plan)", "$($e.review_step)") | Where-Object { $_ -and "$_".Trim() -ne "" }
                if ($scopeParts.Count -gt 0) {
                    $detail = $scopeParts -join " / "
                } elseif ($e.command_preview) {
                    $detail = "$($e.command_preview)"
                } else {
                    $detail = "$($e.target)"
                }
                $entries += [pscustomobject]@{
                    ts = $ts
                    label = if ($e.command_kind) { "$($e.command_kind)".ToUpper() } else { "$($e.tool)".ToUpper() }
                    detail = $detail
                    phase = "$($e.phase)"
                }
            } catch {}
        }
    } catch {}
    return @($entries | Sort-Object ts -Descending | Select-Object -First $MaxEvents)
}

function Get-SgsdCodexLogRows {
    param(
        [string]$PlanningDir,
        [int]$MaxRows = 6,
        [string]$PhaseFilter = ""
    )
    $log = Join-Path $PlanningDir "metrics\codex-log.jsonl"
    if (-not (Test-Path $log)) { return @() }
    $rows = @()
    try {
        foreach ($line in (Get-Content $log -Tail 80 -ErrorAction SilentlyContinue)) {
            try {
                $row = $line | ConvertFrom-Json -ErrorAction Stop
                if ($PhaseFilter -and "$($row.phase)" -ne "$PhaseFilter") { continue }
                $rows += $row
            } catch {}
        }
    } catch {}
    return @($rows | Sort-Object ts -Descending | Select-Object -First $MaxRows)
}

function Get-SgsdCodexStatusLine {
    param($Status)
    if (-not $Status) { return "codex --" }
    $age = if ($Status.updatedAgeSec -ne $null) { "{0}s" -f [Math]::Max(0, [int]$Status.updatedAgeSec) } else { "--" }
    $scopeParts = @($Status.phase, $Status.plan, $Status.step) | Where-Object { $_ -and "$_".Trim() -ne "" }
    $scope = if (-not $Status.scopeCurrent -and $Status.currentPhase) {
        "current P$($Status.currentPhase); old $($Status.staleScope)"
    } elseif ($scopeParts.Count -gt 0) {
        ($scopeParts -join "/")
    } else { "--" }
    return ("codex {0} [{1}] [6.5 {2}] [9.5 {3}] [{4}]" -f `
        $Status.state, $age, `
        $(if ($Status.phaseAtcProvider) { $Status.phaseAtcProvider } else { "--" }), `
        $(if ($Status.perDispatchProvider) { $Status.perDispatchProvider } else { "--" }), `
        $scope)
}

function Get-SgsdCodexTimelineRows {
    param(
        [string]$ProjectDir,
        [string]$PlanningDir,
        [int]$MaxRows = 12
    )

    $rows = New-Object System.Collections.Generic.List[object]
    $events = @(Get-SgsdCodexEvents -PlanningDir $PlanningDir -MaxEvents $MaxRows)
    foreach ($event in $events) {
        $rows.Add([pscustomobject]@{
            ts = $event.ts
            tool = "Codex"
            summary = "$($event.label) $($event.detail)"
            color = "DarkYellow"
        })
    }

    $status = Get-SgsdCodexStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
    if ($status.state -ne "not-fired" -and $status.updatedAgeSec -ne $null) {
        $rows.Add([pscustomobject]@{
            ts = (Get-Date).AddSeconds(-1 * [int]$status.updatedAgeSec)
            tool = "Codex"
            summary = ("state={0} model={1} effort={2} exit={3} in={4}B out={5}B" -f `
                $status.state, $status.model, $status.reasoningEffort, `
                $(if ($null -ne $status.exit) { $status.exit } else { "--" }), `
                $status.promptBytes, $status.reportBytes)
            color = "DarkYellow"
        })
    }

    return @($rows | Sort-Object ts -Descending | Select-Object -First $MaxRows)
}

function Get-SgsdCodexVerdicts {
    <#
    .SYNOPSIS
      Reads commit-reviews.jsonl files under .planning/milestones/**/phases/**
      and .planning/phases/** to produce a rolling view of what Codex found
      during per-dispatch + phase-level ATC reviews.

    .DESCRIPTION
      Each verdict row carries critical/warning counts + ONE_LINER from the
      Codex 5-line contract. The Codex Monitor pane renders these as
      "little descriptions of any issues Codex found" — the operator's
      explicit ask for tracking review progress at a glance.

      Source files: **/commit-reviews.jsonl (one JSON per line).
      Required fields per row: ts, plan, provider, critical, warning, one_liner.
      Optional: tier, verdict, note, model, reasoning_effort.

    .PARAMETER PlanningDir
      Path to .planning directory (absolute or relative).

    .PARAMETER MaxRows
      Maximum verdicts to return (sorted ts descending). Default 5.

    .PARAMETER ProviderFilter
      If set, only return rows where provider matches (e.g. "openai-codex"
      to exclude claude-via-fallback). Default: all providers.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$PlanningDir,
        [int]$MaxRows = 5,
        [string]$ProviderFilter = "",
        [string]$MilestoneFilter = "",
        [string]$PhaseFilter = ""
    )

    $verdicts = New-Object System.Collections.Generic.List[object]

    $searchRoots = @(
        (Join-Path $PlanningDir "milestones"),
        (Join-Path $PlanningDir "phases")
    ) | Where-Object { Test-Path $_ }

    foreach ($root in $searchRoots) {
        try {
            $files = Get-ChildItem -Path $root -Recurse -Filter "commit-reviews.jsonl" -ErrorAction SilentlyContinue -Force
            foreach ($f in $files) {
                try {
                    $src = "$($f.FullName)"
                    if ($MilestoneFilter -and $src -notmatch [regex]::Escape("\milestones\$MilestoneFilter\")) { continue }
                    if ($PhaseFilter -and $src -notmatch [regex]::Escape("\phases\$PhaseFilter-")) { continue }
                    foreach ($line in (Get-Content $f.FullName -ErrorAction SilentlyContinue)) {
                        if (-not "$line".Trim()) { continue }
                        try {
                            $r = $line | ConvertFrom-Json -ErrorAction Stop
                            if ($ProviderFilter -and "$($r.provider)" -ne $ProviderFilter) { continue }
                            $verdicts.Add([pscustomobject]@{
                                ts        = [DateTime]::Parse($r.ts)
                                plan      = "$($r.plan)"
                                tier      = "$($r.tier)"
                                verdict   = "$($r.verdict)"
                                critical  = [int]($r.critical)
                                warning   = [int]($r.warning)
                                one_liner = "$($r.one_liner)"
                                provider  = "$($r.provider)"
                                model     = "$($r.model)"
                                reasoning_effort = "$($r.reasoning_effort)"
                                note      = "$($r.note)"
                                source    = $f.FullName
                            })
                        } catch {}
                    }
                } catch {}
            }
        } catch {}
    }

    return @($verdicts | Sort-Object ts -Descending | Select-Object -First $MaxRows)
}

function Read-SgsdJsonLinesTail {
    param(
        [string]$Path,
        [int]$Tail = 20
    )
    if (-not (Test-Path $Path)) { return @() }
    $rows = @()
    try {
        foreach ($line in (Get-Content $Path -Tail $Tail -ErrorAction SilentlyContinue)) {
            if (-not "$line".Trim()) { continue }
            try { $rows += ($line | ConvertFrom-Json -ErrorAction Stop) } catch {}
        }
    } catch {}
    return @($rows)
}

function Get-SgsdIsoAgeSec {
    param($Value)
    if (-not $Value) { return $null }
    try {
        return [int]((Get-Date) - ([DateTime]::Parse("$Value"))).TotalSeconds
    } catch {
        return $null
    }
}

function Get-SgsdVtpFrontmatter {
    param([string]$Path)
    $map = @{}
    if (-not (Test-Path $Path)) { return $map }
    try {
        foreach ($line in (Get-Content $Path -TotalCount 50 -ErrorAction SilentlyContinue)) {
            if ($line -match '^---\s*$') { continue }
            if ($line -match '^\s*$') { break }
            if ($line -match '^([A-Za-z0-9_-]+):\s*(.*)$') {
                $map[$matches[1]] = $matches[2].Trim()
            }
        }
    } catch {}
    return $map
}

function Get-SgsdVtpMcpStatus {
    param(
        [string]$ProjectDir,
        [string]$PlanningDir
    )

    $out = [ordered]@{
        enabled = $false
        configState = "disabled"
        healthState = "no-probe"
        healthAgeSec = $null
        vtpAvailable = $null
        healthSource = ""
        mcpConfigPath = ""
        mcpServers = ""
        mcpVtpBinding = "unknown"
        mcpVtpTarget = ""
        mcpVtpTargetExists = $null
        routingStatus = "no-log"
        routingAgeSec = $null
        routingTier = ""
        routingAgent = ""
        routingHits = $null
        routingDoc = ""
        routingElapsedMs = $null
        routingFailure = ""
        routingSummary = ""
        artifactStatus = "missing"
        artifactPath = ""
        artifactAgeSec = $null
        artifactPhase = ""
        artifactHits = $null
        artifactQueryCount = $null
        artifactDurationMs = $null
        artifactEmptyHit = $null
    }

    $cfgPath = Join-Path $PlanningDir "config.json"
    if (Test-Path $cfgPath) {
        try {
            $cfg = Get-Content $cfgPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction Stop
            if ($cfg.vtp_enrichment -and $cfg.vtp_enrichment.enabled -eq $true) {
                $out.enabled = $true
                $out.configState = "enabled"
            }
        } catch {}
    }

    $mcpPath = Join-Path $ProjectDir ".mcp.json"
    if (Test-Path $mcpPath) {
        $out.mcpConfigPath = $mcpPath
        try {
            $mcp = Get-Content $mcpPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction Stop
            if ($mcp.mcpServers) {
                $serverProps = @($mcp.mcpServers.PSObject.Properties)
                $out.mcpServers = (@($serverProps | ForEach-Object { $_.Name }) -join ",")
                $vtpProp = @($serverProps | Where-Object { $_.Name -eq "vtp-kb" } | Select-Object -First 1)
                if ($vtpProp.Count -gt 0) {
                    $out.mcpVtpBinding = "configured"
                    $server = $vtpProp[0].Value
                    $cmd = if ($server.command) { "$($server.command)" } elseif ($server.url) { "$($server.url)" } else { "" }
                    $arg0 = ""
                    if ($server.args -and $server.args.Count -gt 0) { $arg0 = "$($server.args[0])" }
                    $out.mcpVtpTarget = (@($cmd, $arg0) | Where-Object { $_ -and "$_".Trim() -ne "" }) -join " "
                    if ($arg0 -and ($arg0 -match '^[A-Za-z]:[\\/]|^/')) {
                        $out.mcpVtpTargetExists = Test-Path $arg0
                    }
                } else {
                    $out.mcpVtpBinding = "missing"
                }
            }
        } catch {
            $out.mcpVtpBinding = "config-error"
        }
    } else {
        $out.mcpVtpBinding = "no-config"
    }

    $healthPath = Join-Path $PlanningDir "metrics\vtp-health.jsonl"
    $healthRows = @(Read-SgsdJsonLinesTail -Path $healthPath -Tail 20)
    if ($healthRows.Count -gt 0) {
        $h = $healthRows[$healthRows.Count - 1]
        if ($null -ne $h.vtp_available) { $out.vtpAvailable = [bool]$h.vtp_available }
        if ($h.vtp_health_cached) {
            $out.healthState = "$($h.vtp_health_cached)"
        } elseif ($h.event) {
            $out.healthState = "$($h.event)"
        } elseif ($out.vtpAvailable -eq $true) {
            $out.healthState = "healthy"
        } elseif ($out.vtpAvailable -eq $false) {
            $out.healthState = "degraded"
        }
        $out.healthSource = "$($h.source)"
        $out.healthAgeSec = Get-SgsdIsoAgeSec $h.ts
    }

    $routingPath = Join-Path $PlanningDir "metrics\vtp-routing-log.jsonl"
    $routingRows = @(Read-SgsdJsonLinesTail -Path $routingPath -Tail 50)
    if ($routingRows.Count -gt 0) {
        $r = $routingRows[$routingRows.Count - 1]
        $out.routingStatus = if ($r.status) { "$($r.status)" } else { "unknown" }
        $out.routingAgeSec = Get-SgsdIsoAgeSec $r.ts
        $out.routingTier = "$($r.tier)"
        $out.routingAgent = "$($r.skill_or_agent)"
        if ($null -ne $r.evidence_hit_count) { $out.routingHits = [int]$r.evidence_hit_count }
        $out.routingDoc = "$($r.top_doc_id)"
        if ($null -ne $r.elapsed_ms) { $out.routingElapsedMs = [int]$r.elapsed_ms }
        $out.routingFailure = "$($r.failure_reason)"

        $counts = @{}
        foreach ($row in $routingRows) {
            $s = if ($row.status) { "$($row.status)" } else { "unknown" }
            if (-not $counts.ContainsKey($s)) { $counts[$s] = 0 }
            $counts[$s] = [int]$counts[$s] + 1
        }
        $summaryParts = @()
        foreach ($key in ($counts.Keys | Sort-Object)) {
            $summaryParts += ("{0}={1}" -f $key, $counts[$key])
        }
        $out.routingSummary = $summaryParts -join " "
    }

    $artifactRoots = @(
        (Join-Path $PlanningDir "milestones"),
        (Join-Path $PlanningDir "phases")
    ) | Where-Object { Test-Path $_ }
    $latestArtifact = $null
    foreach ($root in $artifactRoots) {
        try {
            $candidate = Get-ChildItem -Path $root -Recurse -Filter "VTP-ENRICHMENT.md" -ErrorAction SilentlyContinue -Force |
                Sort-Object LastWriteTimeUtc -Descending |
                Select-Object -First 1
            if ($candidate -and ((-not $latestArtifact) -or $candidate.LastWriteTimeUtc -gt $latestArtifact.LastWriteTimeUtc)) {
                $latestArtifact = $candidate
            }
        } catch {}
    }
    if ($latestArtifact) {
        $fm = Get-SgsdVtpFrontmatter -Path $latestArtifact.FullName
        $out.artifactPath = $latestArtifact.FullName
        $out.artifactAgeSec = [int]((Get-Date) - $latestArtifact.LastWriteTime).TotalSeconds
        $out.artifactStatus = if ($fm.ContainsKey("vtp_status")) { $fm["vtp_status"] } else { "present" }
        $out.artifactPhase = if ($fm.ContainsKey("phase")) { $fm["phase"] } else { "" }
        if ($fm.ContainsKey("total_hits")) { try { $out.artifactHits = [int]$fm["total_hits"] } catch {} }
        if ($fm.ContainsKey("query_count")) { try { $out.artifactQueryCount = [int]$fm["query_count"] } catch {} }
        if ($fm.ContainsKey("duration_ms")) { try { $out.artifactDurationMs = [int]$fm["duration_ms"] } catch {} }
        if ($fm.ContainsKey("empty_hit")) { $out.artifactEmptyHit = "$($fm["empty_hit"])" -eq "true" }
    }

    return [pscustomobject]$out
}
