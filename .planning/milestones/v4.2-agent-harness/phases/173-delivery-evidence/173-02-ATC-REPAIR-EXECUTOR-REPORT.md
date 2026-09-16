FILES_CHANGED:
[super-gsd/tools/codex-worker/mailbox.cjs](/home/jackberrow/.config/superpowers/worktrees/super-gsd/harness/super-gsd/tools/codex-worker/mailbox.cjs) (modified)
[super-gsd/tools/codex-worker/worker.test.cjs](/home/jackberrow/.config/superpowers/worktrees/super-gsd/harness/super-gsd/tools/codex-worker/worker.test.cjs) (modified)

VERIFICATION:
`node --test --test-name-pattern='concurrent creates cannot exceed the inherited fan-out limit' ...` -> exit 0 (1 pass)
`node --test super-gsd/tools/codex-worker/worker.test.cjs` -> exit 1 (40 pass, 1 unrelated process-tree cleanup failure, 2 skip)
`env -u SGSD_CODEX_PROFILES_REGISTRY npm run test:codex-worker` -> exit 1 (99 pass, 3 failures, 2 skip)
`git diff --check` -> exit 0 (no whitespace errors)
`git status --short` -> exit 0 (59 pre-existing/current worktree entries)

DEVIATIONS: none

BLOCKERS: Wrapper-suite known board-reply baseline failed; two offline wrapper self-tests also failed with existing `codex-executor.sh: Permission denied`. Direct suite had one unrelated child process-tree cleanup failure.

SCRIPTS_CREATED: none

ONE_LINER: Added a 60-second identity-safe cross-process fan-out lock; concurrent excess creates now fail with `worker_fanout_limit`. Evidence: [ATC finding](/home/jackberrow/.config/superpowers/worktrees/super-gsd/harness/.planning/milestones/v4.2-agent-harness/phases/173-delivery-evidence/173-02-ATC-REVIEW-REPORT.md).
