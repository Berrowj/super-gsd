# P153 Spec-Compliance Review (SDD reviewer stage 1)

Read only. Change nothing. Answer: did the implementation deliver the PLAN exactly?

You must inspect RAW artifacts. Executor summaries are hints, never proof.

## Raw inputs, in this order

1. PLAN: `.planning/milestones/v3.6-vtp-bridge/phases/153-hook-transport-completion/153-01-PLAN-LOCKED.md` (rev 5, authoritative)
2. Executor reports in the same directory: `153-T1a-REPORT.md`, `153-T1b-REPORT.md`, `153-T1c-REPORT.md`, `153-T2-REPORT.md`, `153-T2b-REPORT.md`, `153-T2c-REPORT.md`, `153-T2d-REPORT.md`
3. Raw diff: run `git diff 2c76b5d..HEAD -- super-gsd/` yourself. Do not trust `153-PHASE-DIFFSTAT.txt` alone.
4. Verification evidence: `153-VERIFICATION.md`, `153-T1a-LIVE-EVIDENCE.md`, `153-T1b-LIVE-EVIDENCE.md`
5. The 11 acceptance-criteria commands in the PLAN frontmatter `semantic_acceptance_criteria`.

## What the phase claimed

`sgsd-intent-classifier.cjs` self-declared as a UserPromptSubmit hook but was registered to no
event, so P149 skill-routing, P151 demand baseline and P152 KB-triage shadow never executed live.
T1a registered it repo-locally via a single-event overlay. T1b/T1c added an explicit no-match row
and the causal dispatch probe. T2 made `block-secret-leak.cjs` exit 2 on the Claude surface from
one shared implementation. T2b/T2c moved the isolation precondition to an `sgsd_hook_id` allowlist.
T2d stopped the probe requiring the Claude session to succeed.

## Answer each explicitly

**1. Requirement coverage.** For each of the 11 `semantic_acceptance_criteria`, does the diff
actually implement what the criterion asserts, and does the cited evidence prove it? Name any
criterion whose evidence does not map to real behaviour.

**2. Extra scope.** Anything in the diff not traceable to a PLAN task. The PLAN forbids: a generic
fifth `block` enforcement kind in the classifier registry, Python or uv, copied source from
`disler/claude-code-hooks-mastery`, and flipping the P152 `kb-lookup-triage` route off `shadow`.
Check each.

**3. The relaxation in T2d.** T2d stopped treating a non-zero `claude -p` exit as probe failure.
Verify this did NOT weaken the discriminating property. Specifically: can a probe now pass when the
classifier did not run? The orchestrator tested two controls (no UserPromptSubmit registered; guard
registered but classifier removed) and both failed as required. Attack that claim against the code.

**4. The allowlist substitution.** T2b/T2c replaced "exactly one UserPromptSubmit entry" with a
two-id allowlist plus classifier uniqueness. Confirm both assertion files use the SAME ids and
cannot drift, and that an unknown `sgsd_hook_id` is rejected.

**5. Secret safety.** `block-secret-leak.cjs` must never emit the matched credential value or any
substring of it to stderr, logs or telemetry. Verify in the code, not the report.

**6. Deferred work honestly recorded.** The PLAN defers T0 to P154 and records STATE staleness.
Confirm nothing deferred is being presented as delivered.

## Output, exactly this, max 600 words

```
SPEC_VERDICT: pass|fix_required|blocked
MISSING_REQUIREMENTS: none|<AC or task ids not met>
EXTRA_SCOPE: none|<unrequested changes>
VERIFICATION_MAPPING: <which raw diff/command evidence proves each AC group>
RELAXATION_SAFE: yes|no — <can a probe pass with the classifier not running?>
ALLOWLIST_DRIFT_SAFE: yes|no — <do both files share the ids?>
SECRET_SAFETY: pass|fail — <evidence from code>
DEFERRALS_HONEST: yes|no
ONE_LINER: <short operator-readable summary>
```

Be adversarial on point 3. A relaxation that quietly re-opens the harness-green/production-dead
hole is the single worst outcome for this phase, because that hole is why the phase exists.
