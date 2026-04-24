---
phase: 17
gate: "phase-level-ATC"
provider: "openai-codex"
model: "codex (gpt-5.4)"
invocation: "shellDispatch via codex-exec.sh --timeout-tier analysis"
date: "2026-04-24"
duration_ms: 156018
tier: "FULL"
exit_code: 0
---

# Phase 17 Phase-Level ATC — Codex

## Codex verdict

```
FINDINGS: 3
CRITICAL: 0
WARNINGS: 3
PASS_RATE: 3/6
ONE_LINER: Near-shippable, but MUDA qualitative reporting prevents a clean close.
```

## Scope reviewed

- Phase 17 as coherent unit — 28 files, 2243+/52- lines, 3 plans, 7 CLEAN items
- Invoked with `--timeout-tier analysis` (180s tier) after initial `--timeout-tier review` (120s) timed out on the broader phase scope — **signal worth capturing:** phase-level-ATC step-name should probably map to `analysis` tier, not `review`. File as Phase 18 CXOPS-02 follow-up (step-name map calibration).

## Cross-cutting dimensions reviewed

1. Integration coherence (CLEAN-07 4-site wiring)
2. Config-runtime contract (T3-fix config parse safety)
3. awk anchor brittleness (known WARNING from 17-01)
4. T1 JSDoc narrative drift (known WARNING from 17-01)
5. v1.2 archive integrity (self-contained vs ROADMAP-referencing)
6. Tag annotation quality

## Findings (3 WARNINGS, 0 CRITICAL)

Codex's 5-line contract only emits counts + 1-line summary. Per the ONE_LINER the primary concern is "MUDA qualitative reporting" — inference is Codex is still concerned about:

- The 17-01 fix-up (awk anchor insert) works functionally but the qualitative reporting pipeline as a whole has edge-case quality concerns that weren't fully resolved within Phase 17 scope
- Deferred signals (awk brittleness, JSDoc narrative) got acknowledged not fixed — by design (Phase 18 scope)
- Possibly a cross-cut concern about the `--timeout-tier review` being too tight for phase-level review itself (meta-signal — the gate's own timeout tier is misclassified)

Without a richer output format than the 5-line contract, we can't pinpoint the 3 warnings line-by-line. This is a known limitation — Phase 18 CXOPS-02 "contract validator" scope includes considering a richer output contract for phase-level review.

## Auto-mode decision (Rule 13)

`critical_count: 0` → gate PASSES. 3 WARNINGS logged as DEVIATIONS in the phase SUMMARY. Phase 17 ships.

## Token accounting (Phase 17 cumulative Codex spend)

| Invocation | Scope | Duration | Tier | Verdict |
|---|---|---|---|---|
| 17-01 first review | 17-01 diff (3 commits) | 80.6s | review | 1C + 1W |
| 17-01 re-review | 17-01 fix commit | 97.9s | review | 0C + 2W |
| 17-03 first review | 17-03 diff (7 commits) | 63.2s | review | 1C + 1W |
| 17-03 re-review | 17-03 fix commit | 105.2s | review | 0C + 0W |
| 17 phase-level (timeout) | phase summary | 120.0s | review | exit 5 |
| 17 phase-level | phase summary | 156.0s | analysis | 0C + 3W |
| **Total wall-clock** | | **622.9s** | | |

**6 Codex invocations for Phase 17.** 2 CRITICALs raised and both cleared via operator-directed fix-ups before advancing. 5 WARNINGS total, all deferred or accepted. 1 timeout (120s review tier too tight for phase-level scope — documented as Phase 18 follow-up).

## Observations for Phase 18 CXOPS scope

1. **step-name tier calibration** — `phase-level-ATC → review(120s)` in T3's resolver is too tight for multi-plan phase summaries. Should map to `analysis(180s)` instead. Or introduce a 5th tier (e.g. `extended(300s)`) for milestone-close scopes.
2. **Richer output contract** — 5-line contract hides phase-level findings detail. For phase-level review, consider optional extended fields (FINDINGS_DETAIL with per-warning bullet).
3. **Dual-gate timeout policy** — if `review` tier times out, auto-retry with `analysis` tier before falling back to Claude. Current behaviour was operator-mediated retry.
