---
phase: 09-atc-147-evidence
reviewed: 2026-04-22T00:00:00Z
tier: LITE
anti_slop_pass_rate: 10/10
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: warn
recommendation: mark phase complete
---

# Phase 9: ATC-147-Evidence — ATC Review

**Tier:** LITE
**Reviewed:** 2026-04-22
**Anti-Slop Pass Rate:** 10 / 10
**Status:** WARN — no blockers; 2 warnings logged for Phase 10 consumer awareness

---

## Anti-Slop 10-Point Scorecard (verify.mjs)

| # | Point | Result | Notes |
|---|-------|--------|-------|
| 1 | Every new function/class has a caller | PASS | `fail()` called in 8 distinct paths; no orphan code |
| 2 | Every import is used | PASS | `fs`, `path`, `createRequire`, `require(yaml)` all consumed |
| 3 | Every parameter is read | PASS | `fail(n, msg)` uses both; sort comparator `(a, bv)` uses both |
| 4 | Could this be less code? | PASS | 63 lines for 7 invariants; no reducible surface |
| 5 | New abstractions justified? | PASS | Only `fail()` extracted; inline for the rest |
| 6 | Does existing code do 80% of this? | PASS | No prior verifier for this artifact set; genuinely new |
| 7 | Would a senior engineer mass-delete this? | PASS | Load-bearing mechanical gate; earns its existence |
| 8 | ΔComplexity ≤ 0? | PASS | New file, greenfield; no brownfield complexity added |
| 9 | Any "just in case" additions? | PASS | No speculative branches; every invariant maps to a concrete artifact requirement |
| 10 | Does this commit do ONE thing? | PASS | Verifier only; committed in isolation (720792f) |

---

## Cross-Artifact Coherence

All four artifacts tell a consistent story:

- `headline_finding_count: 4` = `real_bloat(2) + integration_gap(2)` — matches in classification YAML, INTENT.md body, and 147-review.md summary line.
- Bucket sum `2+2+4+2+0 = 10` = `findings_detail.length` — consistent.
- SHA pin `ca5be16b..c41634c4` appears verbatim in classification.yaml `external_repo_pin`, gate-bypass.yaml `source_review`, INTENT.md `entry_criteria`, and 147-review.md frontmatter. Four-way consistency verified.
- Gate-bypass `audit.length = 9`, per-phase steps `[6, 7]`, step-6 `fired_retroactively: true` — all match verify.mjs invariants 4, 5, 6.

No contradictions in stated values.

---

## Warnings

### WR-01: `dispatches_denominator` is declared but never validated by the verifier

**File:** `.planning/phases/09-atc-147-evidence/09-gate-bypass.yaml` — `dispatches_denominator: 16` (line 7), each audit row's `dispatches_bypassed: 16` (lines 15, 21, 27, 33, 40, 61, 79, 85)

**Issue:** The verifier hardcodes the expected audit array length (9) and per-phase step numbers ([6, 7]) but does not assert that `total_bypass_cost === per_dispatch_tokens × dispatches_bypassed` for any row, and does not cross-check `dispatches_bypassed` against `dispatches_denominator`. A future edit that changes the denominator (e.g., a different phase with 8 T-commits) could produce inconsistent arithmetic that passes all 7 invariants undetected.

**Fix:** Add an invariant to verify.mjs that checks row-level arithmetic:
```js
// Invariant 4b: per-dispatch rows total_bypass_cost === per_dispatch_tokens × dispatches_bypassed
for (const row of gbp.audit.filter(r => r.class === 'per-dispatch')) {
  const expected = row.per_dispatch_tokens * row.dispatches_bypassed;
  if (row.total_bypass_cost !== expected)
    fail(4, `row "${row.gate}" total_bypass_cost ${row.total_bypass_cost} !== ${row.per_dispatch_tokens} × ${row.dispatches_bypassed}`);
}
```
Phase 10 should be aware this gap exists before treating the token totals as mechanically enforced.

---

### WR-02: `findings_detail[].bucket` uses hyphens; `findings_by_bucket` uses underscores — verifier does not cross-validate

**File:** `.planning/phases/09-atc-147-evidence/09-classification.yaml` — `findings_detail` rows (lines 17–55) use strings `"integration-gap"`, `"real-bloat"`, `"false-positive"`; `findings_by_bucket` keys (lines 9–14) use `integration_gap`, `real_bloat`, `false_positive`.

**Issue:** The verifier checks `findings_detail.length === 10` (invariant 1) and `bucket map sum === 10` (invariant 2) independently, but never verifies that individual `findings_detail[].bucket` values correctly map to the bucket totals. Someone could re-classify a detail row (e.g., move W3 from `real-bloat` to `nit`) without triggering any invariant failure, silently corrupting Phase 10's per-bucket drill-down while leaving the headline count intact.

**Fix:** Add a cross-validation invariant:
```js
// Invariant 1b: detail bucket strings must map consistently to findings_by_bucket keys
const bucketMap = { 'real-bloat': 'real_bloat', 'integration-gap': 'integration_gap',
                    'nit': 'nit', 'false-positive': 'false_positive', 'info': 'info' };
const counted = {};
for (const row of cls.findings_detail) {
  const key = bucketMap[row.bucket];
  if (!key) fail(1, `unknown bucket string "${row.bucket}" in finding ${row.id}`);
  counted[key] = (counted[key] || 0) + 1;
}
for (const [k, v] of Object.entries(b)) {
  if ((counted[k] || 0) !== v)
    fail(2, `bucket "${k}" detail count ${counted[k] || 0} !== declared ${v}`);
}
```

---

## Info

### IN-01: Sort comparator parameter `bv` is an unclear name given `b` is the bucket object in the same scope

**File:** `.planning/phases/09-atc-147-evidence/verify.mjs:49`

**Issue:** `gbp.audit.filter(r => r.class === 'per-phase').map(r => r.step).sort((a, bv) => a - bv)` — `bv` avoids colliding with the module-level `b` (bucket map, line 35) but the naming is unexplained. Not a bug; purely a readability nit.

**Fix:** Rename to `bStep` or simply use the conventional `(a, b2)` to make intent obvious.

---

## Verdict

Phase 9 is coherent and mechanically sound. The primary executable (verify.mjs) passes all 10 anti-slop points and its 7 invariants are load-bearing and mutation-resistant. All four cross-artifact SHA pins are consistent. The two warnings are gaps in the verifier's coverage, not errors in the artifact data itself — the actual token counts and bucket assignments are correct. Neither warning blocks Phase 10 from consuming the evidence; both should be noted as known verification gaps rather than data defects. The lower-bound note arithmetic error (flagged by the phase verifier as a deviation) was already corrected in commit c76bfe3 before this ATC review landed.

**Recommendation: mark phase complete.** No fix-up required before Phase 10 proceeds. The two warnings are logged here for the Phase 10 planner's awareness.

---

_Reviewed: 2026-04-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Tier: LITE_
