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
emergency_halt: false
approaches_tried_and_abandoned: []
rules_learned_this_session: []
dispatches_summary:
  total: 0
  by_agent:
    executor: 0
    verifier: 0
    planner: 0
    researcher: 0
    classifier: 0
    code_reviewer: 0
  by_outcome:
    pass: 0
    fail: 0
    warn: 0
    blocker: 0
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
