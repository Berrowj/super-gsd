# CRIT-BACKLOG

> **Canonical source**: `.planning/metrics/crit-backlog.jsonl`. This file is rendered.
> Re-render with `node super-gsd/scripts/lib/crit-backlog.cjs --render`.

Last rendered: 2026-04-27T05:58:10.907Z
Total rows ever written: 26
Unresolved entries: 10

## v1.6

| id | kind | phase | summary | evidence | attempts | tagged_for |
|----|------|------:|---------|----------|---------:|-----------|
| `2026-04-27T00-07-22-124Z-f9d0` | phase_atc | 28 | WARN deferred (non-blocking): unused $StateOverride param in sgsd-mission-strip.ps1 (YAGNI / anti-slop items 3+9) | `.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl` | 0 | next-debt-milestone |
| `2026-04-27T00-11-14-179Z-8a05` | phase_atc | 28 | WARN deferred: insertion-vs-replacement of title bar (PLAN said preserve, DISCUSS 28.1 said replace) — operator review | `.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl` | 0 | next-debt-milestone |
| `2026-04-27T00-11-14-180Z-105c` | phase_atc | 28 | WARN deferred: lib header comment says : scope but mechanism is plain script scope (cosmetic doc fix) | `.planning/milestones/v1.6/phases/28-mission-control-layout/commit-reviews.jsonl` | 0 | next-debt-milestone |
| `2026-04-27T00-20-09-690Z-1f78` | phase_atc | 28 | WARN deferred: PLAN truth #4 text says silent-skip but shipped code hard-fails via __sgsd_fail (text-only correction) | `.planning/milestones/v1.6/phases/28-mission-control-layout/28-ATC-REVIEW.md` | 0 | next-debt-milestone |
| `2026-04-27T00-20-09-692Z-92d0` | phase_atc | 28 | NIT: deployed hook ~/.claude/hooks/sgsd-activity-logger.js re-install untracked; live stamping remains corrupted until manually actioned | `.planning/milestones/v1.6/phases/28-mission-control-layout/28-ATC-REVIEW.md` | 0 | next-debt-milestone |
| `2026-04-27T00-45-52-216Z-28d0` | phase_atc | 29 | WARN deferred: MUDA codex_qualitative_waste — fixture inventory may be over-engineered (12 fixtures), silent metadata fallback | `.planning/milestones/v1.6/phases/29-agent-codex-lanes/WASTE.md` | 0 | next-debt-milestone |
| `2026-04-27T00-51-47-707Z-6299` | phase_atc | 29 | WARN deferred: path schema drift — PLAN said super-gsd/scripts/tests/, executor shipped super-gsd/tests/mission-strip/ (functionally equivalent) | `.planning/milestones/v1.6/phases/29-agent-codex-lanes/29-ATC-REVIEW.md` | 0 | next-debt-milestone |
| `2026-04-27T00-51-47-724Z-8d06` | phase_atc | 29 | WARN deferred: $StateOverride param now frozen in lib API (Phase 28 carry-forward; YAGNI per anti-slop 3+5+9) | `.planning/milestones/v1.6/phases/29-agent-codex-lanes/29-ATC-REVIEW.md` | 0 | next-debt-milestone |
| `2026-04-27T05-08-16-455Z-1e6d` | phase_atc | 30 | BOOT-03 README quick-start sg block deferred to v1.7 docs work; current README has no quick-start daily commands section | `super-gsd/docs/COCKPIT-ACCEPTANCE-EVIDENCE.md` | 0 | v1.7 |
| `2026-04-27T05-08-16-456Z-0b06` | phase_atc | 30 | Q5 agent-freshness gap: lib enumerates agents but does not gate by activity-log mtime (active/stale/waiting). PLAN spec required differentiation; lib ships enumeration-only | `.planning/milestones/v1.6/phases/30-startup-cockpit-acceptance/30-ATC-REVIEW.md` | 0 | next-debt-milestone |
