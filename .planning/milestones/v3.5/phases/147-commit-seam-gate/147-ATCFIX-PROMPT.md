# P147 phase-ATC fix — trampoline must judge the COMMITTING worktree, not the installing one

<intent milestone="v3.5">
Always-On Orchestration — governance as runtime mechanism in all session modes.
</intent>

SDD implementer: fresh context, THIS FIX ONLY. Files:
`super-gsd/scripts/install-commit-gate.cjs`,
`super-gsd/hooks/sgsd-commit-gate.cjs`,
`super-gsd/tests/commit-gate/assert-real-commit-gate.cjs`. Nothing else.

## CRIT-1 — cross-worktree misattribution (this repo IS a linked worktree)
The hook file installs into the COMMON git dir, shared by every worktree. But
the generated trampoline hardcodes install-time `SGSD_REPO_ROOT` /
`SGSD_HOOK_SCRIPT` and `cd`s to that root before invoking the runtime. A
commit made in a SIBLING worktree is therefore evaluated against the
INSTALLING worktree's STATE/plans, and its shadow rows land in the wrong
repo's ledger — evidence misattribution at the seam the phase exists to
observe.

### Fix
- The trampoline must NOT hardcode or cd to a repo root. Git invokes
  pre-commit hooks with cwd at the committing worktree's top level (and
  GIT_PREFIX/`git rev-parse --show-toplevel` are available). Derive the
  TARGET root at RUNTIME from the hook's own cwd:
  `root="$(git rev-parse --show-toplevel 2>/dev/null)"` with fail-open (exit
  0 + loud stderr) if unavailable.
- Keep `SGSD_HOOK_SCRIPT` install-time-fixed (the CODE location is legitimately
  pinned), but pass the runtime root to the node hook (arg or env), and the
  node hook derives its SGSD root from THAT (then findSgsdRoot as today).
- A sibling worktree that is NOT an SGSD repo (or whose root has no
  .planning) → existing non-SGSD silence applies.
- Re-generate/refresh logic must update existing SGSD-marked hooks to the new
  trampoline shape (idempotent refresh).

## WARN-1 — unbounded per-commit diff buffering
`git diff --cached --binary` output is BUFFERED in memory for hashing on every
commit. Large/binary staged payloads make the always-on seam expensive.
### Fix
Stream the diff into the sha256 hash incrementally (spawn with piped stdout →
hash.update per chunk) with a max-bytes policy: past a sane cap (state it;
suggest 32MB), stop reading, mark `diff_sha256` as truncated-basis with a
distinct field/reason (e.g. `diff_hash_basis: "truncated_32mb"`), never fail
the commit for size alone.

## Verify (report exact exit codes)
1. `node --check` all three files.
2. NEW scenario (or extend installer-linked-worktree-warning): create a repo,
   `git worktree add` a sibling, install the gate ONCE (from the main), make
   an unbacked source commit IN THE SIBLING → the warn banner + shadow row
   must reference the SIBLING's root/ledger (assert the row exists in the
   sibling's .planning metrics — seed the sibling as an SGSD repo — and NOT
   in the main's).
3. Large-diff: stage a multi-MB generated file → commit succeeds, hash basis
   marked appropriately, time bounded (report the timing).
4. FULL suite still passes (sandbox git EPERM — say so; orchestrator re-runs
   host-side).
SURGICAL CONSTRAINT. <250-word report.
