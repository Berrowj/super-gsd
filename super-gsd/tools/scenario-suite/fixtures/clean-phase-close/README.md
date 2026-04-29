# Fixture: clean-phase-close (SH1, happy)

A minimally valid schema_v2 PLAN.md that the plan-schema validator accepts in
load mode. Demonstrates the happy path for a phase that closes cleanly.

## Files

- PLAN.md - schema_v2 valid frontmatter; one task; passes ajv compile.

## Expected outcome

`PASS`. validate.cjs --plan-file PLAN.md --mode load exits 0.
