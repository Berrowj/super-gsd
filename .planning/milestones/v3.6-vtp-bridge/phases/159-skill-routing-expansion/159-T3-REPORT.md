FILES_CHANGED: `SKILL-DESCRIPTION-STANDARD.md` (new); `lint.cjs` (new); `CLAUDE-OVERLAY.md`; `assert-skill-routing-expansion.cjs`.

VERIFICATION: `node --check` lint ✓; `node --check` test case ✓; production skills scan clean ✓; in-process fixtures verified compliant/missing/one-noun/malformed/duplicate, content non-leakage, and exits 0/1/2 ✓; static assertions verified four semantic clauses, create-quote gate model, pointer-only overlay, pinned JSON_SCHEMA/reason codes, read-only/no-child-process lint, and fixture wiring ✓; scoped `git diff --check` and new-file whitespace checks ✓.

DEVIATIONS: Spawn-based suites intentionally not run per contract. Built-in patch wrapper failed during sandbox preparation; edits used the same direct apply-patch executable.

BLOCKERS: none.

ONE_LINER: Added the canonical skill-description contract and deterministic read-only lint with fixture-backed routing safeguards.
