FINDINGS: 3
CRITICAL: 0
WARNINGS: 3
PASS_RATE: 7/10
ONE_LINER: Loader meets core T2 behavior, but fallback parity, P146 directive compatibility, and regex hardening need cleanup.
FINDINGS_DETAIL: [WARNING] Compiled fallback drifts from the YAML registry: default registry has 24 routes, fallback has 22, missing `sgsd-readiness|on-demand|canonical` and `gsd-code-review-fix|on-demand|manual-only`. Runtime degraded mode therefore loses valid routes even though token/phase-close probes pass. See `COMPILED_FALLBACK_ROWS` in `super-gsd/scripts/lib/skill-routing-registry.cjs`.
FINDINGS_DETAIL: [WARNING] `toPromptGovernanceRoutes()` emits `/gsd-code-review` and `/gsd-code-review-fix`, but current P146 validator only accepts directives starting `/sgsd-`. That makes the adapter only partially P146-compatible and would create invalid-route degradation when wired through existing classifier validation.
FINDINGS_DETAIL: [WARNING] YAML regex validation only checks syntax with `new RegExp()`. It does not bound pattern length or reject catastrophic-backtracking shapes, so a future bad registry row can pass self-test and later ReDoS prompt classification. Add a conservative regex policy before classifier wiring.
