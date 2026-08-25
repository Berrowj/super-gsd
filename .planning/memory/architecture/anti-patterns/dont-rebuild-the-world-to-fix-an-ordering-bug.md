---
name: dont-rebuild-the-world-to-fix-an-ordering-bug
description: Bound executor scope explicitly; "fix the ordering" produced a 1458-line transactional installer that shipped nothing
metadata:
  type: anti-pattern
---

# Bound the executor's scope, or it will redesign the system

2026-08-25, P168. A spec review asked for one thing: run the rejection-capable checks
before the first write. The executor built an entire transactional installer sandbox
(`--prepare-installer-stage`, `--seal-installer-stage`, `--apply-installer-stage`,
`--discard-installer-stage`) with `install.sh` re-executing itself inside a staged copy.

1,458 lines across four dispatches, three of which were cut short. The end state:

- the stage snapshotted whole user roots, passing `--config-dir C:\Users\<user>\AppData\Roaming`,
  which is why it hit EBUSY on locked files, and would have been slow and invasive if it
  had succeeded;
- `install.sh` finally exited 0 while delivering nothing at all.

Reverted to the last commit where a real install delivered 17 hooks and 9 modules, then
re-dispatched with an explicit prohibition naming the reverted design. That succeeded in
one round.

**How to apply.**

- State the forbidden design by name when re-dispatching after a revert. "Do not rebuild
  X" is worth more than any amount of positive description.
- Give the executor the known-good baseline as a measured fact ("a real install currently
  delivers 17 hooks and 9 modules") and require it be re-checked first AND last.
- Prefer "move the checks, not the writes" phrasing; if a check genuinely cannot move,
  require the executor to say so rather than invent machinery.
- Revert early. Four partial dispatches compounding on each other is harder to reason
  about than one clean reset.

Related: [[mutate-then-refuse]], [[codex-dispatch-prompt-calibration]].
