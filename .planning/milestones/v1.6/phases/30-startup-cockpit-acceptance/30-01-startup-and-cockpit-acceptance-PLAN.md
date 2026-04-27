---
schema_version: 2
phase: 30
plan: 01
title: Startup Verification + Cockpit Acceptance
type: verification
wave: 1
depends_on: []
files_modified:
  - super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md
  - super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1
  - super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1
  - super-gsd/tests/cockpit-acceptance/measure-boot.ps1
  - super-gsd/tests/cockpit-acceptance/README.md
  - super-gsd/tests/cockpit-acceptance/fixtures/A1/STATE.md
  - super-gsd/tests/cockpit-acceptance/fixtures/A1/activity-log.jsonl
  - super-gsd/tests/cockpit-acceptance/fixtures/A1/codex-live.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A1/meta.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A1/expected-output.txt
  - super-gsd/tests/cockpit-acceptance/fixtures/A2/STATE.md
  - super-gsd/tests/cockpit-acceptance/fixtures/A2/crit-backlog.jsonl
  - super-gsd/tests/cockpit-acceptance/fixtures/A2/codex-live.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A2/meta.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A2/expected-output.txt
  - super-gsd/tests/cockpit-acceptance/fixtures/A4/STATE.md
  - super-gsd/tests/cockpit-acceptance/fixtures/A4/codex-live.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A4/codex-warn-report.md
  - super-gsd/tests/cockpit-acceptance/fixtures/A4/meta.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A4/expected-output.txt
  - super-gsd/tests/cockpit-acceptance/fixtures/A6/STATE.md
  - super-gsd/tests/cockpit-acceptance/fixtures/A6/activity-log.jsonl
  - super-gsd/tests/cockpit-acceptance/fixtures/A6/codex-live.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A6/meta.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A6/expected-output.txt
  - super-gsd/tests/cockpit-acceptance/fixtures/A7/STATE.md
  - super-gsd/tests/cockpit-acceptance/fixtures/A7/ORCHESTRATOR-CHECKPOINT.md
  - super-gsd/tests/cockpit-acceptance/fixtures/A7/heartbeat.jsonl
  - super-gsd/tests/cockpit-acceptance/fixtures/A7/codex-live.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A7/meta.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A7/expected-output.txt
  - super-gsd/tests/cockpit-acceptance/fixtures/A8/STATE.md
  - super-gsd/tests/cockpit-acceptance/fixtures/A8/activity-log.jsonl
  - super-gsd/tests/cockpit-acceptance/fixtures/A8/codex-live.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A8/meta.json
  - super-gsd/tests/cockpit-acceptance/fixtures/A8/expected-output.txt
autonomous: true
expected_ATC_tier: LITE
requirements:
  - REQ-30-BOOT-01
  - REQ-30-BOOT-02
  - REQ-30-BOOT-03
  - REQ-30-BOOT-04
  - REQ-30-COCKPIT-01
  - REQ-30-COCKPIT-02
  - REQ-30-COCKPIT-03
  - REQ-30-COCKPIT-04
  - REQ-30-COCKPIT-05
  - REQ-30-COCKPIT-06
  - REQ-30-COCKPIT-07
  - REQ-30-COCKPIT-08
  - REQ-30-UX-04
discuss_decisions: [30.1]
locked_decisions:
  - "DISCUSS 30.1: All 8 acceptance scenarios mandatory; fixture evidence permitted for the 3 hard cases (codex-timeout, forced-restart, codex-warned); no live-only deferral."
  - "Verification phase — no source edits to sgsd-boot.ps1, sgsd-mission-strip.ps1, sgsd-dashboard-host.ps1, Install-SgsdShortcut.ps1."
  - "Reuse Phase 29 fixtures F1 (codex-stale), F4 (codex-timeout), F5 (codex-ready/warned base), F6 (codex-unavailable). 6 new fixtures: A1, A2, A4, A6, A7, A8. A3 references F4 by path."
  - "Determinism: mtime forge via meta.json offsets; per-fixture temp dir; ASCII-only literals; dot-source production lib (Live-or-Local rule)."
  - "BOOT-03 README gap recorded only — defer fix to v1.7 docs phase."
controlling_principle: "Autonomy continues; evidence tells the truth. Phase 30 records, does not patch."
must_haves:
  truths:
    - "All 8 acceptance scenarios from COCKPIT-2.0-SCOPE.md lines 219-228 produce evidence (live or fixture); none deferred."
    - "All 7 documented sg/sgsd boot flags (sgsd, sg, sg -Go, sg -FullPreflight, sg -NoClaude, sg -NoCockpit, sgsd -Claude -Greet) resolve to source-of-truth definitions in Install-SgsdShortcut.ps1 + sgsd-boot.ps1."
    - "sgsd-boot.ps1 -NoOpen wall-time captured (3 runs, min/median/max)."
    - "sgsd-dashboard-host.ps1 Write-DashboardFailure + Hold-Pane statically verified across all three failure paths (resolve / clean-return / throw)."
    - "Mutex sgsd -Go -Greet rejected with exit=1 (smokeable, runs in <2s)."
    - "README BOOT-03 gap (no sg block in 'Starting the Cockpit' section) recorded with v1.7 backlog row."
    - "COCKPIT-ACCEPTANCE-EVIDENCE.md exists, 8 scenario rows present, each with evidence pointer (fixture path or live capture path)."
    - "Acceptance runner exits 0 when all 10 fixtures (4 reused + 6 new) pass against the production sgsd-mission-strip.ps1 lib."
  artifacts:
    - path: "super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md"
      provides: "8-scenario acceptance evidence + boot flag matrix + boot timing + dashboard host verification + BOOT-03 gap record"
      contains: "## Acceptance Scenario Matrix"
    - path: "super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1"
      provides: "Walks A1/A2/A4/A6/A7/A8 + reused F1/F4/F5/F6 (cross-references mission-strip fixtures dir); dot-sources production lib; asserts expected-output.txt match per fixture; exit=0 on pass."
    - path: "super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1"
      provides: "Static parse + smoke for the 7 documented flags + sgsd -Go -Greet mutex assertion."
    - path: "super-gsd/tests/cockpit-acceptance/measure-boot.ps1"
      provides: "3-run Measure-Command capture of sgsd-boot.ps1 -NoOpen wall-time; emits min/median/max."
    - path: "super-gsd/tests/cockpit-acceptance/fixtures/"
      provides: "6 new fixture dirs (A1, A2, A4, A6, A7, A8); each contains STATE.md + meta.json + expected-output.txt + scenario-specific data files."
    - path: "super-gsd/tests/cockpit-acceptance/README.md"
      provides: "Scenario-to-fixture mapping table; runner usage."
  key_links:
    - from: "super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1"
      to: "super-gsd/scripts/lib/sgsd-mission-strip.ps1"
      via: "dot-source the production lib + invoke Get-MissionStripState against materialised fixture project dirs"
    - from: "super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1"
      to: "super-gsd/tests/mission-strip/fixtures/F1, F4, F5, F6"
      via: "cross-dir reuse — same Materialise-Fixture pattern, fixtures resolved by literal A3-references-F4 path table"
    - from: "super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md"
      to: ".planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md"
      via: "Q1-Q8 contract source-of-truth — every scenario row cites the Q lane(s) it exercises"
tasks:
  - id: T1
    agent: sgsd-exec-test
    model: sonnet
    files_touched:
      - super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md
      - super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1
      - super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1
      - super-gsd/tests/cockpit-acceptance/measure-boot.ps1
      - super-gsd/tests/cockpit-acceptance/README.md
      - super-gsd/tests/cockpit-acceptance/fixtures/A1/
      - super-gsd/tests/cockpit-acceptance/fixtures/A2/
      - super-gsd/tests/cockpit-acceptance/fixtures/A4/
      - super-gsd/tests/cockpit-acceptance/fixtures/A6/
      - super-gsd/tests/cockpit-acceptance/fixtures/A7/
      - super-gsd/tests/cockpit-acceptance/fixtures/A8/
    input_contract:
      reads:
        - .planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/30-CONTEXT.md
        - .planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/30-RESEARCH.md
        - .planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md
        - .planning/milestones/COCKPIT-2.0-SCOPE.md
        - super-gsd/scripts/lib/sgsd-mission-strip.ps1
        - super-gsd/scripts/sgsd-boot.ps1
        - super-gsd/scripts/Install-SgsdShortcut.ps1
        - super-gsd/scripts/sgsd-dashboard-host.ps1
        - super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md
        - super-gsd/tests/mission-strip/run-mission-strip-fixtures.ps1
        - super-gsd/tests/mission-strip/fixtures/F1/meta.json
        - super-gsd/tests/mission-strip/fixtures/F4/meta.json
        - super-gsd/tests/mission-strip/fixtures/F5/expected-output.txt
        - super-gsd/tests/mission-strip/fixtures/F6/expected-output.txt
        - README.md
    output_contract:
      writes:
        - super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md
        - super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1
        - super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1
        - super-gsd/tests/cockpit-acceptance/measure-boot.ps1
        - super-gsd/tests/cockpit-acceptance/README.md
        - super-gsd/tests/cockpit-acceptance/fixtures/A1/* (5 files)
        - super-gsd/tests/cockpit-acceptance/fixtures/A2/* (5 files)
        - super-gsd/tests/cockpit-acceptance/fixtures/A4/* (5 files)
        - super-gsd/tests/cockpit-acceptance/fixtures/A6/* (5 files)
        - super-gsd/tests/cockpit-acceptance/fixtures/A7/* (6 files)
        - super-gsd/tests/cockpit-acceptance/fixtures/A8/* (5 files)
    hypothesis: "All 8 cockpit acceptance scenarios can produce evidence using the existing sgsd-mission-strip.ps1 lib without any source edits, by reusing 4 Phase 29 fixtures verbatim and adding 6 new fixture dirs that exercise the remaining scenarios. Boot script and dashboard host honor their documented contracts."
    falsifier: "If any of the 8 scenarios cannot be evidenced from the existing lib + fixture pattern, the v1.6 cockpit redesign has a gap — Phase 30 must escalate, not paper over. If sgsd-boot.ps1 -NoOpen exits non-zero or any of the 7 flag mappings is missing from Install-SgsdShortcut.ps1, BOOT-01 fails."
    stop_rule: "If a scenario requires lib edits to evidence, STOP and escalate to operator (per kill condition: no source edits in verification phase). If boot timing measurement reveals a regression vs v1.5 baseline (>2x slower), flag in evidence file and escalate."
    minimal_test: "powershell -NoProfile -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1; $LASTEXITCODE -eq 0"
    known_deadends:
      - "Do not edit sgsd-mission-strip.ps1 (Phase 29 closed it)."
      - "Do not edit sgsd-boot.ps1 (verification phase; flag refactor is v1.7+)."
      - "Do not edit Install-SgsdShortcut.ps1 (verification phase)."
      - "Do not edit sgsd-dashboard-host.ps1 (verification phase)."
      - "Do not edit README.md (BOOT-03 gap is recorded, not fixed — v1.7 docs work)."
      - "Do not introduce a new state file or new metric stream (DISCUSS 27.1 lock; KNOW-01 lock)."
      - "Do not collapse stale and unavailable in any expected-output.txt (DISCUSS 26.1)."
      - "Do not actually spawn Claude windows for -Claude / -Go / -Greet flags — static parse only."
      - "Do not assume VTP is required for any scenario (KNOW-01 forbids; A5 explicitly tests no-private-KB)."
      - "Do not unify the acceptance runner with the Phase 29 mission-strip runner — two runners is acceptable; consolidation is gilding (RESEARCH §7 defer condition)."
---

<objective>
Verify that v1.6 Cockpit 2.0 (Phases 26-29) and the existing startup surface
(`sg`, `sgsd`, `sgsd-boot.ps1`, `Install-SgsdShortcut.ps1`,
`sgsd-dashboard-host.ps1`) deliver what they contracted. Phase 30 ships **zero
source edits** — it produces evidence that backs the v1.6 milestone close.

Per DISCUSS 30.1 (locked), all 8 acceptance scenarios are mandatory. Fixture
evidence is permitted for the 3 hard cases (codex-timeout, codex-warned,
forced-restart). No live-only deferrals.

Output:
  - `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` — 8 scenario rows + boot
    flag matrix + boot timing + dashboard host verification + BOOT-03 gap row
  - 6 new deterministic fixture dirs (A1, A2, A4, A6, A7, A8) under
    `super-gsd/tests/cockpit-acceptance/fixtures/`
  - 3 PowerShell harness scripts: `run-acceptance-fixtures.ps1`,
    `verify-boot-flags.ps1`, `measure-boot.ps1`
  - `super-gsd/tests/cockpit-acceptance/README.md` — scenario-to-fixture map

This is the v1.6 acceptance gate. Closes the milestone.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/30-CONTEXT.md
@.planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/30-RESEARCH.md
@.planning/milestones/COCKPIT-2.0-SCOPE.md
@.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md
@super-gsd/scripts/lib/sgsd-mission-strip.ps1
@super-gsd/scripts/sgsd-boot.ps1
@super-gsd/scripts/Install-SgsdShortcut.ps1
@super-gsd/scripts/sgsd-dashboard-host.ps1
@super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md
@super-gsd/tests/mission-strip/run-mission-strip-fixtures.ps1
</context>

<interfaces>
<!-- Phase 28 lib API (LOCKED). Acceptance harness invokes against this. -->

```powershell
# super-gsd/scripts/lib/sgsd-mission-strip.ps1
function Get-MissionStripState {
    param(
        [Parameter(Mandatory = $true)] [string]$ProjectDir,
        [int]$ActivityTail = 500,
        [hashtable]$StateOverride = $null,
        [string]$PhaseOverride = $null
    )
    # returns [ordered]@{ mission, missionColor, objective, ..., codexAgents,
    #                    codexAgentsColor, ... }
}

function Render-MissionStrip { param($State) ... }
function _Truncate-Ascii { param([string]$Text, [int]$Max) }
```

<!-- Closed status vocabulary (DISCUSS 26.1; do NOT extend) -->
active, waiting, blocked, reviewing, timed-out, stale, complete, unavailable

<!-- Codex freshness bands (DISCUSS 26.2 + 29.1) -->
Δ <120s + state=running         -> active / "running"
Δ 120-3599s                      -> defer to state-field switch
Δ >=3600s                        -> stale (overrides state)

<!-- Generic source bands (DISCUSS 26.2) -->
Δ <30s                           -> active
30s <= Δ < 600s                  -> waiting
Δ >=600s                         -> stale

<!-- Phase 29 fixture pattern (mirror exactly in run-acceptance-fixtures.ps1) -->
- Per-fixture: meta.json (offsets), STATE.md, expected-output.txt, scenario data
- Materialise into temp project dir under $env:TEMP\sgsd-acceptance-{guid}
- Forge mtime via meta.json.codex_mtime_offset_sec / activity_mtime_offset_sec /
  heartbeat_mtime_offset_sec / crit_mtime_offset_sec / session_mtime_offset_sec
- Dot-source the production lib (Live-or-Local rule)
- Cleanup in `finally`
- ASCII-only literals (PS 5.1 mojibake guard)

<!-- Boot script flag matrix (sources of truth, lines from RESEARCH §2) -->
sgsd:        Install-SgsdShortcut.ps1 lines 109-178; sgsd-boot.ps1 param block 21-30
sg:          Install-SgsdShortcut.ps1 lines 180-216 (forwards to sgsd via $bootArgs)
mutex:       sgsd-boot.ps1 lines 37-42 (-Go -Greet rejected with exit=1)
help:        Install-SgsdShortcut.ps1 lines 123-139 (cheat sheet local to function)

<!-- Dashboard host failure contract (sgsd-dashboard-host.ps1 lines 27-68) -->
Write-DashboardFailure (33-51): Clear-Host + red banner + yellow title + gray detail
Hold-Pane (27-31): infinite Start-Sleep loop, no exit, Ctrl+C only
Three failure paths (53-68): resolve fail / clean return / render throw
Each path calls Write-DashboardFailure then Hold-Pane (no exit, no return)
</interfaces>

<tasks>

<task type="auto" id="T1">
  <name>Task 1: Produce 8-scenario acceptance evidence + boot/timing/host verifications + 6 fixtures</name>

  <files>
    super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md (created),
    super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1 (created),
    super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1 (created),
    super-gsd/tests/cockpit-acceptance/measure-boot.ps1 (created),
    super-gsd/tests/cockpit-acceptance/README.md (created),
    super-gsd/tests/cockpit-acceptance/fixtures/A1/{STATE.md, activity-log.jsonl, codex-live.json, meta.json, expected-output.txt} (created),
    super-gsd/tests/cockpit-acceptance/fixtures/A2/{STATE.md, crit-backlog.jsonl, codex-live.json, meta.json, expected-output.txt} (created),
    super-gsd/tests/cockpit-acceptance/fixtures/A4/{STATE.md, codex-live.json, codex-warn-report.md, meta.json, expected-output.txt} (created),
    super-gsd/tests/cockpit-acceptance/fixtures/A6/{STATE.md, activity-log.jsonl, codex-live.json, meta.json, expected-output.txt} (created),
    super-gsd/tests/cockpit-acceptance/fixtures/A7/{STATE.md, ORCHESTRATOR-CHECKPOINT.md, heartbeat.jsonl, codex-live.json, meta.json, expected-output.txt} (created),
    super-gsd/tests/cockpit-acceptance/fixtures/A8/{STATE.md, activity-log.jsonl, codex-live.json, meta.json, expected-output.txt} (created)
  </files>

  <action>
Single composite verification task. Six numbered sub-deliverables. Execute in order; each commit-step is independent so a failure mid-stream does not poison the rest.

**Step 1 — Scaffold the cockpit-acceptance test dir + write the 6 new fixtures (A1, A2, A4, A6, A7, A8).**

Mirror the Phase 29 fixture pattern verbatim (see `super-gsd/tests/mission-strip/fixtures/F1/`). Each fixture dir contains:

- `meta.json` — `{ "codex_mtime_offset_sec": ..., "activity_mtime_offset_sec": ..., "heartbeat_mtime_offset_sec": ..., "crit_mtime_offset_sec": ..., "note": "..." }` (only the offset fields the scenario needs)
- `STATE.md` — minimal frontmatter `milestone: v1.6\nphase: 30\n` (scenario-specific)
- scenario-specific data files (see per-fixture spec below)
- `expected-output.txt` — single line in the format `> codex <state>  > agents <state>` matching what `Get-MissionStripState` is expected to render via `Render-MissionStrip`'s codex+agents row

Per-fixture spec (RESEARCH §1 row mappings):

| Fixture | Scenario | Inputs | expected-output.txt |
|---------|----------|--------|---------------------|
| **A1** | active (normal SGSD work) | STATE.md (milestone v1.6 phase 30), activity-log.jsonl (1 row mtime Δ=10s with `phase:"30"` + `tool:"Edit"`), codex-live.json (state=ready, mtime Δ=60s), meta.json offsets | `> codex ready  > agents active` |
| **A2** | blocked-gate | STATE.md with frontmatter `blockers: [BLOCKER-01]`, crit-backlog.jsonl (1 row tagged `phase:"30"` not cleared, mtime Δ=300s), codex-live.json (state=ready, mtime Δ=60s) | `> codex ready  > agents --` (Q4 lane = blocked verified at codex-row level — agents row reflects no current-phase agent activity) |
| **A4** | codex-warned | STATE.md, codex-live.json (state=ready, `report_path:"codex-warn-report.md"`, `crit_count:0`, `warn_count:2`, mtime Δ=60s), codex-warn-report.md (≥3 lines containing `WARN:` literals), meta.json | `> codex ready  > agents --` (strip stays `ready` per Phase 28/29 — warn count surfaced in narrative pane, not strip; A4 is a smoke that the strip render does NOT degrade to a warn-bearing state) |
| **A6** | activity-stale | STATE.md, activity-log.jsonl (1 row, `phase:"30"`, mtime Δ=700s → stale band per generic source), codex-live.json (state=ready, mtime Δ=60s) | `> codex ready  > agents stale` |
| **A7** | forced-restart | STATE.md mid-phase, ORCHESTRATOR-CHECKPOINT.md (any non-empty body), heartbeat.jsonl (1 row, mtime Δ=700s → stale band), codex-live.json (state=ready, mtime Δ=60s) | `> codex ready  > agents --` (the strip does not directly surface Q8 = waiting; the verifier asserts that Get-MissionStripState includes a `nextAction` field whose text contains `ORCHESTRATOR-CHECKPOINT.md`. expected-output.txt is the codex+agents line; a secondary assertion file `expected-nextaction.txt` carries the Q8 substring `read .planning/ORCHESTRATOR-CHECKPOINT.md`) |
| **A8** | no-tool-event | STATE.md, activity-log.jsonl (1 row, `phase:"30"`, mtime Δ=300s → mid-band waiting), codex-live.json (state=ready, mtime Δ=60s) | `> codex ready  > agents waiting` |

A3 (codex-timeout) reuses Phase 29 `super-gsd/tests/mission-strip/fixtures/F4` by reference — no new dir.

A5 (no-private-KB) is captured live by `verify-boot-flags.ps1` step 6 below (NOT a fixture dir; it asserts boot-time text emission, which is a different surface from the strip render).

**Determinism rules** (inherited from Phase 29):

- ASCII-only literals.
- `meta.json` offsets are negative integers (seconds before "now"); the runner forges file mtimes deterministically via `(Get-Item $f).LastWriteTime = (Get-Date).AddSeconds($offset)`.
- No timestamp strings inside JSON content (the runner forges mtimes).
- Per-fixture temp project dir under `$env:TEMP\sgsd-acceptance-{guid}`, cleaned in `finally`.

**Step 2 — Write `run-acceptance-fixtures.ps1`.**

Modeled on `super-gsd/tests/mission-strip/run-mission-strip-fixtures.ps1` (which is the Phase 29 runner — see existing source for `Materialise-Fixture` / mtime-forge / Get-SharedActivityEntries stub patterns). Differences:

- Walks BOTH `cockpit-acceptance/fixtures/` (A1, A2, A4, A6, A7, A8) AND, by an explicit fixture path table, the four Phase 29 fixtures referenced by acceptance scenarios:
  ```powershell
  $reused = @(
    @{ Id = "A3"; Path = "..\mission-strip\fixtures\F4"; Scenario = "codex-timeout" }
    @{ Id = "F1-stale"; Path = "..\mission-strip\fixtures\F1"; Scenario = "codex-stale (re-asserted)" }
    @{ Id = "F5-base"; Path = "..\mission-strip\fixtures\F5"; Scenario = "codex-warned base" }
    @{ Id = "F6-unavail"; Path = "..\mission-strip\fixtures\F6"; Scenario = "codex-unavailable" }
  )
  ```
- For A2: dot-source `super-gsd/scripts/lib/crit-backlog.cjs` is NOT needed for strip-render assertion (Q4 blocked is read from STATE.md frontmatter by the lib); the crit-backlog.jsonl in A2 is for evidence-file tracing, not for the assertion.
- For A7: after invoking `Get-MissionStripState`, also read `$state.nextAction` (or whichever lib field surfaces Q8 text per Phase 28's contract) and assert it contains `ORCHESTRATOR-CHECKPOINT.md` (read substring from `expected-nextaction.txt` in A7 dir).
- Reports per-fixture PASS/FAIL with the produced vs expected line, and a final summary `acceptance: 10/10 PASS` (or N/10 with failure detail).
- Exit code 0 only if all 10 pass.

**Step 3 — Write `verify-boot-flags.ps1`.**

Static parse + safe smoke for the 7 flags + mutex. Reads `Install-SgsdShortcut.ps1` and `sgsd-boot.ps1` line content via `Get-Content`. Asserts:

| Check | Source-of-truth | Assertion |
|-------|-----------------|-----------|
| C1 | Install-SgsdShortcut.ps1 lines 109-178 | `sgsd` function declares `param([switch]$NoOpen, [switch]$SkipPreflight, [switch]$Bootstrap, [switch]$Backfill, [switch]$Claude, [switch]$Go, [switch]$Greet, [switch]$Help, [string]$ProjectDir = '.')` (regex match — order tolerant) |
| C2 | Install-SgsdShortcut.ps1 lines 180-216 | `sg` function declares `param([switch]$FullPreflight, [switch]$Go, [switch]$NoCockpit, [switch]$NoClaude, [string]$ProjectDir = '.')` |
| C3 | sgsd-boot.ps1 param block 21-30 | each `sgsd` flag from C1 (except `-Help`, which is local to the function) appears in the boot script param block |
| C4 | sgsd-boot.ps1 lines 37-42 | mutex check `-Go -Greet` rejection block exists; regex `if\s*\(\$Go\s*-and\s*\$Greet\)` matches |
| C5 | live smoke | `& powershell -NoProfile -File super-gsd\scripts\sgsd-boot.ps1 -NoOpen -SkipPreflight -ProjectDir .` exits 0; stdout contains `NoOpen flag set` literal |
| C6 | live smoke | `& powershell -NoProfile -File super-gsd\scripts\sgsd-boot.ps1 -NoOpen -ProjectDir .` exits 0; stdout contains `Private knowledge bank optional; fallback=` (this is the A5 no-private-KB scenario evidence — captured here, not as a fixture) |
| C7 | live smoke (mutex) | `& powershell -NoProfile -File super-gsd\scripts\sgsd-boot.ps1 -NoOpen -Go -Greet 2>&1`; assert `$LASTEXITCODE -eq 1` |
| C8 | static parse | `Install-SgsdShortcut.ps1 lines 123-139` `if ($Help)` cheat sheet block lists every flag from C1 (regex `-NoOpen|-SkipPreflight|-Bootstrap|-Backfill|-Claude|-Go|-Greet|-Help`) |
| C9 | static parse | `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md` Command Cheat Sheet section (lines 79-94) contains rows for every flag combination (`sgsd`, `sg`, `sg -Go`, `sg -FullPreflight`, `sg -NoClaude`, `sg -NoCockpit`, `sgsd -Claude -Greet`) |

Claude-spawning flags (`-Claude`, `-Go`, `-Greet`) are **static-parse only**; never spawn a real Claude window. The mutex check (C7) IS smokeable because boot.ps1 exits before reaching Claude spawn.

Emits one line per check `C{N}: PASS|FAIL: <detail>`. Exit 0 if all PASS. Captures the C5+C6 stdout into `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` evidence section (passed via `-EvidenceFile` param).

**Step 4 — Write `measure-boot.ps1`.**

```powershell
$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Path) "..\..\..")
$boot = Join-Path $repoRoot "super-gsd\scripts\sgsd-boot.ps1"

$runs = 1..3 | ForEach-Object {
    $ms = (Measure-Command {
        & powershell.exe -NoProfile -File $boot -NoOpen -ProjectDir $repoRoot 2>&1 | Out-Null
    }).TotalMilliseconds
    [pscustomobject]@{ Run = $_; Ms = [int]$ms }
}

$min = ($runs | Measure-Object Ms -Minimum).Minimum
$max = ($runs | Measure-Object Ms -Maximum).Maximum
$median = (($runs | Sort-Object Ms)[1]).Ms

Write-Host "boot timing (sgsd-boot.ps1 -NoOpen, 3 runs): min=${min}ms median=${median}ms max=${max}ms"
$runs | Format-Table | Out-String | Write-Host
```

Exit 0. The runner does not gate on absolute timing values — it just records. The COCKPIT-ACCEPTANCE-EVIDENCE.md author reads `min/median/max` and pastes verbatim into the timing section.

**Step 5 — Verify `sgsd-dashboard-host.ps1` failure pane (static read).**

In `verify-boot-flags.ps1` (or a dedicated short helper inline in the evidence file build), assert:

- `Clear-Host` literal present in `Write-DashboardFailure` body (lines 33-51).
- `Hold-Pane` is called from each of the three failure paths (count of `Hold-Pane` invocation lines == 3, NOT counting the function definition line itself).
- No `exit` or `return` statement appears between `Write-DashboardFailure` and `Hold-Pane` in any of the three paths.
- `while ($true) { Start-Sleep -Seconds 3600 }` literal present in `Hold-Pane` body.

Static-only. The optional live failure smoke (RESEARCH §4) is OPT-IN; if attempted, capture only "process started, banner verified, terminated" — do not embed a screenshot.

**Step 6 — Audit README.md BOOT-03 gap.**

Static read of `README.md` "Starting the Cockpit" section (lines 309-322 per RESEARCH §5). Assert via grep:

- ❌ `^\s*sg\s` literal absent (no `sg` daily-command form documented)
- ❌ `sgsd-boot.ps1 -NoOpen` literal absent
- ❌ `sgsd-boot.ps1.*-FullPreflight` literal absent
- ✅ legacy `powershell -File super-gsd/scripts/sgsd-boot.ps1` form present (line 313)
- ✅ no VTP-required language present (no `vtp-kb` literal making it sound mandatory)

Result: README is **partially compliant** with BOOT-03 — no VTP-required language (compliant), but no `sg` daily-command (gap). Record this gap in COCKPIT-ACCEPTANCE-EVIDENCE.md "## BOOT-03 README Audit" section with the verbatim text from RESEARCH §5 ("Specific gap to record"). File as v1.7 docs backlog row in the same evidence file. **Do NOT edit README** (verification phase rule).

**Step 7 — Compose `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md`.**

Required sections (in order):

1. **Frontmatter** — `phase: 30`, `created: <ISO date>`, `discuss_decisions: [30.1]`, `closes: v1.6`.
2. **Summary** — 1-paragraph: "Phase 30 is the v1.6 acceptance gate. All 8 cockpit scenarios produce evidence (4 reused F1/F4/F5/F6, 6 new A1/A2/A4/A6/A7/A8, A5 captured by boot stdout). Boot script flag matrix verified. Boot timing captured. Dashboard host failure pane statically verified. BOOT-03 README gap recorded for v1.7."
3. **Acceptance Scenario Matrix** — 8 rows (active, blocked-gate, codex-timeout, codex-warned, no-private-KB, stale-data, forced-restart, no-tool-event). Each row: `| # | Scenario | Mode (live/fixture) | Evidence Path | Q lanes exercised | Result |`. Cite Q lanes from the Phase 26 contract (e.g., active → Q1, Q2, Q5, Q6, Q8).
4. **Boot Flag Verification Matrix** — 7 flag rows + mutex row. Each row: `| Flag | Source-of-truth lines | Smoke result | Static-parse result |`. PASTE C1-C9 results from `verify-boot-flags.ps1`.
5. **Boot Timing** — single line `boot timing (sgsd-boot.ps1 -NoOpen, 3 runs): min=Nms median=Nms max=Nms`. Pasted from `measure-boot.ps1` stdout.
6. **Dashboard Host Verification (BOOT-04)** — bullet list of 4 static assertions (Clear-Host present, Hold-Pane count = 3, no exit/return between, infinite-loop literal present). Each PASS/FAIL.
7. **BOOT-03 README Audit** — verbatim gap text from RESEARCH §5 + 1-line v1.7 backlog row.
8. **Backlog (deferred to v1.7)** — table with at minimum: BOOT-03 README quick-start, plus any Codex live-auth row if encountered (per RESEARCH §7 expected pattern).
9. **Phase Close Summary** — 1 line: `v1.6 acceptance: PASS-WITH-DEFERRED-N (N=<count of backlog rows>)`. Lists the deferred IDs.

**Step 8 — Write `super-gsd/tests/cockpit-acceptance/README.md`.**

5-section short doc:
- **Purpose**: 8-scenario cockpit acceptance harness for v1.6 close.
- **Layout**: dir tree showing `fixtures/A1..A8/` + the 3 harness scripts.
- **Scenario → Fixture mapping table**: 8 rows mapping COCKPIT-2.0-SCOPE.md scenario name to fixture id (A1, A2, F4 (reused), A4, captured-by-boot-flags, A6 + F1, A7, A8).
- **Run**: `powershell -NoProfile -File run-acceptance-fixtures.ps1` (also: `verify-boot-flags.ps1`, `measure-boot.ps1`).
- **Determinism rules**: same as Phase 29 (mtime forge, ASCII-only, temp dir cleanup).

**Order of execution within T1**: Steps 1, 2, 8, 4, 3, 5, 6, 7 (write fixtures + runner + README first; capture timing + boot-flags + dashboard verifications next; compose evidence file LAST since it consumes outputs from steps 3-6).

**No source edits.** This task creates only evidence + harness + fixtures + docs. If any sub-deliverable encounters a need to edit `sgsd-boot.ps1`, `sgsd-mission-strip.ps1`, `sgsd-dashboard-host.ps1`, `Install-SgsdShortcut.ps1`, or `README.md` — STOP and escalate (kill condition).
  </action>

  <verify>
    <automated>powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1; if ($LASTEXITCODE -ne 0) { exit 1 }; powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1; if ($LASTEXITCODE -ne 0) { exit 1 }; powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/tests/cockpit-acceptance/measure-boot.ps1; if ($LASTEXITCODE -ne 0) { exit 1 }; if (-not (Test-Path super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md)) { exit 1 }; $ev = Get-Content super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md -Raw; if ($ev -notmatch '## Acceptance Scenario Matrix' -or $ev -notmatch '## Boot Flag Verification Matrix' -or $ev -notmatch '## Boot Timing' -or $ev -notmatch '## Dashboard Host Verification' -or $ev -notmatch '## BOOT-03') { exit 1 }; exit 0</automated>
  </verify>

  <done>
- `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` exists with all 9 sections (Frontmatter, Summary, Acceptance Scenario Matrix [8 rows], Boot Flag Verification Matrix [7 flags + mutex], Boot Timing [min/median/max line], Dashboard Host Verification [4 BOOT-04 assertions], BOOT-03 README Audit [verbatim gap + v1.7 backlog row], Backlog [deferred-to-v1.7 table], Phase Close Summary [PASS-WITH-DEFERRED-N line]).
- 6 new fixture dirs (A1, A2, A4, A6, A7, A8) exist under `super-gsd/tests/cockpit-acceptance/fixtures/` with the file inventory specified in `files_modified`.
- `run-acceptance-fixtures.ps1` exits 0; reports `acceptance: 10/10 PASS` (4 reused + 6 new).
- `verify-boot-flags.ps1` exits 0; all 9 checks (C1-C9) pass.
- `measure-boot.ps1` exits 0; emits 1-line `boot timing (sgsd-boot.ps1 -NoOpen, 3 runs): min=Nms median=Nms max=Nms`.
- `super-gsd/tests/cockpit-acceptance/README.md` exists with scenario-to-fixture mapping.
- Zero edits to `sgsd-boot.ps1`, `sgsd-mission-strip.ps1`, `sgsd-dashboard-host.ps1`, `Install-SgsdShortcut.ps1`, `README.md` (verified by `git diff --stat HEAD` showing no modifications to those paths).
- All 8 scenarios from COCKPIT-2.0-SCOPE.md lines 219-228 appear in the evidence matrix with non-empty Evidence Path column.
  </done>
</task>

</tasks>

<verification>
**Phase-level acceptance checks** (run AFTER T1 completes; the verifier collects these into `30-VERIFICATION.md`):

1. `test -f super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` (evidence file exists)
2. `grep -E '^### A[12468]\b|^### A3 \(reuses F4\)|^### A5' super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md | wc -l` ≥ 8 (all 8 scenarios documented; A3 reuses F4, A5 captured by boot)
3. `grep -c '^| \(sgsd\|sg \)' super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` ≥ 7 (boot flag matrix has all 7 documented flags)
4. `grep -E 'min=[0-9]+ms median=[0-9]+ms max=[0-9]+ms' super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` matches (boot timing line present)
5. `grep -q 'BOOT-03' super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` (README gap recorded)
6. `powershell -NoProfile -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` exits 0 (10/10 fixtures pass)
7. `powershell -NoProfile -File super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1` exits 0 (9/9 boot flag checks pass)
8. `git diff --stat HEAD~1 super-gsd/scripts/sgsd-boot.ps1 super-gsd/scripts/lib/sgsd-mission-strip.ps1 super-gsd/scripts/sgsd-dashboard-host.ps1 super-gsd/scripts/Install-SgsdShortcut.ps1 README.md` shows zero changes (no source edits made)
9. `ls super-gsd/tests/cockpit-acceptance/fixtures/ | wc -l` = 6 (A1, A2, A4, A6, A7, A8 — A3 references F4, no own dir; A5 has no fixture)
10. `grep -q 'PASS-WITH-DEFERRED' super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` (phase close summary line present)
11. `grep -c '^| Q[1-8]' super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` ≥ 8 OR each scenario row's "Q lanes exercised" column cites at least one Q-lane reference (Phase 26 traceability)

Each phase-level check that fails surfaces in `30-VERIFICATION.md` Goal-Backward checks. Failures here close phase as `FAIL`, not `PASS-WITH-DEFERRED-N` (per kill conditions).
</verification>

<success_criteria>
- All 8 cockpit acceptance scenarios produce evidence; none deferred (DISCUSS 30.1 lock honored).
- All 7 documented `sg`/`sgsd` boot flags resolved to source-of-truth definitions; mutex sgsd `-Go -Greet` smokes to exit=1.
- `sgsd-boot.ps1 -NoOpen` wall-time captured (3 runs, min/median/max).
- Dashboard host failure pane statically verified — 3 paths, all call `Hold-Pane`, no exit/return between.
- BOOT-03 README gap recorded; v1.7 docs backlog row filed (no README edit in Phase 30).
- 10-fixture acceptance runner exits 0 (4 reused F1/F4/F5/F6 + 6 new A1/A2/A4/A6/A7/A8).
- `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` complete with all 9 sections.
- Zero source edits to `sgsd-boot.ps1`, `sgsd-mission-strip.ps1`, `sgsd-dashboard-host.ps1`, `Install-SgsdShortcut.ps1`, or `README.md` (verification phase rule).
- v1.6 milestone closes `PASS-WITH-DEFERRED-N` where N includes BOOT-03 README + any Codex live-auth row + any MUDA WARN row (per anticipated taxonomy in CONTEXT §"Status taxonomy at close").
</success_criteria>

<output>
After completion, create `.planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/30-01-SUMMARY.md` per the standard summary template, with explicit pointers to:
- `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` (the acceptance package)
- `super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` (the runner)
- The 6 new fixture dirs
- The boot-timing line (min/median/max ms)
- The BOOT-03 v1.7 docs backlog row.

The verifier (Step 8 of phase) reads `30-01-SUMMARY.md` to compose `30-VERIFICATION.md`, which itself becomes input to the v1.6 milestone close artifact.
</output>
