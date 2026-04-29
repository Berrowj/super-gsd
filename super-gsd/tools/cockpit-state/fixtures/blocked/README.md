# blocked fixture

Synthetic `.planning/` tree where the orchestrator paused awaiting operator
attention (missing API key). Both an `operator_attention_required` event and
a STATE.md `milestone_status` containing the keyword "awaiting" produce
blocker rows.

Scenario assertions:
- `blockers.count === 2` (one from live event, one from STATE.md heuristic)
- `resume_command.next_unit` contains `OPENAI_API_KEY` (from checkpoint_written)
- `resume_command.reason === "provider_unavailable"`
