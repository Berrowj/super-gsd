FINDINGS: 0
CRITICAL: 0
WARNINGS: 0
PASS_RATE: 21/21
ONE_LINER: CRIT-1 is CLOSED; runtime target-root derivation now points sibling-worktree evidence at the committing worktree.
FINDINGS_DETAIL: [PASS] [CRIT-1] The trampoline derives `SGSD_TARGET_REPO_ROOT` with `git rev-parse --show-toplevel`, exports it as `SGSD_COMMIT_GATE_TARGET_ROOT`, and no longer `cd`s to an install-time root: `super-gsd/scripts/install-commit-gate.cjs:252`, `:257`, `:269`.
FINDINGS_DETAIL: [PASS] [runtime-root] The node hook consumes `SGSD_COMMIT_GATE_TARGET_ROOT || process.cwd()` through `findSgsdRoot`, then evaluates and appends rows against that resolved root: `super-gsd/hooks/sgsd-commit-gate.cjs:821`, `:823`, `:833`.
FINDINGS_DETAIL: [PASS] [env-abuse] Commit-time attacker-set `SGSD_COMMIT_GATE_TARGET_ROOT` is overwritten by the managed trampoline before node starts. Direct node invocation could choose another SGSD root, but `appendShadowRow` re-resolves the SGSD root and writes only the fixed contained ledger path, so this is not an arbitrary path-write issue.
FINDINGS_DETAIL: [PASS] [old-hook-refresh] SGSD-marked old-shape hooks refresh idempotently: marked content is accepted, exact desired content no-ops, and stale marked content is rewritten: `super-gsd/scripts/install-commit-gate.cjs:373`, `:377`, `:387`.
FINDINGS_DETAIL: [PASS] [buffering] Prior WARN is closed: staged diff hashing is streamed with a 32 MiB cap and records `diff_hash_truncated_32mb` instead of buffering the full diff: `super-gsd/hooks/sgsd-commit-gate.cjs:163`, `:180`, `:213`, `:221`.
