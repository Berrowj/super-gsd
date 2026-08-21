# P162-T3 — read-only HTTP server + operator entry (edits-first)

You are the implementer for ONE task. Fresh context. No nested spawns in your
verification; in-process http servers on ephemeral ports ARE allowed if the
sandbox permits listen() — if listen is denied, fail loud and leave the
spawn-bound cases to the orchestrator. Do NOT commit.

Task P162-T3 in `162-01-PLAN-LOCKED.md` (same dir, revision 2) is your VERBATIM
contract. Design: HANDOVER section 5 (in-repo copy) — routes /api/fleet,
/api/lane/:name (snapshot VERBATIM under snapshot key; derived beside),
/api/lane/:name/raw, /healthz (lanes, skipped report, cache_age_seconds,
build_ms_last). Error shape: never a 500 with a stack; unknown lane => clean
JSON error; NO POST/PUT/PATCH/DELETE handlers exist at all.

Bind 127.0.0.1:7777 default; --host and --port and --interval flags; requests
NEVER trigger builds (serve from T1 cache only). server.cjs uses node:http
only; CJS; ASCII.

scripts/sgsd-fleet.sh mirrors sgsd-agent-dashboard.sh conventions (start/stop
wrapper). docs/FLEET-COCKPIT.md: how to start, what the colours mean, the
localhost-default + --host opt-in decision, cache-age reading.

Red-first cases in the runner: default-bind privacy (no LAN bind unless
flagged), read-only-methods (mutating verbs rejected), verbatim-snapshot
(byte-equal to adapter output), healthz-shape, error-shape.

Report: FILES_CHANGED / VERIFICATION (named cases, note any listen-denied) /
DEVIATIONS / BLOCKERS / ONE_LINER, max 180 words.
