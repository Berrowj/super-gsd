# Clean-Sheet Frontier Delivery Architecture

**Date:** 2026-07-13

**Status:** Clean-sheet recommendation; implementation-neutral

**Purpose:** Define an auditable delivery engine from desired outcomes alone, before comparison with any existing implementation.

## 1. Objective and design boundary

The system converts operator intent into verified software outcomes. It must preserve the operator's meaning while making authority, uncertainty, work, evidence, and recovery explicit enough that another person or process can understand and continue the run without private conversational context.

The architecture is optimized for eight outcomes:

1. Translate operator intent into verified software outcomes.
2. Apply proportionate, multi-perspective reasoning when strategic ambiguity is material.
3. Keep model judgment separate from deterministic state transitions.
4. Give executors the minimum sufficient context and bounded authority.
5. Make verification independent, evidence-bearing, and repairable.
6. Survive interruption and remain comprehensible away from the originating machine.
7. Let learning alter future decisions only through an admission process; observations never become authority by themselves.
8. Optimize jointly for outcome quality, operator leverage, token and latency proportionality, and recoverability.

This is one delivery protocol. Policies select progression, deliberation, approvals, and repair limits.

### 1.1 Design axioms

- **One durable account of truth.** Every authoritative transition is represented by a hash-linked event in an append-only journal. Projections are disposable views, not competing truth stores.
- **Judgment proposes; deterministic code disposes.** Models may interpret, plan, generate, critique, or recommend. Only a deterministic kernel validates preconditions and commits lifecycle transitions.
- **Authority is capability-scoped.** An executor receives an expiring grant for named actions over named resources, with quantitative limits and explicit denied actions.
- **Claims require evidence.** Completion means that contract claims have independent verdicts supported by durable evidence, not merely that an executor stopped successfully.
- **Uncertainty buys reasoning.** Additional perspectives are requested only when the expected decision value exceeds their token and latency cost or when policy mandates them.
- **Repair is a typed continuation.** Failure yields a bounded repair order tied to failed claims and evidence; it does not restart an unconstrained conversation.
- **Recovery is replay.** A new process can reconstruct the authoritative position from the journal and resume from a safe boundary without relying on hidden memory.
- **Learning has no direct write path.** Operational observations can propose policy changes but cannot modify authoritative policy or acceptance criteria.

## 2. Architecture at a glance

```text
Operator / calling API
  |
  v
Intent Gateway
  |  IntentEnvelope
  v
Contract Compiler <--------> Deliberation Cell
  |  OutcomeContract           | DecisionProposal(s)
  |                            | DecisionRecord
  v                            v
Deterministic Transition Kernel <------> Policy Catalog
  |        |        |                         ^
  |        |        +--> Durable Journal -----+
  |        |                  |
  |        |                  +--> Operations Projector --> remote clients
  |        |
  |        +--> Context Projector --> Authority Broker
  |                                      |
  |                              AssignmentEnvelope
  |                              + CapabilityGrant
  |                                      |
  |                                      v
  |                                Executor Pool
  |                                  |       |
  |                                  |       +--> Effect Adapter --> external resource
  |                                  |                    |
  |                                  +---- receipts -------+
  |                                           |
  |                                           v
  +---------------------------- Evidence Recorder
                                         |
                                  EvidenceBundle
                                         v
                                Independent Verifier
                                  |              |
                         SATISFIED verdict    REPAIRABLE verdict
                                  |              |
                                  |              v
                                  |        Repair Composer
                                  |         RepairOrder
                                  |              |
                                  +--------------+

Operational observations --> Learning Admission Controller
                                  |
                           PolicyChangeProposal
                                  |
                        evaluation / approval / canary
                                  |
                                  v
                             Policy Catalog
```

The Transition Kernel and Durable Journal form the authority spine. All other components consume an authoritative revision, produce a typed proposal or receipt, and ask the kernel for a transition. This prevents an intelligent component from silently changing the lifecycle it is reasoning about.

## 3. Authority and trust model

Authority is not inferred from which component produced a value. Every envelope declares an `authority_class`, and the kernel permits each class to support only certain transitions.

| Class | Meaning | May authorize | Must never authorize |
|---|---|---|---|
| `HUMAN_MANDATE` | Explicit operator decision authenticated to a run | Intent acceptance, risk exceptions, policy-required approvals, cancellation | Evidence claims it did not independently establish |
| `KERNEL_COMMIT` | Result of deterministic validation against a known revision | Lifecycle transition, lease issuance, budget debit, journal commit | New product meaning or creative technical choices |
| `VERIFIED_CLAIM` | Independent verdict over identified evidence and contract claims | Claim satisfaction, acceptance, bounded repair eligibility | Expansion of scope, authority, or acceptance criteria |
| `EXECUTION_GRANT` | Expiring capability issued from accepted policy and contract | Listed effects within resource, time, cost, and concurrency limits | Any effect outside the allow-list or after expiry |
| `MODEL_PROPOSAL` | Structured judgment from a model-owned component | Nothing directly; it can be an input to deterministic validation or human approval | Transition, approval, policy promotion, self-verification |
| `OBSERVATION` | Telemetry, receipt, heuristic, or unverified report | Nothing directly; it may support investigation or a learning candidate | Policy mutation, claim satisfaction, authority expansion |

Precedence is deliberately narrow rather than a simple global ranking. A human can approve risk but cannot turn a failing test into a passing test. A verifier can satisfy a claim but cannot broaden the operator's intent. The kernel can commit a transition but cannot invent either fact.

## 4. Shared envelope protocol

Every message that can affect a run uses a common envelope. Payload schemas are versioned independently, but the common header is stable.

### 4.1 Common header

```yaml
schema_name: string
schema_version: semver
envelope_id: uuid
run_id: uuid
unit_id: uuid|null
correlation_id: uuid
causation_id: uuid|null
producer:
  component_id: string
  instance_id: string
  principal_id: string|null
authority_class: enum
authoritative_revision: integer
created_at: rfc3339
expires_at: rfc3339|null
replay_key: string
payload_hash: sha256
signature:
  key_id: string
  algorithm: string
  value: string
```

Rules:

- `authoritative_revision` is the journal revision the producer used. A transition proposal built from an older revision is rejected or explicitly rebased; it is never silently accepted.
- `replay_key` identifies the intended logical effect. Repeating the same key and payload is idempotent; repeating the key with a different payload is a conflict.
- For `TransitionRequest`, payload `from_revision` and `idempotency_key` must equal header `authoritative_revision` and `replay_key`; any disagreement invalidates the envelope.
- The payload hash covers a canonical serialization. Signatures bind the header, payload hash, and authority class.
- Expired envelopes can remain as evidence but cannot grant authority.
- Schema evolution is additive within a major version. A major-version change requires a migration reader and a replay test before admission.

### 4.2 Payload schemas

| Schema | Required payload fields | Producer | Consumer and effect |
|---|---|---|---|
| `IntentEnvelope` | `objective`, `constraints[]`, `non_goals[]`, `risk_tolerance`, `success_signals[]`, `requested_scope`, `time_horizon`, `operator_questions[]`, `source_refs[]` | Intent Gateway | Contract Compiler interprets; no lifecycle authority by itself |
| `OutcomeContract` | `contract_id`, `intent_ref`, `claims[]`, `invariants[]`, `work_units[]`, `allowed_effect_classes[]`, `forbidden_effects[]`, `risk_class`, `budget`, `approval_points[]`, `rollback_expectations[]`, `open_assumptions[]` | Contract Compiler | Kernel validates and asks for approval or contracts the run |
| `ContractClaim` | `claim_id`, `statement`, `verification_method`, `evidence_requirements[]`, `acceptance_rule`, `criticality`, `repair_policy`, `owner` | Contract Compiler | Verifier evaluates; kernel calculates aggregate acceptance |
| `WorkUnit` | `unit_id`, `purpose`, `depends_on[]`, `claims_served[]`, `input_refs[]`, `expected_outputs[]`, `effect_scope`, `completion_boundary`, `budget_slice`, `rollback_ref` | Contract Compiler | Context Projector and kernel schedule bounded work |
| `DeliberationRequest` | `decision_id`, `question`, `decision_options[]`, `uncertainties[]`, `stakes`, `reversibility`, `perspective_specs[]`, `cost_ceiling`, `deadline` | Contract Compiler or kernel | Deliberation Cell returns proposals without transition authority |
| `DecisionProposal` | `decision_id`, `perspective_id`, `recommendation`, `premises[]`, `evidence_refs[]`, `uncertainties[]`, `failure_modes[]`, `confidence`, `dissent[]`, `tokens_used`, `elapsed_ms` | Deliberation Cell | Compiler synthesizes; operator or policy chooses where required |
| `DecisionRecord` | `decision_id`, `options_considered[]`, `selected_option`, `reason_codes[]`, `proposal_refs[]`, `dissent_retained[]`, `decider`, `revisit_trigger` | Kernel after valid selection | Durable explanation for downstream planning and later review |
| `ContextBundle` | `unit_ref`, `contract_slice`, `dependency_outputs[]`, `relevant_decisions[]`, `resource_descriptors[]`, `tool_contracts[]`, `evidence_duties[]`, `exclusions[]`, `context_hash`, `omission_manifest[]` | Context Projector | Executor receives only material required for its unit |
| `CapabilityGrant` | `grant_id`, `principal_id`, `unit_ref`, `allowed_actions[]`, `resource_selectors[]`, `denied_actions[]`, `effect_ceiling`, `token_ceiling`, `wall_time_ceiling_ms`, `concurrency_ceiling`, `valid_from`, `valid_until`, `revocation_ref` | Authority Broker after kernel approval | Effect adapters enforce; executor cannot widen it |
| `AssignmentEnvelope` | `assignment_id`, `unit_ref`, `context_ref`, `grant_ref`, `expected_receipts[]`, `heartbeat_interval_ms`, `lease_until`, `attempt`, `return_endpoint` | Kernel and Authority Broker | Executor performs one bounded unit under one lease |
| `ExecutionReceipt` | `assignment_ref`, `attempt`, `start_revision`, `end_time`, `actions[]`, `outputs[]`, `effect_receipts[]`, `resource_usage`, `warnings[]`, `exit_class`, `executor_attestation` | Executor and effect adapters | Evidence Recorder validates provenance and completeness |
| `EvidenceItem` | `evidence_id`, `claim_refs[]`, `kind`, `locator`, `content_hash`, `producer`, `collection_method`, `environment`, `observed_at`, `fresh_until`, `tamper_proof`, `redaction`, `availability` | Evidence Recorder | Verifier reads evidence without trusting executor narration |
| `EvidenceBundle` | `bundle_id`, `contract_ref`, `unit_ref`, `items[]`, `coverage[]`, `missing_requirements[]`, `bundle_hash`, `sealed_at` | Evidence Recorder | Verifier accepts only sealed, provenance-valid bundles |
| `VerificationVerdict` | `verdict_id`, `claim_results[]`, `aggregate`, `evidence_refs[]`, `method_versions[]`, `independence_attestation`, `uncertainties[]`, `failure_class`, `repairability`, `verifier_signature` | Independent Verifier | Kernel transitions to satisfied, repairable, or blocked |
| `FailureEnvelope` | `failure_id`, `class`, `severity`, `scope`, `detected_at_revision`, `supporting_refs[]`, `effect_uncertainty`, `retry_eligibility`, `next_safe_actions[]`, `owner`, `resume_status` | Detecting component | Kernel may consume it only through a guarded blocking transition |
| `RepairOrder` | `repair_id`, `failed_claims[]`, `failure_class`, `allowed_changes[]`, `forbidden_changes[]`, `required_context_delta[]`, `required_new_evidence[]`, `attempt_ceiling`, `budget_slice`, `approval_requirement`, `stop_conditions[]` | Repair Composer; kernel validates | Context Projector creates a new bounded unit attempt |
| `LearningCandidate` | `candidate_id`, `observation_refs[]`, `hypothesis`, `target_decision`, `proposed_change`, `expected_benefit`, `known_risks[]`, `confounders[]`, `evaluation_plan`, `data_class` | Learning Admission Controller | Evaluation queue only; it has no policy-write authority |
| `PolicyChangeProposal` | `proposal_id`, `candidate_ref`, `policy_key`, `current_version`, `proposed_version`, `evaluation_results[]`, `safety_argument`, `approval_requirement`, `canary_plan`, `rollback_rule` | Learning Admission Controller | Human or deterministic admission policy may approve a canary |
| `TransitionRequest` | `entity_ref`, `from_revision`, `from_status`, `to_status`, `reason_code`, `supporting_refs[]`, `requested_by`, `idempotency_key` | Any authorized component | Kernel validates all guards; a request never changes status directly |
| `TransitionEvent` | `revision`, `entity_ref`, `prior_status`, `new_status`, `reason_code`, `supporting_refs[]`, `policy_version`, `budget_delta`, `lease_delta`, `previous_event_hash`, `event_hash` | Transition Kernel | Journal stores; all projections consume |
| `RecoverySnapshot` | `snapshot_revision`, `aggregate_hash`, `active_entities[]`, `open_leases[]`, `budget_balances[]`, `pending_approvals[]`, `policy_versions[]`, `journal_prefix_hash` | Durable Journal replay service | Recovery accelerates replay but is never trusted beyond its verified prefix |

The schemas intentionally separate an executor's receipt, a recorder's evidence, and a verifier's verdict. They can refer to one another, but none can impersonate another's authority.

## 5. Component contracts

The table below is the normative boundary map. “Model-owned” means judgment is expected and its product remains a proposal. “Deterministic” means identical validated input and policy version must produce the same decision.

| Component | Responsibility | Input schema | Output schema | Authority and mechanism | Failure state | Required evidence | Downstream consumer |
|---|---|---|---|---|---|---|---|
| **Intent Gateway** | Authenticate the operator, capture intent faithfully, preserve source material, and identify missing mandatory fields without solving the problem | Human/API request, identity proof | `IntentEnvelope` | Deterministic validation plus human-owned meaning; cannot infer approval | `CLARIFICATION_REQUIRED` for missing or contradictory mandate; `BLOCKED` for failed authentication | Source hashes, identity result, normalization warnings | Contract Compiler; Operations Projector |
| **Contract Compiler** | Convert intent into claims, invariants, work units, risks, approvals, budgets, and rollback expectations | `IntentEnvelope`, policy slice, optional `DecisionRecord` | `OutcomeContract`, `DeliberationRequest`, clarification questions | Model-owned synthesis; deterministic schema and policy validation; no transition authority | `CLARIFICATION_REQUIRED` when meaning is unavailable; `DELIBERATING` when ambiguity threshold is exceeded; `BLOCKED` for invalid schema after bounded regeneration | Prompt/input refs, assumptions, policy version, validation results | Operator, Deliberation Cell, Transition Kernel |
| **Deliberation Cell** | Produce independent perspectives and a synthesis for consequential ambiguous decisions | `DeliberationRequest`, evidence refs, budget grant | `DecisionProposal[]`, synthesis proposal | Model-owned; perspectives have isolated contexts where practical; cannot select unless selection policy is deterministic | Remains `DELIBERATING` while useful work is possible; `APPROVAL_REQUIRED` for unresolved high-stakes disagreement; `BLOCKED` at cost/deadline ceiling | Per-perspective premises, evidence refs, dissent, usage and time | Contract Compiler, operator, Transition Kernel |
| **Transition Kernel** | Select eligible work deterministically; validate guards, revisions, budgets, leases, transitions, and invariants | `TransitionRequest`, ready-unit projection, referenced envelopes, policy version, journal revision | `AssignmentEnvelope`, `TransitionEvent`, or typed rejection | Sole deterministic lifecycle writer and scheduling function; no creative authority | Status remains unchanged; `BLOCKED` requires its own valid event | Eligibility/guard trace, policy version, conflict revision, commit hash | Every component through journal projections |
| **Durable Journal** | Persist ordered, hash-linked events and sealed envelopes; replay aggregates and create verified snapshots | `TransitionEvent`, immutable blobs, snapshot revision request | Commit receipt, event stream, verified prefix, `RecoverySnapshot` | Deterministic storage and replay; single logical append authority; cannot interpret meaning | No receipt means no transition; integrity failure forces read-only `BLOCKED` operation | Commit/replica receipts, chain and snapshot hashes, integrity scans | Kernel, recovery process, Operations Projector, auditors |
| **Context Projector** | Produce the smallest context sufficient for one unit while declaring omissions | Accepted contract, unit, dependency results, decisions, policy | `ContextBundle` | Deterministic selection where rules suffice; model-owned compression allowed but must preserve refs and exclusions | Unit remains `READY`; `BLOCKED` if required context is unavailable or too large after bounded compression | Inclusion reasons, omission manifest, source hashes, size and token estimate | Authority Broker, Executor, Repair Composer |
| **Authority Broker** | Derive and issue least-privilege, expiring grants and revoke them on lifecycle changes | Work unit, `ContextBundle`, risk and effect policy, budget balance | `CapabilityGrant`, revocation event request | Deterministic policy evaluation; cannot grant an undeclared effect | Unit remains `READY`; `APPROVAL_REQUIRED` for policy-listed effects; `BLOCKED` if safe scoping is impossible | Policy decision log, resource selectors, limits, approval ref | Executor and effect adapters; Transition Kernel |
| **Executor Pool** | Perform one assigned work unit and report actions, effects, outputs, and consumption | `AssignmentEnvelope`, `ContextBundle`, `CapabilityGrant` | `ExecutionReceipt`, output refs, heartbeat observations | Model-owned or deterministic worker; effect authority exists only through enforced grant | `EVIDENCE_PENDING` on ordinary completion; `REPAIRABLE` or `BLOCKED` only after verdict; lease expiry stops effects | Tool/effect receipts, output hashes, resource use, exit class, executor attestation | Evidence Recorder; Operations Projector |
| **Effect Adapter** | Enforce grants at the external-resource boundary, fence leases, make idempotent effects, reconcile uncertain effects, and issue receipts | Effect request, `CapabilityGrant`, lease, resource version, effect key | Effect result/denial, effect receipt, reconciliation result, revocation acknowledgement | Deterministic enforcement; sole writer for its resource class; no model judgment | Deny without effect; uncertain result fences the resource and requests `BLOCKED` until reconciled | Grant/lease decision, before/after versions, effect key, provider receipt, reconciliation proof | Executor, Evidence Recorder, Transition Kernel, rollback work |
| **Evidence Recorder** | Collect, normalize, hash, seal, and retain independent evidence for each contract claim | Contract evidence duties, execution outputs, environment observations | `EvidenceItem[]`, `EvidenceBundle` | Deterministic provenance and completeness checks; collection adapters may execute read-only probes | Remains `EVIDENCE_PENDING` while within evidence deadline; `BLOCKED` if mandatory evidence cannot be obtained safely | Collector versions, hashes, timestamps, environment identity, missing-requirement list | Independent Verifier, Operations Projector |
| **Independent Verifier** | Evaluate every claim against declared acceptance rules using sealed evidence, without inheriting executor conclusions | `OutcomeContract`, `EvidenceBundle`, verifier policy | `VerificationVerdict` | Deterministic checks where possible; model judgment allowed for semantic claims but can only emit a signed verdict | `SATISFIED`, `REPAIRABLE`, or `BLOCKED` proposed according to typed result; kernel commits | Per-claim result, evidence refs, method versions, independence attestation, uncertainties | Transition Kernel, Repair Composer, operator |
| **Repair Composer** | Convert failed claims into the narrowest safe next attempt with explicit change and stop bounds | Failing `VerificationVerdict`, prior unit/receipt/context, repair policy | `RepairOrder` | Model-owned diagnosis; deterministic validation of attempt, scope, budget, and approval limits | `APPROVAL_REQUIRED` when repair expands risk; `BLOCKED` when failure is non-repairable or limits are spent | Failure classification, causal evidence refs, proposed delta, remaining limits | Transition Kernel, Context Projector, operator |
| **Learning Admission Controller** | Turn repeated observations into testable policy proposals, evaluate them, and control canary promotion or reversion | Observation refs, verdict history, resource outcomes, operator feedback | `LearningCandidate`, `PolicyChangeProposal`, evaluation record | Model-owned hypothesis generation; deterministic admission thresholds plus human approval for high-risk policy | Candidate remains non-authoritative as `REJECTED`, `MORE_EVIDENCE_REQUIRED`, or `CANARY_PENDING` | Dataset lineage, evaluation results, confounders, safety argument, approval ref | Policy Catalog, operator, auditors |
| **Policy Catalog** | Version lifecycle guards, budgets, capability rules, reasoning triggers, approval rules, and schema support | Approved policy proposal or explicit human mandate | Immutable policy version, activation event request, prior-version pointer | Deterministic, versioned reads; writes require admitted authority; every run pins versions | Current version remains active on failed admission; invalid catalog enters read-only `BLOCKED` operation | Signed policy blob, approval/evaluation refs, activation and rollback records | Transition Kernel and all policy consumers |
| **Operations Projector** | Build comprehensible local and remote views entirely from journal events and evidence availability | Event stream, immutable envelope metadata, projection schema | Run summary, timelines, alerts, resumable handoff packet, freshness signal | Deterministic projection; strictly read-only with respect to authority spine | Shows `STALE` or `DEGRADED` explicitly; never invents missing status | Last consumed revision, projection version, lag, missing refs, integrity result | Operator, remote clients, recovery process |

### 5.1 Component independence requirements

The execution principal cannot sign its final verdict; reused probes must be rerun or independently validated. Model-owned components never receive the journal credential, raw learning observations cannot activate policy, and grant revocation reaches effect adapters without executor cooperation. Projection failure stops work only when explicit risk policy requires remote visibility.

## 6. One lifecycle, selected by policy

Runs and work units use the same lifecycle vocabulary. An entity records its `scope_kind` (`RUN` or `UNIT`), and transition guards specialize only where the scope differs. Operating styles are policy overlays on this shared machine.

### 6.1 Lifecycle statuses

```text
RECEIVED
  |-- insufficient mandate ------------------------> CLARIFICATION_REQUIRED
  |                                                     |
  |<-------------------- clarified ---------------------+
  |
  |-- material ambiguity --------------------------> DELIBERATING
  |                                                     |
  |<---------------- bounded decision ------------------+
  |
  +------------------------------------------------> CONTRACTED
                                                        |
                      required human decision ----------+--> APPROVAL_REQUIRED
                                                        |         |
                                                        |<--------+
                                                        v
                                                      READY
                                                        |
                                                        v
                                                      LEASED
                                                        |
                                                        v
                                                    EXECUTING
                                                        |
                                                        v
                                                 EVIDENCE_PENDING
                                                        |
                                                        v
                                                    VERIFYING
                                                   /     |      \
                                                  /      |       \
                                         SATISFIED  REPAIRABLE  BLOCKED
                                                        |
                                    bounded repair -----+----> READY

Any nonterminal safe boundary --> PAUSED --> prior resumable status
Any eligible nonterminal status --> ROLLING_BACK --> ROLLED_BACK
Operator cancellation at a safe boundary ----------------> CANCELLED
```

`SATISFIED`, `ROLLED_BACK`, and `CANCELLED` are terminal. `BLOCKED` is non-progressing but can leave only through a new authorized input that resolves its recorded blocker, an approved rollback, or cancellation. No process may translate `BLOCKED` to `READY` merely by retrying.

### 6.2 Transition contract

| From | To | Deterministic guard | Required support | On failed guard |
|---|---|---|---|---|
| `RECEIVED` | `CLARIFICATION_REQUIRED` | Mandatory intent field absent, contradictory, or unauthenticated meaning needs operator input | Validation result and questions | Remain `RECEIVED`; emit rejection if reason is invalid |
| `CLARIFICATION_REQUIRED` | `RECEIVED` | Authenticated answer resolves every recorded question or contradiction | Clarification ref and revised `IntentEnvelope` | Stay `CLARIFICATION_REQUIRED` |
| `RECEIVED` | `DELIBERATING` | Ambiguity policy fires and a valid reasoning budget exists | `DeliberationRequest`, cost estimate, policy version | Route to `APPROVAL_REQUIRED` for more budget or `BLOCKED` |
| `RECEIVED` or `DELIBERATING` | `CONTRACTED` | Contract schema valid; assumptions within policy; required decisions resolved; contract hash approved where required | `OutcomeContract`, decision refs, approval refs | Return typed violations; no status change |
| Any eligible nonterminal | `APPROVAL_REQUIRED` | A declared policy/contract approval is due before the next effect or decision | Approval request, subject hash, risk summary, recorded resume status | Remain current |
| `APPROVAL_REQUIRED` | Recorded resume status | Approval is valid for the unchanged subject and every normal target guard passes | Signed approval and target support | Stay `APPROVAL_REQUIRED` |
| `CONTRACTED` | `READY` | Approval obligations satisfied; dependencies accepted; budget reserved; rollback expectation valid | Contract, approvals, dependency verdicts, reservation receipt | Remain `CONTRACTED`; record unmet guards |
| `READY` | `LEASED` | Context hash valid; capability grant valid; executor eligible; no conflicting lease; budget available | Assignment, context, grant, reservation | Remain `READY`; queue or request approval |
| `LEASED` | `EXECUTING` | Executor acknowledges before lease expiry and effect adapters recognize the grant | Signed acknowledgement | Revoke lease; return to `READY` if retry policy permits |
| `EXECUTING` | `EVIDENCE_PENDING` | Effects ended or were revoked; receipt schema valid; required output locators present | Execution receipt and effect-adapter receipts | Revoke; enter `BLOCKED` only if effects cannot be accounted for |
| `LEASED` or `EXECUTING` | `READY` | Lease is revoked/expired, effects are reconciled as absent or compensated, and retry remains eligible | Lease event, effect inventory, reconciliation proof, retry calculation | Remain current or request `BLOCKED` |
| `EVIDENCE_PENDING` | `VERIFYING` | Bundle sealed; every mandatory evidence duty is present or explicitly reported unavailable | `EvidenceBundle` | Continue collection within deadline, otherwise `BLOCKED` |
| `VERIFYING` | `SATISFIED` | Signed verdict says all critical claims pass and aggregate acceptance rule evaluates true | `VerificationVerdict`, evidence bundle | Reject transition |
| `VERIFYING` | `REPAIRABLE` | Verdict has failed claims, repairability true, and attempt plus budget limits remain | Failing verdict and repair eligibility calculation | `BLOCKED` |
| `VERIFYING` | `BLOCKED` | Failure is non-repairable, evidence indeterminate at deadline, independence invalid, or limits spent | Verdict or explicit evidence-failure record | Reject if blocker is unsupported |
| `REPAIRABLE` | `READY` | Repair order validates, stays within contract and grant ceilings, reserves budget, and needs no new approval | `RepairOrder`, remaining limits, updated context hash | `APPROVAL_REQUIRED` or `BLOCKED` |
| Any eligible nonterminal | `BLOCKED` | Typed failure proves that no safe eligible transition can progress under current authority | `FailureEnvelope`, unresolved conditions, owner, recorded resume status | Remain current |
| `BLOCKED` | Recorded resume status | New authorized input resolves every blocker and every normal target guard passes at current revision | Resolution evidence and target support | Stay `BLOCKED` |
| Any eligible nonterminal | `PAUSED` | Effects are stopped or safely fenced; resumable status recorded; leases revoked | Pause reason and recovery pointer | Wait for safe boundary or force rollback per policy |
| `PAUSED` | Prior resumable status | Journal prefix valid; policies available; external resources reconciled; approval still current | Recovery report and new leases if needed | Stay `PAUSED` or enter `BLOCKED` |
| Any rollback-eligible status | `ROLLING_BACK` | Rollback recipe and authority exist; current effect set is known | Rollback plan, effect inventory, approval if required | `BLOCKED` with uncompensated-effect list |
| `ROLLING_BACK` | `ROLLED_BACK` | Compensation claims independently verified | Rollback verdict and evidence | `BLOCKED` |
| Any eligible nonterminal | `CANCELLED` | Authenticated cancellation is valid and all effects are absent, reconciled, or explicitly residual | Cancellation mandate, lease revocations, effect inventory | Remain current or request `ROLLING_BACK` |

“Any eligible nonterminal” means any nonterminal status other than the target for which the row guard passes. Approval resume status is restricted to `DELIBERATING`, `CONTRACTED`, `READY`, `REPAIRABLE`, or `ROLLING_BACK`; other recorded resume statuses must be nonterminal and pass their ordinary target guard.

Every transition is compare-and-commit against `from_revision`. Every status change named elsewhere is shorthand for a new `TransitionRequest` that must use one table row; “On failed guard” never changes status. Transition rejection is a durable diagnostic envelope but does not advance the authoritative revision unless policy records diagnostics in the journal.

### 6.3 Policy overlays, not separate modes

| Requested behavior | Policy values on the shared lifecycle | Result |
|---|---|---|
| Interactive | `progression=human_at_declared_points`, `clarification=eager`, `summary_frequency=high` | The kernel pauses only at declared approvals or questions; all other transitions are unchanged |
| Bounded one-unit | `scope_ceiling=1 terminal unit`, `continuation=stop_after_unit`, `repair_limit=contract value` | One unit proceeds through evidence and verdict, then the run pauses with a handoff packet |
| Autonomous | `progression=continue_while_guards_true`, finite cost/time/effect ceilings, explicit approval policy | Eligible transitions continue without conversational prompting; no guard or approval is bypassed |
| Strategic deliberation | Higher `ambiguity_sensitivity`, named independent perspectives, synthesis and dissent retention, fixed cost ceiling | More judgment occurs before contracting; execution and verification lifecycle stays identical |
| Repair | `entry=REPAIRABLE`, typed change allow-list, smaller budget, finite attempts, escalation rule | A failed claim creates a new attempt under the same contract and evidence duties |
| Recovery | `entry=PAUSED or incomplete lease`, `source=journal`, reconciliation and lease replacement rules | Another process reconstructs and resumes the same run rather than creating a shadow run |

The overlay schema includes progression behavior; maximum units and terminal-stop behavior; ambiguity sensitivity, perspectives, reasoning tokens, and reasoning time; repair attempt and effect-scope limits; lease and external-effect reconciliation; approvals by risk; and token, wall-time, monetary, effect, and parallelism budgets.

Changing an overlay can alter future eligible transitions but cannot rewrite past events or change an already accepted contract without a contract-amendment event and any required approval.

## 7. Proportionate deliberation

Strategic reasoning is invoked by a deterministic trigger calculated from declared factors, not by an unbounded instinct to ask more agents.

The policy score is a versioned weighted sum of impact, irreversibility, unresolved uncertainty, novelty, and disagreement, reduced by available decisive evidence and normalized reasoning cost.

The kernel compares this score with a policy threshold and checks mandatory conditions such as destructive effects, high data sensitivity, or an operator request for perspectives. The score selects a bounded `DeliberationRequest`; it never selects the product decision itself.

Perspective specifications identify a question and epistemic role, for example feasibility, failure analysis, operator value, maintainability, or evidence design. They do not assign personalities for entertainment. Inputs are isolated enough to reduce convergence, proposals are sealed before synthesis when stakes justify the cost, and dissent is preserved in the `DecisionRecord`.

Stopping rules end reasoning when decision-critical uncertainty is resolved or expected information value falls below cost, and always at the token/time ceiling. A perspective must cover a new declared uncertainty; consequential dissent goes to approval, and majority vote never substitutes for evidence or accountable selection.

## 8. Minimum assurance loop

The assurance loop contains only checks that protect a distinct irreversible or authority-bearing decision.

| Check | Protected decision | Minimal evidence | Why it cannot be removed |
|---|---|---|---|
| Contract validity | Whether the system is solving an authorized, testable problem | Authenticated intent, accepted claims, assumptions, risk and budget | Without it, later success can be unrelated to operator intent |
| Capability and boundary validity | Whether a worker may create a particular effect | Unit scope, least-privilege grant, policy result, approval refs | Without it, correct reasoning can still cause unauthorized effects |
| Execution integrity | Whether claimed actions and outputs occurred under the valid lease | Effect-adapter receipts, output hashes, resource accounting, lease identity | Without it, verification may inspect unknown or unaccounted outputs |
| Evidence sufficiency and provenance | Whether each claim has the evidence its acceptance rule requires | Sealed bundle, source identity, method version, freshness, coverage | Without it, a conclusion can rest on missing, stale, or self-reported facts |
| Independent claim verdict | Whether the contracted outcome is actually satisfied | Per-claim result, evidence refs, independence attestation, uncertainty | Without it, executor confidence becomes self-approval |
| Atomic transition commit | Whether acceptance, budgets, leases, and lifecycle position agree | Guard trace, prior revision, event hash, budget and lease deltas | Without it, concurrent processes can create contradictory authority |
| Learning admission | Whether experience is safe and strong enough to alter future decisions | Lineage, evaluation, safety argument, approval, canary result | Without it, noise or manipulation can silently become policy |

### 8.1 Typed, bounded repair

Verification classifies failure using a closed taxonomy with an extension mechanism:

```text
CONTRACT_MISUNDERSTANDING
IMPLEMENTATION_DEFECT
REGRESSION
EVIDENCE_MISSING
EVIDENCE_STALE
ENVIRONMENT_DIVERGENCE
CAPABILITY_DENIED
DEPENDENCY_UNAVAILABLE
NONDETERMINISTIC_RESULT
VERIFIER_INDETERMINATE
BUDGET_EXHAUSTED
NON_REPAIRABLE
```

A repair is eligible only if all of the following are true:

1. The failed claim has a repair policy.
2. The verdict identifies evidence for the failure and states what new evidence would demonstrate repair.
3. The `RepairOrder.allowed_changes` is a subset of the accepted contract's effect scope, unless a human approves a contract amendment.
4. Attempt, token, time, monetary, and effect budgets remain.
5. The repair does not weaken acceptance rules, remove failed claims, or let the prior executor become its own verifier.
6. Repeated failure rules do not require escalation.

The next context contains the prior unit, failing evidence, failure classification, permitted delta, and relevant decisions. It excludes unrelated run history. Each attempt has a distinct ID and lease, while retaining one claim lineage so repeated failures are visible.

## 9. Learning and policy admission

Learning is a second control loop outside the live outcome loop:

```text
observations
  -> candidate hypothesis
  -> lineage and data-quality review
  -> offline or shadow evaluation
  -> safety and counterfactual analysis
  -> policy change proposal
  -> required approval
  -> limited canary
  -> independent outcome evaluation
  -> promote, hold, or revert
```

### 9.1 Admission stages

| Stage | Input | Deterministic admission rule | Output authority |
|---|---|---|---|
| Candidate creation | Observations and operator feedback | Required lineage, privacy class, target decision, and falsifiable hypothesis present | `OBSERVATION` only |
| Data-quality review | Candidate and source set | Minimum sample rules, deduplication, contamination checks, confounders declared | `OBSERVATION` only |
| Evaluation | Frozen candidate and evaluation plan | Predeclared measures, baseline, holdout or historical replay, cost and safety measures | Evaluation evidence; no live authority |
| Proposal | Passing evaluation and safety argument | Benefit threshold, no protected invariant regression, rollback rule present | `MODEL_PROPOSAL` |
| Approval | Proposal, risk class, evaluation evidence | Correct approver and signature; low-risk automatic rules must themselves be approved policy | Authorization for a limited canary only |
| Canary | Versioned policy on a bounded population | Exposure ceiling, monitoring evidence, abort threshold, time window | Temporary, scope-limited policy authority |
| Promotion | Canary verdict | Outcome quality and safety thresholds pass; no unresolved critical regression | New immutable policy version |
| Reversion | Abort threshold or later regression | Deterministic threshold or authorized human request | Prior version reactivated; evidence retained |

### 9.2 Learning invariants

- Raw observations, generated summaries, popularity, and repeated suggestions never become policy authority.
- Evaluation data and live canary data retain lineage to immutable sources.
- A policy change cannot change the meaning of a contract already in flight unless that contract explicitly permits version adoption and the kernel records it.
- Promotion measures outcome quality, operator burden, token use, latency, and recovery behavior together; a cheaper policy that lowers critical outcome quality fails admission.
- Negative and inconclusive results remain discoverable to reduce repeated experiments.
- A proposed policy cannot approve itself, choose its own evaluation data after seeing results, or erase its predecessor.

## 10. Failure semantics

Failures are data with declared effect on authority. A process crash is not automatically a work failure, and a successful process exit is not automatically an outcome success.

| Failure | Authoritative consequence | Retry rule | Evidence and escalation |
|---|---|---|---|
| Invalid model output | No transition; retain current status | Regenerate within schema-repair count and original budget | Validation errors, model/config identity, attempts; then human input or `BLOCKED` |
| Executor process loss before effects | Lease expires and unit returns to `READY` | New attempt if retry limit and budget allow | Heartbeat gap, adapter effect inventory, lease revocation |
| Executor loss after possible effects | Freeze new effects; reconcile before any retry | Never retry until effect identity and compensation status are known | Adapter receipts, resource inventory; `BLOCKED` on uncertainty |
| Capability denial | Denied effect does not occur | Replan inside current grant; widening requires approval or amendment | Denial receipt and requested action |
| Evidence unavailable | Stay `EVIDENCE_PENDING` until deadline | Alternative method only if contract permits equivalent evidence | Missing duty, collector errors, equivalence decision; then `BLOCKED` |
| Verifier disagreement | No satisfaction transition | Apply predeclared adjudication: deterministic rule, additional independent method, or human | All verdicts and evidence; never discard minority uncertainty |
| Stale transition proposal | No transition | Producer rebuilds from current revision | Expected and actual revisions, rejected request hash |
| Duplicate request | Return prior result for same key and payload | No new execution | Original event/receipt ref |
| Reused key with different payload | No transition; security-relevant conflict | No automatic retry with that key | Both hashes, producer identity, alert |
| Lease expiry | Effects denied after expiry; status reconciled | New lease only after effect inventory | Expiry event, adapter acknowledgements, last heartbeat |
| Kernel process loss before commit receipt | Authority unchanged unless journal proves commit | Query by idempotency key, then continue | Journal result and prefix integrity |
| Journal integrity failure | Authority spine becomes read-only; active effects revoked where safe | Restore from verified replica or backup prefix; never skip corrupt events | Chain validation, replica comparison, recovery approval |
| Budget exhaustion | No new leases or deliberation work | Approval can add budget; otherwise `BLOCKED` or rollback | Budget ledger, forecast error, remaining obligations |
| Rollback action failure | `BLOCKED`; uncompensated effects remain explicit | Bounded compensation alternative only under authority | Effect inventory, attempted compensation, independent rollback verdict |

Each failure envelope includes `failure_id`, `class`, `severity`, `scope`, `detected_at_revision`, `supporting_refs`, `effect_uncertainty`, `retry_eligibility`, `next_safe_actions[]`, and `owner`. Unknown failure classes default to no new effects and require explicit classification.

## 11. Idempotency, replay, and recovery

### 11.1 Idempotency

- Transition commits are keyed by `(entity_ref, idempotency_key)`. The journal returns the original event for an identical repeat.
- External effects use adapter-issued effect keys derived from `run_id`, `unit_id`, `attempt`, and a stable action index. An adapter must return the original receipt or report that idempotency is unsupported before the grant is issued.
- Evidence collection uses content hashes and method identity; repeated collection may create a new freshness observation without duplicating immutable content.
- Model calls are not assumed deterministic. Repeating one creates a new proposal envelope linked to the superseded proposal; only the selected record becomes decision support.
- Notifications and projection rebuilds are at-least-once and consumer-idempotent. They carry authoritative revision and projection version.

### 11.2 Replay

Replay has two forms:

1. **Authority replay** reconstructs statuses, balances, leases, approvals, and pinned policies solely from verified journal events. It performs no external effect and calls no model.
2. **Work replay** intentionally repeats a unit attempt under a new lease and attempt ID. It is allowed only after authority replay, external-effect reconciliation, and a fresh grant.

A `RecoverySnapshot` accelerates authority replay. The recovery process verifies the journal prefix hash represented by the snapshot, then replays all later events. If verification fails, it starts from an earlier trusted snapshot or genesis. Snapshot contents can never override events.

### 11.3 Interruption procedure

1. Verify journal integrity through the latest durable revision.
2. Rebuild the run and unit aggregates plus pinned policy versions.
3. Enumerate open leases, pending effects, incomplete evidence duties, approvals, and budgets.
4. Reconcile each external effect through its adapter using the stable effect key.
5. Revoke or expire uncertain leases; record the reconciliation result.
6. Produce a handoff packet containing objective, contract summary, current statuses, blockers, spent and remaining budgets, last verified claims, pending decisions, risk, and exact next eligible transitions.
7. Resume only from a transition whose guards pass at the new revision.

## 12. Concurrency and write ownership

The architecture allows parallel work without allowing parallel truth.

| Resource | Logical writer | Concurrency rule | Conflict behavior |
|---|---|---|---|
| Journal revision | Transition Kernel through one append service | Serialized global append or partitioned append with one ordered stream per aggregate and a deterministic cross-aggregate commit protocol | Compare-and-commit failure; producer rebases |
| Run lifecycle | Kernel | One transition at a time per `run_id` | Stale request rejected |
| Unit lifecycle | Kernel | One active lease per `unit_id`; independent units may run concurrently | Competing lease denied |
| Budget balance | Kernel | Reservation and debit committed with lifecycle event | Insufficient balance rejects transition |
| External resource | Effect adapter named in grant | Resource-specific lock, version condition, or idempotency key required | Effect denied or explicit conflict receipt |
| Contract | Kernel after human/policy authority | Immutable version; amendment creates successor linked to predecessor | In-flight units pin old version unless migrated by event |
| Evidence item | Evidence Recorder | Immutable by content hash; new observation creates a new item | Hash conflict quarantined |
| Verdict | Verifier identity | Immutable signed record; multiple verdicts coexist | Adjudication policy chooses aggregate result |
| Policy version | Policy Catalog admission path | Immutable; one activation event establishes the active version for a scope | Concurrent activation requests compare revisions |
| Projection | Projection instance | Single consumer offset per instance; rebuild is disposable | Lag/staleness shown; no authority conflict |

Dependency scheduling is deterministic: a unit becomes `READY` only when all `depends_on` units have verdicts satisfying the declared dependency rule. Parallelism is bounded by both the run policy and resource-specific ceilings. A cancellation or pause revokes future work first, then fences active effects, then changes lifecycle status.

## 13. Budget and latency proportionality

Budgets are multi-dimensional, reserved before work, and debited from signed receipts. Required fields are reasoning, execution, verification, and repair tokens; wall time; monetary minor units; write, destructive, and external-call effect units; maximum parallel units; maximum attempts; and deadline.

Hard ceilings stop new authority grants. Soft thresholds trigger a forecast event and, where useful, a cheaper policy. The kernel never treats a soft threshold as permission to weaken claim acceptance.

At each decision boundary, the Transition Kernel's deterministic scheduling function uses a policy-defined utility estimate:

```text
expected_net_value =
    probability_of_material_outcome_gain * outcome_value
  + operator_time_saved_value
  + recoverability_gain_value
  - token_cost
  - latency_cost
  - monetary_cost
  - added_effect_risk
```

This estimate selects among already authorized actions; it cannot override a hard invariant. Estimates and actuals are retained so calibration can become a learning candidate. Verification always reserves enough budget before execution starts, preventing work from consuming all resources before its claims can be checked.

Latency policy distinguishes:

- `interactive_deadline`: time to next useful operator-visible response;
- `decision_deadline`: time available for clarification or deliberation;
- `unit_deadline`: lease and execution time;
- `evidence_deadline`: maximum evidence freshness and collection wait;
- `run_deadline`: overall outcome horizon.

Remote views show both elapsed time and the next deadline, not a generic running indicator.

## 14. Human approvals

An approval is a signed envelope over a precise decision, not a conversational inference. Required fields are approval ID, principal and role, decision type, subject hash, risk-summary ref, allowed transition, constraints, validity interval, single-use flag, revocation rule, and signature.

Default approval points include:

- Acceptance or amendment of high-risk outcome contracts.
- Expansion of effect scope, sensitive-resource access, or destructive effects.
- Consequential decisions with unresolved material disagreement.
- Additional budget above the accepted ceiling.
- Repair that changes external behavior beyond the prior attempt's allowed delta.
- Canary or promotion of policy affecting high-risk decisions.
- Rollback whose compensation itself has material irreversible effects.

Approval validity is checked at transition time. A changed subject hash, expired identity, revoked role, newer conflicting mandate, or altered risk summary invalidates the approval. Refusal and timeout are durable outcomes with their own reason codes.

## 15. Remote observability and off-machine comprehension

The Operations Projector emits a renderer-independent `RunView` with run ID; source revision and projection version; generated time, journal head, lag, and `FRESH|STALE|DEGRADED` state; objective and contract version; run and unit statuses, leases, and deadlines; satisfied, failed, and pending claims; blockers and approvals; spent, reserved, and remaining budgets; recent decisions; evidence health; disclosure/omission manifest; last safe revision, next eligible transitions, and handoff ref; and verified-prefix revision plus projection hash.

Any text UI, web UI, command-line view, notification service, or remote client can render this schema. A remote client can acknowledge alerts or submit an authenticated approval through the Intent Gateway, but it cannot mutate the projection or journal directly.

Minimum remote alerts are: approval required, blocked, budget threshold, lease/effect uncertainty, evidence deadline, integrity failure, rollback failure, and terminal verdict. Each alert carries the run ID, authoritative revision, severity, subject, evidence refs, permissible responses, and expiry.

Secrets and sensitive evidence are referenced, not embedded. The projector applies field-level disclosure policy and records redaction. A redacted view must distinguish “present but undisclosed” from “missing.”

## 16. Rollback and compensation

Rollback restores protected invariants; it is not assumed to recreate a perfect prior world. Each effect class declares one of:

- `REVERSIBLE`: an inverse operation can be independently verified.
- `COMPENSATABLE`: no inverse exists, but a compensating action can restore the protected business or technical invariant.
- `IRREVERSIBLE`: no safe compensation is known; approval is required before the original effect.
- `UNKNOWN`: treated as irreversible until classified.

The accepted contract lists rollback expectations per work unit. The execution receipt supplies the realized effect inventory. A rollback plan orders compensation according to dependencies, obtains a separate grant, and produces evidence against rollback claims such as resource restoration, version restoration, data reconciliation, or external notification.

Rollback rules:

1. Do not declare rollback complete from action exit alone; verify the compensation claims.
2. Never delete the evidence of the failed attempt or its effects.
3. A rollback can have its own repair only if explicitly allowed and bounded.
4. Irreversible residual effects remain listed in the terminal handoff packet.
5. Policy and contract rollback select prior immutable versions; they do not edit history.

## 17. Normative invariants

An implementation is conformant only if it continuously enforces these invariants:

1. **Single authority spine:** every authoritative status, lease, approval consumption, budget debit, and policy activation is derivable from the verified journal.
2. **No model transition writes:** no model-owned component can append a `TransitionEvent` or modify an authoritative aggregate directly.
3. **Revision safety:** every transition compares the producer's revision with the current aggregate revision.
4. **Idempotent intent:** one replay key cannot create more than one logical transition or external effect.
5. **One active unit lease:** at most one unexpired effect-bearing lease exists for a unit.
6. **Least authority:** every attempted effect is inside the accepted contract, work unit, capability grant, remaining budget, and approval constraints.
7. **Contract immutability:** accepted claims and acceptance rules change only through a versioned amendment; failed work cannot weaken them.
8. **Evidence before satisfaction:** every satisfied critical claim has a signed verdict and the required available evidence.
9. **Verifier independence:** the principal responsible for the attempt does not sign its final verdict.
10. **Bounded repair:** every repair names failed claims, allowed deltas, new evidence duties, attempt ceiling, and budget.
11. **No observation promotion:** observations cannot activate policy without evaluation, admission, and required approval.
12. **Recoverable authority:** a fresh process can reconstruct all non-secret authority-bearing status without conversational memory.
13. **Explicit uncertainty:** unknown external effects, missing mandatory evidence, and unresolved critical disagreement cannot be represented as success.
14. **Reserved assurance:** accepted work reserves enough budget for required evidence collection and verification.
15. **Projection honesty:** every operator view declares its source revision, freshness, omissions, and integrity position.
16. **Rollback evidence:** rollback completion requires an independent verdict over compensation claims.

## Comparison Appendix

This appendix was added only after the prescribed pre-comparison scan returned `PASS clean-sheet anchoring boundary`. Current-system claims use the audit labels `OBSERVED`, `CONFIGURED`, `DOCUMENTED`, and `INFERRED`; target claims use `RECOMMENDED`. Evidence references point to the [frontier evidence index](./2026-07-13-sgsd-frontier-architecture-evidence-index.md) and the [skills and routing analysis](./2026-07-13-sgsd-audit-skills-routing.md). A configured path is not treated as proof of recent use.

### A. Responsibility mapping

| Current concept and evidence | Clean-sheet responsibility | Fit, excess, and gap | Migration and future amendment |
|---|---|---|---|
| **Control, routes, and deliberation.** **DOCUMENTED:** `CLAUDE.md` assigns orchestration, triggers, checkpoints, and exits (SRC-003). **CONFIGURED:** autonomous, deliberate, pause, and resume paths exist (SRC-020, SRC-022, SRC-025, SRC-026). **OBSERVED:** the decision registry is empty (SRC-044), and the routing analysis finds conflicting deliberation ownership. | **RECOMMENDED:** Intent Gateway, Contract Compiler, Deliberation Cell, and Transition Kernel; all operating behavior is policy over one lifecycle. | **INFERRED fit:** role separation and adversarial perspectives are valuable. **INFERRED excess/gap:** precedence and roster ownership repeat in prose, while decisions lack typed consumption. | **RECOMMENDED:** add a versioned route policy, one roster authority, typed proposals, and a decision record bound into the contract. Shadow current results before activation. **RECOMMENDED future amendment:** remove prose precedence only after fixture parity. |
| **Intent, context, and bounded execution.** **OBSERVED:** tested intent and context builders emit closed-vocabulary intent and role-specific packets (SRC-054, SRC-055, SRC-080, SRC-081); execution wrappers bound invocation and logging (SRC-056–SRC-059). **CONFIGURED:** handovers and profiles declare budgets, evidence, isolation, hooks, and change limits (SRC-045, SRC-047). | **RECOMMENDED:** retain these mechanics behind `IntentEnvelope`, `ContextBundle`, `AssignmentEnvelope`, `CapabilityGrant`, and `ExecutionReceipt`. | **INFERRED fit:** this is a strong migration base. **OBSERVED gap:** intent classification follows work selection. **INFERRED gap:** a profile is not an expiring effect grant, and wrapper success is not an outcome verdict. | **RECOMMENDED:** adapt rather than replace; add revisions, omissions, leases, enforced effects, and idempotent receipts. **RECOMMENDED future amendment:** keep provider details below the authority protocol and tune context from outcome data. |
| **Assurance.** **CONFIGURED:** the gate registry declares triggers, evidence, enforcement, and escalation (SRC-043). **OBSERVED:** loaders, transition guards, a browser-evidence verifier, and normalized value rows execute (SRC-062–SRC-065). | **RECOMMENDED:** Evidence Recorder and Independent Verifier emit claim-level verdicts consumed by the kernel and Repair Composer. | **INFERRED fit:** current checks protect useful decisions. **INFERRED excess/gap:** result shapes differ, and the sampled verifier's stated boundary does not prove every acceptance property. | **RECOMMENDED:** keep each gate as a method; adapt it to claim, evidence, independence, and verdict schemas. Never bypass or duplicate it. **RECOMMENDED future amendment:** retire only with equal-or-stronger evidence and regression proof. |
| **Truth, recovery, and operator views.** **OBSERVED:** planning truth expresses position but the census records missing or stale signals (SRC-004–SRC-006); a 12-section degraded-aware adapter, sidecar, read-only and approval-controlled MCPs, liveness detector, and remote entry exist (SRC-069–SRC-075). **CONFIGURED:** checkpoint recovery exists (SRC-025, SRC-026, SRC-079). | **RECOMMENDED:** Durable Journal, replay snapshots, Operations Projector, signed approvals, and handoff packets. | **INFERRED fit:** checkpoints, read/write separation, degraded views, and remote entry are strong assets. **OBSERVED gap:** one review covers only 10 of 12 adapter sections; mutable sources can conflict. | **RECOMMENDED:** shadow typed events beside current writes, block on divergence, then derive documents and one `RunView` from replay. **RECOMMENDED future amendment:** snapshots accelerate but never replace journal authority. |
| **Memory and learning.** **OBSERVED:** deterministic memory admission, revocation, revalidation, lineage, and evidence validation exist (SRC-066–SRC-068, SRC-084). **OBSERVED:** no recent ledger proves curated learning changed a route. | **RECOMMENDED:** Learning Admission Controller feeds a distinct Policy Catalog path through evaluation, approval, canary, and reversion. | **INFERRED fit:** admission and lineage closely fit the trust boundary. **INFERRED gap:** knowledge promotion is not policy authority, and consumption is unproven. | **RECOMMENDED:** retain memory governance; admitted records may only create learning candidates. **RECOMMENDED future amendment:** enable policy influence only after contamination, rollback, and counterfactual tests. |
| **Registries, routing, and concurrency.** **CONFIGURED:** registries define agents, gates, commands, profiles, reviews, hooks, and protected components (SRC-041, SRC-043, SRC-046–SRC-051). **OBSERVED:** deterministic provider routing exists (SRC-052, SRC-059, SRC-061). **INFERRED:** plan-level parallel settings are inert or stale. | **RECOMMENDED:** Policy Catalog and version-pinned kernel scheduling with one writer per aggregate, parallel readers, and isolated writers only under ownership and merge revalidation. | **INFERRED fit:** registries and resolvers form a sound base. **OBSERVED/INFERRED gap:** control precedence remains prose-owned and unconsumed settings create false affordances. | **RECOMMENDED:** classify every key as enforced, display-only, migration-only, or rejected; pin active versions in events. **RECOMMENDED future amendment:** expand writer concurrency only after conflict and replay proofs. |
| **Cost evidence.** **CONFIGURED:** token and status skills group spend and anomalies (SRC-014, SRC-015, SRC-029). **OBSERVED absence:** no live metrics directory establishes recent route, cost, gate, or provider use (SRC-012). | **RECOMMENDED:** event-linked budget, time, token, outcome, repair, and recovery measures, with diagnostics as projections. | **INFERRED fit:** the concerns are correct. **OBSERVED/INFERRED gap:** emit configuration does not prove measurement, and overlapping views may diverge. | **RECOMMENDED:** use one measurement schema and degrade honestly. **RECOMMENDED future amendment:** change budgets only through admitted, outcome-aware learning. |

### B. Migration posture

**RECOMMENDED:** the mapping does not justify a wholesale rewrite:

1. **RECOMMENDED:** standardize envelopes and add the journal/kernel in shadow while current entry points remain authoritative.
2. **RECOMMENDED:** adapt current context, executor, assurance, cockpit, and remote boundaries; activate routes, leases, approvals, budgets, and verdict consumption only after parity, replay, interruption, and comprehension tests.
3. **RECOMMENDED:** connect learning to policy last, through evaluation and canary admission; observations remain non-authoritative.

### C. Unresolved comparison uncertainty

- **OBSERVED:** absent live metrics prevent claims about recent frequency, provider compliance, cost, gate value, or outcome impact (SRC-012).
- **INFERRED:** sources and tests do not establish sustained concurrent reliability or the correct journal partition design.
- **RECOMMENDED:** resolve both with measurement and failure injection before reprioritizing migration.
