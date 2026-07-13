# SGSD Frontier Architecture Audit — Design Specification

**Date:** 2026-07-13

**Status:** Approved design

**Deliverable:** `.planning/analyses/2026-07-13-sgsd-frontier-architecture-audit.html`

**Purpose:** Determine whether SGSD is extracting maximum value from frontier-model orchestration and its existing skills, then propose a stronger target architecture without treating current contracts as sacred.

## 1. Outcome

Produce a source-backed, self-contained HTML architecture explainer and adversarial audit that answers five questions:

1. How does SGSD actually work today across interactive and autonomous operation?
2. Which skills, routes, gates, memory systems, and operator surfaces are active, dormant, duplicated, under-triggered, or disproportionately expensive?
3. What would a clean-sheet frontier-model software-delivery architecture look like if SGSD conventions were not constraints?
4. Which current components should be kept, strengthened, merged, replaced, automated, or removed?
5. What amendments provide the highest expected improvement in orchestration quality, reliability, operator leverage, token efficiency, and recovery?

The report is analytical and read-only. It will not mutate SGSD runtime state, bypass gates, or implement recommendations.

## 2. Audience and Decision

The primary reader is the SGSD operator deciding what to amend next. The report must work at two depths:

- A one-glance operating model for understanding the whole system.
- An engineering audit with enough evidence, boundaries, and proof tests to scope subsequent milestone phases.

The headline verdict must state whether SGSD's current complexity is earning its keep and identify the highest-leverage architectural change.

## 3. Method: Adversarial Two-Pass Audit

### Pass A — Observed SGSD

Build a capability census from executable sources and current planning truth. Trace representative workflows, score each capability, surface contradictions, and distinguish configured behavior from behavior proven by evidence.

### Pass B — Clean-Sheet Counterfactual

Design a frontier-model orchestration system from first principles using the same objectives and constraints but without preserving SGSD's current phase model, skill boundaries, control-plane split, gate sequence, state layout, or operator UX.

### Delta Synthesis

Compare the observed and clean-sheet systems component by component. Assign one verdict to each material capability:

- **KEEP** — proven, proportionate, and well-bounded.
- **STRENGTHEN** — valuable but under-triggered, under-observed, or incomplete.
- **MERGE** — duplicates or fragments another responsibility.
- **REPLACE** — the responsibility is valid but the abstraction or boundary is weak.
- **AUTOMATE** — valuable behavior is unnecessarily dependent on operator memory.
- **REMOVE** — dead, misleading, bypassable, or negative-value complexity.

Every verdict must include an expected benefit, risk, migration concern, and falsifiable proof test.

## 4. Architecture Backbone

The current-state architecture is presented as seven connected layers:

1. **Operator and runtime entry** — Warp, local PowerShell commands, workflows, SSH, tmux, greet, auto, status, cockpit-only, and recovery entry points.
2. **Claude control plane** — interactive operator-led mode, autonomous phase loop, shared inspection/decision/dispatch/synthesis responsibilities, and authority boundaries.
3. **Canonical planning and state spine** — PROJECT, milestone INTENT, ROADMAP, STATE frontmatter, checkpoint, phase CONTEXT/RESEARCH/PLAN/VERIFICATION/ATC artifacts, and typed envelopes.
4. **Codex execution fabric** — intent mapping, recall, context packets, route decisions, roles, profiles, sandbox/file boundaries, worktrees, native review, and execution outputs.
5. **Gate and repair loop** — per-dispatch ATC, phase ATC, verifier, semantic acceptance, MUDA/waste, edge guard, release readiness, repair dispatch, debt, and closure.
6. **Evidence and memory** — append-only ledgers, token/route/gate evidence, recall/curation, typed CMB lineage, context authority, harness evolution, and optional VTP enrichment.
7. **Observability and recovery** — cockpit state adapter/UI, Warp workflows, MCP surfaces, watchdog, recovery packet, checkpoint resume, and SSH/tmux panes.

Solid arrows represent the primary delivery path. Return arrows represent repair or next-unit feedback. Dashed arrows represent optional/degraded integrations. Amendment hotspots are visually distinct from factual architecture nodes.

## 5. Audit Domains

### 5.1 Intent and Mode Selection

Audit interactive, `next`, autonomous, status, recovery, triage, board, deliberate, and direct-skill entry paths. Determine whether operator intent is classified reliably and whether the same request can accidentally enter divergent workflows.

### 5.2 Control-Plane Cognition and Skills

Inventory all active SGSD skills and their trigger contracts, including orchestration, triage, board/deliberation, planning, completion, audit, recovery, and specialist gates. Test:

- Discoverability from natural operator language.
- Trigger precision and precedence.
- Boundary clarity between adjacent skills.
- Whether output from one skill is mechanically consumed by the next.
- Whether skills are merely documented or evidenced in recent use.
- Whether Claude is synthesising and deciding rather than duplicating Codex work.

### 5.3 Codex Execution Fabric

Audit role routing, model/profile selection, context packets, handover contracts, token ceilings, file allowlists, sandbox semantics, worktree requirements, native review, retries, fallback behavior, and attribution. Distinguish the claimed execution fabric from the commands and evidence that prove it.

### 5.4 Assurance and Evidence

Map gate order, enforcement, sampling, evidence paths, repair paths, duplicated checks, bypass surfaces, closure semantics, and whether each gate changes outcomes often enough to justify its cost.

### 5.5 State, Memory, and Learning

Audit truth authority, staleness, checkpointing, recall/curate flow, CMB lineage, context authority, optional VTP degradation, trajectory evidence, harness evolution, and whether lessons change future dispatches.

### 5.6 Operation and Recovery

Audit local Warp topology, SSH/tmux topology, cockpit/MCP read paths, controlled actions, liveness, watchdog behavior, reconnect/recovery, and the operator's ability to understand and intervene without corrupting state.

## 6. Representative Workflow Traces

The report will trace at least these end-to-end journeys:

1. Interactive operator-led change: operator → Claude → skill/route decision → plan → bounded Codex work → gates → synthesis.
2. Autonomous phase progression: checkpoint/state → next-unit selection → research/planning/execution/verification → close → advance.
3. Ambiguous strategic request: natural language → triage → board/deliberation or orchestration → approved direction.
4. Gate failure and repair: failed verdict → evidence path → repair classification → Codex re-dispatch → re-verification.
5. Recovery from interruption or stale state: watchdog/checkpoint/state authority → recovery packet → resumed work.
6. Remote operation: SSH/tmux launch → Claude control plane → Codex execution → cockpit/metrics visibility → reconnect.

Each trace identifies the trigger, owner, inputs, outputs, truth mutation, evidence emitted, token/latency cost where available, failure modes, and next consumer.

## 7. Capability Inventory Schema

Each material capability receives one row containing:

- Identifier and source path.
- Responsibility and owner.
- Trigger and precedence.
- Inputs and authority level.
- Outputs and downstream consumer.
- State mutations or read-only status.
- Evidence emitted and evidence path.
- Failure and degraded behavior.
- Estimated cost or observed spend where available.
- Recent-use proof or dormant classification.
- Audit score and final verdict.

## 8. Audit Rubric

Score each capability from 0–4 on:

- **Outcome utility** — does it measurably improve delivery quality or safety?
- **Trigger quality** — does the right work reliably enter this path?
- **Boundary clarity** — is responsibility distinct and composable?
- **Mechanical consumption** — does its output drive a downstream decision?
- **Evidence strength** — can operation and effect be proven?
- **Cost proportionality** — are token, latency, and operator costs justified?
- **Failure recovery** — does it degrade or repair predictably?
- **Frontier leverage** — does it use model reasoning where reasoning adds value while keeping mechanical work deterministic?

Scores support comparison but do not replace judgment. A low-cost safety invariant may be retained despite low observed firing frequency.

## 9. Evidence Contract

Every material claim is labelled:

- **OBSERVED** — supported by executable source, test, current state, or ledger evidence.
- **CONFIGURED** — wired in configuration but not proven active in the sampled evidence.
- **DOCUMENTED** — asserted in prose without matching executable proof found.
- **INFERRED** — reasoned from multiple sources and explicitly identified as inference.
- **RECOMMENDED** — proposed target behavior, never presented as current fact.

Source authority follows repository rules: `.planning/` is runtime truth; executable code and registries establish mechanics; tests establish tested behavior; docs explain intent but do not override contradictory runtime evidence.

Known initial contradiction: `AGENTS.md` describes v3.2 as latest/shipped while `.planning/STATE.md` reports v3.4 active. The report will display and analyse this drift rather than silently choosing one statement.

## 10. Independent Challenge Lanes

Research may run in parallel across three bounded, read-only lanes:

1. **Skills and routing** — triage, board/deliberate, orchestration, trigger precedence, handoffs, and operator intent.
2. **Execution and assurance** — Codex roles/profiles/sandbox/worktrees, gates, evidence, repair, and closure.
3. **State and operations** — planning truth, memory, learning, cockpit, MCP, Warp, SSH/tmux, watchdog, and recovery.

The primary author independently reads the core contracts and synthesises all lanes. Findings are accepted only when tied to paths and checked for cross-lane contradictions.

## 11. Clean-Sheet Protocol

To prevent anchoring, the clean-sheet design begins from objectives rather than current component names:

- Operator intent becomes verified software outcomes.
- Strategic ambiguity receives proportionate multi-perspective reasoning.
- Model reasoning is separated from deterministic state transitions.
- Executors receive minimal sufficient context and bounded authority.
- Verification is independent, evidence-bearing, and repairable.
- State survives interruption and is understandable off-machine.
- Learning changes later decisions without letting untrusted observations become authority.

Only after the counterfactual is complete are SGSD components mapped onto it. The target may preserve, merge, or reject current conventions.

## 12. Failure and Uncertainty Handling

- Conflicting truth is shown side by side with authority ranking and freshness.
- Missing files produce an explicit coverage gap, not an invented component.
- Stale evidence downgrades the claim label.
- Optional VTP/private-KB absence is a supported degraded state.
- A documented skill without runtime evidence is `CONFIGURED` or `DOCUMENTED`, not `OBSERVED`.
- Historical artifacts are not treated as current topology unless current consumers point to them.
- Sensitive content and private paths are not reproduced unnecessarily.
- Recommendations with weak evidence are marked low-confidence and paired with a discovery test.

## 13. HTML Report Structure

The self-contained report will use the restrained VTP explainer visual system and include:

1. Headline verdict.
2. ELI5 operating model.
3. Observed current architecture SVG.
4. Interactive versus autonomous swimlane SVG.
5. Capability and skill utilisation matrix.
6. Representative workflow traces.
7. Gate, evidence, memory, and recovery sub-diagrams.
8. Current-state contradictions and failure modes.
9. Clean-sheet frontier architecture SVG.
10. Actual-versus-ideal delta table.
11. Keep/strengthen/merge/replace/automate/remove verdicts.
12. Ranked amendment roadmap with expected benefit, risk, dependency, effort class, and proof test.
13. Source ledger separating evidence from reasoning lenses.

Observed, inferred, and recommended content must remain visually and semantically distinct throughout.

## 14. Recommendation Ranking

Recommendations are ordered by:

1. Expected outcome improvement.
2. Confidence in the causal mechanism.
3. Reduction in complexity or operator burden.
4. Safety and reversibility.
5. Implementation dependency and effort.

The report will separate immediate no/low-code operating changes, bounded architectural amendments, and milestone-scale redesigns.

## 15. Validation

Before handoff:

- Confirm every architecture node maps to at least one source.
- Confirm every material skill/route in scope has an inventory row or an explicit exclusion.
- Check all six representative traces for complete trigger-to-evidence flow.
- Check every recommendation for evidence, expected benefit, risk, and proof test.
- Scan for placeholders, contradictions, ambiguous verdicts, and unsupported certainty.
- Validate local file links and source paths.
- Confirm HTML title, required sections, SVG count, legends, and responsive behavior.
- Open the report locally and run a browser visual smoke check.
- Adversarially review the highest-impact recommendations for anchoring, novelty bias, and accidental gate weakening.

## 16. Non-Goals

- No SGSD source or runtime-state changes.
- No gate bypass, gate reimplementation, or verdict override.
- No claim that documented/configured behavior is active without evidence.
- No automatic activation of a new milestone or phase.
- No implementation roadmap masquerading as an approved plan; amendments remain proposals until the operator selects them.

## 17. Success Criteria

The design is successful when:

- A reader can explain SGSD's end-to-end operating model after viewing the first diagram.
- Interactive and autonomous modes are clearly distinct but show their shared substrate.
- Triage, board/deliberation, orchestration, and other material skills have explicit triggers, responsibilities, and handoffs.
- The audit exposes dormant, overlapping, or under-consumed capabilities.
- The clean-sheet design is not merely SGSD with renamed boxes.
- Every high-impact amendment is evidence-backed and testable.
- The report is useful as input to a future SGSD milestone without mutating active state.

## 18. Approved Design Decisions

- Full end-to-end scope, not only the interactive path.
- Layered current-state map as the visual backbone.
- Interactive operator-led orchestration highlighted as a first-class workflow.
- Adversarial current-state versus clean-sheet comparison.
- Permission to challenge every existing architectural contract.
- Source-backed HTML with explicit observed/inferred/recommended separation.
- Ranked amendment roadmap as an analytical output, not automatic implementation.
