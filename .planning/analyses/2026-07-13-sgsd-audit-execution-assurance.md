# SGSD frontier audit — execution fabric and assurance

**Date:** 2026-07-13
**Lane:** Codex execution, context authority, review, gates, repair, and release assurance
**Purpose:** milestone-generation input, not a source-change plan
**OBSERVED — Evidence boundary:** repository/config inspection plus a bounded Windows launcher reproduction. The audit checkout has no `.planning/metrics/` directory and no `.planning/mesh/memory/cmbs.jsonl`; therefore this report does **not** claim live dispatch frequency, token spend, latency, gate yield, or repair success rates.

## Executive verdict

**CONFIGURED.** Claude/Opus is the control plane and Codex is the delivery fabric (`CLAUDE.md:168-176`).

**OBSERVED.** The checkout contains ten typed profiles, a context registry and packet builder, a detached-worktree executor, allowlisted patch application, independent review contracts, ATC/MUDA/edge/release gates, repair vocabularies, and append-only evidence writers.

**INFERRED.** The delivery backbone is fragmented because the current orchestration path does not bind those components into one enforced transaction:

1. **OBSERVED:** the generic executor wrapper launches Codex with workspace write access in the caller's checkout, while `requires_worktree`, `allowed_write_roots`, hook requirements, profile concurrency, and locked-plan declarations live in registry metadata (`super-gsd/registry/codex-profiles.yaml:26-120`; `super-gsd/scripts/codex-executor.sh:115-120`; `super-gsd/scripts/codex-executor.sh:204-212`).
2. **OBSERVED:** the double-agent live mode creates a detached worktree, checks allowlist and acceptance, captures a patch, and applies it back; the orchestrator invokes the tool only in `--route-only` mode before the generic wrapper (`super-gsd/tools/double-agent-executor/run.cjs:584-710`; `super-gsd/skills/sgsd-orchestrate/SKILL.md:1962-2019`).
3. **OBSERVED:** packet build failure explicitly falls back to a hand-composed prompt and the external hook path can continue through a legacy raw prompt (`super-gsd/tools/context-packet/build.cjs:4-23`; `super-gsd/skills/sgsd-orchestrate/SKILL.md:1895-1956`).
4. **OBSERVED:** delivery is hard-locked to Codex, while router tables and failure paths can fall back to Claude when Codex health is missing/unhealthy; the required health ledger is absent here (`super-gsd/skills/sgsd-orchestrate/SKILL.md:387-419`; `super-gsd/tools/dispatch-router/route.cjs:143-168`; `super-gsd/tools/dispatch-router/route.cjs:295-315`; `super-gsd/tools/dispatch-router/route.cjs:530-608`).
5. **OBSERVED:** evidence append failures are non-blocking, registry evidence paths include legacy `.planning/phases/{N}` locations, and the close command returns success for unsupported milestone versions (`super-gsd/registry/gates.yaml:37-184`; `super-gsd/scripts/sgsd-complete-milestone.cjs:1045-1052`). **INFERRED:** no core orchestration/closure caller of the semantic-audit skill was found in the searched surfaces (`super-gsd/skills/sgsd-audit/SKILL.md:268-371`).

**RECOMMENDED.** Create one typed **Execution Authority** as the only delivery entry point. It should atomically resolve role → profile → model/effort → packet → detached worktree/sandbox → hooks/plan lock → output schema → independent reviewer → gate evidence. The orchestrator should pass a command envelope and receive a report envelope; it should not independently re-resolve those decisions. Reuse the existing gates and executors as its enforcement spine; do not duplicate ATC, verifier, MUDA, release-readiness, or edge-guard logic. This recommendation is governed by every non-KEEP execution and gate entry in the decision/repair register below.

## Evidence language

- **OBSERVED** — directly present in the checkout or reproduced at a process boundary.
- **CONFIGURED** — declared in config/registry/skill contracts, but not evidence that a live run enforced it.
- **DOCUMENTED** — prose or example behavior, not mechanical proof.
- **INFERRED** — the narrowest conclusion supported by searched call sites; absence claims state the searched scope.
- **RECOMMENDED** — a bounded change for a future phase, with an explicit proof obligation.

**DOCUMENTED — Audit convention.** The terms are not interchangeable: “registry-valid” is not “wrapper-enforced,” and a documented estimate is not observed spend.

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
```

**CONFIGURED.** Claude orchestrates and Codex owns research, planning, plan checking, readiness, execution, spec review, ATC, verification, and MUDA (`CLAUDE.md:168-208`; `CLAUDE.md:302-344`). The orchestration skill restates the hard lock, pinned model/effort, no Claude delivery fallback, and serial-writer constraint (`super-gsd/skills/sgsd-orchestrate/SKILL.md:387-419`).

**OBSERVED.** A separate double-agent live mode implements detached-worktree execution, allowlist and acceptance checks, patch application, and evidence, but the configured orchestration path invokes only its route-only mode (`super-gsd/tools/double-agent-executor/run.cjs:584-710`; `super-gsd/skills/sgsd-orchestrate/SKILL.md:1962-2019`).

**INFERRED.** Enforcement is distributed across prose, YAML, wrappers, hooks, and specialized tools rather than one fail-closed dispatch transaction.

## Scoring model

**DOCUMENTED — Audit scoring rule.** Every execution-matrix score is a five-number vector in this exact order:

1. **A — authority clarity (0–4):** one unambiguous owner, trigger, and write boundary.
2. **I — isolation enforcement (0–4):** sandbox, worktree, allowlist, and concurrency are mechanically enforced.
3. **C — context integrity (0–4):** typed intent/capsule/packet, budget, freshness, and no silent raw fallback.
4. **E — evidence/output contract (0–4):** machine-readable result, durable provenance, failure classification.
5. **R — review independence (0–4):** independently configured and mechanically invoked review/gate.

**DOCUMENTED — Audit scoring rule.** The printed score is `A/I/C/E/R = total/20`. A `20/20` means a caller cannot bypass the role's authority, isolation, packet, evidence, or independent review through the normal entry point. A `0/20` means none is established. Intermediate values measure checked-in mechanisms, not operational value; missing live metrics cannot change the score. Matrix and assurance verdicts use only **KEEP, STRENGTHEN, MERGE, REPLACE, AUTOMATE, REMOVE**.

## Execution matrix

| Role/profile | Trigger | Model/reasoning | Context source | Write authority | Sandbox/worktree | Output contract | Review/gate | Failure/fallback | Evidence | Score | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|
| E01 — Research/readiness / `codex.readonly.audit` | audit, research, read-only, or resolver default | CONFIGURED GPT-5.5/xhigh | registry/capsule/packet when build succeeds | none; `allowed_write_roots: []`, max 0 | CONFIGURED read-only; no worktree/lock/hooks/native review | research, audit, or readiness report | downstream planner/checker or close policy | packet falsey can become legacy prompt; release closer may not invoke readiness | CONFIGURED — exact registry profile and resolver mapping; live ledgers absent | 3/3/2/2/2 = **12/20** | STRENGTHEN |
| E02 — Planner / `codex.plan` | `phase_type: plan` | CONFIGURED GPT-5.5/xhigh | phase context, research, packet | registry permits `.planning/`, max 1 | CONFIGURED read-only, no worktree; write-root declaration conflicts with sandbox | PLAN artifact | plan-final review | ambiguous authorship/apply boundary; raw prompt fallback | CONFIGURED — exact registry profile; wrapper enforcement not established | 3/1/2/3/3 = **12/20** | REPLACE |
| E03 — Goal executor / `codex.goal` | `phase_type: goal` | CONFIGURED GPT-5.5/xhigh | locked plan + packet | workspace write, max 12; registry roots empty | CONFIGURED worktree/locked-plan/hooks/native review required; OBSERVED generic wrapper does not enforce them | report/checkpoint/acceptance | native review required by profile | generic path can run caller workspace; no live profile-envelope binding found | CONFIGURED registry policy versus OBSERVED wrapper gap | 3/1/2/2/2 = **10/20** | MERGE |
| E04 — Bounded executor / `codex.execute.bounded` | low-risk execute with at most six allowed files | CONFIGURED GPT-5.5/xhigh | capsule + packet, else legacy prompt | workspace write, max 6; registry roots empty | CONFIGURED worktree/locked-plan/hooks/native review required; OBSERVED generic wrapper runs caller workspace | task report, tests, changed files | spec review then per-dispatch ATC | route-only double-agent precedes generic wrapper; router/circuit paths conflict with no-fallback lock | CONFIGURED exact profile; OBSERVED route/wrapper path; live ledgers absent | 3/2/2/3/3 = **13/20** | REPLACE |
| E05 — Patch executor / `codex.execute.patch` | execute with patch fallback | CONFIGURED GPT-5.5/xhigh | bounded read pack + explicit repair | Codex emits diff; host applies allowlisted patch, max 20 | CONFIGURED read-only, locked plan, no worktree/hooks/native review | unified diff + apply result | caller reruns acceptance/review | unsafe path, oversize, allowlist, or apply check fails closed | OBSERVED — wrapper bounds read pack and performs allowlist/apply checks | 4/3/3/3/2 = **15/20** | KEEP |
| E06 — Plan checker/native reviewer / `codex.review.native` | native review | CONFIGURED GPT-5.5/xhigh | plan/diff/phase context | none, max 0 | CONFIGURED read-only; no worktree/lock/hooks | finding JSON/CMB contract | independent review role | runner passes flags unsupported by its first wrapper; self-test bypasses live call | CONFIGURED exact profile; OBSERVED argv/wrapper mismatch; CMB ledger absent | 3/2/2/2/2 = **11/20** | STRENGTHEN |
| E07 — Swarm reviewer / `codex.review.swarm` | swarm review, never execution | CONFIGURED GPT-5.5/high | review corpus selected by caller | none, max 0 | CONFIGURED read-only; no worktree/lock/hooks/native review | parallel review findings/synthesis | caller-owned review decision | no searched production invocation proves profile use; must not be treated as a writer | CONFIGURED exact read-only profile and resolver mapping; no live use evidence | 3/3/2/2/3 = **13/20** | STRENGTHEN |
| E08 — Cockpit brief / `codex.cockpit.brief` | cockpit phase type/operator brief | CONFIGURED GPT-5.5/high | cockpit snapshot/status inputs | none, max 0 | CONFIGURED read-only; no worktree/lock/hooks/native review | bounded operator brief | operator/MCP consumer | no searched live profile-resolver consumer proves invocation | CONFIGURED exact profile; cockpit profile use not observed | 3/3/2/2/1 = **11/20** | STRENGTHEN |
| E09 — App lab / `codex.app_lab` | lab task with `environment: app` | CONFIGURED GPT-5.5/xhigh | lab task + locked plan/packet intended | workspace write, max 25; registry roots empty | CONFIGURED worktree/locked-plan/hooks/native review required | lab implementation/report | native review required by profile | no searched production binding enforces the profile transaction | CONFIGURED exact profile only; no live invocation evidence | 3/1/2/2/2 = **10/20** | MERGE |
| E10 — Cloud lab / `codex.cloud_lab` | lab task with `environment: cloud` | CONFIGURED GPT-5.5/xhigh | lab task + locked plan/packet intended | workspace write, max 25; registry roots empty | CONFIGURED worktree/locked-plan/hooks/native review required | cloud-lab implementation/report | native review required by profile | no searched production binding enforces the profile transaction | CONFIGURED exact profile only; no live invocation evidence | 3/1/2/2/2 = **10/20** | MERGE |
| E11 — Classifier/context selector, no dedicated profile | before routing and ATC sampling | CONFIGURED Codex model route | closed-enum route facts | none intended | read-only intent, but no dedicated profile enforcement | route/classification envelope | router overrides + gate registry | absent health ledger can mark Codex unhealthy and walk Claude fallback | OBSERVED router mechanics; route ledger absent | 2/2/2/2/1 = **9/20** | MERGE |
| E12 — Spec reviewer, profile not mechanically bound | after executor, before ATC | CONFIGURED Codex-only/high-reasoning contract | raw PLAN, diff, report, tests | none | OBSERVED read-only wrapper; exact profile not enforced | `pass` / `fix_required` findings | repair branch then ATC | wrapper/provider failure semantics conflict with fallback text | CONFIGURED orchestration contract; review rows absent | 4/3/3/3/3 = **16/20** | STRENGTHEN |
| E13 — ATC reviewer, profile not mechanically bound | sampled/mandatory code review | CONFIGURED Codex-only/high reasoning | raw PLAN/diff/report/tests | none | read-only review contract | severity, verdict, repair target | per-dispatch or phase ATC | critical path repairs/stops; evidence append can fail without blocking | CONFIGURED gate/orchestration path; live review rows absent | 4/3/3/3/4 = **17/20** | KEEP |
| E14 — Verifier/browser/semantic audit | phase verification and frontend/runtime proof | CONFIGURED Codex plus browser tool | plan ACs, real data/files, browser evidence | verification artifacts only | read-only except reports/evidence | PROVEN/UNPROVEN/BLOCKED or audit verdict/remediation | challenger, deferral, phase close | browser UNPROVEN may continue in AUTO MODE; semantic audit caller not found in searched core path | OBSERVED executable verifier/skill contracts; current rows absent | 3/3/3/3/3 = **15/20** | STRENGTHEN |
| E15 — Synthesis/orchestrator, no Codex profile | phase transitions and repair decisions | CONFIGURED Claude/Opus control plane | canonical state/roadmap/checkpoint + tool results | orchestration `.planning/` docs only; never code | current Warp tab; delegates delivery | decision/checkpoint/state transition | edge guard and downstream gates | router null/error can safe-default to Claude, conflicting with delivery lock | CONFIGURED ownership contract; no live route rows | 4/2/3/3/2 = **14/20** | STRENGTHEN |

### Why the two extremes are what they are

**INFERRED.** The strongest row is E13 ATC at 17/20: it has clear ownership, independent Codex review, a repair branch, and defined evidence, but append-only evidence is not transactionally required and configured path topology is partly stale. The weakest row is E11 classifier/context selector at 9/20 because it has no dedicated enforced profile and can change provider on missing health evidence. No row earns 20 because no current public delivery entry point binds all five dimensions. `codex.review.swarm` is scored as the read-only review profile it actually is, never as a workspace-writing executor.

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

**OBSERVED.** The context registry walks canonical sources, records hashes, restricts writes to legal keys, and writes atomically (`super-gsd/tools/context-registry/build.cjs:4-13`; `super-gsd/tools/context-registry/build.cjs:676-718`). Its checker validates references and staleness (`super-gsd/tools/context-registry/check.cjs:235-287`). The packet builder resolves registry/capsule/intent inputs, applies token budgets, persists a typed packet, and returns complaints (`super-gsd/tools/context-packet/build.cjs:306-326`; `super-gsd/tools/context-packet/build.cjs:677-905`). Context authority can hash a composed snapshot and emit a lineage-linked context-anchor CMB (`super-gsd/tools/context-authority/context-anchor-writer.cjs:136-260`).

### Where it weakens

**OBSERVED.** The packet builder accepts only six role names—researcher, planner, executor, verifier, reviewer, cockpit—while the live architecture also names classifier, readiness, ATC, and orchestrator roles (`super-gsd/tools/context-packet/build.cjs:56-58`). Missing intent can synthesize a minimal intent in its supported path (`super-gsd/tools/context-packet/build.cjs:656-672`). Invalid role/intent returns a falsey result (`super-gsd/tools/context-packet/build.cjs:634-654`).

**OBSERVED.** The orchestration skill declares packets the only legal context surface but explicitly falls back to its Step 7 composed prompt on falsey result/exception, and the external hook can continue through the legacy raw-prompt route (`super-gsd/skills/sgsd-orchestrate/SKILL.md:1895-1956`). Therefore packets are **not** the only legal surface in practice.

**CONFIGURED.** `.codex/hooks.json` wires secret blocking, forbidden-write checks, allowed-file checks, event logging, and stop-contract validation (`.codex/hooks.json:1`). Allowed-file enforcement can resolve a PLAN-LOCKED document from environment or state and reject missing/empty/out-of-scope declarations (`super-gsd/tools/codex-hooks/enforce-allowed-files.cjs:97-191`). Stop validation requires report/checkpoint/acceptance fields (`super-gsd/tools/codex-hooks/validate-stop-contract.cjs:40-50`). In the searched generic wrapper, no `SGSD_ACTIVE_PLAN_LOCKED` binding or hook installation call was found. With no live metrics/CMB ledger, this checkout cannot prove hook invocation or context-anchor emission.

**RECOMMENDED.** Extend the packet role vocabulary to every dispatchable role, make packet failure a typed stop rather than a raw-prompt exception, and permit a fallback packet only when it is itself schema-valid and explicitly tagged `context_quality: degraded`. The fallback must contain immutable task, plan lock, allowed files, acceptance commands, authority, source hashes, and a repair reason. Bind packet ID/hash into the command envelope, report envelope, review row, gate row, and context-anchor CMB.

## Assurance matrix

| Gate | Fires when | Enforcement | Evidence path | Repair path | Downstream decision | Observed value signal | Cost signal | Overlap | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| G01 — plan-final review | plan draft completes before activation/final approval | CONFIGURED native Codex read-only review; OBSERVED wrapper mismatch | CONFIGURED CMB/review output; CMB ledger absent | revise plan, rerun review | activate or block | no live signal; configured findings contract only | no live latency/tokens | distinct artifact stage from spec review | STRENGTHEN |
| G02 — spec compliance | every executor result before ATC | CONFIGURED raw PLAN/diff/report/tests and `fix_required` branch | CONFIGURED review/gate-value append; live rows absent | executor repair/patch then review | eligible for ATC | configured branch, no live yield | documented overhead only | requirement compliance before quality review | KEEP |
| G03 — per-dispatch ATC | code task crosses registry thresholds/mandatory condition | CONFIGURED critical halt/Codex reviewer/AUTO repair | CONFIGURED legacy commit-review path + ledgers; live rows absent | direct fix/replan then tests/review | accept, repair, or stop | configured severity/verdict only | DOCUMENTED about 300 tokens/dispatch | preserves independence from spec review | KEEP |
| G04 — phase ATC | phase completion and amortized/escalated condition | CONFIGURED escalation and Codex reviewer | CONFIGURED partly legacy evidence path; live rows absent | phase repair plan + re-verification | eligible for close | no observed run | no observed tokens/latency | cross-plan aggregation | STRENGTHEN |
| G05 — verifier | phase reaches verification | OBSERVED executable PROVEN=0, UNPROVEN=1, BLOCKED=2 contract | CONFIGURED report/deferral path; current row absent | collect proof or repair | challenge/close/defer | executable vocabulary, no live value row | no observed cost | browser adapter acquires evidence | KEEP |
| G06 — semantic acceptance | v2 plan audit executes semantic ACs | OBSERVED skill contract runs commands on real data and rejects fixtures | CONFIGURED AUDIT/REMEDIATION/audit ledger; current row absent | remediation + exact rerun | phase acceptance | INFERRED no core-loop caller found in searched surfaces | no observed cost | consumes verifier evidence; must not duplicate it | AUTOMATE |
| G07 — browser gate | frontend routes/globs require runtime evidence | CONFIGURED console/network checks; AUTO may continue on UNPROVEN | CONFIGURED screenshot/HAR/console/API/deferral paths | restore app/browser and rerun | prove/defer/block by config | executable evidence types, no current rows | timeout configured, latency absent | specialized verifier adapter | STRENGTHEN |
| G08 — MUDA | scope/risk thresholds fire after work | CONFIGURED soft warn and skip conditions | CONFIGURED WASTE path partly legacy; current rows absent | compress/remove waste or explicit debt | warn/remediate | no observed waste yield | no observed savings | structural and qualitative forms need shared finding contract | MERGE |
| G09 — edge guard | expected gate emissions differ from actual transition | OBSERVED comparison/append contract; halt follows escalation | CONFIGURED edge log; current rows absent | emit missing gate or repair transition | transition/checkpoint | no current rows | negligible configured comparison | omission detector, not acceptance duplicate | KEEP |
| G10 — release readiness | milestone close invokes scorer | OBSERVED scorer contract; OBSERVED closer invokes only version-specific branch | CONFIGURED readiness sources; no current score | repair buckets/edge miss then rerun | release/block | no current score | no observed collection cost | aggregation, not source-gate duplication | REPLACE |

### Gate mechanics and value attribution

**OBSERVED.** The gate registry distinguishes trigger, escalation, reviewer, evidence, and repair behavior (`super-gsd/registry/gates.yaml:37-184`). The registry loader validates gate shape, the four-part repair contract, sampling, and `shouldFire` decisions (`super-gsd/scripts/lib/gates-registry.cjs:38-126`).

**RECOMMENDED.** Keep that registry as gate truth and reuse it; do not reproduce gate predicates in the proposed Execution Authority.

**CONFIGURED.** Per-dispatch ATC is mandatory for qualifying code, phase ATC is amortized with escalation, and MUDA is soft/thresholded (`super-gsd/registry/gates.yaml:37-74`; `super-gsd/registry/gates.yaml:136-184`). Spec review precedes per-dispatch ATC; `fix_required` and critical findings enter the documented repair/stop branches (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2409`).

**OBSERVED.** Review/gate append failures are designed not to throw, and the same in-memory verdict can still select a repair branch (`super-gsd/scripts/lib/review-ledger.cjs:1`; `super-gsd/scripts/lib/gate-value-log.cjs:1`). The command-envelope registry marks Codex execution, readiness, MUDA, ATC, edge, and handoff emitters as candidate migrations rather than universally current (`super-gsd/registry/command-envelope-v1.yaml:22-77`).

**INFERRED.** An absent row does not prove that a gate failed to affect in-memory control flow, while a row alone does not prove its repair completed.

**RECOMMENDED.** Implement register entries G01, G04, G06, G07, G08, and G10 through a shared decision-to-repair relation: every existing gate result returns a typed decision ID; any non-pass creates a linked repair/debt item; re-review supersedes it; close reconciles halt-level items and explicit warn/debt policy. This strengthens evidence lifecycle without duplicating any gate.

## Trace 1A — CONFIGURED CURRENT successful bounded dispatch

**CONFIGURED.** This source-faithful trace describes the current orchestration contract; it does not claim that a live dispatch occurred in this checkout.

| Node | Trigger / owner | Input | Output / write | Evidence | Failure behavior | Consumer |
|---|---|---|---|---|---|---|
| 1. Select task | Claude phase loop | STATE/roadmap/PLAN | selected task and scope | checkpoint/state contract | missing plan blocks | routing (`CLAUDE.md:183-208`) |
| 2. Consult router | Claude + dispatch router | closed enums, risk, context pressure, provider health | provider hint | route ledger intended | null/error or unhealthy Codex can select Claude | packet/dispatch (`super-gsd/skills/sgsd-orchestrate/SKILL.md:855-944`) |
| 3. Build context | packet builder called from orchestrator | task, intent, registry, capsule | packet when successful | packet path/hash intended | falsey/exception uses Step 7 legacy composed prompt | route-only decision (`super-gsd/skills/sgsd-orchestrate/SKILL.md:1895-1956`) |
| 4. Route only | double-agent executor | capsule and routing facts | route decision only; no worktree execution | route row optional/nonblocking | non-Codex code route is ignored/rerouted | generic wrapper (`super-gsd/tools/double-agent-executor/run.cjs:822-850`; `super-gsd/skills/sgsd-orchestrate/SKILL.md:1962-2019`) |
| 5. Execute generic | `codex-executor.sh` | prompt/capsule and caller checkout | workspace writes in caller directory | wrapper/live output intended | profile resolver, `requires_worktree`, hooks, max files, and native review are not bound here | spec reviewer (`super-gsd/scripts/codex-executor.sh:115-120`; `super-gsd/scripts/codex-executor.sh:154-155`; `super-gsd/scripts/codex-executor.sh:204-212`) |
| 6. Spec review | Codex read-only review path | raw PLAN, diff, executor report, verification | pass or `fix_required` | review/gate-value append intended | `fix_required` enters current repair branch | per-dispatch ATC (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2159`) |
| 7. per-dispatch ATC | Codex reviewer | raw artifacts plus spec result | severity/verdict | legacy-path review row and gate-value row; append can fail without halting | critical stops interactively or triggers current AUTO repair branch | task transition (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2161-2409`) |
| 8. Transition | Claude + existing edge guard | expected versus emitted gates | task accepted/state advances | edge/review/gate rows when writes succeed | evidence may be incomplete even when in-memory branch advanced | next task/phase ATC (`super-gsd/scripts/lib/edge-guard.cjs:56-116`) |

## Trace 1B — RECOMMENDED TARGET successful bounded dispatch

**RECOMMENDED.** The target trace is deliberately separate from current behavior and maps to the non-KEEP entries E01–E04, E06–E12, E14–E15, G01, G04, G06–G08, and G10 in the decision/repair register.

| Node | Trigger / owner | Input | Output / write | Evidence | Failure behavior | Consumer |
|---|---|---|---|---|---|---|
| 1. Resolve transaction | typed Execution Authority | command envelope + task/plan IDs | exact profile/policy envelope | trace ID and policy hash | invalid/contradictory policy fails closed | packet builder |
| 2. Build typed packet | context authority | role-complete intent, registry, capsule, plan lock | packet or explicit typed degradation | packet/source hashes | missing mandatory safety field checkpoints | isolated executor |
| 3. Isolate/execute | reused double-agent live transaction | packet, target SHA, allowlist | detached-worktree changes | worktree/base SHA/report | scope/test/process failure discards worktree | host validator |
| 4. Validate/apply | host-side allowlist/apply boundary | patch, changed files, acceptance commands | checked patch applied to target | patch hash/files/results | any mismatch leaves target unchanged | independent review |
| 5. Review/gate | existing spec review + per-dispatch ATC | raw plan/diff/report/tests | pass findings | durable decision IDs linked to trace | non-pass enters target repair trace | reconciled transition |
| 6. Reconcile | Claude + existing edge guard | expected gates and durable rows | accepted task transition | closure receipt | missing durable evidence checkpoints | next task/phase ATC |

## Trace 2A — CONFIGURED CURRENT repair loop

**CONFIGURED.** The present loop branches on in-memory spec/ATC results and re-dispatches work; its evidence appends are not a required transaction with the control-flow decision.

| Node | Trigger / owner | Input | Output / write | Evidence | Failure behavior | Consumer |
|---|---|---|---|---|---|---|
| 1. Finding | spec reviewer or per-dispatch ATC | PLAN/diff/report/tests | `fix_required` or severity finding | review/gate row attempted | malformed/provider failure follows current stop/fallback rules | Claude repair branch |
| 2. Choose branch | Claude orchestration contract | finding severity and task scope | direct fix, patch fallback, or replan instruction | current checkpoint/report prose | later review evidence is not mechanically related to this finding | Codex planner/executor (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2286-2409`) |
| 3. Replan when required | Codex planner/checker | original context + finding | amended plan | plan artifact/review intended | plan review failure repeats/stops | executor |
| 4. Re-execute | generic executor or patch wrapper | repair prompt/read pack/allowlist | caller-workspace edits or checked patch apply | wrapper output | generic path retains profile/worktree gaps; patch path fails closed | tests/review |
| 5. Re-review | Codex spec/ATC reviewer | new diff/report/tests | pass or further finding | nonblocking legacy review/gate append | further finding loops or critical stops | transition |
| 6. Advance | Claude | latest in-memory verdict | task continues or checkpoint/stop | latest review/gate append is nonblocking | append failure can leave evidence incomplete | next task/phase gate |

**OBSERVED.** Existing orchestration branches support nodes 1–5, while evidence writers are non-throwing and command-envelope repair reasons are only partial migration surfaces (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2409`; `super-gsd/registry/command-envelope-v1.yaml:22-77`; `super-gsd/registry/command-envelope-v1.yaml:210-218`).

## Trace 2B — RECOMMENDED TARGET repair loop

**RECOMMENDED.** The target preserves the existing gates and adds referential integrity; it does not reimplement ATC, verifier, MUDA, edge guard, or release readiness.

| Node | Trigger / owner | Input | Output / write | Evidence | Failure behavior | Consumer |
|---|---|---|---|---|---|---|
| 1. Open repair | existing reviewer/gate adapter | non-pass verdict | typed repair item linked to decision ID | durable open row | malformed relation blocks transition | repair classifier |
| 2. Bound repair | Execution Authority | finding, plan lock, authority | direct fix/patch/replan envelope | shared trace/attempt IDs | scope cannot silently expand | Codex repair role |
| 3. Execute/re-accept | isolated executor + host validator | repair envelope | checked patch and exact test results | packet/report/patch hashes | failure leaves repair open and target unchanged | independent reviewer |
| 4. Supersede | reviewer independent of author | prior decision + new evidence | closed/narrowed/still-open verdict | superseding row | bounded-attempt exhaustion checkpoints | reconciliation |
| 5. Close/debt | Claude + existing gate policy | superseding verdict | closed repair or permissible warn-level debt | closure receipt | halt-level item cannot become debt | edge guard/phase close |

## Direct answers to the six central questions

### 1. Are context packets the only legal surface in practice?

**OBSERVED.** No. An explicit exception composes the legacy Step 7 prompt when the packet builder is falsey/throws, and an external hook can continue the legacy path (`super-gsd/skills/sgsd-orchestrate/SKILL.md:1895-1956`). The builder's role vocabulary is narrower than the delivery-role vocabulary (`super-gsd/tools/context-packet/build.cjs:56-58`).

**RECOMMENDED fallback prompt:** do not provide a free-form legacy prompt. Emit a schema-valid `degraded_context_packet` containing task ID, plan path/hash, exact allowed files, exact acceptance commands, role/profile, authority, source hashes available, missing sources, token budget, `degradation_reason`, and `operator_visibility: required`. If any mandatory safety field is missing, checkpoint rather than dispatch.

### 2. Do allowlists, sandbox, and worktree policy align?

**OBSERVED.** Not on the generic current path. The write profiles require worktrees/locked plans/hooks/native review, while the generic executor uses `--full-auto` in the caller workspace (`super-gsd/registry/codex-profiles.yaml:26-48`; `super-gsd/registry/codex-profiles.yaml:98-120`; `super-gsd/scripts/codex-executor.sh:154-155`; `super-gsd/scripts/codex-executor.sh:204-212`). The double-agent live mode and patch wrapper demonstrate enforceable isolation/apply mechanisms (`super-gsd/tools/double-agent-executor/run.cjs:584-710`; `super-gsd/scripts/codex-patch-executor.sh:275-314`).

**RECOMMENDED.** Merge those existing mechanisms behind the single entry point in register E03/E04/E09/E10; do not claim registry isolation until that path enforces it.

### 3. Is reviewer independence configured and enforced?

**CONFIGURED.** Reviewer roles/providers are separate from Claude orchestration, spec review precedes ATC, and raw artifacts are required (`.planning/config.json:140-150`; `super-gsd/registry/review-providers.yaml:36-58`; `super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2159`).

**OBSERVED.** Native review's argv is incompatible with its selected wrapper, and no live metrics/CMB row exists here (`super-gsd/tools/codex-pro/native-review-runner.cjs:250-285`; `super-gsd/scripts/codex-exec.sh:96-112`). End-to-end reviewer independence is therefore unproven.

**RECOMMENDED.** Record executor/reviewer identity, model, session, and packet hash, and reject the same execution session as reviewer (E06/E12).

### 4. Does fallback weaken the hard lock?

**OBSERVED.** Yes. The hard lock prohibits Claude delivery fallback, while router tables, missing-health/error behavior, and circuit-open text can select or recommend Claude (`super-gsd/skills/sgsd-orchestrate/SKILL.md:387-419`; `super-gsd/tools/dispatch-router/route.cjs:143-168`; `super-gsd/tools/dispatch-router/route.cjs:295-315`; `super-gsd/tools/dispatch-router/route.cjs:530-608`; `super-gsd/scripts/codex-exec.sh:603-608`).

**RECOMMENDED.** Availability failure must stop/checkpoint without changing delivery authority (E11/E15).

### 5. Do gate outputs mechanically create repairs/debt/closure?

**OBSERVED.** Gate results influence the current in-memory repair/stop branch; evidence writers are non-throwing and command-envelope migration is partial (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2112-2409`; `super-gsd/registry/command-envelope-v1.yaml:22-77`).

**INFERRED.** The searched paths do not establish one durable finding → repair → superseding review → closure lifecycle.

**RECOMMENDED.** Add referential integrity and close reconciliation through G01/G04/G06/G07/G08/G10 without duplicating gate predicates.

### 6. Can token/latency attribution be trusted without live metrics?

**OBSERVED.** No. This checkout has no `.planning/metrics/`, so exact usage, yield, and latency cannot be sampled.

**DOCUMENTED.** The orchestration contract estimates roughly 300 tokens per ATC dispatch; that is not observed spend (`super-gsd/skills/sgsd-orchestrate/SKILL.md:2407-2409`).

**RECOMMENDED.** Attribute by role/profile/provider/phase/plan/dispatch/attempt/gate decision with wall/queue time, model tokens, packet size, changed lines, finding yield, repair outcome, and supersession. Use one trace ID at the Execution Authority boundary (E01–E12/G01–G10).

## Release-readiness gap

**OBSERVED.** The release-readiness scorer computes bucket scores, maps a color threshold, and hard-zeros an edge-guard miss (`super-gsd/tools/release-readiness/score.cjs:1`). The close command prints that only v1.9/v2.0 are wired and exits success for any other milestone reaching its generic branch (`super-gsd/scripts/sgsd-complete-milestone.cjs:1045-1052`). It invokes release readiness only inside the legacy v2.0 sept-gate branch (`super-gsd/scripts/sgsd-complete-milestone.cjs:1531-1631`).

**INFERRED.** For v3.x, the searched milestone-close path provides no release-readiness enforcement and returns no-op success.

**RECOMMENDED — migration:**

1. **RECOMMENDED:** move milestone-close policy to a registry keyed by capability/schema generation, not literal milestone names.
2. **RECOMMENDED:** resolve the active milestone from canonical state, require a supported closure policy, and fail closed on unknown policy.
3. **RECOMMENDED:** reuse the existing release-readiness scorer and existing source gates; do not duplicate them in the closer.
4. **RECOMMENDED:** convert legacy v1.9/v2.x branches into versioned adapters behind the policy resolver, then add a v3.x policy.
5. **RECOMMENDED:** emit one closure envelope listing scorer input hashes, source gate IDs, open repair/debt IDs, score, color, and decision.

**RECOMMENDED — acceptance proof:** v1.9 and every supported v2.x fixture preserve expected behavior; v3.2/v3.3 exercise the generic policy; unknown milestone blocks; missing scorer blocks; edge miss hard-zero blocks; missing evidence bucket cannot silently pass; GREEN permits close; dry-run never mutates state; live close mutates only after durable closure evidence.

## Baseline chronicle failure — root cause and bounded repair

### OBSERVED primary cause

**OBSERVED.** The Phase 116 self-test builds `wrapperPath` with Node `path.resolve`, producing a Windows absolute path, then invokes the ambiguous command name `bash` with that path and Windows absolute fixture arguments (`super-gsd/tools/chronicle/run-self-test.cjs:359-361`; `super-gsd/tools/chronicle/run-self-test.cjs:427-439`). On this host, `Get-Command bash -All` resolves `C:\WINDOWS\system32\bash.exe` before Git Bash. That executable is the WSL shim, so the Windows path/argv are not valid Linux paths. The raw wrapper path loses Windows backslashes at the WSL boundary and returns 127 or can wait on WSL startup; the wrapper itself never reaches its validator/logging code.

**OBSERVED.** A bounded boundary probe with the explicit Git-for-Windows `bash.exe` and slash-normalized wrapper/fixture paths reached the wrapper and preserved the expected good/bad validator exit behavior. This isolates interpreter/path-scheme selection from validator semantics; it does not make ambient WSL a supported substitute.

**INFERRED.** That single boundary failure explains all three baseline failures:

- **OBSERVED:** `SAC-P116-10` expects the good fixture wrapper exit/verdict.
- **OBSERVED:** `SAC-P116-11` expects the bad fixture's deliberate validator exit/verdict.
- **OBSERVED:** `STRUCT-P116-22` calls the same wrapper, then expects the appended log row.

**OBSERVED.** The test definitions and shared call path are explicit (`super-gsd/tools/chronicle/run-self-test.cjs:464-509`; `super-gsd/tools/chronicle/run-self-test.cjs:515-536`). **INFERRED.** Because the wrapper never starts, neither semantic expectation nor logging can be satisfied.

### OBSERVED contributors, not the primary cause

**OBSERVED.** The wrapper has CRLF line endings in this checkout (106 CRLF pairs observed). When invoked explicitly under WSL after only path conversion, CRLF becomes a second compatibility blocker for shell tokens such as `set -euo pipefail` and control-flow terminators. The wrapper also has a fixed canonical log path and no test-only override (`super-gsd/scripts/chronicle-validate.sh:57-60`; `super-gsd/scripts/chronicle-validate.sh:89-100`), which makes a successful self-test mutate project metrics. Its `timeout 20s` protects the validator *after the wrapper starts* (`super-gsd/scripts/chronicle-validate.sh:70-83`); the Node `spawnSync('bash', ...)` itself has no timeout, so an unhealthy WSL launch can hang the test before that protection exists.

### OBSERVED existing precedent

**OBSERVED.** This is already solved elsewhere in SGSD. Boot explicitly filters out System32/WindowsApps bash, searches Git-for-Windows candidates, and fails with an actionable Git Bash message (`super-gsd/scripts/sgsd-boot.ps1:77-103`). The README tells Windows PowerShell users to avoid the WSL shim and invoke Git Bash explicitly (`super-gsd/README.md:43-48`). The self-test bypasses that established host policy.

### Rejected hypotheses

- **OBSERVED — validator defect:** rejected as the primary cause because direct Node fixture tests around the wrapper tests pass; the failures are exactly the two wrapper cases and their log assertion (`super-gsd/tools/chronicle/run-self-test.cjs:515-539`).
- **OBSERVED — bad benchmark fixtures:** rejected because the fixture-load structural assertion passes independently and direct validator cases use the same fixtures (`super-gsd/tools/chronicle/run-self-test.cjs:374-424`; `super-gsd/tools/chronicle/run-self-test.cjs:529-536`).
- **OBSERVED — permissions or missing wrapper:** rejected because the path is resolved and exists; failure occurs at interpreter/path-scheme selection.
- **INFERRED — `.wslconfig` warning:** non-causal. It may affect WSL startup diagnostics, but it cannot make a raw `C:\...` argv path a valid Linux path.
- **OBSERVED — missing metrics directory:** rejected as primary; the wrapper creates the directory at line 89, but never reaches it under the failing interpreter boundary.

### RECOMMENDED repair

**RECOMMENDED.** Create a small host-aware bash resolver shared by Node entry points:

1. **RECOMMENDED:** on Windows, select Git Bash by explicit candidate/filter logic matching `sgsd-boot.ps1`; never accept System32/WindowsApps for a Windows-path argv contract.
2. **RECOMMENDED:** on POSIX, select native `bash` and pass native paths.
3. **RECOMMENDED:** if neither exists, fail quickly with an actionable installation/path message and a bounded spawn timeout.
4. **RECOMMENDED:** treat WSL as a separate explicit adapter, not an ambient fallback. That adapter must convert the wrapper and **every path argument** with `wslpath`, preserve argv boundaries/spaces, use an installed distro deliberately, and require LF shell files.
5. **RECOMMENDED:** add `SGSD_CHRONICLE_LOG_PATH` (or an explicit `--log-file`) as a test-only/diagnostic override validated to a supplied temporary directory, so tests do not write canonical metrics.
6. **RECOMMENDED:** normalize shell scripts intended for WSL/POSIX to LF via `.gitattributes`; if WSL is not supported for this wrapper, reject it clearly instead.

### RECOMMENDED proof matrix

**RECOMMENDED.** The host adapter is accepted only when every environment/case below satisfies its required proof.

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

**INFERRED.** This is one causal repair, not three test-specific patches.

## Decision and repair register

**DOCUMENTED.** This register reconciles every non-KEEP execution-matrix and assurance-matrix row exactly once. The identifier is the matrix identifier. Findings describe current evidence; owners, dependencies, repairs, risks, rollback paths, and proofs describe the proposed milestone target. KEEP rows E05, E13, G02, G03, G05, and G09 are intentionally absent because their existing mechanism is retained.

| ID | Finding / verdict | Concrete bounded repair | Accountable authority owner | Dependencies | Migration / compatibility risk | Rollback / reversibility | Falsifiable acceptance proof |
|---|---|---|---|---|---|---|---|
| E01 | **CONFIGURED — STRENGTHEN:** `codex.readonly.audit` is exactly read-only/xhigh/max 0, but packet and release-readiness invocation are not unavoidable. | **RECOMMENDED:** bind audit/readiness resolution to the typed authority; reject writes and raw fallback. | **RECOMMENDED:** context/readiness authority owner. | **RECOMMENDED:** E11, G10, packet schema. | **INFERRED:** medium; stricter context can expose callers relying on raw prompts. | **RECOMMENDED:** retain a typed degraded read-only packet adapter; never restore write or provider fallback. | **RECOMMENDED:** every audit/readiness fixture resolves E01, writes zero files, records packet/profile hashes, and G10 proves invocation. |
| E02 | **CONFIGURED — REPLACE:** `codex.plan` combines read-only sandboxing with a `.planning/` write root, so authorship/apply authority is contradictory. | **RECOMMENDED:** generate one schema-valid PLAN artifact read-only, then have the host validate and atomically apply only that artifact. | **RECOMMENDED:** planning-artifact authority owner. | **RECOMMENDED:** command envelope, plan schema, plan-final review. | **INFERRED:** high; existing planners may assume direct `.planning/` writes. | **RECOMMENDED:** feature-gated host adapter can consume the old planner output while preserving read-only model execution. | **RECOMMENDED:** valid PLAN applies atomically; second/out-of-root writes, malformed PLAN, or failed G01 leave target unchanged. |
| E03 | **CONFIGURED — MERGE:** `codex.goal` requires worktree, lock, hooks, and native review, but the generic live path does not bind those requirements. | **RECOMMENDED:** execute it only through the reused live double-agent transaction plus profile, packet, hook, and review enforcement. | **RECOMMENDED:** Execution Authority owner. | **RECOMMENDED:** E06, E11, worktree transaction, plan-lock/hooks. | **INFERRED:** high; isolation may reveal undeclared files or implicit caller-workspace state. | **RECOMMENDED:** checkpoint and preserve the isolated patch/evidence; an explicit diagnostic-only legacy flag may resolve but never apply. | **RECOMMENDED:** positive fixture enforces worktree/lock/hooks/review/max 12; each missing invariant fails before target mutation. |
| E04 | **OBSERVED — REPLACE:** `codex.execute.bounded` is configured for bounded isolation, while current orchestration route-checks then uses the caller-workspace generic wrapper. | **RECOMMENDED:** replace the production route-only handoff with the live isolated transaction and host-side checked apply. | **RECOMMENDED:** Execution Authority owner. | **RECOMMENDED:** E03, E06, double-agent live mode, patch allowlist. | **INFERRED:** high; callers with incomplete allowlists or acceptance commands will fail closed. | **RECOMMENDED:** dry-run emits the identical envelope; failed live attempts retain diagnostics and discard the worktree. | **RECOMMENDED:** max-six/allowlist/acceptance fixtures prove no caller-workspace write before validated apply and identical dry/live policy hashes. |
| E06 | **OBSERVED — STRENGTHEN:** `codex.review.native` is read-only/xhigh/max 0, but runner argv does not match the selected wrapper contract. | **RECOMMENDED:** expose one supported native-review entry point with a versioned finding schema and independent session identity. | **RECOMMENDED:** review-provider owner. | **RECOMMENDED:** review registry, CMB writer, fake provider. | **INFERRED:** medium; tightening argv/output parsing can reject tolerated legacy text. | **RECOMMENDED:** preserve the prior wrapper as an opt-in read-only diagnostic while blocking approval without schema-valid findings. | **RECOMMENDED:** fake-provider end-to-end test observes exact argv, distinct executor/reviewer sessions, zero writes, and a durable schema-valid row. |
| E07 | **CONFIGURED — STRENGTHEN:** `codex.review.swarm` is the exact read-only/high/max-0 swarm profile, but no searched production binding proves its use. | **RECOMMENDED:** bind it only to explicitly selected parallel review workloads and synthesize deduplicated read-only findings. | **RECOMMENDED:** review-topology owner. | **RECOMMENDED:** E06, profile resolver, finding schema. | **INFERRED:** medium; parallel cost and duplicate/noisy findings can rise. | **RECOMMENDED:** fall back to sequential E06 review, not a writer or skipped review. | **RECOMMENDED:** a swarm fixture resolves E07 for every member, produces zero writes, records member identities, and deterministically deduplicates findings. |
| E08 | **CONFIGURED — STRENGTHEN:** `codex.cockpit.brief` is read-only/high/max 0, but no searched profile-resolver consumer proves cockpit invocation. | **RECOMMENDED:** resolve cockpit/status briefs through E08 against one versioned snapshot and surface missing sections as degraded data. | **RECOMMENDED:** cockpit read-boundary owner. | **RECOMMENDED:** cockpit snapshot/MCP adapter, E11. | **INFERRED:** low; stricter snapshots can expose stale cockpit producers. | **RECOMMENDED:** retain deterministic snapshot rendering with an explicit degraded marker. | **RECOMMENDED:** complete and missing-section fixtures resolve E08, write nothing, cite snapshot hashes, and never invent absent values. |
| E09 | **CONFIGURED — MERGE:** `codex.app_lab` requires workspace-write/worktree/lock/hooks/native review/max 25, but no searched production binding enforces the transaction. | **RECOMMENDED:** route app-lab work through the authority with the existing isolated apply path and an explicit app-environment adapter. | **RECOMMENDED:** app-lab execution owner. | **RECOMMENDED:** E03, E06, environment capability schema. | **INFERRED:** high; UI/runtime tooling may depend on host-local services or undeclared files. | **RECOMMENDED:** disable app-lab mutation and retain a read-only diagnostic envelope when capabilities are unavailable. | **RECOMMENDED:** a fake app service proves worktree/lock/hooks/review/max 25 and no host mutation outside validated apply. |
| E10 | **CONFIGURED — MERGE:** `codex.cloud_lab` has the same write/isolation/review/max-25 policy, but no searched production binding enforces it. | **RECOMMENDED:** route cloud-lab work through the authority and a deny-by-default cloud capability adapter with fake-service tests. | **RECOMMENDED:** cloud-lab execution owner. | **RECOMMENDED:** E03, E06, credential/capability policy. | **INFERRED:** high; accidental external side effects and credential assumptions are the principal migration risk. | **RECOMMENDED:** default the cloud adapter to disabled/read-only simulation and checkpoint before any unsupported capability. | **RECOMMENDED:** fake cloud fixtures prove scoped credentials, worktree/lock/hooks/review/max 25, and zero real network-side mutation. |
| E11 | **OBSERVED — MERGE:** classifier/router policy has no dedicated profile and missing health can transfer delivery to Claude despite the hard lock. | **RECOMMENDED:** separate immutable authority from availability; health may select retry/backoff/checkpoint, never a new delivery owner. | **RECOMMENDED:** control-plane routing owner. | **RECOMMENDED:** provider health schema, E01–E04, E08–E10, E15. | **INFERRED:** high; outages that previously continued will now stop explicitly. | **RECOMMENDED:** a fail-closed compatibility adapter can emit the old route explanation without executing its forbidden fallback. | **RECOMMENDED:** a truth table over healthy/unhealthy/missing/error states never selects Claude for delivery and always emits a classified route decision. |
| E12 | **CONFIGURED — STRENGTHEN:** spec review is Codex/read-only by contract but is not mechanically bound to an exact profile and independent session. | **RECOMMENDED:** bind spec review to the supported E06 entry point or a separately registered exact read-only profile and record identity separation. | **RECOMMENDED:** assurance/review owner. | **RECOMMENDED:** E06, raw artifact contract, decision schema. | **INFERRED:** medium; legacy free-form reviewer output can be rejected. | **RECOMMENDED:** retain manual read-only review as a stop-state diagnostic; never infer pass from unparsable output. | **RECOMMENDED:** same-session and malformed-output fixtures block; independent raw-artifact review opens a durable decision and drives the existing repair branch. |
| E14 | **OBSERVED — STRENGTHEN:** verifier/browser/semantic mechanisms exist, but semantic core-loop invocation was not found and AUTO browser UNPROVEN can continue. | **RECOMMENDED:** compose the existing verifier, semantic-audit, and browser adapters at their declared edges with explicit prove/defer/block policy. | **RECOMMENDED:** phase-assurance owner. | **RECOMMENDED:** G06, G07, verifier evidence schema. | **INFERRED:** medium; phases lacking real services/data will produce visible deferrals or blocks. | **RECOMMENDED:** preserve existing verifier artifacts and allow only policy-authorized, typed warn-level deferral. | **RECOMMENDED:** real-data semantic and frontend fixtures fire existing tools once, distinguish PROVEN/UNPROVEN/BLOCKED, and never accept fixture-only proof. |
| E15 | **CONFIGURED — STRENGTHEN:** Claude owns synthesis only, while router null/error paths can still safe-default delivery to Claude. | **RECOMMENDED:** constrain orchestration to command envelopes and state transitions; unavailable delivery creates retry/checkpoint, never code execution. | **RECOMMENDED:** control-plane contract owner. | **RECOMMENDED:** E11, Execution Authority, checkpoint schema. | **INFERRED:** high; the stricter boundary converts silent continuation into operator-visible stops. | **RECOMMENDED:** retain interactive synthesis/recovery guidance while leaving delivery unavailable. | **RECOMMENDED:** injected router/provider failures show no Claude code write or delivery call and produce a resumable checkpoint with unchanged target. |
| G01 | **OBSERVED — STRENGTHEN:** plan-final review is configured but its native-review process boundary is mismatched. | **RECOMMENDED:** invoke the existing plan-final predicate through corrected E06 and require its durable decision before PLAN activation. | **RECOMMENDED:** plan-assurance owner. | **RECOMMENDED:** E02, E06, existing review registry. | **INFERRED:** medium; plans previously accepted via synthetic/stub output may block. | **RECOMMENDED:** retain draft PLAN and diagnostics; do not activate until a valid review exists. | **RECOMMENDED:** approve/revise/provider-failure fixtures produce one existing-gate decision each; only approve permits atomic activation. |
| G04 | **CONFIGURED — STRENGTHEN:** phase ATC is distinct and valuable, but configured evidence paths are partly legacy and live rows are absent. | **RECOMMENDED:** keep its predicate/reviewer and migrate only evidence topology plus decision/repair linkage. | **RECOMMENDED:** phase-ATC owner. | **RECOMMENDED:** canonical milestone phase path, review/gate writers. | **INFERRED:** medium; consumers of legacy `.planning/phases/{N}` paths can break. | **RECOMMENDED:** dual-read legacy evidence during a bounded migration; write only canonical paths. | **RECOMMENDED:** old/new topology fixtures fire identical ATC decisions, canonical rows link repairs, and no duplicate gate invocation occurs. |
| G06 | **INFERRED — AUTOMATE:** semantic acceptance has an executable real-data contract, but no core orchestration/closure caller was found in searched surfaces. | **RECOMMENDED:** call the existing semantic-audit skill from phase assurance when semantic ACs apply; do not copy its checks. | **RECOMMENDED:** semantic-assurance owner. | **RECOMMENDED:** E14, existing audit skill, phase capability metadata. | **INFERRED:** medium; previously untested semantic claims may fail or require real data. | **RECOMMENDED:** capability-disabled phases record not-applicable; applicable but unavailable evidence blocks/defer per existing policy. | **RECOMMENDED:** applicable fixture invokes the existing audit once on real data, fixture-only proof fails, and remediation reruns the exact failed AC. |
| G07 | **CONFIGURED — STRENGTHEN:** browser evidence is specialized, but AUTO mode can continue on UNPROVEN. | **RECOMMENDED:** retain the browser adapter and encode explicit prove/defer/block rules with linked debt and close reconciliation. | **RECOMMENDED:** browser-assurance owner. | **RECOMMENDED:** E14, verifier/browser artifacts, G10. | **INFERRED:** medium; unavailable apps/browsers will become visible debt or blocks. | **RECOMMENDED:** allow only configured warn-level deferral with evidence; halt-level routes remain blocked. | **RECOMMENDED:** console/network/route fixtures prove pass, typed permissible deferral, and halt; unresolved halt blocks G10. |
| G08 | **CONFIGURED — MERGE:** structural and qualitative MUDA forms overlap but do not share one finding/repair lifecycle. | **RECOMMENDED:** keep existing MUDA triggers/predicates and normalize their outputs into the shared decision/finding schema. | **RECOMMENDED:** MUDA/value owner. | **RECOMMENDED:** gate registry, decision/repair relation, value metrics. | **INFERRED:** medium; historical waste rows may not map cleanly. | **RECOMMENDED:** dual-read old rows and preserve raw payloads while writing the normalized relation for new runs. | **RECOMMENDED:** structural/qualitative fixtures retain identical fire decisions, deduplicate shared findings, and close through one linked repair without double-counting. |
| G10 | **OBSERVED — REPLACE:** release readiness exists, but milestone close invokes it only in a legacy version-specific branch and unknown/current versions can no-op success. | **RECOMMENDED:** replace literal version branching with a capability/schema policy resolver that reuses the scorer and source gates and fails closed on unknown policy. | **RECOMMENDED:** release-closure owner. | **RECOMMENDED:** scorer, G01/G04/G06–G09 evidence, canonical state. | **INFERRED:** high; current v3.x closure behavior changes from no-op success to enforced readiness. | **RECOMMENDED:** keep versioned v1.9/v2.x adapters behind the resolver and make dry-run non-mutating. | **RECOMMENDED:** legacy fixtures retain results; v3.x exercises generic policy; unknown/missing scorer/open halt/edge miss block; GREEN alone permits durable close. |

## Recommended milestone backbone

### P0 — One typed Execution Authority

**INFERRED — RCA (E01–E04, E06–E12, E14–E15):** authority decisions are duplicated across orchestration prose, dispatch router, provider registry, profile YAML, wrappers, double-agent, packet builder, hooks, and reviewers. Their contradictions are currently resolved by call order rather than a typed invariant.

**RECOMMENDED — implementation boundary (E01–E04, E06–E12, E14–E15):** create one local tool/library with two public operations: `resolve --dry-run` and `execute`. Input is command-envelope v1 plus task/plan IDs. Output is report-envelope v2 plus immutable trace ID. It alone may launch delivery Codex and it reuses, rather than duplicates, the existing mechanisms:

- **RECOMMENDED:** profile resolver for exact role policy;
- **RECOMMENDED:** context registry/packet/authority for typed context;
- **RECOMMENDED:** double-agent live worktree transaction for isolation;
- **RECOMMENDED:** Codex executor or patch executor for the model process;
- **RECOMMENDED:** existing hooks and PLAN-LOCKED validator;
- **RECOMMENDED:** provider registry for availability without authority fallback;
- **RECOMMENDED:** spec/native reviewers and the existing gate registry; and
- **RECOMMENDED:** existing review, gate-value, edge, token, and route writers.

**RECOMMENDED — acceptance proof (E01–E04, E06–E12, E14–E15):** no production call site invokes `codex` or delivery wrappers outside the authority; policy conformance tests cover all ten exact profiles; a trace joins route through repair/closure; pre-apply failure leaves target unchanged; post-apply/pre-evidence failure forces reconciliation/checkpoint; worktree cleanup is proven.

### P0 — Milestone-agnostic closure policy

**OBSERVED — RCA (G10):** literal milestone branches have made release-readiness an old-version feature and unknown/current versions can return success without assurance.

**RECOMMENDED (G10):** resolve closure capabilities from a registry, fail closed on unknown policy, and reuse release-readiness and source gates. Apply the v3.x migration and proof obligations above.

### P0 — Remove delivery authority fallback

**OBSERVED — RCA (E11, E15):** hard-lock policy and availability routing are represented independently, so missing health evidence changes the owner.

**RECOMMENDED (E11, E15):** make authority immutable; availability yields retry/backoff/checkpoint only. Separate Claude synthesis routes from Codex delivery routes in the router schema.

### P1 — Context packet fail-closed and role-complete

**OBSERVED — RCA (E01–E04, E08–E12):** the “only legal surface” has an explicit untyped exception and incomplete role vocabulary.

**RECOMMENDED (E01–E04, E08–E12):** use a role-complete schema, typed degraded packets, packet/hash propagation, authority CMB join, and no free-form fallback.

### P1 — Repair/debt referential integrity

**INFERRED — RCA (G01, G04, G06–G08, G10):** gate decisions affect control flow but evidence and repair closure are not one durable state machine.

**RECOMMENDED (G01, G04, G06–G08, G10):** add stable IDs and closure reconciliation without changing or duplicating the gates themselves.

### P1 — Native review integration

**OBSERVED — RCA (E06, E12, G01):** selected wrapper/argv mismatch and synthetic self-test do not prove the live review boundary.

**RECOMMENDED (E06, E12, G01):** provide one supported review entry point, fake-provider end-to-end tests, session-independence checks, and temporary CMB evidence.

### P1 — Registry/topology lint

**OBSERVED — RCA (E03, E04, E09, E10, G04, G08):** active registries and evidence templates still encode `.planning/phases/{N}` while canonical state uses per-milestone phase roots; command-envelope emitter status also lags claimed behavior.

**RECOMMENDED (E03, E04, E09, E10, G04, G08):** validate active paths against current topology, declare each emitter `current` only after executable contract tests, and fail preflight on drift.

### P2 — Chronicle host-shell adapter

**OBSERVED — RCA (baseline repair supporting E03/E04 process-boundary proof):** ambiguous interpreter selection violates the established Windows host policy.

**RECOMMENDED (baseline repair supporting E03/E04):** implement the bounded resolver/log override/LF proof described above. Promote it to P0 if the generated milestone requires a green baseline before any other phase.

### P2 — Value instrumentation at the authority boundary

**OBSERVED — RCA (all non-KEEP register entries):** cost/value claims cannot be reconstructed reliably from absent or independently appended ledgers.

**RECOMMENDED (all non-KEEP register entries):** use one trace ID and joinable timestamps/tokens/outcomes across dispatch attempts and gates. Measure defects found before merge, unique findings, repair closure, reopened debt, escaped defects, and discarded work—not only gate-row count.

## What to keep unchanged

- **RECOMMENDED:** keep Claude/Opus as orchestration-only and Codex as delivery-only (`CLAUDE.md:168-176`).
- **RECOMMENDED:** keep per-dispatch ATC and phase ATC distinct; do not collapse task-local and cross-plan review.
- **RECOMMENDED:** keep the patch executor's host-side allowlist/apply pattern (`super-gsd/scripts/codex-patch-executor.sh:275-314`).
- **RECOMMENDED:** keep detached-worktree execution from double-agent live mode (`super-gsd/tools/double-agent-executor/run.cjs:584-710`).
- **RECOMMENDED:** keep semantic acceptance against real data and the fixture guard (`super-gsd/skills/sgsd-audit/SKILL.md:268-315`).
- **RECOMMENDED:** keep browser proof as a specialized verifier adapter (`super-gsd/tools/phase-verifier/phase-verifier.mjs:426-506`).
- **RECOMMENDED:** keep gate definitions in `super-gsd/registry/gates.yaml`; strengthen their lifecycle, never reimplement them.
- **RECOMMENDED:** keep edge-guard as an omission detector, not another acceptance gate (`super-gsd/scripts/lib/edge-guard.cjs:56-116`).

## Evidence census

**OBSERVED.** The conclusions above cite and reconcile at least these distinct existing source/config paths:

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

**RECOMMENDED.** The milestone should not be declared complete merely because registries validate or self-tests stub expected objects. It should demonstrate all of the following through real process boundaries in temporary worktrees/ledgers:

1. **RECOMMENDED:** every delivery role resolves to exactly one profile and immutable authority.
2. **RECOMMENDED:** every `requires_worktree` profile actually runs in a detached worktree.
3. **RECOMMENDED:** every write is constrained by PLAN-LOCKED + profile roots + task allowlist.
4. **RECOMMENDED:** every dispatch receives a typed packet; degraded context remains typed and visible.
5. **RECOMMENDED:** no Codex outage, router error, or missing metric can transfer delivery to Claude.
6. **RECOMMENDED:** executor and reviewer sessions are independently identifiable.
7. **RECOMMENDED:** spec review, per-dispatch ATC, phase ATC, verifier, semantic audit, browser gate, MUDA, edge guard, and release readiness each fire from the existing registry/policy at their intended edge.
8. **RECOMMENDED:** a repair loop is joinable from finding to closed repair or explicit permissible debt.
9. **RECOMMENDED:** v3.x release close fails closed unless generic release readiness is GREEN and no halt debt remains.
10. **RECOMMENDED:** token/latency/value dashboards derive from one trace model and degrade honestly when data is absent.
11. **RECOMMENDED:** the chronicle wrapper tests pass across the host-shell proof matrix without writing canonical metrics.
12. **RECOMMENDED:** dry-run resolution and live execution produce the same policy envelope; only live execution mutates the isolated worktree and subsequently applies a validated patch.

**RECOMMENDED.** The frontier opportunity is consolidation: make the strongest existing pieces unavoidable, typed, traceable, and mechanically joined from intent to release.
