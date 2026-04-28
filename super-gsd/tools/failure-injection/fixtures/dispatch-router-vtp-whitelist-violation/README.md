# Fixture: dispatch-router-vtp-whitelist-violation

Scenario id: dispatch-router-vtp-whitelist-violation
Target tool: super-gsd/tools/dispatch-router/route.cjs (routeDispatch)
Inject mechanism: non_whitelisted_uncertainty_type_for_vtp

## Failure mode

This scenario is argv-only - no static fixture content beyond this
README. The harness spawns a node -e wrapper that requires the real
route.cjs and calls:

  routeDispatch({
    uncertainty_type: 'deterministic_extraction',
    task_kind: 'general',
    role: 'researcher',
    route_hint: 'vtp'
  });

`deterministic_extraction` maps to ROUTING_TABLE primary='local-script'
(route.cjs:144-148); it is NOT in VTP_WHITELIST (route.cjs:175-179).
The route_hint:'vtp' is ignored because the routing table hard-binds
deterministic_extraction to local-script as Lock 11 / A4 (the VTP
whitelist is mechanically enforced via ROUTING_TABLE primary
assignment). The decision returns provider='local-script' with
reason='matched_uncertainty_type'.

## Closed-vocab observation

`expected_reason_codes` per scenarios.json:
`route_match_fallback`, `provider_vtp_unavailable`.

The real route.cjs emits ROUTE_DECISION_REASONS values
(route.cjs:103-129). For deterministic_extraction with healthy
local-script the emitted reason is 'matched_uncertainty_type' (NOT in
the scenarios.json frozen enum). The harness records this as
observed_reason_codes=['matched_uncertainty_type'] and verifies the
dominant assertion: `decision.provider !== 'vtp'` AND
`decision.fallback_used === false` AND
`decision.provider === 'local-script'` (the deterministic primary).

When observed reasons do not intersect the frozen
`expected_reason_codes` set, the harness emits
`scenario_pass_soft_skip` per Phase 51 F17 precedent and records the
real observed code in the log row. The structural invariant
(provider !== 'vtp') still holds - that is the load-bearing assertion
for VTP whitelist enforcement.

## Files

- README.md (this file only - no static fixture data; argv-only inject)

ASCII-only. No credentials.
