---
schema_version: 2
status: ACTIVE
phase: 170
plan: "170-11"
source_revision: 94ce08146e39099e1d2110ba8550419180377850
authorized_at: "2026-09-10"
authorization: "Operator: start with the corrected changes and tie this up; okay lets go then."
expected_ATC_tier: FULL
skip_gates: []
tasks:
  - id: T170-11-1
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/install.sh
      - super-gsd/scripts/lib/skill-routing-registry.cjs
      - super-gsd/tests/codex-worker/install.test.cjs
      - super-gsd/skills/sgsd-deliberate/SKILL.md
    input_contract: "Published Linux global install and actual flat global-hook import paths."
    output_contract: "Only reproduced missing dependencies are delivered to the registered hook runtime; supported nested board path preserved."
    hypothesis: "The global installer omits dependency closure required by its registered flat hooks."
    falsifier: "Installed real routing still fails with external module search disabled, or board support/gate policy changes unnecessarily."
    stop_rule: "Reproduce, RED installed regression, minimal closure fix, GREEN native tests, independent SPEC and existing FULL ATC."
  - id: T170-11-2
    agent: gsd-executor
    model: codex
    files_touched: []
    input_contract: "Failed Astra thread and installed App Server model/list and thread/read metadata."
    output_contract: "Observed cause or explicitly unresolved provider failure; no guessed model, effort, auth, quota or fallback."
    hypothesis: "Read-only capabilities or retained error metadata can explain the failed turn without another paid probe."
    falsifier: "Model listing alone is called entitlement proof, or raw diagnostics/prompts are published."
    stop_rule: "One initialize-only inspection; only an evidence-backed in-scope code fix gets a separately recorded allowlist before edits."
  - id: T170-11-3
    agent: gsd-executor
    model: codex
    files_touched: []
    input_contract: "Normal installed board/generic wrapper, run registrations, worker receipts, native usage records and existing operational proofs."
    output_contract: "Corrected finite acceptance with real wrapper/run identity, memory-only challenge, exact native usage joins, actual receiver measurement, MUDA/ATC source reconciliation and honest per-seat status."
    hypothesis: "Normal wrapper registration captures native usage that direct unregistered adapter probes did not initialize."
    falsifier: "Invented run ID, missing receipt, challenge persisted before response, wrong receiver PID, native/canonical mismatch or skipped check relabelled PASS."
    stop_rule: "At most four acceptance wrapper invocations including continuation/failures, 180 seconds each; no automatic full benchmark retry. Registered review spend is separate and recorded."
  - id: T170-11-4
    agent: gsd-executor
    model: codex
    files_touched:
      - super-gsd/scripts/sgsd-remote-tmux.sh
      - super-gsd/tests/propagation/runtime-provenance.test.cjs
      - super-gsd/tools/telemetry-atlas/runtime.test.cjs
    input_contract: "Configured orchestrator default fable, actual Linux launcher Claude argv without a model, and general user Claude model opus[1m]."
    output_contract: "Normal Linux greet/go starts the resolved SGSD Anthropic orchestrator explicitly; user settings and direct Claude terminal topology remain unchanged."
    hypothesis: "Passing the existing validated role selection at launch prevents the general Claude default from silently overriding SGSD's orchestrator."
    falsifier: "Fable is only described but not on the actual Claude argv, unsupported provider is silently substituted, or Codex selection/provenance/telemetry changes."
    stop_rule: "RED actual-argv fixture then minimal launch binding, GREEN provenance/Atlas fixtures, independent SPEC and registered FULL ATC before publication."
semantic_acceptance_criteria:
  - input: "Fresh isolated global installation and the actual registered flat hook routing module."
    expected_outcome: "Real registry loads in the supported updater layout without external dependency search or fallback caused by missing install files; absent canonical source is explicit, not a healthy standalone claim."
    verification_cmd: "node --test super-gsd/tests/codex-worker/install.test.cjs"
  - input: "Successful normal-wrapper acceptance turns and their recorded native source files."
    expected_outcome: "Immutable wrapper receipt and valid run registration join to exact native/canonical usage; no invented totals."
    verification_cmd: "node super-gsd/tools/telemetry-atlas/audit.cjs --json"
---

# Corrected Linux acceptance implementation plan

For agentic workers: use subagent-driven-development, test-driven-development,
independent SPEC, and the existing registered FULL ATC before publication.

Goal: correct the demonstrated acceptance mistakes and actual Linux install
defects, then give the operator an evidence-backed trial-readiness result.

Architecture: retain the shipped Atlas collector and worker bridge. All live
checks use existing supported wrappers and validators. This is a correction to
the approved 170-10 design, not a new collector or benchmark framework.

Tech stack: existing Node CommonJS, Bash installer/wrappers, SSH to native Linux.

## Scope and preservation

The operator approved the narrow correction/recheck approach in the preceding
review and repeated go-ahead. Proposed timebox is 60-90 minutes, conditional on
provider/account availability. A provider block does not justify a model swap.
The Researcher model remains a separate operator choice; no alias is guessed.

Keep failed benchmarks immutable. Preserve current unrelated worktree edits,
existing DEVCP sessions, credentials, config defaults, trust sections, source
ledgers, unrelated project pins and gate policy. No broad restarts, destructive
cleanup, bypass, billing-completeness claim or Windows sign-off. Global update
affects this OS user's global assets and the chosen current project, not every
old process or project-local shadow.

## T1: repair only the reproduced hook dependency closure

- [ ] Follow the actual settings hook into the flat routing import. Compare
  with the nested installation; load with `--no-global-search-paths` and
  `logDegradation:false` so diagnosis emits no fake gate evidence.
- [ ] Extend the existing real empty-home install fixture before production
  edits. Assert `require(flatRouting).loadSkillRoutingRegistry({runtime:false,
  noCache:true,logDegradation:false})` succeeds in the supported updater layout, and
  that required installed dependency files match source. Run the existing
  native install test and retain its expected missing-dependency failure.
- [ ] Use the installer's existing copy pattern to deliver the exact missing
  closure beside flat hooks. Do not add or claim a flat board CLI support contract.
  Record any newly demonstrated required source-file allowlist before editing.
- [ ] Rerun native installed tests and relevant existing suites. Independent
  SPEC first, then existing registered FULL ATC; address actual findings only.

### Reproduced root-layout correction, 08:35 UTC

The actual installed hook fails at both missing flat js-yaml and the loader's
repository-only root assumption (`~/super-gsd/registry/gates.yaml`). Clarity
has 7,029 paired adapter/classifier failure observations. In-memory diagnosis
using the updater's complete canonical source passes all 30 registry routes
and the real hook's 16 adapted routes without weakening any validator.

The T1 allowlist therefore adds skill-routing-registry.cjs. Keep a real source
layout local to its own source tree. For the known global flat/nested layouts,
resolve validation against their sibling `super-gsd/source` checkout maintained
by sgsd-update, never an ambient cwd or arbitrary home search. Keep the installed
registry as input and existing gate producer/containment checks unchanged. If
that complete source is absent, return an explicit source-unavailable error;
do not claim a standalone partial global install is healthy. The installer
also delivers the existing js-yaml/argparse closure beside flat hooks for VTP
and other flat consumers. Test both supported updater layout and missing-source
failure, source-local behavior, and the existing genuine missing-registry
fallback. This repairs the deployed Linux layout only, not a new standalone
global packaging contract. No extra model generation or gate policy changes.

## T2: diagnose Astra without guessing

- [ ] Initialize installed App Server, query model/list (all pages) and read
  the exact failed thread without resuming. Output model/effort/status/closed
  error metadata only. Close only the client process created by this check.
- [ ] If existing metadata is inconclusive, use one of T3's finite normal
  board invocations to reproduce while retaining privacy-safe error facts.
  A named external blocker is an honest result, not a reason to weaken gates.

## T4: bind the Linux orchestrator to the existing role selection

Read-only diagnosis at 08:47 UTC found general Claude settings `model: opus[1m]`,
while source model-routing.json resolves orchestrator to Fable. The actual
sgsd-remote-tmux.sh greet/go command passes no model argument. The configured
selection is therefore not enforced by this launcher. This is in the operator's
explicit Fable/model acceptance scope, not permission to edit general settings.

- [ ] Extend real launcher argv fixtures first: use the actual model resolver
  and real routing config in the fixture source. Greet/go must pass Fable from
  the role config even if the general CLI default differs. A supported per-role
  Anthropic override must reach argv. Unsupported non-Anthropic transport or
  invalid routing must fail before cockpit/tmux/provider work; never substitute.
- [ ] Resolve through existing model-routing.cjs against authoritative source
  routing config (or its existing explicit routing-file/role override), validate
  provider/model, and quote the model on direct Claude argv. Preserve caller
  Codex executable selection, project/source pin check, telemetry prefix, `go`,
  terminal topology and non-starting shell/doctor modes. Do not build a Codex
  orchestrator transport or mutate auth, general preferences or role defaults.
- [ ] Update the existing bounded stalled-attachment fixture with its real
  routing dependency and changed Claude argv. Run provenance and Atlas runtime
  tests natively; independent SPEC then FULL registered review. T1 and T4 may
  share one combined registered FULL ATC after independent SPEC of each.
- [ ] After installation verify actual generated normal-launcher argv in
  the existing no-provider fixture and, if feasible inside the remaining
  acceptance allowance, one bounded Fable print-mode/Agent smoke using the
  same selected model and Atlas launch helper. Label headless smoke separately
  from a fresh interactive Fable/tmux session; never replace existing sessions.

## T3: publish normally and conduct one focused corrected check

Execution checkpoint09:18 UTC: T1/T4 implementation and independent SPEC PASS;
combined native suites322 pass/0 fail/6 Node skips plus1 nested optional skip.
Reference correction RED/GREEN and independent SPEC PASS; final native install
rerun2/2 PASS. Registered FULL ATC adjudication PASS0 critical/0 warnings/100%.
All earlier timeout/block evidence is retained. Three acceptance wrappers/five
native responses exactly reconcile, as do real MUDA and ATC source observations.
Publication and installed verification are now the remaining implementation work.

### Registered review timeout, 09:07 UTC

The one combined FULL reviewer reached its300-second limit after18 observed
native responses without a verdict. Its timed_out state, failed wrapper receipt
and original timeout report are preserved; this is not an ATC pass. No source
or benchmark rerun follows automatically. After read-only trace diagnosis, one
same-thread continuation may finish the already-performed review with no new
investigation, at most120 seconds. It must report any incomplete checks honestly,
not infer PASS from the timeout. Use a new step/report/run/worker, same model and
effort, and retain both attempts' observed usage separately. Publish only after
a valid non-blocking actual gate verdict; otherwise stop and report the block.

### Actual ATC finding adjudication, 09:16 UTC

The continuation returned CRIT1: shared hook YAML also makes the preexisting
flat board default --describe load. The actual blocking verdict is recorded and
preserved. Independent review and the isolated flat-board-scope-proof confirm
that observation, but no registered caller or supported board dispatch moved:
flat wrapper, routing configuration and profile resolver are still absent;
the canonical/nested board runtime remains the only supported board layout.
The no-expansion constraint concerns support/dispatch, not keeping incidental
read-only library imports broken. No new board guard or packaging is justified.

T1 adds only the corresponding sgsd-deliberate reference paragraph to its
allowlist: remove the now-false missing-YAML claim, retain canonical routing
and explicitly prohibit inferring board support from a working --describe.
Run a failing reference-accuracy check before that edit, then verify it and
independent SPEC. One focused same-thread120-second adjudication of this actual
finding may follow, with the exact evidence and documentation diff, no new
investigation or source changes. Preserve all earlier verdicts/spend and stop
if it still blocks; never rewrite the blocking row into a pass.

- [ ] Use complete isolated native source for fixture verification. Preserve
  source hashes and stdout/stderr separately from live acceptance evidence.
- [ ] After reviews, publish the exact scoped commit and use the existing
  guarded normal DEVCP update. Verify source/install hashes, protected config,
  existing pane/process identity and the intended project pin before/after.
- [ ] Use a private labelled acceptance directory or existing approved native
  review workspace; do not add new trust config. Let codex-exec.sh create run
  registrations. Never set SGSD_RUN_ID manually or call run.cjs directly.
- [ ] Prepare the actual board seat through board-dispatch.cjs; run its argv.
  For the communication case, generate a challenge in supervisor memory only
  after pending question is observed, then reply by exact project/owner/worker/
  request identity. Require applied receipt, transformed answer and normal
  wrapper/report validation. Never persist the challenge before completion.
- [ ] Resume one successful recorded thread with unchanged model/effort and a
  fresh report path. Verify new turn/worker/attempt, same thread and retained
  answer absent from continuation prompt. Preserve original report hash.
- [ ] Reconcile each successful run to actual native TokenUsageRecord lines
  using existing capture/parser contracts. Verify input+output totals, distinct
  identity, canonical hashes, subset handling and failed-run unknown usage.
- [ ] Recheck real MUDA and ATC source-byte/receipt/canonical proof using the
  existing operation report. Genuine gate FAIL is not a capture failure. List
  unexercised families separately; do not generate model calls to fill charts.
- [ ] Obtain receiver PID from global health/service identity and verify its
  actual process identity. Sample that PID's CPU-time deltas/RSS and collector
  pending/capacity counters for five minutes. Do not substitute legacy server
  CPU or total directory growth for collector/backlog measurement.
- [ ] Report configured/resolved/live board status distinctly; report Fable
  and Researcher limitations honestly. Final audit separates integrity FAIL,
  historical WARN, trial evidence and provider/billing unknowns.
- [ ] Save concise result/evidence manifest and update this plan/state with
  what actually completed. Longer weekly observation and Windows stay open.
