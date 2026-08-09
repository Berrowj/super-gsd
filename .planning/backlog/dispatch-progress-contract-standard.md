---
created: 2026-08-09
source: operator instruction during v3.5 P150 execution
priority: high
target: first phase after v3.5 close (chore-sized; candidate 150.5 or v3.6 opener)
---

# Standardize dispatch progress contract across all SGSD instances

Operator instruction (2026-08-09, verbatim intent): the dispatch
progress-contract + quiescence-watcher pattern proven during P150 must be
STANDARD across all SGSD instances, pushed to git once this milestone is done.

## What ships (all in tracked super-gsd substrate, so devcp gets it via FF)

1. **codex-executor.sh (and codex-exec.sh for long steps): mechanically append
   the PROGRESS CONTRACT block to every prompt file** before dispatch — do not
   rely on orchestrator prose discipline. Contract: codex appends
   `<plan>|<utc>|started/edits-done/verifying/reporting/done` stage lines to
   `.planning/metrics/dispatch-progress.txt`, and is instructed: if running
   short on time, skip polish, write the report EARLY and mark done — a
   partial report beats a timeout kill.
2. **super-gsd/scripts/sgsd-dispatch-watch.sh**: the quiescence watcher as a
   reusable script (tail live-output byte growth; alert at 2-min silence,
   escalate at 6; also surface stage lines from dispatch-progress.txt). Usable
   by orchestrator Monitors and by the cockpit.
3. **sgsd-orchestrate SKILL.md**: dispatch steps reference the contract as the
   standard (wrapper-enforced; SKILL documents, doesn't duplicate).
4. **Self-test**: wrapper self-tests assert the contract block is appended and
   a fixture dispatch produces stage lines.

## Evidence base

- Curated pattern: .planning/memory/architecture/patterns/codex-dispatch-progress-contract.md
- v3.5 P149/P150 ran ~15 executor dispatches; majority hit the 1200s wrapper
  timeout with report_bytes=0, each costing an orchestrator salvage round.
  Stage markers turn those into instant precise salvage.
