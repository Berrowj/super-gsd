# P166-T2 spec-compliance review

Read only. Judge the SHIPPED CODE against the LOCKED PLAN, task `P166-T2`.

## Artifacts

- Plan: `.../166-01-PLAN-LOCKED.md`, task `P166-T2`. Read `input_contract`,
  `falsifier`, `stop_rule`, and the third and fourth
  `semantic_acceptance_criteria`.
- Diff: `.../166-02-T2-DIFF.patch` (a35dc49 to dc8e40e)
- Executor report: `.../166-02-T2-EXEC-REPORT.md`
- The live tree at dc8e40e.

## Work the falsifier literally

T2 fails if ANY of these is true:

1. The 900k fixture passes only because text is omitted from the table rather
   than because a named note exists.
2. Retained text is not exactly 16000 characters.
3. The input, or a normal hit, is changed.
4. A note omits identity or counts.
5. Discarded content reaches disk or a log.
6. Status becomes failure or empty for a truncated but otherwise fine result.
7. Either response shape (top-level `hits`, `evidence.hits`) bypasses the cap.
8. The staged ceiling `VTP_RESPONSE_MAX_BYTES` was raised, bypassed, or
   weakened.
9. The Phase-48 bridge packet cap weakened.
10. A prompt retries unfiltered after truncation.
11. T1, P152, or P154 regressed.
12. T2 is not independently revertible.

Item 1 deserves real scrutiny. The executor was warned about it explicitly and
claims the red failed on the absent note while unchanged code still wrote its
normal success artifact. Verify that claim against the test code rather than
taking it.

Item 11 matters because T1 took three fix rounds and two CRITICALs to close.
Confirm the cap did not become a route around the gateway: a capped call must
still be `ok:true` carrying gateway evidence, prompt records must still be
mandatory including on `ok:false`, and caller-coverage must still fail closed.

## Orchestrator evidence, to audit rather than trust

Run unsandboxed at dc8e40e, all exit 0: megachunk-degraded-artifact, cap-shapes,
caller-coverage, executable-emitters, prompt-record-acceptance, repair-safe-t2,
substrate-policy-required, emitted-args, real-evidence, staged-vtp-oversized-response,
vtp-fallback-contained-degradation, staged-vtp-null-reflection-fallback,
composer, enrichment-gate, classify, feature-propagation, kb-triage-shadow.

Direct probe on a 900,001-character fixture with a marker appended to the
oversized text: retained exactly 16000; second hit byte-preserved; input
JSON unchanged; marker absent from output; note
`{reason_code:vtp_substrate_hit_truncated, hit_index:0, doc_id:doc:lint-report,
rel_path:wiki/LINT-REPORT.md, chunk_id:chunk:lint-report, original_chars:900026,
retained_chars:16000}`.

## Output

```
FINDINGS: <int>
CRITICAL: <int>
WARNINGS: <int>
PASS_RATE: <n>/12
ONE_LINER: <summary>
VERDICT: PASS | PASS-WITH-FINDINGS | FAIL
REQUIRED_CHANGES: none | <numbered>
```

Max 250 words after the contract lines.
