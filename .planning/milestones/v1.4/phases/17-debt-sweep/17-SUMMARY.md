---
phase: 17
milestone: v1.4
status: complete
date: 2026-04-24
plans_shipped: 3
tasks_shipped: 11
commits: 20
clean_items_delivered: 7
codex_invocations: 6
critical_raised: 2
critical_cleared: 2
warnings_total: 5
warnings_deferred: 5
verifier_verdict: passed
phase_atc_verdict: passed-with-warnings
muda_status: skipped-phase-not-found
tags:
  - milestone:v1.4
  - category:CLEAN
  - dogfood:codex-cxops-03-retroactive
---

# Phase 17 — Debt Sweep Complete

## What shipped

Closed v1.3's tail with 7 CLEAN carry-over items + retroactive v1.2 milestone close + codex_timeout workload tiers. No net-new feature scope delivered.

## Per-plan delivery

### 17-01 code debt (FULL, 2 tasks, 3 commits + fix-up + SUMMARY)
- **CLEAN-01**: providers-registry.cjs JSDoc refreshed (2 docblocks), dead `default_provider` fallback branch removed. `grep -c 'reviewer_agent'` now returns 0.
- **CLEAN-02**: sgsd-muda-audit.sh WASTE.md display fixed. Initial fix extended static table from 3→5 rows; Codex caught CRITICAL row-duplication; fix-up removed static placeholders + inserted qualitative row INSIDE table via awk anchor.
- Codex per-dispatch ATC: 2 invocations (first flagged CRITICAL, fix cleared it).

### 17-02 process debt (LITE, 3 tasks, 3 commits + SUMMARY)
- **CLEAN-03**: 15-01-SUMMARY.md + 15-03-SUMMARY.md backfilled matching 15-02 template frontmatter.
- **CLEAN-04**: P5 Codex Monitor retroactive artifact — SPEC + PLAN + SUMMARY under `.planning/milestones/v1.3/phases/p5-codex-monitor/` with `retroactive: true` + `planted_during: Phase-15-close-session` + `commit: c8b2d25` frontmatter.
- **CLEAN-05**: REQUIREMENTS.md archive alignment verified — zero-diff audit, both v1.2-REQUIREMENTS.md and v1.3-REQUIREMENTS.md archive files present.
- Per-dispatch ATC skipped (LITE tier — design).

### 17-03 milestone ceremony (FULL, 6 tasks, 6 commits + fix-up + SUMMARY)
- **CLEAN-06**: `.planning/milestones/v1.2-ROADMAP.md` archive created, MILESTONES.md §v1.2 → Shipped, ROADMAP.md Phases 9-13 collapsed to `<details>`, `git tag -a v1.2 0191168 -m "..."` created (exact SHA match).
- **CLEAN-07**: codex_timeout workload tiers wired across 4 call sites:
  - `codex-exec.sh` tier resolver (D-03 precedence: custom:N > named > step-map > fallback)
  - `config.json` additive `review_providers.codex_timeout_tiers` block
  - `SKILL.md` 3 shellDispatch call sites (Step 6.5, 9.5, 9.6) → `--timeout-tier review`
  - `sgsd-muda-audit.sh` qualitative-probe site → `--timeout-tier analysis`
- Codex per-dispatch ATC: 2 invocations (first flagged CRITICAL on hardcoded tier values, fix-up delivered config-backed resolution, re-review 0 findings 6/6).

## Verification verdict

`17-VERIFICATION.md` → **PASS** with 7/7 CLEAN items verified by command-level evidence.

## Phase ATC verdict (Step 6.5)

`17-ATC-REVIEW.md` → **PASS-WITH-WARNINGS**: 0 CRITICAL, 3 WARNINGS.
"Near-shippable, but MUDA qualitative reporting prevents a clean close" — deferred to Phase 18 richer-output contract work.

## MUDA (Step 6.55) — skipped

Phase 17 lives under `.planning/milestones/v1.4/phases/17-debt-sweep/`. `sgsd-muda-audit.sh` searches `.planning/phases/` flat only, returning `phase 17 not found`. This is a pre-existing gap affecting every v1.4+ phase. **Filed as Phase 18/19 scope** — MUDA audit needs milestone-nested phase-dir resolution.

Logged to `.planning/metrics/muda-log.jsonl` as `status: skipped`, `reason: phase_dir_not_found`.

## Deferred signals (non-blocking, by design)

| Signal | Source | Deferral target |
|---|---|---|
| awk anchor brittleness in qualitative row insert | 17-01 re-review | Phase 18 CXOPS-02 contract validator |
| T1 JSDoc narrative drift beyond literal swaps | 17-01 re-review | Accepted at phase level |
| step-name tier calibration (phase-level-ATC → analysis) | 17 phase-level ATC | Phase 18 CXOPS follow-up |
| Richer output contract for phase-level Codex reviews | 17 phase-level ATC | Phase 18 CXOPS follow-up |
| Dual-gate timeout policy (auto-retry analysis before fallback) | 17 phase-level ATC | Phase 18 CXOPS follow-up |
| MUDA script milestone-nested phase resolution | Step 6.55 skip | Phase 18 or 19 |

## Codex dogfood evidence (CXOPS-03 retroactively satisfied)

| # | Scope | Tier | Duration | Exit | Verdict |
|---|---|---|---|---|---|
| 1 | 17-01 first review | review | 80.6s | 0 | 1C + 1W |
| 2 | 17-01 re-review (fix) | review | 97.9s | 0 | 0C + 2W |
| 3 | 17-03 first review | review | 63.2s | 0 | 1C + 1W |
| 4 | 17-03 re-review (fix) | review | 105.2s | 0 | 0C + 0W |
| 5 | 17 phase-level (timeout) | review | 120.0s | 5 | timeout |
| 6 | 17 phase-level (retry) | analysis | 156.0s | 0 | 0C + 3W |
| **Total** | | | **622.9s** | | |

**Historic**: rows 1-6 are the first orchestrator-path Codex invocations in SGSD history. Retroactively satisfies CXOPS-03 evidence requirement (per-dispatch ATC via Codex end-to-end) and partially satisfies CXOPS-04 (phase-level ATC via Codex). Phase 18 18-02 can mark CXOPS-03 complete with this evidence.

## Commit range

`a3cca94` (v1.3 milestone close audit) → `e064a42` (Phase 17 phase-level ATC) — 20 commits, 49 files, 3318+/310- lines.

Key commits:
- `a07c4e0` docs(17-03/T1): CLEAN-06 v1.2 retroactive close
- `1b9efcb` docs(17-03/T2): CLEAN-06 git tag v1.2 at 0191168
- `40631fc` fix(17-03/T3-fix): CLEAN-07 addendum — config-backed tier resolution
- `9a14ba3` fix(17-01/T2-fix): CLEAN-02 addendum — eliminate WASTE.md row duplication
- `e0c74c7` feat(mc): Codex + Claude harmonious visibility across 3 panes
- `df17733` feat(mc): Codex Monitor — RECENT VERDICTS section reads commit-reviews.jsonl

## Next

Phase 18 Codex Hardening — CXOPS-01 self-test + CXOPS-02 parse_failure fallback (18-01); CXOPS-03/04 formal recognition using today's dogfood evidence (18-02). The 5 deferred Phase 17 signals all fall naturally into Phase 18 scope.
