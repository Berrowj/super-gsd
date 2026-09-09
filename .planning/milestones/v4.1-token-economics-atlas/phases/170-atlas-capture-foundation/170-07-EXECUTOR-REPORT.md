# 170-07 trial-readiness executor evidence

Status: B0_BLOCKED / B1_PARTIAL. Reviewed repair published and normally installed
as `2770952`; the single fresh acceptance stopped because a direct B0 profile
inspection wrote one production fallback row. Live worker attempts **0/5**.
Coverage census complete with result **PARTIAL**; weekly baseline not established.
No acceptance pass, formal phase close, Windows pass or fleet completion claimed.

## Coverage census

Static and live evidence:

- `.planning/analyses/2026-09-09-atlas-operational-coverage-census.md`
- `.planning/analyses/2026-09-09-devcp-atlas-live-coverage-observation.md`

Both conclude PARTIAL. The source has provider capture but no normalization
adapter for SGSD operation/gate/finding/repair evidence. Eight of thirteen gate
registry entries declare no evidence path; the registry does not enumerate all
runtime gates. Native Clarity events in the bounded 07:55Z snapshot had no
phase/plan/task/gate attribution. Legacy source corruption and separate global/
project-local capture require explicit provenance, not wholesale summation.

## Repair reproduction

- D1 isolated native-Linux RED: an expired prepared boundary still reached
  `old_stopped`; expected only `prepared`. Exit 1; 0 pass / 1 fail / 0 skip.
  Whole test duration 614.34 ms, **not** a measured restart-call duration.
  Fixture `/tmp/sgsd-170-07-red-d1-min-oWDF5m`.
- D2 isolated native-Linux RED: the actual offline wrapper added seven temporary
  project registrations and associated run/lifecycle/gap evidence to an enabled
  parent Atlas fixture. Exit 1, intended state-immutability failure. Fixture
  `/home/jackberrow/.cache/sgsd-native-verification/trial-d2-xN6GGl`.

These synthetic fixtures establish bugs, not provider usage or production trial
economics. GREEN/review/deployment evidence will be appended after verification.

Root independently reran both initial regressions from a new isolated native
copy: **2 pass / 0 fail / 0 skip**, 8.411 seconds, Node22.23.1. All four tested
source/test hashes were unchanged after execution. Evidence:
`/home/jackberrow/.cache/sgsd-native-verification/root-trial-focused-9f1VsZ/{result.json,focused.log}`.
This is an intermediate result, not final repair acceptance: root inspection
then identified a possible post-acquisition lock leak and deadline expiry inside
the whole-/proc port scan. Both need separate regression/review before freezing.

## Intermediate integration and specification review

The first five-file freeze had manifest SHA-256
`7efa53e289f42a1d7f943f73a396acee70b597dd13f7d5f4525d5be4b545d824`.
Root's isolated native-Linux integration at 08:27Z recorded worker 92/0/2,
Atlas 92/0/4, and board/routing 15/0/0 (pass/fail/skip). No candidate input
changed during tests. Evidence:
`/home/jackberrow/.cache/sgsd-native-verification/reviewed-V9Q7tO/evidence/`.
The propagation result was 56/10/2, not green: seven previously known
snapshot-helper digest failures plus three fixture failures caused by root's
inventory omitting `.codex/hooks.json` and `.gitattributes`. Final integration
must include those two real tracked inputs; the guards must not be changed.

Independent specification review returned **FAIL** with two Important findings:
the offline timeout child still inherited parent cwd and could append a second
metrics ledger not covered by the first test; handoff-journal fsync could cross
the deadline before startup-lock ownership transfer. Both require new RED/GREEN
regressions, complete parent metrics-tree checks and a new source freeze. The
README also needs the cooperative/blocking-OS-call deadline caveat. No quality
PASS, publication or deployment is inferred from the intermediate suite passes.

The two review findings were reproduced with separate RED fixtures under
`/tmp/sgsd-170-07-specfix-evidence-x41jQk/`: diagnostic RED added
`codex-timeout-observability.jsonl` to the parent metrics tree; handoff RED entered
the handoff boundary after expiry. Root independently read the saved failures
(UTF-16LE logs, not corrupt telemetry). Both focused regressions subsequently
passed; relative wrapper paths containing spaces are covered too.

Specification re-review: **PASS**, both Important findings closed. Two Minor
README clarifications distinguish parent-project metrics from fixture metrics
and synchronous operations from a single OS call. Quality review is pending.

Root's second integration completed 08:43:37Z, Node22.23.1, source freeze
`1b09d85468e96702530b7ea42d51764657980afe5a4c3fa57ed4ed92173c2c51`:

| Suite | Pass | Fail | Skip |
|---|---:|---:|---:|
| Six-file worker | 92 | 0 | 2 |
| Atlas | 93 | 0 | 4 |
| Board and model routing | 15 | 0 | 0 |
| Propagation | 59 | 7 | 2 |

Evidence: `/home/jackberrow/.cache/sgsd-native-verification/reviewed-wGy0eg/evidence/`.
3,628 candidate inputs were hash-verified, including the two previously omitted
root files; 72 Phase150 artifacts were indexed in the isolated native Git
fixture. No source or candidate input changed during the run. All seven
propagation failure names and the installer digest
`536cf8e46d738febac48a420c10580ca825b73effb60ea6084a9387b75a14ee2`
match the published baseline's `reviewed-YDDdda/evidence/propagation.log` exactly.
No snapshot guard was changed, bypassed or certified; no all-repository-green
claim is made. The ordinary updater contract tests passed in this battery.

Quality review subsequently returned **FAIL**: profile resolution runs before
the offline isolation boundary and can append fallback rows to an inherited
`SGSD_CODEX_PROFILE_LOG` or the source-root default metrics sink. The executor
self-test runs its own fake child, whose resolver inherits that sink too; it is
not a delegation to the review wrapper. Root independently traced both paths.
This requires a private diagnostic profile-log destination before resolution and
an unknown-profile/sentinel-ledger regression for both wrappers. The existing
plan already permits `codex-executor.sh` for a shared self-test leak. A Minor
test teardown catch also swallowed its own failed-termination assertion and must
be narrowed. Publication remains held; the earlier suite passes do not close
these newly identified branches. No new DEVCP worker attempts or deployment.

## Final reviewed repair candidate

The fallback-log RED contained ten appended `unknown_profile` rows in the
protected sentinel ledger (the initial implementer summary mistakenly said nine;
root decoded the preserved assertion payload). Evidence:
`/tmp/sgsd-170-07-profilefix-evidence-p8wT2L/`.
The strengthened isolation regression passes for both wrappers, custom profile
sinks, and corrupt/missing registries using the default source sink. The private
sink is selected before resolution; normal production fallback logging remains
unchanged. The cleanup assertion now propagates. Handoff fault-test setup has a
15-second allowance to reach the injection on DEVCP's large process inventory;
the controlled expiry and original 20 ms / <1000 ms real return test are retained.

Final six-file source manifest:
`9b5bc1479b7fb47c230d92813cb2e4069c9b06d9bcf05537d4ddad0432a9062e`.
Independent SPEC **PASS**, then QUALITY **PASS**, both with no remaining findings.
Root independently reran the complete integration on that exact frozen candidate:
worker **92/0/2**, Atlas **93/0/4**, board/routing **15/0/0**, propagation **59/7/2**.
The seven failure names still exactly match the published baseline. Final syntax
checks (three Node, two Bash) and `git diff --check` pass. Source and candidate
hashes stayed unchanged throughout verification.

Final integration evidence:
`/home/jackberrow/.cache/sgsd-native-verification/reviewed-rbSrhT/evidence/`.
3,628 verified inputs, 85 overlays, 72 indexed Phase150 artifacts; inventory SHA
`beee5c8699e1a41590c99f673d37e3175288720cadaab6382924ddbd5fba6cb6`.
Completion timestamp 09:00:07Z. Target loaded receiver fingerprint:
`c44b0ad3d77721f7b5e796db4112f5ec1112164b5956c6df0af4956760ce60bc`.
Publication, guarded update and the single fresh acceptance remain subsequent
steps; no deployment or weekly-trial readiness is inferred from this candidate.

## Publication and DEVCP/Linux update

Published without force as `2770952f576aeb07fe2f947afdc97151f45910e3`
(the preceding local doc-only commit `3776e249` was included). Staged runtime
bytes were verified against the reviewed six-file freeze before commit.
The user-owned `.planning/tmp/` remained untracked and untouched.

Normal installed guarded updater ran from Clarity at 09:03Z, exit 0. Independent
post-update verification at 09:03:11Z confirmed source and current-project pin
`2770952`, clean source, all 122 comparisons (121 raw plus one expected derived
Researcher agent), matching source/nested/flat Atlas fingerprints, and a completed
owned receiver transition. Receiver PID369447 loaded fingerprint `c44b0ad3...`,
retaining ports44797/43811/36943. Seven protected files, all twelve existing
panes, six additional protected processes and all 47 other pin paths were
unchanged. No model/auth defaults or existing sessions were restarted. This is a
per-user/current-project update, not full-fleet freshness or Windows acceptance.

Private deployment evidence:
`/home/jackberrow/benchmarks/sgsd-worker-trial-repair-20260909-Y5cIfc/`, especially
`deployment-verification.json`, before/after protection and installed hashes.

## Fresh acceptance — stopped at B0

New normal launcher session `sgsd-worker-trial-acceptance-20260909T090501Z`;
operator pane `%12`, fresh Fable PID377569, actual Claude2.1.266, per-session
Fable/xhigh override only. New evidence directory:
`/home/jackberrow/benchmarks/sgsd-worker-trial-repair-20260909-Y5cIfc/fable-acceptance-20260909T090501Z-0vSvpU/`.
Task SHA `accd8a18317341e3fb4224c996d8d8080f51ab46c71be24b3d09be56760025fa`.
Native shell resolves Node24.15.0 and Codex0.153.4. The same Fable finished its
blocked report at 09:23:43Z and was idle by 09:25Z. No live worker was launched.

Launcher deviation retained in `launcher.stderr`: it selected the existing
project-local scripts directory and warned that its cockpit start script was
missing. Root did not repair or restart anything within the benchmark. Global
installation and receiver checks passed separately; the warning and stale local
shadows remain relevant to fleet/session freshness and must not be hidden.

### Observed benchmark result and stop chronology

| Step | Final result | Actual work |
|---|---|---|
| B0 | BLOCKED | Direct profile inspection appended one production fallback row |
| B1 | PARTIAL_BLOCKED | Worker suite 94 tests: 92 pass, 0 fail, 2 skip; other three suites not run |
| B2–B6 | NOT_RUN | No live worker round trips, recovery, steering or deadline test |
| B7 | NOT_RUN | No acceptance before/after capture audit or native usage reconciliation |

The B1 skips were the Windows-only transient-rename test and the explicitly
opt-in local App Server initialization test. Suite reporter duration 46,610.162ms,
wall 46.801s. This does not replace the four-suite B1 requirement. The preceding
independently reviewed/root-verified native Linux suites remain separate evidence.

At 09:12:51.772Z, direct installed
`profile-resolver.cjs --resolve-cli codex.readonly.audit --default-cli review`
appended one `unknown_profile` fallback to
`/home/jackberrow/.claude/.planning/metrics/codex-profile-resolution-log.jsonl`.
`codex.readonly.audit` is a role profile, not a `cli_profiles` entry. This direct
invocation is not `--self-test --skip-network`, whose repaired isolation contract
passed; ordinary production fallback logging was intentionally preserved.
The fallback's built-in model was gpt-5.5, but the configured Architect descriptor
provides an explicit gpt-6-astra/max override. No real board dispatch ran, so do
not report the fallback model as an observed board wire model.

Root sent a read-only installer-classification evidence pointer at 09:13:05Z;
no install mismatch was repaired or gate relaxed. Root independently confirmed
the ledger write and sent a queued stop at 09:17:02Z. That did not halt the active
turn immediately: B1 suite 1 began at 09:17:11Z and finished at 09:17:57Z, before
Fable read the message. Root then revalidated only new pane `%12` and sent one
Ctrl-C at 09:18:39Z. A report-only continuation went to the same Fable at 09:19:22Z.
No new acceptance session, further suite or live worker was launched.

The production ledger remains 1,776 bytes, six rows, SHA-256
`c2283aa62f627256a5f92162f0741f9dc493f8c8d9f0255700dc98537bf6ded5`;
one row falls after this run's start. Root preserved a complete private copy as
`root-profile-ledger-observation.jsonl` in the deployment parent. The row is a
known diagnostic exclusion, not production workload or a row to delete. No
automated exclusion/reporting adapter is claimed. Zero live worker attempts does
not mean zero Fable orchestrator usage; this acceptance did not measure that cost.

### Independent final evidence verification

Fable's `BENCHMARK-RESULTS.md`: 18,201 bytes, SHA-256
`f17c60ae46f408830f93a746d6ae6ae7fed8ac80cfd4603c9c767bd1aef255bc`.
All three declared report/manifest hashes verified. Root separately sealed all
88 evidence files with manifest SHA-256
`37541b993a55f88fb8aeafc03af01ea51c0d7741200804b6b0460513582bf936`.
At 09:29:42Z all 88 still matched. Empty B2–B7/project directories, absent worker
session directories, command evidence and the native Fable tool transcript
support **0 live worker attempts**. Six broad wrapper-name search hits were
inspections/report generation, not launches; root read each complete command.

All 238 recorded installed-file SHA-256 values and recorded Git blobs verified.
190 files match source/pin; genuine stale/derived/independently-owned differences
are classified, not erased. Git blob verification requires the repository's
CRLF normalization for ten PowerShell files; their raw installed/source bytes
also match. This does not certify Windows execution or all SGSD assets.

Post-benchmark protection snapshot at 09:28:00Z verified seven protected files,
twelve prior panes, six additional protected processes and all 48 pin paths
unchanged since deployment (current Clarity plus the 47 other paths). Source is
clean at `2770952`, receiver identity/record/endpoints unchanged and healthy.
The two old benchmark reports remain byte-identical to their prior hashes.
The four new benchmark panes remain; no old session was stopped. There was no
exhaustive post-suite fixture-process census or cleanup claim.

The receiver health snapshot still reports native requests partial, native
metrics observed, native responses unavailable and storage coverage partial;
207 rejected native records at this observation. These global counters are not
attributed to this session and are not B7 evidence or billable usage.

Root evidence in the deployment parent:
`root-post-benchmark-protection.json`,
`root-benchmark-evidence-verification.json`, and
`root-benchmark-verification-corrections.json`. The first root reader assumed an
`ok` health field, TAP reporter markers and raw Git blob hashing; actual contracts
use `status: healthy`, Node24 spec markers and Git clean normalization. Its false
health/blob flags and null counts are retained with an explicit correction using
the same evidence. They were collector errors, not receiver/test regressions.

Fable report errata, preserved without editing its immutable report:

- B1 is PARTIAL_BLOCKED, not entirely NOT_RUN, despite that table label.
- Old pane PIDs3140820/1293381 are launcher shells; actual protected Fable child
  PIDs are3143564/1296359. Root snapshots identify both types correctly.
- The command recorder flattens multiline argv into newline-separated values;
  its `.meta` is not a lossless argv vector. Captured stdout proves commands ran.
- “Installation complete and matching” applies only to inspected dependencies;
  broader global/local agent drift and stale worktrees remain real.

### Handoff boundary

No automatic acceptance retry or phase advancement. A new run needs an explicitly
non-writing B0 procedure: inspect profile registry/source and board descriptions,
or isolate any necessary logging helper under an approved private diagnostic sink.
P170 formal acceptance/gates remain open. P171 correlation and P172 reporting must
then connect operation invocations, gate decisions, findings, repairs and provider
calls, with missing/malformed/duplicate/excluded data counted explicitly. Their
approved calibration/frozen-window requirements are necessary before weekly
economics or savings claims. Windows remains OPEN_REQUIRED; fleet rollout remains
partial. The coverage census is evidence of these gaps, not their implementation.

## Local diagnostic deviation and recovery

An implementer invocation through PowerShell/WSL lost the quoting around a
space-containing Node test-name pattern. Node discovered a broader local test
set in the source worktree instead of only the requested regression. This run
is **not valid scoped verification**. The owned Windows WSL clients were stopped;
the implementer separately revalidated and gracefully stopped its identified
remaining fixture receiver. Other prior processes were left alone. No DEVCP test
or production deployment was involved. No real provider call is evident in the
available diagnostic evidence; that is not an exhaustive network audit.

Two previously clean tracked fixture files were regenerated by that run:
`super-gsd/tools/chronicle/fixtures/sample-sidecar-output.json` and
`super-gsd/tools/context-registry/legal-keys.json`. Root preserved their generated
bytes and hash manifest outside the repository, then restored only those known
task-generated changes via apply_patch. Scoped git diff verified both match HEAD.
No user untracked data was deleted; a transient test stderr file disappeared
during the test's own lifecycle and was not removed by root.

Recovery evidence:
`C:/Users/jack.berrow/AppData/Local/Temp/sgsd-fifo-diagnostic-1c91537ed4d3442b96a4c52867785307/broad-test-recovery-5o34UG/manifest.json`.

The implementer then accidentally reused the broad-run log pathname for valid
D1 RED output, so the original broad-run log was overwritten. Remaining evidence
is the tool/session transcript, scoped process observations and the preserved
generated files; a complete original log is **not** claimed. Subsequent fixtures
and logs must use unique, non-overwriting evidence paths and direct argv or stdin
execution. Source-worktree test execution is stopped; native-Linux immutable
baseline copies and task-owned overlays are used instead.

Root's subsequent bounded mtime audit found nine ignored local metrics ledgers
modified during the broad-test interval (08:01–08:03Z): chaos-restart,
codex-tool-events, failure-injection, intent-map, plan-errors, plan-lock-validation,
pro-mode-stoplight, redis-projection and scenario-suite logs. Git status alone
had not exposed these. Their original content remains untouched; complete private
copies and metadata/hash manifests were preserved at
`C:/Users/jack.berrow/AppData/Local/Temp/sgsd-fifo-diagnostic-1c91537ed4d3442b96a4c52867785307/local-test-ledger-observation-A85EJD/manifest.json`.
Timestamped test-period rows are candidates for diagnostic exclusion, but the
exact appended range is not asserted without a before snapshot. No whole-ledger
deletion, truncation or rewrite was used to hide this contamination. The local
WSL default global Atlas root was absent at 08:13Z.

An independent read-only audit checked the seven new local cockpit PID records
twice (08:16:00Z and 08:16:35Z). PIDs82726,82727,82728,82729,82732,82761,82762
were all absent; no shutdown was warranted. Those stale records are retained.
This is a bounded exact-PID check, not a claim that every historical local test
process was audited. DEVCP production evidence and prior benchmark directories
were not modified by these local checks.
