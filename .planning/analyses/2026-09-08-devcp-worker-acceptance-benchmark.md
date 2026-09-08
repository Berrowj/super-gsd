# DEVCP Codex Worker acceptance benchmark

Status: NOT_RUN. This is an operator task specification, not an executable SGSD command or a passed gate.

Purpose: prove that the deployed Fable session can supervise real Codex workers in both directions, recover their results, and observe correctly attributed Atlas data across projects and sessions.

## Deployment prerequisite

Read-only inspection on 2026-09-08 found DEVCP's canonical source at `e88cfac37f022f51cbd901a93ed8fabe84bafc7c`, with local changes to `super-gsd/agents/sgsd-ceo.md` and `super-gsd/agents/sgsd-board-contrarian.md`. The source worker directory, both global worker runtime directories and the installed `sgsd-workers` command were absent. The local development worktree records the bridge as `IMPLEMENTED_LOCAL`, not deployed. Recheck these observations before running; they are not a live status feed.

Later read-only recheck on 2026-09-08: canonical DEVCP source and `origin/master` are `f9f5d0d20946cd5af95a5c2afcf99b760f053c90`; source clean. CEO/Contrarian changes were committed, not discarded. Worker runtime, helper at `scripts/lib/board-dispatch.cjs`, audit and benchmark remain absent before this rollout.

`sgsd-update` fetches published `origin/master`, refuses a dirty canonical source, installs per-user global assets and updates the current project. It does not publish this worktree, update every project's local overrides, or restart existing sessions. Preserve and reconcile those remote edits under a separately authorized deployment; do not reset or stash them as part of this benchmark.

## Run boundaries

- Run after the operator has deployed the reviewed worker/Atlas changes and started a fresh Fable session through the normal SGSD launcher. Read the installed `/sgsd-workers` procedure first. Use that same Fable; do not launch another orchestrator automatically.
- At most **five live wrapper invocations**, including failed attempts: two concurrent round trips, one recorded-thread continuation, one stop test, one unanswered-deadline test. Each gets an explicit 180-second worker deadline; the live portion has a 20-minute overall limit. These are attempt/time limits, not an enforced token or money budget. Record actual usage where available. No paid availability probes or automatic reruns.
- Use the selected registry models and reasoning efforts. Record actual wire IDs. Never substitute a model, alter credentials, bypass a provider circuit or restore sandboxed/one-shot execution to get a pass. An unavailable model is a named blocker, not permission to choose another.
- Create two clearly labelled synthetic SGSD projects, A and B, within one fresh, owned temporary benchmark directory. Give each its own `.planning/STATE.md` describing a synthetic benchmark milestone/plan, not a production phase. Store prompts, operational evidence and fresh reports only there. Do not modify production source, configuration, plans, gates or existing worker records.
- Keep automatic Atlas capture enabled on the normal global collector. The synthetic projects' registrations are real benchmark evidence and must be identified as such in the results; exclude them from production weekly workload comparisons. Do not inject fake provider events into production telemetry or delete canonical evidence afterwards.
- Supervise owned workers every 5-10 seconds; never block on final output while an inbox needs servicing. Stop only this run's exact owned processes when necessary, and retain failure evidence. No production restarts or process cleanup by broad name matching.

## B0 — Prove what is installed

Record the source SHA, install pin(s), OS/user, actual launch environment's Node and Codex versions, resolved wrapper/control paths and matching source-versus-installed hashes for worker runtime, wrappers/helpers, profiles, Atlas runtime and orchestration instructions. Confirm native Linux Node 22+, Codex and GNU `timeout` are available in the shell Fable actually uses. A noninteractive SSH PATH miss alone does not prove a CLI is uninstalled.

Inspect these global locations and verify they belong to the published revision being tested:

```text
~/.claude/super-gsd/source/super-gsd/
~/.claude/super-gsd/scripts/codex-exec.sh
~/.claude/super-gsd/tools/codex-worker/
~/.claude/tools/codex-worker/
~/.claude/tools/telemetry-atlas/
~/.claude/commands/sgsd-workers/SKILL.md
```

Inventory DEVCP's relevant projects and live sessions without restarting them. Record local runtime/instruction/config shadows, pins and which sessions predate installation. Global installation is scoped to an OS user; other users, containers and WSL environments are separate. A project missing from Atlas's registrations must not disappear from the rollout inventory.

PASS: the fresh test session demonstrably resolves the complete, matching installation. Otherwise BLOCKED; do not spend on workers or repair deployment within the test.

## B1 — Existing offline regression checks

From the verified canonical source, run the existing bounded suites individually and save their output and exit status:

```bash
npm run test:codex-worker
npm run test:board-dispatch
npm run test:atlas
node --test super-gsd/tests/model-routing/model-routing-contract.test.cjs
```

Use their built-in isolated fixtures; do not run an unrestricted repository-wide `node --test`. Report test totals and every skip. An explicit native App Server initialize-only check may be run without a model turn using the documented `SGSD_WORKER_LIVE_INIT` opt-in. Fake App Server fixture results are prerequisites, never evidence of live communication or model availability.

PASS: zero test failures, and no unexplained skip of a Linux worker launch/install contract. Verify all SGSD-owned profiles resolve to full access, approval `never`, and retained threads, with the existing role/report/gate contracts preserved. This is OS-account access, not project security isolation.

## B2 — Two real, simultaneous question/reply round trips

1. Choose stable, different owner IDs for A and B and save a dispatch record before launch. A must use the external board path: prepare an active, configured Codex seat through `super-gsd/scripts/lib/board-dispatch.cjs`, passing `--owner` during preparation, then check `worker_owner` and execute its generated command. B must use the installed generic `codex-exec.sh` review path with its configured profile and explicit owner. Both run in the background with a 180-second timeout and `--no-retry-on-timeout-escalate`.
2. Tell each worker to call `sgsd_ask_orchestrator` for its project-specific challenge, wait for the answer, and then return its normal report contract containing that answer. No repository inspection or file modification is needed. A returns valid `board-position-v1` YAML with the answer in `rationale`; B returns valid `code-reviewer-v1` with the answer in `ONE_LINER` and `FINDINGS_DETAIL`. Supply the required schemas, but never the answers, in their initial prompts.
3. Wait until both workers are independently `waiting_input`. Only then generate two different random, non-secret challenge strings in supervisor memory. Do not put these strings in worker prompts, files they can inspect, or shared instructions. Hold both replies for five seconds. Neither wrapper may claim success or publish a valid final report while its question remains unanswered. Perform B3's wrong-project/wrong-owner checks during this pending window, not after finishing B2.
4. Record each project's resolved path, owner, worker UUID, process instance, wrapper attempt, thread ID, turn ID and pending request ID. Save B4's benchmark-local checkpoint now. Answer each exact question via the control commands below. Record the command ID and its receipt. Require `applied`, not merely `queued`, and perform B3's duplicate-answer check after the first valid answer is applied.
5. Require both original workers to continue on their original thread and turn, exit successfully, and produce a fresh, normally validated report containing only their own challenge. No replacement worker, one-shot fallback or Fable-authored report is allowed.

Use IDs observed from the live record, never placeholder IDs or `--last`:

```bash
node "$CONTROL" status --project "$PROJECT" --owner "$UNIT"
node "$CONTROL" reply --project "$PROJECT" --owner "$UNIT" --worker "$WORKER" --request "$REQUEST" --text "$ANSWER"
node "$CONTROL" receipt --project "$PROJECT" --worker "$WORKER" --command "$COMMAND"
```

The board descriptor's explicit owner wins over a later environment value. Preserve it in every subsequent control/recovery operation. Do not treat two owner labels under this one Fable as proof of multiple independent Fable processes.

PASS: 2/2 real round trips, correct answer isolation and normal wrapper/report validation. Measure question-observed-to-reply-applied latency separately from model generation latency. Each supervisor reply must be applied within 30 seconds of observing the question, including the deliberate five-second hold. These are acceptance targets, not previously measured performance claims.

## B3 — Wrong targets cannot receive a reply

While B2's questions are pending, attempt to address A's worker through B's project and then with an incorrect owner. Require visible rejection with no change to either pending question. After a valid answer is applied, attempt the same request a second time; require duplicate/stale rejection, not another delivery. Preserve the exit status or rejected receipt, whichever the existing control interface returns.

PASS: all three negative cases are rejected, the valid replies still work, and no worker receives the other project's answer. This checks routing safeguards, not an OS sandbox boundary.

## B4 — Recover without a background handle, then resume the recorded thread

Save A's dispatch identity and report expectation in a benchmark-local checkpoint while it is pending. After B2, perform result recovery using only that checkpoint and on-disk worker records, deliberately not consulting the original background handle. Require `wrapper-result.json` schema version 1, matching project/worker/wrapper-attempt/thread/turn, `exit_code: 0`, the expected fresh report path, and matching SHA-256 and byte count. Apply the existing report validator. `completed` alone is insufficient.

This is a simulated handle-loss recovery, not proof of actual Fable compaction or an unattended supervisor restart. State that distinction in the results.

For live invocation 3, continue A's same bounded benchmark task through the normal wrapper with `SGSD_WORKER_RESUME_ID` set to its exact recorded worker UUID, the same model/effort/contract and a fresh report path. Ask the worker to state the previous challenge from retained context without putting it in the new prompt. Require a new worker/attempt and turn on the same thread, the correct retained answer, successful wrapper validation and an intact original report.

PASS: both evidence-based recovery and explicit retained-thread continuation succeed without duplication. A missing receipt, mismatched identity or orphaned thread claim is a failure/blocker to investigate; never delete a claim to make the test pass.

## B5 — Steer and stop the exact owned worker

For live invocation 4, launch a generic wrapper in A and ask the worker to request a release instruction before finishing. While it is waiting, send an in-scope steering message, record the command ID and require an `applied` receipt. Then stop that exact owned worker without answering its release question.

```bash
node "$CONTROL" steer --project "$PROJECT" --owner "$UNIT" --worker "$WORKER" --text 'Remain within this benchmark; do not inspect or edit other files.'
node "$CONTROL" stop --project "$PROJECT" --owner "$UNIT" --worker "$WORKER"
```

PASS: steering is acknowledged for the correct active turn, stopping terminates the owned wrapper and App Server tree within 30 seconds, the wrapper result is non-success, and no successful report is accepted. A steering acknowledgement proves control delivery, not that unfinished work followed the instruction. Provider rejection must remain visible, not be relabelled as applied.

## B6 — An unanswered question times out truthfully

For live invocation 5, launch a generic wrapper in B with `--timeout 180` and `--no-retry-on-timeout-escalate`. Ask for a supervisor-only release instruction and deliberately never supply it. The question must become pending; an earlier startup/provider failure does not pass this case.

PASS: the adapter reaches its configured deadline, the review wrapper returns timeout exit code 5 rather than 0, failure evidence is retained, no valid result is consumed, and the owned App Server process tree is gone within ten seconds after the deadline. No automatic retry, model swap or fabricated answer is allowed. Record adapter and wrapper status separately; the adapter's timeout code is 124.

## B7 — Atlas observes real runs without corrupting attribution

Save the installed read-only global audit before the live launches and again after them, allowing at most 120 seconds for normal exporter/spool drain. This audit does not repair evidence:

```bash
node "$HOME/.claude/tools/telemetry-atlas/audit.cjs" --json
```

Check the benchmark's actual run registrations against worker records, wrapper outcomes and the two resolved synthetic project paths. Let the launchers generate fresh run IDs; do not reuse the Fable run ID in workers or override it with an invented ID.

Require:

- One shared healthy receiver for this OS user, distinct project identities, and distinct registrations for each real wrapper invocation, including the resumed thread. The Fable supervisor's native Anthropic capture is checked against its own real launch project/run, not falsely attributed to A or B.
- Real native OpenAI request events for the successful worker runs and native Anthropic request events for the supervisor, with correct provider/model/project/run attribution. A registration or wrapper row alone is not native request capture. The negative runs must have honest failure/timeout outcomes; a missing terminal provider usage event must remain a coverage limitation, not invented usage or success.
- No benchmark-attributable malformed rows, invalid checksums, duplicate canonical events, identity conflicts or cross-project attribution. Use the existing audit/validators; do not invent a second reconciliation gate. Do not replay fake events into the global collector.
- No growing/stale benchmark spool backlog after the drain window. Run the audit twice after the same settled observation window: stable canonical evidence must not be counted again simply because it was read. Account separately for genuinely new supervisor/provider events between snapshots; do not require all global counts to freeze while other sessions run.
- Neither challenge string appears in Atlas's canonical telemetry. Inspect only the relevant evidence partitions for these non-secret canaries; do not dump raw provider transcripts, credentials or reasoning. Operational mailbox/report content is separate from Atlas and is expected to contain the challenges.
- Missing request identity, unavailable token fields and missing quota windows remain explicit WARN/unknown values, never zero consumption. Never sum account-level quotas across projects. Separate pre-existing global findings from new benchmark findings without hiding either.

Audit exit codes are 0 (checked evidence passed), 10 (degraded/missing coverage) and 1 (integrity failure). Report the actual result. `complete_coverage` remains false by design: this benchmark does not reconcile every request against provider billing and must not claim exhaustive capture.

PASS for observed capture requires the positive native request evidence above and clean benchmark attribution/integrity. Missing positive evidence is BLOCKED/degraded; bad evidence is FAIL. Quota/completeness warnings must remain visible even if the narrower observed-capture test passes.

## Results and completion rule

Keep a private benchmark evidence directory and a `BENCHMARK-RESULTS.md` containing:

- Run ID, UTC start/end, source SHA and installed hash manifest; project/session inventory and resolved model/effort/owner per dispatch.
- One row per B0-B7: PASS, FAIL or BLOCKED, expected versus observed result, and exact evidence paths. Not run is never pass. Save command outputs/exit codes, metadata snapshots, receipt/report hashes, latency observations and before/after audit JSON.
- Exactly how many live attempts occurred; available native usage totals and all unmeasured fields. Do not infer tokens from elapsed time or prices from display labels.
- Three separate conclusions: **WORKER_BRIDGE**, **ATLAS_OBSERVED_CAPTURE**, and **DEVCP_ROLLOUT**. The bridge needs B0-B6; observed capture needs B7. Rollout needs an explicit all-instance inventory showing matching installs/local configuration and fresh sessions, not just successful synthetic projects.
- Any remaining actual-Fable-compaction, other-model, other-user/container, standalone-CLI, exhaustive-coverage or weekly-analysis limitations. The initial board seat and generic profile are tested; this is not a certification of every available model or all launch paths.

Stop at the first prerequisite blocker or integrity failure. Report what was not run and the smallest authorized next action. Do not repair source, mutate gates, redeploy, restart production sessions or keep spending to improve the score. Normal SGSD spec/ATC/verifier/release gates remain separate and unchanged.

## Task to give Fable after deployment

> Read `.planning/analyses/2026-09-08-devcp-worker-acceptance-benchmark.md` from the verified SGSD source and the installed `/sgsd-workers` instructions. Complete that bounded DEVCP acceptance benchmark using real installed wrappers and the current configured models. Start with deployment preflight; if prerequisites fail, stop as BLOCKED without paid worker attempts. Use only isolated synthetic projects for the live tests, at most five worker invocations, and preserve evidence. Report WORKER_BRIDGE, ATLAS_OBSERVED_CAPTURE and DEVCP_ROLLOUT separately with a B0-B7 results table. No model/auth changes, source fixes, production restarts, fallback dispatches or gate bypasses. Do not claim every instance or every request is covered from one successful launch.
