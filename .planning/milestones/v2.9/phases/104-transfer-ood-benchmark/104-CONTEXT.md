---
phase: 104
phase_name: Transfer And OOD Benchmark
milestone: v2.9
created: 2026-04-30
status: queued
source: AHE transfer as overfit test
---

# Phase 104 - Context

Test whether candidate harness changes generalize.

AHE treats transfer as the overfit test. SGSD should do the same. A harness edit that improves one hidden deck but fails on a held-out deck or burns far more tokens is not a clean improvement.

## Goal

Extend the blind live benchmark path to support held-out decks and frozen candidate harness evaluation.

## Required Outputs

- `super-gsd/tools/harness-transfer/evaluate.cjs`
- `super-gsd/tools/harness-transfer/run-self-test.cjs`
- `super-gsd/tools/harness-benchmark/sgsd-blind-live-controller.mjs` updates if needed
- `.planning/metrics/harness-transfer.jsonl`

## Transfer Axes

- deterministic smoke deck
- hidden live deck
- held-out live deck
- no-VTP environment
- Codex unavailable environment
- fresh clone/new user environment
- PowerShell-only environment
- Warp-assisted environment

## Acceptance

1. Candidate harness state can be frozen and evaluated without further evolution.
2. Output reports success rate and token cost.
3. At least two environment-degradation modes are tested without changing the model.
4. Clean release requires no critical transfer regression.
