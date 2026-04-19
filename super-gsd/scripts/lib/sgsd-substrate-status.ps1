# ============================================================================
# Super GSD · DLB-04 Substrate Status Helper
# ============================================================================
# Shared by sgsd-mission-control (SGSD1), sgsd-narrative (SGSD2), and
# sgsd-gate-verdict (SGSD3). Reads the DLB-04 output files and returns
# structured status.
#
# Files read:
#   .planning/resource-registry/agents.jsonl
#   .planning/proposals/*.md
#   .planning/metrics/sepl-log.jsonl
#   .brv/context-tree/trajectory-hypothesis/*.md
#   .brv/context-tree/trajectory-hypothesis/candidate/*.md
#   .planning/metrics/distillation-novelty.jsonl
# ============================================================================

function Get-SubstrateStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectDir
    )

    $result = @{
        RegistryPresent    = $false
        AgentsCount        = 0
        ProposalsPending   = 0
        ProposalsCommitted = 0
        ProposalsRejected  = 0
        HypothesesCount    = 0
        CandidatesCount    = 0
        NoveltyMedian      = $null
        NoveltyCount       = 0
        Gate3Verdict       = "unrated"
        LatestHypMtime     = $null
    }

    # Registry
    $registry = Join-Path $ProjectDir ".planning/resource-registry/agents.jsonl"
    if (Test-Path $registry) {
        $result.RegistryPresent = $true
        try {
            $result.AgentsCount = (Get-Content $registry -ErrorAction Stop | Where-Object { $_.Trim() -ne "" }).Count
        } catch { $result.AgentsCount = 0 }
    }

    # SEPL queue
    $proposalsDir = Join-Path $ProjectDir ".planning/proposals"
    if (Test-Path $proposalsDir) {
        $proposalFiles = Get-ChildItem $proposalsDir -Filter "*.md" -ErrorAction SilentlyContinue
        foreach ($pf in $proposalFiles) {
            $statusLine = Select-String -Path $pf.FullName -Pattern "^status:\s*(\S+)" -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($statusLine) {
                $status = $statusLine.Matches[0].Groups[1].Value
                switch ($status) {
                    "pending"   { $result.ProposalsPending++ }
                    "committed" { $result.ProposalsCommitted++ }
                    "rejected"  { $result.ProposalsRejected++ }
                }
            }
        }
    }

    # Trajectory hypotheses
    $hypDir = Join-Path $ProjectDir ".brv/context-tree/trajectory-hypothesis"
    if (Test-Path $hypDir) {
        $hyp = Get-ChildItem $hypDir -Filter "*.md" -ErrorAction SilentlyContinue | Where-Object { -not $_.PSIsContainer }
        $result.HypothesesCount = $hyp.Count
        if ($hyp.Count -gt 0) {
            $result.LatestHypMtime = ($hyp | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
        }
    }

    $candDir = Join-Path $ProjectDir ".brv/context-tree/trajectory-hypothesis/candidate"
    if (Test-Path $candDir) {
        $result.CandidatesCount = (Get-ChildItem $candDir -Filter "*.md" -ErrorAction SilentlyContinue).Count
    }

    # Gate 3 · novelty rating
    $noveltyLog = Join-Path $ProjectDir ".planning/metrics/distillation-novelty.jsonl"
    if (Test-Path $noveltyLog) {
        $ratings = @()
        foreach ($line in (Get-Content $noveltyLog -ErrorAction SilentlyContinue)) {
            if ($line.Trim() -eq "") { continue }
            if ($line -match '"novelty_rating":(\d+)') {
                $ratings += [int]$Matches[1]
            }
        }
        $result.NoveltyCount = $ratings.Count
        if ($ratings.Count -gt 0) {
            $sorted = $ratings | Sort-Object
            if ($sorted.Count % 2 -eq 1) {
                $result.NoveltyMedian = $sorted[[math]::Floor($sorted.Count / 2)]
            } else {
                $mid1 = $sorted[$sorted.Count / 2 - 1]
                $mid2 = $sorted[$sorted.Count / 2]
                $result.NoveltyMedian = [math]::Round(($mid1 + $mid2) / 2.0, 1)
            }
            # Contrarian Gate 3: median < 2.0 -> retire
            if ($result.NoveltyMedian -lt 2.0) {
                $result.Gate3Verdict = "RETIRE"
            } else {
                $result.Gate3Verdict = "CARRY to v1.3"
            }
        }
    }

    return $result
}

# Renders a compact one-line status string suitable for a dashboard header.
function Format-SubstrateStatusLine {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Status
    )

    $parts = @()

    if ($Status.RegistryPresent) {
        $parts += "[reg $($Status.AgentsCount) agents]"
    } else {
        $parts += "[reg --]"
    }

    $anySepl = $Status.ProposalsPending + $Status.ProposalsCommitted + $Status.ProposalsRejected
    if ($anySepl -eq 0) {
        $parts += "[sepl idle]"
    } else {
        $parts += "[sepl $($Status.ProposalsPending)p/$($Status.ProposalsCommitted)c/$($Status.ProposalsRejected)r]"
    }

    if ($Status.HypothesesCount + $Status.CandidatesCount -gt 0) {
        $parts += "[distill $($Status.HypothesesCount)h/$($Status.CandidatesCount)q]"
    } else {
        $parts += "[distill --]"
    }

    if ($Status.NoveltyCount -gt 0) {
        $parts += "[g3 $($Status.NoveltyMedian) $($Status.Gate3Verdict)]"
    } else {
        $parts += "[g3 unrated]"
    }

    return ($parts -join " ")
}

# Renders a multi-line panel. Returns an array of strings.
# Uses ASCII-only characters for encoding portability.
function Format-SubstratePanel {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Status,
        [int]$Width = 66
    )

    $lines = @()
    $inner = $Width - 2
    $border = "-" * $inner

    $lines += "+$border+"

    $title = " DLB-04 SUBSTRATE "
    $pad = ($inner - $title.Length) / 2
    $titleLine = "|" + (" " * [math]::Floor($pad)) + $title + (" " * [math]::Ceiling($pad)) + "|"
    $lines += $titleLine
    $lines += "+$border+"

    $regState = if ($Status.RegistryPresent) { "OK - $($Status.AgentsCount) agents" } else { "-- not synced" }
    $lines += Format-SubstrateRow "RSPL registry" $regState $Width

    $anySepl = $Status.ProposalsPending + $Status.ProposalsCommitted + $Status.ProposalsRejected
    $seplState = if ($anySepl -eq 0) {
        "idle (0 proposals - v1.2 kill check pending)"
    } else {
        "$($Status.ProposalsPending) pending / $($Status.ProposalsCommitted) committed / $($Status.ProposalsRejected) rejected"
    }
    $lines += Format-SubstrateRow "SEPL queue" $seplState $Width

    $distState = if ($Status.HypothesesCount -eq 0 -and $Status.CandidatesCount -eq 0) {
        "-- no milestone distillation yet"
    } else {
        "$($Status.HypothesesCount) hypotheses / $($Status.CandidatesCount) quarantined"
    }
    $lines += Format-SubstrateRow "Distillation" $distState $Width

    $gate3State = if ($Status.NoveltyCount -eq 0) {
        "unrated - run sgsd-distill-milestone v1.1 --rate"
    } else {
        "median $($Status.NoveltyMedian) / $($Status.Gate3Verdict) / $($Status.NoveltyCount) rated"
    }
    $lines += Format-SubstrateRow "Gate 3 (novelty)" $gate3State $Width

    $lines += "+$border+"
    return $lines
}

function Format-SubstrateRow {
    param($label, $value, $width)
    $labelW = 18
    $valueW = $width - $labelW - 4
    if ($value.Length -gt $valueW) {
        $value = $value.Substring(0, $valueW - 1) + "~"
    }
    $labelPadded = $label.PadRight($labelW)
    $valuePadded = $value.PadRight($valueW)
    return "| $labelPadded $valuePadded |"
}
