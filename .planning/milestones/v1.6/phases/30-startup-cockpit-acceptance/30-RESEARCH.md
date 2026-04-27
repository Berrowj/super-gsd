# Phase 30: Startup Verification + Cockpit Acceptance — Research

**Researched:** 2026-04-26
**Domain:** verification-only phase (no source edits) closing v1.6
**Confidence:** HIGH

---

## Summary

Phase 30 is the v1.6 acceptance gate. It does **not** ship code. It produces evidence
that (a) Cockpit 2.0 (Phases 26–29) answers all 8 operator questions across all 8
acceptance scenarios from `COCKPIT-2.0-SCOPE.md`, and (b) the existing startup
surface (`sg`, `sgsd`, `sgsd-boot.ps1`, `Install-SgsdShortcut.ps1`,
`sgsd-dashboard-host.ps1`) behaves as documented.

DISCUSS 30.1 (locked): all 8 scenarios mandatory; fixture-based evidence permitted
for the 3 hard cases (codex-timeout, forced-restart, codex-warned); no
"live-only deferral" — every scenario produces evidence.

The Phase 29 fixture suite (F1–F12, runner at
`super-gsd/tests/mission-strip/run-mission-strip-fixtures.ps1`) already exercises
4 of the 8 acceptance scenarios end-to-end against the production lib, which
makes Phase 30's planning straightforward: reuse F1/F4/F5/F6 directly, add 4 new
fixture dirs (or live captures) for the remaining scenarios, run the boot-flag
matrix as static-parse + smoke, capture timings, and write 30-VERIFICATION.md.

**Primary recommendation:** Reuse Phase 29 fixtures F1/F4/F5/F6 verbatim for 4 of
the 8 scenarios; introduce 4 new fixture dirs (F13–F16 or A1–A4) under
`super-gsd/tests/cockpit-acceptance/` for active, blocked-gate, forced-restart,
no-tool-event; run `sgsd-boot.ps1 -NoOpen` once with `Measure-Command` to capture
timing; verify all 7 boot flags via static parse + dry-run smoke; verify
`Write-DashboardFailure`/`Hold-Pane` via static read; emit a single
`30-VERIFICATION.md` with 8 scenario-rows, a flag matrix, and a timing line.

---

## User Constraints (from DISCUSS 30.1 + scope)

### Locked Decisions

- **DISCUSS 30.1 — Acceptance breadth:** All 8 scenarios mandatory. Fixture-based
  verification permitted for the 3 hard cases (codex-timeout, forced-restart,
  codex-warned). No "live-only deferral" — every scenario produces evidence
  (live or fixture). [VERIFIED: REQUIREMENTS.md line 177]
- **No new boot script edits.** Phase 30 is verification-only. Source-edit
  proposals belong in v1.7+ phases. [CITED: prompt scope, COCKPIT-2.0-SCOPE.md
  "Non-Goals" line 232–235, REQUIREMENTS.md "Kill Or Defer Conditions" line 211]
- **Reuse existing telemetry first.** No new state file, no new metric stream.
  [CITED: DISCUSS 27.1 = NO; DISCUSS 27.2; verified upstream by Phase 27/28/29
  goal-backward checks]
- **8 scenarios verbatim** (from COCKPIT-2.0-SCOPE.md lines 219–228):
  active, blocked-gate, codex-timeout, codex-warned, no-private-KB,
  stale-data, forced-restart, no-tool-event.

### Claude's Discretion

- Choice of fixture dir layout for the 4 new scenarios (mirror Phase 29's
  per-fixture-directory pattern with `meta.json`/`STATE.md`/`codex-live.json`/
  `activity-log.jsonl`/`expected-output.txt`, OR consolidate inside Phase 29's
  existing runner — recommendation: new dir `super-gsd/tests/cockpit-acceptance/`
  to keep "Q5/Q6 lib unit tests" separate from "8-scenario acceptance").
- Naming: A1–A8 (acceptance) vs F13–F20 (fixture continuation). Recommendation:
  A1–A8, one per scenario, mapped 1:1 to COCKPIT-2.0-SCOPE.md ordering.
- Whether to capture boot timing once or repeat 3× and report median.
  Recommendation: 3 runs, report `min/median/max` line in VERIFICATION.

### Deferred Ideas (OUT OF SCOPE)

- Boot script edits (any flag changes, new flags, refactor of soft-load idiom).
- Cockpit lib edits (`sgsd-mission-strip.ps1` is locked — Phase 29 closed it).
- README expansion beyond verifying current state. (If prior reset removed
  `sg`/`sgsd` daily-commands section, recording that gap is in scope; *adding*
  the section back is a v1.7 doc task per "no boot edits" rule.)
- VTP/private-KB enrichment. KNOW-01/02 require optionality only — already shipped.

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BOOT-01 | `sg`, `sg -Go`, `sg -FullPreflight`, `sg -NoClaude`, `sg -NoCockpit`, `sgsd`, `sgsd -Claude -Greet` behavior verified and recorded | §3 boot-flag matrix; static parse + smoke per flag |
| BOOT-02 | Fast boot and full preflight timings captured | §4 timing capture (Measure-Command on `-NoOpen`) |
| BOOT-03 | Startup guide and README point users to right daily command without requiring VTP | §5 doc audit (README has no `sg` reference today; SGSD-BOOT-STARTUP-GUIDE.md fully covers it) |
| BOOT-04 | Dashboard host failure shows red failure pane, does not collapse to PowerShell prompt | §6 `Write-DashboardFailure`/`Hold-Pane` static verification |
| COCKPIT-01..08 | First viewport answers 8 operator questions | §1 acceptance scenario matrix (8 rows × 8 questions) |
| UX-04 | Status vocabulary normalized (8 closed states) | Phase 26 contract; verified via fixture expected-output strings |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Acceptance scenario evidence | `super-gsd/tests/cockpit-acceptance/` (new dir) | Phase 29 fixture suite (reuse 4) | Tests live with code; reuse where Phase 29 already covers |
| Boot flag verification | `Install-SgsdShortcut.ps1` static parse + `sgsd-boot.ps1 -NoOpen` smoke | `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md` cheat sheet | Source-of-truth for flags is the function block in installer; guide is docs |
| Boot timing | `Measure-Command { sgsd -NoOpen }` PowerShell wall-time | activity-log.jsonl (if instrumented; not required) | Direct measurement, no new telemetry |
| Failure pane behavior | `sgsd-dashboard-host.ps1` `Write-DashboardFailure` + `Hold-Pane` | Operator visual confirm | Two functions, ~70 lines, full static verification possible |
| 8-question coverage | Phase 26 contract `26-01-...PLAN.md` Q1–Q8 sections | Phase 28 strip + Phase 29 lib | Contract is canonical; evidence rows trace each Q to its source |

---

## 1. Acceptance Scenario Matrix (8 rows)

Per DISCUSS 30.1, each row produces evidence (live or fixture). The Phase 29
suite (`super-gsd/tests/mission-strip/fixtures/F1..F12`) already covers 4 of the
8 scenarios; the remaining 4 need new fixtures or live captures.

| # | Scenario | Mode | Inputs (setup) | Expected Mission Strip output | Reusable Phase 29 fixture? |
|---|----------|------|---------------|-------------------------------|----------------------------|
| 1 | **active** (normal SGSD work) | live OR fixture | STATE.md active=29 + recent activity-log.jsonl row (<30s, has `phase` stamp) + codex-live.json fresh | Q1 active (current tool), Q2 milestone v1.6 phase 30, Q3 unlock v1.6 close, Q4 active/no-blocker, Q5 active agents, Q6 active, Q8 next-rule | **NO** — F2 covers Q6-active only; need full 6-line strip for Q1+Q2+Q5. **Build A1.** Recommendation: live capture (5 min of normal work) is cheapest |
| 2 | **blocked-gate** | fixture (deterministic) | STATE.md with `blockers:` row OR crit-backlog.jsonl row tagged to phase 30, freshness <24h | Q4 blocked, repair_instruction text rendered | **NO**. Build A2 with crit-backlog.jsonl fixture + STATE.md blocker. `crit-backlog.jsonl` mtime forge identical to F1's codex_mtime_offset pattern |
| 3 | **codex-timeout** (HARD — fixture per DISCUSS 30.1) | **fixture** | codex-live.json `state="timeout"` mid-band (Δ=200s) | `> codex timed-out  > agents --` | **YES — F4 verbatim**. F4 meta.json: `codex_mtime_offset_sec=-200`, expected `> codex timed-out  > agents --` |
| 4 | **codex-warned** (HARD — fixture per DISCUSS 30.1) | **fixture** | codex-live.json with WARN-bearing report | `> codex ready` (label) + WARN annotation in narrative pane (out-of-strip) | **PARTIAL — F5 covers `state=ok→ready` rendering**. Need new A4 with `report_path` populated + warn count >0 to confirm Q6 mid-band warn-aware behavior. **Recommendation: add A4** (cheap — extends F5's codex-live.json with `crit_count: 0, warn_count: 2`, asserts narrative pane reads it; strip line stays `ready` because Phase 28/29 chose not to surface counts on strip) |
| 5 | **no-private-KB** | live OR fixture | `.planning/config.json` with no `knowledge.private_root`; `.mcp.json` without `vtp-kb` server entry | Preflight prints `Private knowledge bank optional; fallback=sgsd-bundled-research` (DarkGray, OK) | **NO** — Phase 29 doesn't test boot. Build A5: minimal `.planning/config.json` fixture + run `sgsd-boot.ps1 -NoOpen`; capture stdout, assert text match. (Currently the active project repo IS already in this state — just record live evidence) |
| 6 | **stale-data** | **fixture** | codex-live.json mtime Δ≥3600s OR activity-log.jsonl last row Δ≥600s | `> codex stale  > agents --` (per F1) | **YES — F1 verbatim** for codex stale. Activity-stale (Q1 stale) needs A6 OR can re-use stale logic (lib treats both with `< 30s / 30-599 / >= 600s` bands per Phase 26 contract) — recommendation: F1 covers codex-stale; A6 covers activity-stale (1 file, identical to F1 pattern) |
| 7 | **forced-restart** (HARD — fixture per DISCUSS 30.1) | **fixture** | `.planning/ORCHESTRATOR-CHECKPOINT.md` present + STATE.md mid-phase + heartbeat.jsonl Δ>10min | Q8 should render `waiting`/repair_instruction = "read ORCHESTRATOR-CHECKPOINT.md and resume per its next_unit" | **NO**. Build A7: checkpoint fixture file + stale heartbeat. Asserts Q8 lane text matches Phase 26 contract repair_instruction |
| 8 | **no-tool-event** | **fixture** | activity-log.jsonl exists but last row Δ ≥ 30s AND no live Claude session JSONL | Q1 `waiting`; strip displays "waiting" status, no current tool name | **NO**. Build A8: activity-log.jsonl with 1 row mtime Δ=300s, no live session. Asserts Q1 = `waiting` (mid-band). |

**Reuse summary:** F1 (scenario 6 codex-stale), F4 (scenario 3 codex-timeout),
F5 (scenario 4 codex-warned base — extend with A4 for warn count), F6 (Q6
unavailable — partial signal for scenario 5 no-private-KB but boot-side test
is what BOOT-01 needs). **4 reused, 4 new fixtures (A1, A2, A5, A6, A7, A8).**
Net new fixture count: 6 (A4 is an extension of F5 semantics, but cleaner as its
own dir).

**Recommended layout for the 6 new fixtures:**

```
super-gsd/tests/cockpit-acceptance/
├── run-acceptance-fixtures.ps1            # 8-row runner; reads from BOTH dirs
├── fixtures/
│   ├── A1/                                # active
│   │   ├── STATE.md
│   │   ├── activity-log.jsonl
│   │   ├── codex-live.json
│   │   ├── meta.json
│   │   └── expected-output.txt
│   ├── A2/                                # blocked-gate
│   ├── A4/                                # codex-warned (extends F5)
│   ├── A5/                                # no-private-KB (live capture acceptable)
│   ├── A6/                                # stale-data (activity-stale)
│   ├── A7/                                # forced-restart
│   └── A8/                                # no-tool-event
└── README.md                              # scenario→fixture mapping
```

A3 reuses Phase 29 F4 (path: `super-gsd/tests/mission-strip/fixtures/F4`).
The runner walks both dirs and reports one combined "8/8 scenarios PASS" line.

**Determinism rules** (inherited from Phase 29):

- mtime forge via `meta.json.codex_mtime_offset_sec` (or new
  `activity_mtime_offset_sec` for A6/A8).
- Per-fixture temp dir under `$env:TEMP\sgsd-acceptance-{guid}`, cleaned in
  `finally`.
- Dot-source the production lib at `super-gsd/scripts/lib/sgsd-mission-strip.ps1`
  (Live-or-Local rule per Phase 29 §4 of VERIFICATION).
- ASCII-only literals (PS 5.1 mojibake guard).
- Total runtime budget: <10s for the 6 new + 4 reused = 10 fixtures (Phase 29's
  12 fixtures ran in 736ms, so <2s expected for 10).

---

## 2. Boot Script Flag Verification Matrix

Source of truth: `super-gsd/scripts/Install-SgsdShortcut.ps1` lines 109–216 (the
`functionBlock` HEREDOC). The `sgsd` and `sg` PowerShell functions ARE the flag
contract — anything missing from those param blocks does not exist.

| Flag | Function | Param present? | sgsd-boot.ps1 honors? | Smoke verification |
|------|----------|----------------|----------------------|-------------------|
| `sgsd` (no flags) | `sgsd` | n/a — base call | YES (line 781 launchArgs) | `sgsd -NoOpen` exit=0 with PREFLIGHT block printed |
| `sgsd -NoOpen` | `sgsd` | YES (line 112) | YES (line 731 `if ($NoOpen)`) | exit=0; "NoOpen flag set - skipping dashboard launch." printed |
| `sgsd -SkipPreflight` | `sgsd` | YES (line 113) | YES (line 391 `if (-not $SkipPreflight)`) | exit=0; PREFLIGHT block absent from stdout |
| `sgsd -Bootstrap` | `sgsd` | YES (line 114) | YES (line 412) | exit=0; bootstrap path executes if MEMORY.md missing (project already has MEMORY.md → no-op success) |
| `sgsd -Backfill` | `sgsd` | YES (line 115) | YES (line 242) | exit=0; "Backfill complete" printed; no dashboards opened |
| `sgsd -Claude` | `sgsd` | YES (line 116) | YES (line 849 `if ($Claude)`) | smoke not safe to run (spawns Claude window); static-verify only |
| `sgsd -Go` | `sgsd` | YES (line 117) | YES (line 33 `if ($Go) { $Claude = $true }`); auto-types `'go'` | static-verify only |
| `sgsd -Greet` | `sgsd` | YES (line 118) | YES (line 35); $Go-and-$Greet mutex (line 37) | static-verify only |
| `sgsd -Help` | `sgsd` | YES (line 119) | NOT in boot script — local to function (line 123) | `sgsd -Help` prints cheat sheet, exit=0 |
| `sgsd -ProjectDir <X>` | `sgsd` | YES (line 120) | YES (line 22 boot param) | `sgsd -ProjectDir . -NoOpen` exit=0 |
| `sg` (no flags) | `sg` | n/a — base call | n/a (sg invokes sgsd + claude separately) | static-verify (don't smoke — spawns Claude) |
| `sg -FullPreflight` | `sg` | YES (line 183) | maps to `sgsd` w/o `-SkipPreflight` (line 193: `if (-not $FullPreflight) { $bootArgs.SkipPreflight = $true }`) | static-verify |
| `sg -Go` | `sg` | YES (line 184) | maps to `claude --dangerously-skip-permissions 'go'` (line 211) | static-verify |
| `sg -NoCockpit` | `sg` | YES (line 185) | skips `sgsd` invocation (line 190 `if (-not $NoCockpit)`) | smoke: `sg -NoCockpit -NoClaude` should be a near-instant no-op |
| `sg -NoClaude` | `sg` | YES (line 186) | early `return` after cockpit (line 197) | smoke: `sg -NoClaude` boots cockpit, no Claude window |
| `sg -ProjectDir <X>` | `sg` | YES (line 187) | passed through to `sgsd` (line 192) | static-verify |

**Mutex check:** `sgsd-boot.ps1` lines 37–42 reject `-Go -Greet` together with
exit=1 + red error. Phase 30 must include a smoke that asserts this:

```powershell
$out = & powershell -NoProfile -File super-gsd/scripts/sgsd-boot.ps1 -NoOpen -Go -Greet 2>&1
$LASTEXITCODE -eq 1  # MUST be true
```

**Drift checks (static parse, no execution):**

1. Every flag in `Install-SgsdShortcut.ps1` `sgsd` param block has a matching
   `param()` entry in `sgsd-boot.ps1` lines 21–30 (or is local-only like `Help`).
2. Every flag in the `sg` param block has a matching mapping in the function
   body (lines 188–215).
3. The cheat-sheet `if ($Help)` block (lines 123–139) lists every flag the
   `sgsd`/`sg` functions accept.
4. `SGSD-BOOT-STARTUP-GUIDE.md` "Command Cheat Sheet" table (line 79–94) has a
   row for every flag combination listed in `-Help` and the function param
   blocks.

---

## 3. Boot Timing Capture

`sgsd-boot.ps1 -NoOpen` is the ideal timing target — it runs the full preflight
(8 numbered checks: `.planning/`, MEMORY.md, curate-pipe, agents-registry, DLB-04
substrate, gates probe, Codex self-test, knowledge-bank presence) and returns
without spawning windows. This isolates "preflight cost" from "WT spawn cost".

**Recommended capture script:**

```powershell
# super-gsd/tests/cockpit-acceptance/measure-boot.ps1
1..3 | ForEach-Object {
    $ms = (Measure-Command {
        & powershell.exe -NoProfile -File super-gsd/scripts/sgsd-boot.ps1 -NoOpen
    }).TotalMilliseconds
    [pscustomobject]@{ Run = $_; Ms = [int]$ms }
} | Tee-Object -Variable runs

$runs | Measure-Object Ms -Min -Max -Average | Format-Table
```

**Recording:** VERIFICATION.md should include one line:

```
boot timing (sgsd-boot.ps1 -NoOpen, 3 runs): min=NNNms median=NNNms max=NNNms
```

**Skip-preflight comparison** (optional, for context — BOOT-02 requires
captured numbers, not specifically a comparison):

```
fast boot   (sgsd -NoOpen -SkipPreflight): min=NNNms median=NNNms max=NNNms
full preflight (sgsd -NoOpen):              min=NNNms median=NNNms max=NNNms
```

**Known cost contributors** (from boot script + SGSD-BOOT-STARTUP-GUIDE.md
line 363–370):

- Git Bash startup per probe (`& $BashExe -c '...'` × 4 invocations: curate
  smoke, registry sync, codex self-test, MEMORY.md fallback)
- Codex self-test (4 sub-probes, even with `--skip-network`)
- Agents registry sync (skipped if manifest is fresh, line 549–557)
- DLB-04 substrate-status helper dot-source (line 576–583)

No micro-optimization in scope. Phase 30 just records.

**No-instrumentation rule:** Do NOT add timing telemetry to `sgsd-boot.ps1`.
External `Measure-Command` is sufficient and respects the "no boot edits" rule.

---

## 4. Dashboard Host Failure Pane (BOOT-04)

`super-gsd/scripts/sgsd-dashboard-host.ps1` is 68 lines, fully reviewable in one
read. Two functions own the failure-pane contract:

### `Write-DashboardFailure` (lines 33–51)

- `Clear-Host` (line 39) clears the pane fully — no leftover prompt content.
- `Write-Host "SUPER GSD DASHBOARD FAILURE"` in red (line 40), separator in red
  (line 41).
- Pane name + script path + project printed (lines 42–44).
- Title line in yellow (line 46).
- Optional detail block in gray (lines 47–50).

### `Hold-Pane` (lines 27–31)

- Prints "Pane held open so the failure stays visible" in DarkGray.
- `while ($true) { Start-Sleep -Seconds 3600 }` — infinite wait, Ctrl+C exits.
- Crucial: **no `exit` call**, no `return` — pane never falls back to a regular
  PowerShell prompt.

### Three failure paths (lines 53–68)

1. **Path resolve fails** (line 56–59): `Resolve-Path` throws → caught →
   `Write-DashboardFailure "Boot could not resolve the dashboard path."` →
   `Hold-Pane`.
2. **Dashboard returns cleanly** (line 63): script exits without infinite-render
   loop → `Write-DashboardFailure "Dashboard script returned instead of
   continuing to render."` → `Hold-Pane`.
3. **Dashboard throws** (line 65–67): exception → caught →
   `Write-DashboardFailure "Dashboard script crashed before it could keep
   rendering."` with `$_ | Out-String` detail → `Hold-Pane`.

### Phase 30 verification approach

**Static read (no exec):**

- Confirm `Clear-Host` present
- Confirm three try/catch paths exist (path resolve, render return, render
  throw)
- Confirm `Hold-Pane` is called from every failure path (grep: `Hold-Pane`
  count = 3)
- Confirm no `exit 0` / `return` after `Hold-Pane` in any path

**Live failure smoke** (optional, but cheap):

```powershell
# Force "dashboard returned cleanly" path
$tmp = New-TemporaryFile | ForEach-Object { Rename-Item $_ "$_.ps1" -PassThru }
"Write-Host 'fake dashboard exit'" | Set-Content $tmp
$proc = Start-Process powershell -ArgumentList @(
    '-NoExit','-NoProfile','-File',
    'super-gsd/scripts/sgsd-dashboard-host.ps1',
    '-DashboardScript', $tmp.FullName,
    '-ProjectDir', '.',
    '-Name','SGSD-Test'
) -PassThru
Start-Sleep 2
# Visual confirm: red "DASHBOARD FAILURE" banner is showing
Stop-Process $proc.Id
Remove-Item $tmp
```

**Recommendation:** include the live smoke; visual evidence is operator-grade
(BOOT-04 is partly UX). Capture screenshot path in VERIFICATION.md or — if
operator review is async — record `process started, banner verified, terminated`
note.

---

## 5. README + Startup Guide Audit

### Current state (verified 2026-04-26)

| Doc | `sg` daily commands present? | `sgsd` references? | VTP-required language? | Notes |
|-----|-----------------------------|--------------------|------------------------|-------|
| `README.md` | **NO** — verified zero matches for `sg`/`sgsd-boot.ps1 -NoOpen`/`FullPreflight` | YES — only at line 313 (`powershell -File super-gsd/scripts/sgsd-boot.ps1`) | NO — line 318 says "VTP/MCP detail" but VTP is one possible KB, not required | README "Starting the Cockpit" section (line 309–322) shows **only** the legacy `bash`/`powershell -File` form, not `sg` |
| `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md` | **YES** — comprehensive cheat sheet (line 79–94), recommended-daily-command section (line 17–52), fast-boot-vs-full-preflight (line 99–141) | YES throughout | NO — line 264–266 explicitly: "Do not assume every user has VTP. VTP is one possible private knowledge bank, not a required SGSD dependency." | Fully covers BOOT-01 / BOOT-03 contract |

### BOOT-03 implications

BOOT-03 reads (REQUIREMENTS.md line 156): "Startup guide and README point users
to the right daily command without requiring VTP."

**Verdict:** SGSD-BOOT-STARTUP-GUIDE.md fully satisfies BOOT-03. README is
**partially compliant** — it has no VTP-required language, but it also has no
`sg` daily-command mention. The README "Starting the Cockpit" section is dated
(refers only to the raw `powershell -File` form, missing the `sg`/`sgsd`
shortcuts).

**Phase 30 stance** (per "no source edits" rule): record the gap in VERIFICATION,
file as v1.7 doc-task. Do NOT edit README in Phase 30.

**Specific gap to record:**

> `README.md` "Starting the Cockpit" section at line 309–322 documents only the
> legacy `bash super-gsd/scripts/sgsd-boot.sh` / `powershell -File ...` form.
> The `sg` and `sgsd` PowerShell shortcuts (installed by
> `Install-SgsdShortcut.ps1`) are not mentioned. SGSD-BOOT-STARTUP-GUIDE.md is
> the canonical daily-command reference; README should link to it. Filed as a
> v1.7 doc task; not a Phase 30 implementation gap.

---

## 6. Open Questions for the Planner

1. **Active scenario evidence — live capture vs A1 fixture?**
   Recommendation: **live capture** (5 minutes of normal `sg` work captures
   stdout from `sgsd-mission-control.ps1`, attach as `30-EVIDENCE-A1.txt`).
   Cheaper than building a deterministic A1 fixture, and "active" is the one
   scenario where deterministic fixtures distort the operator question (live
   work IS the test). If the planner prefers full fixture coverage, A1 is
   buildable from the F2 + F8 patterns combined.

2. **A4 codex-warned — strip line vs narrative-pane evidence?**
   Phase 28/29 chose NOT to surface warn counts on the strip (strip stays
   `ready`). The warn evidence lives in `sgsd-codex-monitor.ps1` (SGSD3 pane).
   Recommendation: A4 fixture asserts (a) strip line stays `ready`, (b) a
   secondary text-grep against the codex-monitor pane render confirms warn
   count appears. This needs a tiny extension to the runner — either a 2-step
   assert or a "secondary expected" file.

3. **A5 no-private-KB — live or fixture?**
   The active project repo IS already in a no-private-KB state (the prior
   reset removed `vtp-kb` from `.mcp.json`). Recommendation: **live capture
   acceptable** — run `sgsd-boot.ps1 -NoOpen` once, grep stdout for "Private
   knowledge bank optional; fallback=", attach output as evidence. No fixture
   needed.

4. **Boot-flag smoke — actually run `sgsd -Claude -Greet`?**
   The Claude-spawning flags (`-Claude`, `-Go`, `-Greet`) cannot be smoked
   without spawning a real Claude window. Recommendation: static parse only
   for those three flags (`grep '\$Claude'` / `grep '\$Go'` / `grep '\$Greet'`
   in both `sgsd-boot.ps1` and `Install-SgsdShortcut.ps1`); no live spawn.
   The mutex (`-Go -Greet` rejection at boot.ps1 line 37) IS smokeable
   (just takes the boot script to exit 1 — never reaches Claude spawn).

5. **Forced-restart fixture (A7) — how detailed?**
   Phase 26 contract Q8 repair_instruction is the assertion target ("read
   `.planning/ORCHESTRATOR-CHECKPOINT.md` and resume per its `next_unit`").
   Recommendation: A7 has STATE.md + ORCHESTRATOR-CHECKPOINT.md + stale
   heartbeat.jsonl. Asserts Q8 = `waiting`. Does NOT need to assert that
   the orchestrator actually resumes — that's a v2.0 dispatch test.

---

## 7. Kill / Defer Conditions

**Defer to v1.7 (do NOT do in Phase 30):**

- README rewrite to add `sg` daily commands (covered by BOOT-03 gap note).
- `sgsd-boot.ps1` flag refactor or new flags.
- Any change to `sgsd-mission-strip.ps1` even if a scenario surfaces a
  rendering bug — file as v1.7 hotfix, do NOT amend Phase 29.
- Acceptance runner unification with Phase 29's runner. Two runners is
  acceptable; one combined runner is gilding.

**Kill if encountered:**

- Any "let's add a state file to make this easier" temptation. DISCUSS 27.1
  is locked. Phase 30 cannot introduce new state.
- Any "let's just make A1 a screenshot" shortcut. Live evidence is fine, but
  it must be reproducible (a stdout capture, not a screenshot of a stdout
  capture).
- Any "VTP must be running for this scenario" assumption. KNOW-01 forbids it.

**Defer condition that legitimately applies:**

- Codex live-auth deferral. Phase 26/27/28/29 all closed `PASS-WITH-DEFERRED-N`
  with N≥3 of those rows being "Codex auth unavailable". Phase 30 will
  inevitably file ≥1 same row. This is expected; record in VERIFICATION
  backlog table, do NOT block phase close.

---

## 8. Runtime State Inventory

(Phase 30 is verification-only. No renames, no migrations, no string
replacements. Inventory categories below confirmed empty.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by phase scope (verification only) | none |
| Live service config | None | none |
| OS-registered state | None | none |
| Secrets/env vars | None | none |
| Build artifacts | None | none |

---

## 9. Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PowerShell 5.1+ | All boot/cockpit/fixture scripts | ✓ (Win11) | 5.1.26100 | — |
| Git Bash (non-WSL) | sgsd-boot.ps1 lines 72–79 (Codex/curate/registry probes) | ✓ | implicit (boot script enforces presence; exit=1 if missing) | — |
| Windows Terminal (`wt.exe`) | Cockpit single-window layout | ✓ (assumed; falls back to 3 separate PS windows per line 819) | — | 3 separate PowerShell windows (line 819 fallback) |
| Claude Code CLI | `sg`, `sg -Go`, `sgsd -Claude` flag chain | smoke-deferred (presence check at boot line 853–855; missing prints WARN, no fail) | — | static-verify only for Claude-spawning flags |
| Codex CLI | preflight self-test (boot line 607–646) | smoke-deferred (auth often unavailable per Phase 26–29 backlog rows) | — | self-test exits N>0 → WARN row, non-blocking |
| `Measure-Command` | timing capture | ✓ (PS built-in) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** Codex CLI auth (expected per Phase
26–29 pattern; falls back to non-blocking WARN backlog row).

---

## 10. Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | PowerShell scripts + Pester-style assertions (no Pester dep) — same pattern as Phase 29 runner |
| Config file | None — convention-driven; runner is the entry point |
| Quick run command | `powershell -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` |
| Full suite command | `powershell -File super-gsd/tests/mission-strip/run-mission-strip-fixtures.ps1; powershell -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOOT-01 | All 7 flags behave | smoke + static parse | `powershell -File super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1` | ❌ Wave 0 |
| BOOT-02 | Timing captured | timing | `powershell -File super-gsd/tests/cockpit-acceptance/measure-boot.ps1` | ❌ Wave 0 |
| BOOT-03 | Doc audit | static grep | inline grep against README.md and SGSD-BOOT-STARTUP-GUIDE.md | (run inline) |
| BOOT-04 | Failure pane | static read + optional smoke | inline static read; smoke is optional | (run inline) |
| COCKPIT-01..08 | 8-question coverage | fixture suite | the acceptance runner (8 scenarios) | ❌ Wave 0 (4 reused, 6 new) |

### Sampling Rate

- **Per task commit:** acceptance runner (10s budget, runs all 10 fixtures —
  4 reused + 6 new).
- **Per wave merge:** acceptance runner + Phase 29 runner + boot-flag smoke
  + measure-boot.
- **Phase gate:** all of the above green; VERIFICATION.md complete with all
  10 goal-backward checks PASS.

### Wave 0 Gaps

- [ ] `super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1` —
  walks A1..A8 plus reused F1/F4/F5/F6, dot-sources the production lib,
  asserts expected-output.txt match per fixture
- [ ] `super-gsd/tests/cockpit-acceptance/fixtures/A1/` through `A8/` — 6
  new fixture dirs (A3 reuses F4 by reference; A1 may be live capture
  per §6.1 recommendation)
- [ ] `super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1` — flag
  matrix smoke (all `sgsd` flags w/o Claude-spawning, plus mutex check)
- [ ] `super-gsd/tests/cockpit-acceptance/measure-boot.ps1` — 3-run
  timing capture
- [ ] `super-gsd/tests/cockpit-acceptance/README.md` — scenario→fixture
  mapping

(Framework install: not needed — pure PowerShell, no Pester, no Node.)

---

## 11. Project Constraints (from CLAUDE.md)

- **PERMISSIONS — autonomous mode:** Phase 30 runs in auto mode; do not ask
  for confirmation between fixture builds.
- **Commit Discipline:** `feat(30-NN): ...` per task; commit after every unit;
  never batch.
- **Token Efficiency:** acceptance fixtures are static text — minimal
  generation cost. Verification report is the main output, ~300–500 lines.
- **Sub-agent Report Format:** every dispatched agent returns
  FILES_CHANGED/VERIFICATION/DEVIATIONS/BLOCKERS/SCRIPTS_CREATED/ONE_LINER.
- **NEVER expose secrets:** N/A for this phase (no secret-bearing files
  read).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Phase 29 fixtures F1, F4, F5, F6 are stable and won't change before Phase 30 closes | §1 reuse plan | LOW — Phase 29 is closed PASS-WITH-DEFERRED-4. Fixture diffs would need a separate hotfix phase. |
| A2 | A4 codex-warned can be a strip-line + secondary-pane assertion (not strip-only) | §1, §6.2 | LOW — Phase 28/29 made the explicit choice to keep counts off the strip; verifier can confirm in <1 min |
| A3 | The active project repo is in a no-private-KB state today (no `vtp-kb` in .mcp.json) | §1 A5 | LOW — verifiable in 30s with `cat .mcp.json | grep -q vtp-kb`; if false, fixture is buildable |
| A4 | `Measure-Command` overhead is negligible vs boot script wall-time | §3 | LOW — Measure-Command is a built-in cmdlet with µs-level overhead |
| A5 | The `Hold-Pane` infinite loop in dashboard-host is correct behavior (operator must Ctrl+C) | §4 | NONE — verified in source line 30 |

**Summary:** All claims are LOW-risk or VERIFIED. No `[ASSUMED]` claims need
operator confirmation before planning.

---

## Sources

### Primary (HIGH confidence)

- `.planning/milestones/COCKPIT-2.0-SCOPE.md` lines 219–228 (8 acceptance scenarios)
- `.planning/milestones/v1.6/REQUIREMENTS.md` lines 105–168 (BOOT/COCKPIT/UX/KNOW IDs)
- `.planning/milestones/v1.6/REQUIREMENTS.md` line 177 (DISCUSS 30.1 lock)
- `.planning/discussions/2026-04-26-mass-discuss.md` line 177 (DISCUSS 30.1 verbatim)
- `.planning/milestones/v1.6/phases/26-cockpit-question-contract/26-01-operator-question-contract-PLAN.md` (Q1–Q8 contract — 8 sections, 8 status states, freshness no-gap proof, 4-AND repair predicate)
- `.planning/milestones/v1.6/phases/28-mission-control-layout/28-VERIFICATION.md` (Mission Strip 6-line render, lib API locked)
- `.planning/milestones/v1.6/phases/29-agent-codex-lanes/29-VERIFICATION.md` (12 fixtures green, F1/F4/F5/F6 reusable)
- `super-gsd/scripts/sgsd-boot.ps1` (903 lines, full read; flag matrix lines 21–30, preflight 391–693, launch 749–840, Claude 849–876)
- `super-gsd/scripts/Install-SgsdShortcut.ps1` (355 lines, full read; sgsd function 109–178, sg function 180–216, help 123–139)
- `super-gsd/scripts/sgsd-dashboard-host.ps1` (68 lines, full read; Write-DashboardFailure 33–51, Hold-Pane 27–31, three failure paths 53–68)
- `super-gsd/docs/SGSD-BOOT-STARTUP-GUIDE.md` (425 lines, full read; cheat sheet 79–94, fast-vs-full 99–141, troubleshooting 301–401)
- `super-gsd/tests/mission-strip/run-mission-strip-fixtures.ps1` (Phase 29 runner pattern reused for acceptance runner)
- `super-gsd/tests/mission-strip/fixtures/F1..F12/meta.json` + expected-output.txt (reuse signals)

### Secondary (MEDIUM confidence)

- `README.md` line 309–322 (BOOT-03 gap analysis — README has no `sg`)

### Tertiary (LOW confidence)

- (none — Phase 30 is fully scoped from internal artifacts; no web research
  needed)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — Phase 29 runner pattern is proven; no new tooling
- Architecture: HIGH — Phase 26 contract is the canonical question→source map
- Pitfalls: HIGH — DISCUSS 30.1 lock + scope "no source edits" rule eliminate
  the main pitfalls (scope creep, doc rewrite, lib hotfix temptation)

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days; v1.6 close imminent, low rate-of-change)
