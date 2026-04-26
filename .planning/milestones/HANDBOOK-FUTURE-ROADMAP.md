---
source: docs/reports/SGSD-VTP-Visual-Handbook.html
status: proposed
created: 2026-04-26
purpose: Seed future SGSD milestones and phases from the visual handbook audit.
activation_rule: Do not treat this as active roadmap until Claude/SGSD promotes one milestone through deliberate scoping.
---

# SGSD Future Roadmap Seed From The Visual Handbook

This document converts the visual SGSD + VTP handbook into a future milestone
queue. It is deliberately written as a seed for Claude and SGSD, not as a final
implementation plan.

The point is to pre-help Claude by giving it a strong shape:

- what should be improved,
- why it matters,
- which milestone it belongs in,
- which phases should exist,
- where Claude should enrich the thinking,
- where SGSD should run gates, audits, or VTP/private-KB checks,
- and where Codex/other reviewers should be used for adversarial review.

Do not blindly execute all of this. Promote one milestone at a time.

## Grounding Source

Primary source:

```text
C:\Users\jack.berrow\GSDedits\docs\reports\SGSD-VTP-Visual-Handbook.html
```

The handbook's final red-pen conclusion is the controlling theme:

```text
The next maturity jump is not "more automation." It is stable command
contracts, restart-safe manifests, VTP relevance scoring, and
failure-injection proof that the gates catch real defects.
```

## VTP MCP Enrichment Pass - 2026-04-26

This roadmap has been enriched through the local VTP MCP server, with books as
the primary design substrate and research papers as agent-specific guardrails.

VTP health at enrichment time:

```text
books: 54
research papers: 74
meetings: 61
wiki, kb-data, substrate, manifests, chunks, entities: ok
```

MCP tools used:

- `vtp_health_structured`
- `wiki_search`
- `vtp_search_substrate`
- `vtp_search_research`
- `vtp_advise_service_enrichment`

Note: `vtp_research_gate` was not used as the controlling source for this pass
because the prior gate attempt hit provider rate limiting. The roadmap below is
therefore grounded in VTP search/advice evidence plus book-derived doctrine,
not in a full automated research-gate debate.

### Book-First Doctrine Map

| Book / Book Family | SGSD Design Lesson | Roadmap Consequence |
|---|---|---|
| The Design of Everyday Things | The visible surface is the user's system image; it should reveal the right conceptual model. | v1.6 must make cockpit state match what SGSD is actually doing, then verify startup commands against that model. |
| Don't Make Me Think | New-user paths and status screens should remove mental chatter, ambiguous labels, and surprising branching. | v1.6 cockpit and v2.1 docs must make the daily path obvious and keep advanced VTP/private-KB setup separate. |
| Writing Effective Use Cases | Behavioral requirements are black-box promises: name the actor goal, trigger, success outcome, and failure alternatives. | v1.6/v1.7 phase docs should describe cockpit lanes and commands as use cases, not just scripts. |
| Software Architecture for Developers | Architecture guidance should be "just enough" and executable through diagrams, constraints, and working software. | v1.7 generated system maps should replace stale hand-maintained command tables. |
| Software Architecture in Practice | Quality attributes, architecture views, and interface specs make architecture evaluable rather than decorative. | v1.7 command envelopes and v2.0 scenario tests should be tied to concrete quality attributes. |
| Fundamentals of Software Architecture | Fitness functions are any mechanism that objectively checks an architectural characteristic. | v1.8 should turn gate value into fitness functions, not a count of how many gates fired. |
| A Philosophy of Software Design | Complexity is the enemy; deep modules hide complexity behind simple interfaces. | v1.7 should shrink command contracts to the smallest envelope that supports real consumers. |
| Clean Architecture | Boundaries should point inward toward policy; tools and frameworks are details. | v1.7/v1.9 should keep SGSD policy independent of Claude, Codex, VTP, or any single terminal. |
| Domain-Driven Design | Shared language and bounded contexts prevent one word from meaning five things. | v1.7 should normalize terms like command, gate, provider, memory, route, block, warn, and repair. |
| Strategic Monoliths and Microservices | Distribution is a cost; split only when autonomy, volatility, or ownership justifies the split. | v1.8 should delete or merge low-value gates before inventing more distributed process. |
| Balancing Coupling in Software Design | Change cost rises when volatility and distance rise together. | v1.8 should prioritize gates around high-volatility/high-distance boundaries: command contracts, provider calls, memory writes, and milestone close. |
| The Mythical Man-Month | Extra workers, reviewers, agents, and gates add coordination cost. | v1.8 should treat every new gate or agent as a cost center until it catches a named failure. |
| The LLM Mesh | LLM systems need policy boundaries, metadata consistency, traceability, and prompt-injection screening. | v1.9 should treat knowledge providers and memory writes as governed interfaces, not loose folders. |
| Designing Data-Intensive Applications | Reliability comes from fault thinking, operability, and testing realistic failure modes. | v2.0 should use failure injection and restart tests rather than trusting happy-path green status. |
| Designing Machine Learning Systems / Practical MLOps | Model-assisted systems need evaluation, monitoring, drift signals, and operational feedback loops. | v1.8/v2.0 should measure whether SGSD behavior improves, not merely whether it runs. |
| Patterns of Enterprise Application Architecture / Fundamentals of Data Engineering / Database Internals | Durable records, transaction boundaries, and data contracts matter when automation depends on history. | v1.7 route/review ledgers and v1.9 memory provenance should be append-only and schema-aware. |

### Research-Paper Guardrail Map

| Research Signal | SGSD Design Lesson | Roadmap Consequence |
|---|---|---|
| Shift-Up: Software Engineering Guardrails for AI-Native Development | Autonomous agents need executable requirements, architecture models, and decision records as guardrails. | v1.7 command contracts and v2.1 onboarding should make requirements executable before scaling autonomy. |
| HiveMind: OS-Inspired Scheduling for Concurrent LLM Agent Workloads | Shared LLM providers behave like constrained resources, not infinite sinks. | v2.0 should add timeout tiers, admission/backpressure policy, and circuit-breaker evidence only where provider failures recur. |
| Security of Long-Term Memory in LLM Agents | Persistent memory is a governed security object, not a bigger cache. | v1.9 must gate memory writes with provenance, retention, privacy, and promotion reason. |
| When to Forget / FSFM Selective Forgetting | Memory quality depends on knowing what to retain and what to retire. | v1.9 should add expiry/forget rules before broadening memory capture. |
| Skill-RAG / failure-aware retrieval | Retrieval failures should be diagnosed before retrying. | v1.9 should use typed retrieval failures: empty hit, noisy hit, stale hit, missing corpus, provider unavailable, too broad, privacy blocked. |
| Thought-Retriever / Experience Compression Spectrum | Useful memory may be a decision, skill, rule, or thought trace, not just raw documents. | v1.9 should store decision-impact summaries, not dump long citations into planning. |
| Forage V2 / Self-Evolving Terminal Agents / Autogenesis | Self-improvement works when experience is distilled into bounded rules and transfer artifacts. | v1.7/v2.1 should generate system maps, route ledgers, and onboarding examples that future agents can reuse. |
| Why LLMs Aren't Scientists Yet / ISO-Bench | Agent reports can look convincing while real outcomes fail. | v1.8/v2.0 should inspect raw artifacts and scenario outcomes, not trust narrative summaries alone. |
| Mesh Memory Protocol / Stateless Decision Memory | Memory and decision traces need semantic structure and recoverable context. | v1.7 route decisions and v1.9 memory records should share stable IDs and link to artifacts. |

### VIO Conversation Design Map

| VIO Signal | SGSD Design Lesson | Roadmap Consequence |
|---|---|---|
| Visible AI work is required for collaboration | A helper cannot assist if the cockpit hides what Claude/Codex are doing. | v1.6 must expose current model activity, agent tasks, Codex state, evidence, and next action at a glance. |
| Workflow engine as an addressable tree | Complex work is easier to reason about as parent, node value, and condition than as loose prose. | v1.6 and v1.7 should use stable milestone/phase/objective/gate/agent/artifact/blocker IDs. |
| Progressive disclosure and rendering budgets | Show essentials first; expand details only when needed. | v1.6 should define primary, secondary, and diagnostic lanes instead of adding more always-visible rows. |
| Validate one path end to end before scaling | Trust comes from a thin verified workflow, not a broad impressive surface. | v1.6 should prove one cockpit data path; v2.0 should broaden with failure scenarios. |
| Filter/classify context before acting | Work mode, risk, retrieval failure, and gate tier should be classified before dispatch or retry. | v1.7 route ledgers, v1.8 gate sampling, and v1.9 retrieval failure taxonomy should all record classification reasons. |
| Hard stops and local survival logic | Autonomy needs visible hard limits and recovery paths. | v1.6 cockpit should surface blockers and repair action; v2.0 should test false-green and missing-evidence failures. |

### How VTP Changes This Roadmap

- v1.6 stays first, but it is now Cockpit 2.0 plus startup verification, not a
  boot-build milestone.
- v1.7 stays before v1.8 because architecture books point to stable interfaces
  and quality attributes before evaluating or pruning process.
- v1.8 stays before v2.0 because failure injection needs gate-fitness baselines
  to know whether a failure was caught usefully.
- v1.9 can begin research in parallel with v1.7, but implementation should wait
  until command/provider names and envelopes stabilize.
- v2.1 stays after v2.0 because public onboarding should not promise reliability
  until realistic failure paths have been tested.

Every `CLAUDE_ENRICHMENT_SLOT` should replace vague research with four concrete
outputs:

1. book takeaways,
2. VIO/operator-workflow takeaways where relevant,
3. research corroboration,
4. design consequence,
5. kill/defer condition.

### VTP Promotion Workbench For Claude

When Claude promotes a milestone from this proposal, it should start from this
book-first workbench before touching implementation plans.

| Milestone | Books To Start With | Research To Corroborate | Promotion Question |
|---|---|---|---|
| v1.6 Cockpit 2.0, startup verification | The Design of Everyday Things; Don't Make Me Think; Writing Effective Use Cases; Software Architecture for Developers; A Philosophy of Software Design | Shift-Up; Skill-RAG; HiveMind; ISO-Bench | Can the cockpit answer what SGSD is doing, what it unlocks, what is blocked, what agents/Codex did, and what happens next, while verifying the startup path already built? |
| v1.7 Command contracts, route intelligence | A Philosophy of Software Design; Software Architecture in Practice; Fundamentals of Software Architecture; Domain-Driven Design; Clean Architecture | Shift-Up; Mesh Memory Protocol; Stateless Decision Memory; Forage V2 | What is the smallest stable command envelope that all real consumers can use without binding SGSD to one tool? |
| v1.8 Gate fitness, MUDA pruning | Fundamentals of Software Architecture; Strategic Monoliths and Microservices; Balancing Coupling in Software Design; The Mythical Man-Month; A Philosophy of Software Design | ISO-Bench; Why LLMs Aren't Scientists Yet; Shift-Up | Which gates catch real defects, which gates create drag, and which should be deleted, merged, sampled, or kept? |
| v1.9 Knowledge relevance, memory governance | The LLM Mesh; Clean Architecture; Domain-Driven Design; Patterns of Enterprise Application Architecture; Fundamentals of Data Engineering | Mnemonic Sovereignty; Skill-RAG; Thought-Retriever; Experience Compression; When to Forget | Does each knowledge hit or memory write change a decision, and can SGSD prove provenance, privacy, retention, and relevance? |
| v2.0 Failure injection | Designing Data-Intensive Applications; Fundamentals of Software Architecture; Practical MLOps; Designing Machine Learning Systems; Database Internals | HiveMind; Why LLMs Aren't Scientists Yet; ISO-Bench; memory-security papers | Which realistic failures would damage SGSD, and do the gates catch them with actionable repair paths? |
| v2.1 Distribution, onboarding | Don't Make Me Think; The Design of Everyday Things; Software Architecture for Developers; Writing Effective Use Cases; Clean Architecture | Shift-Up; Forage V2; Self-Evolving Terminal Agents; Thought-Retriever | Can a stranger install, run, understand, and upgrade SGSD without Jack's VTP repo or milestone history? |

Claude should not cite these works decoratively. For every promoted phase,
extract one or two concrete rules from the relevant books, then turn them into
acceptance criteria, verification commands, or kill/defer conditions.

## Operating Rule For Claude

Claude should not simply implement this list. Claude should enrich it.

Before promoting any milestone, Claude must also read:

```text
C:\Users\jack.berrow\GSDedits\.planning\milestones\HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md
C:\Users\jack.berrow\GSDedits\.planning\milestones\VIO-ROADMAP-ENRICHMENT.md
```

The implementation audit is now a promotion prerequisite because several
roadmap ideas are already partially implemented. The VIO enrichment is a
promotion prerequisite because it captures operator-workflow design lessons from
private conversations that should shape the whole roadmap, not only the cockpit.
The promotion job is to keep, formalize, extend, or delete scope based on
current code and operator evidence, not to duplicate existing primitives.

For each milestone, Claude should:

1. Read the handbook sections named in the milestone.
2. Read the implementation audit and mark duplicate-risk items.
3. Read the VIO enrichment and extract any operator-workflow rules that apply.
4. Read the current code and docs that own the surface.
5. Query the configured knowledge bank if available.
6. If no private knowledge bank exists, use SGSD local memory first, then the
   fallback corpus configured by `sgsd-setup`.
7. Run `/sgsd-deliberate` for any milestone that changes command contracts,
   gate semantics, memory policy, or autonomous behavior.
8. Produce a `RESEARCH.md`, `CONTEXT.md`, and `EXISTING-SURFACE-AUDIT.md`
   before writing implementation plans.
9. Leave a clear kill/defer condition for every proposed gate or dashboard.

Use this placeholder in future phase docs:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Read the handbook section(s), query private KB / SGSD memory / fallback corpus,
then replace this block with concrete risks, precedents, rejected options, and
the recommended implementation route.
-->
```

## Proposed Milestone Queue

| Milestone | Theme | Phases | Why It Exists |
|---|---:|---:|---|
| v1.6 | Cockpit 2.0 and startup verification | 26-30 | Make SGSD explain what it is doing, what is blocked, what Codex/agents did, and verify the startup behavior already built. |
| v1.7 | Stable command contracts and route intelligence | 31-35 | Make every SGSD command emit a dependable envelope so dashboards, gates, and milestone close can reason from data. |
| v1.8 | Gate fitness and MUDA pruning | 36-40 | Prove gates earn their cost; delete, sample, or tier gates that create process drag. |
| v1.9 | Knowledge relevance and memory governance | 41-45 | Prevent citation theater, govern memory writes, and make private/public knowledge routing reliable. |
| v2.0 | SpaceX-style failure injection | 46-50 | Prove SGSD catches real failure modes, not just happy-path verifier checks. |
| v2.1 | Distribution and new-user onboarding | 51-55 | Make SGSD installable and understandable for people without this repo's history. |

---

# v1.6 Proposed: Cockpit 2.0 And Startup Verification

## Mission

Make the cockpit answer the operator's actual questions:

1. what the model is doing right now,
2. what SGSD is trying to complete,
3. what completion unlocks,
4. what is blocked or risky,
5. which agents were used and what they did,
6. what Codex is doing or concluded,
7. what evidence was produced,
8. and what should happen next.

Startup, portability, and knowledge setup stay in this milestone only as
verification scope because the implementation audit shows they are already
mostly implemented.

## Handbook Inputs

- "How It Makes Life Better"
- "End-to-End Architecture"
- "Command Reference"
- "Core Files And Surfaces"
- "Red-Pen Improvements"
- `.planning/milestones/VIO-ROADMAP-ENRICHMENT.md`
- `.planning/milestones/COCKPIT-2.0-SCOPE.md`

## VTP Lens

Book lens: The Design of Everyday Things makes the cockpit SGSD's system image.
Don't Make Me Think says the first viewport should answer the user's questions
before showing internals. Writing Effective Use Cases says each lane needs an
actor goal, success state, failure state, and repair path. A Philosophy of
Software Design says the top view should hide subsystem complexity behind a
small operator model.

Research lens: Shift-Up says cockpit claims should be backed by executable
guardrails and architecture/decision records. Skill-RAG says failures should be
typed before retry. HiveMind says provider contention and timeouts need visible
state. ISO-Bench warns that a status report can look good while the real
outcome is wrong, so cockpit summaries must link to evidence.

VIO lens: workflow should appear as a tree, not a soup; detail should be hidden
until needed; current AI activity should be visible enough for a collaborator to
help; and one thin path should be validated before broadening.

Design consequence: v1.6 should produce a Cockpit 2.0 operator contract,
objective-tree data model, Mission Control layout update, agent/Codex visibility
lanes, and startup verification evidence.

## Phase 26: Cockpit Operator Question Contract

Goal: define what the cockpit must answer and what each answer means.

Scope:

- Map current cockpit panes to the eight operator questions.
- Mark each question answered, partial, or missing.
- Define status vocabulary: active, waiting, blocked, reviewing, timed-out,
  stale, complete, unavailable.
- Define freshness and empty-state rules.
- Preserve startup command verification as evidence, not new build scope.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Use the book map, VIO enrichment, and implementation audit. Replace this with a
question-by-question contract, current evidence source, missing data, and
kill/defer rule.
-->
```

Acceptance criteria:

- Each operator question has one owner lane.
- Each answer has source, freshness rule, empty state, and repair path.
- No lane exists only because telemetry exists.

## Phase 27: Cockpit Data Source And Objective Tree Audit

Goal: define the smallest data model Cockpit 2.0 needs.

Scope:

- Inventory existing data sources before adding telemetry.
- Model work as milestone -> phase -> objective -> gate/agent/artifact/blocker/
  unlock.
- Assign stable IDs where available.
- Decide if `cockpit-state.json` or `cockpit-intel.json` is justified.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Replace with a data-source matrix: question, current source, stale/missing
behavior, needed schema, and whether new telemetry is justified.
-->
```

Acceptance criteria:

- No new telemetry is added without a named unanswered question.
- Objective tree schema is documented.
- Staleness is visible instead of silently reusing old state.

## Phase 28: Mission Control 2.0 Layout

Goal: redesign the main mission control pane around operator questions.

Scope:

- Put current objective, unlock, block/risk, next action, and freshness in the
  primary viewport.
- Move lower-value raw counts into secondary or diagnostic lanes.
- Preserve useful existing views: milestone progress, phase progress, gates,
  cost/tokens, MCP, and commits.
- Truncate long rows cleanly while preserving evidence paths.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Create a terminal layout sketch for 100, 120, and 160 column widths. Replace
with the selected layout, rejected alternatives, and overflow rules.
-->
```

Acceptance criteria:

- First viewport answers current objective, unlock, blocker, and next action.
- Layout does not duplicate narrative or Codex pane content.
- Long rows do not make panes unreadable.

## Phase 29: Agent And Codex Visibility Lanes

Goal: make agents and Codex understandable at a glance.

Scope:

- For agents, show role, task, status, latest artifact, and result.
- For Codex, show state, scope, report, critical count, warnings, timeout, and
  current reviewer attention.
- Distinguish idle, running, timed-out, blocked, stale, and complete.
- Link to reports and artifacts where available.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Read Codex logs, current monitor output, and agent metrics. Replace with the
lane contract and examples of good, stale, blocked, and timed-out states.
-->
```

Acceptance criteria:

- Operator can tell whether Codex is idle, reviewing, blocked, stale, timed
  out, or complete.
- Operator can see which agents were used and what each produced.
- The lanes link to reports/artifacts rather than only summarizing them.

## Phase 30: Startup Verification And Cockpit Acceptance

Goal: verify the implemented startup path and prove Cockpit 2.0 is useful.

Scope:

- Verify `sg`, `sg -Go`, `sg -FullPreflight`, `sg -NoClaude`,
  `sg -NoCockpit`, `sgsd`, and `sgsd -Claude -Greet`.
- Capture fast boot and full preflight timings.
- Verify dashboard host failure behavior.
- Update startup guide and README links if needed.
- Run cockpit acceptance scenarios: active work, blocked gate, Codex timeout,
  no private KB, stale dashboard data, and forced restart.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Replace with measured startup timings, acceptance scenarios, and any failing
behaviors. Keep fixes scoped to observed failures.
-->
```

Acceptance criteria:

- Startup behavior is verified rather than assumed.
- Cockpit 2.0 answers the eight questions in at least three scenarios.
- No VTP/private KB dependency is required for normal use.

---

# v1.7 Proposed: Stable Command Contracts And Route Intelligence

## Mission

Standardize command outputs so the cockpit, orchestrator, gates, and milestone
close can consume the same data shape instead of bespoke prose.

## Handbook Inputs

- "Relay Anatomy"
- "Recommended Command Output Envelope"
- "What The Orchestrator Does"
- "Gates And Information Relays"
- "Red-Pen Improvements"

## VTP Lens

Book lens: A Philosophy of Software Design argues for deep modules with simple
interfaces; Clean Architecture argues that policy should not depend on tools;
Domain-Driven Design argues for shared language; Software Architecture in
Practice argues for interface specs and quality-attribute views. Together, they
say SGSD command contracts must be small, stable, named, and tool-neutral.

Research lens: Shift-Up supports executable guardrails; Forage/Self-Evolving
Terminal Agents support distilling reusable rules from experience; Mesh Memory
and Stateless Decision Memory support structured route/review ledgers.

Design consequence: v1.7 should not create a giant event schema. It should
standardize the smallest envelope that dashboards, gates, milestone close, and
future Claude sessions actually consume.

## Phase 31: Canonical Command Envelope

Goal: every SGSD command has a stable result shape.

Target envelope:

```json
{
  "status": "pass|warn|block|error",
  "reason_codes": [],
  "artifacts": [],
  "evidence": [],
  "next_action": "",
  "risk": "low|medium|high",
  "duration_ms": 0,
  "run_id": ""
}
```

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Inventory every SGSD script and skill output. Classify which already has a
machine-readable contract, which needs a wrapper, and which should stay prose
only. Propose the smallest schema that covers the real cases.
-->
```

Acceptance criteria:

- Schema file exists.
- At least 5 high-value commands emit the envelope.
- Dashboard can parse envelope without bespoke regex.

## Phase 32: Route Decision Ledger

Goal: record orchestrator route decisions as data.

Scope:

- New `.planning/metrics/route-decisions.jsonl`.
- Fields: route, inputs, gates considered, knowledge used, reason codes, outcome.
- Connect route decisions to later gate failures or success.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Define which route choices matter enough to log. Avoid logging noise. Map the
ledger to future learning: what question could SGSD answer after 50 phases?
-->
```

Acceptance criteria:

- Orchestrator writes route-decision rows at major boundaries.
- Rows include phase/milestone context.
- Rows link to produced artifacts.

## Phase 33: Repair Instruction Contract

Goal: every block tells the operator or next agent how to make it pass.

Scope:

- Gate block verdict requires `repair_instruction`.
- Optional `repair_command`.
- Dashboard surfaces next repair.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Audit all current gates for "no without repair path" behavior. Identify the
three worst offenders and design the smallest repair contract they can share.
-->
```

Acceptance criteria:

- Blocking gate without repair instruction is invalid.
- Cockpit shows the repair action for latest block.
- Milestone close lists unresolved repairs.

## Phase 34: Canonical Review Ledger

Goal: fix the v1.5 Codex kill-check data gap.

Scope:

- All Codex and Claude review rounds write to one canonical ledger.
- Review provider, model, duration, findings, critical count, fallback, parse
  status, and artifact path are consistent.
- Kill formulas require non-empty baselines.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Use v1.5 SUMMARY.md and Codex logs to design the canonical review ledger. Decide
how to backfill historical rows without corrupting evidence.
-->
```

Acceptance criteria:

- Future milestone kill-check has complete provider data.
- Empty baseline cannot fire a false kill.
- Dashboard reads the canonical ledger.

## Phase 35: Generated System Map

Goal: the cockpit and docs link to exact evidence and ownership.

Scope:

- Generate command/skill/script/gate catalog from frontmatter and registries.
- Link gate version to artifact path.
- Link dashboard tiles to evidence files.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Design a generated "system map" artifact from skills, agents, scripts, gates,
and config. Keep it deterministic. Avoid hand-maintained catalog drift.
-->
```

Acceptance criteria:

- Generated map command exists.
- Manual skill tables can be replaced by generated docs.
- Operator can click from "gate failed" to artifact and gate definition.

---

# v1.8 Proposed: Gate Fitness And MUDA Pruning

## Mission

Make gates prove they are worth their cost. Delete, sample, or narrow gates that
do not catch real failures.

## Handbook Inputs

- "MUDA Review"
- "Gate Families"
- "Pass, Warn, Block"
- "Research To Gate Mapping"
- "Red-Pen Improvements"

## VTP Lens

Book lens: Fundamentals of Software Architecture reframes gates as fitness
functions; The Mythical Man-Month warns that extra coordination is not free;
Strategic Monoliths and Microservices plus Balancing Coupling warn against
splitting or gating work unless volatility, distance, and risk justify it.

Research lens: ISO-Bench and Why LLMs Aren't Scientists Yet warn that good
reports can hide bad real outcomes. Shift-Up supports guardrails only when they
are tied to executable success signals.

Design consequence: v1.8 should measure whether each gate caught a defect,
prevented rework, reduced operator burden, or created avoidable drag. MUDA
should be allowed to recommend delete, merge, sample, or keep.

## Phase 36: Gate Value Telemetry

Goal: measure whether gates catch value or create drag.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Define gate value metrics that avoid vanity. Examples: defects caught, false
positive rate, repair time, repeat findings, skipped-gate incidents, operator
interventions avoided.
-->
```

Acceptance criteria:

- Gate telemetry includes runtime and outcome.
- Milestone summary reports gate value, not just gate count.

## Phase 37: MUDA Deletion Candidates

Goal: MUDA reports should recommend removals, not only warnings.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Read recent WASTE.md files and identify recurring low-value checks. Produce
delete/merge/sample candidates with evidence and risk.
-->
```

Acceptance criteria:

- WASTE.md has a deletion-candidate section.
- Each candidate includes risk and rollback.

## Phase 38: Risk-Tiered Gate Sampling

Goal: small edits should not pay the same process cost as milestone changes.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Design risk tiers using diff size, files touched, phase type, gate history, and
operator mode. Decide which gates are always-on, sampled, or skipped.
-->
```

Acceptance criteria:

- Low-risk work can use sampled gates.
- High-risk work still hard-halts on critical gates.
- Sampling decisions are logged.

## Phase 39: Gate Keep/Kill Review

Goal: milestone close should decide if gates stay alive.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Design a mechanical keep/kill/defer rubric for gates. It should use measured
gate value and avoid killing gates too early after too little data.
-->
```

Acceptance criteria:

- Milestone close produces gate keep/kill table.
- Kill recommendations require evidence and rollback.

## Phase 40: Phase Folder Perfection Contract

Goal: every phase folder should answer what happened, why, evidence, risk, and
next action.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Audit three shipped phase folders and define the minimum "perfect phase folder"
contract. Do not overfit to one milestone.
-->
```

Acceptance criteria:

- Phase folder checklist exists.
- Missing summary/evidence/next-action is a warning.

---

# v1.9 Proposed: Knowledge Relevance And Memory Governance

## Mission

Make knowledge enrichment useful and governed. The goal is not more citations;
the goal is better decisions.

## Handbook Inputs

- "What VTP Is"
- "VTP Corpus Doctrine"
- "The 12 VTP-Derived Rules"
- "VTP Documents To Use"
- "Knowledge Tiers"

## VTP Lens

Book lens: The LLM Mesh makes knowledge routing a governance and traceability
problem; Clean Architecture says VTP must be a provider behind a boundary, not
an architectural dependency; Domain-Driven Design says provider, memory,
citation, and decision-impact terms must be unambiguous.

Research lens: Mnemonic Sovereignty treats persistent memory as a privileged
state transition; Skill-RAG says classify retrieval failures before retrying;
Thought-Retriever and Experience Compression say the useful artifact may be the
distilled decision, not the raw retrieved text.

Design consequence: v1.9 should make knowledge hits prove relevance and decision
impact. Memory writes need source, confidence, privacy, retention, expiry, and
promotion reason.

## Phase 41: Knowledge Provider Registry

Goal: support VTP, local folders, SGSD memory, and public fallback sources
through a single provider concept.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Design provider fields: id, type, root/url, health check, query mode, citation
shape, privacy level, enabled flag. Keep v1 as config-only if that is enough.
-->
```

Acceptance criteria:

- VTP is one provider, not a special-case assumption.
- Missing provider degrades with clear repair guidance.

## Phase 42: Relevance Scoring And Citation Theater Prevention

Goal: a citation must affect a decision or be marked non-actionable.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Define relevance score, decision impact, and non-actionable citation labels.
Use examples from handbook red-pen notes and recent VTP enrichment artifacts.
-->
```

Acceptance criteria:

- VTP/private-KB hits include relevance and decision impact.
- Planner receives only actionable hits by default.

## Phase 43: Typed Retrieval Failure Modes

Goal: classify retrieval failure before retrying.

Failure types:

- empty hit
- noisy hit
- stale hit
- missing corpus
- provider unavailable
- query too broad
- privacy blocked

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Map each failure type to a route: retry, narrow query, switch provider, write
empty-hit artifact, continue, warn, or block.
-->
```

Acceptance criteria:

- Retrieval failures are typed in artifacts.
- Empty hit is not treated as API failure.

## Phase 44: Memory Provenance And Retention

Goal: treat memory writes as governed state transitions.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Design provenance fields for memory writes: source, confidence, expiry,
retention, privacy, related phase, and promotion reason. Use the minimum that
would have prevented stale or untraceable memory.
-->
```

Acceptance criteria:

- New memory entries carry provenance.
- Retention/forget rules are documented.

## Phase 45: Public Fallback Corpus Policy

Goal: use public sources safely when no private KB exists.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Decide public-source policy: discovery-only, cached summaries, user approval
before ingest, citation requirements, and license/copyright guardrails.
-->
```

Acceptance criteria:

- Public sources are opt-in.
- No blind ingestion of copyrighted material.
- Fallback source list is documented and configurable.

---

# v2.0 Proposed: SpaceX-Style Failure Injection

## Mission

Prove SGSD catches realistic failure modes. Happy-path green is not enough.

## Handbook Inputs

- "SpaceX-Style Hardening"
- "Hardening Principles"
- "Gates And Information Relays"
- "MUDA Review"

## VTP Lens

Book lens: Designing Data-Intensive Applications pushes SGSD toward fault
injection, operability, and realistic failure thinking; Fundamentals of Software
Architecture gives the "fitness function" framing; Practical MLOps and
Designing Machine Learning Systems add monitoring and evaluation discipline.

Research lens: HiveMind gives provider backpressure and circuit-breaker
patterns; Why LLMs Aren't Scientists Yet and ISO-Bench warn against trusting
agent self-reports; memory-security work adds delayed-failure and poisoned-state
scenarios.

Design consequence: v2.0 should test missing artifacts, malformed reports,
stale evidence, provider timeouts, poisoned memory, restart interruptions, and
Codex/Claude review disagreement.

## Phase 46: Gate Failure-Injection Harness

Goal: intentionally break gate inputs and prove gates block.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
List the top 10 failure modes that would genuinely hurt SGSD. Build the harness
around those, not around easy toy failures.
-->
```

Acceptance criteria:

- Harness can inject missing artifact, malformed report, stale evidence, and
  critical review findings.
- Expected block/warn/pass is asserted.

## Phase 47: Restart And Handoff Chaos Tests

Goal: prove forced restarts do not lose state.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Simulate restart points across research, plan, execute, verify, and milestone
close. Identify which artifacts are sufficient for safe resume.
-->
```

Acceptance criteria:

- Checkpoint/resume tests exist.
- Handoff logs survive partial writes.

## Phase 48: Provider Backpressure And Timeout Circuits

Goal: shared LLM providers should be treated as schedulable resources.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Design provider budgets, retry tiers, timeout escalation, and circuit-breaking
using actual Codex/Claude/VTP timeout data.
-->
```

Acceptance criteria:

- Timeout tiers are data-backed.
- Repeated provider failure degrades gracefully.

## Phase 49: Scenario-Based Acceptance Suite

Goal: test SGSD by real workflow scenarios, not unit fragments only.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Define 6 scenario tests: docs-only phase, frontend phase, security fix,
VTP-empty-hit phase, Codex-timeout phase, and milestone close.
-->
```

Acceptance criteria:

- Scenario suite can run locally.
- Each scenario asserts artifacts and gate outcomes.

## Phase 50: Release Readiness Score

Goal: create an explicit "ready to ship SGSD" score.

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Design a release score that includes startup, docs, gates, memory, provider
health, scenario suite, and install portability. Avoid vanity metrics.
-->
```

Acceptance criteria:

- Readiness score is generated at milestone close.
- Red score blocks public release.

---

# v2.1 Proposed: Distribution And New-User Onboarding

## Mission

Make SGSD usable by people who do not know this repo's history and do not have
VTP.

## Handbook Inputs

- "What SGSD Is"
- "How It Makes Life Better"
- "Command Reference"
- startup guide
- generated system map from v1.7

## VTP Lens

Book lens: Don't Make Me Think and The Design of Everyday Things require a
stranger-safe first run. Software Architecture for Developers requires just
enough architecture documentation. Writing Effective Use Cases requires docs
that follow user goals instead of internal history.

Research lens: Shift-Up supports executable onboarding guardrails; Forage and
Self-Evolving Terminal Agents support reusable examples and transfer artifacts;
Thought-Retriever supports retrieving distilled guidance instead of asking new
users to read every historical milestone.

Design consequence: v2.1 should ship a clean-machine install path, a minimal
wizard, one example project, migration checks, and docs that treat VTP as
optional.

## Phase 51: Installer Portability Audit

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Test install on a clean Windows user profile and document every implicit
dependency. Pay special attention to PowerShell profile paths, Git Bash, and
Claude CLI availability.
-->
```

Acceptance criteria:

- Clean-machine install checklist exists.
- Installer reports missing dependencies clearly.

## Phase 52: New Project Wizard

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Design a minimal wizard that asks only what SGSD needs: project root, memory
root, optional private KB, fallback corpus, cockpit preference, and default boot
mode.
-->
```

Acceptance criteria:

- Wizard writes config without requiring manual JSON edits.
- Wizard can be re-run safely.

## Phase 53: Example Project And Demo Script

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Create a tiny example project that exercises research, plan, execute, verify,
and close without needing private VTP. Use it as a smoke test and onboarding
demo.
-->
```

Acceptance criteria:

- Example project can complete one miniature milestone.
- Demo does not rely on user-specific paths.

## Phase 54: Public Docs Refresh

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Rewrite README and user docs for a stranger. Remove historical assumptions,
explain the current boot flow, and separate advanced VTP/private-KB setup from
basic SGSD use.
-->
```

Acceptance criteria:

- README quick start matches current `sg` behavior.
- VTP is described as optional.

## Phase 55: Migration And Upgrade Safety

Claude enrichment slot:

```text
<!-- CLAUDE_ENRICHMENT_SLOT:
Design upgrade checks for existing users: profile function drift, config schema
drift, old `.brv` memory, old dashboard names, missing generated docs, and
stale gates.
-->
```

Acceptance criteria:

- Upgrade command reports drift before changing files.
- Migration notes exist for v1.5 to v2.1.

---

# How Claude Should Promote This

When ready to work on the next milestone, Claude should:

1. Read this file.
2. Read the handbook.
3. Read the book enrichment map.
4. Read the implementation audit.
5. Read the VIO roadmap enrichment.
6. Run `sgsd-setup` if knowledge roots are not configured.
7. Run `/sgsd-deliberate` on which milestone to promote first.
8. Create normal SGSD milestone docs:

```text
.planning/milestones/v1.6/REQUIREMENTS.md
.planning/milestones/v1.6/phases/26-*/26-CONTEXT.md
.planning/milestones/v1.6/phases/NN-*/NN-RESEARCH.md
.planning/milestones/v1.6/phases/NN-*/NN-PLAN-INDEX.md
```

9. Update `.planning/ROADMAP.md` only after the operator approves promotion.
10. Keep `.planning/STATE.md` unchanged until the milestone is actually active.

## First Recommended Promotion

Promote v1.6 first.

Reason:

- It directly improves the operator experience.
- It turns the cockpit into the visible system image for SGSD.
- It makes current model, agent, Codex, blocker, unlock, and next-action state
  legible.
- It verifies the startup and optional-knowledge behavior already built instead
  of duplicating it.
- It creates the event/data contract needed by v1.7, v1.8, v1.9, and v2.0.
- It uses the VIO workflow lessons across the whole roadmap, not only as a UI
  polish pass.

## Explicit Non-Goals

- Do not add more gates unless a named failure mode needs them.
- Do not make VTP mandatory.
- Do not query public sources by default.
- Do not rewrite the orchestrator before command contracts are stable.
- Do not update active state from this proposed roadmap alone.
