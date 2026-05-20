# SDD Planner Task — author P107-01 PLAN-LOCKED.md

You are a fresh SDD planner. No inherited context. Read only what this prompt names.

## Goal

Author **one file**: `.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md`

It is the implementation plan for P107 "CMB Validator + Canonical Hash + Receipt and Finding Writers" — the first consumer phase of the P106 CMB schema contract. The CONTEXT for this phase already exists and lists all 7 files, all 7 SACs, and binding invariants.

## Hard constraints (binding)

1. **PLAN.md MUST validate against `super-gsd/templates/plan-schema-v2.json`** including SCHEMA-09 (`semantic_acceptance_criteria` required).

2. **7 semantic_acceptance_criteria are already drafted in `107-CONTEXT.md`** under "Semantic acceptance criteria (target — 107-01 PLAN will declare these literally)". Use them verbatim.

3. **Task breakdown should be 3 tasks**:
   - **t1** — `cmb-validate.cjs` + `cmb-hash.cjs` + `package.json` (CLI tooling that consumes the P106 schema; no writers yet)
   - **t2** — `execution-receipt.cjs` + `review-finding-writer.cjs` (the two writers; consume t1's validator + hasher)
   - **t3** — `run-self-test.cjs` + `README.md` (≥15 assertions; smokes everything; operator usage docs)

4. **Each task must declare v2-schema required fields**: id, agent, model, files_touched, input_contract, output_contract, hypothesis, falsifier, stop_rule, plus per-task verification_cmd.

5. **agent: `codex-executor`, model: `codex`** for all three tasks.

6. **expected_ATC_tier: FULL** (uppercase) — load-bearing tooling phase.

7. **skip_gates: []** — all gates apply.

8. **lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"**

9. **depends_on: []** (t1 has no upstream tasks; t2 declares `depends_on: [t1]`; t3 declares `depends_on: [t1, t2]`).

10. **Plan-level `semantic_acceptance_criteria`**: exactly the 7 SACs from 107-CONTEXT verbatim (SAC-P107-01 through SAC-P107-07).

11. **Free-form body** (below frontmatter): brief sections for Goal, Bootstrapping note (mention how P107 SACs subsume P106 SACs once tools exist), Dispatch, Why no VTP enrichment.

12. **Per-task verification_cmds**:
    - t1: `node super-gsd/tools/mesh-memory/cmb-validate.cjs --help` (smoke test the binary is invocable)
    - t2: `node super-gsd/tools/mesh-memory/execution-receipt.cjs --help` (smoke)
    - t3: `node super-gsd/tools/mesh-memory/run-self-test.cjs` (the real integration test; ≥15 assertions exit 0)

## Read these files

1. `.planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-CONTEXT.md` — your contract source
2. `.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md` — exemplar v2-schema plan from the predecessor phase
3. `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — design lock
4. `.planning/milestones/v3.0/REQUIREMENTS.md` — REQ-MML-03 + REQ-MML-09 + REQ-MML-10 + REQ-POL-01/-08 are the load-bearing requirements
5. `super-gsd/templates/plan-schema-v2.json` — schema your output validates against
6. `super-gsd/tools/plan-schema/validate.cjs` — exemplar Node CLI shape (one of the things t1's CLIs are modelled after)

## Output

Single Markdown file at the path above. v2-schema YAML frontmatter; brief prose body.

## Report format

```
PATCH_BEGIN
<unified diff creating the PLAN.md>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/107-mesh-validate-hash-writers/107-01-cmb-validator-hash-writers-PLAN.md (created)
VERIFICATION:
  - PLAN validates against plan-schema-v2 (SCHEMA-09 satisfied; 7 SACs declared)
  - 3 tasks with depends_on chain (t2 ← t1; t3 ← t1, t2)
DEVIATIONS: <none or list>
BLOCKERS: <none>
ONE_LINER: P107-01 PLAN authored — 3 tasks for validator/hasher/writers/self-test; 7 SACs verbatim from CONTEXT.
REPORT_END
```

Be terse. No prose beyond the report.
