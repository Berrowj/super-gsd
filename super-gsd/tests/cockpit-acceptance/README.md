# Cockpit Acceptance Harness (Phase 30 T1)

8-scenario cockpit acceptance harness for the v1.6 milestone close. Asserts
that the production `sgsd-mission-strip.ps1` lib answers all 8 operator
questions across the COCKPIT-2.0-SCOPE.md acceptance scenarios, and that the
`sg`/`sgsd` boot surface honors its documented contract.

## Layout

```
super-gsd/tests/cockpit-acceptance/
  run-acceptance-fixtures.ps1   # walks A1..A8 + reused F1/F4/F5/F6
  verify-boot-flags.ps1         # static + smoke for 7 sg/sgsd flags + mutex + dashboard host
  measure-boot.ps1              # 3-run Measure-Command timing for sgsd-boot.ps1 -NoOpen
  fixtures/
    A1/  active normal           STATE.md + activity-log + codex-live + meta + expected-output (+ expected-model)
    A2/  blocked-gate            STATE.md + crit-backlog + codex-live + meta + expected-output
    A4/  codex-warned            STATE.md + codex-live + codex-warn-report + meta + expected-output
    A6/  activity-stale          STATE.md + activity-log + codex-live + meta + expected-output (+ expected-model)
    A7/  forced-restart          STATE.md + ORCHESTRATOR-CHECKPOINT + heartbeat + codex-live + meta + expected-output (+ expected-nextaction)
    A8/  no-tool-event           STATE.md + activity-log + codex-live + meta + expected-output (+ expected-model)
```

A3 (codex-timeout) and 3 other scenarios reuse Phase 29 fixtures by reference;
no own dirs are needed for them.

## Scenario -> Fixture Map

| # | COCKPIT-2.0-SCOPE Scenario | Mode    | Fixture(s) used                               |
|---|----------------------------|---------|-----------------------------------------------|
| 1 | active                     | fixture | `fixtures/A1/`                                |
| 2 | blocked-gate               | fixture | `fixtures/A2/`                                |
| 3 | codex-timeout              | reused  | `../mission-strip/fixtures/F4/`               |
| 4 | codex-warned               | fixture | `fixtures/A4/` (+ `../mission-strip/fixtures/F5/` baseline) |
| 5 | no-private-KB              | smoke   | captured by `verify-boot-flags.ps1` C6 stdout |
| 6 | stale-data                 | reused + fixture | `../mission-strip/fixtures/F1/` (codex-stale) + `fixtures/A6/` (activity-stale) |
| 7 | forced-restart             | fixture | `fixtures/A7/`                                |
| 8 | no-tool-event              | fixture | `fixtures/A8/`                                |

The 6th reused fixture (F6) provides codex-unavailable evidence used by the
acceptance evidence package as a sanity baseline (KNOW-01 boundary).

## Run

```powershell
# Acceptance fixture suite (10 fixtures: 6 new + 4 reused). Exits 0 on full pass.
powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/tests/cockpit-acceptance/run-acceptance-fixtures.ps1

# Boot flag matrix + dashboard host static + README BOOT-03 audit (18 checks).
powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/tests/cockpit-acceptance/verify-boot-flags.ps1

# 3-run boot timing capture (recording-only; never gates on absolute time).
powershell -NoProfile -ExecutionPolicy Bypass -File super-gsd/tests/cockpit-acceptance/measure-boot.ps1
```

## Determinism Rules

Inherited verbatim from Phase 29 mission-strip suite:

- **mtime forge.** Each fixture's `meta.json` lists offset fields
  (`codex_mtime_offset_sec`, `activity_mtime_offset_sec`,
  `heartbeat_mtime_offset_sec`, `crit_mtime_offset_sec`). The runner sets
  `LastWriteTime` of each materialised data file to
  `(Get-Date).AddSeconds($offset)` deterministically per run.
- **ts placeholder substitution.** Activity-log and heartbeat JSONL rows use
  the literal `__TS_OFFSET_-NNN__`; the runner replaces these with ISO-8601
  strings so the lib's freshness band logic resolves predictably.
- **Per-fixture temp dir.** `$env:TEMP\sgsd-acceptance-{guid}/`, cleaned in
  `finally`; never touches the working tree.
- **ASCII-only literals.** PS 5.1 mojibake guard. No box-drawing chars in
  fixture content or harness output.
- **Live-or-Local.** Runner dot-sources the production lib at
  `super-gsd/scripts/lib/sgsd-mission-strip.ps1`. Edits to the lib are picked
  up on the next run with no fixture changes required.
- **Offline.** No network, no Codex CLI, no Claude spawn. The mutex check
  (C7) safely smokes the boot script which exits before Claude spawn.

## Lib-output reality vs. plan-spec semantics

The Plan T1 expected-output text for A1/A6/A8 originally read
`> agents active`/`stale`/`waiting`. The production lib does NOT freshness-gate
the agents enumeration; it emits `> agents <subagent_type names>` (or `--`).
This harness asserts the actual lib output and uses a secondary
`expected-model.txt` per fixture to assert Q1 model freshness state via the
`$state.modelColor` field (Green=active, Yellow=waiting, Red=stale, DarkGray=
unavailable). A7 additionally asserts `$state.next` contains
`ORCHESTRATOR-CHECKPOINT.md` for the Q8 forced-restart repair instruction.

This deviation from the plan's expected-output strings is documented in
`super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` "Deviations" section. It does
not require any lib edit (locked: verification-only phase).
