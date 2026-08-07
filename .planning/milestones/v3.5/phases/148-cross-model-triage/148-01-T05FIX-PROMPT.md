# P148 T148-05 fix — recalibrate 4 miscounted assertions (tests-only)

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. File:
`super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs` ONLY.

## Diagnosis (orchestrator-confirmed)
The T148-05 matrix expansion (16→26 scenarios) broke 4 scenarios:
`codex-nonzero-single-model`, `runtime-dispatch-reconciliation`, `all`,
`ac-codex-unavailable-single-model` — all failing with count-assertion
mismatches of the shape `1 !== 41` (actual 1, expected 41). The RUNTIME is
unchanged since it passed 16/16 (T148-05 touched only the test file), so
these are miscalibrated NEW assertions from the "hardening" pass — most
likely a count computed against the wrong collection (e.g. asserting a
character/element count where a row count was intended, or counting rows
across ALL fixtures instead of one).

## Fix
Diagnose the 41-vs-1 counting error at its source and recalibrate the
assertions WITHOUT weakening intent: fixture-specific value assertions stay,
negative controls stay, the `SGSD_FIXTURE_CODEX_MARKER_T14803_NO_REAL_CODEX`
leakage guard stays, the `all` runner must genuinely run every scenario, and
`ac-*` aliases must map to the locked plan's acceptance commands. Do NOT
delete a failing assertion to make it pass — fix what it counts.

## Verify (report exact exit codes)
node --check; then the FULL suite — expect 26/26 (report final count; sandbox
EPERM caveat → say so, orchestrator re-runs host-side).
SURGICAL CONSTRAINT. <200-word report.
