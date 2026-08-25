# Five guard cases assert the OLD refusal vocabulary. Update them without weakening them.

Confirmed green, do not touch: install-contract 3/3
(generated-transitive-manifest, empty-module-tree-real-install,
unresolved-module-refuses-before-write), plus guard cases preflight-static, smoke-static,
bundled-overlay-static, bundled-overlay-current, hook-distribution-all-types,
hook-manifest-completeness, brokered-substrate-capability,
witness-repair-smoke-no-mutation.

## The five failures, with the actual output

1. `vendored-nine-hook` — expects the refusal to name `hook_registration_missing`, gets:

    {"ok":false,"reason":"hook_smoke_failed","underlying_error":{"code":"MODULE_NOT_FOUND",
     "request":"hooks/gsd-phase-boundary.sh",
     "path":"<tmp>/target project/super-gsd/hooks/gsd-phase-boundary.sh",
     "message":"hooks/gsd-phase-boundary.sh: source module is missing: hooks/gsd-phase-boundary.sh"}}

2. `node-check-both-sites` — same class.

3. `deployed-hook-smoke` — expects the refusal to name `user-prompt-intent-classifier`, gets:

    {"ok":false,"reason":"hook_smoke_failed","underlying_error":{"code":"MODULE_NOT_FOUND",
     "request":"../scripts/lib/skill-routing-registry.cjs",
     "path":"<tmp>/source checkout/super-gsd/scripts/lib/skill-routing-registry.cjs",
     "message":"hooks/sgsd-intent-classifier.cjs: source module is missing: '../scripts/lib/skill-routing-registry.cjs'"}}

4. `sgsd-update-clarity-shape` — "broken control omitted missing code for
   pre-tool-use-substrate-invocation-witness".

5. `sgsd-update-clarity-recovery` — same class.

## What is actually happening

T1 moved detection earlier. The same broken fixture condition is now caught by the
dependency contract, in the source checkout, BEFORE the registration step that used to
report it. The refusal names the exact artifact path instead of a registration id.

## Your job, and the constraint is the point

Update these five cases to assert the CURRENT contract. For each case you must state, in
your report, one line justifying that the new assertion is EQUAL OR STRONGER than the one
it replaces. Specifically each updated case must still assert:

- the install REFUSED, non-zero, and
- the refusal NAMES the specific broken artifact (path or module request), not merely that
  something failed, and
- nothing was written before the refusal, where the case previously asserted that.

Do NOT replace a specific assertion with a generic one. Asserting merely `exit != 0`, or
that output is non-empty, or matching a broad regex where the old case matched a named
artifact, is weakening and will be rejected.

If any of the five is genuinely testing something the new design no longer does at all,
say so explicitly and explain what coverage is lost, rather than quietly retargeting it.
That is a legitimate finding, not a failure on your part.

## Constraints

- Only the guard file. Do not change delivery, closure, classifier, smoke, or install.sh
  to make a test pass.
- Fixture paths contain SPACES.

## Verify

- All 13 guard cases with exit codes.
- node super-gsd/tests/install-contract/assert-install-contract.cjs must stay 3/3.
- node --check on the file.

Sandbox denials: mark DENIED, do not report as passing. The orchestrator re-runs
unsandboxed. Do not ask for approval.

Standard block format plus the five justification lines. Max 350 words.
