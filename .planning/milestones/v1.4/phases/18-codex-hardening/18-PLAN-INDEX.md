# Phase 18: Codex Hardening — Plan Index

Milestone: v1.4 Clean Close + Codex Visibility
Phase goal: Harden Codex integration from "works" to "reliable under failure modes."

---

## Serialization

18-01 → 18-02 (strict: dogfood audit references 18-01 live-fire evidence)

---

## Plans

| Plan | Wave | ATC tier | CXOPS | Goal |
|------|------|----------|-------|------|
| 18-01-code-hardening-PLAN.md | 1 | FULL | CXOPS-01, CXOPS-02 | Add `--self-test` probe harness to codex-exec.sh + validateContract hook in SKILL.md Steps 6.5 and 9.5 |
| 18-02-dogfood-recognition-PLAN.md | 2 | LITE | CXOPS-03, CXOPS-04 | Produce DOGFOOD-AUDIT.md formally recognising Phase 17 retroactive Codex evidence; tick REQ-IDs complete |

---

## Dependencies

- 18-01 depends_on: [] — standalone code changes
- 18-02 depends_on: ["18-01"] — cites Phase 17 evidence + any new rows 18-01 generates at runtime

---

## Files touched

| Plan | Files |
|------|-------|
| 18-01 | `super-gsd/scripts/codex-exec.sh`, `super-gsd/skills/sgsd-orchestrate/SKILL.md` |
| 18-02 | `.planning/milestones/v1.4/phases/18-codex-hardening/18-DOGFOOD-AUDIT.md` (created), `.planning/REQUIREMENTS.md` (CXOPS-03/04 tick) |

---

## CXOPS coverage

| REQ-ID | Plan | Task |
|--------|------|------|
| CXOPS-01 | 18-01 | T1 |
| CXOPS-02 | 18-01 | T2 |
| CXOPS-03 | 18-02 | T1 |
| CXOPS-04 | 18-02 | T1 |
