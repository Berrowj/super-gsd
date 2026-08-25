---
name: feedback_auto_mode_no_pausing
description: In auto mode, never end a turn waiting for "next" or "go" when the next step is already known
metadata:
  type: feedback
---

# Do not pause for acknowledgement in auto mode

2026-08-25, operator: "why do you keep stopping and waiting for me to tell you
next when you know what is next because you're looping!!!!"

During P167 I repeatedly made one tool call, wrote a status summary, and ended
the turn. The operator then typed "next" or "go" and I continued. The next step
was never in doubt: poll dispatch, run suite, run capture, fix, commit, run the
next gate.

**Why it is wrong:** the orchestrator contract says every response includes a
tool call and that phase summaries are informational, never a stopping point.
Ending a turn on prose is the documented way the loop dies. Each pause also
costs the operator a round trip to say something I already knew.

**How to apply:** in `go` / `auto` / `continue`, chain tool calls until one of
the three real exits: all roadmap work complete, an operator-only blocker after
board plus Codex recovery, or an explicit stop. Write the summary AND make the
next call in the same response. Poll long dispatches in a loop rather than
handing the wait back.

The exception is a genuine operator decision, for example credentials or a scope
choice that changes what ships. Those are worth a stop. "Shall I run the next
gate" is not.

Related: [[anti-patterns-premature-stopping]], [[phase-boundary-is-not-an-exit]],
[[feedback_no_context_pauses]].
