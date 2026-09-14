# Clarity harness handoff: make incorrect data and behaviour visible

Prepared 14 September 2026. Proposed work queue for the Clarity team. C1-C7 are work-item labels; create the relevant numbered SGSD implementation plans before source changes.

**Goal:** Clarity should distinguish a correct result from an empty, stale, incomplete or unsuccessful result. These protections must keep working when development agents are offline.

Clarity owns its SAP rules, application permissions, integrations and product tests. SGSD owns worker supervision, the common gate runner and framework policies. The existing `clarity-cp` remains the deployment control; its framework changes belong to the SGSD lane.

## Start C1, then work through the dependencies

| Item | What it delivers | Dependency |
| --- | --- | --- |
| C1 | Bad queries and missing storage produce visible errors | Existing-state check below |
| C2 | SAP writes are checked; conflicting writers cannot overwrite each other | C1's error semantics; application write-path inventory |
| C3 | New public endpoints and consumers have working routes and topics | Existing-state check; can start independently of C1 |
| C4 | Agreed SAP examples and business rules for tests | Existing-state check; can start independently of C1 |
| C5 | Screens pass realistic layout and business checks | C4; SGSD S3 before promotion as a required gate |
| C6 | Business values retain their source, freshness and write ownership | C4; C2's ownership mechanism where writers overlap |
| C7 | Release and job evidence connects to SGSD and `clarity-cp` | Existing `clarity-cp`; coordinate its receipt with SGSD S2 |

Clarity can build and run its tests before the new SGSD integrations are available. Save results through existing evidence mechanisms; avoid creating a competing framework format.

## First establish what already exists

- [ ] Read this worktree's `.planning/STATE.md`, checkpoint, current plan and ownership records. Confirm where the relevant service is actually built and deployed.
- [ ] Record each affected control as present and demonstrated, present but unverified, or missing. Link the implementation and its test or incident reproduction. Build only the gap.
- [ ] Name the exact source files, test project and currently supported test command in each implementation plan. The paths below are verified starting points, not a claim that one service handles every SAP operation.
- [ ] Use current field metadata and current incident evidence. The original brief's ERR-0024/ERR-0025 labels also refer to unrelated gateway incidents in the repository; identify incidents by description and evidence path as well as number.

| Verified starting point in the Clarity repository | Use |
| --- | --- |
| `.planning/knowledge/data/anti-patterns.md` | Existing error register and watermark guidance |
| `.planning/knowledge/data/how-to-add-a-pipeline-stage.md` | Pipeline requirements and reconciliation pattern |
| `backend-dotnet/src/Shared/Clarity.SapCache/Services/IncrementalSyncService.cs` | Existing sync implementation |
| `backend-dotnet/src/McpSapServer/Services/MongoSapQueryService.cs` | One read path to trace |
| `backend-dotnet/src/ProcurementService/ProcurementService.API/Services/SapUdfWriteBackService.cs` | One application SAP write path to trace |
| `clarity_pipeline/andon.py` | Existing `RecordCountReconciler` implementation |
| `backend-dotnet/src/ApiGateway/` and `docker-compose*.yml` | Gateway configuration and service/topic wiring; resolve the active files |
| `.planning/tools/browser-audit/audit-probe.mjs` and `README.md` | Existing browser probe; document current host requirements |
| `src/internal-dashboard/package.json` and affected .NET test project | Existing frontend and backend test entry points |

Read-only path inventory was performed against `/opt/clarity/project-clarity-erp` at `85813dc5a` on 14 September. Recheck in the assigned worktree before editing.

## C1: show bad queries and missing storage as errors

**Source:** HS-17; ERR-0022 and ERR-0031. **Owner:** Clarity data/integration code. **Runs:** during application reads and in regression tests. **Access:** metadata, requested data and bounded diagnostics; no business writes.

- [ ] Trace the actual SAP query builder and affected database readers. Reproduce one invalid-field request and one missing-store request in an isolated test setup.
- [ ] Validate selected/expanded fields against the relevant entity and company's metadata. Cache metadata with an explicit freshness rule; unavailable validation must remain distinguishable from a valid empty result.
- [ ] Propagate a missing required table/collection and upstream failures through the existing error contract instead of returning a successful empty array. Explicitly optional collections may retain their documented empty behaviour. Avoid a new database-existence query on every normal read where existing database errors or startup validation suffice.
- [ ] Check the caller and screen: a dependency failure must not appear as "no records".

**Done when:** an invalid field is rejected before sending the data request; a missing required store produces a visible failure; a valid query with zero matching records still succeeds. Tests cover all three and the normal caller path. Use a field proven absent from test metadata, not an assumption that `U_QuoteType` is invalid everywhere.

## C2: verify SAP changes and protect shared fields

**Source:** HS-17 write/ownership parts and HS-09 application writes. **Owner:** Clarity integrations. **Runs:** during writes and background sync, even with SGSD stopped. **Access:** only the business records already permitted through the application, plus ownership and audit records.

- [ ] Inventory the writers for the first affected field, starting with the reported `DocumentSpecialLines` case. Keep application permissions and supported SAP update semantics in the write path.
- [ ] After an acknowledged write, read the expected state through an authoritative read path that does not simply return the writer's stale cache. Compare the requested fields or collection semantics, not the entire raw JSON response.
- [ ] Treat an unchanged value as success when it already equals the requested value. A requested change that did not happen fails verification. An unavailable or inconclusive read-back remains unverified and must not trigger an automatic duplicate write.
- [ ] Enforce ownership across competing writers at the shared storage/write boundary. Cover lease renewal, expiry and stale-owner rejection; a local process lock alone is insufficient when writers run in different services.

**Done when:** tests distinguish a successful change, an already-correct idempotent request, a silent no-op and unavailable verification. Two competing writers cannot overwrite a protected field; an expired owner cannot resume writing after takeover. Rehearse writes in an approved test company or isolated fixture before any production rollout.

## C3: prove routes and consumer topics are connected

**Source:** HS-17 development checks. **Owner:** Clarity API and integration tests. **Runs:** when relevant changes are verified and at release smoke. **Access:** route/endpoint/topic declarations; controlled read requests and disposable test messages.

- [ ] Resolve the deployed gateway configuration and topic initialization mechanism. Do not assume a standalone `kafka-init` file exists; the first inventory did not find one.
- [ ] Check that each newly exposed endpoint reaches its intended handler with the intended authentication. Explicitly internal endpoints need an internal-route declaration, not a public gateway route.
- [ ] Check each changed consumer against topic creation/configuration and a test message reaching its handler. Reuse existing gateway and messaging test infrastructure.

**Done when:** removing a required route or topic from an isolated copy makes the check fail; a correctly connected endpoint and consumer pass. A configuration-file match alone cannot prove request delivery. Attach this Clarity-owned check to the existing SGSD gate mechanism.

## C4: give agents and tests the correct SAP meaning

**Source:** HS-08. **Owner:** Clarity business/data maintainers. **Runs:** during relevant task preparation, diagnosis and semantic testing. **Access:** approved observations and private example records; no automatic repairs.

- [ ] Create a small case catalogue for kit-child zero-price lines, genuinely mispriced zero lines, payments awaiting allocation, missing payments and credit notes.
- [ ] For each pair, record the observation, expected interpretation and the important difference. Include dataset grain, source, known limitations and evidence date. Record counts only when measured, with their denominator.
- [ ] Reuse the same catalogue for task context, calculations and C5 expectations. Supply only the relevant cases to each task. Keep customer data in private evidence; use redacted examples in shared code.

**Done when:** a task touching margin or payment interpretation receives the relevant case; the known legitimate and defective cases produce different expected outcomes. An unsupported semantic claim is visibly unresolved. Do not invent business rules to make a test pass.

## C5: test screens with representative business records

**Source:** HS-06, using C4 and SGSD S3. **Owner:** Clarity frontend/product tests. **Runs:** during UI verification and selected release smoke. **Access:** read-only frontend/read-model records and screenshots; isolated broken fixtures for negative tests.

- [ ] Extend the existing browser probe or test runner to assert layout, rather than relying on screenshots alone. The inspected generic probe sets one 1440px viewport; multi-width coverage needs explicit verification or implementation.
- [ ] Cover long text, dense labels and the relevant C4 business cases. For the programme's desktop views use 1280, 1440 and 1920 widths, adding other supported widths when the product requires them.
- [ ] Assert that required text stays visible, labels do not overlap and semantic labels match the agreed case. Preserve deterministic regression fixtures alongside dated, read-only checks of current records.

**Done when:** a known-broken fixture fails; its correction passes; a report lists the record classes, widths, assertions and source revision actually checked. Missing access or an absent required record class is reported as not exercised and cannot satisfy that acceptance criterion.

Live observations come from a separate authorized sensor. The CoVe verifier remains offline and receives the permitted evidence only.

## C6: preserve the source and freshness of business values

**Source:** HS-07, Clarity parts of HS-12 and HS-17 watermarks. **Owner:** Clarity data models and pipelines. **Runs:** when producing and reading registered values. **Access:** owned data pipelines and their provenance/checkpoint records.

- [ ] Start with one bounded family, supplier lead-time estimates, then extend to forecasts and coverage calculations. Record its source or calculation, observation time, valid scope and unknown/stale behaviour.
- [ ] Distinguish an estimate from a historical fact. An agreed order price or measured duration can remain a stored number. An invented default must not be presented as an observed current value.
- [ ] Define the authoritative source and permitted writers per object/field. SAP, Postgres and Mongo do not need one universal owner; an authorized projection builder may write its generated read model, while unrelated writers must be refused.
- [ ] Trace watermark handling through the actual sync path. Use the established wall-clock `sync_ts` pattern, retaining checkpoints safely across failure and retry; do not advance past unprocessed records.

**Done when:** known, stale and unknown estimates are distinguishable; historical facts remain intact; unauthorized projection writes are rejected; a partial sync failure and retry loses no records. Coordinate project-defined provenance requirements with SGSD S4 without making this runtime protection depend on SGSD.

## C7: supply deployment and long-job evidence

**Source:** Clarity integration parts of HS-02 and HS-09. **Owner:** Clarity deployment/job maintainers. **Runs:** at build/deploy and throughout long jobs. **Access:** service build identity, job registration/heartbeat/checkpoint records and authorized operational health checks.

Start by supplying service/job details to S2. Finish the caller integration when S2's report is available; neither team needs to wait for the other's whole work item before starting.

- [ ] Identify how each selected service can prove its built version, and which compose files and mounts actually supply its code. Agree this evidence with SGSD S2.
- [ ] Wire long jobs into existing `clarity-cp` registration and lifecycle calls. Include affected services, checkpoints and interruption cost; do not build another job registry.
- [ ] Confirm normal deployment callers use the existing preflight and consume S2's post-deploy report when available. Keep health, version match, network binding and application authentication as distinct observations.

**Done when:** a registered dummy job prevents a conflicting deployment through the normal path, and an unaffected service can proceed. A stranded or wrong-service commit is not reported as deployed. Stale/missing job state is visible, not assumed safe.

## First implementation handoff

Paste this into the Clarity session with this document:

> Use this Clarity harness handoff. Start with C1 only. Read the current state and ownership, locate the real query and error-handling paths, and reuse existing protections. Create the numbered implementation plan, reproduce invalid-query and missing-store behaviour in isolated tests, then implement the missing protection under the existing gates. Prove that genuine empty results still work. Keep production writes, deploys and other work items within their existing authorization. Reply briefly with what changed, the checks and any decision needed.

For every item, retain the original failure evidence, the fixed-path result and the exact revision tested. Report separately whether it is implemented, verified or deployed.

Research locators from the original brief: C1 MH-05; C2 LD-07; C3 MH-05; C4 LC-06; C5 LC-02/LA-02; C6 LB-04/MA-06; C7 MH-13/LD-08. Carry the relevant HS and finding IDs into the implementation plan and consult their detailed findings when needed.

Companion: [SGSD build plan](2026-09-14-sgsd-harness-build-plan.md). Original research brief: `2026-09-14-agent-harness-programme.md`. The brief's historical examples need revalidation; the six detailed research appendices were not independently reviewed for this ownership handoff.
