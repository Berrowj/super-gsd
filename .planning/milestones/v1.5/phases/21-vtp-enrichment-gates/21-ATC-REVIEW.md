---
phase: 21
gate: "phase-level-ATC"
provider: "openai-codex"
model: "gpt-5.5"
reasoning_effort: "xhigh"
invocation: "shellDispatch via codex-exec.sh --timeout-tier custom:480"
date: "2026-04-24"
duration_ms: 406374
tier: "FULL"
exit_code: 0
escalation: "halt"
halt_reason: "2 CRITICAL findings on enabled VTP gate dispatch path"
---

# Phase 21 Phase-Level ATC — Codex (HALT triggered)

## Verdict

```
FINDINGS: 5
CRITICAL: 2
WARNINGS: 3
PASS_RATE: 2/6
ONE_LINER: HALT: enabled VTP gate cannot dispatch cleanly.
```

Duration 406.4s via `--timeout-tier custom:480` (two prior timeouts: analysis 180s + custom:300s). xhigh reasoning under load is slow.

## Halt semantics

Per `super-gsd/registry/gates.yaml` commit `01556d1`:
```yaml
phase-level-ATC:
  escalation: halt   # was log-only; changed during v1.5 Phase 21 session
```

The new halt escalation was explicitly enabled during Phase 21 session (operator directive Q3=A hard-required gate enforcement). Fires now as designed — 2 CRITICAL findings block orchestrator advance until operator intervenes.

## Auto-advance directive vs halt-on-CRIT

Operator directive: *"this entire process should be automatic, we should move on automatically without me. It goes research - plan - orchestrate go till complete milestone close."*

Orchestrator policy: phase-level-ATC halts on CRITICAL per gates.yaml (operator-approved).

Resolution: auto-advance means *"don't stop at trivial decisions"* — NOT *"ignore all blockers."* The halt here respects the operator's explicit Q3=A hard-required posture. CRITs signal the VTP gate implementation has dispatch-path bugs that would break the feature when enabled. Fixing before Phase 21 close is correct.

## Interpreting the 2 CRITICAL findings

ONE_LINER: "enabled VTP gate cannot dispatch cleanly." Specific bugs likely (5-line contract hides detail):

1. **Sub-agent dispatch missing**: Step 6.b.5 gate invocation in SKILL.md may reference an agent type (e.g. `sgsd-vtp-enrichment`) that doesn't exist as an agent file — reproduces 21-01 per-dispatch "missing agent" finding.
2. **Path mismatches**: VTP-ENRICHMENT.md path construction in gate module may not match the path gsd-planner.md reads from, breaking the artifact-theater-prevention contract.
3. **ctx/status wiring**: the gate result status (success/zero_hits/failure) may not be propagated correctly through sub-agent dispatch → orchestrator decision point.

## Session cumulative Codex (v1.5)

| Invocation | Scope | Duration | Verdict |
|---|---|---|---|
| 21-01 per-dispatch | 3-commit + SUMMARY | 252.5s custom:300 (after analysis timeout) | 2C+2W |
| 21-02 per-dispatch | 3-commit + SUMMARY | 160.5s analysis | 0C+4W |
| 21-03 per-dispatch | 296-line diff | 180s timeout → skipped | — |
| 21 phase-level (this) | phase summary | 406.4s custom:480 (3rd attempt) | 2C+3W |

Cumulative Phase 21 Codex wall-clock: ~920s. 2 of 4 runs hit timeout with xhigh reasoning (Codex 5.5 + reasoning_effort=xhigh is genuinely slower than 5.4 + none on equivalent scope — real cost of quality boost).

## Accepted WARNINGs (log only, non-blocking)

3 WARNINGs not individually enumerated in 5-line contract. Likely concerns from per-dispatch history + scope review:
- vtpCrossReference vs vtpCrossRef alias drift (from 21-02)
- audit table shape concerns (21-02 WARN)
- Minor error-handling or lint-class issues

## Exit path per SKILL.md

**Exit Condition #3: Blocker requiring human input.** Orchestrator halts here. Operator decides:

1. **`fix now`** — investigate the 2 CRITs (likely in vtp-enrichment-gate.cjs dispatch pattern + SKILL.md Step 6.b.5 agent name), ship surgical fix commits, re-run phase-level ATC until CRIT=0
2. **`ship with known CRITs`** — accept the CRITs as deferred, flip gates.yaml escalation back to log-only for now (operator policy change), document in Phase 21 SUMMARY as known-unenabled-debt, continue to Phase 22
3. **`pause`** — checkpoint here; resume next session with fresh context for CRIT investigation

Given Phase 21 IS the new gate itself (it can't safely enable until these CRITs clear), option 1 is architecturally correct. Option 2 ships a self-disabled feature with known bugs. Option 3 preserves autonomy but defers.

## Safety offset

`config.vtp_enrichment.enabled: false` default per D-07 → zero production impact until operator flips the switch. CRITs only matter at operator opt-in time. Phase 21 "shipped-but-disabled" is survivable; phase-complete status is gated on resolving these.
