---
phase: 43
plan: 43-01
review_type: phase-level-ATC (Step 9, dual-provider)
date: 2026-04-27
verdict: PASS (after MEDIUM-fix + cleanup)
---

# Phase 43 Phase-Level ATC Review — Dual Provider

## Reviewers

| Provider | Status | Verdict | Findings |
|----------|--------|---------|----------|
| Claude (sgsd-code-reviewer) | OK | REVISE → PASS post-fix | 1 MEDIUM (warnings_added dead branch), 4 LOW (cosmetic + perf) |
| Codex (sgsd-codex-reviewer) | provider_unavailable | n/a | Phase 41/42 precedent: TIER_ANALYSIS=180s tier cap. Logged as provider_unavailable. |

## Claude review summary

```
REPORT_CONTRACT: code-reviewer-v1
ATC_TIER: FULL
STEP_1_FIRST_PRINCIPLES: JUSTIFIED — 18-field schema, every field has named downstream consumer
STEP_2_DELETE: 2 findings | ~1-2% reduction
STEP_3_SIMPLIFY: 1 finding | ΔComplexity ~neutral
STEP_4_ACCELERATE: 1 finding (serial git show on backfill, acceptable)
STEP_5_AUTOMATE: 0 findings
STEP_6_VALIDATE: 6/7 — pre-fix (status-consistency FRAGILE noted, fingerprint guard PARTIAL)
STEP_7_CHECKLIST: 9/10 → 10/10 post-fix
LOCK_6_VERBATIM_BYPASS: SOUND
LOCK_13_NEVER_THROWS: SOUND
A3_HASH_IDEMPOTENCY: SOUND
READ_ONLY_INVARIANT: PASS
PHASE_41_IMPORT_BY_REFERENCE: SOUND (ROLES + ledgerPath only)
NO_PREMATURE_DOWNSTREAM_IMPORT: YES
DUAL_FOLDER_SHAPE_HANDLED: YES
ATOMIC_JSON_WRITE: YES
MIRROR_FIDELITY: PASS
```

## Findings + Resolution

### MEDIUM (resolved)

- **write.cjs:360-365** — `_gatherDebt` warnings_added counter had dead branch `Math.max(wHeads === 0 ? 0 : 0, wAnchors)` which always treats wHeads as 0 regardless of actual count. Phases using `### WARN` section-header dialect (v1.6 + earlier) silently reported warnings_added=0.
  - **Fix**: commit `8d902d6` — simplified to `Math.max(wAnchors, wHeads)` with broadened wHeads regex (case-insensitive, matches `### WARN N:`, `### WARN-N`, `### WARN N` dialects). 15 capsules rewritten with corrected counts (mostly v1.6 phases). Re-runs converge: 15 → 8 (settling) → 0 (idempotent fixed point).

### LOW (accepted)

- **write.cjs:1271-1287** — Serial `git show --stat` per commit; O(n) child processes. Acceptable at milestone-close frequency.
- **write.cjs:1060-1067** — Double-parse in _appendOrReplaceIndexRow sort path. Cosmetic.
- **write.cjs:1290-1294** — Empty-body if block dressed as conditional. Documentation.
- **Self-test 11** — Fingerprint guard uses mtime+size, not content hash. Edge-case theoretical (clock-skewed equal-size restore).

### CLEANUP (post-fix)

- **commit `dca3af1`** — 6 stray `*.tmp.NNNNN.HHHH` files (atomic-write fragments from interrupted backfill runs) accidentally swept into the warnings_added fix commit. Cleaned + 22 pre-existing v1.2-v1.5 capsules (already on disk from `--all` walk) properly committed as part of cleanup.

## Invariants

- **LOCK_6_VERBATIM_BYPASS**: SOUND — `_gatherBypassRefs` does field-rename only, never .replace/.trim/.slice/.substring/.toLowerCase/.normalize on row.summary. F4 self-test does Buffer.compare across 3 fixtures. 11-row spot-check on v1.6/P28 byte-equal source.
- **LOCK_13_NEVER_THROWS**: SOUND — All 5 public APIs (writeCapsule, writeAllCapsulesForMilestone, readCapsule, capsulePath, backfillFromCanonical) wrap internals in try/catch and return sentinel shapes; never propagate. Self-test 12 binds. F3 fixture asserts on missing-file path.
- **A3_HASH_IDEMPOTENCY**: SOUND — `_capsuleContentHash` strips `created_at` + `created_by`, applies recursive sortKeys, JSON.stringify + sha256. F2 fixture H1===H2 across delete-rebuild. Scale-rebuild proven: third backfill run written=0/skipped=44.
- **READ_ONLY_INVARIANT**: PASS — Production writes target only PHASE-CAPSULE.json (44 paths), PHASE-INDEX.jsonl (8 paths after v1.2-v1.5 capsules added), context-complaints.jsonl (only on writer failure). Source streams + canonical phase-folder content untouched.
- **PHASE_41_IMPORT_BY_REFERENCE**: SOUND — Lines 113-126 import only ROLES + ledgerPath from token-attribution/report.cjs with try/catch fallback. No local redefinition of STATUSES/PROVIDERS/BLOAT_THRESHOLDS.
- **NO_PREMATURE_DOWNSTREAM_IMPORT**: YES — No require() of Phase 45/46/49/51 modules.
- **DUAL_FOLDER_SHAPE_HANDLED**: YES — _resolveAtcReviewPath probes reviews/{NN}-REVIEW.md > {NN}-ATC-REVIEW.md > null. Self-test 10 covers all 3 cases.
- **ATOMIC_JSON_WRITE**: YES — tmp+rename pattern with pid+random hex suffix. Both _writeCapsuleInternal and _appendOrReplaceIndexRow.
- **MIRROR_FIDELITY**: PASS — Frozen consts (4), _normalize+_assertCapsuleSchema+_writeCapsuleInternal trio, never-throws-upward, __dirname-anchored 3-up fingerprint guard, 13-assertion self-test, ASCII-only via _jsonStringifyAscii unicode-escape helper.

## Backfill scope (broader than planned)

Plan called for 17 named capsules; executor's `--all` flag walked all milestone trees and produced **44 capsules** total: v1.2 (5), v1.3 (3), v1.4 (4), v1.5 (5), v1.6 (5), v1.7 (5), v1.8 (5), v1.9 (12). Bonus coverage; PHASE-INDEX.jsonl produced for 8 milestones.

## Final Verdict

**PASS** (post-fix + cleanup). Phase 43 deliverables hold all critical invariants. Claude MEDIUM addressed; Codex provider_unavailable per established Phase 41/42 precedent. Commit chain: `26edd59` → `e409cc2` → `924177a` → `adcfaab` (verification) → `8d902d6` (fix) → `dca3af1` (cleanup). Cross-phase contracts ready: Phase 45 PACKET-03 reads capsule fields; Phase 46 INDEX-02 builds SQLite from PHASE-INDEX.jsonl; Phase 51 BENCH-04/05 uses capsule debt + bypass_refs.
