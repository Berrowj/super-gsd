---
phase: 45
plan: 45-01
review_type: phase-level-ATC (Step 9, dual-provider)
date: 2026-04-27
verdict: PASS (after HIGH+MEDIUM-fix)
---

# Phase 45 Phase-Level ATC Review — Dual Provider

## Reviewers

| Provider | Status | Verdict | Findings |
|----------|--------|---------|----------|
| Claude (sgsd-code-reviewer) | OK | REVISE → PASS post-fix | 1 HIGH (VTP step-7 silent stub trap), 2 MEDIUM (step-2 undocumented + _buildContextSourceMix dead fallback), 3 LOW (cosmetic) |
| Codex (sgsd-codex-reviewer) | provider_unavailable | n/a | Phase 41-44 precedent: TIER_ANALYSIS=180s tier cap. Logged as provider_unavailable. |

## Claude review summary

```
REPORT_CONTRACT: code-reviewer-v1
ATC_TIER: FULL
STEP_1_FIRST_PRINCIPLES: SOUND
STEP_2_DELETE: 2 findings | ~1% reducible
STEP_3_SIMPLIFY: 1 finding | ΔComplexity = +0
STEP_4_ACCELERATE: 0 findings
STEP_5_AUTOMATE: 0 findings
STEP_6_VALIDATE: 7/7 PASS
STEP_7_CHECKLIST: 9/10
LOCK_6_VERBATIM_BYPASS: SOUND
LOCK_11_NO_SEMANTIC_ONLY: SOUND
LOCK_12_PROMPT_INJECTION_AS_DATA: SOUND
LOCK_13_NEVER_THROWS: SOUND
A9_VALIDATED_THOUGHTS_PROVENANCE: SOUND
A10_CONTEXT_SOURCE_MIX_7_KEY: SOUND
A12_BROAD_RAW_COMPLAINT: SOUND
A13_PROMPT_INJECTION_AS_DATA: SOUND
EIGHT_STEP_BUILD_ORDER: PRESENT (post-fix)
COMPRESSION_LEVELS_FROZEN_5: YES
PHASE_41_42_43_44_IMPORT_BY_REFERENCE: SOUND
NO_PREMATURE_DOWNSTREAM_IMPORT: YES
NO_REDIS_COUPLING: YES
READ_ONLY_INVARIANT: PASS
VTP_DELTA_FORWARD_ONLY: SOUND
DEPTHCAP_2_BLOAT_FIX: PASS
ASCII_ONLY: PASS post-fix (em-dash regression caught + fixed in same commit)
MIRROR_FIDELITY: PASS post-fix
```

## Findings + Resolution

### HIGH (resolved)

- **context-packet/build.cjs:697** — VTP step-7 ternary `(opts.route_hint?.use_vtp) ? [] : []` was a silent stub trap; both arms returned `[]` regardless of `route_hint.use_vtp`. When Phase 47/48 wires VTP, the conditional would silently continue returning empty because it was non-load-bearing.
  - **Fix**: commit `f49dc32` — replaced with `const vtpPackets = []` plus a 3-line comment documenting the deferred Phase 47/48 wire-in pattern.

### MEDIUM (resolved)

- **context-packet/build.cjs:677-680** — `_buildPacketInternal` jumped from step 1 to step 3 with no documentation for step 2. Spec deviation risk.
  - **Fix**: commit `f49dc32` — added inline comment block documenting that step 2 (current phase/plan context) is structurally absorbed via `intent_map.{phase, milestone}` which keys all downstream source-fetch operations. The 8-step contract reads continuous without a separate step-2 fetch.

### MEDIUM (accepted)

- **context-packet/build.cjs:255-260** — `_buildContextSourceMix` reads `source_mix.raw_evidence` with two-branch fallback that also checks `raw_file_fallback_count`. Both keys are set on the same draft object; the fallback branch never fires. Cosmetic noise; accepted as-is per Phase 41-44 LOW-finding precedent.

### LOW (accepted)

- **intent-map/build.cjs:357-374** — `_deriveIntent` and `_deriveMeaning` are identity pass-throughs. Documented as Wave 4 NLP enrichment placeholders.
- **context-packet/build.test.cjs S12 line ~1147** — `walkClamped.length >= 3 && <= 6` upper bound is loose; mathematically harmless.
- **context-packet/build.cjs:136** — `INTENT_MAP_REASON_CODES` local fallback Object.freeze fires only when `_intentMap` module load fails. Never in production. Soft contract drift.

## Em-dash regression (caught + fixed in same commit)

The HIGH-fix comment introduced a U+2014 em-dash (UTF-8: 0xE2 0x80 0x94) at byte 29226. Self-test ASCII-only assertion correctly caught this: 13/14 PASS (1 fail on `ASCII_only_all_7_files`). Replaced with ASCII hyphen; 14/14 PASS post-fix; 0 non-ASCII bytes.

This is the same encoding-bug class that Phase 43 caught (`_jsonStringifyAscii` helper for unicode escape) and Phase 41 fixed via BLOAT_THRESHOLDS trim. Pattern is now well-detected by the existing self-test.

## Invariants

- **LOCK_6_VERBATIM_BYPASS**: SOUND — Object.assign shallow spread; F3 Buffer.compare===0; bypass_refs IMMUNE to elision.
- **LOCK_11_NO_SEMANTIC_ONLY**: SOUND — REASON_VOCAB frozen 13-entry; `'semantic_similarity_only'` BANNED; semantic candidates demoted to `ambiguities[]`.
- **LOCK_12_PROMPT_INJECTION_AS_DATA**: SOUND — `_filterOperatorIntentField` 3-rule defense; F4 + F11 cross-binding.
- **LOCK_13_NEVER_THROWS**: SOUND — All 6 public APIs wrap try/catch returning falsey sentinels; CLI exits 2 only on bad invocation.
- **VTP_DELTA_FORWARD_ONLY**: SOUND — Phase 41-44 imports unchanged; only EXTENDS via COMPRESSION_LEVELS, CONTEXT_SOURCE_MIX_KEYS, _assertValidatedThoughtProvenance.
- **DEPTHCAP_2_BLOAT_FIX**: PASS — BFS with cap clamped [1..4]; default=2; F5 asserts depth-2 walk finds 38/39/35 but NOT 34.
- **READ_ONLY_INVARIANT**: PASS — Production writes target only `.planning/cache/intent-map/*.json`, `.planning/metrics/intent-map.jsonl`, `.planning/metrics/context-packet-log.jsonl`, `.planning/metrics/context-complaints.jsonl` (additive append), 45-VERIFICATION.md.

## Live verification at close

```
intent-map self-test: 10/10 PASS
context-packet self-test: 14/14 PASS
6 role packets buildable: PASS
context_source_mix 7-key metadata: PASS
REASON_VOCAB 13-entry frozen, no semantic_similarity_only: PASS
COMPRESSION_LEVELS 5-entry frozen: PASS
Phase 41/42/43/44 imports BY REFERENCE: PASS (zero local redefinition)
SKILL.md wire-ins: Step 7.5 + Step 4.7-ter PRESENT
```

## Final Verdict

**PASS** (post-fix). Phase 45 — the central v1.9 deliverable — ships clean. Claude HIGH + MEDIUM addressed in-loop; Codex provider_unavailable per established Phase 41-44 precedent. Commit chain: `b38a975` (schemas+stubs) → `78b82dc` (intent-map compiler) → `d1d0f1c` (context-packet builder) → `ba6112b` (SKILL wire-ins) → `56b80a7` (ledger seed) → `200cacf` (verifier audit) → `f49dc32` (VTP step-7 + step-2 + em-dash fix). Cross-phase contracts ready: Phase 46 SQLite index will plug into step 6; Phase 47 routing will populate `route_hint.use_vtp` for step 7; Phase 49 governance will manage validated_thoughts lifecycle (promote/demote/revoke); Phase 51 stress benchmark will measure utility_per_token + evidence_retention.
