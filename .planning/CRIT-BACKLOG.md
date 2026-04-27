# CRIT-BACKLOG

> **Canonical source**: `.planning/metrics/crit-backlog.jsonl`. This file is rendered.
> Re-render with `node super-gsd/scripts/lib/crit-backlog.cjs --render`.

Last rendered: 2026-04-27T00:20:09.694Z
Total rows ever written: 11
Unresolved entries: 11

## v1.6

| id | kind | phase | summary | evidence | attempts | tagged_for |
|----|------|------:|---------|----------|---------:|-----------|
| `2026-04-26T23-13-37-843Z-3584` | verifier_fail | 26 | live Codex auth unavailable; fallback used (codex-exec.sh --self-test exit 11) | `.planning/milestones/v1.6/MILESTONE-READINESS.md` | 1 | next-debt-milestone |
| `2026-04-26T23-44-25-933Z-93f4` | verifier_fail | 27 | live Codex auth unavailable; fallback used (codex-exec.sh exit 11) | `.planning/milestones/v1.6/MILESTONE-READINESS.md` | 1 | next-debt-milestone |
| `2026-04-27T00-07-22-122Z-589f` | verifier_fail | 28 | live Codex auth unavailable; per-dispatch ATC for commit 34eb8c2 used Claude only | `.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl` | 1 | next-debt-milestone |
| `2026-04-27T00-07-22-123Z-ce2a` | verifier_fail | 28 | live Codex auth unavailable; per-dispatch ATC for commit 7e96ab3 used Claude only | `.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl` | 1 | next-debt-milestone |
| `2026-04-27T00-07-22-124Z-f9d0` | phase_atc | 28 | WARN deferred (non-blocking): unused $StateOverride param in sgsd-mission-strip.ps1 (YAGNI / anti-slop items 3+9) | `.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl` | 0 | next-debt-milestone |
| `2026-04-27T00-11-14-177Z-46fe` | verifier_fail | 28 | live Codex auth unavailable; per-dispatch ATC for commit 982d781 used Claude only | `.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl` | 1 | next-debt-milestone |
| `2026-04-27T00-11-14-179Z-8a05` | phase_atc | 28 | WARN deferred: insertion-vs-replacement of title bar (PLAN said preserve, DISCUSS 28.1 said replace) — operator review | `.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl` | 0 | next-debt-milestone |
| `2026-04-27T00-11-14-180Z-105c` | phase_atc | 28 | WARN deferred: lib header comment says : scope but mechanism is plain script scope (cosmetic doc fix) | `.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl` | 0 | next-debt-milestone |
| `2026-04-27T00-20-09-687Z-9c3c` | verifier_fail | 28 | live Codex auth unavailable; phase-level ATC used Claude only | `.planning/milestones/v1.6/phases/28-mission-control-layout/28-ATC-REVIEW.md` | 1 | next-debt-milestone |
| `2026-04-27T00-20-09-690Z-1f78` | phase_atc | 28 | WARN deferred: PLAN truth #4 text says silent-skip but shipped code hard-fails via __sgsd_fail (text-only correction) | `.planning/milestones/v1.6/phases/28-mission-control-layout/28-ATC-REVIEW.md` | 0 | next-debt-milestone |
| `2026-04-27T00-20-09-692Z-92d0` | phase_atc | 28 | NIT: deployed hook ~/.claude/hooks/sgsd-activity-logger.js re-install untracked; live stamping remains corrupted until manually actioned | `.planning/milestones/v1.6/phases/28-mission-control-layout/28-ATC-REVIEW.md` | 0 | next-debt-milestone |
