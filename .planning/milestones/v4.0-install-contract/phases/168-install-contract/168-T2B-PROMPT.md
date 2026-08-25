# One HIGH finding on T2. Everything else MET. Bounded fix.

Confirmed MET by the reviewer, do not disturb:
- doctor is genuinely read-only, no reachable writer on any path
- `formatProjectInstallStatus` consumes the report, no recomputation
- worktree detection is correct and complete: `.git` directory, linked-worktree file, and
  submodule-style gitdir pointer all handled; non-git directories report cleanly; remote
  unavailability is not conflated with "not a repository"
- no T1 regression

## HIGH — exit-code contract incomplete, verbatim

> With explicit `--project-dir`, argument parsing invokes `node` before `doctor()`
> (install.sh:1211-1217). If Node is unavailable, `set -e` (install.sh:7) exits 127, never
> reaching doctor's intended status 2 path (install.sh:356-375). Tests assert 0 and 10,
> but never 2; the writer-conflict test asserts only nonzero, not the coherent usage-error
> code 1 (assert-install-contract.cjs:539-554, 577-583).

## Fix

1. The promised exit-code set must hold on the explicit-project path too. Node being
   unavailable is exactly the inability doctor's status 2 exists to report, so it must not
   escape as 127 from argument parsing. Either resolve `--project-dir` without requiring
   Node, or detect the inability before parsing needs it and take the status-2 path
   deliberately. Do not suppress `set -e` globally to achieve this.

2. Assert status 2. A promised exit code with no test is not a contract. Drive it by
   making Node genuinely unavailable to the installer for that case, for example via PATH,
   rather than by stubbing an internal.

3. Assert the writer-conflict refusal is the specific usage-error code, not merely
   nonzero.

State in your report the full exit-code table as implemented, with the file:line where
each is produced and the test that asserts it. If any code cannot be reached in practice,
say so rather than leaving it documented but dead.

## Constraints

- Only the two allowlisted files.
- Never weaken or delete an assertion.
- Doctor stays strictly read-only.
- No installer staging, no self re-execution.
- P167 witness contract untouchable.
- Fixture paths contain SPACES.

## Verify

- install-contract suite, all cases including yours
- installer-registration-guard `--all` 13/13
- Real install from a decoy cwd into an empty project: exit 0, 17 hooks, 9 modules.
  Check FIRST and LAST.
- `bash super-gsd/install.sh --doctor` in this repository still reports a real HEAD and a
  freshness comparison
- `bash -n super-gsd/install.sh`, `node --check` on every file modified

Sandbox denials: mark DENIED, never as passing. The orchestrator re-runs unsandboxed.
Do not ask for approval.

Standard block format, max 250 words.
