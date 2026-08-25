# P167 phase-ATC fix — the passthrough violates the locked plan. Restore bounded failure.

Phase-level ATC returned FAIL 4/10 with one CRITICAL. The verifier separately
returned GOAL_MET YES with all six SACs MET and no regressions, so the phase
achieves its goal; this is about how it got there.

## CRITICAL 1 — and this one is the orchestrator's error, not yours

> Hook lines 214-227 return `null`, delivering an unparseable result unchanged.
> This directly contradicts locked-plan lines 187 and 264-267; T5 undoes T1's
> guarantee, while T3 still claims PostToolUse enforces the pre-model boundary.

The locked plan is explicit in two places:

```
Do not pass an uncapped PostToolUse result through when capping, witness lookup,
parsing, or rewrite output construction fails. An active PostToolUse hook
replaces such a result with a bounded substrate_witness_rewrite_failed result.
```

```
If the result is malformed, the Pre row is absent/invalid, or capping fails,
replace the tool output with a small substrate_witness_rewrite_failed object and
never pass the raw result through.
```

A fix-8 prompt instructed you to "fail SAFE" and pass the original through. That
instruction was wrong and it overrode a locked decision. The reasoning behind it
was that erroring on a delivered response destroys legitimate results, and at
that moment that was true, because the bare-array shape bug was making VALID
responses look unparseable.

That root cause is fixed. With the shape bug gone, "unparseable" no longer means
"valid response we failed to read"; it means genuinely malformed, which is
exactly the case that must be bounded. Passing it through raw reopens F1: an
uncapped, possibly enormous payload reaches the model, which is the failure this
milestone exists to prevent.

Required:

- Restore bounded failure. A malformed result, an absent or invalid Pre row, or
  a capping failure replaces the tool output with a small
  `substrate_witness_rewrite_failed` object. Never pass the raw result through.
- Remove the `post_passthrough` state and its tests.
- Keep everything that made T2's acceptance strict: acceptance still requires a
  real rewritten row, and no state may satisfy it that does not represent an
  actual rewrite.
- Re-check T3's prompt wording. It claims PostToolUse enforces the pre-model
  boundary; after this change that claim is true again, so confirm rather than
  edit unless it drifted.

## WARNING 2 — revert boundary

> T5 fix and cleanup commits modify T1 and T2 production files, and `1339eab`
> changes unrelated milestones and cockpit artifacts.

Do not rewrite history. Instead, update the plan's revert contract to state the
real per-task commit ranges, the way P166 did with mechanical range-revert
evidence, and note explicitly that `1339eab` is an unrelated privacy scrub that
is NOT part of any task's revert range.

## WARNING 3 — sediment

> Two approximately 2,320-line T1 patch artifacts differing by only 21 lines,
> duplicate exit-time evidence verification, repeated prompt-cap assertions,
> and unused new internal exports.

Remove the duplicate patch artifacts, the second exit-time verification, the
repeated assertions, and the unused exports. Roughly 2,450 lines are removable,
most of it those two near-identical artifacts.

## WARNING 4 — stale header

> The audit header says repair-safe touches only agents and config, but lines
> 1309-1336 also repair witness, broker, key, and grants.

Correct it to describe what the code does.

## Constraints

Everything green stays green: T1, T2, T3, T4, four registration-guard cases, ten
P166 suites, frozen P154 evidence, and the live capture plus independent verify.
The orchestrator runs all of them.

PreToolUse stays fail-closed and byte-identical in behaviour. The 16,000
character cap, the composer, the broker and the v2 schema are unchanged.

Any hook or store edit invalidates the two pinned digests in
`repo-settings-overlay.json`. Refresh them and say so.

Do not commit. No emoji, no em dashes. Never invoke `claude` yourself. Verify
through PowerShell.

Emit `PROGRESS: <line>` per unit.

## Report

```
FILES_CHANGED: path (modified)
LINES_REMOVED: <int>
VERIFICATION: `cmd` -> exit N (only what you actually ran)
DEVIATIONS: description | none
BLOCKERS: description | none
ONE_LINER: what a malformed response now returns, and what the revert contract says
```
