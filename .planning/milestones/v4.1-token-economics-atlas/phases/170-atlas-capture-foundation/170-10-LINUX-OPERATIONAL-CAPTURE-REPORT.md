# Linux operational capture — overnight evidence

Status: LINUX IMPLEMENTATION DEPLOYED AND OBSERVED. Core `59762975` was installed
at 02:17Z; reviewed MUDA/save-efficiency repairs `50440c65` at 02:49Z. Actual
MUDA and ATC source-byte/receipt/canonical proofs pass. Automatic historical
backfill continues; historical gaps and unexecuted families remain explicit.
This is not a passing phase gate, completed weekly baseline, exhaustive billing
reconciliation, Windows delivery or replacement for earlier failed evidence.

Read-only weekly check on DEVCP, across registered projects:

```sh
node ~/.claude/tools/telemetry-atlas/audit.cjs --json
```

It includes operational source-digest verification and native-accounting checks.
Exit 0 means checked PASS, 10 means WARN/partial or missing coverage, and 1 means
FAIL. Inspect the named findings: a genuine MUDA failure is captured evidence,
not necessarily a telemetry failure. Idle/nonexecuted families are not invented
activity. Original source records are retained; no weekly analysis model is
called by collection or this audit.

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

## Initial implementation progress (historical)

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

## Publication and guarded Linux deployment, 02:17-02:19 UTC

Published source `59762975abb657f34e60d92665bc45907e4882f3` to origin/master
with a normal non-force fast-forward. Exactly 31 selected files were committed:
28 reviewed source files and the active plan/report/state. All 28 staged Git
blob hashes matched the reviewed native candidate, not merely working-copy text.
Unrelated prior planning edits and `.planning/tmp/` remain uncommitted/preserved.

Normal `sgsd-update.sh` from actual Clarity ran 02:17:25.780Z-02:17:31.596Z,
exit 0. Canonical source and Clarity pin both became `59762975`; global assets
and project hook closure were installed by the existing installer. Existing
hook/settings merges reported zero additions, Codex hooks unchanged, and the
canonical source remained clean. The owned Atlas receiver transitioned from
PID 2957105 to 2275022 on exactly the same three ports. Loaded fingerprint:
`7a5a1516f016abcfd27e91738676830b2a81d0a621f6aaa833debfe30e5addc9`,
new instance `6b64b1dd-2aa8-4a76-bca0-48b00e485142`.

Immediate before/after guard: all seven protected file hashes and all 28 prior
tmux pane PID/start identities unchanged; only Clarity's intended version pin
changed among 53 inventoried pin paths. No other pane/session/pin refresh is
claimed. Evidence `guard-immediate-preupdate.json`,
`guard-immediate-postupdate.json`, `guard-update-comparison.json` and
`linux-operational-update.stdout`/`.stderr` in the private native base.
Receiver-only five-minute resource sampling started in
`live-receiver-sample-SK1axL/`; result is pending, not presumed.

The first actual MUDA invocation used the existing SGSD observer attachment,
run `sgsd-b8a13172-aa85-4e80-9527-e5015232efc6`, then the installed audit on
`v30-07` with `--no-curate`. It exited 1 in 348 ms at 02:18:28Z, with no audit
output. Source inspection found numeric-only phase extraction under errexit
rejecting the real resolved `v30-07-product-intelligence-api` basename before
WASTE.md/ledger append. This is a producer failure, not a successful MUDA gate
or evidence of lost capture. Original `actual-muda-check.stdout`/`.stderr`
are preserved. T170-10-5 now authorizes the smallest phase parsing repair,
regression and normal incremental rollout; no phase rename or fake probe.

## Live checks and producer follow-up, 02:22-02:35 UTC

The first actual receiver sample completed at 02:23:02Z: 61 samples over
300187 ms, stable PID/start identity, 1.152615% of one CPU core and peak RSS
82,866,176 bytes (79.028 MiB). This measures the owned receiver during initial
backfill, not all SGSD processes or a completed weekly soak. The sampler made
zero model calls. Evidence: `live-receiver-sample-SK1axL/result.json`.

The first read-only live operational report took 149 ms at 02:22:33Z and
returned WARN, no FAIL findings. All ten existing registered projects had
matching receipt/state counts and no missing/mismatched/orphan/conflicting or
duplicated scanned canonical joins. Clarity had 3982 observations, 3981 source
digest matches, zero mismatches and one unverifiable root-owned historical
source; its 25,781,898 pending bytes remained explicit. Seven removed historical
test roots were still registered and reported missing capture state. This is
successful checked capture with historical gaps/backfill, not complete coverage.
Evidence: `first-live-operation-report.json`.

Independent rollout verification now distinguishes 28/28 hashes in the actual
canonical DEVCP source from the earlier separate private-candidate 28/28 check.
The 53/53 installed destination checks are unchanged and valid: Atlas 34,
producer libraries 16, mailbox 2, MUDA 1. All 81 actual source/install checks
match the published R3 manifest, with zero errors and the same live fingerprint.

T5 independent SPEC passed the frozen audit hash
`7f93dcaf50e20ba71ae5a29c5b0938ff4b9dbc2986e332750bf4b51f6b26ee43`
and producer-test hash
`43927661c437075395d1cc99d93b7c4aaa4508957318b32f02d0129fab86ecdf`.
Root native private-copy producer tests passed 9/9, zero failures/skips,
1782.928515 ms; full output read and stderr empty. Numeric/dotted prefix
semantics remain intact, namespaced phases are supported, unsupported resolved
identities fail explicitly before writing. T6 now exclusively owns the shared
test file after independent T5 review; neither repair is deployed yet.

Actual selected ATC R3 evidence has now passed independent original-byte to
receipt to canonical proof, using the existing read-only operational report and
exact byte hashing. Review observation `254da576-e54e-4a3f-83fa-2edda8ce8079`
has source SHA `d59ee083a5a159fbb6ade16e818c52336cd068dcddcf13203b881ad48c95b3db`;
gate observation `bca63647-5eff-4cd3-b26c-53bb4c7bb52c` has source SHA
`612a1662d7655f2dda17da5aa96c0175f3f874a07d902682e8c11c2d6ce09528`.
Both have exactly one requested/source/receipt/canonical match, zero errors,
and project source verification `verified`; overall report WARN is preserved.
These are real registered gate/review rows from this work, not synthetic events.
Evidence: `actual-atc-r3-review-proof.json`, `actual-atc-r3-gate-proof.json`.

## Native accounting and in-flight reconciliation, 02:35-02:40 UTC

The existing installed audit exited 10/WARN with empty stderr at 02:36:27Z.
Its explicit historical gaps, unavailable HTTP-request identity, idle sessions,
partial quota windows and operational warnings are retained; no integrity FAIL
was reported. Evidence: `live-audit-0237.json` and paired stderr (filename is a
label; the actual time is the recorded generated timestamp).

An independent read-only comparison now covers all seven actual native review
thread/turns: 31 original TokenUsageRecord responses equal 31 canonical response
observations, zero missing/extra/duplicate records, zero usage/identity/hash
mismatches, and stable original files. Totals in this strictly bounded scope:
1,655,048 input + 35,657 output = 1,690,705 tokens. Cached input and reasoning
are subsets, not added again. This excludes the root API and platform agents,
does not reconcile unavailable HTTP request IDs or billing, and is not a total
for all overnight work. The earlier four-turn proof remains unchanged. Evidence:
`overnight-seven-review-native-reconciliation.json`, checked 02:38:43Z.

The live 02:35:36 report briefly showed five canonical records awaiting receipts.
Independent read-only follow-up showed two at 02:38:29, then zero at 02:39:22:
391 canonical rows/391 matched receipts, receipt/state counts both 15698.
The two intermediate event IDs were checked explicitly; their writes occurred
at 02:38:16Z and later received receipts. This was a canonical-first in-flight
batch, not persistent lost data; no evidence was edited to clear the warning.
The original report remains preserved as `live-operation-report-0238.json`.

## T5/T6 frozen candidate and registered review, 02:42 UTC

T6 independent SPEC passed the exact frozen helper
`466d1b486ca6c6a07d4663e179e2db9931b69ba18e4fd4b705be9514fefdfaae`,
shared producer tests
`416eed505f4322f2a272b53fec65fce80abf01e2cbb7cef701e143a51202e8e5`,
and README `d1e3549d99b451940de18f6e99b8afd0aa1d8f65b68a8e5bd14ef60a99101c64`.
T5 audit hash remains unchanged. Effective fallback run identity is included
in save comparison; actual identity/status/pending changes, all control
boundaries and failed-append retries are covered. Primary mailbox publication
and native usage persistence still execute on observationally coalesced saves.
Independent focused 3/3, merged producer 11/11 and existing mailbox
control-history 1/1 passed; the reviewer made no edits.

Root verified all four native candidate hashes, then ran the complete native
Atlas and worker suites: Atlas 205 tests/201 PASS/0 FAIL/4 SKIP, 33022.062413 ms
(nested optional runtime skip separate); worker 94 tests/92 PASS/0 FAIL/2 SKIP,
47162.753692 ms. Full outputs read; both stderr files empty. Evidence:
`t56-native-atlas.stdout`, `t56-native-worker.stdout` and paired stderr files.
These private fixture tests made no model calls.

One actual combined FULL registered ATC review started at 02:42:48.679Z,
step `T170-10-56-atc`, through the existing wrapper's retained T12 R2 worker
`39dab15b-aad0-41e2-8739-53e9313cfb10`. The 40727-byte exact delta/current
helper packet has SHA `55fae9656a513184b9dfaafda3abac4a581762d165741a7635831fba70fbb318`.
The gate result remains pending here; no follow-up publication is presumed.

## T5/T6 actual ATC and tests-only warning closure, 02:45-02:47 UTC

Actual FULL review completed at 02:44:21Z, worker
`9f831e4d-4e5e-46ae-819d-5e8e5fabf612`, run
`sgsd-4e7ccf6a-6cde-46c7-9edb-a637da62f7d7`, retained thread
`01a088a1-8a75-7843-afb3-956ee5c25f9c`, new turn
`01a08932-4dd9-7031-99e7-af2fc0d53c09`. Duration 92013 ms, CRITICAL 0,
WARNINGS 1, PASS_RATE 90. The reviewer found the implementation sound; the
warning requested direct tests for four additional fingerprinted fields.
Existing gate/review writers recorded WARN once under invocation
`30c78ec2-336a-47da-8be1-c8f5b5c7b0a0`; report 462 bytes, SHA
`552efb811f1ade9760c5a67eef808bc17850bba640ff3a4322649721c8d0333e`.
Original WARN is retained, not relabelled a model PASS.

The author added only `worker_id`, `instance`, `role` and `resumed_from`
mutations to the existing regression. Production files remain byte-identical.
Final test SHA `13b52bbb18ae3332f94af9511b4def29034955bd078a4e04b008cdf24f6a7fc0`;
root native producer 11/11 PASS, zero failures/skips, 1735.320486 ms, full output
read and stderr empty. Final manifest: `T56-final-manifest.json`. Independent
tests-only recheck is pending at this entry; no repeated paid review is needed
for unchanged implementation after the narrow warning is demonstrably covered.

The real 92-second review emitted four observations (one create, three changed
saves), 2755 bytes, zero identical consecutive save rows. Normal primary state
publication continued; native capture retained its one completed response with
zero pending records or reasons. Evidence: `actual-t56-worker-coalescing.json`.
All eight actual native review turns now reconcile: 32/32 responses, no missing,
extra, duplicate, identity/hash or usage mismatch. Selected-scope total is
1,699,553 input + 38,362 output = 1,737,915 tokens, excluding root API/platform
agents and not billing. Evidence: `overnight-eight-review-native-reconciliation.json`.

Independent read-only Clarity census found all 22 currently existing supported
sources tracked, plus seven per-phase fallback review files (29 state sources).
Its existing gate-evidence, MUDA and empty live-orchestrator sources are tracked;
19 generic metric files are tracked. Gate-value, canonical review, route,
edge-guard and worker-events files do not currently exist in that exact project,
so no execution/capture is invented for them. Native Atlas outputs are correctly
excluded from operational discovery. Remaining historical pending bytes are
reported explicitly; no supported existing file was omitted from the census.

Independent warning closure recheck passed at the final test hash: exactly the
four requested mutations, focused 1/1 PASS, production helper/README unchanged.
T5/T6 are accepted for normal incremental publication. Existing plan validation,
hook-manifest dependency check, Bash syntax and `git diff --check` all passed.
Original FULL ATC remains WARN with its sole tests-only warning now closed.

## Incremental Linux deployment and actual MUDA, 02:49-02:52 UTC

Published `50440c65f05dadb62754d5afac8464a069a74865` with exactly four reviewed
source/doc files plus this plan/report/state. All four staged Git blob hashes
matched `T56-final-manifest.json`. Normal non-force push and ordinary Clarity
`sgsd-update.sh` completed successfully at 02:49:22Z. Canonical source is clean
at that revision; the Clarity pin matches. Eleven follow-up canonical/install
hash checks all match. The owned receiver correctly reported `already_current`:
its runtime closure is unchanged, so PID/start/instance/fingerprint and all
three ports remain identical. No gratuitous restart was performed.

Before/after guard again found zero changes to seven protected files and all
28 prior panes; only the intended Clarity pin changed among 53 paths. Evidence:
`guard-t56-preupdate.json`, `guard-t56-postupdate.json`,
`guard-t56-update-comparison.json`, `t56-installed-hash-checks.json`, and
`t56-linux-update.stdout`/`.stderr`. Full update output was read.

The actual installed MUDA audit now completed normally on `v30-07` at
02:50:06Z, 1087 ms, exit 2: zero WARN, one FAIL. It wrote the previously absent
WASTE.md and exactly one new MUDA row under observer run
`sgsd-550320d8-4095-4e47-96f3-026ec86d4304`, observation
`0a5d26c6-618a-42ef-9fcf-4b234bdeee9a`. The real failing measurement was
`narrative_age_sec=25504` versus fail threshold 3600; the policy was not changed
to make the gate pass. Mechanical execution is true, synthetic false, coverage
partial because some probes have no input. Qualitative execution was correctly
skipped for mechanical findings (also disabled by the existing configuration);
no provider call or memory curation occurred.

Evidence: `actual-muda-after-t5.stdout`/`.stderr` and
`actual-muda-producer-evidence.json`. The original silent-failure artifacts
remain unchanged. The first source-receipt proof at 02:50:28Z found the new
receipt not yet present while the automatic source cycle caught up; that
first result is preserved, not overwritten. Independent selected-observation
verification is in progress. A second read-only five-minute resource sample
started in `live-receiver-sample-j9eaD6/` with the unchanged receiver identity.

## Actual MUDA capture proof, 02:52 UTC

Independent read-only verification completed at 02:52:53Z: exactly one original
source row, accepted receipt and canonical event match. Original byte offset
723, length 1334, SHA
`9769900a4c3db38c21fa44af442a14284c4b3c4a52dd3d250554bc488ff25eb1`.
Receipt `40acf1cbfec1d39d006a68b9cbba85cd580b185d025534b2632f200dce3ef1dc`
has exact run correlation and producer-observation provenance. Canonical event
`cbc2b5bbf6ae5d37a93c9ef31364e496c1bbe29cc0f2b3e900eef147ad763668`,
payload SHA `14273c541139382f671579fc629dbcc98a97ec93d03350873725a6d1ccbf967c`,
retains that same observer run and the typed real measurements/skip reason.
The source/receipt/canonical chain does not infer a session from a timestamp.

Selected-only proof `actual-muda-selected-proof-final.json`, SHA
`6afae9844d5c04bf3bae22a9f39f942884bc57bb7328f7ecd40164adb5ddf2de`, is retained
in both the Windows private evidence folder and native private base. Root read
the complete proof and checked its file hash. The first pending proof is still
retained separately. MUDA and ATC live capture requirements are now met.

## Final read-only Linux handoff checks, 02:57-02:59 UTC

The second live receiver sample completed at 02:57:19.729Z: stable exact
PID/start/instance/fingerprint, 61 samples over 300183 ms, 0.922770% of one CPU
core, peak RSS 83,955,712 bytes (80.066 MiB). Sampler and passive collection make
zero model calls. This is measured initial-backfill operation, not a completed
weekly soak or the footprint of all SGSD processes. Evidence:
`live-receiver-sample-j9eaD6/result.json`.

Independent installed audit/report at 02:56Z both returned WARN/exit 10 with
empty stderr, a healthy service and no integrity FAIL. Root then saved a final
existing-audit snapshot at 02:59:07Z for durable handoff evidence:
`final-linux-audit.json` and selected `final-linux-audit-summary.json`.
Seventeen registered projects, ten existing capture states; all native invalid,
duplicate and conflict counts are zero. Operational receipt/state counts match
for all ten states, every scanned canonical join is checked, and there are zero
missing/mismatched/orphan/conflicting/duplicate canonical records at this snapshot.

Operational observations: 22,361 total. Source verification checked and matched
22,352, with zero mismatches and nine explicitly unverifiable observations (one
in Clarity and eight in the private review project), not silently counted PASS.
Clarity has 20,873 observations, 781 matched canonical proofs, and 20,025,536
pending source bytes; the private review project has 1435 observations, 1429
matched canonical proofs, and 2,951,031 pending bytes. Eight smaller existing
projects are fully caught up. Seven absent historical test roots remain
registered and explicitly missing capture state. Original pre-window exclusions,
unsafe/malformed-source gaps, unknown HTTP identity and incomplete quota/idle
coverage are retained; the audit correctly does not claim exhaustive coverage.

The implementation and actual-capture work is complete. Historical backfill is
ordinary background data collection, not further coding or another model task;
the already-running bounded receiver continues it automatically. Future weekly
checks must inspect lag/capacity/gap findings rather than assume permanent full
coverage. Existing evidence is not pruned or rewritten. Windows, formal phase
and milestone gates, the old failed bridge benchmark, all-session freshness and
a full week of observed data remain separate work, not falsely closed here.
