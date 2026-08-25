STATUS: DENIED — fix applied; spawn-backed verification sandbox-blocked.

CHANGE:

- Updated [assert-installer-registration-guard.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs:191).
- Package names derive exclusively from `computeHookDependencyGraph().packages`.
- Sources resolve via repository-scoped `require.resolve`, then walk to `node_modules/<package>`.
- Fixtures prefer junctions/symlinks; fallback copies only the resolved package root.
- Missing packages fail loudly by name.
- No hardcoded package names. No smoke, delivery, closure, classifier, or assertion weakening.

TDD:

- RED: `hook-manifest-completeness` exit 1 at unimplemented provisioning.
- GREEN: exit 0 after implementation.

VERIFICATION:

- Guard exposes 13 cases: 5 PASS; the requested 8 spawn-backed cases DENIED.
- Six denied at `spawnSync bash EPERM`; two at `spawnSync git EPERM`.
- Install-contract: `generated-transitive-manifest` PASS; remaining two DENIED at Bash spawn.
- `node --check` on all modified/untracked JS/CJS: exit 0.
- `git diff --check`: exit 0.

Required unsandboxed rerun: eight guard cases plus install-contract 3/3.
