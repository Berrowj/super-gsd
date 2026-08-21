FILES_CHANGED / None; existing uncommitted T3/T3B changes preserved.

VERIFICATION / Static PASS: `node --check`; exact two-settings call returned `THREW issue_count=3`, all `hook_registration_missing`; `git diff --check` PASS.

DEVIATIONS / No edit: current `findLiveGlobalCoverage` already adapter-verifies via `preflightHookDescriptors`, while oldSha removes the three relevant registrations and scripts.

BLOCKERS / Prior orchestrator failure is not reproducible from the current worktree; spawn-bound rerun remains with orchestrator.

ONE_LINER / Current code refuses uncovered rows correctly; the reported failure appears stale or from a mismatched worktree state.
