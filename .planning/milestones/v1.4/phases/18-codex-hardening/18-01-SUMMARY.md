---
phase: 18
plan: "18-01"
subsystem: codex-hardening
tags: [codex, self-test, contract-validation, fallback, telemetry]
dependency_graph:
  requires: []
  provides: [CXOPS-01, CXOPS-02]
  affects: [sgsd-readiness, commit-reviews.jsonl, codex-log.jsonl]
tech_stack:
  added: []
  patterns: [4-probe-self-test, validateContract-secondary-check, parse_failure-fallback-telemetry]
key_files:
  created: []
  modified:
    - super-gsd/scripts/codex-exec.sh
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
decisions:
  - "Probe 2 auth check relaxed to key-absence-only when --skip-network, as config file is only needed for real Codex calls (probe 4)"
  - "Self-test harness placed after resolve_timeout_tier/detect_root definitions (not at arg-parse point) to avoid calling undefined functions under set -u"
  - "validateContract defined once above Step 6.5, reused at Step 9.5 — single definition, two call sites"
metrics:
  duration: "~25 minutes"
  completed: "2026-04-24T13:08:25Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 18 Plan 01: Codex Hardening — Code Hardening Summary

**One-liner:** `--self-test` 4-probe harness (exit 10-13) + `validateContract` parse_failure single-retry fallback wired into SKILL.md Steps 6.5 and 9.5.

## Tasks Completed

| Task | Commit | Files | Status |
|------|--------|-------|--------|
| T1: CXOPS-01 --self-test + --skip-network | d655326 | codex-exec.sh | Done |
| T2: CXOPS-02 validateContract at Steps 6.5/9.5 | 4957d60 | SKILL.md | Done |

## Verification Evidence

| Check | Command | Result |
|-------|---------|--------|
| T1 syntax | `bash -n codex-exec.sh` | exit 0 |
| T1 basic | `bash codex-exec.sh --self-test --skip-network` | exit 0, probes 1-3 PASS, probe 4 SKIPPED |
| T1 strengthened | `OPENAI_API_KEY=fakekey bash codex-exec.sh --self-test --skip-network` | exit 11 (probe 2 discrimination confirmed) |
| T1 JSONL | `codex-log.jsonl` | 3 rows written with `step:"self-test"` + `self_test_probes` object |
| T2 basic | `grep -c 'validateContract' SKILL.md` | 4 (definition + 2 call sites + comment) |
| T2 strengthened | `grep -q 'fallback_reason' SKILL.md` | exit 0 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Self-test harness placed after function definitions, not at arg-parse point**

- **Found during:** T1 execution
- **Issue:** The self-test harness draft called `resolve_timeout_tier` and `detect_root` before those functions were defined in the file. Under bash `set -u`, variables `TIER_REVIEW` (set by config-driven tier block) would also be unset at that point, causing probe 3 to always exit 12.
- **Fix:** Moved the self-test harness to after `resolve_step_timeout` ends (~line 210), where `detect_root`, `ROOT`, `TIER_REVIEW`, and `resolve_timeout_tier` are all defined.
- **Files modified:** `super-gsd/scripts/codex-exec.sh`
- **Commit:** d655326

**2. [Rule 1 - Bug] Probe 2 config-file check blocked --skip-network exit-0 contract**

- **Found during:** T1 verification — `--self-test --skip-network` returned exit 11 (no `~/.codex/config.json` in this environment)
- **Issue:** The plan's output_contract requires `--self-test --skip-network` to exit 0. But probe 2 checked for the OAuth config file unconditionally. In CI/offline environments without Codex installed, the config file doesn't exist, so probe 2 always failed.
- **Fix:** When `--skip-network` is true, probe 2 checks only that `OPENAI_API_KEY` is absent (key-absence is sufficient for offline mode; config file is only needed for real Codex calls in probe 4).
- **Files modified:** `super-gsd/scripts/codex-exec.sh`
- **Commit:** d655326

## Known Stubs

None. Both features are fully wired:
- `--self-test` exits with real probe results and writes real JSONL rows
- `validateContract` at Steps 6.5/9.5 invokes real fallback Agent call on parse failure

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond what the plan's threat model covers. The self-test harness adds a file-existence check for `~/.codex/config.json` (presence only, no content read — T-18-02 accepted). The `validateContract` function operates on an in-memory string with no eval or execution (T-18-04 mitigated).

## Self-Check: PASSED

- `super-gsd/scripts/codex-exec.sh` exists and contains `--self-test`, `--skip-network`, and self-test harness
- `super-gsd/skills/sgsd-orchestrate/SKILL.md` exists and contains `validateContract` (4 occurrences) and `fallback_reason`
- Commit d655326 exists in git log
- Commit 4957d60 exists in git log
- JSONL rows with `step:"self-test"` confirmed in `.planning/metrics/codex-log.jsonl`
