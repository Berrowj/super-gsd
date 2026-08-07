STATUS: DONE (report reconstructed by orchestrator — executor timed out at 1200s with work complete; 4th instance, DEVIATION-W family)

FILES_CHANGED:
`super-gsd/scripts/install-commit-gate.cjs` (created)
`super-gsd/install.sh` (modified — install/uninstall/dry-run wiring)
`super-gsd/docs/commit-gate.md` (created)
`super-gsd/tests/commit-gate/assert-real-commit-gate.cjs` (extended — 4 installer scenarios)

VERIFICATION (orchestrator host runs):
- node --check installer, bash -n install.sh, node --check tests → all exit 0
- FULL SUITE 18/18 PASS host-side, including:
  installer-lifecycle (install → SGSD-marked hook at git-resolved path →
  idempotent re-install → uninstall → clean no-op repeat)
  installer-refuses-unmarked (pre-existing unmarked hook untouched, loud refusal)
  installer-linked-worktree-warning (shared common-dir path warned)
  installer-trampoline-real-commit (REAL `git commit`: warn mode succeeds with
  banner + shadow row; forced block maps exit 10 → git exit ≠0 with files
  intact; node-missing bootstrap failure → commit still succeeds, loud degradation)
- docs/commit-gate.md contains: --no-verify honesty, one-layer framing,
  .sgsd-gate-off sentinel, rollback/uninstall outside the gate, linked-worktree
  sharing note

DEVIATIONS: [T05-D1] executor timeout with empty report; reconstructed.
BLOCKERS: none
ONE_LINER: Idempotent git-resolved installer with POSIX trampoline (exit-10→block, bootstrap-failure→fail-open), SGSD-marked-only refresh, unmarked-hook refusal, self-lock-free uninstall, and honest docs.
