---
schema_version: 2
phase: 28
plan: 01
title: Mission Control 2.0 Layout
type: code
created: 2026-04-26
expected_ATC_tier: full
autonomous: true
wave: 1
depends_on: [26-01, 27-01]
files_modified:
  - super-gsd/scripts/lib/sgsd-mission-strip.ps1
  - super-gsd/scripts/sgsd-mission-control.ps1
  - super-gsd/hooks/sgsd-activity-logger.js
requirements:
  - REQ-28-MISSION-STRIP
  - REQ-28-SOFT-LOAD
  - REQ-28-STAMPER-FIX
discuss_decisions: [28.1, 28.2, 27.2-implementation]
controlling_principle: Autonomy continues; evidence tells the truth.
unblocks: [29, 30]
must_haves:
  truths:
    - "sgsd-mission-strip.ps1 parses cleanly under PS 5.1 (ASCII-only literals; no UnexpectedToken errors)"
    - "Get-MissionStripState returns an [ordered] hashtable with 6 line-strings + 6 stateColor strings drawn from the 16-color vocabulary"
    - "Render-MissionStrip emits exactly 6 Write-Host rows in the order locked by 28.2"
    - "Mission-control soft-loads the strip lib via the substrate idiom; missing lib = silent skip (legacy cockpit unaffected)"
    - "The 6-line strip renders between the title bar and the DLB-04 substrate row (does not displace title bar)"
    - "sgsd-activity-logger.js stamper resolves phase via env-var-primary -> anchored frontmatter -> null, with /^[0-9]+$/ validation guard"
    - "Stamper fix preserves fs.appendFileSync semantics (no atomic-rename, no locking, project JSONL convention intact)"
    - "Each touchpoint lands as one git commit (3 commits total); per-dispatch ATC fires on each"
  artifacts:
    - path: "super-gsd/scripts/lib/sgsd-mission-strip.ps1"
      provides: "Get-MissionStripState (data fetcher) + Render-MissionStrip (6-line renderer)"
      contains: "function Get-MissionStripState"
      min_lines: 130
    - path: "super-gsd/scripts/sgsd-mission-control.ps1"
      provides: "Soft-load of mission-strip lib + render call after header bar"
      contains: "sgsd-mission-strip.ps1"
    - path: "super-gsd/hooks/sgsd-activity-logger.js"
      provides: "readActivePhase function + validation guard replacing lines 144-149"
      contains: "function readActivePhase"
  key_links:
    - from: "sgsd-mission-control.ps1 :: Render() (post-header-bar insertion)"
      to: "sgsd-mission-strip.ps1 :: Render-MissionStrip"
      via: "dot-sourced soft-load + direct function call after Get-MissionStripState"
      pattern: "Render-MissionStrip -State \\$strip"
    - from: "sgsd-mission-strip.ps1 :: Get-MissionStripState"
      to: "sgsd-render-cache.ps1 :: Get-SharedActivityEntries"
      via: "Q1 + Q5 lanes call render-cache helper (do NOT re-parse activity-log.jsonl)"
      pattern: "Get-SharedActivityEntries"
    - from: "sgsd-activity-logger.js :: run() body"
      to: "readActivePhase(root)"
      via: "single-call replacement of broken regex block at lines 144-149"
      pattern: "readActivePhase\\(root\\)"
    - from: "sgsd-activity-logger.js :: readActivePhase"
      to: ".planning/STATE.md frontmatter"
      via: "anchored regex /^\\s*(?:current_phase|phase):\\s*\"?([0-9]+)\"?\\s*$/"
      pattern: "SGSD_ACTIVE_PHASE"
tasks:
  - id: T1
    agent: sgsd-exec-ui
    model: sonnet
    files_touched:
      - super-gsd/scripts/lib/sgsd-mission-strip.ps1
    input_contract:
      reads:
        - .planning/milestones/v1.6/phases/28-mission-control-layout/28-CONTEXT.md
        - .planning/milestones/v1.6/phases/28-mission-control-layout/28-RESEARCH.md
        - .planning/milestones/v1.6/phases/28-mission-control-layout/28-PATTERNS.md
        - .planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md
        - .planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md
        - super-gsd/scripts/lib/sgsd-substrate-status.ps1
        - super-gsd/scripts/lib/sgsd-codex-status.ps1
        - super-gsd/scripts/lib/sgsd-render-cache.ps1
        - super-gsd/scripts/lib/crit-backlog.cjs
    output_contract:
      writes:
        - super-gsd/scripts/lib/sgsd-mission-strip.ps1
    hypothesis: "Get-MissionStripState (returning [ordered]@{} with 6 line-strings + 6 stateColor strings) and Render-MissionStrip (6 Write-Host rows + CLEAR_LINE) clone the substrate-status + codex-status idioms cleanly enough to parse-clean under PS 5.1 with ASCII-only literals."
    falsifier: "If [PSParser]::Tokenize() reports any error tokens against the new lib, OR Render-MissionStrip emits != 6 rows on a smoke fixture, the lib design diverges from the locked analogs and must be rewritten."
    stop_rule: "Three parse-clean attempts failed -> defer per CONTEXT kill-condition; backlog row attempts=3."
    minimal_test: |
      pwsh -NoLogo -NoProfile -Command "$err = $null; $tokens = [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw super-gsd/scripts/lib/sgsd-mission-strip.ps1), [ref]$err); if ($err.Count -gt 0) { $err | Format-List; exit 1 }; Set-Variable -Name CLEAR_LINE -Value ([char]27 + '[K') -Scope Global; . ./super-gsd/scripts/lib/sgsd-mission-strip.ps1; $s = [ordered]@{ mission='[ MISSION ] v1.6 cockpit'; missionColor='DarkCyan'; objective='> objective 28 strip > unlock 29'; objectiveColor='White'; model='> model active claude:plan'; modelColor='Green'; blocker='> blocker none'; blockerColor='Green'; codexAgents='> codex stale > agents 3'; codexAgentsColor='DarkGray'; next='> next executor'; nextColor='Green' }; $rows = (Render-MissionStrip -State $s 6>&1 | Out-String) -split [Environment]::NewLine | Where-Object { $_ -match '^(\\[ MISSION| > )' }; if ($rows.Count -lt 6) { Write-Host \"FAIL row count = $($rows.Count)\"; exit 1 }; Write-Host 'OK'"
    known_deadends:
      - "PS 5.1 mojibake on Unicode glyphs: ASCII-only string literals required (28-RESEARCH §Pitfall 1). No box-drawing, em-dash, curly quotes; use [, >, |, +, --."
      - "Loose unanchored regex anywhere (28-PATTERNS §Anti-Patterns line 164)."
      - "Re-parsing activity-log.jsonl directly (28-PATTERNS §Anti-Patterns line 167) -- MUST call Get-SharedActivityEntries -Tail 500 from render-cache."
      - "Defining $ESC / ANSI constants inside the lib (28-PATTERNS §Anti-Patterns line 168) -- host owns ANSI."
      - "Throwing from a render helper (28-PATTERNS §Anti-Patterns line 169) -- every file read MUST be try/catch with safe default."
      - "stateColor names outside the 16-color vocabulary (28-RESEARCH §Pitfall 5) -- silently no-op."
      - "Phase 26 vocabulary / freshness / repair re-defined inside this lib (28-RESEARCH §Anti-Patterns line 386) -- cite, do not redefine."
    expected_ATC_tier: full
  - id: T2
    agent: sgsd-exec-ui
    model: sonnet
    files_touched:
      - super-gsd/scripts/sgsd-mission-control.ps1
    input_contract:
      reads:
        - super-gsd/scripts/sgsd-mission-control.ps1
        - super-gsd/scripts/lib/sgsd-mission-strip.ps1
        - .planning/milestones/v1.6/phases/28-mission-control-layout/28-CONTEXT.md
        - .planning/milestones/v1.6/phases/28-mission-control-layout/28-RESEARCH.md
        - .planning/milestones/v1.6/phases/28-mission-control-layout/28-PATTERNS.md
    output_contract:
      writes:
        - super-gsd/scripts/sgsd-mission-control.ps1
    hypothesis: "A 4th soft-load block matching the substrate/codex idiom (between current line ~100's `. $__codex` and line ~102's ANSI escape comment) plus a 2-line render call inserted in Render() between the header bar's CLEAR_LINE (current ~line 1033) and the DLB-04 comment (current ~line 1035) wires the strip without disturbing legacy code."
    falsifier: "If [PSParser]::Tokenize() reports new error tokens after the edit, OR if removing the lib (rename test) breaks mission-control startup (i.e. soft-load is not actually soft), the insertion sites are wrong."
    stop_rule: "Two parse-fail iterations -> defer; the patch shape diverges from substrate/codex analogs."
    minimal_test: |
      pwsh -NoLogo -NoProfile -Command "$err = $null; [System.Management.Automation.PSParser]::Tokenize((Get-Content -Raw super-gsd/scripts/sgsd-mission-control.ps1), [ref]$err) | Out-Null; if ($err.Count -gt 0) { $err | Format-List; exit 1 }; Select-String -Path super-gsd/scripts/sgsd-mission-control.ps1 -Pattern 'sgsd-mission-strip.ps1' -SimpleMatch -Quiet | Out-Null; if (-not $?) { Write-Host 'FAIL no soft-load reference'; exit 1 }; Select-String -Path super-gsd/scripts/sgsd-mission-control.ps1 -Pattern 'Render-MissionStrip' -SimpleMatch -Quiet | Out-Null; if (-not $?) { Write-Host 'FAIL no render call'; exit 1 }; Write-Host 'OK'"
    known_deadends:
      - "Insertion site drift: soft-load MUST mirror substrate (~line 84-91) and codex (~line 93-100) verbatim; render call MUST be inside Render() between header-bar CLEAR_LINE and DLB-04 comment."
      - "Hard-fail if lib missing -> wrong; soft-load semantics must not break legacy cockpit when lib is absent. Use Test-Path guard with __sgsd_fail behavior identical to existing __substrate / __codex blocks (which DO call __sgsd_fail). The 'soft' aspect is via __sgsd_fail's boot-time-only abort; once the lib is on disk, dot-source proceeds. Match the analog exactly -- do NOT invent new fallback behavior."
      - "Defining a new $ESC / color or re-implementing Write-Row inside the host edit (28-PATTERNS §Shared Patterns line 131-141) -- existing host owns these."
      - "Edit > 15 lines (CONTEXT cap) -- if the diff exceeds 15 lines, the patch is overreaching."
    expected_ATC_tier: full
  - id: T3
    agent: sgsd-exec-backend
    model: sonnet
    files_touched:
      - super-gsd/hooks/sgsd-activity-logger.js
    input_contract:
      reads:
        - super-gsd/hooks/sgsd-activity-logger.js
        - .planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md
        - .planning/milestones/v1.6/phases/28-mission-control-layout/28-RESEARCH.md
        - .planning/milestones/v1.6/phases/28-mission-control-layout/28-PATTERNS.md
    output_contract:
      writes:
        - super-gsd/hooks/sgsd-activity-logger.js
    hypothesis: "Replacing the broken stamper at lines 144-149 with the readActivePhase() reference impl (env-var-primary -> anchored YAML -> null) plus a /^[0-9]+$/ validation guard immediately after the call yields env=>numeric, STATE.md-only=>numeric, neither=>null, while preserving the existing fs.appendFileSync row append semantics."
    falsifier: "If the post-fix tail-100 acceptance commands from 27-01-PLAN §Acceptance (rule 7) report < 50 correctly stamped rows OR ANY corrupt `\"phase\":\"\\\"NN\\\":` rows, OR if existing activity-log writes regress (no row appended), the patch is wrong and must be reverted."
    stop_rule: "If post-fix verifier shows ANY corrupt rows OR appendFileSync is structurally altered, KILL the patch (CONTEXT kill-condition) and rollback."
    minimal_test: |
      node -e "const fs=require('fs'),path=require('path'),os=require('os'); const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sgsd-stamp-')); fs.mkdirSync(path.join(tmp,'.planning'),{recursive:true}); fs.writeFileSync(path.join(tmp,'.planning','STATE.md'),'---\nmilestone: v1.6\ncurrent_phase: 28\nby_phase:\n  \"26\": shipped\n  \"27\": shipped\n---\nbody'); const src=fs.readFileSync('super-gsd/hooks/sgsd-activity-logger.js','utf8'); const m=src.match(/function readActivePhase\(root\)\s*\{[\s\S]*?\n\}/); if(!m){console.error('FAIL: readActivePhase not found');process.exit(1);} const fn=eval('('+m[0].replace(/^function readActivePhase/,'function')+')'); process.env.SGSD_ACTIVE_PHASE='28'; let r1=fn(tmp); if(r1!=='28'){console.error('FAIL env-primary, got',r1);process.exit(1);} delete process.env.SGSD_ACTIVE_PHASE; let r2=fn(tmp); if(r2!=='28'){console.error('FAIL frontmatter fallback, got',r2);process.exit(1);} fs.writeFileSync(path.join(tmp,'.planning','STATE.md'),'---\nmilestone: v1.6\nby_phase:\n  \"26\": shipped\n---\n'); let r3=fn(tmp); if(r3!==null){console.error('FAIL null fallback, got',r3);process.exit(1);} fs.writeFileSync(path.join(tmp,'.planning','STATE.md'),'---\nmilestone: v1.6\ncurrent_phase: foo\n---\n'); let r4=fn(tmp); if(r4!==null){console.error('FAIL non-digit rejection, got',r4);process.exit(1);} console.log('OK');"
    known_deadends:
      - "Loose unanchored regex (28-PATTERNS §Anti-Patterns line 164) -- the original bug. MUST anchor with ^\\s* and \\s*$."
      - "Phase write without /^[0-9]+$/ validation guard (28-PATTERNS §Anti-Patterns line 165) -- MUST add guard immediately after readActivePhase returns."
      - "Path-derived phase recovery (28-RESEARCH §Anti-Patterns + 27-01-PLAN §Stamping Spec rule 1.3) -- null is the ONLY acceptable third fallback."
      - "Changing fs.appendFileSync to atomic-rename / file-locking (28-PATTERNS §Shared Patterns line 121) -- project JSONL convention is single-writer-single-line; do NOT change."
      - "Removing the outer try/catch around run() (28-PATTERNS §Shared Patterns line 123) -- hooks must NEVER block tool execution."
      - "Backfilling the 5,727 corrupt historical rows (27-01-PLAN §Backwards-Compatibility Note + 28-RESEARCH §Common Pitfalls) -- forbidden; controlling principle is additive-only."
    expected_ATC_tier: full
---

# Mission Control 2.0 Layout (v1.6 Phase 28 deliverable)

> **Status:** locked. Three code touchpoints, three commits, one PLAN. Per-dispatch
> ATC fires on each commit (Codex side likely PROVIDER-UNAVAILABLE -> backlog row
> per commit; Claude side fires normally). Phase close status: most-likely
> `PASS-WITH-DEFERRED-3` per 28-RESEARCH §Per-Dispatch ATC Scope.

> **Locked sources:** 28-CONTEXT.md (decisions 28.1, 28.2, 27.2-impl), 28-RESEARCH.md
> (analog map + pitfalls), 28-PATTERNS.md (verbatim soft-load + render-call shapes),
> 26-01-PLAN (vocabulary, freshness, repair), 27-01-PLAN §Stamping Spec
> (env-var primary -> anchored frontmatter -> null reference impl).

---

## Dependency Chain

```
T1 (sgsd-mission-strip.ps1)        T3 (sgsd-activity-logger.js)
  |                                       |
  | (lib must exist before host           | (independent of T1/T2)
  |  references it)                       |
  v                                       v
T2 (sgsd-mission-control.ps1)         (commit standalone)
```

**T1 and T3 are parallel-safe** (different files, no shared symbols). **T2 must
follow T1** because the soft-load `Test-Path` guard in mission-control fires
__sgsd_fail when the lib is missing — committing T2 before T1 would brick the
dashboard between commits.

**Recommended commit order:** T3 -> T1 -> T2 (stamper first per 28-RESEARCH
§Summary recommendation: "Q5 freshness depends on clean data"). T1 ∥ T3 is
acceptable; T2 always last.

---

## Task T1 — NEW lib `super-gsd/scripts/lib/sgsd-mission-strip.ps1`

**Agent:** `sgsd-exec-ui` · **Model:** sonnet · **ATC tier:** full · **~150 lines**

### Function signatures (locked)

```powershell
function Get-MissionStripState {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ProjectDir,
        [int]$ActivityTail = 500,
        [hashtable]$StateOverride = $null,    # 28-RESEARCH §Open Q2: test injection
        [string]$PhaseOverride = $null         # 28-RESEARCH §Open Q2: test injection
    )
    # Returns [ordered]@{} with 12 keys (6 line-strings + 6 stateColor strings)
    # plus 2 debug fields (activeMilestone, activePhase).
}

function Render-MissionStrip {
    param(
        [Parameter(Mandatory = $true)]
        $State    # the [ordered] hashtable from Get-MissionStripState
    )
    # Emits exactly 6 Write-Host rows in 28.2 order.
}
```

### 6-line layout (28-CONTEXT §Open derivation calls #1, locked)

| # | Key | stateColor key | Format (ASCII-only) | Q source(s) | Color rule |
|---|-----|----------------|---------------------|-------------|------------|
| 1 | `mission` | `missionColor` | `[ MISSION ] {milestone} {milestone_status}` | Q2 (STATE.md) | `DarkCyan` active / `Yellow` SHIPPED-WITH-DEBT / `DarkGray` unavailable |
| 2 | `objective` | `objectiveColor` | `> objective {phase} {goal}  > unlock {next_goal_or_milestone_close}` | Q2 + Q3 | `White` active / `Magenta` last-phase-in-milestone / `DarkGray` stale |
| 3 | `model` | `modelColor` | `> model {state} {tool : target_truncated_60c}` | Q1 (Get-SharedActivityEntries) | `Green` active / `Yellow` waiting / `Red` stale / `DarkGray` unavailable |
| 4 | `blocker` | `blockerColor` | `> blocker {state} {N open : first_summary_or_dashes}` | Q4 (crit-backlog.cjs) | `Red` N>0 / `Green` N==0 / `DarkGray` unavailable |
| 5 | `codexAgents` | `codexAgentsColor` | `> codex {state}  > agents {list_truncated_60c}` | Q5 + Q6 | `Yellow` running / `Cyan` reviewing / `Red` timeout / `Green` ready / `DarkGray` stale |
| 6 | `next` | `nextColor` | `> next {action_or_repair}` | Q8 + open repair | `Green` active / `Yellow` waiting / `Red` blocked / `DarkGray` unavailable |

**Strict ASCII-only:** the entire file uses `[`, `]`, `>`, `|`, `+`, `-`, `--`,
`:`. NO `▌`, `▸`, `─`, em-dash, curly quotes, tabs in indentation. Verifier MUST
run `file super-gsd/scripts/lib/sgsd-mission-strip.ps1` -> expect `ASCII text`.

### Reference implementation (paste-ready skeleton, ~150 lines)

```powershell
# ============================================================================
# Super GSD - Mission Strip (Cockpit 2.0)
# ============================================================================
# Renders the 6-line operator-question strip at the top of the
# sgsd-mission-control dashboard. Replaces the previous 1-line header.
# All file reads are tolerant: every parse is wrapped in try/catch with a safe
# default; this lib MUST NEVER throw out of a Render frame.
#
# Files read (cited from 27-01-cockpit-data-contract-PLAN.md Data Source Matrix):
#   .planning/STATE.md                                  (Q2 milestone+phase)
#   .planning/ROADMAP-AGENT.md                          (Q2 Goal, Q3 unlock)
#   .planning/metrics/activity-log.jsonl                (Q1 model, Q5 agents)
#     - via Get-SharedActivityEntries (do NOT re-parse)
#   .planning/metrics/codex-live.json                   (Q6 state + mtime)
#   .planning/metrics/crit-backlog.jsonl                (Q4 count, via crit-backlog.cjs)
#   .planning/metrics/heartbeat.jsonl                   (Q8 stall detection)
#   CLAUDE.md                                           (Q8 dispatch-rules table)
# ============================================================================

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

    # Q2: read STATE.md frontmatter (always-read; no freshness band)
    try {
        $statePath = Join-Path $ProjectDir ".planning/STATE.md"
        if (Test-Path $statePath) {
            $content = Get-Content -Raw $statePath
            $fmMatch = [regex]::Match($content, '(?ms)^---\s*\n(.*?)\n---\s*\n')
            if ($fmMatch.Success) {
                $fm = $fmMatch.Groups[1].Value
                $milestoneMatch = [regex]::Match($fm, '(?m)^\s*milestone:\s*"?([^"\s]+)"?\s*$')
                $phaseMatch     = [regex]::Match($fm, '(?m)^\s*(?:current_phase|phase):\s*"?([0-9]+)"?\s*$')
                if ($milestoneMatch.Success) { $out.activeMilestone = $milestoneMatch.Groups[1].Value }
                if ($phaseMatch.Success)     { $out.activePhase     = $phaseMatch.Groups[1].Value }
                if ($PhaseOverride) { $out.activePhase = $PhaseOverride }
                if ($out.activeMilestone) {
                    $out.mission      = "[ MISSION ] $($out.activeMilestone) active"
                    $out.missionColor = "DarkCyan"
                }
            }
        }
    } catch {}

    # Q2 + Q3: ROADMAP-AGENT.md goal + unlock
    try {
        $roadPath = Join-Path $ProjectDir ".planning/ROADMAP-AGENT.md"
        if (Test-Path $roadPath -and $out.activePhase) {
            # ... locate active phase Goal + next phase Goal (or "milestone close X")
            #     populate $out.objective + $out.objectiveColor
        }
    } catch {}

    # Q1 + Q5: activity-log via render-cache (DO NOT re-parse)
    try {
        if (Get-Command Get-SharedActivityEntries -ErrorAction SilentlyContinue) {
            $entries = Get-SharedActivityEntries -Path (Join-Path $ProjectDir ".planning/metrics/activity-log.jsonl") -Tail $ActivityTail
            # ... derive last-tool-call (Q1) + distinct-subagent-types-this-phase (Q5)
            #     populate $out.model + $out.modelColor + agents portion of codexAgents
        }
    } catch {}

    # Q4: crit-backlog via crit-backlog.cjs
    try {
        $cjsPath = Join-Path $ProjectDir "super-gsd/scripts/lib/crit-backlog.cjs"
        if (Test-Path $cjsPath -and $out.activePhase) {
            # ... node $cjsPath rowsForPhase $out.activePhase
            #     populate $out.blocker + $out.blockerColor
        }
    } catch {}

    # Q6: codex-live.json (state field + mtime; >=3600s overrides state to stale)
    try {
        $codexLivePath = Join-Path $ProjectDir ".planning/metrics/codex-live.json"
        if (Test-Path $codexLivePath) {
            # ... read state + compute Δmtime
            #     populate codex portion of codexAgents + codexAgentsColor
        }
    } catch {}

    # Q8: dispatch-rule first-match against CLAUDE.md + heartbeat freshness
    try {
        # ... derive next action; populate $out.next + $out.nextColor
    } catch {}

    return $out
}

function Render-MissionStrip {
    param(
        [Parameter(Mandatory = $true)]
        $State
    )
    Write-Host $State.mission           -NoNewline -ForegroundColor $State.missionColor;     Write-Host $CLEAR_LINE
    Write-Host $State.objective         -NoNewline -ForegroundColor $State.objectiveColor;   Write-Host $CLEAR_LINE
    Write-Host $State.model             -NoNewline -ForegroundColor $State.modelColor;       Write-Host $CLEAR_LINE
    Write-Host $State.blocker           -NoNewline -ForegroundColor $State.blockerColor;     Write-Host $CLEAR_LINE
    Write-Host $State.codexAgents       -NoNewline -ForegroundColor $State.codexAgentsColor; Write-Host $CLEAR_LINE
    Write-Host $State.next              -NoNewline -ForegroundColor $State.nextColor;        Write-Host $CLEAR_LINE
}
```

### T1 Acceptance (runnable)

1. **File exists:** `test -f super-gsd/scripts/lib/sgsd-mission-strip.ps1`
2. **ASCII-only:** `file super-gsd/scripts/lib/sgsd-mission-strip.ps1` -> contains `ASCII text`
3. **Parse-clean under PS 5.1:** `[PSParser]::Tokenize()` returns 0 error tokens (see `minimal_test`)
4. **Render-MissionStrip emits 6 rows** on a synthetic `[ordered]@{}` fixture (see `minimal_test`)
5. **stateColor vocabulary:** all stateColor values appear in the 16-color set (`Black, DarkBlue, DarkGreen, DarkCyan, DarkRed, DarkMagenta, DarkYellow, Gray, DarkGray, Blue, Green, Cyan, Red, Magenta, Yellow, White`) — grep enumeration
6. **Anti-patterns absent:** `! grep -E 'Get-Content.*activity-log' super-gsd/scripts/lib/sgsd-mission-strip.ps1` (no direct activity-log read; render-cache only)

**Commit:** `feat(28-01): add sgsd-mission-strip.ps1 (6-line cockpit 2.0 strip)`

---

## Task T2 — EDIT `super-gsd/scripts/sgsd-mission-control.ps1` (~15 lines)

**Agent:** `sgsd-exec-ui` · **Model:** sonnet · **ATC tier:** full

### Insertion point 1 — soft-load (after `__codex` block)

**Pattern reference:** 28-PATTERNS §Soft-load pattern (verbatim mirror of substrate
lines 84-91 + codex lines 93-100). Insert between current line 100 (`. $__codex`)
and the existing `# -- ANSI escape codes --` comment at line 102:

```powershell
$__missionstrip = Join-Path $PSScriptRoot "lib\sgsd-mission-strip.ps1"
if (-not (Test-Path $__missionstrip)) {
    __sgsd_fail "MISSING LIB: sgsd-mission-strip.ps1" @(
        "Expected: $__missionstrip",
        "Reinstall: run sgsd-boot -Bootstrap or copy lib\ from super-gsd/scripts/"
    )
}
. $__missionstrip
```

(8 lines; matches existing `__substrate` and `__codex` blocks character-for-
character in shape per 28-PATTERNS line 76-86.)

### Insertion point 2 — render call (inside `Render` function)

**Pattern reference:** 28-PATTERNS §Render-call pattern (lines 89-98). Insert
**immediately after** the header bar's `Write-Host $CLEAR_LINE` (current ~line
1033) and **before** the `# -- DLB-04 Substrate --` comment (current ~line 1035):

```powershell
# -- Mission Strip (Cockpit 2.0 - Phase 28) ----------------------------------
$strip = Get-MissionStripState -ProjectDir $ProjectDir -ActivityTail 500
Render-MissionStrip -State $strip
```

(3 lines.)

**Total diff: ~11-15 lines.** The 1-line pre-Cockpit-2.0 mission/phase summary
(if currently present below the title bar) is removed in the same commit per
28.1 ("replacing existing 1-line header"). Title bar is preserved (28-RESEARCH
§Open Q1 reading b).

### T2 Acceptance (runnable)

1. **Parse-clean:** `[PSParser]::Tokenize()` returns 0 error tokens (see `minimal_test`)
2. **Soft-load reference present:** `grep -q 'sgsd-mission-strip.ps1' super-gsd/scripts/sgsd-mission-control.ps1`
3. **Render call present:** `grep -q 'Render-MissionStrip' super-gsd/scripts/sgsd-mission-control.ps1`
4. **Soft-load works (lib-removed sanity):** rename lib temporarily; mission-control startup hits `__sgsd_fail` cleanly (the legacy substrate/codex idiom) — same behavior as before; not silently broken
5. **Diff size ≤ 15 lines:** `git diff --stat HEAD~1 super-gsd/scripts/sgsd-mission-control.ps1` reports ≤ 15 lines added

**Commit:** `feat(28-01): wire sgsd-mission-control to mission-strip lib (soft-load + render call)`

---

## Task T3 — EDIT `super-gsd/hooks/sgsd-activity-logger.js`

**Agent:** `sgsd-exec-backend` · **Model:** sonnet · **ATC tier:** full

### Replacement target (lines 144-149, the broken stamper block)

```js
// REMOVE:
let phase = '';
try {
  const stateContent = fs.readFileSync(path.join(root, '.planning', 'STATE.md'), 'utf8');
  const match = stateContent.match(/(?:current_phase|phase):\s*(\S+)/);
  if (match) phase = match[1];
} catch {}
```

### Insert (above `function run()` at current line 82)

**Source:** 27-01-cockpit-data-contract-PLAN.md §Stamping Spec rule 6 (lines
218-237), verbatim:

```js
function readActivePhase(root) {
  // (1) Primary: env var set by orchestrator
  const env = process.env.SGSD_ACTIVE_PHASE;
  if (env && /^[0-9]+$/.test(env)) return env;
  // (2) Fallback: anchored YAML frontmatter parse
  try {
    const content = fs.readFileSync(path.join(root, '.planning', 'STATE.md'), 'utf8');
    const fm = content.split(/^---$/m)[1] || '';
    for (const line of fm.split('\n')) {
      const m = line.match(/^\s*(?:current_phase|phase):\s*"?([0-9]+)"?\s*$/);
      if (m) return m[1];
    }
  } catch {}
  // (3) Final fallback - controlling-principle answer
  return null;
}
```

### Replace lines 144-149 with

```js
// Try to detect current phase (env var primary, anchored frontmatter fallback)
let phase = readActivePhase(root);
if (phase !== null && !/^[0-9]+$/.test(phase)) phase = null;  // 27-PLAN rule 2 validation guard
```

### Preserve

- Existing line 156 `phase: phase || null,` becomes `phase: phase` (readActivePhase already returns null when nothing resolves; the `|| null` is now redundant). **Optional simplification — leaving `phase: phase || null` is also acceptable** (semantically identical given the validation guard).
- Existing `fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');` at line 167 — **DO NOT TOUCH** (28-PATTERNS §JSONL append idiom; project convention; single-writer-single-line).
- Outer `try { ... } catch (e) {}` around `run()` body — **DO NOT TOUCH** (28-PATTERNS §Silent-fail wrapper; hooks must NEVER block tool execution).

### T3 Acceptance (runnable)

1. **readActivePhase function present:** `grep -q 'function readActivePhase' super-gsd/hooks/sgsd-activity-logger.js`
2. **Validation guard present:** `grep -qE '\\^\\[0-9\\]\\+\\$' super-gsd/hooks/sgsd-activity-logger.js` (the `/^[0-9]+$/` literal appears at least twice — inside readActivePhase and in the validation guard)
3. **Loose unanchored regex absent:** `! grep -E '\\(\\?:current_phase\\|phase\\):\\\\s\\*\\(\\\\S\\+\\)' super-gsd/hooks/sgsd-activity-logger.js`
4. **fs.appendFileSync untouched:** `grep -q 'fs.appendFileSync(logPath' super-gsd/hooks/sgsd-activity-logger.js`
5. **Stamper test fixture (see `minimal_test`):**
   - env-var set (`SGSD_ACTIVE_PHASE=28`) -> returns `"28"` (string of digits)
   - env unset, STATE.md has `current_phase: 28` in frontmatter -> returns `"28"`
   - env unset, STATE.md has no `current_phase` / `phase` line -> returns `null`
   - env unset, STATE.md has `current_phase: foo` (non-digit) -> returns `null` (validation guard)
6. **Post-fix tail-100 stamping check** (run after first 100 hook invocations post-merge): `tail -100 .planning/metrics/activity-log.jsonl | grep -cE '"phase":"[0-9]+"' | awk '$1 < 50 {exit 1}'` AND `! tail -100 .planning/metrics/activity-log.jsonl | grep -E '"phase":"\\\\"[0-9]+\\\\":'` (zero corrupt rows in last 100)

**Commit:** `fix(28-01): replace broken activity-log phase stamper with readActivePhase()`

---

## Per-Dispatch ATC Scope (every commit)

Each of the 3 commits trips per-dispatch ATC because:

- `classifier.atc_tier = full` (new file on T1; ≥ 4 touched files counting plan + STATE + activity-log on T3; new external behavior on T2)
- `code_files_changed_count > 0` for all three
- DISCUSS hard-bar §"What runs always" mandates per-dispatch ATC

**Codex side:** per current readiness state (Phase 26 shipped `PASS-WITH-DEFERRED-1`,
kind `provider_unavailable`) the 3-attempt budget will exhaust on each commit and
append one row to `crit-backlog.jsonl` with `kind=per_dispatch_atc, attempts_made=3`.
**Three new backlog rows expected (one per commit).**

**Claude reviewer side:** fires normally; expected PASS on all three (small,
mechanical, fully-spec'd changes with named analogs).

**Phase 28 close status:** most-likely `PASS-WITH-DEFERRED-3` (3 Codex
provider_unavailable rows). Rolls up to v1.6 milestone close as
`SHIPPED-WITH-DEBT-N`. Controlling principle permits.

---

## Acceptance Criteria (phase verifier runs all)

1. **All three files exist** with expected content:
   - `test -f super-gsd/scripts/lib/sgsd-mission-strip.ps1`
   - `grep -q 'sgsd-mission-strip.ps1' super-gsd/scripts/sgsd-mission-control.ps1`
   - `grep -q 'function readActivePhase' super-gsd/hooks/sgsd-activity-logger.js`

2. **All three task `minimal_test` commands pass** (T1, T2, T3 acceptance bundles above).

3. **Three commits in git log** with the documented messages (one per touchpoint).

4. **DISCUSS 28.1 + 28.2 honored:**
   - Strip lives at top of mission-control pane (between title bar and DLB-04 row): `grep -B2 -A1 'Render-MissionStrip' super-gsd/scripts/sgsd-mission-control.ps1` shows insertion site immediately after header bar's CLEAR_LINE
   - 6 lines exact: `grep -cE '^\s*Write-Host \$State\.' super-gsd/scripts/lib/sgsd-mission-strip.ps1` reports >= 6

5. **27-01 §Stamping Spec honored:**
   - env-var primary, anchored frontmatter, null fallback, `^[0-9]+$` guard all present in hook
   - existing `appendFileSync` untouched (line 167 area unchanged)

6. **Anti-pattern absence:**
   - No direct `Get-Content` of activity-log in mission-strip lib
   - No `$ESC`/ANSI redefinition in lib
   - No path-derived phase recovery in stamper
   - No backfill commits to historical activity-log rows

7. **PS 5.1 mojibake guard:** `file super-gsd/scripts/lib/sgsd-mission-strip.ps1` reports `ASCII text` (not `UTF-8 Unicode text`).

8. **stateColor vocabulary closed:** every `stateColor` assignment in the lib uses one of the 16 colors enumerated in 28-PATTERNS §Shared Patterns line 139.

9. **Per-dispatch ATC backlog reconciliation:** at least 3 new `crit-backlog.jsonl` rows with `kind=per_dispatch_atc` AND `phase=28` (one per commit). The phase close status is `PASS-WITH-DEFERRED-N` where N matches the new backlog row count.

---

## Kill / Defer Conditions (from 28-CONTEXT + 28-RESEARCH)

| Trigger | Action | Owner |
|---------|--------|-------|
| T1 PS parse fails after 3 fix attempts | DEFER lib to Phase 28b; ship T3 alone | T1 stop_rule |
| T2 hard-fail on lib missing (soft-load broken) | KILL T2 patch; redesign | T2 stop_rule |
| T3 post-fix tail-100 shows < 50 stamped rows | DEFER phase close; investigate orchestrator env emission | 27-01 acceptance rule 7 |
| T3 post-fix tail-100 shows ANY corrupt `"phase":"\"NN\":"` rows | KILL & rollback | 27-01 zero-tolerance |
| Mission-strip frame time > 200 ms (render-cache instrumentation) | DEFER lib to Phase 28b | 28-CONTEXT kill condition |
| Anchored frontmatter regex captures `total_phases:` / `completed_phases:` | KILL stamper patch; redesign | 27-01 rule 1.2 |

---

## Sources cited

- `.planning/milestones/v1.6/phases/28-mission-control-layout/28-CONTEXT.md` (28.1, 28.2, 27.2-impl)
- `.planning/milestones/v1.6/phases/28-mission-control-layout/28-RESEARCH.md` (analog map, pitfalls, ATC scope)
- `.planning/milestones/v1.6/phases/28-mission-control-layout/28-PATTERNS.md` (verbatim soft-load + render-call shapes; 16-color vocabulary; anti-patterns)
- `.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md` (Q1-Q8 vocabulary, freshness, repair — cited not redefined)
- `.planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md` (§Stamping Spec rules 1-7 verbatim)
- `.planning/discussions/2026-04-26-mass-discuss.md` (28.1, 28.2)
- `super-gsd/scripts/lib/sgsd-substrate-status.ps1` (primary analog, lines 1-208)
- `super-gsd/scripts/lib/sgsd-codex-status.ps1` (stateColor pattern, lines 249-256)
- `super-gsd/scripts/sgsd-mission-control.ps1` (host insertion sites, lines 84-100, 1027-1050)
- `super-gsd/hooks/sgsd-activity-logger.js` (replacement target, lines 144-149)
