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
    # falsifier is intentionally MISSING — should trigger SCHEMA-02 error
    # stop_rule is intentionally MISSING — should trigger SCHEMA-02 error
---

# Bad fixture plan for validate.cjs testing

This plan is missing required task fields: falsifier and stop_rule.
