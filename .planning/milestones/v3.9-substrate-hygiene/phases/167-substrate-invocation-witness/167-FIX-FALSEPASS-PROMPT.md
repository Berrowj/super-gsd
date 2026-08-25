# P167 fix — two tests that pass for the wrong reason

Two independent reviews found the same disease in different places. Both are
WARNINGS, no CRITICAL. Fix both. Nothing else.

This is the third instance in this phase of a test that passes without
exercising what its name claims. It is worth being precise about, because a test
that cannot fail is worse than no test: it reports safety that was never
checked.

## Finding A, from T4 spec review round 2

> The rollback test pre-creates `.mcp.json.tmp`; the first and only dirty
> document fails before rename, so byte equality proves no mutation, not
> rollback. `restoreOriginalDocuments` also ignores every restoration error.

The test is meant to prove that when a scope write fails part-way, previously
committed writes are rolled back and the user's original MCP documents survive.
It cannot prove that today, because nothing was ever committed before the
failure. Byte equality then just proves nothing happened at all.

Required:

- Dirty **at least two** MCP documents.
- Fail **after the first has been committed**, not before.
- Assert every original document is byte-restored, including the one that was
  already written.
- Make `restoreOriginalDocuments` stop swallowing restoration errors. A failed
  restore is the worst case in this whole path: the user's own upstream
  definition is gone and nobody was told. It must surface.

## Finding B, from T3 ATC

> The policy test still positively matches "truncate...in memory", `16000`, and
> `original_chars`; it now passes only because the prompts negate those phrases.
> That is dead, misleading coverage.

Those assertions were written for P166 when the prompts described capping. T3
rewrote the prompts to say the model must NOT cap, since T1's PostToolUse is the
only pre-model cap. The assertions now match the negating sentences, so they
pass while checking nothing real.

Required: remove or rewrite them so they assert what is actually true now. If
the intent is that prompts must NOT instruct capping, write that as a negative
assertion that fails when a capping instruction appears. Do not leave a positive
match that any sentence mentioning the word satisfies.

The ATC also noted prompt lines 41-46 and 56-61 duplicate no-cap wording that
can then be condensed. Do that only if it does not weaken the contract, and say
what you removed.

## Constraints

Five files at most:
`super-gsd/tools/feature-propagation/audit.cjs`,
`super-gsd/tests/substrate-invocation-witness/assert-propagation.cjs`,
`super-gsd/tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs`,
`super-gsd/agents/sgsd-vtp-enrichment.md`,
`super-gsd/agents/sgsd-board-researcher.md`.

Do not weaken T1 (34/34), T2 (13/13), T3 (4/4), the four registration-guard
cases, or any P166 regression. The P166 caller inventory is exact and
single-consumption: if you change a registered prompt line, its inventory entry
must be updated to match or `caller-coverage` will go red. That coupling already
caused one scope deviation this phase; check it before finishing.

Frozen byte-unchanged: `super-gsd/schemas/vtp-mcp-input-schemas.v1.json`,
`.planning/milestones/v3.6-vtp-bridge/phases/154-mcp-arg-contract/154-REAL-MCP-EVIDENCE.json`.

Do not commit. No emoji, no em dashes. Never invoke `claude`.

## Verification reality

You cannot run fixture suites (`EPERM` at `mkdtemp`). You CAN run `node --check`
and module load checks. Do those only; the orchestrator runs the suites and will
report exact failures.

Apply edits early, emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: how each test can now fail, and what you condensed
```
