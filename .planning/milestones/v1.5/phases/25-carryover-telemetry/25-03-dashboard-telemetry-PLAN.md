---
schema_version: 2
phase: 25
plan: 25-03
plan_name: Dashboard math + timeout observability (INSTR-02 + INSTR-03)
milestone: v1.5
status: shipped
expected_ATC_tier: LITE
model: sonnet
depends_on: []
created: 2026-04-25
files_touched:
  - super-gsd/scripts/lib/sgsd-codex-status.ps1
  - super-gsd/scripts/codex-exec.sh
tasks:
  - id: T-25-03-1
    hypothesis: |
      Adding inline JSDoc-style audit comments to Get-SgsdCodexStatus
      documenting math semantics for tokenRows / codexDispatches /
      fallbackCount / claudeTokensSaved / fallback_rate makes the
      dashboard math reviewable + future-edit-safe. (INSTR-02)
    files_touched:
      - super-gsd/scripts/lib/sgsd-codex-status.ps1
    action: |
      1. Add a comment block above the codexRows / fallbackRows / reviewRows
         filter chain documenting what each counter MEANS and what it
         deliberately INCLUDES/EXCLUDES.
      2. State the fallback_rate denominator (codexDispatches + fallbackCount
         — total review-intent invocations) so consumer-side mission-control
         doesn't drift.
      3. State that claudeTokensSaved excludes fallback rows (because Claude
         did run for those — the savings are real only when codex completed).
    verification:
      - cmd: grep -c "INSTR-02 .v1.5 Phase 25" super-gsd/scripts/lib/sgsd-codex-status.ps1
        expect: ">= 1"
  - id: T-25-03-2
    hypothesis: |
      Adding `codex-timeout-observability.jsonl` row emit at the timeout
      branch in codex-exec.sh gives the dashboard observable timeout-rate-
      by-tier data. (INSTR-03)
    files_touched:
      - super-gsd/scripts/codex-exec.sh
    action: |
      1. In the `RC -eq 124` branch (~line 559), after the existing
         write_live_state + append_jsonl + append_narrative_event calls,
         add a block that appends one row to
         `.planning/metrics/codex-timeout-observability.jsonl`:
         {ts, tier_requested, tier_actual_via_retry, duration_ms, exit_code,
          step, phase, plan}.
      2. Compute tier_actual_via_retry: when --retry-on-timeout-escalate
         is set + step is phase-level-ATC, append "->analysis(retry)" to
         the requested tier label.
      3. Use mkdir -p before the append + 2>/dev/null || true everywhere so
         the emit never breaks the timeout path.
    verification:
      - cmd: bash -n super-gsd/scripts/codex-exec.sh
        expect: exit 0
      - cmd: grep -c "INSTR-03 .v1.5 Phase 25" super-gsd/scripts/codex-exec.sh
        expect: ">= 1"
      - cmd: grep -c "codex-timeout-observability.jsonl" super-gsd/scripts/codex-exec.sh
        expect: ">= 1"
---

# 25-03 — Dashboard math + timeout observability

Two telemetry items shipped:

## INSTR-02 — dashboard math audit

Inline audit comments documenting the math semantics for `tokenRows`,
`codexDispatches`, `fallbackCount`, `claudeTokensSaved`, and the
`fallback_rate` denominator. No math changes — the existing implementation
is sound; the audit deliverable is the documentation that prevents future
drift.

## INSTR-03 — timeout observability metric

New `.planning/metrics/codex-timeout-observability.jsonl` written at every
RC=124 timeout event. Dashboard tile "timeout rate by tier" can now report
chronic under-budgeting per tier (review/analysis/custom:N). Includes a
`tier_actual_via_retry` field that distinguishes "timed out and retried"
from "timed out and exited" for analysis-tier escalation accounting.

## Risk

Low — both changes are append-only and degrade gracefully (mkdir -p,
2>/dev/null || true).
