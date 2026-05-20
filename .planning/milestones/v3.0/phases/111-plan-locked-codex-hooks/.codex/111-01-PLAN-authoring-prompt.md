# SDD Planner — author P111-01 PLAN

No inherited context.

## Goal

Author `.planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-01-plan-locked-codex-hooks-PLAN.md` — v2-schema PLAN for PLAN-LOCKED contract + 5 Codex hooks (DLB-09.2).

## Constraints

1. PLAN.md validates against `super-gsd/templates/plan-schema-v2.json`.
2. 7 SACs verbatim from `111-CONTEXT.md`.
3. 3 tasks:
   - **t1** — `plan-locked.schema.json` + `validate-plan-locked.cjs` + `plan-lock/package.json` + `plan-lock/README.md`
   - **t2** — `.codex/hooks.json` + 5 hook scripts (block-forbidden-write, block-secret-leak, log-tool-event, validate-stop-contract, enforce-allowed-files)
   - **t3** — `codex-hooks/run-self-test.cjs` + `codex-hooks/package.json` + `codex-hooks/README.md` (depends on t1, t2)
4. agent: `codex-executor`, model: `codex`, expected_ATC_tier: FULL, skip_gates: [], lessons_path: `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md`.
5. depends_on: t1=[], t2=[], t3=[t1, t2].
6. Brief body: Goal + Hook policy section + Dispatch.
7. Per-task verification_cmds:
   - t1: `node super-gsd/tools/plan-lock/validate-plan-locked.cjs --help`
   - t2: `cat .codex/hooks.json | node -e "JSON.parse(require('fs').readFileSync('.codex/hooks.json'))" && echo OK`
   - t3: `node super-gsd/tools/codex-hooks/run-self-test.cjs`

## Read

1. `.planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-CONTEXT.md`
2. `.planning/milestones/v3.0/phases/110-codex-pro-mode-lanes/110-01-codex-pro-mode-lanes-PLAN.md` (exemplar)
3. `super-gsd/templates/plan-schema-v2.json` (what plan-locked.schema extends)
4. `super-gsd/registry/codex-profiles.yaml` (which profiles require hooks/locked_plan)

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-01-plan-locked-codex-hooks-PLAN.md (created)
VERIFICATION: PLAN validates; 7 SACs verbatim; 3 tasks with depends_on chain
DEVIATIONS: <none>
BLOCKERS: <none>
ONE_LINER: P111-01 PLAN authored — PLAN-LOCKED schema + validator + .codex/hooks.json + 5 hook scripts + self-test.
REPORT_END
```
