---
phase: 15
plan: "15-04"
subsystem: sgsd-orchestrate
tags: [adversarial-verifier, cross-vendor, codex, mach-04, codex-11]
dependency_graph:
  requires: [15-01]
  provides: [cross-vendor-adversarial-challenger]
  affects: [sgsd-orchestrate/SKILL.md]
tech_stack:
  added: []
  patterns: [non-primary-vendor-routing, skip-on-unavailable-no-fallback]
key_files:
  modified:
    - super-gsd/skills/sgsd-orchestrate/SKILL.md
decisions:
  - "Adversarial challenger routes to codex-cli-reviewer via shellDispatch when primary is Claude (always, Phase 15)"
  - "Skip entirely (VERIFIER_ADVERSARIAL_SKIP) when Codex unavailable — no same-vendor fallback (D-17a)"
  - "Does NOT use gates.resolveReviewerProvider — adversarial routing is orthogonal to gate-reviewer routing (D-16a)"
  - "Sampling rate config.atc.verifier_adversarial_rate=0.2 unchanged (D-16)"
  - "Token-log row: role adversarial_verifier, provider openai-codex feeds CODEX-10 offload metric (D-18)"
metrics:
  duration: "~5 minutes"
  completed: "2026-04-24"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 15 Plan 04: Cross-Vendor Adversarial Challenger Summary

**One-liner:** SKILL.md Step 9.6 MACH-04 adversarial challenger rewired to always dispatch to `codex-cli-reviewer` via `shellDispatch` when primary is Claude, with skip-on-unavailable semantics (no same-vendor fallback) per CODEX-11.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| T1 | SKILL.md Step 9.6 cross-vendor adversarial challenger | a93de2f | super-gsd/skills/sgsd-orchestrate/SKILL.md |

## What Was Built

Replaced the single-line `Agent(subagent_type: "gsd-verifier", model: "sonnet", ...)` dispatch at Step 9.6 `c.` with a 60-line cross-vendor challenger block that:

1. Determines primary provider (`claude-sonnet-verifier` — Phase 15 constant)
2. Resolves challenger as the OTHER vendor (`codex-cli-reviewer` for Claude primary; `claude-sonnet-reviewer` for future Codex-primary path)
3. Checks Codex availability (`codex_enabled` + `codexAuthFailed`) — skips entirely on unavailability logging `VERIFIER_ADVERSARIAL_SKIP`, with explicit comment that this is intentional (D-17a: same-vendor challenger defeats the purpose)
4. Dispatches via `shellDispatch` for shell-invocation providers (the normal Codex path) with proper `promptFile`/`reportOut`/`timeout` params using existing helpers from 15-01
5. Appends token-log row with `role: 'adversarial_verifier'`, `provider: 'openai-codex'` for CODEX-10 offload calculation
6. Preserves the existing `d.` STATUS parsing and `e.` TaskUpdate unchanged

The contrarian prompt construction at lines ~994-1001 is unchanged per D-16.

## Acceptance Criteria Verification

- A1. Step 9.6 dispatches via `shellDispatch` to `codex-cli-reviewer` — PASS (line 1013, 1030)
- A2. Skip-on-unavailable logs `VERIFIER_ADVERSARIAL_SKIP`, no same-vendor fallback — PASS (lines 1023, 1041)
- A3. Does NOT use `gates.resolveReviewerProvider` — explicit comment + direct `gates.getProvider` call — PASS (line 1007, 1025)
- A4. Token-log row: `role: "adversarial_verifier"`, `provider: "openai-codex"` — PASS (lines 1057-1059)
- A5. `config.atc.verifier_adversarial_rate` unchanged (0.2) — PASS (line 974, not touched)
- A6. Contrarian prompt construction at ~972-1001 unchanged — PASS

## Deviations from Plan

None — plan executed exactly as written. The replacement code block in the plan was adapted to integrate cleanly with the existing `d.` and `e.` steps (prose parsing logic preserved) rather than replacing them with a `synthesiseAdversarialVerdicts()` call, which is a presentation choice consistent with the surrounding SKILL.md style (no new helpers introduced that don't exist).

## Self-Check

- [x] `super-gsd/skills/sgsd-orchestrate/SKILL.md` modified with Step 9.6 rewrite
- [x] Commit `a93de2f` exists
- [x] `grep -c 'VERIFIER_ADVERSARIAL_SKIP' SKILL.md` = 3 (≥1 required)
- [x] `grep -c 'adversarial_verifier' SKILL.md` = 3 (≥1 required, D-26 inv7)
- [x] `grep 'does NOT use gates.resolveReviewerProvider' SKILL.md` hits line 1007
- [x] Sampling rate `config.atc.verifier_adversarial_rate` reference at line 974 — unmodified

## Self-Check: PASSED
