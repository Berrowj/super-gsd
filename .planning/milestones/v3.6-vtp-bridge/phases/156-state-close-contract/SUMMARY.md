---
phase: "156"
slug: state-close-contract
milestone: v3.6-vtp-bridge
status: PASS-WITH-DEFERRED-4
closed: 2026-08-20
commits: ["27bf010", "82849f8", "33ccfb3", "92f21b3", "db74df5"]
gates: {plan_review: "GO-WITH-CHANGES, AMENDMENT-1 applied", spec_review_t1: "fix_required then fixed", spec_review_t2: "pass 5/5", atc_t1: "warn x2 deferred", atc_t2: "warn x2 deferred", close_review: "PASS-WITH-DEFERRED 0 findings", verifier: "assert-state-write 38/38 + assert-phase-close-route 36/36, both exit 0"}
---

# P156 Summary — State-Close Contract

## What shipped, two commits

1. `92f21b3` T1 — `super-gsd/tools/state-write/write.cjs`: atomic (tmp+fsync+rename)
   STATE projection writer with an event-envelope CLI; refuses backwards writes keyed
   on the resolver's projection_stale/stale_sources with ROADMAP order used only to
   classify direction (AMENDMENT-1); refuses duplicate ROADMAP identities fail-closed
   (fix-round red 0/2 then green); byte-idempotent replay. Wired at SKILL Step 11
   (plan close) and Step 6.6.j (phase close); repo-owned gsd-phase-boundary.sh
   replaces the line-25 advisory with truthful state.write ownership; install.sh
   deploys it. Installer test self-copy fallback removed: spawn denial now fails loud.
2. `db74df5` T2 — `super-gsd/tools/phase-close/check.cjs` read-only SUMMARY preflight
   (seven-field frontmatter, js-yaml JSON_SCHEMA, duplicate-key rejection, 81e7210
   exponent-coercion guarded) wired into the production skillRoutingConsult for
   moment=phase-close + execute=true only. Red preserved: pre-gate, the actual route
   accepted AUDIT-without-SUMMARY with ok=true and 1 dispatch — the devcp v30-06.8
   dead-end reproduced, now refused with zero dispatches and byte-identical STATE.

## Deferred (recorded, not relitigated)

1. ATC T1 WARN: write.cjs orphan exit-constant exports, unread projectedState.milestone,
   unreachable roadmapIndex duplicate branch (superseded by pre-dedup rejection).
2. ATC T2 WARN: test scaffolding stateAdvances duplicate assertions + unreachable
   checker-existence guard (assert-phase-close-route.cjs).
3. Pre-existing, out of scope: orchestrator-hooks self-test A1 fails on HEAD too
   (tokenWasteCheck(null) returns ok:true against a populated live ledger).
4. Executor-sandbox spawn denials keep 5 route-CLI and 2 installer assertions
   orchestrator-run-only; division of labour documented in both task reports.

## Downstream contract

Phase close now mechanically requires a well-shaped SUMMARY.md before dispatch and
advances STATE only through state.write(); this SUMMARY and this phase's own close are
the first production consumers.
