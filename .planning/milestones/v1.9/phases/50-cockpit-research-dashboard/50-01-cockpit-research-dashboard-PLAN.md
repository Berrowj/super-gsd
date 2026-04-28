---
schema_version: 2
phase: 50
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/scripts/lib/sgsd-cockpit-shell.cjs
  - super-gsd/scripts/lib/sgsd-token-panel.ps1
  - super-gsd/scripts/lib/sgsd-active-agent-panel.ps1
  - super-gsd/scripts/lib/sgsd-source-mix-panel.ps1
  - super-gsd/scripts/sgsd-mission-control.ps1
  - super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1
  - super-gsd/tests/cockpit-acceptance/fixtures/A1/
  - super-gsd/tests/cockpit-acceptance/fixtures/A2/
  - super-gsd/tests/cockpit-acceptance/fixtures/A3/
  - super-gsd/tests/cockpit-acceptance/fixtures/A4/
  - super-gsd/tests/cockpit-acceptance/fixtures/A5/
  - super-gsd/tests/cockpit-acceptance/fixtures/A6/
  - super-gsd/tests/cockpit-acceptance/fixtures/A7/
  - super-gsd/tests/cockpit-acceptance/fixtures/A8/
autonomous: true
requirements:
  - COCKPIT-01
  - COCKPIT-02
  - COCKPIT-03
  - COCKPIT-04
  - COCKPIT-05
  - COCKPIT-06

tags:
  - cockpit
  - render-layer
  - read-only
  - powershell
  - phase-50
  - v1.9

must_haves:
  truths:
    - "Operator opens cockpit and within one frame sees milestone, phase, progress, goal, evidence, debt, blockers, context, cost, agents, commits in the top-left zone."
    - "Right pane shows only currently-active agent work, then agent history, then tool/skill/VTP stream; nothing else."
    - "Codex state, runs, ok/fail, offload, and last gate verdict appear in exactly one pane (A3); no Codex string appears outside A3."
    - "Cockpit fits operator laptop viewport (1366x768 ~= 120x30 chars) without jitter; compact-mode threshold triggers at <40 rows."
    - "Cockpit displays the current canonical intent line read from intent-map.jsonl in operator language (no R#, cascade, old live, WILL, pulse, gate, tok jargon)."
    - "Token spend by role+phase, context source mix 7-key shape, budget verdict, and memory governance counts read from Phase 41/42/45/49 public APIs by reference; cockpit never re-aggregates."
    - "Cockpit never writes any canonical stream or any Phase 41-49 source file; mtime+size of canonical streams unchanged after a render frame."
  artifacts:
    - path: "super-gsd/scripts/lib/sgsd-cockpit-shell.cjs"
      provides: "Single Node bridge that calls token-attribution.summarize(), token-waste.runCheck(), memory-governance.getMemoryGovernanceSnapshot(), context-packet build.cjs constants by reference and emits one JSON snapshot to stdout."
      exports:
        - "main(planningDir, phase) -> JSON snapshot to stdout"
        - "selfTest() -> exit 0 on green"
      contains: "PANEL_KINDS, ACTIVITY_WINDOW_SEC frozen via Object.freeze; require()s Phase 41/42/49 modules by absolute path"
    - path: "super-gsd/scripts/lib/sgsd-token-panel.ps1"
      provides: "A1 cost line panel: total/role+phase top 3 from snapshot.byRolePhase + budget verdict tier color from snapshot.budget.verdict."
      exports:
        - "Format-SgsdTokenPanel -Snapshot $snap -PaneWidth $w"
    - path: "super-gsd/scripts/lib/sgsd-active-agent-panel.ps1"
      provides: "A2 right pane: header line for currently-active agent (orchestrator-pulse.jsonl <60s AND activity-log.jsonl Agent/TaskCreate <300s), agent history (3 rows), tool/skill/VTP stream (5 rows)."
      exports:
        - "Get-CurrentlyActiveAgents -ProjectDir $p -WindowSec 300"
        - "Format-SgsdActiveAgentPanel -Active $a -History $h -ToolStream $t -PaneWidth $w"
    - path: "super-gsd/scripts/lib/sgsd-source-mix-panel.ps1"
      provides: "A1 SOURCE MIX line: 7 frozen keys raw/cap/vt/rule/guard/idx/vtp from latest context-packet-log.jsonl row matching active phase, plus inline budget verdict tier (ok/warn/degraded)."
      exports:
        - "Get-LatestContextSourceMix -ProjectDir $p -Phase $ph"
        - "Format-SgsdSourceMixPanel -Mix $m -Verdict $v -PaneWidth $w"
    - path: "super-gsd/scripts/sgsd-mission-control.ps1"
      provides: "Cockpit host: A3 consolidated to single pane (lines 1614-1644 removed; mission strip codex field removed); compact-mode threshold lowered 70->40 rows; operator-hostile labels replaced with intent-map canonical."
      contains: "Render function delegates to new pane libs; SOURCE MIX line in A1; Format-SgsdActiveAgentPanel in right zone; Codex appears exactly once in A3"
    - path: "super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1"
      provides: "Extended harness covering A2/A3/A5 fixtures plus a no-canonical-write fingerprint invariant (mirrors dispatch-router/route.cjs:679-700)."
    - path: "super-gsd/tests/cockpit-acceptance/fixtures/A3/"
      provides: "Codex-only pane fixtures asserting the substring Codex appears exactly once outside A3 (placeholder allowed)."
    - path: "super-gsd/tests/cockpit-acceptance/fixtures/A5/"
      provides: "Viewport-fit fixtures at 80x24, 100x30, 132x40 asserting no clipped state and compact-mode trigger threshold."
  key_links:
    - from: "super-gsd/scripts/lib/sgsd-cockpit-shell.cjs"
      to: "super-gsd/tools/token-attribution/report.cjs::summarize"
      via: "require() by absolute path; calls summarize(planningDir, {groupBy:'role+phase'})"
      pattern: "tokenAttr\\.summarize\\("
    - from: "super-gsd/scripts/lib/sgsd-cockpit-shell.cjs"
      to: "super-gsd/tools/token-waste/check.cjs::runCheck"
      via: "require() by absolute path; calls runCheck(planningDir, {phase})"
      pattern: "tokenWaste\\.runCheck\\("
    - from: "super-gsd/scripts/lib/sgsd-cockpit-shell.cjs"
      to: "super-gsd/tools/memory-governance/lifecycle.cjs::getMemoryGovernanceSnapshot"
      via: "require() by absolute path; calls getMemoryGovernanceSnapshot(planningDir)"
      pattern: "memGov\\.getMemoryGovernanceSnapshot\\("
    - from: "super-gsd/scripts/sgsd-mission-control.ps1"
      to: "super-gsd/scripts/lib/sgsd-cockpit-shell.cjs"
      via: "Get-CockpitDataSnapshot shells out: & node $shell $planningDir $phase 2>$null"
      pattern: "node\\s+.*sgsd-cockpit-shell\\.cjs"
    - from: "super-gsd/scripts/sgsd-mission-control.ps1"
      to: "super-gsd/scripts/lib/sgsd-active-agent-panel.ps1"
      via: "dot-source then call Format-SgsdActiveAgentPanel in right zone"
      pattern: "Format-SgsdActiveAgentPanel"
    - from: "super-gsd/scripts/sgsd-mission-control.ps1"
      to: "super-gsd/scripts/lib/sgsd-source-mix-panel.ps1"
      via: "dot-source then call Format-SgsdSourceMixPanel in A1 SOURCE MIX line"
      pattern: "Format-SgsdSourceMixPanel"
    - from: "super-gsd/scripts/sgsd-mission-control.ps1"
      to: "super-gsd/scripts/lib/sgsd-token-panel.ps1"
      via: "dot-source then call Format-SgsdTokenPanel in A1 cost line"
      pattern: "Format-SgsdTokenPanel"
    - from: "super-gsd/scripts/sgsd-mission-control.ps1"
      to: "super-gsd/scripts/lib/sgsd-codex-status.ps1"
      via: "Codex status lib remains the SOLE A3 data source"
      pattern: "Get-SgsdCodexStatus|Get-SgsdCodexLogRows"
    - from: "super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1"
      to: ".planning/metrics/*.jsonl + super-gsd/tools/*"
      via: "fingerprint mtime+size before/after render; assert no drift"
      pattern: "fingerprint|FingerprintCanonicalStreams"
---

<objective>
Phase 50 ships a render-layer cockpit upgrade that makes current work, active agents, Codex state, evidence, blockers, token spend, and context source mix obvious at a glance on the operator laptop viewport. The plan extends the EXISTING cockpit (super-gsd/scripts/sgsd-mission-control.ps1, 1999 lines + 4 lib files) without building a second one (50-CONTEXT.md lock, EXISTING-SURFACE-AUDIT.md line 70).

Purpose: stop handing broad raw context to operators. Phase 50 is a wiring/refactor problem - every aggregation, parser, and renderer it needs is either (a) already present in sgsd-mission-control.ps1's lib, or (b) shipped by Phases 41/42/45/49 as a public API. The risk is duplication, not new work. RESEARCH section "Don't Hand-Roll" lists 11 helpers to consume by reference instead of re-implementing. The acceptance criteria translate to: relocate, dedupe, add 3 new pane libs that are thin readers over public APIs, plus a Node bridge that calls all v1.9 APIs in one shot.

Output: 4 NEW files (1 Node bridge, 3 PowerShell pane libs), 1 EDITED host (sgsd-mission-control.ps1: A3 consolidation, threshold change, label cleanup), 1 EXTENDED test harness (A2/A3/A5 fixtures + no-canonical-write invariant). 5-6 atomic commits, ASCII-only on all written files, read-only invariant preserved.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/milestones/v1.9/phases/50-cockpit-research-dashboard/50-CONTEXT.md
@.planning/milestones/v1.9/phases/50-cockpit-research-dashboard/50-RESEARCH.md
@.planning/milestones/v1.9/REQUIREMENTS.md
@.planning/milestones/v1.9/ROADMAP.md
@.planning/milestones/v1.9/EXISTING-SURFACE-AUDIT.md

<interfaces>
<!-- Forward contracts the executor consumes BY REFERENCE. Do not re-implement. -->
<!-- All shapes verified against source code at the line citations below.       -->

From super-gsd/tools/token-attribution/report.cjs (Phase 41 LOCKED, lines 513-562 + module.exports lines 1013-1027):
```javascript
module.exports = {
  summarize,            // (planningDir, {groupBy:'role+phase'}) -> rows[]
  BLOAT_THRESHOLDS,     // frozen budget thresholds
  // ... and others
};

// summarize(planningDir, {groupBy:'role+phase'}) returns:
// rows = [{
//   key: 'researcher|50',
//   calls: 1,
//   total: 314538,
//   avg: 314538,
//   cache_read_ratio: 0.985,
//   useful_findings_per_100k: 12,
//   status_breakdown: { ok: 1 }
// }, ...] sorted descending by total
```

From super-gsd/tools/token-waste/check.cjs (Phase 42 LOCKED, lines 441-540 + module.exports lines 1350-1361):
```javascript
module.exports = {
  runCheck,             // (planningDir, {milestone, phase, role}) -> verdict envelope
  // ...
};

// runCheck(planningDir, { phase: '50' }) returns:
// {
//   scope: { milestone: null, phase: '50', role: null },
//   verdict: 'ok' | 'warn' | 'degraded',
//   totals: { rows_evaluated, ok, warn, degraded, false_positive },
//   rules_tripped: { 'researcher_local_script_candidate': 3, ... },
//   route_hints: [{ from_role, reason, count }, ...],
//   top_offenders: [{ role, phase, milestone, input_total, cache_ratio, findings, verdict, source_event_id }, ...],
//   budgets_source: '...'
// }
// Lock 13 wrapped: never throws upward.
```

From super-gsd/tools/memory-governance/lifecycle.cjs (Phase 49 LOCKED, lines 1266-1337):
```javascript
module.exports = {
  getMemoryGovernanceSnapshot,  // (planningDir) -> snapshot
  // ...
};

// getMemoryGovernanceSnapshot(planningDir) returns:
// {
//   ok: true,
//   total_artifacts: 44,
//   by_compression_level: {
//     raw_evidence: 0,
//     phase_capsule: 44,
//     validated_thought: 0,
//     reusable_rule: 0,
//     guardrail: 0
//   },
//   recently_revoked: [{...}, ...],
//   recently_revalidated: [{...}, ...],
//   complaints_pending: 0,
//   last_process_complaints_ts: '2026-04-27T20:09:27.392Z'
// }
```

From super-gsd/tools/context-packet/build.cjs (Phase 45 LOCKED, lines 239-268):
```javascript
// context-packet-log.jsonl rows include row.metadata.context_source_mix
// with 7 FROZEN keys (Object.freeze applied at builder; do NOT invent an 8th):
const CONTEXT_SOURCE_MIX_KEYS = Object.freeze([
  'raw_evidence',
  'phase_capsule',
  'validated_thought',
  'reusable_rule',
  'guardrail',
  'index_snippet',
  'vtp_packet'
]);
```

From super-gsd/scripts/lib/sgsd-codex-status.ps1 (existing, A3 SOLE owner - do not duplicate parsing):
```powershell
. "$PSScriptRoot/lib/sgsd-codex-status.ps1"
$codex = Get-SgsdCodexStatus -ProjectDir $ProjectDir -PlanningDir $PlanningDir
# returns: @{ state, updatedAgeSec, model, reasoningEffort, totalRuns,
#             okRuns, failedRuns, claudeTokensSaved, stateColor }
$rows  = Get-SgsdCodexLogRows -PlanningDir $PlanningDir -MaxRows 5 -PhaseFilter $currentNum
$verds = Get-SgsdCodexVerdicts -PlanningDir $PlanningDir -MaxRows 3 -MilestoneFilter $state.milestone -PhaseFilter $currentNum
```

From super-gsd/scripts/sgsd-mission-control.ps1 (existing host, key idioms):
- Render-cache: `Get-CachedTail $log $N` (line 198-210) - mtime-keyed JSONL tail cache; reuse, do not duplicate.
- Active-agent thresholds: `Get-AgentRoster -maxAgeSec` (line 891-938) - ACTIVE <300s, IDLE <900s, RECENT <3600s. A2 keeps these and shows ONLY ACTIVE.
- Compact mode trigger: line 1333 currently `<70` rows; Phase 50 lowers to `<40` rows.
- Existing Codex prints to consolidate/remove: lines 1346 (mission strip embed), 1399 (inference watchdog), 1614-1644 (Codex one-liner), 1647-1674 (Codex tile = KEEP as the A3 source).
- Lock 13 idiom: `sgsd-mission-strip.ps1:5-8` "this lib MUST NEVER throw out of a Render frame" - every new pane lib follows.
- Read-only fingerprint precedent: `super-gsd/tools/dispatch-router/route.cjs:679-700` - capture mtime+size before, assert no drift after.

From super-gsd/scripts/lib/sgsd-render-cache.ps1 (existing, 171 lines):
```powershell
# Reuse Get-CachedTail / Get-CachedJsonTail / Invoke-CachedGit; do not roll new caches.
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create the Node bridge sgsd-cockpit-shell.cjs that calls Phase 41/42/49 public APIs by reference and emits one JSON snapshot</name>
  <files>super-gsd/scripts/lib/sgsd-cockpit-shell.cjs</files>
  <action>
NEW FILE. Single Node CJS module that the PowerShell host shells out to once per render. Imports Phase 41/42/49 modules BY REFERENCE via absolute path require() - never copy aggregation logic into the bridge.

Required structure (ASCII-only, CJS, no new npm deps):

  1. SHEBANG: omit (invoked via `node`, not direct exec).
  2. Header comment block stating: "Phase 50 read-only Node bridge. Imports Phase 41/42/49 BY REFERENCE. Lock 13: never throws upward. Read-only invariant: never writes any file."
  3. `const path = require('path');`
  4. Resolve repo root from __dirname: `path.resolve(__dirname, '..', '..', '..')` (super-gsd/scripts/lib -> repo root).
  5. require() Phase 41/42/49 absolute paths (per RESEARCH section "Code Examples"):
     - `super-gsd/tools/token-attribution/report.cjs`
     - `super-gsd/tools/token-waste/check.cjs`
     - `super-gsd/tools/memory-governance/lifecycle.cjs`
     Each require() wrapped in try/catch - if any module is absent, set the corresponding snapshot field to `{ unavailable: true, reason: '<module-name>-missing' }`.
  6. Frozen consts (Object.freeze, per Mirror constraint):
     - `const PANEL_KINDS = Object.freeze(['token','source_mix','active_agent','codex','intent','governance','budget']);`
     - `const ACTIVITY_WINDOW_SEC = Object.freeze({ active: 60, recent: 300 });`
     - `const CONTEXT_SOURCE_MIX_KEYS = Object.freeze(['raw_evidence','phase_capsule','validated_thought','reusable_rule','guardrail','index_snippet','vtp_packet']);` (mirrors Phase 45 build.cjs:239-268; do not invent an 8th key).
  7. `function buildSnapshot(planningDir, phase)` returns one object with:
     - `byRolePhase`: result of `tokenAttr.summarize(planningDir, { groupBy: 'role+phase' })` (entire array, do not filter - UI picks top N).
     - `budget`: result of `tokenWaste.runCheck(planningDir, { phase })`.
     - `governance`: result of `memGov.getMemoryGovernanceSnapshot(planningDir)`.
     - `budgets`: `tokenAttr.BLOAT_THRESHOLDS` if exported (display-only).
     - `panel_kinds`: PANEL_KINDS.
     - `context_source_mix_keys`: CONTEXT_SOURCE_MIX_KEYS.
     - `activity_window_sec`: ACTIVITY_WINDOW_SEC.
     - `meta`: `{ generated_at: new Date().toISOString(), planning_dir: planningDir, phase: phase || null }`.
     EVERY field individually wrapped in try/catch. On error, set `{ unavailable: true, reason: <err.message> }` (Lock 13: never throws upward).
  8. `function selfTest()`:
     - Test 1: `PANEL_KINDS.length === 7`.
     - Test 2: `Object.isFrozen(PANEL_KINDS) === true`.
     - Test 3: `Object.isFrozen(CONTEXT_SOURCE_MIX_KEYS) === true && CONTEXT_SOURCE_MIX_KEYS.length === 7`.
     - Test 4: `typeof tokenAttr.summarize === 'function'` (or `unavailable` field set).
     - Test 5: `typeof tokenWaste.runCheck === 'function'` (or `unavailable` field set).
     - Test 6: `typeof memGov.getMemoryGovernanceSnapshot === 'function'` (or `unavailable` field set).
     - Test 7: Build snapshot for the repo's own .planning dir; assert it returns an object with the seven top-level keys above and `meta.generated_at` is an ISO-8601 string.
     - Test 8: NO file writes occurred. Use `fs.statSync` on `.planning/metrics/agent-token-spend.jsonl`, `.planning/metrics/token-waste-status.jsonl`, `.planning/metrics/context-packet-log.jsonl`, `.planning/metrics/intent-map.jsonl` BEFORE and AFTER buildSnapshot; mtime+size unchanged.
     Print one-line per assertion; exit 0 on all pass, exit 1 on first fail.
  9. CLI entry:
     - `if (process.argv[2] === '--self-test') { process.exit(selfTest() ? 0 : 1); }`
     - Else: `const planningDir = process.argv[2]; const phase = process.argv[3] || null; process.stdout.write(JSON.stringify(buildSnapshot(planningDir, phase)));`.
     stderr suppressed by caller (`2>$null`); stdout JSON-only (no banner, no trailing newline).
 10. Read-only invariant: do NOT call `fs.writeFile`, `fs.appendFile`, or any mutation API anywhere in the file. Verify via static review: only `fs.statSync` and `fs.readFileSync` (if needed) appear.
 11. ASCII-only literals throughout (PS5.1 mojibake guard applies even to JSON the cockpit consumes).

NOT permitted (Mirror constraints):
  - Re-defining any const enum from Phase 41/42/45/49 (only mirror by reference for display).
  - throw outside of selfTest assertion failures (Lock 13).
  - Coupling to Phase 51/52 - forward contracts via shape only; no direct require() of those modules.

Atomic commit: `feat(50-01): cockpit-shell.cjs Node bridge + Phase 41/42/49 import-by-reference`
  </action>
  <verify>
    <automated>node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test</automated>
  </verify>
  <done>
- File exists at super-gsd/scripts/lib/sgsd-cockpit-shell.cjs.
- `node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test` exits 0 with 8 PASS lines.
- `node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs ./.planning 50` writes a single JSON object to stdout containing keys: byRolePhase, budget, governance, budgets, panel_kinds, context_source_mix_keys, activity_window_sec, meta.
- `git diff --quiet -- .planning/metrics/agent-token-spend.jsonl .planning/metrics/token-waste-status.jsonl .planning/metrics/context-packet-log.jsonl .planning/metrics/intent-map.jsonl` after running the bridge - no drift.
- File is ASCII-only: `node -e "const s=require('fs').readFileSync('super-gsd/scripts/lib/sgsd-cockpit-shell.cjs','utf8'); for(const c of s){if(c.charCodeAt(0)>127){process.exit(1);}}"` exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create sgsd-token-panel.ps1 (A1 cost panel) reading byRolePhase + budget verdict</name>
  <files>super-gsd/scripts/lib/sgsd-token-panel.ps1</files>
  <action>
NEW FILE. Thin PowerShell renderer over the snapshot from Task 1. Per RESEARCH section "Pattern 1" + section "Don't Hand-Roll" row 1: NEVER re-aggregate; only render `snapshot.byRolePhase`.

Required structure (ASCII-only, PowerShell 5.1 compatible):

  1. Header: "Phase 50 A1 cost panel. Read-only renderer. Lock 13: never throws upward."
  2. `function Format-SgsdTokenPanel { param($Snapshot, [int]$PaneWidth = 60) ... }`:
     - try{}/catch{} around the entire body - on any error return single-line "TOKENS  unavailable" (Lock 13 idiom from sgsd-mission-strip.ps1:5-8).
     - If $Snapshot -eq $null OR $Snapshot.byRolePhase -eq $null OR $Snapshot.byRolePhase.unavailable -eq $true: return "TOKENS  unavailable".
     - Sort `$Snapshot.byRolePhase` descending by `total` (already sorted by Phase 41, but defensive).
     - Compute total = sum of all `total` fields. If 0 -> return "TOKENS  no spend yet".
     - Render lines (3-line block):
       Line 1: `("TOKENS  total {0}k  rows {1}" -f [math]::Round($total/1000), $Snapshot.byRolePhase.Count)`.
       Line 2-3: top 2 rows formatted as `("  {0,-22} {1,8}k  cache {2,4:P0}  found/100k {3,3}" -f $row.key, [math]::Round($row.total/1000), $row.cache_read_ratio, $row.useful_findings_per_100k)` - truncated by Trunc helper if longer than $PaneWidth.
     - Append budget verdict tier as a fourth line: `("BUDGET  {0}" -f $verdict)` where `$verdict = $Snapshot.budget.verdict` (or "unavailable").
       - Color tier mapping (return tuple of (line, color)): ok=Green, warn=Yellow, degraded=Red, otherwise=DarkGray.
     - Returns an array of 4 PSCustomObjects: `@{ Line; Color }` so the host can Write-Host with -ForegroundColor.
  3. Helper `Trunc` MAY be reused from existing host scope (already defined in sgsd-mission-control.ps1) - dot-source order ensures availability. If running standalone (acceptance test), define a local fallback Trunc.
  4. NO direct file reads. Panel takes the already-built snapshot; reads are the host's job.
  5. NO writes anywhere in the file (read-only invariant).

Atomic commit: `feat(50-01): sgsd-token-panel.ps1 (A1 cost)`
  </action>
  <verify>
    <automated>pwsh -NoProfile -Command ". super-gsd/scripts/lib/sgsd-token-panel.ps1; $r = Format-SgsdTokenPanel -Snapshot $null -PaneWidth 60; if ($r.Line -ne 'TOKENS  unavailable') { exit 1 } else { exit 0 }"</automated>
  </verify>
  <done>
- File exists at super-gsd/scripts/lib/sgsd-token-panel.ps1, ASCII-only.
- Format-SgsdTokenPanel handles `$null` snapshot without throwing (returns single "TOKENS  unavailable" line).
- Format-SgsdTokenPanel handles seeded snapshot returning 4-line block with TOKENS header + 2 top rows + BUDGET verdict line.
- No file writes performed by the panel (verified by running it against a sentinel directory tree and asserting mtime/size unchanged).
- Verdict tier color mapping ok/warn/degraded -> Green/Yellow/Red/DarkGray.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create sgsd-active-agent-panel.ps1 (A2 right pane) using structural signals only</name>
  <files>super-gsd/scripts/lib/sgsd-active-agent-panel.ps1</files>
  <action>
NEW FILE. A2 right pane: header line for currently-active agent, then agent history (3 rows), then tool/skill/VTP stream (5 rows). MUST use structural signals only (Lock 11: no semantic similarity).

Required structure (ASCII-only, PowerShell 5.1 compatible):

  1. Header: "Phase 50 A2 active-agent panel. Lock 13: never throws upward. Lock 11: structural signals only (no semantic similarity)."
  2. `function Get-CurrentlyActiveAgents { param([string]$ProjectDir, [int]$WindowSec = 300) ... }`:
     - try{}/catch{} -> return @() on error.
     - Active means BOTH:
       (a) `.planning/metrics/orchestrator-pulse.jsonl` last row `ts` is within $ACTIVE_PULSE_SEC (60s) of now, AND
       (b) `.planning/metrics/activity-log.jsonl` last `Agent` or `TaskCreate` row `ts` is within $WindowSec (300s default).
     - Read tails via existing `Get-CachedTail` if available (host context), else `Get-Content -Tail 200`.
     - Reuse host's `Get-AgentRoster -maxAgeSec $WindowSec` if available; filter `$_.status -eq 'ACTIVE'`. Return that list.
     - Forbidden: any LLM/embedding/semantic match. Allowed: timestamp comparisons, equality matches on `agent`/`role`/`subagent_type` strings.
  3. `function Format-SgsdActiveAgentPanel { param($Active, $History, $ToolStream, [int]$PaneWidth = 60) ... }`:
     - try{}/catch{} -> on error return "ACTIVE AGENTS  unavailable".
     - Header line: if $Active.Count -eq 0 -> "ACTIVE AGENTS  none in last 60s"; else "ACTIVE AGENTS  $($Active.Count): $(($Active | Select -First 3 | %{ $_.agent }) -join ', ')".
     - Agent history block (3 most recent from $History parameter): `("  {0,-18} {1,4}s ago" -f $row.agent, $row.ageSec)`.
     - Tool/skill/VTP stream block (5 most recent from $ToolStream): show `tool_name` truncated to $PaneWidth-12 chars; never render tool *arguments* (RESEARCH section "Security Domain" V8 lock - args may contain Bearer/sk-/ghp_/password=).
     - Pre-Write-Host scrubbing: strip ANSI escape sequences from any user-supplied string field via `[regex]::Replace($s, '\x1B\[[0-9;]*[a-zA-Z]', '')` (RESEARCH section "Security Domain" Tampering row - explicit Phase 50 hardening).
     - Return array of `@{ Line; Color }` (color: White header / Gray body).
  4. NO direct writes (read-only).
  5. Frozen const `$ACTIVE_PULSE_SEC = 60` declared at top of file (mirrors Object.freeze intent in PS).

Atomic commit: `feat(50-01): sgsd-active-agent-panel.ps1 (A2)`
  </action>
  <verify>
    <automated>pwsh -NoProfile -Command ". super-gsd/scripts/lib/sgsd-active-agent-panel.ps1; $r = Format-SgsdActiveAgentPanel -Active @() -History @() -ToolStream @() -PaneWidth 60; if ($r[0].Line -notmatch 'ACTIVE AGENTS') { exit 1 } else { exit 0 }"</automated>
  </verify>
  <done>
- File exists at super-gsd/scripts/lib/sgsd-active-agent-panel.ps1, ASCII-only.
- Get-CurrentlyActiveAgents uses ONLY timestamp comparisons (verified by grep: no `embedding`, `cosine`, `similarity`, `vtp_search` substrings in the function body).
- Empty inputs render header "ACTIVE AGENTS  none in last 60s" without throwing.
- ANSI escape strip pass present (regex `\x1B\[[0-9;]*[a-zA-Z]`).
- No file writes performed by the panel.
- Lock 13 verified: malformed input does not throw; degrades to "unavailable".
  </done>
</task>

<task type="auto">
  <name>Task 4: Create sgsd-source-mix-panel.ps1 (A1 SOURCE MIX line) with frozen 7-key shape</name>
  <files>super-gsd/scripts/lib/sgsd-source-mix-panel.ps1</files>
  <action>
NEW FILE. A1 SOURCE MIX line: 7 frozen keys raw/cap/vt/rule/guard/idx/vtp from latest context-packet-log.jsonl row matching active phase, plus inline budget verdict.

Required structure (ASCII-only, PowerShell 5.1 compatible):

  1. Header: "Phase 50 A1 source-mix panel. Reads context-packet-log.jsonl tail. Frozen 7-key shape (Phase 45 build.cjs:239-268)."
  2. Frozen const at top: `$script:CONTEXT_SOURCE_MIX_KEYS = @('raw_evidence','phase_capsule','validated_thought','reusable_rule','guardrail','index_snippet','vtp_packet')` - order-locked (do not invent an 8th key).
  3. `function Get-LatestContextSourceMix { param([string]$ProjectDir, [string]$Phase) ... }`:
     - try{}/catch{} -> return $null on error.
     - Path: `Join-Path $ProjectDir ".planning/metrics/context-packet-log.jsonl"` - if missing, return $null.
     - Use `Get-CachedTail $log 50` if available; else `Get-Content -Tail 50`.
     - Walk tail backwards; for each row `try { ConvertFrom-Json -ErrorAction Stop } catch { continue }`. If `$Phase` set and `"$($r.phase)" -ne $Phase` -> continue. If `$r.metadata.context_source_mix` present -> return it.
     - On exhaustion -> return $null.
  4. `function Format-SgsdSourceMixPanel { param($Mix, $Verdict, [int]$PaneWidth = 60) ... }`:
     - try{}/catch{} -> "SOURCE MIX  unavailable" on error.
     - If $Mix -eq $null -> "SOURCE MIX  unavailable".
     - Render in locked key order: `"SOURCE MIX  raw {0}  cap {1}  vt {2}  rule {3}  guard {4}  idx {5}  vtp {6}"` formatted from CONTEXT_SOURCE_MIX_KEYS lookup.
     - Append verdict tier: `"  [budget {0}]"` where verdict in @('ok','warn','degraded','unavailable').
     - Color: ok=Green, warn=Yellow, degraded=Red, otherwise=DarkGray.
     - Return single PSCustomObject `@{ Line; Color }`.
  5. NO writes.

Atomic commit: `feat(50-01): sgsd-source-mix-panel.ps1 (A1 context)`
  </action>
  <verify>
    <automated>pwsh -NoProfile -Command ". super-gsd/scripts/lib/sgsd-source-mix-panel.ps1; $r = Format-SgsdSourceMixPanel -Mix $null -Verdict 'ok' -PaneWidth 60; if ($r.Line -ne 'SOURCE MIX  unavailable') { exit 1 } else { exit 0 }"</automated>
  </verify>
  <done>
- File exists at super-gsd/scripts/lib/sgsd-source-mix-panel.ps1, ASCII-only.
- $script:CONTEXT_SOURCE_MIX_KEYS contains exactly the 7 keys in the order from build.cjs:239-268; no 8th key invented.
- Format-SgsdSourceMixPanel handles $null mix without throwing.
- Format-SgsdSourceMixPanel renders all 7 keys when given a valid mix object.
- Get-LatestContextSourceMix tolerates malformed JSONL rows by skipping them (try/catch per row).
- No file writes (read-only invariant).
  </done>
</task>

<task type="auto">
  <name>Task 5: Edit sgsd-mission-control.ps1 - consolidate Codex to A3, lower compact threshold 70->40, replace operator-hostile labels</name>
  <files>super-gsd/scripts/sgsd-mission-control.ps1</files>
  <action>
EDIT existing host. Five surgical changes; each must be reversible by inspection.

Change 1 - A3 consolidation (COCKPIT-02, A3 acceptance binding):
  - Locate the Codex one-liner block at lines 1614-1644 ("--- Codex tile (one-liner banner)" or similar header) and DELETE it (the entire Write-Host chain rendering codex state in a single line). KEEP the Codex tile block at 1647-1674 (the `=== SGSD-Codex-Tile ===` block) as the SOLE A3 source.
  - Locate the Codex field embedded in the mission strip render at line 1346 (`Render-MissionStrip`) - the strip's own `> codex` field. Set the strip lib's `$state.codexAgents` rendering so that when `$Phase -ge 50`, the codex column collapses to placeholder `--` (do this in sgsd-mission-control.ps1 via param to Render-MissionStrip, NOT inside the mission-strip lib - keep lib reusable for prior phases). Concretely: pass `-OmitCodex $true` as a switch and check it in the strip. If adding a switch is too invasive, instead delete the codex-rendering Write-Host call inside Render-MissionStrip's strip line block (still in mission-control host scope only - do not modify sgsd-mission-strip.ps1 in this task).
  - Locate the inference-watchdog Codex print at line 1399 (currently mixed with cascade/heartbeat); DELETE the codex substring write while preserving the heartbeat/inference content.
  - After the edit: `grep -n "Codex\|codex" super-gsd/scripts/sgsd-mission-control.ps1 | grep -v "^#" | grep -vE "lib.sgsd-codex-status|Get-SgsdCodex|SGSD-Codex-Tile|codexRows|codexVerdicts|claudeTokensSaved|codex.state|codex.model|codex.totalRuns|codex.okRuns|codex.failedRuns|codex.reasoningEffort|codex.updatedAgeSec"` returns the SGSD-Codex-Tile block ONLY (~25-30 lines all clustered in one Render-Section).

Change 2 - Compact-mode threshold (COCKPIT-05, A4 acceptance binding):
  - Line 1333 currently: `if ($env:SGSD_COCKPIT_COMPACT -eq "1" -or ((Get-PaneHeight) -lt 70 -and $env:SGSD_COCKPIT_FULL -ne "1")) {`
  - Change to: `if ($env:SGSD_COCKPIT_COMPACT -eq "1" -or ((Get-PaneHeight) -lt 40 -and $env:SGSD_COCKPIT_FULL -ne "1")) {`
  - Preserve env-var contracts SGSD_COCKPIT_COMPACT and SGSD_COCKPIT_FULL exactly as-is (RESEARCH section "Runtime State Inventory").

Change 3 - Wire new pane libs into Render (COCKPIT-01, COCKPIT-03, COCKPIT-04, A1, A2):
  - Near the top of the file (after the existing `. $__codex` dot-source at line 100), add three new dot-source lines:
    ```
    . (Join-Path $PSScriptRoot "lib\sgsd-token-panel.ps1")
    . (Join-Path $PSScriptRoot "lib\sgsd-active-agent-panel.ps1")
    . (Join-Path $PSScriptRoot "lib\sgsd-source-mix-panel.ps1")
    ```
    Each guarded with the same `if (-not (Test-Path ...))` MISSING LIB pattern as the existing codex dot-source (lines 93-99).
  - Add `function Get-CockpitDataSnapshot { param([string]$ProjectDir, [string]$CurrentPhase) ... }` per RESEARCH section "Pattern 1" - shells out to the Node bridge (`& node $shell $planningDir $CurrentPhase 2>$null`), parses JSON, caches by mtime fingerprint of `.planning/milestones/` directory tree (RESEARCH Pitfall 2 - Phase 49 walks every capsule; cache with same idiom as existing `_sessionAggKey` at line 345). On any error -> return $null.
  - In Render (full mode), within the existing A1 left-top zone:
    - Replace the existing single cost line (1880-1888) with `Format-SgsdTokenPanel -Snapshot $snap -PaneWidth $w` and Write-Host each returned line with its color.
    - Insert new SOURCE MIX line ABOVE the cost line: `Format-SgsdSourceMixPanel -Mix (Get-LatestContextSourceMix -ProjectDir $ProjectDir -Phase $currentNum) -Verdict $snap.budget.verdict -PaneWidth $w`.
    - Insert new "INTENT" line at the very top of A1 (above everything else): read tail of `.planning/metrics/intent-map.jsonl`, parse most-recent row's `canonical` field; truncate to PaneWidth-8; render as `("INTENT  {0}" -f $canonical)`. If empty -> "INTENT  --". This satisfies COCKPIT-06 / A4 / A5 acceptance.
  - In Render (full mode), within the right-pane zone (replaces existing right-side Agent panel content from Get-AgentRoster):
    - `$active = Get-CurrentlyActiveAgents -ProjectDir $ProjectDir -WindowSec 300`
    - `$history = Get-AgentRoster -maxAgeSec 900 | Select -First 3` (existing helper, IDLE/RECENT bucket).
    - `$toolStream = Get-LastMcpSummary | Select -First 5` (existing helper at line 429; render result names only, not args).
    - `Format-SgsdActiveAgentPanel -Active $active -History $history -ToolStream $toolStream -PaneWidth $rightPaneWidth` and Write-Host each line.
  - All new render calls wrapped in `try{}/catch{}` per Lock 13.

Change 4 - Operator-hostile label cleanup (COCKPIT-06, A4 acceptance binding):
  - Replace forbidden labels per RESEARCH Pitfall 4:
    * "R#" -> "request" or remove if redundant
    * "cascade" -> "fallback chain"
    * "old live" -> "previous-session"
    * "WILL" -> "queued"
    * "BLK" -> "blocker"
    * "pulse" -> "heartbeat"
    * "gate" -> "review-gate" (only when standalone; "gate3 verdict" stays as "Phase 3 review verdict")
    * "tok" -> "tokens"
  - Line-by-line locations: 1433 (`BLK 1 / WILL 2`), 1601-1611 (`SGSD-V2: pulse 30s gate pass tok ...=#`).
  - Mission strip "DLB-04" prefix at substrate line: rename surface label to "Substrate registry" (do not rename the substrate lib filename or function names - only rendered text).
  - Keep `MISSION CONTROL` brand string.
  - Forbidden-label list MUST NOT appear anywhere in rendered output for the cockpit (verified by Task 6 fixture A7).

Change 5 - Read-only invariant guard (RESEARCH section "Anti-Patterns" - Writing to canonical streams):
  - Add a single comment block above Render: "PHASE 50 INVARIANT: Render is read-only over .planning/. Any new Write-* / Out-File / Set-Content / Add-Content / fs.writeFile target under .planning/ or super-gsd/tools/ in this function violates Lock 13 + read-only invariant. Acceptance fixture A8 enforces via fingerprint."
  - No code change; documents the invariant for future contributors.

NOT permitted in this task:
  - Renaming `sgsd-mission-control.ps1` (RESEARCH section "Runtime State Inventory" - sgsd1.cmd launcher binds the path).
  - Modifying `sgsd-mission-strip.ps1`, `sgsd-codex-status.ps1`, `sgsd-substrate-status.ps1`, or `sgsd-render-cache.ps1` source files (those are extant libs; A3 consumption is via DOT-SOURCE, not edits).
  - Modifying any Phase 41-49 source file (read-only invariant).

Atomic commit: `fix(50-01): consolidate Codex state to single A3 pane + label cleanup + 40-row compact threshold`
  </action>
  <verify>
    <automated>pwsh -NoProfile -Command "$h = Get-Content super-gsd/scripts/sgsd-mission-control.ps1 -Raw; if ($h -match '\(Get-PaneHeight\) -lt 70 -and') { Write-Host 'FAIL: 70-row threshold still present'; exit 1 }; if ($h -notmatch '\(Get-PaneHeight\) -lt 40 -and') { Write-Host 'FAIL: 40-row threshold not present'; exit 1 }; if ($h -notmatch 'Format-SgsdTokenPanel') { Write-Host 'FAIL: token panel not wired'; exit 1 }; if ($h -notmatch 'Format-SgsdActiveAgentPanel') { Write-Host 'FAIL: active-agent panel not wired'; exit 1 }; if ($h -notmatch 'Format-SgsdSourceMixPanel') { Write-Host 'FAIL: source-mix panel not wired'; exit 1 }; if ($h -notmatch 'INTENT') { Write-Host 'FAIL: intent line not added'; exit 1 }; foreach ($f in @('R#','cascade','old live','WILL','BLK 1','SGSD-V2: pulse')) { if ($h -match [regex]::Escape($f)) { Write-Host \"FAIL: forbidden label still present: $f\"; exit 1 } }; Write-Host PASS; exit 0"</automated>
  </verify>
  <done>
- Compact-mode threshold lowered from <70 to <40 (verified by grep).
- Three new pane libs dot-sourced and wired into Render full-mode path.
- INTENT line at top of A1 reads intent-map.jsonl canonical field, truncates jargon, renders operator language.
- Codex appears in exactly one Render-Section (the existing SGSD-Codex-Tile block at 1647-1674); the one-liner at 1614-1644 and inference watchdog codex substring at 1399 are deleted; mission strip codex column collapsed to placeholder when phase >= 50.
- Forbidden operator-hostile labels (R#, cascade, old live, WILL, BLK 1 in render output, SGSD-V2: pulse) absent from the file.
- Env-var contracts SGSD_COCKPIT_COMPACT and SGSD_COCKPIT_FULL preserved verbatim.
- File path super-gsd/scripts/sgsd-mission-control.ps1 unchanged (sgsd1.cmd launcher contract preserved).
- No edits to sgsd-mission-strip.ps1, sgsd-codex-status.ps1, sgsd-substrate-status.ps1, sgsd-render-cache.ps1, or any super-gsd/tools/ file (verified by `git diff --stat super-gsd/scripts/lib/sgsd-mission-strip.ps1 super-gsd/scripts/lib/sgsd-codex-status.ps1 super-gsd/scripts/lib/sgsd-substrate-status.ps1 super-gsd/scripts/lib/sgsd-render-cache.ps1 super-gsd/tools/`).
- ASCII-only on all written lines.
  </done>
</task>

<task type="auto">
  <name>Task 6: Extend cockpit-acceptance harness with A2/A3/A5 fixtures + no-canonical-write fingerprint invariant</name>
  <files>super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1, super-gsd/tests/cockpit-acceptance/fixtures/A1/, super-gsd/tests/cockpit-acceptance/fixtures/A2/, super-gsd/tests/cockpit-acceptance/fixtures/A3/, super-gsd/tests/cockpit-acceptance/fixtures/A4/, super-gsd/tests/cockpit-acceptance/fixtures/A5/, super-gsd/tests/cockpit-acceptance/fixtures/A6/, super-gsd/tests/cockpit-acceptance/fixtures/A7/, super-gsd/tests/cockpit-acceptance/fixtures/A8/</files>
  <action>
EXTEND existing harness. Six fixture extensions plus one new harness invariant.

Per RESEARCH section "Validation Architecture" and section "Wave 0 Gaps":

A1 fixture extension (existing dir):
  - Seed `.planning/metrics/agent-token-spend.jsonl` (3-5 rows with role/phase/total fields).
  - Seed `.planning/metrics/context-packet-log.jsonl` (1 row with metadata.context_source_mix containing all 7 frozen keys).
  - Seed `.planning/metrics/token-waste-status.jsonl` (1 row with verdict='ok').
  - Seed `.planning/milestones/v1.9/phases/50-cockpit-research-dashboard/PHASE-CAPSULE.json` for governance counts.
  - expected-output.txt asserts top-left zone contains substrings: 'milestone', 'phase', 'progress', 'goal', 'EVIDENCE', 'DEBT', 'blockers', 'CTX', 'TOKENS', 'agents', 'commits', 'INTENT', 'SOURCE MIX' (11 fields + INTENT + SOURCE MIX). Each appears at least once.

A2 fixture (NEW, populate empty dir):
  - Seed `.planning/metrics/orchestrator-pulse.jsonl` with one row, ts = (now - 30s).
  - Seed `.planning/metrics/activity-log.jsonl` with one Agent row (ts = now - 60s) plus three older entries (ts = now - 600s, now - 1200s, now - 2400s).
  - expected-output.txt asserts: 'ACTIVE AGENTS' header substring; only the recent agent's name appears in the active line; the three older agents appear in the history block; no semantic-similarity tooling invoked (assertion: `$harness.lastNodeInvocation.cmd -notmatch 'embedding|cosine|similarity'`).

A3 fixture (NEW dir):
  - Seed `.planning/metrics/codex-live.json` with `{state:'running', updatedAt: (now-25s).iso, model:'gpt-5.4', reasoningEffort:'high', totalRuns:12, okRuns:11, failedRuns:1, claudeTokensSaved:245000}`.
  - Seed `.planning/metrics/codex-log.jsonl` with 5 sample rows.
  - Render the cockpit; capture stdout. Assertions:
    * The substring 'Codex' (case-insensitive) appears EXACTLY ONCE outside the SGSD-Codex-Tile block. (Acceptable single occurrence: the A3 pane header.)
    * The SGSD-Codex-Tile block renders fields: state, model, runs, ok/fail, offload (`245k`), last-gate.
    * No 'old live', 'WILL', 'cascade', 'pulse', 'gate' tokens appear inside the codex block.

A4 fixture extension:
  - Already populated in seed step under A1 (context-packet-log.jsonl + token-waste-status.jsonl).
  - expected-output.txt asserts SOURCE MIX line contains all 7 key labels: raw, cap, vt, rule, guard, idx, vtp; budget verdict appears inline.
  - Negative assertion: no 8th key invented; render must not contain any source-mix label outside the 7-frozen set.

A5 fixture (NEW dir):
  - Three sub-fixtures simulating viewport sizes:
    * 80x24 (minimum supported)
    * 120x30 (default laptop, 1366x768 at 14pt Cascadia Mono per RESEARCH section 3 + Pitfall 1)
    * 132x40 (full mode threshold)
  - Mock `Get-PaneWidth`/`Get-PaneHeight` overrides via env-var stub or PowerShell function override.
  - Assertions: at 80x24 and 120x30 -> Render-CompactMissionControl is invoked (verifies 40-row threshold change); at 132x40 -> full Render runs. No clipped state in any of the three (no truncation breaks panel boundaries; verified by line count <= viewport height).

A6 fixture extension:
  - Static repeated-info detection map: `pane -> fields` table. After running Render, the harness scans the captured stdout for each {milestone, phase, goal, evidence, debt, blockers, ctx, cost, agents, commits, codex_state, codex_runs, source_mix, governance, intent} field.
  - Asserts: each field appears in <=1 pane, with whitelist allowing `milestone` and `phase` to appear in mission line for spatial anchoring (per RESEARCH Pitfall 3).

A7 fixture extension (operator-language):
  - Forbidden-label list (string-presence assertion against rendered output): 'R#', 'cascade', 'old live', 'WILL', 'BLK 1', 'SGSD-V2: pulse', 'gate pass tok', 'DLB-04'. Each MUST be absent.
  - Positive list: 'milestone', 'phase', 'agent', 'cost', 'context', 'token', 'blocker', 'commit'. Each MUST appear at least once.
  - Secret-leak assertion (RESEARCH section "Security Domain" V8): no row containing 'Bearer', 'sk-', 'ghp_', or 'password=' ever appears.

A8 fixture extension (failure injection + read-only invariant):
  - Empty/missing canonical streams: delete or truncate each of `.planning/metrics/agent-token-spend.jsonl`, `.planning/metrics/token-log.jsonl`, `.planning/metrics/context-packet-log.jsonl`, `.planning/metrics/intent-map.jsonl`, `.planning/metrics/orchestrator-pulse.jsonl`, `.planning/metrics/codex-live.json` individually; assert Render does not crash and renders 'unavailable' placeholder for the affected pane.
  - Path-traversal injection: write a row to `.planning/metrics/agent-token-spend.jsonl` with `phase: "../etc"` and assert no file is read off canonical paths during Render.
  - ANSI-injection: write a row with a `target` field containing `\x1B[31mEVIL\x1B[0m`; assert the rendered frame contains literal `EVIL` text without ANSI codes (escape strip pass active).

NEW harness invariant - no-canonical-write fingerprint (mirrors super-gsd/tools/dispatch-router/route.cjs:679-700):
  - Add `function Test-CockpitReadOnlyInvariant { param($PlanningDir) ... }` to the harness:
    * Before Render: walk `$PlanningDir/metrics/*.jsonl` and `$PlanningDir/metrics/*.json`; record `@{ path; mtime; size }` for each file.
    * Run Render once (single frame).
    * After Render: walk again; assert mtime+size unchanged for ALL files. On any drift -> exit 1 with the offending path.
    * Also assert no file under `super-gsd/tools/` was modified (`git diff --quiet super-gsd/tools/`).
  - Wire into the harness as the LAST step of the run (after all per-fixture assertions pass).

Filter parameter:
  - Existing harness supports `-Filter A1` etc. Extend to accept A1..A8 and a new `-Filter ReadOnly` for the invariant alone.
  - Full suite command: `pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` runs A1..A8 then the read-only invariant; exits 0 on full pass.

Determinism:
  - Use existing `__TS_OFFSET_-NNN__` substitution pattern for relative timestamps.
  - All fixtures offline; no network; no real Phase 41/42/45/49 invocation (Node bridge mocked via env-var pointing to a fixture-shell that returns canned JSON).

Atomic commit: `test(50-01): cockpit-acceptance - A2/A3/A5 fixtures + no-canonical-write invariant`
  </action>
  <verify>
    <automated>pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1</automated>
  </verify>
  <done>
- A1/A2/A3/A4/A5/A6/A7/A8 fixtures all populated and pass (run-acceptance-fixtures.ps1 exits 0).
- A3 assertion 'Codex appears exactly once outside the SGSD-Codex-Tile block' is enforced.
- A5 viewport-fit fixture covers 80x24, 120x30, 132x40 and asserts compact-mode trigger at 120x30 (40-row threshold).
- A7 forbidden-label list (R#, cascade, old live, WILL, BLK 1, SGSD-V2: pulse, DLB-04) absent from rendered output.
- A8 empty-stream injections do not crash Render; ANSI-strip pass active; path-traversal phase value never causes off-canonical file read.
- Test-CockpitReadOnlyInvariant passes: no canonical stream mtime/size drift after a render frame; `git diff --quiet super-gsd/tools/` clean.
- node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test exits 0 (re-run by harness as its final integration step).
- All fixture files ASCII-only.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| filesystem -> cockpit | Cockpit reads operator-controllable JSONL/JSON under .planning/. A malicious operator (or a compromised tool that wrote a row earlier) could craft rows to break the terminal or leak state. |
| cockpit -> terminal | Rendered output goes through Write-Host into a PTY. Crafted ANSI escapes in JSON values could re-color/scroll the operator's screen unpredictably. |
| cockpit -> Node bridge | PowerShell shells out to `node sgsd-cockpit-shell.cjs`. stderr suppressed, stdout JSON-only. No env passthrough to the bridge except $PATH. |
| cockpit -> Phase 41/42/49 modules | Read-only require() into already-shipped LOCKED helpers. Mirror constraint: never re-define their consts; never write to their files. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-50-01 | Tampering | sgsd-active-agent-panel.ps1 (renders log row fields) | mitigate | Strip ANSI escape sequences via `[regex]::Replace($s, '\x1B\[[0-9;]*[a-zA-Z]', '')` BEFORE Write-Host; per-row try/catch with skip-on-parse-error (Task 3). |
| T-50-02 | Information Disclosure | sgsd-active-agent-panel.ps1 (tool/skill/VTP stream) | mitigate | Render `tool_name` only; never render tool *arguments* (preserves Get-LastMcpSummary contract). A7 fixture asserts no Bearer/sk-/ghp_/password= substring in render output (Task 6). |
| T-50-03 | Tampering | sgsd-source-mix-panel.ps1 (path traversal via phase field) | mitigate | $Phase is treated as a string for filtering ONLY; never used as a path component. A8 fixture seeds `phase: "../etc"` and asserts no off-canonical file read (Task 6). |
| T-50-04 | Denial of Service | sgsd-cockpit-shell.cjs (Phase 49 walker) | mitigate | Cache snapshot by mtime fingerprint of `.planning/milestones/` directory tree; refresh only when fingerprint changes (Task 5 Get-CockpitDataSnapshot; matches RESEARCH Pitfall 2 mitigation). |
| T-50-05 | Tampering | sgsd-mission-control.ps1 (read-only invariant) | mitigate | Comment block declares the invariant; Task 6 Test-CockpitReadOnlyInvariant fingerprints all canonical streams pre/post Render and asserts no drift; mirrors dispatch-router/route.cjs:679-700 precedent. |
| T-50-06 | Spoofing | active-agent detection (semantic match abuse) | mitigate | Lock 11: structural signals only. No embedding/cosine/similarity in the panel; only timestamp comparisons + string equality on agent names. Test 3 verify grep asserts none of those substrings appear in the panel source. |
| T-50-07 | Information Disclosure | sgsd-cockpit-shell.cjs (env/secret leak) | accept | stderr suppressed by caller (`2>$null`); stdout JSON-only; no env passthrough. Bridge does not read process.env. Risk low for local-only PS host. |
| T-50-08 | Denial of Service | huge JSONL line in canonical stream | accept | Existing pattern (Get-CachedTail reads N tail lines bounded; ConvertFrom-Json parser limits apply). RESEARCH section "Security Domain" - out of scope for Phase 50 to fix; documented. |
| T-50-09 | Tampering | symlink in .planning/metrics/* to /etc/passwd or \Windows\System32 | accept | Cockpit only consumes paths under $ProjectDir/.planning/, resolved via Resolve-Path before reads. RESEARCH section "Security Domain" - keep behavior; documented. |
| T-50-10 | Repudiation | cockpit edits canonical streams without audit | mitigate | Read-only invariant per Task 5 comment + Task 6 fingerprint test. No code path in Phase 50 can write to canonical streams. |
</threat_model>

<verification>

## Per-Task Verification

| Task | Command | Expected |
|------|---------|----------|
| 1 | `node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test` | exit 0; 8 PASS lines |
| 1 | `node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs ./.planning 50` | JSON object with 8 top-level keys |
| 2 | `pwsh -NoProfile -Command ". super-gsd/scripts/lib/sgsd-token-panel.ps1; Format-SgsdTokenPanel -Snapshot $null"` | "TOKENS  unavailable" no throw |
| 3 | `pwsh -NoProfile -Command ". super-gsd/scripts/lib/sgsd-active-agent-panel.ps1; Format-SgsdActiveAgentPanel -Active @() -History @() -ToolStream @()"` | "ACTIVE AGENTS  none in last 60s" no throw |
| 4 | `pwsh -NoProfile -Command ". super-gsd/scripts/lib/sgsd-source-mix-panel.ps1; Format-SgsdSourceMixPanel -Mix $null -Verdict 'ok'"` | "SOURCE MIX  unavailable" no throw |
| 5 | `pwsh -NoProfile -Command "Select-String -Path super-gsd/scripts/sgsd-mission-control.ps1 -Pattern 'Get-PaneHeight..-lt 40'"` | match found |
| 5 | `pwsh -NoProfile -Command "Select-String -Path super-gsd/scripts/sgsd-mission-control.ps1 -Pattern 'Format-SgsdTokenPanel|Format-SgsdActiveAgentPanel|Format-SgsdSourceMixPanel'"` | three matches |
| 6 | `pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` | exit 0 |
| 6 | `pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter ReadOnly` | exit 0; no canonical-stream drift |

## Phase-Level Verification (run after Task 6)

```bash
# 1. Node bridge healthy
node super-gsd/scripts/lib/sgsd-cockpit-shell.cjs --self-test
# Expected: exit 0

# 2. A1 covers all 11 fields + INTENT + SOURCE MIX
pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A1
# Expected: exit 0

# 3. A2 active-agent panel reads orchestrator-pulse + activity-log tails
pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A2
# Expected: exit 0

# 4. A3 Codex appears in <=1 pane
pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A3
# Expected: exit 0

# 5. A4 source mix renders 7 frozen keys + budget verdict
pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A4
# Expected: exit 0

# 6. A5 compact-mode threshold triggers at 120x30
pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A5
# Expected: exit 0

# 7. A6 no field appears in >1 pane (whitelist exception)
pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A6
# Expected: exit 0

# 8. A7 operator-language only
pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A7
# Expected: exit 0

# 9. A8 empty-stream + ANSI/path-injection
pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter A8
# Expected: exit 0

# 10. Read-only invariant: no canonical drift after Render
pwsh -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 -Filter ReadOnly
# Expected: exit 0

# 11. Phase 41-49 sources untouched
git diff --quiet super-gsd/tools/token-attribution super-gsd/tools/token-waste super-gsd/tools/context-packet super-gsd/tools/memory-governance super-gsd/tools/dispatch-router super-gsd/tools/vtp-bridge
# Expected: exit 0

# 12. ASCII-only on every written file
node -e "const fs=require('fs'); const f=['super-gsd/scripts/lib/sgsd-cockpit-shell.cjs','super-gsd/scripts/lib/sgsd-token-panel.ps1','super-gsd/scripts/lib/sgsd-active-agent-panel.ps1','super-gsd/scripts/lib/sgsd-source-mix-panel.ps1','super-gsd/scripts/sgsd-mission-control.ps1','super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1']; for (const p of f) { const s=fs.readFileSync(p,'utf8'); for (let i=0;i<s.length;i++) { if (s.charCodeAt(i)>127) { console.error('non-ascii in '+p+' at '+i); process.exit(1); } } }"
# Expected: exit 0
```

</verification>

<success_criteria>

Phase 50 ships when ALL the following are true:

1. **Files created:** 4 NEW files exist (sgsd-cockpit-shell.cjs, sgsd-token-panel.ps1, sgsd-active-agent-panel.ps1, sgsd-source-mix-panel.ps1).
2. **Files edited:** sgsd-mission-control.ps1 has compact threshold lowered (70->40), three new pane-lib dot-sources, INTENT line at A1 top, SOURCE MIX line in A1, Format-SgsdTokenPanel cost, Format-SgsdActiveAgentPanel right pane, Codex consolidated to A3 only, operator-hostile labels replaced.
3. **Tests extended:** run-acceptance-fixtures.ps1 covers A1..A8 plus ReadOnly invariant; full suite exits 0.
4. **A1 acceptance:** top-left zone shows milestone, phase, progress, goal, EVIDENCE, DEBT, blockers, CTX, cost (TOKENS), agents, commits, plus INTENT and SOURCE MIX.
5. **A2 acceptance:** right panel shows currently-active agent header, agent history (3 rows), tool/skill/VTP stream (5 rows). Detection uses structural signals only (Lock 11 verified by grep absence of embedding/cosine/similarity in source).
6. **A3 acceptance:** Codex string appears in exactly one pane (the SGSD-Codex-Tile block); harness asserts >=1 and <=1 occurrence outside that block (allowing one header substring like "> codex --" placeholder).
7. **A4 acceptance:** intent-map.jsonl canonical field renders in operator language; forbidden-label list absent.
8. **A5 acceptance:** layout fits 1366x768 (compact mode triggers at <40 rows; full mode at >=40 rows). 80x24, 120x30, 132x40 sub-fixtures all pass.
9. **Forward contracts:** Phase 41 summarize, Phase 42 runCheck, Phase 49 getMemoryGovernanceSnapshot are imported BY REFERENCE only; cockpit never re-aggregates (verified by no `summarize`/`runCheck` *redefinition* in Phase 50 files).
10. **Lock 13:** every new pane lib + Node bridge wraps body in try/catch; `--self-test` shows degrade-to-unavailable on missing data; A8 fixture confirms no crash on empty streams.
11. **Read-only invariant:** Test-CockpitReadOnlyInvariant passes - no canonical stream mtime/size drift; `git diff --quiet super-gsd/tools/` clean.
12. **Mirror constraints:** PANEL_KINDS, ACTIVITY_WINDOW_SEC, CONTEXT_SOURCE_MIX_KEYS Object.freeze applied; no const enum redefinitions from Phase 41/42/45/49.
13. **No coupling to Phase 51/52:** sgsd-cockpit-shell.cjs does not require() any Phase 51 or 52 module; forward contract only via shape.
14. **ASCII-only:** all 6 written files pass non-ASCII byte scan.
15. **Atomic commits:** 6 commits in order (cockpit-shell.cjs / token-panel / active-agent-panel / source-mix-panel / mission-control consolidation / acceptance harness extension).
16. **Existing surface preserved:** sgsd-mission-strip.ps1, sgsd-codex-status.ps1, sgsd-substrate-status.ps1, sgsd-render-cache.ps1 source files unchanged; sgsd1.cmd launcher path stable.

</success_criteria>

<output>
After completion, create `.planning/milestones/v1.9/phases/50-cockpit-research-dashboard/50-01-SUMMARY.md`

The SUMMARY must record:
- Files created (4) + files edited (1 host + 1 harness)
- Acceptance results (A1..A8 + ReadOnly all green)
- Confirmation that Phase 41/42/49 imports are BY REFERENCE (no const redefinitions)
- Confirmation of read-only invariant (fingerprint test green)
- Confirmation of Lock 11 (no semantic-similarity tooling in active-agent detection)
- Confirmation of Lock 13 (no throws upward; degrade-to-unavailable on missing data)
- Confirmation of ASCII-only across all written files
- The 6 atomic commit SHAs in order
- Forward contract notes for Phase 51 (cockpit telemetry JSON snapshot path is BENCH-readable; field shape stable) and Phase 52 (Redis live cache adapter consumes the same snapshot via shape, not direct require)
</output>
