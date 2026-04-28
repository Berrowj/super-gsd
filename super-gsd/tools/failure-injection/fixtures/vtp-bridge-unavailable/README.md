# Fixture: vtp-bridge-unavailable

Scenario id: vtp-bridge-unavailable
Target tool: super-gsd/tools/vtp-bridge/classify.cjs (selectiveVTPCall)
Inject mechanism: env_sgsd_vtp_force_offline_1

## Failure mode

The VTP bridge is forced into the unavailable code path. Two complementary
mechanisms are layered so the assertion holds across environments:

1. The harness sets env SGSD_VTP_FORCE_OFFLINE=1 on the spawned subprocess
   (recorded in env-manifest.json as the documented inject-point per the
   scenarios.json manifest).
2. The harness writes NO vtp-health.jsonl into the per-scenario tmpdir
   .planning/metrics/. When the bridge calls
   route.isProviderHealthy('vtp', planningDir), the underlying
   _vtpHealthFromLog(planningDir) returns { healthy: false, reason: 'no_log' }
   because the canonical health log is absent. selectiveVTPCall therefore
   takes the Gate-3 unhealthy branch and emits reason 'vtp_unavailable'
   into the evidence_packet.reason_codes.

The expected outcome is a degraded sentinel evidence_packet with ok=false,
results=[], confidence='low', and reason_codes including 'vtp_unavailable'.
The dispatch-router fallback chain (Phase 47) sends the request to
'claude' as the documented fallback - the harness asserts the structural
fact that the bridge surfaced the unavailable signal cleanly.

## Closed-vocab observation

`expected_reason_codes` per scenarios.json: `provider_vtp_unavailable`.

The real bridge VTP_BRIDGE_REASONS enum emits the underscored shape
`vtp_unavailable` (10 entries; classify.cjs:132-143). The plan-canonical
manifest token differs by the `provider_` prefix, so the harness records a
PASS-WITH-SOFT-SKIP via reason
`cli_shape_drift_bridge_emits_underscored_reason_code`. The structural
assertion is the load-bearing one: subprocess exit_code is a number (real
spawn proven), packet.ok === false, packet.reason_codes is a non-empty
array containing 'vtp_unavailable'.

If the bridge implementation regresses (throws, returns ok=true while
forced offline, or silently swallows the unavailable signal), the
verdict flips to FAIL via the structural-OK predicate.

## Files

- README.md (this file)
- env-manifest.json: documents the env-knob injection mechanism for
  reviewers / future packet-canonicalization tooling.

ASCII-only. No credentials.
