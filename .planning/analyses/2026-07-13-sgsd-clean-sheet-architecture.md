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
| `SAFETY_FENCE` | Signed negative authority from the independent integrity boundary | Denial of new effects, grant fencing, and declaration of the last verified journal prefix | Lifecycle progress, approval, policy mutation, or any positive effect authority |
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
aggregate_type: RUN | UNIT | JOURNAL_GENERATION | SAFETY_DOMAIN
aggregate_id: uuid
run_id: uuid|null
unit_id: uuid|null
journal_id: uuid|null
journal_generation: integer|null
journal_generation_id: uuid|null
safety_domain_id: uuid
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
canonicalization_profile: jcs-rfc8785-v1
crypto_policy_version: semver
payload_hash:
  profile: sha-256-v1
  value: lowercase-hex-64
signature:
  key_id: string
  profile: ed25519-jcs-sha256-v1
  value: string
```

Rules:

- `RUN` uses `aggregate_id=run_id`, `unit_id=null`, and a non-null journal/generation/domain. `UNIT` uses `aggregate_id=unit_id`, an immutable parent `run_id`, and the parent's journal/generation/domain.
- `JOURNAL_GENERATION` uses `aggregate_id=journal_generation_id`, null run/unit IDs, and non-null journal/generation/domain. `SAFETY_DOMAIN` uses `aggregate_id=safety_domain_id`, null run/unit/generation IDs, and carries affected journal generations in its payload. Only `RUN` and `UNIT` accept lifecycle transitions.
- Journal topology is pinned as `PER_RUN` or `GLOBAL`. A per-run generation contains exactly one run and its units; its integrity fence affects that run. A global generation contains a closed indexed run set; the complete sorted run-ID set and its hash define the generation scope, and a journal-integrity fence affects every run/unit in that set. A safety-domain record may span generations but has negative authority only, and lists every affected generation and complete run set/hash.
- `TransitionRequest` and `TransitionEvent` require `RUN` or `UNIT`. `JournalContinuationEvent` requires `JOURNAL_GENERATION`; its header revision is generation-local revision `0`. `SafetyFenceRecord` requires `SAFETY_DOMAIN`; its header revision is the monotonic safety-domain record revision. A consumer rejects any payload/header type disagreement.
- `authoritative_revision` is scope-local, never a universal journal revision: for `RUN` or `UNIT` it is that aggregate's revision; for `JOURNAL_GENERATION` it is the generation-local journal revision; for `SAFETY_DOMAIN` it is the safety-domain record revision. A producer built from an older revision in its own scope is rejected or explicitly rebased; it is never silently accepted.
- `replay_key` identifies the intended logical effect within a typed scope. `RUN` and `UNIT` envelopes use `aggregate_ref{type,id}`; `JOURNAL_GENERATION` and `SAFETY_DOMAIN` envelopes use `control_subject_ref{type,id,hash}`. Repeating the same scope/key and payload is idempotent; repeating that scope/key with a different payload is a conflict.
- For `TransitionRequest`, payload `from_revision` and `idempotency_key` must equal header `authoritative_revision` and `replay_key`; any disagreement invalidates the envelope.
- `jcs-rfc8785-v1` means RFC 8785 JSON Canonicalization Scheme encoded as UTF-8 without a byte-order mark. Signed schemas allow only JCS-representable values; timestamps are UTC RFC 3339 with `Z`, UUIDs and hexadecimal text are lowercase, and array order is significant.
- `sha-256-v1` is `SHA-256(UTF8(JCS(payload)))`. `ed25519-jcs-sha256-v1` signs `UTF8("frontier-envelope/v1" + U+0000) || UTF8(JCS(header_without_signature.value))`; that header includes the payload-hash object, key ID, signature profile, authority class, aggregate identity, and crypto-policy version.
- Journal profile `sha256-jcs-event-v1` calculates `SHA-256(UTF8("frontier-journal-event/v1" + U+0000) || previous_event_hash_raw32 || UTF8(JCS(event_payload_without_event_hash)))`. Genesis uses 32 zero bytes. Event payloads include journal ID, journal generation, revision, and their declared profile.
- Canonicalization and event-hash profiles are fixed for one journal generation. A profile change starts a new generation with a recovery/continuation event referencing the last verified hash and both profiles. Signature keys may rotate through a signed key event. Unknown, revoked-at-production, or policy-disallowed profiles/keys are rejected; old readers remain available for replay.
- Expired envelopes can remain as evidence but cannot grant authority.
- Schema evolution is additive within a major version. A major-version change requires a migration reader and a replay test before admission.

### 4.2 Payload schemas

| Schema | Required payload fields | Producer | Consumer and effect |
|---|---|---|---|
| `IntentEnvelope` | `objective`, `constraints[]`, `non_goals[]`, `risk_tolerance`, `success_signals[]`, `requested_scope`, `time_horizon`, `operator_questions[]`, `source_refs[]` | Intent Gateway | Contract Compiler interprets; no lifecycle authority by itself |
| `OutcomeContract` | `contract_id`, `intent_ref`, `claims[]`, `invariants[]`, `work_units[]{min_items=1}`, `allowed_effect_classes[]`, `forbidden_effects[]`, `risk_class`, `budget`, `approval_points[]`, `rollback_expectations[]`, `open_assumptions[]` | Contract Compiler | Kernel rejects a zero-unit contract; every accepted run has at least one executable or verification-only unit |
| `ContractClaim` | `claim_id`, `statement`, `verification_method`, `evidence_requirements[]`, `acceptance_rule`, `criticality`, `repair_policy`, `owner` | Contract Compiler | Verifier evaluates; kernel calculates aggregate acceptance |
| `WorkUnit` | `unit_id`, `purpose`, `depends_on[]`, `claims_served[]`, `input_refs[]`, `expected_outputs[]`, `effect_scope`, `completion_boundary`, `budget_slice`, `rollback_ref` | Contract Compiler | Context Projector and kernel schedule bounded work |
| `DecisionFactorSet` | `factor_set_id`, `decision_kind`, `subject_refs[]`, `factor_schema_version`, `factors[]{factor_id,value,unit,uncertainty_interval,provenance_kind,producer_ref,evidence_refs[],observed_at,fresh_until}`, `judgment_provenance|null` | Contract Compiler, Evidence Recorder, or Deliberation Cell | Kernel validates a closed factor schema; never grants authority by itself |
| `DeliberationRequest` | `decision_id`, `factor_set_ref`, `question`, `decision_options[]`, `uncertainties[]`, `perspective_specs[]`, `cost_ceiling`, `deadline` | Contract Compiler or kernel | Deliberation Cell returns proposals without transition authority |
| `DecisionProposal` | `decision_id`, `perspective_id`, `recommendation`, `premises[]`, `evidence_refs[]`, `uncertainties[]`, `failure_modes[]`, `confidence`, `dissent[]`, `tokens_used`, `elapsed_ms`, `judgment_provenance` | Deliberation Cell | Compiler synthesizes; operator or policy chooses where required |
| `DecisionRecord` | `decision_id`, `options_considered[]`, `selected_option`, `reason_codes[]`, `proposal_refs[]`, `dissent_retained[]`, `decider`, `revisit_trigger` | Kernel after valid selection | Durable explanation for downstream planning and later review |
| `ContextBundle` | `unit_ref`, `contract_slice`, `dependency_outputs[]`, `relevant_decisions[]`, `resource_descriptors[]`, `tool_contracts[]`, `evidence_duties[]`, `exclusions[]`, `context_hash`, `omission_manifest[]` | Context Projector | Executor receives only material required for its unit |
| `CapabilityGrant` | `grant_id`, `principal_id`, `unit_ref`, `allowed_actions[]`, `resource_selectors[]`, `denied_actions[]`, `effect_ceiling`, `token_ceiling`, `wall_time_ceiling_ms`, `concurrency_ceiling`, `valid_from`, `valid_until`, `revocation_ref` | Authority Broker after kernel approval | Effect adapters enforce; executor cannot widen it |
| `AssignmentEnvelope` | `assignment_id`, `unit_ref`, `context_ref`, `grant_ref`, `expected_receipts[]`, `heartbeat_interval_ms`, `lease_until`, `attempt`, `return_endpoint` | Kernel and Authority Broker | Executor performs one bounded unit under one lease |
| `ExecutionReceipt` | `assignment_ref`, `attempt`, `start_revision`, `end_time`, `actions[]`, `outputs[]`, `effect_receipts[]`, `resource_usage`, `warnings[]`, `exit_class`, `executor_attestation` | Executor and effect adapters | Evidence Recorder validates provenance and completeness |
| `EvidenceItem` | `evidence_id`, `claim_refs[]`, `kind`, `locator`, `content_hash`, `producer`, `collection_method`, `environment`, `observed_at`, `fresh_until`, `tamper_proof`, `redaction`, `availability` | Evidence Recorder | Verifier reads evidence without trusting executor narration |
| `EvidenceBundle` | `bundle_id`, `contract_ref`, `aggregate_ref{type,id}`, `unit_ref|null`, `child_bundle_refs[]`, `items[]`, `coverage[]{claim_ref,requirement_ref,local_evidence_refs[],child_coverage_refs[]}`, `missing_requirements[]`, `bundle_hash`, `sealed_at` | Evidence Recorder | Verifier accepts only sealed, provenance-valid aggregate bundles |
| `VerificationVerdict` | `verdict_id`, `claim_results[]`, `aggregate`, `evidence_refs[]`, `method_versions[]`, `independence_attestation`, `uncertainties[]`, `failure_class`, `repairability`, `verifier_signature` | Independent Verifier | Kernel transitions to satisfied, repairable, or blocked |
| `FailureEnvelope` | `failure_id`, `class`, `severity`, `scope`, `detected_at_revision`, `supporting_refs[]`, `effect_uncertainty`, `retry_eligibility`, `next_safe_actions[]`, `owner`, `blocker_conditions[]`, `resume_target{aggregate_type,aggregate_id,status}` | Detecting component | Kernel may consume it only through a guarded blocking transition |
| `RepairOrder` | `repair_id`, `failed_claims[]`, `failure_class`, `allowed_changes[]`, `forbidden_changes[]`, `required_context_delta[]`, `required_new_evidence[]`, `attempt_ceiling`, `budget_slice`, `approval_requirement`, `stop_conditions[]` | Repair Composer; kernel validates | Context Projector creates a new bounded unit attempt |
| `LearningCandidate` | `candidate_id`, `observation_refs[]`, `hypothesis`, `target_decision`, `proposed_change`, `expected_benefit`, `known_risks[]`, `confounders[]`, `evaluation_plan`, `data_class` | Learning Admission Controller | Evaluation queue only; it has no policy-write authority |
| `PolicyChangeProposal` | `proposal_id`, `candidate_ref`, `policy_key`, `current_version`, `proposed_version`, `evaluation_results[]`, `safety_argument`, `approval_requirement`, `canary_plan`, `rollback_rule` | Learning Admission Controller | Policy may waive approval for an already authorized low-risk path; when approval is required, only a human `HUMAN_MANDATE` may issue it |
| `ApprovalEnvelope` | `approval_id`, `approval_version`, `supersedes_approval_ref|null`, `subject{aggregate_ref|null,control_subject_ref|null,kind,ref,hash,revision,decision_type,recovery_subject|null}`, `decision`, `scope`, `constraints[]`, `issuer`, `single_use`, `max_consumptions` plus common time/replay/signature fields | Authenticated human principal with `HUMAN_MANDATE` | Kernel validates and consumes lifecycle approvals atomically with a transition and recovery approval atomically with continuation genesis; issue/expiry/revocation times are derived as defined in §14 |
| `TransitionRequest` | `aggregate_ref{aggregate_type,aggregate_id,run_id}`, `from_revision`, `from_status`, `to_status`, `reason_code`, `supporting_refs[]`, `requested_by`, `idempotency_key` | Any authorized component | Kernel validates all guards; a request never changes status directly |
| `TransitionEvent` | `journal_id`, `journal_generation`, `revision`, `aggregate_ref`, `prior_status`, `new_status`, `reason_code`, `supporting_refs[]`, `decision_input_refs[]`, `policy_version`, `budget_delta`, `lease_delta`, `previous_event_hash`, `event_hash_profile`, `event_hash` | Transition Kernel | Journal stores; all projections consume |
| `JournalContinuationEvent` | `control_subject_ref{type=JOURNAL_GENERATION,id,hash}`, `old{journal_id,generation,generation_id,last_good_revision,last_good_hash,canonicalization_profile,event_hash_profile,signature_profile,crypto_policy_version}`, `new{journal_id,generation,generation_id,canonicalization_profile,event_hash_profile,signature_profile,crypto_policy_version}`, `topology`, `affected_run_ids[]`, `affected_run_set_hash`, `generation_local_revision=0`, `previous_event_hash=zero64`, `event_hash_profile`, `event_hash`, `recovery_source_hash`, `quarantined_tail_hashes[]`, `fence_ref`, `recovery_approval_ref`, `recovery_approval_consumption`, `aggregate_hash` | Recovery kernel under human approval | `JOURNAL_GENERATION` genesis record links new authority to the verified prior prefix |
| `RecoverySnapshot` | `snapshot_revision`, `aggregate_hash`, `active_entities[]`, `open_leases[]`, `budget_balances[]`, `pending_approvals[]`, `policy_versions[]`, `journal_prefix_hash` | Durable Journal replay service | Recovery accelerates replay but is never trusted beyond its verified prefix |
| `SafetyFenceRecord` | `control_subject_ref{type=SAFETY_DOMAIN,id,hash}`, `fence_id`, `state`, `topology`, `affected_journal_generations[]`, `affected_run_ids[]`, `affected_run_set_hash`, `detected_at`, `last_good_refs[]`, `reason_code`, `grant_epoch`, `revoked_grant_refs[]`, `adapter_ack_refs[]`, `recovery_generation_refs[]`, `predecessor_fence_ref|null` | Safety Fence Service under `SAFETY_DOMAIN` identity | Effect adapters deny under `ACTIVE`; a `CLEARED` successor cannot grant positive authority |

An `EvidenceBundle` is sealed for exactly one aggregate, and its `aggregate_ref.type/id` must equal the common header's aggregate type/ID. A `UNIT` bundle has `unit_ref=aggregate_ref.id`, an empty `child_bundle_refs[]`, and coverage entries that map every unit-served claim requirement to its own `items[]`. A `RUN` bundle has `unit_ref=null`; its `items[]` cover only run-level requirements, while `child_bundle_refs[]` identify the exact sealed unit bundle IDs and hashes required by the accepted contract. Run coverage may point to local items or to `{child_bundle_ref,claim_ref,requirement_ref}` entries in those child bundles. The recorder and verifier reject a missing, duplicate, foreign-contract, stale-hash, or non-required child reference. The run `bundle_hash` covers the ordered child references and coverage map, so run verification spans run-level and required child claims without copying child evidence.

The schemas intentionally separate an executor's receipt, a recorder's evidence, and a verifier's verdict. They can refer to one another, but none can impersonate another's authority.

## 5. Component contracts

The table below is the normative boundary map. “Model-owned” means judgment is expected and its product remains a proposal. “Deterministic” means identical validated input and policy version must produce the same decision.

| Component | Responsibility | Input schema | Output schema | Authority and mechanism | Failure state | Required evidence | Downstream consumer |
|---|---|---|---|---|---|---|---|
| **Intent Gateway** | Authenticate the operator, capture intent faithfully, preserve source material, and identify missing mandatory fields without solving the problem | Human/API request, identity proof | `IntentEnvelope` | Deterministic validation plus human-owned meaning; cannot infer approval | `CLARIFICATION_REQUIRED` for missing or contradictory mandate; `BLOCKED` for failed authentication | Source hashes, identity result, normalization warnings | Contract Compiler; Operations Projector |
| **Contract Compiler** | Convert intent into claims, at least one work unit, risks, approvals, budgets, rollback expectations, and proposed decision factors | `IntentEnvelope`, policy slice, optional `DecisionRecord` | `OutcomeContract`, `DecisionFactorSet`, `DeliberationRequest`, clarification questions | Model-owned synthesis; deterministic schema/policy validation; no transition authority | Zero-unit or otherwise invalid contracts cannot reach `CONTRACTED`; bounded regeneration then clarification/blocking policy applies | Signed input/prompt refs, assumptions, unit-to-claim coverage, factor provenance, policy version, validation results | Operator, Deliberation Cell, Transition Kernel |
| **Deliberation Cell** | Produce independent perspectives, factor proposals, and synthesis for consequential ambiguous decisions | `DeliberationRequest`, factor/evidence refs, budget grant | Signed `DecisionProposal[]`, `DecisionFactorSet`, synthesis proposal | Model-owned; perspectives have isolated contexts where practical; cannot select | Remains `DELIBERATING` while useful work is possible; `APPROVAL_REQUIRED` for unresolved high-stakes disagreement; `BLOCKED` at cost/deadline ceiling | Per-perspective provenance, premises, evidence refs, dissent, usage and time | Contract Compiler, operator, Transition Kernel |
| **Transition Kernel** | Select eligible work deterministically; validate aggregate guards, revisions, factors, approvals, budgets, leases, transitions, and invariants | `TransitionRequest`, ready-unit projection, `DecisionFactorSet`, `ApprovalEnvelope`, referenced envelopes, pinned policy, scope-local authoritative revision | `AssignmentEnvelope`, `TransitionEvent`, approval-consumption ref, or typed rejection | Sole deterministic lifecycle writer and scheduling function; no creative authority | Status remains unchanged; an active safety fence disables commits and positive authority | Eligibility/guard/factor trace, policy version, approval result, conflict revision, commit hash | Every component through journal projections |
| **Durable Journal** | Persist ordered, hash-linked events and sealed envelopes; replay aggregates and create verified snapshots | `TransitionEvent`, immutable blobs, snapshot revision request | Commit receipt, event stream, verified prefix, `RecoverySnapshot` | Deterministic storage and replay; single logical append authority; cannot interpret meaning | No receipt means no transition; integrity failure freezes authority at the last verified prefix and requests an external safety fence | Commit/replica receipts, chain/profile and snapshot hashes, integrity scans | Kernel, Safety Fence Service, recovery process, Operations Projector, auditors |
| **Safety Fence Service** | Independently deny new effects when journal integrity is unknown and attest last-good-prefix recovery | Integrity failure, journal identity/profile, last verified prefix, open grants, adapter endpoints | Signed `SafetyFenceRecord`, revocation notices, immutable clearance successor | Deterministic negative authority only; separate key/store from the journal; cannot commit lifecycle status or clear itself | Unknown fence state fails closed at effect adapters; failed clearance leaves `ACTIVE` | Integrity proof, prefix hash, revoked grants, adapter acknowledgements, recovery approval and continuation ref | Effect adapters, Transition Kernel, Operations Projector, recovery operator |
| **Context Projector** | Produce the smallest context sufficient for one unit while declaring omissions | Accepted contract, unit, dependency results, decisions, policy | `ContextBundle` | Deterministic selection where rules suffice; model-owned compression allowed but must preserve refs and exclusions | Unit remains `READY`; `BLOCKED` if required context is unavailable or too large after bounded compression | Inclusion reasons, omission manifest, source hashes, size and token estimate | Authority Broker, Executor, Repair Composer |
| **Authority Broker** | Derive and issue least-privilege, expiring grants and revoke them on lifecycle changes | Work unit, `ContextBundle`, risk and effect policy, budget balance | `CapabilityGrant`, revocation event request | Deterministic policy evaluation; cannot grant an undeclared effect | Unit remains `READY`; `APPROVAL_REQUIRED` for policy-listed effects; `BLOCKED` if safe scoping is impossible | Policy decision log, resource selectors, limits, approval ref | Executor and effect adapters; Transition Kernel |
| **Executor Pool** | Perform one assigned work unit and report actions, effects, outputs, and consumption | `AssignmentEnvelope`, `ContextBundle`, `CapabilityGrant` | `ExecutionReceipt`, output refs, heartbeat observations | Model-owned or deterministic worker; effect authority exists only through enforced grant | `EVIDENCE_PENDING` on ordinary completion; `REPAIRABLE` or `BLOCKED` only after verdict; lease expiry stops effects | Tool/effect receipts, output hashes, resource use, exit class, executor attestation | Evidence Recorder; Operations Projector |
| **Effect Adapter** | Enforce grants and external safety fences, fence leases, make idempotent effects, reconcile uncertainty, and issue receipts | Effect request, `CapabilityGrant`, lease, latest `SafetyFenceRecord`, resource version, effect key | Effect result/denial, receipt, reconciliation result, revocation acknowledgement | Deterministic enforcement; sole writer for its resource class; no model judgment | Deny if grant/fence state is invalid or unknown; uncertain result fences the resource | Grant/lease/fence decision, before/after versions, effect key, provider receipt, reconciliation proof | Executor, Evidence Recorder, Transition Kernel, rollback work |
| **Evidence Recorder** | Collect, normalize, hash, seal, and retain independent evidence for each contract claim; compose run coverage from sealed child-bundle references | Contract evidence duties, execution outputs, environment observations, sealed child bundles | `EvidenceItem[]`, aggregate-specific `EvidenceBundle` | Deterministic provenance and completeness checks; collection adapters may execute read-only probes; child evidence is referenced, not copied | Unit remains `EVIDENCE_PENDING` while within its evidence deadline; run verification cannot start if required run/child coverage is incomplete | Collector versions, hashes, timestamps, environment identity, child-bundle set/hash, missing-requirement list | Independent Verifier, Operations Projector |
| **Independent Verifier** | Evaluate every unit or run claim against declared acceptance rules using its sealed aggregate bundle, without inheriting executor conclusions | `OutcomeContract`, aggregate-specific `EvidenceBundle`, verifier policy | `VerificationVerdict` | Deterministic checks where possible; model judgment allowed for semantic claims but can only emit a signed verdict | `SATISFIED`, `REPAIRABLE`, or `BLOCKED` proposed according to typed result; kernel commits | Per-claim result, local/child evidence refs, method versions, independence attestation, uncertainties | Transition Kernel, Repair Composer, operator |
| **Repair Composer** | Convert failed claims into the narrowest safe next attempt with explicit change and stop bounds | Failing `VerificationVerdict`, prior unit/receipt/context, repair policy | `RepairOrder` | Model-owned diagnosis; deterministic validation of attempt, scope, budget, and approval limits | `APPROVAL_REQUIRED` when repair expands risk; `BLOCKED` when failure is non-repairable or limits are spent | Failure classification, causal evidence refs, proposed delta, remaining limits | Transition Kernel, Context Projector, operator |
| **Learning Admission Controller** | Turn repeated observations into testable policy proposals, evaluate them, and control canary promotion or reversion | Observation refs, verdict history, resource outcomes, operator feedback | `LearningCandidate`, `PolicyChangeProposal`, evaluation record | Model-owned hypothesis generation; deterministic admission thresholds plus human approval for high-risk policy | Candidate remains non-authoritative as `REJECTED`, `MORE_EVIDENCE_REQUIRED`, or `CANARY_PENDING` | Dataset lineage, evaluation results, confounders, safety argument, approval ref | Policy Catalog, operator, auditors |
| **Policy Catalog** | Version lifecycle guards, budgets, capability rules, reasoning triggers, approval rules, and schema support | Approved policy proposal or explicit human mandate | Immutable policy version, activation event request, prior-version pointer | Deterministic, versioned reads; writes require admitted authority; every run pins versions | Current version remains active on failed admission; invalid catalog enters read-only `BLOCKED` operation | Signed policy blob, approval/evaluation refs, activation and rollback records | Transition Kernel and all policy consumers |
| **Operations Projector** | Build local and remote views from journal events, fence records, and evidence availability | Verified event prefix, latest `SafetyFenceRecord`, immutable envelope metadata, projection schema | Run summary/progress, timelines, alerts, handoff packet, authority-health/freshness signals | Deterministic projection; strictly read-only | Shows `STALE`, `DEGRADED`, or `FENCED` and never invents status beyond the verified prefix | Last consumed/verified revisions, fence ref, projection version, lag, missing refs | Operator, remote clients, recovery process |

### 5.1 Component independence requirements

The execution principal cannot sign its final verdict; reused probes must be rerun or independently validated. Model-owned components never receive the journal credential, raw learning observations cannot activate policy, and grant revocation reaches effect adapters without executor cooperation. Projection failure stops work only when explicit risk policy requires remote visibility.

## 6. One lifecycle, selected by policy

Runs and units use one transition protocol and vocabulary but are distinct aggregates. Every authoritative request/event targets an `AggregateRef {aggregate_type, aggregate_id, run_id}`; the kernel rejects a header whose aggregate identity differs from that ref.

### 6.1 Aggregate contract

| Property | `RUN` aggregate | `UNIT` aggregate |
|---|---|---|
| Identity | `aggregate_id=run_id`; no parent and `unit_id=null` | `aggregate_id=unit_id`; exactly one immutable parent `run_id` |
| Owns | Operator mandate, contract/policy versions, total budget, run approvals, control action, aggregate verdict | Work purpose, dependencies, context/grant/lease, attempt budget, receipts, evidence, unit verdict |
| Legal status subset | `RECEIVED`, `CLARIFICATION_REQUIRED`, `DELIBERATING`, `CONTRACTED`, `APPROVAL_REQUIRED`, `READY`, `EXECUTING`, `VERIFYING`, `SATISFIED`, `REPAIRABLE`, `BLOCKED`, `PAUSED`, `ROLLING_BACK`, `ROLLED_BACK`, `CANCELLED` | `CONTRACTED`, `APPROVAL_REQUIRED`, `READY`, `LEASED`, `EXECUTING`, `EVIDENCE_PENDING`, `VERIFYING`, `SATISFIED`, `REPAIRABLE`, `BLOCKED`, `PAUSED`, `ROLLING_BACK`, `ROLLED_BACK`, `CANCELLED` |
| Authoritative lifecycle | `RUN.status` is committed only by run-targeted events and never inferred merely from one child | `UNIT.status` is committed only by unit-targeted events |
| Derived projection | `run_progress` is recomputed from the non-empty child set as `WAITING`, `ACTIVE`, `COLLECTING_EVIDENCE`, `VERIFYING`, `HAS_REPAIR`, `HAS_BLOCKER`, or `ALL_REQUIRED_UNITS_SATISFIED`; it is not transition authority | Dependency readiness and contribution to parent progress are projections; neither changes status |
| Completion | `SATISFIED` requires every required child claim plus any run-level claim to pass the run aggregate verdict | `SATISFIED` requires the unit verdict; it does not satisfy the run by itself |

A unit cannot change parent, depend on a unit in another run, consume another run's budget, or use another run's mandate. Contract validation requires `work_units.length >= 1` and total claim-to-unit coverage. A claim needing no mutation is assigned to a verification-only unit with empty effect scope, explicit evidence duties, and a bounded read-only grant. Unit creation is a run-targeted kernel commit that records the immutable child IDs and contract version; a new child requires a versioned contract amendment.

Run propagation is deterministic rather than implicit:

1. For pause, cancellation, or rollback, the kernel locks the run and the nonterminal child set at stated revisions, prevents new leases, fences/revokes affected grants, and records the child-set hash in every request.
2. Unit transitions use the ordinary table below and the same control-request replay key plus unit ID. The run reaches `PAUSED`, `CANCELLED`, or `ROLLING_BACK` only after all selected units satisfy that run guard. An implementation may use one cross-aggregate commit or child commits followed by the final run commit; recovery must replay the same ordered set. Unknown effects activate the external safety fence instead of claiming a lifecycle result.
3. A run-level approval never changes a child automatically. A child may reference it only when `ApprovalEnvelope.scope` names that unit or a closed child selector and the exact action/effect; consumption limits are committed with the child transition.
4. A blocked child changes derived `run_progress`. The run becomes authoritatively `BLOCKED` only when a run-targeted failure proves no eligible required work or repair can progress. Run satisfaction and rollback completion likewise require aggregate verdicts.

### 6.2 Lifecycle statuses

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

### 6.3 Transition contract

| Scope | From | To | Deterministic guard | Required support | On failed guard |
|---|---|---|---|---|---|
| `RUN` | `RECEIVED` | `CLARIFICATION_REQUIRED` | Mandatory intent field absent, contradictory, or unauthenticated meaning needs operator input | Validation result and questions | Remain `RECEIVED`; emit rejection if reason is invalid |
| `RUN` | `CLARIFICATION_REQUIRED` | `RECEIVED` | Authenticated answer resolves every recorded question or contradiction | Clarification ref and revised `IntentEnvelope` | Stay `CLARIFICATION_REQUIRED` |
| `RUN` | `RECEIVED` | `DELIBERATING` | Valid factor set causes ambiguity policy to fire and reasoning budget exists | `DecisionFactorSet`, `DeliberationRequest`, policy version | Request approval or blocking through its own row |
| `RUN` | `RECEIVED` or `DELIBERATING` | `CONTRACTED` | Contract valid with at least one unit and complete claim-to-unit coverage; assumptions allowed; decisions resolved; contract hash approved where required | `OutcomeContract`, coverage result, decision refs, approval refs | Return violations; no status change |
| `RUN or UNIT` | Any eligible nonterminal | `APPROVAL_REQUIRED` | A declared approval is due before the next effect or decision | Subject-bound approval request and recorded resume target | Remain current |
| `RUN or UNIT` | `APPROVAL_REQUIRED` | Recorded resume target status | `ApprovalEnvelope` is valid/unconsumed for this aggregate and every ordinary target guard passes | Approval, consumption key, target support | Stay `APPROVAL_REQUIRED` |
| `RUN or UNIT` | `CONTRACTED` | `READY` | Approval obligations satisfied; dependencies accepted; budget reserved; rollback expectation valid | Contract, approvals, dependency verdicts, reservation receipt | Remain `CONTRACTED` |
| `UNIT` | `READY` | `LEASED` | Context/grant valid; executor eligible; no conflicting lease; parent run permits work; budget available | Assignment, context, grant, run revision, reservation | Remain `READY` |
| `UNIT` | `LEASED` | `EXECUTING` | Executor acknowledges before expiry and adapters recognize grant/fence epoch | Signed acknowledgement and fence ref | Revoke lease; use reconciliation row for retry |
| `UNIT` | `EXECUTING` | `EVIDENCE_PENDING` | Effects ended/revoked; receipt valid; required output locators present | Execution and effect-adapter receipts | Revoke; use blocking row if effects are unknown |
| `UNIT` | `LEASED` or `EXECUTING` | `READY` | Lease revoked/expired, effects reconciled absent/compensated, retry eligible, parent permits work | Lease event, effect inventory, reconciliation proof, retry calculation | Remain current or request `BLOCKED` |
| `UNIT` | `EVIDENCE_PENDING` | `VERIFYING` | Unit bundle sealed; each mandatory duty is present or explicitly unavailable; `aggregate_ref` and `unit_ref` name this unit and `child_bundle_refs=[]` | Unit `EvidenceBundle` | Continue collection or request `BLOCKED` at deadline |
| `RUN` | `READY` | `EXECUTING` | First required unit receives a valid lease under the same run revision | Child lease event, child-set hash, budget state | Remain `READY` |
| `RUN` | `EXECUTING` | `VERIFYING` | No required child is active/repairable/unresolved-blocked; a run bundle is sealed with complete run-level coverage and exact refs to every required sealed child bundle | Complete child projection, child verdicts, run `EvidenceBundle` | Remain `EXECUTING` |
| `RUN or UNIT` | `VERIFYING` | `SATISFIED` | Signed verdict says every critical claim passes and aggregate rule is true; a run verdict resolves referenced child coverage without copied evidence | Aggregate-specific `VerificationVerdict`, aggregate-specific evidence bundle | Reject transition |
| `RUN or UNIT` | `VERIFYING` | `REPAIRABLE` | Verdict fails claims, declares repairability, and attempt/budget limits remain | Failing verdict and repair eligibility calculation | Request `BLOCKED` through its own row |
| `RUN or UNIT` | `VERIFYING` | `BLOCKED` | Failure non-repairable, evidence indeterminate, independence invalid, or limits spent | Verdict or evidence-failure record | Reject unsupported blocker |
| `RUN or UNIT` | `REPAIRABLE` | `READY` | Repair order valid within contract/grant limits, budget reserved, and no approval due | `RepairOrder`, remaining limits, context hash | Request approval or blocking through its own row |
| `RUN or UNIT` | Any eligible nonterminal | `BLOCKED` | Typed failure proves no safe eligible transition can progress under current authority | `FailureEnvelope` and its `resume_target` | Remain current |
| `RUN or UNIT` | `BLOCKED` | `FailureEnvelope.resume_target.status` | Authorized input resolves every blocker and ordinary target guard passes at current revision | Resolution evidence and target support | Stay `BLOCKED` |
| `RUN or UNIT` | Any eligible nonterminal | `PAUSED` | Effects stopped/fenced; selected child propagation complete for a run; leases revoked | Pause request, child-set hash if run, recovery pointer | Wait for guard or request rollback |
| `RUN or UNIT` | `PAUSED` | Prior resumable status | Prefix/fence/policies valid; resources reconciled; approval current; parent permits unit work | Recovery report and new leases if needed | Stay `PAUSED` or request `BLOCKED` |
| `RUN or UNIT` | Any rollback-eligible status | `ROLLING_BACK` | Rollback recipe/authority exist and current effects are known; run child set frozen | Rollback plan, effect inventory, child-set hash if run, approval if required | Request `BLOCKED` |
| `RUN or UNIT` | `ROLLING_BACK` | `ROLLED_BACK` | Aggregate-specific compensation claims independently verified; run children complete | Rollback verdict and evidence | Request `BLOCKED` |
| `RUN or UNIT` | Any eligible nonterminal | `CANCELLED` | Cancellation authenticated; effects reconciled/residual-approved; run child propagation complete | Mandate, revocations, effect inventory, child-set hash if run | Remain current or request `ROLLING_BACK` |

“Any eligible nonterminal” means a legal status for that aggregate other than the target for which the row guard passes. Approval resume target is restricted to `DELIBERATING`, `CONTRACTED`, `READY`, `REPAIRABLE`, or `ROLLING_BACK`; `FailureEnvelope.resume_target` must name the same aggregate and a legal nonterminal status whose ordinary guard passes.

Every transition is compare-and-commit against `from_revision`. Every status change named elsewhere is shorthand for a new `TransitionRequest` that must use one table row; “On failed guard” never changes status. Transition rejection is a durable diagnostic envelope but does not advance the authoritative revision unless policy records diagnostics in the journal.

### 6.4 Policy overlays, not separate modes

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

Strategic reasoning is invoked from a typed `DecisionFactorSet`, not by an unbounded instinct to ask more agents. The Policy Catalog pins a closed `FactorSchema` version for each `decision_kind`; it declares factor IDs, scalar type/unit/range, normalization, weight, permitted provenance, freshness, missing-value default, rounding, threshold, and tie-break rule.

Factor provenance is one of `DETERMINISTIC_MEASURE`, `EVIDENCE_DERIVATION`, `OPERATOR_INPUT`, or `MODEL_ESTIMATE`. A model estimate is always a signed `MODEL_PROPOSAL` with `judgment_provenance {model_id, model_version, config_hash, prompt_hash, tool_versions[]}` and evidence refs; it is never relabeled as a measure. Other model-owned judgments, including `DecisionProposal`, semantic verdict content, and repair diagnosis, carry the same provenance block and common-envelope signature.

The kernel never asks a model for a factor. It validates the signed factor set against the pinned schema, rejects unknown IDs/types/provenance or stale evidence, applies declared conservative defaults where allowed, and otherwise requests approval. It records the factor-set ref, normalized vector, policy/formula version, rounded result, and tie-break result in `decision_input_refs` so replay uses identical inputs.

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
| Approval | Proposal, risk class, evaluation evidence | Authenticated human with `HUMAN_MANDATE`, correct role/scope, and signature | Authorization for a limited canary only |
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
| Journal integrity failure | Lifecycle status freezes at the last verified prefix; external `authority_health=FENCED` denies new effects | Restore a verified prefix into a new journal generation; never append to or skip the suspect tail | `SafetyFenceRecord`, chain/profile validation, replica comparison, adapter acknowledgements, recovery approval |
| Budget exhaustion | No new leases or deliberation work | Approval can add budget; otherwise `BLOCKED` or rollback | Budget ledger, forecast error, remaining obligations |
| Rollback action failure | `BLOCKED`; uncompensated effects remain explicit | Bounded compensation alternative only under authority | Effect inventory, attempted compensation, independent rollback verdict |

Each failure envelope includes the fields in §4.2, including `blocker_conditions[]` and `resume_target`. That target names the same aggregate and a legal nonterminal status; its ordinary guard must pass after every blocker resolves. Unknown failure classes default to no new effects and require explicit classification.

## 11. Idempotency, replay, and recovery

### 11.1 Idempotency

- Lifecycle commits are keyed by `(aggregate_ref, idempotency_key)`, where `idempotency_key=header.replay_key`; generation and safety control commits are keyed by `(control_subject_ref, replay_key)`. The ref type/ID must equal the common header and, for a control subject, its exact signed subject hash. The authoritative store returns the original event/record for an identical scoped repeat and rejects different content under the same scoped key.
- External effects use adapter-issued effect keys derived from `run_id`, `unit_id`, `attempt`, and a stable action index. An adapter must return the original receipt or report that idempotency is unsupported before the grant is issued.
- Evidence collection uses content hashes and method identity; repeated collection may create a new freshness observation without duplicating immutable content.
- Model calls are not assumed deterministic. Repeating one creates a new proposal envelope linked to the superseded proposal; only the selected record becomes decision support.
- Notifications and projection rebuilds are at-least-once and consumer-idempotent. They carry authoritative revision and projection version.

### 11.2 Replay

Replay has two forms:

1. **Authority replay** reconstructs statuses, balances, leases, approvals, and pinned policies solely from verified journal events. It performs no external effect and calls no model.
2. **Work replay** intentionally repeats a unit attempt under a new lease and attempt ID. It is allowed only after authority replay, external-effect reconciliation, and a fresh grant.

A `RecoverySnapshot` accelerates authority replay. The recovery process verifies the journal prefix hash represented by the snapshot, then replays all later events. If verification fails, it starts from an earlier trusted snapshot or genesis. Snapshot contents can never override events.

### 11.3 Integrity fencing

Journal integrity failure cannot commit `BLOCKED` because the suspect journal cannot create trustworthy authority. The last verified prefix remains the complete lifecycle truth; later status is `UNKNOWN`, not inferred. A separately keyed Safety Fence Service writes an immutable `SAFETY_DOMAIN` envelope to an independent replicated safety store and exposes `authority_health=NORMAL|FENCED|RECOVERING`. Under `PER_RUN`, its affected set is one run journal; under `GLOBAL`, it includes every run indexed in the affected generation. This health is a negative interlock, not a lifecycle status and never grants positive authority.

Under `FENCED`, effect adapters reject all old/new grants for the affected journal generation and acknowledge the fence's `grant_epoch`. The kernel stops commits and lease issuance. The Operations Projector shows the last-good revision/hash/profile, suspected tail, fence time/reason, adapter acknowledgement coverage, and recovery owner; it must not display a post-prefix status as authoritative.

Authority resumes only through this sequence:

1. Select and fully verify a replica, backup prefix, or genesis using its declared canonical/hash profiles. Quarantine the suspect tail and retain its hashes as evidence.
2. Freeze a continuation subject and obtain an unexpired, unrevoked, unconsumed human `ApprovalEnvelope` whose `RECOVERY_CONTINUATION` subject identifies its exact old/new generation IDs, last-good and recovery hashes, old/new profile tuple, topology, affected run set/hash, and continuation subject hash. For `PER_RUN`, that set contains exactly the one indexed run. For `GLOBAL`, it is the complete sorted run-ID set from the fenced generation plus its hash; a hash without resolvable exact membership is invalid.
3. Create the `JOURNAL_GENERATION` envelope for the new generation and atomically consume that approval in its revision-`0` genesis commit. The common header names the new journal/generation ID, safety domain, profiles, and generation-local `authoritative_revision=0`. The payload records the corresponding control-subject ref; topology and affected run set/hash; all old/new canonicalization, event-hash, signature, and crypto profiles; old/new journal and generation IDs; last-good revision/hash; recovery source and quarantined-tail hashes; fence/approval/consumption refs; aggregate hash; `generation_local_revision=0`; `previous_event_hash=zero64`; and the event-hash profile/value calculated by the new profile. This is both the genesis rule and the cross-generation link.
4. Replay aggregate/status, approval consumption, budgets, and grants from the verified prefix; reconcile external effects; rotate the grant epoch; and independently compare the rebuilt aggregate hash with the continuation record.
5. Write an immutable `SafetyFenceRecord(state=CLEARED)` successor referencing the active fence and verified continuation. Adapters acknowledge the new epoch before the kernel issues fresh grants. No valid continuation, valid approval consumption, or acknowledgement means the fence remains active and authority does not resume.

### 11.4 Interruption procedure

1. Verify journal integrity through the latest durable revision; if it fails, enter §11.3 and do not write a lifecycle event.
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
| Run lifecycle | Kernel | One transition at a time per run; child-set guards use a frozen revision/hash | Stale run or child projection rejected |
| Unit lifecycle | Kernel | One immutable parent and one active lease per unit; independent units may run concurrently | Wrong parent, stale request, or competing lease rejected |
| Safety fence | Safety Fence Service | Independent append-only record chain and monotonically increasing grant epoch | Unknown/conflicting fence state denies effects; it cannot authorize work |
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

At each decision boundary, the Transition Kernel's deterministic scheduling function consumes `DecisionFactorSet(decision_kind=UNIT_SELECTION)` under its pinned `FactorSchema`. Journal-derived cost, deadline, dependency, and recovery factors use deterministic provenance; probability, outcome value, operator-time value, and risk estimates from a model remain signed `MODEL_PROPOSAL` values.

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

The formula variables above are factor IDs in that closed schema. The kernel validates provenance/freshness, uses the schema's normalization, rounding, missing-value, and tie-break rules, and records the factor set plus result in the lease transition. The estimate selects among authorized actions and cannot override an invariant. Estimates and actuals are retained for learning admission. Verification budget is reserved before execution.

Latency policy distinguishes:

- `interactive_deadline`: time to next useful operator-visible response;
- `decision_deadline`: time available for clarification or deliberation;
- `unit_deadline`: lease and execution time;
- `evidence_deadline`: maximum evidence freshness and collection wait;
- `run_deadline`: overall outcome horizon.

Remote views show both elapsed time and the next deadline, not a generic running indicator.

## 14. Human approvals

An approval is a signed envelope over a precise revision, not a conversational inference:

Only an authenticated human principal with `HUMAN_MANDATE` can produce `ApprovalEnvelope`. Deterministic policy may state that a transition requires no approval, but no model, kernel, policy rule, or service can synthesize approval authority.

```yaml
ApprovalEnvelope:
  # common header supplies schema/version, aggregate identity,
  # created_at, expires_at, replay_key, crypto policy, hash, key, and signature
  approval_id: uuid
  approval_version: integer
  supersedes_approval_ref: uuid|null
  subject:
    # exactly one typed ref is non-null
    aggregate_ref: {type: RUN|UNIT, id: uuid}|null
    control_subject_ref: {type: JOURNAL_GENERATION, id: uuid, hash: sha-256}|null
    run_id: uuid|null
    kind: CONTRACT|TRANSITION|EFFECT|BUDGET|POLICY|ROLLBACK|APPROVAL|RECOVERY_CONTINUATION
    ref: uuid
    hash: sha-256
    revision: integer
    decision_type: string
    recovery_subject: RecoverySubject|null
  decision: APPROVE|DENY|REVOKE
  scope:
    allowed_transition: string|null
    allowed_control_action: CREATE_JOURNAL_CONTINUATION|null
    journal_generation_ids: [uuid]
    affected_run_ids: [uuid]
    affected_run_set_hash: sha-256|null
    action_classes: [string]
    effect_classes: [string]
    resource_selectors: [string]
    unit_selectors: [uuid]
    max_effect_units: integer|null
  constraints: [typed-condition]
  issuer:
    principal_id: string
    role: string
    identity_version: string
    authority_class: HUMAN_MANDATE
    authority_source_ref: uuid
  single_use: boolean
  max_consumptions: integer

RecoverySubject:
  decision_kind: RECOVERY_CONTINUATION
  topology: PER_RUN|GLOBAL
  old_generation: {journal_id,generation,generation_id,last_good_revision,last_good_hash,canonicalization_profile,event_hash_profile,signature_profile,crypto_policy_version}
  new_generation: {journal_id,generation,generation_id,canonicalization_profile,event_hash_profile,signature_profile,crypto_policy_version}
  affected_run_ids: [uuid]
  affected_run_set_hash: sha-256
  recovery_source_hash: sha-256
  quarantined_tail_hashes_hash: sha-256
  continuation_subject_hash: sha-256
```

Validation and consumption are deterministic:

1. The canonical signed representation contains no duplicate time fields: semantic `issued_at := header.created_at` and `expires_at := header.expires_at`. The signature profile/key must be allowed, and the human identity/role/mandate must be valid for the subject and decision at issue and consumption time.
2. Exactly one of `subject.aggregate_ref` and `subject.control_subject_ref` is non-null, and it must equal the common header's type/ID. A lifecycle subject uses `RUN` or `UNIT`, has `recovery_subject=null`, and its hash, aggregate revision, and decision type must equal the proposed transition/effect. Scope selectors and typed constraints must cover it without wildcard expansion. A run approval reaches a unit only through an explicit unit selector or closed selector resolved at the approved revision.
3. A recovery subject uses `control_subject_ref.type=JOURNAL_GENERATION`, `kind=decision_type=recovery_subject.decision_kind=RECOVERY_CONTINUATION`, and the proposed new generation ID. Its control-subject hash, `subject.hash`, and `recovery_subject.continuation_subject_hash` are identical. That hash covers the canonical recovery-subject fields shown above and excludes the later approval ref/consumption and event hash, avoiding a signing cycle. Its common header names that generation and has generation-local `authoritative_revision=subject.revision=0`. Every old/new generation ID, profile, last-good/source/tail hash, topology, and run-set value must equal the frozen continuation subject and active fence. `scope.allowed_control_action=CREATE_JOURNAL_CONTINUATION`, its generation list names only that new generation, and its run IDs/hash equal the subject. `PER_RUN` requires its one indexed run; `GLOBAL` requires the complete sorted indexed set and its hash, never an unresolved hash or wildcard.
4. `replay_key` is stable for `(subject.aggregate_ref|subject.control_subject_ref, approval_id, approval_version, decision)`; an identical repeat returns the original record and different content conflicts. An approval cannot be rebound or broadened; amendment creates a higher version and new replay key.
5. For lifecycle authority, the kernel records `(approval_id, version, transition_request.replay_key, consumption_ordinal)` in the same journal commit as the permitted action. For recovery authority, the recovery kernel records `(approval_id, version, control_subject_ref, approval.replay_key, consumption_ordinal)` in the revision-`0` `JournalContinuationEvent`. Repeating the same scoped request returns the prior consumption. A recovery approval is single-use with `max_consumptions=1`; all other envelopes stop at their declared count, and `single_use=true` always requires that value.
6. Revocation never edits an issued record. It is a higher-version `decision=REVOKE` envelope whose `supersedes_approval_ref` and `subject.ref` identify the prior approval. The effective view derives `revocation_ref := revoke.header.envelope_id` and `revoked_at := revoke.header.created_at`; neither derived field appears in the signed payload. The human issuer needs equal-or-greater mandate authority. The kernel rejects expired, revoked, superseded, consumed, stale-subject, or denied authority. Revoking a consumed recovery approval cannot erase or invalidate its already committed generation; a later recovery requires a new exact subject and approval.

Default approval points include:

- Acceptance or amendment of high-risk outcome contracts.
- Expansion of effect scope, sensitive-resource access, or destructive effects.
- Consequential decisions with unresolved material disagreement.
- Additional budget above the accepted ceiling.
- Repair that changes external behavior beyond the prior attempt's allowed delta.
- Canary or promotion of policy affecting high-risk decisions.
- Rollback whose compensation itself has material irreversible effects.
- Journal recovery/continuation after an integrity fence; the approval binds the exact generation, profile, hash, topology, and affected-run subject described above.

Approval validity is checked at lifecycle-transition or continuation-commit time. A changed subject hash, expired identity, revoked role, newer conflicting mandate, or altered risk summary invalidates the approval. Refusal and timeout are durable outcomes with their own reason codes.

## 15. Remote observability and off-machine comprehension

The Operations Projector emits a renderer-independent `RunView` with run ID; authoritative `run_status`; derived `run_progress` and child counts; source/projection revisions; `authority_health=NORMAL|FENCED|RECOVERING`; last-good and fence refs; freshness/lag; objective/contract version; unit statuses, leases, and deadlines; claims; blockers/approvals; budgets; decisions; evidence health; disclosure/omission manifest; recovery actions/handoff ref; and verified-prefix revision plus projection hash.

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

1. **Single positive-authority spine:** every status, lease, approval consumption, budget debit, and policy activation is derivable from the verified journal; the external safety fence can only deny authority.
2. **No model transition writes:** no model-owned component can append a `TransitionEvent` or modify an authoritative aggregate directly.
3. **Revision safety:** every transition compares the producer's revision with the current aggregate revision.
4. **Idempotent intent:** one replay key cannot create more than one logical transition or external effect.
5. **One active unit lease:** at most one unexpired effect-bearing lease exists for a unit.
6. **Least authority:** every attempted effect is inside the accepted contract, work unit, capability grant, remaining budget, and approval constraints.
7. **Contract immutability:** accepted claims and acceptance rules change only through a versioned amendment; failed work cannot weaken them.
8. **Evidence before satisfaction:** every satisfied critical claim has a signed verdict and required available evidence in an aggregate-specific bundle; a run bundle covers its own claims and exact sealed child bundles by reference without copying child evidence.
9. **Verifier independence:** the principal responsible for the attempt does not sign its final verdict.
10. **Bounded repair:** every repair names failed claims, allowed deltas, new evidence duties, attempt ceiling, and budget.
11. **No observation promotion:** observations cannot activate policy without evaluation, admission, and required approval.
12. **Recoverable authority:** a fresh process can reconstruct all non-secret authority-bearing status without conversational memory.
13. **Explicit uncertainty:** unknown external effects, missing mandatory evidence, and unresolved critical disagreement cannot be represented as success.
14. **Reserved assurance:** accepted work reserves enough budget for required evidence collection and verification.
15. **Projection honesty:** every operator view declares its source revision, freshness, omissions, and integrity position.
16. **Rollback evidence:** rollback completion requires an independent verdict over compensation claims.
17. **Aggregate separation:** every event targets one typed aggregate; each unit has one immutable parent, while run progress is derived and run status is explicitly committed.
18. **Fenced integrity:** an unverifiable journal freezes truth at its last-good prefix and cannot record its own blocked status or resume without a verified continuation generation.
19. **Replayable judgment:** every subjective factor is a signed proposal with provenance, and every deterministic decision records its closed factor/policy inputs.
20. **Approval consumption:** lifecycle or recovery approval subject, scope-local revision, scope, validity, replay key, and remaining consumption are checked and committed atomically with the authorized transition or continuation genesis.
21. **Cryptographic determinacy:** canonicalization, hash, signature, key, and journal-generation profiles are explicit and policy-pinned for replay.
22. **Non-empty execution graph:** every accepted contract has at least one unit and complete claim-to-unit coverage.
23. **Human approval:** every approval/revocation producer is an authenticated `HUMAN_MANDATE`; absence of a requirement is not synthetic approval.
24. **Typed control scope:** lifecycle, journal-generation, and safety-domain envelopes cannot impersonate one another; `GLOBAL` topology is the complete sorted indexed run set plus its hash, never an unresolved wildcard.

## 18. Targeted conformance proofs

| Proof | Input | Required result |
|---|---|---|
| Zero-unit rejection | Valid-looking contract with `work_units=[]` | Schema/contract guard rejects it before `CONTRACTED`; no run verdict or transition is emitted |
| Verification-only outcome | Contract with one read-only verification unit, one run-level claim, and full claim coverage | Unit follows the ordinary lease/evidence/verdict path; the run bundle references the sealed unit bundle and carries only run-level evidence; the run progresses `READY→EXECUTING→VERIFYING→SATISFIED` only after both verdicts |
| Aggregate evidence composition | Sealed unit bundles plus a run bundle with local items and child coverage refs; then omit, duplicate, substitute, or stale-hash one child ref | Untouched unit/run bundles verify without copied child items; every incomplete, duplicate, foreign-contract, non-required, or hash-inconsistent child reference rejects before a run verdict |
| Aggregate propagation | Run with two nonterminal units, then pause/cancel/rollback requests at stale and current child revisions | Stale child-set hash rejects; current set fences grants, commits legal unit transitions, then commits the run transition; derived progress never substitutes for run status |
| Human approval | Identical approval payloads signed by a model/service key and by an authorized human key; duplicate, over-consumption, and revocation cases | Non-human producer rejects; human record is idempotent; consumption commits once; derived revocation time/ref prevents later use |
| Recovery approval and topology | Human `RECOVERY_CONTINUATION` approval over a frozen per-run/global candidate; then change issuer class, expiry/revocation/consumption, generation, profile, source/tail/continuation hash, or one global run member/hash | Only the exact unexpired human subject consumes once with revision-0 genesis; every variant rejects, and global recovery requires the complete sorted indexed run set plus its hash |
| Control scope/topology | `RUN`, `UNIT`, `JOURNAL_GENERATION`, and `SAFETY_DOMAIN` headers with exchanged payload/ref types under per-run and global journals | Type/ref disagreement rejects; per-run fence affects one run; global fence/continuation affects exactly the complete indexed run set and corresponding hash |
| Scope-local revision | Independent run, unit, generation, and safety-domain records with differing revisions; substitute a global journal offset or another scope's revision | Run/unit compare their aggregate revisions, continuation genesis uses generation-local `0`, safety records use their domain revision, and every cross-scope/universal substitution rejects |
| Continuation cryptography | Verified old prefix plus an exactly approved revision-0 continuation using declared old/new profiles; alter each profile, prior hash, revision, approval subject/consumption, or event hash in turn | Untouched continuation verifies and replays; every altered case rejects before grants resume |
| Factor replay | Signed factor set, pinned schema/formula, then unknown/stale/provenance-invalid variants | Original produces the same normalized vector/result on replay; every invalid variant rejects or follows its declared conservative default |
| Authority activation | Shadow system with each of these absent in turn: safety store, run/unit projector, factor schemas, approval-consumption ledger, parity/replay/failure evidence | Authority activation rejects until every prerequisite and proof is present and a human authorizes activation |

## Comparison Appendix

This appendix was added only after the prescribed pre-comparison scan returned `PASS clean-sheet anchoring boundary`. Current-system claims use the audit labels `OBSERVED`, `CONFIGURED`, `DOCUMENTED`, and `INFERRED`; target claims use `RECOMMENDED`. Evidence references point to the [frontier evidence index](./2026-07-13-sgsd-frontier-architecture-evidence-index.md) and the [skills and routing analysis](./2026-07-13-sgsd-audit-skills-routing.md). A configured path is not treated as proof of recent use.

### A. Responsibility mapping

| Current concept and evidence | Clean-sheet responsibility | Fit, excess, and gap | Migration and future amendment |
|---|---|---|---|
| **Control, routes, and deliberation.** **DOCUMENTED:** `CLAUDE.md` assigns orchestration, triggers, checkpoints, and exits (SRC-003). **CONFIGURED:** autonomous, deliberate, pause, and resume paths exist (SRC-020, SRC-022, SRC-025, SRC-026). **OBSERVED:** the decision registry is empty (SRC-044), and the routing analysis records conflicting deliberation ownership. | **RECOMMENDED:** Intent Gateway, Contract Compiler, Deliberation Cell, and Transition Kernel; all operating behavior is policy over one lifecycle. | **INFERRED:** role separation and adversarial perspectives are valuable. **INFERRED:** precedence and roster ownership repeat in prose, while decisions lack typed consumption. | **RECOMMENDED:** add a versioned route policy, one roster authority, typed proposals, and a contract-bound decision record; shadow current results before activation. **RECOMMENDED:** Future amendment: remove prose precedence only after fixture parity. |
| **Intent, context, and bounded execution.** **OBSERVED:** tested intent/context builders emit closed-vocabulary intent and role-specific packets, and execution wrappers bound invocation/logging (SRC-054–SRC-059, SRC-080, SRC-081). **CONFIGURED:** handovers/profiles declare budgets, evidence, isolation, hooks, and change limits (SRC-045, SRC-047). | **RECOMMENDED:** retain these mechanics behind `IntentEnvelope`, `ContextBundle`, `AssignmentEnvelope`, `CapabilityGrant`, and `ExecutionReceipt`. | **INFERRED:** this is a strong migration base. **OBSERVED:** intent classification follows work selection. **INFERRED:** a profile is not an expiring effect grant, and wrapper success is not an outcome verdict. | **RECOMMENDED:** adapt rather than replace; add revisions, omissions, leases, enforced effects, and idempotent receipts. **RECOMMENDED:** Future amendment: keep provider details below the authority protocol and tune context from outcomes. |
| **Assurance.** **CONFIGURED:** the gate registry declares triggers, evidence, enforcement, and escalation (SRC-043). **OBSERVED:** loaders, transition guards, a browser-evidence verifier, and normalized value rows execute (SRC-062–SRC-065). | **RECOMMENDED:** Evidence Recorder and Independent Verifier emit claim-level verdicts consumed by the kernel and Repair Composer. | **INFERRED:** current checks protect useful decisions. **INFERRED:** result shapes differ, and the sampled verifier boundary does not prove every acceptance property. | **RECOMMENDED:** keep each gate as a method; adapt it to claim, evidence, independence, and verdict schemas; never bypass or duplicate it. **RECOMMENDED:** Future amendment: retire only with equal-or-stronger evidence and regression proof. |
| **Truth, recovery, and operator views.** **OBSERVED:** planning truth expresses position but the census records missing/stale signals; degraded-aware views, separated MCP authority, liveness, and remote entry exist (SRC-004–SRC-006, SRC-069–SRC-075). **CONFIGURED:** checkpoint recovery exists (SRC-025, SRC-026, SRC-079). | **RECOMMENDED:** Durable Journal, replay snapshots, Operations Projector, signed approvals, and handoff packets. | **INFERRED:** checkpoints, read/write separation, degraded views, and remote entry are strong assets. **OBSERVED:** one review covers only 10 of 12 adapter sections. **INFERRED:** mutable sources can conflict. | **RECOMMENDED:** shadow typed events beside current writes, block on divergence, then derive documents and one `RunView` from replay. **RECOMMENDED:** Future amendment: snapshots accelerate but never replace journal authority. |
| **Memory and learning.** **OBSERVED:** deterministic memory admission, revocation, revalidation, lineage, and evidence validation exist (SRC-066–SRC-068, SRC-084). **OBSERVED:** no recent ledger proves curated learning changed a route. | **RECOMMENDED:** Learning Admission Controller feeds a distinct Policy Catalog path through evaluation, approval, canary, and reversion. | **INFERRED:** admission and lineage closely fit the trust boundary. **INFERRED:** knowledge promotion is not policy authority, and consumption is unproven. | **RECOMMENDED:** retain memory governance; admitted records may only create learning candidates. **RECOMMENDED:** Future amendment: enable policy influence only after contamination, rollback, and counterfactual tests. |
| **Registries, routing, and concurrency.** **CONFIGURED:** registries define agents, gates, commands, profiles, reviews, hooks, and protected components (SRC-041, SRC-043, SRC-046–SRC-051). **OBSERVED:** deterministic provider routing exists (SRC-052, SRC-059, SRC-061). **INFERRED:** plan-level parallel settings are inert or stale. | **RECOMMENDED:** Policy Catalog and version-pinned kernel scheduling with one writer per aggregate, parallel readers, and isolated writers only under ownership/revalidation. | **INFERRED:** registries and resolvers form a sound base. **OBSERVED:** the decision registry is empty (SRC-044). **INFERRED:** unconsumed settings create false affordances. | **RECOMMENDED:** classify every key as enforced, display-only, migration-only, or rejected; pin active versions in events. **RECOMMENDED:** Future amendment: expand writer concurrency only after conflict and replay proofs. |
| **Cost evidence.** **CONFIGURED:** token and status skills group spend and anomalies (SRC-014, SRC-015, SRC-029). **OBSERVED:** no live metrics directory establishes recent route, cost, gate, or provider use (SRC-012). | **RECOMMENDED:** event-linked budget, time, token, outcome, repair, and recovery measures, with diagnostics as projections. | **INFERRED:** current diagnostics cover the right concerns. **OBSERVED:** runtime measurement is absent in this census. **INFERRED:** overlapping views may diverge. | **RECOMMENDED:** use one measurement schema and degrade honestly. **RECOMMENDED:** Future amendment: change budgets only through admitted, outcome-aware learning. |

### B. Migration posture

**RECOMMENDED:** the mapping does not justify a wholesale rewrite:

1. **RECOMMENDED:** standardize envelopes and provision the independent safety-fence store, typed run/unit projector, pinned factor schemas, and append-only approval-consumption ledger before any new positive authority.
2. **RECOMMENDED:** add journal/kernel writes in shadow while current entry points remain authoritative; dual-read every aggregate projection and compare route, factor, approval, budget, lease, verdict, and recovery results without creating effects.
3. **RECOMMENDED:** require replay, interruption, topology-fence, zero-unit rejection, continuation-crypto, approval replay/revocation, and operator-comprehension proofs with recorded parity thresholds and rollback procedure.
4. **RECOMMENDED:** activate routes first under explicit human approval, then leases/effects, then budgets/verdict consumption; each step retains the prior path as rollback until its canary evidence is accepted.
5. **RECOMMENDED:** connect learning to policy last, through evaluation and canary admission; observations remain non-authoritative.

### C. Unresolved comparison uncertainty

- **OBSERVED:** absent live metrics prevent claims about recent frequency, provider compliance, cost, gate value, or outcome impact (SRC-012).
- **INFERRED:** sources and tests do not establish sustained concurrent reliability or the correct journal partition design.
- **RECOMMENDED:** resolve both with measurement and failure injection before reprioritizing migration.
