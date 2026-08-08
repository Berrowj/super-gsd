# P149-T2fix — Close 3 review warnings in skill-routing-registry.cjs

Fresh SDD implementer. ONE file: super-gsd/scripts/lib/skill-routing-registry.cjs (+ its fixture/self-test assertions if needed). Fix EXACTLY these three review findings; surgical constraint applies.

## Findings to fix
FINDINGS_DETAIL: [WARNING] Compiled fallback drifts from the YAML registry: default registry has 24 routes, fallback has 22, missing `sgsd-readiness|on-demand|canonical` and `gsd-code-review-fix|on-demand|manual-only`. Runtime degraded mode therefore loses valid routes even though token/phase-close probes pass. See `COMPILED_FALLBACK_ROWS` in `super-gsd/scripts/lib/skill-routing-registry.cjs`.
FINDINGS_DETAIL: [WARNING] `toPromptGovernanceRoutes()` emits `/gsd-code-review` and `/gsd-code-review-fix`, but current P146 validator only accepts directives starting `/sgsd-`. That makes the adapter only partially P146-compatible and would create invalid-route degradation when wired through existing classifier validation.
FINDINGS_DETAIL: [WARNING] YAML regex validation only checks syntax with `new RegExp()`. It does not bound pattern length or reject catastrophic-backtracking shapes, so a future bad registry row can pass self-test and later ReDoS prompt classification. Add a conservative regex policy before classifier wiring.

## Requirements
1. Fallback parity: COMPILED_FALLBACK_ROWS must carry all 24 registry routes (add sgsd-readiness canonical + gsd-code-review-fix manual-only), and add a self-test assertion that fallback row count == YAML registry row count so future drift FAILS self-test.
2. P146 directive compatibility: toPromptGovernanceRoutes() must emit only directives the current P146 validator accepts (/sgsd-*); for gsd-code-review / gsd-code-review-fix emit their /sgsd-aliased directive or mark them non-prompt routes — do NOT emit /gsd-* directives.
3. Conservative regex policy in validation: max pattern length (e.g. 200 chars), reject nested quantifier shapes like (a+)+ / (a*)* / (a|a)*, and add malformed-fixture rows exercising both rejections.

## Verify before reporting: node super-gsd/scripts/lib/skill-routing-registry.cjs --self-test (expect all pass, more assertions than 8)

## Report contract: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / SCRIPTS_CREATED / ONE_LINER / STATUS
