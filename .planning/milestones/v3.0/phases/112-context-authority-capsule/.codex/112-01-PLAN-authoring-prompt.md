# SDD Planner — author P112-01 PLAN

No inherited context. Final v3.0 phase.

## Goal

Author `.planning/milestones/v3.0/phases/112-context-authority-capsule/112-01-context-authority-capsule-PLAN.md` — v2-schema PLAN for Context Authority capsule (DLB-10.1).

## Constraints

1. PLAN.md validates against `super-gsd/templates/plan-schema-v2.json`.
2. 6 SACs verbatim from `112-CONTEXT.md`.
3. 3 tasks:
   - **t1** — 6 template YAMLs under `super-gsd/templates/{MILESTONE-CONTEXT|PERSONA-MATRIX|DOMAIN-ONTOLOGY|LEXICON|SOURCE-OF-TRUTH|NON-GOALS}.template.yaml` + `super-gsd/tools/context-authority/package.json` + `README.md`
   - **t2** — `context-anchor-writer.cjs` + `context-composer.cjs` (composer depends on writer)
   - **t3** — 6 v3.0 capsule instances under `.planning/milestones/v3.0/context/*.yaml` + `run-self-test.cjs` (depends on t1, t2)
4. agent: `codex-executor`, model: `codex`, expected_ATC_tier: FULL, skip_gates: [], lessons_path: `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md`.
5. depends_on: t1=[], t2=[t1], t3=[t1, t2].
6. Brief body: Goal + Dogfood note (v3.0 capsule from v3.0 INTENT/REQUIREMENTS) + Dispatch.
7. Per-task verification_cmds:
   - t1: `node -e "const yaml = require(require('path').resolve('super-gsd/tools/plan-schema/node_modules/js-yaml')); for (const f of ['MILESTONE-CONTEXT','PERSONA-MATRIX','DOMAIN-ONTOLOGY','LEXICON','SOURCE-OF-TRUTH','NON-GOALS']) yaml.load(require('fs').readFileSync('super-gsd/templates/'+f+'.template.yaml','utf8'))"`
   - t2: `node super-gsd/tools/context-authority/context-composer.cjs --help`
   - t3: `node super-gsd/tools/context-authority/run-self-test.cjs`

## Read

1. `.planning/milestones/v3.0/phases/112-context-authority-capsule/112-CONTEXT.md`
2. `.planning/milestones/v3.0/phases/111-plan-locked-codex-hooks/111-01-plan-locked-codex-hooks-PLAN.md` (exemplar)
3. `super-gsd/templates/plan-schema-v2.json`
4. `super-gsd/schemas/cmb.schema.json` (context_anchor branch)
5. `.planning/milestones/v3.0/INTENT.md` (source for v3.0 MILESTONE-CONTEXT.yaml)
6. `.planning/milestones/v3.0/REQUIREMENTS.md` (REQ-CTX-* requirements)

## Report

```
PATCH_BEGIN
<unified diff>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/112-context-authority-capsule/112-01-context-authority-capsule-PLAN.md (created)
VERIFICATION: PLAN validates; 6 SACs verbatim; 3 tasks with depends_on chain
DEVIATIONS: <none>
BLOCKERS: <none>
ONE_LINER: P112-01 PLAN authored — 6 capsule templates + composer + writer + v3.0 capsule instances + self-test.
REPORT_END
```
