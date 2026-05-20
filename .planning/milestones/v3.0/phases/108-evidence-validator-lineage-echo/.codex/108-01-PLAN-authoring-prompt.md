# SDD Planner Task — author P108-01 PLAN-LOCKED.md

You are a fresh SDD planner. No inherited context. Read only what this prompt names.

## Goal

Author **one file**: `.planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-01-evidence-validator-lineage-echo-PLAN.md`

It is the v2-schema-compliant implementation plan for P108 "Evidence Validator + Lineage DAG + Echo Detector" — DLB-08.4 + DLB-08.5 of Mesh Memory Lite. Consumes P106 schema + P107 CLIs.

## Hard constraints (binding)

1. **PLAN.md MUST validate against `super-gsd/templates/plan-schema-v2.json`** (SCHEMA-09 + SCHEMA-10 enforcement).

2. **7 semantic_acceptance_criteria are already drafted in `108-CONTEXT.md`** under "Semantic acceptance criteria (target — 108-01 PLAN will declare these literally)". Use them verbatim.

3. **Task breakdown should be 3 tasks**:
   - **t1** — `lineage.cjs` + `seed-ledger.jsonl` (the DAG walker + a multi-CMB fixture ledger for testing)
   - **t2** — `evidence-validator.cjs` + `echo-detector.cjs` (both depend on lineage.cjs from t1)
   - **t3** — `run-self-test.cjs` extension (≥10 new assertions; new floor ≥30 total) + the soft sgsd-audit SKILL.md wire-in docs update

4. **v2-schema required fields per task**: id, agent, model, files_touched, input_contract, output_contract, hypothesis, falsifier, stop_rule, plus per-task verification_cmd.

5. **agent: `codex-executor`, model: `codex`** for all three tasks.

6. **expected_ATC_tier: FULL** — load-bearing tooling.

7. **skip_gates: []**

8. **lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"**

9. **depends_on**: t1 has none; t2 declares `depends_on: [t1]`; t3 declares `depends_on: [t1, t2]`.

10. **Plan-level `semantic_acceptance_criteria`** = exactly the 7 SACs from 108-CONTEXT verbatim (SAC-P108-01 through SAC-P108-07).

11. **Free-form body**: brief sections for Goal, Tier policy (Tier 0+1 deterministic+heuristic only; Tier 2 LLM is P109), Dispatch, Why no VTP enrichment.

12. **Per-task verification_cmds**:
    - t1: `node super-gsd/tools/mesh-memory/lineage.cjs --help`
    - t2: `node super-gsd/tools/mesh-memory/evidence-validator.cjs --help && node super-gsd/tools/mesh-memory/echo-detector.cjs --help`
    - t3: `node super-gsd/tools/mesh-memory/run-self-test.cjs` (the real integration test; ≥30 assertions exit 0)

## Read these files

1. `.planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-CONTEXT.md` — your contract source
2. `.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md` — predecessor exemplar
3. `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md`
4. `super-gsd/templates/plan-schema-v2.json`
5. `super-gsd/tools/mesh-memory/cmb-validate.cjs` — exemplar shape for the new tools
6. `super-gsd/tools/mesh-memory/run-self-test.cjs` — what t3 extends

## Output

Single Markdown file at the path above. v2-schema YAML frontmatter; brief prose body.

## Report format

```
PATCH_BEGIN
<unified diff creating the PLAN.md>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/108-evidence-validator-lineage-echo/108-01-evidence-validator-lineage-echo-PLAN.md (created)
VERIFICATION:
  - PLAN validates against plan-schema-v2 (SCHEMA-09 satisfied; 7 SACs)
  - 3 tasks with depends_on chain (t2 ← t1; t3 ← t1, t2)
DEVIATIONS: <none or list>
BLOCKERS: <none>
ONE_LINER: P108-01 PLAN authored — evidence_validator + lineage + echo detector + self-test extension; 7 SACs verbatim from CONTEXT.
REPORT_END
```
