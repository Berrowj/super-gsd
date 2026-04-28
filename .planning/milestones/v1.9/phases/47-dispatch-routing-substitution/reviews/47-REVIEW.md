---
phase: 47
plan: 47-01
review_type: phase-level-ATC (Step 9, dual-provider)
date: 2026-04-27
verdict: PASS (after HIGH+MEDIUM fix)
---

# Phase 47 Phase-Level ATC Review — Dual Provider

## Reviewers

| Provider | Status | Verdict | Findings |
|----------|--------|---------|----------|
| Claude (sgsd-code-reviewer) | OK | REVISE → PASS post-fix | 1 HIGH (closed-enum gap), 2 MEDIUM (doc count + build.test.cjs reference), 1 LOW |
| Codex (sgsd-codex-reviewer) | provider_unavailable | n/a | Phase 41-46 precedent: TIER_ANALYSIS=180s tier cap. |

## Findings + Resolution

### HIGH (resolved)

- **SKILL.md:573** emitted `context_pressure_high` reason_code into dispatch_route envelope rows. ROUTE_DECISION_REASONS in route.cjs:101-121 only contained 17 entries — `context_pressure_high` absent. Phase 50 cockpit consumers validating against the closed enum would silently drop or reject these rows.
  - **Fix**: commit `8c701a2` — extended ROUTE_DECISION_REASONS to 18 entries with secondary annotation `context_pressure_high`. Reorganized into 6 sections with comments. Assertion 10 strengthened: now also asserts `ROUTE_DECISION_REASONS.includes('context_pressure_high')`.

### MEDIUM (resolved)

- **route.cjs:42** header comment said "16 closed-enum reason codes" but array had 17. Updated to "18" with section breakdown.

### MEDIUM (informational only)

- **build.test.cjs reference**: Claude reviewer noted file missing. Test is INLINE in `route.cjs --self-test` (not a separate file). PLAN T1 referenced build.test.cjs but executor consolidated to inline self-test per Phase 41-46 mirror pattern. Verifier confirmed 15/15 PASS — no fix needed.

### LOW (accepted)

- **loadRoutes called on every routeDispatch invocation, no memoization** — negligible at autonomous-loop call rate; accepted per Phase 41-46 LOW-finding precedent.

## Invariants

- **A4 VTP whitelist mechanical**: SOUND — ROUTING_TABLE structure assigns vtp only to 3-entry whitelist (architecture_challenge, prior_memory_lookup, book_lookup); assertion 5 exhaustively scans all 6 types.
- **A5 fallback logged**: SOUND — every fallback returns reason from FALLBACK_REASONS; orchestrator emits envelope row unconditionally after routeDispatch returns.
- **LOCK 11 (no semantic-similarity)**: SOUND — routeInput shape validated in `_validateInput`; no embedding/similarity field accepted or referenced anywhere.
- **LOCK 13 (never-throws)**: SOUND — routeDispatch, isProviderHealthy, loadRoutes wrap try/catch; assertion 11 regression-tests with bad inputs ('banana' fixture confirmed in self-test stderr).
- **NO SECOND ROUTE LEDGER**: SOUND — route.cjs imports route-ledger by reference; orchestrator owns envelope emission; only Phase 32 BOUNDARIES enum extended 7→8.
- **PHASE 41 PROVIDERS by reference**: SOUND — line 57 `PROVIDERS = tokenAttribution.PROVIDERS`; assertion 10 identity-checks the reference.
- **PHASE 42 BUDGETS by reference**: SOUND — line 64 `BUDGETS = tokenWaste.BUDGETS`; used only via `_pressureFor()`.
- **PHASE 32 BOUNDARIES integrity**: SOUND — extended 7→8 with `dispatch_route`; no other contract field changed; route-ledger assertion 14 regression-tests.
- **NO PREMATURE DOWNSTREAM IMPORT**: YES — no Phase 48/50/51 require().
- **READ-ONLY INVARIANT**: PASS — 8-path fingerprint guard in selfTest; no writeFile against canonical streams.
- **ASCII-ONLY**: PASS — 0 non-ASCII bytes.
- **SKILL WIRE ADDITIVE**: YES — Step 6.d.6 adds routeDispatch + dispatch_route envelope; existing dispatch path unchanged.
- **MIRROR FIDELITY**: PASS post-fix — frozen enums, try/catch, fingerprint guard, closed-vocab validation parity preserved between SKILL.md emitter and ROUTE_DECISION_REASONS exporter.

## Live verification at close

```
dispatch-router self-test: 15/15 PASS
route-ledger self-test: 14/14 PASS (was 13)
ROUTE_DECISION_REASONS: 18 entries, includes context_pressure_high
F1 deterministic_extraction → local-script ✓
F2 bounded_code_review → codex ✓
F3 codex unhealthy → claude w/ provider_codex_unavailable ✓
F4 synthesis_judgment → claude ✓
F5 architecture_challenge → vtp ✓
F6 vtp unhealthy → claude w/ provider_vtp_unavailable ✓
F7 structural override (Lock 11) ✓
F8 context-pressure bias (KAIROS) ✓
Lock 13: null + 'banana' → safe-default sentinel ✓
Phase 41/42/32 imports BY REFERENCE ✓
Phase 41-46 source files RO ✓
```

## Final Verdict

**PASS** (post-fix). Phase 47 deliverables hold all critical invariants. Claude HIGH + MEDIUM addressed in-loop; Codex provider_unavailable per established precedent. Commit chain: `6f50d86` (route.cjs + routes.yaml + 15-assertion self-test) → `10334a7` (route-ledger BOUNDARIES 7→8) → `32a651b` (SKILL.md wire) → `1b33dec` (verifier audit) → `8c701a2` (HIGH+MEDIUM fix). Cross-phase contracts ready: Phase 48 will refine VTP packet assembly under the 3-entry whitelist; Phase 50 cockpit consumes route-decisions.jsonl with closed-enum reason validation; Phase 51 BENCH consumes for utility_per_token measurement.
