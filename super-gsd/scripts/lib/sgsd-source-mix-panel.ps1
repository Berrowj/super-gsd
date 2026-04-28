# ============================================================================
# Phase 50 A1 source-mix panel.
# Reads context-packet-log.jsonl tail (read-only). Frozen 7-key shape mirrors
# Phase 45 super-gsd/tools/context-packet/build.cjs:239-268. Do NOT invent an
# 8th key.
# Lock 13: never throws upward; degrade-to-unavailable on error.
# T-50-03 mitigation: $Phase used as string filter only, never as path.
# ASCII-only literals (PS5.1 mojibake guard).
# ============================================================================

# Frozen const - order-locked. Mirrors build.cjs CONTEXT_SOURCE_MIX_KEYS.
$script:CONTEXT_SOURCE_MIX_KEYS = @(
    'raw_evidence',
    'phase_capsule',
    'validated_thought',
    'reusable_rule',
    'guardrail',
    'index_snippet',
    'vtp_packet'
)

# Local fallback Trunc.
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

function _SgsdSourceMixVerdictColor {
    param([string]$Verdict)
    switch ($Verdict) {
        "ok"        { return "Green" }
        "warn"      { return "Yellow" }
        "degraded"  { return "Red" }
        default     { return "DarkGray" }
    }
}

function Get-LatestContextSourceMix {
    param(
        [string]$ProjectDir,
        [string]$Phase
    )
    try {
        if (-not $ProjectDir) { return $null }
        $logPath = Join-Path $ProjectDir ".planning/metrics/context-packet-log.jsonl"
        if (-not (Test-Path -LiteralPath $logPath)) { return $null }

        $lines = $null
        if (Get-Command Get-CachedTail -ErrorAction SilentlyContinue) {
            try { $lines = @(Get-CachedTail -Path $logPath -Tail 50) } catch { $lines = $null }
        }
        if (-not $lines) {
            try { $lines = @(Get-Content -LiteralPath $logPath -Tail 50 -ErrorAction SilentlyContinue) } catch { $lines = @() }
        }
        if (-not $lines -or $lines.Count -eq 0) { return $null }

        # Walk backwards for newest match.
        for ($i = $lines.Count - 1; $i -ge 0; $i--) {
            $line = $lines[$i]
            if (-not $line) { continue }
            $row = $null
            try { $row = $line | ConvertFrom-Json -ErrorAction Stop } catch { continue }
            if ($null -eq $row) { continue }

            if ($Phase) {
                $rowPhase = $null
                try { $rowPhase = "$($row.phase)" } catch { $rowPhase = $null }
                if ($rowPhase -ne $Phase) { continue }
            }

            $mix = $null
            try {
                if ($null -ne $row.metadata -and $null -ne $row.metadata.context_source_mix) {
                    $mix = $row.metadata.context_source_mix
                }
            } catch { $mix = $null }
            if ($null -ne $mix) { return $mix }
        }
        return $null
    } catch {
        return $null
    }
}

function _SgsdMixGet {
    param($Mix, [string]$Key)
    if ($null -eq $Mix) { return 0 }
    try {
        $v = $Mix.$Key
        if ($null -eq $v) { return 0 }
        return [int]([double]$v)
    } catch {
        return 0
    }
}

function Format-SgsdSourceMixPanel {
    param(
        $Mix,
        $Verdict,
        [int]$PaneWidth = 60
    )
    try {
        if ($null -eq $Mix) {
            return [pscustomobject]@{ Line = (Trunc "SOURCE MIX  unavailable" $PaneWidth); Color = "DarkGray" }
        }

        # Locked-order extraction. Short labels per PLAN: raw/cap/vt/rule/guard/idx/vtp.
        $raw   = _SgsdMixGet $Mix 'raw_evidence'
        $cap   = _SgsdMixGet $Mix 'phase_capsule'
        $vt    = _SgsdMixGet $Mix 'validated_thought'
        $rule  = _SgsdMixGet $Mix 'reusable_rule'
        $guard = _SgsdMixGet $Mix 'guardrail'
        $idx   = _SgsdMixGet $Mix 'index_snippet'
        $vtp   = _SgsdMixGet $Mix 'vtp_packet'

        $verdictStr = "unavailable"
        if ($null -ne $Verdict) {
            try { $verdictStr = [string]$Verdict } catch { $verdictStr = "unavailable" }
            if (-not $verdictStr) { $verdictStr = "unavailable" }
        }
        $color = _SgsdSourceMixVerdictColor $verdictStr

        $body = "SOURCE MIX  raw {0}  cap {1}  vt {2}  rule {3}  guard {4}  idx {5}  vtp {6}" -f `
            $raw, $cap, $vt, $rule, $guard, $idx, $vtp
        $line = "{0}  [budget {1}]" -f $body, $verdictStr

        return [pscustomobject]@{ Line = (Trunc $line $PaneWidth); Color = $color }
    } catch {
        return [pscustomobject]@{ Line = "SOURCE MIX  unavailable"; Color = "DarkGray" }
    }
}
