---
status: enrichment
created: 2026-04-26
source: VTP MCP meeting and substrate search
scope: Applies to the future SGSD roadmap, Cockpit 2.0, knowledge providers, gate design, and failure testing.
---

# VIO Roadmap Enrichment

This document captures the useful design signal from the VIO conversations in
VTP. It is intentionally abstracted into SGSD design rules. Do not copy private
project details into public docs.

## VTP MCP Sources

VTP health at lookup time:

```text
books: 54
research papers: 74
meetings: 61
wiki, kb-data, substrate, manifests, chunks, entities: ok
```

Searches used:

- `vtp_search_substrate`: VIO workflow, cockpit, command center, visibility,
  validation, progressive disclosure, roadmap, Claude, agents, Codex.
- `vtp_list_meetings`: identified the VIO meeting cluster.
- `vtp_get_meeting`: pulled selected VIO meeting summaries.
- `vtp_advise_service_enrichment`: conservative SGSD roadmap enrichment pass.

Relevant meeting summaries:

- `2026-04-25 Eva Federation, Phases & SAP API Hack`
- `2026-03-20 Jarvis Knowledge Base Walkthrough & EVA Federation Onboarding`
- `2026-02-25 EVA Knowledge Base, Federated Trading Architecture & Onboarding`
- `2026-02-22 Eva Architecture & Classifier-First Quant Pipeline`
- `2026-02-19 SAP App Performance - Grid Compute & Caching`
- `2026-02-12 Eva, Yoda Trust & Filter-First Modelling`
- `2026-01-22 Eva Trading Platform Architecture & Quant Mentoring`

## VIO-Derived SGSD Rules

### 1. Make The Work Visible Enough To Help

One repeated signal is that a collaborator cannot help if they cannot see what
the AI is doing. Cockpit 2.0 should not only show "a process is running." It
should show:

- what the model is currently trying to complete,
- why that matters,
- what the current tool/agent is doing,
- what evidence has just been produced,
- what is blocked,
- and what the next repair or continuation action is.

Roadmap impact:

- v1.6 becomes Cockpit 2.0 plus startup verification.
- v1.7 must add stable activity/event contracts so the cockpit is not regexing
  loose prose forever.
- v2.1 docs should teach users how to read the cockpit as the system image.

### 2. Show A Tree, Not A Soup

The VIO workflow discussions repeatedly point toward addressable workflow trees:
parent, node value, and operator condition. For SGSD this means the cockpit and
roadmap should represent work as a structured tree:

```text
Milestone
  Phase
    Objective
      Gate
      Agent
      Artifact
      Blocker
      Unlock
```

Roadmap impact:

- v1.6 Cockpit 2.0 should add an "objective tree" or equivalent terminal view.
- v1.7 route intelligence should use stable IDs for phase, objective, agent,
  gate, artifact, and blocker.
- v1.8 gate fitness should attach gate value to the node it protected.

### 3. Hide Detail Until It Is Needed

VIO's UI feedback favors strict rendering budgets, lazy loading, plus-button
expansion, and showing only essentials on the first screen. For a terminal
cockpit, the equivalent is:

- one top row that answers the operator's most important questions,
- expandable or secondary sections for old tasks, raw logs, and long evidence,
- no duplicated status rows across panes,
- no wall of telemetry unless the operator asks for diagnostics.

Roadmap impact:

- v1.6 must define primary, secondary, and diagnostic cockpit lanes.
- v1.7 command envelopes should include compact summary fields and artifact
  links so details can stay behind a drill-in path.
- v1.8 MUDA should flag dashboard noise as extra processing.

### 4. Validate Before Trust

The VIO meetings strongly favor proving one path end to end before broadening:
single working model before many algorithms, replay validation before trusting
conversion, paper/live-paper stages before real risk. For SGSD this becomes:

- prove one cockpit data path before broad dashboard redesign,
- verify one command contract before standardizing everything,
- run failure injection before public onboarding,
- require measured evidence before declaring a gate useful.

Roadmap impact:

- v1.6 should ship a thin Cockpit 2.0 slice before any web dashboard rewrite.
- v1.7 should start with the highest-value events only.
- v1.8 should measure gate value before adding or deleting large gate families.
- v2.0 should test forced restart, malformed artifacts, stale evidence, and
  provider timeout paths before v2.1 distribution.

### 5. Classify Context Before Acting

The VIO modelling principle is filter-first: classify the regime/context before
running a strategy. SGSD's equivalent is:

- classify work type before dispatch,
- classify failure type before retry,
- classify risk tier before gate selection,
- classify knowledge hit quality before enriching plans.

Roadmap impact:

- v1.6 cockpit should display the current work mode and risk state.
- v1.7 route ledger should record why this route/gate/agent was selected.
- v1.8 gate sampling should depend on risk tier and route type.
- v1.9 retrieval should use typed failure modes and decision-impact scoring.

### 6. Keep Risk Limits Hard And Visible

The VIO architecture uses hard stop limits, local survival logic, and
rule-governed risk rather than optimistic autonomy. SGSD should copy the
principle, not the domain:

- blockers must be explicit,
- hard halts must remain hard,
- warnings should have reason codes,
- local recovery should be visible after provider or dashboard failure,
- autonomous flow should pause when evidence is unsafe or missing.

Roadmap impact:

- v1.6 cockpit must show hard blockers and next repair first-class.
- v1.7 repair instruction contracts should be mandatory for blocking gates.
- v2.0 failure tests should include "the cockpit claims green while evidence is
  missing" as a critical failure mode.

### 7. Put Knowledge Behind A Provider Boundary

VIO's knowledge-base work reinforces the VTP direction: context should come
from scoped MCP/provider calls, not by loading everything into the agent. For
SGSD this means:

- VTP is optional,
- private knowledge remains private,
- public fallback is discovery-only unless explicitly configured,
- knowledge hits need provenance and decision impact,
- raw chat history should be distilled into durable design rules before it
  changes a roadmap.

Roadmap impact:

- v1.6 should verify the optional knowledge configuration that already exists.
- v1.9 should become the deeper knowledge-provider and memory-governance
  milestone.
- v2.1 public onboarding should never assume the operator’s VTP corpus exists.

## Cockpit 2.0 Operator Questions

Cockpit 2.0 should be designed around these questions, in this order:

1. What is the model doing right now?
2. What are we trying to complete?
3. What does completing this unlock?
4. What is blocked or risky?
5. Which agents were used and what did each one do?
6. What is Codex doing or what did Codex conclude?
7. What evidence/artifacts were produced?
8. What should happen next?

The current cockpit already has much of the data. The redesign should mainly
change ordering, language, grouping, and contracts before adding telemetry.

## Roadmap Consequence

The previous v1.6 proposal was boot/setup heavy. The implementation audit shows
that most boot/setup work already exists. After the VIO enrichment pass, v1.6
should be reframed as:

```text
v1.6: Cockpit 2.0 And Startup Verification
```

Boot/setup stays inside v1.6, but as verification and documentation, not as the
main build. The main build is the cockpit operator model.

## Claude Promotion Instruction

When Claude promotes the next milestone, it should read this file alongside:

```text
C:\Users\user\GSDedits\.planning\milestones\HANDBOOK-FUTURE-IMPLEMENTATION-AUDIT.md
C:\Users\user\GSDedits\docs\reports\SGSD-VTP-Book-Enrichment-Map.html
C:\Users\user\GSDedits\docs\reports\SGSD-VTP-Visual-Handbook.html
```

Claude should then replace every `CLAUDE_ENRICHMENT_SLOT` with:

1. book rule,
2. VIO rule,
3. research corroboration,
4. existing-surface audit,
5. acceptance criteria,
6. kill/defer condition.
