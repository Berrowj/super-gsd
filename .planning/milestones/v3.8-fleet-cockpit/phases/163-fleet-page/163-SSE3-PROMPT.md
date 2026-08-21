# P163 SSE debugging — page connection starves while curl connection streams

Files: super-gsd/tools/fleet-cockpit/{server.cjs,public/app.js,run-self-test.cjs}.
Edits-first; in-process listen allowed; do NOT commit.

## Evidence from a live Chrome session (orchestrator-observed)

1. Server-side push WORKS: a curl -N connection to
   /api/lane/<name>/codex-live/stream received the initial 16KB tail AND a
   subsequently appended delta (verified twice).
2. The PAGE's EventSource received ONLY the initial tail: pane pinned at
   exactly 16,380 chars; two later file appends never arrived; no failure
   banner observed.
3. The renderer FREEZES for 45s+ in correlation with EventSource activity:
   screenshots/CDP evaluate time out "renderer frozen"; constructing a second
   EventSource from the page console froze it hard. Between freezes the page
   is fully responsive (1ms evals).
4. Server cache rebuild is synchronous, build_ms_last ~2646ms every 20s
   interval (7 lanes); heartbeat is 15s; retry: 2000.

## Suspects to eliminate with a HEADLESS reproduction (mandatory method)

Write a node test client that speaks EventSource semantics over http.get
(long-lived, parses events, holds the socket exactly like Chrome: one
connection, no re-request), run it across: (a) 2+ cache rebuild cycles,
(b) multiple file appends, (c) concurrent /api/fleet fetches on the same
keep-alive host. Assert deltas arrive within 1s of each append. Then fix
whatever this exposes. Specific hypotheses:
- The synchronous ~2.6s adapter rebuild blocks the event loop; combined with
  socket backpressure or Nagle, pending SSE writes to SOME sockets never
  flush (res.write return value ignored; no drain handling).
- Chrome's 6-connection-per-host HTTP/1.1 limit interacting with keep-alive
  fetch + SSE: page fetches (5s fleet poll) + SSE + static requests could
  starve the SSE socket server-side if the server serializes on the blocked
  loop. Consider making the cache rebuild yield (setImmediate between lanes)
  so heartbeats/deltas flush during rebuilds — likely the REAL fix.
- Per-connection watcher lifecycle: ensure the watcher fires for EVERY open
  connection (shared watchFile listeners per file with fan-out, not one
  listener overwritten per new subscriber).
Also: cap renderer impact — the freeze pattern suggests the server stalls
mid-response on static/api requests during rebuild, leaving Chrome's main
frame waiting synchronously somewhere; the yield fix addresses this too.

Guard cases: the headless EventSource client scenario becomes a permanent case
(deltas-across-rebuilds); rebuild-yield asserted (no >500ms event-loop stall
during a rebuild — measurable with a setInterval lag probe in-process).

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 150 words.
