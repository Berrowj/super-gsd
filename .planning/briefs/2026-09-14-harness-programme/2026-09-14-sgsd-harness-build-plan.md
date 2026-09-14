# SGSD harness build plan: prove the agents delivered useful work

Prepared 14 September 2026. Proposed framework work queue for this session or the Harness worktree. S1-S7 are work-item labels, not new phase numbers.

**Goal:** SGSD should know what an agent actually delivered, whether the checks exercised the requirement, and whether the intended version reached the running system. The common parts must work for Clarity and other projects.

**Architecture:** extend the existing worker adapter, gates, plan validation, control plane and evidence stores. Projects supply their own business rules, checks and operational adapters. Clarity-specific deployment code remains identifiable within `clarity-cp`; unrelated projects must not acquire a SAP or Clarity dependency.

**Execution:** turn each bounded item into the normal numbered SGSD plan, with exact touched files, reproducing tests, verification commands and rollback scope. Use the existing executor and gate workflow. This programme draft does not replace the active milestone or authorize a production interruption.

## Start with S1 and reuse the existing components

The local and devcp Harness state both identify v4.1 Token Economics Atlas, phase 170 / plan 170-15. Phases 171 and 172 remain pending. Coordinate S6 with that work; do not start a second accounting implementation or silently activate its phases.

| Existing source inspected or located | Use in this programme |
| --- | --- |
| `super-gsd/tools/codex-worker/run.cjs`, `control.cjs`, `worker.test.cjs` and `README.md` | Current App Server worker adapter and retained-session control; first S1 investigation target |
| `super-gsd/skills/sgsd-codex-control/SKILL.md` | Current dispatch instructions; verify the whole invocation path |
| `super-gsd/scripts/codex-executor.sh` | Older wrapper and existing exit/report metrics; update only where still used |
| `super-gsd/control-plane/clarity_cp/deploy.py`, `jobs.py`, `guard.py`, `registry.py`, `config.py` | Existing deployment preflight, job records, ownership and configuration |
| `super-gsd/control-plane/tests/test_control_plane.py` | Existing control-plane regression suite |
| `super-gsd/registry/gates.yaml`, `super-gsd/tools/failure-injection/` | Existing gate routing and negative-test machinery |
| `super-gsd/templates/plan-schema-v2.json`, `super-gsd/tools/plan-schema/validate.cjs`, `super-gsd/tools/plan-lock/validate-plan-locked.cjs` | Existing semantic criteria, plan validation and lock validation |
| `super-gsd/scripts/lib/dispatch-planner.cjs`, `super-gsd/tools/dispatch-router/`, `super-gsd/registry/codex-profiles.yaml` | Routing, dispatch contracts and worker limits |
| `super-gsd/scripts/lib/gate-evidence-log.cjs`, `gate-value-log.cjs`, `review-ledger.cjs` | Existing evidence writers; inspect their frozen contracts before extending |
| `super-gsd/tools/telemetry-atlas/` | Existing identities, capture, accounting and monitoring |
| `super-gsd/tools/harness-components/`, `harness-manifest/`, `harness-attribution/`, `harness-evolution/`, `harness-ablation/`, `harness-transfer/` | Existing harness registration, prediction, evaluation and reuse machinery |

Source presence is not proof of production use. For every change, trace the actual skill/tool caller through the runtime and evidence consumer. The existing production-seam incident record shows why a passing helper test alone is insufficient.

## S1: detect actual delivery and stop waiting for dead workers

**Source:** HS-01; worker-control parts of HS-09 and HS-15. **Runs:** during and after agent dispatches. **Reads/writes:** exact owned-process status, scoped Git/artifact evidence and run records; may halt only a worker covered by the dispatch's existing authority.

- [ ] Map the production path for current Linux and Windows workers, retained continuations and any remaining legacy wrapper. Record what already handles death, timeout, missing reports and completion.
- [ ] Keep process outcome, report validity, observed delivery and independent verification separate. A nonzero exit must not erase delivered artifacts; changed files, timestamps or grep matches alone must not mark the task correct.
- [ ] Wait on the exact owned process identity and terminal result, with a bounded timeout and cancellation path. Avoid an image-name test that mistakes a different Codex process for this worker; protect against PID reuse.
- [ ] Define progress appropriate to the task: long tests and read-only research may produce no source-file changes. Use the declared time budget plus actual activity before applying the existing halt policy. Enforce inherited spawn/halt scope and fan-out limits through the real adapter.

**Acceptance:** isolated tests cover a dead worker with no exit file, empty/malformed report, nonzero exit with useful artifacts, another worker still alive, legitimate long-running work and retained continuation. Required invalid/missing evidence never satisfies completion. The normal caller consumes the new observation, and the wait returns within the configured bound plus one observation interval.

**Dependency:** baseline and a compatible evidence mapping only. Do not wait for a new plan schema or whole Atlas milestone.

## S2: prove the running version and close deployment bypasses

**Source:** HS-02 and deployment parts of HS-09. **Runs:** after an authorized deployment and before declaring a deployed outcome; protection runs before interruption. **Reads/writes:** container identity, compose provenance, health/binding observations and existing job/deploy evidence. No automatic deploy or job termination.

- [ ] Extend `clarity-cp` after its existing preflight. That code already checks trusted commits and affected running jobs; inspect whether every normal deploy entry point actually uses it before adding another guard.
- [ ] Add a read-only deployed-state check that compares the intended revision with each required running service. Inspect actual image/build identity and bind-mounted checkout where applicable, plus active compose configuration and mounts. Do not infer running code from a repository's HEAD alone.
- [ ] Report missing/unknown identity, mixed revisions, unhealthy services and unexercised checks distinctly. A matching SHA proves version identity, not business correctness. Binding policy and application authentication require their own observations.
- [ ] Extend existing job protection only where a demonstrated path bypasses it. Resolve real protected targets and stale job state; use existing explicit interruption/override policy with audit and revalidation. Direct SAP writes remain Clarity C2's responsibility.

**Acceptance:** an old container with a new checkout, an unreachable image identity and one mismatched service cannot produce verified deployment. A disposable registered job blocks a conflicting operation through the real deploy entry point; an unrelated service is not blocked. Verify actual process and data survival during the isolated rehearsal.

**Dependency:** S1's evidence identity/mapping and Clarity C7's service/job details. `clarity-cp verify-deployed` is a command proposed by the source brief; it was not present in the inspected CLI and must not be advertised as available before implementation.

## S3: make a green check mean the requirement was exercised

**Source:** HS-05 and gate-order foundation for HS-10. **Runs:** on gate admission/change and relevant verification. **Reads/writes:** registered criteria, protected test cases, gate results and coverage evidence; no production corruption for negative tests.

- [ ] Extend the current gate registry/validator and failure-injection facilities with the behaviour ruled out, evidence required and known-good/known-bad cases.
- [ ] Require proof that a deliberately broken isolated case fails and a valid case passes. Record which required scenario or record class actually ran. Frozen fixtures remain useful but cannot imply coverage of absent live cases.
- [ ] Preserve deterministic failures even when a model reviewer approves. Run cheap prerequisite checks before expensive dependent checks; retain all mandatory gate requirements and bounded diagnostics.
- [ ] Keep scoring/protected oracle material outside executor write authority. Use existing non-pass handling for absent evidence until any required result-contract amendment is approved.

**Acceptance:** known-broken and known-good cases produce opposite results through the production gate caller; missing required coverage cannot turn green; model approval cannot clear a mechanical failure. Clarity C3/C5 checks plug into this mechanism without moving their business expectations into SGSD.

**Dependency:** can start independently of S1. Schema or verdict vocabulary changes follow the existing GATE review and amendment process.

## S4: make requirements measurable without adding needless paperwork

**Source:** HS-03, HS-14, HS-15 and generic support for HS-07/HS-08/HS-12. **Runs:** during planning, context assembly and routing. **Reads/writes:** plans, relevant project-owned context, constraint evidence and amendment records.

- [ ] Extend current semantic criteria rather than duplicating them: the inspected schema already requires `input`, `expected_outcome` and `verification_cmd`. Map the brief's `verifiable_by` meaning onto that field unless a demonstrated gap requires an amendment.
- [ ] Lock requirements and protected-contract baselines with reviewable amendments. Enforce significant domain decisions such as thresholds and defaults; do not require a separate decision record for every incidental numeric literal.
- [ ] Use a small experiment card for exploratory work: question, expected observation, pass/fail condition, time budget and whether to keep the result. Keep these details in the task artifact, not every reply to Jack.
- [ ] Load relevant project-owned rules/cases and validate their locators. Let Clarity declare dynamic-value requirements; keep SAP names and business values out of the generic validator. Missing required evidence is explicit; optional VTP absence degrades gracefully.
- [ ] Extend existing change routing and protected-surface checks. Prefer a suitable mechanical transformation for mechanical work; preserve required semantic and contract verification.

**Acceptance:** a criterion with no executable observable fails; a protected change without its amendment fails; a Clarity task receives its relevant case; a non-Clarity task loads none of the SAP material. Existing valid plans remain compatible or have a reviewed migration. Scoped path checks do not invalidate unrelated work.

**Dependency:** S3 before stronger admission/schema requirements are enabled. Clarity C4/C6 supplies its own rules, but generic planning changes need no live SAP access.

## S5: separate verification from the author's explanation

**Source:** HS-04 and HS-13. **Runs:** at the existing verification/review points and on failed retries. **Reads/writes:** agreed criteria, relevant source/diff, independently produced evidence, review findings and bounded retry lessons.

- [ ] Use existing verifier/review routing with an explicit evidence contract. The verifier may inspect source, locked criteria and test output but should not be primed with the executor's success narrative. Protect hidden scoring material separately.
- [ ] Keep live sensing outside CoVe. CoVe's established offline boundary remains in force; authorized sensors supply the appropriate evidence to the owning checks.
- [ ] On failure, produce a located, actionable diagnosis before retrying. Use file/line when meaningful, or a precise service, record, command or artifact location for operational failures. Cap retries and require a changed hypothesis or approach.
- [ ] Reuse existing challenge/board machinery for consequential disputes. Name the observation that could decide the issue; run an available authorized check rather than adding a debate round. Leave genuinely new policy choices visible.

**Acceptance:** a confidently incorrect executor report cannot influence a withheld-report verification run; a generic unlocated diagnosis is rejected; a repeated unchanged retry stops at its bound; missing live evidence is not synthesized by CoVe. A declared uncertainty remains visible in the outcome.

**Dependency:** S1 outcome evidence and S4 locked criteria. Do not add three paid agent calls to every small task; required existing review tiers still govern dispatch.

## S6: measure false alarms, missed faults and total cost

**Source:** HS-10 and whole-run accounting in HS-02. **Runs:** as evidence arrives and in existing reporting. **Reads/writes:** existing gate/review ledgers, labelled corrections and Atlas run identities/cost data.

- [ ] Join run and gate identities through Atlas and existing evidence writers. Reuse root/child attribution and preserve incomplete capture; never sum already-inclusive totals twice.
- [ ] Record corrections append-only with the original verdict, corrected outcome, evidence and authorized label author. Use counts with denominators: passed checks later shown wrong / reviewed passes, and failed checks later shown acceptable / reviewed failures. These are reviewed subsets, not claims about all runs.
- [ ] Show sample size, unreviewed cases, selection bias and unknown cost. Do not claim calibration from a fixed ten runs or treat absence of overturns as perfect accuracy.
- [ ] Measure cheap-to-expensive ordering and recommend adjustments. Learning from history must not automatically disable a required gate or weaken an acceptance threshold.

**Acceptance:** a small labelled test corpus reproduces both rates exactly, repeated ingestion does not duplicate spend or outcomes, incomplete capture is shown, and policy stays unchanged until its normal review process authorizes a change.

**Dependency:** S1 and S3. Coordinate attribution/reporting gaps with pending Atlas phases 171/172 through the existing milestone process; that dependency does not block C1 or S1.

## S7: keep improvements that help and preserve the evidence

**Source:** HS-11, HS-16 and SGSD evidence/reference parts of HS-12. **Runs:** on harness changes and subsequent evaluation. **Reads/writes:** existing harness manifest, attribution and attempt/evidence records; scoped telemetry and review recommendations.

- [ ] Reuse the existing component registry and change-manifest ledger. Record the predicted benefit, affected component, regression exposure and rollback unit before evaluating the change. Do not create a second `.planning/harness/harness-manifest.jsonl` alongside the existing implementation.
- [ ] Keep Guide/Guard/Sensor/Check as descriptive roles initially. The existing 14 component classes are frozen; adding a Sensor class requires its own demonstrated need and reviewed amendment.
- [ ] Add missing invocation/consumer observations at the actual caller, then compare outcomes using existing attribution, ablation and transfer tools. An observed file read proves loading, not that an instruction was followed.
- [ ] Retain original traces and failed attempts with lineage; summaries link to them. Select retry bases using comparable criteria and evidence, not whichever incomplete score looks highest.
- [ ] Flag unused or harmful controls for review. Preserve required gates, security/audit retention and protected components. Do not auto-delete unobserved controls or revert a shared file because one predicted benefit did not appear.

**Acceptance:** one harness change can be traced from prediction to invocation and observed result; protected material cannot enter the editable set; evaluation failure leaves original evidence intact; a rollback recommendation names the bounded change without touching unrelated edits.

**Dependency:** S1 and S6 for full measurement. Existing trace retention continues before invocation telemetry is complete.

## Agree the connection once, then let each project build independently

At the start of S1, map these information requirements onto the existing versioned result and ledger contracts. They are design requirements, not a new API or permission to widen frozen enums.

| Information | Supplied by |
| --- | --- |
| Project, work item, run/attempt and check identity | Existing SGSD run system and project adapter |
| Claimed result, observed state, report validity and verification outcome | Worker adapter and independent check, kept distinct |
| Source revision, observation time and bounded evidence locator/hash | The producing sensor or test |
| Required scenarios covered, omitted or unavailable | Project-owned check |
| Expected and observed running identity per service | Deployment adapter / `clarity-cp` |
| Read/write scope, cost limit and halt owner | Existing profile, plan and application authorization |

Use current extension points or a compatibility mapping first. If that cannot represent the evidence faithfully, isolate the schema amendment as a GATE-tier task. Descriptive labels such as “invalid result” or “not exercised” must never be silently coerced to success.

Evidence files contain bounded observations and private locators, not credentials or entire business databases. Project adapters choose and validate commands from the approved plan; an evidence record does not authorize arbitrary command execution.

## Prove reuse beyond Clarity

- [ ] Run each shared feature against Clarity and a small fixture repository with no SAP, VTP or Clarity installation. This demonstrates portability; it does not claim deployment to a second live product.
- [ ] Configure project roots, evidence paths, services and commands rather than hard-coding devcp or Jack's home directory in the generic components.
- [ ] Keep provider identity separate from project identity. Exercise Linux and Windows process handling where supported; record any untested platform honestly.
- [ ] Install through the normal SGSD update path and verify the production caller consumes the evidence. Include fresh and retained sessions where the changed mechanism requires them.

VTP store corrections and idea-gate changes remain a VTP-owned follow-up. Future business agents inside Clarity use product permissions and services; building this framework does not make SGSD a required runtime for preparing a quote.

## First implementation handoff

> Start S1 from this SGSD harness build plan. Read the active state and Harness ownership, map the current worker invocation and result path, and identify existing coverage before changing code. Create the numbered implementation plan for the missing delivery/dead-worker protection, with isolated reproductions and exact test commands. Extend the current adapter and evidence contracts under the existing gates, prove the real caller uses the result, and include a non-Clarity fixture. Keep current holds and release authorization intact. Reply briefly with the result, checks and any decision needed.

Do not run the source brief's proposed full research board or adopt its token/time budgets merely because they appear in that document. Retrieve its detailed findings when a specific implementation decision needs them; VTP remains optional.

Research locators from the original brief: S1 MH-05/MH-06; S2 MH-13/MH-08; S3 MA-03/LA-02; S4 MH-02/LB-02; S5 MA-01/LB-01; S6 MA-02/LA-01; S7 MH-07/MH-09. Carry the relevant HS and finding IDs into each implementation plan; these references have not been independently re-researched in this planning pass.

Companions: [ownership and sequence](2026-09-14-harness-ownership-and-sequence.md), [Clarity handoff](2026-09-14-clarity-harness-handoff.md). Source: `2026-09-14-agent-harness-programme.md`. This planning pass inspected code and documentation; it did not run the feature acceptance tests or certify the proposed controls as complete.
