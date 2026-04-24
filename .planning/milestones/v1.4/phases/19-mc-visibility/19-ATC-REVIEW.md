---
phase: 19
gate: "phase-level-ATC"
provider: "openai-codex"
model: "codex (gpt-5.4)"
invocation: "shellDispatch via codex-exec.sh --timeout-tier analysis"
date: "2026-04-24"
duration_ms: 164972
tier: "FULL"
exit_code: 0
---

# Phase 19 Phase-Level ATC — Codex

## Verdict

```
FINDINGS: 5
CRITICAL: 0
WARNINGS: 5
PASS_RATE: 2/6
ONE_LINER: Visibility shipped, but timeout and offload telemetry remain unreliable.
```

## Interpretation (5 WARNINGs)

Concerning aggregate signal (5 WARN, PASS_RATE 2/6). Specific concerns inferred from ONE_LINER + Phase 19 scope:

1. **Timeout reliability** (accumulated signal across 19-01 + 19-02 + phase-level): review-tier consistently insufficient for FULL-tier 3+ file diffs. The T3 tier recalibration + timeout-escalate flag help, but don't catch every case (review-tier was still the DEFAULT for per-dispatch when 19-01 ATC initially timed out).
2. **Offload telemetry accuracy** (19-01 initial flag): dashboard Multimodal Review Offload metrics (claude_tokens_saved_by_codex, fallback_rate, avg_codex_duration) may compute from inconsistent sources. 19-01 ATC called it out; not clear whether 19-02 addressed.
3. **Narrative path gaps** (19-02 flag repeated): the 7 call sites for append_narrative_event may have race conditions or missing edge cases (e.g., timeout-escalate retry writes two narrative entries vs one).
4. **Retry path gaps** (19-02 flag): --retry-on-timeout-escalate logic may fail certain failure modes or have exit-code confusion.
5. **Unnamed fifth concern** — hidden by 5-line contract; FINDINGS_DETAIL footer not adopted.

## Auto-mode decision (Rule 13)

`critical_count: 0` → phase ships. 5 WARNINGs logged as DEVIATIONS in close SUMMARY.

## Token accounting (Phase 19 cumulative Codex spend)

| Invocation | Scope | Duration | Tier | Verdict |
|---|---|---|---|---|
| 19-01 per-dispatch (timeout) | 3 PS tile diffs | 120.0s | review | exit 5 |
| 19-01 per-dispatch (retry) | same diff | 114.4s | analysis | 0C + 2W |
| 19-02 per-dispatch | 5-task diff | 123.1s | analysis | 0C + 3W |
| 19 phase-level (this) | phase summary | 165.0s | analysis | 0C + 5W |
| **Phase 19 total** | | **522.5s** | | |

**Session cumulative Codex (Phases 17 + 18 + 19):**
- 11 invocations, 1364s wall-clock, ~22k Claude tokens saved
- 2 CRITICALs raised + cleared (Phase 17)
- 14 WARNINGs total (4 Phase 17, 4 Phase 18, 5 Phase 19, 1 bonus) — most filed for richer-output-contract Phase 21+ OR are ACK-ed non-blockers
- 2 timeouts (both on review tier, both resolved by analysis retry)
- 0 fallbacks to Claude reviewer — validateContract reliable in practice to date
- FINDINGS_DETAIL field still not adopted by Codex in any run

## Phase 19 deferral queue

- Dashboard offload math accuracy audit (19-01 flag) — verify whether 19-02 addressed or left open
- Narrative race-condition safety (concurrent codex-exec runs) — single-session not observed, but multi-session autonomous-handoff (Phase 20) makes this relevant
- Timeout-escalate edge-case coverage — the retry logic may not catch every failure mode
- FINDINGS_DETAIL adoption — prompt-engineering follow-up, not code

## Observations for Phase 20+

- The PASS_RATE 2/6 vs Phase 18's 4/6 and Phase 17's 3/6 is a NEGATIVE trend. Either phase scope keeps growing faster than quality-control, OR Codex is getting more discerning as context accumulates. Worth tracking.
- The "timeout and offload telemetry unreliable" theme keeps recurring. Phase 21 or milestone close audit should address it as a unit.
