# SDD Planner Task — author P106-01 PLAN-LOCKED.md

You are a fresh SDD planner. No inherited context. Read only what this prompt names.

## Goal

Author **one file**: `.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md`

It is the implementation plan for P106 "Mesh CMB Schema and Canonical Hashing" — the contract phase of DLB-08 Mesh Memory Lite. The CONTEXT for this phase already exists and locks all 12 design rules. Your job is to translate it into a v2-schema-compliant PLAN.md with task breakdown.

## Hard constraints (binding)

1. **The PLAN.md MUST validate against `super-gsd/templates/plan-schema-v2.json`** including the new SCHEMA-09 / SCHEMA-10 enforcement of `semantic_acceptance_criteria`. The plan-schema validator (`super-gsd/tools/plan-schema/validate.cjs`) is the ground truth — the operator may run it against your output.

2. **Six semantic_acceptance_criteria are already drafted in `106-CONTEXT.md`**. Use them verbatim. Do not paraphrase. Do not add additional SACs. The yaml block to copy is in `106-CONTEXT.md` under "Semantic Acceptance Criteria (target — P106 PLAN-LOCKED.md frontmatter will declare these literally)".

3. **The plan implements one schema-only phase**. Task breakdown must touch ONLY:
   - `super-gsd/schemas/cmb.schema.json` (new — the JSON Schema file)
   - `super-gsd/tools/mesh-memory/fixtures/good-execution-receipt.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/good-review-finding.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/good-evidence-verdict.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/good-decision-recommendation.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/good-operator-precedent.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/good-context-anchor.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/good-promotion-decision.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/bad-claim-as-observation.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/bad-context-anchor-without-source.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/bad-execution-receipt-created-by-agent.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/bad-cmb-missing-cat7.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/bad-cmb-created-at-affects-hash.json` (new — this is the positive demonstration; cmb-hash.cjs would show same hash)
   - `super-gsd/tools/mesh-memory/fixtures/bad-review-finding-without-lineage.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/hash-a.json` (new — for SAC-P106-03 + -04)
   - `super-gsd/tools/mesh-memory/fixtures/hash-a-created-at-changed.json` (new)
   - `super-gsd/tools/mesh-memory/fixtures/hash-a-body-changed.json` (new)

4. **The plan must NOT include tasks for**:
   - `super-gsd/tools/mesh-memory/cmb-validate.cjs` — this is P107 work
   - `super-gsd/tools/mesh-memory/cmb-hash.cjs` — this is P107 work
   - Any executor/reviewer/validator/pseudo-operator code
   - Any `.codex/hooks.json`
   - Any `super-gsd/skills/sgsd-audit/SKILL.md` edits
   - Any `.planning/mesh/memory/` runtime CMB files

5. **Task breakdown should be 3 tasks**:
   - **t1**: Author `super-gsd/schemas/cmb.schema.json` — the JSON Schema enforcing the seven CMB types with class-specific required-field rules
   - **t2**: Author the seven good fixtures
   - **t3**: Author the six bad fixtures (+ hash variants for SAC-P106-03 / -04)

   Each task needs the v2-schema required fields: id, agent, model, files_touched, input_contract, output_contract, hypothesis, falsifier, stop_rule.

6. **agent + model values**: all three tasks should use `agent: codex-executor` + `model: codex`. The plan-schema-v2 enum allows {codex, opus}.

7. **expected_ATC_tier: FULL** (uppercase) — this phase ships a schema that defines the cognitive memory contract for v3.0; it's load-bearing.

8. **skip_gates: []** (none — P106 must pass all gates including the SCHEMA-09 + Layer 4 semantic-AC enforcement).

9. **lessons_path: ".planning/decisions/DLB-08-MESH-MEMORY-LITE.md"**

10. **Plan-level `semantic_acceptance_criteria`** must be exactly the 6 SACs from 106-CONTEXT.md (SAC-P106-01 through SAC-P106-06). These reference `cmb-validate.cjs` and `cmb-hash.cjs` which are P107 work — that's intentional. P106 ships the schema + fixtures; P107's tools consume them. The SAC verification command actually runs at P107 close time.

11. **Free-form body of PLAN.md** (below the YAML frontmatter): brief — sections for Goal, Bootstrapping note, Dispatch, Why no VTP enrichment.

12. **Per-task `verification_cmd`**:
    - t1's cmd: `node -e "JSON.parse(require('fs').readFileSync('super-gsd/schemas/cmb.schema.json'))"` (parses as valid JSON)
    - t2's cmd: `node -e "for (const f of ['good-execution-receipt','good-review-finding','good-evidence-verdict','good-decision-recommendation','good-operator-precedent','good-context-anchor','good-promotion-decision']) JSON.parse(require('fs').readFileSync('super-gsd/tools/mesh-memory/fixtures/'+f+'.json'))"`
    - t3's cmd: similar for bad-* + hash-a* fixtures

## Read these files

1. `.planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-CONTEXT.md` — your contract source
2. `.planning/decisions/DLB-08-MESH-MEMORY-LITE.md` — design lock
3. `.planning/milestones/v3.0/INTENT.md` — milestone WHY + non-goals
4. `.planning/milestones/v3.0/REQUIREMENTS.md` — REQ-MML-01/-02/-03 + REQ-POL-* are the requirements this plan satisfies
5. `super-gsd/templates/plan-schema-v2.json` — the schema your output must validate against
6. `.planning/milestones/v2.9/phases/97.5-semantic-verification-gate/97.5-01-schema-enforcement-PLAN.md` — exemplar v2-schema plan written this milestone-1; use as shape reference

## Output

A single Markdown file at the path above. Frontmatter is the v2-schema YAML; body is brief prose.

## Report format

```
PATCH_BEGIN
<unified diff creating the new PLAN.md file>
PATCH_END
REPORT_BEGIN
FILES_CHANGED:
  .planning/milestones/v3.0/phases/106-mesh-cmb-schema/106-01-cmb-schema-PLAN.md (created)
VERIFICATION:
  - PLAN.md validates against plan-schema-v2 (frontmatter shape)
  - 6 semantic_acceptance_criteria copied verbatim from CONTEXT
  - 3 tasks declared (schema, good fixtures, bad fixtures)
  - All 17 files_touched paths captured across the 3 tasks
DEVIATIONS: <none or list>
BLOCKERS: <none or describe>
ONE_LINER: P106-01 PLAN authored against plan-schema-v2 with 6 verbatim SACs from CONTEXT.
REPORT_END
```

Be terse. No prose beyond the report.
