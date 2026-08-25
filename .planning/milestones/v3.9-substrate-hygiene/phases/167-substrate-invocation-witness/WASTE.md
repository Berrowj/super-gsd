# P167 MUDA audit

Fires on both thresholds: 19 files changed and 8,168 insertions, far over
files_changed>=4 OR diff_lines>=100.

## Mechanical probes

| Waste | Probe | Value | Verdict |
|---|---|---|---|
| Overproduction | files touched vs plan | 19 vs 19 declared + 2 recorded deviations | PASS |
| Inventory | uncommitted source at close | 0 | PASS |
| Transport | commits in phase | 17 (13 source, 4 docs) | PASS |
| Waiting | STATE.md narrative age | ~1 day | PASS |
| Motion | capture wall time | 7-8 min to 81s after cleanup | IMPROVED |
| Extra processing | scaffolding removed at ATC | 442 lines | CLOSED |
| Defects | fix and refactor commits | 7 | see below |

## Motion, the largest single waste found

The live-capture harness copied the whole `super-gsd` tree once per scenario:
10,506 files and 101.7 MB each time, of which 7,569 files and 73.4 MB were
`node_modules`. Three scenarios meant roughly 300 MB of copying per capture, on
every one of about a dozen capture runs during this phase.

Phase-level ATC caught it. Each scenario now seeds 402 runtime files at 933 KB,
and a mutation probe proves isolation still holds. Capture wall time went from
seven or eight minutes to 81 seconds.

This is the second instance of the same waste in two phases. P166 removed a test
that scanned 2,523 `node_modules` files for the same reason. Both were found by
ATC rather than by anything that watches for it, which is worth noting as a
recurring gap rather than two coincidences.

## Extra processing, 442 lines

Fourteen fix rounds each added a diagnostic dump to answer one question:
payload comparison, hook lifecycle, tool result, response shape, tally
mismatch, bypass payload. Every one earned its round. None was removed when its
question was answered, and one was left logging inside the production hook on
every matching tool call.

The cost is real but so was the benefit: those same diagnostics are what turned
four blind fix rounds into six that each resolved in one shot.

## Defects, 7 fix rounds

Not MUDA waste in the strict sense, but the honest record. Each was triggered by
an independent review or a live run finding a real defect:

1. T1 coverage red on two unclassified declaration strings.
2. T2 acceptance seam plus a wrong-diagnosis chain that cost four rounds.
3. T3 caller-inventory coupling, a recorded scope deviation.
4. T4 spec CRITICAL, cross-project authority leak; ATC CRITICAL, installer
   blast radius rewriting operator config.
5. T5 production defect: the hook rejected the response shape the runtime
   actually sends, so every valid search would have been replaced with an error.
6. T5 two false-passes: a bypass reporting success on a blocked call, and
   acceptance satisfied by a passthrough rather than a real rewrite.
7. T5 ATC scaffolding and the overshooting seed trim.

Item 5 is the one that justifies the phase's cost. It was invisible to 34
passing fixture assertions and only appeared on contact with a real runtime.

## No BLOCKED rows

One credentials pause, resolved by the operator supplying a token. No external
service dependency, no rework from a wrong assumption about the codebase.
