---
phase: 11-plan-schema-v2
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - super-gsd/templates/plan-schema-v2.json
autonomous: true
requirements:
  - SCHEMA-01
  - SCHEMA-02
  - SCHEMA-03
  - SCHEMA-04

# v2 plan self-referential frontmatter (per D-01..D-06 defaults)
schema_version: 2
tasks:
  - id: t1
    agent: gsd-executor
    model: sonnet
    files_touched: [super-gsd/templates/plan-schema-v2.json]
    input_contract: CONTEXT.md D-01..D-06, ROADMAP SCHEMA-01..04
    output_contract: valid JSON Schema draft-07 file at path
    hypothesis: writing the schema file enables all downstream validator + enforcement work
    falsifier: ajv v8 fails to compile the schema OR required task fields are absent
    stop_rule: schema compiles without error AND all 9 required fields + 7 optional fields are present
expected_ATC_tier: LITE
skip_gates: []
depends_on: []
known_deadends: []
verification_cmd: null
lessons_path: null

must_haves:
  truths:
    - "super-gsd/templates/plan-schema-v2.json exists with schema_version: 2 at root"
    - "All 9 required task fields from SCHEMA-02 are in the JSON Schema required array"
    - "All 7 optional task fields from SCHEMA-03 have defaults documented via JSON Schema default keywords"
    - "classifier_skip field (schema_version presence) is documented per SCHEMA-04"
  artifacts:
    - path: "super-gsd/templates/plan-schema-v2.json"
      provides: "Canonical JSON Schema draft-07 defining v2 YAML frontmatter contract"
      contains: "schema_version, tasks, required fields for SCHEMA-02"
  key_links:
    - from: "super-gsd/tools/plan-schema/validate.cjs"
      to: "super-gsd/templates/plan-schema-v2.json"
      via: "require/readFileSync at validate.cjs startup"
      pattern: "plan-schema-v2\\.json"
---

<goal>
Define the canonical JSON Schema (draft-07) contract for v2 PLAN.md YAML frontmatter.

Purpose: All downstream work (validate.cjs, orchestrator skip-path, self-healing loop) depends on this file existing and being correct. Ships plan-schema-v2.json as the single source of truth per D-13.
Output: super-gsd/templates/plan-schema-v2.json — the authoritative v2 schema file.
</goal>

<context>
@.planning/phases/11-plan-schema-v2/11-CONTEXT.md
@.planning/phases/11-plan-schema-v2/11-RESEARCH.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Write plan-schema-v2.json</name>
  <files>super-gsd/templates/plan-schema-v2.json</files>
  <action>
Create super-gsd/templates/plan-schema-v2.json as a valid JSON Schema draft-07 document.

Schema root:
- "$schema": "http://json-schema.org/draft-07/schema#"
- "title": "Plan Schema v2"
- "description": "Canonical YAML-frontmatter schema for SGSD v2 PLAN.md files"
- "type": "object"
- "required": ["schema_version", "tasks"]
- "properties": { schema_version, tasks, ... top-level optional fields }
- "additionalProperties": true (PLAN.md body is free-form — only frontmatter validated)

Top-level required properties:
- schema_version: { type: "integer", enum: [2], description: "v2 plans skip Haiku classifier (SCHEMA-04)" }
- tasks: { type: "array", items: { $ref: "#/definitions/task" }, minItems: 1 }

Top-level optional properties (all with default values per D-01..D-05):
- expected_ATC_tier: { type: "string", enum: ["SKIP","LITE","FULL","GATE"], default: "LITE" } (D-01)
- skip_gates: { type: "array", items: { type: "string" }, default: [] } (D-03)
- depends_on: { type: "array", items: { type: "string" }, default: [] } (D-05)
- lessons_path: { type: ["string","null"], default: null } (D-04)
- prior_errors_lookup: { type: "boolean" } — NO default here; derived by parser from tier (D-02)

definitions/task (required fields per SCHEMA-02):
- id: { type: "string" }
- agent: { type: "string" }
- model: { type: "string", enum: ["haiku","sonnet","opus"] }
- files_touched: { type: "array", items: { type: "string" }, minItems: 1 }
- input_contract: { type: "string" }
- output_contract: { type: "string" }
- hypothesis: { type: "string" }
- falsifier: { type: "string" }
- stop_rule: { type: "string" }

definitions/task optional fields (per SCHEMA-03, D-01..D-05):
- depends_on: { type: "array", items: { type: "string" }, default: [] } (D-05)
- known_deadends: { type: "array", items: { type: "string" }, default: [] } (D-05)
- verification_cmd: { type: ["string","null"], default: null } (D-05)
- prior_errors_lookup: { type: "boolean" } — no schema default; parser derives from tier (D-02)
- expected_ATC_tier: { type: "string", enum: ["SKIP","LITE","FULL","GATE"], default: "LITE" } (D-01)
- skip_gates: { type: "array", items: { type: "string" }, default: [] } (D-03)
- lessons_path: { type: ["string","null"], default: null } (D-04)

Add "errorMessage" properties (ajv-errors v3 custom messages) for each required task field:
- id: "task must declare 'id' (SCHEMA-02)"
- agent: "task must declare 'agent' (SCHEMA-02)"
- model: "task must declare 'model' as haiku|sonnet|opus (SCHEMA-02)"
- files_touched: "task must declare 'files_touched' array with ≥1 entry (SCHEMA-02)"
- input_contract: "task must declare 'input_contract' (SCHEMA-02)"
- output_contract: "task must declare 'output_contract' (SCHEMA-02)"
- hypothesis: "task must declare 'hypothesis' (SCHEMA-02)"
- falsifier: "task must declare 'falsifier' (SCHEMA-02)"
- stop_rule: "task must declare 'stop_rule' (SCHEMA-02)"

IMPORTANT: This is a JSON file, not YAML. Write it as valid JSON using 2-space indent.
D-13: This file IS the canonical source — do not reference any external schema.
  </action>
  <verify>
    <automated>node -e "const s=require('./super-gsd/templates/plan-schema-v2.json'); const Ajv=require('ajv').default; const ajv=new Ajv({allErrors:true}); ajv.compile(s); console.log('schema compiles OK')"</automated>
  </verify>
  <done>
- super-gsd/templates/plan-schema-v2.json exists, is valid JSON, compiles under ajv v8
- All 9 required task fields present in definitions/task required array
- All 7 optional task fields present with defaults in definitions/task
- schema_version: 2 in root required array
- errorMessage keywords present for each required task field
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| schema file → ajv compiler | Schema file could be malformed; ajv compile step is the gate |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-01 | Tampering | plan-schema-v2.json | mitigate | D-12 boot-time sha256 check catches post-write drift |
| T-11-02 | Information Disclosure | errorMessage strings | accept | Messages identify field names only; no credentials or secrets |
</threat_model>

<verification>
node -e "const s=require('./super-gsd/templates/plan-schema-v2.json'); console.log(Object.keys(s.definitions.task.required || [])); process.exit(s.required.includes('schema_version') && s.required.includes('tasks') ? 0 : 1)"
</verification>

<success_criteria>
- plan-schema-v2.json compiles under ajv v8 without errors
- All 9 SCHEMA-02 required task fields are in definitions/task required array
- All 7 SCHEMA-03 optional fields have defaults
- schema_version: 2 is root-level required
- File committed to super-gsd/templates/
</success_criteria>

<output>
After completion, create .planning/phases/11-plan-schema-v2/plans/11-01-SUMMARY.md
</output>
