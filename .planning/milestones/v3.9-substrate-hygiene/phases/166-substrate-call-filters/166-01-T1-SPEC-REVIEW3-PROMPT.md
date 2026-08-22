# P166-T1 spec-compliance review, round 3

Round 2 on d63a6e6: PASS_RATE 10/11, FAIL, one CRITICAL. You found that
`{ok:false}` with no `substrate_call_record` bypassed both checks in
`vtp-enrichment-gate.cjs` and was written out as an `api_error` artifact.

A fix has landed at commit e216712. Confirm that one finding is closed and
nothing regressed.

## What to check

- Fix diff: `.../166-01-T1-FIX3-DIFF.patch` (d63a6e6 to e216712)
- Executor report: `.../166-01-T1-FIX3-REPORT.md`
- The live tree at e216712.
- Plan authority: `.../166-01-PLAN-LOCKED.md`, task `P166-T1`.

The chosen approach was to require gateway evidence for every injected result
including `ok:false`, on the reasoning that this runtime cannot attest an
external agent made no transport call, while a genuine pre-emission failure can
still return its prepared record.

Check specifically:

1. `{ok:false}` with no record property at all now fails closed, and no
   artifact is written.
2. `{ok:false}` with an INVALID record also fails closed, so the error branch
   is not a laundering route for a bad record.
3. A legitimate failed attempt can still be reported. If the only way to report
   an error now requires something an honest agent cannot produce, that is a
   new defect and you should say so.
4. Status selection did not regress: valid error stays `api_error`, valid
   zero-hit stays `empty_hit`, valid hit stays success, and only an API failure
   writes the API Error section.
5. The `ok:true` checks and the closed caller-coverage work from round 2 are
   intact.

## Orchestrator evidence, to audit rather than trust

Run unsandboxed at e216712, all exit 0: prompt-record-acceptance,
caller-coverage, executable-emitters, substrate-policy-required, emitted-args,
real-evidence, three triage scenarios, classify, composer, enrichment-gate,
feature-propagation, kb-triage-shadow.

Live probe: `gate.run({phaseDir, phase:'166', enrichmentResult:{ok:false}})`
threw `vtp_prompt_substrate_contract_invalid:substrate_call_record_missing` and
wrote no artifact.

If a test passes for the wrong reason, say so.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/<n>
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 200 words after the contract lines.
