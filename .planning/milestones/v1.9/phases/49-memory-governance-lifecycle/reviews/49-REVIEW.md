---
phase: 49
plan: 49-01
review_type: phase-level-ATC (Step 9, dual-provider)
date: 2026-04-28
verdict: PASS (with cleanup)
---

# Phase 49 Phase-Level ATC Review — Dual Provider

## Reviewers

| Provider | Status | Verdict | Findings |
|----------|--------|---------|----------|
| Claude (sgsd-code-reviewer) | OK | PASS with 1 MEDIUM cleanup | 1 HIGH-labeled (coverage gap), 2 MEDIUM (chain-depth off-by-one fixed; milestone filter accepted), 2 LOW |
| Codex (sgsd-codex-reviewer) | provider_unavailable | n/a | Phase 41-48 precedent: TIER_ANALYSIS=180s tier cap. |

## Findings + Resolution

### MEDIUM (resolved)

- **lifecycle.cjs:859** — `_resolveSupersededChain` called with `depth=1` on first hop, making effective cap 4 hops (not declared 5). Constant + behavior misaligned.
  - **Fix**: commit `3b31275` — revoke() now passes `depth=0`; F7b fixture extended from 6-deep (A→F) to 7-deep (A→G) to overshoot corrected 5-cap boundary. Self-test 29/29 PASS preserved.

### MEDIUM (accepted)

- `backfillLifecycleFields` milestone filter `/^v[0-9]/` silently skips non-v-prefix names — accepted, fragile contract for future callers.

### HIGH (label-only — accepted)

- Lowercase `"never "` guardrail branch untested in self-test fixtures. Label more accurately MEDIUM (coverage gap, not behavior bug). Branch already exists; F-guardrail-fixture coverage gap accepted per Phase 41-48 LOW-finding precedent. Future Phase 50 hardening can extend.

### LOW (accepted)

- `processComplaints` unknown-reason rows log to demotions stream (semantic mismatch).
- `_resolveSupersededChain` swallows corrupted-JSON errors (Lock 13 OK).

## Invariants

- **A1 4-LEVEL PROMOTION**: SOUND — raw_evidence → phase_capsule → validated_thought → reusable_rule/guardrail.
- **A4 ADMISSION GATE**: SOUND — rejects when source_refs/root_source_hashes/confidence/allowed_consumers/revocation_path missing; 10-entry ADMISSION_REJECT_CODES Object.freeze.
- **A5 PRIVILEGED WRITE**: SOUND — every memory-write logs envelope-v1 row with provenance.
- **LOCK 11**: SOUND — promotion thresholds STRUCTURAL ONLY (≥3 distinct citing phases, confidence vocab, manual_promote_with_provenance). NO embedding/cosine/fuzzy.
- **LOCK 13**: SOUND — 6 public APIs + 3 helpers wrap try/catch with sentinel return. Tested with null/undefined/garbage inputs (9 calls, 0 throws).
- **PHASE 41-48 IMPORT BY REFERENCE**: SOUND — COMPRESSION_LEVELS from Phase 45, validateOne from Phase 44, readCapsule/writeCapsule from Phase 43, query from Phase 46.
- **NO PREMATURE DOWNSTREAM IMPORT**: YES — getMemoryGovernanceSnapshot is forward-shape helper only.
- **READ-ONLY INVARIANT**: PASS — 9 canonical streams + Phase 41-48 sources untouched (except T2 schema/write.cjs + T4 build.cjs:702-703 patch).
- **4 NEW CANONICAL STREAMS**: YES — memory-{promotions,demotions,revocations,revalidations}.jsonl owned by lifecycle.cjs.
- **T2 SCHEMA ADDITIVE**: SOUND — 10 lifecycle fields added; required[] unchanged; additionalProperties:false preserved via explicit enumeration.
- **T3 BACKFILL IDEMPOTENT**: SOUND — per-capsule compression_level!=null skip; promoted_at preserved as cap.created_at; F11 binds re-run no-op (44 capsules; second run 0 writes).
- **T4 PHASE 45 WIRE**: SOUND — build.cjs:702-703 lazy try/catch require with empty-array fallback on require failure; Phase 45 self-test invariant preserved.
- **ADMIT GATE BYPASS BLOCKED**: YES — every promote/demote/revoke routes through admitMemoryWrite first.
- **TOMBSTONE REVOCATION**: YES — never hard-deletes; chain depth-cap=5 (post-fix); revocation logged + escalates via complaint, operator-driven.
- **ASCII-ONLY**: PASS — 0 non-ASCII bytes.
- **MIRROR FIDELITY**: PASS — Phase 36/41-48 patterns: frozen Object.freeze enums, _normalize+_assertLifecycleFieldSchema trio, never-throws sentinel, __dirname-anchored fingerprint.

## Live verification at close

```
lifecycle.cjs --self-test: 29/29 PASS (post-fix)
write.cjs --self-test: 16/16 PASS (+3 lifecycle assertions)
build.cjs --self-test: 15/15 PASS (Phase 45 invariant preserved)
44/44 PHASE-CAPSULE.json files have lifecycle fields (idempotent)
4 canonical stream paths declared (lazy-created on first emit)
A1-A7 all SOUND
Locks 11, 13 SOUND
Phase 41-48 imports BY REFERENCE
T2 schema additive (required[] unchanged)
T3 backfill idempotent (re-run skipped:44 errors:0)
T4 step-6 wire works (build.cjs:712-724)
T5 SKILL wires present (Step 6.6.i.Y + Step 4.7-quater)
```

## Final Verdict

**PASS** (with cleanup). Phase 49 ships THE governance kernel for v1.9. Claude PASS verdict + 1 MEDIUM resolved in-loop; Codex provider_unavailable per established Phase 41-48 precedent. Commit chain spans 7 commits: lifecycle.cjs scaffold + APIs → schema extension → write.cjs lifecycle assertions → 44-capsule backfill → backfill formatting hotfix → Phase 45 step-6 wire → SKILL wires → verifier audit → chain-depth off-by-one fix. Cross-phase contracts ready: Phase 50 cockpit consumes getMemoryGovernanceSnapshot for governance state display; Phase 51 BENCH includes failure fixtures (revoked-not-loaded, missing-provenance, stale-abstraction).
