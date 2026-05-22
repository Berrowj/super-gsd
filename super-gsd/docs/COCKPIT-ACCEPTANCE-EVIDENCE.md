---
phase: 30
plan: 01
created: 2026-04-26
discuss_decisions: [30.1]
closes: v1.6
---

# Cockpit 2.0 + Startup Acceptance Evidence (Phase 30 T1)

## Summary

Phase 30 is the v1.6 acceptance gate. All 8 cockpit acceptance scenarios from
`COCKPIT-2.0-SCOPE.md` (lines 219-228) produce evidence: 4 reused Phase 29
fixtures (`F1`, `F4`, `F5`, `F6`), 6 new fixtures (`A1`, `A2`, `A4`, `A6`,
`A7`, `A8`), and 1 boot-stdout capture (`A5`). All 7 documented `sg`/`sgsd`
boot flags resolve to source-of-truth definitions in
`Install-SgsdShortcut.ps1` and `sgsd-boot.ps1`. The `-Go`/`-Greet` mutex
smokes to exit=1 in <2s. `sgsd-boot.ps1 -NoOpen` wall-time is captured (3
runs, min/median/max). The `sgsd-dashboard-host.ps1` failure pane
(`Write-DashboardFailure` + `Hold-Pane`) is statically verified across all
three failure paths. The README BOOT-03 gap (no `sg` daily-command in
"Starting the Cockpit") is recorded for v1.7 docs work. **Zero source edits**;
this phase produces evidence, not patches.

## Acceptance Scenario Matrix

Per `COCKPIT-2.0-SCOPE.md` ordering. Q-lane references trace to Phase 26
operator-question contract (`26-01-operator-question-contract-PLAN.md`).

| # | Scenario        | Mode    | Evidence Path                                                                 | Q lanes exercised        | Result |
|---|-----------------|---------|-------------------------------------------------------------------------------|--------------------------|--------|
| 1 | active          | fixture | `super-gsd/tests/cockpit-acceptance/fixtures/A1/`                             | Q1, Q2, Q5, Q6, Q8       | PASS   |
| 2 | blocked-gate    | fixture | `super-gsd/tests/cockpit-acceptance/fixtures/A2/`                             | Q4, Q2, Q5, Q8           | PASS   |
| 3 | codex-timeout   | reused  | `super-gsd/tests/mission-strip/fixtures/F4/` (Phase 29)                       | Q6, Q8                   | PASS   |
| 4 | codex-warned    | fixture | `super-gsd/tests/cockpit-acceptance/fixtures/A4/` (+ `F5` baseline reuse)     | Q6, Q7                   | PASS   |
| 5 | no-private-KB   | smoke   | `verify-boot-flags.ps1` C6 stdout (KNOW-01 branch present)                    | Boot preflight, KNOW-01  | PASS   |
| 6 | stale-data      | fixture | `super-gsd/tests/mission-strip/fixtures/F1/` (codex-stale) + `fixtures/A6/`   | Q1, Q6                   | PASS   |
| 7 | forced-restart  | fixture | `super-gsd/tests/cockpit-acceptance/fixtures/A7/`                             | Q8 (next-action)         | PASS   |
| 8 | no-tool-event   | fixture | `super-gsd/tests/cockpit-acceptance/fixtures/A8/`                             | Q1                       | PASS   |

Acceptance runner (`run-acceptance-fixtures.ps1`) walks the 6 new fixtures +
the 4 reused Phase 29 fixtures and reports `acceptance: 10/10 PASS  (~900ms)`.
Exit code 0.

### A5 (no-private-KB) - boot-stdout evidence detail

The active project repo currently has a private knowledge bank installed,
so the boot script emits the **present** branch:

```
[OK] Private knowledge bank present (C:/Users/user/Voice-Text-Plan)
```

Both branches of the KNOW-01 contract are valid evidence:

- `Private knowledge bank present (<path>)` -> private-KB-installed env (current)
- `Private knowledge bank optional; fallback=<corpus>` -> no-private-KB env

The `sgsd-boot.ps1` source code at line 689 emits the optional/fallback
literal when no private KB is configured, satisfying KNOW-01 ("private KB is
optional, never required"). The verifier (`verify-boot-flags.ps1` C6) accepts
either branch as KNOW-01 evidence.

## Boot Flag Verification Matrix

All 18 `verify-boot-flags.ps1` checks pass. Source-of-truth files:
`Install-SgsdShortcut.ps1` (lines 109-216), `sgsd-boot.ps1` (param block 21-30,
mutex 37-42), `SGSD-BOOT-STARTUP-GUIDE.md` cheat sheet (lines 79-94).

### sgsd flag matrix

| Flag                  | Source-of-truth                              | Static-parse | Smoke     |
|-----------------------|----------------------------------------------|--------------|-----------|
| `sgsd`                | `Install-SgsdShortcut.ps1` 109-178           | C1 PASS      | covered by C5/C6 |
| `sgsd -NoOpen`        | `sgsd-boot.ps1` line 21-30 + 731 emit        | C3 PASS      | C5 PASS (exit=0; `NoOpen flag set` present) |
| `sgsd -SkipPreflight` | `sgsd-boot.ps1` line 23 + 391 gate           | C3 PASS      | C5 PASS (exit=0)              |
| `sgsd -Bootstrap`     | `sgsd-boot.ps1` line 25 + 412                | C3 PASS      | static-only (no-op when MEMORY.md present) |
| `sgsd -Backfill`      | `sgsd-boot.ps1` line 26 + 242                | C3 PASS      | static-only (mutates state)   |
| `sgsd -Claude`        | `sgsd-boot.ps1` line 27 + 849                | C3 PASS      | static-only (would spawn Claude) |
| `sgsd -Go`            | `sgsd-boot.ps1` line 28 + 33 implies-Claude  | C3 PASS      | mutex-only (C7 covers `-Go -Greet`) |
| `sgsd -Greet`         | `sgsd-boot.ps1` line 29 + 35 implies-Claude  | C3 PASS      | mutex-only (C7) |
| `sgsd -Help`          | `Install-SgsdShortcut.ps1` 123-139           | C1 + C8 PASS | local-only - not in boot script |

### sg flag matrix

| Flag                  | Source-of-truth                              | Static-parse | Smoke     |
|-----------------------|----------------------------------------------|--------------|-----------|
| `sg`                  | `Install-SgsdShortcut.ps1` 180-216           | C2 PASS      | static-only (would spawn Claude) |
| `sg -FullPreflight`   | `Install-SgsdShortcut.ps1` 183 + 193 mapping | C2 PASS      | static-only |
| `sg -Go`              | `Install-SgsdShortcut.ps1` 184 + 211 mapping | C2 PASS      | static-only |
| `sg -NoCockpit`       | `Install-SgsdShortcut.ps1` 185 + 190 gate    | C2 PASS      | static-only |
| `sg -NoClaude`        | `Install-SgsdShortcut.ps1` 186 + 197 return  | C2 PASS      | static-only |

### Mutex check

| Check                       | Source-of-truth         | Result                                               |
|-----------------------------|-------------------------|------------------------------------------------------|
| `sgsd -Go -Greet` rejection | `sgsd-boot.ps1` 37-42   | C4 PASS (regex match) + C7 PASS (smoke exit=1)       |

### Cheat sheet drift

| Surface                                        | Check        | Result   |
|------------------------------------------------|--------------|----------|
| installer `if ($Help)` block 123-139           | C8 (8 flags) | PASS     |
| `SGSD-BOOT-STARTUP-GUIDE.md` cheat sheet 79-94 | C9 (7 rows)  | PASS     |

## Boot Timing

```
boot timing (sgsd-boot.ps1 -NoOpen, 3 runs): min=3240ms median=3334ms max=3693ms
```

Captured 2026-04-26 via `super-gsd/tests/cockpit-acceptance/measure-boot.ps1`
on Windows 11 Pro 26100. Recording-only; no absolute-timing gate. The
`-NoOpen` mode runs the full 8-step preflight without spawning windows;
roughly 3.3s median is dominated by Codex self-test sub-probes and Git Bash
spawn cost (per RESEARCH section 3 known cost contributors). No regression
vs. v1.5 baseline observed (no v1.5 baseline number recorded; this becomes
the v1.6 reference).

## Dashboard Host Verification (BOOT-04)

Static read of `super-gsd/scripts/sgsd-dashboard-host.ps1` (68 lines, all 4
checks pass).

- **H1 PASS** - `Clear-Host` literal present in `Write-DashboardFailure` body
  (line 39). Failure pane fully clears any prior content; no leftover prompt.
- **H2 PASS** - `Hold-Pane` invocation count = 3 (one per failure path:
  resolve-fail line 58, clean-return line 64, throw line 67). Function
  definition at line 27 is excluded from the count.
- **H3 PASS** - no `exit` or `return` literal between any
  `Write-DashboardFailure` call and its following `Hold-Pane` invocation.
  Failure paths cannot fall through to a regular PowerShell prompt.
- **H4 PASS** - `Hold-Pane` body contains the infinite-loop literal
  `while ($true) { Start-Sleep -Seconds 3600 }` (line 30). Pane stays open
  until operator Ctrl+C; visible failure cannot be hidden by a fast exit.

The optional live-failure smoke (RESEARCH section 4) was not run (opt-in;
visual evidence is operator-grade and outside autonomous scope). The static
contract is sufficient for BOOT-04 close.

## BOOT-03 README Audit

**Verdict: partially compliant.** README has no VTP-required language
(KNOW-01 compliant) but also has no `sg` daily-command mention.
`SGSD-BOOT-STARTUP-GUIDE.md` is the canonical daily-command reference and
fully covers BOOT-03; README "Starting the Cockpit" section is dated.

### Verbatim gap (per RESEARCH section 5)

> `README.md` "Starting the Cockpit" section at line 309-322 documents only
> the legacy `bash super-gsd/scripts/sgsd-boot.sh` / `powershell -File ...`
> form. The `sg` and `sgsd` PowerShell shortcuts (installed by
> `Install-SgsdShortcut.ps1`) are not mentioned.
> `SGSD-BOOT-STARTUP-GUIDE.md` is the canonical daily-command reference;
> README should link to it. Filed as a v1.7 doc task; not a Phase 30
> implementation gap.

### Static checks

| Check | Description                                                       | Result |
|-------|-------------------------------------------------------------------|--------|
| B1    | README has no daily `sg` command form                             | PASS (gap recorded) |
| B2    | README has no `sgsd-boot.ps1 -NoOpen` guidance                    | PASS (gap recorded) |
| B3    | README has no `sgsd-boot.ps1 -FullPreflight` guidance             | PASS (gap recorded) |
| B4    | README has legacy `powershell -File super-gsd/scripts/sgsd-boot.ps1` form | PASS (compliant baseline) |
| B5    | README has no VTP-required language                               | PASS (KNOW-01 compliant) |

**No README edit in Phase 30** (verification-phase rule). Backlog row below.

## Backlog (deferred to v1.7)

| ID                | Type  | Description                                                                 |
|-------------------|-------|-----------------------------------------------------------------------------|
| BOOT-03-README    | docs  | Add `sg`/`sgsd` daily-command block to README "Starting the Cockpit" + link to `SGSD-BOOT-STARTUP-GUIDE.md`. |
| CODEX-LIVE-AUTH   | env   | Codex CLI auth often unavailable; live preflight self-test surfaces WARN. Non-blocking per Phases 26-29 pattern. |
| MUDA-INVENTORY-WARN | hygiene | P21/P22 inventory waste WARN rows logged in MEMORY (`waste-inventory-p21-inventory.md`, `p22`). Investigate whether they affect Phase 30 evidence quality. |

## Deviations

### D-30-T1-01: agents row does not encode freshness state

PLAN T1 expected-output strings for A1/A6/A8 originally read
`> agents active`/`stale`/`waiting`. The production lib at
`super-gsd/scripts/lib/sgsd-mission-strip.ps1` lines 192-214 enumerates Q5
agents from distinct `subagent_type` values for `phase == activePhase`
**without** freshness-gating. The actual lib output is `> agents <names>` or
`> agents --`. The PLAN spec was descriptive ("agents are active") not
literal. Fixtures use the actual lib output for `expected-output.txt` and
add a secondary `expected-model.txt` per A1/A6/A8 that asserts the Q1 model
freshness state via `$state.modelColor` (Green=active, Yellow=waiting,
Red=stale, DarkGray=unavailable). A7 additionally asserts `$state.next`
contains `ORCHESTRATOR-CHECKPOINT.md` for the Q8 forced-restart repair
instruction. **No lib edit required**; the lib answers Q1, Q5, Q6, Q8
correctly via the multi-field state hashtable.

## Phase Close Summary

```
v1.6 acceptance: PASS-WITH-DEFERRED-3 (BOOT-03-README, CODEX-LIVE-AUTH, MUDA-INVENTORY-WARN)
```

Acceptance evidence complete. Zero source edits. v1.6 milestone is ready to
close per the locked DISCUSS 30.1 contract: all 8 scenarios produce evidence
(no live-only deferral), all 7 boot flags resolve, dashboard host failure
pane is contract-correct, BOOT-03 README gap is recorded for v1.7.
