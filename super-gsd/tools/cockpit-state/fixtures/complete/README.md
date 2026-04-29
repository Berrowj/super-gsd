# complete fixture

Synthetic `.planning/` tree where the milestone has finished
(`current_phase: complete` and a `run_completed` live event).

Scenario assertions:
- `now.action` contains `milestone-closed` (synthesised from `run_completed`)
- `objective.phase === "complete"` and `status === "complete"`
- `objective.milestone_status === "ALL-PHASES-CLOSED"`
- `blockers.count === 0`
