---
name: first-dispatch-stop-rule
description: Check the executor's first diff against a forbidden-design list and the known-good smoke before letting it continue
metadata:
  type: anti-pattern
---

# Check the first diff, not the fourth

P168's MUDA audit named this as the single highest-value process change available, and the
evidence supports it: an explicitly bounded prompt (T1M) converted four failed rounds into
one success, using the same information available at round one.

Three separate dispatches in P168 ballooned past their brief and had to be reverted:
1,458 lines of transactional installer sandbox, then 1,141 lines of repair/publish
restructure. Both timed out mid-flight, and both left the installer in a state where it
either exited 0 delivering nothing or published and then refused.

**The rule.** After a dispatch's first substantial diff, before letting it continue or
committing anything, check:

- Does the diff introduce a forbidden design? For this repo that list includes any
  `*-installer-stage` mode, installer self-re-execution, and whole-user-root snapshots.
- Does the known-good smoke still pass? Here that is: a real
  `install.sh --init-project` from a decoy cwd into an empty project exits 0 and delivers
  17 hooks and 9 `scripts/lib` modules.
- Is the diff proportionate to the finding? A one-line ordering finding that produces 300+
  lines in one file is the signal, not the fix.

If any check fails, revert immediately and re-dispatch naming the forbidden design
explicitly. Do not patch forward: four partial dispatches compounding on each other are
harder to reason about than one clean reset.

**Bound the dispatch size too.** Repeated 2700s timeouts on the same file mean the task is
too big for one dispatch, not that the budget is too small.

Related: [[dont-rebuild-the-world-to-fix-an-ordering-bug]], [[mutate-then-refuse]],
[[codex-executor-auth-denied-false-positive]].
