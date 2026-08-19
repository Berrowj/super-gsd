# P155-T4b fix pass — revert three semantic drifts, keep the scheme work

Fresh context. Do NOT commit. Spec review found tier/projection semantics were NOT
preserved. The contract said: teach the tiers new schemes, change nothing else. Fix:

1. `super-gsd/tools/state-resolver/resolve.cjs:410-415` — REVERT the closed-status
   vocabulary expansion (COMPLETE/COMPLETED/CLOSED added). Restore the exact legacy
   status set. If any new fixture relied on the expanded vocabulary, change the FIXTURE
   to use legacy status strings; the production vocabulary is not this task's to grow.
2. `resolve.cjs:663-677` — REVERT the STATE frontmatter precedence reversal. Legacy
   behaviour: `roadmap_run.current_*` fields take precedence over top-level fields.
   Restore that exactly. The comment-stripping fix for unquoted scalars STAYS; only the
   precedence order reverts.
3. Restore `sample-sidecar-output.json` (or wherever the sample sidecar rewrite landed —
   check `git diff` for it) to its pre-task content via `git checkout -- <path>` unless
   a test you must keep genuinely reads it; if so, point the test at its own fixture
   copy instead.

Keep everything else: phase-name routing, ROADMAP ordering, abstention, CONTEXT probe
forms, comment stripping, the new assert-state-resolver suite.

Verify (sandbox permitting; orchestrator re-runs regardless):
    node super-gsd/tests/propagation-readiness/assert-state-resolver.cjs --case all
    node super-gsd/tests/propagation-readiness/assert-dual-root-resolvers.cjs --tool state-resolver --case full-matrix
    node super-gsd/tools/state-resolver/resolve.cjs --self-test

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 120 words.
