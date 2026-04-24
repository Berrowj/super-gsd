---
schema_version: 2
phase: 19
plan: "19-02"
subsystem: mc-visibility
tags: [codex, narrative, live-feed, validate-contract, parse-rigor, timeout-tier]
dependency_graph:
  requires: ["19-01"]
  provides: ["MC-03", "MC-04", "D-05-#3", "D-05-#4", "D-05-#5", "D-05-#6", "D-05-#7", "D-05-#9"]
  affects: ["codex-exec.sh", "sgsd-live-feed.ps1", "sgsd-orchestrate/SKILL.md"]
tech_stack:
  added: ["super-gsd/tests/codex-contract-fixtures/", "super-gsd/tests/run-parse-fuzz.sh"]
  patterns: ["snapshot-diff polling", "exec loop-prevention", "validateContract regex guards"]
key_files:
  created:
    - super-gsd/tests/codex-contract-fixtures/ok.txt
    - super-gsd/tests/codex-contract-fixtures/missing-field.txt
    - super-gsd/tests/codex-contract-fixtures/non-integer-findings.txt
    - super-gsd/tests/codex-contract-fixtures/wrong-pass-rate.txt
    - super-gsd/tests/codex-contract-fixtures/extra-trailing-lines.txt
    - super-gsd/tests/codex-contract-fixtures/empty-report.txt
    - super-gsd/tests/codex-contract-fixtures/substring-findings.txt
    - super-gsd/tests/run-parse-fuzz.sh
  modified:
    - super-gsd/scripts/codex-exec.sh
    - super-gsd/scripts/sgsd-live-feed.ps1
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
decisions:
  - "append_narrative_event writes directly from codex-exec.sh (D-04 pattern); sgsd-narrative.ps1 unchanged"
  - "snapshot-diff polling (1500ms) replaces Get-Content -Wait to allow dual-source without blocking"
  - "exec replaces process for timeout-escalate retry to prevent fork bomb"
  - "validateContract FINDINGS_DETAIL lines accepted via optional comment instruction, not required[]"
  - "run-parse-fuzz.sh uses Node.js ESM temp-file mirror to avoid bash quoting hazards"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-24"
  tasks_completed: 5
  tasks_total: 5
  files_changed: 11
---

# Phase 19 Plan 02: Event Capture + Richer Output — Summary

**One-liner:** MC-03 narrative writer + MC-04 dual-source live-feed + D-05 #3/#4/#5/#6/#7/#9 parse/dispatch hardening across codex-exec.sh and SKILL.md with 7-fixture fuzz runner.

## Tasks Completed

| Task | Commit  | Description |
|------|---------|-------------|
| T1   | 94267b6 | append_narrative_event() + 6 call sites in codex-exec.sh (MC-03) |
| T2   | 20dd894 | sgsd-live-feed.ps1 dual-source snapshot-diff poll loop (MC-04) |
| T3   | 132a933 | phase-level-ATC -> analysis tier + --retry-on-timeout-escalate flag |
| T4   | 827092f | FINDINGS_DETAIL optional footer + validateContract regex guards |
| T5   | 5ac0bc8 | --self-test-exit-priority flag + 7 parse-rigor fixtures + fuzz runner |

## Verification Results

```
T1: grep -c 'append_narrative_event' codex-exec.sh     => 7  PASS
T2: grep -q 'codex-log.jsonl' sgsd-live-feed.ps1       => PASS
    No Get-Content -Wait in executable code             => PASS
    PS AST parse                                        => PASS
T3: timeoutTier line 541 = 'analysis'                  => PASS
    timeoutTier line 983 = 'analysis'                  => PASS
    timeoutTier line 1120 = 'review' (adversarial)     => PASS
    grep retry-on-timeout-escalate codex-exec.sh        => PASS
T4: grep FINDINGS_DETAIL SKILL.md                      => PASS
    validateContract has /^\d+$/ and /^\d+\/\d+$/      => PASS
T5: bash run-parse-fuzz.sh                             => 7 passed, 0 failed
```

## Deviations from Plan

### Auto-additions (Rule 2 — missing critical functionality)

**1. SELF_TEST_EXIT_PRIORITY default added in T3 commit**
- The T5 `--self-test-exit-priority` flag required `SELF_TEST_EXIT_PRIORITY=false` default in the Defaults block. Since T3 already modified codex-exec.sh's arg-parsing section, the default and arg-parser entry were included there rather than creating a separate T5 edit of the same region. This follows the plan's serialisation requirement (T3 ships before T5).

**2. sgsd-narrative.ps1 not modified**
- Per plan `known_deadends` and RESEARCH GAP-1: write path belongs in codex-exec.sh only. sgsd-narrative.ps1 already reads narrative.md for display. No modification needed or made.

**3. run-parse-fuzz.sh uses temp-file ESM pattern instead of heredoc inline**
- Plan showed `${content@Q}` (bash 4.4+ operator) and heredoc inline Node.js. Replaced with a temp `.mjs` file written once per run to avoid bash quoting hazards with fixture content containing special characters. Behaviour is identical; exit 0 on all 7 assertions confirmed.

## Known Stubs

None — all 5 surfaces wired to real data paths.

## Threat Flags

None beyond the plan's STRIDE register. No new network endpoints or auth paths introduced.

## Self-Check: PASSED

All created/modified files present on disk. All 5 task commits found in git log.
