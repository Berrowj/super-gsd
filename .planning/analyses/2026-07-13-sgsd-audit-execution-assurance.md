# SGSD frontier audit — execution fabric and assurance

**Date:** 2026-07-13
**Lane:** Codex execution, context authority, review, gates, repair, and release assurance
**Purpose:** milestone-generation input, not a source-change plan
**Evidence boundary:** repository/config inspection plus a bounded Windows launcher reproduction. The audit checkout has no `.planning/metrics/` directory and no `.planning/mesh/memory/cmbs.jsonl`; therefore this report does **not** claim live dispatch frequency, token spend, latency, gate yield, or repair success rates.

## Executive verdict

SGSD has the right strategic split: Claude/Opus is the control plane and Codex is the delivery fabric. It also has unusually strong individual components: typed profiles, a context registry and packet builder, a real detached-worktree executor, allowlisted patch application, independent review contracts, ATC/MUDA/edge/release gates, repair vocabularies, and append-only evidence writers.

The backbone is nevertheless fragmented. The production orchestration specification routes around several of the strongest mechanisms:

1. The generic executor wrapper launches Codex with workspace write access in the caller's checkout, while `requires_worktree`, `allowed_write_roots`, hook requirements, profile concurrency, and locked-plan declarations live mainly in registry metadata (`super-gsd/registry/codex-profiles.yaml:26-60`; `super-gsd/scripts/codex-executor.sh:115-120`; `super-gsd/scripts/codex-executor.sh:204-212`).
2. The double-agent executor actually creates a detached worktree, checks the allowlist and acceptance command, captures a patch, and applies it back, but the orchestrator invokes it only in `--route-only` mode before falling back to the generic wrapper (`super-gsd/tools/double-agent-executor/run.cjs:584-710`; `super-gsd/skills/sgsd-orchestrate/SKILL.md:1962-2019`).
3. Context packets are documented as the only legal execution surface, yet packet build failure explicitly falls back to a hand-composed prompt and the external hook path continues through a legacy raw prompt (`super-gsd/tools/context-packet/build.cjs:4-23`; `super-gsd/skills/sgsd-orchestrate/SKILL.md:1895-1956`).
4. Delivery is hard-locked to Codex, but the dispatch router can fall back to Claude when its health ledger is absent or stale; in this checkout that ledger is absent (`super-gsd/skills/sgsd-orchestrate/SKILL.md:387-419`; `super-gsd/tools/dispatch-router/route.cjs:143-168`; `super-gsd/tools/dispatch-router/route.cjs:295-315`; `super-gsd/tools/dispatch-router/route.cjs:530-608`).
5. Gate definitions are richer than their mechanical closure path. Evidence append failures are intentionally non-blocking, several registry evidence paths still point at the legacy `.planning/phases/{N}` topology, semantic acceptance is implemented as an audit skill but was not found in the searched core orchestration/closure callers, and the milestone close command returns success for unsupported milestone versions, including v3.x (`super-gsd/registry/gates.yaml:37-184`; `super-gsd/skills/sgsd-audit/SKILL.md:268-371`; `super-gsd/scripts/sgsd-complete-milestone.cjs:1045-1052`).

**Backbone recommendation:** create one typed **Execution Authority** as the only delivery entry point. It should atomically resolve role → profile → model/effort → packet → detached worktree/sandbox → hooks/plan lock → output schema → independent reviewer → gate evidence. The orchestrator should pass a command envelope and receive a report envelope; it should not independently re-resolve any of those decisions. Keep the existing gates and executors, but make this authority their enforcement spine. Do not duplicate ATC, verifier, MUDA, release-readiness, or edge-guard logic.

## Evidence language

- **OBSERVED** — directly present in the checkout or reproduced at a process boundary.
- **CONFIGURED** — declared in config/registry/skill contracts, but not evidence that a live run enforced it.
- **DOCUMENTED** — prose or example behavior, not mechanical proof.
- **INFERRED** — the narrowest conclusion supported by searched call sites; absence claims state the searched scope.
- **RECOMMENDED** — a bounded change for a future phase, with an explicit proof obligation.

The terms are deliberately not interchangeable. In particular, “registry-valid” is not treated as “wrapper-enforced,” and a documented estimate is not treated as observed spend.

## The execution backbone as found

```text
CURRENT (configured and executable paths, not one enforced transaction)

Operator / AUTO MODE
        |
        v
Claude/Opus orchestrator ------------------------------------+
  | reads state, selects next action                         |
  | consults router / provider registry                      |
  +--> context packet builder --falsey--> legacy prompt -----+
  |                                                          |
  +--> double-agent --route-only                              |
  |             |                                            |
  |             +--> generic codex-executor.sh --full-auto --+
  |                        (caller workspace)                 |
  |                                                          |
  +--> spec reviewer --> per-dispatch ATC --> repair branch   |
  +--> phase ATC / verifier / browser / challenger            |
  +--> ledgers (append failures generally non-blocking)       |
  +--> milestone closer (version-specific branches)           |

STRONGER COMPONENT CURRENTLY BESIDE THAT PATH

double-agent live mode -> detached worktree -> Codex -> allowlist
                       -> acceptance command -> patch -> apply -> evidence
```

The control-plane ownership is explicit: Claude orchestrates and Codex owns research, planning, plan checking, readiness, execution, spec review, ATC, verification, and MUDA (`CLAUDE.md:168-208`; `CLAUDE.md:302-344`). The orchestration skill restates the hard lock, pinned model/effort, no Claude delivery fallback, and serial writer constraint (`super-gsd/skills/sgsd-orchestrate/SKILL.md:387-419`). Those contracts are a strong KEEP. The gap is that enforcement is distributed across prose, YAML, wrappers, hooks, and specialized tools rather than one fail-closed dispatch transaction.

## Scoring model

Every execution-matrix score is a five-number vector in this exact order:

1. **A — authority clarity (0–4):** one unambiguous owner, trigger, and write boundary.
2. **I — isolation enforcement (0–4):** sandbox, worktree, allowlist, and concurrency are mechanically enforced.
3. **C — context integrity (0–4):** typed intent/capsule/packet, budget, freshness, and no silent raw fallback.
4. **E — evidence/output contract (0–4):** machine-readable result, durable provenance, failure classification.
5. **R — review independence (0–4):** independently configured and mechanically invoked review/gate.

The printed score is `A/I/C/E/R = total/20`. A `20/20` means a caller cannot bypass the role's authority, isolation, packet, evidence, or independent review through the normal entry point. A `0/20` means none of those properties is established. Intermediate values measure the checked-in mechanism, not operational value; missing live metrics cannot raise or lower the score. Matrix and assurance verdicts use only **KEEP, STRENGTHEN, MERGE, REPLACE, AUTOMATE, REMOVE**.

## Execution matrix

| Role/profile | Trigger | Model/reasoning | Context source | Write authority | Sandbox/worktree | Output contract | Review/gate | Failure/fallback | Evidence | Score | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Researcher / `codex.audit.readonly` | phase research or bounded audit | CONFIGURED Codex GPT-5.5/xhigh | registry/capsule/packet when builder succeeds | none | read-only; no worktree required | research/audit report | planner/plan checker consumes it | packet falsey can become legacy composed prompt | Codex log/packet path is intended; live ledger absent | 3/3/2/2/2 = **12/20** | STRENGTHEN |
| Planner / `codex.plan` | research complete, plan generation | CONFIGURED Codex GPT-5.5/xhigh | phase context + research + packet | registry says `.planning/` allowed | profile says read-only and `.planning/` write root simultaneously; no worktree | PLAN.md conforming to v2 schema | Codex plan checker/final review | ambiguous sandbox/write contract; raw prompt fallback | plan artifact; command evidence intended | 3/1/2/3/3 = **12/20** | REPLACE |
| Plan checker / `codex.review.native` | after plan draft, before activation/final approval | CONFIGURED Codex GPT-5.5/xhigh | plan/diff/phase packet | none | read-only; no worktree | finding JSON/CMB contract | independent from planner by role | native runner passes flags unsupported by selected wrapper; synthetic self-test bypasses live call | intended CMB ledger is absent | 3/2/2/2/2 = **11/20** | STRENGTHEN |
| Readiness / `codex.audit.readonly` | phase/milestone preflight | CONFIGURED Codex GPT-5.5/xhigh | state, roadmap, gates, evidence sources | none | read-only | readiness summary/score | release close gate | unsupported v3.x milestone closer exits 0; missing buckets score zero only when scorer is called | score output; no live row present | 3/3/3/2/1 = **12/20** | AUTOMATE |
| Classifier / context selector | before delivery dispatch and ATC sampling | CONFIGURED Codex by model routing | closed-enum route input, state and change facts | none | nominally read-only | route/classification envelope | router overrides and gate registry | router treats absent Codex health ledger as unhealthy and may fall back to Claude | route ledger intended; absent here | 2/2/2/2/1 = **9/20** | MERGE |
| Goal executor / `codex.goal` | broad goal requiring an isolated implementation | CONFIGURED Codex GPT-5.5/xhigh | locked plan + packet | workspace write within plan allowlist | `requires_worktree: true` CONFIGURED | report/checkpoint/acceptance | native review required CONFIGURED | generic wrapper does not enforce worktree/profile hooks; direct live double-agent can | wrapper/agent-spend intended | 3/1/2/2/2 = **10/20** | MERGE |
| Bounded executor / `codex.bounded` | one plan task, normal code path | hard-pinned GPT-5.5/xhigh in primary wrapper | capsule + packet, else legacy prompt | workspace write | profile requires worktree, but generic wrapper runs caller workspace; double-agent live mode enforces detached worktree | task report, tests, files changed | raw spec review then per-dispatch ATC | no Claude fallback by contract, but router and circuit text contain Claude routes | Codex + gate ledgers intended; absent here | 3/2/2/3/3 = **13/20** | REPLACE |
| Patch executor / `codex.patch` | mechanical repair after review | CONFIGURED Codex GPT-5.5/xhigh | bounded read pack + explicit repair | diff only; allowlisted apply | Codex read-only, host applies checked patch; no worktree requirement | unified diff + apply result | caller reruns acceptance/review | unsafe path, oversized patch, or allowlist violation fails closed | patch wrapper output | 4/3/3/3/2 = **15/20** | KEEP |
| Swarm executor / `codex.swarm` | multiple independent tasks | CONFIGURED Codex GPT-5.5/xhigh | per-task packet intended | workspace write within task plans | profile requires worktree/hooks/native review; config allows up to three agents while profile declares its own maximum | per-worker reports + synthesis | review/gates per dispatch | serial-writer hard lock and parallel config need one arbitration point | intended per-agent spend and reports | 2/1/2/2/2 = **9/20** | REPLACE |
| Spec reviewer | immediately after executor before ATC | Codex-only, high reasoning contract | raw PLAN, diff, executor report, tests | none | read-only wrapper | `pass` / `fix_required` plus findings | repair loop, then ATC | provider/tool failures are supposed to halt; legacy circuit wording offers Claude | review ledger and gate-value row intended | 4/3/3/3/3 = **16/20** | STRENGTHEN |
| ATC reviewer | sampled or mandatory code review after spec compliance | Codex-only, high reasoning contract | raw plan/diff/report/tests | none | read-only | severity findings, verdict, repair target | per-dispatch or phase ATC | critical auto-mode path replans/fixes; ledger append can fail without blocking | review/gate-value ledgers intended | 4/3/3/3/4 = **17/20** | KEEP |
| Verifier / browser / semantic audit | phase completion and frontend evidence points | Codex for verifier; browser tool for runtime proof | plan ACs, real files/data, browser route evidence | verification artifacts only | read-only except reports/evidence | PROVEN/UNPROVEN/BLOCKED; audit PASS/FAIL/remediation | challenger, deferral, phase closure | browser UNPROVEN may continue in AUTO MODE; semantic audit caller not found in searched core path | verifier/audit/deferral evidence intended | 3/3/3/3/3 = **15/20** | STRENGTHEN |
| Synthesis / orchestrator | all phase transitions and repair decisions | Claude/Opus control plane | canonical state/roadmap/checkpoint plus tool results | `.planning/` orchestration docs only; never code | current Warp tab, no executor sandbox | dispatch decision/checkpoint/state transition | edge guard and downstream gates | router internal error or provider null can safe-default to Claude, conflicting with delivery lock | checkpoint/state and route evidence intended | 4/2/3/3/2 = **14/20** | STRENGTHEN |

### Why the two extremes are what they are

The strongest row is ATC at 17/20: it has clear ownership, independent Codex review, a repair branch, and defined evidence. It loses points because the append-only evidence path is not transactionally required and because its configured path topology is partly stale. The weakest rows are classifier and swarm at 9/20: both have useful registry/config descriptions, but neither has one enforcement point that reconciles routing, concurrency, worktree isolation, hard-lock ownership, and evidence. No row earns 20 because no current public delivery entry point binds all five dimensions.

## Role and boundary findings

### F1 — Profiles describe policy but do not constitute an execution boundary

**OBSERVED.** The profile registry carries the fields needed for a strong boundary: sandbox, allowed write roots, `requires_worktree`, locked-plan requirement, hooks, native review, and maximum changed files (`super-gsd/registry/codex-profiles.yaml:2-120`). The resolver validates ten profiles and field types and maps roles to profiles (`super-gsd/tools/codex-pro/profile-resolver.cjs:67-116`). Its self-test explicitly checks only selected properties such as bounded worktree/native-review flags (`super-gsd/tools/codex-pro/profile-resolver.cjs:171-180`).

**OBSERVED.** The generic executor hard-pins the model/effort and invokes `codex` with `--full-auto`, which grants workspace-write, in the caller's working directory (`super-gsd/scripts/codex-executor.sh:115-120`; `super-gsd/scripts/codex-executor.sh:154-155`; `super-gsd/scripts/codex-executor.sh:204-212`). In the searched production surfaces, it does not call the profile resolver, create a worktree, install the declared hooks, or check the profile's changed-file maximum. The more general read-only wrapper accepts configuration overrides despite surrounding pinned-model language (`super-gsd/scripts/codex-exec.sh:169-195`; `super-gsd/scripts/codex-exec.sh:630-635`).

**OBSERVED.** `codex.plan` declares both `sandbox: read-only` and `.planning/` in `allowed_write_roots`, leaving plan authorship mechanically ambiguous (`super-gsd/registry/codex-profiles.yaml:14-24`).

**RECOMMENDED.** Make the profile resolver return a fully validated execution envelope and make the Execution Authority the sole consumer. Reject contradictory profiles at registry load. Convert `codex.plan` to either (a) workspace-write restricted to an isolated `.planning/` overlay, or (b) read-only generation whose host side validates and atomically applies one PLAN artifact. Prove every profile with an end-to-end negative test: forbidden root, missing worktree, missing locked plan, hook rejection, too many changed files, and output-schema failure.

### F2 — The strongest executor is present but not used as the live backbone

**OBSERVED.** The double-agent live path scores task boundedness, vetoes unsafe routes, creates a detached temporary worktree, runs Codex with ephemeral workspace-write, checks changed files against the allowlist, runs acceptance, captures a patch, applies it to the target checkout, cleans up, and emits evidence (`super-gsd/tools/double-agent-executor/run.cjs:230-351`; `super-gsd/tools/double-agent-executor/run.cjs:517-710`).

**OBSERVED.** The orchestration contract calls that tool with `--route-only`, then invokes the generic executor wrapper (`super-gsd/tools/double-agent-executor/run.cjs:822-850`; `super-gsd/skills/sgsd-orchestrate/SKILL.md:1962-2019`). It also reroutes specialist executor commands to the generic path (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2021-2025`).

**RECOMMENDED.** MERGE the live double-agent isolation/apply transaction, patch executor's host-side allowlist, profile resolver, packet builder, hooks, and reviewers behind one Execution Authority. Deprecate `--route-only` as a production handoff. Keep it only as a dry-run diagnostic that emits the exact envelope the live run would execute.

### F3 — Specialist agents and handover schemas are richer than their selection path

**CONFIGURED.** The agent registry declares eight active Codex executor specialists with handover v2 and specialist expertise (`super-gsd/registry/agents.yaml:42-218`). The handover registry defines bounded input, token/time constraints, task/context fields, report fields, and preflight claims (`super-gsd/registry/handover-contract-v2.yaml:22-156`). Several `emits` examples still use legacy `.planning/phases/{N}` paths (`super-gsd/registry/agents.yaml:42-218`; `super-gsd/registry/handover-contract-v2.yaml:90-121`).

**INFERRED.** No production specialist selector consumer was found in the searched orchestrator, executor-wrapper, profile-resolver, context-packet, or dispatch-router surfaces. This is not a repository-wide proof of non-use. The orchestration skill's explicit reroute to the generic executor is affirmative evidence that specialist identity is not the primary live execution boundary.

**RECOMMENDED.** Either connect specialist selection to the typed profile/packet envelope or REMOVE the registry entries from the claimed live architecture. Do not keep role names solely for cockpit presentation. Migrate every path template to `.planning/milestones/{milestone}/phases/{NN-…}` and add a registry lint that rejects legacy active-phase paths.

### F4 — Native review is configured, but its live wrapper contract is mismatched

**OBSERVED.** The native review runner selects `super-gsd/scripts/codex-exec.sh` first and invokes it with `--profile codex.review.native`, optional `--diff-path`, and `--phase` (`super-gsd/tools/codex-pro/native-review-runner.cjs:250-279`). The selected wrapper's argument parser does not define `--profile` or `--diff-path`; therefore the composed live invocation cannot reach review through that wrapper (`super-gsd/scripts/codex-exec.sh:96-112`). The runner self-test constructs findings without exercising `runNativeReview`, so it cannot prove that boundary (`super-gsd/tools/codex-pro/native-review-runner.cjs:337-357`).

**INFERRED.** No production caller of the native runner was found in the searched orchestration and closure surfaces; only tests/docs/architecture references were found. The wording is intentionally bounded.

**RECOMMENDED.** Route native review through the Execution Authority with a schema-valid review envelope, or teach exactly one wrapper the flags and remove wrapper candidate ambiguity. Add an end-to-end test with a fake Codex binary that asserts argv, read-only sandbox, diff payload, nonzero propagation, finding parsing, and CMB emission to a temporary ledger.

### F5 — Delivery ownership conflicts with fallback routing

**CONFIGURED.** Project model routing assigns classifier, reviewer, context selector, executor, plan checker, planner, researcher, and verifier to Codex and orchestration to Opus (`.planning/config.json:140-150`). Codex is enabled with GPT-5.5/xhigh and fallback disabled (`.planning/config.json:190-208`). The provider registry marks the Claude reviewer inactive and Codex reviewer active (`super-gsd/registry/review-providers.yaml:36-58`).

**OBSERVED.** The dispatch router still defines Claude fallbacks for bounded code review, treats Claude/local as healthy, derives Codex health from a metrics ledger, may apply structural route overrides, and walks fallbacks when Codex is unhealthy (`super-gsd/tools/dispatch-router/route.cjs:143-168`; `super-gsd/tools/dispatch-router/route.cjs:295-315`; `super-gsd/tools/dispatch-router/route.cjs:481-608`). The orchestration contract tells the caller to consult it before every dispatch and safe-defaults to Claude on null/error (`super-gsd/skills/sgsd-orchestrate/SKILL.md:855-944`). Separately, the Codex wrapper's circuit-open message tells the caller to route a Claude reviewer (`super-gsd/scripts/codex-exec.sh:603-608`). These paths contradict the hard lock.

**RECOMMENDED.** Split *availability* from *authority*. A delivery route with Codex unavailable must produce `DELIVERY_PROVIDER_UNAVAILABLE` and checkpoint; it must never change owner. Claude fallback remains legal only for synthesis/orchestration roles declared as such. Make the hard-lock policy the router's schema input and add truth-table tests for missing ledger, stale ledger, circuit open, router exception, and explicit fallback disabled.

## Context authority and intent

### What is strong

The context registry walks canonical sources, records hashes, restricts writes to legal keys, and writes its result atomically (`super-gsd/tools/context-registry/build.cjs:4-13`; `super-gsd/tools/context-registry/build.cjs:676-718`). Its checker validates references and staleness (`super-gsd/tools/context-registry/check.cjs:235-287`). The packet builder resolves registry/capsule/intent inputs, applies token budgets, persists a typed packet, and returns complaints rather than inventing context (`super-gsd/tools/context-packet/build.cjs:306-326`; `super-gsd/tools/context-packet/build.cjs:677-845`; `super-gsd/tools/context-packet/build.cjs:847-905`). Context authority can hash a composed snapshot and emit a lineage-linked context-anchor CMB (`super-gsd/tools/context-authority/context-anchor-writer.cjs:136-183`; `super-gsd/tools/context-authority/context-anchor-writer.cjs:193-260`).

### Where it weakens

**OBSERVED.** The packet builder accepts only six role names—researcher, planner, executor, verifier, reviewer, cockpit—while the live architecture also names classifier, readiness, ATC, and orchestrator roles (`super-gsd/tools/context-packet/build.cjs:56-58`). Missing intent can synthesize a minimal intent in its supported path (`super-gsd/tools/context-packet/build.cjs:656-672`). Invalid role/intent returns a falsey result (`super-gsd/tools/context-packet/build.cjs:634-654`).

**OBSERVED.** The orchestration skill declares packets the only legal context surface but explicitly falls back to its Step 7 composed prompt on falsey result/exception, and the external hook can continue through the legacy raw-prompt route (`super-gsd/skills/sgsd-orchestrate/SKILL.md:1895-1956`). Therefore packets are **not** the only legal surface in practice.

**CONFIGURED.** `.codex/hooks.json` wires secret blocking, forbidden-write checks, allowed-file checks, event logging, and stop-contract validation (`.codex/hooks.json:1`). Allowed-file enforcement can resolve a PLAN-LOCKED document from environment or state and reject missing/empty/out-of-scope declarations (`super-gsd/tools/codex-hooks/enforce-allowed-files.cjs:97-191`). Stop validation requires report/checkpoint/acceptance fields (`super-gsd/tools/codex-hooks/validate-stop-contract.cjs:40-50`). In the searched generic wrapper, no `SGSD_ACTIVE_PLAN_LOCKED` binding or hook installation call was found. With no live metrics/CMB ledger, this checkout cannot prove hook invocation or context-anchor emission.

**RECOMMENDED.** Extend the packet role vocabulary to every dispatchable role, make packet failure a typed stop rather than a raw-prompt exception, and permit a fallback packet only when it is itself schema-valid and explicitly tagged `context_quality: degraded`. The fallback must contain immutable task, plan lock, allowed files, acceptance commands, authority, source hashes, and a repair reason. Bind packet ID/hash into the command envelope, report envelope, review row, gate row, and context-anchor CMB.

## Assurance matrix

| Gate | Fires when | Enforcement | Evidence path | Repair path | Downstream decision | Observed value signal | Cost signal | Overlap | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| plan-final review | plan draft is complete before activation/final approval | CONFIGURED native Codex read-only review; live wrapper mismatch | intended CMB/review output; CMB ledger absent | revise plan, rerun review | activate or block plan | no live signal; only configured findings contract | no live latency/tokens | overlaps plan checker and spec reviewer, but at different artifact stage | STRENGTHEN |
| spec compliance | every executor result before ATC | orchestrator requires raw PLAN/diff/report/tests and loops on `fix_required` | review ledger + gate-value row intended | executor repair or patch, then rerun acceptance/review | eligible for ATC | configured fix/no-fix branch; no live yield | documented dispatch overhead only, not observed | complements ATC: requirement compliance before quality/adversarial review | KEEP |
| per-dispatch ATC | code task crosses registry thresholds or mandatory condition | hard halt on critical; Codex reviewer; auto repair branch | registry points to legacy commit-review path; review/gate ledgers intended | direct fix/replan according to finding, rerun tests/review | task accepted or repaired/stopped | configured severity and verdict; live rows absent | DOCUMENTED about 300 tokens/dispatch, not observed | overlaps spec review only superficially; preserve independence | KEEP |
| phase ATC | phase completion and amortized/escalated review condition | escalation can halt; Codex reviewer | configured evidence path partly legacy; review/gate ledgers intended | phase repair plan and re-verification | phase eligible for close | no observed run in absent metrics | no observed tokens/latency | aggregates cross-plan issues not visible per dispatch | STRENGTHEN |
| verifier | phase implementation reaches verification | executable tool returns PROVEN=0, UNPROVEN=1, BLOCKED=2 and writes report/deferral | phase verification report and deferral ledger | collect missing proof or repair product | challenge/close/defer | executable verdict vocabulary; no live current row | no observed cost | browser verifier is evidence acquisition, not semantic audit | KEEP |
| semantic acceptance | every v2 plan's semantic ACs during audit | skill contract runs declared commands against real data and rejects fixture-only proof | AUDIT.md, REMEDIATION.md, audit ledger intended | remediation tasks, rerun exact command | phase acceptance | no core-loop invocation found in searched surfaces | no observed cost | deeper than structural verifier; should consume, not duplicate, verifier evidence | AUTOMATE |
| browser gate | frontend globs/routes require runtime evidence | console/network checks; AUTO MODE currently may continue on UNPROVEN | screenshots/HAR/console/API and deferral ledger | restore browser/app, rerun route proof; auto-reopen deferred work | prove, defer, or block depending config | executable evidence types; no current live rows | load timeout configured, no observed latency | specialized verifier adapter | STRENGTHEN |
| MUDA | registry scope/risk thresholds fire after work | soft warn; low-risk and certain work types can skip | WASTE report/ledger path is partly legacy | compress/remove waste or record justified debt | proceed with warning or remediation | no observed waste yield | no observed tokens saved | qualitative waste and structural waste should share one finding schema | MERGE |
| edge guard | state transition's expected gate emissions differ from actual | comparison emits row; halt depends on gate escalation | edge-guard log intended | emit missing gate or repair transition contract | transition or checkpoint | no current rows | negligible configured comparison, not observed | monitors gate firing; does not replace gates | KEEP |
| release readiness | milestone close asks scorer for readiness | scorer produces 0–100/GREEN threshold and hard-zero edge miss, but closer calls it only in version-specific legacy branch | readiness output/ledger sources | repair missing buckets/edge miss, rerun close | release or block | no current score | no observed collection cost | aggregates, does not duplicate source gates | REPLACE |

### Gate mechanics and value attribution

The gate registry already distinguishes trigger, escalation, reviewer, evidence, and repair behavior (`super-gsd/registry/gates.yaml:37-184`). The registry loader validates gate shape, the four-part repair contract, sampling, and `shouldFire` decisions (`super-gsd/scripts/lib/gates-registry.cjs:38-126`). This should remain the source of gate truth.

Per-dispatch ATC is specified as mandatory for qualifying code and phase ATC as amortized with escalation (`super-gsd/registry/gates.yaml:37-74`). MUDA is intentionally soft and thresholded (`super-gsd/registry/gates.yaml:136-184`). In the orchestration contract, spec review precedes per-dispatch ATC and `fix_required` enters a repair loop (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2159`). Critical ATC findings stop interactively or replan/fix in AUTO MODE (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2286-2409`). This is good decision logic.

The evidence writers are observational rather than transactional: review/gate append failures are designed not to throw (`super-gsd/scripts/lib/review-ledger.cjs:1`; `super-gsd/scripts/lib/gate-value-log.cjs:1`). The same in-memory verdict can cause repair, so an absent row does not necessarily mean the gate failed to affect the run. Conversely, a row alone does not prove the repair was completed. The command-envelope registry still marks several important emitters—including Codex execution, readiness, MUDA, ATC, edge, and handoff—as candidate migrations rather than universally current (`super-gsd/registry/command-envelope-v1.yaml:22-77`).

**RECOMMENDED mechanical chain:** every gate result returns a typed `gate_decision_id`; any non-pass creates a typed repair/debt item referencing that ID; the next dispatch must consume that item; successful re-review closes it; phase close requires zero open halt-level items and an explicit policy for warn/debt items. Ledger append may remain operationally resilient, but close must reconcile the in-memory transition journal with durable rows before state mutation.

## Trace 1 — successful bounded dispatch

This is a **CONFIGURED/executable trace reconstructed from source**, not a claim that a live dispatch occurred in this checkout.

| Node | Trigger / owner | Input | Output / write | Evidence | Failure behavior | Consumer |
|---|---|---|---|---|---|---|
| 1. Select next task | phase loop / Claude orchestrator | canonical state, roadmap, PLAN | immutable task ID and expected scope; `.planning/` only | checkpoint/state | missing plan stops | context/route step |
| 2. Route role | orchestrator + dispatch router | closed enums, risk, context pressure, provider health | role/provider hint, no code write | route row intended | today may fall back to Claude; recommended typed unavailable | profile authority |
| 3. Resolve profile | Execution Authority RECOMMENDED; resolver exists | role + task shape | `codex.bounded` envelope with sandbox, `requires_worktree`, limits | envelope ID | invalid/contradictory profile rejects | packet builder |
| 4. Build packet | context packet builder | task, plan, intent, registry, capsule, authority | persisted typed packet; no product write | packet path/hash | today falsey can fall back raw; recommended fail closed/degraded typed packet | executor |
| 5. Isolate | double-agent live executor | target commit, plan allowlist, packet | detached worktree | worktree ID/base SHA in report | setup failure leaves product untouched | Codex process |
| 6. Execute | Codex bounded executor | packet + locked plan | writes only allowed files in worktree | raw report/checkpoint/tool events | nonzero/schema/hook failure blocks apply | host validator |
| 7. Validate/apply | host side | changed files, tests, patch | acceptance result then allowlisted patch applied to target | patch hash/files/tests | out-of-scope or test failure discards worktree | spec reviewer |
| 8. Spec review | independent Codex reviewer | raw PLAN, diff, report, tests | pass finding set, no product write | review row + gate-value ID | `fix_required` enters Trace 2 | per-dispatch ATC |
| 9. per-dispatch ATC | independent Codex reviewer | same evidence plus spec verdict | pass/severity finding set | review/gate rows | critical enters Trace 2/stop | transition |
| 10. Edge/transition | orchestrator + edge guard | expected vs actual gate IDs | task accepted, state/checkpoint update | edge row + transition journal | missing emission checkpoints | next task/phase ATC |

Sources for nodes 1–4: `CLAUDE.md:183-208`, `super-gsd/tools/dispatch-router/route.cjs:481-608`, `super-gsd/tools/codex-pro/profile-resolver.cjs:98-116`, `super-gsd/tools/context-packet/build.cjs:677-845`. Sources for nodes 5–7: `super-gsd/tools/double-agent-executor/run.cjs:584-710` and `super-gsd/scripts/codex-patch-executor.sh:113-147`, `super-gsd/scripts/codex-patch-executor.sh:216-314`. Sources for nodes 8–10: `super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2409` and `super-gsd/scripts/lib/edge-guard.cjs:56-116`.

## Trace 2 — repair loop

This is likewise a **CONFIGURED trace**. It shows how the output should become mechanical repair and how the current evidence gap should be closed.

| Node | Trigger / owner | Input | Output / write | Evidence | Failure behavior | Consumer |
|---|---|---|---|---|---|---|
| 1. Finding | spec reviewer or per-dispatch ATC | PLAN/diff/report/tests | `fix_required` or critical finding with file/line/invariant | review row + `gate_decision_id` RECOMMENDED | malformed finding blocks transition | repair classifier |
| 2. Classify repair | orchestrator/Execution Authority | finding severity, scope, plan lock | direct fix, patch, or replan decision | repair item referencing gate ID | authority cannot expand scope silently | repair executor |
| 3. Replan if needed | Codex planner/checker | finding + original plan/context | amended locked plan under `.planning/` | plan hash + plan-final review | plan review fail stays open | bounded/patch executor |
| 4. Repair execute | Codex bounded or patch profile | only the open repair item and allowlist | worktree patch, no unrelated edits | packet/report/patch hash | test/scope failure discards patch | acceptance |
| 5. Re-accept | host validator | original + repair acceptance commands | exact command results | acceptance row | nonzero returns to node 2 with attempt count | independent reviewer |
| 6. Re-review | reviewer that did not author repair | prior finding + new diff/results | closed, narrowed, or still-open finding | superseding review row | still-open loops within bounded attempts; exhaustion checkpoints | gate reconciliation |
| 7. Close/debt | orchestrator + gate registry | superseding verdict | close repair ID; or explicit warn-level debt with owner/due gate | repair/debt ledger + transition journal | halt-level item can never convert to debt | edge guard/phase close |

The present orchestration skill already provides the core branches for nodes 1–6 (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2409`). The missing backbone is a typed, durable relationship between finding → repair item → repair dispatch → superseding review → closure. The gate vocabulary already contains repair reasons that can be reused rather than reinvented (`super-gsd/registry/command-envelope-v1.yaml:210-218`).

## Direct answers to the six central questions

### 1. Are context packets the only legal surface in practice?

**No.** They are the declared legal surface, but an explicit exception composes the legacy Step 7 prompt when the packet builder is falsey or throws, and an external hook can continue the legacy path (`super-gsd/skills/sgsd-orchestrate/SKILL.md:1895-1956`). The builder's role vocabulary is also narrower than the delivery-role vocabulary (`super-gsd/tools/context-packet/build.cjs:56-58`).

**RECOMMENDED fallback prompt:** do not provide a free-form legacy prompt. Emit a schema-valid `degraded_context_packet` containing task ID, plan path/hash, exact allowed files, exact acceptance commands, role/profile, authority, source hashes available, missing sources, token budget, `degradation_reason`, and `operator_visibility: required`. If any mandatory safety field is missing, checkpoint rather than dispatch.

### 2. Do allowlists, sandbox, and worktree policy align?

**Not on the generic live path.** The YAML profiles say `requires_worktree` and define write roots, while the generic executor uses `--full-auto` in the caller workspace (`super-gsd/registry/codex-profiles.yaml:26-60`; `super-gsd/scripts/codex-executor.sh:154-155`; `super-gsd/scripts/codex-executor.sh:204-212`). The double-agent live path and patch wrapper demonstrate that enforcement is feasible (`super-gsd/tools/double-agent-executor/run.cjs:584-710`; `super-gsd/scripts/codex-patch-executor.sh:275-314`). Merge those mechanisms into the only live entry point.

### 3. Is reviewer independence configured and enforced?

**Configured, partially enforced, not proven end to end.** The role split and provider registry assign review to Codex independently of Claude orchestration, spec review precedes ATC, and raw artifacts are required (`.planning/config.json:140-150`; `super-gsd/registry/review-providers.yaml:36-58`; `super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2159`). However, native review's live argv is incompatible with its selected wrapper, and no live metrics/CMB row exists here (`super-gsd/tools/codex-pro/native-review-runner.cjs:250-285`; `super-gsd/scripts/codex-exec.sh:96-112`). Enforce independence by recording executor identity/model/session/packet hash and rejecting the same execution session as reviewer.

### 4. Does fallback weaken the hard lock?

**Yes.** The hard lock says no Claude delivery fallback (`super-gsd/skills/sgsd-orchestrate/SKILL.md:387-419`), while router tables, missing-health behavior, router error behavior, and circuit-open text can select or recommend Claude (`super-gsd/tools/dispatch-router/route.cjs:143-168`; `super-gsd/tools/dispatch-router/route.cjs:295-315`; `super-gsd/tools/dispatch-router/route.cjs:530-608`; `super-gsd/scripts/codex-exec.sh:603-608`). Availability failure must stop/checkpoint, not change delivery authority.

### 5. Do gate outputs mechanically create repairs/debt/closure?

**They mechanically influence the in-memory branch, but do not yet form one durable lifecycle.** The orchestration skill loops on spec/ATC findings; evidence writers are non-throwing and the command-envelope migration remains partial (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2409`; `super-gsd/registry/command-envelope-v1.yaml:22-77`). Add stable IDs and referential integrity across decision, repair, superseding review, debt, and transition. Close should reconcile them.

### 6. Can token/latency attribution be trusted without live metrics?

**No.** This checkout has no `.planning/metrics/`; any exact usage, yield, or latency number would be invented. The orchestration document's roughly 300-token ATC estimate is DOCUMENTED, not observed (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2407-2409`). The wrappers/tools contain token estimates and intended ledgers, but this audit can only recommend dimensions: by role/profile/provider/phase/plan/dispatch/attempt/gate decision, with wall time, queue time, model tokens, prompt packet size, changed lines, finding yield, repair outcome, and supersession. Instrument at the Execution Authority so retries and fallback attempts share one trace ID.

## Release-readiness gap

The release-readiness scorer is useful: it computes bucket scores, maps to a color threshold, and hard-zeros an edge-guard miss (`super-gsd/tools/release-readiness/score.cjs:1`). The problem is invocation. The close command contains a future-proof branch that prints that only v1.9/v2.0 are wired and exits success for any other milestone reaching it (`super-gsd/scripts/sgsd-complete-milestone.cjs:1045-1052`). Release-readiness is invoked only inside the legacy v2.0 sept-gate branch (`super-gsd/scripts/sgsd-complete-milestone.cjs:1531-1631`). Earlier version-specific branches do not make this milestone-agnostic. For v3.x, the effective close behavior is a no-op success.

**RECOMMENDED migration:**

1. Move milestone-close policy to a registry keyed by capability/schema generation, not literal milestone names.
2. Resolve the active milestone from canonical state, require a supported closure policy, and fail closed on unknown policy.
3. Reuse the existing release-readiness scorer and existing source gates; do not duplicate them in the closer.
4. Convert legacy v1.9/v2.x branches into versioned adapters behind the policy resolver, then add a v3.x policy.
5. Emit one closure envelope listing scorer input hashes, source gate IDs, open repair/debt IDs, score, color, and decision.

**Proof obligations:** v1.9 and every supported v2.x fixture preserve expected behavior; v3.2/v3.3 exercise the generic policy; unknown milestone blocks; missing scorer blocks; edge miss hard-zero blocks; missing evidence bucket cannot silently pass; GREEN permits close; dry-run never mutates state; live close mutates only after durable closure evidence.

## Baseline chronicle failure — root cause and bounded repair

### OBSERVED primary cause

The Phase 116 self-test builds `wrapperPath` with Node `path.resolve`, producing a Windows absolute path, then invokes the ambiguous command name `bash` with that path and Windows absolute fixture arguments (`super-gsd/tools/chronicle/run-self-test.cjs:359-361`; `super-gsd/tools/chronicle/run-self-test.cjs:427-439`). On this host, `Get-Command bash -All` resolves `C:\WINDOWS\system32\bash.exe` before Git Bash. That executable is the WSL shim, so the Windows path/argv are not valid Linux paths. The raw wrapper path loses Windows backslashes at the WSL boundary and returns 127 or can wait on WSL startup; the wrapper itself never reaches its validator/logging code.

A bounded boundary probe with the explicit Git-for-Windows `bash.exe` and slash-normalized wrapper/fixture paths reached the wrapper and preserved the expected good/bad validator exit behavior. This isolates interpreter/path-scheme selection from validator semantics; it does not make ambient WSL a supported substitute.

That single boundary failure explains all three baseline failures:

- `SAC-P116-10` expects the good fixture wrapper exit/verdict.
- `SAC-P116-11` expects the bad fixture's deliberate validator exit/verdict.
- `STRUCT-P116-22` calls the same wrapper, then expects the appended log row.

The test definitions and shared call path are explicit (`super-gsd/tools/chronicle/run-self-test.cjs:464-509`; `super-gsd/tools/chronicle/run-self-test.cjs:515-536`). Because the wrapper never starts, neither semantic expectation nor logging can be satisfied.

### OBSERVED contributors, not the primary cause

The wrapper has CRLF line endings in this checkout (106 CRLF pairs observed). When invoked explicitly under WSL after only path conversion, CRLF becomes a second compatibility blocker for shell tokens such as `set -euo pipefail` and control-flow terminators. The wrapper also has a fixed canonical log path and no test-only override (`super-gsd/scripts/chronicle-validate.sh:57-60`; `super-gsd/scripts/chronicle-validate.sh:89-100`), which makes a successful self-test mutate project metrics. Its `timeout 20s` protects the validator *after the wrapper starts* (`super-gsd/scripts/chronicle-validate.sh:70-83`); the Node `spawnSync('bash', ...)` itself has no timeout, so an unhealthy WSL launch can hang the test before that protection exists.

### OBSERVED existing precedent

This is already solved elsewhere in SGSD. Boot explicitly filters out System32/WindowsApps bash, searches Git-for-Windows candidates, and fails with an actionable Git Bash message (`super-gsd/scripts/sgsd-boot.ps1:77-103`). The README tells Windows PowerShell users to avoid the WSL shim and invoke Git Bash explicitly (`super-gsd/README.md:43-48`). The self-test bypasses that established host policy.

### Rejected hypotheses

- **Validator defect:** rejected as the primary cause because direct Node fixture tests around the wrapper tests pass; the failures are exactly the two wrapper cases and their log assertion (`super-gsd/tools/chronicle/run-self-test.cjs:515-539`).
- **Bad benchmark fixtures:** rejected because the fixture-load structural assertion passes independently and direct validator cases use the same fixtures (`super-gsd/tools/chronicle/run-self-test.cjs:374-424`; `super-gsd/tools/chronicle/run-self-test.cjs:529-536`).
- **Permissions or missing wrapper:** rejected because the path is resolved and exists; failure occurs at interpreter/path-scheme selection.
- **`.wslconfig` warning:** non-causal. It may affect WSL startup diagnostics, but it cannot make a raw `C:\...` argv path a valid Linux path.
- **Missing metrics directory:** rejected as primary; the wrapper creates the directory at line 89, but never reaches it under the failing interpreter boundary.

### RECOMMENDED repair

Create a small host-aware bash resolver shared by Node entry points:

1. On Windows, select Git Bash by explicit candidate/filter logic matching `sgsd-boot.ps1`; never accept System32/WindowsApps for a Windows-path argv contract.
2. On POSIX, select native `bash` and pass native paths.
3. If neither exists, fail quickly with an actionable installation/path message and a bounded spawn timeout.
4. Treat WSL as a separate explicit adapter, not an ambient fallback. That adapter must convert the wrapper and **every path argument** with `wslpath`, preserve argv boundaries/spaces, use an installed distro deliberately, and require LF shell files.
5. Add `SGSD_CHRONICLE_LOG_PATH` (or an explicit `--log-file`) as a test-only/diagnostic override validated to a supplied temporary directory, so tests do not write canonical metrics.
6. Normalize shell scripts intended for WSL/POSIX to LF via `.gitattributes`; if WSL is not supported for this wrapper, reject it clearly instead.

### Proof matrix

| Environment/case | Required proof |
|---|---|
| Windows PATH: System32 first | resolver still selects Git Bash; all three SAC/STRUCT cases pass |
| Windows PATH: Git Bash first | good fixture exit 0/verdict, bad fixture expected nonzero/verdict |
| Windows path containing spaces | wrapper and every fixture argv arrive byte-for-byte |
| Git Bash absent | fast actionable failure; no WSL ambiguity/hang |
| POSIX native bash | good/bad exits and temporary log row pass |
| Explicit WSL adapter | converted wrapper + all path args pass with LF file; raw Windows args are rejected |
| CRLF regression | policy test either normalizes to LF or produces a targeted unsupported-line-ending error |
| Logging | exactly one schema-valid row goes to temporary log; canonical `.planning/metrics` remains untouched |
| Timeout | stalled interpreter and stalled validator both terminate with distinct classified failures |
| Regression | `SAC-P116-10`, `SAC-P116-11`, and `STRUCT-P116-22` all pass |

This is one causal repair, not three test-specific patches.

## Recommended milestone backbone

### P0 — One typed Execution Authority

**RCA:** authority decisions are duplicated across orchestration prose, dispatch router, provider registry, profile YAML, wrappers, double-agent, packet builder, hooks, and reviewers. Their contradictions are currently resolved by call order rather than a typed invariant.

**RECOMMENDED implementation boundary:** one local tool/library with two public operations: `resolve --dry-run` and `execute`. Input is command-envelope v1 plus task/plan IDs. Output is report-envelope v2 plus immutable trace ID. It alone may launch delivery Codex. Internally it reuses:

- profile resolver for role policy;
- context registry/packet/authority for context;
- double-agent worktree transaction for isolation;
- Codex executor or patch executor for the model process;
- existing hooks and PLAN-LOCKED validator;
- provider registry for availability without authority fallback;
- spec/native reviewer and existing gate registry;
- existing review, gate-value, edge, token, and route writers.

**Proof:** no production call site invokes `codex` or delivery wrappers outside the authority; policy conformance tests cover every profile; a trace can be joined from route through repair/closure; injected failure before apply leaves target unchanged; injected failure after apply but before evidence forces reconciliation/checkpoint; worktree cleanup is proven.

### P0 — Milestone-agnostic closure policy

**RCA:** literal milestone branches have made release-readiness an old-version feature and unknown/current versions can return success without assurance.

**RECOMMENDED:** registry-resolved closure capabilities with fail-closed unknown policy, reusing release-readiness and source gates. Include the v3.x migration/proof matrix above.

### P0 — Remove delivery authority fallback

**RCA:** hard-lock policy and availability routing are represented independently, so missing health evidence changes the owner.

**RECOMMENDED:** authority is immutable; availability yields retry/backoff/checkpoint only. Separate Claude synthesis routes from Codex delivery routes in the router schema.

### P1 — Context packet fail-closed and role-complete

**RCA:** the “only legal surface” has an explicit untyped exception and incomplete role vocabulary.

**RECOMMENDED:** role-complete schema, typed degraded packets, packet/hash propagation, authority CMB join, and no free-form fallback.

### P1 — Repair/debt referential integrity

**RCA:** gate decisions affect control flow but evidence and repair closure are not one durable state machine.

**RECOMMENDED:** stable IDs and closure reconciliation without changing the gates themselves.

### P1 — Native review integration

**RCA:** selected wrapper/argv mismatch and synthetic self-test do not prove the live review boundary.

**RECOMMENDED:** one supported review entry point, fake-provider end-to-end tests, session independence checks, and temporary CMB evidence.

### P1 — Registry/topology lint

**RCA:** active registries and evidence templates still encode `.planning/phases/{N}` while canonical state uses per-milestone phase roots; command-envelope emitter status also lags claimed behavior.

**RECOMMENDED:** validate active paths against current topology, declare each emitter `current` only after executable contract tests, and fail preflight on drift.

### P2 — Chronicle host-shell adapter

**RCA:** ambiguous interpreter selection violates the established Windows host policy.

**RECOMMENDED:** implement the bounded resolver/log override/LF proof described above. It can be P0 if the generated milestone requires a green baseline before any other phase.

### P2 — Value instrumentation at the authority boundary

**RCA:** cost/value claims cannot be reconstructed reliably from absent or independently appended ledgers.

**RECOMMENDED:** one trace ID and joinable timestamps/tokens/outcomes across dispatch attempts and gates. Value measures should include defects found before merge, unique findings, repair closure, reopened debt, escaped defects, and work discarded—not just number of gate rows.

## What to keep unchanged

- Keep Claude/Opus as orchestration-only and Codex as delivery-only (`CLAUDE.md:168-176`).
- Keep per-dispatch ATC and phase ATC distinct; do not collapse task-local and cross-plan review.
- Keep the patch executor's host-side allowlist/apply pattern (`super-gsd/scripts/codex-patch-executor.sh:275-314`).
- Keep detached-worktree execution from double-agent live mode (`super-gsd/tools/double-agent-executor/run.cjs:584-710`).
- Keep semantic acceptance against real data and the fixture guard (`super-gsd/skills/sgsd-audit/SKILL.md:268-315`).
- Keep browser proof as a specialized verifier adapter (`super-gsd/tools/phase-verifier/phase-verifier.mjs:426-506`).
- Keep gate definitions in `super-gsd/registry/gates.yaml`; strengthen their lifecycle, never reimplement them.
- Keep edge-guard as an omission detector, not another acceptance gate (`super-gsd/scripts/lib/edge-guard.cjs:56-116`).

## Evidence census

The conclusions above cite and reconcile at least these distinct existing source/config paths:

1. `CLAUDE.md`
2. `.planning/config.json`
3. `.codex/hooks.json`
4. `super-gsd/skills/sgsd-orchestrate/SKILL.md`
5. `super-gsd/skills/sgsd-audit/SKILL.md`
6. `super-gsd/registry/codex-profiles.yaml`
7. `super-gsd/registry/agents.yaml`
8. `super-gsd/registry/gates.yaml`
9. `super-gsd/registry/review-providers.yaml`
10. `super-gsd/registry/handover-contract-v2.yaml`
11. `super-gsd/registry/command-envelope-v1.yaml`
12. `super-gsd/templates/plan-schema-v2.json`
13. `super-gsd/tools/codex-pro/profile-resolver.cjs`
14. `super-gsd/tools/codex-pro/native-review-runner.cjs`
15. `super-gsd/scripts/codex-executor.sh`
16. `super-gsd/scripts/codex-exec.sh`
17. `super-gsd/scripts/codex-patch-executor.sh`
18. `super-gsd/tools/double-agent-executor/run.cjs`
19. `super-gsd/tools/context-registry/build.cjs`
20. `super-gsd/tools/context-registry/check.cjs`
21. `super-gsd/tools/context-packet/build.cjs`
22. `super-gsd/tools/context-authority/context-composer.cjs`
23. `super-gsd/tools/context-authority/context-anchor-writer.cjs`
24. `super-gsd/tools/dispatch-router/route.cjs`
25. `super-gsd/scripts/lib/gates-registry.cjs`
26. `super-gsd/scripts/lib/gate-value-log.cjs`
27. `super-gsd/scripts/lib/review-ledger.cjs`
28. `super-gsd/scripts/lib/edge-guard.cjs`
29. `super-gsd/tools/phase-verifier/phase-verifier.mjs`
30. `super-gsd/tools/release-readiness/score.cjs`
31. `super-gsd/scripts/sgsd-complete-milestone.cjs`
32. `super-gsd/tools/codex-hooks/enforce-allowed-files.cjs`
33. `super-gsd/tools/codex-hooks/validate-stop-contract.cjs`
34. `super-gsd/tools/plan-lock/validate-plan-locked.cjs`
35. `super-gsd/tools/chronicle/run-self-test.cjs`
36. `super-gsd/scripts/chronicle-validate.sh`
37. `super-gsd/scripts/sgsd-boot.ps1`
38. `super-gsd/README.md`

## Acceptance bar for the generated milestone

The milestone should not be declared complete merely because registries validate or self-tests stub expected objects. It should demonstrate all of the following through real process boundaries in temporary worktrees/ledgers:

1. Every delivery role resolves to exactly one profile and immutable authority.
2. Every `requires_worktree` profile actually runs in a detached worktree.
3. Every write is constrained by PLAN-LOCKED + profile roots + task allowlist.
4. Every dispatch receives a typed packet; degraded context remains typed and visible.
5. No Codex outage, router error, or missing metric can transfer delivery to Claude.
6. Executor and reviewer sessions are independently identifiable.
7. Spec review, per-dispatch ATC, phase ATC, verifier, semantic audit, browser gate, MUDA, edge guard, and release readiness each fire from the existing registry/policy at their intended edge.
8. A repair loop is joinable from finding to closed repair or explicit permissible debt.
9. v3.x release close fails closed unless generic release readiness is GREEN and no halt debt remains.
10. Token/latency/value dashboards derive from one trace model and degrade honestly when data is absent.
11. The chronicle wrapper tests pass across the host-shell proof matrix without writing canonical metrics.
12. Dry-run resolution and live execution produce the same policy envelope; only live execution mutates the isolated worktree and subsequently applies a validated patch.

The frontier opportunity is therefore not another layer of orchestration. It is consolidation: make the strongest existing pieces unavoidable, typed, traceable, and mechanically joined from intent to release.
