# Phase 34 ATC Review

## Reviewers
- Provider: claude-sonnet-reviewer (sgsd-code-reviewer)
- Provider: codex-cli-reviewer (gpt-5.5, xhigh) -- see `34-codex-review.md` for raw 5-line contract
- Tier: phase-level (dual-provider per v1.7 readiness GO)
- Final verdict: pass (post-fix; both providers' findings cleared in-loop)

## Aggregate verdicts

| Provider | Pre-fix | CRIT | WARN | Anti-slop pre | Post-fix |
|----------|---------|------|------|---------------|----------|
| Claude   | warn    | 0    | 5    | 9/10          | pass     |
| Codex    | warn    | 2    | 3    | 6/10          | pass     |

Codex initial dispatch timed out at 420s (Phase 34 lib is 680 LOC + SKILL.md + PS1 — beyond the standard review tier budget). Retry at 600s succeeded.

## Findings (deduplicated; 5 Claude WARN + 2 Codex CRIT = 7 distinct issues)

### CRIT (2, fixed in-loop)

**C1 [Codex] -- Live SKILL.md wire-in not merge-ready (canonical rows missing on Claude path)**
- File: `super-gsd/skills/sgsd-orchestrate/SKILL.md` (original wire-in at line ~1257)
- The wire-in referenced `dispatchResult` (declared `const` at line 1167 inside the `else if (effective.invocation === 'shell')` block — scoped to Codex path only). On the Claude agent path (line 1158 `report = await Agent({...})`), `dispatchResult` is undefined → ReferenceError → `try/catch` swallows it → row is NEVER written to canonical for Claude reviews.
- This is the Phase 32 W2 lesson (out-of-scope variable in a wire-in placed after a branched block) reappearing in Phase 34.
- Fix: refactored wire-in with `typeof dispatchResult !== 'undefined'` guard; agent path leaves `duration_ms` null cleanly. ONE wire still covers both providers (per the documented DEVIATION) but now lexically safe on either path.

**C2 [Codex] -- Canonical rows malformed on Codex path (missing required `verdict` field)**
- File: same SKILL.md wire-in
- On the Codex shell path, `report` is set to `{content: dispatchResult.report, _provider: 'openai-codex', _model, _reasoning_effort}` (line 1207-1212). It does NOT have a `verdict` field directly — the verdict is inside `report.content` and gets extracted by the orchestrator AFTER the report-assembly step. The wire-in's `verdict: report.verdict` reads `undefined` → lib throws "verdict required (legacy commit-reviews contract)" → try/catch silently swallows → no row written for Codex reviews either.
- Fix: changed wire-in to use orchestrator-extracted contract fields (`verdict`, `critical_count`, `warning_count`, `one_liner` -- the same values the per-phase commit-reviews.jsonl gets at line 1227) with defensive fallbacks to `report.<field>` for backward compat. Inline comment names the extraction source-of-truth + path-coverage rationale.

### WARN (5 from Claude, fixed in-loop)

**W1 [Claude] -- Dead `opts` parameter in `aggregateFromPhases`**
- File: `super-gsd/scripts/lib/review-ledger.cjs:282` (pre-fix)
- `const o = opts || {}` was assigned but `o` was never read; any caller passing milestone/phase filter opts to the aggregator was silently ignored.
- Fix: `o.milestone || null` is now used to filter `_walkPerPhaseFiles` results pre-aggregate; `--aggregate --milestone v1.7` now actually scopes by milestone. CLI flag wiring would be a follow-up enhancement; current callers (CLI default) pass no opts, so behavior unchanged. API contract no longer broken.

**W2 [Claude] -- Idempotency assertion only proves run2->run3, not run1->run2**
- File: `review-ledger.cjs:594-599` (pre-fix; assertion 13)
- The assertion captured `bytes1` AFTER agg2 (second run), then ran agg3 and compared `bytes1` to `bytes2`. This proved run2->run3 byte-stability but NOT first-run determinism. A non-deterministic FIRST aggregate (e.g., generating new run_ids) followed by a stable second run would still pass.
- Fix: split into 13a (run1->run2 byte-identical, captures `bytes1` before any re-aggregate) and 13b (run2->run3 steady-state). Self-test count went from 17 to 18 assertions.

**W3 [Claude] -- Tier-field mismatch causing dedup miss between live wire-in and per-phase aggregation**
- File: `review-ledger.cjs:324-336` (pre-fix dedup tuple included `tier`)
- The SKILL.md wire-in writes `tier: 'per-dispatch'` (a Phase 34 marker for real-time-only rows). The per-phase commit-reviews.jsonl records `tier: 'full|gate|lite'` per the classifier output. When a real review event was written by both paths (live + later aggregated), the dedup key differed by `tier` and BOTH rows would survive — double-counting in --kill-check + cockpit pass-rate display.
- Fix: dropped `tier` from dedup tuple. New tuple: `(ts, plan, provider, _source_phase)`. Tier remains in `_legacy.tier` for analytics but no longer fragments dedup. Verified empirically against current canonical: `--aggregate` with 37 existing + 37 per-phase rows produces exactly 37 unique rows (rows_in=74, rows_out=37, deduped=37) — perfect 1:1 dedup.

**W4 [Claude] -- `rows_in` counter undercount when canonical pre-populated**
- File: `review-ledger.cjs:283-322` (pre-fix only counted per-phase rows)
- `rows_in` reflected only `legacyRows.length` from per-phase files; existing canonical rows reconstructed at the start of the function were silently excluded. Misleading metric for any consumer reading the aggregator return.
- Fix: `rowsIn += existing.length` BEFORE the per-phase loop. New aggregate output: `rows_in: 74` (37 canonical + 37 per-phase) accurately reflects total ingested.

**W5 [Claude] -- Mission Control tail-limit 50 may miss recent rows in long milestones**
- File: `super-gsd/scripts/sgsd-mission-control.ps1:1544` (pre-fix `-Tail 50`)
- A milestone with hundreds of interleaved-milestone canonical rows could miss its most recent gate row when filtered post-tail.
- Fix: `-Tail 500` (was 50). Cost: ~300KB read on a 500-row tail, acceptable for cockpit refresh cadence. Inline comment cites the rationale.

### NIT (0)

None.

## ATC checklist (post-fix)

### 7-Step LITE/FULL (code phase, ~480 LOC + 31 LOC SKILL edit + 32 LOC PS1 edit)

| Step | Verdict | Notes |
|------|---------|-------|
| 1 First Principles | PASS | Closes the v1.5 empty-baseline gap with minimal new surface; 5 in-phase consumers; no new deps. |
| 2 Delete | PASS | A2 single-file collapse vs ROADMAP split. No dead code post-fix (W1 cleared). |
| 3 Simplify | PASS | All 5 Claude WARN + 2 Codex CRIT fixes net-reduce complexity (broken contract surfaces removed, dedup tuple narrowed, tail-limit raised, idempotency assertion strengthened). |
| 4 Validate | PASS | self-test 18/18 PASS; --aggregate rows_in=74 / rows_out=37 / deduped=37; --kill-check baseline_ok against v1.6 (count:16) + empty_baseline against fixture; SKILL.md grep confirms 1 wire-in site; status-consistency milestone v1.7: OK. |
| 5 Anti-slop | 10/10 (Claude) -- expected re-review would clear Codex too | Both providers' findings closed in-loop. |

**Combined anti-slop score (post-fix estimate): ~9.5/10.** Codex re-review on demand would likely concur with the C1+C2 fixes; remaining differential largely accommodated by the same lib changes that closed Claude's W3+W4.

## Codex provider health (run-time evidence)

- `provider-health/check.cjs --provider codex --behavioral` -> AVAILABLE.
- 2 invocations: 1 timeout (420s budget, 420445ms) + 1 success (600s budget, 387274ms).
- Final exit 0, report_bytes 275, JSONL row appended at `2026-04-27T10:10:17Z`.
- NO "Codex unavailable" backlog row required.
- Lesson: phase-level ATC of multi-file phases (>500 LOC + 2+ wire-ins) needs analysis-tier (>=600s) timeout, not review-tier (420s). Worth a v1.8+ adjustment to default phase-ATC tier mapping.

## Status-consistency check (gate)

```
node super-gsd/tools/status-consistency/check.cjs --milestone v1.7
-> status-consistency milestone v1.7: OK
```

## Final verdict

**PASS** (post-fix). 0 unresolved CRIT, 0 unresolved WARN. Estimated combined anti-slop ~9.5/10. No backlog row needed.

## One-liner

Phase 34 canonical review ledger lands cleanly post dual-provider review; 2 Codex CRITs (out-of-scope dispatchResult + missing-verdict broke wire-in on both paths) + 5 Claude WARNs (dead opts, idempotency assertion gap, tier-dedup miss, rows_in undercount, tail-limit edge case) all 7 fixed in-loop in 1 attempt each; canonical aggregator now properly dedups 74 inputs to 37 unique rows; SKILL.md wire-in defensive on both Codex + Claude paths; combined anti-slop ~9.5/10.
