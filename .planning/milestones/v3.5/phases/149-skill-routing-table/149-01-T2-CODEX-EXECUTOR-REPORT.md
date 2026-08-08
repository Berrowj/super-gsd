FILES_CHANGED
`super-gsd/scripts/lib/skill-routing-registry.cjs`
`super-gsd/tools/self-test/fixtures/skill-routing-malformed.yaml`
Runtime verification appended degradation evidence to `.planning/metrics/gate-evidence.jsonl`.

VERIFICATION
`node --check super-gsd\scripts\lib\skill-routing-registry.cjs` -> exit 0.
`node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test` -> exit 0, `8 pass, 0 fail`.
Malformed self-test -> expected exit 1; rejected empty `skill` and invalid regex.
Runtime probe -> exit 0, `source=compiled_fallback`, `degradation_logged=true`, `/sgsd-token-audit` present.
Ledger tail confirms `signal=skill_routing_registry_degraded`, `reason_codes=["skill_routing_registry_malformed"]`, `event=skill-routing`, `decision=fallback`.

DEVIATIONS
`apply_patch` was blocked by the Windows sandbox wrapper, so I used PowerShell writes for the two new files only.
Evidence row records `phase:"148"` because `.planning/STATE.md` currently says `current_phase: "148"`; I did not override state.

BLOCKERS
None.

SCRIPTS_CREATED
`super-gsd/scripts/lib/skill-routing-registry.cjs`

ONE_LINER
P149-T2 loader now validates the real skill-routing table strictly in self-test and falls back loudly with gate evidence at runtime.

STATUS
Complete.
