FILES_CHANGED:
[super-gsd/scripts/lib/codex-worker-shell.sh](/home/jackberrow/.config/superpowers/worktrees/super-gsd/harness/super-gsd/scripts/lib/codex-worker-shell.sh:197) (modified)
[super-gsd/tests/codex-worker/launch.test.cjs](/home/jackberrow/.config/superpowers/worktrees/super-gsd/harness/super-gsd/tests/codex-worker/launch.test.cjs:215) (modified)

VERIFICATION:
`focused T3 launch pattern` -> exit 1 (pass 2, fail 1, skip 0) RED
`focused T3 launch pattern` -> exit 0 (pass 3, fail 0, skip 0)
`focused T3 + owner-repair pattern` -> exit 0 (pass 4, fail 0, skip 0)
`node --test super-gsd/tools/codex-worker/worker.test.cjs` -> exit 0 (pass 39, fail 0, skip 2)
`node --test super-gsd/tests/codex-worker/usage.test.cjs` -> exit 0 (pass 21, fail 0, skip 0)
`node --test super-gsd/tests/codex-worker/permissions.test.cjs` -> exit 0 (pass 7, fail 0, skip 0)
`node --test super-gsd/tests/codex-worker/launch.test.cjs` -> exit 1 (pass 22, fail 3, skip 0)
`node --test super-gsd/tests/codex-worker/install.test.cjs` -> exit 1 (pass 0, fail 2, skip 0)
`npm run test:codex-worker` -> exit 1 (pass 95, fail 5, skip 2)
`git diff --check` -> exit 0
`git status --short` -> exit 0

DEVIATIONS: Added `--owner fable.fixture` to the existing receipt-persistence test, an orchestrator-approved compatibility repair for T1 owner scoping.

BLOCKERS: External baselines: launch expects plan `170-03` but receives `173-02`; two executor self-tests hit non-executable `codex-executor.sh`; two install tests expect `gpt-5.6-sol` but live profile is `gpt-5.6-terra`.

SCRIPTS_CREATED: none

ONE_LINER: T3 is implemented and focused coverage passes; `codex-executor.sh` hash remains `d6bdb14a…`.
