# Revise 168-01-PLAN-LOCKED.md to rev 2. Plan review returned NOGO on three blockers.

Edit the existing plan in place at
`.planning/milestones/v4.0-install-contract/phases/168-install-contract/168-01-PLAN-LOCKED.md`,
set `revision: 2`, and re-validate:

    node super-gsd/tools/plan-schema/validate.cjs --plan-file <path> --project-dir "$PWD" --mode write

Report the validator exit code. Write only the plan file.

The reviewer confirmed these are GOOD and must not be weakened in the revision:
- the empty-tree criterion is genuinely end to end (production Bash installer, empty
  module destinations, isolated real HOME/USERPROFILE, decoy cwd, no copier/mock/stage);
- diagnosis improves correctly: closed reason codes unchanged, with a bounded
  `underlying_error` carrying MODULE_NOT_FOUND, request, path and message.

## Blocker 1 — closure falsifiers are not independent

The design is source-derived and recursive, but the tests do not independently require:

- the witness hook's composer and store edges in THAT hook's per-entry closure;
- `sgsd-quality-gate.js -> sgsd-intent-classifier.cjs` as a PER-ENTRY edge. The union can
  hide an omission here because the classifier is also a manifest root, so a union-level
  assertion passes even when the per-entry edge is missing;
- extensionless and explicit non-`.cjs` resolution: `.js`, `.json`, and directory rules.

Fix: the mutation test must assert these edges from computation, manifest projection,
delivery, AND status, without any maintained expected-closure list. If the test needs a
fixture, the fixture must be generated from the sources, not transcribed. See plan
line 198.

## Blocker 2 — refuse-before-write is not literal

Plan lines 266 and 382 publish project files and only then run fallible final-target
smoke. Rollback prevents persistent partial delivery but does NOT satisfy refuse before
writing, and it does not contain arbitrary hook side effects: a smoked hook can touch
state outside the tree you rolled back.

This exact class has been a CRITICAL twice already, at install.sh level (2c237ef) and
inside `repairClaudeSubstrateWitness` (b2a1435). The plan would make it three.

Fix: every rejection-capable smoke runs against a COMPLETE CANDIDATE TREE before the
first project or profile mutation. After publication, permit only transactional
publication and non-rejecting verification. Say explicitly in the plan where the
candidate tree lives, how a hook smoked from the candidate resolves its requires, and
what guarantees no rejection-capable step remains after the first write.

## Blocker 3 — split the safe MUDA seam

Keep atomic: dependency graph, generated manifest, delivery, smoke, diagnosis, shared
inspection. Declaration and enforcement still ship together.

Move to a dependent second task and commit, consuming `inspectProjectInstall`:
`--doctor`, explicit-project presentation, and the worktree/GitHub freshness check
(install.sh:381). Worktree reporting is then independently revertible.

So rev 2 has two tasks, T2 depending on T1, not one.

## Reviewer notes to carry into the plan text, not to fix

- Merging the branch stays an operator decision.
- Selective closure intentionally leaves the rest of the observed ~55-file parity gap
  untouched. State that as a deliberate boundary so it is not later read as an omission.

## Unchanged constraints

- Derive destinations; never inherit from ambient state.
- One detector shared between read-only check and repair path.
- P167 witness contract untouchable: PreToolUse fail-closed, PostToolUse returns a bounded
  `substrate_witness_rewrite_failed` object and never passes the raw result through, store
  accepts only `rewritten` rows.
- Never weaken a guard assertion.
- `semantic_acceptance_criteria` stay real-data per SCHEMA-09/DLB-07.
