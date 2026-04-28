---
phase: 52
tier: FULL
gate: phase-level-ATC
provider: claude-sonnet
reviewed_at: 2026-04-28T21:15:00Z
verdict: pass
---

# Phase 52 ATC Review — Redis Live Memory Projection Adapter

## Phase Goal

Add Redis only as an optional live memory projection, never as SGSD canonical truth. All 8 public APIs degrade gracefully when Redis is absent, disabled, or misbehaving. Canonical truth remains exclusively in SQLite/.planning/; Redis is a derived projection.

## Diff Stats

6 files, 3231 lines added, 30 removed across 9 commits (10555db^..HEAD).
- super-gsd/tools/context-cache/redis-adapter.cjs (2911 new)
- super-gsd/tools/context-cache/run-redis-self-test.cjs (108 new)
- super-gsd/tools/context-cache/docker-compose.redis.yml (58 new)
- super-gsd/tools/context-bench/failure-injectors.cjs (+82/-30 surgical F17)
- super-gsd/scripts/sgsd-complete-milestone.cjs (+99 dual-gate)
- package.json (+3 redis@^5.12.1 optionalDependency)

## 7-Step ATC

| Step | Result | Notes |
|------|--------|-------|
| 1 First Principles | PASS | Redis-as-projection real need; optional dep pattern justified; degraded-OK eliminates runtime hard dep |
| 2 Delete | PASS | No dead bodies beyond intentionally-deferred _getClient live-connect path; inline tests; thin shell 108L |
| 3 Simplify | PASS | ΔComplexity neutral-to-positive; _revalidateAndMaybeDelete DRY; flat helper chain |
| 4 Accelerate | PASS | 50ms Promise.race on all Redis ops; XADD MAXLEN ~ for O(1) trim; SCAN iterator (not blocking KEYS) |
| 5 Automate | PASS | Self-test inline (26 assertions); dual-gate milestone-close wired; projection-log for all degraded paths |
| 6 Validate | PASS | 13/13 must-haves; 9/9 commit verdicts; 7/7 REDIS-LOCKs; 26/26 assertions; F17 Q3/Q4 satisfied |
| 7 Checklist | PASS 9/10 | 1 LOW orphaned enum entry; no orphaned functions |

## 10-Point Anti-Slop

| # | Check | Result |
|---|-------|--------|
| 1 | New functions have callers | PASS |
| 2 | Imports used | PASS |
| 3 | Parameters read | PASS |
| 4 | Could this be less code? | PASS — 2911L for 8 APIs + 26 assertions + 7 locks; no padding |
| 5 | New abstractions justified? | PASS |
| 6 | Existing code does 80%? | PASS — Phase 46 patterns extended (try/require, _sha256OfFile, envelope-v1) |
| 7 | Senior engineer mass-delete? | PASS — _testHook is plan-required for F17 cross-binding |
| 8 | ΔComplexity ≤ 0? | PASS — isolated to redis-adapter.cjs |
| 9 | "Just in case" additions? | WARN — INJECT_REASON_CODES retains orphaned entry (L2) |
| 10 | One thing per commit? | PASS — T1-T7 incremental |

## Severity-Bucketed Findings

### CRITICAL (0) — None.
### HIGH (0) — None.
### MEDIUM (0) — None.

### LOW (4 — all deferred to milestone close)

**L1 — Dead live-Redis paths (by design)**
All 8 public APIs degrade correctly when `_getClient()` returns null. `_client` never assigned non-null in this file because T2 createClient wiring is deferred per plan. Live SCAN body in invalidateBySourceHash unreachable until T2. Documented; no lock violation.

**L2 — Orphaned INJECT_REASON_CODES entry**
failure-injectors.cjs line 293 retains `bench_fixture_skipped:phase_52_redis_adapter_not_shipped`. T6-fixup correctly removed the emitting guard; the enum entry remains dead vocabulary. Closed-enum so no behavioral impact.

**L3 — docker-compose.redis.yml comment count drift**
Line 25 says "24 assertions"; actual is 26. Non-functional doc drift.

**L4 — Unused require() in sgsd-complete-milestone.cjs**
Lines 161-176 require redis-adapter.cjs + validate selfTest export, but result `redisAdapter` never used (gate runs via spawnSync). The require pattern was carried from Phase 51 harness pattern. Dead require.

## REDIS-LOCK Invariant Matrix

| Lock | Invariant | Status | Evidence |
|------|-----------|--------|---------|
| LOCK-01 | Projection only; ALLOWED_KINDS(9) + FORBIDDEN_KINDS(8) | PASS | Object.freeze(new Set()); _checkKindGate on every put; schema validation denylist-first; A1/A2 |
| LOCK-02 | Source-hash invalidation on every read | PASS | _revalidateAndMaybeDelete Defense 3; _sourceHashesStillMatch sorted byte-equality; del() on drift; C1 |
| LOCK-03 | Intent-scoped semantic cache; byte-equality only | PASS | _composeSemanticKey sha256 of 5-component join; NO embedding/cosine; D1/D2 sort-invariance + role-distinct |
| LOCK-04 | TTL discipline; streams use XADD MAXLEN | PASS | TTL_BY_KIND(9 frozen); every SET uses EX; xAdd uses TRIM MAXLEN ~1000; F1 |
| LOCK-05 | Safe FLUSHDB; loses no canonical truth | PASS | _testHook_simulateFlushAndPoison Step 3-4 proves post-flush=miss; canonical files untouched; docker-compose ephemeral |
| LOCK-06 | Degraded-OK; sentinel not throw | PASS | _disabledReason() + _getClient() null path; all 8 APIs outer try/catch; D4/G4 |
| LOCK-07 | Poisoned-key defense | PASS | _revalidateAndMaybeDelete 3 defenses; del()+log on each rejection; E1/B2/C1 |

## Lock 4 / Lock 11 / Lock 13

- **Lock 4**: Phase 41-50 trees + sgsd-cockpit-shell.cjs + Phase 51 non-F17 files all byte-untouched (verifier confirmed). +82/-30 in failure-injectors.cjs is exclusively F17 surgical activation.
- **Lock 11**: byte-equality only across all 8 APIs. _composeSemanticKey sha256(joined). _sourceHashesStillMatch sorted .every(). NO similarity_score/cosine/levenshtein/fuzzy/embedding anywhere in diff (grep verified).
- **Lock 13**: every public API outer try/catch + degraded sentinel; never throws upward. _emitProjectionLog has outer + inner try/catch. A4/D4 mechanically verify.

## Pitfall 1-6

| # | Description | Status |
|---|-------------|--------|
| P1 | Credential redaction | PASS — _redactRedisUrl applied; G2 :secret@→:***@; verifier 0 unredacted creds |
| P2 | Deterministic JSON normalization | PASS — _composeSemanticKey JSON.stringify(policy); source_hashes sorted; D1/D2 |
| P3 | TTL discipline | PASS — TTL_BY_KIND 9-entry frozen; every put EX; stream MAXLEN ~1000 |
| P4 | 50ms connection pool timeout | PASS — REDIS_COMMAND_TIMEOUT_MS=50 Promise.race on all client ops |
| P5 | Writes only to canonical projection log | PASS — _emitProjectionLog writes ONLY redis-projection-log.jsonl |
| P6 | F17 lazy require | PASS — require inside inject() body (line 904), NOT top-level; H1 |

## Goal Achievement

The phase achieves the stated goal without ambiguity. Redis is never a write destination for any canonical kind. FORBIDDEN_KINDS denylist mechanically blocks decision/debt/evidence/phase_capsule/memory_lifecycle/benchmark_result/route_decision/validated_thought at the write gate before any client interaction. The validated_thought vs validated_thought_projection distinction is correct and cross-checked in A2. No leak path found.

The degraded-OK contract (REDIS-LOCK-06) is the strongest feature: all 8 public APIs return documented sentinel objects under every failure condition (module missing, URL absent, env-disabled, connect failed, op timeout, internal error) and none throw. Self-test proves this mechanically without a running Redis server.

F17 cross-binding correctly implements soft-skip semantics; T6-fixup removed the stub-era guard that made the live path unreachable via injectFailure(). Dual-gate milestone-close in sgsd-complete-milestone.cjs correctly sequences context-bench first, redis-adapter second, uses spawnSync for the async adapter. Lock 13 maintained: every failure path emits stderr tag + exits 1.

## Verdict: PASS

Phase 52 achieves projection-only invariant with 0 critical/high/medium findings; all 7 REDIS-LOCKs, Lock 4/11/13, and Pitfalls 1-6 verified; 4 LOW non-blocking findings deferred to milestone close (orphaned enum, dead require, doc count, intentional dead branch).

**One-liner:** Phase 52 holds projection-only invariant across all 7 REDIS-LOCKs and Lock 4/11/13 with 0 critical findings and 4 LOW deferred observations.
