# P163 final follow-up — resync on tab return (root cause was Chrome tab freezing)

File ONLY: super-gsd/tools/fleet-cockpit/public/app.js (+ structural case).
Edits-first; do NOT commit.

## Root cause closure (orchestrator, live Chrome)

The browser-side "starvation" was Chrome FREEZING the hidden tab
(document.hidden=true): suspended tabs deliver no SSE messages and run no
timers; sync CDP evals wake them briefly. Server + page logic are correct —
the headless client case proves 78-309ms delta delivery. No further transport
fix needed.

## Fix

On visibilitychange to visible (and window focus): immediately (a) refresh
/api/fleet, (b) refresh the selected lane detail, (c) close and reopen the
codex EventSource so the reconnect resends the current tail — the user
returning to the tab sees a caught-up pane instantly instead of waiting for
the next delta. Debounce so rapid visibility flips do not stack reconnects.
Structural case asserts the visibilitychange handler exists and routes through
the production resync path.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 80 words.
