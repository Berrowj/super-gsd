---
phase: 12-machinery
plan: "01"
plan_name: Classifier Cache (MACH-01)
completed: 2026-04-22
tasks_total: 4
tasks_completed: 4
---

# Plan 12-01: Classifier Cache (MACH-01) — Summary

## Artifacts

| Path | Type | LOC | Description |
|------|------|-----|-------------|
| `super-gsd/scripts/lib/classifier-cache.cjs` | created | 90 | Per-plan mtime-invalidated sidecar cache — exports `{readCache, writeCache, clearCache, sidecarFor}` (zero deps beyond fs+path) |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` | modified | +28/-15 | Step 2 v1-path wrapped with classifier-cache read/write; cache-hit writes `classifier-skip` token-log row (D-04); v2 synthesis path untouched |
| `.planning/phases/12-machinery/verify.mjs` | created | 74 | Phase 12 verifier scaffold (ESM, createRequire, fail(N,msg)); invariants 1-2 authored; invariants 3-14 to be appended by plans 12-02..12-06 |

## Wave 0 Soft-Invariant (D-04)

**Invariant:** `.planning/metrics/token-log.jsonl` contains ≥1 row with `"role": "classifier-skip"`.

**Current count:**

```
grep -c '"role": "classifier-skip"' .planning/metrics/token-log.jsonl || echo 0
→ 0
```

**Status: EXPECTED-RED** — per 12-RESEARCH.md §Q9 invariant #14 and plan 12-01 task 12-01-04 input contract. No v1 plan has yet executed post-integration. The counter will become non-zero when the orchestrator runs its next v1 plan with ≥2 tasks after this plan ships. Baseline recorded here for future Phase 13 milestone-close audit (proof that MACH-01 actually fired in production).

## Commit SHAs

| Task | Description | Commit |
|------|-------------|--------|
| 12-01-01 | `classifier-cache.cjs` module (MACH-01 pure-fs cache) | `6e3dca5` |
| 12-01-02 | `verify.mjs` scaffold + invariants 1-2 | `ff3a2e6` |
| 12-01-03 | SKILL.md Step 2 v1-path integration | `d74ecb6` |
| 12-01-04 | This SUMMARY + D-04 soft-invariant capture | (this commit) |

## Verification Gates (all green)

- classifier-cache smoke test (exports + roundtrip + malformed + stale + idempotent-clear) → PASS
- `verify.mjs` Invariant 1 (exports typeof) → PASS
- `verify.mjs` Invariant 2 (writeCache schema round-trip) → PASS
- `grep "classifier-cache" SKILL.md` → exit 0
- `grep "classifier-skip" SKILL.md` → exit 0
- `grep "readCache" SKILL.md` → exit 0
- D-04 soft-invariant count: 0 (EXPECTED-RED — see above)

## Next

Plan **12-02** (Wave 2): `dispatch-planner.cjs` — parallel/sequential dispatch auto-detection from v2 `depends_on` + `files_touched` schema fields (MACH-02). Appends invariants 3-5 to `verify.mjs`.
