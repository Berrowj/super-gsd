---
phase: 170
plan: "170-04"
status: VERIFIED_LINUX_CANDIDATE
date: 2026-09-08
verification_snapshot_utc: "2026-09-08T18:45:18Z"
deployed: false
live_worker_attempts: 0
formal_phase_gates: NOT_CLAIMED
---

# Worker and automatic Atlas rollout evidence

The operator authorized publication, guarded DEVCP update and a fresh separate
Fable benchmark session. This is the prepublication verification snapshot;
deployment and benchmark outcomes must be recorded from the actual host.
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

## Current verdicts

WORKER_BRIDGE: NOT_LIVE_VALIDATED. ATLAS_OBSERVED_CAPTURE: NOT_LIVE_VALIDATED.
DEVCP_ROLLOUT: NOT_DEPLOYED. B0-B7 have not been run in a new deployed session.
Live worker attempts: 0/5. Publication/deployment/benchmark evidence will be
appended here when those steps actually occur.
