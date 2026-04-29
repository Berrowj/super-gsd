# Fixture: poisoned-plan-md (SA1, adversarial)

Adversarial PLAN.md with multiple defects so the schema_v2 validator MUST
reject:

1. tasks array empty (violates minItems: 1).
2. files_modified contains a string clearly outside the project tree (path
   traversal sentinel).
3. The `tasks[0].falsifier` field is missing if a task were present.

The validator is expected to exit non-zero with stderr listing the schema
errors. Adversarial PASS == validator rejects.
