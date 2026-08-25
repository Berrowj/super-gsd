# Spec-compliance review of P168-T2. Read-only. Judge raw artifacts, not the executor report.

Plan: .../168-install-contract/168-01-PLAN-LOCKED.md, task `P168-T2` only.
Diff: `git show fc30be7`. T1 was reviewed separately and returned PASS; do not re-review it
except to confirm T2 did not regress it.

Orchestrator-run, take as given, do not re-run:
install-contract 4/4 (including `doctor-real-git-worktree-staleness`),
installer-registration-guard 13/13, a real `install.sh --init-project` from a decoy cwd
into an empty project exits 0 delivering 17 hooks and 9 `scripts/lib` modules,
assert-hook-contract 38/38, assert-prompt-contracts 4/4, assert-witness-correlation 13/13,
assert-propagation PASS, P166 6/6, P154 PASS, composer/enrichment-gate/kb-triage-shadow
PASS, feature-propagation 15/15, `bash -n` clean.

Judge each P168-T2 `semantic_acceptance_criteria` entry MET or NOT MET with a file:line
citation. Then judge these specifically:

1. **Is `--doctor` genuinely read-only on every path?** The plan forbids it calling
   `applyProjectInstall`, npm, the settings merge, key provisioning, or broker/grant
   repair. Trace the actual call graph, do not trust the byte-identity test alone: a test
   fixture may not exercise a branch that writes. Name any reachable writer.

2. **Does `formatProjectInstallStatus` recompute state?** The contract says consume T1's
   `inspectProjectInstall` report. Recomputation would reintroduce the drift this phase
   exists to remove.

3. **Is the worktree detection correct and complete?** It replaced
   `[ -d "$PROJECT_DIR/.git" ]`. Check it handles: `.git` as a directory, `.git` as a
   worktree file, a submodule-style gitdir pointer, and a genuinely non-git directory,
   which must still report cleanly rather than erroring. Confirm the remote-unavailable
   case is distinguished from "not a repository", because conflating them is how the
   original bug hid.

4. **Exit codes.** The executor claims 0/10/2 and a refusal when doctor is combined with a
   writer action. Are those coherent and asserted?

5. **Regression.** Did T2 change any T1 behaviour: delivery, the closure, refuse-before-
   write ordering, the classifier, or the truncation fail-closed rule?

Report findings by severity with file:line. End with exactly
`SPEC VERDICT: PASS` or `SPEC VERDICT: FAIL`. A NOT MET criterion forces FAIL.
Bound yourself to about 18 shell commands. Max 500 words.

## ROUND 2 — one finding only

Round 1 returned FAIL on exactly one HIGH and marked everything else MET: doctor is
genuinely read-only with no reachable writer, the formatter does not recompute, worktree
detection is correct and complete, and there is no T1 regression. Re-confirm each in one
line and do not reopen them.

The open item was:

> With explicit `--project-dir`, argument parsing invokes `node` before `doctor()`
> (install.sh:1211-1217). If Node is unavailable, `set -e` exits 127, never reaching
> doctor's status 2 path. Tests assert 0 and 10 but never 2; the writer-conflict test
> asserts only nonzero, not the coherent usage-error code 1.

The fix defers explicit-project normalisation until after argument and conflict
validation, adds a PATH-based node-unavailable case using space-bearing paths, and
tightens the conflict assertion to exactly 1. Claimed contract: 0 current, 10 drift,
2 inability, 1 usage conflict, all reachable and asserted.

Judge only:

1. Is every one of 0/10/2/1 genuinely reachable, and is each asserted by a test that
   would fail if the code changed?
2. Does deferring normalisation introduce any path where an invalid or hostile
   `--project-dir` is acted on before validation?
3. Is `set -e` still enabled, and is doctor still strictly read-only after the reorder?

Orchestrator-run, take as given: install-contract 5/5, installer-registration-guard 13/13,
real install exits 0 delivering 17 hooks and 9 modules, doctor in this worktree reports a
real HEAD and a freshness comparison, `bash -n` clean.

Verdict line unchanged. Bound yourself to about 12 shell commands. Max 350 words.
