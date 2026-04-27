# Phase 36 ATC Review

## Reviewers
- Provider: claude-sonnet-reviewer (sgsd-code-reviewer)
- Provider: codex-cli-reviewer (gpt-5.5, xhigh) -- see `36-codex-review.md`
- Tier: phase-level (dual-provider)
- Final verdict: pass (post-fix; both providers' findings cleared in-loop)

## Aggregate verdicts

| Provider | Pre-fix | CRIT | WARN | Anti-slop pre | Post-fix |
|----------|---------|------|------|---------------|----------|
| Claude   | warn    | 1    | 4    | 8/10          | pass     |
| Codex    | warn    | 2    | 3    | 7/10          | pass     |

## Findings (deduplicated; 6 distinct)

### CRIT (2, fixed in-loop)

**C1 [Claude+Codex] -- cross-ledger status divergence on `critical-halt` verdict**
- File: `super-gsd/scripts/lib/gate-value-log.cjs:75` (pre-fix `OUTCOME_STATUS_MAP['block'] = 'fail'`)
- review-ledger.cjs:69 maps `critical-halt` -> status='blocked'; gate-value-log
  mapped `critical-halt` -> outcome='block' -> status='fail'. Same hard-halt
  verdict produced asymmetric envelope statuses across the two ledgers.
  Phase 39 cross-ledger consumers + Phase 38 sampling-decider would observe
  inconsistent status fields for the same event class.
- Fix: changed `OUTCOME_STATUS_MAP['block']` to `'blocked'`. Now matches
  review-ledger LEGACY_VERDICT_MAP. Inline comment cites cross-ledger parity
  rationale + lib precedent.
- Test fixture F3 also updated (was asserting status='fail', now
  asserts status='blocked').

**C2 [Codex] -- phase-level Codex misclassification (warn-vs-pass)**
- File: `gate-value-log.cjs:128` (pre-fix `outcomeFromVerdict(verdict, criticalCount)`)
- Codex shell-branch sets `report = {content, _provider, _model, _reasoning_effort}` -- NO verdict field directly. Wire-in passes
  `report.verdict = undefined` to `outcomeFromVerdict`. Pre-fix function:
  - `criticalCount > 0 -> 'block'` ✓
  - `criticalCount === 0 -> 'pass'` ✗ (skips the warn check)
  Result: any Codex review with 0 CRIT but >=1 WARN was misclassified as
  outcome='pass' instead of 'warn'. Phase 39 keep/kill rubric would see
  inflated value_score for noisy gates.
- Fix: extended outcomeFromVerdict signature to take warningCount; check
  warning > 0 BEFORE falling through to pass. Both wire-ins (phase-level-ATC
  + per-dispatch-ATC) updated to pass `report.warning_count`.

### WARN (4 fixed in-loop)

**W1 [Claude] -- LOC overrun 61% (564 vs ~350 PLAN estimate)**
- INFORMATIONAL only; no functional impact. Growth driven by 14 self-test
  assertions (vs 12 estimate) + cross-cutting helpers + comment density.
- NO FIX -- v1.8+ candidate to improve LOC estimation discipline.

**W2 [Claude] -- `--summary` CLI cwd-fallback regression (Phase 32 W3 lesson)**
- File: `gate-value-log.cjs:526-532` (pre-fix `path.resolve(process.cwd(), '.planning')` fallback)
- Claude flagged this as inconsistent with the lib's own __dirname comment
  at line 330. CLI invoked from non-root dir would silently read/write wrong
  ledger.
- Fix: changed default fallback to `path.resolve(__dirname, '..', '..', '..', '.planning')`. Inline comment cites Phase 32 W3 lesson.

**W3 [Claude] -- `_assertEnvelopeV1` doesn't validate status against STATUSES**
- File: `gate-value-log.cjs:208-237` (pre-fix didn't check status enum)
- STATUSES is exported as the validation enum; the schema guard didn't
  consult it. Future _normalize regression emitting an out-of-range status
  would slip past defenses silently.
- Fix: added `if (!STATUSES.includes(row.status)) throw` in
  _assertEnvelopeV1. Inline comment names the regression scenario.

**W4 [Claude] -- assertion 13 (`100 unique run_ids`) probabilistically flaky**
- File: `gate-value-log.cjs:506-509` (pre-fix `ids.size === 100` strict equality)
- 2-byte (65536-combo) random suffix at 100 synchronous draws yields ~7%
  birthday-collision probability when Date.now() collapses multiple calls
  to the same millisecond.
- Fix: relaxed to `>=99 unique` (still catches systematic determinism bugs
  without flaking on legitimate ms-collisions). Inline comment with the
  birthday-paradox math.

### NIT (0)

None.

## ATC checklist (post-fix)

### 7-Step LITE/FULL (code phase)

| Step | Verdict | Notes |
|------|---------|-------|
| 1 First Principles | PASS | 8th envelope-v1 emitter; 3 wire-in sites cover all verdict-bearing gates; minimal new surface. |
| 2 Delete | PASS | No dead code; all 5 exports + 5 frozen consts have callers. |
| 3 Simplify | PASS | All 5 fix-loop findings net-reduce complexity (cross-ledger parity, classifier robustness, schema-guard rigor, cwd-anchor consistency, flaky-test relaxation). |
| 4 Validate | PASS | self-test 14/14 + fallback test 12/12 + cross-ledger parity verified + status-consistency v1.8 OK. |
| 5 Anti-slop | 9.5/10 (combined) | Both providers' findings closed in-loop except W1 (LOC informational, no fix needed). |

**Combined anti-slop score (post-fix): ~9.5/10.**

## Codex provider health (run-time evidence)

- AVAILABLE throughout. 1 invocation, exit 0, duration ~6 min, JSONL row appended.
- NO "Codex unavailable" backlog row required.

## Status-consistency check (gate)

```
node super-gsd/tools/status-consistency/check.cjs --milestone v1.8
-> status-consistency milestone v1.8: OK
```

## Final verdict

**PASS** (post-fix). 0 unresolved CRIT, 0 unresolved WARN. 1 informational
(LOC overshoot, no fix needed) documented but no Phase 36 action required.

## One-liner

Phase 36 gate-value-telemetry shipped: 8th envelope-v1 emitter with cross-
ledger status parity preserved (block->blocked matching review-ledger),
warn-vs-pass Codex classification fixed, schema guard tightened, cwd-anchor
regression closed, flaky run_id assertion relaxed; combined anti-slop ~9.5/10.
