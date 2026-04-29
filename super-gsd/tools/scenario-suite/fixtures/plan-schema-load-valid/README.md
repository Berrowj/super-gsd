# Fixture: plan-schema-load-valid (SH6, happy)

A second valid schema_v2 PLAN.md (different shape from clean-phase-close) to
exercise the load mode happy path of the plan-schema validator with deeper
coverage of frontmatter combinations.

## Files

- PLAN.md - schema_v2 valid; multi-task plan; passes ajv compile.

## Expected outcome

`PASS`. validate.cjs --plan-file PLAN.md --mode load exits 0.
