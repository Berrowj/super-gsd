# Brief: BM25 Memory Layer Indexing Strategy

## Situation

The Super GSD framework uses a local BM25 query engine to retrieve relevant decisions, patterns, and scripts from `.brv/context-tree/` before each agent dispatch. The current implementation in `brv-query-local.js` performs a linear scan over all files in the context tree on every query, scoring each against the query terms. Phase 2 built this with ~40 seed files. Phase 3 confirmed it works. However, as the context tree grows (estimated 200-500 files by Phase 7 install), the linear scan creates two risks: (1) latency exceeds the 100ms requirement from MEM-01, and (2) the orchestrator injects irrelevant context noise when BM25 scores are uniformly low across a large corpus. No index is built on write; the query reads every file every time. The current seed set is small enough that this hasn't been a measured problem, but Phase 7 install will seed 40+ files at once, and production projects may add hundreds more over months.

## Stakes

If BM25 query degrades past 100ms, MEM-01 is violated and the orchestrator must either skip context injection (reducing agent quality) or block on slow queries (increasing dispatch latency). If context injection becomes noisy at scale, agents receive irrelevant EXISTING: hints, which actively misleads them. The indexing decision affects Phase 2 (brv-query-local.js), Phase 3 (orchestrator dispatch loop), Phase 7 (install seeder), and every future project using Super GSD — 4 phases total. Getting this wrong means a rewrite during Phase 7 integration testing, the worst possible time.

## Constraints

- No external dependencies — BM25 must remain pure Node.js with fs+path only (established in Phase 2)
- No API keys — Max plan OAuth only
- Must not break the existing `brv-query-local.js` interface (orchestrator calls it as-is)
- Index files, if any, must live inside `.brv/` and be excluded from context-tree queries
- Changes must be backward-compatible: existing projects with no index file must still work

## Key Questions

1. Should we build an inverted index on `brv-curate` writes, stored as `.brv/index.json`, so queries read the index instead of all files?
2. If yes: what is the correct granularity — per-token inverted index, or per-file TF-IDF snapshot?
3. If no index: is a 500-file linear scan within 100ms on the machines that matter (Windows WSL2, M-series Mac, cloud Linux), and should we add a benchmark before deciding?
4. Does solving this in Phase 5 (now) vs. deferring to Phase 7 (install) change the risk profile meaningfully?

## Additional Context

- MEM-01 requirement: <100ms query with no API key
- Phase 2 implementation: `super-gsd/brv-seed/brv-query-local.js`, `brv-curate-local.js`
- Phase 7 install will call `brv-curate-local.js` 40+ times during seeding
- Previous decision: Manual YAML serialization, no yaml library — fs+path only

## Termination

phases_affected: 4
max_rounds: 2
gate_score: PROCEED
