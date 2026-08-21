---
phase: "162"
slug: fleet-service
milestone: v3.8-fleet-cockpit
status: PASS-WITH-DEFERRED-2
closed: 2026-08-21
commits: ["bd39349", "bc58e6f", "af9d836", "7998b25", "8410974"]
gates: {plan_review: "GO-WITH-CHANGES, AMENDMENT-1", close_review: "BLOCKED (3 CRIT) then fixed in one round", verifier: "fleet suite 229/229 + adapter 19/19 untouched"}
---

# P162 Summary — Fleet Service (handover step 1)

## What shipped

1. `bc58e6f` T1 — fleet.cjs: git-porcelain discovery, timer cache
   (never-build-on-request, bounded concurrency 4, roll-up-first, coalesced
   ticks), one broken lane isolates to an error row.
2. `af9d836` T2 — status.cjs: attention/running/stale/idle first-match
   precedence with machine-code reasons; the five product filters as named
   contractual fixtures (agent noise, tokens no-data, gates no-data, artifacts
   reason, unresolved projection conflict with both values + confidence).
3. `7998b25` T3 — server.cjs (node:http only, zero deps, CJS, ASCII): /api/fleet,
   /api/lane/:name with the adapter snapshot VERBATIM, /raw, /healthz;
   localhost-default with --host opt-in; no mutating handlers exist;
   sgsd-fleet.sh + docs/FLEET-COCKPIT.md.
4. `8410974` close-fix — later-run clearing (stale attention clears on
   subsequent run_started/gate_passed), frame coalescing, real-CLI-default bind
   proof, artifacts.phases field corrected.

## Deferred

1. OPERATOR DECISION: default port 7777 collides with the Voice-Text-Plan
   cockpit-sidecar's default on dev boxes (PID-verified live). The bind case
   skips loudly there. Options: change fleet default (e.g. 7788) or accept
   --port at start; handover said 7777.
2. devcp load-delta acceptance (<1.0) is run-home verification, deferred to
   first devcp deployment by design.

## Downstream contract

/api/fleet + /api/lane are stable for P163's page; snapshots stay verbatim so
the page survives adapter schema motion; status truth is fixture-locked.
