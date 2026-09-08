---
phase: 170
plan: "170-06"
status: IN_PROGRESS
date: 2026-09-08
deployed: false
new_live_worker_attempts: 0
formal_phase_gates: NOT_CLAIMED
windows: OPEN_REQUIRED
---

# Native accounting and receiver transition execution evidence

The operator approved both this work and the paired Linux repair plan 170-05.
This report distinguishes source evidence, isolated tests and eventual live
acceptance. DEVCP still runs published `6b4581b`; no new deployment or live
attempt has occurred. The previous blocked 170-04 benchmark is preserved.

## Source choice and reviewed implementation boundaries

Native Codex 0.153.2 release source was inspected without a model turn:
`TokenUsageRecord`/`TokenUsage`, standalone rollout serializer, capture and
persistence, flush ordering, and upstream multiple-response/cold-resume tests.
The upstream tests were read, not run. The approved design contains primary
links and exact semantics; experimental raw notifications and cumulative thread
token updates are not the accounting source.

Independent read-only design/API review confirmed the selected approach:

- A pure source-accounting leaf shared by contract/intake/counters/health/audit.
- A new-source-only canonical response identity; historical source hashes stay
  byte-compatible. Payload-sensitive native spool filenames preserve conflicts.
- An exact returned-file, pre-turn EOF baseline with acknowledged thread/turn,
  bounded reader and sanitized retry state. No home scan or raw transcript copy.
- Immutable worker-only rollout authority, enforced at ingestion as well as
  routing. A source label in an HTTP body cannot grant private-spool authority.
- Content-free gaps at the registered global project/root, visible to the
  existing audit even if the normal spool is full.
- A separate owned, same-port receiver transition after installation and before
  updater project-pin publication. No old Fable/Codex pane restarts.

Concrete integration hazards recorded before source implementation: timeout
closes transport before the current `finally`; transport faults may already have
killed it; counters/health currently use pre-authority inputs; global audit does
not read project-local gap files; provider response reuse across project ledgers
needs an audit check; installed nested workers need the adjacent Atlas closure;
and an updater must survive replacement of its own script while running.

These are design checks, not passing implementation tests. At 21:29 UTC,
170-05's three source repairs are committed and independently reviewed through
`976f439`. Main's fresh final Atlas baseline is 58 PASS/0 FAIL/4 top-level skips
plus nested runtime 15 PASS/0 FAIL/1 opt-in skip. Native-accounting Task 1 is now
entering implementation; no other source implementation task is in flight.
No complete provider reconciliation or safe weekly totals are claimed from
the existing incomplete capture.
