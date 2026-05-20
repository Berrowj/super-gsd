# PLAN-LOCKED Validator

`PLAN-LOCKED.md` does not replace the v2 plan contract. Its YAML frontmatter must validate against both `super-gsd/templates/plan-schema-v2.json` and `super-gsd/schemas/plan-locked.schema.json`.

Run:

```bash
node super-gsd/tools/plan-lock/validate-plan-locked.cjs --plan-file path/to/PLAN-LOCKED.md
node super-gsd/tools/plan-lock/validate-plan-locked.cjs --self-test-valid
node super-gsd/tools/plan-lock/validate-plan-locked.cjs --self-test-incomplete
```

The locked extension adds the fail-closed Codex execution contract: lock status, write allowlist, forbidden paths, invariants, acceptance commands, rollback plan, risk rating, and operator checkpoints.
