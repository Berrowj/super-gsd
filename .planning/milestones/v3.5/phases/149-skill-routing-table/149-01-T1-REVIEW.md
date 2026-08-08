FINDINGS: 1
CRITICAL: 1
WARNINGS: 0
PASS_RATE: 9/10
ONE_LINER: 24-row table satisfies T1 structure and avoids gate-predicate duplication, but `gsd-secure-phase` falsely omits a registered edge-guard governance path.
FINDINGS_DETAIL: CRITICAL: `super-gsd/registry/skill-routing.yaml:389` marks `gsd-secure-phase` as `availability: omitted` with `legacy_security_governance_unregistered`, but the contract requires aliasing to existing security/edge-guard governance if registered; `edge-guard` is registered at `super-gsd/registry/command-envelope-v1.yaml:63`.
