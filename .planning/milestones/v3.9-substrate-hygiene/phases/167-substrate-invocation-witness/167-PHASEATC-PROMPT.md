# Phase-level ATC — P167 Substrate Invocation Witness

Apply the ATC 7 steps and the 10-point anti-slop checklist to the WHOLE phase, not
one dispatch. Read-only. Do not edit files.

## Scope

Commits 2be8f85..HEAD on branch luminaria-hogback (P167 only; P166 closed earlier at
f09c0d0 and is out of scope except where P167 changed its files).

Read the locked plan at
.planning/milestones/v3.9-substrate-hygiene/phases/167-substrate-invocation-witness/167-01-PLAN-LOCKED.md
and check the delivered code against it, especially:
- line ~187 and ~264-267: the PostToolUse path must NEVER pass the raw result
  through; it returns a bounded `substrate_witness_rewrite_failed` object.
- PreToolUse fails closed.
- the witness store accepts only `rewritten` rows and consumes atomically.

## A prior ATC round found one CRITICAL here

An earlier fix instructed "fail SAFE, pass the ORIGINAL result through", which
contradicted the locked plan. That was reverted and `post_passthrough` removed.
Verify with your own grep that no passthrough path survives in
super-gsd/hooks/sgsd-substrate-invocation-witness.cjs or
super-gsd/scripts/lib/substrate-invocation-witness-store.cjs. Report the occurrence
count you actually observed.

## Also in scope this round

The final two commits fixed a regression P167 itself introduced: five
installer-registration-guard cases that pass at 44e7861 and failed from P167 until
now. The first attempted fix deferred a production `exit 1` past a mutating
`repair_substrate_capability`; an adversarial review returned UNSAFE and it was
replaced with `precheck_substrate_capability`, a read-only check that shares
detection code with the repair path.

Judge specifically:
1. Does the read-only pre-check genuinely perform no writes, and can it drift from
   the repair path's detection?
2. `repair_substrate_capability` is also called at install.sh:648 inside
   `install_global_assets`, with NO preceding pre-check. Is that a hole?
3. Were any guard assertions weakened anywhere in the phase? Count added vs removed
   assertions in the guard file across the phase.
4. Is anything in the phase orphaned, unused, or "just in case"?

## Verdict format

Score /10 on the anti-slop checklist. List findings by severity
(CRITICAL / MAJOR / MINOR) with file:line. End with a line that is exactly
`ATC VERDICT: PASS` or `ATC VERDICT: FAIL`.
A CRITICAL forces FAIL. Max 500 words.

## Budget discipline (added after a 900s timeout)

A previous run of this exact prompt spent its whole budget investigating and never
emitted a verdict. Do not let that happen again.

Bound your investigation: at most ~15 shell commands total. Prefer targeted `rg` over
reading whole files. Do NOT re-run the test suites; the orchestrator has already run
them unsandboxed and the results are:
guard 12/12, T1 38/38, T2 13/13, T3 4/4, T4 pass, feature-propagation 15/15,
P166 6/6, P154 real-evidence pass, T5 capture PASS + independent verify PASS.
Take those as given and spend your budget on JUDGEMENT, not re-measurement.

Emit the verdict line even if your investigation is incomplete; say what you could
not check rather than continuing to dig.
