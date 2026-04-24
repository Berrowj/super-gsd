---
schema_version: 2
phase: 20
plan: "20-03"
wave: 3
model: "sonnet"
expected_ATC_tier: "FULL"
depends_on: ["20-02"]
autonomous: true
requirements: ["HANDOFF-03"]
files_modified:
  - super-gsd/scripts/sgsd-stop-handoff.sh
  - super-gsd/scripts/sgsd-mission-control.ps1
  - super-gsd/hooks/sgsd-session-start.js
  - super-gsd/scripts/sgsd-gate-verdict.ps1

goal: >
  Wire telemetry (handoff-log.jsonl writes confirmed), extend sgsd-mission-control.ps1
  with SGSD-Handoff-Tile, patch sgsd-session-start.js to pair parent+child session IDs
  using path.join (not toUnixPath), and add --milestone-close-check flag to
  sgsd-gate-verdict.ps1 for aggregate chain stats.

tasks:
  - id: "T1"
    agent: "gsd-executor"
    model: "sonnet"
    files_touched:
      - "super-gsd/scripts/sgsd-stop-handoff.sh"
      - "super-gsd/scripts/sgsd-mission-control.ps1"
      - "super-gsd/hooks/sgsd-session-start.js"
      - "super-gsd/scripts/sgsd-gate-verdict.ps1"
    input_contract: >
      20-01 + 20-02 delivered sgsd-stop-handoff.sh with all 6 pre-conditions, _log_row
      helper, and handoff-log.jsonl appends. sgsd-mission-control.ps1 has SGSD-Codex-Tile
      from Phase 19 (grep SGSD-Codex-Tile confirmed). sgsd-session-start.js fires on every
      SessionStart hook; uses toUnixPath(process.cwd()) which produces /mnt/c/... paths on
      native Windows Node (RESEARCH V5 bug). sgsd-gate-verdict.ps1 exists (modified in v1.4).
      handoff-log.jsonl schema: {ts, from_session_id, to_session_id, reason, chain_depth,
      cumulative_runtime_s, refused?, spawn_exit?, checkpoint_path?}
    output_contract: >
      sgsd-stop-handoff.sh: _log_row outputs all D-05 schema fields including
      cumulative_runtime_s (computed as sum of duration_s across prior handoff-log rows
      with reason="spawned" in current chain). No schema changes — just verify completeness.
      sgsd-mission-control.ps1: SGSD-Handoff-Tile block added after SGSD-Codex-Tile.
      Tile shows chain_depth / cumulative_runtime / last_outcome / handoff_enabled state.
      sgsd-session-start.js: on fresh session, if latest handoff-log.jsonl row has
      to_session_id: null, update it with current $$ PID (pairs parent+child).
      Uses path.join(process.cwd(), '.planning', 'metrics', 'handoff-log.jsonl') — NOT toUnixPath.
      sgsd-gate-verdict.ps1: --milestone-close-check flag added; prints total_chains,
      max_depth_reached, stall_count (chains where refused:cooldown) from handoff-log.jsonl.
    hypothesis: >
      Adding SGSD-Handoff-Tile to mission-control (reusing Write-Row/Write-Header helpers
      already in scope), patching the path bug in sgsd-session-start.js, and adding a
      --milestone-close-check flag to sgsd-gate-verdict.ps1 delivers HANDOFF-03 without
      introducing new dependencies beyond what Phases 18-19 already established.
    falsifier: >
      grep returns 0 matches for SGSD-Handoff-Tile in sgsd-mission-control.ps1, OR
      sgsd-session-start.js still contains toUnixPath after modification, OR
      sgsd-gate-verdict.ps1 does not exit 0 when invoked with --milestone-close-check
      (even when handoff-log.jsonl is absent or empty).
    stop_rule: >
      grep -q SGSD-Handoff-Tile super-gsd/scripts/sgsd-mission-control.ps1 exits 0 AND
      grep -q toUnixPath super-gsd/hooks/sgsd-session-start.js returns non-zero (removed) AND
      powershell -File super-gsd/scripts/sgsd-gate-verdict.ps1 --milestone-close-check exits 0.
    verification_cmd: "grep -q 'SGSD-Handoff-Tile' super-gsd/scripts/sgsd-mission-control.ps1 && ! grep -q 'toUnixPath' super-gsd/hooks/sgsd-session-start.js && echo 'HANDOFF-03 sentinels OK'"
    known_deadends:
      - "Do NOT add SGSD-Handoff-Tile before SGSD-Codex-Tile — it goes AFTER the existing Codex tile"
      - "Do NOT use toUnixPath in sgsd-session-start.js — produces /mnt/c/... on native Windows Node (RESEARCH V5)"
      - "Do NOT require handoff-log.jsonl to exist for --milestone-close-check — file may be absent on fresh installs; treat as zero stats"
      - "Do NOT attempt to read CLAUDE_SESSION_ID for to_session_id pairing — use $$ PID fallback (RESEARCH V2)"
---

<objective>
Complete HANDOFF-03: wire telemetry into mission-control, fix the Windows path bug
in session-start hook, and add milestone-close aggregate stats.

Purpose: Give operators real-time visibility into autonomous chain state via MC
tile, enable parent+child session pairing in handoff-log.jsonl, and surface
handoff aggregate stats at milestone close.

Output: 4 modified files, 1 atomic commit.
</objective>

<execution_context>
@C:\Users\jack.berrow\.claude\get-shit-done\workflows\execute-plan.md
</execution_context>

<context>
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.4\phases\20-autonomous-handoff\20-CONTEXT.md
@C:\Users\jack.berrow\GSDedits\.planning\milestones\v1.4\phases\20-autonomous-handoff\20-RESEARCH.md

<interfaces>
<!-- Contracts the executor needs. Read files before editing — each file has unique structure. -->

sgsd-mission-control.ps1 insertion point:
  SGSD-Codex-Tile block ends with comment marker '# end SGSD-Codex-Tile' OR search for
  the last Write-Row call in the CODEX REVIEW section. Handoff tile goes AFTER this block.
  Write-Row($text, $color) and Write-Header($text) are already in scope (line 975/983).
  $PlanningDir in scope from outer loop.
  $handoffLog = Join-Path $PlanningDir "metrics\handoff-log.jsonl"

SGSD-Handoff-Tile render logic (D-06):
  Read latest handoff-log.jsonl row; extract chain_depth, reason, refused.
  Compute cumulative_runtime_s as sum of prior rows in chain.
  Guard: if config.json handoff.enabled=false, show "handoff: disabled" in DarkGray.
  Row 1: "chain_depth: N | cumulative: Xs | last: spawned|refused_X"
  Color: spawned=Green, refused_*=Yellow, failed=Red, disabled=DarkGray.

sgsd-session-start.js key facts (read file before editing):
  - Uses toUnixPath(process.cwd()) for path construction — REPLACE with path.join(process.cwd(), ...)
  - Fires on every SessionStart hook
  - To pair: read last handoff-log.jsonl row; if to_session_id is null, update with current PID ($$)
  - Use path.join(process.cwd(), '.planning', 'metrics', 'handoff-log.jsonl') for log path
  - Read-mutate-write pattern (never fs.appendFile for this update — update last line in place)
  - to_session_id value: process.pid.toString() (Node equivalent of $$ PID)

sgsd-gate-verdict.ps1 --milestone-close-check:
  New param block: param([switch]$MilestoneCloseCheck)
  When set: read all handoff-log.jsonl rows from $PlanningDir/metrics/handoff-log.jsonl.
  Compute: total_chains = count rows where reason="spawned", max_depth_reached = max chain_depth,
  stall_count = count rows where refused contains "cooldown".
  Output ASCII table. Exit 0 always (even if file absent — output zeroes).

handoff-log.jsonl D-05 complete schema (verify _log_row in sgsd-stop-handoff.sh emits all):
  ts, from_session_id (pid-$$), to_session_id (null at write time),
  reason (spawned|refused|dry_run), chain_depth (int),
  cumulative_runtime_s (int — sum prior spawned rows in chain),
  checkpoint_path (string), refused? (string), spawn_exit? (int)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>T1: HANDOFF-03 — handoff-log schema + MC Handoff-Tile + session-start pairing + milestone-close stats</name>
  <files>super-gsd/scripts/sgsd-stop-handoff.sh, super-gsd/scripts/sgsd-mission-control.ps1, super-gsd/hooks/sgsd-session-start.js, super-gsd/scripts/sgsd-gate-verdict.ps1</files>
  <action>
Work through 4 sub-tasks in order. Commit once at end.

--- SUB-TASK A: Verify/complete _log_row in sgsd-stop-handoff.sh ---

Read super-gsd/scripts/sgsd-stop-handoff.sh. Confirm _log_row emits all D-05 fields.
The spawned-path row needs cumulative_runtime_s. Compute it before the SPAWN section:

```bash
# Compute cumulative_runtime_s (sum of prior spawned rows in current chain)
CUMULATIVE_S=0
if [[ -f "$LOG_PATH" ]]; then
  CUMULATIVE_S=$(node -e "
try {
  const rows = require('fs').readFileSync('$LOG_PATH','utf8')
    .split('\n').filter(Boolean)
    .map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
    .filter(Boolean);
  const total = rows.reduce((s,r) => s + (r.reason==='spawned' ? (r.cumulative_runtime_s||0) : 0), 0);
  // approximate: add 0 per-chain (no wall-clock duration tracked yet)
  process.stdout.write(String(total));
} catch(e) { process.stdout.write('0'); }
" 2>/dev/null || echo "0")
fi
```

Update the spawned _log_row call to include cumulative_runtime_s:
```bash
_log_row "spawned" "$CHAIN_DEPTH" ",\"cumulative_runtime_s\":$CUMULATIVE_S"
```

Run bash -n to confirm no syntax errors.

--- SUB-TASK B: SGSD-Handoff-Tile in sgsd-mission-control.ps1 ---

Read super-gsd/scripts/sgsd-mission-control.ps1. Find SGSD-Codex-Tile block end.
Insert SGSD-Handoff-Tile immediately after it:

```powershell
# SGSD-Handoff-Tile
$handoffLog = Join-Path $PlanningDir "metrics\handoff-log.jsonl"
$handoffCfgPath = Join-Path $ProjectDir ".planning\config.json"
$handoffEnabled = $false
try {
  $hCfg = Get-Content $handoffCfgPath -Raw -ErrorAction SilentlyContinue | ConvertFrom-Json -ErrorAction Stop
  $handoffEnabled = [bool]($hCfg.handoff -and $hCfg.handoff.enabled -eq $true)
} catch {}

Write-Header "HANDOFF"
if (-not $handoffEnabled) {
  Write-Row "  handoff: disabled (set config.json handoff.enabled=true to activate)" "DarkGray"
} else {
  $hDepth = 0; $hRuntime = 0; $hOutcome = "no_handoffs_yet"; $hColor = "DarkGray"
  if (Test-Path $handoffLog) {
    try {
      $hRows = Get-Content $handoffLog -ErrorAction SilentlyContinue | Where-Object { $_ -match '\{' } | ForEach-Object {
        try { $_ | ConvertFrom-Json -ErrorAction Stop } catch {}
      }
      $hLast = $hRows | Select-Object -Last 1
      if ($hLast) {
        $hDepth   = [int]($hLast.chain_depth ?? 0)
        $hRuntime = [int]($hLast.cumulative_runtime_s ?? 0)
        $hOutcome = if ($hLast.refused) { "refused_$($hLast.refused)" } elseif ($hLast.reason) { $hLast.reason } else { "unknown" }
        $hColor = switch -Wildcard ($hOutcome) {
          "spawned"        { "Green" }
          "refused_*"      { "Yellow" }
          "failed"         { "Red" }
          default          { "DarkGray" }
        }
      }
    } catch {}
  }
  Write-Row ("  chain_depth: " + $hDepth + " | cumulative: " + $hRuntime + "s | last: " + $hOutcome) $hColor
}
```

Run powershell -Command "$null = [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'super-gsd\scripts\sgsd-mission-control.ps1'),[ref]`$null,[ref]`$errs); `$errs.Count" to verify parse count = 0.

--- SUB-TASK C: Fix path bug + add pairing in sgsd-session-start.js ---

Read super-gsd/hooks/sgsd-session-start.js. Find all occurrences of toUnixPath.
Replace path construction calls with path.join(process.cwd(), ...) equivalents.
Example replacement pattern:
  BEFORE: toUnixPath(process.cwd()) + '/.planning/metrics/handoff-log.jsonl'
  AFTER:  path.join(process.cwd(), '.planning', 'metrics', 'handoff-log.jsonl')

Ensure const path = require('path'); is at top of file (add if absent).

After the existing session-start logic, append the to_session_id pairing block:

```javascript
// HANDOFF-03: pair parent+child session IDs
// If latest handoff-log row has to_session_id: null, update it with current PID
const handoffLogPath = path.join(process.cwd(), '.planning', 'metrics', 'handoff-log.jsonl');
try {
  if (require('fs').existsSync(handoffLogPath)) {
    const lines = require('fs').readFileSync(handoffLogPath, 'utf8')
      .split('\n').filter(Boolean);
    if (lines.length > 0) {
      let lastRow;
      try { lastRow = JSON.parse(lines[lines.length - 1]); } catch(e) {}
      if (lastRow && lastRow.to_session_id === null) {
        lastRow.to_session_id = 'pid-' + process.pid;
        lines[lines.length - 1] = JSON.stringify(lastRow);
        require('fs').writeFileSync(handoffLogPath, lines.join('\n') + '\n');
      }
    }
  }
} catch(e) {
  // Non-fatal — session continues if pairing fails
}
```

Verify toUnixPath is fully removed: grep -c toUnixPath super-gsd/hooks/sgsd-session-start.js must return 0.

--- SUB-TASK D: --milestone-close-check in sgsd-gate-verdict.ps1 ---

Read super-gsd/scripts/sgsd-gate-verdict.ps1. Find the param() block at top.
Add [switch]$MilestoneCloseCheck to the param block.

Near end of script (or after existing logic), add:

```powershell
if ($MilestoneCloseCheck) {
  $handoffLog = Join-Path $PSScriptRoot "..\..\.planning\metrics\handoff-log.jsonl"
  # Resolve relative to script location; fall back to cwd-based path
  if (-not (Test-Path $handoffLog)) {
    $handoffLog = Join-Path (Get-Location) ".planning\metrics\handoff-log.jsonl"
  }
  $totalChains = 0; $maxDepth = 0; $stallCount = 0
  if (Test-Path $handoffLog) {
    try {
      $hRows = Get-Content $handoffLog -ErrorAction SilentlyContinue | Where-Object { $_ -match '\{' } | ForEach-Object {
        try { $_ | ConvertFrom-Json -ErrorAction Stop } catch {}
      }
      $totalChains = @($hRows | Where-Object { $_.reason -eq "spawned" }).Count
      $maxDepth    = ($hRows | ForEach-Object { [int]($_.chain_depth ?? 0) } | Measure-Object -Maximum).Maximum ?? 0
      $stallCount  = @($hRows | Where-Object { $_.refused -like "*cooldown*" }).Count
    } catch {}
  }
  Write-Host ""
  Write-Host "=== Handoff Chain Stats (milestone close) ===" -ForegroundColor Cyan
  Write-Host ("  total_chains     : " + $totalChains)
  Write-Host ("  max_depth_reached: " + $maxDepth)
  Write-Host ("  stall_count      : " + $stallCount + " (cooldown refusals)")
  exit 0
}
```

Verify: powershell -File super-gsd/scripts/sgsd-gate-verdict.ps1 -MilestoneCloseCheck exits 0
(even when handoff-log.jsonl is absent — outputs zero stats).

--- COMMIT ---

After all 4 sub-tasks pass their individual checks:

Commit: `feat(20-03/T1): HANDOFF-03 handoff-log.jsonl + MC Handoff-Tile + session-start pairing + milestone-close stats`
  </action>
  <verify>
    <automated>grep -q 'SGSD-Handoff-Tile' super-gsd/scripts/sgsd-mission-control.ps1 && grep -c 'toUnixPath' super-gsd/hooks/sgsd-session-start.js | grep -q '^0$' && echo 'HANDOFF-03 OK'</automated>
  </verify>
  <done>
    grep -q SGSD-Handoff-Tile super-gsd/scripts/sgsd-mission-control.ps1 exits 0.
    grep -c toUnixPath super-gsd/hooks/sgsd-session-start.js returns 0 (bug fixed).
    powershell -File super-gsd/scripts/sgsd-gate-verdict.ps1 -MilestoneCloseCheck exits 0
    with handoff-log.jsonl absent (outputs zero stats, no crash).
    sgsd-mission-control.ps1 PS 5.1 AST parse error count = 0.
    sgsd-session-start.js uses path.join(process.cwd(), ...) for all .planning paths.
    handoff-log.jsonl spawned rows contain cumulative_runtime_s field.
    1 atomic commit: feat(20-03/T1): HANDOFF-03 handoff-log.jsonl + MC Handoff-Tile...
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| FS -> PS tile | handoff-log.jsonl read by mission-control; malformed rows must not crash tile |
| FS -> Node hook | sgsd-session-start.js reads+writes handoff-log.jsonl; must be non-fatal on parse error |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-03-01 | Tampering | handoff-log.jsonl last-row mutation by sgsd-session-start.js | accept | Local operator FS; mutation is intentional pairing; non-fatal try/catch wraps all FS ops |
| T-20-03-02 | Info Disclosure | PID exposed as session-id in handoff-log.jsonl | accept | PID is local transient identifier; no PII; weakens lineage vs. UUID but acceptable per RESEARCH |
| T-20-03-03 | DoS | Large handoff-log.jsonl slows mission-control tile | mitigate | Select-Object -Last 1 reads only final row for tile render; milestone-close stats use full scan but runs on demand only |
| T-20-03-04 | Tampering | toUnixPath path bug produces wrong FS paths on Windows Node | mitigate | Replace with path.join(process.cwd(), ...) — RESEARCH V5 confirmed fix |
</threat_model>

<verification>
```bash
# Sentinel checks
grep -q 'SGSD-Handoff-Tile' super-gsd/scripts/sgsd-mission-control.ps1 && echo 'tile OK'
grep -c 'toUnixPath' super-gsd/hooks/sgsd-session-start.js   # must be 0

# PS 5.1 AST parse check for mission-control
powershell -Command "\$errs=[System.Collections.Generic.List[System.Object]]::new(); \$null=[System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path 'super-gsd\scripts\sgsd-mission-control.ps1'),[ref]\$null,[ref]\$errs); Write-Host \$errs.Count"

# milestone-close-check (handoff-log.jsonl absent — must exit 0 with zero stats)
powershell -File super-gsd/scripts/sgsd-gate-verdict.ps1 -MilestoneCloseCheck
echo "Exit: $?"

# session-start path.join present
grep 'path\.join' super-gsd/hooks/sgsd-session-start.js | head -3
```
</verification>

<success_criteria>
- SGSD-Handoff-Tile present in sgsd-mission-control.ps1 showing chain_depth / cumulative_runtime / last_outcome / enabled state
- sgsd-session-start.js contains zero occurrences of toUnixPath (Windows path bug fixed)
- sgsd-session-start.js pairs to_session_id in latest handoff-log row using process.pid on fresh session start
- sgsd-gate-verdict.ps1 --milestone-close-check exits 0 even when handoff-log.jsonl absent; prints total_chains / max_depth_reached / stall_count
- sgsd-mission-control.ps1 PS 5.1 AST parse error count = 0
- sgsd-stop-handoff.sh spawned rows emit cumulative_runtime_s field
- 1 atomic commit: feat(20-03/T1): HANDOFF-03 handoff-log.jsonl + MC Handoff-Tile + session-start pairing + milestone-close stats
- All 3 HANDOFF REQ-IDs (HANDOFF-01, HANDOFF-02, HANDOFF-03) addressed across 20-01/20-02/20-03
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.4/phases/20-autonomous-handoff/20-03-SUMMARY.md`
with fields: FILES_CHANGED, VERIFICATION results, DEVIATIONS, ONE_LINER.

This is the FINAL phase of v1.4. After 20-03 SUMMARY is written and committed,
trigger milestone v1.4 close per rule 6.7 (SKILL.md milestone-complete auto-close).
</output>
