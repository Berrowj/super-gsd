# Phase 21: VTP Enrichment Gates — Plan Index

**Milestone:** v1.5 VTP Knowledge Primacy + Post-v1.4 Hardening
**Phase:** 21-vtp-enrichment-gates
**Requirements covered:** VTPE-01, VTPE-02, VTPE-03, VTPE-04, VTPE-05, VTPE-06
**Schema:** v2 (tasks[] array, SCHEMA-02 required fields)

---

## Wave Structure

```
Wave 1 (parallel):
  21-01  Research->Planning gate + orchestrator integration
  (21-03 depends on 21-01, so not truly parallel with 21-01 — see dependency graph)

Sequential chain:
  21-01 -> 21-02 (needs vtpCrossRef stub from T1)
  21-01 -> 21-03 (needs vtp-enrichment-gate.cjs; config.json write in T1)
  21-03 -> 21-04 (needs config.json with vtp_enrichment block written)
```

## Plan Summary

| Plan | File | Requirements | Tasks | Depends On | Key Output |
|------|------|-------------|-------|------------|------------|
| 21-01 | 21-01-gate-orchestrator-PLAN.md | VTPE-01 | T1+T2+T3 | — | vtp-enrichment-gate.cjs, gates.yaml row, SKILL.md Step 6.b.5, gsd-planner files_to_read |
| 21-02 | 21-02-audit-xref-PLAN.md | VTPE-02, VTPE-03 | T1+T2+T3 | 21-01 | vtpCrossRef impl, workflow-auditor + muda-audit wiring, complete-milestone Step 7 extension |
| 21-03 | 21-03-config-empty-hit-PLAN.md | VTPE-04, VTPE-05, D-08 | T1+T2+T3 | 21-01 | config.json vtp_enrichment block, artifact hardening all 3 paths, vtp_health degraded mode |
| 21-04 | 21-04-board-researcher-PLAN.md | VTPE-06 | T1+T2+T3 | 21-03 | sgsd-board-researcher.md, config board append, sgsd-ceo N-relative vote-math |

## Dependency Graph

```
21-01 (no deps)
  |
  +---> 21-02 (vtpCrossRef stub from 21-01-T1)
  |
  +---> 21-03 (vtp-enrichment-gate.cjs + config.json write)
              |
              +---> 21-04 (deliberation.board + sgsd-ceo update)
```

21-02 and 21-03 may execute in parallel after 21-01 completes.

## Source Audit

| Source | Item | Plan | Status |
|--------|------|------|--------|
| GOAL | Formalize VTP enrichment gates (research->planning, audit, deliberation) | all 4 | COVERED |
| VTPE-01 | Research->Planning boundary enrichment gate | 21-01 | COVERED |
| VTPE-02 | Audit workflow cross-reference (3 surfaces) | 21-02 | COVERED |
| VTPE-03 | Milestone-close library cross-reference | 21-02 | COVERED |
| VTPE-04 | Design-policy config locks | 21-03 | COVERED |
| VTPE-05 | Empty-hit artifact discipline | 21-03 | COVERED |
| VTPE-06 | sgsd-board-researcher 5th deliberation voice | 21-04 | COVERED |
| CONTEXT D-01 | 5-tool cascade | 21-01-T1 | COVERED |
| CONTEXT D-02 | Query seed construction | 21-01-T1 | COVERED |
| CONTEXT D-03 | Max 5 queries | 21-01-T1 | COVERED |
| CONTEXT D-04 | VTP-ENRICHMENT.md shape | 21-01-T1 + 21-03-T2 | COVERED |
| CONTEXT D-05 | Audit tier-batching | 21-02-T1 | COVERED |
| CONTEXT D-06 | Board researcher model=sonnet | 21-04-T1 | COVERED |
| CONTEXT D-07 | config.json backward-compat disabled default | 21-03-T1 | COVERED |
| CONTEXT D-08 | VTP-aware degraded mode | 21-03-T3 | COVERED |
| RESEARCH A1 | Gate as sub-agent (MCP tool scope) | 21-01-T3 | COVERED (Step 6.b.5 dispatches sub-agent) |
| RESEARCH Pitfall 1 | Artifact-theater prevention | 21-01-T3 | COVERED (planner files_to_read patch) |
| RESEARCH Pitfall 3 | Vote-math breaks at N=5 | 21-04-T3 | COVERED |

Deferred (not gaps): challenger_mode, multi-library, write-side VTP publish,
cross-phase diff, query caching, per-gate tool subset config.

## Audit Surface Resolution

VTPE-02 "3 surfaces" resolved via Glob:
- sgsd-audit -> `super-gsd/agents/sgsd-workflow-auditor.md` (Plan 21-02-T2)
- sgsd-muda-audit -> `super-gsd/skills/sgsd-muda-audit/SKILL.md` (Plan 21-02-T2)
- gsd-audit-milestone -> NOT a standalone agent; milestone audit surface is
  `super-gsd/skills/sgsd-complete-milestone/SKILL.md` Steps 6+7 (Plan 21-02-T3 = VTPE-03)

## Validation Commands

```bash
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-01-gate-orchestrator-PLAN.md --mode load
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-02-audit-xref-PLAN.md --mode load
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-03-config-empty-hit-PLAN.md --mode load
node super-gsd/tools/plan-schema/validate.cjs --plan-file .planning/milestones/v1.5/phases/21-vtp-enrichment-gates/21-04-board-researcher-PLAN.md --mode load
```
