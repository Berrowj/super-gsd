# P166 phase verifier — goal-backward

Read only. Not a code review. The question is whether the PHASE achieved its
goal, judged backward from the goal rather than forward from the task list.
Tasks completing is not the same as the goal being met.

## The goal

`.planning/milestones/v3.9-substrate-hygiene/phases/166-substrate-call-filters/CONTEXT.md`
and the plan's `intent`:

> Put every SGSD vtp_search_substrate emission behind one intent-family,
> v2-schema-validating gateway in the executable call path, make raw unfiltered
> calls fail current conformance, and turn a pathological single hit into a
> named degraded artifact rather than a token-cap failure.

This phase exists because of two Clarity defects. F2: agents were told in prose
to filter their substrate calls and did not, so unfiltered calls went out. F1: a
single 900k-character `wiki/LINT-REPORT.md` hit blew the token cap and turned a
recoverable retrieval into a failed phase artifact.

Ask the real question: if a future agent tries to make an unfiltered substrate
call, or a pathological chunk comes back tomorrow, does this phase actually stop
it? Or does it only document that it should be stopped?

## Evidence

- Plan: `.../166-01-PLAN-LOCKED.md`, both tasks and all four
  `semantic_acceptance_criteria`.
- Full phase diff: `.../166-PHASE-DIFF.patch` (f39200a to HEAD)
- Reviews: `166-01-T1-SPEC-REVIEW3-REPORT.md` PASS 11/11,
  `166-01-T1-ATC-REPORT.md` FAIL then fixed,
  `166-02-T2-SPEC-REVIEW2-REPORT.md` PASS 12/12,
  `166-02-T2-ATC2-REPORT.md` PASS 10/10.
- Live tree at HEAD.

## Check each SAC against reality

Walk all four `semantic_acceptance_criteria`. For each, decide whether the
`expected_outcome` is actually true of the shipped system, not whether a test
with that name exits 0. Say which are MET, PARTIAL, or NOT MET.

Then answer three things directly:

1. Is there any remaining path by which an unfiltered substrate call reaches
   transport? Include prompt paths, the installed-agent patches, and the
   optional Phase-48 bridge.
2. If `wiki/LINT-REPORT.md` came back oversized tomorrow through each of the
   four surfaces, does the phase artifact survive with a named note in every
   one?
3. Did anything from P152, P154, or the pre-existing triage and bridge
   behaviour regress?

## Orchestrator evidence, to audit rather than trust

17/17 suites exit 0 unsandboxed at HEAD. Three live falsification probes: a
rogue substrate call appended to `sgsd-triage-runtime.cjs` failed
caller-coverage; the same in a new file failed; `gate.run` with `{ok:false}` and
no record threw and wrote no artifact. A direct cap probe on 900,001 characters
retained exactly 16000, preserved the second hit byte for byte, left the input
unmutated, and leaked no discarded text.

State plainly anything you could not verify.

## Output

```
GOAL_MET: YES | PARTIAL | NO
SAC_1: MET | PARTIAL | NOT MET
SAC_2: MET | PARTIAL | NOT MET
SAC_3: MET | PARTIAL | NOT MET
SAC_4: MET | PARTIAL | NOT MET
REMAINING_BYPASS: none | <description>
REGRESSIONS: none | <description>
UNVERIFIED: none | <what you could not check>
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-DEFERRED | FAIL
```

Max 300 words after the contract lines.
