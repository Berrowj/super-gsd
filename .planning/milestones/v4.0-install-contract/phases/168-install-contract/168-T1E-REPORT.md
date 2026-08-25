STATUS: IMPLEMENTED; DYNAMIC VERIFICATION DENIED

FILES_CHANGED: [assert-installer-registration-guard.cjs](<HOME>/AppData/Roaming/warp/Warp/data/worktrees/GSDedits/luminaria-hogback/super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs:1051) only.

SUMMARY: Assertions now parse the structured refusal and require exact `reason`, `MODULE_NOT_FOUND`, request, path, and bounded message details. Existing no-write checks remain.

VERIFICATION:

- Guard PASS, exit 0: `preflight-static`, `smoke-static`, `bundled-overlay-static`, `hook-manifest-completeness`, `witness-repair-smoke-no-mutation`.
- Guard DENIED, exit 1, `spawnSync bash EPERM`: `bundled-overlay-current`, `vendored-nine-hook`, `node-check-both-sites`, `deployed-hook-smoke`, `hook-distribution-all-types`, `brokered-substrate-capability`.
- Guard DENIED, exit 1, `spawnSync git EPERM`: both Clarity cases.
- Install-contract: generated manifest PASS exit 0; real-install and unresolved-module cases DENIED exit 1 (`bash EPERM`). Aggregate command exit 1—not 3/3.
- `node --check`: exit 0. Diff check: exit 0.
- Direct path-with-spaces contract and two-site syntax probes: exit 0.

JUSTIFICATIONS:

- `vendored-nine-hook` — STRONGER: exact parsed phase-boundary request/path plus unchanged settings and zero registrations.
- `node-check-both-sites` — STRONGER for missing-source installs: exact global/repo request/path plus unchanged settings; exact syntax checks remain at both sites.
- `deployed-hook-smoke` — STRONGER: exact dependency request/source path and owning classifier, while both settings snapshots remain unchanged.
- `sgsd-update-clarity-shape` — STRONGER: exact classifier request/source path, exit 5, unchanged settings/pin/HEAD/operator rows.
- `sgsd-update-clarity-recovery` — STRONGER: same exact structured refusal and complete no-write proof.

COVERAGE LOSS: installer-level invalid-syntax artifact naming no longer exists—the candidate CLI emits generic `hook_install_contract_failed`; exact syntax coverage is therefore preserved directly in preflight rather than weakened to a generic installer exit assertion.
