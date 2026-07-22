# Clarity Research & Development Board Treaty

**Status:** v0.3.1 — corpus-hardened, plus corrections from the first live run (§22)
**Date:** 22 July 2026
**Supersedes:** v0.3 (same day) · v0.2 (operator review draft)
**Relationship:** A sibling constitution to the SGSD Board Treaty
**Implements:** `/rd-board` skill — `super-gsd/skills/rd-board/SKILL.md`
**Purpose:** Convert external research, VTP material, papers, demonstrations and new technical ideas into evidence-bounded Clarity opportunities—without allowing novelty to bloat the system.

---

## 0. What changed in v0.3, and why

v0.2 was written from first principles and from eight named real-world disciplines (§3). v0.3 is the same document after a sweep of the VTP corpus (91 books, 90 research papers, 86 meetings). The sweep did two things: it confirmed several v0.2 provisions with direct evidence, and it exposed ten structural defects that would have made the Board converge on confident, wrong answers.

**The single most important finding:** v0.2 assumed that seating four different models on four different mandates produces independent judgement. The corpus says the dominant driver of collapse is *interaction structure*, not model identity — and that several of v0.2's own procedures (named ballots, evaluated performance, persistent seat relationships, authority-ordered debate) are precisely the conditions measured to *increase* conformity in LLMs. v0.2 built a diversity engine and then wired four conformity amplifiers into it.

| # | Change | Sev | Where | Evidence |
|---|---|---|---|---|
| 1 | Blind ballot; de-identified findings during debate | CRITICAL | §13.5.1 | `llms-exhibit-normative-conformity::sec02::0000` |
| 2 | Diversity floor — void the round on premature convergence | CRITICAL | §4.5 r13 | `diversity-collapse::sec01`, `::sec06` |
| 3 | Raw-artefact adjudication | CRITICAL | §10 R3/R4 | `why-llms-arent-scientists-yet::sec01::0010` |
| 4 | Ledger blindness | CRITICAL | §4.5 ledger | `llms-exhibit-normative-conformity::sec02::0000` |
| 5 | Baseline-validity precondition | HIGH | §10 R5 | `why-llms-arent-scientists-yet::sec01::0011` |
| 6 | Gate R-0 convening triage | HIGH | §10 | `agentark::sec02`, `gated-coordination::sec07` |
| 7 | Append-only event log; dossier as projection | HIGH | §14 | `stateless-decision-memory::sec02`, `::sec03::0001` |
| 8 | Predeclared prediction per memo | HIGH | §4.5 | `agentic-harness-engineering::sec01` |
| 9 | Parallel-diverge / sequential-converge split | MED | §13.2–13.3 | `the-sequential-edge::sec04`, `::sec07` |
| 10 | Fast path; iteration inside gates | MED | §10.0 | `design-of-everyday-things::ch07::0169` |
| 11 | Parallel-run before retirement | MED | §10 R7 | `wiki/meetings/alex-jack-procurement-sharpalite-meeting.md` |

Two consequential demotions also apply. §3's eight disciplines and §11's readiness axes are **not corpus-validated** — no VTP material exists on DARPA Heilmeier, NASA TRL, GAO TRA, GDS phases, Toyota Production System, Google SRE error budgets or FDA design controls. They are retained as operator judgement and are now labelled as such. And §4.5's model-identity rules are demoted beneath the new structural rules, because the corpus says structure is the stronger lever.

---

## 1. Founding purpose

The R&D Board exists to answer one question:

> Given what Clarity and JCL already do, does this new information expose a better way of solving a real problem—and has that approach earned a precise place in the system?

The Board is not an ideas committee and is not authorised to add technology because it is interesting. Its job is to:

1. understand the external idea accurately;
2. understand the current business process and technical solution accurately;
3. find the exact process, decision, data, engine, API or interface slot the idea could improve;
4. compare it against the incumbent and simpler alternatives;
5. design the smallest experiment capable of disproving it;
6. promote it only when measured evidence shows a complexity-adjusted win; and
7. remove, retire or consolidate the thing it displaces wherever possible.

An idea without a real slot is research, not a backlog item. A prototype without a winning comparison is an experiment, not a feature. A pilot without a retirement or rollback plan is future debt wearing a lab coat.

---

## 2. Constitutional invariants inherited from SGSD

These rules are binding:

1. **Observations are emitted from facts. Claims are emitted by agents. Decisions are bounded.** An agent claim must never silently become an observation.
2. **Every material statement has lineage.** External claim → source evidence → internal observation → board finding → evidence verdict → recommendation → operator promotion decision.
3. **The Board recommends; the operator promotes.** No agent vote authorises live writes, destructive changes, SAP/Mongo mutation, payment or dispatch changes, credential use, external side effects or material scope expansion.
4. **Read-only discovery may continue autonomously.** Ambiguous or unsafe actions emit `needs_review`; they are not guessed through.
5. **Deterministic evidence outranks persuasive prose.** Tests, telemetry, source code, schemas, API contracts and real operator outcomes beat eloquence.
6. **No source becomes authority merely because it is new, technical or delivered confidently.** VTP material is an evidence lead until verified.
7. **Research and implementation are separate authorities.** Discovery may recommend an experiment. It may not smuggle production code into Clarity.
8. **Existing SGSD CMB vocabulary remains canonical.** R&D documents are projections and working artefacts, not a competing truth system.
9. **Structure outranks identity.** Where a diversity mechanism based on model choice conflicts with one based on interaction structure, the structural mechanism wins. (New in v0.3 — see §4.5.)

### Existing CMB mapping

| R&D content | Canonical SGSD representation |
|---|---|
| Repository/API/test observation | `execution_receipt` or cited `context_anchor` |
| Board member finding | `review_finding` |
| Source or test credibility judgement | `evidence_verdict` |
| Board outcome | `decision_recommendation` |
| Jack's binding ruling | `operator_precedent` |
| Terminal promotion/rejection | `promotion_decision` |

---

## 3. Real-world disciplines incorporated

> **Evidence status (v0.3):** OPERATOR JUDGEMENT, NOT CORPUS-VALIDATED. A VTP sweep found no material on any of the eight disciplines below. They are retained because they are sound and widely practised, not because this project has evidence for them. Any provision justified *only* by this section carries lower authority than a provision citing §19b.

| Discipline | Practice borrowed | Clarity translation |
|---|---|---|
| DARPA | The Heilmeier questions test objective, current practice, novelty, impact, risk, cost, time and exams | Every candidate begins with a plain-English problem and ends with predeclared tests |
| NASA / aerospace acquisition | Technology Readiness Levels and key decision points separate promising science from integration-ready capability | Scientific validity, Clarity integration readiness and operational readiness are assessed separately |
| SpaceX engineering sequence | Challenge requirements; delete; simplify; accelerate; automate—in that order | Every gate includes an anti-bloat pass before new components are permitted |
| Toyota Production System | Eliminate waste, expose problems and improve standard work continuously | Research must first ask whether a step, handoff, queue or duplicated system can be removed |
| UK Government Digital Service | Discovery → alpha → beta → live, with discovery explicitly not used for production building | R&D exploration, disposable prototype, shadow pilot and live use remain separate stages |
| Thoughtworks Technology Radar | Assess, Trial, Adopt and Hold/Caution states make uncertainty visible | Clarity keeps a living R&D Radar instead of treating every idea as either built or forgotten |
| Google SRE | Error budgets balance innovation against reliability | Clarity experimentation pauses when protected production metrics or risk budgets are breached |
| Medical-device design controls | Verification asks whether the design meets its specification; validation asks whether it meets the user's need | A technically correct implementation still fails if it does not improve the real JCL workflow |

The Radar ring semantics **are** corroborated in-corpus — `wiki/books/fundamentals-of-software-architecture.md` carries the Hold/Assess/Trial/Adopt definitions this treaty uses. That one row is evidenced; the other seven are not.

---

## 4. Board composition

There are **four permanent voting agents**. Their roles are deliberately incompatible enough to resist groupthink.

> **Precedent.** A four-role adversarial board was already ruled KEEP for this project — see `wiki/meetings/multi-agent-framework.md`, Idea 9: *"Without carefully designed agent personalities, you get homogeneous agents that agree on everything — eliminating the adversarial benefit."* That ruling stands as an `operator_precedent`. This section implements it; it does not re-derive it.

### 4.1 The Systems Cartographer — Slot Architect

**Mandate:** Establish how the relevant JCL work is performed today and identify the exact place an idea could live.

The Cartographer must inspect the relevant process, code, engines, APIs, schemas, stores, jobs, interfaces, telemetry and existing alternatives. It answers:

- What user or business problem exists?
- Where is it currently handled?
- What is the incumbent solution?
- What are its inputs, outputs, owners and source of truth?
- Which exact boundary would change?
- Is this a replacement, extension, composition, measurement layer or genuinely new capability?
- What else consumes or depends on this slot?

**Required output:** a slot map with repository paths, contracts, dependencies, owners, baselines and confidence.

**Hard rule:** `NO_SLOT` is a valid and often successful finding.

**Hard rule (v0.3):** the slot map is distributed to other seats **as data, before debate opens** — never as an opening argument. See §13.3.

### 4.2 The Experimentalist — Evidence & Trial Architect

**Mandate:** Turn attractive claims into cheap, decisive and reproducible tests.

The Experimentalist distinguishes:

- mechanism evidence from marketing;
- laboratory performance from relevant-environment performance;
- verification from validation;
- overall averages from critical-category regressions;
- correlation from causal improvement; and
- a demo from a maintainable operating capability.

It defines the incumbent baseline, target metrics, protected metrics, golden fixtures, sample size, shadow conditions, pass/fail threshold, kill criteria and rollback method **before** results are observed.

**Required output:** the minimum experiment that could falsify the candidate.

**Hard rule:** if no credible test can distinguish success from enthusiasm, the candidate cannot advance.

**Hard rule (v0.3):** the Experimentalist adjudicates on raw artefacts only. See §10 R3/R4.

### 4.3 The Contrarian — Deletion & Failure Advocate

**Mandate:** Build the strongest honest case that the proposal is unnecessary, misread, premature or actively harmful.

The Contrarian must test:

- whether the requirement itself is wrong;
- whether the problem can be removed rather than solved;
- whether an existing Clarity feature already does it;
- whether configuration, process repair or better data beats new technology;
- hidden integration, security, support and migration costs;
- source credibility, survivorship bias and benchmark leakage;
- failure modes at JCL scale and data quality; and
- what would have to be true for the idea to be rejected immediately.

**Required output:** strongest objection, simplest alternative and proposed kill test.

**Authority:** no permanent veto. A concrete unresolved hard risk blocks a gate; dislike or general caution does not.

### 4.4 The Moonshot — Frontier & Leverage Architect

**Mandate:** Search for the non-obvious, high-leverage interpretation that could materially change Clarity rather than merely polish it.

The Moonshot asks:

- Is the proposed use too literal?
- Does the mechanism unlock a shared capability across several processes?
- Could it eliminate a category of work rather than optimise one task?
- Could a smaller primitive produce a much wider benefit?
- What becomes possible if the external claim is true at JCL scale?
- Is there a better architecture than inserting another feature into the existing path?

**Required output:** one bounded high-upside option, its enabling assumptions and a credible first experiment.

**Hard rule:** imagination earns an experiment, never production authority.

### 4.5 Model diversity constitution

> **Demoted in v0.3.** Model-identity diversity is **necessary but not sufficient**, and it is the *weaker* of the two available levers. `diversity-collapse::sec01` finds that collapse "arises primarily from the interaction structure rather than inherent model insufficiency", and reports "a compute efficiency paradox, where stronger, highly aligned models yield diminishing marginal diversity despite higher per-sample quality." Four premium, heavily-aligned frontier models is close to the configuration most prone to collapse. Rules 1–2 below therefore remain in force but are subordinate to rules 13–15 and to §13.5.1.

Each permanent seat must use a **different model identity**. The initial Board is split evenly across OpenAI and Anthropic so that disagreement is not merely four differently worded samples from one provider family.

#### Recommended initial assignment

| Board seat | Provider and model | Default reasoning configuration | Dispatch route |
|---|---|---|---|
| Systems Cartographer | Anthropic — Claude Opus 4.8 (`claude-opus-4-8`) | Adaptive thinking, `xhigh` for repository-wide work | `Agent()` |
| Experimentalist | OpenAI — GPT-5.6 Sol (`gpt-5.6-sol`) | `xhigh`; pro mode selectively for R5 adjudication | `codex-exec.sh --contract rd-memo-v1` |
| Contrarian | OpenAI — GPT-5.5 (`gpt-5.5`) | `xhigh` | `codex-exec.sh --contract rd-memo-v1` |
| Moonshot | Anthropic — Claude Fable 5 (`claude-fable-5`) | Native/adaptive reasoning | `Agent()` |

Both OpenAI model IDs are confirmed available in the local `codex` CLI (v0.144.3) on both the Windows workstation and devcp. This assignment is an initial hypothesis and must itself be evaluated. Role prompts are stable while models are compared; a model is retained because it improves the Board's measured decision quality, not because it is newest or most expensive.

#### Binding model rules

1. **Four seats, four model IDs.** Two seats may not resolve to the same underlying model or alias within a run.
2. **Two-provider minimum.** While both providers remain approved and available, neither provider may occupy more than two permanent seats.
3. **No silent substitution.** If a selected model is unavailable, the seat returns `MODEL_UNAVAILABLE`. A fallback requires an explicit recorded substitution and its output cannot be presented as if produced by the treaty lineup.
4. **Pin where possible.** Use pinned model IDs/snapshots where the provider exposes them. Otherwise record the requested model, effective model, provider response metadata and run date.
5. **Reproducible identity.** Every memo records provider, exact model ID, reasoning/effort mode, prompt-template version, evidence-pack hash and completion timestamp.
6. **Independent first pass.** No model sees another member's initial conclusion before submitting its own signed memo.
7. **Common facts, different mandates.** All seats receive the same validated observation pack and access boundaries, plus only their role-specific instructions. A model must not gain an evidential advantage merely because of its seat.
8. **No model is the chair.** SGSD performs deterministic collation and evidence validation. It must not ask a fifth model to smooth disagreements into artificial consensus.
9. **Upgrade by bake-off.** A new model version enters as a challenger against historical R&D cases. It replaces a sitting model only when it improves that role's factual accuracy, useful dissent, evidence discipline and decision contribution without unacceptable cost or latency.
10. **Measure diversity, not verbosity.** Paraphrased agreement does not count as independent judgement.
11. **Keep the model for the candidate lifecycle.** Do not change a candidate's sitting models between initial assessment and final recommendation unless a declared substitution is unavoidable; otherwise model drift contaminates the comparison. *(v0.3 caveat: persistent seat relationships are themselves a measured conformity amplifier — see rule 15. This rule is retained for comparability, and rule 15 neutralises its side effect.)*

**New in v0.3:**

12. **Structure outranks identity.** Where rules 1–11 conflict with §13.5.1 (blind ballot) or rules 13–15, the structural rule wins.
13. **Diversity floor.** Before cross-examination opens, SGSD computes pairwise semantic divergence across the four first-pass memos. If divergence falls below the calibrated floor, **the round is void**: seats are re-run in isolated subgroups with no shared draft and no knowledge of the voided round. Convergence reached *before* debate is a defect, not agreement. Basis: `diversity-collapse::sec01` — collapse is structural, dense topologies "accelerate premature convergence"; `::sec06` — "interaction designs that preserve independence, such as the blind-writing phase of NGT and subgroup isolation, consistently yield higher diversity with only modest differences in judged quality."
14. **Heterogeneity permitted as a diversity source.** At least one seat may run a deliberately cheaper or less heavily-aligned model. This is a legitimate diversity mechanism, not a downgrade, and must not be recorded as a substitution under rule 3.
15. **Ledger blindness.** Seats are **never told they are being scored**, never shown their own or any other seat's ledger, and never informed that a run contributes to model retention decisions. The performance ledger is computed post-hoc by SGSD from artefacts no seat can see. Basis: `llms-exhibit-normative-conformity::sec02::0000` — "five of the six models—excluding llama-3.1-8b—showed higher conformity under the w/ evaluation condition… as in humans, evaluation strengthens normative conformity in LLMs." Evaluation-awareness is a **stronger** conformity amplifier (5/6 models) than public balloting (4/6). The same paper measures "continuity of relationship" as a third amplifier, which is why rule 11 requires this rule to be in force.

#### Model performance ledger

After every closed candidate, SGSD records per seat — **without any seat's knowledge, per rule 15**:

- supported findings later confirmed;
- material findings missed;
- false or non-falsifiable objections;
- unique contribution not found by the other three;
- operator accept/overrule outcome;
- evidence-citation validity;
- input/output tokens, latency and cost;
- whether the role materially changed the final experiment or verdict; and
- **predicted-vs-actual gate outcome** (new in v0.3).

**Predeclared prediction (rule 16).** Every seat memo must carry a falsifiable prediction of the candidate's eventual gate outcome. Ledger scoring is prediction-versus-outcome, not post-hoc plausibility. Every amendment to this treaty or to a role prompt likewise carries a prediction, a change manifest and a revert route. Basis: `agentic-harness-engineering::sec01` — "decision observability pairs every edit with a self-declared prediction, later verified against the next round's task-level outcomes. Together, these pillars turn every edit into a falsifiable contract"; `::sec05` adds "recorded change manifests, next-round attribution, and per-edit rollback."

The purpose is not to crown an overall "best model." It is to learn which model best performs each deliberately different board function.

---

## 5. Summoned specialists—not permanent voters

Permanent boards tend to grow until debate becomes ceremony. Specialists therefore appear only when triggered, contribute evidence and do not normally vote.

| Specialist witness | Trigger | Question owned |
|---|---|---|
| Operator & User Advocate | Any staff-facing workflow or material change to work | Does this solve the real job, reduce effort and preserve understandable control? |
| Security, Data & IP Steward | Personal data, credentials, external models/APIs, training data, customer documents or novel IP | Is the proposed evidence/use lawful, secure, isolated and governable? |
| Commercial & Complexity Accountant | New vendor, infrastructure, service, model, store, licence or ongoing support burden | What is the full cost and complexity delta, including the quiet costs after launch? |
| Domain Specialist | Product rules, procurement, SAP, finance, warehouse, sales, lighting design or another specialist domain | Are the assumptions and proposed success measures valid in the actual domain? |

Any permanent member may summon a witness. Security, live mutation and regulated-data triggers summon the relevant witness automatically.

---

## 6. Evidence hierarchy

The Board classifies every important input before debating it.

### 6.1 Source classes

1. **Observed primary evidence:** source code, executed tests, live or representative telemetry, official specification, original paper/data, API contract, direct operator observation.
2. **Corroborated evidence:** independent reproductions, systematic reviews, multiple credible implementations or consistent internal results.
3. **Inferred claim:** reasoned conclusion supported by observations but not directly measured.
4. **Recommendation:** a proposed action or design choice.
5. **Promotional/speculative claim:** vendor copy, social clip, unsourced assertion, cherry-picked demonstration or unverified forecast.

VTP content may contain all five. The medium does not determine the class.

**Bibliography exclusion (v0.3).** A citation appearing in another document's reference list is **not** evidence for the cited claim. Retrieving a bibliography line establishes only that someone cited something. It may motivate a search; it may never be quoted as support.

### 6.2 Required labels

Every extracted claim receives:

- `claim_id`
- exact or faithfully paraphrased claim
- source and date
- source class
- scope and stated conditions
- mechanism proposed
- evidence supplied
- important missing evidence
- internal relevance hypothesis
- confidence

Unknowns remain unknown. They do not become zero, false or "probably fine."

---

## 7. The Clarity Capability and Process Map

The Board cannot find good slots without a current map of what already exists. SGSD therefore maintains a versioned, deterministic capability map.

**Location (operator decision, v0.3):** the map is a **separately versioned projection** at `.planning/rd/capability-map/`, consumed by SGSD but never authoritative over it. This preserves §2 invariant 8 and keeps the map cheap to iterate or delete should the treaty fail its acceptance tests.

### 7.1 Required dimensions

For each material process or capability:

- JCL job/user journey and responsible team;
- process stages, handoffs and decisions;
- current pain and baseline evidence;
- Clarity module/UI;
- repository paths and owning package/service;
- engine or algorithm;
- inbound/outbound APIs and MCP tools;
- data stores, schemas and authoritative source;
- scheduled jobs, queues and background workers;
- external providers and licences;
- inputs, outputs and downstream consumers;
- current SLI/SLO or observable proxy;
- feature flags, rollback and failure containment;
- lifecycle state: active, experimental, legacy, duplicated, planned or unknown.

### 7.2 Progressive inspection

The Board must not blindly stuff the entire repository into every agent context.

1. Refresh a deterministic repository/capability index when material code or architecture changes.
2. Use the VTP claims to retrieve candidate processes and capability cards.
3. Inspect only the relevant code, contracts, engine implementations, APIs and dependants in depth.
4. Expand one dependency hop at a time when evidence indicates wider impact.
5. Record what was not inspected and why.

This provides broad awareness without paying to reread Clarity from birth on every session.

### 7.3 Valid slot types

A candidate may target:

- a process step or handoff;
- a human decision or approval;
- an extraction, classification, retrieval, matching or forecasting engine;
- a data contract, source-of-truth boundary or quality control;
- an API/tool boundary or integration;
- an orchestration/routing decision;
- an evaluation, observability or accountability gap;
- a user interface or explanation point;
- infrastructure or runtime efficiency; or
- deletion of an obsolete step or component.

"AI layer," "Clarity generally" and "make it smarter" are not slots.

---

## 8. Candidate placement modes

Every candidate receives exactly one initial placement mode:

| Mode | Meaning |
|---|---|
| `DELETE` | Remove a requirement, process or component; no replacement is needed |
| `REPLACE` | Candidate competes directly with a named incumbent |
| `AUGMENT` | Candidate adds a bounded capability to an existing component |
| `COMPOSE` | Existing capabilities are recombined; no new core primitive is required |
| `OBSERVE` | Candidate improves measurement, provenance or diagnosis only |
| `NEW_PRIMITIVE` | A genuinely missing shared capability is proposed |
| `RESEARCH_ONLY` | Interesting and credible, but no current Clarity slot |
| `NO_SLOT` | Relevance was not established |
| `REJECT` | Evidence, fit, safety or economics fail |

`NEW_PRIMITIVE` carries the highest burden of proof. `DELETE`, `COMPOSE` and extension of an existing component must be considered first.

---

## 9. The SpaceX sequence—mandatory at every design gate

Before building or automating, the Board performs these steps in order:

1. **Challenge the requirement.** Who owns it? What observed need created it? Under what conditions is it valid?
2. **Delete the part or process.** Can the problem, handoff, rule, service, data copy, model call or approval be removed?
3. **Simplify and optimise.** Can the incumbent, a configuration change or a smaller extension solve it?
4. **Accelerate feedback.** What is the shortest safe cycle that produces meaningful evidence?
5. **Automate last.** Only automate a stable, understood and valuable path.

No proposal may claim a simpler system while adding an unaccounted service, agent, data store, vendor API, framework, queue or source of truth.

---

## 10. Promotion gates

The stages combine aerospace readiness, GDS service phases and challenger testing.

### 10.0 Gate structure is not uniform

> **New in v0.3.** `design-of-everyday-things::ch07::0169`: *"Decision gates give management much better control over the process than they have in the iterative methods. However, they are cumbersome… Weeks can be wasted… The best methods combine the benefits of both iteration and stage reviews. Iteration occurs inside the stages, between the gates."*

Two consequences bind:

**Iteration inside gates is explicitly permitted.** A gate is a review boundary, not a work boundary. Refining the problem, the fixture or the candidate architecture *within* a gate requires no new convening.

**Fast path.** A candidate whose complexity delta declares **zero additions** and whose placement mode is `DELETE`, `OBSERVE` or `COMPOSE` runs **R0 → R2 → R5 only**. The intermediate gates exist to control the risk of adding things; a candidate that adds nothing does not need them. Any candidate that acquires an addition mid-flight drops back onto the full path.

### Gate R-0 — Convening triage

> **New in v0.3.** `agentark::sec02`: *"In densely connected networks, computation can grow quadratically with the number of agents, making MAS prohibitively expensive"* and *"individual biases or hallucinations can propagate and amplify across the group, leading to collective failures in robustness and safety."* `gated-coordination::sec07`: *"scalable collaborative efficiency stems not from maximizing communication volume, but from the rigorous, dynamic governance of interaction boundaries."*

**Question:** Does this candidate warrant a four-seat board at all?

**Who runs it:** the Cartographer alone, plus deterministic checks against the capability map.

**Disposes of, without convening the board:** `NO_SLOT` candidates; duplicates of an existing engine/API; candidates already on the Radar in `Hold` or `Reject` whose reopening trigger has not fired.

**Escalates to the full board:** everything else.

The full four-seat board is a scarce resource that costs real money and can amplify a shared error. Convening it is a decision, not a reflex. Every R-0 disposal is logged and is reversible by the operator.

### Gate R0 — Claim integrity

**Question:** What is actually being claimed, and is it credible enough to investigate?

**Must have:** claim ledger, source provenance, conditions, mechanism and missing evidence.

**Outcomes:** `REJECT`, `RESEARCH_ONLY`, or advance.

### Gate R1 — Problem and slot

**Question:** Is there a real JCL problem and an exact Clarity slot?

**Must have:** process observation, current solution, named slot, owner, dependants and baseline proxy.

**Hard fail:** no slot, invented problem, duplicate capability or no accessible evidence of current performance.

### Gate R2 — Deletion and experiment design

**Question:** Is this the smallest sensible change, and what evidence would kill it?

**Must have:** deletion attempt, simpler alternatives, candidate architecture, test plan, targets, protected metrics, complexity estimate and stop conditions.

**Hard fail:** success cannot be distinguished from failure; target chosen after results; prototype would create an uncontrolled production dependency.

### Gate R3 — Disposable spike

**Question:** Does the mechanism work at all on representative Clarity/JCL material?

**Rules:** sandboxed, read-only by default, no production dependency, synthetic or safely copied data, time-boxed and expected to be thrown away.

**Must have:** reproducible receipt, measured result, known limitations and artefact expiry date.

### Gate R4 — Shadow trial

**Question:** Does it work on real flows without controlling them?

**Rules:** observes real inputs, records what it would have done, performs no authoritative write/action and cannot silently become a production dependency.

**Must have:** representative coverage, provenance, disagreement analysis, failure taxonomy, latency/cost/operability measures and automatic stop rules.

### Raw-artefact adjudication — binding on R3 and R4

> **New in v0.3.** `why-llms-arent-scientists-yet::sec01::0010`: *"even when results showed clear degeneracies or failures, the generated text focused only on top-level positive indicators, ignoring fundamental problems, and this could be tracked back to relying on report files created during the experiment execution stage to evaluate output instead of examining raw logs."* The same source records models claiming *"the first ever paper"* and *"seminal contributions"* regardless of actual output, and confidently declaring victory *"when numerical signals are still obviously noise."*

**No gate may be passed on the basis of a summary, report file, or agent-authored result narrative.** The Experimentalist must cite raw logs, raw outputs, or executed-command receipts. A result narrative is a claim (§6.1 class 3), never an observation.

**Superlative bar.** Any memo containing unearned novelty language — "first", "seminal", "breakthrough", "state of the art" — is returned unread. Rewriting it is not a penalty; it is the cost of the claim.

### Gate R5 — Challenger bake-off

**Question:** Does the candidate beat the incumbent or the simplest alternative?

**Must have:** frozen evaluation set, real denominator, primary metric, protected category metrics, confidence/uncertainty, cost and complexity delta.

**Winning rule:** the candidate must materially improve at least one predeclared primary outcome, remain inside every protected threshold, and outperform simpler alternatives after operational and migration cost.

An aggregate improvement cannot hide harm to a critical category. For example, a model that improves average SKU matching but worsens hard-constraint false accepts does not win.

**Hard fail — baseline validity (new in v0.3).** Before any bake-off is scored, the incumbent baseline must be demonstrated to reproduce its own known-good performance on the frozen fixture. A degenerate baseline voids the comparison; the candidate does not win by default. Basis: `why-llms-arent-scientists-yet::sec01::0011` — models *"lacked judgment about experimental validity thresholds - for instance, proceeding with hypothesis testing when baseline performance was 95% below established benchmarks, making any comparative analysis scientifically meaningless."*

### Gate R6 — Bounded live pilot

**Question:** Can the proven candidate operate safely in a small, reversible production boundary?

**Requires operator promotion.**

**Must have:** named cohort, feature flag, owner, monitoring, support playbook, security/data clearance where relevant, rollback test, error/risk budget and end date.

**Threshold convention (v0.3).** Pilot targets follow existing JCL practice: a named cohort size, a window length, and a numeric target. Precedent — `wiki/meetings/jack-herman-clarity-overview.md`: *"Customer-portal pilot (Idea 0) — 5-client / 4-week pilot, 40% reduction in status-related calls threshold."*

### Gate R7 — Adopt, standardise or retire

**Question:** Did the live pilot create durable value, and what existing complexity can now be removed?

**Must have:** user outcome, operational result, final cost, incident/failure record, documentation, ownership, old-component retirement plan and follow-up date.

**Outcomes:** `ADOPT`, `EXTEND_PILOT`, `ROLL_BACK`, `PARK`, or `RETIRE`.

Adoption is incomplete until displaced flags, jobs, code paths, stores, prompts, vendor calls or manual steps are either removed or explicitly retained by a named owner for a stated reason.

**Parallel-run requirement (new in v0.3).** Displacement requires a parallel-run window — **default 4–8 weeks** — plus telemetry showing the incumbent path is actually unused. **Retirement on the grounds that the candidate works is prohibited**; retirement requires evidence that the old path has stopped being used. Precedent — `wiki/meetings/alex-jack-procurement-sharpalite-meeting.md`: *"Run Clarity tabs in parallel with SharpaLite for 4–8 weeks post-cutover; retire SharpaLite only after telemetry shows tabs displace exports,"* with cross-domain support from the Netflix 2015 batch-to-streaming migration, which required both systems running in parallel for 6–8 weeks.

---

## 11. Readiness is multidimensional

> **Evidence status (v0.3):** OPERATOR JUDGEMENT. No NASA TRL, GAO TRA or equivalent readiness material exists in VTP. The four-axis model below is retained on its merits. Standard caution applies: **a readiness number that becomes a target stops being a measurement.** Axis scores are an aid to the weakest-axis rule below, not a score to be optimised.

One maturity number is misleading. The Board records four separate readiness levels from 0–5:

| Axis | 0 | 3 | 5 |
|---|---|---|---|
| Evidence readiness | Assertion only | Reproduced on representative JCL cases | Stable measured outcomes across relevant regimes |
| Integration readiness | No known slot | Interfaces and dependencies proven in shadow | Operable through supported Clarity contracts |
| Operational readiness | No owner/monitoring | Pilot controls and rollback proven | Sustainable owner, SLO, runbook and retirement path |
| Adoption readiness | No user validation | Users can complete the journey in trial | Durable improvement to real work with acceptable cognitive load |

A candidate advances according to its weakest critical axis, not its most impressive axis.

---

## 12. Complexity budget and anti-bloat law

Every candidate declares its **complexity delta**:

- services/processes added and removed;
- persistent stores or indexes added and removed;
- new schemas, queues, jobs and contracts;
- runtime and build dependencies;
- external vendors, APIs and model calls;
- security/privacy surface;
- monitoring, on-call and support burden;
- operator steps and new failure states;
- migration and future exit cost.

### Binding laws

1. **No orphan component:** every added component has an owner, consumer, SLO/proxy, failure behaviour and removal route.
2. **No duplicate truth:** a candidate may not create a second authoritative source merely for convenience.
3. **No invisible permanence:** all spikes and pilots have an expiry date. Passing the date without promotion retires them.
4. **No unpriced novelty:** infrastructure, token/API cost and maintenance time are part of the result.
5. **Deletion earns credit:** removing moving parts, calls, data copies or operator steps is a first-class outcome.
6. **Net-new primitives require a hurdle:** they must demonstrate a materially greater benefit than an extension/composition alternative.
7. **Pilot code is not presumed production-grade:** successful evidence may justify a clean implementation rather than promotion of the spike.

The Board may use a locally calibrated value model, but no weighted score can override a hard safety, source-of-truth, critical-accuracy or operator-authority gate.

The structured-artefact discipline this section imposes is corpus-supported: `shift-up::sec01` finds that embedding machine-readable requirements and architectural artefacts *"stabilizes agent behavior, reduces implementation drift, and shifts human effort toward higher-level design and validation activities."*

---

## 13. Board procedure

### 13.1 Intake

The session receives one or more of:

- VTP transcript or summary;
- paper, article, video or vendor material;
- operator hypothesis;
- incident or recurring process failure;
- new library/framework/model/API/engine;
- competitor or cross-industry practice; or
- internal code, telemetry or workflow evidence.

SGSD creates a neutral source ledger and declares scope, repository/ref, environment, date and access limitations.

### 13.2 Independent first positions

Each permanent member produces an initial memo before reading the other agents' conclusions. This reduces anchoring and conversational convergence. Corpus-supported: `diversity-collapse::sec06` finds that *"interaction designs that preserve independence, such as the blind-writing phase of NGT and subgroup isolation, consistently yield higher diversity."*

Each memo contains:

- observations cited;
- inferences;
- recommendation;
- confidence;
- strongest uncertainty;
- evidence that would reverse the recommendation;
- strongest case against the member's own position; and
- **a predeclared prediction of the candidate's eventual gate outcome** (§4.5 rule 16).

### 13.2.1 Topology is phase-dependent

> **New in v0.3.** Two corpus findings pull in opposite directions and must be reconciled by phase rather than by picking a winner.
>
> - `diversity-collapse::sec01` — parallelism and independence preserve diversity; dense communication accelerates premature convergence.
> - `the-sequential-edge::sec04` — *"Sequential reasoning outperforms parallel approaches in 43 out of 45 configurations (95.6% win rate) across all 5 models and 3 benchmarks, with accuracy gains up to 46.7 percentage points."* `::sec07` notes the cost is wall-clock latency.

**Divergent phases (R-0 → R2) run parallel and independent.** These phases need coverage of the option space; premature agreement is the failure mode.

**Convergent adjudication (R5) runs as sequential refinement chains.** This phase needs accuracy on a narrowed question; latency is an acceptable price.

A single topology must not be used for both.

### 13.3 Cross-examination

The Cartographer's slot map is distributed to all seats **as data** before debate opens. It is not an opening argument.

**Speaking order is randomised per candidate.** Basis: `diversity-collapse::sec01` — *"At the cognition level, authority-driven dynamics suppress semantic diversity compared to junior-dominated groups."* v0.2's fixed order, which always opened with the Cartographer, installed exactly the authority dynamic the corpus warns against.

Within a round, the substantive obligations are unchanged:

1. The problem, incumbent and slot are established from the distributed slot map.
2. The requirement is challenged; deletion and simpler alternatives are proposed.
3. The highest-leverage bounded interpretation is proposed.
4. Material disagreements are converted into tests and thresholds.
5. Members may correct factual errors, but new uncited claims remain claims.

### 13.3.5 Round cap and re-independence

**Cross-examination is capped at two rounds.** Between rounds, each seat re-answers **privately, without seeing others' revisions**. Communication is a bounded resource, not a default. Basis: `gated-coordination::sec07` — efficiency comes from *"the rigorous, dynamic governance of interaction boundaries"*, with communication treated as *"a selective, calculated decision"* rather than a reflex; and `diversity-collapse::sec01` on dense topologies accelerating convergence.

### 13.4 Evidence validation

SGSD's evidence validator checks citations, repository paths, executed commands, metric denominators, source dates and observation/claim separation. It does not decide product merit.

It additionally enforces the §6.1 bibliography exclusion and the §10 superlative bar.

### 13.5 Decision rule

The Board does not decide by vibes or simple average score.

- `R0–R2` advancement requires at least three of four recommendations, Cartographer `SLOT_PASS`, Experimentalist `TESTABLE`, and no unresolved hard risk.
- Contrarian objections must be answered or converted into a test. The Contrarian has no taste-based veto.
- Moonshot upside cannot override missing evidence, fit or safety.
- Production advancement always requires an operator `promotion_decision`.
- A factual deadlock becomes an experiment. A value/policy deadlock becomes an operator checkpoint.
- Abstention due to missing evidence is not counted as approval.

### 13.5.1 Blind ballot

> **New in v0.3 — the highest-severity change in this revision.** `llms-exhibit-normative-conformity::sec02::0000`: under a named ballot, *"four models—excluding llama-3.1-8b and gpt5.1—showed higher conformity tendencies under the w/ name condition than under the w/o name condition, confirming the presence of normative conformity."* And `::sec02::0001` on peer endorsement: *"when an LLM observes other participants supporting a specific speaker during discussion, it may become more likely to agree with that speaker's opinion"* — four of six models.
>
> v0.2's §13.5 required "at least three of four recommendations" and ran attributed cross-examination. That reproduces, precisely, the conditions measured to inflate conformity.

Binding:

1. **Final per-seat verdicts are submitted privately to SGSD** and are not visible to other seats.
2. **Findings are presented de-identified during cross-examination** — `FINDING-n`, never by seat or model name.
3. **No running tally, endorsement count, or majority indication is ever exposed to a voting model.**
4. **Attribution is restored only in the operator-facing memo**, after all voting has closed.

Combined with §4.5 rule 15 (ledger blindness), this removes all four measured conformity amplifiers: publicness, peer endorsement, subsequent evaluation, and continuity of relationship.

### 13.6 Permitted verdicts

- `ADVANCE`
- `ADVANCE_WITH_CONDITIONS`
- `NO_SLOT`
- `RESEARCH_ONLY`
- `PARK_UNTIL_TRIGGER`
- `REJECT_EVIDENCE`
- `REJECT_FIT`
- `REJECT_COMPLEXITY`
- `REJECT_RISK`
- `ROLL_BACK`
- `ADOPT`
- `RETIRE`

Every non-advance verdict states the condition that would justify reopening it.

---

## 14. Candidate opportunity dossier

> **Amended in v0.3.** The dossier is a **projection over an append-only event log**, not a mutable document. Basis: `stateless-decision-memory::sec02` — a regulated deployment *"must support deterministic replay so that a denied applicant can be re-scored and the same decision justified; it must expose an auditable rationale trail a regulator, internal audit function, or court can inspect"*; `::sec03::0001` — *"an immutable append-only event log is the authoritative state and every derived view is a pure projection over the log."*

**Binding:** every claim, observation, memo, verdict and operator decision is appended to the candidate's event log. Any dossier state must be reconstructible by replaying the log to a timestamp. **In-place editing of a dossier field is prohibited** — a correction is a new event that supersedes an earlier one, and both remain in the log.

The YAML below is the *rendered projection shape*, not a file to be edited:

```yaml
candidate_id: RD-YYYY-NNN
title: ""
source_claim_ids: []
problem_observation_ids: []
plain_language_problem: ""
slot:
  business_process: ""
  module_or_service: ""
  repository_paths: []
  engine_or_api: []
  source_of_truth: ""
  owner: ""
incumbent:
  current_method: ""
  baseline_metrics: {}
  baseline_validity_check: ""     # v0.3 — R5 hard fail if unproven
placement_mode: DELETE|REPLACE|AUGMENT|COMPOSE|OBSERVE|NEW_PRIMITIVE|RESEARCH_ONLY|NO_SLOT|REJECT
fast_path_eligible: false          # v0.3 — zero additions AND mode in {DELETE,OBSERVE,COMPOSE}
mechanism_hypothesis: ""
simpler_alternatives: []
expected_benefit: ""
primary_metric: ""
protected_metrics: []
complexity_delta:
  additions: []
  removals: []
  operational_cost: ""
readiness:
  evidence: 0
  integration: 0
  operations: 0
  adoption: 0
experiment:
  falsifiable_hypothesis: ""
  frozen_fixture_or_cohort: ""
  pass_threshold: ""
  kill_conditions: []
  expiry_date: ""
seat_predictions: []               # v0.3 — predeclared per-seat gate-outcome predictions
divergence_score: null             # v0.3 — first-pass semantic divergence; below floor = round void
rollback: ""
retirement:
  parallel_run_window: ""          # v0.3 — default 4-8 weeks
  displacement_telemetry: ""       # v0.3 — evidence incumbent path is unused
board_recommendation: ""
operator_decision: "pending"
event_log_ref: ""                  # v0.3 — authoritative append-only log
lineage_ids: []
```

The schema is a projection format. Canonical authority remains with the event log, cited evidence and SGSD CMBs.

---

## 15. Required session output

Every `/rd-board` session returns an answer-first report containing:

1. **Verdict:** what should happen now.
2. **External idea in plain language:** what is genuinely new.
3. **Current-state map:** how JCL/Clarity handles the problem today.
4. **Candidate slots:** ranked exact locations, including `NO_SLOT` where appropriate.
5. **Board positions:** agreements, disputes and confidence — with attribution restored (§13.5.1 rule 4).
6. **Incumbent and simpler alternatives:** including deletion.
7. **Proposed experiment:** smallest decisive test, success threshold and kill criteria.
8. **Complexity delta:** what is added, removed and newly operated.
9. **Readiness card:** four separate readiness axes.
10. **Decision request:** only the operator choice genuinely required.
11. **Evidence ledger:** sources, repo paths, tests, telemetry and explicit gaps.
12. **Denominator panel:** scope excluded, code not inspected, gates skipped, assumptions, alternatives rejected and risks unresolved.
13. **Divergence panel (v0.3):** first-pass divergence score, whether any round was voided, and whether the board convened at all or was disposed of at R-0.

The report may recommend no implementation. This is a healthy output, not a failed session.

---

## 16. R&D Radar and memory

Clarity maintains a living radar with these states:

- **Observe:** credible signal, relevance not yet established;
- **Assess:** source and internal slot under investigation;
- **Spike:** disposable mechanism test approved;
- **Shadow:** testing on real flows without authority;
- **Challenger:** formal bake-off against the incumbent;
- **Pilot:** bounded live operation approved;
- **Adopt:** standard supported capability;
- **Hold:** not currently suitable; reopening trigger recorded;
- **Reject:** failed evidence, fit, complexity or risk;
- **Retire:** experiment or incumbent removed.

Each radar entry has an owner, last evidence date, next trigger, expiry date and linked decision lineage. Rejected ideas are retained so the same fashionable proposal does not consume a fresh week every six months.

**Attention cap (v0.3).** No more than **12 entries** may sit in an operator-actionable state (`Assess`, `Spike`, `Shadow`, `Challenger`, `Pilot`) at once. Beyond that, the lowest-priority entries are moved to `Observe` until capacity frees. Precedent — `wiki/meetings/alex-jack-procurement-sharpalite-meeting.md`: *"Industrial SCADA 'alarm flood' reviews are mandatory because operators can't triage >10–12 active alarms before decision latency collapses."* A radar the operator cannot hold in their head is a backlog, not a radar.

---

## 17. Safety, escalation and autonomy

### Autonomous actions allowed

- read-only repository, document, API-contract and schema inspection;
- deterministic capability mapping;
- source verification and comparison;
- read-only test execution in an approved environment;
- design of fixtures, experiments and evaluation plans;
- generation of recommendations and reports.

### Mandatory operator checkpoint

- live or authoritative writes;
- destructive changes or data migration;
- SAP, Mongo, payment, dispatch or external-system mutation;
- credential/security changes;
- upload of customer/company data to a new external service;
- new paid vendor or material recurring cost;
- new source of truth or persistent production store;
- expansion beyond the declared session scope;
- low-confidence decision with material business impact;
- progression to Gate R6 or R7.

The safest evidence-rich path is preferred when several read-only routes exist. Scope must not silently broaden.

---

## 18. Treaty acceptance tests

> **Amended in v0.3.** These ship as **executable fixtures** with recorded inputs and asserted verdicts, runnable as a regression suite on every treaty or prompt-template change — not as prose to be read and agreed with. Basis: `shift-up::sec03` — under the guardrailed approach prompts shifted to *"process orchestration and automated validation"* (62% next-step, 16% executing acceptance tests), versus the unstructured arm where *"more than half of all prompts were dedicated to addressing issues identified manually in GUI or IDE (52%)."*

The first implementation is not complete until it demonstrates these fixtures:

1. **Shiny idea, no slot:** a persuasive VTP claim is accurately extracted but returns `NO_SLOT`; no code work is dispatched.
2. **Existing capability found:** a proposed new service is shown to duplicate an existing engine/API; the Board recommends composition or extension.
3. **Deletion wins:** research exposes that removing a process step beats automating it.
4. **Test before build:** a plausible candidate produces a frozen fixture, incumbent baseline, pass threshold and kill criteria before implementation.
5. **Critical regression detected:** average performance improves, but a protected category worsens; the candidate does not advance.
6. **Shadow remains shadow:** a successful shadow trial cannot perform authoritative writes and expires without operator promotion.
7. **Complexity accounted:** additions, removals and ongoing operational costs are present in the verdict.
8. **Lineage shown:** source claim → internal observation → member findings → evidence verdict → board recommendation → operator decision.
9. **Independent disagreement preserved:** agent memos retain materially different positions rather than converging into paraphrases.
10. **Adoption removes debris:** a winning candidate cannot close R7 until displaced paths are removed or explicitly retained.
11. **Model diversity enforced:** all four initial memos contain different model IDs across both approved providers; a silent fallback fails treaty validation.
12. **Model upgrade challenged:** replacing one sitting model requires a role-specific bake-off on historical cases and preserves the prior result for comparison.

**New in v0.3:**

13. **Convergence voids the round:** four artificially similar first-pass memos drive `divergence_score` below the floor and the round is voided rather than recorded as consensus.
14. **Blind ballot holds:** no seat prompt in a recorded run contains another seat's name, position, a running tally, or any indication of being scored.
15. **Summary rejected:** a gate attempt citing only a report file — with the raw log available and contradicting it — fails R3/R4.
16. **Degenerate baseline voids the bake-off:** an incumbent that cannot reproduce known-good performance blocks R5 scoring; the candidate does not win by default.
17. **R-0 disposes without convening:** a duplicate-capability candidate is closed by the Cartographer alone, and the cost ledger shows no four-seat spend.
18. **Retirement blocked without displacement:** a working candidate cannot close R7 while telemetry still shows the incumbent path in use.

### Example Clarity fixtures

- **Dynamic-budget active learning:** test as a label-selection policy for uncertain SKU/document cases, not as a vague "AI improvement." Compare labelled-error reduction per operator minute against fixed-budget sampling.
- **Local SLM:** test in one bounded routing or tagging slot against deterministic rules and paid-LLM behaviour. Measure task accuracy, abstention quality, latency, hardware/operations cost and critical errors.
- **Provenance tracer:** first test whether existing Clarity logs and CMB lineage can answer the target questions. Add a new telemetry store only if the missing evidence is demonstrated.

---

## 19. Research foundation

### 19a. External practice (operator judgement — not in VTP)

- [DARPA — The Heilmeier Catechism](https://www.darpa.mil/about/heilmeier-catechism)
- [NASA — Technology Readiness Levels](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/technology-readiness-levels/)
- [NASA — Systems Engineering Handbook](https://www.nasa.gov/wp-content/uploads/2018/09/nasa_systems_engineering_handbook_0.pdf)
- [US GAO — Technology Readiness Assessment Guide](https://www.gao.gov/products/gao-20-48g)
- [Everyday Astronaut — Starbase tour and five-step engineering process](https://everydayastronaut.com/starbase-tour-and-interview-with-elon-musk/)
- [Toyota — Toyota Production System](https://global.toyota/en/company/vision-and-philosophy/production-system/index.html)
- [GOV.UK — Discovery phase](https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works)
- [GOV.UK — Alpha phase](https://www.gov.uk/service-manual/agile-delivery/how-the-alpha-phase-works)
- [GOV.UK — Beta phase](https://www.gov.uk/service-manual/agile-delivery/how-the-beta-phase-works)
- [Thoughtworks — Technology Radar](https://www.thoughtworks.com/en-us/radar)
- [Google SRE — Service Level Objectives and error budgets](https://landing.google.com/sre/sre-book/chapters/service-level-objectives/)
- [FDA — Design controls: verification and validation](https://www.fda.gov/media/116762/download)

### 19b. Corpus evidence (VTP — retrieved and verified 22 July 2026)

| Slug / chunk | arXiv | Used for |
|---|---|---|
| `diversity-collapse-in-multi-agent-llm-systems` §1, §6 | 2604.18005 | §4.5 r13, §13.2, §13.3, §13.3.5 |
| `llms-exhibit-normative-conformity` §2::0000, §2::0001 | 2604.19301 | §13.5.1, §4.5 r15 |
| `why-llms-arent-scientists-yet…` §1::0010, §1::0011 | 2601.03315 | §10 raw-artefact, §10 R5 baseline validity |
| `agentark-distilling-multi-agent-intelligence…` §2 | 2602.03955 | §10 Gate R-0 |
| `gated-coordination-multi-agent-collaboration` §7 | 2604.18975 | §10 Gate R-0, §13.3.5 |
| `stateless-decision-memory-for-enterprise-ai-agents` §2, §3::0001 | 2604.20158 | §14 event log |
| `agentic-harness-engineering…` §1, §5 | 2604.25850v1 | §4.5 r16 prediction ledger |
| `the-sequential-edge-inverse-entropy-voting…` §4, §7 | 2511.02309 | §13.2.1 topology split |
| `shift-up-se-guardrails-for-ai-native-development` §1, §3 | 2604.20436 | §12, §18 executable fixtures |
| `superficial-success-vs-internal-breakdown` §1, §4 | 2604.18951 | §20 transfer scoring |
| `the-design-of-everyday-things…::ch07::0169` | — | §10.0 fast path, in-gate iteration |
| `wiki/books/fundamentals-of-software-architecture.md` | — | §16 Radar ring semantics |
| `wiki/meetings/multi-agent-framework.md` | — | §4 four-role precedent |
| `wiki/meetings/alex-jack-procurement-sharpalite-meeting.md` | — | §10 R7 parallel run, §16 attention cap |
| `wiki/meetings/jack-herman-clarity-overview.md` | — | §10 R6 threshold convention |

**Searched and empty.** No VTP material exists on: NASA TRL, GAO TRA, DARPA Heilmeier, GDS phases, Toyota Production System, Google SRE error budgets, FDA design controls, stage-gate literature proper, or benchmark contamination as a topic. LLM-as-judge bias appears only as bibliography entries inside `metis-mentoring-engine…::sec28`, which are excluded as evidence under §6.1.

**Not searched.** `vtp_search_book_figures`; `vtp_route_and_retrieve`; per-paper enrichment payloads (~70 papers carry 8–12 distilled principles each — a second pass would likely surface more); `vtp_research_gate`; `wiki_find_contradictions`; the entity/speaker graph. The 91-book corpus was touched with a single query; management and innovation-process literature there is essentially unexplored.

---

## 20. Recommended initial implementation slice

Do not begin by building an autonomous six-agent research platform. Prove the treaty with a narrow SGSD slice:

1. create the deterministic Clarity capability-map schema at `.planning/rd/capability-map/` and populate three representative domains;
2. implement the claim ledger, the append-only event log, and the opportunity dossier projection;
3. run the four independent role prompts against three historical VTP/research examples — under blind ballot and ledger blindness from the first run;
4. add deterministic evidence/lineage validation, including the bibliography exclusion and superlative bar;
5. produce the answer-first board report, divergence panel and R&D Radar entry;
6. verify all eighteen acceptance fixtures as executable tests; and
7. only then consider automation of repository retrieval, recurring radar review or experiment dispatch.

**v1 gate scope:** R-0 → R2 only. R3–R7 are defined here but not automated in the first slice.

Suggested first domains:

- document-to-product / SKU matching;
- procurement and forecasting; and
- document-chain provenance / observability.

They contain different problem types, engines, data, users and risk profiles, so they will reveal whether the treaty generalises without requiring a whole-Clarity rollout.

**Transfer scoring is mandatory (v0.3).** The three-domain pilot is a topology-transfer test, and must report **per-domain verdict quality and internal-interaction quality separately**. Basis: `superficial-success-vs-internal-breakdown::sec01` — adaptive multi-agent systems exhibit *"(1) topological overfitting—they fail to generalize across different domains; and (2) illusory coordination—they achieve reasonable surface-level accuracy while the underlying agent interactions diverge from ideal MAS behavior"*; `::sec04` calls for *"evaluating them through rigorous internal analysis rather than accuracy in isolation."*

**A board that reaches the right verdict via broken internal collaboration fails.**

---

## 21. Operator decisions — status

| # | Decision | Status |
|---|---|---|
| 1 | Confirm the permanent four: Systems Cartographer, Experimentalist, Contrarian, Moonshot | **CONFIRMED** — and backed by existing precedent in `multi-agent-framework.md` |
| 2 | Confirm the 2×2 model assignment: Opus 4.8 / GPT-5.6 Sol / GPT-5.5 / Fable 5 | **CONFIRMED** — both OpenAI IDs verified available in codex CLI 0.144.3 on workstation and devcp |
| 3 | Commercial & Complexity Accountant: always at R5, or only on paid/persistent infrastructure? | **OPEN** |
| 4 | First three historical VTP/research cases for the acceptance run | **OPEN** |
| 5 | Capability map: inside SGSD context-authority, or separate projection? | **RESOLVED** — separate versioned projection at `.planning/rd/capability-map/` |

### New in v0.3 — open decisions

| # | Decision | Status |
|---|---|---|
| 6 | Calibrate the §4.5 r13 divergence floor | **PROVISIONAL (n=1).** Set to `0.40` after RD-2026-001 scored 0.866 with verdict spread 3. Far below the only healthy round observed, so it should catch four-paraphrase convergence without false-voiding real disagreement. **Not calibrated** — one datapoint cannot establish a distribution, and no round has yet been observed that *should* be voided. Review at n=5 or on first void. |
| 7 | Confirm the §16 attention cap of 12 | **OPEN.** Borrowed from the SCADA alarm-flood precedent; not derived for R&D. Untested — the radar currently holds 2 entries. |
| 8 | Approve §4.5 r14 heterogeneity | **OPEN.** Permits one deliberately cheaper/less-aligned seat as a diversity source. Interacts with the confirmed 2×2 lineup. |

---

## 22. v0.3.1 — corrections from the first live run

RD-2026-001 (22 July 2026) was the treaty's first live session. It surfaced two defects in the
harness — not in the candidate, and not in the seats — plus one design lesson. All are fixed here.

### 22.1 Provenance was required but never collected (§4.5 r5)

Rule 5 requires every memo to record provider, exact model ID, reasoning mode, prompt-template
version and completion timestamp. **Not one of the four memos carried any of it.** Nothing in the
session's artefacts proved which models actually sat, which makes the run unreproducible in
exactly the sense rule 5 exists to prevent, and would have made any later bake-off (rule 9)
uninterpretable.

**Fixed:** `provenance` is now a required, mechanically-validated block. The orchestrator supplies
provider/model/effort in the dispatch prompt and the seat echoes it back — a model is never asked
to guess its own identity. `rd-memo-schema.cjs` enforces it via `requireProvenance`.

### 22.2 Predictions were tautological (§4.5 r16)

Rule 16 requires a predeclared, falsifiable prediction so the ledger scores forecasting skill
rather than post-hoc plausibility. **All four seats set `prediction.gate_outcome` equal to their
own verdict**, which forecasts nothing. The prompt asked for "your prediction of where this
candidate ends up", which invites exactly that.

**Fixed:** seats are now asked to forecast **the board's overall conclusion**, explicitly noting
that this often differs from their own position and that expecting to lose an argument is a
legitimate forecast. Matching one's own verdict is still permitted — a seat may genuinely expect
agreement — but it is flagged `tautological` and **excluded from `forecast_accuracy`** rather than
scored as correct. Rejecting on match would punish honest agreement; flagging keeps the ledger
meaningful without doing so. See `scorePredictions()`.

**A round where every seat echoes itself is a prompt failure, not a model result**, and must be
reported as uninformative rather than as a null score.

### 22.3 Design lesson: the pack's declared gaps are where the value was

The Cartographer listed `QdrantItemService` and the enrichment `agreement_status` signals as
things it had *not* opened. Another seat opened them and found the continuous ranking signal that
reframed the entire candidate — and a third dead review loop nobody had counted.

**Consequence:** §7.2's "record what was not inspected and why" is not bookkeeping. The
`not_inspected` list is a work queue for the other seats, and the observation pack must carry it
verbatim into every seat's prompt. This is now explicit in the skill's Step 4.

### 22.4 What held up

Blind ballot, ledger blindness, the superlative bar and the schema validator all functioned
mechanically on first use. The strongest result of the session — two seats on different providers,
holding opposite verdicts, independently proposing the same remedy — is only interpretable
*because* neither could see the other. That is the clearest evidence available that §13.5.1 earns
its cost.
