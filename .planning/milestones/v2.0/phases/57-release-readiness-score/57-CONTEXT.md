---
phase: 57
name: Release Readiness Score
milestone: v2.0
depends_on: [53, 56]
unblocks: []
synthesized_at: 2026-04-29
synthesis_rule: "auto per dispatch rule #1"
---

# Phase 57 Context — Release Readiness Score

## Goal (verbatim ROADMAP-AGENT.md:692)

8-bucket score (0-100). Gates milestone close: cannot SHIPPED until ≥70 AND zero `edge_guard_miss` rows in CRIT-BACKLOG.md.

## Locked: 57=B

## Required Outputs

- New: `super-gsd/tools/release-readiness/score.cjs`
- Edit: `sgsd-complete-milestone/SKILL.md` to invoke at close + enforce gate
- 57-* artifacts

## Acceptance (verbatim 698-700)

- Score < 70 returns exit 1; milestone close refuses SHIPPED (writes CANDIDATE or SHIPPED-WITH-DEBT-N)
- Edge_guard_miss row in CRIT-BACKLOG.md → score returns RED regardless of bucket totals (hard precondition)

## 8 Score Buckets (proposed; researcher confirms)

1. **scenarios** (15 pts) — Phase 53 failure-injection-log.jsonl: pass/total * 15
2. **chaos_restart** (10 pts) — Phase 54 chaos-restart-log.jsonl: pass/total * 10
3. **provider_circuit** (10 pts) — Phase 55 circuit health: 10 if no fallback active across milestone, else 5
4. **scenario_suite** (15 pts) — Phase 56 scenario-suite outcomes: pass/total * 15
5. **token_governance** (15 pts) — Phase 41/42 budget compliance: median pct_reduction proxy or budget breach count
6. **memory_governance** (10 pts) — Phase 49 lifecycle: revocation count + admit success rate
7. **routing_quality** (10 pts) — Phase 47 route-decisions.jsonl: hit rate + provider success
8. **lock_invariants** (15 pts) — Lock 4 git-diff-quiet on protected trees + ASCII-only + Lock 13 self-test green

Total: 100 points

## Hard Preconditions (RED override)

- Any `edge_guard_miss` in `.planning/metrics/crit-backlog.jsonl` → score RED regardless of total
- Any unrecoverable readiness gap → score RED

## Lock Invariants

- Lock 4: Phase 41-56 byte-untouched (sgsd-complete-milestone.cjs surgical extension only)
- Lock 11: bucket reads use byte-equality on closed-vocab status fields
- Lock 13: never throws; missing data file → bucket score = 0 (degraded)
- ASCII-only

## Hand-off

Single executor dispatch (compressed): score.cjs + SKILL.md edit + fixture (synthetic 70-pt + 69-pt + edge_guard_miss override) + 12-15 self-tests + sgsd-complete-milestone.cjs gate enforcement.
