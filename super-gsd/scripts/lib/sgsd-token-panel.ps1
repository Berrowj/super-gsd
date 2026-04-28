# ============================================================================
# Phase 50 A1 cost panel. Read-only renderer over the Node bridge snapshot.
# Lock 13: never throws upward; degrade-to-unavailable on missing data.
# Pattern 1 (RESEARCH): NEVER re-aggregate; only render snapshot.byRolePhase.
# ASCII-only literals (PS5.1 mojibake guard).
# ============================================================================

# Local fallback Trunc (host scope may already define one; this guards against
# acceptance-test standalone dot-source).
if (-not (Get-Command Trunc -ErrorAction SilentlyContinue)) {
    function Trunc {
        param([string]$Text, [int]$Width)
        if ($null -eq $Text) { return "" }
        if ($Width -le 0)    { return "" }
        if ($Text.Length -le $Width) { return $Text }
        if ($Width -le 3) { return $Text.Substring(0, $Width) }
        return $Text.Substring(0, $Width - 1) + "."
    }
}

function _SgsdTokenVerdictColor {
    param([string]$Verdict)
    switch ($Verdict) {
        "ok"        { return "Green" }
        "warn"      { return "Yellow" }
        "degraded"  { return "Red" }
        default     { return "DarkGray" }
    }
}

function Format-SgsdTokenPanel {
    param(
        $Snapshot,
        [int]$PaneWidth = 60
    )
    try {
        if ($null -eq $Snapshot) {
            return ,([pscustomobject]@{ Line = "TOKENS  unavailable"; Color = "DarkGray" })
        }
        $rows = $null
        try { $rows = $Snapshot.byRolePhase } catch { $rows = $null }

        # Phase 41 may return either an array of rows OR an unavailable envelope.
        $unavailable = $false
        if ($null -eq $rows) {
            $unavailable = $true
        } else {
            try {
                if ($rows.PSObject.Properties.Match('unavailable').Count -gt 0 -and $rows.unavailable -eq $true) {
                    $unavailable = $true
                }
            } catch { }
        }
        if ($unavailable) {
            return ,([pscustomobject]@{ Line = "TOKENS  unavailable"; Color = "DarkGray" })
        }

        # Coerce to array (Phase 41 sorts descending by total already).
        $rowList = @($rows)
        if ($rowList.Count -eq 0) {
            $verdictNoSpend = "unavailable"
            try {
                if ($null -ne $Snapshot.budget -and $Snapshot.budget.verdict) {
                    $verdictNoSpend = [string]$Snapshot.budget.verdict
                }
            } catch { $verdictNoSpend = "unavailable" }
            $colorNoSpend = _SgsdTokenVerdictColor $verdictNoSpend
            return @(
                [pscustomobject]@{ Line = "TOKENS  no spend yet"; Color = "DarkGray" }
                [pscustomobject]@{ Line = ("BUDGET  {0}" -f $verdictNoSpend); Color = $colorNoSpend }
            )
        }

        # Sort defensively (descending by total).
        $sorted = $rowList | Sort-Object -Property total -Descending

        $total = 0
        foreach ($r in $sorted) {
            try { $total += [int64]([double]$r.total) } catch { }
        }

        $totalK = [int][math]::Round($total / 1000.0)
        $lines = New-Object System.Collections.ArrayList

        $headerLine = "TOKENS  total {0}k  rows {1}" -f $totalK, $sorted.Count
        [void]$lines.Add([pscustomobject]@{
            Line  = (Trunc $headerLine $PaneWidth)
            Color = "White"
        })

        # Top 2 rows.
        $top = $sorted | Select-Object -First 2
        foreach ($row in $top) {
            $key   = ""
            $rt    = 0
            $cache = 0.0
            $found = 0
            try { $key   = [string]$row.key }   catch { $key = "" }
            try { $rt    = [int64]([double]$row.total) } catch { $rt = 0 }
            try { $cache = [double]$row.cache_read_ratio } catch { $cache = 0.0 }
            try { $found = [int]([double]$row.useful_findings_per_100k) } catch { $found = 0 }

            $rk = [int][math]::Round($rt / 1000.0)
            $cachePct = "{0,4:P0}" -f $cache
            $lineText = "  {0,-22} {1,8}k  cache {2}  found/100k {3,3}" -f $key, $rk, $cachePct, $found
            [void]$lines.Add([pscustomobject]@{
                Line  = (Trunc $lineText $PaneWidth)
                Color = "Gray"
            })
        }

        # Pad to ensure 3 data rows + budget line (4 total) regardless of sorted.Count.
        while ($lines.Count -lt 3) {
            [void]$lines.Add([pscustomobject]@{ Line = ""; Color = "Gray" })
        }

        # Budget verdict line.
        $verdict = "unavailable"
        try {
            if ($null -ne $Snapshot.budget) {
                if ($Snapshot.budget.PSObject.Properties.Match('unavailable').Count -gt 0 -and $Snapshot.budget.unavailable -eq $true) {
                    $verdict = "unavailable"
                } elseif ($Snapshot.budget.verdict) {
                    $verdict = [string]$Snapshot.budget.verdict
                }
            }
        } catch { $verdict = "unavailable" }
        $color = _SgsdTokenVerdictColor $verdict
        [void]$lines.Add([pscustomobject]@{
            Line  = (Trunc ("BUDGET  {0}" -f $verdict) $PaneWidth)
            Color = $color
        })

        return $lines.ToArray()
    } catch {
        return ,([pscustomobject]@{ Line = "TOKENS  unavailable"; Color = "DarkGray" })
    }
}
