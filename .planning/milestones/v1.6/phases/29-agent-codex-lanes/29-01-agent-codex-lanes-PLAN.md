---
schema_version: 2
phase: 29
plan: 01
title: Agent + Codex Visibility Lanes — Audit + Hardening
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/scripts/lib/sgsd-mission-strip.ps1
  - super-gsd/scripts/tests/sgsd-mission-strip.fixtures.ps1
  - super-gsd/scripts/tests/run-mission-strip-fixtures.ps1
autonomous: true
requirements:
  - REQ-29-Q5
  - REQ-29-Q5-EMPTY
  - REQ-29-Q5-SCOPE
  - REQ-29-Q6
  - REQ-29-Q6-STALE
  - REQ-29-Q6-LINK
locked_decisions:
  - "DISCUSS 29.1: Codex stale at >=3600s mtime, overrides state field"
  - "DISCUSS 29.2: agents pane = current-phase only, /^[0-9]+$/ guard on row.phase"
  - "Phase 28 lib API locked — edits must fit inside Get-MissionStripState signature"
must_haves:
  truths:
    - "Lib explicitly rejects row.phase that fails ^[0-9]+$ (Phase 27 §Stamping rule 8 defense)"
    - "Codex default-branch label is truncated to 20 chars (cannot blow strip width)"
    - "Codex `not-fired|^idle$` regex is anchored as `^(not-fired|idle)$` (no false-prefix matches)"
    - "12 fixtures pass deterministically without network or live metric files"
    - "Q5 stale-band, current-phase scope, and corrupt-phase rejection are exercised by fixtures"
  artifacts:
    - path: "super-gsd/scripts/lib/sgsd-mission-strip.ps1"
      provides: "3 surgical hardening edits (≤30 line diff)"
      contains: "rowPhase -notmatch '^[0-9]+$'"
    - path: "super-gsd/scripts/tests/sgsd-mission-strip.fixtures.ps1"
      provides: "12 fixture scenarios F1-F12 covering Q5+Q6 lanes"
    - path: "super-gsd/scripts/tests/run-mission-strip-fixtures.ps1"
      provides: "Smoke-test entry point — runs all fixtures, exits non-zero on failure"
  key_links:
    - from: "run-mission-strip-fixtures.ps1"
      to: "sgsd-mission-strip.ps1"
      via: "dot-source the lib + invoke Get-MissionStripState against fixture project dirs"
---

<objective>
Audit and harden the Phase 28 Mission Strip lib for the Q5 (agents) and Q6
(codex) lanes. Apply 3 surgical edits identified by RESEARCH (≤30-line total
diff) and add 12 deterministic fixture-based tests. Phase 28 already shipped
the structural lib — this plan does NOT redesign it.

Purpose: honor DISCUSS 29.1 (1h codex stale) + 29.2 (current-phase agent
scope) defensively, and lock the contract behind reproducible fixtures so
future regressions surface immediately.

Output:
  - Hardened `sgsd-mission-strip.ps1` (3 edits, ≤30 lines diff)
  - `sgsd-mission-strip.fixtures.ps1` — 12 fixture scenarios (F1-F12)
  - `run-mission-strip-fixtures.ps1` — smoke entry point
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/milestones/v1.6/phases/29-agent-codex-lanes/29-CONTEXT.md
@.planning/milestones/v1.6/phases/29-agent-codex-lanes/29-RESEARCH.md
@.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md
@.planning/milestones/v1.6/phases/27-cockpit-data-tree/27-01-cockpit-data-contract-PLAN.md
@super-gsd/scripts/lib/sgsd-mission-strip.ps1
</context>

<interfaces>
<!-- Locked Phase 28 lib API — edits must fit inside this signature -->

```powershell
function Get-MissionStripState {
    param(
        [Parameter(Mandatory = $true)] [string]$ProjectDir,
        [int]$ActivityTail = 500,
        [hashtable]$StateOverride = $null,
        [string]$PhaseOverride = $null
    )
    # returns [ordered]@{ mission, missionColor, objective, ..., codexAgents, codexAgentsColor, ... }
}

function Render-MissionStrip { param($State) ... }   # 6 Write-Host rows, host owns $CLEAR_LINE
function _Truncate-Ascii { param([string]$Text, [int]$Max) }  # ASCII-safe trunc with `~` marker
```

Closed status vocabulary (DISCUSS 26.1, do NOT extend):
  active, waiting, blocked, reviewing, timed-out, stale, complete, unavailable

Codex freshness bands (DISCUSS 26.2 + 29.1):
  Δ <120s + state=running          -> active / "running"
  Δ 120-3599s                       -> defer to state-field switch
  Δ >=3600s                         -> stale (overrides state)

Q5 row-shape (activity-log.jsonl entry):
  { ts, tool, target, subagent_type, phase, ... }   # phase MUST match ^[0-9]+$
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Apply 3 surgical hardening edits to sgsd-mission-strip.ps1</name>
  <files>super-gsd/scripts/lib/sgsd-mission-strip.ps1</files>

  <behavior>
    Edit 1 (Q5 defensive guard) — RESEARCH §"Q5 gaps inventory" line 160:
      AFTER  current line 200 (`if (-not $rowPhase) { continue }`)
      INSERT line 201: `if ($rowPhase -notmatch '^[0-9]+$') { continue }`
      WHY: honors Phase 27 §Stamping Spec rule 8 (consumer-side mandate).
           Defense-in-depth — without it, a future regression that corrupts
           STATE.md's phase value would silently break Q5 scoping.

    Edit 2 (Q6 default-branch truncation) — RESEARCH §"Q6 gaps inventory":
      MODIFY current line 282 (`default { $codexState = "waiting"; $codexLabel = $rawState }`)
      TO:    `default { $codexState = "waiting"; $codexLabel = (_Truncate-Ascii $rawState 20) }`
      WHY: a malformed `state` field in codex-live.json (e.g., a 200-char
           error tail) cannot blow out the strip width. The 20-char cap
           leaves room for the surrounding `> codex {label}  > agents ...`
           framing within the standard 80-col strip budget.

    Edit 3 (Q6 not-fired|idle anchoring) — RESEARCH §"Q6 gaps inventory":
      MODIFY current line 281 regex `'not-fired|^idle$'`
      TO:    `'^(not-fired|idle)$'`
      WHY: symmetry with neighbor branches (lines 276-280). Prevents
           future `not-fired-yet` or `idle-pending` from accidentally
           matching the `not-fired` half of the alternation.

    Behavioral fixtures (validated by Task 2):
      - F1 (codex stale, Δ=3700s, state=running)   -> "> codex stale"      DarkGray
      - F7 (codex unknown, state="frobnicated"x10) -> "> codex frobnicated~" (truncated)
      - F9 (Q5 corrupt phase=`"\"29\":"`, active=29) -> agents="--" (row REJECTED)
  </behavior>

  <action>
    Apply EXACTLY the three edits above to `super-gsd/scripts/lib/sgsd-mission-strip.ps1`.

    Constraints (hard limits — exceed = STOP and escalate):
      - Total diff ≤30 lines (research budget; the edits themselves are ~3 lines)
      - No new functions, no new parameters on Get-MissionStripState
      - No new metric streams, no new file reads
      - ASCII-only literals (PS 5.1 mojibake guard)
      - Do NOT touch Q1, Q2, Q3, Q4, Q8 logic — Q5/Q6 only
      - Do NOT modify Render-MissionStrip or _Truncate-Ascii signatures
      - Do NOT add report_path / duration / verdict to the strip (pane-vs-strip split)

    After editing, run `git diff --stat super-gsd/scripts/lib/sgsd-mission-strip.ps1`
    and confirm the line count is within budget. If it exceeds 30 lines, revert
    and escalate per RESEARCH §"Kill / Defer Conditions" row "lib edits exceed ~10 lines".
  </action>

  <verify>
    <automated>cd "$PWD" && git diff --stat super-gsd/scripts/lib/sgsd-mission-strip.ps1 | tail -1 | grep -E "[0-9]+ insertion" && powershell.exe -NoProfile -Command ". super-gsd/scripts/lib/sgsd-mission-strip.ps1; if ((Get-Command Get-MissionStripState -ErrorAction SilentlyContinue) -and (Get-Command _Truncate-Ascii -ErrorAction SilentlyContinue)) { 'LIB-OK' } else { throw 'LIB-BROKEN' }"</automated>
  </verify>

  <done>
    - `git diff --stat` reports ≤30 line insertions on the lib
    - Lib dot-sources cleanly under PowerShell 5.1 (no parse errors)
    - All three function exports (Get-MissionStripState, Render-MissionStrip, _Truncate-Ascii) still resolve
    - `grep -n "rowPhase -notmatch"` finds the Q5 guard
    - `grep -n "_Truncate-Ascii \$rawState 20"` finds the Q6 default-branch cap
    - `grep -n "'\\^(not-fired|idle)\\$'"` finds the anchored regex
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add 12-fixture deterministic test scaffold + smoke entry point</name>
  <files>super-gsd/scripts/tests/sgsd-mission-strip.fixtures.ps1, super-gsd/scripts/tests/run-mission-strip-fixtures.ps1</files>

  <behavior>
    `sgsd-mission-strip.fixtures.ps1` defines `Invoke-MissionStripFixture`
    which builds a temp project dir under `$env:TEMP\sgsd-fixture-{guid}\`,
    seeds the requested files, dot-sources the lib, calls
    `Get-MissionStripState`, asserts on the returned hashtable, and tears
    down the temp dir.

    Each fixture writes ONLY the files it cares about under
    `.planning/STATE.md` + `.planning/metrics/{codex-live.json,activity-log.jsonl}`.
    No live-data dependency — Patch 4 Live-or-Local rule.

    The 12 fixtures (RESEARCH §"Required test fixtures" rows F1-F12):

    | Fixture | Inputs                                                          | Expected codexAgents string                          |
    |---------|------------------------------------------------------------------|------------------------------------------------------|
    | F1  Q6  | codex-live mtime=now-3700s, state=running, active=29             | `> codex stale  > agents --`                         |
    | F2  Q6  | mtime=now-30s, state=running, active=29                          | `> codex running  > agents --`                       |
    | F3  Q6  | mtime=now-200s, state=reviewing                                  | `> codex reviewing  > agents --`                     |
    | F4  Q6  | mtime=now-200s, state=timeout                                    | `> codex timed-out  > agents --`                     |
    | F5  Q6  | mtime=now-200s, state=ok                                         | `> codex ready  > agents --`                         |
    | F6  Q6  | codex-live.json absent                                           | `> codex --  > agents --`                            |
    | F7  Q6  | mtime=now-200s, state=frobnicated-but-very-long-error-tail-here  | `> codex frobnicated-but-very~  > agents --` (20+1=truncated to 20) |
    | F8  Q5  | activity-log rows for phases 26,27,28,29 mixed; active=29        | `> codex --  > agents <only-29-agents>`              |
    | F9  Q5  | row with phase=`"\"29\":"` (corrupt); active=29                   | `> codex --  > agents --`  (row REJECTED by guard)   |
    | F10 Q5  | active=99, no rows match                                         | `> codex --  > agents --`                            |
    | F11 Q5  | 5 rows same agent slug for phase 29; active=29                   | `> codex --  > agents <slug>` (deduped to 1)         |
    | F12 Q5  | 30 unique agents, all phase=29, active=29                        | agents portion truncated to 60 chars + `~`           |

    `run-mission-strip-fixtures.ps1` is the smoke entry point:
      - dot-sources `sgsd-mission-strip.fixtures.ps1`
      - dot-sources `super-gsd/scripts/lib/sgsd-mission-strip.ps1`
      - dot-sources the shared activity cache (provides `Get-SharedActivityEntries`).
        If the cache is unavailable, define a minimal stub that reads JSONL
        directly with the same return shape — fixtures must run offline.
      - Iterates F1-F12; prints `[PASS] Fx` or `[FAIL] Fx <expected> != <actual>`
      - Exits 0 on all-pass, exits 1 on any fail
      - Total runtime <10s on Windows PS5.1
  </behavior>

  <action>
    Create the two files. Implementation guidance:

    1. Use `Set-ItemProperty -Path $codexLivePath -Name LastWriteTime -Value (Get-Date).AddSeconds(-3700)`
       to forge mtime deterministically. Verify with `(Get-Item $path).LastWriteTime`.

    2. For F8/F9/F11/F12, write activity-log rows as JSONL — one JSON object
       per line with `{ts, tool, target, subagent_type, phase}`. Keep ts close
       to `Get-Date` so Q1 model state is irrelevant — fixtures only assert on
       `$state.codexAgents`, not `$state.model`.

    3. F7 expected behavior: `_Truncate-Ascii "frobnicated-but-very-long-error-tail-here" 20`
       returns first 19 chars + `~`. Compute the exact expected string in the
       fixture (e.g., `"frobnicated-but-ver~"`) — do NOT regex-match, exact-match.

    4. F9 corrupt row: write JSONL line literally containing
       `"phase":"\"29\":"` (escaped quote, colon). The new Q5 guard at
       `^[0-9]+$` MUST reject it even though string-contains "29".

    5. STATE.md fixture: write minimal frontmatter:
       ```
       ---
       milestone: "v1.6"
       phase: "29"
       milestone_status: "active"
       ---
       ```
       Phase number per fixture; F10 uses phase=99.

    6. No mocks of `Get-SharedActivityEntries` are needed if the cache lib
       is dot-sourced — but if it's unavailable (e.g., not yet exported in
       a separate file), define a 5-line stub:
       ```powershell
       function Get-SharedActivityEntries {
         param([string]$Path, [int]$Tail = 500)
         if (-not (Test-Path $Path)) { return @() }
         Get-Content -Tail $Tail $Path | ForEach-Object {
           try { $_ | ConvertFrom-Json -ErrorAction Stop } catch { $null }
         } | Where-Object { $_ -ne $null }
       }
       ```

    7. `run-mission-strip-fixtures.ps1` MUST exit non-zero on any failure
       so CI / per-dispatch ATC catches regressions.

    Constraints:
      - ASCII-only string literals (PS 5.1)
      - Deterministic — no network, no live `.planning/metrics/*` reads
      - <10s wall-clock total
      - Each fixture cleans up its temp dir in a `finally` block
  </action>

  <verify>
    <automated>powershell.exe -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/tests/run-mission-strip-fixtures.ps1</automated>
  </verify>

  <done>
    - `run-mission-strip-fixtures.ps1` exits 0
    - All 12 fixtures print `[PASS] Fx`
    - No temp dirs leak under `$env:TEMP\sgsd-fixture-*` after run
    - Total runtime <10s
    - Re-running with Edit 1 reverted (commented out) causes F9 to FAIL
      (proves the guard is exercised — record this as evidence in SUMMARY)
    - Re-running with Edit 2 reverted causes F7 to FAIL
    - Both reverts must NOT be committed; only used as one-shot verification
  </done>
</task>

</tasks>

<verification>
Phase-level checks (run after both tasks land):

1. Lib hardening landed AND constrained:
   ```bash
   git diff --stat super-gsd/scripts/lib/sgsd-mission-strip.ps1 | tail -1
   # expect: "1 file changed, N insertions(+), M deletions(-)" with N+M ≤ 30
   ```

2. All 3 edits present in source:
   ```bash
   grep -nE "rowPhase -notmatch '\^\[0-9\]\+\$'|_Truncate-Ascii \$rawState 20|\^\(not-fired\|idle\)\$" super-gsd/scripts/lib/sgsd-mission-strip.ps1
   # expect: 3 hits
   ```

3. Fixture suite green:
   ```bash
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File super-gsd/scripts/tests/run-mission-strip-fixtures.ps1
   echo "exit=$?"
   # expect: exit=0, "[PASS] F1" through "[PASS] F12"
   ```

4. Live cockpit still renders (no parse regression):
   ```bash
   powershell.exe -NoProfile -Command ". super-gsd/scripts/lib/sgsd-mission-strip.ps1; \$s = Get-MissionStripState -ProjectDir '.'; if (\$s.codexAgents -match '^> codex .+  > agents .+$') { 'STRIP-OK' } else { throw 'STRIP-BROKEN' }"
   ```

5. No drift into out-of-scope areas:
   ```bash
   git diff --stat | grep -vE "(sgsd-mission-strip\.ps1|tests/.*\.ps1|29-01-.*PLAN\.md|29-.*SUMMARY\.md|STATE\.md|ROADMAP-AGENT\.md)" && echo "FAIL: out-of-scope file changed" || echo "SCOPE-OK"
   ```
</verification>

<success_criteria>
- Lib diff ≤30 lines, all 3 RESEARCH-named edits applied
- 12 fixtures pass deterministically and offline
- Reverting Edit 1 fails F9; reverting Edit 2 fails F7 (proves coverage)
- No edits to `sgsd-codex-monitor.ps1` (pane-vs-strip split honored)
- No new metric streams, no new lib parameters
- DISCUSS 29.1 + 29.2 explicitly traced through the new guard (per D-29.1, D-29.2)
- Phase 28 deferred row #9 (deployed hook re-install) carries forward — Phase 29
  does NOT close it (it's an operator runtime step, RESEARCH §"Out of scope")
- Anticipated phase status: PASS-WITH-DEFERRED-1 (carry Phase 28 row #9)
</success_criteria>

<per_dispatch_atc_scope>
Per CLAUDE.md per-dispatch ATC contract:
- T1 produces 1 commit on `sgsd-mission-strip.ps1` (≤30 line diff). ATC tier: LITE.
- T2 produces 1 commit creating 2 new test files. ATC tier: FULL (new files).
- Expected Codex-unavailable backlog rows: 1-2 (matches Phase 26-28 pattern).
- No GATE-tier changes (no new dependencies, no architecture, no API).
</per_dispatch_atc_scope>

<output>
After completion, create `.planning/milestones/v1.6/phases/29-agent-codex-lanes/29-01-SUMMARY.md`
with: files changed, exact diff stats, all 12 fixture pass/fail results, evidence
of revert-failure proof (F9 + F7), and any deferred rows carried forward.
</output>
