---
phase: 55
name: Provider Backpressure + Timeout Circuits
milestone: v2.0
depends_on: [54]
unblocks: [56, 57]
synthesized_at: 2026-04-29
synthesis_rule: "auto per dispatch rule #1"
---

# Phase 55 Context — Provider Backpressure + Timeout Circuits

## Goal (verbatim ROADMAP-AGENT.md:664)

Existing timeout-tier hardening + circuit breaker (N consecutive provider failures → switch provider for milestone).

## Locked Decision: 55=B

## Required Outputs

- New: `super-gsd/scripts/lib/provider-circuit.cjs`
- Edit: `super-gsd/scripts/codex-exec.sh` (or wrapper) for circuit-breaker logic — surgical, preserves existing v1.9 behavior
- New: `.planning/metrics/provider-circuit.json` (circuit state, persisted)
- Fixture: 3-consecutive-Codex-failures synthetic test
- 55-* artifacts

## Acceptance (verbatim 668-670)

- Test fixture: 3 consecutive Codex failures auto-switch to Claude reviewer for milestone
- Circuit state persisted in `.planning/metrics/provider-circuit.json` with reset rule

## Design

- `provider-circuit.cjs` exports `getCircuitState({milestone})` + `recordProviderResult({milestone, provider, ok})` + `shouldFallback({milestone, provider})` Lock 13 wrapped
- N=3 consecutive failures threshold; configurable via env SGSD_CIRCUIT_FAILURE_THRESHOLD (default 3)
- Reset rule: 1 successful invocation closes the circuit; OR explicit milestone close
- State shape: `{schema_version: 1, milestones: {<v>: {<provider>: {consecutive_failures: N, last_failure_ts, fallback_active: bool, last_success_ts}}}}`
- ASCII-only

## Lock Invariants

- Lock 4: Phase 41-54 byte-untouched EXCEPT codex-exec.sh surgical extension (mirrors Phase 53 T6/T7 SKILL.md surgical extension precedent)
- Lock 11: provider-name match via byte-equality only (no fuzzy)
- Lock 13: never throws; missing state file → degraded sentinel
- ASCII-only

## Hand-off

Single executor dispatch (compressed phase): build provider-circuit.cjs + codex-exec.sh extension + 8-12 self-tests + fixture + 55-* artifacts + v2.0 quint-gate wire (add provider-circuit self-test to sgsd-complete-milestone.cjs).
