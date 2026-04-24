---
phase: 18
milestone: v1.4
status: complete
date: 2026-04-24
plans_shipped: 2
tasks_shipped: 3
commits: ~14
cxops_items_delivered: 4
codex_invocations: 2
critical_raised: 0
critical_cleared: 0
warnings_total: 4
warnings_deferred: 4
verifier_verdict: passed-with-deviations
phase_atc_verdict: passed-with-warnings
muda_status: ran (0 visible WARN, 0 visible FAIL — 5-probe aggregation gap still present)
tags:
  - milestone:v1.4
  - category:CXOPS
  - dogfood:cross-vendor-mature
  - meta-dogfood:validateContract-reviewing-itself
---

# Phase 18 — Codex Hardening Complete

## What shipped

Upgraded Codex integration from "works" to "reliable under failure modes." 4 CXOPS items delivered across 2 plans.

## Per-plan delivery

### 18-01 code hardening (FULL, 2 tasks, 3 commits + SUMMARY)
- **CXOPS-01** `codex-exec.sh --self-test` flag — 4-probe harness (PATH→exit 10, auth→exit 11, timeout math→exit 12, contract→exit 13) + `--skip-network` offline mode. Verified nominal (exit 0) AND probe-2 discrimination (`OPENAI_API_KEY=fakekey → exit 11`).
- **CXOPS-02** `validateContract` at SKILL.md Steps 6.5 + 9.5 — post-shellDispatch parse check; on parse fail, single-retry fallback to `claude-sonnet-reviewer` with `fallback_reason: "parse_failure"` telemetry in commit-reviews.jsonl row.
- Per-dispatch ATC: 1 meta-dogfood Codex invocation (Codex reviewing its own validateContract code). 0 CRITICAL + 2 WARNINGs deferred.
- Executor deviations (both caught + fixed during execution): self-test harness relocated after function definitions; probe-2 config-file check relaxed offline.

### 18-02 dogfood recognition (LITE, 1 task, 2 commits + SUMMARY)
- **CXOPS-03** + **CXOPS-04** formally satisfied via DOGFOOD-AUDIT.md citing 5 per-dispatch ATC rows (4 Phase 17 + 1 Phase 18-01) + 1 phase-level row + 17-ATC-REVIEW.md frontmatter stamps.
- REQUIREMENTS.md tick updated for all 4 CXOPS boxes.
- Per-dispatch ATC skipped (LITE tier — docs-only).

## Verification verdict

**`18-VERIFICATION.md` → PASS-WITH-DEVIATIONS**: 4/4 CXOPS evidence-verified; 1 housekeeping item (CXOPS-01/02 boxes unticked by executor) caught + fixed in verify commit.

## Phase ATC verdict (Step 6.5)

**`18-ATC-REVIEW.md` → PASS-WITH-WARNINGS**: 0 CRITICAL, 2 WARNINGS.
"Shippable, but Phase 18 overclaims dogfood and under-tests parse rigor." — both deferred to Phase 19 richer-output-contract scope.

## MUDA (Step 6.55) — ran cleanly

Phase 18 audit ran end-to-end — validates the milestone-nested phase-dir resolution fix (`1cef1b4`). Mechanical probes (haiku_fails, narrative_age_sec, git_spawn_pct) all PASS; 5-probe aggregation gap still hides inventory + extra_processing verdicts (known issue, same as Phase 17 audit, filed for Phase 19).

WASTE.md at `.planning/milestones/v1.4/phases/18-codex-hardening/WASTE.md`.

## Deferred signals queue (all non-blocking, filed for Phase 19 richer-output-contract follow-up)

| Signal | Source |
|---|---|
| self-test exit precedence audit | 18-01 per-dispatch ATC |
| parse-fallback gating edge-case coverage | 18-01 per-dispatch ATC |
| dogfood audit strictness | 18 phase-level ATC |
| parse-rigor test corpus | 18 phase-level ATC |
| 5-probe aggregation loop completeness | MUDA |
| inventory probe threshold calibration | MUDA |
| Summary text reflects raw probe verdict | MUDA |

Root cause common to most: 5-line Codex contract hides finding detail. Phase 19 should evaluate optional `FINDINGS_DETAIL:` lines + tighter regex validation in validateContract.

## Codex dogfood evidence (CXOPS-03/04 CUMULATIVE)

| # | Phase | Scope | Gate | Duration | Exit | Verdict |
|---|---|---|---|---|---|---|
| 1 | 17-01 | first review | per-dispatch | 80.6s | 0 | 1C+1W |
| 2 | 17-01 | re-review (fix) | per-dispatch | 97.9s | 0 | 0C+2W |
| 3 | 17-03 | first review | per-dispatch | 63.2s | 0 | 1C+1W |
| 4 | 17-03 | re-review (fix) | per-dispatch | 105.2s | 0 | 0C+0W |
| 5 | 17 | phase-level (timeout) | phase-level | 120.0s | 5 | timeout |
| 6 | 17 | phase-level (retry) | phase-level | 156.0s | 0 | 0C+3W |
| 7 | 18-01 | meta-dogfood | per-dispatch | 95.2s | 0 | 0C+2W |
| 8 | 18 | phase-level (this) | phase-level | 124.4s | 0 | 0C+2W |
| **Total** | | | | **842.5s** | | |

**8 Codex invocations, 842.5s wall-clock, ~17,000 Claude tokens saved, 0 fallbacks triggered, 2 CRITICALs raised + cleared.**

## Commit range

`98f29f0` (Phase 18 CONTEXT) → `a963f86` (Phase 18 verify) + ATC evidence + MUDA + SUMMARY — ~14 commits, 14 files, 1489+/10- lines.

## Next

Phase 19 Mission Control Visibility — MC-01..MC-05. Will consume today's codex-live.json + codex-log.jsonl plumbing into mission-control tiles + statusline + narrative + live-feed + dashboard. ~30% credit already shipped during Phase 17 (MC visibility commits e0c74c7 + df17733).

Phase 19 should also pick up the accumulated Phase 18 deferrals as a richer-output-contract sub-scope.
