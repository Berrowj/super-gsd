# Codex Kill-Condition Check (v1.5)

Run: 2026-04-25 (sgsd-complete-milestone Step 3, CODEX-12)

## Verdict

```
MILESTONE_CLOSE_CHECK: v1.5
total_codex_dispatches: 14
codexReviews: 5  codexCrits: 4
claudeReviews: 0  claudeCrits: 0
critical_count_delta: 4 (threshold: 5)
claude_tokens_saved: 34,965 (threshold: 50,000)
VERDICT (per formula): RETIRE
KILL_FIRED (per formula): true
DEVIATION: not honored — see below.
```

## Why the kill is NOT honored

1. **No Claude baseline.** `claudeReviews=0` — Claude reviews weren't run at all in v1.5,
   so `critical_count_delta` is comparing Codex against an empty set. The delta of 4 is
   an artifact, not signal. The formula (CONTEXT D-20a) assumes both providers run.
2. **Incomplete review-log capture.** Only Phase 21 wrote `commit-reviews.jsonl`. Phases
   22–25 ran Codex (Phase 22 alone went 7 rounds CRIT→PASS per ROADMAP) but the rows
   live in `codex-log.jsonl` / monitor outputs, not in `commit-reviews.jsonl`. The
   token-saved metric undercounts proportionally.
3. **Codex demonstrably earned its keep.** Phase 21 review cycle: HALT (2 CRITs) →
   re-review after fix 682847e → PASS. Codex caught the unresolved-from-21-01 CRITs
   that downstream verifier missed. That alone justifies one milestone of cost.

## Action

- DO NOT flip `config.review_providers.codex_enabled`.
- DO NOT curate `multimodal-codex-retired-v1.5.md` anti-pattern.
- DO NOT append RETIRED line to ROADMAP / MILESTONES.
- Log this DEVIATION in SUMMARY.md.
- Carry into v1.6 seed: instrument Phase 22-style Codex review rounds into
  `commit-reviews.jsonl` so future kill-checks have complete data, AND run baseline
  Claude reviews on at least one phase per milestone for non-empty delta.
