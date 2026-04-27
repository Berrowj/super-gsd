---
phase: 41
name: Baseline Token Attribution
milestone: v1.9
type: code (tool + report + ledger backfill)
depends_on: []
unblocks: [42, 43, 44, 51]
discuss_decisions: []
created: 2026-04-27
---

# Phase 41 Context

## Goal

Establish a truthful token-spend baseline before changing architecture.
Produce `.planning/metrics/agent-token-spend.jsonl` (envelope-v1 wrapped
canonical ledger) + `.planning/milestones/v1.9/baseline-token-spend.md`
(human-readable bloat report) showing which SGSD roles consume the most
tokens, what they read, whether VTP/Codex was used, and which roles are
substitution candidates per evidence-driven heuristics.

**Do not optimize yet. Measure first.**

## Locked decision

41 auto-defaulted from SGSD-Research handover packet (no interactive
discuss). All 11 derivation calls locked in `41-RESEARCH.md` §11.

## Key research finding

`.planning/metrics/token-attribution.jsonl` ALREADY contains **11,173
rows (7.5MB)** with exact token counts (`usage.input_tokens`,
`cache_read_input_tokens`, `cache_creation_input_tokens`,
`output_tokens`, `total_tokens`). Backfill is **derivation, not
estimation**, for the bulk of v1.9 baseline. `codex-log.jsonl` adds 67
byte-estimated rows (with `tokens_estimated: true` flag).

## What the planner must produce

ONE plan: `41-01-baseline-token-attribution-PLAN.md` with the following
deliverables:

1. **NEW tool** at `super-gsd/tools/token-attribution/report.cjs`
   (~600 LOC; 1:1 mirror of `super-gsd/scripts/lib/gate-value-log.cjs`):
   - Frozen consts:
     - `ROLES = Object.freeze(['researcher','planner','executor','verifier','reviewer','orchestrator','classifier','other'])`
     - `BLOAT_THRESHOLDS` (low_useful_findings=15, high_cache_read_ratio=0.9, high_files_read=50, low_diff_lines=100)
     - `RUN_ID_REGEX` (envelope-v1 pattern)
   - Public exports:
     - `appendTokenSpend(planningDir, row)` — atomic envelope-v1 append
     - `backfillFromMetrics(planningDir, opts)` — walk source streams
     - `report(planningDir, opts)` — produce markdown bloat report
     - `summarize(planningDir, opts)` — JSON aggregation for Phase 42 consumption
     - `ROLES`, `BLOAT_THRESHOLDS` (frozen)
   - Row shape: envelope-v1 + 3 extension fields (`role`, `provider`,
     `token_breakdown` object). `command: 'logTokenSpend'`.
   - All public APIs in try/catch (mirrors Phase 32-40 locked design).
   - `_normalize` + `_assertEnvelopeV1` per Phase 36 pattern.
   - --self-test mode running 14 assertions in tmpdir;
     __dirname-anchored fingerprint guard over 4 canonical streams
     (token-attribution.jsonl, token-log.jsonl, codex-log.jsonl,
     activity-log.jsonl).
   - --backfill CLI mode (one-shot derivation from existing streams)
   - --report CLI mode (regenerate baseline-token-spend.md)
   - --summary CLI mode (JSON for Phase 42 consumer)

2. **GENERATED ledger** at `.planning/metrics/agent-token-spend.jsonl`:
   - Backfilled from token-attribution.jsonl (11,173 source rows; idempotent
     via `agent_id + ts` dedup tuple)
   - Backfilled from codex-log.jsonl (67 source rows; byte-estimated with
     `tokens_estimated: true`)
   - First-wave envelope-v1 emitter (Phase 31 contract preserved)

3. **GENERATED baseline report** at
   `.planning/milestones/v1.9/baseline-token-spend.md`:
   - Top-consumer table: role × phase × provider × total_tokens ×
     cache_read_ratio × useful_findings_per_token
   - Outlier section: rows where cache_read_ratio > 90% AND useful_findings < 15
     (the audit's bloat signature)
   - Substitution-candidate section: 5 R-rules from RESEARCH §5

## Acceptance (BASE-01..04, runnable)

- **BASE-01**: `.planning/metrics/agent-token-spend.jsonl` exists; every
  row passes envelope-v1 manual schema check (13 required fields + 3
  extension fields)
- **BASE-02**: `--backfill` produces ≥10,000 rows (since 11,173+67
  source rows available); idempotent re-run yields byte-identical output
- **BASE-03**: `.planning/milestones/v1.9/baseline-token-spend.md` exists;
  contains at minimum top-consumer table + outlier section + substitution-
  candidate section
- **BASE-04**: report enumerates ≥1 substitution candidate per role with
  evidence row count + threshold-trip rationale

## Open derivation calls

NONE — all 11 calls locked in 41-RESEARCH.md §11. Notable locks:
- Q1: envelope-v1 wrapped (LOCKED)
- Q2: 3 extension fields (role/provider/token_breakdown) (LOCKED)
- Q3: tokens-vs-bytes — exact when available, byte/4 estimate otherwise
  with `tokens_estimated: true` flag (LOCKED)
- Q4: backfill window — all available source rows (LOCKED)
- Q5-Q9: substitution-candidate thresholds locked verbatim
- Q10: `useful_findings` proxy = `tool_stats.linesAdded` (LOCKED for v1.9; Phase 42 may refine)
- Q11: include orchestrator self-spend (LOCKED per LOCK 6 — biggest consumer per audit)

## Standard workflow

Phase 41 is code (1 new tool + 2 generated artifacts). Standard
workflow runs full:
- Step 1 (pattern-mapper): SKIPPED — research mapped 1:1 to Phase 36
  gate-value-log.cjs architecture
- Step 7 (MUDA): RUNS (~600 LOC threshold met)
- Step 9 (phase-level ATC): RUNS dual-provider per readiness GO

## Status taxonomy at close (anticipated)

PASS expected. v1.7-v1.8 precedent: dual-provider review surfaces 5-7
distinct findings, all in-loop fixable. Phase 41 is also v1.9's first
phase, so the orchestrator may surface new concerns specific to
SGSD-Research scope (e.g., useful_findings counting).

## Kill / defer conditions

- Defer if backfill produces <100 rows after sourcing token-attribution.jsonl
  (would mean source data is missing or schema mismatched; revisit Phase 41
  scope before Phase 42 budget design)
- Hard stop if backfill writes to canonical streams (token-attribution.jsonl,
  codex-log.jsonl, etc.) — Phase 41 is read-only against source streams; only
  agent-token-spend.jsonl + baseline report are write targets.

## Cross-phase contract

- Phase 42 (Token Budget Admission) consumes `summarize()` output to set
  per-role budgets and check cache-read ratios.
- Phase 47 (Dispatch Routing Substitution) consumes substitution-candidate
  rules from baseline-token-spend.md to inform routing policy.
- Phase 51 (Context Stress Benchmark) consumes the baseline numbers as
  the "before" measurement for ≥50% reduction acceptance.
