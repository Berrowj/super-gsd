---
phase: 55
name: Provider Backpressure + Timeout Circuits
milestone: v2.0
type: research
synthesized_at: 2026-04-29
synthesis_rule: "compressed-phase research per dispatch rule #1"
---

# Phase 55 Research - Provider Backpressure + Timeout Circuits

## 1. Goal (verbatim ROADMAP-AGENT.md:664)

Existing timeout-tier hardening + circuit breaker (N consecutive provider
failures -> switch provider for milestone).

Locked decision: 55=B.

## 2. Background - what already exists

Phase 14 shipped the codex-CLI provider substrate (codex-exec.sh) including:

- Per-step timeout tiers (default 60s / review 120s / analysis 180s) wired
  through .planning/config.json review_providers.codex_timeout_tiers.
- D-05 #5 retry-on-timeout-escalate: phase-level-ATC steps that timed out on
  review tier retry once on analysis tier via exec().
- INSTR-03 (Phase 25): codex-timeout-observability.jsonl emission feeds the
  Mission Control "timeout rate by tier" tile.
- D-01a exit codes 1/3/4/5/6 (generic / no-binary / auth-deny / timeout /
  contract-violation).

What is missing from the timeout-tier hardening: there is no MEMORY of
provider failures across invocations. Three back-to-back codex review
timeouts produce three identical retry attempts with no escalation away
from codex.

The circuit breaker closes that loop: after N=3 consecutive failures in a
single milestone, codex is marked unavailable for the rest of the milestone
and the caller routes to Claude (the wired fallback reviewer for the
code-reviewer-v1 contract).

## 3. State shape (schema_version 1)

```
{
  "schema_version": 1,
  "milestones": {
    "<milestone-id>": {
      "<provider-name>": {
        "consecutive_failures": <int>,
        "last_failure_ts": "<ISO8601 | null>",
        "fallback_active": <bool>,
        "last_success_ts": "<ISO8601 | null>"
      }
    }
  }
}
```

Persisted at `.planning/metrics/provider-circuit.json`. Atomic writes via
tmp+rename. Lock 13: missing file degrades to empty-state sentinel.

## 4. Trigger / reset rules

- TRIGGER: consecutive_failures >= THRESHOLD (default 3, env-overridable
  via SGSD_CIRCUIT_FAILURE_THRESHOLD).
- RESET: a single ok=true record clears consecutive_failures and sets
  fallback_active=false. The single-success rule is intentionally
  asymmetric (3 failures to open, 1 success to close) to give codex a fast
  re-entry path once the upstream issue clears.
- EXPLICIT RESET: resetCircuit({milestone, provider}) called at milestone
  close (the milestone is closing anyway; we want the next milestone to
  start with a clean slate even if the previous one closed with the
  circuit open).

## 5. Public API surface (6 functions, Lock-13 wrapped)

| API                       | Inputs                              | Output                                                   |
| ------------------------- | ----------------------------------- | -------------------------------------------------------- |
| getCircuitState           | {milestone, provider}               | {ok, state:{consecutive_failures,...}, source}           |
| recordProviderResult      | {milestone, provider, ok, ts?}      | {ok, new_state, fallback_triggered, source}              |
| shouldFallback            | {milestone, provider}               | {fallback_active, threshold, consecutive_failures}       |
| resetCircuit              | {milestone, provider}               | {ok, prior_state, source}                                |
| getDefaultFallback        | provider                            | 'claude' for codex, null otherwise                       |
| selfTest                  | -                                   | {ok, results:[...]} (>=8 assertions)                     |

All wrappers try/catch around an _Impl helper. Never throw upward.

## 6. codex-exec.sh integration (surgical)

New optional --milestone flag. When set (and not "none"):

1. BEFORE invoking codex CLI: call provider-circuit.cjs.shouldFallback. If
   fallback_active=true, exit 7 immediately. Caller routes to Claude.
2. AT EACH EXIT PATH (timeout / auth-deny / generic-error /
   contract-violation / success): call recordProviderResult with ok=false
   for failures or ok=true for success.

Lock 4: when --milestone is unset OR equals "none", the entire block is a
no-op. Phase 14-54 invocation paths remain byte-equivalent.

Lock 13: any failure in the probe (node missing, lib missing, parse error)
degrades silently to "no fallback" -- we never block a codex call because
the probe broke.

## 7. v2.0 quint-gate wire (sgsd-complete-milestone.cjs)

Sequence:

1. context-bench self-test (Phase 51, 33/33)
2. redis-adapter self-test (Phase 52, 26/26)
3. failure-injection self-test (Phase 53, 24/24)
4. failure-injection --run-all (Phase 53, 10/10)
5. chaos-restart self-test (Phase 54, 18/18)
6. NEW: provider-circuit self-test (Phase 55, >=12/12)

All six spawnSync invocations must exit 0 for the v2.0 gate to exit 0.
Lock 4: insertion is purely additive after the chaos-restart green
emission; v1.9 dual-gate path preserved byte-untouched.

## 8. Acceptance fixture (verbatim ROADMAP-AGENT.md:668-670)

> Test fixture: 3 consecutive Codex failures auto-switch to Claude
> reviewer for milestone

Encoded as self-test assertion A1 (threshold_3_consecutive_failures_
opens_circuit): three recordProviderResult({ok:false}) calls in a row
flip fallback_active to true at the third record (boundary crossing).

> Circuit state persisted in .planning/metrics/provider-circuit.json with
> reset rule

Encoded as self-test assertion A2 (reset_rule_single_success_closes_open_
circuit) AND A3 (state_persistence_roundtrip): single ok=true record clears
the open circuit; the persisted file round-trips schema_version + last_
failure_ts byte-equal.

End-to-end verified: an open-circuit fixture + bash codex-exec.sh
--milestone v2.0 exits 7. The same call with --milestone none ignores the
fixture and runs codex normally.

## 9. Lock invariants

- Lock 4: Phase 41-54 trees byte-untouched EXCEPT codex-exec.sh +
  sgsd-complete-milestone.cjs surgical extensions (acceptance contract per
  ROADMAP-AGENT.md).
- Lock 11: provider-name and milestone-id matched via byte-equality only
  (DEFAULT_FALLBACK lookup is hasOwnProperty + bracket index).
- Lock 13: every public API try/catch wraps an _Impl. Probe failures in
  bash degrade to "no fallback".
- ASCII-only across provider-circuit.cjs and the new helper functions in
  codex-exec.sh.

## 10. Out-of-scope (deferred)

- Per-tier circuit (separate counter for review vs analysis tier
  failures). Phase 56 candidate.
- Multi-provider topology (provider chain longer than codex -> claude).
  Phase 56-57 candidate.
- Time-decay reset (consecutive_failures decays over wall-clock time even
  without an ok record). Phase 56 candidate.
