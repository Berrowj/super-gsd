---
phase: 170
plan: "170-06"
status: IN_PROGRESS
source_repairs: VERIFIED_LOCAL
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

Task 2 committed locally as `c98ac6f9cc3b17dd7dc54f63ddcd35e2e9f39e68`.

## Task 3 in progress: owned receiver revision transition

Before production edits, the implementer captured two intended Linux REDs:
loaded-fingerprint test 0 PASS / 1 FAIL (undefined runtime fingerprint, 0.738 s),
and updater-order contract 0 PASS / 1 FAIL (no restart between post-install
source verification and pin publication, 0.249 s). The fingerprint fixture also
contains the required later installed-file replacement/fresh-runtime comparison;
its first missing-feature assertion is the current failure. Runtime, journal,
drain, updater and fault/retry implementation is now active; no GREEN claimed.

Main found a directly contradictory update reference: the installed update
skill promises no process/session restart and documents pinning after installer
success alone. The active Task 3 plan now includes only the corresponding skill
correction. Main used writing-skills and create-skill's content-verification
workflow, with a read-only retrieval baseline before editing; existing process
boundaries remain except the explicitly owned Linux Atlas receiver transition.
This is not a general skill rewrite or permission to restart user panes.

Read-only acceptance preparation also confirmed two scoring distinctions for
unchanged B7: native Codex observations are completed responses (`responses`,
not verified HTTP `requests`), with truthful missing HTTP identity WARNs; and
benchmark-attributable integrity conflicts FAIL B7 even though the global audit
classifies conflicts as WARN. Keep response/model provenance, every successful
wrapper's native evidence, and Fable's separate native Anthropic session proof.
No benchmark wording, gate, global evidence or live-budget change was made.

Independent pre-edit reference retrieval confirms the skill gap: it answers
"No running process is restarted", specifies no receiver identity/fingerprint/
same-port prerequisite for the pin, and directs the operator to restart clients,
MCP/cockpit or reset tmux. Those are the baseline failures for the narrow Atlas
exception; repeat the same retrieval with the corrected skill before acceptance.

The immutable Task 2 test baseline was separately copied into native persistent
cache at `/home/jackberrow/.cache/sgsd-native-verification/candidate-Hnicr8`.
All 3,554 files match the same accepted manifest hash above. This is not a new
test result or a deployment. Task 3 may use private native copies with explicit
hash-verified overlays; the baseline is not modified. It avoids repeated
Windows-bridge reads and `/tmp` loss between WSL invocations.

Task 3 intermediate tests reported by implementer: loaded-fingerprint GREEN
1 PASS / 0 FAIL after its RED; idempotent-drain RED failed the exact close-promise
assertion, then GREEN 1 PASS / 0 FAIL. Native normalizer eager loading and partial
bind cleanup are in progress with the global lifecycle wiring. Journal/strict
ownership, updater, reference and crash/retry fixtures remain; this is not a
Task 3 acceptance or deployment claim. No new live attempts.

Read-only full propagation preparation found additional test-copy prerequisites:
root `.gitattributes`, `.codex/hooks.json`, and all 72 tracked Phase 150 runbook
files plus their faithful test-local Git index. Missing these would be a test
copy error, not a source regression. They are not production configuration edits.

It also established a pre-existing fail-closed snapshot guard, not a Task 3
regression. Unchanged `sgsd-global-snapshot.sh` pins normalized installer SHA
`7f9fe48d71e8eb209b02603582f5d647f30bc9c2303d784605d5eab1554dbc49`;
published pre-repair `6b4581b` installer SHA is
`c9dd4a4160a8fa7db45d584100edcfaa24cdfa2af70ac809576c60f467d94f17`;
`c98ac6f` installer SHA is
`536cf8e46d738febac48a420c10580ca825b73effb60ea6084a9387b75a14ee2`.
The helper/tests are unchanged between those commits; Task 2 adds only the
nested Atlas closure copy. The helper's older nine-target inventory already
omitted worker/Atlas roots written by the published installer. Static evidence
therefore predicts refusal in the broader snapshot contracts before these
repairs. Actual complete propagation execution remains pending. Do not bypass
that guard, relabel it green, or broaden this task into the parked installer/
snapshot transaction. Preserve its failure separately from receiver/updater
regressions and the explicitly required worker/Atlas acceptance suites.

Main executed the complete seven-file propagation baseline at
2026-09-09T01:11:04Z against accepted pre-Task-3 `c98ac6f` bytes, not the changing
Task 3 worktree. Native Node 22.23.1: **54 PASS / 7 FAIL / 2 SKIP**, TAP
11.205 s, process exit 1. All seven failures are the unchanged snapshot helper's
installer-digest refusal (round-trip, absent target, absent bootstrap and four
restore safety fixtures). All updater, provenance, restart-evidence, routing,
runbook and hook checks passed. The two skips require unavailable native Linux
PowerShell. This is an explicitly failing baseline, not full propagation PASS.

The private candidate contains 3,628 hash-verified files: the immutable 3,554-file
Task 2 baseline plus the 74 required propagation inputs, with exactly 72 P150
paths in its own Git index. HOME/USERPROFILE/TMPDIR and Atlas root are disposable;
provider/telemetry/Git overrides are scrubbed. No source file in its input
manifest changed during this execution. Candidate:
`/home/jackberrow/.cache/sgsd-native-verification/reviewed-UPxxKP/source`;
evidence is its sibling `evidence/`, including full log, manifest and results.
Input file-manifest SHA:
`13e54282f5f2f684d1a1b3384d0cecb717e55d56369c04da9219a9a3bea91e6d`;
propagation log SHA:
`622ef1a3805557237b3f41d0fd58e01442c2b62a54de09bfed30afd69d20d81a`.
The external one-use verification harness was syntax-checked and its setup-only
copy/index verification succeeded before this baseline run. No model call,
production restart, publication or deployment occurred. Task 3 still awaits
implementation freeze, independent SPEC/QUALITY reviews and fresh verification.

Pre-freeze root inspection raised three lifecycle cases for explicit regression
coverage: a launcher awaiting the shared lock must recheck a newly pending
journal before its second healthy fast path; competing restart requesters must
not publish/overwrite the initial journal before taking that shared lock; and a
completed transition must permit the next different receiver revision, while a
different target during a pending transition still refuses. Replacement recovery
must compare recorded process identity/token as well as instance/fingerprint.
These are implementation feedback, not a passed independent task review.

The shared startup helpers also newly applied directory `fsync` on Windows.
A read-only native Windows Node 22.23.1 probe opened the workspace directory,
called `fs.fsyncSync`, received `EPERM` from syscall `fsync`, and closed the
descriptor without changing files. Mandatory Linux journal durability must not
introduce that failure into ordinary Windows bootstrap. This is a preservation
constraint; Windows performance/deployment remains OPEN_REQUIRED.

The independent update-reference retest now retrieves the correct Atlas-only
same-port transition, unchanged sessions/other pins, Windows open status and
check/no-install no-op. It found two remaining wording gaps: distinguish old
legacy revision unknown from the required verified replacement fingerprint,
and explicitly include receiver-transition failure in nonzero/unchanged-pin
handling. The sole implementer is addressing these before freezing Task 3.

The external prepared fresh-Fable prompt was independently checked against the
unchanged benchmark specification: reference consistency PASS, with no weakened
B0-B7 assertion, extra paid action or changed budget. It preserves priority-first
supervision and the approved native-response/unknown-HTTP-identity distinction.
This is preparation only: no prompt was sent to DEVCP and no live attempt began.

## Task 3 frozen implementation, independent review pending

At approximately 01:35 UTC the implementer froze the exact eight Task 3 source/
test/reference paths. No commit or deployment. Independent SPEC review is now
running; QUALITY has not started. Root is separately running the combined worker,
Atlas, board/routing and full propagation verification against a private native
copy of the frozen source. Source acceptance remains pending both reviews.

Implementer final native checks: global+receiver **46 PASS / 0 FAIL / 0 SKIP**,
exit 0, 6.48 s; updater contracts **18/0/0**, exit 0, 5.67 s. Full Atlas
**82 PASS / 0 FAIL / 4 SKIP**, nested runtime **15/0/1**; full propagation
**59 PASS / 7 FAIL / 2 SKIP**. Root independently read the full-run summaries:
Atlas TAP 17.910 s; propagation TAP 5.580 s. The seven propagation failures are
exactly the same snapshot guard cases as the pre-Task-3 baseline, with no new
failure. Skips remain platform/explicit-real-stack opt-ins; no live model proof.
Shell/Node syntax checks and scoped diff whitespace check also exit 0.

The unchanged candidate is
`/home/jackberrow/.cache/sgsd-native-verification/task3-candidate-M7wKKz`;
evidence is
`/home/jackberrow/.cache/sgsd-native-verification/task3-evidence-VfiKlU`.
Candidate/workspace eight-file manifest SHA is
`0028f76fb2d2766e485d19e90cffd3a0c1b87fdcc687ff6780c5990d5648b715`.
Root independently hashed all eight working files and matched that recorded
inventory. Atlas log SHA:
`1deb34942e328a81f19fb3f8dc70e3bdbefbfca7d5e829e3e305072ce6c248d2`;
propagation log SHA:
`76df6332916af7469b60314b5eb6f2c84f2e55b6845e630987ba49cc9c234928`.

Pre-freeze lifecycle feedback now has focused regression coverage: shared-lock
initial journal publication, launch pending recheck, concurrent restart convergence,
before/after handoff crash retry, exact replacement identity, unchanged-revision
trusted-source no-op and later-revision transition. Linux directory durability
remains mandatory; shared Windows startup skips unsupported directory fsync while
retaining file fsync. This prevents the newly identified Windows regression but
does not establish Windows performance, deployment or acceptance. The narrow
update-reference wording was corrected before the frozen hash inventory.

### Root combined verification of first frozen candidate

Fresh independent native run, 2026-09-09T01:36:42Z through 01:37:51Z, Node 22.23.1:

| Suite | PASS / FAIL / SKIP | Exit | TAP duration |
|---|---|---|---|
| Worker (all six package-selected files, including real empty-tree install) | 91 / 0 / 2 | 0 | 33.855 s |
| Atlas complete | 82 / 0 / 4 | 0 | 18.325 s |
| Board/registry/routing (four files) | 15 / 0 / 0 | 0 | 2.038 s |
| Full propagation (seven files, including routing propagation) | 59 / 7 / 2 | 1 | 14.353 s |

The propagation failures remain exactly the seven pre-existing snapshot-digest
refusals, not new Task 3 failures. The full harness therefore exits 1 honestly;
there is no blanket all-tests-pass claim. Worker skips are Windows rename and
explicit opt-in installed App Server initialize. Atlas skips are three Windows
launcher cases and explicit real-stack install; nested runtime is 15 PASS / 0
FAIL / 1 opt-in real-stack runtime SKIP. Native quota recorder p95 is 1.200 ms,
not a Windows result. Propagation skips require unavailable Linux PowerShell.

Candidate `/home/jackberrow/.cache/sgsd-native-verification/reviewed-JHM6pJ/source`
and sibling `evidence/` retain full logs/results and the 3,628-file manifest.
All input file bytes were checked before and after execution, with no changes;
82 overlays are eight Task 3 files plus 74 propagation inputs. Exactly 72 P150
files are in the disposable candidate's own index. HOME/TMPDIR/Atlas root and
Git/provider environment are isolated; no real provider or production process
was invoked. Input file-manifest SHA:
`08e77f904cc22cf4e10c99226b3792745b37e8ed277e9543c82764c719fe960c`.

Log SHA-256 values:

- Worker: `b9a30662be271e107ecf14763c82ad9aa227a592369c1764f461c1c5e33fc084`.
- Atlas: `914eedffb7e23037d690c9c9766e59424f92f79499871d7e3f7da9f208e798d8`.
- Board/routing: `710f92a0065af2c580c8cdb49e40aa4df41996324604d4d3dacb3c9ba0e6d3e4`.
- Propagation: `8a37f4b5a74a88c883e4d011ff43acf2c2782ef728ab7304c6cef5a4359e4636`.

Existing `node super-gsd/scripts/lib/hook-install-contract.cjs --check-manifest`
reports dependency graph current, exit 0; `git diff --check` is clean. Independent
SPEC review is still checking absent-after-complete and awaited-health transition
edge cases; no SPEC/QUALITY acceptance, commit, deployment or live run is claimed.

### Independent Task 3 SPEC review: FAIL, repair authorized within active plan

The first frozen candidate failed specification review on four concretely
reproduced lifecycle boundaries in `global.cjs`:

1. The pre-lock absence check returned `absent` while an exact owned ordinary
   legacy startup child held `startup.lock` but had not bound its ports. After
   resuming, that same child published a healthy old receiver. Updater pinning
   could therefore precede the completion of stale startup.
2. A real delayed health response could be accepted after a pending transition
   journal appeared. Pending checks must follow awaited readiness and precede
   all healthy returns, including the post-spawn loop.
3. A modern service record with `process_identity` replaced by the valid identity
   of another live process was accepted as `already_current`. Recorded identity
   must exactly bind the service PID/start/executable/argv and actual ownership.
   Genuinely legacy records lacking fingerprint and identity remain distinct
   from modern missing or mismatched identity.
4. After a real successful legacy transition and graceful stop of its exact
   replacement, with all recorded identities dead and `service.json` absent,
   the completed journal caused `service_health_unverified` instead of the
   required absent no-op. Reconciliation must occur under the shared lock and
   must not call an unverifiable still-live replacement genuinely absent.

Reviewer probes ran against root's immutable first candidate and the native
`c98ac6f` legacy baseline. Three bounded probe commands exited 0 in 0.35 / 0.82 /
0.68 seconds while demonstrating these counterexamples. Outputs are in the review
tool transcript; no separate probe evidence files were written. The reviewer
closed created servers, verified exact fixture identities stopped and removed
only its temporary fixture roots. This is not a claim about unrelated processes.

Root returned the four findings to the sole implementer for explicit RED/GREEN
regressions and a new frozen candidate under the existing Task 3 plan. No QUALITY
review has started. Prior passing offline tests and their hashes remain valid
historical evidence but do not override SPEC FAIL. No publication, deployment,
live worker attempt, source gate change or expanded Windows repair occurred.

Read-only DEVCP preflight at 2026-09-09T01:51:14Z confirms canonical source clean
and source/current Clarity pin still
`6b4581bb8f1502bbae79e8034680bea130ed8c1e`. Both local fetch/push origins remain
canonical, and remote master was independently checked at the same SHA. The same
eight tmux pane identities are present. Protected Codex/Claude config hashes
remain `b0bb46e453b442205a196dca0eeda1affec4a3301e4c2002aef6c600da9cb415` and
`daa74405690be6daf7919c6e3fe427e296b30cf2cfa4152ea58110dab5ac7991`.

The global receiver remains PID 1293367/start 41355996/instance
`9b0f9173-fff2-4ecd-963b-65c4a0b31879`, with the exact previously recorded native
Node/source-entry argv and unchanged ports 44797/43811/36943. Health is HTTP 200
with matching PID/instance/root; loaded fingerprint remains unknown for this
legacy receiver. No transition journal exists. This inspection performed no
remote write, process signal, model call, update or session restart.

SPEC repair first RED is recorded before production edits: four native Linux
regressions selected by `ordinary launch rechecks|explicit restart waits|modern
service identity|completed transition history` produced **0 PASS / 4 FAIL / 0
SKIP**, exit 1, 2.476 s. They fail respectively on accepting delayed health after
pending transition, false absence instead of startup-lock refusal, accepting a
different live process identity, and refusing genuinely absent completed history.
The first frozen production source remained unchanged for this RED. The sole
implementer is now applying the minimal shared-lifecycle repair and will return
fresh focused/full evidence and a new source freeze for independent re-review.

SPEC repair focused GREEN: the same four-name native command now reports **4
PASS / 0 FAIL / 0 SKIP**, exit 0, 3.645 s. Full affected global+receiver tests:
**50/0/0**, exit 0, 16.986 s. Repairs remain confined to `global.cjs` and its
test: post-await pending checks on every readiness return, exact modern identity
equality, shared lock before absence, and completed-history absence requiring
well-formed recorded identities no longer owned plus all recorded ports free.
An unverifiable still-live replacement still refuses. Full fresh native Atlas/
propagation and independent SPEC re-review remain pending; no acceptance claimed.

### Repaired Task 3 frozen candidate and root combined verification

At 02:17 UTC the implementer froze the same eight Task 3 paths, changing only
`global.cjs` and its test from the first candidate. The eight-file manifest SHA
is `a3c4be4ef40379d3bad9f836f847a42d99fa8d57556deed877d43759e5c10b85`.
Current runtime SHA is
`cd04d70552d55f23be43cac10c4a12a6306398488a17aaf5db29530a03815acf`;
global test SHA is
`a6607fc4b4a30d24f03e7e896773e678e36db53c19293e50d3d92b0acccfe202`.
The other six file hashes match the first frozen candidate above. A final
order-independent recorded-port comparison was followed by all four regression
tests again: 4/0/0, exit 0, 3.584 s. Implementer full Atlas: 86/0/4 plus nested
15/0/1, exit 0, 20.799 s; full propagation: 59/7/2, exit 1, 5.925 s, exactly
the previously recorded snapshot digest failures. Native candidate:
`/home/jackberrow/.cache/sgsd-native-verification/task3-specfix-kh8EgW`;
evidence: `task3-specfix-evidence-dfwogB` under the same cache directory.

Root independently verified the current eight workspace file hashes and ran a
fresh combined native Linux candidate from 02:18:06 to 02:19:16 UTC:

| Suite | PASS / FAIL / SKIP | Exit | Elapsed |
| --- | --- | --- | --- |
| Worker, including actual empty-install fixtures | 91 / 0 / 2 | 0 | 34.005 s |
| Atlas | 86 / 0 / 4 | 0 | 20.642 s |
| Board / registry / routing | 15 / 0 / 0 | 0 | 1.437 s |
| Complete propagation contracts | 59 / 7 / 2 | 1 | 14.067 s |

Atlas includes the separate nested runtime 15/0/1. Skip reasons remain the same
platform/opt-in limits documented above. The seven failures remain exactly the
pre-existing snapshot-contract cases; no failure was skipped, filtered or
relabeled green. The combined harness therefore correctly returned exit 1.
No formal phase gate or all-repository passing claim is made.

Candidate `/home/jackberrow/.cache/sgsd-native-verification/reviewed-I4QF5n/source`
and sibling `evidence/` retain full logs/results. All 3,628 manifest files were
verified before and after tests with no changed input bytes; the disposable
candidate has the exact 72-file P150 index and isolated HOME/TMPDIR/Atlas/Git/
provider environment. Input manifest SHA:
`b8f735c2043f539fafcb34b39a01ad4fee3787b2035b020c4094a9a5d009b0f6`.

Log SHA-256 values:

- Worker: `2b420c6de26f9ad86c02938873b6e360b2e903d24aff60c839f7db89217548f6`.
- Atlas: `8ac60d0afb5c61e2e69af3f234c5e612f149eb27c2d215ea67d2c5d2fb332c4c`.
- Board/routing: `c898a66e2f6ee37e352e48132e978d38fa3bd36ceb8c6d792b8a0bca330b3459`.
- Propagation: `08d5dc6ddc5acbb3797e1071bc05d297f776663e0ff52d10de0a144f41865a51`.

Existing hook dependency manifest check and `git diff --check` also exit 0.
The independent specification reviewer is rechecking all four fixes against
actual code and bounded native fixtures. QUALITY review, acceptance, Task 3
commit, publication, DEVCP update and new live attempts have not yet occurred.

### Specification re-review accepted; quality review running

Independent SPEC re-review passed on the frozen `a3c4be4e` candidate. The
reviewer ran global+receiver tests independently (50/0/0, 9.354 s), replayed the
original held-health/startup-lock/modern-identity/completed-history probes, and
verified actual legacy adoption plus unchanged replacement URLs. All eight
source hashes still matched after verification. Exact owned probe processes
were verified stopped and only their temporary roots removed; the immutable
legacy baseline was unchanged. This is local SPEC acceptance only.

The independent QUALITY reviewer then ran global+receiver+updater contracts:
68/0/0, 8.230 s. A further fresh-process probe confirmed a load-before-hash
problem: the first normalizer module read returned revision A while that private
file was replaced with B; the receiver retained A but its subsequent disk hash
matched a fresh B runtime. This is not populated-require-cache reuse. Root
confirmed the corresponding import-before-hash ordering in the actual source.
The reviewer is checking the same case through actual serve/restart before
returning the final finding. Deployment remains paused; no source fix or new
source freeze has yet been accepted for this quality finding.

At 02:28 UTC a read-only DEVCP snapshot retained seven protected file hashes,
48 pin-bearing paths, eight pane identities, five additional protected process
identities, source/pin/health and the legacy receiver record. Source is clean
and both source/current project pin remain `6b4581b`; receiver PID 1293367 and
ports 44797/43811/36943 remain unchanged, with no transition journal. Local
generated evidence file `pre-deployment-protection-1788920893234.json` lives in
the existing external diagnostic directory; SHA-256:
`26cbd9e7d59da15eab3cac8aa59046088b0c5210dcbdac49b2a406976bb197fa`.
Only hashes, metadata and identities were retained, not credential contents or
native transcripts. The external read-only collector was adapted to DEVCP's
older Git after `worktree list --porcelain -z` was rejected; the successful run
uses supported porcelain output and refuses quoted ambiguous paths.

A separate read-only host feasibility check at 02:23:04 enumerated 5,307 PIDs
through the existing `ownsPort` helper for one unoccupied port: no owner,
441.141 ms. It bound no port, signalled no process and is not a live transition
or hard real-time guarantee. New paid/live worker attempts remain zero.

QUALITY returned **not ready for integration**, one HIGH finding. Its final
actual fresh `serve` process had the expected exact argv, loaded parser A, but
advertised the same fingerprint as fresh parser B; `restartService` returned
`already_current` and left that PID unchanged. The private fixture child was
gracefully stopped. Root preserved its 23 fixture files mechanically under
`/home/jackberrow/.cache/sgsd-native-verification/quality-fingerprint-YzK0YN`
without removing the original. Manifest-array SHA:
`03d7a04c2ef909613fbd7094d7c8cf45cb7e77f797014d08458f25f68a225c46`;
the actual child-loaded marker remains A.

The sole implementer is authorized to repair this existing Task 3 fingerprint
requirement with RED-first tests. Dependency snapshots must enclose actual
loading; previously cached exports cannot inherit current file hashes, and the
already-compiled entry must not be identified solely by a later disk read.
Read-only audit/status clients intentionally preload shared dependencies and
must remain usable without being allowed to mutate an unverified receiver.
Task 3 plan now records these boundaries. No new topology, P169 transaction,
source gate, CLI/default change, publication, deployment or live spend occurred.

### Fingerprint coherence repair and final frozen verification

Valid deterministic RED before production edits: three new tests produced
0 PASS / 3 FAIL / 0 SKIP, exit 1, 0.824 s. They demonstrate compiled entry A
being identified by later disk B, dependency A loading while disk changes to B,
and actual audit-style cached dependencies incorrectly allowing a claimed
fingerprint and mutation. GREEN: new three 3/0/0; new three plus prior four
SPEC regressions 7/0/0, 4.142 s; global+receiver 53/0/0; actual audit suite 8/0/0.

All runtime behavior now lives in named `loadedGlobalRuntime`; its actual
compiled function source is the entry hash component. Eight eager dependencies
must be initially uncached and byte-identical in enclosing pre/post snapshots.
An incoherent/cached client has null fingerprint and refuses direct registration,
prepare/start/ensure/restart before filesystem or signal mutation. Read-only
audit/status still work. This is normal-entry version coherence, not security
attestation against arbitrary external loader transforms. README states the
boundary; there is no new helper, loader topology or P169 change.

Final frozen eight-file manifest:
`e0c6b3979bcb880f70a1bdaa628a92e2dc9aed796b1461ab3eff26221afb0806`.
Changed hashes from the prior freeze:

- `global.cjs`: `1a09a47ee70bb763110ac20c81767137e4061c748b0e0de17695de538544d53d`.
- `global.test.cjs`: `49eda9e7f4ece60dd61752d32779e8f245f4bf002ecf3fe97a314e6bdd74504b`.
- `README.md`: `9c30ec7535c7c20c80cd8d4fa68d6e6da46445d7da488e28e241969a8beeeb95`.

Root independently verified all eight current file hashes and observed fresh
target runtime fingerprint
`1c4aadee1a71bd1038dc7c602f213a542aa1913bcfe83ddeb58d38092c7b65c0`.
Implementer candidate `task3-final-ZocYTh`, evidence
`task3-final-evidence-XnCnEF`, are below the native verification cache. Full
Atlas: 89/0/4 plus nested 15/0/1, exit 0, 26.019 s, quota p95 0.917 ms.
Full propagation: 59/7/2, exit 1, 5.906 s, same known snapshot failures.

Root fresh combined execution at 02:47:05-02:48:15 UTC:

| Suite | PASS / FAIL / SKIP | Exit | Elapsed |
| --- | --- | --- | --- |
| Worker and real empty-install fixtures | 91 / 0 / 2 | 0 | 32.889 s |
| Atlas | 89 / 0 / 4 | 0 | 21.258 s |
| Board / registry / routing | 15 / 0 / 0 | 0 | 1.413 s |
| Complete propagation contracts | 59 / 7 / 2 | 1 | 14.195 s |

Nested Atlas runtime is 15/0/1; quota p95 0.584 ms. Skip reasons are unchanged.
Root read the complete propagation log and verified all seven failed case names
13,14,17-21 and the same installer digest. No failures were hidden or relabeled;
the combined harness correctly exits 1. Existing dependency-manifest check and
`git diff --check` exit 0. No formal phase gate is claimed.

Candidate `/home/jackberrow/.cache/sgsd-native-verification/reviewed-YDDdda/source`
and sibling `evidence/` retain full logs/results. All 3,628 input file bytes were
unchanged before/after, with isolated HOME/TMPDIR/Atlas/Git/provider environment
and the exact 72-file P150 index. File-manifest SHA:
`72286cd98a032d4af568cb8d8e31d540e71107c92f1ed2bda72b078664c46242`.

- Worker log: `c392c100a75e6720b7710f176982b5ce5ec13e980cfcf1bebb4365218e30229d`.
- Atlas log: `2b0b0bf5f47c701201e7600213bfd89f31ec9bdb95e165b468f506e67be3bc01`.
- Board/routing log: `1a415c570a7216f4dcad475ff69744b1976b67c12db7ebb9cf2dede1600012c5`.
- Propagation log: `5519da920e14f2aa0d17f36b55d8bc46acc552352c86d8bb28ed42245e6c9957`.

Independent SPEC re-review is running on these frozen bytes; QUALITY re-review
follows only after SPEC passes. The external prepared Fable handoff now explains
that B0 queries target fingerprints in fresh Node processes with `global.cjs`
required first, rather than using an intentionally unattested cached audit
client. The benchmark specification and live limits are unchanged; no prompt
has been sent, no publication/deployment has occurred and new live attempts are 0.

Final SPEC re-review returned PASS on `e0c6b397`. Independent native global+
receiver+audit verification: 61/0/0, 10.226 s. An additional private live probe
confirmed null fingerprint in an already-cached audit client, correct fingerprint
from the actual receiver, all five mutation refusals, and continued read-only
status/audit access. Its child exited naturally, receiver closed, and exact
temporary root was removed. All eight hashes and target fingerprint were
independently rechecked. The amended B0 handoff sentence is consistent with the
unchanged benchmark. Separate QUALITY re-review is now running; no deployment,
provider action or acceptance claim follows solely from this SPEC result.

### Task 3 QUALITY accepted; entering combined publication task

Independent QUALITY re-review returned PASS, no remaining findings, on the same
frozen eight files. Global+receiver+audit+updater contracts: 79/0/0, 8.986 s.
The original actual fresh `serve` cutover was replayed: normal argv, parser A
actually loaded, fingerprint null, exit 1, no healthy service discovery. A
subsequent coherent startup produced a valid fingerprint and succeeded. Its
fixture processes were stopped; fixture path:
`/tmp/atlas-final-serve-cutover-bwKB7h` (temporary, not a durable evidence root).
Root retains the review's structured result in this report; no provider or
production process was used. All eight hashes and target fingerprint match,
and scoped diff verification is clean.

The Task 3 source and test work is accepted locally after SPEC then QUALITY.
The earlier four SPEC failures and one QUALITY failure are resolved with their
RED/GREEN evidence retained. Task 4's fresh combined source checks and report
recording are complete; final integration review, normal publication, guarded
DEVCP update and the one fresh B0-B7 run remain. No all-propagation-green,
Windows completion, formal phase close or live acceptance is claimed.
