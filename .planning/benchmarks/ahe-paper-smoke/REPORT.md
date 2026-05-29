# SGSD Harness Benchmark 2026-04-29T23-13-51-830Z

Profile: smoke
Iterations: 1
Duration: 4312ms

## Score

- Cases: 49/49 passed
- Hardness score: 100.0%
- Failure detection score: 100.0%
- Failed: 0
- Blocked: 0

## Failures

None.

## Gate Coverage

- per-dispatch-ATC: positive=1, negative=1, mismatches=0
- sgsd-recall-queries: positive=1, negative=1, mismatches=0
- MUDA-waste-audit: positive=1, negative=1, mismatches=0
- qualitative-waste-audit: positive=1, negative=1, mismatches=0
- sgsd-curate-learnings: positive=1, negative=1, mismatches=0
- vtp-enrichment: positive=1, negative=1, mismatches=0
- verifier-row-arithmetic: positive=1, negative=1, mismatches=0
- verifier-detail-vs-summary: positive=1, negative=1, mismatches=0
- phase-level-ATC: positive=1, negative=0, mismatches=0
- classifier-haiku: positive=1, negative=0, mismatches=0
- context-selector-haiku: positive=1, negative=0, mismatches=0
- intent-injection: positive=1, negative=0, mismatches=0
- token-log: positive=1, negative=0, mismatches=0

## Prune Signals

- classifier-haiku: always-on-soft-warn. measure runtime/catches across live runs; candidate for sampling if catch rate stays zero.
- context-selector-haiku: always-on-soft-warn. measure runtime/catches across live runs; candidate for sampling if catch rate stays zero.
- intent-injection: always-on-soft-warn. measure runtime/catches across live runs; candidate for sampling if catch rate stays zero.
- token-log: always-on-soft-warn. measure runtime/catches across live runs; candidate for sampling if catch rate stays zero.

## Notes

This benchmark is deterministic. It proves gate contracts, failure detection, and telemetry shape. It does not yet run a live LLM build task.

For live build benchmarks, keep scenario decks, expected failures, and scoring oracles outside the model-visible workspace.
