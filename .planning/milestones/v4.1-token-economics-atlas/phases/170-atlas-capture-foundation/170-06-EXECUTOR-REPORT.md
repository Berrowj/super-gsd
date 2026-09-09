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

Task 1 committed locally as `472814a` after both reviews and main verification.
The only remaining untracked path immediately after commit was the user's
`.planning/tmp/`, preserved untouched. Task 2 adapter lifecycle, Linux wrapper
authority and nested installed runtime closure implementation is now active.

## Task 2 RED and initial GREEN

The implementer first ran the actual adapter against the native-shaped fake
provider on Linux: 0 PASS / 2 FAIL. A valid worker report produced zero durable
response observations instead of two; a hanging initialization returned
`app_server_closed`/1 rather than `worker_timeout`/124. Additional lifecycle
checks were 0 PASS / 5 FAIL, including deterministic instrumentation of actual
capture finalization versus actual transport close. The timeout path observed
`[rpc.close, rpc.close]`, so periodic sampling cannot mask that missing ordering.

The real empty-tree installed-layout RED also failed: the nested worker's new
usage module could not resolve `../telemetry-atlas/contract.cjs`. Tests exercised
the installed modules without source-tree or host-global fallback.

After the first lifecycle/closure implementation slice, the implementer's full
worker protocol suite passed 26 / 0 FAIL / 2 expected SKIP in 30.996 s. This
includes all three pre-ACK deadline stages, capture before first timeout close,
early/final-flush/cold-resume responses and completed responses before later
failure/interruption/transport death. The installed closure GREEN and full
integration suites are still running; independent reviews and main verification
remain pending. No provider calls or new live wrapper attempts occurred.

## Read-only Task 3 deployment-path evidence

At 22:38 UTC main read the existing DEVCP global service record and its exact
Linux process identity, without signalling it or changing remote files. PID
1293367/start-time 41355996 is running native Node 24.15.0 with the canonical
source entry `/home/jackberrow/.claude/super-gsd/source/super-gsd/tools/telemetry-atlas/global.cjs`,
`serve`, the exact registered global root and its original startup token.
This is not the flat installed entry. The three URLs remain ingest 44797,
health 43811 and metrics 36943; the legacy record has no loaded fingerprint.

Task 3 must account for this exact trusted source entry when proving legacy
ownership; a comparison only to the newly invoked installed CLI path would
incorrectly block this deployment. A basename-only or arbitrary-path adoption
would not satisfy the approved ownership contract. Old loaded revision remains
unknown, even after the source files on disk are updated.

## Task 2 frozen integration verification

The actual empty-tree install GREEN passed 1/1 in 99.955 s, including loading
both installed worker/Atlas closures without source/global fallback and a normal
installed wrapper capturing two native-shaped fake responses through the real
private spool and receiver ledger. This remains fake-provider evidence.

The implementer's final native Linux checks on the frozen Task 2 source:

- Full worker: 79 PASS / 0 FAIL / 2 SKIP in 90.852 s. Skips are Windows-only
  transient rename and opt-in local Codex initialization (no provider turn).
- Board and model-routing: 16 PASS / 0 FAIL / 0 SKIP in 9.418 s.
- Full Atlas: 69 PASS / 0 FAIL / 4 top-level SKIP in 76.259 s; nested runtime
  15 PASS / 0 FAIL / 1 SKIP. Top skips are three Windows/PowerShell launch cases
  and opt-in real pinned-binary installation; nested skip is real installed stack.
- Existing hook-manifest check is current, with no generated change needed.
  `git diff --check` passes.

Independent SPEC review is in progress; QUALITY and main verification follow.
Twelve Task 2 source/test/doc paths changed; Task 1 accounting source and Task 3
receiver/updater source remain untouched. No publication, remote mutation or
new live wrapper attempts have occurred.

## Task 2 first SPEC review: FAIL, teardown race confirmed

The reviewer deterministically exercised actual `run.cjs`, `rpc.cjs` and
`usage.cjs` with a bounded in-memory provider transport: one stdout chunk
contained a valid turn/start ACK immediately followed by malformed JSON. The
RPC fault finalized capture before the awaiting ACK continuation resumed. That
continuation then created the 250 ms polling interval; the idempotency guard
returned before clearing it during final teardown.

The worker failed as `app_server_invalid_json` and killed its child, but a
referenced 250 ms interval survived after `run()` rejected and its finally
completed. The probe exited 1 after recording that live timer; it explicitly
cleared its captured timers and temporary fixture, leaving nothing running.
This is a confirmed bounded-exit defect, despite the earlier passing suites.

Main returned this single blocker for a RED-first regression and lifecycle
guard repair, including the analogous thread/open ACK continuation. No Task 3
work may begin before corrected source passes SPEC, QUALITY and main checks.

The implementer's corresponding real-peer RED was 0 PASS / 2 FAIL / 0 SKIP in
3.617 s. A single stdout write reproduced each ordering. Thread-open ACK/fault
traced `rpc.fault:app_server_invalid_json` then `capture.create`, proving a reader
was opened after terminal failure. Turn-start ACK/fault did not naturally exit
within 2.5 s; the test killed only its owned adapter and retained the failure.
Neither worker result nor capture was fabricated. Terminal continuation guards
and unconditional interval clearing are now being repaired under Task 2.

The repaired source is frozen again. Focused GREEN: 6 PASS / 0 FAIL / 0 SKIP
in 25.124 s, including both ACK/fault races, early successful completion,
pre-ACK deadline, timeout-finalize order and earlier genuine failure. Fresh full
native worker: 81 PASS / 0 FAIL / 2 SKIP in 102.497 s. The installed private-ledger
case passed in 77.237 s and fresh-source bootstrap in 25.056 s. Skip reasons
remain Windows transient rename and opt-in local CLI initialization. The
manifest is current and diff check clean. Independent SPEC re-review is active.

Additional read-only Task 3 review confirmed the narrow source-entry API above
and child handoff ordering: one token across journal/lock/child/service; journal
old identity before signal, hand lock to child, then child journals its own exact
identity before binding. Explicit retry reconciles that identity, never re-adopts
a different legacy process. Main clarified these existing design constraints and
the parsed updater invocation/exit unit in planning docs only; Task 3 source
implementation still has not started.

## Task 2 SPEC re-review: timer fix confirmed, fixture failures investigated

The reviewer's original independent actual-adapter/RPC/capture probe now passes:
`app_server_invalid_json`, child killed, and no referenced intervals after
`run()` teardown. It exited 0 under a five-second external bound. The original
leak is therefore independently closed.

A fresh six-test native slice nevertheless returned 4 PASS / 2 FAIL in 13.92 s.
The usage-timeout case expected one captured row but observed none; the turn
ACK/fault case reached `worker_timeout`/124 rather than invalid-JSON failure/1.
Both use one-second worker deadlines. Main had no concurrent WSL suite running;
the implementer's full suite had already finished. The reviewer is performing
one bounded stage/timing diagnostic per failed mode, not retrying until green.
Fixture setup timing is a hypothesis, not a concluded root cause or a PASS.

## Task 2 additional confirmed findings and source prerequisite

One instrumented diagnostic per failed mode reached the intended stages normally:
usage-timeout thread ACK 386 ms, usage module load 161 ms, turn ACK 557 ms,
binding 564 ms, native fsync 566 ms, finalization/close 1002/1003 ms with one row.
The ACK/fault diagnostic reached its fault at 197 ms and exited correctly.
These observations do not erase the earlier failed slice.

A controlled 1.1-second in-memory setup delay established two things. Both
one-second fixtures can expire before their intended turn ACK, so setup is
coupled to the test expectation (the exact historical delay remains unproven).
More importantly, actual `turn/start` requests were sent at 1670 ms and 1182 ms,
after the explicit 1000 ms deadline but before its queued timer fired. This is
a production dispatch-guard defect: check elapsed time synchronously after setup,
before initiating a request, without increasing the deadline.

The reviewer also confirmed a separate logical-failure guard defect. With one
durable matching response, early `turn/completed(status=failed)` followed by the
valid matching turn/start ACK on an open transport preserved `worker_turn_failed`
but captured zero rows. The current firstFailure guard rejects before binding.
The fix must distinguish failed outcome from finalized/dead transport and bind
eligible acknowledged responses without creating post-fault polling.

Main and implementer independently checked pinned official source: new-thread
creation delegates to the deferred recorder, which reserves the path and creates
date-parent directories/file only upon materialization; resume opens an existing
file. The current reader's pre-turn missing-path failure would therefore miss
normal fresh-thread usage. Sources:
[create_thread.rs](https://raw.githubusercontent.com/openai/codex/rust-v0.153.2/codex-rs/thread-store/src/local/create_thread.rs),
[recorder.rs](https://raw.githubusercontent.com/openai/codex/rust-v0.153.2/codex-rs/rollout/src/recorder.rs)
(creation around 795-924; path/open around 1552-1594; deferred barriers 1625-1639).
Main also checked the retained session initialization and start-response code.
No live thread/provider probe or raw session export was used.

Main activated the already conditional Task 2 reader/API test prerequisite in
the active plan: fresh-only absent baseline with pinned ancestor identity,
bounded exact-path late open at zero, unchanged existing-file EOF/resume/privacy
rules. The same bounded repair includes deadline/early-failure fixes and
test-stage allowances. SPEC remains FAIL until repaired and re-reviewed; QUALITY,
main final verification, Task 3, publication and live acceptance remain ahead.

Amended Task 2 RED: 1 PASS / 8 FAIL / 0 SKIP in 9.040 s before production
changes. Expected failures cover fatal handling of fresh absent paths, actual
lazy adapter capture of zero instead of two responses, early failed/interrupted
open-transport completion capturing zero instead of one, and an expired setup
still issuing a turn/start request. Existing/default/resume baseline compatibility
passed. The bounded reader and separated dispatch/ACK guards are now being
implemented; no GREEN or review verdict is yet claimed for this repair.

Initial amended repair GREEN: 15 PASS / 0 FAIL / 0 SKIP in 21.637 s, covering
lazy files/anchors, actual lazy adapter capture, early failed/interrupted usage,
original-deadline dispatch prevention, prior ACK/fault cleanup and one-second
pre-ACK checks. After that run, main's preliminary review found another
intended-stage fixture loop with a one-second setup budget. The implementer
kept its actual hang-turn deadline at one second and gave the identity/host-error
stage cases three seconds. Full fresh regression will verify that final test
change; independent SPEC/QUALITY and main verification still remain pending.

The final amended Task 2 candidate is frozen at fourteen source/test/doc paths.
Implementer verification: full native worker 90 PASS / 0 FAIL / 2 SKIP in
101.444 s, including the real installed lazy-file/private-ledger case in
79.257 s; board/routing 16 PASS / 0 FAIL / 0 SKIP in 12.322 s; full Atlas
69 PASS / 0 FAIL / 4 top-level SKIP in 66.681 s. A separate explicit runtime
summary is 15 PASS / 0 FAIL / 1 SKIP. Skips remain Windows-specific or opt-in
real installed runtime checks; they do not establish Windows readiness.
Diff and manifest checks are clean. Main has started fresh worker verification
and an independent SPEC re-review on that same frozen candidate. Earlier review
failures remain above; no acceptance or deployment verdict is inferred yet.

Independent amended SPEC review: PASS across all fourteen Task 2 paths against
`3b761ab`, with a fresh bounded native slice of 15 PASS / 0 FAIL / 0 SKIP in
20.599 s. It independently closed the earlier teardown, delayed startup,
early logical-failure capture and lazy native-path findings, and checked the
privacy/authority/installed-closure boundaries. No specification gap remained.
Independent QUALITY review is now active; no source edits are authorized while
that candidate is frozen.

Main fresh verification on the same candidate: worker 90 PASS / 0 FAIL / 2 SKIP
in 93.196 s; Atlas 69 PASS / 0 FAIL / 4 top-level SKIP in 71.334 s, with nested
runtime 15 PASS / 0 FAIL / 1 SKIP, real install 65.021 s and Linux quota recorder
p95 0.709 ms. Four-file board/registry/routing suite: 15 TAP PASS / 0 FAIL /
0 SKIP in 13.173 s. The additional routing-propagation test passed separately
(1 PASS / 0 FAIL / 0 SKIP, 0.185 s). The implementer's 16-test command included
that fifth file; the counts are therefore consistent, not combined differently.
The actual `--check-manifest` reports dependencies current and diff check is
clean (an initial unsupported `--check` invocation printed usage only and was
not counted as validation). Read-only upstream check still reports `6b4581b`;
new live attempts and deployments remain zero.

Read-only DEVCP pre-transition snapshot at approximately 23:33 UTC: canonical
source clean and current Clarity project pin both `6b4581bb8f1502bbae79e8034680bea130ed8c1e`.
Receiver PID 1293367/start identity 41355996, instance
`9b0f9173-fff2-4ecd-963b-65c4a0b31879`, retains its canonical-source entry and
owns all three ports: ingest 44797, health 43811, metrics 36943. Health HTTP 200
still reports no loaded runtime fingerprint; partial historical coverage is not
acceptance evidence. All eight previously inventoried tmux panes retained their
PIDs. Protected configuration hashes (not contents) for later comparison:
Codex config `b0bb46e453b442205a196dca0eeda1affec4a3301e4c2002aef6c600da9cb415`;
Claude settings `daa74405690be6daf7919c6e3fe427e296b30cf2cfa4152ea58110dab5ac7991`.
No remote writes, signals, model probes or default changes were made.

## Task 2 QUALITY: one Important disabled-attachment finding

Independent review returned With fixes, despite an independently passing
54 PASS / 0 FAIL / 2 expected SKIP slice. The actual source wrapper with the
fake provider completed normally (exit 0 and expected report), but a deliberately
disabled custom Atlas root acquired three false gap reasons:
`native_usage_authority_unavailable`, `native_usage_turn_unacknowledged`, and
`native_request_usage_unobserved`.

Root cause: the shell clears `SGSD_RUN_ID` on disabled-marker/prepare-off paths,
but deliberately retains `SGSD_ATLAS_GLOBAL_ROOT` as bootstrap configuration.
The new adapter gate treated root presence alone as an active attachment and
called the reader without a run registration. Clearing that root before prepare
would instead redirect enabled custom-root callers, so the selected narrow
repair is to require a nonempty launcher run ID at the automatic adapter gate.
Pure reader authority checks remain unchanged. The active Task 2 plan now makes
this existing opt-out requirement explicit. A real-wrapper disabled regression
must fail first; enabled installed custom-root capture remains paired protection.
Only this bounded Task 2 repair is authorized now; Task 3 has not started.

Disabled-attachment RED: 0 PASS / 1 FAIL / 0 SKIP in 12.379 s using the actual
executor wrapper, adapter/RPC and isolated fake peer. Worker exit/report and
preserved custom-root/cleared-run environment assertions passed; the failing
assertion was the unexpected new `sgsd-atlas-gaps.jsonl` in the disabled root.
Only after that failure, the adapter condition was changed to also require
`SGSD_RUN_ID`. Focused GREEN: 3 PASS / 0 FAIL / 0 SKIP in 11.113 s, covering
the actual-wrapper opt-out regression, explicit environment disable and enabled
native capture/private spool. Pure reader and shell/bootstrap semantics are
unchanged. Source is frozen again; independent SPEC re-review and main fresh
full worker verification have started. The installed enabled-custom-root case
will run as part of that full verification; no new provider/deployment work.

The narrow repair independently passed SPEC (4 PASS / 0 FAIL / 0 SKIP,
7.540 s) and QUALITY (3 PASS / 0 FAIL / 0 SKIP; prior Important finding closed,
ready to merge). Main's final five-file board/registry/routing/propagation run
passed 16 / 0 / 0 in 39.075 s; manifest dependencies remain current.

## Final-candidate verification failures: investigate, do not erase

Main's full worker run from the Windows-mounted worktree under native WSL Node
returned 89 PASS / 2 FAIL / 2 SKIP in 191.499 s. The actual installer subprocess
timed out at its unchanged 150-second limit (status null; last emitted line was
`hook manifest dependencies current`). The unchanged FIFO test also exceeded
its eight-second outer guard for `codex-executor.sh`, producer absent. Every
new capture regression passed. These failures block final Task 2 acceptance;
the prior review verdicts do not turn this full run green.

Independent read-only installer diagnosis: the new Task 2 nested Atlas copy
had not been reached because the unconditional pre-publication banner had not
appeared. After the last confirmed manifest check, candidate preparation,
substrate checks and global prechecks are silent. The test did not retain PID,
error metadata or timestamps, so the exact historical inner stage is unknown.
At 23:59:59 UTC, no matching `worker-install-*` root or attributable process
remained (fixture cwd, deleted cwd and allowlisted HOME checked); no signals.

One isolated, timestamp-observed FIFO diagnostic also failed its unchanged
eight-second guard: `codex-exec.sh`, producer absent, 8027 ms to forced cleanup.
Profile resolver was observed at 103 ms, followed by platform lookup at 6901 ms,
watchdog budget setup at 7001 ms and wrapper identity at 7123 ms. Transport
command argv appeared at 7247 ms, leaving less than the required watchdog time
before the outer guard. The first observer labelled command-bearing processes
too broadly as worker adapters; this is not evidence of provider dispatch.
It is evidence of long pre-watchdog setup, not a demonstrated internal timeout
failure. An exact-candidate, hash-verified native-Linux-filesystem snapshot is
being prepared for a controlled comparison without changing source or limits.
Windows-mounted filesystem contribution is a hypothesis until that comparison;
no new Atlas full run, Task 3 source change, publication or live attempt yet.

The first native comparison snapshot copied and byte-verified 3,554 files,
manifest hash `8f2a296648dcd4eb0281e330b6862868123921d1193053ba76a082e318eefc71`.
During copying the native Node process was observed in `p9_client_rpc`, with
read/write counters advancing; that proves active Windows-filesystem waits,
not the exact cause of the historical installer delay. Before the next WSL
invocation the `/tmp` copy disappeared. Read-only follow-up showed boot ID
`12c5bcb7-2190-4847-b518-46cef2f2277f`, uptime 13 seconds, and no matching
snapshot. No test ran from that vanished copy and no WSL configuration changed.

The controlled comparison now packages the exact hash-verified candidate on
native Windows, then extracts, verifies and runs the full worker/Atlas/routing
suites on native Linux storage within one WSL invocation. This avoids both
per-file Windows bridge traffic during tests and a cross-invocation `/tmp`
lifetime assumption. The diagnostic runner is outside the repository; source
and test limits remain frozen. Logs are retained outside the worktree.

The optional Windows tar packaging step failed before any native extraction or
test invocation. It had a 120-second diagnostic bound and empty stderr, but the
driver did not retain the status/signal/error fields, so its exact failure cause
is not established. Its partial archive is not evidence of a test result. The verified
Windows snapshot itself has the same 3,554-file manifest hash above, 34,711,854
source/dependency bytes. The comparison now uses the previously successful
direct copy followed immediately by verification and tests in the SAME running
Linux Node process. No further packaging or cross-invocation snapshot assumption.
The source still has exactly the independently reviewed 14-path Task 2 scope;
manifest dependency check and diff check remain clean.

## Task 2 accepted: identical candidate passes on native Linux storage

Final root comparison completed 2026-09-09 00:32 UTC on native Node 22.23.1.
All 3,554 candidate/dependency files were verified against the same manifest
`8f2a296648dcd4eb0281e330b6862868123921d1193053ba76a082e318eefc71`
before the suites ran. Full results, all exit 0:

- Worker: 91 PASS / 0 FAIL / 2 SKIP, TAP 48.709 s. Actual empty-tree installed
  worker/adjacent Atlas closure passed in 17.311 s; the FIFO deadline matrix
  passed in 13.199 s. Neither production nor test deadlines changed.
- Atlas: 69 PASS / 0 FAIL / 4 top-level SKIP, TAP 18.532 s. Nested runtime:
  15 PASS / 0 FAIL / 1 SKIP; Linux quota recorder p95 2.362 ms.
- Five-file board/registry/routing/propagation: 16 PASS / 0 FAIL / 0 SKIP,
  TAP 3.791 s.

Worker skips are Windows rename contention and the opt-in installed native
App Server initialization check. Atlas skips are three Windows launcher checks,
the opt-in pinned real-stack installation test and the nested opt-in real-stack
lifecycle check. No opt-in live/runtime/stack test was enabled or counted as PASS.
No model call occurred. This comparison supports filesystem/environment-sensitive
timing, not a claim that Windows/WSL is repaired or a precise diagnosis of every
earlier timeout. The prior failures remain in this report.

Full generated logs and result metadata are retained in
`C:/Users/jack.berrow/AppData/Local/Temp/sgsd-fifo-diagnostic-1c91537ed4d3442b96a4c52867785307/`:
worker log SHA-256 `8e27aaec5449fd64014a667c8b69085dd881f8e75c2ddedf8f1f3e1bd7cc8f4c`;
Atlas `a743a34cd95160c969d1f2293b5cc3e3f3869281ed45289e7305d87ae84e6c90`;
board/routing `8b7453d80a8027c76e4fde771527b43b3e8121b6f51de254349efb94c064eded`.
The optional post-run retention copy found the ephemeral `/tmp` snapshot already
unavailable; no post-test source hash claim is made. Final source diff remained
the frozen reviewed 14-path candidate, with clean manifest and diff checks.
Independent SPEC and QUALITY both PASS, prior Important opt-out finding closed.
Task 2 is accepted for local commit; Task 3 begins next. Phase gates/deployment
and live acceptance remain unclaimed. Read-only DEVCP and upstream checks at
00:27/00:31 still showed `6b4581b`, unchanged protected panes and config hashes.
