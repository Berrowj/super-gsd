FILES_CHANGED: `super-gsd/CLAUDE-OVERLAY.md`; `super-gsd/tests/installer-registration-guard/assert-installer-registration-guard.cjs`

VERIFICATION (static): `node --check` ✓; `bundled-overlay-static` PASS; `preflight-static` PASS; `git diff --check` ✓. Spawn-bound suite intentionally left to orchestrator.

DEVIATIONS: None. Unrelated worktree changes untouched; no commit.

BLOCKERS: None.

ONE_LINER: Refreshed bundled overlay to gpt-5.6-sol/DLB-01 contracts and added mutation-proven stale-routing tripwires with fresh-install byte-equality coverage.
