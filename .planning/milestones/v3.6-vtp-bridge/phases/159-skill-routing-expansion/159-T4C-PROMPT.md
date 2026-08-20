# P159-T4C — one regression: kb-shadow latency_ms no longer includes serialization

Single file: `super-gsd/hooks/sgsd-intent-classifier.cjs`. Edits-first; no spawns;
do NOT commit; do NOT touch any other file.

P152's locked contract test fails deterministically post-T4B:
`super-gsd/tests/kb-triage-shadow/assert-shadow.cjs:129`
"latency_ms must include JSON serialization before the append syscall"
(asserts row.latency_ms >= injected serializationDelayMs - 2).

Around sgsd-intent-classifier.cjs:633-660 the kb-shadow append path was refactored
for T4 suppression; the latency capture now happens before the row is JSON
serialized. Restore the P152 ordering for the kb-shadow row: compute latency AFTER
serialization (the null-placeholder replace pattern at line ~649 was the original
mechanism), keeping all T4/T2/T1 behaviour identical.

Static verify: node --check, plus read the test's assertion block to confirm the
ordering satisfies it. Do not weaken or edit the test.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 100 words.
