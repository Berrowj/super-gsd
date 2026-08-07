# P148 phase-verify gap fix — the CLI must emit what the SKILL renders

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files:
`super-gsd/scripts/sgsd-triage-runtime.cjs`,
`super-gsd/tests/triage-runtime/assert-real-triage-runtime.cjs`,
`super-gsd/skills/sgsd-triage/SKILL.md`. Nothing else.

## GAP-1 (CRITICAL) — AC-148d is harness-satisfied: the CLI drops the result
`main()` (~:1006) returns only an exit code. The reconciliation/verdict
objects exist in the module API, but the SKILL.md invokes the CLI — which
never emits them. Real sessions therefore cannot render the disagreement
surface; only in-process tests can. Fix: the CLI prints ONE structured JSON
result object to stdout (mode, singleModel, codex summary, reconciliation
object, degradation notes, evidence path) — machine-parseable, bounded, no
raw VTP payload dumps. SKILL.md Step 0/0.5/4 prose reads THAT output.
Extend the fixture runner with a CLI-path scenario: spawn the real CLI (not
in-process) in a fixture, parse stdout JSON, assert the disagreement object
with all three rationales arrives through the CLI seam.

## GAP-2 — route-failure fallback violates the LOCKED plan invariant
Plan: "VTP route failure is not the fallback predicate; route failure falls
through to normal triage with an observable degradation row and no retry."
The runtime currently attempts fallback on route error. NOTE FOR THE RECORD:
this deviation originated in the ORCHESTRATOR'S T148-01 prompt (scenario 4
demanded fallback-on-error), not in your predecessor's judgment. Align the
runtime to the plan: route failure → route_failed degradation row, NO
fallback call, triage continues evidence-less. Update the route-error
scenario to assert NO fallback invocation occurred (transport records calls —
assert search tool was NOT invoked) plus the row.

## GAP-3 — SKILL claims `workflow.triage_vtp_enrichment` toggle; runtime ignores it
Make the runtime consume it: config false → skip VTP entirely with an
observable `vtp_enrichment_disabled` row (not silent), still proceed. Scenario
for both toggle states.

## GAP-4 — 300s silent wait
Before dispatching Codex, the runtime prints ONE stderr line: dispatching +
timeout budget + the codex-live output path (the wrapper already writes
codex-live outputs). SKILL.md Step 0.5 mentions where to watch. No spinner
machinery — one honest line.

## GAP-5 — skip reason code name
Plan expects `codex_skipped_non_planning`; runtime emits
`trigger_source_not_planning_triage`. Align to the plan's name (update the
existing scenario assertion).

## Preserve
All 26 scenarios (updated where specified above), Probes 1-7 untouched
(codex-exec.sh NOT in your file list), leakage marker, containment, closed
vocab, rationale-mandatory.

## Verify (report exact exit codes)
node --check both cjs; full suite INCLUDING the new CLI-path scenario
(expect 27-28; sandbox EPERM caveat → say so); grep-invariants for SKILL
(toggle documented, watch-path mentioned).
SURGICAL CONSTRAINT. <250-word report.
