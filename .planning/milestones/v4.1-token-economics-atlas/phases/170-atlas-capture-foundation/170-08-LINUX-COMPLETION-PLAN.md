---
schema_version: 2
phase: 170
plan: "170-08"
status: ACTIVE
authorized_by: operator
authorized_at: 2026-09-09
scope: LINUX_ACCEPTANCE_AND_GATED_ATLAS_COMPLETION
windows: OPEN_REQUIRED_SEPARATE
expected_ATC_tier: FULL
tasks:
  - id: T170-08-1
    agent: codex-supervisor
    model: codex
    files_touched: [".planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-08-LINUX-ACCEPTANCE.json"]
    input_contract: "Published Linux source, existing read-only collectors and protected-state baseline; Task 1 below."
    output_contract: "Private timestamped preflight receipts, referenced without credentials in the acceptance record."
    hypothesis: "Read-only static configuration and hash checks establish prerequisites without generating operational events."
    falsifier: "A profile ledger or protected configuration changes during B0, or an installed required artifact does not match."
    stop_rule: "Observed prerequisite verdict and protected-state comparison recorded; failures block live attempts."
  - id: T170-08-2
    agent: fable-orchestrator
    model: opus
    files_touched: [".planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-08-LINUX-ACCEPTANCE.json"]
    input_contract: "T170-08-1 PASS, fresh installed launcher and the existing B0-B7 acceptance specification; Task 2 below. The legacy schema value opus is a classifier discriminator, not permission to replace Fable."
    output_contract: "Immutable benchmark evidence and independently verified machine-readable acceptance receipt."
    hypothesis: "The installed Fable/worker/Atlas path satisfies bounded communication and native capture without unaccounted mutations."
    falsifier: "Any prerequisite, communication, correlation, privacy or preservation criterion fails."
    stop_rule: "B0-B7 verdicts, actual live attempts and manifest recorded; no repair inside an active benchmark."
  - id: T170-08-3
    agent: codex-supervisor
    model: codex
    files_touched: [".planning/STATE.md", ".planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-08-LINUX-COMPLETION-REPORT.md"]
    input_contract: "Actual acceptance and existing SGSD gate contracts; Task 3 below."
    output_contract: "Existing gate evidence and precise downstream plans, with dependency and Linux/Windows boundaries retained."
    hypothesis: "Existing gate procedures plus explicit evidence prevent software installation from being mistaken for complete trial coverage."
    falsifier: "A phase activates before its dependencies or telemetry/weekly completeness is claimed without observed evidence."
    stop_rule: "Linux work verified under existing gates, or the exact remaining dependency recorded without a fabricated pass."
  - id: T170-08-4
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/tools/telemetry-atlas/global.cjs
      - super-gsd/tools/telemetry-atlas/lifecycle.cjs
      - super-gsd/tools/telemetry-atlas/global.test.cjs
      - super-gsd/tools/telemetry-atlas/lifecycle.test.cjs
      - super-gsd/tools/telemetry-atlas/README.md
      - super-gsd/tests/codex-worker/launch.test.cjs
      - super-gsd/scripts/lib/board-dispatch.test.cjs
    input_contract: "Sealed 09:52 Fable B1 failures, exact native Node24 traces, 6,761-process host observation and source-ledger append evidence; Task 4 below."
    output_contract: "Root-cause evidence, RED/GREEN tests, bounded transition and fixture-isolation repair with independent SPEC then QUALITY review."
    hypothesis: "Removing repeated whole-network-table scans while retaining exact socket ownership permits normal transitions within the existing deadline; fixture-owned profile logs and failure-safe cleanup stop diagnostic pollution."
    falsifier: "Nominal transition still exhausts 5 seconds, any expired transition advances, a foreign listener is accepted, a test changes a parent ledger or a failed fixture leaves its receiver running."
    stop_rule: "Native isolated Linux regression suites pass with unchanged deadline/security contracts and both independent reviews pass."
semantic_acceptance_criteria:
  - input: "Actual fresh Linux Fable acceptance, not a unit fixture or reconstructed worker report."
    expected_outcome: "Independent receipt identifies the immutable evidence manifest and every B0-B7 step passes with no more than five actual live attempts."
    verification_cmd: >-
      node -e "const a=require('./.planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-08-LINUX-ACCEPTANCE.json'); if(a.evidence_kind!=='observed_linux_acceptance'||!a.independently_verified||!/^[a-f0-9]{64}$/.test(a.manifest_sha256)||!Number.isInteger(a.live_attempts)||a.live_attempts<1||a.live_attempts>5||!Array.from({length:8},(_,i)=>'B'+i).every(k=>a.steps[k]==='PASS'))process.exit(1)"
  - input: "The completed Linux acceptance's real pre/post protected-state and telemetry correlation evidence."
    expected_outcome: "Verified receipt proves protected configuration/session preservation, real native response capture, exact worker/run correlation and zero accepted privacy canary leaks."
    verification_cmd: >-
      node -e "const a=require('./.planning/milestones/v4.1-token-economics-atlas/phases/170-atlas-capture-foundation/170-08-LINUX-ACCEPTANCE.json'); if(!a.independently_verified||a.protected_state_preserved!==true||a.native_response_capture!==true||a.exact_worker_run_correlation!==true||a.accepted_privacy_canary_leaks!==0)process.exit(1)"
---

# Linux acceptance and gated Atlas completion

## Explicit contract-recovery amendment (2026-09-09 15:52Z)

Root's one-use review prompt incorrectly requested free-text FINDINGS and a
percentage PASS_RATE. The wrapper's presence-only extraction accepted this, but
the existing secondary `validateContract` in `sgsd-orchestrate` requires integer
FINDINGS/CRITICAL/WARNINGS and numerator/denominator PASS_RATE. Executing that
exact existing function now rejects reports01-04. Earlier code findings and the
positive04 assessment remain evidence; the recorded04 gate PASS is withdrawn
pending a valid report. Preserve every original byte and append corrective ledger
evidence rather than rewriting the previous verdict or source.

Task4 authorizes one explicit180-second contract-only continuation of completed
worker `c8135301-7e1f-4368-97f6-9d7a96b2d448`, same project/thread/profile/model/
effort and unchanged four-file freeze. Positively verify its adapter stopped and
thread claim released; verify all1,106 source/config inputs against P3RNwg and
retain the prior report. Request the genuine existing review conclusion in the
required five-field format, allowing a blocking finding; no forced PASS, new
source import, tests, unrelated re-review, automatic retry or model substitution.
Validate the new original report with the exact existing secondary function before
any gate PASS/170-09 resume/publication. Save transport status and contract status
separately. A failed continuation remains blocked and needs fresh diagnosis.

Future170-09 quality dispatch must request that same existing valid format and
apply its secondary guard. This amendment changes only the one-use orchestration
procedure, not SGSD source gates or review policy.

> For agentic workers: use subagent-driven-development for bounded implementation
> tasks, with independent specification then quality review. Root owns deployment,
> real Fable supervision, evidence reconciliation and existing phase gates.

**Goal:** Finish the Linux worker/capture acceptance, then the approved correlation,
reporting and Linux rollout work, without claiming a complete baseline from partial data.

**Architecture:** Continue the approved hybrid native-provider plus SGSD-evidence
design, not a new telemetry product. P170 acceptance remains a prerequisite for
P171 activation; P172 follows P171's existing dependency and calibration contract.
All instrumentation stays passive, content-free, bounded and fail-open. Existing
gates retain authority. Provider totals, local estimates and account quota remain
separate. Windows is explicitly outside this Linux completion execution.

**Tech stack:** Existing Node CommonJS Atlas/worker tools, Bash Linux launch/update
scripts, SGSD JSONL/YAML registries and deterministic report generation.

## Approved scope and design continuity

The operator's latest instruction is: “yeah carry on. i want this totally finished
on linux”, approving the proposed corrected bounded acceptance and subsequent
operation-level logging/reporting. The written design approved 2026-09-07 and the
2026-09-09 coverage census supply the requirements; no new architecture decision
or relaxation of privacy, integrity, gate or measurement rules is inferred.

The current linked release worktree is retained. Source runtime is published as
2770952; local doc-only 9aa7f8f records the previous B0-blocked run. Preserve every
old benchmark, diagnostic exclusion, user `.planning/tmp/`, credential/model default
and running session. Never overwrite a project-local override merely to make a
fleet freshness report green. In-scope defects may be repaired under an explicit
task amendment, tested and reviewed; do not repair while an acceptance is active.

## Task 1 — Fresh read-only prerequisite revalidation

Files: private, uniquely named benchmark evidence and one-use diagnostic helpers;
no production source mutation in this task.

- [x] Capture current source/pin, installed hashes and runtime fingerprints using
  the existing read-only collectors. Compare against 2770952 and the completed
  prior deployment; record drift rather than silently installing over it.
- [x] Capture protected config hashes, all current panes/process identities,
  project pin inventory and the existing profile ledger hash before the run.
- [x] Give B0 an explicit non-writing procedure: read profile registry values,
  inspect the installed resolver as text if necessary, and use only board
  `--describe`, Atlas `status`/audit, health GETs, file hashes, process inventory,
  tool `--version` and `codex login status` as capability checks. Do NOT execute
  the profile resolver, bare Atlas default commands, wrappers or other arbitrary
  helpers in B0. Do not print credentials or unfiltered process environments.
- [x] Preserve raw SHA comparisons and Git-normalized blob comparisons distinctly;
  classify installer-derived agents and genuine stale files against the installer.

## Task 2 — One fresh Fable B0–B7 acceptance

Files: new private evidence directory, task packet and new launcher session only.
Authoritative procedure: `.planning/analyses/2026-09-08-devcp-worker-acceptance-benchmark.md`,
with the approved 170-06 native-response accounting interpretation and 170-08's
non-writing B0 procedure. No relaxation of pass/fail criteria.

- [x] Start a fresh Fable through the existing Linux launcher, explicitly pointing
  at the installed scripts directory. Do not reset old panes. Keep Fable's actual
  shell/environment and native run identity as evidence.
- [x] Prove B0 is non-writing by comparing the profile ledger and protected files
  before/after B0. B0 does not launch wrappers. A failed prerequisite stops B1–B7.
- [x] Run four individually bounded offline suites using their own fixtures:
  `npm run test:codex-worker`, `npm run test:board-dispatch`, `npm run test:atlas`,
  `node --test super-gsd/tests/model-routing/model-routing-contract.test.cjs`.
  Record exact tests/pass/fail/skips and test-only provenance. No broad discovery.
- [ ] If B0/B1 pass, run at most five live wrapper attempts, 180 seconds each,
  maximum twenty-minute live portion: concurrent board/generic round trips,
  wrong-target/duplicate rejection, checkpoint result recovery, same-thread resume,
  steering/stop and an unanswered deadline. No automatic model swaps or retries.
- [ ] Fable services pending inboxes first, every 5–10 seconds; replies must be
  applied within the existing thirty-second bound, including the five-second hold.
  No external auto-answerer, supervisor-authored worker report or substituted worker.
- [ ] Use existing Atlas audits before and twice after drain. Require genuine
  native response/request evidence and exact project/run/thread/turn attribution;
  preserve absent HTTP IDs/quota/model fields as unknown. No fake production events.
- [x] Stop at first prerequisite/integrity failure. Seal the report and evidence;
  independently verify all receipts, hashes, actual live attempts, scope and
  protected-state preservation. A test failure is never repaired inside this run.

## Task 3 — Existing phase gates and authorized downstream work

- [ ] Inspect and execute the existing P170 spec/ATC/verifier/MUDA/phase-close
  procedures against actual requirements and evidence; do not create replacement
  enforcement or convert unit-test/review results into formal gate passes.
- [ ] Only after the P170 dependency passes, activate P171 in `.planning/` and
  write exact-file test-first tasks for the versioned operation/invocation census,
  allowlisted ledger/receipt adapters, explicit joins, finding/repair lineage,
  prompt/context metadata, provenance and corruption/exclusion accounting.
- [ ] Implement and independently review those tasks; publish normally, install
  through the guarded Linux updater and validate real capture with the prescribed
  twenty-four-hour calibration evidence. Record unsupported fields separately.
- [ ] Activate P172 only under its existing dependency contract; implement all
  deterministic JSON/Markdown/self-contained HTML views with denominators,
  freshness, confidence and refusal of unsupported savings claims.
- [ ] Reconcile Linux project/install/session inventory without losing local edits
  or terminating ongoing sessions without explicit necessity/authority. Validate
  auto-attachment on supported SGSD entrypoints and new boots. Record unavailable
  users/containers/standalone non-SGSD sessions rather than claiming them covered.
- [ ] Complete existing Linux acceptance/release checks and hand over runnable
  weekly collection/reporting instructions. Frozen collection starts only after
  calibration passes; two complete seven-day windows are still required for
  averages/recommendations, not something implementation can fabricate today.

## Task 4 - Repair the observed B1 blockers outside acceptance

Amended after the operator's latest "try agin" continuation. The 09:52Z Fable run
ended B0 PASS / B1 FAIL, with zero live workers. It is immutable failed evidence,
not a reason to relax the acceptance criteria. The v2 frontmatter added here is a
prospective contract reconciliation, not a retrospective schema or gate pass.

- [x] Reproduce the exact failures in a private native Linux source copy, using
  Node24 and explicit test-file argv. No broad test discovery in a working source
  checkout. Measure the repeated process/socket scans before changing them.
- [x] Retain the default 5,000ms transition deadline, short-expiry assertions,
  start-time/executable/argv identity, exact listener ownership, foreign-listener
  refusal, journal durability and explicit retry semantics. Do not make timeout
  tests pass by increasing their bounds or silently accepting unverified ports.
- [x] If supported by the measurement, avoid repeatedly reading the same kernel
  socket tables for every process and port. Deadline checks remain within any
  potentially large scan, and expired operations do not signal or hand off.
- [x] Give ordinary worker and board wrapper test fixtures their own profile log
  destinations. Preserve production fallback logging and existing offline
  self-test isolation tests; inherited source/parent logs must remain untouched.
- [x] Ensure each test-owned receiver is stopped by exact identity even after a
  failed assertion, before deleting its temporary state. Add a regression for
  the observed failure-cleanup path; never kill by process name or broad pattern.
- [x] Preserve and classify the four observed diagnostic source-ledger rows;
  record the leaked receiver's identity before stopping only that verified fixture.
- [ ] Run independent specification then quality reviews and full named Linux
  suites. Publish/deploy only reviewed changes using the existing guarded updater,
  preserving existing sessions/configuration; then one new bounded acceptance.

Quality-review remediation, 2026-09-09 11:54Z: the registered reviewer returned
CRITICAL 1 for incomplete `/proc` visibility being interpreted as vacancy. Verify
this finding with a narrowly injected native regression, distinguishing inherited
behavior from the batch change. If confirmed, repair `global.cjs` and its tests
within this task: incomplete relevant listener evidence must fail closed, while
unreadable unrelated process FDs must not make every ordinary Linux scan fail.
Keep exact namespace/listener identity, the five-second deadline and durable
transition semantics. No production mutation before independent SPEC and QUALITY
re-review; retain the failed review and every RED result.

Review execution amendment, 2026-09-09 12:30Z: SPEC revision 3 and the named
native runtime suites pass, but the registered Sol/xhigh re-review and its one
explicit continuation both reached their 180-second review limits without a
verdict. Metadata proves the latter was still generating, not waiting for a tool
or pending question. Permit one explicit same-thread invocation using the
existing `--timeout-tier custom:360` review option. This changes no configuration
default, model, gate criterion, receiver deadline or B0-B7 acceptance limit; it
is not an automatic retry loop. Preserve both timeout receipts and unknown usage.
No verdict still means no deployment; do not convert timeout or transport success
into a review pass.

The 12:32:18Z registered result confirmed the port repair but returned CRITICAL1
for `global.test.cjs` cleanup: unreadable/corrupt identity records were ignored,
and an uninspectable identity could be treated as stopped before root deletion.
Verify with native RED, then repair only the existing test helper/callers and
focused regressions in `global.test.cjs`. Missing records must remain distinct
from unreadable/corrupt evidence; do not signal an unproved PID or erase unresolved
fixture evidence. Preserve the failed review and require SPEC plus registered
QUALITY re-review of the new frozen test revision before deployment.

Prospective cleanup re-review, 2026-09-09 12:48Z: after the new test-only repair
passes independent SPEC and root's named native integration, run one fresh
registered `review`/Sol/xhigh QUALITY invocation with `custom:360`. Supply the
two retained critical reports, current four-file diff and observed verification
receipts. Use a new private candidate/thread so prior reviewed source evidence
is immutable. No automatic continuation, configuration/budget-default change,
fallback or gate relaxation. Record actual duration/usage/verdict; a missing or
blocking verdict still prohibits deployment and keeps170-09 dependency inactive.

Next-acceptance B1 isolation clarification, 2026-09-09 12:51Z: run the same four
named benchmark suites against a complete, hash-verified private copy of the
installed canonical source, with private HOME/TMP/Atlas state and copied pinned
dependencies. Do not run tests in either production or user source worktree.
The copied-source manifest must match the tested installed revision; test
commands/criteria and fixture meanings are unchanged. Retain every raw stream,
exit/skip count and pre/post input/protected-state comparison. B0 still only
reads/hashes this prepared private fixture; it executes no wrapper or test.

Observed review timeout and explicit continuation, 2026-09-09 13:21Z: SPEC05
passes test7b95e17c and root integration lz57ZA has zero worker/Atlas/board
failures plus the seven classified published propagation failures. The fresh
registered custom360 review ended13:20:21Z without a verdict, after21 completed
native responses. Saved native metadata shows completed tool calls followed by
generation through13:20:13Z, not a pending tool/question. Keep that timeout and
usage warning; permit one explicit180-second continuation of worker
`b3a07de3-7439-4abb-b1bb-fe35f667ce79` on its saved thread, same frozen source,
registered profile/model/effort and no fallback. Do not restart the review from
scratch, force a verdict, change defaults or automatically repeat a timeout.
No actual QUALITY PASS still means no deployment or170-09 activation.

Registered QUALITY03, 2026-09-09 13:23Z: the continuation completed in66.081s
with CRITICAL1, not PASS. `validFixtureIdentity` accepts parseable but empty
start/executable/argv evidence; mismatch then permits deletion while the
referenced fixture remains alive. Reproduce with native malformed-identity
regressions, then tighten only the existing test identity validator and affected
synthetic fixture records to the known Linux shape. Preserve legitimate empty
non-executable arguments and genuine stopped/reused/zombie semantics. No new
production scope or permission. Require SPEC06, fresh native integration and
registered QUALITY re-review; preserve every earlier verdict and raw result.

Prospective changed-revision review continuation, 2026-09-09 13:34Z: after
SPEC06 and fresh native integration pass the validator repair, preserve the
previous four scoped source files and original integration manifest in a new
read-only revision archive under the private review project. Import only the
verified `global.test.cjs` delta into that same private project; verify all
1,106 source/config inputs against the newly tested candidate before review.
The completed worker `4569f53c-ea95-41d3-b81c-df68a4408265` may be resumed
through the normal wrapper's invocation-local `SGSD_WORKER_RESUME_ID`, retaining
its canonical project, thread, registered review profile, model/effort and
contract. Confirm the old adapter is no longer alive; never remove a thread
claim. This is an explicitly CHANGED source revision, not the earlier unchanged
timeout continuation. Supply the archived old bytes, exact delta, SPEC06 and
new verification evidence, with a fresh report and one 180-second invocation.
Preserve all prior reports, manifests and worker records. No automatic retry,
gate bypass, production source mutation or profile/default change is allowed.

## Completion boundary

Linux software completion, observed deployment, twenty-four-hour calibration,
and two-window economics evidence are separate states. Every eligible operation
must have classified capture or an explicit detected gap; unknown is not zero.
The Linux work is not complete merely because the receiver is healthy, a sample
project passes, or a report renders. Any source expansion gets a concrete plan
task before editing. No source change, restart, gate override or cost claim is
authorized solely by the word “finished”.
