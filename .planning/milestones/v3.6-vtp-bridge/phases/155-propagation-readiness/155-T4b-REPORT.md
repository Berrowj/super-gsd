FILES_CHANGED  
- `super-gsd/scripts/lib/phase-name.cjs`
- `super-gsd/tools/state-resolver/resolve.cjs`
- `super-gsd/tests/propagation-readiness/assert-state-resolver.cjs` (new)

VERIFICATION  
- Focused suite: 59 pass, 2 blocked real-git setups.
- Devcp fixture: 19/19 pass.
- Resolver self-test: 14/14 pass.
- Parser self-test: 4/4 pass.
- Audit regression: 20/20 pass.
- Syntax and diff checks pass.
- Independent re-review: no Critical/Important issues.

DEVIATIONS  
None. No commit, consumer wiring, registry changes, or STATE writes.

BLOCKERS  
Sandbox child spawns return `status=null/EPERM`: focused real-git cases and dual-root matrix cascaded accordingly (10 pass, 136 spawn-related failures). Requires unsandboxed orchestrator rerun.

ONE_LINER  
Opaque ROADMAP-ordered resolver implemented with exact tier admission, safe abstention, dual-root support, and regression coverage.
