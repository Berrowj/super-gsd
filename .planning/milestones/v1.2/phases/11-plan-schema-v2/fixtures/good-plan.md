---
schema_version: 2
tasks:
  - id: t1
    agent: gsd-executor
    model: sonnet
    files_touched: [super-gsd/templates/plan-schema-v2.json]
    input_contract: CONTEXT.md D-01..D-06
    output_contract: valid JSON Schema draft-07 file at path
    hypothesis: writing the schema file enables all downstream validator work
    falsifier: ajv v8 fails to compile the schema OR required task fields are absent
    stop_rule: schema compiles without error AND all 9 required fields present
expected_ATC_tier: LITE
skip_gates: []
depends_on: []
---

# Good fixture plan for validate.cjs testing

This is the free-form body — not validated by the schema.
