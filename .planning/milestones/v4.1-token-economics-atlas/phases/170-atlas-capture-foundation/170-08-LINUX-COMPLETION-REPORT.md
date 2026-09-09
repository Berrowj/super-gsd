# Linux completion progress - 170-08

Status: IN_PROGRESS. No phase-close, all-instance coverage or weekly baseline is claimed.

## Fresh acceptance and independent reconciliation

The installed-launcher Fable session `sgsd-linux-acceptance-20260909T095210Z`
(Fable PID 614312, Atlas run `sgsd-a324983d-1f89-4ee9-b172-217410b2fddc`)
sealed B0 PASS / B1 FAIL at 10:08:21Z on 9 September. B2-B7 were not run;
zero of five permitted live worker attempts were used. Fable orchestration usage
was observed and is not zero; the report's opening no-model-called sentence is
too broad and is corrected here without rewriting the sealed report.

The [structured receipt](170-08-LINUX-ACCEPTANCE.json) references the full private
evidence and all 88 independently verified manifest entries. Seven protected
files, 16 prior panes, seven additional processes and 48 existing pin paths were
unchanged. The production receiver remained PID 369447 with the expected fingerprint.

Worker tests passed 92/0/2; board 8/0/0; routing 3/0/0. Atlas was 91/2/4:
the explicit retry after the lock-expiry test and the next-revision transition
exhausted the unchanged five-second nominal deadline. Source inspection found
whole-network-table reads repeated for every process and port; the host had 6,761
processes during investigation. The native Node24 measurement subsequently found
2,060.9ms for one three-port pass (637.1/709.1/714.6ms), repeated twice before
startup: approximately 4.12 seconds of the five-second transition budget. The
read-only namespace-aware batch prototype returned the same absent owners in
183.4ms, reducing 20,328 FD-directory scans and 516 network-table reads to 6,776
FD scans and two network-table reads. The result supports the scan-cost cause;
it is not yet proof of the production repair.

The implementer's initial message reported two RED failures in
`/home/jackberrow/.cache/sgsd-native-verification/repair-red-z0s2ar/source`.
Root's inspection of the subsequently saved `focused-red.json` found a different
run: one pass / one fail, with the batch regression observing 600 table reads
but the cleanup test passing. The initial two-failure raw artifact is therefore
not independently verified; a separately identified old-helper regression run
is required. No saved result may be relabelled as the original observation.

Durable native `global-full.json` and stdout show 40/40 receiver tests passing
in 15.35 seconds, including the two formerly failing nominal transitions at
936ms and 1,319ms. The real-wrapper sentinel tests pass 2/2 in 2.78 seconds and
verify unchanged parent-log bytes plus private fallback rows. These artifacts
are under `repair-green-IY5E2O/evidence/`. The saved repeated process measurement
at 10:57:22Z observed 6,816 processes and a 3.755-second two-pass baseline; it is
a later measurement, not the original 4.12-second/prototype observation.

At that checkpoint full-suite/review evidence was pending. Root independently reproduced focused GREEN on the
same two source hashes using a fresh private copy on DEVCP Node24: 2 pass / 0 fail
/ 0 skip in 679ms at 10:54:34Z. Evidence is
`/home/jackberrow/.cache/sgsd-native-verification/root-focused-BpaRMo/corrected-evidence-1D4m4T`.
The first root harness mistakenly set `SGSD_ATLAS_DISABLED=1` while testing
restart, producing two disabled-state failures. Those outputs remain in the
sibling `evidence/` directory; only that harness environment was corrected, with
no production source change between the two runs. This is not full-suite or live
acceptance evidence.

## Diagnostic integrity and cleanup

The independent Task 4 SPEC review (`170-08-SPEC-REVIEW-01.md`) requested one
additional repair: readiness failure in the test launch helper occurred before
caller cleanup was installed. This finding is being repaired test-first without
changing production deadlines or permissions; SPEC revision 2 subsequently passed.
The first review remains a failure,
not a retroactively rewritten pass.

Root's first wider native integration copy at
`/home/jackberrow/.cache/sgsd-native-verification/root-integration-EhurCo/evidence/`
preserves an incomplete-harness run: worker 90/2/2 (missing tool-scoped js-yaml and
root CLAUDE.md), Atlas 95/0/4, board/routing 15/0/0, propagation 71/8/0 (seven
installer digest-guard failures plus missing root planning config). Protected
configuration/profile-log hashes and all 1,102 copied source bytes remained
unchanged. The test copy lacked some prerequisites; no result from it constitutes
the final integrated acceptance. Its installer could bootstrap missing pinned
packages in that private copy, so this run is not described as network-proven
offline. The corrected helper copies both dependency roots, CLAUDE.md and the
planning config up front and sets npm offline/no-lifecycle-script settings.

The implementer's earlier Atlas empty-stdout failure was traced to its inherited
SSH PATH lacking the directory of the absolute Node24 executable used to start
the tests. Bash's nested `node` therefore was unavailable. Root's explicit Node24
PATH passed the same Bash attachment test; no launcher source repair was inferred
from that harness error. Corrected full integration is recorded below; quality
review has since blocked deployment on a distinct finding.

B1 appended four exact fallback rows to the source default profile ledger, byte
range [2817,4069). Root verified the old prefix hash and exact new suffix, kept
the original file and a private full copy, and recorded the rows as offline test
diagnostics. No automatic exclusion implementation is claimed.

After matching the failed benchmark's saved argv, native executable and start
time `46786177`, root sent SIGTERM only to test receiver PID 684630 and confirmed
it stopped. Its temporary root had already been removed by the failing test;
root deleted no files and signalled no other process. The older test receiver
and every pre-existing operator session were preserved.

## Corrected native integration and scoped review

At 11:37:22Z, the corrected isolated DEVCP Node24 integration completed at
`/home/jackberrow/.cache/sgsd-native-verification/root-integration-mk1QGY/evidence/`.
It copied and hashed 1,106 source/config inputs and 6,145 dependency files, with
the exact 72 historical P150 evidence paths in its private Git index. All copied
source inputs and the observed production protected-state hashes remained unchanged.

| Suite | Tests | Pass | Fail | Skip |
| --- | ---: | ---: | ---: | ---: |
| Worker | 94 | 92 | 0 | 2 |
| Atlas | 100 | 96 | 0 | 4 |
| Board/routing | 15 | 15 | 0 | 0 |
| Propagation | 79 | 72 | 7 | 0 |

Worker skips are Windows rename contention and opt-in live initialize-only.
Atlas skips are three PowerShell tests and opt-in pinned Linux binary installation;
its aggregate runtime script additionally reports the opt-in legacy real-stack
case skipped. These are not Windows or legacy-stack certification. The new exact
startup-failure cleanup is in the passing 41-test global suite.

The seven propagation failures are the existing snapshot helper rejecting the
current installer digest, not new receiver regressions. Root reproduced the exact
seven failure names on a separate native copy of published 2770952, verified the
helper/installer/test hashes match, and retained the failing baseline at
`/home/jackberrow/.cache/sgsd-native-verification/root-snapshot-baseline-lC03Hj/evidence/`.
No snapshot guard was loosened and no all-tests/all-rollout pass is claimed.

Independent SPEC revision 2 passes the frozen Task 4 code; revision 1 remains
recorded as fix_required. The final test hash is
`8512c432f71aee62600f46d13bf3c2c4a1067dc6bdb55e2adf57501db109a5f4`.
Meaningful readiness-cleanup RED kept the injected observer and removed only
failure cleanup: ownership remained true when false was required. Its original
seam-absent RED is separately labelled and is not presented as leak evidence.

An actual registered `codex-cli-reviewer` per-dispatch ATC FULL review was started
at 11:41:00Z using `review` / `gpt-5.6-sol` / `xhigh`, the configured 180-second
analysis tier, one attempt and no fallback. It reviews only Task 4's four files
in the isolated candidate. This is real gate/review spend, not one of the future
five acceptance-worker attempts. It timed out at 11:44:01Z (exit 5, 180,834ms),
without a review verdict. Evidence is the candidate's
`.planning/reviews/170-08-quality-yJjFQM/`; worker
`eec0314e-c84b-4a4c-8577-cccfd465f224`, native thread
`01a085f8-af53-7d30-a387-abc052ebee63`, Atlas run
`sgsd-dd486249-59a2-4b83-80c4-ebacdfd1e3a1`. No critical/warning counts or pass
are invented for this timeout.

Root's review harness put the Node24 bin directory before `.local/bin`, selecting
its older Codex 0.144.3. The wrapper correctly preserved the caller-visible CLI;
the native rollout metadata confirms 0.144.3. Its cumulative token-count
snapshots are not per-response authority and were not ingested or summed as such.
The timeout produced real provider work, not zero spend. Native token usage was
unobserved by Atlas for that attempt.

One explicit continuation of that saved thread pinned the verified
`/home/jackberrow/.local/bin/codex` (native 0.153.4), keeping Sol/xhigh, permissions,
the 180-second deadline and no automatic retry/fallback. It completed at
11:54:12.816Z in 161,702ms with exit 0 but a BLOCKING review verdict:
CRITICAL 1, WARNINGS 0, PASS_RATE 90. The report says incomplete `/proc`
visibility can be misreported as a vacant port. Its FINDINGS field is empty;
there is no supplied file/line detail, so the root is verifying the finding
against a concrete regression before repair. Transport completion is not ATC PASS.

Continuation evidence is
`.planning/reviews/170-08-quality-continuation-xknfYP/`, worker
`f8fcd4f1-86bb-4aeb-89a4-24fc35897ef7`, turn
`01a08602-4d86-71b3-bc58-2ce9c49f51f9`, Atlas run
`sgsd-efb1a00b-820d-42c9-b54f-3bfa2eb3f0c7`. Its 154-byte report SHA-256 is
`fa2a9f93fe37b6d088c76ce30e24363b7a56bdde6e7e6912912e8ea5f780e3b6`.
All four scoped source hashes stayed unchanged and the worker is terminal with
no pending questions and no live adapter process. No deployment has occurred.

The existing Atlas audit at 12:01:03.551Z observed one accepted native response
for the continuation, zero pending spool, and zero invalid/duplicate/conflicting
events in this private review project. It records both runs closed. The first
run has partial coverage with no native response; the continuation has observed
response coverage, not exhaustive reconciliation or a known HTTP request ID.
The overall audit remains WARN, including pre-existing/unattributed capture gaps;
462 rejected native records globally are not assigned to this review by timing.
Audit SHA-256:
`f44815188a707e59dc845a9273d252f804ecbf8f0f988b0dfe5b5cb083794dc1`.

The integration helpers' installed-profile check originally named the nonexistent
`~/.claude/super-gsd/.planning/...` path. A separate read-only check of the actual
`~/.claude/.planning/metrics/codex-profile-resolution-log.jsonl` confirms its
baseline remains six rows / 1,776 bytes, SHA-256
`c2283aa62f627256a5f92162f0741f9dc493f8c8d9f0255700dc98537bf6ded5`.
This corrects the evidence path without altering the earlier receipts.

The root used the existing route, gate-evidence, review-ledger, gate-value and
edge-guard writers to append the actual outcomes. The timeout has no invented
review counts; the completed review emits `critical-halt` and gate outcome
`block`. The phase's `commit-reviews.jsonl` and verbatim
`170-08-ATC-REVIEW-01.txt` are the durable review evidence. Edge-guard observes
that evidence emission for a return to remediation, not permission to deploy.
All six ledger prefixes were byte-preserved; exact appended byte ranges and
hashes are in the private `gate-reconciliation-XJLKdd/result.json` receipt.

Native regression evidence subsequently verified the issue in
`repair-port-proof-red-oAuNQ2/evidence/port-proof-red.*` (0 pass / 3 fail):
a visible target listener with an unreadable owner FD directory was called
vacant; an unreadable authoritative current-namespace table was called vacant;
and a listener existing only in another network namespace wrongly blocked the
current namespace. The first false-negative is inherited from the old per-PID
`ownsPort` scan, but is directly touched by this repair and remains a blocker.

## Port repair verified; cleanup re-review remains blocking

The port-state repair now reads the authoritative current network namespace's
TCP/TCP6 listener tables once, distinguishes occupied/vacant/unknown, and refuses
incomplete table evidence. Unrelated unreadable process FDs are no longer a
vacancy prerequisite. Exact owned-process identity and the original five-second
deadline remain unchanged. SPEC revision 3 passed the frozen production hash
`8d0cbb46f7f049c3bdf844560e394a9a615f5d50223551e19bd397f82d547d20`
and test hash `833b4378111bb2adc6cc80a67b638c41c1140b39f745d000e408e00797819eb4`.
These identify that revision, not the cleanup revision now in progress.

Root's fresh native Node24 integration completed at 12:18:34.519Z in
`/home/jackberrow/.cache/sgsd-native-verification/root-integration-9otYw8/evidence/`:
worker 92/0/2, Atlas 100/0/4 (global 45/45), board/routing 15/0/0,
propagation 72/7/0. The same seven published snapshot-helper failures and
platform/opt-in skip classifications remain. All 1,106 source/config inputs and
protected-state comparisons were unchanged. Suite stdout SHA-256 values are:

- Worker: `f1b6e5dbe2f1d05c260edd6158e2651c1c3e8d62e1c89ac6f289814fa2635001`
- Atlas: `85b12b8b9f026302635856dd8036ab38d0a2c68ef0c30d18cf097fd61c66740c`
- Board/routing: `526a9c3a0eb3cf1919ec277d55d9633cac0d03fd14b5605a35e655cc9cb0d04c`
- Propagation: `e4673fac275578eb48af94ca1c0252700eccda3b8fd665460f8a059d40d6bdf8`

For the actual registered review, this private candidate's Git index was given
the published 2770952 baseline blobs for exactly the four scoped files. This
produced a real four-file diff without changing source bytes or production Git.
The retained review intent records that baseline; the earlier verification
manifest continues to describe its original observation time.

The pinned native0.153.4/Sol/xhigh re-review reached its 180-second limit at
12:23:11.158Z; one explicit same-thread continuation reached the same limit at
12:28:42.946Z. Both have exit5, no verdict, and preserved timeout evidence:
`.planning/reviews/170-08-quality-rereview-nLEORE/` (worker
`ed5a2dd9-c604-46d8-8747-108c52e606a9`) and
`.planning/reviews/170-08-quality-rereview-Vust6Y/` (worker
`01405320-d97e-4588-9828-7a9634785388`). Native metadata shows the continuation
was still generating, with no pending question/tool, when stopped. Its zero
observed response records are unknown usage, not zero spend.

The planned one-off `custom:360` review allowance changed no model, default,
receiver deadline or acceptance limit. It completed in 29,214ms at
12:32:18.416Z, but returned CRITICAL1/WARNINGS0/PASS_RATE90: the port repair is
confirmed; `global.test.cjs` cleanup can ignore corrupt/unreadable records or
mistake an uninspectable identity for a stopped process, then delete its evidence.
The 704-byte verbatim [review](170-08-ATC-REVIEW-02.txt) has SHA-256
`a8d70c935f6902c92d4e6c65e4121d6338111aaae5b08d65812bab67577dc8bc`.
Evidence is `.planning/reviews/170-08-quality-rereview-vR3HWu/`, worker
`51f70164-63f6-4b80-a795-9439896967b2`, thread
`01a0861c-877d-7da0-ae9a-e0464dc63ac1`, turn
`01a08627-3172-7271-bc13-30bb0157bf0c`, Atlas run
`sgsd-a990577a-6554-4c20-a685-c0bc7511ab74`. It is terminal; production is
unchanged. Existing route/gate/review/value/edge writers recorded both timeouts
and the actual blocking verdict, preserving every ledger prefix. Receipts are
`rereview-timeout-ledgers-3bLpeD/result.json` and
`atc-block-02-ledgers-5B7uxA/result.json` in root's private local helper directory.

Native RED in `repair-cleanup-review-red-Cz4ulZ/evidence/` reports 0/5 for corrupt
record, unreadable record, exact-self identity, permission-limited live identity
and readiness cleanup with permission-limited inspection. The implementer is
repairing only test-helper cleanup and regressions. Independent SPEC and actual
registered QUALITY are required again; earlier passing tests are not a gate pass.

## Native usage diagnostic and normal-launch dependency

The first 12:20Z re-review emitted 16 native response records. Root independently
matched all 16 to the 16 accepted Atlas events, with zero invalid, duplicate or
conflicting events and no pending spool for that private review project. The
conservative `native_usage_line_limit` warning remains: seven non-usage rows in
the exact retained native prefix exceed the reader's 65,536-byte bound; no native
usage row does. The initial diagnostic incorrectly enumerated a 256KiB threshold
and is retained, with a separate corrected diagnostic at the actual threshold.
Corrected diagnostic SHA-256:
`26f014594681d4658a2f0a45b883c4d6b9aa3376c7a16475696470866ca8600b`.
Both verified the same retained prefix hash
`5ff0bd1e095313d09fa9559966bb7005930dc619d4f9724932a0009fb09800e7`.
This establishes these 16 response joins, not exhaustive capture, zero spend
for timed-out turns, or permission to clear a coverage warning.

A separate zero-provider fake-tmux reproduction confirms the normal Linux
launcher can put NVM's older Codex before the caller-selected binary and can
lose selector/argument values to an existing tmux server environment. No actual
production tmux environment drift is asserted. The prospective
[170-09 launch plan](170-09-LINUX-LAUNCH-ENVIRONMENT-PLAN.md) is dependency-blocked
until Task4 QUALITY passes. It retains original-cwd selection, the existing
worker helper, explicit/default failure distinctions and bounded new-session
environment handoff. No model/auth change, global tmux environment mutation or
benchmark-only selector substitution is allowed to manufacture acceptance.

## Cleanup review checkpoints and acceptance preparation

At the 13:06Z checkpoint, native global cleanup tests passed53/53 at test hash
`733e6878fab1f6eaa90ca92b7a4d602437369e5f6f9bb22e928d73e0ee55bc4f`.
Root integration `root-integration-9pVROC/evidence/` completed13:02:42.734Z with
worker92/0/2, Atlas108/0/4, board/routing15/0/0 and propagation72/7/0; protected
state and all copied inputs unchanged. The four stdout hashes are, respectively,
`9240d7f93e3d643cdbdaa231f159b5cbe01d6ddf1a315e2112d0056a8d58d425`,
`6614075786da9cfb118cc7d067f437a7b1e58106df95858d303c07efce914082`,
`4b9090473c37c37ee223e57c6beff134c7b4ba760fcc12a072e3d3dbb47089f5`,
`cc616d6b32c0681904b56b5320efb18a594ef22aa5aa3e295e2b9523632761e9`.

[SPEC04](170-08-SPEC-REVIEW-04.md) nevertheless found three regression finalizers
that call checked cleanup, then unconditionally delete from nested `finally`
blocks. Root confirmed this code path independently. It is `fix_required`, not
a passing review; those callers were subsequently repaired before SPEC05 and the
next registered QUALITY. This is a specification review finding, not another observed
ATC invocation. Production port code and the two profile fixtures remain frozen.

The first cleanup RED's exact-self root-preservation assertion was overstrict:
proved self is an intentional in-process fixture, never signalled, not an unknown
detached receiver. Retain its observed failure but do not cite it as a leak proof.
Corrupt/unreadable records, live permission-limited/hidden-stat identities and
uncertain readiness cleanup remain required failure-preservation cases. Native
hidden-stat ENOENT and positive zombie-state regressions now distinguish unknown
live PIDs from ESRCH-stopped/reused/observed-zombie cases. SPEC04 records the
exact evidence paths, including intermediate failed fixture teardown runs.

Root's new read-only tmux observer initially refused PID1293408; a narrow follow-up
proved `/proc` ENOENT plus `kill(pid,0)` ESRCH, and tmux marks retained pane%7 dead
in `sgsd-worker-benchmark-20260908T1858`. It was not a visibility limitation or a
live receiver. After distinguishing independently verified dead-pane metadata,
the13:02:38Z observer captured five sessions/twenty panes, one dead, with no
mutation and no raw environment/argv output. Its diagnostic hash is
`7e8914319ca40783e30a7689062cb2f0e4c0ce93d7adb374cc853e214f09f19d`.
That diagnostic predates final field-name alignment; it is not a future launch's
preservation receipt. No session was restarted or removed.

[SPEC05](170-08-SPEC-REVIEW-05.md) passed the caller-only repair at test hash
`7b95e17c7132fd422fe0a72ec0abce7d66ae695e5104d557fd56123da7f34376`.
Root's independent native integration at `root-integration-lz57ZA/evidence/`
completed13:13:03.332Z: worker92/0/2, Atlas108/0/4, board/routing15/0/0,
propagation72/7/0. Protected state and all1,106 copied inputs were unchanged.
The four stdout hashes are, respectively,
`257ab8541b616970e3bc9726f072c79f13ba22a7b819281e79a8ed32680cbe56`,
`77ff32044b054cb77cf258071bd7bfaa69dc2486f01b8abecab3d3ecc73e9453`,
`5588c4f9584599de351cb077e46e3e18a4eade735d5122dc7edb423133f1569c`,
`ae069a27450c03818e93a9c8bc3c1679262b2350abef97ba15a401a072bfb9ad`.

The fresh registered360-second review timed out13:20:21.082Z with no verdict
in `.planning/reviews/170-08-quality-rereview-U9YVwF/`, worker
`b3a07de3-7439-4abb-b1bb-fe35f667ce79`. It observed21 completed native response
records queued to Atlas, with the conservative `native_usage_line_limit` warning.
These21 have not yet been independently joined to accepted events. Queued is
not receipt proof, and a timeout is not zero spend or a passing review.

The explicitly planned180-second same-thread continuation completed13:23:42.562Z
in66.081s, worker `4569f53c-ea95-41d3-b81c-df68a4408265`, thread
`01a0864e-1ebe-7dc0-b230-9bc878417f3d`, turn
`01a08655-b1e6-7082-89a5-2c30850768c9`, Atlas run
`sgsd-56dc1e1b-9d56-441a-a56d-d451367e10cc`. Transport exit0 returned another
blocking CRITICAL1/WARNINGS0/PASS_RATE90: `validFixtureIdentity` accepts empty
identity fields, permitting root deletion while the referenced fixture remains
alive. The449-byte [verbatim report](170-08-ATC-REVIEW-03.txt) SHA-256 is
`7603ba97439de67ce9ca55ad64e261118afcaaeddbf81553fcda51a601e96c9a`.
Evidence is `.planning/reviews/170-08-quality-rereview-0rGhcf/`. All four source
hashes remained frozen through both reviews. Existing ledger writers recorded
the timeout and blocking verdict; append receipts are
`cleanup-timeout-ledgers-7LGRKb/result.json` and
`atc-block-03-ledgers-SZuSif/result.json`. Edge evidence is not QUALITY PASS.

The implementer's native RED at
`repair-cleanup-identity-validator-red-x0XJRf/evidence/` reproduced all seven
malformed live-child cases: empty/nonnumeric start time, empty/relative
executable, empty argument array and empty/blank first argument. Each RED fails
on missing corruption rejection. The test captures later root/liveness/signal
values internally, but those subsequent assertions do not execute after the
first failure; they must not be reported as independently passed RED assertions.
Each exact test child is cleaned using its restored valid identity before that
assertion. No older process was touched. The repaired test file is frozen at
`b979f2c1c0de5b60fdcc995ecc0f9a776e0b38fdab056e4af4065fd7203dfcf5`.
Reported native GREEN is15/15 focused,28/28 cleanup slice and67/67 full global
in `repair-cleanup-validator-green-global-RrVe7l/evidence/`.
[SPEC06](170-08-SPEC-REVIEW-06.md) independently passed. Root's fresh native
integration `root-integration-P3RNwg/evidence/` completed13:35:22.609Z:
worker92/0/2, Atlas122/0/4, board/routing15/0/0, propagation72/7/0. All1,106
inputs and protected state remained unchanged. The four stdout hashes are
`6b9d2194f2b6d771ea677a76b600f3dc41ae733d58bf120debe8aae78c76a3c7`,
`151e4e825022bbecec0e133bdb47c7da1f1853fb6389153bf25431f05d56f612`,
`c9213e6cef6897cb710dddb908689567bc649259a0e78e70e8b2723e18611cac`,
`81e500df355b1bba92510d3c70883bb5656c33e67b94fd94f6b6313383475a56`.
These results are not the pending registered QUALITY verdict.
Production `global.cjs` and both profile-fixture files remain unchanged.

The registered changed-revision re-review completed13:41:21.940Z in72.865s:
CRITICAL0, WARNINGS0, PASS_RATE100. The163-byte
[QUALITY04 report](170-08-ATC-REVIEW-04.txt) is byte-verified at SHA-256
`e7a0886a214dffeebd05404b678679cd0d821c12c3ccd936ef8373f46be36409`.
Worker `c8135301-7e1f-4368-97f6-9d7a96b2d448` resumed the completed review03
thread in the same private project, with new turn
`01a08665-c255-7fd0-a1cc-37741665bbeb` and Atlas run
`sgsd-5e6854e4-d11b-4957-8bb8-c714d76be637`. Evidence is
`root-integration-lz57ZA/source/.planning/reviews/170-08-quality-rereview-WLKWrM/`.
Before importing only the verified test delta, the helper preserved all four
previous source files and the original integration manifest/results under its
read-only `previous-revision/` archive. The new complete1,106-input manifest
matched P3RNwg before review, and all inputs were unchanged after review.
Historical reports and manifests were not overwritten or called current source.

This is Task4 QUALITY PASS, not phase-close, deployment or acceptance PASS.
Its adapter is terminal. Three native responses were queued with zero pending;
the conservative line-limit coverage warning remains, and accepted-ledger joins
for these three are not yet independently verified. Existing route/gate/review/
value/edge writers recorded the pass, preserving all prior ledger prefixes:
`atc-pass-04-ledgers-mEemg2/result.json`. The planned170-09 launcher dependency
is now activated; it must pass its own reviews before publication.

Root's one-use acceptance helpers now prepare a hash-verified private B1 source
and dependency copy; B0 reads its manifest without running tests or wrappers.
The Fable launch command no longer substitutes a Codex selector or PATH. New
read-only observers bind actual Fable executable/invocation, worker adapter and
native child identities, and compare existing tmux sessions/environment metadata
without mutation or raw environment/prompt disclosure. A zero-provider private
helper smoke at `root-launch-helper-smoke-knqrbM/result.json` passed8 assertions
at13:19:05Z, including positive identity checks, wrong-parent/adapter refusals,
private B1 environment, repeat refusal and tamper refusal. Independent review
approved this narrow helper scope. This is not an actual Fable launch, deployed
launcher verification, completed B1 preparation or acceptance result.

A separate zero-provider preflight-preparation diagnostic subsequently completed
13:41:45.778Z against the unchanged installed2770952 runtime at
`/home/jackberrow/benchmarks/sgsd-linux-completion-20260909-0TmF7v/`.
All nine prerequisite checks passed, and its private B1 copier prepared7,251
source/dependency entries. Runner SHA-256 is
`51f9cc2309a9360f9fd489f2b055f92f05ccfc2287820756ee97eae29a0706d1`;
input manifest SHA-256 is
`374f98fba816d507cb441e1189b07acdf7674d5c196406b6caacef7314e29d1f`.
It ran no tests, Fable launch or provider call. It is explicitly not eligible as
the future postdeployment acceptance baseline. The read-only inventory still
shows7 protected files,20 panes,8 separately protected processes and48 pins;
the existing fleet shadows/default gaps remain visible, with zero repair actions.

## Remaining work

Task4's frozen repair now passes independent specification and registered
quality review. The normal launcher repair and its own reviews precede another
bounded acceptance. P170 still lacks its formal phase gates; prose-only earlier
plans need explicit contract reconciliation rather than a retrospective legacy
exemption. P171 operation adapters/correlation and P172 reporting remain pending
their dependencies. Gate, MUDA, ATC and invocation coverage is PARTIAL, not full
weekly monitoring. Windows is a separate OPEN_REQUIRED workstream. The required
24-hour calibration and two complete seven-day measurement windows cannot be
replaced by software test results.
