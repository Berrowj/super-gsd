---
phase: 32
status: PASS
verified: 2026-04-27
unresolved_count: 0
goal_achieved: true
re_verification: true
re_verification_reason: "Phase-level ATC dual-provider review surfaced 2 CRITs (out-of-scope dispatchResult / envelope conformance) + 5 WARNs (plan drift / wire scope / cwd / shallow validation / broad catch); 6 fixed in-loop, 1 deferred design-locked (W5: writer never throws upward per CONTEXT.md lock). Combined anti-slop 9.5/10."
atc_review: 32-ATC-REVIEW.md
atc_anti_slop_combined: "9.5/10 (W5 deferred design-locked)"
---

# Phase 32 - Route Decision Ledger - VERIFICATION

**Phase Goal (verbatim from 32-CONTEXT.md):**
> Land an append-only `.planning/metrics/route-decisions.jsonl` ledger plus a writer module (`route-ledger.cjs`) that every orchestrator routing decision can log to. Phase 32 SHIPS one production caller (codex_route boundary) -- the 5 remaining boundary types are pre-declared in the schema but wired later (no schema-without-consumer violation: codex_route IS the consumer).

**Locked decision:** 32=A boundary-only (one wire-in for codex_route at SKILL.md Step 9.5).

**Status:** **PASS** -- 0 unresolved gaps, goal achieved.

---

## Goal Achievement: Y

Phase 32 ships every required deliverable end-to-end with runnable evidence:

1. The lib `super-gsd/scripts/lib/route-ledger.cjs` exists (401 lines, commit `b12e7d4`) and self-tests 12/12 PASS at exit 0.
2. The wire-in at `super-gsd/skills/sgsd-orchestrate/SKILL.md:1238-1252` (commit `5c90811`, +16 lines) calls `logCodexRoute(...)` immediately after `appendPerDispatchReviewEvidence(...)` inside Step 9.5 PER-DISPATCH ATC `else if (effective.invocation === 'shell')` branch. All required scope variables (`currentPhase`, `currentMilestone`, `currentPlan`, `dispatchResult`, `effective`, `report`, `perDispatchReportPath`) are present at the insertion site (verified at lines 1163-1215).
3. The local fallback test `super-gsd/scripts/lib/route-ledger.test.cjs` (commit `ea27395`, 144 lines) exits 0 with **26/26 PASS** (>=24 fixtures required by Patch 4) and imports `logCodexRoute` directly from the production lib -- zero mocks, zero predicates bypassed.
4. The Phase-31 envelope-v1 contract is **honored**, not modified: `evidence[]` shape is `{kind, ref}` (not `{kind, path}`); the d1fefc1 plan-checker BLOCKER fix landed -- review_report flipped from artifacts[] to evidence[] per envelope-v1.json:53. `command-envelope-v1.yaml:260 collides_with: []` preserved unchanged.
5. The `BOUNDARIES` const exports all 6 canonical boundary names as `Object.freeze([...])` (verified at runtime: `Object.isFrozen(BOUNDARIES) === true`, `length === 6`).
6. `logCodexRoute` itself wraps every call in try/catch (lib:177, 242-245) and returns `false` on error -- the orchestrator continues regardless. The "Autonomy continues; evidence tells the truth" principle is enforced at the helper level, so the 4-line wire-in needs no outer try/catch.

Each acceptance criterion (ROUTE-01..04 + Patch 4 + envelope-v1 reconciliation + schema-without-consumer + locked-decision discipline) has runnable evidence cited below.

---

## ROUTE-01..04 Verification (per-requirement)

| Req | Spec | Evidence | Status |
|-----|------|----------|--------|
| **ROUTE-01** | `node super-gsd/scripts/lib/route-ledger.cjs --self-test` exits 0 (12/12 PASS) | Ran command. stdout: `route-ledger self-test: 12 pass, 0 fail`. EXIT_CODE=0. The single `[SGSD] route-ledger logRouteDecision failed: ... got 'banana'` stderr line is the **expected** assertion-10 try/catch verification (logRouteDecision returns false on validation failure without throwing upward). | PASS |
| **ROUTE-02** | 6 boundary types in BOUNDARIES const, lib rejects unknown | Runtime check via `node -e`: `BOUNDARIES = ["milestone_promotion","phase_dispatch_first","executor_choice","gate_skip","codex_route","handoff_decision"]`, `length=6`, `Object.isFrozen=true`. Self-test assertions 5+6 verify rejection: `appendRow({boundary:'banana',...})` throws "boundary must be one of"; `appendRow({status:'maybe',...})` throws "status must be one of". Both pass. | PASS |
| **ROUTE-03** | SKILL.md contains `logCodexRoute(...)` call at Step 9.5 wrapped in try/catch | Grep `logCodexRoute` in SKILL.md returns 1 hit at **line 1242**. Containing block at lines 1238-1252 sits inside Step 9.5 (Step 9.5 starts at line 1117) inside `else if (effective.invocation === 'shell')` branch (line 1163), immediately after the `appendPerDispatchReviewEvidence(...);` close at line 1236. Try/catch wrapping is **internal to the helper** (route-ledger.cjs:177-246) -- the helper returns `false` on error and the wire-in inherits that contract; per CONTEXT, adding outer try/catch in SKILL.md duplicates the contract and is explicitly forbidden. | PASS |
| **ROUTE-04** | Each row contains required envelope-v1 fields + extension fields; evidence[] uses `{kind, ref}` | Runtime emission test confirms all 13 envelope-v1 required fields present (envelope_version=1, ts, command='logRouteDecision', status, reason_codes, artifacts, evidence, next_action, risk, duration_ms, run_id, phase, milestone) PLUS 2 extension fields (boundary, decision). Evidence shape verified `[{"kind":"review_report","ref":"x.md"}]` -- uses `ref` per Phase 31 contract, not `path`. d1fefc1 BLOCKER fix landed (executor honored it: lib line 218-220 emits evidence with `ref`, lib line 238 `artifacts: []`). | PASS |

---

## Patch 4 (Live-or-local) Verification

**Command:** `node super-gsd/scripts/lib/route-ledger.test.cjs`
**stdout (verbatim):** `route-ledger fallback test: 26 pass, 0 fail`
**EXIT_CODE:** 0

26/26 assertions PASS (exceeds >=24 floor). The test imports `logCodexRoute` from `./route-ledger.cjs` (the production lib at line 21: `const ledger = require('./route-ledger.cjs');`) -- not a mock. Only the `dispatchResult` payload is faked (the I/O boundary -- output of shelling to codex-exec.sh). All status mapping, reason_code derivation, envelope-shaping, JSONL append, and defensive-read logic runs under the test.

The 4 fixtures cover the canonical codex outcomes:
- A. codex_success: `exit=0, fallbackTriggered=false` -> `status='ok', reason_codes=['review_unanimous_pass']`
- B. codex_timeout: `exit=5, timeout_hit=true` -> `status='timeout', reason_codes=['codex_timeout']`
- C. codex_auth_fail: `exit=4, fallbackTriggered=true, providerUsed='claude-via-fallback'` -> `status='fail', reason_codes=['codex_auth_missing','codex_fallback_triggered']`
- D. parse_failure_fallback: `exit=0, fallbackTriggered=true, fallbackReason='parse_failure'` -> `status='warn', reason_codes=['codex_fallback_triggered','parse_failure']`

Provider-unavailable (the live degraded mode) is exercised explicitly by Fixtures C+D. Patch 4 satisfied: production caller path exercised, no mock predicates.

---

## Envelope-v1 Reconciliation

| Check | Evidence | Status |
|-------|----------|--------|
| `evidence[]` shape uses `{kind, ref}` not `{kind, path}` | route-ledger.cjs:218-220 emits `[{ kind: 'review_report', ref: reportPath }]`; runtime emission verified `evidence: [{"kind":"review_report","ref":"x.md"}]`. Plan-checker BLOCKER fix d1fefc1 landed and is reflected in production code. | PASS |
| All 13 envelope-v1 required fields present in emitted rows | Runtime verification: envelope_version=1, ts (ISO-8601 string), command='logRouteDecision', status (envelope-v1 enum), reason_codes (array), artifacts (array), evidence (array), next_action (null default), risk (null default), duration_ms (null default), run_id (matches envelope-v1 regex), phase (string), milestone (string). All 13 present. | PASS |
| 2 extension fields (boundary, decision) present | Runtime verification: boundary='codex_route', decision={...}. Both present per `additionalProperties: true` in envelope-v1.json. | PASS |
| `command-envelope-v1.yaml:260 collides_with: []` preserved | grep at line 260: `collides_with: []`. Unchanged from Phase 31 (last contract commit `32dc0f2 feat(31-01): land canonical command envelope v1 schema + registry`). Phase 32 commits did NOT touch this file. | PASS |
| run_id matches envelope-v1 pattern `^[0-9]{4}-[0-9]{2}-...Z-[a-f0-9]{4}$` | Runtime sample: `2026-04-27T08:20:12.009Z-3451`. Self-test assertion 4 + 11 verify uniqueness over 100 calls. | PASS |
| status enum subset of envelope-v1 6-state | STATUSES const = `['ok','warn','fail','skipped','timeout','blocked']`. Matches envelope-v1.json status.enum exactly. | PASS |

---

## Schema-without-consumer Rule

ROUTE-03 requires "Orchestrator invokes logRouteDecision() at >=1 boundary in production." Phase 32 ships:
- The lib (`route-ledger.cjs`).
- The first production caller (sgsd-orchestrate SKILL.md Step 9.5 via `logCodexRoute`).
- The local fallback test exercising the same helper.

The lib has its first consumer THIS phase. Schema-without-consumer not violated. The 5 deferred boundaries (milestone_promotion, phase_dispatch_first, executor_choice, gate_skip, handoff_decision) are pre-declared in BOUNDARIES const as v1.8+ targets per locked decision 32=A; they are documented in 32-RESEARCH.md Section 1 with exact wire-in line numbers but explicitly NOT wired this phase.

---

## Locked-decision 32=A Discipline

| Check | Evidence | Status |
|-------|----------|--------|
| Only `codex_route` wired (no other 5 boundaries) | Grep across `super-gsd/skills/` and `super-gsd/scripts/`: only one `logCodexRoute` invocation site at `SKILL.md:1242`. No `logRouteDecision(` calls outside the lib. The other 5 boundary names appear ONLY in BOUNDARIES const declarations and lib comments -- never as wire-in invocations. | PASS |
| Other 5 boundaries pre-declared in BOUNDARIES | Verified at runtime: BOUNDARIES contains all 6, frozen, length=6. | PASS |

---

## No-modification Proof (4 existing contracts + envelope-v1)

`git log --all --oneline` for each contract file scoped to repo history:

| File | Last touch | Phase 32 modified? | Status |
|------|-----------|-------------------|--------|
| `super-gsd/registry/command-envelope-v1.yaml` | 32dc0f2 (Phase 31) | NO | PASS |
| `super-gsd/templates/command-envelope-v1.json` | 32dc0f2 (Phase 31) | NO | PASS |
| `super-gsd/registry/code-reviewer-v1.yaml` | (no Phase 32 commits) | NO | PASS |
| `super-gsd/registry/review-providers-v1.yaml` | (no Phase 32 commits) | NO | PASS |
| `super-gsd/registry/handover-contract-v2.yaml` | d1ba19e (pre-v1.7 scaffold) | NO | PASS |
| `super-gsd/registry/plan-schema-v2.yaml` | d1ba19e (pre-v1.7 scaffold) | NO | PASS |

The 3 Phase 32 commits touch ONLY:
- `b12e7d4`: `super-gsd/scripts/lib/route-ledger.cjs` (+401 lines, new file)
- `5c90811`: `super-gsd/skills/sgsd-orchestrate/SKILL.md` (+16 lines, wire-in only)
- `ea27395`: `super-gsd/scripts/lib/route-ledger.test.cjs` (+144 lines, new file)

The d1fefc1 plan-checker fix touched only the **PLAN** (not the contract). Total Phase 32 additions: 561 lines, 0 deletions, 0 contract bumps.

---

## ASCII-only Byte Scan

Ran `node -e "..."` byte scan across the 2 new lib files:
- `super-gsd/scripts/lib/route-ledger.cjs`: bytes=15733, non-ASCII=**0** -- PASS
- `super-gsd/scripts/lib/route-ledger.test.cjs`: bytes=6800, non-ASCII=**0** -- PASS

(SKILL.md was not scanned -- the 16-line wire-in addition is plain ASCII per the diff at commit 5c90811; pre-existing file may contain non-ASCII characters but those are unchanged by Phase 32.)

---

## Closing Verdict

**PASS.** Phase 32 ships ROUTE-01..04 + Patch 4 + envelope-v1 reconciliation + schema-without-consumer + locked-decision-32=A discipline with end-to-end runnable evidence. The Route Decision Ledger is operational: the lib exists, self-tests, has its first production consumer wired at SKILL.md Step 9.5, exercises the production caller path under deterministic local-fallback, and emits canonical envelope-v1 rows with `evidence: [{kind, ref}]` per Phase 31 contract.

The "Autonomy continues; evidence tells the truth" principle is encoded at the helper boundary: `logCodexRoute` and `logRouteDecision` both wrap appendRow in try/catch and return `false` on failure -- the orchestrator never crashes from telemetry-write failure. Goal achieved.

Ready to proceed.
