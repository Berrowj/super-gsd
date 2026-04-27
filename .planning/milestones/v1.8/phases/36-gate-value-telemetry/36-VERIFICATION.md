---
phase: 36
plan: 36-01
status: PASS
verified: 2026-04-27
unresolved_count: 0
goal_achieved: true
re_verification: true
re_verification_reason: "Phase-level ATC dual-provider surfaced 2 CRITs (cross-ledger status divergence on critical-halt; phase-level Codex warn-vs-pass misclassification) + 4 Claude WARNs (LOC overrun informational; CLI cwd-fallback regression; status-enum-validation gap; flaky run_id assertion). 5 fixed in-loop, 1 informational."
atc_review: 36-ATC-REVIEW.md
atc_anti_slop_combined_estimated: "~9.5/10"
requirements: [GVAL-01, GVAL-02, GVAL-03, GVAL-04]
---

# Phase 36 Verification (GVAL-01..04)

## Goal Achievement

**Y** -- ships Gate Value Telemetry: 8th envelope-v1 emitter
(`gate-value-log.cjs`) with 6 SKILL.md wire-ins (3 sites x SKIP+FIRE arms)
+ 4-fixture local fallback test. Cross-ledger status parity preserved
(critical-halt verdict produces same envelope status across both
gate-value-log and review-ledger). Codex shell-path verdict classification
correctly distinguishes warn from pass.

## GVAL-01..04 Verification

| Req | Statement | Status | Evidence |
|-----|-----------|--------|----------|
| GVAL-01 | --self-test exits 0 (12+ assertions PASS) | PASS | 14/14 PASS post-fix (was 14/14 pre-fix; format unchanged after CRIT fix to F3 fixture) |
| GVAL-02 | SKILL.md grep for logGateValue\\( returns >=3 | PASS | 6 sites (3 phase-level-ATC + per-dispatch-ATC + MUDA-waste-audit, each on SKIP + FIRE arms) |
| GVAL-03 | rows have gate, outcome ∈ OUTCOMES, phase, milestone, ts, run_id, retroactive | PASS | _normalize emits all 13 envelope-v1 required fields + 3 extension fields (gate, outcome, retroactive). _assertEnvelopeV1 enforces 13 required + status enum + run_id pattern + duration_ms type + evidence/artifacts shape |
| GVAL-04 | --summary aggregates by gate | PASS | summarize() returns {gate, fires, pass, warn, block, skip, fire_rate, value_score} per gate. value_score = max(0, (pass + 0.5*warn - block) / fires) when fires > 0, else null (Phase 39 defer-on-empty) |

## Cross-ledger parity check (Phase 36 ATC C1 fix)

```
verdict 'critical-halt' -> outcome 'block' -> envelope status 'blocked'
matches review-ledger.cjs:69 LEGACY_VERDICT_MAP['critical-halt'].status
```

## Codex-path classification check (Phase 36 ATC C2 fix)

```
outcomeFromVerdict(undefined, 0, 5) -> 'warn'  (Codex review: 0 CRIT, 5 WARN)
outcomeFromVerdict(undefined, 0, 0) -> 'pass'  (Codex review: 0 CRIT, 0 WARN)
outcomeFromVerdict(undefined, 1, 5) -> 'block' (Codex review: 1 CRIT, 5 WARN)
outcomeFromVerdict('pass', 0, 0)    -> 'pass'  (verdict-string path)
```

## ATC Findings (all in-loop fixed except 1 informational)

See `36-ATC-REVIEW.md` for full unified report. Summary:

- **2 CRITs** (Claude+Codex): cross-ledger status divergence + phase-level
  Codex warn-vs-pass misclassification. Both fixed in-loop.
- **4 WARNs** (Claude): LOC overrun (informational, no fix), --summary CLI
  cwd-fallback regression, status-enum-validation gap, flaky run_id
  assertion. 3 fixed in-loop, 1 informational.

Combined anti-slop estimated post-fix: ~9.5/10.

## No-modification proof

`git log` confirms Phase 36 commits (`0f6a630`, `a0b7c2c`, `26d02fa`, plus
post-ATC fixes) touched ONLY:
- super-gsd/scripts/lib/gate-value-log.cjs (NEW)
- super-gsd/skills/sgsd-orchestrate/SKILL.md (modified, +151 lines for 6
  wire-ins)
- super-gsd/scripts/lib/gate-value-log.test.cjs (NEW)

The 4 existing contracts + Phase 31 envelope-v1 contract are UNTOUCHED.

## Status-consistency

```
node super-gsd/tools/status-consistency/check.cjs --milestone v1.8
-> status-consistency milestone v1.8: OK
```

## Closing verdict

**PASS** -- Phase 36 ships v1.8's first phase. Gate-value telemetry
primitive online; 4 in-phase consumers (3 wire-ins + --summary CLI);
Phase 38 sampling-decider + Phase 39 keep/kill rubric will consume
this stream in subsequent phases.
