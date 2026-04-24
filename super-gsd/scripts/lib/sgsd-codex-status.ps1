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
        model = if ($env:CODEX_MODEL) { "$($env:CODEX_MODEL)" } else { "auto" }
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
        promptBytes = 0
        reportBytes = 0
        durationMs = 0
        exit = $null
        updatedAgeSec = $null
        reportOut = ""
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
    }

    if (Test-Path $cfgPath) {
        try {
            $cfg = Get-Content $cfgPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction Stop
            if ($cfg.review_providers) {
                $out.enabled = [bool]$cfg.review_providers.codex_enabled
                if ($cfg.review_providers.default_provider) { $out.defaultProvider = "$($cfg.review_providers.default_provider)" }
                if ($cfg.review_providers.codex_model) { $out.model = "$($cfg.review_providers.codex_model)" }
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
        $out.commandPreview = "$($live.command_preview)"
        $out.promptBytes = [int]($live.prompt_bytes)
        $out.reportBytes = [int]($live.report_bytes)
        $out.durationMs = [int]($live.duration_ms)
        $out.exit = $live.exit
        $out.reportOut = "$($live.report_out)"
        $out.stderrPreview = "$($live.stderr_preview)"
        try {
            $updated = [DateTime]::Parse($live.updated_at)
            $out.updatedAgeSec = [int]((Get-Date) - $updated).TotalSeconds
        } catch {}
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
                    $out.state = if ($row.exit -eq 0) { "ok" } elseif ($row.exit -eq 5) { "timeout" } else { "error" }
                }
            }
        } catch {}
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

    if ($out.reportOut -and (Test-Path $out.reportOut)) {
        try {
            foreach ($line in (Get-Content $out.reportOut -ErrorAction SilentlyContinue)) {
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
                if ($PhaseNum -and "$($e.phase)" -ne "$PhaseNum") { continue }
                $isCodex = ($e.provider -eq "codex") -or ("$($e.command_kind)" -match '^codex-')
                if (-not $isCodex) { continue }
                $ts = [DateTime]::Parse($e.ts)
                $entries += [pscustomobject]@{
                    ts = $ts
                    label = if ($e.command_kind) { "$($e.command_kind)".ToUpper() } else { "$($e.tool)".ToUpper() }
                    detail = "$($e.target)"
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
        [int]$MaxRows = 6
    )
    $log = Join-Path $PlanningDir "metrics\codex-log.jsonl"
    if (-not (Test-Path $log)) { return @() }
    $rows = @()
    try {
        foreach ($line in (Get-Content $log -Tail $MaxRows -ErrorAction SilentlyContinue)) {
            try { $rows += ($line | ConvertFrom-Json -ErrorAction Stop) } catch {}
        }
    } catch {}
    return @($rows | Sort-Object ts -Descending)
}

function Get-SgsdCodexStatusLine {
    param($Status)
    if (-not $Status) { return "codex --" }
    $age = if ($Status.updatedAgeSec -ne $null) { "{0}s" -f [Math]::Max(0, [int]$Status.updatedAgeSec) } else { "--" }
    $scopeParts = @($Status.phase, $Status.plan, $Status.step) | Where-Object { $_ -and "$_".Trim() -ne "" }
    $scope = if ($scopeParts.Count -gt 0) { ($scopeParts -join "/") } else { "--" }
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
            summary = ("state={0} model={1} exit={2} in={3}B out={4}B" -f `
                $status.state, $status.model, `
                $(if ($null -ne $status.exit) { $status.exit } else { "--" }), `
                $status.promptBytes, $status.reportBytes)
            color = "DarkYellow"
        })
    }

    return @($rows | Sort-Object ts -Descending | Select-Object -First $MaxRows)
}
