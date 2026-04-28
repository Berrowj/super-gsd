# ============================================================================
# Super GSD - Mission Strip (Cockpit 2.0 - Phase 28)
# ============================================================================
# Renders the 6-line operator-question strip at the top of the
# sgsd-mission-control dashboard. Replaces the previous 1-line header.
# All file reads are tolerant: every parse is wrapped in try/catch with a safe
# default; this lib MUST NEVER throw out of a Render frame.
#
# Closed status vocabulary (DISCUSS 26.1, 8 states only):
#   active, waiting, blocked, reviewing, timed-out, stale, complete, unavailable
#
# Freshness boundaries (DISCUSS 26.2, no-gap):
#   generic   <30s active   30-599s waiting   >=600s stale
#   codex     <120s active(running)   120-3599s state-field   >=3600s stale
#
# Files read (cited from 27-01-cockpit-data-contract-PLAN.md):
#   .planning/STATE.md                                  (Q2 milestone+phase)
#   .planning/ROADMAP-AGENT.md                          (Q2 Goal, Q3 unlock)
#   .planning/metrics/activity-log.jsonl                (Q1 model, Q5 agents)
#     - via Get-SharedActivityEntries (do NOT re-parse)
#   .planning/metrics/codex-live.json                   (Q6 state + mtime)
#   .planning/metrics/crit-backlog.jsonl                (Q4 count, via crit-backlog.cjs)
#   .planning/metrics/heartbeat.jsonl                   (Q8 stall detection)
#   CLAUDE.md                                           (Q8 dispatch-rules table)
#
# ASCII-only string literals (PS 5.1 mojibake guard).
# ANSI / CLEAR_LINE constants live in the host script (sgsd-mission-control),
# NOT in this lib. The host owns rendering primitives.
# ============================================================================

function _Get-StateBodyValue {
    param([string]$Text, [string]$Key)
    if (-not $Text -or -not $Key) { return "" }
    $m = [regex]::Match($Text, "(?m)^\s*$([regex]::Escape($Key)):\s*`"?([^`"\r\n]+)`"?\s*$")
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return ""
}

function Get-MissionStripState {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectDir,
        [int]$ActivityTail = 500,
        [hashtable]$StateOverride = $null,
        [string]$PhaseOverride = $null
    )

    $out = [ordered]@{
        mission           = "[ MISSION ] unavailable"
        missionColor      = "DarkGray"
        objective         = "> objective unavailable"
        objectiveColor    = "DarkGray"
        model             = "> model unavailable"
        modelColor        = "DarkGray"
        blocker           = "> blocker --"
        blockerColor      = "DarkGray"
        codexAgents       = "> codex --  > agents --"
        codexAgentsColor  = "DarkGray"
        next              = "> next unavailable"
        nextColor         = "DarkGray"
        activeMilestone   = $null
        activePhase       = $null
    }

    # --------------------------------------------------------------------
    # Q2 line 1: STATE.md frontmatter -> [ MISSION ] {milestone} {status}
    # --------------------------------------------------------------------
    $milestoneStatus = "active"
    try {
        $statePath = Join-Path $ProjectDir ".planning/STATE.md"
        if (Test-Path $statePath) {
            $stateRaw = Get-Content -Raw $statePath -ErrorAction Stop
            $runMile = _Get-StateBodyValue $stateRaw "current_milestone"
            $runPhase = _Get-StateBodyValue $stateRaw "current_phase"
            $fmMatch = [regex]::Match($stateRaw, '(?ms)^---\s*\r?\n(.*?)\r?\n---\s*\r?\n')
            if ($fmMatch.Success) {
                $fm = $fmMatch.Groups[1].Value
                $mMile = [regex]::Match($fm, '(?m)^\s*milestone:\s*"?([^"\r\n]+?)"?\s*$')
                $mPhase = [regex]::Match($fm, '(?m)^\s*(?:current_phase|phase):\s*"?([0-9]+)"?\s*$')
                $mStatusLine = [regex]::Match($fm, '(?m)^\s*status:\s*"?([^"\r\n]+?)"?\s*$')
                $mStatus = [regex]::Match($fm, '(?m)^\s*milestone_status:\s*"?([^"\r\n]+?)"?\s*$')
                if ($mMile.Success)  { $out.activeMilestone = $mMile.Groups[1].Value.Trim() }
                if ($mPhase.Success) { $out.activePhase     = $mPhase.Groups[1].Value.Trim() }
                if ($runMile)        { $out.activeMilestone = $runMile }
                if ($runPhase)       { $out.activePhase     = $runPhase }
                if (-not $out.activePhase -and $mStatusLine.Success) {
                    $statusText = $mStatusLine.Groups[1].Value
                    if ($statusText -match '(?i)\bNext:\s*Phase\s+([0-9]+)\b') {
                        $out.activePhase = $matches[1]
                    } elseif ($statusText -match '\bPhase\s+([0-9]+)\b') {
                        $out.activePhase = $matches[1]
                    }
                }
                if ($mStatusLine.Success -and $mStatusLine.Groups[1].Value -match '(?i)\bactive\b') {
                    $milestoneStatus = "active"
                }
                if ($mStatus.Success) {
                    $sv = $mStatus.Groups[1].Value.Trim()
                    $currentPrefix = if ($out.activeMilestone) { '^\s*' + [regex]::Escape($out.activeMilestone) + '\b' } else { '^\s*' }
                    # Map milestone-status taxonomy (SHIPPED / SHIPPED-WITH-DEBT-N / CANDIDATE)
                    # into the closed 8-state vocab (DISCUSS 26.1). Debt does NOT introduce a
                    # new state — it's surfaced via missionColor (Yellow) on top of "complete".
                    # CANDIDATE is mapped to "blocked" because structural debt blocks SHIPPED.
                    if ($milestoneStatus -eq "active") {
                        $out.milestoneHasDebt = $false
                    } elseif ($sv -match "(?i)$currentPrefix.*CANDIDATE") {
                        $milestoneStatus = "blocked"
                    } elseif ($sv -match "(?i)$currentPrefix.*(SHIPPED-WITH-DEBT|WITH-DEBT)") {
                        $milestoneStatus = "complete"
                        $out.milestoneHasDebt = $true
                    } elseif ($sv -match "(?i)$currentPrefix.*(shipped|complete)") {
                        $milestoneStatus = "complete"
                    } elseif ($sv -match "(?i)$currentPrefix.*blocked") {
                        $milestoneStatus = "blocked"
                    } else {
                        $milestoneStatus = "active"
                    }
                }
            }
        }
    } catch {}

    if ($PhaseOverride) { $out.activePhase = $PhaseOverride }

    if ($out.activeMilestone) {
        # Mission line uses the closed 8-state vocab. Debt is signalled via
        # missionColor (Yellow on top of "complete"), not a new state name.
        $debtSuffix = if ($out.milestoneHasDebt) { " (with debt)" } else { "" }
        $phaseSuffix = if ($out.activePhase) { " P$($out.activePhase)" } else { "" }
        $out.mission = "[ MISSION ] $($out.activeMilestone)$phaseSuffix $milestoneStatus$debtSuffix"
        if ($milestoneStatus -eq "complete" -and $out.milestoneHasDebt) {
            $out.missionColor = "Yellow"
        } else {
            switch ($milestoneStatus) {
                "blocked"  { $out.missionColor = "Red" }
                "complete" { $out.missionColor = "Green" }
                default    { $out.missionColor = "DarkCyan" }
            }
        }
    }

    # --------------------------------------------------------------------
    # Q2 + Q3 line 2: ROADMAP-AGENT.md goal + unlock
    # --------------------------------------------------------------------
    try {
        $roadPath = Join-Path $ProjectDir ".planning/ROADMAP-AGENT.md"
        if ((Test-Path $roadPath) -and $out.activePhase) {
            $roadRaw = Get-Content -Raw $roadPath -ErrorAction Stop
            $phaseN = [int]$out.activePhase
            $goalCurrent = ""
            $goalNext = ""
            $isLastInMilestone = $false

            # Find phase section: any heading that contains the phase number
            $phasePattern = '(?ms)(?:^|\r?\n)#{1,4}\s*(?:Phase\s+)?' + $phaseN + '\b[^\r\n]*\r?\n(.*?)(?=\r?\n#{1,4}\s|\z)'
            $mCur = [regex]::Match($roadRaw, $phasePattern)
            if ($mCur.Success) {
                $body = $mCur.Groups[1].Value
                $gMatch = [regex]::Match($body, '(?im)^[ \t>*-]*(?:\*\*)?Goal(?:\*\*)?:\s*(.+?)\s*$')
                if ($gMatch.Success) { $goalCurrent = $gMatch.Groups[1].Value.Trim() }
            }

            # Next phase
            $nextN = $phaseN + 1
            $nextPattern = '(?ms)(?:^|\r?\n)#{1,4}\s*(?:Phase\s+)?' + $nextN + '\b[^\r\n]*\r?\n(.*?)(?=\r?\n#{1,4}\s|\z)'
            $mNext = [regex]::Match($roadRaw, $nextPattern)
            if ($mNext.Success) {
                $body2 = $mNext.Groups[1].Value
                $gMatch2 = [regex]::Match($body2, '(?im)^[ \t>*-]*(?:\*\*)?Goal(?:\*\*)?:\s*(.+?)\s*$')
                if ($gMatch2.Success) { $goalNext = $gMatch2.Groups[1].Value.Trim() }
            } else {
                $isLastInMilestone = $true
            }

            $goalShort = if ($goalCurrent) { _Truncate-Ascii $goalCurrent 60 } else { "--" }
            $unlockShort = if ($isLastInMilestone) {
                $msId = if ($out.activeMilestone) { $out.activeMilestone } else { "milestone" }
                "milestone close $msId"
            } elseif ($goalNext) {
                _Truncate-Ascii $goalNext 40
            } else {
                "--"
            }

            $out.objective = "> objective $($out.activePhase) $goalShort  > unlock $unlockShort"
            if ($isLastInMilestone) {
                $out.objectiveColor = "Magenta"
            } elseif ($goalCurrent) {
                $out.objectiveColor = "White"
            } else {
                $out.objectiveColor = "DarkGray"
            }
        }
    } catch {}

    # --------------------------------------------------------------------
    # Q1 + Q5 line 3 + line 5 (agents): activity-log via render-cache
    # DO NOT re-parse activity-log.jsonl directly.
    # --------------------------------------------------------------------
    $entries = @()
    try {
        if (Get-Command Get-SharedActivityEntries -ErrorAction SilentlyContinue) {
            $logPath = Join-Path $ProjectDir ".planning/metrics/activity-log.jsonl"
            $entries = @(Get-SharedActivityEntries -Path $logPath -Tail $ActivityTail)
        }
    } catch { $entries = @() }

    # Q1: last tool/target -> > model {state} {tool : target}
    try {
        if ($entries.Count -gt 0) {
            $lastRow = $entries[$entries.Count - 1]
            $lastTs = $null
            try { $lastTs = [DateTime]::Parse($lastRow.ts) } catch {}
            $modelState = "unavailable"
            if ($lastTs) {
                $delta = [int]((Get-Date) - $lastTs).TotalSeconds
                if ($delta -lt 30)        { $modelState = "active" }
                elseif ($delta -lt 600)   { $modelState = "waiting" }
                else                       { $modelState = "stale" }
            }
            $tool = if ($lastRow.tool) { "$($lastRow.tool)" } else { "--" }
            $target = if ($lastRow.target) { "$($lastRow.target)" } else { "" }
            $targetShort = if ($target) { _Truncate-Ascii $target 60 } else { "" }
            if ($targetShort) {
                $out.model = "> model $modelState  $tool : $targetShort"
            } else {
                $out.model = "> model $modelState  $tool"
            }
            switch ($modelState) {
                "active"  { $out.modelColor = "Green" }
                "waiting" { $out.modelColor = "Yellow" }
                "stale"   { $out.modelColor = "Red" }
                default   { $out.modelColor = "DarkGray" }
            }
        }
    } catch {}

    # Q5 agents: distinct subagent_type values for active phase only (DISCUSS 29.2)
    $agentsList = ""
    try {
        if ($entries.Count -gt 0 -and $out.activePhase) {
            $seen = @{}
            $names = New-Object System.Collections.ArrayList
            foreach ($e in $entries) {
                $rowPhase = "$($e.phase)"
                if (-not $rowPhase) { continue }
                if ($rowPhase -notmatch '^[0-9]+$') { continue }
                if ($rowPhase -ne $out.activePhase) { continue }
                $sub = "$($e.subagent_type)"
                if (-not $sub -or $sub -eq "null") { continue }
                if ($seen.ContainsKey($sub)) { continue }
                $seen[$sub] = $true
                [void]$names.Add($sub)
            }
            if ($names.Count -gt 0) {
                $joined = ($names -join ",")
                $agentsList = _Truncate-Ascii $joined 60
            }
        }
    } catch {}

    # --------------------------------------------------------------------
    # Q4 line 4: crit-backlog rows for active phase via crit-backlog.cjs
    # --------------------------------------------------------------------
    try {
        $cjsPath = Join-Path $ProjectDir "super-gsd/scripts/lib/crit-backlog.cjs"
        $backlogPath = Join-Path $ProjectDir ".planning/metrics/crit-backlog.jsonl"
        if ((Test-Path $cjsPath) -and $out.activePhase) {
            if (Test-Path $backlogPath) {
                # Use node to enumerate rowsForPhase deterministically.
                $rcPath = (Join-Path $ProjectDir "super-gsd/scripts/lib/repair-command-checker.cjs") -replace '\\','/'
                $gatesPath = (Join-Path $ProjectDir "super-gsd/registry/gates.yaml") -replace '\\','/'
                $cjsForward = $cjsPath -replace '\\','/'
                $planningDir = ($ProjectDir -replace '\\','/') + "/.planning"
                # Phase 33 ATC W2 fix: pass paths via process.argv (after `--`)
                # rather than string-interpolating into the JS literal. Defensive
                # against any path containing spaces, single quotes, or other
                # PowerShell tokenization edge cases.
                $nodeExpr = "const m=require(process.argv[1]); const rc=require(process.argv[2]); const rows=m.rowsForPhase(process.argv[3], process.argv[4]); const r=rows[0]; const repair = r ? rc.repairInstructionForBacklogRow(r, process.argv[5]) : ''; console.log(JSON.stringify({n:rows.length, first: (r && r.summary) || '', repair}));"
                $nodeOut = $null
                try {
                    $nodeOut = & node -e $nodeExpr -- $cjsForward $rcPath $planningDir "$($out.activePhase)" $gatesPath 2>$null
                } catch {}
                if ($nodeOut) {
                    try {
                        $bl = $nodeOut | ConvertFrom-Json -ErrorAction Stop
                        $n = [int]$bl.n
                        $first = "$($bl.first)"
                        if ($n -gt 0) {
                            $firstShort = _Truncate-Ascii $first 50
                            $repairText = ""
                            if ($bl.PSObject.Properties.Name -contains 'repair' -and $bl.repair) {
                                $repairShort = _Truncate-Ascii "$($bl.repair)" 60
                                $repairText = " | repair: $repairShort"
                            }
                            $out.blocker = "> blocker blocked  $n open : $firstShort$repairText"
                            $out.blockerColor = "Red"
                        } else {
                            $out.blocker = "> blocker active  0 open : --"
                            $out.blockerColor = "Green"
                        }
                    } catch {}
                }
            } else {
                $out.blocker = "> blocker unavailable  --"
                $out.blockerColor = "DarkGray"
            }
        }
    } catch {}

    # --------------------------------------------------------------------
    # Q6 line 5 (codex portion): codex-live.json
    #   <120s active(running) / 120-3599s state-field / >=3600s stale (override)
    # --------------------------------------------------------------------
    $codexLabel = "--"
    $codexState = "unavailable"
    try {
        $codexLivePath = Join-Path $ProjectDir ".planning/metrics/codex-live.json"
        if (Test-Path $codexLivePath) {
            $codexItem = Get-Item $codexLivePath -ErrorAction Stop
            $deltaSec = [int]((Get-Date) - $codexItem.LastWriteTime).TotalSeconds
            $live = $null
            try { $live = Get-Content -Raw $codexLivePath -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop } catch {}
            $rawState = if ($live -and $live.state) { "$($live.state)" } else { "unknown" }

            if ($deltaSec -ge 3600) {
                # Stale band overrides state field (DISCUSS 29.1)
                $codexState = "stale"
                $codexLabel = "stale"
            } elseif ($deltaSec -lt 120 -and $rawState -eq "running") {
                $codexState = "active"
                $codexLabel = "running"
            } else {
                # Mid-band defers to state field, mapped to closed vocabulary
                switch -Regex ($rawState) {
                    '^running$'                { $codexState = "active";    $codexLabel = "running" }
                    '^reviewing$'              { $codexState = "reviewing"; $codexLabel = "reviewing" }
                    '^(timeout|timed-out)$'    { $codexState = "timed-out"; $codexLabel = "timed-out" }
                    '^(ok|ready|done|success)$'{ $codexState = "complete";  $codexLabel = "ready" }
                    '^(error|auth-denied|contract-violation)$' { $codexState = "blocked"; $codexLabel = $rawState }
                    '^(not-fired|idle)$'       { $codexState = "waiting";   $codexLabel = "idle" }
                    default                     { $codexState = "waiting";   $codexLabel = (_Truncate-Ascii $rawState 20) }
                }
            }
        }
    } catch {}

    $agentsPart = if ($agentsList) { $agentsList } else { "--" }
    $out.codexAgents = "> codex $codexLabel  > agents $agentsPart"
    switch ($codexState) {
        "active"      { $out.codexAgentsColor = "Yellow" }
        "reviewing"   { $out.codexAgentsColor = "Cyan" }
        "timed-out"   { $out.codexAgentsColor = "Red" }
        "complete"    { $out.codexAgentsColor = "Green" }
        "stale"       { $out.codexAgentsColor = "DarkGray" }
        "blocked"     { $out.codexAgentsColor = "Red" }
        "waiting"     { $out.codexAgentsColor = "Yellow" }
        default       { $out.codexAgentsColor = "DarkGray" }
    }

    # --------------------------------------------------------------------
    # Q8 line 6: derive next action from artifact state + heartbeat freshness
    # First-match-wins precedence (DISCUSS 26 Open Derivation #3 / CLAUDE.md)
    # --------------------------------------------------------------------
    try {
        $heartbeatPath = Join-Path $ProjectDir ".planning/metrics/heartbeat.jsonl"
        $hbState = "unavailable"
        if (Test-Path $heartbeatPath) {
            try {
                $hbItem = Get-Item $heartbeatPath -ErrorAction Stop
                $hbDelta = [int]((Get-Date) - $hbItem.LastWriteTime).TotalSeconds
                if ($hbDelta -lt 30)      { $hbState = "active" }
                elseif ($hbDelta -lt 600) { $hbState = "waiting" }
                else                       { $hbState = "stale" }
            } catch {}
        }

        $action = "unavailable"
        $actionColor = "DarkGray"

        # Rule precedence (subset of CLAUDE.md dispatch table relevant to a strip lane):
        #   blocker present (Q4 red)   -> "clear blocker"           (blocked)
        #   codex reviewing            -> "wait for codex"          (reviewing)
        #   codex timed-out            -> "retry or fall back"      (blocked)
        #   heartbeat stale            -> "checkpoint or resume"    (waiting)
        #   active phase + no artifacts -> "discuss / research"     (active)
        #   default                    -> "executor"                (active)
        if ($out.blockerColor -eq "Red") {
            $action = "clear blocker (see CRIT-BACKLOG row)"
            $actionColor = "Red"
        } elseif ($codexState -eq "reviewing") {
            $action = "wait for codex review"
            $actionColor = "Cyan"
        } elseif ($codexState -eq "timed-out") {
            $action = "retry codex or fall back to claude reviewer"
            $actionColor = "Red"
        } elseif ($hbState -eq "stale") {
            $action = "checkpoint or resume per ORCHESTRATOR-CHECKPOINT.md"
            $actionColor = "Yellow"
        } elseif ($out.activePhase) {
            $action = "executor dispatch (phase $($out.activePhase))"
            $actionColor = "Green"
        }

        $out.next = "> next $action"
        $out.nextColor = $actionColor
    } catch {}

    return $out
}

# ----------------------------------------------------------------------------
# Internal helper: ASCII-safe truncation with trailing `~` marker.
# Matches Format-SubstrateRow truncation idiom (substrate line 201).
# ----------------------------------------------------------------------------
function _Truncate-Ascii {
    param(
        [string]$Text,
        [int]$Max
    )
    if (-not $Text) { return "" }
    if ($Text.Length -le $Max) { return $Text }
    if ($Max -le 1) { return "~" }
    return $Text.Substring(0, $Max - 1) + "~"
}

# ----------------------------------------------------------------------------
# Render-MissionStrip: emits exactly 6 Write-Host rows in DISCUSS 28.2 order.
# Host script owns $CLEAR_LINE; this lib references it via $script: scope.
# ----------------------------------------------------------------------------
function Render-MissionStrip {
    param(
        [Parameter(Mandatory = $true)]
        $State
    )
    Write-Host $State.mission     -NoNewline -ForegroundColor $State.missionColor;    Write-Host $CLEAR_LINE
    Write-Host $State.objective   -NoNewline -ForegroundColor $State.objectiveColor;  Write-Host $CLEAR_LINE
    Write-Host $State.model       -NoNewline -ForegroundColor $State.modelColor;      Write-Host $CLEAR_LINE
    Write-Host $State.blocker     -NoNewline -ForegroundColor $State.blockerColor;    Write-Host $CLEAR_LINE
    Write-Host $State.codexAgents -NoNewline -ForegroundColor $State.codexAgentsColor;Write-Host $CLEAR_LINE
    Write-Host $State.next        -NoNewline -ForegroundColor $State.nextColor;       Write-Host $CLEAR_LINE
}
