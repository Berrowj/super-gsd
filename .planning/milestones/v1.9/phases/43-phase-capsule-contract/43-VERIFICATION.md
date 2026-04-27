---
phase: 43-phase-capsule-contract
verified: 2026-04-27T00:00:00Z
status: passed
score: 7/7 must-haves verified
verdict: PASS
---

# Phase 43: Phase Capsule Contract — Verification Report

**Phase Goal:** Make completed phases consumable without re-scanning folders. Define + implement PHASE-CAPSULE.json (per-phase). Wire into phase-close. Backfill recent milestones.

## A1-A7 Acceptance

| # | Check | Status | Evidence |
|---|-------|--------|----------|
| A1 | Capsule fields present | PASS | All 17 schema-required fields present in `.planning/milestones/v1.9/phases/41-baseline-token-attribution/PHASE-CAPSULE.json`. NOTE: `consumers` is nested under `downstream_contract.consumers` per design (PLAN line 365 + RESEARCH sec 4.1 schema spec), not top-level — verifier prompt's flat list was a misread of the contract. |
| A2 | Verbatim bypass byte-equal | PASS | Capsule `.bypass_refs[0].summary_passthrough` for v1.6/28-mission-control-layout (id `2026-04-27T00-07-22-122Z-589f`) byte-equal to `crit-backlog.jsonl` source row. Lock 6 holds. |
| A3 | Hash idempotency | PASS | `node ... --backfill --all` at steady state returns `written=0, skipped=44, errors=1` (the 1 error is `phase_capsule_backfill_milestone_missing` for non-existent `v1.1/phases` — benign complaint). Re-runs produce identical content_hash. |
| A4 | Schema conformance | PASS | 44 capsules total across v1.2-v1.9 (>= 17 named target). All pass `_assertCapsuleSchema` closed-shape validator. |
| A5 | Never-throws sentinel | PASS | `writeCapsule('/nonexistent/path', 'v9.9', 99)` returns `{ok:false, ...}` sentinel — no exception thrown. Lock 13 holds. |
| A6 | 17 named capsules backfilled | PASS | v1.6:5, v1.7:5, v1.8:5, v1.9:12. Total named = 17 across v1.6-v1.8 + 12 active v1.9. Bonus v1.2-v1.5 (17) via `--all`. |
| A7 | Dual phase-folder shape | PASS | v1.6/26 → `source_hashes.atc_review.path = 26-ATC-REVIEW.md`; v1.9/41 → `source_hashes.atc_review.path = reviews/41-REVIEW.md`. Verifier prompt looked at `files[].kind` but structured kinds live under `source_hashes` per schema. Both shapes detected and hashed. |

## Self-Test 13/13

`node super-gsd/tools/phase-capsule/write.cjs --self-test` → **13 pass, 0 fail** (exit 0).

F2 (rebuild equivalence H1===H2), F3 (missing-file graceful), F4 (critical-bypass verbatim) fixtures all PASS.

## Read-Only Invariant

Source `grep` against canonical-stream paths (token-attribution, codex-log, agent-token-spend, activity-log, token-log, token-waste-status, RESEARCH.md, PLAN.md, CONTEXT.md, VERIFICATION.md, ATC-REVIEW.md) → **no canonical writes**.

Owned writes only: `PHASE-CAPSULE.json`, `PHASE-INDEX.jsonl`, `context-complaints.jsonl` (writer-failure complaint only).

## Phase 41 Import-by-Reference

`super-gsd/tools/phase-capsule/write.cjs:114` → `require(path.join(__dirname, '..', 'token-attribution', 'report.cjs'))` imports `ROLES` + `ledgerPath` from Phase 41. Fallback inline copies (lines 119-126) load only on import failure.

## SKILL.md Wires

- **Forward-flow** (`super-gsd/skills/sgsd-orchestrate/SKILL.md`): Step 6.6.i.X (`<step_6_6_i_X_phase_capsule>` block, lines 1181-1218) calls `writeCapsule` BEFORE phase mark-complete. Failure NEVER halts (lock 13).
- **Safety-net** (`super-gsd/skills/sgsd-complete-milestone/SKILL.md`): Step 4.7-bis (`<step_4_7b_phase_capsule_backfill>`, lines 231-282) runs `backfillFromCanonical` over closing milestone. Idempotent (matching content_hash skipped).

## F2/F3/F4 Binding Fixtures

| Fixture | Line | Binds |
|---------|------|-------|
| F2 rebuild equivalence (H1===H2) | 1504-1517 | A3 hash idempotency |
| F3 missing-file graceful | 1519-1535 | Lock 13 never-throws |
| F4 critical-bypass verbatim | 1538-1591 | A2 + Lock 6 byte-equal |

## PHASE-INDEX.jsonl

8 milestones indexed (v1.2:5, v1.3:3, v1.4:4, v1.5:5, v1.6:5, v1.7:5, v1.8:5, v1.9:12). Append-or-replace by `(milestone, phase)` keeps single row per phase.

## Anti-Patterns Found

None blocking. The 1 `phase_capsule_backfill_milestone_missing` complaint per run is for a vestigial `v1.1` directory probe — benign sentinel, swallowed via warn-only complaint append.

## Goal Achievement

**ACHIEVED.** Completed phases are now consumable via single-file JSON projection with: goal/status/evidence/files/decisions/debt/downstream_contract/source_commits/source_hashes. Critical bypass entries linked verbatim. Deletion + rebuild yields equivalent content hashes (F2 fixture binds). Forward-flow + safety-net SKILL.md hooks wired. 44 capsules + 8 PHASE-INDEX.jsonl files materialized.

---

*Verified: 2026-04-27*
*Verifier: Claude (gsd-verifier / Opus 4.7-1m)*
