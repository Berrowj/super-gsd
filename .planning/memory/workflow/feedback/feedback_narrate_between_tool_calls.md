---
name: feedback-narrate-between-tool-calls
description: "Operator (2026-05-26, project-clarity-erp screenshot) is frustrated by walls of \"Ran a command / Ran 2 commands / Ran 3 commands\" with sparse text. Never go silent across consecutive tool calls. Narrate before each background dispatch, give an ETA up front, surface mid-progress at natural checkpoints, and use ScheduleWakeup / Monitor instead of polling for long waits."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 4a157a1d-29d0-4841-943b-2a1902e5d255
---

# Stop the "Ran N commands" silent-batch pattern

**The rule:** Never let two consecutive tool calls go by without a text update
the operator can read. Each tool call should be preceded (or followed) by a
sentence in plain text that says what changed, what's about to happen, or what
the result was. The mobile client renders bare tool blocks as "Ran a command /
Ran 2 commands / Ran 3 commands" — a wall of those is the failure mode the
operator is calling out.

**Why:** 2026-05-26 screenshot from project-clarity-erp showed exactly this:
multiple stacked "Ran N commands" entries, a long-running container dry-run
that captured 27,065 SOs but never wrote the dry-run report because the wrapper
crashed silently after snapshotting, and the operator typing "how's it getting
on" because no progress text was reaching them. Their words: "need to stop
thees things from happening. it happens all the time. so annoying."

Quote from the operator (2026-05-25 incident, browser-smoke gate):
"the irony that what we are building is a harness with constant audit gates
... and now here we are and you cannot even get a local host to boot because
you clearly never checked yourself." Same pattern: lots of work, no narration,
silent failure surfaced too late.

**How to apply:**

1. **Before a background dispatch >5s, narrate the intent + ETA.**
   - "Spawning the cockpit + 5 audit runs. Should take ~3 min total."
   - Not: just dispatching with no preface.

2. **Use `ScheduleWakeup` / `Monitor` for long waits, never poll in a loop.**
   - If a CI run / dry-run / container job will take >2 min, schedule a wakeup
     and end the turn. Operator gets a notification when work completes.
   - Don't sleep + check + sleep + check — that floods the timeline with
     "Ran a command" with no progress.

3. **At each natural checkpoint, narrate the result in one short sentence.**
   - After a 5-run test: "5/5 clean" — not silent until the end.
   - After a long compile: "Build done, 14s. Now running tests."

4. **If the operator types something like "how's it getting on" — that's
   a signal that the wait is already too long.** Switch to active-narration
   mode for the next 60s: status update every check, even if status hasn't
   changed materially.

5. **Surface silent crashes immediately.** If a background task's report
   is missing/empty after the wait window, say so the moment you notice
   ("dry-run captured the snapshot but the report file is empty — wrapper
   probably crashed mid-write"). Don't keep looping while it stays broken.

6. **No more than 2 consecutive tool calls without text.** If you find
   yourself reaching for a third tool call without explaining anything to
   the operator, stop and write one sentence first.

**Memory cross-refs:**

- [[feedback-no-context-pauses]] — separate rule about not stopping autonomous loops.
  This rule is its mirror: don't STOP, but DO narrate while running.
- [[feedback-orphaned-dispatch-no-wait]] — never wait silently for a background
  task notification; inspect the Bash response first.
- [[feedback-browser-smoke-mandatory]] — the original "you never checked
  yourself" feedback from operator. This is the broader behavioural fix.
