---
phase: 18
gate: "phase-level-ATC"
provider: "openai-codex"
model: "codex (gpt-5.4)"
invocation: "shellDispatch via codex-exec.sh --timeout-tier analysis"
date: "2026-04-24"
duration_ms: 124429
tier: "FULL"
exit_code: 0
---

# Phase 18 Phase-Level ATC — Codex

## Verdict

```
FINDINGS: 2
CRITICAL: 0
WARNINGS: 2
PASS_RATE: 4/6
ONE_LINER: Shippable, but Phase 18 overclaims dogfood and under-tests parse rigor.
```

## Scope reviewed

- Phase 18 as coherent unit — 14 files, 1489+/10- lines, 2 plans, 4 CXOPS items
- Invoked with `--timeout-tier analysis` (180s tier) from the start — applied lesson from Phase 17 where `--timeout-tier review` (120s) timed out on phase-level scope
- Duration 124s — well within 180s budget, no timeout

## Interpreting the 2 WARNINGs

ONE_LINER gives us direction; 5-line contract hides specifics:

### Warning A — "overclaims dogfood"
Likely concern: 18-02's DOGFOOD-AUDIT.md counts rows liberally. Candidate gaps:
- Counts `18-01` meta-dogfood as CXOPS-03 evidence — but 18-01 is the phase that IMPLEMENTED the validator, so its review is partially self-referential. A stricter reading might want dogfood evidence from an INDEPENDENT phase consuming the Codex path.
- Provider filter: does `"provider":"openai-codex"` alone satisfy CXOPS-03, or should rows be required to have valid (non-fallback, non-timeout) FINDINGS contracts? The DOGFOOD-AUDIT.md doesn't explicitly exclude fallback rows.
- "Cryptographic / semantic sufficiency" dimension from the prompt — evidence citation could be stronger with explicit row hashes or timestamps rather than counts.

### Warning B — "under-tests parse rigor"
Likely concern: validateContract has only been exercised against WELL-FORMED Codex output. No test case runs it against:
- Empty report
- Report with 4 fields instead of 5
- Report with fields in wrong order
- Report with extra lines after ONE_LINER
- Report where "FINDINGS" appears as substring (e.g., inside ONE_LINER prose)
- Report where the parse succeeds but the VALUES are garbage (e.g., "FINDINGS: abc" when expecting integer)

CXOPS-05 (richer validation / schema of contract fields) was explicitly deferred per Phase 18 CONTEXT, but this WARNING suggests it should be considered sooner than later.

## Auto-mode decision (Rule 13)

`critical_count: 0` → phase ships. 2 WARNINGs logged as DEVIATIONS. Auto-bypass not needed (non-critical).

## Token accounting (Phase 18 cumulative Codex spend)

| Invocation | Scope | Duration | Tier | Verdict |
|---|---|---|---|---|
| 18-01 per-dispatch (meta-dogfood) | 3 commits | 95.2s | review | 0C + 2W |
| 18 phase-level (this) | 14 files | 124.4s | analysis | 0C + 2W |
| **Phase 18 Codex total** | | **219.6s** | | |

Cumulative session Codex spend (Phases 17 + 18):
- 8 invocations
- 842.5s wall-clock
- ~17,000 Claude tokens saved via cross-vendor offload
- 0 fallbacks triggered (validateContract hasn't yet observed a parse failure in practice)
- 1 timeout (Phase 17 review-tier — resolved by analysis-tier retry)
- 2 CRITICALs raised + cleared (Phase 17 — none in Phase 18)
- 9 WARNINGs total (all deferred or accepted)

## Observations for Phase 19 richer-output-contract scope

The 2 Phase 18 WARNINGs and Phase 17's 3 WARNINGs all share a root cause: the 5-line contract hides finding detail. Phase 19 (or a scoped follow-up) should evaluate:
1. Optional `FINDINGS_DETAIL:` lines after the 5 required lines (codex-exec.sh parser would ignore; orchestrator could read)
2. A `DIMENSIONS:` tag that lists which of the prompt's review dimensions failed (currently hidden in PASS_RATE=N/M)
3. Tighter regex validation in validateContract (fields must be integer for FINDINGS/CRITICAL/WARNINGS; PASS_RATE must match `\d+/\d+`; etc.)

Without these, every ATC verdict requires interpretive guessing to act on. With them, operator sees exact line/concern pairs.

## Phase 18 deferral queue (growing)

- self-test exit precedence audit (from 18-01)
- parse-fallback gating edge-case coverage (from 18-01)
- dogfood audit strictness (from 18 phase-level)
- parse-rigor test corpus (from 18 phase-level)

Grouped into "Phase 19 richer-output-contract follow-up" for Phase 19 scoping.
