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

## Task 1 in progress: failing-first native accounting checks

Implementer reported the initial native Linux RED run: 0 PASS / 7 FAIL /
0 SKIP, before production edits. Assertions exposed the missing projector,
ignored accounting-source registration, old session/collector-based native
hashing and rejection of genuine native envelopes. Fixtures follow the retained
0.153.2 standalone record shape and deliberately separate per-response usage
from much larger cumulative totals. Expanded reader/intake tests are still in
progress; no GREEN or review verdict is claimed yet. No provider calls occurred.

Main independently ran the unchanged Linux updater contract suite as a Task 3
baseline: 13 PASS / 0 FAIL / 0 SKIP in 10.868 seconds. Its temporary repositories
exercise existing trust, captured-revision, clean-source, installer-failure and
project-pin safeguards. This is not evidence of a receiver transition, which
is not implemented yet.

At 21:48 UTC the implementer reported the first GREEN slice: usage, canonical
store and global tests 39 PASS / 0 FAIL / 0 SKIP on native Linux. The intake,
source-authority, accepted-health and audit slice is still being implemented.
Main's preliminary read also requested tests for capture/expected-project
binding and content-free registration-failure gaps at a verified existing global
root. Final independent specification/quality reviews and root verification
remain pending; this partial GREEN is not task completion.

Second TDD slice: 8 selected native Linux checks produced 2 PASS / 6 FAIL /
0 SKIP before the corresponding fixes. Expected failures cover the verified-root
fallback gap, response-aware audit, cross-project native response reuse, direct
source self-authorization, native private-spool intake and prepare flag wiring.
The shared eligibility/intake implementation follows this RED evidence.

The implementer's second GREEN run passed usage/store/global/receiver/audit:
69 PASS / 0 FAIL / 0 SKIP on native Linux. Before final review, main flagged two
concrete boundedness cases. New RED checks reproduced both: an identical native
event already queued returned false when the spool was full; permanent native
scope rejections rose from 3 to 12 over repeated polls. Two other added
strict-schema/bounded-index checks passed. Fixes and the full suite remain in
progress; transient storage failures must still retry without dropping files.

First full Atlas attempt: 68 PASS / 1 FAIL / 4 top-level SKIP, nested runtime
15 PASS / 0 FAIL / 1 SKIP. The unchanged installed-layout fixture failed before
checking the installer's exit. A read-only isolated diagnostic captured the real
cause: installer exit 2, empty stdout, stderr `hook manifest dependencies stale:
hooks/sgsd-statusline.js`. This is the existing dependency guard correctly
detecting the new quota-sampler/contract dependency, not a bypass candidate.

Main advanced only its generated manifest prerequisite from Task 2 into the
active Task 1 plan. In-memory graph/render inspection reports exactly one added
dependency, `tools/telemetry-atlas/accounting.cjs`, for the status-line hook;
no hook hash, other entry or installer change. The established generator and
unchanged manifest/install checks will be used. The other Task 2 closure work
remains deferred until Task 1 review/commit.

## Frozen Task 1 verification (reviews pending)

After the two edge fixes and generated witness refresh, the implementer ran the
focused native Linux usage/store/global/receiver/audit suites: 73 PASS / 0 FAIL /
0 SKIP in 4.196 seconds. Full unchanged Atlas: 69 PASS / 0 FAIL / 4 top-level
SKIP in 85.489 seconds; nested runtime 15 PASS / 0 FAIL / 1 SKIP. The real
empty-tree global install passed in 77.887 seconds. Manifest check and diff
check passed. Source was frozen for independent specification then quality review.

Main independently verified the frozen source on native Linux:

- Native usage reader: 16 PASS / 0 FAIL / 0 SKIP in 0.687 seconds.
- Full Atlas: 69 PASS / 0 FAIL / 4 top-level SKIP in 68.332 seconds, including
  the unchanged real global-install test in 61.984 seconds.
- Nested runtime: 15 PASS / 0 FAIL / 1 SKIP; quota recorder p95 0.700 ms.
- Existing skip reasons: three PowerShell-host cases and the opt-in pinned
  Linux binary installation at top level; the opt-in real stack lifecycle in
  the nested runner. These are not Windows acceptance evidence.

Task 1 reviews/commit are still pending. Task 2 adapter lifecycle/nested install
delivery, Task 3 receiver transition/updater and the approved publication/live
benchmark remain unimplemented or unrun. New live wrapper attempts remain zero.

Independent specification review: PASS against `361fd58`, covering all 13
task-owned paths and the retained official 0.153.2 record definitions. The
reviewer independently checked byte-compatible hashes for four historical
source kinds, native response semantics, OTEL suppression and a clean diff.
No Task 1 omissions found. Independent quality review is now in progress;
no source edits have occurred since main's passing verification.

## Read-only preparation for Task 2

While quality review ran, main exercised the existing startup deadline with an
isolated native Linux fake peer that never answered initialization. No provider
or source edits were involved. The one-second bound terminated it in 1.005 s,
but `run()` rejected with `app_server_closed`, not `worker_timeout`: the timer's
transport close masks its timeout cause while an RPC is awaited. This is a
reproduced Task 2 lifecycle test requirement, not an accounting Task 1 defect.
The plan now explicitly requires pre-ACK timeout classification as well as
bounded capture/cleanup. Temporary fixture data was removed after the check.

## Task 1 review outcome

Independent quality review: PASS, ready for integration with no actionable
findings. The reviewer read the full scoped source/diff/tests, independently
ran native Linux usage/store/global/audit (57 PASS / 0 FAIL / 0 SKIP in 1.735 s)
and confirmed the clean diff. Source remained unchanged after main's passing
verification. Both SPEC and QUALITY passed; Task 1 is ready for its local
commit. No publication, DEVCP transition or live acceptance is implied.
