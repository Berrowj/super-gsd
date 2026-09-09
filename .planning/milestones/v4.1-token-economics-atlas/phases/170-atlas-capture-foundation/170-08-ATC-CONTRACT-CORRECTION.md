---
phase: 170
plan: "170-08"
record_type: review_contract_correction
observed_at: "2026-09-09T15:52:28.659Z"
gate: per-dispatch-ATC
gate_status: blocked_pending_valid_report
corrects_report: 170-08-ATC-REVIEW-04.txt
corrects_worker_id: c8135301-7e1f-4368-97f6-9d7a96b2d448
report_sha256: e7a0886a214dffeebd05404b678679cd0d821c12c3ccd936ef8373f46be36409
---

# Correction: positive review is not a contract-valid gate pass

Root's one-use prompt requested free-text FINDINGS and percentage PASS_RATE.
The normal wrapper extracted all five fields and returned transport exit0, but
root omitted the existing secondary `validateContract` in
`super-gsd/skills/sgsd-orchestrate/SKILL.md:1361`. That function also applies to
per-dispatch ATC. It requires integer FINDINGS/CRITICAL/WARNINGS and an N/N
PASS_RATE. The exact function was now executed, unchanged, on the four original
reports. All four are invalid:

| Report | FINDINGS value | PASS_RATE value | Secondary result |
| --- | --- | --- | --- |
| 01 | empty | 90 | invalid |
| 02 | descriptive critical finding | 90% | invalid |
| 03 | descriptive critical finding | 90% | invalid |
| 04 | none | 100% | invalid |

The substantive critical findings01-03 remain useful observed review evidence;
their format failure does not invalidate the corresponding test-first repairs.
Report04's positive assessment is likewise retained, but its prior gate PASS and
the resulting170-09 activation are withdrawn until a genuinely valid report.
No CRITICAL count is invented:04 still reports zero code findings. This is a
report-contract failure caused by the root's orchestration, not a newly observed
source defect, provider outage or reason to change model/auth/circuit defaults.

Evidence is
`C:/Users/jack.berrow/AppData/Local/Temp/sgsd-fifo-diagnostic-1c91537ed4d3442b96a4c52867785307/atc-secondary-contract-K7njDD/result.json`.
The extracted existing validator hash is
`c33469c5e5835c5fcb380d33f9acf1e692ddfcd6b3857d9380aa1675a988f627`;
its source skill hash is
`2bafbbfb223799f5666c21c027f28dbbd26935ba91eb231b8f339e13fbcd85ad`.
The diagnostic ran no provider call and changed no source. Historical reports,
ledger prefixes, native usage reconciliation and commit4934ccb are preserved.

Task4's dated amendment authorizes exactly one unchanged-source, same-thread
contract-format continuation with the completed reviewer. It must preserve its
genuine verdict, pass the exact secondary validator and all existing review
requirements before another gate PASS is recorded.170-09 pauses at its safe
checkpoint; publication/deployment remains held. A new valid report would
supersede this blocking condition, not erase it.
