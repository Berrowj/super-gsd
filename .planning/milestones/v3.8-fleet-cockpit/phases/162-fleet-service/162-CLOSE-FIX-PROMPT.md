# P162 close-fix (sole round) — four review defects in one pass

Files: super-gsd/tools/fleet-cockpit/{status.cjs,fleet.cjs,server.cjs,
run-self-test.cjs} + fixtures as needed. Edits-first; no spawns except
in-process listen; do NOT commit.

Close-review CRITICALs, all confirmed at source:
1. LATER-RUN SEMANTICS: status.cjs presence-tests historical
   attention/checkpoint signals — a lane that ever had a failed gate or a
   checkpoint stays attention forever. Implement last-run ordering: a signal is
   cleared by a subsequent run_started/gate_passed per the handover's own rule
   ("checkpoint written with NO SUBSEQUENT run_started"). Add clearing fixtures
   both ways (stale signal cleared; live signal still fires).
2. FRAME COALESCING: the cache scheduler queues every tick while a cycle runs
   slow. Coalesce: if a build frame is in flight, overlapping ticks collapse to
   at most one pending rebuild. Test with overlapping frames.
3. REAL DEFAULT BIND: the default-bind case listens on port 0 only. Prove the
   real CLI default: spawn-free in-process invocation of the server's actual
   arg-parse + listen path binding 127.0.0.1:7777 (skip-if-port-busy with a
   loud named skip, never a fake pass).
4. ARTIFACTS FIELD: derivation reads artifacts.items; the adapter emits
   artifacts.phases. Map correctly; fixture updated to the adapter's real shape
   (verify against super-gsd/tools/cockpit-state/adapter.cjs output, not
   memory).

All existing cases stay green; adapter untouched.

Report: FILES_CHANGED / VERIFICATION (named cases) / DEVIATIONS / BLOCKERS /
ONE_LINER, max 150 words.
