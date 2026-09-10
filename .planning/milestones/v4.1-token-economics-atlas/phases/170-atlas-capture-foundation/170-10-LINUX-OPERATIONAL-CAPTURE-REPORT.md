# Linux operational capture — overnight evidence

Status: IMPLEMENTED_VERIFIED, publication/deployment pending at 02:13Z. This report is
not a passing phase gate, completed weekly baseline or replacement for any
previous failed acceptance evidence.

Operator-authorized window: 2026-09-09 22:42:46 UTC to approximately
2026-09-10 07:42:46 UTC. Governing active plan: 170-10.

## Baseline, before changes

- Published and installed source: `effccead303145f7330f83fb7676761cfd8c999f`.
- Private native source copy:
  `/home/jackberrow/.cache/sgsd-native-verification/overnight-capture-P2kULUxS/source`.
  Tests run only in complete private copies, not the update-managed checkout.
- Existing Atlas suite: 126 tests, 122 passed, 0 failed, 4 skipped; 29.502 s.
  Evidence: sibling `baseline-atlas.stdout` and `baseline-atlas.stderr`.
- Existing worker suite: 94 tests, 92 passed, 0 failed, 2 skipped; 41.403 s.
  Evidence: sibling `baseline-worker.stdout` and `baseline-worker.stderr`.
  These were offline suites, not live provider probes.
- Receiver-only resource sample: stable PID 2957105, 300.286 s from
  22:54:50.199Z to 22:59:50.485Z; 0.592768% of one CPU core; sampled peak RSS
  74.85546875 MiB. Evidence: sibling `baseline-receiver-resources.jsonl`.
  This does not measure all SGSD processes or prove loaded performance.
- Read-only Clarity metrics census: approximately 89,344 readable records,
  28,851,405 bytes; 17,977 since Monday 2026-09-07, 71,266 older, 8 with unknown
  timestamp, 93 malformed. Source was live, so counts are time-specific.
- One historical non-core file, `v30-06-bulk-reembed-log.jsonl`, is root-owned
  under a user-owned project; strict same-user source policy must report this
  per-source gap without suppressing the rest of the project. No ownership or
  source data was changed.
- Receiver remained healthy at 23:18Z. Existing native coverage was partial,
  with 741 rejected native records, 9 missing stable identities and 0 rejected
  native responses. These historical counters are not operational-capture
  evidence and are not silently reset or represented as resolved here.

## Implementation progress

- T1: content-free source projection and incremental reader in progress.
- T2: additive producer observations and structured MUDA detail in progress.
- T3: receiver-owned automatic collection pending verified T1/T2.
- T4: read-only report, audit integration and installation checks pending T3.
- Active plan amended and validated with the existing schema validator at
  23:17Z: VALID. Amendment includes bounded seven-day historical bootstrap,
  separate operational storage, and the fixture-discovered MUDA wrapper-error
  path repair. Gate thresholds and qualitative verdict parsing remain intact.

No completeness, Linux rollout, current-session refresh or token-spend-total
claim is made until fresh evidence is recorded below. Windows remains required
and outside tonight's Linux implementation increment.

## Native candidate verification and review, 23:27–23:40 UTC

- Frozen T1/T2 focused candidate: 30 tests passed, 0 failed, 0 skipped,
  1306.665 ms. Evidence: `t12-native-final.stdout` in the private native root.
- Worker regression: 36 tests, 34 passed, 0 failed, 2 existing skips,
  37460.445 ms. Evidence: `t2-worker.stdout`.
- Native producer self-tests: gate-value 14/14, route 16/16, review 18/18,
  live writer 10/10, edge guard PASS. Bash syntax passed. Per-writer stdout and
  stderr are retained in the same private root. The old route assertion failure
  was reproduced from an untouched HEAD copy before its expected count was
  corrected from 10 to the already-existing 11; routing behavior did not change.
- An initial Linux MUDA fixture incorrectly assumed executable source mode;
  source is tracked as 100644. The fixture now explicitly invokes Bash, matching
  the production invocation. The failed `t12-native.stdout` is retained, not
  overwritten by the passing final receipt.
- New platform reviewer threads were refused by the session thread limit.
  Two fresh SPEC reviews were attempted through existing `codex-exec.sh`, each
  with a 360-second watchdog. Both timed out without a verdict: neither passed
  SPEC or registered ATC. Original timeout reports and wrapper evidence remain.
- T1 review worker: `29a30def-2b93-4564-bc56-e4685861ab2a`, Atlas run
  `sgsd-e06bbb26-cf90-4bbf-9477-87085892d63b`. T2 review worker:
  `9792494e-04a6-419a-9600-ddcd7c4fd7c3`, Atlas run
  `sgsd-1d63aff6-09f8-4d26-a651-532a1746d924`.
- Actual T2 steering command `a54fb08e-7f80-45dd-8337-041350fc3f5f` was marked
  `applied` at 23:35:45.290Z. This proves the host forwarded that control, not
  that the review completed or that the old benchmark passed.
- Both workers reported `native_usage_line_limit`. Code inspection confirms
  this is a bounded skipped-line coverage warning, not fatal capture shutdown.
  Final observed/queued response counts were 8/8 and 18/18, with no pending
  observations. Independently read canonical records at 23:36:39Z had matching
  counts and valid checksums: 1,401,776 input + 15,366 output = 1,417,142 tokens;
  cache-read 1,178,112 and reasoning 11,503 are subsets, not additions. This
  covers only these two review runs, not the root API session or the entire
  overnight task. Original native-source reconciliation remains unproved.
- To avoid repeating unproductive review calls, the existing two agents are
  independently reviewing each other's task, not their own implementation.
  Registered quality/ATC remains required before publication. T2 SPEC found a
  confirmed UUIDv7 rejection that would lose exact native worker joins. T1 SPEC
  found weak legacy occurrence identity and malformed SGSD-run acceptance.
  Repairs and focused regression tests are in progress; no task is accepted yet.

## Candidate repairs and registered ATC, 23:40–00:10 UTC

- UUIDv7/run-shape and fallback occurrence repairs passed independent cross-task
  SPEC reviews. Native focused suite then passed 33/33 with no skips.
- Registered combined FULL T1/T2 ATC completed with CRITICAL 1, WARNINGS 0,
  PASS_RATE 90: growing JSON snapshots could remain pending indefinitely.
  Worker `0d0811df-8be4-43e6-a509-00404a2512ac`, run
  `sgsd-8645fd43-a178-42cf-a2c3-f722f498d5d7`, duration 110863 ms.
  Actual registry-backed review/gate rows were appended using existing writers
  in the private project, outcome `block`, invocation
  `16d81883-d0cc-4b32-85a3-5a250de34d7e`. This failure is preserved.
- Root independently reproduced both between-poll snapshot growth and growth
  during the read. Deterministic race regressions failed before repair
  (25/27 passed) and passed afterwards (27/27). Final behavior discards ambiguous
  JSON records on same-read size/mtime changes, resets the cursor, and retries;
  same-size JSONL rewrites also reset while ordinary append stays incremental.
- Final native T1/T2 suite: 36 passed, 0 failed, 0 skipped, 880.693942 ms.
  Evidence: `t12-native-race-fixed.stdout`/`.stderr`. Independent targeted
  SPEC recheck returned CRITICAL 0, WARNINGS 0, PASS_RATE 100.
- Registered ATC re-review is pending in `T12-ATC-R2-REPORT.txt`; no passing
  result is presumed. It uses the existing wrapper, a self-contained 42111-char
  repair packet, a 360-second watchdog and per-invocation high reasoning.
  Global model/reasoning/auth defaults were not changed.
- Protected-config check: all five checked config/auth files remained unchanged
  except Codex `config.toml`. Precisely one new trusted-project section for the
  private native verification source adds 121 bytes. Removing only that section
  **in memory** reproduces the baseline SHA-256 exactly. Current SHA-256 is
  `ff186c99e92bd608f454cb11b89c857f9c0d0946dfa618ef477fb7a9d028d9c4`.
  Its mtime, 23:27:16.548Z, follows the first worker creation by 857 ms; the
  writer was not directly witnessed. No restoration or unrelated edits occurred.
  This is recorded drift, not byte-identical preservation or an old acceptance
  pass. Codex remains `gpt-6-astra`/`max`; auth bytes are unchanged.

## T1/T2 acceptance for runtime dependency, 00:09 UTC

- Registered ATC R2 completed: CRITICAL 0, WARNINGS 1, PASS_RATE 90. Its finding
  explicitly closes the prior critical and requests two direct JSON tests.
  Worker `39dab15b-aad0-41e2-8739-53e9313cfb10`, run
  `sgsd-7c15b061-0f1c-45b9-8e81-f236680dd2ae`, duration 81287 ms.
- Actual review/gate writer evidence preserves outcome `warn`, invocation
  `067c64fb-46f2-4ee0-abb7-c03c88ed90bf`, in the private source project.
  This is not rewritten as a zero-warning reviewer report.
- Explicit JSON shrink and same-size rewrite tests were added with no production
  code changes. Native T1/T2 suite: 38 passed, 0 failed, 0 skipped, 1414.109846 ms.
  Evidence: `t12-native-atc-warning-closure.stdout`/`.stderr`. Diff check passed.
  The warning is closed by those checks; no paid re-review of unchanged
  production code was run solely for adding the requested tests.
- T1/T2 accepted for T3 dependency. T3 receiver implementation is now active;
  T4 report interface preparation is read-only pending its durable schema.
  No new source revision is published or deployed at this point.

## Native usage source reconciliation, 00:11 UTC

Read-only comparison of the four exact overnight reviewer thread/turns against
their original native `token_usage_record` rows and stored Atlas responses:
28 original responses, 28 canonical responses; 0 missing, extra, duplicate,
invalid or count/identity mismatches. All four native files were stable across
the read. Oversized usage records: 0; oversized **non-usage** records: 17.
Thus the recorded native line-limit warnings did not lose usage records in
these four observed turns. They are not globally erased or declared harmless
for every other source. HTTP-request completeness remains unproved.

Observed four-review spend: 1,484,048 input + 20,956 output = 1,505,004 tokens.
Cache-read 1,178,112 and reasoning-output 16,870 are subsets. This excludes the
root API session and platform subagents; no full overnight spend claim is made.
Evidence: `overnight-review-native-reconciliation.json` in the private native
root (content-free counts/IDs/source checksums only; no raw transcript copy).

T3/T4 now implement independent allowlisted surfaces against a frozen durable
state/receipt interface. Final T4 integration acceptance remains dependent on
T3 verification. The sequencing-only plan adjustment validated VALID at 00:13Z.

## Actual Clarity mechanical MUDA probe, 00:20 UTC

Existing published `sgsd-muda-probe.sh` ran read-only against Clarity in
156.380932 ms, with no model call and no project audit/ledger write. Exit 2:
narrative age 16537 seconds exceeded the existing 3600-second FAIL threshold.
The git-motion sample measured 0/100 calls; inventory measured 2 against
existing thresholds 16/40. Haiku-failure stamp and review line-count inputs
were absent (the latter denominator 0), so their raw PASS verdicts are explicitly
classified no-input rather than measured successful coverage. Overall numeric
coverage is partial. This is a real workflow finding, not a telemetry failure
or authorisation to repair Clarity's narrative subsystem. Post-deployment audit
and ingestion of actual MUDA rows are still required.

Evidence: `overnight-clarity-muda-probe.json` in the private native root. Only
selected typed numeric/boolean/enum data is retained; no source prose or paths.

## Installer dependency RED, 00:23 UTC

The existing hook dependency graph includes `atlas-observation.cjs` for four
hooks, with no missing packages or graph errors. The existing manifest-drift
gate correctly fails because its declared dependency arrays are stale.
Evidence: `t12-hook-manifest-red.stdout`/`.stderr`; no install was attempted.
The active T4 allowlist now includes only the required derived manifest refresh
via the existing renderer. Hook registrations and installer gates stay unchanged.

## Real-source shadow verification, 00:46 UTC

A private, non-service collector root read Clarity's actual ledgers without
changing those source files, launching a worker, or upgrading the live receiver.
Thirty accelerated manual cycles took 4112 ms, reading 6382 records; 5732
observations had durable receipts (9 accepted, 5447 excluded before the fixed
seven-day window, 276 rejected). Source verification matched 5731 checksums
with zero mismatches; one root-owned legacy source was unverifiable. Rejections
were 92 malformed JSON, 183 unsupported schemas, and that one unsafe owner.

The report correctly remained WARN: 14 canonical events awaited receipts and
24,424,352 source bytes remained pending. This WIP snapshot is not full drain,
production deployment, or a weekly baseline. It exposed an under-reported
global backlog and motivated regression checks for static backlog progression,
bounded interrupted batches, and unchanged-source idle I/O.
Evidence: `shadow-clarity-CJsTNm/shadow-result.json` and `shadow-report.json`
under the private native verification root.

## Installer dependency GREEN, 00:56 UTC

The existing manifest renderer ran in the complete private Linux candidate.
Exactly four hook dependency arrays gained `scripts/lib/atlas-observation.cjs`;
no other manifest fields changed. The generated changes were imported into
the worktree, and the native existing `--check-manifest` returned success.
This is delivery metadata repair, not a gate or hook-policy relaxation.

## T3/T4 first frozen native integration, 01:08 UTC

The 28-file candidate matched SHA-256 between this worktree and the complete
private native copy (`T34-frozen-manifest.json`). Existing hook-manifest check
passed. Full Atlas: 190 tests, 186 passed, 0 failed, 4 skipped, 30935.589354 ms;
its nested runtime runner separately records one optional real-stack skip.
Full worker: 94 tests, 92 passed, 0 failed, 2 skipped, 41585.970201 ms. Both
stderr files were empty. These are private fixture checks, not live acceptance.
Evidence: `t34-native-frozen.stdout` and `t34-native-worker.stdout` with paired
stderr files. Earlier WIP integration (180 passed, 2 failed, 4 skipped) remains
preserved in `t34-native-integration-wip.stdout`; its report defects were repaired.

The real-source shadow used a new private output root, the production 256-record
default, a 256 MiB Node heap setting, and a restart after 12 cycles. At its fixed
1200-cycle stop it had 51504 durable observations; three restart cycles advanced
that to 51517, with 11,679,500 source bytes still pending. Elapsed time including
verification was 137748 ms; process CPU 42410.996 ms; sampled peak RSS 249704448
bytes. This accelerated run is not a production rolling CPU/RSS acceptance.
Source checksums: 51516 matched, 0 mismatched, 1 unsafe legacy source unverifiable.
Canonical join: 10773 rows matched receipts, 0 missing, mismatched, orphan,
duplicate or conflict rows. Status correctly WARN with incomplete source coverage.
Evidence: `shadow-drain-0zGDcb/shadow-result.json`, `shadow-report.json` and samples.

## Independent T3/T4 SPEC failures, 01:11 UTC

Despite green standard suites, independent cross-SPEC reviews rejected both
first frozen candidates. No ATC pass, publication or deployment is inferred.

- T3: pending same-size JSONL rewrite could retain stale occurrence identity;
  restarted health could hide durable source gaps; deletion of a previously
  tracked source had no missing-source observation. Reviewer verified all six
  frozen hashes; standard focused suites passed 38/38, three adversarial cases
  failed 0/3. The T3 author is repairing these cases with regressions.
- T4: coordinated receipt/canonical truncation was not checked against durable
  state counts; directory listing allocated before applying caps; registration
  validation did not require schema version. Standard report/audit tests passed
  15/15. The T4 author is repairing the bounded defects before independent recheck.

Both review failures and the first frozen evidence are retained. No source
ledger, model default, auth setting, old session or live receiver was changed.

## SPEC repair verification and complete shadow drain, 01:26 UTC

Both independent cross-SPEC rechecks returned SPEC_PASS. T3's original three
adversarial cases passed 3/3 and runtime/receiver passed 41/41. T4's repaired
conservation, directory bounds, registration schema and state-generation race
checks passed 17/17. Root native full Atlas passed 191/195, with 0 failures and
4 platform/optional skips in 31443.046878 ms (plus the separately reported
nested optional runtime skip). Exact 28-file local/native hashes matched in
`T34-spec-repaired-manifest.json`; stdout/stderr `t34-native-spec-repaired.*`.

The second private actual-Clarity drain completed at 01:23:15.659Z after 3589
accelerated cycles: 87,011 durable receipts, 0 pending bytes/sources. All 87,010
verifiable original source checksums matched, with zero mismatches; the one
unsafe legacy source remained explicit. All 46,180 canonical rows matched
receipts, with zero missing, mismatched, orphan, duplicate or conflict rows.
Three restart cycles each read zero ledger bytes/records, took 3/4/3 ms, and
preserved both counts and the degraded unsafe-source status. Runtime SHA-256
`5b3df7947883c047038dcf36dc43103c9ef58fc6e656acc1172a74b920d0f9b9`.
Elapsed including verification: 354760 ms; CPU: 99668.278 ms; sampled peak RSS:
252096512 bytes. This is an accelerated private run, not live rolling overhead.

The current stricter report then found one genuine counter discrepancy: the
unsafe source had one receipt and source counters rejected=1/gaps=1/records=0,
while the global durable records count correctly equalled 87,011. The failure
path omitted its per-source records increment. No observation was missing; the
author is repairing the counter with a regression. This new report FAIL is
preserved, not relabelled as passing conservation. Evidence under
`shadow-drain-r2-d2lHG1/`, including `shadow-report-current-reconciled.json`.

## Registered T3/T4 FULL ATC BLOCK, 01:30 UTC

Actual reviewer worker `80176e6f-c19f-4a63-9d1b-466b23352a4c`, run
`sgsd-06913060-9892-4943-88ee-2fc7490b23be`, completed in 211558 ms through
the existing wrapper: CRITICAL 2, WARNINGS 1, PASS_RATE 70. Report SHA-256
`6475dca72015f2a9ca0511911550211b5b39aa3184a0c98ed5423e4eba6b87d1`,
1154 bytes. Existing registry and review/gate writers recorded outcome BLOCK,
invocation `c69595fb-b030-49ca-92d2-5185646a0d7d`, once.

Findings: partial/raced canonical scans could become definite join failures;
conflict receipt proof and distinct orphan accounting were incomplete; receipt
capacity was checked after canonical ingestion without a durable capacity gap.
The authors are repairing these exact paths and extending the receipt proof
interface within the active plan. No publication or deployment is authorised
by this failed gate. Evidence: `T34-ATC-REPORT.txt`, `T34-ATC-EVIDENCE.json` and
paired wrapper output. Original gate history remains intact.

Measured Clarity bootstrap occupies 110,611,691 receipt bytes and 60,008,811
canonical bytes before additive conflict proofs. The active plan raises only
the receipt cap from 128 to 256 MiB/project to provide finite weekly-trial
headroom, retains canonical/index/cache limits and the 10% free-space floor,
and prohibits evidence deletion. This is a demonstrated capacity correction,
not a claim that any bounded recorder can capture indefinitely.

## Final repair candidate, 01:59 UTC

T3 repairs passed independent SPEC on exact runtime SHA-256
`061d2bfe5fc8c040221ee88793c6c6f6c17e44f821a3f52129581bea54f734d3`:
23 runtime tests and a separate conflict-to-duplicate crash/replay adversary
passed. Receipts now carry exact candidate canonical proof, capacity/free-space
admission precedes canonical ingest, full capacity persists a gap and pending
cursor, receipt batching is linear, and unsafe-source records conserve counts.
The earlier real-source counter failure remains preserved in its original root.

T4 recheck initially found an additional partial-scan error: a conflict read
before its unscanned parent was marked corrupt. RED 0/1 reproduced that failure;
GREEN 1/1 verified the repaired distinction between absent-unseen and proven
absent/wrong parents. A further reporting check rejected definite numeric
missing/mismatch/orphan labels during incomplete reads. The repaired report
uses null counts and explicit incomplete/unverified status, retaining definite
failures only when evidence supports them. Final independent SPEC_PASS covers
report SHA-256 `57573e86e713dc4438f0a4b2f79218c08cda05f4b04fd260b495a2081708e6ef`
and test SHA-256 `87c20758b7b8d23c6108e81d029caeac72fd29c406da83eb64eeec90bea928a5`.
Private report/audit passed 19/19; combined runtime/report/audit passed 42/42.

Root native final candidate matched all 28 source hashes in
`T34-publish-candidate-manifest.json`. Full Atlas: 200 tests, 196 passed,
0 failed, 4 skipped, 30914.762271 ms, plus the separately reported nested
optional real-stack skip. Full stdout was read; stderr was empty. Existing
manifest check and current plan validation passed. Earlier 01:47/01:52 candidate
results remain in separate files; the latest output is
`t34-native-publish-candidate.stdout` with its paired stderr file.

Registered FULL ATC R2 started at 01:58:55.476Z with a 108350-byte self-contained
production-code/repair-test packet, SHA-256
`a59148f89c0f00926d6fe1a92af887cd773f41b339880584e7d0cf4508d9a9f6`.
It is an actual new review invocation, not a fixture or assumed pass. Publication
remains gated on its result. No new source revision or deployment yet.

Read-only live census at 01:56:14Z: 17 registered roots, ten still present;
32,948,235 bytes of metric source files, including 29,719,747 in Clarity and
3,222,500 in the private native review project. Seven removed historical test
roots remain registered and must be surfaced, not silently deleted. The unsafe
Clarity source is exactly the 324-byte root-owned May 21 re-embedding log;
current phase resolves to `.planning/phases/v30-07-product-intelligence-api`,
where WASTE.md is absent. No project evidence or ownership was changed.

## Registered T3/T4 ATC R2 BLOCK, 02:03 UTC

R2 completed at 02:02:52Z through actual worker
`486226a8-f5c0-445e-bb03-ea80420b3003`, run
`sgsd-f86e3d5a-f80c-4a75-8247-2d88a6ad6af6`: CRITICAL 3, WARNINGS 1,
PASS_RATE 64, duration 236519 ms. Report SHA-256
`2164d7d8f577041cb2c9533f70e681ac6474c642616cc3e8215509b66fd01eba`,
1472 bytes. Existing registry/writers recorded outcome BLOCK once under
invocation `537cc299-c135-4f67-b1f6-9a9bae7d2a25` at 02:03:48Z.

Findings: defer parent-payload relational checks during partial/raced canonical
scans; reserve worst-case finalized receipt bytes (duplicate is longer than
conflict); do not classify unread buffered text after a receipt row limit as
corrupt; create/validate the private operational directory before the first
unsafe-source capacity check. Authors are repairing these exact paths with
regressions. Earlier passing fixtures/SPEC do not override this failed gate.
No new revision published or deployed. Evidence: `T34-ATC-R2-REPORT.txt`,
`T34-ATC-R2-EVIDENCE.json`, paired wrapper files and exact R2 source snapshot.

## T3/T4 accepted: native tests and retained-thread ATC R3, 02:13 UTC

Both independent cross-SPEC rechecks passed the exact R2 repair delta. T3
runtime SHA-256 `4b028c06064281f2efa8163fa6b44b8dd7b9d5b5a84739da44b984e3b6359cb3`,
test `304d115850c19b0ca131e4094e96aba7b5cf530635322cc396d598a39a49406c`;
focused 2/2 and full runtime 25/25. T4 report SHA-256
`f842fc16fce87d0e5d8e93425138bd493a600b0193677a85bd79f19f3ce77b92`,
test `d51a858071aa09fdeef958fa690299f8909e433bb0dc8fe4189d1141e469daaf`;
focused 2/2 and report/audit 20/20. Root native full Atlas: 203 tests,
199 passed, 0 failed, 4 skipped, 29789.040914 ms; nested optional runtime
skip remains separate. Full output read; stderr empty. All 28 source hashes
match `T34-r3-candidate-manifest.json`; native output `t34-native-r3-candidate.*`.

R3 used the documented `SGSD_WORKER_RESUME_ID` on the existing wrapper, retaining
R2's exact thread and its full reviewed context. No `--last`, new account,
global model change or invented wrapper flag. A fresh 25283-byte exact repair
diff packet replaced repeated full-code transmission; packet SHA-256
`f51d55eaa525fc3cdf54cb17a454baf7ea79f3b05137c6918cfeb92f6a1437fe`.

Actual R3 worker `49e8cc20-bcb3-4689-be7d-9e8b6a911047` resumed R2 worker
`486226a8-f5c0-445e-bb03-ea80420b3003` on thread
`01a0890a-1cf2-7620-b43d-ae9d7e66e673`, new turn
`01a08916-28d9-73f1-8167-8907ede78817`, fresh Atlas run
`sgsd-23878da6-0485-4888-a8b3-fb039b0b2857`. Completed 02:12:43Z,
duration 38723 ms: CRITICAL 0, WARNINGS 0, PASS_RATE 100. Original parsed report
161 bytes, SHA-256 `3a5ce51fa13b47fe72ce19b7b6b0fb1ce6fe4c1401f52d7fe60faf96aaa1e719`.
Existing registry and writers recorded PASS once, invocation
`5f57f895-2b5b-4ba1-9ef5-00400041c40e`, review observation
`254da576-e54e-4a3f-83fa-2edda8ce8079`, gate observation
`bca63647-5eff-4cd3-b26c-53bb4c7bb52c`. Exact resume identity, wrapper result,
actual codex-log duration/model and report hash were checked before recording.

T1-T4 implementation/review is now accepted. Publication and actual Linux
capture/resource verification remain required below; this does not close the
old failed benchmark, Windows, the entire milestone or a week not yet observed.
