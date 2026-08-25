# Plan review — P168 Install Contract. Apply ATC and MUDA to the PLAN, before any code.

Read-only. Do not edit files. Verdict must be GO or NOGO.

Plan: .planning/milestones/v4.0-install-contract/phases/168-install-contract/168-01-PLAN-LOCKED.md
Context (measured root cause, do not re-derive):
  .planning/milestones/v4.0-install-contract/phases/168-install-contract/CONTEXT.md

Schema validation already passed: VALID, no errors. Do not re-run it.

## The problem this plan must solve

Distributed hooks reach every project on every update; the modules they `require` never
do. `install.sh:615` copies `scripts/lib` to `~/.claude` only. Neither
`init_local_project` nor `update_existing` writes a project module tree. A project hook
doing `require('../scripts/lib/sgsd-state.cjs')` gets MODULE_NOT_FOUND. This has silently
broken delivery to every other repository for five development cycles.

## Judge these specifically

1. **Does the computed closure actually close?** The plan must derive the module set from
   hook sources, not a hand-maintained list. Check it handles: transitive requires (a
   required module requiring another), the witness hook's runtime resolution from the
   project root rather than a static `require`, a hook requiring another hook
   (`sgsd-quality-gate.js` requires `sgsd-intent-classifier.cjs`), and non-`.cjs`
   extensions. If any of those escapes the computation, the closure is incomplete and the
   phase ships the same bug in a new shape.

2. **Is the empty-tree criterion genuinely end to end?** It claims production install.sh,
   real HOME, decoy cwd, no mocks. Verify nothing in the plan quietly reintroduces a
   mocked copier or a pre-seeded target elsewhere.

3. **Refuse before writing.** This exact class has been a CRITICAL twice: at the
   install.sh level (2c237ef) and inside `repairClaudeSubstrateWitness` (b2a1435). Does
   the plan's new delivery step write anything before the checks that can fail? Say where.

4. **Does it make diagnosis worse?** The requirement is to carry the real
   module-resolution error beside the reason code. Widening the closed reason vocabulary
   instead of carrying the underlying error would be a regression, not a fix.

5. **MUDA.** Is this one task doing one thing, or a bundle that should split? The plan
   argues manifest, delivery, smoke and staleness ship together because a manifest
   without enforcement is the present failure. Test that argument; if a split is safe,
   say exactly where the seam is.

6. **What does it NOT cover?** Name any part of the measured root cause the plan leaves
   unaddressed, including the ~55-file gap observed on a real Linux project and the
   worktree-blind freshness check at install.sh:381.

## Verdict

End with exactly `PLAN VERDICT: GO` or `PLAN VERDICT: NOGO`.
NOGO requires a numbered list of what must change. Bound yourself to about 15 shell
commands and emit the verdict even if incomplete. Max 500 words.

## ROUND 2 — confirm only these three, do not re-open settled ground

Round 1 returned NOGO on three blockers. The plan is now revision 2 and schema-VALID.
Confirm each blocker is closed. Do not re-litigate anything you already passed: the
empty-tree criterion and the `underlying_error` diagnosis design were both accepted.

1. **Closure falsifiers independent.** The mutation test must assert, without any
   maintained expected-closure list: the witness hook's composer and store edges in THAT
   hook's per-entry closure; `sgsd-quality-gate.js -> sgsd-intent-classifier.cjs` as a
   per-entry edge (the union hides this because the classifier is also a manifest root);
   and extensionless / `.js` / `.json` / directory resolution. Assert from computation,
   manifest projection, delivery AND status. If a fixture is used it must be generated
   from sources, not transcribed.

2. **Refuse-before-write is literal.** Every rejection-capable smoke must run against a
   complete candidate tree BEFORE the first project or profile mutation. After
   publication only transactional publication and non-rejecting verification may remain.
   Check the plan states where the candidate tree lives, how a hook smoked from it
   resolves its requires, and what guarantees no rejection-capable step survives the
   first write. Rollback is not a substitute: a smoked hook can touch state outside the
   tree being rolled back.

3. **The seam is split.** T1 keeps graph, generated manifest, delivery, smoke, diagnosis
   and shared inspection atomic. T2 depends on T1 and carries `--doctor`,
   explicit-project presentation and the worktree/GitHub freshness check
   (install.sh:381), independently revertible.

Also confirm the plan states, as deliberate boundaries rather than omissions, that
merging the branch is an operator decision and that selective closure leaves the rest of
the ~55-file parity gap untouched.

Verdict line unchanged: `PLAN VERDICT: GO` or `PLAN VERDICT: NOGO`.
NOGO requires a numbered list of what still must change. Max 400 words.
