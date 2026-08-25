# Execute P168-T2 ONLY. T1 is complete and spec-review PASS. Do not touch T1's behaviour.

Plan: .planning/milestones/v4.0-install-contract/phases/168-install-contract/168-01-PLAN-LOCKED.md
Implement task `P168-T2` exactly per its `input_contract` and
`semantic_acceptance_criteria`.

## T1 is finished and verified. Do not modify it.

Real `install.sh --init-project` from a decoy cwd into an empty project exits 0 and
delivers 17 hooks and 9 `scripts/lib` modules. Guard 13/13, install-contract 3/3.
Spec review PASS: ordering, laundering, truncation and the recovery exemption all closed.
If your change breaks any of that, it is wrong.

## What T2 delivers

1. `formatProjectInstallStatus`, consuming T1's `inspectProjectInstall` report. It must
   NOT recompute hook or module state; consume the report. Name every missing or stale
   hook and module with normalised path and expected/actual SHA-256, summarise the current
   rows, and print the canonical source revision.

2. One operator command: `bash super-gsd/install.sh --doctor --project-dir PATH`.

3. **`--doctor` is strictly read-only.** It must not call `applyProjectInstall`, npm, the
   settings merge, key provisioning, broker or grant repair, or any other writer. Assert
   this: run doctor against a fixture, snapshot every file by sha256 before and after, and
   require byte-identity. A read-only claim that is not asserted is not a guarantee.

4. **Fix the worktree-blind freshness check.** `install.sh` guards it with
   `[ -d "$PROJECT_DIR/.git" ]`. In a git worktree `.git` is a FILE containing a gitdir
   pointer, so the guard is false, the whole block is skipped including the `git ls-remote`
   comparison against master, and the doctor reports "Project git HEAD: not a git repo".
   This repository is itself a worktree, so the bug is reproducible here: run
   `bash super-gsd/install.sh --doctor` and you will see it.

   Detect a repository whether `.git` is a directory or a file. Add a case asserting the
   freshness comparison runs in BOTH shapes; without it this silently regresses.

## Constraints

- Only the three allowlisted files.
- Never weaken or delete an assertion.
- No new installer staging, no self re-execution. That design was built earlier, shipped
  an install that exited 0 delivering nothing, and was reverted.
- Refuse-before-write stays literal; doctor writes nothing at all.
- P167 witness contract untouchable.
- Fixture paths contain SPACES.

## Verify

- `bash super-gsd/install.sh --doctor` in THIS repository reports a real git HEAD and a
  freshness comparison, not "not a git repo".
- `bash super-gsd/install.sh --doctor --project-dir <fixture>` is byte-identical before
  and after.
- install-contract suite, all cases including yours.
- installer-registration-guard `--all` 13/13.
- Real install still exits 0 and delivers 17 hooks and 9 modules. Check FIRST and LAST.
- `bash -n super-gsd/install.sh`, `node --check` on every file modified.

Sandbox denials: mark DENIED, never as passing. The orchestrator re-runs unsandboxed.
Do not ask for approval; implement and verify.

Standard block format, max 300 words.
