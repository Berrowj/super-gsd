# Fixture: score-70-clean

Synthetic empty planning dir that exercises the "live module-presence
probes" path. When `score.cjs --planning-dir <this-dir>/..` runs, the
canonical streams are missing (each contributes 0 pts) but the
module-presence buckets (token_governance, memory_governance,
routing_quality, lock_invariants) compute against the real project tree
and yield their full points.

For a true synthetic 70+ fixture we cover the path via the inline
`selfTest()` assertion `live_compute_shape_ok` which calls
`computeScore({milestone: 'v2.0'})` directly against the live project
canonical streams (Phase 41-56 evidence already present).

This fixture directory is intentionally empty (README only). It exists
to document the test pattern; the actual GREEN coverage is verified
against the live project root in:

  node super-gsd/tools/release-readiness/score.cjs --milestone v2.0

which uses the live `.planning/metrics/*.jsonl` evidence shipped by
Phases 53-56.
