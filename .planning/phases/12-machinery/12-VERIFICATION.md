---
phase: 12-machinery
verified: 2026-04-22T00:00:00Z
status: passed
score: 9/9
overrides_applied: 1
overrides:
  - must_have: "MACH-01 classifier-skip fires in token-log.jsonl (D-04 soft-invariant)"
    reason: "D-04 is explicitly a SOFT-WARN invariant in verify.mjs — counter is EXPECTED-RED until a v1 plan executes post-integration. No live orchestrator run has occurred post-Phase 12 ship. Integration path is wired in SKILL.md Step 2. The zero-count is expected and documented in 12-01-SUMMARY.md."
    accepted_by: "gsd-verifier"
    accepted_at: "2026-04-22T00:00:00Z"
re_verification: null
---

# Phase 12: Machinery — Verification Report

**Phase Goal:** Apply four orchestrator-internal sharpenings (Q6a-d) that compound on top of the v2 schema and gate matrix — classifier-skip, parallel/sequential dispatch, checkpoint-schema expansion, and adversarial verifier sampling — to reduce per-phase overhead and catch verifier blind spots. Plus ergonomics fold-ins ERG-01 (Phase 10 WR-01/02/03) and ERG-02 (KNOWN_TOP_LEVEL installer).

**Verified:** 2026-04-22

**Status:** PASSED

**Re-verification:** No — initial verification

---

## Summary

All 13 hard invariants in `verify.mjs` exit 0. Invariant 14 (D-04 classifier-skip counter) is a declared SOFT-WARN, EXPECTED-RED until a v1 plan runs post-integration — this is not a gap. The full three-suite run (`09/verify.mjs && 10/verify.mjs && 12/verify.mjs`) exits 0. The installer dry-run exits 0, showing the PREVIEW patch. All six SUMMARY files are present with valid commit SHAs.

---

## Verification Focus Answers

**1. classifier-cache fires on cache hit?**
`classifier-cache.cjs` exists at `super-gsd/scripts/lib/classifier-cache.cjs`, exports `{readCache, writeCache, clearCache, sidecarFor}` (verified by Invariant 1). Invariant 2 confirms the write→read round-trip produces a sidecar with correct schema (`classified_at`, `plan_schema_version`, `verdict` with all 5 sub-fields). mtime-stale invalidation is implemented at line 52 (`planStat.mtimeMs > sideStat.mtimeMs → null`). SKILL.md Step 2 v1-path wraps the Haiku classifier with `readCache` before dispatching and `writeCache` after, logging `classifier-skip` on cache-hit. D-04 soft-invariant (token-log counter) is EXPECTED-RED until a live orchestrator run post-integration; override accepted per research plan contract.

**2. dispatch-planner builds correct DAG?**
`dispatch-planner.cjs` exists and `buildDispatchPlan` is verified by Invariants 3-5. Invariant 4 feeds a 3-task v2 fixture (task `b` depends on `a`) and asserts ascending wave numbers, no duplicate taskIds, and that `a` appears in an earlier wave than `b`. Invariant 5 confirms v1 plan (`schema_version: 1`) returns a single serial wave with all taskIds in original order, and an empty v2 task list returns a single empty wave. Cycle detection (Kahn stall → cycle-flagged serial wave) is implemented at lines 110-112. SKILL.md Rule 6.e integrates `buildDispatchPlan` with a wave-loop that dispatches serial waves sequentially and parallel waves as concurrent Agent() calls.

**3. Checkpoint template has 3 new fields + SKILL.md 85% instruction?**
`super-gsd/templates/checkpoint.md` contains `approaches_tried_and_abandoned: []`, `rules_learned_this_session: []`, and `dispatches_summary: {total, by_agent, by_outcome}` — confirmed by Invariant 6. It also contains `emergency_halt: false`. SKILL.md contains the 85% hard-cap instruction at line 1091 and the Emergency halt path section at lines 1154-1161, including `CHECKPOINT_EMERGENCY` as the DEVIATIONS log key — confirmed by Invariant 7.

**4. verifier_adversarial_rate in config with valid range?**
`config.json` contains `"atc": { ..., "verifier_adversarial_rate": 0.2 }` — the value is 0.2, within [0,1]. Invariant 8 asserts this programmatically. SKILL.md Step 9.6 contains the contrarian header marker `ADVERSARIAL CHALLENGER PASS` at line 872 — confirmed by Invariant 8. The dual-gate `config.atc.enabled && Math.random() < config.atc.verifier_adversarial_rate` is documented in both the verifier contract check file and SKILL.md.

**5. WR-01/02/03 closed?**
WR-01: `edge-guard.cjs` line 85 uses `err.message.startsWith("gate '")` — narrows the catch to gate-not-found errors only, rethrowing all other registry errors (Invariant 9 confirms). WR-02: `gates-registry.cjs` lines 27-29 contain the `WARNING — module-level cache is a PROCESS SINGLETON` JSDoc above `_cache`, confirmed by Invariant 10. WR-03: SKILL.md contains the anchored regex `skills\\/[^/]+\\/SKILL` for the `code_files_changed_count` predicate, confirmed by Invariant 11.

**6. Installer script works?**
`bash super-gsd/scripts/patch-gsd-tools-known-keys.sh --dry-run` exits 0, displays a PREVIEW of the patch adding all 7 SGSD v2 keys after the anchor line. The script correctly detects the anchor in the cross-repo gsd-tools `core.cjs` at `~/.claude/get-shit-done/bin/lib/core.cjs`. Idempotency is verified by Invariant 13 (patcher logic on fixture: first run returns `PATCHED`, second run returns `ALREADY_PATCHED`). Bash syntax check (`bash -n`) passes (Invariant 12).

**7. A2 vocab mapping documented?**
`12-04-01-verifier-contract-check.md` documents the full vocabulary mismatch: gsd-verifier emits `passed | gaps_found | human_needed`, not `PASS | PASS-WITH-DEVIATIONS | PASS-WITH-GAPS | FAIL`. The mapping table in that file maps each D-13b assumed value to the actual gsd-verifier vocab, explaining the SKILL.md Step 9.6 prose choices. No edit was made to gsd-verifier — the resolution is a semantic mapping, which is appropriate.

**8. Full-suite verifier green?**
`node .planning/phases/09-atc-147-evidence/verify.mjs` → `PASS: all 9 invariants hold`. `node .planning/phases/10-gate-policy/verify.mjs` → `PASS: all 8 invariants hold`. `node .planning/phases/12-machinery/verify.mjs` → `PASS: invariants 1-13 hard green + invariant 14 soft-warn`. Full suite exits 0 across all three phases.

**9. Requirement trace — all MACH-01..04 + ERG-01 WR-01/02/03 + ERG-02 delivered?**
See table below.

---

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | MACH-01: classifier-skip policy with sidecar cache and v1 fallback | VERIFIED | `classifier-cache.cjs` exports all 4 functions; SKILL.md Step 2 v1-path wired; Invariants 1-2 green |
| 2 | MACH-02: dispatch-planner builds DAG, respects depends_on + files_touched, v1 serial fallback | VERIFIED | `dispatch-planner.cjs` Kahn topo-sort; Invariants 3-5 green; SKILL.md Rule 6.e wave-loop wired |
| 3 | MACH-03: checkpoint schema has 3 new fields + emergency_halt + 85% trigger | VERIFIED | `checkpoint.md` has all 4 fields; SKILL.md 85% instruction + CHECKPOINT_EMERGENCY marker; Invariants 6-7 green |
| 4 | MACH-04: adversarial verifier sampling at N=20%, tunable via config, contrarian prompt marker in SKILL.md | VERIFIED | `config.atc.verifier_adversarial_rate: 0.2`; SKILL.md `ADVERSARIAL CHALLENGER PASS` marker; Invariant 8 green |
| 5 | ERG-01 WR-01: edge-guard catch narrowed to gate-not-found prefix | VERIFIED | `err.message.startsWith("gate '")` at line 85; Invariant 9 green |
| 6 | ERG-01 WR-02: gates-registry PROCESS SINGLETON JSDoc present | VERIFIED | Lines 27-29 in gates-registry.cjs; Invariant 10 green |
| 7 | ERG-01 WR-03: SKILL.md code_files_changed_count regex covers SKILL.md files | VERIFIED | `skills\\/[^/]+\\/SKILL` regex in SKILL.md; Invariant 11 green |
| 8 | ERG-02: idempotent KNOWN_TOP_LEVEL installer exits 0 on dry-run and twice-run | VERIFIED | `--dry-run` exits 0 with PREVIEW; Invariant 13 confirms idempotency; bash -n clean |
| 9 | A2 vocab mismatch documented and semantic mapping applied in SKILL.md | VERIFIED | `12-04-01-verifier-contract-check.md` records mapping; no agent file edit needed |

**Score:** 9/9 truths verified (1 override applied for D-04 soft-invariant)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `super-gsd/scripts/lib/classifier-cache.cjs` | New — MACH-01 sidecar cache | VERIFIED | 90 LOC, 4 exports, zero deps |
| `super-gsd/scripts/lib/dispatch-planner.cjs` | New — MACH-02 DAG planner | VERIFIED | 131 LOC, Kahn topo-sort, cycle detection |
| `super-gsd/scripts/lib/context-gauge.cjs` | New — MACH-03 mechanical gauge (opt-in) | VERIFIED | 52 LOC, `isEmergency` defaults to 0.85 |
| `super-gsd/scripts/lib/edge-guard.cjs` | Modified — WR-01 narrow catch | VERIFIED | Line 85 uses `err.message.startsWith("gate '")` |
| `super-gsd/scripts/lib/gates-registry.cjs` | Modified — WR-02 PROCESS SINGLETON JSDoc | VERIFIED | Lines 27-29 have JSDoc warning above `_cache` |
| `super-gsd/skills/sgsd-orchestrate/SKILL.md` | Modified — MACH-01/02/03/04 + WR-03 | VERIFIED | classifier-cache wrap, wave-loop, 85% halt, ADVERSARIAL CHALLENGER, skills regex |
| `super-gsd/templates/checkpoint.md` | Modified — 3 new fields + emergency_halt | VERIFIED | All 4 D-09/D-11 fields present |
| `super-gsd/scripts/patch-gsd-tools-known-keys.sh` | New — ERG-02 installer | VERIFIED | Idempotent, dry-run exits 0, bash -n clean |
| `.planning/config.json` | Modified — `atc.verifier_adversarial_rate` | VERIFIED | Value 0.2, in [0,1] |
| `.planning/phases/12-machinery/verify.mjs` | New — 13 hard + 1 soft invariants | VERIFIED | All 13 hard green, Invariant 14 EXPECTED-RED soft |
| `.planning/phases/12-machinery/plans/12-04-01-verifier-contract-check.md` | A2 deviation record | VERIFIED | Full vocab mismatch + mapping table |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| SKILL.md Step 2 | `classifier-cache.cjs` | `readCache` / `writeCache` calls | WIRED | Lines 190-199 in SKILL.md |
| SKILL.md Rule 6.e | `dispatch-planner.cjs` | `buildDispatchPlan` + wave-loop | WIRED | Lines 297-303 in SKILL.md |
| SKILL.md checkpoint_protocol | `context-gauge.cjs` (opt-in) | 85% threshold instruction in prose | WIRED | Lines 1091-1161 in SKILL.md |
| SKILL.md Step 9.6 | `config.atc.verifier_adversarial_rate` | dual-gate expression | WIRED | Line 858 in SKILL.md |
| `patch-gsd-tools-known-keys.sh` | `~/.claude/get-shit-done/bin/lib/core.cjs` | Node-in-bash anchor-line insert | WIRED | `--dry-run` confirms anchor found and PREVIEW correct |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| verify.mjs invariants 1-13 | `node .planning/phases/12-machinery/verify.mjs` | All 13 hard green, Invariant 14 EXPECTED-RED soft-warn | PASS |
| Phase 09 suite | `node .planning/phases/09-atc-147-evidence/verify.mjs` | PASS: all 9 invariants hold | PASS |
| Phase 10 suite | `node .planning/phases/10-gate-policy/verify.mjs` | PASS: all 8 invariants hold | PASS |
| ERG-02 installer dry-run | `bash super-gsd/scripts/patch-gsd-tools-known-keys.sh --dry-run` | Exit 0, PREVIEW shows correct patch | PASS |
| edge-guard.cjs WR-01 | grep `err.message.startsWith` | Found at line 85 | PASS |
| config.atc.verifier_adversarial_rate | JSON parse check | 0.2 in [0,1] | PASS |

---

## Requirements Coverage

| Requirement | Plan | Description | Status | Evidence |
|-------------|------|-------------|--------|----------|
| MACH-01 | 12-01 | Classifier-skip policy with sidecar cache, v1 fallback | SATISFIED | `classifier-cache.cjs`; SKILL.md Step 2 v1-path; Invariants 1-2 |
| MACH-02 | 12-02 | Parallel/sequential dispatch auto-detection from v2 depends_on + files_touched | SATISFIED | `dispatch-planner.cjs`; SKILL.md Rule 6.e; Invariants 3-5 |
| MACH-03 | 12-03 | Checkpoint schema expanded + trigger changed to boundary+70% + 85% emergency | SATISFIED | `checkpoint.md` 4 new fields; SKILL.md 85% path; Invariants 6-7 |
| MACH-04 | 12-04 | Adversarial verifier sampling N=20%, tunable, contrarian-challenger prompt | SATISFIED | `config.atc.verifier_adversarial_rate: 0.2`; SKILL.md Step 9.6; Invariant 8 |
| ERG-01 WR-01 | 12-05 | edge-guard.cjs narrow catch discriminator | SATISFIED | `err.message.startsWith("gate '")` line 85; Invariant 9 |
| ERG-01 WR-02 | 12-05 | gates-registry.cjs PROCESS SINGLETON JSDoc | SATISFIED | JSDoc lines 27-29; Invariant 10 |
| ERG-01 WR-03 | 12-05 | SKILL.md code_files_changed_count skills regex | SATISFIED | `skills\\/[^/]+\\/SKILL` regex; Invariant 11 |
| ERG-02 | 12-06 | Idempotent KNOWN_TOP_LEVEL installer ships in repo | SATISFIED | `patch-gsd-tools-known-keys.sh`; dry-run exit 0; Invariants 12-13 |

---

## Anti-Patterns Found

No blockers. One soft-warn (D-04 invariant 14 EXPECTED-RED) is by design — counter will only become non-zero once a v1 plan executes through the live orchestrator post-integration.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `classifier-cache.cjs` line 57 | 57 | `catch (_) { return null; }` — broad catch on JSON.parse | Info | Intentional: malformed sidecar treated as cache-miss (D-03 / V5 defensive contract). No data loss risk; worst-case is a classifier re-dispatch. |
| `edge-guard.cjs` self-test | 157 | `catch (_) { /* ok if not available */ }` | Info | Intentional defensive no-op in test scaffold context; resetCache() is best-effort in --self-test. |

---

## Human Verification Required

None. All checks are automated. The only manual-adjacent item is confirming MACH-04 fires at least once during Phase 12 milestone close (`grep -r "Adversarial Challenge" .planning/phases/*/`), but this is explicitly documented as optional post-milestone validation in 12-VALIDATION.md. It does not block the phase verdict.

---

## Deviations Logged

| # | Deviation | Disposition |
|---|-----------|-------------|
| A2 | gsd-verifier emits `passed | gaps_found | human_needed` — not `PASS | PASS-WITH-DEVIATIONS | PASS-WITH-GAPS | FAIL` as D-13b assumed | Resolved via semantic mapping in SKILL.md Step 9.6. Documented in `12-04-01-verifier-contract-check.md`. No agent file edit needed or appropriate. |
| D-04 soft | `classifier-skip` counter in token-log.jsonl is 0 | EXPECTED-RED — no live orchestrator run post-Phase 12 ship. Counter activates on next v1 plan execution. Invariant 14 is explicitly soft. |
| Invariant 13 temp-file | Uses `patcher.cjs` temp file instead of `node -e` inline | Intentional per Windows node -e quoting fix. Semantically equivalent test. |

---

## Recommendation

Phase 12 PASSED. All four MACH requirements and both ERG requirements are delivered and mechanically verified. Proceed to Phase 13 (Governance).

Post-milestone operator action: run `bash super-gsd/scripts/patch-gsd-tools-known-keys.sh` (without `--dry-run`) in the project root to apply the KNOWN_TOP_LEVEL patch to gsd-tools core.cjs, then commit in that repo.

---

_Verified: 2026-04-22T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
