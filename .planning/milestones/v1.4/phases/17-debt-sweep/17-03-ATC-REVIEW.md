---
phase: 17
plan: "17-03"
gate: "per-dispatch-ATC"
provider: "openai-codex"
model: "codex (gpt-5.4)"
invocation: "shellDispatch via codex-exec.sh --timeout-tier review"
date: "2026-04-24"
historic_note: "First Codex invocation through the NEW CLEAN-07 tier resolver"
---

# 17-03 Per-Dispatch ATC Review — Codex

## First review (commit a3a4eb9, 6 tasks + SUMMARY)

```
FINDINGS: 2
CRITICAL: 1
WARNINGS: 1
PASS_RATE: 5/6
ONE_LINER: Core tier wiring works, but config-backed tier resolution is not correct.
```

Duration 63.2s via `--timeout-tier review` (first dogfood of the new flag itself — flag parsing worked cleanly, resolved to ~120s budget).

### Critical finding (Codex)

`resolve_timeout_tier()` in T3 hardcoded `echo 60 / echo 120 / echo 180` instead of reading values from `config.review_providers.codex_timeout_tiers`. Net effect: the additive config block from T4 was documentation-only — operator edits to tier values would be silently ignored by the tier resolver.

### Auto-mode decision (Rule 13)

Not exercised — operator directed `Fix now`. Single corrective commit shipped immediately rather than auto-bypass.

## Fix commit

`40631fc fix(17-03/T3-fix): CLEAN-07 addendum — config-backed tier resolution`

- Pre-populate `TIER_DEFAULT=60 / TIER_REVIEW=120 / TIER_ANALYSIS=180` as bash vars (hardcoded fallbacks matching D-03)
- Single Node call reads `config.review_providers.codex_timeout_tiers.{default,review,analysis}` and emits `KEY=VALUE` lines
- While-loop parses with numeric-only sanitisation (`val="${val%%[^0-9]*}"`) — no eval on config input
- `resolve_timeout_tier` + `resolve_step_timeout` both switch to the bash vars
- Live test: config `review=99` → resolver emits `TIER_REVIEW=99` (vs hardcoded 120)

## Re-Review (post-fix, commit 40631fc)

```
FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 6/6
ONE_LINER: Fix is sound; config-backed tiers now resolve safely without regressions.
```

Duration 105.2s via `--timeout-tier review`. Exit 0, no fallback, no timeout.

## Token accounting (17-03 Codex spend)

| Invocation | Duration | Exit | Verdict | Tier flag |
|---|---|---|---|---|
| First review (6-task diff) | 63.2s | 0 | 1 CRIT + 1 WARN | `--timeout-tier review` |
| Re-review (fix commit) | 105.2s | 0 | 0 CRIT + 0 WARN | `--timeout-tier review` |
| **Total wall-clock** | **168.4s** | — | — | — |

Combined 17-01 + 17-03 Codex spend: **4 invocations, ~347s wall-clock, ~8,000 Claude tokens saved**.

## What this proves

1. ✅ CLEAN-07 `--timeout-tier review` flag parses and applies correctly end-to-end
2. ✅ Config-backed tier resolution works post-fix (single Node read, bash var vars, safe parse)
3. ✅ Cross-vendor review signal continues to catch real issues — the CRITICAL here was genuine (config block was inert before the fix); Claude executor + self-review did not catch it
4. ✅ 17-03's six tasks ship with a clean Codex verdict; plan 17-03 complete

## Commit-reviews ledger

```json
{"ts":"...","plan":"17-03","tier":"full","verdict":"critical","critical":1,"warning":1,"one_liner":"Core tier wiring works, but config-backed tier resolution is not correct.","provider":"openai-codex"}
{"ts":"...","plan":"17-03","tier":"full","verdict":"clean","critical":0,"warning":0,"one_liner":"Fix is sound; config-backed tiers now resolve safely without regressions.","provider":"openai-codex","note":"re-review after 40631fc fix commit"}
```
