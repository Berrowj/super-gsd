---
schema_version: 2
phase: 19
plan: "19-01"
wave: 1
model: "sonnet"
expected_ATC_tier: "FULL"
depends_on: []
autonomous: true
requirements: ["MC-01", "MC-02", "MC-05"]
files_modified:
  - super-gsd/scripts/sgsd-mission-control.ps1
  - super-gsd/scripts/sgsd-statusline.ps1
  - super-gsd/scripts/sgsd-dashboard.ps1

goal: >
  Wire MC-01 mission-control Codex tile + MC-02 statusline indicator + MC-05 dashboard
  offload tile to live codex-live.json / codex-log.jsonl / commit-reviews.jsonl telemetry.
  All three surfaces are PS script extensions; sgsd-codex-status.ps1 helpers already loaded.

tasks:
  - id: "T1"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/sgsd-mission-control.ps1"
    input_contract: >
      sgsd-codex-status.ps1 already dot-sourced at line 100 of sgsd-mission-control.ps1.
      Get-SgsdCodexStatus, Get-SgsdCodexLogRows, Get-SgsdCodexVerdicts, Write-Row,
      Write-Header, Format-Age all in scope. $codex assigned at line 1255.
      $PlanningDir and $ProjectDir available from outer loop.
    output_contract: >
      sgsd-mission-control.ps1 extended with SGSD-Codex-Tile block after line 1284.
      Block contains: state header row (state/age/inv/avg/fallback%), up to 3 verdict rows
      with c=/w= counts and one_liner, color-coded by critical/warning count.
      "ok" from codex-live.json normalized to "idle" at render time.
    hypothesis: >
      Inserting the SGSD-Codex-Tile block after the existing CODEX inline section (line 1284)
      using already-available helper functions will display a compact, live Codex status tile
      without disrupting existing mission-control output.
    falsifier: >
      grep returns 0 matches for 'SGSD-Codex-Tile' in sgsd-mission-control.ps1, OR the PS 5.1
      AST parser reports parse errors, OR the string 'ok' appears as a raw state value in the
      rendered tile output.
    stop_rule: >
      Select-String for 'SGSD-Codex-Tile' returns >= 1 match AND PS 5.1 AST parse reports 0 errors.
    verification_cmd: "powershell -Command \"Select-String -Path 'super-gsd\\scripts\\sgsd-mission-control.ps1' -Pattern 'SGSD-Codex-Tile' -Quiet; if ($?) { exit 0 } else { exit 1 }\""

  - id: "T2"
    agent: "gsd-executor"
    model: "sonnet"
    depends_on: []
    files_touched:
      - "super-gsd/scripts/sgsd-statusline.ps1"
    input_contract: >
      sgsd-statusline.ps1 has ANSI helper C($code, $text) at line 70.
      codex-live.json written by codex-exec.sh to $PlanningDir/metrics/codex-live.json.
      Statusline does NOT dot-source sgsd-codex-status.ps1; read codex-live.json inline
      via ConvertFrom-Json for latency sensitivity. ANSI codes: Gray=90, Yellow=33, Red=31.
    output_contract: >
      sgsd-statusline.ps1 extended with a Codex segment appended to the statusline output string.
      Segment format: "[x] cdx:{state}" (ASCII-safe, no UTF-8 glyph).
      5-state color map: running=33(Yellow), timeout=31(Red), error=31(Red),
      fallback=33(DarkYellow), idle/default=90(Gray).
      "ok" from codex-live.json normalized to "idle".
    hypothesis: >
      Reading codex-live.json inline (no helper dot-source) and appending a color-coded
      cdx:{state} segment to the existing statusline output string delivers MC-02 with
      no latency regression and no PS 5.1 UTF-8 parse risk.
    falsifier: >
      grep returns 0 matches for 'cdx:' in sgsd-statusline.ps1, OR the switch block is
      missing any of the 5 states (running/timeout/error/fallback/default), OR PS 5.1 AST
      parse reports errors.
    stop_rule: >
      Select-String for 'cdx:' returns >= 1 match AND all 5 switch branches present
      AND PS 5.1 AST parse reports 0 errors.
    verification_cmd: "powershell -Command \"Select-String -Path 'super-gsd\\scripts\\sgsd-statusline.ps1' -Pattern 'cdx:' -Quiet; if ($?) { exit 0 } else { exit 1 }\""

  - id: "T3"
    agent: "gsd-executor"
    model: "sonnet"
    depends_on: []
    files_touched:
      - "super-gsd/scripts/sgsd-dashboard.ps1"
    input_contract: >
      sgsd-dashboard.ps1 has Get-TokenStats at line 342, W-Line at line 370, token stats
      render block near line 668. codex-log.jsonl at $PlanningDir/metrics/codex-log.jsonl.
      token-log.jsonl rows with model="codex" proxy claude_tokens_saved (D-07).
      STATE.md frontmatter may contain milestone_start: key for boundary filtering.
    output_contract: >
      sgsd-dashboard.ps1 extended with Get-CodexStats function (near line 342) and a
      MultimodalReview Offload tile after the token-audit section.
      Tile renders 4 D-07 metrics: invocations, fallback_rate (%), avg_duration_s,
      claude_tokens_saved (k). Token string "MultimodalReview" present in script.
    hypothesis: >
      Adding Get-CodexStats to read codex-log.jsonl with milestone boundary filtering,
      and rendering a W-Line tile labeled "MultimodalReview Offload" after the existing
      token-audit section, delivers MC-05 without modifying existing Get-TokenStats logic.
    falsifier: >
      grep returns 0 matches for 'MultimodalReview' in sgsd-dashboard.ps1, OR Get-CodexStats
      function is absent, OR fewer than 4 D-07 metrics (invocations/fallback/avg/saved)
      appear in the tile render block, OR PS 5.1 AST parse reports errors.
    stop_rule: >
      Select-String for 'MultimodalReview' returns >= 1 match AND Get-CodexStats function
      exists in the file AND PS 5.1 AST parse reports 0 errors.
    verification_cmd: "powershell -Command \"Select-String -Path 'super-gsd\\scripts\\sgsd-dashboard.ps1' -Pattern 'MultimodalReview' -Quiet; if ($?) { exit 0 } else { exit 1 }\""
---

<objective>
Wire the 3 terminal-UI surfaces that display Codex status to the live telemetry
files produced in Phase 18. All helper functions are available in
super-gsd/scripts/lib/sgsd-codex-status.ps1 which mission-control already dot-sources.

Purpose: Operators running autonomous sessions can see Codex activity at-a-glance
without switching to the dedicated Codex Monitor pane.

Output: 3 modified PS scripts, 3 atomic commits, 1 SUMMARY.
</objective>

<execution_context>
@C:\Users\jack.berrow\.claude\get-shit-done\workflows\execute-plan.md
</execution_context>

<context>
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.4\phases\19-mc-visibility\19-CONTEXT.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.4\phases\19-mc-visibility\19-RESEARCH.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. No codebase exploration needed. -->

From super-gsd/scripts/lib/sgsd-codex-status.ps1 (already dot-sourced in mission-control at line 100):

  Get-SgsdCodexStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
    Returns hashtable with: .state (string), .updatedAgeSec (int|null), .phase, .plan,
    .step, .totalRuns, .okRuns, .failedRuns, .claudeTokensSaved, .model, .exit, etc.
    NOTE: .state comes from codex-live.json "state" field which may be "ok" — normalize
    "ok" to "idle" at render time (D-03 + RESEARCH GAP-5).

  Get-SgsdCodexLogRows -PlanningDir $PlanningDir -MaxRows 6
    Returns array of parsed codex-log.jsonl rows (sorted ts descending):
    { ts, phase, plan, step, exit, duration_ms, prompt_bytes, report_bytes,
      timeout_hit, fallback_triggered, stderr_preview }

  Get-SgsdCodexVerdicts -PlanningDir $PlanningDir -MaxRows 5
    Returns array from commit-reviews.jsonl across all milestone phase dirs:
    { ts, plan, provider, critical, warning, one_liner, tier, verdict }

  Get-SgsdCodexStatusLine -Status $status
    Returns formatted string "codex {state} [{age}s] [6.5 {provider}] ..."

From super-gsd/scripts/sgsd-mission-control.ps1 (insertion points):

  Line 100: `. $__codex` — sgsd-codex-status.ps1 dot-sourced here; all Get-SgsdCodex* available
  Lines 1255-1284: existing CODEX inline status section (2-3 lines). The MC-01 tile block goes
    BELOW line 1284 as a new dedicated tile section. Use Write-Row/Write-Header helpers.
  function Write-Row($text, $color) — line 975
  function Write-Header($text) — line 983 (renders "--- {text} ---" separator in DarkGray)
  function Format-Age($sec) — line 227 (formats seconds to human "Ns"/"Nm"/"Nh")

From super-gsd/scripts/sgsd-statusline.ps1:

  Line 70: function C($code, $text) — returns "$ESC[${code}m${text}$ESC[0m" (ANSI helper)
  ANSI codes: Gray=90, Yellow=33, Red=31, DarkYellow=33+dim (use 33 for fallback).
  Statusline does NOT currently dot-source sgsd-codex-status.ps1. For latency, read
  codex-live.json directly via ConvertFrom-Json (inline, no helper). Add dot-source only
  if needed for other functions.

From super-gsd/scripts/sgsd-dashboard.ps1:

  function Get-TokenStats($tokenLog) — line 342: reads token-log.jsonl, aggregates by model
    string match (opus/sonnet/haiku). Does NOT handle "codex" model rows yet. Extend here
    or add new Get-CodexStats function for codex-log.jsonl rows.
  $tokenLog = Join-Path $ProjectDir ".planning\metrics\token-log.jsonl" — set at line 410
  Tile goes AFTER existing token audit section. Find last W-Line call before loop closes.
  function W-Line — line 370: writes a line + increments $script:linesWritten counter.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>T1: MC-01 — mission-control Codex tile (SGSD-Codex-Tile block)</name>
  <files>super-gsd/scripts/sgsd-mission-control.ps1</files>
  <action>
Insert a new tile block after line 1284 (end of existing CODEX inline status section).
The block must be labeled with the comment `# SGSD-Codex-Tile` so the grep verification passes.

Tile layout (per D-02):

  Write-Header "CODEX REVIEW"
  # State header row: "state: idle | updated: 12s ago | invocations: 9 | avg: 4s | fallback: 0%"
  $codexRows = Get-SgsdCodexLogRows -PlanningDir $PlanningDir -MaxRows 5
  $normalizedState = if ($codex.state -eq 'ok') { 'idle' } else { $codex.state }
  $stateColor = switch ($normalizedState) {
      'running'  { 'Yellow' }  'timeout' { 'Red' }
      'error'    { 'Red' }     'fallback' { 'DarkYellow' }
      default    { 'DarkGray' }   # idle / not-fired
  }
  $ageStr = if ($codex.updatedAgeSec -ne $null) { Format-Age $codex.updatedAgeSec } else { '--' }
  # Compute avg_duration and fallback_rate from $codexRows
  $totalRuns   = $codexRows.Count
  $fallbacks   = @($codexRows | Where-Object { $_.fallback_triggered }).Count
  $fallbackPct = if ($totalRuns -gt 0) { [math]::Round(($fallbacks / $totalRuns) * 100) } else { 0 }
  $avgDurSec   = if ($totalRuns -gt 0) { [math]::Round(($codexRows | Measure-Object -Property duration_ms -Average).Average / 1000, 1) } else { 0 }
  Write-Row ("  state:" + $normalizedState + " upd:" + $ageStr + " inv:" + $totalRuns + " avg:" + $avgDurSec + "s fb:" + $fallbackPct + "%") $stateColor

  # RECENT VERDICTS — last 3 invocations from Get-SgsdCodexVerdicts
  $verdicts = Get-SgsdCodexVerdicts -PlanningDir $PlanningDir -MaxRows 3
  foreach ($v in $verdicts) {
      $tier = if ($v.tier) { $v.tier } else { '?' }
      $line = "  {0,-10} {1,-8} c={2} w={3}  {4}" -f $v.plan, $tier, $v.critical, $v.warning, ($v.one_liner -replace '.{60}$','...')
      $rowColor = if ($v.critical -gt 0) { 'Red' } elseif ($v.warning -gt 0) { 'Yellow' } else { 'Green' }
      Write-Row $line $rowColor
  }
  if ($verdicts.Count -eq 0) { Write-Row "  (no verdicts yet)" "DarkGray" }

The $codex variable (from Get-SgsdCodexStatus) is already assigned at line 1255 — reuse it.
Do NOT reassign $codex. $PlanningDir and $ProjectDir are in scope from the outer loop.

Commit: `feat(19-01/T1): MC-01 mission-control Codex tile from codex-live.json + codex-log.jsonl`
  </action>
  <verify>
    <automated>powershell -Command "Select-String -Path 'super-gsd\scripts\sgsd-mission-control.ps1' -Pattern 'SGSD-Codex-Tile' -Quiet; if ($?) { exit 0 } else { exit 1 }"</automated>
  </verify>
  <done>
    `grep -c 'SGSD-Codex-Tile' super-gsd/scripts/sgsd-mission-control.ps1` returns >= 1.
    Tile renders without PS errors on a test run (load script in PS 5.1, no parse exceptions).
    State "ok" is never displayed raw — normalized to "idle" at render time.
  </done>
</task>

<task type="auto" tdd="false">
  <name>T2: MC-02 — statusline Codex state segment (5-state color-coded)</name>
  <files>super-gsd/scripts/sgsd-statusline.ps1</files>
  <action>
Append a Codex segment to the existing statusline output. The statusline renders a
one-line prompt string; find where the final output string is assembled and append
the Codex segment after the existing segments.

Implementation:

1. Near the top of the script (after Find-PlanningDir resolves $PlanningDir), add:
   ```powershell
   # MC-02: read Codex live state directly (no helper dot-source — latency sensitive)
   $codexLivePath = Join-Path $PlanningDir "metrics\codex-live.json"
   $cdxState = 'idle'
   $cdxLabel = ''
   if (Test-Path $codexLivePath) {
       try {
           $cdxLive = Get-Content $codexLivePath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction Stop
           $rawState = if ($cdxLive.state) { "$($cdxLive.state)" } else { 'idle' }
           # GAP-5: normalize "ok" -> "idle"
           $cdxState = if ($rawState -eq 'ok') { 'idle' } else { $rawState }
           if ($cdxState -eq 'running' -and $cdxLive.updated_at) {
               $ageSec = [math]::Round(((Get-Date) - [datetime]$cdxLive.updated_at).TotalSeconds)
               $cdxLabel = "cdx:running [{0}s]" -f $ageSec
           } else {
               $cdxLabel = "cdx:$cdxState"
           }
       } catch { $cdxLabel = 'cdx:idle' }
   } else {
       $cdxLabel = 'cdx:idle'
   }
   $cdxColor = switch ($cdxState) {
       'running'  { '33' }   # Yellow
       'timeout'  { '31' }   # Red
       'error'    { '31' }   # Red
       'fallback' { '33' }   # DarkYellow (same ANSI code; operator distinguishes by label)
       default    { '90' }   # Gray (idle / not-fired)
   }
   $cdxSegment = C $cdxColor " [x] $cdxLabel"
   ```
   Use ASCII `[x]` instead of ⚙ glyph — D-03 proposes ⚙ but RESEARCH notes PS 5.1 UTF-8
   parse issues (Phase 17 learned em-dash bytes misread). ASCII-safe per established pattern.

2. Append `$cdxSegment` to the statusline output string before the final Write-Host / return.

Commit: `feat(19-01/T2): MC-02 statusline codex state segment with 5-state color map`
  </action>
  <verify>
    <automated>powershell -Command "Select-String -Path 'super-gsd\scripts\sgsd-statusline.ps1' -Pattern 'cdx:' -Quiet; if ($?) { exit 0 } else { exit 1 }"</automated>
  </verify>
  <done>
    `grep -q 'cdx:' super-gsd/scripts/sgsd-statusline.ps1` passes.
    Script parses without error in PS 5.1 (`$null = [System.Management.Automation.Language.Parser]::ParseFile(...)`).
    All 5 states (idle/running/timeout/error/fallback) have color assignments in the switch block.
  </done>
</task>

<task type="auto" tdd="false">
  <name>T3: MC-05 — dashboard Multimodal Review Offload tile (4 D-07 metrics)</name>
  <files>super-gsd/scripts/sgsd-dashboard.ps1</files>
  <action>
Add a new tile after the existing token-audit section. Find the natural anchor
(search for the last token stats render block near line 668) and insert below it.

1. Add a new function `Get-CodexStats($codexLog, $milestoneStartTs)` near Get-TokenStats (line 342):
   ```powershell
   function Get-CodexStats($codexLog, $milestoneStartTs) {
       $stats = @{ invocations = 0; fallbacks = 0; totalDurationMs = 0; claudeTokensSaved = 0 }
       if (-not (Test-Path $codexLog)) { return $stats }
       try {
           foreach ($line in (Get-Content $codexLog -ErrorAction SilentlyContinue)) {
               try {
                   $e = $line | ConvertFrom-Json -ErrorAction Stop
                   # milestone boundary filter: skip rows before milestone start
                   if ($milestoneStartTs -and $e.ts -lt $milestoneStartTs) { continue }
                   $stats.invocations++
                   if ($e.fallback_triggered) { $stats.fallbacks++ }
                   if ($e.duration_ms) { $stats.totalDurationMs += [int]$e.duration_ms }
               } catch {}
           }
       } catch {}
       # claude_tokens_saved: read token-log.jsonl for model="codex" rows (D-07 proxy)
       $tokenLog = $codexLog -replace 'codex-log\.jsonl$','token-log.jsonl'
       if (Test-Path $tokenLog) {
           try {
               foreach ($line in (Get-Content $tokenLog -ErrorAction SilentlyContinue)) {
                   try {
                       $e = $line | ConvertFrom-Json -ErrorAction Stop
                       if ("$($e.model)".ToLower() -eq 'codex') {
                           $stats.claudeTokensSaved += [int]$e.total
                       }
                   } catch {}
               }
           } catch {}
       }
       return $stats
   }
   ```

2. Get milestone start_ts from STATE.md frontmatter (read first 30 lines for `milestone_start:` key)
   or fall back to $null (include all rows if not found):
   ```powershell
   $msStartTs = $null
   $stateFile = Join-Path $ProjectDir ".planning\STATE.md"
   if (Test-Path $stateFile) {
       $sfLines = Get-Content $stateFile -TotalCount 30 -ErrorAction SilentlyContinue
       $msLine = $sfLines | Where-Object { $_ -match '^milestone_start:\s*(.+)' } | Select-Object -First 1
       if ($msLine -match '^milestone_start:\s*(.+)') { $msStartTs = $Matches[1].Trim() }
   }
   ```

3. Add tile render after token stats block (near line 668):
   ```powershell
   # MC-05: Multimodal Review Offload tile
   $codexLog = Join-Path $ProjectDir ".planning\metrics\codex-log.jsonl"
   $cx = Get-CodexStats $codexLog $msStartTs
   $cxAvgSec = if ($cx.invocations -gt 0) { [math]::Round($cx.totalDurationMs / $cx.invocations / 1000, 1) } else { 0 }
   $cxFbRate = if ($cx.invocations -gt 0) { [math]::Round(($cx.fallbacks / $cx.invocations) * 100) } else { 0 }
   W-Line { Write-Host "" }
   W-Line { Write-Host " MultimodalReview Offload" -ForegroundColor Cyan }
   W-Line { Write-Host ("  inv:" + $cx.invocations + "  fb:" + $cxFbRate + "%  avg:" + $cxAvgSec + "s  saved:" + [math]::Round($cx.claudeTokensSaved/1000) + "k tok") -ForegroundColor DarkCyan }
   ```

Commit: `feat(19-01/T3): MC-05 dashboard Multimodal Review Offload tile`
  </action>
  <verify>
    <automated>powershell -Command "Select-String -Path 'super-gsd\scripts\sgsd-dashboard.ps1' -Pattern 'MultimodalReview' -Quiet; if ($?) { exit 0 } else { exit 1 }"</automated>
  </verify>
  <done>
    `grep -q 'MultimodalReview\|Offload' super-gsd/scripts/sgsd-dashboard.ps1` passes.
    Get-CodexStats function exists and filters by model="codex" from token-log.jsonl.
    All 4 D-07 metrics present: invocations, fallback_rate, avg_duration_ms, claude_tokens_saved.
    Script parses without error in PS 5.1.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| FS → PS scripts | codex-live.json / codex-log.jsonl / token-log.jsonl written by codex-exec.sh; read by PS scripts |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-19-01-01 | Tampering | codex-live.json read by statusline | accept | File is local operator-owned metrics; low-value, no PII. Read wrapped in try/catch |
| T-19-01-02 | DoS | Large codex-log.jsonl causes dashboard slow | accept | Get-Content -Tail 6 already limits read; milestone boundary filter further bounds rows |
| T-19-01-03 | Info Disclosure | stderr_preview in codex-log.jsonl rendered in MC | accept | stderr_preview truncated to 200 chars in codex-exec.sh write path; mission-control tile does not render it |
</threat_model>

<verification>
After all 3 tasks commit:

```powershell
# Verify all 3 grep sentinels pass
Select-String -Path 'super-gsd\scripts\sgsd-mission-control.ps1' -Pattern 'SGSD-Codex-Tile'
Select-String -Path 'super-gsd\scripts\sgsd-statusline.ps1'       -Pattern 'cdx:'
Select-String -Path 'super-gsd\scripts\sgsd-dashboard.ps1'        -Pattern 'MultimodalReview'

# Parse check (PS 5.1 — no runtime, just AST parse)
$err = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path 'super-gsd\scripts\sgsd-mission-control.ps1'), [ref]$null, [ref]$err)
$err.Count  # must be 0
```
</verification>

<success_criteria>
- MC-01: mission-control pane shows SGSD-Codex-Tile block with state header + up to 3 verdict rows + metrics row; "ok" never displayed raw
- MC-02: statusline segment shows [x] cdx:{state} with correct color code for all 5 states; ASCII-safe glyph
- MC-05: dashboard tile shows MultimodalReview Offload with 4 D-07 metrics computed from live codex-log.jsonl
- 3 atomic commits, one per task
- All 3 PS scripts parse without error in PS 5.1 AST parser
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/19-mc-visibility/19-01-SUMMARY.md`
with fields: FILES_CHANGED, VERIFICATION results, DEVIATIONS, ONE_LINER.
</output>
