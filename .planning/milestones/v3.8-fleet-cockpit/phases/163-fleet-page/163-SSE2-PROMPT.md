# P163 SSE follow-up — stream opened during load pins the tab in loading forever

File ONLY: super-gsd/tools/fleet-cockpit/public/app.js (+ run-self-test.cjs
structural case). Edits-first; do NOT commit.

## Live evidence (real browser)

Deep-linking #/lane/<name> opens the EventSource during initial page load, so
the document NEVER reaches idle: the tab spinner spins indefinitely and
automation waiting for document_idle times out after 45s. Server-side stream is
verified correct via curl (offset-tracked deltas, retry, heartbeat).

## Fix

1. Defer ALL EventSource opening (and any long-poll style fetches) until after
   the window 'load' event has fired: if load has not fired yet, queue the
   openCodexLiveStream call and run it from a load listener + setTimeout(0).
   Lane selection before load renders from cached data; the stream attaches
   the moment load completes.
2. Also cap the codex pane buffer client-side (keep last ~64KB of textContent;
   trim from the front when exceeded) so an all-day stream cannot grow the DOM
   text node unboundedly.
3. Structural case: assert app.js gates EventSource construction on
   document.readyState/load (source assertion), and the trim constant exists
   and is applied in the append path.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 100 words.
