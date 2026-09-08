---
phase: 170
plan: "170-04"
status: DEPLOYED_DEVCP_ACCEPTANCE_BLOCKED
date: 2026-09-08
verification_snapshot_utc: "2026-09-08T18:45:18Z"
deployed: true
deployment_scope: DEVCP_JACKBERROW_GLOBAL_AND_CURRENT_CLARITY_PROJECT
published_sha: 6b4581bb8f1502bbae79e8034680bea130ed8c1e
live_worker_attempts: 2
benchmark_end_utc: "2026-09-08T19:17:18Z"
benchmark_report_revision_utc: "2026-09-08T19:21:48Z"
formal_phase_gates: NOT_CLAIMED
---

# Worker and automatic Atlas rollout evidence

The operator authorized publication, guarded DEVCP update and a fresh separate
Fable benchmark session. The prepublication verification snapshot is retained
below; the subsequent actual-host deployment observations are appended.
This report supersedes the earlier source-only restriction; it does not rewrite
the historical 170-01/02/03 observations or claim formal phase closure.

At 18:16 UTC the operator explicitly authorized proceeding with DEVCP/Linux
while retaining the requirement to fix Windows. The Windows latency criterion
remains unresolved and is not a passing test or waived formal phase gate.
Required follow-up is recorded in
`.planning/analyses/2026-09-08-windows-atlas-latency-followup.md`.

## Preserved and reconciled source

- Original local payload preserved as `06ee8c6` on `luminaria-hogback`.
- Published baseline: `f9f5d0d20946cd5af95a5c2afcf99b760f053c90`.
- Reconciled candidate: `99f17a40b49e3fb817fe3cb4d9211acc21187f79`, on
  `release/v4.1-atlas-worker-20260908`, with prerequisite commit `41ea0d9`.
- Operator `.planning/config.json`, upstream hook manifest and four payload-cwd
  hook fixes, and phase-169 context were preserved byte-for-byte. CEO and
  Contrarian retain Fable/xhigh. No obsolete checkpoint or `.planning/tmp`
  payload was included. Untracked user material remains in the worktree.
- Benchmark helper path corrected; earlier DEVCP observation retained and the
  clean f9 baseline appended. Benchmark still `NOT_RUN`.
- Independent reconciliation specification review: PASS. Integration quality
  review identified the installed profile-resolution dependency gap below;
  the bounded repair and its independent re-review passed.

## Fresh candidate verification

Counts are per invocation, not a deduplicated grand total. Fake App Server
fixtures do not prove provider availability or live two-way communication.

| Check on candidate 99f17a4 | Observed result |
|---|---|
| Windows worker: core, permissions, launch, installation, orchestration | 30 PASS, 0 FAIL, 16 platform/opt-in SKIP |
| Linux worker + board + routing/resolution/propagation | 60 PASS, 0 FAIL, 2 SKIP (Windows contention injection, opt-in initialization); real isolated global install exercised |
| Windows profiles | 21/21 PASS |
| Existing hook-manifest completeness check | PASS |
| Scoped syntax / parse checks | 35 JS/CJS, 3 JSON, 10 Bash PASS |
| `git diff --check origin/master..HEAD` | PASS |
| Initial Windows Atlas, concurrent host load | 54 PASS, 1 FAIL, 6 SKIP; quota recorder p95 10.8028 ms versus <10 ms |
| Standalone Windows Atlas diagnostic | 51 PASS, 1 FAIL, 4 SKIP; p95 14.7296 ms. Incorrect eighth file path omitted launch tests; not a complete Atlas verification |
| Initial Linux Atlas, direct native Node but missing child-shell Node PATH | 56 PASS, 1 FAIL, 4 SKIP; Bash child output absent; real install and quota p95 1.005 ms passed |
| Linux Atlas with native-only PATH | 56 PASS, 1 FAIL, 4 SKIP; Bash child attachment fixed, real install passed, p95 0.991 ms; legacy launcher fixture depended on host Claude discovery |
| Linux Atlas after hermetic fixture and installed-closure repair | 57 PASS, 0 FAIL, 4 platform/opt-in SKIP; real global install passed, p95 0.855 ms |
| Linux worker/board/routing after installed-closure repair | 60 PASS, 0 FAIL, 2 platform/opt-in SKIP; installed generic and board actual model/effort validated |
| Final Linux installer, including fresh-source bootstrap and failure handling | 2 PASS, 0 FAIL, 0 SKIP; main-agent rerun 68 s |
| Final existing installer guards | `hook-manifest-completeness`, `preflight-static`, `smoke-static`: PASS |

The first Windows worker run exposed a fixture timing race: `turn/start`
acknowledgement preceded fixture child PID publication. The fixture now waits
for a valid published PID and covers a deterministic delayed-child case, with
alive-before-stop/dead-after-stop assertions unchanged. RED reproduced ENOENT;
GREEN: ten focused Windows runs (20 PASS), full Windows suite (30 PASS, 16 SKIP),
Linux core (18 PASS, 2 SKIP). Independent fixture specification and quality
reviews passed. No production worker behavior was changed for that repair.

The Windows quota sampler and its latency assertion were byte-unchanged from
the published baseline when those failures occurred. Bounded profiling found
temporary writes/renames dominate: 60 samples measured p95 11.323 ms, including
one write taking 10.142 ms alone, and a transient marker-rename EPERM. No minimal
source fix was evidenced; changing the write API was not faster. Smaller passing
diagnostics do not supersede the failed criterion. No threshold, filesystem
safety check or host security setting was weakened. This remains open.

The native-only PATH run exposed a separate hermetic-test defect: the launcher
fixture created a fake Claude outside its own `bin` directory. It now creates
that fake at `bin/claude`, so discovery and execution need no host Claude. The
same restricted-PATH test provided RED evidence; GREEN was 15 PASS, 1 explicit
real-stack opt-in SKIP, 0 FAIL; p95 1.206 ms, stalled-attachment overhead 697 ms.

The global installation fixture previously asserted report/receipt success but
not the selected model. Inspection found the installed generic wrapper lacked
its relative profile resolver/registry/dependencies and could select built-in
`gpt-5.5` instead of shipped `gpt-5.6-sol`. The installed board helper also needs
its registry, routing config and YAML runtime. A new isolated-install regression
failed at the absent resolver before production edits (0 PASS, 1 FAIL, 74 s).
The bounded closure repair then passed (1 PASS, 53 s), checking registry-backed
resolution and actual worker thread/turn model/effort with global module lookup
disabled. The final installed board execution also passed (1 PASS, 50 s):
installed Pragmatist sent `gpt-5.6-luna/max`, rejected provider fallback, and
produced a report validated by the installed schema. Both specification and
quality re-reviews passed for that closure and the full Linux totals above
were then observed. No model substitution is authorized.

A further fresh-source precondition was found before publication: the source
YAML dependencies are ignored build artifacts, not Git payload, and the old
updater only refreshes the target project's npm dependencies. A bounded
source-lockfile bootstrap before global writes and its fresh-source/failed-npm
regressions are implemented. A real empty-directory
experiment using the tracked manifest/lock and native Linux npm already passed:
57 packages installed in four seconds with lifecycle scripts disabled; exact
`js-yaml 4.1.1` and `argparse 2.0.1`, parsing check PASS. No global CLI upgrade.
The source check functionally loads explicit YAML/argparse paths, not just
marker files. Missing dependencies get one tracked-lockfile `npm ci` with
scripts disabled, a 120-second timeout and five-second kill grace, then a
functional recheck. Both candidate smoke and the manifest dependency graph
require those packages: initial attempts to run them before bootstrap failed
in the dependency-free fixture. Final ordering keeps independent hook-source
refusals first, then bootstrap, then all unchanged manifest/candidate/substrate
checks before global writes. No gate was removed or duplicated.

The offline fresh-source test uses a fake npm linking prepared pinned source
dependencies; it asserts exactly one invocation/cwd, no preceding global asset
writes, functional installed resolution without global search, and no partial
global publication after failure. Only YAML/argparse are copied into the
installed runtime, even though source npm prepares all 57 locked dependencies.
Final implementer verification: 2/2 PASS, 88 s. Main-agent independent rerun:
2/2 PASS, 68 s. Independent specification and final quality reviews PASS, with
no remaining blocking findings. No source dependency or global CLI mutation occurred
on DEVCP during these tests.

The installer smoke-order guard initially rejected a changed log-message
boundary. Restoring the original message, without changing the guard or copy
order, produced a fresh `hook-manifest-completeness` PASS. Profiles remained
21/21 PASS. This intermediate failure is retained here rather than hidden.

The overlay's legacy Astra Max dispatch-table labels now say resolved profile,
consistent with its current provider contract. No registry selection changed.
Fresh Windows consumer/board/routing checks: 17 PASS, 0 FAIL, 3 Linux-only SKIP.

## DEVCP preflight, no deployment yet

- Canonical source `/home/jackberrow/.claude/super-gsd/source` was clean at f9.
  Approved target project: `/opt/clarity/project-clarity-erp`, pin f9, with
  unrelated user modifications preserved. No Clarity reset/stash/source update.
- Native Node 24.15.0, Codex CLI 0.144.3, Claude CLI 2.1.263, GNU timeout 8.32,
  Bash/tmux/PowerShell resolve with the existing native Node bin on PATH.
- Codex App Server **initialize-only** handshake PASS; zero thread/model turns.
  This checks the [documented initialization protocol](https://learn.chatgpt.com/docs/app-server),
  not dynamic-tool/model entitlement or live telemetry.
- Existing `clarity` pane identities and Fable PID 363096 were inventoried.
  No existing pane was sent a command, reset or restarted.
- Seven protected pre-update files were copied to a private mode-700 directory:
  `/home/jackberrow/benchmarks/sgsd-worker-rollout-20260908T1745-Yu7jr3/pre-update`.
  Contents were not printed. Global model/effort remain unchanged.
- Planned fresh benchmark uses the normal remote launcher in a new session,
  explicit Fable/xhigh only in that new process, and the existing five-attempt
  benchmark. Other projects' pins and existing sessions will not be relabelled
  or counted as updated.

## Prepublication verdicts at 18:45 UTC

WORKER_BRIDGE: NOT_LIVE_VALIDATED. ATLAS_OBSERVED_CAPTURE: NOT_LIVE_VALIDATED.
DEVCP_ROLLOUT: NOT_DEPLOYED. B0-B7 have not been run in a new deployed session.
Live worker attempts: 0/5. Publication/deployment/benchmark evidence will be
appended here when those steps actually occur.

## Published and installed on DEVCP

- Normal, non-forced publication to `origin/master` succeeded at
  `6b4581bb8f1502bbae79e8034680bea130ed8c1e`. The final commit includes the
  reviewed installed-model closure and fresh-source dependency bootstrap.
- Normal `sgsd-update.sh` from `/opt/clarity/project-clarity-erp` completed
  with exit 0 at 18:50:31 UTC. Canonical source and current project pin both
  match the published SHA. Global installation is for user `jackberrow` only.
- Private evidence root:
  `/home/jackberrow/benchmarks/sgsd-worker-rollout-20260908T1745-Yu7jr3`.
  `sgsd-update.log` retains the actual updater output; the additional final
  protected-file snapshot is in `pre-install-final-mM0w26/`.
- Protected project config, CLAUDE instructions, package manifest and existing
  untracked lockfile remained byte-identical. Existing global model and effort
  settings were preserved. No CLI upgrade or auth change was performed.
- `post-install-verification.json` retains 96 source/install hash comparisons:
  95 byte-identical and one raw mismatch. At 18:57 UTC the existing read-only
  feature-propagation auditor and its canonical renderer verified the Researcher
  agent's expected VTP capability-derived tool grant, with equal expected and
  installed SHA-256 and zero repair actions. Evidence:
  `post-install-derived-agent-verification.json`. Researcher remains disabled
  for its unresolved model; this is not a model-routing change.
- The broader audit remains non-clean: six global-agent findings, eleven
  project-local legacy agent shadows, missing local defaults/instruction markers
  and a stale standalone tree. These are retained rollout findings, not repaired
  or hidden by the narrower installed-runtime hash check.
- Existing `clarity` panes `%0`-`%3` and their recorded PIDs remain intact;
  Fable PID 363096 was not restarted. Other worktree pins were not bulk-updated.

## Fresh Fable acceptance session started

At 18:58:19 UTC a new normal remote-launcher session
`sgsd-worker-benchmark-20260908T1858` started the bounded B0-B7 task. The launcher
used explicit verified source/scripts/agents paths, `--shell --no-attach`, and
a unique absent session name. Only its new operator pane `%4` received
`claude --model fable --effort xhigh` with the normal launcher permission mode.
The UI confirms Fable 5.1. The supervisor inherits the launcher's automatic
Atlas environment; no old pane received input.

The benchmark's private evidence child is
`fable-acceptance-20260908T185846Z/`. At 18:59 UTC B0 is in progress; no live
worker outcome is claimed. The fresh login shell reports Codex 0.153.2, whereas
the earlier SSH preflight resolved 0.144.3. B0 must record actual paths and use
the real launch environment; the earlier initialize-only result does not prove
this fresh environment's live protocol or model availability.

At that session-start snapshot, WORKER_BRIDGE and ATLAS_OBSERVED_CAPTURE await benchmark
evidence. DEVCP_ROLLOUT is partial, not all-instance complete. Windows quota
latency remains OPEN_REQUIRED. Formal phase/release gates remain unclaimed.

## Completed bounded benchmark: acceptance blocked

The fresh Fable completed its observations at 19:17:18 UTC and corrected its
report at 19:21:48 UTC. Authoritative host evidence is
`fable-acceptance-20260908T185846Z/BENCHMARK-RESULTS.md` below the private evidence
root above, with `EVIDENCE-MANIFEST.sha256`. The correction preserves the raw
evidence while withdrawing an overstatement of sole cause and marking B-only
negative/recovery checks as partial deviations, not full acceptance.

| Check | Observed result |
|---|---|
| B0 | PASS for installed integrity, with a discovered wrapper/shell Codex version discrepancy unresolved |
| B1 worker | 45 PASS, 0 FAIL, 2 SKIP; existing isolated install contracts ran |
| B1 board dispatch | 8 PASS, 0 FAIL, 0 SKIP |
| B1 Atlas | 57 PASS, 0 FAIL, 4 Windows/real-stack opt-in SKIP |
| B1 routing | 3 PASS, 0 FAIL, 0 SKIP |
| Initialize-only opt-in | 1 PASS, 0 FAIL; no model turn |
| B2 | FAIL: Astra board worker failed; generic Sol worker completed one real same-thread/turn round trip, but Fable's reply took 83.9 seconds against the 30-second target |
| B3 | BLOCKED/partial: wrong-project, wrong-owner and duplicate checks rejected on B only; required simultaneous A/B case was not achieved |
| B4 | BLOCKED/partial: B's checkpoint/report receipt hashes matched; A-based recovery and retained-thread continuation were not run |
| B5/B6 | BLOCKED/not run; no steering/stop or unanswered-deadline acceptance claimed |
| B7 | BLOCKED/degraded: both settled audits exit 10, no positive request-level native capture for either provider |

Two of five permitted live wrapper invocations were used. The live portion ran
19:10:47.786-19:13:14.880 UTC, within the 20-minute boundary. No further worker
attempt, model substitution, authentication change, source repair, production
restart or gate bypass occurred. B finished before the directed cleanup check;
no stop was needed. Native usage totals and costs remain unavailable, not zero.

### Live worker evidence

- A: `gpt-6-astra/max`, board seat `sgsd-board-architect`, explicit owner
  `fable.bench.A.8e548785`, worker `ad24b265-e4c4-4fec-b37c-a81c1bfc5f75`.
  Thread and turn opened; `worker_turn_failed`, wrapper exit 1 at 19:10:53.
  Its 119-byte failure artifact is not an accepted board report.
- B: `gpt-5.6-sol/xhigh`, owner `fable.bench.B.0716c3f9`, worker
  `443ad621-4058-4a3a-98f6-cd8a80e776a8`. Its dynamic question received an applied
  receipt and the original thread/turn completed, wrapper exit 0. The existing
  wrapper validated its 179-byte report; independent SHA-256 check matched
  `11d557ea405f2c9915f3b2a2e02e4e4eff883f88a23e4df3e23ff86c3dc7486a`.
- Fable observed B's question at 19:11:46.957 and applied the reply at
  19:13:10.879. Host forwarding was 64 ms; the 83.9-second supervisory delay
  occurred while diagnosing A. This is a failed service target, not bridge
  transport latency. The B-only checks do not replace the specified benchmark.

### Native CLI discrepancy and independently verified provider rejection

The fresh Fable shell resolves standalone Codex 0.153.2 from `~/.local/bin`.
The installed wrapper prepends the nvm Node bin directory afterwards and thus
resolves npm Codex 0.144.3. Both dry runs and all 24 canonical `codex_otel`
metadata events (A: 3, B: 21) corroborate the older live-worker version.

At 19:22:50 UTC the main agent independently queried the existing local Codex
SQLite log read-only, restricted to A's thread and six-second failure window.
Row 8754318, timestamp 1788894653, process 1354707, target
`codex_core::session_startup_prewarm`, records HTTP 400 and:

> The 'gpt-6-astra' model requires a newer version of Codex.

Only the bounded error text, row/thread/process identity and original-body hash
were exported to the evidence-root file
`post-benchmark-provider-error-verification.json`; no credentials or transcript
content were emitted. This verifies a version rejection on A's prewarm path.
The adapter retained only its generic terminal failure, so it does not prove
there were no other causes. The newer executable has not passed a live board
turn in this benchmark and is not a verified fix. No CLI was upgraded, removed
or reconfigured to obtain a different outcome.

### Atlas observations and coverage limits

Post-drain audits at 19:15:58 and 19:16:46 show the same three distinct project/run
registrations and stable canonical partitions. A has 5 rows (3 native metadata
events plus lifecycle start/exit), B has 23 (21 native metadata plus lifecycle),
and Fable has only its launch registration. All accepted native worker events
are `coverage/native_metadata_only`, not request/usage records. Anthropic native
events and accepted request counts are zero for this supervisor; native request
counts are also zero for both workers. These zeros describe accepted evidence,
not actual consumption. Missing tokens, identity and quota windows remain unknown.

The audits report no invalid rows, duplicate canonical events or identity
conflicts, and no pending benchmark spool. The canary checks found no challenge
strings in Atlas evidence. The first settled audit reported 150 missing-stable-
identity and 414 rejected-native records; the second reported 153 and 421 while
Fable was still active. The pre-live baseline already showed 101 and 271 on the
new receiver during this same Fable session; those are not unrelated legacy-stack
findings. Native metric observation does not satisfy positive native request
capture. `complete_coverage` stays false. Do not use this as proof that weekly
request/token accounting is reliable or exhaustive.

## Final rollout verdicts and required next action

WORKER_BRIDGE: **BLOCKED / not accepted**. ATLAS_OBSERVED_CAPTURE:
**BLOCKED / degraded**. DEVCP_ROLLOUT: **NOT COMPLETE**.

The deployed source and current project remain at `6b4581b`. The wider inventory
contains 46 stale pin-bearing locations (including the stale global pin file),
two stale project/shared runtime trees and pre-install sessions. This is broader
than the earlier 37-worktree inventory; it is not 46 newly discovered projects.
They were not relabelled, overwritten or restarted. At 19:23 UTC independent
checks found the original Claude PID 363096 and all four original pane processes
alive, both owned adapters gone, and the canonical source clean at the tested SHA.

Final independent checks at 19:27-19:28 UTC verified all 132 benchmark-manifest
file hashes, both owned App Server processes gone, and the original five recorded
processes alive. Protected project config, CLAUDE instructions, package manifest,
existing lockfile and global Claude settings are byte-identical to the final
pre-install backup. Global model/effort remain `opus[1m]`/`high`; Fable/xhigh was
selected only for the fresh test process. Evidence-root files:
`post-benchmark-evidence-verification.json` and
`post-benchmark-protected-config-verification.json`.

Next work requires an operator-approved repair/reproduction plan: resolve the
wrapper's native CLI selection for Astra without silently substituting models;
prioritize the live inbox to meet the unchanged reply deadline; investigate
provider request/identity capture with privacy-safe evidence; then authorize a
new bounded acceptance run. Windows quota-recorder latency is still separately
**OPEN_REQUIRED**, as the operator explicitly requested. No phase or milestone
has been closed. These post-deployment planning updates are local evidence;
they do not change the published or installed benchmark revision.
