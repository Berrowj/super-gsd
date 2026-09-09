---
date: 2026-09-09
task: 170-07 task 2
status: PARTIAL
scope: static source census; no gate execution or provider calls
source_revision: 935962c4413bf109af4a3c64a717f26dd0cc8fbd
workspace_head_at_start: 3776e2496c4cb0b5ff7be50012b40426d691f286
coverage_complete: false
weekly_comparison_baseline_ready: false
---

# Atlas operational coverage census

Atlas captures provider activity for attached launches, but the audited source does not yet capture the complete SGSD operation lifecycle. In particular, existing gate, MUDA, ATC, routing, context, state, and review ledgers have no implemented normalization bridge into Atlas. Gate/finding/repair fields in the canonical schema are capacity, not evidence of an emitted or received event. A weekly collection trial can expose these gaps; a complete usage/token-waste comparison baseline cannot be certified from this source.

This is the static half of Task 170-07. No live counts are inferred from historical files, no gates or provider tests were run, and no source was changed. All source references below refer to revision `935962c`; `git diff --name-only 935962c -- super-gsd` was empty during inspection. Concurrent 170-07 capture repairs must be reviewed separately. References use repository-relative `path:line` notation so they can be resolved against the recorded revision.

The approved design explicitly selects hybrid native telemetry plus SGSD evidence (design lines 108, 238), requires the full gate lifecycle (547), and puts existing-ledger normalization and invocation census in P171 (824). The active roadmap keeps P171/P172 pending (`.planning/milestones/v4.1-token-economics-atlas/ROADMAP.md:3`); P170 CONTEXT explicitly excludes the full correlation/reporting work (`phases/170-atlas-capture-foundation/CONTEXT.md:16`). This report activates neither phase and proposes no gate optimization.

## What the denominator actually is

Counts below are parsed declarations at the fixed revision, not invocations, eligibility opportunities, or Atlas receipts. They overlap and must not be summed as a count of distinct operations.

| Registry | Parsed denominator | Version and SHA-256 of committed bytes |
| --- | ---: | --- |
| `super-gsd/registry/gates.yaml` | 13 gates; 8 have empty `evidence_emitted` | schema 2 / registry 2.2.1; `30aca70794dcaa78586b19ea72af603fff5c6aac06d799e77ec0127f15021033` |
| `super-gsd/registry/harness-components.yaml` | 35 components; 14 allowed classes | schema 1; `bccb284e84e6a220adab84d2ba1d8809cbf0da92041332e60289ca9fa9852443` |
| `super-gsd/registry/hooks.yaml` | 10 hook rows | schema 2 / registry 2.0.0; `d727dc272b1f1ddcdfddf5e3e331027dd1943dce0a5a490dc552982839f7f899` |
| `super-gsd/registry/session-governance-hooks.yaml` | 9 routes | no top-level version; `8a130d370a283b801cf9f58d46138d2dec37cb8d81bc26ccf9ff4d7024f3c3d0` |
| `super-gsd/registry/skill-routing.yaml` | 30 route rows, including prompt and scheduled routes | no top-level version; `79d0221c46b646ed338575f829d16943c1ba45b35c56d292653698965eb4c723` |
| `super-gsd/registry/agents.yaml` | 8 executor role declarations | `13a97ddcb54a0f9ab4302e84f216814c903ea90d8064412a11f507f48d046fe0` |
| `super-gsd/registry/board-members.yaml` | 6 members; 0 custom slots | `cf63b59a54501dd45ee7539d780da0babd384630ff96831c94f17e48dc0542b5` |
| `super-gsd/registry/rd-board-members.yaml` | 4 members; 4 summoned witness declarations | `0bc3f26c80215d46a7795d650f0c59ee7a207a313536046b5994c6e7eb965915` |
| `super-gsd/registry/review-providers.yaml` | 2 provider declarations | `fbcc254b43c605d9de63e13380a9620512aab99ff41547023f196cf6c99b4246` |
| `super-gsd/registry/cockpit-sources.yaml` | 7 view-source declarations | `5ffa2f06dab12f48a005880f722c63b60d123244f3c99d59bf9dfdbbbf78a54c` |

The existing catalog parser returned `ok:true, rows:35, errors:[]` (`tools/harness-components/catalog.cjs:204`). The registry's `component_count_target:25` at line 14 is not its actual count. Its 35 IDs are:

| Class | Actual component IDs |
| --- | --- |
| prompt | claude-md-global; agents-md-tool-neutral; warp-md-rule-hierarchy; handover-contract-v2; command-envelope-v1 |
| tool | warp-doctor; warp-mcp-read; cockpit-state-adapter; state-resolver; double-agent-executor; harness-benchmark; failure-injection; context-packet; harness-components |
| middleware_hook | orchestrator-hooks |
| skill | sgsd-orchestrate; sgsd-pause; sgsd-cockpit-skill; sgsd-recover-skill; sgsd-doctor-skill |
| memory / workflow / mcp_bridge | memory-index / warp-workflows-pack / warp-mcp-actions |
| gate | complete-milestone-gate; plan-schema-validate; gates-registry |
| dashboard / docs | cockpit-shell; mission-control-tile / warp-operator-guide; harness-evolution-doc |
| protected_oracle / protected_verifier / protected_model_config | hidden-benchmark-decks; scoring-oracle / gsd-verifier-contract / model-routing-config; token-budget-config |
| agent_config | no rows |

The catalog is a change-management catalog, not a complete entrypoint inventory. Exact-or-directory-prefix matching its paths against tracked `super-gsd` files with extensions `.cjs/.mjs/.js/.sh/.ps1/.py` matches 24 of 410 files, leaving 386 unmatched. This intentionally broad exploratory count includes tests and fixtures; it is **not** a production-operation or token-coverage percentage. Examples outside catalog paths include telemetry-atlas, codex-worker, codex wrappers, gate-value/review writers, and most hooks. The catalog also declares a placeholder user memory path and `super-gsd/agents/gsd-verifier`, neither a matching tracked source path. No execution failure is inferred from those catalog declarations.

## Registered gate coverage

`W` below means an implementation writer exists; `D` means the orchestrator contract instructs an agent to emit the evidence. Neither establishes that it ran. For **every row below**, an Atlas SGSD-gate adapter, gate-invocation identity, finding/repair chain, and exact gate-token join were **not found** in the audited capture implementation. Static source cannot prove an Atlas receipt.

| Exact registered gate (`gates.yaml` line) | Declared evidence | Actual source signal / limitation |
| --- | --- | --- |
| per-dispatch-ATC (37) | `commit-reviews.jsonl` | D: orchestrate:2392 per-phase evidence, :2428 canonical `review-ledger`, :2464 gate-value outcome; W: `scripts/lib/review-ledger.cjs:185`, `gate-value-log.cjs:259`. Separate FIRE/SKIP contract at orchestrate:2271. Qualitative Codex review, not a deterministic check. |
| phase-level-ATC (60) | `{N}-ATC-REVIEW.md` | D: orchestrate:1319/:1500 gate-value skip/fire and report contract. Does not become a received Atlas gate merely because its Codex call is captured as reviewer tokens. |
| classifier-haiku (78) | none | D: orchestrate:617/:650/:677 records cache/frontmatter-derived classification and token-log entries; legacy registry name says use Codex/local classification. No dedicated mandatory gate evidence path. |
| context-selector-haiku (92) | none | Registry repair contract derives recall queries from plan evidence. No dedicated emitted gate identity/evidence path. Legacy name must not be counted as an actual Haiku invocation. |
| sgsd-recall-queries (106) | none | `scripts/sgsd-recall.sh` is the declared script; skill-routing:336 references gate. Recall results/agent instructions are not a normalized Atlas consultation event. |
| intent-injection (123) | none | D: orchestrate:766 specifies `intent-log.jsonl`; the registry omits that emitted path. No receiving Atlas adapter or packet-use join. |
| MUDA-waste-audit (136) | `WASTE.md` | W: `scripts/sgsd-muda-audit.sh:518` writes `muda-log.jsonl`; `scripts/lib/orchestrator-hooks.cjs:713` writes validated scheduled gate outcome. Numeric probe detail is in probe JSON/WASTE, while ledger stores verdicts/counts. |
| qualitative-waste-audit (162) | `WASTE.md` | W: optional Codex call at `sgsd-muda-audit.sh:408`, step `muda-qualitative`; findings appended to WASTE, optional verdict added to same MUDA ledger. It needs its own invocation/cost identity despite sharing the report. |
| sgsd-curate-learnings (186) | none | Declared `scripts/sgsd-curate.sh` writes memory artifacts. Skill route at :355; no proof of later relevant consultation or prevention follows from a write. |
| token-log (211) | none | D: orchestrate:2648/:2953; W: `hooks/gsd-token-logger.js:41` writes estimates. Edge-guard explicitly exempts step 11 (`scripts/lib/edge-guard.cjs:67`). Cannot audit expected token-log emissions from empty registry emits. |
| vtp-enrichment (226) | milestone phase VTP-ENRICHMENT.md | W: `scripts/lib/vtp-enrichment-gate.cjs:188` artifact writer; optional/degraded provider contract. Availability or an artifact is not a provider-token/gate-outcome join. |
| verifier-row-arithmetic (248) | none | Registry points to phase verify script/report arithmetic. No dedicated mandatory emitted gate record; observing a generic Node/Bash tool result cannot identify the gate. |
| verifier-detail-vs-summary (264) | none | Registry points to VERIFICATION detail/summary reconciliation. No dedicated mandatory gate record or Atlas operation join. |

The gate predicate API (`scripts/lib/gates-registry.cjs:122`) returns eligibility but does not append an eligibility event. Edge-guard records caller-supplied expected/actual/missing emits (`scripts/lib/edge-guard.cjs:94`); it is valuable existing evidence, but empty declarations and uninvoked transitions leave no complete denominator. Do not infer missed gates solely from absent files.

Gate-value normalization preserves gate, phase, milestone, duration, verdict, and a small registry snapshot, but creates its own timestamp/random `run_id` and drops unspecified extension fields (`scripts/lib/gate-value-log.cjs:174`). That is not `sgsd_run_id`. The writer explicitly excludes cost telemetry at :48. Review-ledger retains original rows under `_legacy` and report references (:117), but likewise has no required finding/repair/provider-request identity (:130). Legacy `_legacy` content must be parsed by a versioned adapter, not assumed uniform.

## Other operational families and entrypoints

| Family | Actual writer or runtime evidence | Atlas bridge and remaining identity/outcome gap |
| --- | --- | --- |
| Native Claude activity | `tools/telemetry-atlas/otlp.cjs:82` normalizes request/error/refusal/tool/session events; :138 reads provider token fields, :146 tool outcome/duration/size. | Implemented intake (`server.cjs:151`). Session/request/tool IDs supported; missing stable request identity becomes coverage-only (:162). Generic Bash/Read/MCP activity does not reveal which SGSD operation ran. |
| Native Codex worker usage | `tools/codex-worker/usage.cjs:11` projects per-response rollout token records; :66 binds the acknowledged thread/turn with bounded reads. | Implemented private spool intake (`server.cjs:269`), exact response/thread/turn/session identities, `request_id:null` explicitly. Scope is only registered project/role. `accounting.cjs:49` makes Codex OTLP non-additive when rollout is authority; never sum both. Live acceptance is a separate question. |
| Executor / research / planning / verifier / spec review | `scripts/codex-executor.sh:263` executor ledger; `codex-exec.sh:810` phase/plan/step/duration/exit ledger; `tools/codex-worker/run.cjs:55` mailbox record carries phase/plan/step, Atlas run and wrapper attempt, plus resume ancestry. Orchestrate:161/:176/:184 specifies research/final-plan/spec gates. | Wrappers attach Atlas (`codex-exec.sh:769`, `codex-executor.sh:214`, `codex-patch-executor.sh:229`). Reviewer wrapper defaults all non-board work to `reviewer` (:773), so planner/research/verifier semantics are not recovered from role. Worker record is a promising join source, not an implemented Atlas operation adapter. |
| Retries, failures, repair dispatches | Wrapper timeout escalation uses a new invocation (`codex-exec.sh:966`); wrapper/worker exit and resumed-from evidence exist. | Provider retry fields cover provider events, not SGSD repair lineage. No enforced `retry_group_id`, `finding_id` or `repair_id` linkage from these sources into canonical events. HTTP request identity can remain unknown for Codex even when response tokens are exact. |
| Board / R&D / recovery | `scripts/lib/board-dispatch.cjs:56` creates a unique attempt directory and :61 prepares the standard wrapper with member step and phase/plan. `codex-exec.sh:774` uses board role for board/R&D contracts. Recovery launch attachment in `scripts/sgsd-stop-handoff.sh:595` and `sgsd-autopilot-watchdog.ps1:97`. | Attached provider cost-center capture exists. Member/decision/challenge/repair links and acceptance outcomes remain local artifacts or worker records; no Atlas importer. Declared seats do not prove which seats were convened. |
| Routing / scheduled skills / policy gates | `scripts/lib/orchestrator-hooks.cjs:1058` writes route decision, gate reference, trigger inputs, skip/fire, source and dry-run to `gate-evidence.jsonl`; :1116 records execution result. `gate-evidence-log.cjs:159` is the writer. | Ledger-only. This is stronger operational evidence than schema declarations. Producer validation (:713; `skill-routing-registry.cjs:478`) prevents unrelated route output claiming gate success. Import it rather than duplicating enforcement. |
| Hooks / local tools / MCP | Registered hooks name heartbeat/activity/token/checkpoint/context/intent/handoff surfaces. W: `hooks/sgsd-activity-logger.js:184`, `sgsd-heartbeat.js:84`, `tools/codex-hooks/log-tool-event.cjs:29`. | No hook/ledger adapter. Codex hook logging includes argument snippets (:46); activity/heartbeat logs may truncate themselves (:193/:92). Raw file copying would violate Atlas privacy/retention assumptions. Installed and actually fired status are unverified by this source census. |
| VTP / substrate / memory | `scripts/lib/substrate-invocation-witness-store.cjs:351` mirrors pre-allowed/rewritten/consumed observations with hashed session/tool identity; `demand-baseline-ledger.cjs:157` writes query eligibility with decision-ID dedup and denominator state (:258). | Ledger-only. Existing substrate invocation guard (`tests/vtp-substrate-policy/assert-vtp-substrate-policy.cjs:324`) covers substrate calls, not every Claude/Codex invocation. Optional VTP absence must remain an availability state, not a zero-use success. |
| Context / prompts / artifacts / state | `tools/context-packet/build.cjs:184` appends packet evidence, :823 creates body-derived packet identity. `tools/state-resolver/resolve.cjs:756` reads pulse/activity fallback. `scripts/lib/orchestrator-live-writer.cjs:43` defines 16 live event types, :86 writes phase/plan/data into `.planning/ORCHESTRATOR-LIVE.jsonl`. | No normalization/join into Atlas. `active_skill`, prompt digests, packet/handoff IDs and target repo fields remain nullable schema/defaults. State lookup is not evidence of a historical state transition or prompt component actually consumed. |
| Component changes / harness evolution | `tools/harness-manifest/manifest.cjs:12` writes `harness-change-manifest.jsonl`; :36 requires component/change/evidence IDs and predicted token/gate deltas. | Ledger-only predictions; not runtime component-use counts or measured savings. Catalog presence is not prompt/tool invocation instrumentation. |
| Cockpit / observers / narrative | Cockpit source registry and state adapter consume local evidence. Narrator actual Claude launch has attachment (`scripts/sgsd-narrative.ps1:1108`); observer role is allowed (`global-store.cjs:9`). | Attached narrator cost can be registered. Role enum does not prove every observer entrypoint is covered. View render health and deterministic process/resource overhead are not SGSD gate outcomes or model token costs. |
| Additional gates outside the 13 | Plan-schema writes `plan-errors.jsonl` (`tools/plan-schema/validate.cjs:260`); orchestrate:880 mandates plan-finalization, :518 spec compliance. Milestone close composes provider-circuit/release-readiness and other checks (`scripts/sgsd-complete-milestone.cjs:1376`, :1532); skill-routing:289 identifies phase-folder audit as its own signal. | These must be in the operation census even though absent from `gates.yaml`. Their existing tools retain gate authority; Atlas only observes. No complete cross-registry entrypoint census/guard found. |

One concrete invocation exception is `tools/codex-rerun/rerun-missing-reviews.cjs:139`: it directly launches `codex-worker/run.cjs` without creating an independent Atlas registration at that callsite. `tools/harness-benchmark/sgsd-blind-live-controller.mjs:442` launches a supplied command; :983 defaults to direct Claude. These need explicit classification (production, diagnostic, fixture, disabled, externally supplied, inherited context) before any claim of all-entrypoint capture. Do not assume either actually ran during this trial. Focused provider-site searches found no general Atlas guard rejecting newly unclassified repository invocation sites; the approved design requires one at lines 772-773.

## MUDA and ATC measurement traps

1. Deterministic MUDA has five named probes: `haiku_fails`, `narrative_age_sec`, `git_spawn_pct`, `extra_processing`, `inventory` (`scripts/sgsd-muda-probe.sh:260`). Its JSON has value, threshold, evidence and waste class. `muda-log.jsonl` reduces these to verdicts plus run warn/fail/exit (`sgsd-muda-audit.sh:518`). Preserve the richer source as content-free measurements and hash/ref evidence. A legacy probe name does not establish current provider ownership.
2. Missing observations can look successful: extra-processing starts at zero with “no commit-reviews.jsonl found” and defaults to PASS (`sgsd-muda-probe.sh:149`, :172). Atlas must record eligible/input-row coverage and classify zero relevant observations as `no_coverage`, without altering the existing gate verdict.
3. Qualitative MUDA is a separate model operation. Runtime script condition requires `PROBE_EXIT == 0`, diff >=200, enabled and non-dry-run (`sgsd-muda-audit.sh:375`), while registry trigger permits mechanical PASS or WARN (`gates.yaml:175`). Record the actual script/registry versions and decision source; do not silently equate declared and executed eligibility. This census does not change either policy.
4. MUDA explicitly remains write-path-only: pre-dispatch consultation is deferred (`skills/sgsd-muda-audit/SKILL.md:12`). Curated memory is not proof of reinjection, prevention, or avoided work. Qualitative findings, mechanical findings and custom WASTE prose must retain provenance and cannot be counted as interchangeable unique defects.
5. ATC dispatch/phase reports, wrapper outcomes and canonical review rows can describe the same review. Existing review aggregation dedups legacy tuples (`review-ledger.cjs:31`); Atlas needs stable invocation/finding identity and duplicate/confirmation/refutation status before calculating marginal yield, overlap, rechecks or repair costs. Report counts are not unique-defect counts.
6. `tools/gate-keep-kill/rubric.cjs:141` explicitly uses best-effort gate-name matching; `tools/gate-savings/report.cjs:473` labels waste points as estimates, not exact dollars/tokens. Those tools already consume evidence; use their inputs/outputs with provenance. Their existence does not make a weekly attribution table exact.

## Capture, receipt and token truth

`tools/telemetry-atlas/contract.cjs:18` allows broad identities/scopes/event types, but the implemented OTLP normalizer initializes SGSD gate/phase/plan/target/component fields to null (`otlp.cjs:66`). `global-store.cjs:62` assigns launcher registration scope. Native Codex accounting restricts scope to launcher project/role and forbids gate/outcome fields (`accounting.cjs:25`, :33); its usage projection is explicit at `codex-worker/usage.cjs:22`. The private spool accepts status-line, lifecycle and native rollout sources only (`server.cjs:269`). An API accepting a canonical envelope is not a producer or a bridge from SGSD ledgers.

Therefore: provider requests/tool outcomes may already be received, while SGSD semantics remain unknown. Exact per-response tokens cannot be apportioned to a gate from approximate timestamp overlap alone. Launcher directory hashing (`global-store.cjs:35`) identifies a local registration path; it does not establish the repository actually edited, cross-worktree identity, cross-machine equivalence, or SGSD source SHA. Local `gsd-token-logger` uses word-count estimates at lines 34-37; `tools/token-attribution/collect.cjs:328` separately reads Claude session records and :442 appends its own ledger. No Atlas reconciliation adapter for that ledger was found. Never add estimates, transcript records, OTLP and rollout usage indiscriminately.

Static Atlas receipt count is **unmeasured**. The parent agent owns fresh DEVCP evidence and exclusions. Its reported live snapshot supports partial capture, but is not reproduced or made canonical by this source-only report. Local legacy Atlas partitions, global project partitions, old benchmark projects and leaked fixture registrations require distinct provenance; they must not be summed as a workload cohort. Bounded scans that skip large files report `unscanned`, not missing. Malformed rows, rejected-native attribution and nested identity fields need explicit scan scope.

## Smallest implementation sequence within approved P171/P172

1. Finish P170 capture acceptance and record installed SHA/config/accounting source per project and launcher. Preserve existing baseline exclusions and old evidence; independent diagnostic runs must be identifiable and isolated. Do not infer Windows or fleet freshness from one DEVCP process.
2. In a P171 plan, freeze a versioned **union** inventory: registry entries plus discovered runtime gates, tools, hooks, scheduled routes and repository-owned provider entrypoints. Classify each as eligible production/diagnostic/fixture/disabled/optional, name its owner/writer, and guard newly unclassified invocation sites. Reuse existing parsers; do not create a parallel gate evaluator. Record registry and source digests, installed witness and capture epoch with the denominator.
3. Add a bounded, fail-open, allowlisted adapter for existing writers/receipts, prioritizing worker attempts and gate-value/review/MUDA/gate-evidence/edge-guard/live-stream records. Carry run/session/dispatch/handoff/gate-invocation/attempt identities from their real boundaries; retain unavailable fields as unknown. Derive eligibility from actual decision evidence and distinguish eligible, fired, skipped, missed and outcome-pending. Add source-file offsets/content-free hashes, dedup keys, crash-tail handling, backfill provenance, independent dropped/malformed gaps and writer freshness. Do not ingest raw prompts, reports, arguments or stderr previews.
4. Join findings/repairs/rechecks using versioned deterministic fingerprints and explicit links, preserving duplicate/confirmed/refuted status and evidence hashes. Attach request/response tokens through actual worker/provider identities and record residual/ambiguous allocation rather than splitting totals by guess. Record deterministic MUDA resource/duration observations separately from qualitative model usage. Add prompt/context manifest use and target-repo evidence only at actual consumption/mutation boundaries, preserving optional-VTP degradation.
5. Validate cross-project/session/resume/retry and gate-repair fixtures without paid calls, then the approved live calibration denominators and 24-hour soak. Freeze capture configuration only once expected-versus-observed coverage, failure gaps, privacy/dedup and source freshness are accepted. Design lines 785-802 specify acceptance; line 836 starts the two-window clock after installed, frozen correlation capture. Schema/fixture success alone cannot start it.
6. P172 derives deterministic JSON/Markdown/HTML views with per-field denominators, freshness, exclusions and confidence; it consumes existing gate tools without changing their enforcement. One week can be interim evidence. Design lines 805-821 require at least two complete seven-day windows for averages or optimization recommendations. Gate/routing/prompt changes remain a separate planned workstream.

## Reproduction commands (read-only)

Run from the repository root. These inspect committed bytes or existing parsers, do not invoke a gate and make no provider call. The installed `js-yaml` dependency was available during this census. No historical ledger totals are produced.

```powershell
git rev-parse HEAD
git diff --name-only 935962c -- super-gsd
node -e "const cp=require('child_process'),y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml'),c=require('crypto');for(const [f,k] of [['gates','gates'],['harness-components','components'],['hooks','hooks'],['session-governance-hooks','routes'],['skill-routing','routes'],['agents','agents'],['board-members','board_members'],['rd-board-members','board_members'],['review-providers','providers'],['cockpit-sources','sources']]){const s=cp.execFileSync('git',['show','935962c:super-gsd/registry/'+f+'.yaml']);const r=y.load(s.toString());console.log(JSON.stringify({file:f,version:r.registry_version||r.schema_version||null,sha256:c.createHash('sha256').update(s).digest('hex'),count:r[k].length,rows:r[k]}));}"
node -e "const r=require('./super-gsd/tools/harness-components/catalog.cjs').loadRegistry();console.log(JSON.stringify({ok:r.ok,count:r.rows.length,errors:r.errors,rows:r.rows}));"
node -e "const cp=require('child_process'),y=require('./super-gsd/tools/plan-schema/node_modules/js-yaml');const c=y.load(cp.execFileSync('git',['show','935962c:super-gsd/registry/harness-components.yaml'],{encoding:'utf8'})).components;const files=cp.execFileSync('git',['ls-tree','-r','--name-only','935962c','super-gsd'],{encoding:'utf8'}).trim().split('\n');const paths=c.flatMap(x=>x.paths);const code=files.filter(f=>/\.(cjs|mjs|js|sh|ps1|py)$/.test(f));const covered=code.filter(f=>paths.some(p=>f===p||f.startsWith(p+'/')));console.log(JSON.stringify({source_code_files:code.length,catalog_path_matched:covered.length,not_path_matched:code.length-covered.length}));"
git grep -n -E 'sgsd_ledger|sgsd_hook|gate_invocation_id|finding_id|repair_id|target_repo_id' 935962c -- super-gsd/tools/telemetry-atlas
git grep -n -E 'logGateValue|appendReviewRow|recordTransition|logGateEvidence|appendTelemetry' 935962c -- super-gsd/scripts super-gsd/skills super-gsd/tools
git grep -n -E 'invocation.*census|census.*invocation|unclassified|cost.center' 935962c -- super-gsd/tools/telemetry-atlas super-gsd/tests super-gsd/scripts
git grep -n -E 'claude --print|codex-worker/run.cjs|sgsd_atlas_attach|Start-SgsdAtlas|spawn\(command' 935962c -- super-gsd/scripts super-gsd/tools
```

The last searches are discovery candidates, not a complete classified invocation census: comments, fixtures and delegated wrapper calls need source review. At a later revision, regenerate counts/hashes and inspect added sites before reusing this report as a denominator.
