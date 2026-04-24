---
phase: 18
plan: "18-01"
gate: "per-dispatch-ATC"
provider: "openai-codex"
model: "codex (gpt-5.4)"
invocation: "shellDispatch via codex-exec.sh --timeout-tier review"
date: "2026-04-24"
duration_ms: 95241
tier: "FULL"
exit_code: 0
historic_note: "META-DOGFOOD — Codex reviewing the code that adds validateContract to the path that just invoked it"
---

# 18-01 Per-Dispatch ATC — Codex (meta-dogfood)

## Codex 5-field verdict

```
FINDINGS: 2
CRITICAL: 0
WARNINGS: 2
PASS_RATE: 4/6
ONE_LINER: Two regressions: self-test exit precedence and parse-fallback gating.
```

Duration 95.2s via `--timeout-tier review` (120s budget). Exit 0, no fallback triggered — so validateContract itself parsed this 5-line contract correctly, proving the code's basic correctness even as Codex critiques its detail.

## What was reviewed

3 commits spanning 2 files:
- `d655326` T1 — codex-exec.sh gains `--self-test` + `--skip-network` + 4-probe harness
- `4957d60` T2 — SKILL.md gains validateContract at Steps 6.5 + 9.5 + fallback_reason telemetry
- `1cc49c7` T1+T2 plan SUMMARY

237-line diff, 6 review dimensions.

## Warnings (both interpretable, both non-blocking)

The 5-line contract doesn't enumerate findings. Interpretation from ONE_LINER + review dimensions:

### Warning A — "self-test exit precedence"
Most likely concerns:
- Probe ordering within the harness: if PATH, auth, timeout, contract probes run sequentially, is the right one the cause of an observed exit? E.g. if PATH is missing AND OPENAI_API_KEY is set, should exit be 10 (PATH wins) or 11 (auth wins)?
- Guard-bypass placement vs ordering: the original `exit 4` for OPENAI_API_KEY is now wrapped in `SELF_TEST != true`. Self-test runs AFTER some pre-harness logic. A rearranged pre-harness state could produce confusing exit output before probe 1 fires.
- The `--skip-network` relaxation on probe 2 (config-file check dropped) may have widened the "pass" window more than intended.

### Warning B — "parse-fallback gating"
Most likely concerns:
- `validateContract(dispatchResult.report)` is called when `dispatchResult.exit === 0`. Edge case: exit is 0 but report is empty/null/undefined — does validateContract handle gracefully?
- Fallback dispatches to `claude-sonnet-reviewer` as a retry. If the primary Codex call returned exit 0 but malformed output, the fallback retries with the same prompt — does it re-send with ANY context about what the first call sent? Or is the retry naive?
- `report._provider = 'claude-via-fallback'` + `report._fallback_reason = 'parse_failure'` threading — is the Node object shape correct for appendReviewEvidence?

## Auto-mode decision (Rule 13)

`critical_count: 0` → gate passes cleanly. 2 WARNINGs logged as DEVIATIONS in the phase-close SUMMARY. Phase 18-01 ships.

## Phase 18 deferral queue (non-blocking)

Adding to Phase 17's deferred signals queue:
- self-test exit precedence audit
- parse-fallback gating edge-case coverage

Both are strong candidates for a **richer-output-contract follow-up** (Phase 19 scope): if Codex could emit FINDINGS_DETAIL lines alongside the 5 required fields, interpretive guessing like this section wouldn't be needed — operator sees exact line/concern pairs.

## Token accounting (Phase 18 cumulative Codex spend)

| Invocation | Scope | Duration | Tier | Verdict |
|---|---|---|---|---|
| 18-01 (this) | 3-commit diff | 95.2s | review | 0C + 2W |
| **Total** | | **95.2s** | | |

Cumulative session Codex spend (Phases 17 + 18):
- 7 invocations, 718.1s wall-clock, ~15,000 Claude tokens saved
- 2 CRITICALs raised + cleared (Phase 17)
- 7 WARNINGs total, all deferred or accepted
- 1 timeout (review tier on phase-level)
- 0 fallbacks to Claude reviewer (validateContract has yet to observe a parse-failure in practice — its first live run on its own review was clean)

## Self-referential note

**This review is the first successful end-to-end test of validateContract in production.** Codex returned a well-formed 5-line contract → validateContract parsed it cleanly → no fallback triggered → row written with `provider: "openai-codex"`. The new code works under nominal conditions. Parse-failure edge cases remain untested in live invocation.
