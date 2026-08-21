# P163 SSE upgrade — the codex pane must be a TRUE live stream (operator directive)

Files: super-gsd/tools/fleet-cockpit/{server.cjs,public/app.js,run-self-test.cjs}.
Edits-first; in-process listen allowed; do NOT commit. Constraints unchanged
(node: builtins only — SSE needs nothing else; read-only).

The operator explicitly rejected refresh/polling for the codex pane: "literally
a live stream". Replace the pane's 3s poll with Server-Sent Events push:

1. GET /api/lane/:name/codex-live/stream — Content-Type: text/event-stream,
   no-cache, connection held open. On connect: send the current tail (last
   16KB) as an initial event. Then fs.watch (with fs.watchFile fallback for
   Windows edge cases) on the lane's codex-executor-live.txt /
   codex-live-output.txt; on growth, push ONLY the appended bytes as events
   (track offset; handle truncation/rotation by resending tail). Heartbeat
   comment every 15s so proxies keep the socket. Client disconnect cleans the
   watcher. Multiple concurrent subscribers safe. Absent file: send a
   {present:false} event and keep watching for creation.
2. app.js: EventSource on lane selection (close previous on lane switch);
   append pushed chunks to the pane with autoscroll pinned to tail unless the
   operator has scrolled up; connection-state indicator (live dot when open,
   reconnect note when EventSource retries). Remove the poll for this pane.
   The 5s /api/fleet rail poll stays (that one is fine).
3. Guard cases: sse-stream contract in-process (connect => initial tail event;
   append to the file => pushed delta arrives; disconnect => watcher freed;
   absent-file => present:false then creation push). All existing cases green.

Report: FILES_CHANGED / VERIFICATION / DEVIATIONS / BLOCKERS / ONE_LINER, max 120 words.
