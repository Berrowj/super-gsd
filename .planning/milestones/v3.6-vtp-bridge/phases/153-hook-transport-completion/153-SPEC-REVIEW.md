# P153 spec-compliance review, round 1 — verdict record (scrubbed)

This file originally embedded the reviewer's full 761KB working transcript, which
included repo listings quoting `.planning/tmp` VTP-evidence files carrying wiki-quote
names. Scrubbed to the verdict record on 2026-08-20 per the no-PII-in-repo rule before
first push. The full transcript never left this machine; intermediate branch history
is excluded from the push via squash-merge.

```
SPEC_VERDICT: fix_required
MISSING_REQUIREMENTS: AC2, AC3, AC4, AC6, AC7 — P153-T1b/T2d does not prove classifier-specific dispatch
EXTRA_SCOPE: super-gsd/CLAUDE-OVERLAY.md adds an unrequested communication/Recap protocol
VERIFICATION_MAPPING: AC1 registration PASS; AC2/3/6/7 live evidence records expected rows but the assertion false-passes with guard-only lifecycle plus a forged row; AC4 therefore fails; AC5 nonce/replay OK; AC8-10 guard OK; AC11 shadow OK
RELAXATION_SAFE: no — a successful guard hook pair plus a forged session-correlated routing row passes without classifier lifecycle
ALLOWLIST_DRIFT_SAFE: yes
SECRET_SAFETY: pass
DEFERRALS_HONEST: yes
ONE_LINER: Core transport works, but the causal probe reopens the exact harness-green/production-dead hole P153 was meant to close.
```

Disposition: the RELAXATION_SAFE finding was fixed in commit d1c2f7f (T2e,
guard-lifecycle bypass closed); round 2 then found the deeper unbind, resolved by
operator decision 2026-08-20 as gap-plan option 3 (documented limitation in the probe).
EXTRA_SCOPE was operator-directed out-of-plan work, acknowledged in deviations.
