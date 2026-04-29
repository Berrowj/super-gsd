# Fixture: soft-skip-codex-unavailable (SH3, happy)

Synthetic open-circuit provider-circuit.json is written by the harness at
runtime under the tmpdir, then SGSD_CIRCUIT_STATE_FILE is exported so the
provider-circuit.cjs library reads from the synthetic file. The harness
calls shouldFallback({milestone, provider:'codex'}) and asserts
fallback_active === true.

## Expected outcome

`PASS-WITH-SOFT-SKIP`. Codex degrades to Claude reviewer because the
synthetic open-circuit state file flips the threshold-3 trigger.
