# Phase 17: Debt Sweep — Plan Index

**Milestone:** v1.4 Clean Close + Codex Visibility
**Serialization:** 17-01 → 17-02 → 17-03 (per D-01)

---

## Plans

| Plan | Wave | Goal | CLEAN items | Depends on |
|------|------|------|-------------|------------|
| 17-01-code-debt-PLAN.md | 1 | Fix JSDoc drift + dead branch in providers-registry.cjs; sync WASTE.md summary to reflect all 5 probes | CLEAN-01, CLEAN-02 | none |
| 17-02-process-debt-PLAN.md | 2 | Backfill 2 missing plan SUMMARYs, create P5 retroactive artifact, verify REQUIREMENTS.md archive | CLEAN-03, CLEAN-04, CLEAN-05 | none (independent; ordered after 17-01 for commit clarity) |
| 17-03-milestone-ceremony-PLAN.md | 3 | Close v1.2 retroactively (MILESTONES.md + ROADMAP.md collapse + git tag); wire codex_timeout workload tiers | CLEAN-06, CLEAN-07 | 17-01 (both touch codex-exec.sh) |

---

## Dependencies

```
17-01 ──────────────────────────────────────────┐
                                                 ▼
17-02 (independent, docs-only)          17-03 (must follow 17-01)
```

17-03 serializes after 17-01 because both touch `codex-exec.sh`. 17-02 is independent but occupies the middle slot for atomic-commit ordering.

---

## ATC Tier by Plan

| Plan | ATC tier | Reason |
|------|----------|--------|
| 17-01 | FULL | Code changes in 2 executable files |
| 17-02 | LITE | Docs-only; per-dispatch ATC skips at Step 9.5 |
| 17-03 | FULL | config.json + codex-exec.sh + SKILL.md + new archive files |

---

## Requirements Coverage

| CLEAN | Plan | Task |
|-------|------|------|
| CLEAN-01 | 17-01 | T1 |
| CLEAN-02 | 17-01 | T2 |
| CLEAN-03 | 17-02 | T1 |
| CLEAN-04 | 17-02 | T2 |
| CLEAN-05 | 17-02 | T3 |
| CLEAN-06 | 17-03 | T1 |
| CLEAN-07 | 17-03 | T2 |
