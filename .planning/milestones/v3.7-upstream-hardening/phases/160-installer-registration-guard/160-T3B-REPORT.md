FILES_CHANGED: `super-gsd/install.sh`; `super-gsd/scripts/lib/hook-registration-preflight.cjs`; installer guard test.

VERIFICATION (static): Both CJS files pass `node --check`; preflight-static, smoke-static, and bundled-overlay-static PASS; `git diff --check` PASS.

DEVIATIONS: Spawn-bound installer cases were not run per instruction. Canonical fixture uses one Node-only global smoke hook; deployed smoke uses repo-local Node hooks. No commit created.

BLOCKERS: None. Orchestrator must run node-check-both-sites, canonical-sixteen-hook, and deployed-hook-smoke unsandboxed.

ONE_LINER: Restored normalized per-path refusals, added a 15s startup floor over registered hook budgets, and bounded Windows fixture smoke cost.
