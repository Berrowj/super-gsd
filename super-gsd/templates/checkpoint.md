---
created_at: "{ISO timestamp}"
active_milestone: "{version}"
active_phase: {NN}
last_completed: "plan {NN-PP}"
next_unit: "plan {NN-PP}"
phase_state: "{researching|planning|executing|verifying}"
units_this_session: {N}
estimated_tokens_used: {N}
model_breakdown:
  opus: {N}
  sonnet: {N}
  haiku: {N}
context_percent_at_write: {N}
resume_instruction: "Enter loop at next_unit without re-briefing user"
---

## Completed This Session
- plan {NN-PP}: {ONE_LINER}

## Next Action
{Exact next step — what agent to dispatch with what prompt}

## Remaining Work
- {remaining plans in current phase}
- {remaining phases in milestone}

## Learnings Curated
- {patterns/decisions curated to ByteRover this session}
