# P149-T6 Acceptance Run — 2026-08-08T14:24:42Z (orchestrator-executed; verification-only task)

## SAC-1 schema field check (real table)
```
skill-routing rows=24
exit: 0
```
## SAC-2 inventory coverage
```
inventory coverage ok
exit: 0
```
## SAC-3 registry self-test (real)
```
skill-routing-registry self-test: 12 pass, 0 fail
exit: 0
```
## SAC-4 malformed self-test (expect nonzero)
```
skill-routing-registry self-test: 0 pass, 1 fail
  FAIL: registry schema validation -- skill-routing-registry schema invalid: routes[0].skill must be a non-empty string when present; routes[1].signatures regex exceeds maximum pattern length of 200: 201; routes[2].signatures regex contains unsafe repeated group: (a+)+; routes[2].signatures regex contains unsafe repeated group: (a*)*; routes[2].signatures regex contains unsafe repeated group: (a|a)*; routes[3].signatures regex invalid: [unterminated (Invalid regular expression: /[unterminated/i: Unterminated character class)
exit: 0
```
## SAC-5 malformed runtime probe (fallback + degradation)
```
    "/sgsd-vtp-advise",
    "/sgsd-code-review",
    "/sgsd-code-review-fix",
    "/sgsd-audit"
  ]
}
exit: 0
```
## SAC-6 manual suggestions x3
```
SGSD skill suggestion: /sgsd-muda-audit
SGSD skill suggestion: /sgsd-token-audit
SGSD skill suggestion: /sgsd-muda-audit
SGSD skill suggestion: /sgsd-sepl
SGSD skill suggestion: /sgsd-vtp-advise
exit: 0
```
## SAC-7 phase-close consult dry-run
```
{"ok":true,"event":"skill-routing","source":"yaml","degraded":false,"moment":"phase-close","mode":"auto","phase":"149","milestone":"v3.5","dry_run":true,"route_count":5,"fired_count":0,"skipped_count":5,"evidence_appended":5,"decisions":[{"route_id":"sgsd-muda-audit:phase-close:02","skill":"sgsd-muda-audit","decision":"skipped","reason":"gate_ref_not_observed:MUDA-waste-audit","evidence_appended":true},{"route_id":"sgsd-overwatcher:phase-close:08","skill":"sgsd-overwatcher","decision":"skipped","reason":"phase_cooldown_already_fired:once-per-phase","evidence_appended":true},{"route_id":"sgsd-readiness:phase-close:11","skill":"sgsd-readiness","decision":"skipped","reason":"phase_cooldown_already_fired:route-policy","evidence_appended":true},{"route_id":"sgsd-audit:phase-close:12","skill":"sgsd-audit","decision":"skipped","reason":"gate_ref_not_observed:phase-level-ATC","evidence_appended":true},{"route_id":"sgsd-memory-hygiene:phase-close:15","skill":"sgsd-memory-hygiene","decision":"skipped","reason":"gate_ref_not_observed:sgsd-curate-learnings","evidence_appended":true}]}
exit: 0
```
## SAC-8 evidence rows present
```
25
exit: 0
```
## classifier self-test
```
[SGSD] skill-routing-registry skill_routing_registry_malformed: using compiled fallback
intent-classifier self-test: 8 pass, 0 fail
exit: 0
```

## Corrected exit codes (runner pipe bug re-verified directly)

| Check | Exit | Expectation | Verdict |
|---|---|---|---|
| SAC-3 real registry self-test | 0 | 0 | PASS |
| SAC-4 malformed self-test | 1 | nonzero | PASS |
| SAC-5 malformed runtime probe (fallback+degradation) | 0 | 0 | PASS |
| classifier self-test (8/8) | 0 | 0 | PASS |
| SAC-7 phase-close consult dry-run | 0 | 0 | PASS |

AC-149a (schema self-test) PASS · AC-149b (visible manual suggestion) PASS ·
AC-149c (phase-close fired/skipped evidence rows) PASS.
Note: plan's T6 command sketch used `skill-routing --moment ...`; implemented
CLI is `--skill-routing-consult` — same capability, flag-name drift recorded.
