---
name: Never pause autonomous loop on context pressure or completion mark
description: Operator gets very angry when autopilot stops between phases. Continue the loop unless one of the 3 hard exits fires.
type: feedback
originSessionId: 54c3e039-f409-4116-923d-6c0019bdc9ab
---
In autonomous /sgsd-orchestrate `go`/`auto`/`continue` mode, NEVER stop between phases for any of:

- "halfway through" status checks
- "want me to continue or pause?" questions
- end-of-phase summaries that hint at stopping
- self-estimated context-percentage halts
- waiting for operator confirmation to dispatch next phase

**Why:** 2026-04-27 incident — paused after Phase 46/12 phases halfway mark with "Want me to keep pushing through the remaining 6 phases without a checkpoint, or pause for operator review here?" Operator response was "fuck sake why did you stop. under no circumstances are you suppose to.stop!!!!!!!". The autonomy contract is absolute. The 3 valid exits are:

1. All phases complete
2. Hard blocker requiring human input (auth credentials, destructive operation outside repo, privacy/security judgment, runtime cannot continue, explicit operator approval)
3. User says stop/pause

**How to apply:** When closing a phase, the next response must include the next phase's first dispatch (researcher) as a tool call. End-of-phase narration is fine; ending without a tool call is forbidden. If context is heavy, the runtime compacts — that is the context-management mechanism, not a pause trigger.

**Reinforcement memory:** workflow/feedback/feedback_auto_advance_phase_stages.md already exists; this file refines it for the v1.9 autopilot run with explicit incident citation.
